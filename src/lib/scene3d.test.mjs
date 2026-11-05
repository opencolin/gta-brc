// node --experimental-strip-types --test src/lib/scene3d.test.mjs
// The chase view's scene description (scene3d.ts): ground flats, camp prisms, culling circles, colours, fence, airport, Gate, skyline.
import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { AIRPORT, ARCS, ARC_R, CENTER_CAMP, CENTER_CAMP_R, CITY_FROM, CITY_TO, FENCE, GATE, MAN_R, RADIALS, TEMPLE, TEMPLE_R, clockToAngle, fenceDepth, polar, surfaceAt, toPolar } from "./brc.ts";
import { AGAVE, SPOTS, cityPlan } from "./playa.ts";
import { BIKE_SPACING, H, RACK_SPACING, airportLayout, bikeColor, FENCE_PATCH, MAP_PLAYA, campPrisms, fadeAt, crowdSpots, fenceGap, fencePosts, fenceSegments, gateLayout, groundFlats, hslHex, prismColor, sectorBlocks, skyline } from "./scene3d.ts";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const plans = cityPlan();
// a point from canvas angle a (the Flat shapes' own: from +x, clockwise on a y-down screen) and radius r, as game feet
const at = (a, r) => ({ x: r * Math.cos(a), y: r * Math.sin(a) });
const lerp = (a, b, t) => a + (b - a) * t;

test("the ground has 12 arc streets, 17 radials and 176 blocks, each well formed", () => {
  const flats = groundFlats();
  const arcs = flats.filter((f) => f.kind === "arc"), radials = flats.filter((f) => f.kind === "radial"), blocks = flats.filter((f) => f.kind === "block");
  assert.equal(arcs.length, ARC_R.length); assert.equal(arcs.length, 12);
  assert.equal(radials.length, RADIALS.length); assert.equal(radials.length, 17);
  assert.equal(blocks.length, 176);
  for (const b of blocks) {
    assert.ok(b.r0 < b.r1, "block r0 < r1");
    assert.ok(b.a0i < b.a1i, "inner edge runs the right way");
    assert.ok(b.a0o < b.a1o, "outer edge runs the right way");
  }
  for (const a of arcs) { assert.ok(a.r0 < a.r1 && a.a0 < a.a1); assert.ok(a.a1 - a.a0 > 4, "a street sweeps 8 hours of the clock (240°) and a bit"); }
  for (const r of radials) assert.ok(Math.hypot(r.to.x - r.from.x, r.to.y - r.from.y) > 4000 && r.width >= 72);
  // a radial street keeps its width in feet: the gap between two blocks' edges at the inner and the outer radius is the same
  const b0 = blocks[0], b1 = blocks[1];
  near((b1.a0i - b0.a1i) * b0.r0, (b1.a0o - b0.a1o) * b0.r1, 1e-6);
});

test("the ground's layers are ordered: blocks under streets under plazas, each with a distinct height", () => {
  const flats = groundFlats();
  const y = (kind, color) => flats.find((f) => f.kind === kind && (!color || f.color === color));
  const block = y("block"), arc = y("arc"), disc = y("disc"), ring = y("ring");
  assert.ok(block.y < arc.y && arc.y < disc.y && disc.y < ring.y);
  assert.ok(block.layer < arc.layer && arc.layer < disc.layer && disc.layer < ring.layer);
  // plazas for Center Camp, the Man and the Temple, and the 11 round plazas at B and G; two runways and an apron and Gate Road
  assert.equal(flats.filter((f) => f.kind === "disc").length, 14);
  assert.equal(flats.filter((f) => f.kind === "strip").length, 4);
});

