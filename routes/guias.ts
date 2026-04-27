import { Hono } from "hono";
import { marked } from "npm:marked";
import { getTursoClient } from "../lib/turso.ts";
import { publicLayout, esc } from "../views/layout.ts";

const guias = new Hono();

guias.get("/", async (c) => {
  const db = getTursoClient();
  const result = await db.execute(
    `SELECT slug, title, author, created_at FROM guides WHERE published = 1 ORDER BY created_at DESC`
  );
  type GuideRow = { slug: string; title: string; author: string; created_at: string };
  const list = result.rows as unknown as GuideRow[];

  const cards =
    list.length === 0
      ? `<p class="text-gray-500 text-center py-16">Aún no hay guías publicadas.</p>`
      : list
          .map(
            (g) => `
      <a href="/guias/${esc(g.slug)}" class="block bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-purple-700 transition group">
        <h3 class="font-semibold text-white text-lg mb-1 group-hover:text-purple-300 transition">${esc(g.title)}</h3>
        <p class="text-gray-500 text-sm">Por ${esc(g.author)} · ${g.created_at.slice(0, 10)}</p>
      </a>`
          )
          .join("");

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
  const html = await marked(g.content);

  const content = `
    <div class="max-w-3xl">
      <a href="/guias" class="text-purple-400 hover:text-purple-300 text-sm transition mb-6 inline-block">← Volver a guías</a>
      <h1 class="text-4xl font-bold text-white mb-2">${esc(g.title)}</h1>
      <p class="text-gray-500 text-sm mb-8">Por ${esc(g.author)} · ${g.created_at.slice(0, 10)}</p>
      <div class="prose bg-gray-900 rounded-xl border border-gray-800 p-8">${html}</div>
    </div>
  `;

  return c.html(publicLayout(g.title, content));
});

export default guias;
