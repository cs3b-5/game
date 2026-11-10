// =============================================================
//  夜祭り金魚：盤面と玉の物理（画面に依存しないのでNodeでも動く）
//  座標は 600×900 の盤面単位。y は下向き。
// =============================================================
(function (root) {
'use strict';
const W = 600, H = 900;
const CX = 300, CY = 330, R = 286;          // 上の丸いレール
const LW = 14, RW = 586;                    // 左右の壁
const BR = 6;                               // 玉の半径
const G = 980;                              // 重力
const NR = 3.2;                             // 釘の半径

// ---------------- 盤面の部品 ----------------
const P = {
  heso:   { x: 300, y: 612 },                 // スタートチャッカー
  pocketL:{ x: 92,  y: 690 },                 // 普通入賞口（左）
  pocketR:{ x: 392, y: 742 },                 // 普通入賞口（右下）
  warp:   { x: 158, y: 382 },                 // ワープ入口（液晶の左）
  gate:   { x: 528, y: 522 },                 // スルーゲート
  den:    { x: 528, y: 642 },                 // 電チュー
  wmL:    { x: 96,  y: 432 },                 // 風車
  wmR:    { x: 404, y: 150 },
};
// 線（壁）: [x1,y1,x2,y2, 種類]
const SEG = [];
const seg = (x1, y1, x2, y2, k = 'wall') => SEG.push({ x1, y1, x2, y2, k });
// 液晶の枠（屋根・左右）
seg(158, 264, 228, 214); seg(228, 214, 300, 198); seg(300, 198, 372, 214); seg(372, 214, 442, 264);
seg(158, 264, 158, 472); seg(442, 264, 442, 472);
seg(158, 472, 196, 480); seg(442, 472, 404, 480);
// ステージ（ワープから来た玉が転がる。真ん中の穴に落ちるとヘソの真上）
seg(196, 486, 232, 480, 'stage'); seg(232, 480, 270, 486, 'stage'); seg(270, 486, 290, 494, 'stage');
seg(310, 494, 330, 486, 'stage'); seg(330, 486, 368, 480, 'stage'); seg(368, 480, 404, 486, 'stage');
// 右打ちルートの仕切りと漏斗
seg(470, 488, 470, 812);
seg(470, 492, 512, 512); seg(586, 474, 544, 512);
// 電チュー（閉じているとフタ、開くと羽）
seg(512, 642, 544, 642, 'denLid');
seg(494, 620, 512, 642, 'denWing'); seg(562, 620, 544, 642, 'denWing');
// アタッカー（閉じているとフタ）
seg(474, 716, 560, 748, 'atkLid');
// ヘソ・入賞口の底
seg(285, 622, 315, 622); seg(77, 700, 107, 700); seg(377, 752, 407, 752);
// 下の受け皿（アウト穴へ）
seg(LW, 806, 276, 874); seg(470, 812, 324, 874); seg(RW, 800, 560, 840);

// 釘
const NAILS = [];
const nail = (x, y) => NAILS.push({ x, y });
// 入賞口の両側（ポスト）と命釘
for (const p of [P.heso]) { nail(p.x - 12.5, p.y); nail(p.x + 12.5, p.y); }
for (const p of [P.pocketL, P.pocketR]) { nail(p.x - 9.6, p.y); nail(p.x + 9.6, p.y); }
nail(281, 596); nail(319, 596);
nail(500, 642); nail(556, 642);
nail(P.wmL.x, P.wmL.y); nail(P.wmR.x, P.wmR.y);
// 右ルートの釘
for (const [x, y] of [[492, 566], [528, 572], [564, 566], [510, 600], [546, 600], [492, 690], [520, 684], [548, 690], [576, 684]]) nail(x, y);
// 道釘：液晶の左下からヘソへ玉を運ぶ
for (let i = -7; i <= 7; i++) nail(168 + i * 13, 506 + i * 9.5);
for (let i = 0; i <= 5; i++) nail(432 - i * 13, 506 + i * 9.5);
// 規則正しく並んだ釘
function near(x, y, p, r) { return Math.hypot(x - p.x, y - p.y) < r; }
for (let row = 0; ; row++) {
  const y = 64 + row * 24; if (y > 790) break;
  for (let x = 26 + (row % 2) * 15; x <= 574; x += 30) {
    if (y < CY && Math.hypot(x - CX, y - CY) > R - 26) continue;
    if (x >= 150 && x <= 450 && y >= 184 && y <= 500) continue;     // 液晶
    if (x >= 432 && x <= 480 && y >= 240 && y <= 500) continue;     // 液晶の右の通路
    if (x > 460 && y > 460) continue;                               // 右打ちルート
    if (x > 280 && x < 320 && y > 492 && y < 600) continue;         // ステージからヘソへの道
    if (near(x, y, P.heso, 30) || near(x, y, P.pocketL, 26) || near(x, y, P.pocketR, 26)) continue;
    if (x > 66 && x < 450 && y > 420 && y < 590 && Math.abs(y - (506 + (Math.min(x, 600 - x) - 168) * .73)) < 16) continue; // 道釘のまわり
    if (near(x, y, P.wmL, 30) || near(x, y, P.wmR, 30) || near(x, y, P.warp, 20)) continue;
    if (y > 780 && (x < 280 || x > 320)) continue;
    nail(x, y);
  }
}
// 釘をマス目で探せるように
const CELL = 32, GW = Math.ceil(W / CELL), GH = Math.ceil(H / CELL);
const grid = Array.from({ length: GW * GH }, () => []);
for (const n of NAILS) grid[Math.floor(n.y / CELL) * GW + Math.floor(n.x / CELL)].push(n);

// ---------------- 当たり判定 ----------------
function bounceN(b, nx, ny, e, fr, vx0 = 0, vy0 = 0) {
  const rvx = b.vx - vx0, rvy = b.vy - vy0, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny;
    const tx = -ny, ty = nx, vt = rvx * tx + rvy * ty;
    b.vx -= vt * tx * fr; b.vy -= vt * ty * fr;
    return -vn;
  }
  return 0;
}
function hitCircle(b, x, y, rad, e, fr, vx0, vy0) {
  const dx = b.x - x, dy = b.y - y, m = BR + rad, d2 = dx * dx + dy * dy;
  if (d2 >= m * m) return 0;
  const d = Math.sqrt(d2) || 1e-4, nx = dx / d, ny = dy / d;
  b.x = x + nx * m; b.y = y + ny * m;
  return bounceN(b, nx, ny, e, fr, vx0, vy0) || .001;
}
function hitSeg(b, s, e, fr, half = 1.5, vx0, vy0) {
  const ex = s.x2 - s.x1, ey = s.y2 - s.y1, l2 = ex * ex + ey * ey;
  let t = ((b.x - s.x1) * ex + (b.y - s.y1) * ey) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  return hitCircle(b, s.x1 + ex * t, s.y1 + ey * t, half, e, fr, vx0, vy0);
}

// ---------------- 世界 ----------------
function makeWorld(rng = Math.random) {
  const w = {
    balls: [], t: 0, rng,
    denOpen: false, atkOpen: false,
    wmA: 0,
    events: [],          // {k:'heso'|'den'|'atk'|'pocket'|'gate'|'warp'|'out'|'hit', x, y, v}
    stats: { launched: 0, heso: 0, den: 0, atk: 0, pocket: 0, gate: 0, warp: 0, out: 0 },
  };
  w.launch = p => {
    // p: 0〜1 のハンドルの強さ。外レールの左上から時計回りに打ち出す
    const a = Math.PI * .9, rr = R - BR - .5;
    const v = 360 + 760 * p + (rng() - .5) * 26;
    w.balls.push({ x: CX + rr * Math.cos(a), y: CY - rr * Math.sin(a), vx: Math.sin(a) * v, vy: Math.cos(a) * v, id: ++w.stats.launched, gate: false, warp: false, life: 0 });
  };
  w.step = dt => {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) sub(h);
  };
  function remove(b, k, extra) { b.dead = true; w.stats[k]++; w.events.push({ k, x: b.x, y: b.y, ...extra }); }
  function sub(h) {
    w.t += h; w.wmA += h * 3.2;
    const bl = w.balls;
    for (const b of bl) {
      if (b.dead) continue;
      b.life += h;
      b.vy += G * h;
      b.vx *= .9996; b.vy *= .9996;
      b.x += b.vx * h; b.y += b.vy * h;
      // 外レール（上の丸）と壁
      if (b.y < CY) {
        const dx = b.x - CX, dy = b.y - CY, d = Math.hypot(dx, dy);
        if (d > R - BR) { const nx = -dx / d, ny = -dy / d; b.x = CX - nx * (R - BR); b.y = CY - ny * (R - BR); bounceN(b, nx, ny, .08, .0); }
      }
      if (b.x < LW + BR) { b.x = LW + BR; if (b.vx < 0) b.vx = -b.vx * .3; }
      if (b.x > RW - BR) { b.x = RW - BR; if (b.vx > 0) b.vx = -b.vx * .3; }
      // 釘
      const gx = Math.floor(b.x / CELL), gy = Math.floor(b.y / CELL);
      for (let yy = gy - 1; yy <= gy + 1; yy++) for (let xx = gx - 1; xx <= gx + 1; xx++) {
        if (xx < 0 || yy < 0 || xx >= GW || yy >= GH) continue;
        for (const nl of grid[yy * GW + xx]) { const im = hitCircle(b, nl.x, nl.y, NR, .42, .05); if (im > 60) w.events.push({ k: 'nail', v: im }); }
      }
      // 風車（回る3枚の羽）
      for (const c of [P.wmL, P.wmR]) {
        if (Math.abs(b.x - c.x) > 26 || Math.abs(b.y - c.y) > 26) continue;
        for (let k = 0; k < 3; k++) {
          const a = w.wmA + k * 2.094, ex = c.x + Math.cos(a) * 16, ey = c.y + Math.sin(a) * 16;
          // 羽の先の速さを足して、はじかれるように
          hitSeg(b, { x1: c.x, y1: c.y, x2: ex, y2: ey }, .45, .05, 1.8, -Math.sin(a) * 16 * 3.2, Math.cos(a) * 16 * 3.2);
        }
      }
      // 線
      for (const s of SEG) {
        if (s.k === 'denLid' && w.denOpen) continue;
        if (s.k === 'denWing' && !w.denOpen) continue;
        if (s.k === 'atkLid' && w.atkOpen) continue;
        hitSeg(b, s, s.k === 'stage' ? .15 : .3, s.k === 'stage' ? .01 : .04);
      }
      // 入賞の判定
      if (b.vy > -20 && Math.abs(b.x - P.heso.x) < 10 && b.y > P.heso.y - 6 && b.y < P.heso.y + 6) { remove(b, 'heso'); continue; }
      for (const p of [P.pocketL, P.pocketR]) if (b.vy > -20 && Math.abs(b.x - p.x) < 9 && b.y > p.y - 6 && b.y < p.y + 6) { remove(b, 'pocket'); break; }
      if (b.dead) continue;
      if (w.denOpen && b.x > 512 && b.x < 544 && b.y > 636 && b.y < 652) { remove(b, 'den'); continue; }
      if (w.atkOpen && b.x > 474 && b.x < 562 && b.y > 718 && b.y < 764) { remove(b, 'atk'); continue; }
      if (!b.gate && Math.abs(b.x - P.gate.x) < 16 && Math.abs(b.y - P.gate.y) < 7) { b.gate = true; w.stats.gate++; w.events.push({ k: 'gate', x: b.x, y: b.y }); }
      if (!b.warp && b.x < P.warp.x && b.x > P.warp.x - BR - 2 && Math.abs(b.y - P.warp.y) < 6 && (b.warp = rng() < .5)) {
        w.stats.warp++; w.events.push({ k: 'warp', x: b.x, y: b.y });
        b.x = 208; b.y = 470; b.vx = 30 + rng() * 150; b.vy = 0;
      }
      if (b.y > 868 || b.life > 40) { remove(b, 'out'); continue; }
    }
    // 玉どうしのぶつかり
    for (let i = 0; i < bl.length; i++) {
      const a = bl[i]; if (a.dead) continue;
      for (let j = i + 1; j < bl.length; j++) {
        const c = bl[j]; if (c.dead) continue;
        const dx = c.x - a.x, dy = c.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * BR * BR || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, o = (2 * BR - d) / 2;
        a.x -= nx * o; a.y -= ny * o; c.x += nx * o; c.y += ny * o;
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0) { const j2 = -(1 + .5) * vn / 2; a.vx -= j2 * nx; a.vy -= j2 * ny; c.vx += j2 * nx; c.vy += j2 * ny; }
      }
    }
    if (bl.some(b => b.dead)) w.balls = bl.filter(b => !b.dead);
  }
  return w;
}

const API = { W, H, CX, CY, R, LW, RW, BR, NR, P, SEG, NAILS, makeWorld };
if (typeof module !== 'undefined') module.exports = API; else root.Board = API;
})(this);
