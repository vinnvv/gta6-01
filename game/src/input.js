// Keyboard and mouse input. Keys are tracked by code so layouts do not
// matter; the mouse drives the camera through pointer lock, with the arrow
// keys as a fallback for players (and headless tests) without a pointer.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    document.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        if (!this.locked && this.enabled) canvas.requestPointerLock?.();
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    // Arrow keys turn the camera when the pointer is not locked.
    window.addEventListener('keydown', (e) => {
      if (e.code === 'ArrowLeft') this.mouseDX -= 7;
      if (e.code === 'ArrowRight') this.mouseDX += 7;
      if (e.code === 'ArrowUp') this.mouseDY -= 4;
      if (e.code === 'ArrowDown') this.mouseDY += 4;
    });
  }

  down(code) { return this.keys.has(code); }
  hit(code) { return this.pressed.has(code); }

  // Movement axes in camera space: x is strafe, y is forward.
  axes() {
    let x = 0, y = 0;
    if (this.down('KeyA')) x -= 1;
    if (this.down('KeyD')) x += 1;
    if (this.down('KeyW')) y += 1;
    if (this.down('KeyS')) y -= 1;
    return { x, y };
  }

  consumeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  // Call once per frame after the game has read the input.
  endFrame() { this.pressed.clear(); }

  unlock() { document.exitPointerLock?.(); }
}
