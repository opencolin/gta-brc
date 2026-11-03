import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Funkadelephant (asked 2026-11-02): a big grey elephant on wheels, as its top-down drawing has it (artcars.ts funkadelephant): the round body on four thick legs,
 * a saddle-cloth in magenta and gold over its back with a gold-railed deck on it for the dancers, the domed head in front with its great ears fanned out to the
 * sides (pink inside), two ivory tusks and the long trunk curling out ahead, swinging; at night rows of coloured lights down its flanks and round the cloth, the
 * body and ears lit a little. Inside the drawing's footprint (48 x 68 ft). Two draw calls: the elephant, and its trunk (its own mesh so it can swing).
 */
const GREY = 0x8e93a6, EAR = 0xa7acbe, PINK = 0xe8a0b4, IVORY = 0xf6f1df, CLOTH = 0xb0307a, GOLD = 0xe4c060, DARK = 0x23252f;
/** The deck on its back. */
const DY = 27;

export function funkadelephant(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    G(new THREE.BoxGeometry(20, 2.6, 40), DARK, { y: 4, z: 3 }),
    ...tyres(13, [-12, 18], 3.4, 2.6),
    // the body, and the cloth over its back, its gold hem, the deck on top
    blob(13, 10.5, 22, 0, 16, 6, GREY, 0.15, 14, 9),
    blob(12.4, 5, 15, 0, 22.6, 6, CLOTH, 0.25, 12, 5),
    G(new THREE.CylinderGeometry(12.6, 12.6, 0.6, 16), GOLD, { sz: 1.2, y: 22.4, z: 6 }, 0.3),
    G(new THREE.BoxGeometry(13, 0.8, 18), GOLD, { y: DY - 0.4, z: 6 }),
    // the head and its forehead, the tail
    blob(9, 9.5, 8.5, 0, 20, -16, GREY, 0.15, 12, 8),
    blob(6.4, 4, 3.6, 0, 22, -21.8, GREY, 0.15, 8, 5),
    rod(v(0, 17, 26.5), v(0, 10, 27.3), 0.6, 0.4, GREY, 0, 4),
    blob(0.9, 1.6, 0.9, 0, 9.2, 27.3, 0x3a3d48, 0, 6, 4),
  ];
  // the deck's rail: posts and a top rail round it
  for (const [x, z] of [[-6.5, -3], [6.5, -3], [-6.5, 15], [6.5, 15], [-6.5, 6], [6.5, 6]] as const) parts.push(rod(v(x, DY, z), v(x, DY + 3, z), 0.25, 0.25, GOLD, 0, 3));
  for (const s of [-1, 1]) { parts.push(rod(v(s * 6.5, DY + 3, -3), v(s * 6.5, DY + 3, 15), 0.25, 0.25, GOLD, 0, 4)); parts.push(rod(v(-6.5, DY + 3, s < 0 ? -3 : 15), v(6.5, DY + 3, s < 0 ? -3 : 15), 0.25, 0.25, GOLD, 0, 4)); }
  for (const s of [-1, 1]) {
    // the legs: thick grey columns, pale toenails
    for (const z of [-6, 20]) { parts.push(rod(v(s * 8, 0.4, z), v(s * 8, 12, z), 3.2, 3.6, GREY, 0, 8)); parts.push(G(new THREE.CylinderGeometry(3.7, 3.7, 1, 8, 1, true), IVORY, { x: s * 8, y: 0.9, z })); }
    // the ears: great flat fans out to the drawing's x 24, swept back a little, pink in front
    parts.push(blob(8, 10, 1.3, s * 15, 20, -14, EAR, 0.15, 10, 7, { ry: -s * 0.55 }));
    parts.push(blob(5, 6.6, 0.6, s * 14.6, 20, -15.1, PINK, 0.3, 10, 6, { ry: -s * 0.55 }));
    // the eyes, with a shine
    parts.push(blob(1, 1.2, 0.7, s * 5, 23, -22.6, 0x1b1f3b, 0, 8, 6));
    parts.push(blob(0.3, 0.3, 0.2, s * 5 - 0.3, 23.5, -23.2, 0xffffff, 0.8, 4, 4));
    // the tusks, out, forward and curling up
    parts.push(rod(v(s * 3, 15, -22.5), v(s * 4.2, 13.6, -27.5), 0.9, 0.6, IVORY, 0, 6), rod(v(s * 4.2, 13.6, -27.5), v(s * 4.6, 15.2, -31), 0.6, 0.15, IVORY, 0, 6));
    // the lights: a row down each flank and round the cloth's hem, every colour
    for (let k = 0; k < 7; k++) {
      const z = -8 + k * 4.6, u = (z - 6) / 22;
      parts.push(G(new THREE.OctahedronGeometry(0.6), new THREE.Color().setHSL(k / 7, 1, 0.6).getHex(), { x: s * 13 * Math.sqrt(1 - u * u) * 0.98, y: 16, z }, 1.4));
      parts.push(G(new THREE.OctahedronGeometry(0.55), new THREE.Color().setHSL((k / 7 + 0.5) % 1, 1, 0.6).getHex(), { x: s * 12.3 * Math.sqrt(Math.max(0, 1 - ((z - 6) / 18) ** 2)), y: 22, z }, 1.4));
    }
  }
  group.add(glowMesh(parts));

  // the trunk, built about its root under the forehead: down, out and curling up at the tip, swinging side to side
  const tk: GlowPart[] = [];
  const P = [v(0, 0, 0), v(0, -3.2, -3.2), v(0, -6, -6.2), v(0, -7.4, -9.6), v(0, -6.4, -12.6), v(0, -3.8, -14)], R = [3, 2.5, 2, 1.6, 1.3, 1.1];
  for (let i = 0; i < P.length - 1; i++) tk.push(rod(P[i], P[i + 1], R[i], R[i + 1], GREY, 0.15, 8), blob(R[i + 1], R[i + 1], R[i + 1], P[i + 1].x, P[i + 1].y, P[i + 1].z, GREY, 0.15, 8, 5));
  tk.push(G(new THREE.CylinderGeometry(1.3, 1.1, 0.5, 8), 0x6b6f80, { rx: 0.9, y: -3.6, z: -14.2 }));
  const trunk = new THREE.Group(); trunk.position.set(0, 19.5, -23.5);
  trunk.add(glowMesh(tk));
  group.add(trunk);

  return critter(group, (t) => { trunk.rotation.y = Math.sin(t * 2.2) * 0.32; trunk.rotation.x = Math.sin(t * 1.3) * 0.08; }, DY);
}
