import * as THREE from "three";
import { G, blob, critter, glowMesh, rod, tyres, type Critter, type GlowPart } from "./critters";
import { skinMaterial } from "./skinned";

/**
 * The Cuttlefish Art Car you can ride (redesigned 2026-11-03, asked "improve the cuttlefish model design"), as its top-down drawing has it (PlayaWin.tsx
 * drawCuttlefish): a broad mantle, flat on top and pale underneath, edged all round by a fin that ripples back along both sides; a head with two big eyes
 * on its sides and their W-shaped pupils; eight arms gathered into a point in front with two longer tentacles tucked among them, swaying; and its skin
 * putting on the "passing cloud", dark bands rolling back over the mantle as the hue drifts round magenta, with pale spots down its back. At night
 * the fin's edge, the spots and a ring of LEDs round the chassis light up. Inside the ride's 36 x 20 ft. Four draw calls: the static parts, the skin
 * (recoloured each frame), the fin (its outer edge moved each frame) and the arms (swaying as one).
 */
const DARK = 0x23252f, EYE = 0xf6e7a8, NAVY = 0x1b1f3b;
/** The mantle: half-sizes and centre. */
const MX = 7.4, MY = 4.1, MZ = 11.6, MC = 5.4, MZC = 3;
/** The head: half-sizes and centre. */
const HX = 5.3, HY = 3.7, HZ = 4.8, HZC = -8.6;
/** The fin: how far out from the mantle's rim, where along the rim it starts (radians from the front) and how many steps round. */
const FIN = 2.7, FIN_FROM = 0.62, FIN_N = 56;

/** The skin's colour at a vertex: the hue drifting round magenta; dark bands rolling back over the top; pale underneath. */
function skinColour(c: THREE.Color, x: number, y: number, z: number, t: number, hue: number): THREE.Color {
  const under = THREE.MathUtils.smoothstep(MC - y, 0.2, 2.2);   // 0 on top, 1 on the belly
  const band = Math.max(0, Math.sin(z * 0.95 - t * 4.2 + Math.abs(x) * 0.18)) ** 2;
  const mottle = 0.04 * Math.sin(x * 2.1 + z * 1.3) * Math.sin(z * 0.9 - x * 1.7);
  c.setHSL(hue, 0.62 - 0.4 * under, 0.6 - 0.34 * band * (1 - under) + 0.26 * under + mottle);
  return c;
}

