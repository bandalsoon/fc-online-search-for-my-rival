import type { LineupPlayer } from "./types";

export function selectTeamMom(players: LineupPlayer[]) {
  return players.reduce<LineupPlayer | null>((leader, player) => {
    if (player.rating === null) return leader;
    if (!leader) return player;
    if (player.rating !== leader.rating) return player.rating > leader.rating! ? player : leader;
    if (player.goals !== leader.goals) return player.goals > leader.goals ? player : leader;
    if (player.assists !== leader.assists) return player.assists > leader.assists ? player : leader;
    return leader;
  }, null);
}

export function passCompletion(success: number, attempts: number) {
  return attempts > 0 ? Number((success / attempts * 100).toFixed(1)) : null;
}

