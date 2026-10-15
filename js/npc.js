// Everyone who isn't you: kids who play on the equipment by themselves, grown-ups (a parent
// reading on a bench, a dad playing fetch, a grandpa feeding pigeons, the ice-cream seller), Biscuit
// the dog, pigeons and butterflies.
//
// Each NPC kid runs a little generator "brain". A brain step sets the kid's input (the same input
// the player's keyboard sets) and yields; it gets the frame's dt back. Activities are written as
// plain sequences: walk to the ladder, use it, hold "up" until on the deck, walk to the slide...

import * as THREE from 'three';
import { Character, SKIN, HAIR } from './character.js';
import { mat } from './world.js';
import { damp, dampAngle, dist2D, pick, rand } from './util.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const KID_LOOKS = [
  { name: 'Maya', skin: SKIN[1], hair: HAIR[0], hairStyle: 'pigtails', shirt: 0xff5f8f, pants: 0x3a4a8a, shoes: 0xffffff, skirt: 0x7a5cff, scale: 1.0 },
  { name: 'Leo', skin: SKIN[0], hair: HAIR[3], hairStyle: 'short', shirt: 0x2fbf4f, pants: 0x30425e, shoes: 0xff5252, stripe: 0xffffff, scale: 1.05 },
  { name: 'Zara', skin: SKIN[3], hair: HAIR[4], hairStyle: 'curly', shirt: 0xffc21a, pants: 0x2f8fff, shoes: 0xff7ab8, scale: 0.97 },
  { name: 'Kai', skin: SKIN[2], hair: HAIR[0], hairStyle: 'short', shirt: 0xff8c42, pants: 0x4a4a4a, shoes: 0x2f8fff, hat: 0x2f8fff, scale: 1.02 },
  { name: 'Ava', skin: SKIN[0], hair: HAIR[5], hairStyle: 'ponytail', shirt: 0x9a62c9, pants: 0x2a2f45, shoes: 0xffd23f, scale: 0.95 },
  { name: 'Sam', skin: SKIN[4], hair: HAIR[4], hairStyle: 'bun', shirt: 0x3fbfbf, pants: 0x8a5a33, shoes: 0xffffff, scale: 1.08 },
  { name: 'Ivy', skin: SKIN[5], hair: HAIR[2], hairStyle: 'long', shirt: 0xffffff, pants: 0xff5252, shoes: 0x3a3a3a, skirt: 0xff5252, scale: 0.92 },
  { name: 'Noah', skin: SKIN[2], hair: HAIR[1], hairStyle: 'curly', shirt: 0xff5252, pants: 0x30425e, shoes: 0x2fbf4f, stripe: 0xffd23f, scale: 1.0 },
];

const LINES = {
  slide: ['Wheee!', 'Wheeeee!', 'Again! Again!', 'So fast!'],
  top: ['Watch me!', "I'm up high!", 'Look at me!', 'Race you!'],
  swing: ['Higher!', 'Push me!', "I'm flying!", 'Whoa!'],
  pit: ['Ball pit!!', 'Cannonball!', 'So many balls!', 'Splash!'],
  merry: ['Spin it!', 'Faster!', "I'm dizzy!", 'Wooo!'],
  sand: ['Making a castle', 'Dig dig dig', 'A moat!'],
  tag: ["Tag! You're it!", 'Bet you can’t catch me!'],
  hi: ['Hi!', 'Wanna play?', 'Come on!', 'Hello!', 'Nice!'],
  ice: ['Yum!', 'Strawberry!', 'Ice cream!'],
};

function* wait(t) {
  while (t > 0) t -= yield;
}

// ── NPC kid activities ────────────────────────────────────────────────────────────────────────
function* walkTo(k, target, o = {}) {
  const ch = k.ch;
  const route = k.world.route(ch.pos, target);
  let t = 0, check = 0;
  const last = ch.pos.clone();
  for (const p of route) {
    while (dist2D(ch.pos, p) > (o.tol ?? 0.3)) {
      if (ch.mode !== 'ground') return false;
      const dx = p.x - ch.pos.x, dz = p.z - ch.pos.z, d = Math.hypot(dx, dz) || 1;
      const sp = Math.min(1, d / 0.8 + 0.25);
      ch.input.mx = (dx / d) * sp;
      ch.input.mz = (dz / d) * sp;
      ch.input.run = !!o.run;
      const dt = yield;
      t += dt;
      check += dt;
      if (check > 0.8) {
        if (ch.pos.distanceTo(last) < 0.2 && ch.grounded) ch.input.jump = true;
        last.copy(ch.pos);
        check = 0;
      }
      if (t > (o.timeout ?? 25)) return false;
    }
  }
  return true;
}

function tryUse(k, it) {
  if (!it || (it.can && !it.can(k.ch))) return false;
  it.use(k.ch);
  return true;
}

function* whileMode(k, mode, fn) {
  while (k.ch.mode === mode) {
    fn?.();
    yield;
  }
}

function* pitPlay(k, dur) {
  const pit = k.world.ballPit;
  const ch = k.ch;
  if (Math.random() < 0.6) k.say(pick(LINES.pit));
  let t = 0;
  while (t < dur && pit.contains(ch.pos.x, ch.pos.z)) {
    const target = V(rand(pit.ix0 + 0.4, pit.ix1 - 0.4), 0, rand(pit.iz0 + 0.4, pit.iz1 - 0.4));
    let tt = 0;
    while (tt < 2.5 && dist2D(ch.pos, target) > 0.3) {
      const dx = target.x - ch.pos.x, dz = target.z - ch.pos.z, d = Math.hypot(dx, dz) || 1;
      ch.input.mx = dx / d;
      ch.input.mz = dz / d;
      if (Math.random() < 0.01) ch.input.jump = true;
      const dt = yield;
      tt += dt;
      t += dt;
    }
  }
  yield* exitPit(k);
}

