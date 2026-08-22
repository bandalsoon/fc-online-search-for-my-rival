import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { Activity, BarChart3, CalendarDays, ChevronDown, Crosshair, Database, Handshake, RefreshCw, ShieldAlert, Shirt, Swords, UserRound, Users } from "lucide-react";
import type { Archive, ArchiveSummary, BestPlayer, LineupPlayer, Match, PlayerRanking, Side } from "./types";
import { positionedPlayers } from "./formation";

const HOME = "새로운성연합";
const RIVAL = "피버슛";
const PAGE = 20;
type Tab = "overview" | "matches" | "players" | "analysis";

function date(value: string | null, time = false) {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(value));
}

function Face({ player, round = false }: { player: PlayerRanking; round?: boolean }) {
  const [index, setIndex] = useState(0); const sources = [player.faceUrl, player.actionFaceUrl];
  useEffect(() => setIndex(0), [player.faceUrl, player.actionFaceUrl]);
  return <div className={`face ${round ? "round" : ""}`}>{index < sources.length ? <img src={sources[index]} alt="" loading="lazy" onError={() => setIndex((v) => v + 1)} /> : <UserRound />}</div>;
}

function SideSwitch({ side, setSide, data }: { side: Side; setSide: (side: Side) => void; data: Archive }) {
  return <div className="side-switch"><button className={side === "home" ? "active home" : ""} onClick={() => setSide("home")}>{data.users.home.nickname}</button><button className={side === "rival" ? "active rival" : ""} onClick={() => setSide("rival")}>{data.users.rival.nickname}</button></div>;
}

function Duel({ summary, data, side, setSide }: { summary: ArchiveSummary; data: Archive; side: Side; setSide: (s: Side) => void }) {
  const card = (which: Side) => { const home = which === "home"; const wins = home ? summary.homeWins : summary.rivalWins; const losses = home ? summary.rivalWins : summary.homeWins; const rate = home ? summary.homeWinRate : summary.rivalWinRate; const avg = home ? summary.homeAverageGoals : summary.rivalAverageGoals; const against = home ? summary.homeAverageAgainst : summary.rivalAverageAgainst; return <button className={`duelist ${which} ${side === which ? "selected" : ""}`} onClick={() => setSide(which)}><small>{home ? "HOME" : "RIVAL"}</small><h1>{data.users[which].nickname}</h1><div className="record"><b>{wins}승</b><span>{summary.draws}무</span><span>{losses}패</span></div><div className="duel-metrics"><span><b>{rate.toFixed(1)}%</b><i>승률</i></span><span><b>{avg.toFixed(2)}</b><i>평균 득점</i></span><span><b>{against.toFixed(2)}</b><i>평균 실점</i></span></div></button>; };
  return <section className="duel">{card("home")}<div className="vs"><em>VS</em><b>{summary.total}</b><span>맞대결</span></div>{card("rival")}</section>;
}

function Ranking({ title, players, kind }: { title: string; players: PlayerRanking[]; kind: "goals" | "assists" }) {
  return <section className="ranking"><div className="section-head"><h3>{kind === "goals" ? <Crosshair /> : <Handshake />}{title}</h3><span>TOP 8</span></div><div>{players.map((p, i) => <article className={`player-card rank-${i + 1}`} key={`${p.spId}:${p.grade}`}><b className="rank">{i + 1}</b><Face player={p} /><div className="player-copy"><div><span>{p.season}</span><em>+{p.grade}</em></div><strong>{p.name}</strong><small>{p.appearances}경기 · {p.goals}골 · {p.assists}도움 · {p.attackPointsPerMatch.toFixed(2)}P</small></div><strong className="value">{p[kind]}<i>{kind === "goals" ? "골" : "도움"}</i></strong></article>)}</div></section>;
}

