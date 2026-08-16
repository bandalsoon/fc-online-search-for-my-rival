const API_ROOT = "https://open.api.nexon.com/fconline/v1";
const META_ROOT = "https://open.api.nexon.com/static/fconline/meta";
const IMAGE_ROOT = "https://open.api.nexon.com/live/externalAssets/common/players";

export const DEFAULT_HOME = "새로운성연합";
export const DEFAULT_RIVAL = "피버슛";
export const FRIENDLY_MATCH_TYPE = 40;

const MATCH_PAGE_SIZE = 100;
const MAX_MATCH_IDS_PER_USER = 10_000;
const MATCH_DETAIL_CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 15_000;
const METADATA_CACHE_MS = 24 * 60 * 60 * 1000;
const DETAIL_CACHE_MS = 24 * 60 * 60 * 1000;
const ARCHIVE_CACHE_MS = 10 * 60 * 1000;

type NexonErrorBody = { error?: { name?: string; message?: string } };
type PlayerStatus = { goal?: number; assist?: number };
type MatchPlayer = { spId: number; spGrade?: number; spPosition?: number; status?: PlayerStatus };
type MatchInfo = {
  ouid: string;
  nickname: string;
  matchDetail?: { matchResult?: string; matchEndType?: number };
  shoot?: { goalTotal?: number; shootTotal?: number; effectiveShootTotal?: number };
  player?: MatchPlayer[];
};
type MatchDetail = { matchId: string; matchDate: string; matchType: number; matchInfo: MatchInfo[] };
type SpidMeta = { id: number; name: string };
type SeasonMeta = { seasonId: number; className: string; seasonImg?: string };
type MatchTypeMeta = { matchtype: number; desc: string };
type SeasonInfo = { name: string; icon: string | null };
type Metadata = {
  playerNames: Map<number, string>;
  seasons: Map<number, SeasonInfo>;
  matchTypes: Map<number, string>;
};

export type PlayerRanking = {
  spId: number;
  name: string;
  season: string;
  seasonIcon: string | null;
  grade: number;
  goals: number;
  assists: number;
  attackPoints: number;
  attackPointsPerMatch: number;
  appearances: number;
  faceUrl: string;
  actionFaceUrl: string;
  value: null;
};

export class AppError extends Error {
  constructor(public status: number, message: string, public code = "APP_ERROR") {
    super(message);
  }
}

function explainNexonError(status: number, code?: string) {
  const messages: Record<string, string> = {
    OPENAPI00002: "이 API 키에는 FC ONLINE 조회 권한이 없습니다.",
    OPENAPI00003: "넥슨에서 유효하지 않은 사용자 식별자라고 응답했습니다.",
    OPENAPI00004: "넥슨 API 요청값이 올바르지 않습니다.",
    OPENAPI00005: "NEXON_API_KEY가 유효하지 않습니다.",
    OPENAPI00007: "넥슨 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.",
    OPENAPI00009: "넥슨에서 데이터를 준비 중입니다. 잠시 후 다시 시도해 주세요.",
    OPENAPI00010: "현재 FC ONLINE 점검 중입니다.",
    OPENAPI00011: "현재 넥슨 Open API 점검 중입니다.",
  };
  return (code && messages[code]) || `넥슨 API 요청에 실패했습니다. (${status})`;
}

async function nexon<T>(apiKey: string, pathname: string, params: Record<string, string | number> = {}): Promise<T> {
  const key = apiKey.trim();
  if (!key || key === "your_nexon_api_key_here") {
    throw new AppError(503, "NEXON_API_KEY가 설정되지 않았습니다.", "API_KEY_MISSING");
  }
  const url = new URL(`${API_ROOT}${pathname}`);
  Object.entries(params).forEach(([name, value]) => url.searchParams.set(name, String(value)));
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "x-nxopen-api-key": key },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new AppError(504, "넥슨 API 연결 시간이 초과되었습니다.", "NEXON_TIMEOUT");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as NexonErrorBody;
    const code = body.error?.name;
    throw new AppError(response.status, explainNexonError(response.status, code), code || "NEXON_ERROR");
  }
  return response.json() as Promise<T>;
}

