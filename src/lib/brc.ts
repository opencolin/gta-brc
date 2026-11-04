/**
 * Black Rock City, as geometry: the street grid the playa game (playa.ts, PlayaWin.tsx) drives on.
 *
 * Units are feet, with the Man at the origin. Screen axes: x to the right, y down, and 12:00
 * straight up. A clock position is an angle measured clockwise from 12:00: 3:00 is due right,
 * 6:00 straight down, 9:00 due left. The city is a partial circle from 2:00 round through
 * 6:00 to 10:00, open toward 12:00 where the Temple stands out on the playa past the Man.
 *
 * Proportions follow the real city, scaled up by CITY_SCALE (1.5×, so the camps have room
 * for alleys, RV circles and shade): the Esplanade is 2,500 ft from the Man in the real city,
 * and since 2026-11-03 the streets are where the 2026 city's are (getlost.fyi's street map,
 * measured in getlost.ts's import): the Esplanade 2,500 ft from the Man, A 430 ft out from it,
 * then blocks of about 280 ft, E to F twice that, and the outer two 180 ft. Streets are drawn
 * wider than the real 40 ft (scaled) so an art car can be steered on them.
 * The arc streets are lettered A to K (their names change every year). Radials run every half
 * hour from 2:00 to 10:00; 3:00, 4:30, 6:00, 7:30 and 9:00 are the wide ones. Center Camp is
 * a plaza on the 6:00 radial over the Esplanade, A and B; the round plazas are at B and G on
 * the wide radials, at 2:00 & B and 10:00 & B, and the trash fence is a pentagon round the
 * whole thing.
 *
 * No imports, no DOM: brc.test.mjs checks it.
 */

export type Vec = { x: number; y: number };

/** The game's city against the real one: every distance from the Man is the real one times this. */
export const CITY_SCALE = 1.5;
const S = CITY_SCALE;

/** The arc streets, inside out: the Esplanade faces the Man, then A to L. */
export const ARCS = ["Esplanade", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"] as const;
export type ArcName = (typeof ARCS)[number];
/** Each arc street's distance from the Man, in feet. */
export const ARC_R: readonly number[] = [2500, 2930, 3205, 3485, 3765, 4045, 4530, 4810, 5090, 5370, 5550, 5740].map((r) => r * S);
/** Road widths, in feet: widened from the real 40 ft so a car fits with room to steer. */
/** The longest ride's length (playa.ts VEHICLES; playa.test.mjs holds every ride to it). */
export const CAR_LEN_REF = 36;
/** A street is twice the longest car: two pass, and one can turn round. */
export const ROAD_W = 2 * CAR_LEN_REF;
export const WIDE_ROAD_W = Math.round(2.9 * CAR_LEN_REF);
export const ESPLANADE_W = WIDE_ROAD_W;

/** The radial streets, in minutes past 12:00: 2:00 (120) to 10:00 (600), every half hour. */
export const RADIALS: readonly number[] = Array.from({ length: 17 }, (_, i) => 120 + i * 30);
/** The wide radials: 3:00, 4:30, 6:00, 7:30 and 9:00. */
export const WIDE_RADIALS: readonly number[] = [180, 270, 360, 450, 540];
export const CITY_FROM = 120;
export const CITY_TO = 600;

export const MAN: Vec = { x: 0, y: 0 };
export const MAN_R = 80;
/** The Temple: out at 12:00, as far past the Man as the Esplanade is on the other side. */
export const TEMPLE_DIST = 2500 * S;
export const TEMPLE_R = 120;
/** Center Camp: on 6:00 over the Esplanade, A and B, out to Route 66; the plaza is open, the café in its middle is not. */
export const CENTER_CAMP_DIST = 2990 * S;
export const CENTER_CAMP_R = 520 * S;
export const CAFE_R = 130 * S;
/** The trash fence: a regular pentagon round the Man, one corner at 12:00. */
export const FENCE_R = 8260 * S;

/** Minutes past 12:00 → radians clockwise from 12:00. */
export const clockToAngle = (min: number) => (min / 720) * Math.PI * 2;
/** Radians → minutes past 12:00, in [0, 720). */
export const angleToClock = (a: number) => {
  const m = (a / (Math.PI * 2)) * 720;
  return ((m % 720) + 720) % 720;
};
/** A point from (minutes past 12:00, distance from the Man in feet). */
export function polar(min: number, r: number): Vec {
  const a = clockToAngle(min);
  return { x: r * Math.sin(a), y: -r * Math.cos(a) };
}
/** A point → its clock position (minutes past 12:00) and its distance from the Man. */
export function toPolar(p: Vec): { min: number; r: number } {
  return { min: angleToClock(Math.atan2(p.x, -p.y)), r: Math.hypot(p.x, p.y) };
}

/** "7:30" for 450, "12:00" for 0. */
export function clockLabel(min: number): string {
  const m = Math.round(((min % 720) + 720) % 720);
  const h = Math.floor(m / 60) % 12, mm = m % 60;
  return `${h === 0 ? 12 : h}:${String(mm).padStart(2, "0")}`;
}
/** "7:30" → 450; null for anything that is not a clock time. */
export function parseClock(s: string): number | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (h < 1 || h > 12 || mm > 59) return null;
  return (h % 12) * 60 + mm;
}

