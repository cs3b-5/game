const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const PREST = process.argv[3] || 'auto';
eval(src + ';globalThis.C={TIERS,UPGRADES,CHAPTERS,newCore,step,buyTier,hireMgr,buyUpgrade,startCycle,costOf,tierPerSec,incomePerSec,knowGain,prestige,nextMilestone};');
const { TIERS, UPGRADES, CHAPTERS } = C;
const S = C.newCore();
const dt = 0.5, END = 6 * 3600, marks = [5, 15, 30, 60, 90, 120, 180, 240, 300, 360].map(m => m * 60);
let mi = 0, lastPrest = 0, hit = [], plog = [];
const f = v => v.toExponential(1);
for (let t = 0; t < END; t += dt) {
  for (let i = 0; i < TIERS.length; i++) C.startCycle(S, i);
  C.step(S, dt);
  for (let k = 0; k < 40; k++) {
    let did = false;
    for (let i = 0; i < TIERS.length; i++) if (S.tiers[i].n && !S.tiers[i].mgr && S.money >= TIERS[i].mgr) { C.hireMgr(S, i); did = true; }
    for (const u of UPGRADES) if (!S.ups[u.id] && S.money >= u.cost) { C.buyUpgrade(S, u.id); did = true; }
    let best = null, bs = Infinity;
    for (let i = 0; i < TIERS.length; i++) {
      const n = S.tiers[i].n, before = C.tierPerSec(S, i), nm = C.nextMilestone(n);
      for (const kk of (nm && nm - n <= 100 ? [1, nm - n] : [1])) {
        const cost = C.costOf(S, i, kk); S.tiers[i].n += kk; const g = C.tierPerSec(S, i) - before; S.tiers[i].n -= kk;
        if (g > 0 && cost / g < bs) { bs = cost / g; best = { i, kk, cost }; }
      }
    }
    if (best && S.money >= best.cost) { C.buyTier(S, best.i, best.kk); did = true; }
    if (!did) break;
  }
  while (hit.length < CHAPTERS.length && S.total >= CHAPTERS[hit.length].goal) hit.push((t / 60).toFixed(0));
  const g = C.knowGain(S);
  if (PREST === 'auto' && g >= Math.max(10, S.know * 0.8) && t - lastPrest > 900) { plog.push(`${(t / 60).toFixed(0)}分+${g}`); C.prestige(S); lastPrest = t; }
  if (mi < marks.length && t >= marks[mi]) { console.log(`${marks[mi] / 60}分 total=${f(S.total)} /秒=${f(C.incomePerSec(S))} know=${S.know} 段階=${S.tiers.filter(x => x.n).length}`); mi++; }
}
console.log('章(分):', hit.join(' / '), ' 売却:', plog.join(', '));
