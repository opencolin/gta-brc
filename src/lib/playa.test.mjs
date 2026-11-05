// node --experimental-strip-types --test lib/games/playa.test.mjs
// The playa game's rules (playa.ts): the art car's physics, collisions, the pager's jobs, the weather and the light.
import { test } from "node:test";
import assert from "node:assert/strict";
import { packVee,
  CAR, NO_INPUT, AGAVE, AGAVE_ADDRESS, JOBS, STOP_R, ART, OBSTACLES, startKey, mutantOf, SKYDIVE_JOB, SKYDIVE_ALT, startSkydive, POLO_JOB, atGate, dustAngel, ringBell, ANGEL_T, VEHICLES, VEHICLE_IDS, SPOTS, MUTANTS, CAMP_SPEED, FOLLOW_R,
  MVS, ART_2026_SPOTS, newCar, carStep, BLOCK_EDGE, blockCore, carSpeeds, speedOf, collide, solidAt, bounce, agaveSpot, place, placeKeys, npcAt, makeNpcs, NPC_R, FOLLOW_GAP, seeded, inBay, cityPlan, EXODUS, EXODUS_GAP, EXODUS_LANE,
  newMission, stepMission, skipMission, missionTarget, pagerLine, timeFor, nextJob, stormLevel, stepStorm, nightLevel, sunGlow, flipDay, warpDay, WARP_SECONDS, DAY_SECONDS,
  newGame, stepGame, moopSpot, mph, MPH, setVehicle, vehicleOf, KERB, KERB_BAND, PACK_SEP, packSlot, nextVehicle, hopOn, hopOff, setDriven, leaveDriven, parkedCarAt, takePlane, bailOut, atAirport, TAKEOFF, STALL, CHUTE_SINK, FIRST_STORM, DODGE, FALL, fallOf, fallsOver, ART_MEET, newParking, stepParking, parkingAt, PARK_SPEED,
} from "./playa.ts";
import { fwd, right } from "./view3d.ts";
import { AIRPORT, ARC_R, GATE, ROAD_W, WIDE_ROAD_W, ESPLANADE_W, CITY_SCALE, FENCE_R, arcWidth, polar, pointAt, surfaceAt, addressOf, blockPush, blockBounds, toPolar, clockToAngle } from "./brc.ts";
import { planAt, realCamps, structPush } from "./camps.ts";

const DT = 1 / 60;
const run = (car, input, secs, grip = 8) => { for (let i = 0; i < secs * 60; i++) car = carStep(car, input, DT, grip); return car; };
const finite = (c) => [c.x, c.y, c.h, c.vx, c.vy, c.steer].every(Number.isFinite);

test("physics: the gas accelerates to a capped top speed, never NaN", () => {
  const c = run(newCar({ x: 0, y: 0 }), { ...NO_INPUT, gas: true }, 20);
  assert.ok(finite(c));
  assert.ok(speedOf(c) <= CAR.maxSpeed + 1e-9, `capped (${speedOf(c)})`);
  assert.ok(speedOf(c) > CAR.maxSpeed * 0.6, `gets going (${speedOf(c)})`);
  assert.ok(c.y < -1000, "heading 0 drives toward 12:00 (up)");
  assert.ok(mph(speedOf(c)) >= 18 && mph(speedOf(c)) <= 22, `a cruiser tops out about 21 mph on the HUD (${mph(speedOf(c)).toFixed(1)})`);
  assert.ok(Math.abs(VEHICLES.ebike.maxSpeed * MPH - 50) < 1, "an e-bike about 50");
  assert.ok(Math.abs(VEHICLES.artcar.maxSpeed * MPH - 50) < 1, "the Golden Ticket about 50 too (asked 2026-10-26: faster)");
});

test("physics: brakes stop, then reverse is slow and capped", () => {
  let c = run(newCar({ x: 0, y: 0 }), { ...NO_INPUT, gas: true }, 4);
  c = run(c, { ...NO_INPUT, brake: true }, 1.5);
  c = run(c, { ...NO_INPUT, brake: true }, 10);
  const { forward } = carSpeeds(c);
  assert.ok(forward < 0, "reversing");
  assert.ok(-forward <= CAR.maxReverse + 1e-9, `reverse capped (${forward})`);
  // coasting comes to rest
  c = run(c, NO_INPUT, 20);
  assert.ok(speedOf(c) < 1, `rolls to a stop (${speedOf(c)})`);
});

test("physics: no steering standing still; turning needs speed; bad dt is ignored", () => {
  const still = run(newCar({ x: 0, y: 0 }), { ...NO_INPUT, left: true }, 2);
  assert.ok(Math.abs(still.h) < 1e-9, "no pirouettes on the spot");
  const moving = run(run(newCar({ x: 0, y: 0 }), { ...NO_INPUT, gas: true }, 2), { ...NO_INPUT, gas: true, right: true }, 0.5);
  assert.ok(moving.h > 0.2, `turns right (clockwise) when moving (${moving.h})`);
  const c = newCar({ x: 5, y: 5 });
  for (const dt of [NaN, -1, 0, Infinity]) assert.deepEqual(carStep(c, { ...NO_INPUT, gas: true }, dt), c);
  // a huge dt is clamped, not exploded
  assert.ok(finite(carStep(c, { ...NO_INPUT, gas: true, left: true }, 1e9)));
});

test("physics: the handbrake and loose dust drift; packed streets grip", () => {
  const fast = run(newCar({ x: 0, y: 0 }), { ...NO_INPUT, gas: true }, 3);
  const turn = { ...NO_INPUT, right: true };
  const slide = (c) => Math.abs(carSpeeds(c).side);
  const grip = run(fast, turn, 0.4, 8), dust = run(fast, turn, 0.4, 4.2), hb = run(fast, { ...turn, handbrake: true }, 0.4, 8);
  assert.ok(slide(dust) > slide(grip), `dust slides more (${slide(dust)} > ${slide(grip)})`);
  assert.ok(slide(hb) > slide(grip), `the handbrake slides more (${slide(hb)} > ${slide(grip)})`);
});

test("collisions: a block bounces the car back onto the street, slower", () => {
  // on E, aimed straight out from the Man into the block between E and F at 7:15, at speed
  const at = polar(435, ARC_R[5]);
  const a = (435 / 720) * Math.PI * 2;
  const v = VEHICLES.artcar;
  let c = { ...newCar(at, a), vx: Math.sin(a) * 200, vy: -Math.cos(a) * 200 };
  // the first impact is the one that counts: a long car can go on to reach the block across the street
  let hit = 0, after = null;
  for (let i = 0; i < 30; i++) {
    c = carStep(c, NO_INPUT, DT, 8, v);
    const h = collide(c, v);
    hit = Math.max(hit, h);
    if (h && !after) after = { ...c };
    for (const p of [c, { x: c.x, y: c.y }]) assert.equal(blockCore(p), null, "never left inside a block (its edge and corners are drivable)");
  }
  assert.ok(hit > 100, `hard impact (${hit})`);
  assert.ok(finite(c) && after);
  const out = after.vx * Math.sin(a) + after.vy * -Math.cos(a);
  assert.ok(out < 0, "bounced back toward the Man");
  assert.ok(speedOf(after) < 200 * 0.5, "and lost speed");
});

test("collisions: the Man, the art and the fence are solid; open playa is not", () => {
  assert.ok(solidAt({ x: 0, y: 10 }), "the Man");
  for (const o of ART) assert.ok(solidAt(o), o.name);
  assert.ok(solidAt(AGAVE.moon), "the Moon dome beside the Earth dome (asked 2026-10-23)");
  assert.ok(Math.hypot(AGAVE.moon.x - AGAVE.dome.x, AGAVE.moon.y - AGAVE.dome.y) > AGAVE.dome.r + AGAVE.moon.r, "the two domes stand apart");
  assert.ok(solidAt({ x: 0, y: 14000 }), "past the fence");
  assert.equal(solidAt(polar(300, 1500)), null);
  assert.equal(solidAt(pointAt("7:30", "E")), null);
  // the bounce reflects only what goes into the wall
  const c = { ...newCar({ x: 0, y: 0 }), vx: 10, vy: -50 };
  const hit = bounce(c, { depth: 1, nx: 0, ny: 1 });
  assert.equal(hit, 50);
  assert.ok(c.vy > 0 && Math.abs(c.vx) < 10 + 1e-9);
  for (const o of OBSTACLES.filter((o) => !SPOTS.some((s) => s.stage === o) && o !== AGAVE.moon)) assert.equal(surfaceAt(o).kind === "block", false, `${o.name} sits outside the camps`);
});

test("Agave Lounge: on the Esplanade at 8:30, its dome on the playa-facing frontage and its curb drivable", () => {
  assert.equal(AGAVE_ADDRESS, "8:30 & Esplanade");
  assert.equal(addressOf(AGAVE.curb), "8:30 & Esplanade");
  assert.equal(surfaceAt(AGAVE.curb).kind, "road");
  assert.equal(surfaceAt(AGAVE.dome).kind, "block", "the dome is in the camps");
  const r = Math.hypot(AGAVE.dome.x, AGAVE.dome.y);
  assert.ok(r > ARC_R[0] && r < ARC_R[1], "between the Esplanade and A");
  assert.ok(solidAt(AGAVE.dome) && solidAt(AGAVE.dome, true), "the dome is solid to every ride");
  assert.match(place("agave").label, /Agave Lounge \(8:30 & Esplanade\)/);
  // the address constant is configurable, either way round
  assert.equal(addressOf(agaveSpot("7:30 & E").curb), "7:30 & E");
  assert.equal(addressOf(agaveSpot("Esplanade & 8:30").curb), "8:30 & Esplanade");
});

