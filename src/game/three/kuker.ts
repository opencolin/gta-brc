import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Kuker (asked 2026-10-31): a Bulgarian kuker, the ritual dancer in goat fur, standing tall on a wooden boat on wheels, as its top-down drawing has it (artplatforms.ts
 * kuker: the boat's hull and deck, the fur in black and cream, the red at the bow). The dancer is three tiers of long shaggy strands, black and cream, over a dark core,
 * a belt of big brass bells at the waist, and the mask: a red face with white eyes, a long nose and a toothy mouth in a black fur hood, two great ivory horns curling up and
 * out, coloured pompoms between them. The boat carries a red prow at the bow and warm lights along its rim that come on at night. The dancer sways and turns. Inside the
 * drawing's footprint (26 x 62 ft); the dancer stands toward the bow and the deck behind it is where a ride stands. Two draw calls: the boat, and the dancer (its own mesh so it can sway).
 */
const HULL = 0x3b2316, DECK = 0x6b4226, BLACK = 0x2b2b2b, CREAM = 0xd9d0c1, RED = 0xc0392b, BRASS = 0xc9a227, IVORY = 0xe8dcc0, NAVY = 0x1b1f3b;
/** The deck's height and where along the boat the dancer stands: forward, like a figurehead, so a ride on the deck behind has it in view rather than inside it. */
const DY = 7.6, FZ = -12.5;
const hash = (k: number) => { const s = Math.sin(k * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** The drawing's boat outline (x across, z along, bow at -34), scaled by k about its middle: as a shape for an extrusion laid flat. */
function boatShape(k: number): THREE.Shape {
  const p = (x: number, z: number) => [x * k, -(z * k + (1 - k) * -3)] as const;   // shrink toward z = -3, the outline's middle
  const s = new THREE.Shape(); s.moveTo(...p(0, -34));
  s.quadraticCurveTo(...p(15, -18), ...p(13, 26)); s.quadraticCurveTo(...p(0, 31), ...p(-13, 26)); s.quadraticCurveTo(...p(-15, -18), ...p(0, -34));
  return s;
}
const slab = (k: number, depth: number, y: number) => new THREE.ExtrudeGeometry(boatShape(k), { depth, bevelEnabled: false, curveSegments: 14 }).rotateX(-Math.PI / 2).translate(0, y, 0);

export function kuker(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  // ── the boat: hull, deck, planks, the prow, the rim's lights, the wheels (the drawing's at x ±11, z -6 and 20)
  const boat: GlowPart[] = [
    { geo: slab(1, DY - 2.4, 2.4), color: HULL, glow: 0 },
    { geo: slab(0.86, 0.25, DY), color: DECK, glow: 0 },
    ...tyres(11, [-6, 20], 3.2, 2.6),
    // the red prow: a carved post at the bow with a red triangle flag, as the drawing's red at the bow
    rod(v(0, DY, -29), v(0, DY + 9, -30.5), 0.7, 0.5, HULL),
    G(new THREE.ConeGeometry(2.6, 6, 3), RED, { rx: Math.PI / 2, rz: Math.PI / 2, x: 0, y: DY + 7.5, z: -27.8 }, 0.3),
  ];
  for (let z = -22; z <= 22; z += 4) boat.push(G(new THREE.BoxGeometry(18, 0.06, 0.25), 0x4a2c18, { y: DY + 0.27, z }));
  // warm bulbs round the rim
  for (const q of boatShape(0.97).getSpacedPoints(26).slice(0, 26)) boat.push(blob(0.55, 0.55, 0.55, q.x, DY + 0.1, -q.y, 0xffd27a, 1, 6, 4));
  group.add(glowMesh(boat));

  // ── the dancer, built about the foot of its middle so it sways from the deck
  const d: GlowPart[] = [G(new THREE.ConeGeometry(7.2, 25, 12), BLACK, { y: 12.5 })];
  // three tiers of fur strands, black and cream as the drawing, each tapering to a tuft at the bottom, a little uneven
  const tier = (n: number, r0: number, y0: number, r1: number, y1: number, seed: number) => {
    for (let k = 0; k < n; k++) {
      const a = ((k + 0.4 * hash(seed + k)) / n) * Math.PI * 2, j = 0.9 + 0.2 * hash(seed + k + 50), c = Math.cos(a), s = Math.sin(a);
      d.push(rod(v(s * r0, y0, c * r0), v(s * r1 * j, y1 - 1.5 * hash(seed + k + 99), c * r1 * j), 0.5, 1.7, k % 2 ? CREAM : BLACK, 0, 5));
    }
  };
  tier(24, 5.6, 13.5, 8.2, 0.4, 1); tier(20, 4, 21, 7.2, 9.5, 2); tier(14, 2.4, 26, 5.8, 18, 3);
  // the belt and its bells, brass, catching a little light at night
  d.push(G(new THREE.TorusGeometry(6.6, 0.6, 5, 24), 0x4a2c18, { rx: Math.PI / 2, y: 11.6 }));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.3, x = Math.sin(a) * 7.6, z = Math.cos(a) * 7.6;
    d.push(G(new THREE.CylinderGeometry(0.9, 2, 2.8, 8), BRASS, { x, y: 9.6, z }, 0.35));
    d.push(blob(0.55, 0.55, 0.55, x, 8, z, 0x6e5a1e, 0, 6, 4));
  }
  // the mask: a black fur hood, the red face, white eyes with dark pupils, a long red nose, a dark mouth full of teeth
  const HY = 28.5;
  d.push(blob(5.6, 6.2, 5.4, 0, HY, 0, BLACK, 0, 14, 10));
  d.push(blob(4.4, 5, 2, 0, HY - 0.4, -4.4, RED, 0.15, 14, 10));
  for (const s of [-1, 1]) { d.push(blob(1.15, 1.15, 0.8, s * 1.8, HY + 1.4, -6.1, 0xffffff, 0.9, 10, 8)); d.push(blob(0.5, 0.5, 0.4, s * 1.8, HY + 1.3, -6.85, NAVY, 0, 6, 4)); }
  d.push(G(new THREE.ConeGeometry(0.9, 3, 8), RED, { rx: -Math.PI / 2, y: HY - 0.4, z: -7.6 }, 0.15));
  d.push(G(new THREE.BoxGeometry(4.2, 1.3, 0.6), 0x1a1012, { y: HY - 3, z: -6.2 }));
  for (let k = 0; k < 5; k++) d.push(G(new THREE.BoxGeometry(0.55, 0.6, 0.3), 0xf4efe0, { x: -1.6 + k * 0.8, y: HY - 2.5, z: -6.55 }));
  // the horns: three tapering pieces a side, out, up and curling forward
  for (const s of [-1, 1]) {
    const p = [v(s * 3.4, HY + 3.6, 0), v(s * 7.6, HY + 6.2, 0.6), v(s * 8.8, HY + 10.6, 0), v(s * 7.2, HY + 13.8, -1.4)], r = [1.6, 1.15, 0.7, 0.15];
    for (let i = 0; i < 3; i++) d.push(rod(p[i], p[i + 1], r[i], r[i + 1], IVORY, 0, 8));
  }
  // pompoms between the horns
  [0xc0392b, 0xf1c40f, 0x2ecc71, 0x3498db, 0xe67e22].forEach((c, k) => d.push(blob(0.9, 0.9, 0.9, -2.4 + k * 1.2, HY + 6 + (k % 2) * 0.6, -0.6, c, 0.3, 8, 6)));

  const dancer = new THREE.Group(); dancer.position.set(0, DY, FZ);
  dancer.add(glowMesh(d));
  group.add(dancer);

  // the dance: a sway from side to side, a slow turn back and forth to face the crowd and back
  return critter(group, (t) => { dancer.rotation.z = Math.sin(t * 2.4) * 0.05; dancer.rotation.y = Math.sin(t * 0.9) * 0.35; }, DY + 0.3);
}
