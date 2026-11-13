// 月面おそうじ局 — 地形とホコリの地図（画面なし。テストからも使う）
export const SIZE = 256;          // 清掃エリアの一辺（m）。-128〜128
export const HALF = SIZE / 2;
export const TILES = 4;           // 4×4 の 16 地区
export const TILE_M = SIZE / TILES; // 1地区 64m
export const CELL = 0.25;         // ホコリのマス（m）
export const TN = TILE_M / CELL;  // 1地区 256×256 マス
export const GN = SIZE / CELL;    // 全体 1024×1024
export const CLEAN_F = 26;        // 残り率がこれ未満ならきれい（約10%）
export const KG = 0.0157;         // v0=255・残り100% のマスのホコリ(kg)

export const SECTORS = [
  'ススキ原', 'かぐや台地', '星見の丘', '北の霜原',
  'もちつき谷', 'うさぎ平原', '静けさの浜', '銀の入り江',
  '鏡の盆地', '晴れの海', 'あかつき原', 'まんまる谷',
  '果ての砂丘', 'つきみ岬', '月影の森跡', '南の大クレーター',
];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// クレーター（固定の配置）
const R = rng(20261113);
export const CRATERS = [];
for (let i = 0; i < 46; i++) {
  const big = i < 6;
  const r = big ? 9 + R() * 8 : 2 + R() * 6;
  const x = (R() * 2 - 1) * (HALF - r - 6), z = (R() * 2 - 1) * (HALF - r - 6);
  if (Math.hypot(x, z) < 18 + r) { i--; continue; }
  CRATERS.push({ x, z, r, d: r * (big ? 0.22 : 0.28) });
}
// 南の大クレーター（地区15）
CRATERS.push({ x: 96, z: 96, r: 22, d: 4.5 });

const n2 = (x, z) => Math.sin(x * 0.11 + Math.sin(z * 0.07) * 2) * Math.cos(z * 0.09 - Math.sin(x * 0.05)) ;
export function noise(x, z) { return n2(x, z) * 0.6 + n2(x * 2.3 + 7, z * 2.1 - 3) * 0.3 + n2(x * 5.1, z * 4.7 + 11) * 0.1; }

// 高さ（m）
export function height(x, z) {
  let h = noise(x * 0.6, z * 0.6) * 0.9 + noise(x * 2.2 + 40, z * 2.2) * 0.15;
  for (const c of CRATERS) {
    const dx = x - c.x, dz = z - c.z; const q = (dx * dx + dz * dz) / (c.r * c.r);
    if (q > 2.2) continue;
    const d = Math.sqrt(q);
    if (d < 1) h -= c.d * (1 - q);
    const e = (d - 1) / 0.17; h += c.d * 0.32 * Math.exp(-e * e);
  }
  const b = Math.hypot(x, z); if (b < 16) h *= Math.max(0, (b - 9) / 7); // 基地のまわりは平ら
  const edge = HALF - Math.max(Math.abs(x), Math.abs(z)); if (edge < 10) h *= Math.max(0, edge / 10);
  return h;
}

// 初めのホコリの濃さ 0〜255（クレーターの中ほど濃い）
export function dust0(x, z) {
  let v = 120 + noise(x * 1.3 + 9, z * 1.3) * 45 + noise(x * 6, z * 6) * 12;
  for (const c of CRATERS) {
    const dx = x - c.x, dz = z - c.z; const q = (dx * dx + dz * dz) / (c.r * c.r);
    if (q < 1) v += 95 * (1 - q);
  }
  const b = Math.hypot(x, z); if (b < 12) v *= 0.35 + 0.65 * b / 12;
  return Math.max(25, Math.min(255, v));
}

// 地区ごとのホコリの値段（$/kg）。外側ほど上質
export function sectorPrice(t) { const tx = t % 4, tz = (t / 4) | 0; const ring = Math.max(Math.abs(tx - 1.5), Math.abs(tz - 1.5)) > 1 ? 1 : 0; const corner = (tx === 0 || tx === 3) && (tz === 0 || tz === 3); return corner ? 12 : ring ? 8 : 5; }
export const sectorOf = (x, z) => { const tx = Math.min(3, Math.max(0, Math.floor((x + HALF) / TILE_M))), tz = Math.min(3, Math.max(0, Math.floor((z + HALF) / TILE_M))); return tz * 4 + tx; };
export const sectorCenter = t => ({ x: -HALF + (t % 4 + 0.5) * TILE_M, z: -HALF + (((t / 4) | 0) + 0.5) * TILE_M });

