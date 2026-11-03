import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Mayan Warrior (asked 2026-11-02): the stepped temple with the warrior's mask on its crown and the lasers, as its top-down drawing has it (artcars.ts mayanWarrior):
 * four tiers of jade green, each smaller and paler than the one under it, edged in gold, with carved glyph panels round the lower two and a stair up the front; on the
 * top tier the mask, a jade face that glows at night, dark eyes and mouth, a gold headdress fanning up behind it and gold ear spools; eight wheels under the skirt.
 * At night six lasers fan out ahead of the mask over the crowd and sweep from side to side. Inside the drawing's footprint (35 x 60 ft; the lasers reach out past it
 * at night only). Two draw calls: the temple, and the lasers (their own mesh so they can sweep, hidden by day).
 */
const GOLD = 0xe4c060, NAVY = 0x1b1f3b, DARK = 0x23252f, JADE = 0x3fd6a8;
const jade = (k: number) => new THREE.Color().setHSL(160 / 360, 0.35, 0.3 + k * 0.07, THREE.SRGBColorSpace).getHex(THREE.SRGBColorSpace);
/** Each tier's top height, and the height of the mask's crown, where the lasers leave it. */
const TOPS = [8, 12, 16, 20], LY = 27;

export function mayanWarrior(): Critter {
  const group = new THREE.Group();
  const parts: GlowPart[] = [
    // the chassis and the four axles of wheels (the drawing's at x ±15, z -22, -6, 10, 24)
    G(new THREE.BoxGeometry(24, 2, 56), DARK, { y: 2.4 }),
    ...tyres(14.6, [-22, -6, 10, 24], 2.8, 2.2),
  ];
  // the tiers: the drawing's 30 x 60, 24 x 48, 18 x 36, 12 x 24, each with a gold rim round its top that glows a little at night
  for (let k = 0; k < 4; k++) {
    const w = 30 - k * 6, l = 60 - k * 12, y0 = k ? TOPS[k - 1] : 3.4, h = TOPS[k] - y0;
    parts.push(G(new THREE.BoxGeometry(w, h, l), jade(k), { y: y0 + h / 2 }));
    parts.push(G(new THREE.BoxGeometry(w + 0.4, 0.5, l + 0.4), GOLD, { y: TOPS[k] - 0.25 }, 0.45));
  }
  // the glyph panels round the two lower tiers: darker squares with a gold boss
  for (let k = 0; k < 2; k++) {
    const w = 30 - k * 6, l = 60 - k * 12, y = (k ? TOPS[0] : 3.4) / 2 + TOPS[k] / 2 - 0.3, n = 6 - k;
    for (let i = 0; i < n; i++) {
      const z = -l / 2 + ((i + 0.5) * l) / n;
      for (const s of [-1, 1]) {
        parts.push(G(new THREE.BoxGeometry(0.3, 2.6, 4.8), new THREE.Color(jade(k)).multiplyScalar(0.7).getHex(), { x: s * (w / 2 + 0.1), y, z }));
        parts.push(G(new THREE.BoxGeometry(0.4, 0.9, 0.9), GOLD, { x: s * (w / 2 + 0.2), y, z }, 0.3));
      }
    }
  }
  // the stair up the front, from the ground deck to the top tier
  for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) {
    const f = -(60 - k * 12) / 2, d = 6 - i * 1.5;
    parts.push(G(new THREE.BoxGeometry(6, 1, d), jade(k + 1), { y: TOPS[k] + i + 0.5, z: f + 6 - d / 2 }));
  }
  // the mask: the drawing's 10 x 18 on the crown, a jade face (glowing at night) toward the front, the head behind it
  const MZ = -4;
  parts.push(G(new THREE.BoxGeometry(10, 9, 6), JADE, { y: TOPS[3] + 4.5, z: MZ }, 0.9));
  parts.push(G(new THREE.BoxGeometry(8, 7, 9), jade(2), { y: TOPS[3] + 3.5, z: MZ + 6.5 }));
  // the brow, the eyes, the nose and the mouth on the face
  parts.push(G(new THREE.BoxGeometry(10.6, 1.2, 1), GOLD, { y: TOPS[3] + 7.2, z: MZ - 3.2 }, 0.5));
  for (const s of [-1, 1]) {
    parts.push(G(new THREE.BoxGeometry(2.4, 1.6, 0.4), NAVY, { x: s * 2.2, y: TOPS[3] + 5.6, z: MZ - 3.1 }));
    // the ear spools, gold discs on the sides of the face
    parts.push(G(new THREE.CylinderGeometry(1.6, 1.6, 0.8, 10), GOLD, { rz: Math.PI / 2, x: s * 5.4, y: TOPS[3] + 4.4, z: MZ }, 0.4));
  }
  parts.push(G(new THREE.BoxGeometry(1.4, 2.6, 1.2), jade(3), { y: TOPS[3] + 4, z: MZ - 3.4 }, 0.5));
  parts.push(G(new THREE.BoxGeometry(4.4, 1, 0.4), NAVY, { y: TOPS[3] + 1.8, z: MZ - 3.1 }));
  // the headdress: gold plumes fanning up and out behind the face, a jade band at their foot
  parts.push(G(new THREE.BoxGeometry(11, 1.4, 1.6), jade(1), { y: TOPS[3] + 9.4, z: MZ + 1.4 }, 0.3));
  for (let i = 0; i < 7; i++) {
    const a = (i - 3) * 0.32, b = new THREE.Vector3(Math.sin(a) * 9, TOPS[3] + 9.5 + Math.cos(a) * 8, MZ + 3.5);
    parts.push(rod(new THREE.Vector3(Math.sin(a) * 2, TOPS[3] + 9.5, MZ + 2), b, 0.9, 1.5, i % 2 ? GOLD : 0xd28a2e, 0.35, 5));
    parts.push(blob(1.3, 1.3, 0.6, b.x, b.y, b.z, i % 2 ? JADE : GOLD, 0.6, 6, 4));
  }
  group.add(glowMesh(parts));

  // the lasers: six beams from the mask's crown fanning out ahead, green and their neighbours' colours, seen only at night
  const lasers = new THREE.Group(); lasers.position.set(0, LY, MZ - 3);
  const beams: GlowPart[] = [];
  const cols = [0x39ff7a, 0x3fd6ff, 0x39ff7a, 0xff3fd2, 0x39ff7a, 0xfff03f];
  for (let k = 0; k < 6; k++) {
    const a = -1.1 + (k * 2.2) / 5, len = 130;
    beams.push(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.sin(a) * len, 6 + (k % 3) * 5, -Math.cos(a) * len), 0.12, 0.3, cols[k], 2, 4));
  }
  lasers.add(glowMesh(beams));
  group.add(lasers);

  return critter(group, (t, night) => {
    lasers.visible = night > 0.3;
    lasers.rotation.y = Math.sin(t * 1.6) * 0.5;
    lasers.rotation.x = Math.sin(t * 1.1) * 0.06;
  }, TOPS[3] + 0.3);
}
