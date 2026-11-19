# SOLMAR

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/vinnvv/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/vinnvv/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

Entry for [make.fun gta6-01](https://make.fun/bounty/gta6-01). Referral code: `9j79nw8m`.

## What it is

SOLMAR is a sun-soaked open-world crime game in the spirit of GTA 6, played
in a desktop browser from static files, offline, with keyboard and mouse. It
is a complete original: its own city, characters, vehicles, names, story, art
and sound. Nothing in it comes from Rockstar Games or any other commercial
game.

Rico Marin is out after three years inside. Sofia Marchetti, who runs the
garage bar The Rusty Anchor, has work for him. Five missions take him from
his release to the big score: drive Sofia's sedan to the docks, steal the red
Comet GT on the Strip, lose a two-star wanted level, clear Los Buitres
gunmen from Harbor Yards, then rob the Solmar Grand casino and escape by boat
at the marina. Between missions the city is open: steal any car, fight,
earn cash, and stay ahead of the Solmar police.

## The city

Solmar sits on a bay in the fictional state of Aurelia: Downtown towers,
the beachfront Strip, Barrio del Mar, Harbor Yards with its cranes and
containers, Palm Heights and Old Town. An 8 by 8 block grid with roads,
sidewalks, crosswalks, a beach and the sea, all lit by a low golden-hour
sun. Traffic drives the road graph and pedestrians walk the sidewalks and
flee from gunfire.

## Systems

- On foot and by car: walk, run, jump, steal and drive six vehicle types
  (sedan, sports, taxi, police, van, pickup) with arcade handling, damage
  and smoke.
- Wanted system: five stars. Stealing cars, shooting near the police and
  killing peds or cops raise the heat; patrol cars chase and ram, foot cops
  chase and arrest. Heat fades when the player stays out of sight.
- Combat: fists and a P9 pistol with a magazine and reload, hit-scan shots
  with tracers and muzzle flash, and armed gang members who strafe and shoot
  back.
- Missions and story: five missions with a light-beacon marker, a minimap
  blip and an objective line, with cash rewards.
- HUD: health, cash, wanted stars, objective, speed, weapon and ammo, a
  live minimap, and start, pause, wasted and busted screens.
- Save: progress, cash, mission and position save to localStorage
  automatically and on quit.
- Sound: everything is synthesized with WebAudio in code, engine hum,
  sirens, gunshots, UI blips and a simple music loop. No audio files.

## Controls

WASD move and drive, mouse look (click to lock, arrow keys work too),
Shift run, Space jump and handbrake, E enter or leave a car, left click
shoot, F punch, R reload, 1 and 2 switch weapons, M mute, Esc pause.

## How to run it

Open `game/index.html` in a desktop browser, or serve the folder:

```
node serve.ts
```

then open http://localhost:8080. No build step, no network request.

## Layout

- `game/index.html` - the page, HUD styles and the three.js import map.
- `game/src/main.js` - boot, the game loop, camera, menus and save.
- `game/src/config.js` - tuning and the five missions.
- `game/src/city.js` - the city: roads, blocks, beach, port, lights.
- `game/src/vehicles.js` - cars, arcade driving and traffic.
- `game/src/player.js` - Rico on foot: movement, health, weapons.
- `game/src/pedestrians.js` - the crowd on the sidewalks.
- `game/src/police.js` - the wanted system and the police.
- `game/src/combat.js` - shooting, punching and gang enemies.
- `game/src/effects.js` - particles, tracers and muzzle flash.
- `game/src/missions.js` - the story, stages and the beacon.
- `game/src/hud.js` - the HUD, minimap and menus.
- `game/src/input.js` - keyboard, mouse and pointer lock.
- `game/src/audio.js` - synthesized WebAudio sound and music.
- `game/src/save.js` - the localStorage save.
- `game/src/shots.js` - the staged screenshot scenes (?shot=...).
- `game/src/random.js` - the seeded random helpers.
- `game/vendor/three.module.min.js` - three.js 0.160.0, vendored.
- `main.ts` - copies game/ and screenshots/ to /output and writes the
  dossier. Run it with `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts`.

## License

MIT. See LICENSE.