// ホコリの地図。v0 = 初めの濃さ, f = 残り率(0〜255), tex = 表示用(v0*f/255)
export function makeDust() {
  const v0 = [], f = [], tex = [], clean = new Int32Array(16), dirty = new Uint8Array(16), kg0 = new Float64Array(16);
  for (let t = 0; t < 16; t++) {
    const a = new Uint8Array(TN * TN), b = new Uint8Array(TN * TN).fill(255), c = new Uint8Array(TN * TN);
    const ox = -HALF + (t % 4) * TILE_M, oz = -HALF + ((t / 4) | 0) * TILE_M; let s = 0;
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) { const k = j * TN + i; const v = dust0(ox + (i + 0.5) * CELL, oz + (j + 0.5) * CELL); a[k] = v; c[k] = v; s += v; }
    v0.push(a); f.push(b); tex.push(c); kg0[t] = s / 255 * KG;
  }
  const D = { v0, f, tex, clean, dirty, kg0 };
  // 掃く：中心(x,z)・向き(dx,dz)・幅w・奥行きd の四角を、rate(1秒あたりの割合)×dt だけ減らす。とれた kg と地区ごとの重さを返す
  D.sweep = (x, z, dx, dz, w, d, rate, dt, out) => {
    const px = -dz, pz = dx; // 横向き
    const rx = Math.abs(px) * w / 2 + Math.abs(dx) * d / 2, rz = Math.abs(pz) * w / 2 + Math.abs(dz) * d / 2;
    const gx0 = Math.max(0, Math.floor((x - rx + HALF) / CELL)), gx1 = Math.min(GN - 1, Math.floor((x + rx + HALF) / CELL));
    const gz0 = Math.max(0, Math.floor((z - rz + HALF) / CELL)), gz1 = Math.min(GN - 1, Math.floor((z + rz + HALF) / CELL));
    const keep = Math.exp(-rate * dt); let got = 0;
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const cx = gx * CELL - HALF + CELL / 2 - x, cz = gz * CELL - HALF + CELL / 2 - z;
      if (Math.abs(cx * px + cz * pz) > w / 2 || Math.abs(cx * dx + cz * dz) > d / 2) continue;
      const t = (gz >> 8) * 4 + (gx >> 8), k = (gz & 255) * TN + (gx & 255);
      const F = D.f[t], old = F[k]; if (old === 0) continue;
      let nf = Math.floor(old * keep); if (nf < 4) nf = 0;
      if (nf === old) nf = old - 1;
      F[k] = nf; const v = D.v0[t][k];
      const kg = (old - nf) / 255 * v / 255 * KG; got += kg; if (out) out[t] = (out[t] || 0) + kg;
      D.tex[t][k] = (v * nf / 255) | 0; D.dirty[t] = 1;
      if (old >= CLEAN_F && nf < CLEAN_F) D.clean[t]++;
    }
    return got;
  };
  D.at = (x, z) => { const gx = Math.floor((x + HALF) / CELL), gz = Math.floor((z + HALF) / CELL); if (gx < 0 || gz < 0 || gx >= GN || gz >= GN) return 0; const t = (gz >> 8) * 4 + (gx >> 8), k = (gz & 255) * TN + (gx & 255); return D.tex[t][k]; };
  D.pct = t => t == null ? D.clean.reduce((a, b) => a + b, 0) / (16 * TN * TN) * 100 : D.clean[t] / (TN * TN) * 100;
  // セーブ：残り率を16段階にして連続長で圧縮
  D.save = () => {
    const out = [];
    for (let t = 0; t < 16; t++) { const F = D.f[t]; let cur = -1, run = 0; for (let k = 0; k < F.length; k++) { const q = F[k] === 255 ? 15 : (F[k] + 8) >> 4; if (q === cur && run < 4095) run++; else { if (run) out.push(cur, run); cur = q; run = 1; } } out.push(cur, run); }
    return encode(out);
  };
  D.load = str => {
    const arr = decode(str); if (!arr) return false; let t = 0, k = 0;
    D.clean.fill(0);
    for (let i = 0; i < arr.length && t < 16; i += 2) {
      const q = arr[i], run = arr[i + 1]; const val = q >= 15 ? 255 : q << 4;
      for (let r = 0; r < run; r++) { D.f[t][k] = val; D.tex[t][k] = (D.v0[t][k] * val / 255) | 0; if (val < CLEAN_F) D.clean[t]++; if (++k >= TN * TN) { D.dirty[t] = 1; t++; k = 0; if (t >= 16) break; } }
    }
    return true;
  };
  D.remainKg = t => { let s = 0; const F = D.f[t], V = D.v0[t]; for (let k = 0; k < F.length; k += 7) s += F[k] * V[k]; return s * 7 / 65025 * KG; };
  return D;
}

// 数字の列 → 文字列（base64 風。1組を3文字: q(4bit)+run(12bit)=16bit → 3×6bit）
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function encode(a) { let s = ''; for (let i = 0; i < a.length; i += 2) { const v = (a[i] << 12) | a[i + 1]; s += ABC[(v >> 12) & 63] + ABC[(v >> 6) & 63] + ABC[v & 63]; } return s; }
function decode(s) { if (typeof s !== 'string' || s.length % 3) return null; const out = []; for (let i = 0; i < s.length; i += 3) { const v = (ABC.indexOf(s[i]) << 12) | (ABC.indexOf(s[i + 1]) << 6) | ABC.indexOf(s[i + 2]); out.push(v >> 12, v & 4095); } return out; }

// 落とし物（ホコリの下にうまっている）
export const FINDS = (() => {
  const r = rng(777); const kinds = [
    ['🧤', 'だれかの手ぶくろ', 50], ['🧤', 'だれかの手ぶくろ', 50], ['🔧', '古いスパナ', 80], ['🔧', '古いスパナ', 80], ['🚩', '古いはた', 100], ['🚩', '古いはた', 100], ['🚩', '古いはた', 100],
    ['📷', '月面カメラ', 180], ['🪧', '記念プレート', 250], ['🪧', '記念プレート', 250], ['🛰️', '人工衛星のかけら', 400], ['🍡', 'うさぎのおもち', 500], ['💎', '月の宝石', 800], ['🗿', 'なぞの石像', 1200],
  ];
  return kinds.map(([ic, name, val], i) => { let x, z; do { x = (r() * 2 - 1) * (HALF - 8); z = (r() * 2 - 1) * (HALF - 8); } while (Math.hypot(x, z) < 30 + val / 20); return { id: i, ic, name, val, x, z }; });
})();
