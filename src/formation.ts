export type PitchPoint = { x: number; y: number };

export const POSITION_COORDINATES: Readonly<Record<string, PitchPoint>> = {
  LS: { x: 38, y: 10 }, ST: { x: 50, y: 10 }, RS: { x: 62, y: 10 },
  LW: { x: 15, y: 23 }, LF: { x: 32, y: 23 }, CF: { x: 50, y: 23 }, RF: { x: 68, y: 23 }, RW: { x: 85, y: 23 },
  LAM: { x: 34, y: 35 }, CAM: { x: 50, y: 35 }, RAM: { x: 66, y: 35 },
  LM: { x: 15, y: 48 }, LCM: { x: 35, y: 48 }, CM: { x: 50, y: 48 }, RCM: { x: 65, y: 48 }, RM: { x: 85, y: 48 },
  LDM: { x: 34, y: 61 }, CDM: { x: 50, y: 61 }, RDM: { x: 66, y: 61 },
  LWB: { x: 12, y: 76 }, LB: { x: 12, y: 76 }, LCB: { x: 35, y: 76 }, CB: { x: 50, y: 76 }, SW: { x: 50, y: 76 }, RCB: { x: 65, y: 76 }, RB: { x: 88, y: 76 }, RWB: { x: 88, y: 76 },
  GK: { x: 50, y: 91 },
};

const DEFENDERS = new Set(["LWB", "LB", "LCB", "CB", "SW", "RCB", "RB", "RWB"]);
const DEFENSIVE_MIDS = new Set(["LDM", "CDM", "RDM"]);
const CENTRAL_MIDS = new Set(["LCM", "CM", "RCM"]);
const ATTACKING_MIDS = new Set(["LM", "LAM", "CAM", "RAM", "RM"]);
const FORWARDS = new Set(["LW", "LF", "LS", "ST", "RS", "RF", "RW", "CF"]);
const MIN_ROW_GAP = 20;

function normalized(name: string) {
  return name.trim().toUpperCase();
}

export function formationLabel(positionNames: string[]) {
  const counts = [DEFENDERS, DEFENSIVE_MIDS, CENTRAL_MIDS, ATTACKING_MIDS, FORWARDS]
    .map((group) => positionNames.reduce((count, name) => count + Number(group.has(normalized(name))), 0))
    .filter(Boolean);
  return counts.length ? counts.join("-") : "실제 배치";
}

export function isThreeBack(positionNames: string[]) {
  const centerBacks = new Set(positionNames.map(normalized).filter((name) => ["LCB", "CB", "RCB"].includes(name)));
  return centerBacks.size === 3;
}

export function pitchPoint(positionName: string, formationPositions: string[]): PitchPoint {
  const name = normalized(positionName);
  const base = POSITION_COORDINATES[name] || { x: 50, y: 48 };
  if (isThreeBack(formationPositions) && name === "LWB") return { x: 8, y: 61 };
  if (isThreeBack(formationPositions) && name === "RWB") return { x: 92, y: 61 };
  return base;
}

function spreadRow(points: Array<{ index: number; point: PitchPoint }>) {
  const sorted = [...points].sort((a, b) => a.point.x - b.point.x || a.index - b.index);
  if (sorted.length < 2) return sorted;
  const gap = Math.min(MIN_ROW_GAP, 86 / (sorted.length - 1));
  for (let index = 1; index < sorted.length; index++) {
    sorted[index] = { ...sorted[index], point: { ...sorted[index].point, x: Math.max(sorted[index].point.x, sorted[index - 1].point.x + gap) } };
  }
  const overflow = sorted.at(-1)!.point.x - 93;
  if (overflow > 0) sorted.forEach((item, index) => { sorted[index] = { ...item, point: { ...item.point, x: item.point.x - overflow } }; });
  const underflow = 7 - sorted[0].point.x;
  if (underflow > 0) sorted.forEach((item, index) => { sorted[index] = { ...item, point: { ...item.point, x: item.point.x + underflow } }; });
  return sorted;
}

export function positionedPlayers<T extends { positionName: string }>(players: T[]) {
  const names = players.map((player) => player.positionName);
  const rows = new Map<number, Array<{ index: number; point: PitchPoint }>>();
  players.forEach((player, index) => {
    const point = pitchPoint(player.positionName, names);
    const row = rows.get(point.y) || [];
    row.push({ index, point });
    rows.set(point.y, row);
  });
  const points = new Map([...rows.values()].flatMap((row) => spreadRow(row)).map(({ index, point }) => [index, point]));
  return players.map((player, index) => ({ player, ...(points.get(index) || pitchPoint(player.positionName, names)) }));
}

