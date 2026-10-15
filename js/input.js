// Player input: keyboard, mouse (drag to look, wheel to zoom), touch (a thumbstick on the left,
// Jump and Action buttons on the right, drag elsewhere to look) and gamepad. Produces one state the
// game reads each frame.

const KEYS_FWD = ['KeyW', 'ArrowUp'], KEYS_BACK = ['KeyS', 'ArrowDown'], KEYS_LEFT = ['KeyA', 'ArrowLeft'], KEYS_RIGHT = ['KeyD', 'ArrowRight'];

export class Input {
  constructor(canvas, ui) {
    this.keys = new Set();
    this.jumpQ = false;
    this.actionQ = false;
    this.look = { dx: 0, dy: 0, zoom: 0 };
    this.stick = { x: 0, y: 0, active: false };
    this.lastLookT = -10;
    this.onKey = () => {};

    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, select, textarea')) return;
      if (e.repeat) { if (['Space', 'KeyE', 'Enter'].includes(e.code)) e.preventDefault(); return; }
      this.keys.add(e.code);
      if (e.code === 'Space') { this.jumpQ = true; e.preventDefault(); }
      if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'KeyF') { this.actionQ = true; e.preventDefault(); }
      if (e.code.startsWith('Arrow')) e.preventDefault();
      this.onKey(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // Mouse / pen drag on the canvas: look around.
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerType === 'touch') return;
      this.look.dx += e.clientX - drag.x;
      this.look.dy += e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      this.lastLookT = performance.now();
    });
    const end = () => { drag = null; };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.look.zoom += e.deltaY; }, { passive: false });

    // Touch: left half = floating thumbstick; right half = look; buttons are DOM.
    const touches = new Map();
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const left = t.clientX < innerWidth * 0.45;
        if (left && ![...touches.values()].some((v) => v.kind === 'stick')) {
          touches.set(t.identifier, { kind: 'stick', x0: t.clientX, y0: t.clientY });
          this.stick.active = true;
          ui.stickShow(t.clientX, t.clientY);
        } else {
          touches.set(t.identifier, { kind: 'look', x: t.clientX, y: t.clientY });
        }
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const v = touches.get(t.identifier);
        if (!v) continue;
        if (v.kind === 'stick') {
          let dx = (t.clientX - v.x0) / 55, dy = (t.clientY - v.y0) / 55;
          const m = Math.hypot(dx, dy);
          if (m > 1) { dx /= m; dy /= m; }
          this.stick.x = dx;
          this.stick.y = -dy;
          ui.stickMove(dx, dy);
        } else {
          this.look.dx += (t.clientX - v.x) * 1.4;
          this.look.dy += (t.clientY - v.y) * 1.4;
          v.x = t.clientX;
          v.y = t.clientY;
          this.lastLookT = performance.now();
        }
      }
    }, { passive: false });
    const tend = (e) => {
      for (const t of e.changedTouches) {
        const v = touches.get(t.identifier);
        if (v?.kind === 'stick') { this.stick.x = this.stick.y = 0; this.stick.active = false; ui.stickHide(); }
        touches.delete(t.identifier);
      }
    };
    canvas.addEventListener('touchend', tend);
    canvas.addEventListener('touchcancel', tend);
    this.prevPad = {};
  }

  pressJump() { this.jumpQ = true; }
  pressAction() { this.actionQ = true; }

  /** Read and clear this frame's input. Move is in screen terms: x right, y forward. */
  read() {
    const k = this.keys;
    const has = (arr) => arr.some((c) => k.has(c));
    let x = (has(KEYS_RIGHT) ? 1 : 0) - (has(KEYS_LEFT) ? 1 : 0);
    let y = (has(KEYS_FWD) ? 1 : 0) - (has(KEYS_BACK) ? 1 : 0);
    let run = k.has('ShiftLeft') || k.has('ShiftRight');
    let jump = this.jumpQ, action = this.actionQ;
    let lookX = 0, lookY = 0;
    if (this.stick.active) { x = this.stick.x; y = this.stick.y; run = Math.hypot(x, y) > 0.92; }

    // First connected gamepad.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const p = [...pads].find((g) => g && g.connected);
    if (p) {
      const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
      const lx = dz(p.axes[0] || 0), ly = dz(p.axes[1] || 0);
      if (lx || ly) { x = lx; y = -ly; }
      lookX = dz(p.axes[2] || 0);
      lookY = dz(p.axes[3] || 0);
      const b = (i) => !!p.buttons[i]?.pressed;
      if (b(0) && !this.prevPad[0]) jump = true;
      if ((b(2) || b(1)) && !this.prevPad[2]) action = true;
      if (b(7) || b(5)) run = true;
      this.prevPad[0] = b(0);
      this.prevPad[2] = b(2) || b(1);
      if (lookX || lookY) this.lastLookT = performance.now();
    }
    this.jumpQ = this.actionQ = false;
    const look = { dx: this.look.dx + lookX * 14, dy: this.look.dy + lookY * 10, zoom: this.look.zoom };
    this.look.dx = this.look.dy = this.look.zoom = 0;
    return { x, y, run, jump, action, look };
  }
}
