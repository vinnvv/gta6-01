// Boot and the one loop: the world is built once, then the game moves
// between menu, playing, paused and ended. The loop reads input every
// frame, advances the systems, moves the camera, paints the HUD and renders.
//
// ?shot=cover|street|mission|drive stages that scene from the real rules
// (a few frames run first so the police and traffic spawn, then the scene
// is posed, then the world freezes and window.__done is set).

import * as THREE from 'three';
import { EffectComposer } from '../vendor/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/postprocessing/RenderPass.js';
import { ShaderPass } from '../vendor/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from '../vendor/postprocessing/UnrealBloomPass.js';
import { OutputPass } from '../vendor/postprocessing/OutputPass.js';
import { CFG, MISSIONS } from './config.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { City } from './city.js';
import { Traffic } from './vehicles.js';
import { Player } from './player.js';
import { Pedestrians } from './pedestrians.js';
import { Police } from './police.js';
import { Combat } from './combat.js';
import { Effects } from './effects.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const SPAWN = { x: -210, z: -140 }; // The Rusty Anchor bar.
const CAM_DIST_FOOT = 6.5;
const CAM_DIST_CAR = 11;

const canvas = document.getElementById('game');

// --- Renderer, scene, sky, lights -----------------------------------------

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xe89b4a, 200, 760);

// Golden-hour sky dome: a custom shader, warm orange at the horizon
// rising through pink to a purple dusk overhead, with a glowing sun disc
// low in the west. The sun position below matches the directional light.
const SUN_DIR = new THREE.Vector3(220, 260, 140).normalize();
{
  const geo = new THREE.SphereGeometry(900, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      sunDir: { value: SUN_DIR },
      topColor: { value: new THREE.Color(0x5f6a9e) },
      midColor: { value: new THREE.Color(0xef8a5f) },
      horizonColor: { value: new THREE.Color(0xff9e50) },
      sunColor: { value: new THREE.Color(0xfff3c8) },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vDir;
      uniform vec3 sunDir;
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      void main() {
        float h = clamp(vDir.y, -0.08, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
        col = mix(col, topColor, smoothstep(0.22, 0.75, h));
        float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
        col += sunColor * pow(s, 350.0) * 3.0;
        col += vec3(1.0, 0.55, 0.25) * pow(s, 18.0) * 0.55;
        col += vec3(1.0, 0.4, 0.55) * pow(s, 6.0) * 0.06;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(geo, skyMat);
  scene.add(sky);
}

const sun = new THREE.DirectionalLight(0xffe0b3, 2.4);
sun.position.set(220, 260, 140);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -320; sun.shadow.camera.right = 320;
sun.shadow.camera.top = 320; sun.shadow.camera.bottom = -320;
sun.shadow.camera.far = 900;
sun.shadow.bias = -0.0002;
sun.shadow.normalBias = 0.3;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.85));

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);
camera.position.set(SPAWN.x, 30, SPAWN.z + 60);

