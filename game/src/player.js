// Rico Marin on foot: a low-poly person with swinging limbs, third-person
// movement, jumping, health and weapons. He hides when he is driving.

import * as THREE from 'three';
import { CFG } from './config.js';

const P = CFG.player;

// A person from boxes: torso, head, hair, arms and legs that swing.
export function makePersonMesh(shirt, pants, skin, scale = 1) {
  const g = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: shirt });
  const pantsMat = new THREE.MeshLambertMaterial({ color: pants });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x2a1c12 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), shirtMat);
  torso.position.y = 1.18;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skinMat);
  head.position.y = 1.74;
  g.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.36), hairMat);
  hair.position.y = 1.94;
  g.add(hair);
  const mkLimb = (mat, w, h, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), mat);
    m.position.y = -h / 2;
    pivot.add(m);
    g.add(pivot);
    return pivot;
  };
  const legL = mkLimb(pantsMat, 0.24, 0.78, -0.17, 0.82);
  const legR = mkLimb(pantsMat, 0.24, 0.78, 0.17, 0.82);
  const armL = mkLimb(shirtMat, 0.2, 0.68, -0.42, 1.5);
  const armR = mkLimb(shirtMat, 0.2, 0.68, 0.42, 1.5);
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: g, legL, legR, armL, armR };
}

export class Player {
  constructor(scene) {
    const parts = makePersonMesh(0xd8d3c8, 0x2c3e50, 0xc98e6b);
    this.parts = parts;
    this.mesh = parts.group;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.pos.set(-210, 0, -140);
    this.vel = { x: 0, z: 0 };
    this.vy = 0;
    this.onGround = true;
    this.heading = Math.PI;
    this.health = P.maxHealth;
    this.lastDamage = -99;
    this.weapon = 'fists';
    this.ammo = 12;
    this.reloadTimer = 0;
    this.fireTimer = 0;
    this.punchTimer = 0;
    this.inCar = null;
    this.walkPhase = 0;
    this.dead = false;
  }

  damage(amount, now) {
    if (this.dead) return;
    this.health -= amount;
    this.lastDamage = now;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(P.maxHealth, this.health + amount);
  }

  update(dt, input, city, camYaw, now) {
    if (this.inCar || this.dead) return;
    // Health regen after a quiet spell.
    if (now - this.lastDamage > P.regenDelay && this.health < P.maxHealth) {
      this.heal(P.regenRate * dt);
    }
    if (this.reloadTimer > 0) this.reloadTimer -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (this.punchTimer > 0) this.punchTimer -= dt;

    const ax = input.axes();
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? P.runSpeed : P.walkSpeed;
    // Camera-relative movement: forward is (sin yaw, cos yaw), right is
    // (-cos yaw, sin yaw).
    const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
    let mx = (-ax.x * cos + ax.y * sin);
    let mz = (ax.x * sin + ax.y * cos);
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    this.vel.x += (mx * speed - this.vel.x) * Math.min(1, P.accel * dt / speed * 8);
    this.vel.z += (mz * speed - this.vel.z) * Math.min(1, P.accel * dt / speed * 8);
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    // Buildings push the player out.
    const push = city.collide(this.pos.x, this.pos.z, P.radius);
    this.pos.x += push.x;
    this.pos.z += push.z;
    const clamped = city.clampToWorld(this.pos.x, this.pos.z);
    this.pos.x = clamped.x;
    this.pos.z = clamped.z;
    // Jump and gravity.
    if (input.hit('Space') && this.onGround) {
      this.vy = P.jumpSpeed;
      this.onGround = false;
    }
    if (!this.onGround) {
      this.vy -= P.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= 0) { this.pos.y = 0; this.vy = 0; this.onGround = true; }
    }
    // Face the movement direction.
    const moving = Math.hypot(this.vel.x, this.vel.z);
    if (moving > 0.8) {
      const want = Math.atan2(this.vel.x, this.vel.z);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += diff * Math.min(1, 12 * dt);
    }
    this.mesh.rotation.y = this.heading;
    // Limb swing while moving.
    this.walkPhase += moving * dt * 1.6;
    const swing = Math.min(1, moving / P.walkSpeed) * 0.6;
    this.parts.legL.rotation.x = Math.sin(this.walkPhase) * swing;
    this.parts.legR.rotation.x = -Math.sin(this.walkPhase) * swing;
    this.parts.armL.rotation.x = -Math.sin(this.walkPhase) * swing * 0.8;
    this.parts.armR.rotation.x = Math.sin(this.walkPhase) * swing * 0.8;
  }

  // Put the player in a car (mesh hidden) or back on foot beside it.
  enterCar(car) {
    this.inCar = car;
    car.playerDriven = true;
    this.mesh.visible = false;
  }

  exitCar() {
    const car = this.inCar;
    if (!car) return;
    car.playerDriven = false;
    this.inCar = null;
    this.mesh.visible = true;
    const f = car.forward();
    this.pos.set(car.pos.x - f.x * 3.2, 0, car.pos.z - f.z * 3.2);
    this.heading = car.heading;
    this.vel.x = 0; this.vel.z = 0;
  }
}
