#!/usr/bin/env node
/**
 * Imports getlost.fyi's 2026 Black Rock City data (asked 2026-11-03) into public/data/getlost-2026.json for the
 * playa game: every camp, art piece, mutant vehicle and city service with its place, every event with its day and
 * hours, the camps' posted lineups, the city's named points (plazas, portals, ESD, Rangers, ice), the porta-potty
 * banks, and the sun, moon and planets for each night.
 *
 * getlost.fyi compiles these from the Burning Man API (api.burningman.org, playaevents.burningman.org) and camps'
 * own posts; each record keeps its `source`. Places are kept as the real city has them: a clock position in
 * minutes past 12:00 and a distance from the Man in real feet, worked out from the record's latitude and
 * longitude. The game scales distances by brc.ts's CITY_SCALE itself (src/lib/getlost.ts).
 *
 *   node scripts/import-getlost.mjs              fetches https://getlost.fyi/data/
 *   node scripts/import-getlost.mjs --from DIR   reads the same files from DIR
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";

const BASE = "https://getlost.fyi/data/";
const FILES = ["version.json", "city.geojson", "events.json", "lineups.json", "potty-lines.geojson", "celestial.json"];
const OUT = new URL("../public/data/getlost-2026.json", import.meta.url);

const from = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : null;
async function load(name) {
  if (from) return JSON.parse(await readFile(`${from}/${name}`, "utf8"));
  const res = await fetch(BASE + name);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);
  return res.json();
}
const [version, city, records, lineups, potties, sky] = await Promise.all(FILES.map(load));

/* The Man, from the city file's own "The Man" point, and the bearing of 12:00 (the city's axis, 45° east of north). */
const man = city.features.find((f) => f.properties.NAME === "The Man").geometry.coordinates;
const AXIS = 45;
const FT_PER_DEG_LAT = 364_000, FT_PER_DEG_LNG = FT_PER_DEG_LAT * Math.cos((man[1] * Math.PI) / 180);
/** [lng, lat] → { clock: minutes past 12:00, ft: real feet from the Man }, both rounded. */
function place([lng, lat]) {
  const east = (lng - man[0]) * FT_PER_DEG_LNG, north = (lat - man[1]) * FT_PER_DEG_LAT;
  const bearing = (Math.atan2(east, north) * 180) / Math.PI;
  return { clock: Math.round(((((bearing - AXIS) * 2) % 720) + 720) % 720 * 10) / 10, ft: Math.round(Math.hypot(east, north)) };
}

const trim = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || undefined);
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)));
const KIND = { camp: "camp", art: "art", mv: "mutant", svc: "service" };

const listings = records.filter((r) => r.type === "listing");
const places = listings.map((r) => clean({
  uid: r.uid, kind: KIND[r.brc_type] ?? r.brc_type, name: r.name, address: r.address,
  ...(r.brc_type === "mv" && !r.based_at ? {} : place([r.lng, r.lat])),
  approx: r.approx || undefined, roams: r.brc_type === "mv" || undefined,
  artist: r.brc_type === "art" || r.brc_type === "mv" ? r.venue : undefined,
  form: r.formLabel, icon: r.icon, topics: r.topics, hometown: r.hometown, country: r.country,
  open: r.confidence === "hours" && !(r.hour === 6 && r.endHour === 30) ? [r.hour, r.endHour] : undefined,
  url: r.url, image: r.image, desc: trim(r.desc, 400), source: r.source,
}));

/* Events: hosted at a camp (by its name, as getlost.fyi keys them) or out at an art piece. `day` is the date, hours are 0-30. */
const byName = new Map(listings.map((r) => [r.name.toLowerCase(), r.uid]));
const events = records.filter((r) => r.type === "event").map((r) => clean({
  uid: r.uid, name: r.name, at: byName.get((r.venue || "").toLowerCase()), venue: r.venue, address: r.address,
  ...place([r.lng, r.lat]), day: r.date, from: r.hour, to: r.endHour, cat: r.category, tags: r.tags, desc: trim(r.desc, 240),
}));

