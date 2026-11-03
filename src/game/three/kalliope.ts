import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, type Critter, type GlowPart } from "./critters";

/**
 * Kalliope (asked 2026-11-02): the steampunk calliope on wheels, as its top-down drawing has it (artcars.ts kalliope): a maroon wagon trimmed in gold on four big
 * spoked wagon wheels, three rows of six brass pipes standing up from its deck like an organ's (tallest in the middle of each row, the rows rising toward the back),
 * a brass boiler at the back under a black smokestack that puffs steam, gold medallions down its flanks; at night a ring of coloured bulbs down both sides, the
 * pipes' mouths and the stack's crown glow like fire. Inside the drawing's footprint (33 x 61 ft). Two draw calls: the wagon, and the steam (its own mesh, rising
 * and swelling from the stack and starting again).
 */
const MAROON = 0x6b2433, GOLD = 0xe4c060, BRASS = 0xd9a441, DBRASS = 0x7a5410, STACK = 0x2a2d3c, WOOD = 0x4a2a1a, FIRE = 0xff7a1c;
/** The deck's height. */
const DY = 10.4;

export function kalliope(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the wagon: the maroon body, a gold rail along its foot, the deck's gold edge and maroon top, a dark underframe
    G(new THREE.BoxGeometry(20, 2, 56), 0x23252f, { y: 3.6 }),
    G(new THREE.BoxGeometry(22, 6.4, 58), MAROON, { y: 6.8 }),
    G(new THREE.BoxGeometry(22.4, 0.6, 58.4), GOLD, { y: 4 }),
    G(new THREE.BoxGeometry(26, 0.8, 60), GOLD, { y: DY - 0.4 }),
    G(new THREE.BoxGeometry(25, 0.84, 59), MAROON, { y: DY - 0.36 }),
    // the boiler, lying along the back of the deck, its bands, and the smokestack on it (the drawing's dark disc at z 22): flared at the crown
    G(new THREE.CylinderGeometry(3.6, 3.6, 13, 12), 0xb07a2a, { rx: Math.PI / 2, y: DY + 3.6, z: 21 }),
    ...[16, 21, 26].map((z) => G(new THREE.CylinderGeometry(3.85, 3.85, 0.6, 12), GOLD, { rx: Math.PI / 2, y: DY + 3.6, z })),
    G(new THREE.CylinderGeometry(2.2, 2.6, 10, 10), STACK, { y: DY + 11, z: 22 }),
    G(new THREE.CylinderGeometry(4, 2.2, 3.4, 10, 1, true), STACK, { y: DY + 17.4, z: 22 }),
    G(new THREE.TorusGeometry(3.9, 0.35, 4, 12), GOLD, { rx: Math.PI / 2, y: DY + 19.1, z: 22 }),
    G(new THREE.CircleGeometry(3.4, 10), FIRE, { rx: -Math.PI / 2, y: DY + 18.6, z: 22 }, 1.6),
    // a gauge and a whistle on the boiler's front
    G(new THREE.CylinderGeometry(1.2, 1.2, 0.5, 10), GOLD, { rx: Math.PI / 2, y: DY + 4, z: 14.3 }),
    rod(v(2.4, DY + 6.8, 17), v(2.4, DY + 10, 17), 0.5, 0.5, BRASS, 0, 6),
    // a little bench at the bow for the player
    G(new THREE.BoxGeometry(10, 2.4, 3), WOOD, { y: DY + 1.2, z: -26 }),
  ];
  // the pipes: three rows of six, as the drawing; each an open brass tube with a dark mouth on its face and a dark bore, tallest in the middle of the row
  for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) {
    const x = -10 + k * 4, z = -18 + row * 12, h = 6 + row * 2.5 + 5 * (1 - Math.abs(k - 2.5) / 2.5);
    parts.push(G(new THREE.CylinderGeometry(1.7, 1.7, h, 8, 1, true), BRASS, { x, y: DY + h / 2, z }));
    parts.push(G(new THREE.CircleGeometry(1.2, 8), DBRASS, { rx: -Math.PI / 2, x, y: DY + h - 0.6, z }, 0.9));
    parts.push(G(new THREE.BoxGeometry(1.6, 1.2, 0.3), 0x1a1012, { x, y: DY + 2.2, z: z - 1.65 }));
  }
  // the wagon wheels: a dark rim, spokes and a gold hub, at the drawing's x ±14, z ±20
  for (const z of [-20, 20]) for (const s of [-1, 1]) {
    const x = s * 14, y = 4.8;
    parts.push(G(new THREE.TorusGeometry(4.2, 0.55, 3, 12), 0x15161d, { ry: Math.PI / 2, x, y, z }));
    parts.push(G(new THREE.CylinderGeometry(0.9, 0.9, 2.4, 6), GOLD, { rz: Math.PI / 2, x, y, z }));
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI; parts.push(rod(v(x, y - Math.cos(a) * 4, z - Math.sin(a) * 4), v(x, y + Math.cos(a) * 4, z + Math.sin(a) * 4), 0.3, 0.3, WOOD, 0, 3)); }
  }
  // gold medallions down each flank, and the coloured bulbs along the deck's edge (the drawing's ten a side)
  for (const s of [-1, 1]) {
    for (const z of [-24, -8, 8]) parts.push(G(new THREE.CylinderGeometry(1.8, 1.8, 0.3, 10), GOLD, { rz: Math.PI / 2, x: s * 11.1, y: 6.8, z }));
    for (let k = 0; k < 10; k++) parts.push(G(new THREE.OctahedronGeometry(0.7), new THREE.Color().setHSL((k * 36) / 360, 1, 0.62).getHex(), { x: s * 12.4, y: DY + 0.6, z: -28 + k * 6 }, 1.2));
  }
  group.add(glowMesh(parts));

  // the steam: a cluster of puffs over the stack that rises, swells, drifts back and starts again
  const steam = new THREE.Group();
  steam.add(glowMesh([blob(2.6, 2.2, 2.6, 0, 0, 0, 0xf0f0f6, 0.25, 8, 6), blob(2, 1.8, 2, 1.8, 1.6, 1.2, 0xe6e6f0, 0.25, 8, 6), blob(1.8, 1.6, 1.8, -1.4, 2.6, 2, 0xf4f4fa, 0.25, 8, 6)]));
  group.add(steam);

  return critter(group, (t) => {
    const p = (t * 0.8) % 1, s = 0.3 + 1.4 * Math.sin(Math.PI * Math.min(1, p * 1.15));
    steam.position.set(Math.sin(t * 0.7) * 1.5, DY + 20 + p * 10, 22 + p * 7); steam.scale.setScalar(Math.max(0.01, s));
  }, DY + 0.4);
}
