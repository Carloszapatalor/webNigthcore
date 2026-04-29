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

  type DbMember = { member_name: string; rank: number; updated_at: string };
  let allMembers: RecruitmentMember[] = [];
  let lastSync = "";
  if (membersDbResult.status === "fulfilled" && membersDbResult.value.rows.length > 0) {
    const rows = membersDbResult.value.rows as unknown as DbMember[];
    allMembers = rows.map((r) => ({ memberName: r.member_name, rank: r.rank }));
    lastSync = rows[0].updated_at.slice(0, 10);
  }

  const alterMap = new Map<string, string>();
  if (altersResult.status === "fulfilled") {
    for (const r of altersResult.value.rows as unknown as { username: string; alter_name: string }[]) {
      alterMap.set(r.username.toLowerCase(), r.alter_name);
    }
  }

  const alterNames = new Set([...alterMap.values()].map((v) => v.toLowerCase()));
  const memberList = allMembers.filter((m) => !alterNames.has(m.memberName.toLowerCase()));

  const profiles = await Promise.all(
    memberList.map((m) =>
      fetch(`${IDLE_BASE}/api/Player/profile/simple/${encodeURIComponent(m.memberName)}`)
        .then((r) => r.json() as Promise<SimpleProfile>)
        .catch(() => ({ hoursOffline: -1 }))
    )
  );

  const datalistOptions = allMembers.map((m) => `<option value="${esc(m.memberName)}">`).join("");

  const rows =
    memberList.length === 0
      ? `<tr><td colspan="7" class="py-8 text-center text-gray-500 text-sm">Sin miembros — pulsa <strong class="text-white">🔄 Actualizar</strong> para cargar desde la API</td></tr>`
      : memberList.map((m, i) => {
          const rpg = rpgMap.get(m.memberName.toLowerCase());
          const offline = profiles[i].hoursOffline;
          const offlineText = offline < 0 ? "—" : `${Math.round(offline)}h`;
          const offlineColor = offline > 72 ? "text-red-400" : offline > 48 ? "text-yellow-400" : "text-gray-400";
          const rankLabel = RANK_LABELS[m.rank] ?? `Rango ${m.rank}`;
          const currentAlter = alterMap.get(m.memberName.toLowerCase()) ?? "";

          return `
    <tr class="border-b border-gray-800 hover:bg-gray-800/40 transition text-sm">
      <td class="py-2.5 px-4 font-medium">${esc(m.memberName)}</td>
      <td class="py-2.5 px-4 text-gray-400">${esc(rankLabel)}</td>
      <td class="py-2.5 px-4 text-purple-400">${rpg ? rpg.title : "—"}</td>
      <td class="py-2.5 px-4 text-center text-gray-300">${rpg ? rpg.level : "—"}</td>
      <td class="py-2.5 px-4 text-right font-mono text-cyan-400">${rpg ? Number(rpg.week_exp).toLocaleString() : "—"}</td>
      <td class="py-2.5 px-3">
        <form method="POST" action="/admin/miembros/alter" class="flex items-center gap-1.5">
          <input type="hidden" name="username" value="${esc(m.memberName)}" />
          <input type="text" name="alter" list="clan-members-list"
            value="${esc(currentAlter)}" placeholder="Buscar…" autocomplete="off"
            onchange="setTimeout(()=>this.form.submit(),50)"
            class="w-32 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:border-purple-500 focus:outline-none" />
          ${currentAlter
            ? `<button type="button"
                 onclick="fetch('/admin/miembros/alter/quitar',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'username=${encodeURIComponent(m.memberName)}'}).then(()=>location.reload())"
                 class="text-gray-600 hover:text-red-400 transition text-xs">✕</button>`
            : ""}
        </form>
      </td>
      <td class="py-2.5 px-4 text-right ${offlineColor}">${offlineText}</td>
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

    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 class="font-semibold">Miembros del clan</h2>
        <div class="flex items-center gap-4">
          ${lastSync ? `<span class="text-xs text-gray-600">Sync: ${lastSync}</span>` : ""}
          <span class="text-xs text-gray-500">${memberList.length} miembros · semana desde ${weekStart}</span>
          <form method="POST" action="/admin/miembros/sync">
            <button type="submit"
              class="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 hover:text-white px-3 py-1.5 rounded-lg transition">
              🔄 Actualizar
            </button>
          </form>
        </div>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th class="py-3 px-4 text-left">Jugador</th>
            <th class="py-3 px-4 text-left">Rango</th>
            <th class="py-3 px-4 text-left">Título RPG</th>
            <th class="py-3 px-4 text-center">Nivel</th>
            <th class="py-3 px-4 text-right">EXP Semanal</th>
            <th class="py-3 px-4 text-left">Alter</th>
            <th class="py-3 px-4 text-right">Offline</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Miembros", content, user));
});

miembros.post("/sync", async (c) => {
  const clanName = Deno.env.get("CLAN_NAME") ?? "";
  if (!clanName) return c.redirect("/admin/miembros?error=CLAN_NAME+no+configurado");

  let data: unknown = null;
  let fetchError = "";
  try {
    const res = await fetch(`${IDLE_BASE}/api/Clan/recruitment/${encodeURIComponent(clanName)}`);
    data = await res.json();
    if (!(data as Record<string, unknown>)?.memberlist) {
      fetchError = `Sin memberlist. Status ${res.status}. Keys: ${Object.keys(data as object ?? {}).join(", ") || "(vacío)"}`;
    }
  } catch (e) {
    fetchError = `Error de red: ${(e as Error).message}`;
  }

  if (fetchError) {
    return c.redirect(`/admin/miembros?error=${encodeURIComponent(fetchError)}`);
  }

  const db = getTursoClient();
  const now = new Date().toISOString();
  await db.execute(`DELETE FROM clan_members`);
  for (const m of (data as { memberlist: RecruitmentMember[] }).memberlist) {
    await db.execute({
      sql: `INSERT OR REPLACE INTO clan_members (member_name, rank, updated_at) VALUES (?, ?, ?)`,
      args: [m.memberName, m.rank, now],
    });
  }
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
