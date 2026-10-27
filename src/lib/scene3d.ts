import {
  AIRPORT, ARC_R, CENTER_CAMP, CENTER_CAMP_R, FENCE, GATE, MAN_R, RADIALS, TEMPLE, TEMPLE_R,
  arcWidth, blockBounds, polar, radialWidth, toPolar, type Vec,
} from "./brc.ts";
import type { BlockPlan, Struct, StructKind } from "./camps.ts";
import { PALETTE, cang, yawOf } from "./view3d.ts";

/**
 * The chase view's scene, described rather than drawn: the flat shapes on the ground, the camps' structures as boxes and
 * domes with a position, a turn and a size, the fence posts, the airport's and the Gate's layout, the mountain skyline.
 * Pure (feet, game axes for flats; three.js axes for prisms), so the node tests can check it; src/game/three/ turns
 * these into meshes. Only the renderer chunk imports this file, not the main bundle.
 */

/* ── the flat things on the ground ───────────────────────────────────────── */

export type FlatKind = "arc" | "radial" | "block" | "disc" | "ring" | "strip";
/**
 * One flat shape in game coordinates (a ShapeGeometry is built from it verbatim, then laid down with rotation.x = +π/2: see
 * PLAN-3D.md 2.4). `y` is its height above the map; `layer` orders overlapping shapes (polygonOffset and renderOrder).
 *  - arc: an annular sector from r0 to r1, canvas angles a0 to a1 (with the street's overhang)
 *  - block: r0 to r1, with the inner edge from a0i to a1i and the outer from a0o to a1o, so the radial streets keep a constant width in feet
 *  - radial, strip: a rectangle along from → to, `width` across
 *  - disc: a circle (cx, cy, r); ring: the band between r0 and r round (cx, cy)
 */
export type Flat = {
  kind: FlatKind; color: string; y: number; layer: number;
  r0?: number; r1?: number; a0?: number; a1?: number; a0i?: number; a1i?: number; a0o?: number; a1o?: number;
  cx?: number; cy?: number; r?: number;
  from?: Vec; to?: Vec; width?: number;
};

/** Heights (feet above the map) of the ground layers, lowest first. */
export const LAYER_Y = { outside: 0.05, block: 0.1, street: 0.15, plaza: 0.2, ring: 0.25, mark: 0.3 } as const;
/**
 * The layers of everything flat on the ground, lowest first. The 0.05 ft steps between their heights z-fight beyond about 1,500 ft
 * once the eye is high, so each layer's material is pulled toward the camera by `layer` depth-buffer units (polygonOffsetUnits, never
 * polygonOffsetFactor: the factor term scales with the ground's slope and at a distance pulls a flat forward by whole feet, over
 * anything low that has no offset of its own) and drawn in renderOrder `layer`. The camps' carpets are meshes, not flats; the bays (mark), their "P" and highlight and the art pieces' ground drawings sit on the layers above.
 */
export const LAYER = { outside: 1, block: 2, street: 3, plaza: 4, ring: 5, mark: 6, carpet: 7, bayP: 8, bayHi: 9, decal: 10 } as const;
const PLAZA = "#efe5cf", PAVE = "#efe7d4", APRON = "#e8dfc9";
const CITY_FROM = 120, CITY_TO = 600;

