// Pickups: weapon and supply caches scattered around Solmar. Each one is
// a low-poly prop on the ground (a gun, a first-aid kit, a vest) with a
// glowing marker bobbing above it and a pulsing ring at its feet. Walk over
// one to collect it: a gun joins the arsenal with a full magazine, a health
// kit patches Rico up, an armor vest soaks damage before his health does.

import * as THREE from 'three';

// kind, world spot, what it hands out. Weapon spots are where the story
// puts them: the shotgun waits on the dock fight yard, the SMG on the
// Strip sidewalk, the rifle by the Solmar Grand's front steps. Health and
// armor sit where a hurt Rico would look: the Anchor, the beach, the docks,
// the Grand, the beach road.
const SPECS = [
  { id: 'shotgun', kind: 'gun', x: 304, z: 122, label: 'Shotgun' },
  { id: 'smg', kind: 'gun', x: 110, z: 258, label: 'SMG' },
  { id: 'rifle', kind: 'gun', x: 70, z: 14, label: 'Assault Rifle' },
  { id: 'health1', kind: 'health', x: -210, z: -120, label: 'Health Kit' },
  { id: 'health2', kind: 'health', x: -60, z: 300, label: 'Health Kit' },
  { id: 'health3', kind: 'health', x: 318, z: 140, label: 'Health Kit' },
  { id: 'armor1', kind: 'armor', x: 63, z: 40, label: 'Armor Vest' },
  { id: 'armor2', kind: 'armor', x: 150, z: 270, label: 'Armor Vest' },
];

const MARKER_COLORS = { gun: 0xffd23e, health: 0x58c96b, armor: 0x3d7ac9 };

// Barrel length per gun, so the three props read differently at a glance.
const BARREL = { shotgun: 0.95, smg: 0.5, rifle: 1.15 };

function lambert(color, emissive = 0, intensity = 0) {
  return new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: intensity });
}

// A gun lying flat on the ground: barrel, body, stock, grip.
function gunProp(id) {
  const g = new THREE.Group();
  const metal = lambert(0x232326);
  const wood = lambert(id === 'shotgun' ? 0x7a5230 : 0x3a3a40);
  const barrelLen = BARREL[id] || 0.8;
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(barrelLen, 0.09, 0.09), metal);
  barrel.position.set(barrelLen / 2 + 0.15, 0.16, 0);
  g.add(barrel);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.12), metal);
  body.position.set(0, 0.16, 0);
  g.add(body);
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.11), wood);
  stock.position.set(-0.45, 0.17, 0);
  g.add(stock);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.1), wood);
  grip.position.set(-0.08, 0.05, 0);
  grip.rotation.z = 0.3;
  g.add(grip);
  g.rotation.y = 0.7;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// A white first-aid box with a red cross on its lid.
function healthProp() {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.5, 0.65), lambert(0xf2f2ee));
  box.position.y = 0.25;
  g.add(box);
  const crossMat = lambert(0xd83a2e, 0xd83a2e, 0.35);
  const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.5), crossMat);
  v.position.y = 0.52;
  g.add(v);
  const h = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.16), crossMat);
  h.position.y = 0.52;
  g.add(h);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// A folded vest: dark shell with a lighter chest plate.
function armorProp() {
  const g = new THREE.Group();
  const shell = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.6), lambert(0x2c3e50));
  shell.position.y = 0.21;
  g.add(shell);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.42), lambert(0x5a6d80));
  plate.position.y = 0.48;
  g.add(plate);
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.1, 0.14), lambert(0x1c2836));
  strap.position.y = 0.3;
  g.add(strap);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.time = 0;
    for (const spec of SPECS) {
      const group = new THREE.Group();
      group.position.set(spec.x, 0, spec.z);
      const prop = spec.kind === 'gun' ? gunProp(spec.id)
        : spec.kind === 'health' ? healthProp() : armorProp();
      group.add(prop);
      const color = MARKER_COLORS[spec.kind];
      const marker = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.34),
        new THREE.MeshBasicMaterial({ color }),
      );
      marker.position.y = 1.7;
      group.add(marker);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.75, 1.0, 24),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      group.add(ring);
      scene.add(group);
      this.items.push({ spec, group, marker, ring, taken: false });
    }
  }

  // Bob and spin the markers, pulse the rings, and hand out anything the
  // player walks over. onCollect gets the spec of what was taken.
  update(dt, player, onCollect) {
    this.time += dt;
    for (const item of this.items) {
      if (item.taken) continue;
      item.marker.position.y = 1.7 + Math.sin(this.time * 2.2 + item.spec.x) * 0.16;
      item.marker.rotation.y += dt * 1.6;
      const pulse = 1 + Math.sin(this.time * 2.2) * 0.12;
      item.ring.scale.setScalar(pulse);
      if (player.inCar || player.dead) continue;
      const dx = player.pos.x - item.spec.x;
      const dz = player.pos.z - item.spec.z;
      if (dx * dx + dz * dz < 2.4 * 2.4) {
        item.taken = true;
        item.group.visible = false;
        onCollect(item.spec);
      }
    }
  }

  // New game: every cache is back on the ground.
  reset() {
    for (const item of this.items) {
      item.taken = false;
      item.group.visible = true;
    }
  }

  remaining() {
    return this.items.filter((i) => !i.taken).length;
  }
}
