// CPUの相手ごとの勝ちやすさ（パックを開けた数ごと）
//   node tools/foes.js [試合数]
const fs = require('fs'), path = require('path');
global.window = { SHOW_ALL_SETS: true, CardArt: { flame: () => null, bolt: () => null }, addEventListener() {} };
global.document = { getElementById: () => null }; global.addEventListener = () => {};
const dir = path.join(__dirname, '..');
eval(fs.readFileSync(path.join(dir, 'cards.js'), 'utf8'));
eval(fs.readFileSync(path.join(dir, 'battle.js'), 'utf8'));
const CARDS = window.CARD_DEFS, PB = window.PackBattle;
const N = +process.argv[2] || 300;
const rnd = Math.random, pick = a => a[Math.floor(rnd() * a.length)];
const RW = { C: 48, U: 21.6, R: 24, SR: 5.2, UR: 1.06, SEC: .14 };   // パックの実際の確率（5枚の平均）
function deckFor(packs) {
  const owned = {};
  for (let i = 0; i < packs * 5; i++) { let x = rnd() * 100, r = 'C'; for (const [k, w] of Object.entries(RW)) { x -= w; if (x <= 0) { r = k; break; } } const c = pick(CARDS.filter(c => c.r === r)); owned[c.no] = (owned[c.no] || 0) + 1; }
  PB.init({ S: { owned }, CARDS, tone() {}, chime() {}, esc: s => s });
  const d = PB.autoDeck(); const commons = CARDS.filter(c => c.r === 'C' && c.type === 'M'); while (d.length < 20) d.push(pick(commons).no); return d;
}
(async () => {
  console.log('パック数 → ' + PB.FOES.map(f => f.nm).join(' / '));
  for (const packs of [0, 3, 8, 15, 30, 60]) {
    const row = [];
    for (let lv = 0; lv < PB.FOES.length; lv++) {
      let w = 0; for (let g = 0; g < N; g++) { const r = await PB.simMatch(deckFor(packs), null, { lv, foe: true, skillA: .85 }); if (r.winner === 0) w++; }
      row.push((w / N * 100).toFixed(0).padStart(3) + '%');
    }
    console.log(String(packs).padStart(3) + 'パック: ' + row.join('   '));
  }
})();
