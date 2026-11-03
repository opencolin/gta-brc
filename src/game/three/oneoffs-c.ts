import type { Critter } from "./critters";
import { dragonfly } from "./dragonfly";
import { nudibranch } from "./nudibranch";
import { scarab } from "./scarab";
import { technoGecko } from "./technoGecko";
import { whompWagon } from "./whompWagon";

/** One-off art car models (asked 2026-11-02), batch c: each id's model, built as doge.ts is (critters.ts). cars.ts draws each within SHOW_MODEL and its instanced hull beyond. */
export const ONEOFFS_C: Record<string, () => Critter> = {
  "whomp-wagon": whompWagon, dragonfly, nudibranch, technogecko: technoGecko, "the-scarab": scarab,
};
