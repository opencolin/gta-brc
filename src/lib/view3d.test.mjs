// node --experimental-strip-types --test src/lib/view3d.test.mjs
// The chase camera's coordinate mapping and the view choice (view3d.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { polar } from "./brc.ts";
import { PALETTE, VIEW_KEY, cang, fromWorld, fwd, readViewMode, right, toWorld, wrapAngle, yawOf } from "./view3d.ts";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("toWorld puts x on X, y on Z and up on Y; fromWorld undoes it", () => {
  assert.deepEqual(toWorld({ x: 12, y: -34 }), [12, 0, -34]);
  assert.deepEqual(toWorld({ x: 12, y: -34 }, 50), [12, 50, -34]);
  const back = fromWorld([12, 50, -34]);
  assert.deepEqual(back, { x: 12, y: -34, up: 50 });
  const p = { x: -3849, y: 886 };
  const q = fromWorld(toWorld(p, 7));
  assert.equal(q.x, p.x); assert.equal(q.y, p.y); assert.equal(q.up, 7);
});

test("yawOf(h) is -h, and a yaw of -h turns three's local -Z into fwd(h)", () => {
  assert.equal(yawOf(1.25), -1.25);
  for (const h of [0, 0.4, Math.PI / 2, 2.5, -1.1, Math.PI]) {
    // three.js rotation.y = θ maps local (0, 0, -1) to (-sin θ, 0, -cos θ)
    const th = yawOf(h);
    const world = [-Math.sin(th), 0, -Math.cos(th)];
    const f = fwd(h);
    near(world[0], f.x); near(world[2], f.y);
  }
});

test("facing 12:00 from 6:00 & Esplanade: the Man is ahead (-Z), 3:00 on the right (+X), Agave on the left", () => {
  const f = fwd(0), r = right(0);
  near(f.x, 0); near(f.y, -1);               // forward is -y, which is -Z
  near(r.x, 1); near(r.y, 0);                // right is +x, which is +X
  const here = polar(360, 3750);              // 6:00 & Esplanade
  const man = toWorld({ x: 0, y: 0 });
  assert.ok(man[2] < toWorld(here)[2], "the Man is further -Z than 6:00");
  const east = toWorld(polar(180, 3750))[0] - toWorld(here)[0];
  assert.ok(east > 0, "3:00 is on +X");
  const agave = toWorld(polar(510, 3750))[0] - toWorld(here)[0];   // 8:30
  assert.ok(agave < 0, "Agave at 8:30 is on -X (left)");
  // a point at 3:00 projects to the camera's right: dot with right(0) is positive, 8:30's is negative
  const dot = (p, v) => (p.x - here.x) * v.x + (p.y - here.y) * v.y;
  assert.ok(dot(polar(180, 3750), r) > 0);
  assert.ok(dot(polar(510, 3750), r) < 0);
});

test("headings grow clockwise from 12:00: h = π/2 faces 3:00", () => {
  const f = fwd(Math.PI / 2);
  near(f.x, 1); near(f.y, 0, 1e-12);
  const r = right(Math.PI / 2);
  near(r.x, 0, 1e-12); near(r.y, 1);
});

test("cang is the canvas angle of a clock time, wrapAngle folds to (-π, π]", () => {
  near(cang(0), -Math.PI / 2);
  near(cang(180), 0);
  near(cang(360), Math.PI / 2);
  near(wrapAngle(3 * Math.PI), Math.PI, 1e-9);
  near(wrapAngle(-2.5 * Math.PI), -Math.PI / 2, 1e-9);
  near(wrapAngle(0.3), 0.3);
});

test("readViewMode: ?view wins, then the stored choice, then top-down", () => {
  assert.equal(readViewMode("?view=chase", "top"), "chase");
  assert.equal(readViewMode("", "chase"), "chase");
  assert.equal(readViewMode("?view=nonsense", null), "top");
  assert.equal(readViewMode("?x=1&view=top", "chase"), "top");
  assert.equal(readViewMode("", null), "top");
  assert.equal(readViewMode("", "garbage"), "top");
  assert.equal(readViewMode("?view=nonsense", "chase"), "chase");
});

test("the storage key and palette are the ones the window already uses", () => {
  assert.equal(VIEW_KEY, "agentcamp-playa-view");
  assert.equal(PALETTE.playa, "#e6d3ae");
  assert.equal(PALETTE.pink, "#ff6b9a");
});
