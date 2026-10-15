// DisplayXR Playground: a live 3D playground. You are one of the kids; the others play by
// themselves. Climb the ladder and the rock wall, cross the wobbly bridge, go down the wave and
// spiral slides, cannonball off the diving plank into the ball pit, swing, spin the merry-go-round,
// ride the seesaw with a friend, get an ice cream and pet Biscuit the dog. Each one earns a sticker.
//
// In the DisplayXR Browser on a Leia display the playground is glasses-free 3D; anywhere else it
// plays in 2D. URL options: ?kid=<0-3> skips the picker, ?mono forces 2D, ?depth=0-2, ?dev shows fps.

import * as THREE from 'three';
import { Stage } from './stage.js';
import { World, buildScenery } from './world.js';
import { buildEquipment, STICKERS } from './equipment.js';
import { Character } from './character.js';
import { Crowd, KID_LOOKS } from './npc.js';
import { Bubbles, Particles } from './fx.js';
import { Sfx } from './audio.js';
import { Input } from './input.js';
import { angleDiff, clamp, damp, dist2D, pick, rand } from './util.js';
import { Q, QUALITY, q, upgradeMaterials } from './materials.js';
import { buildGrass } from './nature.js';
import { Conversations } from './talk.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const store = {
  get(k) { try { return localStorage.getItem('dxr-playground.' + k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem('dxr-playground.' + k, v); } catch { /* private mode */ } },
};

// Graphics quality: ?quality=high|medium|low, else the last choice, else high.
Q.level = [params.get('quality'), store.get('quality'), 'high'].find((v) => v in QUALITY);

// ── world ─────────────────────────────────────────────────────────────────────────────────────
const canvas = $('stage');
const stage = new Stage(canvas);
stage.maxEyeW = q().eyeW;
const world = new World(stage.scene);
const before = new Set(stage.scene.children);
buildScenery(world, stage.renderer);
const eq = buildEquipment(world);
// Plain colours on the equipment, benches and sign become glossy plastic, painted metal and wood.
upgradeMaterials(stage.scene.children.filter((o) => !before.has(o)));
const grass = buildGrass(world, q().grass);
const bubbles = new Bubbles(stage.scene);
const fx = new Particles(stage.scene);
const crowd = new Crowd(world, eq, bubbles, fx);
const sfx = new Sfx();
const talk = new Conversations(world, bubbles, sfx, () => player);
crowd.talk = talk;

const PLAYABLE = KID_LOOKS.slice(0, 4);
let player = null;
let playerLookIndex = -1;

// NPC kids: everyone the player isn't. Spread them over the playground.
const spawnSpots = [[-4, 0, 3.5], [2, 0, 3.5], [-6, 0, 5], [6, 0, 5], [9, 0, 2], [-9, 0, 3], [0, 0, 9], [4, 0, -1.8]];
function spawnNpcs(exclude) {
  KID_LOOKS.forEach((look, i) => {
    if (i === exclude) return;
    const k = crowd.addKid(look);
    const s = spawnSpots[i % spawnSpots.length];
    k.ch.place(s[0] + rand(-0.5, 0.5), 0, s[2] + rand(-0.5, 0.5), rand(0, 6));
  });
}

// ── camera ────────────────────────────────────────────────────────────────────────────────────
const cam = { yaw: 0, pitch: 0.36, dist: 7.5, target: new THREE.Vector3(0, 1, 4), attract: 0 };
function updateCamera(dt, look) {
  if (!player) {
    // Attract mode: a slow orbit over the playground while you pick a kid.
    cam.attract += dt * 0.06;
    cam.yaw = Math.sin(cam.attract) * 0.6;
    cam.pitch = 0.42;
    cam.dist = 17;
    cam.target.set(-1, 1.2, 1.5);
  } else {
    cam.yaw -= look.dx * 0.0055;
    cam.pitch = clamp(cam.pitch + look.dy * 0.004, 0.02, 1.25);
    cam.dist = clamp(cam.dist * Math.exp(look.zoom * 0.001), 3.2, 16);
    // Drift behind the player while they run, unless they're running at the camera.
    if (performance.now() - input.lastLookT > 2500 && player.mode === 'ground' && player.speed > 1.2) {
      const d = angleDiff(cam.yaw, player.yaw + Math.PI);
      if (Math.abs(d) < 2.3) cam.yaw += d * (1 - Math.exp(-0.7 * dt));
    }
    const ty = player.pos.y + (player.mode === 'ground' || player.mode === 'climb' ? 1.0 : 0.7);
    const rate = player.mode === 'swing' ? 3 : player.mode === 'slide' ? 6 : 8;
    cam.target.x = damp(cam.target.x, player.pos.x, rate, dt);
    cam.target.y = damp(cam.target.y, ty, rate * 0.7, dt);
    cam.target.z = damp(cam.target.z, player.pos.z, rate, dt);
  }
  const cp = Math.cos(cam.pitch);
  stage.cam.position.set(
    cam.target.x + cam.dist * cp * Math.sin(cam.yaw),
    Math.max(0.4, cam.target.y + cam.dist * Math.sin(cam.pitch)),
    cam.target.z + cam.dist * cp * Math.cos(cam.yaw),
  );
  stage.cam.lookAt(cam.target);
  stage.focusDist = stage.cam.position.distanceTo(cam.target);
}

