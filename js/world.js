// The playground world: collision data (walkable surfaces, walls), the things you can use
// (interactables), and the scenery around the play equipment. Everything is built from three.js
// primitives at runtime: there are no asset files.
//
// Collision is deliberately simple. A character is a vertical cylinder. Walkable surfaces are
// rects or circles with a top height (a ramp's top varies along x); the floor under a character is
// the highest surface whose top is at most a step above its feet. Walls are boxes that push the
// cylinder out sideways, unless the character's feet are above the box or its head below it.

import * as THREE from 'three';
import { rand, segmentHitsRect } from './util.js';
import { buildTree } from './nature.js';
import { makeEnvironment, q, upgradeMaterials } from './materials.js';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, ...opts }));
  return matCache.get(key);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.surfaces = [];
    this.walls = [];
    this.interactables = [];
    this.updaters = [];
    this.characters = [];
    this.navBlockers = []; // ground-level rects NPCs route around
    this.listeners = {};
    this.bounds = { x0: -21.2, x1: 21.2, z0: -15.2, z1: 15.2 };
    this.time = 0;
  }

  on(type, cb) { (this.listeners[type] ||= []).push(cb); }
  emit(type, ...a) { for (const cb of this.listeners[type] || []) cb(...a); }

  /** A sticker earned by a character (only the player's count). */
  award(ch, id) { if (ch.isPlayer) this.emit('sticker', id); }

  // ── building helpers ─────────────────────────────────────────────────────────────────────────
  mesh(geo, color, x = 0, y = 0, z = 0, { cast = true, receive = true, parent = this.scene, m } = {}) {
    const o = new THREE.Mesh(geo, m || mat(color));
    o.position.set(x, y, z);
    o.castShadow = cast;
    o.receiveShadow = receive;
    parent.add(o);
    return o;
  }

  box(w, h, d, color, x, y, z, opts) {
    return this.mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, opts);
  }

  /** A cylinder between two points. */
  rod(a, b, r, color, opts = {}) {
    const len = a.distanceTo(b);
    const o = this.mesh(new THREE.CylinderGeometry(r, r, len, opts.seg || 10), color, 0, 0, 0, opts);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return o;
  }

  addSurface(s) {
    // s: { x0,x1,z0,z1 } or { cx, cz, r }, plus top (number) or topAt(x,z), bottom, ref
    s.thick ??= 0.12;
    this.surfaces.push(s);
    return s;
  }

  addWall(x0, x1, z0, z1, y0, y1, nav = false) {
    const w = { x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1), y0, y1 };
    this.walls.push(w);
    if (nav) this.navBlockers.push(w);
    return w;
  }

  addInteractable(it) {
    it.yTol ??= 0.6;
    this.interactables.push(it);
    return it;
  }

  // ── queries ──────────────────────────────────────────────────────────────────────────────────
  surfaceTop(s, x, z) {
    if (s.r != null) {
      if ((x - s.cx) ** 2 + (z - s.cz) ** 2 > s.r * s.r) return null;
    } else if (x < s.x0 || x > s.x1 || z < s.z0 || z > s.z1) return null;
    return s.topAt ? s.topAt(x, z) : s.top;
  }

  /** Highest floor at (x,z) that is no higher than maxY. Ground is y=0. */
  floorAt(x, z, maxY) {
    let y = 0, ref = null;
    for (const s of this.surfaces) {
      const t = this.surfaceTop(s, x, z);
      if (t != null && t <= maxY && t > y) { y = t; ref = s; }
    }
    return { y, ref };
  }

  /** Lowest ceiling (surface underside) above minY at (x,z), or Infinity. */
  ceilingAt(x, z, minY) {
    let c = Infinity;
    for (const s of this.surfaces) {
      const t = this.surfaceTop(s, x, z);
      if (t == null) continue;
      const b = t - s.thick;
      if (b >= minY && b < c) c = b;
    }
    return c;
  }

  /** Push a cylinder (feet at pos, radius r, height h) out of every wall it overlaps. */
  collideWalls(pos, r, h) {
    let hit = false;
    for (const w of this.walls) {
      if (pos.y >= w.y1 - 0.02 || pos.y + h <= w.y0) continue;
      const cx = Math.max(w.x0, Math.min(pos.x, w.x1));
      const cz = Math.max(w.z0, Math.min(pos.z, w.z1));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      hit = true;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.z = cz + (dz / d) * r;
      } else {
        // Centre inside the box: leave along the shallowest side.
        const opts = [[pos.x - w.x0, -1, 0], [w.x1 - pos.x, 1, 0], [pos.z - w.z0, 0, -1], [w.z1 - pos.z, 0, 1]];
        opts.sort((a, b) => a[0] - b[0]);
        const [, sx, sz] = opts[0];
        if (sx) pos.x = sx < 0 ? w.x0 - r : w.x1 + r;
        else pos.z = sz < 0 ? w.z0 - r : w.z1 + r;
      }
    }
    const b = this.bounds;
    pos.x = Math.max(b.x0 + r, Math.min(b.x1 - r, pos.x));
    pos.z = Math.max(b.z0 + r, Math.min(b.z1 - r, pos.z));
    return hit;
  }

  /** The closest thing this character can use right now, or null. */
  nearestInteractable(ch) {
    let best = null, bd = Infinity;
    for (const it of this.interactables) {
      if (it.can && !it.can(ch)) continue;
      let d;
      if (it.near) {
        d = it.near(ch);
        if (d == null) continue;
      } else {
        if (Math.abs(ch.pos.y - it.pos.y) > it.yTol) continue;
        d = Math.hypot(ch.pos.x - it.pos.x, ch.pos.z - it.pos.z);
        if (d > it.radius) continue;
      }
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  /** Ground-level route for NPCs: straight if clear, else via one corner of a blocker. */
  route(from, to) {
    const pad = 0.45;
    const rects = this.navBlockers.map((w) => ({ x0: w.x0 - pad, x1: w.x1 + pad, z0: w.z0 - pad, z1: w.z1 + pad }));
    const clear = (a, b) => !rects.some((r) => segmentHitsRect(a.x, a.z, b.x, b.z, r));
    if (from.y > 0.5 || to.y > 0.5 || clear(from, to)) return [to];
    let best = null, bestLen = Infinity;
    for (const r of rects) {
      for (const [x, z] of [[r.x0 - 0.05, r.z0 - 0.05], [r.x1 + 0.05, r.z0 - 0.05], [r.x0 - 0.05, r.z1 + 0.05], [r.x1 + 0.05, r.z1 + 0.05]]) {
        const c = new THREE.Vector3(x, 0, z);
        if (!clear(from, c) || !clear(c, to)) continue;
        const len = Math.hypot(c.x - from.x, c.z - from.z) + Math.hypot(to.x - c.x, to.z - c.z);
        if (len < bestLen) { bestLen = len; best = c; }
      }
    }
    return best ? [best, to] : [to];
  }

  update(dt) {
    this.time += dt;
    for (const u of this.updaters) u(dt, this.time);
  }
}

// ── scenery ────────────────────────────────────────────────────────────────────────────────────

export function buildScenery(world, renderer) {
  const { scene } = world;
  const Qs = q();

  // Sky dome: a vertical gradient, plus fog that melts the far hills into it.
  const skyGeo = new THREE.SphereGeometry(300, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: { top: { value: new THREE.Color(0x4f9fe8) }, bottom: { value: new THREE.Color(0xcfe9ff) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6, 0., 1.); gl_FragColor = vec4(mix(bottom, top, h), 1.);\n#include <colorspace_fragment>\n}',
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  sky.renderOrder = -1;
  scene.add(sky);
  scene.fog = new THREE.Fog(0xcfe9ff, 70, 220);

  // Image-based light from the sky (reflections on plastic and metal) plus a warm sun. The sun's
  // shadow box follows the camera target (main.js), so shadows stay crisp near the player.
  const SUN_DIR = new THREE.Vector3(14, 26, 12);
  scene.environment = makeEnvironment(renderer, SUN_DIR);
  scene.add(new THREE.HemisphereLight(0xdcefff, 0x6f8f4a, 0.3));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.5);
  sun.position.copy(SUN_DIR);
  sun.castShadow = true;
  sun.shadow.mapSize.set(Qs.shadow, Qs.shadow);
  const sc = sun.shadow.camera;
  sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 1; sc.far = 90;
  world.sun = sun;
  world.sunOffset = SUN_DIR.clone();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);
  scene.add(sun.target);

  // Grass with a speckle texture so the ground has parallax cues.
  const grassTex = speckleTexture('#78c257', ['#6ab34b', '#86cf63', '#5fa843', '#93d66f'], 512, 2600);
  grassTex.repeat.set(40, 40);
  const ground = world.mesh(new THREE.PlaneGeometry(240, 240), 0xffffff, 0, 0, 0, { cast: false, m: new THREE.MeshStandardMaterial({ map: grassTex, bumpMap: grassTex, bumpScale: 1.5, roughness: 1 }) });
  ground.rotation.x = -Math.PI / 2;

  // Soft rubber safety surfaces under the equipment and a gravel path loop.
  const pad = (x0, x1, z0, z1, color, y = 0.012, tex) => {
    const g = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    const m = tex ? new THREE.MeshStandardMaterial({ map: tex, bumpMap: tex, bumpScale: 2, roughness: 0.92 }) : mat(color, { roughness: 1 });
    const o = world.mesh(g, color, (x0 + x1) / 2, y, (z0 + z1) / 2, { cast: false, m });
    o.rotation.x = -Math.PI / 2;
    return o;
  };
  const rubber = speckleTexture('#3f8fd0', ['#357fbf', '#4aa0e0', '#e9f3ff', '#2f74b0'], 256, 1400);
  rubber.repeat.set(6, 4);
  pad(-11, 7.4, -7, 3.4, 0x3f8fd0, 0.012, rubber);
  const rubber2 = speckleTexture('#e07a3a', ['#cc6a2f', '#f08f4f', '#fff0e0', '#b85d26'], 256, 1400);
  rubber2.repeat.set(3, 3);
  pad(-9.6, -2.4, 4.6, 11.4, 0xe07a3a, 0.013, rubber2);
  const rubber3 = speckleTexture('#9a62c9', ['#8a55b8', '#ad78db', '#f3e8ff', '#7a48a6'], 256, 1400);
  rubber3.repeat.set(3, 3);
  const mgr = world.mesh(new THREE.CircleGeometry(3.4, 48), 0, 6, 0.013, 8, { cast: false, m: new THREE.MeshStandardMaterial({ map: rubber3, roughness: 1 }) });
  mgr.rotation.x = -Math.PI / 2;
  const gravel = speckleTexture('#d8c49c', ['#c9b38a', '#e6d4ae', '#bfa77c', '#efe2c4'], 256, 1800);
  gravel.repeat.set(1, 30);
  const path = world.mesh(new THREE.RingGeometry(15.2, 16.8, 96), 0, 0, 0.008, 0, { cast: false, m: new THREE.MeshStandardMaterial({ map: gravel, roughness: 1 }) });
  path.rotation.x = -Math.PI / 2;
  path.scale.set(1.12, 0.78, 1);

  buildFence(world);

  // Trees ring the playground; distant hills and clouds give the far depth layers.
  const trees = [[-19, -13], [-13, -14], [-4, -14], [7, -14], [17, -13], [19.5, -5], [19, 9], [16, 13.5], [-17, 13], [-19.5, 4], [-19.5, -6], [-9, 14], [10, 14], [-24, 0], [24, 2], [-28, -18], [26, -18], [0, -20], [-10, -22], [12, -21]];
  for (const [x, z] of trees) buildTree(world, x, z, rand(0.85, 1.25));
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x6aa84f, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand(-0.1, 0.1);
    const r = rand(85, 120);
    const h = new THREE.Mesh(new THREE.SphereGeometry(rand(18, 34), 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    h.position.set(Math.cos(a) * r, -2, Math.sin(a) * r);
    h.scale.y = rand(0.35, 0.6);
    scene.add(h);
  }
  const clouds = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0.35, fog: false });
  for (let i = 0; i < 9; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 9; k++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rand(1.3, 2.8), 20, 14), cloudMat);
      s.position.set(k * 1.2 - 5 + rand(-0.5, 0.5), rand(-0.3, 1.0) * (1 - Math.abs(k - 4) / 6), rand(-1.2, 1.2));
      s.scale.y = 0.75;
      c.add(s);
    }
    c.position.set(rand(-70, 70), rand(26, 40), rand(-80, -20) * (i % 3 === 0 ? -1 : 1));
    c.userData.v = rand(0.4, 1.1);
    clouds.add(c);
  }
  scene.add(clouds);
  world.updaters.push((dt) => {
    for (const c of clouds.children) {
      c.position.x += c.userData.v * dt;
      if (c.position.x > 90) c.position.x = -90;
    }
  });

  // Flower beds along the fence, for the butterflies.
  world.flowerSpots = [];
  const petal = [0xff5f8f, 0xffd23f, 0xffffff, 0xb57bff, 0xff8c42];
  for (const [x, z] of [[-17, -11], [-6, 12.5], [8, -11.5], [18, 3], [-17, 8]]) {
    world.flowerSpots.push(new THREE.Vector3(x, 0.6, z));
    for (let i = 0; i < 14; i++) {
      const fx = x + rand(-1.4, 1.4), fz = z + rand(-0.7, 0.7);
      world.rod(new THREE.Vector3(fx, 0, fz), new THREE.Vector3(fx, 0.35, fz), 0.012, 0x3f8f3a, { cast: false, seg: 4 });
      world.mesh(new THREE.SphereGeometry(0.07, 8, 6), petal[i % petal.length], fx, 0.38, fz, { cast: false });
    }
    const bush = world.mesh(new THREE.SphereGeometry(0.6, 24, 16), 0x4f9a3a, x + 1.8, 0.35, z, {});
    bush.scale.y = 0.7;
  }

  buildBench(world, -1, 12.6, Math.PI); // faces the swings and the towers
  buildBench(world, 17.5, -2, -Math.PI / 2);
  buildBench(world, -15, 2, Math.PI / 2);
  world.benches = [
    { seat: new THREE.Vector3(-1, 0, 12.6), yaw: Math.PI },
    { seat: new THREE.Vector3(17.5, 0, -2), yaw: -Math.PI / 2 },
    { seat: new THREE.Vector3(-15, 0, 2), yaw: Math.PI / 2 },
  ];

  // A sign for the 3D crowd.
  const sign = signTexture('DisplayXR Playground');
  const board = world.mesh(new THREE.PlaneGeometry(3.4, 0.85), 0, -1, 2.0, 14.9, { cast: false, m: new THREE.MeshStandardMaterial({ map: sign, roughness: 0.8 }) });
  board.rotation.y = Math.PI;
  world.box(3.6, 1.0, 0.08, 0x8a5a33, -1, 2.0, 14.95);
  world.rod(new THREE.Vector3(-2.6, 0, 14.95), new THREE.Vector3(-2.6, 2.4, 14.95), 0.06, 0x8a5a33);
  world.rod(new THREE.Vector3(0.6, 0, 14.95), new THREE.Vector3(0.6, 2.4, 14.95), 0.06, 0x8a5a33);
}

