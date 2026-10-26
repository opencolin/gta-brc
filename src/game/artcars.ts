/**
 * GTA:BRC's famous art cars, drawn from above in detail (asked 2026-10-22), keyed by their id in
 * lib/games/soundcamps.ts. Each fits a box about 64 feet long and 34 wide, nose up (−y), centred on
 * the car; `t` drives what moves (lasers, fire, flapping wings) and `night` lights them up. An art car
 * with no drawing here keeps PlayaWin's plain one. You can drive any car drawn here once you have found
 * it on the playa (PlayaWin "drive it").
 */
import { PLATFORM_CARS } from "./artplatforms";
type Ctx = CanvasRenderingContext2D;
const hsl = (h: number, s = 85, l = 60, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
const NAVY = "#1b1f3b";
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const disc = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const wheels = (c: Ctx, xs: number, ys: number[]) => { c.fillStyle = NAVY; for (const y of ys) for (const s of [-1, 1]) c.fillRect(s * xs - 2.5, y - 4, 5, 8); };
const glow = (c: Ctx, night: number, col: string, blur = 14) => { c.shadowColor = night > 0.3 ? col : "transparent"; c.shadowBlur = night > 0.3 ? blur : 0; };
const noGlow = (c: Ctx) => { c.shadowBlur = 0; c.shadowColor = "transparent"; };

/** Robot Heart: a vintage bus, speaker stacks on its roof and the great red heart that beats at night. */
function robotHeart(c: Ctx, t: number, night: number) {
  wheels(c, 14, [-20, 20]);
  c.fillStyle = "#e9e4d6"; rr(c, -13, -31, 26, 62, 6); c.fill();
  c.fillStyle = "#c9c2ae"; for (let y = -26; y < 28; y += 6) c.fillRect(-13, y, 26, 1);
  c.fillStyle = "#33384f"; rr(c, -11, -30, 22, 5, 2); c.fill();
  for (const y of [-18, 14]) { c.fillStyle = "#2a2d3c"; rr(c, -10, y, 7, 10, 1); c.fill(); rr(c, 3, y, 7, 10, 1); c.fill(); c.fillStyle = "#555a70"; for (const x of [-6.5, 6.5]) { disc(c, x, y + 3, 2); c.fill(); disc(c, x, y + 7.5, 1.4); c.fill(); } }
  const beat = 1 + (night > 0.3 ? 0.12 * Math.max(0, Math.sin(t * 7)) : 0);
  c.save(); c.translate(0, 0); c.scale(beat, beat);
  glow(c, night, "#ff2d55", 20);
  c.fillStyle = night > 0.3 ? "#ff2d55" : "#d9283f";
  c.beginPath(); c.moveTo(0, 9); c.bezierCurveTo(-15, -2, -9, -15, 0, -6); c.bezierCurveTo(9, -15, 15, -2, 0, 9); c.fill();
  noGlow(c); c.fillStyle = "rgba(255,255,255,.35)"; disc(c, -4.5, -6, 2); c.fill();
  c.restore();
}
/** Mayan Warrior: a stepped temple, a glowing face on its crown and lasers sweeping the night. */
function mayanWarrior(c: Ctx, t: number, night: number) {
  wheels(c, 15, [-22, -6, 10, 24]);
  for (let k = 0; k < 4; k++) { const w = 30 - k * 6, h = 60 - k * 12; c.fillStyle = hsl(160, 35, 30 + k * 7); rr(c, -w / 2, -h / 2, w, h, 2); c.fill(); c.strokeStyle = "#e4c060"; c.lineWidth = 0.8; c.stroke(); }
  glow(c, night, "#3fd6a8", 16);
  c.fillStyle = night > 0.3 ? hsl((t * 80) % 360, 100, 60) : "#3fd6a8"; rr(c, -5, -9, 10, 18, 2); c.fill();
  noGlow(c); c.fillStyle = NAVY; c.fillRect(-3, -4, 2, 2); c.fillRect(1, -4, 2, 2); c.fillRect(-2, 2, 4, 1.2);
  if (night > 0.3) { c.lineWidth = 1.2; for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + Math.sin(t * 1.6 + k) * 1.1; c.strokeStyle = hsl((k * 60 + t * 90) % 360, 100, 60, 0.75); c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 140, Math.sin(a) * 140); c.stroke(); } }
}
/** Titanic's End: a liner's hull and its four funnels, an iceberg rammed into the bow. */
function titanicsEnd(c: Ctx, t: number, night: number) {
  wheels(c, 14, [-18, 18]);
  c.fillStyle = "#1e2233"; c.beginPath(); c.moveTo(0, -32); c.quadraticCurveTo(14, -18, 13, 30); c.lineTo(-13, 30); c.quadraticCurveTo(-14, -18, 0, -32); c.fill();
  c.fillStyle = "#f0ece2"; c.beginPath(); c.moveTo(0, -26); c.quadraticCurveTo(10, -14, 9.5, 27); c.lineTo(-9.5, 27); c.quadraticCurveTo(-10, -14, 0, -26); c.fill();
  c.fillStyle = "#c7a46b"; c.fillRect(-9.5, -6, 19, 30);
  for (let k = 0; k < 4; k++) { const y = -2 + k * 7; c.fillStyle = "#e0a33a"; disc(c, 0, y, 3); c.fill(); c.fillStyle = NAVY; disc(c, 0, y, 1.4); c.fill(); }
  glow(c, night, "#bfe9ff", 12);
  c.fillStyle = night > 0.3 ? "#d9f4ff" : "#eef6fb"; c.beginPath(); c.moveTo(-12, -33); c.lineTo(-2, -42); c.lineTo(9, -36); c.lineTo(5, -28); c.lineTo(-6, -27); c.closePath(); c.fill();
  noGlow(c); c.fillStyle = "#a9d3e8"; c.beginPath(); c.moveTo(-2, -42); c.lineTo(9, -36); c.lineTo(1, -33); c.closePath(); c.fill();
  if (night > 0.3) for (let y = -16; y < 26; y += 4) { c.fillStyle = hsl((y * 12 + t * 120) % 360, 100, 70); c.fillRect(-12, y, 1.5, 1.5); c.fillRect(10.5, y, 1.5, 1.5); }
}
/** El Pulpo Mecánico: a copper octopus, eight tentacles curling, fire bursting from its head at night. */
function elPulpo(c: Ctx, t: number, night: number) {
  wheels(c, 13, [-12, 16]);
  c.lineCap = "round";
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.2, sway = Math.sin(t * 2 + k) * 0.35; c.strokeStyle = k % 2 ? "#b8743a" : "#9a5a28"; c.lineWidth = 4 - 0.2 * k % 2;
    c.beginPath(); c.moveTo(Math.cos(a) * 8, 6 + Math.sin(a) * 8); c.quadraticCurveTo(Math.cos(a + sway) * 20, 6 + Math.sin(a + sway) * 20, Math.cos(a + sway * 2 + 0.6) * 26, 6 + Math.sin(a + sway * 2 + 0.6) * 26); c.stroke(); }
  c.lineCap = "butt";
  c.fillStyle = "#c98a4b"; c.beginPath(); c.ellipse(0, -6, 12, 17, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#7a4520"; c.lineWidth = 1; for (let k = -2; k <= 2; k++) { c.beginPath(); c.ellipse(0, -6, 12 - Math.abs(k) * 2, 17, 0, -0.4 + k * 0.1, 0.4 + k * 0.1); c.stroke(); }
  for (const s of [-1, 1]) { c.fillStyle = "#f2d18a"; disc(c, s * 6, 4, 3); c.fill(); c.fillStyle = NAVY; disc(c, s * 6, 4.5, 1.4); c.fill(); }
  if (night > 0.3) { const f = 0.5 + 0.5 * Math.sin(t * 13); glow(c, night, "#ff8a1c", 22); c.fillStyle = hsl(30 + f * 20, 100, 55 + f * 10, 0.9); c.beginPath(); c.moveTo(-5, -20); c.quadraticCurveTo(0, -38 - f * 12, 5, -20); c.fill(); noGlow(c); }
}
/** Big Imagination's 747: a jumbo jet on wheels, wings out, four engines, its tail at the back. */
function jumbo(c: Ctx, t: number, night: number) {
  // a 747 from above (asked 2026-10-22): swept wings with four engines slung under them, the long
  // fuselage with the upper-deck hump behind the cockpit, swept tailplanes and the fin along the spine
  const white = "#f4f5fa", shade = "#d9dde8", edge = "#9aa1b8", blue = "#2f5fc4";
  c.fillStyle = "rgba(27, 31, 59, .14)"; c.beginPath(); c.ellipse(2, 3, 30, 10, 0, 0, Math.PI * 2); c.fill();
  // the wings, swept back about 35°, and the tailplanes
  for (const sgn of [-1, 1]) {
    c.fillStyle = white; c.strokeStyle = edge; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(sgn * 4, -5); c.lineTo(sgn * 31, 17); c.lineTo(sgn * 31, 21); c.lineTo(sgn * 4, 12); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = shade; c.beginPath(); c.moveTo(sgn * 4, 7); c.lineTo(sgn * 31, 19.6); c.lineTo(sgn * 31, 21); c.lineTo(sgn * 4, 12); c.closePath(); c.fill(); // the flaps
    c.fillStyle = white; c.beginPath(); c.moveTo(sgn * 4, 22); c.lineTo(sgn * 13, 29); c.lineTo(sgn * 13, 31.5); c.lineTo(sgn * 4, 29); c.closePath(); c.fill(); c.stroke();
    // engines: nacelles hanging ahead of the leading edge, inboard pair and outboard pair
    for (const [x, y] of [[11, 2.5], [21, 11]] as const) {
      c.fillStyle = "#b9bfd0"; rr(c, sgn * x - 2.2, y - 6, 4.4, 10, 2); c.fill(); c.strokeStyle = "#6f7790"; c.lineWidth = 0.6; c.stroke();
      c.fillStyle = "#3b4157"; rr(c, sgn * x - 1.8, y - 6, 3.6, 1.6, 0.8); c.fill(); // the intake
    }
  }
  // the fuselage: a long tube, a pointed nose, the tail cone
  c.fillStyle = white; c.strokeStyle = edge; c.lineWidth = 0.8;
  c.beginPath(); c.moveTo(0, -33); c.quadraticCurveTo(4.6, -29, 4.6, -22); c.lineTo(4.6, 20); c.quadraticCurveTo(4.2, 28, 1.6, 32); c.lineTo(-1.6, 32); c.quadraticCurveTo(-4.2, 28, -4.6, 20); c.lineTo(-4.6, -22); c.quadraticCurveTo(-4.6, -29, 0, -33); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = "rgba(0,0,0,.08)"; c.fillRect(2.4, -24, 2.2, 44); // shade down one flank
  // the upper deck: the hump from behind the cockpit to a third of the way back
  c.fillStyle = "#fbfbfe"; rr(c, -3, -27, 6, 20, [3, 3, 2.5, 2.5]); c.fill(); c.strokeStyle = shade; c.lineWidth = 0.6; c.stroke();
  // the cockpit, its windows, then the rows of cabin windows
  c.fillStyle = "#26304a"; c.beginPath(); c.moveTo(-2.4, -29); c.quadraticCurveTo(0, -31.6, 2.4, -29); c.lineTo(2.4, -27.5); c.lineTo(-2.4, -27.5); c.closePath(); c.fill();
  c.fillStyle = night > 0.3 ? "#ffe9a8" : "#5d6a8a";
  for (let y = -24; y <= 18; y += 2.2) { c.fillRect(-4.2, y, 0.9, 1); c.fillRect(3.3, y, 0.9, 1); }
  for (let y = -24; y <= -10; y += 2.2) { c.fillRect(-2.2, y, 0.7, 0.9); c.fillRect(1.5, y, 0.7, 0.9); } // the upper deck's
  // the livery: a blue cheatline and the fin along the spine, a logo on it
  c.fillStyle = blue; c.fillRect(-4.6, -8, 9.2, 1.4);
  c.beginPath(); c.moveTo(-0.9, 18); c.lineTo(0.9, 18); c.lineTo(1.1, 31); c.lineTo(-1.1, 31); c.closePath(); c.fill();
  c.fillStyle = "#ffd27a"; c.fillRect(-0.6, 25, 1.2, 3);
  // the doors
  c.strokeStyle = "#b5bbcc"; c.lineWidth = 0.5; for (const y of [-18, -2, 10, 19]) { c.strokeRect(-4.4, y, 1.2, 2.4); c.strokeRect(3.2, y, 1.2, 2.4); }
  // at night: wingtip strobes, the red beacon on the spine, the party light along the hump
  if (night > 0.3) {
    const s = Math.sin(t * 6) > 0;
    c.fillStyle = "#ff3048"; disc(c, -31, 19, 1.3); c.fill(); c.fillStyle = "#40ff7a"; disc(c, 31, 19, 1.3); c.fill();
    c.fillStyle = Math.sin(t * 9) > 0.6 ? "#ffffff" : "rgba(255,255,255,.2)"; disc(c, -31, 19, 0.6); c.fill(); disc(c, 31, 19, 0.6); c.fill();
    c.fillStyle = s ? "#ff2d2d" : "#5a2030"; disc(c, 0, 0, 1); c.fill();
    c.fillStyle = hsl((t * 90) % 360, 100, 65, 0.55); rr(c, -3, -27, 6, 20, 3); c.fill();
  }
}
/** The Lonely Submarine: a yellow sub, its portholes, conning tower and periscope, a propeller at the back. */
function submarine(c: Ctx, t: number, night: number) {
  wheels(c, 12, [-16, 16]);
  c.fillStyle = "#f5c518"; c.beginPath(); c.ellipse(0, 0, 12, 30, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#c79a0c"; c.lineWidth = 1.2; c.stroke();
  c.fillStyle = "#e3b210"; rr(c, -6, -10, 12, 16, 4); c.fill(); c.strokeStyle = "#a07c08"; c.stroke();
  c.fillStyle = "#7a8296"; c.fillRect(-1, -16, 2, 7); disc(c, 0, -17, 1.8); c.fill();
  glow(c, night, "#9fe8ff", 10);
  for (const y of [-22, -15, 10, 17]) { c.fillStyle = night > 0.3 ? "#b8f2ff" : "#5b8fa8"; disc(c, 0, y, 2.4); c.fill(); }
  noGlow(c);
  c.save(); c.translate(0, 31); c.rotate(t * 8); c.fillStyle = "#8a6a10"; for (let k = 0; k < 3; k++) { c.rotate((Math.PI * 2) / 3); c.beginPath(); c.ellipse(0, 3, 1.6, 3.4, 0, 0, Math.PI * 2); c.fill(); } c.restore();
}
/** Heavy Meta: a steel dragon, wings folded along its back, jaws breathing fire at night. */
function heavyMeta(c: Ctx, t: number, night: number) {
  wheels(c, 13, [-14, 16]);
  c.fillStyle = "#5c6370"; c.beginPath(); c.moveTo(0, 32); c.quadraticCurveTo(6, 22, 9, 4); c.quadraticCurveTo(10, -14, 4, -22); c.lineTo(0, -30); c.lineTo(-4, -22); c.quadraticCurveTo(-10, -14, -9, 4); c.quadraticCurveTo(-6, 22, 0, 32); c.fill();
  for (const s of [-1, 1]) { c.fillStyle = "#7d8592"; c.beginPath(); c.moveTo(s * 8, -8); c.lineTo(s * 17, 2 + Math.sin(t * 2) * 2); c.lineTo(s * 15, 18); c.lineTo(s * 8, 12); c.closePath(); c.fill(); c.strokeStyle = "#454b56"; c.lineWidth = 0.8; c.stroke(); }
  c.fillStyle = "#3e434d"; for (let y = -16; y < 26; y += 5) { c.beginPath(); c.moveTo(-2, y); c.lineTo(0, y - 4); c.lineTo(2, y); c.closePath(); c.fill(); }
  c.fillStyle = "#ffcf3a"; disc(c, -2.5, -24, 1.2); c.fill(); disc(c, 2.5, -24, 1.2); c.fill();
  if (night > 0.3 && Math.sin(t * 1.3) > 0.2) { glow(c, night, "#ff6a1c", 20); c.fillStyle = hsl(28 + Math.sin(t * 20) * 10, 100, 58, 0.85); c.beginPath(); c.moveTo(-3, -30); c.quadraticCurveTo(0, -52, 3, -30); c.fill(); noGlow(c); }
}
/** Kalliope: a steam calliope on wheels, rows of brass pipes, puffing steam. */
function kalliope(c: Ctx, t: number, night: number) {
  wheels(c, 14, [-20, 20]);
  c.fillStyle = "#6b2433"; rr(c, -13, -30, 26, 60, 5); c.fill();
  c.strokeStyle = "#e4c060"; c.lineWidth = 1.2; c.stroke();
  for (let row = 0; row < 3; row++) for (let k = 0; k < 6; k++) { const x = -10 + k * 4, y = -18 + row * 12; c.fillStyle = "#d9a441"; disc(c, x, y, 1.7); c.fill(); c.fillStyle = "#7a5410"; disc(c, x, y, 0.8); c.fill(); }
  c.fillStyle = "#2a2d3c"; disc(c, 0, 22, 4); c.fill();
  for (let k = 0; k < 4; k++) { const p = (t * 0.8 + k * 0.25) % 1; c.fillStyle = `rgba(240,240,250,${0.6 * (1 - p)})`; disc(c, Math.sin(k * 2) * 4 * p, 22 + p * 18, 3 + p * 6); c.fill(); }
  if (night > 0.3) for (let k = 0; k < 10; k++) { c.fillStyle = hsl((k * 36 + t * 100) % 360, 100, 65); c.fillRect(-13, -28 + k * 6, 1.6, 1.6); c.fillRect(11.4, -28 + k * 6, 1.6, 1.6); }
}
/** The Golden Gate art car: a little bridge, two red towers and the cables slung between them. */
function goldenGate(c: Ctx, t: number, night: number) {
  wheels(c, 13, [-20, 20]);
  c.fillStyle = "#3c414f"; rr(c, -9, -32, 18, 64, 3); c.fill();
  c.fillStyle = "#c0362c"; for (const y of [-17, 17]) { c.fillRect(-12, y - 3, 24, 6); c.fillStyle = "#e0523f"; c.fillRect(-12, y - 3, 24, 1.5); c.fillStyle = "#c0362c"; }
  c.strokeStyle = "#e0523f"; c.lineWidth = 1.2;
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 10, -32); c.quadraticCurveTo(s * 10, 0, s * 10, -17); c.moveTo(s * 10, -17); c.quadraticCurveTo(s * 7, 0, s * 10, 17); c.moveTo(s * 10, 17); c.lineTo(s * 10, 32); c.stroke(); }
  if (night > 0.3) for (let y = -30; y <= 30; y += 5) { c.fillStyle = `hsla(45, 100%, 70%, ${0.6 + 0.4 * Math.sin(t * 4 + y)})`; disc(c, 0, y, 0.9); c.fill(); }
}
/** The Axolotl: a pink axolotl, feathery gills either side of its head, little legs and a waving tail. */
function axolotl(c: Ctx, t: number, night: number) {
  wheels(c, 12, [-10, 14]);
  const sw = Math.sin(t * 3) * 4;
  c.fillStyle = "#f6a3c0"; c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(10 + sw * 0.3, 22, sw, 34); c.quadraticCurveTo(-10 + sw * 0.3, 22, 0, 6); c.fill();
  c.beginPath(); c.ellipse(0, 2, 10, 17, 0, 0, Math.PI * 2); c.fill();
  for (const s of [-1, 1]) for (const y of [-6, 12]) { c.beginPath(); c.ellipse(s * 11, y, 4, 2, s * 0.6, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.ellipse(0, -17, 12, 9, 0, 0, Math.PI * 2); c.fill();
  glow(c, night, "#ff4f9a", 12);
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { c.strokeStyle = night > 0.3 ? "#ff4f9a" : "#e0537f"; c.lineWidth = 2; c.beginPath(); c.moveTo(s * 9, -20 + k * 3); c.quadraticCurveTo(s * (16 + Math.sin(t * 4 + k) * 2), -25 + k * 4, s * 19, -27 + k * 5); c.stroke(); }
  noGlow(c); c.fillStyle = NAVY; disc(c, -5, -20, 1.5); c.fill(); disc(c, 5, -20, 1.5); c.fill();
}
/** BAAAHS: the giant fluffy sheep, all wool, a black face and ears, LEDs twinkling in the fleece at night. */
function baaahs(c: Ctx, t: number, night: number) {
  wheels(c, 13, [-16, 18]);
  for (let k = 0; k < 26; k++) { const a = k * 2.4, r = 6 + (k % 5) * 2.4; c.fillStyle = night > 0.3 ? hsl((k * 37 + t * 60) % 360, 70, 82) : k % 2 ? "#f4f1ea" : "#e8e3d6"; disc(c, Math.cos(a) * r * 0.9, 4 + Math.sin(a) * r * 1.6, 6); c.fill(); }
  c.fillStyle = "#26232a"; c.beginPath(); c.ellipse(0, -24, 6, 8, 0, 0, Math.PI * 2); c.fill();
  for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 7, -22, 4, 1.8, s * 0.5, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = "#f4f1ea"; disc(c, -2.4, -26, 1.1); c.fill(); disc(c, 2.4, -26, 1.1); c.fill();
}
/** Funkadelephant: an elephant from above, ears flapping, trunk swinging out in front. */
function funkadelephant(c: Ctx, t: number, night: number) {
  wheels(c, 13, [-12, 18]);
  const col = night > 0.3 ? hsl((t * 50) % 360, 70, 62) : "#8e93a6";
  c.fillStyle = col; c.beginPath(); c.ellipse(0, 6, 13, 22, 0, 0, Math.PI * 2); c.fill();
  const flap = Math.sin(t * 3) * 0.25;
  for (const s of [-1, 1]) { c.save(); c.translate(s * 8, -16); c.rotate(s * (0.4 + flap)); c.fillStyle = "#a7acbe"; c.beginPath(); c.ellipse(s * 7, 0, 9, 11, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = "#e8a0b4"; c.beginPath(); c.ellipse(s * 7, 0, 5.5, 7, 0, 0, Math.PI * 2); c.fill(); c.restore(); }
  c.fillStyle = col; c.beginPath(); c.ellipse(0, -18, 9, 9, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = col; c.lineWidth = 4; c.lineCap = "round"; const sw = Math.sin(t * 2.2) * 6; c.beginPath(); c.moveTo(0, -24); c.quadraticCurveTo(sw, -32, sw * 0.6, -38); c.stroke(); c.lineCap = "butt";
  c.fillStyle = "#f6f1df"; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 3, -25); c.lineTo(s * 5, -31); c.lineTo(s * 4, -25); c.fill(); }
}
/** The Whomp Wagon: a truck carrying a wall of speakers, cones pumping. */
function whompWagon(c: Ctx, t: number, night: number) {
  wheels(c, 14, [-22, 2, 22]);
  c.fillStyle = "#3a3f52"; rr(c, -13, -31, 26, 12, 3); c.fill(); c.fillStyle = "#9fc7ff"; c.fillRect(-10, -29, 20, 4);
  c.fillStyle = "#16182a"; rr(c, -14, -17, 28, 48, 2); c.fill();
  const pump = night > 0.3 ? 0.35 * Math.max(0, Math.sin(t * 9)) : 0;
  for (let row = 0; row < 4; row++) for (const x of [-7, 7]) { const y = -10 + row * 11; c.fillStyle = "#3d4258"; disc(c, x, y, 5); c.fill(); c.fillStyle = night > 0.3 ? hsl((row * 70 + t * 80) % 360, 90, 55) : "#5a607a"; disc(c, x, y, 3 + pump * 3); c.fill(); c.fillStyle = "#16182a"; disc(c, x, y, 1.2); c.fill(); }
}
/** DragonFly: a long glowing body and four veined wings that flicker as it goes. */
function dragonfly(c: Ctx, t: number, night: number) {
  wheels(c, 6, [-8, 16]);
  const f = 0.2 * Math.sin(t * 18);
  for (const [y, s] of [[-8, 1], [-8, -1], [2, 1], [2, -1]] as const) { c.save(); c.translate(0, y); c.rotate(s * (0.15 + f)); c.fillStyle = night > 0.3 ? hsl((t * 60 + y * 10) % 360, 90, 75, 0.55) : "rgba(200, 235, 255, .55)"; c.beginPath(); c.ellipse(s * 16, 0, 16, 4.5, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = "rgba(70, 110, 150, .6)"; c.lineWidth = 0.5; c.stroke(); c.restore(); }
  glow(c, night, "#4fd1ff", 12);
  c.fillStyle = "#2a8bb8"; for (let k = 0; k < 9; k++) { disc(c, 0, 4 + k * 3.2, 2.6 - k * 0.15); c.fill(); }
  c.fillStyle = "#3aa7d8"; c.beginPath(); c.ellipse(0, -4, 4.5, 8, 0, 0, Math.PI * 2); c.fill();
  noGlow(c); c.fillStyle = "#7ce0a0"; disc(c, -3, -15, 3); c.fill(); disc(c, 3, -15, 3); c.fill();
}
/** The Nudibranch: a sea slug in bright stripes, a frill of waving cerata down its back. */
function nudibranch(c: Ctx, t: number, night: number) {
  wheels(c, 11, [-14, 16]);
  c.fillStyle = "#6a3fc8"; c.beginPath(); c.ellipse(0, 2, 11, 30, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#ffd23f"; c.lineWidth = 2; c.stroke();
  for (let k = 0; k < 14; k++) { const y = -18 + k * 3, s = k % 2 ? 1 : -1, w = Math.sin(t * 4 + k) * 2; c.fillStyle = night > 0.3 ? hsl((k * 25 + t * 80) % 360, 100, 62) : "#ff7a2f"; c.beginPath(); c.ellipse(s * 5 + w, y, 2.6, 4, s * 0.4, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = "#ff7a2f"; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 4, -30, 1.6, 4, s * 0.3, 0, Math.PI * 2); c.fill(); }
}
/** TechnoGecko: a huge gecko, splayed toes, a long tail curling behind, spots that light up. */
function technoGecko(c: Ctx, t: number, night: number) {
  wheels(c, 10, [-12, 12]);
  const col = "#5aa83a";
  c.strokeStyle = col; c.lineCap = "round";
  c.lineWidth = 6; c.beginPath(); c.moveTo(0, 14); c.quadraticCurveTo(10 * Math.sin(t * 1.5), 30, -6, 38); c.stroke();
  c.lineWidth = 3.5; for (const [y, s] of [[-12, 1], [-12, -1], [10, 1], [10, -1]] as const) { c.beginPath(); c.moveTo(s * 6, y); c.lineTo(s * 16, y + (y < 0 ? -6 : 6)); c.stroke(); c.fillStyle = col; for (let k = -1; k <= 1; k++) { disc(c, s * 17 + k * 1.8, y + (y < 0 ? -8 : 8), 1.4); c.fill(); } }
  c.lineCap = "butt";
  c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 9, 18, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(0, -21, 7, 7, 0, 0, Math.PI * 2); c.fill();
  glow(c, night, "#ffe14f", 10);
  for (let k = 0; k < 7; k++) { c.fillStyle = night > 0.3 ? hsl((k * 50 + t * 100) % 360, 100, 65) : "#f2d04a"; disc(c, (k % 2 ? 3 : -3), -12 + k * 4, 1.6); c.fill(); }
  noGlow(c); c.fillStyle = NAVY; disc(c, -4, -23, 1.3); c.fill(); disc(c, 4, -23, 1.3); c.fill();
}
/** The Scarab: a beetle, its jewelled shell split down the middle, legs either side, horns in front. */
function scarab(c: Ctx, t: number, night: number) {
  wheels(c, 13, [-10, 14]);
  c.strokeStyle = "#2a2f20"; c.lineWidth = 2; for (const y of [-8, 2, 12]) for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 10, y); c.lineTo(s * 18, y + 4 * Math.sin(t * 6 + y)); c.stroke(); }
  const g = c.createLinearGradient(-14, 0, 14, 0); g.addColorStop(0, "#1f6f5b"); g.addColorStop(0.5, night > 0.3 ? hsl((t * 60) % 360, 80, 60) : "#3fb08a"); g.addColorStop(1, "#1f6f5b");
  c.fillStyle = g; c.beginPath(); c.ellipse(0, 6, 14, 24, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "#0f3a30"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -14); c.lineTo(0, 30); c.stroke();
  c.fillStyle = "#245a46"; c.beginPath(); c.ellipse(0, -18, 10, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#d9b44a"; c.beginPath(); c.moveTo(-4, -24); c.lineTo(0, -34); c.lineTo(4, -24); c.closePath(); c.fill();
}
/** Disco Doge: a shiba's head on wheels, a mirrorball on top throwing light at night. */
function discoDoge(c: Ctx, t: number, night: number) {
  wheels(c, 13, [-14, 18]);
  c.fillStyle = "#e3a24f"; c.beginPath(); c.ellipse(0, 4, 15, 24, 0, 0, Math.PI * 2); c.fill();
  for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * 6, -16); c.lineTo(s * 13, -30); c.lineTo(s * 14, -12); c.closePath(); c.fill(); }
  c.fillStyle = "#f6e6c8"; c.beginPath(); c.ellipse(0, -6, 9, 12, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = NAVY; disc(c, -5, -10, 1.6); c.fill(); disc(c, 5, -10, 1.6); c.fill(); disc(c, 0, -2, 2); c.fill();
  c.fillStyle = "#c0c6d6"; disc(c, 0, 16, 6); c.fill();
  for (let k = 0; k < 10; k++) { c.fillStyle = (k + Math.floor(t * 6)) % 3 ? "#e9eef8" : "#8a93ab"; c.fillRect(-4 + (k % 4) * 2.2, 12 + Math.floor(k / 4) * 2.4, 1.8, 1.8); }
  if (night > 0.3) for (let k = 0; k < 8; k++) { const a = t * 1.5 + k * 0.8; c.fillStyle = hsl((k * 45) % 360, 100, 70, 0.8); disc(c, Math.cos(a) * 24, 16 + Math.sin(a) * 24, 1.4); c.fill(); }
}
/** The Eye of Horus: a gold barge carrying the great painted eye, its lid blinking now and then. */
function eyeOfHorus(c: Ctx, t: number, night: number) {
  wheels(c, 14, [-20, 20]);
  c.fillStyle = "#b8862e"; rr(c, -14, -30, 28, 60, 6); c.fill(); c.strokeStyle = "#5c3d0e"; c.lineWidth = 1.2; c.stroke();
  c.fillStyle = "#1f4fa8"; for (let y = -26; y <= 26; y += 8) { c.fillRect(-14, y, 3, 4); c.fillRect(11, y, 3, 4); }
  const blink = (t % 5) < 0.18 ? 0.15 : 1;
  c.fillStyle = "#f6efdc"; c.beginPath(); c.ellipse(0, -2, 10, 6 * blink, 0, 0, Math.PI * 2); c.fill();
  glow(c, night, "#4f8bff", 14);
  c.fillStyle = night > 0.3 ? "#4f8bff" : "#1f4fa8"; disc(c, 0, -2, 3.6 * blink); c.fill();
  noGlow(c); c.strokeStyle = NAVY; c.lineWidth = 1.6; c.beginPath(); c.ellipse(0, -2, 10, 6, 0, Math.PI, 0); c.moveTo(-3, 4); c.quadraticCurveTo(-4, 12, -9, 14); c.moveTo(3, 4); c.lineTo(3, 14); c.stroke();
}
/** The Slug: a long, glistening garden slug, its eye stalks waving. */
function slug(c: Ctx, t: number, night: number) {
  wheels(c, 10, [-12, 14]);
  const g = c.createLinearGradient(0, -30, 0, 30); g.addColorStop(0, night > 0.3 ? "#ffb347" : "#c98a3a"); g.addColorStop(1, night > 0.3 ? "#ff5fa2" : "#8a5a2b");
  c.fillStyle = g; c.beginPath(); c.moveTo(0, 34); c.quadraticCurveTo(12, 10, 10, -14); c.quadraticCurveTo(8, -26, 0, -27); c.quadraticCurveTo(-8, -26, -10, -14); c.quadraticCurveTo(-12, 10, 0, 34); c.fill();
  c.fillStyle = "rgba(255,255,255,.25)"; for (let k = 0; k < 6; k++) { disc(c, -3 + (k % 2) * 6, -14 + k * 7, 1.6); c.fill(); }
  c.strokeStyle = "#8a5a2b"; c.lineWidth = 1.6; for (const s of [-1, 1]) { const w = Math.sin(t * 3 + s) * 2; c.beginPath(); c.moveTo(s * 3, -26); c.lineTo(s * 6 + w, -36); c.stroke(); c.fillStyle = NAVY; disc(c, s * 6 + w, -37, 1.4); c.fill(); }
}
/** Luna the Art Crane: a crane on a tracked base, its long arm swinging, the moon hung from its hook. */
function lunaCrane(c: Ctx, t: number, night: number) {
  c.fillStyle = "#2c2f3d"; c.fillRect(-14, -20, 5, 40); c.fillRect(9, -20, 5, 40);
  c.fillStyle = "#f2a516"; rr(c, -9, -16, 18, 30, 3); c.fill();
  c.fillStyle = "#30364a"; c.fillRect(-6, -12, 7, 7);
  const a = Math.sin(t * 0.4) * 0.6 - Math.PI / 2;
  c.save(); c.rotate(a + Math.PI / 2); c.fillStyle = "#f2a516"; c.fillRect(-2, -46, 4, 46); c.strokeStyle = "#b37406"; c.lineWidth = 0.6; for (let y = -44; y < 0; y += 4) { c.beginPath(); c.moveTo(-2, y); c.lineTo(2, y + 4); c.stroke(); }
  glow(c, night, "#fff4c2", 22);
  c.fillStyle = "#f4f0dc"; disc(c, 0, -48, 7); c.fill(); noGlow(c); c.fillStyle = "rgba(160, 150, 120, .5)"; disc(c, -2, -50, 1.6); c.fill(); disc(c, 2.5, -46, 1.2); c.fill();
  c.restore();
}

/** Every drawn art car, by its id (soundcamps.ts). */
/** Dragon Lady: Jerry Deal's 89-foot motor yacht, from the drone photo Collin sent (2026-10-23): a white hull, teak decks
 * fore and aft, the pilothouse and flybridge forward of midships under a radar mast, a hot tub, loungers and a dining
 * table on the aft deck, a swim platform at the stern. Twice the length of the other art cars and no tyres showing
 * (asked 2026-10-23): the hull hides them. Its bow is at −y. */
const YACHT = typeof Image === "undefined" ? null : Object.assign(new Image(), { src: "/gta/dragon-lady.png" });
function dragonLady(c: Ctx, t: number, night: number) {
  const L = 132, W = 40, bow = -L * 0.53, stern = L * 0.47, hw = W / 2; // the photo's beam is a third of its length
  // the illustration Collin sent (2026-10-23) is the yacht itself, bow to −y; the drawing below stands in until it loads
  if (YACHT?.complete && YACHT.naturalWidth) {
    const h = L * YACHT.naturalHeight / YACHT.naturalWidth;
    c.save(); c.rotate(Math.PI / 2); c.drawImage(YACHT, -L / 2, -h / 2, L, h);
    // in the picture's own frame (bow at −x): the hot tub's water in its black rim, and the radar turning on the mast (asked 2026-10-23)
    glow(c, night, "#3fc8ff", 12); c.fillStyle = night > 0.3 ? "#3fc8ff" : "#2f8fd0"; disc(c, 18.6, -9.8, 5.8); c.fill(); noGlow(c); c.strokeStyle = "#111318"; c.lineWidth = 1.6; c.stroke(); // the tub, a black border round the water's rim in the picture is centred at (18.6, −9.8), r 7.7
    c.fillStyle = "rgba(255,255,255,.5)"; disc(c, 16.8, -11.6, 1.6); c.fill();
    c.fillStyle = "#f4f4f1"; disc(c, 2, -1, 2.2); c.fill(); c.strokeStyle = "#8a8f99"; c.lineWidth = 0.6; c.stroke();
    c.save(); c.translate(2, -1); c.rotate(t * 2.5); c.strokeStyle = "#4b515e"; c.lineWidth = 1.3; c.lineCap = "round"; c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke(); c.lineCap = "butt"; c.restore();
    // the rainbow pride flag flying from the mast top (asked 2026-10-23), streaming aft and rippling
    c.save(); c.translate(-4, -9);
    c.fillStyle = "#4b515e"; disc(c, 0, 0, 0.9); c.fill();
    const stripes = ["#e40303", "#ff8c00", "#ffed00", "#008026", "#24408e", "#732982"], fl = 11, fw = 6.6;
    for (let k = 0; k < 6; k++) {
      const y0 = -fw / 2 + (k * fw) / 6, y1 = y0 + fw / 6;
      c.fillStyle = stripes[k]; c.beginPath(); c.moveTo(0, y0);
      for (let u = 0; u <= fl; u += 1.5) { const w = Math.sin(t * 9 - u * 0.7) * 0.9 * (u / fl); c.lineTo(u, y0 + w); }
      for (let u = fl; u >= 0; u -= 1.5) { const w = Math.sin(t * 9 - u * 0.7) * 0.9 * (u / fl); c.lineTo(u, y1 + w); }
      c.closePath(); c.fill();
    }
    c.restore();
    if (night > 0.3) {
      // RGB LEDs along the rails (asked 2026-10-23): a rainbow chasing down both sides and across the transom
      glow(c, night, "#ffffff", 6);
      for (let u = -L * 0.44; u <= L * 0.47; u += 3.2) {
        const taper = u < -L * 0.3 ? (u + L * 0.5) / (L * 0.2) : 1; // the rails close in toward the bow
        for (const side of [-1, 1]) { c.fillStyle = hsl((u * 5 + t * 160 + (side > 0 ? 90 : 0)) % 360, 100, 62); disc(c, u, side * (h / 2 - 1.6) * taper, 0.9); c.fill(); }
      }
      for (let v = -h / 2 + 4; v <= h / 2 - 4; v += 3.2) { c.fillStyle = hsl((v * 12 + t * 160 + 200) % 360, 100, 62); disc(c, L * 0.47, v, 0.9); c.fill(); }
      noGlow(c);
    }
    c.restore();
    return;
  }
  // hull: a fine bow, flared sides, a squared transom
  c.fillStyle = "#f4f3ee"; c.beginPath(); c.moveTo(0, bow); c.quadraticCurveTo(hw + 1, bow + L * 0.3, hw, stern - L * 0.3); c.lineTo(hw - 1, stern - 4); c.quadraticCurveTo(0, stern + 2, -hw + 1, stern - 4); c.lineTo(-hw, stern - L * 0.3); c.quadraticCurveTo(-hw - 1, bow + L * 0.3, 0, bow); c.fill();
  c.strokeStyle = "#c9c6bb"; c.lineWidth = 1; c.stroke();
  // the teak: the foredeck inside the bow's curve, the aft deck behind the house
  const teak = (x: number, y: number, w: number, h: number) => { c.fillStyle = "#c7955a"; rr(c, x, y, w, h, 3); c.fill(); c.strokeStyle = "rgba(90,50,20,.35)"; c.lineWidth = 0.5; for (let yy = y + 2; yy < y + h; yy += 2.6) { c.beginPath(); c.moveTo(x + 0.5, yy); c.lineTo(x + w - 0.5, yy); c.stroke(); } };
  c.save(); c.beginPath(); c.moveTo(0, bow + 4); c.quadraticCurveTo(hw - 3, bow + L * 0.3, hw - 4, bow + L * 0.36); c.lineTo(-hw + 4, bow + L * 0.36); c.quadraticCurveTo(-hw + 3, bow + L * 0.3, 0, bow + 4); c.clip(); teak(-hw, bow, W, L * 0.38); c.restore();
  c.fillStyle = "#e9e5d8"; rr(c, -7, bow + 14, 14, 14, 3); c.fill(); // the sun pad on the bow
  c.fillStyle = "#8fae6a"; rr(c, -hw + 6, bow + 30, 8, 10, 2); c.fill(); rr(c, hw - 14, bow + 30, 8, 10, 2); c.fill(); // the turf squares
  teak(-hw + 3, 2, W - 6, stern - 8);
  // the superstructure: pilothouse and flybridge, their windscreen, the radar dome and the mast
  c.fillStyle = "#ffffff"; rr(c, -hw + 4, bow + L * 0.34, W - 8, L * 0.3, [10, 10, 4, 4]); c.fill(); c.strokeStyle = "#d5d2c7"; c.lineWidth = 0.8; c.stroke();
  c.fillStyle = "#2b3a4a"; rr(c, -hw + 7, bow + L * 0.35, W - 14, 4, 2); c.fill();
  c.fillStyle = "#f7f7f4"; disc(c, -8, bow + L * 0.46, 4); c.fill(); c.strokeStyle = "#c9c6bb"; c.stroke(); // the radar dome
  disc(c, 6, bow + L * 0.47, 2.5); c.fill(); c.stroke();
  c.strokeStyle = "#8a8f99"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, bow + L * 0.62); c.lineTo(0, bow + L * 0.5); c.moveTo(-8, bow + L * 0.62); c.lineTo(8, bow + L * 0.62); c.stroke(); // the mast
  c.save(); c.translate(0, bow + L * 0.62); c.rotate(t * 2.2); c.strokeStyle = "#5c6370"; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-7, 0); c.lineTo(7, 0); c.stroke(); c.restore(); // the radar bar turning
  // the aft deck: the hot tub under its awning, loungers, the tender's davit, a dining table and chairs
  c.fillStyle = "#2a2d35"; rr(c, -hw + 6, 8, 16, 14, 3); c.fill(); // the awning over the tub
  glow(c, night, "#3fc8ff", 12); c.fillStyle = night > 0.3 ? "#3fc8ff" : "#1f6f9a"; disc(c, -hw + 14, 15, 5); c.fill(); noGlow(c);
  c.fillStyle = "rgba(255,255,255,.55)"; disc(c, -hw + 12.5, 13.5, 1.6); c.fill();
  c.fillStyle = "#8fae6a"; rr(c, 2, 6, 14, 12, 2); c.fill(); // the turf
  c.fillStyle = "#f0ede4"; for (const x of [3, 9]) { rr(c, x, 7, 4, 9, 1.5); c.fill(); } // loungers
  c.strokeStyle = "#9aa0a8"; c.lineWidth = 1; c.beginPath(); c.moveTo(-6, 20); c.lineTo(-hw + 12, stern - 14); c.stroke(); // the davit
  c.fillStyle = "#f0ede4"; rr(c, -6, 26, 10, 12, 2); c.fill(); c.fillStyle = "#e0532f"; rr(c, -5, 27, 4, 3, 1); c.fill(); // the tender's cover
  c.fillStyle = "#3b2f2f"; disc(c, 8, stern - 22, 3.5); c.fill(); c.fillStyle = "#f0ede4"; for (const a of [0, 1, 2, 3]) { disc(c, 8 + Math.cos(a * Math.PI / 2) * 6, stern - 22 + Math.sin(a * Math.PI / 2) * 6, 1.6); c.fill(); }
  c.fillStyle = "#e9e5d8"; rr(c, -hw + 6, stern - 16, 10, 8, 2); c.fill(); rr(c, hw - 14, stern - 16, 8, 8, 2); c.fill(); // the sofas astern
  // the swim platform and the stern lights
  c.fillStyle = "#c7955a"; rr(c, -hw + 8, stern - 3, W - 16, 4, 1); c.fill();
  if (night > 0.3) { c.fillStyle = "#fff3b0"; for (const x of [-hw + 2, hw - 2]) for (const y of [bow + 30, 0, stern - 20]) { disc(c, x, y, 1.1); c.fill(); } }
}
/** The Golden Ticket from above (redesigned 2026-10-26): an old San Francisco meter-maid cart, three wheels, rebuilt in sparkly
 * gold by Micah, Devon and friends in a night: LED strips down its sides, an old bus seat behind the cab, Void speakers at the back. */
