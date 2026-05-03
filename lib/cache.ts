/**
 * Caché en memoria de propósito general con TTL configurable.
 * Evita llamadas repetidas a la BD y a APIs externas costosas.
 */

import { getTursoClient } from "./turso.ts";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

let lastExpCalcTime = 0;
const EXP_REFRESH_TTL = 10 * 60 * 1000; // 10 minutos

export function getLastExpCalcTime(): number {
  return lastExpCalcTime;
}

export function setLastExpCalcTime(time: number): void {
  lastExpCalcTime = time;
}

export function shouldRefreshExp(): boolean {
  return Date.now() - lastExpCalcTime > EXP_REFRESH_TTL;
}

/* Persisted cache in BD */
export async function dbCacheGet<T>(key: string, maxAgeMs = 5 * 60 * 1000): Promise<T | undefined> {
  try {
    const db = getTursoClient();
    const result = await db.execute({
      sql: `SELECT value, updated_at FROM app_cache WHERE key = ?`,
      args: [key],
    });
    if (result.rows.length === 0) return undefined;
    const row = result.rows[0] as unknown as { value: string; updated_at: string };
    const updatedAt = new Date(row.updated_at).getTime();
    if (Date.now() - updatedAt > maxAgeMs) return undefined;
    return JSON.parse(row.value) as T;
  } catch {
    return undefined;
  }
}

export async function dbCacheSet<T>(key: string, value: T): Promise<void> {
  try {
    const db = getTursoClient();
    await db.execute({
      sql: `INSERT OR REPLACE INTO app_cache (key, value, updated_at) VALUES (?, ?, ?)`,
      args: [key, JSON.stringify(value), new Date().toISOString()],
    });
  } catch {
    // Silently fail
  }
}

export async function dbCacheIsFresh(key: string, maxAgeMs = 5 * 60 * 1000): Promise<boolean> {
  try {
    const db = getTursoClient();
    const result = await db.execute({
      sql: `SELECT updated_at FROM app_cache WHERE key = ?`,
      args: [key],
    });
    if (result.rows.length === 0) return false;
    const updatedAt = new Date((result.rows[0] as any).updated_at).getTime();
    return Date.now() - updatedAt <= maxAgeMs;
  } catch {
    return false;
  }
}

/** Obtiene un valor del caché. Devuelve `undefined` si no existe o expiró. */
export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

/** Guarda un valor en el caché con TTL en milisegundos. */
export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Invalida manualmente una clave del caché. */
export function cacheDelete(key: string): void {
  store.delete(key);
}

/**
 * Helper "stale-while-revalidate": devuelve el valor cacheado inmediatamente
 * (aunque esté expirado) y lanza el refetch en background si es necesario.
 * Ideal para páginas donde es mejor mostrar datos ligeramente viejos
 * que bloquear la respuesta esperando datos frescos.
 */
export function cacheGetStale<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  return entry?.value;
}

/**
 * Devuelve `true` si la entrada existe Y no ha expirado (está "fresca").
 */
export function cacheIsFresh(key: string): boolean {
  const entry = store.get(key);
  if (!entry) return false;
  return Date.now() <= entry.expiresAt;
}

/**
 * Helper para llamadas con timeout. Lanza AbortError si supera `timeoutMs`.
 */
export async function fetchWithTimeout(
  url: string,
  timeoutMs = 6000,
  options?: RequestInit,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}
