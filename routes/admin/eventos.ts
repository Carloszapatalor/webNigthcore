import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";

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
    <div class="glass-panel p-6 shadow-lg hover:border-violet-500/30 transition-all duration-300 group">
      <h3 class="font-bold font-rpg uppercase tracking-[0.2em] text-[10px] text-stone-500 mb-4 border-b border-white/5 pb-2 group-hover:text-violet-400 transition-colors">${group.title}</h3>
      <div class="space-y-3">
        ${group.items
          .map(
            (i) =>
              `<p class="text-[10px] text-stone-400 font-rpg tracking-[0.2em] uppercase font-bold">${i.label.split("—")[0].trim()}</p>`
          )
          .join("")}
      </div>
    </div>`
  ).join("");

  const eventPanel = event
    ? `<div class="flex flex-col md:flex-row items-center justify-between gap-6">
         <div class="text-center md:text-left">
           <span class="inline-block text-[10px] font-rpg font-bold text-violet-400 uppercase tracking-[0.3em] mb-2 px-3 py-1 bg-violet-600/10 rounded-lg border border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.1)]">${event.category}</span>
           <p class="text-2xl font-bold text-white font-rpg uppercase tracking-widest leading-relaxed drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">${event.label.split("—")[0].trim()}</p>
           <p class="text-[10px] text-stone-600 font-rpg uppercase mt-2 tracking-widest italic font-bold">Sorteado a las ${event.selected_at} UTC</p>
         </div>
         ${user.role !== "escudero" ? `
         <form method="POST" action="/admin/eventos/sortear">
           <button type="submit"
             class="btn-primary text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3 rounded-xl shadow-xl active:scale-95 whitespace-nowrap"
             onclick="return confirm('¿Forzar nuevo sorteo?')">
             🎲 Nuevo sorteo
           </button>
         </form>` : ""}
       </div>`
    : `<div class="flex flex-col md:flex-row items-center justify-between gap-6">
         <p class="text-stone-600 font-rpg uppercase tracking-widest text-[10px] italic font-bold">No hay un evento activo para hoy todavía...</p>
         ${user.role !== "escudero" ? `
         <form method="POST" action="/admin/eventos/sortear">
           <button type="submit"
             class="btn-primary text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3 rounded-xl shadow-xl active:scale-95">
             🎲 Lanzar Dados
           </button>
         </form>` : ""}
       </div>`;

  const content = `
    ${ok ? `<div class="bg-violet-600/10 border border-violet-500/30 text-violet-400 text-[10px] rounded-xl px-6 py-4 mb-8 font-rpg uppercase tracking-[0.2em] font-bold shadow-lg animate-fade-in">✓ Sorteo realizado por mandato divino</div>` : ""}

    <div class="glass-panel p-10 mb-12 relative overflow-hidden">
      <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none rotate-12">🎲</div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-[11px] text-white mb-8 pb-4 border-b border-white/5 flex items-center gap-4">
        <span class="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,1)]"></span>
        Evento del Día — ${today}
      </h2>
      ${eventPanel}
    </div>

    <div class="flex items-center gap-4 mb-8">
      <div class="h-px flex-1 bg-white/5"></div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.4em] text-[9px] text-stone-600 italic">Catálogo de Posibilidades</h2>
      <div class="h-px flex-1 bg-white/5"></div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">${catalogCards}</div>
  `;

  return c.html(adminLayout("Eventos", content, user, c.req.path));
});

eventos.post("/sortear", async (c) => {
  const user = c.get("user");
  if (user.role === "escudero") return c.redirect("/admin/eventos");
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
