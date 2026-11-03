import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Heavy Meta (asked 2026-11-02): Portland's steel dragon on wheels, as its top-down drawing has it (artcars.ts heavyMeta): a long grey body tapering from the
 * shoulders to a tail at the back, its wings folded up along its back (paler plates on dark struts), a row of dark spines down the ridge, the neck rising at the
 * front to a horned head with yellow eyes, the jaws open; at night the eyes and the throat glow and, now and then, the jaws breathe a jet of fire ahead of it.
 * Inside the drawing's footprint (35 x 62 ft) by day; the fire reaches past the nose only at night. Two draw calls: the dragon, and the fire (its own mesh, hidden by day
 * and between bursts, so it can flicker).
 */
const STEEL = 0x5c6370, PLATE = 0x7d8592, DARK = 0x3e434d, EDGE = 0x454b56, CHASSIS = 0x23252f, EYE = 0xffcf3a, EMBER = 0xff6a1c;

/** A flat panel through the given corners (a fan from the first): a wing's membrane. */
function panel(pts: THREE.Vector3[], color: number): GlowPart {
  const p: number[] = [];
  for (let i = 1; i < pts.length - 1; i++) for (const q of [pts[0], pts[i], pts[i + 1]]) p.push(q.x, q.y, q.z);
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(p, 3)); geo.computeVertexNormals();
  return { geo, color, glow: 0 };
}

