// Solmar itself: a procedural sun-soaked coastal city on a road grid, with a
// beach to the south and a working port to the east. Everything is generated
// from one seed, so the city is identical on every run.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng, pick, range, rangeInt, hashSeed } from './random.js';

const CITY = CFG.city;
const PITCH = CITY.blockSize + CITY.roadWidth; // 70
const HALF = (CITY.blocksX * PITCH) / 2; // 280
const ROAD_HALF = CITY.roadWidth / 2;

// Road centerlines: 9 lines each way (8 blocks need 9 roads).
export function roadLines() {
  const lines = [];
  for (let i = 0; i <= CITY.blocksX; i++) lines.push(-HALF - ROAD_HALF + i * PITCH);
  return lines;
}

// Facade texture: a warm painted wall with a grid of lit windows.
function facadeTexture(rng, base, floors, cols) {
  const w = 128, h = 256;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // Slight vertical grime near the bottom.
  const grad = g.createLinearGradient(0, h * 0.7, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(60,40,20,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Windows.
  const margin = 10, gapX = (w - margin * 2) / cols, gapY = (h - 18) / floors;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const x = margin + c * gapX + 2;
      const y = 10 + f * gapY + 3;
      const lit = rng() < 0.28;
      g.fillStyle = lit ? '#ffd98a' : '#2c3542';
      g.fillRect(x, y, gapX - 5, gapY - 8);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, gapX - 5, 2);
    }
  }
  // Ground floor: shopfront band.
  g.fillStyle = 'rgba(40,28,18,0.85)';
  g.fillRect(0, h - 16, w, 16);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The whole ground as one texture: asphalt, roads, lane dashes, sidewalks,
// crosswalks, sand and the sea edge. World units map to texture pixels.
function groundTexture() {
  const world = HALF + CITY.roadWidth + CITY.beachDepth + CITY.seaWidth + 40;
  const S = 2048;
  const scale = S / (world * 2);
  const toPx = (v) => (v + world) * scale;
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  // Base: city asphalt, warm from the low sun.
  g.fillStyle = '#38352f';
  g.fillRect(0, 0, S, S);
  // Sea (south, high Z).
  g.fillStyle = '#2e7fa8';
  g.fillRect(0, toPx(HALF + CITY.beachDepth), S, S);
  // Beach sand.
  g.fillStyle = '#e8d5a4';
  g.fillRect(0, toPx(HALF), S, toPx(HALF + CITY.beachDepth) - toPx(HALF));
  // Wet sand line.
  g.fillStyle = '#d9c48d';
  g.fillRect(0, toPx(HALF + CITY.beachDepth - 6), S, 6 * scale);
  const lines = roadLines();
  // Roads: lighter asphalt strips.
  g.fillStyle = '#4a453e';
  for (const x of lines) {
    g.fillRect(toPx(x - ROAD_HALF), 0, CITY.roadWidth * scale, toPx(HALF));
    g.fillRect(0, toPx(x - ROAD_HALF), toPx(HALF), CITY.roadWidth * scale);
  }
  // Sidewalks: pale warm borders around every block.
  g.fillStyle = '#a89a80';
  for (let i = 0; i < CITY.blocksX; i++) {
    for (let j = 0; j < CITY.blocksZ; j++) {
      const x0 = -HALF + i * PITCH;
      const z0 = -HALF + j * PITCH;
      g.fillRect(toPx(x0 - 2), toPx(z0 - 2), (CITY.blockSize + 4) * scale, (CITY.blockSize + 4) * scale);
    }
  }
  // Harbor Yards apron: concrete east of the city, where the containers sit.
  g.fillStyle = '#6b655a';
  g.fillRect(toPx(HALF), toPx(-HALF), (100) * scale, (HALF * 2) * scale);
  // Container pad markings.
  g.fillStyle = '#5a544b';
  for (let z = -260; z < 260; z += 40) {
    g.fillRect(toPx(HALF + 8), toPx(z), 84 * scale, 18 * scale);
  }
  g.fillStyle = '#e8e8e8';
  g.fillRect(toPx(HALF), toPx(-HALF), 2, (HALF * 2) * scale);
  // Lane dashes along every road.
  g.fillStyle = '#d8c25a';
  for (const x of lines) {
    for (let z = -HALF; z < HALF; z += 14) {
      g.fillRect(toPx(x) - 1, toPx(z), 2, 7 * scale);
      g.fillRect(toPx(z), toPx(x) - 1, 7 * scale, 2);
    }
  }
  // Crosswalks at intersections.
  g.fillStyle = '#e8e8e8';
  for (const x of lines) {
    for (const z of lines) {
      for (let k = -3; k <= 3; k++) {
        g.fillRect(toPx(x + k * 2) - 1, toPx(z - ROAD_HALF), 2, 3 * scale);
        g.fillRect(toPx(x + k * 2) - 1, toPx(z + ROAD_HALF - 3), 2, 3 * scale);
      }
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, world };
}

function palmTree() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b46 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 4.6, 6), trunkMat);
  trunk.position.y = 2.3;
  trunk.rotation.z = 0.08;
  group.add(trunk);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 4), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.0, 4.9, Math.sin(a) * 1.0);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    group.add(leaf);
  }
  return group;
}

