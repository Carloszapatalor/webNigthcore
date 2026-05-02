import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout, esc } from "../views/layout.ts";

// ─── Tipos (deben coincidir con admin/guias.ts) ───────────────────────────────

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
  gray:   "border-stone-600 text-stone-400 bg-stone-900/30",
  Gris:   "border-stone-600 text-stone-400 bg-stone-900/30",
  red:    "border-red-500 text-red-400 bg-red-950/20",
  Rojo:   "border-red-500 text-red-400 bg-red-950/20",
  green:  "border-emerald-500 text-emerald-400 bg-emerald-950/20",
  Verde:  "border-emerald-500 text-emerald-400 bg-emerald-950/20",
  yellow: "border-yellow-500 text-yellow-400 bg-yellow-950/20",
  Amarillo: "border-yellow-500 text-yellow-400 bg-yellow-950/20",
  gold:   "border-amber-500 text-amber-400 bg-amber-950/20",
  blue:   "border-blue-500 text-blue-400 bg-blue-950/20",
  Azul:   "border-blue-500 text-blue-400 bg-blue-950/20",
  purple: "border-purple-500 text-purple-400 bg-purple-950/20",
  Morado: "border-purple-500 text-purple-400 bg-purple-950/20",
  orange: "border-orange-500 text-orange-400 bg-orange-950/20",
  Naranja: "border-orange-500 text-orange-400 bg-orange-950/20",
  cyan:   "border-cyan-500 text-cyan-400 bg-cyan-950/20",
  Cian:   "border-cyan-500 text-cyan-400 bg-cyan-950/20",
};

