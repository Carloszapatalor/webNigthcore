import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout, esc } from "../views/layout.ts";
import { fetchWithTimeout, cacheGetStale, cacheSet } from "../lib/cache.ts";

function getWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatClanValue(val: number): string {
  if (val >= 1000000) return (val / 1000000).toFixed(1) + "M";
  if (val >= 1000) return (val / 1000).toFixed(1) + "K";
  return Math.floor(val).toString();
}

interface ClanLog {
  memberUsername: string;
  message: string;
  timestamp: string;
}

// === SISTEMA DE CACHÉ EN MEMORIA ===
let cachedQuestsRanking: [string, { combat: number; skilling: number; total: number }][] = [];
let cachedClanStats: Record<string, number> = {};
let lastCacheUpdate = 0;
let cacheUpdateInProgress = false;
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos
const API_TIMEOUT = 4000; // 4 segundos máximo por llamada a API externa

async function updateHomeCache() {
  if (cacheUpdateInProgress) return; // Evita llamadas concurrentes duplicadas
  cacheUpdateInProgress = true;
  const clanName = Deno.env.get("CLAN_NAME") || "Nightcore";
  console.log("Actualizando caché de Home (API pública)...");

  try {
    const today = getTodayUTC();
    const ranking: Record<string, { combat: number; skilling: number; total: number }> = {};
    const resLogs = await fetchWithTimeout(
      `https://query.idleclans.com/api/Clan/logs/clan/${encodeURIComponent(clanName)}?skip=0&limit=100`,
      API_TIMEOUT,
    );
    if (!resLogs.ok) throw new Error(`API Logs returned ${resLogs.status}`);
    const logsText = await resLogs.text();
    let logs: ClanLog[];
    try {
      logs = JSON.parse(logsText);
    } catch {
      throw new Error("Invalid JSON in logs response");
    }

    for (const log of logs) {
      if (log.timestamp.slice(0, 10) !== today) continue;

      const combatMatch = log.message.match(/^(.+?) completed a daily combat quest/);
      const skillingMatch = log.message.match(/^(.+?) completed a skilling quest/);

      if (combatMatch || skillingMatch) {
        const user = combatMatch ? combatMatch[1] : skillingMatch![1];
        if (!ranking[user]) ranking[user] = { combat: 0, skilling: 0, total: 0 };

        if (combatMatch) ranking[user].combat++;
        else ranking[user].skilling++;
        ranking[user].total++;
      }
    }
    cachedQuestsRanking = Object.entries(ranking)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 5);
  } catch (e) {
    console.error("Error cacheando quests:", (e as Error).message);
  }

  try {
    const clanRes = await fetchWithTimeout(
      `https://query.idleclans.com/api/Clan/recruitment/${encodeURIComponent(clanName)}`,
      API_TIMEOUT,
    );
    if (!clanRes.ok) throw new Error(`API Recruitment returned ${clanRes.status}`);
    const clanText = await clanRes.text();
    let clanData;
    try {
      clanData = JSON.parse(clanText);
    } catch {
      throw new Error("Invalid JSON in recruitment response");
    }
    if (clanData.serializedSkills) {
      cachedClanStats = JSON.parse(clanData.serializedSkills);
    }
  } catch (e) {
    console.error("Error cacheando clan stats:", (e as Error).message);
  }

  lastCacheUpdate = Date.now();
  cacheUpdateInProgress = false;
}

