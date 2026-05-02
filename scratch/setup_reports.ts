import { getTursoClient } from "../lib/turso.ts";

async function setup() {
  const db = getTursoClient();
  console.log("Creando tabla member_reports...");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS member_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("Tabla creada con éxito.");
  Deno.exit(0);
}

setup();
