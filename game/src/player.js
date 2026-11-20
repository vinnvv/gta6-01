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

// Held weapon silhouettes mounted to Rico's right hand pivot.
function makeWeaponMeshes() {
  const gunMetal = new THREE.MeshLambertMaterial({ color: 0x24282e });
  const gunDark = new THREE.MeshLambertMaterial({ color: 0x181a1e });
  const woodMat = new THREE.MeshLambertMaterial({ color: 0x6b4226 });

  const addPart = (parent, w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
  };

  const pistol = new THREE.Group();
  addPart(pistol, 0.06, 0.14, 0.08, gunDark, 0, -0.04, 0.04);
  addPart(pistol, 0.065, 0.08, 0.28, gunMetal, 0, 0.03, 0.14);

  const shotgun = new THREE.Group();
  addPart(shotgun, 0.07, 0.1, 0.24, woodMat, 0, -0.02, -0.06);
  addPart(shotgun, 0.08, 0.1, 0.24, gunMetal, 0, 0.02, 0.14);
  addPart(shotgun, 0.055, 0.055, 0.42, gunDark, 0, 0.045, 0.44);
  addPart(shotgun, 0.075, 0.07, 0.18, woodMat, 0, 0, 0.36);

  const smg = new THREE.Group();
  addPart(smg, 0.06, 0.13, 0.07, gunDark, 0, -0.04, 0.02);
  addPart(smg, 0.08, 0.11, 0.3, gunMetal, 0, 0.03, 0.12);
  addPart(smg, 0.045, 0.18, 0.06, gunDark, 0, -0.09, 0.18);
  addPart(smg, 0.04, 0.04, 0.14, gunDark, 0, 0.04, 0.32);

  const rifle = new THREE.Group();
  addPart(rifle, 0.07, 0.11, 0.26, woodMat, 0, -0.01, -0.08);
  addPart(rifle, 0.08, 0.11, 0.3, gunMetal, 0, 0.02, 0.16);
  addPart(rifle, 0.05, 0.16, 0.08, gunDark, 0, -0.09, 0.2);
  addPart(rifle, 0.07, 0.08, 0.22, woodMat, 0, 0.025, 0.38);
  addPart(rifle, 0.04, 0.04, 0.26, gunDark, 0, 0.04, 0.56);

  const map = { pistol, shotgun, smg, rifle };
  for (const m of Object.values(map)) m.visible = false;
  return map;
}

// Rico's character model: burnt-orange open jacket over a cream tee,
// dark indigo jeans, boots, layered hair and shades. Uses the exact same
// proportions and limb pivots as makePersonMesh.
function makeRicoMesh() {
  const g = new THREE.Group();
  const jacketMat = new THREE.MeshLambertMaterial({ color: 0xc84b22 });
  const jacketTrimMat = new THREE.MeshLambertMaterial({ color: 0x9c3515 });
  const shirtMat = new THREE.MeshLambertMaterial({ color: 0xebe4d4 });
  const beltMat = new THREE.MeshLambertMaterial({ color: 0x261d17 });
  const buckleMat = new THREE.MeshLambertMaterial({ color: 0xd4a94e });
  const jeansMat = new THREE.MeshLambertMaterial({ color: 0x1f2d3d });
  const shoeMat = new THREE.MeshLambertMaterial({ color: 0x1a1613 });
  const soleMat = new THREE.MeshLambertMaterial({ color: 0x3b332c });
  const skinMat = new THREE.MeshLambertMaterial({ color: 0xc98e6b });
  const hairMat = new THREE.MeshLambertMaterial({ color: 0x231710 });
  const shadesMat = new THREE.MeshLambertMaterial({ color: 0x15171c });

  const addBox = (parent, w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // Inner shirt + belt.
  addBox(g, 0.58, 0.7, 0.32, shirtMat, 0, 1.18, 0);
  addBox(g, 0.64, 0.09, 0.36, beltMat, 0, 0.85, 0);
  addBox(g, 0.12, 0.09, 0.04, buckleMat, 0, 0.85, 0.18);

  // Open burnt-orange jacket (back, front panels, collar and back yoke).
  addBox(g, 0.64, 0.68, 0.14, jacketMat, 0, 1.2, -0.11);
  addBox(g, 0.22, 0.68, 0.24, jacketMat, -0.21, 1.2, 0.06);
  addBox(g, 0.22, 0.68, 0.24, jacketMat, 0.21, 1.2, 0.06);
  addBox(g, 0.65, 0.14, 0.04, jacketTrimMat, 0, 1.44, -0.175);
  addBox(g, 0.48, 0.12, 0.1, jacketTrimMat, 0, 1.56, -0.14);
  addBox(g, 0.09, 0.12, 0.22, jacketTrimMat, -0.22, 1.56, -0.02);
  addBox(g, 0.09, 0.12, 0.22, jacketTrimMat, 0.22, 1.56, -0.02);

  // Neck, head, sunglasses and layered hair.
  addBox(g, 0.16, 0.12, 0.16, skinMat, 0, 1.56, 0);
  addBox(g, 0.36, 0.36, 0.34, skinMat, 0, 1.74, 0);
  addBox(g, 0.34, 0.08, 0.04, shadesMat, 0, 1.78, 0.175);
  addBox(g, 0.39, 0.14, 0.37, hairMat, 0, 1.94, -0.01);
  const quiff = addBox(g, 0.34, 0.09, 0.22, hairMat, 0, 2.01, 0.06);
  quiff.rotation.x = -0.12;
  addBox(g, 0.38, 0.24, 0.09, hairMat, 0, 1.8, -0.16);
  addBox(g, 0.05, 0.16, 0.16, hairMat, -0.18, 1.82, -0.04);
  addBox(g, 0.05, 0.16, 0.16, hairMat, 0.18, 1.82, -0.04);

  // Legs with dark jeans and shoes.
  const mkLeg = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.82, 0);
    addBox(pivot, 0.24, 0.64, 0.24, jeansMat, 0, -0.32, 0);
    addBox(pivot, 0.25, 0.14, 0.3, shoeMat, 0, -0.71, 0.03);
    addBox(pivot, 0.26, 0.04, 0.31, soleMat, 0, -0.79, 0.03);
    g.add(pivot);
    return pivot;
  };
  const legL = mkLeg(-0.17);
  const legR = mkLeg(0.17);

  // Arms with jacket sleeves, cuffs and skin hands.
  const mkArm = (x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.5, 0);
    addBox(pivot, 0.21, 0.49, 0.21, jacketMat, 0, -0.245, 0);
    addBox(pivot, 0.22, 0.06, 0.22, jacketTrimMat, 0, -0.51, 0);
    addBox(pivot, 0.17, 0.15, 0.17, skinMat, 0, -0.61, 0);
    g.add(pivot);
    return pivot;
  };
  const armL = mkArm(-0.42);
  const armR = mkArm(0.42);

  // Held weapon anchor on the right hand.
  const weaponAnchor = new THREE.Group();
  weaponAnchor.position.set(0, -0.6, 0.06);
  armR.add(weaponAnchor);
  const weaponMeshes = makeWeaponMeshes();
  for (const m of Object.values(weaponMeshes)) weaponAnchor.add(m);

  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { parts: { group: g, legL, legR, armL, armR }, weaponMeshes };
}

