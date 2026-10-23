/**
 * What you have heard (asked 2026-10-22): where each set was left off, and which sets are done, so a place
 * starts on a set you have not heard yet and a set you left picks up where it stopped, not at 0:00.
 * Kept per device in localStorage; the pure parts are tested in listened.test.mjs.
 */
export type Heard = { pos: number; done: boolean; at: number };
export type Listened = Record<string, Heard>;
export const LISTENED_KEY = "agentcamp-playa-listened";
/** Under this many seconds in, a set is as good as unheard: it starts over. */
export const RESUME_MIN = 8;
/** How many sets are remembered; the oldest go first. */
export const LISTENED_MAX = 400;

/** Where a set stands now, in seconds. Pure: returns a new record. */
export function noteProgress(l: Listened, url: string, pos: number, now: number): Listened {
  if (!(pos >= 0) || !Number.isFinite(pos)) return l;
  return cap({ ...l, [url]: { pos, done: false, at: now } });
}
/** A set played to its end: next time it starts over, and the place moves on to another. */
export function noteDone(l: Listened, url: string, now: number): Listened {
  return cap({ ...l, [url]: { pos: 0, done: true, at: now } });
}
/** The second to start a set at: where it was left, or 0 for one never heard, done, or barely started. */
export function resumeAt(l: Listened, url: string): number {
  const h = l[url];
  return h && !h.done && h.pos >= RESUME_MIN ? h.pos : 0;
}
/** Which of a place's sets to start on: the first not yet done; when every one is done, the one heard longest ago. */
export function nextUnheard(l: Listened, urls: readonly string[]): number {
  if (!urls.length) return 0;
  const i = urls.findIndex((u) => !l[u]?.done);
  if (i >= 0) return i;
  let best = 0;
  for (let k = 1; k < urls.length; k++) if ((l[urls[k]]?.at ?? 0) < (l[urls[best]]?.at ?? 0)) best = k;
  return best;
}
function cap(l: Listened): Listened {
  const keys = Object.keys(l);
  if (keys.length <= LISTENED_MAX) return l;
  keys.sort((a, b) => l[a].at - l[b].at);
  const out: Listened = {};
  for (const k of keys.slice(keys.length - LISTENED_MAX)) out[k] = l[k];
  return out;
}

export function loadListened(): Listened {
  try {
    const v = JSON.parse(localStorage.getItem(LISTENED_KEY) || "{}");
    return v && typeof v === "object" ? (v as Listened) : {};
  } catch { return {}; }
}
export function saveListened(l: Listened) {
  try { localStorage.setItem(LISTENED_KEY, JSON.stringify(l)); } catch {}
}
