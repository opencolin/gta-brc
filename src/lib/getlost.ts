/**
 * Black Rock City 2026 as getlost.fyi maps it (asked 2026-11-03): every camp, art piece, mutant vehicle and
 * city service, every event, the camps' posted lineups, the city's named points, the potty banks and the
 * night sky, imported by scripts/import-getlost.mjs into public/data/getlost-2026.json (3 MB, fetched when wanted,
 * not bundled).
 *
 * The file keeps places as the real city has them: a clock position and real feet from the Man. The 2026 city's
 * streets are not where the game's are (its outer blocks are deeper, and it stops at K), so `toGame` moves a
 * place street by street: a camp between the real F and G lands between the game's F and G, at its own clock.
 * Out past the last street, distances are the real ones times CITY_SCALE, as on the open playa inside.
 *
 * No DOM but the one fetch: getlost.test.mjs checks the rest.
 */
import { ARC_R, CITY_FROM, CITY_TO, CITY_SCALE, arcIndex, arcWidth, polar, radialWidth, surfaceAt, toPolar, type Vec } from "./brc.ts";

export type PlaceKind = "camp" | "art" | "mutant" | "service";
export type Place = {
  uid: string; kind: PlaceKind; name: string; address?: string;
  /** minutes past 12:00 and real feet from the Man; none for a mutant vehicle that roams with no home camp */
  clock?: number; ft?: number;
  approx?: boolean; roams?: boolean; artist?: string; form?: string; icon?: string; topics?: string[];
  hometown?: string; country?: string; open?: [number, number]; url?: string; image?: string; desc?: string; source?: string;
};
/** An event: `at` is its host's uid when the host is a listed place; `from`/`to` are hours, past 24 after midnight. */
export type PlayaEvent = { uid: string; name: string; at?: string; venue: string; address?: string; clock: number; ft: number; day: string; from: number; to: number; cat: string; tags?: string[]; desc?: string };
export type Lineup = { uid: string; name: string; type: string; mobile: boolean; location?: string; source?: string; note?: string; sets: { artist: string; day: string | null; time?: string; notes?: string }[] };
export type CityPoint = { name: string; clock: number; ft: number };
export type PottyBank = { clock: string; block: string; line: { clock: number; ft: number }[] };
export type GetLost = {
  _meta: { from: string; imported: string; built: string; year: number; dates: [string, string]; note: string };
  places: Place[]; events: PlayaEvent[]; lineups: Lineup[]; points: CityPoint[]; potties: PottyBank[]; sky: Record<string, unknown>;
};

/** The 2026 city's arc streets, Esplanade to K, in real feet from the Man (measured from getlost.fyi's street lines). */
export const REAL_ARC_FT: readonly number[] = [2493, 2926, 3205, 3485, 3764, 4048, 4532, 4811, 5090, 5369, 5549, 5738];

/** Real feet from the Man → game feet: the Man to the Esplanade and beyond K scale by CITY_SCALE, between streets street by street. */
export function gameR(ft: number): number {
  const R = REAL_ARC_FT;
  if (ft <= R[0]) return (ft / R[0]) * ARC_R[0];
  for (let i = 1; i < R.length; i++) if (ft <= R[i]) return ARC_R[i - 1] + ((ft - R[i - 1]) / (R[i] - R[i - 1])) * (ARC_R[i] - ARC_R[i - 1]);
  return ARC_R[R.length - 1] + (ft - R[R.length - 1]) * CITY_SCALE;
}
/** Where a place, event or point stands in the game, or null for one with no place (a roaming art car). */
export const toGame = (p: { clock?: number; ft?: number }): Vec | null => (p.clock == null || p.ft == null ? null : polar(p.clock, gameR(p.ft)));

/**
 * Where a camp stands: its spot from `toGame`, stepped off the street into the block it fronts. The real frontage is
 * about where the game's wider street runs; "man side" steps toward the Man, "mountain side" away, otherwise away
 * from the street's middle (and off the Esplanade always away: its "man side" is the camp facing the Man), and inside
 * 2:00 and 10:00. Plazas and portals are left as they are.
 */
