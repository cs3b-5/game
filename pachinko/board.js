// =============================================================
//  夜祭り金魚：盤面と玉の物理（画面に依存しないのでNodeでも動く）
//  現代のパチンコ台の形：真ん中に大きな液晶、左ルートと右ルート、
//  液晶の下にステージ、その下にヘソ。右打ちルートにゲート・電チュー・アタッカー。
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

// ---------------- 液晶まわり（役物） ----------------
// 液晶の枠：上は山なり（玉が左右へ流れる）、左右はまっすぐ
const FRAME = [[104, 214], [138, 158], [196, 122], [262, 112], [300, 96], [338, 112], [404, 122], [462, 158], [496, 214], [496, 512], [470, 528], [130, 528], [104, 512]];
const LCD = { x: 122, y: 150, w: 356, h: 352 };
const P = {
  heso:    { x: 300, y: 648 },                // スタートチャッカー（ヘソ）
  pocketL: { x: 150, y: 770 },                // 普通入賞口
  warp:    { x: 104, y: 400 },                // ワープ入口（液晶の左）
  gate:    { x: 538, y: 392 },                // スルーゲート
  den:     { x: 538, y: 590 },                // 電チュー
  atk:     { x: 532, y: 712 },                // アタッカー
  wm:      { x: 58,  y: 300 },                // 風車
};
// 線（壁）: [x1,y1,x2,y2, 種類]
const SEG = [];
const seg = (x1, y1, x2, y2, k = 'wall') => SEG.push({ x1, y1, x2, y2, k });
for (let i = 0; i < FRAME.length - 1; i++) {
  const [a, b] = [FRAME[i], FRAME[i + 1]];
  if (a[1] === 528 && b[1] === 528) continue;   // 枠の下はステージ
  seg(a[0], a[1], b[0], b[1], 'frame');
}
seg(104, 214, 104, 560, 'frame');      // ステージの左のかべ（外の玉がステージに乗らない）
// ステージの下は役物のかたまり。真ん中の穴（シュート）だけが下へつながる
seg(104, 560, 288, 578, 'frame'); seg(312, 578, 490, 562, 'frame');
seg(290, 552, 288, 578, 'frame'); seg(310, 552, 312, 578, 'frame');
// ステージ：ワープから来た玉が左右に揺れて、真ん中の穴に落ちるとヘソの真上へ
seg(130, 528, 180, 538, 'stage'); seg(180, 538, 240, 544, 'stage'); seg(240, 544, 290, 552, 'stage');
seg(310, 552, 360, 544, 'stage'); seg(360, 544, 420, 538, 'stage'); seg(420, 538, 470, 528, 'stage');
// 道釘：左から液晶の下を通ってヘソへ運ぶレール（見た目は釘の列）
seg(50, 565, 122, 585, 'road');         // 道釘（前半）：レールとの間は開いていて、レールぞいの玉はアウトへ
seg(146, 600, 262, 634, 'road');      // 道釘（後半）：こぼしのすき間のあと、命釘の上まで
// 右打ちルート：仕切りとゲートへの漏斗
seg(496, 512, 490, 560); seg(490, 560, 490, 770);
seg(500, 352, 526, 378, 'guide'); seg(586, 344, 552, 378, 'guide');
// 電チュー（閉じているとフタ、開くと羽が開いて玉を拾う）
seg(514, 592, 538, 582, 'denLid'); seg(538, 582, 562, 592, 'denLid');
seg(506, 568, 522, 590, 'denWing'); seg(570, 568, 554, 590, 'denWing');
// 電チューの下：アタッカーへ流すスロープ
seg(490, 636, 548, 656, 'guide'); seg(586, 648, 568, 662, 'guide');
// アタッカー（閉じているとフタ。右下へ流れて、すき間から落ちる）
seg(494, 694, 566, 722, 'atkLid');
seg(494, 694, 494, 740); seg(566, 722, 566, 744);
// ヘソ・入賞口の底（真ん中に小さな穴があるので玉がたまらない）
seg(285, 660, 296, 664); seg(304, 664, 315, 660);
seg(135, 782, 146, 786); seg(154, 786, 165, 782);
// 下の受け皿（アウト穴へ）
seg(LW, 800, 272, 878); seg(RW, 778, 328, 878);

