import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * Shared materials, one per colour: a thousand boxes of the same colour are one material, and a rebuild after a lost GL
 * context starts a fresh set (clearMaterials). Colours are 0xRRGGBB in sRGB, the way the 2D painter's CSS colours are.
 */
const lamberts = new Map<number, THREE.MeshLambertMaterial>();
const basics = new Map<string, THREE.MeshBasicMaterial>();
const vertexLamberts = new Map<THREE.Side, THREE.MeshLambertMaterial>();

/** A lit matte material (camps, rides, landmarks). */
export function lambert(hex: number): THREE.MeshLambertMaterial {
  let m = lamberts.get(hex);
  if (!m) lamberts.set(hex, (m = new THREE.MeshLambertMaterial({ color: hex })));
  return m;
}

/** The options `basic()` can cache by value: plain numbers and flags. Anything holding an object (a texture) is built with `new THREE.MeshBasicMaterial` by the caller; stringifying a texture would encode its whole canvas as a PNG. */
export type BasicOpts = Pick<THREE.MeshBasicMaterialParameters, "side" | "depthWrite" | "transparent" | "opacity" | "fog" | "polygonOffset" | "polygonOffsetFactor" | "polygonOffsetUnits">;

/** An unlit material: exactly the colour, for the ground, which shows the 2D painter's own colours. */
export function basic(hex: number, opts: BasicOpts = {}): THREE.MeshBasicMaterial {
  const key = hex + JSON.stringify(opts);
  let m = basics.get(key);
  if (!m) basics.set(key, (m = new THREE.MeshBasicMaterial({ color: hex, ...opts })));
  return m;
}

/** Forget the cached materials (the scene that held them has been disposed). */
export function clearMaterials(): void { lamberts.clear(); basics.clear(); vertexLamberts.clear(); }

/** "#rrggbb" as 0xRRGGBB. */
export const hex = (css: string) => parseInt(css.slice(1), 16);

/**
 * Many copies of one shape in one draw call: each placed by (x, y, z, yaw, sx, sy, sz) with its own colour. For the few dozen
 * of a kind (fence posts, hangars, booths); the camps' tens of thousands are built in camps.ts.
 */
export function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, items: { x: number; y: number; z: number; yaw?: number; sx?: number; sy?: number; sz?: number; color?: number }[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  const d = new THREE.Object3D(), c = new THREE.Color();
  items.forEach((it, i) => {
    d.position.set(it.x, it.y, it.z); d.rotation.set(0, it.yaw ?? 0, 0); d.scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1); d.updateMatrix();
    mesh.setMatrixAt(i, d.matrix);
    if (it.color !== undefined) mesh.setColorAt(i, c.setHex(it.color, THREE.SRGBColorSpace));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** A shape already in place: a geometry (built-in shapes carry position, normal and uv) and its colour. */
export type Part = { geo: THREE.BufferGeometry; color: number };
/** `geo` turned about Y by `yaw` and moved to (x, y, z): the placement a mesh's position and rotation.y would give. */
export const placed = (geo: THREE.BufferGeometry, x: number, y: number, z: number, yaw = 0): THREE.BufferGeometry => geo.rotateY(yaw).translate(x, y, z);

/**
 * A landmark's many one-off shapes in several colours as one mesh and so one draw call: each part's colour is baked in as a vertex
 * colour under one shared lit material (or the one given), two-sided (the flags and the like have no back).
 */
export function mergedParts(parts: Part[], material?: THREE.Material): THREE.Mesh {
  const c = new THREE.Color();
  for (const { geo, color } of parts) {
    c.setHex(color, THREE.SRGBColorSpace);
    const n = geo.getAttribute("position").count, col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  }
  const merged = mergeGeometries(parts.map((p) => p.geo))!;
  parts.forEach((p) => p.geo.dispose());
  if (material) return new THREE.Mesh(merged, material);
  let m = vertexLamberts.get(THREE.DoubleSide);
  if (!m) vertexLamberts.set(THREE.DoubleSide, (m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  return new THREE.Mesh(merged, m);
}
