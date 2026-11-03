import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PLATFORM_CARS, type Platform } from "../artplatforms";
import { nightUniform } from "./camps";
import { shaped, type Xf } from "./materials";
import { quality } from "./quality";
import type { Ticket } from "./goldenTicket";

/**
 * The art cars built on the city games' base vehicles (artplatforms.ts: a bus, a tanker, a love wagon, a 4×4, a train, a tram and a boat on wheels; asked
 * 2026-11-02) as real bodies: each base is built in 3D in the car's own colours, and the drawing that dresses it in top-down (its deck, tank, load or rig)
 * is laid on its top. One mesh, so one draw call: the parts carry their colour per vertex and the top faces of the parts marked `top` sample a canvas the
 * dressing is painted into (looking straight down, as the top-down view does), every other face a white strip at the canvas's foot, so the vertex colour
 * shows. The canvas repaints like the roofs did (ten times a second near, once when the night comes or goes farther off: cars.ts), and glowing parts
 * (the LEDs, the lamps) give off their colour at night. Forward is -Z, right +X, the ground y = 0, the drawing's centre the car's; the drawing's feet are feet.
 */
export type PlatformModel = Ticket & { roof: number; far: true };
type Part = { geo: THREE.BufferGeometry; color: number; glow: number; top: boolean };
/** The canvas's extent in the car's frame (feet: x right, z toward the tail) and how its plain ground is filled before the dressing goes on, in the drawing's own coordinates. */
type Body = { parts: Part[]; area: [number, number, number, number]; fill(c: CanvasRenderingContext2D): void; roof: number };

const DARK = 0x1b1f3b, TYRE = 0x15161d, GLASS = 0x26304a, STEEL = 0x8a90a8, LAMP = 0xfff3b0, TAIL = 0xff2d55, WARM = 0xffe9a8;
const hexOf = (css: string) => parseInt(css.replace("#", "").slice(0, 6), 16);
const P = (geo: THREE.BufferGeometry, color: number, o: Xf = {}, glow = 0, top = false): Part => ({ ...shaped(geo, color, o), glow, top });
const box = (w: number, h: number, d: number, color: number, o: Xf = {}, glow = 0, top = false) => P(new THREE.BoxGeometry(w, h, d), color, o, glow, top);
/** A rod from a to b of radius r. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, color: number, glow = 0, seg = 5): Part {
  const d = new THREE.Vector3().subVectors(b, a), geo = new THREE.CylinderGeometry(r, r, d.length(), seg, 1, true);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())).translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return { geo, color, glow, top: false };
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** Wheels on axles at each z, x ±track, radius r, w wide, standing on the ground, each with a hub. */
const wheels = (track: number, zs: number[], r: number, w: number): Part[] => zs.flatMap((z) => [-1, 1].flatMap((s) => [
  P(new THREE.CylinderGeometry(r, r, w, 10), TYRE, { rz: Math.PI / 2, x: s * track, y: r, z }),
  P(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.2, 6, 1, true), STEEL, { rz: Math.PI / 2, x: s * track, y: r, z }),
]));
/** A rainbow of LEDs at the points: dull by day, every colour at night. */
const leds = (pts: [number, number, number][], s = 0.7, hue0 = 0): Part[] =>
  pts.map(([x, y, z], k) => P(new THREE.OctahedronGeometry(s * 0.7), new THREE.Color().setHSL(((hue0 + k * 25) % 360) / 360, 1, 0.6).getHex(), { x, y, z }, 1.4));
/** A run of points from a to b every `step` feet. */
const run = (a: [number, number, number], b: [number, number, number], step: number): [number, number, number][] => {
  const n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / step));
  return Array.from({ length: n + 1 }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2] + ((b[2] - a[2]) * k) / n]);
};

