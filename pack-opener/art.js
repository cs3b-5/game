// =============================================================
//  けものの星：カードの絵を描くエンジン
//  題材（モンスター・アイテム・魔法・風景）を「部品」で組み立て、
//  13種類の画風それぞれの描き方で Canvas に描く。
// =============================================================
(function (global) {
'use strict';
const W = 400, H = 300;

// ---------- 乱数・色 ----------
function rng(seed) { let s = (seed >>> 0) || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function rgb2hex(r, g, b) { return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); }
const light = (c, t) => mix(c, '#ffffff', t), dark = (c, t) => mix(c, '#000000', t);
function rgba(c, a) { const [r, g, b] = hex2rgb(c); return `rgba(${r},${g},${b},${a})`; }
function jitter(c, amt, r) { const [R, G, B] = hex2rgb(c); const d = (r() - .5) * amt; return rgb2hex(R + d, G + d * .9, B + d * .8); }
function canvas(w = W, h = H) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

// 値ノイズ
function noise2(seed) {
  const r = rng(seed), P = new Float32Array(256 * 256);
  for (let i = 0; i < P.length; i++) P[i] = r();
  const sm = t => t * t * (3 - 2 * t);
  return (x, y) => { const xi = Math.floor(x) & 255, yi = Math.floor(y) & 255, xf = x - Math.floor(x), yf = y - Math.floor(y);
    const a = P[yi * 256 + xi], b = P[yi * 256 + ((xi + 1) & 255)], c = P[((yi + 1) & 255) * 256 + xi], d = P[((yi + 1) & 255) * 256 + ((xi + 1) & 255)];
    const u = sm(xf), v = sm(yf); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
}
function fbm(n, x, y, oct = 4) { let s = 0, a = .5, f = 1; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); a *= .5; f *= 2; } return s; }

// ---------- 部品のパス ----------
function catmull(g, pts, closed) {
  const n = pts.length; if (n < 2) return;
  const P = i => closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))];
  g.moveTo(pts[0][0], pts[0][1]);
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    g.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  if (closed) g.closePath();
}
function trace(g, p) {
  g.beginPath();
  if (p.t === 'ell') g.ellipse(p.x, p.y, Math.max(.5, p.rx), Math.max(.5, p.ry), p.r || 0, 0, Math.PI * 2);
  else if (p.t === 'poly') { if (p.smooth) catmull(g, p.pts, true); else { g.moveTo(p.pts[0][0], p.pts[0][1]); for (let i = 1; i < p.pts.length; i++) g.lineTo(p.pts[i][0], p.pts[i][1]); g.closePath(); } }
  else if (p.t === 'line') { if (p.smooth !== false) catmull(g, p.pts, false); else { g.moveTo(p.pts[0][0], p.pts[0][1]); for (let i = 1; i < p.pts.length; i++) g.lineTo(p.pts[i][0], p.pts[i][1]); } }
}
function bbox(p) {
  if (p.t === 'ell') { const m = Math.max(p.rx, p.ry); return [p.x - m, p.y - m, m * 2, m * 2]; }
  if (p.t === 'eye' || p.t === 'glow') return [p.x - p.rad, p.y - p.rad, p.rad * 2, p.rad * 2];
  const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]), pad = p.w ? p.w / 2 : 0;
  const x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad; return [x0, y0, Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0];
}
// 部品の作り方の短縮
const E = (x, y, rx, ry, c, o = {}) => Object.assign({ t: 'ell', x, y, rx, ry, c }, o);
const PL = (pts, c, o = {}) => Object.assign({ t: 'poly', pts, c, smooth: true }, o);
const PS = (pts, c, o = {}) => Object.assign({ t: 'poly', pts, c, smooth: false }, o);
const LN = (pts, w, c, o = {}) => Object.assign({ t: 'line', pts, w, c }, o);
const EYE = (x, y, rad, iris, o = {}) => Object.assign({ t: 'eye', x, y, rad, iris }, o);
const GLOW = (x, y, rad, c, o = {}) => Object.assign({ t: 'glow', x, y, rad, c }, o);

// =============================================================
//  題材（部品の組み立て）
// =============================================================
// 炎・稲妻などの飾り
function flame(cx, cy, s, c1 = '#ff6a1a', c2 = '#ffd84a') {
  return [PL([[cx, cy - 40 * s], [cx + 14 * s, cy - 14 * s], [cx + 12 * s, cy + 4 * s], [cx, cy + 10 * s], [cx - 12 * s, cy + 4 * s], [cx - 14 * s, cy - 14 * s]], c1, { role: 'fx', glow: c1 }),
          PL([[cx, cy - 22 * s], [cx + 7 * s, cy - 6 * s], [cx, cy + 6 * s], [cx - 7 * s, cy - 6 * s]], c2, { role: 'fx' })];
}
function bolt(x, y, s, c = '#fff36a') { return PS([[x, y], [x - 10 * s, y + 26 * s], [x + 2 * s, y + 24 * s], [x - 8 * s, y + 52 * s], [x + 16 * s, y + 18 * s], [x + 4 * s, y + 20 * s], [x + 12 * s, y]], c, { role: 'fx', glow: c }); }
function leafAt(x, y, s, rot, c = '#4fb36a') { const r = rot, cs = Math.cos(r), sn = Math.sin(r); const P = (a, b) => [x + a * cs - b * sn, y + a * sn + b * cs]; return PL([P(0, 0), P(10 * s, -6 * s), P(22 * s, 0), P(10 * s, 6 * s)], c); }

