import * as THREE from "three";
import { drivenKey, npcAt, type Game, type Npc } from "@/lib/playa";
import { fadeAt } from "@/lib/scene3d";
import { yawOf } from "@/lib/view3d";
import { glowing } from "./camps";
import { mergedParts, shaped as P, type Part } from "./materials";

/**
 * The people on the road (PLAN-3D.md 3.1): the bikes (and the packs that ride behind the art cars), the fat-tyre e-bikes, the tuk-tuks,
 * the unicycles, the walkers, the ambulances and the RVs leaving in Exodus, each kind one instanced mesh (one with none in view costs no draw call). Every NPC's place comes from `npcAt`, the function the top-down painter calls, so the same
 * biker passes you in both views. Only those within SHOW feet are drawn: each frame the near ones are packed into the first slots of
 * their mesh and `count` is set to how many (a zero-sized instance still costs its vertices, and the triangle count says so). A biker is a
 * cyclist on a cruiser (`bikeGeometry`) whose frame and shirt take their hue (a tuk-tuk's canopy and an RV's stripe too); a walker is all hue; everyone glows a little at night. The art
 * cars (kind "mutant") are cars.ts's.
 */
export type PeopleMeshes = { group: THREE.Group; update(g: Game, cam: THREE.Vector3): void; /** ms the last update took, and how many people it drew */ stats(): { ms: number; shown: number } };
/** People show within SHOW feet of your ride (in three dimensions: from the camera's height), shrinking away over the last fifth of it. */
export const SHOW = 900;

const WHITE = 0xffffff, TYRE = 0x15161d, SKIN = 0xf2c6a0, STRAW = 0xd9b46a, STEEL = 0x8a909c, SHORTS = 0x2f3550, SHOE = 0x2a211c, SADDLE = 0x6b4a2f;
const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const UP = new THREE.Vector3(0, 1, 0);

/** A part that the instance's hue tints (`tint` 1: the frame and the shirt) or keeps its own colour (0: tyres, skin, shorts, the hat). */
type Tinted = Part & { tint: number };
/** Merge parts into one geometry with a `tint` attribute beside the vertex colours (see `tintedGlow`). */
function mergedTinted(parts: Tinted[]): THREE.BufferGeometry {
  for (const p of parts) p.geo.setAttribute("tint", new THREE.BufferAttribute(new Float32Array(p.geo.getAttribute("position").count).fill(p.tint), 1));
  return mergedParts(parts).geometry;
}
/** The people's material: `glowing`'s night glow, with the instance colour applied only as far as a vertex's `tint` says. */
function tintedGlow(): THREE.MeshLambertMaterial {
  const m = glowing({ vertexColors: true }, "glow-people-tint", 0.3), glow = m.onBeforeCompile;
  m.onBeforeCompile = (shader, r) => {
    glow(shader, r);
    shader.vertexShader = "attribute float tint;\n" + shader.vertexShader.replace("#include <color_vertex>", `#include <color_vertex>
#ifdef USE_INSTANCING_COLOR
  vColor.rgb = mix(color.rgb, vColor.rgb, tint);
#endif`);
  };
  return m;
}

/** Shapes in real feet times S (riders.ts: a 5 ft 11 rider on a 26 inch wheel comes out at the old 2.4 ft wheel), forward -Z. */
const S = 2.2;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x * S, y * S, z * S);
/** an open tube of radius r (real feet) between two points already scaled */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 4, r2 = r): THREE.BufferGeometry {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r2 * S, r * S, d.length(), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}
/** Where a two-bone limb from `a` to `c` (bone lengths l1 and l2, real feet) bends: on the side `pole` points to. */
function knee(a: THREE.Vector3, c: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3): THREE.Vector3 {
  const d = c.clone().sub(a), len = Math.min(d.length(), (l1 + l2) * S * 0.999), u = d.clone().normalize();
  const x = (len * len + (l1 * S) ** 2 - (l2 * S) ** 2) / (2 * len), h = Math.sqrt(Math.max(0, (l1 * S) ** 2 - x * x));
  const side = pole.clone().sub(u.clone().multiplyScalar(pole.dot(u))).normalize();
  return a.clone().add(u.multiplyScalar(x)).add(side.multiplyScalar(h));
}

type Add = (geo: THREE.BufferGeometry, color: number, tint?: number) => void;
const adder = (parts: Tinted[]): Add => (geo, color, tint = 0) => { parts.push({ geo, color, tint }); };
/**
 * A rider in a shirt (the hue), dark shorts and a straw hat, sitting at `hips` (real feet), leaning `lean` feet forward at the shoulders,
 * hands at `hands` (left, right) with the elbows bent toward `elbow`, feet at `feet` (left, right) with the knees forward.
 */
