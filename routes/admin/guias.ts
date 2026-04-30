import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";

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

interface StatField  { label: string; value: string; color: "default" | "accent" | "danger" }
interface DropField  { icon: string; name: string; rate: string; rare: boolean }
interface StepField  { text: string }
interface BulletField { icon: string; text: string }

interface GuideData {
  // Hero
  bossEmoji: string;
  imageUrl: string;       // URL externa
  imageBase64: string;    // base64 si subió archivo (data:image/...;base64,...)
  category: string;
  subtitle: string;
  // Badges rápidos
  badges: { label: string; color: "gold" | "purple" | "red" | "green" }[];
  // Info box intro
  infoBox: string;
  // Stats grid
  stats: StatField[];
  // Estrategia
  warningBox: string;
  steps: StepField[];
  bullets: BulletField[];
  // Drops
  drops: DropField[];
  // Tip final
  tipBox: string;
}

// ─── Helpers de formulario ────────────────────────────────────────────────────

function badgesInputs(badges: { label: string; color: string }[]): string {
  const rows = Array.from({ length: 4 }, (_, i) => {
    const b = badges[i] ?? { label: "", color: "gold" };
    return `
      <div class="flex gap-2 items-center">
        <input name="badge_label_${i}" value="${esc(b.label)}" placeholder="💛 HP: 425"
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <select name="badge_color_${i}" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none">
          ${["gold","purple","red","green"].map(c => `<option value="${c}" ${b.color===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>`;
  }).join("");
  return rows;
}

function statsInputs(stats: StatField[]): string {
  return Array.from({ length: 4 }, (_, i) => {
    const s = stats[i] ?? { label: "", value: "", color: "default" };
    return `
      <div class="grid grid-cols-3 gap-2">
        <input name="stat_label_${i}" value="${esc(s.label)}" placeholder="HP"
          class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <input name="stat_value_${i}" value="${esc(s.value)}" placeholder="425"
          class="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <select name="stat_color_${i}" class="bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm text-white focus:border-purple-500 focus:outline-none">
          ${["default","accent","danger"].map(c => `<option value="${c}" ${s.color===c?"selected":""}>${c}</option>`).join("")}
        </select>
      </div>`;
  }).join("");
}

function stepsInputs(steps: StepField[]): string {
  return Array.from({ length: 4 }, (_, i) => {
    const s = steps[i] ?? { text: "" };
    return `
      <div class="flex gap-2 items-center">
        <span class="w-6 h-6 rounded-full bg-yellow-600 text-black text-xs font-bold flex items-center justify-center flex-shrink-0">${i+1}</span>
        <input name="step_${i}" value="${esc(s.text)}" placeholder="Paso ${i+1}..."
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
      </div>`;
  }).join("");
}

function bulletsInputs(bullets: BulletField[]): string {
  return Array.from({ length: 4 }, (_, i) => {
    const b = bullets[i] ?? { icon: "", text: "" };
    return `
      <div class="flex gap-2 items-center">
        <input name="bullet_icon_${i}" value="${esc(b.icon)}" placeholder="✅"
          class="w-14 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:border-purple-500 focus:outline-none" />
        <input name="bullet_text_${i}" value="${esc(b.text)}" placeholder="Recomendación..."
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
      </div>`;
  }).join("");
}

function dropsInputs(drops: DropField[]): string {
  return Array.from({ length: 5 }, (_, i) => {
    const d = drops[i] ?? { icon: "", name: "", rate: "", rare: false };
    return `
      <div class="flex gap-2 items-center">
        <input name="drop_icon_${i}" value="${esc(d.icon)}" placeholder="💎"
          class="w-14 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm text-center focus:border-purple-500 focus:outline-none" />
        <input name="drop_name_${i}" value="${esc(d.name)}" placeholder="Nombre del drop"
          class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <input name="drop_rate_${i}" value="${esc(d.rate)}" placeholder="1%"
          class="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:border-purple-500 focus:outline-none" />
        <label class="flex items-center gap-1 text-xs text-gray-400 whitespace-nowrap">
          <input type="checkbox" name="drop_rare_${i}" value="1" ${d.rare?"checked":""} class="accent-yellow-500" /> Raro
        </label>
      </div>`;
  }).join("");
}

// ─── Formulario principal ─────────────────────────────────────────────────────

function guideForm(
  title: string,
  data: GuideData | null,
  guideId: string | null
): string {
  const action = guideId ? `/admin/guias/${guideId}/editar` : "/admin/guias/nueva";
  const d = data ?? {
    bossEmoji: "", category: "Guía de Boss", subtitle: "",
    badges: [], infoBox: "", stats: [], warningBox: "",
    steps: [], bullets: [], drops: [], tipBox: "",
  };

  const fieldClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:border-purple-500 focus:outline-none";
  const labelClass = "block text-xs text-gray-400 mb-1 uppercase tracking-wide";
  const sectionClass = "bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3";

  return `
    <form method="POST" action="${action}" enctype="multipart/form-data" class="space-y-6 max-w-3xl">

      <!-- Título + publicar -->
      <div class="${sectionClass}">
        <p class="text-sm font-semibold text-purple-400 border-b border-gray-800 pb-2">📝 Datos generales</p>
        <div>
          <label class="${labelClass}">Título de la guía *</label>
          <input name="title" required value="${esc(title)}" placeholder="ej: Guía de Medusa"
            class="${fieldClass}" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="${labelClass}">Emoji del boss (si no subes imagen)</label>
            <input name="bossEmoji" value="${esc(d.bossEmoji)}" placeholder="🐍"
              class="${fieldClass}" />
          </div>
          <div>
            <label class="${labelClass}">Categoría (tag)</label>
            <input name="category" value="${esc(d.category)}" placeholder="Guía de Boss"
              class="${fieldClass}" />
          </div>
        </div>
        <div>
          <label class="${labelClass}">Subtítulo / descripción corta</label>
          <input name="subtitle" value="${esc(d.subtitle)}" placeholder="Valle de los Dioses · Idle Clans · Guía completa"
            class="${fieldClass}" />
        </div>

        <!-- IMAGEN -->
        <div class="border border-gray-700 rounded-xl p-4 space-y-3 bg-gray-800/40">
          <p class="text-xs font-semibold text-gray-300 uppercase tracking-wide">🖼️ Imagen del boss</p>

          <!-- Preview actual -->
          ${d.imageBase64 || d.imageUrl ? `
            <div class="flex items-center gap-3">
              <img src="${esc(d.imageBase64 || d.imageUrl)}" alt="preview"
                class="w-20 h-20 rounded-full object-cover border-2 border-yellow-600" />
              <div class="text-xs text-gray-400">Imagen actual. Sube una nueva o cambia la URL para reemplazarla.</div>
            </div>` : `
            <div class="w-20 h-20 rounded-full bg-gray-700 border-2 border-dashed border-gray-600 flex items-center justify-center text-gray-500 text-xs text-center">
              Sin imagen
            </div>`}

          <!-- Opción A: URL externa -->
          <div>
            <label class="${labelClass}">Opción A — URL externa (imgur, Discord, etc.)</label>
            <input name="imageUrl" value="${esc(d.imageUrl)}" placeholder="https://i.imgur.com/..."
              class="${fieldClass}" />
          </div>

          <!-- Opción B: Upload -->
          <div>
            <label class="${labelClass}">Opción B — Subir archivo (JPG, PNG, WebP · máx 1 MB)</label>
            <input type="file" name="imageFile" accept="image/jpeg,image/png,image/webp,image/gif"
              class="w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:bg-purple-700 file:text-white file:text-xs file:cursor-pointer hover:file:bg-purple-600" />
            <p class="text-xs text-gray-600 mt-1">Si subes un archivo, tiene prioridad sobre la URL. El emoji se usa solo si no hay imagen.</p>
          </div>
        </div>
      </div>

      <!-- Badges -->
      <div class="${sectionClass}">
        <p class="text-sm font-semibold text-purple-400 border-b border-gray-800 pb-2">🏷️ Badges rápidos (hasta 4)</p>
        <p class="text-xs text-gray-500">Texto del badge (incluye emoji) + color</p>
        <div class="space-y-2">
          ${badgesInputs(d.badges)}
        </div>
      </div>

      <!-- Info box intro -->
      <div class="${sectionClass}">
        <p class="text-sm font-semibold text-purple-400 border-b border-gray-800 pb-2">📌 Caja de introducción (azul)</p>
        <textarea name="infoBox" rows="2" placeholder="📌 ¿Por qué este boss? Breve descripción motivadora..."
          class="${fieldClass} resize-none">${esc(d.infoBox)}</textarea>
      </div>

      <!-- Stats -->
      <div class="${sectionClass}">
        <p class="text-sm font-semibold text-purple-400 border-b border-gray-800 pb-2">📊 Estadísticas (hasta 4)</p>
        <p class="text-xs text-gray-500 mb-2">Label · Valor · Color (default/accent=dorado/danger=rojo)</p>
        <div class="space-y-2">
          ${statsInputs(d.stats)}
        </div>
      </div>

      <!-- Estrategia -->
      <div class="${sectionClass}">
        <p class="text-sm font-semibold text-purple-400 border-b border-gray-800 pb-2">⚔️ Estrategia</p>
        <div>
          <label class="${labelClass}">Advertencia (caja roja)</label>
          <textarea name="warningBox" rows="2" placeholder="⚠️ Advertencia importante antes de enfrentarlo..."
            class="${fieldClass} resize-none">${esc(d.warningBox)}</textarea>
        </div>
        <div>
          <label class="${labelClass}">Pasos numerados (hasta 4)</label>
          <div class="space-y-2 mt-1">${stepsInputs(d.steps)}</div>
        </div>
        <div>
          <label class="${labelClass}">Viñetas ✅/❌ (hasta 4)</label>
          <div class="space-y-2 mt-1">${bulletsInputs(d.bullets)}</div>
        </div>
      </div>

      <!-- Drops -->
      <div class="${sectionClass}">
        <p class="text-sm font-semibold text-purple-400 border-b border-gray-800 pb-2">💰 Drops destacados (hasta 5)</p>
        <p class="text-xs text-gray-500 mb-2">Emoji · Nombre · Tasa de drop · ¿Es raro? (borde dorado)</p>
        <div class="space-y-2">
          ${dropsInputs(d.drops)}
        </div>
      </div>

      <!-- Tip final -->
      <div class="${sectionClass}">
        <p class="text-sm font-semibold text-purple-400 border-b border-gray-800 pb-2">🧠 Consejo final (caja verde)</p>
        <textarea name="tipBox" rows="2" placeholder="🧠 Consejo final para el lector..."
          class="${fieldClass} resize-none">${esc(d.tipBox)}</textarea>
      </div>

      <!-- Acciones -->
      <div class="flex items-center justify-between pt-2">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" name="published" value="1"
            class="w-4 h-4 rounded border-gray-700 bg-gray-800 accent-purple-600" />
          <span class="text-sm text-gray-400">Publicar inmediatamente</span>
        </label>
        <div class="flex gap-3">
          <a href="/admin/guias" class="text-sm text-gray-500 hover:text-gray-300 px-4 py-2 transition">Cancelar</a>
          <button type="submit"
            class="bg-purple-600 hover:bg-purple-700 text-white text-sm px-6 py-2 rounded-lg transition">
            ${guideId ? "Guardar cambios" : "Crear guía"}
          </button>
        </div>
      </div>
    </form>
  `;
}

// ─── Parser del body del formulario → GuideData ───────────────────────────────

function parseGuideData(body: Record<string, string>, imageBase64?: string): GuideData {
  const badges = Array.from({ length: 4 }, (_, i) => ({
    label: body[`badge_label_${i}`] ?? "",
    color: (body[`badge_color_${i}`] ?? "gold") as "gold" | "purple" | "red" | "green",
  })).filter(b => b.label.trim() !== "");

  const stats = Array.from({ length: 4 }, (_, i) => ({
    label: body[`stat_label_${i}`] ?? "",
    value: body[`stat_value_${i}`] ?? "",
    color: (body[`stat_color_${i}`] ?? "default") as "default" | "accent" | "danger",
  })).filter(s => s.label.trim() !== "");

  const steps = Array.from({ length: 4 }, (_, i) => ({
    text: body[`step_${i}`] ?? "",
  })).filter(s => s.text.trim() !== "");

  const bullets = Array.from({ length: 4 }, (_, i) => ({
    icon: body[`bullet_icon_${i}`] ?? "",
    text: body[`bullet_text_${i}`] ?? "",
  })).filter(b => b.text.trim() !== "");

  const drops = Array.from({ length: 5 }, (_, i) => ({
    icon: body[`drop_icon_${i}`] ?? "",
    name: body[`drop_name_${i}`] ?? "",
    rate: body[`drop_rate_${i}`] ?? "",
    rare: body[`drop_rare_${i}`] === "1",
  })).filter(d => d.name.trim() !== "");

  return {
    bossEmoji: body.bossEmoji ?? "",
    imageUrl: body.imageUrl ?? "",
    imageBase64: imageBase64 ?? body.imageBase64 ?? "",
    category: body.category ?? "Guía de Boss",
    subtitle: body.subtitle ?? "",
    badges,
    infoBox: body.infoBox ?? "",
    stats,
    warningBox: body.warningBox ?? "",
    steps,
    bullets,
    drops,
    tipBox: body.tipBox ?? "",
  };
}

// ─── Helper: extrae base64 del file upload ────────────────────────────────────

async function extractImageBase64(body: Record<string, string | File>): Promise<string> {
  const file = body["imageFile"];
  if (!file || typeof file === "string" || file.size === 0) return "";
  if (file.size > 1.2 * 1024 * 1024) return ""; // ignora si > 1.2 MB
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const b64 = btoa(binary);
  return `data:${file.type};base64,${b64}`;
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

const adminGuias = new Hono();

adminGuias.get("/", async (c) => {
  const user = c.get("user");
  const db = getTursoClient();
  const result = await db.execute(
    `SELECT id, title, published, author, created_at FROM guides ORDER BY created_at DESC`
  );
  type GuideRow = { id: string; title: string; published: number; author: string; created_at: string };
  const list = result.rows as unknown as GuideRow[];

  const ok = c.req.query("ok");
  const error = c.req.query("error");

  const rows =
    list.length === 0
      ? `<tr><td colspan="5" class="py-8 text-center text-gray-600 text-sm">No hay guías aún</td></tr>`
      : list.map((g) => `
          <tr class="border-b border-gray-800 hover:bg-gray-800/40 text-sm">
            <td class="py-3 px-4 font-medium">${esc(g.title)}</td>
            <td class="py-3 px-4 text-gray-400">${esc(g.author)}</td>
            <td class="py-3 px-4">
              <span class="inline-block text-xs px-2 py-0.5 rounded-full ${g.published ? "bg-green-900/50 text-green-400" : "bg-gray-800 text-gray-500"}">
                ${g.published ? "Publicada" : "Borrador"}
              </span>
            </td>
            <td class="py-3 px-4 text-gray-500">${g.created_at.slice(0, 10)}</td>
            <td class="py-3 px-4">
              <div class="flex gap-4">
                <a href="/admin/guias/${g.id}/editar" class="text-purple-400 hover:text-purple-300 text-xs">Editar</a>
                ${g.published === 0
                  ? `<form method="POST" action="/admin/guias/${g.id}/publicar" class="inline">
                       <button type="submit" class="text-green-400 hover:text-green-300 text-xs">Publicar</button>
                     </form>`
                  : `<form method="POST" action="/admin/guias/${g.id}/despublicar" class="inline">
                       <button type="submit" class="text-yellow-400 hover:text-yellow-300 text-xs">Despublicar</button>
                     </form>`}
                <form method="POST" action="/admin/guias/${g.id}/borrar" class="inline"
                  onsubmit="return confirm('¿Eliminar esta guía permanentemente?')">
                  <button type="submit" class="text-red-400 hover:text-red-300 text-xs">Eliminar</button>
                </form>
              </div>
            </td>
          </tr>`).join("");

  const content = `
    ${ok ? `<div class="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">Operación realizada</div>` : ""}
    ${error ? `<div class="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">${esc(decodeURIComponent(error))}</div>` : ""}
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 class="font-semibold">Guías (${list.length})</h2>
        <a href="/admin/guias/nueva" class="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition">+ Nueva guía</a>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th class="py-3 px-4 text-left">Título</th>
            <th class="py-3 px-4 text-left">Autor</th>
            <th class="py-3 px-4 text-left">Estado</th>
            <th class="py-3 px-4 text-left">Fecha</th>
            <th class="py-3 px-4 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Guías", content, user));
});

