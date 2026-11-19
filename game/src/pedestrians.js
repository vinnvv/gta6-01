// Pedestrians: Solmar's residents, strolling the sidewalks and running from
// trouble. They are the city's life, and its witnesses.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, pick, range } from './random.js';
import { makePersonMesh } from './player.js';

const SHIRTS = [0xd86a5e, 0x5e8fd8, 0x7ac98a, 0xd8c25e, 0xb06ad8, 0xe8e4da, 0x5ed8c9, 0xd85e9a];
const PANTS = [0x2c3e50, 0x4a3b2c, 0x5a5a5a, 0x3b4a6b, 0x6b3b3b];
const SKINS = [0xc98e6b, 0x8a5a3b, 0xe8b98a, 0x6b4226, 0xd8a07a];

class Ped {
  constructor(scene, city, rng) {
    const parts = makePersonMesh(pick(rng, SHIRTS), pick(rng, PANTS), pick(rng, SKINS), range(rng, 0.92, 1.06));
    this.parts = parts;
    this.mesh = parts.group;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    const p = this.randomSidewalk(city, rng);
    this.pos.set(p.x, 0, p.z);
    this.heading = rng() * Math.PI * 2;
    this.speed = 0;
    this.target = this.randomSidewalk(city, rng);
    this.state = 'walk';
    this.fleeFrom = null;
    this.walkPhase = rng() * 6;
    this.dead = false;
  }

  randomSidewalk(city, rng) {
    // A point on a sidewalk: beside a road line, inside the city.
    const line = city.roadXs[Math.floor(rng() * city.roadXs.length)];
    const along = range(rng, -270, 270);
    const side = rng() < 0.5 ? -1 : 1;
    if (rng() < 0.5) return { x: line + side * 9.5, z: along };
    return { x: along, z: line + side * 9.5 };
  }

  update(dt, city, threats, rng) {
    if (this.dead) return;
    // Flee from the nearest threat (a gunshot or a rampaging player).
    let threat = null, threatD = 26;
    for (const t of threats) {
      const d = Math.hypot(t.x - this.pos.x, t.z - this.pos.z);
      if (d < threatD) { threat = t; threatD = d; }
    }
    if (threat) {
      this.state = 'flee';
      this.fleeFrom = threat;
    } else if (this.state === 'flee' && threatD > 40) {
      this.state = 'walk';
    }
    let tx, tz, speed;
    if (this.state === 'flee' && this.fleeFrom) {
      const dx = this.pos.x - this.fleeFrom.x, dz = this.pos.z - this.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      tx = this.pos.x + (dx / d) * 30;
      tz = this.pos.z + (dz / d) * 30;
      speed = CFG.pedestrians.fleeSpeed;
    } else {
      tx = this.target.x; tz = this.target.z;
      speed = CFG.pedestrians.speed;
    }
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) {
      this.target = this.randomSidewalk(city, rng);
      return;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.heading += diff * Math.min(1, 6 * dt);
    this.speed += (speed - this.speed) * Math.min(1, 4 * dt);
    this.pos.x += Math.sin(this.heading) * this.speed * dt;
    this.pos.z += Math.cos(this.heading) * this.speed * dt;
    const push = city.collide(this.pos.x, this.pos.z, 0.5);
    this.pos.x += push.x;
    this.pos.z += push.z;
    const clamped = city.clampToWorld(this.pos.x, this.pos.z);
    this.pos.x = clamped.x;
    this.pos.z = clamped.z;
    this.mesh.rotation.y = this.heading;
    this.walkPhase += this.speed * dt * 1.8;
    const swing = Math.min(1, this.speed / 2) * 0.5;
    this.parts.legL.rotation.x = Math.sin(this.walkPhase) * swing;
    this.parts.legR.rotation.x = -Math.sin(this.walkPhase) * swing;
    this.parts.armL.rotation.x = -Math.sin(this.walkPhase) * swing * 0.8;
    this.parts.armR.rotation.x = Math.sin(this.walkPhase) * swing * 0.8;
  }

  kill() {
    this.dead = true;
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.position.y = 0.4;
  }

  remove(scene) {
    scene.remove(this.mesh);
  }
}

export class Pedestrians {
  constructor(scene, city, seed = 4242) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed);
    this.peds = [];
    for (let i = 0; i < CFG.pedestrians.count; i++) {
      this.peds.push(new Ped(scene, city, this.rng));
    }
    this.threats = [];
  }

  addThreat(x, z) {
    this.threats.push({ x, z, t: 0 });
  }

  update(dt, playerPos) {
    for (const t of this.threats) t.t += dt;
    this.threats = this.threats.filter((t) => t.t < 6);
    for (const ped of this.peds) {
      ped.update(dt, this.city, this.threats, this.rng);
      // Keep the streets populated near the player.
      if (!ped.dead && Math.hypot(ped.pos.x - playerPos.x, ped.pos.z - playerPos.z) > 240) {
        const p = ped.randomSidewalk(this.city, this.rng);
        const near = this.city.nearestRoadPoint(playerPos.x + (Math.random() - 0.5) * 140, playerPos.z + (Math.random() - 0.5) * 140);
        ped.pos.set(near.x + (Math.random() - 0.5) * 10, 0, near.z + (Math.random() - 0.5) * 10);
        ped.target = { x: p.x, z: p.z };
      }
    }
  }

  reset() {
    for (const ped of this.peds) ped.remove(this.scene);
    this.peds = [];
    for (let i = 0; i < CFG.pedestrians.count; i++) {
      this.peds.push(new Ped(this.scene, this.city, this.rng));
    }
    this.threats = [];
  }

  nearest(pos, range) {
    let best = null, bestD = range;
    for (const ped of this.peds) {
      if (ped.dead) continue;
      const d = Math.hypot(ped.pos.x - pos.x, ped.pos.z - pos.z);
      if (d < bestD) { best = ped; bestD = d; }
    }
    return best;
  }
}
