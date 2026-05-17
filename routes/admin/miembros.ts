import { Hono } from "hono";
import { getTursoClient } from "../../lib/turso.ts";
import { adminLayout, esc } from "../../views/layout.ts";
import { cacheGetStale, cacheSet, cacheDelete } from "../../lib/cache.ts";

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
const RANK_COLORS: Record<number, string> = { 0: "text-stone-500", 1: "text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]", 2: "text-violet-400 drop-shadow-[0_0_5px_rgba(139,92,246,0.3)]" };

const miembros = new Hono();

miembros.get("/", async (c) => {
  const user = c.get("user");
  if (user.role === "escudero") return c.redirect("/admin");
  const db = getTursoClient();
  const weekStart = getWeekStart();

  const cacheKey = "miembros:data";
  const cacheTtl = 3 * 60 * 1000;
  const forceFresh = c.req.query("fresh") === "1";
  if (forceFresh) cacheDelete(cacheKey);
  const cached = cacheGetStale<{ rpg: RpgRow[]; members: DbMember[]; alters: { username: string; alter_name: string }[]; lastSync: string }>(cacheKey);
  
  let rpgResult, membersDbResult, altersResult;

  [rpgResult, membersDbResult, altersResult] = await Promise.allSettled([
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
    db.execute(`SELECT member_name, rank, updated_at, hours_offline FROM clan_members ORDER BY rank DESC, member_name ASC`),
    db.execute(`SELECT username, alter_name FROM member_alters`),
  ]);

  if (rpgResult.status === "fulfilled" && membersDbResult.status === "fulfilled" && altersResult.status === "fulfilled") {
    const rpgRows = rpgResult.value.rows as unknown as RpgRow[];
    const memberRows = membersDbResult.value.rows as unknown as DbMember[];
    const alterRows = altersResult.value.rows as unknown as { username: string; alter_name: string }[];
    const lastSync = memberRows.length > 0 ? memberRows[0].updated_at.slice(0, 10) : "";
    
    // Only cache if not forcing fresh
    if (!forceFresh) {
      cacheSet(cacheKey, { rpg: rpgRows, members: memberRows, alters: alterRows, lastSync }, cacheTtl);
    }
  }

  type RpgRow = { username: string; week_exp: number; level: number; title: string };
  type DbMember = { member_name: string; rank: number; updated_at: string; hours_offline: number };
  
  const rpgMap = new Map<string, RpgRow>();
  if (rpgResult.status === "fulfilled" && rpgResult.value) {
    for (const r of rpgResult.value.rows as unknown as RpgRow[]) {
      rpgMap.set(r.username.toLowerCase(), r);
    }
  }

  let allMembers: DbMember[] = [];
  let lastSync = cached?.lastSync || "";
  if (membersDbResult.status === "fulfilled" && membersDbResult.value.rows.length > 0) {
    allMembers = membersDbResult.value.rows as unknown as DbMember[];
    if (!cached) lastSync = allMembers[0].updated_at.slice(0, 10);
  }

  const alterMap = new Map<string, string>();
  if (altersResult.status === "fulfilled") {
    for (const r of altersResult.value.rows as unknown as { username: string; alter_name: string }[]) {
      alterMap.set(r.username.toLowerCase(), r.alter_name);
    }
  }

  // Filtrar: excluir cuentas secundarias (values/alters)
  const secondaryAlters = new Set([...alterMap.values()].map(v => v.toLowerCase()));
  const memberList = allMembers.filter(m => 
    !secondaryAlters.has(m.member_name.toLowerCase())
  );
  // Datalist: solo miembros principales sin alter
  const datalistOptions = allMembers
    .filter(m => !alterMap.has(m.member_name.toLowerCase()))
    .map((m) => `<option value="${esc(m.member_name)}">`)
    .join("");

  const rows =
    memberList.length === 0
      ? `<tr><td colspan="7" class="py-20 text-center text-stone-700 text-[10px] font-rpg uppercase tracking-[0.5em] italic">No hay miembros</td></tr>`
      : memberList.map((m) => {
          const rpg = rpgMap.get(m.member_name.toLowerCase());
          const offline = Number(m.hours_offline);
          const isInvalid = isNaN(offline) || m.hours_offline === null || offline < 0;
          const offlineText = isInvalid ? "—" : `${Math.round(offline)}h`;
          const offlineColor = offline > 72 ? "text-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : offline > 48 ? "text-orange-500" : "text-green-500";
          const rankLabel = RANK_LABELS[m.rank] ?? `Rango ${m.rank}`;
          const currentAlter = alterMap.get(m.member_name.toLowerCase()) ?? "";

          return `
    <tr class="border-b border-white/5 hover:bg-white/5 transition-all duration-300">
      <td class="py-5 px-6">
        <div class="flex items-center gap-3">
          <div class="w-1.5 h-1.5 rounded-full ${offline <= 1 ? 'bg-green-500 animate-pulse shadow-[0_0_5px_rgba(34,197,94,1)]' : 'bg-stone-800'}"></div>
          <span class="text-white font-bold font-subtitle text-sm uppercase tracking-wider">${esc(m.member_name)}</span>
        </div>
      </td>
      <td class="py-5 px-6">
        <span class="text-[10px] font-rpg uppercase tracking-widest font-bold ${RANK_COLORS[m.rank] || 'text-stone-500'}">${esc(rankLabel)}</span>
      </td>
      <td class="py-5 px-6">
        <span class="text-[9px] font-rpg uppercase tracking-[0.2em] text-violet-400 font-bold">${rpg ? rpg.title : "—"}</span>
      </td>
      <td class="py-5 px-6 text-center">
        <span class="font-rpg text-xs text-stone-300">${rpg ? rpg.level : "—"}</span>
      </td>
      <td class="py-5 px-6 text-right">
        <span class="font-rpg text-xs text-cyan-400 font-bold drop-shadow-[0_0_5px_rgba(34,211,238,0.3)]">${rpg ? Number(rpg.week_exp).toLocaleString() : "—"}</span>
      </td>
      <td class="py-5 px-6">
        <span class="font-mono text-xs ${offlineColor} font-bold">${offlineText}</span>
      </td>
      <td class="py-5 px-6 text-right">
        <form method="POST" action="/admin/miembros/alter" class="flex items-center justify-end gap-2">
          <input type="hidden" name="username" value="${esc(m.member_name)}" />
          <div class="relative group">
            <input type="text" name="alter" list="clan-members-list"
              value="${esc(currentAlter)}" placeholder="Escribir nombre del alter..." autocomplete="off"
              onchange="setTimeout(()=>this.form.submit(),50)"
              class="w-32 bg-[#0B0D13] border border-white/5 rounded-xl px-3 py-1.5 text-[10px] text-white focus:border-violet-500 focus:outline-none transition-all placeholder:text-stone-800 font-subtitle uppercase tracking-widest" />
            ${currentAlter
              ? `<button type="button"
                   onclick="fetch('/admin/miembros/alter/quitar',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'username='+encodeURIComponent('${esc(m.member_name)}')}).then(()=>location.reload())"
                   class="absolute right-2 top-1/2 -translate-y-1/2 text-stone-700 hover:text-red-500 transition-colors text-xs font-bold">✕</button>`
              : ""}
          </div>
        </form>
      </td>
    </tr>`;
        }).join("");

  const ok = c.req.query("ok");
  const synced = c.req.query("synced");
  const syncError = c.req.query("error");

  const content = `
    <div class="flex flex-col gap-8">
      ${ok ? `<div class="bg-violet-600/10 border border-violet-500/30 text-violet-400 text-[10px] font-rpg uppercase tracking-[0.2em] rounded-2xl px-6 py-4 shadow-lg animate-fade-in font-bold">Alter actualizado</div>` : ""}
      ${synced ? `<div class="bg-cyan-600/10 border border-cyan-500/30 text-cyan-400 text-[10px] font-rpg uppercase tracking-[0.2em] rounded-2xl px-6 py-4 shadow-lg animate-fade-in font-bold">✓ Miembros sincronizados</div>` : ""}
      ${syncError ? `<div class="bg-red-600/10 border border-red-500/30 text-red-400 text-[10px] font-rpg uppercase tracking-[0.2em] rounded-2xl px-6 py-4 shadow-lg animate-fade-in font-bold">⚠️ Error: ${esc(decodeURIComponent(syncError))}</div>` : ""}
      
      <datalist id="clan-members-list">${datalistOptions}</datalist>

      <div class="glass-panel overflow-hidden">
        <div class="px-10 py-8 border-b border-white/5 flex items-center justify-between bg-black/20">
          <div class="flex items-center gap-4">
             <div class="w-1.5 h-6 bg-cyan-600 rounded-full shadow-[0_0_10px_rgba(8,145,178,1)]"></div>
             <h2 class="font-bold font-rpg uppercase tracking-[0.3em] text-[11px] text-white">Lista de Miembros</h2>
          </div>
          
          <div class="flex items-center gap-6">
            ${lastSync ? `<span class="text-[9px] text-stone-600 font-rpg uppercase tracking-[0.3em] font-bold">Última Sync: ${lastSync}</span>` : ""}
            <span class="text-[9px] text-violet-500 font-rpg uppercase tracking-[0.3em] font-bold bg-violet-600/10 px-3 py-1 rounded-full">${memberList.length} Activos</span>
            <form method="POST" action="/admin/miembros/sync">
              <button type="submit" title="Sincronización automática activa (30m)"
                class="text-[9px] font-rpg uppercase tracking-[0.3em] btn-secondary px-5 py-2.5 rounded-xl font-bold">
                🔄 Sincronizar
              </button>
            </form>
          </div>
        </div>
        
        <div class="overflow-x-auto">
          <table class="w-full">
            <thead>
              <tr class="text-[9px] text-stone-700 uppercase font-rpg tracking-[0.4em] bg-white/5 border-b border-white/5">
                <th class="py-5 px-8 text-left">Miembro</th>
                <th class="py-5 px-6 text-left">Rango</th>
                <th class="py-5 px-6 text-left">Título RPG</th>
                <th class="py-5 px-6 text-center">Nivel</th>
                <th class="py-5 px-6 text-right">EXP Semanal</th>
                <th class="py-5 px-6 text-left">Estado</th>
                <th class="py-5 px-6 text-right">Alter</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-white/5">
              ${rows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  return c.html(adminLayout("Miembros", content, user, c.req.path));
});

import { syncClanMembers } from "../../lib/members.ts";

miembros.post("/sync", (c) => {
  // Lanzar en background — responde inmediatamente al admin
  syncClanMembers().catch(e => console.error("Background sync error:", e));
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
  
  // Invalidar cache completamente
  cacheDelete("miembros:data");
  
  // Forzar datos frescos usando parámetro
  return c.redirect("/admin/miembros?ok=1&fresh=1");
});

miembros.post("/alter/quitar", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "");
  if (username) {
    const db = getTursoClient();
    await db.execute({ sql: `DELETE FROM member_alters WHERE username = ?`, args: [username] });
    
    // Invalidar cache completamente
    cacheDelete("miembros:data");
  }
  return c.redirect("/admin/miembros?ok=1&fresh=1");
});

export default miembros;