test("campPrisms: about 61,000 pieces for the 36,368 structures, all with a size and a sector", () => {
  const prisms = campPrisms(plans);
  const structs = plans.reduce((n, p) => n + p.structs.length, 0);
  assert.equal(structs, 36368);   // 36,375 until the tea houses took their lots, 36,344 until camps shared lots, 36,732 until PlayAlchemist's pyramid grew, 36,728 until the camps' whole lots were their parking (2026-11-04)
  assert.ok(prisms.length >= 40000, `${prisms.length} prisms`);
  for (const p of prisms) {
    assert.ok(p.sy > 0 && p.sx > 0 && p.sz > 0, `${p.kind} has a size`);
    assert.ok(Number.isInteger(p.sector) && p.sector >= 0 && p.sector <= 15, "sector 0..15");
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) && Number.isFinite(p.yaw));
  }
});

test("campPrisms: arches glow, bike rows carry 2 to 6 bikes, and there is one row per rack or bikes struct", () => {
  const prisms = campPrisms(plans);
  const arches = prisms.filter((p) => p.kind === "arch");
  assert.equal(arches.length, plans.reduce((n, p) => n + p.structs.filter((s) => s.kind === "arch").length, 0));
  assert.ok(arches.every((p) => p.emissive && p.w > 0), "every arch is emissive and knows its width");
  const rows = prisms.filter((p) => p.kind === "bike-row");
  assert.ok(rows.every((p) => p.n >= 2 && p.n <= 6), "n in 2..6");
  const withN = plans.reduce((n, p) => n + p.structs.filter((s) => (s.kind === "rack" || s.kind === "bikes") && s.n).length, 0);
  assert.equal(rows.length, withN); assert.ok(withN > 5000);
});

test("campPrisms: each struct becomes the pieces the plan lists", () => {
  const prisms = campPrisms(plans), count = (k) => prisms.filter((p) => p.kind === k).length;
  const structs = (k) => plans.reduce((n, p) => n + p.structs.filter((s) => s.kind === k).length, 0);
  assert.equal(count("rv"), structs("rv")); assert.equal(count("rv-roof"), structs("rv"));
  assert.equal(count("shade-roof"), structs("shade")); assert.equal(count("canopy"), structs("canopy"));
  assert.equal(count("pod"), structs("pod")); assert.equal(count("tent"), structs("tent"));
  assert.equal(count("dome"), structs("dome")); assert.equal(count("dome-wire"), structs("dome"));
  assert.equal(count("stage"), structs("stage")); assert.equal(count("stage-lip"), structs("stage"));
  assert.equal(count("flag-cloth"), structs("flag"));
  assert.equal(count("sign"), structs("sign"));
  assert.equal(count("pole"), 4 * structs("shade") + 6 * structs("canopy") + structs("flag") + 2 * structs("sign"));
  assert.equal(count("shade"), 0, "a shade is a roof and four poles, not a 'shade'");
});

test("a struct's frame: x, z, yaw = -rot, and poles at its rotated corners", () => {
  const plan = { ring: 0, sector: 3, cx: 0, cy: 0, br: 100, solids: [], structs: [
    { kind: "rv", x: 100, y: -200, rot: 0.5, w: 28, l: 10, hue: 40, solid: true },
    { kind: "shade", x: 10, y: 20, rot: Math.PI / 2, w: 40, l: 20, hue: 120, solid: true },
  ] };
  const [rv, roof, ...rest] = campPrisms([plan]);
  assert.equal(rv.kind, "rv"); assert.equal(rv.x, 100); assert.equal(rv.z, -200); near(rv.yaw, -0.5);
  assert.equal(rv.sx, 28); assert.equal(rv.sy, H.rv); assert.equal(rv.sz, 10); near(rv.y, H.rv / 2); assert.equal(rv.sector, 3);
  assert.equal(roof.kind, "rv-roof"); near(roof.y, H.rv + H.rvRoof / 2);
  const shade = rest.find((p) => p.kind === "shade-roof"), poles = rest.filter((p) => p.kind === "pole");
  near(shade.y, H.shade); assert.equal(poles.length, 4);
  // rot = π/2: the struct's local (lx, lz) is game (x - lz, y + lx); the corner (+20, +10) lands at (0, 40)
  const want = [[-20, -10], [20, -10], [-20, 10], [20, 10]].map(([lx, lz]) => [10 - lz, 20 + lx]);
  for (const [gx, gy] of want) assert.ok(poles.some((p) => Math.abs(p.x - gx) < 1e-6 && Math.abs(p.z - gy) < 1e-6), `a pole at ${gx}, ${gy}`);
});

