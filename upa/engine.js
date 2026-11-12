// うぱるぱスピリッツ：ルールと物理（画面とは別。node でも動く）
// 座標：ホームベースが原点、ピッチャーは -z、ライト側が +x、上が +y（メートル）

export const BASES = [[0, 0], [19.4, -19.4], [0, -38.8], [-19.4, -19.4]]; // 本・一・二・三（x,z）
export const MOUND = [0, -18.44];
export const ZONE = { x: 0.25, y0: 0.42, y1: 1.06 };       // ストライクゾーン（ホームベース上）
export const RELEASE = [-0.42, 1.62, -16.9];
export const fenceR = phi => 95 + 20 * Math.cos(2 * phi); // 両翼95m・センター115m
export const FENCE_H = 3;

export function rngOf(seed) {
  let a = seed >>> 0;
  const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  f.n = (s = 1) => { let u = 0, v = 0; while (!u) u = f(); while (!v) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * s; };
  return f;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 球種 ----------
// k: 速さ倍率、b: ホームでの曲がり（x:ライト側+, y:上+）、1段階あたり
export const PITCHES = {
  st: { n: 'ストレート', s: 'ス', k: 1.00, b: [0, 0.06] },
  sl: { n: 'スライダー', s: 'スラ', k: 0.88, b: [0.07, -0.02] },
  cu: { n: 'カーブ', s: 'カ', k: 0.78, b: [0.05, -0.09] },
  fk: { n: 'フォーク', s: 'フォ', k: 0.86, b: [0, -0.09] },
  sh: { n: 'シュート', s: 'シュ', k: 0.92, b: [-0.06, -0.015] },
  ch: { n: 'チェンジアップ', s: 'チェ', k: 0.80, b: [-0.02, -0.055] },
  ct: { n: 'カットボール', s: 'カッ', k: 0.95, b: [0.04, 0] },
  sk: { n: 'シンカー', s: 'シン', k: 0.87, b: [-0.05, -0.06] },
};

// ---------- 色（ウーパールーパーの種類） ----------
export const SKINS = {
  pink: { n: 'リューシ', body: '#f9c6d3', gill: '#ec5f86', belly: '#fde3ea', eye: '#1a1418' },
  gold: { n: 'ゴールド', body: '#f6d77a', gill: '#f08a4e', belly: '#fbecb6', eye: '#2a1810' },
  wild: { n: 'マーブル', body: '#6f7556', gill: '#4f5a3e', belly: '#9aa080', eye: '#0e100a' },
  black: { n: 'ブラック', body: '#33323d', gill: '#4a3f58', belly: '#4d4b58', eye: '#e9e6f0' },
  albino: { n: 'アルビノ', body: '#fff3ec', gill: '#ff7f95', belly: '#ffffff', eye: '#e2304a' },
  copper: { n: 'コッパー', body: '#d79a6a', gill: '#c45a48', belly: '#ebc4a0', eye: '#2a1408' },
  blue: { n: 'ブルー', body: '#9cc6ee', gill: '#5a7fd8', belly: '#cfe3f8', eye: '#101828' },
  mint: { n: 'ミント', body: '#a8e6cf', gill: '#3fb08a', belly: '#d8f6ea', eye: '#0c1a14' },
};

// ---------- チーム ----------
// 打者：[名前, 守備, ミート, パワー, 走力, 守備力, 肌, 左打ち]
// 投手：[名前, 球速km/h, コントロール, スタミナ, {球種:段階}, 肌, 左投げ]
export const TEAMS = [
  { id: 'upa', n: '水槽ウパーズ', s: 'ウ', c: '#ff5c8a', c2: '#ffffff', cap: '#1d2340',
    bat: [['ルパ田', '中', 72, 48, 82, 70, 'pink'], ['ウパ山', '二', 66, 40, 70, 74, 'gold', 1], ['ぬる川', '一', 70, 78, 45, 50, 'wild'], ['エラ島', '三', 64, 86, 40, 55, 'black'],
      ['ちょろ松', '右', 60, 62, 58, 60, 'copper', 1], ['ぷく井', '遊', 62, 44, 75, 80, 'albino'], ['にゅる木', '左', 56, 58, 60, 55, 'mint', 1], ['ぺた沢', '捕', 50, 52, 35, 72, 'pink'], ['しっぽ原', '投', 30, 20, 30, 50, 'gold']],
    pit: ['しっぽ原', 146, 66, 70, { st: 1, sl: 4, fk: 3, ch: 2 }, 'gold'] },
  { id: 'mex', n: 'メキシコ湖サラマンダーズ', s: 'メ', c: '#2ab37a', c2: '#ffe066', cap: '#0f2a22',
    bat: [['ソチ森', '遊', 74, 36, 88, 78, 'wild', 1], ['アホロ谷', '中', 70, 54, 76, 70, 'gold'], ['テノチ', '三', 66, 82, 42, 58, 'copper'], ['ミチョ', '一', 60, 90, 30, 44, 'black'],
      ['トラヨ', '左', 64, 60, 62, 56, 'mint', 1], ['チナン', '二', 66, 42, 70, 72, 'pink'], ['カワ瀬', '右', 58, 56, 54, 60, 'albino', 1], ['クアウ', '捕', 48, 60, 30, 70, 'wild'], ['イツァ', '投', 28, 24, 30, 50, 'copper']],
    pit: ['イツァ', 152, 58, 74, { st: 1, ct: 4, cu: 3, sk: 3 }, 'copper'] },
  { id: 'gill', n: '外エラ・ギルズ', s: 'ギ', c: '#5a8cff', c2: '#ffffff', cap: '#14204a',
    bat: [['ふりる', '二', 76, 34, 80, 76, 'albino', 1], ['ひらり', '中', 68, 50, 84, 72, 'blue'], ['ぶく田', '一', 64, 84, 40, 50, 'blue'], ['ごぽ吉', '左', 62, 80, 44, 52, 'black', 1],
      ['さざな', '三', 60, 66, 50, 64, 'pink'], ['みなも', '遊', 64, 40, 74, 82, 'mint'], ['あわ乃', '右', 58, 52, 64, 58, 'gold', 1], ['しずく', '捕', 52, 50, 34, 74, 'albino'], ['なみ平', '投', 30, 22, 30, 50, 'blue']],
    pit: ['なみ平', 140, 78, 76, { st: 1, cu: 5, ch: 4, sh: 2 }, 'blue', 1] },
  { id: 'neo', n: 'ネオテニー・スターズ', s: 'ネ', c: '#ffb020', c2: '#20202a', cap: '#20202a',
    bat: [['ちびすけ', '遊', 70, 42, 86, 80, 'gold'], ['まるお', '二', 72, 46, 72, 70, 'pink', 1], ['でかぞう', '一', 58, 95, 28, 40, 'wild'], ['もちお', '三', 66, 76, 46, 60, 'copper'],
      ['ぷにた', '中', 64, 58, 80, 74, 'mint', 1], ['くるり', '右', 62, 62, 58, 58, 'black'], ['ねむ子', '左', 58, 54, 56, 56, 'albino', 1], ['ぽて吉', '捕', 50, 56, 32, 72, 'gold'], ['つや丸', '投', 28, 20, 30, 50, 'black']],
    pit: ['つや丸', 156, 54, 66, { st: 1, sl: 3, fk: 5 }, 'black'] },
];
// ---------- 追加の能力（パワプロ式） ----------
// 打者：[肩力, 捕球, 弾道1〜4, 特殊能力]　投手：特殊能力
const EX = {
  upa: { bat: [[70, 66, 2, ['infield', 'first']], [62, 76, 1, ['neba']], [50, 54, 3, ['chance']], [56, 52, 4, ['power', 'kX']], [72, 58, 2, ['vsL']], [84, 80, 1, ['laser']], [60, 54, 2, []], [76, 72, 2, ['chanceX']], [62, 50, 1, []]],
    pit: ['kire'], rp: ['ウパ守', 150, 60, 40, { st: 1, sl: 3, fk: 4 }, 'albino', 0, ['k', 'heavy']] },
  mex: { bat: [[78, 76, 1, ['infield', 'run']], [74, 68, 2, ['wide']], [64, 56, 3, ['chance']], [52, 44, 4, ['power', 'chanceX']], [66, 56, 2, ['first']], [70, 70, 1, ['neba']], [80, 58, 2, ['laser']], [82, 70, 2, []], [58, 50, 1, []]],
    pit: ['nobi', 'pinchX'], rp: ['ショロ', 148, 66, 40, { st: 1, sk: 4, ch: 3 }, 'mint', 1, ['vsLb']] },
  gill: { bat: [[64, 78, 1, ['avg', 'neba']], [70, 70, 2, ['infield']], [52, 50, 3, ['chance']], [60, 52, 4, ['power']], [72, 62, 2, ['vsL', 'kX']], [86, 84, 1, ['laser']], [66, 58, 2, ['first']], [74, 74, 2, []], [56, 50, 1, []]],
    pit: ['pinch', 'kire'], rp: ['しぶき', 154, 56, 40, { st: 1, fk: 5 }, 'gold', 0, ['nobi', 'k']] },
  neo: { bat: [[76, 78, 1, ['infield', 'run']], [62, 70, 2, ['avg']], [48, 40, 4, ['power', 'kX']], [68, 58, 3, ['chance']], [74, 70, 2, ['wide']], [68, 58, 2, ['first']], [60, 56, 2, ['neba']], [80, 72, 2, ['chanceX']], [60, 50, 1, []]],
    pit: ['nobi', 'heavy'], rp: ['とげ太', 146, 72, 40, { st: 1, cu: 4, sl: 3 }, 'pink', 1, ['pinch']] },
};
for (const t of TEAMS) { const x = EX[t.id]; if (!x) continue; t.bat.forEach((b, i) => { if (b.length < 9) b[7] = b[7] || 0; b.push(...x.bat[i]); }); while (t.pit.length < 7) t.pit.push(0); t.pit.push(x.pit); t.rp = x.rp; }

// 特殊能力  t: 'b'=野手 'p'=投手、g: 2=金 1=青 -1=赤
export const ABIL = {
  chance: { n: 'チャンス◎', t: 'b', g: 1, d: '得点圏にランナーがいると、ミートとパワーが上がる' },
  chanceX: { n: 'チャンス×', t: 'b', g: -1, d: '得点圏だと力が出ない' },
  vsL: { n: '対左投手○', t: 'b', g: 1, d: '左ピッチャーに強い' },
  avg: { n: 'アベレージヒッター', t: 'b', g: 2, d: 'カーソルが少し大きい' },
  power: { n: 'パワーヒッター', t: 'b', g: 2, d: '打球がぐんと強くなる' },
  wide: { n: '広角打法', t: 'b', g: 1, d: '流し打ちでも打球が弱くならない' },
  first: { n: '初球○', t: 'b', g: 1, d: '初球に強い' },
  neba: { n: '粘り打ち', t: 'b', g: 1, d: '2ストライクから、空振りがファウルになりやすい' },
  kX: { n: '三振', t: 'b', g: -1, d: '2ストライクからカーソルが小さくなる' },
  infield: { n: '内野安打○', t: 'b', g: 1, d: '内野ゴロで一塁まで速い' },
  run: { n: '走塁○', t: 'b', g: 1, d: 'ベースを回るのが速い' },
  laser: { n: 'レーザービーム', t: 'b', g: 2, d: '送球がものすごく速い' },
  nobi: { n: 'ノビ○', t: 'p', g: 1, d: 'ストレートが芯に当たりにくい' },
  kire: { n: 'キレ○', t: 'p', g: 1, d: '変化球がよく曲がる' },
  pinch: { n: '対ピンチ○', t: 'p', g: 1, d: '得点圏でコントロールが上がる' },
  pinchX: { n: 'ピンチ×', t: 'p', g: -1, d: '得点圏でコントロールが落ちる' },
  heavy: { n: '重い球', t: 'p', g: 1, d: '打球が飛びにくい' },
  k: { n: '奪三振', t: 'p', g: 2, d: '2ストライクから、打者のカーソルが小さくなる' },
  vsLb: { n: '対左打者○', t: 'p', g: 1, d: '左バッターにコントロールが上がる' },
  gyro: { n: 'ジャイロボール', t: 'p', g: 2, d: 'ストレートが速く見える' },
};
export const teamById = id => TEAMS.find(t => t.id === id) || TEAMS[0];
export const grade = v => 'GFEDCBAS'[clamp(Math.floor(v / 12.5), 0, 7)];
const abl = a => Array.isArray(a) ? a.filter(k => ABIL[k]) : [];

export function batterOf(team, i) {
  const b = team.bat[i % 9];
  const def = b[5], pow = b[3];
  return { name: b[0], pos: b[1], con: b[2], pow, spd: b[4], def, skin: b[6], left: !!b[7], arm: b[8] ?? def, cat: b[9] ?? def, traj: b[10] || (pow >= 80 ? 3 : pow >= 50 ? 2 : 1), abl: abl(b[11]), img: b[12] || null };
}
function pitOf(p) { return { name: p[0], kmh: p[1], ctl: p[2], sta: p[3], ars: p[4], skin: p[5], left: !!p[6], abl: abl(p[7]), img: p[8] || null }; }
export function pitcherOf(team, which = 0) { return pitOf(which && team.rp ? team.rp : team.pit); }
// スタミナ：何球まで元気か
export const pitchLimit = sta => Math.round(30 + sta * 0.85);
export const has = (who, k) => !!who && who.abl.includes(k);
const scoring = S => !!S && (S.bases[1] !== null || S.bases[2] !== null);

// ---------- 守備位置（x,z） ----------
export const FIELDERS = {
  P: [0, -17.6], C: [0, 1.2], '1B': [15.5, -25], '2B': [7.5, -34], SS: [-8, -33.5], '3B': [-15.5, -25],
  LF: [-29, -70], CF: [0, -84], RF: [29, -70],
};
export const FIELD_ORDER = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
const INFIELD = new Set(['P', 'C', '1B', '2B', 'SS', '3B']);
const posKey = { '投': 'P', '捕': 'C', '一': '1B', '二': '2B', '遊': 'SS', '三': '3B', '左': 'LF', '中': 'CF', '右': 'RF' };
export function defenseOf(team) {
  const m = {};
  team.bat.forEach((b, i) => { m[posKey[b[1]]] = i; });
  return m; // 守備位置 → 打順番号
}

// ---------- 投球 ----------
// 投手が狙う場所 (tx,ty) に投げる。コントロールで少しずれる
export function makePitch(pit, type, tx, ty, rng, slow = 1, S = null, bat = null) {
  const P = PITCHES[type] || PITCHES.st, lv = (pit.ars[type] || 1) * (has(pit, 'kire') && type !== 'st' ? 1.15 : 1);
  let ctl = pit.ctl;
  if (scoring(S)) ctl += has(pit, 'pinch') ? 15 : has(pit, 'pinchX') ? -15 : 0;
  if (bat && bat.left && has(pit, 'vsLb')) ctl += 10;
  const err = 0.025 + (100 - clamp(ctl, 1, 100)) / 100 * 0.075;
  const x = tx + rng.n(err), y = ty + rng.n(err);
  const mir = pit.left ? -1 : 1;
  const bx = P.b[0] * lv * mir, by = P.b[1] * (type === 'st' ? 1 : lv);
  const kmh = Math.round(pit.kmh * P.k + rng.n(1.5));
  const dur = 1.0 * (148 / (kmh + (type === 'st' && has(pit, 'gyro') ? 5 : 0))) * slow; // 画面での到達時間（遊びやすく少しゆっくり）
  return { type, kmh, dur, end: [x, y], brk: [bx, by], rel: [RELEASE[0] * mir, RELEASE[1], RELEASE[2]], nobi: type === 'st' && has(pit, 'nobi') ? 1 : 0, heavy: has(pit, 'heavy') ? 1 : 0, k: has(pit, 'k') ? 1 : 0, pl: pit.left ? 1 : 0 };
}
// t: 0..1 のときのボールの位置
export function pitchPos(p, t) {
  const [rx, ry, rz] = p.rel, [ex, ey] = p.end, [bx, by] = p.brk;
  const tt = t * t;
  return [rx + (ex - bx - rx) * t + bx * tt, ry + (ey - by - ry) * t + by * tt, rz + (0 - rz) * t];
}
export const inZone = (x, y) => Math.abs(x) <= ZONE.x + 0.035 && y >= ZONE.y0 - 0.035 && y <= ZONE.y1 + 0.035;

// ---------- 打撃 ----------
export const meetR = con => 0.075 + con / 100 * 0.075;
export const POWER_SWING = 0.7; // 強振のカーソルの大きさ
// 状況で変わるミートとパワー（特殊能力）
export function effBat(bat, S, pitch) {
  let con = bat.con, pow = bat.pow, k = 1;
  if (scoring(S)) { if (has(bat, 'chance')) { con += 8; pow += 6; } if (has(bat, 'chanceX')) { con -= 8; pow -= 6; } }
  if (pitch && pitch.pl && has(bat, 'vsL')) con += 6;
  if (has(bat, 'avg')) con += 6;
  if (S && S.b === 0 && S.s === 0 && has(bat, 'first')) { con += 8; pow += 4; }
  if (S && S.s === 2) { if (has(bat, 'kX')) k *= 0.88; if (pitch && pitch.k) k *= 0.9; }
  return { con: clamp(con, 1, 110), pow: clamp(pow, 1, 110), k };
}
// カーソルの半径（表示と判定で同じ）
export function cursorR(bat, S, pitch, power) { const e = effBat(bat, S, pitch); return meetR(e.con) * e.k * (power ? POWER_SWING : 1); }
// swing: {cx, cy, dt, pw}（dt: バットが当たる時刻 − ボール到着時刻。マイナスは早い。pw: 強振）、null は見送り
export function resolveSwing(pitch, bat, swing, rng, S = null) {
  const [bx, by] = pitch.end;
  if (!swing) return { kind: inZone(bx, by) ? 'strikeLook' : 'ball' };
  const e = effBat(bat, S, pitch);
  const r = meetR(e.con) * e.k * (swing.pw ? POWER_SWING : 1), R = r * 1.35;
  const d = Math.hypot(bx - swing.cx, by - swing.cy);
  if (Math.abs(swing.dt) > 0.13 || d > R) {
    // 粘り打ち：2ストライクで、おしい空振りはファウルに
    if (S && S.s === 2 && has(bat, 'neba') && Math.abs(swing.dt) < 0.17 && d < R * 1.3 && rng() < 0.7) return { kind: 'foul', tip: true };
    return { kind: 'whiff' };
  }
  const dtPen = has(bat, 'wide') ? 0.2 : 0.45;
  let q = clamp((1 - d / R) * (1 - Math.abs(swing.dt) / 0.13 * dtPen), 0, 1);
  if (pitch.nobi) q *= 0.9;
  if (q < 0.1 || rng() < 0.08 * (1 - q)) return { kind: 'foul', tip: true };
  let ev = 82 + (e.pow * 0.9 + 28) * (0.3 + 0.7 * Math.pow(q, 0.6)) + rng.n(4);
  if (has(bat, 'power')) ev += 3;
  if (swing.pw) ev = ev * 1.04 + 3;
  if (pitch.heavy) ev -= 5;
  const la = clamp(13 + (bat.traj - 2) * 2.5 + (by - swing.cy) / r * 26 + rng.n(5), -25, 70);
  let sp = swing.dt / 0.13 * 52 + (swing.cx - bx) / r * 8 + rng.n(9);
  if (bat.left) sp = -sp;
  return { kind: 'inplay', v: ev / 3.6, la, sp, q };
}

// ---------- 打球の飛び方 ----------
// 結果は {path:[[t,x,y,z]...], land, ...}。同じ値なら必ず同じ結果
export function flight(v, laDeg, spDeg) {
  const la = laDeg * Math.PI / 180, sp = spDeg * Math.PI / 180;
  let x = 0, y = 0.85, z = -0.4, vx = v * Math.cos(la) * Math.sin(sp), vy = v * Math.sin(la), vz = -v * Math.cos(la) * Math.cos(sp);
  const dt = 1 / 60, k = 0.0048, g = 9.8;
  const path = [[0, x, y, z]];
  let t = 0, landed = -1, wall = false, hr = false, bounces = 0, rolling = false;
  for (let i = 0; i < 60 * 14; i++) {
    t += dt;
    if (!rolling) {
      const s = Math.hypot(vx, vy, vz);
      vx -= k * s * vx * dt; vz -= k * s * vz * dt; vy -= (g + k * s * vy) * dt;
      x += vx * dt; y += vy * dt; z += vz * dt;
      if (y <= 0.04) {
        y = 0.04; if (landed < 0) landed = path.length;
        bounces++;
        if (Math.abs(vy) < 2 || bounces > 4) { rolling = true; vy = 0; }
        else { vy = -vy * 0.36; vx *= 0.86; vz *= 0.86; }
      }
    } else {
      const s = Math.hypot(vx, vz), ns = Math.max(0, s - 4.5 * dt);
      if (s > 0) { vx *= ns / s; vz *= ns / s; }
      x += vx * dt; z += vz * dt;
    }
    const dist = Math.hypot(x, z), phi = Math.atan2(x, -z);
    if (!wall && Math.abs(phi) < Math.PI / 4 + 0.02 && dist >= fenceR(phi)) {
      if (y > FENCE_H) { hr = true; path.push([t, x, y, z]); break; }
      // フェンス直撃：はね返る
      wall = true; vx = -vx * 0.3; vz = -vz * 0.3; if (landed < 0) landed = path.length;
    }
    path.push([t, x, y, z]);
    if (rolling && Math.hypot(vx, vz) < 0.05) break;
  }
  if (landed < 0) landed = path.length - 1;
  const L = path[landed];
  return { path, landed, landT: L[0], landX: L[1], landZ: L[3], landDist: Math.hypot(L[1], L[3]), hr, wall, phi: Math.atan2(L[1], -L[3]) * 180 / Math.PI, peak: Math.max(...path.map(p => p[2])) };
}

// ---------- 守備と走塁 ----------
const fspd = def => 5.9 + def / 100 * 1.6;
const runSpd = spd => 6.6 + spd / 100 * 2.2;
export const runTime = (spd, n) => 0.75 + 27.43 * n / runSpd(spd) + 0.2 * (n - 1);
const THROW = 31;
const throwSpd = (arm, laser) => 25 + arm / 100 * 11 + (laser ? 4 : 0);
function d2(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1]); }