/** A footprint (points [x, z] round the outline in the car's frame) stood up from y0 to y1, its edges rounded by `bevel`. */
function slab(outline: [number, number][], y0: number, y1: number, color: number, top = false, bevel = 0, glow = 0): Part {
  const s = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  const b = Math.min(bevel, (y1 - y0) / 2 - 0.01);
  const geo = new THREE.ExtrudeGeometry(s, { depth: y1 - y0 - 2 * Math.max(0, b), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b, bevelSegments: 2, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2).translate(0, y0 + Math.max(0, b), 0);
  return { geo, color, glow, top };
}
/** A rounded rectangle's outline from x0..x1, z0..z1 with corner radius r (or [front, back] radii), a few points a corner. */
function rounded(x0: number, x1: number, z0: number, z1: number, r: number | [number, number], n = 4): [number, number][] {
  const [rf, rb] = typeof r === "number" ? [r, r] : r, pts: [number, number][] = [];
  const corner = (cx: number, cz: number, rr: number, a0: number) => { for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * (Math.PI / 2); pts.push([cx + rr * Math.cos(a), cz + rr * Math.sin(a)]); } };
  corner(x1 - rb, z1 - rb, rb, 0); corner(x0 + rb, z1 - rb, rb, Math.PI / 2); corner(x0 + rf, z0 + rf, rf, Math.PI); corner(x1 - rf, z0 + rf, rf, Math.PI * 1.5);
  return pts;
}
/** Rails round a deck at height y: posts every few feet along the outline and a rail on top, LEDs along it. */
function deckRail(outline: [number, number][], y: number, h: number, color: number, hue0: number): Part[] {
  const out: Part[] = [], lights: [number, number, number][] = [];
  outline.forEach((p, i) => {
    const q = outline[(i + 1) % outline.length], len = Math.hypot(q[0] - p[0], q[1] - p[1]);
    out.push(rod(V(p[0], y + h, p[1]), V(q[0], y + h, q[1]), 0.22, color));
    const n = Math.floor(len / 6);
    for (let k = 0; k <= n; k++) { const f = n ? k / n : 0, x = p[0] + (q[0] - p[0]) * f, z = p[1] + (q[1] - p[1]) * f; if (k < n || n === 0) out.push(rod(V(x, y, z), V(x, y + h, z), 0.18, color)); if (k % 2 === 0) lights.push([x, y + h + 0.45, z]); }
  });
  return [...out, ...leds(lights, 0.6, hue0)];
}
/** The outline scaled about the car's centre line (for an inset or a keel). */
const inset = (o: [number, number][], f: number, cz = 0): [number, number][] => o.map(([x, z]) => [x * f, cz + (z - cz) * f]);

/* ── the bases ─────────────────────────────────────────────────────────── */

function bus([paint, trim]: number[]): Body {
  const o = rounded(-12, 12, -30, 30, 3), y1 = 13.4;
  const parts: Part[] = [
    box(22, 2.4, 56, DARK, { y: 3.4 }),
    slab(o, 4.4, y1, paint, true, 0.8),
    slab(inset(o, 1.012), 5.6, 6.8, trim),
    // the windows down both sides, the windscreen and the rear window, a warm strip over the windows that lights at night
    ...[-1, 1].flatMap((s) => [box(0.3, 2.8, 48, GLASS, { x: s * 12.05, y: 9.6, z: 1 }), box(0.3, 0.35, 48, WARM, { x: s * 12.08, y: 11.4, z: 1 }, 0.9),
      ...[-15, -5, 5, 15].map((z) => box(0.4, 2.8, 0.5, paint, { x: s * 12.1, y: 9.6, z }))]),
    box(20, 4.2, 0.3, GLASS, { y: 9.6, z: -30.05 }), box(16, 2.6, 0.3, GLASS, { y: 10, z: 30.05 }),
    box(24.4, 1.4, 1.2, DARK, { y: 4.6, z: -30.4 }), box(24.4, 1.4, 1.2, DARK, { y: 4.6, z: 30.4 }),
    ...[-1, 1].flatMap((s) => [box(2, 1.2, 0.4, LAMP, { x: s * 9, y: 6.4, z: -30.25 }, 2.5), box(1.6, 1.2, 0.4, TAIL, { x: s * 10, y: 6.4, z: 30.25 }, 2)]),
    ...wheels(11.4, [-21, 19, 25], 3.4, 2.4),
    ...deckRail(rounded(-11.4, 11.4, -29.4, 29.4, 2, 2), y1, 2.8, STEEL, 0),
  ];
  return { parts, area: [-12.5, 12.5, -30.5, 30.5], fill: (c) => { c.fillStyle = hexCss(paint); c.fillRect(-13, -31, 26, 62); }, roof: y1 };
}

