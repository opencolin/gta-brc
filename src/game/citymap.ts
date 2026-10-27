/**
 * The city as a map image (asked 2026-10-22): Black Rock City drawn the way the satellite photos show it,
 * in the flat, muted style of a city game's map. Painted once to an offscreen canvas from the geometry
 * in lib/games/brc.ts, then the minimap and the big map blit it under their marks.
 *
 * What the photos show that the plain plan did not: the blocks packed solid with tents, RVs and shade
 * (as speckle in a dozen pale colours), the wide radials and the Esplanade reading lighter than the
 * blocks, Rod's Road ringing Center Camp with the café in its middle, the Man's circle and the Temple's,
 * the pentagon fence with darker playa beyond it, the airport's runways past the fence at about 4:00,
 * Gate Road leaving the city at 4:30 past the airport for the gate, and tyre tracks fanning over the open playa.
 * Reference: Umbra SAR image of BRC 2025 (CC BY 4.0, Wikimedia Commons) and the 2005 Landsat view.
 */
import {
  ARC_R, ARCS, CENTER_CAMP, CENTER_CAMP_R, CAFE_R, CITY_SCALE, FENCE, FENCE_R, MAN_R, RADIALS, TEMPLE, TEMPLE_R, WIDE_RADIALS,
  arcWidth, blockBounds, clockToAngle, polar, radialWidth,
} from "@/lib/brc";

/** The map's city-space box: the whole fence and the airport beyond it. */
export const MAP_BOX = { top: -7700 * CITY_SCALE, bottom: 6250 * CITY_SCALE, half: 7300 * CITY_SCALE };

const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
/** Clock minutes → a canvas angle (canvas 0 is 3 o'clock, ours is 12). */
const cang = (min: number) => clockToAngle(min) - Math.PI / 2;

const P = {
  playa: "#e8dcc2", grain: "#dccda9", outside: "#d4c3a0", street: "#f8f1e0", block: "#d6c39d", blockEdge: "#b39a70",
  navy: "#1b1f3b", fence: "#f08a3c", plaza: "#efe5cf", runway: "#f1e9d6", track: "rgba(120, 95, 60, .16)",
};
/** What a camp looks like from above: shade cloth, RVs, white tents, a few bright ones. Weighted toward pale. */
const CAMP = ["#f6f1e6", "#f6f1e6", "#ece5d6", "#ece5d6", "#d9d0bd", "#cfc5ae", "#f3d9b4", "#dfe6e8", "#f0cdd0", "#cfe0cf", "#e9d9f0", "#f5e3a8"];

let IMG: HTMLCanvasElement | null = null;
/** The painted map, made on first use; null where there is no canvas (tests). */
export function cityImage(): HTMLCanvasElement | null {
  if (IMG) return IMG;
  if (typeof document === "undefined") return null;
  const phone = typeof window !== "undefined" && Math.min(window.innerWidth, window.innerHeight) < 700;
  const size = phone ? 1536 : 2560;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d"); if (!x) return null;
  paint(x, size);
  return (IMG = c);
}

