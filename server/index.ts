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

const MATCH_PAGE_SIZE = 100;
// 한 요청이 무한정 길어지거나 Open API 호출 한도를 소진하지 않도록 둔 안전 상한이다.
// 실제 조회는 각 매치 종류에서 빈 페이지가 나오면 즉시 끝나며, 종류별 유저당 최대 10,000건까지 확인한다.
const MAX_MATCH_IDS_PER_TYPE = 10_000;
const MATCH_DETAIL_CONCURRENCY = 4;
const MATCH_TYPE_CONCURRENCY = 2;
const METADATA_CACHE_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_CACHE_MS = 5 * 60 * 1000;

app.use(compression());

type NexonErrorBody = { error?: { name?: string; message?: string } };
type PlayerStatus = { goal?: number; assist?: number; shoot?: number; effectiveShoot?: number };
type MatchPlayer = { spId: number; spPosition?: number; spGrade?: number; status?: PlayerStatus };
type MatchInfo = {
  ouid: string;
  nickname: string;
  matchDetail?: { matchResult?: string; matchEndType?: number };
  shoot?: { goalTotal?: number; shootTotal?: number; effectiveShootTotal?: number };
  pass?: { passTry?: number; passSuccess?: number };
  player?: MatchPlayer[];
};
type MatchDetail = { matchId: string; matchDate: string; matchType: number; matchInfo: MatchInfo[] };
type SpidMeta = { id: number; name: string };
type SeasonMeta = { seasonId: number; className: string; seasonImg?: string };
type MatchTypeMeta = { matchtype: number; desc: string };
type TargetMatchType = { id: number; name: string };
type PlayerRanking = {
  spId: number;
  name: string;
  season: string;
  grade: number;
  goals: number;
  assists: number;
  appearances: number;
  value: number | null;
};
type Metadata = {
  playerNames: Map<number, string>;
  seasons: Map<number, string>;
  matchTypes: MatchTypeMeta[];
};

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

async function fetchMeta<T>(filename: string): Promise<T> {
  const response = await fetch(`${META_ROOT}/${filename}`, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`metadata ${filename}: ${response.status}`);
  return response.json() as Promise<T>;
}

let metadataCache: { expires: number; data: Metadata } | undefined;
async function getMetadata(): Promise<Metadata> {
  if (metadataCache && metadataCache.expires > Date.now()) return metadataCache.data;
  const [players, seasons, matchTypes] = await Promise.all([
    fetchMeta<SpidMeta[]>("spid.json").catch(() => []),
    fetchMeta<SeasonMeta[]>("seasonid.json").catch(() => []),
    fetchMeta<MatchTypeMeta[]>("matchtype.json").catch(() => []),
  ]);
  const data = {
    playerNames: new Map(players.map((player) => [player.id, player.name])),
    seasons: new Map(seasons.map((season) => [season.seasonId, season.className])),
    matchTypes,
  };
  metadataCache = { expires: Date.now() + METADATA_CACHE_MS, data };
  return data;
}

