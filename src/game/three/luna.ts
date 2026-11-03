import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, type Critter, type GlowPart } from "./critters";

/**
 * Luna the Art Crane (asked 2026-11-02): a crawler crane carrying the moon, as its top-down drawing has it (artcars.ts lunaCrane): two dark crawler tracks either
 * side, the orange house between them with its dark cab window forward on the left, a counterweight at the back and the A-frame gantry over it, and the long orange
 * lattice boom raised forward with pendant lines from the gantry to its head; from the boom's head the moon hangs on its cable, cream with grey craters, glowing at
 * night, warm lamps along the boom. The boom slews gently from side to side, the moon swinging with it (only as far as keeps it inside the drawing's 28 ft width).
 * Inside the drawing's footprint (28 x 75 ft, 55 ahead of the centre where the moon hangs). Two draw calls: the crane, and the boom with the moon (its own mesh so it can slew).
 */
const ORANGE = 0xf2a516, DEEP = 0xb37406, TRACK = 0x2c2f3d, CAB = 0x30364a, STEEL = 0x55596a, MOON = 0xf4f0dc, CRATER = 0xb8b096;
/** The boom's foot and head (the pivot it slews about is the car's centre, as the drawing's). */
const FOOT = new THREE.Vector3(0, 12, -6), HEAD = new THREE.Vector3(0, 40, -48);
/** The house's roof: where a ride stands. */
const ROOF = 14.5;