// 守っているチームの、守備位置ごとの守備力・肩・捕球
export function defsOf(team) {
  const dm = defenseOf(team), d = {};
  for (const k of FIELD_ORDER) { const b = batterOf(team, dm[k]); d[k] = { def: b.def, arm: b.arm, cat: b.cat, laser: has(b, 'laser') }; }
  return d;
}
// 打球 → 結果。fieldTeam の守備力を使う
// defs[k]: 守備力の数字、または {def, arm, cat, laser}。rng があればエラーも起きる
export function judge(ball, F, defs0, bat, S, rng = null) {
  const defs = {}, info = {};
  for (const k in defs0) { const v = defs0[k]; info[k] = typeof v === 'object' ? v : { def: v, arm: v, cat: v }; defs[k] = info[k].def; }
  const error = k => rng && rng() < (100 - info[k].cat) / 100 * 0.035;
  const { path, landed } = ball;
  const fair = Math.abs(ball.phi) <= 45;
  if (ball.hr) return { res: 'HR', bases: 4, who: null };
  // 1) ノーバウンドで捕れるか
  for (let i = 1; i < landed; i++) {
    const [t, x, y, z] = path[i];
    if (y > 2.7) continue;
    for (const k of FIELD_ORDER) {
      if (k === 'C' && t > 1.6) continue;
      const f = F[k], need = 0.45 + d2(f, [x, z]) / fspd(defs[k]);
      if (need <= t) {
        if (!fair && Math.hypot(x, z) > 80) continue;
        if (fair && error(k)) return { res: 'E', bases: 1, who: k, t, at: [x, z] };
        return { res: 'FO', bases: 0, who: k, t, at: [x, z], fly: ball.peak > 6, deep: Math.hypot(x, z) > 62, foul: !fair };
      }
    }
  }
  if (!fair) return { res: 'FOUL', bases: 0, who: null };
  // 2) ゴロ・ヒット：最初に追いつける野手
  let best = null;
  for (let i = landed; i < path.length; i++) {
    const [t, x, , z] = path[i];
    for (const k of FIELD_ORDER) {
      if (k === 'C' && t > 2.2) continue;
      const need = 0.45 + d2(F[k], [x, z]) / fspd(defs[k]);
      if (need <= t) { best = { k, t, at: [x, z] }; break; }
    }
    if (best) break;
  }
  if (!best) { const e = path[path.length - 1]; best = { k: 'CF', t: e[0] + 1.2, at: [e[1], e[3]] }; }
  const outfield = !INFIELD.has(best.k) || ball.landDist > 42;
  // 3) 打者は何塁まで行ける？
  const fi = info[best.k] || { arm: 50 };
  const ballAt = n => best.t + 0.35 + d2(best.at, BASES[n % 4]) / throwSpd(fi.arm, fi.laser);
  const spd = bat.spd + (has(bat, 'run') ? 10 : 0), spd1 = bat.spd + (has(bat, 'infield') ? 14 : 0);
  let n = 0;
  for (let b = 1; b <= 3; b++) { if (runTime(b === 1 ? Math.max(spd, spd1) : spd, b) + 0.12 < ballAt(b)) n = b; else break; }
  if (!outfield) {
    if (n === 0) {
      if (error(best.k)) return { res: 'E', bases: 1, who: best.k, t: best.t, at: best.at };
      const margin = ballAt(1) - runTime(spd1, 1);
      const dp = S && S.bases[0] && S.outs < 2 && margin < -0.9;
      return { res: dp ? 'DP' : 'GO', bases: 0, who: best.k, t: best.t, at: best.at };
    }
    return { res: '1B', bases: 1, who: best.k, t: best.t, at: best.at, infield: true };
  }
  n = Math.max(1, n);
  return { res: ['', '1B', '2B', '3B'][n], bases: n, who: best.k, t: best.t, at: best.at };
}

