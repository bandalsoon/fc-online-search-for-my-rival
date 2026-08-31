import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Activity, BarChart3, CalendarDays, ChevronDown, Crosshair, Database, Handshake, RefreshCw, ShieldAlert, Shirt, Star, Swords, UserRound, Users } from "lucide-react";
import type { Archive, ArchiveSummary, BestPlayer, LineupPlayer, Match, PlayerRanking, Side } from "./types";
import { formationLabel, layoutPair, type LayoutOptions } from "./formation";
import { measureComposite, type CompositeBounds } from "./pitch-measure";
import { passCompletion, selectTeamMom } from "./match-detail";

const HOME = "새로운성연합";
const RIVAL = "피버슛";
const PAGE = 20;
const UI_VERSION = "ULTIMATE v5 PREVIEW";
type Tab = "overview" | "matches" | "players" | "analysis";
const SIDES = ["home", "rival"] as const;
const TABS = [{ id: "overview", label: "개요", icon: Swords }, { id: "matches", label: "경기", icon: CalendarDays }, { id: "players", label: "선수기록", icon: Users }, { id: "analysis", label: "분석", icon: BarChart3 }] as const;
const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function date(value: string | null, time = false) {
  if (!value) return "기록 없음";
  return (time ? DATE_TIME_FORMATTER : DATE_FORMATTER).format(new Date(value));
}

function playerKey(player: Pick<PlayerRanking, "spId" | "grade">) {
  return `${player.spId}:${player.grade}`;
}

function displayFormation(players: Array<Pick<LineupPlayer, "positionName">>) {
  return formationLabel(players.map((player) => player.positionName));
}

function Face({ player, round = false }: { player: PlayerRanking; round?: boolean }) {
  const [index, setIndex] = useState(0);
  const sources = [player.faceUrl, player.actionFaceUrl];
  useEffect(() => setIndex(0), [player.faceUrl, player.actionFaceUrl]);
  return <div className={`face ${round ? "round" : ""}`}>{index < sources.length ? <img src={sources[index]} alt="" loading="lazy" onError={() => setIndex((value) => value + 1)} /> : <UserRound />}</div>;
}

function SideSwitch({ side, setSide, data }: { side: Side; setSide: (side: Side) => void; data: Archive }) {
  return <div className="side-switch"><button className={side === "home" ? "active home" : ""} onClick={() => setSide("home")}>{data.users.home.nickname}</button><button className={side === "rival" ? "active rival" : ""} onClick={() => setSide("rival")}>{data.users.rival.nickname}</button></div>;
}

function Duel({ summary, data }: { summary: ArchiveSummary; data: Archive }) {
  const card = (which: Side) => {
    const home = which === "home";
    const wins = home ? summary.homeWins : summary.rivalWins;
    const losses = home ? summary.rivalWins : summary.homeWins;
    const rate = home ? summary.homeWinRate : summary.rivalWinRate;
    const average = home ? summary.homeAverageGoals : summary.rivalAverageGoals;
    const against = home ? summary.homeAverageAgainst : summary.rivalAverageAgainst;
    return <article className={`duelist ${which}`} aria-label={`${home ? "HOME" : "RIVAL"} ${data.users[which].nickname}`}><small>{home ? "HOME" : "RIVAL"}</small><h1>{data.users[which].nickname}</h1><div className="record"><b>{wins}승</b><span>{summary.draws}무</span><span>{losses}패</span></div><div className="duel-metrics"><span><b>{rate.toFixed(1)}%</b><i>승률</i></span><span><b>{average.toFixed(2)}</b><i>평균 득점</i></span><span><b>{against.toFixed(2)}</b><i>평균 실점</i></span></div></article>;
  };
  return <section className="duel">{card("home")}<div className="vs"><em>VS</em><b>{summary.total}</b><span>맞대결</span></div>{card("rival")}</section>;
}

