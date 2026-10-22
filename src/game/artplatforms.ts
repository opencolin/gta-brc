/**
 * Art cars on the base vehicles of the top-down city games (asked 2026-10-22): a bus, a tanker, a love
 * wagon, a 4×4, a train, a tram and a boat on wheels, drawn from above in that chunky style (a bright
 * body, the roof showing, a dark windscreen, the wheels at the corners, flat shading), then dressed as
 * each art car. Our own drawings, nothing copied. Each fits the 64 × 34 foot box of artcars.ts, nose up.
 */
type Ctx = CanvasRenderingContext2D;
type Draw = (c: Ctx, t: number, night: number) => void;
const hsl = (h: number, s = 85, l = 60, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;
const NAVY = "#1b1f3b";
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const disc = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const tyres = (c: Ctx, hw: number, ys: number[], w = 4, h = 8) => { c.fillStyle = "#15161d"; for (const y of ys) for (const s of [-1, 1]) { rr(c, s * hw - w / 2, y - h / 2, w, h, 1.5); c.fill(); } };
/** LEDs round an edge at night, chasing. */
const chase = (c: Ctx, night: number, t: number, pts: [number, number][], hue0 = 0) => {
  if (night <= 0.3) return;
  pts.forEach(([x, y], k) => { c.fillStyle = hsl((hue0 + k * 25 + t * 160) % 360, 100, 65); c.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); });
};
const edge = (hw: number, y0: number, y1: number, step = 4): [number, number][] => { const p: [number, number][] = []; for (let y = y0; y <= y1; y += step) { p.push([-hw, y]); p.push([hw, y]); } return p; };

