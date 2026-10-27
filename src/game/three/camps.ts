import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BlockPlan } from "@/lib/camps";
import { H, LAYER, bikeColor, campPrisms, prismColor, sectorBlocks, type Prism, type PrismKind } from "@/lib/scene3d";

/** 0 by day, 1 at night: what the glowing things (the LED arches, the stages' lips, the canopies) multiply their colour by. Set once a frame by the renderer. */
export const nightUniform = { value: 0 };

/**
 * A cell's big shapes show within this many feet of the camera (any of its blocks counts), its small details (poles, flags, dome wire,
 * parked bikes, carpets, stage lips and canopies: most of the triangles and draw calls, and invisible past a few hundred feet) within DETAIL. A cell is
 * a wedge of the city cut into groups of RINGS_PER_GROUP rings (a whole wedge is 12 rings and about 4,600 ft deep: one test for the wedge
 * drew blocks that were 4,600 ft away as soon as any of its blocks was near).
 */
export const CULL = 2600, DETAIL = 900, RINGS_PER_GROUP = 4;

/**
 * Pieces are drawn by shape, not by what camp they belong to: every kind that is a plain box shares one unit box and one white
 * material (the colour is per instance), so the 66,000 pieces are about a dozen meshes per wedge of the city, and a wedge is only
 * drawn when one of its blocks is near.
 */
type Cls = "box" | "hemi" | "cone" | "carpet" | "canopy" | "pole" | "cloth" | "wire" | "arch" | "lip" | "bikes";
const CLASS: Record<PrismKind, Cls> = {
  rv: "box", "rv-roof": "box", "shade-roof": "box", shade: "box", couch: "box", stage: "box", speaker: "box", rack: "box", potty: "box",
  sign: "box", pod: "hemi", dome: "hemi", tent: "cone", carpet: "carpet", canopy: "canopy", pole: "pole", flag: "pole", "flag-cloth": "cloth",
  "dome-wire": "wire", arch: "arch", "stage-lip": "lip", "bike-row": "bikes", bikes: "bikes",
};
/** The small or sparse things, which are sub-pixel at a distance, are most of the triangles and cost a draw call in every cell showing them: they have the shorter cull radius. */
const DETAIL_CLASSES = new Set<Cls>(["pole", "cloth", "wire", "bikes", "carpet", "lip", "canopy"]);

/** A lit material that also glows at night: the instance's own colour times the night level is added to what it gives off. */
export function glowing(params: THREE.MeshLambertMaterialParameters, key: string, glow: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ color: 0xffffff, ...params });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform; shader.uniforms.uGlow = { value: glow };
    shader.fragmentShader = "uniform float uNight;\nuniform float uGlow;\n" + shader.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += vColor.rgb * uNight * uGlow;");
  };
  m.customProgramCacheKey = () => key;
  return m;
}

/** A hemisphere of diameter 1 with its base on y = 0 (a pod is 0.5 tall unscaled; scaled by (w, 14, l) it is 7 ft tall). */
const hemisphere = () => new THREE.SphereGeometry(0.5, 8, 2, 0, Math.PI * 2, 0, Math.PI / 2);

/** A dome's wire: an icosphere with the half below ground cut away, a hair outside the solid hemisphere. */
function domeWire(): THREE.BufferGeometry {
  const src = new THREE.IcosahedronGeometry(0.512, 1), pos = src.getAttribute("position"), keep: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    if (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2) < -1e-6) continue;
    for (let k = 0; k < 3; k++) keep.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
  }
  src.dispose();
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
}

/** An LED arch: two posts and a lintel, one merged shape per width. */
function archGeometry(w: number): THREE.BufferGeometry {
  const post = (x: number) => new THREE.BoxGeometry(1, H.arch, 1).translate(x, H.arch / 2, 0);
  return mergeGeometries([post(-w / 2), post(w / 2), new THREE.BoxGeometry(w, 1, 1).translate(0, H.arch, 0)])!;
}

/** One parked bike: a thin box 5.2 ft long (along Z) without its underside, the colour per instance. */
function bikeGeometry(): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(0.5, H.bike, 5.2).translate(0, H.bike / 2, 0), idx = Array.from(g.index!.array);
  g.setIndex(idx.filter((_, i) => i < 18 || i >= 24));   // BoxGeometry's faces are +x, -x, +y, -y, +z, -z, six indices each
  return g;
}

/** A pole as two crossed double-sided planes (4 triangles; a four-sided tube is 8): 0.6 ft across, 1 ft tall before the instance scale. */
function poleGeometry(): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(0.6, 1);
  return mergeGeometries([a, a.clone().rotateY(Math.PI / 2)])!;
}

export type CampMeshes = {
  group: THREE.Group;
  /** Show the wedges of the city that are near the camera (position in three.js axes). */
  update(cam: THREE.Vector3): void;
  /** How many pieces and meshes there are, and how many meshes are showing. */
  stats(): { prisms: number; meshes: number; shown: number };
};

