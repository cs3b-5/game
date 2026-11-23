// node takoyaki/tools/check.js [火力] [1秒の操作回数]
// ボットが焼いて、焼き上がりの点数と時間を確かめる
const T = require('../core.js');
const fire = +process.argv[2] || 3, aps = +process.argv[3] || 5;
const s = T.newState(fire), mem = {};
const out = []; let acc = 0, t = 0;
const dt = 0.05;
while (t < 240) {
  T.step(s, dt); t += dt; acc += dt;
  if (acc >= 1 / aps) { acc = 0; const p = T.autoPlan(s, mem); const r = T.autoDo(s, p); if (p && p.a === 'take' && r) out.push({ t: +t.toFixed(1), g: T.grade(r), turns: r.turns }); }
  if (t > 150) mem.noPour = true;
}
const lab = {}; out.forEach(o => lab[o.g.label] = (lab[o.g.label] || 0) + 1);
console.log('火力', fire, '操作/秒', aps, '焼けた数', out.length, '平均点', (out.reduce((a, o) => a + o.g.pts, 0) / out.length).toFixed(1));
console.log('評価', lab);
console.log('最初の1個', out[0] && out[0].t + '秒', '返した回数(平均)', (out.reduce((a, o) => a + o.turns, 0) / out.length).toFixed(1));
console.log(out.slice(0, 5).map(o => `${o.t}s ${o.g.pts}点 ${o.g.label} 色${o.g.color.toFixed(2)} 丸${o.g.shape.toFixed(2)} 中${o.g.core.toFixed(2)}`).join('\n'));
const pk = T.pack(s), s2 = T.newState(1); T.unpack(s2, pk);
console.log('通信サイズ', pk.a.length + pk.x.length, 'バイト');
