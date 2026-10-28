// the Pyramid stage (pyramidStage.ts): it stands inside the stage the sim already has, and its strips are warm to violet
import { test } from "node:test";
import assert from "node:assert/strict";
import { PYRAMID, faceAt, reach, ledRgb, ledPhase, LED_DAY } from "./pyramidStage.ts";
import { SPOTS, solidAt } from "./playa.ts";

test("the pyramid stands inside PlayAlchemist's stage: nothing of it reaches past the sim's solid", () => {
  const sp = SPOTS.find((s) => s.key === PYRAMID.key);
  assert.ok(sp && sp.kind === "camp", "PlayAlchemist is a camp's stage");
  assert.ok(reach() <= sp.stage.r, `${reach().toFixed(1)} ft from the centre, the stage is ${sp.stage.r} ft`);
  // and the sim's solid there is the stage's circle, unchanged: just outside it is clear, the middle is solid
  assert.ok(solidAt(sp.stage), "solid at the centre");
  assert.equal(solidAt({ x: sp.stage.x + sp.stage.r + 4, y: sp.stage.y }, true), null);
  // the opening faces the bay and the apron in front of it is clear of the bay
  const dx = sp.mid.x - sp.stage.x, dy = sp.mid.y - sp.stage.y, toBay = Math.hypot(dx, dy);
  assert.ok(toBay - 34 > PYRAMID.apron, "the bay's near edge is past the apron");
});

test("it is a pyramid: 70 ft tall on a 50 ft base, its faces meeting at the apex, with the opening inside the bay face", () => {
  assert.equal(PYRAMID.half * 2, 50); assert.equal(PYRAMID.height, 70);
  assert.equal(faceAt(0), PYRAMID.half); assert.equal(faceAt(PYRAMID.height), 0);
  assert.ok(faceAt(PYRAMID.openH) > PYRAMID.openHalf, "the face is wider than the opening at the opening's top");
  assert.ok(PYRAMID.openH < PYRAMID.height / 2);
});

test("the strips are pale by day and run from warm through pink to violet at night", () => {
  assert.ok(LED_DAY.every((c) => c > 220));
  const [r0, g0, b0] = ledRgb(0), [r1, g1, b1] = ledRgb(1), [, gm, bm] = ledRgb(0.5);
  assert.ok(r0 > 240 && g0 > 130 && b0 < 100, "warm");
  assert.ok(b1 > 240 && r1 < 160, "violet");
  assert.ok(bm > 150 && gm < 110, "pink between");
  for (let i = 0; i < 40; i++) { const p = ledPhase(i * 3.7, i * 0.31); assert.ok(p >= 0 && p <= 1); for (const c of ledRgb(p)) assert.ok(c >= 0 && c <= 255); }
});