/** A bus: long body, roof panels, a windscreen at the nose, rear window; `deck` dresses the roof. */
function bus(paint: string, trim: string, deck: Draw): Draw {
  return (c, t, night) => {
    tyres(c, 13.5, [-21, 19, 25]);
    c.fillStyle = trim; rr(c, -13, -31, 26, 62, 4); c.fill();
    c.fillStyle = paint; rr(c, -12, -30, 24, 60, 3.5); c.fill();
    c.fillStyle = "#26304a"; rr(c, -10.5, -29.5, 21, 5, 2); c.fill();                     // windscreen
    c.fillStyle = "rgba(255,255,255,.18)"; c.fillRect(-12, -23, 3, 50);                   // light down one side
    c.fillStyle = "rgba(0,0,0,.14)"; c.fillRect(9, -23, 3, 50);
    c.fillStyle = "#26304a"; c.fillRect(-8, 27, 16, 2);                                   // rear window
    deck(c, t, night);
    chase(c, night, t, edge(12.5, -26, 26));
  };
}
/** A tanker: a cab up front, the long round tank behind on its own frame; `tank` dresses the tank. */
function tanker(cab: string, tank: Draw): Draw {
  return (c, t, night) => {
    tyres(c, 13, [-24, 6, 14, 24]);
    c.fillStyle = cab; rr(c, -12, -32, 24, 15, 3); c.fill();
    c.fillStyle = "#26304a"; rr(c, -10, -31, 20, 4, 1.5); c.fill();
    c.fillStyle = "#2a2c38"; c.fillRect(-4, -17, 8, 3);                                   // the hitch
    tank(c, t, night);
    c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 1; for (const y of [-6, 8, 22]) { c.beginPath(); c.moveTo(-12, y); c.lineTo(12, y); c.stroke(); }
    chase(c, night, t, edge(12.5, -12, 28), 30);
  };
}
/** The tank body itself, a rounded cylinder seen from above with a highlight down its spine. */
const tankBody = (c: Ctx, col: string, hi: string) => { c.fillStyle = col; rr(c, -12.5, -14, 25, 44, 11); c.fill(); c.fillStyle = hi; rr(c, -3, -12, 6, 40, 3); c.fill(); };
/** A love wagon: a stubby van, split windscreen, round nose; `body` paints it. */
function wagon(paint: string, body: Draw): Draw {
  return (c, t, night) => {
    tyres(c, 12.5, [-17, 17]);
    c.fillStyle = paint; rr(c, -12, -27, 24, 54, 9); c.fill();
    c.fillStyle = "#f4efe2"; rr(c, -12, -27, 24, 9, [9, 9, 2, 2]); c.fill();             // the two-tone nose
    c.fillStyle = "#26304a"; rr(c, -10, -24, 9.4, 5, 1.5); c.fill(); rr(c, 0.6, -24, 9.4, 5, 1.5); c.fill();
    body(c, t, night);
    chase(c, night, t, edge(12, -16, 24), 300);
  };
}
/** A 4×4: big tyres out at the corners, a roll cage over an open tub; `load` is what rides in it. */
function fourByFour(paint: string, load: Draw): Draw {
  return (c, t, night) => {
    tyres(c, 15, [-20, 20], 6, 11);
    c.fillStyle = paint; rr(c, -13, -30, 26, 60, 4); c.fill();
    c.fillStyle = "rgba(0,0,0,.2)"; rr(c, -13, -30, 26, 8, [4, 4, 0, 0]); c.fill();      // the bonnet
    c.fillStyle = "#26304a"; rr(c, -11, -21, 22, 4, 1.5); c.fill();
    c.strokeStyle = "#2a2c38"; c.lineWidth = 2; c.strokeRect(-11, -15, 22, 40); c.beginPath(); c.moveTo(-11, 5); c.lineTo(11, 5); c.stroke();
    load(c, t, night);
    if (night > 0.3) for (const s of [-1, 1]) { c.strokeStyle = hsl((t * 120 + (s > 0 ? 180 : 0)) % 360, 100, 65); c.lineWidth = 1; c.beginPath(); c.moveTo(s * 11, 25); c.lineTo(s * (11 + Math.sin(t * 5) * 3), 40); c.stroke(); }
  };
}
/** A train: an engine and carriages, articulated, each its own colour; `engine` dresses the front. */
function train(cars: string[], engine: Draw): Draw {
  return (c, t, night) => {
    const n = cars.length, len = 62 / n;
    cars.forEach((col, k) => {
      const y0 = -31 + k * len;
      tyres(c, 10.5, [y0 + 4, y0 + len - 5], 3, 5);
      c.fillStyle = col; rr(c, -10, y0 + 0.8, 20, len - 1.6, 3); c.fill();
      c.fillStyle = "rgba(255,255,255,.2)"; c.fillRect(-10, y0 + 2, 2.5, len - 4);
      if (k > 0) { c.fillStyle = "#2a2c38"; c.fillRect(-2, y0 - 1, 4, 2.4); }
      if (night > 0.3) for (let y = y0 + 3; y < y0 + len - 2; y += 4) { c.fillStyle = hsl((k * 70 + y * 8 + t * 140) % 360, 100, 70); c.fillRect(-9, y, 1.4, 1.4); c.fillRect(7.6, y, 1.4, 1.4); }
    });
    engine(c, t, night);
  };
}
/** A tram: a long rounded car, a trolley pole up top and windows down both sides; `dress` trims it. */
function tram(paint: string, trim: string, dress: Draw): Draw {
  return (c, t, night) => {
    tyres(c, 12, [-20, -12, 12, 20], 3, 5);
    c.fillStyle = trim; rr(c, -12, -31, 24, 62, 10); c.fill();
    c.fillStyle = paint; rr(c, -10.5, -29.5, 21, 59, 9); c.fill();
    c.fillStyle = night > 0.3 ? "#ffe9a8" : "#2b3550"; for (let y = -20; y <= 18; y += 6) { c.fillRect(-10.5, y, 2, 4); c.fillRect(8.5, y, 2, 4); }
    c.strokeStyle = "#2a2c38"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -40); c.stroke();
    c.fillStyle = night > 0.3 ? "#9be7ff" : "#555"; disc(c, 0, -40, 1.6); c.fill();
    dress(c, t, night);
  };
}
/** A boat on wheels: a pointed hull, a deck and a wake of dust kicked up behind; `rig` is its superstructure. */
function boat(hull: string, deck: string, rig: Draw): Draw {
  return (c, t, night) => {
    tyres(c, 11, [-6, 20], 3, 6);
    c.fillStyle = hull; c.beginPath(); c.moveTo(0, -34); c.quadraticCurveTo(15, -18, 13, 26); c.quadraticCurveTo(0, 31, -13, 26); c.quadraticCurveTo(-15, -18, 0, -34); c.fill();
    c.fillStyle = deck; c.beginPath(); c.moveTo(0, -29); c.quadraticCurveTo(11, -15, 10, 24); c.quadraticCurveTo(0, 28, -10, 24); c.quadraticCurveTo(-11, -15, 0, -29); c.fill();
    c.strokeStyle = "rgba(0,0,0,.25)"; c.lineWidth = 0.6; for (let y = -20; y < 24; y += 3) { c.beginPath(); c.moveTo(-9, y); c.lineTo(9, y); c.stroke(); }
    rig(c, t, night);
    chase(c, night, t, [[0, -34], [6, -26], [-6, -26], [11, -10], [-11, -10], [12, 6], [-12, 6], [12, 20], [-12, 20]], 180);
  };
}

