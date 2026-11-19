// =============================================================
//  夜祭り金魚：抽選のルール（画面に依存しないのでNodeでも動く）
//  ・スペック（大当たり確率・ST・時短・ラッキートリガー）
//  ・保留が入った瞬間に「当たりかどうか」と「どんな演出にするか」を決める（先読み）
//  確認：node tools/spec.js
// =============================================================
(function (root) {
'use strict';

// ---------------- スペック ----------------
// mode: normal（通常）/ jitan（夜店チャンス＝時短）/ rush（花火RUSH）/ lt（大輪RUSH＝ラッキートリガー後の上位RUSH）
const SPECS = {
  mid: {
    name: 'ライトミドル', short: 'ミドル',
    probN: 1 / 199.8, probH: 1 / 9.9,   // 通常・RUSH中（ST中）の大当たり確率
    st: 15, stLT: 22,                   // 花火RUSH・大輪RUSHのST回数
    jitan: 100,                         // ヘソ当たりで花火RUSHに入らなかったときの時短
    rushIn: .5,                         // ヘソ当たりの花火RUSH突入率
    lt: 1 / 3,                          // 花火RUSH中の当たりから大輪RUSHへ（ラッキートリガー）
    rHeso: 3, rJitan: 10, rRush: 10, rLT: 10,  // ラウンド数
    label: '1/199.8',
  },
  ama: {
    name: '甘デジ', short: '甘',
    probN: 1 / 99.9, probH: 1 / 9.9,
    st: 10, stLT: 16,
    jitan: 50,
    rushIn: .5,
    lt: 1 / 4,
    rHeso: 3, rJitan: 5, rRush: 5, rLT: 10,
    label: '1/99.9',
  },
};
const COUNT = 10, PAY_ATK = 15;           // 1ラウンド10カウント×15玉＝150玉

function isHigh(mode) { return mode === 'rush' || mode === 'lt'; }
function prob(spec, mode) { return isHigh(mode) ? spec.probH : spec.probN; }
// 当たったときのラウンド数と、終わったあとのモード
function route(spec, mode, rng) {
  if (mode === 'lt') return { rounds: spec.rLT, next: 'lt', lt: false };
  if (mode === 'rush') { const lt = rng() < spec.lt; return { rounds: spec.rRush, next: lt ? 'lt' : 'rush', lt }; }
  if (mode === 'jitan') return { rounds: spec.rJitan, next: 'rush', lt: false };   // 時短中の引き戻し → 花火RUSH
  return { rounds: spec.rHeso, next: rng() < spec.rushIn ? 'rush' : 'jitan', lt: false };
}

// ---------------- 演出の抽選 ----------------
function wpick(rng, table) {             // table: [[値, 重み], ...]
  let s = 0; for (const [, w] of table) s += w;
  let r = rng() * s;
  for (const [v, w] of table) { r -= w; if (r < 0) return v; }
  return table[table.length - 1][0];
}
const COLORS = ['white', 'blue', 'green', 'red', 'gold', 'rainbow'];

// 通常時のリーチ（当たり／ハズレ）。信頼度：ノーマル1%未満・SP 1〜2割・SPSP 4割くらい・全回転は確定
const REACH_N = {
  hit:  [['zen', 3], ['normal', 10], ['sp1', 14], ['sp2', 18], ['spsp', 55]],
  miss: [['none', 909.5], ['normal', 75], ['sp1', 7], ['sp2', 5], ['spsp', 3.5]],
};
// RUSH中は短いリーチだけ（当たりの1割は一発告知）
const REACH_H = {
  hit:  [['none', 10], ['normal', 35], ['sp1', 30], ['sp2', 25]],
  miss: [['none', 82], ['normal', 12], ['sp1', 4], ['sp2', 2]],
};

// 1つの保留の中身を決める
// o = { mode, spec, saki: 'off'|'normal'|'many', notify: 'normal'|'saki'|'ato'|'iwakan', rng }
function makeHold(o) {
  const rng = o.rng, high = isHigh(o.mode);
  const hit = rng() < prob(o.spec, o.mode);
  const notify = o.notify || 'normal';
  // 後告知・違和感のときは、当たりでもハズレと同じ見た目で進めて最後に復活させる
  const hide = hit && (notify === 'ato' || notify === 'iwakan');
  const look = hit && !hide;               // 演出は当たりの分布で選ぶか
  const T = high ? REACH_H : REACH_N;
  let reach = wpick(rng, look ? T.hit : T.miss);
  if (hide && reach === 'zen') reach = 'none';
  const sp = reach === 'sp1' || reach === 'sp2' || reach === 'spsp';
  const h = { hit, reach, giji: 1, step: 0, cutin: null, color: 'white', shown: 'white', saki: false, sakiKaku: false,
    freeze: false, revive: false, ato: false, lamp: false, gim: false, chochin: false };

  if (!high) {
    // 擬似連（×2〜×4）
    h.giji = look ? wpick(rng, [[1, 25], [2, 30], [3, 30], [4, 15]])
      : sp ? wpick(rng, [[1, 55], [2, 30], [3, 13], [4, 2]])
      : reach === 'normal' ? wpick(rng, [[1, 85], [2, 13], [3, 2]])
      : wpick(rng, [[1, 97], [2, 3]]);
    // ステップアップ予告（0＝なし、1〜5段階）
    h.step = look ? wpick(rng, [[0, 35], [2, 5], [3, 20], [4, 22], [5, 18]])
      : sp ? wpick(rng, [[0, 60], [2, 20], [3, 15], [4, 5]])
      : reach === 'normal' ? wpick(rng, [[0, 90], [1, 7], [2, 3]])
      : wpick(rng, [[0, 98.5], [1, 1.5]]);
  }
  // カットイン（SPリーチに発展するとき）
  if (sp) h.cutin = look ? wpick(rng, [['blue', 5], ['green', 15], ['red', 40], ['gold', 30], ['rainbow', 10]])
    : wpick(rng, [['blue', 45], ['green', 35], ['red', 18], ['gold', 2]]);
  // 保留の色（最後の色）と、入ったときに見せる色（保留変化）
  h.color = look ? wpick(rng, [['white', 30], ['blue', 10], ['green', 15], ['red', 25], ['gold', 15], ['rainbow', 5]])
    : sp ? wpick(rng, [['white', 50], ['blue', 20], ['green', 18], ['red', 11], ['gold', 1]])
    : reach === 'normal' ? wpick(rng, [['white', 85], ['blue', 10], ['green', 5]])
    : wpick(rng, [['white', 97], ['blue', 2.5], ['green', .5]]);
  const ci = COLORS.indexOf(h.color);
  h.shown = ci >= 2 && rng() < .45 ? COLORS[Math.floor(rng() * ci)] : h.color;
  // 先バレ（入った瞬間のキュイン）
  const sk = { off: [0, 0, 0], normal: [.35, .05, .003], many: [.6, .12, .01] }[o.saki || 'normal'];
  if (notify === 'saki') { h.saki = hit; h.sakiKaku = hit; }
  else if (notify === 'normal') h.saki = rng() < (look ? sk[0] : sp ? sk[1] : sk[2]);
  // 激アツ・確定系
  if (look && !high) h.freeze = rng() < .08;                       // 変動開始の無音フリーズ（確定）
  if (look && sp) h.revive = rng() < .12;                          // ハズレ目で止まって復活
  if (hide) { h.ato = true; h.revive = true; h.lamp = notify === 'iwakan'; }
  h.gim = look ? rng() < .35 : reach === 'spsp' ? rng() < .25 : sp ? rng() < .05 : false;
  h.chochin = look ? rng() < .3 : reach === 'spsp' ? rng() < .3 : rng() < .002;
  return h;
}

const API = { SPECS, COUNT, PAY_ATK, COLORS, isHigh, prob, route, makeHold, wpick };
if (typeof module !== 'undefined') module.exports = API; else root.Rule = API;
})(this);
