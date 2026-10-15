// The play equipment. Each piece builds its meshes, registers its collision (surfaces, walls) and
// its interactables, and adds an updater for anything that moves.
//
// Layout (metres, y up, +z toward the starting camera):
//   Tower A (deck 1.6 m) at x -5..-3: ladder (south), wave slide (west), fire pole (north)
//   Wobbly bridge, sloping up east to Tower B (deck 2.4 m) at x 0.9..3.1: rock wall (south),
//     spiral slide (east), diving plank (north) over the ball pit at x 0..4, z -6.2..-3.2
//   Swings at z 8 (x -7.6, -6, -4.4), merry-go-round at (6, 8), seesaw at (12, 1.5),
//   sandbox at x -15..-11, z -9..-5, ice-cream cart at (13, -6.2).

import * as THREE from 'three';
import { mat, speckleTexture } from './world.js';
import { Path } from './character.js';
import { BallPit } from './ballpit.js';
import { clamp, damp, dist2D, rand } from './util.js';

export const STICKERS = [
  { id: 'ladder', label: 'Climb the ladder', hint: 'Red tower, south side' },
  { id: 'wave', label: 'Wave slide', hint: 'From the red tower' },
  { id: 'bridge', label: 'Cross the wobbly bridge', hint: 'Between the towers' },
  { id: 'wall', label: 'Climb the rock wall', hint: 'Blue tower, south side' },
  { id: 'spiral', label: 'Spiral slide', hint: 'From the blue tower' },
  { id: 'cannonball', label: 'Cannonball into the balls', hint: 'Jump off the diving plank' },
  { id: 'pole', label: 'Fire pole', hint: 'Red tower, north side' },
  { id: 'swing', label: 'Swing up high', hint: 'Hold forward to pump' },
  { id: 'merry', label: 'Ride the merry-go-round fast', hint: 'Push it, then hop on' },
  { id: 'seesaw', label: 'Seesaw with a friend', hint: 'Someone will join you' },
  { id: 'icecream', label: 'Get an ice cream', hint: 'The cart with the umbrella' },
  { id: 'dog', label: 'Pet the dog', hint: 'He loves fetch' },
];

const UP = new THREE.Vector3(0, 1, 0);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildEquipment(world) {
  const eq = {};
  buildTowers(world, eq);
  eq.wave = buildWaveSlide(world);
  eq.spiral = buildSpiralSlide(world);
  eq.pit = buildBallPit(world);
  eq.swings = buildSwings(world);
  eq.merry = buildMerry(world);
  eq.seesaw = buildSeesaw(world);
  eq.sandbox = buildSandbox(world);
  eq.cart = buildCart(world);
  return eq;
}

// ── towers, bridge, ladder, rock wall, pole, plank ────────────────────────────────────────────
function deck(world, { x0, x1, z0, z1, top, color, rail, roofH, roofColor, open }) {
  world.addSurface({ x0, x1, z0, z1, top, thick: 0.14 });
  world.box(x1 - x0, 0.14, z1 - z0, color, (x0 + x1) / 2, top - 0.07, (z0 + z1) / 2);
  const roofY = top + roofH;
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    world.box(0.14, roofY, 0.14, 0xf2f2f2, x, roofY / 2, z);
    world.addWall(x - 0.08, x + 0.08, z - 0.08, z + 0.08, 0, roofY);
  }
  const roof = world.mesh(new THREE.ConeGeometry(Math.max(x1 - x0, z1 - z0) * 0.85, 1.2, 4), roofColor, (x0 + x1) / 2, roofY + 0.6, (z0 + z1) / 2);
  roof.rotation.y = Math.PI / 4;
  // Railings: plastic panels on each edge, with openings.
  const edge = (axis, fixed, a0, a1, gaps) => {
    const segs = [];
    let a = a0;
    for (const [g0, g1] of [...gaps].sort((p, q) => p[0] - q[0])) {
      if (g0 > a) segs.push([a, g0]);
      a = Math.max(a, g1);
    }
    if (a < a1) segs.push([a, a1]);
    for (const [s0, s1] of segs) {
      const len = s1 - s0, mid = (s0 + s1) / 2;
      if (len < 0.05) continue;
      const p = axis === 'x' ? world.box(len, 0.62, 0.05, rail, mid, top + 0.46, fixed) : world.box(0.05, 0.62, len, rail, fixed, top + 0.46, mid);
      p.material = mat(rail, { roughness: 0.4 });
      if (axis === 'x') {
        world.rod(V(s0, top + 0.86, fixed), V(s1, top + 0.86, fixed), 0.035, 0xf2f2f2);
        world.addWall(s0, s1, fixed - 0.05, fixed + 0.05, top, top + 0.9);
      } else {
        world.rod(V(fixed, top + 0.86, s0), V(fixed, top + 0.86, s1), 0.035, 0xf2f2f2);
        world.addWall(fixed - 0.05, fixed + 0.05, s0, s1, top, top + 0.9);
      }
    }
  };
  edge('x', z0, x0, x1, open.n || []);
  edge('x', z1, x0, x1, open.s || []);
  edge('z', x0, z0, z1, open.w || []);
  edge('z', x1, z0, z1, open.e || []);
}