function Ranking({ title, players, kind }: { title: string; players: PlayerRanking[]; kind: "goals" | "assists" }) {
  return <section className="ranking"><div className="section-head"><h3>{kind === "goals" ? <Crosshair /> : <Handshake />}{title}</h3><span>TOP 8</span></div><div>{players.map((player, index) => <article className={`player-card rank-${index + 1}`} key={playerKey(player)}><b className="rank">{index + 1}</b><Face player={player} /><div className="player-copy"><div><span>{player.season}</span><em>+{player.grade}</em></div><strong>{player.name}</strong><small>{player.appearances}경기 · {player.goals}골 · {player.assists}도움 · {player.attackPointsPerMatch.toFixed(2)}P</small></div><strong className="value">{player[kind]}<i>{kind === "goals" ? "골" : "도움"}</i></strong></article>)}</div></section>;
}

function PlayerMarker({ player, best = false, side, mom = false, x = 0, y = 0, scale = 1, bounds }: { player: LineupPlayer | BestPlayer; best?: boolean; side: Side; mom?: boolean; x?: number; y?: number; scale?: number; bounds?: CompositeBounds }) {
  const rating = best ? (player as BestPlayer).averageRating : player.rating;
  return <div className={`pitch-player ${side} ${mom ? "mom" : ""}`} style={{ "--x": `${x}px`, "--y": `${y}px`, "--scale": scale, "--offset-x": `${-(bounds?.offsetX || 0)}px`, "--offset-y": `${-(bounds?.offsetY || 0)}px` } as CSSProperties} data-position={player.positionName} data-x={x} data-y={y} data-scale={scale}>
    <div className="player-rating">{mom && <span aria-label="팀별 MOM">★</span>}{rating ?? "—"}</div>
    {(player.goals > 0 || player.assists > 0) && <div className="attack-record">{player.goals > 0 && <span>⚽ {player.goals}</span>}{player.goals > 0 && player.assists > 0 && <i />}{player.assists > 0 && <span>👟 {player.assists}</span>}</div>}
    <div className="face-wrap"><Face player={player} round /><span>{player.positionName}</span></div>
    <div className="player-identity"><b className="salary" aria-label={`급여 ${player.salary ?? "정보 없음"}`}>{player.salary ?? "—"}</b>{player.seasonIcon ? <img className="season-sprite" src={player.seasonIcon} alt={player.season} loading="lazy" /> : <span className="season-fallback">{player.season}</span>}<strong>{player.name}</strong><em>+{player.grade}</em></div>
  </div>;
}

type PitchPlayer = LineupPlayer | BestPlayer;
type MarkerSample = { player: PitchPlayer; best: boolean; mom: boolean };
function markerSignature({ player: p, best, mom }: MarkerSample) {
  return JSON.stringify([p.name, p.positionName, p.grade, p.salary, p.seasonIcon ? "sprite" : p.season, best ? (p as BestPlayer).averageRating : p.rating, p.goals, p.assists, mom]);
}
const PitchContext = createContext<{ options: LayoutOptions; bounds: Map<string, CompositeBounds>; ready: boolean }>({ options: { width: 518, height: 758, box: { width: 100, height: 130 }, mobile: false }, bounds: new Map(), ready: false });