// 釘
const NAILS = [];
const nail = (x, y, k) => NAILS.push({ x, y, k });
// ヘソと入賞口の両側
nail(P.heso.x - 12.5, P.heso.y, 'post'); nail(P.heso.x + 12.5, P.heso.y, 'post');
nail(P.pocketL.x - 11, P.pocketL.y, 'post'); nail(P.pocketL.x + 11, P.pocketL.y, 'post');
// 命釘（ヘソの上のハの字）
nail(283, 620, 'key'); nail(317, 620, 'key');
// 風車の軸
nail(P.wm.x, P.wm.y, 'axis');
// 釘を線の上に並べる（step が玉より小さいと「壁」、大きいと「すき間」）
function line(x1, y1, x2, y2, k, step = 9) { const l = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.round(l / step)); for (let i = 0; i <= n; i++) nail(x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n, k); }
// 右ルート：ゲートの下で2列の釘が電チューへしぼる
line(499, 418, 524, 474, 'right'); line(583, 438, 552, 474, 'right');
for (const [x, y] of [[520, 762], [552, 766]]) nail(x, y, 'right');
// ---------------- ゲージ（今の台の釘の並び） ----------------
// 上から：ブッコミ（液晶の枠から左へ落ちる玉の入口）→ 風車上の2本（左の釘と基準釘）→ 風車
// → 寄り釘（ワープへ寄せる）→ ハカマ（左右から寄せる2列）→ ジャンプ釘 → 道釘（こぼしのすき間つき）→ 命釘
// ※左上のレールぞい（中心から R-34 より外）は打ち出した玉の通り道なので釘を置かない
line(99, 224, 78, 248, 'hakama');                   // ブッコミ：枠から落ちた玉を風車の上へ寄せる
nail(62, 266, 'wmTop'); nail(84, 262, 'base');      // 風車上：左の釘と基準釘
line(78, 330, 86, 346, 'yori', 8);                  // 寄り釘：風車の右からワープの方へ
line(18, 432, 50, 474, 'hakama');                   // ハカマ（左）
line(100, 456, 82, 478, 'hakama');                  // ハカマ（右）
nail(66, 528, 'jump');                              // 道釘の手前のジャンプ釘
line(18, 342, 34, 352, 'yose');                     // 寄せ釘：レールぞいの玉をワープの方へはじく
// ステージの下：玉を左右に散らす釘の列（ステージからこぼれた玉用）
for (let x = 336; x <= 468; x += 22) nail(x, 600, 'comb');
for (let x = 347; x <= 457; x += 22) nail(x, 622, 'comb');
line(474, 650, 410, 690, 'misc', 9);                // 右下：アウトへ流す列
// 道釘の下：こぼれた玉の通り道（普通入賞口のハカマ）
line(40, 700, 100, 740, 'misc', 9);
// 液晶の左のレーン：風車のまわりのバラ釘を少しだけ
   // 寄せ釘：レールぞいの玉をワープへ（途中に1か所こぼし）