function buildTowers(world, eq) {
  deck(world, { x0: -5, x1: -3, z0: -1, z1: 1, top: 1.6, color: 0xffd23f, rail: 0xff5252, roofH: 1.9, roofColor: 0xff5252,
    open: { s: [[-4.4, -3.6]], w: [[-0.38, 0.38]], n: [[-4.4, -3.6]], e: [[-0.62, 0.62]] } });
  deck(world, { x0: 0.9, x1: 3.1, z0: -1.1, z1: 1.1, top: 2.4, color: 0xffd23f, rail: 0x3f8fff, roofH: 1.9, roofColor: 0x3f8fff,
    open: { s: [[1.55, 2.45]], e: [[-0.42, 0.42]], n: [[1.7, 2.3]], w: [[-0.62, 0.62]] } });

  // Wobbly bridge from deck A (1.6 m) up to deck B (2.4 m).
  const bx0 = -3, bx1 = 0.9;
  const topAt = (x) => 1.6 + ((x - bx0) / (bx1 - bx0)) * 0.8;
  const bridge = world.addSurface({ x0: bx0, x1: bx1, z0: -0.6, z1: 0.6, topAt: (x) => topAt(x), thick: 0.1 });
  const planks = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const x = bx0 + ((i + 0.5) / n) * (bx1 - bx0);
    const p = world.box((bx1 - bx0) / n - 0.04, 0.06, 1.15, i % 2 ? 0xc98a4b : 0xb87a3d, x, topAt(x) - 0.03, 0);
    p.rotation.z = Math.atan2(0.8, bx1 - bx0);
    p.userData.y0 = p.position.y;
    planks.push(p);
  }
  for (const z of [-0.62, 0.62]) {
    world.rod(V(bx0, 1.6 + 0.85, z), V(bx1, 2.4 + 0.85, z), 0.03, 0xe8d9b5);
    world.rod(V(bx0, 1.6 + 0.45, z), V(bx1, 2.4 + 0.45, z), 0.02, 0xe8d9b5);
    world.addWall(bx0, bx1, z - 0.04, z + 0.04, 1.6, 3.3);
  }
  let wobble = 0;
  bridge.onStand = () => { wobble = 1; };
  world.updaters.push((dt, t) => {
    wobble = Math.max(0, wobble - dt * 0.8);
    planks.forEach((p, i) => { p.position.y = p.userData.y0 + Math.sin(t * 9 + i * 0.8) * 0.03 * wobble; });
    // Bridge crossing sticker: remember which deck you stepped on from.
    for (const ch of world.characters) {
      if (!ch.isPlayer) continue;
      if (ch.groundRef === bridge) ch.bridgeFrom ??= ch.pos.x < (bx0 + bx1) / 2 ? 'A' : 'B';
      else if (ch.bridgeFrom && ch.mode === 'ground' && ch.grounded) {
        if ((ch.bridgeFrom === 'A' && ch.pos.x > bx1 && ch.pos.y > 2.2) || (ch.bridgeFrom === 'B' && ch.pos.x < bx0 && ch.pos.y > 1.4 && ch.pos.y < 1.8)) world.award(ch, 'bridge');
        ch.bridgeFrom = null;
      }
    }
  });

  // Ladder up the south face of tower A.
  for (const sx of [-0.32, 0.32]) {
    world.rod(V(-4 + sx, 0, 1.55), V(-4 + sx, 1.6, 1.02), 0.04, 0xf2f2f2);
    world.rod(V(-4 + sx, 1.6, 1.02), V(-4 + sx, 2.35, 1.02), 0.04, 0xf2f2f2);
  }
  for (let y = 0.3; y < 1.6; y += 0.3) {
    const z = 1.55 - (y / 1.6) * 0.53;
    world.rod(V(-4.32, y, z), V(-3.68, y, z), 0.03, 0xffd23f);
  }
  world.addWall(-4.4, -3.6, 1.05, 1.6, 0, 1.5);
  const ladderClimb = (fromTop) => ({
    p0: V(-4, 0, 1.85), p1: V(-4, 1.5, 1.3), exitTop: V(-4, 1.6, 0.62), exitBottom: V(-4, 0, 2.05),
    yaw: Math.PI, t: fromTop ? 1 : 0,
    onTop: (ch) => world.award(ch, 'ladder'),
  });
  eq.ladder = world.addInteractable({ id: 'ladder', label: 'Climb the ladder', pos: V(-4, 0, 2.05), radius: 0.85, can: (ch) => ch.mode === 'ground', use: (ch) => { ch.enter('climb', ladderClimb(false)); ch.pos.copy(ch.data.p0); } });
  world.addInteractable({ id: 'ladder-down', label: 'Climb down the ladder', pos: V(-4, 1.6, 0.72), radius: 0.4, can: (ch) => ch.mode === 'ground', use: (ch) => { ch.enter('climb', ladderClimb(true)); ch.pos.copy(ch.data.p1); } });

  // Rock wall up the south face of tower B.
  const panel = world.box(1.0, 2.6, 0.08, 0x8fd14f, 2, 1.2, 1.55);
  panel.rotation.x = -Math.atan2(0.8, 2.4);
  const holdCols = [0xff5252, 0xffd23f, 0x3f8fff, 0xb14dff, 0xff8c42, 0xffffff];
  for (let i = 0; i < 18; i++) {
    const y = 0.25 + (i / 18) * 2.1 + rand(-0.05, 0.05);
    const z = 1.95 - (y / 2.4) * 0.8 + 0.06;
    const h = world.mesh(new THREE.DodecahedronGeometry(rand(0.05, 0.08)), holdCols[i % holdCols.length], 2 + rand(-0.38, 0.38), y, z);
    h.scale.z = 0.6;
  }
  world.addWall(1.45, 2.55, 1.1, 1.95, 0, 2.3, true);
  eq.wall = world.addInteractable({ id: 'wall', label: 'Climb the rock wall', pos: V(2, 0, 2.45), radius: 0.85, can: (ch) => ch.mode === 'ground', use: (ch) => {
    ch.enter('climb', { p0: V(2, 0, 2.25), p1: V(2, 2.3, 1.45), exitTop: V(2, 2.4, 0.62), exitBottom: V(2, 0, 2.5), yaw: Math.PI, t: 0, onTop: (c) => world.award(c, 'wall') });
    ch.pos.copy(ch.data.p0);
  } });

  // Fire pole off the north side of tower A.
  world.rod(V(-4, 0, -1.42), V(-4, 2.7, -1.42), 0.045, 0xd8dde5, { m: mat(0xd8dde5, { metalness: 0.8, roughness: 0.25 }) });
  world.rod(V(-4, 2.7, -1.42), V(-4, 2.7, -0.9), 0.045, 0xd8dde5, { m: mat(0xd8dde5, { metalness: 0.8, roughness: 0.25 }) });
  world.addWall(-4.06, -3.94, -1.48, -1.36, 0, 2.7);
  eq.pole = world.addInteractable({ id: 'pole', label: 'Slide down the fire pole', pos: V(-4, 1.6, -0.72), radius: 0.45, can: (ch) => ch.mode === 'ground', use: (ch) => {
    ch.enter('pole', { x: -4, z: -1.42, a: 0, v: 0, onEnd: (c) => world.award(c, 'pole') });
    ch.pos.set(-4, 1.6, -1.2);
    world.emit('pole', ch);
  } });

  // Diving plank off the north side of tower B, out over the ball pit.
  const plank = world.addSurface({ x0: 1.72, x1: 2.28, z0: -3.7, z1: -1.1, top: 2.4, thick: 0.1, springy: true });
  world.box(0.56, 0.08, 2.6, 0x3fbfbf, 2, 2.36, -2.4).material = mat(0x3fbfbf, { roughness: 0.5 });
  world.box(0.1, 2.32, 0.1, 0xf2f2f2, 2, 1.16, -2.75);
  world.addWall(1.94, 2.06, -2.8, -2.7, 0, 2.3);
  eq.plank = plank;
}