/* ── the art cars ─────────────────────────────────────────────────────────── */

const text = (c: Ctx, s: string, y: number, col: string, size = 4.2) => { c.save(); c.translate(0, y); c.rotate(Math.PI / 2); c.fillStyle = col; c.font = `800 ${size}px system-ui, sans-serif`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(s, 0, 0); c.restore(); };
const speakers = (c: Ctx, y: number) => { for (const x of [-6, 6]) { c.fillStyle = "#1d1f2b"; rr(c, x - 3.5, y - 3.5, 7, 7, 1); c.fill(); c.fillStyle = "#4b5068"; disc(c, x, y, 2.4); c.fill(); } };

export const PLATFORM_CARS: Record<string, Draw> = {
  // buses
  dancetronauts: bus("#e8ecf5", "#2a2d3c", (c, t, night) => { c.fillStyle = "#cfd6ea"; c.beginPath(); c.moveTo(0, -18); c.lineTo(7, -6); c.lineTo(7, 14); c.lineTo(-7, 14); c.lineTo(-7, -6); c.closePath(); c.fill(); c.fillStyle = "#ff4b6e"; c.beginPath(); c.moveTo(-7, 14); c.lineTo(-11, 22); c.lineTo(-7, 18); c.moveTo(7, 14); c.lineTo(11, 22); c.lineTo(7, 18); c.fill(); if (night > 0.3) { c.fillStyle = hsl(30 + Math.sin(t * 20) * 15, 100, 60); c.beginPath(); c.moveTo(-4, 18); c.lineTo(0, 30 + Math.sin(t * 24) * 3); c.lineTo(4, 18); c.fill(); } c.fillStyle = "#3a7bd5"; disc(c, 0, -4, 3); c.fill(); }),
  "favela-art-car": bus("#f2b134", "#6b3a1f", (c) => { const cols = ["#e94f37", "#3fa7d6", "#59cd90", "#fac05e", "#ee6352", "#a882dd"]; for (let k = 0; k < 9; k++) { const x = -10 + (k % 3) * 7, y = -20 + Math.floor(k / 3) * 15; c.fillStyle = cols[k % cols.length]; c.fillRect(x, y, 6, 9 + (k % 2) * 3); c.fillStyle = "#2a2d3c"; c.fillRect(x + 2, y + 3, 2, 2); } }),
  blockhaus: bus("#30333f", "#15161d", (c, t, night) => { for (let k = 0; k < 4; k++) { const y = -20 + k * 11; c.fillStyle = night > 0.3 ? hsl((k * 90 + t * 60) % 360, 90, 60) : ["#e0e0e0", "#c9c9c9", "#b0b0b0", "#999"][k]; rr(c, -9, y, 18, 9, 1); c.fill(); } }),
  "smile-high": bus("#ffd23f", "#c49a00", (c) => { c.fillStyle = "#c49a00"; c.fillRect(-12, -2, 24, 2); c.fillStyle = NAVY; disc(c, -4, -12, 2); c.fill(); disc(c, 4, -12, 2); c.fill(); c.strokeStyle = NAVY; c.lineWidth = 2; c.beginPath(); c.arc(0, 6, 7, 0.2, Math.PI - 0.2); c.stroke(); speakers(c, 20); }),
  "dont-panic": bus("#3fa34d", "#1f5e2a", (c) => { text(c, "DON'T PANIC", 2, "#ffe066", 5); c.fillStyle = "#ffe066"; disc(c, 0, -18, 3.4); c.fill(); }),
  "dr-brainlove": bus("#3d4f8f", "#1b2a5c", (c, t, night) => { c.fillStyle = night > 0.3 ? hsl(320, 90, 65 + 10 * Math.sin(t * 4)) : "#f29bb5"; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 4.6, 2, 5.5, 17, 0, 0, Math.PI * 2); c.fill(); } c.strokeStyle = "#c95f80"; c.lineWidth = 0.8; for (let y = -12; y < 18; y += 4) { c.beginPath(); c.moveTo(-9, y); c.quadraticCurveTo(-4, y + 2, -1, y); c.moveTo(1, y); c.quadraticCurveTo(4, y + 2, 9, y); c.stroke(); } }),
  // tankers and cargo
  "lucy-s-cargo": tanker("#e34a2f", (c) => { c.fillStyle = "#2f6fb0"; rr(c, -12.5, -14, 25, 44, 1); c.fill(); c.fillStyle = "rgba(0,0,0,.18)"; for (let x = -11; x < 12; x += 3) c.fillRect(x, -13, 1, 42); text(c, "LUCY", 8, "#ffffff", 5); }),
  damavand: tanker("#7b3fa0", (c, t, night) => { tankBody(c, "#c9cdd8", "#eef0f5"); c.fillStyle = "#4b5268"; c.beginPath(); c.moveTo(-11, 26); c.lineTo(0, 6); c.lineTo(11, 26); c.closePath(); c.fill(); c.fillStyle = "#f4f4f8"; c.beginPath(); c.moveTo(-4, 12); c.lineTo(0, 6); c.lineTo(4, 12); c.closePath(); c.fill(); if (night > 0.3) { c.fillStyle = hsl(28, 100, 58, 0.85); disc(c, 0, -8, 4 + Math.sin(t * 15)); c.fill(); } }),
  "sol-riser": tanker("#f08a24", (c, t, night) => { tankBody(c, "#ffcf3a", "#fff1b8"); c.strokeStyle = "#f08a24"; c.lineWidth = 1.2; for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2 + (night > 0.3 ? t : 0); c.beginPath(); c.moveTo(Math.cos(a) * 6, 8 + Math.sin(a) * 6); c.lineTo(Math.cos(a) * 10, 8 + Math.sin(a) * 10); c.stroke(); } c.fillStyle = "#f08a24"; disc(c, 0, 8, 5); c.fill(); }),
  rexan: tanker("#3e8e41", (c) => { tankBody(c, "#5fae4e", "#8fd67a"); c.fillStyle = "#2f6b2f"; for (let y = -10; y < 28; y += 5) { c.beginPath(); c.moveTo(-3, y); c.lineTo(0, y - 4); c.lineTo(3, y); c.closePath(); c.fill(); } c.fillStyle = "#3e8e41"; c.beginPath(); c.moveTo(-4, 28); c.lineTo(0, 40); c.lineTo(4, 28); c.fill(); }),
  // love wagons
  "playa-peace-project": wagon("#7ec4cf", (c) => { c.strokeStyle = "#ffffff"; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 4, 8, 0, Math.PI * 2); c.moveTo(0, -4); c.lineTo(0, 12); c.moveTo(0, 4); c.lineTo(-5.6, 9.6); c.moveTo(0, 4); c.lineTo(5.6, 9.6); c.stroke(); for (const [x, y, col] of [[-8, -12, "#ff6b9a"], [8, 18, "#ffd23f"], [-7, 20, "#b07cff"]] as const) { c.fillStyle = col; disc(c, x, y, 2.4); c.fill(); } }),
  "krusty-bunny": wagon("#f7b2c6", (c) => { c.fillStyle = "#ffffff"; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 4, -10, 2.4, 7, s * 0.2, 0, Math.PI * 2); c.fill(); } c.beginPath(); c.ellipse(0, 6, 8, 9, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = NAVY; disc(c, -3, 4, 1.2); c.fill(); disc(c, 3, 4, 1.2); c.fill(); c.fillStyle = "#ff6b9a"; disc(c, 0, 8, 1.4); c.fill(); }),
  "heart-car": wagon("#e01e4f", (c, t, night) => { const b = 1 + (night > 0.3 ? 0.1 * Math.max(0, Math.sin(t * 6)) : 0); c.save(); c.translate(0, 4); c.scale(b, b); c.fillStyle = "#ffd1dc"; c.beginPath(); c.moveTo(0, 8); c.bezierCurveTo(-11, 0, -7, -10, 0, -3); c.bezierCurveTo(7, -10, 11, 0, 0, 8); c.fill(); c.restore(); }),
  tommy: wagon("#ffb000", (c) => { for (let k = 0; k < 5; k++) { c.fillStyle = ["#e94f37", "#3fa7d6", "#59cd90", "#a882dd", "#ffffff"][k]; c.fillRect(-12, -14 + k * 8, 24, 3); } }),
  // 4×4s
  unimog: fourByFour("#5d6b3d", (c) => { c.fillStyle = "#8a7a52"; rr(c, -9, -12, 18, 16, 2); c.fill(); speakers(c, 15); }),
  thor: fourByFour("#3a4a6b", (c, t, night) => { c.fillStyle = "#9aa3b5"; rr(c, -6, -10, 12, 8, 1); c.fill(); c.fillStyle = "#6b4423"; c.fillRect(-1.5, -2, 3, 22); if (night > 0.3 && Math.sin(t * 3) > 0.6) { c.strokeStyle = "#bfe9ff"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -10); c.lineTo(-6, -20); c.lineTo(2, -24); c.lineTo(-3, -34); c.stroke(); } }),
  jaguara: fourByFour("#d9a13b", (c) => { c.fillStyle = "#3b2a14"; for (let k = 0; k < 14; k++) { disc(c, -8 + (k * 37 % 16), -12 + (k * 23 % 36), 1.6); c.fill(); } c.fillStyle = "#d9a13b"; c.beginPath(); c.ellipse(0, -26, 8, 6, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = "#7fd36a"; disc(c, -3, -27, 1.2); c.fill(); disc(c, 3, -27, 1.2); c.fill(); }),
  "galactic-jungle": fourByFour("#1f6b4a", (c, t, night) => { for (let k = 0; k < 7; k++) { c.fillStyle = hsl(120 + k * 12, 60, night > 0.3 ? 55 : 35); c.beginPath(); c.ellipse(-6 + (k % 3) * 6, -10 + Math.floor(k / 3) * 12, 5, 3, k, 0, Math.PI * 2); c.fill(); } if (night > 0.3) for (let k = 0; k < 6; k++) { c.fillStyle = "#e8f7ff"; disc(c, Math.sin(t + k) * 9, -12 + k * 6, 0.8); c.fill(); } }),
  treehouse: fourByFour("#7a5233", (c) => { c.fillStyle = "#3f8a3a"; disc(c, 0, 0, 13); c.fill(); c.fillStyle = "#5aa84f"; disc(c, -4, -3, 6); c.fill(); disc(c, 5, 4, 5); c.fill(); c.fillStyle = "#b07a42"; rr(c, -4, 2, 8, 7, 1); c.fill(); }),
  "mighty-misfits": fourByFour("#c0392b", (c) => { for (let k = 0; k < 6; k++) { c.fillStyle = ["#f1c40f", "#3498db", "#2ecc71", "#9b59b6", "#e67e22", "#ecf0f1"][k]; disc(c, -6 + (k % 3) * 6, -8 + Math.floor(k / 3) * 14, 2.6); c.fill(); } }),
  maxa: fourByFour("#202432", (c, t, night) => { c.fillStyle = night > 0.3 ? hsl((t * 90) % 360, 100, 60) : "#e9eef8"; c.beginPath(); c.moveTo(0, -12); c.lineTo(9, 8); c.lineTo(-9, 8); c.closePath(); c.fill(); speakers(c, 18); }),
  // trains
  "bipolar-express": train(["#e8f1f8", "#3a6fd8", "#e8f1f8", "#3a6fd8"], (c) => { c.fillStyle = "#ffffff"; c.beginPath(); c.ellipse(0, -24, 7, 6, 0, 0, Math.PI * 2); c.fill(); for (const s of [-1, 1]) { disc(c, s * 5, -29, 2); c.fill(); } c.fillStyle = NAVY; disc(c, 0, -20, 1.4); c.fill(); }),
  trion: train(["#2a2d3c", "#7b2cbf", "#3c096c", "#7b2cbf"], (c, t, night) => { c.fillStyle = night > 0.3 ? hsl((t * 100) % 360, 100, 65) : "#c77dff"; c.beginPath(); c.moveTo(0, -30); c.lineTo(7, -18); c.lineTo(-7, -18); c.closePath(); c.fill(); }),
  // trams
  "hels-diner": tram("#d8e2dc", "#c0392b", (c) => { c.fillStyle = "#c0392b"; c.fillRect(-10.5, -4, 21, 3); text(c, "HEL'S DINER", 10, "#c0392b", 4.4); c.fillStyle = "#f1c40f"; disc(c, 0, -14, 3); c.fill(); }),
  "church-of-the-open-mind": tram("#f5f0e6", "#8a6d3b", (c, t, night) => { c.fillStyle = "#8a6d3b"; c.fillRect(-1.2, -22, 2.4, 14); c.fillRect(-5, -18, 10, 2.4); c.fillStyle = night > 0.3 ? hsl((t * 60) % 360, 80, 65) : "#7fb3d5"; for (const y of [0, 10]) { c.beginPath(); c.arc(0, y + 3, 5, Math.PI, 0); c.lineTo(5, y + 6); c.lineTo(-5, y + 6); c.closePath(); c.fill(); } }),
  "celestial-sideshow": tram("#2b2160", "#f2c14e", (c, t, night) => { for (let k = 0; k < 8; k++) { c.fillStyle = k % 2 ? "#e63946" : "#f1faee"; c.beginPath(); c.moveTo(0, -4); c.arc(0, -4, 9, (k / 8) * Math.PI * 2, ((k + 1) / 8) * Math.PI * 2); c.closePath(); c.fill(); } c.fillStyle = night > 0.3 ? "#ffe066" : "#f2c14e"; for (let k = 0; k < 5; k++) { disc(c, -6 + k * 3, 16, 1); c.fill(); } }),
  // boats
  amphora: boat("#8c4a22", "#c7884a", (c) => { c.fillStyle = "#b5651d"; c.beginPath(); c.ellipse(0, 2, 5, 10, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = "#5c2d0e"; c.lineWidth = 1; for (const y of [-2, 6]) { c.beginPath(); c.moveTo(-4.5, y); c.lineTo(4.5, y); c.stroke(); } c.fillStyle = "#e9d8a6"; c.fillRect(-16, -6, 32, 1.4); c.fillRect(-15, 10, 30, 1.4); }),
  hermes: boat("#e9d8a6", "#c9a227", (c, t) => { const f = Math.sin(t * 3) * 0.2; for (const s of [-1, 1]) { c.save(); c.translate(s * 9, -6); c.rotate(s * (0.5 + f)); c.fillStyle = "#ffffff"; for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(s * (6 + k * 3), k * 2, 6 - k, 2.2, s * 0.2, 0, Math.PI * 2); c.fill(); } c.restore(); } c.fillStyle = "#c9a227"; c.fillRect(-0.8, -24, 1.6, 40); }),
  chelonix: boat("#2e6b4f", "#4c9a6e", (c) => { c.fillStyle = "#6fbf8a"; for (let k = 0; k < 7; k++) { const x = -5 + (k % 2) * 10, y = -14 + k * 5; c.beginPath(); for (let a = 0; a < 6; a++) c.lineTo(x * 0.6 + Math.cos(a * Math.PI / 3) * 3.6, y + Math.sin(a * Math.PI / 3) * 3.6); c.closePath(); c.fill(); c.strokeStyle = "#2e6b4f"; c.lineWidth = 0.6; c.stroke(); } c.fillStyle = "#4c9a6e"; c.beginPath(); c.ellipse(0, -34, 4, 4, 0, 0, Math.PI * 2); c.fill(); }),
  kuker: boat("#3b2316", "#6b4226", (c, t) => { for (let k = 0; k < 10; k++) { c.fillStyle = k % 2 ? "#d9d0c1" : "#2b2b2b"; c.beginPath(); c.ellipse(-8 + (k % 5) * 4, -10 + Math.floor(k / 5) * 16 + Math.sin(t * 4 + k) * 1, 2.4, 5, 0, 0, Math.PI * 2); c.fill(); } c.fillStyle = "#c0392b"; c.beginPath(); c.moveTo(0, -20); c.lineTo(-5, -12); c.lineTo(5, -12); c.closePath(); c.fill(); }),
};

