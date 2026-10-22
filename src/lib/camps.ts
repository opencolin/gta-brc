/**
 * The camps inside Black Rock City's blocks, for the playa game: each block split into
 * several camps along its frontage with alleys between them (and a back row facing the next
 * street out where the block is deep), each laid out its own way: an RV circle round a
 * shared shade, rows of shiftpods, a big shade with carpets and couches, geodesic domes, a
 * little stage with speakers. Bike racks, flags, LED arches at the entrance, a porta-potty
 * bank here and there, and signs with invented camp names.
 *
 * Generated once, deterministically, from a hash of the block, so it is stable and costs
 * nothing per frame. playa.ts collides with the solid parts (bikes and the unicycle ride the
 * alleys; cars never get in), PlayaWin.tsx draws what is on screen. No imports but brc.ts,
 * no DOM: playa.test.mjs checks it.
 */
import { ARC_R, RADIALS, blockBounds, clockToAngle, polar, surfaceAt, type Vec } from "./brc.ts";

export type StructKind = "rv" | "pod" | "tent" | "shade" | "canopy" | "carpet" | "couch" | "dome" | "stage" | "speaker" | "rack" | "flag" | "arch" | "potty" | "sign";
/**
 * One thing in a camp: a rectangle `w` along × `l` deep turned to `rot` (canvas radians), or
 * a circle of radius w / 2 when `round`. `solid` things are bounced off.
 */
export type Struct = { kind: StructKind; x: number; y: number; rot: number; w: number; l: number; hue: number; solid: boolean; round?: boolean; label?: string };
export type BlockPlan = { ring: number; sector: number; cx: number; cy: number; br: number; structs: Struct[]; solids: Struct[] };
export type Avoid = { x: number; y: number; r: number };

const K = 720 / (Math.PI * 2); // clock minutes per radian
function hash(n: number) { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }

/* invented camp names: nobody's real camp */
const ADJ = ["Dusty", "Velvet", "Sleepy", "Cosmic", "Wobbly", "Neon", "Sticky", "Glitter", "Gentle", "Hungry", "Upside-down", "Fuzzy", "Tiny", "Electric", "Moonlit", "Soggy"];
const NOUN = ["Teacup", "Llama", "Pancake", "Lantern", "Spoon", "Moth", "Penguin", "Hammock", "Bathtub", "Accordion", "Pickle", "Tortoise", "Kazoo", "Disco Yeti", "Noodle", "Snail"];
export function campName(seed: number): string {
  const a = ADJ[Math.floor(hash(seed) * ADJ.length)], n = NOUN[Math.floor(hash(seed + 1) * NOUN.length)];
  const f = hash(seed + 2);
  return f < 0.4 ? `Camp ${a} ${n}` : f < 0.7 ? `The ${a} ${n}` : `${a} ${n} Camp`;
}

/** A frame at a lot: its middle, the along-the-street axis and the toward-the-frontage axis. */
type Frame = { o: Vec; ax: Vec; ay: Vec; rot: number };
const put = (f: Frame, lx: number, ly: number): Vec => ({ x: f.o.x + f.ax.x * lx + f.ay.x * ly, y: f.o.y + f.ax.y * lx + f.ay.y * ly });

/**
 * Lay out one lot, U ft along the street and W ft deep, frontage at ly = +W/2. Returns the
 * things in it, in the lot's frame (rotation relative to the lot).
 */
