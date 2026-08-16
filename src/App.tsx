import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Crosshair, Handshake, RefreshCw, Shield, Swords, UserRound } from "lucide-react";
import type { Archive, Match, PlayerRanking } from "./types";

const HOME = "새로운성연합";
const RIVAL = "피버슛";
const MATCHES_PER_PAGE = 20;
type Side = "home" | "rival";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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
      <div className="hidden text-right text-xs text-slate-500 md:block">슈팅 {match.home.shots} : {match.rival.shots}<br />유효 {match.home.effectiveShots} : {match.rival.effectiveShots}</div>
    </article>
  );
}

function PlayerFace({ player }: { player: PlayerRanking }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sources = [player.faceUrl, player.actionFaceUrl].filter(Boolean);
  useEffect(() => setSourceIndex(0), [player.faceUrl, player.actionFaceUrl]);
  return (
    <div className="player-face">
      {sourceIndex < sources.length && <img src={sources[sourceIndex]} alt="" loading="lazy" onError={() => setSourceIndex((index) => index + 1)} />}
      {sourceIndex >= sources.length && <UserRound size={27} aria-label="선수 이미지 없음" />}
    </div>
  );
}

function Ranking({ title, kicker, players, kind }: { title: string; kicker: string; players: PlayerRanking[]; kind: "goals" | "assists" }) {
  const Icon = kind === "goals" ? Crosshair : Handshake;
  return (
    <section className="ranking-section">
      <div className="panel-heading"><div><span className="section-kicker">{kicker}</span><h2>{title}</h2></div><Icon size={20} className="text-slate-600" /></div>
      {players.length ? <div className="space-y-1">{players.map((player, index) => (
        <div className={`scorer scorer-${index + 1}`} key={`${player.spId}:${player.grade}`}>
          <span className={`rank rank-${index + 1}`}>{String(index + 1).padStart(2, "0")}</span>
          <PlayerFace player={player} />
          <div className="min-w-0 flex-1">
            <div className="player-season-row">
              {player.seasonIcon && <img src={player.seasonIcon} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
              <span className="season-badge">{player.season}</span><span className="grade-badge">+{player.grade}</span>
            </div>
            <strong className="player-name-small">{player.name}</strong>
            <small className="player-record">{player.goals}골 · {player.assists}도움 · {player.appearances}경기</small>
          </div>
          <div className="goals"><strong>{player[kind]}</strong><small>{kind.toUpperCase()}</small><em>{player.attackPoints} 공격P</em></div>
        </div>
      ))}</div> : <div className="empty small"><Icon size={28} /><p>표시할 기록이 없습니다.</p></div>}
    </section>
  );
}

function UserCard({ side, selected, data, onSelect }: { side: Side; selected: boolean; data: Archive | null; onSelect: () => void }) {
  const isHome = side === "home";
  const nickname = data?.users[side].nickname || (isHome ? HOME : RIVAL);
  const wins = data ? (isHome ? data.summary.homeWins : data.summary.rivalWins) : 0;
  const losses = data ? (isHome ? data.summary.rivalWins : data.summary.homeWins) : 0;
  const winRate = data ? (isHome ? data.summary.homeWinRate : data.summary.rivalWinRate) : 0;
  const averageGoals = data ? (isHome ? data.summary.homeAverageGoals : data.summary.rivalAverageGoals) : 0;
  const averageAgainst = data ? (isHome ? data.summary.homeAverageAgainst : data.summary.rivalAverageAgainst) : 0;
  return (
    <button className={`user-card ${isHome ? "home" : "rival"} ${selected ? "selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <span className="eyebrow">{isHome ? "HOME" : "RIVAL"}</span>
      <h1>{nickname}</h1>
      <div className="user-record"><strong>{wins}승</strong><span>{data?.summary.draws ?? 0}무</span><span>{losses}패</span></div>
      <div className="user-metrics"><span><b>{winRate.toFixed(1)}%</b> 승률</span><span><b>{averageGoals.toFixed(2)}</b> 평균 득점</span><span><b>{averageAgainst.toFixed(2)}</b> 평균 실점</span></div>
      <small>{selected ? "선수 통계 보는 중" : "클릭해 선수 통계 보기"}</small>
    </button>
  );
}

function Skeleton() {
  return <div className="space-y-3">{Array.from({ length: 5 }, (_, i) => <div className="h-20 animate-pulse rounded-2xl bg-white/[0.035]" key={i} />)}</div>;
}

export default function App() {
  const [data, setData] = useState<Archive | null>(null);
  const [selected, setSelected] = useState<Side>("home");
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
  const selectedStats = data?.playerStats[selected];

  return (
    <div className="min-h-screen overflow-hidden bg-[#080b12] text-slate-100">
      <div className="glow glow-a" /><div className="glow glow-b" />
      <main className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="logo"><Swords size={20} /></div><div><div className="text-sm font-bold tracking-[.22em]">RIVAL ARCHIVE</div><div className="mt-0.5 text-[11px] text-slate-500">FC ONLINE · FRIENDLY HISTORY</div></div></div>
          <button className="refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""} /><span className="hidden sm:inline">새로고침</span></button>
        </header>

        <section className="duel-grid">
          <UserCard side="home" selected={selected === "home"} data={data} onSelect={() => setSelected("home")} />
          <div className="versus-center"><span>VS</span><strong>{data?.summary.total ?? "–"}</strong><small>FRIENDLY MATCHES</small><em>{data?.summary.draws ?? "–"} DRAW</em></div>
          <UserCard side="rival" selected={selected === "rival"} data={data} onSelect={() => setSelected("rival")} />
        </section>

        {error ? (
          <section className="error-card"><Shield size={28} /><div><h2>연결을 확인해 주세요</h2><p>{error}</p></div><button onClick={() => void load()}>다시 시도</button></section>
        ) : (
          <div className="content-grid">
            <section className="panel matches-panel">
              <div className="panel-heading"><div><span className="section-kicker">HEAD TO HEAD</span><h2>친선 경기 기록</h2></div><Activity size={20} className="text-slate-600" /></div>
              {loading ? <><p className="loading-copy">양쪽 계정의 전체 친선 기록을 확인하고 있습니다. 첫 조회는 시간이 걸릴 수 있어요.</p><Skeleton /></> : visibleMatches.length ? <>
                <div>{visibleMatches.map((match) => <MatchRow key={match.id} match={match} />)}</div>
                {data && visibleCount < data.matches.length && <button className="load-more" onClick={() => setVisibleCount((count) => count + MATCHES_PER_PAGE)}>더 보기 <span>{Math.min(visibleCount, data.matches.length)} / {data.matches.length}</span></button>}
              </> : <div className="empty"><Swords size={32} /><strong>친선 맞대결 기록이 없습니다</strong><p>양쪽에서 찾은 {data?.scanInfo.uniqueMatchIds ?? 0}개의 고유 경기 기록을 확인했습니다.</p></div>}
            </section>

            <aside className="panel rankings-panel">
              <div className="selected-user-label"><span>PLAYER RECORDS</span><strong>{data?.users[selected].nickname || (selected === "home" ? HOME : RIVAL)}</strong></div>
              {loading ? <Skeleton /> : <>
                <Ranking title="득점왕" kicker="TOP SCORERS" players={selectedStats?.topScorers || []} kind="goals" />
                <Ranking title="도움왕" kicker="TOP ASSISTS" players={selectedStats?.topAssists || []} kind="assists" />
              </>}
            </aside>
          </div>
        )}

        {data && <details className="scan-info" aria-label="조회 진단 정보">
          <summary>데이터 정보 · Match Type {data.scanInfo.matchType}</summary>
          <div>
            <span>{data.users.home.nickname} <b>{data.scanInfo.homeMatchIds.toLocaleString()}</b> ({data.scanInfo.homePages}p)</span>
            <span>{data.users.rival.nickname} <b>{data.scanInfo.rivalMatchIds.toLocaleString()}</b> ({data.scanInfo.rivalPages}p)</span>
            <span>합계/중복 <b>{data.scanInfo.combinedMatchIds.toLocaleString()} / {data.scanInfo.duplicateMatchIds.toLocaleString()}</b></span>
            <span>고유 경기 <b>{data.scanInfo.uniqueMatchIds.toLocaleString()}</b></span>
            <span>상세 성공/실패 <b>{data.scanInfo.detailSuccess}/{data.scanInfo.detailFailed}</b></span>
            <span>맞대결 <b>{data.scanInfo.headToHeadMatches}</b></span>
            {(data.scanInfo.homeSafetyCapReached || data.scanInfo.rivalSafetyCapReached) && <span className="text-amber-300">더 오래된 기록이 있을 가능성이 있으나 안전상한에 도달함</span>}
          </div>
        </details>}
        <footer><span>Data based on NEXON Open API</span><span>{data ? `${data.summary.oldestMatchDate ? formatDate(data.summary.oldestMatchDate) : "기록 없음"}부터 · 업데이트 ${formatDate(data.updatedAt)}` : "FC ONLINE 친선 기록 보관소"}</span></footer>
      </main>
    </div>
  );
}
