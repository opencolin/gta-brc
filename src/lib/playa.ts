/**
 * The playa game's rules: a ride on Black Rock City's grid (brc.ts), driven top-down the
 * way the first Grand Theft Auto drove: arcade physics, bounce-not-death collisions, a pager
 * of jobs against the clock, MOOP to pick up, slow art cars and bikes not to hit, dust storms
 * and a day that turns to night. PlayaWin.tsx draws it and feeds it keys.
 *
 * The city's sound camps (soundcamps.ts) stand at their addresses, each with a parking bay
 * cut into its block in front of its stage: stop in one and the window opens that camp's
 * SoundCloud. The famous art cars roam the open playa, and pulling up beside one does the same.
 *
 * Everything here is plain data stepped by a fixed dt, with a seeded random number generator
 * in the state, so a run replays exactly (playa.test.mjs drives it).
 *
 * Units are feet and seconds. The speedometer reads in "playa mph": ft/s × MPH, scaled so the
 * art car's top speed reads about 50. The camp speed limit is 5, as everyone ignores.
 */
import {
  AIRPORT, ARC_R, ARCS, CENTER_CAMP, CENTER_CAMP_R, CAFE_R, CITY_SCALE, CITY_TO, FENCE_R, MAN_R, TEMPLE, TEMPLE_DIST, TEMPLE_R, arcIndex, arcWidth, blockPush, clockLabel,
  clockToAngle, fenceDepth, parseClock, pointAt, polar, surfaceAt, toPolar, type ArcName, type Vec,
} from "./brc.ts";
import { planAt, planCity, structPush, type BlockPlan } from "./camps.ts";
import { SOUND_CAMPS, campTracks, type SoundCamp } from "./soundcamps.ts";

/** Where Agave Lounge camps: the Esplanade at 8:30, its dome facing the open playa. */
export const AGAVE_ADDRESS = "8:30 & Esplanade";

/** Feet per second → the mph on the HUD (asked 2026-10-22: a bike tops out about 21, an e-bike about 50). */
export const MPH = 1 / 7;
export const SPEED_LIMIT_MPH = 5;

/* ── what you ride ──────────────────────────────────────────────────────── */

/**
 * The rides, each with its own hit box and feel. The cruiser bike is nimble and slow-ish and
 * can weave through the camps (slowly); the art cars are heavy, faster on the open playa, and
 * bounce off the blocks; the unicycle is for fun.
 *
 * len × wid is the hit box in feet. `dust` scales the top speed on loose open playa, `grip`
 * scales how hard the tyres hold, and `throughCamps` lets a ride cross the blocks of camps
 * (everyone still bounces off the Man, the Temple, art, stages, the fence and the others).
 */
export type Vehicle = {
  name: string;
  len: number; wid: number;
  maxSpeed: number; maxReverse: number;
  accel: number; brake: number; reverse: number; handbrake: number;
  drag: number; roll: number;
  maxYaw: number; hbYaw: number;
  restitution: number;
  dust: number; grip: number;
  throughCamps: boolean;
};
export const VEHICLES = {
  bike: {
    name: "bike", len: 16, wid: 7, // the cruiser's pixel art drawn at 0.55, about the size of the other bikes (PlayaWin.tsx, 2026-10-22)
    maxSpeed: 147, maxReverse: 40, accel: 150, brake: 330, reverse: 60, handbrake: 260, // 21 mph on the HUD
    drag: 0.32, roll: 18, maxYaw: 3.1, hbYaw: 1.6, restitution: 0.35, dust: 0.85, grip: 1.1, throughCamps: true,
  },
  ebike: {
    // the cruiser with a battery: twice the bike's top speed, a stronger pull, same size (asked 2026-10-22)
    name: "e-bike", len: 16, wid: 7,
    maxSpeed: 350, maxReverse: 40, accel: 260, brake: 380, reverse: 60, handbrake: 280, // 50 mph on the HUD
    drag: 0.28, roll: 16, maxYaw: 2.8, hbYaw: 1.6, restitution: 0.35, dust: 1, grip: 1, throughCamps: true,
  },
  artcar: {
    name: "art car", len: 34, wid: 20, // Agave's dome on wheels, its 21 × 36 pixel art
    maxSpeed: 250, maxReverse: 70, accel: 115, brake: 280, reverse: 80, handbrake: 220,
    drag: 0.3, roll: 14, maxYaw: 1.9, hbYaw: 1.7, restitution: 0.25, dust: 1.12, grip: 0.9, throughCamps: false,
  },
  fish: {
    name: "cuttlefish", len: 36, wid: 20, // a cuttlefish art car, its fin rippling and its colours rolling (PlayaWin.tsx drawCuttlefish)
    maxSpeed: 225, maxReverse: 60, accel: 125, brake: 300, reverse: 80, handbrake: 240,
    drag: 0.31, roll: 15, maxYaw: 2.1, hbYaw: 2, restitution: 0.3, dust: 1.05, grip: 0.75, throughCamps: false,
  },
  // a famous art car you found on the playa and took the wheel of (PlayaWin "drive it", artcars.ts draws it; asked 2026-10-22)
  found: {
    name: "art car", len: 36, wid: 20, // drawn at 0.58 of the 64-foot art car: the streets are twice the longest ride
    maxSpeed: 200, maxReverse: 60, accel: 95, brake: 260, reverse: 70, handbrake: 200,
    drag: 0.3, roll: 14, maxYaw: 1.6, hbYaw: 1.5, restitution: 0.2, dust: 1.2, grip: 0.9, throughCamps: false,
  },
  // the plane from the airport (asked 2026-10-22): slow to roll, fast once it lifts, wide and gentle in a turn
  plane: {
    name: "plane", len: 30, wid: 34,
    maxSpeed: 480, maxReverse: 20, accel: 70, brake: 160, reverse: 20, handbrake: 120,
    drag: 0.12, roll: 5, maxYaw: 1.1, hbYaw: 1.1, restitution: 0.2, dust: 0.8, grip: 1, throughCamps: false,
  },
  unicycle: {
    name: "unicycle", len: 10, wid: 8,
    maxSpeed: 75, maxReverse: 25, accel: 90, brake: 220, reverse: 40, handbrake: 200,
    drag: 0.4, roll: 22, maxYaw: 4.2, hbYaw: 1.4, restitution: 0.5, dust: 0.9, grip: 1.2, throughCamps: true,
  },
} as const satisfies Record<string, Vehicle>;
export type VehicleId = keyof typeof VEHICLES;
export const VEHICLE_IDS = Object.keys(VEHICLES) as VehicleId[];
/** The default ride, and the one the tests' physics lean on. */
export const CAR: Vehicle = VEHICLES.bike;
/** Riding through a block of camps is slow: the top speed there, as a share of the ride's. */
export const CAMP_SPEED = 0.6;

export type Car = { x: number; y: number; h: number; vx: number; vy: number; steer: number };
/** The one-thumb stick (asked 2026-10-23): `a` is the heading you point it in (world radians, as car.h) and `k` how far
 * you push, 0..1: the bike turns toward `a` and cruises at `k` of its top speed; pulled back (more than STICK_BACK off
 * the heading) it brakes, then reverses. */
export type Stick = { a: number; k: number };
export type Input = { gas: boolean; brake: boolean; left: boolean; right: boolean; handbrake: boolean; stick?: Stick | null };
export const NO_INPUT: Input = { gas: false, brake: false, left: false, right: false, handbrake: false, stick: null };
export const STICK_DEAD = 0.12, STICK_BACK = 2.4, STICK_LOCK = 0.5;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** The stick read as pedals and wheel for a car heading `h` at forward speed `vf` with top speed `top`; the keys
 * and pads when there is no stick (or it is in its dead zone). `want` is the wheel, −1..1; `throttle` scales the gas. */
export function readStick(h: number, vf: number, top: number, input: Input): { gas: boolean; brake: boolean; want: number; throttle: number } {
  const st = input.stick;
  if (!st || st.k < STICK_DEAD) return { gas: input.gas, brake: input.brake, want: (input.right ? 1 : 0) - (input.left ? 1 : 0), throttle: 1 };
  const e = wrapAngle(st.a - h);
  if (Math.abs(e) > STICK_BACK) return { gas: false, brake: true, want: 0, throttle: 1 };
  return { gas: vf < top * st.k - 1, brake: false, want: Math.max(-1, Math.min(1, e / STICK_LOCK)), throttle: Math.max(0.45, st.k) };
}
/** Whether the stick is being pushed at all. */
export const stickOn = (input: Input) => !!input.stick && input.stick.k >= STICK_DEAD;

export const newCar = (at: Vec, h = 0): Car => ({ x: at.x, y: at.y, h, vx: 0, vy: 0, steer: 0 });
export const speedOf = (c: { vx: number; vy: number }) => Math.hypot(c.vx, c.vy);
export const mph = (ftPerSec: number) => Math.round(ftPerSec * MPH);
const fwd = (h: number) => ({ x: Math.sin(h), y: -Math.cos(h) });
const right = (h: number) => ({ x: Math.cos(h), y: Math.sin(h) });

/** How the ground holds the tyres: the streets are packed, the open playa is loose dust that drifts. */
export function gripAt(p: Vec): number {
  const k = surfaceAt(p).kind;
  return k === "road" || k === "plaza" ? 8 : 4.2;
}