test("every job's pickup and drop are reachable: on a street or open ground, not inside anything", () => {
  for (const j of JOBS) for (const k of placeKeys(j)) for (const t of [0, 33, 400]) {
    const p = place(k, t).at;
    assert.equal(solidAt(p), null, `${k} is drivable (t ${t})`);
  }
  assert.ok(JOBS.some((j) => j.to === "agave"), "some jobs end at Agave Lounge");
});

test("missions: brief → pickup → dropoff → done, with gifts; or failed when the clock runs out", () => {
  const m = newMission();
  const job = JOBS[0];
  const far = { x: 0, y: 0, speed: 0 };
  assert.equal(stepMission(m, far, 1), null);
  let e = null;
  for (let i = 0; i < 5 && !e; i++) e = stepMission(m, far, 1);
  assert.equal(e, "start");
  assert.equal(m.phase, "pickup");
  assert.equal(m.timeLeft, timeFor(far, job));
  assert.equal(missionTarget(m).label, place(job.from).label);
  // driving past fast does not pick them up
  const from = place(job.from).at;
  assert.equal(stepMission(m, { ...from, speed: 200 }, 0.1), null);
  assert.equal(stepMission(m, { ...from, speed: 10 }, 0.1), "picked");
  assert.equal(m.phase, "dropoff");
  assert.match(pagerLine(m), /Agave Lounge/);
  const to = place(job.to).at;
  assert.equal(stepMission(m, { x: to.x + STOP_R - 5, y: to.y, speed: 0 }, 0.1), "delivered");
  assert.equal(m.phase, "done");
  assert.ok(m.gifts >= 1);
  assert.equal(m.delivered, 1);
  for (let i = 0; i < 10; i++) stepMission(m, far, 1);
  assert.notEqual(m.job, 0, "another job");
  assert.equal(m.phase, "pickup");
  // run the clock out
  let failed = false;
  for (let i = 0; i < 1000 && !failed; i++) failed = stepMission(m, far, 1) === "failed";
  assert.ok(failed);
  assert.equal(m.failed, 1);
  assert.equal(m.timeLeft, 0);
});

test("NPCs stay on their streets and never go NaN", () => {
  const npcs = makeNpcs(seeded(3));
  assert.ok(npcs.some((n) => n.kind === "bike") && npcs.some((n) => n.kind === "mutant") && !npcs.some((n) => n.kind === "artcar"), "every art car has music");
  for (const n of npcs) for (const t of [0, 7.3, 100, 1234.5]) {
    const p = npcAt(n, t);
    assert.ok([p.x, p.y, p.h].every(Number.isFinite));
    if (n.lead) {
      // a biker riding with an art car: close behind it, a little to one side
      const q = npcAt(n.lead, t - n.lag);
      // (or, where a slow car is still on that spot, just outside the car itself)
      const now = npcAt(n.lead, t), clear = NPC_R[n.lead.kind] + NPC_R[n.kind] + FOLLOW_GAP;
      assert.ok(Math.hypot(p.x - q.x, p.y - q.y) <= Math.abs(n.side) + 1e-6 || Math.abs(Math.hypot(p.x - now.x, p.y - now.y) - clear) < 1e-6, "rides beside the car's track");
      continue;
    }
    if (n.path === "line") continue; // the Exodus queue: its own test
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - n.r) < 1e-6, "on its circle");
    if (n.path === "arc") assert.notEqual(solidAt(p)?.depth > 5, true, "a bike on an arc rides the street");
  }
});

test("tuk-tuks, unicycles and fat-tyre e-bikes ride the streets too, without changing what the seed gives everyone else", () => {
  const npcs = makeNpcs(seeded(3)), count = (k) => npcs.filter((n) => n.kind === k && !n.lead).length;
  assert.ok(count("tuktuk") >= 20 && count("unicycle") >= 20 && count("ebike") >= 70);
  for (const n of npcs.filter((n) => n.kind === "unicycle")) assert.ok(Math.abs(n.speed) < Math.min(...npcs.filter((b) => b.kind === "ebike").map((b) => Math.abs(b.speed))), "a unicycle is slower than any e-bike");
  // the new rides come after everyone else and from a generator of their own: the rest of the list is as it was
  const first = npcs.findIndex((n) => n.kind === "tuktuk");
  assert.ok(npcs.slice(first).every((n) => n.kind === "tuktuk" || n.kind === "unicycle" || n.kind === "ebike" || n.kind === "rv" || n.kind === "mv"));
  assert.deepEqual(makeNpcs(seeded(3)).slice(0, first).map((n) => n.hue), npcs.slice(0, first).map((n) => n.hue));
});

test("2026's other art cars roam the open playa by name, and its other art stands at its real places, none already the game's", () => {
  assert.ok(MVS.length >= 400 && new Set(MVS.map((m) => m.key)).size === MVS.length, "a car each, once");
  const famous = new Set(MUTANTS.map((m) => m.name.toLowerCase()));
  for (const m of MVS) {
    assert.ok(m.name && m.form && !famous.has(m.name.toLowerCase()), m.name);
    for (const t of [0, 300, 4000]) { const p = npcAt(m, t), r = Math.hypot(p.x, p.y); assert.ok(Number.isFinite(r) && (r < ARC_R[0] - 200 || r > ARC_R[0] + 300) && r < FENCE_R, `${m.name} keeps to the open playa`); }
  }
  assert.ok(ART_2026_SPOTS.length >= 250);
  for (const a of ART_2026_SPOTS) assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y) && !ART.some((b) => Math.hypot(a.x - b.x, a.y - b.y) < 40), a.name);
});

test("Exodus: RVs nose to tail in two lanes out Gate Road, between the Gate's booths, never on top of each other", () => {
  assert.ok(EXODUS.length >= 200, "a long line");
  const ax = { x: GATE.road.to.x - GATE.road.from.x, y: GATE.road.to.y - GATE.road.from.y }, len = Math.hypot(ax.x, ax.y);
  for (const t of [0, 13.7, 600, 5000]) {
    const ps = EXODUS.map((n) => npcAt(n, t));
    for (const p of ps) {
      const along = ((p.x - GATE.road.from.x) * ax.x + (p.y - GATE.road.from.y) * ax.y) / len, across = (p.x - GATE.road.from.x) * GATE.lat.x + (p.y - GATE.road.from.y) * GATE.lat.y;
      assert.ok(along >= -1e-6 && along <= len + 1e-6, "on Gate Road");
      assert.ok(Math.abs(Math.abs(across) - EXODUS_LANE) < 1e-6, "in a lane");
      assert.ok(Math.abs(across) + 4.5 < GATE.width / 2 && Math.abs(across) - 4.5 > 14 && Math.abs(across) + 4.5 < 50 - 14, "inside the road and clear of the booths");
      assert.ok(Math.abs(Math.sin(p.h - Math.atan2(ax.x, -ax.y))) < 1e-9 && Math.cos(p.h - Math.atan2(ax.x, -ax.y)) > 0, "heading out");
    }
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) assert.ok(Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) >= Math.min(EXODUS_GAP, 2 * EXODUS_LANE) - 1e-6 || Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) > len - EXODUS_GAP, "nose to tail, not on top of each other");
  }
  assert.ok(EXODUS.every((n) => n.speed > 0 && n.speed < 10), "crawling");
});

test("more people: walkers on the street edges, and bikers riding behind the art cars", () => {
  const npcs = makeNpcs(seeded(3));
  assert.ok(npcs.filter((n) => n.kind === "walker").length >= 50);
  assert.ok(npcs.filter((n) => n.kind === "bike").length >= 100);
  const packs = npcs.filter((n) => n.lead);
  assert.ok(packs.length >= 60 && packs.every((n) => n.lead.kind === "mutant" || n.lead.kind === "artcar"));
  for (const w of npcs.filter((n) => n.kind === "walker")) assert.ok(Math.abs(w.speed) < 8, "walkers walk");
  // and plenty of them, by the kerb (asked 2026-10-26): every walker on a street is within the kerb band of its edge
  const street = npcs.filter((n) => n.kind === "walker" && n.path === "arc");
  assert.ok(street.length >= 390, `walkers on the streets (${street.length})`);
  for (const w of street) {
    const ring = ARC_R.findIndex((r, i) => Math.abs(w.r - r) <= arcWidth(i) / 2);
    assert.ok(ring >= 0, "on a street");
    const inFromEdge = arcWidth(ring) / 2 - Math.abs(w.r - ARC_R[ring]);
    assert.ok(inFromEdge >= KERB - 1e-9 && inFromEdge <= KERB + KERB_BAND + 1e-9, `by the kerb (${inFromEdge.toFixed(1)} ft in)`);
  }
});

