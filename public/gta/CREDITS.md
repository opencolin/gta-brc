# GTA:BRC credits

GTA:BRC is a fan game with no connection to Burning Man Project or Take-Two Interactive. The city, the camps, the art cars and the art are drawn in code; nothing below is copied into the game unless it says so.

## Code

- [three.js](https://threejs.org) 0.186.1, the chase camera's renderer, with its example passes (EffectComposer, UnrealBloomPass, OutputPass). MIT licence, © three.js authors.
- [React](https://react.dev) 19. MIT licence, © Meta Platforms, Inc. and affiliates.

## Fonts

- [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) by Florian Karsten and [DM Mono](https://fonts.google.com/specimen/DM+Mono) by Colophon Foundry, served by Google Fonts. SIL Open Font License 1.1.

## Data

- Camp placements: Burning Man's published camp data as mirrored by [iBurn](https://github.com/iBurnApp/iBurn-Data) (`src/lib/soundcamps.ts`).
- The 2026 city, its camps, art, mutant vehicles, events and night sky: [getlost.fyi](https://getlost.fyi), compiled from the Burning Man API and camps' own posts; each record keeps its source (`public/data/getlost-2026.json`, `scripts/import-getlost.mjs`).
- Music: the sound camps' and art cars' own SoundCloud and YouTube pages, played in those services' embedded players. Nothing is downloaded or hosted here.

## References (looked at, not shipped)

- The city map's style (`src/game/citymap.ts`): Umbra's SAR image of Black Rock City 2025 ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), Wikimedia Commons) and the 2005 Landsat view (NASA, public domain). The map is painted in code from the city's geometry; neither image is in the game.

## Images in `public/`

- `gta/dragon-lady.png`: the Dragon Lady illustration, supplied by Collin for the game.
- `agave/logo.png`, `agave/camp-layout.jpg`: Agave Lounge's own logo and camp plan, from AgentCamp, where the game began.
- `gta/og.jpg`: the game's share card, made for it.

## 3D models

None yet. Phase 7 (PLAN-3D.md section 10) adds models under `public/models/`, each listed here with its title, author, source, licence (CC0, CC BY or CC BY-SA only) and what was changed.
