// カードバトルのバランス確認（Node で動く）
//   node tools/bal.js [試合数]
// CPU同士で戦わせて、先攻の勝率・試合の長さ・カードごとの勝率・レア度の強さを出す
const fs = require('fs'), path = require('path');
global.window = { SHOW_ALL_SETS: true, CardArt: { flame: () => null, bolt: () => null }, addEventListener() {} };
global.document = { getElementById: () => null, head: { appendChild() {} }, body: { appendChild() {} }, createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }) };
global.addEventListener = () => {};
const dir = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(dir, 'cards.js'), 'utf8'));
eval(fs.readFileSync(path.join(dir, 'battle.js'), 'utf8'));
const CARDS = window.CARD_DEFS, PB = window.PackBattle;
PB.init({ S: { owned: {} }, CARDS, tone() {}, chime() {}, esc: s => s });
// 試すとき：TOT='{"C":5,...}'
if (process.env.TOT) PB.setTotal(JSON.parse(process.env.TOT));
if (process.env.SB) PB.setSecond(...process.env.SB.split(',').map(Number));   // 後攻のおまけ：ちから,手札
const N = +process.argv[2] || 2000;
const rnd = Math.random, pick = a => a[Math.floor(rnd() * a.length)];
// 「パックを何回か開けた人」のデッキ：レア度の出やすさに合わせてランダムに持っていて、強い順に20枚
const RW = { C: 48, U: 21.6, R: 24, SR: 5.2, UR: 1.06, SEC: .14 };   // パックの実際の確率（5枚の平均）
function collection(packs) {
  const owned = {};
  for (let i = 0; i < packs * 5; i++) {
    let x = rnd() * 100, r = 'C'; for (const [k, w] of Object.entries(RW)) { x -= w; if (x <= 0) { r = k; break; } }
    const c = pick(CARDS.filter(c => c.r === r)); owned[c.no] = (owned[c.no] || 0) + 1;
  }
  return owned;
}
function deckFrom(owned) {
  const saveS = PB.__S; const api = { S: { owned }, CARDS, tone() {}, chime() {}, esc: s => s };
  PB.init(api); const d = PB.autoDeck();
  const commons = CARDS.filter(c => c.r === 'C' && c.type === 'M');
  while (d.length < 20) d.push(pick(commons).no);
  return d;
}
(async () => {
  let firstWins = 0, games = 0, turns = 0, draws = 0;
  const cardStat = {};   // no → [出した試合数, そのうち勝った数]
  const tier = {};       // パック数の差 → 勝率
  for (let g = 0; g < N; g++) {
    const pa = pick([3, 6, 10, 20, 40]), pb = pick([3, 6, 10, 20, 40]);
    const da = deckFrom(collection(pa)), db = deckFrom(collection(pb));
    const r = await PB.simMatch(da, db);
    games++; turns += r.turns;
    if (r.winner < 0) { draws++; continue; }
    if ((r.winner === 0) === r.firstA) firstWins++;
    for (const s of [0, 1]) for (const no of new Set(r.played[s])) { const cs = cardStat[no] || (cardStat[no] = [0, 0]); cs[0]++; if (r.winner === s) cs[1]++; }
    const k = `${pa}vs${pb}`; const t = tier[k] || (tier[k] = [0, 0]); t[0]++; if (r.winner === 0) t[1]++;
  }
  console.log(`試合 ${games}  先攻の勝率 ${(firstWins / (games - draws) * 100).toFixed(1)}%  平均ターン ${(turns / games / 2).toFixed(1)}（1人あたり）  引き分け ${draws}`);
  console.log('パック数ごとの勝率（左の人）:');
  for (const a of [3, 10, 40]) console.log('  ' + [3, 10, 40].map(b => { const t = tier[`${a}vs${b}`]; return `${a}vs${b} ${t ? (t[1] / t[0] * 100).toFixed(0) + '%' : '-'}`; }).join('   '));
  const rows = Object.entries(cardStat).filter(([, v]) => v[0] >= 30).map(([no, v]) => { const c = CARDS[no - 1]; return { no: +no, nm: c.nm, r: c.r, t: c.type, el: c.el, n: v[0], wr: v[1] / v[0] }; });
  rows.sort((a, b) => b.wr - a.wr);
  const show = r => `${String(r.no).padStart(2)} ${r.t}${r.r.padEnd(3)} ${r.el.padEnd(5)} ${(r.wr * 100).toFixed(0).padStart(3)}%  (${r.n})  ${r.nm}`;
  console.log('勝ちやすいカード:'); rows.slice(0, 12).forEach(r => console.log('  ' + show(r)));
  console.log('負けやすいカード:'); rows.slice(-12).forEach(r => console.log('  ' + show(r)));
  const by = k => { const m = {}; for (const r of rows) { const x = m[r[k]] || (m[r[k]] = [0, 0]); x[0] += r.n; x[1] += r.wr * r.n; } return Object.entries(m).map(([a, [n, w]]) => `${a} ${(w / n * 100).toFixed(0)}%`).join('  '); };
  console.log('種類別:', by('t')); console.log('レア度別:', by('r')); console.log('属性別:', by('el'));
})();
