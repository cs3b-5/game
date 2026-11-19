// =============================================================
//  夜祭り金魚：絵（リアル寄り）
//  真鍮の釘と影、クロームの玉、金メッキの役物、ちょうちん図柄、金魚（琉金・紅白・出目金）
//  全部 canvas で描く（画像ファイルなし）。重い絵は一度だけ描いて使い回す
// =============================================================
(function (root) {
'use strict';
const seeded = s => () => (s = (s * 16807) % 2147483647) / 2147483647;
const TAU = Math.PI * 2;

// ---------------- 金魚 ----------------
// 頭が左（dir=-1 で右向き）。type: red / kohaku / gold / black
const FISH_COL = {
  red:    ['#b0180a', '#ff5a1f', '#ffd6b4', 'rgba(255,110,60,.55)'],
  kohaku: ['#f4ece6', '#fff8f2', '#ffffff', 'rgba(255,240,235,.55)'],
  gold:   ['#8a5a08', '#ffcc4a', '#fff4c0', 'rgba(255,214,110,.6)'],
  black:  ['#0c0c12', '#2c2c38', '#5a5a6a', 'rgba(60,60,80,.6)'],
  pink:   ['#c0306a', '#ff7aa8', '#ffe0ec', 'rgba(255,150,190,.55)'],
};
function fish(c, x, y, s, o = {}) {
  const type = o.type || 'red', col = FISH_COL[type], dir = o.dir || 1, t = o.t || 0, ph = o.seed || 0;
  const wave = Math.sin(t * 7 + ph), wave2 = Math.sin(t * 7 + ph + 1.3);
  c.save(); c.translate(x, y); c.scale(s * dir, s); if (o.rot) c.rotate(o.rot); c.globalAlpha = o.a == null ? 1 : o.a;
  // 尾びれ（琉金の長い2枚。透けて、ゆらゆら）
  const tg = c.createLinearGradient(12, 0, 40, 0); tg.addColorStop(0, col[1]); tg.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = tg;
  for (const [sy, w] of [[-1, wave], [1, wave2]]) {
    c.beginPath(); c.moveTo(12, sy * 1.5);
    c.bezierCurveTo(22, sy * 4 + w * 2, 30, sy * 16 + w * 5, 40, sy * 14 + w * 7);
    c.bezierCurveTo(34, sy * 8 + w * 4, 30, sy * 3 + w * 3, 33, sy * 1 + w * 2);
    c.quadraticCurveTo(22, sy * .5, 12, sy * 1.5); c.fill();
  }
  c.strokeStyle = col[3]; c.lineWidth = .5;
  for (let k = 0; k < 4; k++) for (const sy of [-1, 1]) { const w = sy < 0 ? wave : wave2; c.beginPath(); c.moveTo(13, sy); c.quadraticCurveTo(24, sy * (4 + k * 3) + w * 2, 34 + k, sy * (6 + k * 2.5) + w * 5); c.stroke(); }
  // 背びれ
  c.fillStyle = col[3];
  c.beginPath(); c.moveTo(-6, -10); c.quadraticCurveTo(0, -20 - wave, 9, -15 - wave); c.quadraticCurveTo(8, -10, 10, -7); c.closePath(); c.fill();
  // 体
  const body = new Path2D('M-19 0 C-17 -9 -5 -13 7 -9 Q13 -5 14 0 Q13 5 7 9 C-5 13 -17 9 -19 0 Z');
  const bg = c.createLinearGradient(0, -12, 0, 12); bg.addColorStop(0, col[0]); bg.addColorStop(.45, col[1]); bg.addColorStop(1, col[2]);
  c.fillStyle = bg; c.fill(body);
  c.save(); c.clip(body);
  if (type === 'kohaku') { c.fillStyle = '#e8281a'; c.beginPath(); c.ellipse(-12, -6, 6, 5, .3, 0, TAU); c.fill(); c.beginPath(); c.ellipse(3, -6, 7, 4, -.2, 0, TAU); c.fill(); }
  // うろこ
  c.strokeStyle = type === 'black' ? 'rgba(160,160,200,.18)' : 'rgba(255,255,255,.28)'; c.lineWidth = .45;
  for (let yy = -9; yy <= 9; yy += 3.2) for (let xx = -12 + (Math.abs(yy) % 6.4 ? 1.6 : 0); xx < 12; xx += 3.2) { c.beginPath(); c.arc(xx, yy, 1.9, -1.2, 1.2); c.stroke(); }
  // つや
  const sh = c.createLinearGradient(0, -12, 0, 0); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sh; c.beginPath(); c.ellipse(-4, -6, 13, 3.5, -.08, 0, TAU); c.fill();
  c.restore();
  // えら・胸びれ
  c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = .7; c.beginPath(); c.arc(-9, 0, 6, -1, 1); c.stroke();
  c.fillStyle = col[3]; c.beginPath(); c.moveTo(-7, 5); c.quadraticCurveTo(-3, 13 + wave2 * 1.5, 1, 11); c.quadraticCurveTo(-2, 7, -7, 5); c.fill();
  // 目（出目金は大きく飛び出す）
  const er = type === 'black' ? 4.2 : 2.9, ex = -13, ey = -3;
  c.fillStyle = type === 'black' ? '#1a1a22' : '#fff8ec'; c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fill();
  c.fillStyle = o.eye || '#141014'; c.beginPath(); c.arc(ex - .5, ey, er * .58, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(ex - 1.3, ey - 1, er * .22, 0, TAU); c.fill();
  c.restore();
}

// ---------------- ちょうちん ----------------
function lantern(c, x, y, s, o = {}) {
  const col = o.col || '#e8281a', lit = o.lit == null ? 1 : o.lit;
  c.save(); c.translate(x, y); c.scale(s, s); if (o.rot) c.rotate(o.rot);
  if (lit > .05) { const gl = c.createRadialGradient(0, 0, 4, 0, 0, 70); gl.addColorStop(0, `rgba(255,170,90,${.55 * lit})`); gl.addColorStop(1, 'rgba(255,120,40,0)'); c.fillStyle = gl; c.fillRect(-70, -70, 140, 140); }
  const pg = c.createRadialGradient(-6, -8, 2, 0, 0, 34);
  pg.addColorStop(0, lit > .5 ? '#fff6d8' : '#e8c8a8'); pg.addColorStop(.45, col); pg.addColorStop(1, '#3a0806');
  c.fillStyle = pg; c.beginPath(); c.ellipse(0, 0, 24, 30, 0, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(40,0,0,.35)'; c.lineWidth = 1;
  for (let k = -3; k <= 3; k++) { const yy = k * 8, w = 24 * Math.sqrt(1 - (yy / 30) ** 2); c.beginPath(); c.ellipse(0, yy, w, 2.4, 0, 0, Math.PI); c.stroke(); }
  c.fillStyle = '#141010'; c.beginPath(); c.roundRect(-12, -34, 24, 7, 2); c.fill(); c.beginPath(); c.roundRect(-12, 27, 24, 7, 2); c.fill();
  c.strokeStyle = '#d8a840'; c.lineWidth = 1; c.beginPath(); c.moveTo(-12, -28); c.lineTo(12, -28); c.moveTo(-12, 28); c.lineTo(12, 28); c.stroke();
  if (o.text) { c.font = '900 22px "Noto Sans JP", sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = 'rgba(30,0,0,.85)'; c.fillText(o.text, 0, 1); }
  c.restore();
}

// ---------------- 花火（光を足し算） ----------------
function firework(c, x, y, r, col, p = 1, seed = 1, a = 1) {
  const rr = seeded(Math.floor(seed * 1000) + 7);
  c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = a;
  const R = r * Math.sqrt(Math.min(1, p * 1.3)), fade = Math.max(0, 1 - Math.max(0, p - .55) / .45);
  const gl = c.createRadialGradient(x, y, 0, x, y, R * 1.1); gl.addColorStop(0, `rgba(255,240,210,${.25 * fade})`); gl.addColorStop(1, 'rgba(255,200,150,0)');
  c.fillStyle = gl; c.beginPath(); c.arc(x, y, R * 1.1, 0, TAU); c.fill();
  const n = 34;
  for (let i = 0; i < n; i++) {
    const ang = i / n * TAU + rr() * .1, l = R * (.82 + rr() * .2), drop = p * p * r * .18;
    const ex = x + Math.cos(ang) * l, ey = y + Math.sin(ang) * l + drop;
    const lg = c.createLinearGradient(x + Math.cos(ang) * l * .35, y + Math.sin(ang) * l * .35, ex, ey);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, col);
    c.strokeStyle = lg; c.globalAlpha = a * fade; c.lineWidth = r > 60 ? 2.2 : 1.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + Math.cos(ang) * l * .35, y + Math.sin(ang) * l * .35); c.quadraticCurveTo(x + Math.cos(ang) * l * .8, y + Math.sin(ang) * l * .8, ex, ey); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, r > 60 ? 2.4 : 1.5, 0, TAU); c.fill();
  }
  c.restore();
}

// ---------------- 釘（真鍮の頭と、盤面に落ちる影） ----------------
function nail(c, x, y, NR) {
  // 胴（盤面から立っている軸。少し右下に見える）
  const sg = c.createLinearGradient(x - 1, y, x + 1.5, y);
  sg.addColorStop(0, '#8a6418'); sg.addColorStop(.5, '#e8c46a'); sg.addColorStop(1, '#6a4a10');
  c.strokeStyle = sg; c.lineWidth = 1.7; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + .4, y + .6); c.lineTo(x + 2.2, y + 4.4); c.stroke();
  const sh = c.createRadialGradient(x + 1.8, y + 2.4, 0, x + 1.8, y + 2.4, NR + 2.4);
  sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh; c.beginPath(); c.arc(x + 1.8, y + 2.4, NR + 2.4, 0, TAU); c.fill();
  const g = c.createRadialGradient(x - 1.1, y - 1.2, .2, x, y, NR + .3);
  g.addColorStop(0, '#fffbe0'); g.addColorStop(.3, '#f0d27a'); g.addColorStop(.7, '#a87a26'); g.addColorStop(1, '#4a3008');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, NR, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = .5; c.beginPath(); c.arc(x, y, NR - .6, 3.4, 4.8); c.stroke();
}

// ---------------- 玉（クローム）：影ごと1枚の絵にしておく ----------------
function ballSprite(BR, px) {
  const pad = 5, size = (BR + pad) * 2, cv = document.createElement('canvas');
  cv.width = cv.height = Math.max(4, Math.ceil(size * px));
  const c = cv.getContext('2d'); c.scale(px, px);
  const cx = BR + pad - 1, cy = BR + pad - 1.5;
  const sh = c.createRadialGradient(cx + 2.2, cy + 3.2, 0, cx + 2.2, cy + 3.2, BR + 3);
  sh.addColorStop(0, 'rgba(0,0,0,.5)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(0, 0, size, size);
  c.save(); c.beginPath(); c.arc(cx, cy, BR, 0, TAU); c.clip();
  const g = c.createRadialGradient(cx - 2, cy - 2.6, .2, cx, cy, BR * 1.05);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.25, '#e6e8f2'); g.addColorStop(.55, '#9ea2b4'); g.addColorStop(.82, '#454858'); g.addColorStop(1, '#22242e');
  c.fillStyle = g; c.fillRect(cx - BR, cy - BR, BR * 2, BR * 2);
  // 映りこみ：暗い盤面の地平線と、下からの屋台の明かり
  c.fillStyle = 'rgba(16,14,40,.45)'; c.fillRect(cx - BR, cy + .4, BR * 2, 2.2);
  const wr = c.createLinearGradient(0, cy + 2, 0, cy + BR); wr.addColorStop(0, 'rgba(255,150,80,0)'); wr.addColorStop(1, 'rgba(255,160,90,.45)');
  c.fillStyle = wr; c.fillRect(cx - BR, cy + 2, BR * 2, BR);
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.ellipse(cx - 2.1, cy - 2.6, 1.7, 1.1, -.5, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = .6; c.beginPath(); c.arc(cx, cy, BR - .5, .2, 1.4); c.stroke();
  cv.off = BR + pad; return cv;
}

// ---------------- 図柄（ちょうちんのプレート）：0〜8が1〜9、9は擬似連の「祭」 ----------------
const SYM_COL = ['#ff2a48', '#2a8cff', '#ff8a1e', '#2ec85a', '#ffc21e', '#9a52ff', '#ff3d9a', '#18c8f0', '#ffd81e'];
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; if (k > 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; } else { r *= 1 + k; g *= 1 + k; b *= 1 + k; } return `rgb(${r | 0},${g | 0},${b | 0})`; }
function symSprite(n, px) {
  const W = 104, H = 124, cv = document.createElement('canvas');
  cv.width = Math.ceil(W * px); cv.height = Math.ceil(H * px);
  const c = cv.getContext('2d'); c.scale(px, px); c.translate(W / 2, H / 2);
  const gji = n === 9, col = gji ? '#e8281a' : SYM_COL[n];
  // 中から灯る和紙
  const pg = c.createRadialGradient(-6, -10, 3, 0, 0, 46);
  if (gji) { pg.addColorStop(0, '#ff8a6a'); pg.addColorStop(.5, '#d81a14'); pg.addColorStop(1, '#5a0404'); }
  else { pg.addColorStop(0, '#fffdf2'); pg.addColorStop(.55, '#ffe8c4'); pg.addColorStop(1, shade(col, -.15)); }
  c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 8; c.shadowOffsetY = 3;
  c.fillStyle = pg; c.beginPath(); c.ellipse(0, 0, 33, 43, 0, 0, TAU); c.fill();
  c.shadowColor = 'transparent';
  c.save(); c.beginPath(); c.ellipse(0, 0, 33, 43, 0, 0, TAU); c.clip();
  c.strokeStyle = gji ? 'rgba(60,0,0,.35)' : 'rgba(150,80,30,.22)'; c.lineWidth = 1.2;
  for (let k = -4; k <= 4; k++) { const yy = k * 9.5, w = 33 * Math.sqrt(Math.max(0, 1 - (yy / 43) ** 2)); c.beginPath(); c.ellipse(0, yy, w, 3, 0, 0, Math.PI); c.stroke(); }
  const rim = c.createRadialGradient(0, 0, 26, 0, 0, 44); rim.addColorStop(0, 'rgba(0,0,0,0)'); rim.addColorStop(1, shade(col, -.35)); c.fillStyle = rim; c.fillRect(-40, -50, 80, 100);
  c.restore();
  c.lineWidth = 3; c.strokeStyle = shade(col, -.2); c.beginPath(); c.ellipse(0, 0, 33, 43, 0, 0, TAU); c.stroke();
  // 黒うるしの上下＋金の線
  for (const yy of [-48, 41]) { const lg = c.createLinearGradient(0, yy, 0, yy + 7); lg.addColorStop(0, '#3a3438'); lg.addColorStop(1, '#0a080a'); c.fillStyle = lg; c.beginPath(); c.roundRect(-16, yy, 32, 7, 2); c.fill(); c.fillStyle = '#e8b848'; c.fillRect(-16, yy + (yy < 0 ? 6 : 0), 32, 1.2); }
  c.textAlign = 'center'; c.textBaseline = 'middle';
  if (gji) {
    c.font = '900 46px "Noto Sans JP", sans-serif';
    const tg = c.createLinearGradient(0, -24, 0, 24); tg.addColorStop(0, '#fff8d0'); tg.addColorStop(.5, '#ffcc4a'); tg.addColorStop(1, '#a06a10');
    c.lineWidth = 5; c.strokeStyle = '#3a0404'; c.strokeText('祭', 0, 2); c.fillStyle = tg; c.fillText('祭', 0, 2);
  } else {
    c.font = '400 72px "Bebas Neue", sans-serif';
    const tg = c.createLinearGradient(0, -28, 0, 30); tg.addColorStop(0, shade(col, .55)); tg.addColorStop(.48, col); tg.addColorStop(.52, shade(col, -.18)); tg.addColorStop(1, shade(col, -.5));
    c.lineJoin = 'round'; c.lineWidth = 9; c.strokeStyle = '#ffffff'; c.strokeText(n + 1, 0, 5);
    c.lineWidth = 3; c.strokeStyle = shade(col, -.6); c.strokeText(n + 1, 0, 5);
    c.fillStyle = tg; c.fillText(n + 1, 0, 5);
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fillRect(-12, -22, 3, 14);
    if (n % 2 === 0) fish(c, 16, 28, .42, { type: n === 6 ? 'gold' : 'red', t: n });
  }
  // ガラスのつや
  const gs = c.createLinearGradient(-30, -40, 10, 0); gs.addColorStop(0, 'rgba(255,255,255,.4)'); gs.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = gs; c.beginPath(); c.ellipse(-12, -20, 13, 18, -.4, 0, TAU); c.fill();
  return cv;
}

// ---------------- 盤面（動かないところ） ----------------
function metalGold(c, y0, y1) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  [[0, '#fff6c8'], [.08, '#f2c858'], [.2, '#9a6414'], [.34, '#f8dc86'], [.5, '#b07a22'], [.66, '#6a3e0a'], [.82, '#d8a442'], [1, '#3a2006']].forEach(([p, cc]) => g.addColorStop(p, cc));
  return g;
}
function drawStatic(c, B, BODY) {
  const LCD = B.LCD, R = seeded(20261120);
  const path = pts => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); };
  // 夜空
  const bg = c.createLinearGradient(0, 0, 0, B.H);
  bg.addColorStop(0, '#04051a'); bg.addColorStop(.35, '#120c36'); bg.addColorStop(.68, '#3a1442'); bg.addColorStop(.8, '#5a2238'); bg.addColorStop(.86, '#0a1a34'); bg.addColorStop(1, '#04101e');
  c.fillStyle = bg; c.fillRect(0, 0, B.W, B.H);
  // 天の川と星
  for (let i = 0; i < 9; i++) { const x = 40 + i * 64 + R() * 30, y = 40 + i * 40 + R() * 40, gr = c.createRadialGradient(x, y, 0, x, y, 90); gr.addColorStop(0, 'rgba(160,150,255,.07)'); gr.addColorStop(1, 'rgba(160,150,255,0)'); c.fillStyle = gr; c.fillRect(x - 90, y - 90, 180, 180); }
  for (let i = 0; i < 220; i++) { const x = R() * B.W, y = R() * 600, r = R() * R() * 1.3 + .25; c.fillStyle = `rgba(255,${230 + R() * 25 | 0},${200 + R() * 55 | 0},${.3 + R() * .6})`; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
  // 月
  const mx = 74, my = 112;
  const halo = c.createRadialGradient(mx, my, 10, mx, my, 110); halo.addColorStop(0, 'rgba(255,240,200,.35)'); halo.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = halo; c.fillRect(mx - 110, my - 110, 220, 220);
  const mg = c.createRadialGradient(mx - 8, my - 8, 2, mx, my, 28); mg.addColorStop(0, '#fffdf0'); mg.addColorStop(.7, '#f4e4b4'); mg.addColorStop(1, '#d8c490');
  c.fillStyle = mg; c.beginPath(); c.arc(mx, my, 27, 0, TAU); c.fill();
  for (const [dx, dy, r] of [[-8, -6, 6], [7, 4, 4], [-2, 10, 5], [10, -10, 3]]) { c.fillStyle = 'rgba(160,140,90,.18)'; c.beginPath(); c.arc(mx + dx, my + dy, r, 0, TAU); c.fill(); }
  // 打ち上げ花火（盤面の絵）
  firework(c, 58, 440, 48, '#ff6ab8', .75, .3, .55);
  firework(c, 546, 236, 40, '#46e0ff', .75, .6, .55);
  firework(c, 196, 712, 58, '#ffcc4a', .75, .9, .45);
  firework(c, 430, 736, 46, '#ff6ab8', .75, .2, .45);
  firework(c, 540, 118, 32, '#ffe08a', .75, .5, .5);
  // 遠くの山と屋台の列
  c.fillStyle = '#0c0a22'; c.beginPath(); c.moveTo(0, 790); for (let x = 0; x <= B.W; x += 20) c.lineTo(x, 770 - Math.sin(x * .013) * 14 - Math.sin(x * .041) * 6); c.lineTo(B.W, 800); c.closePath(); c.fill();
  for (let i = 0; i < 11; i++) {
    const x = i * 56 - 6, y = 778, w = 48;
    c.fillStyle = '#100818'; c.fillRect(x, y, w, 24);
    const lw = c.createLinearGradient(0, y + 4, 0, y + 24); lw.addColorStop(0, 'rgba(255,190,110,.75)'); lw.addColorStop(1, 'rgba(255,120,60,.15)');
    c.fillStyle = lw; c.fillRect(x + 4, y + 6, w - 8, 14);
    for (let k = 0; k < 6; k++) { c.fillStyle = k % 2 ? '#f4f0ea' : ['#d81e28', '#2a5ad8', '#e8a020'][i % 3]; c.beginPath(); c.moveTo(x - 3 + k * 9, y + 2); c.lineTo(x + 6 + k * 9, y + 2); c.lineTo(x + 8 + k * 9, y - 8); c.lineTo(x - 1 + k * 9, y - 8); c.fill(); }
    const lg = c.createRadialGradient(x + w / 2, y + 12, 0, x + w / 2, y + 12, 40); lg.addColorStop(0, 'rgba(255,170,90,.35)'); lg.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = lg; c.fillRect(x - 20, y - 30, w + 40, 80);
  }
  // ちょうちんの紐（上のレールにそって）
  c.strokeStyle = 'rgba(30,20,20,.8)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(20, 600); c.quadraticCurveTo(60, 520, 96, 250); c.stroke();
  for (let i = 0; i < 6; i++) { const p = i / 5, x = 20 + (96 - 20) * p * p * .3 + 76 * p * .7, y = 600 - 350 * p + 30 * Math.sin(p * 3); lantern(c, x - 4, y + 6, .22, { col: i % 2 ? '#e8281a' : '#ff8a1e', lit: .8 }); }
  // 水面・金魚
  const wg = c.createLinearGradient(0, 800, 0, B.H); wg.addColorStop(0, 'rgba(40,120,200,.15)'); wg.addColorStop(1, 'rgba(30,110,210,.55)');
  c.fillStyle = wg; c.fillRect(0, 800, B.W, 100);
  c.strokeStyle = 'rgba(180,230,255,.18)'; c.lineWidth = 1;
  for (let y = 806; y < B.H; y += 9) { c.beginPath(); for (let x = 0; x <= B.W; x += 12) c.lineTo(x, y + Math.sin(x * .05 + y) * 1.6); c.stroke(); }
  for (let i = 0; i < 14; i++) { const x = 20 + i * 42, lg = c.createLinearGradient(0, 802, 0, 880); lg.addColorStop(0, 'rgba(255,170,90,.25)'); lg.addColorStop(1, 'rgba(255,170,90,0)'); c.fillStyle = lg; c.fillRect(x, 802, 3, 78); }
  fish(c, 118, 842, 1, { type: 'red', t: 1 }); fish(c, 430, 856, .85, { type: 'kohaku', dir: -1, t: 2 }); fish(c, 262, 870, .7, { type: 'black', t: 3 }); fish(c, 520, 836, .6, { type: 'red', dir: -1, t: 4 });
  // 透明な樹脂の盤面（今の台は釘の場所に透明パーツ。裏のLEDで光る）
  resin(c, [[100, 214], [100, 556], [44, 560], [18, 548], [18, 420], [26, 340], [50, 262], [82, 222]], '120,110,255', [[58, 300, 46], [60, 470, 40]]);
  resin(c, [[40, 572], [124, 594], [262, 640], [292, 660], [292, 760], [180, 790], [40, 790]], '255,90,200', [[200, 640, 60], [90, 700, 50]]);
  resin(c, [[322, 588], [488, 586], [488, 700], [400, 720], [322, 680]], '90,200,255', [[400, 620, 60]]);
  resin(c, [[498, 404], [584, 404], [584, 770], [492, 770], [492, 562]], '255,120,220', [[540, 450, 46], [540, 690, 50]]);
  // 風車のまわりの丸い台座（透明）
  c.save(); c.strokeStyle = 'rgba(200,210,255,.5)'; c.lineWidth = 3; c.beginPath(); c.arc(B.P.wm.x, B.P.wm.y, 26, 0, TAU); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(B.P.wm.x, B.P.wm.y, 22, 0, TAU); c.stroke(); c.restore();
  // 外レール（クローム）
  const rail = () => { c.beginPath(); c.moveTo(B.LW - 6, B.H); c.lineTo(B.LW - 6, B.CY); c.arc(B.CX, B.CY, B.R + 6, Math.PI, 0); c.lineTo(B.RW + 6, B.H); };
  c.lineWidth = 14; c.strokeStyle = '#1a1c28'; rail(); c.stroke();
  c.lineWidth = 10; c.strokeStyle = '#8e94ae'; rail(); c.stroke();
  c.lineWidth = 5; c.strokeStyle = '#d8dcec'; rail(); c.stroke();
  c.lineWidth = 1.5; c.strokeStyle = '#ffffff'; c.beginPath(); c.moveTo(B.LW - 3, B.H); c.lineTo(B.LW - 3, B.CY); c.arc(B.CX, B.CY, B.R + 3, Math.PI, 0); c.lineTo(B.RW + 3, B.H); c.stroke();
  // 役物の本体（金メッキ）
  c.save(); path(BODY);
  c.shadowColor = 'rgba(0,0,0,.7)'; c.shadowBlur = 22; c.shadowOffsetY = 8; c.fillStyle = metalGold(c, 96, 580); c.fill(); c.restore();
  c.save(); path(BODY); c.clip();
  // 青海波の模様（下の台座）
  c.globalAlpha = .18; c.strokeStyle = '#3a1a04'; c.lineWidth = 1.2;
  for (let y = 520; y < 590; y += 9) for (let x = 100 + (y / 9 % 2) * 9; x < 500; x += 18) for (const r of [8, 5, 2]) { c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.stroke(); }
  c.globalAlpha = 1;
  c.lineWidth = 10; c.strokeStyle = 'rgba(255,255,255,.22)'; c.translate(-2, -2); path(BODY); c.stroke();
  c.strokeStyle = 'rgba(0,0,0,.3)'; c.translate(4, 4); path(BODY); c.stroke();
  c.restore();
  c.lineWidth = 1.5; c.strokeStyle = '#fff4c8'; path(BODY); c.stroke();
  // 鋲
  for (const [x, y] of [[138, 162], [196, 126], [404, 126], [462, 162], [110, 260], [110, 360], [110, 460], [490, 260], [490, 360], [490, 460], [150, 548], [450, 548]]) { const rg = c.createRadialGradient(x - .8, y - .8, .2, x, y, 2.6); rg.addColorStop(0, '#fff'); rg.addColorStop(1, '#7a5010'); c.fillStyle = rg; c.beginPath(); c.arc(x, y, 2.4, 0, TAU); c.fill(); }
  // 液晶のふち（黒いつや）
  const bz = c.createLinearGradient(0, LCD.y - 8, 0, LCD.y + LCD.h + 8); bz.addColorStop(0, '#34303e'); bz.addColorStop(.06, '#0a0810'); bz.addColorStop(1, '#000');
  c.fillStyle = bz; c.beginPath(); c.roundRect(LCD.x - 7, LCD.y - 7, LCD.w + 14, LCD.h + 14, 14); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 1; c.stroke();
  // ロゴ板（朱うるし＋金文字）
  c.save();
  c.beginPath(); c.moveTo(196, 130); c.lineTo(404, 130); c.lineTo(422, 147); c.lineTo(178, 147); c.closePath();
  const lp = c.createLinearGradient(0, 130, 0, 147); lp.addColorStop(0, '#e8303a'); lp.addColorStop(.5, '#a01020'); lp.addColorStop(1, '#4a0610');
  c.fillStyle = lp; c.fill(); c.strokeStyle = '#ffe08a'; c.lineWidth = 1.2; c.stroke();
  c.font = '900 13px "Noto Sans JP", sans-serif'; c.textAlign = 'center';
  const tg = c.createLinearGradient(0, 133, 0, 146); tg.addColorStop(0, '#fffbe0'); tg.addColorStop(.5, '#ffd25a'); tg.addColorStop(1, '#b07a1a');
  c.fillStyle = 'rgba(0,0,0,.5)'; c.fillText('夜 祭 り 金 魚', 300, 145.5); c.fillStyle = tg; c.fillText('夜 祭 り 金 魚', 300, 144);
  c.restore();
  // ステージ（青いガラス）
  for (const pts of [[[130, 528], [180, 538], [240, 544], [290, 552], [290, 560], [104, 552], [104, 520]], [[470, 528], [420, 538], [360, 544], [310, 552], [310, 560], [496, 552], [496, 520]]]) {
    const sg = c.createLinearGradient(0, 520, 0, 562); sg.addColorStop(0, 'rgba(140,230,255,.55)'); sg.addColorStop(1, 'rgba(30,110,200,.35)');
    c.fillStyle = sg; path(pts); c.fill();
  }
  c.lineCap = 'round';
  for (const s of B.SEG) if (s.k === 'stage') { c.strokeStyle = '#2a8acc'; c.lineWidth = 4; c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke(); c.strokeStyle = '#d4f6ff'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(s.x1, s.y1 - 1); c.lineTo(s.x2, s.y2 - 1); c.stroke(); }
  const hg = c.createRadialGradient(300, 556, 2, 300, 556, 18); hg.addColorStop(0, '#fff'); hg.addColorStop(.35, '#ff5fb8'); hg.addColorStop(1, 'rgba(255,95,184,0)');
  c.fillStyle = hg; c.beginPath(); c.arc(300, 556, 18, 0, TAU); c.fill();
  // ワープの入口
  const wpg = c.createRadialGradient(B.P.warp.x - 1, B.P.warp.y, 0, B.P.warp.x - 1, B.P.warp.y, 14); wpg.addColorStop(0, '#e8fdff'); wpg.addColorStop(.4, '#46e0ff'); wpg.addColorStop(1, 'rgba(70,224,255,0)');
  c.fillStyle = wpg; c.beginPath(); c.ellipse(B.P.warp.x - 1, B.P.warp.y, 6, 13, 0, 0, TAU); c.fill();
  label(c, 'WARP', B.P.warp.x - 30, B.P.warp.y - 14, '#8af0ff', 9);
  // 道釘
  for (const s of B.SEG) if (s.k === 'road') { const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1); for (let d = 0; d <= l; d += 10) nail(c, s.x1 + (s.x2 - s.x1) * d / l, s.y1 + (s.y2 - s.y1) * d / l, B.NR); }
  // 右打ちルートの透明プラスチック
  for (const s of B.SEG) if (s.k === 'guide' || s.k === 'wall') {
    c.strokeStyle = 'rgba(190,210,255,.28)'; c.lineWidth = 6; c.beginPath(); c.moveTo(s.x1, s.y1); c.lineTo(s.x2, s.y2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(s.x1 - 1, s.y1 - 1); c.lineTo(s.x2 - 1, s.y2 - 1); c.stroke();
  }
  // 右打ちの矢印プレート
  c.save(); c.translate(538, 300);
  const ag = c.createLinearGradient(0, -16, 0, 16); ag.addColorStop(0, '#ff9ad0'); ag.addColorStop(1, '#c0206a');
  c.fillStyle = ag; c.beginPath(); c.moveTo(-15, -8); c.lineTo(6, -8); c.lineTo(6, -16); c.lineTo(21, 0); c.lineTo(6, 16); c.lineTo(6, 8); c.lineTo(-15, 8); c.closePath(); c.fill();
  c.strokeStyle = '#ffe0f0'; c.lineWidth = 1; c.stroke(); c.restore();
  label(c, 'RIGHT', 538, 330, '#ffb3dd', 10);
  // スルーゲート（緑のプラスチック）
  c.lineCap = 'round';
  c.strokeStyle = '#0a6a3a'; c.lineWidth = 6; c.beginPath(); c.arc(B.P.gate.x, B.P.gate.y + 8, 17, Math.PI, 0); c.stroke();
  c.strokeStyle = '#6affb0'; c.lineWidth = 2.5; c.beginPath(); c.arc(B.P.gate.x, B.P.gate.y + 7, 17, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  label(c, 'GATE', B.P.gate.x, B.P.gate.y - 14, '#6affb0', 9);
  // 電チューの台座
  const dg = c.createLinearGradient(0, 590, 0, 608); dg.addColorStop(0, 'rgba(120,230,255,.55)'); dg.addColorStop(1, 'rgba(20,90,140,.55)');
  c.fillStyle = dg; c.beginPath(); c.roundRect(510, 592, 56, 15, 4); c.fill(); label(c, 'V', 538, 620, '#8af0ff', 11);
  // アタッカーの箱
  const atg = c.createLinearGradient(0, 694, 0, 746); atg.addColorStop(0, 'rgba(255,224,130,.35)'); atg.addColorStop(1, 'rgba(160,100,10,.4)');
  c.fillStyle = atg; c.beginPath(); c.moveTo(494, 694); c.lineTo(566, 722); c.lineTo(566, 744); c.lineTo(494, 740); c.closePath(); c.fill();
  c.strokeStyle = metalGold(c, 736, 748); c.lineWidth = 4; c.beginPath(); c.moveTo(494, 741); c.lineTo(566, 745); c.stroke();
  label(c, 'ATTACKER', 530, 760, '#ffd86a', 9);
  // ヘソ・入賞口（透明な色プラスチック）
  chucker(c, B.P.heso.x, B.P.heso.y, '#ff2a48', 'START');
  chucker(c, B.P.pocketL.x, B.P.pocketL.y, '#2a7aff', '');
  // 釘
  for (const n of B.NAILS) nail(c, n.x, n.y, B.NR);
  // 左下の表示パネル
  c.fillStyle = '#05040c'; c.beginPath(); c.roundRect(24, 828, 92, 40, 6); c.fill();
  c.strokeStyle = '#4a4a6a'; c.lineWidth = 1.5; c.stroke();
  c.font = '400 9px "Bebas Neue", sans-serif'; c.fillStyle = '#7a7aa0'; c.textAlign = 'left';
  c.fillText('1', 30, 864); c.fillText('2', 52, 864); c.fillText('普', 74, 864); c.fillText('右', 96, 864);
  // アウト穴
  const og = c.createRadialGradient(300, 878, 2, 300, 880, 30); og.addColorStop(0, '#000'); og.addColorStop(.8, '#0a0812'); og.addColorStop(1, '#3a3a50');
  c.fillStyle = og; c.beginPath(); c.ellipse(300, 880, 29, 12, 0, 0, TAU); c.fill();
  // まわりを少し暗く
  const vg = c.createRadialGradient(B.W / 2, B.H / 2, B.H * .35, B.W / 2, B.H / 2, B.H * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)');
  c.fillStyle = vg; c.fillRect(0, 0, B.W, B.H);
}
// 透明の樹脂板：うすい色＋メッシュ模様＋光るふち＋裏のLED
function resin(c, pts, rgb, leds) {
  const path = () => { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts.slice(1)) c.lineTo(p[0], p[1]); c.closePath(); };
  c.save(); path(); c.clip();
  for (const [x, y, r] of leds) { const g = c.createRadialGradient(x, y, 0, x, y, r * 2.2); g.addColorStop(0, `rgba(${rgb},.42)`); g.addColorStop(.4, `rgba(${rgb},.14)`); g.addColorStop(1, `rgba(${rgb},0)`); c.fillStyle = g; c.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4); }
  c.fillStyle = `rgba(${rgb},.08)`; c.fillRect(0, 0, 600, 900);
  c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = .6;
  for (let k = -900; k < 900; k += 5) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 900, 900); c.stroke(); c.beginPath(); c.moveTo(k + 900, 0); c.lineTo(k, 900); c.stroke(); }
  c.restore();
  c.save(); path(); c.shadowColor = `rgb(${rgb})`; c.shadowBlur = 10; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke(); c.restore();
  c.save(); c.translate(1.5, 1.5); path(); c.strokeStyle = `rgba(${rgb},.35)`; c.lineWidth = 1; c.stroke(); c.restore();
}
function label(c, t, x, y, col, size) {
  c.save(); c.font = `400 ${size + 3}px "Bebas Neue", sans-serif`; c.textAlign = 'center';
  c.fillStyle = 'rgba(0,0,0,.6)'; c.fillText(t, x + .8, y + .8); c.fillStyle = col; c.globalAlpha = .95; c.fillText(t, x, y); c.restore();
}
function chucker(c, x, y, col, t) {
  c.save();
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 5; c.shadowOffsetY = 2;
  const g = c.createLinearGradient(x - 16, y - 4, x + 16, y + 12); g.addColorStop(0, shade(col, .45)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.45));
  c.fillStyle = g; c.beginPath(); c.moveTo(x - 16, y + 11); c.lineTo(x - 12, y - 3); c.lineTo(x + 12, y - 3); c.lineTo(x + 16, y + 11); c.closePath(); c.fill();
  c.restore();
  c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - 11, y - 2, 4, 9);
  const hg = c.createLinearGradient(0, y - 3, 0, y + 4); hg.addColorStop(0, '#000'); hg.addColorStop(1, '#2a2030');
  c.fillStyle = hg; c.fillRect(x - 8, y - 3, 16, 6);
  if (t) label(c, t, x, y + 23, '#ffd0d8', 9);
}
// ガラスの映りこみ（毎フレーム上にかぶせる）
function glass(B, px) {
  const cv = document.createElement('canvas'); cv.width = Math.ceil(B.W * px); cv.height = Math.ceil(B.H * px);
  const c = cv.getContext('2d'); c.scale(px, px);
  const g = c.createLinearGradient(0, 0, B.W, B.H * .8);
  g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(.18, 'rgba(255,255,255,0)'); g.addColorStop(.34, 'rgba(255,255,255,0)'); g.addColorStop(.38, 'rgba(255,255,255,.05)'); g.addColorStop(.44, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, B.W, B.H);
  const t = c.createLinearGradient(0, 0, 0, 40); t.addColorStop(0, 'rgba(255,255,255,.08)'); t.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = t; c.fillRect(0, 0, B.W, 40);
  return cv;
}

root.Art = { fish, lantern, firework, nail, ballSprite, symSprite, drawStatic, glass, shade, metalGold, SYM_COL, seeded };
})(this);