// Post-processing: bloom for lit windows, the sun and neon, plus a warm
// golden-hour grade and vignette. Vendored three r160 modules, all local.
// If the composer fails to init for any reason, the game falls back to a
// plain renderer.render so it never crashes.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignette: { value: 0.2 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      col = col * 0.94 + 0.03;
      col = mix(col, col * vec3(1.05, 1.0, 0.94), 0.6);
      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, 1.08);
      col = col * col * (3.0 - 2.0 * col) * 0.12 + col * 0.88;
      float d = distance(vUv, vec2(0.5));
      col *= 1.0 - vignette * smoothstep(0.45, 0.95, d);
      gl_FragColor = vec4(col, c.a);
    }`,
};

let composer = null;
try {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.42, 0.55, 0.85,
  ));
  composer.addPass(new ShaderPass(GradeShader));
  composer.addPass(new OutputPass());
} catch (err) {
  composer = null;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  if (composer) composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Systems ---------------------------------------------------------------

const city = new City(scene);
const traffic = new Traffic(scene, city);
const peds = new Pedestrians(scene, city);
const police = new Police(scene, city);
const effects = new Effects(scene);
const combat = new Combat(scene, effects);
const player = new Player(scene, SPAWN.x, SPAWN.z);
let missions = new Missions(scene, city);
const audio = new AudioEngine();
const input = new Input(canvas);

const state = { cash: 0, muted: false };
let screen = 'menu';
let gameTime = 0;
let camYaw = 2.4;
let camPitch = 0.3;
let lastShootCrime = -99;
let saveTimer = 0;
let regTimer = 0;
let prevHealth = 100;
let shotFrames = 0;
let shotFrozen = false;
let shotStaged = false;
let menuAngle = 0;

// The object the shot stager poses.
const game = {
  player, traffic, police, combat, missions, city, scene,
  get camYaw() { return camYaw; },
  set camYaw(v) { camYaw = v; },
  get camPitch() { return camPitch; },
  set camPitch(v) { camPitch = v; },
};

// Buildings are always hittable (bullet impacts, camera occlusion).
for (const mesh of city.buildingMeshes) combat.register(mesh, 'world', null);

// --- Save ------------------------------------------------------------------

function saveGame() {
  writeSave({
    cash: state.cash,
    missionsDone: missions.done ? MISSIONS.length : Math.max(0, missions.current),
    currentMission: missions.done ? MISSIONS.length : Math.max(0, missions.current),
    hasPistol: player.hasPistol,
    playerPos: { x: player.pos.x, z: player.pos.z },
    muted: state.muted,
  });
}

function loadIntoGame(save) {
  state.cash = save.cash || 0;
  state.muted = !!save.muted;
  player.hasPistol = save.hasPistol !== false;
  player.weapon = player.hasPistol ? 'pistol' : 'fists';
  if (save.playerPos) player.pos.set(save.playerPos.x, 0, save.playerPos.z);
  const idx = save.currentMission || 0;
  if (idx >= MISSIONS.length) {
    missions.done = true;
    missions.active = false;
  } else {
    // startStage needs the mission context (traffic, police, audio); it is
    // normally set by update, but a fresh load has not run a frame yet.
    missions.ctx = missionCtx();
    missions.current = idx;
    missions.stage = 0;
    missions.active = true;
    missions.startStage();
  }
  hud.setCash(state.cash);
}

// --- HUD and menus ----------------------------------------------------------

const hud = new HUD({
  onNewGame: () => {
    audio.ensure();
    if (state.muted) audio.setMuted(true);
    audio.startMusic();
    resetGame();
    startPlaying();
  },
  onContinue: () => {
    audio.ensure();
    if (state.muted) audio.setMuted(true);
    audio.startMusic();
    const save = loadSave();
    resetGame();
    if (save) loadIntoGame(save);
    startPlaying();
  },
  onResume: () => {
    screen = 'playing';
    hud.showPause(false);
  },
  onSaveQuit: () => {
    saveGame();
    input.unlock();
    toMenu();
  },
  onRespawn: () => respawn(),
});

function startPlaying() {
  screen = 'playing';
  hud.hideMenu();
  hud.hideEnd();
  hud.showPause(false);
  if (missions.current === -1 && !missions.done) missions.startStory(missionCtx());
  const obj = missions.objectiveText();
  hud.setObjective(obj.title, obj.text);
}

function toMenu() {
  screen = 'menu';
  hud.showMenu(!!loadSave());
}

function resetGame() {
  if (player.inCar) player.exitCar();
  police.clearAll();
  combat.clearGang();
  traffic.reset();
  peds.reset();
  missions.dispose();
  missions = new Missions(scene, city);
  game.missions = missions;
  player.pos.set(SPAWN.x, 0, SPAWN.z);
  player.heading = 0.8;
  player.vel.x = 0; player.vel.z = 0;
  player.health = 100;
  player.dead = false;
  player.weapon = 'fists';
  player.hasPistol = true;
  player.ammo = CFG.weapons.pistol.mag;
  player.reloadTimer = 0;
  player.mesh.visible = true;
  state.cash = 0;
  prevHealth = 100;
  camYaw = 2.4;
  camPitch = 0.3;
  hud.setCash(0);
  hud.setHealth(100);
  hud.setWanted(0);
}

function respawn() {
  // Wasted or busted: lose 10% of the cash, wake up by the Anchor, heat gone.
  player.health = 100;
  player.dead = false;
  player.pos.set(SPAWN.x, 0, SPAWN.z);
  player.vel.x = 0; player.vel.z = 0;
  player.mesh.visible = true;
  if (player.inCar) player.exitCar();
  police.clearAll();
  combat.clearGang();
  state.cash = Math.floor(state.cash * 0.9);
  hud.setCash(state.cash);
  // A failed dock fight restarts at the docks, not at an empty room.
  if (missions.current === 3 && missions.stage === 1) {
    missions.stage = 0;
    missions.startStage();
  }
  prevHealth = 100;
  hud.hideEnd();
  screen = 'playing';
  saveGame();
}

function missionCtx() {
  return {
    player, traffic, police, combat, audio, effects,
    now: gameTime,
    addCash: (n) => { state.cash += n; hud.setCash(state.cash); },
    onMissionComplete: (m) => {
      audio.missionDone();
      hud.showMessage(`Mission complete: ${m.name}. +$${m.reward}.`, 5);
      saveGame();
    },
  };
}

// --- Combat helpers ---------------------------------------------------------

function nearestCar(maxD = 4.5) {
  let best = null, bestD = maxD;
  const consider = (car) => {
    if (!car || car.dead) return;
    const d = Math.hypot(car.pos.x - player.pos.x, car.pos.z - player.pos.z);
    if (d < bestD) { best = car; bestD = d; }
  };
  for (const car of traffic.cars) consider(car);
  for (const car of police.cars) consider(car);
  return best;
}

function tryEnterExitCar() {
  if (player.inCar) {
    player.exitCar();
    audio.blip(300, 0.06, 'square', 0.1);
    return;
  }
  const car = nearestCar();
  if (!car) return;
  player.enterCar(car);
  audio.blip(300, 0.06, 'square', 0.1);
  if (!car.isMissionCar && !car.stolen) {
    car.stolen = true;
    const isPoliceCar = police.cars.includes(car);
    police.addHeat(1, gameTime);
    hud.showMessage(isPoliceCar ? 'You stole a police car! The cops are coming.' : 'Car stolen! The cops are on to you.', 4);
  }
}

function handleShotResult(hit) {
  if (!hit || hit === 'reload') return;
  audio.gunshot();
  if (hit.kind === 'ped' && hit.ref && !hit.ref.dead) {
    hit.ref.kill();
    peds.addThreat(player.pos.x, player.pos.z);
    police.addHeat(1, gameTime);
  } else if (hit.kind === 'enemy' && hit.ref) {
    combat.damageEnemy(hit.ref, CFG.weapons.pistol.damage);
    if (hit.ref.dead) {
      state.cash += 25;
      hud.setCash(state.cash);
      hud.showMessage('Los Buitres gunman down. +$25.', 3);
    }
  } else if (hit.kind === 'car' && hit.ref) {
    const car = hit.ref;
    car.damage(CFG.weapons.pistol.damage);
    if (car.dead) {
      effects.burst(car.pos.clone().setY(1), 0xff7a2a, 26, 9, 5);
      effects.smoke(car.pos.clone().setY(1.5));
      if (police.cars.includes(car)) police.addHeat(1, gameTime);
    }
  } else if (hit.kind === 'cop' && hit.ref) {
    const result = police.damageCop(hit.ref, CFG.weapons.pistol.damage, gameTime);
    if (result === 'dead') hud.showMessage('You shot a cop. The whole city is after you.', 4);
  }
  // Firing near the police is a crime, at most once every five seconds.
  if (gameTime - lastShootCrime > 5) {
    const near = police.cars.some((c) => Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 80)
      || police.cops.some((c) => Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z) < 80);
    if (near) {
      police.addHeat(1, gameTime);
      lastShootCrime = gameTime;
    }
  }
}

function handlePunchResult(hit) {
  if (!hit) return;
  audio.punch();
  if (hit.kind === 'ped' && hit.ref && !hit.ref.dead) {
    hit.ref.kill();
    peds.addThreat(player.pos.x, player.pos.z);
    police.addHeat(1, gameTime);
  } else if (hit.kind === 'enemy' && hit.ref) {
    combat.damageEnemy(hit.ref, CFG.weapons.fists.damage);
    if (hit.ref.dead) {
      state.cash += 25;
      hud.setCash(state.cash);
    }
  }
}

// --- Camera -----------------------------------------------------------------

const camRay = new THREE.Raycaster();
const camTarget = new THREE.Vector3();

function updateCamera(dt) {
  const inCar = !!player.inCar;
  const focus = inCar ? player.inCar.pos : player.pos;
  camTarget.set(focus.x, (inCar ? 2.0 : 1.7), focus.z);
  const dist = inCar ? CAM_DIST_CAR : CAM_DIST_FOOT;
  // While driving the camera settles behind the car unless the player looks.
  // Staged screenshots keep the camera where the shot put it.
  if (inCar && !shotName) {
    let diff = player.inCar.heading - camYaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    camYaw += diff * Math.min(1, 2.2 * dt);
  }
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const dir = new THREE.Vector3(-Math.sin(camYaw) * cp, sp, -Math.cos(camYaw) * cp);
  let want = dist;
  // Pull the camera in when a building stands between it and the player.
  camRay.set(camTarget, dir);
  const hits = camRay.intersectObjects(city.buildingMeshes, false);
  if (hits.length && hits[0].distance < dist) want = Math.max(2.2, hits[0].distance * 0.92);
  const goal = camTarget.clone().addScaledVector(dir, want);
  const k = 1 - Math.exp(-10 * dt);
  camera.position.lerp(goal, k);
  camera.lookAt(camTarget.x, camTarget.y + 0.2, camTarget.z);
}

// --- One frame ---------------------------------------------------------------

const clock = new THREE.Clock();

function stepPlaying(dt) {
  gameTime += dt;
  const mouse = input.consumeMouse();
  camYaw -= mouse.dx * 0.0028;
  camPitch = Math.max(-0.12, Math.min(0.85, camPitch + mouse.dy * 0.0022));

  const playerCar = player.inCar;
  if (playerCar) {
    const ax = input.axes();
    const throttle = ax.y;
    const steer = -ax.x;
    const brake = ax.y < 0 ? 1 : 0;
    const handbrake = input.down('Space') ? 1 : 0;
    playerCar.drive(dt, throttle, steer, brake, handbrake, city);
    audio.engine(Math.abs(playerCar.speed), true);
    if (playerCar.dead) {
      effects.burst(playerCar.pos.clone().setY(1), 0xff7a2a, 20, 8, 5);
      effects.smoke(playerCar.pos.clone().setY(1.5));
      player.exitCar();
      player.damage(20, gameTime);
      hud.showMessage('Your car is wrecked.', 3);
    }
  } else {
    player.update(dt, input, city, camYaw, gameTime);
    audio.engine(0, false);
  }

  // Interactions.
  if (input.hit('KeyE')) tryEnterExitCar();
  if (input.hit('KeyM')) {
    state.muted = !state.muted;
    audio.setMuted(state.muted);
    hud.showMessage(state.muted ? 'Sound off.' : 'Sound on.', 2);
  }
  if (input.hit('Digit1')) { player.weapon = 'fists'; }
  if (input.hit('Digit2') && player.hasPistol) { player.weapon = 'pistol'; }
  if (input.hit('KeyR') && player.weapon === 'pistol' && player.ammo < CFG.weapons.pistol.mag) {
    player.reloadTimer = CFG.weapons.pistol.reload;
    player.ammo = CFG.weapons.pistol.mag;
  }
  if (!player.inCar && player.weapon === 'pistol' && input.consumeClick()) {
    handleShotResult(combat.playerShoot(camera, player, gameTime));
  }
  if (!player.inCar && player.weapon === 'fists' && input.hit('KeyF')) {
    handlePunchResult(combat.punch(player, peds, gameTime));
  }
  if (input.hit('Escape')) {
    screen = 'paused';
    hud.showPause(true);
    input.unlock();
  }

  // The world answers.
  const playerPos = playerCar ? playerCar.pos : player.pos;
  traffic.update(dt, playerPos);
  peds.update(dt, playerPos);
  police.update(dt, player, playerCar, gameTime);
  combat.update(dt, player, gameTime);
  missions.update(dt, missionCtx());
  effects.update(dt);
  audio.siren(police.sirenNear && police.wanted > 0);

  // Gunfire and car wrecks scare the crowd.
  if (player.fireTimer > 0) peds.addThreat(player.pos.x, player.pos.z);

  // A fresh wound makes a sound.
  if (player.health < prevHealth) audio.blip(140, 0.12, 'sawtooth', 0.15);
  prevHealth = player.health;

  // Death and arrest.
  if (player.dead) {
    audio.busted();
    screen = 'ended';
    hud.showEnd('WASTED', 'Rico is down. The hospital patches him up, the cops take their cut.');
    input.unlock();
    return;
  }
  if (police.busted) {
    police.busted = false;
    audio.busted();
    screen = 'ended';
    hud.showEnd('BUSTED', 'The cops dragged Rico in. A night in the cells, and the fine comes out of his pocket.');
    input.unlock();
    return;
  }

  // HUD.
  hud.setHealth(player.health);
  hud.setCash(state.cash);
  hud.setWanted(police.wanted);
  const obj = missions.objectiveText();
  hud.setObjective(obj.title, obj.text);
  hud.setSpeed(playerCar ? playerCar.speed : 0, !!playerCar);
  const wName = player.weapon === 'pistol' ? CFG.weapons.pistol.name : CFG.weapons.fists.name;
  hud.setWeapon(wName, player.weapon === 'pistol' ? player.ammo : null, player.reloadTimer > 0, !!playerCar);
  hud.updateMessage(dt);
  hud.drawMinimap({
    city,
    marker: missions.markerPos,
    traffic: traffic.cars,
    policeCars: police.cars,
    policeCops: police.cops,
    enemies: combat.enemies,
    player: { x: playerPos.x, z: playerPos.z },
    playerHeading: playerCar ? playerCar.heading : player.heading,
  });

  // Register fresh meshes as shootable (traffic and police cars, foot cops).
  regTimer += dt;
  if (regTimer > 0.5) {
    regTimer = 0;
    for (const car of traffic.cars) {
      if (!car.mesh.userData.combat) combat.register(car.mesh, 'car', car);
    }
    for (const car of police.cars) {
      if (!car.mesh.userData.combat) combat.register(car.mesh, 'car', car);
    }
    for (const cop of police.cops) {
      if (!cop.parts.group.userData.combat) combat.register(cop.parts.group, 'cop', cop);
    }
    for (const ped of peds.peds) {
      if (!ped.mesh.userData.combat) combat.register(ped.mesh, 'ped', ped);
    }
  }

  // Autosave.
  saveTimer += dt;
  if (saveTimer > 30) {
    saveTimer = 0;
    saveGame();
  }
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());

  if (screen === 'menu') {
    // Attract mode: the city lives behind the title.
    menuAngle += dt * 0.05;
    const cx = -40 + Math.cos(menuAngle) * 150;
    const cz = 60 + Math.sin(menuAngle) * 150;
    camera.position.lerp(new THREE.Vector3(cx, 55, cz), 1 - Math.exp(-2 * dt));
    camera.lookAt(-20, 10, 40);
    traffic.update(dt, player.pos);
    peds.update(dt, player.pos);
    effects.update(dt);
  } else if (screen === 'playing') {
    if (shotName) {
      shotFrames++;
      if (!shotStaged && shotFrames > 3) {
        applyShot(game, shotName);
        shotStaged = true;
      } else if (shotStaged && !shotFrozen && shotFrames > 14) {
        shotFrozen = true;
      }
      if (shotFrozen) {
        effects.update(dt);
        hud.updateMessage(dt);
      } else {
        stepPlaying(dt);
      }
      if (shotFrames === 18) window.__done = true;
    } else {
      stepPlaying(dt);
    }
    updateCamera(dt);
  } else if (screen === 'paused' || screen === 'ended') {
    // Frozen frame behind the overlay.
  }

  if (composer) composer.render();
  else renderer.render(scene, camera);
  input.endFrame();
}

// --- Start ------------------------------------------------------------------

if (shotName) {
  // No menu, no audio: pose the scene straight from the real game.
  resetGame();
  missions.startStory(missionCtx());
  screen = 'playing';
  hud.hideMenu();
  const obj = missions.objectiveText();
  hud.setObjective(obj.title, obj.text);
} else {
  hud.showMenu(!!loadSave());
  const saved = loadSave();
  if (saved && saved.muted) {
    state.muted = true;
    audio.setMuted(true);
  }
}

// Headless tests and screenshots read the game through this handle.
window.__game = {
  player, police, traffic, combat, peds, city, state,
  get missions() { return missions; },
  get screen() { return screen; },
  get camYaw() { return camYaw; },
  get gameTime() { return gameTime; },
};

requestAnimationFrame(frame);
