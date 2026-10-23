"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { SETS } from "@/lib/agave";
import { YT_ORIGIN, isVideo, mediaCommand, mediaEvent, mediaProgress, playerSrc, ytListening, ytThumb, type MediaMethod } from "@/lib/playaMedia";
import { loadListened, saveListened, noteProgress, noteDone, resumeAt, nextUnheard } from "@/lib/listened";
import { campTracks, soundCamp } from "@/lib/soundcamps";
import { VEHICLES, VEHICLE_IDS, type VehicleId } from "@/lib/playa";
import { gate, type Voice } from "@/lib/playaSound";

/**
 * GTA:BRC's music (PlayaWin.tsx): the panel that opens when you park at a sound camp (Agave
 * Lounge's sets, or a camp's or art car's SoundCloud) and folds to a "now playing" bar when
 * you drive off, and the hidden widgets that fade a camp in as you ride toward it.
 *
 * Both play SoundCloud's own widget (w.soundcloud.com) or, for a video, YouTube's player, each
 * driven over postMessage (lib/games/playaMedia.ts): the panel's is the visible player you press play on; the ambient
 * ones load with auto_play off and are told play, pause and setVolume as the mix
 * (lib/games/playaSound.ts) moves. The panel sits outside the game's keyboard board, so its
 * arrow keys move between sets and never steer.
 */

export type Track = { url: string; title: string; clip?: boolean };
/** What the panel's player holds: the place it came from, the set, and whether it is playing. */
export type Now = { key: string; url: string; title: string; auto: boolean; playing: boolean };

/** The name, line and sets for a place key: "agave", "camp:<id>", "mutant:<id>". */
export function soundOf(key: string): { name: string; blurb: string; tracks: Track[] } {
  if (key === "agave") {
    return { name: "Agave Lounge", blurb: "the camp's own DJ sets, recorded in the dome", tracks: SETS.map((s) => ({ url: s.url, title: `${s.artist}: ${s.title}` })) };
  }
  const c = soundCamp(key.slice(key.indexOf(":") + 1));
  if (!c) return { name: key, blurb: "", tracks: [] };
  return { name: c.name, blurb: c.blurb, tracks: campTracks(c) };
}
/** What a place plays from afar: its first set. */
/** A place's sets with real sound: its clips (VIDEO_CLIPS) are shown, never played in passing. */
export const playable = (key: string) => soundOf(key).tracks.filter((t) => !t.clip);
export const ambientUrl = (key: string, i = 0) => { const t = playable(key); return t[i % Math.max(1, t.length)]?.url ?? ""; };
/** Whether a place has only clips: riding past it shows a video instead of taking over the music. */
export const clipsOnly = (key: string) => playable(key).length === 0;

/** A place with only clips, seen in passing (asked 2026-10-22): its video plays silently in a corner while your
 * music carries on; a tap opens its panel and plays it with sound. */
export function ClipPeek({ k, onOpen, ref }: { k: string; onOpen: (key: string, t: Track) => void; ref?: Ref<HTMLDivElement> }) {
  const s = soundOf(k), t = s.tracks[0];
  if (!t) return null;
  // placed by the game's frame loop, just above the place it belongs to (PlayaWin)
  return (
    <div className="pl-peek" ref={ref} data-key={k}>
      <iframe key={t.url} tabIndex={-1} aria-hidden title="" allow="autoplay; encrypted-media" src={playerSrc(t.url, true, false, true)} />
      <button type="button" className="pl-peek-tap" onClick={() => onOpen(k, t)} aria-label={`listen to ${s.name}`}>
        <span className="pl-peek-label">🔈 tap to listen · {s.name}</span>
      </button>
    </div>
  );
}

/** A command to whichever embed plays `url` (SoundCloud's widget or YouTube's player, lib/games/playaMedia.ts). */
const post = (w: Window | null | undefined, url: string, method: MediaMethod, value?: string | number) => {
  const c = mediaCommand(url, method, value);
  try { if (c) w?.postMessage(c.msg, c.origin); } catch {}
};
/**
 * What this device has heard (lib/listened.ts, asked 2026-10-22): each set's place, and the ones played to the end.
 * Written back every few seconds while something plays and whenever a set ends.
 */
