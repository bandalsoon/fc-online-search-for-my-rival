const API_ROOT = "https://open.api.nexon.com/fconline/v1";
const META_ROOT = "https://open.api.nexon.com/static/fconline/meta";
const IMAGE_ROOT = "https://fco.dn.nexoncdn.co.kr/live/externalAssets/common/players";
const PLAYER_ABILITY_URL = "https://fconline.nexon.com/datacenter/PlayerAbility";

export const DEFAULT_HOME = "새로운성연합";
export const DEFAULT_RIVAL = "피버슛";
export const FRIENDLY_MATCH_TYPE = 40;

const PAGE_SIZE = 100;
const MAX_IDS = 10_000;
const CONCURRENCY = 4;
const TIMEOUT = 15_000;
const META_TTL = 86_400_000;
const DETAIL_TTL = 86_400_000;
const ARCHIVE_TTL = 600_000;
const FRIENDLY_NAMES = new Set(["클래식 1on1", "공식 친선"]);

type Status = { goal?: number; assist?: number; spRating?: number; shoot?: number; effectiveShoot?: number; passTry?: number; passSuccess?: number };
export type MatchPlayer = { spId: number; spGrade?: number; spPosition?: number; status?: Status };
type ShootDetail = { goalTime?: number; result?: number; spId?: number; spGrade?: number; assist?: boolean; assistSpId?: number; assistSpI?: number };
export type MatchInfo = {
  ouid: string; nickname: string;
  matchDetail?: { matchResult?: string; matchEndType?: number; possession?: number };
  shoot?: { goalTotal?: number; shootTotal?: number; effectiveShootTotal?: number; shootDetail?: ShootDetail[] };
  shootDetail?: ShootDetail[];
  pass?: { passTry?: number; passSuccess?: number };
  player?: MatchPlayer[];
};
export type MatchDetail = { matchId: string; matchDate: string; matchType: number; matchInfo: MatchInfo[] };
type MatchType = { matchtype: number; desc: string };
type MatchTypeOption = { id: number; name: string };
type Meta = {
  names: Map<number, string>; seasons: Map<number, { name: string; icon: string | null }>;
  positions: Map<number, string>; targetTypes: MatchTypeOption[];
};

export interface ArchiveStore {
  load(homeOuid: string, rivalOuid: string): Promise<MatchDetail[]>;
  save(details: MatchDetail[], homeOuid: string, rivalOuid: string): Promise<number>;
  count(homeOuid: string, rivalOuid: string): Promise<number>;
}

export type PlayerRanking = {
  spId: number; name: string; season: string; seasonIcon: string | null; grade: number;
  goals: number; assists: number; attackPoints: number; attackPointsPerMatch: number; appearances: number;
  faceUrl: string; actionFaceUrl: string; salary: number | null; value: null;
};
type LineupPlayer = PlayerRanking & { position: number; positionName: string; rating: number | null };
type TeamMatch = { nickname: string; score: number; shots: number; effectiveShots: number; possession: number | null; passTry: number; passSuccess: number; formation: string; lineup: LineupPlayer[] };
type ArchiveMatch = { id: string; date: string; matchType: number; result: "win" | "draw" | "loss"; home: TeamMatch; rival: TeamMatch; goals: Array<{ minute: number; side: "home" | "rival"; scorer: string; assist: string | null; score: string }>; mvp: { home: LineupPlayer | null; rival: LineupPlayer | null } };

export class AppError extends Error {
  constructor(public status: number, message: string, public code = "APP_ERROR") { super(message); }
}

function errorMessage(status: number, code?: string) {
  const messages: Record<string, string> = {
    OPENAPI00002: "이 API 키에는 FC ONLINE 조회 권한이 없습니다.", OPENAPI00003: "유효하지 않은 사용자입니다.",
    OPENAPI00004: "넥슨 API 요청값이 올바르지 않습니다.", OPENAPI00005: "NEXON_API_KEY가 유효하지 않습니다.",
    OPENAPI00007: "넥슨 API 호출 한도를 초과했습니다.", OPENAPI00009: "넥슨에서 데이터를 준비 중입니다.",
    OPENAPI00010: "현재 FC ONLINE 점검 중입니다.", OPENAPI00011: "현재 넥슨 Open API 점검 중입니다.",
  };
  return (code && messages[code]) || `넥슨 API 요청에 실패했습니다. (${status})`;
}

