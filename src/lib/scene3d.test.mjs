// node --experimental-strip-types --test src/lib/scene3d.test.mjs
// The chase view's scene description (scene3d.ts): ground flats, camp prisms, culling circles, colours, fence, airport, Gate, skyline.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AIRPORT, ARC_R, FENCE, GATE, RADIALS, fenceDepth } from "./brc.ts";
import { cityPlan } from "./playa.ts";
import { H, airportLayout, bikeColor, campPrisms, fencePosts, gateLayout, groundFlats, hslHex, prismColor, sectorBlocks, skyline } from "./scene3d.ts";

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const plans = cityPlan();

test("the ground has 13 arc streets, 17 radials and 192 blocks, each well formed", () => {
  const flats = groundFlats();
  const arcs = flats.filter((f) => f.kind === "arc"), radials = flats.filter((f) => f.kind === "radial"), blocks = flats.filter((f) => f.kind === "block");
  assert.equal(arcs.length, ARC_R.length); assert.equal(arcs.length, 13);
  assert.equal(radials.length, RADIALS.length); assert.equal(radials.length, 17);
  assert.equal(blocks.length, 192);
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
  // plazas for Center Camp, the Man and the Temple; two runways and an apron and Gate Road
  assert.equal(flats.filter((f) => f.kind === "disc").length, 3);
  assert.equal(flats.filter((f) => f.kind === "strip").length, 4);
});

test("campPrisms: about 66,000 pieces for the 40,081 structures, all with a size and a sector", () => {
  const prisms = campPrisms(plans);
  const structs = plans.reduce((n, p) => n + p.structs.length, 0);
  assert.equal(structs, 40081);
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
  assert.equal(rows.length, withN); assert.ok(withN > 6000);
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

test("sectorBlocks: 16 wedges of 12 block circles each", () => {
  const sb = sectorBlocks(plans);
  assert.equal(sb.length, 16);
  for (const w of sb) { assert.equal(w.length, 12); for (const b of w) assert.ok(b.br > 100 && Number.isFinite(b.cx) && Number.isFinite(b.cy)); }
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

test("the fence posts sit on the pentagon, about 300 ft apart", () => {
  const posts = fencePosts();
  assert.ok(posts.length > 200 && posts.length < 260, `${posts.length} posts`);
  for (const p of posts) assert.ok(Math.abs(fenceDepth(p).depth) < 1e-6, "on the fence line");
  // each corner has a post, and the spacing is between 250 and 350 ft
  for (const c of FENCE) assert.ok(posts.some((p) => Math.hypot(p.x - c.x, p.y - c.y) < 1e-6));
  for (let i = 1; i < posts.length; i++) { const d = Math.hypot(posts[i].x - posts[i - 1].x, posts[i].y - posts[i - 1].y); if (d < 600) assert.ok(d > 250 && d < 350, `${d}`); }
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
