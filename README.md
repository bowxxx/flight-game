# Skyward Run — Coral Coast Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/bowxxx/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/bowxxx/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A complete, original flight game for the [make.fun best flight game bounty](https://make.fun/bounty/best-flight-game-20261126-0057). Fly the courier plane **Kestrel** over Coral Coast — a procedural island with sea, sandy shore, a river plain, a little city and a snowy ridge — thread glowing sky rings, mind your fuel, and bring her home to runway 36.

Referral code: `8bevpj6h`

## Play

Three sorties, one island:

1. **Ring Run** — thread all 8 sky rings, then come home.
2. **Island Hop** — 5 rings, then land on runway 36.
3. **Storm Courier** — 10 rings in a strong crosswind with a tight fuel tank.

Gentle banks win: hard turns bleed speed, slow flight stalls, and a hard touchdown on anything but the runway is a crash. A slow, level, centreline landing earns the perfect-landing bonus.

## Controls

- **↑ / ↓** pitch, **← / →** bank (or **W A S D**)
- **Shift / Ctrl** throttle up / down, mouse wheel also works the throttle
- **Mouse:** hold the left button and steer with the pointer
- **Space** brake, **P** pause, **R** restart, **M** mute, **Enter** fly

## Run

No build step, no network at runtime — just static files under `game/`:

```sh
node serve.ts
# open http://localhost:8080
```

Or serve `game/` with any static HTTP server and open `index.html`.

Screenshots for the dossier are staged with `?shot=start`, `?shot=play`, `?shot=land` and `?shot=over`.

## How it is built

- `game/src/config.js` — tuning constants and the three sorties
- `game/src/terrain.js` — procedural Coral Coast (seeded noise, coast, river, city)
- `game/src/plane.js` — flight physics: throttle, pitch, bank, stall, wind, landings
- `game/src/input.js` — keyboard + mouse controls
- `game/src/audio.js` — synthesised WebAudio engine, wind and chimes (no audio files)
- `game/src/render.js` — canvas chase view: terrain strips, city, runway, rings, plane, cockpit, HUD
- `game/src/game.js` — missions, rings, scoring and endings
- `game/src/main.js` — bootstrap, frame loop and screenshot scenes
- `main.ts` — hand-in program: copies `game/` + `screenshots/` to `/output` and writes `dossier.json`

All art and sound are generated in code. No external assets, no libraries.