function* exitPit(k) {
  const pit = k.world.ballPit;
  const ch = k.ch;
  const opts = [V(pit.ix0 - 0.8, 0, ch.pos.z), V(pit.ix1 + 0.8, 0, ch.pos.z), V(ch.pos.x, 0, pit.iz1 + 0.8)];
  opts.sort((a, b) => dist2D(ch.pos, a) - dist2D(ch.pos, b));
  const target = opts[0];
  let t = 0;
  while (pit.contains(ch.pos.x, ch.pos.z) && t < 10) {
    const dx = target.x - ch.pos.x, dz = target.z - ch.pos.z, d = Math.hypot(dx, dz) || 1;
    ch.input.mx = dx / d;
    ch.input.mz = dz / d;
    if (ch.grounded && d < 1.3) ch.input.jump = true;
    t += yield;
  }
  yield* walkTo(k, target, { timeout: 4 });
}

const ACTIVITIES = {
  *ladderSlide(k) {
    const { eq } = k;
    if (!(yield* walkTo(k, V(-4, 0, 2.2)))) return;
    if (!tryUse(k, eq.ladder)) return;
    yield* whileMode(k, 'climb', () => { k.ch.input.fwd = 1; });
    if (Math.random() < 0.4) k.say(pick(LINES.top));
    yield* wait(rand(0.3, 1.2));
    const r = Math.random();
    if (r < 0.55) {
      if (!(yield* walkTo(k, V(-4.6, 1.6, 0), { tol: 0.2, timeout: 6 }))) return;
      if (tryUse(k, eq.wave)) { k.say(pick(LINES.slide), 1.6); yield* whileMode(k, 'slide'); }
    } else if (r < 0.78) {
      if (!(yield* walkTo(k, V(-4, 1.6, -0.7), { tol: 0.2, timeout: 6 }))) return;
      if (tryUse(k, eq.pole)) yield* whileMode(k, 'pole');
    } else {
      if (!(yield* walkTo(k, V(-2.8, 1.6, 0), { tol: 0.3, timeout: 6 }))) return;
      if (!(yield* walkTo(k, V(1.4, 2.4, 0), { tol: 0.3, timeout: 8 }))) return;
      yield* deckB(k);
    }
    yield* wait(rand(0.4, 1.2));
  },
  *wallClimb(k) {
    const { eq } = k;
    if (!(yield* walkTo(k, V(2, 0, 2.55)))) return;
    if (!tryUse(k, eq.wall)) return;
    yield* whileMode(k, 'climb', () => { k.ch.input.fwd = 1; });
    if (Math.random() < 0.4) k.say(pick(LINES.top));
    yield* deckB(k);
  },
  *swing(k) {
    const sw = k.eq.swings.filter((s) => !s.occupant && Math.abs(s.th) < 0.3);
    if (!sw.length) return;
    const s = pick(sw);
    if (!(yield* walkTo(k, V(s.x, 0, s.z + 0.55), { tol: 0.25 }))) return;
    if (!(yield* walkTo(k, V(s.x, 0, s.z + 0.1), { tol: 0.3, timeout: 3 }))) return;
    if (!tryUse(k, s.interact)) return;
    let t = rand(8, 15);
    let said = false;
    while (k.ch.mode === 'swing' && t > 0) {
      k.ch.input.fwd = 1;
      if (!said && Math.abs(s.th) > 0.7) { k.say(pick(LINES.swing)); said = true; }
      t -= yield;
    }
    // Jump off near the front of a swing, for distance; or stop and step off.
    if (Math.random() < 0.6) {
      let tt = 0;
      while (k.ch.mode === 'swing' && tt < 5) {
        if (s.th > 0.35 && s.om < 0.4 && s.om > -0.2) { k.ch.input.jump = true; k.say('Whoa!', 1.2); }
        tt += yield;
      }
    } else {
      while (k.ch.mode === 'swing' && Math.abs(s.th) > 0.2) yield;
    }
    if (k.ch.mode === 'swing') k.ch.input.jump = true;
    yield;
    yield* wait(1);
  },
  *ballPit(k) {
    const pit = k.world.ballPit;
    const side = pick([V(pit.ix0 - 0.7, 0, rand(pit.iz0 + 0.5, pit.iz1 - 0.5)), V(pit.ix1 + 0.7, 0, rand(pit.iz0 + 0.5, pit.iz1 - 0.5))]);
    if (!(yield* walkTo(k, side))) return;
    const ch = k.ch;
    let t = 0;
    const into = V((pit.ix0 + pit.ix1) / 2, 0, side.z);
    while (!pit.contains(ch.pos.x, ch.pos.z) && t < 4) {
      const dx = into.x - ch.pos.x, dz = into.z - ch.pos.z, d = Math.hypot(dx, dz) || 1;
      ch.input.mx = dx / d;
      ch.input.mz = dz / d;
      if (ch.grounded && d < 2.6) ch.input.jump = true;
      t += yield;
    }
    if (pit.contains(ch.pos.x, ch.pos.z)) yield* pitPlay(k, rand(6, 12));
  },
  *merry(k) {
    const m = k.eq.merry;
    const a = rand(0, Math.PI * 2);
    if (!(yield* walkTo(k, V(m.cx + Math.sin(a) * 2.3, 0, m.cz + Math.cos(a) * 2.3)))) return;
    for (let i = 0; i < 3; i++) {
      tryUse(k, m.push);
      yield* wait(0.7);
    }
    k.say(pick(LINES.merry));
    // Hop on and ride.
    const ch = k.ch;
    let t = 0;
    while (ch.groundRef !== m.surface && t < 3) {
      const dx = m.cx - ch.pos.x, dz = m.cz - ch.pos.z, d = Math.hypot(dx, dz) || 1;
      ch.input.mx = dx / d;
      ch.input.mz = dz / d;
      t += yield;
    }
    t = rand(5, 9);
    while (t > 0) {
      const dx = m.cx - ch.pos.x, dz = m.cz - ch.pos.z, d = Math.hypot(dx, dz) || 1;
      if (d > 1.2) { ch.input.mx = (dx / d) * 0.5; ch.input.mz = (dz / d) * 0.5; }
      if (Math.random() < 0.004) k.say(pick(LINES.merry));
      t -= yield;
    }
    const dx = ch.pos.x - m.cx, dz = ch.pos.z - m.cz, d = Math.hypot(dx, dz) || 1;
    yield* walkTo(k, V(m.cx + (dx / d) * 3.2, 0, m.cz + (dz / d) * 3.2), { timeout: 4 });
  },
  *seesaw(k) {
    const ss = k.eq.seesaw;
    const side = !ss.occ[1] && (ss.occ[0] || Math.random() < 0.5) ? 1 : !ss.occ[0] ? 0 : -1;
    if (side < 0) return;
    k.busyFor = 'seesaw';
    const x = ss.px + (side ? 1 : -1) * ss.seatD;
    if (!(yield* walkTo(k, V(x, 0, ss.pz + 0.65), { tol: 0.25, run: k.recruited }))) return;
    if (!tryUse(k, ss.interacts[side])) return;
    if (ss.occ[1 - side]?.isPlayer) k.say(pick(['Yay!', 'Up and down!', 'Wheee!']));
    let t = k.recruited ? 30 : rand(8, 14);
    let alone = 0;
    while (k.ch.mode === 'seat' && t > 0) {
      const dt = yield;
      t -= dt;
      alone = ss.occ[1 - side] ? 0 : alone + dt;
      if (alone > 4) break;
    }
    if (k.ch.mode === 'seat') k.ch.input.jump = true;
    yield;
  },
  *sandbox(k) {
    const sb = k.eq.sandbox;
    if (!(yield* walkTo(k, V(rand(sb.x0, sb.x1), 0, rand(sb.z0, sb.z1))))) return;
    const ch = k.ch;
    ch.enter('sit', { drive: (c) => { c.pose = 'dig'; c.phase += 0.016; } });
    if (Math.random() < 0.5) k.say(pick(LINES.sand));
    yield* wait(rand(7, 13));
    if (ch.mode === 'sit') ch.leave();
  },
  *icecream(k) {
    if (k.ch.holding) return;
    const c = k.eq.cart;
    if (!(yield* walkTo(k, V(c.x + rand(-0.6, 0.6), 0, c.z + 1.2)))) return;
    if (tryUse(k, c.interact)) {
      k.say(pick(LINES.ice));
      yield* wait(1);
    }
  },
  *tag(k) {
    const p = k.player;
    if (!p || p.mode !== 'ground' || p.pos.y > 0.3 || dist2D(p.pos, k.ch.pos) > 9) return;
    k.say(pick(LINES.hi));
    let t = 7;
    while (t > 0 && k.ch.mode === 'ground') {
      const dx = p.pos.x - k.ch.pos.x, dz = p.pos.z - k.ch.pos.z, d = Math.hypot(dx, dz) || 1;
      if (d < 0.7) {
        k.say(pick(LINES.tag));
        k.world.emit('tagged', p);
        // Run away!
        let r = 2.5;
        while (r > 0) {
          k.ch.input.mx = -dx / d;
          k.ch.input.mz = -dz / d;
          k.ch.input.run = true;
          r -= yield;
        }
        return;
      }
      k.ch.input.mx = dx / d;
      k.ch.input.mz = dz / d;
      k.ch.input.run = true;
      t -= yield;
    }
  },
  // Find a friend, walk over and have a chat. The chat may end with a plan they do together.
  *chat(k) {
    const crowd = k.crowd;
    if (!crowd.talk) return;
    const cands = crowd.kids.filter((o) => o !== k && !o.ch.convo && o.ch.mode === 'ground' && o.ch.pos.y < 0.3 && (!o.activity || o.activity === 'wander') && dist2D(o.ch.pos, k.ch.pos) < 14);
    if (!cands.length) return;
    const o = pick(cands);
    o.gen = meetPartner(o, k);
    let t = 0;
    while (dist2D(k.ch.pos, o.ch.pos) > 1.1 && t < 9) {
      steer(k, o.ch.pos);
      k.ch.input.run = dist2D(k.ch.pos, o.ch.pos) > 5;
      t += yield;
    }
    if (dist2D(k.ch.pos, o.ch.pos) > 1.8 || k.ch.mode !== 'ground' || o.ch.mode !== 'ground') return;
    const c = crowd.talk.start('meet', [k.ch, o.ch], { hold: true, onEnd: (cv) => { if (cv.then) { k.next = cv.then; o.next = cv.then; } } });
    if (!c) return;
    while (k.ch.convo === c) yield;
  },
  *wander(k) {
    yield* walkTo(k, V(rand(-12, 14), 0, rand(-2, 12)), { timeout: 10 });
    yield* wait(rand(0.5, 2));
  },
};

