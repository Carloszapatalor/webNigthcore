import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout } from "../views/layout.ts";

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
  const weekStart = getWeekStart();
  const today = getTodayUTC();

  const [rankingResult, eventResult, membersResult, guidesResult] = await Promise.allSettled([
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
    db.execute(`SELECT COUNT(*) as cnt FROM clan_members`),
    db.execute(`SELECT slug, title, author, created_at, content FROM guides WHERE published = 1 ORDER BY created_at DESC LIMIT 6`)
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
    membersResult.status === "fulfilled"
      ? (membersResult.value.rows[0] as unknown as { cnt: number }).cnt
      : "—";

  type GuideRow = { slug: string; title: string; author: string; created_at: string; content: string };
  const guides = 
    guidesResult.status === "fulfilled"
      ? (guidesResult.value.rows as unknown as GuideRow[])
      : [];

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

  const badgeColorMap: Record<string, string> = {
    gray:   "border-gray-600 text-gray-400",
    red:    "border-red-600 text-red-400",
    green:  "border-green-600 text-green-400",
    yellow: "border-yellow-600 text-yellow-400",
    gold:   "border-yellow-600 text-yellow-400",
    blue:   "border-blue-600 text-blue-400",
    purple: "border-purple-600 text-purple-400",
    orange: "border-orange-600 text-orange-400",
    cyan:   "border-cyan-600 text-cyan-400",
  };

  const esc = (str: any) => str == null ? "" : String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const guideCards = guides.length === 0 
    ? `<p class="text-gray-500 text-sm">Aún no hay guías publicadas.</p>`
    : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">` + guides.map(g => {
        let emoji = "📖";
        let category = "";
        let imgSrc = "";
        let badges: {label: string; color: string}[] = [];
        try {
          const d = JSON.parse(g.content);
          if (d.bossEmoji) emoji = d.bossEmoji;
          if (d.category) category = d.category;
          imgSrc = d.imageBase64 || d.imageUrl || "";
          if (d.badges) badges = d.badges;
        } catch {}

        const thumb = imgSrc
          ? `<img src="${esc(imgSrc)}" alt="${esc(g.title)}" class="w-16 h-16 rounded-xl object-cover object-center border border-gray-700 flex-shrink-0 shadow-lg" />`
          : `<div class="w-16 h-16 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-3xl flex-shrink-0 shadow-lg">${esc(emoji)}</div>`;

        const keyBadge = badges[3];
        const renderedBadges = keyBadge && keyBadge.label.trim() ? `
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${badgeColorMap[keyBadge.color] || badgeColorMap.gray} bg-gray-900/50">
            ${esc(keyBadge.label)}
          </span>` : "";

        return `
          <a href="/guias/${esc(g.slug)}" class="flex gap-4 bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-purple-700 transition group hover:-translate-y-1 hover:shadow-xl hover:shadow-purple-900/20 duration-300">
            ${thumb}
            <div class="flex-1 min-w-0 flex flex-col justify-center">
              ${category ? `<p class="text-[10px] text-purple-400 uppercase tracking-widest mb-1 truncate">${esc(category)}</p>` : ""}
              <h3 class="font-semibold text-white text-sm mb-1 truncate group-hover:text-purple-300 transition">${esc(g.title)}</h3>
              ${renderedBadges ? `<div class="flex flex-wrap gap-1 mb-1">${renderedBadges}</div>` : ""}
              <p class="text-gray-500 text-[11px] truncate">Por ${esc(g.author)}</p>
            </div>
          </a>`;
      }).join("") + `</div>`;

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

    <div class="mb-12">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-xl font-bold text-white">📖 Guías del clan</h2>
        <a href="/guias" class="text-purple-400 hover:text-purple-300 text-sm transition font-medium">Ver todas →</a>
      </div>
      <p class="text-gray-400 text-sm mb-4">Consulta las guías más recientes para nuevos y veteranos.</p>
      ${guideCards}
    </div>
  `;

  const user = c.get("user");
  return c.html(publicLayout("Inicio", content, user));
});

export default home;
