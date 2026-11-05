import * as THREE from "three";
import { MODELLED, buildArtPlaces } from "./artPlaces";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ART_2026_SPOTS, SPOTS, type Game, type Spot } from "@/lib/playa";
import { LAYER, hslHex } from "@/lib/scene3d";
import { PYRAMIDS, pyramidOf } from "@/lib/pyramidStage";
import { PALETTE, cang } from "@/lib/view3d";
import { glowing } from "./camps";
import { pTexture } from "./decals";
import { basic } from "./materials";
import { buildPyramid, type PyramidMeshes } from "./pyramidStage";

/**
 * The places you can stop at, from SPOTS (172): each one's parking bay as a flat pink-tinted shape with its "P", and its stage by kind
 * (PLAN-3D.md 2.2): a camp's round navy stage with its coloured deck and two speaker stacks facing the bay, the fence's little pyramid,
 * a standing stone for an art place without a piece of its own, and PlayAlchemist's Pyramid stage (pyramidStage.ts) where its drum would be. Pieces with their own drawing are in art.ts, Agave's domes in agave.ts.
 * Bays are merged into two meshes and the stage parts are one instanced mesh per shape (each whole city wide, a few thousand triangles).
 */
export type StageMeshes = { group: THREE.Group; update(g: Game, t: number): void };

const mix = (a: number, b: number, k: number) => {
  const c = new THREE.Color(a), d = new THREE.Color(b);
  return c.lerp(d, k).getHex();
};

/** A bay's outline as the top-down painter cuts it: an annular box, r0 to r1, `half` feet either side of its clock position. */
function bayShape(sp: Spot): THREE.Shape {
  const b = sp.bay, a = (r: number, sg: number) => cang(b.min) + (sg * b.half) / r, s = new THREE.Shape();
  s.absarc(0, 0, b.r0, a(b.r0, -1), a(b.r0, 1), false); s.absarc(0, 0, b.r1, a(b.r1, 1), a(b.r1, -1), true);
  return s;
}

const FACING = (sp: Spot) => Math.atan2(sp.mid.y - sp.stage.y, sp.mid.x - sp.stage.x);

