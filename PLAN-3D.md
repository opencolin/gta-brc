# GTA:BRC in 3D: the chase-camera mode (implementation plan)

Written 2026-10-26, rewritten the same day as a hand-off plan: every step names its files, its functions and their signatures, what feeds what, how to check it, and about how long it takes. An agent that has never seen this repo should be able to work through it top to bottom. Read sections 0 to 3 in full before touching anything; then do the phases in section 5 in order, one commit per step.

A second way of seeing the same game: a third-person camera behind your ride, the way GTA puts you behind the car. The top-down game stays as it is and stays the default; you switch between the two at any moment and the world, the music, the job on the pager and the people around you carry on exactly where they were.

---

## 0. Read this first: the repo, the rules, the commands

### 0.1 Where things are

- Repo: `~/Code/gta-brc` (github.com/opencolin/gta-brc, private). Vite 6 + React 19 + TypeScript 5 (strict), Node 22. No other runtime deps today (`react`, `react-dom` only).
- `src/lib/` is the **simulation and its data**, plain TypeScript with no DOM: `brc.ts` (geometry), `camps.ts` (the camps in every block), `soundcamps.ts` (camps, art cars, art pieces, their music), `artmedia.ts`, `playa.ts` (the game: physics, NPCs, parking, jobs, weather, light), `playaSound.ts` (the mix). Tests sit beside them as `*.test.mjs`.
- `src/game/` is the **window**: `PlayaWin.tsx` (about 1,755 lines: the frame loop, `paint()`, the HUD, input, the camera), `PlayaLounge.tsx` (the music panel), `RidePicker.tsx` (the garage), `artcars.ts` + `artplatforms.ts` (the art cars drawn from above), `artpieces.ts` + `art/*.ts` (the big art drawn from above), `sideviews.ts` (rides from the side, for the garage), `citymap.ts` (the painted city map for the minimap), `playa.css`.
- `src/main.tsx` mounts `<PlayaWin />` full screen. `index.html` is the only page; `vercel.json` rewrites every path to it (place URLs like `/dragonlady` are read by `startKey()` in `playa.ts`).
- Lib files import each other with explicit `.ts` extensions (`from "./brc.ts"`) because the tests run them under `node --experimental-strip-types`; game files use the `@/lib/...` alias. Keep to that: anything a node test imports must be in `src/lib/`, import with `.ts` extensions, and use no `enum`, no `namespace`, no constructor parameter properties, no decorators, no DOM (anything that needs more than type erasure fails under `node --experimental-strip-types`).

### 0.2 Commands

```bash
cd ~/Code/gta-brc
npm install                      # once
npm test                         # node --experimental-strip-types --test src/lib/*.test.mjs  (71 tests, all must pass)
npx tsc --noEmit -p .            # type check
npm run build                    # tsc --noEmit && vite build (must be clean)
npm run dev -- --port 5177       # dev server (the app's preview config "gta-brc" expects 5177)
```

### 0.3 Rules that are not negotiable