/** The car's forward and sideways speeds (sideways > 0: sliding to its right). */
export function carSpeeds(c: Car) {
  const f = fwd(c.h), r = right(c.h);
  return { forward: c.vx * f.x + c.vy * f.y, side: c.vx * r.x + c.vy * r.y };
}

/**
 * One physics step: throttle, brakes and reverse, drag, steering that needs speed and tightens
 * less the faster you go, and grip that bleeds the sideways slide away, slowly on dust and
 * hardly at all with the handbrake on, which is the drift. Returns a new car.
 */
export function carStep(c: Car, input: Input, dt: number, grip = 8, v: Vehicle = CAR): Car {
  if (!(dt > 0) || !Number.isFinite(dt)) return c;
  dt = Math.min(dt, 0.05);
  const f = fwd(c.h), r = right(c.h);
  const top = v.maxSpeed * (grip < 6 ? v.dust : 1);
  let vf = c.vx * f.x + c.vy * f.y, vs = c.vx * r.x + c.vy * r.y;
  const { gas, brake, want, throttle } = readStick(c.h, vf, top, input);
  if (gas) vf += (vf < -1 ? v.brake : v.accel * throttle) * dt;
  if (brake) vf -= (vf > 1 ? v.brake : v.reverse) * dt;
  if (input.handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), v.handbrake * dt);
  vf -= vf * v.drag * dt;
  if (!gas && !brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), v.roll * dt);
  // over the top (driving off a street onto dust) it bleeds back down rather than snapping
  if (vf > top) vf = Math.max(top, vf - v.brake * 0.5 * dt);
  vf = Math.max(-v.maxReverse, Math.min(v.maxSpeed * Math.max(1, v.dust), vf));
  const g = input.handbrake ? 1.2 : grip * v.grip;
  vs *= Math.exp(-g * dt);
  const steer = c.steer + (want - c.steer) * Math.min(1, dt * 9);
  const spd = Math.abs(vf);
  const yaw = steer * v.maxYaw * Math.min(1, spd / 45) / (1 + spd / 320) * Math.sign(vf) * (input.handbrake ? v.hbYaw : 1);
  let vx = vf * f.x + vs * r.x, vy = vf * f.y + vs * r.y;
  const s = Math.hypot(vx, vy), cap = v.maxSpeed * Math.max(1, v.dust);
  if (s > cap) { vx *= cap / s; vy *= cap / s; }
  return { x: c.x + vx * dt, y: c.y + vy * dt, h: c.h + yaw * dt, vx, vy, steer };
}

/** The four corners of the car and the middle of its nose, in world feet. */
export function carPoints(c: Car, v: Vehicle = CAR): Vec[] {
  const f = fwd(c.h), r = right(c.h), hl = v.len / 2, hw = v.wid / 2;
  const at = (a: number, b: number) => ({ x: c.x + f.x * a + r.x * b, y: c.y + f.y * a + r.y * b });
  return [at(hl, -hw), at(hl, hw), at(-hl, -hw), at(-hl, hw), at(hl + 2, 0)];
}

export type Circle = { x: number; y: number; r: number; name: string };

/**
 * The big art on the open playa (asked 2026-10-23): real pieces, each drawn in detail in game/artpieces.ts and listed
 * in soundcamps.ts (kind "art" with `piece`), so each is a place with a bay and a panel of its videos (2026-10-24).
 * `clock` and `ft` are the piece's published placement from Burning Man's art data as mirrored by iBurn
 * (github.com/iBurnApp/iBurn-Data and Burning-Man-Earth/iBurn-Data, data/<year>/APIData/art.json) for the
 * year given, nudged by up to 100 ft where an art-car loop runs through it; the classics from before 2023
 * (year 0) stand where there is room for them, since their old placements are not in that data.
 * `r` is the footprint the car bounces off; `hue` colours its diamond on the maps and its glow at night.
 */
export type ArtPiece = Circle & { id: string; hue: number; artist: string; year: number; clock: string; ft: number; blurb: string };
export const ART: readonly ArtPiece[] = SOUND_CAMPS.filter((c) => c.piece && c.playa).map((c) => ({
  id: c.id, name: c.name, artist: c.piece!.artist, year: c.piece!.year, clock: c.playa!.clock, ft: c.playa!.ft, r: c.piece!.r, hue: c.piece!.hue, blurb: c.blurb,
  ...polar(parseClock(c.playa!.clock)!, c.playa!.ft * CITY_SCALE),
}));

/* ── the sound camps: a stage at the address, a parking bay cut into the block in front ── */

/** A parking bay: an annular box, r0 to r1 from the Man and `half` feet either side of `min` along the street. */
export type Bay = { min: number; r0: number; r1: number; half: number };
export type Spot = {
  /** the place key: "agave" or "camp:<id>" */
  key: string; name: string; kind: "agave" | "camp" | "fence" | "art";
  /** the address's clock and street (null out on the playa) */
  min: number; arc: ArcName | null;
  stage: Circle; bay: Bay;
  /** the street in front of the bay, and the bay's middle */
  curb: Vec; curbMin: number; mid: Vec;
  hue: number; camp?: SoundCamp;
};

/** Minutes between two clock positions, wrapped into (-360, 360]. */
const dMin = (a: number, b: number) => { let d = (a - b) % 720; if (d > 360) d -= 720; if (d <= -360) d += 720; return d; };
const ftToMin = (ft: number, r: number) => (ft / r) * (720 / (Math.PI * 2));

/** Whether a point is in a bay. */
export function inBay(p: Vec, b: Bay, margin = 0): boolean {
  const { min, r } = toPolar(p);
  if (r < b.r0 - margin || r > b.r1 + margin) return false;
  return Math.abs(clockToAngle(dMin(min, b.min)) * r) <= b.half + margin;
}
/** From a point in the block beside a bay, the shortest way into the bay: the nearest point of its box. */
function bayExit(p: Vec, b: Bay): Push | null {
  const { min, r } = toPolar(p);
  const v = clockToAngle(dMin(min, b.min)) * r;
  const rc = Math.max(b.r0, Math.min(b.r1, r)), vc = Math.max(-b.half, Math.min(b.half, v));
  const q = polar(b.min + ftToMin(vc, rc), rc);
  const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy);
  if (d > 60 || d < 1e-9) return null;
  return { depth: d, nx: dx / d, ny: dy / d };
}

const hueOf = (s: string) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };

/**
 * A camp's spot from its address ("8:30 & Esplanade", either way round): its stage in the
 * block on the far side of the street from the Man (on L, the near side), `along` feet
 * clockwise of the corner (counter-clockwise at 10:00, the city's last radial), and a parking
 * bay between the street and the stage you can drive into.
 */
export function spotAt(address: string, o: { along?: number; nudge?: number; depth?: number; half?: number; stageR?: number } = {}) {
  const parts = address.split("&").map((s) => s.trim());
  const clock = parts.find((s) => parseClock(s) != null) ?? "8:30";
  const min = parseClock(clock) ?? 510;
  let i = arcIndex(parts.find((s) => arcIndex(s) >= 0) ?? "Esplanade");
  if (i < 0) i = 0;
  const along = o.along ?? 130, depth = o.depth ?? 62, half = o.half ?? 34, stageR = o.stageR ?? 36;
  const out = i < ARC_R.length - 1 ? 1 : -1;
  const edge = ARC_R[i] + out * (arcWidth(i) / 2);
  const dir = min >= CITY_TO - 1e-9 ? -1 : 1;
  const ft = dir * along + (o.nudge ?? 0);
  const a = edge - out * 6, b = edge + out * depth;
  const r0 = Math.min(a, b), r1 = Math.max(a, b), rm = (r0 + r1) / 2;
  const rs = edge + out * (depth + 8 + stageR);
  const bayMin = min + ftToMin(ft, rm);
  return {
    min, arc: ARCS[i],
    stage: { ...polar(min + ftToMin(ft, rs), rs), r: stageR },
    bay: { min: bayMin, r0, r1, half },
    curb: polar(min + ftToMin(ft, ARC_R[i]), ARC_R[i]), curbMin: min + ftToMin(ft, ARC_R[i]),
    mid: polar(bayMin, rm),
  };
}

/** Agave Lounge: its dome behind its own bay, on the playa-facing frontage of the Esplanade. */
export function agaveSpot(address = AGAVE_ADDRESS) {
  const s = spotAt(address, { along: 140, depth: 70, half: 38, stageR: 70 });
  // the Earth dome behind the bay, and the smaller Moon dome beside it (asked 2026-10-23): along the street,
  // a little deeper into the block
  const d = Math.hypot(s.stage.x, s.stage.y) || 1, ux = s.stage.x / d, uy = s.stage.y / d, moonR = 30;
  const moon = { x: s.stage.x - uy * (s.stage.r + moonR + 14) + ux * 12, y: s.stage.y + ux * (s.stage.r + moonR + 14) + uy * 12, r: moonR, name: "the Moon dome" };
  return { ...s, dome: { ...s.stage }, moon };
}
export const AGAVE = agaveSpot();

