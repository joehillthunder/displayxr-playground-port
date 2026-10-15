// Characters: a blocky-cute kid (or grown-up) model built from primitives, and the movement code
// every kid shares. The player and the NPC kids run the SAME code; the only difference is where
// their input comes from (keyboard/touch/gamepad vs. a little brain in npc.js).
//
// Modes: 'ground' (walking, running, jumping, falling, wading in the ball pit), 'climb' (ladder or
// rock wall), 'slide', 'pole', 'swing', 'seat' (seesaw), 'sit' (sandbox, bench). Equipment starts a
// mode with ch.enter(mode, data); data.release(ch) runs when the kid leaves it.

import * as THREE from 'three';
import { mat } from './world.js';
import { clamp, damp, dampAngle, angleDiff } from './util.js';

const G = -14;
const STEP = 0.36;
export const RADIUS = 0.24;

export const SKIN = [0xf6d2b8, 0xe8b48f, 0xc98e63, 0x9a6440, 0x6f4429, 0xffe0c7];
export const HAIR = [0x2b1d14, 0x5a3a22, 0xc58b3f, 0xf2d27a, 0x111111, 0xa0451f];

/**
 * Build a character model. Returns { root, parts } where root sits at the feet, facing +z.
 * look: { skin, hair, hairStyle, shirt, pants, shoes, skirt, adult, hat }
 */
export function buildModel(look) {
  const adult = !!look.adult;
  const S = adult ? 1.45 : 1;
  const legLen = (adult ? 0.5 : 0.42) * (adult ? 1.25 : 1);
  const torsoLen = adult ? 0.62 : 0.38;
  const headR = adult ? 0.15 : 0.165;
  const shoulderW = adult ? 0.24 : 0.16;

  const root = new THREE.Group();
  const tilt = new THREE.Group(); // swing / lean rotations
  root.add(tilt);
  const hips = new THREE.Group();
  hips.position.y = legLen;
  tilt.add(hips);

  const add = (parent, geo, color, x = 0, y = 0, z = 0, m) => {
    const o = new THREE.Mesh(geo, m || mat(color));
    o.position.set(x, y, z);
    o.castShadow = true;
    parent.add(o);
    return o;
  };

  // Legs pivot at the hips and hang down -y.
  const legs = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * (adult ? 0.1 : 0.075), 0, 0);
    hips.add(leg);
    const r = adult ? 0.075 : 0.068;
    add(leg, new THREE.CapsuleGeometry(r, legLen - r * 2 - 0.04, 4, 8), look.pants, 0, -legLen / 2 + 0.02, 0);
    const shoe = add(leg, new THREE.BoxGeometry(r * 2.1, 0.07, r * 3.2), look.shoes, 0, -legLen + 0.035, 0.035);
    shoe.castShadow = true;
    legs.push(leg);
  }

  const torso = new THREE.Group();
  hips.add(torso);
  const bodyR = adult ? 0.17 : 0.145;
  add(torso, new THREE.CapsuleGeometry(bodyR, torsoLen - bodyR * 1.2, 4, 10), look.shirt, 0, torsoLen / 2, 0);
  if (look.skirt) {
    const sk = add(torso, new THREE.CylinderGeometry(bodyR * 0.95, bodyR * 1.6, 0.2, 14, 1, true), look.skirt, 0, 0.02, 0);
    sk.material = mat(look.skirt, { side: THREE.DoubleSide });
  }
  if (look.stripe) add(torso, new THREE.CylinderGeometry(bodyR * 1.02, bodyR * 1.02, 0.06, 14), look.stripe, 0, torsoLen * 0.55, 0);

  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * shoulderW, torsoLen * 0.88, 0);
    torso.add(arm);
    const len = adult ? 0.5 : 0.34;
    add(arm, new THREE.CapsuleGeometry(adult ? 0.055 : 0.048, len - 0.1, 4, 8), look.sleeve ?? look.shirt, 0, -len / 2, 0);
    const hand = add(arm, new THREE.SphereGeometry(adult ? 0.055 : 0.05, 10, 8), look.skin, 0, -len, 0);
    arm.userData.hand = hand;
    arm.rotation.z = sx * 0.12;
    arms.push(arm);
  }

  const head = new THREE.Group();
  head.position.y = torsoLen + headR * 0.95;
  torso.add(head);
  add(head, new THREE.SphereGeometry(headR, 18, 14), look.skin);
  // Face: eyes, cheeks, a smile, all on the +z side.
  const eyeM = mat(0x1d1d24, { roughness: 0.3 });
  for (const sx of [-1, 1]) {
    add(head, new THREE.SphereGeometry(headR * 0.13, 8, 6), 0, sx * headR * 0.36, headR * 0.12, headR * 0.9, eyeM);
    const cheek = add(head, new THREE.SphereGeometry(headR * 0.12, 8, 6), 0xff8f8f, sx * headR * 0.56, -headR * 0.18, headR * 0.78);
    cheek.scale.z = 0.4;
    cheek.castShadow = false;
  }
  const smile = add(head, new THREE.TorusGeometry(headR * 0.26, headR * 0.045, 6, 12, Math.PI), 0, 0, -headR * 0.22, headR * 0.92, eyeM);
  smile.rotation.z = Math.PI;
  // Hair.
  const hairM = mat(look.hair, { roughness: 0.9 });
  const cap = add(head, new THREE.SphereGeometry(headR * 1.07, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), 0, 0, headR * 0.02, -headR * 0.06, hairM);
  cap.rotation.x = -0.25;
  const style = look.hairStyle || 'short';
  if (style === 'pigtails') {
    for (const sx of [-1, 1]) add(head, new THREE.SphereGeometry(headR * 0.42, 10, 8), 0, sx * headR * 1.05, headR * 0.15, -headR * 0.25, hairM);
  } else if (style === 'ponytail') {
    const p = add(head, new THREE.CapsuleGeometry(headR * 0.28, headR * 0.9, 4, 8), 0, 0, -headR * 0.3, -headR * 1.05, hairM);
    p.rotation.x = 0.5;
  } else if (style === 'curly') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      add(head, new THREE.SphereGeometry(headR * 0.36, 8, 6), 0, Math.cos(a) * headR * 0.85, headR * 0.45, Math.sin(a) * headR * 0.85 - headR * 0.15, hairM);
    }
  } else if (style === 'long') {
    const back = add(head, new THREE.CapsuleGeometry(headR * 0.85, headR * 1.1, 4, 10), 0, 0, -headR * 0.55, -headR * 0.45, hairM);
    back.scale.z = 0.55;
  } else if (style === 'bun') {
    add(head, new THREE.SphereGeometry(headR * 0.45, 10, 8), 0, 0, headR * 1.05, -headR * 0.35, hairM);
  }
  if (look.hat) {
    const hm = mat(look.hat);
    add(head, new THREE.SphereGeometry(headR * 1.1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0, headR * 0.12, 0, hm);
    const brim = add(head, new THREE.CylinderGeometry(headR * 0.75, headR * 0.75, 0.02, 16, 1, false, -Math.PI / 2, Math.PI), 0, 0, headR * 0.18, headR * 0.55, hm);
    brim.scale.z = 1.2;
  }

  root.scale.setScalar(look.scale ?? 1);
  return {
    root, tilt, hips, torso, head, legs, arms,
    legLen, height: (legLen + torsoLen + headR * 2.1) * (look.scale ?? 1) * (adult ? 1 : 1),
    scale: look.scale ?? 1,
    hand: arms[1].userData.hand,
  };
}