function buildFence(world) {
  const { x0, x1, z0, z1 } = { x0: -21.6, x1: 21.6, z0: -15.6, z1: 15.6 };
  const pickets = [];
  const add = (ax, az, bx, bz, gap) => {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.floor(len / 0.32);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (gap && Math.abs(x - gap) < 1.6) continue;
      pickets.push([x, z]);
    }
    if (!gap) {
      for (const y of [0.35, 0.8]) world.rod(new THREE.Vector3(ax, y, az), new THREE.Vector3(bx, y, bz), 0.03, 0xf4efe6, { cast: false, seg: 6 });
    } else {
      for (const y of [0.35, 0.8]) {
        world.rod(new THREE.Vector3(ax, y, az), new THREE.Vector3(gap - 1.6, y, bz), 0.03, 0xf4efe6, { cast: false, seg: 6 });
        world.rod(new THREE.Vector3(gap + 1.6, y, az), new THREE.Vector3(bx, y, bz), 0.03, 0xf4efe6, { cast: false, seg: 6 });
      }
    }
  };
  add(x0, z0, x1, z0);
  add(x0, z1, x1, z1, 7); // a gate on the south side
  add(x0, z0, x0, z1);
  add(x1, z0, x1, z1);
  const g = new THREE.BoxGeometry(0.09, 1.0, 0.04);
  g.translate(0, 0.5, 0);
  const inst = new THREE.InstancedMesh(g, mat(0xf4efe6), pickets.length);
  const m = new THREE.Matrix4();
  pickets.forEach(([x, z], i) => {
    m.makeRotationY(Math.abs(Math.abs(x) - 21.6) < 0.01 ? Math.PI / 2 : 0);
    m.setPosition(x, 0, z);
    inst.setMatrixAt(i, m);
  });
  inst.castShadow = true;
  inst.receiveShadow = true;
  world.scene.add(inst);
}

