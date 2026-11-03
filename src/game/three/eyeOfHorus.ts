import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * The Eye of Horus (asked 2026-11-02): a gold barge carrying the great painted eye, as its top-down drawing has it (artcars.ts eyeOfHorus): a gold hull with a dark
 * brown rim and blue blocks along both sides, and amidships the wedjat, the eye of Horus, raised high on a gold frame and leaning back to look ahead and up: a
 * cream almond with a navy outline, a heavy navy upper lid and brow, the blue iris (lit at night), and under it the two marks, the curl and the falling line. A Nile
 * barge's papyrus prow and stern curl up at either end, and warm lamps along the rim come on at night. Every five seconds the eye blinks: a gold lid closes over it.
 * Inside the drawing's footprint (28 x 60 ft, the wheels at x ±14, z ±20). One draw call, two in the moment of a blink (the lid, its own mesh so it can close).
 */
const GOLD = 0xb8862e, BRIGHT = 0xd9a842, RIM = 0x5c3d0e, BLUE = 0x1f4fa8, CREAM = 0xf6efdc, NAVY = 0x1b1f3b;
/** The deck's height; the eye's centre (y, z) and how far its face leans back from upright. */
const DY = 8.6, EY = 20.5, EZ = -2, LEAN = 0.6;

/** The hull's plan: the drawing's 28 x 60 rounded rectangle (corner radius 6), inset by `d`, as a shape for an extrusion laid flat. */
function hullShape(d: number): THREE.Shape {
  const w = 14 - d, l = 30 - d, r = 6 - d, s = new THREE.Shape();
  s.moveTo(-w + r, -l); s.lineTo(w - r, -l); s.absarc(w - r, -l + r, r, -Math.PI / 2, 0, false); s.lineTo(w, l - r); s.absarc(w - r, l - r, r, 0, Math.PI / 2, false);
  s.lineTo(-w + r, l); s.absarc(-w + r, l - r, r, Math.PI / 2, Math.PI, false); s.lineTo(-w, -l + r); s.absarc(-w + r, -l + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}
const slab = (d: number, depth: number, y: number) => new THREE.ExtrudeGeometry(hullShape(d), { depth, bevelEnabled: false, curveSegments: 4 }).rotateX(Math.PI / 2).translate(0, y + depth, 0);

export function eyeOfHorus(): Critter {
  const group = new THREE.Group();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const parts: GlowPart[] = [
    // the hull, the dark rim round the deck, the deck
    { geo: slab(0.6, DY - 3.4, 3.4), color: GOLD, glow: 0 },
    { geo: slab(0, 0.7, DY - 0.5), color: RIM, glow: 0 },
    { geo: slab(1.4, 0.2, DY - 0.1), color: BRIGHT, glow: 0 },
    ...tyres(13.2, [-20, 20], 3.2, 2.4),
  ];
  // the blue blocks along both sides, on the rim and down the hull's flank, as the drawing's
  for (let z = -24; z <= 28; z += 8) for (const s of [-1, 1]) {
    parts.push(G(new THREE.BoxGeometry(2.6, 0.5, 4), BLUE, { x: s * 12.4, y: DY + 0.35, z }));
    parts.push(G(new THREE.BoxGeometry(0.4, 3.2, 4), BLUE, { x: s * 13.55, y: DY - 2.6, z }));
  }
  // the papyrus prow and stern: a gold post curling up and over at each end, a lotus bud at its tip
  for (const e of [-1, 1]) {
    const p = [v(0, DY - 1, e * 26), v(0, DY + 4, e * 28.6), v(0, DY + 8.5, e * 29.6), v(0, DY + 11, e * 28.4), v(0, DY + 10.4, e * 26.6)], r = [1.6, 1.3, 1, 0.75, 0.55];
    for (let i = 0; i < 4; i++) parts.push(rod(p[i], p[i + 1], r[i], r[i + 1], BRIGHT, 0, 6));
    parts.push(G(new THREE.ConeGeometry(1.1, 2.4, 6), BLUE, { rx: e * 2.2, x: 0, y: DY + 9.6, z: e * 25.9 }, 0.3));
  }
  // warm lamps round the rim
  for (const q of hullShape(0.4).getSpacedPoints(14).slice(0, 14)) parts.push(blob(0.55, 0.55, 0.55, q.x, DY + 0.5, q.y, 0xffd27a, 1, 5, 3));
  // the frame the eye stands on: two gold legs and a brace from the deck to the back of the face
  const back = (x: number, y: number) => v(x, EY + y * Math.cos(LEAN) - 1.4 * Math.sin(LEAN), EZ + y * Math.sin(LEAN) + 1.4 * Math.cos(LEAN));
  for (const s of [-1, 1]) parts.push(rod(v(s * 7, DY, EZ + 6), back(s * 6, -3), 0.9, 0.7, GOLD, 0, 6));
  parts.push(rod(v(0, DY, EZ + 10), back(0, 3), 1, 0.8, GOLD, 0, 6));

  // ── the eye's face, built upright (x across, y up, facing -z) and then leaned back
  const face: GlowPart[] = [
    // the gold almond it is set in, the navy outline, the cream of the eye (a little light at night)
    blob(13.4, 9.4, 1, 0, 0.6, 0.4, BRIGHT, 0, 18, 6),
    blob(11.2, 6.9, 0.6, 0, 0, -0.6, NAVY, 0, 18, 5),
    blob(10.2, 6, 0.6, 0, 0, -0.95, CREAM, 0.35, 18, 5),
    // the iris, lit blue at night, the pupil and a shine
    G(new THREE.CylinderGeometry(3.6, 3.6, 0.6, 18), BLUE, { rx: Math.PI / 2, z: -1.5 }, 1),
    G(new THREE.CylinderGeometry(1.6, 1.6, 0.6, 12), NAVY, { rx: Math.PI / 2, z: -1.75 }),
    blob(0.7, 0.7, 0.3, -1.3, 1.4, -2.05, 0xffffff, 0.8, 6, 4),
    // the heavy upper lid, the brow over it running out past the corner
    G(new THREE.TorusGeometry(1, 0.13, 4, 16, Math.PI), NAVY, { sx: 10.8, sy: 6.6, z: -1.2 }),
    G(new THREE.TorusGeometry(13, 0.9, 4, 16, Math.PI * 0.62), NAVY, { rz: Math.PI * 0.19, y: -4.2, z: -0.4 }),
    // the gold back of the face
    blob(13.4, 9.4, 0.6, 0, 0.6, 1.2, GOLD, 0, 12, 4),
  ];
  // the marks under the eye: the curl falling back toward the left, and the falling line on the right ending in a teardrop
  const curl = [v(-3, -6.2, -0.8), v(-3.4, -9.6, -0.8), v(-5.2, -12.8, -0.8), v(-8.4, -14.2, -0.8), v(-10.4, -12.6, -0.8), v(-9.4, -11, -0.8)], cr = [1, 1, 0.95, 0.85, 0.7, 0.6];
  for (let i = 0; i < curl.length - 1; i++) face.push(rod(curl[i], curl[i + 1], cr[i], cr[i + 1], NAVY, 0, 6));
  face.push(rod(v(3, -6.2, -0.8), v(3, -12.4, -0.8), 1, 0.8, NAVY, 0, 6), blob(1.3, 1.6, 0.8, 3, -13.6, -0.8, NAVY, 0, 8, 6));
  // turn the face back by LEAN about its centre and put it on the frame
  const lean = new THREE.Matrix4().makeRotationX(LEAN).premultiply(new THREE.Matrix4().makeTranslation(0, EY, EZ));
  for (const p of face) p.geo.applyMatrix4(lean);
  group.add(glowMesh([...parts, ...face]));

  // the lid: a gold almond over the eye, squeezed to nothing but in a blink, when it closes from above and below
  const lid = new THREE.Group(); lid.position.set(0, EY, EZ); lid.rotation.x = LEAN;
  const lidMesh = glowMesh([blob(10.6, 6.4, 1.2, 0, 0, -1.3, BRIGHT, 0.1, 16, 6)]);
  lid.add(lidMesh); group.add(lid);

  return critter(group, (t) => {
    const p = (t % 5) / 0.36;   // a blink lasts a third of a second, once every five
    lid.visible = p < 1;
    if (lid.visible) lidMesh.scale.y = Math.max(0.05, Math.sin(Math.PI * p));
  }, DY + 0.2);
}
