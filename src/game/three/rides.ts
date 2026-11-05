import * as THREE from "three";
import { AIRPORT } from "@/lib/brc";
import { VEHICLES, type Game, type VehicleId } from "@/lib/playa";
import { LAYER } from "@/lib/scene3d";
import { airScale } from "@/lib/chaseCam";
import { right, yawOf } from "@/lib/view3d";
import type { ViewState } from "../view";
import { angelTexture, planeShadowTexture } from "./decals";
import { cuttlefish } from "./cuttlefish";
import { goldenTicket, type Ticket } from "./goldenTicket";
import { mergedParts, registerGround, shade, shaped as P, type Part } from "./materials";
import { onewheelParts } from "./people";
import { buildCyclist, buildRv, type Rig } from "./riders";
import { skinMaterial } from "./skinned";

/**
 * Your ride (PLAN-3D.md 2.6), one small model per vehicle, each one merged mesh or two: in its own frame forward is -Z and right is +X
 * (the drawings' nose is at -y), and the game heading h turns it by rotation.y = -h (view3d.ts). Only the one you are on shows: the bike,
 * the e-bike, the unicycle, the tuk-tuk (a bike with a covered trailer), the Golden Ticket, the cuttlefish, the Agave dome car (a "found" ride with no
 * art car to wear), the plane, you under the chute, you lying down making a dust angel. An art car you drive is cars.ts's. Under it all
 * go a soft shadow, and the dust angels left behind are flat decals.
 */
export type RideMeshes = {
  group: THREE.Group;
  /** one per ride you can be on, shown one at a time */
  models: Record<string, THREE.Group>;
  /** the rides that move their bones (riders.ts: the bikes, the unicycle, the tuk-tuk, the RV), by the same ids, and the last frame's clock and heading */
  rigs: Record<string, Rig>;
  motion: { t: number; h: number; /** the plane: its height last frame, and the pitch and bank it has eased to */ alt: number; pitch: number; bank: number };
  /** a ride's brake light, lit when you brake */
  brakes: THREE.Mesh[];
  /** the plane's propeller, spun with the game clock */
  props: THREE.Mesh[];
  /** the plane you bailed out of, flying on, and the one waiting on the pad */
  plane2: THREE.Group;
  padPlane: THREE.Group;
  /** a plane's shadow: yours, the one you bailed out of, the one on the pad */
  planeShadows: THREE.Mesh[];
  shadow: THREE.Mesh;
  angels: THREE.InstancedMesh;
  /** bailing out (asked 2026-10-31): when the jump started (game seconds), or -1; the chute's parts it moves */
  bail: { t0: number; was: boolean; fall: THREE.Object3D; hang: THREE.Object3D; canopy: THREE.Object3D; swing: THREE.Object3D };
};

const NAVY = 0x1b1f3b, TYRE = 0x15161d, SKIN = 0xf2c6a0, STRAW = 0xd9b46a, PINK = 0xff6b9a;
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ball = (r: number, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h);
const wheel = (r: number, w: number, x: number, y: number, z: number): Part => P(cyl(r, r, w), TYRE, { x, y, z, rz: Math.PI / 2 });
const deg = (d: number) => (d * Math.PI) / 180;

function model(parts: Part[]): THREE.Group { const g = new THREE.Group(); g.add(mergedParts(parts)); g.visible = false; return g; }
const brakeLight = (z: number, y: number, w = 1.6, x = 0): THREE.Mesh => { const m = new THREE.Mesh(box(w, 0.9, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2d55 })); m.position.set(x, y, z); m.visible = false; return m; };

