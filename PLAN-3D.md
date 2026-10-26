# GTA:BRC in 3D — the chase-camera mode

Written 2026-10-26, reviewed the same day (open source to lean on added, first person dropped: the chase camera is the mode). A second way of seeing the same game: a third-person camera behind your ride, the way GTA puts you behind the car. The top-down game stays as it is; you switch between the two at any moment and the world, the music, the job on the pager and the people around you carry on exactly where they were.

## 1. What it is

- **One game, two renderers.** Everything that *is* the game lives in `src/lib/playa.ts` and its data (`brc.ts`, `camps.ts`, `soundcamps.ts`, `artmedia.ts`): the city, the physics, the NPCs, parking, jobs, the music mix. None of that changes. The 3D mode is a new way of drawing the same `Game` object, and the same input drives it.
- **The view.** The view for this new mode is a chase camera: behind and above the ride, looking a little ahead of it, pulling back with speed, swinging round as you turn, the horizon showing the mountains and the Man on the skyline. 
- **Switching.** A camera button in the tools (next to day/night and the trip), the C key, and `?view=chase` or `?view=top` on any place URL (`burningman.chat/dragonlady?view=chase`). The choice is remembered per device. Switching is instant: no reload, no reset.
- **Everything you can do stays.** Ride, hop on art cars, drive the ones you find, fly the plane, bail out under the chute, park at a camp and get its panel, the pager jobs, MOOP, day/night, storms, the trip. The HUD, the panel, the minimap and the big map are the same DOM over a different canvas.

### Not in this plan
- No new gameplay. No shooting, no missions beyond the pager's, no interiors.
- No new art pipeline. The 3D world is built from the data and drawings we already have, upgraded piece by piece later.
- Not a replacement. Top-down remains the default until the 3D mode is as smooth on a phone.

## 2. How it fits the code

```
src/lib/*            the simulation and its data              (unchanged)
src/game/PlayaWin.tsx the window: HUD, panel, input, the loop  (small changes: a Renderer slot, the switch)
src/game/paint2d.ts  today's paint() and its helpers           (moved out of PlayaWin, otherwise untouched)
src/game/three/      the 3D renderer                           (new, loaded on demand)
  renderer.ts        Renderer: mount, resize, frame, unmount
  world.ts           builds the static scene from brc/camps/soundcamps: ground, streets, blocks, landmarks
  places.ts          the sound camps' stages and bays, the art pieces, Agave's domes
  rides.ts           your ride, the art cars (driven and roaming), bikes, walkers, the plane and chute
  camera.ts          the chase camera, the spring that follows you, the orbit for a look round
  sky.ts             sun, sky dome, the mountains on the horizon, night, dust
  fx.ts              post passes: the storm's whiteout, the trip's afterimage, bloom at night
  sprites.ts         the existing 2D drawings rendered to textures (art cars, pieces, bikes, people)
```

**The Renderer interface** is the one seam:

```ts
type Renderer = {
  mount(canvas: HTMLCanvasElement): void;
  resize(w: number, h: number, dpr: number): void;
  frame(g: Game, view: ViewState, dt: number): void;   // draws one frame of this game state
  project(p: Vec): { x: number; y: number } | null;    // world → screen, for the clip peek and labels
  unmount(): void;
};
```

`PlayaWin` keeps its loop (step the game, update the camera lead, read the HUD) and hands the drawing to whichever renderer is mounted. `paint()` becomes `TopDownRenderer.frame()`. The 3D renderer is a dynamic import so the top-down bundle does not grow; the first switch shows a one-line "loading the 3D view" in the flash and takes about a second on a phone.

**Library.** three.js, pinned, used directly (no react-three-fiber: the game loop already owns the frame, and the DOM HUD stays React). WebGL 2 required; without it the camera button is hidden and `?view=3d` falls back to top-down with a note.

## 3. Building the world from what we have

Units stay the game's feet (`CITY_SCALE` applied). Y is up in three.js; the game's `y` becomes `-z`, so the playa plane is `(x, 0, -y)` and headings map straight across.

