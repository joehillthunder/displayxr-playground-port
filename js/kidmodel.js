// The character model: a stylized kid (or grown-up) built from smooth primitives. Faces have eyes
// with irises, pupils and a catch-light, eyelids that blink, eyebrows, a mouth that opens while the
// character talks, ears, a nose and blushing cheeks. Clothes carry a soft knit texture.
//
// Returns the joints the animation code drives: root (feet, facing +z), tilt, hips, legs, torso,
// arms, neck/head, plus the face parts (eyes, lids, brows, mouth).

import * as THREE from 'three';
import { fabricMat, skinMat, hairMat } from './materials.js';

const SEG = { cap: [6, 14], sph: [28, 20], small: [14, 10] };
const geoCache = new Map();
/** Shared geometry by key, so 12 characters don't each build their own copies. */
function G(key, make) {
  if (!geoCache.has(key)) geoCache.set(key, make());
  return geoCache.get(key);
}
const cap = (r, l) => G(`c${r.toFixed(3)},${l.toFixed(3)}`, () => new THREE.CapsuleGeometry(r, l, SEG.cap[0], SEG.cap[1]));
const sph = (r, small) => G(`s${r.toFixed(4)}${small ? 's' : ''}`, () => new THREE.SphereGeometry(r, ...(small ? SEG.small : SEG.sph)));

const plainCache = new Map();
function plain(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  if (!plainCache.has(k)) plainCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.4, ...opts }));
  return plainCache.get(k);
}

const IRIS = [0x5a3a1e, 0x3b6fb5, 0x3f7f4a, 0x6b4a2a, 0x2a2a2a];