type LotThing = Omit<Struct, "x" | "y" | "rot"> & { lx: number; ly: number; r: number };
function layLot(U: number, W: number, seed: number, rnd: () => number): LotThing[] {
  const out: LotThing[] = [];
  const add = (kind: StructKind, lx: number, ly: number, w: number, l: number, hue: number, solid: boolean, r = 0, extra: Partial<Struct> = {}) => out.push({ kind, lx, ly, w, l, hue, solid, r, ...extra });
  const hue = Math.floor(rnd() * 360);
  const fy = W / 2; // the frontage edge
  const inner = { u: U / 2 - 8, w0: -W / 2 + 8, w1: fy - 22 }; // leave a strip at the street for the entrance
  const kind = Math.floor(hash(seed * 7 + 3) * 5);
  if (kind === 0 && U > 90 && W > 90) {
    // an RV circle round a shared shade, open toward the street
    const R = Math.min(U - 16, inner.w1 - inner.w0) / 2 - 10, cy = (inner.w0 + inner.w1) / 2;
    add("shade", 0, cy, R * 0.8, R * 0.8, hue, true);
    const n = Math.max(4, Math.min(8, Math.floor((R * Math.PI * 2) / 40)));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3;
      if (Math.sin(a) > 0.75) continue; // the gap toward the frontage
      add("rv", Math.cos(a) * R, cy + Math.sin(a) * R, 28, 10, (hue + k * 23) % 360, true, a + Math.PI / 2);
    }
  } else if (kind === 1) {
    // rows of shiftpods at the back, a kitchen shade at the front
    const rows = W > 110 ? 2 : 1;
    for (let row = 0; row < rows; row++) for (let lx = -U / 2 + 14; lx <= U / 2 - 14; lx += 22) add("pod", lx, -W / 2 + 12 + row * 26, 13, 13, (hue + row * 40) % 360, true);
    if (W > 70) add("shade", 0, inner.w1 - 18, Math.min(U - 30, 50), 22, hue, true);
  } else if (kind === 2) {
    // a big shade over carpets and couches: you can ride under the canopy, not through the couches
    const cw = U - 24, cl = Math.min(W - 40, 90), cy = (inner.w0 + inner.w1) / 2;
    add("carpet", 0, cy, cw * 0.8, cl * 0.7, (hue + 180) % 360, false);
    for (const sx of [-1, 1]) add("couch", sx * cw * 0.32, cy, 6, cl * 0.45, hue, true);
    add("couch", 0, cy - cl * 0.33, cw * 0.35, 6, hue, true);
    add("canopy", 0, cy, cw, cl, hue, false);
  } else if (kind === 3) {
    // geodesic domes, a big one and smaller ones
    const big = Math.min(U, W) * 0.36;
    add("dome", -U * 0.15, (inner.w0 + inner.w1) / 2 - 6, big * 2, big * 2, hue, true, 0, { round: true });
    for (let k = 0; k < 2; k++) { const r = 8 + rnd() * 6; add("dome", U * 0.28, inner.w0 + 16 + k * 32, r * 2, r * 2, (hue + 60 * (k + 1)) % 360, true, 0, { round: true }); }
  } else {
    // a little stage with speakers, a carpet dancefloor in front of it
    const cy = inner.w0 + 14;
    add("stage", 0, cy, Math.min(40, U - 30), 16, hue, true);
    for (const sx of [-1, 1]) add("speaker", sx * (Math.min(40, U - 30) / 2 + 7), cy, 7, 7, 0, true);
    add("carpet", 0, cy + 30, Math.min(56, U - 20), 34, (hue + 200) % 360, false);
  }
  // tents in the back corners when there is room
  for (const sx of [-1, 1]) if (rnd() < 0.6 && kind !== 1) add("tent", sx * (U / 2 - 12), -W / 2 + 12, 12, 10, Math.floor(rnd() * 360), true);
  // the frontage: an LED arch over the way in, flags, a bike rack, a sign
  add("arch", 0, fy - 6, 22, 3, hue, false);
  for (const sx of [-1, 1]) add("flag", sx * 15, fy - 6, 3, 3, (hue + 120) % 360, false);
  if (rnd() < 0.7) add("rack", -U / 2 + 20, fy - 12, 22, 3, 0, true);
  if (rnd() < 0.55) add("sign", U / 2 - 20, fy - 8, 26, 6, hue, false, 0, { label: campName(seed) });
  return out;
}

const PLANS = new Map<string, BlockPlan[]>();

/**
 * Every block's camps. `avoid` keeps the things out of circles (the sound camps' stages and
 * parking bays, Agave's dome, Center Camp); `potties` are the radials (minutes) that get a
 * porta-potty bank at B and at H.
 */
