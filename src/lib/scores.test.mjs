import test from "node:test";
import assert from "node:assert/strict";
import { LEGS as legs } from "./legs.ts";
import { JOBS, place, VEHICLES } from "./playa.ts";
import { COUNT_MAX, END_R, SPEED_CAP, cleanCounts, dayKey, fmtSecs, jobId, jobIdOk, nameOk, randomName, runProblem } from "./scores.ts";

const rides = JOBS.filter((j) => j.kind === "ride");

test("every ride job has its own id on the board, and the fixed legs are where the city has them (re-run scripts/build-legs.mjs if not)", () => {
  const ids = rides.map(jobId);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(jobIdOk(id), id);
  for (const j of rides) {
    const id = jobId(j), moving = j.from.startsWith("mutant:") || j.to.startsWith("mutant:");
    if (moving) { assert.equal(legs[id], undefined, id); continue; }
    const a = place(j.from).at, b = place(j.to).at;
    assert.deepEqual(legs[id], { from: { x: Math.round(a.x) + 0, y: Math.round(a.y) + 0 }, to: { x: Math.round(b.x) + 0, y: Math.round(b.y) + 0 } }, id);
  }
  assert.equal(Object.keys(legs).length, rides.filter((j) => !j.from.startsWith("mutant:") && !j.to.startsWith("mutant:")).length);
});

test("the speed cap is over every ride on the ground and under the plane's", () => {
  for (const [id, v] of Object.entries(VEHICLES)) if (id !== "plane") assert.ok(v.maxSpeed * 1.3 < SPEED_CAP, id);
});

test("names come from the word lists and nothing else", () => {
  let s = 7; const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 200; i++) assert.ok(nameOk(randomName(rand)));
  for (const bad of ["dusty", "dusty Burner", "dusty  burner", "dusty burner ", "rude word", "dusty burner<script>", 42, null]) assert.equal(nameOk(bad), false, String(bad));
});

test("the board's day turns over at midnight Pacific", () => {
  assert.equal(dayKey(Date.UTC(2026, 10, 5, 7, 59)), "2026-11-04"); // 23:59 PST
  assert.equal(dayKey(Date.UTC(2026, 10, 5, 8, 0)), "2026-11-05");
  assert.equal(dayKey(Date.UTC(2026, 7, 30, 6, 59)), "2026-08-29"); // PDT in burn week
});

test("a counts batch keeps the known kinds as whole numbers up to the cap", () => {
  assert.deepEqual(cleanCounts({ moop: 3, bell: 0, angel: 1 }), { moop: 3, angel: 1 });
  assert.equal(cleanCounts({ moop: 0 }), null);
  assert.equal(cleanCounts({ moop: COUNT_MAX + 1 }), null);
  assert.equal(cleanCounts({ moop: 1.5 }), null);
  assert.equal(cleanCounts({ moop: -1 }), null);
  assert.deepEqual(cleanCounts({ moop: 2, gold: 9 }), { moop: 2 });
  assert.equal(cleanCounts("moop"), null);
});

const line = (from, to, secs) => {
  const trace = [];
  for (let t = 0; t <= secs + 1e-9; t += 1) { const k = t / secs; trace.push([t, Math.round(from.x + (to.x - from.x) * k), Math.round(from.y + (to.y - from.y) * k)]); }
  if (trace[trace.length - 1][0] !== secs) trace.push([secs, to.x, to.y]);
  return trace;
};

test("a real run is kept; a forged one is turned away", () => {
  const j = rides.find((x) => legs[jobId(x)]), leg = legs[jobId(j)], d = Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y);
  const secs = Math.ceil(d / 300), run = { job: jobId(j), secs, name: "dusty burner", trace: line(leg.from, leg.to, secs) };
  assert.equal(runProblem(run, leg), null);
  const fast = Math.floor(d / (SPEED_CAP * 1.6));
  assert.equal(runProblem({ ...run, secs: fast, trace: line(leg.from, leg.to, fast) }, leg), "too fast");
  assert.equal(runProblem({ ...run, trace: [run.trace[0], run.trace[run.trace.length - 1]] }, leg), "trace gaps");
  assert.equal(runProblem({ ...run, secs: secs + 5 }, leg), "trace and time disagree");
  const off = { x: leg.from.x + END_R + 50, y: leg.from.y };
  assert.equal(runProblem({ ...run, trace: line(off, leg.to, secs) }, leg), "not from the pickup");
  assert.equal(runProblem({ ...run, trace: line(leg.from, off, secs) }, leg), "not at the drop");
  assert.equal(runProblem({ ...run, name: "Collin" }, leg), "bad name");
  assert.equal(runProblem({ ...run, job: "moop:>art:Space Whale" }, leg), "bad job");
  assert.equal(runProblem({ ...run, secs: 1, trace: [[0, 0, 0], [1, 0, 0]] }, null), "bad time");
});

test("times on the board", () => {
  assert.equal(fmtSecs(42.34), "42.3 s");
  assert.equal(fmtSecs(125.1), "2:05.1");
});
