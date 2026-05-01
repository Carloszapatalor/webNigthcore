import { Hono } from "hono";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout, esc } from "../views/layout.ts";

// ─── Tipos (deben coincidir con admin/guias.ts) ───────────────────────────────

interface StatField   { label: string; value: string; color: "default" | "accent" | "danger" }
interface DropField   { icon: string; name: string; rate: string; rare: boolean }
interface StepField   { text: string }


interface GuideData {
  bossEmoji: string;
  imageUrl: string;
  imageBase64: string;
  category: string;
  subtitle: string;
  badges: { label: string; color: "gold" | "purple" | "red" | "green" }[];
  infoBox: string;
  stats: StatField[];
  warningBox: string;
  steps: StepField[];

  drops: DropField[];
  tipBox: string;
}

// ─── Renderer visual ──────────────────────────────────────────────────────────

function renderGuide(title: string, data: GuideData, author: string, date: string): string {
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

  const statColorMap: Record<string, string> = {
    gray:    "text-gray-400",
    default: "text-gray-400",
    red:     "text-red-400",
    danger:  "text-red-400",
    green:   "text-green-400",
    yellow:  "text-yellow-400",
    accent:  "text-yellow-400",
    blue:    "text-blue-400",
    purple:  "text-purple-400",
    orange:  "text-orange-400",
    cyan:    "text-cyan-400",
  };

  // HERO — prioridad: base64 > URL externa > emoji
  const imageSrc = data.imageBase64 || data.imageUrl || "";
  const heroMedia = imageSrc
    ? `<div class="guide-hero-img"><img src="${esc(imageSrc)}" alt="${esc(title)}" /></div>`
    : data.bossEmoji
      ? `<div class="guide-hero-img">${esc(data.bossEmoji)}</div>`
      : "";

  const badges = (data.badges ?? []).map(b => `
    <span class="guide-badge ${badgeColorMap[b.color] ?? badgeColorMap.gold}">
      ${esc(b.label)}
    </span>`).join("");

  // INFO BOX
  const infoBox = data.infoBox ? `
    <div class="guide-box guide-box--info">${esc(data.infoBox)}</div>` : "";

  // STATS
  const statsGrid = (data.stats ?? []).length > 0 ? `
    <div class="guide-section">
      <div class="guide-section-header">📊 Estadísticas</div>
      <div class="guide-section-body">
        <div class="guide-stat-grid">
          ${data.stats.map(s => `
            <div class="guide-stat-card">
              <div class="guide-stat-label">${esc(s.label)}</div>
              <div class="guide-stat-value ${statColorMap[s.color] ?? ""}">${esc(s.value)}</div>
            </div>`).join("")}
        </div>
      </div>
    </div>` : "";

  // ESTRATEGIA
  const warningBox = data.warningBox ? `
    <div class="guide-box guide-box--warn">${esc(data.warningBox)}</div>` : "";

  const steps = (data.steps ?? []).length > 0 ? `
    <div class="guide-step-list">
      ${data.steps.map((s, i) => `
        <div class="guide-step">
          <div class="guide-step-num">${i + 1}</div>
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

  // DROPS
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

  // TIP FINAL
  const tipBox = data.tipBox ? `
    <div class="guide-box guide-box--tip">${esc(data.tipBox)}</div>` : "";

  return `
    <style>
      /* ── Variables ── */
      :root {
        --g-bg:      #0f1117;
        --g-surf:    #181c27;
        --g-surf2:   #1e2335;
        --g-border:  #2e3555;
        --g-accent:  #c9a84c;
        --g-purple:  #7e57c2;
        --g-danger:  #e05c5c;
        --g-success: #4caf7e;
        --g-text:    #e8e8f0;
        --g-muted:   #8890b0;
        --g-glow:    rgba(201,168,76,0.18);
      }

      /* ── Hero ── */
      .guide-hero {
        position: relative;
        background: linear-gradient(135deg,#0a0d16 0%,#1a1030 50%,#0f1117 100%);
        border: 1px solid var(--g-border);
        border-bottom: 2px solid var(--g-accent);
        border-radius: 16px;
        padding: 36px 28px;
        display: flex;
        align-items: center;
        gap: 28px;
        overflow: hidden;
        margin-bottom: 24px;
      }
      .guide-hero::before {
        content:'';
        position:absolute;
        inset:0;
        background:radial-gradient(ellipse at 70% 50%,rgba(126,87,194,.15) 0%,transparent 65%);
        pointer-events:none;
      }
      .guide-hero-img {
        flex-shrink:0;
        width:110px; height:110px;
        border-radius:50%;
        border:3px solid var(--g-accent);
        background:var(--g-surf2);
        display:flex; align-items:center; justify-content:center;
        font-size:52px;
        box-shadow:0 0 28px var(--g-glow);
        position:relative; z-index:1;
      }
      .guide-hero-img img {
        width:100%; height:100%;
        object-fit:cover; border-radius:50%;
      }
      .guide-category {
        display:inline-block;
        background:rgba(126,87,194,.25);
        color:#b39ddb;
        border:1px solid var(--g-purple);
        border-radius:4px;
        font-size:11px;
        letter-spacing:2px;
        text-transform:uppercase;
        padding:3px 10px;
        margin-bottom:10px;
      }
      .guide-title {
        font-size:26px; font-weight:800;
        color:var(--g-accent);
        text-shadow:0 0 18px rgba(201,168,76,.4);
        line-height:1.2; margin-bottom:8px;
      }
      .guide-subtitle { color:var(--g-muted); font-size:13px; margin-bottom:14px; }
      .guide-badges { display:flex; gap:8px; flex-wrap:wrap; }
      .guide-badge {
        display:flex; align-items:center; gap:5px;
        background:var(--g-surf2);
        border:1px solid currentColor;
        border-radius:20px;
        padding:4px 12px;
        font-size:12px; font-weight:700;
      }
      .guide-meta { color:var(--g-muted); font-size:12px; margin-bottom:24px; }

      /* ── Info boxes ── */
      .guide-box {
        border-radius:0 8px 8px 0;
        padding:14px 16px;
        margin-bottom:16px;
        font-size:14px;
        line-height:1.6;
      }
      .guide-box--info { border-left:4px solid var(--g-purple); background:rgba(126,87,194,.1); color:#c5b8e8; }
      .guide-box--warn { border-left:4px solid var(--g-danger);  background:rgba(224,92,92,.1);  color:#f0a0a0; }
      .guide-box--tip  { border-left:4px solid var(--g-success); background:rgba(76,175,126,.1); color:#90dfb4; }

      /* ── Section ── */
      .guide-section {
        background:var(--g-surf);
        border:1px solid var(--g-border);
        border-radius:12px;
        margin-bottom:20px;
        overflow:hidden;
      }
      .guide-section-header {
        display:flex; align-items:center; gap:10px;
        padding:12px 18px;
        background:var(--g-surf2);
        border-bottom:1px solid var(--g-border);
        font-size:12px; font-weight:700;
        letter-spacing:1.5px; text-transform:uppercase;
        color:var(--g-accent);
      }
      .guide-section-body { padding:18px; }

      /* ── Stats ── */
      .guide-stat-grid {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
        gap:10px;
      }
      .guide-stat-card {
        background:var(--g-surf2);
        border:1px solid var(--g-border);
        border-radius:8px;
        padding:12px 14px;
        text-align:center;
      }
      .guide-stat-label { font-size:10px; color:var(--g-muted); text-transform:uppercase; letter-spacing:1px; margin-bottom:4px; }
      .guide-stat-value { font-size:20px; font-weight:700; }

      /* ── Steps ── */
      .guide-step-list { display:flex; flex-direction:column; gap:10px; margin-bottom:12px; }
      .guide-step { display:flex; gap:12px; align-items:flex-start; }
      .guide-step-num {
        width:28px; height:28px; border-radius:50%;
        background:var(--g-accent); color:#0f1117;
        font-weight:700; font-size:13px; flex-shrink:0;
        display:flex; align-items:center; justify-content:center;
      }
      .guide-step-content { padding-top:3px; font-size:14px; color:var(--g-text); }

      /* ── Bullets ── */
      .guide-bullet-list { list-style:none; display:flex; flex-direction:column; gap:8px; }
      .guide-bullet-item {
        display:flex; align-items:flex-start; gap:10px;
        padding:10px 13px;
        background:var(--g-surf2);
        border:1px solid var(--g-border);
        border-radius:8px; font-size:14px;
      }
      .guide-bullet-icon { font-size:16px; flex-shrink:0; margin-top:1px; }

      /* ── Divider ── */
      .guide-divider {
        height:1px;
        background:linear-gradient(90deg,transparent,var(--g-border),transparent);
        margin:16px 0;
      }

      /* ── Drops ── */
      .guide-drop-grid {
        display:grid;
        grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
        gap:10px;
      }
      .guide-drop-card {
        background:var(--g-surf2);
        border:1px solid var(--g-border);
        border-radius:8px;
        padding:12px 14px;
        display:flex; align-items:center; gap:10px;
      }
      .guide-drop-card--rare { border-color:var(--g-accent); background:rgba(201,168,76,.08); }
      .guide-drop-icon { font-size:22px; }
      .guide-drop-name { font-size:13px; font-weight:700; color:var(--g-text); }
      .guide-drop-rate { font-size:11px; color:var(--g-muted); }

      /* ── Footer ── */
      .guide-footer {
        text-align:center; color:var(--g-muted);
        font-size:12px; letter-spacing:1px;
        padding:20px 0 4px;
      }
    </style>

    <a href="/guias" class="text-purple-400 hover:text-purple-300 text-sm transition mb-6 inline-block">← Volver a guías</a>

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

    <p class="guide-meta">Por <strong>${esc(author)}</strong> · ${esc(date)}</p>

    ${infoBox}
    ${statsGrid}
    ${estrategia}
    ${dropsGrid}
    ${tipBox}

    <div class="guide-footer">✦ Clan Nightcore · Guías ✦</div>
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
      ? `<p class="text-gray-500 text-center py-16">Aún no hay guías publicadas.</p>`
      : list.map((g) => {
          let emoji = "📖";
          let category = "";
          let imgSrc = "";
          try {
            const d = JSON.parse(g.content) as { bossEmoji?: string; category?: string; imageUrl?: string; imageBase64?: string };
            if (d.bossEmoji) emoji = d.bossEmoji;
            if (d.category) category = d.category;
            imgSrc = d.imageBase64 || d.imageUrl || "";
          } catch { /* content antiguo */ }

          const thumb = imgSrc
            ? `<img src="${esc(imgSrc)}" alt="${esc(g.title)}" class="w-14 h-14 rounded-full object-cover object-center border border-gray-700 flex-shrink-0" />`
            : `<div class="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-3xl flex-shrink-0">${esc(emoji)}</div>`;

          return `
            <a href="/guias/${esc(g.slug)}"
              class="flex items-center gap-4 bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-purple-700 transition group">
              ${thumb}
              <div>
                ${category ? `<p class="text-xs text-purple-400 uppercase tracking-widest mb-1">${esc(category)}</p>` : ""}
                <h3 class="font-semibold text-white text-lg mb-1 group-hover:text-purple-300 transition">${esc(g.title)}</h3>
                <p class="text-gray-500 text-sm">Por ${esc(g.author)} · ${g.created_at.slice(0, 10)}</p>
              </div>
            </a>`;
        }).join("");

  const content = `
    <div class="mb-8">
      <h1 class="text-3xl font-bold">📖 Guías del Clan</h1>
      <p class="text-gray-400 mt-2">Estrategias, consejos y recursos para miembros de Nightcore</p>
    </div>
    <div class="grid gap-4">${cards}</div>
  `;

  return c.html(publicLayout("Guías", content));
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
    // Fallback: guías antiguas en Markdown plano (compatibilidad)
    const { marked } = await import("npm:marked");
    const DOMPurify = (await import("npm:isomorphic-dompurify")).default;
    const html = DOMPurify.sanitize(await marked(g.content));
    rendered = `
      <a href="/guias" class="text-purple-400 hover:text-purple-300 text-sm transition mb-6 inline-block">← Volver a guías</a>
      <h1 class="text-4xl font-bold text-white mb-2">${esc(g.title)}</h1>
      <p class="text-gray-500 text-sm mb-8">Por ${esc(g.author)} · ${g.created_at.slice(0, 10)}</p>
      <div class="prose bg-gray-900 rounded-xl border border-gray-800 p-8">${html}</div>
    `;
  }

  const content = `<div class="max-w-3xl mx-auto">${rendered}</div>`;
  return c.html(publicLayout(g.title, content));
});

export default guias;