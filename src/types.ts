export type Match = {
  id: string; date: string; result: "win" | "draw" | "loss";
  matchType: number; matchTypeName: string;
  home: { nickname: string; score: number; shots: number; effectiveShots: number };
  rival: { nickname: string; score: number; shots: number; effectiveShots: number };
};

export type PlayerRanking = {
  spId: number; name: string; season: string; grade: number;
  goals: number; assists: number; appearances: number;
  value: number | null;
};

export type Archive = {
  users: { home: string; rival: string };
  summary: {
    total: number; wins: number; draws: number; losses: number; winRate: number;
    totalGoalsFor: number; totalGoalsAgainst: number;
    averageGoalsFor: number; averageGoalsAgainst: number;
  };
  matches: Match[];
  topScorers: PlayerRanking[];
  topAssists: PlayerRanking[];
  scanned: { totalMatchIds: number; totalMatchTypes: number; maxPerMatchType: number; failedDetails: number };
  updatedAt: string;
};
