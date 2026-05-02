import { getTursoClient } from "./turso.ts";
import { fetchWithTimeout } from "./cache.ts";

const IDLE_BASE = "https://query.idleclans.com";

interface RecruitmentMember { memberName: string; rank: number }

export async function syncClanMembers() {
  const clanName = Deno.env.get("CLAN_NAME");
  if (!clanName) {
    console.error("Sync error: CLAN_NAME not configured");
    return;
  }

  try {
    const res = await fetchWithTimeout(
      `${IDLE_BASE}/api/Clan/recruitment/${encodeURIComponent(clanName)}`,
      5000,
    );
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

    await db.execute(`DELETE FROM clan_members`);

    const memberlist = (data as { memberlist: RecruitmentMember[] }).memberlist;

    // Fetch offline status con timeout y delay mínimo para no saturar la API
    const memberData = [];
    for (const m of memberlist) {
      try {
        const profileRes = await fetchWithTimeout(
          `${IDLE_BASE}/api/Player/profile/simple/${encodeURIComponent(m.memberName)}`,
          3000,
        );
        if (!profileRes.ok) {
          memberData.push({ ...m, hoursOffline: -1 });
          continue;
        }
        const profile = await profileRes.json();
        memberData.push({ ...m, hoursOffline: profile.hoursOffline ?? -1 });
      } catch {
        // Timeout o error de red — no bloquear el resto de la sync
        memberData.push({ ...m, hoursOffline: -1 });
      }
      // Delay reducido a 30ms para bajar latencia total
      await new Promise(r => setTimeout(r, 30));
    }

    for (const m of memberData) {
      await db.execute({
        sql: `INSERT OR REPLACE INTO clan_members (member_name, rank, hours_offline, updated_at) VALUES (?, ?, ?, ?)`,
        args: [m.memberName, m.rank, m.hoursOffline, now],
      });
    }

    console.log(`Sync successful: ${new Date().toLocaleString()} (${memberData.length} miembros)`);
  } catch (e) {
    console.error("Sync error:", (e as Error).message);
  }
}