### Ground and city
- **The playa**: one big plane with the painted `cityImage()` from `citymap.ts` as its texture (the same canvas, turned into a `CanvasTexture`), plus the surround image beyond the fence. The speckle becomes a tiling detail texture multiplied in. This gives the satellite look at no extra cost.
- **Streets**: flat ribbons a hair above the plane along `ARC_R`/`RADIALS` from `brc.ts`, the packed-dust colour, so the lanes read at road level and the camp blocks sit between them.
- **Blocks and camps**: `camps.ts` already plans every block's structures (RVs, shiftpods, tents, shades, canopies, domes, stages, speakers, flags, arches, potties, signs). Each kind becomes a primitive with a height: RV = box 10 ft tall, pod = low hexagonal dome, tent = pyramid, shade = flat roof on four poles, dome = geodesic (icosahedron detail 1), stage = box, flag = a quad that waves. All instanced per kind (`InstancedMesh`), coloured by the plan's hue. Thousands of instances in a handful of draw calls.
- **Landmarks**: the Man as a 40-ft figure on a base (the same stick figure the top-down draws, extruded), the Temple as the octagon with a central tower, Center Camp as the big round shade, the fence as posts and a line, the airport's runways and hangars, Rod's Road and the Gate Road from the map.
- **Agave Lounge**: the Earth dome as a textured sphere (the globe texture is the natural win of 3D: a real equirectangular map wraps it), the Moon dome beside it, the pink ring, the bay.

### Places
- **Sound camps**: the stage as a low platform with a speaker stack and a DJ booth, the parking bay as the pink dashed outline on the ground, the crowd as billboard people (see below) dancing in front. The bay and the panel logic are untouched: `inBay` and parking work on the same coordinates.
- **Art pieces**: start with a billboard of each piece's top-down drawing laid flat on the ground (a decal) plus a simple 3D stand-in by category: figures (Bliss Dance, Truth is Beauty, R-Evolution, Embrace, REAL LOVE, Tara Mechani) as tall capsules with arm cylinders; the Orb as a mirrored sphere (`MeshStandardMaterial` with the sky's environment map); trees (Elder Mother, Tree of Ténéré) as a trunk with an emissive canopy of points; Big Rig Jig as two bent cylinders; Lodestar as a cone on its tail; the Observatory's domes as hemispheres; mushrooms as caps on stems; the dragon and the flytrap from stacked ellipsoids. Each is one small function in `places.ts`, the way `artpieces.ts` has one per piece. Better models later, one piece at a time, without touching anything else.
- **Art cars**: the existing top-down drawings, rendered once to a canvas each, become the **roof texture** of a box the car's length and width, 12 ft tall, with the side faces in the drawing's dominant colour and a dark skirt for the wheels. The Dragon Lady's sprite goes on a longer, lower hull with a white superstructure box. The animated parts (LED chases, fire, lasers) keep animating because the texture is re-rendered a few times a second while the car is near you. This reuses every drawing we have.

### People and rides
- **You**: the cruiser, e-bike and the found art cars as above; the plane as a low-poly body with wings; the chute as a canopy quad above you.
- **NPCs**: bikes and walkers are billboards (camera-facing quads) using the existing pixel art rendered to a sprite sheet, with a ground shadow blob. Hundreds of them in one instanced draw. Art cars roaming use the box-with-roof-texture above. Packs of bikers behind art cars come from `npcAt` as now.

### Light, night, weather, the trip
- **Day**: a sun (directional light with a soft shadow map only for the near 600 ft), a hemisphere light sky/dust, a sky dome with the mountain silhouette on the horizon.
- **Night**: the sun goes down with `nightLevel`; LEDs and stage lights become emissive; point lights at the stages, the Man, the Temple, Agave's domes and the art pieces (capped at the 8 nearest, the rest emissive only); bloom pass; headlight as a spot light. The light-map idea of the 2D night maps straight onto real lights.
- **Dust storm**: scene fog driven by `stormLevel`, the same whiteout.
- **The trip**: an afterimage post pass (the previous frame blended back in, a little scaled and turned, exactly the 2D effect), hue rotation and a slow camera roll in the same shader pass.

## 4. The camera

- **Chase**: a target 14 ft behind and 7 ft above the ride, looking at a point 20 ft ahead plus half the velocity vector, so you see where you are going. Position follows by a critically damped spring (no overshoot) with a time constant of 0.18 s; the look target with 0.08 s. Field of view 62°, widening to 70° at top speed. Collisions: if a camp block sits between the camera and you, the camera slides up and in (sphere cast against the block boxes). In the plane the camera trails further and the ground drops away.
- **Touch**: the stick drives as now (stick direction is world-relative today; in 3D it becomes camera-relative, pushing "up" means "forward along the view", which is what the chase view implies). A second finger drag orbits the chase camera for a look round; it springs back when released.
- **Keyboard**: C switches top-down ↔ chase. Q/E or right-drag orbit the chase camera.

## 5. Mode switch and state

