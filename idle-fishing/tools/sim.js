// ボットが遊んで、池を移るまでの時間を測る
// 使い方: node tools/sim.js [タップ率0〜1] [回数]
const F = require('../core.js');
const TAP = +(process.argv[2] || 0), RUNS = +(process.argv[3] || 5);
const fmt = s => `${Math.floor(s / 60)}分${String(Math.floor(s % 60)).padStart(2, '0')}秒`;
const res = [];
for (let r = 0; r < RUNS; r++) {
  let seed = 100 + r; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const S = F.newState(); const run = F.makeRun(S, rng);
  const times = []; let last = 0;
  for (let t = 0; t < 4 * 3600 && S.pond < F.PONDS.length; t += .1) {
    run.step(.1);
    for (const e of run.events) {
      if (e.k === 'bite' && rng() < TAP) run.tap(e.i);
      if (e.k === 'catch' && e.chest) F.applyPrize(S, F.WHEEL[F.spinWheel(rng)]);
    }
    run.events.length = 0;
    if (S.pearls >= F.GACHA_COST) F.gacha(S, rng);
    // 一番お得な強化を買う（値段あたりの1秒の稼ぎの伸び）
    for (let guard = 0; guard < 5; guard++) {
      const base = F.perSec(S); let best = null, bv = 0;
      for (const u of F.UPS) {
        if (!F.canBuy(S, u.k) && S.lv[u.k] >= u.max) continue;
        const c = F.upCost(u.k, S.lv[u.k]); S.lv[u.k]++; const gain = F.perSec(S) - base; S.lv[u.k]--;
        const v = gain / c; if (v > bv) { bv = v; best = u.k; }
      }
      if (best && F.canBuy(S, best)) { F.buy(S, best); run.sync(); } else break;
    }
    if (F.canMove(S)) { times.push(t - last); last = t; F.movePond(S); run.sync(); }
    if (S.pond === F.PONDS.length - 1 && !S.done && S.coins >= F.GOAL) { times.push(t - last); S.done = true; break; }
  }
  const caught = Object.keys(S.zukan).length;
  res.push({ times, caught, lv: S.lv, luck: F.luck(S), charm: S.charm });
}
for (const r of res) console.log('池ごと:', r.times.map(fmt).join(' / '), '図鑑', r.caught + '/45', '運', r.luck);
