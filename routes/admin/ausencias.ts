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
    ? `<tr><td colspan="4" class="py-20 text-center text-stone-700 text-[10px] italic font-rpg uppercase tracking-[0.5em]">No hay solicitudes pendientes</td></tr>`
    : tickets.map(t => `
    <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
      <td class="py-6 px-8">
        <span class="text-sm font-bold text-white font-rpg uppercase tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">${esc(t.member_name)}</span>
      </td>
      <td class="py-6 px-6">
        <p class="text-stone-400 text-xs italic font-subtitle leading-relaxed">${esc(t.reason)}</p>
      </td>
      <td class="py-6 px-6 text-stone-700 font-mono text-[10px] font-bold tracking-tighter">
        ${t.created_at.slice(0, 16).replace('T', ' ')}
      </td>
      <td class="py-6 px-8 text-right">
        <div class="flex justify-end gap-4">
          <form method="POST" action="/admin/ausencias/${t.id}/aceptar">
            <button type="submit" class="text-[9px] font-rpg font-bold uppercase tracking-[0.3em] text-green-500/70 hover:text-green-400 transition-all">Aceptar</button>
          </form>
          ${user.role !== "escudero" ? `
          <form method="POST" action="/admin/ausencias/${t.id}/eliminar" onsubmit="return confirm('¿Rechazar y eliminar esta solicitud?')">
            <button type="submit" class="text-[9px] font-rpg font-bold uppercase tracking-[0.3em] text-red-500/70 hover:text-red-400 transition-all">Eliminar</button>
          </form>
          ` : ""}
        </div>
      </td>
    </tr>`).join("");

  const content = `
    <div class="glass-panel overflow-hidden">
      <div class="px-10 py-8 border-b border-white/5 bg-black/20 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-1.5 h-6 bg-violet-600 rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
          <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-sm text-white">Solicitudes de Ausencia</h2>
        </div>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-[0.2em] font-bold bg-black/40 px-3 py-1 rounded-full">${tickets.length} Pendientes</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-[9px] text-stone-600 uppercase font-rpg tracking-[0.4em] bg-white/5 border-b border-white/5">
              <th class="py-6 px-8 text-left">Miembro</th>
              <th class="py-6 px-6 text-left">Motivo / Tiempo</th>
              <th class="py-6 px-6 text-left">Fecha</th>
              <th class="py-6 px-8"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">${rows}</tbody>
        </table>
      </div>
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
