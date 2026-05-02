import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, publicLayout, esc } from "../../views/layout.ts";
import { renderGuide, type GuideData } from "../guias.ts";

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface StatField { label: string; value: string; color: string }
interface DropField { icon: string; name: string; rate: string; rare: boolean }
interface StepField { text: string }

// ─── Helpers de formulario ────────────────────────────────────────────────────

function badgesInputs(badges: { label: string; color: string }[]): string {
  const colorOptions = [
    { v: "gray", l: "Gris" }, { v: "red", l: "Rojo" }, { v: "green", l: "Verde" },
    { v: "yellow", l: "Amarillo" }, { v: "blue", l: "Azul" }, { v: "purple", l: "Morado" },
    { v: "orange", l: "Naranja" }, { v: "cyan", l: "Cian" }
  ];

  return Array.from({ length: 4 }, (_, i) => {
    const b = badges[i] ?? { label: "", color: "gold" };
    const isKeyBadge = i === 3;
    return `
      <div class="flex gap-3 items-center bg-black/30 p-3 rounded-xl border border-yellow-900/20">
        <div class="flex-1">
          <input name="badge_label_${i}" value="${esc(b.label)}" placeholder="${isKeyBadge ? "🔑 Tipo de llave..." : "💛 HP: 425"}"
            class="w-full bg-stone-950 border border-yellow-900/30 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none font-rpg uppercase tracking-wider" />
        </div>
        <select name="badge_color_${i}" class="bg-stone-900 border border-yellow-700/50 rounded-lg px-3 py-2 text-xs text-yellow-500 font-bold focus:border-yellow-500 focus:outline-none font-rpg uppercase transition-all shadow-sm cursor-pointer">
          ${colorOptions.map(c => `<option value="${c.v}" ${b.color === c.v ? "selected" : ""}>${c.l}</option>`).join("")}
        </select>
        ${isKeyBadge ? `<span class="text-[10px] text-yellow-500 uppercase font-bold w-12 font-rpg">Especial</span>` : ""}
      </div>`;
  }).join("");
}

function statsInputs(stats: StatField[]): string {
  const colorOptions = [
    { v: "default", l: "Gris" }, { v: "red", l: "Rojo" }, { v: "green", l: "Verde" },
    { v: "yellow", l: "Amarillo" }, { v: "blue", l: "Azul" }, { v: "purple", l: "Morado" }
  ];

  return Array.from({ length: 4 }, (_, i) => {
    const s = stats[i] ?? { label: "", value: "", color: "default" };
    return `
      <div class="grid grid-cols-3 gap-3 bg-black/30 p-3 rounded-xl border border-yellow-900/20">
        <input name="stat_label_${i}" value="${esc(s.label)}" placeholder="Ataque"
          class="bg-stone-950 border border-yellow-900/30 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none font-rpg uppercase tracking-wider" />
        <input name="stat_value_${i}" value="${esc(s.value)}" placeholder="99"
          class="bg-stone-950 border border-yellow-900/30 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none font-rpg tracking-wider" />
        <select name="stat_color_${i}" class="bg-stone-900 border border-yellow-700/50 rounded-lg px-3 py-2 text-xs text-yellow-500 font-bold focus:border-yellow-500 focus:outline-none font-rpg uppercase transition-all shadow-sm cursor-pointer">
          ${colorOptions.map(c => `<option value="${c.v}" ${s.color === c.v ? "selected" : ""}>${c.l}</option>`).join("")}
        </select>
      </div>`;
  }).join("");
}

function stepsInputs(steps: StepField[]): string {
  return Array.from({ length: 4 }, (_, i) => {
    const s = steps[i] ?? { text: "" };
    return `
      <div class="flex gap-3 items-center bg-black/30 p-3 rounded-xl border border-yellow-900/20">
        <span class="w-8 h-8 rounded bg-yellow-600 text-stone-950 text-xs font-bold flex items-center justify-center flex-shrink-0 font-rpg">${i + 1}</span>
        <input name="step_${i}" value="${esc(s.text)}" placeholder="Paso ${i + 1} del ritual..."
          class="flex-1 bg-stone-950 border border-yellow-900/30 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none font-rpg uppercase tracking-wider" />
      </div>`;
  }).join("");
}