function PlayerMarker({ player, best = false, x, y }: { player: LineupPlayer | BestPlayer; best?: boolean; x: number; y: number }) {
  const rating = best ? (player as BestPlayer).averageRating : player.rating;
  return <div className="pitch-player" style={{ "--x": `${x}%`, "--y": `${y}%` } as CSSProperties} data-position={player.positionName} data-x={x} data-y={y}>
    <div className="player-rating">{rating ?? "—"}</div>
    {(player.goals > 0 || player.assists > 0) && <div className="attack-record">{player.goals > 0 && <span>⚽ {player.goals}</span>}{player.goals > 0 && player.assists > 0 && <i />}{player.assists > 0 && <span>👟 {player.assists}</span>}</div>}
    <div className="face-wrap"><Face player={player} round /><span>{player.positionName}</span></div>
    <div className="player-identity"><b className="salary" aria-label={`급여 ${player.salary ?? "정보 없음"}`}>{player.salary ?? "—"}</b>{player.seasonIcon ? <img className="season-sprite" src={player.seasonIcon} alt={player.season} loading="lazy" /> : <span className="season-fallback">{player.season}</span>}<strong>{player.name}</strong><em>+{player.grade}</em></div>
  </div>;
}

function Pitch({ players, formation, best = false }: { players: Array<LineupPlayer | BestPlayer>; formation: string; best?: boolean }) {
  return <div className="pitch"><div className="pitch-label"><Shirt />{formation}</div><div className="field-lines"><i /><i /><i /></div><div className="pitch-players">{positionedPlayers(players).map(({ player, x, y }, index) => <PlayerMarker key={`${player.position}:${player.spId}:${player.grade}:${index}`} player={player} best={best} x={x} y={y} />)}</div></div>;
}