test("storms rise, hold and blow over; night comes and goes; the toggle flips it", () => {
  const rand = seeded(1);
  const s = { phase: "clear", t: 0, hold: 5 };
  const seen = new Set();
  let peak = 0;
  for (let i = 0; i < 60 * 60; i++) { stepStorm(s, DT, rand); seen.add(s.phase); peak = Math.max(peak, stormLevel(s)); }
  assert.deepEqual([...seen].sort(), ["clear", "falling", "rising", "storm"]);
  for (let k = 0; k < 20; k++) { const h = newGame(k).storm.hold; assert.ok(h >= FIRST_STORM.from && h <= FIRST_STORM.to && h >= 300, "no dust storm in the first five minutes"); }
  assert.equal(peak, 1);
  assert.equal(nightLevel(0), 0);
  assert.equal(nightLevel(DAY_SECONDS * 0.7), 1);
  assert.ok(nightLevel(DAY_SECONDS * 0.45) > 0 && nightLevel(DAY_SECONDS * 0.45) < 1, "dusk");
  // four equal quarters: day, sunset, night, sunrise (asked 2026-11-03)
  const share = (test) => { let k = 0; for (let i = 0; i < 1000; i++) if (test(nightLevel(DAY_SECONDS * (i + 0.5) / 1000))) k++; return k / 1000; };
  assert.equal(share((n) => n === 0), 0.25, "a quarter of the day is day"); assert.equal(share((n) => n === 1), 0.25, "a quarter is night");
  assert.equal(share((n) => n > 0 && n < 1), 0.5, "sunset and sunrise, a quarter each");
  assert.ok(nightLevel(DAY_SECONDS * 0.3) < 0.15 && nightLevel(DAY_SECONDS * 0.95) < 0.15, "the golden hours either side of the sun on the horizon stay light");
  assert.ok(sunGlow(nightLevel(DAY_SECONDS * 0.375)) > 0.8 && sunGlow(nightLevel(DAY_SECONDS * 0.875)) > 0.8, "the sky glows as the sun sets and rises");
  assert.equal(sunGlow(nightLevel(DAY_SECONDS * 0.1)), 0); assert.equal(sunGlow(nightLevel(DAY_SECONDS * 0.6)), 0);
  assert.equal(nightLevel(flipDay(0)), 1);
  assert.equal(nightLevel(flipDay(DAY_SECONDS * 0.7)), 0);
  // the night button runs the clock forward through the sunset over a few seconds, not at once (asked 2026-11-03)
  const g = newGame(7, undefined, "agave"), t0 = g.dayT, dark = [];
  warpDay(g);
  for (let t = 0; t < WARP_SECONDS + 0.5; t += 0.05) { stepGame(g, NO_INPUT, 0.05); dark.push(nightLevel(g.dayT)); }
  assert.ok(dark.filter((n) => n > 0 && n < 1).length > 0.6 * dark.length, "most of it is the sunset");
  assert.ok(dark[0] < 0.1, "it does not jump"); assert.ok(dark.some((n) => n > 0.2 && n < 0.8), "it passes through the sunset");
  assert.equal(nightLevel(g.dayT), 1, "and ends in the night"); assert.equal(g.dayWarp, null); assert.ok(g.dayT > t0);
  for (let i = 1; i < dark.length; i++) assert.ok(dark[i] >= dark[i - 1] - 1e-9, "the dark only deepens on the way to night");
});

test("a whole game steps for minutes without NaN, the car never inside anything, MOOP gets picked up", () => {
  const g = newGame(7);
  const rand = seeded(9);
  let input = { ...NO_INPUT, gas: true };
  const kinds = new Set();
  for (let i = 0; i < 60 * 180; i++) {
    if (i % 90 === 0) input = { gas: rand() < 0.8, brake: rand() < 0.1, left: rand() < 0.3, right: rand() < 0.3, handbrake: rand() < 0.1 };
    for (const e of stepGame(g, input, DT)) kinds.add(e);
    assert.ok(finite(g.car), `finite at step ${i}`);
    const s = solidAt(g.car, VEHICLES[g.vehicle].throughCamps);
    assert.ok(!s || s.depth < 12, `the car's middle is never deep in a wall (step ${i}, ${s?.depth})`);
  }
  assert.ok(g.dust.length <= 160);
  assert.ok(kinds.has("start"));
  assert.ok(kinds.has("bump"), "it hit something driving blind");
  // drop MOOP right under the car and it is collected
  const before = g.moopCount;
  g.moop[0] = { x: g.car.x, y: g.car.y };
  stepGame(g, NO_INPUT, DT);
  assert.equal(g.moopCount, before + 1);
  for (let i = 0; i < 20; i++) assert.equal(solidAt(moopSpot(rand)), null, "MOOP lands where it can be reached");
});

/* ── rides ──────────────────────────────────────────────────────────────── */

test("rides: every vehicle's physics stays finite, caps its speed, and collides", () => {
  assert.ok(VEHICLE_IDS.length >= 3 && VEHICLE_IDS.includes("bike") && VEHICLE_IDS.includes("artcar"));
  for (const id of VEHICLE_IDS) {
    const v = VEHICLES[id];
    for (const grip of [8, 4.2]) {
      let c = newCar({ x: 0, y: 2000 }, 0);
      for (let i = 0; i < 60 * 20; i++) c = carStep(c, { ...NO_INPUT, gas: true, left: i % 120 < 30, handbrake: i % 200 < 10 }, DT, grip, v);
      assert.ok(finite(c), `${id} finite`);
      assert.ok(speedOf(c) <= v.maxSpeed * Math.max(1, v.dust) + 1e-9, `${id} capped (${speedOf(c)})`);
    }
    // straight at the Man: bounced off, never through
    let c = newCar(polar(0, 400), Math.PI);
    for (let i = 0; i < 60 * 6; i++) { c = carStep(c, { ...NO_INPUT, gas: true }, DT, 8, v); collide(c, v); }
    assert.ok(Math.hypot(c.x, c.y) > 40, `${id} does not drive through the Man`);
  }
  // the bike is nimble and slow-ish, the art car heavy and faster on the open playa
  assert.ok(VEHICLES.bike.maxSpeed < VEHICLES.artcar.maxSpeed && VEHICLES.bike.maxYaw > VEHICLES.artcar.maxYaw);
  assert.ok(VEHICLES.artcar.dust > 1 && VEHICLES.bike.dust < 1);
  assert.notEqual(nextVehicle("bike"), "bike");
  // the RV (asked 2026-10-27): a 30 mph coach that is the slowest of all the rides to turn, to pull away and to stop, keeps to the streets and does not bounce
  const rv = VEHICLES.rv;
  assert.ok(Math.abs(rv.maxSpeed * MPH - 30) < 1, "an RV about 30");
  assert.ok(VEHICLE_IDS.filter((id) => id !== "rv").every((id) => VEHICLES[id].maxYaw > rv.maxYaw), "the RV is the slowest to turn");
  assert.ok(VEHICLE_IDS.filter((id) => id !== "rv" && id !== "plane").every((id) => VEHICLES[id].accel > rv.accel && VEHICLES[id].brake > rv.brake), "and to pull away and to stop (the plane aside, which is slow to roll)");
  assert.ok(!rv.throughCamps && rv.restitution < 0.2 && rv.dust < 1 && rv.len <= 36, "it keeps to the streets, barely bounces, is heavy in the dust and fits the street");
  let cycle = "bike"; const seen = new Set();
  do { seen.add(cycle); cycle = nextVehicle(cycle); } while (cycle !== "bike" && seen.size < 30);
  assert.ok(seen.has("rv") && !seen.has("found") && !seen.has("plane"), "the ride cycle takes in the RV, never the art car or the plane, and comes round");
});

test("streets are at least twice the longest ride, so two pass and one can turn round", () => {
  const longest = Math.max(...VEHICLE_IDS.filter((id) => id !== "plane").map((id) => VEHICLES[id].len)); // the plane lives at the airport, not on the streets
  for (const w of [ROAD_W, WIDE_ROAD_W, ESPLANADE_W]) assert.ok(w >= 2 * longest, `${w} ≥ 2 × ${longest}`);
});

test("bikes and the unicycle ride through camp blocks; cars bounce off them; nobody passes the fence or the Man", () => {
  const plan = cityPlan();
  const free = (p) => !solidAt(p, true);
  // an alley straight out from E into the block between E and F, nothing standing in it
  let target = null;
  for (let m = 440; m < 470 && !target; m += 0.25) {
    if ([30, 60, 90, 120, 150].every((d) => free(polar(m, ARC_R[5] + d))) && surfaceAt(polar(m, ARC_R[5] + 90)).kind === "block") target = m;
  }
  assert.ok(target, "an alley to ride into");
  const a = (target / 720) * Math.PI * 2;
  for (const id of ["bike", "unicycle", "artcar", "fish"]) {
    const v = VEHICLES[id];
    let c = newCar(polar(target, ARC_R[5]), a);
    let inBlock = false;
    for (let i = 0; i < 60 * 3; i++) {
      c = carStep(c, { ...NO_INPUT, gas: i < 40 }, DT, 8, v);
      collide(c, v);
      const b = blockPush(c);
      if (b && b.depth > (v.throughCamps ? 8 : BLOCK_EDGE + 8)) inBlock = true;   // a car may ride up onto the block's edge, not into it
    }
    assert.equal(inBlock, v.throughCamps, `${id} ${v.throughCamps ? "gets into" : "stays out of"} the block`);
  }
  // a car rides onto a block's edge and round its corners (asked 2026-11-03), not into its middle
  const bb = blockBounds(4, 7), inward = (m, r) => polar(m, r);
  const step = (ft, r) => (ft / r) * (720 / (Math.PI * 2));
  assert.equal(blockCore(inward(bb.m0 + step(bb.w0 + 20, bb.r0 + 20), bb.r0 + 20)), null, "20 ft into a corner is drivable");
  assert.equal(blockCore(inward((bb.m0 + bb.m1) / 2, bb.r0 + BLOCK_EDGE - 2)), null, "the edge is drivable");
  assert.ok(blockCore(inward((bb.m0 + bb.m1) / 2, (bb.r0 + bb.r1) / 2)), "the middle is not");
  assert.ok(solidAt(inward((bb.m0 + bb.m1) / 2, bb.r0 + 10)), "but the camera still counts the whole block");
  assert.ok(solidAt({ x: 0, y: 14000 }, true), "the fence stops a bike");
  assert.ok(solidAt({ x: 0, y: 10 }, true), "so does the Man");
  // and the bike bounces off what stands in the camps
  const holder = plan.find((b) => b.solids.length);
  const thing = holder.solids[0];
  assert.ok(solidAt(thing, true), `a camp's ${thing.kind} is solid`);
  assert.equal(planAt(plan, thing), holder);
  assert.ok(structPush(thing, thing));
});