export function buildRides(scene: THREE.Scene): RideMeshes {
  const group = new THREE.Group(), models: Record<string, THREE.Group> = {}, rigs: Record<string, Rig> = {}, brakes: THREE.Mesh[] = [], props: THREE.Mesh[] = [];
  const add = (id: string, g: THREE.Group) => { models[id] = g; group.add(g); };
  const withBrake = (g: THREE.Group, z: number, y: number) => { const b = brakeLight(z, y); g.add(b); brakes.push(b); return g; };

  // the cyclists and the RV are skinned models that move their bones (riders.ts); the brake light is a lamp of its own behind each, lit when you brake
  const skin = skinMaterial();
  const rig = (id: string, r: Rig, brakeAt: [number, number, number?, number?][]) => { rigs[id] = r; add(id, r.group); for (const [z, y, w, x] of brakeAt) { const b = brakeLight(z, y, w, x); r.group.add(b); brakes.push(b); } };
  rig("bike", buildCyclist("bike", skin), [[5.6, 4.6]]);
  rig("ebike", buildCyclist("ebike", skin), [[5.6, 4.6]]);
  rig("unicycle", buildCyclist("unicycle", skin), []);
  rig("tuktuk", buildCyclist("tuktuk", skin), [[9.4, 2.9, 3]]);
  // the Onewheel (asked 2026-11-04): the board, its wheel and you standing on it sideways, in your pink shirt (people.ts onewheelParts)
  add("onewheel", model(onewheelParts(PINK)));
  rig("rv", buildRv(skin), [[15.6, 3.4, 1.4, -3.3], [15.6, 3.4, 1.4, 3.3]]);
  // the Golden Ticket: the gold cart with its speaker pods, its sign and its drawing on top (goldenTicket.ts)
  { const g = goldenTicket().group; g.visible = false; add("artcar", withBrake(g, 10.4, 3)); }
  // the cuttlefish: its mantle and rippling fin, big W-pupilled eyes, arms gathered in front, colour rolling over its skin (cuttlefish.ts)
  { const g = cuttlefish().group; g.visible = false; add("fish", g); }
  // the Agave dome car (a "found" ride with no art car): a pink deck with a white dome
  add("found", model([P(box(20, 4, 36), PINK, { y: 3 }), P(box(14, 1, 3), NAVY, { y: 5.5, z: -15 }), P(cyl(0.8, 0.8, 4), NAVY, { y: 3, z: -11, rz: Math.PI / 2, sx: 1 }), P(new THREE.SphereGeometry(8, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xf4efe6, { y: 5, z: 2 }), ...[-1, 1].flatMap((s) => [-12, 12].map((z): Part => P(cyl(3.4, 3.4, 3), TYRE, { x: s * 10, y: 3.4, z, rz: Math.PI / 2 })))]));
  // the plane: a white fuselage with a red stripe, a high wing, a tailplane and fin, a prop that spins
  const planeParts = (): Part[] => [
    P(cyl(1.4, 2.2, 30), 0xf4f4f6, { y: 6, rx: Math.PI / 2 }), P(box(2.4, 1, 6), 0x26304a, { y: 8.2, z: -5 }), P(box(34, 0.6, 6), 0xf4f4f6, { y: 9, z: -3 }),
    P(box(4, 0.7, 6), 0xd62828, { y: 9.05, z: -3, x: -15 }), P(box(4, 0.7, 6), 0xd62828, { y: 9.05, z: -3, x: 15 }), P(box(13, 0.5, 3), 0xf4f4f6, { y: 6.5, z: 13 }), P(box(0.6, 6, 5), 0xd62828, { y: 9, z: 12.5 }),
    P(cyl(0.2, 0.2, 7), 0x8a90a8, { y: 3.6, z: -3, x: -4 }), P(cyl(0.2, 0.2, 7), 0x8a90a8, { y: 3.6, z: -3, x: 4 }),
    ...[-1, 1].map((s): Part => P(cyl(1.4, 1.4, 0.8), TYRE, { x: s * 4, y: 1.4, z: -3, rz: Math.PI / 2 })), P(cyl(1, 1, 0.8), TYRE, { y: 1, z: 13, rz: Math.PI / 2 }),
  ];
  const makePlane = (): THREE.Group => {
    const g = model(planeParts());
    const prop = new THREE.Mesh(box(10, 0.5, 0.4), new THREE.MeshBasicMaterial({ color: 0x3c4050, transparent: true, opacity: 0.7 })); prop.position.set(0, 6, -15.4); g.add(prop); props.push(prop);
    return g;
  };
  add("plane", makePlane());
  const plane2 = makePlane(), padPlane = makePlane(); group.add(plane2, padPlane);
  const planeShadowMat = () => new THREE.MeshBasicMaterial({ map: planeShadowTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.decal });
  const planeShadows = [0, 1, 2].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), planeShadowMat()); m.position.y = 0.4; m.renderOrder = LAYER.decal; m.visible = false; group.add(m); return m; });
  // you under the chute (made more real 2026-11-04, asked): a ram-air canopy, seven cells in an arc, in stripes, on lines down to your harness, and you
  // hanging in it in a jumpsuit and helmet, hands up on the steering toggles, legs dangling. The canopy and you swing from the canopy's middle (`swing`,
  // 22 ft up). Falling before it opens, another of you is in the freefall arch: face down, back arched, arms out bent up at the elbows, knees bent, the
  // rig on your back (bailing out, below)
  const SUIT = PINK, HELMET = 0xfbf7ef, RIG = NAVY, BOOT = 0x2a211c, GOGGLE = 0x22324a;
  const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, color: number, seg = 6): Part => {
    const d = b.clone().sub(a), g = new THREE.CapsuleGeometry(r, Math.max(0.01, d.length() - 2 * r), 2, seg);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()));
    const m = a.clone().add(b).multiplyScalar(0.5); return { geo: g.translate(m.x, m.y, m.z), color };
  };
  const cells: Part[] = [], lines: Part[] = [];
  for (let i = 0; i < 7; i++) {
    const th = (i - 3) * 0.17, R = 30, x = Math.sin(th) * R, y = 22 + (Math.cos(th) - 1) * R;
    cells.push(P(box(5.15, 1.5, 10), i === 3 ? 0xffd27a : i % 2 ? PINK : 0xfbf7ef, { x, y, rz: -th, rx: deg(-4) })); // cells side by side, no gaps
    // under each cell's ends a line runs down to the riser on its side, front and back
    for (const z of [-3.6, 3.6]) {
      const a = v3(x - Math.sin(th) * 0.8, y - Math.cos(th) * 0.8, z), b = v3(Math.sign(x || (i - 3.01)) * 0.75, 7.6, 0);
      const d = b.clone().sub(a), g = cyl(0.07, 0.07, d.length(), 3); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
      const m = a.clone().add(b).multiplyScalar(0.5); lines.push({ geo: g.translate(m.x, m.y, m.z), color: 0x4a4f6e });
    }
  }
  const canopy = mergedParts([...cells, ...lines]);
  const hang = mergedParts([
    rod(v3(0, 3.3, 0), v3(0, 5.5, 0), 0.75, SUIT, 8), P(ball(0.78, 10, 8), SKIN, { y: 6.35 }), P(ball(0.86, 10, 6), HELMET, { y: 6.55, sy: 0.9 }), P(box(1.1, 0.32, 0.2), GOGGLE, { y: 6.45, z: -0.7 }),
    P(box(1.5, 1.7, 0.7), RIG, { y: 4.7, z: 0.75 }), P(box(1.6, 0.25, 1.4), RIG, { y: 3.4 }), // the rig on the back, the leg straps
    ...[-1, 1].flatMap((sx) => [
      rod(v3(sx * 0.7, 5.3, 0), v3(sx * 1.15, 6.4, 0.15), 0.26, SUIT), rod(v3(sx * 1.15, 6.4, 0.15), v3(sx * 0.8, 7.5, 0), 0.22, SUIT), P(ball(0.24, 6, 4), 0x3a3f52, { x: sx * 0.8, y: 7.6 }), // arms up on the toggles
      rod(v3(sx * 0.35, 3.2, 0), v3(sx * 0.45, 1.9, -0.6), 0.34, SUIT), rod(v3(sx * 0.45, 1.9, -0.6), v3(sx * 0.4, 0.55, -0.3), 0.28, SUIT), P(box(0.45, 0.4, 0.9), BOOT, { x: sx * 0.4, y: 0.3, z: -0.45 }), // legs dangling
    ]),
  ]);
  // falling: along -Z (head first, as the ride's nose), face down (to -Y), the back arched up
  const fall = mergedParts([
    rod(v3(0, 3, 1.4), v3(0, 3.1, -1.4), 0.78, SUIT, 8), P(ball(0.78, 10, 8), SKIN, { y: 3.25, z: -2.3 }), P(ball(0.86, 10, 6), HELMET, { y: 3.45, z: -2.35, sz: 0.95 }),
    P(box(1.1, 0.3, 0.2), GOGGLE, { y: 2.75, z: -2.6, rx: deg(70) }), P(box(1.5, 0.7, 1.9), RIG, { y: 3.85, z: -0.1 }),
    ...[-1, 1].flatMap((sx) => [
      rod(v3(sx * 0.75, 3.1, -1.2), v3(sx * 2.2, 3.45, -1.6), 0.26, SUIT), rod(v3(sx * 2.2, 3.45, -1.6), v3(sx * 2.15, 3.75, -3.1), 0.22, SUIT), P(ball(0.25, 6, 4), SKIN, { x: sx * 2.15, y: 3.8, z: -3.25 }), // arms out, bent up
      rod(v3(sx * 0.4, 3, 1.3), v3(sx * 1.3, 3.2, 3.1), 0.34, SUIT), rod(v3(sx * 1.3, 3.2, 3.1), v3(sx * 1.55, 4.4, 3.9), 0.28, SUIT), P(box(0.45, 0.9, 0.4), BOOT, { x: sx * 1.6, y: 4.85, z: 4.1 }), // knees bent, feet up
    ]),
  ]);
  const swing = new THREE.Group(), inner = new THREE.Group();
  swing.position.y = 22; inner.position.y = -22; inner.add(canopy, hang); swing.add(inner);
  fall.scale.setScalar(2); // falling free you are a small thing a long way down: drawn twice your size so the arch reads from the camera
  { const g = new THREE.Group(); g.add(swing, fall); fall.visible = false; g.visible = false; add("chute", g); }
  // you lying in the dust making an angel
  add("angelmaker", model([P(box(3, 1, 5), PINK, { y: 0.6 }), P(ball(1.6), SKIN, { y: 0.9, z: -4.2 }), P(box(14, 0.6, 1), SKIN, { y: 0.7, z: -2 }), P(box(1, 0.6, 9), SKIN, { y: 0.7, z: 6, rz: deg(0) }), P(box(8, 0.6, 1), SKIN, { y: 0.7, z: 5.5, rz: 0 })]));

  // a shadow under the ride: a soft dark ellipse on the ground
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: NAVY, transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.decal }));
  shadow.position.y = 0.4; shadow.renderOrder = LAYER.decal; group.add(shadow);
  // the dust angels left in the playa: flat decals, up to 64 of them
  const angels = new THREE.InstancedMesh(new THREE.PlaneGeometry(68, 44).rotateX(-Math.PI / 2), registerGround(new THREE.MeshBasicMaterial({ map: angelTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.decal })), 64);   // a flat drawing in the playa: dimmed and lit as the ground is
  angels.count = 0; angels.frustumCulled = false; angels.renderOrder = LAYER.decal; group.add(angels);
  scene.add(group);
  return { group, models, rigs, motion: { t: 0, h: 0, alt: 0, pitch: 0, bank: 0 }, brakes, props, plane2, padPlane, planeShadows, shadow, angels, bail: { t0: -1, was: false, fall, hang, canopy, swing } };
}

