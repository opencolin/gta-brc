# The real 2026 city from getlost.fyi

Asked 2026-11-03: "Here lies a map of burning man! Let's import all the data and consider how to use it in the game" (https://getlost.fyi/).

## What was imported

`node scripts/import-getlost.mjs` fetches getlost.fyi's public data files (`/data/*.json`, built 2026-10-12) and writes `public/data/getlost-2026.json` (3.2 MB, 690 KB gzipped). The file is served beside the game and fetched with `loadGetLost()` only when a feature wants it, so it is not in the bundle.

| | count | what each has |
|---|---|---|
| camps | 1,176 | address, place, topics (bar, coffee, massage…), hometown, description |
| art | 310 | clock and distance on the open playa, artist, description, image for some |
| mutant vehicles | 493 | form (bus, ship, wing, plant, robot…), artist, home camp for 31; the rest roam |
| city services | 99 | Arctica ice, ESD and first aid, Rangers, Playa Info, BMIR, Hell Station fuel, the airport, the bus depot, 80 potty banks |
| events | 6,514 | day (Aug 30 – Sep 7), start and end hour, category (party, workshop, food, bar, coffee, art, kids, adult…), host (6,306 tied to a listed camp or piece) |
| lineups | 16 camps | posted DJ sets and nightly programmes (Opulent Temple, Ashram Galactica, Discosmos, Favela…) |
| city points | 60 | the plazas, portals, promenades, ESD stations, Ranger stations, Greeters, the Box Office, the DMZs, the fence's corners |
| potty lines | 37 | the potty banks as lines in their blocks |
| sky | 15 nights | moonrise, moonset, how full the moon is, which planets rise and set when |

Every place is stored the way the real city has it: a clock position (minutes past 12:00) and real feet from the Man, worked out from its latitude and longitude. The Man's position comes from the city file, and the city's axis is 45° east of north. `src/lib/getlost.ts` puts them on the game's map:
- `toGame(p)` moves a place street by street. The 2026 city is not the game's grid: it stops at K, its E–F block is twice as deep, and the game's A–L follow older radii. So a place between the real F and G lands between the game's F and G, at its own clock.
- `campAt(p)` steps a camp off the street into the block it fronts: man side or mountain side, inside 2:00 and 10:00. 1,146 of 1,176 camps land in a block; the rest are on plazas or portals, which is where they really are.

`src/lib/getlost.test.mjs` checks the counts, that the street mapping lines up and never folds back, and that camps land in a block at their own clock.

The data is getlost.fyi's compilation of the Burning Man API (api.burningman.org, playaevents.burningman.org) and camps' own posts. Each record keeps its `source`. Credit getlost.fyi wherever this shows in the game.

## How the game could use it

Ordered by how much each adds against what it costs.

1. **Real camps in the blocks.** `camps.ts` invents a camp for every frontage, with names like "Dusty Teacup". Instead, each block could take the real camps fronting it from `campAt`, with real names on the signs and topics choosing the layout: a bar gets a counter, coffee a café, massage tables, a dome for meditation. The 50 invented camps the 1,176 real ones don't cover stay as they are. Pulling up shows the camp's description and hometown. This is the biggest gain in how real the city feels, it's cheap per frame (a sign is already drawn), and the 57 sound camps that match by name keep their music.
2. **What's on now.** The game has a clock (`DAY_SECONDS`, day and night). From it, choose a burn day and hour and show the events within a few blocks that are on now: "Hot Sauce Journey, 3:00 & E, till 5 PM". The pager could also send rides to events: "get two people to the 4 PM workshop at Cosmic Giggle by 3:55". These are new `JOBS` with real destinations and deadlines, 6,500 of them.
3. **The art on the open playa.** The game draws 64 pieces. The other 246 could stand at their real clock and distance as simple markers (a plinth, a light, the name at night), each with its description. Pieces with images could open them in the panel, as `artmedia.ts` does with videos.
4. **Mutant vehicles that look like what they are.** 493 art cars with a form: bus, ship, wing, plant, robot, train, building, myth. The new art-car base models (bus, tanker, train, tram, boat, 4x4) could take each form, so the playa's roaming art cars become the real ones by name. The 31 with a home camp park there by day.
5. **The services as play.**
   - Hell Station sells fuel for the art car.
   - Arctica sells ice: a timed delivery job.
   - ESD and first aid are where the ambulance takes someone after a bump.
   - The potty banks are on the map, and the queue at one is a wait.
   - The Rangers are at their stations; Greeters, the Box Office and Will Call are at the Gate.
6. **Lineups.** 16 camps posted sets. At night, a camp's panel could show who's on, and the existing SoundCloud players could go to that DJ.
7. **The night sky.** For the chosen burn night, rise and set the moon at the real time and fullness (full on Aug 27, waning all week). Venus is the evening star in the west, Saturn rises at 9 PM and Mars before dawn. `templeMoon.ts` already has a moon to drive.
8. **The real 2026 grid (bigger).** Change `ARC_R` to the 2026 radii (A–K, the deep E–F block) and use the real plazas and portals from `points`. Every place would then sit exactly where it was, with no street-by-street mapping. But this moves every camp, NPC route, test and the 3D city, so it's a phase of its own.

Suggested start: 1 and 2 together. Real camp names make the events' hosts findable, and "what's on now" gives a reason to drive somewhere.

## Done (2026-11-03)

- **The real streets (8).** `brc.ts` now follows the 2026 city. The arcs run Esplanade to K at their real distances, including the deep E–F block. Center Camp sits on 6:00 across the Esplanade, A and B, out to Route 66. The fence is the real size, and the 11 round plazas at B and G are drawn top-down, in 3D and on the map, with no camps in them. Riders on the Esplanade, A or B turn back at Center Camp instead of riding through the café. What's still missing: 5:45 and 6:15 (real from F out) and the walk-only quarter-hour paths. The Gate stays at 4:30, though the real one is at 6:00.
- **Real camps (1).** `camps2026.ts`, bundled at 34 KB gzipped, holds the 1,176 camps. Each block's lots take the camps that front it, nearest first. A real camp's sign carries its name and uid, and its topics choose the layout. 988 camps have a lot. The others face a plaza, or sit in a block that has more camps than lots within 350 ft of their address. Lots with no real camp keep an invented name.
- **What's on now (2).** The game's day runs through the burn week (`burnTime`: sunset 7:30 PM, sunrise 6:30 AM, day 0 is Monday Aug 31). The HUD shows the day and time, and up to three events within 900 ft that are on now. Events come from `public/data/getlost-2026.json`, which is fetched once after load.
- **Pager rides to real events.** 16 jobs take people from a corner across town to a real camp's event, named as the camp posted it. Event names that suit an adult audience only are left out.
