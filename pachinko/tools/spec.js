// スペックと演出の数字を確認する（玉の物理なし・抽選だけ）
// 使い方: node tools/spec.js [mid|ama] [回転数]
const R = require('../rule.js');
const key = process.argv[2] || 'mid', N = +process.argv[3] || 3e6;
const spec = R.SPECS[key];
let seed = 12345; const rng = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

let mode = 'normal', left = 0, chain = 0;
const st = { nSpin: 0, first: 0, rushIn: 0, ltIn: 0, chains: [], payFirst: [], pay: 0 };
const rel = {}; const add = (k, hit) => { rel[k] = rel[k] || [0, 0]; rel[k][0]++; if (hit) rel[k][1]++; };
for (let i = 0; i < N; i++) {
  if (mode === 'normal') st.nSpin++;
  const h = R.makeHold({ mode, spec, saki: 'normal', notify: 'normal', rng });
  if (mode === 'normal') {
    add('リーチ:' + h.reach, h.hit); add('保留:' + h.color, h.hit); if (h.cutin) add('カットイン:' + h.cutin, h.hit);
    if (h.giji > 1) add('擬似連:×' + h.giji, h.hit); if (h.step) add('ステップ:' + h.step, h.hit); add('先バレ:' + h.saki, h.hit);
  }
  if (mode === 'jitan' || R.isHigh(mode)) left--;
  if (h.hit) {
    const r = R.route(spec, mode, rng);
    if (mode === 'normal') { st.first++; chain = 1; st.pay = 0; } else chain++;
    st.pay += r.rounds * R.COUNT * R.PAY_ATK;
    if (r.next === 'rush' && !R.isHigh(mode)) st.rushIn++;
    if (r.lt) st.ltIn++;
    mode = r.next; left = mode === 'jitan' ? spec.jitan : mode === 'lt' ? spec.stLT : spec.st;
  } else if (mode !== 'normal' && left <= 0) {
    st.chains.push(chain); st.payFirst.push(st.pay); mode = 'normal';
  }
}
const avg = a => a.reduce((s, v) => s + v, 0) / a.length;
console.log(`【${spec.name}】${N.toLocaleString()}回転`);
console.log(`初当たり 1/${(st.nSpin / st.first).toFixed(1)}  花火RUSH突入（時短の引き戻し込み） ${(st.rushIn / st.first * 100).toFixed(1)}%  LT突入 ${st.ltIn}回`);
console.log(`花火RUSH継続 ${((1 - Math.pow(1 - spec.probH, spec.st)) * 100).toFixed(1)}%  大輪RUSH継続 ${((1 - Math.pow(1 - spec.probH, spec.stLT)) * 100).toFixed(1)}%  時短引き戻し ${((1 - Math.pow(1 - spec.probN, spec.jitan)) * 100).toFixed(1)}%`);
console.log(`初当たり1回あたり：平均 ${avg(st.chains).toFixed(2)}連・平均出玉 ${Math.round(avg(st.payFirst))}玉（最大 ${Math.max(...st.chains)}連）`);
console.log('\n通常時の演出の信頼度');
for (const [k, [n, h]] of Object.entries(rel).sort()) console.log(k.padEnd(14, '　'), `${(h / n * 100).toFixed(1).padStart(5)}%  （${(n / st.nSpin * 100).toFixed(3)}%の回転で出る）`);