// 中心線と太さから、手足や首のような「太さの変わる形」を作る
function limb(pts, ws) {
  const L = [], R = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = ws[i] / 2; L.push([pts[i][0] - dy * w, pts[i][1] + dx * w]); R.push([pts[i][0] + dy * w, pts[i][1] - dx * w]);
  }
  return L.concat(R.reverse());
}
// 羽ばたく鳥の翼（羽根を一枚ずつ並べる）
function featherWing(x, y, span, ang, c, side = 1, o = {}) {
  const P = [], cs = Math.cos(ang), sn = Math.sin(ang);
  const T = (u, v) => [x + (u * cs - v * sn) * side, y + u * sn + v * cs];
  // 腕の部分
  P.push(PL([T(0, -8), T(span * .45, -14), T(span * .9, -6), T(span * .9, 6), T(span * .4, 22), T(0, 14)], c, { role: 'feather', glow: o.glow }));
  // 風切り羽（長い羽）
  for (let i = 0; i < 9; i++) {
    const t = i / 8, bx = span * (.95 - t * .75), len = span * (.42 + (1 - Math.abs(t - .25)) * .18);
    const fa = (1.2 + t * .5) * (side > 0 ? 1 : 1);
    const base = T(bx, 4), tip = T(bx + Math.cos(fa) * len * .25, 4 + Math.sin(fa) * len);
    const mid = [(base[0] + tip[0]) / 2, (base[1] + tip[1]) / 2];
    const ln = Math.hypot(tip[0] - base[0], tip[1] - base[1]);
    P.push(E(mid[0], mid[1], ln / 2, span * .06, i % 2 ? c : dark(c, .12), { r: Math.atan2(tip[1] - base[1], tip[0] - base[0]), role: 'feather', glow: o.glow }));
  }
  // 雨覆い（短い羽）
  for (let i = 0; i < 7; i++) { const t = i / 6, bx = span * (.85 - t * .7); const p = T(bx, 14); P.push(E(p[0], p[1] + 6, span * .07, span * .14, light(c, .12), { r: ang * side + .3 * side, role: 'feather' })); }
  return P;
}
// コウモリのような翼（竜）
function batWing(x, y, span, c, o = {}) {
  const P = [], elbow = [x + span * .2, y - span * .5], hand = [x + span * .45, y - span * .78];
  const tips = [];
  const angs = [-1.25, -.55, .1, .7], lens = [.62, .7, .62, .5];
  for (let i = 0; i < 4; i++) tips.push([hand[0] + Math.cos(angs[i]) * span * lens[i], hand[1] + Math.sin(angs[i]) * span * lens[i]]);
  const mem = [[x - span * .02, y], elbow, hand, tips[0]];
  for (let i = 1; i < 4; i++) { const p = tips[i - 1], q = tips[i]; const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2; mem.push([mx + (hand[0] - mx) * .22, my + (hand[1] - my) * .22], q); }
  mem.push([x + span * .55, y + span * .02], [x + span * .3, y + span * .06]);
  P.push(PS(mem, o.mem || light(c, .15), { role: 'wing', alpha: .93 }));
  P.push(LN([[x, y], elbow, hand], span * .06, c, { role: 'body', smooth: false }));
  for (const t of tips) P.push(LN([hand, t], span * .022, dark(c, .25), { smooth: false }));
  P.push(PS([[hand[0] - 5, hand[1] + 2], [hand[0] - 4, hand[1] - 16], [hand[0] + 4, hand[1] - 2]], '#e8dcc0'));
  return P;
}
// ---- 四つ足（横向き、左を向く） ----
function quad(o) {
  const c = o.c, d = dark(c, .3), b = o.belly || light(c, .35), P = [];
  const sz = o.size || 1, X = x => 200 + (x - 200) * sz, Y = y => 255 - (255 - y) * sz, S = v => v * sz;
  const T = pts => pts.map(([x, y]) => [X(x), Y(y)]);
  const L = o.legs === 'short' ? 26 : o.legs === 'long' ? 74 : 50;
  const hoof = !!o.hoof, lw = hoof ? .75 : 1;
  const by = 252 - L - 26;                     // 胴の中心の高さ
  const longNeck = o.snout === 'horse' || o.neck === 'long';
  const hx = longNeck ? 120 : 132, hy = longNeck ? by - 62 : by - 38;
  const tw = o.tail === 'thin' ? 6 : 11;
  // 尻尾
  if (o.tail === 'bushy') P.push(PL(T([[272, by - 12], [306, by - 30], [334, by - 62], [350, by - 80], [344, by - 40], [326, by - 6], [292, by + 10]]), o.tailC || c, { role: 'fur' }));
  else if (o.tail === 'puff') P.push(E(X(284), Y(by - 10), S(13), S(12), o.tailC || light(c, .5), { role: 'fur' }));
  else if (o.tail === 'nine') { for (let i = 8; i >= 0; i--) { const a = -2.1 + i * .2, bx = 276, byy = by - 4, cv = .35; const cl = [[bx, byy], [bx + Math.cos(a + cv) * 40, byy + Math.sin(a + cv) * 44], [bx + Math.cos(a) * 80, byy + Math.sin(a) * 84], [bx + Math.cos(a - cv * .6) * 112, byy + Math.sin(a - cv * .6) * 108]]; P.push(PL(T(limb(cl, [14, 26, 24, 4])), i % 2 ? c : light(c, .18), { role: 'fur' })); } }
  else if (o.tail === 'spike') { P.push(PL(T(limb([[268, by - 6], [306, by + 8], [340, by - 4], [366, by - 30], [376, by - 52]], [30, 22, 14, 8, 3])), c, { role: o.scaly ? 'scale' : 'fur' })); P.push(PS(T([[372, by - 46], [392, by - 74], [384, by - 40], [394, by - 34], [376, by - 30]]), d)); }
  else if (o.tail !== 'none') P.push(PL(T(limb([[272, by - 10], [300, by - 20], [320, by - 46], [316, by - 72], [306, by - 80]], [tw * 1.4, tw, tw, tw * .8, tw * .5])), o.tailC || c, { role: 'fur' }));
  // 奥の足（少し暗く）
  const front = (dx, col, role) => { P.push(PL(T(limb([[166 + dx, by - 4], [162 + dx, by + 14], [160 + dx, by + L * .55 + 10], [161 + dx, 246]], [30 * lw, 24 * lw, 12 * lw, 11 * lw])), col, { role })); P.push(hoof ? PS(T([[150 + dx, 252], [172 + dx, 252], [170 + dx, 242], [153 + dx, 242]]), '#3a2e26', { role: 'metal' }) : E(X(156 + dx), Y(248), S(12), S(6), col, { role })); };
  const hind = (dx, col, role) => { P.push(PL(T(limb([[258 + dx, by - 8], [266 + dx, by + 14], [258 + dx, by + L * .45 + 10], [270 + dx, by + L * .75 + 12], [264 + dx, 246]], [46 * lw, 40 * lw, 18 * lw, 11 * lw, 10 * lw])), col, { role })); P.push(hoof ? PS(T([[252 + dx, 252], [274 + dx, 252], [272 + dx, 242], [255 + dx, 242]]), '#3a2e26', { role: 'metal' }) : E(X(258 + dx), Y(248), S(12), S(6), col, { role })); };
  const fr = o.scaly ? 'scale' : 'fur';
  hind(12, d, fr); front(14, d, fr);
  // 奥の翼
  if (o.wings === 'bat') P.push(...batWing(X(212), Y(by - 24), S(118), dark(o.wingC || c, .25), { mem: dark(o.wingC || c, .1) }).map(p => (p.alpha = .9, p)));
  else if (o.wings) P.push(...featherWing(X(208), Y(by - 22), S(118), -2.0, dark(o.wingC || c, .15), -1));
  // 胴
  P.push(PL(T([[150, by - 6], [164, by - 30], [200, by - 30], [236, by - 28], [264, by - 34], [288, by - 18], [292, by + 2], [278, by + 22], [240, by + 26], [200, by + 30], [164, by + 24]]), c, { role: fr }));
  P.push(PL(T([[166, by + 14], [200, by + 26], [244, by + 22], [230, by + 12], [196, by + 14]]), b, { role: fr, soft: true }));
  // 首
  P.push(PL(T(limb(longNeck ? [[176, by - 4], [150, by - 30], [132, by - 56], [hx + 6, hy + 4]] : [[176, by - 2], [156, by - 20], [hx + 8, hy + 4]], longNeck ? [62, 46, 36, 30] : [62, 48, 36])), c, { role: fr }));
  P.push(PL(T(longNeck ? [[148, by + 10], [134, by - 30], [126, hy + 22], [140, by - 26], [168, by + 10]] : [[150, by + 12], [138, hy + 26], [156, by - 6], [174, by + 14]]), b, { role: fr, soft: true }));
  // たてがみ
  if (o.mane === true) { const pts = []; for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, rr = i % 2 ? 42 : 58; pts.push([hx + 14 + Math.cos(a) * rr * 1.05, hy + 6 + Math.sin(a) * rr]); } P.push(PL(T(pts), o.maneC || dark(c, .2), { role: 'fur' })); }
  if (o.mane === 'horse') { const pts = longNeck ? [[hx + 10, hy - 18], [142, by - 64], [162, by - 40], [184, by - 26], [176, by - 12], [154, by - 28], [hx + 22, hy + 2]] : [[hx + 12, hy - 18], [170, by - 34], [196, by - 30], [170, by - 14], [hx + 20, hy]]; P.push(PL(T(pts), o.maneC || light(c, .5), { role: 'fur' })); }
  // 背中のトゲ（竜）
  if (o.spines) for (let i = 0; i < 7; i++) { const x = 182 + i * 18, y = by - 28; P.push(PS(T([[x - 7, y + 4], [x + 2, y - 16 + (i % 2) * 4], [x + 8, y + 4]]), o.spineC || d, { role: 'horn' })); }
  // 手前の足
  hind(0, c, fr); front(0, c, fr);
  if (o.claws) for (const x of [146, 248]) for (let k = 0; k < 3; k++) P.push(PS(T([[x + k * 7, 250], [x + k * 7 - 6, 256], [x + k * 7 + 3, 252]]), '#f0e8d8'));
  // 手前の翼
  if (o.wings === 'bat') P.push(...batWing(X(200), Y(by - 20), S(132), o.wingC || c, { mem: o.wingC ? light(o.wingC, .1) : light(c, .15) }));
  else if (o.wings) P.push(...featherWing(X(196), Y(by - 18), S(128), -1.95, o.wingC || light(c, .1), -1));
  // 頭
  const k = o.headS || 1, HX = v => X(hx + (v - hx) * k), HY = v => Y(hy + (v - hy) * k), HT = pts => pts.map(([x, y]) => [HX(x), HY(y)]);
  if (o.ears === 'long') { P.push(PL(HT(limb([[hx + 6, hy - 18], [hx + 2, hy - 46], [hx - 4, hy - 70]], [16, 18, 8])), c, { role: 'fur' })); P.push(PL(HT(limb([[hx + 20, hy - 16], [hx + 24, hy - 46], [hx + 30, hy - 68]], [16, 18, 8])), d, { role: 'fur' })); P.push(PL(HT(limb([[hx + 4, hy - 26], [hx + 1, hy - 46], [hx - 2, hy - 62]], [6, 8, 3])), '#ffb3c6', { soft: true })); }
  if (o.ears === 'tri' || o.ears === 'big') { const q = o.ears === 'big' ? 1.6 : 1; P.push(PS(HT([[hx + 14, hy - 16], [hx + 22 + 4 * q, hy - 20 - 24 * q], [hx + 32, hy - 8]]), d, { role: 'fur' })); P.push(PS(HT([[hx - 6, hy - 16], [hx - 2 + 2 * q, hy - 22 - 26 * q], [hx + 16, hy - 14]]), c, { role: 'fur' })); P.push(PS(HT([[hx - 1, hy - 18], [hx + 1 + 2 * q, hy - 18 - 18 * q], [hx + 10, hy - 16]]), o.earIn || mix(c, '#ffb3c6', .5), { soft: true })); }
  if (o.ears === 'round') { P.push(E(HX(hx + 22), HY(hy - 20), S(11 * k), S(11 * k), d, { role: 'fur' })); P.push(E(HX(hx), HY(hy - 22), S(11 * k), S(11 * k), c, { role: 'fur' })); }
  if (o.antlers) { const ac = o.antlerC || '#c9b48a'; for (const s of [16, 0]) { const bx = hx + 4 + s, byy = hy - 20; const A = (pts, w) => P.push(LN(HT(pts), S(w), s ? dark(ac, .2) : ac, { role: 'horn', taper: true })); A([[bx, byy], [bx - 4, byy - 30], [bx - 18, byy - 58], [bx - 30, byy - 74]], 7); A([[bx - 4, byy - 28], [bx + 14, byy - 50], [bx + 20, byy - 66]], 5); A([[bx - 14, byy - 50], [bx - 2, byy - 72]], 4); A([[bx - 10, byy - 40], [bx - 32, byy - 46]], 4); } }
  if (o.horns) { P.push(LN(HT([[hx + 18, hy - 16], [hx + 34, hy - 40], [hx + 58, hy - 48], [hx + 70, hy - 40]]), S(10), dark(o.hornC || '#e8dcc0', .2), { role: 'horn', taper: true })); P.push(LN(HT([[hx + 4, hy - 18], [hx + 16, hy - 46], [hx + 40, hy - 58], [hx + 52, hy - 52]]), S(10), o.hornC || '#e8dcc0', { role: 'horn', taper: true })); }
  // 頭の形
  const sn = o.snout || 'mid';
  if (sn === 'horse') {
    P.push(PL(HT([[hx + 24, hy - 16], [hx + 4, hy - 22], [hx - 18, hy - 10], [hx - 44, hy + 22], [hx - 56, hy + 40], [hx - 50, hy + 50], [hx - 34, hy + 50], [hx - 14, hy + 34], [hx + 16, hy + 24], [hx + 32, hy + 4]]), c, { role: fr }));
    P.push(E(HX(hx - 46), HY(hy + 42), S(11 * k), S(9 * k), light(c, .15), { role: fr, soft: true, r: .6 }));
    P.push(E(HX(hx - 52), HY(hy + 38), S(3 * k), S(2.4 * k), '#2a2320', { role: 'nose' }));
    P.push(LN(HT([[hx - 50, hy + 48], [hx - 38, hy + 47]]), S(1.5), dark(c, .5)));
    P.push(EYE(HX(hx - 2), HY(hy - 6), S(5.5 * k), o.eye || '#3a2a1a'));
  } else {
    const ml = sn === 'long' ? 44 : sn === 'flat' ? 16 : 30; // 鼻先の長さ
    P.push(E(HX(hx + 10), HY(hy), S(30 * k), S(27 * k), c, { role: fr }));
    P.push(PL(HT([[hx + 4, hy - 12], [hx - ml * .6, hy - 4], [hx - ml, hy + 6], [hx - ml + 2, hy + 14], [hx - ml * .5, hy + 20], [hx + 8, hy + 22]]), light(c, .1), { role: fr }));
    P.push(PL(HT([[hx - ml * .9, hy + 14], [hx - ml * .4, hy + 22], [hx + 10, hy + 22], [hx + 14, hy + 12], [hx - ml * .4, hy + 14]]), b, { role: fr, soft: true }));
    if (o.cheek) P.push(PL(HT([[hx + 26, hy + 2], [hx + 46, hy + 18], [hx + 30, hy + 20], [hx + 40, hy + 30], [hx + 14, hy + 26]]), b, { role: 'fur' }));
    P.push(PL(HT([[hx - ml - 2, hy + 3], [hx - ml + 8, hy + 2], [hx - ml + 7, hy + 10], [hx - ml + 1, hy + 11]]), '#2a2320', { role: 'nose', smooth: false }));
    P.push(LN(HT([[hx - ml + 2, hy + 16], [hx - ml * .5, hy + 18], [hx - ml * .2, hy + 16]]), S(1.6), dark(c, .55), { smooth: true }));
    if (o.tusk) P.push(LN(HT([[hx - ml * .5, hy + 18], [hx - ml - 4, hy + 6], [hx - ml - 8, hy - 8]]), S(6), '#f4ecd8', { role: 'horn', taper: true }));
    if (o.fangs) for (const dx of [0, 9]) P.push(PS(HT([[hx - ml * .6 + dx, hy + 17], [hx - ml * .6 + dx + 2, hy + 27], [hx - ml * .6 + dx + 5, hy + 17]]), '#fff'));
    if (o.whisk) for (const dy of [-1, 4]) P.push(LN(HT([[hx - ml * .6, hy + 12 + dy], [hx - ml - 22, hy + 8 + dy * 2.5]]), S(.9), 'rgba(255,255,255,.85)', { role: 'line' }));
    P.push(EYE(HX(hx - ml * .25 + 4), HY(hy - 4), S((sn === 'flat' ? 6.5 : 5.5) * k), o.eye || '#3a2a1a'));
  }
  if (o.horn) P.push(PS(HT([[hx - 14, hy - 18], [hx - 42, hy - 76], [hx - 2, hy - 24]]), o.hornC || '#f2e6b8', { role: 'horn', glow: o.hornGlow }));
  // 模様
  if (o.stripes) for (let i = 0; i < 6; i++) P.push(PS(T([[180 + i * 17, by - 30], [188 + i * 17, by - 28], [184 + i * 17, by - 4], [178 + i * 17, by + 2]]), o.stripeC || dark(c, .5), { role: 'mark' }));
  if (o.spots) { const r = rng(o.seed || 3); for (let i = 0; i < 12; i++) P.push(E(X(176 + r() * 96), Y(by - 22 + r() * 34), S(3 + r() * 4), S(2.5 + r() * 3), o.spotC || dark(c, .4), { role: 'mark' })); }
  if (o.cracks) for (let i = 0; i < 7; i++) { const x = 176 + i * 15; P.push(LN(T([[x, by - 26], [x + 6, by - 12], [x - 2, by], [x + 4, by + 12]]), S(2.5), o.cracks, { role: 'fx', glow: o.cracks, smooth: false })); }
  return P;
}
// ---- 鳥 ----
function bird(o) {
  const c = o.c, d = dark(c, .25), b = o.belly || light(c, .4), P = [];
  if (o.kind === 'owl') {
    P.push(LN([[110, 252], [300, 248]], 12, '#6b4a2e', { role: 'wood' }));
    P.push(E(200, 178, 58, 70, c, { role: 'feather' }));
    P.push(E(200, 196, 40, 48, b, { role: 'feather', soft: true }));
    P.push(PS([[156, 104], [150, 68], [178, 98]], d)); P.push(PS([[244, 104], [250, 68], [222, 98]], d));
    P.push(E(200, 118, 54, 44, c, { role: 'feather' }));
    P.push(E(182, 118, 22, 20, light(c, .45), { soft: true })); P.push(E(218, 118, 22, 20, light(c, .45), { soft: true }));
    P.push(EYE(182, 118, 12, o.eye || '#ffb020')); P.push(EYE(218, 118, 12, o.eye || '#ffb020'));
    P.push(PS([[194, 134], [200, 152], [206, 134]], '#d89a2a'));
    for (const x of [184, 216]) P.push(LN([[x - 6, 244], [x, 250], [x + 6, 244]], 3, '#d89a2a', { smooth: false }));
    return P;
  }
  if (o.kind === 'penguin') {
    P.push(E(200, 180, 52, 74, '#22242e', { role: 'feather' }));
    P.push(E(200, 196, 36, 56, '#f4f2ea', { role: 'feather', soft: true }));
    P.push(E(200, 112, 36, 34, '#22242e', { role: 'feather' }));
    P.push(E(200, 122, 24, 20, '#f4f2ea', { soft: true }));
    P.push(PL([[150, 160], [130, 210], [148, 214], [158, 176]], '#22242e')); P.push(PL([[250, 160], [270, 210], [252, 214], [242, 176]], '#22242e'));
    P.push(EYE(188, 112, 5, '#1a1a1a')); P.push(EYE(212, 112, 5, '#1a1a1a'));
    P.push(PS([[192, 124], [200, 134], [208, 124]], '#ffb020'));
    P.push(E(184, 252, 14, 5, '#ffb020')); P.push(E(216, 252, 14, 5, '#ffb020'));
    if (o.acc) P.push(...o.acc);
    return P;
  }
  const spread = o.spread;
  // 枝
  if (!spread) P.push(LN([[100, 238], [320, 230]], 12, '#6b4a2e', { role: 'wood' }));
  // 尾羽
  if (o.tail === 'long') { for (let i = 0; i < 5; i++) P.push(PL([[226, 196], [266 + i * 10, 236 + i * 6], [300 + i * 14, 272 - i * 4], [258 + i * 8, 228]], i % 2 ? (o.tailC || c) : light(o.tailC || c, .2), { role: 'feather', glow: o.tailGlow })); }
  else P.push(PL([[222, 196], [262, 256], [240, 262], [214, 214]], d, { role: 'feather' }));
  if (spread) {
    const wc = o.wingC || c;
    for (const s of [-1, 1]) { const pts = [[200, 140]]; for (let i = 0; i <= 6; i++) { const a = -1.3 + i * .22; pts.push([200 + s * Math.cos(a) * (150 - i * 6), 150 + Math.sin(a) * 110 - (i % 2) * 10]); } pts.push([200 + s * 40, 190]); P.push(PS(pts, s < 0 ? wc : dark(wc, .12), { role: 'feather', glow: o.tailGlow })); for (let i = 0; i < 5; i++) { const a = -1.1 + i * .25; P.push(LN([[200 + s * 30, 160], [200 + s * Math.cos(a) * 120, 150 + Math.sin(a) * 90]], 2, dark(wc, .3), { role: 'line' })); } }
  }
  P.push(E(206, 170, 40, 54, c, { role: 'feather', r: -.35 }));
  P.push(E(196, 184, 26, 36, b, { role: 'feather', r: -.35, soft: true }));
  if (!spread) P.push(E(222, 172, 26, 48, o.wingC || d, { role: 'feather', r: .25 }));
  P.push(E(178, 112, 30, 28, o.headC || c, { role: 'feather' }));
  if (o.crest) P.push(PS([[184, 88], [196, 56], [196, 86], [210, 66], [204, 94]], o.crestC || d, { role: 'feather', glow: o.tailGlow }));
  const hook = o.kind === 'eagle';
  P.push(PS(hook ? [[156, 104], [128, 112], [134, 126], [150, 118]] : [[156, 106], [134, 114], [156, 120]], o.beak || '#e0a020'));
  P.push(EYE(170, 106, 5.5, o.eye || '#2a1a0a'));
  if (o.white) P.push(E(178, 104, 30, 14, '#fff', { soft: true, r: 0 }));
  if (!spread) for (const x of [196, 216]) P.push(LN([[x, 220], [x + 2, 232]], 3, '#c08020', { smooth: false }));
  return P;
}
// ---- 魚・海の生き物 ----
function fish(o) {
  const c = o.c, d = dark(c, .3), P = [];
  if (o.kind === 'whale') {
    P.push(PL([[60, 170], [120, 120], [250, 112], [330, 140], [360, 132], [372, 108], [384, 150], [350, 160], [310, 196], [200, 214], [90, 204]], c, { role: 'body' }));
    P.push(PL([[80, 196], [200, 212], [300, 196], [200, 230]], light(c, .55), { role: 'body', soft: true }));
    for (let i = 0; i < 6; i++) P.push(LN([[100 + i * 22, 204], [110 + i * 24, 216]], 1.5, dark(c, .2), { role: 'line' }));
    P.push(PL([[170, 190], [150, 236], [196, 208]], d));
    P.push(EYE(108, 168, 5, '#1a1a1a'));
    return P;
  }
  if (o.kind === 'jelly') {
    for (let i = 0; i < 9; i++) { const x = 156 + i * 11; P.push(LN([[x, 150], [x + Math.sin(i) * 12, 190], [x - Math.sin(i) * 10, 230], [x + 6, 275]], 2.5, light(c, .3), { role: 'fx', alpha: .7, glow: c })); }
    P.push(PL([[130, 150], [150, 88], [200, 70], [250, 88], [270, 150], [240, 160], [200, 156], [160, 160]], c, { role: 'body', alpha: .75, glow: c }));
    P.push(E(200, 116, 40, 26, light(c, .5), { alpha: .5, soft: true }));
    P.push(EYE(186, 128, 4, '#1a1a1a')); P.push(EYE(214, 128, 4, '#1a1a1a'));
    return P;
  }
  if (o.kind === 'octo') {
    const s = o.size || 1, X = x => 200 + (x - 200) * s, Y = y => 160 + (y - 160) * s;
    for (let i = 0; i < 8; i++) { const a = Math.PI * (.08 + i / 7 * .84); const bx = 200 + Math.cos(a) * 30, pts = [[X(bx), Y(170)]]; for (let k = 1; k <= 4; k++) pts.push([X(200 + Math.cos(a) * (30 + k * 32) + Math.sin(k + i) * 14), Y(170 + Math.sin(a) * k * 26 + k * 6)]); P.push(LN(pts, 18 * s, i % 2 ? c : d, { role: 'body', taper: true })); }
    P.push(E(X(200), Y(118), 58 * s, 66 * s, c, { role: 'body' }));
    for (let i = 0; i < 6; i++) P.push(E(X(170 + i * 12), Y(90 + (i % 3) * 18), 4 * s, 4 * s, light(c, .3), { role: 'mark' }));
    P.push(EYE(X(178), Y(148), 9 * s, o.eye || '#ffd84a')); P.push(EYE(X(222), Y(148), 9 * s, o.eye || '#ffd84a'));
    return P;
  }
  // ふつうの魚
  const long = o.kind === 'eel';
  if (long) { P.push(LN([[60, 210], [120, 170], [190, 200], [260, 160], [330, 140]], 26, c, { role: 'body', taper: true, rev: true })); P.push(EYE(318, 136, 5, '#ffd84a')); for (let i = 0; i < 5; i++) P.push(bolt(100 + i * 50, 120 + (i % 2) * 20, .5)); return P; }
  P.push(PL([[284, 160], [338, 116], [326, 162], [340, 212]], o.finC || d, { role: 'fin' }));
  P.push(PL([[180, 120], [210, 84], [256, 112]], o.finC || d, { role: 'fin' }));
  P.push(PL([[100, 162], [150, 120], [230, 118], [290, 160], [230, 202], [150, 204]], c, { role: 'body' }));
  P.push(PL([[130, 172], [200, 196], [270, 170], [200, 202]], light(c, .4), { role: 'body', soft: true }));
  if (o.spots) { const r = rng(o.seed || 5); for (let i = 0; i < 7; i++) P.push(E(150 + r() * 120, 132 + r() * 54, 8 + r() * 10, 6 + r() * 8, o.spotC, { role: 'mark', r: r() * 3 })); }
  for (let i = 0; i < 6; i++) P.push(LN([[170 + i * 18, 136], [180 + i * 18, 160], [170 + i * 18, 186]], 1.2, d, { role: 'line', alpha: .5 }));
  P.push(PL([[190, 176], [214, 210], [222, 180]], o.finC || d, { role: 'fin' }));
  P.push(EYE(132, 154, 6, '#1a1a1a'));
  if (o.lure) { P.push(LN([[146, 124], [130, 84], [104, 80]], 2, d)); P.push(GLOW(102, 82, 9, o.lure)); }
  if (o.teeth) for (let i = 0; i < 5; i++) P.push(PS([[104 + i * 6, 166], [107 + i * 6, 174], [110 + i * 6, 166]], '#fff'));
  return P;
}
// ---- 竜・蛇 ----
function serpent(o) {
  const c = o.c, d = dark(c, .3), P = [], belly = o.belly || light(c, .4);
  if (o.kind === 'snake') {
    P.push(LN([[110, 250], [300, 252], [320, 222], [140, 220], [120, 196], [280, 192], [270, 166], [200, 150], [190, 110], [176, 92]], 24, c, { role: 'body', taper: true, rev: true, scales: true }));
    P.push(E(168, 86, 22, 15, c, { role: 'body', r: -.3 }));
    P.push(EYE(160, 80, 4.5, o.eye || '#ffd84a'));
    P.push(LN([[148, 94], [134, 100], [128, 96], [134, 104]], 1.8, '#d22', { smooth: false }));
    return P;
  }
  if (o.kind === 'east') {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push([360 - t * 270, 220 - Math.sin(t * Math.PI * 2.2) * 60 - t * 80]); }
    P.push(LN(pts, 34, c, { role: 'body', taper: true, scales: true }));
    for (let i = 1; i < 11; i++) { const [x, y] = pts[i]; P.push(PS([[x - 6, y - 14], [x, y - 32], [x + 6, y - 14]], o.finC || '#f2c14e', { role: 'fin' })); }
    for (const i of [3, 8]) { const [x, y] = pts[i]; P.push(LN([[x, y + 10], [x - 10, y + 32], [x - 18, y + 36]], 6, c, { taper: true })); }
    const [hx, hy] = pts[12];
    P.push(LN([[hx + 6, hy - 6], [hx + 30, hy - 40], [hx + 50, hy - 46]], 5, o.hornC || '#f2e6b8', { role: 'horn', taper: true }));
    P.push(LN([[hx - 4, hy - 8], [hx + 10, hy - 46], [hx + 26, hy - 56]], 5, o.hornC || '#f2e6b8', { role: 'horn', taper: true }));
    P.push(E(hx, hy, 28, 20, c, { role: 'body', r: -.2 }));
    P.push(E(hx - 22, hy + 6, 18, 11, light(c, .2), { r: -.1 }));
    P.push(LN([[hx - 30, hy + 8], [hx - 60, hy + 2], [hx - 80, hy + 20]], 2, o.whiskC || '#f2e6b8'));
    P.push(LN([[hx - 28, hy + 12], [hx - 54, hy + 30], [hx - 64, hy + 52]], 2, o.whiskC || '#f2e6b8'));
    P.push(EYE(hx - 6, hy - 6, 5.5, o.eye || '#ff3a2a'));
    if (o.pearl) P.push(GLOW(hx - 70, hy - 50, 14, o.pearl));
    return P;
  }
  // 西洋の竜（四つ足に翼）
  const q = quad({ c, belly, legs: 'mid', tail: 'spike', wings: 'bat', wingC: o.wingC || dark(c, .1), horns: true, hornC: o.hornC, snout: 'long', neck: 'long', ears: 'none', eye: o.eye || '#ffcc33', size: o.size || .95, cracks: o.cracks, scaly: true, spines: true, spineC: o.hornC, claws: true, fangs: true });
  if (o.breath) { for (let i = 0; i < 7; i++) q.push(GLOW(70 - i * 9, 128 + i * 3 + (i % 2) * 6, 10 + i * 2, i < 2 ? '#fff3a0' : o.breath)); }
  return q;
}
// ---- 虫 ----
function insect(o) {
  const c = o.c, d = dark(c, .35), P = [];
  if (o.kind === 'butterfly' || o.kind === 'moth') {
    const wc = o.wingC || c;
    for (const s of [-1, 1]) {
      P.push(E(200 + s * 62, 120, 62, 50, wc, { r: s * -.4, role: 'wing', alpha: .95 }));
      P.push(E(200 + s * 46, 192, 40, 36, dark(wc, .15), { r: s * .4, role: 'wing', alpha: .95 }));
      P.push(E(200 + s * 72, 116, 16, 14, o.spotC || '#fff', { role: 'mark' }));
      P.push(E(200 + s * 72, 116, 8, 7, d, { role: 'mark' }));
      P.push(E(200 + s * 48, 196, 10, 9, o.spotC || '#fff', { role: 'mark' }));
      P.push(LN([[200 + s * 10, 104], [200 + s * 30, 70], [200 + s * 40, 58]], 2, '#2a2320'));
    }
    P.push(E(200, 156, 9, 50, '#2a2320', { role: 'body' }));
    if (o.glowDust) for (let i = 0; i < 12; i++) P.push(GLOW(120 + i * 15, 230 + (i % 3) * 14, 3, o.glowDust));
    return P;
  }
  if (o.kind === 'dragonfly') {
    for (const [y, s] of [[124, -1], [138, 1]]) for (const k of [-1, 1]) P.push(E(200 + k * 70, y, 72, 14, light(c, .5), { r: k * s * -.12, role: 'wing', alpha: .55, glow: o.glow }));
    P.push(LN([[150, 132], [230, 132], [320, 140], [350, 146]], 10, c, { role: 'body', taper: true, segs: true }));
    P.push(E(140, 132, 16, 15, c, { role: 'body' }));
    P.push(EYE(134, 126, 9, o.eye || '#7fe6ff'));
    return P;
  }
  if (o.kind === 'mantis') {
    P.push(LN([[290, 246], [260, 196], [240, 150]], 8, c, { role: 'body', taper: true }));
    P.push(E(272, 214, 50, 16, c, { r: .9, role: 'body' }));
    for (const x of [236, 260]) P.push(LN([[x, 200], [x - 14, 228], [x - 18, 250]], 3, d, { smooth: false }));
    P.push(LN([[226, 140], [200, 106], [176, 100], [186, 130]], 8, c, { smooth: false }));
    P.push(LN([[234, 146], [214, 120], [196, 120], [204, 146]], 7, d, { smooth: false }));
    P.push(PS([[220, 96], [246, 92], [236, 120]], c, { role: 'body' }));
    P.push(EYE(222, 98, 5, '#2a5a1a')); P.push(EYE(244, 96, 5, '#2a5a1a'));
    P.push(LN([[226, 92], [196, 50]], 1.5, d)); P.push(LN([[240, 90], [236, 46]], 1.5, d));
    return P;
  }
  // カブトムシ
  for (const x of [170, 200, 230]) { P.push(LN([[x, 200], [x - 16, 226], [x - 22, 250]], 4, '#2a2320', { smooth: false })); }
  P.push(E(220, 176, 70, 40, c, { role: 'shell' }));
  P.push(LN([[220, 138], [220, 214]], 2, d, { role: 'line' }));
  P.push(E(140, 182, 26, 22, d, { role: 'shell' }));
  P.push(LN([[128, 176], [100, 150], [92, 112], [104, 104]], 9, d, { role: 'shell', taper: true }));
  if (o.fx === 'fire') P.push(...flame(220, 150, .7));
  P.push(EYE(132, 178, 3.5, '#ff4a2a'));
  return P;
}
// ---- 精霊・不思議な生き物 ----
function spirit(o) {
  const c = o.c, d = dark(c, .3), P = [];
  if (o.kind === 'slime') {
    P.push(PL([[120, 246], [126, 196], [160, 150], [200, 136], [242, 152], [276, 198], [282, 246]], c, { role: 'body', alpha: o.alpha || .9, glow: o.glow }));
    P.push(E(170, 168, 18, 10, '#fff', { alpha: .55, r: -.5, soft: true }));
    P.push(EYE(182, 196, 7, '#1a1a1a')); P.push(EYE(222, 196, 7, '#1a1a1a'));
    P.push(LN([[192, 218], [202, 224], [212, 218]], 3, '#1a1a1a'));
    if (o.fx) P.push(...o.fx);
    return P;
  }
  if (o.kind === 'mushroom') {
    P.push(PL([[176, 250], [172, 180], [228, 180], [224, 250]], '#f4ecd8', { role: 'body' }));
    P.push(PL([[110, 182], [130, 120], [200, 96], [270, 120], [290, 182], [200, 196]], c, { role: 'cap' }));
    const r = rng(o.seed || 9); for (let i = 0; i < 7; i++) P.push(E(140 + r() * 120, 120 + r() * 50, 8 + r() * 8, 6 + r() * 6, '#fff6e8', { role: 'mark' }));
    P.push(EYE(186, 216, 5, '#1a1a1a')); P.push(EYE(214, 216, 5, '#1a1a1a'));
    P.push(LN([[195, 230], [200, 234], [205, 230]], 2, '#1a1a1a'));
    return P;
  }
  if (o.kind === 'golem') {
    const rc = c, r = rng(o.seed || 4);
    const rock = (cx, cy, rx, ry) => { const pts = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; pts.push([cx + Math.cos(a) * rx * (.8 + r() * .3), cy + Math.sin(a) * ry * (.8 + r() * .3)]); } return PS(pts, jitter(rc, 30, r), { role: 'rock' }); };
    P.push(rock(160, 230, 26, 22), rock(240, 230, 26, 22));
    P.push(rock(200, 170, 70, 54));
    P.push(rock(118, 160, 26, 40), rock(282, 160, 26, 40));
    P.push(rock(200, 96, 36, 30));
    if (o.moss) for (let i = 0; i < 10; i++) P.push(E(150 + r() * 100, 130 + r() * 30, 14, 6, o.moss, { role: 'moss', r: r() }));
    P.push(GLOW(188, 94, 6, o.eye || '#7fffd4')); P.push(GLOW(212, 94, 6, o.eye || '#7fffd4'));
    for (let i = 0; i < 4; i++) P.push(LN([[170 + i * 20, 150], [176 + i * 20, 170], [168 + i * 20, 190]], 2, o.eye || '#7fffd4', { role: 'fx', glow: o.eye || '#7fffd4', smooth: false }));
    return P;
  }
  if (o.kind === 'treant') {
    for (let i = 0; i < 5; i++) { const a = -2.6 + i * .5; P.push(LN([[200, 120], [200 + Math.cos(a) * 70, 120 + Math.sin(a) * 60], [200 + Math.cos(a) * 110, 110 + Math.sin(a) * 90]], 10 - i % 2 * 3, '#6b4a2e', { role: 'wood', taper: true })); }
    const r = rng(o.seed || 6);
    for (let i = 0; i < 14; i++) P.push(E(110 + r() * 180, 40 + r() * 80, 26 + r() * 18, 20 + r() * 14, jitter(c, 40, r), { role: 'leaf' }));
    P.push(PL([[160, 252], [176, 180], [170, 110], [230, 110], [224, 180], [244, 252]], '#7a5434', { role: 'wood' }));
    P.push(LN([[150, 252], [130, 260]], 8, '#6b4a2e')); P.push(LN([[250, 252], [272, 262]], 8, '#6b4a2e'));
    P.push(E(186, 160, 9, 12, '#2a1a10')); P.push(E(214, 160, 9, 12, '#2a1a10'));
    P.push(GLOW(186, 160, 4, '#c8ff8a')); P.push(GLOW(214, 160, 4, '#c8ff8a'));
    P.push(LN([[186, 196], [200, 204], [214, 196]], 4, '#2a1a10'));
    return P;
  }
  if (o.kind === 'ghost') {
    P.push(PL([[140, 250], [130, 150], [160, 100], [200, 88], [240, 100], [270, 150], [262, 250], [244, 232], [224, 252], [202, 232], [180, 252], [160, 232]], c, { role: 'body', alpha: .85, glow: o.glow }));
    P.push(E(182, 150, 10, 14, '#1a1020')); P.push(E(218, 150, 10, 14, '#1a1020'));
    P.push(E(200, 186, 12, 8, '#1a1020'));
    return P;
  }
  if (o.kind === 'crystal') {
    const r = rng(o.seed || 8);
    const shard = (x, y, w, h, t) => PS([[x - w, y], [x - w * .8, y - h], [x, y - h - w], [x + w * .8, y - h], [x + w, y]], jitter(c, 40, r), { role: 'gem', glow: c, tilt: t });
    P.push(shard(150, 252, 18, 70), shard(250, 252, 20, 90), shard(200, 252, 30, 140), shard(118, 252, 12, 40), shard(282, 252, 12, 46));
    P.push(GLOW(200, 150, 18, light(c, .6)));
    return P;
  }
  if (o.kind === 'wisp') {
    for (let i = 0; i < 5; i++) P.push(GLOW(140 + i * 30, 140 + Math.sin(i * 1.7) * 40, 10 + (i % 2) * 8, c));
    P.push(GLOW(200, 150, 34, c));
    P.push(E(200, 150, 22, 22, light(c, .7), { alpha: .9 }));
    P.push(EYE(192, 148, 3.5, '#1a1a1a')); P.push(EYE(208, 148, 3.5, '#1a1a1a'));
    return P;
  }
  return P;
}
// ---- アイテム ----
function item(o) {
  const c = o.c, P = [];
  if (o.kind === 'sword') {
    P.push(GLOW(200, 120, 70, o.glow || light(c, .4), { alpha: .5 }));
    P.push(PS([[196, 30], [210, 50], [214, 200], [186, 200], [190, 50]], o.blade || '#d9e2ea', { role: 'metal', glow: o.glow }));
    P.push(LN([[200, 50], [200, 192]], 3, dark(o.blade || '#d9e2ea', .3), { smooth: false }));
    if (o.fx === 'bolt') P.push(bolt(190, 60, 1.2), bolt(214, 100, .8));
    P.push(PS([[150, 200], [250, 200], [244, 214], [156, 214]], c, { role: 'metal' }));
    P.push(LN([[200, 214], [200, 262]], 14, '#4a2a1a', { smooth: false, role: 'wrap' }));
    P.push(E(200, 268, 12, 12, c, { role: 'metal' }));
    P.push(E(200, 207, 6, 6, o.gem || '#ff3a5a', { role: 'gem', glow: o.gem || '#ff3a5a' }));
    return P;
  }
  if (o.kind === 'staff') {
    P.push(LN([[180, 270], [200, 160], [214, 70]], 9, '#7a5434', { role: 'wood' }));
    for (let i = 0; i < 6; i++) P.push(leafAt(214 + Math.cos(i) * 20, 80 + Math.sin(i) * 16, 1, i * 1.1, i % 2 ? '#4fb36a' : '#7bd36a'));
    P.push(LN([[214, 70], [190, 50], [214, 30], [240, 50], [214, 70]], 4, '#9a7a4a'));
    P.push(GLOW(214, 48, 26, o.glow || '#c8ff8a'));
    P.push(E(214, 48, 12, 12, light(o.glow || '#c8ff8a', .5), { role: 'gem' }));
    return P;
  }
  if (o.kind === 'crown') {
    P.push(GLOW(200, 160, 90, o.glow || '#fff3c0', { alpha: .5 }));
    P.push(PS([[120, 210], [116, 120], [150, 160], [174, 96], [200, 150], [226, 96], [250, 160], [284, 120], [280, 210]], c, { role: 'metal' }));
    P.push(PS([[118, 200], [282, 200], [282, 222], [118, 222]], dark(c, .15), { role: 'metal' }));
    for (const [x, y, gc] of [[200, 172, '#ff3a5a'], [160, 186, '#3a8aff'], [240, 186, '#3aff9a'], [174, 98, '#fff'], [226, 98, '#fff'], [200, 211, '#ff3a5a']]) P.push(E(x, y, 7, 7, gc, { role: 'gem', glow: gc }));
    return P;
  }
  if (o.kind === 'potion') {
    P.push(GLOW(200, 190, 70, o.liquid, { alpha: .5 }));
    P.push(PL([[186, 70], [186, 120], [140, 170], [146, 246], [254, 246], [260, 170], [214, 120], [214, 70]], '#dfeff6', { role: 'glass', alpha: .55 }));
    P.push(PL([[146, 180], [180, 168], [220, 176], [254, 172], [252, 244], [148, 244]], o.liquid, { role: 'liquid', glow: o.liquid, alpha: .9 }));
    P.push(PS([[182, 52], [218, 52], [216, 74], [184, 74]], '#a07a52', { role: 'wood' }));
    for (let i = 0; i < 6; i++) P.push(E(170 + i * 12, 200 + (i % 3) * 14, 3 + i % 2 * 2, 3 + i % 2 * 2, light(o.liquid, .6), { alpha: .8 }));
    P.push(E(166, 150, 6, 26, '#fff', { alpha: .45, r: .5 }));
    return P;
  }
  if (o.kind === 'book') {
    P.push(GLOW(200, 160, 80, o.glow || '#b07aff', { alpha: .45 }));
    P.push(PS([[120, 220], [200, 236], [280, 220], [280, 110], [200, 126], [120, 110]], '#f0e6cc', { role: 'paper' }));
    P.push(PS([[114, 226], [200, 244], [286, 226], [286, 232], [200, 252], [114, 232]], c, { role: 'cover' }));
    for (let i = 0; i < 6; i++) { P.push(LN([[134, 134 + i * 14], [188, 144 + i * 14]], 1.5, '#8a7a5a', { smooth: false })); P.push(LN([[212, 144 + i * 14], [266, 134 + i * 14]], 1.5, '#8a7a5a', { smooth: false })); }
    P.push(LN(circlePts(200, 70, 30, 24), 2.5, o.glow || '#b07aff', { role: 'fx', glow: o.glow || '#b07aff', smooth: false }));
    P.push(PS(starPts(200, 70, 26, 10, 5), o.glow || '#b07aff', { role: 'fx', glow: o.glow || '#b07aff', alpha: .7 }));
    return P;
  }
  return P;
}
function circlePts(cx, cy, r, n) { const p = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } return p; }
function starPts(cx, cy, R, r, n, rot = -Math.PI / 2) { const p = []; for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * Math.PI * 2, rr = i % 2 ? r : R; p.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); } return p; }
// ---- 魔法 ----
function spell(o) {
  const c = o.c, P = [];
  const ring = (cx, cy, r, w, col, alpha = 1) => LN(circlePts(cx, cy, r, 64), w, col, { role: 'fx', glow: col, smooth: false, alpha });
  if (o.kind !== 'abyss') { P.push(ring(200, 240, 120, 3, c, .8)); P.push(ring(200, 240, 96, 2, c, .7)); P.push(LN(starPts(200, 240, 96, 96, 6).concat([[200 + 96 * Math.cos(-Math.PI / 2), 240 + 96 * Math.sin(-Math.PI / 2)]]), 2, c, { role: 'fx', glow: c, smooth: false, alpha: .7 })); }
  if (o.kind === 'meteor') for (let i = 0; i < 5; i++) { const x = 120 + i * 50, y = 40 + (i % 2) * 50; P.push(LN([[x + 90, y - 70], [x, y]], 10 - i, light(c, .4), { role: 'fx', glow: c, taper: true, rev: true, alpha: .8 })); P.push(GLOW(x, y, 16 - i, '#fff3a0')); }
  if (o.kind === 'wave') { for (let k = 0; k < 3; k++) { const pts = []; for (let i = 0; i <= 10; i++) pts.push([30 + i * 34, 200 - k * 40 - Math.sin(i * .9 + k) * 26]); P.push(LN(pts, 18 - k * 4, k ? light(c, .3 * k) : c, { role: 'fx', alpha: .9 })); } P.push(PL([[60, 200], [140, 60], [220, 30], [300, 70], [250, 90], [200, 80], [140, 140]], c, { role: 'fx', alpha: .85, glow: c })); }
  if (o.kind === 'bloom') { const r = rng(7); for (let i = 0; i < 9; i++) { const x = 60 + r() * 280, y = 60 + r() * 170; const pts = []; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; pts.push([x + Math.cos(a) * 18, y + Math.sin(a) * 18]); } P.push(PL(pts, ['#ff8ab6', '#ffd84a', '#fff', '#c77dff'][i % 4], { role: 'petal' })); P.push(E(x, y, 6, 6, '#ffb020')); } for (let i = 0; i < 5; i++) P.push(LN([[200, 250], [120 + i * 40, 140], [100 + i * 50, 60]], 4, '#3f8a45', { taper: true })); }
  if (o.kind === 'thunder') { P.push(bolt(180, 10, 3.6)); P.push(bolt(110, 40, 1.6)); P.push(bolt(290, 30, 2)); }
  if (o.kind === 'abyss') { for (let i = 0; i < 8; i++) P.push(ring(200, 150, 20 + i * 14, 6 - i * .5, mix(c, '#000', i / 9), 1 - i / 10)); P.push(E(200, 150, 26, 26, '#000')); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; P.push(LN([[200 + Math.cos(a) * 150, 150 + Math.sin(a) * 120], [200 + Math.cos(a + .6) * 70, 150 + Math.sin(a + .6) * 60], [200 + Math.cos(a + 1.2) * 30, 150 + Math.sin(a + 1.2) * 28]], 2, light(c, .4), { role: 'fx', glow: c, alpha: .7 })); } }
  if (o.kind === 'judgement') { for (let i = 0; i < 5; i++) P.push(PS([[160 + i * 22, 0], [176 + i * 22, 0], [190 + i * 10, 240], [182 + i * 10, 240]], '#fff6c8', { role: 'fx', glow: '#fff6c8', alpha: .6 })); P.push(PS(starPts(200, 70, 34, 12, 8), '#fff', { glow: '#fff3a0' })); }
  return P;
}

