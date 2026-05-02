import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";

const IDLE_BASE = "https://query.idleclans.com";

function getWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

interface RecruitmentMember { memberName: string; rank: number }
interface SimpleProfile     { hoursOffline: number }

const RANK_LABELS: Record<number, string> = { 0: "Miembro", 1: "Diputado", 2: "Líder" };

const miembros = new Hono();

miembros.get("/", async (c) => {
  const user = c.get("user");
  if (user.role === "escudero") return c.redirect("/admin");
  const db = getTursoClient();
  const weekStart = getWeekStart();

  const [rpgResult, membersDbResult, altersResult] = await Promise.allSettled([
    db.execute({
      sql: `SELECT d.username, SUM(d.total_exp) as week_exp,
                   COALESCE(p.level, 1) as level,
                   COALESCE(p.title, '🌱 Buscador') as title
            FROM rpg_daily_exp d
            LEFT JOIN rpg_players p ON p.username = d.username
            WHERE d.date >= ?
            GROUP BY d.username`,
      args: [weekStart],
    }),
    db.execute(`SELECT member_name, rank, updated_at FROM clan_members ORDER BY rank DESC, member_name ASC`),
    db.execute(`SELECT username, alter_name FROM member_alters`),
  ]);

  type RpgRow = { username: string; week_exp: number; level: number; title: string };
  const rpgMap = new Map<string, RpgRow>();
  if (rpgResult.status === "fulfilled" && rpgResult.value) {
    for (const r of rpgResult.value.rows as unknown as RpgRow[]) {
      rpgMap.set(r.username.toLowerCase(), r);
    }
  }

  type DbMember = { member_name: string; rank: number; updated_at: string; hours_offline: number };
  let allMembers: DbMember[] = [];
  let lastSync = "";
  if (membersDbResult.status === "fulfilled" && membersDbResult.value.rows.length > 0) {
    allMembers = membersDbResult.value.rows as unknown as DbMember[];
    lastSync = allMembers[0].updated_at.slice(0, 10);
  }

  const alterMap = new Map<string, string>();
  if (altersResult.status === "fulfilled") {
    for (const r of altersResult.value.rows as unknown as { username: string; alter_name: string }[]) {
      alterMap.set(r.username.toLowerCase(), r.alter_name);
    }
  }

  const alterNames = new Set([...alterMap.values()].map((v) => v.toLowerCase()));
  const memberList = allMembers.filter((m) => !alterNames.has(m.member_name.toLowerCase()));

  const datalistOptions = allMembers.map((m) => `<option value="${esc(m.member_name)}">`).join("");

    const rows =
    memberList.length === 0
      ? `<tr><td colspan="7" class="py-8 text-center text-gray-500 text-sm">Sin miembros — pulsa <strong class="text-white">🔄 Actualizar</strong> para cargar desde la API</td></tr>`
      : memberList.map((m) => {
          const rpg = rpgMap.get(m.member_name.toLowerCase());
          const offline = Number(m.hours_offline);
          const isInvalid = isNaN(offline) || m.hours_offline === null || offline < 0;
          const offlineText = isInvalid ? "—" : `${Math.round(offline)}h`;
          const offlineColor = offline > 72 ? "text-red-400" : offline > 48 ? "text-yellow-400" : "text-gray-400";
          const rankLabel = RANK_LABELS[m.rank] ?? `Rango ${m.rank}`;
          const currentAlter = alterMap.get(m.member_name.toLowerCase()) ?? "";

          return `
    <tr class="border-b border-stone-800/50 hover:bg-stone-800/40 transition text-sm">
      <td class="py-2.5 px-4 font-medium">${esc(m.member_name)}</td>
      <td class="py-2.5 px-4 text-stone-500">${esc(rankLabel)}</td>
      <td class="py-2.5 px-4 text-purple-400 font-rpg uppercase text-[10px]">${rpg ? rpg.title : "—"}</td>
      <td class="py-2.5 px-4 text-center text-stone-300 font-rpg">${rpg ? rpg.level : "—"}</td>
      <td class="py-2.5 px-4 text-right font-mono text-cyan-400 text-xs">${rpg ? Number(rpg.week_exp).toLocaleString() : "—"}</td>
      <td class="py-2.5 px-3">
        <form method="POST" action="/admin/miembros/alter" class="flex items-center gap-1.5">
          <input type="hidden" name="username" value="${esc(m.member_name)}" />
          <input type="text" name="alter" list="clan-members-list"
            value="${esc(currentAlter)}" placeholder="Buscar…" autocomplete="off"
            onchange="setTimeout(()=>this.form.submit(),50)"
            class="w-32 bg-stone-900 border border-stone-800 rounded px-2 py-1 text-xs text-white focus:border-yellow-600 focus:outline-none transition" />
          ${currentAlter
            ? `<button type="button"
                 onclick="fetch('/admin/miembros/alter/quitar',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'username=${encodeURIComponent(m.member_name)}'}).then(()=>location.reload())"
                 class="text-stone-600 hover:text-red-400 transition text-xs">✕</button>`
            : ""}
        </form>
      </td>
    </tr>`;
        }).join("");

  const ok = c.req.query("ok");
  const synced = c.req.query("synced");
  const syncError = c.req.query("error");

  const content = `
    ${ok ? `<div class="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">Alter guardado</div>` : ""}
    ${synced ? `<div class="bg-green-900/30 border border-green-700 text-green-400 text-sm rounded-lg px-4 py-3 mb-4">✓ Lista actualizada desde la API</div>` : ""}
    ${syncError ? `<div class="bg-red-900/30 border border-red-700 text-red-400 text-sm rounded-lg px-4 py-3 mb-4">⚠️ ${esc(decodeURIComponent(syncError))}</div>` : ""}
    <datalist id="clan-members-list">${datalistOptions}</datalist>

    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-xl">
      <div class="px-6 py-4 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
        <h2 class="font-bold font-rpg uppercase tracking-widest text-sm text-yellow-500">Miembros del clan</h2>
        <div class="flex items-center gap-4">
          ${lastSync ? `<span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest">Sincronizado: ${lastSync}</span>` : ""}
          <span class="text-[10px] text-stone-400 font-rpg uppercase tracking-widest">${memberList.length} miembros</span>
          <form method="POST" action="/admin/miembros/sync">
            <button type="submit"
              class="text-[10px] font-rpg uppercase tracking-widest bg-yellow-700 hover:bg-yellow-600 text-stone-950 px-3 py-1.5 rounded-lg transition shadow-lg active:scale-95">
              🔄 Actualizar
            </button>
          </form>
        </div>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
            <th class="py-3 px-4 text-left font-rpg tracking-widest">Jugador</th>
            <th class="py-3 px-4 text-left font-rpg tracking-widest">Rango</th>
            <th class="py-3 px-4 text-left font-rpg tracking-widest">Título RPG</th>
            <th class="py-3 px-4 text-center font-rpg tracking-widest">Nivel</th>
            <th class="py-3 px-4 text-right font-rpg tracking-widest">EXP Semanal</th>
            <th class="py-3 px-4 text-left font-rpg tracking-widest">Alter</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Miembros", content, user, c.req.path));
});

import { syncClanMembers } from "../../lib/members.ts";

miembros.post("/sync", async (c) => {
  await syncClanMembers();
  return c.redirect("/admin/miembros?synced=1");
});

miembros.post("/alter", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  const alter    = String(body.alter    ?? "").trim();
  if (!username) return c.redirect("/admin/miembros");

  const db = getTursoClient();
  if (!alter) {
    await db.execute({ sql: `DELETE FROM member_alters WHERE username = ?`, args: [username] });
  } else {
    await db.execute({
      sql: `INSERT OR REPLACE INTO member_alters (username, alter_name) VALUES (?, ?)`,
      args: [username, alter],
    });
  }
  return c.redirect("/admin/miembros?ok=1");
});

miembros.post("/alter/quitar", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "").trim();
  if (username) {
    const db = getTursoClient();
    await db.execute({ sql: `DELETE FROM member_alters WHERE username = ?`, args: [username] });
  }
  return new Response("", { status: 204 });
});

export default miembros;