/** The camps: every struct in the 192 blocks as instanced boxes, domes, poles, flags and bike rows, in one mesh per shape per wedge. */
export function buildCamps(scene: THREE.Scene, plans: readonly BlockPlan[]): CampMeshes {
  const prisms = campPrisms(plans), circles = sectorBlocks(plans);
  const group = new THREE.Group();

  // the shapes, each made once
  const box = new THREE.BoxGeometry(1, 1, 1), plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const geo = {
    box, lip: box, canopy: box, bikes: bikeGeometry(),
    hemi: hemisphere(),
    cone: new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4),   // its four corners sit on the axes otherwise; turned, its base is the square the struct is
    carpet: plane,
    pole: poleGeometry(),
    cloth: new THREE.PlaneGeometry(6, H.flagCloth),
    wire: domeWire(),
  };
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  // a carpet lies 0.1 ft over its block: pulled toward the camera by units only (see LAYER) so the ground flats never paint over it
  const carpet = new THREE.MeshLambertMaterial({ color: 0xffffff, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.carpet });
  const mat: Record<string, THREE.Material> = {
    box: white, hemi: white, cone: white, carpet, bikes: white,
    pole: new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    cloth: new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    wire: new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }),
    lip: glowing({}, "glow-lip", 0.9),
    arch: glowing({}, "glow-arch", 1),
    canopy: glowing({ transparent: true, opacity: 0.6, depthWrite: false }, "glow-canopy", 0.25),
  };
  const archs = new Map<number, THREE.BufferGeometry>();
  const shapeOf = (cls: Cls, p: Prism): { geometry: THREE.BufferGeometry; material: THREE.Material } => {
    if (cls === "arch") { const w = Math.round(p.w!); let g = archs.get(w); if (!g) archs.set(w, (g = archGeometry(w))); return { geometry: g, material: mat.arch }; }
    return { geometry: geo[cls], material: mat[cls] };
  };

  // bucket the pieces by shape and cell (and by width for arches)
  const groups = Math.ceil(12 / RINGS_PER_GROUP), cellOf = (sector: number, ring: number) => sector * groups + Math.floor(ring / RINGS_PER_GROUP);
  const buckets = new Map<string, { cls: Cls; cell: number; items: Prism[] }>();
  for (const p of prisms) {
    const cls = CLASS[p.kind], cell = cellOf(p.sector, p.ring), key = `${cls}|${cell}|${cls === "arch" ? Math.round(p.w!) : 0}`;
    let b = buckets.get(key); if (!b) buckets.set(key, (b = { cls, cell, items: [] }));
    b.items.push(p);
  }
  // each cell's own block circles
  const cellCircles: { cx: number; cy: number; br: number }[][] = Array.from({ length: circles.length * groups }, () => []);
  circles.forEach((blocks, sector) => { for (const b of blocks) cellCircles[cellOf(sector, b.ring)].push(b); });

  const byCell: { mesh: THREE.InstancedMesh; detail: boolean }[][] = Array.from({ length: cellCircles.length }, () => []);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (const { cls, cell, items } of buckets.values()) {
    const { geometry, material } = shapeOf(cls, items[0]);
    // a row of parked bikes is a piece of its own in scene3d.ts (n bikes `step` ft apart along its x from the first); here each bike is an instance
    const bikes = cls === "bikes" ? items.flatMap((p) => Array.from({ length: p.n! }, (_, k) => ({ p, k }))) : null;
    const mesh = new THREE.InstancedMesh(geometry, material, bikes ? bikes.length : items.length);
    if (bikes) {
      for (let i = 0; i < bikes.length; i++) {
        const { p, k } = bikes[i], along = k * p.step!;
        d.position.set(p.x + Math.cos(p.yaw) * along, p.y, p.z - Math.sin(p.yaw) * along); d.rotation.set(0, p.yaw, 0); d.scale.set(1, 1, 1); d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix); mesh.setColorAt(i, c.setHex(bikeColor(k), THREE.SRGBColorSpace));
      }
    } else items.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.yaw, 0); d.scale.set(p.sx, p.sy, p.sz); d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      mesh.setColorAt(i, c.setHex(prismColor(p), THREE.SRGBColorSpace));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.matrixAutoUpdate = false;   // never moves
    if (cls === "carpet") mesh.renderOrder = LAYER.carpet;
    group.add(mesh);
    byCell[cell].push({ mesh, detail: DETAIL_CLASSES.has(cls) });
  }
  scene.add(group);
  const counts = { prisms: prisms.length, meshes: buckets.size };   // numbers, not the arrays: the closures below must not keep the 66,541 pieces alive

  const nearest = (cx: number, cz: number, cell: number) => { let best = Infinity; for (const b of cellCircles[cell]) best = Math.min(best, Math.hypot(b.cx - cx, b.cy - cz) - b.br); return best; };
  let shown = 0;
  return {
    group,
    update(cam) {
      shown = 0;
      for (let s = 0; s < byCell.length; s++) {
        const near = nearest(cam.x, cam.z, s);
        for (const { mesh, detail } of byCell[s]) { mesh.visible = near < (detail ? DETAIL : CULL); if (mesh.visible) shown++; }
      }
    },
    stats: () => ({ ...counts, shown }),
  };
}