function* deckB(k) {
  const { eq } = k;
  if (Math.random() < 0.5) {
    if (!(yield* walkTo(k, V(2.75, 2.4, 0), { tol: 0.2, timeout: 6 }))) return;
    if (tryUse(k, eq.spiral)) { k.say(pick(LINES.slide), 1.6); yield* whileMode(k, 'slide'); }
  } else {
    if (!(yield* walkTo(k, V(2, 2.4, -1.3), { tol: 0.25, timeout: 6 }))) return;
    if (!(yield* walkTo(k, V(2, 2.4, -3.35), { tol: 0.15, timeout: 6 }))) return;
    yield* wait(rand(0.3, 1));
    if (Math.random() < 0.6) k.say('Cannonball!', 1.5);
    k.ch.input.mz = -0.35;
    k.ch.input.jump = true;
    yield;
    let t = 0;
    while (!k.ch.grounded && t < 3) { k.ch.input.mz = -0.35; t += yield; }
    if (k.world.ballPit.contains(k.ch.pos.x, k.ch.pos.z)) yield* pitPlay(k, rand(4, 9));
  }
}

function steer(k, p) {
  const dx = p.x - k.ch.pos.x, dz = p.z - k.ch.pos.z, d = Math.hypot(dx, dz) || 1;
  k.ch.input.mx = dx / d;
  k.ch.input.mz = dz / d;
}

