// node --experimental-strip-types --test lib/games/playaSound.test.mjs
// The playa game's sound mix (playaSound.ts): distance → volume, the nearest camp, the crossfade.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loudness, nearest, stepMix, gate, HEAR_R, FULL_R, FADE, MAX_VOICES, FLOOR, TAKEOVER, newSticky, stepSticky, stopSticky } from "./playaSound.ts";

test("sticky: approach a camp and it plays; ride off and it keeps playing at the floor; approach another and it takes over; mute silences", () => {
  const s = newSticky();
  assert.equal(stepSticky(s, null), null, "silence before any camp");
  const far = stepSticky(s, { key: "a", d: HEAR_R - 50 });
  const close = stepSticky(s, { key: "a", d: FULL_R + 40 });
  assert.equal(far.key, "a");
  assert.ok(far.vol < close.vol, "louder as you close in");
  assert.equal(s.key, "a", "close enough: A is the one playing");
  // ride away: A keeps playing, at the floor, however far
  assert.deepEqual(stepSticky(s, null), { key: "a", vol: FLOOR });
  assert.deepEqual(stepSticky(s, { key: "a", d: HEAR_R - 10 }), { key: "a", vol: FLOOR }, "never below the floor once it plays");
  // B at the edge of earshot is too faint to take over
  assert.deepEqual(stepSticky(s, { key: "b", d: HEAR_R - 5 }), { key: "a", vol: FLOOR });
  // closer to B: it takes over (the mix crossfades), then keeps playing after
  const v = stepSticky(s, { key: "b", d: 200 });
  assert.equal(v.key, "b");
  assert.ok(v.vol >= TAKEOVER);
  stepSticky(s, { key: "b", d: 50 });
  assert.equal(s.key, "b");
  assert.deepEqual(stepSticky(s, null), { key: "b", vol: FLOOR });
  // muted or paused: silent, but not forgotten
  assert.equal(stepSticky(s, null, true), null);
  assert.deepEqual(stepSticky(s, null), { key: "b", vol: FLOOR });
  // stopped: silent, and B stays quiet while you are still beside it
  stopSticky(s, "b");
  assert.equal(stepSticky(s, { key: "b", d: 20 }), null);
  assert.equal(stepSticky(s, null), null);
  assert.equal(stepSticky(s, { key: "b", d: 20 }).key, "b", "back in earshot after leaving: it plays again");
});

test("sticky through the mix: the old camp fades out as the new one comes up", () => {
  const s = newSticky();
  let v = [];
  for (let i = 0; i < 30; i++) v = stepMix(v, stepSticky(s, { key: "a", d: 40 }), 0.1);
  for (let i = 0; i < 30; i++) v = stepMix(v, stepSticky(s, null), 0.1);
  assert.deepEqual(v, [{ key: "a", vol: FLOOR }]);
  v = stepMix(v, stepSticky(s, { key: "b", d: 40 }), 0.1);
  assert.equal(v.length, 2, "both, mid-crossfade");
  for (let i = 0; i < 30; i++) v = stepMix(v, stepSticky(s, { key: "b", d: 40 }), 0.1);
  assert.deepEqual(v, [{ key: "b", vol: 100 }]);
});

test("loudness: silent at the edge of earshot, full at the bay, rising as you close in", () => {
  assert.equal(loudness(HEAR_R), 0);
  assert.equal(loudness(HEAR_R + 500), 0);
  assert.equal(loudness(FULL_R), 100);
  assert.equal(loudness(0), 100);
  assert.equal(loudness(NaN), 0);
  let prev = -1;
  for (let d = HEAR_R; d >= 0; d -= 10) { const v = loudness(d); assert.ok(v >= prev, `louder closer (${d})`); assert.ok(v >= 0 && v <= 100); prev = v; }
  assert.ok(loudness((HEAR_R + FULL_R) / 2) < 50, "eased: quiet until you are close");
});

test("nearest: the closest source in earshot, or none", () => {
  const s = [{ key: "a", x: 0, y: 0 }, { key: "b", x: 300, y: 0 }];
  assert.deepEqual(nearest({ x: 200, y: 0 }, s), { key: "b", d: 100 });
  assert.equal(nearest({ x: 0, y: 0 }, s).key, "a");
  assert.equal(nearest({ x: 5000, y: 0 }, s), null);
  assert.equal(nearest({ x: 0, y: 0 }, []), null);
});

test("the mix fades in, crossfades to the new nearest, and fades out to nothing", () => {
  const dt = 0.1;
  let v = [];
  v = stepMix(v, { key: "a", vol: 80 }, dt);
  assert.deepEqual(v, [{ key: "a", vol: FADE * dt }], "fading in, not jumping");
  for (let i = 0; i < 20; i++) v = stepMix(v, { key: "a", vol: 80 }, dt);
  assert.deepEqual(v, [{ key: "a", vol: 80 }]);
  // a new camp is nearer: a goes down while b comes up
  v = stepMix(v, { key: "b", vol: 60 }, dt);
  assert.equal(v.length, 2);
  assert.ok(v.find((x) => x.key === "a").vol < 80 && v.find((x) => x.key === "b").vol > 0);
  for (let i = 0; i < 20; i++) v = stepMix(v, { key: "b", vol: 60 }, dt);
  assert.deepEqual(v, [{ key: "b", vol: 60 }], "a is gone once silent");
  // never more than two at once, keeping the target
  v = stepMix([{ key: "x", vol: 50 }, { key: "y", vol: 20 }], { key: "z", vol: 90 }, dt);
  assert.ok(v.length <= MAX_VOICES && v.some((x) => x.key === "z") && v.some((x) => x.key === "x"));
  // nothing to hear: everything fades away
  for (let i = 0; i < 20; i++) v = stepMix(v, null, dt);
  assert.deepEqual(v, []);
  assert.deepEqual(stepMix([{ key: "a", vol: 10 }], null, NaN), [{ key: "a", vol: 10 }], "a bad dt changes nothing");
});

test("the iOS gate switches with a little hysteresis", () => {
  assert.equal(gate(30, false), false);
  assert.equal(gate(50, false), true);
  assert.equal(gate(30, true), true);
  assert.equal(gate(20, true), false);
});
