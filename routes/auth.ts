import { Hono } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import { getTursoClient } from "../lib/turso.ts";
import { comparePassword, hashPassword } from "../lib/hash.ts";
import { signToken, verifyToken } from "../lib/auth.ts";
import { publicLayout, esc } from "../views/layout.ts";

const auth = new Hono();

auth.get("/login", (c) => {
  const error = c.req.query("error");
  const content = `
    <div class="max-w-sm mx-auto mt-16">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h2 class="text-2xl font-bold text-center mb-2">⚔️ Acceso Admin</h2>
        <p class="text-gray-500 text-center text-sm mb-6">Clan Nightcore</p>
        ${error ? `<div class="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">${esc(error)}</div>` : ""}
        <form method="POST" action="/auth/login" class="flex flex-col gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Usuario</label>
            <input name="username" type="text" required autofocus
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Contraseña</label>
            <input name="password" type="password" required
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none" />
          </div>
          <button type="submit"
            class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition">
            Entrar
          </button>
        </form>
      </div>
    </div>
  `;
  return c.html(publicLayout("Login", content));
});

auth.post("/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || !password) {
    return c.redirect("/auth/login?error=Completa+todos+los+campos");
  }

  const db = getTursoClient();
  const result = await db.execute({
    sql: `SELECT id, username, password_hash, role, must_change_password FROM admin_users WHERE username = ?`,
    args: [username],
  });

  if (result.rows.length === 0) {
    return c.redirect("/auth/login?error=Credenciales+incorrectas");
  }

  type UserRow = { id: string; username: string; password_hash: string; role: string; must_change_password: number };
  const row = result.rows[0] as unknown as UserRow;
  const valid = await comparePassword(password, row.password_hash);

  if (!valid) {
    return c.redirect("/auth/login?error=Credenciales+incorrectas");
  }

  const token = await signToken({
    sub: row.id,
    username: row.username,
    role: row.role,
    mcp: row.must_change_password === 1 ? true : undefined,
  });

  const secure = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
  const cookie = `session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24}${secure ? "; Secure" : ""}`;
  const destination = row.must_change_password === 1 ? "/auth/change-password" : "/admin";

  return new Response(null, {
    status: 302,
    headers: { Location: destination, "Set-Cookie": cookie },
  });
});

auth.get("/change-password", async (c) => {
  const token = getCookie(c, "session");
  if (!token) return c.redirect("/auth/login");
  const payload = await verifyToken(token);
  if (!payload) return c.redirect("/auth/login");

  const error = c.req.query("error");
  const forced = payload.mcp === true;

  const content = `
    <div class="max-w-sm mx-auto mt-16">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h2 class="text-2xl font-bold text-center mb-2">🔒 Cambiar contraseña</h2>
        ${forced
          ? `<p class="text-yellow-400 text-center text-sm mb-6">Debes establecer una nueva contraseña antes de continuar</p>`
          : `<p class="text-gray-500 text-center text-sm mb-6">Hola, ${esc(payload.username)}</p>`
        }
        ${error ? `<div class="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">${esc(decodeURIComponent(error))}</div>` : ""}
        <form method="POST" action="/auth/change-password" class="flex flex-col gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Nueva contraseña</label>
            <input name="password" type="password" required minlength="8" autofocus
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Confirmar contraseña</label>
            <input name="confirm" type="password" required minlength="8"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none" />
          </div>
          <button type="submit"
            class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition">
            Guardar contraseña
          </button>
        </form>
      </div>
    </div>
  `;
  return c.html(publicLayout("Cambiar contraseña", content));
});

auth.post("/change-password", async (c) => {
  const token = getCookie(c, "session");
  if (!token) return c.redirect("/auth/login");
  const payload = await verifyToken(token);
  if (!payload) return c.redirect("/auth/login");

  const body = await c.req.parseBody();
  const newPassword = String(body.password ?? "");
  const confirm    = String(body.confirm ?? "");

  if (newPassword.length < 8) {
    return c.redirect("/auth/change-password?error=M%C3%ADnimo+8+caracteres");
  }
  if (newPassword !== confirm) {
    return c.redirect("/auth/change-password?error=Las+contrase%C3%B1as+no+coinciden");
  }

  const db = getTursoClient();
  const hash = await hashPassword(newPassword);
  await db.execute({
    sql: `UPDATE admin_users SET password_hash = ?, must_change_password = 0 WHERE id = ?`,
    args: [hash, payload.sub],
  });

  // Re-emitir JWT sin el flag mcp
  const newToken = await signToken({ sub: payload.sub, username: payload.username, role: payload.role });
  const secure = Deno.env.get("DENO_DEPLOYMENT_ID") !== undefined;
  const cookie = `session=${newToken}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24}${secure ? "; Secure" : ""}`;

  return new Response(null, {
    status: 302,
    headers: { Location: "/admin", "Set-Cookie": cookie },
  });
});

auth.get("/logout", (c) => {
  deleteCookie(c, "session", { path: "/" });
  return c.redirect("/");
});

export default auth;