test("the 2026 city's real camps hold the lots, their names on the signs, and the pager runs people to their events", () => {
  const signs = cityPlan().flatMap((b) => b.structs.filter((s) => s.kind === "sign" && s.uid));
  assert.ok(signs.length > 950, `${signs.length} real camps signed`);
  assert.equal(new Set(signs.map((s) => s.uid)).size, signs.length, "each camp once");
  const byUid = new Map(realCamps().map((c) => [c.uid, c]));
  for (const s of signs) { assert.equal(s.label, byUid.get(s.uid).name); assert.ok(Math.hypot(s.x - byUid.get(s.uid).at.x, s.y - byUid.get(s.uid).at.y) < 500, `${s.label} near its address`); }
  const rides = JOBS.filter((j) => j.to.startsWith("real:"));
  assert.ok(rides.length >= 12);
  for (const j of rides) { const p = place(j.to); assert.equal(solidAt(p.at), null, `${p.label}: the stop is on open ground`); assert.match(j.line, /^(a burner|two burners) at .* to make ".*" at .*, (Mon|Tue|Wed|Thu|Fri|Sat|Sun) /); }
});

test("the camps: several per block, varied, solid things clear of the streets", () => {
  const plan = cityPlan();
  const kinds = new Set(plan.flatMap((b) => b.structs.map((s) => s.kind)));
  for (const k of ["rv", "pod", "dome", "stage", "speaker", "canopy", "couch", "carpet", "rack", "flag", "arch", "potty", "sign"]) assert.ok(kinds.has(k), k);
  assert.ok(plan.every((b) => b.structs.filter((s) => s.kind === "arch").length >= 1), "every block has a camp with a way in");
  assert.ok(plan.filter((b) => b.structs.filter((s) => s.kind === "arch").length >= 3).length > plan.length / 2, "most blocks hold several camps");
  for (const b of plan) for (const s of b.solids) assert.equal(surfaceAt(s).kind, "block", `${s.kind} in a block`);
  assert.equal(cityPlan(), plan, "laid out once");
});

test("riding through camps is slow and warns about 5 mph", () => {
  const g = newGame(2);
  let at = null;
  for (let m = 200; m < 230 && !at; m += 0.25) { const p = polar(m, (ARC_R[5] + ARC_R[6]) / 2); if (surfaceAt(p).kind === "block" && !solidAt(p, true)) at = { p, m }; }
  assert.ok(at);
  const a = (at.m / 720) * Math.PI * 2 + Math.PI / 2;
  g.car = { ...newCar(at.p, a), vx: Math.sin(a) * 170, vy: -Math.cos(a) * 170 };
  const ev = stepGame(g, { ...NO_INPUT, gas: true }, DT);
  assert.ok(speedOf(g.car) <= VEHICLES.bike.maxSpeed * CAMP_SPEED + 1e-6, `capped in camp (${speedOf(g.car)})`);
  assert.ok(ev.includes("slow") && /5 mph/.test(g.warnText));
});

/* ── sound camps: spots, bays, parking ──────────────────────────────────── */

test("every sound camp has a stage at its address and a bay you can drive into; none overlap a street or each other", () => {
  assert.ok(SPOTS.length >= 15);
  assert.equal(SPOTS[0].key, "agave");
  const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  for (const s of SPOTS) {
    const rim = Array.from({ length: 12 }, (_, i) => ({ x: s.stage.x + Math.cos(i * Math.PI / 6) * s.stage.r, y: s.stage.y + Math.sin(i * Math.PI / 6) * s.stage.r }));
    if (s.kind === "fence" || s.kind === "art") {
      for (const p of [s.stage, s.mid]) assert.equal(surfaceAt(p).kind, "playa", `${s.name} is out on the open playa`);
    } else {
      for (const p of [s.stage, ...rim]) assert.equal(surfaceAt(p).kind, "block", `${s.name}'s stage stays in its block, off the streets`);
      assert.equal(surfaceAt(s.mid).kind, "block", `${s.name}'s bay is cut into the block`);
      assert.equal(surfaceAt(s.curb).kind, "road", `${s.name}'s curb is a street`);
      if (s.camp) {
        // on its own street, at its clock or nudged a little along it where camps share a corner
        const [clock, arc] = s.camp.address.split(" & ");
        const [gotClock, gotArc] = addressOf(s.curb).split(" & ");
        assert.equal(gotArc, arc, `${s.name} is on ${arc}`);
        const d = Math.abs(toPolar(s.curb).min - (Number(clock.split(":")[0]) % 12) * 60 - Number(clock.split(":")[1]));
        assert.ok(d <= 16, `${s.name} at ${gotClock}, within a quarter hour of ${clock}`);
      }
    }
    if (s.kind !== "art") {   // an art place's marker hovers overhead: you drive under it (asked 2026-11-03)
      assert.ok(solidAt(s.stage), `${s.name}'s stage is solid`);
      assert.ok(solidAt(s.stage, true), `${s.name}'s stage is solid to a bike too`);
    }
    assert.equal(solidAt(s.mid), null, `${s.name}'s bay is open to a car`);
    assert.ok(inBay(s.mid, s.bay));
  }
  for (let i = 0; i < SPOTS.length; i++) for (let j = i + 1; j < SPOTS.length; j++) {
    const a = SPOTS[i], b = SPOTS[j];
    assert.ok(d(a.stage, b.stage) > a.stage.r + b.stage.r + 20, `${a.name} and ${b.name}: stages apart`);
    assert.ok(d(a.mid, b.mid) > a.bay.half + b.bay.half + 20, `${a.name} and ${b.name}: bays apart`);
  }
  for (const b of cityPlan()) for (const st of b.solids) for (const s of SPOTS) assert.equal(inBay(st, s.bay, 4), false, `a ${st.kind} in ${s.name}'s bay`);
});

test("camps that share a corner slide apart along their street", () => {
  const at = (id) => SPOTS.find((s) => s.key === `camp:${id}`);
  for (const [a, b] of [["camp-questionmark", "root-society"], ["opulent-temple", "white-ocean"], ["the-kazbah", "mystic"]]) {
    const p = at(a), q = at(b);
    assert.ok(p && q, `${a}, ${b}`);
    assert.equal(p.arc, q.arc, "same street");
    assert.ok(Math.hypot(p.mid.x - q.mid.x, p.mid.y - q.mid.y) > p.bay.half + q.bay.half + 20, `${p.name} and ${q.name} apart`);
  }
  assert.equal(SPOTS.length, new Set(SPOTS.map((s) => s.key)).size);
});

test("an art car can pull into Agave's bay off the Esplanade without hitting anything", () => {
  const v = VEHICLES.artcar;
  const a = (AGAVE.curbMin / 720) * Math.PI * 2; // heading straight out from the Man
  let c = newCar(AGAVE.curb, a);
  let entered = false, worst = 0;
  for (let i = 0; i < 60 * 4; i++) {
    c = carStep(c, i < 55 ? { ...NO_INPUT, gas: true } : { ...NO_INPUT, brake: true }, DT, 8, v);
    worst = Math.max(worst, collide(c, v));
    if (inBay(c, AGAVE.bay)) entered = true;
    if (i > 60 && Math.abs(carSpeeds(c).forward) < 2) break;
  }
  assert.ok(entered, "in the bay");
  assert.ok(worst < 40, `no hard knock on the way in (${worst})`);
});

test("parking: stopped in a bay for a second opens it; moving through does not; driving off leaves", () => {
  const s = SPOTS.find((x) => x.key === "camp:distrikt");
  const pk = newParking();
  for (let i = 0; i < 120; i++) assert.equal(stepParking(pk, { ...s.mid, speed: 40 }, DT, 0), null, "rolling through never parks");
  let e = null, n = 0;
  for (; n < 120 && !e; n++) e = stepParking(pk, { ...s.mid, speed: PARK_SPEED * 0.5 }, DT, 0);
  assert.equal(e, "park");
  assert.ok(n >= 59, `waited a second (${n} steps)`);
  assert.equal(pk.at, s.key);
  assert.equal(stepParking(pk, { ...s.mid, speed: 0 }, DT, 0), null, "stays parked");
  assert.equal(stepParking(pk, { ...s.curb, speed: 30 }, DT, 0), "leave");
  assert.equal(pk.at, null);
  // the game starts beside Agave's bay, so the sets do not open on their own
  const g = newGame(5);
  const evs = [];
  for (let i = 0; i < 60 * 3; i++) evs.push(...stepGame(g, NO_INPUT, DT));
  assert.equal(evs.includes("park"), false, "standing at the start never parks");
  // drive in and stop: it parks
  g.car = newCar(AGAVE.mid, 0);
  const ev2 = [];
  for (let i = 0; i < 90; i++) ev2.push(...stepGame(g, NO_INPUT, DT));
  assert.ok(ev2.includes("park"));
  assert.equal(g.parking.at, "agave");
});

test("art cars: the famous ones roam on routes, and stopping beside one parks there", () => {
  assert.ok(MUTANTS.length >= 3);
  for (const k of ["mutant:robot-heart", "mutant:mayan-warrior", "mutant:titanics-end"]) assert.ok(MUTANTS.some((m) => m.key === k), k);
  const npcs = makeNpcs(seeded(1));
  for (const m of MUTANTS) {
    assert.ok(npcs.includes(m));
    for (const t of [0, 50, 300]) assert.equal(solidAt(npcAt(m, t)), null, `${m.name} on open ground`);
  }
  const m = MUTANTS[0], t = 12, p = npcAt(m, t);
  const pk = newParking();
  let e = null;
  for (let i = 0; i < 80 && !e; i++) e = stepParking(pk, { x: p.x + 60, y: p.y, speed: 0 }, DT, t);
  assert.equal(e, "park");
  assert.equal(pk.at, m.key);
  assert.equal(parkingAt({ x: p.x + 2000, y: p.y }, t), null);
});

