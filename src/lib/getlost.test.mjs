// node --experimental-strip-types --test src/lib/getlost.test.mjs
// getlost.fyi's 2026 city (getlost.ts, public/data/getlost-2026.json) placed on the game's grid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ARC_R, ARCS, surfaceAt, parseClock, toPolar } from "./brc.ts";
import { REAL_ARC_FT, burnTime, campAt, dayName, gameR, hourLabel, isOn, toGame } from "./getlost.ts";

const data = JSON.parse(readFileSync(new URL("../../public/data/getlost-2026.json", import.meta.url), "utf8"));

test("the import has the whole city: camps, art, art cars, services, events, points", () => {
  const n = (k) => data.places.filter((p) => p.kind === k).length;
  assert.ok(n("camp") > 1000 && n("art") > 250 && n("mutant") > 400 && n("service") > 50);
  assert.ok(data.events.length > 6000 && data.events.every((e) => /^2026-\d\d-\d\d$/.test(e.day) && e.to > e.from - 1e-9));
  assert.ok(new Set(data.places.map((p) => p.uid)).size === data.places.length, "uids are unique");
  for (const name of ["The Man", "The Temple", "Center Camp", "Greeters"]) assert.ok(data.points.some((p) => p.name === name), name);
});

test("real feet map street by street onto the game's streets", () => {
  for (let i = 0; i < REAL_ARC_FT.length; i++) assert.ok(Math.abs(gameR(REAL_ARC_FT[i]) - ARC_R[i]) < 1e-9, ARCS[i]);
  for (let ft = 0; ft < 9000; ft += 37) assert.ok(gameR(ft + 1) > gameR(ft), "never folds back");
  const temple = toGame(data.points.find((p) => p.name === "The Temple")), man = toGame(data.points.find((p) => p.name === "The Man"));
  assert.ok(Math.hypot(man.x, man.y) < 5 && Math.abs(toPolar(temple).min % 720) < 2 || Math.abs(toPolar(temple).min - 720) < 2);
});

test("a camp at a corner lands in a block of camps beside that corner, at its clock", () => {
  const camps = data.places.filter((p) => p.kind === "camp" && !p.approx && /^([A-K]|Esplanade) & \d+:\d\d|^\d+:\d\d & ([A-K]|Esplanade)/.test(p.address ?? ""));
  assert.ok(camps.length > 900);
  let inBlock = 0;
  for (const c of camps) {
    const at = campAt(c), clock = parseClock(/(\d+:\d\d)/.exec(c.address)[1]);
    assert.ok(Math.abs(toPolar(at).min - clock) <= 10, `${c.name} at ${c.address}`);
    if (surfaceAt(at).kind === "block") inBlock++;
  }
  assert.ok(inBlock / camps.length > 0.97, `${inBlock} of ${camps.length} in a block`);
});

test("the burn's clock: sunset at 7:30 PM, sunrise at 6:30 AM, past midnight is the next day", () => {
  assert.deepEqual(burnTime(0, 0.45), { day: "2026-08-31", hour: 19.5 });
  assert.equal(burnTime(0, 0.95).hour, 6.5); assert.equal(burnTime(0, 0.95).day, "2026-09-01");
  assert.equal(burnTime(0, 0.2).day, "2026-08-31"); assert.ok(burnTime(0, 0.2).hour > 12 && burnTime(0, 0.2).hour < 19.5);
  const late = burnTime(1, 0.8); assert.equal(late.day, "2026-09-02"); assert.ok(late.hour < 6.5);
  let last = -1, lastDay = "";
  for (let f = 0.951; f < 1.95; f += 0.01) { const n = Math.floor(f), b = burnTime(n, f - n); if (b.day === lastDay) assert.ok(b.hour > last, "time runs forward"); last = b.hour; lastDay = b.day; }
  assert.equal(burnTime(7, 0.2).day, "2026-08-31", "round again after Sunday");
  assert.equal(hourLabel(16.5), "4:30 PM"); assert.equal(hourLabel(12), "noon"); assert.equal(hourLabel(25), "1 AM"); assert.equal(dayName("2026-08-31"), "Mon");
});

test("an event is on between its hours, and past midnight on the night it started", () => {
  const e = { day: "2026-09-01", from: 21, to: 26 };
  assert.ok(isOn(e, "2026-09-01", 22) && !isOn(e, "2026-09-01", 20));
  assert.ok(isOn(e, "2026-09-02", 1.5) && !isOn(e, "2026-09-02", 2.5));
  const now = burnTime(2, 0.2), on = data.events.filter((x) => isOn(x, now.day, now.hour));
  assert.ok(on.length > 30, `${on.length} events on ${now.day} at ${hourLabel(now.hour)}`);
});
