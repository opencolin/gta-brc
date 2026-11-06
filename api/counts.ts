/**
 * Everyone's counters (asked 2026-11-05): GET the totals, cached 10 s at the edge; POST a batch of what one
 * player did since the last one, `{ moop?, angel?, bell?, bump? }`, each a whole number up to COUNT_MAX.
 */
import { COUNT_KINDS, cleanCounts } from "../src/lib/scores.js";
import { allowed, body, json, readOnly, redis } from "./_lib/store.js";

const KEY = "counts";

export async function GET() {
  const h = (await redis.hgetall<Record<string, number>>(KEY)) ?? {};
  return json(Object.fromEntries(COUNT_KINDS.map((k) => [k, Number(h[k] ?? 0)])), 200, "public, s-maxage=10, stale-while-revalidate=60");
}

export async function POST(req: Request) {
  if (readOnly()) return json({ error: "read only" }, 503);
  if (!(await allowed(req, "counts", 30))) return json({ error: "slow down" }, 429);
  const add = cleanCounts(await body(req, 2_000));
  if (!add) return json({ error: "bad counts" }, 400);
  const p = redis.pipeline();
  for (const [k, v] of Object.entries(add)) p.hincrby(KEY, k, v);
  await p.exec();
  return json({ ok: true });
}