export function heavyMeta(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the chassis and the wheels (the drawing's at x ±13, z -14 and 16)
    G(new THREE.BoxGeometry(18, 2.6, 46), CHASSIS, { y: 4, z: 1 }),
    ...tyres(13, [-14, 16], 3.4, 2.6),
    // an ember glow under the chassis at night
    G(new THREE.BoxGeometry(18.4, 0.4, 46.4), EMBER, { y: 2.6, z: 1 }, 0.8),
    // the body: deep at the shoulders, tapering back; a paler belly
    blob(8.6, 6.4, 17, 0, 11.5, 4, STEEL, 0, 16, 10),
    blob(7, 3.4, 13, 0, 7.8, 3, PLATE, 0, 12, 6),
    // the tail, in three tapering pieces down to a spade at the drawing's tip
    rod(v(0, 11, 18), v(0, 9.4, 24), 4, 2.6, STEEL, 0, 8),
    rod(v(0, 9.4, 24), v(0, 8, 29), 2.6, 1.2, STEEL, 0, 6),
    rod(v(0, 8, 29), v(0, 7.6, 31.5), 1.2, 0.3, STEEL, 0, 6),
    G(new THREE.ConeGeometry(1.8, 3, 4), DARK, { rx: Math.PI / 2, sx: 1, sz: 0.3, y: 7.6, z: 30.2 }),
    // the neck, rising from the shoulders to the head
    rod(v(0, 13, -9), v(0, 18, -17), 4.2, 3.2, STEEL, 0, 10),
    rod(v(0, 18, -17), v(0, 21, -21.5), 3.2, 2.8, STEEL, 0, 10),
    // the head, the upper jaw and snout, the lower jaw dropped open, the glowing throat between
    blob(3.8, 3.2, 4.6, 0, 22, -23.2, STEEL, 0, 12, 8),
    blob(2.7, 1.3, 3.6, 0, 22.4, -26.6, STEEL, 0, 10, 6),
    blob(2.3, 0.8, 3.4, 0, 19.6, -25.8, PLATE, 0, 10, 6, { rx: 0.35 }),
    blob(1.8, 1.2, 1.4, 0, 21, -26.2, EMBER, 1.4, 8, 6),
    // the brows over the eyes
    G(new THREE.BoxGeometry(6.6, 0.9, 1.6), DARK, { rx: 0.25, y: 24.4, z: -25 }),
  ];
  for (const s of [-1, 1]) {
    // the yellow eyes, where the drawing has them, glowing at night; the nostrils' little horns; the head's two long horns swept back
    parts.push(blob(1.1, 0.9, 1, s * 2.5, 23.6, -25.6, EYE, 1.2, 8, 6));
    parts.push(G(new THREE.ConeGeometry(0.5, 1.6, 4), DARK, { rx: -1.1, x: s * 1.3, y: 23.6, z: -29 }));
    parts.push(rod(v(s * 1.8, 24.6, -22), v(s * 3.4, 28, -17), 0.9, 0.15, DARK, 0, 5));
    parts.push(rod(v(s * 3, 23.4, -21.5), v(s * 5, 24.6, -17.5), 0.6, 0.1, DARK, 0, 4));
    // the teeth along the jaws
    for (let k = 0; k < 3; k++) {
      parts.push(G(new THREE.ConeGeometry(0.3, 1, 3), 0xe8e4d8, { rx: Math.PI, x: s * (1.5 - k * 0.2), y: 21.1, z: -28.6 + k * 1.3 }));
      parts.push(G(new THREE.ConeGeometry(0.3, 0.9, 3), 0xe8e4d8, { x: s * (1.3 - k * 0.2), y: 20.4, z: -28 + k * 1.3 }));
    }
    // the wings, folded along the back: the membrane from the shoulder up to the elbow and back to the tip (the drawing's (8, -8), (17, 2), (15, 18), (8, 12)),
    // its bones along the edges and a finger across, a claw at the elbow
    const A = v(s * 7, 15.5, -8), E = v(s * 15.8, 23, 1), M = v(s * 14, 15, 9), T = v(s * 15, 10.5, 18), R = v(s * 7, 14.5, 12);
    parts.push(panel([A, E, M, R], PLATE), panel([E, T, R, M], PLATE));
    parts.push(rod(A, E, 0.9, 0.6, EDGE, 0, 5), rod(E, T, 0.6, 0.3, EDGE, 0, 5), rod(E, M, 0.5, 0.3, EDGE, 0, 4), rod(E, R, 0.5, 0.3, EDGE, 0, 4));
    parts.push(G(new THREE.ConeGeometry(0.6, 2.4, 4), DARK, { rz: -s * 0.6, x: E.x + s * 0.7, y: E.y + 1.2, z: E.z }));
    // the haunches and the clawed feet over the wheels
    parts.push(blob(3.2, 4, 5, s * 7, 8.6, 13, STEEL, 0, 10, 6));
    parts.push(blob(2.6, 3.4, 3.4, s * 7.4, 9, -6, STEEL, 0, 10, 6));
  }
  // the spines down the ridge, from the back of the head to the tail (the drawing's dark triangles every 5 ft)
  for (let z = -16; z <= 28; z += 4) {
    const y = z < -8 ? 13 + (-8 - z) * 0.7 : z <= 18 ? 11.5 + 6.4 * Math.sqrt(Math.max(0, 1 - ((z - 4) / 17) ** 2)) : 11 - (z - 18) * 0.28;
    const h = z > 18 ? 2.2 : 3.4;
    parts.push(G(new THREE.ConeGeometry(1.2, h, 4), DARK, { sx: 0.5, x: 0, y: y + h / 2 - 0.4, z }));
  }
  group.add(glowMesh(parts));

  // the fire: three nested flames from the jaws, forward and a little up, the hottest inside; hidden by day and between bursts
  const fire = new THREE.Group(); fire.position.set(0, 21, -28.5); fire.rotation.x = -0.12;
  fire.add(glowMesh([
    G(new THREE.ConeGeometry(3.2, 16, 8), 0xff4a12, { rx: Math.PI / 2, z: -8 }, 1.6),
    G(new THREE.ConeGeometry(2, 12, 8), 0xffa21c, { rx: Math.PI / 2, z: -6.4 }, 1.8),
    G(new THREE.ConeGeometry(1, 8, 6), 0xffe9a0, { rx: Math.PI / 2, z: -4.4 }, 2),
  ]));
  group.add(fire);

  return critter(group, (t, night) => {
    fire.visible = night > 0.3 && Math.sin(t * 1.3) > 0.2;
    if (fire.visible) { const f = 1 + 0.15 * Math.sin(t * 20); fire.scale.set(f, f, 0.85 + 0.25 * Math.sin(t * 13) ** 2); }
  }, 17.5);
}
