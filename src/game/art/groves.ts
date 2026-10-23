type Ctx = CanvasRenderingContext2D;
export type DrawPiece = (c: Ctx, t: number, night: number, r: number) => void;
const hsl = (h: number, s = 85, l = 60, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
const NAVY = "#1b1f3b";
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const disc = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const glow = (c: Ctx, night: number, col: string, blur = 14) => { c.shadowColor = night > 0.3 ? col : "transparent"; c.shadowBlur = night > 0.3 ? blur : 0; };
const noGlow = (c: Ctx) => { c.shadowBlur = 0; c.shadowColor = "transparent"; };
/** a repeatable 0..1 from a number, so leaves and dew drops land in the same place every frame */
const seed = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };
const SHADOW = "rgba(27, 31, 59, .15)";

/** Shrumen Lumen (FoldHaus, 2016): five giant origami mushrooms, their faceted caps folding open and shut, pale paper by day and cycling colour at night. */
function shrumenLumen(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50;
  const caps: [number, number, number, number][] = [[-28, -14, 13, 1.3], [26, -18, 11, 2.4], [-22, 24, 12, 3.6], [24, 22, 14, 4.9], [0, 0, 20, 0]]; // x, y, radius, phase; the big one last so it sits on top
  const radius = (rad: number, ph: number) => rad * s * (0.76 + 0.24 * (0.5 + 0.5 * Math.sin(t * 0.9 + ph))); // the cap breathes
  c.fillStyle = SHADOW; for (const [x, y, rad, ph] of caps) { const R = radius(rad, ph); c.beginPath(); c.ellipse(x * s + 3 * s, y * s + 3 * s, R, R * 0.9, 0, 0, Math.PI * 2); c.fill(); }
  c.lineWidth = 0.6 * s;
  for (const [x, y, rad, ph] of caps) {
    const R = radius(rad, ph), cx = x * s, cy = y * s, hue = (ph * 60 + t * 25) % 360;
    glow(c, night, hsl(hue, 100, 60), 18 * s);
    for (let k = 0; k < 8; k++) { // eight origami panels, light and shade in turn, each creased out to a point
      const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2, am = (a0 + a1) / 2;
      c.fillStyle = night > 0.3 ? hsl(hue, 90, k % 2 ? 62 : 48) : k % 2 ? "#f3efe4" : "#d9d3c4";
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); c.lineTo(cx + Math.cos(am) * R * 1.08, cy + Math.sin(am) * R * 1.08); c.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); c.closePath(); c.fill();
    }
    noGlow(c);
    c.strokeStyle = night > 0.3 ? hsl(hue, 80, 85, 0.7) : "#b9b2a0";
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.stroke(); } // the creases
    c.fillStyle = night > 0.3 ? hsl(hue, 90, 88) : "#fbf9f2"; disc(c, cx, cy, 2.2 * s); c.fill(); // the stem's top
  }
  c.lineWidth = 1;
}

