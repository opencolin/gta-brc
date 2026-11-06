#!/usr/bin/env node
/**
 * Writes src/lib/legs.ts (asked 2026-11-05): where each ride job's pickup and drop are, for the leaderboard's
 * check in api/run.ts, which cannot load the city itself. A leg to or from an art car is left out (it moves).
 * scores.test.mjs fails when the jobs change and this has not been re-run:
 *
 *   node --experimental-strip-types scripts/build-legs.mjs
 */
import { writeFileSync } from "node:fs";
import { JOBS, place } from "../src/lib/playa.ts";
import { jobId } from "../src/lib/scores.ts";

const r = (p) => ({ x: Math.round(p.x), y: Math.round(p.y) });
const legs = {};
for (const j of JOBS) {
  if (j.kind !== "ride" || j.from.startsWith("mutant:") || j.to.startsWith("mutant:")) continue;
  legs[jobId(j)] = { from: r(place(j.from).at), to: r(place(j.to).at) };
}
writeFileSync(new URL("../src/lib/legs.ts", import.meta.url), "/** Written by scripts/build-legs.mjs: each ride job's pickup and drop, feet, for api/runs.ts. Do not edit. */\nexport const LEGS: Record<string, { from: { x: number; y: number }; to: { x: number; y: number } }> = {\n" + Object.entries(legs).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n};\n");
console.log(`${Object.keys(legs).length} legs`);