export const radialWidth = (min: number) => (WIDE_RADIALS.includes(min) ? WIDE_ROAD_W : ROAD_W);
export const arcWidth = (i: number) => (i === 0 ? ESPLANADE_W : ROAD_W);
export const arcIndex = (name: string) => ARCS.indexOf(name as ArcName);

/** The middle of an intersection: "4:30 & C" → a point. Throws on an address off the grid. */
export function pointAt(clock: string | number, arc: string): Vec {
  const min = typeof clock === "number" ? clock : parseClock(clock);
  const i = arcIndex(arc);
  if (min == null || i < 0) throw new Error(`no such address: ${clock} & ${arc}`);
  return polar(min, ARC_R[i]);
}
/** "4:30 & C" → a point, or null. */
export function parseAddress(s: string): Vec | null {
  const m = /^\s*(\d{1,2}:\d{2})\s*&\s*([A-L]|Esplanade)\s*$/i.exec(s);
  if (!m) return null;
  const arc = m[2].length === 1 ? m[2].toUpperCase() : "Esplanade";
  const min = parseClock(m[1]);
  if (min == null || min < CITY_FROM || min > CITY_TO) return null;
  return pointAt(min, arc);
}

export const CENTER_CAMP: Vec = polar(360, CENTER_CAMP_DIST);
/** The round plazas (open ground, no camps): at B and G on the wide radials, 6:00 & G, and the bigger ones at 2:00 & B and 10:00 & B. */
export const PLAZAS: readonly (Vec & { r: number; name: string })[] = [
  ...[180, 270, 450, 540].map((m) => ({ ...polar(m, ARC_R[2]), r: 100 * S, name: `${clockLabel(m)} & B Plaza` })),
  ...[180, 270, 360, 450, 540].map((m) => ({ ...polar(m, ARC_R[7]), r: 100 * S, name: `${clockLabel(m)} & G Plaza` })),
  ...[125, 595].map((m) => ({ ...polar(m, ARC_R[2]), r: 133 * S, name: `${clockLabel(m === 125 ? 120 : 600)} & B Plaza` })),
];
export const TEMPLE: Vec = polar(0, TEMPLE_DIST);

/**
 * The airport (88NV, asked 2026-10-22): past the fence at about 4:00, two runways side by side on a slight
 * slant, a line of hangars beside them, and a pad at the near end of the first runway where a plane waits.
 * `local` turns runway coordinates (x along the runway, y across it) into city space; `h` is the heading
 * a plane takes off on; the fence is open to it between `gap.from` and `gap.to` on the clock.
 */
export const AIRPORT = (() => {
  const at = polar(252, 7600 * S * 1.09), ta = clockToAngle(252) + Math.PI / 2 + 0.35;
  const local = (lx: number, ly: number): Vec => ({ x: at.x + lx * Math.cos(ta) - ly * Math.sin(ta), y: at.y + lx * Math.sin(ta) + ly * Math.cos(ta) });
  return { at, ta, h: ta + Math.PI / 2, runwayLen: 4600, runwayW: 110, runwayOff: 140, local, pad: local(-2000, -140), gap: { from: 215, to: 290 } };
})();

