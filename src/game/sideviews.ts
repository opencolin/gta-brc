/**
 * The rides seen from the side, for the garage where you choose one (asked 2026-10-26): each drawn facing right
 * on a ground line at y = 0, centred on x = 0, inside about 180 × 100; `t` turns the wheels and waves what waves,
 * `night` lights the lamps. Keyed by the vehicle id in lib/playa.ts VEHICLES.
 */
type Ctx = CanvasRenderingContext2D;
const NAVY = "#1b1f3b", SKIN = "#f2c6a0", PINK = "#ff6b9a", GOLD = "#ffd27a";
const disc = (c: Ctx, x: number, y: number, r: number) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); };
const rr = (c: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
/** A spoked wheel turning with t. */
function wheel(c: Ctx, x: number, y: number, r: number, t: number, fat = false) {
  c.fillStyle = "#15161d"; disc(c, x, y, r); c.fill();
  c.fillStyle = fat ? "#3a3d4a" : "#e9e4d6"; disc(c, x, y, r * (fat ? 0.55 : 0.8)); c.fill();
  if (!fat) { c.strokeStyle = "#8a8f99"; c.lineWidth = 1; c.beginPath(); for (let k = 0; k < 8; k++) { const a = t * 4 + (k / 8) * Math.PI * 2; c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8); } c.stroke(); }
  c.fillStyle = "#4b5068"; disc(c, x, y, r * 0.16); c.fill();
}
const shadow = (c: Ctx, w: number) => { c.fillStyle = "rgba(27, 31, 59, .18)"; c.beginPath(); c.ellipse(0, 4, w, 5, 0, 0, Math.PI * 2); c.fill(); };
/** A rider sitting at (x, y), leaning forward, a straw hat on; `bob` rocks them. */
function rider(c: Ctx, x: number, y: number, shirt: string, bob: number) {
  c.save(); c.translate(x, y + bob);
  c.fillStyle = NAVY; rr(c, -6, -2, 12, 10, 3); c.fill(); // shorts on the saddle
  c.fillStyle = shirt; c.beginPath(); c.moveTo(-5, 0); c.lineTo(4, -22); c.lineTo(12, -20); c.lineTo(6, 0); c.closePath(); c.fill(); // leaning into the bars
  c.strokeStyle = SKIN; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(8, -18); c.lineTo(20, -12); c.stroke(); c.lineCap = "butt"; // an arm to the bars
  c.fillStyle = SKIN; disc(c, 9, -28, 6); c.fill();
  c.fillStyle = "#e3c98a"; c.beginPath(); c.ellipse(9, -31, 11, 3, 0, 0, Math.PI * 2); c.fill(); disc(c, 9, -33, 6); c.fill(); // the hat
  c.restore();
}
const lamp = (c: Ctx, x: number, y: number, night: number, col = "#fff3b0") => { if (night > 0.3) { c.shadowColor = col; c.shadowBlur = 14; } c.fillStyle = night > 0.3 ? col : "#d9d4c4"; disc(c, x, y, 2.5); c.fill(); c.shadowBlur = 0; };

