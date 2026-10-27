import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mergedParts, shaped as P, type Part } from "./materials";

/**
 * The Man (asked 2026-10-27, from Collin): the wooden lattice figure with his arms raised in a V, about 100 ft tall on a stepped wooden
 * pavilion about 50 ft high, so 150 ft to the top of his hands at this city's 1.5 times scale. The figure is a triangulated truss of thin
 * wooden members (a torso tapering from the shoulders to the waist, legs apart, arms up at 45 degrees, a hexagonal head), the base a generic
 * pavilion with a stair on the 6:00 side (no year's design: there is no reference for this year's). Neon tubes run along the silhouette's edges
 * and are the Man's own light by night; at night he burns: flames climbing the figure, embers drifting up, smoke above. Nothing of him is
 * ever culled by distance and none of his materials takes fog, so he is on the horizon from anywhere in the city: a wooden figure by day, a lit one by night.
 * Two meshes by day (the wood with the base, the neon) and two more at night (the fire, the smoke). All in the plaza, the figure inside the navy disc.
 */
export type ManMeshes = { update(night: number, t: number, camera: THREE.Camera): void };

export const BASE_H = 50;
/** The base's widest tier: inside the navy disc (80 x 1.6 = 128 ft) and the plaza (80 x 5 = 400 ft). */
export const BASE_RADIUS = 62;
/** Where the figure's hands reach, above the ground, and the flames' ceiling a little over them. */
export const MAN_TOP = BASE_H + 100;

type V = THREE.Vector3;
const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z);
const WOOD = 0xc9a36b, WOOD_DARK = 0xb08a55, WOOD_PALE = 0xd7b97f, PLINTH = 0x8a6d45;

/** A thin rod from a to b (four sides, open ended), already in place. */
function rod(a: V, b: V, r: number, seg = 4): THREE.BufferGeometry {
  const d = b.clone().sub(a), g = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5);
  return g.translate(m.x, m.y, m.z);
}

type Seg = { a: V; b: V };
/**
 * A limb as a three-dimensional truss from a to b (in the figure's x-y plane, which faces +Z): four rails tapering from width `wa` to `wb`
 * and `depth` thick, tied across at every station and braced with a zig-zag of diagonals on all four faces. Returns the members, and the two
 * front rails separately (the silhouette's edges, which carry the neon).
 */
function limb(a: V, b: V, wa: number, wb: number, depth: number, n: number): { wood: Seg[]; edge: Seg[] } {
  const wood: Seg[] = [], edge: Seg[] = [];
  const dir = b.clone().sub(a).normalize(), side = new THREE.Vector3(-dir.y, dir.x, 0);
  const corner = (i: number, sx: number, sz: number): V => {
    const k = i / n, c = a.clone().lerp(b, k), w = wa + (wb - wa) * k;
    return c.addScaledVector(side, (sx * w) / 2).add(v(0, 0, (sz * depth) / 2));
  };
  for (let i = 0; i <= n; i++) {
    wood.push({ a: corner(i, -1, 1), b: corner(i, 1, 1) }, { a: corner(i, -1, -1), b: corner(i, 1, -1) });   // across, front and back
    if (i === n) break;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const s = { a: corner(i, sx, sz), b: corner(i + 1, sx, sz) };   // the four rails
      wood.push(s); if (sz === 1) edge.push(s);
    }
    const z = i % 2 ? 1 : -1;   // the diagonals: front, back, and the two sides, alternating
    wood.push({ a: corner(i, -z, 1), b: corner(i + 1, z, 1) }, { a: corner(i, z, -1), b: corner(i + 1, -z, -1) });
    wood.push({ a: corner(i, -1, -z), b: corner(i + 1, -1, z) }, { a: corner(i, 1, z), b: corner(i + 1, 1, -z) });
  }
  return { wood, edge };
}

