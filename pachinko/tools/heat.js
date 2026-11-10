// 玉の通り道の濃さを書き出す（tools/heat.py で画像にする）
const B = require('../board.js'), fs = require('fs');
const p = +process.argv[2] || .4, N = +process.argv[3] || 400;
let seed = 3; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const w = B.makeWorld(rng), H = new Float32Array(600 * 900);
let t = 0, shot = 0;
while (shot < N || w.balls.length) {
  if (shot < N && t >= shot * .6) { w.launch(p); shot++; }
  w.step(1 / 120); t += 1 / 120;
  for (const b of w.balls) { const x = b.x | 0, y = b.y | 0; if (x >= 0 && y >= 0 && x < 600 && y < 900) H[y * 600 + x]++; }
  if (t > N * .6 + 60) break;
}
fs.writeFileSync(process.argv[4] || 'heat.bin', Buffer.from(H.buffer));
fs.writeFileSync((process.argv[4] || 'heat.bin') + '.json', JSON.stringify({ nails: B.NAILS, segs: B.SEG, P: B.P, stats: w.stats }));
console.log(p, w.stats);