/** The unicycle: one big wheel, a seat post, the rider sitting tall and pedalling. */
function unicycle(c: Ctx, t: number, night: number) {
  shadow(c, 22);
  wheel(c, 0, -16, 16, t);
  c.strokeStyle = "#8a8f99"; c.lineWidth = 3; c.beginPath(); c.moveTo(0, -16); c.lineTo(0, -46); c.stroke();
  c.fillStyle = NAVY; rr(c, -9, -50, 18, 5, 2); c.fill();
  const ped = t * 4; c.strokeStyle = "#4b5068"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(Math.cos(ped) * 7, -16 + Math.sin(ped) * 7); c.lineTo(-Math.cos(ped) * 7, -16 - Math.sin(ped) * 7); c.stroke();
  c.save(); c.translate(0, -48);
  c.fillStyle = NAVY; rr(c, -6, -2, 12, 8, 3); c.fill();
  c.fillStyle = PINK; rr(c, -6, -24, 12, 24, 4); c.fill();
  c.strokeStyle = SKIN; c.lineWidth = 3; c.lineCap = "round"; c.beginPath(); c.moveTo(-5, -18); c.lineTo(-14, -8 + Math.sin(t * 3) * 3); c.moveTo(5, -18); c.lineTo(14, -8 - Math.sin(t * 3) * 3); c.stroke(); c.lineCap = "butt";
  c.fillStyle = SKIN; disc(c, 0, -30, 6); c.fill();
  c.fillStyle = "#e3c98a"; c.beginPath(); c.ellipse(0, -33, 11, 3, 0, 0, Math.PI * 2); c.fill(); disc(c, 0, -35, 6); c.fill();
  c.restore();
  void night;
}
/** The playa cruiser: a fat-tyred beach bike with a basket, lights front and back, a rider leaning on wide bars. */
function cruiser(c: Ctx, t: number, night: number, electric = false) {
  shadow(c, 52);
  wheel(c, -30, -14, 14, t); wheel(c, 30, -14, 14, t);
  c.strokeStyle = electric ? "#2f8fd0" : PINK; c.lineWidth = 3.5; c.lineCap = "round";
  c.beginPath(); c.moveTo(-30, -14); c.lineTo(-8, -38); c.lineTo(22, -38); c.lineTo(30, -14); c.moveTo(-8, -38); c.lineTo(2, -14); c.lineTo(22, -38); c.moveTo(2, -14); c.lineTo(30, -14); c.stroke(); // frame
  c.beginPath(); c.moveTo(22, -38); c.lineTo(26, -50); c.stroke(); // the head tube
  c.strokeStyle = "#8a8f99"; c.lineWidth = 2.5; c.beginPath(); c.moveTo(26, -50); c.lineTo(10, -54); c.stroke(); // swept-back bars
  c.beginPath(); c.moveTo(-8, -38); c.lineTo(-12, -48); c.stroke(); c.fillStyle = NAVY; rr(c, -20, -51, 14, 5, 2); c.fill(); // the saddle
  c.fillStyle = "#c7955a"; rr(c, 24, -62, 16, 9, 2); c.fill(); c.strokeStyle = "#8a6d45"; c.lineWidth = 1; for (let x = 26; x < 40; x += 3) { c.beginPath(); c.moveTo(x, -62); c.lineTo(x, -53); c.stroke(); } // the basket
  if (electric) { c.fillStyle = "#2a2d3c"; rr(c, -4, -36, 22, 8, 3); c.fill(); c.fillStyle = GOLD; c.beginPath(); c.moveTo(8, -35); c.lineTo(4, -31); c.lineTo(8, -31); c.lineTo(5, -28); c.lineTo(11, -32); c.lineTo(7, -32); c.closePath(); c.fill(); } // the battery
  rider(c, -8, -48, electric ? "#5bd6c8" : "#c9a3ff", Math.sin(t * 6) * 0.6);
  lamp(c, 40, -44, night); lamp(c, -42, -20, night, "#ff4d4d");
  if (night > 0.3) { for (let k = 0; k < 6; k++) { c.fillStyle = `hsl(${(k * 60 + t * 120) % 360} 100% 65%)`; disc(c, -30 + Math.cos(t * 2 + k) * 9, -14 + Math.sin(t * 2 + k) * 9, 1.2); c.fill(); } } // wheel lights
}
/** The tuk-tuk: a three-wheeled cab, a striped canopy, the driver in front, a passenger bench behind. */
function tuktuk(c: Ctx, t: number, night: number) {
  shadow(c, 50);
  c.fillStyle = "#2f9e5a"; c.beginPath(); c.moveTo(-40, -16); c.lineTo(-40, -40); c.lineTo(-8, -40); c.lineTo(30, -40); c.lineTo(44, -24); c.lineTo(44, -16); c.closePath(); c.fill(); // the body
  c.fillStyle = "#ffd23f"; rr(c, -40, -22, 84, 5, 1); c.fill(); // the yellow skirt
  c.fillStyle = "#1e2233"; rr(c, -36, -62, 72, 4, 2); c.fill(); for (const x of [-34, 32]) { c.fillStyle = "#4b5068"; c.fillRect(x, -58, 3, 18); } // the canopy
  c.fillStyle = "#ffd23f"; for (let x = -36; x < 36; x += 12) c.fillRect(x, -62, 6, 4);
  c.fillStyle = "rgba(255,255,255,.35)"; rr(c, 20, -58, 22, 18, 2); c.fill(); // the windscreen
  rider(c, 18, -40, "#ff8c42", Math.sin(t * 5) * 0.5); // the driver
  c.fillStyle = "#c0392b"; rr(c, -34, -46, 28, 7, 2); c.fill(); // the bench
  c.fillStyle = "#5bd6c8"; rr(c, -30, -56, 10, 12, 3); c.fill(); c.fillStyle = SKIN; disc(c, -25, -60, 5); c.fill(); // a passenger
  wheel(c, 36, -12, 12, t, true); wheel(c, -28, -12, 12, t, true);
  lamp(c, 46, -30, night);
  if (night > 0.3) { c.fillStyle = `hsl(${(t * 90) % 360} 100% 65%)`; for (let x = -36; x < 40; x += 8) { disc(c, x, -20, 1.2); c.fill(); } }
}
/** The cuttlefish art car: a long mantle on a chassis, a rippling fin, eight arms trailing from the head, colours rolling. */
function cuttlefish(c: Ctx, t: number, night: number) {
  shadow(c, 70);
  wheel(c, -40, -12, 12, t, true); wheel(c, 20, -12, 12, t, true);
  c.fillStyle = "#3a3d4a"; rr(c, -56, -24, 100, 8, 3); c.fill(); // the chassis
  const hue = (t * 40) % 360;
  c.fillStyle = `hsl(${hue} 70% 60%)`; c.beginPath(); c.moveTo(-70, -36); c.quadraticCurveTo(-30, -70, 30, -58); c.quadraticCurveTo(60, -52, 62, -36); c.quadraticCurveTo(30, -24, -30, -26); c.quadraticCurveTo(-60, -26, -70, -36); c.fill(); // the mantle
  c.fillStyle = `hsl(${(hue + 40) % 360} 70% 70%)`; c.beginPath(); c.moveTo(-66, -38); for (let x = -66; x <= 40; x += 6) c.lineTo(x, -62 + Math.sin(t * 6 + x * 0.2) * 4 - (x + 66) * 0.05); c.lineTo(40, -56); c.quadraticCurveTo(-20, -60, -66, -42); c.fill(); // the fin
  c.fillStyle = "#f6ead2"; disc(c, 52, -44, 7); c.fill(); c.fillStyle = NAVY; c.beginPath(); c.ellipse(53, -44, 2, 5, 0, 0, Math.PI * 2); c.fill(); // the eye
  c.strokeStyle = `hsl(${(hue + 200) % 360} 60% 60%)`; c.lineWidth = 3; c.lineCap = "round";
  for (let k = 0; k < 6; k++) { const y = -46 + k * 3, sway = Math.sin(t * 3 + k) * 4; c.beginPath(); c.moveTo(60, y); c.quadraticCurveTo(76 + sway, y + 6, 84 + sway * 1.5, y + 14 + k * 2); c.stroke(); }
  c.lineCap = "butt";
  if (night > 0.3) for (let x = -60; x < 56; x += 8) { c.fillStyle = `hsl(${(hue + x * 3) % 360} 100% 70%)`; disc(c, x, -30, 1.5); c.fill(); }
}
/** The Golden Ticket (redesigned 2026-10-26): an old San Francisco meter-maid cart rebuilt in sparkly gold in one night, an old
 * bus seat behind the little cab, LED strips along the skirt, Void speakers stacked on the back, three wheels. */
