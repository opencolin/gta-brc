import { quality } from "./quality";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AROUND, MAP_BOX, cityImage, surroundImage } from "@/game/citymap";
import { ARCS, ARC_R, FENCE, FENCE_R, GATE, WIDE_RADIALS, polar } from "@/lib/brc";
import { FENCE_PATCH, LAYER, LAYER_Y, MAP_PLAYA, airportLayout, fenceGap, fencePosts, fenceSegments, gateLayout, groundFlats, skyline, type Flat } from "@/lib/scene3d";
import { PALETTE, yawOf } from "@/lib/view3d";
import { basic, hex, instanced, lambert, mergedParts, placed, registerGround, type Part } from "./materials";

export type GroundMeshes = { group: THREE.Group; /** keeps what rides with the camera (the mountains) on it */ update: (cam: THREE.Vector3) => void };

/** The mountain ring's radius and height, and how many columns its skyline has. */
const RING_R = 30000, RING_H = 2600, RING_COLS = 2048;

/** A flat's outline in game coordinates, verbatim (PLAN-3D.md 2.4: the mesh is laid down with rotation.x = +π/2). */
function flatShape(f: Flat): THREE.Shape {
  const s = new THREE.Shape();
  switch (f.kind) {
    case "arc": s.absarc(0, 0, f.r1!, f.a0!, f.a1!, false); s.absarc(0, 0, f.r0!, f.a1!, f.a0!, true); break;
    case "block": s.absarc(0, 0, f.r0!, f.a0i!, f.a1i!, false); s.absarc(0, 0, f.r1!, f.a1o!, f.a0o!, true); break;
    case "radial": case "strip": {
      const a = f.from!, b = f.to!, len = Math.hypot(b.x - a.x, b.y - a.y), nx = (-(b.y - a.y) / len) * (f.width! / 2), ny = ((b.x - a.x) / len) * (f.width! / 2);
      s.moveTo(a.x + nx, a.y + ny); s.lineTo(b.x + nx, b.y + ny); s.lineTo(b.x - nx, b.y - ny); s.lineTo(a.x - nx, a.y - ny);
      break;
    }
    case "disc": s.absarc(f.cx!, f.cy!, f.r!, 0, Math.PI * 2, false); break;
    case "ring": {
      s.absarc(f.cx!, f.cy!, f.r!, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(f.cx!, f.cy!, f.r0!, 0, Math.PI * 2, true); s.holes.push(hole);
      break;
    }
  }
  return s;
}
/**
 * A curve is cut into straight pieces: three.js gives an arc twice the segment count you pass, whatever its sweep, so the default
 * 12 puts a street on L up to 120 ft off its circle. These keep every curve within about a foot.
 */
const segmentsFor = (f: Flat) => (f.kind === "arc" ? 96 : f.kind === "disc" || f.kind === "ring" ? 48 : f.kind === "block" ? 10 : 1);

/** A flat shape of one colour at one height, merged with its neighbours: the whole street network is a draw call, the blocks another. */
function flatMeshes(flats: Flat[]): THREE.Mesh[] {
  const groups = new Map<string, { f: Flat; geoms: THREE.BufferGeometry[] }>();
  for (const f of flats) {
    const key = `${f.color}|${f.y}|${f.layer}`;
    let g = groups.get(key); if (!g) groups.set(key, (g = { f, geoms: [] }));
    g.geoms.push(new THREE.ShapeGeometry(flatShape(f), segmentsFor(f)));
  }
  const out: THREE.Mesh[] = [];
  for (const { f, geoms } of groups.values()) {
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
    if (!merged) continue;
    if (geoms.length > 1) geoms.forEach((g) => g.dispose());
    // the shapes face down once laid flat, hence DoubleSide; the 0.05 ft steps between layers z-fight at a distance, hence the polygon offset (units only: see LAYER)
    const mat = basic(hex(f.color), { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -f.layer });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.rotation.x = Math.PI / 2; mesh.position.y = f.y; mesh.renderOrder = f.layer;
    out.push(mesh);
  }
  return out;
}

const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, yaw = 0) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = yaw; return m;
};