// Target joint angles per pose. legs[i].x, arms[i].x/z, torso.x, hipsY offset (fraction of leg).
function poseTargets(ch, out) {
  const p = ch.phase;
  const s = Math.sin(p);
  let legL = 0, legR = 0, armL = 0, armR = 0, armZ = 0.12, torso = 0, sit = false, headX = 0;
  switch (ch.pose) {
    case 'walk': {
      const a = clamp(ch.speed / 3.2, 0, 1.6) * 0.55;
      legL = s * a; legR = -s * a; armL = -s * a * 0.9; armR = s * a * 0.9; torso = 0.06 * a;
      break;
    }
    case 'air':
      legL = -0.5; legR = 0.2; armL = -2.6; armR = -2.4; armZ = 0.5;
      break;
    case 'flail':
      legL = -0.6 + s * 0.4; legR = -0.6 - s * 0.4; armL = -2.4 + s * 0.6; armR = -2.4 - s * 0.6; armZ = 0.6;
      break;
    case 'climb':
      legL = -0.7 + s * 0.45; legR = -0.7 - s * 0.45; armL = -2.5 - s * 0.45; armR = -2.5 + s * 0.45; torso = 0.15;
      break;
    case 'slide':
      sit = true; legL = legR = -1.45; armL = armR = -2.8; armZ = 0.45; torso = -0.25; headX = 0.2;
      break;
    case 'swing':
      sit = true; legL = legR = -1.4 + Math.sin(ch.swingPhase || 0) * 0.5; armL = armR = -2.7; armZ = 0.05; torso = -0.1;
      break;
    case 'seat':
      sit = true; legL = legR = -1.2; armL = armR = -1.25; armZ = 0.05;
      break;
    case 'sit':
      sit = true; legL = legR = -1.5; armL = -0.4; armR = -0.4;
      break;
    case 'dig':
      sit = true; legL = -1.5; legR = -1.3; armL = -0.6; armR = -1.0 + Math.sin(p * 2.5) * 0.6; torso = 0.35;
      break;
    case 'read':
      sit = true; legL = legR = -1.5; armL = armR = -1.1; armZ = 0.35; torso = 0.08; headX = 0.35;
      break;
    case 'pole':
      legL = -0.9; legR = -0.6; armL = -2.9; armR = -2.6; armZ = 0.2;
      break;
    case 'push':
      legL = s * 0.5; legR = -s * 0.5; armL = armR = -1.45; torso = 0.3;
      break;
    case 'wave':
      armR = -2.9; armZ = 0.12 + Math.sin(p * 3) * 0.35;
      break;
    case 'throw':
      armR = -2.6 + Math.sin(p * 2) * 1.2; legL = 0.2; legR = -0.2;
      break;
    default: // idle
      armL = armR = Math.sin(p * 0.5) * 0.04;
  }
  // Seated grown-ups wave and throw from the bench.
  if (ch.mode === 'sit' && !sit) { sit = true; legL = legR = -1.5; }
  if (ch.holding && !['climb', 'pole', 'slide', 'swing'].includes(ch.pose)) armR = -1.3;
  out.legL = legL; out.legR = legR; out.armL = armL; out.armR = armR; out.armZ = armZ; out.torso = torso; out.sit = sit; out.headX = headX;
  return out;
}

