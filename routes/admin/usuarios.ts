import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { hashPassword } from "../../lib/hash.ts";
import { adminLayout, esc } from "../../views/layout.ts";

const VALID_ROLES = ["superadmin", "diputado", "escudero"] as const;

const usuarios = new Hono();

usuarios.get("/", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin") return c.redirect("/admin");

  const db = getTursoClient();
  const result = await db.execute(
    `SELECT id, username, role, must_change_password, created_at FROM admin_users ORDER BY created_at ASC`
  );
  type UserRow = { id: string; username: string; role: string; must_change_password: number; created_at: string };
  const list = result.rows as unknown as UserRow[];

  const ok = c.req.query("ok");
  const error = c.req.query("error");

  const roleColors: Record<string, string> = {
    superadmin: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/5 shadow-[0_0_10px_rgba(192,38,211,0.2)]",
    diputado:   "text-cyan-400 border-cyan-500/30 bg-cyan-500/5 shadow-[0_0_10px_rgba(6,182,212,0.2)]",
    escudero:   "text-amber-500 border-amber-500/30 bg-amber-500/5 shadow-[0_0_10px_rgba(245,158,11,0.2)]",
  };

  const rows = list
    .map((u) => {
      const isSelf      = u.id === user.sub;
      const isSuperadmin = u.role === "superadmin";
      const pendingBadge = u.must_change_password
        ? `<span class="ml-2 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,1)]" title="Cambio de contraseña pendiente"></span>`
        : "";

      const resetCell = isSuperadmin
        ? `<span class="text-[9px] text-stone-700 font-rpg uppercase italic tracking-widest font-bold">Inmune</span>`
        : `<form method="POST" action="/admin/usuarios/${u.id}/resetear" class="flex items-center gap-3"
               onsubmit="return confirm('¿Restablecer el secreto de ${esc(u.username)}?')">
             <input type="password" name="password" placeholder="Nueva pass" minlength="8" required
               class="w-32 bg-[#0B0D13] border border-white/10 rounded-lg px-3 py-1.5 text-[10px] text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-widest transition-all" />
             <button type="submit" class="text-[9px] font-rpg font-bold uppercase tracking-widest text-violet-400 hover:text-violet-300 transition-all">Resetear</button>
           </form>`;

      return `
    <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
      <td class="py-6 px-8">
        <div class="flex items-center gap-3">
          <span class="text-white font-bold font-rpg tracking-widest text-sm uppercase">${esc(u.username)}</span>
          ${pendingBadge}
          ${isSelf ? `<span class="text-[9px] text-stone-600 font-rpg uppercase tracking-widest font-bold">(Tú)</span>` : ""}
        </div>
      </td>
      <td class="py-6 px-6">
        ${isSelf ? `
          <span class="inline-flex items-center gap-2 text-[8px] font-bold px-3 py-1 rounded-full border font-rpg uppercase tracking-[0.2em] ${roleColors[u.role] || "text-stone-400 border-white/10"}">
            ${esc(u.role)}
          </span>` : `
          <form method="POST" action="/admin/usuarios/${u.id}/rol" class="flex items-center gap-2">
            <select name="role" onchange="this.form.submit()"
              class="bg-[#0B0D13] border border-white/10 rounded-lg px-3 py-1.5 text-[9px] text-violet-400 font-bold focus:border-violet-500 focus:outline-none font-rpg uppercase cursor-pointer transition-all">
              ${VALID_ROLES.map(r => `<option value="${r}" ${u.role === r ? "selected" : ""}>${r}</option>`).join("")}
            </select>
          </form>
        `}
      </td>
      <td class="py-6 px-6 text-stone-700 font-mono text-[10px] font-bold tracking-tighter">${u.created_at.slice(0, 10)}</td>
      <td class="py-6 px-6">${resetCell}</td>
      <td class="py-6 px-8 text-right">
        ${!isSelf
          ? `<form method="POST" action="/admin/usuarios/${u.id}/borrar" class="inline"
               onsubmit="return confirm('¿Eliminar a ${esc(u.username)} del consejo?')">
               <button type="submit" class="text-[9px] font-rpg font-bold uppercase tracking-[0.3em] text-red-500/70 hover:text-red-400 transition-all">Expulsar</button>
             </form>`
          : ""}
      </td>
    </tr>`;
    })
    .join("");

  const content = `
    ${ok ? `<div class="bg-violet-600/10 border border-violet-500/30 text-violet-400 text-[10px] rounded-xl px-6 py-4 mb-8 font-rpg uppercase tracking-[0.2em] font-bold shadow-lg animate-fade-in">✓ Los registros han sido actualizados</div>` : ""}
    ${error ? `<div class="bg-red-600/10 border border-red-500/30 text-red-400 text-[10px] rounded-xl px-6 py-4 mb-8 font-rpg uppercase tracking-[0.2em] font-bold shadow-lg animate-fade-in">⚠️ ${esc(decodeURIComponent(error))}</div>` : ""}

    <div class="glass-panel p-10 mb-12 relative overflow-hidden">
      <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none rotate-12">🔑</div>
      <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-[11px] text-white mb-8 pb-4 border-b border-white/5 flex items-center gap-4">
        <span class="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,1)]"></span>
        Reclutar al Consejo
      </h2>
      <form method="POST" action="/admin/usuarios/crear" class="grid grid-cols-1 md:grid-cols-4 gap-6">
        <input name="username" type="text" placeholder="Usuario" required
          class="bg-[#0B0D13] border border-white/10 rounded-xl px-5 py-3.5 text-white text-sm focus:border-violet-500 focus:outline-none font-rpg tracking-widest uppercase transition-all" />
        <input name="password" type="password" placeholder="Clave temporal" required minlength="8"
          class="bg-[#0B0D13] border border-white/10 rounded-xl px-5 py-3.5 text-white text-sm focus:border-violet-500 focus:outline-none font-rpg tracking-widest uppercase transition-all" />
        <select name="role"
          class="bg-[#0B0D13] border border-white/10 rounded-xl px-5 py-3.5 text-white text-sm focus:border-violet-500 focus:outline-none font-rpg tracking-widest uppercase cursor-pointer transition-all">
          <option value="escudero">Escudero</option>
          <option value="diputado">Diputado</option>
          <option value="superadmin">Superadmin</option>
        </select>
        <button type="submit" class="btn-primary text-[11px] font-bold font-rpg uppercase tracking-widest px-8 py-3.5 rounded-xl shadow-xl active:scale-95">
          Crear
        </button>
      </form>
      <p class="text-[9px] text-stone-600 mt-6 font-rpg uppercase tracking-[0.2em] italic font-bold">El nuevo recluta deberá cambiar su secreto al entrar por primera vez a la fortaleza.</p>
    </div>

    <div class="glass-panel overflow-hidden">
      <div class="px-10 py-8 border-b border-white/5 bg-black/20 flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="w-1.5 h-6 bg-violet-600 rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
          <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-sm text-white">Consejo del Panel</h2>
        </div>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-[0.2em] font-bold bg-black/40 px-3 py-1 rounded-full">${list.length} Usuarios</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-[9px] text-stone-600 uppercase font-rpg tracking-[0.4em] bg-white/5 border-b border-white/5">
              <th class="py-6 px-8 text-left">Usuario</th>
              <th class="py-6 px-6 text-left">Rol</th>
              <th class="py-6 px-6 text-left">Creado</th>
              <th class="py-6 px-6 text-left">Restablecer</th>
              <th class="py-6 px-8"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  return c.html(adminLayout("Usuarios", content, user, c.req.path));
});

usuarios.post("/crear", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin") return c.redirect("/admin");
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const roleInput = String(body.role ?? "");
  const role = (VALID_ROLES as readonly string[]).includes(roleInput) ? roleInput : "escudero";
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
  if (user.role !== "superadmin") return c.redirect("/admin");
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
  if (user.role !== "superadmin") return c.redirect("/admin");
  const id = c.req.param("id");
  if (id === user.sub) return c.redirect("/admin/usuarios?error=Auto-expulsi%C3%B3n+no+permitida");
  await getTursoClient().execute({ sql: `DELETE FROM admin_users WHERE id = ?`, args: [id] });
  return c.redirect("/admin/usuarios?ok=1");
});

usuarios.post("/:id/rol", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin") return c.redirect("/admin");
  const id = c.req.param("id");
  if (id === user.sub) return c.redirect("/admin/usuarios?error=No+puedes+cambiar+tu+propio+rango");
  
  const body = await c.req.parseBody();
  const newRole = String(body.role ?? "");
  if (!(VALID_ROLES as readonly string[]).includes(newRole)) return c.redirect("/admin/usuarios?error=Rango+inv%C3%A1lido");

  await getTursoClient().execute({
    sql: `UPDATE admin_users SET role = ? WHERE id = ?`,
    args: [newRole, id],
  });

  return c.redirect("/admin/usuarios?ok=1");
});

export default usuarios;
