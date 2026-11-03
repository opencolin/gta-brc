import * as THREE from "three";
import { G, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Titanic's End (asked 2026-11-02): the liner with its four funnels and the iceberg it has rammed, as its top-down drawing has it (artcars.ts titanicsEnd): a black hull
 * pointed at the bow and square at the stern, red below the waterline and a white line along its top, a row of portholes down each side; the white deck, on it the
 * superstructure, white with dark windows and a tan roof, and the four buff funnels with black tops, raked back as the ship's were; a mast at each end with a string
 * of lights between them; and at the bow the iceberg, white and pale blue, faceted. At night the portholes glow warm, the drawing's rainbow lights run along the rails,
 * the lights on the string come on and the iceberg glows faintly. Inside the drawing's footprint (33 x 72 ft, the iceberg ahead of the bow). One draw call.
 */
const HULL = 0x1e2233, RED = 0x8c2a22, WHITE = 0xf0ece2, TAN = 0xc7a46b, BUFF = 0xe0a33a, BLACK = 0x15161d, ICE = 0xeef6fb, ICE2 = 0xa9d3e8, GLASS = 0x33384f;
/** The deck's height and the superstructure's roof. */
const DECK = 11, TOP = 17;

/** An outline of the drawing's (bow at -z, stern square) as a shape for an extrusion laid flat, scaled about its middle by k. */
function outline(bow: number, sx: number, stern: number, k = 1): THREE.Shape {
  const p = (x: number, z: number) => [x * k, -(z * k + (1 - k) * 0)] as const;
  const s = new THREE.Shape(); s.moveTo(...p(0, bow));
  s.quadraticCurveTo(...p(sx * 1.08, -18), ...p(sx, stern)); s.lineTo(...p(-sx, stern)); s.quadraticCurveTo(...p(-sx * 1.08, -18), ...p(0, bow));
  return s;
}
/** Where the hull's side is (its half-width) at z: sampled along the outline's curve. */
function sideAt(z: number): number {
  let best = 0, d = Infinity;
  for (let i = 0; i <= 60; i++) {
    const t = i / 60, bz = (1 - t) ** 2 * -32 + 2 * (1 - t) * t * -18 + t * t * 30, bx = 2 * (1 - t) * t * 13 * 1.08 + t * t * 13;
    if (Math.abs(bz - z) < d) { d = Math.abs(bz - z); best = bx; }
  }
  return best;
}
const slab = (shape: THREE.Shape, depth: number, y: number) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 10 }).rotateX(-Math.PI / 2).translate(0, y, 0);

export function titanicsEnd(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the chassis and the wheels (the drawing's at x ±14, z ±18)
    G(new THREE.BoxGeometry(20, 2, 50), 0x23252f, { y: 2.2 }),
    ...tyres(12.6, [-18, 18], 3.2, 2.4),
    // the hull: red below the waterline, black above, a white line along the top; the drawing's outline (bow at -32, stern 26 wide at 30)
    { geo: slab(outline(-32, 13, 30, 0.985), 2.2, 2.6), color: RED, glow: 0 },
    { geo: slab(outline(-32, 13, 30), DECK - 4.8, 4.8), color: HULL, glow: 0 },
    { geo: slab(outline(-32, 13, 30, 1.005), 0.5, DECK - 0.9), color: WHITE, glow: 0 },
    // the deck, the drawing's white (bow at -26, 19 wide at 27)
    { geo: slab(outline(-26, 9.5, 27), 0.3, DECK), color: WHITE, glow: 0 },
    // the superstructure, the drawing's tan (x ±9.5, z -6 to 24), with its tan roof and a smaller bridge deck at its front
    G(new THREE.BoxGeometry(19, TOP - DECK, 30), WHITE, { y: (DECK + TOP) / 2, z: 9 }),
    G(new THREE.BoxGeometry(19.6, 0.4, 30.6), TAN, { y: TOP + 0.2, z: 9 }),
    G(new THREE.BoxGeometry(15, 2.6, 4), WHITE, { y: DECK + 1.3, z: -8 }),
  ];
  // the superstructure's windows, two rows a side, and the bridge's across the front
  for (const s of [-1, 1]) for (const y of [DECK + 1.8, DECK + 4.4]) parts.push(G(new THREE.BoxGeometry(0.2, 1, 27), GLASS, { x: s * 9.55, y, z: 9 }, 0.5));
  parts.push(G(new THREE.BoxGeometry(16, 1.2, 0.2), GLASS, { y: DECK + 4, z: -6.1 }, 0.5));
  // the portholes: warm at night, a row down each side of the hull
  for (const s of [-1, 1]) for (let z = -20; z <= 28; z += 3) {
    const half = sideAt(z);
    parts.push(G(new THREE.BoxGeometry(0.2, 0.9, 0.9), 0xffe2a0, { x: s * (half + 0.02), y: 8, z }, 1));
  }
  // the four funnels (the drawing's at z -2, 5, 12, 19), buff with black tops, raked back
  for (let k = 0; k < 4; k++) {
    const z = -2 + k * 7;
    parts.push(G(new THREE.CylinderGeometry(2.7, 3, 10, 12), BUFF, { sx: 0.8, rx: 0.14, y: TOP + 5, z }));
    parts.push(G(new THREE.CylinderGeometry(2.75, 2.75, 2.4, 12), BLACK, { sx: 0.8, rx: 0.14, y: TOP + 10.6, z: z + 1.47 }));
  }
  // the masts at bow and stern, and the string of lights between them over the funnels
  const fore = v(0, DECK + 22, -21), aft = v(0, DECK + 20, 26);
  parts.push(rod(v(0, DECK, -21), fore, 0.5, 0.3, 0x8a7a5a), rod(v(0, TOP, 26), aft, 0.5, 0.3, 0x8a7a5a));
  parts.push(rod(fore, aft, 0.08, 0.08, 0x444444));
  for (let i = 1; i < 12; i++) { const p = fore.clone().lerp(aft, i / 12); p.y -= Math.sin((Math.PI * i) / 12) * 1.5; parts.push(G(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.Color().setHSL(i / 12, 1, 0.65).getHex(), { x: p.x, y: p.y, z: p.z }, 1)); }
  // the drawing's rainbow lights along the rails
  for (const s of [-1, 1]) for (let z = -16, i = 0; z < 26; z += 4, i++) parts.push(G(new THREE.BoxGeometry(0.9, 0.9, 0.9), new THREE.Color().setHSL(i / 11, 1, 0.65).getHex(), { x: s * 11.2, y: DECK + 0.8, z }, 1));
  // the iceberg at the bow, the drawing's shard (x -12 to 9, z -42 to -27): faceted lumps of ice, a pale blue face on its far side
  const ice = (sx: number, sy: number, sz: number, x: number, y: number, z: number, r: number, c: number) => parts.push(G(new THREE.IcosahedronGeometry(1, 0), c, { sx, sy, sz, ry: r, rx: r * 0.4, x, y, z }, 0.45));
  ice(7, 10, 5.5, -3, 7, -34, 0.3, ICE);
  ice(5, 14, 4, -1.5, 9, -36.5, 1.1, ICE);
  ice(4.5, 7, 3.5, 4, 5, -36, 0.7, ICE2);
  ice(4, 5, 3, -8, 3.5, -31, 1.7, ICE);
  ice(3, 4, 2.5, 6, 2.5, -31.5, 2.3, ICE2);
  group.add(glowMesh(parts));

  return critter(group, () => {}, TOP + 0.4);
}
