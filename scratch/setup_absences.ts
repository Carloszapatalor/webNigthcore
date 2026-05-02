import { getTursoClient } from "../lib/turso.ts";

const db = getTursoClient();

console.log("Creando tabla absence_tickets...");
await db.execute(`
  CREATE TABLE IF NOT EXISTS absence_tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_name TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log("Tabla creada correctamente.");
Deno.exit(0);