function getTargetMatchTypes(meta: MatchTypeMeta[]): TargetMatchType[] {
  const selected = meta.filter(({ desc }) => {
    const isOneOnOne = /1\s*(on|대)\s*1|친선|공식\s*경기/i.test(desc);
    const excluded = /감독|볼타|리그|스쿼드\s*배틀|아레나/i.test(desc);
    return isOneOnOne && !excluded;
  }).map(({ matchtype, desc }) => ({ id: matchtype, name: desc }));

  // 메타데이터가 일시적으로 실패해도 친선(40), 공식경기(50), 공식 친선(60)은 계속 조회한다.
  return selected.length ? selected : [
    { id: 40, name: "클래식 1on1" },
    { id: 50, name: "공식경기" },
    { id: 60, name: "공식 친선" },
  ];
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

async function collectMatchIds(ouid: string, matchType: number) {
  const ids: string[] = [];
  for (let offset = 0; offset < MAX_MATCH_IDS_PER_TYPE; offset += MATCH_PAGE_SIZE) {
    const page = await nexon<string[]>("/user/match", {
      ouid,
      matchtype: matchType,
      offset,
      limit: MATCH_PAGE_SIZE,
    });
    ids.push(...page);
    if (page.length < MATCH_PAGE_SIZE) break;
  }
  return ids;
}

const querySchema = z.object({
  home: z.string().trim().min(1).max(20).default(DEFAULT_HOME),
  rival: z.string().trim().min(1).max(20).default(DEFAULT_RIVAL),
});

const archiveCache = new Map<string, { expires: number; value: Promise<unknown> }>();

async function buildArchive(homeNickname: string, rivalNickname: string) {
  const [homeId, rivalId, metadata] = await Promise.all([
    nexon<{ ouid: string }>("/id", { nickname: homeNickname }),
    nexon<{ ouid: string }>("/id", { nickname: rivalNickname }),
    getMetadata(),
  ]);
  const targetTypes = getTargetMatchTypes(metadata.matchTypes);
  const perType = await pooledMap(targetTypes, MATCH_TYPE_CONCURRENCY, async (matchType) => {
    const [homeIds, rivalIds] = await Promise.all([
      collectMatchIds(homeId.ouid, matchType.id),
      collectMatchIds(rivalId.ouid, matchType.id),
    ]);
    const rivalSet = new Set(rivalIds);
    return { matchType, homeIds, commonIds: homeIds.filter((id) => rivalSet.has(id)) };
  });

  const allHomeIds = new Set(perType.flatMap((row) => row.homeIds));
  const commonIds = [...new Set(perType.flatMap((row) => row.commonIds))];
  let failedDetails = 0;
  const details = await pooledMap(commonIds, MATCH_DETAIL_CONCURRENCY, async (matchId) => {
    try { return await nexon<MatchDetail>("/match-detail", { matchid: matchId }); }
    catch { failedDetails++; return null; }
  });
  const headToHead = details.filter((match): match is MatchDetail => Boolean(
    match && match.matchInfo.some((user) => user.ouid === rivalId.ouid) && match.matchInfo.some((user) => user.ouid === homeId.ouid)
  )).sort((a, b) => Date.parse(b.matchDate) - Date.parse(a.matchDate));

  const matchTypeNames = new Map(metadata.matchTypes.map((type) => [type.matchtype, type.desc]));
  for (const type of targetTypes) if (!matchTypeNames.has(type.id)) matchTypeNames.set(type.id, type.name);
  const players = new Map<string, PlayerRanking>();
  let wins = 0, draws = 0, losses = 0, totalGoalsFor = 0, totalGoalsAgainst = 0;

  const matches = headToHead.map((match) => {
    const home = match.matchInfo.find((user) => user.ouid === homeId.ouid)!;
    const rival = match.matchInfo.find((user) => user.ouid === rivalId.ouid)!;
    const result = home.matchDetail?.matchResult === "승" ? "win" : home.matchDetail?.matchResult === "패" ? "loss" : "draw";
    if (result === "win") wins++; else if (result === "loss") losses++; else draws++;
    const homeScore = home.shoot?.goalTotal || 0;
    const rivalScore = rival.shoot?.goalTotal || 0;
    totalGoalsFor += homeScore;
    totalGoalsAgainst += rivalScore;

    for (const player of home.player || []) {
      if (!player.status) continue;
      const grade = player.spGrade || 1;
      const key = `${player.spId}:${grade}`;
      const seasonId = Math.floor(player.spId / 1_000_000);
      const row = players.get(key) || {
        spId: player.spId,
        name: metadata.playerNames.get(player.spId) || `선수 ${player.spId}`,
        season: metadata.seasons.get(seasonId) || "시즌 정보 없음",
        grade,
        goals: 0,
        assists: 0,
        appearances: 0,
        value: null,
      };
      row.goals += player.status.goal || 0;
      row.assists += player.status.assist || 0;
      row.appearances++;
      players.set(key, row);
    }

    return {
      id: match.matchId,
      date: match.matchDate,
      matchType: match.matchType,
      matchTypeName: matchTypeNames.get(match.matchType) || `경기 종류 ${match.matchType}`,
      result,
      home: { nickname: home.nickname, score: homeScore, shots: home.shoot?.shootTotal || 0, effectiveShots: home.shoot?.effectiveShootTotal || 0 },
      rival: { nickname: rival.nickname, score: rivalScore, shots: rival.shoot?.shootTotal || 0, effectiveShots: rival.shoot?.effectiveShootTotal || 0 },
    };
  });

  const total = matches.length;
  const ranking = [...players.values()];
  return {
    users: { home: homeNickname, rival: rivalNickname },
    summary: {
      total, wins, draws, losses,
      winRate: total ? Number(((wins / total) * 100).toFixed(1)) : 0,
      totalGoalsFor,
      totalGoalsAgainst,
      averageGoalsFor: total ? Number((totalGoalsFor / total).toFixed(2)) : 0,
      averageGoalsAgainst: total ? Number((totalGoalsAgainst / total).toFixed(2)) : 0,
    },
    matches,
    topScorers: [...ranking].sort((a, b) => b.goals - a.goals || b.appearances - a.appearances).slice(0, 8),
    topAssists: [...ranking].sort((a, b) => b.assists - a.assists || b.appearances - a.appearances).slice(0, 8),
    scanned: {
      totalMatchIds: allHomeIds.size,
      totalMatchTypes: targetTypes.length,
      maxPerMatchType: MAX_MATCH_IDS_PER_TYPE,
      failedDetails,
    },
    updatedAt: new Date().toISOString(),
  };
}

app.get("/api/health", (_req, res) => res.json({ ok: true, apiKeyConfigured: Boolean(API_KEY) }));

app.get("/api/archive", async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    if (query.home === query.rival) throw new AppError(400, "서로 다른 두 닉네임을 입력해 주세요.", "SAME_NICKNAME");
    const cacheKey = `${query.home}:${query.rival}`;
    let cached = archiveCache.get(cacheKey);
    if (!cached || cached.expires <= Date.now()) {
      const value = buildArchive(query.home, query.rival);
      cached = { expires: Date.now() + ARCHIVE_CACHE_MS, value };
      archiveCache.set(cacheKey, cached);
      value.catch(() => archiveCache.delete(cacheKey));
    }
    res.set("Cache-Control", "private, max-age=60").json(await cached.value);
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