async function nexon<T>(key: string, path: string, params: Record<string, string | number> = {}): Promise<T> {
  if (!key.trim() || key.trim() === "your_nexon_api_key_here") throw new AppError(503, "NEXON_API_KEY가 설정되지 않았습니다.", "API_KEY_MISSING");
  const url = new URL(API_ROOT + path); Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  let response: Response;
  try { response = await fetch(url, { headers: { "x-nxopen-api-key": key.trim() }, signal: AbortSignal.timeout(TIMEOUT) }); }
  catch { throw new AppError(504, "넥슨 API 연결 시간이 초과되었습니다.", "NEXON_TIMEOUT"); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { name?: string } }; const code = body.error?.name;
    throw new AppError(response.status, errorMessage(response.status, code), code || "NEXON_ERROR");
  }
  return response.json() as Promise<T>;
}

async function fetchMeta<T>(name: string): Promise<T> {
  const response = await fetch(`${META_ROOT}/${name}`, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!response.ok) throw new Error(`metadata ${name}: ${response.status}`);
  return response.json() as Promise<T>;
}

let metaCache: { until: number; data: Meta } | undefined;
async function getMeta(): Promise<Meta> {
  if (metaCache && metaCache.until > Date.now()) return metaCache.data;
  const types = await fetchMeta<MatchType[]>("matchtype.json");
  const targetTypes = types.filter((t) => t.matchtype !== 52 && !/감독|공식경기|리그|볼타|AI|연습|훈련/.test(t.desc) && FRIENDLY_NAMES.has(t.desc.trim()))
    .map((t) => ({ id: t.matchtype, name: t.desc.trim() })).sort((a, b) => a.id - b.id);
  if (!targetTypes.some((t) => t.name === "클래식 1on1") || !targetTypes.some((t) => t.name === "공식 친선")) throw new AppError(503, "공식 메타데이터에서 1대1 친선을 확인하지 못했습니다.", "MATCH_TYPE_MISMATCH");
  const [players, seasons, positions] = await Promise.all([
    fetchMeta<Array<{ id: number; name: string }>>("spid.json").catch(() => []),
    fetchMeta<Array<{ seasonId: number; className: string; seasonImg?: string }>>("seasonid.json").catch(() => []),
    fetchMeta<Array<{ spposition: number; desc: string }>>("spposition.json").catch(() => []),
  ]);
  const data: Meta = { names: new Map(players.map((p) => [p.id, p.name])), seasons: new Map(seasons.map((s) => [s.seasonId, { name: s.className, icon: s.seasonImg || null }])), positions: new Map(positions.map((p) => [p.spposition, p.desc])), targetTypes };
  metaCache = { until: Date.now() + META_TTL, data }; return data;
}

async function pool<T, R>(items: T[], mapper: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length); let cursor = 0;
  async function worker() { while (cursor < items.length) { const index = cursor++; output[index] = await mapper(items[index]); } }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker)); return output;
}

type TypeScan = MatchTypeOption & { ids: string[]; pages: number; endOffset: number; safetyCapReached: boolean };
async function collectIds(key: string, ouid: string, types: MatchTypeOption[]) {
  const all = new Set<string>(); const byType: TypeScan[] = []; let pages = 0; let cap = false;
  for (const type of types) {
    const ids: string[] = []; let typePages = 0; let endOffset = 0; let typeCap = false;
    for (let offset = 0; all.size < MAX_IDS; offset += PAGE_SIZE) {
      const limit = Math.min(PAGE_SIZE, MAX_IDS - all.size);
      const page = await nexon<string[]>(key, "/user/match", { ouid, matchtype: type.id, offset, limit });
      pages++; typePages++; endOffset = offset; page.forEach((id) => { ids.push(id); all.add(id); });
      if (page.length < limit) break;
      if (all.size >= MAX_IDS) { cap = typeCap = true; break; }
    }
    byType.push({ ...type, ids: [...new Set(ids)], pages: typePages, endOffset, safetyCapReached: typeCap }); if (cap) break;
  }
  return { ids: [...all], pages, safetyCapReached: cap, byType };
}

