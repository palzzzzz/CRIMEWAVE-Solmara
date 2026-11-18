# CRIMEWAVE: Solmara

[![make.fun gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/palzzzzz/CRIMEWAVE-Solmara/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/palzzzzz/CRIMEWAVE-Solmara/reward.svg)](https://make.fun/bounty/gta6-01)

An original 3D low-poly open-world crime game set in Solmara, a sun-soaked tropical coastal city (beach, downtown, harbour). Built with three.js, plain JavaScript, no build step, no network at runtime. Entry for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01).

## Run

```
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome (keyboard + mouse).

## Features

- Solmara: three districts, road grid, beach and animated sea, day cycle with lit windows and rain
- On foot and driving: arcade car physics, motorcycle, pickup, car theft and jacking, a flyable helicopter
- Traffic and pedestrians that react to danger
- Line-of-sight wanted system (1-5 stars), pursuit, ramming, roadblocks, police helicopter with searchlight
- Combat: fists, pistol, SMG, shotgun and more, weapon wheel (hold Q), pickups, gangs and cops that shoot back
- 7-mission story chain with phone briefings and portraits, SolFeed social feed (P), REP, fence deliveries
- Garage repaint and upgrades, walk-in shops, radio stations (R), mute (M), autosave and CONTINUE

## Controls

WASD move, mouse aim, Shift run, Space jump, E enter or exit, TAB switch Ray and Luna, Q weapon wheel, P phone, R radio, M mute.

## Layout

`game/index.html` loads `game/vendor/three.min.js` and the modules in `game/src/` (world, vehicles, traffic, police, weapons, air, story, phone, radio, sfx, hud, title).
