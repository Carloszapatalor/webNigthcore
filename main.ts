import { Hono } from "hono";
import { initDb, getTursoClient } from "./lib/turso.ts";
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
import reportesRoute from "./routes/admin/reportes.ts";
import ausenciasRoute from "./routes/ausencias.ts";
import adminAusenciasRoute from "./routes/admin/ausencias.ts";

import { optionalAuth } from "./middleware/optionalAuth.ts";
import { syncClanMembers } from "./lib/members.ts";
import { warmHomeCache } from "./routes/home.ts";
import { cacheSet, cacheGetStale } from "./lib/cache.ts";
import jugadoresRoute from "./routes/jugadores.ts";

const app = new Hono();

await initDb();

// === PRE-CALENTAMIENTO: Cachear CSS en memoria ===
let cachedCss = await Deno.readTextFile("./static/css/tailwind.css");
console.log("✓ CSS (52KB) cacheado en memoria");

// === PRE-CALENTAMIENTO BD: Ejecutar queries principales al inicio ===
const warmUpDb = async () => {
  const db = getTursoClient();
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = new Date();
  const day = weekStart.getUTCDay();
  weekStart.setUTCDate(weekStart.getUTCDate() - (day === 0 ? 6 : day - 1));
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  try {
    const [expResult, eventResult, membersCount, guidesResult] = await Promise.all([
      db.execute({ sql: `SELECT COALESCE(SUM(total_exp), 0) as today_exp FROM rpg_daily_exp WHERE date = ?`, args: [today] }),
      db.execute({ sql: `SELECT label FROM daily_events WHERE event_date = ?`, args: [today] }),
      db.execute(`SELECT COUNT(*) as cnt FROM clan_members`),
      db.execute(`SELECT slug, title, author, created_at, content FROM guides WHERE published = 1 ORDER BY created_at DESC LIMIT 6`)
    ]);
    cacheSet("warm:exp", (expResult.rows[0] as any)?.today_exp ?? 0, 60 * 1000);
    cacheSet("warm:event", eventResult.rows.length > 0 ? (eventResult.rows[0] as any).label : null, 60 * 1000);
    cacheSet("warm:members", (membersCount.rows[0] as any)?.cnt ?? 0, 60 * 1000);
    cacheSet("warm:guides", guidesResult.rows, 60 * 1000);
    console.log("✓ BD pre-calentada (cache en memoria)");
  } catch (e) {
    console.error("Error pre-calentando BD:", e);
  }
};
warmUpDb();

// Warm-up en background (NO bloqueante para el servidor)
syncClanMembers().catch(e => console.error("Initial sync error:", e));
warmHomeCache().catch(e => console.error("Initial cache warm error:", e));

// Sincronización automática de miembros cada 30 minutos
setInterval(() => {
  console.log("Iniciando sincronización automática (30m)...");
  syncClanMembers();
}, 30 * 60 * 1000);

// Middleware global para estado de sesión
app.use("*", optionalAuth);

// Archivos estáticos (CSS cacheado en memoria - NO lee disco)
app.get("/css/tailwind.css", (c) => {
  return new Response(cachedCss, {
    headers: { "Content-Type": "text/css", "Cache-Control": "public, max-age=86400" },
  });
});

// Route legacy for backwards compatibility
app.get("/styles.css", (c) => {
  return new Response(cachedCss, {
    headers: { "Content-Type": "text/css", "Cache-Control": "public, max-age=86400" },
  });
});

app.route("/", homeRoute);
app.route("/guias", guiasRoute);
app.route("/jugadores", jugadoresRoute);
app.route("/ausencias", ausenciasRoute);
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
admin.route("/reportes", reportesRoute);
admin.route("/ausencias", adminAusenciasRoute);

app.route("/admin", admin);

app.notFound((c) =>
  c.html(
    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>404</title>
    <link rel="stylesheet" href="/css/tailwind.css">
    <style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#030712;color:#f3f4f6}</style></head>
    <body>
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
    <link rel="stylesheet" href="/css/tailwind.css">
    <style>body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#030712;color:#f3f4f6}</style></head>
    <body>
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
