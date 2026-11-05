/**
 * Which rides are yours (asked 2026-11-03: "on the first landing at Agave Lounge let's give the user only the playa bike, and as they complete
 * missions let's give them the other bikes. Don't give them art cars until they have driven them"). You start with every bike (asked 2026-11-04: the Playa Cruiser,
 * the unicycle, the fat-tyre e-bike and the tuk-tuk); each job you deliver on the pager gives you the next ride in MISSION_RIDES. The Golden Ticket's card comes once you have driven it on the playa
 * (it is in the garage of art cars you have driven, PlayaWin's GARAGE_KEY), as every other art car's does. The Cuttlefish has no car on
 * the playa to drive first, so it is the last ride the jobs give. Kept in the browser (PlayaWin, UNLOCK_KEY) as the number of jobs delivered.
 */
import type { VehicleId } from "./playa.ts";

/** What each job delivered gives, in order, after the Playa Cruiser you start with. */
export const MISSION_RIDES: readonly VehicleId[] = ["rv", "fish"];
/** What is yours from the start: every bike, the Playa Cruiser, the unicycle, the fat-tyre e-bike and the tuk-tuk (asked 2026-11-04). */
export const START_RIDES: readonly VehicleId[] = ["bike", "unicycle", "onewheel", "ebike", "tuktuk"]; // and the Onewheel (asked 2026-11-04)
export const UNLOCK_KEY = "agentcamp-playa-unlocks";

/** The rides you may take from the garage, having delivered `delivered` jobs and driven the art cars in `driven` (their ids). */
export function unlockedRides(delivered: number, driven: readonly string[]): VehicleId[] {
  const out: VehicleId[] = [...START_RIDES, ...MISSION_RIDES.slice(0, Math.max(0, Math.floor(delivered)))];
  if (driven.includes("golden-ticket")) out.push("artcar");
  return out;
}
/** The ride the next job delivered gives, or null when they are all yours. */
export const nextUnlock = (delivered: number): VehicleId | null => MISSION_RIDES[Math.max(0, Math.floor(delivered))] ?? null;
