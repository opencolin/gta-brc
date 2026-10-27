import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { nightUniform } from "./camps";

/**
 * Small skinned models (PLAN-3D.md, the rider and bike): one SkinnedMesh per ride type, every shape merged into one geometry with its colour baked in as a
 * vertex colour and bound at full weight to one bone, so a wheel turns, a crank swings and a leg bends by moving a handful of bones (about 18 for a rider on a bike)
 * and the whole ride is one draw call. The shapes are built in the model's rest pose, in the model's own frame (forward -Z, right +X, up +Y, the ground at y = 0);
 * a bone stands where its joint is in that pose and turns about its own origin, so a part needs no offset to turn with its bone.
 */
export type BoneDef = { name: string; parent?: string; at: [number, number, number] };
/** A shape in place, the bone that carries it, its colour, and how much it gives off at night (0: nothing; 1: its own colour, lit from within). */
export type SkinPart = { geo: THREE.BufferGeometry; color: number; bone: string; glow?: number };
export type Skinned = { mesh: THREE.SkinnedMesh; bones: Record<string, THREE.Bone>; list: THREE.Bone[] };

/** The one material every skinned ride shares: lit by the scene's lamps, the vertex colour as the surface, and `aGlow` times the night's level times the colour added as light. */
export function skinMaterial(): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = nightUniform;
    s.vertexShader = "attribute float aGlow;\nvarying float vGlow;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vGlow = aGlow;");
    s.fragmentShader = "uniform float uNight;\nvarying float vGlow;\n" + s.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * uNight * vGlow;");
  };
  m.customProgramCacheKey = () => "skin-glow";
  return m;
}

/** The bones from their definitions (in order: a bone's parent comes before it) and the merged, skinned mesh over them, bound in the rest pose. */
export function skinnedModel(defs: BoneDef[], parts: SkinPart[], material: THREE.Material): Skinned {
  const list: THREE.Bone[] = [], bones: Record<string, THREE.Bone> = {}, at: Record<string, [number, number, number]> = {};
  for (const d of defs) {
    const b = new THREE.Bone(); b.name = d.name;
    const p = d.parent ? at[d.parent] : [0, 0, 0];
    b.position.set(d.at[0] - p[0], d.at[1] - p[1], d.at[2] - p[2]);
    (d.parent ? bones[d.parent] : null)?.add(b);
    at[d.name] = d.at; bones[d.name] = b; list.push(b);
  }
  const c = new THREE.Color(), index = Object.fromEntries(defs.map((d, i) => [d.name, i]));
  const geos = parts.map(({ geo, color, bone, glow = 0 }) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    const n = g.getAttribute("position").count, col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), gl = new Float32Array(n);
    c.setHex(color, THREE.SRGBColorSpace);
    for (let i = 0; i < n; i++) { col.set([c.r, c.g, c.b], i * 3); si[i * 4] = index[bone]; sw[i * 4] = 1; gl[i] = glow; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4)); g.setAttribute("aGlow", new THREE.BufferAttribute(gl, 1));
    geo.dispose();
    return g;
  });
  const mesh = new THREE.SkinnedMesh(mergeGeometries(geos)!, material);
  for (const g of geos) g.dispose();
  for (const d of defs) if (!d.parent) mesh.add(bones[d.name]);
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  mesh.frustumCulled = false;   // the bounding sphere is the rest pose's: a leaning, pedalling rider would be culled at the screen's edge
  return { mesh, bones, list };
}

const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Quaternion(), pq = new THREE.Quaternion();
/**
 * Point `bone` (which hangs along `rest`, a direction in its own frame, in the rest pose) at the world point `to`: its rotation is set from the way its parent
 * is turned, so call it for a parent before its child. The bone's own origin is where it stands now.
 */
export function aim(bone: THREE.Bone, rest: THREE.Vector3, to: THREE.Vector3): void {
  bone.parent!.updateWorldMatrix(true, false);
  bone.updateWorldMatrix(false, false);
  a.setFromMatrixPosition(bone.matrixWorld); b.copy(to).sub(a).normalize();
  bone.parent!.getWorldQuaternion(pq);
  q.setFromUnitVectors(rest, b.applyQuaternion(pq.invert()));
  bone.quaternion.copy(q);
  bone.updateWorldMatrix(false, false);
}

/**
 * The middle joint of a two-bone limb from `root` to `target` with segments of length l1 and l2: on the circle the two lengths allow, as far toward `pole` (a direction)
 * as the limb can bend that way; a target out of reach straightens the limb toward it. Written into `out` (world space).
 */
export function joint(root: THREE.Vector3, target: THREE.Vector3, l1: number, l2: number, pole: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
  const d = target.clone().sub(root), len = Math.min(Math.max(d.length(), Math.abs(l1 - l2) + 1e-3), l1 + l2 - 1e-3), dir = d.normalize();
  const along = (l1 * l1 - l2 * l2 + len * len) / (2 * len), h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const side = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (side.lengthSq() < 1e-9) side.set(0, 1, 0).sub(dir.clone().multiplyScalar(dir.y));
  return out.copy(root).addScaledVector(dir, along).addScaledVector(side.normalize(), h);
}