// ---------- 試合の状態 ----------
export function newGame(away, home, innings = 3) {
  return { away, home, inn: 1, top: true, outs: 0, b: 0, s: 0, bases: [null, null, null], score: [0, 0], line: [[], []], hits: [0, 0], ord: [0, 0], innings, over: false, last: null, seq: 0,
    pc: [0, 0], pi: [0, 0], box: [Array.from({ length: 9 }, () => [0, 0, 0, 0]), Array.from({ length: 9 }, () => [0, 0, 0, 0])] }; // box: [打数, 安打, 本塁打, 打点]
}
export const batTeamIdx = S => S.top ? 0 : 1;
export function curBatter(S) { const i = batTeamIdx(S); return { idx: S.ord[i] % 9, team: teamById(i ? S.home : S.away) }; }
// 疲れも入った、いまのピッチャー
export function curPitcher(S) {
  const fi = S.top ? 1 : 0, p = pitcherOf(teamById(fi ? S.home : S.away), (S.pi || [0, 0])[fi]);
  const pc = (S.pc || [0, 0])[fi], lim = pitchLimit(p.sta);
  p.pc = pc; p.lim = lim; p.stamina = clamp(1 - pc / (lim + 30), 0, 1);
  const tired = Math.max(0, (pc - lim) / 25);
  if (tired > 0) { p.kmh = Math.round(p.kmh - Math.min(10, tired * 5)); p.ctl = Math.round(Math.max(5, p.ctl - tired * 14)); p.tired = true; }
  return p;
}