// ---- 風景の目印（フィールドカード） ----
function landmark(o) {
  const P = [], c = o.c || '#8a8a9a';
  if (o.kind === 'temple') {
    P.push(PS([[90, 250], [310, 250], [310, 236], [90, 236]], c, { role: 'rock' }));
    for (let i = 0; i < 6; i++) P.push(PS([[104 + i * 36, 236], [122 + i * 36, 236], [122 + i * 36, 130], [104 + i * 36, 130]], light(c, .1), { role: 'rock' }));
    P.push(PS([[84, 130], [316, 130], [200, 76]], c, { role: 'rock' }));
    P.push(GLOW(200, 110, 12, o.glow || '#7fffd4'));
    for (let i = 0; i < 5; i++) P.push(LN([[60 + i * 70, 260], [66 + i * 70, 220], [56 + i * 70, 190]], 5, '#2a8a6a', { role: 'leaf', taper: true }));
  }
  if (o.kind === 'castle') {
    P.push(PS([[120, 250], [280, 250], [280, 150], [120, 150]], c, { role: 'rock' }));
    for (const [x, w, h] of [[110, 30, 150], [260, 30, 160], [180, 40, 190]]) { P.push(PS([[x, 250], [x + w, 250], [x + w, 250 - h], [x, 250 - h]], dark(c, .1), { role: 'rock' })); P.push(PS([[x - 6, 250 - h], [x + w + 6, 250 - h], [x + w / 2, 250 - h - 40]], dark(c, .35), { role: 'rock' })); }
    for (let i = 0; i < 7; i++) P.push(E(140 + (i % 4) * 36, 180 + (i / 4 | 0) * 34, 4, 7, '#ffd84a', { glow: '#ffb020' }));
    P.push(PL([[290, 70], [300, 60], [312, 66], [322, 58], [318, 72], [304, 72]], '#1a1020'));
  }
  if (o.kind === 'island') {
    P.push(PL([[100, 170], [300, 170], [270, 210], [220, 270], [180, 260], [130, 210]], '#8a6a4a', { role: 'rock' }));
    P.push(E(200, 168, 104, 16, '#7bd36a', { role: 'leaf' }));
    P.push(PS([[180, 166], [180, 110], [196, 96], [212, 110], [212, 166]], '#f4f0ff', { role: 'rock' }));
    P.push(PS([[176, 110], [216, 110], [196, 76]], '#ffb0d0', { role: 'rock' }));
    for (let i = 0; i < 4; i++) P.push(LN([[150 + i * 30, 230], [154 + i * 30, 270], [146 + i * 30, 300]], 3, '#6ab0e0', { role: 'fx', alpha: .6 }));
    P.push(E(130, 150, 22, 16, '#3f8a45', { role: 'leaf' })); P.push(E(268, 152, 20, 14, '#3f8a45', { role: 'leaf' }));
  }
  if (o.kind === 'bigtree') {
    P.push(PL([[170, 260], [184, 190], [180, 120], [222, 120], [216, 190], [234, 260]], '#6b4a2e', { role: 'wood' }));
    const r = rng(12); for (let i = 0; i < 18; i++) P.push(E(90 + r() * 220, 30 + r() * 100, 30 + r() * 20, 22 + r() * 14, jitter('#3f8a45', 50, r), { role: 'leaf' }));
    for (let i = 0; i < 8; i++) P.push(GLOW(80 + i * 34, 200 + (i % 3) * 18, 4, '#d8ff8a'));
  }
  if (o.kind === 'volcano') { for (let i = 0; i < 5; i++) P.push(GLOW(100 + i * 12, 60 - i * 8, 6 + i, '#ff8a2a')); P.push(...flame(120, 110, 1.1)); }
  if (o.kind === 'plains') { for (let i = 0; i < 3; i++) P.push(bolt(80 + i * 110, 10 + (i % 2) * 20, 1.6 + i * .3)); for (let i = 0; i < 16; i++) P.push(LN([[i * 26, 300], [i * 26 + 4, 262], [i * 26 + 12, 250]], 3, '#5a6a3a', { taper: true })); }
  return P;
}
// 題材の振り分け
function figureFor(sub) {
  switch (sub.k) {
    case 'quad': return quad(sub);
    case 'bird': return bird(sub);
    case 'fish': return fish(sub);
    case 'serpent': return serpent(sub);
    case 'insect': return insect(sub);
    case 'spirit': return spirit(sub);
    case 'item': return item(sub);
    case 'spell': return spell(sub);
    case 'land': return landmark(sub);
    default: return [];
  }
}

