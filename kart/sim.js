// うぱカートGP — レースの中身（走り・ドリフト・アイテム・CPU）。画面なしで動く
import { TRACKS, buildPath } from './tracks.js';
import { CHARS } from './chars.js';

export const ITEMS = {
  dash: { name: 'ロケットダッシュ', ic: '🚀' },
  dash3: { name: 'トリプルダッシュ', ic: '🚀' },
  slime: { name: 'ぬるぬるスライム', ic: '🟢' },
  bomb: { name: 'ころころ爆弾', ic: '💣' },
  missile: { name: 'おいかけロケット', ic: '🎯' },
  shield: { name: 'バブルシールド', ic: '🫧' },
  star: { name: 'キラキラモード', ic: '🌟' },
};
// 順位ごとに出やすいアイテム（後ろほど強い）
const TABLE = [
  { slime: 5, bomb: 3, shield: 3, dash: 2 },
  { slime: 3, bomb: 4, shield: 3, dash: 3, missile: 1 },
  { slime: 2, bomb: 3, dash: 4, missile: 3, shield: 2, dash3: 1 },
  { dash: 3, dash3: 3, missile: 4, bomb: 2, star: 2 },
  { dash3: 4, missile: 3, star: 4, dash: 2 },
];
const G = 26; // 重力（ゲームっぽく強め）

