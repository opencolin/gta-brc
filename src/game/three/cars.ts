import * as THREE from "three";
import { MUTANTS, drivenKey, npcAt, type Game } from "@/lib/playa";
import { hslHex } from "@/lib/scene3d";
import { ART_CARS } from "../artcars";
import { carRoof, hullSize, roofSize, type Drawing } from "./decals";
import { bigImagination } from "./bigImagination";
import { dragonLady } from "./dragonLady";
import { goldenTicket, type Ticket } from "./goldenTicket";
import { axolotl } from "./axolotl";
import { discoDoge } from "./doge";
import { kuker } from "./kuker";
import { PLATFORM_IDS, platformModel } from "./platforms";
import { ONEOFFS_A } from "./oneoffs-a";
import { ONEOFFS_B } from "./oneoffs-b";
import { ONEOFFS_C } from "./oneoffs-c";
import { ONEOFFS_D } from "./oneoffs-d";

/**
 * The art cars (PLAN-3D.md 2.5): every famous car (the 54 mutants and the Golden Ticket) is a hull, a dark skirt, six wheels and its
 * top-down drawing on the roof. The roaming and parked ones are three instanced meshes in all (hulls, skirts, wheels); only the roofs,
 * which are each a picture of their own, are a mesh apiece, and only within SHOW_ROOF feet. The one you drive is a group of its own
 * moved to your car (the roaming copy is hidden). A roof redraws at 10 Hz within LIVE_ROOF feet (the Dragon Lady's, which waits on an
 * image, whenever it shows).
 */
export type CarMeshes = {
  group: THREE.Group;
  update(g: Game, cam: THREE.Vector3, night: number): void;
  /** The id of the art car you are driving (its roof drawing exists), else null: rides.ts then draws no ride of its own. */
  drivenId(g: Game): string | null;
  /** How high the roof of the art car you are riding along on is (g.aboard), else 0: your ride stands on it. */
  roofAt(g: Game): number;
};
const SHOW_CAR = 4000, SHOW_ROOF = 2500, LIVE_ROOF = 700;
/** How near a model with a `far` stand-in is drawn as itself (platforms.ts: up to 14 of them can be within SHOW_ROOF at once, about 1,700 triangles each). */
const SHOW_MODEL = 1600;

/** The cars that are a model of their own, in place of a hull, a skirt, wheels and a roof: the Golden Ticket (goldenTicket.ts), Big Imagination's 747 (bigImagination.ts), the Dragon Lady (dragonLady.ts),
 * and the creatures (critters.ts, asked 2026-10-31): Disco Doge (doge.ts), the Axolotl (axolotl.ts) and Kuker (kuker.ts). `roof`: how high a ride on top of it stands; `live`: its paint() only moves its parts, so it runs every frame while near. */
type Model = Ticket & { roof: number; live?: boolean; /** beyond SHOW_MODEL it is the instanced hull, skirt and wheels (the cars on a base vehicle, platforms.ts: a draw call apiece, as the roof was) */ far?: boolean };
const MODELS: Record<string, () => Model> = {
  // the art cars on the city games' base vehicles (platforms.ts, asked 2026-11-02): a bus, a tanker, a love wagon, a 4×4, a train, a tram or a boat built in 3D, the dressing on top
  ...Object.fromEntries(PLATFORM_IDS.map((id) => [id, () => platformModel(id)])),
  // the one-off art cars (oneoffs-*.ts, asked 2026-11-02), drawn as themselves within SHOW_MODEL and as the instanced hull beyond
  ...Object.fromEntries(Object.entries({ ...ONEOFFS_A, ...ONEOFFS_B, ...ONEOFFS_C, ...ONEOFFS_D }).map(([id, f]) => [id, () => ({ ...f(), far: true })])),
  "golden-ticket": () => ({ ...goldenTicket(), roof: 9.4 }),
  "big-imagination-747": () => { const j = bigImagination(); return { group: j.group, paint: j.paint, roof: j.roof }; },
  "dragon-lady": () => { const y = dragonLady(); return { group: y.group, paint: y.paint, roof: y.roof }; },
  "disco-doge": discoDoge,
  axolotl,
  kuker,
};

/** hullX and hullZ: where the hull's centre is from the car's, to the right and toward the tail (the art is not always centred on the car). */
type Kit = { id: string; w: number; l: number; hullW: number; hullL: number; hullH: number; hullX: number; hullZ: number; color: number; roof: Drawing | null };

/** The average colour of the drawing's opaque pixels, for the hull under it. */
function average(d: Drawing | null, fallback: number): number {
  if (!d) return fallback;
  const c = d.tex.image as HTMLCanvasElement, x = c.getContext("2d")!;
  let data: Uint8ClampedArray;
  try { data = x.getImageData(0, 0, c.width, c.height).data; } catch { return fallback; }
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += 4 * 7) if (data[i + 3] > 200) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
  return n ? ((Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n)) : fallback;
}

