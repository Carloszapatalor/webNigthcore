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
      ? `<tr><td colspan="6" class="py-20 text-center text-stone-700 text-[10px] italic font-rpg uppercase tracking-[0.5em]">No hay alters registrados aún</td></tr>`
      : alterList.map((m) => {
          const rpg = rpgMap.get(m.memberName.toLowerCase());
          const rankLabel = RANK_LABELS[m.rank] ?? `Rango ${m.rank}`;

          return `
    <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
      <td class="py-5 px-8 font-bold text-white font-rpg tracking-widest text-sm uppercase">${esc(m.memberName)}</td>
      <td class="py-5 px-6 text-violet-400 font-rpg text-[10px] uppercase tracking-widest font-bold drop-shadow-[0_0_8px_rgba(139,92,246,0.3)]">← ${esc(m.mainUsername)}</td>
      <td class="py-5 px-6 text-stone-500 font-rpg text-[9px] uppercase tracking-widest font-bold">${esc(rankLabel)}</td>
      <td class="py-5 px-6 text-pink-400 font-rpg text-[9px] uppercase tracking-[0.2em] font-bold">${rpg ? rpg.title : "—"}</td>
      <td class="py-5 px-6 text-center text-stone-300 font-rpg text-xs">${rpg ? rpg.level : "—"}</td>
      <td class="py-5 px-8 text-right font-mono text-cyan-400 text-xs font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.3)]">${rpg ? Number(rpg.week_exp).toLocaleString() : "—"}</td>
    </tr>`;
        }).join("");

  const content = `
    <div class="glass-panel overflow-hidden">
      <div class="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-black/20">
        <div class="flex items-center gap-4">
          <div class="w-1.5 h-6 bg-violet-600 rounded-full shadow-[0_0_10px_rgba(139,92,246,1)]"></div>
          <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-sm text-white">Cuentas Secundarias (Alters)</h2>
        </div>
        <span class="text-[10px] text-stone-500 font-rpg uppercase tracking-[0.2em] font-bold bg-black/40 px-3 py-1 rounded-full">${alterList.length} Detectados</span>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="text-[9px] text-stone-600 uppercase font-rpg tracking-[0.4em] bg-white/5 border-b border-white/5">
              <th class="py-6 px-8 text-left">Alter</th>
              <th class="py-6 px-6 text-left">Cuenta Principal</th>
              <th class="py-6 px-6 text-left">Rango</th>
              <th class="py-6 px-6 text-left">Título RPG</th>
              <th class="py-6 px-6 text-center">Nivel</th>
              <th class="py-6 px-8 text-right">EXP Semanal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/5">${rows}</tbody>
        </table>
      </div>
    </div>
  `;

  return c.html(adminLayout("Alters", content, user, c.req.path));
});

export default alters;