/** The fence stage: out past the Temple, just inside the trash fence's 12:00 corner. */
const FENCE_STAGE_R = FENCE_R - 1000;
function fenceSpot(c: SoundCamp): Spot { return openSpot(c, 0, FENCE_STAGE_R, "fence"); }
/** A stage out on the open playa at a clock and a distance from the Man, its bay on the Man's side. */
function openSpot(c: SoundCamp, min: number, r: number, kind: "fence" | "art"): Spot {
  const bay: Bay = { min, r0: r - 190, r1: r - 70, half: 46 };
  const mid = polar(min, (bay.r0 + bay.r1) / 2);
  return { key: `camp:${c.id}`, name: c.name, kind, min, arc: null, stage: { ...polar(min, r), r: 52, name: c.name }, bay, curb: mid, curbMin: min, mid, hue: kind === "art" ? hueOf(c.id) : 300, camp: c };
}
/** An art place's spot (soundcamps.ts `playa`): real feet scaled to the game's city. A big piece (`piece`) is its own
 * stage, as wide as its footprint, with the bay in front of it on the Man's side. */
function artSpot(c: SoundCamp): Spot {
  const s = openSpot(c, parseClock(c.playa!.clock) ?? 0, c.playa!.ft * CITY_SCALE, "art");
  if (!c.piece) return s;
  const r = c.playa!.ft * CITY_SCALE, bay: Bay = { min: s.min, r0: r - c.piece.r - 170, r1: r - c.piece.r - 20, half: Math.max(60, c.piece.r) };
  const mid = polar(s.min, (bay.r0 + bay.r1) / 2);
  return { ...s, stage: { ...s.stage, r: c.piece.r }, bay, curb: mid, mid, hue: c.piece.hue };
}

/** Whether a spot sits wholly in its block: the stage's rim and the bay on block ground, the curb on a street. */
function spotFits(s: ReturnType<typeof spotAt>): boolean {
  const rim = Array.from({ length: 12 }, (_, i) => ({ x: s.stage.x + Math.cos(i * Math.PI / 6) * (s.stage.r + 4), y: s.stage.y + Math.sin(i * Math.PI / 6) * (s.stage.r + 4) }));
  const rm = (s.bay.r0 + s.bay.r1) / 2;
  const edge = [-1, 1].map((k) => polar(s.bay.min + ftToMin(k * s.bay.half, rm), rm));
  return [s.stage, ...rim, s.mid, ...edge].every((p) => surfaceAt(p).kind === "block") && surfaceAt(s.curb).kind === "road";
}
/** Two spots too close: their stages or their bays would touch. */
type Round = { x: number; y: number; r: number };
const clash = (a: { stage: Round; mid: Vec; bay: Bay }, b: { stage: Round; mid: Vec; bay: Bay }) =>
  Math.hypot(a.stage.x - b.stage.x, a.stage.y - b.stage.y) < a.stage.r + b.stage.r + 24 ||
  Math.hypot(a.mid.x - b.mid.x, a.mid.y - b.mid.y) < a.bay.half + b.bay.half + 24;
/** How far along its street a camp may slide, in feet, nearest first, to clear the camps placed before it. */
export const NUDGES = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map((k) => k * 120);
function placeCamp(c: SoundCamp, placed: readonly Spot[]): Spot {
  for (const n of NUDGES) {
    const s = spotAt(c.address!, { nudge: (c.nudge ?? 0) + n });
    if (spotFits(s) && !placed.some((p) => clash(p, s))) return { key: `camp:${c.id}`, name: c.name, kind: "camp", ...s, stage: { ...s.stage, name: c.name }, hue: hueOf(c.id), camp: c };
  }
  throw new Error(`no room for ${c.name} at ${c.address}`);
}

/** Every place you can park and hear a camp: Agave first, then the sound camps and the fence stage. */
export const SPOTS: readonly Spot[] = (() => {
  const out: Spot[] = [{ key: "agave", name: "Agave Lounge", kind: "agave", ...AGAVE, stage: { ...AGAVE.dome, name: "Agave Lounge" }, hue: 330 }];
  for (const c of SOUND_CAMPS) {
    if (c.kind === "mutant") continue;
    if (c.piece && !campTracks(c).length) continue; // a piece with no videos yet is drawn, not a place to stop at
    out.push(c.kind === "art" ? artSpot(c) : c.kind === "fence" || !c.address ? fenceSpot(c) : placeCamp(c, out));
  }
  return out;
})();
export const spotOf = (key: string) => SPOTS.find((s) => s.key === key);

/** What a car bounces off besides the blocks and the fence. */
export const OBSTACLES: readonly Circle[] = [
  { x: 0, y: 0, r: MAN_R, name: "the Man" },
  { ...TEMPLE, r: TEMPLE_R, name: "the Temple" },
  { ...CENTER_CAMP, r: CAFE_R, name: "Center Camp café" },
  ...ART,
  ...SPOTS.filter((s) => !s.camp?.piece).map((s) => s.stage), // a piece's stage is the piece, already listed
  AGAVE.moon,
];

/** The camps inside the blocks (camps.ts), clear of the stages, the bays and Center Camp. */
let CITY: BlockPlan[] | null = null;
export const cityPlan = () => CITY ??= planCity([
  ...SPOTS.flatMap((s) => [{ x: s.stage.x, y: s.stage.y, r: s.stage.r + 14 }, { x: s.mid.x, y: s.mid.y, r: s.bay.half + 30 }]),
  { x: AGAVE.moon.x, y: AGAVE.moon.y, r: AGAVE.moon.r + 14 },
  { x: CENTER_CAMP.x, y: CENTER_CAMP.y, r: CENTER_CAMP_R + 30 },
]);

export type Push = { depth: number; nx: number; ny: number };

/**
 * Whether a point is in something solid, and the shortest way out. A block of camps is solid
 * to a car (but for the parking bays cut into it); a ride that goes `through` the camps only
 * bounces off what stands in them.
 */
export function solidAt(p: Vec, through = false): Push | null {
  const f = fenceDepth(p);
  if (f.depth < 0) {
    // past the fence: solid everywhere but the wedge the airport sits in (brc.ts AIRPORT.gap)
    const m = toPolar(p).min;
    if (m < AIRPORT.gap.from || m > AIRPORT.gap.to) return { depth: -f.depth, nx: f.nx, ny: f.ny };
    return null;
  }
  const b = blockPush(p);
  if (b) {
    if (through) {
      const plan = planAt(cityPlan(), p);
      if (plan) for (const s of plan.solids) {
        if (Math.abs(p.x - s.x) > s.w + s.l || Math.abs(p.y - s.y) > s.w + s.l) continue;
        const q = structPush(p, s);
        if (q) return q;
      }
    } else {
      let best: Push = b, open = false;
      for (const s of SPOTS) {
        if (Math.abs(p.x - s.mid.x) > 260 || Math.abs(p.y - s.mid.y) > 260) continue;
        if (inBay(p, s.bay)) { open = true; break; }
        const q = bayExit(p, s.bay);
        if (q && q.depth < best.depth) best = q;
      }
      if (!open) return best;
    }
  }
  for (const o of OBSTACLES) {
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy);
    if (d < o.r) return d > 1e-6 ? { depth: o.r - d, nx: dx / d, ny: dy / d } : { depth: o.r, nx: 0, ny: -1 };
  }
  return null;
}

/** Push the car out along n and bounce what was going into it. Returns the speed of the impact. */
export function bounce(c: Car, p: Push, restitution = CAR.restitution): number {
  c.x += p.nx * (p.depth + 0.01);
  c.y += p.ny * (p.depth + 0.01);
  const vn = c.vx * p.nx + c.vy * p.ny;
  if (vn >= 0) return 0;
  c.vx -= (1 + restitution) * vn * p.nx;
  c.vy -= (1 + restitution) * vn * p.ny;
  c.vx *= 0.85; c.vy *= 0.85; // scrape along it
  return -vn;
}

/** Keep the car out of everything solid: a few rounds over its corners, deepest first. Returns the hardest impact. */
export function collide(c: Car, v: Vehicle = CAR): number {
  let hit = 0;
  for (let round = 0; round < 4; round++) {
    let worst: Push | null = null;
    for (const p of carPoints(c, v)) {
      const s = solidAt(p, v.throughCamps);
      if (s && (!worst || s.depth > worst.depth)) worst = s;
    }
    if (!worst) break;
    hit = Math.max(hit, bounce(c, worst, v.restitution));
  }
  return hit;
}

/* ── the others on the road ─────────────────────────────────────────────── */

type NpcBase = {
  kind: "bike" | "ebike" | "walker" | "artcar" | "mutant" | "ambulance"; speed: number; phase: number; hue: number; r: number; key?: string; name?: string;
  /** a biker riding with an art car: where the car was `lag` seconds ago, `side` feet off its line */
  lead?: Npc; lag?: number; side?: number;
};
export type Npc = (NpcBase & { path: "arc"; from: number; to: number }) | (NpcBase & { path: "loop" });
export const NPC_R = { bike: 7, ebike: 7, walker: 5, artcar: 24, mutant: 32, ambulance: 14 } as const;
/** Room a biker riding with an art car keeps from it: wide enough to ride between them. */
export const FOLLOW_GAP = 30;

/** Where an NPC is at a time, and which way it faces: bikes and cars ping-pong along an arc street or circle the Man. */
/**
 * The art car you are driving (asked 2026-10-22): the real one, not a copy. While you drive it, it is wherever
 * your car has been, so its riders, who follow where it was a moment ago, follow you; its music comes with you.
 */
const driven: { key: string | null; trail: { t: number; x: number; y: number; h: number }[] } = { key: null, trail: [] };
/** Art cars left where their driver hopped off (asked 2026-10-22): parked there until someone drives them again. */
const parkedCars = new Map<string, { x: number; y: number; h: number }>();
export function setDriven(key: string | null) { if (key) parkedCars.delete(key); driven.key = key; driven.trail = []; }
export const drivenKey = () => driven.key;
export const parkedCarAt = (key: string) => parkedCars.get(key) ?? null;
/**
 * Step out of the art car you drive (asked 2026-10-22): it stays parked where you left it, not sent back on its
 * route, and you are on the bike beside it. Does nothing but clear the wheel if you were not in a found car.
 */
