import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * BAAAHS (asked 2026-11-02): the giant fluffy sheep, as its top-down drawing has it (artcars.ts baaahs): a great round fleece of woolly puffs where the drawing has
 * its 26 discs, on four short black legs over a dark chassis, a stubby woolly tail at the back, and at the front the black face with its floppy black ears, white
 * eyes and a tuft of wool on its brow. The fleece is LEDs: pale pastel wool by day, every colour at night, the eyes lit. Inside the drawing's footprint (37.5 x 67 ft).
 * Two draw calls: the sheep, and its head (its own mesh so it can nod and look about).
 */
const WOOL = 0xf4f1ea, FACE = 0x26232a, DARK = 0x23252f;

export function baaahs(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    G(new THREE.BoxGeometry(20, 2.6, 48), DARK, { y: 4, z: 2 }),
    ...tyres(13, [-16, 18], 3.4, 2.6),
    // the fleece's core, under the puffs
    blob(14.5, 8.5, 25, 0, 15, 4, WOOL, 0.3, 12, 7),
    // the tail
    blob(3, 3, 3, 0, 15, 31.5, WOOL, 0.5, 8, 6),
  ];
  // the legs: short and black, little hooves
  for (const s of [-1, 1]) for (const z of [-12, 20]) {
    parts.push(rod(v(s * 8, 0, z), v(s * 8, 9, z), 1.7, 2, FACE, 0, 6));
  }
  // the wool: a puff where each of the drawing's discs is, lying on the fleece, each tinted a little (its LED's colour, lit at night)
  for (let k = 0; k < 26; k++) {
    const a = k * 2.4, r = 6 + (k % 5) * 2.4, x = Math.cos(a) * r * 0.9, z = 4 + Math.sin(a) * r * 1.6;
    const u = Math.min(0.96, (x / 14.5) ** 2 + ((z - 4) / 25) ** 2), y = 15 + 8.5 * Math.sqrt(1 - u);
    if (z < -20) continue;   // the face is there
    const c = new THREE.Color().setHSL(((k * 37) % 360) / 360, 0.55, 0.86).getHex();
    parts.push(blob(6, 4.6, 6, x * 1.02, y - 1.2, z, c, 0.75, 6, 5));
  }
  group.add(glowMesh(parts));

  // the head, built about the neck so it nods: the black face reaching to the drawing's nose, the brow tuft, the ears out to the sides, the eyes
  const h: GlowPart[] = [
    blob(5.6, 6, 7.4, 0, 0.6, -6.4, FACE, 0, 10, 7, { rx: 0.35 }),
    blob(3.6, 3.4, 3.6, 0, -1.8, -11.2, FACE, 0, 8, 5),
    blob(4.4, 3, 3.6, 0, 5.6, -5, WOOL, 0.6, 8, 5),
    G(new THREE.BoxGeometry(2.4, 0.3, 0.3), 0x8a2e44, { y: -3, z: -14.6 }),
  ];
  for (const s of [-1, 1]) {
    h.push(blob(4.2, 1, 1.9, s * 6.8, 2.2, -4, FACE, 0, 8, 6, { rz: -s * 0.45 }));
    h.push(blob(1.2, 1.2, 0.8, s * 2.5, 3, -11.6, WOOL, 1.4, 6, 5));
    h.push(blob(0.55, 0.6, 0.4, s * 2.5, 2.9, -12.3, FACE, 0, 6, 4));
  }
  const head = new THREE.Group(); head.position.set(0, 18, -17.5);
  head.add(glowMesh(h));
  group.add(head);

  return critter(group, (t) => { head.rotation.x = Math.sin(t * 1.1) * 0.08; head.rotation.y = Math.sin(t * 0.55) * 0.22; }, 24);
}
