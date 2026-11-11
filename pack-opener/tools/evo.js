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
// 第三弾：進化の系統を2〜3本（進化前2・2段階目2・3段階目1）入れて、残りはレア度の配分どおり（進化カード以外）
const LINES = CARDS.filter(c => c.evo && !CARDS.some(x => x.evo === c.no)).map(top => { const l = [top.no]; let e = top.evo; while (e) { l.unshift(e); e = CARDS[e - 1].evo; } return l; });
function deck3(mix) {
  const out = [], n = 2 + (Math.random() < .5 ? 1 : 0);
  const ls = LINES.slice().sort(() => Math.random() - .5).slice(0, n);
  for (const l of ls) l.forEach((no, k) => { const m = k === l.length - 1 && l.length > 2 ? 1 : 2; for (let i = 0; i < m; i++) out.push(no); });
  const rest = deck(Math.random() < .5 ? 1 : 3, mix).filter(no => !CARDS[no - 1].evo);
  while (out.length < 20 && rest.length) out.push(rest.shift());
  while (out.length < 20) out.push(pick(CARDS.filter(c => c.set === 3 && c.r === 'C')).no);
  return out.slice(0, 20);
}
(async () => {
  for (const vs of [1, 2]) for (const mix of MIX) {
    let w = 0, n = 0;
    for (let g = 0; g < N; g++) { const r = await PB.simMatch(deck3(mix), deck(vs, mix), { first: g % 2 }); if (r.winner >= 0) { n++; if (r.winner === 0) w++; } }
    console.log(`vs 第${vs}弾 ${Object.entries(mix).map(([k, v]) => k + v).join(' ')}: 第三弾の勝率 ${(w / n * 100).toFixed(1)}%`);
  }
})();
