// node --experimental-strip-types --test src/lib/chaseCam.test.mjs
// The chase camera (chaseCam.ts): where it sits, how it eases, and how it keeps out of the camps.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ARC_R, RADIALS, blockBounds, clockToAngle, polar } from "./brc.ts";
import { solidAt } from "./playa.ts";
import { CAM, camAvoid, camGoal, camStep, camYaw, newCam } from "./chaseCam.ts";

const near = (a, b, eps = 0.1) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const bike = (o = {}) => ({ x: 0, y: 0, h: 0, vx: 0, vy: 0, alt: 0, len: 16, maxSpeed: 147, chute: false, plane: false, ...o });
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test("a bike standing at the origin facing 12:00: the eye is behind (+Z) and above, the look point ahead (-Z)", () => {
  const g = camGoal(bike());
  near(g.eye.x, 0); near(g.eye.y, 29.8); near(g.eye.z, 55.6);
  near(g.look.x, 0); near(g.look.y, 5.33); near(g.look.z, -28);
  near(g.fov, CAM.fovMin, 1e-9);
});

test("at top speed it pulls back 35% and looks further along the velocity; the view widens", () => {
  const g = camGoal(bike({ vy: -147 }));       // flat out toward 12:00
  near(g.eye.z, 75.06);
  near(g.look.z, -(28 + 0.35 * 147));
  near(g.fov, CAM.fovMax, 1e-9);
  const half = camGoal(bike({ vy: -73.5 }));
  assert.ok(half.eye.z > 55.6 && half.eye.z < 75.06 && half.fov > CAM.fovMin && half.fov < CAM.fovMax);
  // faster than top speed (a push) does not pull back further
  near(camGoal(bike({ vy: -500 })).eye.z, 75.06);
});

test("a found art car (36 ft) sits 108 to 145 back and 56 up", () => {
  const car = { len: 36, maxSpeed: 200 };
  const still = camGoal(bike(car)), fast = camGoal(bike({ ...car, vy: -200 }));
  near(still.eye.z, 107.6); near(still.eye.y, 55.8); near(still.look.z, -48);
  near(fast.eye.z, 107.6 * 1.35);
});

test("the eye is behind the ride whichever way it faces: facing 3:00 puts it to the west", () => {
  const g = camGoal(bike({ h: Math.PI / 2 }));
  near(g.eye.x, -55.6); near(g.eye.z, 0, 1e-9); near(g.look.x, 28); near(g.look.z, 0, 1e-9);
});

test("orbit turns the eye round the ride and leaves the look point ahead", () => {
  const g = camGoal(bike(), Math.PI / 2);      // dragged a quarter turn clockwise
  near(g.eye.x, -55.6); near(g.eye.z, 0, 1e-9);
  near(g.look.z, -28);
});

test("in the air the camera trails further and higher, and looks at the ride itself", () => {
  const plane = { len: 30, maxSpeed: 480, plane: true, alt: 1000 };
  const g = camGoal(bike(plane));
  near(g.eye.z, 92 + 250); near(g.eye.y, 1000 + 48 + 500);
  near(g.look.z, 0, 1e-9); near(g.look.y, 1010);
  assert.ok(g.eye.y >= 0.5 * 1000, "at least 0.5·alt up");
  // the chute is in the air too
  const c = camGoal(bike({ chute: true, alt: 400 }));
  assert.ok(c.eye.y >= 0.5 * 400 && c.eye.z > 55.6 + 0.25 * 400 - 1);
  // a plane still on the runway is a ride on the ground
  const pad = camGoal(bike({ ...plane, alt: 0 }));
  near(pad.eye.z, 92); near(pad.look.z, -(30 + 12));
});