- `ViewMode = "top" | "chase"`, stored in `localStorage` (`agentcamp-playa-view`) and settable with `?view=top` or `?view=chase`.
- The switch mounts the other renderer on the same canvas element (WebGL context on a second canvas stacked under the HUD, so the 2D context is not lost; the inactive canvas is hidden and its loop skipped).
- The minimap and the big map keep drawing from the 2D code (they are the 2D code).
- The camera lead and safe-box logic in `PlayaWin` apply only to top-down; the chase camera has its own in `camera.ts`.
- The clip peek and name labels use `renderer.project()` so they float above the right place in either view.

## 6. Performance budget (a 2022 iPhone at 60 fps)

- Draw calls under 150 in the city, under 60 on the open playa. Everything repeated is instanced.
- Triangles under 300k in view; camp structures are 12–80 triangles each, instanced; NPC billboards 2 each.
- Textures: the city map 2048², the surround 1024², the sprite sheet 2048², art car roofs 256×128 each kept in an atlas; total under 40 MB of GPU memory.
- Device pixel ratio capped at 2; dynamic resolution scaling if a frame takes over 20 ms for a second.
- Frustum culling by the engine, plus distance culling: structures past 1,500 ft are not updated, people past 900 ft not drawn.
- No shadows past 600 ft; one shadow map, 1024².
- The three.js chunk about 650 KB gzip, loaded only on first switch.

## 7. Milestones

| Phase | What ships | Done when | Days |
|---|---|---|---|
| 0 Spike | Renderer seam, three.js chunk, the playa plane with the map texture, your bike as a box, the chase camera, the switch behind `?view=chase` | you ride round the city in 3D, the HUD and music work, switching back and forth loses nothing | 1 |
| 1 City | streets, instanced camp structures, the Man, the Temple, Center Camp, the fence, the airport, the sky and mountains | the city reads as Black Rock City from the chase camera; 60 fps on a laptop | 2 |
| 2 Places | stages, bays, crowds, art pieces (stand-ins + decals), Agave's domes with the globe, art cars with roof textures incl. the Dragon Lady | you can stop at any camp or piece, the panel opens, the art cars roam and you can drive them | 3 |
| 3 Rides and people | the plane, the chute, e-bikes, NPC billboards, packs behind art cars, your found art car at full scale | the plane flies and lands, bail-out works, the city is as busy as top-down | 2 |
| 4 Light and effects | night with real lights and bloom, the storm's fog, the trip's post pass, the headlight | night, storms and the trip match the top-down feel | 2 |
| 5 Phone | camera-relative stick, orbit drag, resolution scaling, memory check on iOS Safari | 60 fps on an iPhone 13, no context loss on backgrounding | 1 |
| 6 Ship | the camera button and C key, remembered choice, the title card's controls line, a URL in the README and the roadmap | the mode is on burningman.chat for everyone, top-down still the default | 1 |

Twelve days of work, in that order; each phase is usable on its own behind the flag.

## 8. Testing

- **Pure code stays pure.** `world.ts`/`places.ts` build plain descriptions (position, size, kind, colour) from the data before anything touches three.js; those builders get `node:test` coverage like the rest of `src/lib` (every camp structure has a height, every bay outline sits in its block, every art piece has a stand-in, the Dragon Lady's hull is twice the others).
- **Camera maths** (`camera.ts`) is pure too: the spring, the look-ahead, the block avoidance; tests step it with a moving car and assert it never crosses a block and never overshoots.
- **Pixels**: a Playwright screenshot suite over the place URLs with `?view=chase` on desktop Chrome, compared to stored references with a tolerance; run by hand before a push that touches the renderer.
- **Phone**: the pane here runs as a hidden tab and pauses the loop, so 3D is checked on a real iPhone over the deploy, as we do now.

## 9. Risks and the answer to each

- **iOS Safari WebGL memory**: keep textures small, cap dpr, release the 2D context when 3D is active for long. Test early (phase 0 on a phone).
- **Bundle size**: dynamic import; the top-down mode never pays for three.js.
- **Art fidelity**: stand-ins first, so the mode works; better models are a per-piece job later, and the decal of the real drawing on the ground keeps every piece recognisable from the air meanwhile.
- **Text in 3D**: no text meshes; names are DOM labels placed with `project()`, so they stay crisp and cheap.
- **The stick's frame of reference**: camera-relative in 3D is a one-line change in `readStick` (rotate the stick's heading by the camera yaw); the top-down mode keeps world-relative.
- **Two canvases**: the WebGL canvas sits under the same `.pl-stage`; pointer and keyboard handling are on the stage, so nothing changes for input.
- **Context loss** (backgrounding on iOS): listen for `webglcontextlost`, rebuild the scene on restore from the same builders; nothing is held only in GPU memory.