/** The streets, the 192 blocks, Center Camp's plaza and Rod's Road, the Man's and the Temple's circles, the airport's runways and apron, Gate Road. */
export function groundFlats(): Flat[] {
  const out: Flat[] = [];
  // the blocks: ring i between arc i and i + 1, sector j between radial j and j + 1 (the streets' half widths are already off)
  for (let ring = 0; ring < ARC_R.length - 1; ring++) {
    for (let sector = 0; sector < RADIALS.length - 1; sector++) {
      const b = blockBounds(ring, sector), A0 = cang(b.m0), A1 = cang(b.m1);
      out.push({ kind: "block", color: PALETTE.block, y: LAYER_Y.block, layer: LAYER.block, r0: b.r0, r1: b.r1, a0i: A0 + b.w0 / b.r0, a1i: A1 - b.w1 / b.r0, a0o: A0 + b.w0 / b.r1, a1o: A1 - b.w1 / b.r1 });
    }
  }
  // the arc streets, 2:00 to 10:00 with a half road of overhang at each end
  for (let i = 0; i < ARC_R.length; i++) {
    const half = arcWidth(i) / 2, over = half / ARC_R[i];
    out.push({ kind: "arc", color: PALETTE.road, y: LAYER_Y.street, layer: LAYER.street, r0: ARC_R[i] - half, r1: ARC_R[i] + half, a0: cang(CITY_FROM) - over, a1: cang(CITY_TO) + over });
  }
  // the radials, from the Esplanade out past L
  for (const m of RADIALS) out.push({ kind: "radial", color: PALETTE.road, y: LAYER_Y.street, layer: LAYER.street, from: polar(m, ARC_R[0]), to: polar(m, ARC_R[ARC_R.length - 1] + 28), width: radialWidth(m) });
  // Center Camp: the plaza, Rod's Road round it
  out.push({ kind: "disc", color: PLAZA, y: LAYER_Y.plaza, layer: LAYER.plaza, cx: CENTER_CAMP.x, cy: CENTER_CAMP.y, r: CENTER_CAMP_R });
  out.push({ kind: "ring", color: PALETTE.road, y: LAYER_Y.ring, layer: LAYER.ring, cx: CENTER_CAMP.x, cy: CENTER_CAMP.y, r0: CENTER_CAMP_R - 30, r: CENTER_CAMP_R + 30 });
  // the Man's circle and the Temple's
  out.push({ kind: "disc", color: PLAZA, y: LAYER_Y.plaza, layer: LAYER.plaza, cx: 0, cy: 0, r: MAN_R * 5 });
  out.push({ kind: "disc", color: PLAZA, y: LAYER_Y.plaza, layer: LAYER.plaza, cx: TEMPLE.x, cy: TEMPLE.y, r: TEMPLE_R * 3.4 });
  // the airport: two runways side by side and the apron beside them (AIRPORT.local turns the airport's frame into game feet)
  for (const off of [-AIRPORT.runwayOff, AIRPORT.runwayOff]) {
    out.push({ kind: "strip", color: PAVE, y: LAYER_Y.street, layer: LAYER.street, from: AIRPORT.local(-AIRPORT.runwayLen / 2, off), to: AIRPORT.local(AIRPORT.runwayLen / 2, off), width: AIRPORT.runwayW });
  }
  out.push({ kind: "strip", color: APRON, y: LAYER_Y.street, layer: LAYER.street, from: AIRPORT.local(-1800, -285), to: AIRPORT.local(400, -285), width: 90 });
  // Gate Road, from the city's last street out past the fence toward the highway
  out.push({ kind: "strip", color: PALETTE.road, y: LAYER_Y.street, layer: LAYER.street, from: GATE.road.from, to: GATE.road.to, width: GATE.width });
  return out;
}

/* ── the camps' structures ───────────────────────────────────────────────── */

export type PrismKind = StructKind | "rv-roof" | "shade-roof" | "pole" | "bike-row" | "dome-wire" | "stage-lip" | "flag-cloth";
/**
 * One piece to draw, in three.js axes: its centre (x east, y up, z south), its turn about Y (yaw = -rot), and the scale of a unit
 * shape (a box 1×1×1, a hemisphere of diameter 1, ...) that the renderer instances. `sector` (0..15) says which of the city's 16
 * wedges it is in, for culling by distance, and `ring` (0..11) which of the wedge's 12 blocks, from the Esplanade out. `n` is the bikes in a "bike-row"
 * and `step` the feet between them (the row runs along its x from the first bike, as the top-down painter lays them); `w` the width of an "arch" (the renderer shares one merged arch per width).
 */
export type Prism = { kind: PrismKind; x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number; hue: number; emissive: boolean; sector: number; ring: number; n?: number; step?: number; w?: number; label?: string };

/** Heights, in feet, of the things the camps are made of. */
export const H = { rv: 10, rvRoof: 0.3, pod: 14, tent: 8, shade: 10, shadeRoof: 0.5, canopy: 12, canopyRoof: 0.4, carpet: 0.2, couch: 3, stage: 4, stageLip: 0.5, speaker: 7, rack: 3, flag: 12, flagCloth: 4, arch: 9, potty: 8, signPost: 7, signBoard: 6, bike: 2.4 } as const;
/** Feet between parked bikes: in a row of "bikes" (PlayaWin's drawStruct), and in a rack (which also stops at the rack's far end). */
export const BIKE_SPACING = 4.2, RACK_SPACING = 4;

