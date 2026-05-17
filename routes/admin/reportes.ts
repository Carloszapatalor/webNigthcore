import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";
import { cacheGetStale, cacheSet, cacheDelete } from "../../lib/cache.ts";

const reportes = new Hono();

reportes.get("/", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin" && user.role !== "diputado") return c.redirect("/admin");

  const cached = cacheGetStale<{ list: any[]; members: any[] }>("admin:reportes");
  
  let list: any[] = [];
  let members: any[] = [];
  
  if (cached) {
    list = cached.list;
    members = cached.members;
  } else {
    const db = getTursoClient();
    const [reportsResult, membersResult] = await Promise.all([
      db.execute(`SELECT id, username, reason, created_at FROM member_reports ORDER BY created_at DESC`),
      db.execute(`SELECT member_name FROM clan_members ORDER BY member_name ASC`),
    ]);
    list = reportsResult.rows as any[];
    members = membersResult.rows as any[];
    cacheSet("admin:reportes", { list, members }, 2 * 60 * 1000);
  }

  const rows = list.length === 0 
    ? `<tr><td colspan="4" class="py-20 text-center text-stone-700 text-[10px] italic font-rpg uppercase tracking-[0.5em]">No hay expedientes registrados</td></tr>`
    : list.map(r => `
    <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
      <td class="py-6 px-8">
        <span class="text-sm font-bold text-white font-rpg uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">${esc(r.username)}</span>
      </td>
      <td class="py-6 px-6">
        <p class="text-stone-400 text-xs italic font-subtitle leading-relaxed">${esc(r.reason)}</p>
      </td>
      <td class="py-6 px-6 text-stone-700 font-mono text-[10px] font-bold tracking-tighter">
        ${r.created_at.slice(0, 16).replace('T', ' ')}
      </td>
      <td class="py-6 px-8 text-right">
        <div class="flex justify-end gap-4">
          <form method="POST" action="/admin/reportes/${r.id}/borrar" onsubmit="return confirm('¿Eliminar este expediente definitivamente?')">
            <button type="submit" class="text-[9px] font-rpg font-bold uppercase tracking-[0.3em] text-red-500/70 hover:text-red-400 transition-all">Eliminar</button>
          </form>
        </div>
      </td>
    </tr>`).join("");

  const content = `
    <div class="glass-panel p-10 mb-12 relative overflow-hidden">
      <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none rotate-12">📢</div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-[11px] text-white mb-8 pb-4 border-b border-white/5 flex items-center gap-4">
        <span class="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,1)]"></span>
        Abrir Nuevo Expediente
      </h2>
      <form method="POST" action="/admin/reportes/crear" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="md:col-span-1">
          <input name="username" list="clan-members" placeholder="Miembro" required 
            class="w-full bg-[#0B0D13] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-widest transition-all" />
          <datalist id="clan-members">
            ${members.map(m => `<option value="${esc(m.member_name)}">`).join("")}
          </datalist>
        </div>
        <div class="md:col-span-2">
          <input name="reason" placeholder="Motivo del reporte..." required 
            class="w-full bg-[#0B0D13] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-widest transition-all" />
        </div>
        <button type="submit" class="btn-primary text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3 rounded-xl shadow-xl active:scale-95">
          Registrar
        </button>
      </form>
    </div>

    <div class="glass-panel overflow-hidden">
      <div class="px-10 py-8 border-b border-white/5 bg-black/20 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-1.5 h-6 bg-violet-600 rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
          <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-sm text-white">Archivo de Comportamiento</h2>
        </div>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-[0.2em] font-bold bg-black/40 px-3 py-1 rounded-full">${list.length} Expedientes</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-[9px] text-stone-600 uppercase font-rpg tracking-[0.4em] bg-white/5 border-b border-white/5">
              <th class="py-6 px-8 text-left">Miembro</th>
              <th class="py-6 px-6 text-left">Motivo</th>
              <th class="py-6 px-6 text-left">Fecha</th>
              <th class="py-6 px-8"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  return c.html(adminLayout("Reportes", content, user, c.req.path));
});

reportes.post("/crear", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin" && user.role !== "diputado") return c.redirect("/admin");
  
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const reason = String(body.reason ?? "").trim();
  
  if (username && reason) {
    await getTursoClient().execute({
      sql: `INSERT INTO member_reports (username, reason) VALUES (?, ?)`,
      args: [username, reason],
    });
  }
  
  cacheDelete("admin:reportes");
  return c.redirect("/admin/reportes?ok=1");
});

reportes.post("/:id/borrar", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin" && user.role !== "diputado") return c.redirect("/admin");
  
  const id = c.req.param("id");
  await getTursoClient().execute({
    sql: `DELETE FROM member_reports WHERE id = ?`,
    args: [id],
  });
  
  cacheDelete("admin:reportes");
  return c.redirect("/admin/reportes?ok=1");
});

export default reportes;
