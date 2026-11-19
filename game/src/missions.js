// The story: five missions for Rico Marin, from his release to the big
// score. Each mission is a list of stages; a stage ends when its check
// passes. The marker (a light beacon and a minimap blip) always points at
// the current objective.

import * as THREE from 'three';
import { MISSIONS } from './config.js';
import { Car } from './vehicles.js';

function beacon(scene) {
  const group = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 2.2, 26, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }),
  );
  pillar.position.y = 13;
  group.add(pillar);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color: 0xffd23e }),
  );
  diamond.position.y = 5.5;
  group.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);
  group.userData.diamond = diamond;
  scene.add(group);
  return group;
}

export class Missions {
  constructor(scene, city) {
    this.scene = scene;
    this.city = city;
    this.current = -1; // index into MISSIONS, -1 = story not started
    this.stage = 0;
    this.active = false;
    this.marker = null;
    this.markerPos = null;
    this.beacon = null;
    this.waitTimer = 0;
    this.done = false;
    this.sofiaCar = null;
    this.comet = null;
    this.message = null;
    this.messageTimer = 0;
  }

  dispose() {
    if (this.beacon) this.scene.remove(this.beacon);
    this.beacon = null;
    this.clearMarker();
  }

  setMarker(x, z) {
    this.markerPos = { x, z };
    if (!this.beacon) this.beacon = beacon(this.scene);
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  }

  clearMarker() {
    this.markerPos = null;
    if (this.beacon) this.beacon.visible = false;
  }

  startStory(ctx) {
    if (this.current !== -1) return;
    this.ctx = ctx;
    this.current = 0;
    this.stage = 0;
    this.active = true;
    this.startStage();
  }

  startStage() {
    const m = MISSIONS[this.current];
    const ctx = this.ctx;
    if (this.current === 0) {
      if (this.stage === 0) {
        // Sofia's sedan waits by the Anchor bar.
        if (!this.sofiaCar) {
          this.sofiaCar = new Car(this.scene, 'sedan', 0x3fae6a, -214, -147, Math.PI / 2);
          this.sofiaCar.isMissionCar = true;
          ctx.traffic.cars.push(this.sofiaCar);
        }
        this.setMarker(-214, -147);
        this.message = 'Get in Sofia\'s green sedan by the Anchor.';
      } else if (this.stage === 1) {
        this.setMarker(310, 100);
        this.message = 'Drive to the docks to meet Sofia.';
      }
    } else if (this.current === 1) {
      if (this.stage === 0) {
        if (!this.comet) {
          this.comet = new Car(this.scene, 'sport', 0xc23b2e, 63, 283, Math.PI);
          this.comet.isMissionCar = true;
          ctx.traffic.cars.push(this.comet);
        }
        this.setMarker(63, 283);
        this.message = 'Steal the red Comet GT on the Strip.';
      } else if (this.stage === 1) {
        this.setMarker(310, -50);
        this.message = 'Deliver the Comet to the chop shop at Harbor Yards.';
      }
    } else if (this.current === 2) {
      if (this.stage === 0) {
        ctx.police.addHeat(2, ctx.now);
        this.clearMarker();
        this.message = 'The cops are on you. Lose them.';
      } else if (this.stage === 1) {
        this.clearMarker();
        this.message = 'Stay out of sight until the heat dies down.';
      }
    } else if (this.current === 3) {
      if (this.stage === 0) {
        this.setMarker(310, 100);
        this.message = 'Get to Harbor Yards. Los Buitres hold the docks.';
      } else if (this.stage === 1) {
        const spots = [
          { x: 300, z: 88 }, { x: 318, z: 104 }, { x: 306, z: 118 },
          { x: 326, z: 92 }, { x: 312, z: 76 }, { x: 334, z: 112 },
        ];
        ctx.combat.spawnGang(spots);
        this.setMarker(312, 100);
        this.message = 'Clear out Los Buitres. Six gunmen hold the dock.';
      }
    } else if (this.current === 4) {
      if (this.stage === 0) {
        this.setMarker(63, -24);
        this.message = 'Get to the Solmar Grand casino.';
      } else if (this.stage === 1) {
        this.setMarker(63, -24);
        this.message = 'Grab the weekend take from the back room.';
      } else if (this.stage === 2) {
        this.setMarker(0, 338);
        this.message = 'Escape to the marina boat. The cops are coming.';
      }
    }
    this.messageTimer = 5;
  }

