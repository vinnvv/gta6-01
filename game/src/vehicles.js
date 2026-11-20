// Cars: vehicles, arcade driving, and the traffic that fills the roads.
// Every car is one THREE.Group so the game can move it as a unit.
//
// Visuals are real low-poly .glb models (Kenney Car Kit, CC0) loaded from
// game/assets/models/. They load asynchronously at startup; until a style's
// model is ready the car uses the box-built makeCarMesh fallback, which is
// swapped in place the moment the model arrives. A car never appears broken
// or missing: if a model fails to load, the fallback stays for good.

import * as THREE from 'three';
import { GLTFLoader } from '../vendor/GLTFLoader.js';
import { CFG } from './config.js';
import { makeRng, pick, range } from './random.js';

export const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xd8b13c, 0x3fae6a, 0xe8e8e8, 0x222226, 0x7a5fb0, 0xd86a2e];

// A car from boxes: body, cabin, wheels, lights. Styles differ in size and
// trim; the police style adds a light bar.
export function makeCarMesh(style, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1c });
  const isVan = style === 'van';
  const isSport = style === 'sport';
  const len = isVan ? 5.4 : isSport ? 4.4 : 4.7;
  const wid = 2.0;
  const bodyH = isVan ? 1.5 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(wid, bodyH, len), paint);
  body.position.y = 0.65;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(wid * 0.88, isVan ? 0.9 : 0.62, isVan ? 2.6 : len * 0.48),
    isVan ? paint : glass,
  );
  cabin.position.set(0, bodyH + 0.3 + (isVan ? 0.15 : 0), isVan ? -0.4 : -0.2);
  g.add(cabin);
  if (!isVan) {
    const roof = new THREE.Mesh(new THREE.BoxGeometry(wid * 0.9, 0.08, len * 0.5), paint);
    roof.position.set(0, bodyH + 0.3 + 0.62, -0.2);
    g.add(roof);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.38, z * (len / 4.7));
    g.add(wheel);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c9, emissive: 0xffe9a0, emissiveIntensity: 0.7 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xc22a2a, emissive: 0x881111, emissiveIntensity: 0.6 });
  for (const x of [-0.7, 0.7]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), headMat);
    head.position.set(x, 0.7, len / 2 + 0.01);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.06), tailMat);
    tail.position.set(x, 0.7, -len / 2 - 0.01);
    g.add(tail);
  }
  if (style === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0xcc9900, emissiveIntensity: 0.5 }));
    sign.position.set(0, bodyH + 0.3 + 0.62 + 0.12, -0.2);
    g.add(sign);
  }
  if (style === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0x2244cc, emissive: 0x2244ff, emissiveIntensity: 1 }));
    bar.position.set(0, bodyH + 0.3 + 0.62 + 0.1, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0xff2222, emissiveIntensity: 1 }));
    red.position.set(-0.35, bodyH + 0.3 + 0.62 + 0.1, -0.2);
    g.add(red);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// --- Real .glb car models --------------------------------------------------

// One local file per style, from the Kenney Car Kit (CC0, see the pack's
// License.txt). The models use a shared palette texture at
// assets/models/Textures/colormap.png, which the .glb files reference by
// relative path, so it ships next to them. The models face +Z, the same
// forward the physics uses (Car.forward is +Z at heading 0).
const MODEL_FILES = {
  sedan: 'sedan.glb',
  sport: 'sport.glb',
  taxi: 'taxi.glb',
  van: 'van.glb',
  pickup: 'pickup.glb',
  police: 'police.glb',
  suv: 'suv.glb',
};
// Target visual length per style, matching the box-built fallback so the
// physics (collision radius, wheelbase feel) does not change.
const MODEL_LENGTH = { sedan: 4.7, sport: 4.4, taxi: 4.7, van: 5.4, pickup: 4.7, police: 4.7, suv: 4.7 };

const glbLoader = new GLTFLoader();
const templates = {}; // style -> normalized THREE.Group, or null if its load failed
let pendingCars = []; // cars spawned before their style's model arrived
let modelsSettled = 0;
const MODEL_STYLES = Object.keys(MODEL_FILES);

