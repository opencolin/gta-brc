import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Discow (asked 2026-11-02): San Francisco's disco cow, a bull wrapped in mirror vinyl, as its top-down drawing has it (artcars.ts discow): a great silver body
 * standing on four legs on a low chassis, darker mirror holstein patches, the vinyl's tiles twinkling (white, lit at night), the head forward with its pink muzzle,
 * dark eyes, silver ears and cream horns sweeping out and forward, the tail down behind; on its back the disco balls, two small ones and the big one turning on a
 * post. Faceted all over (flat-shaded), so every face catches the light its own way. Inside the drawing's footprint (32 x 78 ft; the wheels at x ±13, z ±16).
 * Two draw calls: the cow, and the big mirrorball (its own mesh so it can turn).
 */
const MIRROR = 0xd9dde8, LEG = 0xc3c8d6, PATCH = 0x8f96ab, BALL = 0xb8bfd0, HORN = 0xf6e6c8, PINKM = 0xf3c7d2, NAVY = 0x1b1f3b, DARK = 0x23252f;
/** The body: an ellipsoid of half-sizes (BX, BY, BZ) centred at (0, BC, BZC), as the drawing's 15 x 25 ellipse at y 4. */
const BX = 14, BY = 8.5, BZ = 24, BC = 17, BZC = 4;
/** The top of the body at (x, z). */
const top = (x: number, z: number) => BC + BY * Math.sqrt(Math.max(0, 1 - (x / BX) ** 2 - ((z - BZC) / BZ) ** 2));

export function discow(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the chassis, a light strip round it at night, the wheels
    G(new THREE.BoxGeometry(24, 2.4, 50), DARK, { y: 4, z: 1 }),
    G(new THREE.BoxGeometry(24.4, 0.5, 50.4), 0xc58cff, { y: 2.9, z: 1 }, 1),
    ...tyres(12.6, [-16, 16], 3.2, 2.4),
    // the body, the head, the muzzle and its nostrils
    blob(BX, BY, BZ, 0, BC, BZC, MIRROR, 0.3, 16, 10),
    blob(7.5, 6.5, 9, 0, 21, -24, MIRROR, 0.3, 12, 8),
    blob(5, 3.4, 3.2, 0, 17.6, -31.4, PINKM, 0.2, 10, 6),
    // the tail: down from the rump, a tuft at its end
    rod(v(0, 21, 27.5), v(1.4, 15, 33.5), 0.6, 0.45, LEG, 0, 5), rod(v(1.4, 15, 33.5), v(2, 9.5, 35.5), 0.45, 0.4, LEG, 0, 5), blob(1, 1.8, 1, 2, 8.4, 35.8, PATCH, 0, 6, 4),
  ];
  for (const s of [-1, 1]) {
    parts.push(blob(0.6, 0.5, 0.4, s * 1.8, 18.6, -34.4, NAVY, 0, 6, 4));
    // the eyes, a shine in each
    parts.push(blob(1.2, 1.4, 0.8, s * 4, 23.6, -31, NAVY, 0, 8, 6), blob(0.35, 0.35, 0.3, s * 4 - 0.4, 24.2, -31.7, 0xffffff, 0.7, 6, 4));
    // the ears, out to the sides, and the horns sweeping out, up and forward
    parts.push(blob(4, 1, 2.2, s * 9, 25.6, -26, LEG, 0.1, 8, 6, { rz: -s * 0.35, ry: s * 0.5 }));
    const h = [v(s * 4.6, 26.4, -27.5), v(s * 8.4, 28.6, -32), v(s * 11, 31.6, -36.4), v(s * 12, 34.6, -39.6)], r = [1.3, 1, 0.7, 0.2];
    for (let i = 0; i < 3; i++) parts.push(rod(h[i], h[i + 1], r[i], r[i + 1], HORN, 0.15, 6));
    // the legs, at the drawing's x ±14, z -9.5 and 20.5: from under the body down to hooves on the chassis
    for (const z of [-9.5, 20.5]) {
      parts.push(rod(v(s * 11.5, 13, z), v(s * 13.6, 6.8, z), 2.2, 1.7, LEG, 0.1, 6));
      parts.push(G(new THREE.CylinderGeometry(1.9, 2, 1.6, 6), 0x5c6276, { x: s * 13.6, y: 6, z }));
    }
  }
  // the holstein patches: darker mirror, lying on the body's back and flanks
  for (const [x, z, dp, dt] of [[-6, -4, 0.55, 0.32], [7, 14, 0.5, 0.3], [-12.6, 16, 0.4, 0.42], [12.8, -6, 0.36, 0.36], [-12.4, -14, 0.3, 0.3]] as const) {
    // a piece of the body's own ellipsoid a hair larger, round the point over (x, z), so it lies on the mirror like paint
    const ux = x / BX, uz = (z - BZC) / BZ, th = Math.acos(Math.sqrt(Math.max(0, 1 - ux * ux - uz * uz))), ph = Math.atan2(uz, -ux);
    parts.push(G(new THREE.SphereGeometry(1, 8, 5, ph - dp, dp * 2, Math.max(0, th - dt), dt * 2), PATCH, { sx: BX * 1.012, sy: BY * 1.012, sz: BZ * 1.012, y: BC, z: BZC }, 0.1));
  }
  // the vinyl's tiles: little white squares over the body that twinkle as the light moves, lit at night
  for (let k = 0; k < 22; k++) {
    const x = -12 + ((k * 7.3) % 24), z = -16 + ((k * 11.7) % 42);
    if ((x / BX) ** 2 + ((z - BZC) / BZ) ** 2 > 0.8) continue;
    const y = top(x, z), n = v(x / BX ** 2, (y - BC) / BY ** 2, (z - BZC) / BZ ** 2).normalize();
    const g = new THREE.BoxGeometry(1.6, 1.6, 0.2).lookAt(n).translate(x, y, z);
    parts.push({ geo: g, color: 0xffffff, glow: 1.4 });
  }
  // the two small disco balls on the back, as the drawing's (-7, 14) and (8, -8)
  for (const [x, z] of [[-7, 14], [8, -8]] as const) parts.push(blob(3.2, 3.2, 3.2, x, top(x, z) + 2.4, z, BALL, 0.45, 10, 7));
  // the big ball's post
  const ty = top(0, 2);
  parts.push(rod(v(0, ty - 1, 2), v(0, ty + 2.6, 2), 0.6, 0.5, 0x8a90a8));
  group.add(glowMesh(parts, true));

  // the big mirrorball: faceted silver, lit at night, turning
  const ball = glowMesh([G(new THREE.SphereGeometry(6, 14, 9), BALL, {}, 0.5)], true);
  ball.position.set(0, ty + 8.2, 2);
  group.add(ball);

  return critter(group, (t) => { ball.rotation.y = t * 1.3; }, ty - 0.5);
}
