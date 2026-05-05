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

interface StatField { label: string; value: string; color: string; emoji?: string }
interface DropField { icon: string; name: string; rate: string; rare: boolean }
interface StepField { text: string }

// ─── Iconos RPG ───────────────────────────────────────────────────────────────

const RPG_ICONS = [
  { icon: "📜", label: "Pergamino" },
  { icon: "⚔️", label: "Daño / Ataque" },
  { icon: "🛡️", label: "Resistencia" },
  { icon: "❤️", label: "Vida / HP" },
  { icon: "⚡", label: "Velocidad" },
  { icon: "🔥", label: "Fuego / Magia" },
  { icon: "🪄", label: "Hechizo" },
  { icon: "➕", label: "Curación" },
  { icon: "🧪", label: "Poción" },
  { icon: "💎", label: "Recurso" },
  { icon: "🪙", label: "Moneda" },
  { icon: "📦", label: "Cofre" },
  { icon: "🔑", label: "Llave" },
  { icon: "🏹", label: "Rango / Arco" },
  { icon: "👑", label: "Jefe / Boss" },
  { icon: "👾", label: "Monstruo" },
  { icon: "📊", label: "Estadísticas" },
  { icon: "✨", label: "Especial" },
  { icon: "👤", label: "Usuario" },
  { icon: "👥", label: "Equipo" },
  { icon: "🎯", label: "Objetivo" },
  { icon: "📖", label: "Libro" },
  { icon: "🏆", label: "Logro" },
  { icon: "🔔", label: "Aviso" },
];

// ─── Helpers de formulario ────────────────────────────────────────────────────

function iconSelector(name: string, selectedIcon: string): string {
  const id = `emoji-${name}-${Math.random().toString(36).slice(2, 8)}`;
  return `
    <div class="relative">
      <input type="text" name="${name}" value="${esc(selectedIcon)}" 
        placeholder="📜" maxlength="2" id="${id}"
        class="emoji-input w-full bg-[#0B0D13] border border-white/10 rounded-xl px-4 py-3 text-center text-xl focus:border-violet-500 focus:outline-none transition-all duration-300"
        onfocus="showEmojiDropdown('${id}')" 
        oninput="hideEmojiDropdown('${id}')" 
        onblur="setTimeout(() => hideEmojiDropdown('${id}'), 200)" />
    </div>
    <div id="${id}-dropdown" class="hidden fixed bg-[#0B0D13] border border-white/10 rounded-xl max-h-48 overflow-y-auto z-[9999] emoji-dropdown" style="width: 200px;">
      ${RPG_ICONS.map(i => `<div class="px-4 py-2 hover:bg-white/10 cursor-pointer flex items-center gap-3" onclick="selectEmoji('${id}', '${i.icon}')">${i.icon} <span class="text-stone-500 text-sm">${i.label}</span></div>`).join("")}
    </div>
  `;
}

function badgesInputs(badges: { label: string; color: string }[]): string {
  const colorOptions = [
    { v: "gray", l: "Gris" }, { v: "red", l: "Rojo" }, { v: "green", l: "Verde" },
    { v: "yellow", l: "Oro" }, { v: "blue", l: "Cian" }, { v: "purple", l: "Violeta" },
    { v: "orange", l: "Naranja" }, { v: "cyan", l: "Cian" }
  ];

  return Array.from({ length: 4 }, (_, i) => {
    const b = badges[i] ?? { label: "", color: "yellow" };
    return `
      <div class="flex gap-3 items-center bg-black/40 p-4 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
        <div class="flex-1">
          <input name="badge_label_${i}" value="${esc(b.label)}" placeholder="${i === 3 ? "🔑 Llave requerida..." : "💛 HP: 425"}"
            class="w-full bg-[#0B0D13] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-wider" />
        </div>
        <select name="badge_color_${i}" class="bg-[#0B0D13] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-violet-400 font-bold focus:border-violet-500 focus:outline-none font-rpg uppercase cursor-pointer">
          ${colorOptions.map(c => `<option value="${c.v}" ${b.color === c.v ? "selected" : ""}>${c.l}</option>`).join("")}
        </select>
      </div>`;
  }).join("");
}

