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
        } else if (!res.ok) {
          throw new Error(`API returned ${res.status}`);
        } else {
          const text = await res.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error("Invalid JSON in player profile response");
          }
          const skillExps = data.skillExperiences || {};

        const renderCategory = (title: string, icon: string, skills: string[]) => {
          const filtered = Object.entries(skillExps).filter(([s]) => skills.includes(s.toLowerCase()));
          if (filtered.length === 0) return "";
          
          const grid = filtered.map(([skill, exp]) => {
            const xp = Number(exp);
            const level = calculateLevel(xp);
            const sIcon = skillIcons[skill.toLowerCase()] || "🔸";
            return `
              <div class="bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center gap-5 group hover:border-violet-500/30 transition-all duration-300 hover:bg-white/5">
                <span class="text-2xl group-hover:scale-110 transition duration-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]">${sIcon}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-stone-600 text-[8px] uppercase font-rpg tracking-widest truncate font-bold mb-1">${skill}</p>
                  <div class="flex items-baseline gap-2">
                    <span class="text-2xl font-bold text-white font-rpg">${level}</span>
                    <span class="text-[9px] text-stone-700 font-mono font-bold">${(xp / 1000000).toFixed(1)}M</span>
                  </div>
                </div>
              </div>`;
          }).join("");

          return `
            <div class="mb-10">
              <h4 class="text-[10px] font-bold text-violet-500 font-rpg uppercase tracking-[0.3em] mb-5 flex items-center gap-3">
                <span class="w-1 h-4 bg-violet-600 rounded-full"></span> ${title}
              </h4>
              <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                ${grid}
              </div>
            </div>`;
        };

        profileContent = `
          <div class="glass-panel p-10 relative overflow-hidden">
            <div class="absolute -right-20 -top-20 text-[12rem] opacity-[0.03] pointer-events-none font-rpg">IC</div>
            
            <div class="flex flex-col md:flex-row items-center gap-10 mb-12 pb-10 border-b border-white/5">
              <div class="relative">
                <div class="w-32 h-32 bg-[#0B0D13] rounded-full border border-violet-500/20 flex items-center justify-center text-6xl shadow-2xl">
                  👤
                </div>
                <div class="absolute -bottom-2 -right-2 bg-violet-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl border border-violet-400/50 font-rpg shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                  LVL ${Math.max(...Object.values(skillExps).map(xp => calculateLevel(Number(xp))))}
                </div>
              </div>
              <div class="text-center md:text-left">
                <p class="text-violet-500 font-rpg text-[10px] uppercase tracking-[0.4em] mb-2 font-bold">Registro de Guerrero</p>
                <h2 class="text-5xl font-bold text-white font-rpg uppercase tracking-widest drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">${esc(data.username)}</h2>
                <div class="flex flex-wrap gap-3 mt-6 justify-center md:justify-start">
                  <span class="bg-black/40 border border-white/5 px-4 py-2.5 rounded-2xl text-[9px] text-stone-300 font-rpg uppercase flex items-center gap-2 shadow-inner font-bold">
                    <span class="text-violet-500">🏰</span> Gremio: <span class="text-white">${esc(data.guildName || "Ninguno")}</span>
                  </span>
                  <span class="bg-black/40 border border-white/5 px-4 py-2.5 rounded-2xl text-[9px] text-stone-300 font-rpg uppercase flex items-center gap-2 shadow-inner font-bold">
                    <span class="text-violet-500">⚔️</span> Modo: <span class="text-white">${esc(data.gameMode)}</span>
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
         class="bg-[#11131A]/60 border border-white/5 rounded-[2rem] p-6 text-center hover:border-violet-500/30 transition-all group hover:-translate-y-2 duration-500 shadow-xl">
        <div class="w-14 h-14 bg-[#0B0D13] rounded-full mx-auto mb-4 flex items-center justify-center text-3xl group-hover:bg-violet-600/10 transition-all shadow-inner border border-white/5">👤</div>
        <p class="text-stone-300 text-[9px] font-rpg uppercase tracking-[0.3em] truncate font-bold">${esc(m.member_name)}</p>
      </a>
    `).join("");

    profileContent = `
      <div class="mt-12">
        <div class="flex items-center gap-4 mb-8">
          <div class="h-px flex-1 bg-white/5"></div>
          <h3 class="text-[10px] font-bold text-stone-600 font-rpg uppercase tracking-[0.3em]">Héroes de Nightcore</h3>
          <div class="h-px flex-1 bg-white/5"></div>
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
        <h1 class="text-6xl font-bold text-white font-rpg tracking-[0.3em] uppercase drop-shadow-2xl neon-text-violet">Armería</h1>
        <p class="text-stone-600 mt-4 font-rpg text-[10px] tracking-[0.5em] uppercase font-bold">La sabiduría del clan escrita en piedra</p>
      </div>

      <form action="/jugadores" method="GET" class="mb-20 max-w-2xl mx-auto relative group">
        <div class="absolute -inset-1 bg-gradient-to-r from-violet-600/20 via-pink-600/10 to-violet-600/20 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
        <div class="relative flex gap-3 bg-[#0B0D13] border border-white/5 rounded-[2rem] p-4 shadow-2xl">
          <input name="nombre" type="text" placeholder="Buscar guerrero..." value="${esc(query)}" required
            class="flex-1 bg-transparent rounded-xl px-6 py-4 text-white focus:outline-none font-rpg tracking-[0.2em] uppercase text-sm" />
          <button type="submit" class="btn-primary px-12 py-4 rounded-2xl transition font-bold font-rpg uppercase tracking-widest active:scale-95">
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
