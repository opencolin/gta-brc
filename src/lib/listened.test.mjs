// node --experimental-strip-types --test src/lib/listened.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { noteProgress, noteDone, resumeAt, nextUnheard, LISTENED_MAX } from "./listened.ts";

const A = "https://soundcloud.com/a/one", B = "https://soundcloud.com/a/two", C = "https://www.youtube.com/watch?v=abcdefghijk";

test("a set picks up where it was left, unless it was barely started or played to the end", () => {
  let l = {};
  assert.equal(resumeAt(l, A), 0, "never heard");
  l = noteProgress(l, A, 5, 1);
  assert.equal(resumeAt(l, A), 0, "barely started: from the top");
  l = noteProgress(l, A, 754, 2);
  assert.equal(resumeAt(l, A), 754, "left at 12:34");
  l = noteDone(l, A, 3);
  assert.equal(resumeAt(l, A), 0, "done: from the top");
  assert.equal(resumeAt(noteProgress({}, A, NaN, 1), A), 0, "nonsense ignored");
});

test("a place starts on the first set not yet done, then the one heard longest ago", () => {
  const urls = [A, B, C];
  let l = {};
  assert.equal(nextUnheard(l, urls), 0);
  l = noteProgress(l, A, 300, 1);
  assert.equal(nextUnheard(l, urls), 0, "left off, not done: still first");
  l = noteDone(l, A, 2);
  assert.equal(nextUnheard(l, urls), 1, "A done: B next");
  l = noteDone(l, B, 3); l = noteDone(l, C, 4);
  assert.equal(nextUnheard(l, urls), 0, "all done: A, heard longest ago");
  l = noteDone(l, A, 5);
  assert.equal(nextUnheard(l, urls), 1, "then B");
  assert.equal(nextUnheard(l, []), 0);
});

test("only so many sets are remembered: the oldest go", () => {
  let l = {};
  for (let i = 0; i < LISTENED_MAX + 20; i++) l = noteProgress(l, `https://soundcloud.com/x/${i}`, 100, i);
  assert.equal(Object.keys(l).length, LISTENED_MAX);
  assert.equal(l["https://soundcloud.com/x/0"], undefined, "the first went");
  assert.ok(l[`https://soundcloud.com/x/${LISTENED_MAX + 19}`], "the latest stays");
});
