type Ctx = CanvasRenderingContext2D;
export type DrawPiece = (c: Ctx, t: number, night: number, r: number) => void;
const hsl = (h: number, s = 85, l = 60, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
const NAVY = "#1b1f3b";
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const disc = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const glow = (c: Ctx, night: number, col: string, blur = 14) => { c.shadowColor = night > 0.3 ? col : "transparent"; c.shadowBlur = night > 0.3 ? blur : 0; };
const noGlow = (c: Ctx) => { c.shadowBlur = 0; c.shadowColor = "transparent"; };

/** The Orb (Bjarke Ingels & Jakob Lange, 2018): a 100-ft mirrored sphere hung from a tilted steel mast. */
function theOrb(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, R = 30 * s;
  // the sphere's long shadow thrown off to +x +y, the mast's thin one beside it
  c.fillStyle = "rgba(27, 31, 59, .18)"; c.beginPath(); c.ellipse(18 * s, 20 * s, R * 1.15, R * 0.72, 0.6, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(27, 31, 59, .18)"; c.lineWidth = 2.2 * s; c.beginPath(); c.moveTo(-40 * s, 24 * s); c.lineTo(8 * s, 16 * s); c.stroke();
  // the mast: a steel tube from its footing on the far side, leaning in to the sphere's rim
  c.fillStyle = "#5c6170"; disc(c, -44 * s, 10 * s, 3 * s); c.fill();
  c.strokeStyle = "#4a4f5e"; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(-44 * s, 10 * s); c.lineTo(-R * 0.92, 3 * s); c.stroke();
  // the mirror: the sky reflected, a hot highlight up-left, the rim curving away darker
  const g = c.createRadialGradient(-R * 0.35, -R * 0.4, R * 0.05, 0, 0, R);
  g.addColorStop(0, "#ffffff"); g.addColorStop(0.3, "#e4f1fb"); g.addColorStop(0.75, night > 0.3 ? "#7d8bb0" : "#9fc4e6"); g.addColorStop(1, night > 0.3 ? "#2a3052" : "#6b8db0");
  c.fillStyle = g; disc(c, 0, 0, R); c.fill(); c.strokeStyle = "rgba(27, 31, 59, .45)"; c.lineWidth = s; c.stroke();
  // the playa reflected across the lower rim, the sun's gleam
  c.fillStyle = "rgba(230, 211, 174, .35)"; c.beginPath(); c.ellipse(R * 0.2, R * 0.55, R * 0.6, R * 0.22, 0.25, 0, Math.PI * 2); c.fill();
  c.fillStyle = "rgba(255, 255, 255, .85)"; c.beginPath(); c.ellipse(-R * 0.4, -R * 0.45, R * 0.16, R * 0.08, -0.7, 0, Math.PI * 2); c.fill();
  // at night the city's lights crawl across the mirror as the art cars go by
  if (night > 0.3) { glow(c, night, "#ffffff", 8); for (let k = 0; k < 9; k++) { const a = k * 0.7 + t * 0.15 * (k % 2 ? 1 : -1), d = R * (0.45 + 0.35 * Math.sin(k * 1.3)); c.fillStyle = hsl((k * 40 + t * 20) % 360, 100, 70, 0.8); disc(c, Math.cos(a) * d, Math.sin(a) * d, 0.8 * s); c.fill(); } noGlow(c); }
  c.lineWidth = 1;
}
/** Big Rig Jig (Mike Ross, 2007): two 18-wheeler tankers bent nose to tail into an arch, one standing up on the other's tail. */
function bigRigJig(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50;
  c.fillStyle = "rgba(27, 31, 59, .18)"; c.beginPath(); c.ellipse(10 * s, 14 * s, 40 * s, 9 * s, 0.25, 0, Math.PI * 2); c.fill();
  // a tanker: dark rubber wheels in pairs down both sides, the silver barrel and its ribs, the cab at x = 0
  const tanker = (len: number, wid: number, lit: number) => {
    c.fillStyle = "#1f2130"; for (let x = 8 * s; x < len - 4 * s; x += 9 * s) { c.fillRect(x, wid / 2 - s, 5 * s, 2.6 * s); c.fillRect(x, -wid / 2 - 1.6 * s, 5 * s, 2.6 * s); }
    const g = c.createLinearGradient(0, -wid / 2, 0, wid / 2); g.addColorStop(0, "#9aa0ad"); g.addColorStop(0.4, lit > 0 ? "#eef0f4" : "#c9ccd4"); g.addColorStop(1, "#7f8593");
    c.fillStyle = g; rr(c, 6 * s, -wid / 2, len - 6 * s, wid, wid / 2); c.fill();
    c.strokeStyle = "rgba(27, 31, 59, .35)"; c.lineWidth = 0.6 * s; for (let x = 12 * s; x < len - 4 * s; x += 6 * s) { c.beginPath(); c.moveTo(x, -wid / 2 + s); c.lineTo(x, wid / 2 - s); c.stroke(); }
    c.fillStyle = "#d8d3c6"; rr(c, 0, -wid * 0.42, 7 * s, wid * 0.84, 1.2 * s); c.fill(); c.fillStyle = "#2a3148"; c.fillRect(1.2 * s, -wid * 0.3, 1.6 * s, wid * 0.6);
  };
  // the lower truck lying along the ground, cab on the left, its tail curling up at the joint
  c.save(); c.translate(-44 * s, 2 * s); tanker(54 * s, 11 * s, 1); c.restore();
  // the upper truck foreshortened as it climbs over and its cab comes back down on the far side
  c.save(); c.translate(12 * s + Math.cos(-0.25) * 27 * s, -2 * s + Math.sin(-0.25) * 27 * s); c.rotate(Math.PI - 0.25); tanker(27 * s, 9 * s, 0); c.restore();
  // the joint: the welded knuckle where tail meets tail
  c.fillStyle = "#4b4f5c"; disc(c, 11 * s, 0, 5 * s); c.fill(); c.strokeStyle = "#2c2f3a"; c.lineWidth = 1.2 * s; c.stroke();
  c.beginPath(); c.moveTo(7.5 * s, -3.5 * s); c.lineTo(14.5 * s, 3.5 * s); c.moveTo(7.5 * s, 3.5 * s); c.lineTo(14.5 * s, -3.5 * s); c.stroke();
  // a rust bloom and the cab windows' faint glow at night
  c.fillStyle = "rgba(150, 80, 30, .25)"; disc(c, -10 * s, 4 * s, 4 * s); c.fill(); disc(c, 24 * s, -6 * s, 3 * s); c.fill();
  if (night > 0.3) { glow(c, night, "#ffd27a", 10); c.fillStyle = `rgba(255, 210, 120, ${0.5 + 0.1 * Math.sin(t * 2)})`; c.fillRect(-42.8 * s, -1.3 * s, 1.6 * s, 6.6 * s); noGlow(c); }
  c.lineWidth = 1;
}
/** Lodestar (Randy Polumbo, 2019): a 1962 Lockheed JetStar stood on its tail, nose to the sky, its belly a garden of blown-glass flowers. */
function lodestar(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, white = "#f4f5fa", edge = "#9aa1b8";
  c.fillStyle = "rgba(27, 31, 59, .18)"; c.beginPath(); c.ellipse(16 * s, 18 * s, 8 * s, 26 * s, -0.75, 0, Math.PI * 2); c.fill();
  // the T-tail at the bottom of the stack: the fin runs off to +y, the stabilizer across its end
  c.fillStyle = "#d9dde8"; c.strokeStyle = edge; c.lineWidth = 0.6 * s;
  c.beginPath(); c.moveTo(-1.4 * s, 4 * s); c.lineTo(1.4 * s, 4 * s); c.lineTo(0.9 * s, 15 * s); c.lineTo(-0.9 * s, 15 * s); c.closePath(); c.fill(); c.stroke();
  rr(c, -10 * s, 13.5 * s, 20 * s, 2.4 * s, 1.2 * s); c.fill(); c.stroke();
  // the wings: seen nearly edge-on as slim swept blades, a slipper tank midway along each
  for (const sg of [-1, 1]) {
    c.fillStyle = white; c.beginPath(); c.moveTo(sg * 5 * s, -2 * s); c.lineTo(sg * 27 * s, 3.5 * s); c.lineTo(sg * 27 * s, 5 * s); c.lineTo(sg * 5 * s, 1.5 * s); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = "#c9ced9"; c.beginPath(); c.ellipse(sg * 16 * s, 2.6 * s, 2.6 * s, 1.5 * s, 0, 0, Math.PI * 2); c.fill(); c.stroke();
    // the paired engine pods on the rear fuselage, seen end-on
    c.fillStyle = "#b9bfd0"; c.beginPath(); c.ellipse(sg * 7.5 * s, 3.5 * s, 3.2 * s, 2.4 * s, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#6f7790"; c.stroke(); c.strokeStyle = edge;
    c.fillStyle = "#3b4157"; disc(c, sg * 6.5 * s, 3.2 * s, 1.1 * s); c.fill(); disc(c, sg * 8.8 * s, 3.9 * s, 1.1 * s); c.fill();
  }
  // the glass garden on the belly: blossoms around the fuselage, lit from within at night
  for (let k = 0; k < 10; k++) {
    const a = k * Math.PI / 5 + 0.3, d = 10.5 * s, x = Math.cos(a) * d, y = 1.5 * s + Math.sin(a) * d * 0.8, pink = k % 2 === 0, tw = night > 0.3 ? 0.75 + 0.25 * Math.sin(t * 3 + k * 1.7) : 1;
    glow(c, night, pink ? "#ff5fb0" : "#5ee07a", 12); c.fillStyle = pink ? hsl(330, 90, 50 + 20 * tw) : hsl(135, 70, 40 + 22 * tw);
    for (let p = 0; p < 5; p++) { disc(c, x + Math.cos(p * 1.257) * 1.3 * s, y + Math.sin(p * 1.257) * 1.3 * s, 1.1 * s); c.fill(); }
    noGlow(c); c.fillStyle = "#fff6c8"; disc(c, x, y, 0.8 * s); c.fill();
  }
  // the fuselage nose-on: a white disc, the radome's cap, the cockpit's windows below the brow
  c.fillStyle = white; disc(c, 0, 0, 5.2 * s); c.fill(); c.strokeStyle = edge; c.stroke();
  c.fillStyle = "#e4e7ef"; disc(c, 0, 0, 3 * s); c.fill(); c.fillStyle = "#26304a"; c.beginPath(); c.arc(0, 0.6 * s, 4.2 * s, 0.35, Math.PI - 0.35); c.arc(0, 0.6 * s, 2.8 * s, Math.PI - 0.35, 0.35, true); c.closePath(); c.fill();
  c.fillStyle = "#c0362c"; c.fillRect(-5.2 * s, -0.6 * s, 1.6 * s, 1.2 * s); c.fillRect(3.6 * s, -0.6 * s, 1.6 * s, 1.2 * s);
  c.lineWidth = 1;
}
/** Head Maze (Matt Schultz, 2019): a giant wooden head lying face up, its interior a maze. */
function headMaze(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, rx = 30 * s, ry = 41 * s;
  c.fillStyle = "rgba(27, 31, 59, .18)"; c.beginPath(); c.ellipse(7 * s, 8 * s, rx * 1.05, ry * 1.02, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.clip();
  // the skin: pale wood slats across the whole head, the ears either side
  c.fillStyle = "#dcbb8c"; c.fillRect(-rx, -ry, rx * 2, ry * 2);
  c.strokeStyle = "rgba(120, 80, 40, .35)"; c.lineWidth = 0.6 * s; for (let y = -ry; y < ry; y += 3 * s) { c.beginPath(); c.moveTo(-rx, y); c.lineTo(rx, y); c.stroke(); }
  // the cranium opened up: the maze's corridors as dark lines between the slats
  c.strokeStyle = "#4a3420"; c.lineWidth = 1.1 * s; c.lineCap = "round";
  for (let i = -5; i <= 5; i++) for (let j = -7; j <= -2; j++) { const x = i * 5 * s, y = j * 5 * s, h = (i * 7 + j * 13 + 40) % 3; c.beginPath(); if (h === 0) { c.moveTo(x, y); c.lineTo(x + 5 * s, y); } else if (h === 1) { c.moveTo(x, y); c.lineTo(x, y + 5 * s); } else { c.moveTo(x, y + 5 * s); c.lineTo(x + 5 * s, y + 5 * s); } c.stroke(); }
  c.beginPath(); c.ellipse(0, -10 * s, rx * 0.86, 24 * s, 0, Math.PI, Math.PI * 2); c.stroke();
  if (night > 0.3) { glow(c, night, "#ffb347", 16); c.strokeStyle = hsl(32, 100, 62, 0.6 + 0.15 * Math.sin(t * 2.3)); c.lineWidth = 0.7 * s; c.beginPath(); c.moveTo(-15 * s, -27 * s); c.lineTo(-15 * s, -17 * s); c.lineTo(5 * s, -17 * s); c.lineTo(5 * s, -32 * s); c.stroke(); noGlow(c); }
  c.lineCap = "butt";
  // the face: brows, the nose ridge, nostrils, the lips, all raised slats casting a thin shade
  c.strokeStyle = "#8a5a2c"; c.lineWidth = 1.4 * s;
  for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 4 * s, -8 * s); c.quadraticCurveTo(sg * 12 * s, -13 * s, sg * 20 * s, -7 * s); c.stroke(); c.fillStyle = "#c9a070"; c.beginPath(); c.ellipse(sg * 12 * s, -3 * s, 6 * s, 3 * s, 0, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = "#e8cba0"; c.beginPath(); c.moveTo(-2 * s, -7 * s); c.lineTo(2 * s, -7 * s); c.lineTo(5 * s, 11 * s); c.quadraticCurveTo(0, 14 * s, -5 * s, 11 * s); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "#b07c48"; c.beginPath(); c.ellipse(0, 22 * s, 11 * s, 3.2 * s, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(-11 * s, 22 * s); c.quadraticCurveTo(0, 20 * s, 11 * s, 22 * s); c.stroke();
  c.beginPath(); c.moveTo(-12 * s, 30 * s); c.quadraticCurveTo(0, 36 * s, 12 * s, 30 * s); c.stroke();
  c.restore();
  c.strokeStyle = "#8a5a2c"; c.lineWidth = s; c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2); c.stroke();
  c.lineWidth = 1;
}
/** Chapel of Babel (Michael Garlington, 2023): a tall tiered wooden chapel collaged with sepia photographs and filigree. */
function chapelOfBabel(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50;
  c.fillStyle = "rgba(27, 31, 59, .2)"; c.beginPath(); c.ellipse(20 * s, 22 * s, 30 * s, 13 * s, 0.8, 0, Math.PI * 2); c.fill();
  const oct = (R: number, rot: number) => { c.beginPath(); for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4; c[k ? "lineTo" : "moveTo"](Math.cos(a) * R, Math.sin(a) * R); } c.closePath(); };
  // the tiers stepping in like a wedding cake: cream and sepia, each edge laced with dark filigree
  for (let k = 0; k < 5; k++) {
    const R = (28 - k * 5.5) * s, rot = k % 2 ? Math.PI / 8 : 0;
    oct(R, rot); c.fillStyle = k % 2 ? "#e9dcc0" : "#c9a876"; c.fill(); c.strokeStyle = "#3b2a1a"; c.lineWidth = 0.9 * s; c.stroke();
    oct(R - 1.6 * s, rot); c.strokeStyle = "rgba(59, 42, 26, .5)"; c.lineWidth = 0.35 * s; c.stroke();
    // the photographs: little sepia frames pasted around the roof of each tier
    for (let p = 0; p < 8; p++) { const a = rot + (p + 0.5) * Math.PI / 4, d = R * 0.78; c.fillStyle = (p + k) % 3 ? "#8c6a46" : "#5d4631"; rr(c, Math.cos(a) * d - 1.5 * s, Math.sin(a) * d - 1.1 * s, 3 * s, 2.2 * s, 0.3 * s); c.fill(); c.strokeStyle = "#f2e8d2"; c.lineWidth = 0.3 * s; c.stroke(); }
    // filigree finials at the corners
    c.fillStyle = "#3b2a1a"; for (let p = 0; p < 8; p++) { const a = rot + p * Math.PI / 4; disc(c, Math.cos(a) * R, Math.sin(a) * R, 0.7 * s); c.fill(); }
  }
  // the spire: a last cap, a cross of filigree, the finial's point
  c.fillStyle = "#4a3422"; disc(c, 0, 0, 3.2 * s); c.fill(); c.fillStyle = "#e9dcc0"; disc(c, 0, 0, 1.3 * s); c.fill();
  c.strokeStyle = "#3b2a1a"; c.lineWidth = 0.6 * s; c.beginPath(); c.moveTo(-5 * s, 0); c.lineTo(5 * s, 0); c.moveTo(0, -5 * s); c.lineTo(0, 5 * s); c.stroke();
  // at night the lamps in the tiers' windows flicker warm through the collage
  if (night > 0.3) { glow(c, night, "#ffb347", 14); for (let k = 0; k < 4; k += 2) for (let p = 0; p < 8; p++) { const a = (p + 0.5) * Math.PI / 4 + (k % 2 ? Math.PI / 8 : 0), d = (28 - k * 5.5) * s * 0.78; c.fillStyle = hsl(36, 100, 70, 0.55 + 0.3 * Math.sin(t * 5 + p * 1.9 + k)); rr(c, Math.cos(a) * d - 1.2 * s, Math.sin(a) * d - 0.8 * s, 2.4 * s, 1.6 * s, 0.3 * s); c.fill(); } noGlow(c); }
  c.lineWidth = 1;
}
/** Black Rock Observatory (2023–2026): two white observatory domes with slit shutters, a telescope in one, a fenced compound and a sign post. */
function blackRockObservatory(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50;
  // the fence: a low square of posts and wire around the compound, the shed, the sign post by the gate
  c.strokeStyle = "rgba(90, 70, 40, .6)"; c.lineWidth = 0.5 * s; c.strokeRect(-36 * s, -28 * s, 72 * s, 56 * s);
  c.fillStyle = "#6b5030"; for (let x = -36; x <= 36; x += 9) for (const y of [-28, 28]) { disc(c, x * s, y * s, 0.7 * s); c.fill(); }
  for (let y = -19; y <= 19; y += 9.5) for (const x of [-36, 36]) { disc(c, x * s, y * s, 0.7 * s); c.fill(); }
  c.fillStyle = "rgba(27, 31, 59, .18)"; rr(c, 10 * s, 11 * s, 16 * s, 10 * s, s); c.fill(); c.fillStyle = "#cfc3a8"; rr(c, 8 * s, 9 * s, 16 * s, 10 * s, s); c.fill(); c.strokeStyle = "#8a7a5a"; c.stroke();
  c.fillStyle = "#4a3a24"; c.fillRect(-33 * s, 18 * s, 1.2 * s, 7 * s); c.fillStyle = "#f2ead6"; rr(c, -36 * s, 16 * s, 7 * s, 3.5 * s, 0.4 * s); c.fill(); c.strokeStyle = "#4a3a24"; c.stroke();
  // the domes: each a white hemisphere on a low drum, a shutter slit cut from its crown to its rim
  const dome = (x: number, y: number, R: number, open: boolean, a: number) => {
    c.fillStyle = "rgba(27, 31, 59, .2)"; c.beginPath(); c.ellipse(x + R * 0.5, y + R * 0.5, R * 1.1, R * 0.8, 0.8, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#b9bec8"; disc(c, x, y, R * 1.12); c.fill();
    const g = c.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.1, x, y, R); g.addColorStop(0, "#ffffff"); g.addColorStop(0.7, "#eceef2"); g.addColorStop(1, "#c3c8d2");
    c.fillStyle = g; disc(c, x, y, R); c.fill(); c.strokeStyle = "#9aa1b0"; c.lineWidth = 0.5 * s; c.stroke();
    c.save(); c.translate(x, y); c.rotate(a);
    if (open) { c.fillStyle = "#2b2f45"; rr(c, -2.2 * s, -R, 4.4 * s, R + 0.5 * s, [0, 0, s, s]); c.fill(); c.fillStyle = "#8a90a0"; rr(c, -1.3 * s, -R * 0.85, 2.6 * s, R * 0.8, 0.8 * s); c.fill(); c.fillStyle = "#4a5060"; disc(c, 0, -R * 0.82, 1.3 * s); c.fill(); }
    else { c.fillStyle = "#5b6075"; c.fillRect(-0.4 * s, -R, 0.8 * s, R); c.fillStyle = "#d4d8e0"; c.fillRect(-2 * s, -R, 1.4 * s, R); c.fillRect(0.6 * s, -R, 1.4 * s, R); }
    c.restore();
  };
  dome(-16 * s, -2 * s, 11 * s, true, -0.6); dome(15 * s, -10 * s, 9 * s, false, 0.9);
  // the astronomers' red lamp over the shed door, kept dim to save everyone's night vision
  if (night > 0.3) { glow(c, night, "#ff2020", 10); c.fillStyle = hsl(0, 100, 45, 0.8 + 0.1 * Math.sin(t * 1.5)); disc(c, 16 * s, 8.5 * s, 0.9 * s); c.fill(); noGlow(c); }
  c.lineWidth = 1;
}

export const PIECES: Record<string, DrawPiece> = {
  "the-orb": theOrb,
  "big-rig-jig": bigRigJig,
  "lodestar": lodestar,
  "head-maze": headMaze,
  "chapel-of-babel": chapelOfBabel,
  "black-rock-observatory": blackRockObservatory,
};