// Normalize a loaded model once: scale it to the target length, center it
// on X/Z, and rest its lowest point on Y=0 so the wheels sit on the road.
function normalizeModel(scene, style) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const s = MODEL_LENGTH[style] / size.z;
  scene.scale.setScalar(s);
  scene.position.set(-center.x * s, -box.min.y * s, -center.z * s);
  scene.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return scene;
}

// Swap a car's fallback children for a clone of its style's model. The
// car's own group (position, rotation, combat registration) never moves.
function installModel(car) {
  const template = templates[car.style];
  if (!template || car.modelSwapped) return false;
  while (car.mesh.children.length) car.mesh.remove(car.mesh.children[0]);
  car.mesh.add(template.clone(true));
  car.modelSwapped = true;
  return true;
}

function preloadCarModels() {
  if (typeof window !== 'undefined') window.__carModelsReady = false;
  for (const style of MODEL_STYLES) {
    const url = new URL(`../assets/models/${MODEL_FILES[style]}`, import.meta.url).href;
    glbLoader.load(url,
      (gltf) => {
        templates[style] = normalizeModel(gltf.scene, style);
        pendingCars = pendingCars.filter((car) => {
          if (car.style === style) return !installModel(car);
          return true;
        });
        settleOne();
      },
      undefined,
      () => {
        // Keep the fallback: the car stays a box-built car, never missing.
        templates[style] = null;
        console.warn(`[cars] model failed to load, using fallback: ${MODEL_FILES[style]}`);
        settleOne();
      });
  }
}

function settleOne() {
  modelsSettled++;
  if (modelsSettled === MODEL_STYLES.length && typeof window !== 'undefined') {
    window.__carModelsReady = true;
  }
}

// Start loading the moment this module is imported, so the models are
// usually ready by the time the player leaves the menu.
preloadCarModels();

const C = CFG.car;

export class Car {
  constructor(scene, style, color, x, z, heading) {
    this.style = style;
    this.color = color;
    this.mesh = makeCarMesh(style, color);
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.health = 100;
    this.smoking = false;
    this.ai = null; // traffic brain, if any
    this.playerDriven = false;
    this.stolen = false;
    this.dead = false;
    this.modelSwapped = false;
    // Use the real model if it is already here, otherwise ride the
    // fallback until the model arrives and swaps itself in.
    if (!installModel(this)) pendingCars.push(this);
  }

  forward() {
    return { x: Math.sin(this.heading), z: Math.cos(this.heading) };
  }

  // Arcade driving: throttle, steer and brake from -1..1 each.
  drive(dt, throttle, steerInput, brake, handbrake, city) {
    const fwd = this.forward();
    this.steer += ((steerInput * C.steerMax) - this.steer) * Math.min(1, C.steerSpeed * dt * 3);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += (this.steer * this.speed * 0.055 * dir) * dt * 8;
    if (throttle > 0) this.speed += C.accel * throttle * dt;
    else if (throttle < 0) this.speed += C.reverseAccel * throttle * dt;
    if (brake > 0) {
      const s = Math.sign(this.speed);
      this.speed -= s * C.brake * brake * dt;
      if (Math.sign(this.speed) !== s) this.speed = 0;
    }
    // Drag and grip: kill sideways slide, more so with the handbrake.
    this.speed *= Math.max(0, 1 - (handbrake > 0 ? 0.35 : 0.12) * dt);
    this.speed = Math.max(-C.maxReverse, Math.min(C.maxSpeed, this.speed));
    const nf = this.forward();
    this.pos.x += nf.x * this.speed * dt;
    this.pos.z += nf.z * this.speed * dt;
    // Buildings push the car out; a hard hit costs speed.
    const push = city.collide(this.pos.x, this.pos.z, C.radius);
    if (push.x !== 0 || push.z !== 0) {
      this.pos.x += push.x;
      this.pos.z += push.z;
      if (Math.abs(this.speed) > 12) {
        this.health -= Math.abs(this.speed) * 0.4;
        this.speed *= 0.35;
      } else {
        this.speed *= 0.6;
      }
    }
    const clamped = city.clampToWorld(this.pos.x, this.pos.z);
    this.pos.x = clamped.x;
    this.pos.z = clamped.z;
    this.mesh.rotation.y = this.heading;
    // Body roll and wheel spin for feel.
    this.mesh.rotation.z = -this.steer * this.speed * 0.0016;
    if (this.health < 35 && !this.smoking) this.smoking = true;
  }