// ヘソの下（こぼし）
for (const [x, y] of [[262, 700], [338, 700], [300, 730], [214, 724], [232, 764], [368, 760], [60, 778]]) nail(x, y, 'bara');

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
    events: [],
    stats: { launched: 0, heso: 0, den: 0, atk: 0, pocket: 0, gate: 0, warp: 0, out: 0, nudge: 0, stuck: 0 },
  };
  w.launch = p => {
    // p: 0〜1 のハンドルの強さ。左下から外レールを上って、時計回りに打ち出す
    const a = Math.PI * .9, rr = R - BR - .5;
    const v = 380 + 720 * p + (rng() - .5) * 24;
    w.balls.push({ x: CX + rr * Math.cos(a), y: CY - rr * Math.sin(a), vx: Math.sin(a) * v, vy: Math.cos(a) * v, id: ++w.stats.launched, gate: false, warp: false, life: 0, still: 0 });
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
        if (d > R - BR) { const nx = -dx / d, ny = -dy / d; b.x = CX - nx * (R - BR); b.y = CY - ny * (R - BR); bounceN(b, nx, ny, .08, 0); }
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
      const c = P.wm;
      if (Math.abs(b.x - c.x) < 26 && Math.abs(b.y - c.y) < 26) {
        for (let k = 0; k < 3; k++) {
          const a = w.wmA + k * 2.094, ex = c.x + Math.cos(a) * 16, ey = c.y + Math.sin(a) * 16;
          hitSeg(b, { x1: c.x, y1: c.y, x2: ex, y2: ey }, .45, .05, 1.8, -Math.sin(a) * 16 * 3.2, Math.cos(a) * 16 * 3.2);
        }
      }
      // 線
      for (const s of SEG) {
        if (s.k === 'denLid' && w.denOpen) continue;
        if (s.k === 'denWing' && !w.denOpen) continue;
        if (s.k === 'atkLid' && w.atkOpen) continue;
        hitSeg(b, s, s.k === 'stage' ? .12 : s.k === 'road' ? .2 : .3, s.k === 'stage' ? .006 : s.k === 'road' ? .0115 : .04, s.k === 'road' ? NR : 1.5);
      }
      // 入賞の判定
      if (b.vy > -30 && Math.abs(b.x - P.heso.x) < 9.5 && b.y > P.heso.y - 5 && b.y < P.heso.y + 12) { remove(b, 'heso'); continue; }
      if (b.vy > -30 && Math.abs(b.x - P.pocketL.x) < 8 && b.y > P.pocketL.y - 5 && b.y < P.pocketL.y + 12) { remove(b, 'pocket'); continue; }
      if (w.denOpen && b.x > 518 && b.x < 558 && b.y > 578 && b.y < 600) { remove(b, 'den'); continue; }
      if (w.atkOpen && b.x > 496 && b.x < 566 && b.y > 690 && b.y < 744) { remove(b, 'atk'); continue; }
      if (!b.gate && Math.abs(b.x - P.gate.x) < 16 && Math.abs(b.y - P.gate.y) < 8) { b.gate = true; w.stats.gate++; w.events.push({ k: 'gate', x: b.x, y: b.y }); }
      if (!b.stage && b.warp && b.y > 548 && b.y < 562 && Math.abs(b.x - 300) < 10) {
        b.stage = true;
        if (rng() > .55) { b.x = 300 + (rng() < .5 ? -1 : 1) * (40 + rng() * 70); b.y = 590; b.vx *= .3; b.vy = 40; w.events.push({ k: 'spill', x: b.x, y: b.y }); }
        else w.events.push({ k: 'stageHole', x: b.x, y: b.y });
      }
      if (!b.warp && b.x < P.warp.x && b.x > P.warp.x - BR - 2.5 && Math.abs(b.y - P.warp.y) < 7) {
        b.warp = true;
        if (rng() < .2) {             // ワープは入口に入っても8割は抜けて落ちる
          w.stats.warp++; w.events.push({ k: 'warp', x: b.x, y: b.y });
          b.x = 142; b.y = 524; b.vx = 40 + rng() * 170; b.vy = 0;
        }
      }
      // 止まった玉は台の振動で少しゆらす（それでも動かなければ回収）
      const sp = Math.abs(b.vx) + Math.abs(b.vy);
      b.still = sp < 12 ? b.still + h : 0;
      if (b.still > .8) { b.vx += (rng() - .5) * 140; b.vy -= 40 + rng() * 40; b.still = 0; b.nudges = (b.nudges || 0) + 1; w.stats.nudge++; }
      if (b.nudges > 6) { remove(b, 'stuck'); continue; }
      if (b.y > 870 || b.life > 30) { remove(b, 'out'); continue; }
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

const API = { W, H, CX, CY, R, LW, RW, BR, NR, P, SEG, NAILS, FRAME, LCD, makeWorld };
if (typeof module !== 'undefined') module.exports = API; else root.Board = API;
})(this);
