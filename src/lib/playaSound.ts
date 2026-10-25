/**
 * The playa game's sound, the pure half: as you ride toward a sound camp (or an art car) its
 * SoundCloud fades in, loudest at its parking bay, keeps playing at a comfortable floor after
 * you ride away, and crossfades when you get close enough to another (stepSticky). PlayaWin.tsx turns the mix into hidden SoundCloud widgets (play, pause,
 * setVolume); here is only distance → volume, which source is nearest, and the fades, so
 * playaSound.test.mjs checks them without a browser.
 */

export type Source = { key: string; x: number; y: number };
/** Heard from this far (feet), full volume this close. */
export const HEAR_R = 600;
export const FULL_R = 70;

/** How loud a camp is from a distance, 0 to 100: silent at the edge, eased up to full at the bay. */
export function loudness(d: number): number {
  if (!Number.isFinite(d) || d >= HEAR_R) return 0;
  if (d <= FULL_R) return 100;
  const f = 1 - (d - FULL_R) / (HEAR_R - FULL_R);
  return Math.round(100 * f * f);
}

/** The nearest source in earshot, and how far it is; null when none is. */
export function nearest(p: { x: number; y: number }, sources: readonly Source[]): { key: string; d: number } | null {
  let best: { key: string; d: number } | null = null;
  for (const s of sources) {
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < HEAR_R && (!best || d < best.d)) best = { key: s.key, d };
  }
  return best;
}

export type Voice = { key: string; vol: number };
/** Volume per second a voice moves toward its target: a crossfade takes about a second. */
export const FADE = 110;
export const MAX_VOICES = 2;

/**
 * One step of the mix: the target voice moves toward its volume, every other voice fades to
 * silence and is dropped when it gets there; at most two voices (the one fading in, the one
 * fading out). A null target fades everything out (paused, muted, out of earshot, or a set
 * picked in the panel playing instead).
 */
export function stepMix(voices: readonly Voice[], target: Voice | null, dt: number): Voice[] {
  const step = FADE * Math.max(0, Number.isFinite(dt) ? dt : 0);
  const toward = (v: number, goal: number) => (v < goal ? Math.min(goal, v + step) : Math.max(goal, v - step));
  let out: Voice[] = voices.map((v) => ({ key: v.key, vol: toward(v.vol, target && v.key === target.key ? target.vol : 0) }));
  if (target && target.vol > 0 && !out.some((v) => v.key === target.key)) out.push({ key: target.key, vol: Math.min(target.vol, step) });
  out = out.filter((v) => v.vol > 0 || (target && v.key === target.key && target.vol > 0));
  if (out.length > MAX_VOICES) {
    // keep the target and the loudest of the rest
    const rest = out.filter((v) => !target || v.key !== target.key).sort((a, b) => b.vol - a.vol);
    const keep = out.filter((v) => target && v.key === target.key);
    out = [...keep, ...rest.slice(0, MAX_VOICES - keep.length)];
  }
  return out;
}

/**
 * iOS Safari ignores the widget's volume, so there a voice is simply on or off, with a gap
 * between the two thresholds so it does not flutter at the edge.
 */
export function gate(vol: number, on: boolean): boolean {
  return on ? vol > 25 : vol > 45;
}

/* ── sticky: the last camp you rode up to keeps playing ─────────────────── */

/** The volume a camp keeps once you have ridden off: comfortable, not loud. */
export const FLOOR = 60;
/** How loud a new camp must get before it takes over from the one playing. */
export const TAKEOVER = 25;

/**
 * What is playing: `key`, the camp that has it (once you got close enough to hear it at the
 * floor), and `hush`, a camp you stopped, which stays quiet until you have left its earshot.
 */
export type Sticky = { key: string | null; hush: string | null; /** the place in earshot waiting its turn, and for how long (s) */ cand: string | null; dwell: number };
export const newSticky = (): Sticky => ({ key: null, hush: null, cand: null, dwell: 0 });
/** A new place in earshot waits this long (seconds) before it plays (asked 2026-10-24: the music changed too suddenly),
 * unless you are parked at it or within CLOSE_R feet of it. */
export const DWELL = 3, CLOSE_R = 110;
/** The place in earshot that is waiting its turn, named in the HUD before it plays. */
export const pendingSticky = (s: Sticky) => (s.cand && s.cand !== s.key ? s.cand : null);

/**
 * One step of the sticky music, choosing the voice the mix should move to (stepMix does the
 * fades). Approaching a camp from silence: it rises with closeness and, once it reaches the
 * floor, it is the one that plays. Riding away: it keeps playing at the floor, however far
 * you go. Another camp takes over (a crossfade) once it is loud enough to hear over it.
 * `quiet` (paused, muted, a set picked in the panel) silences it without forgetting it. `dt` is the step in seconds
 * for the wait, `now` that you are parked at the near place (no wait).
 */
export function stepSticky(s: Sticky, near: { key: string; d: number } | null, quiet = false, dt = 0, now = false): Voice | null {
  if (s.hush && (!near || near.key !== s.hush)) s.hush = null;
  let n = near && near.key !== s.hush ? near : null;
  // a different place than the one playing: it waits DWELL seconds in earshot, unless you are parked at it or right beside it
  if (n && n.key !== s.key) { if (n.key !== s.cand) { s.cand = n.key; s.dwell = 0; } s.dwell += dt; } else { s.cand = null; s.dwell = 0; }
  if (n && n.key !== s.key && !now && n.d > CLOSE_R && s.dwell < DWELL) n = null;
  const l = n ? loudness(n.d) : 0;
  let target: Voice | null;
  if (n && n.key === s.key) target = { key: n.key, vol: Math.max(FLOOR, l) };
  else if (n && (!s.key ? l > 0 : l >= TAKEOVER)) {
    target = { key: n.key, vol: l };
    if (l >= FLOOR) s.key = n.key;
  } else target = s.key ? { key: s.key, vol: FLOOR } : null;
  return quiet ? null : target;
}

/** Stop the music: forget the camp, and keep it quiet until you leave its earshot. */
export function stopSticky(s: Sticky, playing: string | null) {
  s.hush = playing ?? s.key;
  s.key = null;
}
