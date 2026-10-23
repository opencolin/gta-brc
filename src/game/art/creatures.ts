type Ctx = CanvasRenderingContext2D;
export type DrawPiece = (c: Ctx, t: number, night: number, r: number) => void;
const hsl = (h: number, s = 85, l = 60, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
const NAVY = "#1b1f3b";
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const disc = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const glow = (c: Ctx, night: number, col: string, blur = 14) => { c.shadowColor = night > 0.3 ? col : "transparent"; c.shadowBlur = night > 0.3 ? blur : 0; };
const noGlow = (c: Ctx) => { c.shadowBlur = 0; c.shadowColor = "transparent"; };

/** Space Whale (The Pier Group / Matt Schultz, 2016): a stained-glass humpback mother and her calf breaching, lit from inside at night. */
function spaceWhale(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, lit = night > 0.3;
  c.fillStyle = "rgba(27,31,59,.16)"; c.beginPath(); c.ellipse(5 * s, 7 * s, 30 * s, 26 * s, 0, 0, Math.PI * 2); c.fill();
  const whale = (x: number, y: number, k: number, ang: number) => {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(k, k);
    // the silhouette: a rounded head, the body tapering to the tail stock, the two-lobed fluke
    const body = () => { c.beginPath(); c.moveTo(0, -24); c.bezierCurveTo(9, -24, 10, -8, 7, 8); c.quadraticCurveTo(5, 18, 3, 24); c.quadraticCurveTo(11, 24, 12, 31); c.quadraticCurveTo(4, 27, 0, 30); c.quadraticCurveTo(-4, 27, -12, 31); c.quadraticCurveTo(-11, 24, -3, 24); c.quadraticCurveTo(-5, 18, -7, 8); c.bezierCurveTo(-10, -8, -9, -24, 0, -24); c.closePath(); };
    c.fillStyle = lit ? hsl(195, 90, 62) : hsl(200, 60, 45); // the long pectoral fins
    for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 6, -10); c.quadraticCurveTo(sg * 20, -4, sg * 26, 6); c.quadraticCurveTo(sg * 16, 4, sg * 7, -2); c.closePath(); c.fill(); }
    glow(c, night, "#8fd8ff", 16); body(); c.fillStyle = lit ? "#bfefff" : "#3a6fa8"; c.fill(); noGlow(c);
    c.save(); body(); c.clip(); // panes of blue, teal and violet glass in their dark leading
    for (let j = -24; j < 32; j += 6) for (let i = -12; i < 12; i += 6) { const n = ((i + j) / 6 + 40) % 3; c.fillStyle = hsl(n === 0 ? 215 : n === 1 ? 180 : 275, 80, lit ? 62 : 46); c.fillRect(i, j, 6, 6); }
    c.strokeStyle = "#23242c"; c.lineWidth = 0.9;
    for (let j = -24; j < 32; j += 6) { c.beginPath(); c.moveTo(-12, j); c.lineTo(12, j); c.stroke(); }
    for (let i = -12; i <= 12; i += 6) { c.beginPath(); c.moveTo(i, -24); c.lineTo(i, 32); c.stroke(); }
    c.restore(); body(); c.strokeStyle = "#23242c"; c.lineWidth = 1.1; c.stroke(); c.lineWidth = 1; c.restore();
  };
  whale(-6 * s, 2 * s, s, -0.25);
  whale(16 * s, 10 * s, s * 0.5, 0.35);
}
/** Ursa Mater (Mr & Mrs Ferguson, 2017): a mother bear and her cub, clad in some 200,000 pennies that glint at night. */
function ursaMater(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, lit = night > 0.3;
  c.fillStyle = "rgba(27,31,59,.16)"; c.beginPath(); c.ellipse(4 * s, 6 * s, 34 * s, 24 * s, 0, 0, Math.PI * 2); c.fill();
  const bear = (x: number, y: number, k: number, ang: number, seed: number) => {
    c.save(); c.translate(x, y); c.rotate(ang); c.scale(k, k);
    const body = () => { c.beginPath(); c.moveTo(0, -20); c.bezierCurveTo(9, -20, 13, -8, 13, 4); c.bezierCurveTo(13, 14, 7, 20, 0, 20); c.bezierCurveTo(-7, 20, -13, 14, -13, 4); c.bezierCurveTo(-13, -8, -9, -20, 0, -20); c.closePath(); };
    c.fillStyle = "#a9652a"; for (const sg of [-1, 1]) { disc(c, sg * 5, -26, 2.4); c.fill(); } // the ears, then the head and snout
    disc(c, 0, -23, 6.5); c.fill(); c.fillStyle = "#c98a46"; disc(c, 0, -27, 2.6); c.fill(); c.fillStyle = "#2b2622"; disc(c, 0, -28.5, 1.1); c.fill();
    body(); c.fillStyle = "#9a5a26"; c.fill();
    c.save(); body(); c.clip(); // the pennies: a sunflower scatter of copper dots
    for (let i = 0; i < 140; i++) { const a = i * 2.3999 + seed, d = Math.sqrt(i / 140); c.fillStyle = hsl(26 + (i % 3) * 4, 62, 38 + (i % 5) * 7); disc(c, Math.cos(a) * d * 13.5, Math.sin(a) * d * 20.5, 1.6); c.fill(); }
    if (lit) { glow(c, night, "#ffe2a8", 10); c.fillStyle = "#fff0c8"; for (let i = 0; i < 140; i += 9) if (Math.sin(t * 2.3 + i * 0.37 + seed) > 0.93) { const a = i * 2.3999 + seed, d = Math.sqrt(i / 140); disc(c, Math.cos(a) * d * 13.5, Math.sin(a) * d * 20.5, 1.1); c.fill(); } noGlow(c); }
    c.restore(); body(); c.strokeStyle = "#5a3412"; c.lineWidth = 0.9; c.stroke(); c.lineWidth = 1; c.restore();
  };
  bear(-8 * s, 2 * s, s, -0.3, 0);
  bear(17 * s, 9 * s, s * 0.55, 0.6, 1.7);
}
/** Penny the Goose (Mr & Mrs Ferguson, 2026): a giant copper goose standing, neck raised, wings half spread. */
function pennyTheGoose(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, lit = night > 0.3, copper = lit ? "#d8893c" : "#c3732c", dark = "#7a4314";
  c.fillStyle = "rgba(27,31,59,.16)"; c.beginPath(); c.ellipse(5 * s, 8 * s, 36 * s, 24 * s, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.scale(s, s);
  for (const sg of [-1, 1]) { // the wings, their feather rows fanning from the shoulder
    c.beginPath(); c.moveTo(sg * 5, -2); c.quadraticCurveTo(sg * 20, -16, sg * 36, -4); c.quadraticCurveTo(sg * 34, 10, sg * 20, 18); c.quadraticCurveTo(sg * 10, 16, sg * 5, 8); c.closePath();
    c.fillStyle = copper; c.fill(); c.strokeStyle = dark; c.lineWidth = 1; c.stroke();
    c.save(); c.clip(); c.lineWidth = 0.7;
    for (let k = 0; k < 7; k++) { const a = -0.9 + k * 0.3; c.beginPath(); c.moveTo(sg * 6, 2); c.lineTo(sg * Math.cos(a) * 40, 2 + Math.sin(a) * 40); c.stroke(); }
    for (const q of [14, 24]) { c.beginPath(); c.arc(sg * 6, 2, q, 0, Math.PI * 2); c.stroke(); }
    c.restore();
  }
  // the body: a teardrop, wide at the rump, the tail pointed behind
  c.fillStyle = copper; c.beginPath(); c.moveTo(0, -10); c.bezierCurveTo(11, -8, 13, 12, 6, 22); c.lineTo(0, 30); c.lineTo(-6, 22); c.bezierCurveTo(-13, 12, -11, -8, 0, -10); c.closePath(); c.fill(); c.strokeStyle = dark; c.lineWidth = 1; c.stroke();
  // the neck raised, the head and its dark beak
  c.strokeStyle = copper; c.lineWidth = 5; c.lineCap = "round"; c.beginPath(); c.moveTo(0, -6); c.quadraticCurveTo(1, -18, 0, -28); c.stroke();
  c.strokeStyle = dark; c.lineWidth = 1; c.lineCap = "butt"; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 2.5, -6); c.quadraticCurveTo(sg * 3.5, -18, sg * 2.5, -27); c.stroke(); }
  c.fillStyle = copper; c.beginPath(); c.ellipse(0, -31, 4.2, 5.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
  c.fillStyle = "#2b2622"; c.beginPath(); c.moveTo(-2.4, -34); c.lineTo(0, -42); c.lineTo(2.4, -34); c.closePath(); c.fill();
  for (const sg of [-1, 1]) { disc(c, sg * 2.6, -32, 0.9); c.fill(); }
  if (lit) { glow(c, night, "#ffb060", 14); c.fillStyle = "rgba(255,200,120,.35)"; c.beginPath(); c.ellipse(0, 6, 10, 16, 0, 0, Math.PI * 2); c.fill(); noGlow(c); } // the spotlights' sheen
  c.restore();
}
/** Fire Horse (Victor Spinelli, 2026): a steampunk horse rearing, brass gears, pipes and rivets, its mane aflame at night. */
function fireHorse(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, lit = night > 0.3, brass = "#b08035", dark = "#5c3d12";
  c.fillStyle = "rgba(27,31,59,.16)"; c.beginPath(); c.ellipse(5 * s, 8 * s, 26 * s, 34 * s, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.scale(s, s);
  const gear = (x: number, y: number, R: number, n: number) => { c.beginPath(); for (let i = 0; i < n * 4; i++) { const a = (i / (n * 4)) * Math.PI * 2, q = i % 4 < 2 ? R : R * 0.76; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); c.fillStyle = "#d1a040"; c.fill(); c.strokeStyle = dark; c.lineWidth = 0.7; c.stroke(); c.fillStyle = dark; disc(c, x, y, R * 0.3); c.fill(); };
  c.strokeStyle = "#6e4a1c"; c.lineWidth = 4; c.lineCap = "round"; // the hind legs planted, the forelegs raised out beside the neck
  for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 6, 16); c.lineTo(sg * 12, 30); c.stroke(); c.beginPath(); c.moveTo(sg * 5, -8); c.lineTo(sg * 14, -20); c.stroke(); }
  c.lineCap = "butt"; c.strokeStyle = dark; c.lineWidth = 1;
  c.fillStyle = brass; c.beginPath(); c.moveTo(0, 26); c.bezierCurveTo(12, 24, 12, 4, 7, -6); c.lineTo(-7, -6); c.bezierCurveTo(-12, 4, -12, 24, 0, 26); c.closePath(); c.fill(); c.stroke(); // the back
  c.fillStyle = "#c08a3a"; c.beginPath(); c.moveTo(-7, -6); c.quadraticCurveTo(-5, -22, -3, -32); c.lineTo(3, -32); c.quadraticCurveTo(5, -22, 7, -6); c.closePath(); c.fill(); c.stroke(); // the neck
  c.fillStyle = "#a8762a"; rr(c, -3.5, -42, 7, 12, [3, 3, 2, 2]); c.fill(); c.stroke(); // the head and ears
  for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 2, -41); c.lineTo(sg * 4, -46); c.lineTo(sg * 4.5, -40); c.closePath(); c.fill(); }
  c.strokeStyle = "#7d5a2a"; c.lineWidth = 1.6; for (const x of [-3, 3]) { c.beginPath(); c.moveTo(x, 22); c.lineTo(x, -4); c.stroke(); } // the pipes along the spine
  c.fillStyle = "#e8c36a"; for (let y = -2; y < 24; y += 5) for (const x of [-8, 8]) { disc(c, x * 0.9, y, 0.7); c.fill(); } // the rivets
  gear(0, 10, 5, 8); gear(-5, 0, 3.2, 7); gear(6, 2, 2.6, 6); gear(0, -16, 3, 7); c.lineWidth = 1;
  if (lit) { glow(c, night, "#ff7a1c", 18); for (let k = 0; k < 7; k++) { const y = -30 + k * 4, f = Math.sin(t * 9 + k * 1.3); c.fillStyle = hsl(22 + f * 14, 100, 58, 0.9); c.beginPath(); c.moveTo(-2, y); c.quadraticCurveTo(-9 - f * 3, y - 4 - f * 2, -11 - Math.abs(f) * 5, y + 1); c.quadraticCurveTo(-7, y + 2, -2, y + 3); c.fill(); } noGlow(c); }
  else { c.strokeStyle = dark; c.lineWidth = 1.2; for (let k = 0; k < 7; k++) { const y = -30 + k * 4; c.beginPath(); c.moveTo(-4, y); c.lineTo(-9, y + 2); c.stroke(); } c.lineWidth = 1; } // the mane's brass strands by day
  c.restore();
}
/** Medusa Madness (Kevin Clark, 2015): a stone-grey steel Medusa, her crown of snakes writhing and breathing fire at night. */
function medusaMadness(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, lit = night > 0.3;
  c.fillStyle = "rgba(27,31,59,.16)"; c.beginPath(); c.ellipse(4 * s, 5 * s, 40 * s, 40 * s, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.scale(s, s); c.lineCap = "round";
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + Math.sin(t * 0.9 + k) * 0.08, sway = Math.sin(t * 1.7 + k * 1.9) * 0.35, L = 31 + (k % 3) * 4;
    const ax = Math.cos(a + sway) * L * 0.6, ay = Math.sin(a + sway) * L * 0.6, ex = Math.cos(a - sway * 0.6) * L, ey = Math.sin(a - sway * 0.6) * L;
    c.strokeStyle = k % 2 ? "#767c85" : "#5b616a"; c.lineWidth = 3.2 - (k % 2) * 0.6;
    c.beginPath(); c.moveTo(Math.cos(a) * 14, Math.sin(a) * 14); c.quadraticCurveTo(ax, ay, ex, ey); c.stroke();
    c.fillStyle = "#8d939b"; disc(c, ex, ey, 2.2); c.fill();
    if (lit && Math.sin(t * 3 + k * 2.1) > 0) { const f = 0.5 + 0.5 * Math.sin(t * 15 + k), d = Math.atan2(ey - ay, ex - ax), len = 5 + f * 4;
      glow(c, night, "#ff8a1c", 12); c.fillStyle = hsl(25 + f * 20, 100, 58, 0.9);
      c.beginPath(); c.moveTo(ex + Math.cos(d + 1.1) * 2, ey + Math.sin(d + 1.1) * 2); c.lineTo(ex + Math.cos(d) * len, ey + Math.sin(d) * len); c.lineTo(ex + Math.cos(d - 1.1) * 2, ey + Math.sin(d - 1.1) * 2); c.closePath(); c.fill(); noGlow(c); }
  }
  c.lineCap = "butt"; c.lineWidth = 1;
  c.fillStyle = "#9a9ea6"; disc(c, 0, 0, 15); c.fill(); c.strokeStyle = "#5b616a"; c.stroke(); // the face
  c.fillStyle = "#858a93"; c.beginPath(); c.moveTo(0, -2); c.lineTo(-2.5, 4); c.lineTo(2.5, 4); c.closePath(); c.fill(); // the nose
  c.strokeStyle = "#4a4f58"; c.lineWidth = 1.2; c.fillStyle = NAVY;
  for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * 5.5, -4, 3, 1.6, sg * 0.25, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(sg * 2.5, -8.5); c.lineTo(sg * 8.5, -7); c.stroke(); } // the eyes and brows
  c.fillStyle = "#3a3e47"; c.beginPath(); c.ellipse(0, 8.5, 3.5, 2.6, 0, 0, Math.PI * 2); c.fill(); c.lineWidth = 1; // the mouth, open
  c.restore();
}
/** Mariposa (Christopher Schardt, 2024): an aluminium butterfly hovering 15 ft up, wings slowly flapping, 39,000 LEDs rolling colour at night. */
function mariposa(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, lit = night > 0.3, flap = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.3));
  c.fillStyle = "rgba(27,31,59,.12)"; c.beginPath(); c.ellipse(14 * s, 16 * s, 34 * s * flap, 30 * s, 0, 0, Math.PI * 2); c.fill(); // its shadow, far off: it floats
  c.save(); c.scale(s, s);
  const wing = (sg: number) => { c.beginPath(); c.moveTo(sg * 2, -4); c.bezierCurveTo(sg * 14, -30, sg * 34, -30, sg * 36, -14); c.bezierCurveTo(sg * 36, -4, sg * 22, 2, sg * 10, 2); c.bezierCurveTo(sg * 26, 4, sg * 32, 14, sg * 26, 24); c.bezierCurveTo(sg * 18, 32, sg * 8, 24, sg * 3, 10); c.closePath(); };
  for (const sg of [-1, 1]) {
    c.save(); c.scale(flap, 1); // the hinged wings squeeze and spread
    wing(sg); c.fillStyle = lit ? "#2a2f45" : "#d4d8de"; c.fill();
    c.save(); wing(sg); c.clip();
    if (lit) { c.lineWidth = 3; for (let q = 4; q < 44; q += 4) { c.strokeStyle = hsl((q * 8 - t * 140 + 36000) % 360, 100, 60); c.beginPath(); c.arc(0, 0, q, 0, Math.PI * 2); c.stroke(); } }
    else { c.strokeStyle = "#9aa0a8"; c.lineWidth = 0.8; for (let k = 0; k < 6; k++) { const a = -1.4 + k * 0.5; c.beginPath(); c.moveTo(sg * 2, -2); c.lineTo(sg * Math.cos(a) * 40, Math.sin(a) * 40); c.stroke(); } } // the veins by day
    c.restore(); wing(sg); c.strokeStyle = lit ? "#8fd0ff" : "#8d939b"; c.lineWidth = 1; c.stroke();
    c.restore();
  }
  c.fillStyle = "#b9bec6"; c.beginPath(); c.ellipse(0, 4, 2.6, 14, 0, 0, Math.PI * 2); c.fill(); disc(c, 0, -11, 3.2); c.fill(); // the body and head
  c.strokeStyle = "#9aa0a8"; c.lineWidth = 0.8; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg, -13); c.quadraticCurveTo(sg * 6, -22, sg * 9, -24); c.stroke(); } c.lineWidth = 1; // the antennae
  if (lit) { glow(c, night, "#8fd0ff", 16); c.fillStyle = "#cfefff"; c.beginPath(); c.ellipse(0, 4, 2.6, 14, 0, 0, Math.PI * 2); c.fill(); noGlow(c); }
  c.restore();
}

export const PIECES: Record<string, DrawPiece> = { "space-whale": spaceWhale, "ursa-mater": ursaMater, "penny-the-goose": pennyTheGoose, "fire-horse": fireHorse, "medusa-madness": medusaMadness, "mariposa": mariposa };
