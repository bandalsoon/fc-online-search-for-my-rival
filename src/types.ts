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
  value: number | null;
};

export type UserRankings = { topScorers: PlayerRanking[]; topAssists: PlayerRanking[] };

export type Archive = {
  users: {
    home: { nickname: string; ouid: string };
    rival: { nickname: string; ouid: string };
  };
  summary: {
    total: number;
    homeWins: number;
    draws: number;
    rivalWins: number;
    homeWinRate: number;
    rivalWinRate: number;
    homeGoals: number;
    rivalGoals: number;
    homeAverageGoals: number;
    homeAverageAgainst: number;
    rivalAverageGoals: number;
    rivalAverageAgainst: number;
    oldestMatchDate: string | null;
    latestMatchDate: string | null;
  };
  playerStats: { home: UserRankings; rival: UserRankings };
  matches: Match[];
  scanInfo: {
    matchType: number;
    matchTypeName: string;
    homeMatchIds: number;
    rivalMatchIds: number;
    uniqueMatchIds: number;
    detailSuccess: number;
    detailFailed: number;
    headToHeadMatches: number;
    maxPerUser: number;
  };
  updatedAt: string;
};
