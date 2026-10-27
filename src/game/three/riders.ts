import * as THREE from "three";
import { aim, joint, skinnedModel, type BoneDef, type Skinned, type SkinPart } from "./skinned";

/**
 * The rider and the bike, and the RV (PLAN-3D.md, "The rider and bike as built"): each ride is one skinned mesh (skinned.ts) under a group the renderer moves and turns,
 * and `animate` moves its bones from what the game says the ride is doing. A cyclist is a hat with goggles, a bandana, sunglasses, a tank top, shorts and boots on a
 * beach cruiser with a real tube frame, swept-back bars, a sprung saddle, cranks, fat torus tyres on rims with eight spokes, a headlight, a bell and an LED strip: 21 bones.
 * Everything is built at real proportions (a 5 ft 11 rider, a 26 inch wheel) times S, the 2.2 that gave the wheel its old 2.4 ft radius, in the ride's own frame (forward -Z,
 * right +X, up +Y, the ground at y = 0). The wheels roll with the ground, the cranks turn with the rear wheel, each leg is a two-bone IK from the hip to its pedal (or, when
 * stopped, the right one to the ground), each arm one from the shoulder to its grip on the bars, and the bike leans into a turn and steers.
 */
export const S = 2.2;
/** What the game says a ride is doing this frame: forward speed in ft/s (negative backing up), turn rate in rad/s (positive clockwise), braking, and the frame's seconds. */
export type Motion = { dt: number; speed: number; yaw: number; brake: boolean };
export type Rig = { group: THREE.Group; animate(m: Motion): void };
export type Cyclist = "bike" | "ebike" | "unicycle" | "tuktuk";

const TYRE = 0x15161d, RIM = 0xc7ccd6, SPOKE = 0x9aa0ad, SKIN = 0xf2c6a0, STRAW = 0xd9b46a, STEEL = 0x6b7080, DARK = 0x2a2d3a, BOOT = 0x4a3426;
const UP = new THREE.Vector3(0, 1, 0), DOWN = new THREE.Vector3(0, -1, 0);
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** How quickly a value follows its target: the share of the way after dt seconds at `rate` a second. */
const follow = (dt: number, rate: number) => 1 - Math.exp(-dt * rate);
/** The wheel's turn in rad/s for a ground speed and a radius: true up to 40 ft/s and then held there (a wheel at the playa's real top speed is a strobe at 60 fps). */
const rolling = (speed: number, r: number) => (40 * Math.tanh(speed / 40)) / r;

/** Shapes in model feet from real-foot coordinates: `p` scales a point by S and moves it `dz` real feet along z (the tuk-tuk's bike is ahead of its trailer). */
function kit(dz = 0) {
  const p = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, (z + dz) * S);
  const tube = (a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 6): THREE.BufferGeometry => {
    const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r * S, r * S, d.length(), seg, 1, true);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
    const m = a.clone().add(b).multiplyScalar(0.5);
    return g.translate(m.x, m.y, m.z);
  };
  const ball = (r: number, c: THREE.Vector3, sx = 1, sy = 1, sz = 1, w = 8, h = 6) => new THREE.SphereGeometry(r * S, w, h).scale(sx, sy, sz).translate(c.x, c.y, c.z);
  const slab = (w: number, h: number, d: number, c: THREE.Vector3) => new THREE.BoxGeometry(w * S, h * S, d * S).translate(c.x, c.y, c.z);
  /** a ring in the YZ plane (a wheel's tyre): axis along X */
  const ringX = (R: number, t: number, c: THREE.Vector3, rs = 8, ts = 24) => new THREE.TorusGeometry(R * S, t * S, rs, ts).rotateY(Math.PI / 2).translate(c.x, c.y, c.z);
  const discX = (r: number, w: number, c: THREE.Vector3, seg = 10) => new THREE.CylinderGeometry(r * S, r * S, w * S, seg).rotateZ(Math.PI / 2).translate(c.x, c.y, c.z);
  const discZ = (r: number, len: number, c: THREE.Vector3, seg = 10) => new THREE.CylinderGeometry(r * S, r * S, len * S, seg).rotateX(Math.PI / 2).translate(c.x, c.y, c.z);
  return { p, tube, ball, slab, ringX, discX, discZ };
}
type Kit = ReturnType<typeof kit>;
const at = (v: THREE.Vector3): [number, number, number] => [v.x, v.y, v.z];

