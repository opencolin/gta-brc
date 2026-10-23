/**
 * The big art on the open playa, drawn in detail from above (asked 2026-10-23), keyed by its id in lib/playa.ts ART.
 * Each drawing is called at the piece's centre with its footprint radius `r`; `t` animates what moves (fire, LEDs,
 * flapping, folding) and `night` lights it. The pieces live in art/ by kind: the mesh and wooden figures, the creatures,
 * the structures, and the groves. A piece with no drawing here keeps PlayaWin's plain star.
 */
import { PIECES as FIGURES } from "./art/figures";
import { PIECES as CREATURES } from "./art/creatures";
import { PIECES as STRUCTURES } from "./art/structures";
import { PIECES as GROVES } from "./art/groves";
export type { DrawPiece } from "./art/figures";

type Draw = (c: CanvasRenderingContext2D, t: number, night: number, r: number) => void;
/** A tall, slim piece (a standing figure, a jet on its tail) has a small footprint from above; draw it larger than
 * its footprint so it reads at the game's zoom, as the art cars are drawn larger than life. */
const larger = (draw: Draw, k: number): Draw => (c, t, night, r) => { c.save(); c.scale(k, k); draw(c, t, night, r); c.restore(); };
const SCALE: Record<string, number> = { "bliss-dance": 1.6, "truth-is-beauty": 1.8, "r-evolution": 1.7, "real-love": 1.5, lodestar: 1.5, mariposa: 1.3 };
const ALL: Record<string, Draw> = { ...FIGURES, ...CREATURES, ...STRUCTURES, ...GROVES };
export const ART_PIECES: Record<string, Draw> = Object.fromEntries(Object.entries(ALL).map(([id, d]) => [id, SCALE[id] ? larger(d, SCALE[id]) : d]));
