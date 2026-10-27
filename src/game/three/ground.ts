import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AROUND, MAP_BOX, cityImage, surroundImage } from "@/game/citymap";
import { FENCE, GATE } from "@/lib/brc";
import { LAYER, LAYER_Y, airportLayout, fencePosts, fenceSegments, gateLayout, groundFlats, skyline, type Flat } from "@/lib/scene3d";
import { PALETTE, yawOf } from "@/lib/view3d";
import { basic, hex, instanced, lambert } from "./materials";

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
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.BackSide, fog: false, depthWrite: false }),
  );
  m.position.y = RING_H / 2; m.renderOrder = 10; m.frustumCulled = false;
  return m;
}

/**
 * The playa: the painted city map and the desert round it as the far ground, the streets, blocks, plazas, runways and Gate Road
 * as flat shapes over it, the shape beyond the fence, the fence and its posts, the airport's hangars, the Gate, the mountains.
 * Camps, the Man, the Temple and the café are camps.ts and places.ts.
 */
export function buildGround(scene: THREE.Scene, maxAnisotropy = 1): GroundMeshes {
  const group = new THREE.Group();
  const cy = (MAP_BOX.top + MAP_BOX.bottom) / 2;
  // a textured material is built here, not through basic(): its cache key would stringify the texture (a PNG of the whole canvas)
  const textured = (img: HTMLCanvasElement, aniso: number, opts: THREE.MeshBasicMaterialParameters = {}) => {
    const t = new THREE.CanvasTexture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
    return new THREE.MeshBasicMaterial({ color: 0xffffff, map: t, ...opts });
  };

  // the desert past the map: flat dust to the edge of the world, the surrounding desert's painted crust and tracks on it, drawn first and writing no depth so the map over it never z-fights at a distance
  const far = mesh(new THREE.PlaneGeometry(120000, 120000), basic(hex(PALETTE.outside), { depthWrite: false }), 0, -0.7, 0); far.rotation.x = -Math.PI / 2; far.renderOrder = -3;
  group.add(far);
  const around = surroundImage();
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

  // the fence: a line round the pentagon and a post every 300 ft, open where the airport's wedge is (the sim has no fence there)
  const FENCE_ORANGE = 0xf08a3c;
  group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fenceSegments().flatMap(({ a, b }) => [new THREE.Vector3(a.x, 3, a.y), new THREE.Vector3(b.x, 3, b.y)])), new THREE.LineBasicMaterial({ color: FENCE_ORANGE })));
  group.add(instanced(new THREE.CylinderGeometry(0.9, 0.9, 4, 5), lambert(FENCE_ORANGE), fencePosts().map((p) => ({ x: p.x, y: 2, z: p.y }))));

  // the airport: five hangars along the apron and the windsock
  const ap = airportLayout();
  group.add(instanced(new THREE.BoxGeometry(1, 1, 1), lambert(0xffffff), ap.hangars.map((h, k) => ({ x: h.x, y: 12, z: h.y, yaw: h.yaw, sx: h.w, sy: 24, sz: h.d, color: k % 2 ? 0xd9d0bd : 0xcfc5ae }))));
  group.add(mesh(new THREE.CylinderGeometry(0.8, 0.8, 30, 6), lambert(0x6b7390), ap.windsock.x, 15, ap.windsock.y));
  { const sock = mesh(new THREE.ConeGeometry(2.4, 14, 8), lambert(0xff7a2f), ap.windsock.x + 7, 29, ap.windsock.y); sock.rotation.z = -Math.PI / 2; group.add(sock); }

  // the Gate: a long shade on four poles with seven booths under it, a flag at each end, the Greeters' bell, the pink ring to pull up in
  const gate = gateLayout(), g = GATE;
  group.add(mesh(new THREE.BoxGeometry(360, 1, 52), lambert(0xe9e4d6), gate.shade.x, 12, gate.shade.y, gate.yaw));
  group.add(instanced(new THREE.CylinderGeometry(1, 1, 12, 6), lambert(0x6b5a44), gate.poles.map((p) => ({ x: p.x, y: 6, z: p.y }))));
  const BOOTH = [0xff9a8b, 0x8ec5fc, 0xffd27a, 0xe0c3fc];
  group.add(instanced(new THREE.BoxGeometry(28, 8, 28), lambert(0xffffff), gate.booths.map((p, k) => ({ x: p.x, y: 4, z: p.y, yaw: gate.yaw, color: BOOTH[k % 4] }))));
  for (const lx of [-200, 200]) {
    const px = g.at.x + lx * Math.cos(g.a), pz = g.at.y + lx * Math.sin(g.a);
    group.add(mesh(new THREE.CylinderGeometry(0.7, 0.7, 24, 6), lambert(0x8a8f99), px, 12, pz));
    const flag = mesh(new THREE.PlaneGeometry(26, 12), lambert(lx < 0 ? 0xff6b9a : 0xffd27a), px + 13 * Math.cos(g.a), 18, pz + 13 * Math.sin(g.a), gate.yaw); (flag.material as THREE.Material).side = THREE.DoubleSide; group.add(flag);
  }
  group.add(mesh(new THREE.CylinderGeometry(0.6, 0.6, 6, 6), lambert(0x6b4226), gate.bell.x, 3, gate.bell.y));
  group.add(mesh(new THREE.SphereGeometry(1.7, 10, 8), lambert(0xffd27a), gate.bell.x, 7, gate.bell.y));
  { const ring = mesh(new THREE.TorusGeometry(60, 1.2, 6, 72), basic(hex(PALETTE.pink)), gate.stop.x, 1.2, gate.stop.y); ring.rotation.x = Math.PI / 2; group.add(ring); }

  // the mountains ring the horizon and ride with the camera, so they never come nearer
  const ring = mountains(); group.add(ring);

  scene.add(group);
  return { group, update: (cam) => { ring.position.x = cam.x; ring.position.z = cam.z; } };
}