export function cuttlefish(): Critter {
  const group = new THREE.Group();

  // the static parts: the chassis, the wheels and the LEDs round it, the eyes and their pupils, the spots down the back
  const fixed: GlowPart[] = [
    G(new THREE.BoxGeometry(9, 2.2, 20), DARK, { y: 2.6, z: 2 }),
    ...tyres(5.2, [-5, 9], 2.1, 1.8),
  ];
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * Math.PI * 2;
    fixed.push(blob(0.45, 0.35, 0.45, Math.sin(a) * 4.9, 1.9, 2 - Math.cos(a) * 10.4, new THREE.Color().setHSL(k / 22, 1, 0.6).getHex(), 1, 5, 3));
  }
  for (const s of [-1, 1]) {
    const ex = s * (HX - 0.6), ey = MC + 1.3, ez = HZC - 0.4;
    fixed.push(blob(1.9, 1.7, 1.9, ex, ey, ez, EYE, 0.35, 12, 8));
    // the W pupil, a flat shape on the eye's outer side
    const w = new THREE.Shape(), top = [[-1.3, 0.45], [-0.62, -0.5], [0, 0.2], [0.62, -0.5], [1.3, 0.45]];
    w.moveTo(top[0][0], top[0][1]); for (const [u, v] of top.slice(1)) w.lineTo(u, v);
    for (const [u, v] of [...top].reverse()) w.lineTo(u * 0.88, v - 0.45);
    fixed.push(G(new THREE.ShapeGeometry(w), NAVY, { ry: s * Math.PI / 2, x: ex + s * 1.93, y: ey, z: ez }));
  }
  for (let k = 0; k < 7; k++) {
    const z = MZC - 7 + k * 2.4, x = (k % 2 ? 1 : -1) * (1.6 + (k % 3) * 0.9), y = MC + MY * Math.sqrt(Math.max(0, 1 - (x / MX) ** 2 - ((z - MZC) / MZ) ** 2));
    fixed.push(blob(0.55, 0.22, 0.55, x, y + 0.05, z, 0xfff3fb, 1, 6, 3));
  }
  group.add(glowMesh(fixed));

  // the skin: the mantle, the belly and the head, recoloured as the colour rolls over them
  const skin = glowMesh([
    blob(MX, MY, MZ, 0, MC, MZC, 0xd0609a, 0.22, 24, 14),
    blob(MX - 0.5, 2.1, MZ - 0.6, 0, MC - 1.3, MZC, 0xf0dde6, 0.1, 20, 6),
    blob(HX, HY, HZ, 0, MC - 0.2, HZC, 0xd0609a, 0.22, 16, 10),
    // a brow over each eye
    ...[-1, 1].map((s) => blob(1.7, 0.7, 2.2, s * (HX - 1.1), MC + 2.6, HZC - 0.4, 0xd0609a, 0.22, 10, 5)),
  ]);
  group.add(skin);
  const sp = skin.geometry.getAttribute("position") as THREE.BufferAttribute, sc = skin.geometry.getAttribute("color") as THREE.BufferAttribute;

  // the fin: a strip round the mantle's rim from beside the head, round the back and up the other side, three rows across; the inner row is fixed to
  // the rim, the outer two ripple up and down, the waves running back along both sides together
  const rows = 3, n = FIN_N + 1, pos = new Float32Array(n * rows * 3), col = new Float32Array(n * rows * 3), glow = new Float32Array(n * rows);
  const rim: { x: number; z: number; nx: number; nz: number; d: number }[] = [];
  for (let k = 0; k < n; k++) {
    const a = FIN_FROM + (k / FIN_N) * (Math.PI * 2 - 2 * FIN_FROM), sx = Math.sin(a), cz = Math.cos(a), len = Math.hypot(sx / MX, cz / MZ);
    rim.push({ x: sx * MX * 0.97, z: MZC - cz * MZ * 0.97, nx: sx / MX / len, nz: -cz / MZ / len, d: a < Math.PI ? a : Math.PI * 2 - a });
    for (let r = 0; r < rows; r++) glow[k * rows + r] = r === rows - 1 ? 0.9 : 0.3;
  }
  const idx: number[] = [];
  for (let k = 0; k < FIN_N; k++) for (let r = 0; r < rows - 1; r++) { const a = k * rows + r, b = a + rows; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const finGeo = new THREE.BufferGeometry();
  finGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3)); finGeo.setAttribute("color", new THREE.BufferAttribute(col, 3)); finGeo.setAttribute("aGlow", new THREE.BufferAttribute(glow, 1));
  finGeo.setIndex(idx);
  const fin = new THREE.Mesh(finGeo, skinMaterial());
  group.add(fin);

  // the arms: eight from a ring round the front of the head, gathered to a point, and two longer tentacles with clubs; one mesh, swaying from the head
  const arms: GlowPart[] = [], AZ = HZC - HZ + 0.8;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8, bx = Math.cos(a) * 2.3, by = Math.sin(a) * 1.7;
    const mid = new THREE.Vector3(bx * 0.75, by * 0.6 - 0.4, -3.4), tip = new THREE.Vector3(bx * 0.18, -0.9 + by * 0.1, -6.6 - (by > 0 ? 0 : 0.5));
    arms.push(rod(new THREE.Vector3(bx, by, 0.4), mid, 0.85, 0.6, 0xc85a92, 0.2, 7), rod(mid, tip, 0.6, 0.12, 0xe07aa8, 0.2, 7));
  }
  for (const s of [-1, 1]) {
    const tip = new THREE.Vector3(s * 0.6, -1.2, -8.6);
    arms.push(rod(new THREE.Vector3(s * 0.5, 0, 0), tip, 0.3, 0.22, 0xf0a0c4, 0.3, 5), blob(0.5, 0.35, 0.9, tip.x, tip.y, tip.z - 0.6, 0xf6b6d2, 0.5, 6, 4));
  }
  const armMesh = glowMesh(arms);
  armMesh.position.set(0, MC - 0.4, AZ);
  group.add(armMesh);

  const c = new THREE.Color(), edge = new THREE.Color();
  let last = -1;
  const paint = (t: number) => {
    const hue = ((320 + Math.sin(t * 0.7) * 40 + 360) % 360) / 360;
    // the skin: only re-coloured ten times a second or so; it is a few thousand vertices
    if (Math.abs(t - last) > 0.08) {
      last = t;
      for (let i = 0; i < sp.count; i++) { skinColour(c, sp.getX(i), sp.getY(i), sp.getZ(i), t, hue); sc.setXYZ(i, c.r, c.g, c.b); }
      sc.needsUpdate = true;
    }
    edge.setHSL((hue + 0.5) % 1, 0.7, 0.8);   // the fin's iridescent edge, the hue's opposite
    for (let k = 0; k < n; k++) {
      const p = rim[k], taper = Math.min(1, p.d / 0.6, (Math.PI - p.d) / 0.4 + 0.35), wave = Math.sin(t * 7 - p.d * 6) * taper;
      for (let r = 0; r < rows; r++) {
        const f = r / (rows - 1), out = FIN * f, j = (k * rows + r) * 3;
        pos[j] = p.x + p.nx * out; pos[j + 1] = MC - 0.2 + f * f * (1.1 * wave - 0.5); pos[j + 2] = p.z + p.nz * out;
        skinColour(c, p.x, MC + 1, p.z, t, hue).lerp(edge, f);
        col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b;
      }
    }
    finGeo.attributes.position.needsUpdate = true; finGeo.attributes.color.needsUpdate = true; finGeo.computeVertexNormals();
    armMesh.rotation.y = Math.sin(t * 2.1) * 0.12; armMesh.rotation.x = Math.sin(t * 1.6) * 0.06;
  };
  paint(0);
  finGeo.computeBoundingSphere();
  return critter(group, paint, MC + MY);
}
