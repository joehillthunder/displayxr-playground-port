// The ball pit: ~1000 balls with simple physics (gravity, walls, ball-ball contacts through a
// spatial hash, and characters as moving spheres that shove them). One instanced mesh draws them.
// Characters wading in it sink to the hips; a cannonball from the diving plank throws balls up.

import * as THREE from 'three';
import { mat } from './world.js';
import { rand } from './util.js';

const R = 0.085;
const COLORS = [0xff4d4d, 0xffc21a, 0x2fbf4f, 0x2f8fff, 0xb14dff, 0xff7ad9];

export class BallPit {
  constructor(world, { x0, x1, z0, z1, wall = 0.15, rim = 0.55, count = 1000 }) {
    this.world = world;
    this.ix0 = x0 + wall; this.ix1 = x1 - wall; this.iz0 = z0 + wall; this.iz1 = z1 - wall;
    this.rim = rim;
    this.sink = 0.04;
    this.n = count;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count * 3);
    const W = this.ix1 - this.ix0, D = this.iz1 - this.iz0;
    for (let i = 0; i < count; i++) {
      this.p[i * 3] = this.ix0 + R + Math.random() * (W - 2 * R);
      this.p[i * 3 + 1] = R + Math.random() * 1.2;
      this.p[i * 3 + 2] = this.iz0 + R + Math.random() * (D - 2 * R);
    }
    // Spatial hash over the pit volume.
    this.cell = 2 * R;
    this.gx = Math.ceil(W / this.cell) + 1;
    this.gz = Math.ceil(D / this.cell) + 1;
    this.gy = 16;
    this.cells = this.gx * this.gy * this.gz;
    this.start = new Int32Array(this.cells + 1);
    this.order = new Int32Array(count);
    this.cid = new Int32Array(count);
    this.movers = [];

    const geo = new THREE.SphereGeometry(R, 12, 8);
    this.mesh = new THREE.InstancedMesh(geo, mat(0xffffff, { roughness: 0.35 }), count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) this.mesh.setColorAt(i, c.setHex(COLORS[i % COLORS.length]));
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    world.scene.add(this.mesh);

