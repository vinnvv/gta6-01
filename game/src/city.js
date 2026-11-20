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
// Returns the wall map plus an emissive map (lit windows only, black
// elsewhere) so the windows glow at dusk and bloom picks them up.
function facadeTexture(rng, base, floors, cols) {
  const w = 128, h = 256;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const ecv = document.createElement('canvas');
  ecv.width = w; ecv.height = h;
  const eg = ecv.getContext('2d');
  eg.fillStyle = '#000000';
  eg.fillRect(0, 0, w, h);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  // Slight vertical grime near the bottom.
  const grad = g.createLinearGradient(0, h * 0.7, 0, h);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(60,40,20,0.35)');
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // Windows. Lit windows are painted almost black in the diffuse map so
  // their colour comes from the emissive map alone: otherwise the
  // hemisphere sky light (pale blue) tints shaded faces cyan. Unlit
  // windows stay dark slate in the map and get no emissive.
  // A building that rolls zero lit windows reads as a dead black slab, so
  // the pass below guarantees a minimum: it only touches buildings that
  // rolled too few, and the random calls above stay in the same order, so
  // every other building keeps its exact pattern.
  const margin = 10, gapX = (w - margin * 2) / cols, gapY = (h - 18) / floors;
  const wins = [];
  let litCount = 0;
  for (let f = 0; f < floors; f++) {
    for (let c = 0; c < cols; c++) {
      const x = margin + c * gapX + 2;
      const y = 10 + f * gapY + 3;
      const lit = rng() < 0.28;
      if (lit) litCount++;
      wins.push({ x, y, w: gapX - 5, h: gapY - 8, lit });
      g.fillStyle = lit ? '#232323' : '#2c3542';
      g.fillRect(x, y, gapX - 5, gapY - 8);
      if (lit) {
        eg.fillStyle = '#ffd98a';
        eg.fillRect(x, y, gapX - 5, gapY - 8);
      }
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, gapX - 5, 2);
    }
  }
  const minLit = Math.max(2, Math.floor(wins.length * 0.25));
  if (litCount < minLit) {
    for (const win of wins) {
      if (litCount >= minLit) break;
      if (win.lit) continue;
      win.lit = true;
      litCount++;
      g.fillStyle = '#232323';
      g.fillRect(win.x, win.y, win.w, win.h);
      eg.fillStyle = '#ffd98a';
      eg.fillRect(win.x, win.y, win.w, win.h);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(win.x, win.y, win.w, 2);
    }
  }
  // Ground floor: shopfront band.
  g.fillStyle = 'rgba(40,28,18,0.85)';
  g.fillRect(0, h - 16, w, 16);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const etex = new THREE.CanvasTexture(ecv);
  etex.colorSpace = THREE.SRGBColorSpace;
  return { map: tex, emissiveMap: etex };
}