/** A point `lx` along and `lz` deep in a struct's own frame, as game (x, y). */
const local = (s: Struct, lx: number, lz: number): Vec => ({ x: s.x + lx * Math.cos(s.rot) - lz * Math.sin(s.rot), y: s.y + lx * Math.sin(s.rot) + lz * Math.cos(s.rot) });

/** Every piece of every camp: about 66,000 prisms for the 40,081 structures. */
export function campPrisms(plans: readonly BlockPlan[]): Prism[] {
  const out: Prism[] = [];
  for (const plan of plans) {
    const sector = plan.sector, ring = plan.ring;
    for (const s of plan.structs) {
      const yaw = yawOf(s.rot), base = { yaw, hue: s.hue, sector, ring };
      // a piece centred on the struct, at height y
      const box = (kind: PrismKind, y: number, sx: number, sy: number, sz: number, emissive = false, extra: Partial<Prism> = {}): void => { out.push({ kind, x: s.x, y, z: s.y, sx, sy, sz, emissive, ...base, ...extra }); };
      // a piece at a point of the struct's own frame
      const at = (kind: PrismKind, lx: number, lz: number, y: number, sx: number, sy: number, sz: number, emissive = false, extra: Partial<Prism> = {}): void => { const p = local(s, lx, lz); out.push({ kind, x: p.x, y, z: p.y, sx, sy, sz, emissive, ...base, ...extra }); };
      const hw = s.w / 2, hl = s.l / 2;
      switch (s.kind) {
        case "rv":
          box("rv", H.rv / 2, s.w, H.rv, s.l);
          box("rv-roof", H.rv + H.rvRoof / 2, s.w, H.rvRoof, s.l);
          break;
        case "pod": box("pod", 0, s.w, H.pod, s.l); break;                          // a hemisphere: 7 ft tall, base on the ground
        case "tent": box("tent", H.tent / 2, s.w * Math.SQRT2, H.tent, s.l * Math.SQRT2); break; // a four-sided cone, its base the struct's rectangle
        case "shade":
          box("shade-roof", H.shade, s.w, H.shadeRoof, s.l);
          for (const [lx, lz] of [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl]]) at("pole", lx, lz, H.shade / 2, 1, H.shade, 1);
          break;
        case "canopy":
          box("canopy", H.canopy, s.w, H.canopyRoof, s.l, true);
          for (const [lx, lz] of [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl], [0, -hl], [0, hl]]) at("pole", lx, lz, H.canopy / 2, 1, H.canopy, 1);
          break;
        case "carpet": box("carpet", H.carpet, s.w, 1, s.l); break;
        case "couch": box("couch", H.couch / 2, s.w, H.couch, s.l); break;
        case "dome":
          box("dome", 0, s.w, s.w, s.w);
          box("dome-wire", 0, s.w, s.w, s.w, true);
          break;
        case "stage":
          box("stage", H.stage / 2, s.w, H.stage, s.l);
          at("stage-lip", 0, hl - 1.5, H.stage + H.stageLip / 2, s.w, H.stageLip, 3, true);
          break;
        case "speaker": box("speaker", H.speaker / 2, s.w, H.speaker, s.l); break;
        case "rack":
          box("rack", H.rack / 2, s.w, H.rack, s.l);
          if (s.n) {   // front wheels in the rack, the bikes in front of it, the first 4 ft in from the rack's end and no more than fit (drawStruct)
            let fit = 0; while (fit < s.n && -hw + 4 + fit * RACK_SPACING <= hw - 2) fit++;
            if (fit) at("bike-row", -hw + 4, hl + 5, 0, 1, 1, 1, false, { n: fit, step: RACK_SPACING });
          }
          break;
        case "bikes": if (s.n) at("bike-row", -hw + 3, 0, 0, 1, 1, 1, false, { n: s.n, step: BIKE_SPACING }); break;
        case "flag":
          box("pole", H.flag / 2, 1, H.flag, 1);
          at("flag-cloth", 3.5, 0, H.flag - H.flagCloth / 2, 1, 1, 1);
          break;
        case "arch": box("arch", 0, 1, 1, 1, true, { w: s.w }); break;   // two posts and a lintel, one merged shape per width
        case "potty": box("potty", H.potty / 2, s.w, H.potty, s.l); break;
        case "sign":
          at("sign", 0, 0, H.signPost + H.signBoard / 2, s.w, H.signBoard, 1, false, { label: s.label });
          for (const lx of [-hw + 2, hw - 2]) at("pole", lx, 0, H.signPost / 2, 1, H.signPost, 1);
          break;
      }
    }
  }
  return out;
}

