import assert from "node:assert/strict";
import test from "node:test";
import { formationLabel, isThreeBack, pitchPoint, layoutPlayers, layoutPair, type LayoutOptions } from "../src/formation.ts";
import { passCompletion, selectTeamMom } from "../src/match-detail.ts";
import type { LineupPlayer } from "../src/types.ts";

const players = (names: string[]) => names.map((positionName) => ({ positionName }));
const desktop: LayoutOptions = { width: 518, height: 758, box: { width: 100, height: 128 }, mobile: false };
const formations = [
  ["LS", "RS", "LM", "LCM", "RCM", "RM", "LB", "LCB", "RCB", "RB", "GK"],
  ["ST", "LAM", "CAM", "RAM", "LDM", "RDM", "LB", "LCB", "RCB", "RB", "GK"],
  ["LS", "RS", "LWB", "LDM", "CDM", "RDM", "RWB", "LCB", "CB", "RCB", "GK"],
  ["ST", "LW", "CAM", "RW", "LDM", "RDM", "LB", "LCB", "RCB", "RB", "GK"],
  ["ST", "LF", "CAM", "RF", "LDM", "RDM", "LB", "LCB", "RCB", "RB", "GK"],
  ["ST", "LM", "LCM", "CM", "RCM", "RM", "LB", "LCB", "RCB", "RB", "GK"],
  ["LS", "ST", "RS", "LCM", "CM", "RCM", "LB", "LCB", "RCB", "RB", "GK"],
  ["LF", "CF", "RF", "CAM", "LDM", "RDM", "LB", "LCB", "RCB", "RB", "GK"],
  ["ST", "CF", "CAM", "CM", "CDM", "LWB", "LCB", "CB", "RCB", "RWB", "GK"],
  // The three position sets observed across all 22 real matches and both BEST XIs.
  ["LS", "RF", "LM", "RM", "LDM", "RDM", "LB", "LCB", "RCB", "RB", "GK"],
  ["ST", "CAM", "LM", "RM", "LDM", "RDM", "LB", "LCB", "RCB", "RB", "GK"],
];
function safe(result: ReturnType<typeof layoutPlayers>) {
  assert.deepEqual(result.collisions, []);
  assert.deepEqual(result.outside, []);
  assert.deepEqual(result.unsafePairs, []);
}
test("forward, wing and attacking-mid layers keep their depth and side semantics", () => {
  const names = ["LS", "ST", "RS", "LW", "LF", "CF", "RF", "RW", "CAM", "GK"];
  const result = layoutPlayers(players(names), desktop);
  safe(result);
  const at = (name: string) => result.positioned.find((p) => p.player.positionName === name)!;
  assert.equal(at("LS").y, at("ST").y);
  assert.equal(at("RS").y, at("ST").y);
  assert.ok(at("ST").y < at("CF").y && at("CF").y < at("CAM").y);
  assert.equal(at("GK").x, desktop.width / 2);
  assert.ok(at("RF").x > desktop.width / 2);
  for (const row of [["LS", "ST", "RS"], ["LW", "LF", "CF", "RF", "RW"]]) {
    for (let i = 1; i < row.length; i++) assert.ok(at(row[i]).x > at(row[i - 1]).x);
  }
});
test("wing-backs stay on the back line in a four-back", () => {
  const names = ["LWB", "LCB", "RCB", "RWB", "GK"];
  assert.equal(isThreeBack(names), false);
  assert.equal(pitchPoint("LWB", names).y, 79);
  assert.equal(pitchPoint("RWB", names).y, 79);
});
test("three-back wing-backs sit outside the defensive midfield line", () => {
  const names = formations[2];
  assert.equal(isThreeBack(names), true);
  const result = layoutPlayers(players(names), desktop);
  safe(result);
  const row = ["LWB", "LDM", "CDM", "RDM", "RWB"].map((name) => result.positioned.find((p) => p.player.positionName === name)!);
  assert.equal(new Set(row.map((p) => p.y)).size, 1);
  for (let i = 1; i < row.length; i++) assert.ok(row[i].x > row[i - 1].x);
  assert.ok(row[0].y < result.positioned.find((p) => p.player.positionName === "CB")!.y);
});
test("five-bucket formation labels use actual positions and omit zero buckets", () => {
  assert.equal(formationLabel(formations[10]), "4-2-3-1");
  assert.equal(formationLabel(["LWB", "LCB", "CB", "RCB", "RWB", "LCM", "RCM", "LS", "RS", "GK"]), "5-2-2");
  assert.equal(formationLabel(["GK"]), "실제 배치");
});
test("shared positioning separates complete composites without changing same-row depth", () => {
  const result = layoutPlayers(players(formations[5]), desktop);
  const row = result.positioned.filter((p) => ["LM", "LCM", "CM", "RCM", "RM"].includes(p.player.positionName)).sort((a,b) => a.x-b.x);
  assert.equal(new Set(row.map((p) => p.y)).size, 1);
  for (let i = 1; i < row.length; i++) assert.ok(row[i].x - row[i-1].x >= desktop.box.width * result.scale + 12 - 0.01);
  assert.equal(new Set(result.positioned.map((p) => p.scale)).size, 1);
});
test("required formations preserve side semantics, layer order and safety at all target widths", () => {
  for (const width of [518, 307, 277, 237]) for (const names of formations) {
    const options = width === 518 ? desktop : { width, height: width * 16 / 9, box: { width: 66, height: 126 }, mobile: true, gap: width === 237 ? 6 : 8 };
    const result = layoutPlayers(players(names), options);
    safe(result);
    for (const p of result.positioned) for (const q of result.positioned) {
      const a = pitchPoint(p.player.positionName, names), b = pitchPoint(q.player.positionName, names);
      if (a.y < b.y) assert.ok(p.y < q.y);
      if (a.y === b.y) {
        assert.equal(p.y, q.y);
        if (a.x < b.x) assert.ok(p.x < q.x);
      }
    }
    const keeper = result.positioned.find((p) => p.player.positionName === "GK")!;
    assert.equal(keeper.x, width / 2);
    assert.ok(result.positioned.every((p) => p.y <= keeper.y));
  }
});
test("BEST XI and match detail use the same deterministic calculation without mutating inputs", () => {
  const input = players(formations[9]);
  const copy = structuredClone(input);
  assert.deepEqual(layoutPlayers(input, desktop), layoutPlayers(copy, structuredClone(desktop)));
  assert.deepEqual(input, copy);
});
test("empty attacking layers do not promote CAM to striker depth", () => {
  const result = layoutPlayers(players(["CAM", "GK"]), desktop);
  assert.equal(result.positioned[0].y, desktop.height * .36);
});
test("only X-overlapping layers need full vertical clearance", () => {
  const overlapping = layoutPlayers(players(["ST", "CF", "CAM", "CM", "CDM", "CB", "GK"]), desktop);
  const separate = layoutPlayers(players(["LS", "RF", "LAM", "RM", "LDM", "RB", "GK"]), desktop);
  safe(overlapping); safe(separate);
  assert.ok(overlapping.requiredHeight > separate.requiredHeight);
  assert.equal(separate.height, desktop.height);
});
test("pair uses the smaller feasible scale and a common height", () => {
  const result = layoutPair(players(formations[0]), players(formations[5]), desktop);
  assert.equal(result.home.scale, result.rival.scale);
  assert.equal(result.home.height, result.rival.height);
  assert.equal(result.scale, layoutPlayers(players(formations[5]), desktop).scale);
  safe(result.home); safe(result.rival);
});
test("long names, large counters and font/image size changes are re-solved, not clipped", () => {
  for (const box of [{ width: 66, height: 126 }, { width: 112, height: 182 }, { width: 158, height: 224 }]) {
    const options = { width: 237, height: 422, box, mobile: true, gap: 6 };
    const first = layoutPair(players(formations[2]), players(formations[8]), options);
    const again = layoutPair(players(formations[2]), players(formations[8]), structuredClone(options));
    assert.deepEqual(first, again);
    safe(first.home); safe(first.rival);
    assert.equal(first.home.readabilityReview, true);
    assert.ok(first.scale < 1);
  }
});
test("very narrow dense rows report readability limits without an arbitrary scale floor", () => {
  const result = layoutPlayers(players(formations[5]), { width: 237, height: 422, box: { width: 100, height: 128 }, mobile: true, gap: 6 });
  safe(result);
  assert.ok(result.scale < .5);
  assert.equal(result.readabilityReview, true);
});

test("team MOM uses rating, goals, assists and then lineup order", () => {
  const player = (name: string, rating: number | null, goals: number, assists: number): LineupPlayer => ({ spId: name.length, name, season: "", seasonIcon: null, grade: 1, goals, assists, attackPoints: goals + assists, attackPointsPerMatch: goals + assists, appearances: 1, faceUrl: "", actionFaceUrl: "", salary: null, value: null, position: 0, positionName: "ST", rating });
  const first = player("첫 번째", 8.4, 1, 1);
  const assistWinner = player("도움 우선", 8.4, 1, 2);
  const goalWinner = player("골 우선", 8.4, 2, 0);
  const ratingWinner = player("평점 우선", 8.5, 0, 0);
  assert.equal(selectTeamMom([first, assistWinner, goalWinner, ratingWinner]), ratingWinner);
  assert.equal(selectTeamMom([first, { ...first, name: "두 번째" }]), first);
  assert.equal(selectTeamMom([player("평점 없음", null, 9, 9)]), null);
});

test("pass completion does not turn missing attempts into zero percent", () => {
  assert.equal(passCompletion(118, 130), 90.8);
  assert.equal(passCompletion(0, 0), null);
});