    for (let k = 0; k < 240; k++) this.step(1 / 60); // settle before the first frame
    this.writeMatrices();
  }

  contains(x, z) {
    return x > this.ix0 && x < this.ix1 && z > this.iz0 && z < this.iz1;
  }

  /** Throw balls up and out around a landing point. */
  splash(pos, radius, speed) {
    const p = this.p, v = this.v;
    const k = Math.min(1.6, 0.3 + speed * 0.18);
    for (let i = 0; i < this.n; i++) {
      const dx = p[i * 3] - pos.x, dz = p[i * 3 + 2] - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      const f = (1 - d / radius) * k;
      v[i * 3] += (dx / (d + 1e-4)) * f * 2.6 + rand(-0.4, 0.4);
      v[i * 3 + 1] += f * rand(3, 6);
      v[i * 3 + 2] += (dz / (d + 1e-4)) * f * 2.6 + rand(-0.4, 0.4);
    }
  }

  update(dt) {
    // Characters as pushing spheres: hips and chest.
    this.movers.length = 0;
    for (const ch of this.world.characters) {
      const x = ch.pos.x, z = ch.pos.z;
      if (x < this.ix0 - 0.4 || x > this.ix1 + 0.4 || z < this.iz0 - 0.4 || z > this.iz1 + 0.4 || ch.pos.y > 1.2) continue;
      this.movers.push([x, ch.pos.y + 0.3, z, 0.26, ch.vel.x, ch.vel.y, ch.vel.z]);
      this.movers.push([x, ch.pos.y + 0.7, z, 0.22, ch.vel.x, ch.vel.y, ch.vel.z]);
    }
    const h = Math.min(dt, 1 / 30) / 2;
    this.step(h);
    this.step(h);
    this.writeMatrices();
  }

  step(dt) {
    const { p, v, n } = this;
    const g = -9.8 * dt;
    const { ix0, ix1, iz0, iz1 } = this;
    for (let i = 0; i < n; i++) {
      const a = i * 3;
      v[a + 1] += g;
      v[a] *= 0.992; v[a + 2] *= 0.992;
      p[a] += v[a] * dt; p[a + 1] += v[a + 1] * dt; p[a + 2] += v[a + 2] * dt;
      if (p[a + 1] < R) { p[a + 1] = R; if (v[a + 1] < 0) v[a + 1] *= -0.25; v[a] *= 0.9; v[a + 2] *= 0.9; }
      // Walls only hold balls below the rim; one thrown higher can fly over and is put back.
      if (p[a] < ix0 + R) { p[a] = ix0 + R; v[a] = Math.abs(v[a]) * 0.3; }
      if (p[a] > ix1 - R) { p[a] = ix1 - R; v[a] = -Math.abs(v[a]) * 0.3; }
      if (p[a + 2] < iz0 + R) { p[a + 2] = iz0 + R; v[a + 2] = Math.abs(v[a + 2]) * 0.3; }
      if (p[a + 2] > iz1 - R) { p[a + 2] = iz1 - R; v[a + 2] = -Math.abs(v[a + 2]) * 0.3; }
      if (p[a + 1] > 3) v[a + 1] = Math.min(v[a + 1], 0);
      for (const m of this.movers) {
        const dx = p[a] - m[0], dy = p[a + 1] - m[1], dz = p[a + 2] - m[2];
        const rr = m[3] + R;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= rr * rr || d2 < 1e-10) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d, ny = dy / d, nz = dz / d;
        p[a] = m[0] + nx * rr; p[a + 1] = m[1] + ny * rr; p[a + 2] = m[2] + nz * rr;
        const push = Math.max(0, m[4] * nx + m[5] * ny + m[6] * nz);
        v[a] += nx * (push * 1.1 + 0.4); v[a + 1] += ny * (push * 1.1 + 0.4) + 0.05; v[a + 2] += nz * (push * 1.1 + 0.4);
      }
    }
    // Ball-ball contacts through a counting-sort spatial hash.
    const { gx, gy, gz, cell, start, order, cid } = this;
    start.fill(0);
    for (let i = 0; i < n; i++) {
      const a = i * 3;
      const cx = Math.min(gx - 1, Math.max(0, ((p[a] - ix0) / cell) | 0));
      const cy = Math.min(gy - 1, Math.max(0, (p[a + 1] / cell) | 0));
      const cz = Math.min(gz - 1, Math.max(0, ((p[a + 2] - iz0) / cell) | 0));
      const c = (cy * gz + cz) * gx + cx;
      cid[i] = c;
      start[c + 1]++;
    }
    for (let c = 0; c < this.cells; c++) start[c + 1] += start[c];
    const fill = this._fill || (this._fill = new Int32Array(this.cells));
    fill.set(start.subarray(0, this.cells));
    for (let i = 0; i < n; i++) order[fill[cid[i]]++] = i;
    const D = 2 * R, D2 = D * D;
    for (let i = 0; i < n; i++) {
      const a = i * 3;
      const c = cid[i];
      const cx = c % gx, cz = ((c / gx) | 0) % gz, cy = (c / (gx * gz)) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy; if (yy < 0 || yy >= gy) continue;
        for (let oz = -1; oz <= 1; oz++) {
          const zz = cz + oz; if (zz < 0 || zz >= gz) continue;
          for (let ox = -1; ox <= 1; ox++) {
            const xx = cx + ox; if (xx < 0 || xx >= gx) continue;
            const cc = (yy * gz + zz) * gx + xx;
            for (let k = start[cc]; k < start[cc + 1]; k++) {
              const j = order[k];
              if (j <= i) continue;
              const b = j * 3;
              const dx = p[b] - p[a], dy = p[b + 1] - p[a + 1], dz = p[b + 2] - p[a + 2];
              const d2 = dx * dx + dy * dy + dz * dz;
              if (d2 >= D2 || d2 < 1e-12) continue;
              const d = Math.sqrt(d2);
              const nx = dx / d, ny = dy / d, nz = dz / d;
              const pen = (D - d) * 0.5;
              p[a] -= nx * pen; p[a + 1] -= ny * pen; p[a + 2] -= nz * pen;
              p[b] += nx * pen; p[b + 1] += ny * pen; p[b + 2] += nz * pen;
              const rel = (v[b] - v[a]) * nx + (v[b + 1] - v[a + 1]) * ny + (v[b + 2] - v[a + 2]) * nz;
              if (rel < 0) {
                const j2 = -rel * 0.55;
                v[a] -= nx * j2; v[a + 1] -= ny * j2; v[a + 2] -= nz * j2;
                v[b] += nx * j2; v[b + 1] += ny * j2; v[b + 2] += nz * j2;
              }
            }
          }
        }
      }
    }
  }

  writeMatrices() {
    const arr = this.mesh.instanceMatrix.array;
    const p = this.p;
    for (let i = 0; i < this.n; i++) {
      const o = i * 16;
      arr[o] = 1; arr[o + 1] = 0; arr[o + 2] = 0; arr[o + 3] = 0;
      arr[o + 4] = 0; arr[o + 5] = 1; arr[o + 6] = 0; arr[o + 7] = 0;
      arr[o + 8] = 0; arr[o + 9] = 0; arr[o + 10] = 1; arr[o + 11] = 0;
      arr[o + 12] = p[i * 3]; arr[o + 13] = p[i * 3 + 1]; arr[o + 14] = p[i * 3 + 2]; arr[o + 15] = 1;
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
