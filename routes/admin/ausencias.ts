import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";

const adminAusencias = new Hono();

adminAusencias.get("/", async (c) => {
  const user = c.get("user");
  const db = getTursoClient();
  
  const ticketsResult = await db.execute(`SELECT * FROM absence_tickets WHERE status = 'pending' ORDER BY created_at DESC`);
  const tickets = ticketsResult.rows as any[];

  const rows = tickets.length === 0
    ? `<tr><td colspan="4" class="py-12 text-center text-stone-600 italic font-rpg uppercase tracking-widest text-sm">No hay solicitudes pendientes</td></tr>`
    : tickets.map(t => `
    <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition">
      <td class="py-4 px-6">
        <span class="text-sm font-bold text-yellow-500 font-rpg uppercase tracking-wider">${esc(t.member_name)}</span>
      </td>
      <td class="py-4 px-6">
        <p class="text-stone-300 text-xs italic leading-relaxed">${esc(t.reason)}</p>
      </td>
      <td class="py-4 px-6 text-stone-500 font-mono text-[10px] whitespace-nowrap">
        ${t.created_at.slice(0, 16).replace('T', ' ')}
      </td>
      <td class="py-4 px-6 text-right">
        <div class="flex justify-end gap-3">
          <form method="POST" action="/admin/ausencias/${t.id}/aceptar">
            <button type="submit" class="bg-green-700/80 hover:bg-green-600 text-white text-[9px] font-bold font-rpg uppercase tracking-widest px-3 py-1.5 rounded-lg transition shadow-lg active:scale-95">Aceptar</button>
          </form>
          ${user.role !== "escudero" ? `
          <form method="POST" action="/admin/ausencias/${t.id}/eliminar" onsubmit="return confirm('¿Rechazar y eliminar esta solicitud?')">
            <button type="submit" class="bg-red-900/50 hover:bg-red-800 text-red-300 text-[9px] font-bold font-rpg uppercase tracking-widest px-3 py-1.5 rounded-lg transition shadow-lg active:scale-95">Eliminar</button>
          </form>
          ` : ""}
        </div>
      </td>
    </tr>`).join("");

  const content = `
    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl mb-10">
      <div class="px-8 py-5 border-b border-yellow-900/10 bg-black/20 flex items-center justify-between">
        <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500">📥 Solicitudes de Ausencia</h2>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest">${tickets.length} pendientes</span>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Miembro</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Motivo / Tiempo</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Fecha</th>
            <th class="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Tickets de Ausencia", content, user, c.req.path));
});

adminAusencias.post("/:id/aceptar", async (c) => {
  const id = c.req.param("id");
  const db = getTursoClient();

  const ticket = await db.execute({
    sql: `SELECT member_name, reason FROM absence_tickets WHERE id = ?`,
    args: [id]
  });

  if (ticket.rows.length > 0) {
    const memberName = ticket.rows[0].member_name;
    
    // 1. Agregar a la whitelist (inactivity_whitelist)
    const addedAt = new Date().toISOString().slice(0, 10);
    const reason = `Ausencia: ${ticket.rows[0].reason || "No especificada"}`;
    
    await db.execute({
      sql: `INSERT OR REPLACE INTO inactivity_whitelist (username, reason, added_at) VALUES (?, ?, ?)`,
      args: [memberName, reason, addedAt]
    });

    // 2. Marcar ticket como aceptado o simplemente borrarlo para limpiar
    await db.execute({
      sql: `DELETE FROM absence_tickets WHERE id = ?`,
      args: [id]
    });
  }

  return c.redirect("/admin/ausencias?ok=1");
});

adminAusencias.post("/:id/eliminar", async (c) => {
  const user = c.get("user");
  if (user.role === "escudero") return c.redirect("/admin/ausencias");
  
  const id = c.req.param("id");
  await getTursoClient().execute({
    sql: `DELETE FROM absence_tickets WHERE id = ?`,
    args: [id]
  });
  
  return c.redirect("/admin/ausencias?ok=1");
});

export default adminAusencias;
