// 玉が止まる場所を数える
const B = require('../board.js');
let seed = 3; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const spots = {};
for (const p of (process.argv[2] || '.1,.2,.3,.4,.5,.7,.9').split(',').map(Number)) {
  const w = B.makeWorld(rng); let t = 0, shot = 0;
  while (shot < 300 || w.balls.length) {
    if (shot < 300 && t >= shot * .6) { w.launch(p); shot++; }
    w.step(1 / 60); t += 1 / 60;
    for (const b of w.balls) if (b.still > .5) { const k = Math.round(b.x / 4) * 4 + ',' + Math.round(b.y / 4) * 4; spots[k] = (spots[k] || 0) + 1; }
    if (t > 400) break;
  }
}
console.log(Object.entries(spots).sort((a, b) => b[1] - a[1]).slice(0, 15).map(e => e.join(' x')).join('\n'));
