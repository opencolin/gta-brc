import type { Critter } from "./critters";
import { elPulpo } from "./elPulpo";
import { mayanWarrior } from "./mayanWarrior";
import { robotHeart } from "./robotHeart";
import { submarine } from "./submarine";
import { titanicsEnd } from "./titanicsEnd";

/** One-off art car models (asked 2026-11-02), batch a: each id's model, built as doge.ts is (critters.ts). cars.ts draws each within SHOW_MODEL and its instanced hull beyond. */
export const ONEOFFS_A: Record<string, () => Critter> = {
  "robot-heart": robotHeart, "mayan-warrior": mayanWarrior, "titanics-end": titanicsEnd, "el-pulpo-mecanico": elPulpo, "lonely-submarine": submarine,
};
