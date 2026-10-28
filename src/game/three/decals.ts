import { quality } from "./quality";
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
  const px = quality.touch ? 128 : 256;   // a phone: a quarter of the memory
  return drawing(px, px, px / side, (c, t, n) => draw(c, t, n, r), side, side);
}

/**
 * The drawings' extent in feet (width, length) by art car, measured once from the drawings themselves (artcars.ts, artplatforms.ts): each drawn on
 * a large canvas by day and by night at five times, the box round its opaque pixels, doubled to the larger of |x| and |y| as PLAN-3D.md 2.1 says,
 * plus 2 ft, up to even. Night effects count only up to 30% past the car's day size (a laser sweeping 140 ft is the night's work, not the car's).
 * A roof and its hull are this big; any car with no entry is the usual 40 × 66.
 */
const ROOF: Record<string, [number, number]> = {
  amphora: [34, 72],
  axolotl: [48, 70],
  baaahs: [42, 72],
  "big-imagination-747": [68, 70],
  "bipolar-express": [26, 64],
  blockhaus: [34, 64],
  "celestial-sideshow": [30, 86],
  chelonix: [30, 78],
  "church-of-the-open-mind": [30, 86],
  damavand: [32, 66],
  dancetronauts: [34, 68],
  "disco-doge": [44, 80],
  discow: [44, 110],
  "dont-panic": [34, 64],
  "dr-brainlove": [34, 64],
  "dragon-lady": [42, 134],
  dragonfly: [68, 70],
  "el-pulpo-mecanico": [58, 80],
  "eye-of-horus": [36, 64],
  "favela-art-car": [34, 64],
  funkadelephant: [50, 84],
  "galactic-jungle": [38, 80],
  "golden-gate-art-car": [34, 66],
  "golden-ticket": [16, 24],
  "heart-car": [32, 56],
  "heavy-meta": [38, 86],
  "hels-diner": [30, 86],
  hermes: [52, 72],
  jaguara: [38, 84],
  kalliope: [36, 88],
  "krusty-bunny": [32, 56],
  kuker: [30, 72],
  "lonely-submarine": [32, 78],
  "lucy-s-cargo": [32, 66],
  "luna-the-artcrane": [86, 128],
  maxa: [38, 80],
  "mayan-warrior": [48, 82],
  "mighty-misfits": [38, 80],
  nudibranch: [30, 70],
  "playa-peace-project": [32, 56],
  rexan: [32, 82],
  "robot-heart": [36, 64],
  "smile-high": [34, 64],
  "sol-riser": [32, 66],
  technogecko: [44, 84],
  "the-scarab": [40, 70],
  "the-slug": [28, 80],
  thor: [38, 80],
  "titanics-end": [36, 94],
  tommy: [32, 56],
  treehouse: [38, 80],
  trion: [26, 64],
  unimog: [38, 80],
  "whomp-wagon": [36, 64]
};
/**
 * The solid part of each drawing by day (pixels more than half opaque at t = 0, measured the same way with the same one-off script, as the box round them: x0, x1
 * across and y0, y1 along, feet from the drawing's centre, x to the right and y toward the tail): what the hull under the roof is sized and placed from, so no plain
 * slab shows past the end of the art, and none is missing from the end where the art reaches farthest (Luna's crane is 55 ft of art ahead of its centre and 20 behind).
 * The roof itself is the larger ROOF above, which also holds the lights and steam.
 */
