"use client";
import "./playa.css";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useIsMobile } from "@/lib/mobile";
import { useBoardFocus } from "./useBoardFocus";
import { AmbientVoices, ClipPeek, Lounge, clipsOnly, playable, soundOf, type Now, type Track } from "./PlayaLounge";
import { ART_CARS } from "./artcars";
import { drawAmbulance, drawSuperbike } from "./artplatforms";
import { MAP_BOX, drawCityImage } from "./citymap";
import { AGAVE_IMG } from "@/lib/agave";
import {
  ARC_R, ARCS, CENTER_CAMP, CENTER_CAMP_R, CAFE_R, CITY_SCALE, FENCE, MAN_R, RADIALS, TEMPLE, TEMPLE_R, WIDE_RADIALS,
  addressOf, arcWidth, blockBounds, clockLabel, clockToAngle, polar, radialWidth, type Vec,
} from "@/lib/brc";
import {
  AGAVE, AGAVE_ADDRESS, ART, MUTANTS, NO_INPUT, NPC_R, SPEED_LIMIT_MPH, SPOTS, STOP_R, VEHICLES, VEHICLE_IDS, BASE_RIDES,
  cityPlan, drivenKey, flipDay, hopOff, hopOn, leaveDriven, setDriven, missionTarget, mph, newGame, nextVehicle, nightLevel, npcAt, pagerLine, setVehicle, speedOf, stepGame, stormLevel,
  type Game, type Input, type Npc, type Spot, type VehicleId,
} from "@/lib/playa";
import type { Struct } from "@/lib/camps";
import { TAKEOVER, loudness, nearest, newSticky, stepMix, stepSticky, stopSticky, type Source, type Voice } from "@/lib/playaSound";

/**
 * GTA:BRC — Agave Lounge's art car, driven top-down round Black Rock City the way the first
 * Grand Theft Auto drove its cars. The rules (physics, collisions, the pager's jobs, MOOP,
 * the others on the road, storms, the day) are lib/games/playa.ts on the city in
 * lib/games/brc.ts, both tested; this window is the canvas, the HUD and the controls.
 *
 * One requestAnimationFrame loop steps the game at a fixed 60 Hz and paints a frame; the HUD
 * (address, speed, pager, counters, minimap) re-renders ten times a second. The camera trails
 * the car and looks ahead along its velocity, and pulls back as it speeds up — the approach
 * GTA1 and its remakes use (the look-ahead idea after appleweiping/hotwire-city, MIT; no code
 * taken). Everything is drawn in code: no sprites, no third-party art.
 *
 * Pauses when the window stops being the focused one, is minimised, or the tab hides.
 */

const DT = 1 / 60;
type Phase = "title" | "play" | "paused";

/* ── the palette: Agave's navy, pink and sunset glows on playa dust ─────── */
const C = {
  playa: "#e6d3ae", speck: "#d6c096", road: "#efe2c6", block: "#d8c095", blockEdge: "#c6ab7c",
  navy: "#1b1f3b", pink: "#ff6b9a", coral: "#ff9a8b", sky: "#8ec5fc", lilac: "#e0c3fc", gold: "#ffd27a",
  fence: "#f08a3c", night: "10, 12, 36", dust: "230, 211, 174", white: "#fbf7ef", potty: "#3a6fd8",
};
const KEYS: Record<string, keyof Input> = {
  ArrowUp: "gas", w: "gas", W: "gas", ArrowDown: "brake", s: "brake", S: "brake",
  ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", " ": "handbrake",
};
const hsl = (h: number, s = 85, l = 60, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
/** Clock minutes → a canvas angle (canvas 0 is 3 o'clock, ours is 12). */
const cang = (min: number) => clockToAngle(min) - Math.PI / 2;

/* ── the city's blocks, their outlines laid out once; the camps in them are lib/games/camps.ts ── */
type Block = { ring: number; sector: number; r0: number; r1: number; a0i: number; a1i: number; a0o: number; a1o: number; cx: number; cy: number; br: number; items: readonly Struct[] };
let BLOCKS: Block[] | null = null;
function hash(n: number) { let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b); x ^= x >>> 13; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 4294967296; }
function blocks(): Block[] {
  if (BLOCKS) return BLOCKS;
  const plans = cityPlan();
  const out: Block[] = [];
  for (let ring = 0; ring < ARC_R.length - 1; ring++) {
    for (let sector = 0; sector < RADIALS.length - 1; sector++) {
      const b = blockBounds(ring, sector);
      const A0 = cang(b.m0), A1 = cang(b.m1);
      const rm = (b.r0 + b.r1) / 2, am = (A0 + A1) / 2;
      const len = rm * (A1 - A0), depth = b.r1 - b.r0;
      out.push({
        ring, sector, r0: b.r0, r1: b.r1, a0i: A0 + b.w0 / b.r0, a1i: A1 - b.w1 / b.r0, a0o: A0 + b.w0 / b.r1, a1o: A1 - b.w1 / b.r1,
        cx: Math.cos(am) * rm, cy: Math.sin(am) * rm, br: Math.hypot(len / 2, depth / 2) + 30,
        items: plans[ring * (RADIALS.length - 1) + sector]?.structs ?? [],
      });
    }
  }
  return (BLOCKS = out);
}
function blockPath(ctx: CanvasRenderingContext2D, b: Block) {
  ctx.beginPath();
  ctx.arc(0, 0, b.r0, b.a0i, b.a1i);
  ctx.arc(0, 0, b.r1, b.a1o, b.a0o, true);
  ctx.closePath();
}

/* ── sprites, drawn in code ─────────────────────────────────────────────── */

/**
 * You ride a playa cruiser, as pixel art seen from above: 10 × 24 chunky pixels, front wheel
 * up. Fat tyres, a wicker basket with an agave in it and a headlight, wide swept handlebars,
 * the rider's arms, a straw hat with a pink band, a pink shirt, the saddle, a pink fender and a
 * tail light. Drawn once to a tiny canvas and scaled up unsmoothed; at night the wheels run as
 * rainbow LEDs, pixel by pixel. (Until 2026-10-22 this was a dome-on-wheels art car, too big for
 * the streets once the camera closed in.)
 */
const PX = 1.3, GW = 10, GH = 24;
type Pix = { x: number; y: number };
const SPRITE = (() => {
  const grid: (string | null)[][] = Array.from({ length: GH }, () => Array(GW).fill(null));
  const set = (x: number, y: number, c: string) => { if (x >= 0 && x < GW && y >= 0 && y < GH) grid[y][x] = c; };
  const wheels: Pix[] = [];
  // tyres, front and back
  for (const y0 of [0, 18]) for (let y = y0; y < y0 + 6; y++) for (const x of [4, 5]) { set(x, y, "#1b1f3b"); wheels.push({ x, y }); }
  // the basket on the front, an agave in it, a headlight on its nose
  for (let y = 2; y <= 5; y++) for (let x = 3; x <= 6; x++) set(x, y, (x + y) % 2 ? "#c8945a" : "#a8743e");
  for (const [x, y] of [[3, 1], [4, 0], [5, 0], [6, 1], [4, 2], [5, 2]]) set(x, y, "#3f9c7a");
  for (const x of [4, 5]) set(x, 1, "#2b7a5c");
  set(4, 6, "#ffd36b"); set(5, 6, "#ffd36b");
  // the handlebars, swept back, black grips
  for (let x = 0; x <= 9; x++) set(x, 7, "#c9cbd6");
  set(0, 7, "#1b1f3b"); set(9, 7, "#1b1f3b"); set(1, 8, "#c9cbd6"); set(8, 8, "#c9cbd6");
  // the rider's arms down to the grips
  for (const [x, y] of [[1, 9], [2, 9], [2, 10], [7, 9], [8, 9], [7, 10]]) set(x, y, "#f2c6a0");
  // shoulders and back in a pink shirt
  for (let y = 12; y <= 16; y++) for (let x = 2; x <= 7; x++) if (!(y === 16 && (x === 2 || x === 7))) set(x, y, y === 16 ? "#d94a7f" : "#ff6b9a");
  // the straw hat over the head, a pink band
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const d = Math.hypot(x - 4.5, y - 11.5);
    if (d <= 2.9) set(x, y, d > 1.9 && d <= 2.4 ? "#ff6b9a" : d > 2.4 ? "#d9b25e" : "#ecd08a");
  }
  // the saddle, the frame, the fender and a tail light
  set(4, 17, "#1b1f3b"); set(5, 17, "#1b1f3b");
  set(4, 18, "#ff6b9a"); set(5, 18, "#ff6b9a");
  const tail: Pix[] = [{ x: 4, y: 23 }, { x: 5, y: 23 }];
  for (const p of tail) set(p.x, p.y, "#9b2340");
  return { grid, wheels: wheels.filter((p) => grid[p.y][p.x] === "#1b1f3b"), tail };
})();
let spriteCanvas: HTMLCanvasElement | null = null;
const spriteImage = () => {
  if (spriteCanvas) return spriteCanvas;
  const c = document.createElement("canvas"); c.width = GW; c.height = GH;
  const g = c.getContext("2d")!;
  SPRITE.grid.forEach((row, y) => row.forEach((col, x) => { if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }));
  return (spriteCanvas = c);
};
/**
 * The other bikers, each one their own (asked 2026-10-22): the same 10 × 24 cruiser as yours, built from a
 * look picked by their seed: shirt, skin, what is on their head (a straw hat, hair, a helmet, a cowboy hat,
 * a fur hat, a bandana), what rides in front (a basket of flowers or an agave, a crate, nothing), the frame
 * and fender colours, and sometimes a cape. Built once per look and kept; 48 looks go round the crowd.
 */
