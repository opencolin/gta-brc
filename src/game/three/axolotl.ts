import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * The Axolotl (asked 2026-10-31): a pink axolotl on a low chassis, as its top-down drawing has it (artcars.ts axolotl): a wide flat head with small dark eyes on top
 * and a smile, three feathery gills fanning up and out on each side (hot pink, glowing at night), a long body with a fin along its back, four little legs splayed
 * out, and a flat tail that sways. Inside the drawing's footprint (39 x 62 ft). Two draw calls: the axolotl, and its tail (its own mesh so it can sway).
 */
const PINK = 0xf6a3c0, LIGHT = 0xfbd0de, GILL = 0xe0537f, HOT = 0xff4f9a, NAVY = 0x1b1f3b, DARK = 0x23252f;
/** The head: half-sizes and centre. */
const HX = 12, HY = 6.5, HZ = 9.5, HC = 11, HZC = -16.5;

export function axolotl(): Critter {
  const group = new THREE.Group();
  const parts: GlowPart[] = [
    // the chassis and the wheels (the drawing's at x ±12, z -10 and 14)
    G(new THREE.BoxGeometry(18, 2.6, 40), DARK, { y: 3.4, z: 0 }),
    ...tyres(11, [-10, 14], 3.2, 2.4),
    // a pink glow under the chassis at night
    G(new THREE.BoxGeometry(18.4, 0.5, 40.4), HOT, { y: 2.2 }, 1),
    // the body, a paler belly under it, the fin along the back
    blob(10, 6.2, 17, 0, 10, 2, PINK, 0.12, 20, 14),
    blob(8.6, 3, 14, 0, 6.6, 2, LIGHT, 0.08, 16, 8),
    blob(0.7, 2.6, 13, 0, 15.6, 5, LIGHT, 0.2, 8, 6),
    // the head, wide and flat
    blob(HX, HY, HZ, 0, HC, HZC, PINK, 0.12, 22, 14),
    // the smile: a dark curve low across the front
    G(new THREE.TorusGeometry(7, 0.4, 4, 18, Math.PI * 0.55), 0xc2416e, { rx: -Math.PI / 2 + 0.15, rz: Math.PI * 1.225, y: 8.6, z: HZC + 1.4 }),
  ];
  for (const s of [-1, 1]) {
    // the eyes, small and dark on top of the head, with a shine
    parts.push(blob(1.5, 1.5, 1.5, s * 5.6, 15.2, -21.8, NAVY, 0, 10, 8));
    parts.push(blob(0.45, 0.45, 0.45, s * 5.6 - 0.4, 16.3, -22.8, 0xffffff, 0.6, 6, 4));
    // the gills: three feathery stalks a side from behind the head, fanning up and out, each a tapering rod with tufts along it
    for (let k = 0; k < 3; k++) {
      const a = new THREE.Vector3(s * 9.5, 12 + k * 1.6, -15 + k * 2.6);
      const dir = new THREE.Vector3(s * 0.6, 1.05 - k * 0.38, -0.2 + k * 0.3).normalize(), len = 12.5 - k * 1.2;
      const b = a.clone().addScaledVector(dir, len), side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 0, 1)).normalize();
      parts.push(rod(a, b, 1, 0.4, GILL, 0.7));
      // the feathery filaments: pairs of short fronds either side of the stalk, longest in the middle, and a tuft at the tip
      for (let i = 1; i <= 7; i++) {
        const p = a.clone().addScaledVector(dir, (len * i) / 7.6), fl = 1.4 + 1.6 * Math.sin((Math.PI * i) / 8);
        for (const t of [-1, 1]) parts.push(rod(p, p.clone().addScaledVector(side, t * fl).addScaledVector(dir, 0.5), 0.45, 0.2, i % 2 ? HOT : GILL, 1, 4));
      }
      parts.push(blob(1.2, 1.2, 1.2, b.x, b.y, b.z, HOT, 1, 8, 6));
    }
    // the legs: short and splayed, with a pale hand
    for (const [z, out] of [[-6, 0.5], [12, 0.35]] as const) {
      parts.push(blob(2, 1.6, 3.6, s * 10.8, 5.8, z, PINK, 0.1, 10, 8, { rz: s * out }));
      parts.push(blob(1.8, 0.7, 1.8, s * 13.2, 4.2, z - 1.2, LIGHT, 0.1, 8, 6));
    }
  }
  group.add(glowMesh(parts));

  // the tail: flat and tall, a paler fin round it, swaying about where it leaves the body
  const tail = new THREE.Group(); tail.position.set(0, 10, 12);
  tail.add(glowMesh([blob(2.6, 5, 12, 0, 0, 9, PINK, 0.12, 12, 10), blob(0.8, 7, 12.5, 0, 0.4, 9.5, LIGHT, 0.25, 10, 8)]));
  group.add(tail);

  return critter(group, (t) => { tail.rotation.y = Math.sin(t * 3) * 0.28; }, 16.4);
}