/** A wheel's parts on `bone`: the tyre (`fat` is its tube radius), a rim with a glowing ring (the LED), a hub and eight spokes. */
function wheelParts(k: Kit, bone: string, c: THREE.Vector3, R: number, fat: number, led: number): SkinPart[] {
  const parts: SkinPart[] = [
    { geo: k.ringX(R, fat, c, 8, 24), color: TYRE, bone },
    { geo: k.ringX(R - fat - 0.05, 0.035, c, 4, 24), color: RIM, bone },
    { geo: k.ringX(R - fat - 0.1, 0.03, c, 4, 24), color: led, bone, glow: 1.6 },
    { geo: k.discX(0.12, 0.5, c, 8), color: STEEL, bone },
  ];
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, to = new THREE.Vector3(c.x, c.y + Math.cos(a) * (R - fat - 0.07) * S, c.z + Math.sin(a) * (R - fat - 0.07) * S);
    const from = c.clone(); parts.push({ geo: tubeM(from, to, 0.018 * S), color: SPOKE, bone });
  }
  return parts;
}
/** A thin four-sided rod between two points already in model feet, radius in model feet. */
function tubeM(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), 4, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}

/** The rider's bones for hips at `h` (real feet, relative to the ride's frame): pelvis, chest, head, two arms of two bones, two legs of two bones and a foot each. */
function riderBones(k: Kit, h: [number, number, number], parent: string): BoneDef[] {
  const [x, y, z] = h, P = (dx: number, dy: number) => at(k.p(x + dx, y + dy, z));
  return [
    { name: "hips", parent, at: P(0, 0) }, { name: "chest", parent: "hips", at: P(0, 0) }, { name: "head", parent: "chest", at: P(0, 2.05) },
    { name: "upArmL", parent: "chest", at: P(-0.58, 1.9) }, { name: "upArmR", parent: "chest", at: P(0.58, 1.9) },
    { name: "foreArmL", parent: "upArmL", at: P(-0.58, 1.9 - 1.1) }, { name: "foreArmR", parent: "upArmR", at: P(0.58, 1.9 - 1.1) },
    { name: "thighL", parent: "hips", at: P(-0.28, 0) }, { name: "thighR", parent: "hips", at: P(0.28, 0) },
    { name: "shinL", parent: "thighL", at: P(-0.28, -1.5) }, { name: "shinR", parent: "thighR", at: P(0.28, -1.5) },
    { name: "footL", parent: "shinL", at: P(-0.28, -2.95) }, { name: "footR", parent: "shinR", at: P(0.28, -2.95) },
  ];
}
/** The rider's shapes in the straight rest pose (arms and legs hanging), each on its bone; the IK bends them. */
function riderParts(k: Kit, h: [number, number, number], shirt: number): SkinPart[] {
  const [x, y, z] = h, P = (dx: number, dy: number, dzz = 0) => k.p(x + dx, y + dy, z + dzz), parts: SkinPart[] = [];
  const add = (geo: THREE.BufferGeometry, color: number, bone: string, glow = 0) => parts.push({ geo, color, bone, glow });
  const SHORTS = 0x2f4a78;
  add(k.slab(0.66, 0.4, 0.5, P(0, 0.08)), SHORTS, "hips");
  add(new THREE.CylinderGeometry(0.52 * S, 0.43 * S, 1.75 * S, 8).scale(1, 1, 0.62).translate(P(0, 0.98).x, P(0, 0.98).y, P(0, 0.98).z), shirt, "chest");
  add(k.tube(P(0, 1.85), P(0, 2.12), 0.1, 6), SKIN, "chest");
  // the head: skin, sunglasses, a bandana over the lower face, a straw hat with its goggles pushed up on the crown
  const hd = (dx: number, dy: number, dzz = 0) => P(dx, 2.05 + dy, dzz);
  add(k.ball(0.45, hd(0, 0.45), 0.92, 1.05, 1, 10, 8), SKIN, "head");
  add(k.slab(0.7, 0.15, 0.08, hd(0, 0.52, -0.41)), 0x15161d, "head");
  add(new THREE.CylinderGeometry(0.47 * S, 0.46 * S, 0.24 * S, 10, 1, true).translate(hd(0, 0.2).x, hd(0, 0.2).y, hd(0, 0.2).z), 0xd62828, "head");
  add(new THREE.CylinderGeometry(0.85 * S, 0.85 * S, 0.05 * S, 14).translate(hd(0, 0.86).x, hd(0, 0.86).y, hd(0, 0.86).z), STRAW, "head");
  add(new THREE.CylinderGeometry(0.46 * S, 0.52 * S, 0.34 * S, 10).translate(hd(0, 1.03).x, hd(0, 1.03).y, hd(0, 1.03).z), STRAW, "head");
  add(new THREE.CylinderGeometry(0.53 * S, 0.53 * S, 0.1 * S, 10, 1, true).translate(hd(0, 0.95).x, hd(0, 0.95).y, hd(0, 0.95).z), DARK, "head");
  for (const s of [-1, 1]) add(k.discZ(0.16, 0.06, hd(s * 0.21, 0.96, -0.52), 8), 0x7fe9ff, "head", 0.9);
  // the arms: bare, a hand at the end of each forearm
  for (const [s, n] of [[-1, "L"], [1, "R"]] as const) {
    const sh = (dy: number) => P(s * 0.58, 1.9 + dy);
    add(k.tube(sh(0), sh(-1.1), 0.17, 6), SKIN, `upArm${n}`);
    add(k.ball(0.21, sh(0), 1, 1, 1, 6, 4), SKIN, `upArm${n}`);
    add(k.tube(sh(-1.1), sh(-2.15), 0.145, 6), SKIN, `foreArm${n}`);
    add(k.ball(0.19, sh(-2.15), 1, 1, 1, 6, 4), SKIN, `foreArm${n}`);
  }
  // the legs: shorts to the knee, bare shins, boots
  for (const [s, n] of [[-1, "L"], [1, "R"]] as const) {
    const lg = (dy: number) => P(s * 0.28, dy);
    add(k.tube(lg(0), lg(-0.95), 0.29, 8), SHORTS, `thigh${n}`);
    add(k.tube(lg(-0.95), lg(-1.5), 0.2, 6), SKIN, `thigh${n}`);
    add(k.tube(lg(-1.5), lg(-2.35), 0.18, 6), SKIN, `shin${n}`);
    add(k.tube(lg(-2.35), lg(-2.95), 0.23, 8), BOOT, `shin${n}`);
    // the foot, from the ankle forward (-z): the boot, its sole and its heel
    add(k.slab(0.36, 0.3, 0.95, lg(-2.95 - 0.17).clone().add(new THREE.Vector3(0, 0, -0.3 * S))), BOOT, `foot${n}`);
    add(k.slab(0.38, 0.07, 1.0, lg(-2.95 - 0.33).clone().add(new THREE.Vector3(0, 0, -0.3 * S))), 0x1d1a18, `foot${n}`);
  }
  return parts;
}

