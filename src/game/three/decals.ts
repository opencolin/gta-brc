import * as THREE from "three";
import { ART_PIECES } from "../artpieces";
import { ART_CARS, drawGoldenTicket } from "../artcars";

/**
 * The top-down drawings (art pieces, art cars, the Golden Ticket) reused as textures on flat planes: the same canvas code PlayaWin
 * calls, drawn once into a canvas of its own and again whenever it animates (a flame, a laser, a flapping wing). A decal is laid down
 * with rotation.x = -π/2, so the picture's top (the drawings' nose, -y) points north (-Z) before the mesh's own yaw (PLAN-3D.md 2.4).
 */
export type Drawing = {
  tex: THREE.CanvasTexture;
  /** Draw it again for this time and night level, and tell the GPU. */
  paint(t: number, night: number): void;
  /** The plane's size in feet (width, length) the picture is meant to fill. */
  w: number; l: number;
};

type Draw = (c: CanvasRenderingContext2D, t: number, night: number) => void;

/** A canvas of w×h px drawn with `draw` after translating its origin to the centre and scaling by k px per unit. */
function drawing(wPx: number, hPx: number, k: number, draw: Draw, w: number, l: number): Drawing {
  const c = document.createElement("canvas"); c.width = Math.max(2, Math.round(wPx)); c.height = Math.max(2, Math.round(hPx));
  const ctx = c.getContext("2d")!;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const paint = (t: number, night: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
    ctx.save(); ctx.translate(c.width / 2, c.height / 2); ctx.scale(k, k);
    try { draw(ctx, t, night); } catch { /* a drawing that needs an image not yet loaded draws nothing this time */ }
    ctx.restore();
    tex.needsUpdate = true;
  };
  paint(0, 0);
  return { tex, paint, w, l };
}

/** How far past `r` (as a multiple) each art drawing reaches; seven pass 1.15 (embrace 1.67 ... real-love 1.20), so one number covers them. */
export const PIECE_REACH = 1.7;

/** An art piece's drawing on a 256² canvas: the plane that carries it is 2·reach·r feet square. */
export function pieceDrawing(id: string, r: number): Drawing | null {
  const draw = ART_PIECES[id];
  if (!draw) return null;
  const side = 2 * PIECE_REACH * r;
  return drawing(256, 256, 256 / side, (c, t, n) => draw(c, t, n, r), side, side);
}

/** The drawings' extent in feet (width, length) by art car: 40 × 66 unless said. */
const BIG = new Set(["big-imagination-747", "dragonfly", "el-pulpo-mecanico", "funkadelephant", "hermes", "technogecko", "discow", "luna-the-artcrane"]);
export function roofSize(id: string): { w: number; l: number } {
  if (id === "dragon-lady") return { w: 44, l: 136 };
  if (id === "golden-ticket") return { w: 14, l: 22 };
  return BIG.has(id) ? { w: 66, l: 80 } : { w: 40, l: 66 };
}
const K = 3;   // px per foot

/** An art car's roof, nose up, at 3 px a foot; null when there is no drawing for it. */
export function carRoof(id: string): Drawing | null {
  const { w, l } = roofSize(id);
  const draw: Draw | undefined = id === "golden-ticket" ? (c, t, n) => drawGoldenTicket(c, t, n) : ART_CARS[id];
  return draw ? drawing(w * K, l * K, K, draw, w, l) : null;
}

/** The pink "P" the bays carry, on a transparent 64² canvas. */
export function pTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!;
  x.fillStyle = "#ff6b9a"; x.font = "800 56px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("P", 32, 36);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