const SOLID: Record<string, [number, number, number, number]> = {
  amphora: [-16, 16, -34, 28.5],
  axolotl: [-19.5, 19.5, -28, 34],
  baaahs: [-20, 17.5, -32, 35],
  "big-imagination-747": [-31.5, 31.5, -33.5, 32],
  "bipolar-express": [-12, 12, -31, 30],
  blockhaus: [-15.5, 15.5, -31, 31],
  "celestial-sideshow": [-13.5, 13.5, -41.5, 31],
  chelonix: [-13, 13, -38, 28.5],
  "church-of-the-open-mind": [-13.5, 13.5, -41.5, 31],
  damavand: [-15, 15, -32, 30],
  dancetronauts: [-15.5, 15.5, -31, 31],
  "disco-doge": [-15.5, 15.5, -30, 28],
  discow: [-16, 16, -41, 37],
  "dont-panic": [-15.5, 15.5, -31, 31],
  "dr-brainlove": [-15.5, 15.5, -31, 31],
  "dragon-lady": [-17, 17, -66, 66],
  dragonfly: [-32, 32, -18, 31],
  "el-pulpo-mecanico": [-27.5, 24.5, -23, 29],
  "eye-of-horus": [-16.5, 16.5, -30.5, 30.5],
  "favela-art-car": [-15.5, 15.5, -31, 31],
  funkadelephant: [-24, 24, -40, 28],
  "galactic-jungle": [-18, 18, -30, 30],
  "golden-gate-art-car": [-15.5, 15.5, -32, 32],
  "golden-ticket": [-6.5, 6.5, -10, 9],
  "heart-car": [-14.5, 14.5, -27, 27],
  "heavy-meta": [-17.5, 17.5, -30, 32],
  "hels-diner": [-13.5, 13.5, -41.5, 31],
  hermes: [-22, 22, -34, 28.5],
  jaguara: [-18, 18, -32, 30],
  kalliope: [-16.5, 16.5, -30.5, 31],
  "krusty-bunny": [-14.5, 14.5, -27, 27],
  kuker: [-13, 13, -34, 28.5],
  "lonely-submarine": [-14.5, 14.5, -30.5, 37],
  "lucy-s-cargo": [-15, 15, -32, 30],
  "luna-the-artcrane": [-14, 14, -55, 20],
  maxa: [-18, 18, -30, 30],
  "mayan-warrior": [-17.5, 17.5, -30, 30],
  "mighty-misfits": [-18, 18, -30, 30],
  nudibranch: [-13.5, 13.5, -34, 33],
  "playa-peace-project": [-14.5, 14.5, -27, 27],
  rexan: [-15, 15, -32, 39.5],
  "robot-heart": [-16.5, 16.5, -31, 31],
  "smile-high": [-15.5, 15.5, -31, 31],
  "sol-riser": [-15, 15, -32, 30],
  technogecko: [-20, 20, -28, 41],
  "the-scarab": [-18.5, 18.5, -34, 30],
  "the-slug": [-12.5, 12.5, -38, 34],
  thor: [-18, 18, -30, 30],
  "titanics-end": [-16.5, 16.5, -42, 30],
  tommy: [-14.5, 14.5, -27, 27],
  treehouse: [-18, 18, -30, 30],
  trion: [-12, 12, -30, 30],
  unimog: [-18, 18, -30, 30],
  "whomp-wagon": [-16.5, 16.5, -31, 31]
};
/** The hull's footprint (width, length) in feet, less a little for the wheels and the shadow's edge, and where its centre is from the car's (cx to the right, cz toward the tail). */
export function hullSize(id: string): { w: number; l: number; cx: number; cz: number } {
  const [x0, x1, y0, y1] = SOLID[id] ?? [-17, 17, -31, 31];
  return { w: Math.max(10, x1 - x0 - 4), l: Math.max(16, y1 - y0 - 2), cx: (x0 + x1) / 2, cz: (y0 + y1) / 2 };
}
export function roofSize(id: string): { w: number; l: number } {
  const [w, l] = ROOF[id] ?? [40, 66];
  return { w, l };
}
const K = 3;   // px per foot

/** An art car's roof, nose up, at `px` pixels a foot (3 unless a model wants it sharper close up, like the yacht's deck); null when there is no drawing for it. */
export function carRoof(id: string, px = K): Drawing | null {
  const { w, l } = roofSize(id);
  const draw: Draw | undefined = id === "golden-ticket" ? (c, t, n) => drawGoldenTicket(c, t, n) : ART_CARS[id];
  if (quality.touch) px *= 2 / 3;   // a phone: 2 pixels a foot where it is 3 (and the yacht's deck 5.3 where it is 8)
  return draw ? drawing(w * px, l * px, px, draw, w, l) : null;
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

/** A dust angel left in the playa, as drawDustAngel paints it (about 68 × 44 ft, its centre at the middle of the canvas): a faint white mark. */
export function angelTexture(): THREE.CanvasTexture {
  const W = 136, H = 88, c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d")!; x.translate(W / 2, 34); x.scale(2, 2);
  x.fillStyle = "rgba(255, 250, 238, .75)";
  x.beginPath(); x.moveTo(-6, -4); x.quadraticCurveTo(-30, -14, -34, 10); x.quadraticCurveTo(-20, 8, -8, 4); x.lineTo(-12, 26); x.lineTo(0, 10); x.lineTo(12, 26); x.lineTo(8, 4); x.quadraticCurveTo(20, 8, 34, 10); x.quadraticCurveTo(30, -14, 6, -4); x.closePath(); x.fill();
  x.beginPath(); x.arc(0, -11, 6, 0, Math.PI * 2); x.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The shadow a plane casts, as drawPlaneShadow paints it on the ground (a wing and a fuselage), on a 64² canvas covering 40 ft; nose up. */
export function planeShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!; x.translate(32, 32); x.scale(1.6, 1.6);
  x.fillStyle = "rgba(27, 31, 59, .22)"; x.beginPath(); x.ellipse(0, 0, 17, 5, 0, 0, Math.PI * 2); x.ellipse(0, 1, 3, 15, 0, 0, Math.PI * 2); x.fill();
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
