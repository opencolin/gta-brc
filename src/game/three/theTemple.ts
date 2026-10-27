import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TEMPLE } from "@/lib/brc";
import { ARMS, CROWN_LEN, CROWN_N, FENCE_R, GATES, STEMS, TOWER_H, TOWER_R, armLength, armPoint, gateAngle, outerPetals, stemPoint, stemTip } from "@/lib/templeMoon";
import { glowing } from "./camps";

/**
 * The Temple of the Moon (BRC 2026, TEMPLE-2026.md; the plan is src/lib/templeMoon.ts): a night-blooming cactus flower in pale unpainted
 * timber, 300 ft across at this city's scale. Outside in: a low lattice fence with eight faceted moon gates (ten panels each) and globe lamps
 * on its posts; twenty free-standing pointed petals in a ring, each turned off the radius so there is no straight way in; five crescent walls
 * of closely spaced vertical slats leaving the tower in a pinwheel and folding back on themselves; the tower, a pentagon of pillars with five
 * archways between them, crowned by sixteen pointed petals that close by day and open at night; and the stamen, eight slender bent stems each
 * tipped with a glowing globe, rising to about 76 ft. One mesh for all the timber, the gates, the lamps and the stamen, one instanced mesh for the
 * crown (so it can open): everything is pale timber by day and glows amber from within at night (each vertex's colour is what it gives off, the
 * gates, globes and lamps brighter than the timber). None of it takes fog, so the rings and the globes read from across the playa.
 */
export type TempleMeshes = { update(night: number): void };

const TIMBER = 0xe0c690, TIMBER_DARK = 0xb08a55, TIMBER_PALE = 0xeed9aa, STEM = 0x6b4f33;
/** A part: a geometry, its colour, and a gain on that colour (above 1: it gives off more at night than plain timber, and is white-hot by day). */
type Piece = { geo: THREE.BufferGeometry; color: number; gain?: number };

/** A thin four-sided rod from a to b, already in place. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number): THREE.BufferGeometry {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), 4, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}
/** The pieces baked into one geometry with vertex colours (and a gain). */
function bake(pieces: Piece[]): THREE.BufferGeometry {
  const c = new THREE.Color();
  const geos = pieces.map(({ geo, color, gain = 1 }) => {
    const g = geo.index ? geo : geo.clone();
    c.setHex(color, THREE.SRGBColorSpace);
    const n = g.getAttribute("position").count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r * gain; col[i * 3 + 1] = c.g * gain; col[i * 3 + 2] = c.b * gain; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    return g;
  });
  return mergeGeometries(geos)!;
}
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const at = (x: number, y: number) => ({ x: TEMPLE.x + x, z: TEMPLE.y + y });   // a plan point (x, y south) as the world's (x, z)

