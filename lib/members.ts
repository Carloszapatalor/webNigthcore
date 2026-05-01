import { getTursoClient } from "./turso.ts";

const IDLE_BASE = "https://query.idleclans.com";

interface RecruitmentMember { memberName: string; rank: number }

export async function syncClanMembers() {
  const clanName = Deno.env.get("CLAN_NAME");
  if (!clanName) {
    console.error("Sync error: CLAN_NAME not configured");
    return;
  }

  try {
    const res = await fetch(`${IDLE_BASE}/api/Clan/recruitment/${encodeURIComponent(clanName)}`);
    const data = await res.json();
    
    if (!(data as Record<string, unknown>)?.memberlist) {
      console.error("Sync error: No memberlist in API response");
      return;
    }

    const db = getTursoClient();
    const now = new Date().toISOString();
    
    // Usamos una transacción o simplemente borramos y reinsertamos
    await db.execute(`DELETE FROM clan_members`);
    
    for (const m of (data as { memberlist: RecruitmentMember[] }).memberlist) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO clan_members (member_name, rank, updated_at) VALUES (?, ?, ?)`,
        args: [m.memberName, m.rank, now],
      });
    }
    
    console.log(`Sync successful: ${new Date().toLocaleString()}`);
  } catch (e) {
    console.error("Sync error:", (e as Error).message);
  }
}