// ── slides ────────────────────────────────────────────────────────────────────────────────────
function trough(world, path, { w = 0.34, color }) {
  const M = 12;
  const pts = path.pts;
  const pos = [];
  const side = new THREE.Vector3(), upn = new THREE.Vector3(), t = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    t.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(t, UP).normalize();
    upn.crossVectors(side, t).normalize();
    for (let k = 0; k <= M; k++) {
      const a = (k / M) * Math.PI;
      const s = Math.cos(a) * w, u = (1 - Math.sin(a)) * w * 0.8 - 0.02;
      pos.push(pts[i].x + side.x * s + upn.x * u, pts[i].y + side.y * s + upn.y * u, pts[i].z + side.z * s + upn.z * u);
    }
  }
  const idx = [];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < M; k++) {
      const a = i * (M + 1) + k, b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = world.mesh(g, color, 0, 0, 0, { m: new THREE.MeshStandardMaterial({ color, roughness: 0.3, side: THREE.DoubleSide }) });
  return m;
}

function buildWaveSlide(world) {
  const path = new Path([V(-5.15, 1.62, 0), V(-5.9, 1.2, 0), V(-6.6, 1.08, 0), V(-7.4, 0.72, 0), V(-8.3, 0.58, 0), V(-9.2, 0.38, 0), V(-10, 0.34, 0)]);
  trough(world, path, { color: 0x2fbf4f });
  for (const s of [0.42, 0.72, 0.97]) {
    const p = path.at(path.length * s, new THREE.Vector3());
    for (const sz of [-0.3, 0.3]) world.rod(V(p.x, 0, sz), V(p.x, p.y, sz), 0.035, 0xf2f2f2);
  }
  return world.addInteractable({ id: 'wave', label: 'Go down the wave slide', pos: V(-4.62, 1.6, 0), radius: 0.5, can: (ch) => ch.mode === 'ground', use: (ch) => {
    ch.enter('slide', { path, s: 0, v: 1.6, onEnd: (c) => world.award(c, 'wave') });
    world.emit('slide', ch);
  } });
}