const heard = { l: typeof localStorage !== "undefined" ? loadListened() : {}, savedAt: 0 };
const markProgress = (url: string, pos: number) => {
  const now = Date.now(); heard.l = noteProgress(heard.l, url, pos, now);
  if (now - heard.savedAt > 4000) { heard.savedAt = now; saveListened(heard.l); }
};
const markDone = (url: string) => { heard.l = noteDone(heard.l, url, Date.now()); heard.savedAt = Date.now(); saveListened(heard.l); };
/** The set a place starts on: the first not yet heard to its end, then the one heard longest ago. */
export const nextSetIndex = (key: string) => nextUnheard(heard.l, playable(key).map((t) => t.url));
export const startSetFor = (key: string): Track | undefined => { const t = soundOf(key).tracks; return t[nextUnheard(heard.l, t.map((x) => x.url))]; };
/**
 * A player just ready: ask SoundCloud to report progress. The seek to where the set was left waits for its first
 * "play" (seekPending): seeking a SoundCloud widget before it plays made it start and stop again at the game's start.
 */
const seekPending = new Map<string, number>();
const resume = (w: Window, url: string) => {
  if (!isVideo(url)) { post(w, url, "addEventListener", "playProgress"); post(w, url, "addEventListener", "play"); post(w, url, "addEventListener", "finish"); }
  const at = resumeAt(heard.l, url); if (at > 0) seekPending.set(url, at); else seekPending.delete(url);
};
const seekIfPending = (w: Window, url: string) => { const at = seekPending.get(url); if (at) { seekPending.delete(url); post(w, url, "seekTo", at); } };
/** YouTube's player reports nothing until told someone is listening: say so once it has loaded. */
const hello = (f: HTMLIFrameElement | null, url: string) => { try { if (f && isVideo(url)) f.contentWindow?.postMessage(ytListening(), YT_ORIGIN); } catch {} };

/**
 * A YouTube set in the game (2026-10-22): the embed takes no taps, so YouTube's title, channel, share and
 * "watch on YouTube" links can't be reached; a tap layer over it plays and pauses, and while it isn't playing
 * a cover of its own (the thumbnail, the set's name, a play button) hides YouTube's pause and end screens.
 */
function VideoShell({ url, title, playing, onToggle, className, children, ios }: { url: string; title: string; playing: boolean; onToggle: () => void; className?: string; children: ReactNode; ios?: boolean }) {
  // an iPhone starts sound only from a tap inside YouTube's own player: there the tap goes through to it,
  // and the cover still hides YouTube's screens while the set isn't playing
  return (
    <div className={`pl-yt${ios ? " pl-yt-pass" : ""}${className ? ` ${className}` : ""}`}>
      {children}
      <button type="button" className="pl-yt-tap" onClick={onToggle} aria-label={playing ? `pause ${title}` : `play ${title}`}>
        {!playing && (
          <span className="pl-yt-cover" style={{ backgroundImage: `url(${ytThumb(url)})` }}>
            <span className="pl-yt-play" aria-hidden>▶</span>
            <span className="pl-yt-title">{title}</span>
          </span>
        )}
      </button>
    </div>
  );
}