function statsInputs(stats: StatField[]): string {
  const colorOptions = [
    { v: "default", l: "Gris" }, { v: "red", l: "Rojo" }, { v: "green", l: "Verde" },
    { v: "yellow", l: "Amarillo" }, { v: "blue", l: "Azul" }, { v: "purple", l: "Morado" }
  ];

  const statEmojis = [
    { icon: "❤️", label: "HP" }, { icon: "⚔️", label: "Daño" }, { icon: "🛡️", label: "Defensa" },
    { icon: "⚡", label: "Velocidad" }, { icon: "🪄", label: "Magia" }, { icon: "🔥", label: "Fuego" },
    { icon: "💎", label: "Recurso" }, { icon: "🪙", label: "Oro" }, { icon: "📊", label: "Stat" }, { icon: "✨", label: "Especial" }
  ];

  return Array.from({ length: 4 }, (_, i) => {
    const s = stats[i] ?? { label: "", value: "", color: "default", emoji: "" };
    const id = `stat-emoji-${i}-${Math.random().toString(36).slice(2, 8)}`;
    return `
      <div class="grid grid-cols-4 gap-3 bg-black/40 p-4 rounded-2xl border border-white/5">
        <div class="relative">
          <input type="text" name="stat_emoji_${i}" value="${esc(s.emoji ?? '')}" 
            placeholder="📊" maxlength="2" id="${id}"
            class="emoji-input w-full bg-[#0B0D13] border border-white/10 rounded-xl px-2 py-2.5 text-center text-lg focus:border-violet-500 focus:outline-none"
            onfocus="showEmojiDropdown('${id}')" 
            oninput="hideEmojiDropdown('${id}')"
            onblur="setTimeout(() => hideEmojiDropdown('${id}'), 200)" />
        </div>
        <input name="stat_label_${i}" value="${esc(s.label)}" placeholder="Ataque"
          class="bg-[#0B0D13] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none font-rpg uppercase tracking-wider" />
        <input name="stat_value_${i}" value="${esc(s.value)}" placeholder="99"
          class="bg-[#0B0D13] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none font-rpg tracking-wider" />
        <select name="stat_color_${i}" class="bg-[#0B0D13] border border-white/10 rounded-xl px-2 py-2.5 text-xs text-violet-400 font-bold focus:border-violet-500 focus:outline-none font-rpg uppercase cursor-pointer">
          ${colorOptions.map(c => `<option value="${c.v}" ${s.color === c.v ? "selected" : ""}>${c.l}</option>`).join("")}
        </select>
      </div>
      <div id="${id}-dropdown" class="hidden fixed bg-[#0B0D13] border border-white/10 rounded-xl max-h-32 overflow-y-auto z-[9999] emoji-dropdown" style="width: 100px;">
        ${statEmojis.map(e => `<div class="px-3 py-1.5 hover:bg-white/10 cursor-pointer flex items-center justify-center text-sm" onclick="selectEmoji('${id}', '${e.icon}')">${e.icon}</div>`).join("")}
      </div>`;
  }).join("");
}

function stepsInputs(steps: StepField[]): string {
  return Array.from({ length: 4 }, (_, i) => {
    const s = steps[i] ?? { text: "" };
    return `
      <div class="flex gap-4 items-center bg-black/40 p-4 rounded-2xl border border-white/5">
        <span class="w-8 h-8 rounded-lg bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0 font-rpg shadow-[0_0_10px_rgba(139,92,246,0.4)]">${i + 1}</span>
        <input name="step_${i}" value="${esc(s.text)}" placeholder="Procedimiento de combate..."
          class="flex-1 bg-[#0B0D13] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-violet-500 focus:outline-none font-subtitle tracking-wider" />
      </div>`;
  }).join("");
}

