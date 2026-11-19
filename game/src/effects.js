// Particles, tracers and muzzle flashes: short-lived visual feedback for
// shots, impacts, crashes and pickups.

import * as THREE from 'three';

const MAX_PARTICLES = 600;
const MAX_TRACERS = 24;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.positions = new Float32Array(MAX_PARTICLES * 3);
    this.colors = new Float32Array(MAX_PARTICLES * 3);
    this.vels = new Float32Array(MAX_PARTICLES * 3);
    this.life = new Float32Array(MAX_PARTICLES);
    this.maxLife = new Float32Array(MAX_PARTICLES);
    this.head = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.32, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this.tracers = [];
    this.flash = new THREE.PointLight(0xffc860, 0, 14, 1.6);
    scene.add(this.flash);
    this.flashTimer = 0;
  }

  burst(pos, color, count = 14, speed = 6, up = 3) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const idx = this.head;
      this.head = (this.head + 1) % MAX_PARTICLES;
      this.positions[idx * 3] = pos.x;
      this.positions[idx * 3 + 1] = pos.y + 0.2;
      this.positions[idx * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vels[idx * 3] = Math.cos(a) * s;
      this.vels[idx * 3 + 1] = up * (0.4 + Math.random());
      this.vels[idx * 3 + 2] = Math.sin(a) * s;
      this.colors[idx * 3] = c.r;
      this.colors[idx * 3 + 1] = c.g;
      this.colors[idx * 3 + 2] = c.b;
      this.life[idx] = this.maxLife[idx] = 0.4 + Math.random() * 0.5;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  smoke(pos) { this.burst(pos, 0x777777, 10, 2, 4); }

  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
    if (this.tracers.length > MAX_TRACERS) {
      const old = this.tracers.shift();
      this.scene.remove(old.line);
      old.line.geometry.dispose();
      old.line.material.dispose();
    }
  }

  muzzle(pos) {
    this.flash.position.set(pos.x, pos.y, pos.z);
    this.flash.intensity = 26;
    this.flashTimer = 0.05;
  }

  update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      this.vels[i * 3 + 1] -= 9 * dt;
      this.positions[i * 3] += this.vels[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vels[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vels[i * 3 + 2] * dt;
      if (this.positions[i * 3 + 1] < 0.05) {
        this.positions[i * 3 + 1] = 0.05;
        this.vels[i * 3 + 1] *= -0.3;
      }
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    for (const t of this.tracers) {
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.09) * 0.9;
    }
    while (this.tracers.length && this.tracers[0].life <= 0) {
      const old = this.tracers.shift();
      this.scene.remove(old.line);
      old.line.geometry.dispose();
      old.line.material.dispose();
    }
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flash.intensity = 0;
    }
  }
}
