// CORE-START
// =============================================================
//  経済コア（画面に依存しない）
// =============================================================
const TIERS = [
  { id: 'room',    name: 'ワンルーム', cost: 4e4,      r: 1.07, rev: 1e4,       time: 0.6,   mgr: 1e7 },
  { id: 'apart',   name: '古アパート', cost: 60e4,     r: 1.15, rev: 60e4,      time: 3,     mgr: 15e7 },
  { id: 'house',   name: '戸建て',     cost: 720e4,    r: 1.14, rev: 540e4,     time: 6,     mgr: 1e9 },
  { id: 'mansion', name: 'マンション', cost: 8640e4,   r: 1.13, rev: 4320e4,    time: 12,    mgr: 5e9 },
  { id: 'bldg',    name: '商業ビル',   cost: 1.0368e9, r: 1.12, rev: 5.184e8,   time: 24,    mgr: 1.2e10 },
  { id: 'hotel',   name: 'ホテル',     cost: 1.24416e10, r: 1.11, rev: 6.2208e9, time: 96,   mgr: 1e11 },
  { id: 'tower',   name: 'タワマン',   cost: 1.49299e11, r: 1.10, rev: 7.46496e10, time: 384, mgr: 1.11e12 },
  { id: 'resort',  name: 'リゾート',   cost: 1.79159e12, r: 1.09, rev: 8.95795e11, time: 1536, mgr: 5.55e12 },
  { id: 'island',  name: '人工島',     cost: 2.14991e13, r: 1.08, rev: 1.07495e13, time: 6144, mgr: 1e14 },
  { id: 'moon',    name: '月面都市',   cost: 2.57989e14, r: 1.07, rev: 2.96687e14, time: 36864, mgr: 1e15 },
];
const SPEED_MS = [25, 50, 100, 200, 300, 400];          // 到達ごとに契約時間が半分
const REV_MS = [500, 600, 700, 800, 900, 1000];         // 到達ごとに収益×3
const CHAPTERS = [
  { goal: 1e10, name: '駅裏の小さな店' },
  { goal: 1e14, name: '街の不動産屋' },
  { goal: 1e18, name: '業界の大手' },
  { goal: 1e24, name: '物件王' },
];
const KNOW_DIV = 1e14;      // 会社売却で得られる経営ノウハウの基準
const KNOW_BONUS = 0.02;    // ノウハウ1つにつき収益+2%
const OFFLINE_MAX = 3600;   // 留守中の進行は最大1時間

// 投資（一度きりのアップグレード）
const UPGRADES = (() => {
  const base = [250e3, 500e3, 1e6, 5e6, 10e6, 25e6, 500e6, 1e9, 5e9, 7e9].map(v => v * 1e4);
  const rounds = [1, 1e3, 1e6, 1e9, 1e12, 1e15];
  const list = [];
  rounds.forEach((k, ri) => {
    base.forEach((c, ti) => list.push({ id: `u${ri}-${ti}`, tier: ti, mult: 3, cost: c * k }));
    list.push({ id: `u${ri}-all`, tier: -1, mult: 3, cost: 1e10 * 1e4 * k });
  });
  return list.sort((a, b) => a.cost - b.cost);
})();

