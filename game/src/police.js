// The wanted system and the Solmar police: patrol cars that chase and ram,
// foot cops that chase and arrest, and a heat level that fades when the
// player stays out of sight.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, range } from './random.js';
import { Car } from './vehicles.js';
import { makePersonMesh } from './player.js';

const W = CFG.wanted;
const P = CFG.police;

export class Police {
  constructor(scene, city, seed = 99) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed);
    this.wanted = 0;
    this.cars = [];
    this.cops = [];
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.busted = false;
    this.sirenNear = false;
    this.lastCrime = -99;
  }

  addHeat(amount, now) {
    this.wanted = Math.max(0, Math.min(5, this.wanted + amount));
    this.lastCrime = now;
    this.decayTimer = 0;
  }

  clearWanted() {
    this.wanted = 0;
    this.decayTimer = 0;
    this.bustTimer = 0;
  }

  // Take every unit off the street and drop the heat entirely.
  clearAll() {
    for (const car of this.cars) car.remove(this.scene);
    this.cars = [];
    for (const cop of this.cops) this.scene.remove(cop.parts.group);
    this.cops = [];
    this.clearWanted();
    this.busted = false;
    this.sirenNear = false;
  }

  // A bullet hit on a foot cop. Returns 'dead' when the cop goes down.
  damageCop(cop, amount, now) {
    if (cop.dead) return 'none';
    cop.health -= amount;
    if (cop.health > 0) return 'hit';
    cop.dead = true;
    cop.deadTimer = 0;
    cop.parts.group.rotation.x = -Math.PI / 2;
    this.addHeat(2, now);
    return 'dead';
  }

  // A road point some distance from the player, for spawning units.
  spawnPoint(playerPos, minD = 45, maxD = 75) {
    for (let tries = 0; tries < 12; tries++) {
      const node = this.city.nodes[Math.floor(this.rng() * this.city.nodes.length)];
      const d = Math.hypot(node.x - playerPos.x, node.z - playerPos.z);
      if (d >= minD && d <= maxD) return node;
    }
    const p = this.city.nearestRoadPoint(
      playerPos.x + range(this.rng, -60, 60),
      playerPos.z + range(this.rng, -60, 60),
    );
    return p;
  }

  update(dt, player, playerCar, now) {
    const playerPos = playerCar ? playerCar.pos : player.pos;
    const level = W.levels[this.wanted];
    const wantCars = level ? level.cars : 0;
    const wantCops = level ? level.cops : 0;

    // Spawn or remove patrol cars to match the wanted level.
    while (this.cars.length < wantCars) {
      const spot = this.spawnPoint(playerPos);
      const car = new Car(this.scene, 'police', 0xe8e8e8, spot.x, spot.z, this.rng() * Math.PI * 2);
      car.ai = { target: { x: playerPos.x, z: playerPos.z } };
      this.cars.push(car);
    }
    while (this.cars.length > wantCars) {
      const car = this.cars.pop();
      car.remove(this.scene);
    }
    // Foot cops. Dead cops lie where they fell and are cleared after a while.
    const aliveCops = this.cops.filter((c) => !c.dead).length;
    let toSpawn = wantCops - aliveCops;
    while (toSpawn > 0) {
      const spot = this.spawnPoint(playerPos, 25, 50);
      const parts = makePersonMesh(0x1c2f4a, 0x1c2f4a, 0xc98e6b);
      parts.group.position.set(spot.x, 0, spot.z);
      this.scene.add(parts.group);
      this.cops.push({ parts, pos: parts.group.position, heading: 0, punchTimer: 0, health: 60, dead: false, deadTimer: 0 });
      toSpawn--;
    }
    while (this.cops.length > wantCops) {
      const cop = this.cops.pop();
      this.scene.remove(cop.parts.group);
    }

    let nearest = Infinity;
    // Patrol cars chase the player and ram.
    for (const car of this.cars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.4));
      car.drive(dt, dist > 6 ? 1 : 0.3, steer, 0, 0, this.city);
      // Ramming the player's car damages it; hitting the player on foot hurts.
      if (dist < 4.6) {
        if (playerCar) {
          playerCar.damage(P.ramDamage * dt * 2);
          playerCar.speed *= 0.94;
          car.speed *= 0.9;
        } else if (!player.dead) {
          player.damage(P.ramDamage * dt * 3, now);
        }
      }
      // Despawn a patrol car that fell far behind.
      if (dist > 260) {
        const spot = this.spawnPoint(playerPos);
        car.pos.x = spot.x; car.pos.z = spot.z;
        car.speed = 0;
      }
    }

    // Foot cops run the player down and try to arrest him.
    let copNear = false;
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const cop = this.cops[i];
      if (cop.dead) {
        cop.deadTimer += dt;
        if (cop.deadTimer > 6) {
          this.scene.remove(cop.parts.group);
          this.cops.splice(i, 1);
        }
        continue;
      }
      const dx = playerPos.x - cop.pos.x;
      const dz = playerPos.z - cop.pos.z;
      const dist = Math.hypot(dx, dz);
      nearest = Math.min(nearest, dist);
      const want = Math.atan2(dx, dz);
      let diff = want - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += diff * Math.min(1, 8 * dt);
      const speed = dist > 3 ? P.copSpeed : 0;
      cop.pos.x += Math.sin(cop.heading) * speed * dt;
      cop.pos.z += Math.cos(cop.heading) * speed * dt;
      const push = this.city.collide(cop.pos.x, cop.pos.z, 0.5);
      cop.pos.x += push.x; cop.pos.z += push.z;
      cop.parts.group.rotation.y = cop.heading;
      cop.parts.legL.rotation.x = Math.sin(now * 9) * 0.5;
      cop.parts.legR.rotation.x = -Math.sin(now * 9) * 0.5;
      if (dist < 2.6 && !playerCar && !player.dead) {
        copNear = true;
        cop.punchTimer -= dt;
        if (cop.punchTimer <= 0) {
          cop.punchTimer = 0.9;
          player.damage(P.punchDamage, now);
        }
      }
    }

    // Busted: a cop holds the player on foot while he is slow and close.
    if (copNear && !playerCar && !player.dead) {
      const playerSpeed = Math.hypot(player.vel.x, player.vel.z);
      if (playerSpeed < 2) {
        this.bustTimer += dt;
        if (this.bustTimer >= W.bustHoldTime) this.busted = true;
      } else {
        this.bustTimer = 0;
      }
    } else {
      this.bustTimer = 0;
    }

    // Heat fades when no unit can see the player.
    this.sirenNear = nearest < 90;
    if (this.wanted > 0) {
      if (nearest > P.sightRange && now - this.lastCrime > 6) {
        this.decayTimer += dt;
        if (this.decayTimer >= W.decayOutOfSight) {
          this.wanted -= 1;
          this.decayTimer = 0;
        }
      } else {
        this.decayTimer = 0;
      }
    }
  }
}