function buildSpiralSlide(world) {
  const cx = 4.7, cz = 0, r = 1.4;
  const pts = [V(3.12, 2.45, 0)];
  const turns = 1.25;
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const th = Math.PI + (i / N) * turns * 2 * Math.PI;
    const y = 2.4 - (i / N) * 2.0;
    pts.push(V(cx + Math.cos(th) * r, y, cz + Math.sin(th) * r));
  }
  pts.push(V(cx + 0.9, 0.36, cz - r), V(cx + 1.7, 0.33, cz - r));
  const path = new Path(pts, 360);
  trough(world, path, { color: 0xffa21f, w: 0.36 });
  world.rod(V(cx, 0, cz), V(cx, 3.1, cz), 0.09, 0xf2f2f2);
  world.mesh(new THREE.ConeGeometry(0.5, 0.5, 12), 0xffa21f, cx, 3.35, cz);
  for (let i = 4; i < pts.length - 3; i += 5) {
    const p = pts[i];
    world.rod(V(cx, p.y - 0.05, cz), V(p.x, p.y - 0.05, p.z), 0.03, 0xf2f2f2);
  }
  world.addWall(cx - 0.12, cx + 0.12, cz - 0.12, cz + 0.12, 0, 3.1);
  return world.addInteractable({ id: 'spiral', label: 'Go down the spiral slide', pos: V(2.75, 2.4, 0), radius: 0.5, can: (ch) => ch.mode === 'ground', use: (ch) => {
    ch.enter('slide', { path, s: 0, v: 1.5, onEnd: (c) => world.award(c, 'spiral') });
    world.emit('slide', ch);
  } });
}

