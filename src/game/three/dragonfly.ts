import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * DragonFly (asked 2026-11-02): a dragonfly sixty feet across riding a narrow car, as its top-down drawing has it (artcars.ts dragonfly): two great green eyes at the
 * front, a blue thorax, a long blue abdomen in nine segments tapering to the tail, and four long pale wings, two a side at the drawing's z -8 and 2, swept back a little,
 * with dark veins and a dark spot near each tip. The body glows blue at night and the wings pale. The wings flicker: they are raised a little from the body (a dihedral)
 * and their mesh is scaled up and down in height about the roots, so the tips beat up and down together. Six thin legs hold the thorax over the car. Inside its measured
 * box (64 x 49 ft). Two draw calls: the dragonfly, and its wings (their own mesh so they can beat).
 */
const BODY = 0x2a8bb8, THORAX = 0x3aa7d8, EYE = 0x7ce0a0, VEIN = 0x466e96, DARK = 0x23252f;
/** The thorax's height, and the wings' roots' height (where they beat about). */
const TY = 13, WY = 15.6;

/** A wing on side s rooted at (s * 2.4, 0, zr) (in the wings' frame, about WY): an ellipse of half-sizes L x W with its veins and spot, swept back and raised. */
function wing(s: number, zr: number, color: number, out: GlowPart[]) {
  const L = 14.7, W = 4.4, root = new THREE.Vector3(s * 2.4, 0, zr);
  const turn = (geo: THREE.BufferGeometry) => geo.rotateY(-s * 0.15).rotateZ(s * 0.24).translate(root.x, root.y, root.z);
  out.push({ geo: turn(new THREE.SphereGeometry(1, 16, 4).scale(L, 0.22, W).translate(s * L, 0, 0)), color, glow: 0.55 });
  const v = (x: number, z: number) => new THREE.Vector3(s * x, 0.12, z);
  const vein = (a: THREE.Vector3, b: THREE.Vector3, r: number) => { const p = rod(a, b, r, r * 0.6, VEIN, 0.15, 4); p.geo = turn(p.geo); out.push(p); };
  vein(v(0.3, -1.6), v(2 * L - 1.2, -0.9), 0.3);
  vein(v(0.3, 0.6), v(2 * L - 3, 0.9), 0.2);
  for (const x of [10, 19]) vein(v(x, -1.5), v(x + 1.6, 2.4), 0.1);
  const spot = blob(1.3, 0.3, 0.7, s * (2 * L - 3.2), 0.14, -1.4, 0x2b3550, 0, 6, 3); spot.geo = turn(spot.geo); out.push(spot);
}

export function dragonfly(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the car: a narrow chassis on four wheels (the drawing's at x ±6, z -8 and 16), a post up to the thorax and a blue light under it at night
    G(new THREE.BoxGeometry(8, 2.4, 34), DARK, { y: 3.6, z: 3 }),
    G(new THREE.BoxGeometry(8.4, 0.4, 34.4), 0x4fd1ff, { y: 2.3, z: 3 }, 1),
    ...tyres(6, [-8, 16], 3, 2.2),
    rod(v(0, 4.5, -2), v(0, TY - 2, -3), 1.2, 0.9, DARK),
    rod(v(0, 4.5, 14), v(0, 12, 12), 0.8, 0.6, DARK),
    // the thorax, the head between the eyes, the eyes
    blob(4.5, 4, 8, 0, TY, -4, THORAX, 0.45, 10, 8),
    blob(3, 2.6, 2.4, 0, TY - 0.6, -12.4, THORAX, 0.45, 8, 6),
    blob(3, 3.2, 3, -3, TY + 0.6, -15, EYE, 0.55, 8, 6),
    blob(3, 3.2, 3, 3, TY + 0.6, -15, EYE, 0.55, 8, 6),
    blob(1.2, 0.8, 0.8, 0, TY - 1.8, -15.6, 0x1b1f3b, 0, 8, 6),
  ];
  // the abdomen: nine segments, tapering, the tail lifting a little at the end, a pale ring between each
  for (let k = 0; k < 9; k++) {
    const r = 2.6 - k * 0.15, z = 3.6 + k * 3.15, y = TY - 0.4 + (k / 8) ** 2 * 1.6;
    parts.push(blob(r, r, 1.8, 0, y, z, k % 2 ? BODY : 0x2f9fd0, 0.6, 8, 6));
    if (k) parts.push(G(new THREE.CylinderGeometry(r * 0.8, r * 0.8, 0.5, 8, 1, true), 0x9fe6ff, { rx: Math.PI / 2, x: 0, y, z: z - 1.6 }, 0.8));
  }
  parts.push(rod(v(0, TY + 1.2, 30), v(0, TY + 1.6, 30.6), 0.5, 0.2, BODY, 0.6, 4));
  // six thin legs from under the thorax, bent at the knee, to the chassis' edges
  for (const s of [-1, 1]) for (const z of [-9, -5, -1]) {
    const knee = v(s * 5.6, TY - 3.2, z - 0.8);
    parts.push(rod(v(s * 1.6, TY - 3, z), knee, 0.35, 0.3, DARK, 0, 3), rod(knee, v(s * 4.4, 5, z + 1.2), 0.3, 0.2, DARK, 0, 3));
  }
  group.add(glowMesh(parts));

  // the wings, in their own frame about the roots' height so scaling it in height beats them
  const w: GlowPart[] = [];
  for (const s of [-1, 1]) { wing(s, -8, 0xa8d8f2, w); wing(s, 2, 0xbcc4f4, w); }
  const wings = glowMesh(w);
  wings.position.y = WY;
  group.add(wings);

  return critter(group, (t) => { wings.scale.y = 1 + 0.85 * Math.sin(t * 14); }, TY + 4);
}
