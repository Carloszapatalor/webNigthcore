import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout, esc } from "../views/layout.ts";

// ─── Tipos ───────────────────────────────────────────────────────────────

export interface StatField   { label: string; value: string; color: string }
export interface DropField   { icon: string; name: string; rate: string; rare: boolean }
export interface StepField   { text: string }

export interface GuideData {
  bossEmoji: string;
  imageUrl: string;
  imageBase64: string;
  category: string;
  subtitle: string;
  badges: { label: string; color: string }[];
  infoBox: string;
  stats: StatField[];
  warningBox: string;
  steps: StepField[];
  drops: DropField[];
  tipBox: string;
}

// ─── Renderer visual ──────────────────────────────────────────────────────────

const badgeColorMap: Record<string, string> = {
  gray:   "border-stone-700 text-stone-500 bg-black/20",
  red:    "border-red-500/40 text-red-400 bg-red-500/5 shadow-[0_0_10px_rgba(239,68,68,0.2)]",
  green:  "border-green-500/40 text-green-400 bg-green-500/5 shadow-[0_0_10px_rgba(34,197,94,0.2)]",
  yellow: "border-orange-500/40 text-orange-400 bg-orange-500/5 shadow-[0_0_10px_rgba(249,115,22,0.2)]",
  blue:   "border-blue-500/40 text-blue-400 bg-blue-500/5 shadow-[0_0_10px_rgba(59,130,246,0.2)]",
  purple: "border-violet-500/40 text-violet-400 bg-violet-500/5 shadow-[0_0_10px_rgba(139,92,246,0.2)]",
  orange: "border-orange-500/40 text-orange-400 bg-orange-500/5 shadow-[0_0_10px_rgba(249,115,22,0.2)]",
  cyan:   "border-cyan-500/40 text-cyan-400 bg-cyan-500/5 shadow-[0_0_10px_rgba(6,182,212,0.2)]",
};

const statIconMap: Record<string, string> = {
  "HP": "❤️", "VIDA": "❤️", "DAÑO": "⚔️", "ATAQUE": "⚔️", "RESISTENCIA": "🛡️", "DEFENSA": "🛡️",
  "MAGIA": "🪄", "ARQUERÍA": "🏹", "RANGO": "🏹", "VELOCIDAD": "⚡", "ESPECIAL": "✨"
};

