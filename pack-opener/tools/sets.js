// 第一弾と第二弾のバランス：同じレア度の配分で作ったデッキどうしを戦わせる
//   node tools/sets.js [試合数]   （LINK=1,1 で連結の強さ：1両あたりの数, HPも上がるか(1/0)）
const fs = require('fs'), path = require('path');
global.window = { CardArt: { flame: () => null, bolt: () => null }, addEventListener() {} };
global.document = { getElementById: () => null }; global.addEventListener = () => {};
const dir = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(dir, 'cards.js'), 'utf8'));
eval(fs.readFileSync(path.join(dir, 'battle.js'), 'utf8'));
const CARDS = window.CARD_DEFS, PB = window.PackBattle;
PB.init({ S: { owned: {} }, CARDS, tone() {}, chime() {}, esc: s => s });
if (process.env.LINK) { const [n, hp, cap] = process.env.LINK.split(',').map(Number); PB.setLink(n, !!hp, cap ?? 2); }
if (process.env.TM) PB.setTrainMinus(JSON.parse(process.env.TM));
const N = +process.argv[2] || 2000;
const pick = a => a[Math.floor(Math.random() * a.length)];
const MIX = [{ C: 10, U: 6, R: 3, SR: 1 }, { C: 6, U: 7, R: 4, SR: 2, UR: 1 }, { C: 4, U: 6, R: 5, SR: 3, UR: 1, SEC: 1 }];
function deck(set, mix) {
  const d = [];
  for (const [r, n] of Object.entries(mix)) {
    const pool = CARDS.filter(c => c.set === set && c.r === r);
    const mons = pool.filter(c => c.type === 'M'), rest = pool.filter(c => c.type !== 'M');
    for (let i = 0; i < n; i++) d.push((rest.length && Math.random() < .2 ? pick(rest) : pick(mons.length ? mons : pool)).no);
  }
  return d;
}
(async () => {
  const out = [];
  for (const mix of MIX) {
    let w = 0, n = 0;
    for (let g = 0; g < N; g++) { const r = await PB.simMatch(deck(2, mix), deck(1, mix), { first: g % 2 }); if (r.winner >= 0) { n++; if (r.winner === 0) w++; } }
    out.push(`${Object.entries(mix).map(([k, v]) => k + v).join(' ')}: 第二弾の勝率 ${(w / n * 100).toFixed(1)}%`);
  }
  console.log(out.join('\n'));
})();