// ── player ────────────────────────────────────────────────────────────────────────────────────
function choosePlayer(i) {
  const first = !player;
  const look = PLAYABLE[i];
  let pos = new THREE.Vector3(-1, 0, 6.5), yaw = Math.PI;
  if (player) {
    pos = player.pos.clone();
    yaw = player.yaw;
    player.leave();
    stage.scene.remove(player.model.root);
    world.characters.splice(world.characters.indexOf(player), 1);
    // The kid you were goes back to being an NPC... and the one you picked steps in.
    const old = crowd.kids.find((k) => k.ch.name === look.name);
    if (old) {
      crowd.removeKid(old);
      stage.scene.remove(old.ch.model.root);
      world.characters.splice(world.characters.indexOf(old.ch), 1);
    }
    const back = crowd.addKid(KID_LOOKS[playerLookIndex]);
    back.ch.place(pos.x + 1, 0, pos.z, yaw);
  }
  player = new Character(world, look, { name: look.name, isPlayer: true });
  player.place(pos.x, first ? 0 : Math.max(0, pos.y), pos.z, yaw);
  world.characters.push(player);
  crowd.player = player;
  playerLookIndex = i;
  store.set('kid', String(i));
  if (first) {
    spawnNpcs(i);
    cam.yaw = 0;
    cam.dist = 7.5;
    cam.target.set(pos.x, 1, pos.z);
    setTimeout(() => bubbles.say(player, `Hi, I'm ${look.name}!`, 2.6), 400);
  }
  renderStickers();
}

// ── stickers ──────────────────────────────────────────────────────────────────────────────────
let earned = new Set();
try { earned = new Set(JSON.parse(store.get('stickers') || '[]')); } catch { earned = new Set(); }
function renderStickers() {
  const list = $('sticker-list');
  list.replaceChildren(...STICKERS.map((s) => {
    const li = document.createElement('li');
    li.className = earned.has(s.id) ? 'got' : '';
    li.innerHTML = `<span class="dot" aria-hidden="true"></span><span><b></b><small></small></span>`;
    li.querySelector('b').textContent = s.label;
    li.querySelector('small').textContent = earned.has(s.id) ? 'Done!' : s.hint;
    return li;
  }));
  $('sticker-count').textContent = `${earned.size}/${STICKERS.length}`;
}
world.on('sticker', (id) => {
  if (earned.has(id)) return;
  earned.add(id);
  store.set('stickers', JSON.stringify([...earned]));
  const s = STICKERS.find((x) => x.id === id);
  renderStickers();
  fx.confetti(player.pos.clone().setY(player.pos.y + 1.4), 60);
  if (earned.size === STICKERS.length) {
    sfx.champion();
    toast(`All ${STICKERS.length} stickers! Playground champion!`, 5000, 'big');
    fx.confetti(player.pos.clone().setY(player.pos.y + 2), 220);
    bubbles.say(player, 'I did everything!', 3);
  } else {
    sfx.sticker();
    toast(`Sticker: ${s.label} (${earned.size}/${STICKERS.length})`);
  }
});
$('reset-stickers').addEventListener('click', () => {
  earned.clear();
  store.set('stickers', '[]');
  renderStickers();
  toast('Stickers reset. Go play!');
});