function tanker([cab]: number[], tank: number, boxy: boolean): Body {
  const cabO = rounded(-12, 12, -32, -17, [4, 1.5]), cy = 12.2, ry = 8, rx = 12.5;
  const parts: Part[] = [
    box(16, 2.4, 60, DARK, { y: 3.6, z: -1 }),
    slab(cabO, 4.2, 14.2, cab, true, 1),
    box(20, 3.4, 0.3, GLASS, { y: 11, z: -32.05 }), ...[-1, 1].map((s) => box(0.3, 3, 9, GLASS, { x: s * 12.05, y: 11, z: -25 })),
    box(24.6, 1.6, 1.2, STEEL, { y: 5, z: -32.4 }), ...[-1, 1].map((s) => box(2.2, 1.2, 0.4, LAMP, { x: s * 9, y: 7, z: -32.25 }, 2.5)),
    // exhaust stacks behind the cab
    ...[-1, 1].map((s) => rod(V(s * 10.5, 6, -16.5), V(s * 10.5, 19, -16.5), 0.55, STEEL, 0, 8)),
    box(8, 1.5, 3, 0x2a2c38, { y: 5, z: -15.5 }),
    // the tank: a long rounded barrel on its frame, its ends domed, three bands round it
    ...(boxy ? [
      // a shipping container: a box with its ribs down both sides and doors at the back
      box(25, 2 * ry, 44, tank, { y: cy, z: 8 }, 0, true),
      ...[-1, 1].flatMap((s) => Array.from({ length: 14 }, (_, k) => box(0.4, 2 * ry - 1, 0.5, new THREE.Color(tank).multiplyScalar(0.75).getHex(), { x: s * 12.6, y: cy, z: -12 + k * 3 }))),
      box(24, 2 * ry - 1, 0.3, new THREE.Color(tank).multiplyScalar(0.8).getHex(), { y: cy, z: 30.1 }), ...[-3, 3].map((x) => box(0.4, 2 * ry - 2, 0.4, STEEL, { x, y: cy, z: 30.3 })),
    ] : [
      P(new THREE.CylinderGeometry(1, 1, 40, 20, 1, true), tank, { rx: Math.PI / 2, sx: rx, sz: ry, y: cy, z: 8 }, 0, true),
      P(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), tank, { rx: -Math.PI / 2, sx: rx, sy: 3, sz: ry, y: cy, z: -12 }, 0, true),
      P(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), tank, { rx: Math.PI / 2, sx: rx, sy: 3, sz: ry, y: cy, z: 28 }, 0, true),
      ...[-6, 8, 22].map((z) => P(new THREE.TorusGeometry(1, 0.035, 4, 24), 0x2a2c38, { sx: rx * 1.01, sy: ry * 1.01, y: cy, z })),
    ]),
    ...[-1, 1].map((s) => box(1, 2, 40, DARK, { x: s * 9, y: 4.6, z: 8 })),
    ...leds([...run([-rx - 0.3, cy - ry + 1, -12], [-rx - 0.3, cy - ry + 1, 28], 3), ...run([rx + 0.3, cy - ry + 1, -12], [rx + 0.3, cy - ry + 1, 28], 3)], 0.7, 30),
    ...[-1, 1].map((s) => box(1.4, 1.2, 0.4, TAIL, { x: s * 7, y: 6, z: 30.3 }, 2)),
    ...wheels(11.6, [-24, 6, 14, 24], 3.3, 2.4),
  ];
  return { parts, area: [-13, 13, -32.5, 30.5], fill: (c) => { c.fillStyle = hexCss(tank); c.fillRect(-13, -14, 26, 46); c.fillStyle = hexCss(cab); c.fillRect(-13, -33, 26, 19); }, roof: cy + ry };
}

