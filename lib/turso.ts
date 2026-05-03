import { createClient, type Client } from "npm:@libsql/client/web";

// ── Singleton: una sola instancia de cliente para toda la vida del proceso ──
let _client: Client | null = null;

export function getTursoClient(): Client {
  if (_client) return _client;
  const url = Deno.env.get("TURSO_URL");
  const authToken = Deno.env.get("TURSO_AUTH_TOKEN");
  if (!url || !authToken) throw new Error("TURSO_URL or TURSO_AUTH_TOKEN not configured");
  _client = createClient({ url, authToken });
  return _client;
}

export async function initDb() {
  const db = getTursoClient();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id                   TEXT PRIMARY KEY,
      username             TEXT UNIQUE NOT NULL,
      password_hash        TEXT NOT NULL,
      role                 TEXT NOT NULL DEFAULT 'admin',
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at           TEXT NOT NULL
    )
  `);
  // Migraciones seguras: no fallan si ya existen
  await db.execute(`ALTER TABLE admin_users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`).catch(() => {});
  await db.execute(`ALTER TABLE clan_members ADD COLUMN hours_offline REAL NOT NULL DEFAULT -1`).catch(() => {});

  await db.execute(`
    CREATE TABLE IF NOT EXISTS member_alters (
      username   TEXT PRIMARY KEY,
      alter_name TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clan_members (
      member_name   TEXT PRIMARY KEY,
      rank          INTEGER NOT NULL DEFAULT 0,
      hours_offline REAL    NOT NULL DEFAULT -1,
      updated_at    TEXT NOT NULL
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS rpg_players (
      username   TEXT PRIMARY KEY,
      total_exp  INTEGER NOT NULL DEFAULT 0,
      level     INTEGER NOT NULL DEFAULT 1,
      title     TEXT NOT NULL DEFAULT '🌱 Buscador',
      last_updated TEXT NOT NULL
    )
  `);

await db.execute(`
    CREATE TABLE IF NOT EXISTS inactivity_whitelist (
      username   TEXT PRIMARY KEY,
      reason    TEXT,
      added_at  TEXT NOT NULL
    )
  `);

  // ── App Cache Persisted ─────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_cache (
      key       TEXT PRIMARY KEY,
      value     TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // ── Índices de rendimiento ────────────────────────────────────────
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_rpg_daily_date     ON rpg_daily_exp (date)`).catch(() => {});
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_rpg_daily_username ON rpg_daily_exp (username)`).catch(() => {});
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_guides_published   ON guides (published, created_at DESC)`).catch(() => {});
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_reports_created    ON member_reports (created_at DESC)`).catch(() => {});
}