/** The 16 wedges of the city: for each, the centre and radius of the circle round each of its 12 blocks (and which ring, 0 at the Esplanade, that block is), for culling by distance (a wedge is 12 rings and about 4,600 ft deep: one centre point per wedge would drop the camps round you). */
export function sectorBlocks(plans: readonly BlockPlan[]): { cx: number; cy: number; br: number; ring: number }[][] {
  const out: { cx: number; cy: number; br: number; ring: number }[][] = Array.from({ length: RADIALS.length - 1 }, () => []);
  for (const p of plans) out[p.sector].push({ cx: p.cx, cy: p.cy, br: p.br, ring: p.ring });
  return out;
}

/* ── colours ─────────────────────────────────────────────────────────────── */

/** hsl (degrees, percent, percent) as 0xRRGGBB in sRGB, the way CSS reads it. */
export function hslHex(h: number, s: number, l: number): number {
  const hh = (((h % 360) + 360) % 360) / 60, ss = s / 100, ll = l / 100, c = (1 - Math.abs(2 * ll - 1)) * ss, x = c * (1 - Math.abs((hh % 2) - 1)), m = ll - c / 2;
  const [r, g, b] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const q = (v: number) => Math.max(0, Math.min(255, Math.round((v + m) * 255)));
  return (q(r) << 16) | (q(g) << 8) | q(b);
}

/** What colour a piece is (the same colours the top-down painter uses): 0xRRGGBB in sRGB. */
export function prismColor(p: Pick<Prism, "kind" | "hue">): number {
  const h = p.hue;
  switch (p.kind) {
    case "rv": return hslHex(h, 30, 85);
    case "rv-roof": return 0xd9d0bd;
    case "pod": return 0xe3e6ec;
    case "tent": return hslHex(h, 45, 58);
    case "shade-roof": case "shade": return 0xf6f1e6;
    case "canopy": return 0xfcfaf4;
    case "pole": return 0x6b5a44;
    case "carpet": return hslHex(h, 55, 42);
    case "couch": return hslHex(h, 45, 38);
    case "dome": return 0xf4efe6;
    case "dome-wire": return hslHex(h, 35, 52);
    case "stage": return 0x1b1f3b;
    case "stage-lip": return hslHex(h, 70, 58);
    case "speaker": return 0x14172c;
    case "rack": return 0x8a8fa3;
    case "bike-row": case "bikes": return 0xffffff;      // the bikes' own colours are baked into the shape
    case "flag": case "flag-cloth": return hslHex(h, 85, 58);
    case "arch": return hslHex(h, 60, 55);
    case "potty": return 0x3a6fd8;
    case "sign": return 0x8a6d45;
  }
}

/** The colour of bike k in a row of bikes (the rows are the same shape, so their colours are baked in by position). */
export const bikeColor = (k: number) => hslHex((k * 83) % 360, 70, 55);

/* ── the fence, the airport, the Gate ────────────────────────────────────── */

/**
 * The fence's pieces: the pentagon's five sides with the airport's wedge (AIRPORT.gap, a range on the clock) cut out, because the sim
 * has no fence there (playa.ts lets rides and planes through). A side the wedge crosses is cut where the rays from the Man at the wedge's
 * two edges meet it, so a side is one piece, two, or none.
 */
export function fenceSegments(): { a: Vec; b: Vec }[] {
  const out: { a: Vec; b: Vec }[] = [];
  const cross = (u: Vec, v: Vec) => u.x * v.y - u.y * v.x;
  for (let i = 0; i < FENCE.length; i++) {
    const a = FENCE[i], b = FENCE[(i + 1) % FENCE.length], e = { x: b.x - a.x, y: b.y - a.y };
    // where along a → b (0..1) the ray from the Man at clock minute m crosses the side
    const at = (m: number) => { const d = polar(m, 1); return cross(a, d) / cross(d, e); };
    let ca = toPolar(a).min, cb = toPolar(b).min; if (cb <= ca) cb += 720;
    const lo = Math.max(ca, AIRPORT.gap.from), hi = Math.min(cb, AIRPORT.gap.to);
    if (lo >= hi) { out.push({ a, b }); continue; }   // the wedge misses this side
    const lerp = (t: number): Vec => ({ x: a.x + e.x * t, y: a.y + e.y * t });
    if (lo > ca) out.push({ a, b: lerp(at(lo)) });
    if (hi < cb) out.push({ a: lerp(at(hi)), b });
  }
  return out;
}