function wagon([paint]: number[]): Body {
  const o = rounded(-12, 12, -27, 27, [7, 5]), cream = 0xf4efe2, y1 = 14.6;
  const parts: Part[] = [
    box(20, 2, 48, DARK, { y: 3.2 }),
    slab(o, 3.8, y1, paint, true, 1.8),
    // the cream nose and its V down the front, the split windscreen, the round badge
    slab(rounded(-11.2, 11.2, -27.4, -21, [6.4, 0.5]), 4.2, 8.6, cream),
    box(9, 3.2, 0.4, GLASS, { x: -4.9, y: 11.2, z: -26.75, ry: 0.12 }), box(9, 3.2, 0.4, GLASS, { x: 4.9, y: 11.2, z: -26.75, ry: -0.12 }),
    P(new THREE.CylinderGeometry(1.4, 1.4, 0.4, 14), cream, { rx: Math.PI / 2, y: 7.6, z: -27.6 }),
    ...[-1, 1].flatMap((s) => [box(0.3, 2.8, 30, GLASS, { x: s * 12.05, y: 11, z: 3 }), box(1.8, 1.8, 0.4, LAMP, { x: s * 8.4, y: 7, z: -27.4 }, 2.5), box(1.2, 1.6, 0.4, TAIL, { x: s * 9.6, y: 8, z: 27.2 }, 2)]),
    box(23, 1.3, 1, cream, { y: 4.6, z: -27.6 }), box(23, 1.3, 1, cream, { y: 4.6, z: 27.6 }),
    ...leds([...run([-12.2, 6, -16], [-12.2, 6, 24], 3), ...run([12.2, 6, -16], [12.2, 6, 24], 3)], 0.7, 300),
    ...wheels(11.2, [-17, 17], 3, 2.4),
  ];
  return { parts, area: [-12.5, 12.5, -27.5, 27.5], fill: (c) => { c.fillStyle = hexCss(paint); c.fillRect(-13, -28, 26, 56); }, roof: y1 };
}

function fourByFour([paint]: number[]): Body {
  const fy = 9, roll = 0x2a2c38;
  const parts: Part[] = [
    box(18, 2.4, 52, DARK, { y: 6.2 }),
    // the bonnet and the cab's front, the open tub behind with its floor showing what it carries
    slab(rounded(-13, 13, -30, -15, [4, 0]), 7.4, 13, paint, true, 0.8),
    box(22, 4.6, 0.4, GLASS, { y: 15, z: -15.4, rx: -0.35 }), box(26, 1, 1, roll, { y: 17.2, z: -14.8 }),
    box(26, 1.2, 40, paint, { y: fy - 0.6, z: 5 }, 0, true),
    ...[-1, 1].flatMap((s) => [box(1, 3.4, 40, paint, { x: s * 12.5, y: fy + 1.7, z: 5 }), box(6.8, 1, 13, paint, { x: s * 13.8, y: 11.6, z: -20 }), box(6.8, 1, 13, paint, { x: s * 13.8, y: 11.6, z: 20 })]),
    box(26, 3.4, 1, paint, { y: fy + 1.7, z: 24.5 }),
    // the roll cage over the tub
    ...[-1, 1].flatMap((s) => [rod(V(s * 11, 13, -15), V(s * 11, 21, -13), 0.45, roll), rod(V(s * 11, 21, -13), V(s * 11, 21, 23), 0.45, roll), rod(V(s * 11, 21, 23), V(s * 11, 12, 25), 0.45, roll), rod(V(s * 11, 21, 5), V(s * 11, 12, 5), 0.45, roll)]),
    rod(V(-11, 21, -13), V(11, 21, -13), 0.45, roll), rod(V(-11, 21, 23), V(11, 21, 23), 0.45, roll), rod(V(-11, 21, 5), V(11, 21, 5), 0.45, roll),
    ...[-1, 1].flatMap((s) => [box(2, 1.4, 0.5, LAMP, { x: s * 9, y: 10.6, z: -30.3 }, 2.5), box(1.2, 1.2, 0.4, LAMP, { x: s * 7, y: 21.8, z: -13 }, 3)]),
    ...leds([...run([-10, 21.8, -9], [-10, 21.8, 23], 4), ...run([10, 21.8, -9], [10, 21.8, 23], 4)], 0.8, 0),
    ...wheels(14.4, [-20, 20], 5.2, 4.6),
  ];
  return { parts, area: [-13.5, 13.5, -30.5, 30.5], fill: (c) => { c.fillStyle = hexCss(paint); c.fillRect(-14, -31, 28, 62); c.fillStyle = "rgba(0,0,0,.22)"; c.fillRect(-12, -15, 24, 40); }, roof: fy };
}