function paint(x: CanvasRenderingContext2D, size: number) {
  // the image is square: the box's longer side, centred on the box
  const W = 2 * MAP_BOX.half, H = MAP_BOX.bottom - MAP_BOX.top, side = Math.max(W, H), s = size / side, top = MAP_BOX.top - (side - H) / 2;
  x.setTransform(s, 0, 0, s, size / 2, -top * s);
  // the playa beyond the fence, then the fenced playa over it
  x.fillStyle = P.outside; x.fillRect(-side / 2, top, side, side);
  x.fillStyle = P.playa; x.beginPath(); FENCE.forEach((p) => x.lineTo(p.x, p.y)); x.closePath(); x.fill();
  // grain: the playa's surface, a flat crust with lighter and darker patches
  for (let i = 0; i < 2600; i++) {
    const px = -MAP_BOX.half + hash(i * 4) * W, py = MAP_BOX.top + hash(i * 4 + 1) * H, r = 40 + hash(i * 4 + 2) * 260;
    x.fillStyle = hash(i * 4 + 3) < 0.5 ? "rgba(255, 250, 238, .18)" : "rgba(170, 140, 95, .09)";
    x.beginPath(); x.ellipse(px, py, r, r * (0.4 + hash(i * 7) * 0.6), hash(i * 5) * Math.PI, 0, Math.PI * 2); x.fill();
  }
  // tyre tracks: long faint lines fanning from the city's mouth over the open playa to the Temple and the fence
  x.strokeStyle = P.track; x.lineWidth = 14;
  for (let i = 0; i < 90; i++) {
    const a = polar(60 + hash(i * 3) * 600, ARC_R[0] - 150 + hash(i * 3 + 1) * 600), m2 = -90 + hash(i * 3 + 2) * 180;
    const b = polar(m2, FENCE_R * (0.55 + hash(i * 9) * 0.4));
    x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
  }
  for (let i = 0; i < 50; i++) {
    const a = polar(hash(i * 11) * 720, 300 + hash(i * 11 + 1) * 2000), b = polar(hash(i * 11 + 2) * 720, 400 + hash(i * 11 + 3) * 3200);
    x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
  }

  // the streets, light packed dust: the arcs 2:00 to 10:00, the radials across them
  x.strokeStyle = P.street;
  for (let i = 0; i < ARC_R.length; i++) {
    x.lineWidth = arcWidth(i) * 1.1;
    x.beginPath(); x.arc(0, 0, ARC_R[i], cang(120) - arcWidth(i) / 2 / ARC_R[i], cang(600) + arcWidth(i) / 2 / ARC_R[i]); x.stroke();
  }
  for (const m of RADIALS) {
    const a = polar(m, ARC_R[0]), b = polar(m, ARC_R.at(-1)! + 40);
    x.lineWidth = radialWidth(m) * 1.1; x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
  }
  // the blocks: an edge, a floor, then the camps packed in
  let seed = 7;
  for (let ring = 0; ring < ARC_R.length - 1; ring++) {
    for (let sector = 0; sector < RADIALS.length - 1; sector++) {
      const b = blockBounds(ring, sector);
      const A0 = cang(b.m0) + b.w0 / b.r0, A1 = cang(b.m1) - b.w1 / b.r0;
      x.beginPath(); x.arc(0, 0, b.r0, A0, A1); x.arc(0, 0, b.r1, A1, A0, true); x.closePath();
      x.fillStyle = P.block; x.fill(); x.strokeStyle = P.blockEdge; x.lineWidth = 16; x.stroke();
      // camps: the nearer the Esplanade the denser; a strip of shade along the street fronts, RVs behind
      const depth = b.r1 - b.r0, span = (A1 - A0) * (b.r0 + b.r1) / 2;
      const n = Math.round((depth * span) / 3000 * (ring < 2 ? 1.25 : ring > 9 ? 0.75 : 1));
      for (let k = 0; k < n; k++) {
        seed++;
        const u = hash(seed * 3), v = hash(seed * 3 + 1);
        const r = b.r0 + 18 + v * (depth - 36), a = A0 + 0.012 + u * (A1 - A0 - 0.024);
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        const big = hash(seed * 3 + 2) < 0.22;
        const w = (big ? 34 : 16) + hash(seed * 5) * (big ? 30 : 14), l = (big ? 20 : 14) + hash(seed * 5 + 1) * (big ? 16 : 12);
        x.save(); x.translate(px, py); x.rotate(a + (hash(seed * 7) < 0.7 ? 0 : hash(seed * 7 + 1) * 0.5 - 0.25));
        x.fillStyle = CAMP[Math.floor(hash(seed * 13) * CAMP.length)];
        x.fillRect(-w / 2, -l / 2, w, l);
        x.restore();
      }
    }
  }
  // Center Camp: Rod's Road rings the plaza, the café in the middle
  x.fillStyle = P.plaza; x.beginPath(); x.arc(CENTER_CAMP.x, CENTER_CAMP.y, CENTER_CAMP_R, 0, Math.PI * 2); x.fill();
  x.strokeStyle = P.street; x.lineWidth = 60; x.stroke();
  x.strokeStyle = P.blockEdge; x.lineWidth = 10; x.beginPath(); x.arc(CENTER_CAMP.x, CENTER_CAMP.y, CENTER_CAMP_R - 40, 0, Math.PI * 2); x.stroke();
  x.fillStyle = "#e8c9a4"; x.beginPath(); x.arc(CENTER_CAMP.x, CENTER_CAMP.y, CAFE_R * 1.3, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "#9c7b52"; x.lineWidth = 20; x.stroke();
  // the Man on his circle, the Temple on its
  x.fillStyle = P.plaza; x.beginPath(); x.arc(0, 0, MAN_R * 5, 0, Math.PI * 2); x.fill(); x.strokeStyle = P.blockEdge; x.lineWidth = 10; x.stroke();
  x.fillStyle = P.navy; x.beginPath(); x.arc(0, 0, MAN_R * 1.6, 0, Math.PI * 2); x.fill();
  x.fillStyle = P.plaza; x.beginPath(); x.arc(TEMPLE.x, TEMPLE.y, TEMPLE_R * 3.4, 0, Math.PI * 2); x.fill(); x.strokeStyle = P.blockEdge; x.lineWidth = 10; x.stroke();
  x.fillStyle = P.navy; x.beginPath(); x.arc(TEMPLE.x, TEMPLE.y, TEMPLE_R * 1.3, 0, Math.PI * 2); x.fill();
  // the wide radials' names ride on the plan; the three promenades to the Man read as lighter lanes
  x.strokeStyle = "rgba(255, 250, 238, .5)"; x.lineWidth = 50;
  for (const m of [180, 360, 540, 0]) { const a = polar(m, MAN_R * 5), b = polar(m, m === 0 ? TEMPLE.y * -1 - TEMPLE_R * 3.4 : ARC_R[0] - arcWidth(0) / 2); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke(); }
  // Gate Road (moved to 4:30 on 2026-10-26, past the airport): out from 4:30 & L through the fence's open wedge to the gate and on toward the highway
  x.strokeStyle = P.street; x.lineWidth = radialWidth(270) * 1.3;
  const g0 = polar(270, ARC_R.at(-1)!), g1 = polar(270, FENCE_R * 0.995), g2 = polar(270, FENCE_R * 1.25);
  x.beginPath(); x.moveTo(g0.x, g0.y); x.lineTo(g1.x, g1.y); x.lineTo(g2.x, g2.y); x.stroke();
  for (let k = 0; k < 6; k++) { const q = polar(270 + (k % 2 ? 3 : -3), FENCE_R * (1.25 + (Math.floor(k / 2) - 1) * 0.012)); x.fillStyle = CAMP[k % 4]; x.fillRect(q.x - 60, q.y - 40, 120, 80); }
  // the airport: two runways side by side past the fence at about 4:00, hangars and tie-downs beside them
  const ap = polar(252, FENCE_R * 1.09), ta = clockToAngle(252) + Math.PI / 2 + 0.35;
  x.save(); x.translate(ap.x, ap.y); x.rotate(ta);
  for (const off of [-140, 140]) { x.fillStyle = P.runway; x.fillRect(-2300, off - 55, 4600, 110); x.strokeStyle = P.blockEdge; x.lineWidth = 8; x.strokeRect(-2300, off - 55, 4600, 110); }
  x.fillStyle = P.street; x.fillRect(-1800, -520, 2200, 300);
  for (let k = 0; k < 40; k++) { x.fillStyle = CAMP[k % CAMP.length]; x.fillRect(-1700 + (k % 10) * 210, -500 + Math.floor(k / 10) * 70, 70 + hash(k) * 60, 40); }
  x.restore();
  // the fence, dashed
  x.strokeStyle = P.fence; x.lineWidth = 36; x.setLineDash([180, 110]);
  x.beginPath(); FENCE.forEach((p) => x.lineTo(p.x, p.y)); x.closePath(); x.stroke(); x.setLineDash([]);
  // street names along the outside of L, and the clock at each wide radial's end, in the map's own hand
  x.fillStyle = P.navy; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `700 ${180}px system-ui, sans-serif`;
  for (const m of WIDE_RADIALS) { const p = polar(m, ARC_R.at(-1)! + 330); x.fillText(clockLabel(m), p.x, p.y); }
  x.font = `600 ${120}px system-ui, sans-serif`;
  for (const i of [0, 2, 4, 6, 8, 10, 12]) { const p = polar(606, ARC_R[i]); x.fillText(ARCS[i] === "Esplanade" ? "Esp" : ARCS[i], p.x, p.y); }
  x.font = `600 ${150}px system-ui, sans-serif`;
  x.fillText("airport", ap.x, ap.y + 700); x.fillText("gate", g2.x, g2.y + 260);
  x.setTransform(1, 0, 0, 1, 0, 0);
}
const clockLabel = (min: number) => `${Math.floor(min / 60) || 12}:${String(min % 60).padStart(2, "0")}`;

/* ── the desert round the city ───────────────────────────────────────────── */

/** The surroundings reach this many times the city image's side out from its middle (asked 2026-10-22: the big map is full screen, the dust goes on). */
export const AROUND = 4;
let AROUND_IMG: HTMLCanvasElement | null = null;
/**
 * The Black Rock Desert beyond the fence at a coarser scale: the playa crust with its lighter and darker
 * drifts, tyre tracks fanning out from the gate, Gate Road running off toward the highway, and the ranges
 * that close the playa in: dark hills along the west (left) and the north-east, the way the Landsat view has
 * them, with the dust flats open to the south.
 */
export function surroundImage(): HTMLCanvasElement | null {
  if (AROUND_IMG) return AROUND_IMG;
  if (typeof document === "undefined") return null;
  const size = 1536;
  const c = document.createElement("canvas"); c.width = c.height = size;
  const x = c.getContext("2d"); if (!x) return null;
  const W = 2 * MAP_BOX.half, H = MAP_BOX.bottom - MAP_BOX.top, side = Math.max(W, H) * AROUND, s = size / side;
  const cy = (MAP_BOX.top + MAP_BOX.bottom) / 2;
  x.setTransform(s, 0, 0, s, size / 2, size / 2 - cy * s);
  x.fillStyle = P.outside; x.fillRect(-side / 2, cy - side / 2, side, side);
  // the crust: broad pale and dark drifts, finer the nearer the city
  for (let i = 0; i < 1800; i++) {
    const px = -side / 2 + hash(i * 4 + 0.5) * side, py = cy - side / 2 + hash(i * 4 + 1.5) * side, r = 200 + hash(i * 4 + 2.5) * 1800;
    x.fillStyle = hash(i * 4 + 3.5) < 0.5 ? "rgba(255, 250, 238, .14)" : "rgba(170, 140, 95, .08)";
    x.beginPath(); x.ellipse(px, py, r, r * (0.3 + hash(i * 7 + 0.5) * 0.5), hash(i * 5 + 0.5) * Math.PI, 0, Math.PI * 2); x.fill();
  }
  // tyre tracks and the desert's own tracks: long faint lines, most of them running toward the gate
  x.strokeStyle = "rgba(120, 95, 60, .14)"; x.lineWidth = 60;
  const gate = polar(270, FENCE_R * 1.25);
  for (let i = 0; i < 70; i++) {
    const a = polar(hash(i * 3 + 0.25) * 720, FENCE_R * (1 + hash(i * 3 + 1.25) * 2.2));
    const b = hash(i * 3 + 2.25) < 0.6 ? gate : polar(hash(i * 9 + 0.25) * 720, FENCE_R * (1 + hash(i * 9 + 1.25) * 2.2));
    x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
  }
  // Gate Road on to the highway, off the bottom left; the county road along the playa's west edge
  x.strokeStyle = P.street; x.lineWidth = 170;
  const road = [gate, polar(428, FENCE_R * 1.6), polar(440, FENCE_R * 2.3), polar(452, FENCE_R * 3.2)];
  x.beginPath(); road.forEach((q) => x.lineTo(q.x, q.y)); x.stroke();
  x.lineWidth = 120; x.beginPath(); x.moveTo(-side / 2 + side * 0.09, cy + side / 2); x.lineTo(-side / 2 + side * 0.06, cy - side / 2); x.stroke();
  // the ranges: dark hills with lighter spurs, west and north-east, their feet fading into the dust
  const hills = (cx: number, hy: number, w: number, h: number, seed: number) => {
    for (let i = 0; i < 160; i++) {
      const u = hash(seed + i * 2.1), v = hash(seed + i * 2.1 + 1), r = 300 + hash(seed + i * 3.3) * 1400;
      const px = cx + (u - 0.5) * w, py = hy + (v - 0.5) * h, edge = Math.max(Math.abs(u - 0.5) * 2, Math.abs(v - 0.5) * 2);
      x.fillStyle = hash(seed + i * 5.5) < 0.35 ? `rgba(130, 110, 85, ${0.5 - edge * 0.4})` : `rgba(78, 66, 52, ${0.55 - edge * 0.45})`;
      x.beginPath(); x.ellipse(px, py, r, r * 0.55, hash(seed + i * 7.7) * Math.PI, 0, Math.PI * 2); x.fill();
    }
  };
  hills(-side / 2 + side * 0.17, cy, side * 0.22, side * 0.95, 11);     // the Granite Range side, west
  hills(side / 2 - side * 0.14, cy - side * 0.3, side * 0.2, side * 0.6, 23); // the Calico and Jackson hills, north-east
  hills(0, cy - side / 2 + side * 0.07, side * 0.7, side * 0.12, 37);   // the far shore to the north
  x.setTransform(1, 0, 0, 1, 0, 0);
  return (AROUND_IMG = c);
}

/** Blit the desert, then the city, under a context already transformed into city space. */
export function drawCityImage(ctx: CanvasRenderingContext2D): boolean {
  const img = cityImage();
  if (!img) return false;
  const W = 2 * MAP_BOX.half, H = MAP_BOX.bottom - MAP_BOX.top, side = Math.max(W, H), top = MAP_BOX.top - (side - H) / 2;
  const around = surroundImage();
  if (around) { const big = side * AROUND, cy = (MAP_BOX.top + MAP_BOX.bottom) / 2; ctx.drawImage(around, -big / 2, cy - big / 2, big, big); }
  ctx.drawImage(img, -side / 2, top, side, side);
  return true;
}
