import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, Crosshair, Handshake, RefreshCw, ShieldAlert, Swords, UserRound } from "lucide-react";
import type { Archive, ArchiveSummary, Match, PlayerRanking } from "./types";

const HOME = "새로운성연합";
const RIVAL = "피버슛";
const MATCHES_PER_PAGE = 20;
type Side = "home" | "rival";
type MatchTypeFilter = "all" | number;

function formatDate(value: string | null, includeTime = true) {
  if (!value) return "기록 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "short", day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function MatchRow({ match }: { match: Match }) {
  const labels = { win: "승", draw: "무", loss: "패" };
  return (
    <article className="match-row">
      <div className={`result result-${match.result}`}>{labels[match.result]}</div>
      <div className="match-meta">
        <span><CalendarDays size={13} />{formatDate(match.date)}</span>
        <strong>{match.matchTypeName}</strong>
      </div>
      <div className="scoreboard">
        <span>{match.home.nickname}</span>
        <strong>{match.home.score}</strong><i>:</i><strong>{match.rival.score}</strong>
        <span>{match.rival.nickname}</span>
      </div>
      <div className="shooting">슈팅 {match.home.shots} : {match.rival.shots}<br />유효 슈팅 {match.home.effectiveShots} : {match.rival.effectiveShots}</div>
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
      {sourceIndex >= sources.length && <UserRound size={28} aria-label="선수 이미지 없음" />}
    </div>
  );
}

