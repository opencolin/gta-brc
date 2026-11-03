import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Disco Doge (asked 2026-10-31): a shiba's head on wheels, as its top-down drawing has it (artcars.ts discoDoge): a big round orange head with a cream muzzle and
 * cheeks, the shiba's cream eyebrow dots, dark eyes and nose, two pointed ears with cream insides, on a dark chassis on six wheels; a mirrorball on a post at the
 * back of the head, turning, and a ring of disco bulbs round the chassis that light at night. Inside the drawing's footprint (31 x 58 ft). Two draw calls: the dog
 * and the mirrorball (faceted, its own mesh so it can turn).
 */
const ORANGE = 0xe3a24f, CREAM = 0xf6e6c8, NAVY = 0x1b1f3b, DARK = 0x23252f, SILVER = 0xc0c6d6;
/** The head: an ellipsoid of half-sizes HX, HY, HZ centred at (0, HC, HZC). */
const HX = 14, HY = 12, HZ = 16, HC = 17, HZC = 3;
/** Where a point at (x, y) lies on the front of the head (the smaller z). */
const front = (x: number, y: number) => HZC - HZ * Math.sqrt(Math.max(0, 1 - (x / HX) ** 2 - ((y - HC) / HY) ** 2));

export function discoDoge(): Critter {
  const group = new THREE.Group();
  const parts: GlowPart[] = [
    // the chassis, its skirt and the wheels (the drawing's at x ±13, z -14 and 18)
    G(new THREE.BoxGeometry(24, 3, 48), DARK, { y: 4.5, z: 2 }),
    ...tyres(12, [-14, 18], 3.6, 2.6),
    // the head, the cream muzzle and cheeks under it, the snout and its nose
    blob(HX, HY, HZ, 0, HC, HZC, ORANGE, 0, 24, 16),
    blob(11, 7.5, 11, 0, 12.5, -6, CREAM, 0, 18, 12),
    blob(7, 5, 6.5, 0, 13.5, front(0, 13.5) - 3, CREAM, 0, 16, 10),
    blob(2.2, 1.6, 1.4, 0, 15.6, front(0, 13.5) - 8.8, NAVY, 0, 10, 8),
    // a little smile under the nose
    G(new THREE.TorusGeometry(2.6, 0.35, 4, 12, Math.PI * 0.8), NAVY, { rz: Math.PI + Math.PI * 0.1, x: 0, y: 12.2, z: front(0, 13.5) - 6.4 }),
  ];
  // the eyes, a little shine in each, and the cream dots above them that every shiba has
  for (const s of [-1, 1]) {
    parts.push(blob(1.9, 2.3, 1.1, s * 5.6, 21, front(5.6, 21) - 0.4, NAVY, 0, 10, 8));
    parts.push(blob(0.5, 0.5, 0.3, s * 5.6 - 0.6, 21.8, front(5.6, 21) - 1.4, 0xffffff, 0.6, 6, 4));
    parts.push(blob(1.6, 1.1, 0.8, s * 6.2, 24.6, front(6.2, 24.6) - 0.2, CREAM, 0, 8, 6));
    // the ears: pyramids leaning out a little, cream inside
    parts.push(G(new THREE.ConeGeometry(5, 11, 4), ORANGE, { ry: Math.PI / 4, rz: -s * 0.28, x: s * 8.2, y: 30.5, z: 0 }));
    parts.push(G(new THREE.ConeGeometry(3, 7.5, 4), CREAM, { ry: Math.PI / 4, rz: -s * 0.28, x: s * 7.9, y: 29.6, z: -1.6 }));
  }
  // the disco bulbs round the chassis: dull by day, every colour at night
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2, x = Math.sin(a) * 12.6, z = 2 - Math.cos(a) * 25;
    parts.push(blob(0.8, 0.8, 0.8, Math.max(-12.6, Math.min(12.6, x)), 6.4, Math.max(-22.6, Math.min(26.6, z)), new THREE.Color().setHSL(k / 18, 1, 0.6).getHex(), 1, 6, 4));
  }
  // the post the mirrorball turns on, on the back of the head
  const top = HC + HY * Math.sqrt(1 - ((12 - HZC) / HZ) ** 2);
  parts.push(rod(new THREE.Vector3(0, top - 1, 12), new THREE.Vector3(0, top + 4, 12), 0.5, 0.4, 0x8a90a8));
  group.add(glowMesh(parts));

  // the mirrorball: faceted silver (each facet catches the light its own way), faintly lit at night, turning
  const ball = glowMesh([G(new THREE.SphereGeometry(4.6, 14, 9), SILVER, {}, 0.35)], true);
  ball.position.set(0, top + 8.4, 12);
  group.add(ball);

  return critter(group, (t) => { ball.rotation.y = t * 1.3; }, top - 0.5);
}