// ── ball pit ──────────────────────────────────────────────────────────────────────────────────
function buildBallPit(world) {
  const x0 = 0, x1 = 4, z0 = -6.2, z1 = -3.2, t = 0.15, h = 0.55;
  const cols = [0xff5252, 0xffd23f, 0x3f8fff, 0x2fbf4f];
  const segs = [
    [x0, x1, z0, z0 + t], [x0, x1, z1 - t, z1], [x0, x0 + t, z0 + t, z1 - t], [x1 - t, x1, z0 + t, z1 - t],
  ];
  segs.forEach(([a0, a1, b0, b1], i) => {
    const b = world.box(a1 - a0, h, b1 - b0, cols[i], (a0 + a1) / 2, h / 2, (b0 + b1) / 2);
    b.material = mat(cols[i], { roughness: 0.55 });
    world.addWall(a0, a1, b0, b1, 0, h);
    world.addSurface({ x0: a0, x1: a1, z0: b0, z1: b1, top: h, thick: h });
  });
  // Soft padding on the rim.
  for (const [a0, a1, b0, b1] of segs) world.box(a1 - a0 + 0.02, 0.06, b1 - b0 + 0.02, 0xffffff, (a0 + a1) / 2, h + 0.03, (b0 + b1) / 2, { cast: false });
  world.box(x1 - x0 - 0.3, 0.02, z1 - z0 - 0.3, 0x8fd1ff, (x0 + x1) / 2, 0.01, (z0 + z1) / 2, { cast: false });
  world.navBlockers.push({ x0, x1, z0, z1 });
  const pit = new BallPit(world, { x0, x1, z0, z1, wall: t, rim: h, count: 1000 });
  world.ballPit = pit;
  world.updaters.push((dt) => pit.update(dt));
  return pit;
}

// ── swings ────────────────────────────────────────────────────────────────────────────────────
function buildSwings(world) {
  const z = 8, top = 3.0, L = 2.4;
  world.rod(V(-9.1, top, z), V(-2.9, top, z), 0.07, 0xff5252);
  for (const x of [-9.1, -2.9]) {
    for (const dz of [-1.4, 1.4]) {
      world.rod(V(x, top, z), V(x + (x < -6 ? -0.2 : 0.2), 0, z + dz), 0.06, 0xff5252);
      world.addWall(x - 0.3, x + 0.3, z + dz - 0.12, z + dz + 0.12, 0, 0.6);
    }
  }
  const seatCols = [0x3f8fff, 0xffd23f, 0x2fbf4f];
  return [-7.6, -6, -4.4].map((x, i) => {
    const g = new THREE.Group();
    g.position.set(x, top, z);
    world.scene.add(g);
    for (const sx of [-0.22, 0.22]) {
      const ch = world.rod(V(sx, 0, 0), V(sx, -L, 0), 0.012, 0x9aa3ad, { parent: g, seg: 4 });
      ch.material = mat(0x9aa3ad, { metalness: 0.7, roughness: 0.35 });
    }
    world.box(0.5, 0.05, 0.22, seatCols[i], 0, -L, 0, { parent: g });
    const sw = { x, z, top, L, th: 0, om: 0, occupant: null, group: g, highT: 0 };
    const seat = new THREE.Vector3();
    sw.seatPos = (out) => out.set(x, top - Math.cos(sw.th) * L + 0.03, z + Math.sin(sw.th) * L);
    world.updaters.push((dt) => {
      const o = sw.occupant;
      let pump = 0;
      if (o) {
        const want = o.input.fwd > 0.2 || o.input.mz < -0.3 || o.input.mz > 0.3 || o.input.mx > 0.3 || o.input.mx < -0.3;
        if (want && Math.abs(sw.th) < 1.15) pump = Math.abs(sw.om) < 0.08 ? 1.2 : Math.sign(sw.om) * 2.3;
      }
      const damping = o ? 0.08 : 0.55;
      sw.om += (-(9.8 / L) * Math.sin(sw.th) - damping * sw.om + pump) * dt;
      sw.th = clamp(sw.th + sw.om * dt, -1.3, 1.3);
      if (Math.abs(sw.th) >= 1.3) sw.om *= 0.5;
      g.rotation.x = -sw.th;
      if (o && o.isPlayer && Math.abs(sw.th) > 0.8) world.award(o, 'swing');
      if (o && Math.abs(sw.th) > 0.95 && (sw.highT -= dt) < 0) { sw.highT = 4; world.emit('swingHigh', o); }
    });
    sw.interact = world.addInteractable({ id: 'swing' + i, label: 'Hop on the swing', pos: V(x, 0, z), radius: 0.75,
      can: (ch) => ch.mode === 'ground' && !sw.occupant && Math.abs(sw.th) < 0.3 && ch.grounded,
      use: (ch) => {
        sw.occupant = ch;
        ch.enter('swing', {
          swing: sw,
          drive: (c) => {
            sw.seatPos(c.pos);
            c.yaw = 0;
            c.pose = 'swing';
            c.swingTilt = -sw.th;
            c.swingPhase = sw.th * 2.5;
          },
          exitVel: () => [0, L * sw.om * Math.sin(sw.th) + 2.2, L * sw.om * Math.cos(sw.th)],
          release: () => { sw.occupant = null; },
        });
        sw.seatPos(ch.pos);
      } });
    return sw;
  });
}

