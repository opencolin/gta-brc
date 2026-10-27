import { clockToAngle, type Vec } from "./brc.ts";

/**
 * The chase-camera mode's pure side: which view is chosen, and how the game's axes map onto
 * three.js's. No DOM, no three.js, so the node tests can run it; src/game/three/ does the drawing.
 *
 * The game: feet, the Man at the origin, x east (toward 3:00), y SOUTH (toward 6:00, down on the
 * map), a heading h in radians with 0 facing 12:00 (-y) and growing clockwise on the screen.
 * three.js: right-handed, Y up. x → X, y → Z, up → Y, and a heading h is object.rotation.y = -h.
 */

export type ViewMode = "top" | "chase";
/** localStorage key for the remembered choice (per device). */
export const VIEW_KEY = "agentcamp-playa-view";

/** `?view=chase|top` wins, then the stored choice, then top-down (the default). */
export function readViewMode(search: string, stored: string | null): ViewMode {
  const q = new URLSearchParams(search).get("view");
  if (q === "chase" || q === "top") return q;
  if (stored === "chase" || stored === "top") return stored;
  return "top";
}

/** A point in three.js axes. */
export type Vec3 = { x: number; y: number; z: number };

/** Game feet (and feet up) → three.js [X, Y, Z]. */
export const toWorld = (p: Vec, up = 0): [number, number, number] => [p.x, up, p.y];
/** three.js [X, Y, Z] → game feet, with Y as `up`. */
export const fromWorld = (v: readonly [number, number, number]): Vec & { up: number } => ({ x: v[0], y: v[2], up: v[1] });
/** A game heading (or any canvas-convention angle) → the Object3D.rotation.y that turns -Z to that heading. */
export const yawOf = (a: number) => -a;

/* ── copies of helpers that are private where they live (playa.ts, PlayaWin.tsx, citymap.ts) ── */
export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** Unit vector a heading faces, in game axes. */
export const fwd = (h: number) => ({ x: Math.sin(h), y: -Math.cos(h) });
/** Unit vector to a heading's right, in game axes. */
export const right = (h: number) => ({ x: Math.cos(h), y: Math.sin(h) });
/** Clock minutes → a canvas angle (canvas 0 is 3 o'clock, ours is 12). */
export const cang = (min: number) => clockToAngle(min) - Math.PI / 2;

/** The top-down palette (PlayaWin's private `C`), for the 3D materials. */
export const PALETTE = {
  playa: "#e6d3ae", road: "#efe2c6", block: "#d8c095", blockEdge: "#c6ab7c", outside: "#d4c3a0", navy: "#1b1f3b", pink: "#ff6b9a",
} as const;
