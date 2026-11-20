// Staged scenes for the screenshots (?shot=name). Each one sets up a
// deterministic moment of the game: positions, wanted level, mission and
// camera, so the screenshots show the systems at work.

import { Car } from './vehicles.js';

export function applyShot(game, name) {
  const { player, traffic, police, combat, missions, scene } = game;
  const placeCar = (car, x, z, heading, speed) => {
    car.pos.set(x, 0, z);
    car.heading = heading;
    car.speed = speed;
    car.mesh.rotation.y = heading;
  };

  if (name === 'cover' || name === 'chase') {
    // A getaway chase on the Strip: Rico in the red Comet driving toward the
    // camera, two patrol cars behind him, three stars, the mission objective
    // on the HUD. The Comet and the patrol cars are placed explicitly so the
    // chase reads at a glance instead of spawning at random.
    const comet = new Car(scene, 'sport', 0xc23b2e, 63, 200, 0);
    comet.isMissionCar = true;
    traffic.cars.push(comet);
    player.enterCar(comet);
    comet.speed = 30;
    player.weapon = 'pistol';
    police.addHeat(3, 0);
    const p1 = new Car(scene, 'police', 0xe8e8e8, 56, 158, 0);
    const p2 = new Car(scene, 'police', 0xe8e8e8, 71, 164, 0);
    p1.speed = 30; p2.speed = 30;
    police.cars.push(p1, p2);
    game.camYaw = Math.PI;
    game.camPitch = 0.38;
    missions.current = 2;
    missions.stage = 1;
    missions.active = true;
    missions.message = 'Lose the cops. Stay out of sight.';
    missions.messageTimer = 99;
  } else if (name === 'street') {
    // On foot by the beach road: traffic, pedestrians, the Strip behind.
    // Kept clear of the Strip Liquor shop (63,259): standing on its marker
    // would start a hold-up and fill the shot with the pink robbery beacon.
    // Rico stands on the curb by the road (not mid-sidewalk), the camera
    // sits 10 units back so he reads as a person instead of a grey slab,
    // and the yaw is swung 8 degrees west: the old framing put the shaded
    // west face of building #50 right on the frame's right edge, where it
    // read as a black-windowed slab. A taxi is staged on the road ahead
    // because traffic positions drift between runs.
    player.pos.set(67, 0, 238);
    player.heading = 2.97;
    game.camYaw = 2.97;
    game.camPitch = 0.22;
    game.camDist = 10;
    const taxi = new Car(scene, 'taxi', 0xf2b705, 63, 215, Math.PI);
    taxi.speed = 11;
    traffic.cars.push(taxi);
    missions.current = 0;
    missions.stage = 0;
    missions.active = true;
    missions.message = 'Get in Sofia\'s green sedan by the Anchor.';
    missions.messageTimer = 99;
  } else if (name === 'mission') {
    // The dock shootout: Rico on foot with his pistol, Los Buitres ahead.
    // Rico stands south-west of the gang cluster and faces it (heading
    // ~2.55), so all six gunmen and the container walls are in frame.
    player.pos.set(296, 0, 128);
    player.heading = 2.55;
    player.weapon = 'pistol';
    game.camYaw = 2.55;
    game.camPitch = 0.22;
    police.addHeat(2, 0);
    combat.spawnGang([
      { x: 300, z: 88 }, { x: 318, z: 104 }, { x: 306, z: 118 },
      { x: 326, z: 92 }, { x: 312, z: 76 }, { x: 334, z: 112 },
    ]);
    missions.setMarker(312, 100);
    missions.current = 3;
    missions.stage = 1;
    missions.active = true;
    missions.message = 'Clear out Los Buitres. Six gunmen hold the dock.';
    missions.messageTimer = 99;
  } else if (name === 'drive') {
    // Golden-hour drive along the beach road, skyline behind.
    const sedan = traffic.cars.find((c) => c.style === 'sedan') || traffic.cars[0];
    player.enterCar(sedan);
    placeCar(sedan, -120, 273, Math.PI / 2, 26);
    game.camYaw = Math.PI / 2;
    game.camPitch = 0.3;
    missions.current = 0;
    missions.stage = 1;
    missions.active = true;
    missions.message = 'Drive to the docks to meet Sofia.';
    missions.messageTimer = 99;
  }
}
