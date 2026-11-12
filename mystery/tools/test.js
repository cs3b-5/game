// 事件をたくさん作って、答えが1つに決まるか・決め手（食いちがう2枚）があるかを確かめる
// 使い方: node tools/test.js [件数]
const M = require('../gen.js');
const N = +(process.argv[2] || 300);
for (const d of Object.keys(M.DIFF)) {
  let ok = 0, fail = 0, noPair = 0, sts = 0, clues = 0, v2 = 0; const t0 = Date.now(); const themes = {};
  for (let s = 1; s <= N; s++) {
    const C = M.generate(s, d); if (!C) { fail++; continue; }
    const cand = M.candidates(C); if (cand.length !== 1 || cand[0] !== C.culprit) { fail++; continue; }
    const lie = C.statements.find(x => x.lie);
    if (!C.statements.some(x => !x.lie && M.pairContradicts(x, lie))) noPair++;
    // 犯人でない人どうしは食いちがわない
    for (const a of C.statements) for (const b of C.statements) if (!a.lie && !b.lie && M.pairContradicts(a, b)) throw new Error('innocent conflict ' + s);
    ok++; sts += C.statements.length; clues += C.clues.length; v2 += C.v2 ? 1 : 0; themes[C.theme] = (themes[C.theme] || 0) + 1;
  }
  console.log(d.padEnd(7), `成功 ${ok}/${N}`, `決め手なし ${noPair}`, `証言 平均${(sts / ok).toFixed(1)}`, `証拠 平均${(clues / ok).toFixed(1)}`, `型② ${v2}`, `${Date.now() - t0}ms`, JSON.stringify(themes));
}
const C = M.generate(42, 'normal');
console.log('\n例：', C.crime.text, C.times[C.crime.t], C.places[C.crime.p], '犯人', C.suspects[C.culprit].nm);
for (const s of C.statements) console.log(' ', C.suspects[s.by].nm, '「' + M.textOf(C, s) + '」', s.lie ? '←ウソ' : '');
for (const q of C.clues) console.log('  証拠:', q.text);
console.log(M.explain(C).join('\n'));