function buildBench(world, x, z, yaw) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  world.scene.add(g);
  const o = { parent: g };
  world.box(1.8, 0.07, 0.45, 0xb5763f, 0, 0.45, 0, o);
  world.box(1.8, 0.4, 0.06, 0xb5763f, 0, 0.75, -0.24, o).rotation.x = -0.12;
  for (const sx of [-0.75, 0.75]) {
    world.box(0.07, 0.45, 0.4, 0x404850, sx, 0.22, 0, o);
  }
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const hw = Math.abs(c) * 0.95 + Math.abs(s) * 0.3, hd = Math.abs(s) * 0.95 + Math.abs(c) * 0.3;
  world.addWall(x - hw, x + hw, z - hd, z + hd, 0, 0.5, true);
}

export function speckleTexture(base, dots, size, count) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    g.fillStyle = dots[i % dots.length];
    g.globalAlpha = rand(0.35, 0.9);
    const r = rand(0.6, 2.2);
    g.beginPath();
    g.arc(rand(0, size), rand(0, size), r, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#fff7e6';
  g.fillRect(0, 0, 1024, 256);
  const cols = ['#ff5f5f', '#ffb000', '#3fbf5f', '#3f8fd0', '#9a62c9'];
  g.font = 'bold 104px "Trebuchet MS", system-ui, sans-serif';
  g.textBaseline = 'middle';
  let x = (1024 - g.measureText(text).width) / 2;
  [...text].forEach((ch, i) => {
    g.fillStyle = cols[i % cols.length];
    g.fillText(ch, x, 132);
    x += g.measureText(ch).width;
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
