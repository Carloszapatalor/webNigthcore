import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout, esc } from "../views/layout.ts";
import { cacheGetStale, cacheSet } from "../lib/cache.ts";

const ausencias = new Hono();

ausencias.get("/", async (c) => {
  const db = getTursoClient();
  
  // Use cache first, then DB
  let members = cacheGetStale<any[]>("miembros:list") || [];
  if (!members.length) {
    const membersResult = await db.execute(`SELECT member_name FROM clan_members ORDER BY member_name ASC`);
    members = membersResult.rows as any[];
    if (members.length) {
      cacheSet("miembros:list", members, 5 * 60 * 1000);
    }
  }

  const content = `
    <div class="max-w-2xl mx-auto mt-12 px-4">
      <div class="glass-panel p-10 relative overflow-hidden">
        <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none rotate-12">✉️</div>
        
        <div class="text-center mb-10">
          <h2 class="text-3xl font-bold font-rpg uppercase tracking-[0.2em] text-white mb-2 neon-text-violet">Aviso de Ausencia</h2>
          <p class="text-stone-500 font-rpg uppercase tracking-widest text-[9px] font-bold italic">Informa al consejo sobre tu retiro temporal</p>
        </div>

        <form method="POST" action="/ausencias" class="flex flex-col gap-8">
          <div>
            <label class="block text-[9px] font-bold font-rpg uppercase tracking-widest text-violet-400 mb-3 ml-1">Tu Nombre / Nick</label>
            <input name="member_name" list="clan-members" placeholder="Busca tu nombre..." required 
              class="w-full bg-[#0B0D13] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-widest transition-all shadow-inner" />
            <datalist id="clan-members">
              ${members.map(m => `<option value="${esc(m.member_name)}">`).join("")}
            </datalist>
            <p class="text-[9px] text-stone-600 mt-3 italic px-1 font-bold">Debes estar en la lista oficial de miembros del clan.</p>
          </div>

          <div>
            <label class="block text-[9px] font-bold font-rpg uppercase tracking-widest text-violet-400 mb-3 ml-1">Motivo y Tiempo Estimado</label>
            <textarea name="reason" rows="4" placeholder="Ej: Estaré fuera por trabajo..." required 
              class="w-full bg-[#0B0D13] border border-white/5 rounded-2xl px-6 py-4 text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-widest transition-all shadow-inner resize-none"></textarea>
          </div>
          
          <button type="submit" class="btn-primary w-full py-5 rounded-2xl font-bold font-rpg uppercase tracking-[0.2em] mt-2">
            Enviar Solicitud al Consejo
          </button>
        </form>

        <div class="mt-10 pt-6 border-t border-white/5 text-center">
          <a href="/" class="text-stone-600 hover:text-violet-400 transition-all text-[9px] font-rpg uppercase tracking-widest font-bold">← Volver al Portal</a>
        </div>
      </div>
    </div>
  `;
  const user = c.get("user");
  return c.html(publicLayout("Aviso de Ausencia", content, user));
});

ausencias.post("/", async (c) => {
  const body = await c.req.parseBody();
  const name = String(body.member_name ?? "").trim();
  const reason = String(body.reason ?? "").trim();

  if (!name || !reason) return c.redirect("/ausencias?error=1");

  const db = getTursoClient();
  
  // Validar que el miembro existe
  const memberCheck = await db.execute({
    sql: `SELECT member_name FROM clan_members WHERE member_name = ?`,
    args: [name]
  });

    if (memberCheck.rows.length === 0) {
    return c.html(publicLayout("Error", `
      <div class="max-w-md mx-auto mt-20 text-center">
        <p class="text-6xl mb-6">⚠️</p>
        <h2 class="text-2xl font-bold font-rpg text-red-500 mb-4 uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.3)]">Identidad Desconocida</h2>
        <p class="text-stone-400 mb-8 italic font-bold">No hemos encontrado a "${esc(name)}" en los registros oficiales del clan.</p>
        <a href="/ausencias" class="btn-primary px-8 py-4 rounded-xl font-bold font-rpg uppercase tracking-widest inline-block">Volver a intentar</a>
      </div>
    `, c.get("user")));
  }

  await db.execute({
    sql: `INSERT INTO absence_tickets (member_name, reason) VALUES (?, ?)`,
    args: [name, reason]
  });

  return c.html(publicLayout("Enviado", `
    <div class="max-w-md mx-auto mt-20 text-center">
      <p class="text-6xl mb-6">⚔️</p>
      <h2 class="text-2xl font-bold font-rpg text-white mb-4 uppercase neon-text-violet">Solicitud Recibida</h2>
      <p class="text-stone-500 mb-8 italic font-bold">Tu aviso de ausencia ha sido entregado al consejo. Diputado o el jefe de clan revisará tu solicitud pronto.</p>
      <a href="/" class="text-violet-500 hover:text-violet-400 font-rpg uppercase tracking-widest underline decoration-violet-900/30 underline-offset-8 transition-all font-bold">Volver al Portal</a>
    </div>
  `, c.get("user")));
});

export default ausencias;