export async function warmHomeCache() {
  if (cacheUpdateInProgress) return;
  cacheUpdateInProgress = true;
  const clanName = Deno.env.get("CLAN_NAME") || "Nightcore";
  console.log("Warming home cache...");

  try {
    const today = getTodayUTC();
    const ranking: Record<string, { combat: number; skilling: number; total: number }> = {};
    const resLogs = await fetchWithTimeout(
      `https://query.idleclans.com/api/Clan/logs/clan/${encodeURIComponent(clanName)}?skip=0&limit=100`,
      API_TIMEOUT,
    );
    if (resLogs.ok) {
      const logs = JSON.parse(await resLogs.text());
      for (const log of logs as ClanLog[]) {
        if (log.timestamp.slice(0, 10) !== today) continue;
        const combatMatch = log.message.match(/^(.+?) completed a daily combat quest/);
        const skillingMatch = log.message.match(/^(.+?) completed a skilling quest/);
        if (combatMatch || skillingMatch) {
          const user = combatMatch ? combatMatch[1] : skillingMatch![1];
          if (!ranking[user]) ranking[user] = { combat: 0, skilling: 0, total: 0 };
          if (combatMatch) ranking[user].combat++;
          else ranking[user].skilling++;
          ranking[user].total++;
        }
      }
      cachedQuestsRanking = Object.entries(ranking)
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 5);
    }
  } catch (e) {
    console.error("Error warming quests:", (e as Error).message);
  }

  try {
    const clanRes = await fetchWithTimeout(
      `https://query.idleclans.com/api/Clan/recruitment/${encodeURIComponent(Deno.env.get("CLAN_NAME") || "Nightcore")}`,
      API_TIMEOUT,
    );
    if (clanRes.ok) {
      const clanData = JSON.parse(await clanRes.text());
      if (clanData.serializedSkills) {
        cachedClanStats = JSON.parse(clanData.serializedSkills);
      }
    }
  } catch (e) {
    console.error("Error warming clan stats:", (e as Error).message);
  }

  lastCacheUpdate = Date.now();
  cacheUpdateInProgress = false;
  console.log("Home cache warmed");
}

const home = new Hono();