export function leaveDriven(g: Game) {
  if (!driven.key || g.vehicle !== "found") { setDriven(null); return; }
  parkedCars.set(driven.key, { x: g.car.x, y: g.car.y, h: g.car.h });
  driven.key = null; driven.trail = [];
  const rt = right(g.car.h);
  g.car = { ...g.car, x: g.car.x + rt.x * 70, y: g.car.y + rt.y * 70, vx: 0, vy: 0 };
  setVehicle(g, "bike");
  collide(g.car, VEHICLES.bike);
}
function noteDriven(t: number, c: { x: number; y: number; h: number }) {
  const tr = driven.trail;
  if (tr.length && t < tr[tr.length - 1].t) tr.length = 0; // a new game
  tr.push({ t, x: c.x, y: c.y, h: c.h });
  while (tr.length > 2 && tr[0].t < t - 20) tr.shift();
}
function drivenAt(t: number): { x: number; y: number; h: number } | null {
  const tr = driven.trail;
  if (!tr.length) return null;
  for (let i = tr.length - 1; i >= 0; i--) if (tr[i].t <= t) return tr[i];
  return tr[0];
}
export function npcAt(n: Npc, t: number): { x: number; y: number; h: number } {
  if (driven.key && n.key === driven.key) { const p = drivenAt(t); if (p) return p; }
  if (n.key) { const pk = parkedCars.get(n.key); if (pk) return pk; }
  if (n.lead) {
    const p = npcAt(n.lead, t - (n.lag ?? 2)), rt = right(p.h), side = n.side ?? 0;
    // a slow art car is still close to where it was, so keep the biker outside it with room for a rider between
    const at = { x: p.x + rt.x * side, y: p.y + rt.y * side }, now = npcAt(n.lead, t);
    const dx = at.x - now.x, dy = at.y - now.y, d = Math.hypot(dx, dy), clear = NPC_R[n.lead.kind] + NPC_R[n.kind] + FOLLOW_GAP;
    if (d < clear) {
      const ux = d > 1e-6 ? dx / d : -Math.cos(now.h), uy = d > 1e-6 ? dy / d : -Math.sin(now.h);
      return { x: now.x + ux * clear, y: now.y + uy * clear, h: p.h };
    }
    return { x: at.x, y: at.y, h: p.h };
  }
  const perMin = (n.r * Math.PI * 2) / 720; // feet per clock minute at this radius
  let min: number, dir: number;
  if (n.path === "loop") {
    min = n.phase + (t * n.speed) / perMin;
    dir = Math.sign(n.speed) || 1;
  } else {
    const len = (n.to - n.from) * perMin;
    const s = ((n.phase * perMin + t * n.speed) % (2 * len) + 2 * len) % (2 * len);
    const along = s < len ? s : 2 * len - s;
    dir = s < len ? 1 : -1;
    min = n.from + along / perMin;
  }
  const p = polar(min, n.r);
  const a = (min / 720) * Math.PI * 2;
  // clockwise along the circle faces angle a + 90°
  return { x: p.x, y: p.y, h: a + (dir > 0 ? Math.PI / 2 : -Math.PI / 2) };
}

/**
 * The famous art cars (soundcamps.ts kind "mutant"), on fixed routes so a job can find them:
 * slow sweeps across deep playa past the Temple, and loops round the Man inside the city, on
 * radii that miss the art. More cars than routes share a route from its other end.
 */
type Route = { path: "arc"; r: number; from: number; to: number } | { path: "loop"; r: number };
const ROUTES: readonly Route[] = ([
  { path: "arc", r: 5000, from: -90, to: 90 }, { path: "loop", r: 1600 }, { path: "arc", r: 4600, from: -70, to: 70 }, { path: "loop", r: 1000 },
  { path: "arc", r: 5400, from: -95, to: 95 }, { path: "loop", r: 1810 }, { path: "arc", r: 3450, from: -80, to: 80 }, { path: "loop", r: 700 },
  { path: "arc", r: 4800, from: -85, to: 85 }, { path: "loop", r: 2320 }, { path: "arc", r: 5200, from: -60, to: 60 }, { path: "loop", r: 1315 },
  { path: "arc", r: 4450, from: -75, to: 75 }, { path: "loop", r: 480 },
] as Route[]).map((r) => ({ ...r, r: r.r * CITY_SCALE }));
export const MUTANTS: readonly Npc[] = SOUND_CAMPS.filter((c) => c.kind === "mutant").map((c, i): Npc => {
  const route = ROUTES[i % ROUTES.length], lap = Math.floor(i / ROUTES.length);
  const speed = (i % 3 === 2 ? -1 : 1) * (9 + (i % 5) * 1.2);
  const base = { kind: "mutant" as const, key: `mutant:${c.id}`, name: c.name, speed, hue: hueOf(c.id) };
  if (route.path === "loop") return { ...base, ...route, phase: (i * 97 + lap * 360) % 720 };
  return { ...base, ...route, phase: (i * 37 + lap * (route.to - route.from)) % (route.to - route.from) };
});
export const mutantOf = (key: string) => MUTANTS.find((m) => m.key === key);

export function makeNpcs(rand: () => number): Npc[] {
  const out: Npc[] = [];
  // a busy city: forty bikes on the arcs, sixteen art cars circling the Man, three cruising streets, and the famous art cars
  for (let i = 0; i < 40; i++) {
    const ring = 1 + Math.floor(rand() * (ARC_R.length - 1));
    out.push({ kind: "bike", path: "arc", r: ARC_R[ring] + (rand() - 0.5) * 16, from: 120, to: 600, speed: 18 + rand() * 14, phase: rand() * 480, hue: Math.floor(rand() * 360) });
  }
  out.push({ kind: "bike", path: "arc", r: ARC_R[0] - 6, from: 120, to: 600, speed: 22, phase: 100, hue: 50 });
  // no plain art cars (asked 2026-10-22): every art car on the playa is one with music (MUTANTS)
  out.push(...MUTANTS);
  // more people (asked 2026-10-22): another forty bikes, walkers along the edges of the streets,
  // and packs of bikers riding behind each famous art car and some of the others
  for (let i = 0; i < 40; i++) {
    const ring = Math.floor(rand() * ARC_R.length);
    out.push({ kind: "bike", path: "arc", r: ARC_R[ring] + (rand() - 0.5) * arcWidth(ring) * 0.6, from: 120, to: 600, speed: (rand() < 0.5 ? -1 : 1) * (16 + rand() * 16), phase: rand() * 480, hue: Math.floor(rand() * 360) });
  }
  for (let i = 0; i < 70; i++) {
    const ring = Math.floor(rand() * ARC_R.length), edge = rand() < 0.5 ? -1 : 1;
    out.push({ kind: "walker", path: "arc", r: ARC_R[ring] + edge * (arcWidth(ring) / 2 - 8), from: 120, to: 600, speed: (rand() < 0.5 ? -1 : 1) * (3 + rand() * 4), phase: rand() * 480, hue: Math.floor(rand() * 360) });
  }
  // a lot more (asked 2026-10-22): another 160 bikes on the streets, 60 crossing the open playa
  // round the Man, more walkers on the street edges and people strolling out to the Man
  for (let i = 0; i < 160; i++) {
    const ring = Math.floor(rand() * ARC_R.length);
    out.push({ kind: "bike", path: "arc", r: ARC_R[ring] + (rand() - 0.5) * arcWidth(ring) * 0.7, from: 120, to: 600, speed: (rand() < 0.5 ? -1 : 1) * (14 + rand() * 18), phase: rand() * 480, hue: Math.floor(rand() * 360) });
  }
  for (let i = 0; i < 60; i++) {
    out.push({ kind: "bike", path: "loop", r: (250 + rand() * 1600) * CITY_SCALE, speed: (rand() < 0.5 ? -1 : 1) * (16 + rand() * 16), phase: rand() * 720, hue: Math.floor(rand() * 360) });
  }
  for (let i = 0; i < 50; i++) {
    const ring = Math.floor(rand() * ARC_R.length), edge = rand() < 0.5 ? -1 : 1;
    out.push({ kind: "walker", path: "arc", r: ARC_R[ring] + edge * (arcWidth(ring) / 2 - 8), from: 120, to: 600, speed: (rand() < 0.5 ? -1 : 1) * (3 + rand() * 4), phase: rand() * 480, hue: Math.floor(rand() * 360) });
  }
  for (let i = 0; i < 24; i++) {
    out.push({ kind: "walker", path: "loop", r: (140 + rand() * 260) * CITY_SCALE, speed: (rand() < 0.5 ? -1 : 1) * (3 + rand() * 3), phase: rand() * 720, hue: Math.floor(rand() * 360) });
  }
  // and more again (asked 2026-10-22): 150 more bikes roaming the streets and the open playa
  for (let i = 0; i < 100; i++) {
    const ring = Math.floor(rand() * ARC_R.length);
    out.push({ kind: "bike", path: "arc", r: ARC_R[ring] + (rand() - 0.5) * arcWidth(ring) * 0.7, from: 120, to: 600, speed: (rand() < 0.5 ? -1 : 1) * (14 + rand() * 18), phase: rand() * 480, hue: Math.floor(rand() * 360) });
  }
  for (let i = 0; i < 50; i++) {
    out.push({ kind: "bike", path: "loop", r: (250 + rand() * 1700) * CITY_SCALE, speed: (rand() < 0.5 ? -1 : 1) * (16 + rand() * 16), phase: rand() * 720, hue: Math.floor(rand() * 360) });
  }
  // e-bikes (asked 2026-10-22): forty of them, half again as fast as the cruisers, on the streets and the open playa
  for (let i = 0; i < 28; i++) {
    const ring = Math.floor(rand() * ARC_R.length);
    out.push({ kind: "ebike", path: "arc", r: ARC_R[ring] + (rand() - 0.5) * arcWidth(ring) * 0.7, from: 120, to: 600, speed: (rand() < 0.5 ? -1 : 1) * (28 + rand() * 20), phase: rand() * 480, hue: 200 + Math.floor(rand() * 60) });
  }
  for (let i = 0; i < 12; i++) {
    out.push({ kind: "ebike", path: "loop", r: (300 + rand() * 1700) * CITY_SCALE, speed: (rand() < 0.5 ? -1 : 1) * (30 + rand() * 20), phase: rand() * 720, hue: 200 + Math.floor(rand() * 60) });
  }
  // more people again (asked 2026-10-23): 120 more bikes and 100 more walkers on the streets, 40 bikes and
  // 40 walkers out on the open playa
  for (let i = 0; i < 120; i++) {
    const ring = Math.floor(rand() * ARC_R.length);
    out.push({ kind: "bike", path: "arc", r: ARC_R[ring] + (rand() - 0.5) * arcWidth(ring) * 0.7, from: 120, to: 600, speed: (rand() < 0.5 ? -1 : 1) * (14 + rand() * 18), phase: rand() * 480, hue: Math.floor(rand() * 360) });
  }
  for (let i = 0; i < 100; i++) {
    const ring = Math.floor(rand() * ARC_R.length), edge = rand() < 0.5 ? -1 : 1;
    out.push({ kind: "walker", path: "arc", r: ARC_R[ring] + edge * (arcWidth(ring) / 2 - 6 - rand() * 6), from: 120, to: 600, speed: (rand() < 0.5 ? -1 : 1) * (3 + rand() * 4), phase: rand() * 480, hue: Math.floor(rand() * 360) });
  }
  for (let i = 0; i < 40; i++) {
    out.push({ kind: "bike", path: "loop", r: (250 + rand() * 1800) * CITY_SCALE, speed: (rand() < 0.5 ? -1 : 1) * (16 + rand() * 16), phase: rand() * 720, hue: Math.floor(rand() * 360) });
  }
  for (let i = 0; i < 40; i++) {
    out.push({ kind: "walker", path: "loop", r: (140 + rand() * 1500) * CITY_SCALE, speed: (rand() < 0.5 ? -1 : 1) * (3 + rand() * 3), phase: rand() * 720, hue: Math.floor(rand() * 360) });
  }
  // a few ambulances on their rounds (asked 2026-10-22): no music, not art cars, never on the maps
  for (let i = 0; i < 4; i++) {
    out.push({ kind: "ambulance", path: "loop", r: (400 + i * 380) * CITY_SCALE, speed: (i % 2 ? -1 : 1) * 12, phase: i * 170, hue: 0, name: "an ambulance" });
  }
  // a crowd of bikes with every art car: eight to twelve behind each
  const packs = [...MUTANTS, ...out.filter((n) => n.kind === "artcar")];
  for (const lead of packs) {
    const k = lead.kind === "mutant" ? 8 + Math.floor(rand() * 5) : 4 + Math.floor(rand() * 3);
    for (let j = 0; j < k; j++) {
      out.push({ kind: "bike", path: "loop", r: lead.r, speed: lead.speed, phase: 0, hue: Math.floor(rand() * 360), lead, lag: 1.2 + j * 0.55 + rand() * 0.5, side: (rand() - 0.5) * 90 });
    }
  }
  return out;
}