function trainOf(colors: number[]): Body {
  const n = colors.length, len = 62 / n, parts: Part[] = [];
  colors.forEach((col, k) => {
    const z0 = -31 + k * len + 0.8, z1 = -31 + (k + 1) * len - 0.8, engine = k === 0;
    parts.push(slab(rounded(-10, 10, z0, z1, engine ? [6, 2.5] : 2.5), 3.4, engine ? 12.4 : 11.4, col, true, 1));
    parts.push(box(17, 1.4, len - 4, DARK, { y: 2.8, z: (z0 + z1) / 2 }));
    for (const s of [-1, 1]) {
      parts.push(box(0.3, 2.2, len - 6, GLASS, { x: s * 10.05, y: 8.6, z: (z0 + z1) / 2 }), box(0.3, 0.3, len - 6, WARM, { x: s * 10.08, y: 10.1, z: (z0 + z1) / 2 }, 0.9));
      parts.push(...leds(run([s * 10.15, 4.6, z0 + 2], [s * 10.15, 4.6, z1 - 2], 4), 0.6, k * 70));
    }
    parts.push(...wheels(9.2, [z0 + 3.2, z1 - 4.2], 1.9, 1.4));
    if (k > 0) parts.push(box(3, 1.4, 2.4, 0x2a2c38, { y: 4.2, z: z0 - 0.6 }));
    if (engine) parts.push(box(16, 3, 0.3, GLASS, { y: 9.6, z: z0 + 0.6 }), ...[-1, 1].map((s) => box(1.8, 1.2, 0.4, LAMP, { x: s * 6, y: 6, z: z0 - 0.05 }, 2.5)), P(new THREE.CylinderGeometry(1.4, 1, 4, 10), 0x2a2c38, { y: 14, z: z0 + 5 }));
  });
  return { parts, area: [-10.5, 10.5, -31, 31], fill: (c) => colors.forEach((col, k) => { c.fillStyle = hexCss(col); c.fillRect(-11, -31 + k * len, 22, len); }), roof: 11.4 };
}

function tramOf([paint, trim]: number[]): Body {
  const o = rounded(-11.5, 11.5, -30.5, 30.5, 9), y1 = 14.2;
  const parts: Part[] = [
    box(18, 2, 54, DARK, { y: 2.8 }),
    slab(rounded(-12, 12, -31, 31, 10), 3.6, 6.6, trim),
    slab(o, 6.4, y1, paint, true, 1.2),
    // the windows down both sides (the drawing's at z -20 to 18), the lamp strip over them, the windscreens at each end
    ...[-1, 1].flatMap((s) => [...[-20, -14, -8, -2, 4, 10, 16].map((z) => box(0.3, 3.4, 4, GLASS, { x: s * 11.55, y: 10, z: z + 2 })), box(0.3, 0.35, 42, WARM, { x: s * 11.58, y: 12.1, z: 0 }, 0.9)]),
    box(12, 3.6, 0.4, GLASS, { y: 10.2, z: -30.6 }), box(12, 3.6, 0.4, GLASS, { y: 10.2, z: 30.6 }),
    ...[-1, 1].map((s) => box(1.6, 1.4, 0.4, LAMP, { x: s * 6, y: 7.6, z: -31.1 }, 2.5)),
    // the trolley pole off the roof, its lamp at the tip
    box(4, 1.2, 6, 0x2a2c38, { y: y1 + 0.6, z: 0 }), rod(V(0, y1 + 1, 0), V(0, y1 + 9, -30), 0.3, 0x2a2c38), P(new THREE.SphereGeometry(1.2, 10, 6), 0x9be7ff, { y: y1 + 9.2, z: -30.6 }, 2.2),
    ...wheels(10.2, [-20, -12, 12, 20], 1.8, 1.4),
  ];
  return { parts, area: [-12, 12, -31, 31], fill: (c) => { c.fillStyle = hexCss(paint); c.fillRect(-12, -31, 24, 62); }, roof: y1 };
}

