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

/**
 * Agave's Earth dome, seen from above as PlayaWin's drawAgave paints it: oceans lit from the upper left, the land as a polar map of
 * the north (polygons in degrees clockwise from up and fractions of the radius), the ice cap, the dome's struts. It is stretched over
 * the hemisphere by looking straight down on it (agave.ts), so the same picture is what the top-down view shows. Not NASA's Blue Marble
 * (PLAN-3D.md 2.4's first choice): drawn in code, nothing to download.
 */
export function earthTexture(): THREE.CanvasTexture {
  const S = 512, R = S / 2, c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!; x.translate(R, R);
  const sea = x.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R); sea.addColorStop(0, "#5aa0e0"); sea.addColorStop(1, "#1f4f9a");
  x.fillStyle = sea; x.fillRect(-R, -R, S, S);
  const land = (pts: [number, number][], col = "#8db36a") => {
    x.fillStyle = col; x.beginPath();
    pts.forEach(([a, f], i) => { const px = Math.sin((a * Math.PI) / 180) * f * R, py = -Math.cos((a * Math.PI) / 180) * f * R; i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.closePath(); x.fill();
  };
  land([[-150, 0.3], [-125, 0.42], [-118, 0.62], [-110, 0.8], [-96, 0.98], [-84, 1.02], [-74, 0.86], [-66, 0.7], [-58, 0.5], [-72, 0.34], [-100, 0.26], [-130, 0.24]]); // North America
  land([[-90, 1.02], [-80, 0.98], [-78, 1.1], [-92, 1.12]], "#7fa85e"); // South America's shoulder at the rim
  land([[-40, 0.24], [-30, 0.32], [-28, 0.46], [-40, 0.5], [-52, 0.42], [-50, 0.3]], "#eef3f6"); // Greenland
  land([[-5, 0.3], [10, 0.34], [30, 0.44], [55, 0.5], [75, 0.6], [95, 0.74], [110, 0.9], [125, 1.02], [140, 1.02], [150, 0.84], [135, 0.66], [112, 0.56], [90, 0.42], [60, 0.36], [35, 0.3], [15, 0.26], [0, 0.26]]); // Europe and Asia
  land([[5, 0.72], [25, 0.76], [40, 0.9], [38, 1.08], [10, 1.1], [-5, 0.92]], "#c9b36a"); // Africa at the rim
  x.fillStyle = "#f6f9fb"; x.beginPath(); x.arc(0, 0, R * 0.17, 0, Math.PI * 2); x.fill(); // the ice cap
  x.strokeStyle = "rgba(27, 31, 59, .18)"; x.lineWidth = 2; x.beginPath();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; x.moveTo(0, 0); x.lineTo(Math.cos(a) * R, Math.sin(a) * R); }
  for (const f of [0.4, 0.72]) { x.moveTo(R * f, 0); x.arc(0, 0, R * f, 0, Math.PI * 2); }
  x.stroke();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/** The Moon dome from above: grey, lit from the upper left, cratered (drawAgave's circles). */
export function moonTexture(): THREE.CanvasTexture {
  const S = 256, R = S / 2, c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d")!; x.translate(R, R);
  const rock = x.createRadialGradient(-R * 0.35, -R * 0.35, R * 0.1, 0, 0, R); rock.addColorStop(0, "#e8e6e0"); rock.addColorStop(1, "#8d8a84");
  x.fillStyle = rock; x.fillRect(-R, -R, S, S);
  x.fillStyle = "rgba(90, 88, 84, .35)";
  for (const [cx, cy, cr] of [[-0.35, 0.1, 0.22], [0.3, -0.3, 0.16], [0.25, 0.4, 0.12], [-0.1, -0.45, 0.1], [0.55, 0.1, 0.09], [-0.5, -0.5, 0.08]] as const) { x.beginPath(); x.arc(cx * R, cy * R, cr * R, 0, Math.PI * 2); x.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