function Ranking({ title, players, kind }: { title: string; players: PlayerRanking[]; kind: "goals" | "assists" }) {
  const Icon = kind === "goals" ? Crosshair : Handshake;
  const unit = kind === "goals" ? "골" : "도움";
  return (
    <section className="ranking-section">
      <div className="section-title"><div><Icon size={18} /><h3>{title}</h3></div><span>상위 8명</span></div>
      {players.length ? <div className="ranking-list">{players.map((player, index) => (
        <article className={`player-row rank-${index + 1}`} key={`${player.spId}:${player.grade}`}>
          <b className="ranking-number">{index + 1}</b>
          <PlayerFace player={player} />
          <div className="player-main">
            <div className="player-tags">
              {player.seasonIcon && <img src={player.seasonIcon} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
              <span>{player.season}</span><em>+{player.grade}</em>
            </div>
            <strong>{player.name}</strong>
            <small>{player.appearances}경기 · {player.goals}골 · {player.assists}도움 · 경기당 {player.attackPointsPerMatch.toFixed(2)}P</small>
          </div>
          <div className="ranking-value"><strong>{player[kind]}</strong><span>{unit}</span></div>
        </article>
      ))}</div> : <div className="empty compact"><Icon size={26} /><p>표시할 선수 기록이 없습니다.</p></div>}
    </section>
  );
}

function UserCard({ side, selected, summary, nickname, onSelect }: {
  side: Side; selected: boolean; summary: ArchiveSummary | null; nickname: string; onSelect: () => void;
}) {
  const isHome = side === "home";
  const wins = summary ? (isHome ? summary.homeWins : summary.rivalWins) : 0;
  const losses = summary ? (isHome ? summary.rivalWins : summary.homeWins) : 0;
  const winRate = summary ? (isHome ? summary.homeWinRate : summary.rivalWinRate) : 0;
  const goals = summary ? (isHome ? summary.homeGoals : summary.rivalGoals) : 0;
  const averageGoals = summary ? (isHome ? summary.homeAverageGoals : summary.rivalAverageGoals) : 0;
  const averageAgainst = summary ? (isHome ? summary.homeAverageAgainst : summary.rivalAverageAgainst) : 0;
  return (
    <button className={`user-card ${isHome ? "home" : "rival"} ${selected ? "selected" : ""}`} onClick={onSelect} aria-pressed={selected}>
      <span className="side-label">{isHome ? "HOME" : "RIVAL"}</span>
      <h1>{nickname}</h1>
      <div className="record-line"><strong>{wins}승</strong><span>{summary?.draws ?? 0}무</span><span>{losses}패</span></div>
      <div className="user-metrics">
        <span><b>{winRate.toFixed(1)}%</b><small>승률</small></span>
        <span><b>{goals}</b><small>총 득점</small></span>
        <span><b>{averageGoals.toFixed(2)}</b><small>평균 득점</small></span>
        <span><b>{averageAgainst.toFixed(2)}</b><small>평균 실점</small></span>
      </div>
      <em>{selected ? "선수 기록 선택됨" : "눌러서 선수 기록 보기"}</em>
    </button>
  );
}

function Skeleton() {
  return <div className="skeleton-list">{Array.from({ length: 5 }, (_, i) => <div key={i} />)}</div>;
}

export default function App() {
  const [data, setData] = useState<Archive | null>(null);
  const [selected, setSelected] = useState<Side>("home");
  const [matchType, setMatchType] = useState<MatchTypeFilter>("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(MATCHES_PER_PAGE);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setVisibleCount(MATCHES_PER_PAGE);
    try {
      const params = new URLSearchParams({ home: HOME, rival: RIVAL });
      const response = await fetch(`/api/archive?${params}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "기록을 불러오지 못했습니다.");
      setData(body);
      setMatchType("all");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "기록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const summary = matchType === "all" ? data?.summary : data?.summariesByMatchType[String(matchType)];
  const stats = matchType === "all" ? data?.playerStats : data?.playerStatsByMatchType[String(matchType)];
  const filteredMatches = useMemo(() => data?.matches.filter((match) => matchType === "all" || match.matchType === matchType) || [], [data, matchType]);
  const visibleMatches = filteredMatches.slice(0, visibleCount);
  const filterLabel = matchType === "all" ? "전체 친선" : data?.matchTypes.find((type) => type.id === matchType)?.name || "친선";

  function changeMatchType(value: MatchTypeFilter) {
    setMatchType(value);
    setVisibleCount(MATCHES_PER_PAGE);
  }

  return (
    <div className="app-shell">
      <div className="ambient ambient-home" /><div className="ambient ambient-rival" />
      <main>
        <header className="site-header">
          <div className="brand"><div className="logo"><Swords size={20} /></div><div><strong>FC ONLINE 라이벌 아카이브</strong><span>두 사람의 1대1 친선 기록</span></div></div>
          <button className="refresh" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? "spin" : ""} /><span>새로고침</span></button>
        </header>

        <section className="duel-grid">
          <UserCard side="home" selected={selected === "home"} summary={summary || null} nickname={data?.users.home.nickname || HOME} onSelect={() => setSelected("home")} />
          <div className="versus-center"><span>VS</span><strong>{summary?.total ?? "–"}</strong><small>맞대결</small><em>{summary?.draws ?? "–"}무</em></div>
          <UserCard side="rival" selected={selected === "rival"} summary={summary || null} nickname={data?.users.rival.nickname || RIVAL} onSelect={() => setSelected("rival")} />
        </section>

        <nav className="match-filters" aria-label="경기 유형 필터">
          <button className={matchType === "all" ? "active" : ""} onClick={() => changeMatchType("all")}>전체 친선 <span>{data?.summary.total ?? 0}</span></button>
          {data?.matchTypes.map((type) => <button key={type.id} className={matchType === type.id ? "active" : ""} onClick={() => changeMatchType(type.id)}>{type.name} <span>{type.count}</span></button>)}
        </nav>

        {error ? <section className="error-card"><ShieldAlert size={30} /><div><h2>기록을 불러오지 못했어요</h2><p>{error}</p></div><button onClick={() => void load()}>다시 시도</button></section> : <>
          <section className="timeline-strip">
            <div><span>최초 확인 경기</span><strong>{formatDate(summary?.oldestMatchDate || null, false)}</strong></div>
            <i />
            <div><span>선택 범위</span><strong>{filterLabel}</strong></div>
            <i />
            <div><span>최근 경기</span><strong>{formatDate(summary?.latestMatchDate || null, false)}</strong></div>
          </section>

          <section className="panel rankings-panel">
            <div className="panel-heading">
              <div><span>선수 기록</span><h2>{data?.users[selected].nickname || (selected === "home" ? HOME : RIVAL)}</h2></div>
              <p>{filterLabel} 전체 경기 기준</p>
            </div>
            {loading ? <Skeleton /> : <div className="ranking-grid">
              <Ranking title="득점왕" players={stats?.[selected].topScorers || []} kind="goals" />
              <Ranking title="도움왕" players={stats?.[selected].topAssists || []} kind="assists" />
            </div>}
          </section>

          <section className="panel matches-panel">
            <div className="panel-heading">
              <div><span>경기 기록</span><h2>{filterLabel}</h2></div>
              <p>최신순 · {filteredMatches.length}경기</p>
            </div>
            {loading ? <><p className="loading-copy">양쪽 계정 기록을 끝까지 확인하고 있습니다. 첫 조회는 조금 걸릴 수 있어요.</p><Skeleton /></> : visibleMatches.length ? <>
              <div>{visibleMatches.map((match) => <MatchRow key={match.id} match={match} />)}</div>
              {visibleCount < filteredMatches.length && <button className="load-more" onClick={() => setVisibleCount((count) => count + MATCHES_PER_PAGE)}>다음 20경기 보기 <span>{Math.min(visibleCount, filteredMatches.length)} / {filteredMatches.length}</span><ChevronDown size={16} /></button>}
            </> : <div className="empty"><Swords size={32} /><strong>이 유형의 맞대결 기록이 없습니다</strong><p>넥슨 Open API가 현재 반환하는 범위에서 확인한 결과입니다.</p></div>}
          </section>
        </>}

        {data && <details className="scan-info">
          <summary>데이터 수집 정보</summary>
          <div className="scan-grid">
            <span>수집 유형 <b>{data.scanInfo.targetMatchTypes.map((type) => type.name).join(", ")}</b></span>
            <span>{data.users.home.nickname} <b>{data.scanInfo.homeMatchIds.toLocaleString()}경기 · {data.scanInfo.homePages}페이지</b></span>
            <span>{data.users.rival.nickname} <b>{data.scanInfo.rivalMatchIds.toLocaleString()}경기 · {data.scanInfo.rivalPages}페이지</b></span>
            <span>합집합 / 중복 제거 <b>{data.scanInfo.combinedMatchIds.toLocaleString()} / {data.scanInfo.duplicateMatchIds.toLocaleString()}</b></span>
            <span>상세 성공 / 실패 <b>{data.scanInfo.detailSuccess.toLocaleString()} / {data.scanInfo.detailFailed.toLocaleString()}</b></span>
            <span>최종 맞대결 <b>{data.scanInfo.headToHeadMatches.toLocaleString()}</b></span>
          </div>
          <div className="type-scan-list">{data.scanInfo.byMatchType.map((type) => <span key={type.id}>{type.name} ({type.id}) · HOME {type.homeMatchIds} / RIVAL {type.rivalMatchIds}</span>)}</div>
          {(data.scanInfo.homeSafetyCapReached || data.scanInfo.rivalSafetyCapReached) && <p className="cap-warning">더 오래된 기록이 있을 가능성이 있으나 10,000경기 안전상한에 도달했습니다.</p>}
        </details>}

        <footer><span>Nexon Open API가 현재 반환하는 범위의 기록입니다.</span><span>{data ? `갱신 ${formatDate(data.updatedAt)}` : "FC ONLINE 라이벌 기록 보관소"}</span></footer>
      </main>
    </div>
  );
}
