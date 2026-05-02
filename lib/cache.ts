/**
 * Caché en memoria de propósito general con TTL configurable.
 * Evita llamadas repetidas a la BD y a APIs externas costosas.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

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