export function buildCyclist(kind: Cyclist, material: THREE.Material): Rig {
  const uni = kind === "unicycle", tuk = kind === "tuktuk", ebike = kind === "ebike";
  const dz = tuk ? -2.3 : 0, k = kit(dz), { p } = k;
  const frameColor = kind === "bike" ? 0xff6b9a : ebike ? 0x2f8fd0 : tuk ? 0xf2c14e : 0xff6b9a;
  const shirt = kind === "bike" ? 0xffd27a : ebike ? 0x5bd6c8 : tuk ? 0xff8c42 : 0xff6b9a;
  const led = ebike ? 0x5ee7ff : tuk ? 0xffd23f : 0xff6bd6;
  const defs: BoneDef[] = [{ name: "root", at: [0, 0, 0] }, { name: "frame", parent: "root", at: [0, 0, 0] }];
  const parts: SkinPart[] = [];
  const fat = ebike ? 0.27 : uni ? 0.2 : 0.15;
  let hips: [number, number, number], R: number;
  if (uni) {
    // the unicycle: one big wheel with the cranks fixed to it, a fork and seat post, the rider sitting tall
    R = 1.2; const hub = p(0, R, 0);
    defs.push({ name: "wheelR", parent: "frame", at: at(hub) }, { name: "pedalL", parent: "wheelR", at: at(p(-0.36, R - 0.0, 0.6)) }, { name: "pedalR", parent: "wheelR", at: at(p(0.36, R, -0.6)) });
    parts.push(...wheelParts(k, "wheelR", hub, R, fat, led));
    for (const [s, zz] of [[-1, 0.6], [1, -0.6]] as const) parts.push({ geo: k.tube(p(s * 0.2, R, 0), p(s * 0.34, R, zz), 0.045, 6), color: STEEL, bone: "wheelR" });
    parts.push({ geo: k.tube(p(-0.22, R, 0), p(-0.1, R + 1.25, 0.1), 0.05, 6), color: frameColor, bone: "frame" }, { geo: k.tube(p(0.22, R, 0), p(0.1, R + 1.25, 0.1), 0.05, 6), color: frameColor, bone: "frame" });
    parts.push({ geo: k.tube(p(0, R + 1.2, 0.1), p(0, R + 1.55, 0.14), 0.07, 6), color: frameColor, bone: "frame", glow: 0 });
    parts.push({ geo: k.slab(0.6, 0.14, 1.0, p(0, R + 1.6, 0.18)), color: 0x6b4a2f, bone: "frame" });
    parts.push({ geo: k.tube(p(-0.22, R + 0.5, -0.02), p(0.22, R + 0.5, -0.02), 0.03, 4), color: led, bone: "frame", glow: 2.4 });
    hips = [0, R + 1.85, 0.2];
    for (const [s, n] of [[-1, "L"], [1, "R"]] as const) parts.push({ geo: k.slab(0.42, 0.07, 0.3, p(s * 0.36, R, s * 0.6)), color: DARK, bone: `pedal${n}` });
  } else {
    // the beach cruiser
    const wF = p(0, 1.1, -2.15), wR = p(0, 1.1, 1.95), bb = p(0, 0.95, 0.35), forkAt = p(0, 2.65, -1.62), pedR = p(0.36, 0.95, -0.21), pedL = p(-0.36, 0.95, 0.91);
    R = 1.1;
    defs.push({ name: "fork", parent: "frame", at: at(forkAt) }, { name: "wheelF", parent: "fork", at: at(wF) }, { name: "wheelR", parent: "frame", at: at(wR) }, { name: "crank", parent: "frame", at: at(bb) },
      { name: "pedalR", parent: "crank", at: at(pedR) }, { name: "pedalL", parent: "crank", at: at(pedL) });
    parts.push(...wheelParts(k, "wheelF", wF, R, fat, led), ...wheelParts(k, "wheelR", wR, R, fat, led));
    const fr = (a: THREE.Vector3, b: THREE.Vector3, r = 0.055, bone = "frame", color = frameColor) => parts.push({ geo: k.tube(a, b, r, 6), color, bone });
    const seat = p(0, 2.7, 0.78), head0 = p(0, 2.2, -1.8), head1 = p(0, 3.05, -1.46);
    fr(bb, p(0, 2.75, 0.8)); fr(seat, p(0, 2.95, -1.5)); fr(bb, p(0, 2.35, -1.74), 0.06); fr(head0, head1, 0.09);
    for (const s of [-1, 1]) { fr(p(s * 0.18, 0.95, 0.35), p(s * 0.22, 1.1, 1.95), 0.045); fr(seat, p(s * 0.22, 1.1, 1.95), 0.04); }
    // the fork, stem, swept-back bars and grips, the headlight and the bell
    for (const s of [-1, 1]) parts.push({ geo: k.tube(p(s * 0.2, 2.2, -1.78), p(s * 0.2, 1.1, -2.15), 0.05, 6), color: frameColor, bone: "fork" });
    parts.push({ geo: k.tube(p(-0.2, 2.2, -1.78), p(0.2, 2.2, -1.78), 0.05, 6), color: frameColor, bone: "fork" }, { geo: k.tube(head1, p(0, 3.35, -1.58), 0.06, 6), color: STEEL, bone: "fork" });
    for (const s of [-1, 1]) {
      parts.push({ geo: k.tube(p(0, 3.35, -1.62), p(s * 0.5, 3.42, -1.62), 0.045, 6), color: STEEL, bone: "fork" }, { geo: k.tube(p(s * 0.5, 3.42, -1.62), p(s * 1.0, 3.5, -1.32), 0.045, 6), color: STEEL, bone: "fork" },
        { geo: k.tube(p(s * 1.0, 3.5, -1.32), p(s * 1.2, 3.45, -1.05), 0.045, 6), color: STEEL, bone: "fork" }, { geo: k.tube(p(s * 1.15, 3.45, -1.1), p(s * 1.26, 3.45, -0.72), 0.075, 6), color: 0x222228, bone: "fork" });
    }
    parts.push({ geo: k.discZ(0.17, 0.2, p(0, 2.95, -1.72), 10), color: 0xfff3b0, bone: "fork", glow: 3 }, { geo: k.ball(0.085, p(0.5, 3.5, -1.58), 1, 1, 1, 6, 4), color: 0xe0c050, bone: "fork" });
    // the frame: the sprung saddle, the chain and its ring, the tail light, the LED strip along the top and down tubes
    parts.push({ geo: k.slab(0.7, 0.14, 1.0, p(0, 2.93, 0.9)), color: 0x6b4a2f, bone: "frame" }, { geo: k.tube(p(0, 2.75, 0.8), p(0, 2.9, 0.88), 0.06, 6), color: STEEL, bone: "frame" });
    for (const s of [-1, 1]) parts.push({ geo: k.tube(p(s * 0.17, 2.72, 0.86), p(s * 0.17, 2.9, 0.86), 0.05, 6), color: STEEL, bone: "frame" });
    parts.push({ geo: k.slab(0.3, 0.14, 0.07, p(0, 2.05, 2.12)), color: 0xff2d55, bone: "frame", glow: 1.5 });
    parts.push({ geo: k.tube(p(0.07, 2.66, 0.7), p(0.07, 2.9, -1.45), 0.032, 4), color: led, bone: "frame", glow: 2.4 }, { geo: k.tube(p(0.07, 1.1, 0.25), p(0.07, 2.3, -1.66), 0.032, 4), color: led, bone: "frame", glow: 2.4 });
    parts.push({ geo: k.discX(0.38, 0.04, p(0.22, 0.95, 0.35), 14), color: STEEL, bone: "crank" });
    parts.push({ geo: tubeM(p(0.24, 1.31, 0.35), p(0.24, 1.2, 1.95), 0.012 * S), color: DARK, bone: "frame" }, { geo: tubeM(p(0.24, 0.59, 0.35), p(0.24, 1.0, 1.95), 0.012 * S), color: DARK, bone: "frame" });
    parts.push({ geo: k.tube(p(0.2, 0.95, 0.35), p(0.3, 0.95, -0.21), 0.04, 5), color: STEEL, bone: "crank" }, { geo: k.tube(p(-0.2, 0.95, 0.35), p(-0.3, 0.95, 0.91), 0.04, 5), color: STEEL, bone: "crank" });
    for (const [s, n, pc] of [[1, "R", pedR], [-1, "L", pedL]] as const) parts.push({ geo: k.slab(0.4, 0.06, 0.3, new THREE.Vector3(pc.x + s * 0.02 * S, pc.y, pc.z)), color: DARK, bone: `pedal${n}` });
    if (ebike) {
      parts.push({ geo: k.slab(0.26, 0.3, 1.1, p(0, 1.75, -0.2)), color: 0x1b1f3b, bone: "frame" }, { geo: k.slab(0.04, 0.12, 0.7, p(0.14, 1.78, -0.2)), color: 0x5ee7ff, bone: "frame", glow: 2 });
      parts.push({ geo: k.discX(0.34, 0.34, wR, 12), color: 0x3a3d4a, bone: "wheelR" }, { geo: k.slab(0.2, 0.12, 0.3, p(0, 3.5, -1.55)), color: 0x1b1f3b, bone: "fork" });
    }
    hips = [0, 3.15, 0.8];
    if (tuk) {
      // a little covered trailer behind: a yellow bed on two wheels under a green canopy, hitched to the cruiser's rear axle
      const root = "root", T = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
      defs.push({ name: "wheelTL", parent: root, at: at(T(-3.7, 1.6, 5.5)) }, { name: "wheelTR", parent: root, at: at(T(3.7, 1.6, 5.5)) });
      parts.push({ geo: tubeM(T(0, 2.3, wR.z), T(0, 2.3, 2.2), 0.09), color: STEEL, bone: root });
      parts.push({ geo: new THREE.BoxGeometry(7, 2.2, 7).translate(0, 2.3, 5.5), color: 0xf2c14e, bone: root });
      parts.push({ geo: new THREE.CylinderGeometry(3.6, 3.6, 7, 14, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 3.4, 5.5), color: 0x2f9e5a, bone: root });
      parts.push({ geo: new THREE.BoxGeometry(6.4, 0.5, 1.6).translate(0, 3.6, 7.4), color: 0x7a3b1e, bone: root });
      parts.push({ geo: new THREE.BoxGeometry(1.2, 0.5, 0.3).translate(0, 2.4, 9.05), color: 0xff2d55, bone: root, glow: 1.5 });
      for (const [s, n] of [[-1, "L"], [1, "R"]] as const) {
        const c = T(s * 3.7, 1.6, 5.5);
        parts.push({ geo: new THREE.TorusGeometry(1.6, 0.4, 8, 18).rotateY(Math.PI / 2).translate(c.x, c.y, c.z), color: TYRE, bone: `wheelT${n}` }, { geo: new THREE.CylinderGeometry(0.9, 0.9, 0.5, 10).rotateZ(Math.PI / 2).translate(c.x, c.y, c.z), color: RIM, bone: `wheelT${n}` });
        for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2; parts.push({ geo: new THREE.BoxGeometry(0.55, 0.14, 0.14).translate(s * 0.05, Math.cos(a) * 0.55, Math.sin(a) * 0.55).translate(c.x, c.y, c.z), color: STEEL, bone: `wheelT${n}` }); }
      }
      // the stripes round the canopy's edge glow at night
      parts.push({ geo: new THREE.BoxGeometry(7.1, 0.12, 0.12).translate(0, 3.5, 2.0), color: 0xffd23f, bone: root, glow: 2 });
    }
  }
  defs.push(...riderBones(k, hips, "frame"));
  parts.push(...riderParts(k, hips, shirt));
  const sk = skinnedModel(defs, parts, material), b = sk.bones;
  const group = new THREE.Group(); group.add(sk.mesh); group.visible = false;

  // grips: where the hands go (on the fork, so they turn with the bars)
  const grip: [THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D()];
  if (!uni) {
    b.fork.add(grip[0], grip[1]);
    const f = p(0, 2.65, -1.62), gl = p(-1.2, 3.45, -0.9), gr = p(1.2, 3.45, -0.9);
    grip[0].position.copy(gl).sub(f); grip[1].position.copy(gr).sub(f);
  }
  const steerAxis = new THREE.Vector3(0, 0.928, 0.371);
  const home: Record<string, THREE.Vector3> = { hips: b.hips.position.clone() };
  const st = { theta: 0, phi: -Math.PI / 2, steer: 0, roll: 0, lean: 0.3, plant: 0, brake: 0, sway: 0, t: 0 };
  const hipW = new THREE.Vector3(), anW = new THREE.Vector3(), knee = new THREE.Vector3(), sh = new THREE.Vector3(), el = new THREE.Vector3(), tgt = new THREE.Vector3(), pole = new THREE.Vector3(), q = new THREE.Quaternion(), fq = new THREE.Quaternion(), gq = new THREE.Quaternion();
  const kneePole = (s: number) => pole.set(s * 0.18, 0.1, -1).applyQuaternion(b.frame.getWorldQuaternion(q));
  const lq = new THREE.Quaternion(), hipsAt = new THREE.Vector3();
  const level = (foot: THREE.Bone, world: THREE.Quaternion) => { foot.parent!.getWorldQuaternion(lq); foot.quaternion.copy(lq.invert()).multiply(world); };

  return {
    group,
    animate({ dt, speed, yaw, brake }) {
      dt = Math.min(dt, 0.1); st.t += dt;
      const f = follow(dt, 8), moving = Math.abs(speed) > 3, fast = clamp(Math.abs(speed) / 100, 0, 1);
      st.theta += rolling(speed, R * S) * dt;
      // the cranks turn with the rear wheel (a single speed, 1.9 turns of the wheel to one of the cranks; the unicycle's are fixed to its wheel) and, stopped, settle with the right pedal high
      const rate = uni ? rolling(speed, R * S) : rolling(speed, R * S) / 1.9;
      st.phi = wrap(st.phi + rate * dt);
      st.plant += ((moving ? 0 : 1) - st.plant) * follow(dt, 4);
      if (st.plant > 0.3 && !uni) st.phi = wrap(st.phi + wrap(-Math.PI / 2 - st.phi) * follow(dt, 2.5) * st.plant);
      st.brake += ((brake && speed > 3 ? 1 : 0) - st.brake) * follow(dt, 7);
      // lean into the turn, steer the bars
      const roll = -clamp(0.14 * yaw * clamp(Math.abs(speed) / 80, 0, 1), -0.45, 0.45) - st.plant * (uni ? 0 : 0.05), steer = -clamp((9 * yaw) / Math.max(Math.abs(speed), 12), -0.5, 0.5) * (speed >= 0 ? 1 : -1);
      st.roll += (roll - st.roll) * f; st.steer += (steer - st.steer) * f;
      st.sway = uni ? Math.sin(st.phi * 2) * 0.06 * clamp(Math.abs(speed) / 30, 0, 1) : 0;
      b.frame.rotation.z = st.roll + st.sway;
      if (!uni) b.fork.quaternion.setFromAxisAngle(steerAxis, st.steer);
      b.wheelR.rotation.x = -(uni ? st.phi : st.theta); b.pedalR.rotation.x = st.phi; b.pedalL.rotation.x = st.phi;   // the pedals stay level against the cranks' turn
      if (!uni) { b.wheelF.rotation.x = -st.theta; b.crank.rotation.x = -st.phi; }
      if (tuk) { const w = -st.theta * ((R * S) / 1.6); b.wheelTL.rotation.x = w; b.wheelTR.rotation.x = w; }
      // the rider: leans forward with speed, back with the brakes, sits lower with a foot down
      st.lean = 0.3 + 0.05 * fast - 0.12 * st.brake - (uni ? 0.22 : 0);
      b.chest.rotation.x = -st.lean; b.head.rotation.x = 0.55 * st.lean;
      b.hips.position.copy(home.hips).add(hipsAt.set(0, -0.2 * S * st.plant, 0.05 * S * st.brake));
      group.updateMatrixWorld(true);
      b.frame.getWorldQuaternion(fq); group.getWorldQuaternion(gq);
      // the legs: hip to pedal (the right to the ground when stopped), the boot level with the bike (or the ground)
      for (const [s, n] of [[-1, "L"], [1, "R"]] as const) {
        const pedal = b[`pedal${n}`], thigh = b[`thigh${n}`], shin = b[`shin${n}`], foot = b[`foot${n}`];
        thigh.getWorldPosition(hipW);
        pedal.localToWorld(tgt.set(0, 0.3 * S, 0.1 * S));
        const planted = n === "R" && !uni ? st.plant : 0;
        if (planted > 0) { const ground = group.localToWorld(p(0.62, 0.3, 0.45)); tgt.lerp(ground, planted); }
        anW.copy(tgt);
        joint(hipW, anW, 1.5 * S, 1.45 * S, kneePole(s), knee);
        aim(thigh, DOWN, knee); aim(shin, DOWN, anW);
        level(foot, planted > 0.5 ? gq : fq);
      }
      // the arms: shoulder to grip on the bars, elbows out; the unicycle's rider holds them out for balance
      b.frame.getWorldQuaternion(fq);
      for (const [s, n] of [[-1, "L"], [1, "R"]] as const) {
        const up = b[`upArm${n}`], fore = b[`foreArm${n}`];
        up.getWorldPosition(sh);
        if (uni) { tgt.set(s * 1.7 * S, hips[1] * S + 1.9 * S + Math.sin(st.t * 3 + s) * 0.15 * S * (0.3 + fast), 0.0); group.localToWorld(tgt); } else grip[n === "L" ? 0 : 1].getWorldPosition(tgt);
        joint(sh, tgt, 1.1 * S, 1.05 * S, pole.set(s, -0.55, 0.25).applyQuaternion(fq), el);
        aim(up, DOWN, el); aim(fore, DOWN, tgt);
      }
    },
  };
}