const ID: Partial<Record<VehicleId, string>> = { bike: "bike", ebike: "ebike", unicycle: "unicycle", onewheel: "onewheel", tuktuk: "tuktuk", rv: "rv", artcar: "artcar", fish: "fish", found: "found", plane: "plane" };
const dummy = new THREE.Object3D();

/**
 * `carId`: the art car you are driving, if cars.ts is drawing it (then there is no ride of its own to show); `lift`: how high the roof is
 * of the art car you are riding along on (0 if none), which your ride then stands on, without a shadow of its own.
 */
export function updateRide(r: RideMeshes, g: Game, view: ViewState, carId: string | null, lift = 0): void {
  for (const m of Object.values(r.models)) m.visible = false;
  const which = g.angelT > 0 ? "angelmaker" : g.chute ? "chute" : carId ? null : (ID[g.vehicle] ?? "bike");
  const m = which ? r.models[which] : null;
  const flying = g.vehicle === "plane" || g.chute;
  // up there the plane and the chute are drawn bigger, so they still read from the camera (chaseCam.ts airScale, which frames them by it)
  const grow = flying ? airScale(g.alt) : 1;
  if (m) { m.visible = true; m.position.set(g.car.x, flying ? g.alt : lift, g.car.y); m.rotation.set(0, yawOf(g.car.h), 0, "YXZ"); m.scale.setScalar(grow); }
  // the plane flies as a plane (asked 2026-11-04: "add pitch/yaw to the plane so it's more realistic"): its nose up as it climbs and down as it dives, by the
  // angle of its path, and banked into a turn by how fast it turns, easing into each; level on the ground
  {
    const dt = g.t - r.motion.t, mo = r.motion;
    if (dt > 0 && dt < 0.3) {
      const air = which === "plane" && g.alt > 0, spd = Math.max(1, Math.hypot(g.car.vx, g.car.vy)), dh = Math.atan2(Math.sin(g.car.h - mo.h), Math.cos(g.car.h - mo.h));
      const pitch = air ? Math.max(-0.4, Math.min(0.32, Math.atan2((g.alt - mo.alt) / dt, spd))) : 0, bank = air ? Math.max(-0.7, Math.min(0.7, (dh / dt) * 0.6)) : 0;
      const k = 1 - Math.exp(-dt * 3);
      mo.pitch += (pitch - mo.pitch) * k; mo.bank += (bank - mo.bank) * k;
    }
    mo.alt = g.alt;
    if (m && which === "plane") { m.rotation.x = mo.pitch; m.rotation.z = -mo.bank; }
  }
  if (which === "chute") bailingOut(r, g, m!, grow);
  else r.bail.was = false;
  for (const b of r.brakes) b.visible = view.brake;
  // the skinned rides move their bones: the speed along the heading, the turn rate (clockwise positive) and the brakes, over the game's own seconds
  const dt = g.t - r.motion.t, dh = Math.atan2(Math.sin(g.car.h - r.motion.h), Math.cos(g.car.h - r.motion.h));
  if (which && r.rigs[which] && dt > 0 && dt < 0.3) r.rigs[which].animate({ dt, speed: g.car.vx * Math.sin(g.car.h) - g.car.vy * Math.cos(g.car.h), yaw: dh / dt, brake: view.brake });
  r.motion.t = g.t; r.motion.h = g.car.h;
  for (const p of r.props) p.rotation.z = g.t * 42;
  // the golden ticket's lights and roof drawing redraw as it moves, ten times a second like the other decals
  const art = r.models.artcar, tk = art.userData.ticket as Ticket | undefined;
  if (tk && which === "artcar" && g.t - ((art.userData.last as number | undefined) ?? -1) > 0.1) { tk.paint(g.t, view.night); art.userData.last = g.t; }
  if (which === "fish") (r.models.fish.userData.ticket as Ticket).paint(g.t, view.night);
  // a plane's shadow lies off to one side by its height (the sun is up and to the left, as the 2D has it) and fades as it rises
  const planeShadow = (s: THREE.Mesh, x: number, y: number, h: number, alt: number) => {
    s.visible = true; s.position.set(x + alt * 0.5, 0.4, y + alt * 0.4); s.rotation.y = yawOf(h); s.scale.setScalar(airScale(alt)); (s.material as THREE.MeshBasicMaterial).opacity = shade(1 / (1 + alt / 600));
  };
  // the plane you bailed out of
  r.plane2.visible = !!g.plane;
  r.planeShadows[1].visible = false;
  if (g.plane) { r.plane2.position.set(g.plane.x, g.plane.alt, g.plane.y); r.plane2.rotation.y = yawOf(g.plane.h); r.plane2.scale.setScalar(airScale(g.plane.alt)); planeShadow(r.planeShadows[1], g.plane.x, g.plane.y, g.plane.h, g.plane.alt); }
  // the plane waiting on the pad, whenever you are not in one (the sim keeps it there, E takes it)
  r.padPlane.visible = g.vehicle !== "plane";
  r.planeShadows[2].visible = false;
  if (r.padPlane.visible) { r.padPlane.position.set(AIRPORT.pad.x, 0, AIRPORT.pad.y); r.padPlane.rotation.y = yawOf(AIRPORT.h); planeShadow(r.planeShadows[2], AIRPORT.pad.x, AIRPORT.pad.y, AIRPORT.h, 0); }
  // your own shadow: the plane's, the chute's (an ellipse 28 x 22 ft, no heading) or a soft ellipse under the ride; none aboard an art car or lying in the dust
  const alt = g.chute || g.vehicle === "plane" ? g.alt : 0, plane = g.vehicle === "plane" && !g.chute && g.angelT <= 0;
  r.planeShadows[0].visible = false;
  r.shadow.visible = false;
  if (m && !g.aboard && which !== "angelmaker") {
    if (plane) planeShadow(r.planeShadows[0], g.car.x, g.car.y, g.car.h, alt);
    else {
      const chute = which === "chute", v = VEHICLES[g.vehicle], wid = v.wid, len = v.len;
      r.shadow.visible = true; r.shadow.position.set(g.car.x + alt * 0.5, 0.4, g.car.y + alt * 0.4);
      r.shadow.rotation.y = chute ? 0 : yawOf(g.car.h);
      r.shadow.scale.set(chute ? 14 * grow : Math.max(4, wid * 0.55), 1, chute ? 11 * grow : Math.max(6, len * 0.6));
      (r.shadow.material as THREE.MeshBasicMaterial).opacity = shade((chute ? 0.2 : 0.25) / (1 + alt / 600));
    }
  }
  // the angels (the last 64 left), centred where the sim has them (the drawing's middle is 5 ft south of the spot it was drawn from)
  const n = Math.min(64, g.angels.length), from = g.angels.length - n;
  for (let i = 0; i < n; i++) { const a = g.angels[from + i]; dummy.position.set(a.x, 0.35, a.y + 5); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); r.angels.setMatrixAt(i, dummy.matrix); }
  r.angels.count = n; r.angels.instanceMatrix.needsUpdate = true;
}