/** The fence's five corners, clockwise from the one at 12:00. */
export const FENCE: readonly Vec[] = Array.from({ length: 5 }, (_, i) => polar(i * 144, FENCE_R));
/**
 * Gate Road and the Gate (asked 2026-10-26): the road in from the highway at 4:30, past the airport, through the
 * fence's open wedge (AIRPORT.gap) to the city's last street; the Gate stands outside the fence, a row of booths
 * astride the road with the Greeters' bell beside it. `stop` is where you pull up for a dust angel and the bell.
 */
export const GATE = (() => {
  const min = 270, a = clockToAngle(min), lat = { x: Math.cos(a), y: Math.sin(a) }; // across the road
  const at = polar(min, FENCE_R * 1.25), stop = polar(min, FENCE_R * 1.25 - 230);
  return { min, a, lat, at, stop, bell: { x: stop.x + lat.x * 70, y: stop.y + lat.y * 70 }, road: { from: polar(min, ARC_R[ARC_R.length - 1]), to: polar(min, FENCE_R * 1.7) }, width: 110 };
})();

/**
 * "WELCOME HOME" in big letters on the playa (asked 2026-11-03): inside the fence between it and K on the airport's radial, its top toward the
 * Man so it reads the right way up from a plane flying in from the airport. `at` is its middle, `rot` the canvas rotation that turns
 * the text's top toward the Man, `w` and `h` its size in feet; citymap.ts paints it and ground.ts lays it on the 3D ground.
 */
export const WELCOME = { at: polar(252, 6330 * S), rot: clockToAngle(252) + Math.PI, w: 2000, h: 1000 };

/** How far a point is inside the fence (negative: outside), and the inward normal of the nearest side. */
export function fenceDepth(p: Vec): { depth: number; nx: number; ny: number } {
  let best = { depth: Infinity, nx: 0, ny: 0 };
  for (let i = 0; i < 5; i++) {
    const a = FENCE[i], b = FENCE[(i + 1) % 5];
    // inward normal of a clockwise polygon in y-down axes
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const l = Math.hypot(nx, ny); nx /= l; ny /= l;
    if (nx * -a.x + ny * -a.y < 0) { nx = -nx; ny = -ny; }
    const d = (p.x - a.x) * nx + (p.y - a.y) * ny;
    if (d < best.depth) best = { depth: d, nx, ny };
  }
  return best;
}

/** The ring a distance from the Man falls in: -1 inside the Esplanade, ARCS.length - 1 past K, i between arc i and i + 1. */
export function ringOf(r: number): number {
  if (r < ARC_R[0]) return -1;
  for (let i = 0; i < ARC_R.length - 1; i++) if (r < ARC_R[i + 1]) return i;
  return ARC_R.length - 1;
}

/** Whether a clock position is within the city's span, 2:00 to 10:00. */
export const inCitySpan = (min: number) => min >= CITY_FROM && min <= CITY_TO;

export type Surface =
  | { kind: "road"; arc?: ArcName; radial?: number }
  | { kind: "block"; ring: number; sector: number }
  | { kind: "plaza" }
  | { kind: "playa" }
  | { kind: "outside" };

/**
 * What is under a point: a road (an arc street, a radial or both at a corner), a block of
 * camps (ring i between arc i and i + 1, sector j between radial j and j + 1), Center Camp's
 * plaza, open playa, or beyond the fence.
 */
