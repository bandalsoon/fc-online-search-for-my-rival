export type Match = {
  id: string;
  date: string;
  result: "win" | "draw" | "loss";
  matchType: number;
  matchTypeName: string;
  home: { nickname: string; score: number; shots: number; effectiveShots: number };
  rival: { nickname: string; score: number; shots: number; effectiveShots: number };
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
  value: number | null;
};

export type UserRankings = { topScorers: PlayerRanking[]; topAssists: PlayerRanking[] };

export type ArchiveSummary = {
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

export type Archive = {
  users: {
    home: { nickname: string; ouid: string };
    rival: { nickname: string; ouid: string };
  };
  matchTypes: Array<{ id: number; name: string; count: number }>;
  summary: ArchiveSummary;
  summariesByMatchType: Record<string, ArchiveSummary>;
  playerStats: { home: UserRankings; rival: UserRankings };
  playerStatsByMatchType: Record<string, { home: UserRankings; rival: UserRankings }>;
  matches: Match[];
  scanInfo: {
    targetMatchTypes: Array<{ id: number; name: string }>;
    homeMatchIds: number;
    rivalMatchIds: number;
    combinedMatchIds: number;
    duplicateMatchIds: number;
    uniqueMatchIds: number;
    detailSuccess: number;
    detailFailed: number;
    headToHeadMatches: number;
    homePages: number;
    rivalPages: number;
    homeOldestMatchDate: string | null;
    rivalOldestMatchDate: string | null;
    homeSafetyCapReached: boolean;
    rivalSafetyCapReached: boolean;
    maxPerUser: number;
    byMatchType: Array<{
      id: number;
      name: string;
      homeMatchIds: number;
      rivalMatchIds: number;
      homePages: number;
      rivalPages: number;
      homeEndOffset: number;
      rivalEndOffset: number;
      homeSafetyCapReached: boolean;
      rivalSafetyCapReached: boolean;
    }>;
  };
  updatedAt: string;
};
