import * as THREE from "three";
import { G, blob, critter, glowMesh, tyres, type Critter, type GlowPart } from "./critters";

/**
 * The Nudibranch (asked 2026-11-02): a sea slug sixty feet long, as its top-down drawing has it (artcars.ts nudibranch): a long low purple body edged all round in
 * yellow (its mantle's frilly rim, which glows at night), a pale stripe down the middle of its back, two orange horns (rhinophores) up at the front, and down its
 * back a double row of fourteen orange cerata, the finger-like plumes a nudibranch breathes with, leaning out to either side, each tipped in a colour of its own that
 * lights at night. The cerata sway together from side to side. On a low chassis (wheels at the drawing's x ±11, z -14 and 16). Inside its measured box (27 x 67 ft).
 * Two draw calls: the slug, and its cerata (their own mesh so they can sway).
 */
const PURPLE = 0x6a3fc8, DEEP = 0x4a2a95, YELLOW = 0xffd23f, ORANGE = 0xff7a2f, DARK = 0x23252f;
/** The body: an ellipsoid of half-sizes BX, BY, BZ centred at (0, BC, BZC). */
const BX = 10.6, BY = 7.6, BZ = 29.4, BC = 4.4, BZC = 1.5;
/** The height of the body's surface at (x, z). */
const top = (x: number, z: number) => BC + BY * Math.sqrt(Math.max(0, 1 - (x / BX) ** 2 - ((z - BZC) / BZ) ** 2));

export function nudibranch(): Critter {
  const group = new THREE.Group();
  const parts: GlowPart[] = [
    // the chassis and the wheels
    G(new THREE.BoxGeometry(18, 2.4, 44), DARK, { y: 3.4, z: 1 }),
    ...tyres(11, [-14, 16], 3, 2.4),
    // the body, darker underneath, and the yellow mantle rim round its foot, a frill of waves
    blob(BX, BY, BZ, 0, BC, BZC, PURPLE, 0.15, 20, 11),
    blob(BX - 0.4, 2, BZ - 0.4, 0, 3.6, BZC, DEEP, 0, 16, 4),
    // the pale stripe down the back
    blob(1.3, 0.6, 22, 0, BC + BY - 0.15, BZC - 1, 0xf3e9ff, 0.35, 8, 4),
  ];
  // the rim: lobes all round, alternating a little up and down, yellow and lit at night
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2, x = Math.sin(a) * (BX + 0.4), z = BZC - Math.cos(a) * (BZ + 0.3);
    parts.push(blob(4.4, 0.9 + (k % 2) * 0.4, 1.7, x, BC + 0.8 + (k % 2) * 0.5, z, YELLOW, 0.7, 6, 3, { ry: a }));
  }
  // the rhinophores: two horns up at the front, leaning out, ringed like the real ones
  for (const s of [-1, 1]) {
    const x = s * 4, z = -26, y = top(x, z);
    parts.push(G(new THREE.ConeGeometry(1.4, 7, 8), ORANGE, { rx: -0.25, rz: -s * 0.3, x: x + s * 1, y: y + 3.1, z: z - 0.8 }, 0.4));
    for (const h of [1.6, 3.2]) parts.push(G(new THREE.TorusGeometry(1.4 - h * 0.17, 0.22, 3, 8), YELLOW, { rx: Math.PI / 2 - 0.25, rz: -s * 0.3, x: x + s * (0.1 + h * 0.3), y: y + h, z: z - h * 0.25 }, 0.6));
  }
  group.add(glowMesh(parts));

  // the cerata: the drawing's fourteen at x ±5 (alternating), z -18 to 21, leaning out; built about the line along the top of the back so they sway from it
  const c: GlowPart[] = [];
  const SY = BC + BY - 1;
  for (let k = 0; k < 14; k++) {
    const z = -18 + k * 3, s = k % 2 ? 1 : -1, x = s * 5, y = top(x, z) - 0.6 - SY, h = 7.5 - Math.abs(k - 6.5) * 0.25, lean = s * 0.45;
    const tip = new THREE.Vector3(x - Math.sin(-lean) * h, y + Math.cos(lean) * h, z);
    c.push(G(new THREE.ConeGeometry(1.9, h, 7), ORANGE, { rz: -lean, x: (x + tip.x) / 2, y: (y + tip.y) / 2, z }, 0.35));
    c.push(blob(1.1, 1.3, 1.1, tip.x, tip.y - 0.3, tip.z, new THREE.Color().setHSL(((k * 25) % 360) / 360, 1, 0.62).getHex(), 1, 5, 4));
  }
  const cerata = glowMesh(c);
  cerata.position.y = SY;
  group.add(cerata);

  return critter(group, (t) => { cerata.rotation.z = Math.sin(t * 2.2) * 0.1; cerata.rotation.x = Math.sin(t * 1.3) * 0.03; }, BC + BY - 0.5);
}