1. **The 2D simulation stays the single source of truth.** Nothing in `src/lib/playa.ts`, `brc.ts`, `camps.ts`, `soundcamps.ts` changes its behaviour for this work. The 3D mode is a renderer over the same `Game` object, driven by the same `Input`, with the same jobs, parking, music and HUD. If a step seems to need a simulation change, stop and say so.
2. **Top-down stays the default.** `?view=chase` (or the stored choice) switches; with no param and nothing stored, it is top-down.
3. **three.js is the renderer**, as an npm dependency bundled by Vite, pinned exactly: `three@0.186.1` and `@types/three@0.186.0` (checked on npm 2026-10-26). No CDN, no react-three-fiber.
4. **Lazy.** The 3D code is a dynamic `import()` so the top-down bundle does not grow. Check with `npm run build`: `dist/assets/index-*.js` must stay within 30 KB gzip of what it is before phase 0 (today about 183 KB gzip, 613 KB raw; measure it yourself before phase 0 with `gzip -c dist/assets/index-*.js | wc -c`); the three chunk is separate.
5. **No logos, no brand art, nothing copied.** Textures are either generated in code from the drawings we have, or public domain / CC0 files whose source and licence are written in the commit message and in `public/gta/CREDITS.md`.
6. **Pure helpers get node tests** beside them in `src/lib/`. Anything that touches three.js or the DOM is not unit-tested; it is checked in the browser (section 6).
7. **Never deploy on failing tests.** Every push goes through the gate in 0.4. `git push` to `main` deploys burningman.chat on Vercel within about a minute.
8. **Commit messages** are one sentence-style summary line saying what changed for the player (see `git log` for the house style: no conventional-commit prefixes, plain English, "(asked 2026-10-26)" where a request is being answered), followed by a blank line and the attribution line your harness gives you (this repo's commits end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; keep whatever line your own harness specifies).
9. **Do not refactor `paint()` out of `PlayaWin.tsx`.** The earlier draft of this plan moved it to `paint2d.ts`; that is 1,200 lines of churn with no benefit for this work. Leave it where it is and branch around it.

### 0.4 The ship gate (use this exact shape for every push)

```bash
cd ~/Code/gta-brc && npm test 2>&1 | grep -E "^# (pass|fail)|^not ok" | tee /tmp/gate.txt; grep -q "^# fail 0" /tmp/gate.txt && npm run build > /dev/null 2>&1 && echo BUILD_OK && git add -A src public package.json package-lock.json && git commit -q -m "<summary line>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" && git push -q && git log --oneline -1
```

Then confirm it is live (the built asset's name changes with every deploy; grep a string you know is in the new code):

```bash
for i in $(seq 1 24); do sleep 10; a=$(curl -s "https://burningman.chat/?x=$i" | grep -o 'assets/index-[^"]*\.js' | head -1); [ -n "$a" ] && curl -s "https://burningman.chat/$a" | grep -q "agentcamp-playa-view" && echo "live after ~$((i*10))s" && break; done
```

### 0.5 Stop and ask (do not decide these alone)

- Adding any asset file whose licence is not plainly public domain, CC0, CC BY or CC BY-SA (section 10.1 has the rule).
- Any change to an existing file in `src/lib/` (new files there are fine; `src/game/citymap.ts` gains an `export` on `surroundImage` in phase 1). No existing lib file needs changing in phase 0.
- More than 1 MB (uncompressed) of new assets, or the three chunk exceeding 900 KB gzip.
- Anything that would change how the top-down mode looks or plays.

---

## 1. What it is (scope)

- **One game, two renderers.** Everything that *is* the game lives in `src/lib`. The 3D mode is a new way of drawing the same `Game` object each frame, and the same input drives it.
- **The view is a chase camera**: behind and above the ride, looking a little ahead of it, pulling back with speed, swinging round as you turn, the mountains on the horizon.
- **Switching**: a camera button in the tools (next to day/night and the trip), the `C` key, and `?view=chase` / `?view=top` on any URL (`burningman.chat/dragonlady?view=chase`). The choice is remembered per device in `localStorage` under `agentcamp-playa-view`. Switching is instant: no reload, no reset.
- **Everything you can do stays**: ride, hop on art cars, drive the ones you find, fly the plane, bail out under the chute, park at a camp and get its panel, the pager jobs, MOOP, day/night, storms, the trip. The HUD, the panel, the garage, the minimap and the big map are the same React DOM over a different canvas.

### Not in scope
- No new gameplay, no interiors, no shooting.
- No new art pipeline: the 3D world is built from the data and drawings we already have (stand-ins first, better models later, one piece at a time).
- Not a replacement: top-down remains the default until the 3D mode is as smooth on a phone.

---

## 2. Architecture

### 2.1 Files

```
src/lib/                      the simulation (unchanged behaviour)
  view3d.ts          NEW      pure: coordinate mapping, the scene *description* builders (no three.js)
  view3d.test.mjs    NEW      tests for the above
  chaseCam.ts        NEW      pure: the chase camera (spring, look-ahead, air view, block avoidance via solidAt)
  chaseCam.test.mjs  NEW
src/game/
  PlayaWin.tsx       EDIT     the view mode state, the second canvas, the switch, the stick's camera-relative heading,
                              the frame loop branch, project() for the clip peek
  view.ts            NEW      ViewMode plumbing: read/write the choice (URL param + localStorage), WebGL2 check
  playa.css          EDIT     the WebGL canvas and the camera button
  three/             NEW      everything that imports three.js (one lazy chunk)
    renderer.ts               ChaseRenderer: mount, resize, frame, project, dispose; owns scene/camera/renderer
    ground.ts                 the playa, the streets, the blocks, Center Camp, the fence, the airport, Gate Road, the mountains
    camps.ts                  the camp structures as InstancedMesh per kind, chunked by sector
    places.ts                 the sound camps' stages and bays, the art pieces, Agave's domes, the Man, the Temple, the Gate
    rides.ts                  your ride, the art cars (roaming, parked, driven), the plane, the chute
    people.ts                 NPC bikes, e-bikes, walkers, ambulances, crowds (instanced)
    lights.ts                 sun, sky, night, the headlight, point lights, fog for night and storms
    decals.ts                 2D drawings rendered to CanvasTextures (art car roofs, art piece decals, bay "P", signs)
    materials.ts              the shared materials and the palette (from PlayaWin's C)
    fx.ts                     phase 4: post passes (afterimage for the trip, bloom at night)
public/gta/
  earth.jpg          NEW      phase 2: NASA Blue Marble 2048×1024 (public domain, URL in 2.4) for the Earth dome; or none, see 2.4
  CREDITS.md         NEW      every asset's source and licence
```

### 2.2 The seam: `Renderer`

Add to `src/game/view.ts`:

```ts
import type { Game, Input } from "@/lib/playa";
import type { Vec } from "@/lib/brc";

export { type ViewMode, VIEW_KEY, readViewMode } from "@/lib/view3d";   // defined in src/lib/view3d.ts: a lib file never imports from src/game, and the node tests cannot resolve "@/"

/** What the renderer needs besides the game: the canvas size, the trip level, the stick/orbit state and what the HUD covers. */
export type ViewState = {
  w: number; h: number; dpr: number;
  trip: number;            // 0..1, PlayaWin's tripLevel
  orbit: number;           // radians the player has dragged the camera round (0 = straight behind), phase 5
  touchUi: boolean;        // phone layout: the stick and pads are on screen
  brake: boolean;          // input.brake || input.handbrake, for brake lights
  night: number;           // nightLevel(g.dayT), passed so the renderer does not import playa's light code twice
  storm: number;           // stormLevel(g.storm)
};

export interface Renderer {
  mount(canvas: HTMLCanvasElement): void;
  resize(w: number, h: number, dpr: number): void;
  /** Draw one frame of this game state. Never mutates g. */
  frame(g: Game, view: ViewState, dt: number): void;
  /** World feet (and feet up) → CSS pixels on the canvas, or null when behind the camera. For the clip peek and labels. */
  project(p: Vec, up?: number): { x: number; y: number } | null;
  /** The camera's yaw in the game's heading convention, for the camera-relative stick (section 2.5). */
  yaw(): number;
  dispose(): void;
}

/** readViewMode(search, stored) (in view3d.ts): ?view=… wins, then the stored choice, then top-down. */
export function writeViewMode(mode: ViewMode): void;   // localStorage, in try/catch
export function hasWebGL2(): boolean;                   // !!document.createElement("canvas").getContext("webgl2")
```

`ViewMode`, `VIEW_KEY` and `readViewMode` live in `src/lib/view3d.ts` (pure, tested in `view3d.test.mjs`); `src/game/view.ts` re-exports them and adds the two browser helpers and the types above.

### 2.3 How `PlayaWin.tsx` uses it (the only edits to the window)

Today's frame loop (`useEffect` starting at the line `const cv = canvas.current, stage = board.current;`, about line 1376; search for the text rather than trusting the number) steps the game, updates `cam`, calls `paint(ctx, w, h, g, cam, inp, font, tripLevel.current)`, positions the clip peek with `cam`, and refreshes the HUD every 100 ms. The edits:

1. **State.** `const [view, setView] = useState<ViewMode>(() => { let s: string | null = null; try { s = localStorage.getItem(VIEW_KEY); } catch {} return readViewMode(location.search, s); })` (storage reads can throw: the file wraps its other reads the same way) plus `viewRef` mirrored for the loop; `const glCanvas = useRef<HTMLCanvasElement>(null); const orbitRef = useRef(0); const three = useRef<Renderer | null>(null); const [threeLoading, setThreeLoading] = useState(false)`.
2. **Second canvas.** In the JSX, put the WebGL canvas **before** the 2D one, so DOM order stacks the 2D canvas over it and the HUD (later in the DOM) over both; add **no z-index** anywhere (the HUD boxes have none, so a z-index on a canvas would paint it over the pager, the minimap, the tools and the pads and swallow their clicks): `<canvas ref={glCanvas} className="pl-canvas pl-canvas-3d" aria-hidden="true" hidden={view !== "chase"} />` immediately before `<canvas ref={canvas} className="pl-canvas" …/>` (about line 1640). CSS (`playa.css`): `.pl .pl-canvas-3d[hidden] { display: none; }` (needed: `.pl .pl-canvas` sets `display: block`, which outranks the browser's `[hidden]` rule). In chase mode `paint()` is not called; instead `paintOverlay(ctx, w, h, g, proj, tg)` (new, in PlayaWin, ~40 lines) clears the 2D canvas and draws the two things `paint()` already draws in screen space at its very end, after `screen()`: the dust-storm whiteout and streaks, and the off-screen target arrow. Lift exactly those two blocks out of `paint()` into `paintOverlay`, where `tg = missionTarget(g.mission, g.t)` (computed inside `paint()` today, so pass it in) and `proj: (p: Vec) => { x: number; y: number } | null`; `paint()` calls it last with `(p) => ({ x: w / 2 + (p.x - cam.x) * z, y: h / 2 + (p.y - cam.y) * z })`, the chase branch with `(p) => r.project(p)`. In chase mode its first lines are `const d = dprOf(ctx); ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);` (the 2D context is DPR-scaled through `dprOf`). The storm gradient is centred on `proj(g.car)` (falling back to the screen centre when null); when `proj(tg.at)` is null (the target is behind the camera) draw the arrow along the bottom edge from the target's bearing relative to `r.yaw()` instead of skipping it. The **trip echo stays in `paint()`**: it is drawn near the start of `paint()`, under the world, and captured at the end, so it is not screen-space and lifting it would change top-down pixels; in chase mode the trip is only the CSS filter/transform on both canvases until phase 4's afterimage pass. This is the one refactor inside `paint()`; keep it small and keep the pixels identical in top-down (compare screenshots before/after, section 6).
3. **Loading the renderer.** Inside the frame-loop effect, because it needs `w`, `h` and `dpr`, which are that effect's locals (`dpr` is today a `const` inside `fit()`: change `let w = 0, h = 0, …` to also declare `let dpr = 1`, and in `fit()` turn `const dpr = Math.min(2, …)` into the assignment `dpr = Math.min(2, window.devicePixelRatio || 1)`): `const ensureThree = async () => { if (three.current) return three.current; setThreeLoading(true); const { ChaseRenderer } = await import("./three/renderer"); const r = new ChaseRenderer(); r.mount(glCanvas.current!); r.resize(w, h, dpr); three.current = r; setThreeLoading(false); return r; }`, stored in a ref (`ensureThreeRef.current = ensureThree`) so a second effect on `view` can call it when `view === "chase"`. While loading, show the flash "loading the 3D view" (`flash.current = …`) and keep painting top-down. If `!hasWebGL2()`, force `view = "top"`, hide the button, and flash "3D needs WebGL 2".
4. **The loop branch.** After the game steps and `cam` updates (keep the 2D camera code running; it is cheap and keeps the switch seamless), replace the single `paint(...)` call with:
   ```ts
   const r = viewRef.current === "chase" ? three.current : null;
   if (r) { r.frame(g, { w, h, dpr, trip: tripLevel.current, orbit: orbitRef.current, touchUi: touchUiRef.current, brake: inp.brake || inp.handbrake, night: nightLevel(g.dayT), storm: stormLevel(g.storm) }, dt); paintOverlay(ctx, w, h, g, (p) => r.project(p), missionTarget(g.mission, g.t)); }
   else if (w && h) paint(ctx, w, h, g, cam, inp, font, tripLevel.current);
   ```
   The trip's CSS `filter`/`transform` (set on `cv.style` just above the paint call) is applied to `glCanvas` as well in chase mode (same strings; both elements).
5. **Resize.** In `fit()`, also size the WebGL canvas (`glCanvas.width/height = round(w·dpr)`) and call `three.current?.resize(w, h, dpr)`.
6. **The clip peek** block (`const pk = peekEl.current …`) uses `sx, sy` from the 2D camera; in chase mode use `r.project(at, 12)` and skip when null.
7. **Switching.** `const toggleView = () => setView(v => { const n = v === "top" ? "chase" : "top"; writeViewMode(n); flash.current = { text: n === "chase" ? "chase camera. C for top-down" : "top-down. C for the chase camera", until: game.current.t + 2.5 }; return n; })`. Key `C`/`c` in `onKey` (next to `n`/`t`); a button in `.pl-tools` after the trip button with `aria-label="camera: chase view (C)"` and a simple SVG (a cube or a film camera; draw it inline like the others). Add `· C chase camera` to the help list on the title card.
8. **Dispose.** In the cleanup of the effect that loads it: `three.current?.dispose(); three.current = null;` (`main.tsx` wraps the app in `<StrictMode>`, so in dev the effect runs twice; a disposed renderer left in the ref would be reused).

That is the entire footprint in `PlayaWin.tsx`: about 90 added lines and the `paintOverlay` lift.

### 2.4 Coordinate mapping (verified against the code)

The game (`brc.ts`, `playa.ts`):
- Units are feet; the Man is the origin. `x` grows to the right (east, toward 3:00), `y` grows **down** on the screen (south, toward 6:00); 12:00 is `-y`. `polar(min, r)` = `(r·sin a, -r·cos a)` with `a = clockToAngle(min) = min/720·2π`.
- A heading `h` is radians, `h = 0` facing 12:00 (`-y`), increasing **clockwise** on the screen. From `carStep` in `playa.ts`: `fwd(h) = (sin h, -cos h)`, `right(h) = (cos h, sin h)`. Camp structs' `rot` and the canvas rotations in `paint()` use the same convention (`ctx.rotate(h)` with nose at `-y`). (`fwd`/`right` are private to `playa.ts`, and `cang(min) = clockToAngle(min) - Math.PI / 2` is private to `PlayaWin.tsx` and `citymap.ts`: copy them into `src/lib/view3d.ts` as exported `fwd`, `right` and `cang`; do not import them from where they are.)
- `g.alt` is feet up (plane, chute).

three.js (right-handed, Y up). The mapping is fixed as:

| game | three.js |
|---|---|
| `x` (east) | `X` |
| `y` (south, down on the map) | `Z` |
| up (`alt`) | `Y` |
| heading `h` | `object.rotation.y = -h` (a yaw of `-h` turns three's local `-Z` forward into `(sin h, 0, -cos h)`, which is `fwd(h)`) |
| any canvas-convention angle `a` (struct `rot`, `cang(min)`) | `rotation.y = -a` |

Consequences, each of which is a unit test in `view3d.test.mjs`:
- `toWorld({x, y}, up = 0)` returns `[x, up, y]`. `fromWorld([X, Y, Z])` returns `{x: X, y: Z}` and `Y` as `up`.
- `yawOf(h) = -h`.
- Facing 12:00 from 6:00 & Esplanade (`h = 0`), the Man is ahead (`-Z`), 3:00 is on your right (`+X`), Agave at 8:30 is on your left. (The map is not mirrored: with X = x and Z = y, looking down from +Y with the camera's up vector along −Z shows exactly the top-down picture.)
- **Flat vector shapes** (streets, blocks, bays, plazas): build a `THREE.Shape` in game coordinates verbatim (for a block: `s.absarc(0, 0, r0, a0i, a1i, false); s.absarc(0, 0, r1, a1o, a0o, true);` with `a0i/a1i/a0o/a1o` derived from `blockBounds(ring, sector)` exactly as the private `blocks()` in PlayaWin does; copy that derivation into `view3d.ts`, see 1.1), make a `ShapeGeometry`, set `mesh.rotation.x = +Math.PI / 2` and the material `side: THREE.DoubleSide`. (That rotation maps local `(x, y, 0)` to world `(x, 0, y)`; its face normal points down, hence DoubleSide.)
- **Flat textured decals** (art piece drawings, art car roofs, the bay's "P", signs): `PlaneGeometry(w, l)` with `mesh.rotation.x = -Math.PI / 2` and the image's **top row pointing north / toward the nose** (the drawings already have the nose at `-y`, so render them to the canvas as they are). This rotation keeps the normal up and does not mirror: local `+X` → world `+X` (right), image top → world `-Z` (north).
- Local model frames: a ride's or art car's **forward is local `-Z`**, its right is local `+X`; place it with `position.set(x, height/2, y)` and `rotation.y = -h`.

### 2.5 Input in chase mode

- Keys are unchanged (`left`/`right` steer the car, which is what a chase view wants).
- **The stick** (`stickMove` in PlayaWin) today sets `stick.a = atan2(dx, -dy)` in screen terms and the simulation treats it as a world heading. In chase mode, "push up" must mean "forward as seen", so rotate it by the camera's yaw: `a = wrapAngle(atan2(dx, -dy) + (viewRef.current === "chase" && three.current ? three.current.yaw() : 0))` (`wrapAngle` is private to `playa.ts`: define `export const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))` in `src/lib/view3d.ts` and import it from there). `yaw()` returns the camera's forward heading in the game's convention (equal to the car's heading when the camera is straight behind, plus the orbit angle). This is the only input change and it lives in PlayaWin, not in `playa.ts`.
- `orbit` (phase 5): a second finger / right-drag turns the camera round the car; it springs back to 0 over 0.6 s after release.

### 2.6 Data flow per frame (what reads what)

| Game / world data | Where it is | What it drives in 3D |
|---|---|---|
| `g.car {x, y, h, vx, vy}`, `g.vehicle`, `g.alt`, `g.chute`, `g.plane` | `playa.ts` Game | your ride's mesh position/yaw (`rides.ts`), the camera (`chaseCam.ts`), the chute/plane in the air |
| `drivenKey()`, `parkedCarAt(key)` | `playa.ts` | which art car mesh is "you" (hidden as an NPC, drawn as the ride) and where the parked ones stand |
| `g.npcs` + `npcAt(n, g.t)` | `playa.ts` | every instanced NPC matrix each frame (`people.ts`); the 54 mutants' hulls (`rides.ts`) |
| `SPOTS`, `AGAVE`, `ART`, `MUTANTS`, `OBSTACLES` | `playa.ts` | stages, bays, Agave's domes, the art pieces' decals and stand-ins |
| `cityPlan()` (192 blocks, 40,081 structs) | `playa.ts` → `camps.ts` | the instanced camp structures (`camps.ts`) |
| `ARC_R`, `RADIALS`, `arcWidth`, `radialWidth`, `blockBounds`, `FENCE`, `AIRPORT`, `GATE`, `CENTER_CAMP(_R)`, `CAFE_R`, `TEMPLE(_R)`, `MAN_R` | `brc.ts` | ground geometry (`ground.ts`) |
| `cityImage()`, `surroundImage()` (export it) | `citymap.ts` | the far ground texture (phase 1) |
| `ART_CARS[id]`, `drawGoldenTicket` | `artcars.ts` | art car roof textures (`decals.ts`) |
| `ART_PIECES[id]` | `artpieces.ts` | art piece ground decals |
| `g.mission` → `missionTarget(m, t)` | `playa.ts` | the pink target ring (flat decal) and the off-screen arrow (overlay) |
| `g.moop`, `g.dust`, `g.angels`, `g.angelT` | Game | MOOP glints (instanced), wheel dust (instanced sprites), dust angels (decals), the angel maker (your ride lying down) |
| `nightLevel(g.dayT)`, `stormLevel(g.storm)` | `playa.ts` | sun intensity, emissives, fog (`lights.ts`) |
| `g.parking.at`, `atGate(g)`, `atAirport(g)` | Game | the lit bay / Gate ring; the plane on the pad is drawn when `g.vehicle !== "plane"` |
| `tripLevel` | PlayaWin | CSS on the canvas (both modes), the afterimage pass (phase 4) |

---

## 3. The camera (`src/lib/chaseCam.ts`, pure)

```ts
import type { Vec3 } from "./view3d.ts";
import { solidAt } from "./playa.ts";

export type CamState = { eye: Vec3; look: Vec3; yaw: number; fov: number };   // Vec3 = { x: number; y: number; z: number } in THREE axes
export type CamTarget = { x: number; y: number; h: number; vx: number; vy: number; alt: number; len: number; maxSpeed: number; chute: boolean; plane: boolean };
export const CAM = { tauPos: 0.18, tauLook: 0.08, fovMin: 60, fovMax: 70, backK: 2.6, backMin: 14, upK: 1.3, upMin: 9, pullMax: 0.35, aheadK: 1.0, aheadMin: 12, velLead: 0.35 } as const;

/** Where the camera wants to be for this target, before smoothing: behind by backK·len+backMin (× 1+pullMax·speed/maxSpeed), up by upK·len+upMin, turned by `orbit` round the ride; looking at a point aheadK·len+aheadMin ahead plus velLead·velocity, at a third of the ride's length up. In the air (plane or chute) the camera trails further: back + 0.25·alt, up + 0.5·alt, and looks at the ride itself. */
export function camGoal(t: CamTarget, orbit = 0): { eye: Vec3; look: Vec3; fov: number };
/** One step of the smoothing: exponential approach with time constants tauPos / tauLook (k = 1 - e^(-dt/τ)); fov eases with tauPos. */
export function camStep(s: CamState, goal: ReturnType<typeof camGoal>, dt: number): CamState;
/** Keep the camera out of the camp blocks. Returns the goal unchanged when the target is airborne (target.alt >= 20: plane or chute; solidAt is 2-D) or when the target itself is already solid (solidAt({ x: target.x, y: target.y }, false) is non-null: a bike riding the alleys, since bikes go through camps). Otherwise sample 8 points from the target to the goal eye (game x = eye.x, game y = eye.z); at the first one where solidAt(p, false) is non-null put the eye at the PREVIOUS (clear) sample and raise it by 8 ft. The eye is never below 4 ft. */
export function camAvoid<G extends { eye: Vec3; look: Vec3 }>(target: CamTarget, goal: G): G;   // the same object shape back, so fov survives into camStep
export const newCam = (t: CamTarget): CamState;   // eye and look straight at their goals
/** The camera's forward heading in the game's convention, for the stick (2.5). */
export const camYaw = (s: CamState) => Math.atan2(s.look.x - s.eye.x, -(s.look.z - s.eye.z));
```

Numbers (feet; `len` is the ride's `VEHICLES[id].len`, 16 for a bike, 36 for a found art car, 30 for the plane):

| ride | back | up | look-ahead |
|---|---|---|---|
| bike (16) | 56 → 75 at top speed | 30 | 28 + 0.35·v |
| found art car (36) | 108 → 145 | 56 | 48 + 0.35·v |
| plane at 1,000 ft (len 30) | 92 + 250 (the 92 × 1.35 at top speed) | 48 + 500 | the plane |

`fov` = 60° + 10°·min(1, speed/maxSpeed). Near plane 1 ft, far 40,000 ft (the fence is at 11,400 ft, the mountains ring at 30,000). The camera's `up` is +Y always; roll is only the trip's CSS transform.

Tests (`chaseCam.test.mjs`): the goal for a bike standing at the origin facing 12:00 has the eye at `(0, 29.8, +55.6)` (behind means `+Z`) and the look at `(0, 5.33, -28)`, asserted with a tolerance of 0.1; at top speed the eye is 75.06 back; `camStep` never overshoots (stepping toward a fixed goal, the distance to it decreases every step and is under 1 ft after 1 s); `camYaw` of that state is 0 and is `π/2` after turning the target to face 3:00; `camAvoid` from a point on a street toward a goal eye inside a block (use `blockPush`/`surfaceAt` from `brc.ts` to find such points, e.g. the middle of block ring 2 sector 5 from `blockBounds`) returns an eye that `solidAt` reports clear and at least 8 ft higher; in the air the eye is at least `0.5·alt` up; `camAvoid` returns the goal unchanged for an airborne target and for a target that is itself inside a block (a bike in an alley).

---

## 4. Performance budget and techniques

Targets: 60 fps on a 2021 phone (iPhone 13 class) in the city, under 150 draw calls in the city and under 60 on the open playa, under 300k triangles in view, GPU textures under 40 MB on phones (about 65 MB is expected on desktop with the 2560² map and mipmaps), device pixel ratio capped at 2 (1.5 on phones), the three chunk under 900 KB gzip.

How:
- **Instancing**: one `InstancedMesh` per (struct kind × sector). There are 16 sectors and 16 `StructKind`s (`bikes` is one of them); with the derived kinds of 1.1 (rv-roof, shade-roof, pole, dome wire) and one bike-row mesh per n = 2..6 that is about 22 meshes per sector, about 350 in all, each with its own bounding sphere so three.js frustum-culls whole sectors. Distance culling per sector uses the sector's 12 block circles (`sectorBlocks()` in 1.1): a sector is visible when `blocks.some((b) => Math.hypot(b.cx - cam.x, b.cy - cam.z) - b.br < 2600)` (`updateVisibility()` once per frame). Never use one centre point per sector: a sector is 12 rings and about 4,600 ft deep, so from the Esplanade every sector's middle is further than 2,600 ft and the blocks round you would vanish.
- **NPCs**: one `InstancedMesh` per kind (bike, ebike, walker, ambulance) sized to the count; per frame set each instance's matrix from `npcAt`; instances further than 900 ft get a zero scale (`setMatrixAt` with a zero matrix) rather than being removed. `instanceMatrix.setUsage(THREE.DynamicDrawUsage)`.
- **Mutants** (54): one mesh each (a box hull + a roof plane); the roof texture is re-rendered at 10 Hz only for cars within 700 ft (the drawings animate: LEDs, fire, lasers), and once at mount for the rest.
- **Structs count**: 40,081 structs + 21,686 rack/row bikes. Bikes as 2 boxes each would be 43k extra instances; instead draw a `bikes` struct as **one** instance of a "row of n bikes" geometry (merge n bike boxes into one BufferGeometry per n = 2..6, cached) so a row is one instance.
- **Textures**: the city map 2560² (already made by `cityImage()`, reuse the same canvas), the surround 1536², art piece decals 256² each (23), art car roofs 128×256 each (54 + the Golden Ticket), the sprite sheet none (people are low-poly). Generate with `CanvasTexture`, `colorSpace = SRGBColorSpace`, `anisotropy = renderer.capabilities.getMaxAnisotropy()` capped at 8, `generateMipmaps = true`.
- **Shadows**: one directional-light shadow map 1024² covering 600 ft round the ride (`light.shadow.camera` box ±300 ft, `light.target` follows the ride); only the ride, the art cars within 300 ft and the camp structs cast; the ground receives. Off on phones (`touchUi`) until measured.
- **Dynamic resolution**: if 30 consecutive frames take over 20 ms, lower `renderer.setPixelRatio` by 0.25 (not below 1); if 120 frames stay under 12 ms, raise it back toward the cap.
- **Materials**: `MeshLambertMaterial` for the mass of things (cheap), `MeshStandardMaterial` only for the Earth dome, the Orb and the player's ride. Share materials by colour (`materials.ts` keeps a `Map<string, Material>`).
- **Fog** does the far culling visually: `scene.fog = new THREE.Fog(colour, 2500, 14000)` by day (numbers in code never carry thousands separators: `14,000` inside a call is a syntax error). The sky and mountain cylinders get `fog: false` on their materials and follow the camera each frame (`sky.position.set(cam.x, 6000, cam.z)`, `mountains.position.set(cam.x, 1300, cam.z)`); otherwise they render as flat fog colour, and the Gate (14,250 ft out) would sit at the mountains' foot.

---

## 5. Phases and steps

Each step: files → what to write → how to check → commit. Hours are for a mid-level agent, inclusive of testing. Keep each commit small enough to revert on its own; every phase leaves the top-down mode untouched and the chase mode usable behind the flag.

### Phase 0: the seam and the spike (≈ 10 h)

**Goal:** `?view=chase` shows the playa plane with the painted city map, your ride as a box, the chase camera following; the HUD and music work; `C` switches back and forth and nothing is lost.

**0.1 Dependency and mapping helpers (1 h)**
- `npm install --save-exact three@0.186.1 && npm install --save-exact --save-dev @types/three@0.186.0`.
- `vite.config.ts`: add `build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } }` so the library is its own `three-*.js` chunk, loaded only by the lazy `renderer-*.js` (Vite names a lazy chunk after its entry module, so without this there is no `three-*.js` at all).
- `src/lib/view3d.ts`: export `Vec3`, `toWorld(p: Vec, up = 0): Vec3`, `fromWorld(v: Vec3): Vec & { up: number }`, `yawOf(a: number): number` (= −a), `readViewMode(search: string, stored: string | null): ViewMode` (`?view=chase|top` wins; a stored `"chase"`/`"top"`; else `"top"`), `VIEW_KEY`, `ViewMode` (the type), `wrapAngle(a)`, `fwd(h)`, `right(h)`, `cang(min)` (copies of the private helpers, 2.4/2.5) and `PALETTE` (`{ playa: "#e6d3ae", road: "#efe2c6", block: "#d8c095", blockEdge: "#c6ab7c", outside: "#d4c3a0", navy: "#1b1f3b", pink: "#ff6b9a" }`: the values of PlayaWin's private `C`, which `materials.ts` imports from here).
- `src/lib/view3d.test.mjs`: the four mapping facts from 2.4 and `readViewMode("?view=chase", "top") === "chase"`, `readViewMode("", "chase") === "chase"`, `readViewMode("?view=nonsense", null) === "top"`, `readViewMode("?x=1&view=top", "chase") === "top"`.
- Check: `npm test`: all pass (71 today, plus one per new `test()` block).

**0.2 `src/game/view.ts` (0.5 h)**: re-export the pure bits; add `writeViewMode` (try/catch around `localStorage.setItem`) and `hasWebGL2()`; the `Renderer`/`ViewState` types from 2.2.

**0.3 The chase camera (2 h)**: `src/lib/chaseCam.ts` + `chaseCam.test.mjs` exactly as section 3. `camAvoid` imports `solidAt` from `./playa.ts` (that import is fine: playa imports no DOM).

**0.4 `src/game/three/renderer.ts` (3 h)**
```ts
export class ChaseRenderer implements Renderer {
  private renderer!: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(60, 1, 1, 40000);
  private cam: CamState | null = null; private ride: RideMeshes; private ground: GroundMeshes; private w = 1; private h = 1;
  mount(canvas) { this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" }); this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.scene.background = new THREE.Color("#cfe3f5"); this.ground = buildGround(this.scene); this.ride = buildRides(this.scene); addLights(this.scene); canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); this.lost = true; }); canvas.addEventListener("webglcontextrestored", () => this.rebuild()); }
  resize(w, h, dpr) { this.w = w; this.h = h; this.renderer.setPixelRatio(Math.min(dpr, touch ? 1.5 : 2)); this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  frame(g, view, dt) { const target = camTargetOf(g); const goal = camAvoid(target, camGoal(target, view.orbit)); this.cam = this.cam ? camStep(this.cam, goal, dt) : newCam(target); this.camera.position.set(eye…); this.camera.lookAt(look…); this.camera.fov = cam.fov; this.camera.updateProjectionMatrix(); updateRide(this.ride, g, view); this.renderer.render(this.scene, this.camera); }
  project(p, up = 0) { const v = new THREE.Vector3(p.x, up, p.y).project(this.camera); if (v.z > 1) return null; return { x: (v.x + 1) / 2 * this.w, y: (1 - v.y) / 2 * this.h }; }
  yaw() { return this.cam ? camYaw(this.cam) : 0; }
  dispose() { this.renderer.dispose(); /* traverse scene: geometry.dispose(), material.dispose(), texture.dispose() */ }
}
```
This is a sketch, not compilable as it stands: declare `private lost = false;`, write `private rebuild()`, take `touch` from the last `ViewState` (`view.touchUi`), type every parameter as in the `Renderer` interface (2.2), write `this.camera.position.set(e.x, e.y, e.z)` / `this.camera.lookAt(l.x, l.y, l.z)` with `const { eye: e, look: l, fov } = this.cam`, and define the builder functions and types it names (`buildGround`, `buildRides`, `addLights`, `updateRide`, `RideMeshes`, `GroundMeshes`) in their files.

`camTargetOf(g)`: `{ x: g.car.x, y: g.car.y, h: g.car.h, vx, vy, alt: g.alt, len: vehicleOf(g).len, maxSpeed: vehicleOf(g).maxSpeed, chute: g.chute, plane: g.vehicle === "plane" }` (import `vehicleOf` from `@/lib/playa`).

**0.5 Spike ground and ride (1.5 h)**
- `ground.ts` (first version): one `PlaneGeometry` the size of the city image's box (`MAP_BOX` from `citymap.ts`: side = `max(2·half, bottom - top)` ≈ 21,900 ft), textured with `cityImage()` (it is a canvas; `new THREE.CanvasTexture(img)`), at `y = 0`, `rotation.x = -π/2`, centred on `(0, 0, (top + bottom)/2)` so the texture's top row is north (the image's top row is `MAP_BOX.top`, which is `-y`, i.e. north: ✓ with the decal rule). If `cityImage()` returns null (no canvas), a flat `#e6d3ae` plane.
- `rides.ts` (first version): a `BoxGeometry(wid, 6, len)` in `#ff6b9a` for whatever `g.vehicle` is (`VEHICLES[g.vehicle]`), `position.set(g.car.x, 3 + g.alt, g.car.y)`, `rotation.y = -g.car.h`.
- `lights.ts` (first version): `HemisphereLight("#cfe3f5", "#e6d3ae", 0.9)` + `DirectionalLight("#fff4e0", 1.2)` from `(0.4, 1, 0.3)`.

**0.6 PlayaWin wiring (2 h)**: everything in 2.3 except the overlay lift (do the lift in 0.7). Temporarily, in chase mode, clear the 2D canvas instead of painting.

**0.7 The overlay lift (1 h)**: move only the dust-storm whiteout/streaks block and the off-screen target arrow block (the last two blocks of `paint()`, after `screen()`) into `paintOverlay()` as described in 2.3; call it at the end of `paint()` (same order as today) and from the chase branch. Leave the trip echo (its early draw and its end-of-frame capture) in `paint()` untouched. Check top-down screenshots before/after at the same seed and `g.t` (section 6) are pixel-identical.

**Acceptance (phase 0):**
- `npm run dev -- --port 5177` (vite.config.ts sets no port; plain `npm run dev` is 5173), open `http://localhost:5177/?view=chase`, click start: a textured playa seen from behind a pink box that drives with the arrow keys; the camera swings round as you turn and pulls back as you speed up; the HUD address changes; a camp's music comes up when you park in its bay (the bay is not visible in 3D until phase 2, which draws bays, the pink P and the target ring: only `paint()` draws them today; park by position at 8:30 & Esplanade, Agave, and the panel still opens).
- Press `C`: top-down is exactly as before; press `C` again: 3D, same place, same music.
- Reload without the param: top-down (unless you have switched before: then the stored choice). `?view=top` always top-down.
- `npm run build`: the main chunk's gzip size within 30 KB of before; `three-*.js` (the library, from 0.1's `manualChunks`) and the lazy `renderer-*.js` (our code) exist and `index-*.js` imports neither statically (check with `grep -c three- dist/assets/index-*.js`: 0 outside the dynamic import).
- `npm test` all pass. Ship with the gate.

### Phase 1: the city (≈ 14 h)

**Goal:** the city reads as Black Rock City from the chase camera: streets, blocks full of camps, Center Camp, the Man, the Temple, the fence, the airport, Gate Road and the Gate, the sky and the mountains; 60 fps on a laptop.

**1.1 Scene description builders (pure) (3 h)** in `src/lib/view3d.ts`:
```ts
export type Flat = { kind: "arc" | "radial" | "block" | "disc" | "ring" | "strip"; color: string; y: number; /* arc: r0, r1, a0, a1 (canvas radians, with the overhang); block: r0, r1 and the four edge angles a0i, a1i (inner) and a0o, a1o (outer), computed as PlayaWin's private blocks() does: A0 = cang(m0), A1 = cang(m1), a0i = A0 + w0/r0, a1i = A1 - w1/r0, a0o = A0 + w0/r1, a1o = A1 - w1/r1, so the radial streets keep a constant width in feet */ r0?: number; r1?: number; a0?: number; a1?: number; a0i?: number; a1i?: number; a0o?: number; a1o?: number; /* disc/ring: cx, cy, r (and r0 for ring) */ cx?: number; cy?: number; r?: number; /* strip: from, to, width */ from?: Vec; to?: Vec; width?: number };
export function groundFlats(): Flat[];        // streets (13 arcs as "arc" r0..r1 = ARC_R[i] ± arcWidth(i)/2 over 2:00..10:00 with the half-width overhang, 17 radials as strips from ARC_R[0] to ARC_R[12]+28), 192 blocks ("block" from blockBounds with the road half-widths taken off, colour PALETTE.block, y 0.1, plus the streets at y 0.15), Center Camp plaza ("disc" CENTER_CAMP_R, PALETTE.road) and Rod's Road ring, the Man's circle (MAN_R·5), the Temple's (TEMPLE_R·3.4), the airport's two runways and the hangar apron (strips in AIRPORT.local), Gate Road (strip GATE.road.from→to, GATE.width)
export type Prism = { kind: StructKind | "rv-roof" | "shade-roof" | "pole" | "bike-row"; x: number; y: number; z: number; yaw: number; sx: number; sy: number; sz: number; hue: number; emissive: boolean; sector: number; n?: number; label?: string };
export function campPrisms(plans: readonly BlockPlan[]): Prism[];   // one per struct (two for a shade: roof + 4 poles as one "pole" instance each; a "bike-row" per bikes/rack struct carrying n)
export function sectorBlocks(plans: readonly BlockPlan[]): { cx: number; cy: number; br: number }[][];   // 16 arrays, each the 12 BlockPlans' cx, cy, br of that sector (game feet; BlockPlan has them), for distance culling (section 4)
```
Heights and shapes per kind (the geometry each `InstancedMesh` uses; `w`/`l` are the struct's, all in feet):

| kind | geometry (local, before instance scale) | sx, sy, sz | colour | emissive at night |
|---|---|---|---|---|
| rv | BoxGeometry(1, 1, 1) | w, 10, l | hsl(hue, 30%, 85%) body; a second instance "rv-roof" 0.3 tall in #d9d0bd on top | no |
| pod | SphereGeometry(0.5, 10, 6, 0, 2π, 0, π/2) hemisphere (0.5 tall unscaled, base at local y = 0) | w, 14, l (7 ft tall), instance y = 0 | #e3e6ec | no |
| tent | ConeGeometry(0.5, 1, 4) with `geometry.rotateY(Math.PI / 4)` baked in (its four corners sit on the axes otherwise) | w·√2, 8, l·√2 | hsl(hue, 45%, 58%) | no |
| shade | "shade-roof": BoxGeometry(1, 1, 1) at 10 ft | w, 0.5, l (y = 10) | rgba white .9 → #f6f1e6 | no |
|  | "pole" ×4 at the corners: CylinderGeometry(0.3, 0.3, 1) | 1, 10, 1 | #6b5a44 | no |
| canopy | roof at 12 ft like shade, material transparent opacity .6 + 6 poles | w, 0.4, l | #fcfaf4 | faint, hue |
| carpet | PlaneGeometry with `geometry.rotateX(-Math.PI / 2)` baked in (instances only get yaw) | w, 1, l (y 0.2) | hsl(hue, 55%, 42%) | no |
| couch | Box | w, 3, l | hsl(hue, 45%, 38%) | no |
| dome | hemisphere (same as pod) | w, w, w (a true hemisphere of radius w/2), instance y = 0 | #f4efe6 with hsl(hue,35%,52%) wire: use a second wireframe instance of IcosahedronGeometry(0.5, 1) hemisphere-clipped by y ≥ 0 | yes, hue, 0.4 |
| stage | Box | w, 4, l | #1b1f3b, a lip in hue | yes, hue |
| speaker | Box | w, 7, l | #14172c | no |
| rack | Box | w, 3, l | #8a8fa3 | no |
| bike-row | merged n × (BoxGeometry(0.6, 1, 1) frame at 2.2 ft + 2 CylinderGeometry wheels r 1.1) spaced 4.2 ft along local X | 1, 1, 1 | frame hsl(hue + k·83, 70%, 55%), wheels #15161d | no |
| flag | "pole" 12 ft + a PlaneGeometry(6, 4) flag at the top, DoubleSide | 1, 1, 1 | hsl(hue, 85%, 58%) | no |
| arch | two Box posts (1×9×1) at ±w/2 and a lintel Box (w×1×1) at 9 ft, as **one merged geometry per width** (cache by rounded w) | 1, 1, 1 | hsl(hue, 60%, 55%) | yes, hue, 1.0 (the LED arch) |
| potty | Box | w, 8, l | #3a6fd8 | no |
| sign | a Box(1, 6, 1) board on two 1-ft posts at 7 ft; label texture only within 300 ft (phase 2 decals) | w, 1, 1 | #8a6d45 | no |

Tests (`view3d.test.mjs`): `groundFlats()` has 13 arcs, 17 radials, 192 blocks, every block's `r0 < r1`, `a0i < a1i` and `a0o < a1o`; `campPrisms(cityPlan())` has at least 40,000 entries, every one with `sy > 0` and a `sector` in 0..15, every `arch` is emissive, every `bike-row` has `n` in 2..6, the total count of `bike-row` equals the number of `rack`+`bikes` structs that have `n`.

**1.2 `ground.ts` (3 h)**: turn `groundFlats()` into meshes with the ShapeGeometry rule (2.4): street arcs via `shape.absarc(0,0,r1,a0,a1,false); shape.absarc(0,0,r0,a1,a0,true)` (an annular sector; `a0/a1` are the canvas angles `cang(min) ± overhang`), blocks via `shape.absarc(0,0,r0,a0i,a1i,false); shape.absarc(0,0,r1,a1o,a0o,true)`, strips via a 4-point shape, discs via `absarc` full circle; always `new THREE.ShapeGeometry(shape, 64)` for the 13 street arcs, the rings and the discs (the default 12 curve segments give 24 points per arc whatever its sweep, so a 240° street would sit up to 32 ft off its circle on L; 64 gives about 1 ft), the 15° block sectors are fine at the default. Merge all flats of one colour and height into one geometry with `BufferGeometryUtils.mergeGeometries` (from `three/examples/jsm/utils/BufferGeometryUtils.js`) so the whole street network is 1 draw call, the blocks 1, the plazas 1. Keep the textured city plane from phase 0 underneath at `y = 0` (it is the far LOD and the open playa's detail). Give each flat material `polygonOffset: true` with `polygonOffsetFactor = polygonOffsetUnits = -layer` and `renderOrder = layer` (1 the outside plane, 2 blocks, 3 streets, 4 carpets and bays, 5 piece decals): the 0.05-ft height steps z-fight beyond about 1,500 ft once the eye is high (the plane). Beyond the fence: a `ShapeGeometry` of a 60,000-ft square with the pentagon (`FENCE`) as a hole, colour `#d4c3a0`, `y = 0.05`.
- The fence: `LineSegments` round `FENCE` at 3 ft in `#f08a3c` plus posts (`InstancedMesh` of CylinderGeometry, every 300 ft along each side, 4 ft tall).
- The airport: runways as strips (use `AIRPORT.local(lx, ly)` for the corners exactly as `drawAirport` does: `±L/2`, `off ± W/2`), five hangars `Box(300, 24, 200)` at `local(-1700 + k·420 + 150, -460)`, `rotation.y = -AIRPORT.ta`; the windsock pole.
- The Gate: shade `Box(360, 1, 52)` at 12 ft on 4 poles at `GATE.at` with `rotation.y = -GATE.a`; seven booths `Box(28, 8, 28)` at `k·50` along the shade's local X; the bell: a `Cylinder` post 6 ft + a small `SphereGeometry` in gold at `GATE.bell`; the stop: a flat ring decal r 60 at `GATE.stop` in pink (`TorusGeometry(60, 1.2)` flat).
- The mountains: a `CylinderGeometry(30000, 30000, 2600, 64, 1, true)` at `y = 1300`, `side: BackSide`, with a `CanvasTexture` 2048×128 painted in code: a transparent band with a jagged dark-brown skyline (`#4e4234` at .9 alpha fading to 0 at the foot) using a seeded hash, taller to the west (left, `x` < 0) and north-east as `surroundImage()` has them. `scene.background` = a vertical gradient sky: a second cylinder 35,000 r, 12,000 tall, BackSide, with a 2×256 gradient texture (`#8ec5fc` at the top to `#f6ead2` at the horizon) by day; phase 4 changes it with night.
- Check: ride down 6:00 from the Esplanade to L: the blocks are solid colour slabs between lighter streets; Center Camp's plaza is round; the fence posts march past at the far end of 4:30; the runways are past the fence at 4:00.

**1.3 `camps.ts` (3 h)**: from `campPrisms()`, build the `InstancedMesh` set: group by `(kind, sector)`; for each, the geometry from the table, one `MeshLambertMaterial({ color: "#ffffff" })` per kind (three multiplies the material colour by the instance colour, so a coloured material plus `setColorAt` would square the colours) with each instance's exact colour set by `setColorAt`; emissive is per material, not per instance, so for the kinds the table marks emissive (arch, stage, dome, canopy) add an `onBeforeCompile` that adds `vColor` (the instance colour) times a `uNight` uniform to `totalEmissiveRadiance`, or give arches and stage lips a `MeshBasicMaterial` whose `.color` is lerped from dark to the hue by `night`; `count = n`, matrices via a reused `Object3D` dummy: `dummy.position.set(x, y, z)` with `y = sy/2` for geometries centred on the origin (Box, Cylinder, Cone), `0` for the hemispheres (their base is at local y = 0) and the given height for roofs and carpets; dummy.rotation.y = yaw; dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix)`. `mesh.computeBoundingSphere()` after filling. `updateVisibility(camPos)`: per sector, `visible = blocks.some((b) => Math.hypot(b.cx - cam.x, b.cy - cam.z) - b.br < 2600)` over that sector's 12 block circles from `sectorBlocks()` (section 4 says why not a centre point).
- Check: `renderer.info.render.calls` printed to the console on a key press (`P`, handled next to `n`/`t` in `onKey` and only when `import.meta.env.DEV`; not `shift+D`: `D` is in `KEYS` as steer right and would be eaten; `C`, `Q` and `P` are the free letters): under 150 in the city. Walk the alleys on the bike: RVs are 10 ft boxes, pods are low domes, the arches glow at night (toggle `N`).

**1.4 Landmarks in `places.ts` (2 h)**: the Man: a base `CylinderGeometry(MAN_R, MAN_R, 6, 32)` in `#c8b48c` + a stick figure of `CylinderGeometry(1.5, 1.5, L)` segments built from `drawMan`'s points (y down, feet at y = 34) as `(x·1.3, (34 − y)·1.3)`: body (0, 28.6)→(0, 83.2), legs from (0, 28.6) to (±18.2, 0), arms from (0, 67.6) to (±28.6, 96.2), a sphere head r 7.8 at (0, 91), navy by day, emissive `#7df9ff` at night. The Temple: an 8-sided `CylinderGeometry(TEMPLE_R, TEMPLE_R, 18, 8)` in `#d7c29a` + a central 8-sided tower r 22, 60 ft, + a pyramid roof. Center Camp's café: `ConeGeometry(CAFE_R·1.3, 30, 16)` with a 16-stripe canvas texture (`#f6efe2`/`#e8c9a4`) on a 3-ft wall. Rod's Road ring is a flat from 1.1.
- Check: from 6:00 & Esplanade facing the Man: the Man ahead on his base, the Temple behind him on the skyline, the café behind you.

**1.5 Phase 1 acceptance:** the four checks above; 60 fps on a laptop (`requestAnimationFrame` timestamps averaged over 2 s, printed with the same dev key); `npm test` (tests from 1.1 added) and the gate. Commit after 1.2, 1.3 and 1.5.

**Phase 1 as built (2026-10-27)**: steps 1.1 to 1.4 are in (commits 5d77149, ecedc06, 43a5277, 01aa4bd); where the code differs from the text above, the code is right:
- The pure builders are in `src/lib/scene3d.ts` (with `scene3d.test.mjs`), not `view3d.ts`, which is in the main chunk. Extra prism kinds: `dome-wire`, `stage-lip`, `flag-cloth`; `Prism.w` is an arch's width. `Flat.layer` carries the polygon-offset layer; `LAYER_Y`/`LAYER` give the heights and layers.
- Camps are instanced **by geometry class**, not by `StructKind` (all plain boxes share one unit box and one white Lambert material, the colour is per instance): 256 meshes in all, about 15 per wedge, a busy street about 60 draw calls, the worst of 104 positions 86. Big shapes cull at 2,600 ft, small details (poles, flag cloth, sign boards, dome wire, bike rows) at 1,500 ft (`CULL`, `DETAIL` in `camps.ts`). Hemispheres are 8x2 segments and a parked bike is one box (the plan's counts would be about 800k triangles for the bikes alone).
- Curves: three.js doubles the segment count you pass an arc, so streets use 96 (the text's "64 gives about 1 ft" is about 4 ft; the default 12 puts L 120 ft off its circle).
- Ground flats are unlit `MeshBasicMaterial`s so daylight matches the 2D painter; phase 4 must dim them at night. `surroundImage()` (now exported with `AROUND`) is the far ground plane under the city map.
- Glow: arches, stage lips and canopies add `vColor.rgb * uNight * k` to `totalEmissiveRadiance` through `onBeforeCompile` (`vColor` is a vec4 in this three build, so use `.rgb`); `nightUniform` in `camps.ts` is set from `view.night` each frame.
- Measured (Apple M5, 1024x768, headless Chrome): at most 86 draw calls and 305k triangles anywhere in the city, 60 fps capped and about 700 fps uncapped. Phones are untested (phase 5). Bundles: main chunk +2.1 KB gzip, `three` + `renderer` 149 KB gzip.
- Dev key `P` (DEV builds only) prints draw calls, triangles and frame times; `Renderer.perf?()` feeds it.
- Still to come from this phase's list: nothing. The camera button and help line are hidden until phase 2 draws bays and the target ring.

### Phase 2: places (≈ 16 h)

**Goal:** stages, bays, the art pieces, Agave's domes, the art cars (roaming, parked and driven, the Dragon Lady included); you can stop at any camp or piece and its panel opens; you can drive any found car.

**2.1 `decals.ts` (2 h)**:
```ts
export function drawingTexture(draw: (c: CanvasRenderingContext2D, t: number, night: number) => void, w: number, h: number, t: number, night: number): THREE.CanvasTexture;  // a canvas w×h, origin at its centre, draw called as PlayaWin would (nose up), colorSpace sRGB
export function pieceTexture(id: string, r: number, t: number, night: number): THREE.CanvasTexture;   // 256×256, ctx.translate(128,128), scale 128/(r·reach), ART_PIECES[id](ctx, t, night, r); reach = 1.7 (seven drawings reach past 1.15·r: embrace 1.67, r-evolution 1.47, truth-is-beauty 1.44, lodestar 1.32, bliss-dance 1.28, mariposa 1.24, real-love 1.20; 1.7 covers them all, or use a per-id reach table with 1.15 for the rest)
export function carRoofTexture(id: string, t: number, night: number): { tex: THREE.CanvasTexture; w: number; l: number };   // a canvas (w·K)×(l·K) px, K = 3 px/ft, ctx.translate(w·K/2, l·K/2), ctx.scale(K, K); (w, l) is the drawing's extent (2·max|x| by 2·max|y|, rounded up): measure once per id with a recording context, or hard-code 40 × 66 by default, 66 × 80 for big-imagination-747, dragonfly, el-pulpo-mecanico, funkadelephant, hermes, technogecko, discow and luna-the-artcrane, 44 × 136 for dragon-lady, 14 × 22 for golden-ticket; the roof PlaneGeometry(w, l) and the hull colour sample use the same (w, l)
export function bayTexture(): THREE.CanvasTexture;   // 128×128, the pink "P" on a pink carpet as drawBay paints it (read drawBay in PlayaWin and copy its fills)
export function labelTexture(text: string, font: string): THREE.CanvasTexture;   // 256×64, #fbf3e2 on #8a6d45, cached by text
```
Texture updates: a helper `refreshTexture(tex, draw)` re-draws the canvas and sets `tex.needsUpdate = true`; `rides.ts` calls it at 10 Hz for cars within 700 ft.

**2.2 Stages, bays and crowds' spots in `places.ts` (3 h)**: for each `sp` of `SPOTS` (172): the bay as a flat annular-sector decal from `sp.bay` (`r0..r1`, `min ± half` converted to angles: `half/r` radians each side) with `bayTexture()` (phase 2 keeps the bay as a plain pink flat with the "P" texture stretched; fine); when `g.parking.at === sp.key` the bay's material emissive goes pink (`frame()` updates one flag). The stage: `sp.kind === "camp"`: `CylinderGeometry(r, r, 4, 24)` navy with a top disc in `hsl(sp.hue, 70%, 52%)` and two speaker stacks `Box(12, 12, 12)` at `±0.62r` toward the bay (`rotation.y` from `atan2(mid - stage)` as `drawStage` does: `yaw = -(atan2(mid.y - stage.y, mid.x - stage.x) - π/2)`); `"fence"`: a 4-sided cone r, 30 ft, `#2a2440` with gold edges; `"art"` with `!sp.camp?.piece` (41 of the 63 art spots; `piece` is on the sound camp, not the spot): an octahedron (`OctahedronGeometry(r·0.7)`) in hue, emissive at night; a spot with `sp.camp?.piece` (22) is drawn by 2.3 instead. Skip `"agave"` here (2.4).
- Check: park in a bay (Disorient's: `/disorient` URL starts you there): the bay lights pink, the panel opens, the stage and its speakers face you.

**2.3 Art pieces (4 h)**: for each `a` of `ART` (23): the ground decal `PlaneGeometry(3.4r, 3.4r)` (2·reach·r, matching `pieceTexture`) with `pieceTexture(a.id, …)` at `y = 0.3`, transparent; plus a stand-in by id. All stand-ins are in `hsl(a.hue, 60%, 55%)` unless said, `MeshLambertMaterial`, emissive in hue at night:

| id (r) | stand-in (feet) |
|---|---|
| bliss-dance (50), truth-is-beauty (50), r-evolution (45), tara-mechani (45) | a figure: CapsuleGeometry(6, 40) body stood on a Box(20, 2, 20) base, two CylinderGeometry(2, 2, 26) arms raised in a V from 34 ft; mesh-grey `#dcdee3`, wireframe overlay |
| embrace (70) | two tall tapering cylinders (`CylinderGeometry(8, 14, 60)`) 30 ft apart leaning 12° toward each other, `#c9a36b` |
| real-love (50) | a Box(24, 20, 8) heart-red block on a 4-ft base with a `TorusGeometry` ring behind it |
| the-orb (65) | SphereGeometry(55, 32, 24) MeshStandardMaterial metalness 1 roughness 0.15 envMap = `scene.environment` (set a `PMREMGenerator` from the sky in lights.ts), on four thin 70-ft legs |
| big-rig-jig (50) | two CylinderGeometry(6, 6, 60) tilted ±35° crossing at 40 ft, `#8a8f99` |
| lodestar (55) | ConeGeometry(10, 70, 12) on its tip (apex down at 2 ft), `#c9c2ae`, two wing boxes |
| black-rock-observatory (55) | three hemispheres r 18 on 10-ft cylinders in `#e8e6e0` |
| shrumen-lumen (55) | five mushrooms: CylinderGeometry(3, 4, 14) stems + ConeGeometry(16, 10, 12) caps upside-down, hue cycling emissive |
| elder-mother (55), tree-of-tenere (55) | CylinderGeometry(4, 7, 40) trunk `#5b4a35` + SphereGeometry(32, 12, 8) canopy scaled (1, 0.6, 1) at 44 ft in `#8db36a`; at night the canopy is `PointsMaterial` leaves (600 points) in hue |
| muxalove (60) | a ring of 8 CylinderGeometry(2, 2, 24) posts r 40 with a flat torus roof |
| elemental-dragon (60) | three ellipsoids (SphereGeometry scaled (18, 10, 10), (14, 8, 8), (10, 6, 6)) in a curve 60 ft long at 10 ft + a cone head, `#b83a3a` |
| space-whale (60) | SphereGeometry scaled (40, 14, 16) at 24 ft on two posts, `#4a90c2`, tail box |
| ursa-mater (50) | SphereGeometry scaled (24, 16, 14) body + sphere head r 9, `#8a6d45`, on 4 legs |
| penny-the-goose (45) | Sphere scaled (20, 14, 16) + a 30-ft neck cylinder + a sphere head r 6, `#f6f1e6` |
| fire-horse (45) | Box(36, 18, 10) body at 14 ft on 4 cylinder legs + a neck/head, `#2b2b2b`, emissive orange at night |
| medusa-madness (50) | a dome r 26 on 8 posts + 12 hanging CylinderGeometry(0.6, 0.6, 20) tentacles, hue |
| mariposa (45) | two PlaneGeometry(40, 30) wings DoubleSide at 20 ft meeting at a body cylinder, hue, flapping ±15° with `t` |
| chapel-of-babel (50) | a tapering tower: 5 stacked boxes 40→14 ft wide, 80 ft tall, `#c9b36a` |
| head-maze (55) | a Box(60, 24, 44) head-shaped block with a Box(40, 24, 2) "face" plate, `#d7c29a` |

Write each as one small function `(scene, a: ArtPiece) => THREE.Group` in `places.ts`, registered in a `Record<string, …>`; a piece with no entry gets a plain octahedron. (Better models later are a per-piece job that touches nothing else.)
- Check: `/the-orb?view=chase`: the mirrored sphere reflects the sky; `/bliss-dance?view=chase`: the figure stands on her decal; park in a piece's bay: the panel with its videos opens.

**2.4 Agave in `places.ts` (2 h)**: the Earth dome: `SphereGeometry(70, 48, 32)` at `AGAVE.dome` (`y = 0`, so the lower half is below ground: fine for a dome) with `MeshStandardMaterial({ map: earthTexture })`, `rotation.y` such that the Pacific faces the open playa (eyeball). `earthTexture`: try `public/gta/earth.jpg` (download https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_2048.jpg (NASA Earth Observatory, "The Blue Marble: Land Surface, Ocean Color and Sea Ice", Reto Stöckli and Robert Simmon, NASA Goddard; 2048×1024, 267 KB, public domain; the old visibleearth.nasa.gov pages now redirect to https://science.nasa.gov/earth/earth-observatory/collections/blue-marble/, where the Next Generation 5400×2700 map is the fallback: `sips -z 1024 2048 in.jpg --out public/gta/earth.jpg`); keep it under 400 KB; record the URL in `public/gta/CREDITS.md`); if the download is not possible, make a 1024×512 canvas texture in code from `drawAgave`'s land polygons (an equirectangular guess is fine: ocean gradient `#1f4f9a→#5aa0e0`, the polygons from PlayaWin's `land()` calls projected as if they were a polar map of the north: `lat = 90 - f·90`, `lon = a`) — say which you did in the commit. The Moon dome: `SphereGeometry(30, 32, 24)` at `AGAVE.moon` with a 512×256 canvas texture (grey gradient + the crater circles from `drawAgave`). The pink ring: `TorusGeometry(72, 1.5, 8, 64)` flat at 0.5 ft, emissive pink, hue-cycling at night. The stage/bay: as 2.2 with Agave's `stage` = the dome, so skip the cylinder.

**2.5 Art cars in `rides.ts` (4 h)**: a `CarMesh` = `Group` with a hull `Box(34, 12, 64)` for ordinary cars and sized from the roof extents `(w, l)` of 2.1 for the rest (the Dragon Lady `Box(40, 14, 132)` with a white superstructure `Box(20, 10, 60)` on top; the Golden Ticket `Box(10, 7, 20)`, `VEHICLES.artcar`), a dark skirt `Box(36, 2, 66)` at 1 ft, six wheel cylinders, and the roof `PlaneGeometry(w, l)` at the hull's height + 0.1 with `carRoofTexture(id)` (decal rule: `rotation.x = -π/2`, image nose at the top). The hull's colour: sample the roof canvas's centre pixel (`getImageData(canvas.width / 2, canvas.height / 2, 1, 1)`) once; keep refreshing the Dragon Lady's roof at 10 Hz whatever its distance until a draw has happened with its PNG loaded. Make one `CarMesh` per mutant in `MUTANTS` (54; `ART_CARS` has exactly those 54 ids, and a parked car is one of them, placed by `npcAt`). Per frame: `const mine = drivenKey(); for (const m of MUTANTS) { if (m.key === mine) { hide } else { const p = npcAt(m, g.t); set position (p.x, 0, p.y), rotation.y = -p.h } }`. Parked cars: `npcAt` already returns the parked pose (it checks `parkedCars` first), so nothing special. The one you drive: `g.vehicle === "found"` → the player's ride mesh is the `CarMesh` for `drivenKey()` (reuse the same mesh object, moved to `g.car`), and the generic ride box is hidden.
- The plain rides (bike, e-bike, unicycle, tuktuk, Golden Ticket as `artcar`) in 2.6.
- Check: `/dragonlady?view=chase`: you are at the wheel of the long yacht, its pride flag and radar painted on the roof, bikers packed behind (phase 3 draws them); hop off (`R` → garage → hop off): it stays parked, you are on the bike beside it; drive Robot Heart from the garage after finding it.

**2.6 The player's rides (3 h)** in `rides.ts`, all in local frame (forward −Z), heights from the ground:
- bike / e-bike (`len 16, wid 7/8`): two wheel `CylinderGeometry(2.4, 2.4, 0.8)` rotated `z = π/2` at `z = ±6`, a frame `Box(0.8, 3, 11)` at 3.5 ft in `#ff6b9a` (e-bike `#2f8fd0`, fatter wheels r 3), a rider: `CapsuleGeometry(1.4, 4)` torso at 6 ft leaning 20° forward, a sphere head r 1.3 with a straw-hat `CylinderGeometry(2.2, 2.2, 0.3)`; brake light `Box` red when `view.brake`.
- unicycle: one wheel r 2.6, a post, the rider sitting tall.
- tuktuk (`14×8`): a bike as above + a trailer `Box(7, 6, 7)` with a rounded canopy (`CylinderGeometry(3.6, 3.6, 7, 12, 1, false, 0, π)` lying along Z) in `#2f9e5a` with a yellow skirt, 2 wheels. (Collin asked on 2026-10-26 for the tuktuk to become a bike with a little covered trailer; match that.)
- Golden Ticket (`artcar`, `20×10`): `Box(10, 7, 20)` in gold `#e8b923` with a cab `Box(9, 6, 7)` at the front, a bus seat, a speaker stack at the back, LED skirt emissive at night (reuse `drawGoldenTicket` as a roof decal on top).
- the plane (`30×34`): fuselage `CylinderGeometry(2.2, 1.4, 30, 12)` along Z, wings `Box(34, 0.6, 6)` at the middle, tail fin, a propeller disc that spins with `t`; position `y = 3 + g.alt`; `g.plane` (the one you bailed out of) is a second instance.
- the chute: the rider hanging under a `SphereGeometry(14, 16, 8, 0, 2π, 0, π/2)` canopy 22 ft above, 8 `Line`s; `y = g.alt`.
- shadow: a flat dark disc `CircleGeometry(len·0.6)` at `y = 0.4` under the ride, opacity `0.25 / (1 + alt/600)`, offset `(+alt·0.5, +alt·0.4)` in game axes like the 2D (sun from the upper left).
- The dust angel maker (`g.angelT > 0`): lay the rider flat; the angels (`g.angels`): flat decals with a canvas of `drawDustAngel`.
- Check: `V` → the garage, pick each ride: it changes under you; `/88nv?view=chase` or no path: you are in the plane on the pad, gas to roll, it lifts past 30 mph, the ground drops away and the camera trails up behind (section 3's air view); `R` bails out, the chute opens, you land, the garage opens.

**2.7 Phase 2 acceptance:** the checks in 2.2–2.6; draw calls under 150 in the city with everything on; `npm test`; gate. Commit after 2.1+2.2, 2.3, 2.4, 2.5, 2.6.

### Phase 3: people (≈ 8 h)

**Goal:** the city is as busy as top-down: about 1,720 NPCs (611 bikes, 40 e-bikes, 494 walkers: 400 along the street kerbs and 94 on loops round the Man, 54 art cars, 4 ambulances, and 8 to 12 pack bikers behind each art car, about 520 to 580; the exact total varies with the seed), the crowds dancing at the stages, the packs behind the art cars, the Dragon Lady's riders.

**3.1 `people.ts` (4 h)**: four `InstancedMesh`es: `bike` (a merged geometry: 2 wheels r 2.4 + frame + rider capsule + head, about 60 triangles), `ebike` (same, blue, fatter wheels), `walker` (`CapsuleGeometry(1.2, 4.2)` + head + a hat, ~40 tris), `ambulance` (`Box(14, 9, 28)` white with a red stripe, emissive red/blue strobing at night). Counts from `g.npcs.filter(kind)` at mount (the NPC list is fixed for a game; rebuild if `g.npcs !== lastNpcs`). Per frame, for each NPC `n` with its index `i` in its kind's mesh: `p = npcAt(n, g.t)`; if `dist(p, cam) > 900` set a zero matrix, else `dummy.position.set(p.x, 0, p.y); dummy.rotation.y = -p.h; setMatrixAt(i, …)`; per-instance colour from `n.hue` once at mount (`setColorAt`). Walkers bob: `dummy.position.y = 0.3·|sin(g.t·6 + i)|`. The art car you drive is skipped (`n.key === drivenKey()`), as `paint()` does. Pack bikers (`n.lead`) come from `npcAt` as everyone else.
- Check: the same bikes pass on the Esplanade in both modes (switch with `C`: a biker beside you is in the same spot); walkers keep to the kerbs; the pack bikers trail the art cars and, behind the car you drive, pull up in rows of four when you stop (the simulation does this: `stepPack`/`packSlot` in `playa.ts`, landed 2026-10-26; `npcAt` returns their positions like everyone else's).

**3.2 Crowds (2 h)**: `drawCrowd` in PlayaWin is deterministic from `sp.key` (a seeded generator). Port that generator into `src/lib/view3d.ts` as `crowdSpots(sp): { x, y, hue, dancing, phase, rate }[]` (same constants: `n` = agave 34, a spot with `sp.camp?.piece` 8, other kind "art" 12, everything else 20; the seed `h = (h * 31 + charCode) >>> 0` over `sp.key` and the generator `h = (h * 1664525 + 1013904223) >>> 0`, `rnd = h / 4294967296`; per person the draws in order are `a`, `d`, `hue`, `ph`, `rate`, then `dancing = rnd() < 0.72`; `a = dir + (rnd() - 0.5) * 3.2`, `d = st.r + 5 + rnd() * 16`, `dir = atan2(mid.y - st.y, mid.x - st.x)`) with a test that Agave's crowd has 34 people, all within `stage.r + 21` of the dome and within 1.6 rad of `dir` (about 2,860 people over all `SPOTS`). One `InstancedMesh` of the walker geometry for all crowds (≈ 3,000 instances) with per-instance colour; per frame only the crowds within 600 ft get their `y` bobbed (`dancing ? 0.6·|sin(t·rate + phase)| : 0`) and arms up is skipped (no arm bones; fine).

**3.3 MOOP and dust (1 h)**: MOOP (`g.moop`, 80): `InstancedMesh` of `Box(6, 1, 3)` (the 2D draws 6 × 3 ft) in three colours, glinting (`emissive` pulsing). Wheel dust (`g.dust`, ≤160): `InstancedMesh` of a `PlaneGeometry(1, 1)` billboard (set each instance's rotation to face the camera: copy `camera.quaternion`) scaled by `2·d.size` (the 2D circle's diameter), opacity `0.55·max(0, d.life)` (use `setColorAt` alpha via a custom `onBeforeCompile`? simpler: `THREE.Sprite`s pooled, 160 of them, `material.opacity` per sprite).

**3.4 Phase 3 acceptance:** 60 fps on a laptop with everything on at 6:00 & A (the densest spot); the NPC updates take under 2 ms a frame (measure with `performance.now()` round the loop, dev key); gate. Commit after 3.1, 3.3.

### Phase 4: light, night, weather, the trip (≈ 10 h)

**4.1 `lights.ts` (4 h)**: 
- **Light units:** every intensity in this plan (here, in 0.5's spike lights, in the PointLight and SpotLight numbers below) was written in three.js's old "legacy" units. Since r155 lights are physical (a face lit by intensity 1 comes out at 1/π of its colour), and the phase-0 lights are π/2 times the 0.5 numbers. Treat the plan's intensities as legacy units to recalibrate by eye, not values to copy.
- Day: `DirectionalLight` sun intensity `1.3·(1 - night)` from a direction that moves with `g.dayT` (`elevation = 70° at noon → 5° at dusk` over the day fraction `f = (dayT/DAY_SECONDS) % 1`; `nightLevel` is 0 for `f < 0.4`, ramps to 1 by 0.5, back after 0.9); `HemisphereLight` sky `#cfe3f5`→`#1b1f3b` and ground `#e6d3ae`→`#0a0c24` lerped by `night`; `scene.background` gradient texture lerped by night (sky `#8ec5fc→#0a0c24`, horizon `#f6ead2→#2a2440`); `scene.fog` colour likewise, `near 2500 → 900`, `far 14000 → 5000` at night.
- Night: every material flagged emissive in the tables gets `emissiveIntensity = night·k`; the ride's headlight: `SpotLight(#fff3b0, 2·night, 260, 0.45, 0.5)` at the nose, target 200 ft ahead; `PointLight`s for the **8 nearest** of: stages (`sp.stage`, hue, 120 ft), the Man (`#7df9ff`, 340), the Temple (`#ffbe78`, 260), Agave's dome (pink, 200), the art pieces (hue, `a.r·2.6`), Center Camp (`#ffd28c`, 240): recompute the set every 0.5 s, move the same 8 light objects (lights are expensive; never create per frame). Art cars within 300 ft: their roof textures already glow (the drawings do it with `night`); add one `PointLight` on the nearest 2.
- Check: `N` flips to night: the sky darkens, the arches and stages glow, your headlight sweeps the street, the Man glows blue ahead; nothing is pitch black within 300 ft of a light.

**4.2 Storms (1 h)**: `storm = stormLevel(g.storm)`: fog colour → `#e6d3ae`, `near = 70 + (1 - storm) * 2430`, `far = 300 + (1 - storm) * 13700`; the overlay (2.3) still draws the streaks. Check: wait for a storm (or set `g.storm = { phase: "rising", t: 0, hold: 0 }` from the console via the fiber trick in section 6; `stormLevel` is 1 at once for phase `"storm"`, the 3-s ramp is `"rising"`): the whiteout closes in over 3 s, holds 7 to 14 s and blows over in 3 s.

**4.3 The trip (3 h)** in `fx.ts`: `const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 }); const composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera)); composer.addPass(afterimage); /* bloom when night > 0.3 */ composer.addPass(new OutputPass());` (all from `three/examples/jsm/postprocessing/…`, part of the three package; `OutputPass` must be last or the composer's linear output is never converted to sRGB and the picture jumps darker whenever the composer switches on; `samples: 4` keeps the antialiasing the plain renderer has) with `afterimage.damp = 0.84 + 0.12 * trip` set each frame; the composer is used only while `trip > 0` (else `renderer.render` directly). The hue rotation and the roll stay as CSS on the canvas (already done in 2.3). Night bloom: `UnrealBloomPass(res, 0.55·night, 0.4, 0.85)` on desktop only (`!view.touchUi`), used only while `night > 0.3`. If two passes together cost more than 4 ms on the laptop, switch to the `postprocessing` package (section 9), which merges bloom and hue into one pass but has no afterimage effect (that one would have to be hand-written as an `Effect` with a feedback target); otherwise do not add it.
- Check: `T`: trails behind every moving thing and the playa breathes; `T` again: gone within 2 s; at night on a laptop the LEDs bloom softly.

**4.4 Phase 4 acceptance:** night, storm and trip read like the top-down versions; 60 fps by day and at night on a laptop, 50+ on the phone (phase 5 tunes); gate.

### Phase 5: phone (≈ 8 h)

**5.1 Camera-relative stick (1 h)**: section 2.5 in `stickMove`. Check on a phone (or the pane at 390×844 with pointer events): pushing the stick straight up drives the way the camera looks, even mid-turn.

**5.2 Orbit (2 h)**: in PlayaWin, a second pointer on `.pl-stage` (not on a button, the stick or the pads: `e.target === board.current`) or a right-button drag on desktop sets `orbitRef.current += dx·0.006` while down and eases to 0 at `1 - e^(-dt/0.6)` after up; `camGoal` turns the back vector by `orbit`; `Q`/`E` keys nudge it ±0.6 while held (E is "take the plane / drive" today: use `Q` only, or `[`/`]`).

**5.3 Resolution and memory (3 h)**: the dynamic pixel ratio from section 4; `touchUi` caps dpr at 1.5 and turns shadows off; textures: the city map texture on phones uses the 1536 canvas `cityImage()` already makes; measure `renderer.info.memory` in the console on an iPhone (Safari web inspector) and keep textures under 40 MB; `webglcontextlost`/`restored`: rebuild everything from the builders (they are deterministic) and re-render; test by backgrounding the tab for a minute.

**5.4 Layout (1 h)**: the camera button is hidden on phones in `.pl-tools`? No: keep it (it is the way to switch). The minimap stays top-right as now. `playa.css`: nothing else changes.

**5.5 Phase 5 acceptance:** 60 fps on an iPhone 13 or newer riding down the Esplanade by day, 45+ at night; no context loss on backgrounding; the stick drives camera-relative; gate.

### Phase 6: ship (≈ 4 h)

- The camera button, the `C` key, the title card's controls line, `aria-label` text in the stage mentions `C`.
- `public/gta/CREDITS.md` lists three.js (MIT), any texture source (NASA), nothing else.
- The dev key (`P`, 1.3) stays gated behind `import.meta.env.DEV`.
- A last pass over `npm run build` sizes: main chunk unchanged ±30 KB gzip; `three-*.js` + `renderer-*.js` together under 900 KB gzip (three with the example passes is about 130 KB gzip, about 165 KB with GLTFLoader + MeshoptDecoder).
- README (if there is one) gets a line: `?view=chase` for the chase camera.
- Gate, push, confirm live, then open `https://burningman.chat/?view=chase` and `https://burningman.chat/dragonlady?view=chase` on a phone and a laptop and write down what you saw in the final report.

Total: about 70 hours, in this order (plus phase 7, real models, in section 10: about 14 more). Each phase is usable on its own behind `?view=chase`.

---

## 6. How to check things in the browser (for an agent)

- Start the dev server: `npm run dev -- --port 5177`; open `http://localhost:5177/<place>?view=chase` (`/disorient`, `/dragonlady`, `/the-orb`, `/88nv`, `/goldenticket`, or nothing for the airport). Click "start driving" (or press Enter).
- The game object is reachable from the React fiber of the `.pl` element for teleporting and inspecting (used throughout this repo's own checks):
  ```js
  const el = document.querySelector('.pl'); const key = Object.keys(el).find(k => k.startsWith('__reactFiber')); let g = null; const seen = new Set(); const q = [el[key]];
  while (q.length && !g) { const n = q.shift(); if (!n || seen.has(n)) continue; seen.add(n); let s = n.memoizedState, guard = 0; while (s && guard++ < 50) { const v = s.memoizedState; if (v && v.current && v.current.car && v.current.npcs) { g = v.current; break; } s = s.next; } if (!g) { if (n.return) q.push(n.return); if (n.child) q.push(n.child); if (n.sibling) q.push(n.sibling); } }
  g.ghost = true; g.car.x = 0; g.car.y = -3500; g.car.vx = g.car.vy = 0;   // teleport (ghost: no collisions)
  ```
  Use `await import('/src/lib/brc.ts?t=' + Date.now())` to get `polar`, `pointAt` etc. in the page.
- A hidden browser pane (the desktop app's preview tab when not fronted) counts as a hidden tab: the keys are released and the loop may pause. Front the tab or use a real browser window for timing numbers.
- Screenshots: compare top-down before/after the overlay lift (phase 0.7) at the same state. The page seeds from `Date.now()`, so reset the live game to a fixed seed first: `const { newGame } = await import('/src/lib/playa.ts'); Object.assign(g, newGame(7, undefined, 'airport')); g.t = 0;` (no `?t=` on `playa.ts`: it must be the same module instance the app uses, or you get a second `parkedCars`/`driven`; the `?t=` trick is fine for the pure `brc.ts`).
- Frame time: `performance.now()` deltas in the loop, printed on a dev key; `renderer.info.render.calls` and `.triangles` after `render()`.
- Chunk sizes: `ls -la dist/assets` after `npm run build`; gzip with `cat dist/assets/three-*.js dist/assets/renderer-*.js | gzip -c | wc -c` for the 3D code and `gzip -c dist/assets/index-*.js | wc -c` for the main chunk.

## 7. Risks and the answer to each

- **iOS Safari WebGL memory**: small textures, dpr cap, no shadows on phones, rebuild on context loss (5.3). Test on a phone at the end of phase 1 already (the city is the heavy part), not only in phase 5.
- **Bundle size**: dynamic import; the top-down mode never pays for three.js. Verify in phase 0.
- **Art fidelity**: stand-ins first so the mode works; every piece and car keeps its real drawing as a decal/roof, so it stays recognisable; better models later are per-piece commits.
- **Text in 3D**: no text meshes except sign boards near you; names stay DOM labels where they are (the HUD) and the street-corner labels are skipped in 3D (phase 1 may add them as small `labelTexture` boards at the corners within 300 ft if cheap).
- **The angle conventions** are the one place a cheap agent will lose a day: the two flat rules in 2.4 and `yaw = -angle`. The unit tests in 0.1 and the "3:00 on your right" check catch a mirror immediately; do that check before building anything else in phase 1.
- **Two canvases and input**: pointer and keyboard handling are on `.pl-stage`, above both canvases; nothing changes for input except the stick's frame (2.5).
- **The simulation's `t`**: `npcAt(n, g.t)` is pure; the 3D code must never cache NPC positions across frames except the instance matrices it writes.

## 8. Testing summary

- `node:test` (run by `npm test`): `view3d.test.mjs` (mapping, `readViewMode`, `groundFlats`, `campPrisms`, `crowdSpots`), `chaseCam.test.mjs` (goal numbers, no overshoot, yaw, block avoidance, air view). Everything in `src/lib/` that the tests import (all but `mobile.ts`, a React hook) imports with `.ts` extensions and touches no DOM or three.js; the new `view3d.ts` and `chaseCam.ts` keep to that.
- The browser checks per phase in section 5, done by hand or with Playwright (`npx playwright` is not installed; if you add it, as a devDependency only, and keep its screenshots out of git).
- Before every push: the gate (0.4). After every push: the live check (0.4).

## 9. Open source to lean on (checked on npm 2026-10-26)

**Dependencies to add**
- `three@0.186.1` (MIT): the renderer, `InstancedMesh`, `CanvasTexture`, `Fog`, `PMREMGenerator`, and from `three/examples/jsm`: `utils/BufferGeometryUtils.js` (merging flats), `postprocessing/EffectComposer.js`, `RenderPass.js`, `AfterimagePass.js` (the trip), `UnrealBloomPass.js` (night). `objects/Sky.js` is an option for the sky dome instead of the gradient cylinder. Everything needed ships in this one package.
- `@types/three@0.186.0` (MIT), devDependency.

**Only if measured to be needed**
- `postprocessing@6.39.5` (Zlib): merges bloom (`BloomEffect`) and hue/saturation (`HueSaturationEffect`) into one `EffectPass`, but it has no afterimage/trail effect, so the trip's afterimage would have to be a hand-written `Effect` with a feedback render target; add only if phase 4 measures over 4 ms for the two three passes on the laptop and you accept writing that effect.
- `three-mesh-bvh@0.9.16` (MIT): fast raycasts against meshes. **Not needed**: the camera's block avoidance uses `solidAt` from the simulation (pure, already tested), see section 3.
- `three-nebula` (MIT): particles. **Not needed**: fog does the storm, sprites do the wheel dust.

**Read for the feel, copy nothing**
- swift502/Sketchbook (MIT): a spring-damped chase camera in three.js; our `chaseCam.ts` constants are in that spirit.
- raphaelaxiom/raphael-drive (MIT): a three.js city driving game beside a React HUD; the same seam as ours.
- osoker/InfiniTownTS (no licence): instanced city blocks; read only.

**Assets (public domain / CC0; record each in `public/gta/CREDITS.md`)**
- NASA Blue Marble (public domain), the 2048×1024 land/ocean/ice JPEG at eoimages.gsfc.nasa.gov (the URL is in 2.4), for the Earth dome. Fallback: a texture generated in code.
- Kenney (kenney.nl, CC0) and Quaternius (CC0) low-poly vehicles and people, and poly.pizza (filter CC0): optional later upgrades for the NPC meshes; none are needed for this plan.

**Ruled out**: OpenRW (GPL-3.0, C++); anything from Sketchfab without reading its licence line (section 10 is the procedure for the ones that pass); anything with a logo or a brand.

## 10. Real 3D models: the Man, the Temple, art cars and pieces from Sketchfab and other CC sources (Phase 7, ≈ 14 h)

Asked 2026-10-26: "let's get those real models of the Man or the Temple and those Sketchfab models, how do we do that?" This phase runs after phase 2 (it replaces stand-ins one at a time) and never blocks anything: a model that is not found, not licensed right, or too heavy stays a stand-in. Everything here is per model: one commit each, each one revertable alone.

### 10.1 Licences: what may ship, what may not

- **Allowed**: CC0, CC BY 4.0 (needs attribution), CC BY-SA 4.0 (needs attribution; a *modified* model must be offered under the same licence: we modify by re-compressing, so the glb we ship is a derivative and `CREDITS.md` says it is available under CC BY-SA too; that is enough).
- **Not allowed, do not download**: CC BY-NC / BY-NC-SA / BY-NC-ND / BY-ND (the game is a fan project with no sales, so NC might be arguable, but the rule here is simple: no NC, no ND; ND forbids the re-compression anyway); Sketchfab's "Standard" and "Free Standard" licences (slugs `st` and `free-st`; no redistribution: they cannot be put in a public site's `public/` folder; the "Free" one does not start with "CC", so allow-list by slug, never deny-list); "Editorial" (news use only); anything with no licence line.
- **Logos and brand art**: still out, whatever the model's licence (a Robot Heart bus with the camp's logo painted on is fine as a *shape* only if the texture carries no logo; if it does, strip the texture and use a flat colour, or skip the model).
- Trademarks and the artists: a model *of* an artist's sculpture (Bliss Dance, the Orb) under CC BY is the modeller's licence to their mesh, not the sculptor's; that is the same position the game's drawings are already in. Keep the piece's artist and year in the game's data (they are, in `soundcamps.ts`) and credit both the sculptor and the modeller.

### 10.2 Finding models

**Sketchfab, in the browser** (fastest way to look): https://sketchfab.com/search?type=models&q=burning+man+temple then open the left filter: tick **Downloadable**, and under **Licenses** tick only *CC0*, *CC Attribution*, *CC Attribution-ShareAlike*. Search terms to try, in this order:

| what | search terms |
|---|---|
| the Man | `burning man the man`, `burning man effigy`, `the man burning man 2019` |
| the Temple | `burning man temple`, `temple of whollyness`, `temple of juno`, `temple of the heart`, `empyrean temple`, `temple of promise` |
| art cars | `mutant vehicle`, `art car burning man`, `robot heart bus`, `mayan warrior`, `el pulpo mecanico`, `dragon art car`, `party bus art car` |
| art pieces | `bliss dance`, `truth is beauty sculpture`, `r-evolution sculpture`, `the orb burning man`, `space whale burning man`, `embrace burning man`, `big rig jig`, `lodestar`, `tree of tenere`, `shrumen lumen`, `elder mother`, `penny the goose` |
| generic fill (CC0, no search needed) | Kenney Car Kit / City Kit (kenney.nl), Quaternius vehicles and people (quaternius.com), poly.pizza with the **CC0** filter: RVs, vans, bicycles, a geodesic dome, a tuk-tuk |

Expect few hits for the specific pieces; most will be fan models of the Man and a temple or two. That is fine: the Man and the Temple are the two the plan most wants.

**Sketchfab, by API** (to list candidates without clicking): the Data API v3 (docs: https://docs.sketchfab.com/data-api/v3/index.html). Search needs no token:

```bash
curl -s "https://api.sketchfab.com/v3/search?type=models&q=burning+man+temple&downloadable=true&sort_by=-likeCount&count=24" \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const m of JSON.parse(s).results)console.log(m.uid, m.license?.label, m.faceCount, m.name, "https://sketchfab.com/3d-models/"+m.uid)})'
```

Keep only rows whose `license.label` is `CC0 Public Domain`, `CC Attribution` or `CC Attribution-ShareAlike` (search rows carry only `license.uid` and `license.label`; the slugs `cc0`, `by`, `by-sa` and the licence `url` come from `GET /v3/models/{uid}`). To let the server filter, add `&license=cc0`, `&license=by` or `&license=by-sa` (one value per request, so run the search three times). Confirm on the model page before downloading: the page's "License" line is the authority. `faceCount` is triangles: prefer under 60k for a landmark, under 30k for an art car, under 20k for a piece; anything over 200k is not worth the compression fight.

### 10.3 Downloading (the token never enters the repo)

1. Make a Sketchfab account (free), then an API token: Settings → Password & API → API token. Store it outside the repo: `mkdir -p ~/.config/gta-brc && echo "<token>" > ~/.config/gta-brc/sketchfab-token && chmod 600 ~/.config/gta-brc/sketchfab-token`. Never paste it into a file under `~/Code/gta-brc`, a commit message, or chat. (`.gitignore` must list `.env`, `.env.*` and `scripts/models/raw/` — add them if missing.)
2. The download endpoint needs the token and returns short-lived links (they expire in a few minutes; `expires` is seconds):

```bash
TOKEN=$(cat ~/.config/gta-brc/sketchfab-token); MODEL=<model uid>   # not UID: that name is read-only in bash and zsh
curl -s -H "Authorization: Token $TOKEN" "https://api.sketchfab.com/v3/models/$MODEL/download"
# → {"gltf":{"url":"https://…zip","size":…,"expires":…},"glb":{"url":"…glb","size":…,"expires":…},"usdz":{…}}
```

3. Prefer the `glb` link when present (one file); otherwise the `gltf` zip (a folder with `scene.gltf`, `scene.bin`, `textures/`). Download into `scripts/models/raw/<slug>/` (git-ignored, untrusted input: never run anything from inside it), unzip with `unzip -o`.

Write this once as `scripts/models/fetch.mjs` (Node 22, `fetch`, reads the token from `~/.config/gta-brc/sketchfab-token` or `$SKETCHFAB_TOKEN`, takes `<uid> <slug>`, saves the glb or the unzipped gltf, and prints the model's `name`, `user.displayName`, `user.profileUrl`, `license.slug`, `license.label`, `license.url` and `viewerUrl` from `GET /v3/models/{uid}` so the credits line is captured at the same moment; it refuses to download unless `license.slug` is one of `cc0`, `by`, `by-sa`). Usage: `node scripts/models/fetch.mjs <uid> the-man`.

### 10.4 Converting and compressing (target: under 2 MB per model, textures at 1024)

Use glTF Transform's CLI (MIT):

```bash
npm install --save-dev @gltf-transform/cli@4   # pinned to the 4.x line; run with npx
npx gltf-transform inspect scripts/models/raw/the-man/scene.gltf            # triangles, textures, sizes before
npx gltf-transform optimize scripts/models/raw/the-man/scene.gltf public/models/the-man.glb \
  --compress meshopt --texture-compress webp --texture-size 1024 --simplify true --simplify-ratio 0.5 --join true
npx gltf-transform inspect public/models/the-man.glb                         # after: check the numbers in 10.7
ls -la public/models/the-man.glb
```

- `--compress meshopt` (EXT_meshopt_compression) is preferred over Draco because three.js decodes it with `MeshoptDecoder` from the package itself; Draco needs its decoder files copied into `public/draco/` from `node_modules/three/examples/jsm/libs/draco/gltf/` and `DRACOLoader.setDecoderPath("/draco/")`. If a model only compresses well with Draco, do that and say so in the commit.
- `--texture-compress webp` writes EXT_texture_webp (Safari 14+, Chrome, Firefox all decode it); `--texture-size 1024` caps every texture; drop to 512 for art cars.
- `--simplify-ratio` is the target fraction of vertices to keep (0 to 1), bounded by `--simplify-error` (default 0.0001 of the mesh extent, so the ratio is often not reached: if `inspect` shows the triangle count barely dropped, add `--simplify-error 0.01`); raise the ratio toward 1 if the silhouette breaks (the Man's limbs, a temple's lattice). `--join` (needs `--flatten`, on by default) merges meshes sharing a material so a model is a handful of draw calls.
- If the raw file is a `.glb`, the same `optimize` command takes it as input. If the result is still over 2 MB: `--texture-size 512`, then `--simplify-ratio 0.3`, then give up and keep the stand-in.
- A model that is in metres (most are) is scaled at load (10.6), not here: the glTF Transform CLI has no scale command (only `center` for the pivot and `resize` for textures), so keep the raw geometry untouched and let `loadModel` scale it; a later re-optimize then starts from the same place.

### 10.5 Where they live and how they are described

- Files: `public/models/<slug>.glb`, one per model; slugs match the game's ids where there is one (`the-man`, `the-temple`, `robot-heart`, `bliss-dance`, …).
- `public/models/manifest.json`, committed, one entry per model, read by the loader and by the credits screen:

```json
{
  "the-man": { "file": "/models/the-man.glb", "height": 60, "yaw": 0, "lift": 6, "author": "<display name>", "authorUrl": "https://sketchfab.com/<user>", "url": "https://sketchfab.com/3d-models/<uid>", "title": "<model title>", "license": "CC BY 4.0", "licenseUrl": "https://creativecommons.org/licenses/by/4.0/", "changes": "re-compressed with glTF Transform (meshopt, WebP 1024)" }
}
```

  `height` is the target height in game feet (the model is scaled uniformly so its bounding box is that tall), or `length` for an art car (scaled so its longest horizontal side is 64 ft, the drawings' box) or `width` for a flat piece; `yaw` in game radians to turn the model's own forward to the game's north (eyeball once and write it down); `lift` feet to raise it (a figure on a base: the base's top).
- `public/models/CREDITS.md`, committed, generated from the manifest by `node scripts/models/credits.mjs` so the two never drift: one line per model: title, author (linked), source URL, licence (linked), changes made. Also list three.js and glTF Transform there.
- Targets per model (what the manifest's `height` should be): the Man 60 ft figure on a 6-ft base (`lift` 6, the base is the existing cylinder); the Temple 90 ft; an art car `length` 64 (the Dragon Lady 132); Bliss Dance 60, Truth is Beauty 65, R-Evolution 60, Embrace 72, the Orb `width` 110, Space Whale `length` 80, Tree of Ténéré 70, Big Rig Jig 70, Lodestar 75, Shrumen Lumen 30.

### 10.6 Loading in the renderer

In `src/game/three/models.ts`:

```ts
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
// import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";   // only if a model used Draco (10.4)
export type ModelEntry = { file: string; height?: number; length?: number; width?: number; yaw: number; lift: number; author: string; authorUrl: string; url: string; title: string; license: string; licenseUrl: string; changes: string };
export async function manifest(): Promise<Record<string, ModelEntry>>;            // fetch("/models/manifest.json"), cached
/** The model for a slug, scaled to its manifest target, turned by yaw, lifted; null when the manifest has no entry or the load fails (the caller keeps its stand-in). Cached by slug; a second call returns a clone (shared geometry) so 54 art cars cost one download. */
export async function loadModel(slug: string): Promise<THREE.Group | null>;
/** Swap a placeholder for the real thing when it arrives: keeps position/yaw, hides the placeholder, adds the model to the same parent. */
export function swapIn(placeholder: THREE.Object3D, model: THREE.Group): void;
```

- `loadModel` builds one `GLTFLoader` with `setMeshoptDecoder(MeshoptDecoder)`; after `loadAsync(file)`: `const s = gltf.scene; s.rotation.y = yaw; const size = new THREE.Box3().setFromObject(s).getSize(new THREE.Vector3());` then `scale = height / size.y` (or `length / Math.max(size.x, size.z)`, or `width / size.x`); `s.scale.setScalar(scale); s.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(s); const c = box.getCenter(new THREE.Vector3()); s.position.set(-c.x, lift - box.min.y, -c.z);` (`Box3.setFromObject` works in world space and already includes the scale: do NOT multiply `box.min.y` by `scale` again, that would put a 60-ft figure 33 times too low), then wrap `s` in a `THREE.Group` and return the group so `swapIn` places the group. Convert every `MeshStandardMaterial` to keep `envMapIntensity` 0.4 and cast/receive shadows per the phase 4 rules; set `frustumCulled = true` on each mesh.
- **Lazy and placeholder-first**: landmarks (the Man, the Temple) start loading when the chase renderer mounts; a piece or an art car when it first comes within 1,500 ft of the camera (`places.ts`/`rides.ts` call `loadModel(slug).then(m => m && swapIn(placeholder, m))` once, flag per slug). Until then the stand-in from phase 2 is shown; if the promise resolves null nothing changes. Never await a model inside `frame()`.
- Art cars: the model replaces the hull box but the **roof decal stays on top** only when the model has no roof detail of its own (manifest flag `"roof": true` keeps the decal); the pack bikers and parking use the simulation's radii regardless of the model's size, so a model that is much bigger than 64 × 34 ft must be scaled to `length: 64`, not to its real size.

### 10.7 Acceptance per model (write the numbers in the commit message)

- Licence is CC0, CC BY or CC BY-SA, checked on the model page, and the manifest's `license`/`licenseUrl` match it; `CREDITS.md` regenerated; the in-game credits screen (10.8) lists it.
- `public/models/<slug>.glb` under 2 MB (1 MB for an art car), textures ≤ 1024² (512² for art cars), under 60k triangles for a landmark / 30k for an art car / 20k for a piece, at most 8 meshes after `--join` (`gltf-transform inspect` shows all of this).
- Loads and swaps in within 2 s on broadband without a frame drop over 4 ms (the swap is one `add`; the decode is async); the stand-in is visible until then; with the file renamed away the stand-in stays and the console shows one warning, not an error loop (note: a missing static file is not a 404 here: the dev server and `vercel.json` both rewrite unknown paths to `index.html` with a 200, so `GLTFLoader` would try to parse HTML and `manifest()` would get HTML from `res.json()`; wrap `loadAsync` and `fetch(...).then((r) => r.json())` in try/catch, treat any error or non-JSON/non-glb body as null, and `console.warn` once per slug).
- Scale and placement: the Man's figure is about 60 ft tall over its base (check with `Box3` printed on the dev key), the Temple 90, an art car 64 long with its nose toward `-Z` before yaw (drive beside it: it faces the way it moves); nothing floats or sinks (feet at `lift`).
- Day and night both read: at night the model gets the same emissive/point-light treatment as its stand-in (phase 4), so a dark model is lit by the nearest lights, not black.
- `npm test` unchanged (nothing here is pure code except `manifest` validation: add `src/lib/models.test.mjs` that reads `public/models/manifest.json` and asserts every entry has a file that exists, a licence in the allowed set, a non-empty author and url, and exactly one of `height`/`length`/`width`).
- The 3D chunk grows by about 35 KB gzip (measured: GLTFLoader + MeshoptDecoder, whose wasm is inlined as base64, take a 129.5 KB lazy chunk to 165.1 KB); models are fetched, not bundled.

### 10.8 In-game credits

- The title/pause card gets a "credits" link (a `<button type="button" className="pl-btn" onClick={…}>credits</button>` inside `.pl-over-card` next to the `pl-go` button; TSX, so `className`) that opens a small DOM panel (`.pl-credits`, same style as the help list) listing: "GTA:BRC is a fan game. Built with three.js (MIT)." then one line per manifest entry: `<title> by <author> (link) · <licence> (link) · <changes>`; and the camp/art data credits already implied (iBurn data, as `soundcamps.ts`'s header says). Generated from `manifest()` at open time; no network until opened.
- CC BY's attribution asks for the author, the title, the source and the licence, and a note of changes: the manifest carries all five; `CREDITS.md` is the copy outside the game.

### 10.9 Fallback

When no suitable model exists for something (likely for most of the 23 pieces and most of the 54 cars): keep the phase 2 stand-in and the drawing decal. Do not substitute a "close enough" model of a different sculpture, and do not take a Standard-licence model "for now". A reasonable upgrade for the generic fill (RVs, vans, bicycles, a dome) is Kenney's or Quaternius's CC0 kits through the same manifest/loader with `--simplify` off (they are already low-poly); do that only if the camp instancing in phase 1 is measured to have headroom (under 100 draw calls in the city).

### 10.10 Steps and hours

| step | what | hours |
|---|---|---|
| 7.1 | `scripts/models/fetch.mjs`, `credits.mjs`, `.gitignore`, `public/models/manifest.json` (empty), `models.ts` loader with the placeholder swap, `models.test.mjs` | 4 |
| 7.2 | the Man: search, licence check, fetch, optimize, manifest entry, swap in `places.ts`, credits | 3 |
| 7.3 | the Temple: same | 2 |
| 7.4 | up to three art cars that are found (Robot Heart, Mayan Warrior, El Pulpo are the likeliest) | 3 |
| 7.5 | up to two pieces (the Orb, Bliss Dance are the likeliest), the in-game credits panel | 2 |

Total about 14 hours; stop early if the searches turn up nothing acceptable and say so: the stand-ins are the design, not a gap.

## 11. Appendix: the numbers an implementer will reach for

- `CITY_SCALE = 1.5`; `ARC_R` = [3750, 4410, 4785, 5160, 5535, 5910, 6285, 6660, 7035, 7410, 7785, 8085, 8385] ft (Esplanade, A…L); `ROAD_W = 72`, `WIDE_ROAD_W = 104` (= `ESPLANADE_W`); radials every 30 min from 120 (2:00) to 600 (10:00), wide ones 180/270/360/450/540; `MAN_R = 80`; `TEMPLE` at 12:00, 3750 ft, `TEMPLE_R = 120`; `CENTER_CAMP` at 6:00, 4080 ft, `CENTER_CAMP_R = 570`, `CAFE_R = 195`; `FENCE_R = 11400` (a pentagon, a corner at 12:00); the airport at 4:12, `FENCE_R·1.09`, runways 4,600 × 110 ft at `±140`; the Gate at 4:30, `FENCE_R·1.25`, Gate Road 110 ft wide from L street out to `FENCE_R·1.7`.
- `MAP_BOX = { top: -11550, bottom: 9375, half: 10950 }`; `cityImage()` is 2560² (1536² when `min(innerWidth, innerHeight) < 700`), `surroundImage()` (private to `citymap.ts`: export it in phase 1) is 1536² covering `AROUND = 4` times the city image's side.
- Vehicles (`VEHICLES`): bike 16×7, ebike 16×8, artcar (Golden Ticket) 20×10, fish 36×20, found 36×20, plane 30×34, tuktuk 14×8, unicycle 10×8; top speeds in ft/s: 147, 350, 350, 225, 200, 480, 210, 75 (`mph = ft/s / 7`).
- NPC radii `NPC_R`: bike 7, ebike 7, walker 5, artcar 24, mutant 32, ambulance 14; the art car drawings fit about 64 × 34 ft (the Dragon Lady drawing is 132 × 40: `artcars.ts` `L = 132, W = 40`; six others are wider than 34 and three longer than 66, see 2.1).
- Counts: 192 blocks, 40,081 camp structs (pod 7,357; flag 6,284; bikes rows 4,046; rv 3,334; arch 3,131; tent 3,112; rack 2,230; couch 1,887; dome 1,824; sign 1,746; speaker 1,303; carpet 1,267; shade 1,256; stage 648; canopy 604; potty 52); 172 `SPOTS`; 23 `ART` pieces; 54 `MUTANTS` (Discow added 2026-10-26); about 1,740 NPCs in a new game (it varies with the seed: 1,203 fixed = 611 solo bikes, 40 e-bikes, 494 walkers, 54 art cars, 4 ambulances, plus 8 to 12 pack bikers behind each art car; seeds 1 to 2000 gave 1,712 to 1,782).
- Agave: dome at (−3849, 886) r 70; the Moon at (−3887, 778) r 30; bay middle (−3737, 856); curb (−3656, 835).
- Day: `DAY_SECONDS = 240`; `nightLevel` 0 for the first 40 % of the day, 1 from 50 % to 90 %. Storms: 3 s ramps, 7–14 s hold, 70–140 s clear.
- Palette (`PlayaWin` `C`): playa `#e6d3ae`, speck `#d6c096`, road `#efe2c6`, block `#d8c095`, blockEdge `#c6ab7c`, navy `#1b1f3b`, pink `#ff6b9a`, coral `#ff9a8b`, sky `#8ec5fc`, lilac `#e0c3fc`, gold `#ffd27a`, fence `#f08a3c`, night `"10, 12, 36"` and dust `"230, 211, 174"` (bare RGB triplets used as `rgba(${C.night}, a)`; as three.js colours write `"#0a0c24"` and `"#e6d3ae"`), white `#fbf7ef`, potty `#3a6fd8`.
