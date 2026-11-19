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
    player.pos.set(70, 0, 260);
    player.heading = Math.PI * 0.9;
    game.camYaw = Math.PI * 0.9;
    game.camPitch = 0.22;
    missions.current = 0;
    missions.stage = 0;
    missions.active = true;
    missions.message = 'Get in Sofia\'s green sedan by the Anchor.';
    missions.messageTimer = 99;
  } else if (name === 'mission') {
    // The dock shootout: Rico on foot with his pistol, Los Buitres ahead.
    player.pos.set(296, 0, 116);
    player.heading = Math.PI / 2;
    player.weapon = 'pistol';
    game.camYaw = Math.PI / 2;
    game.camPitch = 0.22;
    police.addHeat(2, 0);
    combat.spawnGang([
      { x: 306, z: 96 }, { x: 318, z: 104 }, { x: 312, z: 118 },
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