/* ── jobs on the pager ──────────────────────────────────────────────────── */

export type Place = { label: string; at: Vec };
/**
 * A place by key: "agave", "center", "temple", "man", "camp:<id>" (its parking bay),
 * "mutant:<id>" (where that art car is at time t), "art:<name>" (in front of the piece), or
 * an address like "4:30 & C".
 */
export function place(key: string, t = 0): Place {
  if (key === "agave") return { label: `Agave Lounge (${clockLabel(AGAVE.min)} & ${AGAVE.arc})`, at: AGAVE.mid };
  if (key === "center") return { label: "Center Camp", at: polar(360, ARC_R[0] - 40) };
  if (key === "temple") return { label: "the Temple", at: polar(0, TEMPLE_DIST + TEMPLE_R + 70) };
  if (key === "man") return { label: "the Man", at: polar(360, MAN_R + 90) };
  if (key.startsWith("camp:")) {
    const s = spotOf(key);
    if (!s) throw new Error(`no such camp: ${key}`);
    return { label: s.camp?.address ? `${s.name} (${s.camp.address})` : s.name, at: s.mid };
  }
  if (key.startsWith("mutant:")) {
    const m = mutantOf(key);
    if (!m) throw new Error(`no such art car: ${key}`);
    const p = npcAt(m, t);
    return { label: m.name!, at: { x: p.x, y: p.y } };
  }
  if (key.startsWith("art:")) {
    const a = ART.find((x) => x.name === key.slice(4));
    if (!a) throw new Error(`no such art: ${key}`);
    const d = Math.hypot(a.x, a.y) || 1, k = (d - a.r - 50) / d; // on the side toward the Man
    return { label: a.name, at: { x: a.x * k, y: a.y * k } };
  }
  const [clock, arc] = key.split("&").map((s) => s.trim());
  return { label: key, at: pointAt(clock, arc) };
}
export const placeKeys = (j: Job) => (j.kind === "moop" ? [j.to] : [j.from, j.to]);

/**
 * A job: a ride (pick up `who` at `from`, drop them at `to`), a MOOP sweep (collect `need`
 * pieces, then get to `to`), or a follow (find the art car `from` and stay with it `need` s).
 */
export type Job = { kind: "ride" | "moop" | "follow"; from: string; to: string; who: string; line: string; need?: number };
const ride = (from: string, to: string, who: string, line: string): Job => ({ kind: "ride", from, to, who, line });
export const JOBS: readonly Job[] = [
  ride("4:30 & C", "agave", "a burner", "pick up a burner at 4:30 & C and bring them to Agave Lounge for a mezcal"),
  ride("camp:distrikt", "agave", "a burner", "pick up a burner at DISTRIKT and bring them to Agave Lounge"),
  ride("agave", "mutant:robot-heart", "two burners", "take two burners from Agave to the sunrise set at Robot Heart before it moves on"),
  ride("center", "camp:pink-mammoth", "a bag of ice", "deliver ice from Center Camp to Pink Mammoth"),
  ride("temple", "7:30 & G", "a lost burner", "a lost burner at the Temple needs a ride home to 7:30 & G"),
  { kind: "moop", from: "", to: "art:Space Whale", who: "MOOP", need: 5, line: "collect 5 MOOP on the way to the Space Whale" },
  { kind: "follow", from: "mutant:mayan-warrior", to: "mutant:mayan-warrior", who: "Mayan Warrior", need: 20, line: "find Mayan Warrior on the open playa and follow it for 20 s" },
  ride("2:00 & B", "agave", "a DJ", "a DJ at 2:00 & B is late for their set at Agave Lounge"),
  ride("camp:disorient", "mutant:titanics-end", "a dancer", "a dancer at Disorient wants to catch Titanic's End out on deep playa"),
  ride("10:00 & L", "man", "a dusty walker", "a dusty walker at 10:00 & L wants a ride to the Man"),
  ride("agave", "camp:daft-punk-fence", "two dancers", "drive two dancers from Agave out to the Daft Punk sets at the trash fence"),
  ride("camp:the-kazbah", "camp:opulent-temple", "a camper", "a camper at the Kazbah is due on the dancefloor at Opulent Temple"),
  { kind: "follow", from: "mutant:robot-heart", to: "mutant:robot-heart", who: "Robot Heart", need: 20, line: "find Robot Heart on deep playa and follow it for 20 s" },
  ride("6:00 & K", "agave", "two dancers", "pick up two dancers at 6:00 & K: it's sunset at Agave Lounge"),
  { kind: "moop", from: "", to: "art:Penny the Goose", who: "MOOP", need: 5, line: "collect 5 MOOP on the way to Penny the Goose" },
  ride("center", "camp:bubbles-and-bass", "a crate of ice", "carry ice from Center Camp to Bubbles and Bass for the sunrise champagne"),
  ride("camp:playalchemist", "mutant:dancetronauts", "a raver", "a raver at PlayAlchemist wants a lift to Dancetronauts"),
  ride("9:00 & H", "center", "a camper", "a camper at 9:00 & H lost their bike: get them to Center Camp for coffee"),
];