export function surfaceAt(p: Vec): Surface {
  if (fenceDepth(p).depth < 0) return { kind: "outside" };
  if (Math.hypot(p.x - CENTER_CAMP.x, p.y - CENTER_CAMP.y) < CENTER_CAMP_R) return { kind: "plaza" };
  for (const z of PLAZAS) if (Math.abs(p.x - z.x) < z.r && Math.abs(p.y - z.y) < z.r && Math.hypot(p.x - z.x, p.y - z.y) < z.r) return { kind: "plaza" };
  const { min, r } = toPolar(p);
  const span = min >= CITY_FROM - 1e-9 && min <= CITY_TO + 1e-9;
  // the arc street under the point, if any (an arc is a road only inside the city's span, with a half road of overhang)
  let arc: ArcName | undefined;
  for (let i = 0; i < ARC_R.length; i++) {
    if (Math.abs(r - ARC_R[i]) <= arcWidth(i) / 2) {
      const over = ((arcWidth(i) / 2) / ARC_R[i]) * (720 / (Math.PI * 2));
      if (min >= CITY_FROM - over && min <= CITY_TO + over) arc = ARCS[i];
      break;
    }
  }
  let radial: number | undefined;
  const inner = ARC_R[0] - ESPLANADE_W / 2, outer = ARC_R[ARC_R.length - 1] + ROAD_W / 2;
  if (r >= inner && r <= outer) {
    for (const m of RADIALS) {
      const off = Math.abs(clockToAngle(min - m)) * r; // arc length to the radial's centre line
      if (off <= radialWidth(m) / 2) { radial = m; break; }
    }
  }
  if (arc || radial != null) return { kind: "road", ...(arc ? { arc } : {}), ...(radial != null ? { radial } : {}) };
  if (!span || r < ARC_R[0] || r > ARC_R[ARC_R.length - 1]) return { kind: "playa" };
  const ring = ringOf(r);
  let sector = 0;
  while (sector < RADIALS.length - 2 && min > RADIALS[sector + 1]) sector++;
  return { kind: "block", ring, sector };
}

/** The solid part of a block, as (inner r, outer r, from min, to min) with the streets' half widths taken off. */
export function blockBounds(ring: number, sector: number) {
  const r0 = ARC_R[ring] + arcWidth(ring) / 2, r1 = ARC_R[ring + 1] - arcWidth(ring + 1) / 2;
  const m0 = RADIALS[sector], m1 = RADIALS[sector + 1];
  return { r0, r1, m0, m1, w0: radialWidth(m0) / 2, w1: radialWidth(m1) / 2 };
}

/**
 * How deep a point is inside a block of camps, and the way out: the unit normal pointing
 * from the block into the nearest street. Null when the point is not in a block.
 */
export function blockPush(p: Vec): { depth: number; nx: number; ny: number } | null {
  const s = surfaceAt(p);
  if (s.kind !== "block") return null;
  const { min, r } = toPolar(p);
  const b = blockBounds(s.ring, s.sector);
  const a = clockToAngle(min);
  const ur = { x: Math.sin(a), y: -Math.cos(a) }; // away from the Man
  const ut = { x: Math.cos(a), y: Math.sin(a) };  // clockwise
  const cands = [
    { depth: r - b.r0, nx: -ur.x, ny: -ur.y },
    { depth: b.r1 - r, nx: ur.x, ny: ur.y },
    { depth: clockToAngle(min - b.m0) * r - b.w0, nx: -ut.x, ny: -ut.y },
    { depth: clockToAngle(b.m1 - min) * r - b.w1, nx: ut.x, ny: ut.y },
  ];
  let best = cands[0];
  for (const c of cands) if (c.depth < best.depth) best = c;
  return { depth: Math.max(0, best.depth), nx: best.nx, ny: best.ny };
}

/** The nearest quarter hour on the clock, as minutes past 12:00. */
const quarter = (min: number) => (Math.round(min / 15) * 15) % 720;

/**
 * Where a point is, the way burners say it: "7:30 & E" in the city (the nearest quarter hour
 * and the nearest arc street), "7:30 & Esplanade", "Center Camp", "the Man", "the Temple",
 * and out on the open playa the clock and the distance from the Man: "4:30 & 1200'".
 */
export function addressOf(p: Vec): string {
  const { min, r } = toPolar(p);
  if (r < MAN_R + 140) return "the Man";
  if (Math.hypot(p.x - TEMPLE.x, p.y - TEMPLE.y) < TEMPLE_R + 160) return "the Temple";
  if (Math.hypot(p.x - CENTER_CAMP.x, p.y - CENTER_CAMP.y) < CENTER_CAMP_R + 20) return "Center Camp";
  const q = quarter(min);
  const outer = ARC_R[ARC_R.length - 1] + 120;
  if (inCitySpan(q) && r >= ARC_R[0] - 120 && r <= outer) {
    let best = 0;
    for (let i = 1; i < ARC_R.length; i++) if (Math.abs(r - ARC_R[i]) < Math.abs(r - ARC_R[best])) best = i;
    return `${clockLabel(q)} & ${ARCS[best]}`;
  }
  if (fenceDepth(p).depth < 0) return "past the trash fence";
  const ft = Math.round(r / 100) * 100;
  return `${clockLabel(q)} & ${ft}'`;
}
