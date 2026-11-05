import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";

/**
 * Dragomi (asked 2026-11-04, from Collin, with photos from AudioPixel's and Celestial Tea Garden's posts): AudioPixel's origami dragon on a 20 ft flatbed. Over
 * the cab its head, a block of triangular LED panels, its snout two chevrons pointing ahead like folded paper; along both sides of the bed the body, a zigzag
 * ribbon of triangles to the tail; white diamond panels skirting the cab; on the deck a canopy on posts, speakers, a fan of five wings opening from the back
 * corner and two poofer poles. By day the panels are white on their dark frames, as in the photos; at night each panel lights and the colour sweeps through
 * them, the head and the body a third of the hue apart, and now and then the poofers fire. As its top-down drawing has it (artcars.ts dragomi): nose to -Z,
 * inside 34 x 70 ft. Four draw calls: the dragon, the head's panels, the body's panels (each its own material, so its glow can change colour), and the fire.
 */
const FRAME = 0x23252f, PANEL = 0xf1f3f7, CAB = 0x8d929c, DECK = 0x4a4038, CANVAS = 0xe9e2d0, SPEAKER = 0x1b1c22, WING = 0xdfe3ea, STEEL = 0x8a8f99;
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** One flat triangle (the material draws both sides). */
function tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z], 3));
  return g;
}
/** A panel: the triangle shrunk toward its middle so its dark frame shows round it, and lifted `out` off the frame along `n`. */
function panel(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, n: THREE.Vector3, out = 0.15, k = 0.84): THREE.BufferGeometry {
  const m = a.clone().add(b).add(c).multiplyScalar(1 / 3), off = n.clone().multiplyScalar(out);
  const s = (p: THREE.Vector3) => p.clone().sub(m).multiplyScalar(k).add(m).add(off);
  return tri(s(a), s(b), s(c));
}
/**
 * A face of the dragon: the quad a, b, c, d (in order round it) as a dark frame, and over it nu x nv cells of two triangular panels each, the diagonals
 * alternating as the origami's folds do. `n` points out of the face.
 */
function face(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, nu: number, nv: number, n: THREE.Vector3, frames: GlowPart[], panels: GlowPart[]) {
  frames.push({ geo: tri(a, b, c), color: FRAME, glow: 0 }, { geo: tri(a, c, d), color: FRAME, glow: 0 });
  const at = (u: number, w: number) => a.clone().lerp(b, u).lerp(d.clone().lerp(c, u), w);
  for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
    const p00 = at(i / nu, j / nv), p10 = at((i + 1) / nu, j / nv), p11 = at((i + 1) / nu, (j + 1) / nv), p01 = at(i / nu, (j + 1) / nv);
    const [t1, t2] = (i + j) % 2 ? [[p00, p10, p11], [p00, p11, p01]] : [[p00, p10, p01], [p10, p11, p01]];
    panels.push({ geo: panel(t1[0], t1[1], t1[2], n), color: PANEL, glow: 0.1 }, { geo: panel(t2[0], t2[1], t2[2], n), color: PANEL, glow: 0.1 });
  }
}
/** A slab of the dragon seen from the side: the profile (z, y) quad p, `x0` to `x1` across, its two sides tiled with panels and the rest dark frame. */
function slab(p: [number, number][], x0: number, x1: number, nu: number, nv: number, frames: GlowPart[], panels: GlowPart[]) {
  const at = (x: number, i: number) => v(x, p[i][1], p[i][0]);
  face(at(x1, 0), at(x1, 1), at(x1, 2), at(x1, 3), nu, nv, v(1, 0, 0), frames, panels);
  face(at(x0, 1), at(x0, 0), at(x0, 3), at(x0, 2), nu, nv, v(-1, 0, 0), frames, panels);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; frames.push({ geo: tri(at(x0, i), at(x0, j), at(x1, j)), color: FRAME, glow: 0 }, { geo: tri(at(x0, i), at(x1, j), at(x1, i)), color: FRAME, glow: 0 }); }
}
/** A mesh of panels whose night glow is its material's emissive colour, set in paint(). */
function ledMesh(panels: GlowPart[]) { const m = glowMesh(panels); return { mesh: m, mat: m.material as THREE.MeshLambertMaterial }; }