const SKINS = ["#f2c6a0", "#e0ac7e", "#c68a5e", "#9a6440", "#6e4528", "#f7d7bd"];
const HAIRS = ["#2b1d14", "#5a3a22", "#c99a4b", "#e8d7a8", "#b5322c", "#7a4fd1", "#2fb3a3", "#ff6b9a"];
const HEADS = ["straw", "hair", "helmet", "cowboy", "fur", "bandana"] as const;
const FRONTS = ["agave", "flowers", "crate", "none", "none"] as const;
const LOOKS = 48;
const riderLook = (seed: number) => {
  const r = (k: number) => hash(seed * 131 + k * 7919);
  const hue = Math.floor(r(1) * 360);
  return {
    shirt: hsl(hue, 70, 62), shade: hsl(hue, 65, 48), skin: SKINS[Math.floor(r(2) * SKINS.length)],
    head: HEADS[Math.floor(r(3) * HEADS.length)], hair: HAIRS[Math.floor(r(4) * HAIRS.length)], hat: hsl(Math.floor(r(5) * 360), 55, 52),
    front: FRONTS[Math.floor(r(6) * FRONTS.length)], frame: hsl(Math.floor(r(7) * 360), 60, 58), cape: r(8) < 0.25 ? hsl(Math.floor(r(9) * 360), 75, 55) : null,
  };
};
const riderCanvases = new Map<number, HTMLCanvasElement>();
function riderImage(seed: number): HTMLCanvasElement {
  const id = Math.abs(Math.floor(seed)) % LOOKS;
  const hit = riderCanvases.get(id);
  if (hit) return hit;
  const L = riderLook(id + 1);
  const c = document.createElement("canvas"); c.width = GW; c.height = GH;
  const g = c.getContext("2d")!;
  const set = (x: number, y: number, col: string) => { if (x >= 0 && x < GW && y >= 0 && y < GH) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } };
  for (const y0 of [0, 18]) for (let y = y0; y < y0 + 6; y++) for (const x of [4, 5]) set(x, y, "#1b1f3b");
  if (L.front === "crate") { for (let y = 2; y <= 5; y++) for (let x = 3; x <= 6; x++) set(x, y, (x === 3 || x === 6 || y === 2 || y === 5) ? "#8a5a2b" : "#b07a42"); }
  else if (L.front !== "none") {
    for (let y = 2; y <= 5; y++) for (let x = 3; x <= 6; x++) set(x, y, (x + y) % 2 ? "#c8945a" : "#a8743e");
    if (L.front === "agave") { for (const [x, y] of [[3, 1], [4, 0], [5, 0], [6, 1], [4, 2], [5, 2]]) set(x, y, "#3f9c7a"); for (const x of [4, 5]) set(x, 1, "#2b7a5c"); }
    else for (const [x, y, col] of [[3, 1, "#ff6b9a"], [5, 0, "#ffd36b"], [6, 2, "#8ec5fc"], [4, 2, "#3f9c7a"], [5, 2, "#3f9c7a"]] as const) set(x, y, col);
  }
  set(4, 6, "#ffd36b"); set(5, 6, "#ffd36b");
  for (let x = 0; x <= 9; x++) set(x, 7, "#c9cbd6");
  set(0, 7, "#1b1f3b"); set(9, 7, "#1b1f3b"); set(1, 8, L.frame); set(8, 8, L.frame);
  for (const [x, y] of [[1, 9], [2, 9], [2, 10], [7, 9], [8, 9], [7, 10]]) set(x, y, L.skin);
  if (L.cape) for (let y = 14; y <= 20; y++) for (let x = 2 - (y > 17 ? 1 : 0); x <= 7 + (y > 17 ? 1 : 0); x++) set(x, y, L.cape);
  for (let y = 12; y <= 16; y++) for (let x = 2; x <= 7; x++) if (!(y === 16 && (x === 2 || x === 7))) set(x, y, y === 16 ? L.shade : L.shirt);
  for (let y = 8; y <= 15; y++) for (let x = 1; x <= 8; x++) {
    const d = Math.hypot(x - 4.5, y - 11.5);
    if (L.head === "straw" && d <= 2.9) set(x, y, d > 1.9 && d <= 2.4 ? L.hat : d > 2.4 ? "#d9b25e" : "#ecd08a");
    else if (L.head === "cowboy" && d <= 3.2) set(x, y, d > 2.6 ? "#6b4423" : d > 1.6 ? "#8a5a2b" : "#a5713a");
    else if (L.head === "fur" && d <= 2.4) set(x, y, (x + y) % 2 ? L.hat : "#ffffff");
    else if (L.head === "helmet" && d <= 2.1) set(x, y, d > 1.4 ? L.hat : "#ffffff");
    else if (L.head === "bandana" && d <= 2) set(x, y, y <= 11 ? L.hat : L.hair);
    else if (L.head === "hair" && d <= 2) set(x, y, L.hair);
  }
  set(4, 17, "#1b1f3b"); set(5, 17, "#1b1f3b");
  set(4, 18, L.frame); set(5, 18, L.frame);
  set(4, 23, "#9b2340"); set(5, 23, "#9b2340");
  riderCanvases.set(id, c);
  return c;
}
/** Another biker on the road, at the size of yours (0.55 of the cruiser's pixel art), lit up at night. */
function drawRider(ctx: CanvasRenderingContext2D, seed: number, hue: number, night: number) {
  const w = GW * PX * 0.55, h = GH * PX * 0.55;
  ctx.fillStyle = "rgba(27, 31, 59, .16)"; ctx.beginPath(); ctx.ellipse(1, 1.5, w * 0.42, h * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(riderImage(seed), -w / 2, -h / 2, w, h);
  ctx.imageSmoothingEnabled = smooth;
  // at night its wheels glow in its colour
  if (night > 0.3) { ctx.fillStyle = hsl(hue, 100, 65); ctx.fillRect(-1, -h / 2, 2, 2.2); ctx.fillRect(-1, h / 2 - 2.2, 2, 2.2); }
}
function drawBikeRide(ctx: CanvasRenderingContext2D, t: number, night: number, brake: boolean) {
  const ox = -(GW * PX) / 2, oy = -(GH * PX) / 2;
  // a soft shadow under the bike, not a box round it
  ctx.fillStyle = "rgba(27, 31, 59, .16)";
  ctx.beginPath(); ctx.ellipse(1.5, 2.5, GW * PX * 0.42, GH * PX * 0.46, 0, 0, Math.PI * 2); ctx.fill();
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spriteImage(), ox, oy, GW * PX, GH * PX);
  ctx.imageSmoothingEnabled = smooth;
  const px = (p: Pix, c: string) => { ctx.fillStyle = c; ctx.fillRect(ox + p.x * PX, oy + p.y * PX, PX, PX); };
  if (night > 0.3) SPRITE.wheels.forEach((p, k) => px(p, hsl((t * 220 + k * 30) % 360, 100, 62)));
  if (brake) SPRITE.tail.forEach((p) => px(p, "#ff2d55"));
}

/**
 * Agave's dome on wheels, as pixel art: 14 × 24 chunky pixels, nose up. A pink deck with navy
 * trim, four fat tyres, a geodesic dome with a disco ball at its crown, two speakers on the
 * back, an agave on the nose, gold headlights and red tail lights. At night the trim runs as
 * rainbow LEDs and the disco ball spins colours. (The player's ride until 2026-10-22, back
 * as a ride to switch to, at three quarters of its old size so it fits the streets.)
 */
