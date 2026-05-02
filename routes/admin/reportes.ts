import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";

const reportes = new Hono();

reportes.get("/", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin" && user.role !== "diputado") return c.redirect("/admin");

  const db = getTursoClient();
  const [reportsResult, membersResult] = await Promise.all([
    db.execute(`SELECT id, username, reason, created_at FROM member_reports ORDER BY created_at DESC`),
    db.execute(`SELECT member_name FROM clan_members ORDER BY member_name ASC`),
  ]);

  const list = reportsResult.rows as any[];
  const members = membersResult.rows as any[];

  const rows = list.length === 0 
    ? `<tr><td colspan="4" class="py-12 text-center text-stone-600 italic font-rpg uppercase tracking-widest text-sm">No hay expedientes registrados</td></tr>`
    : list.map(r => `
    <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition">
      <td class="py-4 px-6">
        <span class="text-sm font-bold text-yellow-500 font-rpg uppercase tracking-wider">${esc(r.username)}</span>
      </td>
      <td class="py-4 px-6">
        <p class="text-stone-300 text-xs italic leading-relaxed">${esc(r.reason)}</p>
      </td>
      <td class="py-4 px-6 text-stone-500 font-mono text-[10px] whitespace-nowrap">
        ${r.created_at.slice(0, 16).replace('T', ' ')}
      </td>
      <td class="py-4 px-6 text-right">
        <div class="flex justify-end gap-4">
          <form method="POST" action="/admin/reportes/${r.id}/borrar" onsubmit="return confirm('¿Eliminar este expediente definitivamente?')">
            <button type="submit" class="text-[10px] font-rpg font-bold uppercase tracking-widest text-red-400 hover:text-red-300 transition">Eliminar</button>
          </form>
        </div>
      </td>
    </tr>`).join("");

  const content = `
    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-8 mb-10 shadow-xl relative overflow-hidden">
      <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none">📢</div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500 mb-6 border-b border-yellow-900/10 pb-4">📢 Abrir Nuevo Expediente</h2>
      <form method="POST" action="/admin/reportes/crear" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="md:col-span-1">
          <input name="username" list="clan-members" placeholder="Miembro" required 
            class="w-full bg-stone-950 border border-yellow-900/10 rounded-xl px-4 py-3 text-sm text-white focus:border-yellow-600 focus:outline-none font-rpg uppercase tracking-widest" />
          <datalist id="clan-members">
            ${members.map(m => `<option value="${esc(m.member_name)}">`).join("")}
          </datalist>
        </div>
        <div class="md:col-span-2">
          <input name="reason" placeholder="Motivo del reporte o comportamiento..." required 
            class="w-full bg-stone-950 border border-yellow-900/10 rounded-xl px-4 py-3 text-sm text-white focus:border-yellow-600 focus:outline-none font-rpg uppercase tracking-widest" />
        </div>
        <button type="submit"
          class="bg-yellow-700 hover:bg-yellow-600 text-stone-950 text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3 rounded-xl transition shadow-xl active:scale-95">
          Registrar
        </button>
      </form>
    </div>

    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl">
      <div class="px-8 py-5 border-b border-yellow-900/10 bg-black/20">
        <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500">📜 Archivo de Comportamiento</h2>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Miembro</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Motivo</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Fecha</th>
            <th class="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
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
  
  return c.redirect("/admin/reportes?ok=1");
});

export default reportes;
