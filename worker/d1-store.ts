import type { ArchiveStore, MatchDetail } from "../server/archive.js";

type D1Result<T> = { results?: T[] };
type D1Statement = { bind(...values: unknown[]): D1Statement; all<T>(): Promise<D1Result<T>>; first<T>(column?: string): Promise<T | null>; run(): Promise<unknown> };
export type D1DatabaseLike = { prepare(query: string): D1Statement; batch(statements: D1Statement[]): Promise<unknown[]> };

export function createD1Store(db: D1DatabaseLike): ArchiveStore {
  return {
    async load(homeOuid, rivalOuid) {
      const rows = await db.prepare("SELECT raw_detail FROM rivalry_matches WHERE home_ouid = ? AND rival_ouid = ? ORDER BY match_date DESC")
        .bind(homeOuid, rivalOuid).all<{ raw_detail: string }>();
      return (rows.results || []).flatMap((row) => {
        try { return [JSON.parse(row.raw_detail) as MatchDetail]; } catch { return []; }
      });
    },
    async save(details, homeOuid, rivalOuid) {
      if (!details.length) return 0;
      const now = new Date().toISOString();
      const statements = details.map((detail) => db.prepare(`
        INSERT INTO rivalry_matches (match_id, match_date, match_type, home_ouid, rival_ouid, raw_detail, fetched_at, last_verified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(match_id) DO UPDATE SET raw_detail = excluded.raw_detail, last_verified_at = excluded.last_verified_at
      `).bind(detail.matchId, detail.matchDate, detail.matchType, homeOuid, rivalOuid, JSON.stringify(detail), now, now));
      for (let index = 0; index < statements.length; index += 50) await db.batch(statements.slice(index, index + 50));
      return details.length;
    },
    async count(homeOuid, rivalOuid) {
      return Number(await db.prepare("SELECT COUNT(*) AS count FROM rivalry_matches WHERE home_ouid = ? AND rival_ouid = ?")
        .bind(homeOuid, rivalOuid).first<number>("count") || 0);
    },
  };
}

