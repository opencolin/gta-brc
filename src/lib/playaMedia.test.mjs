// node --experimental-strip-types --test lib/games/playaMedia.test.mjs
// GTA:BRC's two embeds (playaMedia.ts): which link is a video, the embed's address, its commands and its events.
import { test } from "node:test";
import assert from "node:assert/strict";
import { YT_ORIGIN, isVideo, mediaCommand, mediaEvent, playerSrc, ytId } from "./playaMedia.ts";

test("YouTube links are videos, SoundCloud links are not", () => {
  assert.equal(ytId("https://www.youtube.com/watch?v=-fh-bfb97Ys"), "-fh-bfb97Ys");
  assert.equal(ytId("https://youtu.be/_G4DYYB_B4k"), "_G4DYYB_B4k");
  assert.equal(ytId("https://www.youtube.com/watch?v=2J5F6BPofck&t=3432s"), "2J5F6BPofck");
  assert.ok(!isVideo("https://soundcloud.com/titanicsend"));
  const yt = playerSrc("https://www.youtube.com/watch?v=-fh-bfb97Ys", true);
  assert.match(yt, /^https:\/\/www\.youtube\.com\/embed\/-fh-bfb97Ys\?enablejsapi=1&autoplay=1/);
  for (const p of ["controls=0", "rel=0", "fs=0", "disablekb=1", "iv_load_policy=3", "playsinline=1"]) assert.ok(yt.includes(p), p);
  assert.match(playerSrc("https://soundcloud.com/titanicsend", false), /^https:\/\/w\.soundcloud\.com\/player\//);
});

test("commands go to the right embed in its own words", () => {
  const v = mediaCommand("https://www.youtube.com/watch?v=-fh-bfb97Ys", "setVolume", 40);
  assert.equal(v.origin, YT_ORIGIN);
  assert.deepEqual(JSON.parse(v.msg), { event: "command", func: "setVolume", args: [40] });
  assert.equal(JSON.parse(mediaCommand("https://youtu.be/_G4DYYB_B4k", "play").msg).func, "playVideo");
  assert.equal(mediaCommand("https://youtu.be/_G4DYYB_B4k", "addEventListener", "play"), null);
  assert.equal(mediaCommand("https://soundcloud.com/titanicsend", "pause").origin, "https://w.soundcloud.com");
});

test("YouTube's messages read as ready, play, pause and finish; strangers are ignored", () => {
  assert.equal(mediaEvent(YT_ORIGIN, JSON.stringify({ event: "onReady" })), "ready");
  assert.equal(mediaEvent(YT_ORIGIN, JSON.stringify({ event: "onStateChange", info: 1 })), "play");
  assert.equal(mediaEvent(YT_ORIGIN, JSON.stringify({ event: "infoDelivery", info: { playerState: 2 } })), "pause");
  assert.equal(mediaEvent(YT_ORIGIN, JSON.stringify({ event: "onStateChange", info: 0 })), "finish");
  assert.equal(mediaEvent(YT_ORIGIN, JSON.stringify({ event: "onError", info: 150 })), "error", "embedding turned off: skip it");
  assert.equal(mediaEvent("https://evil.example", JSON.stringify({ event: "onReady" })), null);
});