function rider(add: Add, hips: THREE.Vector3, lean: number, hands: [THREE.Vector3, THREE.Vector3], elbow: THREE.Vector3, feet: [THREE.Vector3, THREE.Vector3]): void {
  const sh = hips.clone().add(v(0, 1.8, -lean)), hd = hips.clone().add(v(0, 2.35, -lean - 0.07));
  add(box(0.7 * S, 0.45 * S, 0.55 * S).translate(hips.x, hips.y + 0.05 * S, hips.z), SHORTS);
  add(rod(hips, sh, 0.42, 6, 0.52), WHITE, 1);
  add(new THREE.SphereGeometry(0.42 * S, 6, 3).translate(hd.x, hd.y, hd.z), SKIN);
  add(cyl(0.85 * S, 0.85 * S, 0.05 * S, 6).translate(hd.x, hd.y + 0.36 * S, hd.z), STRAW);
  add(cyl(0.44 * S, 0.5 * S, 0.34 * S, 6).translate(hd.x, hd.y + 0.55 * S, hd.z), STRAW);
  for (const [i, s] of [[0, -1], [1, 1]] as const) {
    const shoulder = sh.clone().add(v(s * 0.58, -0.1, 0.05)), el = knee(shoulder, hands[i], 1.1, 1.05, new THREE.Vector3(s * elbow.x, elbow.y, elbow.z));
    add(rod(shoulder, el, 0.16, 3), WHITE, 1); add(rod(el, hands[i], 0.13, 3), SKIN);
    const hip = hips.clone().add(v(s * 0.28, 0, 0)), ankle = feet[i], kn = knee(hip, ankle, 1.5, 1.45, v(0, 0.4, -1));
    add(rod(hip, kn, 0.27, 4, 0.22), SHORTS); add(rod(kn, ankle, 0.17, 3), SKIN);
    add(box(0.32 * S, 0.22 * S, 0.8 * S).translate(ankle.x, ankle.y - 0.1 * S, ankle.z - 0.2 * S), SHOE);
  }
}
const tyre = (add: Add, c: THREE.Vector3, R: number, fat: number) => add(new THREE.TorusGeometry((R - fat / 2) * S, fat * S, 3, 9).rotateY(Math.PI / 2).translate(c.x, c.y, c.z), TYRE);

/** The cruiser and its rider's parts (bikeGeometry), forward -Z. */
function bikeParts(ebike: boolean): Tinted[] {
  const parts: Tinted[] = [], add = adder(parts);
  const R = 1.1, fat = ebike ? 0.32 : 0.14;
  for (const z of [-2.15, 1.95]) tyre(add, v(0, R, z), R, fat);
  // the frame
  const bb = v(0, 0.95, 0.35), seat = v(0, 2.72, 0.8), head0 = v(0, 2.2, -1.8), head1 = v(0, 3.05, -1.46), wR = v(0, R, 1.95), wF = v(0, R, -2.15);
  for (const [a, b, r] of [[bb, seat, 0.07], [seat, v(0, 2.95, -1.5), 0.07], [bb, v(0, 2.35, -1.74), 0.08], [head0, head1, 0.1], [bb, wR, 0.06], [seat, wR, 0.05], [head0, wF, 0.07]] as const) add(rod(a, b, r, 3), WHITE, 1);
  // stem, bars and grips, the saddle
  const stem = v(0, 3.35, -1.58);
  add(rod(head1, stem, 0.06, 3), STEEL);
  for (const s of [-1, 1]) { const bend = v(s * 0.95, 3.48, -1.3); add(rod(stem, bend, 0.05, 3), STEEL); add(rod(bend, v(s * 1.22, 3.45, -0.8), 0.08, 3), TYRE); }
  add(box(0.7 * S, 0.16 * S, 1.0 * S).translate(0, 2.92 * S, 0.9 * S), SADDLE);
  if (ebike) add(box(0.3 * S, 0.34 * S, 1.1 * S).rotateX(-0.6).translate(0, 1.78 * S, -0.7 * S), 0x1b1f3b);
  // the rider: hips on the saddle, sitting up, hands on the grips; the right foot on the forward pedal, up, the left on the back one, down
  const foot = (s: number) => bb.clone().add(v(s * 0.36, s > 0 ? 0.57 : -0.27, s > 0 ? -0.3 : 0.5));
  rider(add, v(0, 3.15, 0.85), 0.4, [v(-1.2, 3.47, -0.85), v(1.2, 3.47, -0.85)], v(1, -0.3, 0.6), [foot(-1), foot(1)]);
  return parts;
}
/**
 * A bike and its rider (riders.ts's cruiser and cyclist, held in one pose), 364 triangles: forward is -Z. Torus tyres, a tube frame
 * with its fork, swept-back bars and a saddle, and a rider sitting up with hands on the grips and feet on the pedals (one up, one down),
 * in a shirt, dark shorts and a straw hat. The frame and the shirt take the rider's hue; the rest keeps its own colour. The fat-tyre
 * e-bike (376) has fat tyres and a battery on the down tube.
 */