export const STOP_R = 75;
export const STOP_SPEED = 45;
/** How close counts as following an art car. */
export const FOLLOW_R = 240;
export type MissionPhase = "brief" | "pickup" | "dropoff" | "follow" | "done" | "failed";
export type Mission = {
  job: number; phase: MissionPhase; timeLeft: number; wait: number; gifts: number; delivered: number; failed: number;
  /** the MOOP count when a sweep began, how far a sweep or follow has got, and the pager's own random state */
  moop0: number; progress: number; rng: number;
};
export const newMission = (seed = 1): Mission => ({ job: 0, phase: "brief", timeLeft: 0, wait: 3, gifts: 0, delivered: 0, failed: 0, moop0: 0, progress: 0, rng: seed >>> 0 || 1 });
/** The next job: any but the one just done. */
export function nextJob(m: Mission): number {
  m.rng = (Math.imul(m.rng, 1664525) + 1013904223) >>> 0;
  const k = Math.floor((m.rng / 4294967296) * (JOBS.length - 1));
  return k >= m.job ? k + 1 : k;
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
/** The clock for a job: the straight-line run at a fair average, plus a margin (and time to sweep or follow). */
export function timeFor(from: Vec, job: Job, t = 0): number {
  if (job.kind === "moop") return Math.ceil(dist(from, place(job.to, t).at) / 105 + 70);
  if (job.kind === "follow") return Math.ceil(dist(from, place(job.from, t).at) / 105 + (job.need ?? 20) + 30);
  const a = place(job.from, t).at, b = place(job.to, t).at;
  return Math.ceil((dist(from, a) + dist(a, b)) / 105 + 18);
}

export type MissionEvent = "start" | "picked" | "delivered" | "failed";
/** What the pager needs to know of the world: the time (for the art cars) and the MOOP picked up. */
export type MissionWorld = { t: number; moop: number };
const atStop = (key: string, car: { x: number; y: number; speed: number }, w: MissionWorld) =>
  dist(car, place(key, w.t).at) < STOP_R + (key.startsWith("mutant:") ? NPC_R.mutant + 30 : 0) && car.speed < STOP_SPEED;

/**
 * The pager: a job is briefed, then you drive to the pickup and stop there, then to the drop
 * and stop again, before the clock runs out (a sweep picks up MOOP instead of a person, a
 * follow keeps close to an art car). A delivery gives gifts (more with time to spare); running
 * out fails the job. Either way another job is briefed a few seconds later.
 */
export function stepMission(m: Mission, car: { x: number; y: number; speed: number }, dt: number, w: MissionWorld = { t: 0, moop: 0 }): MissionEvent | null {
  const job = JOBS[m.job % JOBS.length];
  const deliver = (): MissionEvent => {
    m.phase = "done";
    m.gifts += 1 + Math.floor(Math.max(0, m.timeLeft) / 15);
    m.delivered++;
    m.wait = 4;
    return "delivered";
  };
  if (m.phase === "brief") {
    m.wait -= dt;
    if (m.wait > 0) return null;
    m.phase = "pickup";
    m.timeLeft = timeFor(car, job, w.t);
    m.moop0 = w.moop; m.progress = 0;
    return "start";
  }
  if (m.phase === "pickup" || m.phase === "dropoff" || m.phase === "follow") {
    m.timeLeft -= dt;
    if (job.kind === "moop") {
      m.progress = w.moop - m.moop0;
      if (m.phase === "pickup" && m.progress >= (job.need ?? 5)) { m.phase = "dropoff"; m.timeLeft += 8; return "picked"; }
      if (m.phase === "dropoff" && atStop(job.to, car, w)) return deliver();
    } else if (job.kind === "follow") {
      const near = dist(car, place(job.from, w.t).at) < FOLLOW_R;
      if (m.phase === "pickup" && near) { m.phase = "follow"; return "picked"; }
      if (m.phase === "follow" && near) { m.progress += dt; if (m.progress >= (job.need ?? 20)) return deliver(); }
    } else if (atStop(m.phase === "pickup" ? job.from : job.to, car, w)) {
      if (m.phase === "pickup") { m.phase = "dropoff"; m.timeLeft += 8; return "picked"; }
      return deliver();
    }
    if (m.timeLeft <= 0) { m.timeLeft = 0; m.phase = "failed"; m.failed++; m.wait = 4; return "failed"; }
    return null;
  }
  m.wait -= dt;
  if (m.wait <= 0) { m.job = nextJob(m); m.phase = "brief"; m.wait = 3; }
  return null;
}

/** Where the pager points: the pickup, the drop or the art car to follow, or nowhere between jobs. */
export function missionTarget(m: Mission, t = 0): Place | null {
  const job = JOBS[m.job % JOBS.length];
  if (m.phase === "pickup") return place(job.kind === "moop" ? job.to : job.from, t);
  if (m.phase === "dropoff" || m.phase === "follow") return place(job.to, t);
  return null;
}

/** The pager's line. */
export function pagerLine(m: Mission): string {
  const job = JOBS[m.job % JOBS.length];
  if (m.phase === "brief") return job.line;
  if (job.kind === "moop") {
    if (m.phase === "pickup") return `collect MOOP: ${Math.max(0, m.progress)} of ${job.need ?? 5}, then on to ${place(job.to).label}`;
    if (m.phase === "dropoff") return `MOOP bagged: now get to ${place(job.to).label}`;
    if (m.phase === "done") return "the playa thanks you. leave no trace";
    return "too slow: the MOOP blew away";
  }
  if (job.kind === "follow") {
    if (m.phase === "pickup") return `find ${job.who} on the open playa`;
    if (m.phase === "follow") return `stay with ${job.who}: ${Math.floor(m.progress)} of ${job.need ?? 20} s`;
    if (m.phase === "done") return `you rode with ${job.who}. someone gifted you a sticker`;
    return `${job.who} got away in the dust`;
  }
  if (m.phase === "pickup") return `pick up ${job.who} at ${place(job.from).label}. stop there to let them on`;
  if (m.phase === "dropoff") return `${job.who} on board: drop them at ${place(job.to).label}`;
  if (m.phase === "done") return `delivered. ${job.who} gifted you something. radical gifting`;
  return `too slow: ${job.who} caught a ride on a passing bike`;
}

/* ── parking at a camp ──────────────────────────────────────────────────── */

/** Under 1 mph for a second, in a bay (or beside an art car), counts as parked. */
export const PARK_SPEED = 1 / MPH;
export const PARK_STILL = 1;
export const MUTANT_PARK_R = 120;
export const MUTANT_LEAVE_R = 300;
/** `at`: the place key you are parked at; `cand`, `still`: where you are stopping and for how long. */
export type Parking = { at: string | null; cand: string | null; still: number };
export const newParking = (): Parking => ({ at: null, cand: null, still: 0 });

/** The spot or art car a point is parked at, if any: inside a bay, or close beside an art car. */
export function parkingAt(p: Vec, t: number): string | null {
  for (const s of SPOTS) if (inBay(p, s.bay)) return s.key;
  // the nearest art car in reach, not the first in the list (two can stand close)
  let best: string | null = null, bd = MUTANT_PARK_R;
  for (const m of MUTANTS) { const d = dist(p, npcAt(m, t)); if (d < bd) { bd = d; best = m.key!; } }
  return best;
}

/** One step of parking: "park" once stopped in a bay for a second, "leave" on driving off. */
export function stepParking(pk: Parking, car: { x: number; y: number; speed: number }, dt: number, t: number): "park" | "leave" | null {
  if (pk.at) {
    const stay = pk.at.startsWith("mutant:")
      ? dist(car, npcAt(mutantOf(pk.at)!, t)) < MUTANT_LEAVE_R
      : inBay(car, spotOf(pk.at)!.bay, 12);
    if (stay) {
      // still within reach of the art car you parked at, but stopped beside another one (or in a bay): after a
      // second that one is where you are parked (2026-10-24: hopping off one car and stopping at the next kept
      // the first, so "ride" put you back on it)
      const next = car.speed < PARK_SPEED ? parkingAt(car, t) : null;
      if (!next || next === pk.at) { pk.cand = null; pk.still = 0; return null; }
      if (next !== pk.cand) { pk.cand = next; pk.still = 0; }
      pk.still += dt;
      if (pk.still < PARK_STILL) return null;
      pk.at = next; pk.cand = null; pk.still = 0;
      return "park";
    }
    pk.at = null; pk.cand = null; pk.still = 0;
    return "leave";
  }
  const cand = car.speed < PARK_SPEED ? parkingAt(car, t) : null;
  if (!cand) { pk.cand = null; pk.still = 0; return null; }
  if (cand !== pk.cand) { pk.cand = cand; pk.still = 0; }
  pk.still += dt;
  if (pk.still >= PARK_STILL) { pk.at = cand; return "park"; }
  return null;
}

/* ── weather and light ──────────────────────────────────────────────────── */

export type Storm = { phase: "clear" | "rising" | "storm" | "falling"; t: number; hold: number };
export const STORM_RAMP = 3;
/** How thick the dust is, 0 to 1. */
export function stormLevel(s: Storm): number {
  if (s.phase === "rising") return Math.min(1, s.t / STORM_RAMP);
  if (s.phase === "storm") return 1;
  if (s.phase === "falling") return Math.max(0, 1 - s.t / STORM_RAMP);
  return 0;
}
/** Clear for a minute or two, then a whiteout that rises, holds a while and blows over. */
export function stepStorm(s: Storm, dt: number, rand: () => number): "storm" | null {
  s.t += dt;
  if (s.phase === "clear" && s.t >= s.hold) { s.phase = "rising"; s.t = 0; return "storm"; }
  if (s.phase === "rising" && s.t >= STORM_RAMP) { s.phase = "storm"; s.t = 0; s.hold = 7 + rand() * 7; }
  else if (s.phase === "storm" && s.t >= s.hold) { s.phase = "falling"; s.t = 0; }
  else if (s.phase === "falling" && s.t >= STORM_RAMP) { s.phase = "clear"; s.t = 0; s.hold = 70 + rand() * 70; }
  return null;
}

/** One day on the playa, in seconds of play. */
export const DAY_SECONDS = 240;
/** How dark it is at a point in the day (0 = noon sun, 1 = night), with a dusk and a dawn between. */
export function nightLevel(dayT: number): number {
  const f = ((dayT / DAY_SECONDS) % 1 + 1) % 1;
  if (f < 0.4) return 0;
  if (f < 0.5) return (f - 0.4) / 0.1;
  if (f < 0.9) return 1;
  return 1 - (f - 0.9) / 0.1;
}
/** Skip to the other half of the day: noon from the night, night from the day. */
export function flipDay(dayT: number): number {
  const base = Math.floor(dayT / DAY_SECONDS) * DAY_SECONDS;
  return nightLevel(dayT) > 0.5 ? base + DAY_SECONDS + 0.05 * DAY_SECONDS : base + 0.55 * DAY_SECONDS;
}

/* ── the whole game ─────────────────────────────────────────────────────── */

/** A small seeded generator (mulberry32), so a run replays. */
export function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Dust = { x: number; y: number; life: number; size: number };
export type Game = {
  t: number; car: Car; vehicle: VehicleId; mission: Mission; npcs: Npc[]; moop: Vec[]; moopCount: number;
  storm: Storm; dayT: number; dust: Dust[]; bumps: number; hitCool: number; /** the art car you are riding along on (hopOn), or null */ aboard: string | null; /** the big map is open: nothing stops you, so you can get unstuck and go where you point (asked 2026-10-22) */ ghost: boolean; /** seconds pinned against the others, and seconds left slipping through them */ pinned: number; slip: number; warn: number; warnText: string;
  parking: Parking;
  /** feet up: more than 0 and the plane, or you under the canopy, is in the air (asked 2026-10-22) */ alt: number;
  /** you bailed out: under a parachute, drifting down */ chute: boolean;
  /** the plane you bailed out of, flying on without you until it is gone */ plane: (Car & { alt: number; left: number }) | null;
  rand: () => number;
};
export type GameEvent = MissionEvent | "moop" | "bump" | "hit" | "slow" | "storm" | "park" | "leave" | "takeoff" | "landed" | "bail";
export const MOOP_N = 80;
export const MOOP_R = 22;

/** A spot for a piece of MOOP: on a street or the open playa, never inside anything. */
export function moopSpot(rand: () => number): Vec {
  for (let i = 0; i < 50; i++) {
    const p = polar(rand() * 720, (300 + rand() * 5600) * CITY_SCALE);
    const k = surfaceAt(p).kind;
    if ((k === "road" || k === "playa" || k === "plaza") && !solidAt(p)) return p;
  }
  return polar(360, ARC_R[0]);
}

/**
 * The place a URL names (asked 2026-10-23): burningman.chat/dragonlady starts you beside the Dragon Lady. The path is
 * matched to a camp's or art car's id (soundcamps.ts), an art piece's id (ART), or agave / man / temple / center, ignoring
 * case and punctuation ("DragonLady", "dragon-lady", "dragon_lady" all find it), or to the start of one ("titanic" is
 * Titanic's End); null when nothing matches.
 */
export function startKey(path: string): string | null {
  const slug = path.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!slug) return null;
  if (["agave", "agavelounge", "man", "theman", "temple", "thetemple", "center", "centercamp"].includes(slug)) return slug.replace(/^the/, "").replace("lounge", "").replace("camp", "");
  const key = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, "");
  // the whole name first, then the start of one ("titanic" is Titanic's End), then any part of one
  for (const hit of [(k: string) => k === slug, (k: string) => k.startsWith(slug), (k: string) => k.includes(slug)]) {
    const c = SOUND_CAMPS.find((x) => x.kind !== "fence" && x.kind !== "art" && (hit(key(x.id)) || hit(key(x.name))));
    if (c) return `${c.kind === "mutant" ? "mutant" : "camp"}:${c.id}`;
    const a = ART.find((x) => hit(key(x.id)) || hit(key(x.name)));
    if (a) return `art:${a.name}`;
  }
  return null;
}
/** Where and which way to start for a place key: beside an art car (to its right, heading its way), parked in a camp's
 * bay facing along the street, or in front of a piece facing it; Agave Lounge's curb by default. */