export function drawGoldenTicket(ctx: Ctx, t: number, night: number, brake = false) {
  ctx.fillStyle = "rgba(27, 31, 59, .22)"; ctx.beginPath(); ctx.roundRect(-4, -8, 10, 19, 3); ctx.fill();
  ctx.fillStyle = "#15161d"; ctx.fillRect(-1.5, -9.5, 3, 4); for (const x of [-5, 5]) ctx.fillRect(x - 1.5, 4, 3, 4.5); // one wheel in front, two behind
  ctx.fillStyle = "#e8b923"; ctx.beginPath(); ctx.moveTo(0, -10); ctx.quadraticCurveTo(5, -9, 5, -3); ctx.lineTo(5, 9); ctx.lineTo(-5, 9); ctx.lineTo(-5, -3); ctx.quadraticCurveTo(-5, -9, 0, -10); ctx.fill(); // the gold body
  ctx.fillStyle = "#c9960c"; ctx.fillRect(-5, 8, 10, 1.2);
  for (let k = 0; k < 9; k++) { const a = t * 3 + k * 2.1, x = Math.sin(a * 1.7) * 3.6, y = -6 + ((k * 2.3 + t * 2) % 14); ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.35 * Math.abs(Math.sin(a))})`; ctx.fillRect(x, y, 0.8, 0.8); } // the sparkle
  ctx.fillStyle = "#2b3a4a"; ctx.beginPath(); ctx.roundRect(-3.8, -7.5, 7.6, 3, 1); ctx.fill(); // the windscreen
  ctx.fillStyle = "#1e2233"; ctx.fillRect(-3.5, -4, 7, 4); ctx.fillStyle = "#f2c6a0"; ctx.beginPath(); ctx.arc(0, -2.5, 1.6, 0, Math.PI * 2); ctx.fill(); // the cab and the driver
  ctx.fillStyle = "#7a3b1e"; ctx.beginPath(); ctx.roundRect(-4, 0.5, 8, 4, 1); ctx.fill(); ctx.fillStyle = "#9b5230"; ctx.fillRect(-4, 0.5, 8, 1.2); // the old bus seat
  ctx.fillStyle = "#1d1f2b"; for (const x of [-4.5, 1.5]) { ctx.fillRect(x, 5.5, 3, 3); ctx.fillStyle = "#4b5068"; ctx.beginPath(); ctx.arc(x + 1.5, 7, 0.9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#1d1f2b"; } // the Void speakers
  if (night > 0.3) { for (let y = -7; y < 9; y += 1.6) { ctx.fillStyle = hsl((y * 22 + t * 240) % 360, 100, 65); ctx.fillRect(-5.6, y, 1, 1); ctx.fillRect(4.6, y, 1, 1); } ctx.fillStyle = "#fff3b0"; ctx.fillRect(-2, -10.5, 1.4, 1); ctx.fillRect(0.6, -10.5, 1.4, 1); } // the LED strips and headlights
  if (brake) { ctx.fillStyle = "#ff2d55"; ctx.fillRect(-4.5, 9, 2, 1); ctx.fillRect(2.5, 9, 2, 1); }
}
export const ART_CARS: Record<string, (c: Ctx, t: number, night: number) => void> = {
  ...PLATFORM_CARS, // the rest, built on the city games' base vehicles (artplatforms.ts)
  "robot-heart": robotHeart, "mayan-warrior": mayanWarrior, "titanics-end": titanicsEnd, "el-pulpo-mecanico": elPulpo,
  "big-imagination-747": jumbo, "lonely-submarine": submarine, "heavy-meta": heavyMeta, kalliope, "golden-gate-art-car": goldenGate,
  axolotl, baaahs, funkadelephant, "whomp-wagon": whompWagon, dragonfly, nudibranch, technogecko: technoGecko, "the-scarab": scarab,
  "disco-doge": discoDoge, "eye-of-horus": eyeOfHorus, "the-slug": slug, "luna-the-artcrane": lunaCrane, "dragon-lady": dragonLady, "golden-ticket": (c, t, n) => drawGoldenTicket(c, t, n),
};
