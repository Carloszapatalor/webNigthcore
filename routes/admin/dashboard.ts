import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

const dashboard = new Hono();

dashboard.get("/", async (c) => {
  const user = c.get("user");
  const db = getTursoClient();
  const today = getTodayUTC();

  const [expResult, eventResult, wlResult, guidesResult, inactiveResult, reportsResult] = await Promise.allSettled([
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
    db.execute(`SELECT member_name, hours_offline FROM clan_members WHERE hours_offline >= 30 ORDER BY hours_offline DESC`),
    db.execute(`SELECT username, reason, created_at FROM member_reports ORDER BY created_at DESC LIMIT 10`),
  ]);

  const todayExp = expResult.status === "fulfilled" ? ((expResult.value.rows[0] as any)?.today_exp ?? 0) : 0;
  const eventLabel = eventResult.status === "fulfilled" && eventResult.value.rows.length > 0 ? (eventResult.value.rows[0] as any).label : "Sin sortear hoy";
  const wlCount = wlResult.status === "fulfilled" ? (wlResult.value.rows[0] as any).cnt : "—";
  const guides = guidesResult.status === "fulfilled" ? (guidesResult.value.rows as any[]) : [];
  const inactiveList = inactiveResult.status === "fulfilled" ? (inactiveResult.value.rows as any[]) : [];
  const reportsList = reportsResult.status === "fulfilled" ? (reportsResult.value.rows as any[]) : [];

  const isHighRank = user.role === "superadmin" || user.role === "diputado";

  let adminSections = "";
  if (isHighRank) {
    adminSections = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
      <!-- Inactividad Section -->
      <div class="lg:col-span-1 bg-stone-900/60 border border-red-900/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div class="px-6 py-4 border-b border-red-900/10 flex items-center justify-between bg-red-950/10">
          <h2 class="font-bold font-rpg uppercase tracking-widest text-xs text-red-400 flex items-center gap-2">
            <span>⌛</span> Inactividad
          </h2>
          <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest">${inactiveList.length}</span>
        </div>
        <div class="flex-1 max-h-[350px] overflow-y-auto">
          <table class="w-full">
            <tbody class="divide-y divide-red-900/5">
              ${inactiveList.length === 0 ? `<tr><td class="py-6 text-center text-stone-600 text-xs italic">Todos activos</td></tr>` : 
                inactiveList.map(m => `
                <tr class="hover:bg-red-950/5 transition">
                  <td class="py-3 px-6 text-xs font-bold text-stone-200 truncate max-w-[100px]">${esc(m.member_name)}</td>
                  <td class="py-3 px-6 text-right font-mono text-[10px] text-red-400 whitespace-nowrap">${Math.round(m.hours_offline)}h</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Reportes Section (Preview Only) -->
      <div class="lg:col-span-2 bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div class="px-6 py-4 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
          <h2 class="font-bold font-rpg uppercase tracking-widest text-xs text-yellow-500 flex items-center gap-2">
            <span>📢</span> Últimos Reportes
          </h2>
          <a href="/admin/reportes" class="text-[10px] text-yellow-600 hover:text-yellow-500 font-rpg uppercase tracking-widest transition underline decoration-yellow-900/30 underline-offset-4">Gestionar Reportes →</a>
        </div>
        <div class="flex-1 max-h-[350px] overflow-y-auto p-4 space-y-3">
            ${reportsList.length === 0 ? `<p class="py-12 text-center text-stone-600 text-xs italic">No hay reportes recientes</p>` : 
              reportsList.map(r => `
              <div class="px-5 py-3 bg-stone-950/30 rounded-xl border border-yellow-900/5 hover:border-yellow-900/10 transition">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-bold text-yellow-500 font-rpg uppercase tracking-wider">${esc(r.username)}</span>
                  <span class="text-[9px] text-stone-600 font-mono italic">${r.created_at.slice(5, 16).replace('T', ' ')}</span>
                </div>
                <p class="text-stone-300 text-xs leading-relaxed italic border-l-2 border-yellow-900/20 pl-3 ml-1">${esc(r.reason)}</p>
              </div>
            `).join("")}
        </div>
      </div>
    </div>`;
  }

  const guideRows = guides.length === 0
      ? `<tr><td colspan="4" class="py-12 text-center text-stone-600 text-sm italic font-rpg uppercase tracking-widest">No hay guías aún</td></tr>`
      : guides.map((g) => `
      <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition text-sm">
        <td class="py-4 px-6 font-bold text-stone-200">${esc(g.title)}</td>
        <td class="py-4 px-6 text-stone-500 font-rpg text-xs uppercase tracking-widest">${esc(g.author)}</td>
        <td class="py-4 px-6">
          <span class="inline-block text-[10px] px-2 py-0.5 rounded border font-rpg uppercase tracking-widest ${g.published ? "border-green-800/50 text-green-400 bg-green-950/20" : "border-stone-700 text-stone-500 bg-stone-900/20"}">
            ${g.published ? "Publicada" : "Borrador"}
          </span>
        </td>
        <td class="py-4 px-6 text-stone-600 font-mono text-xs">${g.created_at.slice(0, 10)}</td>
      </tr>`).join("");

  const content = `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">📈</div>
        <p class="text-stone-500 text-xs uppercase font-rpg tracking-[0.2em] mb-2 italic">EXP Ganada Hoy</p>
        <p class="text-4xl font-bold text-yellow-600 font-rpg">${Number(todayExp).toLocaleString()}</p>
      </div>
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">⚔️</div>
        <p class="text-stone-500 text-xs uppercase font-rpg tracking-[0.2em] mb-2 italic">Evento Activo</p>
        <p class="text-lg font-bold text-purple-400 font-rpg leading-snug mt-1 uppercase tracking-wider">${eventLabel.split("—")[0].trim()}</p>
      </div>
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">📜</div>
        <p class="text-stone-500 text-xs uppercase font-rpg tracking-[0.2em] mb-2 italic">En Whitelist</p>
        <p class="text-4xl font-bold text-stone-200 font-rpg">${wlCount}</p>
      </div>
    </div>

    ${adminSections}

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