const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
/** Seconds into a jump: out of the door head first; and from the canopy opening, swinging under it until it settles. */
const EXIT = 0.45, SETTLE = 3.1;

/**
 * Bailing out, drawn (asked 2026-10-31; the freefall made the sim's own, longer, 2026-11-04): out of the plane's left side head first, you tip flat
 * into the freefall arch with a wobble while the sim has you falling free (g.fallT), then the canopy bursts out of its pack, overshooting, and you swing
 * under it until it settles. Only a jump that has just begun plays (the plane left on its own less than a second ago), so switching to the chase view
 * under a chute already open does not replay it.
 */
function bailingOut(r: RideMeshes, g: Game, m: THREE.Object3D, grow: number): void {
  const b = r.bail as RideMeshes["bail"] & { open?: number };
  if (!b.was) { b.t0 = g.plane && g.plane.left > 29 ? g.t : -1; b.open = (g.fallT ?? 0) > 0 ? undefined : b.t0 < 0 ? -1e9 : g.t; }
  b.was = true;
  const falling = (g.fallT ?? 0) > 0;
  if (!falling && b.open === undefined) b.open = g.t;
  const s = b.t0 < 0 ? 99 : g.t - b.t0, u = falling ? 0 : g.t - (b.open ?? -1e9);
  b.fall.visible = falling; b.hang.visible = !falling; b.canopy.visible = !falling;
  // out of the door: sideways to the left, then back under the sim's point
  const side = 12 * Math.sin(Math.PI * Math.min(1, s / 2.5)) * grow, rt = right(g.car.h);
  m.position.x -= rt.x * side; m.position.z -= rt.y * side;
  // falling: head first out of the door, then flat in the arch, rocking
  const out = 1 - smooth(s / EXIT);
  b.fall.rotation.set(-0.9 * out + 0.07 * Math.sin(s * 9), 0.12 * Math.sin(s * 1.3), 0.14 * Math.sin(s * 6.1) + 0.6 * out);
  // the canopy: from its pack to open, overshooting a little, then the swing under it dying away
  const k = falling ? 0.05 : Math.max(0.05, 1 - Math.exp(-5 * u / 0.8) * Math.cos(9 * u));
  b.canopy.scale.set(k, 0.3 + 0.7 * Math.min(1, k), k);
  b.swing.rotation.x = u >= SETTLE ? 0 : 0.55 * Math.exp(-1.6 * u) * Math.cos(4.2 * u);
}
