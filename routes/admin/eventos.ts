import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout } from "../../views/layout.ts";

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

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
    <div class="bg-stone-900/60 border border-yellow-900/10 rounded-2xl p-6 shadow-lg">
      <h3 class="font-bold font-rpg uppercase tracking-[0.2em] text-[10px] text-stone-500 mb-4 border-b border-yellow-900/10 pb-2">${group.title}</h3>
      <div class="space-y-3">
        ${group.items
          .map(
            (i) =>
              `<p class="text-xs text-stone-300 font-rpg tracking-wider">${i.label.split("—")[0].trim()}</p>`
          )
          .join("")}
      </div>
    </div>`
  ).join("");

  const eventPanel = event
    ? `<div class="flex flex-col md:flex-row items-center justify-between gap-6">
         <div class="text-center md:text-left">
           <span class="inline-block text-[10px] font-rpg font-bold text-yellow-600 uppercase tracking-[0.3em] mb-2 px-2 py-1 bg-yellow-900/10 rounded border border-yellow-900/20">${event.category}</span>
           <p class="text-2xl font-bold text-white font-rpg uppercase tracking-widest leading-relaxed">${event.label.split("—")[0].trim()}</p>
           <p class="text-[10px] text-stone-500 font-rpg uppercase mt-2 tracking-widest italic">Sorteado a las ${event.selected_at} UTC</p>
         </div>
         <form method="POST" action="/admin/eventos/sortear">
           <button type="submit"
             class="bg-yellow-700 hover:bg-yellow-600 text-stone-950 text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3 rounded-xl transition shadow-lg active:scale-95 whitespace-nowrap"
             onclick="return confirm('¿Forzar nuevo sorteo?')">
             🎲 Nuevo sorteo
           </button>
         </form>
       </div>`
    : `<div class="flex flex-col md:flex-row items-center justify-between gap-6">
         <p class="text-stone-500 font-rpg uppercase tracking-widest text-xs italic">No hay un evento activo para hoy todavía...</p>
         <form method="POST" action="/admin/eventos/sortear">
           <button type="submit"
             class="bg-purple-700 hover:bg-purple-600 text-white text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3 rounded-xl transition shadow-lg shadow-purple-950/20 active:scale-95">
             🎲 Lanzar Dados
           </button>
         </form>
       </div>`;

  const content = `
    ${ok ? `<div class="bg-green-900/20 border border-green-800/50 text-green-400 text-xs rounded-xl px-4 py-3 mb-8 font-rpg uppercase tracking-widest">✓ Sorteo realizado por mandato divino</div>` : ""}

    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-10 mb-12 shadow-xl relative overflow-hidden">
      <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none">🎲</div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500 mb-8 pb-4 border-b border-yellow-900/10">🎲 Evento del Día — ${today}</h2>
      ${eventPanel}
    </div>

    <div class="flex items-center gap-4 mb-8">
      <div class="h-px flex-1 bg-yellow-900/20"></div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-xs text-stone-500 italic">Catálogo de Posibilidades</h2>
      <div class="h-px flex-1 bg-yellow-900/20"></div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">${catalogCards}</div>
  `;

  return c.html(adminLayout("Eventos", content, user, c.req.path));
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