let toastTimer = 0;
function toast(text, ms = 2600, kind = '') {
  const t = $('toast');
  t.textContent = text;
  t.dataset.kind = kind;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

// ── sounds for world events ───────────────────────────────────────────────────────────────────
const near = (ch, r = 12) => player && ch && dist2D(ch.pos, player.pos) < r;
world.on('jump', (ch) => { if (ch === player) sfx.jump(); });
world.on('boing', (ch) => { if (near(ch)) sfx.boing(); });
world.on('slide', (ch) => { if (near(ch)) sfx.whoosh(); });
world.on('pole', (ch) => { if (near(ch)) sfx.pole(); });
world.on('land', (ch) => { if (ch === player) sfx.land(); });
world.on('plop', (ch) => { if (near(ch, 8)) sfx.plop(); });
world.on('cannonball', (ch) => {
  if (near(ch, 16)) sfx.splash();
  if (ch === player) { world.award(ch, 'cannonball'); bubbles.say(player, 'SPLASH!', 1.6); }
});
world.on('spin', (ch) => { if (near(ch)) sfx.spin(); });
world.on('bark', (d) => { if (near(d, 14)) sfx.bark(); });
world.on('icecream', (ch) => { if (near(ch)) sfx.chime(); });
world.on('flap', (b) => { if (player && dist2D(b.pos, player.pos) < 10) sfx.flap(); });
world.on('swingHigh', (ch) => { if (near(ch, 8)) sfx.creak(); });
world.on('tagged', (p) => { if (p === player) { sfx.tag(); toast("Tag! You're it! Chase them!", 2000); } });

// ── input and HUD ─────────────────────────────────────────────────────────────────────────────
const ui = {
  stickShow(x, y) { const s = $('stick'); s.style.left = x + 'px'; s.style.top = y + 'px'; s.classList.add('on'); },
  stickMove(dx, dy) { $('stick-knob').style.transform = `translate(${dx * 40}px, ${dy * 40}px)`; },
  stickHide() { $('stick').classList.remove('on'); $('stick-knob').style.transform = ''; },
};
const input = new Input(canvas, ui);
input.onKey = (code) => {
  sfx.unlock();
  if (code === 'KeyM') toggleMute();
  if (code === 'KeyH') $('help').toggleAttribute('hidden');
  if (code === 'KeyC') { cam.yaw = player ? player.yaw + Math.PI : 0; cam.pitch = 0.36; cam.dist = 7.5; }
  if (code === 'Tab') toggleStickers();
  if (code === 'KeyK' && player) openPicker();
};
addEventListener('keydown', (e) => { if (e.code === 'Tab') e.preventDefault(); });
const bindBtn = (el, fn) => {
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); sfx.unlock(); fn(); });
};
bindBtn($('btn-jump'), () => input.pressJump());
bindBtn($('btn-action'), () => input.pressAction());

function toggleMute() {
  sfx.setMuted(!sfx.muted);
  $('mute').textContent = sfx.muted ? 'Sound off' : 'Sound on';
  $('mute').setAttribute('aria-pressed', String(!sfx.muted));
  store.set('muted', sfx.muted ? '1' : '0');
}
$('mute').addEventListener('click', () => { sfx.unlock(); toggleMute(); });
if (store.get('muted') === '1') { sfx.muted = true; $('mute').textContent = 'Sound off'; $('mute').setAttribute('aria-pressed', 'false'); }

const depthEl = $('depth');
const depth0 = params.has('depth') ? clamp(+params.get('depth') || 0, 0, 2) : 1;
depthEl.value = depth0;
stage.setDepth(depth0);
depthEl.addEventListener('input', () => stage.setDepth(+depthEl.value));
function toggleStickers() {
  const c = $('stickers').classList.toggle('collapsed');
  $('stickers-toggle').textContent = c ? 'Show' : 'Hide';
}
$('stickers-toggle').addEventListener('click', toggleStickers);
$('switch-kid').addEventListener('click', () => openPicker());

const mode3d = $('mode3d');
mode3d.addEventListener('click', async () => {
  const on = !stage.stereo;
  if (await stage.setStereo(on)) setModeBadge();
});
function setModeBadge() {
  const b = $('badge');
  if (stage.woven) {
    b.textContent = stage.stereo ? 'Glasses-free 3D' : '3D display, 2D mode';
    b.dataset.kind = stage.stereo ? 'ok' : '';
    mode3d.hidden = !stage.displayModesSupported;
    mode3d.textContent = stage.stereo ? 'Switch to 2D' : 'Switch to 3D';
  } else {
    b.textContent = '2D preview';
    b.dataset.kind = '';
    b.title = 'Open this page in the DisplayXR Browser on a Leia 3D display for glasses-free depth.';
    mode3d.hidden = true;
  }
}
stage.onModeChange = () => setModeBadge();