// 1球の結果を反映（純粋：新しい S を返す）。ev: {kind, res?, bases?, deep?}
export function applyEvent(S0, ev) {
  const S = JSON.parse(JSON.stringify(S0));
  if (!S.pc) { S.pc = [0, 0]; S.pi = [0, 0]; } if (!S.box) S.box = [Array.from({ length: 9 }, () => [0, 0, 0, 0]), Array.from({ length: 9 }, () => [0, 0, 0, 0])];
  const ti = batTeamIdx(S), fi = 1 - ti;
  S.pc[fi]++;
  const runner = S.ord[ti] % 9;
  let msg = '', runs = 0, pa = false;
  const score = n => { runs += n; };
  const nextBatter = () => { S.ord[ti]++; S.b = 0; S.s = 0; pa = true; };
  const out = (n = 1) => { S.outs += n; };
  const force = () => { // 四球・死球
    if (S.bases[0] !== null) { if (S.bases[1] !== null) { if (S.bases[2] !== null) score(1); S.bases[2] = S.bases[1]; } S.bases[1] = S.bases[0]; }
    S.bases[0] = runner;
  };
  const adv = n => { // ヒット：全員 n 個、単打なら二塁走者はホームまで
    const nb = [null, null, null];
    for (let b = 2; b >= 0; b--) {
      if (S.bases[b] === null) continue;
      let to = b + n;
      if (n === 1 && b === 1) to = 3; // 二塁ランナーはシングルで生還
      if (to >= 3) score(1); else nb[to] = S.bases[b];
    }
    if (n >= 4) score(1); else nb[n - 1] = runner;
    S.bases = nb;
  };
  switch (ev.kind) {
    case 'ball': S.b++; msg = 'ボール'; if (S.b >= 4) { force(); msg = 'フォアボール'; nextBatter(); } break;
    case 'strikeLook': case 'whiff':
      S.s++; msg = ev.kind === 'whiff' ? '空振り' : 'ストライク';
      if (S.s >= 3) { out(); msg = ev.kind === 'whiff' ? '空振り三振！' : '見逃し三振'; nextBatter(); }
      break;
    case 'foul': if (S.s < 2) S.s++; msg = 'ファウル'; break;
    case 'inplay': {
      const r = ev.res;
      if (r === 'FOUL') { if (S.s < 2) S.s++; msg = 'ファウル'; break; }
      if (r === 'E') { adv(1); msg = { P: 'ピッチャー', C: 'キャッチャー', '1B': 'ファースト', '2B': 'セカンド', SS: 'ショート', '3B': 'サード', LF: 'レフト', CF: 'センター', RF: 'ライト' }[ev.who] + 'のエラー！'; S.err = (S.err || 0) + 1; nextBatter(); break; }
      if (r === 'HR') { adv(4); msg = runs >= 4 ? '満塁ホームラン！！' : 'ホームラン！'; S.hits[ti]++; nextBatter(); break; }
      if (r === '1B' || r === '2B' || r === '3B') { adv(ev.bases); msg = { '1B': ev.infield ? '内野安打' : 'ヒット', '2B': 'ツーベース！', '3B': 'スリーベース！' }[r]; S.hits[ti]++; nextBatter(); break; }
      if (r === 'FO') {
        out(); msg = ev.fly ? 'フライアウト' : 'ライナーアウト';
        if (ev.fly && ev.deep && S.outs < 3 && S.bases[2] !== null) { S.bases[2] = null; score(1); msg = '犠牲フライ！'; }
        nextBatter(); break;
      }
      if (r === 'DP' && S.outs < 2 && S.bases[0] !== null) {
        out(2); S.bases[0] = null; msg = 'ゲッツー…';
        if (S.outs < 3) { if (S.bases[2] !== null) { S.bases[2] = null; score(1); } if (S.bases[1] !== null) { S.bases[2] = S.bases[1]; S.bases[1] = null; } }
        nextBatter(); break;
      }
      // ゴロアウト：押し出される走者だけ進む
      out(); msg = 'ゴロアウト';
      if (S.outs < 3) {
        if (S.bases[0] !== null && S.bases[1] !== null && S.bases[2] !== null) { score(1); }
        if (S.bases[0] !== null) { if (S.bases[1] !== null) S.bases[2] = S.bases[1]; S.bases[1] = S.bases[0]; S.bases[0] = null; }
        else if (S.bases[2] !== null && S.outs < 3 && S.bases[1] === null) { /* 三塁走者はとどまる */ }
      }
      nextBatter(); break;
    }
  }
  // 成績
  if (pa) {
    const bx = S.box[ti][runner], k = ev.kind, r = ev.res;
    const walk = k === 'ball', sac = k === 'inplay' && r === 'FO' && /犠牲/.test(msg);
    if (!walk && !sac) bx[0]++;
    if (k === 'inplay' && ['1B', '2B', '3B', 'HR'].includes(r)) bx[1]++;
    if (k === 'inplay' && r === 'HR') bx[2]++;
    if (r !== 'DP' && r !== 'E') bx[3] += runs;
  }
  // 得点
  if (runs) {
    S.score[ti] += runs;
    if (runs > 0 && ev.kind !== 'ball') msg += runs > 1 ? `（${runs}点）` : '（1点）';
    else if (runs) msg += '（押し出し）';
  }
  const li = S.inn - 1; S.line[ti][li] = (S.line[ti][li] || 0) + runs;
  // サヨナラ
  if (!S.top && S.inn >= S.innings && S.score[1] > S.score[0]) { S.over = true; msg += ' サヨナラ！'; }
  let change = false;
  if (!S.over && S.outs >= 3) {
    change = true; S.outs = 0; S.b = 0; S.s = 0; S.bases = [null, null, null];
    if (S.top) {
      if (S.inn >= S.innings && S.score[1] > S.score[0]) S.over = true;
      else S.top = false;
    } else {
      if (S.inn >= S.innings && S.score[0] !== S.score[1]) S.over = true;
      else if (S.inn >= S.innings + 3) S.over = true; // 延長は3回まで
      else { S.inn++; S.top = true; }
    }
    if (!S.over) S.line[batTeamIdx(S)][S.inn - 1] = S.line[batTeamIdx(S)][S.inn - 1] || 0;
  }
  let relief = null;
  {
    const ft = teamById(fi ? S.home : S.away);
    if (pa && !S.over && S.pi[fi] === 0 && ft.rp && S.pc[fi] >= pitchLimit(pitcherOf(ft).sta) + 22) { S.pi[fi] = 1; S.pc[fi] = 0; relief = ft.rp[0]; }
  }
  S.seq++;
  S.last = { msg, runs, change, pa, relief, kind: ev.kind === 'inplay' ? ev.res : ev.kind, who: runner, team: ti };
  return S;
}