export function renderGuide(title: string, data: GuideData, author: string, date: string): string {
  const imageSrc = data.imageBase64 || data.imageUrl || "";
  const heroMedia = imageSrc
    ? `<div class="relative group">
         <div class="absolute -inset-4 bg-violet-600/20 blur-2xl rounded-full animate-pulse"></div>
         <img src="${esc(imageSrc)}" class="w-48 h-48 rounded-full object-contain bg-[#0B0D13] border-4 border-violet-500/40 shadow-2xl relative z-10" />
       </div>`
    : `<div class="w-48 h-48 rounded-full bg-[#0B0D13] border-4 border-violet-500/40 flex items-center justify-center text-7xl shadow-2xl relative">
         <div class="absolute -inset-4 bg-violet-600/10 blur-xl rounded-full"></div>
         <span class="relative z-10">${esc(data.bossEmoji || "📜")}</span>
       </div>`;

  const badges = (data.badges ?? []).map(b => `
    <span class="px-4 py-1.5 rounded-full border text-[10px] font-rpg font-bold tracking-widest uppercase ${badgeColorMap[b.color] || badgeColorMap.yellow}">
      ${esc(b.label)}
    </span>`).join("");

  const statsGrid = (data.stats ?? []).length > 0 ? `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
      ${data.stats.map(s => {
        const icon = statIconMap[s.label.toUpperCase()] || "📊";
        return `
        <div class="bg-black/40 border border-white/5 rounded-[2rem] p-6 text-center hover:border-violet-500/30 transition-all duration-300 group hover:bg-white/5 shadow-inner">
          <div class="text-2xl mb-3 group-hover:scale-110 transition-transform duration-300 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">${icon}</div>
          <div class="text-[9px] text-stone-600 font-rpg font-bold uppercase tracking-[0.3em] mb-1">${esc(s.label)}</div>
          <div class="text-xl font-rpg font-bold text-white tracking-widest uppercase">${esc(s.value)}</div>
        </div>`;
      }).join("")}
    </div>` : "";

  const steps = (data.steps ?? []).map((s, i) => `
    <div class="flex gap-6 items-start group">
      <div class="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/30 flex items-center justify-center flex-shrink-0 text-violet-400 font-rpg font-bold text-sm shadow-[0_0_15px_rgba(139,92,246,0.1)] group-hover:bg-violet-600 group-hover:text-white transition-all">
        ${i + 1}
      </div>
      <div class="flex-1 pt-2">
        <p class="text-stone-300 leading-relaxed font-subtitle text-base">${esc(s.text)}</p>
      </div>
    </div>`).join("");

  const dropsGrid = (data.drops ?? []).map(d => `
    <div class="bg-black/20 border ${d.rare ? 'border-orange-500/30 bg-orange-500/5' : 'border-white/5'} rounded-2xl p-5 flex items-center gap-5 hover:scale-105 transition-transform">
      <div class="text-4xl flex-shrink-0 drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">${esc(d.icon || "📦")}</div>
      <div class="min-w-0 flex-1">
        <div class="text-sm font-bold text-white font-rpg tracking-wider uppercase break-words leading-snug">${esc(d.name)}</div>
        <div class="text-[10px] text-stone-500 font-mono mt-1 break-all">${esc(d.rate || "Unknown")}</div>
      </div>
      ${d.rare ? `<div class="flex-shrink-0 text-[8px] font-rpg font-bold text-orange-500 uppercase tracking-widest bg-orange-500/10 px-2 py-1 rounded">ÉPICO</div>` : ""}
    </div>`).join("");

  return `
    <!-- HEADER -->
    <div class="mb-16">
      <a href="/guias" class="inline-flex items-center gap-3 text-[10px] text-stone-600 hover:text-violet-400 font-rpg font-bold uppercase tracking-[0.4em] transition-all mb-12 group">
        <span class="group-hover:-translate-x-2 transition-transform">←</span> Volver a los Pergaminos
      </a>

      <div class="glass-panel p-12 relative overflow-hidden">
        <div class="absolute -right-20 -bottom-20 text-[20rem] opacity-[0.01] pointer-events-none rotate-12 font-rpg">GUIDE</div>
        
        <div class="flex flex-col md:flex-row items-center gap-12 relative z-10">
          <div class="flex-shrink-0 relative">
            <div class="absolute -inset-4 bg-violet-600/10 blur-3xl rounded-full -z-10"></div>
            ${heroMedia}
          </div>
          
          <div class="flex-1 text-center md:text-left space-y-6">
            <div class="inline-block px-4 py-1.5 bg-violet-600/10 border border-violet-500/30 rounded-lg text-[10px] font-rpg font-bold tracking-[0.4em] text-violet-400 uppercase">
              ${esc(data.category || "Pergamino")}
            </div>
            <h2 class="text-5xl md:text-6xl font-bold text-white font-rpg tracking-tighter leading-tight drop-shadow-[0_0_20px_rgba(255,255,255,0.1)]">
              ${esc(title)}
            </h2>
            <p class="text-stone-500 font-subtitle text-lg italic max-w-xl">
              "${esc(data.subtitle)}"
            </p>
            <div class="flex flex-wrap justify-center md:justify-start gap-3 pt-2">
              ${badges}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN GRID -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
      
      <!-- LEFT COL: CONTENT (8/12) -->
      <div class="lg:col-span-8 space-y-12">
        
        <!-- STATS -->
        ${statsGrid}

        <!-- INFO BOX -->
        ${data.infoBox ? `
        <div class="bg-violet-600/5 border border-violet-500/20 rounded-3xl p-8 relative overflow-hidden">
          <div class="absolute left-0 top-0 w-1.5 h-full bg-violet-600"></div>
          <h3 class="text-xs font-rpg font-bold text-violet-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
             <span>📌</span> Sabiduría Inicial
          </h3>
          <p class="text-stone-300 leading-relaxed font-subtitle text-lg">${esc(data.infoBox)}</p>
        </div>` : ""}

        <!-- STEPS -->
        <div class="space-y-8">
          <div class="flex items-center gap-4">
             <div class="w-1.5 h-8 bg-violet-600 rounded-full"></div>
             <h3 class="text-xl font-bold text-white font-rpg uppercase tracking-[0.3em]">Estrategia</h3>
          </div>
          
          ${data.warningBox ? `
          <div class="bg-red-500/5 border border-red-500/20 rounded-2xl p-6 text-red-200 text-sm font-bold font-rpg flex items-center gap-4">
            <span class="text-2xl animate-pulse">⚠️</span>
            <span class="tracking-widest uppercase">${esc(data.warningBox)}</span>
          </div>` : ""}

          <div class="space-y-8 bg-[#11131A]/40 border border-white/5 rounded-[2.5rem] p-10">
            ${steps}
          </div>
        </div>
      </div>

      <!-- RIGHT COL: SIDEBAR (4/12) -->
      <div class="lg:col-span-4 space-y-12">
        
        <!-- DROPS -->
        <div class="space-y-6">
          <h3 class="text-xs font-rpg font-bold text-orange-400 uppercase tracking-[0.3em] px-2 flex items-center gap-3">
            <span>💰</span> Drops destacados
          </h3>
          <div class="space-y-4">
            ${dropsGrid}
          </div>
        </div>

        <!-- META -->
        <div class="bg-[#11131A]/60 border border-white/5 rounded-3xl p-8 text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-stone-800 border border-white/10 flex items-center justify-center text-stone-400 text-2xl font-bold font-rpg mx-auto">
            ${author[0].toUpperCase()}
          </div>
          <div>
            <p class="text-[9px] text-stone-600 font-rpg font-bold uppercase tracking-[0.3em] mb-1">Escrito por</p>
            <p class="text-white font-rpg font-bold uppercase tracking-widest">${esc(author)}</p>
          </div>
          <div class="pt-4 border-t border-white/5">
            <p class="text-[9px] text-stone-600 font-rpg font-bold uppercase tracking-[0.3em] mb-1">Fecha de Registro</p>
            <p class="text-stone-400 font-mono text-xs">${esc(date)}</p>
          </div>
        </div>

      </div>
    </div>

    <!-- CONSEJO FINAL (ancho completo, al pie del post) -->
    ${data.tipBox ? `
    <div class="mt-12 bg-green-500/5 border border-green-500/20 rounded-3xl p-10 relative overflow-hidden">
      <div class="absolute left-0 top-0 w-1.5 h-full bg-green-500 rounded-l-3xl"></div>
      <div class="flex flex-col md:flex-row items-start gap-8">
        <div class="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 text-3xl">
          🧠
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="text-xs font-rpg font-bold text-green-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-3">
            El Consejo Final
          </h3>
          <p class="text-stone-300 text-base leading-relaxed font-subtitle italic break-words">${esc(data.tipBox)}</p>
        </div>
      </div>
    </div>` : ""}

    <div class="mt-16 py-10 border-t border-white/5 text-center">
      <p class="text-[9px] font-rpg tracking-[0.5em] text-stone-700 uppercase">✦ Sabiduría del Clan Nightcore ✦</p>
    </div>
  `;
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

const guias = new Hono();

guias.get("/", async (c) => {
  const db = getTursoClient();
  const result = await db.execute(
    `SELECT slug, title, author, created_at, content FROM guides WHERE published = 1 ORDER BY created_at DESC`
  );
  type GuideRow = { slug: string; title: string; author: string; created_at: string; content: string };
  const list = result.rows as unknown as GuideRow[];

  const cards =
    list.length === 0
      ? `<div class="py-24 text-center space-y-4">
          <div class="text-6xl opacity-20">📖</div>
          <p class="text-stone-600 font-rpg uppercase tracking-[0.4em] text-[10px]">Biblioteca de Pergaminos Vacía</p>
        </div>`
      : list.map((g) => {
          let emoji = "📖";
          let category = "Guía";
          let subtitle = "";
          let imgSrc = "";
          let badgesHtml = "";
          try {
            const d = JSON.parse(g.content);
            if (d.bossEmoji) emoji = d.bossEmoji;
            if (d.category) category = d.category;
            subtitle = d.subtitle || "";
            imgSrc = d.imageBase64 || d.imageUrl || "";
            
            const badges = (d.badges || []).slice(0, 3).map((b: any) => `
              <span class="px-2 py-0.5 rounded border text-[8px] font-rpg font-bold tracking-widest uppercase ${badgeColorMap[b.color] || badgeColorMap.yellow}">
                ${esc(b.label)}
              </span>`).join("");
            if (badges) badgesHtml = `<div class="flex flex-wrap gap-2 mt-3">${badges}</div>`;
          } catch { }

          const thumb = imgSrc
            ? `<div class="relative flex-shrink-0">
                 <div class="absolute -inset-2 bg-violet-600/10 blur-lg rounded-full"></div>
                 <img src="${esc(imgSrc)}" class="w-24 h-24 rounded-2xl object-contain bg-[#0B0D13] border border-white/10 relative z-10" />
               </div>`
            : `<div class="w-24 h-24 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-4xl flex-shrink-0 shadow-inner">${esc(emoji)}</div>`;

          return `
            <a href="/guias/${esc(g.slug)}"
              class="group flex flex-col md:flex-row items-center gap-8 bg-[#11131A]/40 border border-white/5 rounded-[2.5rem] p-8 hover:bg-white/5 hover:border-violet-500/30 transition-all duration-500 relative overflow-hidden shadow-2xl">
              <div class="absolute -right-8 -bottom-8 text-8xl opacity-[0.02] rotate-12 pointer-events-none group-hover:scale-110 transition-transform">${emoji}</div>
              
              <div class="flex-shrink-0 relative">
                 <div class="absolute -inset-2 bg-violet-600/5 blur-xl rounded-full group-hover:bg-violet-600/10 transition-all"></div>
                 ${thumb}
              </div>
              
              <div class="flex-1 text-center md:text-left min-w-0">
                <p class="text-[9px] text-violet-500/70 uppercase font-rpg tracking-[0.4em] mb-2 font-bold">${esc(category || "Pergamino")}</p>
                <h3 class="font-bold text-white text-3xl group-hover:text-violet-400 transition-all font-rpg tracking-wider">${esc(g.title)}</h3>
                <p class="text-stone-500 text-sm italic font-subtitle mt-2 line-clamp-1 truncate">${esc(subtitle)}</p>
                ${badgesHtml}
              </div>
              
              <div class="flex flex-col items-center md:items-end gap-2 text-right">
                <span class="text-[9px] font-rpg font-bold text-stone-600 uppercase tracking-widest">Escrito por ${esc(g.author)}</span>
                <span class="text-[9px] font-mono text-stone-700 font-bold tracking-tighter">${g.created_at.slice(0, 10)}</span>
              </div>

              <div class="hidden md:block">
                 <div class="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-stone-700 border border-white/5 group-hover:bg-violet-600 group-hover:text-white transition-all">
                    <span class="text-xl">→</span>
                 </div>
              </div>
            </a>`;
        }).join("");

  const content = `
    <div class="max-w-5xl mx-auto">
      <div class="mb-20 text-center py-10 relative">
        <div class="absolute inset-0 bg-violet-600/5 blur-[100px] -z-10"></div>
        <h1 class="text-6xl font-bold text-white font-rpg tracking-tighter uppercase drop-shadow-2xl">PERGAMINOS</h1>
        <p class="text-stone-600 mt-4 font-rpg text-[10px] tracking-[0.5em] uppercase font-bold">Biblioteca de Pergaminos</p>
      </div>
      <div class="space-y-8">${cards}</div>
    </div>
  `;

  const user = c.get("user");
  return c.html(publicLayout("Biblioteca de Pergaminos", content, user));
});

guias.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = getTursoClient();
  const result = await db.execute({
    sql: `SELECT title, content, author, created_at FROM guides WHERE slug = ? AND published = 1`,
    args: [slug],
  });
  if (result.rows.length === 0) return c.notFound();
  type Row = { title: string; content: string; author: string; created_at: string };
  const g = result.rows[0] as unknown as Row;

  let rendered: string;
  try {
    const data = JSON.parse(g.content) as GuideData;
    rendered = renderGuide(g.title, data, g.author, g.created_at.slice(0, 10));
  } catch {
    const { marked } = await import("npm:marked");
    const DOMPurify = (await import("npm:isomorphic-dompurify")).default;
    const html = DOMPurify.sanitize(await marked(g.content));
    rendered = `
      <a href="/guias" class="inline-flex items-center gap-3 text-[10px] text-stone-500 hover:text-violet-400 font-rpg font-bold uppercase tracking-[0.3em] transition-all mb-12">← Volver</a>
      <div class="bg-[#11131A]/60 border border-white/5 rounded-[2.5rem] p-12 shadow-2xl">
        <h1 class="text-4xl font-bold text-white mb-6 font-rpg tracking-wider uppercase">${esc(g.title)}</h1>
        <div class="prose prose-invert max-w-none text-stone-300 leading-relaxed">${html}</div>
      </div>
    `;
  }

  const content = `<div class="max-w-6xl mx-auto px-4 md:px-0">${rendered}</div>`;
  const user = c.get("user");
  return c.html(publicLayout(g.title, content, user));
});

export default guias;