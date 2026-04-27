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
      ? `<tr><td colspan="4" class="py-8 text-center text-gray-600 text-sm">La whitelist está vacía</td></tr>`
      : list
          .map(
            (r) => `
      <tr class="border-b border-gray-800 hover:bg-gray-800/40 text-sm">
        <td class="py-3 px-4 font-medium">${esc(r.username)}</td>
        <td class="py-3 px-4 text-gray-400">${r.reason ? esc(r.reason) : "—"}</td>
        <td class="py-3 px-4 text-gray-500">${r.added_at}</td>
        <td class="py-3 px-4">
          <form method="POST" action="/admin/whitelist/quitar">
            <input type="hidden" name="username" value="${esc(r.username)}" />
            <button type="submit" class="text-xs text-red-400 hover:text-red-300 transition">Quitar</button>
          </form>
        </td>
      </tr>`
          )
          .join("");

  const error = c.req.query("error");
  const ok = c.req.query("ok");

  const content = `
    ${error ? `<div class="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">${esc(error)}</div>` : ""}
    ${ok ? `<div class="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">Operación realizada correctamente</div>` : ""}

    <div class="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
      <h2 class="font-semibold mb-4">Añadir a whitelist</h2>
      <form method="POST" action="/admin/whitelist/anadir" class="flex gap-3">
        <input name="username" type="text" placeholder="Nombre del jugador" required
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <input name="reason" type="text" placeholder="Motivo (opcional)"
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <button type="submit"
          class="bg-purple-600 hover:bg-purple-700 text-white text-sm px-5 py-2 rounded-lg transition whitespace-nowrap">
          Añadir
        </button>
      </form>
    </div>

    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 class="font-semibold">Exentos de inactividad</h2>
        <span class="text-xs text-gray-500">${list.length} jugadores</span>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th class="py-3 px-4 text-left">Jugador</th>
            <th class="py-3 px-4 text-left">Motivo</th>
            <th class="py-3 px-4 text-left">Añadido</th>
            <th class="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Whitelist", content, user));
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
