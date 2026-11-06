import { json, readOnly, redis } from "./_lib/store.js";

/** Up, and whether the store answers (the ship gate curls this after a deploy). */
export async function GET() {
  try { return json({ ok: (await redis.ping()) === "PONG", readOnly: readOnly() }); }
  catch { return json({ ok: false }, 503); }
}