function newCore() {
  return {
    v: 2,
    money: 0, run: 0, total: 0,
    know: 0, knowClaimed: 0,
    tiers: TIERS.map((t, i) => ({ n: i === 0 ? 1 : 0, mgr: false, prog: 0, run: false })),
    ups: {},
    fever: 0, feverMult: 1,
    tickets: 0,
    stats: { taps: 0, events: 0, prestiges: 0, playT: 0, cycles: 0 },
    trophies: {},
    chapter: 0,
    savedAt: Date.now(),
  };
}
function speedSteps(n) { let k = 0; for (const m of SPEED_MS) if (n >= m) k++; return k; }
function nextMilestone(n) { for (const m of [...SPEED_MS, ...REV_MS]) if (n < m) return m; return null; }
function tierTime(S, i) { return TIERS[i].time / Math.pow(2, speedSteps(S.tiers[i].n)); }
function globalMult(S) {
  let m = 1 + KNOW_BONUS * S.know;
  for (const u of UPGRADES) if (u.tier === -1 && S.ups[u.id]) m *= u.mult;
  if (S.fever > 0) m *= S.feverMult;
  return m;
}
function tierMult(S, i) {
  let m = 1;
  for (const u of UPGRADES) if (u.tier === i && S.ups[u.id]) m *= u.mult;
  for (const r of REV_MS) if (S.tiers[i].n >= r) m *= 3;
  return m;
}
function tierRev(S, i) { return TIERS[i].rev * S.tiers[i].n * tierMult(S, i) * globalMult(S); }
function tierPerSec(S, i) { return S.tiers[i].n ? tierRev(S, i) / tierTime(S, i) : 0; }
function incomePerSec(S) { let s = 0; for (let i = 0; i < TIERS.length; i++) if (S.tiers[i].mgr) s += tierPerSec(S, i); return s; }
function costOf(S, i, k) {
  const t = TIERS[i], n = S.tiers[i].n;
  return t.cost * Math.pow(t.r, n) * (Math.pow(t.r, k) - 1) / (t.r - 1);
}
function maxBuy(S, i) {
  const t = TIERS[i], n = S.tiers[i].n;
  const k = Math.floor(Math.log(S.money * (t.r - 1) / (t.cost * Math.pow(t.r, n)) + 1) / Math.log(t.r));
  return Math.max(0, k);
}
function earn(S, v) { S.money += v; S.run += v; S.total += v; }
function buyTier(S, i, k) {
  if (k <= 0) return false;
  const c = costOf(S, i, k);
  if (S.money < c) return false;
  S.money -= c;
  S.tiers[i].n += k;
  return true;
}
function hireMgr(S, i) {
  const T = S.tiers[i];
  if (T.mgr || S.money < TIERS[i].mgr || !T.n) return false;
  S.money -= TIERS[i].mgr;
  T.mgr = true;
  return true;
}
function buyUpgrade(S, id) {
  const u = UPGRADES.find(x => x.id === id);
  if (!u || S.ups[id] || S.money < u.cost) return false;
  S.money -= u.cost;
  S.ups[id] = true;
  return true;
}
// 手動の契約をスタート
function startCycle(S, i) {
  const T = S.tiers[i];
  if (!T.n || T.mgr || T.run) return false;
  T.run = true; T.prog = 0;
  return true;
}
// 社長の手伝い：0.5秒ぶん進める（1回で最大1/4周）
function boostCycle(S, i) {
  const T = S.tiers[i];
  if (!T.n || !(T.mgr || T.run)) return 0;
  const add = Math.min(0.25, 0.5 / tierTime(S, i));
  T.prog += add;
  return add;
}
// 時間を進める。戻り値は各段階で完了した契約数
function step(S, dt) {
  const done = new Array(TIERS.length).fill(0);
  S.stats.playT += dt;
  if (S.fever > 0) S.fever = Math.max(0, S.fever - dt);
  for (let i = 0; i < TIERS.length; i++) {
    const T = S.tiers[i];
    if (!T.n || !(T.mgr || T.run)) continue;
    T.prog += dt / tierTime(S, i);
    if (T.prog >= 1) {
      const c = T.mgr ? Math.floor(T.prog) : 1;
      earn(S, tierRev(S, i) * c);
      done[i] = c;
      S.stats.cycles += c;
      if (T.mgr) T.prog -= c; else { T.prog = 0; T.run = false; }
    }
  }
  while (S.chapter < CHAPTERS.length && S.total >= CHAPTERS[S.chapter].goal) S.chapter++;
  return done;
}
function knowPotential(S) { return Math.floor(150 * Math.sqrt(S.total / KNOW_DIV)); }
function knowGain(S) { return Math.max(0, knowPotential(S) - S.knowClaimed); }
function prestige(S) {
  const g = knowGain(S);
  if (g <= 0) return false;
  S.know += g; S.knowClaimed += g;
  S.money = 0; S.run = 0;
  S.tiers = TIERS.map((t, i) => ({ n: i === 0 ? 1 : 0, mgr: false, prog: 0, run: false }));
  S.ups = {};
  S.fever = 0;
  S.stats.prestiges++;
  return g;
}
function offline(S, sec) {
  const s = Math.min(OFFLINE_MAX, Math.max(0, sec));
  const v = incomePerSec(S) * s;
  earn(S, v);
  while (S.chapter < CHAPTERS.length && S.total >= CHAPTERS[S.chapter].goal) S.chapter++;
  return { sec: s, v };
}
// CORE-END