// ── merry-go-round ────────────────────────────────────────────────────────────────────────────
function buildMerry(world) {
  const cx = 6, cz = 8, r = 1.8, top = 0.28;
  const g = new THREE.Group();
  g.position.set(cx, 0, cz);
  world.scene.add(g);
  const cols = [0xff5252, 0xffd23f, 0x3f8fff, 0x2fbf4f, 0xb14dff, 0xff8c42];
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.16, 8, 1, false, (i / 6) * Math.PI * 2, Math.PI / 3), mat(cols[i], { roughness: 0.5 }));
    m.position.y = top - 0.08;
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  world.rod(V(0, top, 0), V(0, 1.0, 0), 0.06, 0xf2f2f2, { parent: g });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const ex = Math.sin(a) * r * 0.92, ez = Math.cos(a) * r * 0.92;
    world.rod(V(0, 1.0, 0), V(ex, 0.9, ez), 0.03, 0xf2f2f2, { parent: g });
    world.rod(V(ex, 0.9, ez), V(ex, top, ez), 0.03, 0xf2f2f2, { parent: g });
  }
  world.mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.2, 16), 0x666c75, cx, 0.1, cz);
  const m = { cx, cz, r, om: 0, angle: 0, group: g };
  const surf = world.addSurface({ cx, cz, r, top, thick: 0.2,
    carry: (ch, dt) => {
      const a = m.om * dt;
      const dx = ch.pos.x - cx, dz = ch.pos.z - cz;
      const c = Math.cos(a), s = Math.sin(a);
      ch.pos.x = cx + dx * c + dz * s;
      ch.pos.z = cz - dx * s + dz * c;
      ch.yaw += a;
    },
    onStand: (ch, dt) => {
      if (ch.isPlayer) {
        if (Math.abs(m.om) > 2.2) { m.fastT = (m.fastT || 0) + dt; if (m.fastT > 1) world.award(ch, 'merry'); }
        else m.fastT = 0;
      }
    },
  });
  m.surface = surf;
  world.updaters.push((dt) => {
    m.om = damp(m.om, 0, 0.16, dt);
    m.angle += m.om * dt;
    g.rotation.y = m.angle;
  });
  m.push = world.addInteractable({ id: 'merry-push', label: 'Give it a spin', pos: V(cx, 0, cz), radius: 0,
    near: (ch) => {
      const d = dist2D(ch.pos, m.group.position);
      return ch.mode === 'ground' && ch.groundRef !== surf && ch.pos.y < 0.2 && d > r - 0.1 && d < r + 0.9 ? d - r : null;
    },
    use: (ch) => { m.om = Math.min(5.5, m.om + 1.7); ch.setPose('push', 0.6); world.emit('spin', ch); } });
  world.addInteractable({ id: 'merry-faster', label: 'Spin faster', pos: V(cx, 0, cz), radius: 0,
    near: (ch) => (ch.mode === 'ground' && ch.groundRef === surf ? 1 : null),
    use: (ch) => { m.om = Math.min(5.5, m.om + 0.9); ch.setPose('push', 0.4); world.emit('spin', ch); } });
  return m;
}

