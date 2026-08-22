export type Side = "home" | "rival";
export type PlayerRanking = {
  spId: number; name: string; season: string; seasonIcon: string | null; grade: number;
  goals: number; assists: number; attackPoints: number; attackPointsPerMatch: number; appearances: number;
  faceUrl: string; actionFaceUrl: string; salary: number | null; value: null;
};
export type LineupPlayer = PlayerRanking & { position: number; positionName: string; rating: number | null };
export type BestPlayer = LineupPlayer & { wins: number; positionScore: number; averageRating: number | null };
export type MatchTeam = { nickname: string; score: number; shots: number; effectiveShots: number; possession: number | null; passTry: number; passSuccess: number; formation: string; lineup: LineupPlayer[] };
export type Match = { id: string; date: string; matchType: number; result: "win" | "draw" | "loss"; home: MatchTeam; rival: MatchTeam; goals: Array<{ minute: number; side: Side; scorer: string; assist: string | null; score: string }>; mvp: { home: LineupPlayer | null; rival: LineupPlayer | null } };
export type ArchiveSummary = { total: number; homeWins: number; draws: number; rivalWins: number; homeWinRate: number; rivalWinRate: number; homeGoals: number; rivalGoals: number; totalGoals: number; homeAverageGoals: number; homeAverageAgainst: number; rivalAverageGoals: number; rivalAverageAgainst: number; oldestMatchDate: string | null; latestMatchDate: string | null };
export type UserRankings = { topScorers: PlayerRanking[]; topAssists: PlayerRanking[] };
export type MetricSet = { goalsPerMatch: number; concededPerMatch: number; shotsPerMatch: number; shotAccuracy: number; conversion: number; passCompletion: number; oneGoalWinRate: number; threePlusGoalRate: number; scorelessRate: number };
export type Archive = {
  version: string;
  users: { home: { nickname: string; ouid: string }; rival: { nickname: string; ouid: string } };
  summary: ArchiveSummary;
  playerStats: { home: UserRankings; rival: UserRankings };
  matches: Match[];
  bestXi: { home: { formation: string; sampleMatches: number; players: BestPlayer[] }; rival: { formation: string; sampleMatches: number; players: BestPlayer[] } };
  analysis: { metrics: { home: MetricSet; rival: MetricSet }; records: {
    biggestMargin: { date: string; score: string; winner: string } | null;
    highestScoring: { date: string; score: string; total: number } | null;
    longestWin: { owner: string; count: number }; longestUnbeaten: { owner: string; count: number }; longestLoss: { owner: string; count: number };
    commonScore: { score: string; count: number } | null;
    maxPlayerGoals: { name: string; nickname: string; value: number; date: string } | null;
    maxPlayerAssists: { name: string; nickname: string; value: number; date: string } | null;
    milestones: Array<{ number: number; date: string }>;
  } };
  database: { enabled: boolean; storedMatches: number; loadedMatches: number; savedMatches: number };
  scanInfo: {
    targetMatchTypes: Array<{ id: number; name: string }>; homeMatchIds: number; rivalMatchIds: number; combinedMatchIds: number;
    duplicateMatchIds: number; uniqueMatchIds: number; detailSuccess: number; detailFailed: number; detailLoadedFromDatabase: number; detailRequested: number;
    headToHeadMatches: number; homePages: number; rivalPages: number; homeOldestMatchDate: string | null; rivalOldestMatchDate: string | null;
    homeSafetyCapReached: boolean; rivalSafetyCapReached: boolean; maxPerUser: number;
    byMatchType: Array<{ id: number; name: string; homeMatchIds: number; rivalMatchIds: number; homePages: number; rivalPages: number; homeEndOffset: number; rivalEndOffset: number; homeSafetyCapReached: boolean; rivalSafetyCapReached: boolean }>;
  };
  updatedAt: string;
};

