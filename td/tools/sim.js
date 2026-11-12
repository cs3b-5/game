// ボットに遊ばせて、ステージごとに勝てるか・ライフがどれだけ残るかを見る
// 使い方: node tools/sim.js [回数] [強化レベル0-3]
require('../engine.js');
const TD = globalThis.TD;
const runs = +process.argv[2] || 3, upL = +process.argv[3] || 0;
const up = upL ? { coin: Math.min(4, upL + 1), life: upL, archer: upL, magic: upL, ice: upL, lightning: upL, laser: upL, cafe: upL } : {};
function bot(stage, endless) {
  const G = TD.newGame(stage, { up, endless });
  const pts = []; for (const pi of G.paths) for (let d = 0; d < pi.L; d += .25) pts.push(TD.posAt(pi, d));
  const cover = (x, y, r) => pts.filter(p => Math.hypot(p.x - x - .5, p.y - y - .5) <= r).length;
  const avail = TD.TORDER.filter(k => TD.TOWERS[k].unlock <= stage);
  const plan = ['archer', 'magic', 'archer', 'ice', 'lightning', 'laser', 'magic', 'archer', 'cafe', 'laser', 'lightning', 'magic'].filter(k => avail.includes(k));
  let pi = 0; TD.callWave(G);
  let t = 0;
  while (!G.over && t < 3000) {
    TD.step(G, .25); t += .25; G.events.length = 0;
    for (let k = 0; k < 3; k++) {
      const want = plan[pi % plan.length], D = TD.TOWERS[want];
      const ups = G.towers.flatMap(tw => TD.nextUp(tw).map(u => ({ tw, ...u }))).filter(u => u.br !== 'B' || ['cafe'].includes(u.tw.type)).filter(u => !(u.tw.lv === 3 && u.br === 'A' && u.tw.type === 'cafe'));
      ups.sort((a, b) => a.tw.lv - b.tw.lv || a.cost - b.cost);
      if (G.towers.length < 3 + G.wave * .5 && G.coins >= D.cost) {
        let best = null, bv = 0; for (let y = 0; y < TD.H; y++) for (let x = 0; x < TD.W; x++) if (TD.canBuild(G, x, y)) { const v = cover(x, y, D.support ? 3 : TD.TOWERS[want].lv[0].range); if (v > bv) { bv = v; best = [x, y]; } }
        if (best) { TD.build(G, want, best[0], best[1]); pi++; continue; }
      }
      if (ups.length && G.coins >= ups[0].cost) { TD.upgrade(G, ups[0].tw, ups[0].br); continue; }
      break;
    }
    if (G.stage >= 1 && G.spells.meteor.cd <= 0 && G.enemies.length >= 4) { let b = null, bv = 0; for (const e of G.enemies) { const v = G.enemies.filter(o => Math.hypot(o.x - e.x, o.y - e.y) < 1.5).length; if (v > bv) { bv = v; b = e; } } if (bv >= 3) TD.cast(G, 'meteor', b.x, b.y); }
    if (G.stage >= 4 && G.spells.freeze.cd <= 0 && G.enemies.some(e => G.paths[e.p].L - e.d < 3)) TD.cast(G, 'freeze');
    if (process.env.EARLY && G.nextIn > 8 && G.enemies.length < 3) TD.callWave(G);
  }
  return G;
}
for (let s = 0; s < TD.MAPS.length; s++) {
  let wins = 0, lives = 0, waveSum = 0;
  for (let r = 0; r < runs; r++) { const G = bot(s); if (G.won) wins++; lives += G.lives; waveSum += G.wave; }
  console.log(`${s + 1}`.padStart(2), TD.MAPS[s].nm.padEnd(10, '　'), `勝ち ${wins}/${runs}`, `残ライフ平均 ${(lives / runs).toFixed(1)}`, `到達ウェーブ ${(waveSum / runs).toFixed(1)}/${TD.makeWaves(s).length}`);
}
if (process.argv[4] === 'endless') for (const s of [0, 6, 11]) { const G = bot(s, true); console.log('エンドレス', s + 1, 'ウェーブ', G.wave); }
if (process.env.DBG) { const s = +process.env.DBG; const G = TD.newGame(s, {}); console.log(TD.makeWaves(s).map((w, i) => i + 1 + ': ' + w.map(g => g.t + '×' + g.n).join(' ')).join('\n')); }
