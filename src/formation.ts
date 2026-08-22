export type PitchPoint = { x: number; y: number };

const BASE: Record<string, PitchPoint> = {
  LS: { x: 38, y: 10 }, ST: { x: 50, y: 10 }, RS: { x: 62, y: 10 },
  LW: { x: 15, y: 23 }, LF: { x: 32, y: 23 }, CF: { x: 50, y: 23 }, RF: { x: 68, y: 23 }, RW: { x: 85, y: 23 },
  LAM: { x: 34, y: 35 }, CAM: { x: 50, y: 35 }, RAM: { x: 66, y: 35 },
  LM: { x: 15, y: 48 }, LCM: { x: 35, y: 48 }, CM: { x: 50, y: 48 }, RCM: { x: 65, y: 48 }, RM: { x: 85, y: 48 },
  LDM: { x: 34, y: 61 }, CDM: { x: 50, y: 61 }, RDM: { x: 66, y: 61 },
  LWB: { x: 12, y: 76 }, LB: { x: 12, y: 76 }, LCB: { x: 35, y: 76 }, CB: { x: 50, y: 76 }, SW: { x: 50, y: 76 }, RCB: { x: 65, y: 76 }, RB: { x: 88, y: 76 }, RWB: { x: 88, y: 76 },
  GK: { x: 50, y: 91 },
};

export function isThreeBack(positionNames: string[]) {
  const centerBacks = new Set(positionNames.map((name) => name.toUpperCase()).filter((name) => ["LCB", "CB", "RCB"].includes(name)));
  return centerBacks.size === 3;
}

export function pitchPoint(positionName: string, formationPositions: string[]): PitchPoint {
  const name = positionName.toUpperCase(); const base = BASE[name] || { x: 50, y: 48 };
  if (isThreeBack(formationPositions) && name === "LWB") return { x: 10, y: 61 };
  if (isThreeBack(formationPositions) && name === "RWB") return { x: 90, y: 61 };
  return base;
}

export function positionedPlayers<T extends { positionName: string }>(players: T[]) {
  const names = players.map((player) => player.positionName);
  const points = players.map((player) => pitchPoint(player.positionName, names));
  const groups = new Map<string, number[]>();
  points.forEach((point, index) => { const key = `${point.x}:${point.y}`; const indexes = groups.get(key) || []; indexes.push(index); groups.set(key, indexes); });
  return players.map((player, index) => {
    const point = points[index]; const siblings = groups.get(`${point.x}:${point.y}`) || [index]; const order = siblings.indexOf(index); const shift = (order - (siblings.length - 1) / 2) * 8;
    return { player, x: Math.max(5, Math.min(95, point.x + shift)), y: point.y };
  });
}