function startPose(key: string | null): { at: Vec; h: number } {
  // at Agave Lounge, on the Esplanade beside its bay with the dome in view, facing clockwise along the street
  if (!key || key === "agave") return { at: AGAVE.curb, h: (AGAVE.curbMin / 720) * Math.PI * 2 + Math.PI / 2 };
  if (key.startsWith("mutant:")) { const p = npcAt(mutantOf(key)!, 0), r = right(p.h); return { at: { x: p.x + r.x * 30, y: p.y + r.y * 30 }, h: p.h }; }
  // a camp: parked in its bay, so its music is playing from the start (the panel opens as you stop there)
  if (key.startsWith("camp:")) { const sp = spotOf(key)!; return { at: sp.mid, h: sp.arc ? (sp.curbMin / 720) * Math.PI * 2 + Math.PI / 2 : Math.atan2(sp.stage.y - sp.mid.y, sp.stage.x - sp.mid.x) + Math.PI / 2 }; }
  if (key.startsWith("art:")) { // in the piece's bay if it has one (its panel opens as you stop), else far enough back that the whole piece is on screen ahead
    const a = ART.find((x) => x.name === key.slice(4))!, sp = spotOf(`camp:${a.id}`);
    const d = Math.hypot(a.x, a.y) || 1, k = (d - a.r - 170) / d, at = sp ? sp.mid : { x: a.x * k, y: a.y * k };
    return { at, h: Math.atan2(a.y - at.y, a.x - at.x) + Math.PI / 2 };
  }
  const to = key === "man" ? { x: 0, y: 0 } : key === "temple" ? TEMPLE : CENTER_CAMP, at = place(key).at;
  return { at, h: Math.atan2(to.y - at.y, to.x - at.x) + Math.PI / 2 };
}

export function newGame(seed = 1, vehicle: VehicleId = "bike", at: string | null = null): Game {
  const rand = seeded(seed);
  const start = startPose(at);
  return {
    t: 0, car: newCar(start.at, start.h), vehicle, mission: newMission(seed), npcs: makeNpcs(rand),
    moop: Array.from({ length: MOOP_N }, () => moopSpot(rand)), moopCount: 0,
    storm: { phase: "clear", t: 0, hold: 50 + rand() * 40 }, dayT: 0.1 * DAY_SECONDS, dust: [], bumps: 0, hitCool: 0, aboard: null, ghost: false, pinned: 0, slip: 0, warn: 0, warnText: "",
    parking: newParking(), alt: 0, chute: false, plane: null,
    rand,
  };
}

/* ── the airport and the plane (asked 2026-10-22) ──────────────────────── */
/** Rolling faster than this, the plane lifts; slower than STALL in the air, it is held at STALL. */
export const TAKEOFF = 200, STALL = 150, ALT_MAX = 900;
/** Within reach of the plane on the pad: E takes it. */
export const atAirport = (g: Game) => g.vehicle !== "plane" && !g.chute && Math.hypot(g.car.x - AIRPORT.pad.x, g.car.y - AIRPORT.pad.y) < 160;
/** Into the plane on the pad, lined up on the runway. */
export function takePlane(g: Game): boolean {
  if (!atAirport(g)) return false;
  if (g.aboard) hopOff(g);
  g.vehicle = "plane"; g.alt = 0;
  g.car = newCar(AIRPORT.pad, AIRPORT.h);
  return true;
}
/** Out of the plane: in the air, under a parachute, the plane flying on without you (it disappears off the screen); on the ground, onto the bike beside it. */
export function bailOut(g: Game) {
  if (g.vehicle !== "plane") return;
  if (g.alt > 0) {
    const f = fwd(g.car.h), spd = Math.max(STALL, speedOf(g.car));
    g.plane = { ...g.car, vx: f.x * spd, vy: f.y * spd, alt: g.alt, left: 30 };
    g.chute = true;
    g.car = { ...g.car, vx: g.car.vx * 0.15, vy: g.car.vy * 0.15 };
    g.vehicle = "bike";
  } else {
    const rt = right(g.car.h);
    g.car = { ...g.car, x: g.car.x + rt.x * 40, y: g.car.y + rt.y * 40, vx: 0, vy: 0 };
    g.vehicle = "bike"; g.alt = 0;
    collide(g.car, VEHICLES.bike);
  }
}

/** Change rides where you stand: the new one is pushed clear of anything it would overlap. */
export function setVehicle(g: Game, id: VehicleId) {
  g.vehicle = id;
  collide(g.car, VEHICLES[id]);
}
/** Ride along on the art car you are parked beside (asked 2026-10-22): it goes where it goes, its music with it. */
export function hopOn(g: Game): boolean {
  if (g.parking.at?.startsWith("mutant:") && mutantOf(g.parking.at)) g.aboard = g.parking.at;
  return g.aboard !== null;
}
/** Step off the art car onto the playa beside it, standing still. */
export function hopOff(g: Game) {
  if (!g.aboard) return;
  const rt = right(g.car.h);
  g.car = { ...g.car, x: g.car.x + rt.x * 70, y: g.car.y + rt.y * 70, vx: 0, vy: 0 };
  g.aboard = null;
  setVehicle(g, "bike"); // off a ride, you are on your bike (asked 2026-10-22)
  collide(g.car, VEHICLES.bike);
}
/** The next ride in the list, for the V key. */
/** The rides V steps through: every one but a found art car, which you drive by finding it (PlayaWin's garage). */
export const BASE_RIDES: VehicleId[] = VEHICLE_IDS.filter((id) => id !== "found" && id !== "plane");
export const nextVehicle = (id: VehicleId): VehicleId => BASE_RIDES[(BASE_RIDES.indexOf(id) + 1) % BASE_RIDES.length];