test("camStep eases toward a fixed goal without overshooting", () => {
  let s = newCam(bike());
  const goal = camGoal(bike({ x: 60, y: -80 }));
  let dEye = dist3(s.eye, goal.eye), dLook = dist3(s.look, goal.look);
  assert.ok(dEye > 90);
  for (let i = 0; i < 60; i++) {
    s = camStep(s, goal, 1 / 60);
    const e = dist3(s.eye, goal.eye), l = dist3(s.look, goal.look);
    assert.ok(e < dEye && l < dLook, `step ${i}: eye ${e} < ${dEye}, look ${l} < ${dLook}`);
    dEye = e; dLook = l;
  }
  assert.ok(dEye < 1, `eye within a foot after 1 s (${dEye})`);
  assert.ok(dLook < 1, `look within a foot after 1 s (${dLook})`);
  // a long frame (a slow tab) does not overshoot either
  const big = camStep(newCam(bike()), goal, 5);
  assert.ok(dist3(big.eye, goal.eye) < 1e-6);
});

test("camYaw is the camera's heading: 0 facing 12:00, π/2 facing 3:00", () => {
  near(camYaw(newCam(bike())), 0, 1e-9);
  near(camYaw(newCam(bike({ h: Math.PI / 2 }))), Math.PI / 2, 1e-9);
  near(camYaw(newCam(bike({ h: Math.PI }))), Math.PI, 1e-6);
  // stored on the state too
  near(newCam(bike({ h: 1 })).yaw, camYaw(newCam(bike({ h: 1 }))), 1e-12);
});

test("newCam starts the camera on its goal", () => {
  const t = bike({ x: 2000, y: 3000, h: 1.2, vx: 20, vy: -10 });
  const c = newCam(t), g = camGoal(t);
  near(c.eye.x, g.eye.x); near(c.eye.z, g.eye.z); near(c.look.x, g.look.x); near(c.fov, g.fov);
});

// a bike on the outer street of block ring 2, heading outward, so the camera behind it is inside the block
function streetTargetFacingOut() {
  const { m0, m1 } = blockBounds(2, 5);
  for (let m = m0 + 12; m < m1 - 12; m += 1) {
    const at = polar(m, ARC_R[3]), t = bike({ x: at.x, y: at.y, h: clockToAngle(m) });
    const goal = camGoal(t);
    if (!solidAt(at, false) && solidAt({ x: goal.eye.x, y: goal.eye.z }, false)) return { t, goal };
  }
  assert.fail("no street spot with the camera inside the block");
}

test("camAvoid pulls an eye out of a block of camps and lifts it 8 ft", () => {
  const { t, goal } = streetTargetFacingOut();
  const out = camAvoid(t, goal);
  assert.equal(solidAt({ x: out.eye.x, y: out.eye.z }, false), null, "the new eye is clear");
  assert.ok(out.eye.y >= goal.eye.y + 8 - 1e-9, `${out.eye.y} is 8 ft above ${goal.eye.y}`);
  assert.ok(out.eye.y >= 4);
  // it moved toward the target, along the line to the goal
  assert.ok(Math.hypot(out.eye.x - t.x, out.eye.z - t.y) < Math.hypot(goal.eye.x - t.x, goal.eye.z - t.y));
  // everything else about the goal survives, fov included
  assert.equal(out.fov, goal.fov); assert.deepEqual(out.look, goal.look);
  // the goal object itself is not touched
  assert.ok(solidAt({ x: goal.eye.x, y: goal.eye.z }, false));
});

test("camAvoid leaves a clear goal alone", () => {
  const t = bike({ x: 0, y: -3500, h: 0 });     // the open playa between the Man and the Esplanade
  const goal = camGoal(t);
  assert.equal(solidAt({ x: goal.eye.x, y: goal.eye.z }, false), null);
  assert.equal(camAvoid(t, goal), goal);
});

test("camAvoid leaves the goal alone for an airborne target and for a bike already inside a block", () => {
  const { t, goal } = streetTargetFacingOut();
  assert.equal(camAvoid({ ...t, alt: 20, plane: true }, goal), goal);
  assert.equal(camAvoid({ ...t, alt: 300, chute: true }, goal), goal);
  // a bike riding the alleys: the middle of block ring 2 sector 5
  const b = blockBounds(2, 5), mid = polar((b.m0 + b.m1) / 2, (b.r0 + b.r1) / 2);
  assert.ok(solidAt(mid, false), "the middle of the block is solid to a car");
  const inAlley = bike({ x: mid.x, y: mid.y, h: 0.3 }), g2 = camGoal(inAlley);
  assert.equal(camAvoid(inAlley, g2), g2);
});
