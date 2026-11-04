// node --experimental-strip-types --test src/lib/unlocks.test.mjs
// the rides that are yours: the Playa Cruiser first, one more per job delivered, an art car once you have driven it (unlocks.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { MISSION_RIDES, nextUnlock, unlockedRides } from "./unlocks.ts";

test("the Playa Cruiser first, the other bikes one job at a time, art cars once driven", () => {
  assert.deepEqual(unlockedRides(0, []), ["bike"], "only the Playa Cruiser at first");
  assert.deepEqual(unlockedRides(1, []), ["bike", "unicycle"]);
  assert.deepEqual(unlockedRides(3, []).slice(0, 4), ["bike", "unicycle", "ebike", "tuktuk"], "the bikes before the RV");
  assert.ok(!unlockedRides(2, []).includes("artcar"), "no Golden Ticket until you have driven it");
  assert.ok(unlockedRides(0, ["golden-ticket"]).includes("artcar"), "and it is yours once you have");
  assert.deepEqual(unlockedRides(99, []), ["bike", ...MISSION_RIDES], "every ride in the end, none twice");
  assert.equal(nextUnlock(0), "unicycle"); assert.equal(nextUnlock(MISSION_RIDES.length), null);
});