// The whole ground as one texture: asphalt, roads, sidewalks, sand and the
// sea edge. World units map to texture pixels. Road markings, crosswalks and
// curbs are geometry (see buildStreetDetail) so they stay crisp at any
// distance; the texture carries the asphalt, pavement and ground variation.
function groundTexture() {
  const world = HALF + CITY.roadWidth + CITY.beachDepth + CITY.seaWidth + 40;
  const S = 4096;
  const scale = S / (world * 2);
  const toPx = (v) => (v + world) * scale;
  const rng = makeRng(20261120);
  const cv = document.createElement('canvas');
  cv.width = S; cv.height = S;
  const g = cv.getContext('2d');
  // Base: city asphalt, warm from the low sun.
  g.fillStyle = '#38352f';
  g.fillRect(0, 0, S, S);
  // Large soft blotches so the base is never one flat tone.
  for (let i = 0; i < 30; i++) {
    const cx = -HALF + rng() * (HALF * 2);
    const cz = -HALF + rng() * (HALF * 2);
    g.fillStyle = rng() < 0.5 ? 'rgba(255,220,170,0.05)' : 'rgba(40,30,20,0.05)';
    g.beginPath();
    g.ellipse(toPx(cx), toPx(cz), (20 + rng() * 40) * scale, (15 + rng() * 30) * scale, rng() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // Sea (south, high Z).
  g.fillStyle = '#2e7fa8';
  g.fillRect(0, toPx(HALF + CITY.beachDepth), S, S);
  // Beach sand.
  g.fillStyle = '#e8d5a4';
  g.fillRect(0, toPx(HALF), S, toPx(HALF + CITY.beachDepth) - toPx(HALF));
  // Wet sand line.
  g.fillStyle = '#d9c48d';
  g.fillRect(0, toPx(HALF + CITY.beachDepth - 6), S, 6 * scale);
  // Sand speckle and ripple lines on the beach.
  for (let i = 0; i < 900; i++) {
    const x = rng() * S;
    const y = toPx(HALF) + rng() * (CITY.beachDepth * scale);
    g.fillStyle = rng() < 0.5 ? 'rgba(120,100,60,0.20)' : 'rgba(255,246,220,0.25)';
    g.fillRect(x, y, 2, 2);
  }
  g.strokeStyle = 'rgba(160,135,90,0.35)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 26; i++) {
    const y = toPx(HALF + 4 + rng() * (CITY.beachDepth - 8));
    g.beginPath();
    for (let x = 0; x <= S; x += 64) {
      const yy = y + Math.sin(x * 0.01 + i) * 3;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
  const lines = roadLines();
  // Roads: lighter asphalt strips.
  g.fillStyle = '#4a453e';
  for (const x of lines) {
    g.fillRect(toPx(x - ROAD_HALF), 0, CITY.roadWidth * scale, toPx(HALF));
    g.fillRect(0, toPx(x - ROAD_HALF), toPx(HALF), CITY.roadWidth * scale);
  }
  // Asphalt speckle across the road area.
  for (let i = 0; i < 7000; i++) {
    const x = rng() * S;
    const y = rng() * toPx(HALF);
    g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,0.10)' : 'rgba(255,240,210,0.07)';
    g.fillRect(x, y, 2, 2);
  }
  // Darker repair patches on the roads.
  for (let i = 0; i < 46; i++) {
    const lx = lines[Math.floor(rng() * lines.length)];
    const along = -HALF + rng() * (HALF * 2);
    const vertical = rng() < 0.5;
    const w = 3 + rng() * 5;
    const h = 4 + rng() * 8;
    const cx = vertical ? lx + (rng() - 0.5) * 4 : along;
    const cz = vertical ? along : lx + (rng() - 0.5) * 4;
    g.fillStyle = rng() < 0.5 ? 'rgba(20,18,16,0.28)' : 'rgba(90,82,70,0.30)';
    g.fillRect(toPx(cx - (vertical ? w : h) / 2), toPx(cz - (vertical ? h : w) / 2), (vertical ? w : h) * scale, (vertical ? h : w) * scale);
  }
  // Tire wear: two darker wheel tracks along every road.
  g.fillStyle = 'rgba(15,13,11,0.13)';
  for (const x of lines) {
    for (const off of [-2.1, 2.1]) {
      g.fillRect(toPx(x + off - 0.7), 0, 1.4 * scale, toPx(HALF));
      g.fillRect(0, toPx(x + off - 0.7), toPx(HALF), 1.4 * scale);
    }
  }
  // Cracks: sparse dark polylines on the roads.
  g.strokeStyle = 'rgba(12,10,9,0.4)';
  g.lineWidth = 1.2;
  for (let i = 0; i < 34; i++) {
    const lx = lines[Math.floor(rng() * lines.length)];
    const vertical = rng() < 0.5;
    let ax = vertical ? lx + (rng() - 0.5) * 8 : -HALF + rng() * (HALF * 2);
    let az = vertical ? -HALF + rng() * (HALF * 2) : lx + (rng() - 0.5) * 8;
    g.beginPath();
    g.moveTo(toPx(ax), toPx(az));
    const segs = 3 + Math.floor(rng() * 4);
    for (let s = 0; s < segs; s++) {
      if (vertical) { az += 3 + rng() * 5; ax += (rng() - 0.5) * 3; }
      else { ax += 3 + rng() * 5; az += (rng() - 0.5) * 3; }
      g.lineTo(toPx(ax), toPx(az));
    }
    g.stroke();
  }
  // Sidewalks: pale warm borders around every block, with tile seams and
  // per-tile shade variation.
  for (let i = 0; i < CITY.blocksX; i++) {
    for (let j = 0; j < CITY.blocksZ; j++) {
      const x0 = -HALF + i * PITCH;
      const z0 = -HALF + j * PITCH;
      g.fillStyle = '#a89a80';
      g.fillRect(toPx(x0 - 2), toPx(z0 - 2), (CITY.blockSize + 4) * scale, (CITY.blockSize + 4) * scale);
      for (let t = 0; t < 26; t++) {
        const tx = x0 - 2 + Math.floor(rng() * 30) * 2;
        const tz = z0 - 2 + Math.floor(rng() * 30) * 2;
        g.fillStyle = rng() < 0.5 ? 'rgba(255,245,220,0.10)' : 'rgba(60,50,35,0.10)';
        g.fillRect(toPx(tx), toPx(tz), 2 * scale, 2 * scale);
      }
      g.strokeStyle = 'rgba(70,60,45,0.35)';
      g.lineWidth = 1;
      g.beginPath();
      for (let k = 0; k <= 30; k++) {
        const vx = x0 - 2 + k * 2;
        g.moveTo(toPx(vx), toPx(z0 - 2));
        g.lineTo(toPx(vx), toPx(z0 + CITY.blockSize + 2));
        const hz = z0 - 2 + k * 2;
        g.moveTo(toPx(x0 - 2), toPx(hz));
        g.lineTo(toPx(x0 + CITY.blockSize + 2), toPx(hz));
      }
      g.stroke();
    }
  }
  // Block interiors: grass, dirt and sand patches so no block is a flat
  // tan plane. Sand near the Strip (south rows), grass and dirt elsewhere.
  for (let i = 0; i < CITY.blocksX; i++) {
    for (let j = 0; j < CITY.blocksZ; j++) {
      const x0 = -HALF + i * PITCH;
      const z0 = -HALF + j * PITCH;
      const nearStrip = j >= CITY.blocksZ - 2;
      const n = 3 + Math.floor(rng() * 3);
      for (let b = 0; b < n; b++) {
        const cx = x0 + 4 + rng() * (CITY.blockSize - 8);
        const cz = z0 + 4 + rng() * (CITY.blockSize - 8);
        const rx = (4 + rng() * 9) * scale;
        const rz = (3 + rng() * 7) * scale;
        const kind = nearStrip && rng() < 0.45 ? 'sand' : (rng() < 0.55 ? 'grass' : 'dirt');
        g.fillStyle = kind === 'grass' ? 'rgba(96,128,70,0.70)'
          : kind === 'dirt' ? 'rgba(122,94,62,0.65)' : 'rgba(232,213,164,0.70)';
        g.beginPath();
        g.ellipse(toPx(cx), toPx(cz), rx, rz, rng() * Math.PI, 0, Math.PI * 2);
        g.fill();
      }
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

function planter() {
  const group = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.8, 1.7),
    new THREE.MeshLambertMaterial({ color: 0xb9a98c }),
  );
  box.position.y = 0.4;
  group.add(box);
  const shrub = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.7, 1.4),
    new THREE.MeshLambertMaterial({ color: 0x4a7d3a }),
  );
  shrub.position.y = 1.1;
  group.add(shrub);
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

// Straight-ahead lane arrow, drawn in the shape's XY plane with the tip
// at +Y. buildStreetDetail lays it flat (rotateX -90deg), so the tip then
// points along -Z and each instance's rotation.y aims it.
function arrowShape() {
  const s = new THREE.Shape();
  s.moveTo(-0.45, -1.3);
  s.lineTo(0.45, -1.3);
  s.lineTo(0.45, 0.3);
  s.lineTo(1.0, 0.3);
  s.lineTo(0, 1.3);
  s.lineTo(-1.0, 0.3);
  s.lineTo(-0.45, 0.3);
  s.closePath();
  return s;
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
    this.buildStreetDetail();
    this.buildBlocks();
    this.buildSidewalkProps();
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

  // Crisp street furniture as geometry: the ground texture is only ~3.4 px
  // per world unit, so markings drawn in it smear. These instanced meshes
  // sit just above the ground and stay sharp at any distance. Layout,
  // widths and physics are untouched; this is paint and curbs only.
  buildStreetDetail() {
    const scene = this.scene;
    const lines = this.roadXs;
    const rng = makeRng(777);
    const flat = (geo) => { geo.rotateX(-Math.PI / 2); return geo; };
    const markWhite = new THREE.MeshBasicMaterial({ color: 0xf2ecdc });
    const markYellow = new THREE.MeshBasicMaterial({ color: 0xe3c04e });
    const markDark = new THREE.MeshBasicMaterial({ color: 0x2a2724 });
    const markSkid = new THREE.MeshBasicMaterial({ color: 0x1a1714, transparent: true, opacity: 0.32 });
    for (const m of [markWhite, markYellow, markDark, markSkid]) {
      m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -2;
    }
    const dummy = new THREE.Object3D();
    const place = (mesh, list) => {
      list.forEach((t, idx) => {
        dummy.position.set(t.p[0], t.p[1], t.p[2]);
        dummy.rotation.set(0, t.r || 0, 0);
        dummy.scale.set(t.s[0], t.s[1], t.s[2]);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      scene.add(mesh);
    };
    const unitPlane = () => flat(new THREE.PlaneGeometry(1, 1));

    // Solid white edge lines along both edges of every road. The visible
    // asphalt runs 5 units either side of the centerline (the sidewalk
    // rects overdraw the outer 2 units), so the lines sit at +/-4.6.
    {
      const list = [];
      for (const l of lines) {
        for (const off of [-4.6, 4.6]) {
          list.push({ p: [l + off, 0.02, 0], r: 0, s: [0.3, 1, HALF * 2] });
          list.push({ p: [0, 0.02, l + off], r: Math.PI / 2, s: [0.3, 1, HALF * 2] });
        }
      }
      place(new THREE.InstancedMesh(unitPlane(), markWhite, list.length), list);
    }
    // Yellow dashed center lines, broken at intersections.
    {
      const list = [];
      const nearLine = (v) => lines.some((l) => Math.abs(v - l) < 11);
      for (const l of lines) {
        for (let v = -HALF; v < HALF; v += 8) {
          if (nearLine(v)) continue;
          list.push({ p: [l, 0.02, v], r: 0, s: [0.45, 1, 3] });
          list.push({ p: [v, 0.02, l], r: Math.PI / 2, s: [0.45, 1, 3] });
        }
      }
      place(new THREE.InstancedMesh(unitPlane(), markYellow, list.length), list);
    }
    // Crosswalk stripes, stop lines and lane arrows at every intersection.
    {
      const stripes = [];
      const stops = [];
      const arrows = [];
      const arrowGeo = flat(new THREE.ShapeGeometry(arrowShape()));
      for (const lx of lines) {
        for (const lz of lines) {
          for (let k = -3; k <= 3; k++) {
            stripes.push({ p: [lx + k * 1.6, 0.02, lz - 9.5], r: 0, s: [0.9, 1, 10] });
            stripes.push({ p: [lx + k * 1.6, 0.02, lz + 9.5], r: 0, s: [0.9, 1, 10] });
            stripes.push({ p: [lx - 9.5, 0.02, lz + k * 1.6], r: Math.PI / 2, s: [0.9, 1, 10] });
            stripes.push({ p: [lx + 9.5, 0.02, lz + k * 1.6], r: Math.PI / 2, s: [0.9, 1, 10] });
          }
          stops.push({ p: [lx, 0.02, lz - 12.5], r: 0, s: [10, 1, 0.5] });
          stops.push({ p: [lx, 0.02, lz + 12.5], r: 0, s: [10, 1, 0.5] });
          stops.push({ p: [lx - 12.5, 0.02, lz], r: Math.PI / 2, s: [10, 1, 0.5] });
          stops.push({ p: [lx + 12.5, 0.02, lz], r: Math.PI / 2, s: [10, 1, 0.5] });
          // Lane arrows on each approach, right-hand lane, facing the crossing.
          arrows.push({ p: [lx - 2.2, 0.02, lz - 17], r: Math.PI, s: [1, 1, 1] });
          arrows.push({ p: [lx + 2.2, 0.02, lz + 17], r: 0, s: [1, 1, 1] });
          arrows.push({ p: [lx - 17, 0.02, lz + 2.2], r: -Math.PI / 2, s: [1, 1, 1] });
          arrows.push({ p: [lx + 17, 0.02, lz - 2.2], r: Math.PI / 2, s: [1, 1, 1] });
        }
      }
      place(new THREE.InstancedMesh(unitPlane(), markWhite, stripes.length), stripes);
      place(new THREE.InstancedMesh(unitPlane(), markWhite, stops.length), stops);
      place(new THREE.InstancedMesh(arrowGeo, markWhite, arrows.length), arrows);
    }
    // Raised curbs along every block side, with gaps at the corners where
    // the crosswalks cut through.
    {
      const list = [];
      for (let i = 0; i < CITY.blocksX; i++) {
        for (let j = 0; j < CITY.blocksZ; j++) {
          const bx = -HALF + i * PITCH;
          const bz = -HALF + j * PITCH;
          const cx = bx + CITY.blockSize / 2;
          const cz = bz + CITY.blockSize / 2;
          list.push({ p: [bx - 2, 0.07, cz], r: Math.PI / 2, s: [50, 1, 1] });
          list.push({ p: [bx + CITY.blockSize + 2, 0.07, cz], r: Math.PI / 2, s: [50, 1, 1] });
          list.push({ p: [cx, 0.07, bz - 2], r: 0, s: [50, 1, 1] });
          list.push({ p: [cx, 0.07, bz + CITY.blockSize + 2], r: 0, s: [50, 1, 1] });
        }
      }
      const curbGeo = new THREE.BoxGeometry(1, 0.14, 0.4);
      const curbMat = new THREE.MeshLambertMaterial({ color: 0xc9bda2 });
      place(new THREE.InstancedMesh(curbGeo, curbMat, list.length), list);
    }
    // Manhole covers mid-block along the roads.
    {
      const holes = [];
      for (let li = 0; li < lines.length; li++) {
        for (let i = 0; i < CITY.blocksX; i += 2) {
          const c = -HALF + i * PITCH + CITY.blockSize / 2;
          holes.push({ p: [lines[li] + 2.5, 0.02, c], r: 0, s: [1, 1, 1] });
          holes.push({ p: [c, 0.02, lines[li] + 2.5], r: 0, s: [1, 1, 1] });
        }
      }
      const holeGeo = flat(new THREE.CircleGeometry(0.75, 14));
      place(new THREE.InstancedMesh(holeGeo, markDark, holes.length), holes);
    }
    // Skid marks near stop lines.
    {
      const skids = [];
      for (let n = 0; n < 48; n++) {
        const lx = lines[Math.floor(rng() * lines.length)];
        const lz = lines[Math.floor(rng() * lines.length)];
        const dir = Math.floor(rng() * 4);
        const lane = rng() < 0.5 ? -2.2 : 2.2;
        let p, r;
        if (dir === 0) { p = [lx + lane, 0.03, lz - 15 - rng() * 4]; r = (rng() - 0.5) * 0.3; }
        else if (dir === 1) { p = [lx + lane, 0.03, lz + 15 + rng() * 4]; r = Math.PI + (rng() - 0.5) * 0.3; }
        else if (dir === 2) { p = [lx - 15 - rng() * 4, 0.03, lz + lane]; r = Math.PI / 2 + (rng() - 0.5) * 0.3; }
        else { p = [lx + 15 + rng() * 4, 0.03, lz - lane]; r = -Math.PI / 2 + (rng() - 0.5) * 0.3; }
        skids.push({ p, r, s: [0.9, 1, 4.5] });
      }
      place(new THREE.InstancedMesh(unitPlane(), markSkid, skids.length), skids);
    }
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
          const { map, emissiveMap } = facadeTexture(makeRng(hashSeed(`${i},${j},${b}`)), pick(rng, palette), floors, cols);
          const mat = new THREE.MeshLambertMaterial({ map, emissiveMap, emissive: 0xffffff, emissiveIntensity: 1.2 });
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
    const { map: casinoMap, emissiveMap: casinoEmissive } = facadeTexture(makeRng(99), '#3f6d8e', 14, 8);
    const casino = new THREE.Mesh(
      new THREE.BoxGeometry(30, 52, 22),
      new THREE.MeshLambertMaterial({ map: casinoMap, emissiveMap: casinoEmissive, emissive: 0xffffff, emissiveIntensity: 1.2 }),
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

  // Sidewalk props for the street shot's block (5,7): it holds one
  // building at its south end and the rest was bare sidewalk, which is why
  // the right half of the street frame read as an empty cream plane.
  // Fixed positions, no colliders (like the other palms and lamps), so the
  // player and traffic pass through them as they do everywhere else.
  // They sit north of building #50 and behind the cover camera, so the
  // other three shots are unaffected.
  buildSidewalkProps() {
    const add = (obj, x, z) => {
      obj.position.set(x, 0, z);
      this.scene.add(obj);
    };
    for (const [x, z] of [[76, 234], [92, 224], [108, 214], [118, 232]]) add(palmTree(), x, z);
    for (const [x, z] of [[72, 218], [72, 236]]) add(streetLight(), x, z);
    for (const [x, z] of [[80, 228], [100, 220], [112, 236]]) add(planter(), x, z);
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
    // The dock fight yard: a dense, fixed cluster around (312, 100) where
    // the Los Buitres shootouts happen, so the mission shot reads as a
    // working dock, not an empty apron. Props ring the fight area; the
    // middle stays open so Rico and the gang can move. Deterministic, from
    // its own seed, so the 22 random containers above never move.
    {
      const dockRng = makeRng(4242);
      const dockCols = ['#c94f3d', '#3d7ac9', '#4fae5a', '#d8a13c'];
      const addBox = (x, z, w, h, d, color, rotY = 0) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
        m.position.set(x, h / 2, z);
        m.rotation.y = rotY;
        m.castShadow = true;
        this.scene.add(m);
        const hw = (rotY === 0 ? w : d) / 2, hd = (rotY === 0 ? d : w) / 2;
        this.colliders.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });
        return m;
      };
      // Container walls east, north and south of the fight area.
      for (const z of [66, 82, 98, 114, 130]) {
        addBox(350, z, 2.6, 2.6, 12, pick(dockRng, dockCols), Math.PI / 2);
      }
      addBox(350, 82, 2.6, 2.6, 12, pick(dockRng, dockCols), Math.PI / 2).position.y = 3.9;
      addBox(350, 114, 2.6, 2.6, 12, pick(dockRng, dockCols), Math.PI / 2).position.y = 3.9;
      for (const x of [298, 312, 326]) addBox(x, 70, 12, 2.6, 2.6, pick(dockRng, dockCols));
      for (const x of [300, 316, 332]) addBox(x, 134, 12, 2.6, 2.6, pick(dockRng, dockCols));
      // Crates at the corners of the yard.
      for (const [x, z] of [[296, 72], [340, 132], [296, 124], [344, 68], [298, 136]]) {
        addBox(x, z, 2.2, 2.2, 2.2, 0x9a7b4f);
      }
      addBox(340, 132, 2.2, 2.2, 2.2, 0x9a7b4f).position.y = 3.3;
      // Barrel clusters.
      const barrelMat = new THREE.MeshLambertMaterial({ color: 0x3d7ac9 });
      const barrelMat2 = new THREE.MeshLambertMaterial({ color: 0xc94f3d });
      for (const [cx, cz] of [[342, 120], [302, 66], [338, 84]]) {
        for (let i = 0; i < 3; i++) {
          const b = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2, 10), i % 2 ? barrelMat : barrelMat2);
          b.position.set(cx + (i - 1) * 2, 1, cz + (i % 2 ? 1 : -1));
          b.castShadow = true;
          this.scene.add(b);
          this.colliders.push({ x0: b.position.x - 0.9, z0: b.position.z - 0.9, x1: b.position.x + 0.9, z1: b.position.z + 0.9 });
        }
      }
      // Two parked trucks: cab plus trailer, static props.
      const truck = (x, z, rotY) => {
        const g = new THREE.Group();
        const cab = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 2.2), new THREE.MeshLambertMaterial({ color: 0xd8d3c8 }));
        cab.position.set(0, 1.3, 3.6);
        const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3, 6), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
        trailer.position.set(0, 1.5, -1);
        g.add(cab, trailer);
        g.position.set(x, 0, z);
        g.rotation.y = rotY;
        g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        this.scene.add(g);
        this.colliders.push({ x0: x - 4, z0: z - 4, x1: x + 4, z1: z + 4 });
      };
      truck(360, 100, Math.PI / 2);
      truck(296, 142, 0);
      // A fence along the east edge of the apron.
      const fenceMat = new THREE.MeshLambertMaterial({ color: 0x8a8f94 });
      for (let z = 60; z <= 140; z += 8) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.2, 8), fenceMat);
        seg.position.set(370, 1.1, z);
        this.scene.add(seg);
        this.colliders.push({ x0: 369.8, z0: z - 4, x1: 370.2, z1: z + 4 });
      }
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
