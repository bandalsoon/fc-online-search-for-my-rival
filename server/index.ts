import compression from "compression";
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const API_ROOT = "https://open.api.nexon.com/fconline/v1";
const META_ROOT = "https://open.api.nexon.com/static/fconline/meta";
const DEFAULT_HOME = "새로운성연합";
const DEFAULT_RIVAL = "피버슛";
const API_KEY = process.env.NEXON_API_KEY?.trim();

app.use(compression());

type NexonErrorBody = { error?: { name?: string; message?: string } };
type PlayerStatus = { goal?: number; assist?: number; shoot?: number; effectiveShoot?: number };
type MatchPlayer = { spId: number; spPosition?: number; spGrade?: number; status?: PlayerStatus };
type MatchInfo = {
  ouid: string; nickname: string;
  matchDetail?: { matchResult?: string; matchEndType?: number };
  shoot?: { goalTotal?: number; shootTotal?: number; effectiveShootTotal?: number };
  pass?: { passTry?: number; passSuccess?: number };
  player?: MatchPlayer[];
};
type MatchDetail = { matchId: string; matchDate: string; matchType: number; matchInfo: MatchInfo[] };
type SpidMeta = { id: number; name: string };

class AppError extends Error {
  constructor(public status: number, message: string, public code = "APP_ERROR") { super(message); }
}

function explainNexonError(status: number, code?: string) {
  const messages: Record<string, string> = {
    OPENAPI00002: "이 API 키에는 FC ONLINE 조회 권한이 없습니다.",
    OPENAPI00003: "넥슨에서 유효하지 않은 사용자 식별자라고 응답했습니다.",
    OPENAPI00004: "넥슨 API 요청값이 올바르지 않습니다.",
    OPENAPI00005: "NEXON_API_KEY가 유효하지 않습니다. 앞뒤 공백 없이 다시 넣어 주세요.",
    OPENAPI00007: "넥슨 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
    OPENAPI00009: "넥슨에서 데이터를 준비 중입니다. 잠시 후 다시 시도해 주세요.",
    OPENAPI00010: "현재 FC ONLINE 점검 중입니다.",
    OPENAPI00011: "현재 넥슨 Open API 점검 중입니다.",
  };
  return (code && messages[code]) || `넥슨 API 요청에 실패했습니다. (${status})`;
}

async function nexon<T>(pathname: string, params: Record<string, string | number> = {}): Promise<T> {
  if (!API_KEY || API_KEY === "your_nexon_api_key_here") {
    throw new AppError(503, "NEXON_API_KEY가 설정되지 않았습니다. .env 파일에 API 키를 넣어 주세요.", "API_KEY_MISSING");
  }
  const url = new URL(`${API_ROOT}${pathname}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value)));
  const response = await fetch(url, { headers: { "x-nxopen-api-key": API_KEY }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as NexonErrorBody;
    const code = body.error?.name;
    throw new AppError(response.status, explainNexonError(response.status, code), code || "NEXON_ERROR");
  }
  return response.json() as Promise<T>;
}

let spidCache: { expires: number; map: Map<number, string> } | undefined;
async function getPlayerNames() {
  if (spidCache && spidCache.expires > Date.now()) return spidCache.map;
  const response = await fetch(`${META_ROOT}/spid.json`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new AppError(502, "선수 이름 정보를 가져오지 못했습니다.", "META_ERROR");
  const data = await response.json() as SpidMeta[];
  const map = new Map(data.map((player) => [player.id, player.name]));
  spidCache = { expires: Date.now() + 24 * 60 * 60 * 1000, map };
  return map;
}

async function pooledMap<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const querySchema = z.object({
  home: z.string().trim().min(1).max(20).default(DEFAULT_HOME),
  rival: z.string().trim().min(1).max(20).default(DEFAULT_RIVAL),
  matchType: z.coerce.number().int().positive().default(50),
  scan: z.coerce.number().int().min(20).max(300).default(100),
});

app.get("/api/health", (_req, res) => res.json({ ok: true, apiKeyConfigured: Boolean(API_KEY) }));

app.get("/api/archive", async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    if (query.home === query.rival) throw new AppError(400, "서로 다른 두 닉네임을 입력해 주세요.", "SAME_NICKNAME");

    const [homeId, rivalId] = await Promise.all([
      nexon<{ ouid: string }>("/id", { nickname: query.home }),
      nexon<{ ouid: string }>("/id", { nickname: query.rival }),
    ]);
    const matchIds: string[] = [];
    for (let offset = 0; offset < query.scan; offset += 100) {
      const page = await nexon<string[]>("/user/match", {
        ouid: homeId.ouid, matchtype: query.matchType, offset, limit: Math.min(100, query.scan - offset),
      });
      matchIds.push(...page);
      if (page.length < Math.min(100, query.scan - offset)) break;
    }

    const details = await pooledMap(matchIds, 6, (matchId) =>
      nexon<MatchDetail>("/match-detail", { matchid: matchId }).catch(() => null)
    );
    const headToHead = details.filter((match): match is MatchDetail => Boolean(
      match && match.matchInfo.some((user) => user.ouid === rivalId.ouid) && match.matchInfo.some((user) => user.ouid === homeId.ouid)
    ));
    const playerNames = await getPlayerNames();
    const scorers = new Map<number, { spId: number; name: string; goals: number; appearances: number }>();
    let wins = 0, draws = 0, losses = 0;

    const matches = headToHead.map((match) => {
      const home = match.matchInfo.find((user) => user.ouid === homeId.ouid)!;
      const rival = match.matchInfo.find((user) => user.ouid === rivalId.ouid)!;
      const result = home.matchDetail?.matchResult === "승" ? "win" : home.matchDetail?.matchResult === "패" ? "loss" : "draw";
      if (result === "win") wins++; else if (result === "loss") losses++; else draws++;
      for (const player of home.player || []) {
        if (!player.status) continue;
        const row = scorers.get(player.spId) || { spId: player.spId, name: playerNames.get(player.spId) || `선수 ${player.spId}`, goals: 0, appearances: 0 };
        row.goals += player.status.goal || 0;
        row.appearances++;
        scorers.set(player.spId, row);
      }
      return {
        id: match.matchId, date: match.matchDate, result,
        home: { nickname: home.nickname, score: home.shoot?.goalTotal || 0, shots: home.shoot?.shootTotal || 0, effectiveShots: home.shoot?.effectiveShootTotal || 0 },
        rival: { nickname: rival.nickname, score: rival.shoot?.goalTotal || 0, shots: rival.shoot?.shootTotal || 0, effectiveShots: rival.shoot?.effectiveShootTotal || 0 },
      };
    });

    res.set("Cache-Control", "private, max-age=60").json({
      users: { home: query.home, rival: query.rival },
      summary: { total: matches.length, wins, draws, losses, winRate: matches.length ? Math.round((wins / matches.length) * 100) : 0 },
      matches,
      topScorers: [...scorers.values()].sort((a, b) => b.goals - a.goals || b.appearances - a.appearances).slice(0, 8),
      scanned: matchIds.length,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) return res.status(400).json({ error: { code: "INVALID_QUERY", message: "조회 조건이 올바르지 않습니다." } });
  if (error instanceof AppError) return res.status(error.status).json({ error: { code: error.code, message: error.message } });
  console.error(error);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "예상하지 못한 오류가 발생했습니다." } });
});

const dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.resolve(dirname, "../dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => console.log(`FC ONLINE archive API: http://localhost:${PORT}`));
