// node --experimental-strip-types --test src/lib/templeMoon.test.mjs
// The Temple of the Moon's plan (templeMoon.ts): counts from TEMPLE-2026.md, everything inside the fence, the fence inside the plaza and the map's disc, no straight approach.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLE_R } from "./brc.ts";
import { ARMS, CROWN_N, FENCE_R, GATES, PETALS, STEMS, TOWER_H, TOWER_R, armLength, armPoint, gateAngle, outerPetals, stemPoint, stemTip } from "./templeMoon.ts";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("the counts are the Temple of the Moon's: 5 arms, 20 outer petals, 8 gates, 16 crown petals, a stamen of 6 to 8 stems", () => {
  assert.equal(ARMS, 5); assert.equal(PETALS, 20); assert.equal(GATES, 8); assert.equal(CROWN_N, 16); assert.ok(STEMS >= 6 && STEMS <= 8);
  assert.equal(outerPetals().length, 20);
});

test("the size: 200 ft across at 1.5 times is 300 ft, the fence is inside the sim's solid-and-plaza circles, the sim's solid is inside the fence", () => {
  near(FENCE_R * 2, 300); assert.ok(FENCE_R <= TEMPLE_R * 1.3, "inside the map's navy disc (TEMPLE_R x 1.3)"); assert.ok(FENCE_R < TEMPLE_R * 3.4, "inside the plaza");
  assert.ok(TEMPLE_R < FENCE_R); near(TOWER_H, 30);
});

test("the gates stand on the fence 45 degrees apart, one of them due south (6:00)", () => {
  for (let j = 1; j < GATES; j++) near(gateAngle(j) - gateAngle(j - 1), Math.PI / 4);
  assert.ok(Array.from({ length: GATES }, (_, j) => gateAngle(j)).some((a) => Math.abs(Math.sin(a) - 1) < 1e-9), "a gate at 6:00");
});

test("the arms leave the tower and stay inside the petals' ring, five of them turned a fifth of a circle apart, curving back on themselves", () => {
  for (let k = 0; k < ARMS; k++) {
    const a0 = armPoint(k, 0), a1 = armPoint(k, 1);
    assert.ok(Math.hypot(a0.x, a0.y) >= TOWER_R && Math.hypot(a0.x, a0.y) < 22, "starts at the tower");
    let rmax = 0, argmax = 0;
    for (let i = 0; i <= 40; i++) { const p = armPoint(k, i / 40), r = Math.hypot(p.x, p.y); if (r > rmax) { rmax = r; argmax = i / 40; } assert.ok(r < 100, "inside the ring of petals"); assert.ok(p.h >= 16 && p.h <= 28); }
    assert.ok(Math.hypot(a1.x, a1.y) < rmax - 10 && argmax > 0.4 && argmax < 0.9, "it goes out and folds back toward the tower");
    assert.ok(armLength(k) > 100 && armLength(k) < 200, `${armLength(k)} ft long`);
    near(armLength(k), armLength(0), 1e-6);
  }
  const rot = (k) => Math.atan2(armPoint(k, 0).y, armPoint(k, 0).x);
  for (let k = 1; k < ARMS; k++) near(((rot(k) - rot(k - 1) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI, (2 * Math.PI) / ARMS, 1e-9);
});

test("the outer petals lie between the arms and the fence, and every one is turned well off its radius, so there is no straight line in", () => {
  for (const p of outerPetals()) {
    const r = Math.hypot(p.x, p.y);
    assert.ok(r > 100 && r < 135, `${r} ft out`);
    // the tip points far from the radial direction: between 50 and 130 degrees off it, so the ring winds like a pinwheel
    const off = Math.abs(Math.atan2(Math.sin(p.a - p.ang), Math.cos(p.a - p.ang)));
    assert.ok(off > 0.9 && off < 2.3, `${off} rad off the radius`);
    assert.ok(r + p.len / 2 < FENCE_R, "inside the fence");
  }
});

test("the stamen rises through the centre to 62 to 78 ft, each stem bent outward, and every globe is inside the tower's ring", () => {
  for (let k = 0; k < STEMS; k++) {
    const tip = stemTip(k); assert.ok(tip.h >= 62 && tip.h <= 78.01, `${tip.h} ft`);
    let prev = stemPoint(k, 0); near(prev.h, 6);
    for (let i = 1; i <= 10; i++) { const q = stemPoint(k, i / 10); assert.ok(q.h > prev.h, "rises"); prev = q; }
    assert.ok(Math.hypot(tip.x, tip.y) > 4 && Math.hypot(tip.x, tip.y) < TOWER_R + 6, "bent out, inside the tower's ring");
  }
});