export function Lounge({ parked, now, open, onPick, onPlaying, onClose, onOpen, onCollapse, vehicle, onHop, aboard, onRideAlong, ios, onDrive }: {
  parked: string | null; now: Now | null; open: boolean;
  onPick: (key: string, t: Track) => void; onPlaying: (on: boolean) => void;
  onClose: () => void; onOpen: () => void; onCollapse: () => void;
  vehicle: VehicleId; onHop: (id: VehicleId) => void;
  /** riding along on this art car, and the button that hops on or off */
  aboard: boolean; onRideAlong: () => void;
  /** an iPhone: taps on a video go to YouTube's player */
  ios?: boolean;
  /** a famous art car you can take the wheel of (artcars.ts) */
  onDrive?: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const key = (open ? parked ?? now?.key : now?.key) ?? null;
  const nowUrl = useRef(""); nowUrl.current = now?.url ?? "";
  const nowAuto = useRef(false); nowAuto.current = !!now?.auto;
  const nowPlaying = useRef(false); nowPlaying.current = !!now?.playing;
  /** the panel made big shows every SoundCloud set as its own player, stacked (asked 2026-10-22): their frames by url */
  const stack = useRef(new Map<string, HTMLIFrameElement>());
  const pickUrl = useRef((url: string) => {});
  /** the panel and its video filling the screen (asked 2026-10-22) */
  const [wide, setWide] = useState(false);
  // a video that ends or can't play here moves on to the place's next set, so YouTube's end and error screens never show
  const next = useRef(() => {}); next.current = () => {
    if (!now) return;
    const t = soundOf(now.key).tracks, i = t.findIndex((x) => x.url === now.url);
    if (t.length > 1) onPick(now.key, t[(i + 1) % t.length]); else onPlaying(false);
  };

  // the player reports play and pause, so a set you started keeps going when you drive off
  useEffect(() => {
    const on = (e: MessageEvent) => {
      // which player spoke: the main one, or one of the stacked SoundCloud players
      let u: string | null = null, w: Window | null = null;
      const main = frame.current?.contentWindow;
      if (main && e.source === main) { u = nowUrl.current; w = main; }
      else for (const [url, f] of stack.current) if (f.contentWindow && e.source === f.contentWindow) { u = url; w = f.contentWindow; }
      if (!u || !w) return;
      const pos = mediaProgress(e.origin, e.data);
      if (pos != null) markProgress(u, pos);
      const ev = mediaEvent(e.origin, e.data), isNow = u === nowUrl.current;
      // a set you tapped is told to play as soon as its player is ready, besides its autoplay setting; one that was
      // playing when its frame was swapped (the panel made big or small again) carries on
      if (ev === "ready") { post(w, u, "addEventListener", "play"); post(w, u, "addEventListener", "pause"); post(w, u, "addEventListener", "finish"); resume(w, u); if (isNow && (nowAuto.current || nowPlaying.current)) post(w, u, "play"); }
      else if (ev === "play") {
        seekIfPending(w, u);
        if (isNow) onPlaying(true);
        else { for (const [url, f] of stack.current) if (url !== u) post(f.contentWindow, url, "pause"); if (main) post(main, nowUrl.current, "pause"); pickUrl.current(u); }
      }
      else if (ev === "pause") { if (isNow) onPlaying(false); }
      else if (ev === "finish" || ev === "error") { if (ev === "finish") markDone(u); if (!isNow) return; if (isVideo(u)) next.current(); else onPlaying(false); }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [onPlaying]);

  if (!key || (!now && !open)) return null;
  const s = soundOf(key);
  pickUrl.current = (url) => { const t = s.tracks.find((x) => x.url === url); if (t) onPick(key, t); };
  // big: every SoundCloud set gets its own player in a stack, so no one has to pick from the list; the videos stay in it
  const scTracks = s.tracks.filter((t) => !isVideo(t.url));
  const stacked = wide && open && scTracks.length > 1;
  const listed = stacked ? s.tracks.filter((t) => isVideo(t.url)) : s.tracks;
  const nav = (e: KeyboardEvent) => {
    const items = [...(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
    }
  };
  const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onCollapse(); } };

  return (
    <section className={`pl-lounge${now && s.tracks.find((x) => x.url === now.url)?.clip ? " pl-lounge-clip" : ""}${wide ? " pl-lounge-wide" : ""}`} data-mini={open ? undefined : ""} aria-label={open ? `${parked === key ? "parked at" : "playing from"} ${s.name}` : "now playing"} onKeyDown={esc}>
      {open ? (
        <div className="pl-lg-body">
          <div className="pl-lg-head">
            <div className="pl-lg-who">
              <span className="pl-lg-eyebrow">{parked === key ? "now parked at" : "now playing from"}</span>
              <b className="pl-lg-name">{s.name}</b>
            </div>
            <button type="button" className="pl-lg-btn pl-lg-widen" onClick={() => setWide((w) => !w)} aria-pressed={wide} aria-label={wide ? "make the panel smaller" : "make the panel fill the screen"} title={wide ? "smaller" : "bigger"}>{wide ? "⤡" : "⤢"}</button>
            <button type="button" className="pl-lg-btn" onClick={onCollapse} aria-label="fold the panel to a bar">–</button>
            <button type="button" className="pl-lg-btn" onClick={onClose} aria-label="close and stop the music">×</button>
          </div>
          <p className="pl-lg-blurb">{s.blurb}</p>
          {vehicle === "found" && key.startsWith("mutant:") && (
            <div className="pl-lg-hop">
              <button type="button" className="pl-lg-btn pl-lg-ride" onClick={onRideAlong}>hop off</button>
              <span>at the wheel: hop off leaves it parked here and puts you on the bike</span>
            </div>
          )}
          {vehicle !== "found" && parked?.startsWith("mutant:") && parked === key && (
            <div className="pl-lg-hop">
              <button type="button" className="pl-lg-btn pl-lg-ride" aria-pressed={aboard} onClick={onRideAlong}>{aboard ? "hop off" : `ride along on ${s.name}`}</button>
              {onDrive && <button type="button" className="pl-lg-btn pl-lg-ride pl-lg-drive" onClick={onDrive}>drive it</button>}
              <span>{aboard ? "riding along: any arrow key hops you off" : "it drives, you listen"}</span>
            </div>
          )}
          {parked === "agave" && key === "agave" && (
            <div className="pl-lg-hop" role="group" aria-label="hop on another ride">
              <span>hop on:</span>
              {VEHICLE_IDS.filter((id) => id !== vehicle).map((id) => (
                <button type="button" key={id} className="pl-lg-btn pl-lg-ride" onClick={() => onHop(id)}>{VEHICLES[id].name}</button>
              ))}
            </div>
          )}
          {listed.length > 0 && <ul className="pl-lg-list" ref={list} onKeyDown={nav}>
            {listed.map((t) => {
              const on = now?.url === t.url;
              return (
                <li key={t.url}>
                  <button type="button" className="pl-lg-set" aria-pressed={on} onClick={() => onPick(key, t)}>
                    <span className="pl-lg-play" aria-hidden>{on && now?.playing ? "♪" : "▶"}</span>
                    <span className="pl-lg-title">{t.title}</span>
                    {t.clip && <span className="pl-lg-clip">clip</span>}
                  </button>
                </li>
              );
            })}
          </ul>}
          {stacked && (
            <div className="pl-lg-stack">
              {scTracks.map((t) => (
                <div key={t.url} className="pl-lg-player pl-lg-stacked" data-now={now?.url === t.url ? "" : undefined}>
                  <iframe title={`${s.name}: ${t.title}, on SoundCloud`} allow="autoplay" src={playerSrc(t.url, false, false)}
                    ref={(f) => { if (f) stack.current.set(t.url, f); else stack.current.delete(t.url); }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="pl-lg-bar">
          <span className="pl-lg-note" aria-hidden>♪</span>
          <button type="button" className="pl-lg-now" onClick={onOpen} aria-label={`open the player: ${now?.title}, ${s.name}`}>
            <span className="pl-lg-title">{now?.title}</span> <span className="pl-lg-from">· {s.name}</span>
          </button>
          <button type="button" className="pl-lg-btn" onClick={onClose} aria-label="stop the music">×</button>
        </div>
      )}
      {now && !(stacked && !isVideo(now.url)) && (
        <div className={`pl-lg-player${isVideo(now.url) ? " pl-lg-video" : ""}${s.tracks.find((x) => x.url === now.url)?.clip ? " pl-lg-clip-player" : ""}`}>
          {isVideo(now.url) ? (
            <VideoShell ios={ios} url={now.url} title={now.title} playing={now.playing} onToggle={() => post(frame.current?.contentWindow, now.url, now.playing ? "pause" : "play")}>
              <iframe key={`${now.url}|${now.auto}`} ref={frame} tabIndex={-1} title={`${s.name}: ${now.title}, on YouTube`} allow="autoplay; encrypted-media"
                src={playerSrc(now.url, now.auto, false)} onLoad={(e) => hello(e.currentTarget, now.url)} />
            </VideoShell>
          ) : (
            // an iPhone (2026-10-22): the widget's own autoplay is refused there and it then pauses the set the tap started a
            // moment later, so on iOS the frame loads quiet and only the play posted on "ready" starts it
            <iframe key={`${now.url}|${now.auto}`} ref={frame} title={`${s.name}: ${now.title}, on SoundCloud`} allow="autoplay"
              src={playerSrc(now.url, now.auto && !ios, false)} onLoad={(e) => hello(e.currentTarget, now.url)} />
          )}
        </div>
      )}
    </section>
  );
}

/** The camps you can hear from the road: one widget per voice in the mix, out of sight but for
 * `show`, the camp you are hearing most, whose player sits bottom left as the lounge's does (2026-10-22). */
export function AmbientVoices({ voices, ios, setOf, show, onSkip, onOpen }: { voices: Voice[]; ios: boolean; setOf: Record<string, number>; show?: string; onSkip: (key: string) => void; onOpen: (key: string, t: Track) => void }) {
  return (
    <div className="pl-amb">
      {voices.map((v) => {
        const i = setOf[v.key] ?? nextSetIndex(v.key), url = ambientUrl(v.key, i), t = playable(v.key);
        const track = t[i % Math.max(1, t.length)];
        return <AmbientVoice key={`${v.key}|${url}`} url={url} title={track?.title ?? ""} vol={v.vol} ios={ios} shown={v.key === show} name={soundOf(v.key).name} onSkip={() => onSkip(v.key)} onOpen={() => track && onOpen(v.key, track)} />;
      })}
    </div>
  );
}

function AmbientVoice({ url, title, vol, ios, shown, name, onSkip, onOpen }: { url: string; title: string; vol: number; ios: boolean; shown: boolean; name: string; onSkip: () => void; onOpen: () => void }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = useState(false);
  const skip = useRef(onSkip); skip.current = onSkip;
  const st = useRef({ ready: false, on: false, sent: -1, vol });
  st.current.vol = vol;
  const apply = () => {
    const s = st.current, w = ref.current?.contentWindow;
    if (!w || !s.ready) return;
    // an iPhone can't set the volume, so there a camp is on or off as it comes and goes
    const want = ios ? gate(s.vol, s.on) : s.vol > 0;
    if (!ios && Math.abs(s.vol - s.sent) >= 2) { post(w, url, "setVolume", s.vol); s.sent = s.vol; }
    if (want !== s.on) { post(w, url, want ? "play" : "pause"); s.on = want; }
  };
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const pos = mediaProgress(e.origin, e.data);
      if (pos != null) markProgress(url, pos);
      const ev = mediaEvent(e.origin, e.data);
      if (ev === "ready") { st.current.ready = true; st.current.sent = -1; resume(ref.current.contentWindow!, url); apply(); }
      else if (ev === "play" || ev === "pause") { if (ev === "play" && ref.current.contentWindow) seekIfPending(ref.current.contentWindow, url); setPlaying(ev === "play"); }
      // a set that ends is done (the place moves on next time); a video that ends or won't play here: on to the camp's next set
      else if (ev === "finish" || ev === "error") { if (ev === "finish") markDone(url); if (isVideo(url)) skip.current(); }
    };
    window.addEventListener("message", on);
    const w = ref.current?.contentWindow;
    return () => { window.removeEventListener("message", on); post(w, url, "pause"); };
    // apply reads the latest volume from the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(apply, [vol, ios]);
  if (!url) return null;
  const video = isVideo(url);
  // each player sits in a box that is out of sight but for the camp you hear most; there it has an open
  // button, and a video opens the full panel when tapped (the panel's player takes over the sound)
  return (
    <div className={`pl-amb-box${shown ? " pl-amb-on" : ""}${video ? " pl-amb-video" : ""}`}>
      {video ? (
        <VideoShell ios={ios} url={url} title={`${title} · ${name}`} playing={playing} onToggle={onOpen}>
          <iframe ref={ref} tabIndex={-1} aria-hidden={shown ? undefined : true} title={shown ? `${name}, on YouTube` : ""} allow="autoplay; encrypted-media"
            src={playerSrc(url, false, false)} onLoad={(e) => hello(e.currentTarget, url)} />
        </VideoShell>
      ) : (
        <iframe ref={ref} tabIndex={shown ? 0 : -1} aria-hidden={shown ? undefined : true}
          title={shown ? `${name}, on SoundCloud` : ""} allow="autoplay" src={playerSrc(url, false, false)} onLoad={(e) => hello(e.currentTarget, url)} />
      )}
      {shown && <button type="button" className="pl-amb-open" onClick={onOpen} aria-label={`open ${name}'s sets`} title="open">⤢</button>}
    </div>
  );
}
