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
  const eventLabel = eventResult.status === "fulfilled" && eventResult.value.rows.length > 0 ? (eventResult.value.rows[0] as any).label : "Sector Seguro";
  const wlCount = wlResult.status === "fulfilled" ? (wlResult.value.rows[0] as any).cnt : "—";
  const guides = guidesResult.status === "fulfilled" ? (guidesResult.value.rows as any[]) : [];
  const inactiveList = inactiveResult.status === "fulfilled" ? (inactiveResult.value.rows as any[]) : [];
  const reportsList = reportsResult.status === "fulfilled" ? (reportsResult.value.rows as any[]) : [];

  const isHighRank = user.role === "superadmin" || user.role === "diputado";

  let adminSections = "";
  if (isHighRank) {
    adminSections = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-12">
      <!-- Inactividad Section -->
      <div class="lg:col-span-1 glass-panel overflow-hidden flex flex-col hover:border-red-500/20 transition-all duration-500">
        <div class="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-red-950/5">
          <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-[10px] text-red-400 flex items-center gap-3">
            <span class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,1)] animate-pulse"></span>
            Inactividad
          </h2>
          <span class="text-[9px] text-stone-600 font-rpg uppercase tracking-widest font-bold bg-black/40 px-3 py-1 rounded-full">${inactiveList.length}</span>
        </div>
        <div class="flex-1 max-h-[400px] overflow-y-auto">
          <table class="w-full">
            <tbody class="divide-y divide-white/5">
              ${inactiveList.length === 0 ? `<tr><td class="py-12 text-center text-stone-700 text-[10px] font-rpg uppercase tracking-widest italic">Nadie inactivo</td></tr>` : 
                inactiveList.map(m => `
                <tr class="hover:bg-red-500/5 transition-all">
                  <td class="py-4 px-8 text-xs font-bold text-stone-300 font-subtitle uppercase tracking-wider truncate max-w-[120px]">${esc(m.member_name)}</td>
                  <td class="py-4 px-8 text-right font-rpg text-xs text-red-500/80 font-bold whitespace-nowrap drop-shadow-[0_0_5px_rgba(239,68,68,0.2)]">${Math.round(m.hours_offline)} <span class="text-[9px] opacity-40 uppercase tracking-tighter">Horas</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Reportes Section -->
      <div class="lg:col-span-2 glass-panel overflow-hidden flex flex-col hover:border-violet-500/20 transition-all duration-500">
        <div class="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-violet-950/5">
          <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-[10px] text-violet-400 flex items-center gap-3">
            <span>📢</span> Reportes
          </h2>
          <a href="/admin/reportes" class="text-[9px] text-stone-500 hover:text-violet-400 font-rpg uppercase tracking-widest transition-all font-bold group">Ver todos <span class="inline-block group-hover:translate-x-1 transition-transform">→</span></a>
        </div>
        <div class="flex-1 max-h-[400px] overflow-y-auto p-8 space-y-4">
            ${reportsList.length === 0 ? `<div class="py-20 text-center text-stone-700 text-[10px] font-rpg uppercase tracking-widest italic font-bold">Sin reportes</div>` : 
              reportsList.map(r => `
              <div class="px-6 py-4 bg-black/40 rounded-2xl border border-white/5 hover:border-violet-500/20 transition-all group">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold text-violet-400 font-rpg uppercase tracking-widest">${esc(r.username)}</span>
                  <span class="text-[9px] text-stone-700 font-mono font-bold uppercase tracking-tighter">${r.created_at.slice(5, 16).replace('T', ' ')}</span>
                </div>
                <p class="text-stone-400 text-xs leading-relaxed font-subtitle italic border-l-2 border-violet-500/20 pl-4 ml-1">${esc(r.reason)}</p>
              </div>
            `).join("")}
        </div>
      </div>
    </div>`;
  }

  const guideRows = guides.length === 0
      ? `<tr><td colspan="4" class="py-20 text-center text-stone-700 text-[10px] font-rpg uppercase tracking-widest italic">Biblioteca vacía</td></tr>`
      : guides.map((g) => `
      <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
        <td class="py-5 px-8 font-bold text-stone-200 font-rpg tracking-widest text-sm uppercase">${esc(g.title)}</td>
        <td class="py-5 px-6 text-stone-500 font-rpg text-[10px] uppercase tracking-widest font-bold">${esc(g.author)}</td>
        <td class="py-5 px-6">
          <span class="inline-flex items-center gap-2 text-[9px] font-bold px-3 py-1 rounded-full border font-rpg uppercase tracking-widest ${g.published ? "border-green-500/30 text-green-400 bg-green-500/5" : "border-stone-800 text-stone-600 bg-black/20"}">
            <span class="w-1 h-1 rounded-full ${g.published ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)]' : 'bg-stone-700'}"></span>
            ${g.published ? "Activo" : "Pendiente"}
          </span>
        </td>
        <td class="py-5 px-6 text-stone-700 font-mono text-[10px] font-bold tracking-tighter">${g.created_at.slice(0, 10)}</td>
      </tr>`).join("");

  const content = `
    <!-- MAIN KPI -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
      <div class="glass-panel p-8 relative overflow-hidden group hover:border-violet-500/20 transition-all duration-500">
        <div class="absolute -right-8 -top-8 text-9xl opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">📈</div>
        <p class="text-stone-600 text-[9px] uppercase font-rpg tracking-[0.4em] mb-3 font-bold">EXP de hoy</p>
        <div class="flex items-baseline gap-2">
          <span class="text-5xl font-bold text-white font-rpg tracking-tighter">${Number(todayExp).toLocaleString()}</span>
          <span class="text-violet-500/50 font-rpg text-[10px] uppercase font-bold tracking-widest">EXP</span>
        </div>
      </div>

      <div class="glass-panel p-8 relative overflow-hidden group hover:border-cyan-500/20 transition-all duration-500">
        <div class="absolute -right-8 -top-8 text-9xl opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">⚔️</div>
        <p class="text-stone-600 text-[9px] uppercase font-rpg tracking-[0.4em] mb-3 font-bold">Evento</p>
        <p class="text-xl font-bold text-cyan-400 font-rpg tracking-wider uppercase leading-tight drop-shadow-[0_0_15px_rgba(6,182,212,0.3)]">${eventLabel.split(/[—–-]/)[0].trim()}</p>
      </div>

      <div class="glass-panel p-8 relative overflow-hidden group hover:border-orange-500/20 transition-all duration-500">
        <div class="absolute -right-8 -top-8 text-9xl opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">🛡️</div>
        <p class="text-stone-600 text-[9px] uppercase font-rpg tracking-[0.4em] mb-3 font-bold">Whitelist</p>
        <div class="flex items-baseline gap-2">
          <span class="text-5xl font-bold text-white font-rpg tracking-tighter">${wlCount}</span>
          <span class="text-orange-500/50 font-rpg text-[10px] uppercase font-bold tracking-widest">Activos</span>
        </div>
      </div>
    </div>

    <!-- ADMIN SECTIONS -->
    ${adminSections}

    <!-- GUIDES LIST -->
    <div class="glass-panel overflow-hidden">
      <div class="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div class="flex items-center gap-4">
          <div class="w-1.5 h-6 bg-violet-600 rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
          <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-[11px] text-white">Pergaminos</h2>
        </div>
        <a href="/admin/guias/nueva"
          class="text-[10px] btn-primary px-6 py-3 rounded-xl transition-all duration-300 font-rpg font-bold uppercase tracking-[0.2em]">
          + Nuevo Pergamino
        </a>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[9px] text-stone-700 uppercase font-rpg tracking-[0.4em] bg-white/5 border-b border-white/5">
            <th class="py-5 px-8 text-left">Título</th>
            <th class="py-5 px-6 text-left">Autor</th>
            <th class="py-5 px-6 text-left">Estado</th>
            <th class="py-5 px-6 text-left">Fecha</th>
          </tr>
        </thead>
        <tbody>${guideRows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Dashboard Administrativo", content, user, c.req.path));
});

export default dashboard;
