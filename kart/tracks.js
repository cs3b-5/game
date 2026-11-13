// うぱカートGP — コース（画面なし。node でもCPUのテストに使う）
// 制御点 [x, 高さ, z]。閉じたループ。1m ごとに並べなおして使う
export const TRACKS = [
  {
    id: 'circuit', name: 'うぱうぱサーキット', sub: '晴れの草原。まずはここから', theme: 'day', width: 15, gravity: 1, laps: 3,
    pts: [[0, 0, 0], [70, 0, 0], [125, 0, 12], [160, 0, 52], [165, 3, 100], [140, 6, 140], [95, 7, 152], [55, 5, 138], [30, 2, 104], [-5, 0, 92], [-45, 0, 112], [-95, 0, 118], [-140, 1, 88], [-150, 2, 40], [-128, 1, 2], [-80, 0, -12], [-40, 0, -6]],
    boosts: [0.28, 0.62, 0.9], items: [0.18, 0.47, 0.76], jumps: [],
  },
  {
    id: 'moon', name: 'ムーンクレーター', sub: '重力が軽い。ジャンプ台で大ジャンプ', theme: 'moon', width: 16, gravity: 0.42, laps: 3,
    pts: [[0, 0, 0], [90, 0, -5], [150, 0, 20], [185, 6, 75], [175, 10, 135], [120, 10, 175], [60, 4, 170], [10, 0, 200], [-60, 0, 215], [-130, 6, 185], [-170, 12, 120], [-160, 8, 55], [-115, 2, 15], [-60, 0, 0]],
    boosts: [0.12, 0.45, 0.82], items: [0.24, 0.55, 0.88], jumps: [0.36, 0.7],
  },
  {
    id: 'city', name: 'ネオンシティ', sub: '夜の街。直角カーブと高架の橋', theme: 'night', width: 15, gravity: 1, laps: 3,
    pts: [[0, 0, 0], [80, 0, 0], [120, 0, 8], [134, 0, 40], [134, 0, 90], [122, 2, 122], [90, 8, 136], [40, 10, 138], [0, 8, 138], [-30, 3, 122], [-46, 0, 92], [-60, 0, 62], [-95, 0, 52], [-130, 0, 40], [-142, 0, 10], [-130, 0, -22], [-95, 0, -32], [-45, 0, -18]],
    boosts: [0.08, 0.36, 0.66], items: [0.2, 0.5, 0.8], jumps: [0.93],
  },
];

function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }

export function buildPath(tr, step = 1) {
  const P = tr.pts, n = P.length, dense = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[i], c = P[(i + 1) % n], d = P[(i + 2) % n];
    for (let k = 0; k < 60; k++) { const t = k / 60; dense.push([cr(a[0], b[0], c[0], d[0], t), cr(a[1], b[1], c[1], d[1], t), cr(a[2], b[2], c[2], d[2], t)]); }
  }
  // 弧長で 1m ごとに並べなおす
  const cum = [0]; for (let i = 1; i <= dense.length; i++) { const p = dense[i - 1], q = dense[i % dense.length]; cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[2] - p[2])); }
  const L = cum[cum.length - 1], N = Math.round(L / step);
  const x = new Float32Array(N), y = new Float32Array(N), z = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) { const s = i * L / N; while (cum[j + 1] < s) j++; const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1); const p = dense[j], q = dense[(j + 1) % dense.length]; x[i] = p[0] + (q[0] - p[0]) * f; y[i] = p[1] + (q[1] - p[1]) * f; z[i] = p[2] + (q[2] - p[2]) * f; }
  // ジャンプ台：手前で少し盛り上げて、その先をすとんと下げる
  for (const jf of tr.jumps || []) { const c = Math.floor(jf * N); for (let k = -14; k <= 0; k++) { const i = (c + k + N) % N; y[i] += 2.2 * (1 - Math.abs(k) / 14) ** 1.5 * (k > -14 ? 1 : 0); } }
  const tx = new Float32Array(N), tz = new Float32Array(N), rx = new Float32Array(N), rz = new Float32Array(N), curv = new Float32Array(N);
  for (let i = 0; i < N; i++) { const a = (i - 2 + N) % N, b = (i + 2) % N; let dx = x[b] - x[a], dz = z[b] - z[a]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; tx[i] = dx; tz[i] = dz; rx[i] = -dz; rz[i] = dx; }
  for (let i = 0; i < N; i++) { const a = (i - 6 + N) % N, b = (i + 6) % N; curv[i] = Math.atan2(tx[a] * tz[b] - tz[a] * tx[b], tx[a] * tx[b] + tz[a] * tz[b]); }
  const path = { N, L, x, y, z, tx, tz, rx, rz, curv, w: tr.width };
  // 近くの点をさがす（前回の番号のまわりだけ）
  path.nearest = (i0, px, pz, win = 25) => { let bi = i0, bd = 1e18; for (let k = -win; k <= win; k++) { const i = ((i0 + k) % N + N) % N; const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  path.nearestAll = (px, pz) => { let bi = 0, bd = 1e18; for (let i = 0; i < N; i++) { const d = (x[i] - px) ** 2 + (z[i] - pz) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
  // 横のずれ（右が+）
  path.lateral = (i, px, pz) => (px - x[i]) * rx[i] + (pz - z[i]) * rz[i];
  // その場所の高さ（道の上＝道の高さ、道の外はだんだん地面へ）
  path.groundY = (i, lat) => { const a = Math.abs(lat), hw = tr.width / 2; if (a <= hw + 4) return y[i]; return y[i] * Math.max(0, 1 - (a - hw - 4) / 14); };
  path.wrap = i => ((i % N) + N) % N;
  return path;
}