function streetLight() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), mat);
  pole.position.y = 2.7;
  group.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.1), mat);
  arm.position.set(0.8, 5.35, 0);
  group.add(arm);
  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 6),
    new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 0.9 }),
  );
  lamp.position.set(1.55, 5.3, 0);
  group.add(lamp);
  return group;
}

export class City {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.rng = makeRng(seed);
    this.buildings = []; // {x0,z0,x1,z1,h}
    this.buildingMeshes = []; // meshes, for raycasts
    this.colliders = []; // same as buildings plus port props
    this.roadXs = roadLines();
    this.nodes = [];
    for (const x of this.roadXs) {
      for (const z of this.roadXs) this.nodes.push({ x, z });
    }
    this.buildGround();
    this.buildBlocks();
    this.buildBeachProps();
    this.buildPort();
    this.buildLights();
  }

  buildGround() {
    const { tex, world } = groundTexture();
    const geo = new THREE.PlaneGeometry(world * 2, world * 2);
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    const ground = new THREE.Mesh(geo, mat);
    ground.rotation.x = -Math.PI / 2;
    // Centered on the origin: the texture's world coordinates are the
    // game's world coordinates, so the roads and the beach land where the
    // cars and the player actually are.
    ground.position.set(0, 0, 0);
    ground.receiveShadow = true;
    this.scene.add(ground);
    // Sea shimmer: a second translucent plane just above the water.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(CITY.seaWidth * 2.4, CITY.seaWidth),
      new THREE.MeshLambertMaterial({ color: 0x3d94b8, transparent: true, opacity: 0.35 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.15, HALF + CITY.beachDepth + CITY.seaWidth / 2);
    this.scene.add(sea);
  }

  buildBlocks() {
    const rng = this.rng;
    const palette = ['#e8dcc8', '#d9b48f', '#c98f6b', '#a8c4c4', '#e3cfae', '#b7a99a', '#d6a05e', '#c2b49a'];
    const downtown = 130; // buildings nearer the center grow taller
    for (let i = 0; i < CITY.blocksX; i++) {
      for (let j = 0; j < CITY.blocksZ; j++) {
        const bx = -HALF + i * PITCH;
        const bz = -HALF + j * PITCH;
        const cx = bx + CITY.blockSize / 2;
        const cz = bz + CITY.blockSize / 2;
        const dist = Math.hypot(cx, cz);
        const tall = Math.max(0.35, 1 - dist / (downtown * 2.4));
        const n = rangeInt(rng, 1, 3);
        for (let b = 0; b < n; b++) {
          const w = range(rng, 14, 26);
          const d = range(rng, 14, 26);
          const h = range(rng, CITY.buildingMin, CITY.buildingMin + (CITY.buildingMax - CITY.buildingMin) * tall);
          const x = bx + 5 + rng() * (CITY.blockSize - 10 - w);
          const z = bz + 5 + rng() * (CITY.blockSize - 10 - d);
          // Keep buildings from overlapping each other in the same block.
          if (this.buildings.some((o) => x < o.x1 + 3 && x + w > o.x0 - 3 && z < o.z1 + 3 && z + d > o.z0 - 3)) continue;
          const floors = Math.max(2, Math.round(h / 3.4));
          const cols = Math.max(2, Math.round(w / 4.5));
          const tex = facadeTexture(makeRng(hashSeed(`${i},${j},${b}`)), pick(rng, palette), floors, cols);
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          mesh.position.set(x + w / 2, h / 2, z + d / 2);
          this.scene.add(mesh);
          this.buildingMeshes.push(mesh);
          // Roof cap and an AC box.
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.96, 0.5, d * 0.96),
            new THREE.MeshLambertMaterial({ color: 0x5a5148 }),
          );
          roof.position.set(x + w / 2, h + 0.25, z + d / 2);
          this.scene.add(roof);
          const ac = new THREE.Mesh(
            new THREE.BoxGeometry(2, 1, 2),
            new THREE.MeshLambertMaterial({ color: 0x8a8f94 }),
          );
          ac.position.set(x + w / 2, h + 1, z + d / 2);
          this.scene.add(ac);
          this.buildings.push({ x0: x, z0: z, x1: x + w, z1: z + d, h });
          this.colliders.push({ x0: x, z0: z, x1: x + w, z1: z + d });
        }
        // A few palms on the block corners.
        if (rng() < 0.6) {
          const palm = palmTree();
          palm.position.set(bx + 4, 0, bz + 4);
          this.scene.add(palm);
        }
      }
    }
    // The Solmar Grand casino: a tall glass tower downtown, the mission 5 target.
    const casinoTex = facadeTexture(makeRng(99), '#3f6d8e', 14, 8);
    const casino = new THREE.Mesh(
      new THREE.BoxGeometry(30, 52, 22),
      new THREE.MeshLambertMaterial({ map: casinoTex }),
    );
    casino.position.set(63, 26, -7);
    this.scene.add(casino);
    this.buildingMeshes.push(casino);
    this.buildings.push({ x0: 48, z0: -18, x1: 78, z1: 4, h: 52 });
    this.colliders.push({ x0: 48, z0: -18, x1: 78, z1: 4 });
    // A glowing casino sign.
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(20, 3, 1),
      new THREE.MeshLambertMaterial({ color: 0xff4d6d, emissive: 0xff2a55, emissiveIntensity: 1 }),
    );
    sign.position.set(63, 46, 5);
    this.scene.add(sign);
  }

  buildBeachProps() {
    const rng = this.rng;
    // Palm rows along the Strip and umbrellas on the sand.
    for (let x = -260; x <= 260; x += 26) {
      if (rng() < 0.75) {
        const palm = palmTree();
        palm.position.set(x + range(rng, -4, 4), 0, HALF + 8);
        this.scene.add(palm);
      }
    }
    const umbrellaCols = ['#ff5a5a', '#ffd23e', '#3fa7ff', '#ff8fd1'];
    for (let i = 0; i < 14; i++) {
      const x = range(rng, -260, 260);
      const z = HALF + range(rng, 16, 38);
      const umb = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1.2, 8),
        new THREE.MeshLambertMaterial({ color: pick(rng, umbrellaCols) }),
      );
      umb.position.set(x, 2.2, z);
      this.scene.add(umb);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.07, 2.2, 5),
        new THREE.MeshLambertMaterial({ color: 0xdddddd }),
      );
      pole.position.set(x, 1.1, z);
      this.scene.add(pole);
    }
  }

  buildPort() {
    // Harbor Yards: container stacks and two cranes east of the city.
    const rng = this.rng;
    const cols = ['#c94f3d', '#3d7ac9', '#4fae5a', '#d8a13c', '#7a5fb0'];
    for (let i = 0; i < 22; i++) {
      const x = range(rng, 300, 360);
      const z = range(rng, -260, 260);
      const w = 12, h = range(rng, 2.6, 7.8), d = 2.6;
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshLambertMaterial({ color: pick(rng, cols) }),
      );
      box.position.set(x, h / 2, z);
      box.rotation.y = rng() < 0.5 ? 0 : Math.PI / 2;
      this.scene.add(box);
      this.colliders.push({ x0: x - 6, z0: z - 6, x1: x + 6, z1: z + 6 });
    }
    // Cranes: simple frames.
    const craneMat = new THREE.MeshLambertMaterial({ color: 0xd8a13c });
    for (const z of [-120, 60]) {
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), craneMat);
      leg1.position.set(330, 13, z - 6);
      const leg2 = new THREE.Mesh(new THREE.BoxGeometry(2, 26, 2), craneMat);
      leg2.position.set(330, 13, z + 6);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 34), craneMat);
      beam.position.set(330, 26, z);
      const jib = new THREE.Mesh(new THREE.BoxGeometry(30, 1.5, 1.5), craneMat);
      jib.position.set(345, 25, z);
      this.scene.add(leg1, leg2, beam, jib);
    }
  }

  buildLights() {
    // Streetlights at every other intersection.
    for (let i = 0; i < this.roadXs.length; i += 2) {
      for (let j = 0; j < this.roadXs.length; j += 2) {
        const light = streetLight();
        light.position.set(this.roadXs[i] + ROAD_HALF + 1, 0, this.roadXs[j] + ROAD_HALF + 1);
        this.scene.add(light);
      }
    }
  }

  // --- Queries used by gameplay ---

  // Is this point on a road (within the road half width of a line)?
  isOnRoad(x, z) {
    const near = (v) => this.roadXs.some((l) => Math.abs(v - l) <= ROAD_HALF);
    return near(x) || near(z);
  }

  // Nearest point on the road network.
  nearestRoadPoint(x, z) {
    let bx = this.roadXs[0], bz = this.roadXs[0];
    for (const l of this.roadXs) {
      if (Math.abs(x - l) < Math.abs(x - bx)) bx = l;
      if (Math.abs(z - l) < Math.abs(z - bz)) bz = l;
    }
    return Math.abs(x - bx) < Math.abs(z - bz) ? { x: bx, z } : { x, z: bz };
  }

  // Circle vs building/container colliders. Returns the push-out vector.
  collide(x, z, r) {
    let px = 0, pz = 0;
    for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          px += (dx / d) * (r - d);
          pz += (dz / d) * (r - d);
        } else {
          // Center inside the box: push out along the smallest penetration.
          const left = x - c.x0, right = c.x1 - x, top = z - c.z0, bot = c.z1 - z;
          const m = Math.min(left, right, top, bot);
          if (m === left) px -= left + r;
          else if (m === right) px += right + r;
          else if (m === top) pz -= top + r;
          else pz += bot + r;
        }
      }
    }
    return { x: px, z: pz };
  }

  // Keep actors inside the playable area: city + beach + port.
  clampToWorld(x, z) {
    return {
      x: Math.max(-HALF - 14, Math.min(HALF + 90, x)),
      z: Math.max(-HALF - 14, Math.min(HALF + CITY.beachDepth - 2, z)),
    };
  }
}
