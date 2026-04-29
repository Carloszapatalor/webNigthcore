import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { hashPassword } from "../../lib/hash.ts";
import { adminLayout, esc } from "../../views/layout.ts";

const VALID_ROLES = ["superadmin", "admin", "diputado"] as const;

const usuarios = new Hono();

usuarios.get("/", async (c) => {
  const user = c.get("user");
  if (user.role === "diputado") return c.redirect("/admin");

  const db = getTursoClient();
  const result = await db.execute(
    `SELECT id, username, role, must_change_password, created_at FROM admin_users ORDER BY created_at ASC`
  );
  type UserRow = { id: string; username: string; role: string; must_change_password: number; created_at: string };
  const list = result.rows as unknown as UserRow[];

  const ok = c.req.query("ok");
  const error = c.req.query("error");

  const roleBadge: Record<string, string> = {
    superadmin: "bg-purple-900/50 text-purple-400",
    admin:      "bg-blue-900/50 text-blue-400",
    diputado:   "bg-cyan-900/50 text-cyan-400",
  };

  const rows = list
    .map((u) => {
      const isSelf      = u.id === user.sub;
      const isSuperadmin = u.role === "superadmin";
      const pendingBadge = u.must_change_password
        ? `<span class="ml-1 text-xs text-yellow-500" title="Debe cambiar contraseña">⚠</span>`
        : "";

      const resetCell = isSuperadmin
        ? `<span class="text-xs text-gray-700">—</span>`
        : `<form method="POST" action="/admin/usuarios/${u.id}/resetear" class="flex items-center gap-1.5"
               onsubmit="return confirm('Resetear contraseña de ${esc(u.username)}?')">
             <input type="password" name="password" placeholder="Nueva pass" minlength="8" required
               class="w-28 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none" />
             <button type="submit"
               class="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-2 py-1 rounded transition">
               Resetear
             </button>
           </form>`;

      return `
    <tr class="border-b border-gray-800 hover:bg-gray-800/40 text-sm">
      <td class="py-3 px-4 font-medium">
        ${esc(u.username)}${pendingBadge}
        ${isSelf ? `<span class="ml-1 text-xs text-gray-600">(tú)</span>` : ""}
      </td>
      <td class="py-3 px-4">
        <span class="inline-block text-xs px-2 py-0.5 rounded-full ${roleBadge[u.role] ?? "bg-gray-800 text-gray-400"}">
          ${esc(u.role)}
        </span>
      </td>
      <td class="py-3 px-4 text-gray-500">${u.created_at.slice(0, 10)}</td>
      <td class="py-3 px-4">${resetCell}</td>
      <td class="py-3 px-4">
        ${!isSelf
          ? `<form method="POST" action="/admin/usuarios/${u.id}/borrar" class="inline"
               onsubmit="return confirm('¿Eliminar a ${esc(u.username)}?')">
               <button type="submit" class="text-xs text-red-400 hover:text-red-300 transition">Eliminar</button>
             </form>`
          : ""}
      </td>
    </tr>`;
    })
    .join("");

  const content = `
    ${ok ? `<div class="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">Operación realizada</div>` : ""}
    ${error ? `<div class="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">${esc(decodeURIComponent(error))}</div>` : ""}

    <div class="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
      <h2 class="font-semibold mb-4">Crear usuario del panel</h2>
      <form method="POST" action="/admin/usuarios/crear" class="grid grid-cols-4 gap-3">
        <input name="username" type="text" placeholder="Usuario" required
          class="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <input name="password" type="password" placeholder="Contraseña temporal (mín. 8)" required minlength="8"
          class="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <select name="role"
          class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-purple-500 focus:outline-none">
          <option value="diputado">diputado</option>
          <option value="admin">admin</option>
          ${user.role === "superadmin" ? `<option value="superadmin">superadmin</option>` : ""}
        </select>
        <button type="submit"
          class="bg-purple-600 hover:bg-purple-700 text-white text-sm px-5 py-2 rounded-lg transition">
          Crear
        </button>
      </form>
      <p class="text-xs text-gray-600 mt-2">El usuario deberá cambiar su contraseña al entrar por primera vez.</p>
    </div>

    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-800">
        <h2 class="font-semibold">Usuarios del panel (${list.length})</h2>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th class="py-3 px-4 text-left">Usuario</th>
            <th class="py-3 px-4 text-left">Rol</th>
            <th class="py-3 px-4 text-left">Creado</th>
            <th class="py-3 px-4 text-left">Resetear pass</th>
            <th class="py-3 px-4"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Usuarios", content, user));
});

usuarios.post("/crear", async (c) => {
  const user = c.get("user");
  if (user.role === "diputado") return c.redirect("/admin");

  const body = await c.req.parseBody();
  const username  = String(body.username ?? "").trim();
  const password  = String(body.password ?? "");
  const roleInput = String(body.role ?? "");

  // admin no puede crear superadmin
  const allowedRoles = user.role === "superadmin" ? VALID_ROLES : (["admin", "diputado"] as const);
  const role = (allowedRoles as readonly string[]).includes(roleInput) ? roleInput : "admin";

  if (!username || password.length < 8) {
    return c.redirect("/admin/usuarios?error=Completa+todos+los+campos+correctamente");
  }

  const db = getTursoClient();
  const id   = crypto.randomUUID();
  const hash = await hashPassword(password);
  const now  = new Date().toISOString();

  try {
    await db.execute({
      sql: `INSERT INTO admin_users (id, username, password_hash, role, must_change_password, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
      args: [id, username, hash, role, now],
    });
  } catch (e) {
    const msg = (e as Error).message.includes("UNIQUE")
      ? "Ese+nombre+de+usuario+ya+existe"
      : encodeURIComponent((e as Error).message);
    return c.redirect(`/admin/usuarios?error=${msg}`);
  }

  return c.redirect("/admin/usuarios?ok=1");
});

usuarios.post("/:id/resetear", async (c) => {
  const user = c.get("user");
  if (user.role === "diputado") return c.redirect("/admin");

  const id   = c.req.param("id");
  const body = await c.req.parseBody();
  const newPassword = String(body.password ?? "").trim();

  if (newPassword.length < 8) {
    return c.redirect("/admin/usuarios?error=La+contrase%C3%B1a+debe+tener+al+menos+8+caracteres");
  }

  const db = getTursoClient();
  const result = await db.execute({ sql: `SELECT role FROM admin_users WHERE id = ?`, args: [id] });
  if (result.rows.length === 0) {
    return c.redirect("/admin/usuarios?error=Usuario+no+encontrado");
  }

  const targetRole = (result.rows[0] as unknown as { role: string }).role;
  if (targetRole === "superadmin") {
    return c.redirect("/admin/usuarios?error=No+se+puede+resetear+la+contrase%C3%B1a+de+un+superadmin");
  }

  const hash = await hashPassword(newPassword);
  await db.execute({
    sql: `UPDATE admin_users SET password_hash = ?, must_change_password = 1 WHERE id = ?`,
    args: [hash, id],
  });

  return c.redirect("/admin/usuarios?ok=1");
});

usuarios.post("/:id/borrar", async (c) => {
  const user = c.get("user");
  if (user.role === "diputado") return c.redirect("/admin");

  const id = c.req.param("id");
  if (id === user.sub) {
    return c.redirect("/admin/usuarios?error=No+puedes+eliminarte+a+ti+mismo");
  }

  const db = getTursoClient();
  await db.execute({ sql: `DELETE FROM admin_users WHERE id = ?`, args: [id] });
  return c.redirect("/admin/usuarios?ok=1");
});

export default usuarios;