/** The hexagonal head: two hexagonal rings (front and back), tied, with spokes to a centre post. */
function head(c: V, r: number, depth: number): { wood: Seg[]; edge: Seg[] } {
  const wood: Seg[] = [], edge: Seg[] = [];
  const ring = (z: number) => Array.from({ length: 6 }, (_, k) => v(c.x + Math.cos((k / 6) * Math.PI * 2 + Math.PI / 6) * r, c.y + Math.sin((k / 6) * Math.PI * 2 + Math.PI / 6) * r, c.z + z));
  const f = ring(depth / 2), b = ring(-depth / 2), fc = v(c.x, c.y, c.z + depth / 2), bc = v(c.x, c.y, c.z - depth / 2);
  for (let k = 0; k < 6; k++) {
    const e = { a: f[k], b: f[(k + 1) % 6] }; wood.push(e, { a: b[k], b: b[(k + 1) % 6] }, { a: f[k], b: b[k] }, { a: fc, b: f[k] }, { a: bc, b: b[k] }, { a: f[k], b: b[(k + 1) % 6] });
    edge.push(e);
  }
  wood.push({ a: fc, b: bc });
  return { wood, edge };
}

/** The pavilion: a stepped octagonal base of five tiers, 50 ft high, with a stair of eight steps up its 6:00 face (+Z) to the first tier and a rail round the deck. */
function pavilion(): Part[] {
  const out: Part[] = [], oct = (r: number, h: number, y: number, color: number) => P(new THREE.CylinderGeometry(r, r, h, 8).rotateY(Math.PI / 8), color, { y: y + h / 2 });
  out.push(oct(BASE_RADIUS, 4, 0, PLINTH), oct(54, 10, 4, WOOD_DARK), oct(44, 12, 14, WOOD), oct(34, 14, 26, WOOD_DARK), oct(28, 10, 40, WOOD_PALE));
  for (let k = 0; k < 8; k++) { const h = 1.75 * (k + 1); out.push(P(new THREE.BoxGeometry(14, h, 2), PLINTH, { y: h / 2, z: 66 - 2 * k - 1 })); }   // the stair, to the first tier's top at 14 ft
  for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; out.push(P(new THREE.CylinderGeometry(0.5, 0.5, 4, 4), PLINTH, { x: Math.cos(a) * 26.5, y: BASE_H + 2, z: Math.sin(a) * 26.5 })); }   // the rail posts
  return out;
}