test("sectorBlocks: 16 wedges of 11 block circles each", () => {
  const sb = sectorBlocks(plans);
  assert.equal(sb.length, 16);
  for (const w of sb) { assert.equal(w.length, 11); for (const b of w) assert.ok(b.br > 100 && Number.isFinite(b.cx) && Number.isFinite(b.cy)); }
});

test("colours: hsl to hex the way CSS reads it, and every kind has one", () => {
  assert.equal(hslHex(0, 100, 50), 0xff0000); assert.equal(hslHex(120, 100, 50), 0x00ff00); assert.equal(hslHex(240, 100, 50), 0x0000ff);
  assert.equal(hslHex(0, 0, 100), 0xffffff); assert.equal(hslHex(0, 0, 0), 0x000000); assert.equal(hslHex(360, 100, 50), 0xff0000);
  assert.equal(hslHex(200, 50, 50), 0x4095bf);
  for (const k of ["rv", "rv-roof", "pod", "tent", "shade-roof", "canopy", "pole", "carpet", "couch", "dome", "dome-wire", "stage", "stage-lip", "speaker", "rack", "bike-row", "flag-cloth", "arch", "potty", "sign"]) {
    const c = prismColor({ kind: k, hue: 77 }); assert.ok(Number.isInteger(c) && c >= 0 && c <= 0xffffff, k);
  }
  assert.equal(prismColor({ kind: "pod", hue: 5 }), 0xe3e6ec); assert.equal(prismColor({ kind: "potty", hue: 5 }), 0x3a6fd8);
  assert.notEqual(bikeColor(0), bikeColor(1));
});

test("the fence is the pentagon with the airport's wedge left open, and its posts sit on it about 300 ft apart", () => {
  const segs = fenceSegments(), posts = fencePosts();
  assert.equal(segs.length, 5, "four whole sides' worth of fence and one side cut into two pieces, one side cut short");
  for (const { a, b } of segs) for (const p of [a, b]) assert.ok(Math.abs(fenceDepth(p).depth) < 1e-6, "on the fence line");
  // nothing of it stands between 3:35 and 4:50 on the clock (AIRPORT.gap), and the cuts are exactly at those two rays
  const gap = (p) => { const m = toPolar(p).min; return m > AIRPORT.gap.from + 1e-6 && m < AIRPORT.gap.to - 1e-6; };
  for (const { a, b } of segs) for (let k = 0; k <= 20; k++) assert.ok(!gap({ x: a.x + ((b.x - a.x) * k) / 20, y: a.y + ((b.y - a.y) * k) / 20 }), "no fence in the gap");
  assert.ok(segs.some(({ b }) => Math.abs(toPolar(b).min - AIRPORT.gap.from) < 1e-6), "a piece ends where the gap starts");
  assert.ok(segs.some(({ a }) => Math.abs(toPolar(a).min - AIRPORT.gap.to) < 1e-6), "a piece starts where the gap ends");
  assert.ok(posts.length > 190 && posts.length < 240, `${posts.length} posts`);
  for (const p of posts) { assert.ok(Math.abs(fenceDepth(p).depth) < 1e-6, "on the fence line"); assert.ok(!gap(p), "not in the gap"); }
  // the corners outside the gap each have a post, and the posts on a piece are between 250 and 350 ft apart
  for (const c of FENCE) if (!gap(c)) assert.ok(posts.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 1e-6));
  for (let i = 1; i < posts.length; i++) { const d = Math.hypot(posts[i].x - posts[i - 1].x, posts[i].y - posts[i - 1].y); if (d < 600) assert.ok(d > 250 && d < 350, `${d}`); }
});

