# GTA:BRC: the things PLAN-3D.md left out (effort plan)

Written 2026-10-31, asked by Collin: "write up a plan to implement all the things you didn't plan to do, I'd like to know how much effort it will be." These are the items PLAN-3D.md section 11.2 lists as not taken from Bruno Simon's folio (bruno-simon.com, code at github.com/brunosimon/folio-2025, MIT), each priced in hours for a mid-level agent, testing included, the way PLAN-3D.md prices its phases. Nothing here has been started. Read PLAN-3D.md sections 0 to 4 first: its rules, commands and ship gate apply here unchanged unless a section below says it needs a waiver.

| item | where it stands |
|---|---|
| Real physics (Rapier) | planned in PLAN-3D.md Phase 9 by the main thread (both views, real suspension, knockable props, shoves against art cars and bikes); not priced here |
| WebGPU / TSL | section 1 |
| A world built in Blender | section 2 |
| 3D menus | section 3 |
| Achievements | section 4 |
| Multiplayer (shared counters, leaderboards, whispers; live presence apart) | section 5 |
| Positional sound | section 6 |

Versions below were checked on npm on 2026-10-31 and are all at least two weeks old (where the latest was newer, the one before it is named).

---

## 1. WebGPU and TSL (≈ 32 to 45 h)

### 1.1 What it means here

three 0.186.1 already ships the WebGPU renderer (`three/webgpu`, `three/tsl`), so there is **no new dependency**: `WebGPURenderer` runs on WebGPU where the browser has it and falls back to its own WebGL 2 backend elsewhere, one code path for both. The cost is that **`WebGPURenderer` does not run `onBeforeCompile` or `ShaderMaterial`**: every material we patch has to become a node material written in TSL. What we have today (counted in `src/game/three/`):

- **9 custom shader sites**: `fx.ts` (4: the bright pass, the blur, the composite and the trip's afterimage, with `Pass.js`, `OutputPass.js` and `AfterimageShader.js` from the examples), and one `onBeforeCompile` each in `camps.ts` (`glowing()`, used 11 times across the renderer), `materials.ts` (`litGround`: the night multiply plus a loop over the lamp pool and the headlight cone, used by every `basic()` and the 19 `registerGround()` calls), `skinned.ts` (`skinMaterial()`: the per-vertex glow of the riders, the RV and the Pyramid), `theMan.ts` (his fire) and `litter.ts` (the dust puffs' per-instance alpha).
- WebGL-only calls in `renderer.ts` and `fx.ts`: `WebGLRenderTarget` (half float, 4x MSAA), `renderer.info` with `autoReset = false` (the draw-call budget tooling in the notes, `grid2.mjs`, reads it), `capabilities.getMaxAnisotropy()`, the `webglcontextlost`/`restored` rebuild of phase 5, and `hasWebGL2()` in `view.ts`.

What it buys: on WebGPU, cheaper CPU per draw and **compute shaders** (particles, dust, wind fields, the trip done on the GPU). What it does not buy: fewer draw calls, which is our tight budget (PLAN-3D.md 11.3). On the WebGL 2 fallback it can be slower than `WebGLRenderer` is today.

### 1.2 Steps

**W.1 Spike (4 h).** On a branch, `import { WebGPURenderer } from "three/webgpu"` in `renderer.ts` with `forceWebGL: false`, every patched material temporarily swapped for its stock one, `await renderer.init()` before the first frame. List what breaks; time a frame at the grid's worst pose on WebGPU and on the forced WebGL backend (`forceWebGL: true`) against today's renderer.
**W.2 The shared patches as node materials (12 to 16 h).** `glowing()` → `MeshLambertNodeMaterial` with `emissiveNode = vertexColor().mul(night).mul(glow)` (`night` a `uniform()` the renderer sets, replacing `nightUniform`); `litGround` → a TSL `Fn` looping over the lamp uniforms (`uniformArray`) and the headlight cone, as the `colorNode`/`outputNode` of a `MeshBasicNodeMaterial`, `configureGround()` deciding the loop length; `skinMaterial()`, the Man's fire, the dust alpha (`instancedBufferAttribute`), 8.5's flag wave and 8.6's plates if they have landed (each patch is one more port). Keep the program-key split (`ground-lit`, `ground-lit-plates`) as separate materials.
**W.3 The passes (6 to 8 h).** `fx.ts` on `PostProcessing` from `three/webgpu`: `pass(scene, camera)`, the bloom from `three/addons/tsl/display/BloomNode.js`, the trip's afterimage from `AfterImageNode.js`, MSAA on the scene pass. Match the look of today's glow and trip in screenshot pairs.
**W.4 The renderer's plumbing (3 to 5 h).** `renderer.info` (`info.render.drawCalls` in WebGPU) and the grid tooling; anisotropy; device loss (`renderer.onDeviceLost`) in place of the WebGL context events; `hasWebGL2()` → "WebGPU or WebGL 2"; the phone path of `quality.ts`.
**W.5 Regression (5 to 7 h).** Screenshot pairs of every place by day, at night and with the trip (`skinshots.mjs`, `carshots.mjs`); the real-frame grid on both backends; the top-down draw-call log unchanged (it is untouched code, but prove it).
**W.6 Decide (2 to 5 h).** Frame times on an iPhone (Safari 26 has WebGPU) and the Mac. Ship it as the default only if it is no slower on either backend; otherwise keep it behind `?gpu=webgpu`.

