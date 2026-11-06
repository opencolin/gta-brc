/**
 * The game's side of the counters and the leaderboard (asked 2026-11-05, from Collin): counts what you do and
 * sends it every 30 s, records a ride job's leg from the pickup to the drop and sends the run when it is
 * delivered, and fetches the totals and today's board for the pause card. Every call is fire-and-forget with a
 * timeout: when the API is not there (vite dev, an outage) the game plays on and the card shows "—".
 */
import { JOBS, place, type Job } from "@/lib/playa";
import { NAME_WORDS, jobId, randomName, runProblem, type CountKind, type Counts, type Run, type TracePt } from "@/lib/scores";

const NAME_KEY = "gta-brc-name";
const FLUSH_S = 30;

/** Your name on the board: kept in this browser, made up the first time. */
export function myName(): string {
  try {
    const n = localStorage.getItem(NAME_KEY);
    if (n && NAME_WORDS.adj.includes(n.split(" ")[0]) && NAME_WORDS.noun.includes(n.split(" ")[1])) return n;
    const fresh = randomName();
    localStorage.setItem(NAME_KEY, fresh);
    return fresh;
  } catch { return randomName(); }
}
export function newName(): string {
  const n = randomName();
  try { localStorage.setItem(NAME_KEY, n); } catch {}
  return n;
}

async function call<T>(path: string, init?: RequestInit, ms = 5000): Promise<T | null> {
  try {
    const r = await fetch(path, { ...init, signal: AbortSignal.timeout(ms) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}
const post = <T>(path: string, body: unknown) => call<T>(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/* counters */

let pending: Partial<Counts> = {};
let sinceFlush = 0;
export function count(kind: CountKind) { pending[kind] = (pending[kind] ?? 0) + 1; }
function flush(beacon = false) {
  const batch: Partial<Counts> = {};
  for (const [k, v] of Object.entries(pending) as [CountKind, number][]) batch[k] = Math.min(v, 60);
  pending = {}; sinceFlush = 0;
  if (!Object.keys(batch).length) return;
  if (beacon && navigator.sendBeacon) navigator.sendBeacon("/api/counts", JSON.stringify(batch));
  else void post("/api/counts", batch);
}
if (typeof window !== "undefined") window.addEventListener("pagehide", () => flush(true));

/* runs */

type Rec = { job: Job; t0: number; trace: TracePt[] };
let rec: Rec | null = null;
const rnd = (v: number) => Math.round(v) + 0;
export type RunResult = { secs: number; best: number; rank: number; of: number };

/** Called each frame with the game's clock (seconds) and where you are. */
export function tick(dt: number, t: number, at: { x: number; y: number }) {
  sinceFlush += dt;
  if (sinceFlush >= FLUSH_S) flush();
  if (!rec) return;
  const s = t - rec.t0, last = rec.trace[rec.trace.length - 1];
  if (s - last[0] >= 1) rec.trace.push([Math.round(s * 100) / 100, rnd(at.x), rnd(at.y)]);
  if (rec.trace.length > 950 || s > 880) rec = null; // too long to go on the board
}
/** Someone aboard: a ride job's leg begins here. */
export function picked(jobIndex: number, t: number, at: { x: number; y: number }) {
  const job = JOBS[jobIndex % JOBS.length];
  rec = job.kind === "ride" ? { job, t0: t, trace: [[0, rnd(at.x), rnd(at.y)]] } : null;
}
/** The job is over some other way (failed, skipped): nothing to send. */
export function dropRun() { rec = null; }
/** Delivered: the run goes to the board, if it is one the server will keep. */
export async function delivered(t: number, at: { x: number; y: number }): Promise<RunResult | null> {
  const r = rec; rec = null;
  if (!r) return null;
  const secs = Math.round((t - r.t0) * 100) / 100, trace = r.trace;
  const end: TracePt = [secs, rnd(at.x), rnd(at.y)];
  if (secs - trace[trace.length - 1][0] < 0.2 && trace.length > 1) trace[trace.length - 1] = end; else trace.push(end);
  const run: Run = { job: jobId(r.job), secs, name: myName(), trace };
  if (runProblem(run)) return null; // the big map's ghosting or a teleport: not a run the board would take
  return post<RunResult>("/api/runs", run);
}

/* the pause card */

export type BoardRow = { job: string; label: string; top: { name: string; secs: number }[] };
export type Totals = { counts: Counts | null; rows: BoardRow[] | null };
const labelOf = (id: string) => {
  const j = JOBS.find((x) => jobId(x) === id);
  if (!j) return null;
  try { return `${j.who}: ${place(j.from).label.replace(/ \(.*/, "")} to ${place(j.to).label.replace(/ \(.*/, "")}`; } catch { return null; }
};
export async function totals(): Promise<Totals> {
  const [counts, b] = await Promise.all([call<Counts>("/api/counts"), call<{ day: string; jobs: Record<string, { name: string; secs: number }[]> }>("/api/runs")]);
  const rows = b ? Object.entries(b.jobs).flatMap(([job, top]) => { const label = labelOf(job); return label && top.length ? [{ job, label, top }] : []; }).sort((a, b) => a.top[0].secs - b.top[0].secs) : null;
  return { counts, rows };
}