/** Elder Mother (Charles A. Gadeken, 2023): a 50-ft steel tree, its forking dark limbs hung with thousands of LED leaves that drift through colour at night. */
function elderMother(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50;
  c.fillStyle = SHADOW; c.beginPath(); c.ellipse(4 * s, 4 * s, 42 * s, 38 * s, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.scale(s, s); c.lineCap = "round";
  const tips: [number, number][] = [];
  function limb(x: number, y: number, a: number, len: number, w: number, depth: number): void { // a limb that forks twice
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
    c.strokeStyle = depth > 1 ? "#4a4d55" : "#33363d"; c.lineWidth = w; c.beginPath(); c.moveTo(x, y); c.lineTo(ex, ey); c.stroke();
    tips.push([ex, ey]);
    if (depth > 0) { limb(ex, ey, a - 0.55, len * 0.62, w * 0.6, depth - 1); limb(ex, ey, a + 0.5, len * 0.66, w * 0.6, depth - 1); }
  }
  for (let k = 0; k < 6; k++) limb(0, 0, (k / 6) * Math.PI * 2 + 0.3, 17, 3.2, 2);
  c.fillStyle = "#2b2e36"; disc(c, 0, 0, 5); c.fill(); c.fillStyle = "#4a4d55"; disc(c, -1.2, -1.2, 2); c.fill(); // the trunk, seen end-on
  tips.forEach(([x, y], i) => { // a cluster of LED leaves at every fork and tip
    for (let k = 0; k < 4; k++) {
      const n = i * 9 + k, lx = x + (seed(n) - 0.5) * 9, ly = y + (seed(n + 0.5) - 0.5) * 9, hue = (t * 18 + lx * 3 + ly * 3 + 720) % 360;
      const col = night > 0.3 ? hsl(hue, 95, 62) : "#cfd3cc";
      glow(c, night, col, 8); c.fillStyle = col; disc(c, lx, ly, 1.1 + seed(n + 0.25) * 0.8); c.fill();
    }
  });
  noGlow(c); c.restore();
}

/** Tree of Ténéré (Patrick Deegan, Zachary Smith, Alexander Green & crew, 2017): a lifelike tree whose 25,000 LED leaves wash slowly through warm lamp colours at night. */
function treeOfTenere(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50;
  c.fillStyle = SHADOW; c.beginPath(); c.ellipse(5 * s, 5 * s, 42 * s, 40 * s, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.scale(s, s); c.lineCap = "round";
  c.fillStyle = "#4b7436"; disc(c, 0, 0, 40); c.fill(); // the canopy's mass
  c.strokeStyle = "#5b4426"; // the spreading branches showing through the leaves
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + 0.5;
    c.lineWidth = 2.4; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.cos(a + 0.3) * 18, Math.sin(a + 0.3) * 18, Math.cos(a) * 34, Math.sin(a) * 34); c.stroke();
    c.lineWidth = 1.2; for (const d of [-0.5, 0.5]) { c.beginPath(); c.moveTo(Math.cos(a + 0.15) * 18, Math.sin(a + 0.15) * 18); c.lineTo(Math.cos(a + d) * 32, Math.sin(a + d) * 32); c.stroke(); }
  }
  glow(c, night, "#ffb060", 8);
  for (let k = 0; k < 260; k++) { // the leaves, a dense speckle; at night the slow wash rolls out from the trunk
    const a = seed(k) * Math.PI * 2, d = Math.sqrt(seed(k + 0.3)) * 38, x = Math.cos(a) * d, y = Math.sin(a) * d;
    const wash = 0.5 + 0.5 * Math.sin(t * 0.6 - d * 0.09 + Math.sin(a * 2) * 0.6);
    c.fillStyle = night > 0.3 ? hsl((350 + wash * 70) % 360, 95, 58 + wash * 16) : hsl(100 + seed(k + 0.6) * 30, 45, 30 + seed(k + 0.9) * 24);
    c.beginPath(); c.ellipse(x, y, 2.4, 1.3, a, 0, Math.PI * 2); c.fill();
  }
  noGlow(c);
  c.fillStyle = "#5b3d22"; disc(c, 0, 0, 5); c.fill(); c.fillStyle = "#7a5533"; disc(c, -1, -1, 2.4); c.fill(); // the trunk
  c.restore();
}

/** #MUXALOVE (Misha Libertee, 2026): an 82-ft Venus flytrap, two toothed jaw-leaves slowly gaping and closing on their midrib, green without, pink-red within, dew-drop LEDs lit at night. */
function muxalove(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, open = 0.5 + 0.5 * Math.sin(t * 0.45); // 0 shut .. 1 gaping
  c.fillStyle = SHADOW; c.beginPath(); c.ellipse(9 * s, 3 * s, 30 * s, 24 * s, 0, 0, Math.PI * 2); c.fill();
  c.save(); c.scale(s, s); c.lineCap = "round";
  c.strokeStyle = "#4d8a2e"; c.lineWidth = 5; c.beginPath(); c.moveTo(-44, 22); c.quadraticCurveTo(-32, 12, -14, 1); c.stroke(); // the stem runs off to the south-west
  c.strokeStyle = "#86c452"; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-43, 21); c.quadraticCurveTo(-31, 11, -15, 0); c.stroke();
  c.strokeStyle = "#2f6b1c"; c.lineWidth = 0.7;
  for (const sg of [-1, 1]) { // each lobe swings about the hinge at the midrib's base and lies flatter as it opens
    c.save(); c.translate(-14, 0); c.rotate(sg * (0.1 + open * 0.42)); c.scale(1, 0.5 + 0.5 * open);
    const lobe = (cx: number, rx: number, ry: number) => { c.beginPath(); c.ellipse(cx, 0, rx, ry, 0, sg > 0 ? 0 : Math.PI, sg > 0 ? Math.PI : Math.PI * 2); c.closePath(); };
    c.fillStyle = "#5fb236"; lobe(20, 20, 14); c.fill(); c.stroke(); // the outer green
    c.fillStyle = "#e0407a"; lobe(20, 17, 11); c.fill(); c.fillStyle = "#c92a60"; lobe(20, 11, 6.5); c.fill(); // the pink-red inside, darker in the throat
    c.fillStyle = "#cfe57c"; for (let k = 0; k < 11; k++) { const a = ((k + 0.5) / 11) * Math.PI; // the fringe of teeth
      c.beginPath(); c.moveTo(20 + Math.cos(a - 0.07) * 20, sg * Math.sin(a - 0.07) * 14); c.lineTo(20 + Math.cos(a) * 24.5, sg * Math.sin(a) * 17.5); c.lineTo(20 + Math.cos(a + 0.07) * 20, sg * Math.sin(a + 0.07) * 14); c.closePath(); c.fill(); }
    for (let k = 0; k < 7; k++) { const a = ((k + 0.5) / 7) * Math.PI, d = 0.55 + seed(k + sg) * 0.35; // the dew-drop LEDs
      const col = night > 0.3 ? hsl(190 + seed(k * 3 + sg) * 40, 100, 75) : "#f4f8ff"; glow(c, night, col, 8);
      c.fillStyle = col; disc(c, 20 + Math.cos(a) * 20 * d, sg * Math.sin(a) * 14 * d, 1.3); c.fill(); noGlow(c); }
    c.restore();
  }
  c.fillStyle = "#3f7d26"; rr(c, -15, -1.2, 40, 2.4, 1.2); c.fill(); // the midrib
  c.restore();
}

