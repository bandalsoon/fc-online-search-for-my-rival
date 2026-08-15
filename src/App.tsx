import { useCallback, useEffect, useState } from "react";
import { Activity, CalendarDays, Crosshair, RefreshCw, Shield, Swords, Trophy } from "lucide-react";
import type { Archive, Match } from "./types";

const HOME = "새로운성연합";
const RIVAL = "피버슛";

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
        <div className="mt-1 truncate font-semibold text-slate-200">공식 경기</div>
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

function Skeleton() {
  return <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <div className="h-20 animate-pulse rounded-2xl bg-white/[0.035]" key={i} />)}</div>;
}

export default function App() {
  const [data, setData] = useState<Archive | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ home: HOME, rival: RIVAL, matchType: "50", scan: "200" });
      const response = await fetch(`/api/archive?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "기록을 불러오지 못했습니다.");
      setData(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "기록을 불러오지 못했습니다."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
            <section className="stats-grid">
              <div className="stat-card featured"><div className="stat-icon"><Trophy size={19} /></div><span>승률</span><strong>{data?.summary.winRate ?? 0}<em>%</em></strong><p>맞대결 전체 기준</p></div>
              <div className="stat-card"><span>승리</span><strong className="text-emerald-400">{data?.summary.wins ?? "–"}</strong><p>WIN</p></div>
              <div className="stat-card"><span>무승부</span><strong className="text-slate-300">{data?.summary.draws ?? "–"}</strong><p>DRAW</p></div>
              <div className="stat-card"><span>패배</span><strong className="text-rose-400">{data?.summary.losses ?? "–"}</strong><p>LOSS</p></div>
            </section>

            <div className="content-grid">
              <section className="panel matches-panel">
                <div className="panel-heading"><div><span className="section-kicker">HEAD TO HEAD</span><h2>맞대결 기록</h2></div><Activity size={20} className="text-slate-600" /></div>
                {loading ? <Skeleton /> : data?.matches.length ? <div>{data.matches.map((match) => <MatchRow key={match.id} match={match} />)}</div> : <div className="empty"><Swords size={32} /><strong>맞대결 기록이 없습니다</strong><p>최근 {data?.scanned ?? 0}경기를 확인했습니다.</p></div>}
              </section>

              <aside className="panel scorers-panel">
                <div className="panel-heading"><div><span className="section-kicker">TOP SCORERS</span><h2>득점 랭킹</h2></div><Crosshair size={20} className="text-slate-600" /></div>
                {loading ? <Skeleton /> : data?.topScorers.length ? <div className="space-y-1">{data.topScorers.map((player, index) => (
                  <div className="scorer" key={player.spId}><span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span><div className="min-w-0 flex-1"><strong className="block truncate">{player.name}</strong><small>{player.appearances}경기 출전</small></div><div className="goals"><strong>{player.goals}</strong><small>GOALS</small></div></div>
                ))}</div> : <div className="empty small"><Crosshair size={28} /><p>표시할 득점 기록이 없습니다.</p></div>}
              </aside>
            </div>
          </>
        )}

        <footer><span>Data based on NEXON Open API</span><span>{data ? `업데이트 ${formatDate(data.updatedAt)}` : "FC ONLINE 기록 보관소"}</span></footer>
      </main>
    </div>
  );
}