// Kid picker.
function openPicker() {
  const p = $('picker');
  const cards = $('kid-cards');
  cards.replaceChildren(...PLAYABLE.map((look, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'kid';
    b.style.setProperty('--shirt', '#' + look.shirt.toString(16).padStart(6, '0'));
    b.style.setProperty('--skin', '#' + look.skin.toString(16).padStart(6, '0'));
    b.style.setProperty('--hair', '#' + look.hair.toString(16).padStart(6, '0'));
    b.style.setProperty('--pants', '#' + (look.skirt ?? look.pants).toString(16).padStart(6, '0'));
    b.innerHTML = `<span class="avatar" aria-hidden="true"><i class="h"></i><i class="f"></i><i class="s"></i><i class="p"></i></span><b></b>`;
    b.querySelector('b').textContent = look.name;
    if (i === playerLookIndex) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => {
      sfx.unlock();
      sfx.click();
      p.hidden = true;
      document.body.classList.add('playing');
      if (i !== playerLookIndex) choosePlayer(i);
    });
    return b;
  }));
  p.hidden = false;
  $('picker-close').hidden = !player;
  cards.querySelector('[aria-current]')?.focus() || cards.firstElementChild.focus();
}
$('picker-close').addEventListener('click', () => { $('picker').hidden = true; });

// The sun's shadow box follows the camera target, snapped to whole shadow-map texels so the
// shadows don't shimmer as you move.
const sunTexel = 34 / q().shadow;
function followSun() {
  const s = world.sun;
  const x = Math.round(cam.target.x / sunTexel) * sunTexel;
  const z = Math.round(cam.target.z / sunTexel) * sunTexel;
  s.target.position.set(x, 0, z);
  s.position.set(x + world.sunOffset.x, world.sunOffset.y, z + world.sunOffset.z);
}

const qualityEl = $('quality');
qualityEl.value = Q.level;
qualityEl.addEventListener('change', () => {
  store.set('quality', qualityEl.value);
  const u = new URL(location.href);
  u.searchParams.delete('quality');
  if (player) u.searchParams.set('kid', String(playerLookIndex));
  location.href = u.toString();
});

// ── frame ─────────────────────────────────────────────────────────────────────────────────────
const promptEl = $('prompt');
let lastPrompt = '';
let fpsT = 0, fpsN = 0;
const dev = params.has('dev');

stage.onTick = (dt) => {
  const r = input.read();
  if (player) {
    const y = cam.yaw;
    const inp = player.input;
    inp.mx = Math.cos(y) * r.x - Math.sin(y) * r.y;
    inp.mz = -Math.sin(y) * r.x - Math.cos(y) * r.y;
    inp.fwd = r.y;
    inp.run = r.run;
    inp.jump = r.jump;
    if (r.action) {
      if (player.mode === 'ground') {
        const it = world.nearestInteractable(player);
        if (it) it.use(player);
      } else if (['swing', 'seat', 'sit'].includes(player.mode)) {
        inp.jump = true;
      }
    }
    player.update(dt);
    if (player.holding && (player.holdT -= dt) < 0) {
      player.holding.parent?.remove(player.holding);
      player.holding = null;
      bubbles.say(player, 'All gone! Yum.', 1.8);
    }
  }
  crowd.update(dt);
  // Kids don't walk through each other.
  const cs = world.characters;
  for (let i = 0; i < cs.length; i++) {
    for (let j = i + 1; j < cs.length; j++) {
      const a = cs[i], b = cs[j];
      if (a.mode !== 'ground' || b.mode !== 'ground' || Math.abs(a.pos.y - b.pos.y) > 0.8) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.46 && d > 1e-4) {
        const push = (0.46 - d) / 2;
        a.pos.x -= (dx / d) * push; a.pos.z -= (dz / d) * push;
        b.pos.x += (dx / d) * push; b.pos.z += (dz / d) * push;
      }
    }
  }
  world.update(dt);
  talk.update(dt);
  grass?.update(world.time, [...world.characters, crowd.dog, crowd.dad, crowd.vendor]);
  bubbles.update(dt);
  fx.update(dt);
  sfx.update(dt);
  updateCamera(dt, r.look);
  followSun();
  updatePrompt();
  if (dev) {
    fpsT += dt; fpsN++;
    if (fpsT > 0.5) { $('fps').textContent = `${Math.round(fpsN / fpsT)} fps`; fpsT = fpsN = 0; }
  }
};

