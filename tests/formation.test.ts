import assert from "node:assert/strict";
import test from "node:test";
import { pitchPoint } from "../src/formation.ts";

test("forward layers keep their fixed depth and side", () => {
  const formation = ["LS", "RF", "CAM", "GK"];
  assert.deepEqual(pitchPoint("LS", formation), { x: 38, y: 10 });
  assert.deepEqual(pitchPoint("RF", formation), { x: 68, y: 23 });
  assert.deepEqual(pitchPoint("CAM", formation), { x: 50, y: 35 });
});

test("wing-backs stay on the back line in a four-back", () => {
  const formation = ["LWB", "LCB", "RCB", "RWB", "GK"];
  assert.equal(pitchPoint("LWB", formation).y, 76);
  assert.equal(pitchPoint("RWB", formation).y, 76);
});

test("wing-backs move to the defensive-midfield line in a three-back", () => {
  const formation = ["LWB", "LCB", "CB", "RCB", "RWB", "GK"];
  const lwb = pitchPoint("LWB", formation); const rwb = pitchPoint("RWB", formation);
  assert.deepEqual(lwb, { x: 10, y: 61 });
  assert.deepEqual(rwb, { x: 90, y: 61 });
  assert.ok(lwb.x < pitchPoint("LDM", formation).x);
  assert.ok(rwb.x > pitchPoint("RDM", formation).x);
});

