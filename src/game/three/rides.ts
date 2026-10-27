import * as THREE from "three";
import { AIRPORT } from "@/lib/brc";
import { VEHICLES, type Game, type VehicleId } from "@/lib/playa";
import { LAYER } from "@/lib/scene3d";
import { yawOf } from "@/lib/view3d";
import type { ViewState } from "../view";
import { angelTexture, planeShadowTexture } from "./decals";
import { goldenTicket, type Ticket } from "./goldenTicket";
import { mergedParts, registerGround, shade, shaped as P, type Part } from "./materials";
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
  motion: { t: number; h: number };
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
  rig("rv", buildRv(skin), [[15.6, 3.4, 1.4, -3.3], [15.6, 3.4, 1.4, 3.3]]);
  // the Golden Ticket: the gold cart with its speaker pods, its sign and its drawing on top (goldenTicket.ts)
  { const g = goldenTicket().group; g.visible = false; add("artcar", withBrake(g, 10.4, 3)); }
  // the cuttlefish: a soft ellipsoid mantle with a fin round it, two eyes, a bunch of arms in front
  add("fish", model([
    P(ball(1, 16, 10), 0x3fb6a8, { sx: 9, sy: 3.5, sz: 15, y: 4.5 }), P(ball(1, 16, 6), 0xf2a65a, { sx: 10.2, sy: 0.7, sz: 16.2, y: 3.9 }),
    P(ball(1.4), 0xfbf7ef, { x: -4, y: 7, z: -10 }), P(ball(1.4), 0xfbf7ef, { x: 4, y: 7, z: -10 }), P(ball(0.7), NAVY, { x: -4, y: 7.4, z: -11.2 }), P(ball(0.7), NAVY, { x: 4, y: 7.4, z: -11.2 }),
    ...[-3, -1, 1, 3].map((x) => P(new THREE.ConeGeometry(0.9, 9, 6), 0x2f9488, { x, y: 4, z: -19, rx: -Math.PI / 2 })),
  ]));
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
  // you under the chute: a striped canopy on lines over the rider hanging at the bottom
  { const slices = Array.from({ length: 8 }, (_, k): Part => P(new THREE.SphereGeometry(14, 3, 8, (k * Math.PI) / 4, Math.PI / 4, 0, Math.PI / 2), k % 2 ? PINK : 0xfbf7ef, { y: 22, sy: 0.9 }));
    const lines = Array.from({ length: 8 }, (_, k): Part => { const a = (k * Math.PI) / 4, x = Math.cos(a) * 13, z = Math.sin(a) * 13, len = Math.hypot(x, z, 20), g = cyl(0.12, 0.12, len, 4); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(-x, -20, -z).normalize())); return { geo: g.translate(x / 2, 22 - 10, z / 2), color: 0x4a4f6e }; });
    add("chute", model([...slices, ...lines, P(new THREE.CapsuleGeometry(1.1, 3, 3, 8), 0xff6b9a, { y: 3.4 }), P(ball(1.2), SKIN, { y: 6.2 }), P(cyl(2.2, 2.2, 0.3), STRAW, { y: 7.1 })])); }
  // you lying in the dust making an angel
  add("angelmaker", model([P(box(3, 1, 5), PINK, { y: 0.6 }), P(ball(1.6), SKIN, { y: 0.9, z: -4.2 }), P(box(14, 0.6, 1), SKIN, { y: 0.7, z: -2 }), P(box(1, 0.6, 9), SKIN, { y: 0.7, z: 6, rz: deg(0) }), P(box(8, 0.6, 1), SKIN, { y: 0.7, z: 5.5, rz: 0 })]));

  // a shadow under the ride: a soft dark ellipse on the ground
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: NAVY, transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.decal }));
  shadow.position.y = 0.4; shadow.renderOrder = LAYER.decal; group.add(shadow);
  // the dust angels left in the playa: flat decals, up to 64 of them
  const angels = new THREE.InstancedMesh(new THREE.PlaneGeometry(68, 44).rotateX(-Math.PI / 2), registerGround(new THREE.MeshBasicMaterial({ map: angelTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.decal })), 64);   // a flat drawing in the playa: dimmed and lit as the ground is
  angels.count = 0; angels.frustumCulled = false; angels.renderOrder = LAYER.decal; group.add(angels);
  scene.add(group);
  return { group, models, rigs, motion: { t: 0, h: 0 }, brakes, props, plane2, padPlane, planeShadows, shadow, angels };
}

const ID: Partial<Record<VehicleId, string>> = { bike: "bike", ebike: "ebike", unicycle: "unicycle", tuktuk: "tuktuk", rv: "rv", artcar: "artcar", fish: "fish", found: "found", plane: "plane" };
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
  if (m) { m.visible = true; m.position.set(g.car.x, flying ? g.alt : lift, g.car.y); m.rotation.y = yawOf(g.car.h); }
  for (const b of r.brakes) b.visible = view.brake;
  // the skinned rides move their bones: the speed along the heading, the turn rate (clockwise positive) and the brakes, over the game's own seconds
  const dt = g.t - r.motion.t, dh = Math.atan2(Math.sin(g.car.h - r.motion.h), Math.cos(g.car.h - r.motion.h));
  if (which && r.rigs[which] && dt > 0 && dt < 0.3) r.rigs[which].animate({ dt, speed: g.car.vx * Math.sin(g.car.h) - g.car.vy * Math.cos(g.car.h), yaw: dh / dt, brake: view.brake });
  r.motion.t = g.t; r.motion.h = g.car.h;
  for (const p of r.props) p.rotation.z = g.t * 42;
  // the golden ticket's lights and roof drawing redraw as it moves, ten times a second like the other decals
  const art = r.models.artcar, tk = art.userData.ticket as Ticket | undefined;
  if (tk && which === "artcar" && g.t - ((art.userData.last as number | undefined) ?? -1) > 0.1) { tk.paint(g.t, view.night); art.userData.last = g.t; }
  // a plane's shadow lies off to one side by its height (the sun is up and to the left, as the 2D has it) and fades as it rises
  const planeShadow = (s: THREE.Mesh, x: number, y: number, h: number, alt: number) => {
    s.visible = true; s.position.set(x + alt * 0.5, 0.4, y + alt * 0.4); s.rotation.y = yawOf(h); (s.material as THREE.MeshBasicMaterial).opacity = shade(1 / (1 + alt / 600));
  };
  // the plane you bailed out of
  r.plane2.visible = !!g.plane;
  r.planeShadows[1].visible = false;
  if (g.plane) { r.plane2.position.set(g.plane.x, g.plane.alt, g.plane.y); r.plane2.rotation.y = yawOf(g.plane.h); planeShadow(r.planeShadows[1], g.plane.x, g.plane.y, g.plane.h, g.plane.alt); }
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
      r.shadow.scale.set(chute ? 14 : Math.max(4, wid * 0.55), 1, chute ? 11 : Math.max(6, len * 0.6));
      (r.shadow.material as THREE.MeshBasicMaterial).opacity = shade((chute ? 0.2 : 0.25) / (1 + alt / 600));
    }
  }
  // the angels (the last 64 left), centred where the sim has them (the drawing's middle is 5 ft south of the spot it was drawn from)
  const n = Math.min(64, g.angels.length), from = g.angels.length - n;
  for (let i = 0; i < n; i++) { const a = g.angels[from + i]; dummy.position.set(a.x, 0.35, a.y + 5); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); r.angels.setMatrixAt(i, dummy.matrix); }
  r.angels.count = n; r.angels.instanceMatrix.needsUpdate = true;
}