adminGuias.get("/nueva", (c) => {
  const user = c.get("user");
  return c.html(adminLayout("Nueva guía", guideForm("", null, null), user));
});

adminGuias.get("/:id/editar", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const db = getTursoClient();
  const result = await db.execute({
    sql: `SELECT id, title, content, published FROM guides WHERE id = ?`,
    args: [id],
  });
  if (result.rows.length === 0) return c.notFound();
  type Row = { id: string; title: string; content: string; published: number };
  const g = result.rows[0] as unknown as Row;

  let data: GuideData | null = null;
  try { data = JSON.parse(g.content) as GuideData; } catch { data = null; }

  return c.html(adminLayout("Editar guía", guideForm(g.title, data, g.id), user));
});

adminGuias.post("/nueva", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody() as Record<string, string | File>;
  const title = ((body.title as string) ?? "").trim();
  const published = body.published === "1" ? 1 : 0;

  if (!title) return c.redirect("/admin/guias?error=T%C3%ADtulo+requerido");

  const imageBase64 = await extractImageBase64(body);
  const data = parseGuideData(body as Record<string, string>, imageBase64);
  const content = JSON.stringify(data);

  const db = getTursoClient();
  const id = crypto.randomUUID();
  const slug = toSlug(title);
  const now = new Date().toISOString();

  try {
    await db.execute({
      sql: `INSERT INTO guides (id, slug, title, content, published, author, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, slug, title, content, published, user.username, now, now],
    });
  } catch (e) {
    const msg = (e as Error).message.includes("UNIQUE")
      ? "Ya+existe+una+gu%C3%ADa+con+ese+t%C3%ADtulo"
      : encodeURIComponent((e as Error).message);
    return c.redirect(`/admin/guias?error=${msg}`);
  }

  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/editar", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.parseBody() as Record<string, string | File>;
  const title = ((body.title as string) ?? "").trim();
  const published = body.published === "1" ? 1 : 0;

  if (!title) return c.redirect("/admin/guias?error=T%C3%ADtulo+requerido");

  // Si no sube archivo nuevo, conservar el base64 que ya estaba guardado
  let imageBase64 = await extractImageBase64(body);
  if (!imageBase64) {
    const db2 = getTursoClient();
    const prev = await db2.execute({ sql: `SELECT content FROM guides WHERE id = ?`, args: [id] });
    if (prev.rows.length > 0) {
      try {
        const prevData = JSON.parse((prev.rows[0] as unknown as { content: string }).content) as { imageBase64?: string };
        imageBase64 = prevData.imageBase64 ?? "";
      } catch { imageBase64 = ""; }
    }
  }

  const data = parseGuideData(body as Record<string, string>, imageBase64);
  const content = JSON.stringify(data);

  const db = getTursoClient();
  const slug = toSlug(title);
  const now = new Date().toISOString();

  await db.execute({
    sql: `UPDATE guides SET title = ?, slug = ?, content = ?, published = ?, updated_at = ? WHERE id = ?`,
    args: [title, slug, content, published, now, id],
  });

  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/publicar", async (c) => {
  const id = c.req.param("id");
  const db = getTursoClient();
  await db.execute({ sql: `UPDATE guides SET published = 1, updated_at = ? WHERE id = ?`, args: [new Date().toISOString(), id] });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/despublicar", async (c) => {
  const id = c.req.param("id");
  const db = getTursoClient();
  await db.execute({ sql: `UPDATE guides SET published = 0, updated_at = ? WHERE id = ?`, args: [new Date().toISOString(), id] });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/borrar", async (c) => {
  const id = c.req.param("id");
  const db = getTursoClient();
  await db.execute({ sql: `DELETE FROM guides WHERE id = ?`, args: [id] });
  return c.redirect("/admin/guias?ok=1");
});

export default adminGuias;