function kitOf(id: string, hue: number): Kit {
  const { w, l } = roofSize(id), roof = carRoof(id), hull = hullSize(id);
  const ticket = id === "golden-ticket", lady = id === "dragon-lady";
  return {
    id, w, l, roof,
    hullW: ticket ? 10 : lady ? 40 : hull.w, hullL: ticket ? 20 : lady ? 132 : hull.l, hullH: ticket ? 7 : lady ? 14 : 12,
    hullX: ticket || lady ? 0 : hull.cx, hullZ: ticket || lady ? 0 : hull.cz,
    color: ticket ? 0xe8b923 : average(roof, hslHex(hue, 55, 40)),
  };
}

/** Where a car's six wheels are in its own frame: x ±(hullW/2 - 1), z a third of the hull's length apart, round the hull's centre. */
const wheelsOf = (k: Kit) => [-1, 0, 1].flatMap((i) => [-1, 1].map((s) => ({ x: k.hullX + s * (k.hullW / 2 - 1), z: k.hullZ + (i * k.hullL) / 3.2 })));

export function buildCars(scene: THREE.Scene): CarMeshes {
  const group = new THREE.Group();
  const cars = MUTANTS.map((m) => {
    const id = m.key!.slice(m.key!.indexOf(":") + 1);
    return { m, id, kit: kitOf(id, m.hue), roofMesh: null as THREE.Mesh | null, last: -1, nf: false, shown: true, ticket: null as Model | null };
  });
  const roofMat = (d: Drawing) => new THREE.MeshBasicMaterial({ map: d.tex, alphaTest: 0.04, side: THREE.DoubleSide });
  const roofOf = (k: Kit): THREE.Mesh | null => {
    if (!k.roof) return null;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(k.roof.w, k.roof.l).rotateX(-Math.PI / 2), roofMat(k.roof));
    m.position.y = k.hullH + 0.15; m.visible = false; return m;
  };
  for (const c of cars) {
    // the Golden Ticket and the 747 are models of their own (goldenTicket.ts: the pods, the sign, the lights; bigImagination.ts) in place of a hull, a skirt, wheels and a roof
    if (MODELS[c.id]) { c.ticket = MODELS[c.id](); c.ticket.group.visible = false; group.add(c.ticket.group); continue; }
    c.roofMesh = roofOf(c.kit); if (c.roofMesh) group.add(c.roofMesh);
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const hulls = new THREE.InstancedMesh(box, white, cars.length), skirts = new THREE.InstancedMesh(box, white, cars.length);
  const wheels = new THREE.InstancedMesh(new THREE.CylinderGeometry(4, 4, 3, 10).rotateZ(Math.PI / 2), white, cars.length * 6);
  const col = new THREE.Color();
  cars.forEach((c, i) => { hulls.setColorAt(i, col.setHex(c.kit.color, THREE.SRGBColorSpace)); skirts.setColorAt(i, col.setHex(0x1b1f3b, THREE.SRGBColorSpace)); for (let k = 0; k < 6; k++) wheels.setColorAt(i * 6 + k, col.setHex(0x15161d, THREE.SRGBColorSpace)); });
  for (const m of [hulls, skirts, wheels]) { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(m); }
  scene.add(group);

  // the car you drive: a group of its own, built the first time you drive each
  const mine = new Map<string, THREE.Group>();
  const driven = (id: string, hue: number): THREE.Group => {
    let g = mine.get(id);
    if (g) return g;
    if (MODELS[id]) { const md = MODELS[id](); g = md.group; g.userData.live = !!md.live; g.visible = false; scene.add(g); mine.set(id, g); return g; }
    const k = kitOf(id, hue); g = new THREE.Group();
    const hull = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: k.color })); hull.scale.set(k.hullW, k.hullH, k.hullL); hull.position.set(k.hullX, k.hullH / 2 + 1.5, k.hullZ);
    const skirt = new THREE.Mesh(box, new THREE.MeshLambertMaterial({ color: 0x1b1f3b })); skirt.scale.set(k.hullW + 2, 2, k.hullL + 2); skirt.position.set(k.hullX, 1, k.hullZ);
    g.add(hull, skirt);
    for (const w of wheelsOf(k)) { const m = new THREE.Mesh(wheels.geometry, new THREE.MeshLambertMaterial({ color: 0x15161d })); m.position.set(w.x, 4, w.z); g.add(m); }
    const r = roofOf(k); if (r) { r.position.y = k.hullH + 1.65; r.visible = true; r.userData.drawing = k.roof; g.add(r); }
    g.visible = false; scene.add(g); mine.set(id, g);
    return g;
  };

  const d = new THREE.Object3D(), base = new THREE.Matrix4(), local = new THREE.Matrix4(), out = new THREE.Matrix4(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  cars.forEach((c, i) => { if (!c.ticket || c.ticket.far) return; hulls.setMatrixAt(i, zero); skirts.setMatrixAt(i, zero); for (let k = 0; k < 6; k++) wheels.setMatrixAt(i * 6 + k, zero); }); // the models never use their instanced slots
  let lastDriven = 0;
  const drivenId = (g: Game): string | null => {
    const key = drivenKey();
    if (g.vehicle !== "found" || !key) return null;
    const id = key.slice(key.indexOf(":") + 1);
    return ART_CARS[id] ? id : null;
  };
  return {
    group,
    drivenId,
    roofAt: (g) => { if (!g.aboard) return 0; const c = cars.find((x) => x.m.key === g.aboard); return c ? (c.ticket ? c.ticket.roof : c.kit.hullH + 1.65) : 0; },
    update(g, cam, night) {
      const own = drivenKey();
      cars.forEach((c, i) => {
        const near = c.m.key !== own;
        const p = near ? npcAt(c.m, g.t) : null, dist = p ? Math.hypot(p.x - cam.x, p.y - cam.z) : Infinity, on = dist < SHOW_CAR;
        if (!on) {
          if (c.shown) { c.shown = false; hulls.setMatrixAt(i, zero); skirts.setMatrixAt(i, zero); for (let k = 0; k < 6; k++) wheels.setMatrixAt(i * 6 + k, zero); if (c.roofMesh) c.roofMesh.visible = false; if (c.ticket) c.ticket.group.visible = false; }
          return;
        }
        c.shown = true;
        if (c.ticket && c.ticket.far && dist >= SHOW_MODEL) c.ticket.group.visible = false;
        else if (c.ticket) {
          if (c.ticket.far) { hulls.setMatrixAt(i, zero); skirts.setMatrixAt(i, zero); for (let k = 0; k < 6; k++) wheels.setMatrixAt(i * 6 + k, zero); }
          const tg = c.ticket.group; tg.visible = true; tg.position.set(p!.x, 0, p!.y); tg.rotation.y = -p!.h;
          // painted at 10 Hz while it is near; farther off, once whenever the night comes or goes (as the roofs are), so it is not left lit by day or dark by night
          const nf = night > 0.3;
          // (the Dragon Lady's deck drawing waits on an image, so it is repainted whenever it shows)
          if (dist < LIVE_ROOF || (c.id === "dragon-lady" && dist < SHOW_ROOF) ? c.ticket.live || g.t - c.last > 0.1 : c.nf !== nf) { c.ticket.paint(g.t, night); c.last = g.t; c.nf = nf; }
          return;
        }
        const k = c.kit, yaw = -p!.h, co = Math.cos(yaw), si = Math.sin(yaw);
        d.position.set(p!.x + k.hullX * co + k.hullZ * si, k.hullH / 2 + 1.5, p!.y - k.hullX * si + k.hullZ * co); d.rotation.set(0, yaw, 0); d.scale.set(k.hullW, k.hullH, k.hullL); d.updateMatrix(); hulls.setMatrixAt(i, d.matrix);
        d.position.y = 1; d.scale.set(k.hullW + 2, 2, k.hullL + 2); d.updateMatrix(); skirts.setMatrixAt(i, d.matrix);
        d.position.set(p!.x, 0, p!.y); d.scale.set(1, 1, 1); d.updateMatrix(); base.copy(d.matrix);
        wheelsOf(k).forEach((w, j) => { local.makeTranslation(w.x, 4, w.z); out.multiplyMatrices(base, local); wheels.setMatrixAt(i * 6 + j, out); });
        const r = c.roofMesh;
        if (r) {
          r.visible = dist < SHOW_ROOF; r.position.set(p!.x, k.hullH + 1.65, p!.y); r.rotation.y = yaw;
          // a roof redraws at 10 Hz while it is near; farther off it is redrawn once whenever the night comes or goes
          const live = c.id === "dragon-lady" || dist < LIVE_ROOF, nf = night > 0.3;
          if (r.visible && k.roof && (live ? g.t - c.last > 0.1 : c.nf !== nf)) { k.roof.paint(g.t, night); c.last = g.t; c.nf = nf; }
        }
      });
      for (const m of [hulls, skirts, wheels]) m.instanceMatrix.needsUpdate = true;
      // the one you drive
      const id = drivenId(g);
      for (const [k, grp] of mine) grp.visible = k === id;
      if (id) {
        const grp = driven(id, 0); grp.visible = true;
        grp.position.set(g.car.x, 0, g.car.y); grp.rotation.y = -g.car.h;
        const tk = grp.userData.ticket as Ticket | undefined, roof = grp.children.find((o) => o.userData.drawing) as THREE.Mesh | undefined;
        const dr = tk ?? (roof?.userData.drawing as Drawing | undefined);
        if (dr && (MODELS[id] && grp.userData.live || g.t - lastDriven > 0.1)) { dr.paint(g.t, night); lastDriven = g.t; }
      }
    },
  };
}