/** A soft teardrop of flame on a 64 x 128 canvas, a white-yellow core through orange to nothing, pointed at the top. */
function flameTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = 64; c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 92, 2, 32, 88, 46);
  g.addColorStop(0, "rgba(255, 252, 215, 1)"); g.addColorStop(0.3, "rgba(255, 205, 80, .95)"); g.addColorStop(0.65, "rgba(255, 110, 22, .55)"); g.addColorStop(1, "rgba(255, 60, 10, 0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 128);
  x.globalCompositeOperation = "destination-in";   // keep only the teardrop: a round bottom drawing to a point at the top, feathered
  const m = x.createLinearGradient(0, 0, 0, 128); m.addColorStop(0, "rgba(255,255,255,0)"); m.addColorStop(0.35, "rgba(255,255,255,.55)"); m.addColorStop(1, "rgba(255,255,255,1)");
  x.fillStyle = m; x.beginPath(); x.moveTo(32, 2); x.bezierCurveTo(46, 40, 62, 70, 58, 96); x.bezierCurveTo(54, 122, 10, 122, 6, 96); x.bezierCurveTo(2, 70, 18, 40, 32, 2); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function smokeTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!, g = x.createRadialGradient(32, 32, 2, 32, 32, 31);
  g.addColorStop(0, "rgba(255,255,255,.9)"); g.addColorStop(0.6, "rgba(255,255,255,.35)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Give a basic material a per-instance opacity from an attribute `aAlpha` (the way the wheel dust does). */
function withAlpha(m: THREE.MeshBasicMaterial, key: string): void {
  m.onBeforeCompile = (s) => {
    s.vertexShader = "attribute float aAlpha;\nvarying float vAlpha;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vAlpha = aAlpha;");
    s.fragmentShader = "varying float vAlpha;\n" + s.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  diffuseColor.a *= vAlpha;");
  };
  m.customProgramCacheKey = () => key;
}

const FLAMES = 120, EMBERS = 70, SMOKE = 8;
const rnd = (k: number) => { const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };

export function buildMan(group: THREE.Group): ManMeshes {
  // ── the figure: members of every limb, the head and the feet, in the figure's own frame lifted onto the base
  const up = (s: Seg): Seg => ({ a: s.a.clone().add(v(0, BASE_H, 0)), b: s.b.clone().add(v(0, BASE_H, 0)) });
  const members: Seg[] = [], edges: Seg[] = [];
  const add = (l: { wood: Seg[]; edge: Seg[] }) => { members.push(...l.wood.map(up)); edges.push(...l.edge.map(up)); };
  add(limb(v(0, 40), v(0, 70), 16, 30, 8, 6));                                           // the torso, tapering to the waist
  add(limb(v(0, 70), v(0, 76), 5, 5, 5, 1));                                              // the neck
  add(head(v(0, 84), 8, 8));
  for (const s of [-1, 1]) {
    add(limb(v(s * 6, 40), v(s * 17, 0), 9, 7, 7, 6));                                    // the legs, apart
    add(limb(v(s * 15, 68), v(s * 30, 84), 7, 6, 5, 3));                                  // the arms, up at about 45 degrees: upper arm
    add(limb(v(s * 30, 84), v(s * 45, 100), 6, 5, 5, 3));                                 // forearm to the hand, 100 ft above the feet
    members.push(up({ a: v(s * 17 - 5, 0, 0), b: v(s * 17 + 5, 0, 0) }));                // a foot beam each
  }
  const woodParts: Part[] = members.map((m, i) => ({ geo: rod(m.a, m.b, 0.85), color: i % 3 === 0 ? WOOD_DARK : WOOD }));
  const wood = mergedParts([...pavilion(), ...woodParts], new THREE.MeshLambertMaterial({ vertexColors: true, fog: false }));
  group.add(wood);
  // the neon along the silhouette's edges: unlit, so by night it is the figure's own light, and visible through any fog
  const neonMat = new THREE.MeshBasicMaterial({ color: 0xcff4ff, fog: false });
  const neon = new THREE.Mesh(mergeGeometries(edges.map((e) => rod(e.a, e.b, 1.3, 5)))!, neonMat);
  group.add(neon);

  // ── the fire: flames and embers in one instanced mesh of camera-facing teardrops with an additive texture, smoke in another
  const spawn = members.map((m) => m.a.clone().add(m.b).multiplyScalar(0.5));
  const fireMat = new THREE.MeshBasicMaterial({ map: flameTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  withAlpha(fireMat, "man-fire");
  const N = FLAMES + EMBERS, fAlpha = new THREE.InstancedBufferAttribute(new Float32Array(N), 1); fAlpha.setUsage(THREE.DynamicDrawUsage);
  const fGeo = new THREE.PlaneGeometry(1, 2); fGeo.setAttribute("aAlpha", fAlpha);
  const fire = new THREE.InstancedMesh(fGeo, fireMat, N);
  fire.frustumCulled = false; fire.visible = false; fire.renderOrder = 22; fire.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) fire.setColorAt(i, i < FLAMES ? c.setRGB(1, 0.86, 0.62) : c.setRGB(1, 0.8, 0.4));
  const smokeMat = new THREE.MeshBasicMaterial({ map: smokeTexture(), color: 0x2a2630, transparent: true, depthWrite: false, fog: false });
  withAlpha(smokeMat, "man-smoke");
  const sAlpha = new THREE.InstancedBufferAttribute(new Float32Array(SMOKE), 1); sAlpha.setUsage(THREE.DynamicDrawUsage);
  const sGeo = new THREE.PlaneGeometry(1, 1); sGeo.setAttribute("aAlpha", sAlpha);
  const smoke = new THREE.InstancedMesh(sGeo, smokeMat, SMOKE);
  smoke.frustumCulled = false; smoke.visible = false; smoke.renderOrder = 21; smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(fire, smoke);

  const d = new THREE.Object3D(), day = new THREE.Color(0xe6d8bd), lit = new THREE.Color(0xcff4ff);
  const face = (px: number, pz: number, cam: THREE.Vector3) => Math.atan2(cam.x - px, cam.z - pz);   // turn about Y to face the camera, the flame still upright
  return {
    update(night, t, camera) {
      // the neon is the Man's own light: pale and dim by day, blue-white at night
      neonMat.color.copy(day).lerp(lit, night);
      const level = night > 0.3 ? (night - 0.3) / 0.7 : 0;   // the fire comes up over the dusk
      fire.visible = smoke.visible = level > 0;
      if (level <= 0) return;
      const cam = camera.position, climb = BASE_H + level * (MAN_TOP + 20 - BASE_H);   // flames climb the figure from the base as the fire takes
      const k = Math.min(3.5, Math.max(1, Math.hypot(cam.x, cam.z) / 1800));   // from far off the flames grow, or a burning figure would be a speck: x1 within 1,800 ft, up to x3.5
      for (let i = 0; i < FLAMES; i++) {
        const s = spawn[Math.floor(rnd(i * 3 + 1) * spawn.length)], u = (t * (0.55 + rnd(i * 7 + 2) * 0.6) + rnd(i * 5 + 3)) % 1;
        const on = s.y <= climb ? 1 : 0, w = k * (5.5 + rnd(i * 11 + 4) * 6) * (0.3 + Math.sin(Math.PI * u) * 0.95) * (0.45 + 0.55 * level) * (0.85 + 0.15 * Math.sin(t * (9 + (i % 5)) + i)) * on;
        const x = s.x + Math.sin(t * 3 + i) * 1.5, y = s.y + u * 34, z = s.z + Math.cos(t * 2.3 + i * 1.7) * 1.5;
        d.position.set(x, y + w, z); d.rotation.set(0, face(x, z, cam), 0); d.scale.set(w, w, 1); d.updateMatrix(); fire.setMatrixAt(i, d.matrix);
        fAlpha.setX(i, on * 0.42 * Math.pow(Math.sin(Math.PI * u), 0.55) * Math.min(1, level * 1.6));
      }
      const kk = k;
      for (let k = 0; k < EMBERS; k++) {
        const i = FLAMES + k, s = spawn[Math.floor(rnd(k * 13 + 9) * spawn.length)], u = (t * (0.18 + rnd(k * 3 + 5) * 0.2) + rnd(k * 17 + 6)) % 1;
        const on = s.y <= climb ? 1 : 0, x = s.x + u * 50 + Math.sin(t * 2 + k) * 4, y = s.y + u * (70 + rnd(k * 19 + 7) * 70), z = s.z + Math.cos(t * 1.7 + k) * 5, w = (1.1 + rnd(k * 23 + 8) * 1.6) * Math.sqrt(kk) * on;
        d.position.set(x, y, z); d.rotation.set(0, face(x, z, cam), 0); d.scale.set(w, w, 1); d.updateMatrix(); fire.setMatrixAt(i, d.matrix);
        fAlpha.setX(i, on * 0.85 * (1 - u) * Math.min(1, level * 1.6));
      }
      fire.count = N; fire.instanceMatrix.needsUpdate = true; fAlpha.needsUpdate = true;
      if (fire.instanceColor) fire.instanceColor.needsUpdate = true;
      for (let k = 0; k < SMOKE; k++) {
        const u = (t * 0.06 + k / SMOKE) % 1, x = 10 + u * 120 + Math.sin(k * 2.1) * 12, y = MAN_TOP + 15 + u * 150, z = Math.cos(k * 3.3) * 14, w = 40 + u * 70;
        d.position.set(x, y, z); d.quaternion.copy(camera.quaternion); d.scale.set(w, w, 1); d.updateMatrix(); smoke.setMatrixAt(k, d.matrix);
        sAlpha.setX(k, 0.22 * Math.sin(Math.PI * u) * level);
      }
      d.quaternion.identity();
      smoke.instanceMatrix.needsUpdate = true; sAlpha.needsUpdate = true;
    },
  };
}

