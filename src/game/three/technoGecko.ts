import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * TechnoGecko (asked 2026-11-02): the giant green gecko, as its top-down drawing has it (artcars.ts technoGecko): a long body and a round head with dark eyes bulging
 * at its sides, four legs splayed out wide (elbows up, each foot planted on the playa with three round toe pads), a row of yellow spots down its back that light at
 * night (and more along the tail), and a long tapering tail curling off to the left behind it, which sways from side to side as the drawing's does. On a chassis under
 * the belly (wheels at the drawing's x ±10, z ±12). Inside its measured box (40 x 69 ft). Two draw calls: the gecko, and its tail (its own mesh so it can sway).
 */
const GREEN = 0x5aa83a, BELLY = 0x8ccf5e, SPOT = 0xf2d04a, NAVY = 0x1b1f3b, DARK = 0x23252f;
/** The body: half-sizes and centre height; the head's. */
const BX = 9, BY = 4.4, BZ = 18, BC = 8.6, HX = 7, HY = 3.8, HZ = 6.8, HC = 9.8, HZC = -21;
/** Where the tail leaves the body (it sways about this point). */
const TAIL = new THREE.Vector3(0, 8, 14);
const glowHue = (k: number) => new THREE.Color().setHSL(((k * 50) % 360) / 360, 1, 0.6).getHex();

export function technoGecko(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the chassis under the belly and the wheels
    G(new THREE.BoxGeometry(14, 3, 32), DARK, { y: 4, z: 0 }),
    ...tyres(10, [-12, 12], 3, 2.4),
    // the body, a paler belly under it, the head and its paler jaw
    blob(BX, BY, BZ, 0, BC, 0, GREEN, 0.1, 14, 9),
    blob(BX - 1, 2.6, BZ - 1.5, 0, BC - 2.6, 0, BELLY, 0.08, 12, 4),
    blob(4.6, 3.4, 5, 0, BC + 1, -15.5, GREEN, 0.1, 8, 5),
    blob(HX, HY, HZ, 0, HC, HZC, GREEN, 0.1, 12, 8),
    blob(HX - 0.8, 2.2, HZ - 0.6, 0, HC - 2.4, HZC - 0.3, BELLY, 0.08, 10, 4),
  ];
  for (const s of [-1, 1]) {
    // the eyes, bulging at the sides of the head, a yellow ring round each dark slit
    parts.push(blob(1.7, 1.5, 1.8, s * 5.2, HC + 1.5, -23.2, 0x9cc23a, 0.3, 8, 6));
    parts.push(blob(1.1, 1.1, 1.1, s * 6, HC + 1.6, -23.6, NAVY, 0, 6, 5));
    parts.push(blob(0.35, 0.35, 0.3, s * 6.1, HC + 2.2, -24.5, 0xffffff, 0.6, 4, 3));
    // the nostrils
    parts.push(blob(0.4, 0.3, 0.3, s * 1.6, HC + 2.6, -27.4, NAVY, 0, 4, 2));
    // the legs: out and up to the elbow, down to the foot, three round toe pads spread on the ground
    for (const z0 of [-12, 10]) {
      const d = z0 < 0 ? -1 : 1, shoulder = v(s * 6, BC - 1, z0), elbow = v(s * 12.5, BC + 2.5, z0 + d * 3.5), foot = v(s * 15.6, 1.4, z0 + d * 6);
      parts.push(blob(2.4, 2.4, 2.6, shoulder.x, shoulder.y, shoulder.z, GREEN, 0.1, 6, 4));
      parts.push(rod(shoulder, elbow, 1.9, 1.5, GREEN, 0.1, 6), blob(1.5, 1.5, 1.5, elbow.x, elbow.y, elbow.z, GREEN, 0.1, 6, 4), rod(elbow, foot, 1.5, 1.1, GREEN, 0.1, 6));
      parts.push(blob(2, 0.8, 2, foot.x, 1, foot.z, GREEN, 0.1, 6, 3));
      for (let k = -1; k <= 1; k++) {
        const tx = s * 16.4 + k * 1.7 * s, tz = z0 + d * 8 + k * 0.6 * d;
        parts.push(blob(1.4, 0.55, 1.4, tx, 0.65, tz, BELLY, 0.3, 5, 3));
      }
    }
  }
  // the spots down the back, as the drawing's seven, and a few on the head; yellow by day, each its own colour at night
  for (let k = 0; k < 7; k++) {
    const x = k % 2 ? 3 : -3, z = -12 + k * 4, y = BC + BY * Math.sqrt(Math.max(0, 1 - (x / BX) ** 2 - (z / BZ) ** 2));
    parts.push(blob(1.7, 0.6, 1.7, x, y - 0.1, z, k % 3 ? SPOT : glowHue(k), 1, 6, 2));
  }
  for (const [x, z] of [[-2.4, -19], [2.4, -19], [0, -22]]) parts.push(blob(1, 0.45, 1, x, HC + HY * Math.sqrt(1 - (x / HX) ** 2 - ((z - HZC) / HZ) ** 2) - 0.1, z, SPOT, 1, 6, 2));
  group.add(glowMesh(parts));

  // the tail: the drawing's curve from (0, 14) by (0, 30) to (-6, 38), tapering and sinking toward the tip, built about where it leaves the body
  const curve = new THREE.QuadraticBezierCurve3(v(0, 8, 14), v(0, 5.6, 30), v(-6, 3, 38));
  const pts = curve.getPoints(8).map((p) => p.sub(TAIL)), t: GlowPart[] = [];
  for (let i = 0; i < 8; i++) {
    const r0 = 3.2 - i * 0.33, r1 = 3.2 - (i + 1) * 0.33;
    t.push(rod(pts[i], pts[i + 1], r0, r1, GREEN, 0.1, 6));
    if (i) t.push(blob(r0, r0, r0, pts[i].x, pts[i].y, pts[i].z, GREEN, 0.1, 6, 3));
    if (i % 2 === 0 && i < 7) t.push(blob(r0 * 0.45, 0.4, r0 * 0.45, pts[i].x, pts[i].y + r0 - 0.15, pts[i].z, i % 4 ? SPOT : glowHue(i + 3), 1, 6, 2));
  }
  t.push(blob(0.6, 0.6, 0.6, pts[8].x, pts[8].y, pts[8].z, GREEN, 0.1, 6, 4));
  const tail = glowMesh(t);
  tail.position.copy(TAIL);
  group.add(tail);

  return critter(group, (time) => { tail.rotation.y = Math.sin(time * 1.5) * 0.2; }, BC + BY - 0.3);
}