export const bikeGeometry = (ebike = false): THREE.BufferGeometry => mergedTinted(bikeParts(ebike));
/** A unicycle (riders.ts's): one tall wheel, the fork up to the saddle, the rider upright with the arms out for balance, about 300 triangles. */
export function unicycleGeometry(): THREE.BufferGeometry {
  const parts: Tinted[] = [], add = adder(parts), R = 1.2, hub = v(0, R, 0);
  tyre(add, hub, R, 0.2);
  for (const s of [-1, 1]) add(rod(v(s * 0.2, R, 0), v(s * 0.1, R + 1.25, 0.1), 0.05, 3), WHITE, 1);
  add(rod(v(0, R + 1.2, 0.1), v(0, R + 1.55, 0.14), 0.07, 3), WHITE, 1);
  add(box(0.6 * S, 0.14 * S, 1.0 * S).translate(0, (R + 1.6) * S, 0.18 * S), SADDLE);
  for (const s of [-1, 1]) add(rod(v(s * 0.2, R, 0), v(s * 0.34, R, s * 0.6), 0.045, 3), STEEL);
  rider(add, v(0, R + 1.85, 0.2), 0, [v(-1.9, R + 3.0, 0.1), v(1.9, R + 3.0, 0.1)], v(0.3, -1, 0.3), [v(-0.36, R + 0.15, -0.6), v(0.36, R + 0.15, 0.6)]);
  return mergedTinted(parts);
}
/**
 * A tuk-tuk (riders.ts's): the cruiser and its rider pulling a little covered trailer, a yellow bed on two wheels under a canopy in the
 * rider's hue, about 520 triangles.
 */
export function tuktukGeometry(): THREE.BufferGeometry {
  const parts = bikeParts(false), add = adder(parts);
  for (const p of parts) p.geo.translate(0, 0, -2.3 * S);
  add(rod(v(0, 1.05, 1.95 - 2.3), new THREE.Vector3(0, 2.3, 2.2), 0.04, 3), STEEL);
  add(new THREE.BoxGeometry(7, 2.2, 7).translate(0, 2.3, 5.5), 0xf2c14e);
  add(new THREE.CylinderGeometry(3.6, 3.6, 7, 6, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).translate(0, 3.4, 5.5), WHITE, 1);
  add(new THREE.BoxGeometry(7.1, 0.12, 0.12).translate(0, 3.5, 2.0), 0xffd23f);
  for (const s of [-1, 1]) add(new THREE.TorusGeometry(1.4, 0.4, 3, 9).rotateY(Math.PI / 2).translate(s * 3.7, 1.6, 5.5), TYRE);
  return mergedTinted(parts);
}
/** An RV (riders.ts's, simplified): a white coach with its curved roof, a stripe down each side in its hue, the window band, the windscreen, the air conditioner and the rolled awning, on four wheels; about 220 triangles. */
export function rvGeometry(): THREE.BufferGeometry {
  const parts: Tinted[] = [], add = adder(parts), CREAM = 0xf4f1ea, GLASS = 0x2b3a4a;
  add(box(8.8, 7.2, 29).translate(0, 5.5, 0.5), CREAM);
  add(new THREE.CylinderGeometry(4.4, 4.4, 29, 6, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.26, 1).translate(0, 9.1, 0.5), CREAM);
  add(box(8.4, 1, 28).translate(0, 1.5, 0.5), 0x1b1f3b);
  add(new THREE.BoxGeometry(7.4, 3.2, 0.12).rotateX(0.3).translate(0, 7.4, -14.15), GLASS);
  add(box(8.9, 0.9, 29.1).translate(0, 4.0, 0.5), WHITE, 1);
  add(box(8.86, 1.9, 22).translate(0, 7.3, 1.5), GLASS);
  add(box(3.2, 0.9, 4.8).translate(0, 10.2, 3), 0xaeb4bf);
  add(cyl(0.3, 0.3, 20, 4).rotateX(Math.PI / 2).translate(4.5, 9.3, 3), 0xb9ad8f);
  for (const s of [-1, 1]) {
    add(box(0.6, 0.6, 0.2).translate(s * 3.3, 3.6, -14.6), 0xfff3b0); add(box(0.6, 0.4, 0.2).translate(s * 3.3, 3.0, 15.35), 0xff2d55);
    for (const z of [-9.5, 8.5]) add(cyl(1.8, 1.8, 0.9, 7).rotateZ(Math.PI / 2).translate(s * 4.45, 1.8, z), TYRE);
  }
  return mergedTinted(parts);
}
/** A walker, about 70 triangles: a body, a head and a hat. */
export function walkerGeometry(): THREE.BufferGeometry {
  return mergedParts([
    P(new THREE.CapsuleGeometry(1.1, 3, 1, 5), WHITE, { y: 3 }), P(new THREE.SphereGeometry(1.1, 5, 3), WHITE, { y: 6.1 }), P(cyl(2, 2, 0.25), WHITE, { y: 7.1 }),
  ]).geometry;
}
/** The walker as the people's mesh draws it: all of it in its hue. */
const walkerTinted = () => mergedTinted([
  { ...P(new THREE.CapsuleGeometry(1.1, 3, 1, 5), WHITE, { y: 3 }), tint: 1 }, { ...P(new THREE.SphereGeometry(1.1, 5, 3), WHITE, { y: 6.1 }), tint: 1 }, { ...P(cyl(2, 2, 0.25), WHITE, { y: 7.1 }), tint: 1 },
]);
/** An ambulance: white box, red stripe, red and blue lights on the roof. */
function ambulanceGeometry(): THREE.BufferGeometry {
  return mergedTinted([
    P(box(14, 9, 28), 0xf4f4f6, { y: 5.5 }), P(box(14.2, 1.2, 28.2), 0xd62828, { y: 5.5 }), P(box(8, 0.8, 1.4), 0xd62828, { y: 10.3, z: -2, x: -2.5 }), P(box(3, 0.8, 1.4), 0x2f6fd8, { y: 10.3, z: -2, x: 3 }),
    ...[-1, 1].flatMap((s) => [-9, 9].map((z): Part => P(cyl(2, 2, 1.4, 8), TYRE, { x: s * 7, y: 2, z, rz: Math.PI / 2 }))),
  ].map((p) => ({ ...p, tint: 0 })));
}