export class Player {
  constructor(scene) {
    const { parts, weaponMeshes } = makeRicoMesh();
    this.parts = parts;
    this.weaponMeshes = weaponMeshes;
    this._shownWeapon = null;
    this.mesh = parts.group;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.pos.set(-210, 0, -140);
    this.vel = { x: 0, z: 0 };
    this.vy = 0;
    this.onGround = true;
    this.heading = Math.PI;
    this.health = P.maxHealth;
    this.armor = 0;
    this.lastDamage = -99;
    this.weapon = 'fists';
    this._syncWeaponMesh();
    // What Rico carries: the guns he owns, and each gun's own magazine.
    // `ammo` always mirrors the current weapon, so the shooting code never
    // has to know which gun is out.
    this.owned = { pistol: true };
    this.ammoByWeapon = { pistol: 12 };
    this.ammo = 12;
    this.reloadTimer = 0;
    this.fireTimer = 0;
    this.punchTimer = 0;
    this.inCar = null;
    this.walkPhase = 0;
    this.dead = false;
  }

  _syncWeaponMesh() {
    if (this._shownWeapon === this.weapon) return;
    this._shownWeapon = this.weapon;
    for (const [id, mesh] of Object.entries(this.weaponMeshes)) {
      mesh.visible = id === this.weapon;
    }
  }

  damage(amount, now) {
    if (this.dead) return;
    // Armor soaks the hit first; only what is left reaches health.
    const soaked = Math.min(this.armor, amount);
    this.armor -= soaked;
    this.health -= amount - soaked;
    this.lastDamage = now;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  heal(amount) {
    this.health = Math.min(P.maxHealth, this.health + amount);
  }

  addArmor(amount) {
    this.armor = Math.min(P.maxArmor, this.armor + amount);
  }

  // Pick up a gun: it joins the arsenal with a magazine of ammo, and Rico
  // draws it straight away. Picking up a gun he already owns just tops up
  // its ammo instead.
  giveWeapon(id, bonus) {
    const first = !this.owned[id];
    this.owned[id] = true;
    this.ammoByWeapon[id] = (this.ammoByWeapon[id] || 0) + bonus;
    this.setWeapon(id);
    return first;
  }

  // Holster the current gun (its magazine stays where it was) and draw
  // another one. Fists need no magazine.
  setWeapon(id) {
    if (this.weapon !== 'fists') this.ammoByWeapon[this.weapon] = this.ammo;
    this.weapon = id;
    this.ammo = id === 'fists' ? 0 : (this.ammoByWeapon[id] || 0);
    this.reloadTimer = 0;
    this._syncWeaponMesh();
  }

  // Fresh magazine for the gun in hand; the reload timer is the lockout
  // while Rico swaps it.
  reloadCurrent() {
    const w = CFG.weapons[this.weapon];
    if (!w || !w.mag || this.ammo >= w.mag) return false;
    this.reloadTimer = w.reload;
    this.ammo = w.mag;
    this.ammoByWeapon[this.weapon] = w.mag;
    return true;
  }

  update(dt, input, city, camYaw, now) {
    this._syncWeaponMesh();
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
