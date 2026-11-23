// たこ焼きシミュレーター：焼きのルール（画面なし・node でも動く）
// 鉄板は 4行×5列＝20穴。たこ焼き1個ごとに「26方向の面がどれだけ焼けたか」を持っていて、
// 下を向いている面だけが焼ける。返して焼き面を変えながら、全体をきつね色にする。
(function (root) {
  'use strict';
  const ROWS = 4, COLS = 5, N = ROWS * COLS;
  const PITCH = 1;            // 穴と穴の間かく（3Dの単位）
  const HOLE_R = 0.41;        // 穴の半径＝たこ焼きの半径
  const COOK_K = 0.25;        // 面の焼ける速さ
  const CORE_K = 0.055;       // 中が固まる速さ
  const SPILL_K = 0.18;       // はみ出た生地の焼ける速さ
  const TURN_OK = 0.33;       // これより下の面が焼けていれば返せる
  const POUR_RATE = 4.5;      // 生地を流す速さ（穴1杯＝1）
  const IDEAL_LO = 0.85, IDEAL_HI = 1.35, BURNT = 1.78;

  // 面の向き：{-1,0,1}^3 から 0 を除いた26方向
  const PD = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue; const l = Math.hypot(x, y, z); PD.push([x / l, y / l, z / l]);
  }
  const NP = PD.length;

  // ---------- 小さな数学 ----------
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  function qMul(a, b) {
    return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
      a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  }
  function qAxis(ax, ang) { const l = Math.hypot(ax[0], ax[1], ax[2]) || 1, s = Math.sin(ang / 2); return [ax[0] / l * s, ax[1] / l * s, ax[2] / l * s, Math.cos(ang / 2)]; }
  function qNorm(q) { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; }
  function qRot(q, v) { // v をq で回す
    const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
    return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
  }
  const qInv = q => [-q[0], -q[1], -q[2], q[3]];
  function qFromTo(a, b) { // a 方向を b 方向へ
    const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    if (d < -0.9999) { let ax = Math.abs(a[0]) < 0.9 ? [0, -a[2], a[1]] : [a[2], 0, -a[0]]; return qAxis(ax, Math.PI); }
    return qNorm([a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0], 1 + d]);
  }

  // 穴の位置（鉄板の中心が原点、x が列・z が行）
  function holePos(i) { const r = Math.floor(i / COLS), c = i % COLS; return [(c - (COLS - 1) / 2) * PITCH, ((r - (ROWS - 1) / 2) * PITCH)]; }
  function holeAt(x, z, maxD) {
    const c = Math.round(x / PITCH + (COLS - 1) / 2), r = Math.round(z / PITCH + (ROWS - 1) / 2);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return -1;
    const i = r * COLS + c, p = holePos(i); return Math.hypot(p[0] - x, p[1] - z) <= (maxD ?? PITCH * 0.5) ? i : -1;
  }
  function nbrs(i) { const r = Math.floor(i / COLS), c = i % COLS, o = []; if (r > 0) o.push(i - COLS); if (r < ROWS - 1) o.push(i + COLS); if (c > 0) o.push(i - 1); if (c < COLS - 1) o.push(i + 1); return o; }
  // 位置ごとの火の強さ（真ん中ほど強い）
  const CENTER = [];
  for (let i = 0; i < N; i++) { const p = holePos(i); CENTER.push(1.08 - 0.2 * (Math.hypot(p[0] / 2, p[1] / 1.5) / 1.25)); }

  function newBall() {
    return { q: [0, 0, 0, 1], cook: new Array(NP).fill(0), core: 1, shape: 0, mass: 0, tako: 0, ten: 0, negi: 0, beni: 0, lump: 0, stuck: 0, turns: 0, age: 0 };
  }
  function newHole() { return { oil: 1, temp: 0.49, fill: 0, spill: 0, spillCook: 0, cut: 0, ball: null }; }
  function newState(fire) {
    const s = { fire: fire || 3, t: 0, holes: [] };
    for (let i = 0; i < N; i++) { const h = newHole(); h.temp = target(s, i); s.holes.push(h); }
    return s;
  }
  const target = (s, i) => (0.15 + 0.17 * (s.fire - 1)) * CENTER[i];

  // 面ごとの「鉄板に当たっている度合い」
  function contact(wy) { if (wy < -0.2) return Math.pow(-wy, 1.2); if (wy < 0.25) return 0.08; return 0.015; }
  // 平らな液面（まだ丸くなっていない部分）の高さ：-1（半球のまま）〜 1（まんまる）
  const capLevel = b => -0.02 + 1.05 * b.shape;

  // ---------- 時間を進める ----------
  function step(s, dt) {
    s.t += dt;
    const ev = [];
    for (let i = 0; i < N; i++) {
      const h = s.holes[i], tg = target(s, i);
      h.temp += (tg - h.temp) * (1 - Math.exp(-dt / 5));
      const T = Math.max(0, h.temp);
      if (h.spill > 0.02) h.spillCook += SPILL_K * T * dt * 1.2;
      else { h.spillCook = 0; h.cut = 0; }
      const b = h.ball; if (!b) continue;
      b.age += dt;
      const up = qRot(qInv(b.q), [0, 1, 0]), cap = capLevel(b);
      for (let p = 0; p < NP; p++) {
        const d = PD[p], lu = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
        if (lu > cap + 0.08) continue; // 液面の部分はまだ焼けない
        // lu ＝ この面が世界で向いている上下（-1 で真下）
        b.cook[p] += COOK_K * T * contact(lu) * dt;
      }
      const m = Math.max(0.4, b.mass);
      b.core = Math.max(0, b.core - CORE_K * T * dt / Math.sqrt(m / 1.8));
    }
    return ev;
  }
  // 下を向いている面の焼け具合
  function bottomCook(b) {
    const down = qRot(qInv(b.q), [0, -1, 0]); let best = -2, c = 0;
    for (let p = 0; p < NP; p++) { const d = PD[p], k = d[0] * down[0] + d[1] * down[1] + d[2] * down[2]; if (k > best) { best = k; c = b.cook[p]; } }
    return c;
  }

  // ---------- 操作 ----------
  function oil(s, i, amt) { const h = s.holes[i]; if (!h) return; h.oil = Math.min(1, h.oil + amt); }
  // 生地を流す：その穴に入りきらない分は周りにあふれる
  function pour(s, i, amt) {
    const h = s.holes[i]; if (!h) return 0;
    h.temp -= amt * 0.05;
    let into = 0;
    if (!h.ball || h.ball.shape < 0.12) {
      if (!h.ball) { h.ball = newBall(); h.spillCook = Math.min(h.spillCook, 0.05); }
      into = Math.max(0, Math.min(amt, 1.05 - h.ball.mass)); h.ball.mass += into; h.fill = h.ball.mass;
      // まだ液体の上に流すと、表面がまた生にもどる
      if (h.ball.shape < 0.12) for (let p = 0; p < NP; p++) if (PD[p][1] > -0.1) h.ball.cook[p] = Math.min(h.ball.cook[p], 0.05);
    }
    const over = amt - into;
    if (over > 0) {
      h.spill = Math.min(1.6, h.spill + over * 0.6); if (h.spillCook > 0.3) h.spillCook *= 0.6;
      const ns = nbrs(i); for (const j of ns) { const o = s.holes[j]; o.spill = Math.min(1.6, o.spill + over * 0.4 / ns.length); }
      h.cut = 0;
    }
    return amt;
  }
  function addTako(s, i) { const b = s.holes[i] && s.holes[i].ball; if (!b || b.tako || b.shape > 0.5) return false; b.tako = 1; return true; }
  function sprinkle(s, i, kind, amt) {
    const h = s.holes[i]; if (!h) return false; const b = h.ball;
    if (b && b.shape < 0.6 && b[kind] < 1) { b[kind] = Math.min(1, b[kind] + amt); return true; }
    return false;
  }
  // まわりの生地に切れ目を入れる（edge: 0上 1右 2下 3左）
  function cutEdge(s, i, edge) {
    const h = s.holes[i]; if (!h) return false; const bit = 1 << edge; if (h.cut & bit) return false; h.cut |= bit; return true;
  }
  function cutFrac(s, i) {
    const r = Math.floor(i / COLS), c = i % COLS, h = s.holes[i]; let n = 0;
    const outer = [r === 0, c === COLS - 1, r === ROWS - 1, c === 0];
    for (let e = 0; e < 4; e++) if (outer[e] || (h.cut & (1 << e))) n++;
    return n / 4;
  }
  // 返す：ax は回す軸（世界座標）、ang は角度
  // 戻り値 {ok, why, broke}
  function turn(s, i, ax, ang) {
    const h = s.holes[i], b = h && h.ball; if (!b) return { ok: false, why: 'empty' };
    if (b.mass < 0.25) return { ok: false, why: 'little' };
    const bc = bottomCook(b);
    const res = { ok: true, broke: false, stuck: false, torn: false, tuck: 0 };
    if (b.stuck && bc < 1.6) { b.stuck = 0; b.lump = Math.min(1, b.lump + 0.22); res.stuck = true; res.ok = false; return res; }
    if (bc < TURN_OK && b.shape < 0.95) { // 早すぎ：くずれる
      b.lump = Math.min(1, b.lump + 0.3 * (1 - bc / TURN_OK)); res.broke = true;
      const lost = Math.min(b.mass * 0.25, 0.3); b.mass -= lost; h.spill = Math.min(1.6, h.spill + lost); h.cut = 0;
    }
    // まわりの生地をたくしこむ
    if (h.spill > 0.05 && b.shape < 0.98) {
      const cf = cutFrac(s, i), take = h.spill * (0.3 + 0.7 * cf);
      b.mass += take * 0.9; res.tuck = take; h.spill -= take;
      if (cf < 0.99) { b.lump = Math.min(1, b.lump + 0.1 * (1 - cf)); res.torn = true; }
      if (h.spillCook > 1.5) b.lump = Math.min(1, b.lump + 0.06);
      if (h.spill < 0.05) { h.spill = 0; h.spillCook = 0; }
    }
    // 中の生地が流れて丸くなる
    const liq = clamp(b.core / 0.45, 0, 1), maxS = clamp(b.mass / 1.85, 0.25, 1);
    if (b.shape < maxS) b.shape = Math.min(maxS, b.shape + (res.broke ? 0.2 : 0.45) * liq * Math.min(1, ang / (Math.PI / 2)));
    b.q = qNorm(qMul(qAxis(ax, ang), b.q)); b.turns++;
    // 丸くなったら液面の面はいま下になったものから焼けはじめる。液面だった面は生のまま
    return res;
  }
  // 穴から取り出す
  function take(s, i) {
    const h = s.holes[i], b = h && h.ball; if (!b) return null;
    if (b.shape < 0.4) return null;
    h.ball = null; h.fill = 0;
    return b;
  }
  function scrape(s, i) { const h = s.holes[i]; if (!h || h.spill <= 0) return false; h.spill = 0; h.spillCook = 0; h.cut = 0; return true; }

  // ---------- 採点 ----------
  function grade(b) {
    let cs = 0, burnt = 0, raw = 0;
    for (let p = 0; p < NP; p++) {
      const c = b.cook[p];
      let v = c < IDEAL_LO ? Math.pow(c / IDEAL_LO, 1.4) : c <= IDEAL_HI ? 1 : clamp(1 - (c - IDEAL_HI) / (BURNT + 0.25 - IDEAL_HI), 0, 1);
      cs += v; if (c >= BURNT) burnt++; if (c < 0.4) raw++;
    }
    cs /= NP; const bf = burnt / NP, rf = raw / NP;
    const shape = clamp(b.shape, 0, 1);
    let pts = 100 * (0.46 * cs + 0.3 * Math.pow(shape, 1.5) + 0.14 * (1 - b.core) + 0.1 * b.tako)
      - b.lump * 22 - bf * 55 + 3 * b.ten + 2 * b.negi + 2 * b.beni;
    pts = Math.round(clamp(pts, 0, 100));
    let label;
    if (bf > 0.3) label = '焦げ';
    else if (b.core > 0.35 || rf > 0.35) label = '生焼け';
    else if (shape < 0.7) label = 'いびつ';
    else if (pts >= 88) label = '極上';
    else if (pts >= 74) label = '上出来';
    else if (pts >= 55) label = 'ふつう';
    else label = 'いまいち';
    if ((label === '焦げ' || label === '生焼け') && pts > 45) pts = 45;
    return { pts, label, color: cs, burnt: bf, raw: rf, shape, core: b.core, tako: b.tako };
  }
  // 対戦の点数（食べたとき）
  function battlePts(g) { let p = Math.round((g.pts - 42) * 2.2 / 5) * 5; if (g.label === '焦げ') p = Math.min(p, -40); if (g.label === '生焼け') p = Math.min(p, -30); return p; }

  // ---------- 通信用：状態をバイト列に ----------
  const HB = 12 + NP; // 1穴あたりのバイト数
  function pack(s) {
    const a = new Uint8Array(4 + N * HB); a[0] = s.fire; let o = 4;
    for (const h of s.holes) {
      a[o] = Math.round(clamp(h.oil, 0, 1) * 255); a[o + 1] = Math.round(clamp(h.temp, 0, 1.2) * 200); a[o + 2] = Math.round(clamp(h.spill, 0, 1.6) * 150);
      a[o + 3] = Math.round(clamp(h.spillCook, 0, 2.5) * 100); a[o + 4] = h.cut & 15;
      const b = h.ball;
      if (b) {
        a[o + 4] |= 16 | (b.tako ? 32 : 0) | (b.stuck ? 64 : 0);
        for (let k = 0; k < 4; k++) a[o + 5 + k] = Math.round((b.q[k] + 1) * 127.5);
        a[o + 9] = Math.round(clamp(b.core, 0, 1) * 255); a[o + 10] = Math.round(clamp(b.shape, 0, 1) * 255);
        a[o + 11] = Math.round(clamp(b.mass, 0, 2.5) * 100);
        for (let p = 0; p < NP; p++) a[o + 12 + p] = Math.round(clamp(b.cook[p], 0, 2.5) * 100);
        // 細かい値は別の配列で
      }
      o += HB;
    }
    const x = new Uint8Array(N * 4);
    s.holes.forEach((h, i) => { const b = h.ball; if (b) { x[i * 4] = Math.round(b.lump * 255); x[i * 4 + 1] = Math.round(b.ten * 255); x[i * 4 + 2] = Math.round(b.negi * 255); x[i * 4 + 3] = Math.round(b.beni * 255); } });
    return { a, x };
  }
  function unpack(s, pk) {
    const a = pk.a instanceof Uint8Array ? pk.a : new Uint8Array(pk.a), x = pk.x instanceof Uint8Array ? pk.x : new Uint8Array(pk.x);
    s.fire = a[0]; let o = 4;
    s.holes.forEach((h, i) => {
      h.oil = a[o] / 255; h.temp = a[o + 1] / 200; h.spill = a[o + 2] / 150; h.spillCook = a[o + 3] / 100; h.cut = a[o + 4] & 15;
      if (a[o + 4] & 16) {
        const b = h.ball || (h.ball = newBall());
        b.tako = a[o + 4] & 32 ? 1 : 0; b.stuck = a[o + 4] & 64 ? 1 : 0;
        b.q = qNorm([a[o + 5] / 127.5 - 1, a[o + 6] / 127.5 - 1, a[o + 7] / 127.5 - 1, a[o + 8] / 127.5 - 1]);
        b.core = a[o + 9] / 255; b.shape = a[o + 10] / 255; b.mass = a[o + 11] / 100; h.fill = b.mass;
        for (let p = 0; p < NP; p++) b.cook[p] = a[o + 12 + p] / 100;
        b.lump = x[i * 4] / 255; b.ten = x[i * 4 + 1] / 255; b.negi = x[i * 4 + 2] / 255; b.beni = x[i * 4 + 3] / 255;
      } else { h.ball = null; h.fill = 0; }
      o += HB;
    });
  }
  function ballToArr(b) { return [b.q, b.cook.map(c => Math.round(c * 100) / 100), +b.core.toFixed(3), +b.shape.toFixed(3), +b.mass.toFixed(2), b.tako, +b.ten.toFixed(2), +b.negi.toFixed(2), +b.beni.toFixed(2), +b.lump.toFixed(2)]; }
  function ballFromArr(a) { const b = newBall(); [b.q, b.cook, b.core, b.shape, b.mass, b.tako, b.ten, b.negi, b.beni, b.lump] = a; b.cook = b.cook.slice(); return b; }

  // ---------- 自動で焼く（テスト用ボット） ----------
  // 1回呼ぶと「やること」を1つ返す（実行はしない）
  function autoPlan(s, mem) {
    mem = mem || {};
    for (let i = 0; i < N; i++) {
      const h = s.holes[i], b = h.ball;
      if (!b) {
        if (h.spill > 0.05 && h.spillCook > 0.4) return { a: 'scrape', i };
        if (!mem.noPour) return { a: 'pour', i, amt: 1.0 };
        continue;
      }
      if (b.shape < 0.1 && b.mass < 1.0) return { a: 'pour', i, amt: 1.0 };
      if (b.shape < 0.1 && h.spill < 0.75 && !mem.noPour) return { a: 'pour', i, amt: 1.0 };
      if (!b.tako && b.shape < 0.3) return { a: 'tako', i };
      if (b.ten < 0.5 && b.shape < 0.4) return { a: 'ten', i };
      if (b.negi < 0.5 && b.shape < 0.4) return { a: 'negi', i };
    }
    for (let i = 0; i < N; i++) {
      const h = s.holes[i], b = h.ball; if (!b) continue;
      if (h.spill > 0.05 && b.shape < 0.95) for (let e = 0; e < 4; e++) if (!(h.cut & (1 << e))) { const r = Math.floor(i / COLS), c = i % COLS; if ([r === 0, c === COLS - 1, r === ROWS - 1, c === 0][e]) continue; return { a: 'cut', i, e }; }
    }
    let best = null, bestV = -1;
    for (let i = 0; i < N; i++) {
      const b = s.holes[i].ball; if (!b) continue;
      const g = grade(b);
      let mn = 9; for (const c of b.cook) mn = Math.min(mn, c);
      if (mn >= 0.86 && b.core < 0.04 && b.shape > 0.9) return { a: 'take', i };
      const bc = bottomCook(b);
      const need = b.shape < 0.95 ? (bc >= 0.4 ? 1 + bc : 0) : (bc >= 1.08 ? 1 + bc : 0);
      if (need > bestV) { bestV = need; best = i; }
      void g;
    }
    if (best != null && bestV > 0) {
      const b = s.holes[best].ball;
      if (b.shape < 0.95) return { a: 'turn', i: best, ax: [1, 0, 0], ang: Math.PI / 2 };
      // いちばん焼けていない面を下へ
      let mi = 0; for (let p = 1; p < NP; p++) if (b.cook[p] < b.cook[mi]) mi = p;
      const w = qRot(b.q, PD[mi]), q = qFromTo(w, [0, -1, 0]);
      const ang = 2 * Math.acos(clamp(q[3], -1, 1)), l = Math.hypot(q[0], q[1], q[2]) || 1;
      return { a: 'turn', i: best, ax: [q[0] / l, q[1] / l, q[2] / l], ang };
    }
    return null;
  }
  function autoDo(s, p) {
    if (!p) return null;
    if (p.a === 'oil') oil(s, p.i, 1);
    else if (p.a === 'pour') pour(s, p.i, p.amt);
    else if (p.a === 'tako') addTako(s, p.i);
    else if (p.a === 'ten') sprinkle(s, p.i, 'ten', 0.6);
    else if (p.a === 'negi') sprinkle(s, p.i, 'negi', 0.6);
    else if (p.a === 'cut') cutEdge(s, p.i, p.e);
    else if (p.a === 'scrape') scrape(s, p.i);
    else if (p.a === 'turn') return turn(s, p.i, p.ax, p.ang);
    else if (p.a === 'take') return take(s, p.i);
    return null;
  }

  // ---------- 注文（チャレンジ） ----------
  const TOPS = ['sauce', 'mayo', 'aonori', 'katsuo'];
  const TOP_NAME = { sauce: 'ソース', mayo: 'マヨ', aonori: '青のり', katsuo: 'かつお節' };
  const CUSTOMERS = ['会社員', '学生さん', 'おばあちゃん', '親子づれ', '観光客', '常連さん', '大学生', 'カップル', '外国の人', '部活帰り', '屋台のおやじ', 'OLさん'];
  function makeOrder(rnd, n) {
    rnd = rnd || Math.random;
    const cnt = [4, 6, 6, 8, 8, 10][Math.floor(rnd() * 6)];
    const pat = [['sauce', 'mayo', 'aonori', 'katsuo'], ['sauce', 'mayo', 'aonori', 'katsuo'], ['sauce', 'aonori', 'katsuo'], ['sauce', 'mayo'], ['sauce', 'katsuo'], ['mayo', 'aonori'], [], ['sauce', 'mayo', 'katsuo']][Math.floor(rnd() * 8)];
    return { id: n, who: CUSTOMERS[Math.floor(rnd() * CUSTOMERS.length)], cnt, tops: pat, wait: 40 + cnt * 6 };
  }
  // 注文の採点
  function scoreOrder(o, balls, tops, waited) {
    const gs = balls.map(grade);
    const avg = gs.length ? gs.reduce((a, g) => a + g.pts, 0) / gs.length : 0;
    let miss = 0; for (const t of TOPS) if (o.tops.includes(t) !== !!tops[t]) miss++;
    const cntOk = balls.length === o.cnt;
    let pts = Math.round(avg * balls.length * (1 - 0.15 * miss) * (cntOk ? 1 : 0.6));
    const fast = waited < o.wait * 0.6 ? Math.round(pts * 0.15) : 0;
    const bad = gs.filter(g => g.label === '焦げ' || g.label === '生焼け').length;
    return { pts: pts + fast, avg: Math.round(avg), miss, cntOk, fast, bad, gs };
  }

  const API = { ROWS, COLS, N, PITCH, HOLE_R, PD, NP, TURN_OK, POUR_RATE, IDEAL_LO, IDEAL_HI, BURNT, TOPS, TOP_NAME,
    newState, step, oil, pour, addTako, sprinkle, cutEdge, cutFrac, turn, take, scrape, grade, battlePts, bottomCook, capLevel, target,
    holePos, holeAt, nbrs, pack, unpack, ballToArr, ballFromArr, newBall, autoPlan, autoDo, makeOrder, scoreOrder,
    qMul, qAxis, qRot, qInv, qNorm, qFromTo, clamp };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.TakoCore = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
