import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * The Scarab (asked 2026-11-02): a beetle as long as a bus, as its top-down drawing has it (artcars.ts scarab): the great domed shell, deep green at its edges and
 * bright jade along the middle (three shells one inside the other, so the colour steps up toward the seam, the middle one lit at night), split down the middle by a
 * dark seam, set with glowing jewels; in front the darker pronotum and head with a golden horn sweeping forward and up, and three jointed legs a side, knees up, feet
 * on the playa, which scuttle as the drawing's do (the legs' mesh turns a little to and fro about the middle, so one side steps forward as the other steps back).
 * On a chassis under the shell (wheels at the drawing's x ±13, z -10 and 14). Inside its measured box (37 x 64 ft). Two draw calls: the beetle, and its legs.
 */
const EDGE = 0x1f6f5b, MID = 0x2e9073, JADE = 0x3fb08a, SEAM = 0x0f3a30, PRONOTUM = 0x245a46, GOLD = 0xd9b44a, LEG = 0x2a2f20, DARK = 0x23252f;
/** The shell: a half-ellipsoid of half-sizes SX, SY, SZ standing on y = S0, centred at z = SZC. */
const SX = 14, SY = 9.6, SZ = 24, S0 = 3.6, SZC = 6;
const dome = (sx: number, sy: number, sz: number, color: number, glow: number): GlowPart =>
  G(new THREE.SphereGeometry(1, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, { sx, sy, sz, y: S0, z: SZC }, glow);
/** The height of the outer shell at (x, z). */
const shell = (x: number, z: number) => S0 + SY * Math.sqrt(Math.max(0, 1 - (x / SX) ** 2 - ((z - SZC) / SZ) ** 2));

export function scarab(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the chassis and the wheels
    G(new THREE.BoxGeometry(20, 2.6, 40), DARK, { y: 3.4, z: 2 }),
    ...tyres(13, [-10, 14], 3.1, 2.4),
    // the shell, deep green at the edges stepping up to jade along the seam, a dark rim under it
    dome(SX, SY, SZ, EDGE, 0.1),
    dome(10.6, SY + 0.3, SZ - 0.5, MID, 0.3),
    dome(6.2, SY + 0.55, SZ - 1, JADE, 0.6),
    G(new THREE.CylinderGeometry(1, 1, 1, 22, 1, true), 0x163f34, { sx: SX, sy: 1.2, sz: SZ, y: S0 - 0.5, z: SZC }),
    // the pronotum, the head under it, the golden horn sweeping forward and up, two small horns either side
    blob(10, 5.6, 7, 0, 6.4, -17.5, PRONOTUM, 0.1, 14, 7),
    blob(5.2, 3.4, 4.4, 0, 5.4, -23.4, PRONOTUM, 0.1, 10, 6),
    rod(v(0, 6.6, -24), v(0, 9.4, -30), 3, 1.4, GOLD, 0.35, 8),
    rod(v(0, 9.4, -30), v(0, 13.6, -33.4), 1.4, 0.15, GOLD, 0.35, 8),
    blob(1.5, 1.5, 1.5, 0, 9.4, -30, GOLD, 0.35, 8, 6),
  ];
  for (const s of [-1, 1]) {
    parts.push(rod(v(s * 3, 6.8, -22.6), v(s * 4.6, 8.4, -27.4), 1, 0.15, GOLD, 0.35, 6));
    // the eyes, at the sides of the head
    parts.push(blob(1.4, 1.4, 1.4, s * 4.4, 6.2, -25, 0x0b1a14, 0, 6, 4));
  }
  // the seam down the middle of the shell
  for (let k = 0; k < 7; k++) {
    const z0 = -14 + k * 6.3, z1 = z0 + 6.3;
    parts.push(rod(v(0, shell(0, z0) + 0.55, z0), v(0, shell(0, z1) + 0.55, z1), 0.35, 0.35, SEAM, 0, 4));
  }
  // the jewels set in the shell, in pairs either side of the seam: gold, ruby, sapphire, lit at night
  const JEWEL = [0xffd24a, 0xff3d5a, 0x4f8bff, 0xffd24a, 0xb04fff];
  JEWEL.forEach((c, k) => {
    for (const s of [-1, 1]) {
      const x = s * (4 + (k % 2) * 4), z = -6 + k * 7.5, y = shell(x, z) + (Math.abs(x) < 6.2 ? 0.5 : 0.25);
      parts.push(blob(1.1, 0.6, 1.1, x, y, z, c, 1, 6, 3));
    }
  });
  group.add(glowMesh(parts));

  // the legs, about the middle so they can turn: three a side at the drawing's z -8, 2 and 12, out and up to the knee, down to a foot on the ground
  const legs: GlowPart[] = [];
  for (const s of [-1, 1]) [-8, 2, 12].forEach((z, i) => {
    const d = i - 1, hip = v(s * 10, 4.4, z - SZC + 2), knee = v(s * 15.4, 9.2, z + d * 1.6 - SZC + 2), foot = v(s * 17.8, 0.5, z + d * 4 - SZC + 2);
    legs.push(rod(hip, knee, 1, 0.8, LEG, 0, 5), blob(0.95, 0.95, 0.95, knee.x, knee.y, knee.z, LEG, 0, 5, 4), rod(knee, foot, 0.8, 0.35, LEG, 0, 5));
    // a spur on the shin
    const m = knee.clone().lerp(foot, 0.5);
    legs.push(rod(m, m.clone().add(v(s * 1.4, 0.6, -0.6)), 0.3, 0.05, LEG, 0, 4));
  });
  const legMesh = glowMesh(legs);
  legMesh.position.z = SZC - 2;
  group.add(legMesh);

  return critter(group, (t) => { legMesh.rotation.y = Math.sin(t * 6) * 0.05; }, S0 + SY);
}
