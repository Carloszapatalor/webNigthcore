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

import { optionalAuth } from "./middleware/optionalAuth.ts";
import { syncClanMembers } from "./lib/members.ts";

const app = new Hono();

await initDb();

// Sincronización automática de miembros cada 4 horas
setInterval(() => {
  console.log("Iniciando sincronización automática...");
  syncClanMembers();
}, 4 * 60 * 60 * 1000);

// Ejecutar una vez al inicio
syncClanMembers();

// Rutas públicas
app.use("/", optionalAuth);
app.use("/guias", optionalAuth);
app.use("/guias/*", optionalAuth);

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

// Manejador de errores global
app.onError((err, c) => {
  console.error("Error:", err);
  return c.html(
    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>500</title>
    <script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-gray-950 text-gray-100 flex items-center justify-center min-h-screen">
      <div class="text-center">
        <p class="text-6xl mb-4">⚔️</p>
        <h1 class="text-2xl font-bold mb-2">Error interno del servidor</h1>
        <p class="text-gray-500">Ha ocurrido un error inesperado. Inténtalo de nuevo más tarde.</p>
        <a href="/" class="text-purple-400 hover:text-purple-300 transition mt-4 inline-block">← Volver al inicio</a>
      </div>
    </body></html>`,
    500
  );
});

Deno.serve(app.fetch);