/** One fixed step of the whole game. Mutates the game and returns what happened, for the window's sounds and lines. */
export function stepGame(g: Game, input: Input, dt: number): GameEvent[] {
  const ev: GameEvent[] = [];
  if (!(dt > 0) || !Number.isFinite(dt)) return ev;
  dt = Math.min(dt, 0.05);
  g.t += dt; g.dayT += dt;
  g.hitCool = Math.max(0, g.hitCool - dt);
  g.slip = Math.max(0, (g.slip ?? 0) - dt);
  g.warn = Math.max(0, g.warn - dt);
  const v: Vehicle = VEHICLES[g.vehicle] ?? CAR;

  // riding along on an art car: carried where it goes; any steering hops you off
  if (g.aboard && (input.gas || input.brake || input.left || input.right || stickOn(input) || !mutantOf(g.aboard))) hopOff(g);
  const riding = g.aboard ? mutantOf(g.aboard) ?? null : null;
  if (riding) {
    const p = npcAt(riding, g.t), jump = Math.hypot(p.x - g.car.x, p.y - g.car.y) > 200;
    g.car = { ...g.car, x: p.x, y: p.y, h: p.h, vx: jump ? 0 : (p.x - g.car.x) / dt, vy: jump ? 0 : (p.y - g.car.y) / dt };
  } else if (g.chute) {
    // under the canopy: the keys drift you, the ground comes up at a steady rate, and you land on the bike
    const c = g.car, ax = stickOn(input) ? Math.sin(input.stick!.a) * input.stick!.k : (input.right ? 1 : 0) - (input.left ? 1 : 0), ay = stickOn(input) ? -Math.cos(input.stick!.a) * input.stick!.k : (input.brake ? 1 : 0) - (input.gas ? 1 : 0);
    let vx = c.vx * (1 - 1.4 * dt) + ax * 90 * dt, vy = c.vy * (1 - 1.4 * dt) + ay * 90 * dt;
    const sp = Math.hypot(vx, vy); if (sp > 45) { vx *= 45 / sp; vy *= 45 / sp; }
    g.car = { ...c, x: c.x + vx * dt, y: c.y + vy * dt, vx, vy, h: sp > 5 ? Math.atan2(vx, -vy) : c.h };
    g.alt = Math.max(0, g.alt - 24 * dt);
    if (g.alt === 0) { g.chute = false; g.car = { ...g.car, vx: 0, vy: 0 }; collide(g.car, VEHICLES.bike); ev.push("landed"); }
  } else {
    g.car = carStep(g.car, input, dt, g.vehicle === "plane" && g.alt > 0 ? 40 : gripAt(g.car), v);
    if (g.vehicle === "plane") {
      // the plane: lifts past TAKEOFF, climbs on the gas, sinks off it, dives on the brake, never slower than STALL up there
      const spd = speedOf(g.car), was = g.alt;
      if (g.alt > 0 || spd > TAKEOFF) {
        const pedals = readStick(g.car.h, speedOf(g.car), v.maxSpeed, input), rate = pedals.gas ? 48 : pedals.brake ? -75 : -12;
        g.alt = Math.min(ALT_MAX, Math.max(0, g.alt + rate * dt));
        if (g.alt > 0 && spd < STALL && spd > 1e-6) { g.car.vx *= STALL / spd; g.car.vy *= STALL / spd; }
      }
      if (was === 0 && g.alt > 0) ev.push("takeoff");
      if (was > 0 && g.alt === 0) ev.push("landed");
    }
  }
  // the plane you bailed out of flies on, climbing gently, until it is well off the screen
  if (g.plane) {
    const q = g.plane;
    q.x += q.vx * dt; q.y += q.vy * dt; q.alt = Math.min(ALT_MAX, q.alt + 8 * dt); q.left -= dt;
    if (q.left <= 0) g.plane = null;
  }
  const airborne = g.chute || (g.vehicle === "plane" && g.alt > 0);
  // riding through a block of camps: slow, and the 5 mph line
  if (!riding && !g.ghost && !airborne && v.throughCamps && surfaceAt(g.car).kind === "block" && !SPOTS.some((sp) => inBay(g.car, sp.bay))) {
    const s = speedOf(g.car), cap = v.maxSpeed * CAMP_SPEED;
    if (s > cap) { g.car.vx *= cap / s; g.car.vy *= cap / s; }
    if (s > SPEED_LIMIT_MPH / MPH && g.warn <= 0) { g.warn = 2; g.warnText = "riding through camps: 5 mph"; ev.push("slow"); }
  }
  const impact = riding || g.ghost || airborne ? 0 : collide(g.car, v);
  if (impact > 60) { g.bumps++; ev.push("bump"); }
  const spd = speedOf(g.car);

  // the others: art cars are heavy and bikes don't stop for you; you bounce off them and it costs a gift.
  // Squeezed between two of them (a biker riding beside an art car) or pinned for a moment, you slip
  // through everyone for a second instead of being shoved back and forth on the spot.
  if (driven.key && g.vehicle === "found") noteDriven(g.t, g.car);
  // the art car you drive is you: no bumping into yourself
  const others = riding || g.ghost || airborne ? [] : driven.key ? g.npcs.filter((n) => n.key !== driven.key) : g.npcs;
  const touching = others.filter((n) => { const p = npcAt(n, g.t); return Math.hypot(g.car.x - p.x, g.car.y - p.y) < NPC_R[n.kind] + v.wid / 2 + 5; }).length;
  for (const n of others) {
    const p = npcAt(n, g.t);
    const dx = g.car.x - p.x, dy = g.car.y - p.y, d = Math.hypot(dx, dy), min = NPC_R[n.kind] + v.wid / 2 + 5;
    if (d < min && g.slip <= 0) {
      const push = d > 1e-6 ? { depth: min - d, nx: dx / d, ny: dy / d } : { depth: min, nx: 0, ny: 1 };
      const hit = bounce(g.car, push, v.restitution);
      if (g.hitCool <= 0 && hit > 15) {
        g.hitCool = 1.5;
        g.mission.gifts = Math.max(0, g.mission.gifts - 1);
        g.warn = 3; g.warnText = n.kind === "walker" ? "you bumped someone on foot. 5 mph near people!" : n.kind === "bike" || n.kind === "ebike" ? "you bumped a biker. 5 mph near people!" : `you bumped ${n.name ?? "an art car"}. 5 mph, please`;
        ev.push("hit");
      }
    } else if (d >= min && d < 130 && spd > 45 && g.warn <= 0) {
      g.warn = 2; g.warnText = n.kind === "walker" ? "slow down: people walking. 5 mph" : n.kind === "bike" || n.kind === "ebike" ? "slow down: bikes. 5 mph" : `slow down: ${n.name ?? "art car"}. 5 mph`;
      ev.push("slow");
    }
  }
  g.pinned = touching ? (g.pinned ?? 0) + dt : 0;
  if (g.slip <= 0 && (touching >= 2 || g.pinned > 0.5)) { g.slip = 1.2; g.pinned = 0; }

  // MOOP: drive over it to pick it up, and the playa offers another somewhere else
  for (let i = 0; i < g.moop.length; i++) {
    const m = g.moop[i];
    if (Math.hypot(m.x - g.car.x, m.y - g.car.y) < MOOP_R) { g.moopCount++; g.moop[i] = moopSpot(g.rand); ev.push("moop"); }
  }

  const me = stepMission(g.mission, { x: g.car.x, y: g.car.y, speed: spd }, dt, { t: g.t, moop: g.moopCount });
  if (me) ev.push(me);
  const pe = stepParking(g.parking, { x: g.car.x, y: g.car.y, speed: spd }, dt, g.t);
  if (pe) ev.push(pe);
  if (stepStorm(g.storm, dt, g.rand)) ev.push("storm");

  // dust off the wheels: more when sliding, and the playa throws more than a street
  const { side } = carSpeeds(g.car);
  const loose = gripAt(g.car) < 6;
  const rate = (spd > 50 ? spd / 230 : 0) * (loose ? 1.4 : 0.7) + Math.min(1, Math.abs(side) / 40) * 1.5;
  if (rate > 0 && g.rand() < rate * dt * 30) {
    const back = carPoints(g.car, v);
    const w = back[2 + Math.floor(g.rand() * 2)];
    g.dust.push({ x: w.x + (g.rand() - 0.5) * 6, y: w.y + (g.rand() - 0.5) * 6, life: 1, size: 6 + g.rand() * 8 + Math.abs(side) * 0.15 });
  }
  for (const d of g.dust) { d.life -= dt * 0.9; d.size += dt * 14; }
  if (g.dust.length > 160 || (g.dust.length && g.dust[0].life <= 0)) g.dust = g.dust.filter((d) => d.life > 0).slice(-160);
  return ev;
}