/** The boat's outline as the drawing has it: a pointed bow at z -34 swelling to the beam and a rounded stern at z 26 to 31. */
function hullOutline(): [number, number][] {
  const q = (a: [number, number], c: [number, number], b: [number, number], n: number) => Array.from({ length: n }, (_, k) => { const t = k / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]] as [number, number]; });
  return [...q([0, -34], [15, -18], [13, 26], 10), ...q([13, 26], [0, 31], [-13, 26], 6), ...q([-13, 26], [-15, -18], [0, -34], 10)];
}
function boatOf([hull, deck]: number[]): Body {
  const o = hullOutline(), y1 = 11.5, hullDark = new THREE.Color(hull).multiplyScalar(0.7).getHex();
  const parts: Part[] = [
    box(14, 2, 40, DARK, { y: 3, z: 6 }),
    slab(inset(o, 0.72, 4), 3.4, 6.6, hullDark),
    slab(o, 6.4, y1, hull, true, 0.6),
    slab(inset(o, 1.015), 8.2, 8.9, 0xf4efe2),
    ...deckRail(inset(o, 0.95).filter((_, i) => i % 2 === 0), y1, 2.4, 0xe9e4d6, 180),
    // a mast at the bow's third with its lamp
    rod(V(0, y1, -12), V(0, y1 + 16, -12), 0.4, 0xe9e4d6, 0, 8), P(new THREE.SphereGeometry(0.8, 8, 5), LAMP, { y: y1 + 16.4, z: -12 }, 3),
    ...wheels(10, [-6, 20], 2.8, 2.2),
  ];
  return { parts, area: [-15, 15, -34, 31], fill: (c) => {
    c.fillStyle = hexCss(hull); c.fillRect(-15, -34, 30, 65);
    c.fillStyle = hexCss(deck); c.beginPath(); c.moveTo(0, -29); c.quadraticCurveTo(11, -15, 10, 24); c.quadraticCurveTo(0, 28, -10, 24); c.quadraticCurveTo(-11, -15, 0, -29); c.fill();
  }, roof: y1 };
}

const hexCss = (h: number) => `#${h.toString(16).padStart(6, "0")}`;

/* ── the model ─────────────────────────────────────────────────────────── */

/** Pixels a foot of the dressing's canvas (two thirds of that on a phone), and the rows of white under it that the untextured faces sample. */
const PX = 4, PAD = 4;

/** The material: lit, the vertex colour times the canvas as the surface, `aGlow` times the night's level of that surface given off as light. One program for every car. */
function material(tex: THREE.Texture): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, map: tex, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uNight = nightUniform;
    s.vertexShader = "attribute float aGlow;\nvarying float vGlow;\n" + s.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vGlow = aGlow;");
    s.fragmentShader = "uniform float uNight;\nvarying float vGlow;\n" + s.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * uNight * vGlow;");
  };
  m.customProgramCacheKey = () => "platform-glow";
  return m;
}

/** The average colour of the opaque pixels a dressing paints over its area, for a part (a tanker's tank) whose colour is the drawing's own. */
function averageOf(p: Platform, area: Body["area"]): { color: number; boxy: boolean } {
  const [x0, x1, z0, z1] = area, c = document.createElement("canvas"); c.width = Math.ceil((x1 - x0) * 2); c.height = Math.ceil((z1 - z0) * 2);
  const x = c.getContext("2d")!; x.scale(2, 2); x.translate(-x0, -z0);
  try { p.dress(x, 0, 0); } catch { return { color: 0x9aa0ad, boxy: false }; }
  // a dressing that fills its area's corner is square (a container), one that leaves it clear is round (a tank)
  const boxy = x.getImageData(Math.round((0.6) * 2), Math.round((0.6) * 2), 1, 1).data[3] > 200;
  const d = x.getImageData(0, Math.round(c.height * 0.4), c.width, Math.round(c.height * 0.5)).data;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
  return { color: n ? (Math.round(r / n) << 16) | (Math.round(g / n) << 8) | Math.round(b / n) : 0x9aa0ad, boxy };
}

