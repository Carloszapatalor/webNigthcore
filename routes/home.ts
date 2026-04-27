import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout } from "../views/layout.ts";

const IDLE_BASE = "https://query.idleclans.com";

function getWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

const home = new Hono();

home.get("/", async (c) => {
  const db = getTursoClient();
  const clanName = Deno.env.get("CLAN_NAME") ?? "";
  const weekStart = getWeekStart();
  const today = getTodayUTC();

  const [rankingResult, eventResult, membersResult] = await Promise.allSettled([
    db.execute({
      sql: `SELECT d.username, SUM(d.total_exp) as week_exp,
                   COALESCE(p.title, '🌱 Buscador') as title,
                   COALESCE(p.level, 1) as level
            FROM rpg_daily_exp d
            LEFT JOIN rpg_players p ON p.username = d.username
            WHERE d.date >= ?
            GROUP BY d.username
            ORDER BY week_exp DESC
            LIMIT 5`,
      args: [weekStart],
    }),
    db.execute({
      sql: `SELECT label FROM daily_events WHERE event_date = ?`,
      args: [today],
    }),
    clanName
      ? fetch(`${IDLE_BASE}/api/Clan/recruitment/${encodeURIComponent(clanName)}`).then((r) =>
          r.json()
        )
      : Promise.resolve(null),
  ]);

  type RpgRow = { username: string; week_exp: number; title: string; level: number };
  const ranking =
    rankingResult.status === "fulfilled"
      ? (rankingResult.value.rows as unknown as RpgRow[])
      : [];

  const eventLabel =
    eventResult.status === "fulfilled" && eventResult.value.rows.length > 0
      ? (eventResult.value.rows[0] as unknown as { label: string }).label
      : null;

  const memberCount =
    membersResult.status === "fulfilled" && Array.isArray(membersResult.value?.memberlist)
      ? membersResult.value.memberlist.length
      : "—";

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  const rankingRows =
    ranking.length === 0
      ? `<tr><td colspan="4" class="py-8 text-center text-gray-600 text-sm">Sin datos esta semana</td></tr>`
      : ranking
          .map(
            (r, i) => `
      <tr class="border-b border-gray-800 hover:bg-gray-800/40 transition">
        <td class="py-3 px-4 text-lg">${medals[i]}</td>
        <td class="py-3 px-4 font-medium">${r.username}</td>
        <td class="py-3 px-4 text-purple-400 text-sm">${r.title}</td>
        <td class="py-3 px-4 text-right text-cyan-400 font-mono text-sm">${Number(r.week_exp).toLocaleString()}</td>
      </tr>`
          )
          .join("");

  const eventCard = eventLabel
    ? eventLabel.split("—")[0].trim()
    : `<span class="text-gray-600">Sin sortear</span>`;

  const content = `
    <div class="mb-8">
      <h1 class="text-4xl font-bold text-white">⚔️ Clan Nightcore</h1>
      <p class="text-gray-400 mt-2">Idle Clans — Panel de la comunidad</p>
    </div>

    <div class="grid grid-cols-3 gap-4 mb-8">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-gray-500 text-sm mb-1">Miembros activos</p>
        <p class="text-3xl font-bold text-white">${memberCount}</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <p class="text-gray-500 text-sm mb-1">Evento de hoy</p>
        <p class="text-sm font-medium text-cyan-400 leading-snug">${eventCard}</p>
      </div>
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 relative overflow-hidden">
        <div class="absolute top-2 right-3 text-2xl opacity-20">👑</div>
        <p class="text-gray-500 text-sm mb-1">Héroe de la semana</p>
        ${ranking[0]
          ? `<p class="text-lg font-bold text-yellow-400">${ranking[0].username}</p>
             <p class="text-xs text-purple-400 mt-0.5">${ranking[0].title}</p>
             <p class="text-xs text-gray-500 mt-1">${Number(ranking[0].week_exp).toLocaleString()} EXP</p>`
          : `<p class="text-gray-600 text-sm mt-1">Sin datos aún</p>`
        }
      </div>
    </div>

    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 class="text-lg font-semibold">🏆 Ranking RPG Semanal</h2>
        <span class="text-xs text-gray-500">Top 5 — semana actual</span>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th class="py-3 px-4 text-left">#</th>
            <th class="py-3 px-4 text-left">Jugador</th>
            <th class="py-3 px-4 text-left">Título</th>
            <th class="py-3 px-4 text-right">EXP Semanal</th>
          </tr>
        </thead>
        <tbody>${rankingRows}</tbody>
      </table>
    </div>

    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-semibold">📖 Guías del clan</h2>
      <a href="/guias" class="text-purple-400 hover:text-purple-300 text-sm transition">Ver todas →</a>
    </div>
    <p class="text-gray-500 text-sm">Consulta nuestras guías para nuevos y veteranos del clan.</p>
  `;

  return c.html(publicLayout("Inicio", content));
});

export default home;