/** The friend who was called over: walk toward the caller, talk, then go along with the plan. */
function* meetPartner(o, k) {
  o.activity = 'chat';
  let t = 0;
  while (!o.ch.convo && t < 9) {
    if (dist2D(o.ch.pos, k.ch.pos) > 1.0) steer(o, k.ch.pos);
    t += yield;
  }
  while (o.ch.convo) yield;
  o.activity = null;
  yield* life(o, 0);
}

const WEIGHTS = [
  ['chat', 1.8],
  ['ladderSlide', 3], ['wallClimb', 2.4], ['swing', 2.2], ['ballPit', 2], ['merry', 1.6],
  ['seesaw', 1], ['sandbox', 1.2], ['icecream', 0.5], ['tag', 0.7], ['wander', 0.6],
];

function chooseActivity(k) {
  let total = 0;
  for (const [, w] of WEIGHTS) total += w;
  for (let tries = 0; tries < 6; tries++) {
    let r = Math.random() * total;
    for (const [id, w] of WEIGHTS) {
      r -= w;
      if (r <= 0) {
        if (id === k.lastActivity && Math.random() < 0.6) break;
        return id;
      }
    }
  }
  return 'wander';
}

function* life(k, delay = rand(0, 2)) {
  yield* wait(delay);
  for (;;) {
    const id = k.next || chooseActivity(k);
    k.next = null;
    k.lastActivity = id;
    k.activity = id;
    yield* ACTIVITIES[id](k);
    k.activity = null;
    k.busyFor = null;
    k.recruited = false;
    if (k.ch.mode !== 'ground') {
      // Whatever happened, get off the equipment before choosing again.
      if (k.ch.mode === 'climb') { k.ch.input.fwd = -1; yield; continue; }
      k.ch.input.jump = true;
      yield;
    }
    yield* wait(rand(0.2, 1));
  }
}

