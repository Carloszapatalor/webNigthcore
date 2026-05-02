import { getTursoClient } from "../lib/turso.ts";

async function migrate() {
  const db = getTursoClient();
  console.log("Migrando roles de 'admin' a 'escudero'...");
  const result = await db.execute("UPDATE admin_users SET role = 'escudero' WHERE role = 'admin'");
  console.log(`Migración completada. Filas afectadas: ${result.rowsAffected}`);
  Deno.exit(0);
}

migrate();