test("parked bikes are laid out as the top-down painter lays them: a rack's from 4 ft in, 4 ft apart, as many as fit; a row's from 3 ft in, 4.2 ft apart", () => {
  const rows = (kind) => campPrisms([{ ring: 0, sector: 3, cx: 0, cy: 0, br: 100, solids: [], structs: [{ kind, x: 100, y: -200, rot: 0, w: kind === "rack" ? 22 : 12, l: 6, hue: 40, solid: false, n: 6 }] }]).find((p) => p.kind === "bike-row");
  const rack = rows("rack"), row = rows("bikes");
  // a 22 ft rack: bikes at x = -7, -3, 1, 5, 9 (the sixth would be at 13 > hw - 2); placed at the first, 5 ft in front of the rack's front edge
  assert.equal(rack.n, 5); assert.equal(rack.step, RACK_SPACING); near(rack.x, 100 - 11 + 4); near(rack.z, -200 + 3 + 5);
  assert.equal(row.n, 6); assert.equal(row.step, BIKE_SPACING); near(row.x, 100 - 6 + 3); near(row.z, -200);
});

test("the airport has five hangars along its apron, turned with the runways, and a windsock", () => {
  const a = airportLayout();
  assert.equal(a.hangars.length, 5);
  near(a.hangars[0].x, AIRPORT.local(-1550, -460).x); near(a.hangars[0].y, AIRPORT.local(-1550, -460).y);
  near(a.hangars[4].x, AIRPORT.local(-1550 + 4 * 420, -460).x);
  assert.ok(a.hangars.every((h) => h.w === 300 && h.d === 200 && Math.abs(h.yaw + AIRPORT.ta) < 1e-12));
  near(a.windsock.x, AIRPORT.local(1200, -420).x);
});

test("the Gate has seven booths 50 ft apart across the road under one shade, with the bell and the stop", () => {
  const g = gateLayout();
  assert.equal(g.booths.length, 7); assert.equal(g.poles.length, 4);
  for (let i = 1; i < 7; i++) near(Math.hypot(g.booths[i].x - g.booths[i - 1].x, g.booths[i].y - g.booths[i - 1].y), 50, 1e-6);
  near(g.booths[3].x, GATE.at.x); near(g.booths[3].y, GATE.at.y);
  assert.deepEqual(g.bell, GATE.bell); assert.deepEqual(g.stop, GATE.stop); near(g.yaw, -GATE.a);
});

test("the skyline: n heights in 0..1 that close up, tallest in the west and low over the dust flats to the south", () => {
  const n = 2048, s = skyline(n);
  assert.equal(s.length, n);
  assert.ok(s.every((h) => h >= 0 && h <= 1));
  assert.ok(Math.abs(s[0] - s[n - 1]) < 0.15, "the seam is closed");
  const avg = (from, to) => { let t = 0; for (let i = from; i < to; i++) t += s[i]; return t / (to - from); };
  // column i looks toward (sin θ, cos θ) with θ = 2π i/n: south is i = 0, east n/4, north n/2, west 3n/4
  const south = avg(-0 + 0, n / 16) * 0.5 + avg(n - n / 16, n) * 0.5, west = avg((11 * n) / 16, (13 * n) / 16), northEast = avg((5 * n) / 16, (7 * n) / 16);
  assert.ok(west > 3 * south, `west ${west} vs south ${south}`);
  assert.ok(northEast > 2 * south, `north-east ${northEast} vs south ${south}`);
  assert.ok(west > northEast, "the Granite Range is the tallest");
  assert.ok(new Set(s.map((h) => h.toFixed(3))).size > n / 4, "jagged, not smooth");
});

