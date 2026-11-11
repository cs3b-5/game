// 弾どうしの強さくらべ：同じレア度の配分で作ったデッキで戦わせる
//   node tools/vs.js A B [試合数]   例：node tools/vs.js 4 1 1000（第四弾のデッキ vs 第一弾のデッキ）
//   第三弾は進化の系統（進化前・2段階目・3段階目）を2〜3本まとめて入れる
const fs = require('fs'), path = require('path');
global.window = { SHOW_ALL_SETS: true, CardArt: { flame: () => null, bolt: () => null }, addEventListener() {} };
global.document = { getElementById: () => null }; global.addEventListener = () => {};
const dir = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(dir, 'cards.js'), 'utf8'));
eval(fs.readFileSync(path.join(dir, 'battle.js'), 'utf8'));
const CARDS = window.CARD_DEFS, PB = window.PackBattle;
PB.init({ S: { owned: {} }, CARDS, tone() {}, chime() {}, esc: s => s });
if (process.env.CM) PB.setCounterMinus(JSON.parse(process.env.CM));
const [SA, SB] = [+process.argv[2] || 4, +process.argv[3] || 1], N = +process.argv[4] || 1000;
const pick = a => a[Math.floor(Math.random() * a.length)];
const MIX = [{ C: 10, U: 6, R: 3, SR: 1 }, { C: 6, U: 7, R: 4, SR: 2, UR: 1 }, { C: 4, U: 6, R: 5, SR: 3, UR: 1, SEC: 1 }];
const LINES = CARDS.filter(c => c.evo && !CARDS.some(x => x.evo === c.no)).map(top => { const l = [top.no]; let e = top.evo; while (e) { l.unshift(e); e = CARDS[e - 1].evo; } return l; });
function deck(set, mix) {
  const d = [];
  if (set === 3) { const ls = LINES.slice().sort(() => Math.random() - .5).slice(0, 2); for (const l of ls) l.forEach((no, k) => { const m = k === l.length - 1 && l.length > 2 ? 1 : 2; for (let i = 0; i < m; i++) d.push(no); }); }
  for (const [r, n] of Object.entries(mix)) {
    const pool = CARDS.filter(c => c.set === set && c.r === r && !c.evo);
    const mons = pool.filter(c => c.type === 'M'), rest = pool.filter(c => c.type !== 'M');
    for (let i = 0; i < n && d.length < 20; i++) { const src = rest.length && Math.random() < .2 ? rest : mons.length ? mons : pool.length ? pool : CARDS.filter(c => c.set === set && !c.evo); d.push(pick(src).no); }
  }
  return d.slice(0, 20);
}
(async () => {
  for (const mix of MIX) {
    let w = 0, n = 0;
    for (let g = 0; g < N; g++) { const r = await PB.simMatch(deck(SA, mix), deck(SB, mix), { first: g % 2 }); if (r.winner >= 0) { n++; if (r.winner === 0) w++; } }
    console.log(`${Object.entries(mix).map(([k, v]) => k + v).join(' ')}: 第${SA}弾の勝率 ${(w / n * 100).toFixed(1)}%（vs 第${SB}弾）`);
  }
})();