function dropsInputs(drops: DropField[]): string {
  return Array.from({ length: 5 }, (_, i) => {
    const d = drops[i] ?? { icon: "", name: "", rate: "", rare: false };
    return `
      <div class="flex flex-col gap-1 w-full">
        ${i === 0 ? `
        <div class="flex gap-4 px-4 text-[9px] text-stone-600 font-bold font-rpg uppercase tracking-[0.3em] mb-1">
          <div class="w-14 text-center">Icono</div>
          <div class="flex-1">Tesoro / Objeto</div>
          <div class="w-20 text-center">Drop Rate</div>
          <div class="w-20 text-center">Calidad</div>
        </div>` : ""}
        <div class="flex gap-4 items-center bg-black/40 p-4 rounded-2xl border border-white/5 group hover:border-white/10 transition-all">
          <div class="w-14">
            ${iconSelector(`drop_icon_${i}`, d.icon || "📦")}
          </div>
          <input name="drop_name_${i}" value="${esc(d.name)}" placeholder="Nombre del Botín"
            class="flex-1 bg-[#0B0D13] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-violet-500 focus:outline-none font-subtitle uppercase tracking-wider transition-all" />
          
          <input name="drop_rate_${i}" value="${esc(d.rate)}" placeholder="1.0%"
            class="w-20 bg-[#0B0D13] border border-white/10 rounded-xl px-2 py-3 text-white text-xs text-center focus:border-violet-500 focus:outline-none font-mono transition-all" />
          
          <label class="flex items-center justify-center gap-2 text-[10px] text-stone-500 font-bold font-rpg uppercase cursor-pointer select-none group w-20">
            <input type="checkbox" name="drop_rare_${i}" value="1" ${d.rare ? "checked" : ""} 
              class="w-4 h-4 rounded border-stone-800 bg-[#0B0D13] accent-violet-600 cursor-pointer" />
            <span class="group-hover:text-violet-400 transition">Épico</span>
          </label>
        </div>
      </div>`;
  }).join("");
}

// ─── Formulario principal ─────────────────────────────────────────────────────