/**
 * The mountains round the playa as a painted band on a big cylinder that rides with the camera: the Granite Range along the west,
 * the hills to the north-east, low over the flats to the south (scene3d.ts skyline), a paler range behind a darker one, their feet fading into the dust.
 */
function mountains(): THREE.Mesh {
  const c = document.createElement("canvas"); c.width = RING_COLS; c.height = 128;
  const x = c.getContext("2d")!;
  const heights = skyline(RING_COLS), back = Array.from({ length: RING_COLS }, (_, i) => heights[(i + 700) % RING_COLS] * 0.75);
  const range = (hs: number[], top: string, bottom: string) => {
    const g = x.createLinearGradient(0, 0, 0, c.height); g.addColorStop(0, top); g.addColorStop(1, bottom);
    x.fillStyle = g; x.beginPath(); x.moveTo(0, c.height);
    for (let i = 0; i < RING_COLS; i++) x.lineTo(i, c.height * (1 - hs[i] * 0.95));
    x.lineTo(RING_COLS, c.height); x.closePath(); x.fill();
  };
  range(back, "rgba(138, 122, 102, .75)", "rgba(138, 122, 102, 0)");
  range(heights, "rgba(78, 66, 52, .9)", "rgba(78, 66, 52, 0)");
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(RING_R, RING_R, RING_H, 128, 1, true),
    registerGround(new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false })),
  );
  m.position.y = RING_H / 2; m.renderOrder = 10; m.frustumCulled = false;
  return m;
}

/**
 * The playa: the painted city map and the desert round it as the far ground, the streets, blocks, plazas, runways and Gate Road
 * as flat shapes over it, the shape beyond the fence, the fence and its posts, the airport's hangars, the Gate, the mountains.
 * Camps, the Man, the Temple and the café are camps.ts and places.ts.
 */
/**
 * The map's lettering, drawn again above the street flats (asked 2026-10-27: Gate Road's strip hid "4:30" from the air): the clock at each
 * wide radial's end, the street letters along 6:06, "airport" and "gate", the same words at the same places and sizes as citymap.ts
 * paints them, in one atlas canvas on one mesh, crisper than the map's own. The baked ones stay under them.
 */
function buildLabels(group: THREE.Group, maxAnisotropy: number): void {
  const clock = (m: number) => `${Math.floor(m / 60) || 12}:${String(m % 60).padStart(2, "0")}`;
  const ap = polar(252, FENCE_R * 1.09), g2 = polar(270, FENCE_R * 1.25);
  const labels = [
    ...WIDE_RADIALS.map((m) => { const p = polar(m, ARC_R.at(-1)! + 330); return { text: clock(m), x: p.x, y: p.y, ft: 180, weight: 700 }; }),
    ...[0, 2, 4, 6, 8, 11].map((i) => { const p = polar(606, ARC_R[i]); return { text: ARCS[i] === "Esplanade" ? "Esp" : ARCS[i], x: p.x, y: p.y, ft: 120, weight: 600 }; }),
    { text: "airport", x: ap.x, y: ap.y + 700, ft: 150, weight: 600 }, { text: "gate", x: g2.x, y: g2.y + 260, ft: 150, weight: 600 },
  ];
  const CW = 256, CH = 96, PX = 64, COLS = 4, rows = Math.ceil(labels.length / COLS);
  const c = document.createElement("canvas"); c.width = CW * COLS; c.height = CH * rows;
  const x = c.getContext("2d")!; x.fillStyle = PALETTE.navy; x.textAlign = "center"; x.textBaseline = "middle";
  const quads: THREE.BufferGeometry[] = [];
  labels.forEach((l, i) => {
    const col = i % COLS, row = Math.floor(i / COLS);
    x.font = `${l.weight} ${PX}px system-ui, sans-serif`;
    x.fillText(l.text, col * CW + CW / 2, row * CH + CH / 2, CW - 8);
    const q = new THREE.PlaneGeometry(l.ft * (CW / PX), l.ft * (CH / PX)), uv = q.getAttribute("uv") as THREE.BufferAttribute;   // the cell in feet at the map's font size
    for (let k = 0; k < uv.count; k++) uv.setXY(k, (col + uv.getX(k)) / COLS, 1 - (row + 1 - uv.getY(k)) / rows);
    quads.push(q.rotateX(-Math.PI / 2).translate(l.x, 0, l.y));   // the texture's top is north, as the map's text stands
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAnisotropy;
  const m = new THREE.Mesh(mergeGeometries(quads)!, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.mark }));
  m.position.y = LAYER_Y.mark; m.renderOrder = LAYER.mark; group.add(m);
}

