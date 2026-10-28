import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LED_DAY, PYRAMID, faceAt, ledPhase, ledRgb } from "@/lib/pyramidStage";
import { nightUniform } from "./camps";
import { skinMaterial } from "./skinned";

/**
 * PlayAlchemist's Pyramid stage (src/lib/pyramidStage.ts has the plan): 70 ft tall on a 50 ft base, in the stage's own place, one face toward the parking bay with an opening in
 * it (the DJ's booth in a raised alcove: a back wall that glows warm, the table's lit top, the DJ a dark figure against it, two speaker stacks, a deck in front).
 * Two draw calls: the body (the four faces, the alcove and the booth: vertex colours, lit, with a per-vertex glow: the bay's face and the alcove glow at night, and the face
 * cycles warm to violet with the strips), and the LED strips along its four edges, its base and the opening's frame (unlit: vertex colours repainted at 20 Hz, pale by
 * day, warm to violet at night, over 1 in brightness so the glow pass blooms them). In the model's frame +x is toward the bay.
 */
export type PyramidMeshes = { update(g: { car: { x: number; y: number } }, t: number): void };

const { half: A, height: H, openHalf: OW, openH: OH, apron: AP, apronHalf: AW } = PYRAMID;
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A flat triangle fan or list into [positions, colours, glow] buffers. */
class Buf {
  pos: number[] = []; col: number[] = []; glow: number[] = [];
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, color: number, glow: number) {
    const k = new THREE.Color().setHex(color, THREE.SRGBColorSpace);
    for (const p of [a, b, c]) { this.pos.push(p.x, p.y, p.z); this.col.push(k.r, k.g, k.b); this.glow.push(glow); }
  }
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, color: number, glow: number) { this.tri(a, b, c, color, glow); this.tri(a, c, d, color, glow); }
  box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, glow: number) {
    const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(), p = g.getAttribute("position"), k = new THREE.Color().setHex(color, THREE.SRGBColorSpace);
    for (let i = 0; i < p.count; i++) { this.pos.push(p.getX(i) + x, p.getY(i) + y, p.getZ(i) + z); this.col.push(k.r, k.g, k.b); this.glow.push(glow); }
    g.dispose();
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3)); g.setAttribute("aGlow", new THREE.Float32BufferAttribute(this.glow, 1));
    g.computeVertexNormals();
    return g;
  }
}

/** The bay-facing face: the triangle (base ±A at y = 0, apex at H) with the opening cut from its foot, as triangles on the face's plane x = faceAt(y). */
function frontFace(buf: Buf, color: number, glow: number): void {
  const poly: [number, number][] = [[-A, 0], [-OW, 0], [-OW, OH], [OW, OH], [OW, 0], [A, 0], [0, H]];
  const idx = THREE.ShapeUtils.triangulateShape(poly.map(([u, y]) => new THREE.Vector2(u, y)), []);
  const at = ([u, y]: [number, number]) => V(faceAt(y), y, u);
  for (const [i, j, k] of idx) buf.tri(at(poly[i]), at(poly[j]), at(poly[k]), color, glow);
}

const PALE = 0xe9e2ff, SIDE = 0xcfc7ea, BACK = 0xb9b0d6, ALCOVE = 0x2b2150, WARM = 0xffb36b, DECK = 0x2a2440, TRUSS = 0x8f89aa;