// ── crowd: NPC kids and grown-ups ───────────────────────────────────────────────────────────
export class Crowd {
  constructor(world, eq, bubbles, fx) {
    this.world = world;
    this.eq = eq;
    this.bubbles = bubbles;
    this.fx = fx;
    this.kids = [];
    this.adults = [];
    this.player = null;
    this.recruitT = 0;
    this.chatT = 3;
    this.adultT = 8;
    this.talk = null; // Conversations, set by main.js

    // Grown-ups.
    const b = world.benches;
    this.reader = this.addAdult({ name: 'Mom', skin: SKIN[2], hair: HAIR[0], hairStyle: 'long', shirt: 0x5f8fd0, pants: 0x2a2f45, shoes: 0x8a5a33 }, b[0].seat, b[0].yaw, 'read');
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.16), mat(0xd94f4f));
    book.position.set(0, 0.48, 0.28);
    book.rotation.x = -0.6;
    this.reader.model.torso.add(book);
    this.grandpa = this.addAdult({ name: 'Grandpa', skin: SKIN[0], hair: 0xdddddd, hairStyle: 'short', shirt: 0x8a6a4a, pants: 0x55606a, shoes: 0x3a3a3a, hat: 0x4a5a3a }, b[1].seat, b[1].yaw, 'sit');
    this.vendor = this.addAdult({ name: 'Rosa', skin: SKIN[3], hair: HAIR[4], hairStyle: 'bun', shirt: 0xffffff, sleeve: 0xffffff, pants: 0xff7ab8, shoes: 0xffffff, hat: 0xff7ab8 }, V(eq.cart.x, 0, eq.cart.z - 0.75), 0, null);
    this.dad = this.addAdult({ name: 'Dad', skin: SKIN[1], hair: HAIR[1], hairStyle: 'short', shirt: 0xff8c42, pants: 0x3a4a6a, shoes: 0xffffff, hat: 0x2f8fff }, V(16.5, 0, 7), -Math.PI / 2, null);

    // Buying an ice cream is a little conversation with Rosa.
    world.on('icecream', (ch) => {
      this.vendor.setPose('wave', 1.6);
      this.talk?.start('icecream', [this.vendor, ch], { hold: true });
    });

    this.dog = new Dog(world, this);
    this.pigeons = new Pigeons(world, this);
    this.butterflies = new Butterflies(world);
  }

  addAdult(look, pos, yaw, sitPose) {
    const a = new Character(this.world, { ...look, scale: 1 }, { name: look.name, adult: true });
    a.place(pos.x, pos.y, pos.z, yaw);
    if (sitPose) {
      a.enter('sit', { canLeave: false, drive: (c) => { c.pose = c.poseHold > 0 ? c.pose : sitPose; } });
      a.pos.y = 0.47;
      a.sitPose = sitPose;
    }
    a.home = pos.clone();
    a.homeYaw = yaw;
    this.adults.push(a);
    return a;
  }

  addKid(look) {
    const ch = new Character(this.world, look, { name: look.name });
    const k = { ch, world: this.world, eq: this.eq, crowd: this, player: this.player, say: (t, d) => this.say(ch, t, d) };
    k.gen = life(k);
    k.gen.next();
    this.world.characters.push(ch);
    this.kids.push(k);
    // Walk up to any kid and press E to chat.
    k.talkIt = this.world.addInteractable({ id: 'talk-' + look.name, label: `Talk to ${look.name}`, pos: ch.pos, radius: 0,
      near: (p) => {
        if (!p.isPlayer || p.mode !== 'ground' || p.convo?.hold || ch.convo?.hold || !this.kids.includes(k)) return null;
        if (ch.mode !== 'ground' && ch.mode !== 'sit') return null;
        const d = dist2D(p.pos, ch.pos);
        return d < 1.5 && Math.abs(p.pos.y - ch.pos.y) < 0.6 ? d + 0.2 : null;
      },
      use: (p) => this.chatWithPlayer(k, p) });
    return k;
  }

  /** Take an NPC kid out of the crowd (when the player becomes that kid). */
  removeKid(k) {
    k.ch.leave();
    if (k.ch.convo) this.talk?.end(k.ch.convo);
    const its = this.world.interactables;
    if (its.includes(k.talkIt)) its.splice(its.indexOf(k.talkIt), 1);
    this.kids.splice(this.kids.indexOf(k), 1);
  }

  chatWithPlayer(k, p) {
    // Stop what they were doing, turn and talk.
    if (k.ch.mode === 'sit') k.ch.leave();
    // A passing remark (Mom calling, chatter) gives way to a real chat.
    if (p.convo) this.talk?.end(p.convo);
    if (k.ch.convo) this.talk?.end(k.ch.convo);
    const c = this.talk?.start('player', [k.ch, p], { hold: true, onEnd: (cv) => this.afterChat(cv) });
    if (c) k.gen = idleThen(k, 0.2);
  }

  /** After a conversation: NPC kids in it carry out the plan they made together. */
  afterChat(c) {
    for (const p of c.parts) {
      const k = this.kids.find((x) => x.ch === p);
      if (!k) continue;
      if (c.then && ACTIVITIES[c.then]) {
        k.next = c.then;
        k.gen = life(k, 0);
      }
      k.paused = false;
    }
  }

  say(ch, text, dur) {
    if (ch.convo) return;
    this.bubbles.say(ch, text, dur, ch.name);
  }

  /** Two NPC kids on the same thing, side by side, chat while they keep playing. */
  contextChat() {
    const ks = this.kids.filter((k) => !k.ch.convo && (k.ch.chatCool ?? 0) <= 0);
    const pit = this.world.ballPit;
    for (let i = 0; i < ks.length; i++) {
      for (let j = i + 1; j < ks.length; j++) {
        const a = ks[i].ch, b = ks[j].ch;
        if (dist2D(a.pos, b.pos) > 3.2 || Math.abs(a.pos.y - b.pos.y) > 1.2) continue;
        let kind = null;
        if (a.mode === 'swing' && b.mode === 'swing') kind = 'swing';
        else if (a.mode === 'seat' && b.mode === 'seat') kind = 'seesaw';
        else if (pit.contains(a.pos.x, a.pos.z) && pit.contains(b.pos.x, b.pos.z) && a.pos.y < 0.6 && b.pos.y < 0.6) kind = 'pit';
        else if (a.groundRef && a.groundRef === b.groundRef && a.groundRef === this.eq.merry.surface) kind = 'merry';
        else if (a.mode === 'ground' && b.mode === 'ground' && a.pos.y > 1.4 && b.pos.y > 1.4) kind = 'tower';
        else if (a.mode === 'sit' && b.mode === 'sit') kind = 'sandbox';
        if (!kind || Math.random() > 0.55) continue;
        if (this.talk.start(kind, [a, b])) { a.chatCool = b.chatCool = 14; return true; }
      }
    }
    return false;
  }

  /** Grown-ups call out to kids (and to you), and kids say hi to Biscuit. */
  adultChat() {
    const near = (a, r) => [...this.kids.map((k) => k.ch), this.player].filter((c) => c && !c.convo && dist2D(c.pos, a.pos) < r);
    const mom = this.reader;
    if (!mom.convo && Math.random() < 0.5) {
      const c = pick(near(mom, 11));
      if (c) return this.talk.start('mom', [mom, c]);
    }
    if (!this.grandpa.convo && Math.random() < 0.4) {
      const c = pick(near(this.grandpa, 6));
      if (c) return this.talk.start('grandpa', [this.grandpa, c]);
    }
    if (!this.dad.convo && Math.random() < 0.4) {
      const c = pick(near(this.dad, 6));
      if (c) return this.talk.start('dad', [this.dad, c]);
    }
    if (!this.dog.convo) {
      const c = pick(near(this.dog, 2.2).filter((x) => !x.isPlayer));
      if (c) return this.talk.start('dog', [c, this.dog]);
    }
    return null;
  }

  update(dt) {
    for (const k of this.kids) {
      const inp = k.ch.input;
      inp.mx = inp.mz = inp.fwd = 0;
      inp.run = false;
      k.player = this.player;
      k.ch.chatCool = Math.max(0, (k.ch.chatCool ?? 0) - dt);
      // Kids who stopped to talk stand still until the conversation ends.
      if (!(k.ch.convo?.hold && k.ch.mode === 'ground')) k.gen.next(dt);
      k.ch.update(dt);
      if (k.ch.holding && (k.ch.holdT -= dt) < 0) dropHolding(k.ch);
    }
    if (this.talk) {
      this.chatT -= dt;
      if (this.chatT <= 0) this.chatT = this.contextChat() ? 6 : 2;
      this.adultT -= dt;
      if (this.adultT <= 0) this.adultT = this.adultChat() ? 14 : 5;
    }
    // Ask an NPC kid to join the player on the seesaw.
    const ss = this.eq.seesaw;
    this.recruitT -= dt;
    const pSide = ss.occ.findIndex((c) => c?.isPlayer);
    if (pSide >= 0 && !ss.occ[1 - pSide] && this.recruitT <= 0 && !this.kids.some((k) => k.busyFor === 'seesaw')) {
      this.recruitT = 3;
      const free = this.kids.filter((k) => k.ch.mode === 'ground' && k.ch.pos.y < 0.3 && k.activity !== 'seesaw' && !k.ch.convo);
      free.sort((a, b) => dist2D(a.ch.pos, ss.group.position) - dist2D(b.ch.pos, ss.group.position));
      const k = free[0];
      if (k) {
        k.next = 'seesaw';
        k.recruited = true;
        k.busyFor = 'seesaw';
        k.gen = life(k, 0);
        this.say(k.ch, "I'll play with you!");
      }
    }
    // Grown-ups: wave at the player when they come close.
    for (const a of this.adults) {
      if (this.player && dist2D(a.pos, this.player.pos) < 3 && !a.waved && a !== this.dad && !a.convo) {
        a.waved = true;
        a.setPose('wave', 1.6);
        this.say(a, pick(a === this.vendor ? ['Ice cream!', 'Fancy a cone?'] : a === this.grandpa ? ['Hello there!', 'Lovely day!'] : ['Hi sweetie!', 'Having fun?']));
        setTimeout(() => { a.waved = false; }, 20000);
      }
      a.input.mx = a.input.mz = 0;
      a.update(dt);
      if (a.mode === 'ground') {
        a.pos.y = 0;
        if (a.poseHold <= 0) a.pose = 'idle';
      }
    }
    this.dog.update(dt);
    this.pigeons.update(dt);
    this.butterflies.update(dt);
  }
}