/* ── the layout, pinned to brc.ts and the sim (a rotated, mirrored or mis-sized city must fail these) ─────────────── */

test("every block flat lies on the block the sim says is there (surfaceAt), ring and sector", () => {
  const blocks = groundFlats().filter((f) => f.kind === "block");
  assert.equal(blocks.length, (ARC_R.length - 1) * (RADIALS.length - 1));
  blocks.forEach((b, i) => {
    const ring = Math.floor(i / (RADIALS.length - 1)), sector = i % (RADIALS.length - 1);
    // the edges are A0 + w0/r and A1 - w1/r (a street keeps its width in feet): recover them from the inner and outer angles
    const w0 = (b.a0i - b.a0o) / (1 / b.r0 - 1 / b.r1), A0 = b.a0i - w0 / b.r0, w1 = (b.a1o - b.a1i) / (1 / b.r0 - 1 / b.r1), A1 = b.a1i + w1 / b.r0;
    // the sector's edges are its two radials (clock minutes 120 + 30 sector and 150 + 30 sector), in canvas angles, with the half widths of those streets
    const wide = (m) => ([180, 270, 360, 450, 540].includes(m) ? 52 : 36);
    near(A0, clockToAngle(120 + 30 * sector) - Math.PI / 2, 1e-9); near(A1, clockToAngle(150 + 30 * sector) - Math.PI / 2, 1e-9);
    near(w0, wide(120 + 30 * sector), 1e-6); near(w1, wide(150 + 30 * sector), 1e-6);
    for (const u of [0.02, 0.5, 0.98]) for (const v of [0.02, 0.5, 0.98]) {
      const r = lerp(b.r0, b.r1, u), p = at(lerp(A0 + w0 / r, A1 - w1 / r, v), r), sf = surfaceAt(p);
      if (sf.kind === "plaza") continue;   // Center Camp's plaza reaches into the blocks beside it
      assert.deepEqual(sf, { kind: "block", ring, sector }, `block ${ring}/${sector} at u ${u} v ${v}`);
    }
    // the flat's radii are the arcs' edges with the street half widths off (the Esplanade is 104 ft wide, every other street 72)
    near(b.r0, ARC_R[ring] + (ring === 0 ? 52 : 36), 1e-9); near(b.r1, ARC_R[ring + 1] - 36, 1e-9);
  });
  // the first block is the Esplanade-to-A block at 2:00-2:30, i.e. up and to the right of the Man's east: x > 0, y < 0 (north is -y)
  const b0 = blocks[0], mid = at((b0.a0i + b0.a1i) / 2, (b0.r0 + b0.r1) / 2);
  assert.ok(mid.x > 0 && mid.y < 0 && mid.y > -mid.x, "2:15 is east-north-east of the Man");
});

test("every arc street flat lies on its own street, named by brc.ts, and only inside the city's span", () => {
  const arcs = groundFlats().filter((f) => f.kind === "arc");
  arcs.forEach((f, i) => {
    near(f.r0, ARC_R[i] - (i === 0 ? 52 : 36), 1e-9); near(f.r1, ARC_R[i] + (i === 0 ? 52 : 36), 1e-9);
    for (const t of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      const sf = surfaceAt(at(lerp(f.a0, f.a1, t), ARC_R[i]));
      if (sf.kind === "plaza") continue;   // the Esplanade and A run through Center Camp's plaza at 6:00
      assert.equal(sf.kind === "road" ? sf.arc : null, ARCS[i], `street ${ARCS[i]} at ${t}`);
    }
    // the street runs from 2:00 to 10:00 (with a half road of overhang), not round the whole circle
    near((f.a0 + f.a1) / 2, (clockToAngle(CITY_FROM) + clockToAngle(CITY_TO)) / 2 - Math.PI / 2, 1e-9);
  });
});