const _t = {};

export class Character {
  constructor(world, look, { name = 'Kid', isPlayer = false, adult = false } = {}) {
    this.world = world;
    this.name = name;
    this.isPlayer = isPlayer;
    this.look = { ...look, adult };
    this.model = buildModel(this.look);
    world.scene.add(this.model.root);
    this.height = adult ? 1.75 : 1.2 * (look.scale ?? 1);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.mode = 'ground';
    this.data = null;
    this.grounded = true;
    this.groundRef = null;
    this.peakY = 0;
    this.phase = Math.random() * 6;
    this.pose = 'idle';
    this.poseHold = 0;
    this.speed = 0;
    this.input = { mx: 0, mz: 0, fwd: 0, run: false, jump: false, action: false };
    this.inPit = false;
    this.adult = adult;
  }

  place(x, y, z, yaw = this.yaw) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.mode = 'ground';
    this.data = null;
    this.syncModel(0);
  }

  enter(mode, data) {
    this.leave();
    this.mode = mode;
    this.data = data || {};
    this.vel.set(0, 0, 0);
    this.grounded = false;
  }

  /** Leave the current equipment mode (release it) and return to walking. */
  leave() {
    const d = this.data;
    this.data = null;
    if (this.mode !== 'ground') {
      this.mode = 'ground';
      d?.release?.(this);
    }
  }

  /** Jump off whatever we are on, with a launch velocity. */
  launch(vx, vy, vz) {
    this.leave();
    this.vel.set(vx, vy, vz);
    this.grounded = false;
    this.peakY = this.pos.y;
    this.jumpCool = 0.25;
  }

  setPose(p, hold = 0) {
    this.pose = p;
    this.poseHold = hold;
  }

  update(dt) {
    const inp = this.input;
    if (this.poseHold > 0) this.poseHold -= dt;
    this.jumpCool = Math.max(0, (this.jumpCool || 0) - dt);
    switch (this.mode) {
      case 'ground': this.updateGround(dt); break;
      case 'climb': this.updateClimb(dt); break;
      case 'slide': this.updateSlide(dt); break;
      case 'pole': this.updatePole(dt); break;
      default:
        // Equipment-driven modes (swing, seat, sit): the equipment moves us; jump gets off.
        this.data?.drive?.(this, dt);
        if (inp.jump && this.mode !== 'ground' && this.data?.canLeave !== false) {
          const v = this.data?.exitVel?.(this) || [Math.sin(this.yaw) * 1.2, 3.5, Math.cos(this.yaw) * 1.2];
          this.launch(...v);
        }
    }
    inp.jump = false;
    inp.action = false;
    this.syncModel(dt);
  }

  updateGround(dt) {
    const inp = this.input;
    const w = this.world;
    const pit = w.ballPit;
    this.inPit = !!pit && pit.contains(this.pos.x, this.pos.z) && this.pos.y < pit.rim + 0.3;
    const maxSpeed = (inp.run ? 5.2 : 3.2) * (this.inPit ? 0.55 : 1) * (this.speedMul || 1);
    const mag = Math.min(1, Math.hypot(inp.mx, inp.mz));
    const tx = mag > 0.01 ? (inp.mx / Math.max(mag, 1e-6)) * mag * maxSpeed : 0;
    const tz = mag > 0.01 ? (inp.mz / Math.max(mag, 1e-6)) * mag * maxSpeed : 0;
    const accel = this.grounded ? 12 : 2.5;
    this.vel.x = damp(this.vel.x, tx, accel, dt);
    this.vel.z = damp(this.vel.z, tz, accel, dt);
    if (mag > 0.05) this.yaw = dampAngle(this.yaw, Math.atan2(inp.mx, inp.mz), 12, dt);

    if (inp.jump && this.grounded && this.jumpCool <= 0) {
      let vy = this.inPit ? 4.8 : 5.4;
      if (this.groundRef?.springy) { vy = 6.4; this.vel.x *= 0.45; this.vel.z *= 0.45; w.emit('boing', this); }
      this.vel.y = vy;
      this.grounded = false;
      this.jumpCool = 0.2;
      w.emit('jump', this);
    }
    this.vel.y += G * dt;
    if (this.inPit) this.vel.y = Math.max(this.vel.y, -6) ; // the balls slow a fall
    const prevY = this.pos.y;
    this.pos.addScaledVector(this.vel, dt);

    w.collideWalls(this.pos, RADIUS, this.height);

    // Head bump under decks.
    const ceil = w.ceilingAt(this.pos.x, this.pos.z, prevY + this.height - 0.05);
    if (this.vel.y > 0 && this.pos.y + this.height > ceil) {
      this.pos.y = ceil - this.height;
      this.vel.y = 0;
    }

    const floor = w.floorAt(this.pos.x, this.pos.z, Math.max(this.pos.y, prevY) + STEP);
    let fy = floor.y;
    if (this.inPit && !floor.ref) fy = pit.sink;
    const wasGrounded = this.grounded;
    if (this.pos.y <= fy || (wasGrounded && this.vel.y <= 0 && this.pos.y - fy < 0.25)) {
      if (!wasGrounded) this.land(fy);
      this.pos.y = fy;
      this.vel.y = 0;
      this.grounded = true;
      this.groundRef = floor.ref;
    } else {
      this.grounded = false;
      this.groundRef = null;
    }
    if (!this.grounded) this.peakY = Math.max(this.peakY, this.pos.y);
    else this.peakY = this.pos.y;

    // Moving platforms carry whoever stands on them.
    this.groundRef?.carry?.(this, dt);
    this.groundRef?.onStand?.(this, dt);

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    if (this.poseHold > 0) { /* a held pose (push, wave) plays out */ }
    else if (this.inPit && (this.speed > 0.3 || !this.grounded)) this.pose = 'flail';
    else if (!this.grounded) this.pose = 'air';
    else this.pose = this.speed > 0.25 ? 'walk' : 'idle';
    this.phase += dt * (this.pose === 'walk' ? 2.6 + this.speed * 2.2 : 3);
  }

  land(fy) {
    const fall = this.peakY - fy;
    const pit = this.world.ballPit;
    if (this.inPit && pit) {
      pit.splash(this.pos, Math.min(1.6, 0.4 + fall * 0.5), -this.vel.y);
      if (fall > 1.2) this.world.emit('cannonball', this);
      else this.world.emit('plop', this);
    } else if (fall > 0.6) {
      this.world.emit('land', this, fall);
    }
  }

  // Ladder or rock wall: a straight path p0 -> p1, exit onto the deck at the top.
  updateClimb(dt) {
    const d = this.data;
    const inp = this.input;
    const len = d.p0.distanceTo(d.p1);
    const v = clamp(inp.fwd || (Math.abs(inp.mz) + Math.abs(inp.mx) > 0.3 ? 1 : 0), -1, 1) * 1.35;
    d.t = clamp(d.t + (v / len) * dt, 0, 1);
    this.pos.lerpVectors(d.p0, d.p1, d.t);
    this.yaw = d.yaw;
    this.pose = 'climb';
    if (v !== 0) this.phase += dt * 7;
    if (d.t >= 1 && v > 0) {
      this.leave();
      this.pos.copy(d.exitTop);
      this.vel.set(0, 0, 0);
      this.grounded = true;
      d.onTop?.(this);
    } else if (d.t <= 0 && v < 0) {
      this.leave();
      this.pos.copy(d.exitBottom);
      this.grounded = true;
    } else if (inp.jump) {
      this.launch(-Math.sin(d.yaw) * 2, 2.5, -Math.cos(d.yaw) * 2);
    }
  }

  // Slides: follow a sampled path; gravity along the slope, friction, a launch at the end.
  updateSlide(dt) {
    const d = this.data;
    const path = d.path;
    const tan = path.tangentAt(d.s, _tan);
    const acc = -9.8 * tan.y - 0.6 - 0.04 * d.v * d.v;
    d.v = Math.max(1.4, d.v + acc * dt);
    d.s += d.v * dt;
    if (d.s >= path.length) {
      const t = path.tangentAt(path.length, _tan);
      path.at(path.length, this.pos);
      const v = d.v;
      d.onEnd?.(this);
      this.launch(t.x * v, Math.max(0.6, t.y * v + 1.2), t.z * v);
      return;
    }
    path.at(d.s, this.pos);
    this.yaw = Math.atan2(tan.x, tan.z);
    this.pose = 'slide';
    this.slideTilt = Math.atan2(-tan.y, Math.hypot(tan.x, tan.z));
  }

  updatePole(dt) {
    const d = this.data;
    d.v = Math.min(4, d.v + 7 * dt);
    this.pos.y -= d.v * dt;
    d.a += dt * 5;
    this.pos.x = d.x + Math.sin(d.a) * 0.22;
    this.pos.z = d.z + Math.cos(d.a) * 0.22;
    this.yaw = d.a + Math.PI;
    this.pose = 'pole';
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      d.onEnd?.(this);
      this.leave();
      this.grounded = true;
      this.vel.set(Math.sin(d.a) * 1.2, 0, Math.cos(d.a) * 1.2);
    }
  }

  syncModel(dt) {
    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.yaw;
    const t = poseTargets(this, _t);
    const r = dt ? 16 : 1e9;
    const L = m.legs, A = m.arms;
    L[0].rotation.x = damp(L[0].rotation.x, t.legL, r, dt || 1);
    L[1].rotation.x = damp(L[1].rotation.x, t.legR, r, dt || 1);
    A[0].rotation.x = damp(A[0].rotation.x, t.armL, r, dt || 1);
    A[1].rotation.x = damp(A[1].rotation.x, t.armR, r, dt || 1);
    A[0].rotation.z = damp(A[0].rotation.z, -t.armZ, r, dt || 1);
    A[1].rotation.z = damp(A[1].rotation.z, t.armZ, r, dt || 1);
    m.torso.rotation.x = damp(m.torso.rotation.x, t.torso, r, dt || 1);
    m.head.rotation.x = damp(m.head.rotation.x, t.headX, r, dt || 1);
    // Sitting lowers the hips to the seat (the feet origin becomes the seat point).
    const hipY = t.sit ? 0.06 : m.legLen + (this.pose === 'walk' ? Math.abs(Math.sin(this.phase)) * 0.03 : 0);
    m.hips.position.y = damp(m.hips.position.y, hipY, r, dt || 1);
    // Body tilt: swings tilt with the chains, slides lean back along the slope.
    let tiltX = 0;
    if (this.mode === 'swing') tiltX = this.swingTilt || 0;
    else if (this.mode === 'slide') tiltX = (this.slideTilt || 0) * 0.6;
    m.tilt.rotation.x = damp(m.tilt.rotation.x, tiltX, 20, dt || 1);
  }

  /** World position of the top of the head (for speech bubbles). */
  headTop(out) {
    return out.copy(this.pos).setY(this.pos.y + (this.mode === 'ground' || this.mode === 'climb' || this.mode === 'pole' ? this.height : this.height * 0.65) + 0.1);
  }

  facingTo(x, z) {
    return Math.abs(angleDiff(this.yaw, Math.atan2(x - this.pos.x, z - this.pos.z)));
  }
}

const _tan = new THREE.Vector3();

/** A sampled curve with arc-length lookups, for slides. */
export class Path {
  constructor(points, samples = 240) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    this.pts = curve.getSpacedPoints(samples);
    this.cum = [0];
    for (let i = 1; i < this.pts.length; i++) this.cum.push(this.cum[i - 1] + this.pts[i].distanceTo(this.pts[i - 1]));
    this.length = this.cum[this.cum.length - 1];
  }

  index(s) {
    const n = this.pts.length;
    const f = clamp(s / this.length, 0, 1) * (n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    return [i, f - i];
  }

  at(s, out) {
    const [i, f] = this.index(s);
    return out.lerpVectors(this.pts[i], this.pts[i + 1], f);
  }

  tangentAt(s, out) {
    const [i] = this.index(s);
    return out.subVectors(this.pts[i + 1], this.pts[i]).normalize();
  }
}
