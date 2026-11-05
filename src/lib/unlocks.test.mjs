// node --experimental-strip-types --test src/lib/unlocks.test.mjs
// the rides that are yours: every bike first, one more per job delivered, an art car once you have driven it (unlocks.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { MISSION_RIDES, START_RIDES, nextUnlock, unlockedRides } from "./unlocks.ts";

test("every bike from the start, the RV and the Cuttlefish one job at a time, art cars once driven", () => {
  assert.deepEqual(unlockedRides(0, []), ["bike", "unicycle", "ebike", "tuktuk"], "all the bikes at first");
  assert.deepEqual(unlockedRides(1, []), [...START_RIDES, "rv"]);
  assert.ok(!unlockedRides(2, []).includes("artcar"), "no Golden Ticket until you have driven it");
  assert.ok(unlockedRides(0, ["golden-ticket"]).includes("artcar"), "and it is yours once you have");
  assert.deepEqual(unlockedRides(99, []), [...START_RIDES, ...MISSION_RIDES], "every ride in the end, none twice");
  assert.equal(nextUnlock(0), "rv"); assert.equal(nextUnlock(MISSION_RIDES.length), null);
});
