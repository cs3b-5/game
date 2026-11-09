const fs = require('fs');
eval(fs.readFileSync(process.argv[2] || 'core.js', 'utf8') + ';globalThis.C={TIERS,UPGRADES,CHAPTERS,newCore,step,buyTier,hireMgr,buyUpgrade,startCycle,costOf,tierPerSec,incomePerSec,knowGain,prestige,tierTime,tierRev,nextMilestone};');
const { TIERS, UPGRADES, CHAPTERS } = C;
const S = C.newCore();
const dt = 0.5, END = 8 * 3600;
const hit = [];
let lastPrest = 0, prestLog = [];
function rate(i) { // 1秒あたりの収益（手動は社長が回すとして）
  return C.tierPerSec(S, i);
}
for (let t = 0; t < END; t += dt) {
  // 手動の契約は毎回押す（プレイヤーがタップしている想定）
  for (let i = 0; i < TIERS.length; i++) C.startCycle(S, i);
  C.step(S, dt);
  for (let k = 0; k < 40; k++) {
    let did = false;
    for (let i = 0; i < TIERS.length; i++) if (S.tiers[i].n && !S.tiers[i].mgr && S.money >= TIERS[i].mgr) { C.hireMgr(S, i); did = true; }
    for (const u of UPGRADES) if (!S.ups[u.id] && S.money >= u.cost) { C.buyUpgrade(S, u.id); did = true; }
    // 投資効率が一番いい買い物
    let best = null, bestScore = Infinity;
    for (let i = 0; i < TIERS.length; i++) {
      const n = S.tiers[i].n;
      const before = rate(i) || 0;
      const nm = C.nextMilestone(n);
      const opts = [1];
      if (nm && nm - n <= 100) opts.push(nm - n);
      for (const kk of opts) {
        const cost = C.costOf(S, i, kk);
        S.tiers[i].n += kk; const after = rate(i); S.tiers[i].n -= kk;
        const gain = after - before;
        if (gain <= 0) continue;
        const sc = cost / gain;
        if (sc < bestScore) { bestScore = sc; best = { i, kk, cost }; }
      }
    }
    if (best && S.money >= best.cost) { C.buyTier(S, best.i, best.kk); did = true; }
    if (!did) break;
  }
  while (hit.length < CHAPTERS.length && S.total >= CHAPTERS[hit.length].goal) hit.push(t);
  const g = C.knowGain(S);
  if (g >= Math.max(20, S.know) && t - lastPrest > 1200) { prestLog.push(`${(t/60).toFixed(0)}分 +${g}`); C.prestige(S); lastPrest = t; }
  if (hit.length === CHAPTERS.length) break;
}
console.log('章到達(分):', hit.map((t, i) => `${CHAPTERS[i].name} ${(t / 60).toFixed(0)}`).join(' / '));
console.log('会社売却:', prestLog.join(', ') || 'なし', ' ノウハウ', S.know);
console.log('最終 所持段階:', S.tiers.map(x => x.n).join(','));
