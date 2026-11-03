import type { Critter } from "./critters";
import { discow } from "./discow";
import { eyeOfHorus } from "./eyeOfHorus";
import { luna } from "./luna";
import { slug } from "./slug";

/** One-off art car models (asked 2026-11-02), batch d: each id's model, built as doge.ts is (critters.ts). cars.ts draws each within SHOW_MODEL and its instanced hull beyond. */
export const ONEOFFS_D: Record<string, () => Critter> = {
  "eye-of-horus": eyeOfHorus,
  "the-slug": slug,
  "luna-the-artcrane": luna,
  discow,
};