function guideForm(title: string, data: GuideData | null, guideId: string | null, userRole: string = "escudero"): string {
  const action = guideId ? `/admin/guias/${guideId}/editar` : "/admin/guias/nueva";
  const isSuperadmin = userRole === "superadmin";
  const d = data ?? {
    bossEmoji: "📜", imageUrl: "", imageBase64: "", category: "Guía de Boss", subtitle: "",
    badges: [], infoBox: "", stats: [], warningBox: "", steps: [], drops: [], tipBox: "",
  };

  const fieldClass = "w-full bg-[#0B0D13] border border-white/10 rounded-2xl px-5 py-4 text-white text-sm focus:border-violet-500 focus:outline-none font-subtitle tracking-wider placeholder:text-stone-700 transition-all duration-300";
  const labelClass = "block text-[10px] text-stone-500 font-bold mb-3 uppercase tracking-[0.3em] font-rpg";
  const sectionClass = "bg-[#11131A]/40 border border-white/5 rounded-[2.5rem] p-10 space-y-8 shadow-2xl relative overflow-hidden";

  return `
    <form method="POST" action="${action}" enctype="multipart/form-data" class="space-y-12 max-w-5xl">

      <!-- Datos generales -->
      <div class="${sectionClass}">
        <div class="absolute -right-16 -top-16 text-[15rem] opacity-[0.02] pointer-events-none rotate-12">📜</div>
        <div class="flex items-center gap-4 mb-8">
           <div class="w-1.5 h-8 bg-violet-600 rounded-full"></div>
           <h3 class="text-lg font-bold text-white font-rpg uppercase tracking-[0.3em]">Inscripción del Pergamino</h3>
        </div>
        
        <div class="space-y-6">
          <div>
            <label class="${labelClass}">Título del Pergamino *</label>
            <input name="title" required value="${esc(title)}" placeholder="Nombre de la guía..." class="${fieldClass} font-rpg text-lg tracking-widest uppercase" />
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <label class="${labelClass}">Iconografía Principal</label>
              ${iconSelector("bossEmoji", d.bossEmoji)}
            </div>
            <div>
              <label class="${labelClass}">Categoría</label>
              <input name="category" value="${esc(d.category)}" placeholder="Guía de Boss" class="${fieldClass}" />
            </div>
          </div>
          
          <div>
            <label class="${labelClass}">Subtítulo</label>
            <input name="subtitle" value="${esc(d.subtitle)}" placeholder="Breve descripción del desafío..." class="${fieldClass}" />
          </div>

          <div class="bg-black/20 border border-white/5 rounded-[2rem] p-8 space-y-6">
            <p class="text-[10px] font-bold text-stone-400 font-rpg uppercase tracking-[0.2em] mb-4">🖼️ Imagen</p>
            <div class="flex flex-col md:flex-row items-center gap-10">
              <div id="image-preview-container" class="relative group">
                <div class="absolute -inset-2 bg-violet-600/20 blur-xl rounded-full animate-pulse hidden" id="image-preview-glow"></div>
                <img id="image-preview" src="${esc(d.imageBase64 || d.imageUrl)}" class="${d.imageBase64 || d.imageUrl ? 'w-40 h-40 rounded-[2rem] object-contain bg-[#0B0D13] border-2 border-violet-500/30 shadow-2xl relative z-10 transition group-hover:scale-105' : 'hidden w-40 h-40 rounded-[2rem] object-contain bg-[#0B0D13] border-2 border-violet-500/30 shadow-2xl relative z-10'}" />
                <div id="image-placeholder" class="w-40 h-40 rounded-[2rem] bg-[#0B0D13] border-2 border-dashed border-stone-800 flex items-center justify-center text-stone-600 text-[10px] font-rpg uppercase text-center p-8 tracking-widest ${d.imageBase64 || d.imageUrl ? 'hidden' : ''}">Sin Imagen</div>
              </div>
              
              <div class="flex-1 space-y-4 w-full">
                <div>
                  <label class="text-[9px] text-stone-600 font-bold font-rpg uppercase tracking-widest mb-2 block">Vínculo Externo (URL)</label>
                  <input name="imageUrl" id="image-url" value="${esc(d.imageUrl)}" placeholder="https://..." class="${fieldClass}" oninput="updateImagePreview()" />
                </div>
                <div class="relative">
                  <input type="file" name="imageFile" accept="image/*" class="hidden" id="file-upload" onchange="handleImageUpload(this)" />
                  <label for="file-upload" class="flex items-center justify-center gap-3 bg-violet-600/10 border border-violet-500/30 rounded-2xl px-6 py-4 text-violet-400 font-bold text-[10px] font-rpg uppercase tracking-[0.2em] cursor-pointer hover:bg-violet-600/20 transition shadow-xl active:scale-95 w-full">
                    <span>📁 Subir Imagen</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Badges -->
      <div class="${sectionClass}">
        <div class="flex items-center gap-4 mb-8">
           <div class="w-1.5 h-8 bg-cyan-600 rounded-full"></div>
           <h3 class="text-lg font-bold text-white font-rpg uppercase tracking-[0.3em]">Etiquetas</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${badgesInputs(d.badges)}
        </div>
      </div>

      <!-- Boxes -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
        <div class="${sectionClass}">
          <h3 class="text-xs font-bold text-violet-400 font-rpg uppercase tracking-[0.3em] mb-6">📌 Sabiduría Inicial</h3>
          <textarea name="infoBox" rows="5" class="${fieldClass} resize-none" placeholder="Consejos antes de la batalla...">${esc(d.infoBox)}</textarea>
        </div>
        <div class="${sectionClass}">
          <h3 class="text-xs font-bold text-green-500 font-rpg uppercase tracking-[0.3em] mb-6">🧠 Consejo Final</h3>
          <textarea name="tipBox" rows="5" class="${fieldClass} resize-none" placeholder="Técnicas avanzadas...">${esc(d.tipBox)}</textarea>
        </div>
      </div>

      <!-- Stats -->
      <div class="${sectionClass}">
        <div class="flex items-center gap-4 mb-8">
           <div class="w-1.5 h-8 bg-orange-600 rounded-full"></div>
           <h3 class="text-lg font-bold text-white font-rpg uppercase tracking-[0.3em]">Análisis de Atributos</h3>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          ${statsInputs(d.stats)}
        </div>
      </div>

      <!-- Estrategia -->
      <div class="${sectionClass}">
        <h3 class="text-xs font-bold text-red-500 font-rpg uppercase tracking-[0.3em] mb-8">⚔️ Estrategia</h3>
        <div class="mb-10">
          <label class="${labelClass}">Advertencia</label>
          <textarea name="warningBox" rows="3" class="${fieldClass} resize-none border-red-900/30 bg-red-950/10 text-red-200" placeholder="¡Zona de alto riesgo!">${esc(d.warningBox)}</textarea>
        </div>
        <div class="space-y-6">
          <label class="${labelClass}">Pasos</label>
          ${stepsInputs(d.steps)}
        </div>
      </div>

      <!-- Drops -->
      <div class="${sectionClass}">
        <h3 class="text-xs font-bold text-yellow-500 font-rpg uppercase tracking-[0.3em] mb-8">💰 Drops destacados</h3>
        <div class="space-y-6">
          ${dropsInputs(d.drops)}
        </div>
      </div>

      <!-- Acciones -->
      <div class="flex flex-col md:flex-row items-center justify-end bg-[#11131A]/80 border border-white/5 p-10 rounded-[3rem] mt-10">
        <input type="hidden" name="action" value="save" />
        
        <div class="flex gap-4 flex-wrap">
          <a href="/admin/guias" class="text-center text-[10px] text-stone-500 hover:text-white px-8 py-4 transition font-rpg uppercase tracking-[0.2em] font-bold">Cancelar</a>
          ${guideId ? `<a href="/admin/guias/${guideId}/preview" target="_blank" class="text-center text-[10px] text-violet-400 hover:text-violet-300 px-8 py-4 transition font-rpg uppercase tracking-[0.2em] font-bold border border-violet-500/30 rounded-2xl">Visualizar</a>` : `<a href="#" onclick="previewNewGuide()" class="text-center text-[10px] text-violet-400 hover:text-violet-300 px-8 py-4 transition font-rpg uppercase tracking-[0.2em] font-bold border border-violet-500/30 rounded-2xl">Visualizar</a>`}
          <button type="submit" name="action" value="save" class="text-center text-[10px] text-yellow-400 hover:text-yellow-300 px-6 py-3 rounded-xl font-bold font-rpg uppercase tracking-[0.2em] shadow-xl active:scale-95 border border-yellow-500/30">
            ${guideId ? "Actualizar" : "Sellar Pergamino"}
          </button>
          ${isSuperadmin ? `
          <button type="submit" name="action" value="publish" class="text-center text-[10px] text-green-400 hover:text-green-300 px-6 py-3 rounded-xl font-bold font-rpg uppercase tracking-[0.2em] shadow-xl active:scale-95 border border-green-500/30">
            ${guideId ? "Publicar Cambios" : "Publicar"}
          </button>` : ""}
        </div>
      </div>
    </form>
    <script>
function showEmojiDropdown(id) {
  const input = document.getElementById(id);
  const dropdown = document.getElementById(id + '-dropdown');
  if (!input || !dropdown) return;
  const rect = input.getBoundingClientRect();
  dropdown.style.left = rect.left + 'px';
  dropdown.style.top = (rect.bottom + 4) + 'px';
  dropdown.classList.remove('hidden');
}
function hideEmojiDropdown(id) {
  const dropdown = document.getElementById(id + '-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}
function selectEmoji(id, emoji) {
  const input = document.getElementById(id);
  if (input) {
    input.value = emoji;
    input.focus();
  }
  hideEmojiDropdown(id);
}
function updateImagePreview() {
  const urlInput = document.getElementById('image-url');
  const previewImg = document.getElementById('image-preview');
  const previewGlow = document.getElementById('image-preview-glow');
  const placeholder = document.getElementById('image-placeholder');
  if (!urlInput || !previewImg) return;
  const url = urlInput.value.trim();
  if (url) {
    previewImg.src = url;
    previewImg.classList.remove('hidden');
    if (previewGlow) previewGlow.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    previewImg.classList.add('hidden');
    if (previewGlow) previewGlow.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }
}
function handleImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const previewImg = document.getElementById('image-preview');
    const previewGlow = document.getElementById('image-preview-glow');
    const placeholder = document.getElementById('image-placeholder');
    if (previewImg) {
      previewImg.src = e.target.result;
      previewImg.classList.remove('hidden');
    }
    if (previewGlow) previewGlow.classList.remove('hidden');
    if (placeholder) placeholder.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}
function previewNewGuide() {
  const form = document.querySelector('form');
  const formData = new FormData(form);
  const data = {};
  formData.forEach((value, key) => {
    if (key.startsWith('badge_') || key.startsWith('stat_') || key.startsWith('drop_') || key.startsWith('step_')) {
      if (!data[key]) data[key] = value;
    }
  });
  const title = document.querySelector('input[name="title"]')?.value || 'Nueva Guía';
  const category = document.querySelector('input[name="category"]')?.value || 'Guía';
  const subtitle = document.querySelector('input[name="subtitle"]')?.value || '';
  const infoBox = document.querySelector('textarea[name="infoBox"]')?.value || '';
  const tipBox = document.querySelector('textarea[name="tipBox"]')?.value || '';
  const warningBox = document.querySelector('textarea[name="warningBox"]')?.value || '';
  const previewUrl = '/admin/guias/preview-temp?title=' + encodeURIComponent(title) + '&category=' + encodeURIComponent(category) + '&subtitle=' + encodeURIComponent(subtitle) + '&infoBox=' + encodeURIComponent(infoBox) + '&tipBox=' + encodeURIComponent(tipBox) + '&warningBox=' + encodeURIComponent(warningBox);
  window.open(previewUrl, '_blank');
}
    </script>
  `;
}