## 10. Open choices (defaults chosen; say if you want otherwise)

- The top-down minimap stays in 3D, bottom right on a phone where the stick is, so it shrinks and moves to the top right as in the current phone layout.
- Night bloom is on by default on desktop and off on phones until measured.
- The Earth dome uses a public-domain equirectangular map (NASA Blue Marble) rather than the camp photo's print, so it reads as the planet from every side.

## 11. Open source to lean on (reviewed 2026-10-26)

Checked on GitHub the same day: stars, licence and last push. Everything below is MIT, Zlib or CC0, so it can ship in a fan game with attribution in the README; nothing GPL (OpenRW, the GTA III rewrite, is GPL-3.0 and C++, and was ruled out for both reasons).

**Use as a dependency**
- **three.js** (mrdoob/three.js, MIT, 117k stars, pushed 2026-10-26). The renderer. Its `examples/jsm` folder already holds the pieces the plan names: `postprocessing/AfterimagePass.js` is the trip's trails as a GPU pass, `UnrealBloomPass.js` the night glow, `FilmPass.js` grain for the dust, `objects/Sky.js` the sun and sky dome with a real sun position for day/night, `GroundedSkybox.js` for the mountains on the horizon from one panorama, `InstancedMesh` for the camp structures and the people, `Sprite` for billboards. Pin a release; the dynamic-import chunk is the whole cost.
- **pmndrs/postprocessing** (Zlib, 2.9k stars, pushed 2026-10-05). One `EffectComposer` that merges bloom, hue shift, vignette and a custom afterimage into a single pass, which matters on a phone where each pass is a full-screen draw. Use it instead of three's own passes if phase 4 measures more than two passes.
- **gkjohnson/three-mesh-bvh** (MIT, 3.5k stars, pushed 2026-10-22). Fast raycasts and sphere casts against the camp blocks for the chase camera's collision (sliding up and in when a block is between the camera and you). Also cheap ground sampling if the playa ever gets relief.
- **creativelifeform/three-nebula** (MIT, 1.2k stars, pushed 2026-10-22). Particles for the dust kicked up behind wheels, the whiteout's blowing sand, and fire on the art cars at night. Optional; the plan's fog does the storm on its own.

**Read for the feel, copy nothing**
- **swift502/Sketchbook** (MIT, 1.8k stars, last pushed 2024-10). The best-known three.js playground with vehicles, a character and a spring-damped chase camera. Its camera and input code are the reference for `camera.ts` (the spring constants, the look-ahead, the orbit that springs back). It uses cannon.js for physics; we keep our own 2D physics and only borrow the camera.
- **raphaelaxiom/raphael-drive** (MIT, pushed 2026-10-13). A small Next.js + three.js city driving game with a garage, a HUD and a chase camera. Worth a read for how it mounts the renderer beside a React HUD, which is exactly our seam.
- **osoker/InfiniTownTS** (no licence file, pushed 2025-06). A TypeScript rewrite of Little Workshop's InfiniTown: a cartoon city of instanced blocks reused as you drive. The block-recycling and instancing patterns are the model for the camp blocks; no licence means read only, do not copy code.
- **jason-c-dev/backroad-rally** (MIT, pushed 2026-10-18). A top-down three.js rally diorama: the proof that a top-down game and a 3D one can share a scene, and a reference for the diorama look if the chase camera's wide shots ever want it.

**Models and textures (CC0, no attribution required, credit anyway)**
- **Kenney Car Kit and City Kit** (kenney.nl, CC0, glTF). Forty-odd low-poly vehicles (sedans, vans, an ambulance, trucks) for the roaming traffic and the ambulances, with separate wheels. The City Kit's props (fences, signs, lamps) fill the streets.
- **Quaternius** (quaternius.com, CC0, glTF). Low-poly people for the walkers and dancers if billboards ever give way to meshes, and a geodesic dome model on poly.pizza for the camps' domes.
- **poly.pizza** (aggregator; filter to CC0). Campervans and RVs for the camp blocks (49 results for campervan), tuk-tuks, bicycles. Check each model's licence line before use.
- **NASA Blue Marble** (public domain). The equirectangular map that wraps the Agave Earth dome.

**What stays ours**
- The city, the physics, the art cars and the art pieces: the drawings we have become roof textures and decals, as the plan says, so the game keeps its look in 3D. Real models of the Man, the Temple and the big pieces would be the only things to bring in later, and those are case by case: Sketchfab has fan models of several under CC-BY, which is fine with a credit line, but each needs its licence read.