function dropsInputs(drops: DropField[]): string {
  return Array.from({ length: 5 }, (_, i) => {
    const d = drops[i] ?? { icon: "", name: "", rate: "", rare: false };
    return `
      <div class="flex flex-col gap-1 w-full">
        ${i === 0 ? `
        <div class="flex gap-3 px-3 text-[11px] text-stone-400 font-bold font-rpg uppercase tracking-widest mb-1">
          <div class="w-12 text-center">Emoji</div>
          <div class="flex-1">Nombre del Objeto</div>
          <div class="w-16 text-center">Ratio</div>
          <div class="w-16"></div>
        </div>` : ""}
        <div class="flex gap-3 items-center bg-black/30 p-3 rounded-xl border border-yellow-900/20">
          <input name="drop_icon_${i}" value="${esc(d.icon)}" placeholder="💎"
            onfocus="this.placeholder=''" onblur="this.placeholder='💎'"
            class="w-12 bg-stone-950 border border-yellow-900/30 rounded-lg px-2 py-2 text-white text-center text-sm focus:border-yellow-500 focus:outline-none transition-all" title="Coloca un Emoji aquí" />
          
          <input name="drop_name_${i}" value="${esc(d.name)}" placeholder="Ej: Espada de Fuego"
            onfocus="this.placeholder=''" onblur="this.placeholder='Ej: Espada de Fuego'"
            class="flex-1 bg-stone-950 border border-yellow-900/30 rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-500 focus:outline-none font-rpg uppercase tracking-wider transition-all" title="Escribe el nombre del objeto" />
          
          <input name="drop_rate_${i}" value="${esc(d.rate)}" placeholder="1%"
            onfocus="this.placeholder=''" onblur="this.placeholder='1%'"
            class="w-16 bg-stone-950 border border-yellow-900/30 rounded-lg px-2 py-2 text-white text-sm text-center focus:border-yellow-500 focus:outline-none font-mono transition-all" title="Probabilidad de obtención" />
          
          <label class="flex items-center gap-2 text-xs text-stone-300 font-bold font-rpg uppercase cursor-pointer select-none group w-16">
            <input type="checkbox" name="drop_rare_${i}" value="1" ${d.rare ? "checked" : ""} 
              class="w-5 h-5 rounded border-stone-800 bg-stone-950 accent-yellow-500 cursor-pointer" />
            <span class="group-hover:text-yellow-500 transition">Raro</span>
          </label>
        </div>
      </div>`;
  }).join("");
}

// ─── Formulario principal ─────────────────────────────────────────────────────