/* ── the pager, varied ──────────────────────────────────────────────────── */

test("jobs: a dozen or more, rides, sweeps and follows, never the same one twice in a row", () => {
  assert.ok(JOBS.length >= 12);
  for (const k of ["ride", "moop", "follow"]) assert.ok(JOBS.some((j) => j.kind === k), k);
  assert.ok(JOBS.some((j) => placeKeys(j).some((k) => k.startsWith("camp:"))), "the sound camps are in the jobs");
  assert.ok(JOBS.some((j) => placeKeys(j).some((k) => k.startsWith("mutant:"))), "and the art cars");
  const m = newMission(9);
  const seen = new Set();
  for (let i = 0; i < 500; i++) { const prev = m.job; m.job = nextJob(m); assert.notEqual(m.job, prev); assert.ok(m.job >= 0 && m.job < JOBS.length); seen.add(m.job); }
  assert.equal(seen.size, JOBS.length, "every job comes up");
});

test("a MOOP sweep: collect five, then get to the art", () => {
  const m = newMission();
  m.job = JOBS.findIndex((j) => j.kind === "moop");
  const job = JOBS[m.job];
  const far = { x: 0, y: 0, speed: 0 };
  let e = null;
  for (let i = 0; i < 10 && e !== "start"; i++) e = stepMission(m, far, 1, { t: 0, moop: 3 });
  assert.equal(m.phase, "pickup");
  assert.match(pagerLine(m), /0 of 5/);
  assert.equal(stepMission(m, far, 0.1, { t: 1, moop: 6 }), null);
  assert.equal(stepMission(m, far, 0.1, { t: 1, moop: 8 }), "picked");
  assert.equal(m.phase, "dropoff");
  assert.equal(missionTarget(m).label, place(job.to).label);
  assert.equal(stepMission(m, { ...place(job.to).at, speed: 0 }, 0.1, { t: 1, moop: 8 }), "delivered");
});

test("a follow: find the art car, then stay close for 20 s while it moves", () => {
  const m = newMission();
  m.job = JOBS.findIndex((j) => j.kind === "follow");
  const job = JOBS[m.job];
  let t = 0, e = null;
  const far = { x: 0, y: 0, speed: 0 };
  for (let i = 0; i < 10 && e !== "start"; i++) { t += 1; e = stepMission(m, far, 1, { t, moop: 0 }); }
  t += 0.1;
  const p0 = place(job.from, t).at;
  assert.equal(stepMission(m, { ...p0, speed: 20 }, 0.1, { t, moop: 0 }), "picked");
  assert.equal(m.phase, "follow");
  let done = null;
  for (let i = 0; i < 60 * 25 && !done; i++) { t += DT; const p = place(job.from, t).at; done = stepMission(m, { x: p.x + FOLLOW_R * 0.5, y: p.y, speed: 20 }, DT, { t, moop: 0 }); }
  assert.equal(done, "delivered");
  assert.ok(m.progress >= 20);
});

test("switching rides mid-game keeps the game finite and the ride clear of walls", () => {
  const g = newGame(11);
  for (const id of VEHICLE_IDS.filter((v) => v !== "plane")) { // the plane flies over walls by design
    setVehicle(g, id);
    for (let i = 0; i < 60 * 10; i++) {
      stepGame(g, { ...NO_INPUT, gas: true, right: i % 100 < 30 }, DT);
      const s = solidAt(g.car, VEHICLES[id].throughCamps, true);
      assert.ok(!s || s.depth < 12, `${id} not deep in a wall`);
    }
    assert.ok(finite(g.car));
  }
});

test("bikers riding with an art car keep clear of it, and anyone squeezed between two of the others slips free", () => {
  const g = newGame(7);
  for (const n of g.npcs.filter((m) => m.lead)) for (const t of [0, 13, 77, 300]) {
    const a = npcAt(n, t), b = npcAt(n.lead, t);
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= NPC_R[n.lead.kind] + NPC_R[n.kind] + FOLLOW_GAP - 1e-6, "outside the art car");
  }
  // pinned between two of them standing still on the same spot
  const art = g.npcs.find((n) => n.kind === "mutant"), still = { ...art, speed: 0 }, p = npcAt(still, g.t);
  g.npcs = [still, { ...still, kind: "rv", r: still.r }]; // an RV: a bike no longer pins you, it falls over (2026-11-04)
  setVehicle(g, "bike");
  g.car.x = p.x + 3; g.car.y = p.y; g.car.vx = g.car.vy = 0;
  let slipped = false;
  for (let i = 0; i < 60 * 2; i++) { stepGame(g, { ...NO_INPUT, gas: true }, DT); slipped ||= g.slip > 0; assert.ok(finite(g.car)); }
  assert.ok(slipped, "the rider slips through");
});

test("ride along: parked beside an art car you hop on and go where it goes; steering hops you off beside it", () => {
  const g = newGame(7);
  const m = MUTANTS[0];
  g.parking.at = null;
  assert.equal(hopOn(g), false, "not parked at an art car: nothing to ride");
  g.parking.at = m.key;
  assert.equal(hopOn(g), true);
  for (let i = 0; i < 60 * 3; i++) { stepGame(g, NO_INPUT, DT); assert.ok(finite(g.car)); }
  const p = npcAt(m, g.t);
  assert.ok(Math.hypot(g.car.x - p.x, g.car.y - p.y) < 1, "on the art car");
  assert.equal(g.aboard, m.key);
  stepGame(g, { ...NO_INPUT, gas: true }, DT);
  assert.equal(g.aboard, null, "steering hops you off");
  assert.ok(Math.hypot(g.car.x - p.x, g.car.y - p.y) > 40, "beside it, not in it");
});

test("driving a famous art car: it is where you are, and its riders follow your trail", () => {
  const g = newGame(7);
  const m = MUTANTS[0], rider = g.npcs.find((n) => n.lead === m);
  setVehicle(g, "found"); setDriven(m.key);
  for (let i = 0; i < 60 * 6; i++) stepGame(g, { ...NO_INPUT, gas: true }, DT);
  const p = npcAt(m, g.t);
  assert.ok(Math.hypot(p.x - g.car.x, p.y - g.car.y) < 1, "the art car is you");
  const q = npcAt(rider, g.t);
  assert.ok(Math.hypot(q.x - g.car.x, q.y - g.car.y) < 400, "its rider is close behind");
  setDriven(null);
  assert.ok(Math.hypot(npcAt(m, g.t).x - g.car.x, npcAt(m, g.t).y - g.car.y) > 1, "handed back, it goes on its way");
});

test("hopping off the art car you drive leaves it parked where you left it, and you on the bike beside it", () => {
  const g = newGame(7);
  const m = MUTANTS[1];
  setVehicle(g, "found"); setDriven(m.key);
  for (let i = 0; i < 60 * 4; i++) stepGame(g, { ...NO_INPUT, gas: true }, DT);
  const here = { x: g.car.x, y: g.car.y };
  leaveDriven(g);
  assert.equal(g.vehicle, "bike");
  assert.ok(parkedCarAt(m.key), "it is parked");
  const p = npcAt(m, g.t);
  assert.ok(Math.hypot(p.x - here.x, p.y - here.y) < 1, "parked where you stepped out");
  assert.ok(Math.hypot(g.car.x - p.x, g.car.y - p.y) > 40, "you are beside it, not in it");
  for (let i = 0; i < 60; i++) stepGame(g, NO_INPUT, DT);
  const q = npcAt(m, g.t);
  assert.ok(Math.hypot(q.x - here.x, q.y - here.y) < 1, "it stays put");
  setDriven(m.key);
  assert.equal(parkedCarAt(m.key), null, "driving it again takes it off the kerb");
  setDriven(null);
});

test("with the big map open (ghost) nothing stops you: camps, art cars and bikes are driven through", () => {
  const run = (ghost) => {
    const g = newGame(3);
    g.ghost = ghost;
    // start in a block of camps on 3:00, heading out through the camps toward the fence
    const p = polar(195, (ARC_R[2] + ARC_R[3]) / 2);
    g.car = newCar(p, clockToAngle(195));
    for (let i = 0; i < 60 * 8; i++) stepGame(g, { ...NO_INPUT, gas: true }, DT);
    return Math.hypot(g.car.x - p.x, g.car.y - p.y);
  };
  const free = run(true), blocked = run(false);
  assert.ok(free > 600, `a ghost gets well clear: ${free.toFixed(0)} ft`);
  assert.ok(free > blocked, `camps stop a real rider sooner: ${blocked.toFixed(0)} < ${free.toFixed(0)}`);
});

test("a ghost (the big map open, or the trip on) has no bumps, no slow-down warning and loses no gift to a person or a wall", () => {
  const run = (ghost) => {
    const g = newGame(3, "bike");
    g.ghost = ghost; g.mission.gifts = 3;
    // on top of a walker, then into the fence at full speed
    const n = g.npcs.find((x) => x.kind === "walker"), p = npcAt(n, g.t);
    g.car = newCar(p, 0);
    const events = []; let warned = false;
    for (let i = 0; i < 30; i++) { events.push(...stepGame(g, { ...NO_INPUT, gas: true }, DT)); if (g.warn > 0) warned = true; }
    g.car = newCar(polar(120, FENCE_R * 0.98), clockToAngle(120)); g.car.vx = Math.sin(clockToAngle(120)) * 100; g.car.vy = -Math.cos(clockToAngle(120)) * 100;
    for (let i = 0; i < 90; i++) events.push(...stepGame(g, { ...NO_INPUT, gas: true }, DT));
    return { bumps: g.bumps, gifts: g.mission.gifts, warned, bumpEvents: events.filter((e) => e === "bump" || e === "slow").length, out: Math.hypot(g.car.x, g.car.y) };
  };
  const ghost = run(true), real = run(false);
  assert.equal(ghost.bumps, 0); assert.equal(ghost.gifts, 3); assert.equal(ghost.warned, false); assert.equal(ghost.bumpEvents, 0);
  assert.ok(real.warned || real.gifts < 3 || real.bumps > 0, "a real rider is bumped, warned or loses a gift");
  assert.ok(ghost.out > real.out + 40, `the ghost goes through the fence, the real rider is stopped at it: ${ghost.out.toFixed(0)} ft out against ${real.out.toFixed(0)}`);
});