// =============================================================
//  背景（場所）
// =============================================================
const SCENES = {
  meadow:  { sky: ['#8fd0ff', '#e9f7ff'], far: '#9ec7a8', mid: '#7fb36a', near: '#5f9a4a', ground: '#6aa84f', sun: '#fff6c0' },
  volcano: { sky: ['#3a1410', '#ff7a3a'], far: '#5a2a24', mid: '#3a1a14', near: '#2a120c', ground: '#3a1a10', sun: '#ffb070', lava: true },
  sea:     { sky: ['#6ab8f0', '#d8f0ff'], far: '#7aa8c8', mid: '#3a8ac8', near: '#2a6aa8', ground: '#e8d8a0', sun: '#fffbe0', water: true },
  deep:    { sky: ['#041a3a', '#0a5a8a'], far: '#0a3a5a', mid: '#082a48', near: '#06203a', ground: '#0a2a3a', rays: '#7fd8ff', bubbles: true },
  forest:  { sky: ['#cfeec0', '#f4fbe8'], far: '#7ab08a', mid: '#4a8a5a', near: '#2f6a3a', ground: '#4a7a3a', sun: '#fffbd0', trees: true },
  storm:   { sky: ['#2a2a40', '#7a7a9a'], far: '#4a4a62', mid: '#3a3a50', near: '#2a2a3a', ground: '#3a3a44', flash: '#fff6a0' },
  night:   { sky: ['#06061a', '#2a2050'], far: '#1a1838', mid: '#141030', near: '#0e0a22', ground: '#100c20', moon: '#f0ecff', stars: true },
  heaven:  { sky: ['#5e9ef0', '#ffd6ec'], far: '#b8cdf4', mid: '#d6d0f2', near: '#ecdcf0', ground: '#e2d4ec', sun: '#fffbe0', clouds: true },
  cave:    { sky: ['#1a1410', '#3a2a20'], far: '#2a2018', mid: '#201810', near: '#16100a', ground: '#2a1e14', glowSpots: true },
  space:   { sky: ['#02030a', '#141a40'], far: '#0a0e24', mid: '#060816', near: '#04050e', ground: '#04050e', stars: true, nebula: true },
};
function ridge(n, y0, amp, freq, seed) { const pts = []; for (let x = -10; x <= W + 10; x += 8) pts.push([x, y0 - fbm(n, x * freq + seed, seed * .37, 3) * amp]); return pts; }
function fillRidge(g, pts, col) { g.beginPath(); g.moveTo(-10, H + 10); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(W + 10, H + 10); g.closePath(); g.fillStyle = col; g.fill(); }
function paintScene(g, name, seed, mode) {
  const S = SCENES[name] || SCENES.meadow, n = noise2(seed), r = rng(seed + 1);
  const flat = mode === 'flat';
  // 空
  if (flat) { g.fillStyle = mix(S.sky[0], S.sky[1], .5); g.fillRect(0, 0, W, H); }
  else { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, S.sky[0]); gr.addColorStop(1, S.sky[1]); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  if (S.nebula && !flat) for (let i = 0; i < 4; i++) { const x = r() * W, y = r() * H * .7, rad = 80 + r() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, rgba(['#7a3aff', '#ff4fa0', '#3a8aff', '#3affd0'][i], .35)); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  if (S.stars) for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${.3 + r() * .7})`; const s = r() < .06 ? 2 : 1; g.fillRect(r() * W, r() * H * .75, s, s); }
  if (S.sun && !flat) { const gr = g.createRadialGradient(300, 70, 0, 300, 70, 140); gr.addColorStop(0, rgba(S.sun, .95)); gr.addColorStop(.12, rgba(S.sun, .8)); gr.addColorStop(1, rgba(S.sun, 0)); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
  if (S.moon) { g.fillStyle = S.moon; g.beginPath(); g.arc(300, 70, 28, 0, 7); g.fill(); if (!flat) { g.fillStyle = rgba(S.moon, .12); g.beginPath(); g.arc(300, 70, 60, 0, 7); g.fill(); } }
  if (S.clouds) for (let i = 0; i < 9; i++) { const x = r() * W, y = 40 + r() * 140; g.fillStyle = rgba('#ffffff', flat ? 1 : .8); for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + k * 18 - 36, y + Math.sin(k) * 6, 26, 16, 0, 0, 7); g.fill(); } }
  if (S.rays && !flat) for (let i = 0; i < 6; i++) { const x = 60 + i * 60 + r() * 30; const gr = g.createLinearGradient(x, 0, x - 40, H); gr.addColorStop(0, rgba(S.rays, .25)); gr.addColorStop(1, rgba(S.rays, 0)); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 10, 0); g.lineTo(x + 14, 0); g.lineTo(x - 30, H); g.lineTo(x - 70, H); g.fill(); }
  // 山・丘（奥ほど霞む）
  const haze = S.sky[1];
  fillRidge(g, ridge(n, 150, 70, .008, 1), flat ? S.far : mix(S.far, haze, .35));
  if (S.lava) { const pts = ridge(n, 120, 30, .004, 9).map(([x, y]) => [x, y + Math.abs(x - 120) * .5]); fillRidge(g, pts, flat ? '#4a1a10' : mix('#4a1a10', haze, .2)); g.fillStyle = '#ffb040'; g.beginPath(); g.ellipse(120, 112, 26, 7, 0, 0, 7); g.fill(); if (!flat) { const gr = g.createRadialGradient(120, 100, 0, 120, 100, 110); gr.addColorStop(0, 'rgba(255,170,60,.6)'); gr.addColorStop(1, 'rgba(255,100,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 240); } for (let i = 0; i < 4; i++) { g.strokeStyle = '#ff7a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(120 + i * 8 - 12, 116); g.quadraticCurveTo(130 + i * 20, 170, 110 + i * 30, 230); g.stroke(); } }
  fillRidge(g, ridge(n, 190, 50, .012, 2), flat ? S.mid : mix(S.mid, haze, .15));
  if (S.water) { g.fillStyle = flat ? S.mid : mix(S.mid, '#ffffff', .05); g.fillRect(0, 190, W, H); if (!flat) for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(r() * W, 195 + r() * 100, 12 + r() * 20, 1.5); } }
  if (S.trees) for (let i = 0; i < 26; i++) { const x = r() * W, y = 170 + r() * 50, h = 40 + r() * 50; g.fillStyle = flat ? S.near : mix(S.near, haze, (230 - y) / 200); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + h * .3, y); g.lineTo(x - h * .3, y); g.fill(); }
  if (S.flash && !flat) { g.strokeStyle = rgba(S.flash, .85); g.lineWidth = 2.5; g.shadowColor = S.flash; g.shadowBlur = 14; g.beginPath(); let x = 80, y = 0; g.moveTo(x, y); while (y < 170) { x += (r() - .5) * 30; y += 14 + r() * 10; g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0; }
  // 地面
  const gy = 236;
  if (flat) { g.fillStyle = S.ground; g.fillRect(0, gy, W, H - gy); }
  else { const gr = g.createLinearGradient(0, gy, 0, H); gr.addColorStop(0, mix(S.ground, haze, .2)); gr.addColorStop(1, dark(S.ground, .25)); g.fillStyle = gr; g.fillRect(0, gy, W, H - gy); for (let i = 0; i < 260; i++) { g.fillStyle = rgba(r() < .5 ? dark(S.ground, .3) : light(S.ground, .25), .35); g.fillRect(r() * W, gy + r() * (H - gy), 2 + r() * 4, 1); } }
  if (S.bubbles) for (let i = 0; i < 26; i++) { g.strokeStyle = 'rgba(200,240,255,.5)'; g.lineWidth = 1; g.beginPath(); g.arc(r() * W, r() * H, 2 + r() * 5, 0, 7); g.stroke(); }
  if (S.glowSpots) for (let i = 0; i < 14; i++) { const x = r() * W, y = r() * H; const gr = g.createRadialGradient(x, y, 0, x, y, 14); gr.addColorStop(0, 'rgba(127,230,255,.7)'); gr.addColorStop(1, 'rgba(127,230,255,0)'); g.fillStyle = gr; g.fillRect(x - 14, y - 14, 28, 28); }
}

// =============================================================
//  描き方（画風）
// =============================================================
function shadeFill(g, p) {
  const [x, y, w, h] = bbox(p);
  const gr = g.createRadialGradient(x + w * .32, y + h * .22, Math.max(w, h) * .05, x + w * .45, y + h * .45, Math.max(w, h) * .85);
  gr.addColorStop(0, light(p.c, .38)); gr.addColorStop(.5, p.c); gr.addColorStop(1, dark(p.c, .42));
  return gr;
}
function drawEye(g, p, mode) {
  g.save();
  if (mode === 'flat' || mode === 'outline') { g.fillStyle = '#111'; g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x - p.rad * .3, p.y - p.rad * .3, p.rad * .3, 0, 7); g.fill(); g.restore(); return; }
  g.fillStyle = '#f4efe6'; g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.fill();
  const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rad * .9); gr.addColorStop(0, light(p.iris, .3)); gr.addColorStop(1, dark(p.iris, .4));
  g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, p.rad * .85, 0, 7); g.fill();
  g.fillStyle = '#0a0806'; g.beginPath(); g.ellipse(p.x, p.y, p.rad * .38, p.rad * .62, 0, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x - p.rad * .35, p.y - p.rad * .35, p.rad * .26, 0, 7); g.fill();
  g.globalAlpha = .6; g.beginPath(); g.arc(p.x + p.rad * .3, p.y + p.rad * .3, p.rad * .12, 0, 7); g.fill();
  g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 1; g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.stroke();
  g.restore();
}
function drawGlow(g, p, k = 1) {
  const gr = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rad * 2.4 * k);
  gr.addColorStop(0, rgba('#ffffff', (p.alpha ?? 1) * .95)); gr.addColorStop(.25, rgba(p.c, (p.alpha ?? 1) * .8)); gr.addColorStop(1, rgba(p.c, 0));
  g.fillStyle = gr; g.fillRect(p.x - p.rad * 2.4 * k, p.y - p.rad * 2.4 * k, p.rad * 4.8 * k, p.rad * 4.8 * k);
}
// 太さが変わる線（尻尾・竜の体など）
function strokeTaper(g, p, colorFn) {
  const pts = p.pts, n = pts.length;
  // 曲線を細かく分けてから円をつなぐ
  const fine = [];
  for (let i = 0; i < n - 1; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)]; for (let t = 0; t < 1; t += .08) { const t2 = t * t, t3 = t2 * t; fine.push([.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), .5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); } }
  fine.push(pts[n - 1]);
  const m = fine.length;
  for (let i = 0; i < m; i++) {
    const t = i / (m - 1), k = p.rev ? .35 + .65 * Math.sin(Math.min(1, t * 1.15) * Math.PI * .5 + .2) : 1 - t * .82;
    const r = p.w / 2 * (p.taper ? k : 1);
    g.fillStyle = colorFn(fine[i][0], fine[i][1], r, t);
    g.beginPath(); g.arc(fine[i][0], fine[i][1], Math.max(.6, r), 0, 7); g.fill();
  }
  return fine;
}
// ---- リアル寄りの厚塗り ----
function renderReal(g, parts, opt) {
  const r = rng(opt.seed + 11);
  // 影
  g.save(); g.filter = 'blur(8px)'; g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(205, 252, 120, 14, 0, 0, 7); g.fill(); g.restore();
  for (const p of parts) {
    g.save();
    g.globalAlpha = p.alpha ?? 1;
    if (p.glow) { g.shadowColor = p.glow; g.shadowBlur = 18; }
    if (p.t === 'eye') { g.restore(); drawEye(g, p, 'real'); continue; }
    if (p.t === 'glow') { g.restore(); drawGlow(g, p); continue; }
    if (p.t === 'line') {
      if (p.taper || p.rev) { strokeTaper(g, p, (x, y, rad) => { const gr = g.createRadialGradient(x - rad * .4, y - rad * .5, 0, x, y, rad * 1.1); gr.addColorStop(0, light(p.c, .3)); gr.addColorStop(1, dark(p.c, .35)); return gr; }); }
      else { trace(g, p); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = p.c; g.lineWidth = p.w; g.stroke(); g.shadowBlur = 0; if (p.w > 3) { g.save(); g.translate(-p.w * .12, -p.w * .18); trace(g, p); g.strokeStyle = rgba(light(p.c, .45), .45); g.lineWidth = p.w * .35; g.stroke(); g.restore(); } }
      if (p.scales) { g.restore(); continue; }
      g.restore(); continue;
    }
    trace(g, p);
    g.fillStyle = p.soft ? p.c : shadeFill(g, p);
    g.fill();
    g.shadowBlur = 0;
    // 質感
    if (['fur', 'feather', 'scale', 'body', 'rock', 'wood', 'leaf', 'cap', 'shell', 'metal', 'gem'].includes(p.role)) {
      g.save(); trace(g, p); g.clip();
      const [x, y, w, h] = bbox(p), cx = x + w / 2, cy = y + h / 2;
      if (p.role === 'fur' || p.role === 'feather') {
        const cnt = Math.min(900, w * h / (p.role === 'fur' ? 14 : 24));
        for (let i = 0; i < cnt; i++) { const px = x + r() * w, py = y + r() * h; const a = Math.atan2(py - cy, px - cx) * .6 + (p.role === 'fur' ? Math.PI * .5 : Math.PI * .7) + (r() - .5) * .6; const len = p.role === 'fur' ? 4 + r() * 6 : 6 + r() * 8; const sh = ((px - x) / w + (py - y) / h) / 2; g.strokeStyle = rgba(sh < .45 ? light(p.c, .35) : dark(p.c, .35), .35); g.lineWidth = p.role === 'fur' ? .9 : 1.4; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke(); }
      } else if (p.role === 'scale' || p.role === 'body' && opt.scaly) {
        for (let yy = y; yy < y + h; yy += 7) for (let xx = x + ((yy / 7) % 2) * 5; xx < x + w; xx += 10) { g.strokeStyle = rgba(dark(p.c, .45), .35); g.lineWidth = 1; g.beginPath(); g.arc(xx, yy, 5, 0, Math.PI); g.stroke(); }
      } else if (p.role === 'rock') {
        for (let i = 0; i < 40; i++) { g.fillStyle = rgba(r() < .5 ? dark(p.c, .4) : light(p.c, .3), .4); g.fillRect(x + r() * w, y + r() * h, 2 + r() * 5, 1 + r() * 3); }
      } else if (p.role === 'wood') {
        for (let i = 0; i < 18; i++) { g.strokeStyle = rgba(dark(p.c, .4), .4); g.lineWidth = 1; g.beginPath(); const xx = x + r() * w; g.moveTo(xx, y); g.lineTo(xx + (r() - .5) * 8, y + h); g.stroke(); }
      } else if (p.role === 'metal' || p.role === 'gem' || p.role === 'shell' || p.role === 'cap') {
        const gr = g.createLinearGradient(x, y, x + w, y + h); gr.addColorStop(.25, 'rgba(255,255,255,0)'); gr.addColorStop(.4, 'rgba(255,255,255,.55)'); gr.addColorStop(.5, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x, y, w, h);
      }
      g.restore();
      // 縁の光
      g.save(); trace(g, p); g.strokeStyle = rgba('#ffffff', .18); g.lineWidth = 1.5; g.stroke(); g.restore();
    }
    g.restore();
  }
}
// ---- のっぺり塗り（ドット絵・ステンドグラスなどの下地） ----
function renderFlat(g, parts, opt = {}) {
  for (const p of parts) {
    g.save(); g.globalAlpha = Math.max(.6, p.alpha ?? 1);
    if (p.t === 'eye') { g.restore(); drawEye(g, p, 'flat'); continue; }
    if (p.t === 'glow') { g.fillStyle = light(p.c, .5); g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.fill(); g.restore(); continue; }
    if (p.t === 'line') { if (p.taper || p.rev) strokeTaper(g, p, () => p.c); else { trace(g, p); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = p.c; g.lineWidth = Math.max(1.5, p.w); g.stroke(); } g.restore(); continue; }
    trace(g, p); g.fillStyle = p.c; g.fill();
    if (opt.outline) { g.strokeStyle = opt.outline; g.lineWidth = opt.ow || 2; g.lineJoin = 'round'; g.stroke(); }
    g.restore();
  }
}
// ---- 輪郭だけ（ネオン・スケッチ・墨絵・星座など） ----
function forOutlines(parts, fn) { for (const p of parts) fn(p); }

const STYLES = {};
// 1. リアル寄りの厚塗り
STYLES.real = (g, c, o) => { paintScene(g, c.scene, c.seed, 'real'); renderReal(g, figureFor(c.sub), c); vignette(g, .45); grain(g, c.seed, 10); };
// 2. 油絵（厚塗りを筆跡に置き換える）
STYLES.oil = (g, c) => {
  const base = canvas(); const b = base.getContext('2d'); paintScene(b, c.scene, c.seed, 'real'); renderReal(b, figureFor(c.sub), c);
  const data = b.getImageData(0, 0, W, H).data, n = noise2(c.seed), r = rng(c.seed + 3);
  g.drawImage(base, 0, 0); g.globalAlpha = .7;
  for (let i = 0; i < 7000; i++) {
    const x = r() * W | 0, y = r() * H | 0, k = (y * W + x) * 4;
    const a = n(x * .02, y * .02) * Math.PI * 2, len = 3 + r() * 6;
    g.strokeStyle = `rgb(${data[k]},${data[k + 1]},${data[k + 2]})`; g.lineWidth = 1.5 + r() * 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x - Math.cos(a) * len / 2, y - Math.sin(a) * len / 2); g.lineTo(x + Math.cos(a) * len / 2, y + Math.sin(a) * len / 2); g.stroke();
  }
  g.globalAlpha = 1; canvasTex(g, c.seed, .05); vignette(g, .35);
};
// 3. 水彩
STYLES.water = (g, c) => {
  g.fillStyle = '#fbf8f0'; g.fillRect(0, 0, W, H);
  const bg = canvas(); paintScene(bg.getContext('2d'), c.scene, c.seed, 'real');
  g.save(); g.globalAlpha = .55; g.filter = 'blur(3px) saturate(.8)'; g.drawImage(bg, 0, 0); g.restore();
  const parts = figureFor(c.sub), r = rng(c.seed);
  for (const p of parts) {
    if (p.t === 'eye') { drawEye(g, p, 'flat'); continue; }
    if (p.t === 'glow') { drawGlow(g, p, .8); continue; }
    for (let k = 0; k < 3; k++) {
      g.save(); g.globalAlpha = .28; g.filter = `blur(${1 + k}px)`; g.translate((r() - .5) * 4, (r() - .5) * 4);
      if (p.t === 'line') { if (p.taper || p.rev) strokeTaper(g, p, () => p.c); else { trace(g, p); g.strokeStyle = p.c; g.lineWidth = p.w; g.lineCap = 'round'; g.stroke(); } }
      else { trace(g, p); g.fillStyle = k === 2 ? light(p.c, .2) : p.c; g.fill(); }
      g.restore();
    }
    if (p.t !== 'line') { g.save(); trace(g, p); g.strokeStyle = rgba(dark(p.c, .35), .45); g.lineWidth = 1.2; g.stroke(); g.restore(); }
  }
  // 鉛筆の下描き線
  g.save(); g.strokeStyle = 'rgba(80,70,60,.35)'; g.lineWidth = .8;
  for (const p of parts) if (p.t === 'ell' || p.t === 'poly') { trace(g, p); g.stroke(); }
  g.restore();
  paper(g, c.seed, .18);
};
// 4. 浮世絵
STYLES.ukiyo = (g, c) => {
  g.fillStyle = '#efe2c4'; g.fillRect(0, 0, W, H);
  const gr = g.createLinearGradient(0, 0, 0, 120); gr.addColorStop(0, '#2a4a7a'); gr.addColorStop(1, 'rgba(42,74,122,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, 120);
  g.fillStyle = '#d9502a'; g.beginPath(); g.arc(320, 64, 24, 0, 7); g.fill();
  // 山
  g.fillStyle = '#6a8aa8'; g.beginPath(); g.moveTo(10, 210); g.lineTo(110, 110); g.lineTo(130, 118); g.lineTo(150, 108); g.lineTo(250, 210); g.fill();
  g.fillStyle = '#f6f0e2'; g.beginPath(); g.moveTo(110, 110); g.lineTo(130, 118); g.lineTo(150, 108); g.lineTo(166, 124); g.lineTo(140, 132); g.lineTo(118, 126); g.lineTo(96, 126); g.fill();
  // 青海波
  for (let row = 0; row < 5; row++) for (let i = -1; i < 14; i++) { const x = i * 32 + (row % 2) * 16, y = 220 + row * 18; for (let k = 3; k > 0; k--) { g.fillStyle = k % 2 ? '#2a4a7a' : '#e6dcc4'; g.beginPath(); g.arc(x, y, k * 6, Math.PI, 0); g.fill(); } }
  renderFlat(g, figureFor(c.sub), { outline: '#2a2018', ow: 3 });
  // 落款
  g.fillStyle = '#c8322a'; g.fillRect(352, 236, 30, 40); g.fillStyle = '#efe2c4'; g.font = '700 20px serif'; g.textAlign = 'center'; g.fillText(c.stamp || '星', 367, 263);
  paper(g, c.seed, .12);
};
// 5. ドット絵
STYLES.pixel = (g, c) => {
  const s = 5, sm = canvas(W / s, H / s), q = sm.getContext('2d');
  q.scale(1 / s, 1 / s); paintScene(q, c.scene, c.seed, 'flat'); renderFlat(q, figureFor(c.sub), { outline: '#1a1420', ow: 6 });
  // 色数を減らす
  const id = q.getImageData(0, 0, sm.width, sm.height), d = id.data;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] / 48) * 48;
  q.putImageData(id, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(sm, 0, 0, W, H); g.imageSmoothingEnabled = true;
};
// 6. ネオン
STYLES.neon = (g, c) => {
  g.fillStyle = '#0a0418'; g.fillRect(0, 0, W, H);
  const sun = g.createLinearGradient(0, 40, 0, 170); sun.addColorStop(0, '#ffd84a'); sun.addColorStop(1, '#ff3a9a'); g.fillStyle = sun; g.beginPath(); g.arc(200, 170, 80, Math.PI, 0); g.fill();
  g.fillStyle = '#0a0418'; for (let i = 0; i < 6; i++) g.fillRect(100, 110 + i * 11, 200, 2 + i);
  g.strokeStyle = '#ff2fd0'; g.lineWidth = 1.5; g.shadowColor = '#ff2fd0'; g.shadowBlur = 8;
  for (let i = 0; i < 9; i++) { const y = 175 + i * i * 2.2; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let i = -10; i <= 10; i++) { g.beginPath(); g.moveTo(200 + i * 14, 172); g.lineTo(200 + i * 70, H); g.stroke(); }
  const cols = ['#3af0ff', '#ff4fd8', '#fff36a', '#7aff7a'];
  const parts = figureFor(c.sub);
  parts.forEach((p, i) => {
    g.save();
    const col = p.glow || cols[i % 4];
    if (p.t === 'eye') { g.fillStyle = '#fff'; g.shadowColor = col; g.shadowBlur = 12; g.beginPath(); g.arc(p.x, p.y, p.rad * .8, 0, 7); g.fill(); g.restore(); return; }
    if (p.t === 'glow') { drawGlow(g, Object.assign({}, p, { c: col })); g.restore(); return; }
    trace(g, p); g.strokeStyle = col; g.lineWidth = p.t === 'line' ? Math.min(4, p.w * .5) : 2.5; g.shadowColor = col; g.shadowBlur = 14; g.lineCap = 'round'; g.lineJoin = 'round';
    if (p.t !== 'line') { g.fillStyle = 'rgba(10,4,24,.85)'; g.fill(); }
    g.stroke(); g.lineWidth = 1; g.strokeStyle = '#fff'; g.shadowBlur = 4; g.stroke();
    g.restore();
  });
  g.shadowBlur = 0; scanlines(g);
};
// 7. 切り絵
STYLES.paper = (g, c) => {
  const S = SCENES[c.scene] || SCENES.meadow, n = noise2(c.seed);
  g.fillStyle = mix(S.sky[0], S.sky[1], .6); g.fillRect(0, 0, W, H);
  const layers = [[120, mix(S.far, '#ffffff', .2)], [160, S.far], [200, S.mid], [236, S.near]];
  layers.forEach(([y, col], i) => { g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 10; g.shadowOffsetY = 4; fillRidge(g, ridge(n, y, 40, .01, i + 3), col); g.restore(); });
  const parts = figureFor(c.sub);
  for (const p of parts) {
    g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.shadowOffsetX = 2; g.shadowOffsetY = 3;
    if (p.t === 'eye') { g.restore(); drawEye(g, p, 'flat'); continue; }
    if (p.t === 'glow') { g.fillStyle = light(p.c, .5); g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.fill(); g.restore(); continue; }
    if (p.t === 'line') { if (p.taper || p.rev) strokeTaper(g, p, () => p.c); else { trace(g, p); g.strokeStyle = p.c; g.lineWidth = p.w; g.lineCap = 'round'; g.stroke(); } g.restore(); continue; }
    trace(g, p); g.fillStyle = p.c; g.fill(); g.restore();
  }
  paper(g, c.seed, .2);
};
// 8. ステンドグラス
STYLES.glass = (g, c) => {
  const base = canvas(); const b = base.getContext('2d'); paintScene(b, c.scene, c.seed, 'flat'); renderFlat(b, figureFor(c.sub));
  const data = b.getImageData(0, 0, W, H).data, r = rng(c.seed + 5);
  // 絵のある所は細かく、空は大きくガラスを割る
  const mask = canvas(); const mg = mask.getContext('2d'); renderFlat(mg, figureFor(c.sub)); const md = mg.getImageData(0, 0, W, H).data;
  const sx = [], sy = [];
  while (sx.length < 140) { sx.push(r() * W); sy.push(r() * H); }
  let tries = 0; while (sx.length < 520 && tries++ < 20000) { const x = r() * W, y = r() * H; if (md[((y | 0) * W + (x | 0)) * 4 + 3] > 0) { sx.push(x); sy.push(y); } }
  const N = sx.length;
  // 形の境目に種を足してくっきりさせる
  const id = g.createImageData(W, H), d = id.data, owner = new Int16Array(W * H);
  const cell = new Array(N).fill(0).map(() => [0, 0, 0, 0]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let best = 0, bd = 1e9; for (let i = 0; i < N; i++) { const dx = x - sx[i], dy = y - sy[i], dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = i; } } owner[y * W + x] = best; const k = (y * W + x) * 4; const cc = cell[best]; cc[0] += data[k]; cc[1] += data[k + 1]; cc[2] += data[k + 2]; cc[3]++; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = owner[y * W + x], k = (y * W + x) * 4, cc = cell[o];
    const edge = (x > 0 && owner[y * W + x - 1] !== o) || (y > 0 && owner[(y - 1) * W + x] !== o);
    if (edge) { d[k] = 30; d[k + 1] = 26; d[k + 2] = 30; }
    else { const boost = 1.25; d[k] = Math.min(255, cc[0] / cc[3] * boost); d[k + 1] = Math.min(255, cc[1] / cc[3] * boost); d[k + 2] = Math.min(255, cc[2] / cc[3] * boost); }
    d[k + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  g.save(); g.strokeStyle = '#1e1a1e'; g.lineWidth = 3.5; g.lineJoin = 'round';
  for (const p of figureFor(c.sub)) { if (p.t === 'ell' || p.t === 'poly') { trace(g, p); g.stroke(); } else if (p.t === 'eye') { g.fillStyle = '#1e1a1e'; g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.fill(); } }
  g.restore();
  // ガラスの光
  const gr = g.createRadialGradient(200, 100, 10, 200, 150, 260); gr.addColorStop(0, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1e1a1e'; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
};
// 9. 鉛筆スケッチ
STYLES.sketch = (g, c) => {
  g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, W, H);
  const r = rng(c.seed);
  g.strokeStyle = 'rgba(60,56,50,.25)'; g.lineWidth = .8; for (let i = 0; i < 10; i++) { g.beginPath(); g.moveTo(0, 240 + i * 4); g.lineTo(W, 238 + i * 4 + r() * 3); g.stroke(); }
  const parts = figureFor(c.sub);
  for (const p of parts) {
    if (p.t === 'eye') { g.fillStyle = '#2a2622'; g.beginPath(); g.arc(p.x, p.y, p.rad * .8, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x - p.rad * .3, p.y - p.rad * .3, p.rad * .25, 0, 7); g.fill(); continue; }
    if (p.t === 'glow') { g.strokeStyle = 'rgba(60,56,50,.4)'; g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.stroke(); continue; }
    // 陰の斜線
    if (p.t !== 'line') {
      g.save(); trace(g, p); g.clip(); const [x, y, w, h] = bbox(p); g.strokeStyle = 'rgba(50,46,42,.35)'; g.lineWidth = .7;
      const lum = hex2rgb(p.c).reduce((a, b) => a + b, 0) / 765, gap = 3 + lum * 7;
      for (let k = -h; k < w + h; k += gap) { g.beginPath(); g.moveTo(x + k, y + h); g.lineTo(x + k + h, y); g.stroke(); }
      if (lum < .4) for (let k = -h; k < w + h; k += gap * 1.4) { g.beginPath(); g.moveTo(x + k, y); g.lineTo(x + k + h, y + h); g.stroke(); }
      g.restore();
    }
    for (let k = 0; k < 2; k++) { g.save(); g.translate((r() - .5) * 2, (r() - .5) * 2); trace(g, p); g.strokeStyle = 'rgba(40,36,32,.7)'; g.lineWidth = p.t === 'line' ? Math.min(p.w, 3) : 1.1; g.lineCap = 'round'; g.stroke(); g.restore(); }
  }
  paper(g, c.seed, .15);
};
// 10. アメコミ
STYLES.comic = (g, c) => {
  const S = SCENES[c.scene] || SCENES.meadow;
  g.fillStyle = light(S.sky[0], .3); g.fillRect(0, 0, W, H);
  g.fillStyle = light(S.sky[0], .55); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(200, 150); g.lineTo(200 + Math.cos(a) * 400, 150 + Math.sin(a) * 400); g.lineTo(200 + Math.cos(a + .12) * 400, 150 + Math.sin(a + .12) * 400); g.fill(); }
  const parts = figureFor(c.sub);
  renderFlat(g, parts, { outline: '#111', ow: 4 });
  // 網点の陰
  for (const p of parts) {
    if (p.t !== 'ell' && p.t !== 'poly') continue;
    g.save(); trace(g, p); g.clip(); const [x, y, w, h] = bbox(p); g.fillStyle = 'rgba(0,0,0,.35)';
    for (let yy = y; yy < y + h; yy += 6) for (let xx = x + ((yy - y) / 6 % 2) * 3; xx < x + w; xx += 6) { const t = ((xx - x) / w + (yy - y) / h) / 2; if (t > .55) { g.beginPath(); g.arc(xx, yy, (t - .55) * 6, 0, 7); g.fill(); } }
    g.restore();
  }
  g.save(); g.translate(330, 50); g.rotate(-.15); g.fillStyle = '#fff36a'; g.beginPath(); const sp = starPts(0, 0, 50, 30, 10); g.moveTo(...sp[0]); sp.forEach(q => g.lineTo(...q)); g.closePath(); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#e5233a'; g.font = '900 26px Impact, sans-serif'; g.textAlign = 'center'; g.fillText(c.sfx || 'BAM!', 0, 9); g.restore();
};
// 11. ローポリ
STYLES.lowpoly = (g, c) => {
  const base = canvas(); const b = base.getContext('2d'); paintScene(b, c.scene, c.seed, 'real'); renderReal(b, figureFor(c.sub), c);
  const data = b.getImageData(0, 0, W, H).data, r = rng(c.seed + 9);
  const cols = 26, rows = 20, P = [];
  for (let j = 0; j <= rows; j++) { const row = []; for (let i = 0; i <= cols; i++) { const edge = i === 0 || j === 0 || i === cols || j === rows; row.push([i / cols * W + (edge ? 0 : (r() - .5) * 12), j / rows * H + (edge ? 0 : (r() - .5) * 12)]); } P.push(row); }
  const tri = (a, b2, cc) => { const x = (a[0] + b2[0] + cc[0]) / 3 | 0, y = (a[1] + b2[1] + cc[1]) / 3 | 0, k = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4; g.fillStyle = `rgb(${data[k]},${data[k + 1]},${data[k + 2]})`; g.strokeStyle = g.fillStyle; g.lineWidth = .8; g.beginPath(); g.moveTo(...a); g.lineTo(...b2); g.lineTo(...cc); g.closePath(); g.fill(); g.stroke(); };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = P[j][i], b2 = P[j][i + 1], cc = P[j + 1][i], d = P[j + 1][i + 1]; if ((i + j) % 2) { tri(a, b2, d); tri(a, d, cc); } else { tri(a, b2, cc); tri(b2, d, cc); } }
  g.globalAlpha = .08; g.strokeStyle = '#fff'; for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { g.beginPath(); g.moveTo(...P[j][i]); g.lineTo(...P[j + 1][i + 1]); g.stroke(); } g.globalAlpha = 1;
};
// 12. 墨絵
STYLES.sumi = (g, c) => {
  g.fillStyle = c.gold ? '#f3e2b0' : '#f2ede2'; g.fillRect(0, 0, W, H);
  const r = rng(c.seed);
  // 遠景の墨のにじみ
  g.save(); g.filter = 'blur(6px)'; g.fillStyle = 'rgba(40,40,40,.18)'; const n = noise2(c.seed); fillRidge(g, ridge(n, 190, 60, .01, 2), 'rgba(40,40,40,.18)'); g.restore();
  g.fillStyle = 'rgba(30,30,30,.08)'; g.beginPath(); g.arc(300, 70, 40, 0, 7); g.fill();
  const parts = figureFor(c.sub);
  for (const p of parts) {
    if (p.t === 'eye') { g.fillStyle = '#111'; g.beginPath(); g.arc(p.x, p.y, p.rad * .7, 0, 7); g.fill(); continue; }
    if (p.t === 'glow') { g.fillStyle = c.gold ? 'rgba(200,150,40,.4)' : 'rgba(30,30,30,.25)'; g.beginPath(); g.arc(p.x, p.y, p.rad, 0, 7); g.fill(); continue; }
    if (p.t !== 'line') { g.save(); g.globalAlpha = .12 + (1 - hex2rgb(p.c).reduce((a, b) => a + b, 0) / 765) * .35; trace(g, p); g.fillStyle = c.gold ? '#8a5a10' : '#1a1a1a'; g.fill(); g.restore(); }
    // かすれた筆
    for (let k = 0; k < 3; k++) { g.save(); g.translate((r() - .5) * 2.5, (r() - .5) * 2.5); trace(g, p); g.strokeStyle = `rgba(${c.gold ? '90,60,10' : '20,20,20'},${.25 + r() * .4})`; g.lineWidth = p.t === 'line' ? Math.max(1, p.w * (.5 + r() * .5)) : 1.5 + r() * 2.5; g.lineCap = 'round'; g.setLineDash([20 + r() * 40, 2 + r() * 6]); g.stroke(); g.restore(); }
  }
  g.fillStyle = '#c8322a'; g.fillRect(356, 24, 26, 32); g.fillStyle = '#f2ede2'; g.font = '700 17px serif'; g.textAlign = 'center'; g.fillText(c.stamp || '墨', 369, 46);
  paper(g, c.seed, .18);
};
// 13. 星座
STYLES.star = (g, c) => {
  paintScene(g, 'space', c.seed, 'real');
  const parts = figureFor(c.sub), r = rng(c.seed);
  // うっすら姿
  g.save(); g.globalAlpha = .22; g.filter = 'blur(2px)'; renderFlat(g, parts.map(p => Object.assign({}, p, { c: '#8ab0ff' }))); g.restore();
  const pts = [], near = (x, y) => pts.some(q => Math.hypot(q[0] - x, q[1] - y) < 22);
  const add = (x, y, s) => { if (!near(x, y)) pts.push([x, y, s]); };
  for (const p of parts) {
    if (p.t === 'eye' || p.t === 'glow') { pts.push([p.x, p.y, 3]); continue; }
    const [x, y, w, h] = bbox(p);
    if (p.t === 'ell') for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + (p.r || 0); add(p.x + Math.cos(a) * p.rx, p.y + Math.sin(a) * p.ry, 1.5); }
    else for (let i = 0; i < p.pts.length; i += Math.max(1, p.pts.length / 5 | 0)) add(p.pts[i][0], p.pts[i][1], 1.5);
  }
  g.strokeStyle = 'rgba(160,200,255,.45)'; g.lineWidth = 1;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b2 = pts[i]; if (Math.hypot(a[0] - b2[0], a[1] - b2[1]) < 70) { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b2[0], b2[1]); g.stroke(); } }
  for (const [x, y, s] of pts) { const gr = g.createRadialGradient(x, y, 0, x, y, 8 * s); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(200,220,255,.8)'); gr.addColorStop(1, 'rgba(120,160,255,0)'); g.fillStyle = gr; g.fillRect(x - 8 * s, y - 8 * s, 16 * s, 16 * s); }
  vignette(g, .5);
};

// ---------- 仕上げ ----------
function vignette(g, k) { const gr = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, W * .7); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${k})`); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
function grain(g, seed, amt) { const id = g.getImageData(0, 0, W, H), d = id.data, r = rng(seed + 99); for (let i = 0; i < d.length; i += 4) { const v = (r() - .5) * amt; d[i] += v; d[i + 1] += v; d[i + 2] += v; } g.putImageData(id, 0, 0); }
function paper(g, seed, amt) { const n = noise2(seed + 7), id = g.getImageData(0, 0, W, H), d = id.data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = (fbm(n, x * .08, y * .08, 3) - .5) * 255 * amt, k = (y * W + x) * 4; d[k] += v; d[k + 1] += v; d[k + 2] += v; } g.putImageData(id, 0, 0); }
function canvasTex(g, seed, amt) { const id = g.getImageData(0, 0, W, H), d = id.data; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = ((x % 4 < 1) || (y % 4 < 1) ? -1 : 1) * 255 * amt * .12, k = (y * W + x) * 4; d[k] += v; d[k + 1] += v; d[k + 2] += v; } g.putImageData(id, 0, 0); }
function scanlines(g) { g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 3) g.fillRect(0, y, W, 1); }