function guideForm(title: string, data: GuideData | null, guideId: string | null): string {
  const action = guideId ? `/admin/guias/${guideId}/editar` : "/admin/guias/nueva";
  const d = data ?? {
    bossEmoji: "", imageUrl: "", imageBase64: "", category: "Guía de Boss", subtitle: "",
    badges: [], infoBox: "", stats: [], warningBox: "", steps: [], drops: [], tipBox: "",
  };

  const fieldClass = "w-full bg-stone-950 border border-yellow-900/30 rounded-xl px-4 py-3 text-white text-sm focus:border-yellow-500 focus:outline-none font-rpg uppercase tracking-wider placeholder:text-stone-600 transition-colors";
  const labelClass = "block text-xs text-stone-400 font-bold mb-2 uppercase tracking-widest font-rpg italic";
  const sectionClass = "bg-stone-900/60 border border-yellow-900/30 rounded-2xl p-8 space-y-6 shadow-xl relative overflow-hidden";

  return `
    <form method="POST" action="${action}" enctype="multipart/form-data" class="space-y-10 max-w-4xl">

      <!-- Datos generales -->
      <div class="${sectionClass}">
        <div class="absolute -right-10 -top-10 text-9xl opacity-[0.02] pointer-events-none">📜</div>
        <h3 class="text-xs font-bold text-yellow-600 font-rpg uppercase tracking-[0.3em] border-b border-yellow-900/10 pb-4 mb-6">📜 Inscripción del Pergamino</h3>
        
        <div>
          <label class="${labelClass}">Título de la guía *</label>
          <input name="title" required value="${esc(title)}" placeholder="ej: El despertar de la quimera" class="${fieldClass}" />
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label class="${labelClass}">Icono / Emoji</label>
            <input name="bossEmoji" value="${esc(d.bossEmoji)}" placeholder="👾" class="${fieldClass}" />
          </div>
          <div>
            <label class="${labelClass}">Categoría</label>
            <input name="category" value="${esc(d.category)}" placeholder="Combate Épico" class="${fieldClass}" />
          </div>
        </div>
        
        <div>
          <label class="${labelClass}">Subtítulo Místico</label>
          <input name="subtitle" value="${esc(d.subtitle)}" placeholder="Un relato sobre valor y estrategia..." class="${fieldClass}" />
        </div>

        <div class="bg-black/30 border border-yellow-900/20 rounded-2xl p-6 space-y-4">
          <p class="text-xs font-bold text-stone-300 font-rpg uppercase tracking-widest mb-4">🖼️ Imagen del Desafío</p>
          <div class="flex flex-col md:flex-row items-center gap-6">
            ${d.imageBase64 || d.imageUrl ? `
              <div class="relative group">
                <img src="${esc(d.imageBase64 || d.imageUrl)}" class="w-32 h-32 rounded-full object-cover border-4 border-yellow-600/50 shadow-2xl transition group-hover:scale-105" />
                <div class="absolute inset-0 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-xs text-white font-bold font-rpg uppercase">Actual</div>
              </div>` : `
              <div class="w-32 h-32 rounded-full bg-stone-950 border-2 border-dashed border-stone-700 flex items-center justify-center text-stone-500 text-xs font-rpg uppercase text-center p-4">Sin Imagen</div>`}
            
            <div class="flex-1 space-y-4 w-full">
              <input name="imageUrl" value="${esc(d.imageUrl)}" placeholder="URL del Espejo (imgur, discord...)" class="${fieldClass}" />
              <div class="relative">
                <input type="file" name="imageFile" accept="image/*" class="hidden" id="file-upload" />
                <label for="file-upload" class="flex items-center justify-center gap-2 bg-stone-900 border border-yellow-700/50 rounded-xl px-4 py-3 text-yellow-500 font-bold text-sm font-rpg uppercase tracking-widest cursor-pointer hover:bg-stone-800 transition shadow-sm">
                  <span>📁 Subir Pergamino Visual</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Badges -->
      <div class="${sectionClass}">
        <h3 class="text-xs font-bold text-yellow-600 font-rpg uppercase tracking-[0.3em] border-b border-yellow-900/10 pb-4">🏷️ Etiquetas de Poder</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${badgesInputs(d.badges)}
        </div>
      </div>

      <!-- Boxes -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div class="${sectionClass}">
          <h3 class="text-xs font-bold text-purple-400 font-rpg uppercase tracking-[0.3em] border-b border-purple-900/10 pb-4">📌 Sabiduría Inicial</h3>
          <textarea name="infoBox" rows="4" class="${fieldClass} resize-none" placeholder="Consejos antes de la batalla...">${esc(d.infoBox)}</textarea>
        </div>
        <div class="${sectionClass}">
          <h3 class="text-xs font-bold text-green-500 font-rpg uppercase tracking-[0.3em] border-b border-green-900/10 pb-4">🧠 El Consejo Final</h3>
          <textarea name="tipBox" rows="4" class="${fieldClass} resize-none" placeholder="Cómo asegurar la victoria...">${esc(d.tipBox)}</textarea>
        </div>
      </div>

      <!-- Stats -->
      <div class="${sectionClass}">
        <h3 class="text-xs font-bold text-yellow-600 font-rpg uppercase tracking-[0.3em] border-b border-yellow-900/10 pb-4">📊 Atributos del Destino</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${statsInputs(d.stats)}
        </div>
      </div>

      <!-- Estrategia -->
      <div class="${sectionClass}">
        <h3 class="text-xs font-bold text-red-500 font-rpg uppercase tracking-[0.3em] border-b border-red-900/10 pb-4">⚔️ El Camino a la Gloria</h3>
        <div class="mb-6">
          <label class="${labelClass}">Advertencia de Muerte</label>
          <textarea name="warningBox" rows="2" class="${fieldClass} resize-none border-red-900/20" placeholder="¡Cuidado con el golpe final!">${esc(d.warningBox)}</textarea>
        </div>
        <div class="space-y-4">
          <label class="${labelClass}">Pasos del Guerrero</label>
          ${stepsInputs(d.steps)}
        </div>
      </div>

      <!-- Drops -->
      <div class="${sectionClass}">
        <h3 class="text-xs font-bold text-yellow-600 font-rpg uppercase tracking-[0.3em] border-b border-yellow-900/10 pb-4">💰 Botín de Guerra</h3>
        <div class="space-y-4">
          ${dropsInputs(d.drops)}
        </div>
      </div>

      <!-- Acciones -->
      <div class="flex items-center justify-between bg-stone-900/80 border border-yellow-900/20 p-8 rounded-3xl sticky bottom-4 z-10 shadow-2xl backdrop-blur-md">
        <label class="flex items-center gap-3 cursor-pointer select-none group">
          <input type="checkbox" name="published" value="1" ${data?.published ? "checked" : ""}
            class="w-6 h-6 rounded border-stone-800 bg-stone-950 accent-yellow-600" />
          <span class="text-xs text-stone-400 font-rpg uppercase tracking-widest group-hover:text-stone-200 transition">Revelar a los Miembros</span>
        </label>
        <div class="flex gap-4">
          <a href="/admin/guias" class="text-[10px] text-stone-500 hover:text-white px-6 py-3 transition font-rpg uppercase tracking-widest">Retirada</a>
          <button type="submit"
            class="bg-yellow-700 hover:bg-yellow-600 text-stone-950 text-[11px] font-bold font-rpg uppercase tracking-widest px-10 py-3 rounded-xl transition shadow-xl active:scale-95">
            ${guideId ? "Sellar Pergamino" : "Escribir Pergamino"}
          </button>
        </div>
      </div>
    </form>
  `;
}

