import { createClient } from "npm:@libsql/client/web";

export function getTursoClient() {
  const url = Deno.env.get("TURSO_URL");
  const authToken = Deno.env.get("TURSO_AUTH_TOKEN");
  if (!url || !authToken) throw new Error("TURSO_URL or TURSO_AUTH_TOKEN not configured");
  return createClient({ url, authToken });
}

export async function initDb() {
  const db = getTursoClient();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id            TEXT PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'admin',
      created_at    TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS member_alters (
      username   TEXT PRIMARY KEY,
      alter_name TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clan_members (
      member_name TEXT PRIMARY KEY,
      rank        INTEGER NOT NULL DEFAULT 0,
      updated_at  TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS guides (
      id         TEXT PRIMARY KEY,
      slug       TEXT UNIQUE NOT NULL,
      title      TEXT NOT NULL,
      content    TEXT NOT NULL,
      published  INTEGER NOT NULL DEFAULT 0,
      author     TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}