// ── seesaw ────────────────────────────────────────────────────────────────────────────────────
function buildSeesaw(world) {
  const px = 12, pz = 1.5, py = 0.55, half = 2.0, seatD = 1.75;
  const g = new THREE.Group();
  g.position.set(px, py, pz);
  world.scene.add(g);
  world.box(half * 2, 0.07, 0.32, 0x3f8fff, 0, 0.04, 0, { parent: g });
  for (const sx of [-1, 1]) {
    world.box(0.4, 0.06, 0.34, 0xffd23f, sx * seatD, 0.1, 0, { parent: g });
    world.rod(V(sx * (seatD - 0.3), 0.07, 0), V(sx * (seatD - 0.3), 0.42, 0), 0.025, 0xff5252, { parent: g });
    world.rod(V(sx * (seatD - 0.3), 0.42, -0.14), V(sx * (seatD - 0.3), 0.42, 0.14), 0.025, 0xff5252, { parent: g });
  }
  const base = world.mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.4, 3), 0xff5252, px, 0.3, pz);
  base.rotation.x = Math.PI / 2;
  base.scale.set(1, 1, 1.4);
  world.addWall(px - 0.3, px + 0.3, pz - 0.25, pz + 0.25, 0, 0.55);
  const ss = { px, pz, py, seatD, alpha: 0, phase: 0, occ: [null, null], buddyT: 0, group: g };
  ss.seatPos = (side, out) => {
    const s = side ? 1 : -1;
    return out.set(px + s * seatD * Math.cos(ss.alpha), py + s * seatD * Math.sin(ss.alpha) + 0.12, pz);
  };
  world.updaters.push((dt) => {
    const [a, b] = ss.occ;
    let target = 0;
    if (a && b) {
      ss.phase += dt * 2.3;
      target = 0.24 * Math.sin(ss.phase);
      ss.alpha = damp(ss.alpha, target, 10, dt);
      const pl = a.isPlayer ? a : b.isPlayer ? b : null;
      if (pl) { ss.buddyT += dt; if (ss.buddyT > 3) world.award(pl, 'seesaw'); }
      if (Math.sin(ss.phase) * Math.sin(ss.phase - dt * 2.3) < 0) world.emit('seesawBump', ss);
    } else {
      ss.buddyT = 0;
      target = a ? -0.24 : b ? 0.24 : 0;
      ss.alpha = damp(ss.alpha, target, 3, dt);
      ss.phase = Math.asin(clamp(ss.alpha / 0.24, -1, 1));
    }
    g.rotation.z = ss.alpha;
  });
  ss.interacts = [0, 1].map((side) => world.addInteractable({ id: 'seesaw' + side, label: 'Ride the seesaw', pos: V(px + (side ? 1 : -1) * seatD, 0, pz), radius: 0.95,
    can: (ch) => ch.mode === 'ground' && !ss.occ[side] && ch.pos.y < 0.4,
    use: (ch) => {
      ss.occ[side] = ch;
      ch.enter('seat', {
        seesaw: ss, side,
        drive: (c) => { ss.seatPos(side, c.pos); c.yaw = side ? -Math.PI / 2 : Math.PI / 2; c.pose = 'seat'; },
        exitVel: () => [(side ? 1 : -1) * 1.5, 3, 0.6],
        release: () => { ss.occ[side] = null; },
      });
      ss.seatPos(side, ch.pos);
    } }));
  return ss;
}

