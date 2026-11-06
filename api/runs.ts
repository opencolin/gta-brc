/**
 * The daily leaderboard (asked 2026-11-05): POST a run, `{ job, secs, name, trace }` (src/lib/scores.ts), checked
 * against the leg's pickup and drop (src/lib/legs.ts) and kept if it is the name's best today; GET today's top
 * three of every job that has a run, cached 15 s at the edge. A board a day, reset at midnight Pacific, gone 48 h on.
 */
import { LEGS } from "../src/lib/legs.js";
import { dayKey, runProblem, type Run } from "../src/lib/scores.js";
import { allowed, body, json, readOnly, redis } from "./_lib/store.js";

const TTL = 48 * 3600;
const board = (day: string, job: string) => `lb:${day}:${job}`;

export async function GET() {
  const day = dayKey(Date.now());
  const jobs = await redis.smembers(`lb:${day}:jobs`);
  const p = redis.pipeline();
  for (const j of jobs) p.zrange(board(day, j), 0, 2, { withScores: true });
  const tops = jobs.length ? ((await p.exec()) as (string | number)[][]) : [];
  const out: Record<string, { name: string; secs: number }[]> = {};
  jobs.forEach((j, i) => {
    const row = tops[i] ?? [], top: { name: string; secs: number }[] = [];
    for (let k = 0; k + 1 < row.length; k += 2) top.push({ name: String(row[k]), secs: Number(row[k + 1]) });
    out[j] = top;
  });
  return json({ day, jobs: out }, 200, "public, s-maxage=15, stale-while-revalidate=60");
}

export async function POST(req: Request) {
  if (readOnly()) return json({ error: "read only" }, 503);
  if (!(await allowed(req, "runs", 10))) return json({ error: "slow down" }, 429);
  const run = (await body(req)) as Run;
  const why = runProblem(run, run && typeof run === "object" ? LEGS[run.job] : null);
  if (why) return json({ error: why }, 400);
  const day = dayKey(Date.now()), key = board(day, run.job), secs = Math.round(run.secs * 10) / 10;
  const p = redis.pipeline();
  p.zadd(key, { lt: true }, { score: secs, member: run.name });
  p.expire(key, TTL);
  p.sadd(`lb:${day}:jobs`, run.job);
  p.expire(`lb:${day}:jobs`, TTL);
  p.zscore(key, run.name);
  p.zrank(key, run.name);
  p.zcard(key);
  const r = await p.exec();
  const [best, rank, of] = r.slice(-3) as [number | null, number | null, number];
  return json({ day, secs, best: Number(best ?? secs), rank: (rank ?? 0) + 1, of });
}
