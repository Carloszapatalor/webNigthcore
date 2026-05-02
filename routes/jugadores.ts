import { Hono } from "hono";
import { publicLayout, esc } from "../views/layout.ts";
import { optionalAuth } from "../middleware/optionalAuth.ts";
import { getTursoClient } from "../lib/turso.ts";

const jugadores = new Hono();

jugadores.use("*", optionalAuth);

function calculateLevel(xp: number): number {
  if (xp <= 0) return 1;
  if (xp >= 104273167) return 120;
  if (xp >= 13034431) {
    return 99 + Math.floor((xp - 13034431) / 4147215);
  }
  return Math.min(99, Math.floor(Math.pow(xp / 130, 0.4)) || 1);
}

const skillIcons: Record<string, string> = {
  attack: "⚔️", strength: "💪", defence: "🛡️", archery: "🏹", magic: "✨", health: "❤️",
  crafting: "🔨", woodcutting: "🪓", fishing: "🎣", mining: "⛏️", smithing: "⚒️",
  foraging: "🌿", farming: "🌱", agility: "🏃", plundering: "💰", enchanting: "🔮", brewing: "🧪",
  exterminating: "💀", invocation: "🕯️", carpentry: "🪵", cooking: "🍳"
};

const skillCategories = {
  combate: ["attack", "strength", "defence", "health", "archery", "magic", "exterminating", "invocation"],
  recoleccion: ["mining", "woodcutting", "fishing", "foraging", "farming"],
  artesania: ["smithing", "cooking", "crafting", "carpentry", "enchanting", "brewing"],
  aventura: ["agility", "plundering"]
};

