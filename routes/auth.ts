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
    <div class="max-w-md mx-auto mt-20 px-4">
      <div class="glass-panel p-10 relative overflow-hidden">
        <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none rotate-12">🛡️</div>
        
        <div class="text-center mb-10">
          <h2 class="text-3xl font-bold font-rpg uppercase tracking-[0.3em] text-white mb-2 neon-text-violet">Fortaleza</h2>
          <p class="text-stone-500 font-rpg uppercase tracking-widest text-[9px] font-bold">Acceso al Consejo del Clan</p>
        </div>

        ${error ? `<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-xl px-4 py-3 mb-8 font-rpg uppercase tracking-widest text-center italic font-bold">⚠️ ${esc(error)}</div>` : ""}
        
        <form method="POST" action="/auth/login" class="flex flex-col gap-6">
          <div>
            <label class="block text-[9px] font-bold font-rpg uppercase tracking-widest text-stone-500 mb-2 ml-1">Identidad de Guerrero</label>
            <input name="username" type="text" required autofocus placeholder="Nombre..."
              class="w-full bg-[#0B0D13] border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-[0.2em] transition-all" />
          </div>
          <div>
            <label class="block text-[9px] font-bold font-rpg uppercase tracking-widest text-stone-500 mb-2 ml-1">Secreto</label>
            <input name="password" type="password" required placeholder="••••••••"
              class="w-full bg-[#0B0D13] border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-[0.2em] transition-all" />
          </div>
          
          <button type="submit" class="btn-primary w-full py-5 rounded-2xl font-bold font-rpg uppercase tracking-[0.2em] mt-4">
            Entrar al Castillo
          </button>
        </form>

        <div class="mt-10 pt-6 border-t border-white/5 text-center">
          <a href="/" class="text-stone-600 hover:text-violet-400 transition-all text-[9px] font-rpg uppercase tracking-widest font-bold">← Volver a las Tierras del Clan</a>
        </div>
      </div>
    </div>
  `;
  return c.html(publicLayout("Identificación", content));
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
    <div class="max-w-md mx-auto mt-20 px-4">
      <div class="glass-panel p-10 relative overflow-hidden">
        <div class="absolute -right-10 -top-10 text-9xl opacity-[0.03] pointer-events-none rotate-12">🔐</div>
        
        <div class="text-center mb-10">
          <h2 class="text-3xl font-bold font-rpg uppercase tracking-[0.2em] text-white mb-2 neon-text-violet">Nuevo Secreto</h2>
          ${forced
            ? `<p class="text-violet-400 font-rpg uppercase tracking-widest text-[9px] italic font-bold">Como nuevo recluta, debes establecer tu propio secreto</p>`
            : `<p class="text-stone-500 font-rpg uppercase tracking-widest text-[10px] font-bold">Hola, ${esc(payload.username)}</p>`
          }
        </div>

        ${error ? `<div class="bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-xl px-4 py-3 mb-8 font-rpg uppercase tracking-widest text-center italic font-bold">⚠️ ${esc(decodeURIComponent(error))}</div>` : ""}
        
        <form method="POST" action="/auth/change-password" class="flex flex-col gap-6">
          <div>
            <label class="block text-[9px] font-bold font-rpg uppercase tracking-widest text-stone-500 mb-2 ml-1">Nuevo Secreto</label>
            <input name="password" type="password" required minlength="8" autofocus placeholder="Mínimo 8 caracteres"
              class="w-full bg-[#0B0D13] border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-[0.2em] transition-all" />
          </div>
          <div>
            <label class="block text-[9px] font-bold font-rpg uppercase tracking-widest text-stone-500 mb-2 ml-1">Confirmar Secreto</label>
            <input name="confirm" type="password" required minlength="8" placeholder="Repite tu secreto"
              class="w-full bg-[#0B0D13] border border-white/5 rounded-2xl px-5 py-4 text-white focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-[0.2em] transition-all" />
          </div>
          
          <button type="submit" class="btn-primary w-full py-5 rounded-2xl font-bold font-rpg uppercase tracking-[0.2em] mt-4">
            Consagrar Secreto
          </button>
        </form>
      </div>
    </div>
  `;
  return c.html(publicLayout("Cambiar secreto", content));
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
