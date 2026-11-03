import type { Critter } from "./critters";
import { heavyMeta } from "./heavyMeta";
import { kalliope } from "./kalliope";
import { goldenGate } from "./goldenGate";
import { baaahs } from "./baaahs";
import { funkadelephant } from "./funkadelephant";

/** One-off art car models (asked 2026-11-02), batch b: each id's model, built as doge.ts is (critters.ts). cars.ts draws each within SHOW_MODEL and its instanced hull beyond. */
export const ONEOFFS_B: Record<string, () => Critter> = { "heavy-meta": heavyMeta, kalliope, "golden-gate-art-car": goldenGate, baaahs, funkadelephant };