  completeStage() {
    this.stage++;
    const stages = this.stageCount();
    if (this.stage >= stages) this.completeMission();
    else this.startStage();
  }

  stageCount() {
    return [2, 2, 2, 2, 3][this.current];
  }

  completeMission() {
    const m = MISSIONS[this.current];
    this.ctx.addCash?.(m.reward);
    this.ctx.onMissionComplete?.(m);
    this.clearMarker();
    this.current++;
    this.stage = 0;
    if (this.current >= MISSIONS.length) {
      this.done = true;
      this.active = false;
      this.message = 'Story complete. Solmar is yours, Rico. Free roam.';
      this.messageTimer = 8;
      return;
    }
    this.waitTimer = 3.5;
    this.active = false;
  }

  update(dt, ctx) {
    this.ctx = ctx;
    if (this.beacon && this.beacon.visible) {
      this.beacon.userData.diamond.rotation.y += dt * 2;
      this.beacon.userData.diamond.position.y = 5.5 + Math.sin(ctx.now * 2) * 0.5;
    }
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (!this.active) {
      if (this.waitTimer > 0) {
        this.waitTimer -= dt;
        if (this.waitTimer <= 0 && !this.done) {
          this.active = true;
          this.startStage();
        }
      }
      return;
    }
    const player = ctx.player;
    const inCar = !!player.inCar;
    const pos = inCar ? player.inCar.pos : player.pos;
    const near = (x, z, r = 12) => Math.hypot(pos.x - x, pos.z - z) < r;

    if (this.current === 0) {
      if (this.stage === 0 && inCar && player.inCar === this.sofiaCar) this.completeStage();
      else if (this.stage === 1 && near(310, 100)) this.completeStage();
    } else if (this.current === 1) {
      if (this.stage === 0 && inCar && player.inCar === this.comet) {
        ctx.police.addHeat(1, ctx.now);
        this.completeStage();
      } else if (this.stage === 1 && inCar && player.inCar === this.comet && near(310, -50)) {
        const i = ctx.traffic.cars.indexOf(this.comet);
        if (i >= 0) ctx.traffic.cars.splice(i, 1);
        this.comet.remove(this.scene);
        this.completeStage();
      }
    } else if (this.current === 2) {
      if (this.stage === 0 && ctx.police.wanted >= 2) this.completeStage();
      else if (this.stage === 1 && ctx.police.wanted === 0) this.completeStage();
    } else if (this.current === 3) {
      if (this.stage === 0 && near(310, 100, 16)) this.completeStage();
      else if (this.stage === 1 && ctx.combat.aliveEnemies() === 0) this.completeStage();
    } else if (this.current === 4) {
      if (this.stage === 0 && near(63, -24, 14)) this.completeStage();
      else if (this.stage === 1) {
        // The take is grabbed on arrival; heat jumps to 3 stars.
        ctx.police.addHeat(3, ctx.now);
        this.message = 'Take grabbed. Three stars. Run for the boat.';
        this.messageTimer = 5;
        this.completeStage();
      } else if (this.stage === 2 && near(0, 338, 12)) this.completeStage();
    }
  }

  objectiveText() {
    if (!this.active || this.current < 0 || this.done) {
      if (this.done) return { title: 'Solmar', text: 'Free roam. The city is yours.' };
      return { title: 'Solmar', text: 'Explore the city. Missions start at the Anchor bar.' };
    }
    const m = MISSIONS[this.current];
    return { title: `${m.name}  ($${m.reward})`, text: this.message || '' };
  }
}