test("every radial flat lies on its own radial street, centred and the width the sim gives it", () => {
  const radials = groundFlats().filter((f) => f.kind === "radial");
  radials.forEach((f, i) => {
    const m = RADIALS[i];
    near(f.from.x, polar(m, ARC_R[0]).x, 1e-9); near(f.from.y, polar(m, ARC_R[0]).y, 1e-9);
    near(f.width, [180, 270, 360, 450, 540].includes(m) ? 104 : 72, 1e-9);
    for (const t of [0.1, 0.5, 0.9]) for (const side of [-0.4, 0, 0.4]) {
      const cx = lerp(f.from.x, f.to.x, t), cy = lerp(f.from.y, f.to.y, t), len = Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y);
      const p = { x: cx + (-(f.to.y - f.from.y) / len) * f.width * side, y: cy + ((f.to.x - f.from.x) / len) * f.width * side }, sf = surfaceAt(p);
      if (sf.kind === "plaza") continue;
      assert.ok(sf.kind === "road" && sf.radial === m, `radial ${m} at ${t}/${side}: ${JSON.stringify(sf)}`);
    }
  });
});

test("the plazas, rings, runways and Gate Road are where brc.ts has them, at the sizes the top-down map draws", () => {
  const flats = groundFlats(), discs = flats.filter((f) => f.kind === "disc"), ring = flats.find((f) => f.kind === "ring"), strips = flats.filter((f) => f.kind === "strip");
  const disc = (cx, cy) => discs.find((d) => Math.hypot(d.cx - cx, d.cy - cy) < 1e-9);
  assert.equal(disc(CENTER_CAMP.x, CENTER_CAMP.y).r, CENTER_CAMP_R);
  assert.equal(disc(0, 0).r, MAN_R * 5);
  assert.equal(disc(TEMPLE.x, TEMPLE.y).r, TEMPLE_R * 3.4);
  assert.deepEqual([ring.cx, ring.cy, ring.r0, ring.r], [CENTER_CAMP.x, CENTER_CAMP.y, CENTER_CAMP_R - 30, CENTER_CAMP_R + 30]);
  // the sim's own plaza is the same disc
  assert.equal(surfaceAt({ x: CENTER_CAMP.x + CENTER_CAMP_R * 0.99, y: CENTER_CAMP.y }).kind, "plaza");
  assert.notEqual(surfaceAt({ x: CENTER_CAMP.x + CENTER_CAMP_R * 1.01 + 40, y: CENTER_CAMP.y }).kind, "plaza");
  // Gate Road: the strip from the city's last street to 1.7 fence radii, along the 4:30... 9:00 radial the Gate stands on
  const road = strips.find((f) => Math.hypot(f.from.x - GATE.road.from.x, f.from.y - GATE.road.from.y) < 1e-9);
  assert.deepEqual(road.to, GATE.road.to); assert.equal(road.width, GATE.width);
  // the runways: AIRPORT.runwayLen long, runwayW wide, 2·runwayOff apart, along the airport's heading
  const runways = strips.filter((f) => Math.abs(Math.hypot(f.to.x - f.from.x, f.to.y - f.from.y) - AIRPORT.runwayLen) < 1e-6);
  assert.equal(runways.length, 2);
  for (const r of runways) {
    assert.equal(r.width, AIRPORT.runwayW);
    const dir = Math.atan2(r.to.y - r.from.y, r.to.x - r.from.x) - AIRPORT.ta; near(Math.atan2(Math.sin(dir), Math.cos(dir)), 0, 1e-9);   // along the airport's heading (mod a turn)
  }
  const mid = (r) => ({ x: (r.from.x + r.to.x) / 2, y: (r.from.y + r.to.y) / 2 });
  near(Math.hypot(mid(runways[0]).x - mid(runways[1]).x, mid(runways[0]).y - mid(runways[1]).y), 2 * AIRPORT.runwayOff, 1e-6);
  near((mid(runways[0]).x + mid(runways[1]).x) / 2, AIRPORT.at.x, 1e-6); near((mid(runways[0]).y + mid(runways[1]).y) / 2, AIRPORT.at.y, 1e-6);
  // the apron the hangars stand on: 90 ft wide, from 1,800 ft before the airport's middle to 400 after, 285 ft off the runways' line (drawAirport)
  const apron = strips.find((f) => f.width === 90);
  near(apron.from.x, AIRPORT.local(-1800, -285).x); near(apron.from.y, AIRPORT.local(-1800, -285).y); near(apron.to.x, AIRPORT.local(400, -285).x); near(apron.to.y, AIRPORT.local(400, -285).y);
});