/** Stand still while a chat runs, then carry on with life. */
function* idleThen(k, t) {
  k.paused = true;
  yield* wait(t);
  while (k.ch.convo) yield;
  k.paused = false;
  yield* life(k, 0.3);
}

function dropHolding(ch) {
  ch.holding?.parent?.remove(ch.holding);
  ch.holding = null;
}

// ── Biscuit the dog, and the fetch ball ───────────────────────────────────────────────────────
class Dog {
  constructor(world, crowd) {
    this.world = world;
    this.crowd = crowd;
    this.pos = V(14, 0, 6);
    this.yaw = 0;
    this.state = 'wander';
    this.t = 0;
    this.phase = 0;
    this.target = this.pos.clone();
    this.name = 'Biscuit';
    this.isDog = true;
    this.convo = null;
    this.lookTarget = null;
    this.talkT = 0;
    this.height = 0.7;
    this.mode = 'ground';
    const g = (this.root = new THREE.Group());
    const fur = 0xc8873f, light = 0xf2d2a4;
    const add = (geo, color, x, y, z, parent = g) => {
      const m = new THREE.Mesh(geo, mat(color));
      m.position.set(x, y, z);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    this.body = add(new THREE.CapsuleGeometry(0.16, 0.42, 4, 10), fur, 0, 0.42, 0);
    this.body.rotation.x = Math.PI / 2;
    this.headG = new THREE.Group();
    this.headG.position.set(0, 0.62, 0.34);
    g.add(this.headG);
    add(new THREE.SphereGeometry(0.15, 14, 10), fur, 0, 0, 0, this.headG);
    add(new THREE.BoxGeometry(0.12, 0.1, 0.16), light, 0, -0.04, 0.14, this.headG);
    add(new THREE.SphereGeometry(0.035, 8, 6), 0x222222, 0, -0.01, 0.23, this.headG);
    for (const sx of [-1, 1]) {
      add(new THREE.SphereGeometry(0.025, 8, 6), 0x222222, sx * 0.06, 0.05, 0.13, this.headG);
      const ear = add(new THREE.BoxGeometry(0.06, 0.14, 0.04), 0x8a5a2a, sx * 0.12, 0.02, -0.02, this.headG);
      ear.rotation.z = sx * 0.3;
    }
    this.legs = [];
    for (const [x, z] of [[-0.1, 0.2], [0.1, 0.2], [-0.1, -0.2], [0.1, -0.2]]) {
      const leg = new THREE.Group();
      leg.position.set(x, 0.32, z);
      g.add(leg);
      add(new THREE.CapsuleGeometry(0.04, 0.22, 4, 6), x < 0 ? fur : light, 0, -0.16, 0, leg);
      this.legs.push(leg);
    }
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.5, -0.36);
    g.add(this.tail);
    const tl = add(new THREE.CapsuleGeometry(0.03, 0.2, 4, 6), fur, 0, 0.1, -0.04, this.tail);
    tl.rotation.x = -0.6;
    world.scene.add(g);

    // The fetch ball.
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat(0xc8f04a));
    this.ball.castShadow = true;
    world.scene.add(this.ball);
    this.ballState = 'dad'; // dad | flying | ground | dog
    this.ballPos = V(0, 0, 0);
    this.ballVel = V(0, 0, 0);
    this.throwT = 3;

