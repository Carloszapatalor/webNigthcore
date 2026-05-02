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

  const rows =
    list.length === 0
      ? `<tr><td colspan="4" class="py-12 text-center text-stone-600 text-sm italic font-rpg uppercase tracking-widest">La biblioteca de exenciones está vacía</td></tr>`
      : list
          .map(
            (r) => `
      <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition text-sm">
        <td class="py-4 px-6 font-bold text-stone-200">${esc(r.username)}</td>
        <td class="py-4 px-6 text-stone-400 italic">${r.reason ? esc(r.reason) : "—"}</td>
        <td class="py-4 px-6 text-stone-600 font-mono text-xs">${r.added_at}</td>
        <td class="py-4 px-6 text-right">
          <form method="POST" action="/admin/whitelist/quitar">
            <input type="hidden" name="username" value="${esc(r.username)}" />
            <button type="submit" class="text-[10px] font-rpg uppercase tracking-widest text-red-400 hover:text-red-300 transition">Quitar</button>
          </form>
        </td>
      </tr>`
          )
          .join("");

  const error = c.req.query("error");
  const ok = c.req.query("ok");

  const content = `
    ${error ? `<div class="bg-red-900/20 border border-red-800/50 text-red-400 text-xs rounded-xl px-4 py-3 mb-6 font-rpg uppercase tracking-widest">${esc(error)}</div>` : ""}
    ${ok ? `<div class="bg-green-900/20 border border-green-800/50 text-green-400 text-xs rounded-xl px-4 py-3 mb-6 font-rpg uppercase tracking-widest">✓ Pergamino actualizado correctamente</div>` : ""}

    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-8 mb-10 shadow-xl relative overflow-hidden">
      <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none">🛡️</div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500 mb-6">🛡️ Otorgar Inmunidad</h2>
      <form method="POST" action="/admin/whitelist/anadir" class="flex flex-col sm:flex-row gap-4">
        <input name="username" type="text" placeholder="Nombre del guerrero" required
          class="flex-1 bg-stone-950 border border-yellow-900/10 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-600 focus:outline-none font-rpg tracking-widest uppercase" />
        <input name="reason" type="text" placeholder="Motivo de la exención"
          class="flex-1 bg-stone-950 border border-yellow-900/10 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-600 focus:outline-none font-rpg tracking-widest uppercase" />
        <button type="submit"
          class="bg-yellow-700 hover:bg-yellow-600 text-stone-950 text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3 rounded-xl transition whitespace-nowrap shadow-lg active:scale-95">
          Otorgar
        </button>
      </form>
    </div>

    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl">
      <div class="px-8 py-5 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
        <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500">📜 Exentos de Inactividad</h2>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest">${list.length} guerreros</span>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Jugador</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Motivo</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Fecha</th>
            <th class="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Whitelist", content, user, c.req.path));
});

whitelist.post("/anadir", async (c) => {
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
