/**
 * Shared counters and the daily leaderboard (asked 2026-11-05, from Collin; PLAN-EXTRAS.md section 5): what the
 * client sends to `api/` and what the server checks before it keeps it. No imports, so the functions in `api/`
 * can use it as it is (they import it as `../src/lib/scores.js`); scores.test.mjs checks it.
 *
 * - Counters: MOOP picked up, dust angels made, the Greeters' bell rung and bumps, by everyone, for ever.
 * - The leaderboard: the fastest run of each ride job's leg, from the pickup to the drop (the leg is the same for
 *   everyone; the run to the pickup depends on where you were), a board a day, reset at midnight Pacific.
 *   A run carries its trace, where you were each second, and the server turns away one that is impossible:
 *   faster than any ride goes, not starting at the pickup or not ending at the drop.
 * - Names: an adjective and a noun from the lists below, nothing typed, so there is nothing to moderate.
 */

export type Pt = { x: number; y: number };
/** A run's trace: [seconds since the pickup, x, y], about one a second, x and y in feet rounded. */
export type TracePt = [number, number, number];
export type Run = { job: string; secs: number; name: string; trace: TracePt[] };

export const COUNT_KINDS = ["moop", "angel", "bell", "bump"] as const;
export type CountKind = (typeof COUNT_KINDS)[number];
export type Counts = Record<CountKind, number>;
/** The most of one kind a single batch may carry (the client sends one every 30 s). */
export const COUNT_MAX = 60;

/** Faster than any ride the game has goes on the ground (the e-bike and the art cars top out at 350 ft/s), with room for a bump's shove. */
export const SPEED_CAP = 520;
/** How far from the pickup a run's first point and from the drop its last may be, feet (the stop is 75 ft, an art car's is wider). */
export const END_R = 260;
export const RUN_MIN = 3, RUN_MAX = 900, TRACE_MAX = 1000;
export const NAME_RE = /^[a-z]{2,10} [a-z]{2,10}$/;

const ADJ = ["dusty", "glowing", "sparkly", "fuzzy", "radiant", "playa", "cosmic", "furry", "lunar", "solar", "neon", "golden", "velvet", "wild", "gentle", "sunrise", "midnight", "electric", "feral", "lucky", "mellow", "giddy", "salty", "shiny"];
const NOUN = ["burner", "ranger", "coyote", "lizard", "goose", "whale", "unicorn", "dragon", "llama", "owl", "moth", "cactus", "comet", "cruiser", "nomad", "pilgrim", "dancer", "fairy", "pirate", "wizard", "otter", "yeti", "mermaid", "camel"];
export const NAME_WORDS = { adj: ADJ, noun: NOUN } as const;

/** A name for a player: one of the adjectives and one of the nouns. */
export const randomName = (rand: () => number = Math.random) =>
  `${ADJ[Math.floor(rand() * ADJ.length) % ADJ.length]} ${NOUN[Math.floor(rand() * NOUN.length) % NOUN.length]}`;
export const nameOk = (name: unknown): name is string => {
  if (typeof name !== "string" || !NAME_RE.test(name)) return false;
  const [a, n] = name.split(" ");
  return ADJ.includes(a) && NOUN.includes(n);
};

/** A job's id on the board, the same for everyone whatever its place in the list: "ride:<from>><to>". */
export const jobId = (j: { kind: string; from: string; to: string }) => `${j.kind}:${j.from}>${j.to}`.replace(/[^\w:&>.\- ]/g, "").slice(0, 120);
export const jobIdOk = (id: unknown): id is string => typeof id === "string" && id.length <= 120 && /^ride:[\w:&.\- ]+>[\w:&.\- ]+$/.test(id);

/** The board's day: the date in Pacific time ("2026-11-05"), so it turns over at midnight on the playa. */
export const dayKey = (ms: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(ms);

/** A counts batch from the client, kept to whole numbers between 0 and COUNT_MAX of the known kinds, or null. */
export function cleanCounts(body: unknown): Partial<Counts> | null {
  if (!body || typeof body !== "object") return null;
  const out: Partial<Counts> = {};
  for (const k of COUNT_KINDS) {
    const v = (body as Record<string, unknown>)[k];
    if (v === undefined) continue;
    if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > COUNT_MAX) return null;
    if (v > 0) out[k] = v;
  }
  return Object.keys(out).length ? out : null;
}

const far = (a: Pt, x: number, y: number) => Math.hypot(a.x - x, a.y - y);
/**
 * Why a run cannot be kept, or null when it can. `leg` is where the pickup and the drop are, when they stay put
 * (an art car's moves, and a leg to or from one is checked for speed alone).
 */
export function runProblem(run: unknown, leg?: { from: Pt; to: Pt } | null): string | null {
  if (!run || typeof run !== "object") return "no run";
  const { job, secs, name, trace } = run as Run;
  if (!jobIdOk(job)) return "bad job";
  if (!nameOk(name)) return "bad name";
  if (typeof secs !== "number" || !Number.isFinite(secs) || secs < RUN_MIN || secs > RUN_MAX) return "bad time";
  if (!Array.isArray(trace) || trace.length < 2 || trace.length > TRACE_MAX) return "bad trace";
  for (const p of trace) if (!Array.isArray(p) || p.length !== 3 || !p.every((v) => typeof v === "number" && Number.isFinite(v))) return "bad trace";
  if (trace[0][0] !== 0) return "trace starts late";
  const end = trace[trace.length - 1][0];
  if (Math.abs(end - secs) > 1.5) return "trace and time disagree";
  for (let i = 1; i < trace.length; i++) {
    const [t0, x0, y0] = trace[i - 1], [t1, x1, y1] = trace[i], dt = t1 - t0;
    if (dt < 0.2 || dt > 3) return "trace gaps";
    if (Math.hypot(x1 - x0, y1 - y0) > SPEED_CAP * dt + 20) return "too fast";
  }
  if (leg) {
    if (far(leg.from, trace[0][1], trace[0][2]) > END_R) return "not from the pickup";
    const [, x, y] = trace[trace.length - 1];
    if (far(leg.to, x, y) > END_R) return "not at the drop";
    // the straight line is the shortest the leg can be, and nothing covers it faster than the cap
    if (Math.hypot(leg.to.x - leg.from.x, leg.to.y - leg.from.y) - 2 * END_R > SPEED_CAP * secs) return "too fast";
  }
  return null;
}

/** A time on the board: "42.3 s" or "2:05.1". */
export const fmtSecs = (s: number) => (s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, "0")}`);