export function makeRace(trackIdx, opt = {}) {
  const tr = TRACKS[trackIdx], P = buildPath(tr), N = P.N, hw = tr.width / 2, WALL = hw + 3.6;
  const rnd = opt.rnd || Math.random;
  const ev = []; const emit = (type, data) => ev.push(Object.assign({ type }, data));
  // コース上の印
  const boostAt = (tr.boosts || []).map(f => Math.floor(f * N));
  const jumpAt = (tr.jumps || []).map(f => Math.floor(f * N));
  const jumpFlag = new Uint8Array(N); for (const c of jumpAt) for (let k = -18; k <= 30; k++) jumpFlag[P.wrap(c + k)] = 1;
  const boxes = []; for (const f of tr.items || []) { const c = Math.floor(f * N); for (let k = 0; k < 5; k++) { const lat = (k - 2) * (hw * 0.38); boxes.push({ i: c, x: P.x[c] + P.rx[c] * lat, z: P.z[c] + P.rz[c] * lat, y: P.y[c], t: 0 }); } }
  const laps = opt.laps || tr.laps;
  // カート
  const ids = opt.chars || CHARS.map(c => c.id);
  const karts = ids.map((id, n) => {
    const c = CHARS.find(x => x.id === id);
    const row = Math.floor(n / 2), side = n % 2 ? 1 : -1;
    const i0 = P.wrap(-8 - row * 7), lat = side * hw * 0.45 + (row % 2 ? 1.2 : -1.2) * side * 0.3;
    return {
      n, id, c, cpu: n !== opt.player, i: i0, x: P.x[i0] + P.rx[i0] * lat, z: P.z[i0] + P.rz[i0] * lat, y: P.y[i0], vy: 0, yaw: Math.atan2(P.tx[i0], P.tz[i0]),
      spd: 0, slip: 0, prog: -8 - row * 7, lap: 0, done: false, time: 0, lapTimes: [], lapStart: 0,
      drift: 0, dTime: 0, dLvl: 0, boost: 0, boostPow: 1, spin: 0, spinA: 0, star: 0, shield: 0, item: null, count: 0, roul: 0, air: false, airT: 0, wasDrift: false, wrong: 0,
      maxS: 29 + (c.spd - 3) * 1.25, acc: 15 + (c.acc - 3) * 2.6, turn: 1.85 + (c.hdl - 3) * 0.17, wgt: c.wgt, off: 0,
      ai: { line: (rnd() - 0.5) * 0.5, skill: opt.level === 2 ? 0.985 + rnd() * 0.02 : opt.level === 0 ? 0.88 + rnd() * 0.04 : 0.93 + rnd() * 0.04, itemT: 0, driftHold: 0 }, prevDrift: false, prevItem: false, rank: n + 1, startBoost: 0,
    };
  });
  const objs = []; // 置かれたもの・飛んでいるもの
  const race = { tr, P, N, hw, karts, boxes, objs, boostAt, jumpAt, laps, t: -3.6, ev, finished: [], over: false };

  function rankAll() { const s = [...karts].sort((a, b) => (b.done - a.done) || (a.done && b.done ? a.time - b.time : b.prog - a.prog)); s.forEach((k, r) => k.rank = r + 1); return s; }
  function hit(k, kind) {
    if (k.star > 0 || k.spin > 0) return false;
    if (k.shield > 0) { k.shield = 0; emit('shieldpop', { k }); return false; }
    k.spin = kind === 'missile' ? 1.4 : 1.1; k.spd *= 0.3; k.drift = 0; k.dTime = 0; k.dLvl = 0; k.boost = 0;
    if (kind === 'missile' || kind === 'bomb') { k.vy = 7; k.air = true; }
    emit('hit', { k, kind }); return true;
  }
  function giveItem(k) {
    const tbl = TABLE[Math.min(TABLE.length - 1, Math.floor((k.rank - 1) / karts.length * TABLE.length))];
    let sum = 0; for (const v of Object.values(tbl)) sum += v; let r = rnd() * sum; let it = 'dash';
    for (const [key, v] of Object.entries(tbl)) { r -= v; if (r <= 0) { it = key; break; } }
    k.roul = 1.2; k.item = it; k.count = it === 'dash3' ? 3 : 1; emit('roulette', { k });
  }
  function useItem(k) {
    if (!k.item || k.roul > 0) return;
    const it = k.item, fx = Math.sin(k.yaw), fz = Math.cos(k.yaw);
    if (it === 'dash' || it === 'dash3') { k.boost = Math.max(k.boost, 1.2); k.boostPow = 1.42; emit('dash', { k }); }
    else if (it === 'slime') { objs.push({ kind: 'slime', x: k.x - fx * 2.2, z: k.z - fz * 2.2, y: k.y, i: k.i, life: 40, owner: k, safe: 0.6 }); emit('drop', { k }); }
    else if (it === 'bomb') { objs.push({ kind: 'bomb', x: k.x + fx * 2.2, z: k.z + fz * 2.2, y: k.y + 0.5, i: k.i, spd: Math.max(k.spd, 0) + 18, lat: P.lateral(k.i, k.x, k.z), life: 3.2, owner: k, safe: 0.3 }); emit('throw', { k }); }
    else if (it === 'missile') { const tgt = rankAll().find(o => o.rank === k.rank - 1) || null; objs.push({ kind: 'missile', x: k.x, z: k.z, y: k.y + 1, i: k.i, spd: 48, lat: P.lateral(k.i, k.x, k.z), life: 10, owner: k, tgt, safe: 0.3 }); emit('throw', { k }); }
    else if (it === 'shield') { k.shield = 12; emit('shield', { k }); }
    else if (it === 'star') { k.star = 7; emit('star', { k }); }
    k.count--; if (k.count <= 0) k.item = null;
  }

  function stepKart(k, inp, dt) {
    const go = race.t >= 0;
    if (k.done && k.cpu === false) inp = autoInput(k, dt); // ゴールしたら自動運転
    // ルーレット
    if (k.roul > 0) k.roul -= dt;
    if (k.spin > 0) { k.spin -= dt; k.spinA += dt * 14; inp = { thr: 0, brk: 0, steer: 0, drift: false, item: false }; } else k.spinA = 0;
    if (k.star > 0) k.star -= dt; if (k.shield > 0) k.shield -= dt; if (k.boost > 0) k.boost -= dt; else k.boostPow = 1;
    // スタート前
    if (!go) { if (k.cpu) { if (race.t > -0.9 && !k.startBoost) k.startBoost = rnd() < 0.5 ? 1 : 2; return; } if (inp.thr && race.t > -1.1 && !k.startBoost) k.startBoost = 1; if (inp.thr && race.t < -2.0 && race.t > -3.0) k.startBoost = -1; return; }
    if (k.startBoost === 1) { k.boost = 1.0; k.boostPow = 1.35; k.startBoost = 2; emit('dash', { k, start: true }); } else if (k.startBoost === -1) { k.spin = 0.8; k.startBoost = 2; }
    if (inp.item && !k.prevItem) useItem(k); k.prevItem = inp.item;
    // 速さ
    const lat = P.lateral(k.i, k.x, k.z), off = Math.abs(lat) > hw + 0.4 && k.star <= 0 && k.boost <= 0;
    k.off = off ? 1 : 0;
    const top = k.maxS * (off ? 0.55 : 1) * (k.boost > 0 ? k.boostPow : 1) * (k.star > 0 ? 1.2 : 1) * (k.cpu ? k.ai.mul || 1 : 1);
    if (inp.thr && !k.air) { if (k.spd < top) k.spd += k.acc * dt * (1 - Math.max(0, k.spd) / (top * 1.08)) * (k.boost > 0 ? 2.2 : 1); else k.spd -= (k.spd - top) * 1.8 * dt; }
    else if (inp.brk && !k.air) { k.spd -= (k.spd > 0 ? 32 : 9) * dt; if (k.spd < -9) k.spd = -9; }
    else if (!k.air) { k.spd -= Math.sign(k.spd) * Math.min(Math.abs(k.spd), 7 * dt); }
    if (k.spd > top && !k.air) k.spd -= (k.spd - top) * 1.8 * dt;
    // ドリフト
    if (inp.drift && !k.prevDrift && !k.air && Math.abs(inp.steer) > 0.25 && k.spd > 11) { k.drift = Math.sign(inp.steer); k.dTime = 0; k.dLvl = 0; k.vy = 3.2; k.air = true; emit('hop', { k }); }
    if (k.drift && (!inp.drift || k.spd < 7 || k.spin > 0)) { if (k.dLvl > 0 && k.spin <= 0) { k.boost = [0, 0.55, 0.95, 1.45][k.dLvl]; k.boostPow = 1.3; emit('miniturbo', { k, lvl: k.dLvl }); } k.drift = 0; k.dTime = 0; k.dLvl = 0; }
    k.prevDrift = inp.drift;
    const turnK = Math.min(1, Math.abs(k.spd) / 10) * (k.spd < 0 ? -1 : 1);
    if (k.drift) {
      const s = inp.steer * k.drift; // 内側に切ると深く、外側で浅く
      k.yaw -= k.drift * k.turn * (0.78 + 0.42 * s) * turnK * dt;
      k.dTime += dt * (1 + 0.6 * Math.max(0, s));
      const lv = k.dTime > 3.1 ? 3 : k.dTime > 1.9 ? 2 : k.dTime > 0.85 ? 1 : 0; if (lv > k.dLvl) { k.dLvl = lv; emit('dlvl', { k, lvl: lv }); }
      k.slip += (k.drift * 0.32 - k.slip) * Math.min(1, dt * 6);
    } else {
      k.yaw -= inp.steer * k.turn * turnK * dt * (k.air ? 0.4 : 1);
      k.slip += (0 - k.slip) * Math.min(1, dt * 8);
    }
    const ma = k.yaw + k.slip; // 進む向き（ドリフト中は外へすべる）
    k.x += Math.sin(ma) * k.spd * dt; k.z += Math.cos(ma) * k.spd * dt;
    // 道とのあたり
    const pi = k.i; k.i = P.nearest(k.i, k.x, k.z);
    let d = k.i - pi; if (d > N / 2) d -= N; if (d < -N / 2) d += N; k.prog += d;
    const lat2 = P.lateral(k.i, k.x, k.z);
    if (Math.abs(lat2) > WALL) { const s = Math.sign(lat2), push = Math.abs(lat2) - WALL; k.x -= P.rx[k.i] * s * push; k.z -= P.rz[k.i] * s * push; const ty = Math.atan2(P.tx[k.i], P.tz[k.i]); let dd = ty - k.yaw; dd = Math.atan2(Math.sin(dd), Math.cos(dd)); k.yaw += dd * 0.25; if (Math.abs(k.spd) > 8) { k.spd *= 0.86; emit('wall', { k }); } }
    // 高さ（ジャンプ台は飛ぶ）
    const gy = P.groundY(k.i, P.lateral(k.i, k.x, k.z)), g = G * tr.gravity;
    k.vy -= g * dt; k.y += k.vy * dt;
    if (k.y <= gy) { const slopeV = (gy - (k.lastGy ?? gy)) / dt; if (k.air && k.vy < -4) emit('land', { k }); k.y = gy; k.vy = Math.max(0, Math.min(slopeV, jumpFlag[k.i] ? 14 : 3)); k.air = false; k.airT = 0; }
    else if (!jumpFlag[k.i] && k.y - gy < 0.6 / tr.gravity && k.vy < 5 && k.airT < 0.25) { k.y = gy; k.vy = 0; k.air = false; }
    else { k.air = true; k.airT += dt; }
    k.lastGy = gy;
    // ダッシュ板
    for (const c of boostAt) { let di = k.i - c; if (di > N / 2) di -= N; if (di < -N / 2) di += N; if (di >= 0 && di <= 3 && Math.abs(lat2) < hw * 0.55 && k.padT !== c) { k.padT = c; k.boost = Math.max(k.boost, 1.0); k.boostPow = 1.38; emit('pad', { k }); } }
    if (k.padT != null) { let di = k.i - k.padT; if (di > N / 2) di -= N; if (di < -N / 2) di += N; if (di > 10 || di < -10) k.padT = null; }
    // アイテムボックス
    for (const b of boxes) if (b.t <= 0 && Math.abs(b.x - k.x) < 1.8 && Math.abs(b.z - k.z) < 1.8) { b.t = 3; emit('box', { k, b }); if (!k.item) giveItem(k); }
    // 逆走
    const fwd = Math.sin(k.yaw) * P.tx[k.i] + Math.cos(k.yaw) * P.tz[k.i]; k.wrong = fwd < -0.4 && k.spd > 4 ? k.wrong + dt : 0;
    // 周回
    if (!k.done) {
      k.time += dt;
      const lap = Math.floor(k.prog / N);
      if (lap > k.lap && k.prog > 0) { k.lap = lap; k.lapTimes.push(k.time - k.lapStart); k.lapStart = k.time; if (k.lap >= laps) { k.done = true; race.finished.push(k); emit('finish', { k }); } else emit('lap', { k, lap: k.lap + 1 }); }
    }
  }

  // CPU（とゴール後の自分）
  function autoInput(k, dt) {
    const a = k.ai, look = Math.round(7 + Math.max(0, k.spd) * 0.55), ti = P.wrap(k.i + look);
    const cAhead = P.curv[P.wrap(k.i + look + 6)];
    const latT = a.line * hw + Math.sign(cAhead) * Math.min(0.55, Math.abs(cAhead) * 1.2) * hw * 0.6 + (a.dodge || 0);
    const tx = P.x[ti] + P.rx[ti] * latT, tz = P.z[ti] + P.rz[ti] * latT;
    const want = Math.atan2(tx - k.x, tz - k.z); let df = want - (k.yaw + k.slip * 0.6); df = Math.atan2(Math.sin(df), Math.cos(df));
    let steer = Math.max(-1, Math.min(1, -df * 2.4));
    // ドリフト：急なカーブで
    let drift = false;
    if (k.drift) { a.driftHold += dt; drift = Math.abs(cAhead) > 0.08 || (a.driftHold < 1.0); if (k.dLvl >= 2 && Math.abs(cAhead) < 0.15) drift = false; steer = Math.max(-1, Math.min(1, steer * 1.3)); }
    else if (Math.abs(cAhead) > 0.26 && k.spd > 16 && Math.sign(cAhead) === Math.sign(steer) && Math.abs(steer) > 0.3) { drift = true; a.driftHold = 0; }
    // アイテム
    let item = false; a.itemT += dt;
    if (k.item && k.roul <= 0 && a.itemT > 0.8) {
      const it = k.item, sorted = race._sorted || karts;
      const ahead = karts.find(o => o.rank === k.rank - 1), behind = karts.find(o => o.rank === k.rank + 1);
      if (it === 'dash' || it === 'dash3') item = Math.abs(cAhead) < 0.12;
      else if (it === 'star') item = a.itemT > 1.5;
      else if (it === 'shield') item = true;
      else if (it === 'slime') item = (behind && k.prog - behind.prog < 18) || a.itemT > 8;
      else if (it === 'bomb') item = (ahead && ahead.prog - k.prog < 45 && ahead.prog - k.prog > 4) || a.itemT > 10;
      else if (it === 'missile') item = !!ahead || a.itemT > 5;
      if (item) a.itemT = 0;
    }
    // 前のスライムをよける
    a.dodge = 0; for (const o of objs) if (o.kind === 'slime') { let di = o.i - k.i; if (di < 0) di += N; if (di > 2 && di < 22) { const ol = P.lateral(o.i, o.x, o.z); if (Math.abs(ol - latT) < 2.2) a.dodge = (ol > latT ? -1 : 1) * 3; } }
    // きついカーブの前は少しゆるめる
    const cMax = Math.max(Math.abs(cAhead), Math.abs(P.curv[P.wrap(k.i + look)]));
    let thr = 1, brk = 0; if (cMax > 0.3 && k.spd > 21 && !k.drift) { thr = 0; if (k.spd > 25) brk = 1; }
    return { thr, brk, steer, drift, item };
  }

  function stepObjs(dt) {
    for (const o of objs) {
      o.life -= dt; if (o.safe > 0) o.safe -= dt;
      if (o.kind === 'bomb' || o.kind === 'missile') {
        // 道にそって進む
        let lat = o.lat;
        if (o.kind === 'missile' && o.tgt && !o.tgt.done) { const tl = P.lateral(o.tgt.i, o.tgt.x, o.tgt.z); lat += (tl - lat) * Math.min(1, dt * 3); let di = o.tgt.i - o.i; if (di < 0) di += N; if (di < 6) { o.x += (o.tgt.x - o.x) * Math.min(1, dt * 8); o.z += (o.tgt.z - o.z) * Math.min(1, dt * 8); } }
        else lat *= 1 - dt * 0.3;
        o.lat = lat; const adv = o.spd * dt; o.prog = (o.prog || 0) + adv; const ni = P.wrap(o.i + Math.max(1, Math.round(adv)));
        if (!(o.kind === 'missile' && o.tgt && (() => { let di = o.tgt.i - o.i; if (di < 0) di += N; return di < 6; })())) { o.i = ni; o.x = P.x[ni] + P.rx[ni] * lat; o.z = P.z[ni] + P.rz[ni] * lat; }
        o.y = P.y[o.i] + (o.kind === 'missile' ? 1.0 : 0.45);
        if (o.kind === 'bomb') o.spd *= 1 - dt * 0.35;
        if (o.kind === 'bomb' && o.life <= 0) { explode(o); }
      }
      // カートに当たる
      for (const k of karts) {
        if (o.dead || (o.owner === k && o.safe > 0)) continue;
        const r = o.kind === 'slime' ? 1.4 : o.kind === 'bomb' ? 1.4 : 1.3;
        if (Math.abs(o.x - k.x) < r && Math.abs(o.z - k.z) < r && Math.abs(o.y - k.y) < 2.5) {
          if (o.kind === 'bomb') explode(o); else { o.dead = true; hit(k, o.kind); emit('pop', { o }); }
        }
      }
      if (o.life <= 0 && o.kind !== 'bomb') o.dead = true;
    }
    for (let i = objs.length - 1; i >= 0; i--) if (objs[i].dead) objs.splice(i, 1);
  }
  function explode(o) { if (o.dead) return; o.dead = true; emit('boom', { x: o.x, y: o.y, z: o.z }); for (const k of karts) if (Math.hypot(k.x - o.x, k.z - o.z) < 4.2) hit(k, 'bomb'); }

  function collide() {
    for (let a = 0; a < karts.length; a++) for (let b = a + 1; b < karts.length; b++) {
      const A = karts[a], B = karts[b]; const dx = B.x - A.x, dz = B.z - A.z, d = Math.hypot(dx, dz), R = 1.9;
      if (d < R && d > 0.001 && Math.abs(A.y - B.y) < 1.5) {
        const nx = dx / d, nz = dz / d, push = (R - d), wa = B.wgt / (A.wgt + B.wgt), wb = 1 - wa;
        A.x -= nx * push * wa; A.z -= nz * push * wa; B.x += nx * push * wb; B.z += nz * push * wb;
        if (A.star > 0 && B.star <= 0) hit(B, 'star'); else if (B.star > 0 && A.star <= 0) hit(A, 'star');
        else { A.spd *= 0.97; B.spd *= 0.97; if (A.n === opt.player || B.n === opt.player) emit('bump', {}); }
      }
    }
  }

  race.step = (dt, playerInput) => {
    ev.length = 0; race.t += dt;
    const sorted = rankAll(); race._sorted = sorted;
    // ラバーバンド（CPUが離れすぎないように）
    const pl = karts[opt.player];
    for (const k of karts) if (k.cpu) { let m = k.ai.skill; if (pl && !pl.done) { const gap = k.prog - pl.prog; if (gap > 80) m *= 0.95; else if (gap < -80) m *= 1.05; } k.ai.mul = m; }
    for (const k of karts) stepKart(k, k.cpu ? autoInput(k, dt) : (playerInput || { thr: 0, brk: 0, steer: 0, drift: false, item: false }), dt);
    collide(); stepObjs(dt);
    for (const b of boxes) if (b.t > 0) b.t -= dt;
    if (!race.over && pl && pl.done) { race.endT = (race.endT || 0) + dt; if (race.endT > 6 || karts.every(k => k.done)) race.over = true; }
    if (!pl && karts.every(k => k.done)) race.over = true;
    return ev;
  };
  race.rankAll = rankAll;
  // まだゴールしていないカートのタイムをだいたいで決める
  race.finishRest = () => { for (const k of rankAll()) if (!k.done) { const remain = laps * N - k.prog; k.time += Math.max(1, remain / Math.max(12, k.maxS * 0.85)); k.done = true; race.finished.push(k); } rankAll(); };
  return race;
}
