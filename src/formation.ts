export type PitchPoint = { x: number; y: number };

export const POSITION_COORDINATES: Readonly<Record<string, PitchPoint>> = {
  LS: { x: 30, y: 4 }, ST: { x: 50, y: 4 }, RS: { x: 70, y: 4 },
  LW: { x: 9.5, y: 19 }, LF: { x: 29.75, y: 19 }, CF: { x: 50, y: 19 }, RF: { x: 70.25, y: 19 }, RW: { x: 90.5, y: 19 },
  LAM: { x: 30, y: 34 }, CAM: { x: 50, y: 34 }, RAM: { x: 70, y: 34 },
  LM: { x: 9.5, y: 49 }, LCM: { x: 29.75, y: 49 }, CM: { x: 50, y: 49 }, RCM: { x: 70.25, y: 49 }, RM: { x: 90.5, y: 49 },
  LDM: { x: 30, y: 64 }, CDM: { x: 50, y: 64 }, RDM: { x: 70, y: 64 },
  LWB: { x: 9.5, y: 80 }, LB: { x: 9.5, y: 80 }, LCB: { x: 36.5, y: 80 }, CB: { x: 50, y: 80 }, SW: { x: 50, y: 80 }, RCB: { x: 63.5, y: 80 }, RB: { x: 90.5, y: 80 }, RWB: { x: 90.5, y: 80 },
  GK: { x: 50, y: 97 },
};

const DEFENDERS = new Set(["LWB", "LB", "LCB", "CB", "SW", "RCB", "RB", "RWB"]);
const DEFENSIVE_MIDS = new Set(["LDM", "CDM", "RDM"]);
const CENTRAL_MIDS = new Set(["LCM", "CM", "RCM"]);
const ATTACKING_MIDS = new Set(["LM", "LAM", "CAM", "RAM", "RM"]);
const FORWARDS = new Set(["LW", "LF", "LS", "ST", "RS", "RF", "RW", "CF"]);
const MIN_ROW_GAP = 20.25;
const PITCH_EDGE = 9.5;

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
  const base = POSITION_COORDINATES[name] || { x: 50, y: 49 };
  if (isThreeBack(formationPositions) && name === "LWB") return { x: PITCH_EDGE, y: 64 };
  if (isThreeBack(formationPositions) && name === "RWB") return { x: 100 - PITCH_EDGE, y: 64 };
  if (isThreeBack(formationPositions) && name === "LCB") return { x: 27, y: 80 };
  if (isThreeBack(formationPositions) && name === "RCB") return { x: 73, y: 80 };
  return base;
}

function spreadRow(points: Array<{ index: number; point: PitchPoint }>) {
  const sorted = [...points].sort((a, b) => a.point.x - b.point.x || a.index - b.index);
  if (sorted.length < 2) return sorted;
  const gap = Math.min(MIN_ROW_GAP, (100 - PITCH_EDGE * 2) / (sorted.length - 1));
  for (let index = 1; index < sorted.length; index++) {
    sorted[index] = { ...sorted[index], point: { ...sorted[index].point, x: Math.max(sorted[index].point.x, sorted[index - 1].point.x + gap) } };
  }
  const overflow = sorted.at(-1)!.point.x - (100 - PITCH_EDGE);
  if (overflow > 0) sorted.forEach((item, index) => { sorted[index] = { ...item, point: { ...item.point, x: item.point.x - overflow } }; });
  const underflow = PITCH_EDGE - sorted[0].point.x;
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