const DPX = 1.5, DW = 14, DH = 24;
const DOME_CAR = (() => {
  const grid: (string | null)[][] = Array.from({ length: DH }, () => Array(DW).fill(null));
  const set = (x: number, y: number, c: string) => { if (x >= 0 && x < DW && y >= 0 && y < DH) grid[y][x] = c; };
  const inBody = (x: number, y: number) => x >= 1 && x <= 12 && y >= 2 && y <= 22 && !((x === 1 || x === 12) && (y === 2 || y === 22));
  for (const y of [4, 5, 6, 7, 16, 17, 18, 19]) { set(0, y, "#1b1f3b"); set(13, y, "#1b1f3b"); }
  for (const y of [5, 17]) { set(0, y, "#4a4f6e"); set(13, y, "#4a4f6e"); }
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) if (inBody(x, y)) set(x, y, y >= 20 ? "#d94a7f" : "#ff6b9a");
  for (let y = 3; y < 20; y++) set(2, y, "#ff8fb3");
  const trim: Pix[] = [];
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
    if (!inBody(x, y)) continue;
    if (!inBody(x - 1, y) || !inBody(x + 1, y) || !inBody(x, y - 1) || !inBody(x, y + 1)) { set(x, y, "#1b1f3b"); trim.push({ x, y }); }
  }
  const cx = 6.5, cy = 12.5, R = 5.4;
  const ball: Pix[] = [];
  for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
    const d = Math.hypot(x - cx, y - cy);
    if (d > R) continue;
    if (d > R - 1) set(x, y, "#6a5acd");
    else if ((x + y) % 3 === 0 || (x - y + 30) % 3 === 0) set(x, y, "#c9a7f5");
    else set(x, y, y < cy ? "#ffffff" : "#ece4ff");
  }
  for (const [x, y] of [[6, 12], [7, 12], [6, 13], [7, 13]]) { set(x, y, "#c9cbd6"); ball.push({ x, y }); }
  for (const x0 of [3, 8]) for (let dx = 0; dx < 3; dx++) for (let dy = 0; dy < 2; dy++) set(x0 + dx, 19 + dy, "#1b1f3b");
  set(4, 19, "#ff6b9a"); set(9, 19, "#ff6b9a");
  for (const [x, y] of [[4, 0], [6, 0], [7, 0], [9, 0], [3, 1], [5, 1], [8, 1], [10, 1]]) set(x, y, "#3f9c7a");
  for (const [x, y] of [[6, 1], [7, 1], [5, 2], [6, 2], [7, 2], [8, 2]]) set(x, y, "#2b7a5c");
  for (const x of [2, 3, 10, 11]) set(x, 2, "#ffd36b");
  const tail: Pix[] = [2, 3, 10, 11].map((x) => ({ x, y: 22 }));
  for (const p of tail) set(p.x, p.y, "#9b2340");
  return { grid, trim, ball, tail };
})();
let domeCanvas: HTMLCanvasElement | null = null;
const domeImage = () => {
  if (domeCanvas) return domeCanvas;
  const c = document.createElement("canvas"); c.width = DW; c.height = DH;
  const g = c.getContext("2d")!;
  DOME_CAR.grid.forEach((row, y) => row.forEach((col, x) => { if (col) { g.fillStyle = col; g.fillRect(x, y, 1, 1); } }));
  return (domeCanvas = c);
};
function drawDomeCar(ctx: CanvasRenderingContext2D, t: number, night: number, brake: boolean) {
  const ox = -(DW * DPX) / 2, oy = -(DH * DPX) / 2;
  ctx.fillStyle = "rgba(27, 31, 59, .22)"; ctx.fillRect(ox + 2, oy + 3, DW * DPX, DH * DPX);
  const smooth = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(domeImage(), ox, oy, DW * DPX, DH * DPX);
  ctx.imageSmoothingEnabled = smooth;
  const px = (p: Pix, c: string) => { ctx.fillStyle = c; ctx.fillRect(ox + p.x * DPX, oy + p.y * DPX, DPX, DPX); };
  if (night > 0.3) {
    DOME_CAR.trim.forEach((p, k) => px(p, hsl((t * 160 + k * 14) % 360, 100, 62)));
    DOME_CAR.ball.forEach((p, k) => px(p, hsl((t * 300 + k * 90) % 360, 100, 78)));
  }
  if (brake) DOME_CAR.tail.forEach((p) => px(p, "#ff2d55"));
}
/** The unicycle, from above: the wheel under a rider in a pink shirt and a straw hat. */
function drawUnicycle(ctx: CanvasRenderingContext2D, t: number, night: number) {
  ctx.fillStyle = night > 0.3 ? hsl((t * 200) % 360, 100, 62) : C.navy; ctx.fillRect(-1.5, -6, 3, 12);
  ctx.fillStyle = "#f2c6a0"; ctx.fillRect(-5, -1.5, 10, 3);
  ctx.fillStyle = C.pink; ctx.beginPath(); ctx.ellipse(0, 0, 3.6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#ecd08a"; ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
}
/** The famous art car you are driving, if that is your ride (PlayaWin's garage). */
let rideSkin: string | null = null;
/** Whatever you ride, nose up. */
function drawRide(ctx: CanvasRenderingContext2D, id: VehicleId, t: number, night: number, brake: boolean) {
  if (id === "found" && rideSkin && ART_CARS[rideSkin]) ART_CARS[rideSkin](ctx, t, night); // full size: it is the art car itself
  else if (id === "artcar" || id === "found") drawDomeCar(ctx, t, night, brake);
  else if (id === "fish") drawCuttlefish(ctx, t, night);
  else if (id === "unicycle") drawUnicycle(ctx, t, night);
  // the bikes at 0.55: about the size of the others on the road (asked 2026-10-22)
  else if (id === "ebike") { ctx.scale(0.55, 0.55); drawEBike(ctx, t, night, brake); }
  else { ctx.scale(0.55, 0.55); drawBikeRide(ctx, t, night, brake); }
}
/** The e-bike: the cruiser with a battery pack behind the saddle and an electric-blue glow. */
function drawEBike(ctx: CanvasRenderingContext2D, t: number, night: number, brake: boolean) {
  ctx.save();
  ctx.shadowColor = "#5ee7ff"; ctx.shadowBlur = 6 + 3 * Math.sin(t * 6) + 6 * night;
  drawBikeRide(ctx, t, night, brake);
  ctx.restore();
  // the battery: a navy pack with a cyan charge bar and a little bolt
  ctx.fillStyle = "#1b1f3b"; ctx.fillRect(-3.4, 6.5, 6.8, 5.2);
  ctx.fillStyle = "#5ee7ff"; ctx.fillRect(-2.4, 7.4, 4.8, 1.4);
  ctx.fillStyle = "#ffd36b";
  ctx.beginPath(); ctx.moveTo(0.6, 8.9); ctx.lineTo(-1, 10.7); ctx.lineTo(0, 10.7); ctx.lineTo(-0.6, 12.1); ctx.lineTo(1.2, 10.1); ctx.lineTo(0.2, 10.1); ctx.closePath(); ctx.fill();
}

/** Another art car: a fish, in its own colour, its outline lit as EL wire at night. */
function drawFish(ctx: CanvasRenderingContext2D, hue: number, t: number, night: number) {
  const L = NPC_R.artcar;
  ctx.fillStyle = hsl(hue, 70, 62);
  ctx.beginPath(); ctx.ellipse(0, -2, L * 0.48, L * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, L * 0.6); ctx.lineTo(-L * 0.45, L * 1.05 + Math.sin(t * 6) * 2); ctx.lineTo(L * 0.45, L * 1.05 - Math.sin(t * 6) * 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = night > 0.3 ? hsl(hue, 100, 72) : "rgba(27, 31, 59, .6)"; ctx.lineWidth = night > 0.3 ? 2.5 : 1.2;
  ctx.beginPath(); ctx.ellipse(0, -2, L * 0.48, L * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = C.navy; ctx.beginPath(); ctx.arc(-L * 0.22, -L * 0.5, 2, 0, Math.PI * 2); ctx.arc(L * 0.22, -L * 0.5, 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = hsl((hue + 140) % 360, 70, 55); ctx.lineWidth = 2;
  ctx.beginPath(); for (let k = -1; k <= 1; k++) { ctx.moveTo(-L * 0.3, k * 6); ctx.quadraticCurveTo(0, k * 6 + 4, L * 0.3, k * 6); } ctx.stroke();
}

/**
 * The cuttlefish (asked 2026-10-22), from above, nose up: a mantle edged all round by a rippling fin, a head
 * with two eyes and their W-shaped pupils, eight arms gathered in front and swaying, two longer tentacles,
 * and waves of colour rolling back over its skin the way a cuttlefish's do, brighter at night.
 */
function drawCuttlefish(ctx: CanvasRenderingContext2D, t: number, night: number) {
  const hue = (320 + Math.sin(t * 0.7) * 40 + 360) % 360, lit = night > 0.3 ? 12 : 0;
  // the fin: a soft frill rippling down both sides of the mantle
  ctx.fillStyle = hsl((hue + 30) % 360, 70, 72 + lit, 0.75);
  ctx.beginPath();
  for (let k = 0; k <= 24; k++) { const y = -10 + k * 1.15, w = 11 * Math.sqrt(Math.max(0, 1 - ((y - 3) / 15) ** 2)) + 2.6 + Math.sin(t * 9 - k * 0.9) * 1.1; ctx.lineTo(w, y); }
  for (let k = 24; k >= 0; k--) { const y = -10 + k * 1.15, w = 11 * Math.sqrt(Math.max(0, 1 - ((y - 3) / 15) ** 2)) + 2.6 + Math.sin(t * 9 - k * 0.9 + Math.PI) * 1.1; ctx.lineTo(-w, y); }
  ctx.closePath(); ctx.fill();
  // the mantle, and the colour rolling over it
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0, 3, 10, 15, 0, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = hsl(hue, 65, 55 + lit); ctx.fill();
  ctx.clip();
  for (let y = -12; y < 18; y += 3) {
    const a = 0.5 + 0.5 * Math.sin(t * 4 - y * 0.45);
    ctx.fillStyle = hsl((hue + 200) % 360, 55, 38 + lit, a * 0.55);
    ctx.beginPath(); ctx.ellipse(0, y, 10, 1.1 + a, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = hsl((hue + 40) % 360, 80, 82, 0.6);
  for (let k = 0; k < 7; k++) ctx.fillRect(-5 + (k % 3) * 4.2, -6 + k * 3.1, 1.4, 1.4);
  ctx.restore();
  ctx.strokeStyle = night > 0.3 ? hsl(hue, 100, 75) : "rgba(27, 31, 59, .55)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 3, 10, 15, 0, 0, Math.PI * 2); ctx.stroke();
  // the head, its eyes with W pupils
  ctx.fillStyle = hsl(hue, 60, 60 + lit);
  ctx.beginPath(); ctx.ellipse(0, -13, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
  for (const sx of [-1, 1]) {
    ctx.fillStyle = "#f6e7a8"; ctx.beginPath(); ctx.ellipse(sx * 5.4, -13.5, 2.4, 2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.navy; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(sx * 5.4 - 1.6, -14.2); ctx.lineTo(sx * 5.4 - 0.8, -12.8); ctx.lineTo(sx * 5.4, -13.8); ctx.lineTo(sx * 5.4 + 0.8, -12.8); ctx.lineTo(sx * 5.4 + 1.6, -14.2); ctx.stroke();
  }
  // eight arms, swaying, and two longer tentacles
  ctx.lineCap = "round";
  for (let k = 0; k < 8; k++) {
    const x0 = -3.5 + k, sway = Math.sin(t * 5 + k * 0.8) * 1.6;
    ctx.strokeStyle = hsl((hue + 10) % 360, 60, 50 + lit); ctx.lineWidth = 1.5 - Math.abs(k - 3.5) * 0.12;
    ctx.beginPath(); ctx.moveTo(x0, -16.5); ctx.quadraticCurveTo(x0 * 0.6 + sway, -21, x0 * 0.35 + sway * 1.4, -24.5); ctx.stroke();
  }
  ctx.strokeStyle = hsl((hue + 20) % 360, 55, 62 + lit); ctx.lineWidth = 0.9;
  for (const sx of [-1, 1]) { const sway = Math.sin(t * 3.5 + sx) * 2; ctx.beginPath(); ctx.moveTo(sx * 1.5, -17); ctx.quadraticCurveTo(sx * 3 + sway, -24, sx * 1.2 + sway, -29); ctx.stroke(); }
  ctx.lineCap = "butt";
}

/** A bike and its rider. */
/** Someone on foot, seen from above: shoulders in a costume colour, a hat, arms swinging as they walk; an LED at night. */
function drawWalker(ctx: CanvasRenderingContext2D, hue: number, t: number, night: number) {
  const sw = Math.sin(t * 6 + hue) * 2;
  ctx.fillStyle = "#f2c6a0";
  ctx.fillRect(-5, -1 + sw, 2, 3); ctx.fillRect(3, -1 - sw, 2, 3);
  ctx.fillStyle = hsl(hue, 70, night > 0.3 ? 60 : 55);
  ctx.beginPath(); ctx.ellipse(0, 0.5, 4.2, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hsl((hue + 40) % 360, 50, 75);
  ctx.beginPath(); ctx.arc(0, 0, 2.3, 0, Math.PI * 2); ctx.fill();
  if (night > 0.3) { ctx.fillStyle = hsl((hue + t * 120) % 360, 100, 65); ctx.fillRect(-0.8, -0.8, 1.6, 1.6); }
}

/** One thing in a camp (lib/games/camps.ts): `w` along × `l` deep, turned to `rot`. */
function drawStruct(ctx: CanvasRenderingContext2D, it: Struct, night: number, z: number, font: string) {
  const hw = it.w / 2, hl = it.l / 2;
  ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot);
  switch (it.kind) {
    case "tent":
      ctx.fillStyle = hsl(it.hue, 45, 58); ctx.fillRect(-hw, -hl, it.w, it.l);
      ctx.strokeStyle = "rgba(27, 31, 59, .35)"; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0); ctx.stroke();
      break;
    case "pod":
      ctx.fillStyle = "#e3e6ec"; ctx.fillRect(-hw, -hl, it.w, it.l);
      ctx.strokeStyle = "#9aa1b3"; ctx.lineWidth = 1; ctx.strokeRect(-hw, -hl, it.w, it.l);
      ctx.beginPath(); ctx.moveTo(-hw, -hl); ctx.lineTo(hw, hl); ctx.moveTo(hw, -hl); ctx.lineTo(-hw, hl); ctx.stroke();
      break;
    case "shade":
      ctx.fillStyle = "rgba(250, 250, 245, .9)"; ctx.fillRect(-hw, -hl, it.w, it.l);
      ctx.strokeStyle = hsl(it.hue, 60, 55); ctx.lineWidth = 2; ctx.beginPath(); for (let x = -hw + 6; x < hw; x += 9) { ctx.moveTo(x, -hl); ctx.lineTo(x, hl); } ctx.stroke();
      break;
    case "canopy":
      ctx.fillStyle = "rgba(252, 250, 244, .55)"; ctx.fillRect(-hw, -hl, it.w, it.l);
      ctx.strokeStyle = hsl(it.hue, 55, 50, 0.8); ctx.lineWidth = 2; ctx.strokeRect(-hw, -hl, it.w, it.l);
      ctx.fillStyle = "#6b5a44"; for (const [x, y] of [[-hw, -hl], [hw, -hl], [-hw, hl], [hw, hl], [0, -hl], [0, hl]]) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      break;
    case "carpet":
      ctx.fillStyle = hsl(it.hue, 55, 42, 0.85); ctx.fillRect(-hw, -hl, it.w, it.l);
      ctx.strokeStyle = hsl((it.hue + 40) % 360, 70, 70, 0.9); ctx.lineWidth = 1.5; ctx.strokeRect(-hw + 2, -hl + 2, it.w - 4, it.l - 4);
      break;
    case "couch":
      ctx.fillStyle = hsl(it.hue, 45, 38); ctx.fillRect(-hw, -hl, it.w, it.l);
      break;
    case "dome": {
      const r = hw;
      ctx.fillStyle = "#f4efe6"; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = hsl(it.hue, 35, 52); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath();
      const n = r > 20 ? 8 : 5;
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      if (r > 14) for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, b = ((k + 1) / n) * Math.PI * 2; ctx.moveTo(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55); ctx.lineTo(Math.cos(b) * r * 0.55, Math.sin(b) * r * 0.55); }
      ctx.stroke();
      break;
    }
    case "stage":
      ctx.fillStyle = C.navy; ctx.fillRect(-hw, -hl, it.w, it.l);
      ctx.fillStyle = night > 0.3 ? hsl(it.hue, 100, 62) : hsl(it.hue, 70, 58); ctx.fillRect(-hw, hl - 3, it.w, 3);
      break;
    case "speaker":
      ctx.fillStyle = "#14172c"; ctx.fillRect(-hw, -hl, it.w, it.l);
      ctx.fillStyle = "#4a4f6e"; ctx.beginPath(); ctx.arc(0, 0, hw * 0.6, 0, Math.PI * 2); ctx.fill();
      break;
    case "rack":
      ctx.strokeStyle = "#8a8fa3"; ctx.lineWidth = 1.5; ctx.strokeRect(-hw, -hl, it.w, it.l);
      ctx.beginPath(); for (let x = -hw + 3; x < hw; x += 4) { ctx.moveTo(x, -hl - 2); ctx.lineTo(x, hl + 2); } ctx.stroke();
      break;
    case "flag":
      ctx.fillStyle = "#5b4a35"; ctx.fillRect(-1, -1, 2, 2);
      ctx.fillStyle = hsl(it.hue, 85, 58); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(9, 3); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill();
      break;
    case "arch":
      ctx.fillStyle = night > 0.3 ? hsl(it.hue, 100, 66) : hsl(it.hue, 60, 55); ctx.fillRect(-hw, -hl, it.w, it.l);
      break;
    case "potty":
      ctx.fillStyle = C.potty; ctx.fillRect(-hw, -hl, it.w, it.l); ctx.fillStyle = "#ffffff"; ctx.fillRect(-1, -3, 2, 2);
      break;
    case "sign":
      ctx.fillStyle = "#8a6d45"; ctx.fillRect(-hw, -hl, it.w, it.l);
      if (it.label && z > 0.9) {
        if (Math.cos(it.rot) < 0) ctx.rotate(Math.PI); // never upside down on screen
        ctx.fillStyle = "#fbf3e2"; ctx.font = `600 ${Math.min(5, 34 / it.label.length * 1.6)}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(it.label, 0, 0, it.w - 2);
      }
      break;
  }
  ctx.restore();
}

/** A sound camp's spot: the parking bay cut into its block (a pink carpet with a P), and its stage behind. */
function bayPath(ctx: CanvasRenderingContext2D, sp: Spot) {
  const b = sp.bay;
  const a = (r: number, sg: number) => cang(b.min) + (sg * b.half) / r;
  ctx.beginPath(); ctx.arc(0, 0, b.r0, a(b.r0, -1), a(b.r0, 1)); ctx.arc(0, 0, b.r1, a(b.r1, 1), a(b.r1, -1), true); ctx.closePath();
}
function drawBay(ctx: CanvasRenderingContext2D, sp: Spot, z: number, font: string, parked: boolean, t: number) {
  bayPath(ctx, sp);
  ctx.fillStyle = sp.kind === "fence" || sp.kind === "art" ? "rgba(255, 107, 154, .18)" : C.road; ctx.fill();
  ctx.fillStyle = "rgba(255, 107, 154, .22)"; ctx.fill();
  ctx.strokeStyle = parked ? hsl((t * 90) % 360, 100, 62) : C.pink; ctx.lineWidth = 3; ctx.setLineDash([10, 6]); ctx.stroke(); ctx.setLineDash([]);
  ctx.save(); ctx.translate(sp.mid.x, sp.mid.y);
  ctx.fillStyle = C.pink; ctx.font = `800 ${Math.max(22, 16 / z)}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("P", 0, 0);
  ctx.restore();
}
function drawStage(ctx: CanvasRenderingContext2D, sp: Spot, t: number, night: number) {
  const r = sp.stage.r;
  ctx.save(); ctx.translate(sp.stage.x, sp.stage.y); ctx.rotate(Math.atan2(sp.mid.y - sp.stage.y, sp.mid.x - sp.stage.x) - Math.PI / 2); // facing the bay
  if (sp.kind === "art") {
    // an art piece with its own music: a glowing standing stone in its colour, its light pulsing at night
    ctx.fillStyle = hsl(sp.hue, 75, night > 0.3 ? 62 : 55); ctx.strokeStyle = C.navy; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.7, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.7, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = night > 0.3 ? hsl((sp.hue + t * 90) % 360, 100, 75) : C.white; ctx.beginPath(); ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2); ctx.fill();
  } else if (sp.kind === "fence") {
    // a little pyramid stage
    ctx.fillStyle = "#2a2440"; ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r, r * 0.8); ctx.lineTo(-r, r * 0.8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = night > 0.3 ? hsl((t * 120) % 360, 100, 65) : C.gold; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(0, r * 0.8); ctx.stroke();
  } else {
    // a round stage, its deck in the camp's colour, two stacks of speakers facing the bay
    ctx.fillStyle = C.navy; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hsl(sp.hue, 70, night > 0.3 ? 60 : 52); ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = night > 0.3 ? hsl((sp.hue + t * 80) % 360, 100, 70) : C.white; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#0f1124";
    for (const sx of [-1, 1]) { ctx.fillRect(sx * r * 0.62 - 6, r * 0.35, 12, 12); }
    ctx.fillStyle = "#4a4f6e";
    for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(sx * r * 0.62, r * 0.35 + 6, 3.5, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0, -r * 0.1, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** A famous art car: a long body in its colour with a mark of its own, its name lit at night. */
function drawMutant(ctx: CanvasRenderingContext2D, n: Npc, t: number, night: number) {
  const R = NPC_R.mutant;
  // a famous one, drawn in full (artcars.ts)
  const art = ART_CARS[(n.key ?? "").slice((n.key ?? "").indexOf(":") + 1)];
  if (art) { ctx.fillStyle = "rgba(27, 31, 59, .18)"; ctx.beginPath(); ctx.ellipse(3, 4, 16, 33, 0, 0, Math.PI * 2); ctx.fill(); art(ctx, t, night); return; }
  ctx.fillStyle = "rgba(27, 31, 59, .25)"; ctx.fillRect(-R * 0.5 + 3, -R + 4, R, R * 2);
  ctx.fillStyle = hsl(n.hue, 55, 40); ctx.beginPath(); ctx.roundRect(-R * 0.5, -R, R, R * 2, 8); ctx.fill();
  ctx.strokeStyle = night > 0.3 ? hsl((n.hue + t * 60) % 360, 100, 70) : C.navy; ctx.lineWidth = night > 0.3 ? 3 : 1.5; ctx.stroke();
  const k = n.key ?? "";
  if (k.endsWith("robot-heart")) {
    ctx.fillStyle = night > 0.3 ? `hsla(350, 100%, ${55 + 15 * Math.sin(t * 7)}%, 1)` : "#e0304e";
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.bezierCurveTo(-18, -4, -10, -20, 0, -9); ctx.bezierCurveTo(10, -20, 18, -4, 0, 10); ctx.fill();
  } else if (k.endsWith("titanics-end")) {
    ctx.fillStyle = "#eef6fb"; ctx.beginPath(); ctx.moveTo(-R * 0.45, R * 0.7); ctx.lineTo(0, -R * 0.6); ctx.lineTo(R * 0.45, R * 0.7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1b1f3b"; ctx.fillRect(-5, -R * 0.9, 10, 16);
  } else if (k.endsWith("mayan-warrior")) {
    ctx.fillStyle = "#3fd6a8"; ctx.fillRect(-9, -14, 18, 28);
    ctx.fillStyle = C.gold; ctx.fillRect(-5, -8, 10, 6);
  } else {
    ctx.fillStyle = "#f2f2f8"; ctx.beginPath(); ctx.moveTo(0, -R * 0.95); ctx.lineTo(9, -R * 0.4); ctx.lineTo(9, R * 0.6); ctx.lineTo(-9, R * 0.6); ctx.lineTo(-9, -R * 0.4); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ff8a3c"; ctx.fillRect(-6, R * 0.6, 12, 6 + 3 * Math.sin(t * 20));
  }
}

/** The Man: a figure on its base; lit neon at night. */
function drawMan(ctx: CanvasRenderingContext2D, night: number) {
  ctx.fillStyle = "#c8b48c"; ctx.beginPath(); ctx.arc(0, 0, MAN_R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#a88f62"; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = night > 0.3 ? "#7df9ff" : C.navy; ctx.lineWidth = 5; ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -30); ctx.lineTo(0, 12); // body
  ctx.moveTo(0, 12); ctx.lineTo(-14, 34); ctx.moveTo(0, 12); ctx.lineTo(14, 34); // legs
  ctx.moveTo(0, -18); ctx.lineTo(-22, -40); ctx.moveTo(0, -18); ctx.lineTo(22, -40); // arms up
  ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -36, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.lineCap = "butt";
}
function drawTemple(ctx: CanvasRenderingContext2D) {
  ctx.save(); ctx.translate(TEMPLE.x, TEMPLE.y);
  ctx.fillStyle = "#d7c29a";
  ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + Math.PI / 8; ctx.lineTo(Math.cos(a) * TEMPLE_R, Math.sin(a) * TEMPLE_R); } ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#8a6d45"; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * TEMPLE_R * 0.8, Math.sin(a) * TEMPLE_R * 0.8); } ctx.stroke();
  ctx.fillStyle = "#f6ead2"; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.restore();
}
function drawArt(ctx: CanvasRenderingContext2D, a: (typeof ART)[number], t: number) {
  ctx.save(); ctx.translate(a.x, a.y);
  ctx.fillStyle = "rgba(120, 95, 60, .25)"; ctx.beginPath(); ctx.arc(4, 6, a.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hsl(a.hue, 55, 62); ctx.strokeStyle = hsl(a.hue, 60, 35); ctx.lineWidth = 2;
  ctx.beginPath();
  const n = 5 + (a.hue % 4);
  for (let k = 0; k <= n * 2; k++) { const r = k % 2 ? a.r * 0.55 : a.r; const ang = (k / (n * 2)) * Math.PI * 2 + t * 0.15; ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0, 0, a.r * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawAgave(ctx: CanvasRenderingContext2D, t: number, night: number) {
  const d = AGAVE.dome;
  ctx.save(); ctx.translate(d.x, d.y);
  ctx.fillStyle = "rgba(255, 107, 154, .18)"; ctx.beginPath(); ctx.arc(0, 0, d.r + 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.white; ctx.beginPath(); ctx.arc(0, 0, d.r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = night > 0.3 ? hsl((t * 90) % 360, 100, 65) : C.pink; ctx.lineWidth = 3; ctx.stroke();
  ctx.strokeStyle = "rgba(27, 31, 59, .45)"; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * d.r, Math.sin(a) * d.r); }
  for (const f of [0.4, 0.72]) for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, b = ((k + 1) / 10) * Math.PI * 2; ctx.moveTo(Math.cos(a) * d.r * f, Math.sin(a) * d.r * f); ctx.lineTo(Math.cos(b) * d.r * f, Math.sin(b) * d.r * f); }
  ctx.stroke();
  ctx.fillStyle = C.pink; ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/* ── the minimap: the whole city inside its fence ───────────────────────── */
const MAP_H = MAP_BOX;
/** The big map's zoom and the city point at its middle (asked 2026-10-22); null while drawing the minimap. */
type MapView = { z: number; cx: number; cy: number; /** keep you in the middle as you drive (asked 2026-10-22); a drag or "all" lets go */ follow?: boolean };
let mapView: MapView | null = null;
const MAP_MID = () => (MAP_H.top + MAP_H.bottom) / 2;
function mapFit(w: number, h: number) {
  const s0 = Math.min(w / (2 * MAP_H.half), h / (MAP_H.bottom - MAP_H.top));
  const v = mapView ?? { z: 1, cx: 0, cy: MAP_MID() }, s = s0 * v.z;
  return { s, ox: w / 2 - v.cx * s, oy: h / 2 - v.cy * s };
}
function drawCity(ctx: CanvasRenderingContext2D, w: number, h: number, labels: boolean) {
  const { s, ox, oy } = mapFit(w, h);
  ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s);
  // the city as the satellite photos show it, painted once (citymap.ts); the plain plan if there is no canvas
  if (!drawCityImage(ctx)) {
    ctx.fillStyle = C.playa; ctx.beginPath(); FENCE.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C.fence; ctx.lineWidth = 2 / s; ctx.stroke();
    ctx.fillStyle = C.blockEdge;
    for (const b of blocks()) { blockPath(ctx, b); ctx.fill(); }
    ctx.fillStyle = C.playa; ctx.beginPath(); ctx.arc(CENTER_CAMP.x, CENTER_CAMP.y, CENTER_CAMP_R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.blockEdge; ctx.beginPath(); ctx.arc(CENTER_CAMP.x, CENTER_CAMP.y, CAFE_R * 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.navy; ctx.beginPath(); ctx.arc(0, 0, 240, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(TEMPLE.x, TEMPLE.y, 240, 0, Math.PI * 2); ctx.fill();
  }
  // the sound camps: gold dots (the fence stage too)
  ctx.fillStyle = C.gold; ctx.strokeStyle = C.navy; ctx.lineWidth = 40;
  for (const sp of SPOTS) if (sp.kind !== "agave") { ctx.beginPath(); ctx.arc(sp.stage.x, sp.stage.y, labels ? 110 : 170, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = C.pink; ctx.strokeStyle = C.white; ctx.lineWidth = 80; ctx.beginPath(); ctx.arc(AGAVE.dome.x, AGAVE.dome.y, labels ? 300 : 460, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // the major art on the open playa: a diamond each in its own colour, named on the full map
  ctx.strokeStyle = C.navy; ctx.lineWidth = 30;
  for (const a of ART) {
    const d = labels ? 150 : 230;
    ctx.fillStyle = hsl(a.hue, 85, 60);
    ctx.beginPath(); ctx.moveTo(a.x, a.y - d); ctx.lineTo(a.x + d, a.y); ctx.lineTo(a.x, a.y + d); ctx.lineTo(a.x - d, a.y); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  if (labels) {
    ctx.fillStyle = C.navy; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.font = `500 ${11 / s}px system-ui, sans-serif`;
    for (const a of ART) ctx.fillText(a.name.replace(/^the /, ""), a.x, a.y + 200);
  }
  if (labels) {
    ctx.fillStyle = C.navy; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.font = `600 ${13 / s}px system-ui, sans-serif`;
    for (const m of [120, 180, 240, 300, 360, 420, 480, 540, 600]) { const p = polar(m, ARC_R.at(-1)! + 420); ctx.fillText(clockLabel(m), p.x, p.y); }
    ctx.fillText("the Man", 0, 520); ctx.fillText("the Temple", TEMPLE.x, TEMPLE.y - 520); ctx.fillText("Center Camp", CENTER_CAMP.x, CENTER_CAMP.y - 780);
    ctx.font = `700 ${13 / s}px system-ui, sans-serif`;
    ctx.fillStyle = "#b83a66"; ctx.fillText("Agave Lounge", AGAVE.dome.x - 750, AGAVE.dome.y + 620);
    ctx.font = `500 ${12 / s}px system-ui, sans-serif`; ctx.fillStyle = C.navy;
    for (const i of [0, 4, 8, 12]) { const p = polar(605 + 12, ARC_R[i]); ctx.fillText(ARCS[i] === "Esplanade" ? "Esp" : ARCS[i], p.x, p.y); }
  }
  ctx.restore();
  if (labels) drawSpotLabels(ctx, w, h);
}
/**
 * The full map's camp names, in screen pixels: each tries below, above, right and left of its
 * dot and is drawn only where it overlaps nothing already placed (the city's own labels
 * included), so a cluster shows a few names and the rest come up on hover or a tap (mapSpotAt).
 */
function drawSpotLabels(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const { s, ox, oy } = mapFit(w, h);
  const at = (p: Vec) => ({ x: ox + p.x * s, y: oy + p.y * s });
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const box = (x: number, y: number, bw: number, bh: number): Box => ({ x0: x - bw / 2, y0: y - bh / 2, x1: x + bw / 2, y1: y + bh / 2 });
  const hit = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
  // keep clear of the city's own labels and every dot
  const taken: Box[] = [];
  const fixed: [Vec, string][] = [[{ x: 0, y: 520 }, "the Man"], [{ x: TEMPLE.x, y: TEMPLE.y - 520 }, "the Temple"], [{ x: CENTER_CAMP.x, y: CENTER_CAMP.y - 780 }, "Center Camp"], [{ x: AGAVE.dome.x - 750, y: AGAVE.dome.y + 620 }, "Agave Lounge"]];
  ctx.font = "600 13px system-ui, sans-serif";
  for (const [p, t] of fixed) { const q = at(p); taken.push(box(q.x, q.y, ctx.measureText(t).width + 6, 16)); }
  for (const m of [120, 180, 240, 300, 360, 420, 480, 540, 600]) { const q = at(polar(m, ARC_R.at(-1)! + 420)); taken.push(box(q.x, q.y, 34, 16)); }
  for (const sp of SPOTS) { const q = at(sp.stage); taken.push(box(q.x, q.y, 7, 7)); }
  ctx.font = "500 10px system-ui, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (const sp of SPOTS) {
    if (sp.kind === "agave") continue;
    const q = at(sp.stage), tw = ctx.measureText(sp.name).width + 6;
    for (const [dx, dy] of [[0, 10], [0, -10], [tw / 2 + 6, 0], [-tw / 2 - 6, 0]]) {
      const b = box(q.x + dx, q.y + dy, tw, 13);
      if (b.x0 < 2 || b.x1 > w - 2 || b.y0 < 2 || b.y1 > h - 2 || taken.some((t) => hit(t, b))) continue;
      taken.push(b);
      ctx.fillStyle = "rgba(251, 247, 239, .82)"; ctx.fillRect(b.x0, b.y0, tw, 13);
      ctx.fillStyle = "#4a3b10"; ctx.fillText(sp.name, q.x + dx, q.y + dy + 0.5);
      break;
    }
  }
}
/** The camp or art car under a point on the full map (CSS pixels), for its name on hover or a tap. */
function mapSpotAt(w: number, h: number, x: number, y: number, t: number): { name: string; x: number; y: number } | null {
  const { s, ox, oy } = mapFit(w, h);
  let best: { name: string; x: number; y: number; d: number } | null = null;
  const consider = (p: Vec, name: string) => {
    const q = { x: ox + p.x * s, y: oy + p.y * s }, d = Math.hypot(q.x - x, q.y - y);
    if (d < 14 && (!best || d < best.d)) best = { name, x: q.x, y: q.y, d };
  };
  for (const sp of SPOTS) consider(sp.stage, sp.camp?.address ? `${sp.name} · ${sp.camp.address}` : sp.name);
  for (const m of MUTANTS) consider(npcAt(m, t), `${m.name} · art car`);
  const b = best as { name: string; x: number; y: number } | null;
  return b ? { name: b.name, x: b.x, y: b.y } : null;
}
function drawMapMarks(ctx: CanvasRenderingContext2D, w: number, h: number, g: Game, t: number) {
  const { s, ox, oy } = mapFit(w, h);
  const at = (p: Vec) => ({ x: ox + p.x * s, y: oy + p.y * s });
  // the famous art cars, where they are now
  for (const m of MUTANTS) {
    const q = at(npcAt(m, g.t));
    ctx.strokeStyle = C.navy; ctx.lineWidth = 1;
    if (m.key === "mutant:robot-heart") {
      // Robot Heart wears its heart on the maps (asked 2026-10-22)
      const k = w > 400 ? 1.6 : 1;
      ctx.fillStyle = "#ff2d55"; ctx.beginPath();
      ctx.moveTo(q.x, q.y + 5 * k); ctx.bezierCurveTo(q.x - 8 * k, q.y - 1 * k, q.x - 4 * k, q.y - 7 * k, q.x, q.y - 3 * k);
      ctx.bezierCurveTo(q.x + 4 * k, q.y - 7 * k, q.x + 8 * k, q.y - 1 * k, q.x, q.y + 5 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      continue;
    }
    ctx.fillStyle = hsl(m.hue, 90, 60);
    ctx.beginPath(); ctx.rect(q.x - 3, q.y - 3, 6, 6); ctx.fill(); ctx.stroke();
  }
  const tg = missionTarget(g.mission, g.t);
  if (tg) {
    const p = at(tg.at);
    ctx.strokeStyle = C.pink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 4 + 3 * (0.5 + 0.5 * Math.sin(t * 6)), 0, Math.PI * 2); ctx.stroke();
  }
  const c = at(g.car);
  // a beacon pulsing out from you (asked 2026-10-22): two rings, each growing and fading
  const big = w > 400 ? 1.6 : 1;
  for (const off of [0, 0.5]) {
    const k = (t * 0.8 + off) % 1;
    ctx.strokeStyle = `rgba(255, 45, 140, ${0.75 * (1 - k)})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(c.x, c.y, (9 + 16 * k) * big, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 45, 140, .18)"; ctx.beginPath(); ctx.arc(c.x, c.y, 9 * big, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(g.car.h);
  ctx.fillStyle = C.navy; ctx.strokeStyle = C.white; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* ── the frame ──────────────────────────────────────────────────────────── */
type Cam = { x: number; y: number; z: number };
let SPECK: CanvasPattern | null = null;
function speckle(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (SPECK) return SPECK;
  const c = document.createElement("canvas"); c.width = c.height = 96;
  const x = c.getContext("2d"); if (!x) return null;
  x.fillStyle = C.playa; x.fillRect(0, 0, 96, 96);
  for (let i = 0; i < 70; i++) { x.fillStyle = i % 3 ? C.speck : "#efdfbf"; x.fillRect(hash(i * 3) * 96, hash(i * 3 + 1) * 96, 1 + hash(i * 3 + 2) * 2, 1 + hash(i * 3 + 2) * 2); }
  // playa cracks
  x.strokeStyle = "rgba(170, 140, 100, .25)"; x.lineWidth = 1; x.beginPath(); x.moveTo(0, 30); x.lineTo(40, 42); x.lineTo(60, 80); x.moveTo(40, 42); x.lineTo(96, 20); x.stroke();
  return (SPECK = ctx.createPattern(c, "repeat"));
}

function paint(ctx: CanvasRenderingContext2D, w: number, h: number, g: Game, cam: Cam, input: Input, font: string) {
  const t = g.t, night = nightLevel(g.dayT), storm = stormLevel(g.storm), z = cam.z;
  const vw = w / z, vh = h / z;
  const view = { x0: cam.x - vw / 2, y0: cam.y - vh / 2, x1: cam.x + vw / 2, y1: cam.y + vh / 2 };
  const seen = (x: number, y: number, r: number) => x + r > view.x0 && x - r < view.x1 && y + r > view.y0 && y - r < view.y1;
  const world = () => ctx.setTransform(z * dprOf(ctx), 0, 0, z * dprOf(ctx), (w / 2 - cam.x * z) * dprOf(ctx), (h / 2 - cam.y * z) * dprOf(ctx));
  const screen = () => ctx.setTransform(dprOf(ctx), 0, 0, dprOf(ctx), 0, 0);

  world();
  ctx.fillStyle = speckle(ctx) ?? C.playa;
  ctx.fillRect(view.x0 - 2, view.y0 - 2, vw + 4, vh + 4);
  // outside the fence: darker deep playa
  ctx.fillStyle = "rgba(160, 130, 90, .28)";
  ctx.beginPath(); ctx.rect(view.x0 - 2, view.y0 - 2, vw + 4, vh + 4); FENCE.slice().reverse().forEach((p) => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.fill("evenodd");

  // the streets: packed dust, a shade lighter than the open playa
  ctx.strokeStyle = C.road;
  for (let i = 0; i < ARC_R.length; i++) {
    ctx.lineWidth = arcWidth(i);
    ctx.beginPath(); ctx.arc(0, 0, ARC_R[i], cang(120) - arcWidth(i) / 2 / ARC_R[i], cang(600) + arcWidth(i) / 2 / ARC_R[i]); ctx.stroke();
  }
  for (const m of RADIALS) {
    const a = polar(m, ARC_R[0]), b = polar(m, ARC_R.at(-1)! + 28);
    ctx.lineWidth = radialWidth(m); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }

  // the camps
  const vis = blocks().filter((b) => seen(b.cx, b.cy, b.br));
  for (const b of vis) {
    blockPath(ctx, b);
    ctx.fillStyle = C.block; ctx.fill();
    ctx.strokeStyle = C.blockEdge; ctx.lineWidth = 3; ctx.stroke();
  }
  for (const b of vis) for (const it of b.items) if (seen(it.x, it.y, it.w + it.l)) drawStruct(ctx, it, night, z, font);
  // the sound camps: their bays, then their stages
  const spots = SPOTS.filter((sp) => seen(sp.mid.x, sp.mid.y, 260));
  for (const sp of spots) drawBay(ctx, sp, z, font, g.parking.at === sp.key, t);
  for (const sp of spots) if (sp.kind !== "agave") drawStage(ctx, sp, t, night);
  // the next ride, parked at the side of Agave's bay: stop in the bay to hop on
  if (spots.some((sp) => sp.kind === "agave")) {
    const other: VehicleId = g.vehicle === "artcar" ? "bike" : "artcar";
    const q = polar(AGAVE.bay.min + ((AGAVE.bay.half - 14) / AGAVE.bay.r1) * (720 / (Math.PI * 2)), (AGAVE.bay.r0 + AGAVE.bay.r1) / 2 + 8);
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(clockToAngle(AGAVE.bay.min) + Math.PI); drawRide(ctx, other, t, night, false); ctx.restore();
  }

  // Center Camp: the plaza over the blocks it straddles, the café tent in the middle
  if (seen(CENTER_CAMP.x, CENTER_CAMP.y, CENTER_CAMP_R)) {
    ctx.fillStyle = C.road; ctx.beginPath(); ctx.arc(CENTER_CAMP.x, CENTER_CAMP.y, CENTER_CAMP_R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = C.blockEdge; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(CENTER_CAMP.x, CENTER_CAMP.y);
    for (let k = 0; k < 16; k++) { ctx.fillStyle = k % 2 ? "#f6efe2" : "#e8c9a4"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, CAFE_R, (k / 16) * Math.PI * 2, ((k + 1) / 16) * Math.PI * 2); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = "#9c7b52"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, CAFE_R, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  if (seen(AGAVE.dome.x, AGAVE.dome.y, 120)) drawAgave(ctx, t, night);
  if (seen(0, 0, 120)) { ctx.save(); drawMan(ctx, night); ctx.restore(); }
  if (seen(TEMPLE.x, TEMPLE.y, TEMPLE_R + 20)) drawTemple(ctx);
  for (const a of ART) if (seen(a.x, a.y, a.r + 10)) drawArt(ctx, a, t);
  // the fence
  ctx.strokeStyle = C.fence; ctx.lineWidth = 6; ctx.setLineDash([16, 10]);
  ctx.beginPath(); FENCE.forEach((p) => ctx.lineTo(p.x, p.y)); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);

  // street signs at the corners in view
  ctx.font = `600 ${12 / z}px ${font}`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i = 0; i < ARC_R.length; i++) for (const m of RADIALS) {
    const p = polar(m, ARC_R[i]);
    if (!seen(p.x, p.y, 60)) continue;
    const label = `${clockLabel(m)} & ${ARCS[i] === "Esplanade" ? "Esp" : ARCS[i]}`;
    const q = polar(m - 0.9 * (720 / (Math.PI * 2)) * (radialWidth(m) / ARC_R[i]), ARC_R[i] - arcWidth(i) / 2 - 10);
    const tw = ctx.measureText(label).width + 8 / z;
    ctx.fillStyle = "rgba(27, 31, 59, .82)"; ctx.fillRect(q.x - tw / 2, q.y - 9 / z, tw, 18 / z);
    ctx.fillStyle = WIDE_RADIALS.includes(m) ? C.gold : C.white; ctx.fillText(label, q.x, q.y);
  }
  // names on the open playa
  ctx.fillStyle = C.navy;
  for (const a of ART) if (seen(a.x, a.y, a.r + 40)) ctx.fillText(a.name, a.x, a.y + a.r + 16 / z);
  if (seen(AGAVE.dome.x, AGAVE.dome.y, 140)) { ctx.fillStyle = "#b83a66"; ctx.fillText("Agave Lounge", AGAVE.dome.x, AGAVE.dome.y - AGAVE.dome.r - 14 / z); }
  for (const sp of spots) if (sp.kind !== "agave") {
    const label = sp.name, tw = ctx.measureText(label).width + 10 / z;
    const ly = sp.stage.y - sp.stage.r - 14 / z;
    ctx.fillStyle = "rgba(27, 31, 59, .85)"; ctx.fillRect(sp.stage.x - tw / 2, ly - 9 / z, tw, 18 / z);
    ctx.fillStyle = C.gold; ctx.fillText(label, sp.stage.x, ly);
  }

  // MOOP: little glints of litter
  for (const m of g.moop) if (seen(m.x, m.y, 10)) {
    const k = hash(Math.round(m.x * 7 + m.y));
    ctx.fillStyle = k < 0.33 ? "#7a4fd1" : k < 0.66 ? "#e04f7a" : "#4a90c2";
    ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(k * 6); ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + 0.5 * Math.sin(t * 5 + k * 20)})`; ctx.fillRect(m.x - 1, m.y - 4, 2, 2);
  }

  // where the pager wants you
  const tg = missionTarget(g.mission, t);
  if (tg && seen(tg.at.x, tg.at.y, STOP_R + 20)) {
    const pulse = 0.5 + 0.5 * Math.sin(t * 5);
    ctx.strokeStyle = C.pink; ctx.lineWidth = 4; ctx.setLineDash([12, 8]);
    ctx.beginPath(); ctx.arc(tg.at.x, tg.at.y, STOP_R * (0.85 + 0.15 * pulse), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 107, 154, ${0.15 + 0.15 * pulse})`; ctx.fill();
  }

  // dust off the wheels
  for (const d of g.dust) { ctx.fillStyle = `rgba(${C.dust}, ${Math.max(0, d.life) * 0.55})`; ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill(); }

  // the others
  const npcs: { n: Npc; p: { x: number; y: number; h: number } }[] = [];
  const mine = drivenKey(); // the art car you drive is drawn as your ride, not as well where it is
  for (const n of g.npcs) { if (n.key && n.key === mine) continue; const p = npcAt(n, t); if (seen(p.x, p.y, 40)) npcs.push({ n, p }); }
  for (const { n, p } of npcs) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.h);
    if (n.kind === "mutant") drawMutant(ctx, n, t, night); else if (n.kind === "ambulance") drawAmbulance(ctx, t, night); else if (n.kind === "bike" && n.hue % 7 === 0) drawSuperbike(ctx, n.hue, night); else if (n.kind === "artcar") drawFish(ctx, n.hue, t, night); else if (n.kind === "walker") drawWalker(ctx, n.hue, t, night); else drawRider(ctx, n.hue * 7 + Math.floor((n.phase ?? 0) * 13) + Math.round((n.lag ?? 0) * 31), n.hue, night);
    ctx.restore();
  }
  for (const { n, p } of npcs) if (n.kind === "mutant" && n.name) {
    const tw = ctx.measureText(n.name).width + 10 / z;
    ctx.fillStyle = "rgba(27, 31, 59, .85)"; ctx.fillRect(p.x - tw / 2, p.y - NPC_R.mutant - 26 / z, tw, 18 / z);
    ctx.fillStyle = C.gold; ctx.fillText(n.name, p.x, p.y - NPC_R.mutant - 17 / z);
  }
  // you
  ctx.save(); ctx.translate(g.car.x, g.car.y); ctx.rotate(g.car.h); drawRide(ctx, g.vehicle, t, night, input.brake || input.handbrake); ctx.restore();

  // night: the city goes dark, then the lights
  if (night > 0) {
    screen();
    ctx.fillStyle = `rgba(${C.night}, ${0.72 * night})`; ctx.fillRect(0, 0, w, h);
    world();
    ctx.globalCompositeOperation = "lighter";
    const glow = (x: number, y: number, r: number, col: string, a: number) => {
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, col.replace("A", String(a))); gr.addColorStop(1, col.replace("A", "0"));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    };
    // headlights: a cone ahead of the art car
    ctx.save(); ctx.translate(g.car.x, g.car.y); ctx.rotate(g.car.h);
    const cone = ctx.createLinearGradient(0, -VEHICLES[g.vehicle].len / 2, 0, -190);
    cone.addColorStop(0, `rgba(255, 236, 190, ${0.55 * night})`); cone.addColorStop(1, "rgba(255, 236, 190, 0)");
    ctx.fillStyle = cone; ctx.beginPath(); ctx.moveTo(-7, -VEHICLES[g.vehicle].len / 2); ctx.lineTo(-70, -190); ctx.lineTo(70, -190); ctx.lineTo(7, -VEHICLES[g.vehicle].len / 2); ctx.closePath(); ctx.fill();
    ctx.restore();
    glow(g.car.x, g.car.y, 46, `hsla(${(t * 120) % 360}, 100%, 60%, A)`, 0.45 * night);
    for (const { n, p } of npcs) glow(p.x, p.y, n.kind === "mutant" ? 120 : n.kind === "artcar" ? 60 : n.kind === "walker" ? 10 : 18, `hsla(${n.hue}, 100%, 60%, A)`, (n.kind === "mutant" ? 0.75 : 0.5) * night);
    for (const sp of spots) if (sp.kind !== "agave") glow(sp.stage.x, sp.stage.y, sp.stage.r * 3.2, `hsla(${(sp.hue + t * 30) % 360}, 100%, 60%, A)`, 0.6 * night);
    if (seen(0, 0, 400)) glow(0, 0, 320, "rgba(125, 249, 255, A)", 0.55 * night);
    if (seen(TEMPLE.x, TEMPLE.y, 300)) glow(TEMPLE.x, TEMPLE.y, 240, "rgba(255, 190, 120, A)", 0.4 * night);
    if (seen(AGAVE.dome.x, AGAVE.dome.y, 220)) glow(AGAVE.dome.x, AGAVE.dome.y, 170, `hsla(${330 + 20 * Math.sin(t)}, 100%, 62%, A)`, 0.6 * night);
    if (seen(CENTER_CAMP.x, CENTER_CAMP.y, 300)) glow(CENTER_CAMP.x, CENTER_CAMP.y, 220, "rgba(255, 210, 140, A)", 0.4 * night);
    for (const a of ART) if (seen(a.x, a.y, 200)) glow(a.x, a.y, a.r * 2.4, `hsla(${a.hue + ((t * 40) % 60)}, 100%, 60%, A)`, 0.55 * night);
    for (const b of vis) for (const it of b.items) {
      if (!seen(it.x, it.y, 50)) continue;
      if (it.kind === "arch") glow(it.x, it.y, 26, `hsla(${it.hue}, 100%, 62%, A)`, 0.6 * night);
      else if (it.kind === "dome" || it.kind === "canopy" || it.kind === "stage") glow(it.x, it.y, Math.max(24, it.w * 0.7), `hsla(${it.hue}, 100%, 60%, A)`, 0.32 * night);
    }
    for (const m of g.moop) if (seen(m.x, m.y, 10)) glow(m.x, m.y, 8, "rgba(255, 255, 255, A)", 0.4 * night);
    ctx.globalCompositeOperation = "source-over";
  }

  screen();
  // the dust storm: a whiteout that closes in around the car
  if (storm > 0) {
    const cx = w / 2 + (g.car.x - cam.x) * z, cy = h / 2 + (g.car.y - cam.y) * z;
    const clear = 70 + (1 - storm) * Math.max(w, h);
    const gr = ctx.createRadialGradient(cx, cy, clear * 0.25, cx, cy, clear);
    gr.addColorStop(0, `rgba(${C.dust}, ${0.25 * storm})`); gr.addColorStop(1, `rgba(${C.dust}, ${0.96 * storm})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = `rgba(255, 248, 230, ${0.5 * storm})`; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < 50; i++) {
      const x = ((hash(i) * w * 1.3 + t * (500 + hash(i + 99) * 400)) % (w * 1.3)) - w * 0.15, y = hash(i + 7) * h;
      ctx.moveTo(x, y); ctx.lineTo(x - 30 - hash(i + 3) * 40, y + 6);
    }
    ctx.stroke();
  }

  // an arrow pointing to a target off the screen: on a ring round the ride, not out at the edge (2026-10-22)
  if (tg) {
    const sx = w / 2 + (tg.at.x - cam.x) * z, sy = h / 2 + (tg.at.y - cam.y) * z;
    const m = 34;
    if (sx < m || sx > w - m || sy < m || sy > h - m) {
      const a = Math.atan2(sy - h / 2, sx - w / 2);
      const k = Math.min((w / 2 - m) / Math.max(1e-6, Math.abs(Math.cos(a))), (h / 2 - m) / Math.max(1e-6, Math.abs(Math.sin(a))), Math.max(90, Math.min(w, h) * 0.3));
      ctx.save(); ctx.translate(w / 2 + Math.cos(a) * k, h / 2 + Math.sin(a) * k); ctx.rotate(a);
      ctx.fillStyle = C.pink; ctx.strokeStyle = C.navy; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-10, -11); ctx.lineTo(-4, 0); ctx.lineTo(-10, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}
const dprOf = (ctx: CanvasRenderingContext2D) => (ctx.canvas as HTMLCanvasElement & { _dpr?: number })._dpr ?? 1;

/* ── the window ─────────────────────────────────────────────────────────── */
type Hud = { address: string; mph: number; pager: string; time: number | null; gifts: number; moop: number; warn: string; night: boolean; storm: boolean; hear: string; hearKey: string };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Camp sound on or off, per device (lib/profile.ts LOCAL_ONLY). */
const SOUND_KEY = "agentcamp-playa-sound";
const GARAGE_KEY = "agentcamp-playa-garage";
const readSound = () => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } };
const writeSound = (on: boolean) => { try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch {} };
/** iOS Safari ignores the widget's volume: there a camp is simply on or off (playaSound.ts gate). */
const isIos = () => typeof navigator !== "undefined" && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
/** What you can hear from the road at a time: every sound camp's bay, and the famous art cars where they are. */
const allSources = (t: number): Source[] => [
  ...SPOTS.map((sp) => ({ key: sp.key, x: sp.mid.x, y: sp.mid.y })),
  ...MUTANTS.map((m) => { const p = npcAt(m, t); return { key: m.key!, x: p.x, y: p.y }; }),
];
/** The places you hear from the road: those with real sets. A place with only clips is seen, not heard (clipSources). */
const soundSources = (t: number): Source[] => allSources(t).filter((s) => !clipsOnly(s.key));
const clipSources = (t: number): Source[] => allSources(t).filter((s) => clipsOnly(s.key));
/** Where a place is on the playa now: an art car where it has driven to, a camp or art spot at its stage. */
const placeAt = (key: string, t: number): { x: number; y: number } | null => {
  if (key.startsWith("mutant:")) { const m = MUTANTS.find((n) => n.key === key); return m ? npcAt(m, t) : null; }
  const sp = SPOTS.find((s) => s.key === key);
  return sp ? sp.stage : null;
};

export default function PlayaWin() {
  const mobile = useIsMobile();
  const root = useRef<HTMLDivElement>(null);
  const board = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const mini = useRef<HTMLCanvasElement>(null);
  const big = useRef<HTMLCanvasElement>(null);
  const game = useRef<Game>(newGame((Date.now() & 0xffff) + 1));
  const keys = useRef<Input>({ ...NO_INPUT });
  const touch = useRef<Input>({ ...NO_INPUT });
  const phaseRef = useRef<Phase>("title");
  const [phase, setPhaseState] = useState<Phase>("title");
  const [map, setMap] = useState(false);
  // with the big map open you drive through everything: a way out of a corner, and a straight line to where you point
  useEffect(() => { game.current.ghost = map; }, [map]);
  const [layout, setLayout] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [hud, setHud] = useState<Hud>({ address: "", mph: 0, pager: "", time: null, gifts: 0, moop: 0, warn: "", night: false, storm: false, hear: "", hearKey: "" });
  const flash = useRef<{ text: string; until: number }>({ text: "", until: 0 });
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };
  const touchUi = mobile || coarse;
  // what you ride, and the menu to change it
  const [vehicle, setVehicleState] = useState<VehicleId>(game.current.vehicle);
  const [rides, setRides] = useState(false);
  // the garage: the famous art cars you have found and parked beside, any of them yours to drive (asked 2026-10-22)
  const [garage, setGarage] = useState<string[]>([]);
  const [skin, setSkin] = useState<string | null>(null);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(GARAGE_KEY) || "[]"); if (Array.isArray(v)) setGarage(v.filter((x) => typeof x === "string" && ART_CARS[x])); } catch {} }, []);
  const drive = (id: string) => {
    const g = game.current;
    if (g.aboard) hopOff(g);
    if (g.vehicle === "found") leaveDriven(g); // the one you were driving stays parked here
    setVehicle(g, "found"); rideSkin = id; setSkin(id); setVehicleState("found"); setRides(false); setDriven(`mutant:${id}`);
    setGarage((o) => { if (o.includes(id)) return o; const n = [...o, id]; try { localStorage.setItem(GARAGE_KEY, JSON.stringify(n)); } catch {} return n; });
    flash.current = { text: `at the wheel of ${soundOf(`mutant:${id}`).name}`, until: g.t + 2 };
    board.current?.focus({ preventScroll: true });
  };
  const ride = (id: VehicleId) => {
    const g = game.current;
    if (g.aboard) hopOff(g);
    leaveDriven(g); // the art car you were driving stays parked where you left it
    setVehicle(g, id); setVehicleState(id); setRides(false); flash.current = { text: `on the ${VEHICLES[id].name}`, until: game.current.t + 1.5 }; };
  // the music: where you are parked, the panel and its player, the camps you hear from the road
  const [parked, setParked] = useState<string | null>(null);
  /** riding along on the art car you parked beside (lib/games/playa.ts hopOn) */
  const [aboard, setAboard] = useState(false);
  const ridealong = () => {
    const g = game.current;
    if (g.aboard) { hopOff(g); setVehicleState("bike"); }
    else if (g.vehicle === "found") { leaveDriven(g); setVehicleState("bike"); flash.current = { text: "parked it. on the bike", until: g.t + 1.5 }; }
    else hopOn(g);
    setAboard(!!g.aboard); board.current?.focus({ preventScroll: true });
  };
  const [lounge, setLounge] = useState(false);
  const [now, setNow] = useState<Now | null>(null);
  const nowRef = useRef<Now | null>(null);
  nowRef.current = now;
  const [voices, setVoices] = useState<Voice[]>([]);
  const mix = useRef<Voice[]>([]);
  // the last camp you rode up to keeps playing (playaSound.ts stepSticky); which of its sets, per camp
  const sticky = useRef(newSticky());
  const [setOf, setSetOf] = useState<Record<string, number>>({});
  const skipSet = (key: string) => setSetOf((o) => ({ ...o, [key]: ((o[key] ?? 0) + 1) % Math.max(1, playable(key).length) }));
  /** the clip-only place you are passing, shown silently in a corner */
  const [peek, setPeek] = useState<string | null>(null);
  const peekEl = useRef<HTMLDivElement>(null);
  const stopSound = (key: string) => { stopSticky(sticky.current, key); board.current?.focus({ preventScroll: true }); };
  const [mapTip, setMapTip] = useState<{ name: string; x: number; y: number } | null>(null);
  // the big map zooms (buttons, the wheel) and pans (drag); it opens closed in on your ride
  const bigView = useRef<MapView>({ z: 2.2, cx: 0, cy: 0 });
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // out to a third shows the desert round the city and the ranges past it (asked 2026-10-22)
  const zoomMap = (k: number) => { const v = bigView.current; v.z = Math.min(8, Math.max(0.35, v.z * k)); if (v.z <= 1) { v.cx = 0; v.cy = MAP_MID(); v.follow = false; } };
  /** back on you, and following again */
  const followMe = () => { const c = game.current.car, v = bigView.current; bigView.current = { z: Math.max(v.z, 2.2), cx: c.x, cy: c.y, follow: true }; };
  const mapScale = (c: HTMLCanvasElement) => Math.min(c.clientWidth / (2 * MAP_H.half), c.clientHeight / (MAP_H.bottom - MAP_H.top)) * bigView.current.z;
  const mapDown = (e: ReactPointerEvent<HTMLCanvasElement>) => { drag.current = { x: e.clientX, y: e.clientY, moved: false }; e.currentTarget.setPointerCapture?.(e.pointerId); tipAt(e); };
  const mapMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (d && (d.moved || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6)) {
      const s = mapScale(e.currentTarget), v = bigView.current;
      v.cx -= (e.clientX - d.x) / s; v.cy -= (e.clientY - d.y) / s; d.x = e.clientX; d.y = e.clientY; d.moved = true; v.follow = false; setMapTip(null);
    } else tipAt(e);
  };
  const tipAt = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    mapView = bigView.current;
    const hit = mapSpotAt(c.clientWidth, c.clientHeight, e.clientX - r.left, e.clientY - r.top, game.current.t);
    mapView = null;
    setMapTip(hit ? { ...hit, x: hit.x + c.offsetLeft, y: hit.y + c.offsetTop } : null);
  };
  const [sound, setSound] = useState(true);
  const soundRef = useRef(true);
  const [ios, setIos] = useState(false);
  useEffect(() => { const on = readSound(); setSound(on); soundRef.current = on; setIos(isIos()); }, []);
  const toggleSound = () => { const on = !soundRef.current; soundRef.current = on; setSound(on); writeSound(on); };
  const onPark = useRef((key: string) => {});
  const onLeave = useRef(() => {});
  onPark.current = (key) => {
    // a phone keeps the game in view: the "now playing" bar or the mini player opens the full-screen panel (asked 2026-10-22)
    // beside an art car the panel opens on every screen (asked 2026-10-22): ride along, drive it, its sets
    setParked(key); if (!mobile || key.startsWith("mutant:")) setLounge(true);
    setNow((n) => (n?.playing ? n : (() => { const t = soundOf(key).tracks[0]; return t ? { key, url: t.url, title: t.title, auto: false, playing: false } : null; })()));
  };
  // driving off keeps a playing set or video open where it is (asked 2026-10-22); an idle panel folds away
  onLeave.current = () => { setParked(null); if (!nowRef.current?.playing) setLounge(false); setNow((n) => (n?.playing ? n : null)); };
  const pick = (key: string, t: Track) => setNow({ key, url: t.url, title: t.title, auto: true, playing: true });
  const onPlaying = useCallback((on: boolean) => setNow((n) => (n && n.playing !== on ? { ...n, playing: on } : n)), []);
  const stopMusic = () => { setNow(null); setLounge(false); board.current?.focus({ preventScroll: true }); };
  const foldLounge = () => { setLounge(false); if (!nowRef.current?.playing) setNow(null); board.current?.focus({ preventScroll: true }); };

  useBoardFocus(board);
  useEffect(() => { const mq = matchMedia("(pointer: coarse)"); const on = () => setCoarse(mq.matches); on(); mq.addEventListener("change", on); return () => mq.removeEventListener("change", on); }, []);

  // the loop: fixed 60 Hz steps, a frame per animation frame, the HUD ten times a second
  useEffect(() => {
    const cv = canvas.current, stage = board.current;
    if (!cv || !stage) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let w = 0, h = 0, raf = 0, last = performance.now(), acc = 0, hudAt = 0, clock = 0;
    const font = getComputedStyle(stage).fontFamily || "system-ui, sans-serif";
    const g0 = game.current;
    const cam: Cam = { x: g0.car.x, y: g0.car.y, z: 1 };
    const fit = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = stage.clientWidth; h = stage.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
      (cv as HTMLCanvasElement & { _dpr?: number })._dpr = dpr;
      const m = mini.current;
      if (m) { m.width = m.clientWidth * dpr; m.height = m.clientHeight * dpr; miniBase = null; }
    };
    let miniBase: HTMLCanvasElement | null = null;
    const ro = new ResizeObserver(fit); ro.observe(stage); fit();
    const input = (): Input => {
      const k = keys.current, t = touch.current;
      return { gas: k.gas || t.gas, brake: k.brake || t.brake, left: k.left || t.left, right: k.right || t.right, handbrake: k.handbrake || t.handbrake };
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const g = game.current;
      const inp = input();
      if (phaseRef.current === "play") {
        acc += dt;
        let n = 0;
        while (acc >= DT && n < 6) {
          for (const e of stepGame(g, inp, DT)) {
            if (e === "storm") flash.current = { text: "dust storm! whiteout rolling in", until: g.t + 3 };
            else if (e === "delivered") flash.current = { text: `delivered: gifts ${g.mission.gifts}`, until: g.t + 2.5 };
            else if (e === "failed") flash.current = { text: "out of time", until: g.t + 2.5 };
            else if (e === "picked") flash.current = { text: "on board!", until: g.t + 1.5 };
            else if (e === "park" && g.parking.at) onPark.current(g.parking.at);
            else if (e === "leave") onLeave.current();
          }
          acc -= DT; n++;
        }
        if (n === 6) acc = 0;
      } else acc = 0;
      // the camera: trails the car and leads it along its velocity, and pulls back with speed
      const spd = speedOf(g.car);
      // close in, so the art car reads big in the middle (it still pulls back with speed)
      // portrait (asked 2026-10-22): a tall, narrow view pulls back a little and puts you in the lower
      // third, looking up the road the way you are pointed, so there is somewhere to go on the screen
      const portrait = h > w * 1.15;
      const base = Math.max(1.1, Math.min(3, Math.min(w, h) / 210)) * (portrait ? 0.78 : 1);
      const k = 1 - Math.exp(-5 * dt);
      const lead = portrait ? (0.16 * h) / Math.max(0.5, cam.z) : 0;
      cam.x += (g.car.x + g.car.vx * 0.45 + Math.sin(g.car.h) * lead - cam.x) * k;
      cam.y += (g.car.y + g.car.vy * 0.45 - Math.cos(g.car.h) * lead - cam.y) * k;
      // zoomed in at a crawl, pulled well back at speed (to about half at the top), so you see what is coming
      // a small ride (a bike, the unicycle) gets the camera closer still, so it reads at the size an art car does
      const near = VEHICLES[g.vehicle].len < 20 ? 1.6 : 1;
      cam.z += (base * near * (1 - 0.52 * Math.min(1, spd / VEHICLES[g.vehicle].maxSpeed)) - cam.z) * (1 - Math.exp(-1.6 * dt));
      if (w && h) paint(ctx, w, h, g, cam, inp, font);
      // the clip in passing floats just above its place on the playa, kept inside the screen
      const pk = peekEl.current, at = pk?.dataset.key ? placeAt(pk.dataset.key, g.t) : null;
      if (pk && at) {
        const pw = pk.offsetWidth, ph = pk.offsetHeight;
        const sx = w / 2 + (at.x - cam.x) * cam.z, sy = h / 2 + (at.y - cam.y) * cam.z;
        pk.style.left = `${Math.round(Math.min(w - pw - 8, Math.max(8, sx - pw / 2)))}px`;
        pk.style.top = `${Math.round(Math.min(h - ph - 8, Math.max(8, sy - ph - 34 * cam.z)))}px`;
      }
      clock += dt;
      if (now - hudAt > 100) {
        const m = g.mission;
        const fl = flash.current.until > g.t ? flash.current.text : "";
        // the camps you hear from the road: rising as you ride up to one, then kept playing after you leave, until
        // another takes over; silent while paused, muted, or a set you picked in the panel plays
        const near = nearest(g.car, soundSources(g.t));
        // riding up to a different camp or art car takes over from a set picked in the panel, as it
        // would from another camp: the picked set stops and the new one comes up (asked 2026-10-22)
        const picked = nowRef.current;
        if (picked?.playing && near && near.key !== picked.key && loudness(near.d) >= TAKEOVER) { nowRef.current = null; setNow(null); setLounge(false); }
        const quiet = phaseRef.current !== "play" || !soundRef.current || !!nowRef.current?.playing;
        const target = stepSticky(sticky.current, near, quiet);
        const was = mix.current;
        mix.current = stepMix(was, target, Math.min(0.5, (now - (hudAt || now)) / 1000 || 0.1));
        if (mix.current.length !== was.length || mix.current.some((v, i) => v.key !== was[i]?.key || Math.abs(v.vol - was[i].vol) >= 2)) setVoices(mix.current.map((v) => ({ key: v.key, vol: Math.round(v.vol) })));
        hudAt = now;
        setAboard(!!g.aboard);
        setVehicleState(g.vehicle);
        const seen = nearest(g.car, clipSources(g.t));
        setPeek(seen && loudness(seen.d) > 20 ? seen.key : null);
        setHud({
          address: addressOf(g.car), mph: mph(spd), pager: pagerLine(m),
          time: m.phase === "pickup" || m.phase === "dropoff" || m.phase === "follow" ? m.timeLeft : null,
          gifts: m.gifts, moop: g.moopCount, warn: g.warn > 0 ? g.warnText : fl, night: nightLevel(g.dayT) > 0.5, storm: stormLevel(g.storm) > 0.3,
          hear: target && target.vol > 4 ? soundOf(target.key).name : "", hearKey: target && target.vol > 4 ? target.key : "",
        });
        const mc = mini.current, mx = mc?.getContext("2d");
        if (mc && mx && mc.width > 0) {
          if (!miniBase) {
            miniBase = document.createElement("canvas"); miniBase.width = mc.width; miniBase.height = mc.height;
            const bx = miniBase.getContext("2d"); if (bx) drawCity(bx, mc.width, mc.height, false);
          }
          mx.clearRect(0, 0, mc.width, mc.height); mx.drawImage(miniBase, 0, 0);
          drawMapMarks(mx, mc.width, mc.height, g, clock);
        }
        const bc = big.current, bx = bc?.getContext("2d");
        if (bc && bx) {
          const dpr = Math.min(2, window.devicePixelRatio || 1);
          const bw = Math.round(bc.clientWidth * dpr), bh = Math.round(bc.clientHeight * dpr);
          if (bc.width !== bw || bc.height !== bh) { bc.width = bw; bc.height = bh; }
          bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, bw, bh);
          bx.setTransform(dpr, 0, 0, dpr, 0, 0);
          if (bigView.current.follow) { bigView.current.cx = g.car.x; bigView.current.cy = g.car.y; }
          mapView = bigView.current;
          drawCity(bx, bc.clientWidth, bc.clientHeight, true);
          drawMapMarks(bx, bc.clientWidth, bc.clientHeight, g, clock);
          mapView = null;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  // let go of the controls when the window is no longer the focused one, is minimised, or the tab is hidden;
  // the game itself keeps going (no pause, asked 2026-10-22)
  useEffect(() => {
    const win = root.current?.closest<HTMLElement>("[data-win]") ?? null;
    const away = () => { keys.current = { ...NO_INPUT }; touch.current = { ...NO_INPUT }; };
    const check = () => {
      if (document.hidden) return away();
      if (win && (!win.classList.contains("focused") || win.style.display === "none" || win.hasAttribute("inert"))) away();
    };
    const mo = win ? new MutationObserver(check) : null;
    if (win) mo!.observe(win, { attributes: true, attributeFilter: ["class", "style", "inert"] });
    // a click into a SoundCloud player in this window takes the page's focus: let go of the keys, but keep driving
    const blur = () => setTimeout(() => {
      const a = document.activeElement;
      if (a?.tagName === "IFRAME" && root.current?.contains(a)) { keys.current = { ...NO_INPUT }; touch.current = { ...NO_INPUT }; return; }
      away();
    }, 0);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("blur", blur);
    return () => { mo?.disconnect(); document.removeEventListener("visibilitychange", check); window.removeEventListener("blur", blur); };
  }, []);

  const go = () => { setPhase("play"); setMap(false); setLayout(false); board.current?.focus({ preventScroll: true }); };
  const toggleNight = () => { const g = game.current; g.dayT = flipDay(g.dayT); };
  const toggleMap = () => setMap((m) => { if (!m) { const c = game.current.car; bigView.current = { z: 2.2, cx: c.x, cy: c.y, follow: true }; } return !m; });

  const onKey = (e: KeyboardEvent, down: boolean) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const onButton = e.target !== e.currentTarget && !!(e.target as HTMLElement).closest?.("button");
    const k = KEYS[e.key];
    if (k && !(onButton && e.key === " ")) {
      e.preventDefault();
      keys.current = { ...keys.current, [k]: down };
      if (down && phaseRef.current === "title") go();
      return;
    }
    if (!down) return;
    else if (e.key === "m" || e.key === "M") { e.preventDefault(); toggleMap(); }
    else if (e.key === "n" || e.key === "N") { e.preventDefault(); toggleNight(); }
    else if (e.key === "v" || e.key === "V") { e.preventDefault(); ride(nextVehicle(game.current.vehicle)); }
    // beside an art car (asked 2026-10-22): R rides along on it or hops off, E takes its wheel (D steers)
    else if (e.key === "r" || e.key === "R") { e.preventDefault(); ridealong(); }
    else if (e.key === "e" || e.key === "E") { const g = game.current; const at = g.parking.at; if (at?.startsWith("mutant:") && ART_CARS[at.slice(7)]) { e.preventDefault(); drive(at.slice(7)); } }
    else if (e.key === "Escape") { if (layout) setLayout(false); else if (map) setMap(false); }
    else if (e.key === "Enter" && !onButton && phaseRef.current !== "play") { e.preventDefault(); go(); }
  };
  const pad = (k: keyof Input, label: string, glyph: string, cls: string) => {
    const set = (v: boolean) => (e: ReactPointerEvent) => {
      e.preventDefault();
      if (v) { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); if (phaseRef.current === "title") go(); }
      touch.current = { ...touch.current, [k]: v };
    };
    return (
      <button type="button" className={`pl-pad ${cls}`} aria-label={label}
        onPointerDown={set(true)} onPointerUp={set(false)} onPointerCancel={set(false)} onLostPointerCapture={set(false)} onContextMenu={(e) => e.preventDefault()}>
        {glyph}
      </button>
    );
  };
  const over = hud.mph > SPEED_LIMIT_MPH;

  return (
    <div className="pl" ref={root} data-phone={mobile ? "" : undefined} data-touch={touchUi ? "" : undefined} data-map={map ? "" : undefined}>
      <div className="pl-stage" ref={board} tabIndex={0} role="application"
        aria-label="GTA:BRC. drive with the arrow keys or WASD, space is the handbrake, V changes ride, M the map, N day or night, R rides along on an art car, E drives it"
        onKeyDown={(e) => onKey(e, true)} onKeyUp={(e) => onKey(e, false)}
        onBlur={() => { keys.current = { ...NO_INPUT }; }}>
        <canvas ref={canvas} className="pl-canvas" aria-hidden="true" />

        <div className="pl-pager" aria-live="polite">
          <span className="pl-pager-txt">{hud.pager}</span>
          {hud.time != null && <b className={hud.time < 10 ? "pl-late" : undefined}>{fmt(hud.time)}</b>}
        </div>

        <div className="pl-where">
          <b className="pl-addr">{hud.address}</b>
          <span className="pl-speed"><b className={over ? "pl-over" : undefined}>{hud.mph}</b> mph <span className="pl-limit">limit {SPEED_LIMIT_MPH}</span></span>
          <span className="pl-count">gifts <b>{hud.gifts}</b> · moop <b>{hud.moop}</b></span>
          {hud.hear && (
            <span className="pl-hear">
              <span className="pl-hear-name">♪ {hud.hear}</span>
              {soundOf(hud.hearKey).tracks.length > 1 && <button type="button" className="pl-hear-btn" onClick={() => skipSet(hud.hearKey)} aria-label={`next set from ${hud.hear}`}>⏭</button>}
              <button type="button" className="pl-hear-btn" onClick={() => stopSound(hud.hearKey)} aria-label={`stop ${hud.hear}`}>×</button>
            </span>
          )}
        </div>

        <div className="pl-side">
          <button type="button" className="pl-mini" onClick={toggleMap} aria-label="open the city map (M)">
            <canvas ref={mini} aria-hidden="true" />
          </button>
          <div className="pl-tools">
            <span className="pl-ride">
              <button type="button" className="pl-btn" onClick={() => setRides((r) => !r)} aria-expanded={rides} aria-haspopup="true">ride: {vehicle === "found" && skin ? soundOf(`mutant:${skin}`).name : VEHICLES[vehicle].name} ▾</button>
              {rides && (
                <span className="pl-rides" role="group" aria-label="change ride (V)">
                  {BASE_RIDES.map((id) => <button type="button" key={id} className="pl-btn" aria-pressed={id === vehicle} onClick={() => ride(id)}>{VEHICLES[id].name}</button>)}
                  {garage.map((id) => <button type="button" key={id} className="pl-btn pl-found" aria-pressed={vehicle === "found" && skin === id} onClick={() => drive(id)}>★ {soundOf(`mutant:${id}`).name}</button>)}
                </span>
              )}
            </span>
            {(vehicle === "found" || aboard) && <button type="button" className="pl-btn" onClick={ridealong}>hop off</button>}
            {parked && !lounge && <button type="button" className="pl-btn" onClick={() => onPark.current(parked)}>♪ {soundOf(parked).name}</button>}
            <button type="button" className="pl-btn pl-icon" onClick={toggleSound} aria-pressed={!sound} aria-label={sound ? "sound on: turn it off" : "sound off: turn it on"} title={sound ? "sound on" : "sound off"}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
                {sound ? <><path d="M16 9a4 4 0 0 1 0 6" /><path d="M18.5 6.5a7.5 7.5 0 0 1 0 11" /></> : <path d="M17 9l5 6M22 9l-5 6" />}
              </svg>
            </button>
            <button type="button" className="pl-btn" onClick={toggleNight}>{hud.night ? "day" : "night"}</button>
          </div>
        </div>

        {hud.warn && phase === "play" && <div className="pl-warn" role="status">{hud.warn}</div>}

        {touchUi && phase === "play" && (
          <div className="pl-pads" role="group" aria-label="driving controls">
            {pad("left", "steer left", "◀", "pl-left")}
            {pad("right", "steer right", "▶", "pl-right")}
            {pad("brake", "brake and reverse", "▼", "pl-brake")}
            {pad("gas", "gas", "▲", "pl-gas")}
            {pad("handbrake", "handbrake: drift", "drift", "pl-hb")}
          </div>
        )}

        {phase !== "play" && !layout && !map && (
          <div className="pl-over-card">
            {phase === "title" ? (
              <>
                <div className="pl-title">GTA:BRC</div>
                <div className="pl-sub">ride round Black Rock City on a cruiser bike or Agave Lounge&apos;s art car. the pager has jobs, the playa has MOOP, the sound camps have sets. 5 mph near people.</div>
              </>
            ) : <div className="pl-title pl-title-s">paused</div>}
            <ul className="pl-help">
              {touchUi
                ? <><li>◀ ▶ steer · ▲ gas · ▼ brake and reverse</li><li>drift is the handbrake · tap the minimap for the city</li></>
                : <><li>arrows or WASD drive · space is the handbrake</li><li>V change ride · M map · N day or night</li><li>beside an art car: R ride along or hop off · E drive it</li></>}
              <li>Agave Lounge is at {AGAVE_ADDRESS}. stop in a camp&apos;s pink P to hear its sets</li>
            </ul>
            <button type="button" className="pl-btn pl-go" onClick={go}>{phase === "title" ? "start driving" : "keep driving"}</button>
          </div>
        )}

        {map && (
          <div className="pl-map">
            <canvas ref={big} aria-label="the whole city: the Man in the middle, the Temple at 12:00, Agave Lounge in pink, the sound camps in gold"
              onPointerMove={mapMove} onPointerDown={mapDown} onPointerUp={() => { drag.current = null; }} onPointerLeave={() => { drag.current = null; setMapTip(null); }}
              onWheel={(e) => zoomMap(e.deltaY < 0 ? 1.15 : 1 / 1.15)} />
            {mapTip && <span className="pl-map-tip" style={{ left: mapTip.x, top: mapTip.y }}>{mapTip.name}</span>}
            <span className="pl-map-zoom" role="group" aria-label="zoom the map">
              <button type="button" className="pl-btn" onClick={() => zoomMap(1.5)} aria-label="zoom in">+</button>
              <button type="button" className="pl-btn" onClick={() => zoomMap(1 / 1.5)} aria-label="zoom out">−</button>
              <button type="button" className="pl-btn" onClick={() => { bigView.current = { z: 1, cx: 0, cy: MAP_MID(), follow: false }; }} aria-label="the whole city">all</button>
              <button type="button" className="pl-btn" onClick={followMe} aria-label="back to you, and follow">me</button>
            </span>
            <button type="button" className="pl-btn pl-map-x" onClick={() => setMap(false)}>close map</button>
          </div>
        )}
        {layout && (
          <button type="button" className="pl-layout" onClick={() => setLayout(false)} aria-label="close the camp layout">
            <img src={AGAVE_IMG + "camp-layout.jpg"} alt="Agave Lounge camp layout" />
          </button>
        )}
      </div>
      <Lounge parked={parked} now={now} open={lounge} onPick={pick} onPlaying={onPlaying} onClose={stopMusic}
        onOpen={() => setLounge(true)} onCollapse={foldLounge} vehicle={vehicle} onHop={ride} aboard={aboard} onRideAlong={ridealong} ios={ios}
        onDrive={parked?.startsWith("mutant:") && ART_CARS[parked.slice(7)] ? () => drive(parked.slice(7)) : undefined} />
      {peek && !(now?.playing && now.key === peek) && <ClipPeek ref={peekEl} k={peek} onOpen={(key, t) => { pick(key, t); setLounge(true); }} />}
      <AmbientVoices voices={voices} ios={ios} setOf={setOf} show={now ? "" : hud.hearKey} onSkip={skipSet} onOpen={(key, t) => { pick(key, t); setLounge(true); }} />
    </div>
  );
}
