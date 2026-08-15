import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Crosshair, Handshake, RefreshCw, Shield, Swords, Trophy } from "lucide-react";
import type { Archive, Match, PlayerRanking } from "./types";

const HOME = "새로운성연합";
const RIVAL = "피버슛";
const MATCHES_PER_PAGE = 20;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function MatchRow({ match }: { match: Match }) {
  const labels = { win: "승", draw: "무", loss: "패" };
  return (
    <article className="match-row">
      <div className={`result result-${match.result}`}>{labels[match.result]}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={13} />{formatDate(match.date)}</div>
        <div className="mt-1 truncate font-semibold text-slate-200">{match.matchTypeName}</div>
      </div>
      <div className="scoreboard">
        <span className="truncate text-right text-sm text-slate-300">{match.home.nickname}</span>
        <strong>{match.home.score}</strong><span className="text-slate-600">:</span><strong>{match.rival.score}</strong>
        <span className="truncate text-sm text-slate-300">{match.rival.nickname}</span>
      </div>
      <div className="hidden text-right text-xs text-slate-500 md:block">슈팅 {match.home.shots} : {match.rival.shots}</div>
    </article>
  );
}

function Ranking({ title, kicker, players, kind }: { title: string; kicker: string; players: PlayerRanking[]; kind: "goals" | "assists" }) {
  const Icon = kind === "goals" ? Crosshair : Handshake;
  return (
    <section className="ranking-section">
      <div className="panel-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div><Icon size={20} className="text-slate-600" /></div>
      {players.length ? <div className="space-y-1">{players.map((player, index) => (
        <div className="scorer" key={`${player.spId}:${player.grade}`}>
          <span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1">
            <strong className="block truncate">{player.name}</strong>
            <small className="player-meta"><span>{player.season}</span><span>+{player.grade}</span><span>{player.appearances}경기</span></small>
          </div>
          <div className="goals"><strong>{player[kind]}</strong><small>{kind.toUpperCase()}</small></div>
        </div>
      ))}</div> : <div className="empty small"><Icon size={28} /><p>표시할 기록이 없습니다.</p></div>}
    </section>
  );
}

function Skeleton() {
  return <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <div className="h-20 animate-pulse rounded-2xl bg-white/[0.035]" key={i} />)}</div>;
}

export default function App() {
  const [data, setData] = useState<Archive | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(MATCHES_PER_PAGE);

  const load = useCallback(async () => {
    setLoading(true); setError(""); setVisibleCount(MATCHES_PER_PAGE);
    try {
      const params = new URLSearchParams({ home: HOME, rival: RIVAL });
      const response = await fetch(`/api/archive?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "기록을 불러오지 못했습니다.");
      setData(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "기록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const visibleMatches = useMemo(() => data?.matches.slice(0, visibleCount) || [], [data, visibleCount]);

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b12] text-slate-100">
      <div className="glow glow-a" /><div className="glow glow-b" />
      <main className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="logo"><Swords size={20} /></div><div><div className="text-sm font-bold tracking-[.22em]">RIVAL ARCHIVE</div><div className="mt-0.5 text-[11px] text-slate-500">FC ONLINE · PERSONAL RECORD</div></div></div>
          <button className="refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /><span className="hidden sm:inline">새로고침</span></button>
        </header>

        <section className="hero">
          <div className="player-name"><span className="eyebrow">HOME</span><h1>{HOME}</h1></div>
          <div className="versus"><span>VS</span><small>{data?.summary.total ?? "–"} MATCHES</small></div>
          <div className="player-name text-right"><span className="eyebrow rival">RIVAL</span><h1>{RIVAL}</h1></div>
        </section>

        {error ? (
          <section className="error-card"><Shield size={28} /><div><h2>연결을 확인해 주세요</h2><p>{error}</p></div><button onClick={() => void load()}>다시 시도</button></section>
        ) : (
          <>
            <section className="record-strip">
              <strong>{data?.summary.total ?? "–"}전</strong>
              <span><b className="text-emerald-400">{data?.summary.wins ?? "–"}승</b> · {data?.summary.draws ?? "–"}무 · <b className="text-rose-400">{data?.summary.losses ?? "–"}패</b></span>
              <small>조회된 전체 맞대결 기준</small>
            </section>
            <section className="stats-grid expanded">
              <div className="stat-card featured"><div className="stat-icon"><Trophy size={19} /></div><span>승률</span><strong>{data?.summary.winRate ?? 0}<em>%</em></strong><p>WIN RATE</p></div>
              <div className="stat-card"><span>평균 득점</span><strong className="text-emerald-400">{(data?.summary.averageGoalsFor ?? 0).toFixed(2)}</strong><p>GOALS FOR</p></div>
              <div className="stat-card"><span>평균 실점</span><strong className="text-rose-400">{(data?.summary.averageGoalsAgainst ?? 0).toFixed(2)}</strong><p>GOALS AGAINST</p></div>
            </section>

            <div className="content-grid">
              <section className="panel matches-panel">
                <div className="panel-heading"><div><span className="section-kicker">HEAD TO HEAD</span><h2>맞대결 기록</h2></div><Activity size={20} className="text-slate-600" /></div>
                {loading ? <><p className="loading-copy">전체 기록을 확인하고 있습니다. 첫 조회는 시간이 걸릴 수 있어요.</p><Skeleton /></> : visibleMatches.length ? <>
                  <div>{visibleMatches.map((match) => <MatchRow key={match.id} match={match} />)}</div>
                  {data && visibleCount < data.matches.length && <button className="load-more" onClick={() => setVisibleCount((count) => count + MATCHES_PER_PAGE)}>더 보기 <span>{visibleCount} / {data.matches.length}</span></button>}
                </> : <div className="empty"><Swords size={32} /><strong>맞대결 기록이 없습니다</strong><p>{data?.scanned.totalMatchIds ?? 0}경기 · {data?.scanned.totalMatchTypes ?? 0}개 경기 종류를 확인했습니다.</p></div>}
              </section>

              <aside className="panel rankings-panel">
                {loading ? <Skeleton /> : <>
                  <Ranking title="득점 랭킹" kicker="TOP SCORERS" players={data?.topScorers || []} kind="goals" />
                  <Ranking title="도움 랭킹" kicker="TOP ASSISTS" players={data?.topAssists || []} kind="assists" />
                </>}
              </aside>
            </div>
          </>
        )}

        <footer><span>Data based on NEXON Open API</span><span>{data ? `${data.scanned.totalMatchTypes}개 경기 종류 · ${data.scanned.totalMatchIds.toLocaleString()}경기 확인 · 업데이트 ${formatDate(data.updatedAt)}` : "FC ONLINE 기록 보관소"}</span></footer>
      </main>
    </div>
  );
}