/** An emergency ambulance (no music, not an art car): white, a red stripe and cross, its lights flashing. */
export function drawAmbulance(c: Ctx, t: number, night: number) {
  tyres(c, 7.5, [-9, 9], 3, 5);
  c.fillStyle = "#f4f4f6"; rr(c, -7, -14, 14, 28, 2.5); c.fill();
  c.fillStyle = "#26304a"; rr(c, -6, -13, 12, 3.5, 1.2); c.fill();
  c.fillStyle = "#d62828"; c.fillRect(-7, 2, 14, 2); c.fillRect(-1.2, -6, 2.4, 7); c.fillRect(-3.5, -3.7, 7, 2.4);
  const on = Math.sin(t * 14) > 0;
  c.fillStyle = on ? "#ff2d2d" : "#5a5a6a"; c.fillRect(-6, -9, 4, 2);
  c.fillStyle = on ? "#5a5a6a" : "#2d6bff"; c.fillRect(2, -9, 4, 2);
  if (night > 0.3) { c.fillStyle = on ? "rgba(255,45,45,.25)" : "rgba(45,107,255,.25)"; disc(c, 0, -8, 14); c.fill(); }
}

/** A superbike from above (asked 2026-10-22): long and low, a fairing at the nose, the rider tucked down over the tank. */
export function drawSuperbike(c: Ctx, hue: number, night: number) {
  c.fillStyle = "rgba(27, 31, 59, .16)"; c.beginPath(); c.ellipse(1, 1.5, 4.5, 10, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#15161d"; rr(c, -1.2, -10.5, 2.4, 5, 1); c.fill(); rr(c, -1.4, 5.5, 2.8, 5.5, 1); c.fill();
  c.fillStyle = hsl(hue, 85, 52); c.beginPath(); c.moveTo(0, -9); c.lineTo(3, -4); c.lineTo(2.6, 5); c.lineTo(-2.6, 5); c.lineTo(-3, -4); c.closePath(); c.fill();
  c.fillStyle = "#26304a"; c.beginPath(); c.moveTo(0, -8); c.lineTo(1.8, -5); c.lineTo(-1.8, -5); c.closePath(); c.fill();
  c.fillStyle = "#2a2c38"; c.beginPath(); c.ellipse(0, 0.5, 2.6, 3.4, 0, 0, Math.PI * 2); c.fill();  // the rider's back
  c.fillStyle = hsl((hue + 180) % 360, 70, 55); disc(c, 0, -2.6, 1.9); c.fill();                     // helmet
  if (night > 0.3) { c.fillStyle = "#fff6c8"; c.fillRect(-0.8, -10.5, 1.6, 1.2); c.fillStyle = "#ff2d55"; c.fillRect(-0.8, 10, 1.6, 1); }
}
