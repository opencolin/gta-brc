type Ctx = CanvasRenderingContext2D;
export type DrawPiece = (c: Ctx, t: number, night: number, r: number) => void;
const hsl = (h: number, s = 85, l = 60, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
const NAVY = "#1b1f3b";
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const disc = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const glow = (c: Ctx, night: number, col: string, blur = 14) => { c.shadowColor = night > 0.3 ? col : "transparent"; c.shadowBlur = night > 0.3 ? blur : 0; };
const noGlow = (c: Ctx) => { c.shadowBlur = 0; c.shadowColor = "transparent"; };
/** The ground shadow every piece throws, a soft dark ellipse offset down and right. */
const shadow = (c: Ctx, s: number, rx: number, ry: number, rot = 0) => { c.fillStyle = "rgba(27, 31, 59, .15)"; c.beginPath(); c.ellipse(4 * s, 5 * s, rx * s, ry * s, rot, 0, Math.PI * 2); c.fill(); };
/** A grid of fine lines clipped to the current path: steel mesh or plywood lattice. Resets the path. */
const hatch = (c: Ctx, col: string, step: number, ext: number, rot = 0) => { c.save(); c.clip(); c.rotate(rot); c.strokeStyle = col; c.lineWidth = 0.5; c.beginPath(); for (let k = -ext; k <= ext; k += step) { c.moveTo(k, -ext); c.lineTo(k, ext); c.moveTo(-ext, k); c.lineTo(ext, k); } c.stroke(); c.restore(); };
const heart = (c: Ctx, x: number, y: number, k: number) => { c.save(); c.translate(x, y); c.scale(k, k); c.beginPath(); c.moveTo(0, 4); c.bezierCurveTo(-6, -1, -4, -7, 0, -3); c.bezierCurveTo(4, -7, 6, -1, 0, 4); c.fill(); c.restore(); };
const MESH = "#dcdee3", WIRE = "#8f949f";

/** Bliss Dance (Marco Cochrane, 2010): a steel-mesh woman dancing on one foot, arms thrown up and wide, coloured LEDs playing over her at night. */
function blissDance(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50;
  shadow(c, s, 36, 26);
  c.save(); c.scale(s, s); c.lineCap = "round";
  // the standing leg under her and the other kicked out behind, bent at the knee
  c.strokeStyle = MESH; c.lineWidth = 7; c.beginPath(); c.moveTo(2, 6); c.lineTo(5, 24); c.stroke();
  c.lineWidth = 6; c.beginPath(); c.moveTo(-3, 8); c.quadraticCurveTo(-16, 18, -22, 12); c.stroke();
  c.fillStyle = MESH; disc(c, 5, 24, 4.5); c.fill(); disc(c, -22, 12, 4); c.fill();
  // the arms, a V seen from above, open hands at their ends
  for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(sg * 9, -4); c.quadraticCurveTo(sg * 24, -10, sg * 33, -24); c.stroke(); disc(c, sg * 34, -25, 4); c.fill(); }
  // the torso: shoulders over the hips, the mesh a fine lattice
  c.beginPath(); c.ellipse(0, 4, 9, 7, 0, 0, Math.PI * 2); c.ellipse(0, -3, 13, 7, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = WIRE; c.lineWidth = 0.8; c.stroke(); hatch(c, WIRE, 2.5, 40);
  c.fillStyle = "#e8e9ed"; disc(c, 0, -6, 6.5); c.fill(); c.strokeStyle = WIRE; c.stroke();
  // at night LEDs chase up the arms and sweep across her shoulders in colour
  if (night > 0.3) {
    for (let k = 0; k < 14; k++) { const sg = k % 2 ? 1 : -1, u = (Math.floor(k / 2) + 1) / 8, col = hsl((k * 40 + t * 90) % 360, 100, 65); glow(c, night, col, 10); c.fillStyle = col; disc(c, sg * (9 + 24 * u), -4 - 20 * u * u, 1.6); c.fill(); }
    for (let k = 0; k < 6; k++) { const col = hsl((k * 60 + t * 90 + 180) % 360, 100, 65); glow(c, night, col, 10); c.fillStyle = col; disc(c, -11 + k * 4.4, 1 + Math.sin(t * 2 + k) * 3, 1.4); c.fill(); }
    noGlow(c);
  }
  c.lineCap = "butt"; c.restore();
}
/** Truth is Beauty (Marco Cochrane, 2013): a mesh woman up on tiptoe, both arms straight overhead, rings of light rippling down her at night. */
function truthIsBeauty(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50;
  shadow(c, s, 18, 16);
  c.save(); c.scale(s, s);
  // from straight above she is compact: feet together on tiptoe, hips, shoulders drawn up by the reach
  c.fillStyle = "#c9ccd3"; c.beginPath(); c.ellipse(0, 10, 4, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = MESH; c.beginPath(); c.ellipse(0, 4, 9, 7, 0, 0, Math.PI * 2); c.ellipse(0, -2, 12, 6.5, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = WIRE; c.lineWidth = 0.8; c.stroke(); hatch(c, WIRE, 2.5, 40);
  // the arms rise straight at the camera: upper arms foreshortened to stubs beside the head, the hands nearest of all
  for (const sg of [-1, 1]) { c.fillStyle = "#d3d5db"; c.beginPath(); c.ellipse(sg * 8, -4, 3.5, 5, sg * 0.3, 0, Math.PI * 2); c.fill(); c.fillStyle = "#eef0f3"; disc(c, sg * 7.5, -8, 3.2); c.fill(); c.strokeStyle = WIRE; c.lineWidth = 0.7; c.stroke(); }
  c.fillStyle = "#e8e9ed"; disc(c, 0, -5, 6); c.fill(); c.strokeStyle = WIRE; c.lineWidth = 0.8; c.stroke();
  if (night > 0.3) {
    c.lineWidth = 1.2;
    for (let k = 0; k < 6; k++) { const ph = (t * 0.8 + k / 6) % 1, col = hsl((200 + k * 25 + t * 40) % 360, 100, 70, 0.9 - ph * 0.7); glow(c, night, col, 8); c.strokeStyle = col; c.beginPath(); c.ellipse(0, -5 + ph * 14, 4 + ph * 10, 3 + ph * 9, 0, 0, Math.PI * 2); c.stroke(); }
    noGlow(c); c.lineWidth = 1;
  }
  c.restore();
}
/** R-Evolution (Marco Cochrane, 2015): a mesh woman standing square, feet planted, palms turned forward, her chest rising and falling as she breathes. */
function rEvolution(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, breath = 1 + 0.035 * Math.sin(t * 0.9);
  shadow(c, s, 24, 17);
  c.save(); c.scale(s, s);
  // feet planted, toes forward (−y); the hips; arms hanging at her sides with the palms out
  c.fillStyle = "#c9ccd3"; for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * 6, -4, 3, 7, 0, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = MESH; c.beginPath(); c.ellipse(0, 4, 10, 7, 0, 0, Math.PI * 2); c.fill();
  for (const sg of [-1, 1]) { c.fillStyle = "#d3d5db"; c.beginPath(); c.ellipse(sg * 15.5, 2, 3.5, 5, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = "#eef0f3"; c.beginPath(); c.ellipse(sg * 16.5, -2, 2.6, 3.6, 0, 0, Math.PI * 2); c.fill(); }
  // the chest swells with each slow breath
  c.save(); c.translate(0, -2); c.scale(breath, breath);
  c.fillStyle = MESH; c.beginPath(); c.ellipse(0, 0, 15, 7.5, 0, 0, Math.PI * 2); c.ellipse(0, 6, 10, 7, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = WIRE; c.lineWidth = 0.8; c.stroke(); hatch(c, WIRE, 2.5, 40);
  if (night > 0.3) { glow(c, night, "#ffb060", 18); c.fillStyle = hsl(28, 100, 70, 0.35 + 0.2 * Math.sin(t * 0.9)); c.beginPath(); c.ellipse(0, 0, 15, 7.5, 0, 0, Math.PI * 2); c.fill(); for (let k = 0; k < 8; k++) { c.fillStyle = hsl((k * 45 + t * 60) % 360, 100, 70); disc(c, -12 + k * 3.4, 1 + Math.sin(k) * 2, 1.2); c.fill(); } noGlow(c); }
  c.restore();
  c.fillStyle = "#e8e9ed"; disc(c, 0, -5, 6.5); c.fill(); c.strokeStyle = WIRE; c.lineWidth = 0.8; c.stroke();
  c.restore();
}
/** Embrace (The Pier Group, 2014): two wooden lattice giants leaning into a hug, heads touching, a red heart lit in each chest at night. */
function embrace(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, grain = "#8d5f33", him = "#c99a60", her = "#dcb278";
  shadow(c, s, 36, 24, -0.2);
  c.save(); c.scale(s, s); c.lineCap = "round";
  // the two bodies, plywood lattice, each tilted into the other
  for (const [sg, col] of [[-1, him], [1, her]] as const) { c.fillStyle = col; c.beginPath(); c.ellipse(sg * 14, 10, 12, 18, sg * 0.5, 0, Math.PI * 2); c.fill(); c.strokeStyle = grain; c.lineWidth = 0.8; c.stroke(); hatch(c, grain, 2.6, 60, sg * 0.5 + 0.78); }
  // arms, each wrapped round the other's back, crossing low
  c.lineWidth = 5.5; c.strokeStyle = her; c.beginPath(); c.moveTo(16, 20); c.quadraticCurveTo(-4, 30, -26, 14); c.stroke();
  c.strokeStyle = him; c.beginPath(); c.moveTo(-16, 2); c.quadraticCurveTo(2, 28, 26, 16); c.stroke();
  c.strokeStyle = grain; c.lineWidth = 0.5; for (const [x0, y0] of [[-20, 10], [8, 24], [-14, 6], [18, 18]] as const) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x0 + 2, y0 + 2); c.stroke(); }
  // the hearts: dark wood by day, red and beating at night
  for (const sg of [-1, 1]) { const beat = night > 0.3 ? 1 + 0.12 * Math.max(0, Math.sin(t * 2.4 + sg)) : 1; glow(c, night, "#ff2d55", 16); c.fillStyle = night > 0.3 ? "#ff3b5c" : "#9b2f3a"; heart(c, sg * 9, 5, beat); }
  noGlow(c);
  // the heads, big and round, touching
  for (const [x, y, col] of [[-8, -9, him], [8, -7, her]] as const) { c.fillStyle = col; disc(c, x, y, 9.5); c.fill(); c.strokeStyle = grain; c.lineWidth = 0.8; c.stroke(); hatch(c, grain, 2.6, 60, 0.6); }
  c.lineCap = "butt"; c.restore();
}
/** REAL LOVE (Alexander Milov, 2026): two wire adults sitting back to back, inside each a child of light reaching for the other through the wire. */
function realLove(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, wire = "#4a4e58";
  shadow(c, s, 36, 16);
  c.save(); c.scale(s, s); c.strokeStyle = wire; c.lineWidth = 0.7; c.lineCap = "round";
  for (const sg of [-1, 1]) {
    // legs out along the ground, arms resting on the knees, the two backs meeting at the centre
    for (const k of [-1, 1]) { c.beginPath(); c.moveTo(sg * 8, k * 4); c.lineTo(sg * 20, k * 5.5); c.lineTo(sg * 33, k * 6); c.stroke(); c.beginPath(); c.moveTo(sg * 6, k * 11); c.lineTo(sg * 21, k * 7); c.stroke(); }
    // the torso: a cage of hoops, open enough that the child inside shows
    for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(sg * 7, 0, 7 - k * 1.6, 13 - k * 3, 0, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(sg * 1, -10); c.lineTo(sg * 1, 10); c.stroke();
    // the head, forward of the shoulders
    c.beginPath(); c.arc(sg * 11, 0, 5, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(sg * 11, 0, 3, 0, Math.PI * 2); c.stroke();
  }
  // the children: white light at night, reaching back through the wire toward each other
  const col = night > 0.3 ? `rgba(255,255,255,${0.85 + 0.15 * Math.sin(t * 3)})` : "#f4f1e8";
  glow(c, night, "#ffffff", 14); c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1.6;
  for (const sg of [-1, 1]) { disc(c, sg * 6, 0, 2.2); c.fill(); c.beginPath(); c.ellipse(sg * 4.5, 0, 1.4, 3.2, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(sg * 4.5, -2); c.lineTo(sg * 1.2, -1.2); c.stroke(); c.beginPath(); c.moveTo(sg * 4.5, 2); c.lineTo(sg * 1.2, 1.2); c.stroke(); }
  noGlow(c); c.lineCap = "butt"; c.lineWidth = 1; c.restore();
}
/** Tara Mechani (Dana Albany, 2017): a goddess of salvaged gears and bronze seated on a lotus, a mandala of gear teeth for her crown. */
function taraMechani(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, gold = "#d9b14a", bronze = "#a86d2e", copper = "#c0633a", dark = "#5e3a16";
  shadow(c, s, 40, 40);
  c.save(); c.scale(s, s);
  // the lotus: two rings of petals round the base
  for (const [n, len, col, a0] of [[12, 42, "#8a5a28", 0], [10, 32, copper, 0.3]] as const) for (let k = 0; k < n; k++) { c.save(); c.rotate((k / n) * Math.PI * 2 + a0); c.fillStyle = col; c.beginPath(); c.moveTo(14, 0); c.quadraticCurveTo(len * 0.6, -7, len, 0); c.quadraticCurveTo(len * 0.6, 7, 14, 0); c.fill(); c.strokeStyle = dark; c.lineWidth = 0.6; c.stroke(); c.restore(); }
  // knees folded under her, the shoulders, two hands resting in her lap
  c.fillStyle = bronze; c.beginPath(); c.ellipse(0, 6, 17, 11, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#b8803a"; c.beginPath(); c.ellipse(0, -2, 15, 7, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = gold; for (const sg of [-1, 1]) { c.beginPath(); c.ellipse(sg * 3.2, 10, 3, 2.2, sg * 0.4, 0, Math.PI * 2); c.fill(); }
  // gears: salvage scattered on the shoulders, then the great mandala headdress
  const gear = (x: number, y: number, R: number, teeth: number, col: string, a0 = 0) => { c.fillStyle = col; c.beginPath(); for (let k = 0; k < teeth * 2; k++) { const a = a0 + (k / (teeth * 2)) * Math.PI * 2, rad = k % 2 ? R : R * 0.82; c.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } c.closePath(); c.fill(); c.strokeStyle = dark; c.lineWidth = 0.5; c.stroke(); c.fillStyle = dark; disc(c, x, y, R * 0.25); c.fill(); };
  gear(-11, -1, 3.2, 8, copper); gear(11, -2, 2.6, 7, gold, 0.4); gear(-5, 9, 2, 6, "#8a5a28"); gear(7, 11, 1.8, 6, copper, 0.2);
  gear(0, -4, 14, 24, bronze); gear(0, -4, 10, 16, gold, 0.1); c.fillStyle = copper; disc(c, 0, -4, 6.5); c.fill(); c.strokeStyle = dark; c.lineWidth = 0.7; c.stroke();
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; c.beginPath(); c.moveTo(Math.cos(a) * 6.5, -4 + Math.sin(a) * 6.5); c.lineTo(Math.cos(a) * 10, -4 + Math.sin(a) * 10); c.stroke(); }
  // her eyes and the jewel on her brow, lit at night
  const col = night > 0.3 ? hsl(45 + 10 * Math.sin(t * 2), 100, 75) : "#3a2410"; glow(c, night, "#ffd36a", 12); c.fillStyle = col; disc(c, -2.2, -4.5, 0.9); c.fill(); disc(c, 2.2, -4.5, 0.9); c.fill(); disc(c, 0, -8, 1.2); c.fill(); noGlow(c);
  c.restore();
}
export const PIECES: Record<string, DrawPiece> = { "bliss-dance": blissDance, "truth-is-beauty": truthIsBeauty, "r-evolution": rEvolution, "embrace": embrace, "real-love": realLove, "tara-mechani": taraMechani };
