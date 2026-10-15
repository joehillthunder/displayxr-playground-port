// Materials and image-based lighting. The playground is lit by the sun plus an environment map
// rendered from the sky, so glossy plastic, painted metal and chrome pick up sky reflections.
// Every texture is drawn on a canvas at load time.
//
// Quality: 'high' (physical clearcoat plastic, grass, 4K shadows), 'medium', 'low' (plain standard
// materials, no grass). Set it before anything is built.

import * as THREE from 'three';
import { rand } from './util.js';

export const Q = { level: 'high' };
export const QUALITY = {
  high: { grass: 160000, shadow: 4096, physical: true, eyeW: 2560 },
  medium: { grass: 60000, shadow: 2048, physical: true, eyeW: 2048 },
  low: { grass: 0, shadow: 1024, physical: false, eyeW: 1600 },
};
export const q = () => QUALITY[Q.level];

// ── canvas textures ─────────────────────────────────────────────────────────────────────────────
function canvasTex(size, draw, { repeat = 1, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

let knit;
function knitTex() {
  knit ??= canvasTex(128, (g, s) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 4) {
      for (let x = 0; x < s; x += 4) {
        const v = 225 + Math.floor(Math.random() * 30);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.beginPath();
        g.ellipse(x + 2, y + 2, 1.6, 2.2, (x / 4) % 2 ? 0.5 : -0.5, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, { repeat: 4 });
  return knit;
}

let grain;
function woodTex() {
  grain ??= canvasTex(256, (g, s) => {
    g.fillStyle = '#c08550';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 70; i++) {
      const y = Math.random() * s;
      g.strokeStyle = `rgba(${90 + rand(0, 40)},${50 + rand(0, 25)},${20},${rand(0.15, 0.4)})`;
      g.lineWidth = rand(0.6, 2.4);
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= s; x += 16) g.lineTo(x, y + Math.sin(x * 0.04 + i) * rand(1, 4));
      g.stroke();
    }
    for (let k = 0; k < 4; k++) {
      const x = rand(20, s - 20), y = rand(20, s - 20);
      g.strokeStyle = 'rgba(80,40,15,0.45)';
      for (let r = 2; r < 12; r += 2.5) { g.beginPath(); g.ellipse(x, y, r * 2.2, r, 0, 0, Math.PI * 2); g.stroke(); }
    }
  }, { repeat: 1 });
  return grain;
}

// ── material factories ──────────────────────────────────────────────────────────────────────────
const cache = new Map();
const memo = (k, make) => { if (!cache.has(k)) cache.set(k, make()); return cache.get(k); };

export function plastic(color) {
  return memo('plastic' + color + Q.level, () => q().physical
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18 })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.38 }));
}

export function paintedMetal(color) {
  return memo('paint' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.45 }));
}

export function chrome(color = 0xdfe4ea) {
  return memo('chrome' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.16, metalness: 1 }));
}

export function wood(color = 0xffffff) {
  return memo('wood' + color, () => new THREE.MeshStandardMaterial({ color, map: woodTex(), bumpMap: woodTex(), bumpScale: 0.6, roughness: 0.78 }));
}

export function fabricMat(color, doubleSide = false) {
  return memo('fabric' + color + doubleSide, () => new THREE.MeshStandardMaterial({
    color, map: knitTex(), bumpMap: knitTex(), bumpScale: 0.35, roughness: 0.9,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  }));
}

export function skinMat(color) {
  return memo('skin' + color, () => q().physical
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.55, sheen: 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffd0c0) })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
}

export function hairMat(color) {
  return memo('hair' + color, () => q().physical
    ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, sheen: 0.7, sheenRoughness: 0.35, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35) })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
}

// Equipment colours -> material kind. Built objects get their plain materials swapped by colour.
const PLASTIC = [0xff5252, 0x3f8fff, 0xffd23f, 0x2fbf4f, 0xffa21f, 0xb14dff, 0xff8c42, 0x3fbfbf, 0x8fd14f, 0xff7ab8, 0xffffff];
const PAINT = [0xf2f2f2, 0x404850, 0x666c75];
const CHROME = [0x9aa3ad, 0xd8dde5, 0xdddddd];
const WOOD = [0xb5763f, 0xc98a4b, 0xb87a3d, 0x8a5a33];

/** Upgrade plain materials on these objects (and their children) to plastic/metal/wood. */
export function upgradeMaterials(objects) {
  for (const o of objects) {
    o.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || !m.material?.isMeshStandardMaterial || m.material.map) return;
      const hex = m.material.color.getHex(); // back in sRGB, as authored
      const side = m.material.side;
      let next = null;
      if (PLASTIC.includes(hex)) next = plastic(hex);
      else if (PAINT.includes(hex)) next = paintedMetal(hex);
      else if (CHROME.includes(hex)) next = chrome(hex);
      else if (WOOD.includes(hex)) next = wood(hex);
      if (next) {
        if (side === THREE.DoubleSide) { next = next.clone(); next.side = THREE.DoubleSide; }
        m.material = next;
      }
    });
  }
}

/** An environment map from a sky scene: gradient dome, a bright sun, green ground. */
export function makeEnvironment(renderer, sunDir) {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { top: { value: new THREE.Color(0x2f6fb8) }, mid: { value: new THREE.Color(0x9fbfd8) }, ground: { value: new THREE.Color(0x3f6a30) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 ground; varying vec3 vP; void main(){ float h = normalize(vP).y; vec3 c = h > 0. ? mix(mid, top, pow(h, 0.6)) : mix(mid, ground, clamp(-h*4., 0., 1.)); gl_FragColor = vec4(c, 1.); }',
  }));
  env.add(dome);
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.95, 0.85).multiplyScalar(4) }));
  sun.position.copy(sunDir).normalize().multiplyScalar(45);
  env.add(sun);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  return rt.texture;
}
