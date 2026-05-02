import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";

function getWeekStart(): string {
  const d = new Date();
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().slice(0, 10);
}

const RANK_LABELS: Record<number, string> = { 0: "Miembro", 1: "Diputado", 2: "Líder" };

const alters = new Hono();

alters.get("/", async (c) => {
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
    db.execute(`SELECT member_name, rank, hours_offline FROM clan_members`),
    db.execute(`SELECT username, alter_name FROM member_alters`),
  ]);

  type RpgRow = { username: string; week_exp: number; level: number; title: string };
  const rpgMap = new Map<string, RpgRow>();
  if (rpgResult.status === "fulfilled" && rpgResult.value) {
    for (const r of rpgResult.value.rows as unknown as RpgRow[]) {
      rpgMap.set(r.username.toLowerCase(), r);
    }
  }

  type DbMember = { member_name: string; rank: number; hours_offline: number };
  const memberDataMap = new Map<string, DbMember>();
  if (membersDbResult.status === "fulfilled") {
    for (const r of membersDbResult.value.rows as unknown as DbMember[]) {
      memberDataMap.set(r.member_name.toLowerCase(), r);
    }
  }

  // reverseMap: alterName (lower) -> mainUsername
  const reverseMap = new Map<string, string>();
  if (altersResult.status === "fulfilled") {
    for (const r of altersResult.value.rows as unknown as { username: string; alter_name: string }[]) {
      reverseMap.set(r.alter_name.toLowerCase(), r.username);
    }
  }

  const alterList = [...reverseMap.entries()].map(([alterLower, mainUsername]) => {
    const data = memberDataMap.get(alterLower);
    return {
      memberName: data?.member_name ?? alterLower,
      rank: data?.rank ?? 0,
      hoursOffline: data?.hours_offline ?? -1,
      mainUsername,
    };
  });

  const rows =
    alterList.length === 0
      ? `<tr><td colspan="7" class="py-12 text-center text-stone-600 text-sm italic font-rpg uppercase tracking-widest">No hay alters registrados aún</td></tr>`
      : alterList.map((m) => {
          const rpg = rpgMap.get(m.memberName.toLowerCase());
          const offline = Number(m.hoursOffline);
          const isInvalid = isNaN(offline) || m.hoursOffline === null || offline < 0;
          const offlineText = isInvalid ? "—" : `${Math.round(offline)}h`;
          const offlineColor = offline > 72 ? "text-red-400" : offline > 48 ? "text-yellow-400" : "text-stone-400";
          const rankLabel = RANK_LABELS[m.rank] ?? `Rango ${m.rank}`;

          return `
    <tr class="border-b border-yellow-900/10 hover:bg-stone-800/40 transition text-sm">
      <td class="py-4 px-6 font-bold text-stone-200">${esc(m.memberName)}</td>
      <td class="py-4 px-6 text-yellow-600 font-rpg text-[10px] uppercase tracking-widest italic">← ${esc(m.mainUsername)}</td>
      <td class="py-4 px-6 text-stone-500 font-rpg text-[10px] uppercase tracking-widest">${esc(rankLabel)}</td>
      <td class="py-4 px-6 text-purple-400 font-rpg text-[10px] uppercase tracking-widest">${rpg ? rpg.title : "—"}</td>
      <td class="py-4 px-6 text-center text-stone-300 font-rpg">${rpg ? rpg.level : "—"}</td>
      <td class="py-4 px-6 text-right font-mono text-cyan-400 text-xs">${rpg ? Number(rpg.week_exp).toLocaleString() : "—"}</td>
    </tr>`;
        }).join("");

  const content = `
    <div class="bg-stone-900/60 border border-yellow-900/20 rounded-2xl overflow-hidden shadow-2xl">
      <div class="px-8 py-5 border-b border-yellow-900/10 flex items-center justify-between bg-black/20">
        <h2 class="font-bold font-rpg uppercase tracking-[0.2em] text-sm text-yellow-500">👥 Alters del Clan</h2>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-widest">${alterList.length} alters detectados</span>
      </div>
      <table class="w-full">
        <thead>
          <tr class="text-[10px] text-stone-600 uppercase border-b border-yellow-900/5 bg-black/10">
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Alter</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Cuenta Principal</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Rango</th>
            <th class="py-4 px-6 text-left font-rpg tracking-widest">Título RPG</th>
            <th class="py-4 px-6 text-center font-rpg tracking-widest">Nivel</th>
            <th class="py-4 px-6 text-right font-rpg tracking-widest">EXP Semanal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  return c.html(adminLayout("Alters", content, user, c.req.path));
});

export default alters;
