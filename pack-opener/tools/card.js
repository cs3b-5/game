// カード1種ごとの強さ（入れかえテスト）
//   node tools/card.js [1枚あたりの試合数]
// 同じデッキで「コモン2枚」を「調べるカード2枚」に入れかえて、元のデッキと戦わせる。
// 50%ならコモンと同じ強さ。レア度が上がるほど少しずつ高くなるのが理想。
const fs = require('fs'), path = require('path');
global.window = { CardArt: { flame: () => null, bolt: () => null }, addEventListener() {} };
global.document = { getElementById: () => null };
global.addEventListener = () => {};
const dir = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(dir, 'cards.js'), 'utf8'));
eval(fs.readFileSync(path.join(dir, 'battle.js'), 'utf8'));
const CARDS = window.CARD_DEFS, PB = window.PackBattle;
PB.init({ S: { owned: {} }, CARDS, tone() {}, chime() {}, esc: s => s });
// 試すとき：TOT='{"C":5,...}'
if (process.env.TOT) PB.setTotal(JSON.parse(process.env.TOT));
const N = +process.argv[2] || 240;
const only = process.argv[3] ? process.argv[3].split(',').map(Number) : null;
const pick = a => a[Math.floor(Math.random() * a.length)];
const commons = CARDS.filter(c => c.r === 'C' && c.type === 'M').map(c => c.no);
const unc = CARDS.filter(c => c.r === 'U' && c.type === 'M').map(c => c.no);
const rares = CARDS.filter(c => (c.r === 'R' || c.r === 'SR') && c.type === 'M').map(c => c.no);
function baseDeck() {      // コモン10・アンコモン6・R/SR 4 くらいの、ふつうのデッキ
  const d = []; const add = (pool, n) => { for (let i = 0; i < n; i++) d.push(pick(pool)); };
  add(commons, 10); add(unc, 6); add(rares, 4); return d;
}
(async () => {
  const out = [];
  for (const c of CARDS) {
    if (only && !only.includes(c.no)) continue;
    let w = 0, n = 0;
    for (let g = 0; g < N; g++) {
      const base = baseDeck();
      const test = base.slice(); let k = 0;
      for (let i = 0; i < test.length && k < 2; i++) if (commons.includes(test[i])) { test[i] = c.no; k++; }
      const r = await PB.simMatch(test, base, { first: g % 2 });
      if (r.winner >= 0) { n++; if (r.winner === 0) w++; }
    }
    out.push({ c, wr: w / n });
  }
  const R = ['C', 'U', 'R', 'SR', 'UR', 'SEC'];
  out.sort((a, b) => R.indexOf(a.c.r) - R.indexOf(b.c.r) || b.wr - a.wr);
  for (const o of out) console.log(`${String(o.c.no).padStart(2)} ${o.c.type}${o.c.r.padEnd(4)}${o.c.el.padEnd(6)}${(o.wr * 100).toFixed(0).padStart(3)}%  ${o.c.nm}`);
  const g = {}; for (const o of out) { const k = o.c.type + o.c.r; (g[k] = g[k] || []).push(o.wr); }
  console.log('平均:', Object.entries(g).map(([k, v]) => `${k} ${(v.reduce((a, b) => a + b) / v.length * 100).toFixed(0)}%`).join('  '));
})();