export function luna(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [];
  // the tracks: a long dark box with a round end fore and aft, the rollers' hubs along it, the grouser lines across its top
  for (const s of [-1, 1]) {
    parts.push(G(new THREE.BoxGeometry(5, 4.6, 36), TRACK, { x: s * 11.5, y: 2.6, z: 0 }));
    for (const z of [-18, 18]) parts.push(G(new THREE.CylinderGeometry(2.3, 2.3, 5, 10), TRACK, { rz: Math.PI / 2, x: s * 11.5, y: 2.6, z }));
    for (let z = -16; z <= 16; z += 8) parts.push(G(new THREE.CylinderGeometry(1, 1, 0.4, 6), STEEL, { rz: Math.PI / 2, x: s * 14.05, y: 2.4, z }));
    for (let z = -16; z <= 16; z += 4) parts.push(G(new THREE.BoxGeometry(5.1, 0.25, 0.5), 0x1a1c25, { x: s * 11.5, y: 4.95, z }));
  }
  parts.push(
    // the carbody between the tracks and the turntable on it
    G(new THREE.BoxGeometry(18, 2.4, 22), TRACK, { y: 4.4 }),
    G(new THREE.CylinderGeometry(8, 8, 1.2, 16), STEEL, { y: 6.2, z: -1 }),
    // the house, its roof a shade deeper, the counterweight at the back
    G(new THREE.BoxGeometry(18, 7, 26), ORANGE, { y: 10.3, z: -1 }),
    G(new THREE.BoxGeometry(18.4, 0.6, 26.4), DEEP, { y: 14.1, z: -1 }),
    G(new THREE.BoxGeometry(17, 5, 4.5), DEEP, { y: 9.8, z: 14.2 }),
    // the cab, forward on the left: dark glass on its front and side, as the drawing's window
    G(new THREE.BoxGeometry(7, 6, 7), ORANGE, { x: -5.5, y: 17.4, z: -8.5 }),
    G(new THREE.BoxGeometry(6.2, 3.6, 0.3), CAB, { x: -5.5, y: 18, z: -12.05 }, 0.5),
    G(new THREE.BoxGeometry(0.3, 3.6, 5.6), CAB, { x: -9.05, y: 18, z: -8.5 }, 0.5),
    G(new THREE.BoxGeometry(7.4, 0.5, 7.4), DEEP, { x: -5.5, y: 20.6, z: -8.5 }),
    // the engine's louvres down the right side, an amber beacon on the cab
    ...[0, 3, 6].map((z) => G(new THREE.BoxGeometry(0.2, 3, 1.6), DEEP, { x: 9.1, y: 10.5, z })),
    blob(0.7, 0.7, 0.7, -5.5, 21.5, -8.5, 0xff9a1f, 1, 8, 6),
  );
  // the A-frame gantry over the back of the house, and the boom's foot pins
  const apex = v(0, 24, 7);
  for (const s of [-1, 1]) { parts.push(rod(v(s * 7, 14.4, 11), apex, 0.6, 0.5, DEEP, 0, 6), rod(v(s * 7, 14.4, 1), apex, 0.6, 0.5, DEEP, 0, 6)); }
  for (const s of [-1, 1]) parts.push(G(new THREE.BoxGeometry(1.2, 3.4, 3), DEEP, { x: s * 2.6, y: 13.2, z: -6 }));
  group.add(glowMesh(parts));

  // ── the boom: four chords, lacing down both sides and over the top, the head sheave, the pendants back to the gantry, lamps along it; the cable and the moon
  const b: GlowPart[] = [];
  const dir = HEAD.clone().sub(FOOT), len = dir.length(), u = dir.clone().normalize();
  const up = new THREE.Vector3(0, 1, 0).sub(u.clone().multiplyScalar(u.y)).normalize();    // across the boom's depth, square to it
  const at = (f: number, sx: number, sy: number) => FOOT.clone().addScaledVector(u, f * len).add(new THREE.Vector3(sx * 2, 0, 0)).addScaledVector(up, sy * 1.5);
  const taper = (f: number) => (f < 0.12 ? 0.6 + f * 3.3 : 1);   // the boom narrows a little to its foot
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) b.push(rod(at(0, sx * 0.6, sy * 0.6), at(0.12, sx, sy), 0.32, 0.3, ORANGE, 0, 4), rod(at(0.12, sx, sy), at(1, sx, sy), 0.3, 0.26, ORANGE, 0, 4));
  const bays = 12;
  for (let i = 0; i < bays; i++) {
    const f0 = 0.12 + (0.88 * i) / bays, f1 = 0.12 + (0.88 * (i + 1)) / bays, z = i % 2 ? 1 : -1;
    for (const sx of [-1, 1]) b.push(rod(at(f0, sx, z), at(f1, sx, -z), 0.16, 0.16, DEEP, 0, 3));
    b.push(rod(at(f0, -1, 1), at(f1, 1, 1), 0.16, 0.16, DEEP, 0, 3));
  }
  b.push(G(new THREE.CylinderGeometry(1.7, 1.7, 3.4, 12), STEEL, { rz: Math.PI / 2, x: HEAD.x, y: HEAD.y + 0.6, z: HEAD.z - 0.8 }));
  for (const s of [-1, 1]) b.push(rod(apex.clone().add(v(s * 0.4, 0, 0)), at(0.97, s, 1), 0.12, 0.12, 0x2a2a2a, 0, 3));
  for (let k = 1; k <= 9; k++) b.push(blob(0.45, 0.45, 0.45, ...at(0.12 + k * 0.088, 1.15, 1.1).toArray(), 0xffd27a, 1, 6, 4));
  // the cable from the head, the hook block, and the moon hung under it
  const MY = 17.5, MR = 7;
  b.push(rod(v(0, HEAD.y, HEAD.z), v(0, MY + MR + 2.6, HEAD.z), 0.14, 0.14, 0x2a2a2a, 0, 3));
  b.push(G(new THREE.BoxGeometry(1.6, 2.4, 1.2), 0xd6c23a, { y: MY + MR + 1.4, z: HEAD.z }));
  b.push(blob(MR, MR, MR, 0, MY, HEAD.z, MOON, 1, 16, 11));
  // the craters: dimmer, sunk a little into the face (two on the face the drawing shows, more round it)
  for (const [lat, lon, r] of [[0.5, -0.4, 1.6], [-0.2, 0.5, 1.2], [0.1, 2.3, 1.8], [-0.5, -1.6, 1.3], [0.8, 1.4, 1]] as const) {
    const n = v(Math.cos(lat) * Math.sin(lon), Math.sin(lat), -Math.cos(lat) * Math.cos(lon));
    b.push(blob(r, r, r * 0.35, n.x * (MR - 0.05), MY + n.y * (MR - 0.05), HEAD.z + n.z * (MR - 0.05), CRATER, 0.55, 8, 4, {}));
    const last = b[b.length - 1].geo; last.translate(-n.x * (MR - 0.05), -(MY + n.y * (MR - 0.05)), -(HEAD.z + n.z * (MR - 0.05)));
    last.lookAt(n); last.translate(n.x * (MR - 0.05), MY + n.y * (MR - 0.05), HEAD.z + n.z * (MR - 0.05));
  }
  const arm = new THREE.Group();
  arm.add(glowMesh(b)); group.add(arm);

  // the slew: a slow swing from side to side, small enough that the moon stays inside the drawing's width
  return critter(group, (t) => { arm.rotation.y = Math.sin(t * 0.4) * 0.12; }, ROOF);
}
