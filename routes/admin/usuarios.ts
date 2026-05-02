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
    superadmin: "border-purple-800 text-purple-400 bg-purple-950/20",
    admin:      "border-blue-800 text-blue-400 bg-blue-950/20",
    diputado:   "border-cyan-800 text-cyan-400 bg-cyan-950/20",
  };

  const rows = list
    .map((u) => {
      const isSelf      = u.id === user.sub;
      const isSuperadmin = u.role === "superadmin";
      const pendingBadge = u.must_change_password
        ? `<span class="ml-1 text-xs text-yellow-500 animate-pulse" title="Debe cambiar contraseña">⚠</span>`
        : "";

      const resetCell = isSuperadmin
        ? `<span class="text-[10px] text-stone-700 font-rpg uppercase italic">—</span>`
        : `<form method="POST" action="/admin/usuarios/${u.id}/resetear" class="flex items-center gap-2"
               onsubmit="return confirm('¿Restablecer el secreto de ${esc(u.username)}?')">
             <input type="password" name="password" placeholder="Nueva pass" minlength="8" required
               class="w-28 bg-stone-950 border border-yellow-900/10 rounded-lg px-2 py-1 text-[10px] text-white focus:border-yellow-600 focus:outline-none font-rpg uppercase" />
             <button type="submit"
               class="text-[9px] font-rpg font-bold uppercase tracking-widest bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white px-2 py-1 rounded transition border border-yellow-900/10">
               Resetear
             </button>
           </form>`;

      return `
    <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition text-sm">
      <td class="py-4 px-6">
        <div class="flex items-center gap-2">
          <span class="text-stone-200 font-bold">${esc(u.username)}</span>
          ${pendingBadge}
          ${isSelf ? `<span class="text-[10px] text-stone-500 font-rpg uppercase italic tracking-widest">(Tú)</span>` : ""}
        </div>
      </td>
      <td class="py-4 px-6">
        <span class="inline-block text-[9px] font-bold px-2 py-0.5 rounded border font-rpg uppercase tracking-widest ${roleBadge[u.role] ?? "border-stone-700 text-stone-500"}">
          ${esc(u.role)}
        </span>
      </td>
      <td class="py-4 px-6 text-stone-600 font-mono text-[10px]">${u.created_at.slice(0, 10)}</td>
      <td class="py-4 px-6">${resetCell}</td>
      <td class="py-4 px-6 text-right">
        ${!isSelf
          ? `<form method="POST" action="/admin/usuarios/${u.id}/borrar" class="inline"
               onsubmit="return confirm('¿Eliminar a ${esc(u.username)} del consejo?')">
               <button type="submit" class="text-[10px] font-rpg uppercase font-bold tracking-widest text-red-400 hover:text-red-300 transition">Expulsar</button>
             </form>`
          : ""}
      </td>
    </tr>`;
    })
    .join("");

  const content = `
    ${ok ? `<div class="bg-green-900/20 border border-green-800/50 text-green-400 text-[10px] rounded-xl px-4 py-3 mb-6 font-rpg uppercase tracking-widest">✓ Los registros han sido actualizados</div>` : ""}
    ${error ? `<div class="bg-red-900/20 border border-red-800/50 text-red-400 text-[10px] rounded-xl px-4 py-3 mb-6 font-rpg uppercase tracking-widest">⚠️ ${esc(decodeURIComponent(error))}</div>` : ""}

    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-8 mb-10 shadow-xl relative overflow-hidden">
      <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none">👥</div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500 mb-6 border-b border-yellow-900/10 pb-4">👥 Reclutar Administrador</h2>
      <form method="POST" action="/admin/usuarios/crear" class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <input name="username" type="text" placeholder="Usuario" required
          class="bg-stone-950 border border-yellow-900/10 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-600 focus:outline-none font-rpg uppercase tracking-widest" />
        <input name="password" type="password" placeholder="Clave temporal" required minlength="8"
          class="bg-stone-950 border border-yellow-900/10 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-600 focus:outline-none font-rpg uppercase tracking-widest" />
        <select name="role"
          class="bg-stone-950 border border-yellow-900/10 rounded-xl px-3 py-3 text-white text-sm focus:border-yellow-600 focus:outline-none font-rpg uppercase tracking-widest">
          <option value="diputado">Diputado</option>
          <option value="admin">Admin</option>
          ${user.role === "superadmin" ? `<option value="superadmin">Superadmin</option>` : ""}
        </select>
        <button type="submit"
          class="bg-yellow-700 hover:bg-yellow-600 text-stone-950 text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3 rounded-xl transition shadow-xl active:scale-95">
          Crear
        </button>
      </form>
      <p class="text-[9px] text-stone-600 mt-4 font-rpg uppercase tracking-widest italic italic">El nuevo recluta deberá cambiar su secreto al entrar por primera vez a la fortaleza.</p>
    </div>

    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl">
      <div class="px-8 py-5 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
        <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500">📜 Consejo del Panel</h2>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest">${list.length} usuarios</span>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Usuario</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Rol</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Creado</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Resetear Pass</th>
            <th class="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Usuarios", content, user, c.req.path));
});

usuarios.post("/crear", async (c) => {
  const user = c.get("user");
  if (user.role === "diputado") return c.redirect("/admin");
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const roleInput = String(body.role ?? "");
  const allowedRoles = user.role === "superadmin" ? VALID_ROLES : (["admin", "diputado"] as const);
  const role = (allowedRoles as readonly string[]).includes(roleInput) ? roleInput : "admin";
  if (!username || password.length < 8) return c.redirect("/admin/usuarios?error=Datos+inv%C3%A1lidos");
  const db = getTursoClient();
  const hash = await hashPassword(password);
  await db.execute({
    sql: `INSERT INTO admin_users (id, username, password_hash, role, must_change_password, created_at) VALUES (?, ?, ?, ?, 1, ?)`,
    args: [crypto.randomUUID(), username, hash, role, new Date().toISOString()],
  });
  return c.redirect("/admin/usuarios?ok=1");
});

usuarios.post("/:id/resetear", async (c) => {
  const user = c.get("user");
  if (user.role === "diputado") return c.redirect("/admin");
  const id = c.req.param("id");
  const body = await c.req.parseBody();
  const newPassword = String(body.password ?? "").trim();
  if (newPassword.length < 8) return c.redirect("/admin/usuarios?error=Clave+demasiado+corta");
  const db = getTursoClient();
  const result = await db.execute({ sql: `SELECT role FROM admin_users WHERE id = ?`, args: [id] });
  if (result.rows.length === 0) return c.redirect("/admin/usuarios?error=No+existe");
  if ((result.rows[0] as any).role === "superadmin") return c.redirect("/admin/usuarios?error=Inmune");
  const hash = await hashPassword(newPassword);
  await db.execute({ sql: `UPDATE admin_users SET password_hash = ?, must_change_password = 1 WHERE id = ?`, args: [hash, id] });
  return c.redirect("/admin/usuarios?ok=1");
});

usuarios.post("/:id/borrar", async (c) => {
  const user = c.get("user");
  if (user.role === "diputado") return c.redirect("/admin");
  const id = c.req.param("id");
  if (id === user.sub) return c.redirect("/admin/usuarios?error=Auto-expulsi%C3%B3n+no+permitida");
  await getTursoClient().execute({ sql: `DELETE FROM admin_users WHERE id = ?`, args: [id] });
  return c.redirect("/admin/usuarios?ok=1");
});

export default usuarios;