/** Elemental Dragon (Arterra Techtonics, 2026): a serpentine dragon of overlapping steel plates winding over the playa, horned, spined along the ridge, breathing fire at night. */
function elementalDragon(c: Ctx, t: number, night: number, r: number) {
  const s = r / 50, N = 24;
  const pt = (i: number): [number, number, number] => { const u = i / (N - 1); return [-42 + u * 58, Math.sin(u * Math.PI * 2 - 0.4) * 15 * (0.45 + 0.55 * u), 2 + 6 * Math.sin(u * Math.PI * 0.85)]; }; // x, y, plate radius from tail to head
  c.save(); c.scale(s, s);
  c.fillStyle = SHADOW; for (let i = 0; i < N; i++) { const [x, y, w] = pt(i); disc(c, x + 3, y + 3, w + 1); c.fill(); }
  c.lineWidth = 0.7; c.strokeStyle = "#3f454e";
  for (let i = 0; i < N; i++) { // the plates, laid tail first so each laps the one behind it; a dark spine on every other
    const [x, y, w] = pt(i); c.fillStyle = i % 2 ? "#9aa1ab" : "#7e858f"; disc(c, x, y, w); c.fill(); c.stroke();
    if (i % 2 && i < N - 2) { const [px, py] = pt(i + 1); c.save(); c.translate(x, y); c.rotate(Math.atan2(py - y, px - x)); c.fillStyle = "#2f343c"; c.beginPath(); c.moveTo(-w * 0.5, 0); c.lineTo(0, -1.1); c.lineTo(w * 0.55, 0); c.lineTo(0, 1.1); c.closePath(); c.fill(); c.restore(); }
  }
  const [hx, hy] = pt(N - 1), [nx, ny] = pt(N - 2);
  c.save(); c.translate(hx, hy); c.rotate(Math.atan2(hy - ny, hx - nx));
  c.fillStyle = "#8a9099"; c.beginPath(); c.moveTo(-4, -5.5); c.quadraticCurveTo(6, -6, 12, -2); c.lineTo(12, 2); c.quadraticCurveTo(6, 6, -4, 5.5); c.closePath(); c.fill(); c.stroke(); // the skull, snout forward
  c.strokeStyle = "#5a5f68"; c.lineWidth = 1.6; c.lineCap = "round"; for (const sg of [-1, 1]) { c.beginPath(); c.moveTo(-2, sg * 4); c.quadraticCurveTo(-8, sg * 7, -12, sg * 11); c.stroke(); } // the horns sweep back
  c.fillStyle = "#ffb52e"; disc(c, 3, -3, 1.1); c.fill(); disc(c, 3, 3, 1.1); c.fill();
  if (night > 0.3) { // fire from the mouth, flickering
    const f = 0.5 + 0.5 * Math.sin(t * 11) + 0.3 * Math.sin(t * 23); glow(c, night, "#ff7a1c", 20);
    c.fillStyle = hsl(24 + f * 16, 100, 56, 0.9); c.beginPath(); c.moveTo(12, -2.5); c.quadraticCurveTo(19 + f * 4, -5 + Math.sin(t * 17) * 2, 24 + f * 7, 0); c.quadraticCurveTo(19 + f * 4, 5, 12, 2.5); c.fill();
    c.fillStyle = "#fff0a0"; c.beginPath(); c.moveTo(12, -1.2); c.quadraticCurveTo(16, 0, 17 + f * 4, 0); c.quadraticCurveTo(16, 0, 12, 1.2); c.fill(); noGlow(c);
  }
  c.restore(); c.restore();
}

export const PIECES: Record<string, DrawPiece> = { "shrumen-lumen": shrumenLumen, "elder-mother": elderMother, "tree-of-tenere": treeOfTenere, "muxalove": muxalove, "elemental-dragon": elementalDragon };