function MatchDetail({ match }: { match: Match }) {
  const metrics = [
    ["점유율", match.home.possession, match.rival.possession, "%"], ["슈팅", match.home.shots, match.rival.shots, ""],
    ["유효 슈팅", match.home.effectiveShots, match.rival.effectiveShots, ""], ["패스", match.home.passTry, match.rival.passTry, ""],
  ] as const;
  return <div className="match-detail"><div className="detail-metrics">{metrics.map(([label, a, b, unit]) => <div key={label}><b>{a ?? "-"}{a !== null ? unit : ""}</b><span>{label}</span><b>{b ?? "-"}{b !== null ? unit : ""}</b></div>)}</div>{match.goals.length > 0 && <div className="timeline"><h4>득점 타임라인</h4>{match.goals.map((g, i) => <div className={g.side} key={`${g.minute}:${i}`}><b>{g.minute}'</b><span>{g.scorer}{g.assist ? ` · 도움 ${g.assist}` : ""}</span><em>{g.score}</em></div>)}</div>}<div className="mvp-row">{(["home", "rival"] as Side[]).map((s) => match.mvp[s] && <div key={s}><span>실제 평점 최고</span><strong>{match.mvp[s]!.name}</strong><b>{match.mvp[s]!.rating}</b></div>)}</div><div className="lineups"><section><h4>{match.home.nickname} · {match.home.formation}</h4><Pitch players={match.home.lineup} formation={match.home.formation} /></section><section><h4>{match.rival.nickname} · {match.rival.formation}</h4><Pitch players={match.rival.lineup} formation={match.rival.formation} /></section></div></div>;
}

function MatchRow({ match }: { match: Match }) {
  const [open, setOpen] = useState(false); const labels = { win: "승", draw: "무", loss: "패" };
  return <article className={`match ${open ? "open" : ""}`}><button className="match-summary" onClick={() => setOpen((v) => !v)} aria-expanded={open}><span className={`result ${match.result}`}>{labels[match.result]}</span><span className="match-date"><CalendarDays />{date(match.date, true)}</span><span className="score"><i>{match.home.nickname}</i><b>{match.home.score}</b><em>:</em><b>{match.rival.score}</b><i>{match.rival.nickname}</i></span><ChevronDown className="chevron" /></button>{open && <MatchDetail match={match} />}</article>;
}

function Overview({ data, side, setSide }: { data: Archive; side: Side; setSide: (s: Side) => void }) {
  return <><Duel summary={data.summary} data={data} side={side} setSide={setSide} /><section className="milestone"><div><span>최초 확인</span><b>{date(data.summary.oldestMatchDate)}</b></div><i /><div><span>현재 확인 범위</span><b>{data.summary.total}경기</b></div><i /><div><span>최근 경기</span><b>{date(data.summary.latestMatchDate)}</b></div></section><div className="overview-best">{(["home", "rival"] as Side[]).map((which) => { const best = data.bestXi[which]; return <section className={`panel best-panel ${which}`} key={which}><div className="panel-head"><div><span>BEST XI</span><h2>{data.users[which].nickname} BEST XI</h2></div><p>최다 사용 {best.formation} · {best.sampleMatches}경기</p></div><Pitch players={best.players} formation={best.formation} best /></section>; })}</div></>;
}

function Matches({ data }: { data: Archive }) {
  const [count, setCount] = useState(PAGE); return <section className="panel"><div className="panel-head"><div><span>MATCH ARCHIVE</span><h2>전체 맞대결</h2></div><p>최신순 · {data.matches.length}경기</p></div>{data.matches.slice(0, count).map((m) => <MatchRow key={m.id} match={m} />)}{count < data.matches.length && <button className="more" onClick={() => setCount((v) => v + PAGE)}>다음 20경기 보기 <span>{count} / {data.matches.length}</span><ChevronDown /></button>}</section>;
}

function Players({ data, side, setSide }: { data: Archive; side: Side; setSide: (s: Side) => void }) {
  const [record, setRecord] = useState<"goals" | "assists">("goals"); const goals = record === "goals";
  return <><SideSwitch side={side} setSide={setSide} data={data} /><div className="record-switch" role="tablist" aria-label="선수 기록 선택"><button role="tab" aria-selected={goals} className={goals ? "active" : ""} onClick={() => setRecord("goals")}><Crosshair />득점왕</button><button role="tab" aria-selected={!goals} className={!goals ? "active" : ""} onClick={() => setRecord("assists")}><Handshake />도움왕</button></div><Ranking title={goals ? "득점왕" : "도움왕"} players={goals ? data.playerStats[side].topScorers : data.playerStats[side].topAssists} kind={record} /></>;
}

function Analysis({ data }: { data: Archive }) {
  const labels: Array<[keyof typeof data.analysis.metrics.home, string, string]> = [["goalsPerMatch", "경기당 득점", ""], ["concededPerMatch", "경기당 실점", ""], ["shotsPerMatch", "경기당 슈팅", ""], ["shotAccuracy", "유효 슈팅률", "%"], ["conversion", "득점 전환율", "%"], ["passCompletion", "패스 성공률", "%"], ["oneGoalWinRate", "1골차 승률", "%"], ["threePlusGoalRate", "3골 이상 비율", "%"], ["scorelessRate", "무득점 비율", "%"]]; const r = data.analysis.records;
  return <><section className="panel"><div className="panel-head"><div><span>RIVAL METRICS</span><h2>라이벌 분석</h2></div></div><div className="analysis-head"><b>{data.users.home.nickname}</b><span>VS</span><b>{data.users.rival.nickname}</b></div><div className="metrics-list">{labels.map(([key, label, unit]) => <div key={key}><b>{data.analysis.metrics.home[key]}{unit}</b><span>{label}</span><b>{data.analysis.metrics.rival[key]}{unit}</b></div>)}</div></section><section className="panel"><div className="panel-head"><div><span>RIVAL RECORDS</span><h2>기록실</h2></div></div><div className="records"><article><span>최대 점수차</span><b>{r.biggestMargin?.score || "-"}</b><small>{r.biggestMargin?.winner}</small></article><article><span>최다 득점 경기</span><b>{r.highestScoring?.score || "-"}</b><small>합계 {r.highestScoring?.total || 0}골</small></article><article><span>최장 연승</span><b>{r.longestWin.count}경기</b><small>{r.longestWin.owner}</small></article><article><span>최장 무패</span><b>{r.longestUnbeaten.count}경기</b><small>{r.longestUnbeaten.owner}</small></article><article><span>최장 연패</span><b>{r.longestLoss.count}경기</b><small>{r.longestLoss.owner}</small></article><article><span>최빈 스코어</span><b>{r.commonScore?.score || "-"}</b><small>{r.commonScore?.count || 0}회</small></article>{r.maxPlayerGoals && <article><span>한 경기 최다 득점</span><b>{r.maxPlayerGoals.value}골</b><small>{r.maxPlayerGoals.name}</small></article>}{r.maxPlayerAssists && <article><span>한 경기 최다 도움</span><b>{r.maxPlayerAssists.value}도움</b><small>{r.maxPlayerAssists.name}</small></article>}</div>{r.milestones.length > 0 && <div className="milestones"><h3>맞대결 이정표</h3>{r.milestones.map((m) => <span key={m.number}><b>{m.number}번째</b>{date(m.date)}</span>)}</div>}</section></>;
}

export default function App() {
  const [data, setData] = useState<Archive | null>(null); const [tab, setTab] = useState<Tab>("overview"); const [side, setSide] = useState<Side>("home"); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/archive?${new URLSearchParams({ home: HOME, rival: RIVAL })}`); const body = await response.json(); if (!response.ok) throw new Error(body.error?.message || "기록을 불러오지 못했습니다."); setData(body); } catch (e) { setError(e instanceof Error ? e.message : "기록을 불러오지 못했습니다."); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]); const tabs = useMemo(() => [{ id: "overview", label: "개요", icon: Swords }, { id: "matches", label: "경기", icon: CalendarDays }, { id: "players", label: "선수기록", icon: Users }, { id: "analysis", label: "분석", icon: BarChart3 }] as const, []);
  return <div className="app"><main><header><div className="brand"><Swords /><div><strong>FC ONLINE RIVAL ARCHIVE</strong><span>새로운성연합 vs 피버슛</span></div></div><button className="refresh" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />새로고침</button></header><nav className="tabs">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}><Icon />{label}</button>)}</nav>{error ? <section className="error"><ShieldAlert /><div><h2>기록을 불러오지 못했어요</h2><p>{error}</p></div><button onClick={() => void load()}>다시 시도</button></section> : loading || !data ? <div className="loading"><Activity className="spin" /><h2>라이벌 기록 동기화 중</h2><p>저장된 아카이브와 Nexon API의 새 경기를 확인하고 있습니다.</p></div> : <>{tab === "overview" && <Overview data={data} side={side} setSide={setSide} />}{tab === "matches" && <Matches data={data} />}{tab === "players" && <Players data={data} side={side} setSide={setSide} />}{tab === "analysis" && <Analysis data={data} />}<details className="diagnostics"><summary><Database />데이터 정보</summary><div><span>Match Type<b>{data.scanInfo.targetMatchTypes.map((t) => t.id).join(", ")}</b></span><span>HOME / RIVAL 조회<b>{data.scanInfo.homeMatchIds} / {data.scanInfo.rivalMatchIds}</b></span><span>Unique IDs<b>{data.scanInfo.uniqueMatchIds}</b></span><span>API 상세 성공 / 실패<b>{data.scanInfo.detailSuccess} / {data.scanInfo.detailFailed}</b></span><span>DB 로드 / 저장<b>{data.database.loadedMatches} / {data.database.savedMatches}</b></span><span>영구 보관 경기<b>{data.database.storedMatches}</b></span></div></details><footer><span>Nexon Open API가 현재 반환하는 범위의 실제 기록만 사용합니다.</span><span>{data.version} · {date(data.updatedAt, true)}</span></footer></>}</main></div>;
}

