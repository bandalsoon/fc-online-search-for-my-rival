export type PitchPoint = { x: number; y: number };

export const POSITION_COORDINATES: Readonly<Record<string, PitchPoint>> = {
  LS: { x: 38, y: 10 }, ST: { x: 50, y: 10 }, RS: { x: 62, y: 10 },
  LW: { x: 15, y: 23 }, LF: { x: 32, y: 23 }, CF: { x: 50, y: 23 }, RF: { x: 68, y: 23 }, RW: { x: 85, y: 23 },
  LAM: { x: 34, y: 36 }, CAM: { x: 50, y: 36 }, RAM: { x: 66, y: 36 },
  LM: { x: 15, y: 50 }, LCM: { x: 35, y: 50 }, CM: { x: 50, y: 50 }, RCM: { x: 65, y: 50 }, RM: { x: 85, y: 50 },
  LDM: { x: 34, y: 64 }, CDM: { x: 50, y: 64 }, RDM: { x: 66, y: 64 },
  LWB: { x: 12, y: 79 }, LB: { x: 12, y: 79 }, LCB: { x: 35, y: 79 }, CB: { x: 50, y: 79 }, SW: { x: 50, y: 79 }, RCB: { x: 65, y: 79 }, RB: { x: 88, y: 79 }, RWB: { x: 88, y: 79 },
  GK: { x: 50, y: 92 },
};

const DEFENDERS = new Set(["LWB", "LB", "LCB", "CB", "SW", "RCB", "RB", "RWB"]);
const DEFENSIVE_MIDS = new Set(["LDM", "CDM", "RDM"]);
const CENTRAL_MIDS = new Set(["LCM", "CM", "RCM"]);
const ATTACKING_MIDS = new Set(["LM", "LAM", "CAM", "RAM", "RM"]);
const FORWARDS = new Set(["LW", "LF", "LS", "ST", "RS", "RF", "RW", "CF"]);
// Preferences, not final coordinates; empty layers retain their football depth.
const LAYERS = [10, 23, 36, 50, 64, 79, 92];

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
  const base = POSITION_COORDINATES[name] || { x: 50, y: 50 };
  if (isThreeBack(formationPositions) && name === "LWB") return { x: 10, y: 64 };
  if (isThreeBack(formationPositions) && name === "RWB") return { x: 90, y: 64 };
  return base;
}

export type LayoutOptions = {
  width: number; height: number;
  box: { width: number; height: number };
  mobile: boolean; gap?: number; edge?: number; scale?: number;
};
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

// Bounded isotonic regression: closest preferred X values with a fixed minimum gap.
function rowPositions(preferred: number[], separation: number, min: number, max: number) {
  const blocks: Array<{ total: number; count: number }> = [];
  preferred.forEach((x, index) => {
    blocks.push({ total: x - index * separation, count: 1 });
    while (blocks.length > 1) {
      const right = blocks.at(-1)!, left = blocks.at(-2)!;
      if (left.total / left.count <= right.total / right.count) break;
      blocks.splice(-2, 2, { total: left.total + right.total, count: left.count + right.count });
    }
  });
  const values = blocks.flatMap(({ total, count }) => Array<number>(count).fill(clamp(total / count, min, max - (preferred.length - 1) * separation)));
  return values.map((x, index) => x + index * separation);
}

export function layoutPlayers<T extends { positionName: string }>(players: T[], options: LayoutOptions) {
  const { width, box } = options;
  const gap = options.gap ?? (options.mobile ? 8 : 12), edge = options.edge ?? gap;
  const names = players.map((player) => player.positionName);
  const points = players.map((player) => pitchPoint(player.positionName, names));
  const rows = LAYERS.map((y) => points.map((point, index) => ({ ...point, index })).filter((point) => point.y === y).sort((a, b) => a.x - b.x || a.index - b.index));
  const densest = Math.max(1, ...rows.map((row) => row.length));
  const fitScale = clamp((width - 2 * edge - (densest - 1) * gap) / (densest * box.width), 0, 1);
  const scale = Math.min(fitScale, options.scale ?? 1);
  const bw = box.width * scale, bh = box.height * scale;
  const x = Array<number>(players.length);
  rows.forEach((row) => {
    const positions = rowPositions(row.map((p) => p.x / 100 * width), bw + gap, edge + bw / 2, width - edge - bw / 2);
    row.forEach((p, index) => { x[p.index] = positions[index]; });
  });
  // Seven ordered layers form a tiny DAG. Only X-overlapping boxes need full Y clearance.
  const distances = LAYERS.map(() => Array<number>(7).fill(0));
  for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
    distances[a][b] = rows[a].some((p) => rows[b].some((q) => Math.abs(x[p.index] - x[q.index]) < bw + gap - 0.001)) ? bh + gap : b - a;
  }
  const top = 32 + edge; // Also reserve the existing pitch label, not just the outer edge.
  const earliest = LAYERS.map(() => top + bh / 2);
  for (let b = 1; b < 7; b++) for (let a = 0; a < b; a++) earliest[b] = Math.max(earliest[b], earliest[a] + distances[a][b]);
  const requiredHeight = Math.ceil(earliest[6] + bh / 2 + edge);
  const height = Math.max(options.height, requiredHeight);
  const latest = LAYERS.map(() => height - edge - bh / 2);
  for (let a = 5; a >= 0; a--) for (let b = a + 1; b < 7; b++) latest[a] = Math.min(latest[a], latest[b] - distances[a][b]);
  const y = [...earliest];
  for (let b = 0; b < 7; b++) {
    const lower = Math.max(earliest[b], ...y.slice(0, b).map((value, a) => value + distances[a][b]));
    y[b] = clamp(LAYERS[b] / 100 * height, lower, latest[b]);
  }
  const positioned = players.map((player, index) => ({ player, x: x[index], y: y[LAYERS.indexOf(points[index].y)], scale }));
  const collisions: number[][] = [], unsafePairs: number[][] = [], outside: number[] = [];
  positioned.forEach((p, i) => {
    if (p.x - bw / 2 < edge - 0.01 || p.x + bw / 2 > width - edge + 0.01 || p.y - bh / 2 < top - 0.01 || p.y + bh / 2 > height - edge + 0.01) outside.push(i);
    positioned.slice(i + 1).forEach((q, j) => {
      const dx = Math.abs(p.x - q.x), dy = Math.abs(p.y - q.y);
      if (dx < bw - 0.01 && dy < bh - 0.01) collisions.push([i, i + j + 1]);
      if (dx < bw + gap - 0.01 && dy < bh + gap - 0.01) unsafePairs.push([i, i + j + 1]);
    });
  });
  return { positioned, scale, height, requiredHeight, collisions, unsafePairs, outside,
    // Approved mobile text is already small: ANY further shrink needs visual approval.
    readabilityReview: scale < 0.999 || names.some((name) => !POSITION_COORDINATES[normalized(name)]) };
}

export function layoutPair<T extends { positionName: string }>(home: T[], rival: T[], options: LayoutOptions) {
  const scale = Math.min(layoutPlayers(home, options).scale, layoutPlayers(rival, options).scale);
  const shared = { ...options, scale };
  const height = Math.max(layoutPlayers(home, shared).height, layoutPlayers(rival, shared).height);
  return { home: layoutPlayers(home, { ...shared, height }), rival: layoutPlayers(rival, { ...shared, height }), scale, height };
}