// ─── Parser + Rutas ────────────────────────────────────────────────────────────

function parseGuideData(body: Record<string, string>, imageBase64?: string): GuideData {
  const badges = Array.from({ length: 4 }, (_, i) => ({
    label: body[`badge_label_${i}`] ?? "",
    color: body[`badge_color_${i}`] ?? "yellow",
  })).filter(b => b.label.trim() !== "");

  const stats = Array.from({ length: 4 }, (_, i) => ({
    label: body[`stat_label_${i}`] ?? "",
    value: body[`stat_value_${i}`] ?? "",
    color: body[`stat_color_${i}`] ?? "default",
    emoji: body[`stat_emoji_${i}`] ?? "",
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
    bossEmoji: body.bossEmoji || "📜", imageUrl: body.imageUrl ?? "", imageBase64: imageBase64 ?? body.imageBase64 ?? "",
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
    ? `<tr><td colspan="4" class="py-20 text-center text-stone-700 text-[10px] italic font-rpg uppercase tracking-[0.5em]">Base de datos vacía</td></tr>`
    : list.map((g) => `
        <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
          <td class="py-6 px-8">
            <a href="/admin/guias/${g.id}/preview" target="_blank" class="text-white hover:text-violet-400 font-bold transition-all flex items-center gap-3 group">
              <span class="font-rpg tracking-widest text-sm uppercase">${esc(g.title)}</span>
              <span class="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
            </a>
          </td>
          <td class="py-6 px-8">
            <span class="text-stone-500 font-rpg text-[9px] uppercase tracking-[0.2em] font-bold">${esc(g.author)}</span>
          </td>
          <td class="py-6 px-8">
            <span class="inline-flex items-center gap-2 text-[8px] font-bold px-3 py-1 rounded-full border font-rpg uppercase tracking-[0.2em] ${g.published ? "border-green-500/30 text-green-400 bg-green-500/5" : "border-yellow-500/30 text-yellow-400 bg-yellow-500/5"}">
              <span class="w-1 h-1 rounded-full ${g.published ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,1)]' : 'bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,1)]'}"></span>
              ${g.published ? "Publicado" : "Enviado"}
            </span>
          </td>
          <td class="py-6 px-8 text-right">
            <div class="flex items-center justify-end gap-2">
              ${(user.role !== "escudero" || g.author === user.username) ? `<a href="/admin/guias/${g.id}/editar" class="px-3 py-1.5 text-[9px] font-rpg font-bold uppercase tracking-[0.2em] text-violet-400 hover:text-violet-300 border border-violet-500/30 hover:border-violet-500/50 rounded-lg transition-all">Editar</a>` : ""}
              ${user.role === "superadmin" ? `
              ${g.published ? `
              <form method="POST" action="/admin/guias/${g.id}/despublicar" class="inline">
                <button type="submit" class="px-3 py-1.5 text-[9px] font-rpg font-bold uppercase tracking-[0.2em] text-orange-500 hover:text-orange-400 border border-orange-500/30 hover:border-orange-500/50 rounded-lg transition-all">Despublicar</button>
              </form>` : `
              <form method="POST" action="/admin/guias/${g.id}/publicar" class="inline">
                <button type="submit" class="px-3 py-1.5 text-[9px] font-rpg font-bold uppercase tracking-[0.2em] text-green-500 hover:text-green-400 border border-green-500/30 hover:border-green-500/50 rounded-lg transition-all">Publicar</button>
              </form>`}
              <form method="POST" action="/admin/guias/${g.id}/borrar" class="inline" onsubmit="return confirm('¿Confirmar destrucción de protocolo?')">
                <button type="submit" class="px-3 py-1.5 text-[9px] font-rpg font-bold uppercase tracking-[0.2em] text-red-500 hover:text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-lg transition-all">Eliminar</button>
              </form>` : ""}
            </div>
          </td>
        </tr>`).join("");

  const content = `
    <div class="glass-panel overflow-hidden">
      <div class="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div class="flex items-center gap-4">
          <div class="w-1.5 h-6 bg-violet-600 rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
          <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-sm text-white">Biblioteca de Pergaminos</h2>
        </div>
        <a href="/admin/guias/nueva" class="btn-primary text-[10px] px-6 py-3 rounded-xl font-bold font-rpg uppercase tracking-[0.2em] shadow-xl active:scale-95">+ Nuevo Pergamino</a>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-[9px] text-stone-600 uppercase font-rpg tracking-[0.4em] bg-white/5 border-b border-white/5">
              <th class="py-6 px-8 text-left">Título</th>
              <th class="py-6 px-8 text-left">Autor</th>
              <th class="py-6 px-8 text-left">Estado</th>
              <th class="py-6 px-8"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  return c.html(adminLayout("Guías", content, user, "/admin/guias"));
});

adminGuias.get("/nueva", (c) => {
  const user = c.get("user");
  return c.html(adminLayout("Nuevo Pergamino", guideForm("", null, null, user.role), user, "/admin/guias"));
});

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
  
  return c.html(adminLayout("Editar Pergamino", guideForm(g.title, JSON.parse(g.content), g.id, user.role), user, "/admin/guias"));
});

adminGuias.get("/:id/preview", async (c) => {
  const id = c.req.param("id");
  const db = getTursoClient();
  const result = await db.execute({ sql: `SELECT title, content, author, created_at FROM guides WHERE id = ?`, args: [id] });
  if (result.rows.length === 0) return c.notFound();
  const g = result.rows[0] as unknown as { title: string; content: string; author: string; created_at: string };
  const rendered = renderGuide(g.title, JSON.parse(g.content), g.author, g.created_at.slice(0, 10));
  return c.html(publicLayout(g.title, `<div class="max-w-4xl mx-auto">${rendered}</div>`, c.get("user")));
});

adminGuias.get("/preview-temp", (c) => {
  const params = c.req.query();
  const title = params.title || "Nueva Guía";
  const content: GuideData = {
    bossEmoji: "📜",
    imageUrl: "",
    imageBase64: "",
    category: params.category || "Guía",
    subtitle: params.subtitle || "",
    badges: [],
    infoBox: params.infoBox || "",
    stats: [],
    warningBox: params.warningBox || "",
    steps: [],
    drops: [],
    tipBox: params.tipBox || "",
  };
  const rendered = renderGuide(title, content, c.get("user")?.username || "Usuario", new Date().toISOString().slice(0, 10));
  return c.html(publicLayout(title, `<div class="max-w-4xl mx-auto">${rendered}</div>`, c.get("user")));
});

adminGuias.post("/nueva", async (c) => {
  const body = await c.req.parseBody();
  const title = String(body.title ?? "").trim();
  const action = String(body.action ?? "save");
  const imageBase64 = await extractImageBase64(body as Record<string, string | File>);
  const data = parseGuideData(body as Record<string, string>, imageBase64);
  const db = getTursoClient();
  const now = new Date().toISOString();
  const published = action === "publish" ? 1 : 0;
  await db.execute({
    sql: `INSERT INTO guides (id, slug, title, content, published, author, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [crypto.randomUUID(), toSlug(title), title, JSON.stringify(data), published, c.get("user").username, now, now],
  });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/editar", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.parseBody();
  const action = String(body.action ?? "save");
  
  const db = getTursoClient();
  const check = await db.execute({ sql: `SELECT author, published FROM guides WHERE id = ?`, args: [id] });
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
  const currentPublished = (check.rows[0] as any).published;
  const newPublished = action === "publish" && user.role === "superadmin" ? 1 : currentPublished;
  await getTursoClient().execute({
    sql: `UPDATE guides SET title = ?, slug = ?, content = ?, published = ?, updated_at = ? WHERE id = ?`,
    args: [title, toSlug(title), JSON.stringify(data), newPublished, new Date().toISOString(), id],
  });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/publicar", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin") return c.redirect("/admin/guias");
  const id = c.req.param("id");
  const db = getTursoClient();
  const check = await db.execute({ sql: `SELECT author FROM guides WHERE id = ?`, args: [id] });
  if (check.rows.length === 0) return c.notFound();
  await db.execute({
    sql: `UPDATE guides SET published = 1, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/despublicar", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin") return c.redirect("/admin/guias");
  const id = c.req.param("id");
  const db = getTursoClient();
  const check = await db.execute({ sql: `SELECT author FROM guides WHERE id = ?`, args: [id] });
  if (check.rows.length === 0) return c.notFound();
  await db.execute({
    sql: `UPDATE guides SET published = 0, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/borrar", async (c) => {
  const user = c.get("user");
  if (user.role !== "superadmin") return c.redirect("/admin/guias");
  const id = c.req.param("id");
  const db = getTursoClient();
  const check = await db.execute({ sql: `SELECT author FROM guides WHERE id = ?`, args: [id] });
  if (check.rows.length === 0) return c.notFound();
  await db.execute({ sql: `DELETE FROM guides WHERE id = ?`, args: [id] });
  return c.redirect("/admin/guias?ok=1");
});

export default adminGuias;