export function campAt(p: { address?: string; clock?: number; ft?: number }): Vec | null {
  const at = toGame(p);
  if (!at) return null;
  if (surfaceAt(at).kind === "block") return at;
  const street = /(?:^|& )([A-K]|Esplanade)(?: ·|$| &)/.exec(p.address ?? "")?.[1] ?? (surfaceAt(at) as { arc?: string }).arc;
  if (!street) return at; // a plaza, a portal: as it is
  let { min, r } = toPolar(at);
  const i = arcIndex(street), side = /man side/.test(p.address ?? "") ? -1 : /mountain side/.test(p.address ?? "") ? 1 : 0;
  r = ARC_R[i] + (i === 0 ? 1 : side || Math.sign(r - ARC_R[i]) || 1) * (arcWidth(i) / 2 + IN); // nobody camps the Man's side of the Esplanade
  const edge = ((radialWidth(CITY_FROM) / 2 + IN) / r) * (720 / (Math.PI * 2));
  min = Math.min(CITY_TO - edge, Math.max(CITY_FROM + edge, min)); // 2:00 and 10:00 are the city's edges: inside them
  const s = surfaceAt(polar(min, r));
  if (s.kind === "road" && s.radial != null) {
    const off = Math.sign(min - s.radial) || 1;
    min = s.radial + off * ((radialWidth(s.radial) / 2 + IN) / r) * (720 / (Math.PI * 2));
  }
  return polar(min, r);
}
/** How far into the block a camp's spot is stepped from the street's edge, in game feet. */
const IN = 45;

/* ── the burn's clock ───────────────────────────────────────────────────── */

/** The burn week the game's days run through, from the Monday the gates are open (most events are Monday to Friday). */
export const BURN_DAYS = ["2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06"] as const;
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Mon" for "2026-08-31". */
export const dayName = (day: string) => WEEKDAY[new Date(`${day}T12:00:00Z`).getUTCDay()];
/** 16.5 → "4:30 PM", 25 → "1 AM", 12 → "noon", 24 → "midnight". */
export function hourLabel(h: number): string {
  const m = Math.round(h * 60) % 1440, hh = Math.floor(m / 60), mm = m % 60;
  if (mm === 0 && hh === 12) return "noon";
  if (mm === 0 && hh === 0) return "midnight";
  return `${hh % 12 || 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${hh < 12 ? "AM" : "PM"}`;
}
/**
 * The day and hour at a point in the game's day (`f` 0 to 1 of DAY_SECONDS, `n` days in): playa.ts's nightLevel has the sun
 * down from f 0.45 to 0.95, so that is sunset at 7:30 PM to sunrise at 6:30 AM, the night 11 hours and the day 13. Day `n`
 * of the game is BURN_DAYS[n] (round again after Sunday); after midnight it is the next day.
 */
export function burnTime(n: number, f: number): { day: string; hour: number } {
  const night = f >= 0.45 && f < 0.95, g = ((f - 0.95) % 1 + 1) % 1;
  let hour = night ? 19.5 + ((f - 0.45) / 0.5) * 11 : 6.5 + (g / 0.5) * 13, d = n;
  if (night && hour >= 24) { hour -= 24; d++; }
  if (!night && f >= 0.95) d++; // past dawn: the next morning
  return { day: BURN_DAYS[((d % 7) + 7) % 7], hour };
}
/** Whether an event is on at a day and hour: its own day, or past midnight on the day before (its hours run past 24). */
export function isOn(e: { day: string; from: number; to: number }, day: string, hour: number): boolean {
  if (e.day === day) return e.from <= hour && hour < e.to;
  const i = BURN_DAYS.indexOf(day as (typeof BURN_DAYS)[number]);
  return i > 0 && e.day === BURN_DAYS[i - 1] && e.from <= hour + 24 && hour + 24 < e.to;
}

let loading: Promise<GetLost> | null = null;
/** The imported data, fetched once. */
export const loadGetLost = (): Promise<GetLost> => loading ??= fetch("/data/getlost-2026.json").then((r) => {
  if (!r.ok) throw new Error(`getlost-2026.json: ${r.status}`);
  return r.json() as Promise<GetLost>;
});
