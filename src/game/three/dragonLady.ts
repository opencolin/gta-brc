import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { carRoof } from "./decals";
import { mergedParts, shaped as P, type Part } from "./materials";

/**
 * The Dragon Lady (asked 2026-10-27): a 132 by 35 ft white superyacht on wheels you cannot see. In its own frame the bow is at -Z and starboard is +X, the car's centre
 * is the drawing's. A lofted hull with a raked bow, a flat transom and a swim platform, a navy boot line; its main deck is the existing top-down illustration (decals.ts
 * carRoof, repainted as it is now) laid at deck level, so the teak, the hot tub's water and the furniture are drawn; on it stand the main cabin and, above it, the bridge
 * (raked windscreens, dark side windows), a mast arch with the radar and antennas, a helipad at the bow with a little helicopter on it, the hot tub's rim, loungers on the aft
 * sun deck, rails on posts all round, and the rainbow flag flying from a staff at the stern. At night the windows, the hull's portholes and a chase of rainbow LEDs along
 * the rails glow, unlit. Two draw calls: the yacht (one vertex-coloured mesh), and the deck drawing with the glass and lights (one mesh whose vertex colours paint() sets).
 */
export type Yacht = { group: THREE.Group; paint(t: number, night: number): void; /** how high the main deck is, which a ride on it stands on */ roof: number };

const L = 132, HB = 17.3, DECK = 9, KEEL = 1.2;
const WHITE = 0xffffff, NAVY = 0x1b2547, STEEL = 0x9aa0ad, DARK = 0x2b2f3a, TEAK = 0xc7955a, CREAM = 0xe9e4d6;
const smooth = (x: number) => x * x * (3 - 2 * x);
/** Half the beam at the fraction s of the length from the bow: a fine bow filling out by 30%, full amidships, a touch narrower at the transom. */
const beam = (s: number) => (s < 0.3 ? HB * Math.pow(Math.sin((s / 0.3) * (Math.PI / 2)), 0.9) : s < 0.93 ? HB : HB * (1 - 0.06 * smooth((s - 0.93) / 0.07)));
/** Where the hull is at station s (0 bow, 1 stern) and the height fraction t (0 keel, 1 deck): the keel is narrower and the bow's bottom is pulled aft (the rake). */
function hullAt(s: number, t: number, side: number): THREE.Vector3 {
  const z = -L / 2 + s * L, b = beam(s), kb = b * 0.8, zb = z + 11 * Math.pow(Math.max(0, 1 - s / 0.22), 1.6);
  return new THREE.Vector3(side * (kb + (b - kb) * t), KEEL + (DECK - KEEL) * t, zb + (z - zb) * t);
}
/** The hull's skin from height fraction t0 to t1, both sides, 4 rows. */
function hullBand(t0: number, t1: number): THREE.BufferGeometry {
  const N = 44, R = 3, pos: number[] = [], idx: number[] = [];
  for (const side of [-1, 1]) {
    const base = pos.length / 3;
    for (let i = 0; i <= N; i++) for (let r = 0; r <= R; r++) { const v = hullAt(i / N, t0 + ((t1 - t0) * r) / R, side); pos.push(v.x, v.y, v.z); }
    for (let i = 0; i < N; i++) for (let r = 0; r < R; r++) { const a = base + i * (R + 1) + r, b = a + 1, c = a + R + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g.toNonIndexed();
}
/** The hull's flat bottom between the keel lines, and the transom. */
function hullEnds(): THREE.BufferGeometry[] {
  const N = 22, pos: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = hullAt(i / N, 0, 1), b = hullAt((i + 1) / N, 0, 1), c = hullAt(i / N, 0, -1), d = hullAt((i + 1) / N, 0, -1);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, b.x, b.y, b.z, d.x, d.y, d.z, c.x, c.y, c.z);
  }
  const bottom = new THREE.BufferGeometry(); bottom.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); bottom.computeVertexNormals();
  const q = [hullAt(1, 0, -1), hullAt(1, 0, 1), hullAt(1, 1, 1), hullAt(1, 1, -1)], tp = [0, 1, 2, 0, 2, 3].flatMap((i) => [q[i].x, q[i].y, q[i].z]);
  const transom = new THREE.BufferGeometry(); transom.setAttribute("position", new THREE.Float32BufferAttribute(tp, 3)); transom.computeVertexNormals();
  return [bottom, transom];
}
/** A block from its side profile ([z, y] points), `width` across (x), centred on x = 0. */
function block(pts: [number, number][], width: number): THREE.BufferGeometry {
  const shape = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  return new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(width / 2, 0, 0);
}
/** A rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, seg = 5): THREE.BufferGeometry {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** A flat window quad across the width at a raked front: the points are [z, y], pushed out along the face's normal by `off`. */
function slope(width: number, [z0, y0]: [number, number], [z1, y1]: [number, number], off: number, h = 0.8): THREE.BufferGeometry {
  const dz = z1 - z0, dy = y1 - y0, len = Math.hypot(dz, dy), nz = -dy / len, ny = dz / len;   // the outward normal: forward and up
  const lo = 0.5 - h / 2, hi = 0.5 + h / 2, p = (f: number) => [z0 + dz * f + nz * off, y0 + dy * f + ny * off];
  const [za, ya] = p(lo), [zb, yb] = p(hi);
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([-width / 2, ya, za, width / 2, ya, za, width / 2, yb, zb, -width / 2, ya, za, width / 2, yb, zb, -width / 2, yb, zb], 3));
}

