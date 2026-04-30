import { Hono } from "hono";
import { initDb } from "./lib/turso.ts";
import { requireAuth } from "./middleware/requireAuth.ts";
import homeRoute from "./routes/home.ts";
import guiasRoute from "./routes/guias.ts";
import authRoute from "./routes/auth.ts";
import setupRoute from "./routes/setup.ts";
import dashboardRoute from "./routes/admin/dashboard.ts";
import miembrosRoute from "./routes/admin/miembros.ts";
import whitelistRoute from "./routes/admin/whitelist.ts";
import eventosRoute from "./routes/admin/eventos.ts";
import adminGuiasRoute from "./routes/admin/guias.ts";
import usuariosRoute from "./routes/admin/usuarios.ts";
import altersRoute from "./routes/admin/alters.ts";

const app = new Hono();

await initDb();

// Rutas públicas
app.route("/", homeRoute);
app.route("/guias", guiasRoute);
app.route("/auth", authRoute);
app.route("/setup", setupRoute);

// Rutas admin (protegidas con JWT)
const admin = new Hono();
admin.use("*", requireAuth);
admin.route("/", dashboardRoute);
admin.route("/miembros", miembrosRoute);
admin.route("/whitelist", whitelistRoute);
admin.route("/eventos", eventosRoute);
admin.route("/guias", adminGuiasRoute);
admin.route("/usuarios", usuariosRoute);
admin.route("/alters", altersRoute);

app.route("/admin", admin);

app.notFound((c) =>
  c.html(
    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>404</title>
    <script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-950 text-gray-100 flex items-center justify-center min-h-screen">
      <div class="text-center">
        <p class="text-6xl mb-4">⚔️</p>
        <h1 class="text-2xl font-bold mb-2">Página no encontrada</h1>
        <a href="/" class="text-purple-400 hover:text-purple-300 transition">← Volver al inicio</a>
      </div>
    </body></html>`,
    404
  )
);

await initDb().catch((e) => console.warn("DB init:", e.message));

Deno.serve(app.fetch);