export function renderGuide(title: string, data: GuideData, author: string, date: string): string {
  const statColorMap: Record<string, string> = {
    default: "text-stone-400",
    Gris:    "text-stone-400",
    red:     "text-red-400",
    Rojo:    "text-red-400",
    green:   "text-emerald-400",
    Verde:   "text-emerald-400",
    yellow:  "text-yellow-500",
    Amarillo: "text-yellow-500",
    blue:    "text-blue-400",
    Azul:    "text-blue-400",
    purple:  "text-purple-400",
    Morado:  "text-purple-400",
    orange:  "text-orange-400",
    Naranja: "text-orange-400",
    cyan:    "text-cyan-400",
    Cian:    "text-cyan-400",
  };

  const imageSrc = data.imageBase64 || data.imageUrl || "";
  const heroMedia = imageSrc
    ? `<div class="guide-hero-img shadow-2xl"><img src="${esc(imageSrc)}" alt="${esc(title)}" /></div>`
    : data.bossEmoji
      ? `<div class="guide-hero-img text-6xl shadow-2xl">${esc(data.bossEmoji)}</div>`
      : "";

  const badges = (data.badges ?? []).map(b => `
    <span class="guide-badge ${badgeColorMap[b.color] || badgeColorMap.gold}">
      ${esc(b.label)}
    </span>`).join("");

  const infoBox = data.infoBox ? `
    <div class="guide-box guide-box--info">${esc(data.infoBox)}</div>` : "";

  const statsGrid = (data.stats ?? []).length > 0 ? `
    <div class="guide-section">
      <div class="guide-section-header">📊 Estadísticas</div>
      <div class="guide-section-body">
        <div class="guide-stat-grid">
          ${data.stats.map(s => `
            <div class="guide-stat-card">
              <div class="guide-stat-label">${esc(s.label)}</div>
              <div class="guide-stat-value ${statColorMap[s.color] || ""}">${esc(s.value)}</div>
            </div>`).join("")}
        </div>
      </div>
    </div>` : "";

  const warningBox = data.warningBox ? `
    <div class="guide-box guide-box--warn">${esc(data.warningBox)}</div>` : "";

  const steps = (data.steps ?? []).length > 0 ? `
    <div class="guide-step-list">
      ${data.steps.map((s, i) => `
        <div class="guide-step">
          <div class="guide-step-num font-rpg">${i + 1}</div>
          <div class="guide-step-content">${esc(s.text)}</div>
        </div>`).join("")}
    </div>` : "";

  const estrategia = (data.warningBox || steps) ? `
    <div class="guide-section">
      <div class="guide-section-header">⚔️ Estrategia</div>
      <div class="guide-section-body">
        ${warningBox}
        ${steps}
      </div>
    </div>` : "";

  const dropsGrid = (data.drops ?? []).length > 0 ? `
    <div class="guide-section">
      <div class="guide-section-header">💰 Drops destacados</div>
      <div class="guide-section-body">
        <div class="guide-drop-grid">
          ${data.drops.map(d => `
            <div class="guide-drop-card ${d.rare ? "guide-drop-card--rare" : ""}">
              <div class="guide-drop-icon">${esc(d.icon)}</div>
              <div>
                <div class="guide-drop-name">${esc(d.name)}</div>
                ${d.rate ? `<div class="guide-drop-rate">${esc(d.rate)}</div>` : ""}
              </div>
            </div>`).join("")}
        </div>
      </div>
    </div>` : "";

  const tipBox = data.tipBox ? `
    <div class="guide-box guide-box--tip">${esc(data.tipBox)}</div>` : "";

  return `
    <style>
      :root {
        --g-bg:      #0c0a09;
        --g-surf:    #1c1917;
        --g-surf2:   #0c0a09;
        --g-border:  #44403c;
        --g-accent:  #eab308;
        --g-purple:  #a855f7;
        --g-danger:  #ef4444;
        --g-success: #22c55e;
        --g-text:    #d6d3d1;
        --g-muted:   #78716c;
      }

      .guide-hero {
        position: relative;
        background: linear-gradient(135deg, #1c1917 0%, #292524 100%);
        border: 1px solid rgba(234,179,8,0.2);
        border-radius: 24px;
        padding: 48px 40px;
        display: flex;
        align-items: center;
        gap: 40px;
        overflow: hidden;
        margin-bottom: 40px;
        box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
      }
      .guide-hero-img {
        flex-shrink:0;
        width:140px; height:140px;
        border-radius:50%;
        border:4px solid var(--g-accent);
        background:var(--g-surf2);
        display:flex; align-items:center; justify-content:center;
        position:relative; z-index:1;
        background: radial-gradient(circle, #292524 0%, #1c1917 100%);
      }
      .guide-hero-img img {
        width:100%; height:100%;
        object-fit:cover; border-radius:50%;
      }
      .guide-category {
        display:inline-block;
        background:rgba(234,179,8,0.1);
        color:var(--g-accent);
        border:1px solid rgba(234,179,8,0.3);
        border-radius:4px;
        font-size:10px;
        letter-spacing:3px;
        text-transform:uppercase;
        padding:4px 12px;
        margin-bottom:12px;
        font-family: 'Cinzel', serif;
      }
      .guide-title {
        font-size:42px; font-weight:700;
        color:white;
        line-height:1.1; margin-bottom:12px;
        font-family: 'Cinzel', serif;
        letter-spacing: 2px;
      }
      .guide-subtitle { color:var(--g-muted); font-size:15px; margin-bottom:20px; font-family: 'Merriweather', serif; font-style: italic; }
      .guide-badges { display:flex; gap:10px; flex-wrap:wrap; }
      .guide-badge {
        display:flex; align-items:center; gap:6px;
        border:1px solid currentColor;
        border-radius:20px;
        padding:5px 14px;
        font-size:11px; font-weight:700;
        font-family: 'Cinzel', serif;
        letter-spacing: 1px;
      }
      .guide-meta { color:var(--g-muted); font-size:13px; margin-bottom:32px; font-family: 'Cinzel', serif; letter-spacing: 1px; }

      .guide-box {
        border-radius:12px;
        padding:20px 24px;
        margin-bottom:24px;
        font-size:15px;
        line-height:1.7;
        background: rgba(28, 25, 23, 0.6);
        border: 1px solid rgba(234,179,8,0.1);
      }
      .guide-box--info { border-left:4px solid var(--g-purple); color:#d8b4fe; }
      .guide-box--warn { border-left:4px solid var(--g-danger); color:#fca5a5; }
      .guide-box--tip  { border-left:4px solid var(--g-success); color:#86efac; }

      .guide-section {
        background:rgba(28, 25, 23, 0.4);
        border:1px solid rgba(234,179,8,0.1);
        border-radius:20px;
        margin-bottom:32px;
        overflow:hidden;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);
      }
      .guide-section-header {
        padding:16px 24px;
        background:rgba(0,0,0,0.2);
        border-bottom:1px solid rgba(234,179,8,0.1);
        font-size:13px; font-weight:700;
        letter-spacing:2px; text-transform:uppercase;
        color:var(--g-accent);
        font-family: 'Cinzel', serif;
      }
      .guide-section-body { padding:24px; }

      .guide-stat-grid {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
        gap:12px;
      }
      .guide-stat-card {
        background:rgba(0,0,0,0.2);
        border:1px solid rgba(234,179,8,0.05);
        border-radius:12px;
        padding:16px;
        text-align:center;
        transition: all 0.3s;
      }
      .guide-stat-card:hover { border-color: rgba(234,179,8,0.3); background: rgba(0,0,0,0.3); }
      .guide-stat-label { font-size:10px; color:var(--g-muted); text-transform:uppercase; letter-spacing:2px; margin-bottom:6px; font-family: 'Cinzel', serif; }
      .guide-stat-value { font-size:22px; font-weight:700; font-family: 'Cinzel', serif; }

      .guide-step-list { display:flex; flex-direction:column; gap:16px; }
      .guide-step { display:flex; gap:16px; align-items:flex-start; }
      .guide-step-num {
        width:32px; height:32px; border-radius:8px;
        background:var(--g-accent); color:var(--g-bg);
        font-weight:700; font-size:14px; flex-shrink:0;
        display:flex; align-items:center; justify-content:center;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
      }
      .guide-step-content { padding-top:4px; font-size:15px; color:var(--g-text); }

      .guide-drop-grid {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(180px,1fr));
        gap:12px;
      }
      .guide-drop-card {
        background:rgba(0,0,0,0.2);
        border:1px solid rgba(234,179,8,0.05);
        border-radius:12px;
        padding:16px;
        display:flex; align-items:center; gap:14px;
        transition: all 0.3s;
      }
      .guide-drop-card:hover { border-color: rgba(234,179,8,0.2); }
      .guide-drop-card--rare { border-color:var(--g-accent); background:rgba(234,179,8,0.05); }
      .guide-drop-icon { font-size:28px; }
      .guide-drop-name { font-size:14px; font-weight:700; color:white; font-family: 'Cinzel', serif; }
      .guide-drop-rate { font-size:12px; color:var(--g-muted); }

      .guide-footer {
        text-align:center; color:var(--g-muted);
        font-size:11px; letter-spacing:3px;
        padding:40px 0 20px;
        text-transform: uppercase;
        font-family: 'Cinzel', serif;
      }
      .btn-back {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: var(--g-accent);
        font-family: 'Cinzel', serif;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 32px;
        transition: all 0.3s;
        opacity: 0.7;
      }
      .btn-back:hover { opacity: 1; transform: translateX(-4px); }
    </style>

    <a href="/guias" class="btn-back">← Volver a los Pergaminos</a>

    <!-- HERO -->
    <div class="guide-hero">
      ${heroMedia}
      <div class="guide-hero-text">
        <div class="guide-category">${esc(data.category || "Guía")}</div>
        <div class="guide-title">${esc(title)}</div>
        <div class="guide-subtitle">${esc(data.subtitle)}</div>
        <div class="guide-badges">${badges}</div>
      </div>
    </div>

    <p class="guide-meta">Escrito por <span class="text-stone-100">${esc(author)}</span> · ${esc(date)}</p>

    ${infoBox}
    ${statsGrid}
    ${estrategia}
    ${dropsGrid}
    ${tipBox}

    <div class="guide-footer">✦ Sabiduría del Clan Nightcore ✦</div>
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
      ? `<p class="text-stone-500 text-center py-20 italic">Aún no hay pergaminos escritos en esta biblioteca.</p>`
      : list.map((g) => {
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
          } catch { /* ... */ }

          const thumb = imgSrc
            ? `<img src="${esc(imgSrc)}" alt="${esc(g.title)}" class="w-20 h-20 rounded-2xl object-cover object-center border border-yellow-900/30 flex-shrink-0 shadow-xl" />`
            : `<div class="w-20 h-20 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-4xl flex-shrink-0 shadow-lg">${esc(emoji)}</div>`;

          const renderedBadges = badges.map(b => `
            <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold border ${badgeColorMap[b.color] || badgeColorMap.gold} font-rpg uppercase tracking-tighter">
              ${esc(b.label)}
            </span>`).join("");

          return `
            <a href="/guias/${esc(g.slug)}"
              class="flex flex-col sm:flex-row items-center gap-6 bg-stone-900/40 border border-yellow-900/10 rounded-2xl p-6 hover:border-yellow-600/50 transition group hover:-translate-y-1 hover:shadow-2xl hover:shadow-yellow-900/20 duration-300">
              ${thumb}
              <div class="flex-1 text-center sm:text-left">
                ${category ? `<p class="text-[10px] text-yellow-600 uppercase font-rpg tracking-[0.3em] mb-2">${esc(category)}</p>` : ""}
                <h3 class="font-bold text-white text-xl mb-2 group-hover:text-yellow-500 transition font-rpg uppercase tracking-wider">${esc(g.title)}</h3>
                <div class="flex flex-wrap justify-center sm:justify-start gap-2 mb-3">${renderedBadges}</div>
                <p class="text-stone-500 text-xs font-rpg uppercase tracking-widest">Escrito por ${esc(g.author)} · ${g.created_at.slice(0, 10)}</p>
              </div>
              <div class="text-yellow-600 opacity-0 group-hover:opacity-100 transition-all group-hover:translate-x-2 hidden sm:block">
                <span class="text-2xl">→</span>
              </div>
            </a>`;
        }).join("");

  const content = `
    <div class="max-w-4xl mx-auto">
      <div class="mb-16 text-center relative py-12">
        <h1 class="text-5xl font-bold text-white font-rpg tracking-[0.2em] uppercase drop-shadow-2xl">Biblioteca</h1>
        <p class="text-yellow-700 mt-4 font-rpg text-xs tracking-[0.4em] uppercase opacity-70">El conocimiento es el arma más poderosa del guerrero</p>
      </div>
      <div class="grid gap-6">${cards}</div>
    </div>
  `;

  const user = c.get("user");
  return c.html(publicLayout("Biblioteca de Guías", content, user));
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
      <a href="/guias" class="btn-back">← Volver a los Pergaminos</a>
      <div class="bg-stone-900/60 border border-yellow-900/20 rounded-3xl p-10 shadow-2xl">
        <h1 class="text-4xl font-bold text-white mb-4 font-rpg tracking-wider uppercase">${esc(g.title)}</h1>
        <p class="text-stone-500 text-xs mb-10 font-rpg uppercase tracking-widest">Escrito por ${esc(g.author)} · ${g.created_at.slice(0, 10)}</p>
        <div class="prose max-w-none text-stone-300 leading-relaxed">${html}</div>
      </div>
    `;
  }

  const content = `<div class="max-w-4xl mx-auto">${rendered}</div>`;
  const user = c.get("user");
  return c.html(publicLayout(g.title, content, user));
});

export default guias;