export type Match = {
  id: string; date: string; result: "win" | "draw" | "loss";
  home: { nickname: string; score: number; shots: number; effectiveShots: number };
  rival: { nickname: string; score: number; shots: number; effectiveShots: number };
};

export type Archive = {
  users: { home: string; rival: string };
  summary: { total: number; wins: number; draws: number; losses: number; winRate: number };
  matches: Match[];
  topScorers: { spId: number; name: string; goals: number; appearances: number }[];
  scanned: number; updatedAt: string;
};

