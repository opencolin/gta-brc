import * as THREE from "three";
import { G, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * The Golden Gate art car (asked 2026-11-02): a little Golden Gate Bridge on wheels, as its top-down drawing has it (artcars.ts goldenGate): a dark roadway the
 * length of the car on an orange stiffening truss, two International Orange towers a third of the way in from each end (two stepped legs a side, joined by
 * portal beams), the main cables running from the anchorages at each end up over the tower tops and sagging between them, with suspender ropes down to the
 * deck; at night warm lamps down the middle of the road and the red aircraft lights on the tower tops. Inside the drawing's footprint (31 x 64 ft). One draw
 * call: nothing on a bridge moves.
 */
const ORANGE = 0xc0362c, LIGHT = 0xe0523f, ROAD = 0x3c414f, UNDER = 0x2e323d, CONCRETE = 0x9a968c;
/** The roadway's top, the towers' z, the cables' x, the tower tops' height and the cables' lowest point. */
const DY = 6.6, TZ = 17, CX = 10.5, TOP = 33, SAG = DY + 4;

export function goldenGate(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    ...tyres(13, [-20, 20], 3.4, 2.6),
    // the underframe, the roadway and its two side girders in orange, a curb either side
    G(new THREE.BoxGeometry(16, 2.6, 60), UNDER, { y: 4.4 }),
    G(new THREE.BoxGeometry(18, 0.6, 64), ROAD, { y: DY - 0.3 }),
    ...[-1, 1].map((s) => G(new THREE.BoxGeometry(0.8, 3, 64), ORANGE, { x: s * 9.2, y: DY - 1.6 })),
    ...[-1, 1].map((s) => G(new THREE.BoxGeometry(0.5, 1, 64), LIGHT, { x: s * 8.6, y: DY + 0.5 })),
    // the anchorages at each end, where the cables come down
    ...[-1, 1].flatMap((e) => [-1, 1].map((s) => G(new THREE.BoxGeometry(3, 2.4, 2.4), CONCRETE, { x: s * CX, y: DY + 1.2, z: e * 30.6 }))),
  ];
  // the truss down each side: an X in every bay
  for (const s of [-1, 1]) for (let z = -28; z < 28; z += 8) {
    for (const d of [-1, 1]) parts.push(rod(v(s * 9.4, DY - 3, z + (d < 0 ? 0 : 8)), v(s * 9.4, DY - 0.2, z + (d < 0 ? 8 : 0)), 0.22, 0.22, ORANGE, 0, 3));
  }
  // the towers: two stepped legs a side, the portal beams between them, a lamp on each top
  for (const e of [-1, 1]) {
    const z = e * TZ;
    for (const s of [-1, 1]) {
      parts.push(G(new THREE.BoxGeometry(3, 10, 5), ORANGE, { x: s * CX, y: DY + 5, z }));
      parts.push(G(new THREE.BoxGeometry(2.6, 9, 4.4), ORANGE, { x: s * CX, y: DY + 14.5, z }));
      parts.push(G(new THREE.BoxGeometry(2.2, 8, 3.8), ORANGE, { x: s * CX, y: DY + 23, z }));
      parts.push(G(new THREE.BoxGeometry(2.6, 0.8, 4.2), LIGHT, { x: s * CX, y: TOP + 0.4, z }));
      parts.push(G(new THREE.OctahedronGeometry(0.6), 0xff2a2a, { x: s * CX, y: TOP + 1.4, z }, 1.6));
    }
    for (const [y, h] of [[DY + 10.5, 1.6], [DY + 18.5, 1.6], [DY + 25.5, 1.4]] as const) parts.push(G(new THREE.BoxGeometry(2 * CX, h, 3), ORANGE, { y, z }));
    // the tower faces' recessed panels, darker
    for (const s of [-1, 1]) for (const y of [DY + 6, DY + 14, DY + 22]) parts.push(G(new THREE.BoxGeometry(1.4, 4.2, 0.2), 0x8e2820, { x: s * CX, y, z: z + e * (y < DY + 10 ? 2.55 : y < DY + 19 ? 2.25 : 1.95) }));
  }
  // the main cables: up from the anchorages to the tower tops, sagging between; the suspenders down to the deck
  const cable = (z: number) => Math.abs(z) <= TZ ? SAG + (TOP - SAG) * (z / TZ) ** 2 : TOP - (TOP - DY - 2.4) * ((Math.abs(z) - TZ) / (30.6 - TZ)) ** 0.9;
  const zs = [-30.6, -26, -21.5, -17, -13, -9, -5, 0, 5, 9, 13, 17, 21.5, 26, 30.6];
  for (const s of [-1, 1]) {
    for (let i = 0; i < zs.length - 1; i++) parts.push(rod(v(s * CX, cable(zs[i]), zs[i]), v(s * CX, cable(zs[i + 1]), zs[i + 1]), 0.45, 0.45, LIGHT, 0, 4));
    for (let z = -28.5; z <= 28.5; z += 3) if (Math.abs(Math.abs(z) - TZ) > 1.5) parts.push(rod(v(s * CX, cable(z) - 0.2, z), v(s * 9.4, DY, z), 0.12, 0.12, ORANGE, 0, 3));
  }
  // the lane lines, and the lamps down the middle of the road (the drawing's warm dots every 5 ft), lit at night
  for (let z = -30; z <= 30; z += 5) {
    if (z < 30) parts.push(G(new THREE.BoxGeometry(0.4, 0.06, 2.4), 0xe8d9a0, { x: s3(z), y: DY + 0.03, z: z + 2.5 }));
    parts.push(G(new THREE.OctahedronGeometry(0.7), 0xffd27a, { y: DY + 0.6, z }, 1.4));
  }
  group.add(glowMesh(parts));
  return critter(group, () => {}, DY);
}
/** The dashed lines either side of the lamps. */
const s3 = (z: number) => (Math.round(z / 5) % 2 ? 3.5 : -3.5);
