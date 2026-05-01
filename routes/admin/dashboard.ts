import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout } from "../../views/layout.ts";

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

const dashboard = new Hono();

dashboard.get("/", async (c) => {
  const user = c.get("user");
  const db = getTursoClient();
  const today = getTodayUTC();

  const [expResult, eventResult, wlResult, guidesResult] = await Promise.allSettled([
    db.execute({
      sql: `SELECT COALESCE(SUM(total_exp), 0) as today_exp FROM rpg_daily_exp WHERE date = ?`,
      args: [today],
    }),
    db.execute({
      sql: `SELECT label FROM daily_events WHERE event_date = ?`,
      args: [today],
    }),
    db.execute(`SELECT COUNT(*) as cnt FROM inactivity_whitelist`),
    db.execute(
      `SELECT title, slug, author, created_at, published FROM guides ORDER BY created_at DESC LIMIT 5`
    ),
  ]);

  const todayExp =
    expResult.status === "fulfilled"
      ? ((expResult.value.rows[0] as unknown as { today_exp: number })?.today_exp ?? 0)
      : 0;

  const eventLabel =
    eventResult.status === "fulfilled" && eventResult.value.rows.length > 0
      ? (eventResult.value.rows[0] as unknown as { label: string }).label
      : "Sin sortear hoy";

  const wlCount =
    wlResult.status === "fulfilled"
      ? (wlResult.value.rows[0] as unknown as { cnt: number }).cnt
      : "—";

  type GuideRow = { title: string; slug: string; author: string; created_at: string; published: number };
  const guides =
    guidesResult.status === "fulfilled"
      ? (guidesResult.value.rows as unknown as GuideRow[])
      : [];

  const guideRows =
    guides.length === 0
      ? `<tr><td colspan="4" class="py-6 text-center text-gray-600 text-sm">No hay guías aún</td></tr>`
      : guides
          .map(
            (g) => `
      <tr class="border-b border-gray-800 hover:bg-gray-800/40 text-sm">
        <td class="py-2.5 px-4">${g.title}</td>
        <td class="py-2.5 px-4 text-gray-400">${g.author}</td>
        <td class="py-2.5 px-4">
          <span class="inline-block text-xs px-2 py-0.5 rounded-full ${g.published ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-500"}">
            ${g.published ? "Publicada" : "Borrador"}
          </span>
        </td>
        <td class="py-2.5 px-4 text-gray-500">${g.created_at.slice(0, 10)}</td>
      </tr>`
          )
          .join("");

  const content = `
    <div class="grid grid-cols-3 gap-4 mb-8">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-gray-500 text-sm mb-1">EXP ganada hoy</p>
        <p class="text-3xl font-bold text-cyan-400">${Number(todayExp).toLocaleString()}</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-gray-500 text-sm mb-1">Evento activo</p>
        <p class="text-sm font-medium text-purple-400 leading-snug mt-1">${eventLabel.split("—")[0].trim()}</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-gray-500 text-sm mb-1">En whitelist</p>
        <p class="text-3xl font-bold text-white">${wlCount}</p>
      </div>
    </div>

    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 class="font-semibold">Últimas guías</h2>
        <a href="/admin/guias/nueva"
          class="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition">
          + Nueva guía
        </a>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th class="py-3 px-4 text-left">Título</th>
            <th class="py-3 px-4 text-left">Autor</th>
            <th class="py-3 px-4 text-left">Estado</th>
            <th class="py-3 px-4 text-left">Fecha</th>
          </tr>
        </thead>
        <tbody>${guideRows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Dashboard", content, user, c.req.path));
});

export default dashboard;
