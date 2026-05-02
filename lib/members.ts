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
    if (!res.ok) {
      const text = await res.text();
      console.error(`Sync error: API returned ${res.status} - ${text.slice(0, 50)}`);
      return;
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.error(`Sync error: Invalid JSON response - ${text.slice(0, 50)}`);
      return;
    }

    if (!data?.memberlist) {
      console.error("Sync error: No memberlist in API response");
      return;
    }

    const db = getTursoClient();
    const now = new Date().toISOString();

    // Usamos una transacción o simplemente borramos y reinsertamos
    await db.execute(`DELETE FROM clan_members`);

    const memberlist = (data as { memberlist: RecruitmentMember[] }).memberlist;
    
    // Fetch offline status sequentially to avoid rate limits
    const memberData = [];
    for (const m of memberlist) {
      try {
        const profileRes = await fetch(`${IDLE_BASE}/api/Player/profile/simple/${encodeURIComponent(m.memberName)}`);
        if (!profileRes.ok) {
          memberData.push({ ...m, hoursOffline: -1 });
          continue;
        }
        const profile = await profileRes.json();
        memberData.push({ ...m, hoursOffline: profile.hoursOffline ?? -1 });
      } catch {
        memberData.push({ ...m, hoursOffline: -1 });
      }
      // Pequeño delay de 50ms para no saturar la API
      await new Promise(r => setTimeout(r, 50));
    }
    
    for (const m of memberData) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO clan_members (member_name, rank, hours_offline, updated_at) VALUES (?, ?, ?, ?)`,
        args: [m.memberName, m.rank, m.hoursOffline, now],
      });
    }

    console.log(`Sync successful: ${new Date().toLocaleString()}`);
  } catch (e) {
    console.error("Sync error:", (e as Error).message);
  }
}
