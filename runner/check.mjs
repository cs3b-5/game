// コースが必ず抜けられるか調べる：node runner/check.mjs
import { makeGen, OBST } from './gen.js';
let bad = 0, rows = 0, minWin = 1e9;
for (let seed = 1; seed <= 300; seed++) {
  const g = makeGen(seed); const all = g.fill(-30000, 0);
  const obs = all.filter(o => o.kind === 'obst' && (o.type === 'block' || o.type === 'train')), rws = all.filter(o => o.kind === 'row');
  let prev = { lane: 1, z: -20 };
  for (const r of rws) {
    rows++;
    // [r.z, prev.z] のうち、レーン r.lane で壁のない一番長い区間
    const segs = obs.filter(o => o.lane === r.lane).map(o => { const L = OBST[o.type].len; return [o.z - L / 2, o.z + L / 2]; }).filter(([a, b]) => b > r.z && a < prev.z).sort((x, y) => y[1] - x[1]);
    let top = prev.z, best = 0;
    for (const [a, b] of segs) { best = Math.max(best, top - b); top = Math.min(top, a); }
    best = Math.max(best, top - r.z);
    // 安全なレーンの列そのものに壁がないこと
    const onRow = obs.some(o => o.lane === r.lane && Math.abs(o.z - r.z) < OBST[o.type].len / 2 + .5);
    if (best < 3 || onRow) { bad++; if (bad < 4) console.log('NG', seed, r, best, onRow); }
    minWin = Math.min(minWin, best); prev = r;
  }
}
console.log('列', rows, '通れない', bad, '一番せまい入り口', minWin.toFixed(1) + 'm');