export function dragomi(): Critter {
  const group = new THREE.Group();
  const body: GlowPart[] = [], head: GlowPart[] = [], tail: GlowPart[] = [];
  // the flatbed: its chassis and bed, the cab under the head, the wheels, a purple light under it at night
  body.push(
    G(new THREE.BoxGeometry(20, 2.6, 60), FRAME, { y: 4.4, z: 0 }),
    G(new THREE.BoxGeometry(21, 0.8, 46), DECK, { y: 6.1, z: 7 }),
    G(new THREE.BoxGeometry(17, 8.5, 11), CAB, { y: 9.2, z: -24 }),
    G(new THREE.BoxGeometry(20.4, 0.5, 60.4), 0xc58cff, { y: 3, z: 0 }, 1),
    ...tyres(9.6, [-22, 12, 20], 3.4, 2.6),
  );
  // the cab skirted in white diamonds, as in the photos: four down each side and two across the front
  const diamond = (c: THREE.Vector3, u: THREE.Vector3, w: THREE.Vector3) => { const a = c.clone().add(u), b = c.clone().add(w), d = c.clone().sub(u), e = c.clone().sub(w); body.push({ geo: tri(a, b, d), color: PANEL, glow: 0.15 }, { geo: tri(a, d, e), color: PANEL, glow: 0.15 }); };
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) diamond(v(s * 8.7, 9, -28.5 + k * 3.2), v(0, 3.6, 0), v(0, 0, 2.4));
  for (const x of [-4.2, 4.2]) diamond(v(x, 9, -29.7), v(0, 3.6, 0), v(3.4, 0, 0));
  // the head: a block of panels over the cab, its top leaning back
  {
    const x = 9, y0 = 13.5, z0 = -25, z1 = -9, yf = 31, yb = 27; // the front edge higher than the back
    const A = v(-x, y0, z0), B = v(x, y0, z0), C = v(x, yf, z0), D = v(-x, yf, z0), E = v(-x, y0, z1), F = v(x, y0, z1), H = v(x, yb, z1), I = v(-x, yb, z1);
    face(B, F, H, C, 3, 3, v(1, 0, 0), body, head); // the right side
    face(E, A, D, I, 3, 3, v(-1, 0, 0), body, head); // the left
    face(D, C, H, I, 3, 3, v(0, 1, 0.2).normalize(), body, head); // the top
    face(F, E, I, H, 2, 2, v(0, 0, 1), body, head); // the back, toward the deck
    body.push({ geo: tri(A, B, C), color: FRAME, glow: 0 }, { geo: tri(A, C, D), color: FRAME, glow: 0 }); // the front, behind the snout
  }
  // the snout: two chevrons pointing ahead, the upper and the lower jaw, each two slanting arms
  for (const [yt, yb, tip] of [[31, 22, -39], [21, 13.5, -36]] as const) {
    const ym = (yt + yb) / 2, th = 3.2; // an arm's thickness, up and down
    slab([[-25, yt], [-29, yt], [tip, ym + th / 2], [tip + 4, ym + th / 2]].map(([z, y]) => [z, y]) as [number, number][], -7, 7, 2, 1, body, head);
    slab([[tip + 4, ym - th / 2], [tip, ym - th / 2], [-29, yb], [-25, yb]], -7, 7, 2, 1, body, head);
  }
  // the body: along each side of the bed a zigzag ribbon of triangles, up and down to the tail, smaller toward it
  for (const s of [-1, 1]) {
    const x = s * 10.6, n = v(s, 0, 0);
    let z = -8; const lo = 6.6;
    for (let k = 0; k < 6; k++) {
      const len = 7.2 - k * 0.45, hi = 18.5 - k * 1.1, w = 3.4 - k * 0.15, up = k % 2 === 0;
      const [ya, yb] = up ? [lo, hi] : [hi, lo];
      // the arm, a parallelogram from (z, ya) to (z + len, yb), w tall
      const a = v(x, ya, z), b = v(x, yb, z + len), c = v(x, yb + (up ? -w : w), z + len), d = v(x, ya + (up ? -w : w), z);
      const [q0, q1, q2, q3] = up ? [d, c, b, a] : [a, b, c, d];
      face(s > 0 ? q0 : q1, s > 0 ? q1 : q0, s > 0 ? q2 : q3, s > 0 ? q3 : q2, 2, 1, n, body, tail);
      // under each peak a triangle of panels fills it in, as the photos' do
      if (up) { const p = v(x, lo, z + len), tip = v(x, hi - w, z + len); tail.push({ geo: panel(a, p, tip, n, 0.12, 0.78), color: PANEL, glow: 0.1 }); body.push({ geo: tri(a, p, tip), color: FRAME, glow: 0 }); }
      z += len;
    }
  }
  // the deck: a canopy on six posts, speakers at the back, the DJ's table
  for (const x of [-8, 8]) for (const z of [-5, 6, 17]) body.push(rod(v(x, 6.5, z), v(x, 23, z), 0.35, 0.35, STEEL, 0, 5));
  body.push(G(new THREE.BoxGeometry(17, 0.4, 23), CANVAS, { y: 23.3, z: 6 }, 0.1));
  for (const x of [-6, 6]) body.push(G(new THREE.BoxGeometry(3.4, 5, 3), SPEAKER, { x, y: 9, z: 26 }));
  body.push(G(new THREE.BoxGeometry(7, 3.4, 2.6), SPEAKER, { y: 8.2, z: 0 }));
  // the fan of wings: five blades opening up and out from the back corner, a warm light at each tip
  const hub = v(-7.5, 22, 22);
  for (let k = 0; k < 5; k++) {
    const a = 0.25 + k * 0.32, dir = v(-Math.sin(a) * 0.75, 0.55 + 0.1 * Math.cos(a), Math.cos(a) * 0.75).normalize(), side = v(0, 0, 1).cross(dir).normalize();
    const tip = hub.clone().addScaledVector(dir, 13), wd = side.clone().multiplyScalar(2.6);
    const p0 = hub.clone().addScaledVector(side, 0.4), p1 = tip.clone().add(wd), p2 = tip.clone().sub(wd).addScaledVector(dir, -2.5);
    body.push({ geo: tri(hub, p1, p2), color: WING, glow: 0.2 }, { geo: tri(p0, p1, hub), color: WING, glow: 0.2 }, rod(hub, tip, 0.25, 0.2, STEEL, 0, 4), blob(0.6, 0.6, 0.6, tip.x, tip.y, tip.z, 0xffc070, 1.6, 6, 4));
  }
  // the two poofer poles, up from the deck
  const poofers = [v(3, 0, -3), v(-3, 0, 7)];
  for (const p of poofers) body.push(rod(v(p.x, 6.5, p.z), v(p.x, 37, p.z), 0.45, 0.35, STEEL, 0, 6), G(new THREE.CylinderGeometry(0.9, 0.7, 1.4, 8), 0x5a5f69, { x: p.x, y: 37.4, z: p.z }));
  group.add(glowMesh(body, true));
  const h = ledMesh(head), b = ledMesh(tail);
  group.add(h.mesh, b.mesh);
  // the fire: a column of flame over each poofer, hidden by day and between bursts
  const fire = new THREE.Group();
  for (const p of poofers) {
    const f = glowMesh([blob(1.6, 4, 1.6, p.x, 41.5, p.z, 0xffd27a, 2.4, 8, 6), blob(2.4, 5.5, 2.4, p.x, 43, p.z, 0xff8a2a, 1.8, 8, 6)]);
    fire.add(f);
  }
  group.add(fire);
  const col = new THREE.Color();
  return critter(group, (t, night) => {
    // the panels' colour sweeping round the wheel, the body a third behind the head
    const k = night * 0.5;
    h.mat.emissive.copy(col.setHSL((t * 0.06) % 1, 1, 0.5)).multiplyScalar(k);
    b.mat.emissive.copy(col.setHSL((t * 0.06 + 0.33) % 1, 1, 0.5)).multiplyScalar(k);
    fire.visible = night > 0.3 && Math.sin(t * 1.1) > 0.55;
    if (fire.visible) fire.children.forEach((f, i) => { const s = 1 + 0.18 * Math.sin(t * 19 + i * 2); f.scale.set(s, 0.85 + 0.3 * Math.sin(t * 13 + i) ** 2, s); });
  }, 6.5);
}