test("the shapes' heights: a pod is 7 ft, a tent 8 ft to its tip, a dome as tall as it is wide, a canopy and a shade on poles", () => {
  const one = (kind, w, l) => campPrisms([{ ring: 2, sector: 5, cx: 0, cy: 0, br: 100, solids: [], structs: [{ kind, x: 10, y: 20, rot: 0, w, l, hue: 1, solid: false }] }]);
  const [pod] = one("pod", 12, 12), [tent] = one("tent", 10, 10), [dome] = one("dome", 30, 30);
  near(pod.y + pod.sy * 0.5, 7); near(pod.y, 0);                 // a hemisphere of diameter 1 is 0.5 tall: scaled by sy = 14 it is 7 ft, its base on the ground
  near(tent.y + tent.sy / 2, H.tent); near(tent.y - tent.sy / 2, 0); assert.equal(H.tent, 8);   // a cone is centred on its middle: base at 0, tip at 8
  near(dome.y + dome.sy * 0.5, 15); near(dome.sx, 30); near(dome.sz, 30);   // a dome 30 ft across rises 15 ft
  const shade = one("shade", 20, 10), roof = shade.find((p) => p.kind === "shade-roof"), poles = shade.filter((p) => p.kind === "pole");
  near(roof.y, H.shade); assert.ok(poles.every((p) => Math.abs(p.y + p.sy / 2 - H.shade) < 1e-9 && Math.abs(p.y - p.sy / 2) < 1e-9), "poles stand on the ground and reach the roof");
  const canopy = one("canopy", 20, 10), croof = canopy.find((p) => p.kind === "canopy");
  near(croof.y, H.canopy); assert.equal(canopy.filter((p) => p.kind === "pole").length, 6);
  const [rv, rvRoof] = one("rv", 28, 10); near(rv.y + rv.sy / 2, H.rv); near(rvRoof.y - rvRoof.sy / 2, H.rv);
  // the structs of the whole city are where the sim has them: every prism sits within its block's circle (plus its own size)
  const circles = sectorBlocks(plans);
  for (const p of campPrisms(plans)) { const c = circles[p.sector].find((b) => b.ring === p.ring); assert.ok(Math.hypot(p.x - c.cx, p.z - c.cy) < c.br + 30, `${p.kind} in its block's circle`); }
});

test("the part of the fence inside the airport's wedge is what fenceGap says, and with the fence's pieces it is the whole pentagon", () => {
  const gap = fenceGap(), kept = fenceSegments(), len = ({ a, b }) => Math.hypot(b.x - a.x, b.y - a.y);
  assert.ok(gap.length >= 1);
  for (const { a, b } of gap) for (let k = 0; k <= 10; k++) {
    const p = { x: a.x + ((b.x - a.x) * k) / 10, y: a.y + ((b.y - a.y) * k) / 10 }, m = toPolar(p).min;
    assert.ok(Math.abs(fenceDepth(p).depth) < 1e-6, "on the fence line"); assert.ok(m >= AIRPORT.gap.from - 1e-6 && m <= AIRPORT.gap.to + 1e-6, `${m} in the wedge`);
  }
  const perimeter = FENCE.reduce((t, c, i) => t + Math.hypot(FENCE[(i + 1) % 5].x - c.x, FENCE[(i + 1) % 5].y - c.y), 0);
  near([...gap, ...kept].reduce((t, s) => t + len(s), 0), perimeter, 1e-6);
});

