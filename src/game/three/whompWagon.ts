import * as THREE from "three";
import { G, blob, critter, glowMesh, tyres, type Critter, type GlowPart } from "./critters";

/**
 * The Whomp Wagon (asked 2026-11-02): a truck carrying a wall of speakers, as its top-down drawing has it (artcars.ts whompWagon): a slate cab with its windscreen
 * at the front, and behind it a tall black cabinet the length of the bed, eight big cones looking up out of its top in two columns of four (the drawing's), and more
 * cones in its sides and back so it reads as a speaker stack from the road; each cone has a ring that is its row's colour and lights at night, and the cones pump
 * with the beat (harder at night). On six wheels (the drawing's at x ±14, z -22, 2 and 22). Inside its measured box (33 x 62 ft). Two draw calls: the truck, and the
 * cones' dishes (their own mesh, scaled about the cabinet's middle so every cone pushes out at once).
 */
const SLATE = 0x3a3f52, GLASS = 0x9fc7ff, BLACK = 0x16182a, SURROUND = 0x3d4258, DISH = 0x5a607a, DARK = 0x23252f, CHROME = 0xb8bfd0;
/** The cabinet: x ±CX, from y C0 to C1, z Z0 to Z1; its middle, which the dishes pump about. */
const CX = 13.6, C0 = 7.2, C1 = 19, Z0 = -17, Z1 = 30.6, MID = new THREE.Vector3(0, (C0 + C1) / 2, (Z0 + Z1) / 2);
/** Each row's light, as the drawing's hues at night (row * 70). */
const ROW = [0, 70, 140, 210].map((h) => new THREE.Color().setHSL(h / 360, 0.9, 0.55).getHex());

/** A cone facing `n` out of a cabinet face at p: the surround and the lit ring on the face (static), the dish and its dust cap set into it (pumping). */
function cone(p: THREE.Vector3, n: THREE.Vector3, r: number, ring: number, seg: number, still: GlowPart[], pump: GlowPart[]) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const put = (geo: THREE.BufferGeometry, lift: number) => geo.applyQuaternion(q).translate(p.x + n.x * lift, p.y + n.y * lift, p.z + n.z * lift);
  still.push({ geo: put(new THREE.CircleGeometry(r * 1.55, seg).rotateX(-Math.PI / 2), 0.04), color: SURROUND, glow: 0 });
  still.push({ geo: put(new THREE.RingGeometry(r * 1.02, r * 1.22, seg).rotateX(-Math.PI / 2), 0.08), color: ring, glow: 1 });
  // the dish: an open cone, its point sunk into the cabinet
  pump.push({ geo: put(new THREE.ConeGeometry(r, r * 0.55, seg, 1, true).rotateX(Math.PI), 0.06 - r * 0.275), color: DISH, glow: 0.25 });
  pump.push({ geo: put(new THREE.CircleGeometry(r * 0.38, 8).rotateX(-Math.PI / 2), 0.1 - r * 0.3), color: BLACK, glow: 0 });
}

export function whompWagon(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the chassis and the six wheels
    G(new THREE.BoxGeometry(20, 3, 60), DARK, { y: 4.6, z: 0 }),
    ...tyres(14, [-22, 2, 22], 3.5, 2.6),
    // the cab: its body, the hood before it, the windscreen sloping down to the hood, side windows, the grille, the bumper and the headlights
    G(new THREE.BoxGeometry(26, 9, 9), SLATE, { y: 7.5, z: -23.5 }),
    G(new THREE.BoxGeometry(25, 4.6, 3.6), SLATE, { y: 5.3, z: -29.2 }),
    G(new THREE.PlaneGeometry(22, 5.4), GLASS, { rx: 0.59, y: 9.8, z: -29.4 }, 0.35),
    G(new THREE.BoxGeometry(26.1, 3.2, 5), GLASS, { y: 9.6, z: -23.4 }, 0.35),
    G(new THREE.BoxGeometry(14, 3, 0.3), 0x22252f, { y: 5.4, z: -30.8 }),
    G(new THREE.BoxGeometry(26, 1.2, 0.8), CHROME, { y: 3.2, z: -30.55 }),
    G(new THREE.BoxGeometry(24, 0.6, 1.2), 0xff4f9a, { y: 12.3, z: -24 }, 1),
    // the cabinet, black, with a lit strip along its top edges
    G(new THREE.BoxGeometry(CX * 2, C1 - C0, Z1 - Z0), BLACK, { y: (C0 + C1) / 2, z: (Z0 + Z1) / 2 }),
  ];
  for (const s of [-1, 1]) {
    parts.push(blob(1.3, 1.1, 0.5, s * 10, 6, -30.45, 0xfff3c4, 1, 8, 6));
    parts.push(G(new THREE.BoxGeometry(0.5, 0.5, Z1 - Z0), 0x7a5cff, { x: s * (CX - 0.1), y: C1 + 0.05, z: (Z0 + Z1) / 2 }, 1));
  }
  parts.push(G(new THREE.BoxGeometry(CX * 2, 0.5, 0.5), 0x7a5cff, { y: C1 + 0.05, z: Z1 - 0.1 }, 1));

  const pump: GlowPart[] = [];
  // the eight cones in the top, as the drawing: x ±7, rows at z -10, 1, 12, 23
  for (let row = 0; row < 4; row++) for (const x of [-7, 7]) cone(v(x, C1, -10 + row * 11), v(0, 1, 0), 3.1, ROW[row], 12, parts, pump);
  // the sides: two rows of four a side, level with the top's rows
  for (const s of [-1, 1]) for (let row = 0; row < 4; row++) for (const y of [10.4, 15.6]) cone(v(s * CX, y, -10 + row * 11), v(s, 0, 0), 1.45, ROW[row], 10, parts, pump);
  // the back: four
  for (const x of [-6.5, 6.5]) for (const y of [10.4, 15.6]) cone(v(x, y, Z1), v(0, 0, 1), 1.45, ROW[3], 10, parts, pump);
  group.add(glowMesh(parts));

  // the dishes, about the cabinet's middle so a scale pushes every one outward from its face
  const dishes = glowMesh(pump.map((p) => ({ ...p, geo: p.geo.translate(-MID.x, -MID.y, -MID.z) })));
  dishes.position.copy(MID);
  group.add(dishes);

  return critter(group, (t, night) => { dishes.scale.setScalar(1 + (0.008 + 0.018 * night) * Math.max(0, Math.sin(t * 9))); }, C1);
}
