import type { Vec3 } from "./view3d.ts";
import { solidAt } from "./playa.ts";

/**
 * The chase camera, pure: where it wants to be behind a ride, how it eases there, and how it keeps out of the camps.
 * Positions are in three.js axes (X east, Y up, Z south), a heading is the game's (0 faces 12:00, clockwise), so the
 * game point (x, y) is the three.js point (x, ·, y). src/game/three/renderer.ts feeds it the Game and draws from it.
 */

export type CamState = { eye: Vec3; look: Vec3; yaw: number; fov: number };
/** What the camera needs to know about the ride it follows. */
export type CamTarget = { x: number; y: number; h: number; vx: number; vy: number; alt: number; len: number; maxSpeed: number; chute: boolean; plane: boolean };
export type CamGoal = { eye: Vec3; look: Vec3; fov: number };

export const CAM = {
  tauPos: 0.18, tauLook: 0.08,        // seconds the eye and the look point take to close 63% of the gap
  fovMin: 60, fovMax: 70,             // degrees, standing still to flat out
  backK: 2.6, backMin: 14,            // feet behind: backK · ride length + backMin
  upK: 1.3, upMin: 9,                 // feet above the ride: upK · ride length + upMin
  pullMax: 0.35,                      // pulls back this much further at top speed
  aheadK: 1.0, aheadMin: 12,          // looks this far ahead of the ride: aheadK · length + aheadMin
  velLead: 0.35,                      // and further along its velocity (seconds' worth)
} as const;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Where the camera wants to be for this target, before smoothing: behind by backK·len+backMin (× 1+pullMax·speed/maxSpeed),
 * up by upK·len+upMin, turned by `orbit` round the ride; looking at a point aheadK·len+aheadMin ahead plus velLead·velocity,
 * at a third of the ride's length up. In the air (the plane or the chute, once it is off the ground) the camera trails
 * further, measured from the ride's own height: back + 0.25·alt, up + 0.5·alt, and it looks at the ride itself.
 */
export function camGoal(t: CamTarget, orbit = 0): CamGoal {
  const speed = Math.hypot(t.vx, t.vy), run = clamp01(speed / Math.max(1, t.maxSpeed));
  // 0 on the ground, 1 well up; the look point eases from ahead of the ride to the ride itself so take-off does not snap the view
  const air = t.plane || t.chute ? clamp01(t.alt / 30) : 0;
  const back = (CAM.backK * t.len + CAM.backMin) * (1 + CAM.pullMax * run) + 0.25 * t.alt;
  const up = CAM.upK * t.len + CAM.upMin + 0.5 * t.alt;
  const ho = t.h + orbit;
  const ahead = (CAM.aheadK * t.len + CAM.aheadMin) * (1 - air);
  const lead = CAM.velLead * (1 - air);
  const fx = Math.sin(t.h), fy = -Math.cos(t.h);   // the ride's heading (fwd in view3d.ts)
  return {
    eye: { x: t.x - Math.sin(ho) * back, y: t.alt + up, z: t.y + Math.cos(ho) * back },
    look: { x: t.x + fx * ahead + t.vx * lead, y: t.alt + t.len / 3, z: t.y + fy * ahead + t.vy * lead },
    fov: CAM.fovMin + (CAM.fovMax - CAM.fovMin) * run,
  };
}

/** The camera's forward heading in the game's convention, for the stick. */
export const camYaw = (s: CamState) => Math.atan2(s.look.x - s.eye.x, -(s.look.z - s.eye.z));

const withYaw = (g: CamGoal): CamState => {
  const s: CamState = { eye: { ...g.eye }, look: { ...g.look }, yaw: 0, fov: g.fov };
  s.yaw = camYaw(s);
  return s;
};

/** One step of the smoothing: exponential approach with time constants tauPos / tauLook (k = 1 - e^(-dt/τ)); fov eases with tauPos. */
export function camStep(s: CamState, goal: CamGoal, dt: number): CamState {
  const kp = 1 - Math.exp(-dt / CAM.tauPos), kl = 1 - Math.exp(-dt / CAM.tauLook);
  const n: CamState = {
    eye: { x: s.eye.x + (goal.eye.x - s.eye.x) * kp, y: s.eye.y + (goal.eye.y - s.eye.y) * kp, z: s.eye.z + (goal.eye.z - s.eye.z) * kp },
    look: { x: s.look.x + (goal.look.x - s.look.x) * kl, y: s.look.y + (goal.look.y - s.look.y) * kl, z: s.look.z + (goal.look.z - s.look.z) * kl },
    yaw: 0,
    fov: s.fov + (goal.fov - s.fov) * kp,
  };
  n.yaw = camYaw(n);
  return n;
}

/**
 * Keep the camera out of the camp blocks. Returns the goal unchanged when the target is airborne (target.alt >= 20: plane or
 * chute; solidAt is 2-D) or when the target itself is already solid (solidAt({ x: target.x, y: target.y }, false) is non-null:
 * a bike riding the alleys, since bikes go through camps). Otherwise it samples 8 points from the target to the goal eye (game
 * x = eye.x, game y = eye.z); at the first one where solidAt(p, false) is non-null the eye goes to the PREVIOUS (clear) sample,
 * raised by 8 ft. The eye is never below 4 ft.
 */
export function camAvoid<G extends { eye: Vec3; look: Vec3 }>(target: CamTarget, goal: G): G {
  if (target.alt >= 20) return goal;
  if (solidAt({ x: target.x, y: target.y }, false)) return goal;
  const STEPS = 8;
  let px = target.x, py = target.y;
  for (let i = 1; i <= STEPS; i++) {
    const x = target.x + (goal.eye.x - target.x) * (i / STEPS), y = target.y + (goal.eye.z - target.y) * (i / STEPS);
    if (solidAt({ x, y }, false)) return { ...goal, eye: { x: px, y: Math.max(4, goal.eye.y + 8), z: py } };
    px = x; py = y;
  }
  return goal;
}

/** A camera that starts where it wants to be (the first frame, and after a jump too far to ease across). */
export const newCam = (t: CamTarget): CamState => withYaw(camAvoid(t, camGoal(t)));