// ── sandbox ───────────────────────────────────────────────────────────────────────────────────
function buildSandbox(world) {
  const x0 = -15, x1 = -11, z0 = -9, z1 = -5, h = 0.22;
  const sand = speckleTexture('#ecd9a0', ['#dcc58a', '#f6e7bb', '#cfb47a', '#fff4d6'], 256, 2200);
  sand.repeat.set(2, 2);
  const s = world.mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), 0, (x0 + x1) / 2, 0.06, (z0 + z1) / 2, { cast: false, m: new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }) });
  s.rotation.x = -Math.PI / 2;
  for (const [a0, a1, b0, b1] of [[x0, x1, z0, z0 + 0.18], [x0, x1, z1 - 0.18, z1], [x0, x0 + 0.18, z0, z1], [x1 - 0.18, x1, z0, z1]]) {
    world.box(a1 - a0, h, b1 - b0, 0xb5763f, (a0 + a1) / 2, h / 2, (b0 + b1) / 2);
    world.addSurface({ x0: a0, x1: a1, z0: b0, z1: b1, top: h, thick: h });
  }
  world.addSurface({ x0: x0 + 0.18, x1: x1 - 0.18, z0: z0 + 0.18, z1: z1 - 0.18, top: 0.06, thick: 0.06 });
  // A sandcastle, a bucket and a spade.
  const cx = -13.6, cz = -7.4;
  world.mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.28, 10), 0xe2c98a, cx, 0.2, cz);
  for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
    world.mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.42, 8), 0xe2c98a, cx + dx, 0.27, cz + dz);
    world.mesh(new THREE.ConeGeometry(0.12, 0.16, 8), 0xd6b874, cx + dx, 0.56, cz + dz);
  }
  world.rod(V(cx, 0.34, cz), V(cx, 0.75, cz), 0.01, 0x666666);
  const flag = world.mesh(new THREE.PlaneGeometry(0.16, 0.1), 0xff5252, cx + 0.08, 0.7, cz);
  flag.material = mat(0xff5252, { side: THREE.DoubleSide });
  world.mesh(new THREE.CylinderGeometry(0.14, 0.1, 0.2, 12, 1, true), 0x3f8fff, -12, 0.16, -6, { m: mat(0x3f8fff, { side: THREE.DoubleSide }) });
  return { x0: x0 + 0.5, x1: x1 - 0.5, z0: z0 + 0.5, z1: z1 - 0.5 };
}

// ── ice-cream cart ────────────────────────────────────────────────────────────────────────────
function buildCart(world) {
  const x = 13, z = -6.2;
  world.box(1.6, 0.8, 0.8, 0xffffff, x, 0.65, z);
  world.box(1.62, 0.12, 0.82, 0xff7ab8, x, 0.9, z);
  world.box(1.62, 0.12, 0.82, 0xff7ab8, x, 0.4, z);
  for (const sx of [-0.6, 0.6]) {
    const w = world.mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 16), 0x333333, x + sx, 0.22, z + 0.42);
    w.rotation.x = Math.PI / 2;
  }
  world.rod(V(x, 1.05, z), V(x, 2.4, z), 0.03, 0xdddddd);
  const cols = [0xff7ab8, 0xffffff];
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.55, 2, 1, true, (i / 8) * Math.PI * 2, Math.PI / 4), mat(cols[i % 2], { side: THREE.DoubleSide }));
    c.position.set(x, 2.55, z);
    c.castShadow = true;
    world.scene.add(c);
  }
  // A big cone on the front of the cart.
  const cone = world.mesh(new THREE.ConeGeometry(0.12, 0.34, 10), 0xd9a35b, x, 1.25, z + 0.3);
  cone.rotation.x = Math.PI;
  world.mesh(new THREE.SphereGeometry(0.13, 12, 10), 0xffb3d1, x, 1.45, z + 0.3);
  world.addWall(x - 0.85, x + 0.85, z - 0.45, z + 0.5, 0, 1.2, true);
  const cart = { x, z, servePos: V(x, 0, z + 1.1) };
  cart.interact = world.addInteractable({ id: 'icecream', label: 'Get an ice cream', pos: V(x, 0, z + 1.0), radius: 1.2,
    can: (ch) => ch.mode === 'ground' && !ch.holding,
    use: (ch) => {
      giveCone(world, ch);
      world.award(ch, 'icecream');
      world.emit('icecream', ch);
    } });
  return cart;
}

const SCOOPS = [0xffb3d1, 0xfff1c7, 0x7a4a2a, 0xa8e6a1, 0xc7a8ff];
export function giveCone(world, ch) {
  const g = new THREE.Group();
  const c = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), mat(0xd9a35b));
  c.rotation.x = Math.PI;
  g.add(c);
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(SCOOPS[Math.floor(Math.random() * SCOOPS.length)]));
  s1.position.y = 0.08;
  g.add(s1);
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(SCOOPS[Math.floor(Math.random() * SCOOPS.length)]));
  s2.position.y = 0.15;
  g.add(s2);
  g.position.set(0, -0.02, 0.03);
  g.rotation.x = Math.PI / 2; // the arm points forward, so the arm's +z is up
  ch.model.hand.add(g);
  ch.holding = g;
  ch.holdT = 35;
}
