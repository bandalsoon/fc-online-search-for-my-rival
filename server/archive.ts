const API_ROOT = "https://open.api.nexon.com/fconline/v1";
const META_ROOT = "https://open.api.nexon.com/static/fconline/meta";
const IMAGE_ROOT = "https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/players";

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
const INCLUDED_FRIENDLY_NAMES = new Set(["클래식 1on1", "공식 친선"]);

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
type MatchTypeOption = { id: number; name: string };
type SeasonInfo = { name: string; icon: string | null };
type Metadata = {
  playerNames: Map<number, string>;
  seasons: Map<number, SeasonInfo>;
  matchTypes: Map<number, string>;
  targetMatchTypes: MatchTypeOption[];
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

type ArchiveMatch = {
  id: string;
  date: string;
  matchType: number;
  matchTypeName: string;
  result: "win" | "draw" | "loss";
  home: { nickname: string; score: number; shots: number; effectiveShots: number };
  rival: { nickname: string; score: number; shots: number; effectiveShots: number };
};

type ArchiveSummary = {
  total: number;
  homeWins: number;
  draws: number;
  rivalWins: number;
  homeWinRate: number;
  rivalWinRate: number;
  homeGoals: number;
  rivalGoals: number;
  totalGoals: number;
  homeAverageGoals: number;
  homeAverageAgainst: number;
  rivalAverageGoals: number;
  rivalAverageAgainst: number;
  oldestMatchDate: string | null;
  latestMatchDate: string | null;
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

function isIncludedFriendlyType(type: MatchTypeMeta) {
  // 감독모드(52), 공식경기, 리그, 볼타는 어떤 경우에도 이 아카이브에 넣지 않는다.
  if (type.matchtype === 52 || /감독|공식경기|리그|볼타|AI|연습|훈련/.test(type.desc)) return false;
  return INCLUDED_FRIENDLY_NAMES.has(type.desc.trim());
}

let metadataCache: { expires: number; data: Metadata } | undefined;
async function getMetadata(): Promise<Metadata> {
  if (metadataCache && metadataCache.expires > Date.now()) return metadataCache.data;
  const matchTypes = await fetchMeta<MatchTypeMeta[]>("matchtype.json");
  const targetMatchTypes = matchTypes
    .filter(isIncludedFriendlyType)
    .map((type) => ({ id: type.matchtype, name: type.desc.trim() }))
    .sort((a, b) => a.id - b.id);
  const classic = targetMatchTypes.find((type) => type.name === "클래식 1on1");
  const officialFriendly = targetMatchTypes.find((type) => type.name === "공식 친선");
  if (!classic || !officialFriendly) {
    throw new AppError(503, "공식 메타데이터에서 1대1 친선 Match Type을 확인하지 못했습니다.", "MATCH_TYPE_MISMATCH");
  }
  const [players, seasons] = await Promise.all([
    fetchMeta<SpidMeta[]>("spid.json").catch(() => []),
    fetchMeta<SeasonMeta[]>("seasonid.json").catch(() => []),
  ]);
  const data: Metadata = {
    playerNames: new Map(players.map((player) => [player.id, player.name])),
    seasons: new Map(seasons.map((season) => [season.seasonId, { name: season.className, icon: season.seasonImg || null }])),
    matchTypes: new Map(matchTypes.map((type) => [type.matchtype, type.desc.trim()])),
    targetMatchTypes,
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

type MatchTypeScan = MatchTypeOption & { ids: string[]; pages: number; endOffset: number; safetyCapReached: boolean };
type AccountScan = { ids: string[]; pages: number; safetyCapReached: boolean; byMatchType: MatchTypeScan[] };

async function collectMatchIds(apiKey: string, ouid: string, matchTypes: MatchTypeOption[]): Promise<AccountScan> {
  const unique = new Set<string>();
  const byMatchType: MatchTypeScan[] = [];
  let totalPages = 0;
  let safetyCapReached = false;

  for (const matchType of matchTypes) {
    const ids: string[] = [];
    let pages = 0;
    let endOffset = 0;
    let typeSafetyCapReached = false;
    for (let offset = 0; unique.size < MAX_MATCH_IDS_PER_USER; offset += MATCH_PAGE_SIZE) {
      const remaining = MAX_MATCH_IDS_PER_USER - unique.size;
      const limit = Math.min(MATCH_PAGE_SIZE, remaining);
      const page = await nexon<string[]>(apiKey, "/user/match", {
        ouid,
        matchtype: matchType.id,
        offset,
        limit,
      });
      pages++;
      totalPages++;
      endOffset = offset;
      for (const id of page) {
        ids.push(id);
        unique.add(id);
      }
      if (page.length < limit) break;
      if (unique.size >= MAX_MATCH_IDS_PER_USER) {
        typeSafetyCapReached = true;
        safetyCapReached = true;
        break;
      }
    }
    byMatchType.push({ ...matchType, ids: [...new Set(ids)], pages, endOffset, safetyCapReached: typeSafetyCapReached });
    if (safetyCapReached) break;
  }

  return { ids: [...unique], pages: totalPages, safetyCapReached, byMatchType };
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

function emptySummary(): ArchiveSummary {
  return {
    total: 0, homeWins: 0, draws: 0, rivalWins: 0,
    homeWinRate: 0, rivalWinRate: 0,
    homeGoals: 0, rivalGoals: 0, totalGoals: 0,
    homeAverageGoals: 0, homeAverageAgainst: 0,
    rivalAverageGoals: 0, rivalAverageAgainst: 0,
    oldestMatchDate: null, latestMatchDate: null,
  };
}

function buildArchiveSlice(details: MatchDetail[], homeOuid: string, rivalOuid: string, metadata: Metadata) {
  const homePlayers = new Map<string, PlayerRanking>();
  const rivalPlayers = new Map<string, PlayerRanking>();
  const summary = emptySummary();
  const matches: ArchiveMatch[] = [];

  for (const match of details) {
    const home = match.matchInfo.find((user) => user.ouid === homeOuid);
    const rival = match.matchInfo.find((user) => user.ouid === rivalOuid);
    if (!home || !rival) continue;
    const homeScore = home.shoot?.goalTotal || 0;
    const rivalScore = rival.shoot?.goalTotal || 0;
    const result: ArchiveMatch["result"] = home.matchDetail?.matchResult === "승"
      ? "win"
      : home.matchDetail?.matchResult === "패"
        ? "loss"
        : homeScore === rivalScore ? "draw" : homeScore > rivalScore ? "win" : "loss";
    if (result === "win") summary.homeWins++;
    else if (result === "loss") summary.rivalWins++;
    else summary.draws++;
    summary.homeGoals += homeScore;
    summary.rivalGoals += rivalScore;
    addPlayers(homePlayers, home.player, metadata);
    addPlayers(rivalPlayers, rival.player, metadata);
    matches.push({
      id: match.matchId,
      date: match.matchDate,
      matchType: match.matchType,
      matchTypeName: metadata.matchTypes.get(match.matchType) || `경기 유형 ${match.matchType}`,
      result,
      home: { nickname: home.nickname, score: homeScore, shots: home.shoot?.shootTotal || 0, effectiveShots: home.shoot?.effectiveShootTotal || 0 },
      rival: { nickname: rival.nickname, score: rivalScore, shots: rival.shoot?.shootTotal || 0, effectiveShots: rival.shoot?.effectiveShootTotal || 0 },
    });
  }

  matches.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  summary.total = matches.length;
  summary.totalGoals = summary.homeGoals + summary.rivalGoals;
  summary.homeWinRate = summary.total ? Number(((summary.homeWins / summary.total) * 100).toFixed(1)) : 0;
  summary.rivalWinRate = summary.total ? Number(((summary.rivalWins / summary.total) * 100).toFixed(1)) : 0;
  summary.homeAverageGoals = summary.total ? Number((summary.homeGoals / summary.total).toFixed(2)) : 0;
  summary.homeAverageAgainst = summary.total ? Number((summary.rivalGoals / summary.total).toFixed(2)) : 0;
  summary.rivalAverageGoals = summary.total ? Number((summary.rivalGoals / summary.total).toFixed(2)) : 0;
  summary.rivalAverageAgainst = summary.total ? Number((summary.homeGoals / summary.total).toFixed(2)) : 0;
  summary.latestMatchDate = matches[0]?.date || null;
  summary.oldestMatchDate = matches.at(-1)?.date || null;
  return {
    summary,
    playerStats: { home: rankings(homePlayers), rival: rankings(rivalPlayers) },
    matches,
  };
}

function oldestDateFor(ids: Set<string>, details: MatchDetail[]) {
  const dates = details.filter((detail) => ids.has(detail.matchId)).map((detail) => Date.parse(detail.matchDate)).filter(Number.isFinite);
  return dates.length ? new Date(Math.min(...dates)).toISOString() : null;
}

async function buildArchive(apiKey: string, homeNickname: string, rivalNickname: string) {
  const [homeUser, rivalUser, metadata] = await Promise.all([
    nexon<{ ouid: string }>(apiKey, "/id", { nickname: homeNickname }),
    nexon<{ ouid: string }>(apiKey, "/id", { nickname: rivalNickname }),
    getMetadata(),
  ]);
  const [homeScan, rivalScan] = await Promise.all([
    collectMatchIds(apiKey, homeUser.ouid, metadata.targetMatchTypes),
    collectMatchIds(apiKey, rivalUser.ouid, metadata.targetMatchTypes),
  ]);
  const combinedMatchIds = homeScan.ids.length + rivalScan.ids.length;
  const uniqueIds = [...new Set([...homeScan.ids, ...rivalScan.ids])];
  let detailSuccess = 0;
  let detailFailed = 0;
  const detailResults = await pooledMap(uniqueIds, MATCH_DETAIL_CONCURRENCY, async (matchId) => {
    try {
      const detail = await getMatchDetail(apiKey, matchId);
      detailSuccess++;
      return detail;
    } catch {
      detailFailed++;
      return null;
    }
  });
  const successfulDetails = detailResults.filter((match): match is MatchDetail => Boolean(match));
  const targetIds = new Set(metadata.targetMatchTypes.map((type) => type.id));
  const headToHead = successfulDetails.filter((match) =>
    targetIds.has(match.matchType) &&
    match.matchInfo.some((user) => user.ouid === homeUser.ouid) &&
    match.matchInfo.some((user) => user.ouid === rivalUser.ouid)
  );
  const all = buildArchiveSlice(headToHead, homeUser.ouid, rivalUser.ouid, metadata);
  const matchTypes = metadata.targetMatchTypes
    .map((type) => ({ ...type, count: headToHead.filter((match) => match.matchType === type.id).length }))
    .filter((type) => type.count > 0);
  const summariesByMatchType: Record<string, ArchiveSummary> = {};
  const playerStatsByMatchType: Record<string, ReturnType<typeof rankings> extends infer R ? { home: R; rival: R } : never> = {};
  for (const type of matchTypes) {
    const slice = buildArchiveSlice(headToHead.filter((match) => match.matchType === type.id), homeUser.ouid, rivalUser.ouid, metadata);
    summariesByMatchType[String(type.id)] = slice.summary;
    playerStatsByMatchType[String(type.id)] = slice.playerStats;
  }
  const homeIdSet = new Set(homeScan.ids);
  const rivalIdSet = new Set(rivalScan.ids);
  const byMatchType = metadata.targetMatchTypes.map((type) => {
    const home = homeScan.byMatchType.find((row) => row.id === type.id);
    const rival = rivalScan.byMatchType.find((row) => row.id === type.id);
    return {
      id: type.id,
      name: type.name,
      homeMatchIds: home?.ids.length || 0,
      rivalMatchIds: rival?.ids.length || 0,
      homePages: home?.pages || 0,
      rivalPages: rival?.pages || 0,
      homeEndOffset: home?.endOffset || 0,
      rivalEndOffset: rival?.endOffset || 0,
      homeSafetyCapReached: home?.safetyCapReached || false,
      rivalSafetyCapReached: rival?.safetyCapReached || false,
    };
  });

  return {
    users: {
      home: { nickname: homeNickname, ouid: homeUser.ouid },
      rival: { nickname: rivalNickname, ouid: rivalUser.ouid },
    },
    matchTypes,
    summary: all.summary,
    summariesByMatchType,
    playerStats: all.playerStats,
    playerStatsByMatchType,
    matches: all.matches,
    scanInfo: {
      targetMatchTypes: metadata.targetMatchTypes,
      homeMatchIds: homeScan.ids.length,
      rivalMatchIds: rivalScan.ids.length,
      combinedMatchIds,
      duplicateMatchIds: combinedMatchIds - uniqueIds.length,
      uniqueMatchIds: uniqueIds.length,
      detailSuccess,
      detailFailed,
      headToHeadMatches: all.summary.total,
      homePages: homeScan.pages,
      rivalPages: rivalScan.pages,
      homeOldestMatchDate: oldestDateFor(homeIdSet, successfulDetails),
      rivalOldestMatchDate: oldestDateFor(rivalIdSet, successfulDetails),
      homeSafetyCapReached: homeScan.safetyCapReached,
      rivalSafetyCapReached: rivalScan.safetyCapReached,
      maxPerUser: MAX_MATCH_IDS_PER_USER,
      byMatchType,
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
  const cacheKey = `${home}:${rival}:friendly:v3`;
  let cached = archiveCache.get(cacheKey);
  if (!cached || cached.expires <= Date.now()) {
    const value = buildArchive(apiKey, home, rival);
    cached = { expires: Date.now() + ARCHIVE_CACHE_MS, value };
    archiveCache.set(cacheKey, cached);
    value.catch(() => archiveCache.delete(cacheKey));
  }
  return cached.value;
}
