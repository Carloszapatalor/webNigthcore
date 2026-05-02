import { getTursoClient } from "../lib/turso.ts";

async function inspect() {
  const db = getTursoClient();
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log("Tables:", tables.rows.map(r => r[0]));

  for (const table of tables.rows) {
    const name = table[0];
    if (typeof name === 'string' && (name.includes('mission') || name.includes('quest') || name.includes('clan'))) {
      console.log(`\n--- Table: ${name} ---`);
      try {
        const columns = await db.execute(`PRAGMA table_info(${name})`);
        console.log("Columns:", columns.rows.map(r => r[1]));
        const data = await db.execute(`SELECT * FROM ${name} LIMIT 5`);
        console.log("Sample Data:", data.rows);
      } catch (e) {
        console.log("Error reading table:", e.message);
      }
    }
  }
}

inspect();