// ─── Parser + Rutas ────────────────────────────────────────────────────────────
// (El resto de la lógica de guardado se mantiene igual, solo actualizamos los tipos en el parser)

function parseGuideData(body: Record<string, string>, imageBase64?: string): GuideData {
  const badges = Array.from({ length: 4 }, (_, i) => ({
    label: body[`badge_label_${i}`] ?? "",
    color: body[`badge_color_${i}`] ?? "gold",
  })).filter(b => b.label.trim() !== "");

  const stats = Array.from({ length: 4 }, (_, i) => ({
    label: body[`stat_label_${i}`] ?? "",
    value: body[`stat_value_${i}`] ?? "",
    color: body[`stat_color_${i}`] ?? "default",
  })).filter(s => s.label.trim() !== "");

  const steps = Array.from({ length: 4 }, (_, i) => ({
    text: body[`step_${i}`] ?? "",
  })).filter(s => s.text.trim() !== "");

  const drops = Array.from({ length: 5 }, (_, i) => ({
    icon: body[`drop_icon_${i}`] ?? "",
    name: body[`drop_name_${i}`] ?? "",
    rate: body[`drop_rate_${i}`] ?? "",
    rare: body[`drop_rare_${i}`] === "1",
  })).filter(d => d.name.trim() !== "");

  return {
    bossEmoji: body.bossEmoji ?? "", imageUrl: body.imageUrl ?? "", imageBase64: imageBase64 ?? body.imageBase64 ?? "",
    category: body.category ?? "Guía de Boss", subtitle: body.subtitle ?? "", badges, infoBox: body.infoBox ?? "",
    stats, warningBox: body.warningBox ?? "", steps, drops, tipBox: body.tipBox ?? "",
  };
}

async function extractImageBase64(body: Record<string, string | File>): Promise<string> {
  const file = body["imageFile"];
  if (!file || typeof file === "string" || file.size === 0) return "";
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${file.type};base64,${btoa(binary)}`;
}

const adminGuias = new Hono();

adminGuias.get("/", async (c) => {
  const user = c.get("user");
  const db = getTursoClient();
  const sql = user.role === "escudero" 
    ? `SELECT id, title, published, author, created_at FROM guides WHERE author = ? ORDER BY created_at DESC`
    : `SELECT id, title, published, author, created_at FROM guides ORDER BY created_at DESC`;
  const args = user.role === "escudero" ? [user.username] : [];
  const result = await db.execute({ sql, args });
  type GuideRow = { id: string; title: string; published: number; author: string; created_at: string };
  const list = result.rows as unknown as GuideRow[];

  const rows = list.length === 0
    ? `<tr><td colspan="5" class="py-12 text-center text-stone-600 text-xs italic font-rpg uppercase tracking-widest">La biblioteca de guías está vacía</td></tr>`
    : list.map((g) => `
        <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition text-sm">
          <td class="py-4 px-6 font-bold text-stone-200">
            <a href="/admin/guias/${g.id}/preview" target="_blank" class="hover:text-yellow-500 transition flex items-center gap-2">
              <span>${esc(g.title)}</span>
              <span class="text-[10px] opacity-30">↗</span>
            </a>
          </td>
          <td class="py-4 px-6 text-stone-500 font-rpg text-[10px] uppercase tracking-widest">${esc(g.author)}</td>
          <td class="py-4 px-6">
            <span class="inline-block text-[9px] font-bold px-2 py-0.5 rounded border font-rpg uppercase tracking-widest ${g.published ? "border-green-800/50 text-green-400 bg-green-950/20" : "border-stone-700 text-stone-500 bg-stone-900/20"}">
              ${g.published ? "Publicada" : "Borrador"}
            </span>
          </td>
          <td class="py-4 px-6 text-stone-600 font-mono text-[10px]">${g.created_at.slice(0, 10)}</td>
          <td class="py-4 px-6 text-right">
            <div class="flex justify-end gap-4">
              <a href="/admin/guias/${g.id}/editar" class="text-[10px] font-rpg font-bold uppercase tracking-widest text-yellow-600 hover:text-yellow-500 transition">Editar</a>
              ${(user.role !== "escudero" || g.author === user.username) ? `
              <form method="POST" action="/admin/guias/${g.id}/borrar" class="inline" onsubmit="return confirm('¿Destruir este pergamino para siempre?')">
                <button type="submit" class="text-[10px] font-rpg font-bold uppercase tracking-widest text-red-400 hover:text-red-300 transition">Borrar</button>
              </form>` : ""}
            </div>
          </td>
        </tr>`).join("");

  const content = `
    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl">
      <div class="px-8 py-5 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
        <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500">📖 Biblioteca de Guías</h2>
        <a href="/admin/guias/nueva" class="text-[10px] bg-yellow-700 hover:bg-yellow-600 text-stone-950 px-4 py-2 rounded-lg transition font-rpg font-bold uppercase tracking-widest shadow-lg active:scale-95">+ Nuevo Pergamino</a>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Título</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Autor</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Estado</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Fecha</th>
            <th class="py-4 px-6"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Guías", content, user, "/admin/guias"));
});

