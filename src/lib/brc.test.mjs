// node --experimental-strip-types --test lib/games/brc.test.mjs
// Black Rock City's geometry (brc.ts): the grid the playa game drives on.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ARCS, ARC_R, CITY_SCALE, FLY_RANCH, ROAD_W, RADIALS, WIDE_RADIALS, CITY_FROM, CITY_TO, CENTER_CAMP, TEMPLE, FENCE, FENCE_R, PLAZAS,
  polar, toPolar, clockLabel, parseClock, pointAt, parseAddress, surfaceAt, blockPush, addressOf, fenceDepth, ringOf,
} from "./brc.ts";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("clock positions: 12:00 is up, 3:00 right, 6:00 down, 9:00 left", () => {
  const up = polar(0, 100), right = polar(180, 100), down = polar(360, 100), left = polar(540, 100);
  near(up.x, 0); near(up.y, -100);
  near(right.x, 100); near(right.y, 0);
  near(down.x, 0); near(down.y, 100);
  near(left.x, -100); near(left.y, 0);
  for (const m of [0, 75, 270, 450, 615]) { const p = toPolar(polar(m, 3000)); near(p.min, m, 1e-6); near(p.r, 3000, 1e-6); }
});

test("clock labels and parsing round-trip", () => {
  assert.equal(clockLabel(450), "7:30");
  assert.equal(clockLabel(0), "12:00");
  assert.equal(clockLabel(120), "2:00");
  assert.equal(parseClock("4:30"), 270);
  assert.equal(parseClock("12:00"), 0);
  assert.equal(parseClock("13:00"), null);
  assert.equal(parseClock("nope"), null);
});