export function buildTemple(group: THREE.Group): TempleMeshes {
  const P: Piece[] = [];
  const push = (geo: THREE.BufferGeometry, color: number, gain?: number) => P.push({ geo, color, gain });

  // ── the fence: 48 posts a ring, offset half a step so each gate (at the multiples of 45 degrees) is in the middle of a panel; lattice panels of two
  // diagonals and two rails between the posts, none where a gate stands, a globe lamp on every fourth post
  const N = 48, FH = 5.5, STEP = (2 * Math.PI) / N, per = N / GATES;
  const post = (k: number) => { const a = (k + 0.5) * STEP, p = at(Math.cos(a) * FENCE_R, Math.sin(a) * FENCE_R); return { x: p.x, z: p.z }; };
  for (let k = 0; k < N; k++) {
    const p0 = post(k), p1 = post(k + 1);
    push(new THREE.BoxGeometry(1.1, FH + 0.5, 1.1).translate(p0.x, (FH + 0.5) / 2, p0.z), TIMBER_DARK);
    if (k % 4 === 0) push(new THREE.SphereGeometry(1.5, 6, 4).translate(p0.x, FH + 2.2, p0.z), 0xfff0c8, 3);   // a globe lamp
    if ((k + 1) % per === 0) continue;   // the gap a moon gate stands in
    const A0 = v(p0.x, 0.3, p0.z), A1 = v(p0.x, FH, p0.z), B0 = v(p1.x, 0.3, p1.z), B1 = v(p1.x, FH, p1.z);
    push(rod(A0, B1, 0.3), TIMBER); push(rod(A1, B0, 0.3), TIMBER); push(rod(A1, B1, 0.4), TIMBER_DARK); push(rod(A0, B0, 0.4), TIMBER_DARK);
  }
  // the moon gates: a faceted ring (ten panels), 14 ft across, standing in the fence line with its axis along the radius
  for (let j = 0; j < GATES; j++) {
    const a = gateAngle(j), p = at(Math.cos(a) * FENCE_R, Math.sin(a) * FENCE_R);
    push(new THREE.TorusGeometry(6.6, 0.95, 4, 10).rotateY(Math.PI / 2 - a).translate(p.x, 7.6, p.z), 0xffd596, 2.2);
  }

  // ── twenty outer petals: half-shells of a cone lying on their sides, tip up and out, turned off the radius
  for (const p of outerPetals()) {
    const g = new THREE.ConeGeometry(p.wid / 2, p.len, 6, 1, true, 0, Math.PI).translate(0, p.len / 2, 0);
    g.rotateY(-Math.PI / 2).rotateZ(-(Math.PI / 2 - Math.atan2(p.h, p.len))).rotateY(-p.a);   // axis laid along its heading, rising to the tip's height
    const w = at(p.x, p.y);
    push(g.translate(w.x, 0.2, w.z), TIMBER_PALE);
  }

  // ── five crescent walls of vertical slats, 3 ft apart, with a rail along the top
  for (let k = 0; k < ARMS; k++) {
    const len = armLength(k), n = Math.round(len / 3);
    let prevTop: THREE.Vector3 | null = null;
    for (let i = 0; i <= n; i++) {
      const s = armPoint(k, i / n), w = at(s.x, s.y);
      push(new THREE.BoxGeometry(1.5, s.h, 0.7).translate(0, s.h / 2, 0).rotateY(-s.a).translate(w.x, 0, w.z), i % 3 === 0 ? TIMBER_DARK : TIMBER);
      const top = v(w.x, s.h + 0.2, w.z);
      if (prevTop) push(rod(prevTop, top, 0.45), TIMBER_DARK);
      prevTop = top;
    }
  }

  // ── the tower: a pentagon of pillars (five archways between them), a ring beam, a floor
  for (let k = 0; k < 5; k++) {
    const a0 = -Math.PI / 2 + (k * 2 * Math.PI) / 5, a1 = a0 + (2 * Math.PI) / 5, p0 = at(Math.cos(a0) * TOWER_R, Math.sin(a0) * TOWER_R), p1 = at(Math.cos(a1) * TOWER_R, Math.sin(a1) * TOWER_R);
    push(new THREE.BoxGeometry(2.6, TOWER_H, 2.6).translate(p0.x, TOWER_H / 2, p0.z), TIMBER);
    push(rod(v(p0.x, TOWER_H, p0.z), v(p1.x, TOWER_H, p1.z), 0.9), TIMBER_DARK);
    push(rod(v(p0.x, TOWER_H - 7, p0.z), v(p1.x, TOWER_H - 7, p1.z), 0.5), TIMBER_DARK);
  }
  push(new THREE.CylinderGeometry(TOWER_R + 3, TOWER_R + 3, 0.8, 5).rotateY(Math.PI / 10).translate(TEMPLE.x, 0.4, TEMPLE.y), TIMBER_DARK);

  // ── the stamen: eight bent stems from the chamber's floor, a glowing globe at the end of each
  for (let k = 0; k < STEMS; k++) {
    let prev: THREE.Vector3 | null = null;
    for (let i = 0; i <= 7; i++) { const q = stemPoint(k, i / 7), w = at(q.x, q.y), cur = v(w.x, q.h, w.z); if (prev) push(rod(prev, cur, 0.55), STEM); prev = cur; }
    const t = stemTip(k), w = at(t.x, t.y);
    push(new THREE.SphereGeometry(2.7, 8, 6).translate(w.x, t.h + 2.2, w.z), 0xfff3d4, 3);
  }

  // the one mesh of everything fixed: timber by day, amber from within at night, no fog
  const body = new THREE.Mesh(bake(P), glowing({ vertexColors: true, side: THREE.DoubleSide, fog: false }, "glow-temple", 0.4));
  group.add(body);

  // ── the crown: sixteen pointed petals hinged round the tower's top ring, an instanced mesh whose petals lean in by day (a closed bud) and open out at night
  const petal = new THREE.ConeGeometry(3.2, CROWN_LEN, 4).scale(1, 1, 0.28).translate(0, CROWN_LEN / 2, 0);
  const crown = new THREE.InstancedMesh(petal, glowing({ side: THREE.DoubleSide, fog: false }, "glow-crown", 0.45), CROWN_N);
  crown.frustumCulled = false;
  const col = new THREE.Color();
  for (let i = 0; i < CROWN_N; i++) crown.setColorAt(i, col.setHex(i % 2 ? TIMBER_PALE : TIMBER, THREE.SRGBColorSpace));
  group.add(crown);
  const d = new THREE.Object3D();
  d.rotation.order = "YZX";
  let last = -1;
  const place = (open: number) => {
    // closed: leaning 7 degrees inward; open: flared 62 degrees outward, like a tulip
    const tilt = -0.12 + open * (1.08 + 0.12);
    for (let i = 0; i < CROWN_N; i++) {
      const b = (i / CROWN_N) * Math.PI * 2, w = at(Math.cos(b) * (TOWER_R - 1.5), Math.sin(b) * (TOWER_R - 1.5));
      d.position.set(w.x, TOWER_H, w.z); d.rotation.set(0, -b, -tilt); d.updateMatrix(); crown.setMatrixAt(i, d.matrix);
    }
    crown.instanceMatrix.needsUpdate = true;
  };
  place(0);
  return {
    update(night) {
      // it opens at sunset and closes at sunrise: the night level opens it, smoothly
      const open = night * night * (3 - 2 * night);
      if (Math.abs(open - last) > 0.004) { last = open; place(open); }
    },
  };
}