const detailCache = new Map<string, { until: number; value: Promise<MatchDetail> }>();
function detail(key: string, id: string) {
  const cached = detailCache.get(id); if (cached && cached.until > Date.now()) return cached.value;
  const value = nexon<MatchDetail>(key, "/match-detail", { matchid: id }); detailCache.set(id, { until: Date.now() + DETAIL_TTL, value }); value.catch(() => detailCache.delete(id)); return value;
}

const salaryCache = new Map<number, { until: number; value: Promise<number | null> }>();
function salary(spId: number) {
  const cached = salaryCache.get(spId); if (cached && cached.until > Date.now()) return cached.value;
  const body = new URLSearchParams({ spid: String(spId), n1Strong: "1", n1Grow: "0", n4TeamColorId: "0", n4TeamColorLv: "0", n4TeamColorId_Enhance: "0", n4TeamColorLv_Enhance: "0", n4TeamColorId_Feature: "0", n1Change: "0", strPlayerImg: "" });
  const value = fetch(PLAYER_ABILITY_URL, { method: "POST", headers: { accept: "text/html", "content-type": "application/x-www-form-urlencoded; charset=UTF-8" }, body: body.toString(), signal: AbortSignal.timeout(TIMEOUT) })
    .then(async (response) => {
      if (!response.ok) return null;
      const html = await response.text();
      const match = html.match(/<div[^>]*class=["'][^"']*\bpay\b[^"']*["'][^>]*>[\s\S]*?<span[^>]*>\s*(\d+)\s*<\/span>/i);
      return match ? Number(match[1]) : null;
    }).catch(() => null);
  salaryCache.set(spId, { until: Date.now() + META_TTL, value }); return value;
}

async function salariesFor(details: MatchDetail[]) {
  const ids = [...new Set(details.flatMap((d) => d.matchInfo.flatMap((info) => (info.player || []).filter((p) => (p.spPosition ?? 28) < 28).map((p) => p.spId))))];
  const values = await pool(ids, async (spId) => [spId, await salary(spId)] as const);
  return new Map<number, number | null>(values);
}

function playerBase(player: MatchPlayer, meta: Meta, salaries: Map<number, number | null>): PlayerRanking {
  const season = meta.seasons.get(Math.floor(player.spId / 1_000_000));
  return { spId: player.spId, name: meta.names.get(player.spId) || `선수 ${player.spId}`, season: season?.name || "시즌 정보 없음", seasonIcon: season?.icon || null,
    grade: player.spGrade || 1, goals: 0, assists: 0, attackPoints: 0, attackPointsPerMatch: 0, appearances: 0,
    faceUrl: `${IMAGE_ROOT}/p${player.spId}.png`, actionFaceUrl: `${IMAGE_ROOT}Action/p${player.spId}.png`, salary: salaries.get(player.spId) ?? null, value: null };
}

function lineupPlayer(player: MatchPlayer, meta: Meta, salaries: Map<number, number | null>): LineupPlayer {
  const goals = player.status?.goal || 0; const assists = player.status?.assist || 0; const position = player.spPosition ?? 28;
  return { ...playerBase(player, meta, salaries), goals, assists, attackPoints: goals + assists, attackPointsPerMatch: goals + assists, appearances: 1,
    position, positionName: meta.positions.get(position) || "SUB", rating: typeof player.status?.spRating === "number" && player.status.spRating > 0 ? Number(player.status.spRating.toFixed(1)) : null };
}

function aggregate(target: Map<string, PlayerRanking>, players: MatchPlayer[] | undefined, meta: Meta, salaries: Map<number, number | null>) {
  for (const p of players || []) {
    if (!p.status) continue; const key = `${p.spId}:${p.spGrade || 1}`; const row = target.get(key) || playerBase(p, meta, salaries);
    row.goals += p.status.goal || 0; row.assists += p.status.assist || 0; row.appearances++; row.attackPoints = row.goals + row.assists; row.attackPointsPerMatch = Number((row.attackPoints / row.appearances).toFixed(2)); target.set(key, row);
  }
}

function ranking(map: Map<string, PlayerRanking>) {
  const rows = [...map.values()]; const tie = (a: PlayerRanking, b: PlayerRanking) => b.attackPoints - a.attackPoints || b.appearances - a.appearances || a.spId - b.spId;
  return { topScorers: [...rows].sort((a, b) => b.goals - a.goals || tie(a, b)).slice(0, 8), topAssists: [...rows].sort((a, b) => b.assists - a.assists || tie(a, b)).slice(0, 8) };
}

function formation(players: Array<{ spPosition?: number }> | undefined) {
  const p = (players || []).map((x) => x.spPosition ?? 28).filter((x) => x < 28);
  const counts = [p.filter((x) => x >= 1 && x <= 8).length, p.filter((x) => x >= 9 && x <= 19).length, p.filter((x) => x >= 20 && x <= 27).length];
  return counts.every(Boolean) ? counts.join("-") : "실제 배치";
}

function team(info: MatchInfo, meta: Meta, salaries: Map<number, number | null>): TeamMatch {
  const lineup = (info.player || []).filter((p) => (p.spPosition ?? 28) < 28).map((p) => lineupPlayer(p, meta, salaries));
  return { nickname: info.nickname, score: info.shoot?.goalTotal || 0, shots: info.shoot?.shootTotal || 0, effectiveShots: info.shoot?.effectiveShootTotal || 0,
    possession: typeof info.matchDetail?.possession === "number" ? info.matchDetail.possession : null, passTry: info.pass?.passTry || 0, passSuccess: info.pass?.passSuccess || 0, formation: formation(info.player), lineup };
}

function result(home: MatchInfo, rival: MatchInfo): ArchiveMatch["result"] {
  if (home.matchDetail?.matchResult === "승") return "win"; if (home.matchDetail?.matchResult === "패") return "loss";
  const a = home.shoot?.goalTotal || 0; const b = rival.shoot?.goalTotal || 0; return a === b ? "draw" : a > b ? "win" : "loss";
}

function goalMinute(raw: number) { const unit = 2 ** 24; const segment = Math.floor(raw / unit); return Math.max(1, Math.floor((raw - segment * unit) / 60) + ([0, 45, 90, 105, 120][segment] || 0) + 1); }
function goals(home: MatchInfo, rival: MatchInfo, meta: Meta) {
  const raw = ([home, rival] as const).flatMap((info, i) => (info.shootDetail || info.shoot?.shootDetail || []).filter((s) => s.result === 3 && typeof s.goalTime === "number" && typeof s.spId === "number").map((shot) => ({ shot, side: (i ? "rival" : "home") as "home" | "rival" }))).sort((a, b) => a.shot.goalTime! - b.shot.goalTime!);
  let a = 0; let b = 0; return raw.map(({ shot, side }) => { if (side === "home") a++; else b++; const assistId = shot.assistSpId || shot.assistSpI; return { minute: goalMinute(shot.goalTime!), side, scorer: meta.names.get(shot.spId!) || `선수 ${shot.spId}`, assist: shot.assist && assistId ? meta.names.get(assistId) || `선수 ${assistId}` : null, score: `${a}-${b}` }; });
}

function buildMatches(details: MatchDetail[], homeOuid: string, rivalOuid: string, meta: Meta, salaries: Map<number, number | null>) {
  const homePlayers = new Map<string, PlayerRanking>(); const rivalPlayers = new Map<string, PlayerRanking>(); const matches: ArchiveMatch[] = [];
  for (const match of details) {
    const h = match.matchInfo.find((x) => x.ouid === homeOuid); const r = match.matchInfo.find((x) => x.ouid === rivalOuid); if (!h || !r) continue;
    aggregate(homePlayers, h.player, meta, salaries); aggregate(rivalPlayers, r.player, meta, salaries); const home = team(h, meta, salaries); const rival = team(r, meta, salaries);
    const best = (rows: LineupPlayer[]) => rows.filter((p) => p.rating !== null).sort((a, b) => (b.rating || 0) - (a.rating || 0))[0] || null;
    matches.push({ id: match.matchId, date: match.matchDate, matchType: match.matchType, result: result(h, r), home, rival, goals: goals(h, r, meta), mvp: { home: best(home.lineup), rival: best(rival.lineup) } });
  }
  matches.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const total = matches.length; const homeWins = matches.filter((m) => m.result === "win").length; const rivalWins = matches.filter((m) => m.result === "loss").length; const draws = total - homeWins - rivalWins;
  const homeGoals = matches.reduce((n, m) => n + m.home.score, 0); const rivalGoals = matches.reduce((n, m) => n + m.rival.score, 0);
  const summary = { total, homeWins, rivalWins, draws, homeWinRate: total ? Number((homeWins / total * 100).toFixed(1)) : 0, rivalWinRate: total ? Number((rivalWins / total * 100).toFixed(1)) : 0,
    homeGoals, rivalGoals, totalGoals: homeGoals + rivalGoals, homeAverageGoals: total ? Number((homeGoals / total).toFixed(2)) : 0, homeAverageAgainst: total ? Number((rivalGoals / total).toFixed(2)) : 0,
    rivalAverageGoals: total ? Number((rivalGoals / total).toFixed(2)) : 0, rivalAverageAgainst: total ? Number((homeGoals / total).toFixed(2)) : 0, oldestMatchDate: matches.at(-1)?.date || null, latestMatchDate: matches[0]?.date || null };
  return { matches, summary, playerStats: { home: ranking(homePlayers), rival: ranking(rivalPlayers) } };
}

type BestPlayer = LineupPlayer & { wins: number; positionScore: number; averageRating: number | null };
type BestCandidate = {
  key: string; raw: MatchPlayer; appearances: number; goals: number; assists: number; wins: number; ratings: number[];
  positions: Map<number, { appearances: number; goals: number; assists: number; wins: number }>;
};

function positionGroup(name: string) {
  if (["LCM", "CM", "RCM", "LDM", "CDM", "RDM"].includes(name)) return "CENTRAL_MID";
  if (["LAM", "RAM", "LM", "RM", "LW", "RW"].includes(name)) return "WIDE";
  if (["CF", "CAM"].includes(name)) return "CENTRAL_ATTACK";
  return name;
}

function bestXi(details: MatchDetail[], ouid: string, meta: Meta, salaries: Map<number, number | null>) {
  const forms = new Map<string, { count: number; positions: number[] }>();
  for (const d of details) { const info = d.matchInfo.find((x) => x.ouid === ouid); if (!info) continue; const positions = (info.player || []).map((p) => p.spPosition ?? 28).filter((p) => p < 28).sort((a, b) => a - b); const key = positions.join(","); const f = forms.get(key) || { count: 0, positions }; f.count++; forms.set(key, f); }
  const selected = [...forms.values()].sort((a, b) => b.count - a.count)[0] || { count: 0, positions: [] };
  const candidateMap = new Map<string, BestCandidate>();
  for (const d of details) {
    const info = d.matchInfo.find((x) => x.ouid === ouid); if (!info) continue;
    for (const p of info.player || []) {
      const position = p.spPosition ?? 28; if (position >= 28) continue;
      const key = `${p.spId}:${p.spGrade || 1}`;
      const candidate: BestCandidate = candidateMap.get(key) || { key, raw: p, appearances: 0, goals: 0, assists: 0, wins: 0, ratings: [], positions: new Map() };
      candidate.raw = p; candidate.appearances++; candidate.goals += p.status?.goal || 0; candidate.assists += p.status?.assist || 0;
      if (info.matchDetail?.matchResult === "승") candidate.wins++; if (p.status?.spRating && p.status.spRating > 0) candidate.ratings.push(p.status.spRating);
      const positionStats = candidate.positions.get(position) || { appearances: 0, goals: 0, assists: 0, wins: 0 };
      positionStats.appearances++; positionStats.goals += p.status?.goal || 0; positionStats.assists += p.status?.assist || 0; if (info.matchDetail?.matchResult === "승") positionStats.wins++;
      candidate.positions.set(position, positionStats); candidateMap.set(key, candidate);
    }
  }
  const candidates = [...candidateMap.values()].filter((candidate) => candidate.appearances >= 10);
  const slotRows = selected.positions.map((position) => {
    const group = positionGroup(meta.positions.get(position) || "SUB");
    const rows = candidates.map((candidate) => {
      const stats = [...candidate.positions].filter(([candidatePosition]) => positionGroup(meta.positions.get(candidatePosition) || "SUB") === group).reduce((sum, [, value]) => ({ appearances: sum.appearances + value.appearances, goals: sum.goals + value.goals, assists: sum.assists + value.assists, wins: sum.wins + value.wins }), { appearances: 0, goals: 0, assists: 0, wins: 0 });
      return { candidate, stats };
    }).filter((row) => row.stats.appearances > 0);
    const maxApps = Math.max(1, ...rows.map((row) => row.stats.appearances)); const maxAttack = Math.max(1, ...rows.map((row) => row.stats.goals + row.stats.assists)); const role = position <= 8 ? .62 : position <= 19 ? .82 : 1;
    return rows.map(({ candidate, stats }) => { const attack = stats.goals + stats.assists; const per = attack / stats.appearances; const sample = Math.min(1, stats.appearances / Math.max(3, selected.count * .35)); const score = ((stats.appearances / maxApps) * 35 + (attack / maxAttack) * 30 * role + Math.min(1, per / 1.5) * 25 * role + (stats.wins / stats.appearances) * 10) * (.72 + .28 * sample); return { key: candidate.key, score, candidate }; }).sort((a, b) => b.score - a.score || b.candidate.appearances - a.candidate.appearances || a.candidate.raw.spId - b.candidate.raw.spId);
  });
  type Assignment = { score: number; picks: Array<{ slot: number; key: string; score: number }> };
  let states = new Map<number, Assignment>([[0, { score: 0, picks: [] }]]);
  for (const candidate of candidates) {
    const next = new Map(states);
    for (const [mask, assignment] of states) for (let slot = 0; slot < slotRows.length; slot++) {
      if (mask & (1 << slot)) continue; const row = slotRows[slot].find((item) => item.key === candidate.key); if (!row) continue;
      const nextMask = mask | (1 << slot); const nextAssignment = { score: assignment.score + row.score, picks: [...assignment.picks, { slot, key: candidate.key, score: row.score }] }; const current = next.get(nextMask); if (!current || nextAssignment.score > current.score) next.set(nextMask, nextAssignment);
    }
    states = next;
  }
  const assignment = [...states.entries()].sort((a, b) => b[1].picks.length - a[1].picks.length || b[1].score - a[1].score)[0]?.[1] || { score: 0, picks: [] };
  const players = assignment.picks.sort((a, b) => a.slot - b.slot).map(({ slot, key, score }) => {
    const candidate = candidateMap.get(key)!; const position = selected.positions[slot]; const attack = candidate.goals + candidate.assists; const base = lineupPlayer(candidate.raw, meta, salaries);
    return { ...base, position, positionName: meta.positions.get(position) || "SUB", appearances: candidate.appearances, goals: candidate.goals, assists: candidate.assists, attackPoints: attack, attackPointsPerMatch: Number((attack / candidate.appearances).toFixed(2)), wins: candidate.wins, positionScore: Number(score.toFixed(2)), averageRating: candidate.ratings.length ? Number((candidate.ratings.reduce((a, b) => a + b, 0) / candidate.ratings.length).toFixed(1)) : null } satisfies BestPlayer;
  });
  return { formation: formation(selected.positions.map((spPosition) => ({ spPosition }))), sampleMatches: selected.count, players };
}

function pct(a: number, b: number) { return b ? Number((a / b * 100).toFixed(1)) : 0; }
function analyze(matches: ArchiveMatch[], homeName: string, rivalName: string) {
  const metrics = (side: "home" | "rival") => { const other = side === "home" ? "rival" : "home"; const rows = matches.map((m) => m[side]); const shots = rows.reduce((n, r) => n + r.shots, 0); const effective = rows.reduce((n, r) => n + r.effectiveShots, 0); const passTry = rows.reduce((n, r) => n + r.passTry, 0); const passSuccess = rows.reduce((n, r) => n + r.passSuccess, 0); const goals = rows.reduce((n, r) => n + r.score, 0); const conceded = matches.reduce((n, m) => n + m[other].score, 0); const oneGoal = matches.filter((m) => Math.abs(m.home.score - m.rival.score) === 1); const won = (m: ArchiveMatch) => side === "home" ? m.result === "win" : m.result === "loss"; return { goalsPerMatch: matches.length ? Number((goals / matches.length).toFixed(2)) : 0, concededPerMatch: matches.length ? Number((conceded / matches.length).toFixed(2)) : 0, shotsPerMatch: matches.length ? Number((shots / matches.length).toFixed(2)) : 0, shotAccuracy: pct(effective, shots), conversion: pct(goals, shots), passCompletion: pct(passSuccess, passTry), oneGoalWinRate: pct(oneGoal.filter(won).length, oneGoal.length), threePlusGoalRate: pct(rows.filter((r) => r.score >= 3).length, rows.length), scorelessRate: pct(rows.filter((r) => r.score === 0).length, rows.length) }; };
  const chronological = [...matches].reverse(); const streak = (side: "home" | "rival", kind: "win" | "unbeaten" | "loss") => { let best = 0; let current = 0; for (const m of chronological) { const r = side === "home" ? m.result : m.result === "win" ? "loss" : m.result === "loss" ? "win" : "draw"; const ok = kind === "unbeaten" ? r !== "loss" : r === kind; current = ok ? current + 1 : 0; best = Math.max(best, current); } return best; }; const better = (kind: "win" | "unbeaten" | "loss") => { const h = streak("home", kind); const r = streak("rival", kind); return h >= r ? { owner: homeName, count: h } : { owner: rivalName, count: r }; };
  const biggest = [...matches].sort((a, b) => Math.abs(b.home.score - b.rival.score) - Math.abs(a.home.score - a.rival.score))[0] || null; const highest = [...matches].sort((a, b) => b.home.score + b.rival.score - a.home.score - a.rival.score)[0] || null; const scoreCounts = new Map<string, number>(); matches.forEach((m) => { const s = `${m.home.score}-${m.rival.score}`; scoreCounts.set(s, (scoreCounts.get(s) || 0) + 1); }); const common = [...scoreCounts].sort((a, b) => b[1] - a[1])[0] || null; const allPlayers = matches.flatMap((m) => [m.home, m.rival].flatMap((t) => t.lineup.map((p) => ({ ...p, nickname: t.nickname, date: m.date })))); const topGoal = [...allPlayers].sort((a, b) => b.goals - a.goals)[0] || null; const topAssist = [...allPlayers].sort((a, b) => b.assists - a.assists)[0] || null;
  return { metrics: { home: metrics("home"), rival: metrics("rival") }, records: { biggestMargin: biggest ? { date: biggest.date, score: `${biggest.home.score}-${biggest.rival.score}`, winner: biggest.result === "draw" ? "무승부" : biggest.result === "win" ? homeName : rivalName } : null, highestScoring: highest ? { date: highest.date, score: `${highest.home.score}-${highest.rival.score}`, total: highest.home.score + highest.rival.score } : null, longestWin: better("win"), longestUnbeaten: better("unbeaten"), longestLoss: better("loss"), commonScore: common ? { score: common[0], count: common[1] } : null, maxPlayerGoals: topGoal && topGoal.goals ? { name: topGoal.name, nickname: topGoal.nickname, value: topGoal.goals, date: topGoal.date } : null, maxPlayerAssists: topAssist && topAssist.assists ? { name: topAssist.name, nickname: topAssist.nickname, value: topAssist.assists, date: topAssist.date } : null, milestones: [1, 50, 100, 200, 500].filter((n) => chronological.length >= n).map((n) => ({ number: n, date: chronological[n - 1].date })) } };
}

function oldest(ids: Set<string>, details: MatchDetail[]) { const dates = details.filter((d) => ids.has(d.matchId)).map((d) => Date.parse(d.matchDate)).filter(Number.isFinite); return dates.length ? new Date(Math.min(...dates)).toISOString() : null; }

async function build(key: string, homeName: string, rivalName: string, store?: ArchiveStore) {
  const [homeUser, rivalUser, meta] = await Promise.all([nexon<{ ouid: string }>(key, "/id", { nickname: homeName }), nexon<{ ouid: string }>(key, "/id", { nickname: rivalName }), getMeta()]);
  const stored = store ? await store.load(homeUser.ouid, rivalUser.ouid).catch(() => []) : [];
  const [homeScan, rivalScan] = await Promise.all([collectIds(key, homeUser.ouid, meta.targetTypes), collectIds(key, rivalUser.ouid, meta.targetTypes)]);
  const combined = homeScan.ids.length + rivalScan.ids.length; const unique = [...new Set([...homeScan.ids, ...rivalScan.ids])]; const storedIds = new Set(stored.map((d) => d.matchId)); const missing = unique.filter((id) => !storedIds.has(id)); let success = 0; let failed = 0;
  const fetched = (await pool(missing, async (id) => { try { const d = await detail(key, id); success++; return d; } catch { failed++; return null; } })).filter((d): d is MatchDetail => Boolean(d)); const typeIds = new Set(meta.targetTypes.map((t) => t.id)); const valid = (d: MatchDetail) => typeIds.has(d.matchType) && d.matchInfo.some((x) => x.ouid === homeUser.ouid) && d.matchInfo.some((x) => x.ouid === rivalUser.ouid); const fresh = fetched.filter(valid); const saved = store ? await store.save(fresh, homeUser.ouid, rivalUser.ouid).catch(() => 0) : 0; const merged = new Map<string, MatchDetail>(); [...stored, ...fresh].filter(valid).forEach((d) => merged.set(d.matchId, d)); const headToHead = [...merged.values()]; const salaries = await salariesFor(headToHead); const all = buildMatches(headToHead, homeUser.ouid, rivalUser.ouid, meta, salaries); const examined = [...stored, ...fetched];
  return { version: "ULTIMATE v4.5", users: { home: { nickname: homeName, ouid: homeUser.ouid }, rival: { nickname: rivalName, ouid: rivalUser.ouid } }, summary: all.summary, playerStats: all.playerStats, matches: all.matches, bestXi: { home: bestXi(headToHead, homeUser.ouid, meta, salaries), rival: bestXi(headToHead, rivalUser.ouid, meta, salaries) }, analysis: analyze(all.matches, homeName, rivalName), database: { enabled: Boolean(store), storedMatches: store ? await store.count(homeUser.ouid, rivalUser.ouid).catch(() => all.summary.total) : 0, loadedMatches: stored.length, savedMatches: saved }, scanInfo: { targetMatchTypes: meta.targetTypes, homeMatchIds: homeScan.ids.length, rivalMatchIds: rivalScan.ids.length, combinedMatchIds: combined, duplicateMatchIds: combined - unique.length, uniqueMatchIds: unique.length, detailSuccess: success, detailFailed: failed, detailLoadedFromDatabase: stored.length, detailRequested: missing.length, headToHeadMatches: all.summary.total, homePages: homeScan.pages, rivalPages: rivalScan.pages, homeOldestMatchDate: oldest(new Set(homeScan.ids), examined), rivalOldestMatchDate: oldest(new Set(rivalScan.ids), examined), homeSafetyCapReached: homeScan.safetyCapReached, rivalSafetyCapReached: rivalScan.safetyCapReached, maxPerUser: MAX_IDS, byMatchType: meta.targetTypes.map((type) => { const h = homeScan.byType.find((x) => x.id === type.id); const r = rivalScan.byType.find((x) => x.id === type.id); return { id: type.id, name: type.name, homeMatchIds: h?.ids.length || 0, rivalMatchIds: r?.ids.length || 0, homePages: h?.pages || 0, rivalPages: r?.pages || 0, homeEndOffset: h?.endOffset || 0, rivalEndOffset: r?.endOffset || 0, homeSafetyCapReached: h?.safetyCapReached || false, rivalSafetyCapReached: r?.safetyCapReached || false }; }) }, updatedAt: new Date().toISOString() };
}

const archiveCache = new Map<string, { until: number; value: Promise<Awaited<ReturnType<typeof build>>> }>();
export function getArchive(key: string, homeNickname = DEFAULT_HOME, rivalNickname = DEFAULT_RIVAL, store?: ArchiveStore) {
  const home = homeNickname.trim(); const rival = rivalNickname.trim(); if (!home || !rival || home.length > 20 || rival.length > 20) throw new AppError(400, "조회 조건이 올바르지 않습니다.", "INVALID_QUERY"); if (home === rival) throw new AppError(400, "서로 다른 두 닉네임을 입력해 주세요.", "SAME_NICKNAME"); const cacheKey = `${home}:${rival}:v4.5:${store ? "db" : "memory"}`; let cached = archiveCache.get(cacheKey); if (!cached || cached.until <= Date.now()) { const value = build(key, home, rival, store); cached = { until: Date.now() + ARCHIVE_TTL, value }; archiveCache.set(cacheKey, cached); value.catch(() => archiveCache.delete(cacheKey)); } return cached.value;
}

