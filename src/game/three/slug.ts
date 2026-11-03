import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * The Slug (asked 2026-11-02): a long, glistening garden slug crawling on hidden wheels, as its top-down drawing has it (artcars.ts slug): the drawing's outline,
 * blunt at the head and drawn out to a point at the tail, as a domed body on a paler foot; amber at the head shading to brown at the tail, the mantle's saddle over the
 * front with its breathing pore, a keel ridge along the back, wet white shines down the middle, and on the head two long eye stalks, dark eyes at their tips, and two
 * short feelers below. At night the body glows its colours, the fringe of its foot pink. The head's stalks and feelers wave and bob. Inside the
 * drawing's footprint (25 x 72 ft; the wheels at x ±10, z -12 and 14). Two draw calls: the slug, and its stalks and feelers (their own mesh so they can wave).
 */
const AMBER = new THREE.Color(0xd8953e), BROWN = new THREE.Color(0x8a5a2b), FOOT = 0xe2b48a, PINK = 0xff5fa2, NAVY = 0x1b1f3b;
/** The foot's top (the dome's base) and how tall the dome is for its width. */
const FY = 4.6, K = 1.15;

/** The drawing's right-hand outline, head (-27) to tail (34): its two quadratic curves, as (half-width, z) points. */
function outline(n = 13): THREE.Vector2[] {
  const q = (a: number[], b: number[], c: number[], t: number) => new THREE.Vector2((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]);
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) pts.push(q([0, -27], [8, -26], [10, -14], i / n));
  for (let i = 1; i <= n; i++) pts.push(q([10, -14], [12, 10], [0, 34], i / n));
  return pts;
}
/** The half-width of the body at z. */
function halfW(z: number): number {
  const o = outline(40);
  for (let i = 1; i < o.length; i++) if (o[i].y >= z) { const a = o[i - 1], b = o[i], f = (z - a.y) / (b.y - a.y || 1); return a.x + (b.x - a.x) * f; }
  return 0;
}
/** The top of the dome at (x, z). */
const top = (x: number, z: number) => FY + K * Math.sqrt(Math.max(0, halfW(z) ** 2 - x * x));

export function slug(): Critter {
  const group = new THREE.Group();
  const o = outline();
  // the dome: the outline turned half round its own long axis (a lathe about y laid along z, its upper half), then squashed to K
  const dome = new THREE.LatheGeometry(o, 14, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, K, 1).translate(0, FY, 0);
  // the mantle: the saddle over the front third, standing a little proud
  const mantle = blob(9.4, 4.2, 12.5, 0, top(0, -10) - 2.4, -10, 0, 0.45, 14, 8).geo;
  // the foot: the outline a little wider, as a flat slab under the dome
  const sh = new THREE.Shape(); sh.moveTo(0, -27.6);
  for (const p of o.slice(1)) sh.lineTo(p.x * 1.08 + 0.4, p.y);
  for (const p of o.slice(0, -1).reverse()) sh.lineTo(-(p.x * 1.08 + 0.4), p.y);
  const foot = new THREE.ExtrudeGeometry(sh, { depth: FY - 1.6, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0, FY, 0);

  const parts: GlowPart[] = [
    { geo: dome, color: 0xffffff, glow: 0.45 },
    { geo: mantle, color: 0xffffff, glow: 0.45 },
    { geo: foot, color: FOOT, glow: 0.15 },
    // the fringe round the foot, pink at night
    G(new THREE.ExtrudeGeometry(sh, { depth: 0.4, bevelEnabled: false }).scale(1.02, 1.01, 1), PINK, { rx: Math.PI / 2, y: 2.2 }, 1),
    ...tyres(10, [-12, 14], 2.4, 2.2),
    // the keel along the back, from the mantle to the tail
    blob(0.9, 1.6, 15, 0, top(0, 14) - 0.6, 14, 0xffffff, 0.45, 8, 6, { rx: 0.16 }),
    // the breathing pore on the mantle's right side
    blob(1.2, 1.2, 0.8, 7.2, top(7.2, -6) + 1.6, -6, 0x4a2c14, 0, 8, 6, { ry: Math.PI / 2 }),
  ];
  // the wet shines down the middle, as the drawing's
  for (let k = 0; k < 6; k++) { const x = -3 + (k % 2) * 6, z = -14 + k * 7, y = Math.max(top(x, z), k < 3 ? top(0, -10) - 2.4 + 4.2 * Math.sqrt(Math.max(0, 1 - (x / 9.4) ** 2 - ((z + 10) / 12.5) ** 2)) : 0); parts.push(blob(1.6, 0.4, 1.6, x, y + 0.1, z, 0xffffff, 0.8, 6, 3)); }
  const mesh = glowMesh(parts);
  // the body's colour: amber at the head shading to brown at the tail, as the drawing's gradient (the dome's and the mantle's vertices come first in the merge)
  const n = dome.getIndex()!.count + mantle.getIndex()!.count, pos = mesh.geometry.getAttribute("position"), col = mesh.geometry.getAttribute("color") as THREE.BufferAttribute, c = new THREE.Color();
  for (let i = 0; i < n; i++) { c.lerpColors(AMBER, BROWN, THREE.MathUtils.clamp((pos.getZ(i) + 27) / 61, 0, 1)); col.setXYZ(i, c.r, c.g, c.b); }
  group.add(mesh);

  // ── the stalks and feelers, about a pivot on the head so they wave and bob together
  const HZ = -23.5, HY = top(0, HZ);
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const s: GlowPart[] = [];
  for (const side of [-1, 1]) {
    const a = v(side * 2.6, -0.8, 0.5), m = v(side * 4.4, 4.5, -5.4), b = v(side * 6, 8.5, -11.5);
    s.push(rod(a, m, 1.2, 0.85, 0xb07a3a, 0.4, 7), rod(m, b, 0.85, 0.6, 0xb07a3a, 0.4, 7));
    s.push(blob(1.5, 1.5, 1.5, b.x, b.y, b.z, NAVY, 0, 10, 8), blob(0.4, 0.4, 0.4, b.x - side * 0.4, b.y + 0.6, b.z - 1.2, 0xffffff, 0.7, 6, 4));
    // the short feelers low on the front of the head
    const f0 = v(side * 2.4, -5.2, -3.2), f1 = v(side * 3.6, -5.8, -7.4);
    s.push(rod(f0, f1, 0.8, 0.45, 0xb07a3a, 0.4, 6), blob(0.7, 0.7, 0.7, f1.x, f1.y, f1.z, 0x5a3a1e, 0, 6, 4));
  }
  const stalks = new THREE.Group(); stalks.position.set(0, HY, HZ);
  stalks.add(glowMesh(s)); group.add(stalks);

  return critter(group, (t) => { stalks.rotation.z = Math.sin(t * 3) * 0.12; stalks.rotation.x = Math.sin(t * 1.7) * 0.1; }, top(0, 10) - 0.6);
}
