// node --experimental-strip-types --test lib/games/soundcamps.test.mjs
// Black Rock City's sound camps and art cars (soundcamps.ts): the list's shape.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SOUND_CAMPS, PINNED_FIRST, campTracks, soundCamp } from "./soundcamps.ts";
import { parseAddress, parseClock } from "./brc.ts";

test("a couple of hundred entries, the must-haves first, unique names and ids", () => {
  assert.ok(SOUND_CAMPS.length >= 150 && SOUND_CAMPS.length <= 260, `${SOUND_CAMPS.length}`);
  for (const id of ["camp-questionmark", "sacred-spaces", "white-ocean", "celestial-bodies", "root-society", "playa-54", "sian-kamp"]) assert.ok(soundCamp(id), id);
  const first = SOUND_CAMPS.slice(0, 7).map((c) => c.id);
  for (const id of ["robot-heart", "mayan-warrior", "titanics-end", "playalchemist", "the-kazbah", "distrikt", "daft-punk-fence"]) assert.ok(first.includes(id), id);
  assert.equal(new Set(SOUND_CAMPS.map((c) => c.name.toLowerCase())).size, SOUND_CAMPS.length);
  assert.equal(new Set(SOUND_CAMPS.map((c) => c.id)).size, SOUND_CAMPS.length);
  for (const c of SOUND_CAMPS) assert.match(c.id, /^[a-z0-9-]+$/);
  assert.equal(soundCamp("distrikt").name, "DISTRIKT");
});

test("camps have addresses that parse on the grid; art cars and the fence stage have none", () => {
  for (const c of SOUND_CAMPS) {
    assert.ok(["camp", "mutant", "fence", "art"].includes(c.kind), c.name);
    if (c.kind === "art") assert.ok(c.playa && parseClock(c.playa.clock) !== null && c.playa.ft > 0, `${c.name}: a clock and a distance on the open playa`);
    assert.ok(c.blurb.length > 10 && c.blurb.length < 100, `${c.name}: a one-line blurb`);
    if (c.kind === "camp") {
      assert.ok(c.address && parseAddress(c.address), `${c.name}: ${c.address} parses`);
      if (c.approx) assert.equal(c.year, undefined, `${c.name}: a guessed spot has no year`);
      else assert.ok(c.year >= 2012 && c.year <= 2026, `${c.name}: a placement year`);
    } else assert.equal(c.address, undefined, `${c.name} roams or stands off the grid`);
    if (c.approx !== undefined) assert.equal(typeof c.approx, "boolean");
  }
  assert.ok(SOUND_CAMPS.filter((c) => c.kind === "mutant").length >= 3);
});

test("every link is https://soundcloud.com/… or a YouTube video, and each camp has something to play", () => {
  for (const c of SOUND_CAMPS) {
    if (c.piece) { // a big art piece: no link of its own, its videos in artmedia.ts (every one a YouTube video)
      assert.equal(c.soundcloud, "", `${c.name} is a piece`);
      for (const t of campTracks(c)) assert.match(t.url, /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/, `${c.name}: ${t.url}`);
      continue;
    }
    assert.match(c.soundcloud, /^https:\/\/soundcloud\.com\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+){0,2}$|^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/, `${c.name}: ${c.soundcloud}`);
    for (const u of (c.sets ?? []).map((s) => s.url)) assert.match(u, /^https:\/\/soundcloud\.com\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+){0,2}$|^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/, `${c.name}: ${u}`);
    assert.ok(campTracks(c).length >= 1);
  }
});

test("every entry cites where its address or link came from", () => {
  const src = readFileSync(new URL("./soundcamps.ts", import.meta.url), "utf8");
  for (const c of SOUND_CAMPS) {
    const lines = src.split("\n");
    const i = lines.findIndex((l) => l.includes(`id: "${c.id}"`));
    assert.ok(lines.slice(Math.max(0, i - 2), i).some((l) => /^\s*\/\/ .*(SoundCloud|YouTube|Address)/.test(l)), `${c.name} has a source comment`);
  }
});

test("a place with SoundCloud plays it first, its videos after", () => {
  for (const c of SOUND_CAMPS) {
    const t = campTracks(c), firstVideo = t.findIndex((x) => x.url.includes("youtube.com"));
    if (firstVideo > 0) assert.ok(t.slice(firstVideo).every((x) => x.url.includes("youtube.com")), c.name);
    if (t.some((x) => x.url.startsWith("https://soundcloud.com/")) && !PINNED_FIRST[c.id]) assert.ok(t[0].url.startsWith("https://soundcloud.com/"), c.name);
    if (PINNED_FIRST[c.id]) assert.equal(t[0].url, PINNED_FIRST[c.id], `${c.name}'s pinned set leads`);
  }
});

test("clips (VIDEO_CLIPS) come after a place's sets, marked, and a few places have only clips", async () => {
  const { VIDEO_CLIPS, isClip, clipsOnly } = await import("./soundcamps.ts");
  assert.ok(VIDEO_CLIPS.size > 50);
  for (const c of SOUND_CAMPS) {
    const t = campTracks(c), first = t.findIndex((x) => x.clip);
    if (first >= 0) assert.ok(t.slice(first).every((x) => x.clip && isClip(x.url)), c.name);
  }
  const only = SOUND_CAMPS.filter(clipsOnly);
  assert.ok(only.length > 0 && only.length < SOUND_CAMPS.length / 4, `${only.length}`);
});
