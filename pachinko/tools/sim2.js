// 強さごとのヘソ率をたくさんの玉で正確に測る
const B = require('../board.js');
const N = +process.argv[2] || 1500, ps = (process.argv[3] || '.2,.25,.3,.35,.4').split(',').map(Number);
let seed = 11; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (const p of ps) {
  const w = B.makeWorld(rng); let t = 0, shot = 0;
  while (shot < N || w.balls.length) { if (shot < N && t >= shot * .6) { w.launch(p); shot++; } w.step(1 / 60); t += 1 / 60; if (t > N * .6 + 60) break; }
  const s = w.stats; console.log(p, 'heso', (s.heso / N * 100).toFixed(1) + '%', 'pocket', (s.pocket / N * 100).toFixed(1) + '%', 'warp', (s.warp / N * 100).toFixed(1) + '%', 'gate', (s.gate / N * 100).toFixed(1) + '%');
}