/* The city's named points (plazas, portals, promenades, services, the fence's corners) and the potty banks. */
const points = city.features.filter((f) => f.geometry.type === "Point").map((f) => ({ name: f.properties.NAME, ...place(f.geometry.coordinates) }));
const potties2 = potties.features.map((f) => ({ clock: f.properties.clock, block: f.properties.block, line: f.geometry.coordinates.map(place) }));

const out = {
  _meta: {
    from: "https://getlost.fyi/", imported: new Date().toISOString().slice(0, 10), built: version.built, year: version.dataYear,
    dates: [version.firstDate, version.lastDate],
    note: "Places are real: clock in minutes past 12:00, ft in real feet from the Man (the game multiplies by CITY_SCALE). Compiled by getlost.fyi from the Burning Man API and camps' own posts; each place keeps its source.",
  },
  places, events, lineups: lineups.camps, points, potties: potties2, sky: sky.days,
};
await mkdir(new URL(".", OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out));

/*
 * What the game needs up front, bundled (src/lib/camps2026.ts): every camp's name, address and place, for the signs in the blocks;
 * and sixteen rides to real events for the pager, spread across the week, at camps with an address, parties, food, coffee,
 * workshops and art, named as the camp posted them.
 */
const camps = places.filter((p) => p.kind === "camp" && p.clock != null).map((p) => clean({ uid: p.uid, name: p.name, address: p.address, clock: p.clock, ft: p.ft, topics: p.topics }));
const campIds = new Set(camps.map((c) => c.uid));
const pick = [], seenAt = new Set();
for (const e of events.filter((e) => e.at && campIds.has(e.at) && ["prty", "food", "coffee", "work", "arts", "bar"].includes(e.cat) && e.name.length <= 40 && e.to - e.from <= 4 && !/naked|nude|topless|clothing.optional|sex|orgy|poop|police/i.test(e.name)).sort((a, b) => (a.uid < b.uid ? -1 : 1))) {
  if (seenAt.has(e.at) || pick.length >= 16) continue;
  if (pick.filter((x) => x.cat === e.cat).length >= 3) continue;
  seenAt.add(e.at); pick.push(e);
}
const rides = pick.map((e) => ({ uid: e.uid, name: e.name, at: e.at, day: e.day, from: e.from, to: e.to, cat: e.cat }));
const CAMPS_TS = new URL("../src/lib/camps2026.ts", import.meta.url);
await writeFile(CAMPS_TS, `/**
 * Black Rock City 2026's camps and a few dozen of its events, for the playa game: written by scripts/import-getlost.mjs from
 * getlost.fyi (built ${version.built.slice(0, 10)}), which compiles them from the Burning Man API. Do not edit by hand: run the import.
 * \`clock\` is minutes past 12:00 and \`ft\` real feet from the Man (getlost.ts places them on the game's streets).
 */
export type Camp2026 = { uid: string; name: string; address?: string; clock: number; ft: number; topics?: string[] };
export type EventRide = { uid: string; name: string; at: string; day: string; from: number; to: number; cat: string };
export const CAMPS_2026: readonly Camp2026[] = ${JSON.stringify(camps)};
export const EVENT_RIDES: readonly EventRide[] = ${JSON.stringify(rides)};
`);
const n = (k) => places.filter((p) => p.kind === k).length;
console.log(`${camps.length} camps and ${rides.length} event rides bundled; ${places.length} places (${n("camp")} camps, ${n("art")} art, ${n("mutant")} mutant vehicles, ${n("service")} services), ${events.length} events (${events.filter((e) => e.at).length} at a known place), ${out.lineups.length} lineups, ${points.length} points, ${potties2.length} potty banks → ${OUT.pathname}`);
