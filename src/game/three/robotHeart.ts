import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Robot Heart (asked 2026-11-02): the vintage bus with the wall of speakers and the great red heart, as its top-down drawing has it (artcars.ts robotHeart): a cream
 * bus with a rounded roof, its windscreen dark at the nose, a row of dark windows down each side, ribs across the roof; on the roof two speaker stacks a side, one pair
 * forward and one aft, black cabinets three high with their cones facing out and to the ends; between them, on a post, the heart, red and puffy, which turns slowly so
 * everyone round it sees it and at night glows and beats. Red lights along the roof's edge, warm headlights and red tail lights come on at night. Inside the drawing's
 * footprint (33 x 62 ft). Two draw calls: the bus, and the heart (its own mesh so it can turn and beat).
 */
const CREAM = 0xe9e4d6, RIB = 0xc9c2ae, GLASS = 0x33384f, CAB = 0x2a2d3c, CONE = 0x555a70, DUST = 0x16171f, DARK = 0x23252f, RED = 0xd9283f;
/** The bus body's floor and roof heights. */
const FLOOR = 3, ROOF = 13;

/** The bus's cross-section (x across, y up), 2 ft narrower and lower than the body: the extrusion's bevel rounds it out to 26 wide and the ends to 62 long. */
function busShape(): THREE.Shape {
  const s = new THREE.Shape(), w = 12, y0 = FLOOR + 1, y1 = ROOF - 1, r = 3;
  s.moveTo(-w, y0); s.lineTo(w, y0); s.lineTo(w, y1 - r); s.quadraticCurveTo(w, y1, w - r, y1); s.lineTo(-w + r, y1); s.quadraticCurveTo(-w, y1, -w, y1 - r); s.lineTo(-w, y0);
  return s;
}
/** The drawing's heart (tip toward the tail there, so up here), centred on its middle. */
function heartShape(): THREE.Shape {
  const s = new THREE.Shape(), y = (v: number) => -v - 1.5;
  s.moveTo(0, y(9)); s.bezierCurveTo(-15, y(-2), -9, y(-15), 0, y(-6)); s.bezierCurveTo(9, y(-15), 15, y(-2), 0, y(9));
  return s;
}

