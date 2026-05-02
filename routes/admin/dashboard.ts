import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout } from "../../views/layout.ts";

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

const dashboard = new Hono();

dashboard.get("/", async (c) => {
  const user = c.get("user");
  const db = getTursoClient();
  const today = getTodayUTC();

  const [expResult, eventResult, wlResult, guidesResult] = await Promise.allSettled([
    db.execute({
      sql: `SELECT COALESCE(SUM(total_exp), 0) as today_exp FROM rpg_daily_exp WHERE date = ?`,
      args: [today],
    }),
    db.execute({
      sql: `SELECT label FROM daily_events WHERE event_date = ?`,
      args: [today],
    }),
    db.execute(`SELECT COUNT(*) as cnt FROM inactivity_whitelist`),
    db.execute(
      `SELECT title, slug, author, created_at, published FROM guides ORDER BY created_at DESC LIMIT 5`
    ),
  ]);

  const todayExp =
    expResult.status === "fulfilled"
      ? ((expResult.value.rows[0] as unknown as { today_exp: number })?.today_exp ?? 0)
      : 0;

  const eventLabel =
    eventResult.status === "fulfilled" && eventResult.value.rows.length > 0
      ? (eventResult.value.rows[0] as unknown as { label: string }).label
      : "Sin sortear hoy";

  const wlCount =
    wlResult.status === "fulfilled"
      ? (wlResult.value.rows[0] as unknown as { cnt: number }).cnt
      : "—";

  type GuideRow = { title: string; slug: string; author: string; created_at: string; published: number };
  const guides =
    guidesResult.status === "fulfilled"
      ? (guidesResult.value.rows as unknown as GuideRow[])
      : [];

  const guideRows =
    guides.length === 0
      ? `<tr><td colspan="4" class="py-12 text-center text-stone-600 text-sm italic font-rpg uppercase tracking-widest">No hay guías aún</td></tr>`
      : guides
          .map(
            (g) => `
      <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition text-sm">
        <td class="py-4 px-6 font-bold text-stone-200">${g.title}</td>
        <td class="py-4 px-6 text-stone-500 font-rpg text-xs uppercase tracking-widest">${g.author}</td>
        <td class="py-4 px-6">
          <span class="inline-block text-[10px] px-2 py-0.5 rounded border font-rpg uppercase tracking-widest ${g.published ? "border-green-800/50 text-green-400 bg-green-950/20" : "border-stone-700 text-stone-500 bg-stone-900/20"}">
            ${g.published ? "Publicada" : "Borrador"}
          </span>
        </td>
        <td class="py-4 px-6 text-stone-600 font-mono text-xs">${g.created_at.slice(0, 10)}</td>
      </tr>`
          )
          .join("");

  const content = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">📈</div>
        <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-[0.2em] mb-2 italic">EXP Ganada Hoy</p>
        <p class="text-4xl font-bold text-yellow-600 font-rpg">${Number(todayExp).toLocaleString()}</p>
      </div>
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">⚔️</div>
        <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-[0.2em] mb-2 italic">Evento Activo</p>
        <p class="text-lg font-bold text-purple-400 font-rpg leading-snug mt-1 uppercase tracking-wider">${eventLabel.split("—")[0].trim()}</p>
      </div>
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">📜</div>
        <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-[0.2em] mb-2 italic">En Whitelist</p>
        <p class="text-4xl font-bold text-stone-200 font-rpg">${wlCount}</p>
      </div>
    </div>

    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl">
      <div class="px-8 py-5 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
        <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500">📜 Últimas Guías</h2>
        <a href="/admin/guias/nueva"
          class="text-[10px] bg-yellow-700 hover:bg-yellow-600 text-stone-950 px-4 py-2 rounded-lg transition font-rpg font-bold uppercase tracking-widest shadow-lg shadow-yellow-950/20 active:scale-95">
          + Nueva Guía
        </a>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Título</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Autor</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Estado</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Fecha</th>
          </tr>
        </thead>
        <tbody>${guideRows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Dashboard", content, user, c.req.path));
});

export default dashboard;
