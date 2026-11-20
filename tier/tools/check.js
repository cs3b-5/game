// ティア読み：データとルールの確認  node tier/tools/check.js
const path = require('path');
require(path.join(__dirname, '../data1.js'));
require(path.join(__dirname, '../data2.js'));
const T = require(path.join(__dirname, '../core.js'));
const D = globalThis.TIER_DATA;
let bad = 0; const ng = m => { bad++; console.log('NG', m); };

// ---- データ ----
const sets = Object.values(D.sets);
let words = 0, topics = 0;
for (const s of sets) {
  words += s.words.length; topics += s.topics.length;
  if (!D.genres.some(g => g.id === s.g)) ng(`${s.id}: ジャンル ${s.g} がない`);
  if (s.words.length < 20) ng(`${s.id}: ワードが少ない（${s.words.length}）`);
  const dw = s.words.filter((w, i) => s.words.indexOf(w) !== i); if (dw.length) ng(`${s.id}: ワードが重複 ${dw}`);
  const dt = s.topics.filter((w, i) => s.topics.indexOf(w) !== i); if (dt.length) ng(`${s.id}: お題が重複 ${dt}`);
  for (const w of s.words) if (w.length > 16) ng(`${s.id}: ワードが長い ${w}`);
}
const da = D.all.filter((w, i) => D.all.indexOf(w) !== i); if (da.length) ng(`全員一致のお題が重複 ${da}`);
console.log(`ワードセット ${sets.length} / お題 ${topics}（＋全員一致 ${D.all.length}）/ ワード ${words}`);
for (const g of D.genres) { const ss = sets.filter(s => s.g === g.id); console.log(`  ${g.emo} ${g.name}: ${ss.length}セット・お題${ss.reduce((a, s) => a + s.topics.length, 0)}・ワード${ss.reduce((a, s) => a + s.words.length, 0)}`); }
if (sets.length < 85) ng('ワードセットが85より少ない');
if (topics + D.all.length < 600) ng('お題が600より少ない');

// ---- 点数 ----
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) ng(`${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };
eq(T.scoreGuess([0, 1, 2, 3, 4], [0, 1, 2, 3, 4]).pts, 5 + T.PERFECT_BONUS, '全部ピタリ');
eq(T.scoreGuess([0, 1, 2, 3, 4], [0, 1, 0, 0, 0]).pts, 2, '2つピタリ');
eq(T.scoreGuess([0, 0, 0, 0, -1], [0, 0, 0, 0, 2]), { match: 4, perfect: true, pts: 7, off: 0 }, '主役が置いてないワードは数えない');
const sp = T.scoreParty([0, 1, 2, 3, 4], { a: [0, 1, 2, 3, 4], b: [4, 4, 4, 4, 4] });
eq(sp.mainPts, 3, '主役は平均（(5+1)/2=3）'); eq(sp.wild, [true, true, true, false, false], '大ズレ');
const sa = T.scoreAll({ a: [0, 1, 2], b: [0, 1, 3], c: [0, 2, 3] }, 3);
eq(sa.res.map(r => r.same), [true, false, false], '全員一致の判定'); eq(sa.per.a.pts, 2, '多数派と同じ段の数'); eq(sa.perfect, false, '全部はそろってない');
eq(T.scoreAll({ a: [1, 2], b: [1, 2] }, 2).per.a.pts, 2 + T.PERFECT_BONUS, '全員そろったら＋3');
eq(T.parseWords('海、プール 花火,かき氷\n宿題 海'), ['海', 'プール', '花火', 'かき氷', '宿題'], '自作ワードの区切り');
eq(T.cleanCustom([{ t: 'a', w: ['1', '2'] }, { t: 'b', all: true }, { t: 'c', w: ['1', '2', '3', '4', '5'] }], 'x').length, 2, '自作お題のチェック');

// ---- お題の出かた（同じお題が続かない・5語） ----
const r = T.rng(42), used = new Set(); const seen = new Set();
for (let i = 0; i < 300; i++) { const p = T.pickRound(D, { genres: [] }, r, used); if (p.words.length !== 5 || new Set(p.words).size !== 5) ng('5語にならない'); const k = p.topic + '/' + p.set; if (seen.has(k)) ng('同じお題が出た ' + k); seen.add(k); }
const only = T.pickRound(D, { genres: ['food'] }, r, new Set()); if (only.g !== 'food') ng('ジャンルのしぼりこみ');
const cu = T.pickRound(D, { genres: ['ifs'], custom: [{ t: '自作だよ', w: ['あ', 'い', 'う', 'え', 'お'], by: 'しま' }], useCustom: true }, T.rng(1), new Set());
if (!cu) ng('自作お題つきで選べない');

// ---- ボット同士で遊んだときの平均（ゲームとして当たりすぎ・外れすぎにならないか） ----
let m = 0, n = 0, perf = 0; const rr = T.rng(7), u2 = new Set();
for (let i = 0; i < 2000; i++) { const p = T.pickRound(D, { genres: [] }, rr, u2); const main = T.botBoard(p.topic, p.words, rr, 0.72); const g = T.botBoard(p.topic, p.words, rr, 0.5); const s = T.scoreGuess(main, g); m += s.match; n++; if (s.perfect) perf++; }
console.log(`ボットの平均ピタリ ${(m / n).toFixed(2)} / 5、全部ピタリ ${(perf / n * 100).toFixed(1)}%`);

console.log(bad ? `NG ${bad}件` : 'OK');
process.exit(bad ? 1 : 0);