// 第三弾（進化）：本番の絵が届くまでの仮の絵。属性の色の光と、たまごのシルエット
STYLES.pending = (g, c) => {
  const col = { fire: '#ff7a2a', water: '#3aa0ff', leaf: '#5ad07a', bolt: '#ffd84a', dark: '#8a6aff', light: '#ffd0f0' }[c.el] || '#fff';
  const bg = g.createRadialGradient(W / 2, H * .55, 10, W / 2, H * .55, W * .7); bg.addColorStop(0, col); bg.addColorStop(.35, '#1a1430'); bg.addColorStop(1, '#07060e');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.save(); g.translate(W / 2, H * .58); g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(0, 0, 46, 60, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(-40, -6); g.lineTo(-20, 6); g.lineTo(-4, -8); g.lineTo(12, 6); g.lineTo(28, -6); g.lineTo(42, 4); g.stroke(); g.restore();
  g.fillStyle = 'rgba(255,255,255,.6)'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('絵を準備中', W / 2, 26);
};
// 第二弾（電車）：本番の絵（Stable Diffusionの写真風）が届くまでの仮の絵。夜の線路と列車のシルエット
STYLES.photo = (g, c) => {
  const EL = { fire: ['#3a1206', '#ff7a2a'], water: ['#06182e', '#3aa0ff'], leaf: ['#0a1e10', '#5ad07a'], bolt: ['#14122a', '#ffd84a'], dark: ['#07060c', '#8a6aff'], light: ['#14102a', '#ffd0f0'] }[c.el] || ['#0a0a14', '#fff'];
  const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, EL[0]); sky.addColorStop(.62, '#000'); sky.addColorStop(1, '#111');
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  // 星
  let r = c.seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647;
  g.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 50; i++) g.fillRect(rnd() * W, rnd() * H * .5, 1.2, 1.2);
  // 地平線と線路
  const hy = H * .58; g.fillStyle = '#05050a'; g.fillRect(0, hy, W, H - hy);
  g.strokeStyle = 'rgba(200,200,220,.45)'; g.lineWidth = 2;
  for (const k of [-1, 1]) { g.beginPath(); g.moveTo(W / 2 + k * 6, hy); g.lineTo(W / 2 + k * 150, H); g.stroke(); }
  for (let i = 0; i < 9; i++) { const t = Math.pow(i / 8, 1.8), y = hy + t * (H - hy), w = 14 + t * 300; g.fillStyle = 'rgba(120,110,100,.35)'; g.fillRect(W / 2 - w / 2, y, w, 2 + t * 5); }
  // 列車（正面）
  const tw = 70, th = 62, tx = W / 2 - tw / 2, ty = hy - th + 6;
  g.fillStyle = '#16161e'; g.fillRect(tx, ty, tw, th); g.fillStyle = '#22222c'; g.fillRect(tx + 6, ty + 8, tw - 12, 20);
  g.fillStyle = EL[1]; g.globalAlpha = .35; g.fillRect(tx + 8, ty + 10, tw - 16, 16); g.globalAlpha = 1;
  const glow = g.createRadialGradient(W / 2, ty + th - 14, 2, W / 2, ty + th - 14, 120); glow.addColorStop(0, 'rgba(255,240,200,.9)'); glow.addColorStop(.15, 'rgba(255,230,180,.35)'); glow.addColorStop(1, 'rgba(255,230,180,0)');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  // 都市伝説は霧
  if (c.scene === 'eerie') { const f = g.createLinearGradient(0, hy - 60, 0, H); f.addColorStop(0, 'rgba(160,170,190,0)'); f.addColorStop(.4, 'rgba(160,170,190,.28)'); f.addColorStop(1, 'rgba(160,170,190,.1)'); g.fillStyle = f; g.fillRect(0, 0, W, H); }
  g.fillStyle = 'rgba(255,255,255,.55)'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.fillText('絵を準備中', W / 2, 26);
};

// =============================================================
//  公開する関数
// =============================================================
const cache = new Map();
function render(card) {
  if (cache.has(card.no)) return cache.get(card.no);
  const c = canvas(), g = c.getContext('2d');
  try { ((card.sub && card.sub.k === 'pending') ? STYLES.pending : (STYLES[card.style] || STYLES.real))(g, card); }
  catch (e) { g.fillStyle = '#333'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.fillText('絵の描画に失敗: ' + e.message, 10, 20); console.error(card.nm, e); }
  const url = c.toDataURL('image/jpeg', .9);
  cache.set(card.no, url);
  return url;
}
const STYLE_NAMES = { real: '厚塗り', oil: '油彩', water: '水彩', ukiyo: '浮世絵', pixel: 'ドット絵', neon: 'ネオン', paper: '切り絵', glass: 'ステンドグラス', sketch: '鉛筆画', comic: 'アメコミ', lowpoly: 'ローポリ', sumi: '墨絵', star: '星座', photo: '写真風' };
global.CardArt = { render, cached: no => cache.get(no), STYLE_NAMES, W, H, flame, bolt, leafAt, E, PL, PS, LN, GLOW };
})(window);
