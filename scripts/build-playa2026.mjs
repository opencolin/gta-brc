/**
 * The 2026 art and mutant vehicles the game does not have yet (asked 2026-11-04, from Burning Man's 2026 camp, art and mutant-vehicle
 * listings; getlost.fyi's import of the Burning Man API carries the same pieces and cars, with the art's placements): reads
 * public/data/getlost-2026.json (scripts/import-getlost.mjs) and writes src/lib/playa2026.ts, leaving out what soundcamps.ts already has
 * (by name, loosely: "The Nudibranch" is the Nudibranch) and any piece within 60 real feet of one of the game's own.
 *
 *   node scripts/build-playa2026.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const { SOUND_CAMPS } = await import(new URL("../src/lib/soundcamps.ts", import.meta.url));
const d = JSON.parse(await readFile(new URL("../public/data/getlost-2026.json", import.meta.url), "utf8"));

const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g, "").replace(/\b(the|art car|artcar|mutant vehicle)\b/g, "").replace(/ /g, "");
const same = (a, b) => a === b || (Math.min(a.length, b.length) >= 6 && (a.startsWith(b) || b.startsWith(a)));
const ours = (kinds) => SOUND_CAMPS.filter(kinds).map((c) => norm(c.name));
const haveArt = ours((c) => c.kind === "art" || c.piece), haveCars = ours((c) => c.kind === "mutant");
// the game's own pieces stand at their published clock and feet: a 2026 piece in the same spot is the same piece
const clockMin = (s) => { const [h, m] = s.split(":").map(Number); return ((h % 12) * 60 + m); };
const spots = SOUND_CAMPS.filter((c) => c.playa).map((c) => ({ min: clockMin(c.playa.clock), ft: c.playa.ft }));
const near = (p) => spots.some((s) => { const a = ((p.clock - s.min) / 720) * Math.PI * 2; return Math.sqrt(p.ft ** 2 + s.ft ** 2 - 2 * p.ft * s.ft * Math.cos(a)) < 60; });

const art = d.places.filter((p) => p.kind === "art" && p.clock != null && p.ft != null && !haveArt.some((h) => same(norm(p.name), h)) && !near(p))
  .map((p) => ({ uid: p.uid, name: p.name.trim(), artist: p.artist?.trim(), clock: Math.round(p.clock * 10) / 10, ft: Math.round(p.ft) }));
const ICON = { mvAir: "air", mvWing: "wing", mvPlant: "plant", mvCar: "car", mvObject: "object", mvLand: "land", mvBldg: "building", mvMyth: "myth", mvShip: "ship", mvTrain: "train", mvBus: "bus", mvStars: "car", mvArt: "object", mvRobot: "robot" };
const cars = d.places.filter((p) => p.kind === "mutant" && !haveCars.some((h) => same(norm(p.name), h)))
  .map((p) => ({ uid: p.uid, name: p.name.trim(), form: ICON[p.icon] ?? "car" }));

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));
await writeFile(new URL("../src/lib/playa2026.ts", import.meta.url), `/**
 * Black Rock City 2026's art and mutant vehicles that soundcamps.ts does not already have (asked 2026-11-04): written by
 * scripts/build-playa2026.mjs from public/data/getlost-2026.json (getlost.fyi's import of the Burning Man API). Do not edit by hand.
 * A piece's \`clock\` is minutes past 12:00 and \`ft\` real feet from the Man (getlost.ts's toGame places it); a car roams, with no place.
 */
export type Art2026 = { uid: string; name: string; artist?: string; clock: number; ft: number };
export type CarForm = "air" | "wing" | "plant" | "car" | "object" | "land" | "building" | "myth" | "ship" | "train" | "bus" | "robot";
export type Car2026 = { uid: string; name: string; form: CarForm };
export const ART_2026: readonly Art2026[] = ${JSON.stringify(art.map(clean))};
export const CARS_2026: readonly Car2026[] = ${JSON.stringify(cars)};
`);
console.log(`${art.length} pieces and ${cars.length} cars written to src/lib/playa2026.ts`);