function bodyOf(p: Platform): Body {
  const cols = p.colors.map(hexOf);
  switch (p.base) {
    case "bus": return bus(cols);
    case "tanker": { const a = averageOf(p, [-12.5, 12.5, -14, 30]); return tanker(cols, a.color, a.boxy); }
    case "wagon": return wagon(cols);
    case "4x4": return fourByFour(cols);
    case "train": return trainOf(cols);
    case "tram": return tramOf(cols);
    case "boat": return boatOf(cols);
  }
}

/** The ids of the art cars built on a base, and the model of each: one mesh, its canvas repainted by paint(t, night). */
export const PLATFORM_IDS = Object.keys(PLATFORM_CARS);
export function platformModel(id: string): PlatformModel {
  const p = PLATFORM_CARS[id].platform, body = bodyOf(p), [x0, x1, z0, z1] = body.area;
  const px = quality.touch ? (PX * 2) / 3 : PX, W = Math.ceil((x1 - x0) * px), H = Math.ceil((z1 - z0) * px), CH = H + PAD;
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = CH;
  const ctx = canvas.getContext("2d")!, tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const paint = (t: number, night: number) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, CH);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, H, W, PAD);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip(); ctx.scale(W / (x1 - x0), H / (z1 - z0)); ctx.translate(-x0, -z0);
    body.fill(ctx);
    try { p.dress(ctx, t, night); } catch { /* a dressing that waits on an image draws nothing this time */ }
    ctx.restore();
    tex.needsUpdate = true;
  };

  // each face: a top face of a `top` part looks down onto the canvas (white, so the picture is its colour); every other face samples the white strip
  const c = new THREE.Color(), white = 1 - (H + PAD / 2) / CH, vTop = H / CH;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), nrm = new THREE.Vector3();
  const geos = body.parts.map(({ geo, color, glow, top }) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    for (const name of Object.keys(g.attributes)) if (name !== "position" && name !== "normal") g.deleteAttribute(name);
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    const pos = g.getAttribute("position"), n = pos.count, col = new Float32Array(n * 3), uv = new Float32Array(n * 2), gl = new Float32Array(n);
    c.setHex(color, THREE.SRGBColorSpace);
    for (let i = 0; i < n; i += 3) {
      a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); d.fromBufferAttribute(pos, i + 2);
      nrm.subVectors(d, b).cross(a.clone().sub(b)).normalize();
      const up = top && Math.abs(nrm.y) > 0.45;
      for (let k = i; k < i + 3; k++) {
        if (up) {
          const u = (pos.getX(k) - x0) / (x1 - x0), v = (pos.getZ(k) - z0) / (z1 - z0);
          uv[k * 2] = Math.min(0.995, Math.max(0.005, u)); uv[k * 2 + 1] = 1 - Math.min(0.995, Math.max(0.005, v)) * vTop;
          col.set([1, 1, 1], k * 3); gl[k] = 0.35;
        } else { uv[k * 2] = 0.5; uv[k * 2 + 1] = white; col.set([c.r, c.g, c.b], k * 3); gl[k] = glow; }
      }
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); g.setAttribute("uv", new THREE.BufferAttribute(uv, 2)); g.setAttribute("aGlow", new THREE.BufferAttribute(gl, 1));
    return g;
  });
  const mesh = new THREE.Mesh(mergeGeometries(geos)!, material(tex));
  for (const g of geos) g.dispose();
  const group = new THREE.Group(); group.add(mesh);
  paint(0, 0);
  group.userData.ticket = { group, paint };
  return { group, paint, roof: body.roof, far: true };
}