// ---------- CPU ----------
export function cpuPitch(pit, S, rng) {
  const ars = Object.keys(pit.ars);
  const w = ars.map(k => k === 'st' ? 3 : 1 + pit.ars[k] * 0.4);
  let r = rng() * w.reduce((a, b) => a + b, 0), type = ars[0];
  for (let i = 0; i < ars.length; i++) { r -= w[i]; if (r <= 0) { type = ars[i]; break; } }
  const behind = S.b >= 2 && S.b > S.s;
  const inside = rng() < (behind ? 0.72 : S.s === 2 ? 0.38 : 0.52);
  let tx, ty;
  if (inside) { tx = (rng() * 2 - 1) * ZONE.x * 0.85; ty = ZONE.y0 + 0.05 + rng() * (ZONE.y1 - ZONE.y0 - 0.1); }
  else { tx = (rng() < 0.5 ? -1 : 1) * (ZONE.x + 0.04 + rng() * 0.12); ty = ZONE.y0 - 0.05 + rng() * (ZONE.y1 - ZONE.y0 + 0.15); }
  if (type === 'fk' || type === 'cu') ty = Math.max(ty, ZONE.y0 + 0.12);
  return { type, tx, ty };
}
// CPU 打者：振るか・どこを振るか（lv 0..2）
export function cpuSwing(pitch, bat, S, rng, lv = 1) {
  const [bx, by] = pitch.end, z = inZone(bx, by);
  const chase = pitch.type === 'fk' || pitch.type === 'cu' || pitch.type === 'sk' ? 0.32 : 0.2;
  const p = z ? (S.s === 2 ? 0.82 : 0.56) : (S.s === 2 ? chase + 0.1 : chase * 0.75);
  if (rng() > p) return null;
  const pw = bat.pow >= 70 && S.b > S.s && S.s < 2 && rng() < 0.5; // 打者有利のカウントで強振
  const r = cursorR(bat, S, pitch, pw), e = r * (0.8 - bat.con / 100 * 0.35) * [1.35, 1.0, 0.75][lv];
  const brkK = Math.hypot(pitch.brk[0], pitch.brk[1]) * 0.12;
  return { cx: bx + rng.n(e + brkK), cy: by + rng.n(e + brkK) - 0.01, dt: rng.n(0.045 * [1.3, 1, 0.8][lv]), pw };
}