test("the fence is open toward the airport and solid everywhere else past it", () => {
  assert.equal(solidAt(polar(252, FENCE_R * 1.05)), null, "the way to the airport");
  assert.ok(solidAt(polar(120, FENCE_R * 1.05)), "past the fence at 2:00");
  assert.ok(Math.hypot(AIRPORT.pad.x, AIRPORT.pad.y) > FENCE_R, "the pad is outside the fence");
});

test("the plane: taken at the pad, it lifts past takeoff speed, flies through anything, and bailing out leaves you under a chute while it flies off", () => {
  const g = newGame(5);
  assert.equal(takePlane(g), false, "not at the airport");
  g.car = newCar(AIRPORT.pad, 0);
  assert.ok(atAirport(g)); assert.equal(takePlane(g), true); assert.equal(g.vehicle, "plane");
  let took = false;
  for (let i = 0; i < 60 * 12 && !took; i++) took = stepGame(g, { ...NO_INPUT, gas: true }, DT).includes("takeoff");
  assert.ok(took, "it took off"); assert.ok(speedOf(g.car) > TAKEOFF);
  for (let i = 0; i < 60 * 6; i++) stepGame(g, { ...NO_INPUT, gas: true }, DT);
  assert.ok(g.alt > 200, `climbing: ${g.alt.toFixed(0)} ft`);
  // off the gas it holds at least stall speed and sinks slowly; it never bounces off anything up there
  for (let i = 0; i < 60 * 3; i++) stepGame(g, { ...NO_INPUT, brake: true }, DT);
  assert.ok(speedOf(g.car) >= STALL - 1, "never below stall in the air"); assert.ok(g.alt > 0, "still up");
  const alt = g.alt;
  bailOut(g);
  assert.equal(g.chute, true); assert.equal(g.vehicle, "bike"); assert.ok(g.plane, "the plane flies on");
  const planeStart = { x: g.plane.x, y: g.plane.y };
  let landed = false;
  for (let i = 0; i < 60 * 60 && !landed; i++) landed = stepGame(g, { ...NO_INPUT, right: true }, DT).includes("landed");
  assert.ok(landed, "you touched down"); assert.equal(g.chute, false); assert.equal(g.alt, 0); assert.equal(g.vehicle, "bike");
  assert.ok(alt / CHUTE_SINK < 60 * 60 * DT, "a chute from that height lands inside a minute");
  assert.ok(SKYDIVE_ALT / CHUTE_SINK <= 10, "the jump's fall is short: ten seconds at most");
  for (let i = 0; i < 60 * 25; i++) stepGame(g, NO_INPUT, DT); // half a minute on, the plane has flown well off or is gone
  assert.ok(g.plane === null || Math.hypot(g.plane.x - planeStart.x, g.plane.y - planeStart.y) > 2000, "the plane flew off or is gone");
});

test("e-bikes ride the streets faster than the cruisers", () => {
  const g = newGame(2);
  const e = g.npcs.filter((n) => n.kind === "ebike"), b = g.npcs.filter((n) => n.kind === "bike" && !n.lead);
  assert.ok(e.length >= 30, `${e.length} e-bikes`);
  const avg = (l) => l.reduce((a, n) => a + Math.abs(n.speed), 0) / l.length;
  assert.ok(avg(e) > avg(b) * 1.4, `e-bikes ${avg(e).toFixed(0)} vs bikes ${avg(b).toFixed(0)}`);
});

test("a URL path starts you at a place (asked 2026-10-23): dragonlady beside the Dragon Lady, any spelling", () => {
  for (const p of ["dragonlady", "DragonLady", "dragon-lady", "dragon_lady/"]) assert.equal(startKey(p), "mutant:dragon-lady", p);
  assert.equal(startKey("robot-heart"), "mutant:robot-heart");
  assert.equal(startKey("titanic"), "mutant:titanics-end", "the start of a name is enough");
  assert.equal(startKey("goldenticket"), "mutant:golden-ticket", "the camp's own art car is on the playa (2026-10-26)");
  { const g0 = newGame(1); const gt = npcAt(mutantOf("mutant:golden-ticket"), 0); const d = Math.hypot(gt.x - AGAVE.curb.x, gt.y - AGAVE.curb.y); assert.ok(d < 220 && d > 120, `parked at Agave Lounge, out of parking reach of the start (${Math.round(d)})`); assert.equal(solidAt(gt), null, "on the street"); void g0; }
  // Dragomi parked at Celestial Tea Garden, 8:45 & E (asked 2026-11-04): /dragomi at its wheel, /celestialteagarden on E in front of the camp, beside it
  assert.equal(startKey("dragomi"), "mutant:dragomi");
  { const k = startKey("celestialteagarden"); assert.match(k ?? "", /^real:/, "a 2026 camp by its whole name"); const g = newGame(1, "bike", k), dg = npcAt(mutantOf("mutant:dragomi"), 0);
    const d = Math.hypot(dg.x - g.car.x, dg.y - g.car.y); assert.ok(d < 140, `the start is just short of Dragomi (${Math.round(d)} ft)`); assert.equal(solidAt(dg), null, "Dragomi is on the street"); assert.equal(solidAt(g.car), null, "and so are you"); }
  assert.equal(startKey("mayan"), "mutant:mayan-warrior"); assert.equal(startKey("orb"), "art:The Orb");
  assert.equal(startKey("the-orb"), "art:The Orb");
  assert.equal(startKey("agave"), "agave"); assert.equal(startKey("temple"), "temple");
});

test("starting at an art car, it is night; anywhere else, day (asked 2026-10-27)", () => {
  assert.equal(nightLevel(newGame(7, undefined, "mutant:golden-ticket").dayT), 1, "the Golden Ticket's link starts at night");
  assert.equal(nightLevel(newGame(7, undefined, "mutant:dragon-lady").dayT), 1);
  assert.equal(nightLevel(newGame(7, undefined, "man").dayT), 1, "/theman starts at night, for his fire");
  assert.equal(nightLevel(newGame(7, undefined, "agave").dayT), 0, "a camp starts by day");
  assert.equal(nightLevel(newGame(7).dayT), 0, "the airport starts by day");
  assert.equal(startKey("airport"), "airport"); assert.equal(startKey("plane"), "airport"); assert.ok(atAirport(newGame(1, "bike", "airport")), "in reach of the plane on the pad");
  assert.equal(startKey(""), null); assert.equal(startKey("nowhere-at-all"), null);
  const g = newGame(1, "bike", "mutant:dragon-lady"), car = npcAt(mutantOf("mutant:dragon-lady"), 0);
  assert.ok(Math.hypot(g.car.x - car.x, g.car.y - car.y) < 40, "beside the yacht at the start");
  const orb = ART.find((a) => a.id === "the-orb"), g2 = newGame(1, "bike", "art:The Orb");
  assert.ok(Math.hypot(g2.car.x - orb.x, g2.car.y - orb.y) < orb.r + 200, "in front of the Orb");
  assert.deepEqual([newGame(1).car.x, newGame(1).car.y], [newGame(1, "bike", null).car.x, newGame(1, "bike", null).car.y], "no place: Agave Lounge as before");
});

test("the one-thumb stick (asked 2026-10-23): point it and the bike turns and goes there, half a push cruises at half speed, pulled back it reverses", () => {
  const east = { ...NO_INPUT, stick: { a: Math.PI / 2, k: 1 } };
  let c = run(newCar({ x: 0, y: 0 }, 0), east, 5);
  assert.ok(Math.abs(Math.atan2(Math.sin(c.h - Math.PI / 2), Math.cos(c.h - Math.PI / 2))) < 0.1, `heading east: ${c.h}`);
  assert.ok(c.vx > 0 && Math.abs(c.vy) < c.vx * 0.2, "moving east");
  assert.ok(Math.abs(speedOf(c) - CAR.maxSpeed) < CAR.maxSpeed * 0.25, "near top speed with a full push");
  const half = run(newCar({ x: 0, y: 0 }, 0), { ...NO_INPUT, stick: { a: 0, k: 0.5 } }, 8);
  assert.ok(speedOf(half) > CAR.maxSpeed * 0.35 && speedOf(half) < CAR.maxSpeed * 0.62, `half a push cruises at about half speed: ${speedOf(half)}`);
  const back = run(newCar({ x: 0, y: 0 }, 0), { ...NO_INPUT, stick: { a: Math.PI, k: 1 } }, 3);
  assert.ok(back.vy > 0, "pulled back from rest: reversing (heading up, moving down)");
  const dead = run(newCar({ x: 0, y: 0 }, 0), { ...NO_INPUT, stick: { a: 1, k: 0.05 } }, 2);
  assert.equal(speedOf(dead), 0, "the dead zone does nothing");
});

