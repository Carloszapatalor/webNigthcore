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

function guideForm(
  guide: { id: string; title: string; content: string; published: number } | null
): string {
  const action = guide ? `/admin/guias/${guide.id}/editar` : "/admin/guias/nueva";
  const titleVal = guide ? esc(guide.title) : "";
  const contentVal = guide ? esc(guide.content) : "";
  const checked = guide?.published ? "checked" : "";

  return `
    <form method="POST" action="${action}">
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label class="block text-sm text-gray-400 mb-1">Título</label>
          <input name="title" type="text" required value="${titleVal}"
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:border-purple-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">Contenido (Markdown)</label>
          <textarea name="content" rows="18" required
            class="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:border-purple-500 focus:outline-none resize-y">${contentVal}</textarea>
        </div>
        <div class="flex items-center justify-between pt-2">
          <label class="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" name="published" value="1" ${checked}
              class="w-4 h-4 rounded border-gray-700 bg-gray-800 accent-purple-600" />
            <span class="text-sm text-gray-400">Publicar inmediatamente</span>
          </label>
          <div class="flex gap-3">
            <a href="/admin/guias" class="text-sm text-gray-500 hover:text-gray-300 px-4 py-2 transition">Cancelar</a>
            <button type="submit"
              class="bg-purple-600 hover:bg-purple-700 text-white text-sm px-6 py-2 rounded-lg transition">
              ${guide ? "Guardar cambios" : "Crear guía"}
            </button>
          </div>
        </div>
      </div>
    </form>
  `;
}

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
      : list
          .map(
            (g) => `
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
            ${
              g.published === 0
                ? `<form method="POST" action="/admin/guias/${g.id}/publicar" class="inline">
                     <button type="submit" class="text-green-400 hover:text-green-300 text-xs">Publicar</button>
                   </form>`
                : `<form method="POST" action="/admin/guias/${g.id}/despublicar" class="inline">
                     <button type="submit" class="text-yellow-400 hover:text-yellow-300 text-xs">Despublicar</button>
                   </form>`
            }
            <form method="POST" action="/admin/guias/${g.id}/borrar" class="inline"
              onsubmit="return confirm('¿Eliminar esta guía permanentemente?')">
              <button type="submit" class="text-red-400 hover:text-red-300 text-xs">Eliminar</button>
            </form>
          </div>
        </td>
      </tr>`
          )
          .join("");

  const content = `
    ${ok ? `<div class="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">Operación realizada</div>` : ""}
    ${error ? `<div class="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">${esc(decodeURIComponent(error))}</div>` : ""}

    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 class="font-semibold">Guías (${list.length})</h2>
        <a href="/admin/guias/nueva"
          class="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg transition">
          + Nueva guía
        </a>
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
  return c.html(adminLayout("Nueva guía", guideForm(null), user));
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
  return c.html(adminLayout("Editar guía", guideForm(g), user));
});

adminGuias.post("/nueva", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const published = body.published === "1" ? 1 : 0;

  if (!title || !content) {
    return c.redirect("/admin/guias?error=T%C3%ADtulo+y+contenido+requeridos");
  }

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
  const body = await c.req.parseBody();
  const title = String(body.title ?? "").trim();
  const content = String(body.content ?? "").trim();
  const published = body.published === "1" ? 1 : 0;

  if (!title || !content) {
    return c.redirect("/admin/guias?error=T%C3%ADtulo+y+contenido+requeridos");
  }

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
  await db.execute({
    sql: `UPDATE guides SET published = 1, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/despublicar", async (c) => {
  const id = c.req.param("id");
  const db = getTursoClient();
  await db.execute({
    sql: `UPDATE guides SET published = 0, updated_at = ? WHERE id = ?`,
    args: [new Date().toISOString(), id],
  });
  return c.redirect("/admin/guias?ok=1");
});

adminGuias.post("/:id/borrar", async (c) => {
  const id = c.req.param("id");
  const db = getTursoClient();
  await db.execute({ sql: `DELETE FROM guides WHERE id = ?`, args: [id] });
  return c.redirect("/admin/guias?ok=1");
});

export default adminGuias;
