# GTA:BRC roadmap

Written 2026-10-22, the day the game moved into its own repo. Three versions: **v0** makes what exists solid, **v1** makes it a game people come back to, **v2** makes it the city, together. Each line names the feature and what it improves.

## v0 — the playa as it is (now → mid-November)

Polish and repair; nothing new in kind.

**Music**
- iPhone: a tapped set plays and keeps playing (the refused-autoplay pause is fixed; confirm on devices, then make the stacked SoundCloud players work on the phone's full-screen panel too).
- One volume for everything, remembered per device; the proximity mix fades between camps instead of switching.
- Clips in passing: on phones the peek shows a still, not a muted video, to save battery and data.

**Driving and controls**
- Game-controller support (steer, gas, brake, handbrake, map, ride) and a rebindable keyboard, with a controls card on the title screen.
- Touch: steering pads tuned for thumbs (dead zone, hold-to-turn), a horn, and haptics on bumps where the device has them.
- Camera: a short look-ahead on desktop like portrait's, and no snap when you hop off an art car.

**The city**
- The plazas (3:00 and 9:00, 4:30 and 7:30 at B and G) in the geometry and on the maps, with drivable openings.
- Street names on the big map past 2× zoom; a tap on the minimap opens the map following you; the Temple, Center Camp and the airport named on the minimap.
- The remaining plain art cars get drawings; art cars drive the real streets, not just loops; a parked art car drives off again after a while.
- Day and night on the real Black Rock clock, with a "now" option.

**Jobs**
- Three more kinds: an ice run from Arctica, taking someone to the Temple, a MOOP sweep of one block.
- Job pay in gifts shown on the pager; a job board at Center Camp to pick the next one.

**Housekeeping**
- A feature spec (`SPEC.md`, like open-theft-auto's `REBUILD_SPEC.md`) that lists every behaviour; tests that audit the world ("nothing spawns inside a wall", "every camp's bay is on a street", "every set answers oEmbed").
- Performance: blocks pre-rendered once, far NPCs skipped, a frame budget on phones.
- The AI-crawler firewall rule on the new Vercel project, Web Analytics, and error reporting.

## v1 — a game you come back to (mid-November → January)

**Saves and progress**
- Saved on the device: found art cars, gifts, MOOP picked, settings, where you were. "Continue" on the title card.
- Ranks from virgin to veteran; badges for every camp visited, every art car ridden, a full lap at 5 mph, a sunrise at the Temple.
- Gifts spend on rides and looks (a cape, a bike light pattern) — nothing bought with money.

**Install**
- Installable (home-screen icon, splash, offline city and art so it loads with no signal); the music still needs a connection and says so.

**Music everywhere**
- With SoundCloud API credentials: one audio player of our own, so every camp autoplays on iPhone and crossfades. Without them: YouTube-first camps autoplay after one tap, SoundCloud camps after a tap each.
- "Radio" mode: pick a lap and the sets play through as you ride it; "tonight at" shows which camp is playing what hour.

**The city, deeper**
- The year's real placement: camps where the placement map puts them, the year's street names, a "2026" / "2025" switch.
- People: walkers with looks and names, hitchhikers who wave you down, a crowd at a set that grows with the sound.
- Weather and events: whiteouts you drive through by the lamp line, the Man burn on Saturday night with the city converging, Temple burn on Sunday.

**Share**
- A link to a place ("meet me at 7:30 & E") that opens the game there; a camp's page with its sets and years; a postcard (screenshot with the map) to send.

## v2 — the city, together (2027 season)

**Multiplayer**
- See other riders live; ride along together on an art car; a shared DJ booth where one player picks the set everyone on the car hears.
- Small rooms (a camp, a crew) with a join link; no accounts needed beyond a name.

**Live during the event**
- Sets posted during the week appear the same day; a "this week" layer with the real art cars' schedules; after the burn, the week replays as a timeline.

**Open source**
- A neutral name (Playa Run, Black Rock Rider) and a fan-project disclaimer; MIT for the code; the music stays links.
- Camps and art cars add themselves by pull request against a checked data schema; a contributor guide and the spec.

**Creator tools**
- Draw your own art car in the app (a pixel editor with the game's palette) and drive it; a camp layout editor that places your shade, RVs and bar on your block.

**Maybe**
- A 3D view (three.js, reusing the game logic) for the open playa at night. Not before everything above.