type Kind = "bike" | "ebike" | "tuktuk" | "unicycle" | "walker" | "ambulance" | "rv";
const KINDS: Kind[] = ["bike", "ebike", "tuktuk", "unicycle", "walker", "ambulance", "rv"];

export function buildPeople(scene: THREE.Scene, g: Game): PeopleMeshes {
  const group = new THREE.Group();
  const geo: Record<Kind, THREE.BufferGeometry> = { bike: bikeGeometry(), ebike: bikeGeometry(true), tuktuk: tuktukGeometry(), unicycle: unicycleGeometry(), walker: walkerTinted(), ambulance: ambulanceGeometry(), rv: rvGeometry() };
  const mat = tintedGlow();
  // the NPC list is fixed for a game; the meshes are as big as its kinds are many
  let npcs: readonly Npc[] = g.npcs;
  const index = (list: readonly Npc[]) => list.map((n, i) => ({ n, i, kind: n.kind as string })).filter((x) => (KINDS as string[]).includes(x.kind));
  let items = index(npcs);
  const meshes = {} as Record<Kind, THREE.InstancedMesh>;
  const make = () => {
    for (const k of KINDS) {
      meshes[k]?.removeFromParent(); meshes[k]?.dispose();
      const m = new THREE.InstancedMesh(geo[k], mat, Math.max(1, items.filter((x) => x.kind === k).length));
      m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.setColorAt(0, new THREE.Color(1, 1, 1));
      group.add(m); meshes[k] = m;
    }
  };
  make();
  scene.add(group);

  const d = new THREE.Object3D(), c = new THREE.Color();
  let ms = 0, shown = 0;
  return {
    group,
    stats: () => ({ ms, shown }),
    update(game, cam) {
      const t0 = performance.now();
      if (game.npcs !== npcs) { npcs = game.npcs; items = index(npcs); make(); }
      const mine = drivenKey(), n = { bike: 0, ebike: 0, tuktuk: 0, unicycle: 0, walker: 0, ambulance: 0, rv: 0 };
      shown = 0;
      for (const { n: npc, i, kind } of items) {
        if (npc.key && npc.key === mine) continue;
        const p = npcAt(npc, game.t), dx = p.x - game.car.x, dz = p.y - game.car.y, f = fadeAt(Math.sqrt(dx * dx + dz * dz + cam.y * cam.y), SHOW);
        if (f <= 0) continue;
        const k = kind as Kind, slot = n[k]++, m = meshes[k];
        d.position.set(p.x, k === "walker" ? 0.3 * Math.abs(Math.sin(game.t * 6 + i)) : 0, p.y); d.rotation.set(0, yawOf(p.h), 0); d.scale.setScalar(f); d.updateMatrix();
        m.setMatrixAt(slot, d.matrix);
        if (k !== "ambulance") m.setColorAt(slot, c.setHSL((npc.hue % 360) / 360, 0.7, 0.58, THREE.SRGBColorSpace)); else m.setColorAt(slot, c.setRGB(1, 1, 1));
        shown++;
      }
      for (const k of KINDS) { const m = meshes[k]; m.count = n[k]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      ms = performance.now() - t0;
    },
  };
}