/** A post every ~300 ft along the fence's pieces (the corners and the ends of a cut side included). */
export function fencePosts(spacing = 300): Vec[] {
  const out: Vec[] = [];
  for (const { a, b } of fenceSegments()) {
    const len = Math.hypot(b.x - a.x, b.y - a.y), n = Math.max(1, Math.round(len / spacing));
    for (let k = 0; k <= n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n };
      if (!out.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < 1e-6)) out.push(p);   // a corner is the end of one piece and the start of the next
    }
  }
  return out;
}

/** The airport's five hangars (300 × 200 ft, turned with the runways) and its windsock, from PlayaWin's drawAirport. */
export function airportLayout(): { hangars: { x: number; y: number; w: number; d: number; yaw: number }[]; windsock: Vec; yaw: number } {
  const hangars = Array.from({ length: 5 }, (_, k) => { const p = AIRPORT.local(-1700 + k * 420 + 150, -460); return { x: p.x, y: p.y, w: 300, d: 200, yaw: yawOf(AIRPORT.ta) }; });
  return { hangars, windsock: AIRPORT.local(1200, -420), yaw: yawOf(AIRPORT.ta) };
}

/** The Gate: seven booths across the road under a long shade, flag posts at its ends, the bell, the stop. All in game feet; `yaw` turns them across the road. */
export function gateLayout(): { booths: Vec[]; poles: Vec[]; shade: Vec; yaw: number; bell: Vec; stop: Vec } {
  const { at, a } = GATE, along = (lx: number): Vec => ({ x: at.x + lx * Math.cos(a), y: at.y + lx * Math.sin(a) });
  return { booths: [-3, -2, -1, 0, 1, 2, 3].map((k) => along(k * 50)), poles: [-180, 180].flatMap((lx) => [-26, 26].map((lz) => ({ x: along(lx).x - lz * Math.sin(a), y: along(lx).y + lz * Math.cos(a) }))), shade: at, yaw: yawOf(a), bell: GATE.bell, stop: GATE.stop };
}

/* ── the mountains ───────────────────────────────────────────────────────── */

const hash = (n: number) => { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; };
const smooth = (t: number) => t * t * (3 - 2 * t);
/** Value noise that repeats every n columns, `cells` cells round. */
function ringNoise(i: number, n: number, cells: number, seed: number): number {
  const x = (i / n) * cells, i0 = Math.floor(x), t = smooth(x - i0), a = hash(seed + (i0 % cells) * 7919), b = hash(seed + ((i0 + 1) % cells) * 7919);
  return a + (b - a) * t;
}
const bump = (theta: number, centre: number, width: number) => { const d = Math.atan2(Math.sin(theta - centre), Math.cos(theta - centre)); return Math.exp(-(d * d) / (2 * width * width)); };
/**
 * The skyline all the way round, as n heights in 0..1 for columns of the mountain ring. Column i looks toward the world direction
 * (sin θ, cos θ) in (X, Z) with θ = 2π·i/n (three.js's CylinderGeometry has u = 0 toward +Z, south, and runs toward +X, east). The ranges stand
 * where the satellite view has them (citymap.ts surroundImage): the Granite Range along the west (-X), the Calico and Jackson hills to the
 * north-east, the far shore low to the north, the dust flats open to the south.
 */
export function skyline(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const th = (2 * Math.PI * i) / n;
    const base = 0.07 + 0.88 * bump(th, (3 * Math.PI) / 2, 0.95) + 0.62 * bump(th, (3 * Math.PI) / 4, 0.55) + 0.28 * bump(th, Math.PI, 0.8) + 0.18 * bump(th, Math.PI / 2, 0.5);
    const jag = 0.55 * ringNoise(i, n, 9, 11) + 0.3 * ringNoise(i, n, 31, 23) + 0.15 * ringNoise(i, n, 97, 37);
    out.push(Math.max(0, Math.min(1, base * (0.45 + 0.75 * jag))));
  }
  return out;
}
