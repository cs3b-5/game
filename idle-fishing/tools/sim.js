// ボットが遊んで、池を移るまでの時間を測る
// 使い方: node tools/sim.js [タップ率0〜1] [回数] [夢の池で遊ぶ時間(時間)]
const F = require('../core.js');
const TAP = +(process.argv[2] || 0), RUNS = +(process.argv[3] || 5), DREAM_T = 3600 * (+(process.argv[4] || 2));
const fmt = s => `${Math.floor(s / 60)}分${String(Math.floor(s % 60)).padStart(2, '0')}秒`;
const res = [];
for (let r = 0; r < RUNS; r++) {
  let seed = 100 + r; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const S = F.newState(); const run = F.makeRun(S, rng);
  const times = [], depths = []; let last = 0;
  for (let t = 0; t < 12 * 3600; t += .1) {
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
        const c = F.upCost(u.k, S.lv[u.k], S); S.lv[u.k]++; const gain = F.perSec(S) - base; S.lv[u.k]--;
        const v = gain / c; if (v > bv) { bv = v; best = u.k; }
      }
      if (best && F.canBuy(S, best)) { F.buy(S, best); run.sync(); } else break;
    }
    if (F.canMove(S)) { times.push(t - last); last = t; F.movePond(S); run.sync(); }
    if (S.pond === F.DREAM - 1 && !S.cleared && S.coins >= F.GOAL) { times.push(t - last); last = t; S.cleared = true; }
    if (S.pond === F.DREAM && S.depth !== S._d) { S._d = S.depth; depths.push(fmt(t - last)); }
    if (S.pond === F.DREAM && t - last > DREAM_T) break;
  }
  const caught = Object.keys(S.zukan).length;
  res.push({ times, caught, lv: S.lv, luck: F.luck(S), charm: S.charm, depths, gold: F.goldCount(S) });
}
for (const r of res) console.log('池ごと:', r.times.map(fmt).join(' / '), '図鑑', r.caught + '/' + F.NFISH, '運', r.luck, '\n  夢の池 深さが増えた時刻:', r.depths.join(' '), '金色', r.gold + '/' + F.NFISH);
