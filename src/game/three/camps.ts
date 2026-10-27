import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { BlockPlan } from "@/lib/camps";
import { BIKE_SPACING, H, bikeColor, campPrisms, prismColor, sectorBlocks, type Prism, type PrismKind } from "@/lib/scene3d";

/** 0 by day, 1 at night: what the glowing things (the LED arches, the stages' lips, the canopies) multiply their colour by. Set once a frame by the renderer. */
export const nightUniform = { value: 0 };

/** A sector's big shapes show within this many feet of the camera (any of its blocks counts), its small details within DETAIL. */
export const CULL = 2600, DETAIL = 1500;

/**
 * Pieces are drawn by shape, not by what camp they belong to: every kind that is a plain box shares one unit box and one white
 * material (the colour is per instance), so the 66,000 pieces are about a dozen meshes per wedge of the city, and a wedge is only
 * drawn when one of its blocks is near.
 */
type Cls = "box" | "sign" | "hemi" | "cone" | "carpet" | "canopy" | "pole" | "cloth" | "wire" | "arch" | "lip" | "bikes";
const CLASS: Record<PrismKind, Cls> = {
  rv: "box", "rv-roof": "box", "shade-roof": "box", shade: "box", couch: "box", stage: "box", speaker: "box", rack: "box", potty: "box",
  sign: "sign", pod: "hemi", dome: "hemi", tent: "cone", carpet: "carpet", canopy: "canopy", pole: "pole", flag: "pole", "flag-cloth": "cloth",
  "dome-wire": "wire", arch: "arch", "stage-lip": "lip", "bike-row": "bikes", bikes: "bikes",
};
/** The small things, which are sub-pixel at a distance and are most of the triangles: they have the shorter cull radius. */
const DETAIL_CLASSES = new Set<Cls>(["pole", "cloth", "sign", "wire", "bikes"]);

/** A lit material that also glows at night: the instance's own colour times the night level is added to what it gives off. */
function glowing(params: THREE.MeshLambertMaterialParameters, key: string, glow: number): THREE.MeshLambertMaterial {
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

/** A row of n parked bikes, 4.2 ft apart along X, each its own colour (baked as vertex colours), one box a bike. Shared by every row of that n. */
function bikeRowGeometry(n: number): THREE.BufferGeometry {
  const c = new THREE.Color(), parts: THREE.BufferGeometry[] = [];
  for (let k = 0; k < n; k++) {
    const g = new THREE.BoxGeometry(0.5, H.bike, 5.2).translate((k - (n - 1) / 2) * BIKE_SPACING, H.bike / 2, 0);
    const col = new Float32Array(g.getAttribute("position").count * 3); c.setHex(bikeColor(k), THREE.SRGBColorSpace);
    for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    parts.push(g);
  }
  return mergeGeometries(parts)!;
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
    box, sign: box, lip: box, canopy: box,
    hemi: hemisphere(),
    cone: new THREE.ConeGeometry(0.5, 1, 4).rotateY(Math.PI / 4),   // its four corners sit on the axes otherwise; turned, its base is the square the struct is
    carpet: plane,
    pole: new THREE.CylinderGeometry(0.3, 0.3, 1, 4, 1, true),
    cloth: new THREE.PlaneGeometry(6, H.flagCloth),
    wire: domeWire(),
  };
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mat: Record<string, THREE.Material> = {
    box: white, hemi: white, cone: white, carpet: white, pole: white,
    sign: new THREE.MeshLambertMaterial({ color: 0xffffff }),
    cloth: new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }),
    wire: new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }),
    lip: glowing({}, "glow-lip", 0.9),
    arch: glowing({}, "glow-arch", 1),
    canopy: glowing({ transparent: true, opacity: 0.6, depthWrite: false }, "glow-canopy", 0.25),
  };
  const archs = new Map<number, THREE.BufferGeometry>(), rows = new Map<number, THREE.BufferGeometry>();
  const shapeOf = (cls: Cls, p: Prism): { geometry: THREE.BufferGeometry; material: THREE.Material } => {
    if (cls === "arch") { const w = Math.round(p.w!); let g = archs.get(w); if (!g) archs.set(w, (g = archGeometry(w))); return { geometry: g, material: mat.arch }; }
    if (cls === "bikes") { let g = rows.get(p.n!); if (!g) rows.set(p.n!, (g = bikeRowGeometry(p.n!))); return { geometry: g, material: bikesMaterial }; }
    return { geometry: geo[cls], material: mat[cls] };
  };
  const bikesMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });

  // bucket the pieces by shape and wedge (and by width for arches, bikes for rows)
  const buckets = new Map<string, { cls: Cls; sector: number; items: Prism[] }>();
  for (const p of prisms) {
    const cls = CLASS[p.kind], key = `${cls}|${p.sector}|${cls === "arch" ? Math.round(p.w!) : cls === "bikes" ? p.n : 0}`;
    let b = buckets.get(key); if (!b) buckets.set(key, (b = { cls, sector: p.sector, items: [] }));
    b.items.push(p);
  }

  const bySector: { mesh: THREE.InstancedMesh; detail: boolean }[][] = Array.from({ length: circles.length }, () => []);
  const d = new THREE.Object3D(), c = new THREE.Color();
  for (const { cls, sector, items } of buckets.values()) {
    const { geometry, material } = shapeOf(cls, items[0]);
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    items.forEach((p, i) => {
      d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.yaw, 0); d.scale.set(p.sx, p.sy, p.sz); d.updateMatrix();
      mesh.setMatrixAt(i, d.matrix);
      if (cls !== "bikes") mesh.setColorAt(i, c.setHex(prismColor(p), THREE.SRGBColorSpace));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.matrixAutoUpdate = false;   // never moves
    group.add(mesh);
    bySector[sector].push({ mesh, detail: DETAIL_CLASSES.has(cls) });
  }
  scene.add(group);

  const nearest = (cx: number, cz: number, sector: number) => { let best = Infinity; for (const b of circles[sector]) best = Math.min(best, Math.hypot(b.cx - cx, b.cy - cz) - b.br); return best; };
  let shown = 0;
  return {
    group,
    update(cam) {
      shown = 0;
      for (let s = 0; s < bySector.length; s++) {
        const near = nearest(cam.x, cam.z, s);
        for (const { mesh, detail } of bySector[s]) { mesh.visible = near < (detail ? DETAIL : CULL); if (mesh.visible) shown++; }
      }
    },
    stats: () => ({ prisms: prisms.length, meshes: buckets.size, shown }),
  };
}
