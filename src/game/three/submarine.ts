import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * The Lonely Submarine (asked 2026-11-02): the yellow submarine on wheels, as its top-down drawing has it (artcars.ts submarine): a long yellow hull, rounded at both
 * ends, a darker yellow conning tower amidships with a rail round its top, the periscope rising from the tower's front and looking ahead, round portholes with brass
 * rims along both sides (the drawing's four, two forward and two aft), the diving planes and the cross of tail fins at the back, and the propeller behind them, which
 * turns. At night the portholes glow a pale sea blue and a lamp on the periscope lights up. Inside the drawing's footprint (29 x 67 ft). Two draw calls: the
 * submarine, and the propeller (its own mesh so it can turn).
 */
const YELLOW = 0xf5c518, DEEP = 0xe3b210, EDGE = 0xc79a0c, BRASS = 0xa07c08, STEEL = 0x7a8296, PROP = 0x8a6a10, DARK = 0x23252f, GLASS = 0x5b8fa8;
/** The hull: half-sizes and centre (the drawing's ellipse, 12 x 30). */
const HX = 12, HY = 9.5, HZ = 30, HC = 13;
/** The hull's half-width at height y and position z (to put things on its side). */
const sideAt = (y: number, z: number) => HX * Math.sqrt(Math.max(0, 1 - ((y - HC) / HY) ** 2 - (z / HZ) ** 2));

export function submarine(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const top = HC + HY;
  const parts: GlowPart[] = [
    // the cradle it rides in and the wheels (the drawing's at x ±12, z ±16)
    G(new THREE.BoxGeometry(14, 2.4, 44), DARK, { y: 2.6 }),
    G(new THREE.BoxGeometry(2, 3, 40), DARK, { x: -5, y: 4.4 }), G(new THREE.BoxGeometry(2, 3, 40), DARK, { x: 5, y: 4.4 }),
    ...tyres(11.6, [-16, 16], 3.2, 2.4),
    // the hull, and a darker band along its middle where the plates meet
    blob(HX, HY, HZ, 0, HC, 0, YELLOW, 0.05, 20, 14),
    // the conning tower, the drawing's rounded 12 x 16 (z -10 to 6), with its rail and a hatch
    G(new THREE.CylinderGeometry(1, 1, 8, 16), DEEP, { sx: 5.6, sz: 8, y: top + 1.5, z: -2 }),
    G(new THREE.TorusGeometry(1, 0.05, 3, 16), BRASS, { rx: Math.PI / 2, sx: 5.8, sy: 8.2, y: top + 6.3, z: -2 }),
    G(new THREE.CylinderGeometry(2, 2, 0.4, 10), EDGE, { y: top + 5.7, z: 1 }),
    // the periscope: from the tower's front up, then its head looking ahead, a lamp on it
    rod(v(0, top + 4, -8), v(0, top + 12, -8), 0.8, 0.8, STEEL),
    G(new THREE.BoxGeometry(1.8, 1.8, 4.4), STEEL, { y: top + 12.6, z: -9.6 }),
    G(new THREE.CircleGeometry(0.75, 8), 0xb8f2ff, { ry: Math.PI, y: top + 12.6, z: -11.85 }, 1.4),
  ];
  // the portholes: the drawing's four (z -22, -15, 10, 17), on both sides, brass rims round glass that glows at night; one more pair high in the tower
  for (const s of [-1, 1]) {
    for (const z of [-22, -15, 10, 17]) {
      const y = HC + 1.5, x = sideAt(y, z), n = new THREE.Vector3(x / HX ** 2, (y - HC) / HY ** 2, z / HZ ** 2).normalize(), ry = Math.atan2(s * n.x, n.z);
      const at = (d: number) => ({ x: s * (x + n.x * d), y: y + n.y * d, z: z + n.z * d, ry });
      parts.push(G(new THREE.TorusGeometry(2.3, 0.45, 4, 10), BRASS, at(0.1)));
      parts.push(G(new THREE.CircleGeometry(2.1, 10), GLASS, at(0.05), 1.3));
    }
    // the diving planes forward and the tail's planes aft
    parts.push(G(new THREE.BoxGeometry(5, 0.5, 3.4), DEEP, { x: s * (sideAt(HC, -20) + 2), y: HC, z: -20 }));
    parts.push(G(new THREE.BoxGeometry(8, 0.5, 4.5), DEEP, { x: s * 5, y: HC, z: 27 }));
  }
  // the tail's upright fin, over and under
  parts.push(G(new THREE.BoxGeometry(0.5, 15, 4.5), DEEP, { y: HC, z: 27 }));
  // the propeller's shaft
  parts.push(rod(v(0, HC, 28), v(0, HC, 31.5), 0.6, 0.5, STEEL));
  group.add(glowMesh(parts));

  // the propeller: three brass blades round a hub, at the drawing's (0, 31), turning
  const prop = new THREE.Group(); prop.position.set(0, HC, 31.5);
  const blades: GlowPart[] = [blob(1.1, 1.1, 1.3, 0, 0, 0, PROP, 0, 6, 4)];
  for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; blades.push(blob(1.6, 3.6, 0.35, Math.sin(a) * 3.4, Math.cos(a) * 3.4, 0, PROP, 0, 6, 5, { rz: -a, ry: 0.5 })); }
  prop.add(glowMesh(blades));
  group.add(prop);

  return critter(group, (t) => { prop.rotation.z = t * 6; }, top + 6.2);
}