export function buildModel(look) {
  const adult = !!look.adult;
  const legLen = adult ? 0.64 : 0.42;
  const torsoLen = adult ? 0.6 : 0.37;
  const headR = adult ? 0.135 : 0.162;
  const shoulderW = adult ? 0.2 : 0.14;
  const bodyR = adult ? 0.16 : 0.135;
  const shorts = look.shorts ?? (!adult && !look.skirt && (look.name?.length ?? 0) % 2 === 0);

  const skin = skinMat(look.skin);
  const shirt = fabricMat(look.shirt);
  const pants = fabricMat(look.pants);
  const hairM = hairMat(look.hair);

  const root = new THREE.Group();
  const tilt = new THREE.Group();
  root.add(tilt);
  const hips = new THREE.Group();
  hips.position.y = legLen;
  tilt.add(hips);

  const add = (parent, geo, m, x = 0, y = 0, z = 0, shadow = true) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = shadow;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };

  // Pelvis joins the legs to the body.
  const pelvis = add(hips, sph(bodyR * 0.98), look.skirt ? fabricMat(look.skirt) : pants, 0, 0.02, 0);
  pelvis.scale.set(1.05, 0.75, 0.9);

  // ── legs ──
  const legs = [];
  const legR = adult ? 0.068 : 0.06;
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * (adult ? 0.085 : 0.068), 0, 0);
    hips.add(leg);
    if (shorts) {
      add(leg, cap(legR * 1.15, legLen * 0.32), pants, 0, -legLen * 0.2, 0);
      add(leg, cap(legR * 0.9, legLen * 0.55), skin, 0, -legLen * 0.58, 0);
      add(leg, cap(legR * 0.95, 0.05), plain(0xffffff, { roughness: 0.9 }), 0, -legLen + 0.09, 0);
    } else {
      add(leg, cap(legR, legLen - legR * 2 - 0.05), pants, 0, -legLen / 2 + 0.02, 0);
    }
    // A rounded shoe with a white sole.
    const shoe = add(leg, sph(0.05), plain(look.shoes, { roughness: 0.45 }), 0, -legLen + 0.045, 0.03);
    shoe.scale.set(legR * 22, 0.95, legR * 38);
    const sole = add(leg, sph(0.05), plain(0xf4f4f4, { roughness: 0.8 }), 0, -legLen + 0.022, 0.03);
    sole.scale.set(legR * 23, 0.42, legR * 39);
    legs.push(leg);
  }

  // ── torso ──
  const torso = new THREE.Group();
  hips.add(torso);
  // A lathed body: narrower at the waist and the shoulders, rounder at the chest.
  const prof = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const r = bodyR * (0.92 + 0.12 * Math.sin(t * Math.PI * 0.9) - (t > 0.82 ? (t - 0.82) * 2.6 : 0));
    prof.push(new THREE.Vector2(Math.max(0.01, r), t * torsoLen));
  }
  prof.unshift(new THREE.Vector2(0.001, 0));
  prof.push(new THREE.Vector2(0.001, torsoLen));
  const body = add(torso, G(`lathe${bodyR}${torsoLen}`, () => new THREE.LatheGeometry(prof, 24)), shirt, 0, 0, 0);
  body.scale.z = 0.86;
  if (look.skirt) {
    const sk = add(torso, G(`skirt${bodyR}`, () => new THREE.CylinderGeometry(bodyR * 0.95, bodyR * 1.75, 0.2, 24, 1, true)), fabricMat(look.skirt, true), 0, -0.02, 0);
    sk.scale.z = 0.9;
  }
  if (look.stripe) {
    const st = add(torso, G(`stripe${bodyR}`, () => new THREE.CylinderGeometry(bodyR * 1.04, bodyR * 1.06, 0.05, 24)), fabricMat(look.stripe), 0, torsoLen * 0.55, 0);
    st.scale.z = 0.88;
  }
  // Collar and a little chest badge.
  const collar = add(torso, G(`collar${bodyR}`, () => new THREE.TorusGeometry(bodyR * 0.48, 0.016, 8, 20)), fabricMat(look.collar ?? look.stripe ?? look.shirt), 0, torsoLen - 0.005, 0);
  collar.rotation.x = Math.PI / 2;
  if (!adult) {
    const badge = add(torso, G('badge', () => new THREE.CircleGeometry(0.03, 5)), plain(look.badge ?? 0xffffff, { roughness: 0.6 }), 0.05, torsoLen * 0.62, bodyR * 0.86 + 0.004, false);
    badge.rotation.z = Math.PI / 10;
  }

  // ── arms ──
  const arms = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * shoulderW, torsoLen * 0.84, 0);
    torso.add(arm);
    const len = adult ? 0.52 : 0.34;
    const ar = adult ? 0.048 : 0.044;
    add(arm, sph(ar * 1.35), shirt, 0, 0, 0);
    if (adult && !look.shortSleeves) {
      add(arm, cap(ar * 1.05, len - 0.1), fabricMat(look.sleeve ?? look.shirt), 0, -len / 2, 0);
    } else {
      add(arm, cap(ar * 1.18, len * 0.28), fabricMat(look.sleeve ?? look.shirt), 0, -len * 0.18, 0);
      add(arm, cap(ar * 0.92, len * 0.5), skin, 0, -len * 0.58, 0);
    }
    const hand = add(arm, sph(ar * 1.15), skin, 0, -len, 0);
    hand.scale.set(0.9, 1.1, 0.8);
    add(hand, sph(ar * 0.45, true), skin, -sx * ar * 0.75, 0.01, ar * 0.5, false);
    arm.userData.hand = hand;
    arm.rotation.z = sx * 0.1;
    arms.push(arm);
  }

  // ── neck and head ──
  const neck = new THREE.Group();
  neck.position.y = torsoLen;
  torso.add(neck);
  add(neck, cap(headR * 0.32, headR * 0.25), skin, 0, headR * 0.15, 0);
  const head = new THREE.Group();
  head.position.y = headR * 0.98;
  neck.add(head);
  const skull = add(head, sph(headR), skin);
  skull.scale.set(1, adult ? 1.08 : 0.97, 0.98);
  if (adult) {
    const jaw = add(head, sph(headR * 0.8), skin, 0, -headR * 0.35, headR * 0.12);
    jaw.scale.set(1, 0.8, 0.95);
  }
  for (const sx of [-1, 1]) {
    const ear = add(head, sph(headR * 0.22, true), skin, sx * headR * 0.97, -headR * 0.02, -headR * 0.05);
    ear.scale.set(0.5, 1, 0.8);
  }
  const nose = add(head, sph(headR * 0.11, true), skin, 0, -headR * 0.1, headR * 0.98, false);
  nose.scale.set(1.1, 0.85, 0.9);

  // Eyes: white, iris, pupil and a catch-light, under a lid that blinks.
  const eyes = [], lids = [], brows = [];
  const iris = look.eyes ?? IRIS[(look.name?.charCodeAt(0) ?? 0) % IRIS.length];
  const er = headR * (adult ? 0.15 : 0.19);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * headR * 0.36, headR * 0.1, headR * 0.86);
    head.add(eye);
    const white = add(eye, sph(er, true), plain(0xffffff, { roughness: 0.15 }), 0, 0, 0, false);
    white.scale.set(0.85, 1.05, 0.5);
    add(eye, sph(er * 0.62, true), plain(iris, { roughness: 0.2 }), 0, -er * 0.05, er * 0.28, false).scale.set(1, 1.1, 0.45);
    add(eye, sph(er * 0.32, true), plain(0x0b0b10, { roughness: 0.1 }), 0, -er * 0.05, er * 0.42, false).scale.set(1, 1.1, 0.4);
    add(eye, sph(er * 0.15, true), new THREE.MeshBasicMaterial({ color: 0xffffff }), er * 0.22, er * 0.25, er * 0.52, false);
    eyes.push(eye);
    // The lid sits above the eye and slides down to blink.
    const lid = add(eye, sph(er * 1.12, true), skin, 0, 0, er * 0.05, false);
    lid.scale.set(0.95, 0.05, 0.62);
    lid.position.y = er * 1.0;
    lids.push(lid);
    const brow = add(head, cap(headR * 0.035, headR * 0.22), hairM, sx * headR * 0.36, headR * 0.42, headR * 0.86, false);
    brow.rotation.z = Math.PI / 2 + sx * 0.12;
    brows.push(brow);
    const cheek = add(head, sph(headR * 0.14, true), plain(0xff8a8a, { roughness: 0.9, transparent: true, opacity: 0.45, depthWrite: false }), sx * headR * 0.56, -headR * 0.22, headR * 0.8, false);
    cheek.scale.z = 0.35;
  }

  // Mouth: a smile line, plus an open mouth (with a tongue) shown while talking.
  const mouthG = new THREE.Group();
  mouthG.position.set(0, -headR * 0.38, headR * 0.9);
  head.add(mouthG);
  const smile = add(mouthG, G(`smile${headR}`, () => new THREE.TorusGeometry(headR * 0.2, headR * 0.035, 6, 14, Math.PI)), plain(0x5a2a2a, { roughness: 0.5 }), 0, headR * 0.12, 0, false);
  smile.rotation.z = Math.PI;
  const open = new THREE.Group();
  mouthG.add(open);
  const inside = add(open, sph(headR * 0.16, true), plain(0x6a1f24, { roughness: 0.6 }), 0, 0, 0, false);
  inside.scale.set(1.15, 0.7, 0.4);
  add(open, sph(headR * 0.09, true), plain(0xe86a7a, { roughness: 0.6 }), 0, -headR * 0.05, headR * 0.02, false).scale.set(1.2, 0.5, 0.5);
  open.scale.set(1, 0.01, 1);
  open.visible = false;

  // ── hair ──
  const style = look.hairStyle || 'short';
  const hcap = add(head, G(`hcap${headR}`, () => new THREE.SphereGeometry(headR * 1.06, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.56)), hairM, 0, headR * 0.04, -headR * 0.05);
  hcap.rotation.x = -0.28;
  // Bangs across the forehead.
  for (let i = -2; i <= 2; i++) {
    const b = add(head, sph(headR * 0.3, true), hairM, i * headR * 0.24, headR * 0.62 - Math.abs(i) * headR * 0.06, headR * 0.62 - Math.abs(i) * headR * 0.1, false);
    b.scale.set(1, 0.6, 0.7);
  }
  if (style === 'pigtails') {
    for (const sx of [-1, 1]) {
      const t = add(head, cap(headR * 0.26, headR * 0.5), hairM, sx * headR * 1.08, -headR * 0.1, -headR * 0.25);
      t.rotation.z = sx * 0.5;
      add(head, sph(headR * 0.1, true), plain(look.tie ?? 0xff5f8f), sx * headR * 0.98, headR * 0.18, -headR * 0.22, false);
    }
  } else if (style === 'ponytail') {
    const p = add(head, cap(headR * 0.26, headR * 0.95), hairM, 0, -headR * 0.3, -headR * 1.05);
    p.rotation.x = 0.45;
    add(head, sph(headR * 0.12, true), plain(look.tie ?? 0x3fbfbf), 0, headR * 0.12, -headR * 0.98, false);
  } else if (style === 'curly') {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const ring = i % 2 ? 0.86 : 0.62;
      add(head, sph(headR * 0.3, true), hairM, Math.cos(a) * headR * ring, headR * (0.48 + (i % 2) * 0.12), Math.sin(a) * headR * ring - headR * 0.18);
    }
  } else if (style === 'long') {
    const back = add(head, cap(headR * 0.86, headR * 1.15), hairM, 0, -headR * 0.55, -headR * 0.42);
    back.scale.z = 0.55;
    for (const sx of [-1, 1]) {
      const s = add(head, cap(headR * 0.2, headR * 0.9), hairM, sx * headR * 0.86, -headR * 0.45, headR * 0.1);
      s.scale.z = 0.7;
    }
  } else if (style === 'bun') {
    add(head, sph(headR * 0.42), hairM, 0, headR * 1.02, -headR * 0.38);
  } else {
    // Short: a fuller cap and a little tuft.
    const tuft = add(head, sph(headR * 0.25, true), hairM, headR * 0.15, headR * 0.98, headR * 0.15);
    tuft.scale.set(1, 0.6, 1.3);
  }
  if (look.hat) {
    const hm = fabricMat(look.hat);
    add(head, G(`hat${headR}`, () => new THREE.SphereGeometry(headR * 1.1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2)), hm, 0, headR * 0.14, 0);
    const brim = add(head, G(`brim${headR}`, () => new THREE.CylinderGeometry(headR * 0.75, headR * 0.75, 0.018, 20, 1, false, -Math.PI / 2, Math.PI)), hm, 0, headR * 0.2, headR * 0.55);
    brim.scale.z = 1.25;
  }

  root.scale.setScalar(look.scale ?? 1);
  return {
    root, tilt, hips, torso, neck, head, legs, arms, eyes, lids, brows,
    mouth: open, smile,
    legLen,
    height: (legLen + torsoLen + headR * 2.2) * (look.scale ?? 1),
    scale: look.scale ?? 1,
    hand: arms[1].userData.hand,
  };
}