function renderHomePage(data: any) {
  const d = data;
  const ranking = d.ranking || [];
  const eventLabel = d.eventLabel;
  const memberCount = d.memberCount ?? 0;
  const onlineList = d.onlineList || [];
  const guides = d.guides || [];
  const quests = d.quests || [];
  const clanStats = d.clanStats || {};

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const neonMedals = [
    "shadow-[0_0_15px_rgba(250,204,21,0.4)] text-yellow-400",
    "shadow-[0_0_15px_rgba(226,232,240,0.3)] text-slate-300",
    "shadow-[0_0_15px_rgba(217,119,6,0.3)] text-amber-600",
    "text-stone-500",
    "text-stone-500"
  ];

  const rankingRows =
    ranking.length === 0
      ? `<tr><td colspan="4" class="py-12 text-center text-stone-600 text-sm italic font-rpg uppercase tracking-[0.3em]">Sin datos del frente</td></tr>`
      : ranking
        .map(
          (r, i) => `
      <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
        <td class="py-5 px-6 font-bold">
          <div class="flex items-center gap-4">
            <span class="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-sm border border-white/10 ${neonMedals[i]} font-rpg">${i + 1}</span>
            <span class="text-white text-base tracking-wide">${esc(r.username)}</span>
          </div>
        </td>
        <td class="py-5 px-6">
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-500/20 rounded-full text-[10px] font-rpg tracking-widest text-violet-400 uppercase">
             Lv. ${r.level}
          </div>
        </td>
        <td class="py-5 px-6">
          <span class="text-[10px] font-subtitle tracking-widest text-stone-500 uppercase">${esc(r.title)}</span>
        </td>
        <td class="py-5 px-6 text-right">
          <span class="text-[10px] font-mono text-cyan-400 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">${Number(r.week_exp).toLocaleString()} <span class="text-[8px] text-stone-600">EXP</span></span>
        </td>
      </tr>`
        )
        .join("");

  const questsRows = quests.length === 0
    ? `<div class="py-12 text-center text-stone-600 text-sm italic font-rpg tracking-[0.2em] uppercase">Misiones no reportadas</div>`
    : quests.map(([user, counts]: [string, { combat: number; skilling: number; total: number }][], i: number) => `
      <div class="group p-5 bg-[#161821]/40 rounded-2xl border border-white/5 hover:border-violet-500/30 transition-all duration-300 hover:shadow-[0_0_25px_rgba(139,92,246,0.1)]">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full ${i < 3 ? 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,1)]' : 'bg-stone-700'}"></div>
            <span class="font-bold text-white text-base font-rpg tracking-wider">${esc(user)}</span>
          </div>
          <span class="text-[10px] font-rpg text-stone-500 uppercase">Rango ${i + 1}</span>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-black/20 rounded-xl p-2 border border-white/5 text-center">
             <span class="block text-xs font-bold text-red-400 font-rpg">${counts.combat}</span>
             <span class="text-[8px] uppercase tracking-tighter text-stone-600 font-subtitle">Combate</span>
          </div>
          <div class="bg-black/20 rounded-xl p-2 border border-white/5 text-center">
             <span class="block text-xs font-bold text-green-400 font-rpg">${counts.skilling}</span>
             <span class="text-[8px] uppercase tracking-tighter text-stone-600 font-subtitle">Skill</span>
          </div>
          <div class="bg-black/20 rounded-xl p-2 border border-white/5 text-center">
             <span class="block text-xs font-bold text-violet-400 font-rpg">${counts.total}</span>
             <span class="text-[8px] uppercase tracking-tighter text-stone-600 font-subtitle">Total</span>
          </div>
        </div>
      </div>`
    ).join("");

  const formatClanValue = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toString();

  const targetSkills = ["Woodcutting", "Mining", "Fishing", "Farming", "Smithing", "Cooking"];
  const skillIcons: Record<string, string> = {
    Woodcutting: "🪓", Mining: "⛏️", Fishing: "🎣", Farming: "🌾", Smithing: "🔨", Cooking: "🍳"
  };
  const skillColors: Record<string, string> = {
    Woodcutting: "text-orange-400", Mining: "text-cyan-400", Fishing: "text-blue-400",
    Farming: "text-green-400", Smithing: "text-slate-400", Cooking: "text-red-400"
  };

  const specialtiesCards = targetSkills.map(skill => {
    const level = clanStats[skill] || 0;
    const icon = skillIcons[skill] || "⭐";
    const color = skillColors[skill] || "text-violet-400";

    return `
      <div class="bg-[#11131A]/60 border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-white/10 transition-all duration-300 group">
        <div class="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">${icon}</div>
        <p class="text-[9px] font-rpg uppercase tracking-[0.2em] text-stone-500 mb-1 font-bold">${skill}</p>
        <p class="font-rpg text-xl font-bold ${color} drop-shadow-[0_0_8px_currentColor]">
          ${formatClanValue(level)}
        </p>
      </div>
    `;
  }).join("");

  const content = `
    <!-- HERO SECTION -->
    <div class="mb-20 relative">
      <div class="absolute -top-20 left-1/2 -translate-x-1/2 w-full h-full bg-violet-600/5 blur-[120px] -z-10"></div>
      <div class="text-center space-y-6">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-600/10 border border-violet-500/20 rounded-full text-[10px] font-rpg tracking-[0.4em] text-violet-400 uppercase font-bold mb-4 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
          <span class="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,1)]"></span>
          Clan Nightcore
        </div>
        <h2 class="text-4xl sm:text-6xl md:text-8xl font-bold text-white font-rpg tracking-tighter leading-tight drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">NIGHTCORE</h2>
        <p class="text-stone-500 font-subtitle text-lg max-w-2xl mx-auto leading-relaxed">
          "En la oscuridad forjamos nuestro legado. La lealtad es nuestra armadura, la persistencia nuestra espada." 
      </div>
    </div>

    <!-- RANKING WEEKLY -->
    <div class="glass-panel mb-12">
      <div class="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div class="flex items-center gap-3">
          <div class="w-1 h-6 bg-violet-600 rounded-full"></div>
          <h3 class="font-rpg text-sm uppercase tracking-[0.3em] text-white font-bold">Top Semanal</h3>
        </div>
        <span class="text-[9px] text-stone-600 font-rpg uppercase tracking-[0.2em]">🏆 EXPERTOS</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-[9px] text-stone-600 uppercase font-rpg tracking-[0.3em] bg-white/5 border-b border-white/5">
              <th class="py-4 px-6 text-left">Miembro</th>
              <th class="py-4 px-6 text-left">Nivel</th>
              <th class="py-4 px-6 text-left">Título</th>
              <th class="py-4 px-6 text-right">EXP</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">${rankingRows}</tbody>
        </table>
      </div>
    </div>

    <!-- QUESTS TODAY -->
    <div class="glass-panel mb-12">
      <div class="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div class="flex items-center gap-3">
          <div class="w-1 h-6 bg-red-500 rounded-full"></div>
          <h3 class="font-rpg text-sm uppercase tracking-[0.3em] text-white font-bold">Misiones del Día</h3>
        </div>
        <span class="text-[9px] text-stone-600 font-rpg uppercase tracking-[0.2em]">⚔️ COMBATE</span>
      </div>
      <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">${questsRows}</div>
    </div>

    <!-- CLAN STATS -->
    <div class="glass-panel mb-12">
      <div class="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div class="flex items-center gap-3">
          <div class="w-1 h-6 bg-cyan-500 rounded-full"></div>
          <h3 class="font-rpg text-sm uppercase tracking-[0.3em] text-white font-bold">Especialidades del Clan</h3>
        </div>
        <span class="text-[9px] text-stone-600 font-rpg uppercase tracking-[0.2em]">💎 SKILLS</span>
      </div>
      <div class="p-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">${specialtiesCards}</div>
    </div>

    <!-- EVENT BANNER -->
    ${eventLabel ? `
    <div class="mb-12 relative overflow-hidden rounded-3xl">
      <div class="absolute inset-0 bg-gradient-to-r from-violet-600/20 via-purple-600/10 to-violet-600/20"></div>
      <div class="relative px-8 py-8 flex items-center justify-between">
        <div>
          <p class="text-[9px] text-violet-400 font-rpg uppercase tracking-[0.3em] mb-2">Evento activo</p>
          <h3 class="text-2xl font-bold text-white font-rpg uppercase tracking-wider">${esc(eventLabel)}</h3>
        </div>
        <div class="text-6xl opacity-20">✨</div>
      </div>
    </div>
    ` : ""}

    <!-- STATS GRID -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      <div class="glass-panel p-6 text-center">
        <p class="text-[9px] text-stone-500 font-rpg uppercase tracking-[0.3em] mb-2">Miembros</p>
        <p class="text-4xl font-bold text-white font-rpg">${memberCount}</p>
      </div>
      <div class="glass-panel p-6 text-center">
        <p class="text-[9px] text-stone-500 font-rpg uppercase tracking-[0.3em] mb-2">En línea</p>
        <p class="text-4xl font-bold text-green-400 font-rpg">${onlineList.length}</p>
      </div>
      <div class="glass-panel p-6 text-center">
        <p class="text-[9px] text-stone-500 font-rpg uppercase tracking-[0.3em] mb-2">Pergaminos</p>
        <p class="text-4xl font-bold text-violet-400 font-rpg">${guides.length}</p>
      </div>
    </div>

    <!-- GUIDES PREVIEW -->
    <div class="glass-panel">
      <div class="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div class="flex items-center gap-3">
          <div class="w-1 h-6 bg-violet-600 rounded-full"></div>
          <h3 class="font-rpg text-sm uppercase tracking-[0.3em] text-white font-bold">Biblioteca de Pergaminos</h3>
        </div>
        <a href="/guias" class="text-[9px] text-violet-400 hover:text-violet-300 font-rpg uppercase tracking-[0.2em] transition">Ver todos →</a>
      </div>
      <div class="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        ${guides.slice(0, 6).map((g: any) => {
          const data = JSON.parse(g.content);
          const preview = data.infoBox?.slice(0, 100) || "";
          const subtitle = data.subtitle || "";
          const icon = data.bossEmoji || "📜";
          const badgesHtml = data.badges?.filter((b: any) => b.label).slice(0, 2).map((b: any) => {
            const colors: Record<string, string> = {
              gray: "bg-stone-500/20 text-stone-400 border-stone-500/30",
              red: "bg-red-500/20 text-red-400 border-red-500/30",
              green: "bg-green-500/20 text-green-400 border-green-500/30",
              yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
              blue: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
              purple: "bg-violet-500/20 text-violet-400 border-violet-500/30",
              orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
              cyan: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
            };
            return `<span class="px-2 py-0.5 rounded-full text-[8px] font-rpg uppercase tracking-wider border ${colors[b.color] || colors.yellow}">${esc(b.label)}</span>`;
          }).join("");

          return `
          <a href="/guias/${esc(g.slug)}" class="group block p-6 bg-[#161821]/40 rounded-2xl border border-white/5 hover:border-violet-500/30 transition-all duration-300 hover:shadow-[0_0_25px_rgba(139,92,246,0.15)]">
            <div class="flex items-start gap-4 mb-4">
              <div class="w-12 h-12 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-2xl">${icon}</div>
              <div class="flex-1 min-w-0">
                <h4 class="font-bold text-white text-sm font-rpg tracking-wide truncate">${esc(g.title)}</h4>
                <p class="text-stone-500 text-sm italic font-subtitle mt-2 line-clamp-1 truncate">${esc(subtitle)}</p>
                ${badgesHtml || `<p class="text-stone-500 text-sm italic mt-3 font-subtitle line-clamp-1">${esc(preview)}</p>`}
                
                <div class="flex items-center gap-4 mt-6 text-[9px] font-rpg uppercase tracking-[0.2em] text-stone-600">
                  <span class="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5"><span class="text-stone-400">Written by</span> <span class="text-stone-300 font-bold">${esc(g.author)}</span></span>
          
                </div>
              </div>
              
              <div class="hidden md:block">
                <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-stone-600 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300 border border-white/5">
                  <span class="text-xl">→</span>
                </div>
              </div>
            </div>
          </a>`;
        }).join('')}
      </div>
    </div>
  `;

  return content;
}