### 1.3 Impact, risks, rules

- Bundle: `three.webgpu.js` is 444 KB gzip against 131 + 287 KB for `three.module.js` + `three.core.js` (gzip -9 of the 0.186.1 build files; Vite's tree-shaking makes both smaller); the three chunk stays under the plan's 900 KB.
- Risks: the WebGL 2 fallback being slower than today (measured in W.1, stop there if it is); TSL's API still moves between three releases (we pin exactly, rule 3, so upgrades are deliberate); Rapier (Phase 9) and Phase 8 add shaders that would each need porting, so the later this is done the bigger it gets.
- Rules: none waived. Rule 3 (three.js, pinned) holds; 0.5's chunk limit holds.
- **Recommendation: not now.** It fixes a cost we do not have and leaves the one we do. Revisit if we want GPU particles (dust storms, the trip) that the CPU cannot do.

---

## 2. A world built in Blender (≈ 16 to 22 h of pipeline, then 4 to 12 h of modelling per place)

### 2.1 What it means here

Bruno's island is one Blender file; object names (`refLandingPhysicalFixed`) and empties say what becomes what. Our city cannot be that: the 192 blocks and 40,081 structs come from `cityPlan()` (`src/lib/camps.ts`), the stages and bays from `SPOTS`, the art from `ART`, all of it shared with top-down and with the simulation's collisions (`solidAt`, `playa.ts`). What Blender could own is the **one-off places now built in code**: `theMan.ts`, `theTemple.ts`, `pyramidStage.ts`, `dragonLady.ts`, `bigImagination.ts`, `goldenTicket.ts`, `agave.ts`, `places.ts` (the café, the Gate, the airport), `stages.ts`'s drums, and the rides in `rides.ts`/`riders.ts`. That is the same slot PLAN-3D.md Phase 7 (section 10) fills with downloaded models; this adds our own authored ones and a naming convention.

The simulation stays the source of where things are and what is solid: a model's empties are checked against the sim's circles, never read by it (the node tests would otherwise have to parse glb files, and top-down would depend on them).

### 2.2 Steps

**B.1 The loader (5 h).** `src/game/three/models.ts` (Phase 7 step 7.1 plans this file; build it once for both): `GLTFLoader` + `MeshoptDecoder` + `KTX2Loader` (all in three's examples; the Basis transcoder files from `node_modules/three/examples/jsm/libs/basis/` copied to `public/gta/basis/`), and the naming rules: a mesh ending `_glow` gets `glowing()`, `_ground` gets `registerGround()`, `_led` gets the LED strip treatment `pyramidStage.ts` uses, `_lod1` is the far version; materials coloured from one 256×1 palette texture (Bruno's trick; ours is the `C` palette in `PlayaWin.tsx`, so the palette is generated from it and never painted by hand).
**B.2 The build step (4 h).** `scripts/models/build.mjs` running `@gltf-transform/cli@4.5.1` (devDependency): `meshopt` compression, textures to KTX2 (ETC1S for colour, UASTC for anything with fine detail, as Bruno does), under 2 MB a model (Phase 7's limit). Blender itself is not an npm package: it must be installed (blender.org, GPL; only its output ships, which is ours).
**B.3 The template file (5 to 8 h).** `art/blender/playa.blend` with a Python script (`art/blender/guides.py`, run with `blender -b -P`) that reads a JSON dump of `SPOTS`, `ART`, `MAN_R`, `TEMPLE`, `CENTER_CAMP` and the block outlines (a new `scripts/models/dump.mjs` writes it from `src/lib`) and lays out guides at the sim's real positions and radii, so a modeller builds the Pyramid inside its 36 ft circle without guessing.
**B.4 The check (2 to 5 h).** `scripts/models/check.mjs`: every model's `col_*` empties fit inside the sim's solid shape for that place (the Pyramid's test in `pyramidStage.test.mjs` is the model for this), triangle and draw-call counts per model written to the manifest; the real-frame grid after each swap.
**B.5 Per place (4 to 12 h each, art time).** Model, export with the preset, build, swap the code-built version behind the manifest so it can be reverted alone. The Man, the Temple and the Pyramid are the obvious first three.

### 2.3 Impact, risks, rules

- Bundle: models load at runtime from `public/models/`, not in the chunk; each over 1 MB uncompressed is a 0.5 "stop and ask".
- Risks: **the modelling is art, not code.** An agent can script Blender (`bpy`), but what it scripts is the same boxes and cylinders the TypeScript builds today: the gain comes only if a person who models does B.5. Draw calls: one merged model per place keeps the budget; a naïve export with a material per part breaks it (B.4 catches it).
- Rules: rule 5 (assets) is met by our own work; 0.5's 1 MB asset limit and the licence check apply per model. No waiver needed while the sim stays the source of positions.
- **Recommendation: only with a modeller.** If Collin or an artist will model, build B.1 to B.4 (about 16 to 22 h) together with Phase 7, which needs most of it anyway. Without one, Phase 7's downloaded models are the better use of the hours.

---

## 3. 3D menus (≈ 26 to 38 h for the parts worth doing)

### 3.1 What it means here

Bruno builds the projects and the interface as 3D objects you drive up to and click, with keyboard, touch and gamepad. Ours is React DOM shared by both views: the HUD in `PlayaWin.tsx` (the pager, the minimap, the where-box, the speed, the flash, the tool buttons, the phone's diamond and rail, 47 `pl-` elements), the music panel `PlayaLounge.tsx` and the garage `RidePicker.tsx`. Two hard limits:

- **The music panel cannot be drawn in WebGL.** It plays SoundCloud's and YouTube's own players in cross-origin iframes (`PlayaLounge.tsx`); a page cannot draw an iframe into a texture. It stays DOM (at most placed with `CSS3DRenderer`, which is DOM with a 3D transform and still sits over the canvas).
- **The DOM is what screen readers and the phone layout rely on** (the aria labels, the 44 px targets of phase 5). A 3D menu needs a DOM twin, so it is extra work, not a replacement.

So the honest scope is the pieces that are better in the world than over it, in the chase view only (top-down unchanged):

### 3.2 Steps

**M.1 Pointing at the world (6 to 8 h).** `src/game/three/pick.ts`: a raycast from the pointer (mouse, touch tap that is not a drag of the view) against a small list of pickable objects; a focus ring moved by the arrow keys when a menu is open; `src/game/gamepad.ts` reading the Gamepad API into the existing `Input` (sticks, triggers as gas/brake, A as E, B as hop off), useful in both views and worth doing alone (3 h of the 6 to 8).
**M.2 The garage as a showroom (12 to 16 h).** In the chase view, V opens the garage as a scene: the rides you have on turntables (the same models `rides.ts` and `cars.ts` build), the camera dollying along them, stats as a sign beside each (a `CanvasTexture`, as `decals.ts` does), pick with M.1; `RidePicker.tsx` stays the DOM version (top-down, phones in portrait, screen readers) and is the source of what is in the garage.
**M.3 Signs in the world (4 to 6 h).** Over each sound camp's bay within 300 ft, its name and what is playing on a lit sign (one instanced plane, the text drawn to a shared atlas at 2 Hz); tapping it opens the panel. One draw call.
**M.4 Parity and checks (4 to 8 h).** Every 3D menu has its DOM twin reachable by keyboard; the emulated iPhone at 390×844 and 844×390; the draw-call grid (M.2 is its own scene, so it does not count against the city).

Not worth doing: the pager, the minimap, the speed and the tool buttons in 3D (they are glanceable HUD, and the phone layout of phase 5 was tuned by hand on a real iPhone).

### 3.3 Impact, risks, rules

- No new dependency (`CSS3DRenderer` is in three's examples if it is ever wanted). Draw calls: M.3 adds 1.
- Risks: two versions of the garage drifting apart (keep `RidePicker`'s data the source); touch picking fighting the drag-to-look of phase 5 (a tap is under 8 px of travel and 250 ms).
- Rules: rule 4 of 0.5 (nothing changes top-down) holds; PLAN-3D.md section 1 says the HUD, the panel and the garage are the same DOM in both views, so M.2 is a scope change to say yes to, not a rule waiver.
- **Recommendation: gamepad yes (3 h), the showroom maybe, the rest no.**

---

## 4. Achievements (≈ 12 to 18 h)

### 4.1 What it means here

A list of goals, some cryptic, that unlock things, with how long you took to get them all. Most of what they would count already exists as the simulation's events (`GameEvent` in `playa.ts`: the mission events, `moop`, `bump`, `hit`, `park`, `takeoff`, `landed`, `bail`, `storm`) and state (`g.angels` for dust angels, `ringBell`, the places in `startKey`, the rides, the art cars found in the garage, the sets heard in `listened.ts`). It works the same in both views and needs no 3D at all.

### 4.2 Steps

**A.1 The list and the rules (4 to 6 h).** New `src/lib/achievements.ts` (pure) and `achievements.test.mjs`: `type Achievement = { id; name; hint; secret?: boolean; reward?: string }`, about 25 of them (deliver a job without a bump; pick up 50 MOOP; make a dust angel and ring the bell; visit the Man, the Temple, the café and the airport; bail out of the plane and land on the Esplanade; ride every ride; find five art cars; drive the Golden Ticket; hear a set to its end at three camps; ride out a dust storm; be at the Temple at night with the trip on…); `type Progress = { got: Record<string, number>; counts: Record<string, number>; started: number }`; `noteEvents(p, events, g, now): { p: Progress; unlocked: string[] }`, pure, taking the events `stepGame` already returns and a few read-only facts from `g`. Anything needing a new stat (distance, top speed) keeps it inside `Progress`, so `playa.ts` does not change.
**A.2 Wiring (2 to 3 h).** In `PlayaWin.tsx`, where the frame loop already handles `stepGame`'s events, call `noteEvents`; store `Progress` in `localStorage` under `agentcamp-playa-achievements` (in try/catch, like `GARAGE_KEY`); an unlock shows the existing flash, a short chime through the same Web Audio context as the bell (`ding()`).
**A.3 The list to look at (3 to 5 h).** A tab in the garage (`RidePicker.tsx`): got, not yet, secret ones as "???", the time from the first unlock to the last when all are done; phone layout checked at 390×844.
**A.4 Rewards (3 to 4 h).** Unlocks that are only colours: paint jobs for the bike and the e-bike (`riders.ts` takes the colours as data, and the top-down sprite in `PlayaWin.tsx` reads the same), a gold Golden Ticket trim. No gameplay advantage.

### 4.3 Impact, risks, rules

- No dependency, no draw calls (a paint job is a colour). Bundle a few KB.
- Risks: small. Per device only (a phone and a laptop each keep their own) unless section 5 lands; clearing site data loses them.
- Rules: none waived (new lib file; top-down gains a garage tab and the paint jobs, which is a visible change to top-down: say so when asking).
- **Recommendation: yes, the best value on this list.**

---

## 5. Multiplayer, Bruno's light kind (≈ 30 to 42 h; live presence 30 to 50 h more)

### 5.1 What it means here

There is **no backend today**: the site is a static Vite build on Vercel, `vercel.json` has one rule (every path rewrites to `index.html`), and the only network calls are SoundCloud's and YouTube's players. Bruno's multiplayer is deliberately not shared physics: shared counters, a daily leaderboard and "whispers" (up to 30 short messages left in the world with the writer's country flag, moderated). Ours would be:

- **Shared counters**: MOOP picked up by everyone, dust angels made, the Greeters' bell rung, bumps (shown on a sign at the Gate and on the Man's base).
- **A daily leaderboard**: the fastest delivery of each pager job, reset at midnight Pacific.
- **Whispers**: a short note left at a spot on the open playa that other players find, 30 at a time.

The stack on Vercel: **Vercel Functions** in an `api/` folder (Node runtime on Fluid Compute) and a **Redis store from the Vercel Marketplace (Upstash Redis)**, plus **Vercel BotID** against scripted abuse. Nothing is provisioned by this plan: Collin installs the store from the Vercel dashboard (Marketplace → Upstash) and `vercel env pull` brings the keys down.

Dependencies (runtime, server side only, never in the client bundle except BotID's small client): `@upstash/redis@1.39.0`, `@upstash/ratelimit@2.2.0`, `botid@1.5.11`.

### 5.2 Steps

**N.1 Backend scaffold (5 to 7 h).** `api/` with a shared `api/_lib/store.ts` (`Redis.fromEnv()`); `vercel.json`'s rewrite changed so `/api/*` is not sent to `index.html` (`"source": "/((?!api/).*)"`); local runs with `vercel dev`; the ship gate (0.4) gains a `curl` of `/api/health` after deploy. The functions may import pure code from `src/lib` (it is plain TypeScript), so the server can check a position with the sim's own `surfaceAt`/`solidAt`.
**N.2 Counters (3 to 5 h).** `POST /api/count` (`{ kind: "moop" | "angel" | "bell" | "bump" }`, `INCR`, rate-limited per IP: 30 a minute), `GET /api/counts` (cached 10 s at the CDN); the client batches its events and sends them every 30 s; the sign in both views.
**N.3 Leaderboard (8 to 10 h).** `POST /api/run` with the job, its time and a compact trace of the run (positions every second); the server rejects runs that are impossible (faster than the ride's top speed allows between the trace's points, using `VEHICLES` from `src/lib/playa.ts`); `ZADD` into a key per job per day with a 48 h TTL; a name of up to 12 characters from a word list (no free text, so nothing to moderate); the top ten on a board at Center Camp and in the pager.
**N.4 Whispers (10 to 14 h).** `POST /api/whisper` (`{ x, y, text }`); allowed only on the open playa and not within 100 ft of another (checked with the sim's code); 30 kept, the oldest dropped; the country flag from Vercel's `x-vercel-ip-country` header, nothing else stored about the writer. **Moderation is the decision**: either free text through a moderation model (Bruno uses OpenAI's; on Vercel that would go through AI Gateway, with its key and its cost) or, simpler and safe, a phrase kit (pick from 200 phrases and emoji: "dusty hug", "lost my bike here", "❤️ 🔥"). A report button that hides a whisper after three reports. Drawn as a small flame in both views.
**N.5 Abuse and checks (4 to 6 h).** BotID on the three POST routes; rate limits; a kill switch (an env var that turns every route read-only); load-test N.2 at 50 requests a second with a script; costs written down (read the free tier's limits on the Marketplace page at install time; this plan did not check them).

**Live presence** (other players' rides on the playa in real time) is a different size: WebSockets on Vercel Functions, a room per region of the city, interpolation, 30 to 50 h more, and rides that pass through each other (no shared physics, as Bruno decided). Not recommended until the light kind has players.

### 5.3 Impact, risks, rules

- Client bundle: BotID's client plus a few KB of fetch code; draw calls: the signs, the board and the whispers, 2 to 3 (instanced).
- Risks: abuse (forged scores, spam: N.3's trace check and N.5); moderation if free text is chosen; an outage must never stop the game (every call is fire-and-forget with a timeout, and the boards show "—"); privacy (no accounts, no emails, only a country).
- Rules: PLAN-3D.md 0.1's "no other runtime deps" and rule 7 (deploy gate) are about the client and the push; a server is new ground: ask before adding it, and the Marketplace install and its billing are Collin's to do.
- **Recommendation: counters and the leaderboard yes if you want a reason to come back (16 to 22 h with N.1 and N.5); whispers only with the phrase kit; presence no.**

---

## 6. Positional sound (≈ 18 to 26 h)

### 6.1 What it means here

**The music cannot be made positional.** Every set plays in SoundCloud's or YouTube's own player in a cross-origin iframe (`PlayaLounge.tsx`, `AmbientVoice`), and a page cannot route an iframe's audio into Web Audio: no panning, no muffling, only the volume the widget API takes (`setVolume`, sent as `playaSound.ts`'s mix says: `loudness()` over `HEAR_R` = 600 ft, at most `MAX_VOICES` = 2). Rehosting the sets to get at their audio is not allowed (they are the artists'). So the music keeps its distance fade as now.

What can be positional is **the game's own sound**, of which there is one today: the Greeters' bell, synthesised in Web Audio in `PlayaWin.tsx` (`ding()`). Bruno's world has the engine, the tyres, impacts, the horn, wind, crowds, fire; ours could have:

- your ride: the pedals' tick on a bike, the e-bike's whine, the art car's diesel, the plane's prop, pitched by speed;
- the tyres' scrub when you drift (from `carSpeeds()`'s sideways speed) and the crunch on loose playa versus packed streets (`gripAt`);
- bumps and hits (and Phase 9's knocked-over props);
- the art cars you pass: a horn and their engine, from where they are;
- the crowd's murmur at a stage, the Man's fire, the bell from where it hangs;
- wind (with PLAN-3D.md 8.5's `windAt`).

That needs **no change to `playaSound.ts`** (PLAN-3D.md 11.2 said it would: that was wrong; the mix of the music stays as it is), so no waiver.

### 6.2 Steps

**S.1 The graph (4 h).** `src/game/audio.ts`: one `AudioContext` (the bell's `window.__ac`, made on the first user gesture for iOS), a master gain on the sound toggle (`soundRef`), the listener at the camera (the chase view: `cam3`'s position and yaw) or above the ride facing north (top-down); a `PannerNode` (`HRTF` on desktop, `equalpower` on phones to spare the CPU) per voice, voices pooled to 12.
**S.2 What plays and how loud (3 to 4 h).** New `src/lib/sfx.ts` (pure) and `sfx.test.mjs`: from the game state and its events, which voices want to play, where and how loud (`sfxFrame(g, events, prev): Want[]`), with the music ducking them (a stage's music within `FULL_R` = 70 ft lowers the engine by 6 dB).
**S.3 The sounds (8 to 12 h).** Synthesised where it is easy (the bike's tick, the whine, the prop, wind as filtered noise, the bell as now); samples where it is not (diesel, tyre scrub, crowd, fire): CC0 only (freesound.org's CC0 filter, Sonniss GDC bundles are royalty-free but not CC0, so no), credited in `public/gta/CREDITS.md`, under 600 KB together as Opus/AAC (0.5's 1 MB limit).
**S.4 Checks (3 to 6 h).** A test page of every sound at each distance; iOS Safari (the context unlocks only on a tap; the silent switch); the CPU of the graph on the emulated iPhone at 4x throttle (under 1 ms a frame); the music never ducked by more than the plan says.

### 6.3 Impact, risks, rules

- No dependency (Web Audio is the browser's). Bundle: a few KB of code plus up to 600 KB of samples loaded after the first tap.
- Risks: sound that annoys (every sound gets its own level and a way off: the existing sound button mutes all; a setting for "music only" is cheap); iOS's audio unlock; HRTF's CPU on phones (hence `equalpower` there).
- Rules: rule 5 for the samples (CC0 or our own); 0.5's asset size; no waiver.
- **Recommendation: yes, after Phase 9** (impacts and knocked-over props are where it pays most), the ride and tyre sounds first.

---

## 7. Summary

| item | hours (low–high) | new dependencies | risk | recommendation |
|---|---|---|---|---|
| Real physics (Rapier) | planned in PLAN-3D.md Phase 9 by the main thread | — | — | — |
| WebGPU / TSL | 32–45 | none (in three 0.186.1) | medium: WebGL 2 fallback may be slower; every later shader needs porting too | not now; only for GPU particles later |
| A world built in Blender | 16–22 pipeline + 4–12 per place | `@gltf-transform/cli@4.5.1` (dev), Blender installed | medium: the gain is art, not code | only with a person who models; pair with Phase 7 |
| 3D menus | 26–38 (gamepad alone 3) | none | medium: two versions of the garage, touch vs drag-to-look | gamepad yes; showroom maybe; HUD and panel no (iframes cannot go in WebGL) |
| Achievements | 12–18 | none | low | yes, best value |
| Multiplayer (counters, leaderboard, whispers) | 30–42 (counters + board 16–22) | `@upstash/redis@1.39.0`, `@upstash/ratelimit@2.2.0`, `botid@1.5.11`; an Upstash store from the Vercel Marketplace | medium: abuse, moderation, a first backend | counters + leaderboard yes; whispers with a phrase kit only |
| Live presence | 30–50 more | WebSockets on Vercel Functions | high | no, not until the light kind has players |
| Positional sound | 18–26 | none (CC0 samples) | low: only the game's own sounds; the music cannot be panned | yes, after Phase 9 |

All of it, presence apart and Blender at three places: about 145 to 225 hours. The recommended set (achievements, gamepad, counters and leaderboard, positional sound): about 50 to 70 hours.