/** The canvas drawn smaller onto one of `size` pixels square (null stays null). */
function shrink(src: HTMLCanvasElement | null, size: number): HTMLCanvasElement | null {
  if (!src || src.width <= size) return src;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d"); if (!x) return src;
  x.imageSmoothingQuality = "high"; x.drawImage(src, 0, 0, size, size);
  return c;
}
export function buildGround(scene: THREE.Scene, maxAnisotropy = 1): GroundMeshes {
  const group = new THREE.Group();
  const cy = (MAP_BOX.top + MAP_BOX.bottom) / 2;
  // a textured material is built here, not through basic(): its cache key would stringify the texture (a PNG of the whole canvas)
  const textured = (img: HTMLCanvasElement, aniso: number, opts: THREE.MeshBasicMaterialParameters = {}) => {
    const t = new THREE.CanvasTexture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    return registerGround(new THREE.MeshBasicMaterial({ color: 0xffffff, map: t, ...opts }));
  };

  // the desert past the map: flat dust to the edge of the world, the surrounding desert's painted crust and tracks on it, drawn first and writing no depth so the map over it never z-fights at a distance
  const far = mesh(new THREE.PlaneGeometry(120000, 120000), basic(hex(PALETTE.outside), { depthWrite: false }), 0, -0.7, 0); far.rotation.x = -Math.PI / 2; far.renderOrder = -3;
  group.add(far);
  // a phone gets the surrounding desert's painting at 1024 pixels, not 1536 (a 12.6 MB texture is a 5.6 MB one)
  const around = quality.touch ? shrink(surroundImage(), 1024) : surroundImage();
  if (around) {
    const big = Math.max(2 * MAP_BOX.half, MAP_BOX.bottom - MAP_BOX.top) * AROUND;
    const m = mesh(new THREE.PlaneGeometry(big, big), textured(around, Math.min(4, maxAnisotropy), { depthWrite: false }), 0, -0.5, cy); m.rotation.x = -Math.PI / 2; m.renderOrder = -2;
    group.add(m);
  }

  // the painted city map, flat on the playa: the far level of detail and the open playa's own look (its top row is north, -Z)
  const side = Math.max(2 * MAP_BOX.half, MAP_BOX.bottom - MAP_BOX.top), img = cityImage();
  const map = mesh(new THREE.PlaneGeometry(side, side), img ? textured(img, maxAnisotropy) : basic(hex(PALETTE.playa)), 0, 0, cy); map.rotation.x = -Math.PI / 2;
  group.add(map);

  // streets, blocks, plazas, runways, Gate Road
  for (const m of flatMeshes(groundFlats())) group.add(m);

  // beyond the fence: a flat square with the pentagon cut out of it
  {
    const half = 30000, s = new THREE.Shape([new THREE.Vector2(-half, -half), new THREE.Vector2(half, -half), new THREE.Vector2(half, half), new THREE.Vector2(-half, half)]);
    s.holes.push(new THREE.Path(FENCE.map((p) => new THREE.Vector2(p.x, p.y))));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(s), basic(hex(PALETTE.outside), { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.outside }));
    m.rotation.x = Math.PI / 2; m.position.y = LAYER_Y.outside; m.renderOrder = LAYER.outside;
    group.add(m);
  }

  // the baked city map still paints the fence's dashed line across the airport's open wedge (citymap.ts is top-down's too, so it stays): lay the map's own playa colour over it,
  // FENCE_PATCH ft wide on the inside of the line (the stroke is 36 ft wide; its outside half is under the shape beyond the fence)
  {
    const quads = fenceGap().map(({ a, b }) => {
      const len = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
      let nx = -uy, ny = ux; if (nx * -a.x + ny * -a.y < 0) { nx = -nx; ny = -ny; }   // the way to the Man
      const w = FENCE_PATCH, shape = new THREE.Shape([new THREE.Vector2(a.x, a.y), new THREE.Vector2(b.x, b.y), new THREE.Vector2(b.x + nx * w, b.y + ny * w), new THREE.Vector2(a.x + nx * w, a.y + ny * w)]);
      return new THREE.ShapeGeometry(shape);
    });
    if (quads.length) {
      const m = new THREE.Mesh(mergeGeometries(quads)!, basic(MAP_PLAYA, { side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -LAYER.outside }));
      m.rotation.x = Math.PI / 2; m.position.y = LAYER_Y.outside + 0.005; m.renderOrder = LAYER.outside; group.add(m);
    }
  }

  // the fence: a line round the pentagon and a post every 300 ft, open where the airport's wedge is (the sim has no fence there)
  const FENCE_ORANGE = 0xf08a3c;
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fenceSegments().flatMap(({ a, b }) => [new THREE.Vector3(a.x, 3, a.y), new THREE.Vector3(b.x, 3, b.y)])), new THREE.LineBasicMaterial({ color: FENCE_ORANGE })));
  group.add(instanced(new THREE.CylinderGeometry(0.9, 0.9, 4, 5), lambert(FENCE_ORANGE), fencePosts().map((p) => ({ x: p.x, y: 2, z: p.y }))));

  // the airport: five hangars along the apron and the windsock, one mesh
  const ap = airportLayout();
  group.add(mergedParts([
    ...ap.hangars.map((h, k): Part => ({ geo: placed(new THREE.BoxGeometry(h.w, 24, h.d), h.x, 12, h.y, h.yaw), color: k % 2 ? 0xd9d0bd : 0xcfc5ae })),
    { geo: placed(new THREE.CylinderGeometry(0.8, 0.8, 30, 6), ap.windsock.x, 15, ap.windsock.y), color: 0x6b7390 },
    { geo: placed(new THREE.ConeGeometry(2.4, 14, 8).rotateZ(-Math.PI / 2), ap.windsock.x + 7, 29, ap.windsock.y), color: 0xff7a2f },
  ]));

  // the Gate: a long shade on four poles with seven booths under it, a flag at each end, the Greeters' bell (one mesh); the pink ring to pull up in is targets.ts
  const gate = gateLayout(), g = GATE, BOOTH = [0xff9a8b, 0x8ec5fc, 0xffd27a, 0xe0c3fc];
  const gateParts: Part[] = [
    { geo: placed(new THREE.BoxGeometry(360, 1, 52), gate.shade.x, 12, gate.shade.y, gate.yaw), color: 0xe9e4d6 },
    ...gate.poles.map((p): Part => ({ geo: placed(new THREE.CylinderGeometry(1, 1, 12, 6), p.x, 6, p.y), color: 0x6b5a44 })),
    ...gate.booths.map((p, k): Part => ({ geo: placed(new THREE.BoxGeometry(28, 8, 28), p.x, 4, p.y, gate.yaw), color: BOOTH[k % 4] })),
    { geo: placed(new THREE.CylinderGeometry(0.6, 0.6, 6, 6), gate.bell.x, 3, gate.bell.y), color: 0x6b4226 },
    { geo: placed(new THREE.SphereGeometry(1.7, 10, 8), gate.bell.x, 7, gate.bell.y), color: 0xffd27a },
  ];
  for (const lx of [-200, 200]) {
    const px = g.at.x + lx * Math.cos(g.a), pz = g.at.y + lx * Math.sin(g.a);
    gateParts.push({ geo: placed(new THREE.CylinderGeometry(0.7, 0.7, 24, 6), px, 12, pz), color: 0x8a8f99 });
    gateParts.push({ geo: placed(new THREE.PlaneGeometry(26, 12), px + 13 * Math.cos(g.a), 18, pz + 13 * Math.sin(g.a), gate.yaw), color: lx < 0 ? 0xff6b9a : 0xffd27a });
  }
  group.add(mergedParts(gateParts));

  // the mountains ring the horizon and ride with the camera, so they never come nearer
  const ring = mountains(); group.add(ring);

  scene.add(group);
  buildLabels(group, maxAnisotropy);
  return { group, update: (cam) => { ring.position.x = cam.x; ring.position.z = cam.z; } };
}
