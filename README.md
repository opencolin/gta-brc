# GTA:BRC

A top-down drive round Black Rock City, lifted out of [AgentCamp](https://agentcamp.dev) on 2026-10-22 to stand on its own at [burningman.chat](https://burningman.chat).

Ride a cruiser bike, an e-bike, a unicycle, Agave Lounge's art car or any famous art car you have found and parked beside. The sound camps and art cars play their real sets (SoundCloud and YouTube) as you pass, the pager hands out jobs, the playa has MOOP, and the city is drawn from the real plan (`src/lib/brc.ts`) and the satellite photos (`src/game/citymap.ts`).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # the game logic's tests (node --test)
npm run build    # typecheck + a static build in dist/
```

Add `?view=chase` to the address (or press C in the game) for the 3D chase camera; `?view=top` goes back to the map view.

Vite + React + TypeScript, a static site, with two small Vercel Functions in `api/` for everyone's counters and the daily leaderboard (Upstash Redis from the Vercel Marketplace; `vercel env pull` brings the keys, `vercel dev --listen 3000` and `API_PROXY=http://localhost:3000 npm run dev` run them locally, and without them the game plays on). The music is embedded SoundCloud and YouTube players; nothing is copied.

## Where things are

- `src/lib/brc.ts` – the city as geometry (feet, the Man at the origin, 12:00 straight up)
- `src/lib/camps.ts` – the camps that fill each block
- `src/lib/playa.ts` – physics, the others on the road, jobs, parking, the art car you drive
- `src/lib/soundcamps.ts` – every sound camp and art car with its sets (add yours here)
- `src/lib/playaSound.ts` – the proximity mix; `src/lib/playaMedia.ts` – the players
- `src/game/PlayaWin.tsx` – the screen, controls, HUD and maps; `PlayaLounge.tsx` – the music panel
- `src/game/artcars.ts`, `artplatforms.ts` – the art cars, drawn in code; `citymap.ts` – the map image

Credits and licences: `public/gta/CREDITS.md`.

This is a fan project with no connection to Burning Man Project or Take-Two Interactive.