test("parked at one art car, stopping beside another within 300 ft parks you there (2026-10-24): ride does not put you back on the first", () => {
  const g = newGame(1, "bike", "mutant:dragon-lady"), dl = mutantOf("mutant:dragon-lady"), rh = mutantOf("mutant:robot-heart");
  const p = npcAt(dl, 0); g.car.x = p.x; g.car.y = p.y; g.car.h = p.h; setVehicle(g, "found"); setDriven("mutant:dragon-lady");
  const step = (secs, input) => { for (let i = 0; i < secs * 60; i++) stepGame(g, input, 1 / 60); };
  step(2, NO_INPUT); leaveDriven(g); step(1, NO_INPUT);
  assert.equal(g.parking.at, "mutant:dragon-lady", "beside the yacht you left");
  // Robot Heart happens to stand 120 ft away: stop beside it
  const q = npcAt(rh, g.t); const dlAt = npcAt(dl, g.t); g.car.x = dlAt.x + 120; g.car.y = dlAt.y; g.car.vx = 0; g.car.vy = 0;
  // put Robot Heart there for the test by parking it beside you
  setDriven("mutant:robot-heart"); g.vehicle = "found"; g.car.x = dlAt.x + 160; g.car.y = dlAt.y; leaveDriven(g); g.car.x = dlAt.x + 130; g.car.y = dlAt.y; g.car.vx = 0; g.car.vy = 0;
  step(2, NO_INPUT);
  assert.equal(g.parking.at, "mutant:robot-heart", `parked at the nearer car now: ${g.parking.at}`);
  assert.ok(hopOn(g) && g.aboard === "mutant:robot-heart", "ride means Robot Heart");
  void q;
});

test("the skydive (asked 2026-10-26): taking the plane makes it the job; high enough the jump is on; touching down by Agave delivers, far off fails", () => {
  const g = newGame(1, "bike", "airport");
  assert.ok(takePlane(g)); assert.equal(g.mission.job, SKYDIVE_JOB); assert.equal(g.mission.phase, "pickup");
  assert.match(pagerLine(g.mission), /climb to 400 ft/);
  const m = g.mission, car = { x: AGAVE.dome.x + 60, y: AGAVE.dome.y, speed: 0 };
  assert.equal(stepMission(m, car, 0.1, { t: 0, moop: 0, alt: SKYDIVE_ALT }), "picked"); assert.equal(m.phase, "dropoff");
  assert.match(pagerLine(m), /eject/);
  assert.equal(missionTarget(m, 0).label.slice(0, 5), "Agave");
  const g1 = m.gifts;
  assert.equal(stepMission(m, car, 0.1, { t: 0, moop: 0, alt: 0, landed: true }), "delivered"); assert.ok(m.gifts > g1);
  // again, coming down a mile off
  startSkydive(m); stepMission(m, car, 0.1, { t: 0, moop: 0, alt: SKYDIVE_ALT });
  assert.equal(stepMission(m, { x: AGAVE.dome.x + 3000, y: AGAVE.dome.y, speed: 0 }, 0.1, { t: 0, moop: 0, alt: 0, landed: true }), "failed");
  assert.match(pagerLine(m), /ft from Agave Lounge/);
  // the job on its own points you to the airport first
  const m2 = newMission(1); m2.job = SKYDIVE_JOB; m2.phase = "pickup"; m2.timeLeft = 100; m2.progress = 0; m2.moop0 = 0;
  assert.match(missionTarget(m2, 0).label, /airport/);
});

test("the Gate (asked 2026-10-26): out past the fence at 4:30 on open ground; stop in its ring for a dust angel (a gift the first time, and you lie still) and the bell", () => {
  assert.equal(solidAt(GATE.stop), null, "the stop is drivable, through the fence's open wedge");
  assert.equal(solidAt(GATE.road.to), null, "the road runs on toward the highway");
  assert.ok(Math.hypot(GATE.at.x, GATE.at.y) > Math.hypot(GATE.road.from.x, GATE.road.from.y), "the Gate is outside the city");
  const g = newGame(1);
  assert.equal(atGate(g), false); assert.equal(dustAngel(g), false); assert.equal(ringBell(g), false);
  g.car = { ...g.car, x: GATE.stop.x, y: GATE.stop.y, vx: 0, vy: 0 };
  assert.ok(atGate(g) && ringBell(g));
  const gifts = g.mission.gifts;
  assert.ok(dustAngel(g)); assert.equal(g.angels.length, 1); assert.equal(g.mission.gifts, gifts + 1, "the first angel is a gift");
  assert.equal(dustAngel(g), false, "one at a time");
  for (let i = 0; i < 30; i++) stepGame(g, { ...NO_INPUT, gas: true }, 1 / 60);
  assert.ok(Math.hypot(g.car.x - GATE.stop.x, g.car.y - GATE.stop.y) < 1, "lying still while the angel is made");
  for (let i = 0; i < ANGEL_T * 60; i++) stepGame(g, NO_INPUT, 1 / 60);
  assert.equal(g.angelT, 0);
  assert.ok(dustAngel(g)); assert.equal(g.mission.gifts, gifts + 1, "a second angel is just an angel");
});

test("the Golden Ticket parked on the playa drives as the garage's does (asked 2026-10-26: faster), the other found cars as art cars", () => {
  const g = newGame(1, "bike", "agave");
  setVehicle(g, "found"); setDriven("mutant:golden-ticket");
  assert.equal(vehicleOf(g).maxSpeed, VEHICLES.artcar.maxSpeed); assert.equal(vehicleOf(g).len, VEHICLES.found.len, "the drawing's size stays");
  g.ghost = true; g.car = { ...g.car, x: 0, y: -3000 }; // the open playa, nothing in the way
  for (let i = 0; i < 600; i++) stepGame(g, { ...NO_INPUT, gas: true }, 1 / 60);
  assert.ok(mph(speedOf(g.car)) >= 48, `tops out near 50 mph on the HUD (${mph(speedOf(g.car))})`);
  setDriven("mutant:robot-heart"); assert.equal(vehicleOf(g).maxSpeed, VEHICLES.found.maxSpeed);
  setDriven(null);
});

test("the pack behind the car you drive (asked 2026-10-26, a V and a half circle 2026-10-27): rides in a flying V, and pulls up in a half circle beside each other when you stop", () => {
  const g = newGame(1, "bike", "agave"); g.ghost = true; g.car = { ...g.car, x: 0, y: -2600, h: 0, vx: 0, vy: 0 }; // the open playa, nose to 12:00
  setVehicle(g, "found"); setDriven("mutant:robot-heart");
  const fs = g.npcs.filter((n) => n.lead && n.lead.key === "mutant:robot-heart");
  assert.ok(fs.length >= 8, `a pack (${fs.length})`);
  for (let i = 0; i < 480; i++) stepGame(g, { ...NO_INPUT, gas: true }, 1 / 60); // eight seconds flat out
  assert.ok(speedOf(g.car) > 150, `going (${speedOf(g.car)})`);
  for (const n of fs) { const p = npcAt(n, g.t); assert.ok(Math.hypot(p.x - g.car.x, p.y - g.car.y) < 200, `keeps up (${Math.hypot(p.x - g.car.x, p.y - g.car.y).toFixed(0)} ft back)`); }
  { // the flying V: rank 0 at the point, ranks 1 and 2 a pair, one each side and further back, ranks 3 and 4 the next pair further still
    const v = [0, 1, 2, 3, 4].map(packVee);
    assert.equal(v[0].side, 0); assert.ok(v[1].side > 0 && v[2].side < 0 && Math.abs(v[1].side + v[2].side) < 1e-9, "a pair, one each side");
    assert.ok(v[1].back > v[0].back && v[3].back > v[1].back && Math.abs(v[3].side) > Math.abs(v[1].side), "each pair further back and wider");
    const rel = fs.map((n) => { const p = npcAt(n, g.t), f = fwd(g.car.h), r = right(g.car.h), dx = p.x - g.car.x, dy = p.y - g.car.y; return { back: -(dx * f.x + dy * f.y), side: dx * r.x + dy * r.y }; });
    assert.ok(rel.every((q) => q.back > 0), "all behind the car");
    assert.ok(rel.some((q) => q.side > 8) && rel.some((q) => q.side < -8), "spread to both sides");
  }
  for (let i = 0; i < 90; i++) stepGame(g, { ...NO_INPUT, brake: true }, 1 / 60); // brake (held on, the brake would back it up)
  for (let i = 0; i < 600; i++) stepGame(g, NO_INPUT, 1 / 60); // and wait
  assert.ok(speedOf(g.car) < 1, "stopped");
  const ps = fs.map((n) => npcAt(n, g.t));
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) assert.ok(Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y) >= PACK_SEP - 1, "beside each other, not on top of each other");
  for (const p of ps) { const d = Math.hypot(p.x - g.car.x, p.y - g.car.y); assert.ok(d > 36 && d < 160, `pulled up behind the car (${d.toFixed(0)})`); }
  // the slots: a half circle behind the car, the first straight behind, the next ones out to either side at the same distance
  const s0 = packSlot({ x: 0, y: 0, h: 0 }, 0), s1 = packSlot({ x: 0, y: 0, h: 0 }, 1), s2 = packSlot({ x: 0, y: 0, h: 0 }, 2), s5 = packSlot({ x: 0, y: 0, h: 0 }, 5);
  assert.ok(s0.y > 30 && Math.abs(s0.x) < 1e-9, "the first straight behind, nose to 12:00 means +y is behind");
  assert.ok(s1.x > 5 && s2.x < -5 && Math.abs(s1.x + s2.x) < 1e-9, "the next pair one each side");
  for (const q of [s0, s1, s2, s5]) assert.ok(Math.abs(Math.hypot(q.x, q.y) - Math.hypot(s0.x, s0.y)) < 1e-6 && q.y > 0, "all on one arc behind the car");
  assert.ok(Math.hypot(s1.x - s0.x, s1.y - s0.y) >= PACK_SEP, "an arm's length apart along the arc");
  // left parked, they stay where they pulled up, beside each other
  leaveDriven(g); const qs = fs.map((n) => npcAt(n, g.t));
  for (let i = 0; i < qs.length; i++) assert.ok(Math.abs(qs[i].x - ps[i].x) < 1e-6 && Math.abs(qs[i].y - ps[i].y) < 1e-6, "stays put when the car is left parked");
  setDriven(null);
});

