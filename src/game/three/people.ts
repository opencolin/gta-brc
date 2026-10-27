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
 * their mesh and `count` is set to how many (a zero-sized instance still costs its vertices, and the triangle count says so). Each is one
 * colour, its hue, with dark wheels, and glows a little at night. The art cars (kind "mutant") are cars.ts's.
 */
export type PeopleMeshes = { group: THREE.Group; update(g: Game, cam: THREE.Vector3): void; /** ms the last update took, and how many people it drew */ stats(): { ms: number; shown: number } };
/** People show within SHOW feet of your ride (in three dimensions: from the camera's height), shrinking away over the last fifth of it. */
export const SHOW = 900;

const WHITE = 0xffffff, TYRE = 0x15161d;
const cyl = (rt: number, rb: number, h: number, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, seg);
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const wheel = (r: number, w: number, z: number): Part => P(cyl(r, r, w), TYRE, { y: r, z, rz: Math.PI / 2 });

/** A bike and its rider, about 80 triangles: forward is -Z. */
export function bikeGeometry(r = 2.4, tyre = 0.7, battery = false): THREE.BufferGeometry {
  const parts: Part[] = [
    wheel(r, tyre, -6), wheel(r, tyre, 6), P(box(0.7, 0.8, 11), WHITE, { y: r + 1.8 }),
    P(box(1.8, 3.6, 1.6), WHITE, { y: 7.4, z: 1.2, rx: -0.2 }), P(new THREE.SphereGeometry(1.2, 5, 3), WHITE, { y: 10.2, z: 0.3 }),
  ];
  if (battery) parts.push(P(box(1.2, 1.8, 3), TYRE, { y: r + 2.8, z: 3.5 }));
  const m = mergedParts(parts); return m.geometry;
}
/** A walker, about 70 triangles: a body, a head and a hat. */
export function walkerGeometry(): THREE.BufferGeometry {
  return mergedParts([
    P(new THREE.CapsuleGeometry(1.1, 3, 1, 5), WHITE, { y: 3 }), P(new THREE.SphereGeometry(1.1, 5, 3), WHITE, { y: 6.1 }), P(cyl(2, 2, 0.25), WHITE, { y: 7.1 }),
  ]).geometry;
}
/** An ambulance: white box, red stripe, red and blue lights on the roof. */
function ambulanceGeometry(): THREE.BufferGeometry {
  return mergedParts([
    P(box(14, 9, 28), 0xf4f4f6, { y: 5.5 }), P(box(14.2, 1.2, 28.2), 0xd62828, { y: 5.5 }), P(box(8, 0.8, 1.4), 0xd62828, { y: 10.3, z: -2, x: -2.5 }), P(box(3, 0.8, 1.4), 0x2f6fd8, { y: 10.3, z: -2, x: 3 }),
    ...[-1, 1].flatMap((s) => [-9, 9].map((z): Part => P(cyl(2, 2, 1.4, 8), TYRE, { x: s * 7, y: 2, z, rz: Math.PI / 2 }))),
  ]).geometry;
}

type Kind = "bike" | "ebike" | "walker" | "ambulance";
const KINDS: Kind[] = ["bike", "ebike", "walker", "ambulance"];

export function buildPeople(scene: THREE.Scene, g: Game): PeopleMeshes {
  const group = new THREE.Group();
  const geo: Record<Kind, THREE.BufferGeometry> = { bike: bikeGeometry(), ebike: bikeGeometry(3, 1.6, true), walker: walkerGeometry(), ambulance: ambulanceGeometry() };
  const mat = glowing({ vertexColors: true }, "glow-people", 0.3);
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