  damage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }

  remove(scene) {
    scene.remove(this.mesh);
  }
}

// Traffic: cars that drive the road graph, stop for the car ahead, and
// respawn near the player when they drift too far away.
export class Traffic {
  constructor(scene, city, seed = 77) {
    this.scene = scene;
    this.city = city;
    this.rng = makeRng(seed);
    this.cars = [];
    this.spawnInitial();
  }

  spawnInitial() {
    const styles = ['sedan', 'sedan', 'sport', 'taxi', 'van', 'pickup', 'suv'];
    for (let i = 0; i < CFG.traffic.count; i++) {
      const node = this.city.nodes[Math.floor(this.rng() * this.city.nodes.length)];
      const car = new Car(this.scene, pick(this.rng, styles), pick(this.rng, CAR_COLORS), node.x, node.z, this.rng() * Math.PI * 2);
      car.ai = { target: this.randomNodeNear(node.x, node.z), wait: 0 };
      this.cars.push(car);
    }
  }

  reset() {
    for (const car of this.cars) car.remove(this.scene);
    this.cars = [];
    this.spawnInitial();
  }

  randomNodeNear(x, z) {
    const near = this.city.nodes.filter((n) => Math.hypot(n.x - x, n.z - z) < 120);
    return near.length ? near[Math.floor(this.rng() * near.length)] : this.city.nodes[0];
  }

  // The car directly ahead of `car` on its lane, if any.
  carAhead(car) {
    const f = car.forward();
    let best = null, bestD = CFG.traffic.minGap + 6;
    for (const o of this.cars) {
      if (o === car || o.playerDriven) continue;
      const dx = o.pos.x - car.pos.x, dz = o.pos.z - car.pos.z;
      const along = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (along > 0 && along < bestD && side < 3.2) { best = o; bestD = along; }
    }
    return best;
  }

  update(dt, playerPos) {
    for (const car of this.cars) {
      if (car.playerDriven || car.dead || !car.ai) continue;
      const ai = car.ai;
      const dx = ai.target.x - car.pos.x;
      const dz = ai.target.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        ai.target = this.randomNodeNear(car.pos.x, car.pos.z);
        continue;
      }
      // Steer toward the target node.
      const want = Math.atan2(dx, dz);
      let diff = want - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 2.2));
      const blocked = this.carAhead(car);
      const throttle = blocked ? 0 : 0.55;
      const brake = blocked ? 1 : 0;
      car.drive(dt, throttle, steer, brake, 0, this.city);
      // Keep traffic on the roads: if it drifted off, snap it back gently.
      if (!this.city.isOnRoad(car.pos.x, car.pos.z) && Math.abs(car.speed) < 2) {
        const p = this.city.nearestRoadPoint(car.pos.x, car.pos.z);
        car.pos.x += (p.x - car.pos.x) * dt * 2;
        car.pos.z += (p.z - car.pos.z) * dt * 2;
      }
      // Respawn far-away cars near the player so the streets stay busy.
      if (Math.hypot(car.pos.x - playerPos.x, car.pos.z - playerPos.z) > 220) {
        const node = this.randomNodeNear(playerPos.x, playerPos.z);
        const spot = this.city.nearestRoadPoint(node.x + range(this.rng, -20, 20), node.z + range(this.rng, -20, 20));
        car.pos.x = spot.x; car.pos.z = spot.z;
        car.heading = this.rng() * Math.PI * 2;
        car.speed = 0;
        ai.target = this.randomNodeNear(spot.x, spot.z);
      }
    }
    // Simple circle push between cars so they do not overlap.
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i], b = this.cars[j];
        if (a.dead || b.dead) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.4 && d > 0.01) {
          const push = (4.4 - d) / 2;
          const nx = dx / d, nz = dz / d;
          a.pos.x -= nx * push; a.pos.z -= nz * push;
          b.pos.x += nx * push; b.pos.z += nz * push;
        }
      }
    }
  }
}
