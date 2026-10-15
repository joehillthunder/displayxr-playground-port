// Speech bubbles over heads, confetti and hearts. All of it lives in the 3D scene, so on a 3D
// display a bubble floats at its speaker's depth.

import * as THREE from 'three';
import { rand } from './util.js';

const _v = new THREE.Vector3();

export class Bubbles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  say(ch, text, dur = 2.4) {
    // One bubble per speaker: a new line replaces the old one.
    const old = this.items.find((b) => b.ch === ch);
    if (old) this.remove(old);
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    const font = 'bold 44px "Trebuchet MS", system-ui, sans-serif';
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 56;
    c.width = w;
    c.height = 104;
    g.font = font;
    g.fillStyle = 'rgba(255,255,255,0.96)';
    g.strokeStyle = 'rgba(40,50,70,0.25)';
    g.lineWidth = 4;
    g.beginPath();
    g.roundRect(4, 4, w - 8, 76, 30);
    g.moveTo(w / 2 - 14, 78);
    g.lineTo(w / 2, 100);
    g.lineTo(w / 2 + 14, 78);
    g.fill();
    g.stroke();
    g.fillStyle = '#28324a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, 44);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    const h = 0.34;
    s.scale.set((h * w) / 104, h, 1);
    s.center.set(0.5, 0);
    s.renderOrder = 5;
    this.scene.add(s);
    this.items.push({ ch, s, t: dur, dur });
  }

  remove(b) {
    this.scene.remove(b.s);
    b.s.material.map.dispose();
    b.s.material.dispose();
    this.items.splice(this.items.indexOf(b), 1);
  }

  update(dt) {
    for (const b of [...this.items]) {
      b.t -= dt;
      if (b.t <= 0) { this.remove(b); continue; }
      b.ch.headTop(_v);
      b.s.position.copy(_v);
      const age = b.dur - b.t;
      const k = Math.min(1, age * 6) * Math.min(1, b.t * 3);
      b.s.material.opacity = k;
      b.s.position.y += (1 - Math.min(1, age * 6)) * -0.1;
    }
  }
}

const CONFETTI = [0xff5252, 0xffd23f, 0x3f8fff, 0x2fbf4f, 0xb14dff, 0xff8c42, 0xffffff];

export class Particles {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
    this.geo = new THREE.PlaneGeometry(0.07, 0.045);
    this.mats = CONFETTI.map((c) => new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    const hc = document.createElement('canvas');
    hc.width = hc.height = 64;
    const g = hc.getContext('2d');
    g.fillStyle = '#ff4f7a';
    g.font = '56px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('♥', 32, 36);
    const t = new THREE.CanvasTexture(hc);
    t.colorSpace = THREE.SRGBColorSpace;
    this.heartMat = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false });
  }

  confetti(pos, n = 70) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.geo, this.mats[i % this.mats.length]);
      m.position.copy(pos);
      m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
      this.scene.add(m);
      const a = rand(0, Math.PI * 2), s = rand(1, 3.2);
      this.items.push({ o: m, v: new THREE.Vector3(Math.cos(a) * s, rand(3.5, 7), Math.sin(a) * s), spin: new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9)), t: rand(2, 3.2), drag: 2.2 });
    }
  }

  hearts(pos, n = 4) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.heartMat.clone());
      s.scale.setScalar(0.22);
      s.position.copy(pos).add(new THREE.Vector3(rand(-0.2, 0.2), rand(0, 0.2), rand(-0.2, 0.2)));
      this.scene.add(s);
      this.items.push({ o: s, v: new THREE.Vector3(rand(-0.2, 0.2), rand(0.6, 1), rand(-0.2, 0.2)), t: 1.6, float: true });
    }
  }

  update(dt) {
    for (const p of [...this.items]) {
      p.t -= dt;
      if (p.t <= 0) {
        this.scene.remove(p.o);
        if (p.float) p.o.material.dispose();
        this.items.splice(this.items.indexOf(p), 1);
        continue;
      }
      if (!p.float) {
        p.v.y -= 9.8 * dt;
        p.v.multiplyScalar(Math.exp(-p.drag * dt));
        p.o.rotation.x += p.spin.x * dt;
        p.o.rotation.y += p.spin.y * dt;
        if (p.o.position.y < 0.02) { p.o.position.y = 0.02; p.v.set(0, 0, 0); p.spin.set(0, 0, 0); }
      } else {
        p.o.material.opacity = Math.min(1, p.t);
      }
      p.o.position.addScaledVector(p.v, dt);
    }
  }
}