test("after the jump, Polo & Pan (asked 2026-10-26): the pager points at the Golden Ticket until you drive it, then Robot Heart, then Agave; only in that car", () => {
  const g = newGame(1, "bike", "airport"); takePlane(g);
  const m = g.mission, w = (extra) => ({ t: 0, moop: 0, ...extra });
  stepMission(m, { x: AGAVE.dome.x, y: AGAVE.dome.y, speed: 0 }, 0.1, w({ alt: SKYDIVE_ALT }));
  stepMission(m, { x: AGAVE.dome.x, y: AGAVE.dome.y, speed: 0 }, 0.1, w({ alt: 0, landed: true }));
  assert.equal(m.phase, "done");
  for (let i = 0; i < 90; i++) stepMission(m, { x: AGAVE.dome.x, y: AGAVE.dome.y, speed: 0 }, 0.1, w({})); // four seconds of 'done', three of the brief
  assert.equal(m.job, POLO_JOB, "the jump hands over to Polo & Pan"); assert.equal(m.phase, "pickup");
  const gt = npcAt(mutantOf("mutant:golden-ticket"), 0);
  assert.ok(Math.hypot(missionTarget(m, 0).at.x - gt.x, missionTarget(m, 0).at.y - gt.y) < 1, "first the parked Golden Ticket");
  assert.match(pagerLine(m), /parked at Agave Lounge/);
  // at Robot Heart on a bike: nothing
  const rh = npcAt(mutantOf("mutant:robot-heart"), 0), pad = { x: rh.x, y: rh.y };
  assert.equal(stepMission(m, { ...pad, speed: 0 }, 0.1, w({ driving: null })), null); assert.equal(m.phase, "pickup");
  // at its wheel: Robot Heart is the target (not the airport, too far a run), and stopping beside it picks them up
  stepMission(m, { x: gt.x, y: gt.y, speed: 0 }, 0.1, w({ driving: "mutant:golden-ticket" }));
  assert.match(missionTarget(m, 0).label, /Robot Heart/); assert.match(pagerLine(m), /go and get them/);
  assert.equal(stepMission(m, { ...pad, speed: 0 }, 0.1, w({ driving: "mutant:golden-ticket" })), "picked");
  assert.match(pagerLine(m), /bring them to Agave Lounge/);
  const gifts = m.gifts;
  assert.equal(stepMission(m, { ...AGAVE.mid, speed: 0 }, 0.1, w({ driving: "mutant:golden-ticket" })), "delivered");
  assert.ok(m.gifts > gifts); assert.match(pagerLine(m), /Polo & Pan are on/);
});

test("skipping a job briefs another, with no gifts and no failure (asked 2026-11-03)", () => {
  const m = newMission(5), car = { x: 0, y: -3000, speed: 0 };
  for (let i = 0; i < 40 && m.phase === "brief"; i++) stepMission(m, car, 0.1);
  const job = m.job, gifts = m.gifts, failed = m.failed;
  skipMission(m);
  assert.notEqual(m.job, job); assert.equal(m.phase, "brief"); assert.equal(m.gifts, gifts); assert.equal(m.failed, failed);
  let started = null;
  for (let i = 0; i < 10 && !started; i++) started = stepMission(m, car, 0.1);
  assert.equal(started, "start", "the next job is on within a second");
});

test("people on foot jump out of your way instead of being bumped (asked 2026-11-04)", () => {
  const g = newGame(3, undefined, "agave");
  const w = g.npcs.find((n) => n.kind === "walker" && n.path === "loop");
  // ride straight at them at 30 mph from 150 ft, and hold the gas
  const p0 = npcAt(w, g.t), h = 0.7, f = { x: Math.sin(h), y: -Math.cos(h) };
  g.car = { ...g.car, x: p0.x - f.x * 150, y: p0.y - f.y * 150, h, vx: f.x * 44, vy: f.y * 44 };
  g.ghost = false; g.npcs.splice(0, g.npcs.length, w);
  let closest = Infinity, hit = false, gifts = g.mission.gifts;
  for (let i = 0; i < 60 * 5; i++) {
    const ev = stepGame(g, { ...NO_INPUT, gas: true }, DT); if (ev.includes("hit")) hit = true;
    const p = npcAt(w, g.t); closest = Math.min(closest, Math.hypot(p.x - g.car.x, p.y - g.car.y));
  }
  assert.ok(w.dodge, "they jumped"); assert.equal(hit, false, "no bump"); assert.equal(g.mission.gifts, gifts, "no gift lost");
  assert.ok(closest > 8, `they were clear of you as you passed (${closest.toFixed(1)} ft)`);
  for (let u = 0; u < DODGE.leap + DODGE.hold + DODGE.back; u += 0.05) { const t = w.dodge.t0 + u, q = npcAt(w, t), r = npcAt({ ...w, dodge: null }, t); assert.ok(Math.hypot(q.x - r.x, q.y - r.y) < 40, "they stay a step or two off their route"); }
  // and later they are back on their way
  const back = w.dodge.t0 + DODGE.leap + DODGE.hold + DODGE.back + 0.1, r = npcAt({ ...w, dodge: null }, back), q = npcAt(w, back);
  assert.ok(Math.hypot(q.x - r.x, q.y - r.y) < 0.01, "back on their route");
});

test("a biker you ride into falls over and gets back up, and you ride on through (asked 2026-11-04)", () => {
  const g = newGame(3, undefined, "agave");
  const b = g.npcs.find((n) => n.kind === "bike" && n.path === "loop" && !n.lead);
  b.speed = 0; // standing still, so you cannot miss
  const p0 = npcAt(b, g.t), h = 0.7, f = { x: Math.sin(h), y: -Math.cos(h) };
  g.car = { ...g.car, x: p0.x - f.x * 120, y: p0.y - f.y * 120, h, vx: f.x * 30, vy: f.y * 30 };
  g.ghost = false; g.npcs.splice(0, g.npcs.length, b);
  let slowest = Infinity, fell = null;
  for (let i = 0; i < 60 * 6; i++) {
    stepGame(g, { ...NO_INPUT, gas: true }, DT);
    if (b.fall && fell === null) fell = g.t;
    if (fell !== null && g.t - fell < 0.5) slowest = Math.min(slowest, speedOf(g.car));
  }
  assert.ok(fell !== null, "they fell over");
  assert.ok(slowest > 25, `nothing stopped you (${slowest.toFixed(1)} ft/s at worst)`);
  const t0 = b.fall.t0;
  assert.ok(fallOf(b, t0 + FALL.down + FALL.lie / 2).tilt === 1, "flat on the ground a moment");
  assert.equal(fallOf(b, t0 + FALL.down + FALL.lie + FALL.up + 0.01), null, "back on their feet");
  const done = t0 + FALL.down + FALL.lie + FALL.up + FALL.back + 0.1, q = npcAt(b, done), r = npcAt({ ...b, fall: null }, done);
  assert.ok(Math.hypot(q.x - r.x, q.y - r.y) < 0.01, "and on their way again");
  assert.ok(fallsOver({ kind: "walker" }) && fallsOver({ kind: "unicycle" }) && !fallsOver({ kind: "mutant" }) && !fallsOver({ kind: "rv" }), "people on foot and on bikes fall; art cars and RVs still stop you");
});

test("two art cars meet up, hang out a while and go on without driving through each other (asked 2026-11-04)", () => {
  const g = newGame(5, undefined, "agave");
  const base = MUTANTS.find((m) => m.path === "loop");
  // head on along the same circle, 400 ft apart
  const perMin = (base.r * Math.PI * 2) / 720;
  const a = { ...base, key: "mutant:test-a", speed: 12, phase: 100, held: 0, swerve: 0, meet: null, met: {} };
  const b = { ...base, key: "mutant:test-b", speed: -12, phase: 100 + 400 / perMin, held: 0, swerve: 0, meet: null, met: {} };
  g.npcs.splice(0, g.npcs.length, a, b); g.car.x = 99999; g.car.y = 99999;
  const clear = NPC_R.mutant * 2 + 8;
  let closest = Infinity, metAt = null;
  for (let i = 0; i < 60 * 120; i++) {
    stepGame(g, NO_INPUT, DT);
    const p = npcAt(a, g.t), q = npcAt(b, g.t); closest = Math.min(closest, Math.hypot(p.x - q.x, p.y - q.y));
    if (a.meet && metAt === null) metAt = g.t;
  }
  assert.ok(metAt !== null, "they met up");
  assert.ok(a.held >= ART_MEET.secs - 0.1 && b.held >= ART_MEET.secs - 0.1, `they hung out (${a.held.toFixed(1)} s, ${b.held.toFixed(1)} s)`);
  assert.ok(closest >= clear - 1, `never through each other (${closest.toFixed(1)} ft apart at closest, ${clear} clear)`);
  // and they got past: each is now on the other side of where they met
  const p = npcAt(a, g.t), q = npcAt(b, g.t), ap = Math.atan2(p.y, p.x), bp = Math.atan2(q.y, q.x);
  assert.ok(Math.sin(ap - bp) * Math.sign(a.speed) > 0 || Math.hypot(p.x - q.x, p.y - q.y) > 600, "they went on past each other");
});