export function dragonLady(): Yacht {
  const group = new THREE.Group();
  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, color: number) => parts.push({ geo, color });

  // ── the hull: white above a navy boot line, a flat bottom, the transom, the swim platform and its steps
  add(hullBand(0, 0.17), NAVY); add(hullBand(0.17, 1), WHITE);
  const [bottom, transom] = hullEnds(); add(bottom, NAVY); add(transom, WHITE);
  parts.push(P(new THREE.BoxGeometry(26, 0.5, 6), TEAK, { y: 2.6, z: L / 2 + 3 }), P(new THREE.BoxGeometry(8, 0.5, 2.4), TEAK, { y: 1.6, z: L / 2 + 7.2 }));

  // ── the main cabin, the bridge above it, their roofs' details, the mast arch with the radar and the antennas
  add(block([[-27, DECK], [-27, 13.5], [-25.5, 16.5], [3, 16.5], [3, DECK]], 31), WHITE);
  add(block([[-19, 16.5], [-19, 19], [-17.5, 21.5], [-3, 21.5], [-3, 16.5]], 22), WHITE);
  parts.push(P(new THREE.BoxGeometry(31.6, 0.35, 30.6), CREAM, { y: 16.6, z: -12.2 }), P(new THREE.BoxGeometry(22.6, 0.35, 16.6), CREAM, { y: 21.6, z: -10.8 }));
  for (const s of [-1, 1]) {
    add(rod(V(s * 9, 21.6, -8), V(s * 9, 29.5, -8), 0.35, 6), WHITE);
    parts.push(P(new THREE.SphereGeometry(1.1, 10, 6), WHITE, { x: s * 5.5, y: 22.4, z: -14 }));
  }
  add(rod(V(-9, 29.5, -8), V(9, 29.5, -8), 0.35, 6), WHITE);
  parts.push(P(new THREE.SphereGeometry(1.5, 10, 7), 0xf4f4f1, { y: 31.2, z: -8 }), P(new THREE.BoxGeometry(9, 0.25, 0.7), 0x4b515e, { y: 29.9, z: -8, ry: 0.5 }));
  for (const [x, h] of [[-6, 5.5], [-3, 3.5], [4, 4.5], [7, 6.5]] as const) add(rod(V(x, 29.6, -8), V(x, 29.6 + h, -8), 0.07, 4), STEEL);
  add(rod(V(0, 32.4, -8), V(0, 37, -8), 0.09, 4), STEEL);

  // ── the helipad at the bow with a little helicopter on it
  parts.push(P(new THREE.CylinderGeometry(9.5, 9.5, 0.25, 28), 0x585d6e, { y: DECK + 0.16, z: -49 }), P(new THREE.TorusGeometry(8.9, 0.2, 5, 36), 0xffd23f, { rx: Math.PI / 2, y: DECK + 0.32, z: -49 }));
  for (const x of [-2, 2]) parts.push(P(new THREE.BoxGeometry(0.7, 0.06, 6), 0xffffff, { x, y: DECK + 0.3, z: -49 }));
  parts.push(P(new THREE.BoxGeometry(4, 0.06, 0.7), 0xffffff, { y: DECK + 0.3, z: -49 }));
  const heli = (g: THREE.BufferGeometry, color: number) => add(g.translate(0, 0, -49), color);
  heli(new THREE.SphereGeometry(1, 12, 8).scale(1.5, 1.4, 3).translate(0, DECK + 2.8, 0), 0xd62828);
  heli(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2, 1.1, 1.6).translate(0, DECK + 3.2, -1.6), 0x26304a);
  heli(rod(V(0, DECK + 3, 2.4), V(0, DECK + 3.4, 8.2), 0.3, 5), 0xd62828); heli(new THREE.BoxGeometry(0.15, 1.8, 1.2).translate(0, DECK + 4.2, 8.1), 0xd62828);
  for (const s of [-1, 1]) { heli(rod(V(s * 1.5, DECK + 0.9, -2.8), V(s * 1.5, DECK + 0.9, 2.8), 0.12, 4), DARK); for (const z of [-1.4, 1.4]) heli(rod(V(s * 1.3, DECK + 1.6, z), V(s * 1.5, DECK + 0.9, z), 0.1, 4), DARK); }
  heli(rod(V(0, DECK + 4.2, 0), V(0, DECK + 5.2, 0), 0.2, 5), DARK);
  for (const a of [0.4, 0.4 + Math.PI / 2]) heli(new THREE.BoxGeometry(14, 0.1, 0.7).rotateY(a).translate(0, DECK + 5.25, 0), 0x3b4157);

  // ── the aft sun deck: the hot tub's rim over the drawing's water, loungers, a table; the flag's staff
  const tubAt = V(9.8, DECK + 0.5, 18.6);
  parts.push(P(new THREE.TorusGeometry(6.1, 0.55, 6, 28), 0xece9e0, { rx: Math.PI / 2, x: tubAt.x, y: tubAt.y, z: tubAt.z }));
  for (const [x, z] of [[-9, 34], [-9, 42], [9, 40], [9, 48], [-9, 52], [0, 56]] as const) {
    parts.push(P(new THREE.BoxGeometry(2.8, 0.8, 6.4), CREAM, { x, y: DECK + 0.6, z }), P(new THREE.BoxGeometry(2.8, 0.5, 2.2), 0xd9d3c0, { x, y: DECK + 1.5, z: z - 2.4, rx: -0.5 }));
  }
  add(rod(V(0, DECK, L / 2 - 2.5), V(0, 20.5, L / 2 - 2.5), 0.14, 5), 0xe9e4d6);
  const stripes = [0xe40303, 0xff8c00, 0xffed00, 0x008026, 0x24408e, 0x732982];
  stripes.forEach((c, k) => add(new THREE.PlaneGeometry(7.2, 0.7).rotateY(Math.PI / 2 - 0.35).translate(0, 20.2 - k * 0.7, L / 2 + 1.1), c));   // streaming aft, a little to one side so it shows from behind

  // ── the rails all round: posts every 6 ft with a rod along the top, round the bow and across the transom
  const post = (x: number, z: number) => add(rod(V(x, DECK, z), V(x, DECK + 3.2, z), 0.12, 5), STEEL);
  for (const side of [-1, 1]) {
    let prev: THREE.Vector3 | null = null;
    for (let s = 0.1; s <= 0.97; s += 6 / L) {
      const z = -L / 2 + s * L, x = side * (beam(s) - 0.7); post(x, z);
      const top = V(x, DECK + 3.2, z); if (prev) add(rod(prev, top, 0.07, 4), STEEL); prev = top;
    }
  }
  { let prev: THREE.Vector3 | null = null; for (let x = -HB * 0.94 + 0.7; x <= HB * 0.94 - 0.5; x += 5.8) { post(x, L / 2 - 0.6); const top = V(x, DECK + 3.2, L / 2 - 0.6); if (prev) add(rod(prev, top, 0.07, 4), STEEL); prev = top; } }
  const body = mergedParts(parts.map((p) => { const q = p.geo.index ? p.geo.toNonIndexed() : p.geo; q.deleteAttribute("uv"); return { ...p, geo: q }; }));   // all or none indexed, and the same attributes on every piece
  group.add(body);

  // ── the glass and the lights: windows (dark by day, warm at night), the hull's portholes, and the LED beads along the rails (a rainbow chase at night): one mesh, its vertex colours set by paint()
  const glass: THREE.BufferGeometry[] = [], windows: number[] = [], beads: { z: number; first: number; n: number }[] = [];
  const g = (geo: THREE.BufferGeometry, kind: "win" | "bead", z = 0) => {
    const n = geo.index ? geo.toNonIndexed() : geo, cnt = n.getAttribute("position").count;
    for (const name of Object.keys(n.attributes)) if (name !== "position") n.deleteAttribute(name);   // unlit: position and colour only, the same on every piece
    n.setAttribute("color", new THREE.BufferAttribute(new Float32Array(cnt * 3), 3));
    const first = glass.reduce((a, q) => a + q.getAttribute("position").count, 0);
    if (kind === "win") windows.push(first, cnt); else beads.push({ z, first, n: cnt });
    glass.push(n);
  };
  const b = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  for (const s of [-1, 1]) {
    g(b(0.14, 2.6, 24, s * 15.58, 12.7, -12), "win"); g(b(0.14, 2.2, 13.5, s * 11.07, 18.9, -10), "win");
    for (let z = -42; z <= 56; z += 5) { const sx = z / L + 0.5, h = hullAt(sx, 0.65, s); g(new THREE.BoxGeometry(0.1, 1.3, 1.5).rotateZ(-s * 0.42).translate(h.x + s * 0.02, h.y, z), "win"); }
    for (let z = -44; z <= 62; z += 3.2) { const sx = z / L + 0.5; g(b(0.55, 0.55, 0.55, s * (beam(sx) - 0.7), DECK + 3.4, z), "bead", z); }
  }
  g(slope(28.6, [-27, 13.5], [-25.5, 16.5], 0.12, 0.8), "win"); g(slope(21, [-19, 19], [-17.5, 21.5], 0.12, 0.8), "win");
  for (let x = -15; x <= 15; x += 3) g(b(0.55, 0.55, 0.55, x, DECK + 3.4, L / 2 - 0.5), "bead", L / 2);
  // ── the deck: the existing top-down illustration, laid at deck level, repainted as it is now; the glass and lights share its mesh (one draw call fewer): their vertices all point
  // at a white patch stamped on the canvas under the main cabin (nothing shows there), so the texture is white and the vertex colour is the colour
  const roof = carRoof("dragon-lady", 8);   // 8 px a foot, not 3: you look at it from a few feet up
  const cv = roof?.tex.image as HTMLCanvasElement | undefined, patch = cv ? { x: cv.width / 2, y: cv.height / 2 + -12 * 8 } : { x: 0, y: 0 };
  const cw = cv?.width ?? 2, ch = cv?.height ?? 2;
  for (const q of glass) { const n = q.getAttribute("position").count; q.setAttribute("uv", new THREE.BufferAttribute(Float32Array.from({ length: n * 2 }, (_, i) => (i % 2 ? 1 - patch.y / ch : patch.x / cw)), 2)); }
  if (roof) {
    const deck = new THREE.PlaneGeometry(roof.w, roof.l).rotateX(-Math.PI / 2).translate(0, DECK + 0.08, 0);
    deck.deleteAttribute("normal"); deck.setAttribute("color", new THREE.BufferAttribute(new Float32Array(deck.getAttribute("position").count * 3).fill(1), 3));
    glass.unshift(deck.toNonIndexed());
  }
  const glassGeo = mergeGeometries(glass)!;
  const colour = glassGeo.getAttribute("color") as THREE.BufferAttribute, deckVerts = roof ? 6 : 0;
  group.add(new THREE.Mesh(glassGeo, new THREE.MeshBasicMaterial({ map: roof?.tex ?? null, vertexColors: true, alphaTest: 0.04, side: THREE.DoubleSide })));
  const tmp = new THREE.Color(), fill = (first: number, n: number, c: THREE.Color) => { for (let v = first + deckVerts; v < first + deckVerts + n; v++) colour.setXYZ(v, c.r, c.g, c.b); };
  const stamp = () => { if (!cv) return; const x = cv.getContext("2d")!; x.fillStyle = "#fff"; x.fillRect(patch.x - 4, patch.y - 4, 8, 8); };

  let lastNight = -1;
  const paint = (t: number, night: number) => {
    roof?.paint(t, night); stamp();   // the drawing clears its canvas: the white patch the glass samples goes back on
    const lit = night > 0.3 ? 1 : 0;
    if (lit !== lastNight) { lastNight = lit; tmp.setHex(lit ? 0xffd98a : 0x1c2740, THREE.SRGBColorSpace); if (lit) tmp.multiplyScalar(1.5); for (let i = 0; i < windows.length; i += 2) fill(windows[i], windows[i + 1], tmp); }
    for (const bd of beads) {
      if (lit) { tmp.setHSL((((bd.z * 5 + t * 160) % 360) + 360) % 360 / 360, 1, 0.62, THREE.SRGBColorSpace).multiplyScalar(1.6); } else tmp.setHex(0xb8bcc8, THREE.SRGBColorSpace);
      fill(bd.first, bd.n, tmp);
    }
    colour.needsUpdate = true;
  };
  paint(0, 0);
  group.userData.ticket = { group, paint };
  return { group, paint, roof: DECK + 0.2 };
}
