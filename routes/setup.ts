import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { hashPassword } from "../lib/hash.ts";
import { publicLayout } from "../views/layout.ts";

const setup = new Hono();

async function superadminExists(): Promise<boolean> {
  const db = getTursoClient();
  const result = await db.execute(`SELECT COUNT(*) as cnt FROM admin_users WHERE role = 'superadmin'`);
  return (result.rows[0] as unknown as { cnt: number }).cnt > 0;
}

setup.get("/", async (c) => {
  if (await superadminExists()) return c.notFound();

  const content = `
    <div class="max-w-sm mx-auto mt-16">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h2 class="text-2xl font-bold text-center mb-2">Configuración inicial</h2>
        <p class="text-gray-500 text-center text-sm mb-6">Crea el primer superadmin del panel</p>
        <form method="POST" action="/setup" class="flex flex-col gap-4">
          <div>
            <label class="block text-sm text-gray-400 mb-1">Usuario</label>
            <input name="username" type="text" required autofocus
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none" />
          </div>
          <div>
            <label class="block text-sm text-gray-400 mb-1">Contraseña</label>
            <input name="password" type="password" required minlength="8"
              class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none" />
          </div>
          <button type="submit"
            class="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-lg transition">
            Crear superadmin
          </button>
        </form>
      </div>
    </div>
  `;
  return c.html(publicLayout("Setup", content));
});

setup.post("/", async (c) => {
  if (await superadminExists()) return c.notFound();

  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (!username || password.length < 8) return c.redirect("/setup");

  const db = getTursoClient();
  const id   = crypto.randomUUID();
  const hash = await hashPassword(password);
  const now  = new Date().toISOString();

  await db.execute({
    sql: `INSERT INTO admin_users (id, username, password_hash, role, must_change_password, created_at) VALUES (?, ?, ?, 'superadmin', 0, ?)`,
    args: [id, username, hash, now],
  });

  return c.redirect("/auth/login");
});

export default setup;