    world.addInteractable({ id: 'dog', label: 'Pet Biscuit', pos: this.pos, radius: 0,
      near: (ch) => (ch.mode === 'ground' && dist2D(ch.pos, this.pos) < 1.3 && ch.pos.y < 0.5 ? dist2D(ch.pos, this.pos) : null),
      use: (ch) => this.pet(ch) });
  }

  pet(ch) {
    this.state = 'petted';
    this.t = 2.5;
    this.yaw = Math.atan2(ch.pos.x - this.pos.x, ch.pos.z - this.pos.z);
    ch.setPose('push', 1.2);
    this.crowd.fx.hearts(V(this.pos.x, 1.0, this.pos.z), 5);
    this.world.emit('bark', this);
    if (!this.convo) this.crowd.bubbles.say(this, pick(['Woof!', 'Arf arf!', 'Woof woof!']), 1.6, 'Biscuit');
    this.world.award(ch, 'dog');
    this.followT = 12;
    this.followWho = ch;
  }

  headTop(out) {
    return out.set(this.pos.x, this.pos.y + 0.95, this.pos.z);
  }

  moveToward(target, speed, dt) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const s = Math.min(speed * dt, d);
    this.pos.x += (dx / d) * s;
    this.pos.z += (dz / d) * s;
    this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 10, dt);
    this.speed = speed;
    this.world.collideWalls(this.pos, 0.3, 0.7);
    return d;
  }

  update(dt) {
    const dad = this.crowd.dad;
    this.speed = 0;
    this.t -= dt;
    this.followT = Math.max(0, (this.followT || 0) - dt);
    const mouth = V(this.pos.x + Math.sin(this.yaw) * 0.55, 0.58, this.pos.z + Math.cos(this.yaw) * 0.55);

    // Dad throws when he has the ball and Biscuit is free.
    if (this.ballState === 'dad') {
      dad.model.hand.getWorldPosition(this.ballPos);
      this.throwT -= dt;
      dad.yaw = dampAngle(dad.yaw, -Math.PI / 2, 4, dt);
      if (this.throwT <= 0 && this.state !== 'petted' && this.followT <= 0) {
        dad.setPose('throw', 0.8);
        if (Math.random() < 0.5) this.crowd.say(dad, pick(['Fetch, Biscuit!', 'Go get it!', 'Ready? Fetch!']));
        this.ballState = 'flying';
        const a = rand(Math.PI * 0.75, Math.PI * 1.25);
        const s = rand(5, 8);
        this.ballVel.set(Math.cos(a) * s, rand(4, 6), Math.sin(a) * s * 0.7);
        this.ballPos.set(dad.pos.x - 0.3, 1.9, dad.pos.z);
        this.state = 'fetch';
        this.world.emit('bark', this);
      }
    } else if (this.ballState === 'flying' || this.ballState === 'ground') {
      this.ballVel.y -= 9.8 * dt;
      this.ballPos.addScaledVector(this.ballVel, dt);
      if (this.ballPos.y < 0.07) {
        this.ballPos.y = 0.07;
        this.ballVel.y *= -0.45;
        this.ballVel.x *= 0.7;
        this.ballVel.z *= 0.7;
        this.ballState = 'ground';
      }
      this.world.collideWalls(this.ballPos, 0.07, 0.2);
    } else if (this.ballState === 'dog') {
      this.ballPos.copy(mouth);
    }
    this.ball.position.copy(this.ballPos);

    switch (this.state) {
      case 'petted':
        if (this.t <= 0) this.state = this.ballState === 'dog' ? 'return' : this.ballState === 'dad' ? 'wander' : 'fetch';
        break;
      case 'fetch': {
        const d = this.moveToward(this.ballPos, 5.2, dt);
        if (d < 0.5 && this.ballPos.y < 0.4) { this.ballState = 'dog'; this.state = 'return'; }
        break;
      }
      case 'return': {
        const d = this.moveToward(V(dad.pos.x - 0.8, 0, dad.pos.z), 3.4, dt);
        if (d < 0.2) {
          this.ballState = 'dad';
          this.throwT = rand(2, 5);
          this.state = 'wander';
          this.t = 0;
          if (Math.random() < 0.4) this.crowd.say(dad, pick(['Good boy!', 'Good dog!']));
        }
        break;
      }
      default: { // wander, or follow whoever petted him
        if (this.followT > 0 && this.followWho) {
          const w = this.followWho;
          if (dist2D(this.pos, w.pos) > 1.6 && w.pos.y < 0.5) this.moveToward(w.pos, 3.8, dt);
        } else {
          if (this.t <= 0) {
            this.target.set(rand(8, 19), 0, rand(-1, 13));
            this.t = rand(3, 6);
          }
          this.moveToward(this.target, 1.5, dt);
        }
        if (this.ballState === 'ground') this.state = 'fetch';
      }
    }

    // Pose: run cycle, sit when petted, wagging tail always.
    this.phase += dt * (this.speed > 0 ? 4 + this.speed * 2.5 : 2);
    const s = Math.sin(this.phase);
    const run = this.speed > 0 ? Math.min(1, this.speed / 4) : 0;
    this.legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3 ? s : -s) * 0.7 * run; });
    const sit = this.state === 'petted';
    this.body.rotation.x = damp(this.body.rotation.x, sit ? Math.PI / 2 - 0.5 : Math.PI / 2, 8, dt);
    this.legs[2].rotation.x = this.legs[3].rotation.x = sit ? -1.2 : this.legs[2].rotation.x;
    this.tail.rotation.y = Math.sin(this.world.time * (sit ? 22 : 12)) * 0.6;
    this.headG.rotation.x = sit ? -0.3 : 0;
    this.root.position.set(this.pos.x, Math.abs(s) * 0.03 * run, this.pos.z);
    this.root.rotation.y = this.yaw;
  }
}

