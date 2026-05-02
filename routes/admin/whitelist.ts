import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";

const whitelist = new Hono();

whitelist.get("/", async (c) => {
  const user = c.get("user");
  const db = getTursoClient();
  const result = await db.execute(
    `SELECT username, reason, added_at FROM inactivity_whitelist ORDER BY added_at DESC`
  );
  type WlRow = { username: string; reason: string | null; added_at: string };
  const list = result.rows as unknown as WlRow[];

  const isEscudero = user.role === "escudero";

  const rows =
    list.length === 0
      ? `<tr><td colspan="4" class="py-20 text-center text-stone-700 text-[10px] italic font-rpg uppercase tracking-[0.5em]">La biblioteca de exenciones está vacía</td></tr>`
      : list
          .map(
            (r) => `
      <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
        <td class="py-5 px-8 font-bold text-stone-200 font-rpg tracking-widest text-sm uppercase">${esc(r.username)}</td>
        <td class="py-5 px-6 text-stone-500 italic font-subtitle text-sm">${r.reason ? esc(r.reason) : "—"}</td>
        <td class="py-5 px-6 text-stone-700 font-mono text-[10px] font-bold tracking-tighter">${r.added_at}</td>
        <td class="py-5 px-8 text-right">
          ${!isEscudero ? `
          <form method="POST" action="/admin/whitelist/quitar">
            <input type="hidden" name="username" value="${esc(r.username)}" />
            <button type="submit" class="text-[9px] font-rpg font-bold uppercase tracking-[0.3em] text-red-500/70 hover:text-red-400 transition-all">Quitar</button>
          </form>
          ` : ""}
        </td>
      </tr>`
          )
          .join("");

  const error = c.req.query("error");
  const ok = c.req.query("ok");

  const content = `
    ${error ? `<div class="bg-red-600/10 border border-red-500/30 text-red-400 text-[10px] rounded-xl px-6 py-4 mb-8 font-rpg uppercase tracking-[0.2em] font-bold shadow-lg animate-fade-in">${esc(error)}</div>` : ""}
    ${ok ? `<div class="bg-violet-600/10 border border-violet-500/30 text-violet-400 text-[10px] rounded-xl px-6 py-4 mb-8 font-rpg uppercase tracking-[0.2em] font-bold shadow-lg animate-fade-in">✓ Registro actualizado correctamente</div>` : ""}

    ${!isEscudero ? `
    <div class="glass-panel p-10 mb-12 relative overflow-hidden">
      <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none rotate-12">🛡️</div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-[11px] text-white mb-8 pb-4 border-b border-white/5 flex items-center gap-4">
        <span class="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(245,158,11,1)]"></span>
        Otorgar Inmunidad
      </h2>
      <form method="POST" action="/admin/whitelist/anadir" class="flex flex-col sm:flex-row gap-4">
        <input name="username" type="text" placeholder="Nombre del guerrero" required
          class="flex-1 bg-[#0B0D13] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500 focus:outline-none font-rpg tracking-widest uppercase" />
        <input name="reason" type="text" placeholder="Motivo de la exención"
          class="flex-1 bg-[#0B0D13] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500 focus:outline-none font-rpg tracking-widest uppercase" />
        <button type="submit"
          class="btn-primary text-[11px] font-bold font-rpg uppercase tracking-widest px-10 py-3 rounded-xl shadow-xl active:scale-95 whitespace-nowrap">
          Otorgar
        </button>
      </form>
    </div>
    ` : ""}

    <div class="glass-panel overflow-hidden">
      <div class="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div class="flex items-center gap-4">
          <div class="w-1.5 h-6 bg-orange-600 rounded-full shadow-[0_0_10px_rgba(245,158,11,1)]"></div>
          <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-sm text-white">Exentos de Inactividad</h2>
        </div>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-[0.2em] font-bold bg-black/40 px-3 py-1 rounded-full">${list.length} Registros</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-[9px] text-stone-600 uppercase font-rpg tracking-[0.4em] bg-white/5 border-b border-white/5">
              <th class="py-6 px-8 text-left">Jugador</th>
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

  return c.html(adminLayout("Whitelist", content, user, c.req.path));
});

whitelist.post("/anadir", async (c) => {
  const user = c.get("user");
  if (user.role === "escudero") return c.redirect("/admin/whitelist");

  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const reason = String(body.reason ?? "").trim() || null;

  if (!username) return c.redirect("/admin/whitelist?error=Nombre+requerido");

  const db = getTursoClient();
  const addedAt = new Date().toISOString().slice(0, 10);
  await db.execute({
    sql: `INSERT OR REPLACE INTO inactivity_whitelist (username, reason, added_at) VALUES (?, ?, ?)`,
    args: [username, reason, addedAt],
  });

  return c.redirect("/admin/whitelist?ok=1");
});

whitelist.post("/quitar", async (c) => {
  const user = c.get("user");
  if (user.role === "escudero") return c.redirect("/admin/whitelist");

  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();

  if (!username) return c.redirect("/admin/whitelist?error=Nombre+requerido");

  const db = getTursoClient();
  await db.execute({
    sql: `DELETE FROM inactivity_whitelist WHERE username = ?`,
    args: [username],
  });

  return c.redirect("/admin/whitelist?ok=1");
});

export default whitelist;
