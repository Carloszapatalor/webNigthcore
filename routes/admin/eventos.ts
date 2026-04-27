import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout } from "../../views/layout.ts";

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// Labels idénticos a los del bot para consistencia en la BD
const INCURSIONES = [
  { id: "ReckoningOfTheGods",    label: "⚔️ Incursión: El ocaso de los dioses — ¡Iniciamos en 5 min!" },
  { id: "GuardiansOfTheCitadel", label: "🏰 Incursión: Guardianes de la Ciudadela — ¡Iniciamos en 5 min!" },
];
const JEFES_CLAN = [
  { id: "SkeletonWarrior",   label: "💀 Jefe de clan: Guerrero Esqueleto — ¡Iniciamos en 5 min!" },
  { id: "MalignantSpider",   label: "🕷️ Jefe de clan: Araña Maligna — ¡Iniciamos en 5 min!" },
  { id: "OtherworldlyGolem", label: "🪨 Jefe de clan: Gólem Sobrenatural — ¡Iniciamos en 5 min!" },
];
const EVENTOS_CLAN = [
  { id: "CombatBigLootDaily", label: "💰 Evento: Gran Botín de Combate — ¡Únete ahora!" },
  { id: "CombatBigExpDaily",  label: "✨ Evento: Gran Experiencia de Combate — ¡Únete ahora!" },
  { id: "Crafting",           label: "🔨 Evento: Fabricación — ¡Únete ahora!" },
  { id: "Gathering",          label: "🌿 Evento: Recolección — ¡Únete ahora!" },
];

const CATALOG = [
  { title: "⚔️ Incursiones", key: "incursion", items: INCURSIONES },
  { title: "💀 Jefes de Clan", key: "jefe",     items: JEFES_CLAN },
  { title: "🎯 Eventos",       key: "evento",    items: EVENTOS_CLAN },
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const eventos = new Hono();

eventos.get("/", async (c) => {
  const user = c.get("user");
  const db = getTursoClient();
  const today = getTodayUTC();

  const result = await db.execute({
    sql: `SELECT category, event_id, label, selected_at FROM daily_events WHERE event_date = ?`,
    args: [today],
  });

  type EventRow = { category: string; event_id: string; label: string; selected_at: string };
  const event = result.rows.length > 0 ? (result.rows[0] as unknown as EventRow) : null;

  const ok = c.req.query("ok");

  const catalogCards = CATALOG.map(
    (group) => `
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 class="font-medium text-sm text-gray-400 mb-3">${group.title}</h3>
      ${group.items
        .map(
          (i) =>
            `<p class="text-sm py-1.5 border-b border-gray-800 last:border-0 text-gray-300">${i.label.split("—")[0].trim()}</p>`
        )
        .join("")}
    </div>`
  ).join("");

  const eventPanel = event
    ? `<div class="flex items-start justify-between">
         <div>
           <span class="inline-block text-xs text-gray-500 uppercase tracking-wide mb-2">${event.category}</span>
           <p class="text-xl font-semibold text-white">${event.label.split("—")[0].trim()}</p>
           <p class="text-sm text-gray-500 mt-2">Sorteado a las ${event.selected_at} UTC</p>
         </div>
         <form method="POST" action="/admin/eventos/sortear">
           <button type="submit"
             class="bg-cyan-700 hover:bg-cyan-600 text-white text-sm px-4 py-2 rounded-lg transition"
             onclick="return confirm('¿Forzar nuevo sorteo?')">
             🎲 Nuevo sorteo
           </button>
         </form>
       </div>`
    : `<div class="flex items-center justify-between">
         <p class="text-gray-500">No hay evento sorteado para hoy.</p>
         <form method="POST" action="/admin/eventos/sortear">
           <button type="submit"
             class="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition">
             🎲 Sortear ahora
           </button>
         </form>
       </div>`;

  const content = `
    ${ok ? `<div class="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">Nuevo sorteo realizado</div>` : ""}

    <div class="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
      <h2 class="font-semibold mb-4">Evento de hoy — ${today}</h2>
      ${eventPanel}
    </div>

    <h2 class="font-semibold mb-3 text-gray-300">Catálogo disponible</h2>
    <div class="grid grid-cols-3 gap-4">${catalogCards}</div>
  `;

  return c.html(adminLayout("Eventos", content, user));
});

eventos.post("/sortear", async (c) => {
  const db = getTursoClient();
  const today = getTodayUTC();

  await db.execute({ sql: `DELETE FROM daily_events WHERE event_date = ?`, args: [today] });

  const { key: category, items } = pickRandom(CATALOG);
  const picked = pickRandom(items);
  const selectedAt = new Date().toISOString().slice(11, 16);

  await db.execute({
    sql: `INSERT OR IGNORE INTO daily_events (event_date, category, event_id, label, selected_at) VALUES (?, ?, ?, ?, ?)`,
    args: [today, category, picked.id, picked.label, selectedAt],
  });

  return c.redirect("/admin/eventos?ok=1");
});

export default eventos;