async function fetchMeta<T>(filename: string): Promise<T> {
  const response = await fetch(`${META_ROOT}/${filename}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`metadata ${filename}: ${response.status}`);
  return response.json() as Promise<T>;
}

let metadataCache: { expires: number; data: Metadata } | undefined;
async function getMetadata(): Promise<Metadata> {
  if (metadataCache && metadataCache.expires > Date.now()) return metadataCache.data;
  const matchTypes = await fetchMeta<MatchTypeMeta[]>("matchtype.json");
  const friendly = matchTypes.find((type) => type.matchtype === FRIENDLY_MATCH_TYPE);
  if (!friendly || !friendly.desc.includes("클래식 1on1")) {
    throw new AppError(503, "공식 메타데이터에서 클래식 1on1 Match Type을 확인하지 못했습니다.", "MATCH_TYPE_MISMATCH");
  }
  const [players, seasons] = await Promise.all([
    fetchMeta<SpidMeta[]>("spid.json").catch(() => []),
    fetchMeta<SeasonMeta[]>("seasonid.json").catch(() => []),
  ]);
  const data: Metadata = {
    playerNames: new Map(players.map((player) => [player.id, player.name])),
    seasons: new Map(seasons.map((season) => [season.seasonId, { name: season.className, icon: season.seasonImg || null }])),
    matchTypes: new Map(matchTypes.map((type) => [type.matchtype, type.desc])),
  };
  metadataCache = { expires: Date.now() + METADATA_CACHE_MS, data };
  return data;
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

type MatchIdScan = { ids: string[]; pages: number; safetyCapReached: boolean };
async function collectFriendlyMatchIds(apiKey: string, ouid: string): Promise<MatchIdScan> {
  const ids: string[] = [];
  let pages = 0;
  let safetyCapReached = false;
  for (let offset = 0; offset < MAX_MATCH_IDS_PER_USER; offset += MATCH_PAGE_SIZE) {
    const page = await nexon<string[]>(apiKey, "/user/match", {
      ouid,
      matchtype: FRIENDLY_MATCH_TYPE,
      offset,
      limit: MATCH_PAGE_SIZE,
    });
    pages++;
    if (page.length === 0) break;
    ids.push(...page);
    if (ids.length >= MAX_MATCH_IDS_PER_USER) {
      safetyCapReached = true;
      break;
    }
  }
  return { ids: [...new Set(ids)].slice(0, MAX_MATCH_IDS_PER_USER), pages, safetyCapReached };
}

const detailCache = new Map<string, { expires: number; value: Promise<MatchDetail> }>();
function getMatchDetail(apiKey: string, matchId: string) {
  const cached = detailCache.get(matchId);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = nexon<MatchDetail>(apiKey, "/match-detail", { matchid: matchId });
  detailCache.set(matchId, { expires: Date.now() + DETAIL_CACHE_MS, value });
  value.catch(() => detailCache.delete(matchId));
  return value;
}

function createPlayerRow(player: MatchPlayer, metadata: Metadata): PlayerRanking {
  const seasonId = Math.floor(player.spId / 1_000_000);
  const season = metadata.seasons.get(seasonId);
  return {
    spId: player.spId,
    name: metadata.playerNames.get(player.spId) || `선수 ${player.spId}`,
    season: season?.name || "시즌 정보 없음",
    seasonIcon: season?.icon || null,
    grade: player.spGrade || 1,
    goals: 0,
    assists: 0,
    attackPoints: 0,
    attackPointsPerMatch: 0,
    appearances: 0,
    faceUrl: `${IMAGE_ROOT}/p${player.spId}.png`,
    actionFaceUrl: `${IMAGE_ROOT}Action/p${player.spId}.png`,
    value: null,
  };
}

function addPlayers(target: Map<string, PlayerRanking>, players: MatchPlayer[] | undefined, metadata: Metadata) {
  for (const player of players || []) {
    if (!player.status) continue;
    const grade = player.spGrade || 1;
    const key = `${player.spId}:${grade}`;
    const row = target.get(key) || createPlayerRow(player, metadata);
    row.goals += player.status.goal || 0;
    row.assists += player.status.assist || 0;
    row.appearances++;
    row.attackPoints = row.goals + row.assists;
    row.attackPointsPerMatch = Number((row.attackPoints / row.appearances).toFixed(2));
    target.set(key, row);
  }
}

function rankings(players: Map<string, PlayerRanking>) {
  const rows = [...players.values()];
  const tieBreak = (a: PlayerRanking, b: PlayerRanking) => b.attackPoints - a.attackPoints || b.appearances - a.appearances || a.spId - b.spId || a.grade - b.grade;
  return {
    topScorers: [...rows].sort((a, b) => b.goals - a.goals || tieBreak(a, b)).slice(0, 8),
    topAssists: [...rows].sort((a, b) => b.assists - a.assists || tieBreak(a, b)).slice(0, 8),
  };
}

async function buildArchive(apiKey: string, homeNickname: string, rivalNickname: string) {
  const [homeUser, rivalUser, metadata] = await Promise.all([
    nexon<{ ouid: string }>(apiKey, "/id", { nickname: homeNickname }),
    nexon<{ ouid: string }>(apiKey, "/id", { nickname: rivalNickname }),
    getMetadata(),
  ]);
  const [homeScan, rivalScan] = await Promise.all([
    collectFriendlyMatchIds(apiKey, homeUser.ouid),
    collectFriendlyMatchIds(apiKey, rivalUser.ouid),
  ]);
  const combinedMatchIds = homeScan.ids.length + rivalScan.ids.length;
  const uniqueIds = [...new Set([...homeScan.ids, ...rivalScan.ids])];
  let detailSuccess = 0;
  let detailFailed = 0;
  const details = await pooledMap(uniqueIds, MATCH_DETAIL_CONCURRENCY, async (matchId) => {
    try {
      const detail = await getMatchDetail(apiKey, matchId);
      detailSuccess++;
      return detail;
    } catch {
      detailFailed++;
      return null;
    }
  });
  const headToHead = details.filter((match): match is MatchDetail => Boolean(
    match && match.matchType === FRIENDLY_MATCH_TYPE &&
    match.matchInfo.some((user) => user.ouid === homeUser.ouid) &&
    match.matchInfo.some((user) => user.ouid === rivalUser.ouid)
  )).sort((a, b) => Date.parse(b.matchDate) - Date.parse(a.matchDate));

  const homePlayers = new Map<string, PlayerRanking>();
  const rivalPlayers = new Map<string, PlayerRanking>();
  let homeWins = 0, draws = 0, rivalWins = 0, homeGoals = 0, rivalGoals = 0;
  const friendlyMetadataName = metadata.matchTypes.get(FRIENDLY_MATCH_TYPE)!;
  const matches = headToHead.map((match) => {
    const home = match.matchInfo.find((user) => user.ouid === homeUser.ouid)!;
    const rival = match.matchInfo.find((user) => user.ouid === rivalUser.ouid)!;
    const result = home.matchDetail?.matchResult === "승" ? "win" : home.matchDetail?.matchResult === "패" ? "loss" : "draw";
    if (result === "win") homeWins++; else if (result === "loss") rivalWins++; else draws++;
    const homeScore = home.shoot?.goalTotal || 0;
    const rivalScore = rival.shoot?.goalTotal || 0;
    homeGoals += homeScore;
    rivalGoals += rivalScore;
    addPlayers(homePlayers, home.player, metadata);
    addPlayers(rivalPlayers, rival.player, metadata);
    return {
      id: match.matchId,
      date: match.matchDate,
      matchType: FRIENDLY_MATCH_TYPE,
      matchTypeName: `친선 경기 · ${friendlyMetadataName}`,
      result,
      home: { nickname: home.nickname, score: homeScore, shots: home.shoot?.shootTotal || 0, effectiveShots: home.shoot?.effectiveShootTotal || 0 },
      rival: { nickname: rival.nickname, score: rivalScore, shots: rival.shoot?.shootTotal || 0, effectiveShots: rival.shoot?.effectiveShootTotal || 0 },
    };
  });

  const total = matches.length;
  const oldestMatchDate = total ? matches[total - 1].date : null;
  const latestMatchDate = total ? matches[0].date : null;
  return {
    users: {
      home: { nickname: homeNickname, ouid: homeUser.ouid },
      rival: { nickname: rivalNickname, ouid: rivalUser.ouid },
    },
    summary: {
      total, homeWins, draws, rivalWins,
      homeWinRate: total ? Number(((homeWins / total) * 100).toFixed(1)) : 0,
      rivalWinRate: total ? Number(((rivalWins / total) * 100).toFixed(1)) : 0,
      homeGoals,
      rivalGoals,
      homeAverageGoals: total ? Number((homeGoals / total).toFixed(2)) : 0,
      homeAverageAgainst: total ? Number((rivalGoals / total).toFixed(2)) : 0,
      rivalAverageGoals: total ? Number((rivalGoals / total).toFixed(2)) : 0,
      rivalAverageAgainst: total ? Number((homeGoals / total).toFixed(2)) : 0,
      oldestMatchDate,
      latestMatchDate,
    },
    playerStats: { home: rankings(homePlayers), rival: rankings(rivalPlayers) },
    matches,
    scanInfo: {
      matchType: FRIENDLY_MATCH_TYPE,
      matchTypeName: friendlyMetadataName,
      homeMatchIds: homeScan.ids.length,
      rivalMatchIds: rivalScan.ids.length,
      combinedMatchIds,
      duplicateMatchIds: combinedMatchIds - uniqueIds.length,
      uniqueMatchIds: uniqueIds.length,
      detailSuccess,
      detailFailed,
      headToHeadMatches: total,
      homePages: homeScan.pages,
      rivalPages: rivalScan.pages,
      homeSafetyCapReached: homeScan.safetyCapReached,
      rivalSafetyCapReached: rivalScan.safetyCapReached,
      maxPerUser: MAX_MATCH_IDS_PER_USER,
    },
    updatedAt: new Date().toISOString(),
  };
}

const archiveCache = new Map<string, { expires: number; value: Promise<Awaited<ReturnType<typeof buildArchive>>> }>();

export function getArchive(apiKey: string, homeNickname = DEFAULT_HOME, rivalNickname = DEFAULT_RIVAL) {
  const home = homeNickname.trim();
  const rival = rivalNickname.trim();
  if (!home || !rival || home.length > 20 || rival.length > 20) {
    throw new AppError(400, "조회 조건이 올바르지 않습니다.", "INVALID_QUERY");
  }
  if (home === rival) throw new AppError(400, "서로 다른 두 닉네임을 입력해 주세요.", "SAME_NICKNAME");
  const cacheKey = `${home}:${rival}:friendly:${FRIENDLY_MATCH_TYPE}`;
  let cached = archiveCache.get(cacheKey);
  if (!cached || cached.expires <= Date.now()) {
    const value = buildArchive(apiKey, home, rival);
    cached = { expires: Date.now() + ARCHIVE_CACHE_MS, value };
    archiveCache.set(cacheKey, cached);
    value.catch(() => archiveCache.delete(cacheKey));
  }
  return cached.value;
}