home.get("/", async (c) => {
  const db = getTursoClient();
  const weekStart = getWeekStart();
  const today = getTodayUTC();

  const staleQuests = cacheGetStale<[string, { combat: number; skilling: number; total: number }][]>("home:quests");
  const staleClanStats = cacheGetStale<Record<string, number>>("home:clanStats");

  if (Date.now() - lastCacheUpdate > CACHE_TTL) {
    updateHomeCache().catch(e => console.error("Home cache update error:", e));
  }

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

  type RpgRow = { username: string; week_exp: number; title: string; level: number };
  const ranking = rankingResult.status === "fulfilled" ? (rankingResult.value.rows as unknown as RpgRow[]) : [];

  const rawEventLabel = eventResult.status === "fulfilled" && eventResult.value.rows.length > 0 ? (eventResult.value.rows[0] as unknown as { label: string }).label : null;
  const eventLabel = rawEventLabel ? rawEventLabel.split(/[—–-]/)[0].trim() : null;
  const memberCount = membersResult.status === "fulfilled" ? (membersResult.value.rows[0] as unknown as { cnt: number }).cnt : "—";
  const onlineList = onlineResult.status === "fulfilled" ? (onlineResult.value.rows as unknown as { member_name: string }[]) : [];

  type GuideRow = { slug: string; title: string; author: string; created_at: string; content: string };
  const guides = guidesResult.status === "fulfilled" ? (guidesResult.value.rows as unknown as GuideRow[]) : [];

  const quests = staleQuests || cachedQuestsRanking;
  const clanStats = staleClanStats || cachedClanStats;

  const homeData = {
    ranking,
    eventLabel,
    memberCount,
    onlineList,
    guides,
    quests,
    clanStats,
  };

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
  const neonMedals = [
    "shadow-[0_0_15px_rgba(250,204,21,0.4)] text-yellow-400",
    "shadow-[0_0_15px_rgba(226,232,240,0.3)] text-slate-300",
    "shadow-[0_0_15px_rgba(217,119,6,0.3)] text-amber-600",
    "text-stone-500",
    "text-stone-500"
  ];

  const rankingRows =
    ranking.length === 0
      ? `<tr><td colspan="4" class="py-12 text-center text-stone-600 text-sm italic font-rpg uppercase tracking-[0.3em]">Sin datos del frente</td></tr>`
      : ranking
        .map(
          (r, i) => `
      <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
        <td class="py-5 px-6 font-bold">
          <div class="flex items-center gap-4">
            <span class="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-sm border border-white/10 ${neonMedals[i]} font-rpg">${i + 1}</span>
            <span class="text-white text-base tracking-wide">${esc(r.username)}</span>
          </div>
        </td>
        <td class="py-5 px-6">
          <div class="inline-flex items-center gap-2 px-3 py-1 bg-violet-600/10 border border-violet-500/20 rounded-full text-[10px] font-rpg tracking-widest text-violet-400 uppercase">
             Lv. ${r.level}
          </div>
        </td>
        <td class="py-5 px-6">
          <span class="text-[10px] font-subtitle tracking-widest text-stone-500 uppercase">${esc(r.title)}</span>
        </td>
        <td class="py-5 px-6 text-right">
          <span class="font-rpg text-sm font-bold text-violet-400 drop-shadow-[0_0_10px_rgba(139,92,246,0.3)]">
            ${Number(r.week_exp).toLocaleString()} <span class="text-[10px] opacity-50">EXP</span>
          </span>
        </td>
      </tr>`
        )
        .join("");

  const questsRows = quests.length === 0
    ? `<div class="py-12 text-center text-stone-600 text-sm italic font-rpg tracking-[0.2em] uppercase">Misiones no reportadas</div>`
    : quests.map(([user, counts]: [string, { combat: number; skilling: number; total: number }][], i: number) => `
      <div class="group p-5 bg-[#161821]/40 rounded-2xl border border-white/5 hover:border-violet-500/30 transition-all duration-300 hover:shadow-[0_0_25px_rgba(139,92,246,0.1)]">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-2 h-2 rounded-full ${i < 3 ? 'bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,1)]' : 'bg-stone-700'}"></div>
            <span class="font-bold text-white text-base font-rpg tracking-wider">${esc(user)}</span>
          </div>
          <span class="text-[10px] font-rpg text-stone-500 uppercase">Rango ${i + 1}</span>
        </div>
        <div class="grid grid-cols-3 gap-3">
          <div class="bg-black/20 rounded-xl p-2 border border-white/5 text-center">
             <span class="block text-xs font-bold text-red-400 font-rpg">${counts.combat}</span>
             <span class="text-[8px] uppercase tracking-tighter text-stone-600 font-subtitle">Combate</span>
          </div>
          <div class="bg-black/20 rounded-xl p-2 border border-white/5 text-center">
             <span class="block text-xs font-bold text-green-400 font-rpg">${counts.skilling}</span>
             <span class="text-[8px] uppercase tracking-tighter text-stone-600 font-subtitle">Skill</span>
          </div>
          <div class="bg-violet-600/10 rounded-xl p-2 border border-violet-500/20 text-center">
             <span class="block text-xs font-bold text-violet-400 font-rpg">${counts.total}</span>
             <span class="text-[8px] uppercase tracking-tighter text-violet-500/50 font-subtitle">Total</span>
          </div>
        </div>
      </div>
    `).join("");

  const targetSkills = ["Woodcutting", "Mining", "Fishing", "Farming", "Smithing", "Cooking"];
  const skillIcons: Record<string, string> = {
    Woodcutting: "🪓", Mining: "⛏️", Fishing: "🎣", Farming: "🌾", Smithing: "🔨", Cooking: "🍳"
  };
  const skillColors: Record<string, string> = {
    Woodcutting: "text-orange-400", Mining: "text-cyan-400", Fishing: "text-blue-400",
    Farming: "text-green-400", Smithing: "text-slate-400", Cooking: "text-red-400"
  };

  const specialtiesCards = targetSkills.map(skill => {
    const level = clanStats[skill] || 0;
    const icon = skillIcons[skill] || "⭐";
    const color = skillColors[skill] || "text-violet-400";

    return `
      <div class="bg-[#11131A]/60 border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-center text-center hover:bg-white/5 hover:border-white/10 transition-all duration-300 group">
        <div class="text-3xl mb-3 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">${icon}</div>
        <p class="text-[9px] font-rpg uppercase tracking-[0.2em] text-stone-500 mb-1 font-bold">${skill}</p>
        <p class="font-rpg text-xl font-bold ${color} drop-shadow-[0_0_8px_currentColor]">
          ${formatClanValue(level)}
        </p>
      </div>
    `;
  }).join("");

  const content = `
    <!-- HERO SECTION -->
    <div class="mb-20 relative">
      <div class="absolute -top-20 left-1/2 -translate-x-1/2 w-full h-full bg-violet-600/5 blur-[120px] -z-10"></div>
      <div class="text-center space-y-6">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-600/10 border border-violet-500/20 rounded-full text-[10px] font-rpg tracking-[0.4em] text-violet-400 uppercase font-bold mb-4 shadow-[0_0_20px_rgba(139,92,246,0.2)]">
          <span class="w-1.5 h-1.5 rounded-full bg-violet-500 shadow-[0_0_8px_rgba(139,92,246,1)]"></span>
          Clan Nightcore
        </div>
        <h2 class="text-4xl sm:text-6xl md:text-8xl font-bold text-white font-rpg tracking-tighter leading-tight drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">NIGHTCORE</h2>
        <p class="text-stone-500 font-subtitle text-lg max-w-2xl mx-auto leading-relaxed">
          "En la oscuridad forjamos nuestro legado. La lealtad es nuestra armadura, la persistencia nuestra espada." 
      </div>
    </div>

    <!-- KPI GRID -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
      <div class="bg-[#11131A]/60 border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group hover:border-violet-500/30 transition-all duration-500">
        <div class="absolute -right-8 -top-8 text-9xl opacity-[0.03] rotate-12 group-hover:scale-110 transition-transform duration-700">👥</div>
        <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-[0.3em] mb-3 font-bold">Miembros</p>
        <div class="flex items-baseline gap-3">
          <span class="text-6xl font-bold text-white font-rpg tracking-tighter">${memberCount}</span>
          <span class="text-stone-600 font-rpg text-xs uppercase tracking-widest">Guerreros</span>
        </div>
      </div>
      
      <div class="bg-[#11131A]/60 border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group hover:border-cyan-500/30 transition-all duration-500">
        <div class="absolute -right-8 -top-8 text-9xl opacity-[0.03] rotate-12 group-hover:scale-110 transition-transform duration-700">🎯</div>
        <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-[0.3em] mb-3 font-bold">Evento</p>
        ${eventLabel ?
      `<p class="text-2xl font-bold text-cyan-400 font-rpg tracking-wider leading-tight uppercase drop-shadow-[0_0_15px_rgba(34,211,238,0.4)]">${eventLabel}</p>` :
      `<p class="text-2xl font-bold text-stone-600 font-rpg uppercase tracking-widest">Estado: Standby</p>`
    }
      </div>

      <div class="bg-[#11131A]/60 border border-white/5 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden group hover:border-orange-500/30 transition-all duration-500">
        <div class="absolute -right-8 -top-8 text-9xl opacity-[0.03] rotate-12 group-hover:scale-110 transition-transform duration-700">🏆</div>
        <p class="text-stone-500 text-[10px] uppercase font-rpg tracking-[0.3em] mb-3 font-bold">Quests</p>
        <p class="text-3xl font-bold text-orange-500 font-rpg tracking-tighter uppercase truncate drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">
          ${quests.length > 0 ? quests[0][0] : '—'}
        </p>
        <p class="text-[9px] text-stone-600 uppercase tracking-[0.2em] font-rpg font-bold mt-2">
          MVP Quests Diarias
        </p>
      </div>
    </div>

    <!-- ESPECIALIDADES -->
    <div class="mb-20">
      <div class="flex items-center justify-between mb-10 px-4">
        <div class="flex items-center gap-4">
          <div class="w-10 h-1 h-1 rounded-full bg-violet-600"></div>
          <h3 class="text-xl font-bold text-white font-rpg uppercase tracking-[0.3em]">Especialidades</h3>
        </div>
        <span class="text-[10px] font-rpg text-stone-600 uppercase tracking-widest">Métricas de Especialización</span>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-6 gap-4">
        ${specialtiesCards}
      </div>
    </div>

    <!-- MAIN DASHBOARD CONTENT -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-20">
      
      <!-- LÍDERES DE EXPERIENCIA (Left - 2/3) -->
      <div class="lg:col-span-2 space-y-8">
        <div class="flex items-center justify-between px-4">
          <h2 class="text-2xl font-bold text-white font-rpg uppercase tracking-[0.2em]">Top Ranking</h2>
          <div class="px-3 py-1 bg-violet-900/20 border border-violet-500/20 rounded-lg text-[9px] font-rpg text-violet-400 uppercase font-bold">Top 5 Semanal</div>
        </div>
        
        <div class="bg-[#11131A]/60 border border-white/5 rounded-[2.5rem] overflow-hidden shadow-2xl backdrop-blur-xl">
          <table class="w-full">
            <thead class="bg-white/5 border-b border-white/5">
              <tr class="text-[10px] text-stone-500 uppercase font-rpg tracking-[0.3em]">
                <th class="py-5 px-8 text-left">Guerrero</th>
                <th class="py-5 px-6 text-left">Nivel</th>
                <th class="py-5 px-6 text-left">Título</th>
                <th class="py-5 px-6 text-right">Potencia (EXP)</th>
              </tr>
            </thead>
            <tbody>
              ${rankingRows}
            </tbody>
          </table>
        </div>
      </div>

      <!-- MISIONES (Right - 1/3) -->
      <div class="space-y-8">
        <div class="flex items-center justify-between px-4">
          <h2 class="text-2xl font-bold text-white font-rpg uppercase tracking-[0.2em]">Misiones completas</h2>
          <span class="text-2xl">📜</span>
        </div>
        <div class="space-y-4">
          ${questsRows}
        </div>
      </div>

    </div>

    <!-- BIBLIOTECA -->
    <div>
      <div class="flex items-center justify-between mb-12 px-4">
        <div class="flex items-center gap-4">
          <div class="w-10 h-1 h-1 rounded-full bg-violet-600 shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
          <h3 class="text-xl font-bold text-white font-rpg uppercase tracking-[0.3em]">Pergaminos</h3>
        </div>
        <a href="/guias" class="text-[10px] text-stone-500 hover:text-violet-400 transition-all font-rpg uppercase tracking-[0.3em] group">
          Explorar Archivos <span class="inline-block group-hover:translate-x-2 transition-transform">→</span>
        </a>
      </div>
      
      <div class="grid grid-cols-1 gap-6">
        ${guides.map(g => {
      let preview = g.content.replace(/<[^>]+>/g, '').slice(0, 150);
      let icon = "📜";
      let category = "Protocolo";
      let imageHtml = `<div class="w-24 h-24 bg-stone-900/80 rounded-[1.5rem] border border-white/5 flex items-center justify-center text-4xl shadow-inner neon-border">📜</div>`;
      let badgesHtml = "";

      if (g.content.startsWith('{')) {
        try {
          const data = JSON.parse(g.content);
          preview = data.subtitle || data.description || "";
          if (data.bossEmoji) icon = data.bossEmoji;
          if (data.category) category = data.category;

          if (data.image || data.imageLink || data.imageBase64) {
            const src = data.image || data.imageLink || data.imageBase64;
            imageHtml = `<img src="${src}" class="w-24 h-24 object-contain rounded-[1.5rem] border border-white/5 shadow-2xl bg-black/40 p-2 neon-border" />`;
          }

          const badges = [];
          if (data.health) badges.push(`<div class="flex flex-col items-center px-4 py-2 bg-black/40 border border-green-500/20 rounded-xl"><span class="text-green-500 text-[10px] font-rpg font-bold">HP</span><span class="text-white text-sm font-bold">${data.health}</span></div>`);
          if (data.maxHit) badges.push(`<div class="flex flex-col items-center px-4 py-2 bg-black/40 border border-red-500/20 rounded-xl"><span class="text-red-500 text-[10px] font-rpg font-bold">GOLPE</span><span class="text-white text-sm font-bold">${data.maxHit}</span></div>`);
          if (data.resistance) badges.push(`<div class="flex flex-col items-center px-4 py-2 bg-black/40 border border-purple-500/20 rounded-xl"><span class="text-purple-500 text-[10px] font-rpg font-bold">RES</span><span class="text-white text-sm font-bold truncate max-w-[60px]">${data.resistance}</span></div>`);

          if (badges.length > 0) {
            badgesHtml = `<div class="flex flex-wrap gap-3 mt-4">${badges.join('')}</div>`;
          }
        } catch { }
      }

      return `
          <a href="/guias/${g.slug}" class="group bg-[#11131A]/40 border border-white/5 p-8 rounded-[2.5rem] hover:bg-white/5 hover:border-violet-500/30 transition-all duration-500 block relative overflow-hidden">
            <div class="absolute -right-12 -bottom-12 text-[10rem] opacity-[0.02] group-hover:scale-110 transition-transform duration-700 pointer-events-none">${icon}</div>
            
            <div class="flex flex-col md:flex-row items-start md:items-center gap-10">
              <div class="flex-shrink-0 relative">
                ${imageHtml}
                <div class="absolute -inset-2 bg-violet-600/10 blur-xl rounded-full -z-10 group-hover:bg-violet-600/20 transition-all"></div>
              </div>
              
              <div class="flex-1 min-w-0">
                <p class="text-[9px] font-rpg uppercase tracking-[0.4em] text-violet-500/70 mb-2 font-bold">${category}</p>
                <h4 class="text-2xl font-bold text-white group-hover:text-violet-400 transition-all font-rpg tracking-wider">
                  ${icon} ${esc(g.title)}
                </h4>
                
                ${badgesHtml || `<p class="text-stone-500 text-sm italic mt-3 font-subtitle line-clamp-1">${esc(preview)}</p>`}
                
                <div class="flex items-center gap-4 mt-6 text-[9px] font-rpg uppercase tracking-[0.2em] text-stone-600">
                  <span class="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/5"><span class="text-stone-400">Escrito por</span> <span class="text-stone-300 font-bold">${esc(g.author)}</span></span>
          
                </div>
              </div>
              
              <div class="hidden md:block">
                <div class="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-stone-600 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300 border border-white/5">
                  <span class="text-xl">→</span>
                </div>
              </div>
            </div>
          </a>`;
    }).join('')}
      </div>
    </div>
  `;

  const user = c.get("user");
  return c.html(publicLayout("Home", content, user));
});

export default home;
