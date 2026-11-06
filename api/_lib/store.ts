/**
 * The store behind the counters and the leaderboard (asked 2026-11-05): Upstash Redis from the Vercel Marketplace
 * (gta-brc-kv, its KV_REST_API_URL and KV_REST_API_TOKEN set on the project), a rate limit per caller, and a
 * kill switch: SCORES_READONLY=1 on the project turns every write away and the reads go on.
 */
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export const redis = Redis.fromEnv();
export const readOnly = () => process.env.SCORES_READONLY === "1";

const limits = new Map<string, Ratelimit>();
/** At most `n` calls a minute from one address to one route; false when this one is over. */
export async function allowed(req: Request, route: string, n: number): Promise<boolean> {
  let rl = limits.get(route);
  if (!rl) limits.set(route, (rl = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(n, "60 s"), prefix: `rl:${route}` })));
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return (await rl.limit(ip)).success;
}

export const json = (body: unknown, status = 200, cache = "no-store") =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": cache } });

/** The body as JSON, or null if it is not JSON or is over `max` bytes. */
export async function body(req: Request, max = 32_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > max) return null;
  try { return JSON.parse(text); } catch { return null; }
}