export function robotHeart(): Critter {
  const group = new THREE.Group();
  const body = new THREE.ExtrudeGeometry(busShape(), { depth: 60, bevelEnabled: true, bevelThickness: 1, bevelSize: 1, bevelSegments: 2, curveSegments: 4 }).translate(0, 0, -30);
  const parts: GlowPart[] = [
    { geo: body, color: CREAM, glow: 0 },
    // the chassis under it and the wheels (the drawing's at x ±14, z ±20)
    G(new THREE.BoxGeometry(22, 2, 56), DARK, { y: 2.2 }),
    ...tyres(13.2, [-20, 20], 3.4, 2.6),
    // the windscreen, two panes, and the dark strip of the drawing at the front of the roof
    G(new THREE.BoxGeometry(10, 4.2, 0.3), GLASS, { x: -5.6, y: 9.6, z: -31.05 }), G(new THREE.BoxGeometry(10, 4.2, 0.3), GLASS, { x: 5.6, y: 9.6, z: -31.05 }),
    G(new THREE.BoxGeometry(22, 0.3, 4.6), GLASS, { y: ROOF + 0.05, z: -27.6 }),
    // a belt line round the bus under the windows, and the bumpers
    G(new THREE.BoxGeometry(26.3, 0.6, 60), RIB, { y: 7.2 }),
    G(new THREE.BoxGeometry(24, 1.2, 0.8), 0x9aa0ad, { y: 4.4, z: -31.2 }), G(new THREE.BoxGeometry(24, 1.2, 0.8), 0x9aa0ad, { y: 4.4, z: 31.2 }),
    // the headlights (warm at night) and the tail lights (red)
    ...[-1, 1].flatMap((s) => [blob(1.1, 1.1, 0.4, s * 9.5, 5.8, -31.1, 0xfff1c4, 1, 8, 6), G(new THREE.BoxGeometry(1.6, 1.6, 0.3), 0xff2d55, { x: s * 10.5, y: 6, z: 31.1 }, 1)]),
  ];
  // the side windows with cream pillars between them, and the ribs across the roof, every 6 ft as the drawing has them
  for (const s of [-1, 1]) for (let z = -24; z < 28; z += 6) parts.push(G(new THREE.BoxGeometry(0.3, 3.2, 4.6), GLASS, { x: s * 13.05, y: 9.6, z: z + 1 }));
  for (let z = -26; z < 28; z += 6) parts.push(G(new THREE.BoxGeometry(24.6, 0.25, 0.7), RIB, { y: ROOF + 0.05, z }));
  // red lights along the roof's edges, lit at night
  for (const s of [-1, 1]) for (let z = -27; z <= 27; z += 6) parts.push(G(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0xff2d55, { x: s * 12.6, y: ROOF - 0.6, z }, 1));

  // the speaker stacks: the drawing's four (x 3..10 either side, z -18..-8 forward and 14..24 aft), three cabinets high, cones on the outer side and on the end
  const cone = (r: number, x: number, y: number, z: number, face: "x" | "z", s: number) => {
    const o = face === "x" ? { ry: (s * Math.PI) / 2 } : { ry: s > 0 ? 0 : Math.PI };
    const d = 0.08, at = (k: number) => (face === "x" ? { x: x + s * k, y, z } : { x, y, z: z + s * k });
    parts.push(G(new THREE.CircleGeometry(r, 8), CONE, { ...o, ...at(d) }), G(new THREE.CircleGeometry(r * 0.45, 6), DUST, { ...o, ...at(d + 0.05) }));
  };
  for (const [z0, z1, end] of [[-18, -8, -1], [14, 24, 1]] as const) for (const s of [-1, 1]) {
    const xc = s * 6.5, zc = (z0 + z1) / 2;
    for (let k = 0; k < 3; k++) {
      const y = ROOF + 2 + k * 4;
      parts.push(G(new THREE.BoxGeometry(7, 3.8, 10), CAB, { x: xc, y, z: zc }));
      cone(1.6, s * 10, y + 0.2, zc - 2.5, "x", s); cone(1.6, s * 10, y + 0.2, zc + 2.5, "x", s);
      cone(1.5, xc - 1.6 * s, y, end < 0 ? z0 : z1, "z", end); cone(0.8, xc + 2 * s, y + 0.6, end < 0 ? z0 : z1, "z", end);
    }
  }
  // the post the heart turns on
  const HY = 28.5, HZ = -1.5;
  parts.push(rod(new THREE.Vector3(0, ROOF, HZ), new THREE.Vector3(0, HY - 5, HZ), 0.7, 0.5, 0x8a90a8));
  group.add(glowMesh(parts));

  // the heart: a puffy red heart (the drawing's outline, extruded with a soft bevel), glowing at night, with the drawing's highlight on its upper lobe
  const heart = new THREE.Group(); heart.position.set(0, HY, HZ);
  const hg = new THREE.ExtrudeGeometry(heartShape(), { depth: 2, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.1, bevelSegments: 2, curveSegments: 7 }).scale(0.86, 0.86, 1).translate(0, 0, -1);
  heart.add(glowMesh([{ geo: hg, color: RED, glow: 1.1 }, blob(1.6, 1.6, 0.5, -3.6, 5, -2.5, 0xffc2cc, 0.6, 8, 6), blob(1.6, 1.6, 0.5, 3.6, 5, 2.5, 0xffc2cc, 0.6, 8, 6)]));
  group.add(heart);

  return critter(group, (t, night) => {
    heart.rotation.y = t * 0.6;
    const b = 1 + (night > 0.3 ? 0.12 * Math.max(0, Math.sin(t * 7)) : 0);
    heart.scale.setScalar(b);
  }, ROOF + 0.3);
}