export function buildStages(scene: THREE.Scene): StageMeshes {
  const group = new THREE.Group();
  const spots = SPOTS.filter((s) => s.kind !== "agave" && !(s.kind === "art" && s.camp?.piece) && s.key !== "camp:the-man");   // the Man is his own stage: no stone behind his bay

  // ── bays: the road's colour under a pink wash; the open-playa bays (fence, art) the playa's colour; one mesh each
  const geoOf = (sp: Spot) => new THREE.ShapeGeometry(bayShape(sp), 6);
  const bays = { road: [] as THREE.BufferGeometry[], open: [] as THREE.BufferGeometry[] };
  const all = SPOTS.map((sp) => ({ sp, geo: geoOf(sp) }));
  for (const { sp, geo } of all) (sp.kind === "fence" || sp.kind === "art" ? bays.open : bays.road).push(geo.clone());
  const wash = (base: number, first: number) => mix(mix(base, 0xff6b9a, first), 0xff6b9a, 0.22);   // fill, then the pink .22 over it: drawBay's two fills
  const bayMesh = (geos: THREE.BufferGeometry[], color: number) => {
    const m = new THREE.Mesh(mergeGeometries(geos)!, basic(color, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.mark }));
    m.rotation.x = Math.PI / 2; m.position.y = 0.3; m.renderOrder = LAYER.mark; geos.forEach((g) => g.dispose()); return m;
  };
  group.add(bayMesh(bays.road, wash(0xefe2c6, 0)), bayMesh(bays.open, wash(0xe6d3ae, 0.18)));
  // the dashed outline, drawn as a solid pink line round every bay
  const lines: THREE.Vector3[] = [];
  for (const { sp } of all) { const pts = bayShape(sp).getPoints(8); for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; lines.push(new THREE.Vector3(p.x, 0.35, p.y), new THREE.Vector3(q.x, 0.35, q.y)); } }
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), new THREE.LineBasicMaterial({ color: PALETTE.pink })));
  // the P at each bay's middle
  const pMat = new THREE.MeshBasicMaterial({ map: pTexture(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.bayP });
  const ps = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), pMat, SPOTS.length);
  const d = new THREE.Object3D();
  SPOTS.forEach((sp, i) => { d.position.set(sp.mid.x, 0.4, sp.mid.y); d.scale.set(26, 1, 26); d.updateMatrix(); ps.setMatrixAt(i, d.matrix); });
  ps.renderOrder = LAYER.bayP; ps.frustumCulled = false; group.add(ps);
  // the bay you are parked in: a pink wash that cycles colour, laid over it
  const hl = new THREE.Mesh(all[0].geo, new THREE.MeshBasicMaterial({ color: PALETTE.pink, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.bayHi }));
  hl.rotation.x = Math.PI / 2; hl.position.y = 0.45; hl.renderOrder = LAYER.bayHi; hl.visible = false; group.add(hl);

  // ── stages: one instanced mesh per shape
  const camps = spots.filter((s) => s.kind === "camp" && !pyramidOf(s.key)), stones = spots.filter((s) => s.kind === "art" && !MODELLED.has(s.camp?.id ?? "")), fences = spots.filter((s) => s.kind === "fence");
  /** an art place's crystal: its half-width and how high it hovers */
  const STONE_R = 5, STONE_Y = 18;
  const inst = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number, set: (i: number, d: THREE.Object3D, c: THREE.Color) => void) => {
    const m = new THREE.InstancedMesh(geo, mat, n), c = new THREE.Color();
    for (let i = 0; i < n; i++) { d.position.set(0, 0, 0); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); set(i, d, c); d.updateMatrix(); m.setMatrixAt(i, d.matrix); m.setColorAt(i, c); }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); group.add(m); return m;
  };
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  // the drum: 4 ft tall, navy
  inst(new THREE.CylinderGeometry(1, 1, 4, 20), white, camps.length, (i, o, c) => { const s = camps[i]; o.position.set(s.stage.x, 2, s.stage.y); o.scale.set(s.stage.r, 1, s.stage.r); c.setHex(0x1b1f3b, THREE.SRGBColorSpace); });
  // the deck: a disc in the camp's colour on top, glowing at night
  inst(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), glowing({ side: THREE.DoubleSide }, "glow-deck", 0.5), camps.length, (i, o, c) => { const s = camps[i]; o.position.set(s.stage.x, 4.08, s.stage.y); o.scale.set(s.stage.r * 0.7, 1, s.stage.r * 0.7); c.setHex(hslHex(s.hue, 70, 52), THREE.SRGBColorSpace); });
  // two stacks of speakers facing the bay: 12 ft boxes, 0.62 r to each side and 0.35 r toward it
  inst(new THREE.BoxGeometry(12, 12, 12), white, camps.length * 2, (i, o, c) => {
    const s = camps[i >> 1], sx = i & 1 ? 1 : -1, th = FACING(s), ph = th - Math.PI / 2, r = s.stage.r;
    o.position.set(s.stage.x + sx * 0.62 * r * Math.cos(ph) + (0.35 * r + 6) * Math.cos(th), 6, s.stage.y + sx * 0.62 * r * Math.sin(ph) + (0.35 * r + 6) * Math.sin(th));
    o.rotation.y = -ph; c.setHex(0x14172c, THREE.SRGBColorSpace);
  });
  // an art place's marker: a small crystal in its colour hovering 18 ft up, glowing at night, that you drive under (asked 2026-11-03: the 50 ft stones
  // were big obstacles); it turns slowly (update below)
  const stoneMesh = inst(new THREE.OctahedronGeometry(1), glowing({}, "glow-stone", 0.6), stones.length, (i, o, c) => { const s = stones[i], r = STONE_R; o.position.set(s.stage.x, STONE_Y, s.stage.y); o.scale.set(r, r * 1.5, r); o.rotation.y = -(FACING(s) - Math.PI / 2); c.setHex(hslHex(s.hue, 75, 55), THREE.SRGBColorSpace); });
  // 2026's other art (asked 2026-11-04): a 10 ft post with a crystal in the piece's hue on it, glowing at night, two draw calls for all of them
  inst(new THREE.CylinderGeometry(0.6, 0.9, 10, 6), white, ART_2026_SPOTS.length, (i, o, c) => { const a = ART_2026_SPOTS[i]; o.position.set(a.x, 5, a.y); c.setHex(0x3a3550, THREE.SRGBColorSpace); });
  inst(new THREE.OctahedronGeometry(1), glowing({}, "glow-stone", 0.6), ART_2026_SPOTS.length, (i, o, c) => { const a = ART_2026_SPOTS[i]; o.position.set(a.x, 13, a.y); o.scale.set(3, 4.5, 3); o.rotation.y = a.hue; c.setHex(hslHex(a.hue, 80, 58), THREE.SRGBColorSpace); });
  // the fence's pyramid
  inst(new THREE.ConeGeometry(1, 1, 4).rotateY(Math.PI / 4), white, fences.length, (i, o, c) => { const s = fences[i]; o.position.set(s.stage.x, 15, s.stage.y); o.scale.set(s.stage.r, 30, s.stage.r); c.setHex(0x2a2440, THREE.SRGBColorSpace); });

  // PlayAlchemist's Pyramid stage stands in place of its drum, deck and speakers (the sim's solid circle there is unchanged)
  // the pyramid stages, PlayAlchemist's and the Kazbah's (asked 2026-11-04)
  const pyramids: PyramidMeshes[] = PYRAMIDS.flatMap((p) => { const sp = SPOTS.find((s) => s.key === p.key); return sp ? [buildPyramid(group, sp.stage, FACING(sp), p)] : []; });

  // the art places that have a model of the real piece (artPlaces.ts) instead of a crystal
  const artPlaces = buildArtPlaces(group, spots.filter((s) => s.kind === "art"));
  scene.add(group);
  const index = new Map(SPOTS.map((s, i) => [s.key, i]));
  let at: string | null = null;
  return {
    group,
    update(g, t) {
      for (const p of pyramids) p.update(g, t);
      artPlaces.update(g.car.x, g.car.y);
      // the art places' crystals turn slowly and bob, together
      stoneMesh.rotation.y = 0; stoneMesh.position.y = Math.sin(t * 1.3) * 1.5;
      const key = g.parking.at;
      if (key !== at) { at = key; const i = key == null ? undefined : index.get(key); if (i === undefined) hl.visible = false; else { hl.geometry = all[i].geo; hl.visible = true; } }
      if (hl.visible) (hl.material as THREE.MeshBasicMaterial).color.setHSL(((t * 90) % 360) / 360, 1, 0.62, THREE.SRGBColorSpace);
    },
  };
}