export function planCity(avoid: readonly Avoid[] = [], potties: readonly number[] = [180, 270, 450, 540]): BlockPlan[] {
  const key = JSON.stringify(avoid.map((a) => [Math.round(a.x), Math.round(a.y), Math.round(a.r)]));
  const hit = PLANS.get(key);
  if (hit) return hit;
  const out: BlockPlan[] = [];
  for (let ring = 0; ring < ARC_R.length - 1; ring++) {
    for (let sector = 0; sector < RADIALS.length - 1; sector++) {
      const seed = ring * 97 + sector * 13 + 1;
      let n = 0;
      const rnd = () => hash(seed * 1000 + n++);
      const b = blockBounds(ring, sector);
      const depth = b.r1 - b.r0;
      const rm = (b.r0 + b.r1) / 2, am = clockToAngle((b.m0 + b.m1) / 2);
      const len = rm * clockToAngle(b.m1 - b.m0);
      const plan: BlockPlan = { ring, sector, cx: rm * Math.sin(am), cy: -rm * Math.cos(am), br: Math.hypot(len / 2, depth / 2) + 30, structs: [], solids: [] };
      // a front row facing the street nearer the Man, and a back row facing the next street out where the block is deep enough
      const rows: { front: boolean; w0: number; w1: number }[] = depth > 240
        ? [{ front: true, w0: 0, w1: depth / 2 - 9 }, { front: false, w0: depth / 2 + 9, w1: depth }]
        : [{ front: true, w0: 0, w1: depth }];
      let lotSeed = seed * 31;
      for (const row of rows) {
        const W = row.w1 - row.w0;
        // the row's edge at its narrow end (the inner one), measured along the arc, with the radials' half widths off
        const rIn = b.r0 + row.w0;
        const a0 = clockToAngle(b.m0) + b.w0 / rIn, a1 = clockToAngle(b.m1) - b.w1 / rIn;
        const span = (a1 - a0) * rIn;
        const lots = Math.max(1, Math.round(span / (130 + rnd() * 70)));
        const ALLEY = 16;
        const U = (span - ALLEY * (lots - 1)) / lots;
        for (let k = 0; k < lots; k++) {
          lotSeed++;
          const uMid = -span / 2 + U / 2 + k * (U + ALLEY);
          const r = b.r0 + (row.w0 + row.w1) / 2;
          const minC = ((a0 + a1) / 2) * K + (uMid / rIn) * K;
          const o = polar(minC, r);
          const a = clockToAngle(minC);
          const ax = { x: Math.cos(a), y: Math.sin(a) };
          const out1 = { x: Math.sin(a), y: -Math.cos(a) };
          const ay = row.front ? { x: -out1.x, y: -out1.y } : out1; // toward the lot's street
          const f: Frame = { o, ax, ay, rot: a };
          for (const s of layLot(U, W, lotSeed, rnd)) {
            const p = put(f, s.lx, s.ly);
            const rad = s.round ? s.w / 2 : Math.hypot(s.w, s.l) / 2;
            if (avoid.some((v) => Math.hypot(p.x - v.x, p.y - v.y) < v.r + rad)) continue;
            // keep everything inside its block, clear of the streets
            if (surfaceAt(p).kind !== "block") continue;
            const st: Struct = { kind: s.kind, x: p.x, y: p.y, rot: a + s.r, w: s.w, l: s.l, hue: s.hue, solid: s.solid, ...(s.round ? { round: true } : {}), ...(s.label ? { label: s.label } : {}) };
            if (s.solid && !fits(st)) continue;
            plan.structs.push(st);
          }
        }
      }
      // porta-potty banks on the big radials, at B and at H
      if ((ring === 1 || ring === 7) && potties.includes(b.m0)) {
        for (let k = 0; k < 8; k++) {
          const r = b.r0 + 24 + k * 11, a = clockToAngle(b.m0) + (b.w0 + 12) / r;
          const p = { x: Math.sin(a) * r, y: -Math.cos(a) * r };
          if (avoid.some((v) => Math.hypot(p.x - v.x, p.y - v.y) < v.r + 8)) continue;
          plan.structs.push({ kind: "potty", x: p.x, y: p.y, rot: a, w: 8, l: 8, hue: 0, solid: true });
        }
      }
      // what is drawn later lands on top: carpets first, canopies last
      const order: Partial<Record<StructKind, number>> = { carpet: 0, canopy: 9, sign: 10, arch: 8, flag: 8 };
      plan.structs.sort((p, q) => (order[p.kind] ?? 5) - (order[q.kind] ?? 5));
      plan.solids = plan.structs.filter((s) => s.solid);
      out.push(plan);
    }
  }
  PLANS.set(key, out);
  return out;
}

/** The corners of a struct's rectangle. */
export function corners(s: Struct): Vec[] {
  const c = Math.cos(s.rot), n = Math.sin(s.rot), hw = s.w / 2, hl = s.l / 2;
  return [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]].map(([u, v]) => ({ x: s.x + c * u - n * v, y: s.y + n * u + c * v }));
}
/** A solid thing's footprint stays in the block: every corner on block ground. */
function fits(s: Struct): boolean {
  const pts = s.round ? [0, 1, 2, 3].map((k) => ({ x: s.x + Math.cos(k * Math.PI / 2) * s.w / 2, y: s.y + Math.sin(k * Math.PI / 2) * s.w / 2 })) : corners(s);
  return pts.every((p) => surfaceAt(p).kind === "block");
}

/** How deep a point is inside a solid thing, and the shortest way out; null when it is in none. */
export function structPush(p: Vec, s: Struct): { depth: number; nx: number; ny: number } | null {
  if (s.round) {
    const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy), r = s.w / 2;
    if (d >= r) return null;
    return d > 1e-6 ? { depth: r - d, nx: dx / d, ny: dy / d } : { depth: r, nx: 0, ny: -1 };
  }
  const c = Math.cos(s.rot), n = Math.sin(s.rot);
  const dx = p.x - s.x, dy = p.y - s.y;
  const u = dx * c + dy * n, v = -dx * n + dy * c;
  const hw = s.w / 2, hl = s.l / 2;
  if (Math.abs(u) >= hw || Math.abs(v) >= hl) return null;
  const du = hw - Math.abs(u), dv = hl - Math.abs(v);
  if (du < dv) { const sg = Math.sign(u) || 1; return { depth: du, nx: c * sg, ny: n * sg }; }
  const sg = Math.sign(v) || 1;
  return { depth: dv, nx: -n * sg, ny: c * sg };
}

/** The block plan a point is in, or null. */
export function planAt(plans: readonly BlockPlan[], p: Vec): BlockPlan | null {
  const s = surfaceAt(p);
  if (s.kind !== "block") return null;
  return plans[s.ring * (RADIALS.length - 1) + s.sector] ?? null;
}
