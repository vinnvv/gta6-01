// Combat: hitscan shooting, melee, and the armed gang members who shoot
// back. Shots are raycasts against the meshes the game registers.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makePersonMesh } from './player.js';

const raycaster = new THREE.Raycaster();

export class Combat {
  constructor(scene, effects) {
    this.scene = scene;
    this.effects = effects;
    this.hittables = []; // meshes with userData.combat = {kind, ref}
    this.enemies = [];
  }

  register(mesh, kind, ref) {
    mesh.traverse((o) => {
      if (o.isMesh) o.userData.combat = { kind, ref };
    });
    this.hittables.push(mesh);
  }

  unregister(mesh) {
    const i = this.hittables.indexOf(mesh);
    if (i >= 0) this.hittables.splice(i, 1);
  }

  // A hitscan shot from `origin` along `dir`. Returns the hit, if any.
  shoot(origin, dir, maxRange = 90) {
    raycaster.set(origin, dir);
    raycaster.far = maxRange;
    // Only meshes still in the scene count: removed ones (despawned police
    // cars) must not be hit.
    const live = this.hittables.filter((m) => m.parent !== null);
    const hits = raycaster.intersectObjects(live, true);
    if (!hits.length) return null;
    const hit = hits[0];
    let node = hit.object;
    while (node && !node.userData.combat) node = node.parent;
    const info = node ? node.userData.combat : { kind: 'world', ref: null };
    return { point: hit.point, distance: hit.distance, ...info };
  }

  // The player's shot, from the camera through the crosshair, with
  // whichever gun is in hand. A shotgun fires a fan of pellets, each its
  // own raycast; anything else fires one round. Returns the hits (each
  // carrying the damage it deals), 'reload' when the magazine ran dry, or
  // null while the gun is busy.
  playerShoot(camera, player, now) {
    const w = CFG.weapons[player.weapon];
    if (!w || !w.mag) return null;
    if (player.fireTimer > 0 || player.reloadTimer > 0) return null;
    if (player.ammo <= 0) {
      player.reloadTimer = w.reload;
      player.ammo = w.mag;
      player.ammoByWeapon[player.weapon] = w.mag;
      return 'reload';
    }
    player.fireTimer = w.rate;
    player.ammo -= 1;
    player.ammoByWeapon[player.weapon] = player.ammo;
    const origin = new THREE.Vector3();
    camera.getWorldPosition(origin);
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const muzzle = origin.clone().addScaledVector(dir, 1.2);
    this.effects.muzzle(muzzle);
    const pellets = w.pellets || 1;
    const hits = [];
    for (let i = 0; i < pellets; i++) {
      const d = dir.clone();
      if (pellets > 1) {
        // Fan the pellets out around the aim point.
        const jitter = new THREE.Vector3(
          (Math.random() - 0.5) * 2 * w.spread,
          (Math.random() - 0.5) * 2 * w.spread,
          0,
        );
        d.add(jitter).normalize();
      }
      const hit = this.shoot(origin, d, w.range);
      const end = hit ? hit.point : origin.clone().addScaledVector(d, w.range);
      this.effects.tracer(muzzle, end);
      if (hit) {
        hit.damage = w.damage;
        if (hit.kind === 'ped' || hit.kind === 'enemy') {
          this.effects.burst(hit.point, 0xc22a2a, 12, 5, 2);
        } else if (hit.kind === 'car') {
          this.effects.burst(hit.point, 0xffd23e, 10, 5, 2);
        } else {
          this.effects.burst(hit.point, 0xcccccc, 8, 3, 2);
        }
        hits.push(hit);
      }
    }
    return hits;
  }

  // A melee swing: hits the nearest ped or enemy in front of the player.
  punch(player, peds, now) {
    if (player.punchTimer > 0) return null;
    player.punchTimer = CFG.weapons.fists.rate;
    const range = CFG.weapons.fists.range;
    let best = null, bestD = range;
    const fx = Math.sin(player.heading), fz = Math.cos(player.heading);
    const check = (pos) => {
      const dx = pos.x - player.pos.x, dz = pos.z - player.pos.z;
      const d = Math.hypot(dx, dz);
      const along = dx * fx + dz * fz;
      if (d < bestD && along > 0) { bestD = d; return true; }
      return false;
    };
    for (const ped of peds.peds) {
      if (!ped.dead && check(ped.pos)) best = { kind: 'ped', ref: ped };
    }
    for (const e of this.enemies) {
      if (!e.dead && check(e.pos)) best = { kind: 'enemy', ref: e };
    }
    return best;
  }

  // Spawn armed gang members at the given points. bossIdx, when given,
  // marks one of them as the boss: tougher, and in a gold shirt.
  spawnGang(points, bossIdx = -1) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const isBoss = i === bossIdx;
      const parts = makePersonMesh(isBoss ? 0xc9a227 : 0x8a1f1f, 0x222226, 0xc98e6b);
      parts.group.position.set(p.x, 0, p.z);
      this.scene.add(parts.group);
      const enemy = {
        parts, pos: parts.group.position, heading: 0,
        health: isBoss ? 160 : 60, dead: false, shootTimer: 0.6 + Math.random(), strafe: 0,
      };
      this.enemies.push(enemy);
      this.register(parts.group, 'enemy', enemy);
    }
  }

  clearGang() {
    for (const e of this.enemies) {
      this.unregister(e.parts.group);
      this.scene.remove(e.parts.group);
    }
    this.enemies = [];
  }

  aliveEnemies() {
    return this.enemies.filter((e) => !e.dead).length;
  }

  damageEnemy(enemy, amount) {
    enemy.health -= amount;
    if (enemy.health <= 0 && !enemy.dead) {
      enemy.dead = true;
      enemy.parts.group.rotation.x = -Math.PI / 2;
      enemy.parts.group.position.y = 0.4;
    }
  }

  // Enemies strafe and shoot at the player when he is in range.
  update(dt, player, now) {
    for (const e of this.enemies) {
      if (e.dead || player.dead) continue;
      const dx = player.pos.x - e.pos.x;
      const dz = player.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist > 70) continue;
      const want = Math.atan2(dx, dz);
      let diff = want - e.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      e.heading += diff * Math.min(1, 6 * dt);
      e.parts.group.rotation.y = e.heading;
      // Sidestep every couple of seconds.
      e.strafe -= dt;
      if (e.strafe <= 0) {
        e.strafe = 1.5 + Math.random() * 1.5;
        e.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      e.pos.x += Math.cos(e.heading) * (e.strafeDir || 1) * 1.2 * dt;
      e.pos.z -= Math.sin(e.heading) * (e.strafeDir || 1) * 1.2 * dt;
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && dist < 55) {
        e.shootTimer = 0.9 + Math.random() * 0.7;
        const hitChance = dist < 15 ? 0.4 : dist < 35 ? 0.25 : 0.12;
        const origin = e.pos.clone().setY(1.4);
        const dir = new THREE.Vector3(dx / dist, 0, dz / dist);
        const muzzle = origin.clone().addScaledVector(dir, 1);
        this.effects.muzzle(muzzle);
        const end = origin.clone().addScaledVector(dir, dist);
        this.effects.tracer(muzzle, end);
        if (Math.random() < hitChance) {
          player.damage(8 + Math.random() * 8, now);
          this.effects.burst(player.pos.clone().setY(1.2), 0xc22a2a, 8, 4, 2);
        }
      }
    }
  }
}