function updatePrompt() {
  let text = '';
  const touch = matchMedia('(pointer: coarse)').matches;
  const key = (k) => (touch ? '' : `<kbd>${k}</kbd> `);
  let action = '';
  if (player) {
    switch (player.mode) {
      case 'ground': {
        const it = world.nearestInteractable(player);
        if (it) { text = `${key('E')}${it.label}`; action = it.label; }
        else if (player.inPit && player.grounded) {
          const pit = world.ballPit;
          const edge = Math.min(player.pos.x - pit.ix0, pit.ix1 - player.pos.x, player.pos.z - pit.iz0, pit.iz1 - player.pos.z);
          if (edge < 0.6) text = `${key('Space')}Jump to climb out`;
        } else if (player.groundRef?.springy) text = `${key('Space')}Bounce off the diving board!`;
        break;
      }
      case 'climb': text = touch ? 'Push up to climb, down to go back' : '<kbd>W</kbd> climb up &middot; <kbd>S</kbd> down &middot; <kbd>Space</kbd> jump off'; break;
      case 'swing': text = touch ? 'Hold the stick to pump higher &middot; Jump to leap off' : 'Hold <kbd>W</kbd> to pump higher &middot; <kbd>Space</kbd> to leap off'; action = 'Hop off'; break;
      case 'seat': text = `${key('Space')}Hop off the seesaw`; action = 'Hop off'; break;
      case 'slide': text = 'Wheee!'; break;
      case 'pole': text = 'Whoosh!'; break;
      default: break;
    }
  }
  if (text !== lastPrompt) {
    promptEl.innerHTML = text;
    promptEl.classList.toggle('show', !!text);
    lastPrompt = text;
  }
  const btn = $('btn-action');
  btn.textContent = action || 'Action';
  btn.classList.toggle('lit', !!action);
}

// ── boot ──────────────────────────────────────────────────────────────────────────────────────
renderStickers();
setModeBadge();
if (dev) $('fps').hidden = false;
window.playground = { world, stage, crowd, eq, cam, get player() { return player; }, choosePlayer };

const kidParam = params.get('kid');
if (kidParam != null && PLAYABLE[+kidParam]) {
  $('picker').hidden = true;
  document.body.classList.add('playing');
  choosePlayer(+kidParam);
} else {
  // Until a kid is picked, all eight kids play on their own.
  spawnNpcs(-1);
  openPicker();
  const firstPick = (i) => {
    // The picked kid leaves the NPC crowd and becomes you.
    const look = PLAYABLE[i];
    const k = crowd.kids.find((x) => x.ch.name === look.name);
    const pos = k ? k.ch.pos.clone() : new THREE.Vector3(-1, 0, 6.5);
    if (k) {
      crowd.removeKid(k);
      stage.scene.remove(k.ch.model.root);
      world.characters.splice(world.characters.indexOf(k.ch), 1);
    }
    player = new Character(world, look, { name: look.name, isPlayer: true });
    player.place(pos.x, 0, pos.z, Math.PI);
    if (pos.y > 0.3 || world.ballPit.contains(pos.x, pos.z)) player.place(-1, 0, 6.5, Math.PI);
    world.characters.push(player);
    crowd.player = player;
    playerLookIndex = i;
    store.set('kid', String(i));
    cam.yaw = 0;
    cam.pitch = 0.36;
    cam.dist = 7.5;
    cam.target.set(player.pos.x, 1, player.pos.z);
    setTimeout(() => bubbles.say(player, `Hi, I'm ${look.name}!`, 2.6), 300);
    renderStickers();
  };
  // Route the first pick through firstPick, later picks through choosePlayer.
  const cards = $('kid-cards');
  cards.addEventListener('click', (e) => {
    const b = e.target.closest('.kid');
    if (!b || player) return;
    e.stopImmediatePropagation();
    sfx.unlock();
    sfx.click();
    $('picker').hidden = true;
    document.body.classList.add('playing');
    firstPick([...cards.children].indexOf(b));
  }, { capture: true });
}

const { woven, firstWoven } = await stage.start();
setModeBadge();
firstWoven.then((r) => {
  console.info(`[playground] firstWoven woven=${r.woven} confirmed=${r.confirmed} reason=${r.reason} ms=${Math.round(r.ms || 0)}`);
  setModeBadge();
});
if (woven) console.info('[playground] running woven');
