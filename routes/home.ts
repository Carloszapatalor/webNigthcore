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
const CACHE_TTL = 30 * 60 * 1000; // 30 minutos

async function updateHomeCache() {
  const clanName = Deno.env.get("CLAN_NAME") || "Nightcore";
  console.log("Actualizando caché de Home (API pública)...");

  try {
    const today = getTodayUTC();
    const ranking: Record<string, { combat: number; skilling: number; total: number }> = {};
    const resLogs = await fetch(`https://query.idleclans.com/api/Clan/logs/clan/${encodeURIComponent(clanName)}?skip=0&limit=100`);
    const logs: ClanLog[] = await resLogs.json();
    
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
    const clanRes = await fetch(`https://query.idleclans.com/api/Clan/recruitment/${encodeURIComponent(clanName)}`);
    const clanData = await clanRes.json();
    if (clanData.serializedSkills) {
      cachedClanStats = JSON.parse(clanData.serializedSkills);
    }
  } catch (e) {
    console.error("Error cacheando clan stats:", (e as Error).message);
  }

  lastCacheUpdate = Date.now();
}

const home = new Hono();

home.get("/", async (c) => {
  const db = getTursoClient();
  const weekStart = getWeekStart();
  const today = getTodayUTC();

  // Renovar caché si ha expirado (o si es la primera vez)
  // No bloqueamos la petición actual si ya tenemos algo de caché, lo actualizamos de fondo
  if (Date.now() - lastCacheUpdate > CACHE_TTL) {
    if (lastCacheUpdate === 0) {
      await updateHomeCache(); // Primera vez: bloqueamos para tener datos
    } else {
      updateHomeCache(); // Actualización perezosa (lazy) en segundo plano
    }
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

  const quests = cachedQuestsRanking;
  const clanStats = cachedClanStats;

  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];

  const rankingRows =
    ranking.length === 0
      ? `<tr><td colspan="4" class="py-8 text-center text-stone-600 text-sm italic">Sin datos esta semana</td></tr>`
      : ranking
          .map(
            (r, i) => `
      <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition">
        <td class="py-4 px-4 font-bold text-stone-200 text-base">
          <span class="mr-3">${medals[i]}</span>${esc(r.username)}
        </td>
        <td class="py-4 px-4">
          <div class="flex items-center gap-2">
             <span class="text-[10px] font-rpg tracking-widest text-yellow-600 uppercase">Nv. ${r.level}</span>
          </div>
        </td>
        <td class="py-4 px-4">
          <span class="text-[10px] font-rpg tracking-widest text-stone-400 uppercase">${esc(r.title)}</span>
        </td>
        <td class="py-4 px-4 text-right font-rpg text-yellow-500 font-bold tracking-wider">
          ${Number(r.week_exp).toLocaleString()} EXP
        </td>
      </tr>`
          )
          .join("");

  const questsRows = quests.length === 0
    ? `<div class="py-12 text-center text-stone-600 text-sm italic">Nadie ha completado misiones hoy</div>`
    : quests.map(([user, counts], i) => `
      <div class="flex items-center justify-between p-4 bg-stone-950/40 rounded-xl border border-yellow-900/10 hover:border-yellow-900/30 transition">
        <div class="flex items-center gap-3">
          <span class="text-lg">${medals[i]}</span>
          <span class="font-bold text-stone-200">${esc(user)}</span>
        </div>
        <div class="flex gap-4 font-rpg text-[10px] tracking-widest">
          <div class="text-red-400 flex flex-col items-center">
             <span class="text-xs font-bold">${counts.combat}</span>
             <span class="uppercase opacity-70">Combate</span>
          </div>
          <div class="text-green-400 flex flex-col items-center">
             <span class="text-xs font-bold">${counts.skilling}</span>
             <span class="uppercase opacity-70">Habilidad</span>
          </div>
          <div class="text-yellow-500 flex flex-col items-center border-l border-yellow-900/30 pl-4 ml-2">
             <span class="text-sm font-bold">${counts.total}</span>
             <span class="uppercase opacity-70">Total</span>
          </div>
        </div>
      </div>
    `).join("");

  // Array of specific skills we want to display
  const targetSkills = ["Woodcutting", "Mining", "Fishing", "Farming", "Smithing", "Cooking"];
  
  // Transform standard Idle Clans stats format to something nicer
  const skillIcons: Record<string, string> = {
    Woodcutting: "🪓",
    Mining: "⛏️",
    Fishing: "🎣",
    Farming: "🌾",
    Smithing: "🔨",
    Cooking: "🍳",
    Melee: "⚔️",
    Archery: "🏹",
    Magic: "🔮"
  };

  const specialtiesCards = targetSkills.map(skill => {
    const level = clanStats[skill] || 0;
    const isMaxed = level >= 120; // Assume 120 is max for visual emphasis
    const icon = skillIcons[skill] || "⭐";
    
    return `
      <div class="bg-stone-900/40 border border-yellow-900/10 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-stone-800/40 hover:border-yellow-900/30 transition group">
        <div class="text-3xl mb-2 group-hover:scale-110 transition duration-300">${icon}</div>
        <p class="text-[10px] font-rpg uppercase tracking-widest text-stone-500 mb-1">${skill}</p>
        <p class="font-rpg text-lg font-bold text-yellow-500">
          ${formatClanValue(level)}
        </p>
      </div>
    `;
  }).join("");

  const onlineBadges = onlineList.length === 0
    ? `<p class="text-stone-600 text-sm italic py-2">No hay miembros en línea detectados (Actualizado cada hora)</p>`
    : onlineList.map(m => `
      <span class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-950/30 text-green-400 border border-green-900/50 rounded-full text-xs font-rpg tracking-wider shadow-[0_0_10px_rgba(34,197,94,0.1)]">
        <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
        ${esc(m.member_name)}
      </span>
    `).join("");

  const content = `
    <!-- HEADER INTRO -->
    <div class="mb-16 text-center max-w-3xl mx-auto">
      <h2 class="text-5xl font-bold text-yellow-500 mb-4 font-rpg tracking-[0.2em] drop-shadow-lg">Castillo Nightcore</h2>
      <p class="text-stone-400 text-lg leading-relaxed italic">
        "En la oscuridad forjamos nuestro legado. La lealtad es nuestra armadura, la persistencia nuestra espada."
      </p>
    </div>

    <!-- MAIN METRICS -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">👥</div>
        <p class="text-stone-500 text-xs uppercase font-rpg tracking-[0.2em] mb-2 font-bold">Fuerza del Clan</p>
        <p class="text-5xl font-bold text-stone-200 font-rpg">${memberCount} <span class="text-lg text-stone-600 tracking-widest uppercase">Miembros</span></p>
      </div>
      
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">⚔️</div>
        <p class="text-stone-500 text-xs uppercase font-rpg tracking-[0.2em] mb-2 font-bold">Evento Activo Hoy</p>
        ${eventLabel ? 
          `<p class="text-xl font-bold text-purple-400 font-rpg leading-tight uppercase tracking-wider">${eventLabel}</p>` : 
          `<p class="text-xl font-bold text-stone-600 font-rpg uppercase tracking-wider">Día de Descanso</p>`
        }
      </div>

      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
        <div class="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition duration-500">🏆</div>
        <p class="text-stone-500 text-xs uppercase font-rpg tracking-[0.2em] mb-2 font-bold">Mejor del Día</p>
        <p class="text-2xl font-bold text-yellow-600 font-rpg truncate">
          ${quests.length > 0 ? quests[0][0] : '—'}
        </p>
        <p class="text-[10px] text-stone-500 uppercase tracking-widest font-rpg mt-1">
          ${quests.length > 0 ? `${quests[0][1].total} Misiones Completadas` : ''}
        </p>
      </div>
    </div>

    <!-- SECCIÓN DE ESPECIALIDADES (CLAN STATS) -->
    <div class="mb-12">
      <div class="flex items-center gap-3 mb-6 px-2">
        <span class="text-2xl">🎖️</span>
        <h3 class="text-xl font-bold text-yellow-500 font-rpg uppercase tracking-widest">Especialidades del Clan</h3>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        ${specialtiesCards}
      </div>
    </div>

    <!-- DUAL COLUMN LAYOUT -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
      
      <!-- LÍDERES DE EXPERIENCIA (Left Col - 7/12) -->
      <div class="lg:col-span-7 bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        <div class="px-8 py-6 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
          <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-yellow-500 flex items-center gap-3">
            <span class="text-2xl">👑</span> Vanguardia Semanal
          </h2>
          <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest border border-yellow-900/20 px-2 py-1 rounded">Top 5 EXP</span>
        </div>
        <div class="p-0 flex-1 flex flex-col justify-center">
          <table class="w-full h-full">
            <tbody class="divide-y divide-yellow-900/5">
              ${rankingRows}
            </tbody>
          </table>
        </div>
      </div>

      <!-- LÍDERES DE MISIONES DIARIAS (Right Col - 5/12) -->
      <div class="lg:col-span-5 bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
         <div class="px-6 py-6 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
          <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-yellow-500 flex items-center gap-3">
            <span class="text-xl">📜</span> Misiones de Hoy
          </h2>
          <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest border border-yellow-900/20 px-2 py-1 rounded">Top 5</span>
        </div>
        <div class="p-4 flex flex-col gap-2 flex-1">
          ${questsRows}
        </div>
      </div>

    </div>

    <!-- ONLINE STATUS SECTION -->
    <div class="bg-stone-900/40 border border-green-900/20 rounded-2xl p-6 shadow-lg mb-12 relative overflow-hidden">
      <div class="absolute -right-4 -top-4 text-8xl opacity-[0.02] pointer-events-none">🟢</div>
      <h3 class="text-sm font-bold text-green-500 font-rpg uppercase tracking-widest mb-4 flex items-center gap-2">
        <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        Guerreros en el Frente (0h Offline)
      </h3>
      <div class="flex flex-wrap gap-2">
        ${onlineBadges}
      </div>
    </div>

    <!-- BIBLIOTECA (GUÍAS) -->
    <div>
      <div class="flex items-center justify-between mb-6 px-2">
        <div class="flex items-center gap-3">
          <span class="text-2xl">📚</span>
          <h3 class="text-xl font-bold text-yellow-500 font-rpg uppercase tracking-widest">Biblioteca del Clan</h3>
        </div>
        <a href="/guias" class="text-xs text-stone-400 hover:text-yellow-500 transition font-rpg uppercase tracking-widest">Ver todos los pergaminos →</a>
      </div>
      
      <div class="grid grid-cols-1 gap-6">
        ${guides.map(g => {
          let preview = g.content.replace(/<[^>]+>/g, '').slice(0, 150);
          let icon = "📜";
          let category = "Guía";
          let imageHtml = `<div class="w-20 h-20 bg-stone-950/50 rounded-2xl border border-yellow-900/20 flex items-center justify-center text-4xl shadow-inner">📜</div>`;
          let badgesHtml = "";
          
          if (g.content.startsWith('{')) {
            try {
              const data = JSON.parse(g.content);
              preview = data.subtitle || data.description || "";
              if (data.bossEmoji) icon = data.bossEmoji;
              if (data.category) category = data.category;
              
              if (data.image) {
                imageHtml = `<img src="${data.image}" class="w-20 h-20 object-contain rounded-2xl border border-yellow-900/20 shadow-lg" />`;
              } else if (data.imageLink) {
                imageHtml = `<img src="${data.imageLink}" class="w-20 h-20 object-contain rounded-2xl border border-yellow-900/20 shadow-lg" />`;
              } else if (data.imageBase64) {
                 imageHtml = `<img src="${data.imageBase64}" class="w-20 h-20 object-contain rounded-2xl border border-yellow-900/20 shadow-lg" />`;
              } else if (data.bossEmoji) {
                 imageHtml = `<div class="w-20 h-20 bg-stone-950/50 rounded-2xl border border-yellow-900/20 flex items-center justify-center text-4xl shadow-inner">${data.bossEmoji}</div>`;
              }

              // Badges logic
              const badges = [];
              if (data.health) badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-green-500/30 bg-green-500/10 text-green-400 text-[9px] font-bold"><span class="text-xs">❤️</span> VIDA: ${data.health}</span>`);
              if (data.maxHit) badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-[9px] font-bold"><span class="text-xs">🥊</span> GOLPE MÁXIMO: ${data.maxHit}</span>`);
              if (data.resistance) badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-400 text-[9px] font-bold"><span class="text-xs">🛡️</span> RESISTENTE: ${data.resistance}</span>`);
              if (data.requirement) badges.push(`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-[9px] font-bold"><span class="text-xs">🔑</span> ${data.requirement}</span>`);
              
              if (badges.length > 0) {
                badgesHtml = `<div class="flex flex-wrap gap-2 mt-3">${badges.join('')}</div>`;
              }
            } catch {
              // Fail safe
            }
          }

          return `
          <a href="/guias/${g.slug}" class="bg-stone-900/60 border border-yellow-900/10 p-6 rounded-2xl hover:bg-stone-800/80 transition group block shadow-xl hover:shadow-yellow-900/10 relative overflow-hidden">
            <div class="absolute w-1 h-full bg-yellow-700/30 left-0 top-0 group-hover:bg-yellow-500 transition"></div>
            
            <div class="flex items-center gap-6">
              <div class="flex-shrink-0">
                ${imageHtml}
              </div>
              
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-rpg uppercase tracking-[0.2em] text-yellow-600/70 mb-1 font-bold">${category}</p>
                <h4 class="text-xl font-bold text-stone-200 group-hover:text-yellow-400 transition font-rpg truncate">
                  ${icon} ${esc(g.title)}
                </h4>
                
                ${badgesHtml}
                
                <div class="flex items-center gap-2 mt-4 text-[10px] font-rpg uppercase tracking-widest text-stone-500">
                  <span>ESCRITO POR ${esc(g.author)}</span>
                  <span class="opacity-30">•</span>
                  <span>${g.created_at.slice(0, 10)}</span>
                </div>
              </div>
            </div>
          </a>`;
        }).join('')}
      </div>
    </div>
  `;

  return c.html(publicLayout("Portal", content));
});

export default home;