// ---------- マイチーム（サクセスで作った選手を入れたチーム） ----------
// 外から来たチームのデータは、ここで数字の範囲と形をそろえてから使う
const POSS = ['投', '捕', '一', '二', '三', '遊', '左', '中', '右'];
const num = (v, a, b, d) => Number.isFinite(+v) ? clamp(Math.round(+v), a, b) : d;
const str = (v, n, d) => typeof v === 'string' && v.trim() ? v.trim().slice(0, n) : d;
const col = (v, d) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : d;
const skin = v => SKINS[v] ? v : 'pink';
const abls = (v, t) => (Array.isArray(v) ? v : []).filter(k => ABIL[k] && ABIL[k].t === t).slice(0, 8);
const ars = v => { const o = { st: 1 }; if (v && typeof v === 'object') for (const k in v) if (PITCHES[k] && k !== 'st') o[k] = num(v[k], 1, 7, 1); return o; };
const imgOk = v => typeof v === 'string' && /^images\/[\w\-\/]+\.webp$/.test(v) ? v : null;
function cleanBat(b, i) {
  b = Array.isArray(b) ? b : [];
  return [str(b[0], 8, '選手' + (i + 1)), POSS.includes(b[1]) ? b[1] : '右', num(b[2], 1, 100, 50), num(b[3], 1, 100, 50), num(b[4], 1, 100, 50), num(b[5], 1, 100, 50), skin(b[6]), b[7] ? 1 : 0,
    num(b[8], 1, 100, 50), num(b[9], 1, 100, 50), num(b[10], 1, 4, 2), abls(b[11], 'b'), imgOk(b[12])];
}
function cleanPit(p, nm) {
  p = Array.isArray(p) ? p : [];
  return [str(p[0], 8, nm), num(p[1], 110, 170, 140), num(p[2], 1, 100, 50), num(p[3], 1, 100, 50), ars(p[4]), skin(p[5]), p[6] ? 1 : 0, abls(p[7], 'p'), imgOk(p[8])];
}
export function cleanTeam(d, id) {
  d = d && typeof d === 'object' ? d : {};
  const bat = Array.from({ length: 9 }, (_, i) => cleanBat((d.bat || [])[i], i));
  // 守備位置がかぶったら、空いている位置に入れ直す
  const used = new Set(); bat.forEach(b => { if (used.has(b[1])) b[1] = POSS.find(p => !used.has(p) && !bat.some(x => x !== b && x[1] === p)) || b[1]; used.add(b[1]); });
  for (const p of POSS) if (!bat.some(b => b[1] === p)) { const dup = bat.find((b, i) => bat.findIndex(x => x[1] === b[1]) !== i); if (dup) dup[1] = p; }
  return { id, n: str(d.n, 14, 'マイチーム'), s: str(d.s, 1, 'マ'), c: col(d.c, '#ff5c8a'), c2: col(d.c2, '#ffffff'), cap: col(d.cap, '#1d2340'), bat, pit: cleanPit(d.pit, '投手'), rp: d.rp ? cleanPit(d.rp, 'リリーフ') : null, custom: true };
}
export function registerTeam(d, id) {
  const t = cleanTeam(d, id), i = TEAMS.findIndex(x => x.id === id);
  if (i >= 0) TEAMS[i] = t; else TEAMS.push(t);
  return t;
}
export const BUILTIN = TEAMS.slice(0, 4).map(t => t.id);
// 試合で使う形にした、チームのデータ（オンラインで相手に送る）
export const teamData = t => ({ n: t.n, s: t.s, c: t.c, c2: t.c2, cap: t.cap, bat: t.bat, pit: t.pit, rp: t.rp });