/**
 * The RV (asked 2026-10-27): a camp's 32 by 9 ft Winnebago in white with a brown stripe: a rounded roof, a raked dark windscreen, a band of side windows, the entry door,
 * the air conditioner and two vents on the roof, a rolled awning with the camp's lights along it, a ladder up the back, a bull bar, and four wheels, the rear two of them dual,
 * on bones (the front pair steer). The body is a bone of its own that rolls out of a turn and dips under the brakes; the lights glow at night.
 */
export function buildRv(material: THREE.Material): Rig {
  const defs: BoneDef[] = [
    { name: "root", at: [0, 0, 0] }, { name: "body", parent: "root", at: [0, 1.8, 0] },
    { name: "steerL", parent: "root", at: [-4.45, 1.8, -9.5] }, { name: "steerR", parent: "root", at: [4.45, 1.8, -9.5] },
    { name: "wFL", parent: "steerL", at: [-4.45, 1.8, -9.5] }, { name: "wFR", parent: "steerR", at: [4.45, 1.8, -9.5] },
    { name: "wRL", parent: "root", at: [-4.45, 1.8, 8.5] }, { name: "wRR", parent: "root", at: [4.45, 1.8, 8.5] },
  ];
  const parts: SkinPart[] = [], add = (geo: THREE.BufferGeometry, color: number, bone = "body", glow = 0) => parts.push({ geo, color, bone, glow });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const WHITE = 0xf4f1ea, GLASS = 0x2b3a4a, BROWN = 0x8a5a3b, TAN = 0xc9a37e, GREY = 0xaeb4bf;
  // the coach: a box with a flattened half-cylinder for a roof, the dark underbody, the bumpers
  add(box(8.8, 7.2, 29, 0, 5.5, 0.5), WHITE);
  add(new THREE.CylinderGeometry(4.4, 4.4, 29, 16, 1, false, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.26, 1).translate(0, 9.1, 0.5), WHITE);
  add(box(8.4, 1, 28, 0, 1.5, 0.5), 0x1b1f3b);
  add(box(8.9, 0.5, 0.7, 0, 2.3, -14.5), 0x4b5068); add(box(8.9, 0.5, 0.7, 0, 2.3, 15.4), 0x4b5068);
  // the windscreen (raked back), the grille and headlights, the bull bar
  add(new THREE.BoxGeometry(7.4, 3.2, 0.12).rotateX(0.3).translate(0, 7.4, -14.15), GLASS);
  add(box(7.4, 0.9, 0.2, 0, 4.2, -14.55), 0x4b5068);
  for (const s of [-1, 1]) { add(new THREE.SphereGeometry(0.55, 8, 6).translate(s * 3.3, 3.6, -14.6), 0xfff3b0, "body", 3); add(box(0.5, 0.35, 0.2, s * 3.3, 3.0, 15.35), 0xff2d55, "body", 1.5); }
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.14, 0.14, 2.2, 6).translate(s * 2.2, 2.9, -14.9), 0x4b5068);
  add(new THREE.CylinderGeometry(0.14, 0.14, 4.6, 6).rotateZ(Math.PI / 2).translate(0, 3.9, -14.9), 0x4b5068);
  // the brown stripe round the coach, the window bands, the door
  for (const s of [-1, 1]) {
    add(box(0.06, 0.9, 29, s * 4.42, 4.0, 0.5), BROWN); add(box(0.06, 0.35, 29, s * 4.42, 3.2, 0.5), TAN);
    add(box(0.07, 1.9, 22, s * 4.43, 7.3, 1.5), GLASS);
    for (const z of [-5.5, 0.5, 6.5, 12]) add(box(0.09, 1.9, 0.35, s * 4.43, 7.3, z), WHITE);
    add(box(0.07, 0.3, 22, s * 4.43, 6.2, 1.5), 0xe9e4d6);
  }
  add(box(8.82, 0.9, 0.06, 0, 4.0, -14.52), BROWN); add(box(8.82, 0.9, 0.06, 0, 4.0, 15.02), BROWN);
  add(box(0.1, 5.2, 2.6, 4.45, 5.0, -9.2), 0xe9e4d6); add(box(0.12, 1.8, 1.6, 4.47, 5.9, -9.2), GLASS); add(box(0.14, 0.15, 0.4, 4.5, 4.7, -8.2), 0x8a8f99);
  // the roof: air conditioner, two vents; the rolled awning along the right with the camp's lights under it
  add(box(3.2, 0.9, 4.8, 0, 10.2, 3), GREY); add(new THREE.CylinderGeometry(1.1, 1.1, 0.2, 10).translate(0, 10.7, 3), 0x8a8f99);
  add(box(1.4, 0.35, 2.2, -2.3, 9.9, -4.5), 0xcfd5dd); add(box(1.4, 0.35, 2.2, 2.3, 9.9, -8.5), 0xcfd5dd);
  add(new THREE.CylinderGeometry(0.24, 0.24, 20, 8).rotateX(Math.PI / 2).translate(4.5, 9.3, 3), 0xb9ad8f);
  const lights = [0xff6bd6, 0x37e8ff, 0xffd23f, 0x7dff8a];
  for (let i = 0; i < 12; i++) add(new THREE.SphereGeometry(0.18, 6, 4).translate(4.75, 9.0, -6.2 + i * 1.8), lights[i % 4], "body", 3);
  // the ladder up the back
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.07, 0.07, 8, 5).translate(s * 0.6, 6, 15.25), 0xe9e4d6);
  for (let i = 0; i < 6; i++) add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5).rotateZ(Math.PI / 2).translate(0, 2.8 + i * 1.3, 15.25), 0xe9e4d6);
  // wheels: a dark tyre, a pale hub with lug nuts so the turning shows, and a wheel arch in the coach's side
  const wheel = (bone: string, cx: number, cz: number, twin: boolean) => {
    for (const dx of twin ? [-0.45, 0.45] : [0]) {   // the dual rears: one outside, one inside the other
      const x = cx + dx;
      add(new THREE.CylinderGeometry(1.8, 1.8, 0.85, 16).rotateZ(Math.PI / 2).translate(x, 1.8, cz), TYRE, bone);
      add(new THREE.CylinderGeometry(0.95, 0.95, 0.9, 10).rotateZ(Math.PI / 2).translate(x, 1.8, cz), 0xc7ccd6, bone);
      for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; add(box(0.98, 0.18, 0.18, x, 1.8 + Math.cos(a) * 0.6, cz + Math.sin(a) * 0.6), 0x4b5068, bone); }
    }
    add(new THREE.CylinderGeometry(2.2, 2.2, 0.1, 14).rotateZ(Math.PI / 2).translate(Math.sign(cx) * 4.42, 1.9, cz), 0x1b1f3b);
  };
  wheel("wFL", -4.45, -9.5, false); wheel("wFR", 4.45, -9.5, false); wheel("wRL", -4.45, 8.5, true); wheel("wRR", 4.45, 8.5, true);
  const sk = skinnedModel(defs, parts, material), b = sk.bones;
  const group = new THREE.Group(); group.add(sk.mesh); group.visible = false;
  const st = { theta: 0, roll: 0, pitch: 0, steer: 0 };
  return {
    group,
    animate({ dt, speed, yaw, brake }) {
      dt = Math.min(dt, 0.1);
      const f = follow(dt, 6);
      st.theta += rolling(speed, 1.8) * dt;
      for (const w of [b.wFL, b.wFR, b.wRL, b.wRR]) w.rotation.x = -st.theta;
      st.steer += (-clamp((18 * yaw) / Math.max(Math.abs(speed), 14), -0.45, 0.45) * (speed >= 0 ? 1 : -1) - st.steer) * f;
      b.steerL.rotation.y = st.steer; b.steerR.rotation.y = st.steer;
      st.roll += (clamp(0.035 * yaw * clamp(Math.abs(speed) / 100, 0, 1), -0.07, 0.07) - st.roll) * f;
      st.pitch += (-(brake && speed > 3 ? 0.03 : 0) - st.pitch) * f;
      b.body.rotation.z = st.roll; b.body.rotation.x = st.pitch;
    },
  };
}
