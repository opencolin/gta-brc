import type { Game } from "@/lib/playa";
import type { Vec } from "@/lib/brc";
import { VIEW_KEY, type ViewMode } from "@/lib/view3d";

// ViewMode, VIEW_KEY and readViewMode are defined in src/lib/view3d.ts: a lib file never imports from src/game, and the node tests cannot resolve "@/".
export { type ViewMode, VIEW_KEY, readViewMode } from "@/lib/view3d";

/** What the renderer needs besides the game: the canvas size, the trip level, the stick/orbit state and what the HUD covers. */
export type ViewState = {
  w: number; h: number; dpr: number;
  trip: number;            // 0..1, PlayaWin's tripLevel
  orbit: number;           // radians the player has dragged the camera round (0 = straight behind), phase 5
  touchUi: boolean;        // phone layout: the stick and pads are on screen
  brake: boolean;          // input.brake || input.handbrake, for brake lights
  night: number;           // nightLevel(g.dayT), passed so the renderer does not import playa's light code twice
  storm: number;           // stormLevel(g.storm)
};

/** A second way of drawing the same Game: the top-down painter is `paint()` in PlayaWin, the chase camera is src/game/three/. */
export interface Renderer {
  mount(canvas: HTMLCanvasElement): void;
  resize(w: number, h: number, dpr: number): void;
  /** Draw one frame of this game state. Never mutates g. */
  frame(g: Game, view: ViewState, dt: number): void;
  /** World feet (and feet up) → CSS pixels on the canvas, or null when behind the camera. For the clip peek and labels. */
  project(p: Vec, up?: number): { x: number; y: number } | null;
  /** The camera's yaw in the game's heading convention, for the camera-relative stick. */
  yaw(): number;
  dispose(): void;
}

/** Remember the choice on this device. Storage can throw (private windows, blocked site data), so it never matters if it does. */
export function writeViewMode(mode: ViewMode): void {
  try { localStorage.setItem(VIEW_KEY, mode); } catch { /* no memory, still works */ }
}

/** The chase camera needs WebGL 2. */
export function hasWebGL2(): boolean {
  try { return !!document.createElement("canvas").getContext("webgl2"); } catch { return false; }
}