function goldenTicket(c: Ctx, t: number, night: number) {
  shadow(c, 56);
  c.fillStyle = "#e8b923"; c.beginPath(); c.moveTo(-50, -14); c.lineTo(-50, -34); c.lineTo(-14, -34); c.lineTo(10, -34); c.lineTo(22, -52); c.lineTo(44, -52); c.lineTo(52, -30); c.lineTo(52, -14); c.closePath(); c.fill(); // the body and the cab's back
  c.fillStyle = "#c9960c"; rr(c, -50, -20, 102, 5, 1); c.fill(); // the skirt
  for (let k = 0; k < 26; k++) { const a = t * 2 + k * 1.9, x = -46 + (k * 3.9) % 94, y = -48 + ((k * 7.3) % 30); if (x > 10 && y < -34) continue; c.fillStyle = `rgba(255,255,255,${0.35 + 0.45 * Math.abs(Math.sin(a))})`; c.fillRect(x, y, 1.6, 1.6); } // the sparkle
  c.fillStyle = "#2b3a4a"; c.beginPath(); c.moveTo(24, -50); c.lineTo(42, -50); c.lineTo(48, -34); c.lineTo(24, -34); c.closePath(); c.fill(); c.fillStyle = "rgba(255,255,255,.3)"; c.beginPath(); c.moveTo(26, -48); c.lineTo(40, -48); c.lineTo(44, -38); c.lineTo(26, -38); c.closePath(); c.fill(); // the cab's windscreen
  c.fillStyle = "#1e2233"; rr(c, 8, -56, 40, 5, 2); c.fill(); // the cab roof
  rider(c, 32, -34, "#ff8c42", Math.sin(t * 5) * 0.4); // the driver in the cab
  c.fillStyle = "#7a3b1e"; rr(c, -40, -46, 34, 12, 3); c.fill(); c.fillStyle = "#9b5230"; rr(c, -40, -58, 8, 14, 3); c.fill(); // the old bus seat, back and base
  c.fillStyle = "#5bd6c8"; rr(c, -30, -58, 10, 12, 3); c.fill(); c.fillStyle = SKIN; disc(c, -25, -62, 5); c.fill(); // someone on the seat
  c.fillStyle = "#1d1f2b"; for (const y of [-62, -48]) { rr(c, -62, y, 12, 13, 2); c.fill(); c.fillStyle = "#4b5068"; disc(c, -56, y + 6.5, 3.6); c.fill(); c.fillStyle = "#1d1f2b"; } // the Void stack on the back
  wheel(c, 40, -12, 12, t, true); wheel(c, -30, -12, 12, t, true);
  lamp(c, 52, -40, night);
  if (night > 0.3) for (let x = -48; x < 50; x += 6) { c.fillStyle = `hsl(${(x * 4 + t * 240) % 360} 100% 65%)`; disc(c, x, -17, 1.3); c.fill(); }
}

export const SIDE_VIEWS: Record<string, (c: Ctx, t: number, night: number) => void> = {
  unicycle, bike: (c, t, n) => cruiser(c, t, n, false), tuktuk, ebike: (c, t, n) => cruiser(c, t, n, true), fish: cuttlefish, artcar: goldenTicket,
};
