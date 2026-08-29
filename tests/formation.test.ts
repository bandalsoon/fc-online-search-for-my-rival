import assert from "node:assert/strict";
import test from "node:test";
import { formationLabel, isThreeBack, pitchPoint, positionedPlayers } from "../src/formation.ts";
import { passCompletion, selectTeamMom } from "../src/match-detail.ts";
import type { LineupPlayer } from "../src/types.ts";

test("forward, wing and attacking-mid layers keep their depth and side semantics", () => {
  const formation = ["LW", "LS", "ST", "RS", "RW", "CF", "CAM", "GK"];
  assert.equal(pitchPoint("LW", formation).x < pitchPoint("ST", formation).x, true);
  assert.equal(pitchPoint("RW", formation).x > pitchPoint("ST", formation).x, true);
  assert.equal(pitchPoint("LS", formation).y, pitchPoint("ST", formation).y);
  assert.equal(pitchPoint("RS", formation).y, pitchPoint("ST", formation).y);
  assert.equal(pitchPoint("CF", formation).y < pitchPoint("CAM", formation).y, true);
  assert.deepEqual(pitchPoint("GK", formation), { x: 50, y: 91 });
});

test("wing-backs stay on the back line in a four-back", () => {
  const formation = ["LWB", "LCB", "RCB", "RWB", "GK"];
  assert.equal(isThreeBack(formation), false);
  assert.equal(pitchPoint("LWB", formation).y, 76);
  assert.equal(pitchPoint("RWB", formation).y, 76);
});

test("three-back wing-backs sit outside the defensive midfield line", () => {
  const formation = ["LWB", "LCB", "CB", "RCB", "LDM", "CDM", "RDM", "RWB", "GK"];
  assert.equal(isThreeBack(formation), true);
  const ordered = ["LWB", "LDM", "CDM", "RDM", "RWB"].map((name) => pitchPoint(name, formation).x);
  assert.deepEqual([...ordered].sort((a, b) => a - b), ordered);
  assert.equal(pitchPoint("LWB", formation).y, 61);
  assert.equal(pitchPoint("RWB", formation).y, 61);
});

test("five-bucket formation labels use actual positions and omit zero buckets", () => {
  assert.equal(formationLabel(["LB", "LCB", "RCB", "RB", "LDM", "RDM", "LM", "CAM", "RM", "ST", "GK"]), "4-2-3-1");
  assert.equal(formationLabel(["LWB", "LCB", "CB", "RCB", "RWB", "LCM", "RCM", "LS", "RS", "GK"]), "5-2-2");
  assert.equal(formationLabel(["GK"]), "실제 배치");
});

test("shared positioning spreads full player composites without changing row depth", () => {
  const players = ["LWB", "LCB", "CB", "RCB", "LDM", "CDM", "RDM", "RWB", "GK"].map((positionName) => ({ positionName }));
  const positioned = positionedPlayers(players).filter(({ player }) => ["LWB", "LDM", "CDM", "RDM", "RWB"].includes(player.positionName));
  assert.deepEqual(positioned.map((row) => row.y), [61, 61, 61, 61, 61]);
  const ordered = [...positioned].sort((a, b) => a.x - b.x);
  for (let index = 1; index < ordered.length; index++) assert.ok(ordered[index].x - ordered[index - 1].x >= 20);
});

test("BEST XI and match detail use the same coordinate function", () => {
  const players = ["LS", "RF", "CAM", "LDM", "RDM", "LB", "LCB", "RCB", "RB", "GK"].map((positionName) => ({ positionName }));
  assert.deepEqual(positionedPlayers(players), positionedPlayers(players.map((player) => ({ ...player }))));
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

