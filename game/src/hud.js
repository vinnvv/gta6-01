// The HUD and the menus: health, cash, wanted stars, the minimap, the
// mission objective, speed, and the start, pause and game-over screens.
// All DOM, drawn over the WebGL canvas.

export class HUD {
  constructor(callbacks) {
    this.cb = callbacks;
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="hud-top-left">
        <div id="health-wrap"><div id="health-bar"></div><span id="health-text">100</span></div>
        <div id="armor-wrap"><div id="armor-bar"></div><span id="armor-text">0</span></div>
        <div id="cash">$0</div>
        <div id="jobs"></div>
      </div>
      <div id="hud-top-right"><div id="stars"></div><div id="clock">18:24</div></div>
      <div id="objective"><div id="obj-title"></div><div id="obj-text"></div></div>
      <div id="speed"></div>
      <div id="weapon"></div>
      <div id="crosshair">+</div>
      <div id="message"></div>
      <canvas id="minimap" width="190" height="190"></canvas>
      <div id="vignette"></div>
      <div id="menu" class="overlay">
        <h1>SOLMAR</h1>
        <p class="tag">A sun-soaked open-world crime story</p>
        <p class="story">Rico Marin is out after three years inside. Sofia Marchetti has work for him, the city is open, and the cops are watching.</p>
        <div class="buttons">
          <button id="btn-new">New Game</button>
          <button id="btn-continue" class="hidden">Continue</button>
          <button id="btn-how">How to Play</button>
        </div>
        <div id="how" class="hidden">
          <p><b>WASD</b> move / drive &nbsp; <b>Mouse</b> look (click to lock) &nbsp; <b>Shift</b> run</p>
          <p><b>Space</b> jump / handbrake &nbsp; <b>E</b> enter or leave a car &nbsp; <b>Left click</b> shoot (hold for full-auto)</p>
          <p><b>F</b> punch &nbsp; <b>R</b> reload &nbsp; <b>1-5</b> fists / pistol / shotgun / SMG / rifle &nbsp; <b>M</b> mute &nbsp; <b>Esc</b> pause</p>
          <p>Steal cars, lose the cops, run missions for Sofia. Guns, health kits and armor vests are stashed around the city: walk over one to grab it.</p>
        </div>
      </div>
      <div id="pause" class="overlay hidden">
        <h2>Paused</h2>
        <div class="buttons">
          <button id="btn-resume">Resume</button>
          <button id="btn-save-quit">Save and Quit to Menu</button>
        </div>
      </div>
      <div id="end" class="overlay hidden">
        <h2 id="end-title">WASTED</h2>
        <p id="end-text"></p>
        <div class="buttons"><button id="btn-respawn">Respawn</button></div>
      </div>`;
    document.body.appendChild(this.root);
    this.minimap = this.root.querySelector('#minimap');
    this.mm = this.minimap.getContext('2d');
    this.messageTimer = 0;

    this.root.querySelector('#btn-new').addEventListener('click', () => this.cb.onNewGame());
    this.root.querySelector('#btn-continue').addEventListener('click', () => this.cb.onContinue());
    this.root.querySelector('#btn-how').addEventListener('click', () => {
      this.root.querySelector('#how').classList.toggle('hidden');
    });
    this.root.querySelector('#btn-resume').addEventListener('click', () => this.cb.onResume());
    this.root.querySelector('#btn-save-quit').addEventListener('click', () => this.cb.onSaveQuit());
    this.root.querySelector('#btn-respawn').addEventListener('click', () => this.cb.onRespawn());
  }

  show(id, on) {
    this.root.querySelector(id).classList.toggle('hidden', !on);
  }

  showMenu(hasSave) {
    this.root.classList.add('menu-mode');
    this.show('#menu', true);
    this.show('#pause', false);
    this.show('#end', false);
    this.root.querySelector('#btn-continue').classList.toggle('hidden', !hasSave);
  }

  hideMenu() {
    this.root.classList.remove('menu-mode');
    this.show('#menu', false);
  }
  showPause(on) { this.show('#pause', on); }

  showEnd(kind, text) {
    this.root.querySelector('#end-title').textContent = kind;
    this.root.querySelector('#end-text').textContent = text;
    this.show('#end', true);
  }

  hideEnd() { this.show('#end', false); }

  setHealth(h) {
    const bar = this.root.querySelector('#health-bar');
    bar.style.width = Math.max(0, h) + '%';
    bar.style.background = h > 50 ? '#58c96b' : h > 25 ? '#e8b13c' : '#d83a2e';
    this.root.querySelector('#health-text').textContent = Math.ceil(Math.max(0, h));
    this.root.querySelector('#vignette').style.opacity = h < 30 ? String((30 - h) / 30 * 0.55) : '0';
  }

  setArmor(a) {
    const bar = this.root.querySelector('#armor-bar');
    bar.style.width = Math.max(0, a) + '%';
    this.root.querySelector('#armor-text').textContent = Math.ceil(Math.max(0, a));
    this.root.querySelector('#armor-wrap').style.display = a > 0 ? 'block' : 'none';
  }

  setCash(c) { this.root.querySelector('#cash').textContent = '$' + Math.floor(c).toLocaleString('en-US'); }

  setWanted(n) {
    const stars = this.root.querySelector('#stars');
    stars.textContent = '★'.repeat(n) + '☆'.repeat(6 - n);
    stars.style.color = n >= 6 ? '#ff4d4d' : n > 0 ? '#ffd23e' : 'rgba(255,255,255,0.35)';
  }

  setJobs(done, total) {
    this.root.querySelector('#jobs').textContent = total > 0 ? 'JOBS ' + done + '/' + total : '';
  }

  setObjective(title, text) {
    this.root.querySelector('#obj-title').textContent = title;
    this.root.querySelector('#obj-text').textContent = text;
  }

  setSpeed(kmh, inCar) {
    this.root.querySelector('#speed').textContent = inCar ? Math.abs(Math.round(kmh * 3.2)) + ' km/h' : '';
  }

  setWeapon(name, ammo, reloading, inCar = false) {
    this.root.querySelector('#weapon').textContent = reloading ? name + ' (reloading...)' : (ammo === null ? name : `${name}  ${ammo}`);
    // The crosshair is for shooting on foot, not for driving.
    this.root.querySelector('#crosshair').style.display = name !== 'Fists' && !inCar ? 'block' : 'none';
  }

  showMessage(text, seconds = 4) {
    const el = this.root.querySelector('#message');
    el.textContent = text;
    el.style.opacity = '1';
    this.messageTimer = seconds;
  }

  updateMessage(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.root.querySelector('#message').style.opacity = '0';
    }
  }

  // Top-down map: roads, beach, the player arrow, mission marker, police,
  // traffic and enemies.
  drawMinimap(world) {
    const g = this.mm;
    const S = 190;
    const span = 700; // world units across the map
    const toMap = (x, z) => [(x / span + 0.5) * S, (z / span + 0.5) * S];
    g.clearRect(0, 0, S, S);
    g.fillStyle = 'rgba(20,28,36,0.82)';
    g.fillRect(0, 0, S, S);
    // Beach and sea.
    g.fillStyle = '#c9b183';
    g.fillRect(0, toMap(0, 280)[1], S, S);
    g.fillStyle = '#2e7fa8';
    g.fillRect(0, toMap(0, 326)[1], S, S);
    // Roads.
    g.strokeStyle = '#5a5a60';
    g.lineWidth = 4;
    for (const x of world.city.roadXs) {
      const [px] = toMap(x, 0);
      g.beginPath(); g.moveTo(px, toMap(0, -294)[1]); g.lineTo(px, toMap(0, 294)[1]); g.stroke();
      const [, pz] = toMap(0, x);
      g.beginPath(); g.moveTo(toMap(-294, 0)[0], pz); g.lineTo(toMap(294, 0)[0], pz); g.stroke();
    }
    // Mission marker.
    if (world.marker) {
      const [mx, mz] = toMap(world.marker.x, world.marker.z);
      g.fillStyle = '#ffd23e';
      g.beginPath();
      g.moveTo(mx, mz - 7); g.lineTo(mx + 6, mz); g.lineTo(mx, mz + 7); g.lineTo(mx - 6, mz);
      g.closePath(); g.fill();
      g.strokeStyle = '#7a5c00'; g.lineWidth = 1; g.stroke();
    }
    // Traffic.
    g.fillStyle = '#cfd3d8';
    for (const car of world.traffic) {
      const [cx, cz] = toMap(car.pos.x, car.pos.z);
      g.fillRect(cx - 1.5, cz - 1.5, 3, 3);
    }
    // Police.
    for (const car of world.policeCars) {
      const [cx, cz] = toMap(car.pos.x, car.pos.z);
      g.fillStyle = '#3d7ac9';
      g.beginPath(); g.arc(cx, cz, 3.5, 0, Math.PI * 2); g.fill();
    }
    for (const cop of world.policeCops) {
      const [cx, cz] = toMap(cop.pos.x, cop.pos.z);
      g.fillStyle = '#3d7ac9';
      g.beginPath(); g.arc(cx, cz, 2.5, 0, Math.PI * 2); g.fill();
    }
    // Enemies.
    g.fillStyle = '#e83a2e';
    for (const e of world.enemies) {
      const [ex, ez] = toMap(e.pos.x, e.pos.z);
      g.beginPath(); g.arc(ex, ez, 3, 0, Math.PI * 2); g.fill();
    }
    // Player arrow.
    const [px, pz] = toMap(world.player.x, world.player.z);
    g.save();
    g.translate(px, pz);
    g.rotate(-world.playerHeading + Math.PI);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(0, 3); g.lineTo(-5, 6);
    g.closePath(); g.fill();
    g.restore();
    // Border.
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, S - 2, S - 2);
  }
}