adminGuias.get("/nueva", (c) => c.html(adminLayout("Nuevo Pergamino", guideForm("", null, null), c.get("user"), "/admin/guias")));

adminGuias.get("/:id/editar", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = getTursoClient();
  const result = await db.execute({ sql: `SELECT id, title, content, published, author FROM guides WHERE id = ?`, args: [id] });
  if (result.rows.length === 0) return c.notFound();
  const g = result.rows[0] as unknown as { id: string; title: string; content: string; published: number; author: string };
  
  if (user.role === "escudero" && g.author !== user.username) {
    return c.redirect("/admin/guias");
  }
  
  return c.html(adminLayout("Editar Pergamino", guideForm(g.title, JSON.parse(g.content), g.id), user, "/admin/guias"));
});

adminGuias.get("/:id/preview", async (c) => {
  const id = c.req.param("id");
  const db = getTursoClient();
  const result = await db.execute({ sql: `SELECT title, content, author, created_at FROM guides WHERE id = ?`, args: [id] });
  if (result.rows.length === 0) return c.notFound();
  const g = result.rows[0] as unknown as { title: string; content: string; author: string; created_at: string };
  const rendered = renderGuide(g.title, JSON.parse(g.content), g.author, g.created_at.slice(0, 10));
  return c.html(publicLayout(g.title, `<div class="max-w-4xl mx-auto">${rendered}</div>`));
});

adminGuias.post("/nueva", async (c) => {
  const body = await c.req.parseBody();
  const title = String(body.title ?? "").trim();
  const imageBase64 = await extractImageBase64(body as Record<string, string | File>);
  const data = parseGuideData(body as Record<string, string>, imageBase64);
  const db = getTursoClient();
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO guides (id, slug, title, content, published, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), toSlug(title), title, JSON.stringify(data), body.published === "1" ? 1 : 0, c.get("user").username, now, now],
  });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/editar", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.parseBody();
  
  const db = getTursoClient();
  const check = await db.execute({ sql: `SELECT author FROM guides WHERE id = ?`, args: [id] });
  if (check.rows.length === 0) return c.notFound();
  if (user.role === "escudero" && (check.rows[0] as any).author !== user.username) {
    return c.redirect("/admin/guias");
  }

  const title = String(body.title ?? "").trim();
  let imageBase64 = await extractImageBase64(body as Record<string, string | File>);
  if (!imageBase64) {
    const prev = await getTursoClient().execute({ sql: `SELECT content FROM guides WHERE id = ?`, args: [id] });
    imageBase64 = JSON.parse((prev.rows[0] as any).content).imageBase64 || "";
  }
  const data = parseGuideData(body as Record<string, string>, imageBase64);
  await getTursoClient().execute({
    sql: `UPDATE guides SET title = ?, slug = ?, content = ?, published = ?, updated_at = ? WHERE id = ?`,
    args: [title, toSlug(title), JSON.stringify(data), body.published === "1" ? 1 : 0, new Date().toISOString(), id],
  });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/borrar", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = getTursoClient();
  const check = await db.execute({ sql: `SELECT author FROM guides WHERE id = ?`, args: [id] });
  if (check.rows.length === 0) return c.notFound();
  if (user.role === "escudero" && (check.rows[0] as any).author !== user.username) {
    return c.redirect("/admin/guias");
  }
  await db.execute({ sql: `DELETE FROM guides WHERE id = ?`, args: [id] });
  return c.redirect("/admin/guias?ok=1");
});

export default adminGuias;