export function buildPyramid(group: THREE.Group, stage: { x: number; y: number }, facing: number): PyramidMeshes {
  const root = new THREE.Group();
  root.position.set(stage.x, 0, stage.y); root.rotation.y = -facing;   // local +x toward the bay (the game's x east, y south are three's x and z)
  group.add(root);

  // ── the body
  const b = new Buf();
  frontFace(b, PALE, 0.9);
  const faceVerts = Array.from({ length: b.pos.length / 3 }, (_, i) => i);   // the bay's face is the first thing in the body: its vertices are the first ones
  const apex = V(0, H, 0), c = [V(A, 0, -A), V(A, 0, A), V(-A, 0, A), V(-A, 0, -A)];   // front-left, front-right, back-right, back-left
  b.tri(c[1], c[2], apex, SIDE, 0.05); b.tri(c[2], c[3], apex, BACK, 0.03); b.tri(c[3], c[0], apex, SIDE, 0.05);
  // the alcove: the walls and ceiling cut into the face (its back wall at 12 ft in), the booth's deck raised in it and out in front as an apron
  const F0 = faceAt(0), F1 = faceAt(OH), IN = F0 - 12;
  b.quad(V(IN, 0, -OW), V(IN, 0, OW), V(IN, OH, OW), V(IN, OH, -OW), WARM, 1.0);                       // the back wall
  b.quad(V(F0, 0, -OW), V(F1, OH, -OW), V(IN, OH, -OW), V(IN, 0, -OW), ALCOVE, 0.25);                   // the left wall
  b.quad(V(F0, 0, OW), V(IN, 0, OW), V(IN, OH, OW), V(F1, OH, OW), ALCOVE, 0.25);                       // the right wall
  b.quad(V(F1, OH, -OW), V(F1, OH, OW), V(IN, OH, OW), V(IN, OH, -OW), ALCOVE, 0.45);                   // the ceiling
  b.box(AP - IN, 2.5, 2 * AW, (AP + IN) / 2, 1.25, 0, DECK, 0.05);                                      // the deck, from the back wall out to the apron's edge
  // the booth: the table with its lit top, the DJ behind it, two stacks either side
  b.box(2.6, 3, 8, F0 - 6, 4, 0, 0x1d1a35, 0.0); b.box(2.2, 0.16, 7.6, F0 - 6, 5.58, 0, 0x8fe9ff, 1.5);
  b.box(0.8, 2.2, 1.1, F0 - 8.6, 3.6, 0, 0x14122a, 0); b.box(0.9, 2.3, 1.5, F0 - 8.6, 5.85, 0, 0x14122a, 0); b.box(1.0, 1.3, 1.3, F0 - 8.6, 7.7, 0, 0x14122a, 0);
  for (const s of [-1, 1]) { b.box(2.2, 4.8, 2.2, F0 - 9, 4.9, s * 5.4, 0x120f26, 0); b.box(0.2, 4.0, 1.6, F0 - 7.8, 4.9, s * 5.4, 0x4a4570, 0.2); }
  // two struts of truss across the face above the opening, the stage's own look
  b.box(0.7, 0.7, 2 * (A - 4), faceAt(OH + 3) + 0.4, OH + 3, 0, TRUSS, 0.1);
  const bodyGeo = b.geometry();
  const body = new THREE.Mesh(bodyGeo, skinMaterial());
  root.add(body);
  const faceCol = bodyGeo.getAttribute("color") as THREE.BufferAttribute;

  // ── the strips: segments 2.4 ft long with a 0.6 gap along the four sloped edges, the base's three sides (the opening's width left clear) and the opening's frame
  const segs: { a: THREE.Vector3; b: THREE.Vector3; s: number }[] = [];
  const along = (p: THREE.Vector3, q: THREE.Vector3, s0: number, skip?: (m: THREE.Vector3) => boolean) => {
    const len = p.distanceTo(q), n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i < n; i++) {
      const a0 = p.clone().lerp(q, i / n), a1 = p.clone().lerp(q, (i + 0.8) / n);
      if (skip?.(a0.clone().lerp(a1, 0.5))) continue;
      segs.push({ a: a0, b: a1, s: s0 + i });
    }
  };
  const out = (p: THREE.Vector3, k: number) => V(p.x + Math.sign(p.x) * k, p.y, p.z + Math.sign(p.z) * k);
  // the four sloped edges, lifted off the ridge a hair along the corner's outward diagonal
  c.forEach((p, i) => along(out(p, 0.3).setY(0.4), V(0.25 * Math.sign(p.x), H, 0.25 * Math.sign(p.z)).add(V(0, 0.2, 0)), i * 9));
  // the base: the back and the two sides, and the front on each side of the opening
  const base = (p: THREE.Vector3, q: THREE.Vector3, s0: number, skip?: (m: THREE.Vector3) => boolean) => along(V(p.x, 0.35, p.z), V(q.x, 0.35, q.z), s0, skip);
  base(V(-A - 0.35, 0, -A - 0.35), V(-A - 0.35, 0, A + 0.35), 40);
  base(V(-A - 0.35, 0, -A - 0.35), V(A + 0.35, 0, -A - 0.35), 70);
  base(V(-A - 0.35, 0, A + 0.35), V(A + 0.35, 0, A + 0.35), 100);
  base(V(A + 0.35, 0, -A - 0.35), V(A + 0.35, 0, A + 0.35), 130, (m) => Math.abs(m.z) < OW + 0.8);
  // the opening's frame: up the left, across the top, down the right, on the face
  const on = (u: number, y: number, k = 0.3) => V(faceAt(y) + k, y, u);
  along(on(-OW - 0.5, 0.4), on(-OW - 0.5, OH + 0.5), 150); along(on(-OW - 0.5, OH + 0.5), on(OW + 0.5, OH + 0.5), 160); along(on(OW + 0.5, OH + 0.5), on(OW + 0.5, 0.4), 170);
  const bar = new THREE.BoxGeometry(1, 0.5, 0.5), up = V(1, 0, 0), geos: THREE.BufferGeometry[] = [], first: number[] = [];
  for (const sg of segs) {
    const d = sg.b.clone().sub(sg.a), len = d.length(), g = bar.clone().scale(len, 1, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize())); const m = sg.a.clone().add(sg.b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z);
    const n = g.getAttribute("position").count; g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.deleteAttribute("normal"); g.deleteAttribute("uv");
    first.push(geos.reduce((a, q) => a + q.getAttribute("position").count, 0)); geos.push(g);
  }
  bar.dispose();
  const stripGeo = mergeGeometries(geos)!;
  geos.forEach((g) => g.dispose());
  const strips = new THREE.Mesh(stripGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  strips.frustumCulled = false;   // its bounding sphere is built from the strips' own vertices: right, but cheap to skip
  root.add(strips);
  const sc = stripGeo.getAttribute("color") as THREE.BufferAttribute, perSeg = 24, tmp = new THREE.Color();

  let last = -1, lastNight = -1;
  const paint = (t: number, night: number) => {
    const lit = Math.min(1, Math.max(0, (night - 0.2) / 0.3));
    segs.forEach((sg, i) => {
      const night0 = ledRgb(ledPhase(sg.s, t)), k = 1 + 0.5 * lit;
      tmp.setRGB(((LED_DAY[0] + (night0[0] - LED_DAY[0]) * lit) / 255) * k, ((LED_DAY[1] + (night0[1] - LED_DAY[1]) * lit) / 255) * k, ((LED_DAY[2] + (night0[2] - LED_DAY[2]) * lit) / 255) * k, THREE.SRGBColorSpace);
      for (let v = first[i]; v < first[i] + perSeg; v++) sc.setXYZ(v, tmp.r, tmp.g, tmp.b);
    });
    sc.needsUpdate = true;
    // the bay's face: pale by day, the strips' colour (half of it) at night, so its glow takes the colour too
    const mid = ledRgb(ledPhase(40, t));
    tmp.setRGB((233 + (mid[0] * 0.8 - 233) * lit) / 255, (226 + (mid[1] * 0.8 - 226) * lit) / 255, (255 + (mid[2] * 0.8 - 255) * lit) / 255, THREE.SRGBColorSpace);
    for (const v of faceVerts) faceCol.setXYZ(v, tmp.r, tmp.g, tmp.b);
    faceCol.needsUpdate = true;
  };
  paint(0, 0);
  return {
    update(g, t) {
      const night = nightUniform.value, d = Math.hypot(g.car.x - stage.x, g.car.y - stage.y);
      if (d > 3500 || (t - last < 0.05 && night === lastNight)) return;
      last = t; lastNight = night; paint(t, night);
    },
  };
}
