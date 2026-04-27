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

interface CachedMember { member_name: string; rank: number }
interface SimpleProfile { hoursOffline: number }

const RANK_LABELS: Record<number, string> = { 0: "Miembro", 1: "Diputado", 2: "Líder" };

const alters = new Hono();

alters.get("/", async (c) => {
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
    db.execute(`SELECT member_name, rank FROM clan_members`),
    db.execute(`SELECT username, alter_name FROM member_alters`),
  ]);

  type RpgRow = { username: string; week_exp: number; level: number; title: string };
  const rpgMap = new Map<string, RpgRow>();
  if (rpgResult.status === "fulfilled" && rpgResult.value) {
    for (const r of rpgResult.value.rows as unknown as RpgRow[]) {
      rpgMap.set(r.username.toLowerCase(), r);
    }
  }

  const memberRankMap = new Map<string, number>();
  if (membersDbResult.status === "fulfilled") {
    for (const r of membersDbResult.value.rows as unknown as CachedMember[]) {
      memberRankMap.set(r.member_name.toLowerCase(), r.rank);
    }
  }

  // reverseMap: alterName (lower) -> mainUsername
  const reverseMap = new Map<string, string>();
  if (altersResult.status === "fulfilled") {
    for (const r of altersResult.value.rows as unknown as { username: string; alter_name: string }[]) {
      reverseMap.set(r.alter_name.toLowerCase(), r.username);
    }
  }

  // Solo los miembros cacheados que son alter de alguien
  const alterList = [...reverseMap.entries()].map(([alterLower, mainUsername]) => ({
    memberName: [...memberRankMap.keys()].find((k) => k === alterLower) ?? alterLower,
    rank: memberRankMap.get(alterLower) ?? 0,
    mainUsername,
  }));

  const profiles = await Promise.all(
    alterList.map((m) =>
      fetch(`${IDLE_BASE}/api/Player/profile/simple/${encodeURIComponent(m.memberName)}`)
        .then((r) => r.json() as Promise<SimpleProfile>)
        .catch(() => ({ hoursOffline: -1 }))
    )
  );

  const rows =
    alterList.length === 0
      ? `<tr><td colspan="7" class="py-8 text-center text-gray-600 text-sm">No hay alters registrados aún</td></tr>`
      : alterList.map((m, i) => {
          const rpg = rpgMap.get(m.memberName.toLowerCase());
          const offline = profiles[i].hoursOffline;
          const offlineText = offline < 0 ? "—" : `${Math.round(offline)}h`;
          const offlineColor = offline > 72 ? "text-red-400" : offline > 48 ? "text-yellow-400" : "text-gray-400";
          const rankLabel = RANK_LABELS[m.rank] ?? `Rango ${m.rank}`;

          return `
    <tr class="border-b border-gray-800 hover:bg-gray-800/40 transition text-sm">
      <td class="py-2.5 px-4 font-medium">${esc(m.memberName)}</td>
      <td class="py-2.5 px-4 text-yellow-400 text-xs font-medium">← ${esc(m.mainUsername)}</td>
      <td class="py-2.5 px-4 text-gray-400">${esc(rankLabel)}</td>
      <td class="py-2.5 px-4 text-purple-400">${rpg ? rpg.title : "—"}</td>
      <td class="py-2.5 px-4 text-center text-gray-300">${rpg ? rpg.level : "—"}</td>
      <td class="py-2.5 px-4 text-right font-mono text-cyan-400">${rpg ? Number(rpg.week_exp).toLocaleString() : "—"}</td>
      <td class="py-2.5 px-4 text-right ${offlineColor}">${offlineText}</td>
    </tr>`;
        }).join("");

  const content = `
    <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div class="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <h2 class="font-semibold">Alters del clan</h2>
        <span class="text-xs text-gray-500">${alterList.length} alters · semana desde ${weekStart}</span>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-xs text-gray-500 uppercase border-b border-gray-800">
            <th class="py-3 px-4 text-left">Alter</th>
            <th class="py-3 px-4 text-left">Cuenta principal</th>
            <th class="py-3 px-4 text-left">Rango</th>
            <th class="py-3 px-4 text-left">Título RPG</th>
            <th class="py-3 px-4 text-center">Nivel</th>
            <th class="py-3 px-4 text-right">EXP Semanal</th>
            <th class="py-3 px-4 text-right">Offline</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Alters", content, user));
});

export default alters;
