import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { shaped, type Xf } from "./materials";
import { skinMaterial } from "./skinned";

/**
 * What the creature art cars (Disco Doge, the Axolotl, Kuker: asked 2026-10-31) are built from: shapes in a colour, each with how much it gives off at night,
 * merged into one mesh under the skinned rides' material (skinned.ts skinMaterial: lit, the vertex colour as the surface, `glow` times the night's level added as
 * light), so a model is one draw call per moving part and lights up at night with no repainting. Like the other models (goldenTicket.ts) forward is -Z, right +X,
 * the ground y = 0, the car's centre the drawing's; `paint` only moves the parts (a tail, a mirrorball), so cars.ts may call it every frame.
 */
export type Critter = { group: THREE.Group; paint(t: number, night: number): void; /** how high a ride on top of it stands */ roof: number; /** paint() is only motion: call it every frame while near */ live: true };
export type GlowPart = { geo: THREE.BufferGeometry; color: number; glow: number };

/** A shape in a colour, scaled, turned and moved as `o` says (materials.ts shaped), giving off `glow` at night. */
export const G = (geo: THREE.BufferGeometry, color: number, o: Xf = {}, glow = 0): GlowPart => ({ ...shaped(geo, color, o), glow });

/** A tapered rod from a to b, radius r0 at a and r1 at b. */
export function rod(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, color: number, glow = 0, seg = 6): GlowPart {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  geo.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return { geo, color, glow };
}

/** An ellipsoid of half-sizes (sx, sy, sz) at (x, y, z), with w x h segments. */
export const blob = (sx: number, sy: number, sz: number, x: number, y: number, z: number, color: number, glow = 0, w = 14, h = 10, o: Xf = {}): GlowPart =>
  G(new THREE.SphereGeometry(1, w, h), color, { sx, sy, sz, x, y, z, ...o }, glow);

/** The parts as one mesh: non-indexed, only position and normal kept (so boxes, spheres and extrusions merge), the colour and the glow per vertex. `flat`: faceted normals. */
export function glowMesh(parts: GlowPart[], flat = false): THREE.Mesh {
  const c = new THREE.Color();
  const geos = parts.map(({ geo, color, glow }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    if (flat || !g.getAttribute("normal")) g.computeVertexNormals();
    const n = g.getAttribute("position").count, col = new Float32Array(n * 3), gl = new Float32Array(n).fill(glow);
    c.setHex(color, THREE.SRGBColorSpace);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("aGlow", new THREE.BufferAttribute(gl, 1));
    return g;
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos)!, skinMaterial());
  for (const g of geos) g.dispose();
  return mesh;
}

/** Four plain wheels on an axle at each z, x ±track, radius r, w wide, standing on the ground. */
export const tyres = (track: number, zs: number[], r: number, w: number): GlowPart[] =>
  zs.flatMap((z) => [-1, 1].map((s) => G(new THREE.CylinderGeometry(r, r, w, 12), 0x15161d, { rz: Math.PI / 2, x: s * track, y: r, z })));

/** The model's group with its paint hook, as cars.ts expects of a model (the same userData hook as goldenTicket.ts). */
export function critter(group: THREE.Group, paint: (t: number, night: number) => void, roof: number): Critter {
  paint(0, 0);
  group.userData.ticket = { group, paint };
  return { group, paint, roof, live: true };
}