jugadores.get("/", async (c) => {
  const query = c.req.query("nombre")?.trim() || "";
  const db = getTursoClient();
  let profileContent = "";

  if (query) {
    try {
      const res = await fetch(`https://query.idleclans.com/api/Player/profile/${encodeURIComponent(query)}`);
      if (res.status === 404) {
        profileContent = `
          <div class="bg-stone-900/60 border border-red-900/20 rounded-2xl p-12 text-center shadow-xl">
            <span class="text-5xl mb-4 block">💀</span>
            <h2 class="text-xl font-bold text-white font-rpg uppercase">Jugador no encontrado</h2>
            <p class="text-stone-500 mt-2">No hemos podido hallar a "${esc(query)}" en los registros de Idle Clans.</p>
          </div>`;
      } else {
        const data = await res.json();
        const skillExps = data.skillExperiences || {};

        const renderCategory = (title: string, icon: string, skills: string[]) => {
          const filtered = Object.entries(skillExps).filter(([s]) => skills.includes(s.toLowerCase()));
          if (filtered.length === 0) return "";
          
          const grid = filtered.map(([skill, exp]) => {
            const xp = Number(exp);
            const level = calculateLevel(xp);
            const sIcon = skillIcons[skill.toLowerCase()] || "🔸";
            return `
              <div class="bg-black/40 border border-yellow-900/5 rounded-xl p-3 flex items-center gap-4 group hover:border-yellow-600/30 transition">
                <span class="text-xl group-hover:scale-110 transition">${sIcon}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-stone-500 text-[8px] uppercase font-rpg tracking-widest truncate">${skill}</p>
                  <div class="flex items-baseline gap-2">
                    <span class="text-xl font-bold text-white font-rpg">${level}</span>
                    <span class="text-[8px] text-stone-600 font-mono">${(xp / 1000000).toFixed(1)}M</span>
                  </div>
                </div>
              </div>`;
          }).join("");

          return `
            <div class="mb-10">
              <h4 class="text-xs font-bold text-yellow-700 font-rpg uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <span>${icon}</span> ${title}
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                ${grid}
              </div>
            </div>`;
        };

        profileContent = `
          <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
            <div class="absolute -right-20 -top-20 text-[12rem] opacity-[0.03] pointer-events-none font-rpg">IC</div>
            
            <div class="flex flex-col md:flex-row items-center gap-8 mb-12 pb-10 border-b border-yellow-900/10">
              <div class="relative">
                <div class="w-32 h-32 bg-stone-800 rounded-full border-4 border-yellow-700/30 flex items-center justify-center text-6xl shadow-2xl">
                  👤
                </div>
                <div class="absolute -bottom-2 -right-2 bg-yellow-600 text-stone-950 text-[10px] font-bold px-2 py-1 rounded border border-yellow-400/50 font-rpg shadow-lg">
                  LVL ${Math.max(...Object.values(skillExps).map(xp => calculateLevel(Number(xp))))}
                </div>
              </div>
              <div class="text-center md:text-left">
                <p class="text-yellow-600 font-rpg text-xs uppercase tracking-[0.4em] mb-1">Registro de Guerrero</p>
                <h2 class="text-5xl font-bold text-white font-rpg uppercase tracking-widest">${esc(data.username)}</h2>
                <div class="flex flex-wrap gap-3 mt-5 justify-center md:justify-start">
                  <span class="bg-black/40 border border-yellow-900/10 px-4 py-2 rounded-lg text-[10px] text-stone-300 font-rpg uppercase flex items-center gap-2 shadow-inner">
                    <span class="text-yellow-600">🏰</span> Gremio: ${esc(data.guildName || "Ninguno")}
                  </span>
                  <span class="bg-black/40 border border-yellow-900/10 px-4 py-2 rounded-lg text-[10px] text-stone-300 font-rpg uppercase flex items-center gap-2 shadow-inner">
                    <span class="text-yellow-600">⚔️</span> Modo: ${esc(data.gameMode)}
                  </span>
                </div>
              </div>
            </div>

            ${renderCategory("Senda del Guerrero", "⚔️", skillCategories.combate)}
            ${renderCategory("Senda del Recolector", "🌿", skillCategories.recoleccion)}
            ${renderCategory("Senda del Artesano", "⚒️", skillCategories.artesania)}
            ${renderCategory("Senda del Aventurero", "🏃", skillCategories.aventura)}
          </div>`;
      }
    } catch (e) {
      profileContent = `<p class="text-red-400">Error: ${esc((e as Error).message)}</p>`;
    }
  } else {
    const members = await db.execute(`SELECT member_name FROM clan_members ORDER BY rank DESC, member_name ASC LIMIT 8`);
    const memberChips = members.rows.map(m => `
      <a href="/jugadores?nombre=${encodeURIComponent(String(m.member_name))}" 
         class="bg-stone-900/60 border border-yellow-900/10 rounded-2xl p-5 text-center hover:border-yellow-600 transition group hover:-translate-y-1 duration-300">
        <div class="w-12 h-12 bg-stone-800 rounded-full mx-auto mb-3 flex items-center justify-center text-2xl group-hover:bg-yellow-900/20 transition shadow-inner">👤</div>
        <p class="text-stone-300 text-[10px] font-rpg uppercase tracking-widest truncate">${esc(m.member_name)}</p>
      </a>
    `).join("");

    profileContent = `
      <div class="mt-12">
        <div class="flex items-center gap-4 mb-8">
          <div class="h-px flex-1 bg-yellow-900/20"></div>
          <h3 class="text-[10px] font-bold text-stone-600 font-rpg uppercase tracking-[0.3em]">Héroes de Nightcore</h3>
          <div class="h-px flex-1 bg-yellow-900/20"></div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          ${memberChips}
        </div>
      </div>
    `;
  }

  const content = `
    <div class="max-w-5xl mx-auto">
      <div class="mb-16 text-center relative py-12">
        <h1 class="text-6xl font-bold text-white font-rpg tracking-[0.3em] uppercase drop-shadow-2xl">Armería</h1>
        <p class="text-yellow-700 mt-4 font-rpg text-xs tracking-[0.4em] uppercase opacity-70 italic">La sabiduría del clan escrita en piedra</p>
      </div>

      <form action="/jugadores" method="GET" class="mb-20 max-w-2xl mx-auto relative group">
        <div class="absolute -inset-1 bg-gradient-to-r from-yellow-900/20 via-yellow-600/10 to-yellow-900/20 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
        <div class="relative flex gap-3 bg-stone-950 border border-yellow-900/20 rounded-2xl p-3 shadow-2xl">
          <input name="nombre" type="text" placeholder="Buscar guerrero..." value="${esc(query)}" required
            class="flex-1 bg-transparent rounded-xl px-6 py-4 text-white focus:outline-none font-rpg tracking-[0.2em] uppercase text-sm" />
          <button type="submit"
            class="bg-yellow-700 hover:bg-yellow-600 text-stone-950 px-12 py-4 rounded-xl transition font-rpg font-bold uppercase tracking-widest shadow-xl active:scale-95">
            Buscar
          </button>
        </div>
      </form>

      ${profileContent}
    </div>
  `;

  const user = c.get("user");
  return c.html(publicLayout("Buscador de Jugadores", content, user));
});

export default jugadores;
