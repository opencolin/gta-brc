// node --experimental-strip-types --test lib/games/playa.test.mjs
// The playa game's rules (playa.ts): the art car's physics, collisions, the pager's jobs, the weather and the light.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAR, NO_INPUT, AGAVE, AGAVE_ADDRESS, JOBS, STOP_R, ART, OBSTACLES, startKey, mutantOf, SKYDIVE_JOB, SKYDIVE_ALT, startSkydive, VEHICLES, VEHICLE_IDS, SPOTS, MUTANTS, CAMP_SPEED, FOLLOW_R,
  newCar, carStep, carSpeeds, speedOf, collide, solidAt, bounce, agaveSpot, place, placeKeys, npcAt, makeNpcs, NPC_R, FOLLOW_GAP, seeded, inBay, cityPlan,
  newMission, stepMission, missionTarget, pagerLine, timeFor, nextJob, stormLevel, stepStorm, nightLevel, flipDay, DAY_SECONDS,
  newGame, stepGame, moopSpot, mph, MPH, setVehicle, nextVehicle, hopOn, hopOff, setDriven, leaveDriven, parkedCarAt, takePlane, bailOut, atAirport, TAKEOFF, STALL, newParking, stepParking, parkingAt, PARK_SPEED,
} from "./playa.ts";
import { AIRPORT, ARC_R, ROAD_W, WIDE_ROAD_W, ESPLANADE_W, CITY_SCALE, FENCE_R, polar, pointAt, surfaceAt, addressOf, blockPush, toPolar, clockToAngle } from "./brc.ts";
import { planAt, structPush } from "./camps.ts";

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
    for (const p of [c, { x: c.x, y: c.y }]) assert.equal(blockPush(p), null, "never left inside a block");
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
    assert.ok(Math.abs(Math.hypot(p.x, p.y) - n.r) < 1e-6, "on its circle");
    if (n.path === "arc") assert.notEqual(solidAt(p)?.depth > 5, true, "a bike on an arc rides the street");
  }
});

test("more people: walkers on the street edges, and bikers riding behind the art cars", () => {
  const npcs = makeNpcs(seeded(3));
  assert.ok(npcs.filter((n) => n.kind === "walker").length >= 50);
  assert.ok(npcs.filter((n) => n.kind === "bike").length >= 100);
  const packs = npcs.filter((n) => n.lead);
  assert.ok(packs.length >= 60 && packs.every((n) => n.lead.kind === "mutant" || n.lead.kind === "artcar"));
  for (const w of npcs.filter((n) => n.kind === "walker")) assert.ok(Math.abs(w.speed) < 8, "walkers walk");
});

test("storms rise, hold and blow over; night comes and goes; the toggle flips it", () => {
  const rand = seeded(1);
  const s = { phase: "clear", t: 0, hold: 5 };
  const seen = new Set();
  let peak = 0;
  for (let i = 0; i < 60 * 60; i++) { stepStorm(s, DT, rand); seen.add(s.phase); peak = Math.max(peak, stormLevel(s)); }
  assert.deepEqual([...seen].sort(), ["clear", "falling", "rising", "storm"]);
  assert.equal(peak, 1);
  assert.equal(nightLevel(0), 0);
  assert.equal(nightLevel(DAY_SECONDS * 0.7), 1);
  assert.ok(nightLevel(DAY_SECONDS * 0.45) > 0 && nightLevel(DAY_SECONDS * 0.45) < 1, "dusk");
  assert.equal(nightLevel(flipDay(0)), 1);
  assert.equal(nightLevel(flipDay(DAY_SECONDS * 0.7)), 0);
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
      if (b && b.depth > 8) inBlock = true;
    }
    assert.equal(inBlock, v.throughCamps, `${id} ${v.throughCamps ? "gets into" : "stays out of"} the block`);
  }
  assert.ok(solidAt({ x: 0, y: 14000 }, true), "the fence stops a bike");
  assert.ok(solidAt({ x: 0, y: 10 }, true), "so does the Man");
  // and the bike bounces off what stands in the camps
  const holder = plan.find((b) => b.solids.length);
  const thing = holder.solids[0];
  assert.ok(solidAt(thing, true), `a camp's ${thing.kind} is solid`);
  assert.equal(planAt(plan, thing), holder);
  assert.ok(structPush(thing, thing));
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
    assert.ok(solidAt(s.stage), `${s.name}'s stage is solid`);
    assert.ok(solidAt(s.stage, true), `${s.name}'s stage is solid to a bike too`);
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
      const s = solidAt(g.car, VEHICLES[id].throughCamps);
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
  g.npcs = [still, { ...still, kind: "bike", r: still.r }];
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
  assert.ok(alt / 24 < 60 * 60 * DT, "a chute from that height lands inside a minute");
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
  assert.equal(startKey("mayan"), "mutant:mayan-warrior"); assert.equal(startKey("orb"), "art:The Orb");
  assert.equal(startKey("the-orb"), "art:The Orb");
  assert.equal(startKey("agave"), "agave"); assert.equal(startKey("temple"), "temple");
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
  assert.match(pagerLine(m), /bail out/);
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
