// 打ち出しの強さごとに、玉がどこへ行くかを数える
// 使い方: node tools/sim.js [玉の数]
const B = require('../board.js');
const N = +process.argv[2] || 600;
let seed = 7; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
console.log('強さ  ヘソ   ワープ  入賞口  スルー  (玉' + N + '個・0.6秒ごと)');
for (let p = 0; p <= 1.001; p += .05) {
  const w = B.makeWorld(rng);
  let t = 0, shot = 0;
  while (shot < N || w.balls.length) {
    if (shot < N && t >= shot * .6) { w.launch(p); shot++; }
    w.step(1 / 60); t += 1 / 60;
    if (t > N * .6 + 60) break;
  }
  const s = w.stats, pct = k => (s[k] / N * 100).toFixed(1).padStart(5) + '%';
  console.log(p.toFixed(2), pct('heso'), pct('warp'), pct('pocket'), pct('gate'), 'left', w.balls.length);
}