test("the crowds: 34 at Agave within 21 ft of the dome's rim on the bay's side, the generator PlayaWin's drawCrowd uses, about 2,960 in all", () => {
  const agave = SPOTS.find((s) => s.key === "agave"), crowd = crowdSpots(agave), dir = Math.atan2(agave.mid.y - agave.stage.y, agave.mid.x - agave.stage.x);
  assert.equal(crowd.length, 34);
  for (const p of crowd) {
    const d = Math.hypot(p.x - AGAVE.dome.x, p.y - AGAVE.dome.y);
    assert.ok(d >= AGAVE.dome.r + 5 - 1e-9 && d <= AGAVE.dome.r + 21 + 1e-9, `${d} from the dome's centre`);
    assert.ok(Math.abs(Math.atan2(Math.sin(p.a - dir), Math.cos(p.a - dir))) <= 1.6 + 1e-9, "within 1.6 rad of the bay's direction");
    assert.ok(p.hue >= 0 && p.hue < 360 && p.rate >= 5 && p.rate < 8);
  }
  assert.ok(crowd.filter((p) => p.dancing).length > 15, "most are dancing");
  // the generator, written out again: h = (h * 31 + char) >>> 0 over the key, then h = (h * 1664525 + 1013904223) >>> 0, draws a, d, hue, phase, rate, dancing
  let h = 0; for (const ch of "agave") h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = () => { h = (h * 1664525 + 1013904223) >>> 0; return h / 4294967296; };
  const a = dir + (rnd() - 0.5) * 3.2, d = AGAVE.dome.r + 5 + rnd() * 16, hue = Math.floor(rnd() * 360);
  near(crowd[0].a, a, 1e-12); near(crowd[0].x, AGAVE.dome.x + Math.cos(a) * d, 1e-9); assert.equal(crowd[0].hue, hue);
  const total = SPOTS.reduce((n, s) => n + crowdSpots(s).length, 0);
  assert.ok(total > 2900 && total < 3000, `${total} people in all`);
  assert.equal(crowdSpots(SPOTS.find((s) => s.camp?.piece)).length, 8);
  assert.deepEqual(crowdSpots(agave), crowdSpots(agave), "the same people every time");
});

test("the patch over the baked fence line reaches past half the map's stroke and is the map's own playa colour", () => {
  const map = readFileSync(new URL("../game/citymap.ts", import.meta.url), "utf8");
  const stroke = /strokeStyle = P\.fence; x\.lineWidth = (\d+); x\.setLineDash\(\[(\d+), (\d+)\]\)/.exec(map);
  assert.ok(stroke, "found the dashed fence stroke in citymap.ts");
  assert.ok(FENCE_PATCH >= +stroke[1] / 2 + 4, `a ${FENCE_PATCH} ft patch covers the inside half of a ${stroke[1]} ft stroke with a margin`);
  const playa = /playa: "#([0-9a-f]{6})"/.exec(map);
  assert.equal(MAP_PLAYA, parseInt(playa[1], 16));
});

test("things fade in over the last fifth of their range: whole inside 80%, nothing at the range, a straight ramp between", () => {
  assert.equal(fadeAt(0, 900), 1); assert.equal(fadeAt(720, 900), 1); assert.equal(fadeAt(900, 900), 0); assert.equal(fadeAt(2000, 900), 0);
  near(fadeAt(810, 900), 0.5, 1e-12); near(fadeAt(630, 600) , 0, 1e-12); near(fadeAt(570, 600), 0.25, 1e-12);
  for (let d = 0; d < 1000; d += 7) assert.ok(fadeAt(d, 900) >= fadeAt(d + 7, 900), "never grows with distance");
});