test("streets: Esplanade then A to K outward, as the 2026 city has them, radii strictly increasing, Esplanade at 2,500 ft (scaled)", () => {
  assert.deepEqual([...ARCS], ["Esplanade", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"]);
  assert.equal(ARC_R[6] - ARC_R[5], 485 * CITY_SCALE, "E to F is the deep block");
  assert.equal(ARC_R[0], 2500 * CITY_SCALE);
  for (let i = 1; i < ARC_R.length; i++) {
    const depth = ARC_R[i] - ARC_R[i - 1];
    assert.ok(depth >= 150 * CITY_SCALE && depth <= 500 * CITY_SCALE, `block ${ARCS[i - 1]}→${ARCS[i]} is a few hundred feet (${depth})`);
  }
  assert.equal(RADIALS[0], 120);
  assert.equal(RADIALS.at(-1), 600);
  for (let i = 1; i < RADIALS.length; i++) assert.equal(RADIALS[i] - RADIALS[i - 1], 30, "radials every half hour");
  assert.deepEqual([...WIDE_RADIALS].map(clockLabel), ["3:00", "4:30", "6:00", "7:30", "9:00"]);
});

test("addresses at known corners", () => {
  assert.equal(addressOf(pointAt("7:30", "E")), "7:30 & E");
  assert.equal(addressOf(pointAt("4:30", "C")), "4:30 & C");
  assert.equal(addressOf(pointAt("2:00", "K")), "2:00 & K");
  assert.equal(addressOf(pointAt("9:00", "Esplanade")), "9:00 & Esplanade");
  // a little off the corner still reads as the corner
  const p = pointAt("3:00", "G");
  assert.equal(addressOf({ x: p.x + 30, y: p.y + 20 }), "3:00 & G");
  assert.equal(addressOf({ x: 10, y: 10 }), "the Man");
  assert.equal(addressOf(TEMPLE), "the Temple");
  assert.equal(addressOf(CENTER_CAMP), "Center Camp");
  assert.equal(addressOf(polar(270, 1200)), "4:30 & 1200'");
  assert.deepEqual(parseAddress("4:30 & C"), pointAt(270, "C"));
  assert.equal(parseAddress("12:00 & C"), null, "no city at 12:00");
  assert.equal(parseAddress("4:30 & Q"), null);
});

test("the 12:00 opening: no street and no camps between 10:00 and 2:00", () => {
  for (const m of [0, 30, 60, 90, 630, 660, 690]) {
    for (const r of [...ARC_R, 2700, 4000, 5500]) {
      const s = surfaceAt(polar(m, r));
      assert.equal(s.kind, "playa", `${clockLabel(m)} at ${r}' is open playa (got ${s.kind})`);
    }
  }
  // inside the Esplanade is open playa all the way round
  for (const m of [0, 180, 300, 450, 600]) assert.equal(surfaceAt(polar(m, 1500)).kind, "playa");
});

test("surfaces: arc streets, radials, corners, blocks, plaza, fence", () => {
  assert.deepEqual(surfaceAt(polar(200, ARC_R[5])), { kind: "road", arc: "E" });
  assert.deepEqual(surfaceAt(polar(450, 3380 * CITY_SCALE)), { kind: "road", radial: 450 });
  assert.deepEqual(surfaceAt(pointAt("7:30", "E")), { kind: "road", arc: "E", radial: 450 });
  // between E and F, between 7:30 and 8:00
  const s = surfaceAt(polar(465, (ARC_R[5] + ARC_R[6]) / 2));
  assert.deepEqual(s, { kind: "block", ring: 5, sector: RADIALS.indexOf(450) });
  assert.equal(surfaceAt(CENTER_CAMP).kind, "plaza");
  assert.equal(PLAZAS.length, 11);
  for (const z of PLAZAS) assert.equal(surfaceAt(z).kind, "plaza", z.name);
  assert.equal(surfaceAt(pointAt("7:30", "G")).kind, "plaza", "7:30 & G is a plaza");
  assert.equal(surfaceAt({ x: 0, y: FENCE_R + 100 }).kind, "outside");
  assert.equal(ringOf(100), -1);
  assert.equal(ringOf(ARC_R[3] + 1), 3);
  assert.equal(ringOf(99999), ARCS.length - 1);
});

test("a block pushes a point out toward its nearest street", () => {
  // just inside the block from E's outer edge: pushed back toward the Man, onto E
  const p = polar(465, ARC_R[5] + ROAD_W / 2 + 5);
  const out = blockPush(p);
  assert.ok(out, "in a block");
  assert.ok(out.depth > 0 && out.depth < 10, `shallow (${out.depth})`);
  const moved = { x: p.x + out.nx * (out.depth + 0.5), y: p.y + out.ny * (out.depth + 0.5) };
  assert.equal(surfaceAt(moved).kind, "road");
  assert.ok(Math.hypot(moved.x, moved.y) < Math.hypot(p.x, p.y), "inward");
  assert.equal(blockPush(pointAt("7:30", "E")), null, "a road is not a block");
});

test("the fence is a pentagon around the whole city", () => {
  assert.equal(FENCE.length, 5);
  for (let m = CITY_FROM; m <= CITY_TO; m += 15) assert.ok(fenceDepth(polar(m, ARC_R.at(-1) + 400)).depth > 0, `${clockLabel(m)} past L is inside the fence`);
  assert.ok(fenceDepth(TEMPLE).depth > 0);
  assert.ok(fenceDepth({ x: 0, y: 0 }).depth > 0);
  const f = fenceDepth({ x: 9000 * CITY_SCALE * 1.2, y: 0 });
  assert.ok(f.depth < 0);
  assert.ok(f.nx < 0, "the inward normal points back toward the Man");
});

test("Fly Ranch (asked 2026-11-04): in its real direction, north-west, past the fence and clear of the city's grid", () => {
  near(toPolar(FLY_RANCH.at).min, FLY_RANCH.min, 1e-3);
  assert.ok(FLY_RANCH.min > 510 && FLY_RANCH.min < 540, "about 8:45, where north-north-west lies");
  assert.ok(fenceDepth(FLY_RANCH.at).depth < -3000, "well past the fence");
  assert.ok(Math.hypot(FLY_RANCH.at.x, FLY_RANCH.at.y) < 14000 * CITY_SCALE, "and nearer than the real 8.4 miles");
});
