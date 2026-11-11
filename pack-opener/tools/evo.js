// 第三弾（進化）のバランス：第三弾のカード＋その進化前を入れたデッキ vs 第一弾 / 第二弾のデッキ
//   node tools/evo.js [試合数]
const fs = require('fs'), path = require('path');
global.window = { CardArt: { flame: () => null, bolt: () => null }, addEventListener() {} };
global.document = { getElementById: () => null }; global.addEventListener = () => {};
const dir = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(dir, 'cards.js'), 'utf8'));
eval(fs.readFileSync(path.join(dir, 'battle.js'), 'utf8'));
const CARDS = window.CARD_DEFS, PB = window.PackBattle;
PB.init({ S: { owned: {} }, CARDS, tone() {}, chime() {}, esc: s => s });
const N = +process.argv[2] || 1000;
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
// 第三弾：レア度の配分どおりに引いて、進化カードの進化前を（同じ枚数ぶん）入れかえで入れる
function deck3(mix) {
  const d = deck(3, mix), need = [];
  for (const no of d) { let e = CARDS[no - 1].evo; while (e) { need.push(e); e = CARDS[e - 1].evo; } }
  const out = d.slice();
  for (const b of need) {
    if (out.includes(b)) continue;
    const i = out.findIndex(no => { const c = CARDS[no - 1]; return !c.evo && !need.includes(no) && (c.r === 'C' || c.r === 'U'); });
    if (i < 0) break; out[i] = b;
  }
  return out;
}
(async () => {
  for (const vs of [1, 2]) for (const mix of MIX) {
    let w = 0, n = 0;
    for (let g = 0; g < N; g++) { const r = await PB.simMatch(deck3(mix), deck(vs, mix), { first: g % 2 }); if (r.winner >= 0) { n++; if (r.winner === 0) w++; } }
    console.log(`vs 第${vs}弾 ${Object.entries(mix).map(([k, v]) => k + v).join(' ')}: 第三弾の勝率 ${(w / n * 100).toFixed(1)}%`);
  }
})();
