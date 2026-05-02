import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout, esc } from "../views/layout.ts";

const ausencias = new Hono();

ausencias.get("/", async (c) => {
  const db = getTursoClient();
  const membersResult = await db.execute(`SELECT member_name FROM clan_members ORDER BY member_name ASC`);
  const members = membersResult.rows as any[];

  const content = `
    <div class="max-w-2xl mx-auto mt-12 px-4">
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-3xl p-10 shadow-2xl relative overflow-hidden">
        <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none">✉️</div>
        
        <div class="text-center mb-10">
          <h2 class="text-3xl font-bold font-rpg uppercase tracking-[0.2em] text-yellow-500 mb-2">Aviso de Ausencia</h2>
          <p class="text-stone-400 font-rpg uppercase tracking-widest text-xs italic">Informa al consejo sobre tu retiro temporal</p>
        </div>

        <form method="POST" action="/ausencias" class="flex flex-col gap-8">
          <div>
            <label class="block text-xs font-bold font-rpg uppercase tracking-widest text-yellow-600/80 mb-3 ml-1">Tu Nombre / Nick</label>
            <input name="member_name" list="clan-members" placeholder="Busca tu nombre en la lista..." required 
              class="w-full bg-stone-950 border border-yellow-900/10 rounded-2xl px-5 py-4 text-white focus:border-yellow-600 focus:outline-none font-rpg uppercase tracking-widest transition shadow-inner" />
            <datalist id="clan-members">
              ${members.map(m => `<option value="${esc(m.member_name)}">`).join("")}
            </datalist>
            <p class="text-[10px] text-stone-500 mt-2 italic px-1">Debes estar en la lista oficial de miembros del clan.</p>
          </div>

          <div>
            <label class="block text-xs font-bold font-rpg uppercase tracking-widest text-yellow-600/80 mb-3 ml-1">Motivo y Tiempo Estimado</label>
            <textarea name="reason" rows="4" placeholder="Ej: Estaré fuera por trabajo hasta el día 15..." required 
              class="w-full bg-stone-950 border border-yellow-900/10 rounded-2xl px-5 py-4 text-white focus:border-yellow-600 focus:outline-none font-rpg uppercase tracking-widest transition shadow-inner resize-none"></textarea>
          </div>
          
          <button type="submit"
            class="w-full bg-yellow-700 hover:bg-yellow-600 text-stone-950 font-bold font-rpg uppercase tracking-[0.2em] py-5 rounded-2xl transition shadow-xl shadow-yellow-950/20 active:scale-95 mt-2">
            Enviar Solicitud al Consejo
          </button>
        </form>

        <div class="mt-10 pt-6 border-t border-yellow-900/10 text-center">
          <a href="/" class="text-stone-600 hover:text-stone-400 transition text-[10px] font-rpg uppercase tracking-widest">← Volver al Portal</a>
        </div>
      </div>
    </div>
  `;
  return c.html(publicLayout("Aviso de Ausencia", content));
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
        <h2 class="text-2xl font-bold font-rpg text-red-500 mb-4 uppercase">Identidad Desconocida</h2>
        <p class="text-stone-400 mb-8 italic">No hemos encontrado a "${esc(name)}" en los registros oficiales del clan.</p>
        <a href="/ausencias" class="bg-yellow-700 text-stone-950 px-8 py-3 rounded-xl font-bold font-rpg uppercase tracking-widest">Volver a intentar</a>
      </div>
    `));
  }

  await db.execute({
    sql: `INSERT INTO absence_tickets (member_name, reason) VALUES (?, ?)`,
    args: [name, reason]
  });

  return c.html(publicLayout("Enviado", `
    <div class="max-w-md mx-auto mt-20 text-center">
      <p class="text-6xl mb-6">⚔️</p>
      <h2 class="text-2xl font-bold font-rpg text-yellow-500 mb-4 uppercase">Solicitud Recibida</h2>
      <p class="text-stone-400 mb-8 italic">Tu aviso de ausencia ha sido entregado al consejo. Diputado o el jefe de clan revisará tu solicitud pronto.</p>
      <a href="/" class="text-yellow-600 hover:text-yellow-500 font-rpg uppercase tracking-widest underline decoration-yellow-900/30 underline-offset-8">Volver al Portal</a>
    </div>
  `));
});

export default ausencias;