// ── pigeons by Grandpa's bench ────────────────────────────────────────────────────────────────
class Pigeons {
  constructor(world, crowd) {
    this.world = world;
    this.crowd = crowd;
    this.birds = [];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), mat(0x8c96a8));
      body.scale.set(0.9, 0.85, 1.4);
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0x6a7a8c));
      head.position.set(0, 0.07, 0.1);
      g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.04, 6), mat(0xff9c3a));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.06, 0.16);
      g.add(beak);
      const wings = [];
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.01, 0.1), mat(0x7a8496));
        w.geometry.translate(sx * 0.08, 0, 0);
        w.position.set(sx * 0.04, 0.03, 0);
        g.add(w);
        wings.push(w);
      }
      world.scene.add(g);
      const home = V(rand(14.8, 16.6), 0.06, rand(-3.4, -0.6));
      this.birds.push({ g, head, wings, home, pos: home.clone(), vel: V(0, 0, 0), yaw: rand(0, 6), state: 'peck', t: rand(0, 3) });
    }
    this.crumbT = 4;
  }

  update(dt) {
    const chars = [...this.world.characters, this.crowd.dog];
    this.crumbT -= dt;
    if (this.crumbT < 0) {
      this.crumbT = rand(6, 12);
      this.crowd.grandpa.setPose('throw', 0.8);
    }
    for (const b of this.birds) {
      b.t -= dt;
      if (b.state === 'peck') {
        b.head.position.y = 0.07 - Math.max(0, Math.sin(this.world.time * 6 + b.home.x * 9)) * 0.06;
        if (b.t < 0) {
          b.t = rand(1, 3);
          b.target = V(b.home.x + rand(-0.6, 0.6), 0.06, b.home.z + rand(-0.6, 0.6));
        }
        if (b.target) {
          const dx = b.target.x - b.pos.x, dz = b.target.z - b.pos.z, d = Math.hypot(dx, dz);
          if (d > 0.05) { b.pos.x += (dx / d) * 0.4 * dt; b.pos.z += (dz / d) * 0.4 * dt; b.yaw = Math.atan2(dx, dz); }
        }
        for (const c of chars) {
          const sp = c.speed ?? 0;
          if (dist2D(c.pos, b.pos) < (sp > 2 ? 2.4 : 1.2) && c.pos.y < 1) {
            b.state = 'fly';
            b.t = rand(5, 8);
            const a = Math.atan2(b.pos.x - c.pos.x, b.pos.z - c.pos.z) + rand(-0.5, 0.5);
            b.vel.set(Math.sin(a) * 3, rand(3, 4.5), Math.cos(a) * 3);
            b.yaw = a;
            this.world.emit('flap', b);
            break;
          }
        }
        b.wings.forEach((w) => { w.rotation.z = 0; });
      } else {
        // Fly away, circle, then glide home.
        if (b.t > 0) {
          b.vel.y = damp(b.vel.y, b.pos.y < 6 ? 1.2 : 0, 1, dt);
          b.vel.x += Math.cos(this.world.time + b.home.z) * dt * 2;
          b.vel.z += Math.sin(this.world.time + b.home.x) * dt * 2;
        } else {
          const to = V(b.home.x - b.pos.x, b.home.y - b.pos.y, b.home.z - b.pos.z);
          const d = to.length();
          b.vel.lerp(to.normalize().multiplyScalar(Math.min(4, d * 1.5 + 0.3)), 1 - Math.exp(-2 * dt));
          if (d < 0.1) { b.state = 'peck'; b.vel.set(0, 0, 0); b.pos.copy(b.home); }
        }
        b.pos.addScaledVector(b.vel, dt);
        b.yaw = Math.atan2(b.vel.x, b.vel.z);
        const f = Math.sin(this.world.time * 30 + b.home.x) * 0.9;
        b.wings[0].rotation.z = f;
        b.wings[1].rotation.z = -f;
      }
      b.g.position.copy(b.pos);
      b.g.rotation.y = b.yaw;
    }
  }
}

// ── butterflies over the flower beds ──────────────────────────────────────────────────────────
class Butterflies {
  constructor(world) {
    this.world = world;
    this.items = [];
    const cols = [0xffd23f, 0xff7ab8, 0x7ac7ff, 0xffffff, 0xff8c42];
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      const wings = [];
      for (const sx of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(0.06, 10), mat(cols[i % cols.length], { side: THREE.DoubleSide }));
        w.geometry.translate(sx * 0.06, 0, 0);
        w.rotation.x = -Math.PI / 2;
        const p = new THREE.Group();
        p.add(w);
        g.add(p);
        wings.push(p);
      }
      world.scene.add(g);
      const spot = world.flowerSpots[i % world.flowerSpots.length];
      this.items.push({ g, wings, spot, seed: rand(0, 100), pos: spot.clone() });
    }
  }

  update() {
    const t = this.world.time;
    for (const b of this.items) {
      const s = b.seed;
      const x = b.spot.x + Math.sin(t * 0.7 + s) * 1.6 + Math.sin(t * 1.9 + s * 2) * 0.4;
      const z = b.spot.z + Math.cos(t * 0.6 + s * 1.3) * 1.1;
      const y = 0.7 + Math.sin(t * 2.3 + s) * 0.35 + Math.sin(t * 5 + s) * 0.06;
      const yaw = Math.atan2(x - b.pos.x, z - b.pos.z);
      b.pos.set(x, y, z);
      b.g.position.copy(b.pos);
      b.g.rotation.y = yaw;
      const f = Math.sin(t * 22 + s) * 1.1;
      b.wings[0].rotation.z = f;
      b.wings[1].rotation.z = -f;
    }
  }
}
