/**
 * GTA:BRC's players speak two embeds (asked 2026-10-22): SoundCloud's widget for sets, and
 * YouTube's player for a video of a set or a piece on the playa, shown where the SoundCloud
 * player would sit. Both are driven over postMessage; this file turns a link into the embed's
 * address, a command into the message that embed understands, and the embed's messages back
 * into "ready", "play", "pause" and "finish". No DOM, no imports beyond the two embeds' helpers.
 */
import { scPlayer } from "./agave.ts";
import { SC_WIDGET_ORIGIN, scWidgetCommand, scWidgetEvent } from "./soundcloud.ts";

export const YT_ORIGIN = "https://www.youtube.com";
const YT_ID = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/i;

/** A YouTube link's video id, or null for anything else. */
export const ytId = (url: string): string | null => YT_ID.exec(url)?.[1] ?? null;
/** A video's thumbnail, for the cover drawn over it while it is paused. */
export const ytThumb = (url: string) => { const id = ytId(url); return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : ""; };
/** Whether a link plays as a video (YouTube) rather than a SoundCloud set. */
export const isVideo = (url: string) => ytId(url) !== null;

/** The embed's address: YouTube's player with its API on, or SoundCloud's widget. */
export function playerSrc(url: string, autoPlay: boolean, visual = true, muted = false): string {
  const id = ytId(url);
  // a clip shown in passing: silent, looping, starting by itself (muted video may autoplay anywhere, iPhones too)
  if (id && muted) return `${YT_ORIGIN}/embed/${id}?enablejsapi=1&autoplay=1&mute=1&loop=1&playlist=${id}&controls=0&rel=0&fs=0&disablekb=1&iv_load_policy=3&playsinline=1&modestbranding=1`;
  // YouTube's own chrome off (no controls, keyboard, full screen or cards): the game draws its own tap layer and cover over it
  if (id) return `${YT_ORIGIN}/embed/${id}?enablejsapi=1&autoplay=${autoPlay ? 1 : 0}&controls=0&rel=0&fs=0&disablekb=1&iv_load_policy=3&playsinline=1&modestbranding=1`;
  return scPlayer(url, autoPlay, visual);
}

export type MediaMethod = "play" | "pause" | "setVolume" | "addEventListener";
/** The message for a command, and the origin to send it to; null where the embed has no such command. */
export function mediaCommand(url: string, method: MediaMethod, value?: string | number): { msg: string; origin: string } | null {
  if (isVideo(url)) {
    if (method === "addEventListener") return null; // YouTube reports state once told someone is listening (ytListening)
    const func = method === "play" ? "playVideo" : method === "pause" ? "pauseVideo" : "setVolume";
    return { msg: JSON.stringify({ event: "command", func, args: method === "setVolume" ? [Number(value)] : [] }), origin: YT_ORIGIN };
  }
  return { msg: scWidgetCommand(method, value), origin: SC_WIDGET_ORIGIN };
}

/** YouTube's player only posts its state after the page says it is listening. */
export const ytListening = () => JSON.stringify({ event: "listening", id: 1, channel: "widget" });

/** A message from either embed → "ready", "play", "pause", "finish", "error" (a video that can't be played here:
 * 101 and 150 are an uploader who turned embedding off), or null. */
export function mediaEvent(origin: string, data: unknown): string | null {
  if (origin === YT_ORIGIN) {
    let d: any = data;
    if (typeof d === "string") { try { d = JSON.parse(d); } catch { return null; } }
    if (!d || typeof d !== "object") return null;
    if (d.event === "onReady") return "ready";
    if (d.event === "onError") return "error";
    const st = d.event === "onStateChange" ? d.info : d.event === "infoDelivery" ? d.info?.playerState : undefined;
    return st === 1 ? "play" : st === 2 ? "pause" : st === 0 ? "finish" : null;
  }
  return scWidgetEvent(origin, data);
}
