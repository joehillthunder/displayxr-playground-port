// Grass and trees. The grass is one instanced mesh of tapered blades: a vertex shader sways it
// in the wind and pushes it aside around anyone walking through it. Trees have tapered trunks,
// branches and lumpy, colour-varied leaf clusters whose crowns sway.

import * as THREE from 'three';
import { rand } from './util.js';

const MAX_PUSHERS = 16;

/** Ground regions with no grass: rubber pads, the path, the sandbox, the merry-go-round. */
function bare(x, z) {
  if (x > -11.2 && x < 7.6 && z > -7.2 && z < 3.6) return true;
  if (x > -9.8 && x < -2.2 && z > 4.4 && z < 11.6) return true;
  if ((x - 6) ** 2 + (z - 8) ** 2 < 3.6 ** 2) return true;
  if (x > -15.2 && x < -10.8 && z > -9.2 && z < -4.8) return true;
  const e = Math.hypot(x / 1.12, z / 0.78);
  if (e > 15.0 && e < 17.0) return true;
  if (Math.abs(x - 13) < 1 && Math.abs(z + 6.2) < 0.6) return true;
  return false;
}

export function buildGrass(world, count) {
  if (!count) return null;
  const segs = 4;
  const pos = [], hgt = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const y = i / segs;
    const w = 0.011 * (1 - y * 0.9);
    pos.push(-w, y, 0, w, y, 0);
    hgt.push(y, y);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.setAttribute('bladeH', new THREE.Float32BufferAttribute(hgt, 1));
  geo.setIndex(idx);

  const uniforms = {
    uTime: { value: 0 },
    uPush: { value: Array.from({ length: MAX_PUSHERS }, () => new THREE.Vector4(0, -99, 0, 0)) },
  };
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
  material.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float bladeH;
        varying float vH;
        uniform float uTime;
        uniform vec4 uPush[${MAX_PUSHERS}];`)
      .replace('#include <project_vertex>', `
        vH = bladeH;
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          vec3 base = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        #else
          vec3 base = vec3(0.0);
        #endif
        float k = bladeH * bladeH;
        float w = sin(uTime * 1.6 + base.x * 0.31 + base.z * 0.22) * 0.6 + sin(uTime * 3.7 + base.x * 1.7 + base.z) * 0.25;
        vec2 bend = vec2(w * 0.05, w * 0.02);
        for (int i = 0; i < ${MAX_PUSHERS}; i++) {
          vec2 d = base.xz - uPush[i].xz;
          float r = uPush[i].w;
          float f = (1.0 - smoothstep(0.0, r, length(d))) * step(uPush[i].y, 0.5);
          bend += normalize(d + vec2(0.0001)) * f * 0.6;
        }
        mvPosition.xz += bend * k;
        mvPosition.y -= length(bend) * k * 0.6;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n varying float vH;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= mix(vec3(0.42, 0.55, 0.32), vec3(1.08, 1.12, 0.92), vH);`);
  };

  const mesh = new THREE.InstancedMesh(geo, material, count);
  const m = new THREE.Matrix4(), qn = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const greens = [0x5fae45, 0x6fbf4f, 0x55a03d, 0x7ccc58, 0x8fbf4a, 0x4d9a3a];
  const c = new THREE.Color();
  let i = 0, tries = 0;
  while (i < count && tries < count * 6) {
    tries++;
    const outer = Math.random() < 0.22;
    const x = outer ? rand(-34, 34) : rand(-21.4, 21.4);
    const z = outer ? rand(-26, 26) : rand(-15.4, 15.4);
    if (outer && Math.abs(x) < 21.6 && Math.abs(z) < 15.6) continue;
    if (bare(x, z)) continue;
    p.set(x, 0, z);
    e.set(rand(-0.25, 0.25), rand(0, Math.PI * 2), rand(-0.25, 0.25));
    qn.setFromEuler(e);
    const h = rand(0.06, 0.15) * (outer ? 1.3 : 1);
    s.set(rand(0.8, 1.3), h, 1);
    m.compose(p, qn, s);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.setHex(greens[i % greens.length]).multiplyScalar(rand(0.85, 1.1)));
    i++;
  }
  mesh.count = i;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  world.scene.add(mesh);

  return {
    mesh,
    update(t, chars) {
      uniforms.uTime.value = t;
      const P = uniforms.uPush.value;
      for (let k = 0; k < MAX_PUSHERS; k++) {
        const ch = chars[k];
        if (ch) P[k].set(ch.pos.x, ch.pos.y, ch.pos.z, ch.adult ? 0.55 : 0.45);
        else P[k].set(9999, 0, 9999, 0.5);
      }
    },
  };
}

// ── trees ────────────────────────────────────────────────────────────────────────────────────
let blobGeos;
function blobs() {
  if (blobGeos) return blobGeos;
  blobGeos = [];
  for (let v = 0; v < 4; v++) {
    const g = new THREE.IcosahedronGeometry(1, 3);
    const pos = g.attributes.position;
    const col = [];
    const tmp = new THREE.Vector3();
    const seed = rand(0, 100);
    for (let i = 0; i < pos.count; i++) {
      tmp.fromBufferAttribute(pos, i);
      const n = Math.sin(tmp.x * 5 + seed) * Math.sin(tmp.y * 6 + seed * 0.7) * Math.sin(tmp.z * 4 + seed * 1.3);
      tmp.multiplyScalar(1 + n * 0.16 + rand(-0.03, 0.03));
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
      // Lighter on top, darker underneath, with a little speckle.
      const l = 0.75 + tmp.y * 0.2 + rand(-0.06, 0.06);
      col.push(l * 0.85, l, l * 0.8);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    blobGeos.push(g);
  }
  return blobGeos;
}

const leafMats = [0x3f8f3a, 0x4aa043, 0x37803a, 0x5bb04d, 0x6a9f3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, vertexColors: true, envMapIntensity: 0.35 }));
const barkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.95 });

export function buildTree(world, x, z, s) {
  const tree = new THREE.Group();
  tree.position.set(x, 0, z);
  tree.rotation.y = rand(0, Math.PI * 2);
  world.scene.add(tree);
  const trunkH = 2.6 * s;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.13 * s, 0.24 * s, trunkH, 12, 4), barkMat);
  trunk.position.y = trunkH / 2;
  trunk.castShadow = trunk.receiveShadow = true;
  tree.add(trunk);
  // Roots flare at the base.
  const flare = new THREE.Mesh(new THREE.ConeGeometry(0.4 * s, 0.35 * s, 12, 1, true), barkMat);
  flare.position.y = 0.15 * s;
  tree.add(flare);
  const crown = new THREE.Group();
  crown.position.y = trunkH;
  tree.add(crown);
  for (let b = 0; b < 3; b++) {
    const a = (b / 3) * Math.PI * 2 + rand(-0.3, 0.3);
    const len = rand(0.8, 1.2) * s;
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.09 * s, len, 8), barkMat);
    br.position.set(Math.cos(a) * len * 0.35, -0.3 * s + len * 0.3, Math.sin(a) * len * 0.35);
    br.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
    br.castShadow = true;
    crown.add(br);
  }
  const G = blobs();
  const n = 13;
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2);
    const r = i < 4 ? rand(0, 0.4) : rand(0.6, 1.25);
    const y = i < 4 ? rand(0.8, 1.4) : rand(-0.1, 1.1);
    const blob = new THREE.Mesh(G[i % G.length], leafMats[(((i + Math.floor(x * 3)) % leafMats.length) + leafMats.length) % leafMats.length]);
    blob.position.set(Math.cos(a) * r * s, y * s, Math.sin(a) * r * s);
    blob.scale.setScalar(rand(0.65, 0.95) * s);
    blob.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    blob.castShadow = true;
    blob.receiveShadow = true;
    crown.add(blob);
  }
  const seed = rand(0, 10);
  world.updaters.push((dt, t) => {
    crown.rotation.z = Math.sin(t * 0.9 + seed) * 0.025;
    crown.rotation.x = Math.sin(t * 0.7 + seed * 2) * 0.02;
  });
  world.addWall(x - 0.25 * s, x + 0.25 * s, z - 0.25 * s, z + 0.25 * s, 0, 3, true);
}
