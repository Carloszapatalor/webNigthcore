import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout, esc } from "../views/layout.ts";

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

  const [rankingResult, eventResult, membersResult, onlineResult, guidesResult] = await Promise.allSettled([
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
    db.execute(`SELECT member_name FROM clan_members WHERE hours_offline = 0 ORDER BY member_name ASC`),
    db.execute(`SELECT slug, title, author, created_at, content FROM guides WHERE published = 1 ORDER BY created_at DESC LIMIT 6`)
  ]);

  // Fetch real-time clan strengths
  let clanStats: Record<string, number> = {};
  try {
    const clanName = Deno.env.get("CLAN_NAME") || "Nightcore";
    const clanRes = await fetch(`https://query.idleclans.com/api/Clan/recruitment/${encodeURIComponent(clanName)}`);
    const clanData = await clanRes.json();
    if (clanData.serializedSkills) {
      clanStats = JSON.parse(clanData.serializedSkills);
    }
  } catch (e) {
    console.error("Error fetching clan stats:", (e as Error).message);
  }

  type RpgRow = { username: string; week_exp: number; title: string; level: number };
  const ranking = rankingResult.status === "fulfilled" ? (rankingResult.value.rows as unknown as RpgRow[]) : [];
  
  const eventLabel = eventResult.status === "fulfilled" && eventResult.value.rows.length > 0 ? (eventResult.value.rows[0] as unknown as { label: string }).label : null;
  const memberCount = membersResult.status === "fulfilled" ? (membersResult.value.rows[0] as unknown as { cnt: number }).cnt : "—";
  const onlineList = onlineResult.status === "fulfilled" ? (onlineResult.value.rows as unknown as { member_name: string }[]) : [];
  
  type GuideRow = { slug: string; title: string; author: string; created_at: string; content: string };
  const guides = guidesResult.status === "fulfilled" ? (guidesResult.value.rows as unknown as GuideRow[]) : [];

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  const rankingRows =
    ranking.length === 0
      ? `<tr><td colspan="4" class="py-8 text-center text-stone-600 text-sm italic">Sin datos esta semana</td></tr>`
      : ranking
          .map(
            (r, i) => `
      <tr class="border-b border-stone-800/50 hover:bg-stone-800/40 transition">
        <td class="py-3 px-4">${medals[i] || i + 1}</td>
        <td class="py-3 px-4 font-medium text-stone-200">${esc(r.username)} <span class="text-[10px] text-stone-600 font-normal ml-1">Niv. ${r.level}</span></td>
        <td class="py-3 px-4 text-purple-400 font-rpg text-xs uppercase tracking-widest">${esc(r.title)}</td>
        <td class="py-3 px-4 text-right text-cyan-400 font-mono text-xs">${Number(r.week_exp).toLocaleString()}</td>
      </tr>`
          )
          .join("");

  const eventCard = eventLabel
    ? eventLabel.split("—")[0].trim()
    : `<span class="text-stone-600">Sin sortear</span>`;

  // Process Clan Strengths (Top 5 skills)
  const topSkills = Object.entries(clanStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([skill, exp]) => {
      const iconMap: Record<string, string> = {
        Strength: "⚔️", Defence: "🛡️", Archery: "🏹", Magic: "✨", Health: "❤️",
        Crafting: "🔨", Woodcutting: "🪓", Fishing: "🎣", Mining: "⛏️", Smithing: "⚒️",
        Foraging: "🌿", Farming: "🌱", Agility: "🏃", Plundering: "💰", Enchanting: "🔮", Brewing: "🧪"
      };
      return `
        <div class="flex items-center justify-between text-[11px] mb-2 last:mb-0">
          <div class="flex items-center gap-2">
            <span>${iconMap[skill] || "🔸"}</span>
            <span class="text-stone-300 font-rpg uppercase tracking-wider">${skill}</span>
          </div>
          <span class="text-stone-500 font-mono">${(exp / 1000000).toFixed(1)}M</span>
        </div>
      `;
    }).join("");

  const onlineWidget = onlineList.length > 0
    ? `<div class="grid grid-cols-2 gap-2 mt-2">` + onlineList.map(m => `
        <div class="flex items-center gap-2 bg-green-900/10 border border-green-800/20 px-2 py-1 rounded-md">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
          <span class="text-[10px] text-green-400 font-medium truncate">${esc(m.member_name)}</span>
        </div>
      `).join("") + `</div>`
    : `<p class="text-stone-600 text-[10px] italic mt-2">Nadie jugando ahora mismo</p>`;

  const badgeColorMap: Record<string, string> = {
    gray:   "border-stone-600 text-stone-400",
    red:    "border-red-600 text-red-400",
    green:  "border-green-600 text-green-400",
    yellow: "border-yellow-600 text-yellow-400",
    gold:   "border-yellow-600 text-yellow-400",
    blue:   "border-blue-600 text-blue-400",
    purple: "border-purple-600 text-purple-400",
    orange: "border-orange-600 text-orange-400",
    cyan:   "border-cyan-600 text-cyan-400",
  };

  const guideCards = guides.length === 0 
    ? `<p class="text-stone-500 text-sm italic">Aún no hay guías publicadas.</p>`
    : `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">` + guides.map(g => {
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
          ? `<img src="${esc(imgSrc)}" alt="${esc(g.title)}" class="w-16 h-16 rounded-xl object-cover object-center border border-yellow-900/30 flex-shrink-0 shadow-2xl" />`
          : `<div class="w-16 h-16 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-3xl flex-shrink-0 shadow-lg">${esc(emoji)}</div>`;

        const keyBadge = badges[3];
        const renderedBadges = keyBadge && keyBadge.label.trim() ? `
          <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${badgeColorMap[keyBadge.color] || badgeColorMap.gray} bg-black/40">
            ${esc(keyBadge.label)}
          </span>` : "";

        return `
          <a href="/guias/${esc(g.slug)}" class="flex gap-4 bg-stone-900/40 border border-yellow-900/10 rounded-xl p-4 hover:border-yellow-600/50 transition group hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-900/20 duration-300">
            ${thumb}
            <div class="flex-1 min-w-0 flex flex-col justify-center">
              ${category ? `<p class="text-[10px] text-yellow-600 uppercase font-rpg tracking-widest mb-1 truncate">${esc(category)}</p>` : ""}
              <h3 class="font-bold text-stone-100 text-sm mb-1 truncate group-hover:text-yellow-500 transition font-rpg uppercase">${esc(g.title)}</h3>
              ${renderedBadges ? `<div class="flex flex-wrap gap-1 mb-1">${renderedBadges}</div>` : ""}
              <p class="text-stone-500 text-[10px] italic">Autor: ${esc(g.author)}</p>
            </div>
          </a>`;
      }).join("") + `</div>`;

  const content = `
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-12 mt-4">
      <!-- Stats Col 1 -->
      <div class="lg:col-span-1 space-y-6">
        <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition-transform duration-700">👥</div>
          <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-widest mb-1">Miembros del Clan</p>
          <p class="text-4xl font-bold text-white font-rpg">${memberCount}</p>
          <div class="mt-4 pt-4 border-t border-yellow-900/10">
            <p class="text-[10px] text-stone-400 uppercase font-rpg tracking-widest mb-2 flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-green-500"></span> Online Ahora
            </p>
            ${onlineWidget}
          </div>
        </div>

        <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition-transform duration-700">🎯</div>
          <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-widest mb-1">Evento Activo</p>
          <div class="mt-1">${eventCard ? `<p class="text-sm font-bold text-cyan-400 font-rpg uppercase leading-tight">${esc(eventCard)}</p>` : `<p class="text-stone-600 text-xs italic">Sin evento</p>`}</div>
          <p class="text-[9px] text-stone-600 mt-3 uppercase tracking-widest">Sorteado diariamente</p>
        </div>
      </div>

      <!-- Stats Col 2 (Ranking) -->
      <div class="lg:col-span-2">
        <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-xl h-full flex flex-col">
          <div class="px-6 py-4 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
            <h2 class="text-sm font-bold font-rpg uppercase tracking-widest flex items-center gap-2 text-yellow-500">
              <span>🏆</span> Ranking Semanal
            </h2>
            <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest">Top 5</span>
          </div>
          <div class="flex-1">
            <table class="w-full">
              <thead>
                <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
                  <th class="py-2 px-6 text-left font-rpg tracking-widest">Pos</th>
                  <th class="py-2 px-4 text-left font-rpg tracking-widest">Guerrero</th>
                  <th class="py-2 px-4 text-left font-rpg tracking-widest">Rango</th>
                  <th class="py-2 px-6 text-right font-rpg tracking-widest">Exp</th>
                </tr>
              </thead>
              <tbody>${rankingRows}</tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Stats Col 3 (Strengths & Hero) -->
      <div class="lg:col-span-1 space-y-6">
        <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition-transform duration-700">⭐</div>
          <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-widest mb-1">Héroe del Clan</p>
          ${ranking[0]
            ? `<p class="text-xl font-bold text-yellow-500 font-rpg uppercase">${esc(ranking[0].username)}</p>
               <p class="text-[10px] text-purple-400 font-rpg uppercase tracking-widest mt-1">${esc(ranking[0].title)}</p>
               <div class="mt-4 flex items-center gap-2">
                 <div class="flex-1 h-1 bg-stone-800 rounded-full overflow-hidden">
                   <div class="h-full bg-yellow-600" style="width: 100%"></div>
                 </div>
               </div>`
            : `<p class="text-stone-600 text-xs italic mt-1">Buscando un héroe...</p>`
          }
        </div>

        <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
          <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-widest mb-4 border-b border-yellow-900/10 pb-2">Especialidades</p>
          ${topSkills || `<p class="text-stone-600 text-xs italic">Cargando stats...</p>`}
        </div>
      </div>
    </div>

    <div class="mb-16">
      <div class="flex items-center justify-between mb-6 border-b border-yellow-900/10 pb-4">
        <h2 class="text-2xl font-bold text-white font-rpg uppercase tracking-widest flex items-center gap-3">
          <span class="text-yellow-600">📜</span> Guías de Combate
        </h2>
        <a href="/guias" class="text-yellow-500 hover:text-yellow-400 text-xs transition font-rpg uppercase tracking-widest flex items-center gap-2 group">
          Ver Pergaminos <span class="group-hover:translate-x-1 transition-transform">→</span>
        </a>
      </div>
      ${guideCards}
    </div>
  `;

  const user = c.get("user");
  return c.html(publicLayout("Inicio", content, user));
});

export default home;