function TacticalLayout({ data, children }: { data: Archive; children: ReactNode }) {
  const ruler = useRef<HTMLDivElement>(null), probes = useRef<HTMLDivElement>(null);
  const pairs = useMemo(() => [[data.bestXi.home.players, data.bestXi.rival.players], ...data.matches.map((m) => [m.home.lineup, m.rival.lineup])], [data]);
  const samples = useMemo(() => {
    const unique = new Map<string, MarkerSample>();
    pairs.forEach((pair, index) => pair.forEach((players) => {
      const mom = index ? selectTeamMom(players) : null;
      players.forEach((player) => {
        const sample = { player, best: index === 0, mom: !!mom && playerKey(mom) === playerKey(player) };
        unique.set(markerSignature(sample), sample);
      });
    }));
    return [...unique];
  }, [pairs]);
  const [state, setState] = useState(useContext(PitchContext));
  useLayoutEffect(() => {
    let frame = 0, disposed = false;
    const measure = () => {
      if (disposed || !ruler.current || !probes.current) return;
      const mobile = window.matchMedia("(max-width: 560px)").matches;
      const width = Math.min(mobile ? 390 : 520, ruler.current.getBoundingClientRect().width) - 2;
      if (width <= 0) return;
      const bounds = new Map<string, CompositeBounds>();
      probes.current.querySelectorAll<HTMLElement>(".pitch-player").forEach((el, i) => bounds.set(samples[i][0], measureComposite(el)));
      const boxes = [...bounds.values()];
      const box = { width: Math.ceil(Math.max(1, ...boxes.map((b) => b.width))), height: Math.ceil(Math.max(1, ...boxes.map((b) => b.height))) };
      const options: LayoutOptions = { width, height: mobile ? (width + 2) * 16 / 9 - 2 : 758, box, mobile, gap: window.innerWidth < 360 ? 6 : mobile ? 8 : 12 };
      options.height = Math.ceil(Math.max(options.height, ...pairs.map(([home, rival]) => layoutPair(home, rival, options).height)));
      setState((previous) => JSON.stringify([previous.options, [...previous.bounds]]) === JSON.stringify([options, [...bounds]]) ? previous : { options, bounds, ready: true });
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(ruler.current!);
    probes.current!.querySelectorAll(".pitch-player, .pitch-player *").forEach((el) => observer.observe(el));
    probes.current!.addEventListener("load", schedule, true);
    probes.current!.addEventListener("error", schedule, true);
    window.addEventListener("resize", schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    void document.fonts.ready.then(schedule);
    measure();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      probes.current?.removeEventListener("load", schedule, true);
      probes.current?.removeEventListener("error", schedule, true);
      window.removeEventListener("resize", schedule);
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [samples, pairs]);
  return <PitchContext.Provider value={state}><div className="tactical-layout">
    <div className="pitch-measure" aria-hidden="true" inert><div className="panel"><div className="match-detail"><div ref={ruler} /></div></div><div className="pitch-probes" ref={probes}>{samples.map(([key, sample]) => <PlayerMarker key={key} {...sample} side="home" />)}</div></div>
    {children}
  </div></PitchContext.Provider>;
}

function Pitch({ players, opponents, side, best = false, mom }: { players: PitchPlayer[]; opponents: PitchPlayer[]; side: Side; best?: boolean; mom?: LineupPlayer | null }) {
  const { options, bounds, ready } = useContext(PitchContext);
  const layout = useMemo(() => layoutPair(players, opponents, options).home, [players, opponents, options]);
  const formation = displayFormation(players);
  const momKey = mom ? playerKey(mom) : null;
  return <div className={`pitch ${side}`} style={{ width: options.width + 2, height: options.height + 2, visibility: ready ? undefined : "hidden" }} data-scale={layout.scale} data-readability-review={layout.readabilityReview} data-gap={options.gap} data-box={`${options.box.width}x${options.box.height}`}><div className="pitch-label"><Shirt />{formation}</div><div className="field-lines"><i /><i /><i /></div><div className="pitch-players">{layout.positioned.map(({ player, x, y, scale }, index) => {
    const isMom = !best && momKey === playerKey(player);
    return <PlayerMarker key={`${player.position}:${playerKey(player)}:${index}`} player={player} best={best} side={side} mom={isMom} x={x} y={y} scale={scale} bounds={bounds.get(markerSignature({ player, best, mom: isMom }))} />;
  })}</div></div>;
}

type MetricRow = { label: string; home: number | null; rival: number | null; unit: string; scale: "sum" | "percent" };

function MetricComparison({ match }: { match: Match }) {
  const metrics: MetricRow[] = [
    { label: "유효 슈팅", home: match.home.effectiveShots, rival: match.rival.effectiveShots, unit: "", scale: "sum" },
    { label: "슈팅", home: match.home.shots, rival: match.rival.shots, unit: "", scale: "sum" },
    { label: "점유율", home: match.home.possession, rival: match.rival.possession, unit: "%", scale: "percent" },
    { label: "패스", home: match.home.passTry, rival: match.rival.passTry, unit: "", scale: "sum" },
    { label: "패스 성공률", home: passCompletion(match.home.passSuccess, match.home.passTry), rival: passCompletion(match.rival.passSuccess, match.rival.passTry), unit: "%", scale: "percent" },
  ];
  const width = (value: number | null, other: number | null, scale: MetricRow["scale"]) => {
    if (value === null) return 0;
    if (scale === "percent") return Math.max(0, Math.min(100, value));
    const total = value + (other || 0);
    return total > 0 ? value / total * 100 : 0;
  };
  const text = (value: number | null, unit: string) => value === null ? "데이터 없음" : `${value}${unit}`;
  return <section className="detail-metrics" aria-label="경기 지표 비교"><div className="metric-team-labels"><b>HOME</b><span>경기 지표</span><b>RIVAL</b></div>{metrics.map((metric) => {
    const noGraph = metric.scale === "sum" && (metric.home || 0) + (metric.rival || 0) === 0;
    return <div className={`metric-row ${noGraph ? "no-graph" : ""}`} key={metric.label}><div className="metric-side home"><b>{text(metric.home, metric.unit)}</b><span className="metric-track"><i style={{ "--value": `${width(metric.home, metric.rival, metric.scale)}%` } as CSSProperties} /></span></div><span className="metric-label">{metric.label}</span><div className="metric-side rival"><span className="metric-track"><i style={{ "--value": `${width(metric.rival, metric.home, metric.scale)}%` } as CSSProperties} /></span><b>{text(metric.rival, metric.unit)}</b></div></div>;
  })}</section>;
}

function GoalTimeline({ goals }: { goals: Match["goals"] }) {
  if (!goals.length) return null;
  return <section className="timeline"><h4>득점 타임라인</h4><div className="timeline-axis">{[...goals].sort((a, b) => a.minute - b.minute).map((goal, index) => <div className={`goal-event ${goal.side}`} key={`${goal.minute}:${index}`}><div className="goal-card"><strong>{goal.scorer}</strong>{goal.assist && <span>도움 {goal.assist}</span>}<em>{goal.score}</em></div><div className="goal-minute"><i /><b>{goal.minute}'</b></div></div>)}</div></section>;
}

function TeamMoms({ match, home, rival }: { match: Match; home: LineupPlayer | null; rival: LineupPlayer | null }) {
  if (!home && !rival) return null;
  return <section className="mvp-section"><h4><Star />팀별 MOM</h4><div className="mvp-row">{home && <article className="home"><span>HOME MOM</span><strong>{home.name}</strong><b>★ {home.rating}</b><small>{match.home.nickname}</small></article>}{rival && <article className="rival"><span>RIVAL MOM</span><strong>{rival.name}</strong><b>★ {rival.rating}</b><small>{match.rival.nickname}</small></article>}</div></section>;
}

function MatchDetail({ match }: { match: Match }) {
  const homeMom = selectTeamMom(match.home.lineup);
  const rivalMom = selectTeamMom(match.rival.lineup);
  const homeFormation = displayFormation(match.home.lineup);
  const rivalFormation = displayFormation(match.rival.lineup);
  return <div className="match-detail"><MetricComparison match={match} /><GoalTimeline goals={match.goals} /><TeamMoms match={match} home={homeMom} rival={rivalMom} /><div className="lineups"><section><h4><span>HOME</span>{match.home.nickname} · {homeFormation}</h4><Pitch players={match.home.lineup} opponents={match.rival.lineup} side="home" mom={homeMom} /></section><section><h4><span>RIVAL</span>{match.rival.nickname} · {rivalFormation}</h4><Pitch players={match.rival.lineup} opponents={match.home.lineup} side="rival" mom={rivalMom} /></section></div></div>;
}

function MatchRow({ match }: { match: Match }) {
  const [open, setOpen] = useState(false);
  const labels = { win: "승", draw: "무", loss: "패" };
  return <article className={`match ${open ? "open" : ""}`}><button className="match-summary" onClick={() => setOpen((value) => !value)} aria-expanded={open}><span className={`result ${match.result}`}>{labels[match.result]}</span><span className="match-date"><CalendarDays />{date(match.date, true)}</span><span className="score"><i>{match.home.nickname}</i><b>{match.home.score}</b><em>:</em><b>{match.rival.score}</b><i>{match.rival.nickname}</i></span><ChevronDown className="chevron" /></button>{open && <MatchDetail match={match} />}</article>;
}

function Overview({ data }: { data: Archive }) {
  return <><Duel summary={data.summary} data={data} /><section className="milestone"><div><span>확인된 첫 맞대결</span><b>{date(data.summary.oldestMatchDate)}</b></div><i /><div><span>최근 경기</span><b>{date(data.summary.latestMatchDate)}</b></div></section><div className="overview-best">{SIDES.map((side) => {
    const best = data.bestXi[side];
    const formation = displayFormation(best.players);
    return <section className={`panel best-panel ${side}`} key={side}><div className="panel-head"><div><span>BEST XI</span><h2>{data.users[side].nickname} BEST XI</h2></div><p>최다 사용 {formation} · {best.sampleMatches}경기</p></div><Pitch players={best.players} opponents={data.bestXi[side === "home" ? "rival" : "home"].players} side={side} best /></section>;
  })}</div></>;
}

function Matches({ data }: { data: Archive }) {
  const [count, setCount] = useState(PAGE);
  return <section className="panel"><div className="panel-head"><div><span>MATCH ARCHIVE</span><h2>전체 맞대결</h2></div><p>최신순 · {data.matches.length}경기</p></div>{data.matches.slice(0, count).map((match) => <MatchRow key={match.id} match={match} />)}{count < data.matches.length && <button className="more" onClick={() => setCount((value) => value + PAGE)}>다음 20경기 보기 <span>{count} / {data.matches.length}</span><ChevronDown /></button>}</section>;
}

function Players({ data, side, setSide }: { data: Archive; side: Side; setSide: (side: Side) => void }) {
  const [record, setRecord] = useState<"goals" | "assists">("goals");
  const goals = record === "goals";
  return <><SideSwitch side={side} setSide={setSide} data={data} /><div className="record-switch" role="tablist" aria-label="선수 기록 선택"><button role="tab" aria-selected={goals} className={goals ? "active" : ""} onClick={() => setRecord("goals")}><Crosshair />득점왕</button><button role="tab" aria-selected={!goals} className={!goals ? "active" : ""} onClick={() => setRecord("assists")}><Handshake />도움왕</button></div><Ranking title={goals ? "득점왕" : "도움왕"} players={goals ? data.playerStats[side].topScorers : data.playerStats[side].topAssists} kind={record} /></>;
}

function Analysis({ data }: { data: Archive }) {
  const labels: Array<[keyof typeof data.analysis.metrics.home, string, string]> = [["goalsPerMatch", "경기당 득점", ""], ["concededPerMatch", "경기당 실점", ""], ["shotsPerMatch", "경기당 슈팅", ""], ["shotAccuracy", "유효 슈팅률", "%"], ["conversion", "득점 전환율", "%"], ["passCompletion", "패스 성공률", "%"], ["oneGoalWinRate", "1골차 승률", "%"], ["threePlusGoalRate", "3골 이상 비율", "%"], ["scorelessRate", "무득점 비율", "%"]];
  const records = data.analysis.records;
  return <><section className="panel"><div className="panel-head"><div><span>RIVAL METRICS</span><h2>라이벌 분석</h2></div></div><div className="analysis-head"><b>{data.users.home.nickname}</b><span>VS</span><b>{data.users.rival.nickname}</b></div><div className="metrics-list">{labels.map(([key, label, unit]) => <div key={key}><b>{data.analysis.metrics.home[key]}{unit}</b><span>{label}</span><b>{data.analysis.metrics.rival[key]}{unit}</b></div>)}</div></section><section className="panel"><div className="panel-head"><div><span>RIVAL RECORDS</span><h2>기록실</h2></div></div><div className="records"><article><span>최대 점수차</span><b>{records.biggestMargin?.score || "-"}</b><small>{records.biggestMargin?.winner}</small></article><article><span>최다 득점 경기</span><b>{records.highestScoring?.score || "-"}</b><small>합계 {records.highestScoring?.total || 0}골</small></article><article><span>최장 연승</span><b>{records.longestWin.count}경기</b><small>{records.longestWin.owner}</small></article><article><span>최장 무패</span><b>{records.longestUnbeaten.count}경기</b><small>{records.longestUnbeaten.owner}</small></article><article><span>최장 연패</span><b>{records.longestLoss.count}경기</b><small>{records.longestLoss.owner}</small></article><article><span>최빈 스코어</span><b>{records.commonScore?.score || "-"}</b><small>{records.commonScore?.count || 0}회</small></article>{records.maxPlayerGoals && <article><span>한 경기 최다 득점</span><b>{records.maxPlayerGoals.value}골</b><small>{records.maxPlayerGoals.name}</small></article>}{records.maxPlayerAssists && <article><span>한 경기 최다 도움</span><b>{records.maxPlayerAssists.value}도움</b><small>{records.maxPlayerAssists.name}</small></article>}</div>{records.milestones.length > 0 && <div className="milestones"><h3>맞대결 이정표</h3>{records.milestones.map((milestone) => <span key={milestone.number}><b>{milestone.number}번째</b>{date(milestone.date)}</span>)}</div>}</section></>;
}

export default function App() {
  const [data, setData] = useState<Archive | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [side, setSide] = useState<Side>("home");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/archive?${new URLSearchParams({ home: HOME, rival: RIVAL })}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "기록을 불러오지 못했습니다.");
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <div className="app"><main><header><div className="brand"><Swords /><div><strong>FC ONLINE RIVAL ARCHIVE</strong><span>새로운성연합 vs 피버슛</span></div></div><button className="refresh" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} />새로고침</button></header><nav className="tabs" aria-label="주요 메뉴">{TABS.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon />{label}</button>)}</nav>{error ? <section className="error"><ShieldAlert /><div><h2>기록을 불러오지 못했어요</h2><p>{error}</p></div><button onClick={() => void load()}>다시 시도</button></section> : loading || !data ? <div className="loading"><Activity className="spin" /><h2>라이벌 기록 동기화 중</h2><p>저장된 아카이브와 Nexon API의 새 경기를 확인하고 있습니다.</p></div> : <TacticalLayout data={data}>{tab === "overview" && <Overview data={data} />}{tab === "matches" && <Matches data={data} />}{tab === "players" && <Players data={data} side={side} setSide={setSide} />}{tab === "analysis" && <Analysis data={data} />}<details className="diagnostics"><summary><Database />데이터 정보</summary><p>공식 API가 현재 반환하는 범위와 검증해 영구 보관한 실제 맞대결 기록만 사용합니다.</p></details><footer><span>Nexon Open API가 현재 반환하는 범위의 실제 기록만 사용합니다.</span><span>{UI_VERSION} · 데이터 {data.version} · {date(data.updatedAt, true)}</span></footer></TacticalLayout>}</main></div>;
}


