import * as THREE from "three";
import { drivenKey, npcAt, type Game, type Npc } from "@/lib/playa";
import { fadeAt } from "@/lib/scene3d";
import { yawOf } from "@/lib/view3d";
import { glowing } from "./camps";
import { mergedParts, shaped as P, type Part } from "./materials";

/**
 * The people on the road (PLAN-3D.md 3.1): the bikes (and the packs that ride behind the art cars), the e-bikes, the walkers and the
 * ambulances, each kind one instanced mesh. Every NPC's place comes from `npcAt`, the function the top-down painter calls, so the same
 * biker passes you in both views. Only those within SHOW feet are drawn: each frame the near ones are packed into the first slots of
 * their mesh and `count` is set to how many (a zero-sized instance still costs its vertices, and the triangle count says so). A biker is a
 * cyclist on a cruiser (`bikeGeometry`) whose frame and shirt take their hue; a walker is all hue; everyone glows a little at night. The art
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

/**
 * A bike and its rider (riders.ts's cruiser and cyclist, held in one pose), 364 triangles (the e-bike 376): forward is -Z. Torus tyres, a tube frame
 * with its fork, swept-back bars and a saddle, and a rider sitting up with hands on the grips and feet on the pedals (one up, one down),
 * in a shirt, dark shorts and a straw hat. The frame and the shirt take the rider's hue; the rest keeps its own colour. The e-bike has
 * fat tyres and a battery on the down tube.
 */
export function bikeGeometry(ebike = false): THREE.BufferGeometry {
  const parts: Tinted[] = [], add = (geo: THREE.BufferGeometry, color: number, tint = 0) => parts.push({ geo, color, tint });
  const R = 1.1, fat = ebike ? 0.25 : 0.14;
  for (const z of [-2.15, 1.95]) {
    const c = v(0, R, z);
    add(new THREE.TorusGeometry((R - fat / 2) * S, fat * S, 3, 9).rotateY(Math.PI / 2).translate(c.x, c.y, c.z), TYRE);
  }
  // the frame
  const bb = v(0, 0.95, 0.35), seat = v(0, 2.72, 0.8), head0 = v(0, 2.2, -1.8), head1 = v(0, 3.05, -1.46), wR = v(0, R, 1.95), wF = v(0, R, -2.15);
  for (const [a, b, r] of [[bb, seat, 0.07], [seat, v(0, 2.95, -1.5), 0.07], [bb, v(0, 2.35, -1.74), 0.08], [head0, head1, 0.1], [bb, wR, 0.06], [seat, wR, 0.05], [head0, wF, 0.07]] as const) add(rod(a, b, r, 3), WHITE, 1);
  // stem, bars and grips, the saddle
  const stem = v(0, 3.35, -1.58);
  add(rod(head1, stem, 0.06, 3), STEEL);
  for (const s of [-1, 1]) { const bend = v(s * 0.95, 3.48, -1.3); add(rod(stem, bend, 0.05, 3), STEEL); add(rod(bend, v(s * 1.22, 3.45, -0.8), 0.08, 3), TYRE); }
  add(box(0.7 * S, 0.16 * S, 1.0 * S).translate(0, 2.92 * S, 0.9 * S), SADDLE);
  if (ebike) add(box(0.3 * S, 0.34 * S, 1.1 * S).rotateX(-0.6).translate(0, 1.78 * S, -0.7 * S), 0x1b1f3b);
  // the rider: hips on the saddle, sitting up straight-backed, hands on the grips
  const hips = v(0, 3.15, 0.85), sh = v(0, 4.95, 0.45), hd = v(0, 5.5, 0.38);
  add(box(0.7 * S, 0.45 * S, 0.55 * S).translate(hips.x, hips.y + 0.05 * S, hips.z), SHORTS);
  add(rod(hips, sh, 0.42, 6, 0.52), WHITE, 1);
  add(new THREE.SphereGeometry(0.42 * S, 6, 3).translate(hd.x, hd.y, hd.z), SKIN);
  add(cyl(0.85 * S, 0.85 * S, 0.05 * S, 6).translate(hd.x, hd.y + 0.36 * S, hd.z), STRAW);
  add(cyl(0.44 * S, 0.5 * S, 0.34 * S, 6).translate(hd.x, hd.y + 0.55 * S, hd.z), STRAW);
  for (const s of [-1, 1]) {
    const shoulder = v(s * 0.58, 4.85, 0.5), grip = v(s * 1.2, 3.47, -0.85), elbow = knee(shoulder, grip, 1.1, 1.05, v(s, -0.3, 0.6));
    add(rod(shoulder, elbow, 0.16, 3), WHITE, 1); add(rod(elbow, grip, 0.13, 3), SKIN);
    // the legs: the right foot on the forward pedal, up; the left on the back one, down
    const hip = v(s * 0.28, 3.15, 0.85), pedal = bb.clone().add(v(s * 0.36, s > 0 ? 0.42 : -0.42, s > 0 ? -0.4 : 0.4)), ankle = pedal.clone().add(v(0, 0.15, 0.1));
    const kn = knee(hip, ankle, 1.5, 1.45, v(0, 0.4, -1));
    add(rod(hip, kn, 0.27, 4, 0.22), SHORTS); add(rod(kn, ankle, 0.17, 3), SKIN);
    add(box(0.32 * S, 0.22 * S, 0.8 * S).translate(ankle.x, ankle.y - 0.1 * S, ankle.z - 0.2 * S), SHOE);
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

type Kind = "bike" | "ebike" | "walker" | "ambulance";
const KINDS: Kind[] = ["bike", "ebike", "walker", "ambulance"];

export function buildPeople(scene: THREE.Scene, g: Game): PeopleMeshes {
  const group = new THREE.Group();
  const geo: Record<Kind, THREE.BufferGeometry> = { bike: bikeGeometry(), ebike: bikeGeometry(true), walker: walkerTinted(), ambulance: ambulanceGeometry() };
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
      const mine = drivenKey(), n = { bike: 0, ebike: 0, walker: 0, ambulance: 0 };
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
