// =============================================================
//  開封の儀：カードバトル
//  集めたカードで20枚のデッキを作って、夜祭りの相手と戦う。
//  ・ライフ30。毎ターン「ちから」が1ずつ増える（最大8）
//  ・モンスターは場に3体まで。出したターンは休み
//  ・攻撃するとお互いにダメージ（相手が反撃）。属性の相性で1.5倍
//  ・R以上のモンスターは属性ごとの能力を持つ（速攻・守り・再生・吸血・火の粉・祝福）
//  ・魔法：その場で効果（相手を選べるものもある）。フィールド：味方を強化。アイテム：モンスターに持たせて強化＋能力
// =============================================================
(function () {
'use strict';
let A;                       // 開封の儀の本体（index.html）から受け取る道具
const $ = id => document.getElementById(id);
const rnd = Math.random, pick = a => a[Math.floor(rnd() * a.length)];
let FAST = false;               // シミュレーション中は待たない
const wait = ms => FAST ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

// ---------------- ルール ----------------
const LP = 30, MANA_MAX = 8, DECK = 20, HAND_MAX = 8, SLOTS = 3, COPIES = 2;
const COST = { C: 1, U: 2, R: 3, SR: 4, UR: 6, SEC: 7 };
const BEATS = { fire: 'leaf', leaf: 'bolt', bolt: 'water', water: 'fire', light: 'dark', dark: 'light' };
const EL_NM = { fire: '炎', water: '水', leaf: '森', bolt: '雷', dark: '闇', light: '光' };
const EL_C = { fire: '#ff5a2a', water: '#2a8cff', leaf: '#2fb35a', bolt: '#f2b800', dark: '#7a4aff', light: '#ff9ad0' };
// モンスターのATK+HPの合計（レア度が高いほど大きいが、ちから1あたりでは安いカードの方が得）
const TOTAL = { C: 5, U: 7, R: 8, SR: 10, UR: 12, SEC: 13 };
function power(c) {
  const t = TOTAL[c.r] + (c.seed % 3 === 0 ? 1 : 0) + (c.el === 'leaf' && TOTAL[c.r] >= 8 ? 1 : 0);   // カードによって少しちがう（森の大物は少しタフ）
  const share = .38 + ((Math.floor(c.seed / 7) % 7) / 6) * .26;  // ATK寄りか、HP寄りか
  const atk = Math.max(1, Math.round(t * share));
  return { atk, hp: Math.max(1, t - atk) };
}
// ---------------- 能力 ----------------
const KW = {
  haste: { ic: '⚡', nm: '速攻', txt: '出したターンに攻撃できる' },
  guard: { ic: '🛡', nm: '守り', txt: 'これがいる間、相手は守りのモンスターしか攻撃できない' },
  regen: { ic: '♻', nm: '再生', txt: '自分のターンのはじめにHPが全回復' },
  drain: { ic: '🩸', nm: '吸血', txt: '与えたダメージの半分、ライフが回復' },
  spark: { ic: '🔥', nm: '火の粉', txt: '出たとき、敵モンスター全員に1ダメージ' },
  bless: { ic: '✨', nm: '祝福', txt: '出たとき、ライフ回復' },
};
const EL_KW = { bolt: 'haste', water: 'guard', leaf: 'regen', dark: 'drain', fire: 'spark', light: 'bless' };
function traits(c) {
  const k = {};
  if (c.type !== 'M' || c.r === 'C' || c.r === 'U') return k;
  k[EL_KW[c.el]] = 1;
  if (c.no === 73) k.guard = 1;                                // 始祖ネコ：祝福＋守り
  if (c.no === 74) k.haste = 1;                                // 九尾：吸血＋速攻
  return k;
}
function kwText(k) { return Object.keys(k).map(x => `${KW[x].ic}${KW[x].nm}`).join(' '); }
// アイテム：持たせると強くなって、属性の能力がつく
const ITEM = {
  fire: { atk: 3, hp: 1, kw: null, txt: 'ATK+3・HP+1。持たせたとき敵モンスター全員に1ダメージ' },
  water: { atk: 0, hp: 4, kw: 'guard', txt: 'HP+4・守りがつく' },
  leaf: { atk: 0, hp: 2, kw: 'regen', txt: 'HP+2・再生がつく' },
  bolt: { atk: 3, hp: 1, kw: 'haste', txt: 'ATK+3・HP+1。すぐに攻撃できる' },
  dark: { atk: 2, hp: 2, kw: 'drain', txt: 'ATK+2・HP+2・吸血がつく' },
  light: { atk: 2, hp: 2, kw: null, txt: 'ATK+2・HP+2。ライフ+4' },
  light2: { atk: 1, hp: 1, kw: null, txt: 'ATK+1・HP+1。カードを1枚引く' },
};
const itemOf = c => ITEM[c.no === 67 ? 'light2' : c.el];
// tgt: 相手を選ぶ魔法（'mon' モンスター、'any' モンスターか相手の顔）
const SPELL = {
  fire:  { txt: '敵モンスター全員に2ダメージ' },
  water: { txt: '敵モンスター全員を凍らせる（次のターン攻撃できない）。カードを2枚引く' },
  leaf:  { txt: 'ライフ+8。味方モンスター全員のATK+1・HP+2' },
  bolt:  { txt: '敵モンスター1体に7ダメージ、または相手のライフに4ダメージ', tgt: 'any' },
  dark:  { txt: '敵モンスター1体を倒す', tgt: 'mon' },
  light: { txt: '味方モンスター全員のATK+2・HP+1。カードを1枚引く' },
};
function rulesText(c) {
  if (c.type === 'M') { const p = power(c), k = traits(c); return `ATK ${p.atk} / HP ${p.hp}` + Object.keys(k).map(x => `\n${KW[x].ic}${KW[x].nm}：${x === 'bless' ? `出たとき、ライフ+${blessN({ c })}` : KW[x].txt}`).join(''); }
  if (c.type === 'S') return SPELL[c.el].txt;
  if (c.type === 'F') return `味方モンスター全員のATK+1。${EL_NM[c.el]}のモンスターはさらにATK+1・HP+2。出たときカードを1枚引く（場に1枚）`;
  return `味方モンスター1体に：${itemOf(c).txt}（${EL_NM[c.el]}のモンスターならさらに+1/+1）`;
}

// ---------------- 相手 ----------------
// mix: デッキに入れるレア度ごとの枚数（安いカードも入れて、序盤から動けるように）
const FOES = [
  { nm: '金魚すくいの子', icon: '🐟', mix: { C: 17, U: 3 }, lp: 22, reward: 150, ai: .5 },
  { nm: '射的屋のおやじ', icon: '🎯', mix: { C: 11, U: 7, R: 2 }, lp: 25, reward: 300, ai: .7 },
  { nm: '夜店の番長', icon: '🏮', mix: { C: 5, U: 8, R: 5, SR: 2 }, lp: 28, reward: 500, ai: .85 },
  { nm: '花火師のおばば', icon: '🎆', mix: { C: 2, U: 7, R: 6, SR: 3, UR: 2 }, lp: 32, reward: 800, ai: 1 },
  { nm: '祭りの主', icon: '👹', mix: { C: 2, U: 6, R: 5, SR: 4, UR: 2, SEC: 1 }, lp: 36, reward: 1500, ai: 1 },
];
function foeDeck(f) {
  const out = [];
  for (const [r, n] of Object.entries(f.mix)) {
    // モンスター多め（魔法・アイテムは少し）
    const pool = A.CARDS.filter(c => c.r === r);
    const mons = pool.filter(c => c.type === 'M'), rest = pool.filter(c => c.type !== 'M');
    for (let i = 0, guard = 0; i < n && guard < 200; guard++) {
      const c = rest.length && rnd() < .25 ? pick(rest) : pick(mons.length ? mons : pool);
      if (out.filter(x => x === c.no).length < COPIES) { out.push(c.no); i++; }
    }
  }
  return out;
}

// ---------------- デッキ ----------------
function ownedCount(no) { return A.S.owned[no] || 0; }
function cardValue(c) { const p = c.type === 'M' ? power(c) : { atk: 4, hp: 3 }; return (p.atk + p.hp) / Math.max(1, COST[c.r]) + COST[c.r] * .6 + (c.type === 'M' ? 1 : 0) + Object.keys(traits(c)).length * 1.2; }
function autoDeck() {
  // 持っているカードから、モンスターを中心に、魔法・フィールド・アイテムも少し入れる
  const have = A.CARDS.filter(c => ownedCount(c.no) > 0).sort((a, b) => cardValue(b) - cardValue(a));
  const deck = [], cnt = no => deck.filter(x => x === no).length;
  const add = (c, max) => { const n = Math.min(COPIES, ownedCount(c.no), max); while (cnt(c.no) < n && deck.length < DECK) deck.push(c.no); };
  // 1. モンスター16枚まで（ちからが偏らないように）
  const cap = { 1: 4, 2: 5, 3: 4, 4: 3, 6: 2, 7: 2 }, used = {};
  for (const c of have.filter(c => c.type === 'M')) {
    const k = COST[c.r];
    while (cnt(c.no) < Math.min(COPIES, ownedCount(c.no)) && (used[k] || 0) < cap[k] && deck.filter(no => A.CARDS[no - 1].type === 'M').length < 16) { deck.push(c.no); used[k] = (used[k] || 0) + 1; }
  }
  // 2. 魔法2枚・アイテム1枚・フィールド1枚まで
  const spells = have.filter(c => c.type === 'S').sort((a, b) => ({ fire: 5, bolt: 5, dark: 4, water: 3, light: 2, leaf: 1 }[b.el] - { fire: 5, bolt: 5, dark: 4, water: 3, light: 2, leaf: 1 }[a.el]));
  let room = 2; for (const c of spells) { if (room <= 0) break; const b = deck.length; add(c, 1); room -= deck.length - b; }
  room = 1; for (const c of have.filter(c => c.type === 'I')) { if (room <= 0) break; const b = deck.length; add(c, 1); room -= deck.length - b; }
  const els = {}; for (const no of deck) { const c = A.CARDS[no - 1]; if (c.type === 'M') els[c.el] = (els[c.el] || 0) + 1; }
  const land = have.filter(c => c.type === 'F').sort((a, b) => (els[b.el] || 0) - (els[a.el] || 0))[0];
  if (land && (els[land.el] || 0) >= 4) add(land, 1);
  // 3. 残りはモンスターで埋める
  for (const c of have.filter(c => c.type === 'M')) add(c, COPIES);
  return deck.slice(0, DECK);
}
function playerDeck() {
  let d = (A.S.deck || []).filter(no => ownedCount(no) > 0);
  // 持っている枚数より多い分はけずる
  const cnt = {}; d = d.filter(no => (cnt[no] = (cnt[no] || 0) + 1) <= Math.min(COPIES, ownedCount(no)));
  if (!d.length) d = autoDeck();
  // 足りない分はお祭りのレンタルカード（コモン）
  const rental = [];
  const commons = A.CARDS.filter(c => c.r === 'C' && c.type === 'M');
  while (d.length + rental.length < DECK) rental.push(pick(commons).no);
  return { deck: d.slice(0, DECK), rental };
}

// ---------------- バトルの状態 ----------------
let B = null, uid = 0, busy = false, sel = null, targeting = null;
function mkCard(no, rental) {
  const c = A.CARDS[no - 1], p = power(c);
  return { uid: ++uid, no, c, atk: p.atk, hp: p.hp, maxHp: p.hp, buff: 0, sleep: true, rental: !!rental, items: 0, kw: traits(c) };
}
function newSide(nm, deckNos, rentals = []) {
  const deck = deckNos.map(no => mkCard(no)).concat(rentals.map(no => mkCard(no, true)));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { nm, lp: LP, maxLp: LP, mana: 0, maxMana: 0, deck, hand: [], field: [null, null, null], land: null, fatigue: 0 };
}
function cost(card) { return COST[card.c.r]; }
function atkOf(side, m) { return m.atk + m.buff + (side.land ? (side.land.c.el === m.c.el ? 2 : 1) : 0); }
function hpBonus(side, m) { return side.land && side.land.c.el === m.c.el ? 2 : 0; }
function guards(side) { return side.field.filter(m => m && m.kw && m.kw.guard); }
// 攻撃できる相手：守りがいれば守りだけ
function canHit(attSide, target) {
  const foe = other(attSide), g = guards(foe);
  if (!g.length) return true;
  return !!target && g.includes(target);
}
function heal(side, n, why) {
  const before = side.lp; side.lp = Math.min(side.maxLp, side.lp + n);
  const got = side.lp - before;
  if (got > 0) { floatAt(side === B.me ? 'meFace' : 'foeFace', '+' + got, '#7be39a'); if (why) log(`${why}で${side.nm}のライフ+${got}`, side); }
  return got;
}
function hpOf(side, m) { return m.hp + hpBonus(side, m); }
function mult(a, d) { return BEATS[a.c.el] === d.c.el ? 1.5 : 1; }
function other(side) { return side === B.me ? B.foe : B.me; }

function draw(side, n = 1) {
  for (let i = 0; i < n; i++) {
    if (!side.deck.length) { side.fatigue++; hurtFace(side, side.fatigue); log(`${side.nm}の山札が空…${side.fatigue}ダメージ`); continue; }
    const c = side.deck.pop();
    if (side.hand.length >= HAND_MAX) { log(`${side.nm}の手札がいっぱいで「${c.c.nm}」を捨てた`); continue; }
    side.hand.push(c);
  }
}
function hurtFace(side, n) {
  side.lp = Math.max(0, side.lp - n);
  floatAt(side === B.me ? 'meFace' : 'foeFace', '-' + n, '#ff4a5a');
  shake(side === B.me ? 'meFace' : 'foeFace');
}
function damage(side, m, n) {
  m.hp -= n;
  floatAt('u' + m.uid, '-' + n, '#ff4a5a');
}
function cleanup() {
  for (const side of [B.me, B.foe]) side.field = side.field.map(m => (m && hpOf(side, m) <= 0) ? (killFx(m), null) : m);
}
function killFx(m) {
  emit({ k: 'kill', id: 'u' + m.uid });
  if (FAST) return; const el = $('u' + m.uid); if (el) { el.classList.add('dying'); } A.tone(180, .2, 'sawtooth', .04, -80); }

// ---------------- 行動 ----------------
function spellTargets(side, card) {
  const foe = other(side);
  return foe.field.filter(Boolean);
}
function canPlay(side, card) {
  if (cost(card) > side.mana) return false;
  if (card.c.type === 'M') return side.field.some(f => !f);
  if (card.c.type === 'I') return side.field.some(f => f);
  if (card.c.type === 'S') {
    const foes = other(side).field.filter(Boolean), mine = side.field.filter(Boolean);
    if (card.c.el === 'water' || card.c.el === 'dark' || card.c.el === 'fire') return foes.length > 0;
    if (card.c.el === 'light') return mine.length > 0;
    return true;
  }
  return true;
}
function needsTarget(card) { return card.c.type === 'I' ? 'mine' : card.c.type === 'S' ? (SPELL[card.c.el].tgt || null) : null; }
const sideNm = side => side.nm;
// target：アイテムは自分のモンスター、魔法は敵モンスター（bolt は null で顔）
async function play(side, card, target) {
  side.mana -= cost(card);
  side.hand = side.hand.filter(h => h !== card);
  const foe = other(side), t = card.c.type;
  A.tone(520, .08, 'triangle', .04); A.tone(780, .1, 'triangle', .04, 0, .06);
  log(`${sideNm(side)}は「${card.c.nm}」を出した（ちから${cost(card)}）`, side, 'play');
  if (B.rec) B.rec.played[side === B.me ? 0 : 1].push(card.no);
  if (t === 'M') {
    const i = side.field.findIndex(f => !f); side.field[i] = card;
    card.sleep = !card.kw.haste;
    if (card.c.r === 'UR' || card.c.r === 'SEC') { A.chime(card.c.r); bigText(card.c.nm, EL_C[card.c.el]); }
    render();
    if (card.kw.spark) {
      const foes = foe.field.filter(Boolean);
      if (foes.length) { for (const m of foes) damage(foe, m, card.kw.spark); log(`🔥火の粉！ 敵モンスター全員に${card.kw.spark}ダメージ`, side); await wait(300); cleanup(); }
    }
    if (card.kw.bless) {
      heal(side, blessN(card), '✨祝福');
    }
  } else if (t === 'F') {
    if (side.land) log(`「${side.land.c.nm}」は消えた`, side);
    side.land = card;
    draw(side, 1);
  } else if (t === 'I') {
    const m = target || best(side.field.filter(Boolean), m => atkOf(side, m) + hpOf(side, m) + (m.sleep ? 0 : 2));
    const it = itemOf(card.c), bonus = m.c.el === card.c.el ? 1 : 0;
    const da = it.atk + bonus, dh = it.hp + bonus;
    m.buff += da; m.hp += dh; m.maxHp += dh; m.items++;
    if (it.kw) { m.kw = Object.assign({}, m.kw, { [it.kw]: Math.max(1, m.kw[it.kw] || 0) }); if (it.kw === 'haste') m.sleep = false; }
    render(); floatAt('u' + m.uid, `+${da}/+${dh}`, '#7be39a');
    log(`「${m.c.nm}」が「${card.c.nm}」を持った：+${da}/+${dh}${it.kw ? `・${KW[it.kw].ic}${KW[it.kw].nm}` : ''}`, side);
    if (card.c.el === 'fire') { const foes = foe.field.filter(Boolean); for (const x of foes) damage(foe, x, 1); if (foes.length) { await wait(250); cleanup(); } }
    if (card.c.no === 66) heal(side, 4, '天使の王冠');
    if (card.c.no === 67) draw(side, 1);
  } else if (t === 'S') {
    render(); await showSpell(card);
    const foes = foe.field.filter(Boolean), mine = side.field.filter(Boolean);
    const pickT = () => (target && foe.field.includes(target)) ? target : null;
    switch (card.c.el) {
      case 'fire': for (const m of foes) damage(foe, m, 2); log(`敵モンスター全員に2ダメージ`, side); break;
      case 'water': for (const m of foes) { m.frozen = true; m.sleep = true; } log(`敵モンスター${foes.length}体が凍った`, side); draw(side, 2); break;
      case 'leaf': heal(side, 8); for (const m of mine) { m.buff += 1; m.hp += 2; m.maxHp += 2; } log(`ライフ回復、味方は+1/+2`, side); break;
      case 'bolt': { const m = target === 'face' ? null : (pickT() || best(foes, m => Math.min(7, hpOf(foe, m)) * 2 + atkOf(foe, m)));
        if (m) { damage(foe, m, 7); log(`「${m.c.nm}」に7ダメージ`, side); } else { hurtFace(foe, 4); log(`${sideNm(foe)}のライフに4ダメージ`, side); } break; }
      case 'dark': { const m = pickT() || best(foes, m => atkOf(foe, m) * 2 + hpOf(foe, m) + m.items * 3); if (m) { m.hp = -99; log(`「${m.c.nm}」は闇に飲まれた`, side); } break; }
      case 'light': for (const m of mine) { m.buff += 2; m.hp += 1; m.maxHp += 1; } log(`味方のATK+2・HP+1`, side); draw(side, 1); break;
    }
    await wait(350);
    cleanup();
  }
  render();
  await wait(side === B.foe ? 650 : 200);
}
function blessN(m) { return { R: 3, SR: 4, UR: 6, SEC: 6 }[m.c.r] || 3; }
function resetCard(m) { const p = power(m.c); m.atk = p.atk; m.hp = p.hp; m.maxHp = p.hp; m.buff = 0; m.sleep = true; m.items = 0; m.kw = traits(m.c); m.frozen = false; }
function best(arr, f) { let b = null, bv = -1e9; for (const x of arr) { const v = f(x); if (v > bv) { bv = v; b = x; } } return b; }
async function attack(side, m, target) {
  const foe = other(side);
  if (!canHit(side, target)) return;
  m.sleep = true; m.attacked = true;
  const a = atkOf(side, m);
  await lunge('u' + m.uid, target ? 'u' + target.uid : (foe === B.me ? 'meFace' : 'foeFace'));
  if (!target) {
    hurtFace(foe, a); log(`「${m.c.nm}」が${sideNm(foe)}に攻撃！ ライフに${a}ダメージ`, side, 'hit');
    A.tone(140, .15, 'square', .05, -40);
    if (m.kw.drain) heal(side, Math.ceil(a / 2), '吸血');
  } else {
    const d1 = Math.ceil(a * mult(m, target)), d2 = Math.ceil(atkOf(foe, target) * mult(target, m));
    damage(foe, target, d1); damage(side, m, d2);
    const kills = [hpOf(foe, target) <= 0 ? `「${target.c.nm}」を倒した` : '', hpOf(side, m) <= 0 ? `「${m.c.nm}」も倒れた` : ''].filter(Boolean).join('・');
    log(`「${m.c.nm}」→「${target.c.nm}」に${d1}ダメージ${mult(m, target) > 1 ? '（相性◎）' : ''}、反撃${d2}${kills ? '。' + kills : ''}`, side, 'hit');
    A.tone(200, .1, 'square', .05, -60); A.tone(120, .14, 'sawtooth', .04, 0, .05);
    if (m.kw.drain) heal(side, Math.ceil(d1 / 2), '吸血');
    if (target.kw.drain && d2 > 0) heal(foe, Math.ceil(d2 / 2), '吸血');
  }
  render(); await wait(320); cleanup(); render();
  await wait(side === B.foe ? 450 : 150);
}
// ターンのはじめ：再生
function onTurnStart(side) {
  for (const m of side.field) if (m && m.kw.regen && m.hp < m.maxHp) { m.hp = m.maxHp; floatAt('u' + m.uid, '再生', '#7be39a'); }
}

// ---------------- 相手（CPU）の考え ----------------
// 価値：モンスターの強さのめやす
function threat(side, m) { return atkOf(side, m) * 2 + hpOf(side, m) + (m.kw.guard ? 2 : 0) + (m.kw.drain ? 2 : 0) + (m.kw.regen ? 2 : 0) + m.items * 2; }
async function cpuTurn(me = B.foe, skill = FOES[B.lv].ai) {
  const you = other(me);
  const sloppy = () => rnd() > skill;
  // 1. 出す順番：フィールド → 魔法 → モンスター（高い順） → アイテム
  for (let guard = 0; guard < 12 && !over(); guard++) {
    const playable = me.hand.filter(c => canPlay(me, c));
    if (!playable.length) break;
    const mineN = me.field.filter(Boolean).length;
    const land = playable.find(c => c.c.type === 'F' && (!me.land || (me.land.c.el !== c.c.el && me.field.filter(m => m && m.c.el === c.c.el).length > me.field.filter(m => m && m.c.el === me.land.c.el).length)));
    const spells = playable.filter(c => c.c.type === 'S').map(c => ({ c, t: spellPlan(me, c) })).filter(x => x.t);
    const mons = playable.filter(c => c.c.type === 'M').sort((a, b) => cost(b) - cost(a) || (power(b.c).atk + power(b.c).hp) - (power(a.c).atk + power(a.c).hp));
    // ちからを使い切れる組み合わせを少し考える：高いのを出すと何も出せないなら、安いのを2体
    let mon = mons[0] || null;
    if (mon && mons.length >= 2 && me.field.filter(f => !f).length >= 2) {
      const rest = me.mana - cost(mon), two = mons.find((x, k) => k > 0 && cost(x) + cost(mons[mons.length - 1]) <= me.mana && cost(x) + cost(mons[mons.length - 1]) > cost(mon));
      if (rest === 0 && two && cost(two) < cost(mon) && rnd() < .5) mon = two;
    }
    const items = playable.filter(c => c.c.type === 'I' && mineN > 0);
    let choice = null, target = null;
    if (land) choice = land;
    else if (spells.length) { choice = spells[0].c; target = spells[0].t === true ? null : spells[0].t; }
    else if (mon) choice = mon;
    else if (items.length) { choice = items[0]; target = itemTarget(me, choice); }
    if (choice && sloppy() && mon && choice !== mon) { choice = mon; target = null; }
    if (!choice) break;
    await play(me, choice, target === 'none' ? null : target);
  }
  // 2. 攻撃
  for (let loop = 0; loop < 6 && !over(); loop++) {
    const ready = me.field.filter(x => x && !x.sleep);
    if (!ready.length) break;
    const m = best(ready, x => atkOf(me, x));
    const foes = you.field.filter(Boolean), g = guards(you);
    const total = ready.reduce((s, x) => s + atkOf(me, x), 0);
    let target = null;
    if (g.length) {
      // 守りがいる：倒しやすい守りから
      target = best(g, f => (Math.ceil(atkOf(me, m) * mult(m, f)) >= hpOf(you, f) ? 50 : 0) - hpOf(you, f));
    } else if (total < you.lp && foes.length) {
      const a = atkOf(me, m);
      // 倒せて生き残る相手 → 倒せる強い相手 → 顔
      const good = foes.filter(f => Math.ceil(a * mult(m, f)) >= hpOf(you, f) && Math.ceil(atkOf(you, f) * mult(f, m)) < hpOf(me, m));
      const trade = foes.filter(f => Math.ceil(a * mult(m, f)) >= hpOf(you, f) && threat(you, f) >= threat(me, m) * .8);
      const race = me.lp > you.lp + 6 || (you.lp <= 12 && foes.reduce((s, f) => s + atkOf(you, f), 0) < me.lp / 2);
      target = best(good, f => threat(you, f)) || (!race && rnd() < .8 ? best(trade, f => threat(you, f)) : null);
      if (sloppy()) target = rnd() < .5 ? pick(foes) : null;
    }
    await attack(me, m, target);
    if (m.sleep === false) m.sleep = true;   // 攻撃できなかったときの空回り防止
  }
}
// 魔法を使うか、だれに使うか（使わないなら null、相手を選ばないなら true）
function spellPlan(side, card) {
  const foe = other(side), foes = foe.field.filter(Boolean), mine = side.field.filter(Boolean);
  const top = best(foes, m => threat(foe, m));
  switch (card.c.el) {
    case 'fire': { const kills = foes.filter(m => hpOf(foe, m) <= 2).length; return kills >= 2 || (kills >= 1 && foes.length >= 2) ? true : null; }
    case 'water': return foes.reduce((n, m) => n + atkOf(foe, m), 0) >= 7 || foes.length >= 2 ? true : null;
    case 'leaf': return side.lp <= side.maxLp - 8 || mine.length >= 2 ? true : null;
    case 'bolt': { if (foe.lp <= 4) return 'face'; const k = best(foes.filter(m => hpOf(foe, m) <= 7), m => threat(foe, m)); return k && threat(foe, k) >= 10 ? k : (foes.length === 0 && rnd() < .5 ? 'face' : null); }
    case 'dark': return top && threat(foe, top) >= 14 ? top : null;
    case 'light': return mine.filter(m => !m.sleep).length >= 2 || mine.length >= 3 ? true : null;
  }
  return null;
}
function itemTarget(side, card) {
  const mine = side.field.filter(Boolean), it = itemOf(card.c);
  if (it.kw === 'haste') return best(mine, m => (m.sleep ? 10 : 0) + atkOf(side, m)) || null;
  if (it.kw === 'guard') return best(mine, m => hpOf(side, m) + (m.kw.guard ? -10 : 0)) || null;
  return best(mine, m => atkOf(side, m) + hpOf(side, m) + (m.sleep ? 0 : 2) + (m.c.el === card.c.el ? 3 : 0)) || null;
}

// ---------------- ターンの流れ ----------------
let SECOND_BONUS = 1, SECOND_CARD = 0;   // 後攻：最初のターンだけちからが多い・手札が多い
function beginTurn(side) {
  B.turn++;
  side.maxMana = Math.min(MANA_MAX, side.maxMana + 1);
  side.mana = side.maxMana + (B.turn === 2 ? SECOND_BONUS : 0);
  for (const m of side.field) if (m) { m.sleep = !!m.frozen; m.frozen = false; m.attacked = false; }
  onTurnStart(side);
  if (B.turn > 1) { log(`── ${sideNm(side)}のターン ──`, side, 'turn'); draw(side, 1); }
  else log(`── ${sideNm(side)}のターン（先攻） ──`, side, 'turn');
}
function over() { return B && (B.me.lp <= 0 || B.foe.lp <= 0); }
async function startTurn(side) {
  if (!B || B.done) return;
  B.turnSide = side; B.turnAt = Date.now();
  beginTurn(side);
  render();
  banner(side === B.me ? 'あなたのターン' : `${B.foe.nm}のターン`);
  emit({ k: 'turn', host: side === B.me });
  if (over()) return finish();
  if (B.online) { busy = side === B.foe; render(); sync(); return; }
  if (side === B.foe) {
    busy = true; render();
    await wait(900);
    await cpuTurn();
    busy = false;
    if (over()) return finish();
    await wait(400);
    startTurn(B.me);
  } else { busy = false; render(); }
}
async function endTurn() {
  if (busy || B.turnSide !== B.me || over()) return;
  sel = null; targeting = null;
  if (B.guest) { busy = true; render(); send({ t: 'act', a: 'end' }); return; }
  busy = true; render();
  await wait(250);
  startTurn(B.foe);
}
function finish() {
  if (B.online) { if (!B.done) { B.done = true; busy = true; sync(); } return finishOnline(); }
  if (B.done) return; B.done = true; busy = true;
  const win = B.foe.lp <= 0 && B.me.lp > 0;
  const f = FOES[B.lv];
  const bt = A.S.battle || (A.S.battle = { cleared: 0, wins: 0, losses: 0 });
  let coins = win ? f.reward : 30, first = false;
  if (win) { bt.wins++; if (bt.cleared <= B.lv) { bt.cleared = B.lv + 1; first = true; coins += f.reward; } } else bt.losses++;
  A.S.coins += coins; A.save(); A.hud();
  if (win) { A.chime('UR'); A.sparkle(innerWidth / 2, innerHeight / 2, ['#ffc94a', '#ff4fa0', '#fff'], 120, 12); } else A.tone(220, .5, 'triangle', .05, -120);
  setTimeout(() => {
    $('btRes').hidden = false;
    $('btResT').textContent = win ? '勝ち！' : '負け…';
    $('btResT').style.color = win ? '#ffc94a' : '#9aa8a2';
    $('btResM').innerHTML = `${win ? `${f.nm}に勝った` : `${f.nm}に負けた`}<br>コイン +${coins.toLocaleString('ja-JP')}${first ? '（はじめて勝ったボーナス込み）' : ''}`;
    $('btNext').hidden = !(win && B.lv + 1 < FOES.length);
  }, 900);
}

// ---------------- 画面 ----------------
function css() {
  if ($('btStyle')) return;
  const st = document.createElement('style'); st.id = 'btStyle';
  st.textContent = `
.bt { position: fixed; inset: 0; z-index: 30; background: radial-gradient(900px 600px at 50% 40%, #2a1a48, #0c0a1c 75%); display: grid; grid-template-rows: auto auto 1fr auto auto auto; padding: env(safe-area-inset-top, 0px) 0 env(safe-area-inset-bottom, 0px); --bw: min(23vw, 104px, 13vh); user-select: none; -webkit-user-select: none; }
.bt .bar { display: flex; align-items: center; gap: 10px; padding: 8px 12px; }
.bt .who { display: flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 12px; background: rgba(255,255,255,.06); border: 2px solid transparent; font-weight: 900; }
.bt .who.target { border-color: #ff4a5a; box-shadow: 0 0 16px rgba(255,74,90,.7); cursor: crosshair; }
.bt .who .ic { font-size: 1.3rem; }
.bt .lp { font-family: var(--num); font-size: 1.7rem; letter-spacing: .03em; color: #ff8aa0; line-height: 1; min-width: 2ch; }
.bt .lp small { font-family: var(--jp); font-size: .65rem; color: var(--muted); margin-right: 3px; }
.bt .meta { font-size: .72rem; color: var(--muted); line-height: 1.3; }
.bt .mana { display: flex; gap: 3px; flex-wrap: wrap; max-width: 140px; }
.bt .mana i { width: 12px; height: 12px; border-radius: 50%; background: rgba(255,255,255,.12); }
.bt .mana i.on { background: radial-gradient(circle at 35% 35%, #fff, #46e0ff 60%, #1a7aa0); box-shadow: 0 0 6px #46e0ff; }
.bt .field { display: flex; justify-content: center; align-items: center; gap: 8px; padding: 4px 8px; min-height: calc(var(--bw) * 1.36 + 8px); }
.bt .bslot { width: var(--bw); height: calc(var(--bw) * 1.36); border-radius: 10px; border: 2px dashed rgba(255,255,255,.12); display: grid; place-items: center; color: rgba(255,255,255,.2); font-size: .7rem; position: relative; }
.bt .bslot.land { width: calc(var(--bw) * .78); border-style: dotted; }
.bt .mid { display: grid; place-items: center; gap: 6px; padding: 2px 10px; min-height: 0; }
.bt .log { font-size: .78rem; color: #d8d0f0; text-align: center; min-height: 2.6em; max-width: 520px; line-height: 1.3; cursor: pointer; }
.bt .log::after { content: ' 📜'; opacity: .55; font-size: .9em; }
.btLogPanel { position: absolute; right: 0; top: 0; bottom: 0; width: min(340px, 88vw); background: rgba(14,10,30,.97); border-left: 1px solid var(--line); z-index: 41; display: none; grid-template-rows: auto minmax(0, 1fr); box-shadow: -12px 0 30px rgba(0,0,0,.5); padding-top: env(safe-area-inset-top, 0px); }
.btLogPanel.open { display: grid; }
.btLogPanel .hd { display: flex; align-items: center; gap: 8px; padding: 10px 12px; font-weight: 900; }
.btLogPanel .hd .x { margin-left: auto; }
.btLogPanel .list { overflow-y: auto; padding: 0 10px 18px; font-size: .78rem; line-height: 1.45; overscroll-behavior: contain; }
.lg { padding: 3px 8px; border-left: 3px solid rgba(255,255,255,.15); margin: 2px 0; border-radius: 4px; color: #e6e0f6; }
.lg.me { border-color: #46e0ff; background: rgba(70,224,255,.07); }
.lg.foe { border-color: #ff4a5a; background: rgba(255,74,90,.07); }
.lg.turn { border: 0; background: none; color: var(--gold); font-weight: 900; text-align: center; margin-top: 10px; }
.lg.sys { color: var(--muted); }
.bt .top2 .x + .x { margin-left: 6px; }
.bt .top2 .x, .bt .top2 .t, .bt .top2 .meta { white-space: nowrap; }
@media (max-width: 400px) { .bt .top2 .t { display: none; } .bt .top2 .x { padding: 5px 10px; } }
@media (min-width: 1100px) { .bt { padding-right: 300px; } .btLogPanel { display: grid; width: 300px; box-shadow: none; } #btLogClose, #btLogBtn { display: none; } .bt .log::after { content: ''; } }
.bt .turnBtn { padding: 10px 22px; border-radius: 999px; border: 0; background: var(--gold); color: #2a1a00; font-weight: 900; font-size: .95rem; box-shadow: inset 0 -4px 0 rgba(0,0,0,.2); }
.bt .turnBtn:disabled { opacity: .35; }
.bt .hand { display: flex; gap: 6px; overflow-x: auto; padding: 6px 12px 10px; scrollbar-width: none; min-height: calc(var(--bw) * 1.36 + 16px); }
.bt .hand::-webkit-scrollbar { display: none; }
.bt .hand .bc { flex: none; }
.bc { width: var(--bw); height: calc(var(--bw) * 1.36); border-radius: 9px; position: relative; overflow: hidden; background: #1a1430; border: 2px solid var(--rc, #888); box-shadow: 0 4px 12px rgba(0,0,0,.5); cursor: pointer; transition: transform .18s, box-shadow .18s, opacity .3s; font-size: calc(var(--bw) / 9); touch-action: manipulation; }
.bc .pic { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 1 !important; }
.bc .shade { position: absolute; inset: 0; background: linear-gradient(transparent 45%, rgba(0,0,0,.85)); }
.bc .cost { position: absolute; left: 3px; top: 3px; width: 1.9em; height: 1.9em; border-radius: 50%; display: grid; place-items: center; background: radial-gradient(circle at 35% 35%, #fff, #46e0ff 60%, #1a6a90); color: #001a2a; font-family: var(--num); font-size: 1.05em; box-shadow: 0 0 0 2px #fff; }
.bc .elb { position: absolute; right: 3px; top: 3px; width: 1.6em; height: 1.6em; border-radius: 50%; display: grid; place-items: center; color: #fff; font-weight: 900; font-size: .8em; box-shadow: 0 0 0 1.5px rgba(255,255,255,.7); }
.bc .nm { position: absolute; left: 3px; right: 3px; bottom: 1.9em; font-weight: 900; font-size: .78em; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 1px 2px #000; }
.bc .ty { position: absolute; left: 3px; bottom: 3px; font-size: .7em; font-weight: 700; color: #fff; background: rgba(0,0,0,.55); padding: 0 .4em; border-radius: .3em; }
.bc .st { position: absolute; bottom: 2px; font-family: var(--num); font-size: 1.35em; line-height: 1; padding: .05em .3em; border-radius: .3em; color: #fff; text-shadow: 0 1px 2px #000; }
.bc .st.a { left: 2px; background: rgba(200,60,40,.85); }
.bc .st.h { right: 2px; background: rgba(40,140,80,.85); }
.bc .st.h.hurt { background: rgba(200,40,60,.95); }
.bc .rent { position: absolute; left: 50%; top: 40%; transform: translateX(-50%) rotate(-12deg); font-size: .65em; font-weight: 900; background: #fff; color: #333; padding: .1em .4em; border-radius: .3em; opacity: .85; }
.bc .zz { position: absolute; right: 4px; top: 2.1em; font-size: .8em; color: #9ad8ff; font-weight: 900; }
.bc .kw { position: absolute; left: 50%; top: 2.4em; transform: translateX(-50%); font-size: 1.15em; line-height: 1.25; background: rgba(10,6,24,.82); border: 1px solid rgba(255,255,255,.35); border-radius: .6em; padding: .05em .3em; white-space: nowrap; letter-spacing: -.05em; box-shadow: 0 1px 4px rgba(0,0,0,.6); color: #fff; }
.bc.frozen::after { content: '❄'; position: absolute; inset: 0; display: grid; place-items: center; font-size: 2.6em; background: rgba(120,200,255,.28); color: #e8f8ff; text-shadow: 0 0 6px #4ab0ff; }
.bc.guardc { outline: 2px solid rgba(160,220,255,.9); outline-offset: 1px; }
.bc.can { box-shadow: 0 0 0 2px #7be39a, 0 0 14px rgba(123,227,154,.8); }
.bc.no { filter: grayscale(.7) brightness(.6); }
.bc.ready { box-shadow: 0 0 0 2px #ffc94a, 0 0 14px rgba(255,201,74,.85); }
.bc.sel { transform: translateY(-8px) scale(1.06); box-shadow: 0 0 0 3px #fff, 0 0 22px #ffc94a; }
.bc.tgt { box-shadow: 0 0 0 3px #ff4a5a, 0 0 18px rgba(255,74,90,.9); cursor: crosshair; }
.bc.dying { opacity: 0; transform: scale(.6) rotate(8deg); }
.bc.shake, .who.shake { animation: btShake .35s; }
@keyframes btShake { 20% { translate: -5px 0; } 40% { translate: 5px 0; } 60% { translate: -3px 0; } 80% { translate: 3px 0; } }
.btFloat { position: fixed; z-index: 45; font-family: var(--num); font-size: 2rem; letter-spacing: .03em; pointer-events: none; transform: translate(-50%, -50%); text-shadow: 0 2px 0 #000, 0 0 10px #000; animation: btUp .9s ease-out forwards; }
@keyframes btUp { to { transform: translate(-50%, -150%); opacity: 0; } }
.btBanner { position: fixed; left: 50%; top: 44%; z-index: 44; transform: translate(-50%, -50%); font-weight: 900; font-size: 1.7rem; padding: 10px 28px; border-radius: 14px; background: rgba(0,0,0,.75); pointer-events: none; animation: btBan 1.1s ease forwards; white-space: nowrap; }
@keyframes btBan { 0% { opacity: 0; transform: translate(-50%, -50%) scale(.7); } 15% { opacity: 1; transform: translate(-50%, -50%) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; } }
.btSpell { position: fixed; inset: 0; z-index: 43; display: grid; place-items: center; pointer-events: none; background: rgba(0,0,0,.45); animation: btSp .9s ease forwards; }
.btSpell .card { --w: min(200px, 46vw); }
@keyframes btSp { 0% { opacity: 0; } 15%, 80% { opacity: 1; } 100% { opacity: 0; } }
.bt .top2 { display: flex; align-items: center; gap: 8px; padding: 6px 12px 0; }
.bt .top2 .t { font-weight: 900; }
.bt .x { margin-left: auto; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: rgba(255,255,255,.05); font-weight: 700; font-size: .8rem; }
.btSheet { position: fixed; inset: 0; z-index: 46; background: rgba(8,6,20,.82); display: grid; place-items: center; padding: 16px; }
.btSheet .box { width: min(100%, 460px); max-height: 100%; overflow-y: auto; background: #171431; border: 1px solid var(--line); border-radius: 18px; padding: 18px; display: grid; gap: 10px; }
.btSheet h2 { margin: 0; font-weight: 900; font-size: 1.4rem; }
.btSheet p { margin: 0; font-size: .85rem; line-height: 1.6; color: #d8d0f0; }
.btInfo .box { grid-template-columns: auto 1fr; align-items: start; gap: 14px; }
.btInfo .card { --w: min(150px, 34vw); }
.btInfo h3 { margin: 0 0 4px; font-weight: 900; font-size: 1.1rem; }
.btInfo .sub { font-size: .75rem; color: var(--muted); margin-bottom: 6px; }
.btInfo .rt { font-size: .85rem; line-height: 1.6; white-space: pre-line; color: #f0eafc; }
.btInfo .now { margin-top: 8px; font-family: var(--num); font-size: 1.4rem; }
@media (max-width: 420px) { .btInfo .box { grid-template-columns: 1fr; justify-items: center; text-align: center; } }
.foes { display: grid; gap: 8px; }
.foe { display: grid; grid-template-columns: auto 1fr auto; gap: 2px 12px; align-items: center; padding: 10px 12px; border-radius: 12px; border: 1px solid var(--line); background: rgba(255,255,255,.05); text-align: left; }
.foe:disabled { opacity: .4; }
.foe .ic { grid-row: span 2; font-size: 1.8rem; }
.foe b { font-weight: 900; }
.foe small { color: var(--muted); font-size: .72rem; }
.foe .rw { grid-row: span 2; font-family: var(--num); font-size: 1.2rem; color: var(--gold); }
.deckGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 8px; --bw: 78px; }
.deckGrid .item { position: relative; }
.deckGrid .item .n { position: absolute; right: -4px; top: -6px; z-index: 2; font-family: var(--num); background: var(--gold); color: #2a1a00; border-radius: 999px; padding: 0 7px; font-size: 1rem; }
.deckGrid .item.out .bc { filter: grayscale(.8) brightness(.5); }
.btRow { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.online { display: grid; gap: 8px; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, rgba(255,61,106,.12), rgba(70,224,255,.1)); border: 1px solid rgba(255,255,255,.14); }
.online h3 { margin: 0; font-weight: 900; font-size: 1.05rem; }
.online input { font: inherit; color: inherit; background: rgba(0,0,0,.35); border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; min-width: 0; flex: 1; font-size: 16px; }
.nameRow { display: flex; align-items: center; gap: 8px; font-size: .85rem; font-weight: 700; }
.codeBox { font-size: .9rem; } .codeBox b { font-family: var(--num); font-size: 2.6rem; letter-spacing: .2em; color: var(--gold); vertical-align: middle; margin-left: 8px; }
.onStatus { font-size: .78rem; color: var(--muted); line-height: 1.5; }
@media (min-width: 760px) { .bt { --bw: min(108px, 13vh); } }
@media (max-height: 560px) and (orientation: landscape) {
  .bt { --bw: min(80px, calc((100vh - 36px) / 4.55)); grid-template-columns: minmax(0, 1fr) minmax(150px, 24vw); grid-template-rows: auto auto auto 1fr; grid-template-areas: "ff fb" "mid fb" "mf mb" "hand mb"; padding-left: env(safe-area-inset-left, 0px); padding-right: env(safe-area-inset-right, 0px); }
  .bt .top2 { position: absolute; right: 8px; top: 4px; padding: 0; z-index: 2; } .bt .top2 .t, .bt .top2 #btTurn { display: none; }
  #foeField { grid-area: ff; } .bt .mid { grid-area: mid; } #meField { grid-area: mf; } #meHand { grid-area: hand; }
  .bt .bar { flex-direction: column; align-items: stretch; justify-content: center; gap: 6px; padding: 4px 8px; }
  #foeBar { grid-area: fb; padding-top: 34px; } #meBar { grid-area: mb; }
  .bt .bar > span[style] { display: none; }
  .bt .field { padding: 2px 6px; min-height: 0; }
  .bt .log { min-height: 1.2em; font-size: .68rem; }
  .bt .turnBtn { padding: 8px 10px; }
  .bt .hand { padding: 2px 8px 4px; min-height: 0; }
}
@media (prefers-reduced-motion: reduce) { .bc, .btFloat, .btBanner, .btSpell { animation: none !important; transition: none !important; } }
`;
  document.head.appendChild(st);
}
function shell() {
  if ($('bt')) return;
  const el = document.createElement('section');
  el.className = 'bt'; el.id = 'bt'; el.hidden = true;
  el.innerHTML = `
    <div class="top2"><span class="t">カードバトル</span><span class="meta" id="btTurn"></span><button class="x" id="btLogBtn">📜 ログ</button><button class="x" id="btQuit">やめる</button></div>
    <div class="bar" id="foeBar"><div class="who" id="foeFace"><span class="ic" id="foeIc"></span><span><span class="lp"><small>LIFE</small><span id="foeLp"></span></span><div class="meta" id="foeMeta"></div></span></div><div class="mana" id="foeMana"></div></div>
    <div class="field" id="foeField"></div>
    <div class="mid"><div class="log" id="btLog"></div></div>
    <div class="field" id="meField"></div>
    <div class="bar" id="meBar"><div class="who" id="meFace"><span class="ic">🙂</span><span><span class="lp"><small>LIFE</small><span id="meLp"></span></span><div class="meta" id="meMeta"></div></span></div><div class="mana" id="meMana"></div><span style="flex:1"></span><button class="turnBtn" id="btEnd">ターン終了</button></div>
    <div class="hand" id="meHand"></div>
    <div class="btLogPanel" id="btLogPanel"><div class="hd">📜 戦闘ログ<button class="x" id="btResBack" hidden>結果にもどる</button><button class="x" id="btLogClose">とじる</button></div><div class="list" id="btLogList"></div></div>
    <div class="btSheet" id="btRes" hidden><div class="box"><h2 id="btResT"></h2><p id="btResM"></p><div class="btRow"><button class="bigbtn" id="btNext">次の相手へ</button><button class="bigbtn" id="btAgain">もう一度</button><button class="ghost" id="btBack">相手を選ぶ</button><button class="ghost" id="btResLog">📜 ログを見る</button></div></div></div>`;
  document.body.appendChild(el);
  const menu = document.createElement('div');
  menu.className = 'btSheet'; menu.id = 'btMenu'; menu.hidden = true;
  menu.innerHTML = `<div class="box">
    <h2>カードバトル</h2>
    <p>集めたカードで20枚のデッキを作って戦う。相手のライフを0にしたら勝ち。勝つとコインがもらえる。</p>
    <div class="foes" id="btFoes"></div>
    <div class="online">
      <h3>オンライン対戦</h3>
      <label class="nameRow">名前 <input id="onName" maxlength="10" placeholder="ななしの金魚" autocomplete="off"></label>
      <div class="btRow"><button class="bigbtn" id="onRandom">ランダムマッチ</button><button class="ghost" id="onHost">部屋を作る</button></div>
      <div class="btRow"><input id="onJoinCode" inputmode="numeric" maxlength="4" placeholder="部屋番号（4けた）" autocomplete="off"><button class="ghost" id="onJoin">入る</button></div>
      <div class="codeBox" id="onCodeBox" hidden>部屋番号 <b id="onCode"></b></div>
      <div class="onStatus" id="onStatus">友達と同じページを開いて遊ぶ。勝つとコイン+${ONLINE_REWARD}（1日${ONLINE_DAILY}回まで）</div>
      <button class="ghost" id="onCancel" hidden>やめる</button>
    </div>
    <div class="btRow"><button class="ghost" id="btDeck">デッキを見る・組む</button><button class="ghost" id="btHow">遊び方</button><button class="ghost" id="btClose">もどる</button></div>
  </div>`;
  document.body.appendChild(menu);
  const deck = document.createElement('div');
  deck.className = 'btSheet'; deck.id = 'btDeckSheet'; deck.hidden = true;
  deck.innerHTML = `<div class="box">
    <h2>デッキ <span id="dkCount" style="font-family:var(--num);font-weight:400"></span></h2>
    <p id="dkNote"></p>
    <div class="btRow"><button class="bigbtn" id="dkAuto">おまかせで組む</button><button class="ghost" id="dkClear">全部はずす</button><button class="ghost" id="dkDone">決定</button></div>
    <div class="deckGrid" id="dkGrid"></div>
  </div>`;
  document.body.appendChild(deck);
  const info = document.createElement('div');
  info.className = 'btSheet btInfo'; info.id = 'btInfo'; info.hidden = true;
  info.innerHTML = `<div class="box"><div id="btInfoCard"></div><div><h3 id="btInfoNm"></h3><div class="sub" id="btInfoSub"></div><div class="rt" id="btInfoRt"></div><div class="now" id="btInfoNow"></div></div></div>`;
  document.body.appendChild(info);
  info.addEventListener('click', () => { info.hidden = true; });
  const how = document.createElement('div');
  how.className = 'btSheet'; how.id = 'btHowSheet'; how.hidden = true;
  how.innerHTML = `<div class="box"><h2>遊び方</h2>
    <p>・毎ターン<b>ちから</b>（青い玉）が1つずつ増える（最大8）。カードの左上の数字がちから。後攻は最初のターンだけちから+1<br>
    ・<b>モンスター</b>は場に3体まで。出したターンは休み<br>
    ・自分のモンスターをタップ→相手のモンスターか相手の顔をタップで攻撃。モンスター同士はお互いにダメージ<br>
    ・<b>属性の相性</b>：炎→森→雷→水→炎、光⇔闇。有利なら1.5倍<br>
    ・<b>R以上のモンスターは能力</b>を持つ：⚡速攻（すぐ攻撃できる）／🛡守り（いる間、相手は守りしか攻撃できない）／♻再生（ターンのはじめに全回復）／🩸吸血（与えたダメージの半分ライフ回復）／🔥火の粉（出たとき敵全員に1ダメージ）／✨祝福（出たときライフ回復）<br>
    ・<b>魔法</b>は出すとすぐ効果。相手を選ぶ魔法は、出したあと相手をタップ。<b>フィールド</b>は味方全員を強化（同じ属性はもっと）。<b>アイテム</b>は自分のモンスターをタップして持たせる。属性ごとの能力もつく<br>
    ・カードを長押しすると、くわしい効果が見られる。📜で戦闘ログ<br>
    ・カードが20枚に足りないときは、お祭りの<b>レンタルカード</b>が入る</p>
    <div class="btRow"><button class="bigbtn" id="howOk">わかった</button></div></div>`;
  document.body.appendChild(how);
  // 操作
  $('btQuit').onclick = () => {
    if (B && !B.done && !confirm('バトルをやめますか？（負けになります）')) return;
    if (B && !B.done) { B.me.lp = 0; B.done = true; if (B.online) { const on = A.S.online || (A.S.online = { wins: 0, losses: 0, day: '', n: 0 }); on.losses++; } else (A.S.battle || (A.S.battle = { cleared: 0, wins: 0, losses: 0 })).losses++; A.save(); }
    netClose(); closeBattle(); openMenu();
  };
  $('btEnd').onclick = endTurn;
  $('btLogBtn').onclick = () => { $('btLogPanel').classList.add('open'); renderLog(); };
  $('btResLog').onclick = () => { $('btRes').hidden = true; $('btLogPanel').classList.add('open'); renderLog(); $('btResBack').hidden = false; };
  $('btLogClose').onclick = () => { $('btLogPanel').classList.remove('open'); if (B && B.done && !$('btResBack').hidden) $('btRes').hidden = false; $('btResBack').hidden = true; };
  $('btResBack').onclick = () => { $('btLogPanel').classList.remove('open'); $('btResBack').hidden = true; $('btRes').hidden = false; };
  $('btLog').onclick = e => { e.stopPropagation(); $('btLogPanel').classList.add('open'); renderLog(); };
  $('btNext').onclick = () => { $('btRes').hidden = true; startBattle(B.lv + 1); };
  $('btAgain').onclick = () => {
    if (B && B.online) {
      if (!NET) return;
      if (NET.role === 'host') { NET.rematchMe = true; if (NET.rematchThem) rematchGo(); else log('相手が「もう一度」を押すのを待っています…'); }
      else { send({ t: 'rematch' }); $('btAgain').disabled = true; $('btAgain').textContent = '相手を待っています…'; }
      return;
    }
    $('btRes').hidden = true; startBattle(B.lv);
  };
  $('btBack').onclick = () => { $('btRes').hidden = true; netClose(); closeBattle(); openMenu(); };
  $('btClose').onclick = () => { netClose(); $('btMenu').hidden = true; };
  $('onName').value = A.S.name || '';
  $('onName').addEventListener('change', e => { A.S.name = e.target.value.trim().slice(0, 10); A.save(); });
  const start = fn => async () => {
    A.S.name = $('onName').value.trim().slice(0, 10); A.save();
    $('onCodeBox').hidden = true; $('onCancel').hidden = false;
    try { await fn(); } catch (e) { netStatus('つなげなかった（' + (e.type || e.message) + '）', true); }
  };
  $('onRandom').onclick = start(randomMatch);
  $('onHost').onclick = start(hostRoom);
  $('onJoin').onclick = start(() => joinRoom($('onJoinCode').value.trim()));
  $('onCancel').onclick = () => { netClose('やめた'); $('onCodeBox').hidden = true; $('onCancel').hidden = true; };
  $('btHow').onclick = () => { $('btHowSheet').hidden = false; };
  $('howOk').onclick = () => { $('btHowSheet').hidden = true; };
  $('btDeck').onclick = openDeck;
  $('dkAuto').onclick = () => { A.S.deck = autoDeck(); A.save(); renderDeck(); };
  $('dkClear').onclick = () => { A.S.deck = []; A.S.deckEmpty = true; A.save(); renderDeck(); };
  $('dkDone').onclick = () => { $('btDeckSheet').hidden = true; renderMenu(); };
  $('dkGrid').addEventListener('click', e => {
    const it = e.target.closest('.item'); if (!it) return;
    const no = +it.dataset.no, d = A.S.deck || (A.S.deck = []);
    const n = d.filter(x => x === no).length, max = Math.min(COPIES, ownedCount(no));
    if (n < max && d.length < DECK) d.push(no);
    else { let k = d.length; while (k--) if (d[k] === no) { d.splice(k, 1); break; } if (n >= max) while (d.includes(no)) d.splice(d.indexOf(no), 1); }
    A.save(); renderDeck();
  });
  // 盤面のタップ
  $('bt').addEventListener('click', onTap);
  // 長押しで大きく見る
  let hold = null;
  const onHold = el => e => { const c = e.target.closest('.bc'); if (!c) return; hold = setTimeout(() => { hold = 'done'; showInfo(+c.dataset.uid, +c.dataset.no); }, 480); };
  $('bt').addEventListener('pointerdown', onHold());
  $('dkGrid').addEventListener('pointerdown', onHold());
  $('dkGrid').addEventListener('pointerup', () => { if (hold && hold !== 'done') clearTimeout(hold); });
  $('dkGrid').addEventListener('click', e => { if (hold === 'done') { e.stopImmediatePropagation(); hold = null; } }, true);
  $('dkGrid').addEventListener('contextmenu', e => e.preventDefault());
  const cancel = () => { if (hold && hold !== 'done') clearTimeout(hold); setTimeout(() => { hold = null; }, 0); };
  $('bt').addEventListener('pointerup', cancel); $('bt').addEventListener('pointercancel', cancel); $('bt').addEventListener('pointerleave', cancel);
  $('bt').addEventListener('click', e => { if (hold === 'done') { e.stopImmediatePropagation(); hold = null; } }, true);
  $('bt').addEventListener('contextmenu', e => e.preventDefault());
}
// 長押しで出す「くわしい情報」
function findCard(uid) {
  if (!B || !uid) return null;
  for (const sd of [B.me, B.foe]) for (const m of [...sd.field, ...sd.hand, sd.land]) if (m && m.uid === uid && !m.hidden) return { m, side: sd, onField: sd.field.includes(m) };
  return null;
}
function battleText(c) {
  let t = rulesText(c);
  if (c.type === 'M') t += `\n相性：${EL_NM[c.el]}は${EL_NM[BEATS[c.el]]}に強い（1.5倍）`;
  return t;
}
function showInfo(uid, no) {
  const f = findCard(uid), c = f ? f.m.c : A.CARDS[no - 1];
  if (!c) return;
  $('btInfoCard').innerHTML = A.cardHTML(c);
  $('btInfoNm').textContent = c.nm;
  $('btInfoSub').textContent = `${{ M: 'モンスター', S: '魔法', F: 'フィールド', I: 'アイテム' }[c.type]}・${EL_NM[c.el]}・${c.r}・ちから${COST[c.r]}`;
  let rt = battleText(c);
  if (f && f.onField) {
    const base = traits(c), extra = Object.keys(f.m.kw || {}).filter(k => !base[k]);
    if (extra.length) rt += '\nアイテムでついた能力：' + extra.map(k => `${KW[k].ic}${KW[k].nm}（${KW[k].txt}）`).join('、');
    if (f.m.items) rt += `\n持っているアイテム：${f.m.items}こ`;
    if (f.m.frozen) rt += '\n❄凍っている（次のターン攻撃できない）';
  }
  $('btInfoRt').textContent = rt;
  $('btInfoNow').textContent = f && f.onField ? `いま ATK ${atkOf(f.side, f.m)} / HP ${hpOf(f.side, f.m)}` : '';
  $('btInfo').hidden = false;
  A.tone(700, .06, 'sine', .03);
}
function cardEl(side, m, opts = {}) {
  const c = m.c, t = c.type, rc = { C: '#9aa3ad', U: '#5fc27a', R: '#4aa3ff', SR: '#c77dff', UR: '#ffb020', SEC: '#ff4fa0' }[c.r];
  let st = '';
  if (t === 'M') {
    const a = side ? atkOf(side, m) : m.atk, h = side ? hpOf(side, m) : m.hp;
    st = `<span class="st a">${a}</span><span class="st h ${side && h < m.maxHp + hpBonus(side, m) ? 'hurt' : ''}">${h}</span>`;
  } else st = `<span class="ty">${{ S: '魔法', F: 'フィールド', I: 'アイテム' }[t]}</span>`;
  const cls = ['bc', opts.cls || '', m.frozen ? 'frozen' : '', side && m.kw && m.kw.guard ? 'guardc' : ''].join(' ');
  return `<div class="${cls}" id="${opts.id || ''}" data-uid="${m.uid || ''}" data-no="${c.no}" style="--rc:${rc}">
    <img class="pic" src="images/${String(c.no).padStart(3, '0')}.jpg" alt="" onerror="this.style.display='none'">
    <div class="shade"></div><div class="cost">${COST[c.r]}</div><div class="elb" style="background:${EL_C[c.el]}">${EL_NM[c.el]}</div>
    ${t === 'M' && m.kw && Object.keys(m.kw).length ? `<span class="kw">${Object.keys(m.kw).map(x => KW[x].ic).join('')}</span>` : ''}
    <div class="nm">${A.esc(c.nm)}</div>${st}${m.rental ? '<span class="rent">レンタル</span>' : ''}${opts.zz ? '<span class="zz">zz</span>' : ''}</div>`;
}
function render() {
  if (!B || FAST) return;
  const me = B.me, foe = B.foe, myTurn = B.turnSide === me && !busy && !over();
  $('btTurn').textContent = `ターン ${Math.ceil(B.turn / 2)}`;
  $('foeIc').textContent = B.online ? '🧑' : FOES[B.lv].icon;
  if (B.online && !B.done) $('btTurn').textContent = `ターン ${Math.ceil(B.turn / 2)}・のこり${Math.max(0, Math.ceil(TURN_LIMIT - (Date.now() - B.turnAt) / 1000))}秒`;
  $('foeLp').textContent = foe.lp; $('meLp').textContent = me.lp;
  $('foeMeta').textContent = `${foe.nm}・手札${foe.hand.length}・山札${foe.deck.length}`;
  $('meMeta').textContent = `${B.online ? myName() + '・' : ''}山札${me.deck.length}`;
  const gems = s => Array.from({ length: Math.max(s.maxMana, 1) }, (_, i) => `<i class="${i < s.mana ? 'on' : ''}"></i>`).join('');
  $('foeMana').innerHTML = gems(foe); $('meMana').innerHTML = gems(me);
  const fieldHTML = (side, isMe) => {
    const land = side.land ? cardEl(null, side.land, { cls: 'landc' }) : `<span>フィールド</span>`;
    let h = `<div class="bslot land">${land}</div>`;
    side.field.forEach((m, i) => {
      if (!m) { h += `<div class="bslot" data-slot="${i}">${isMe && targeting === 'slot' ? '' : ''}</div>`; return; }
      let cls = '';
      if (isMe && myTurn && !m.sleep) cls = sel === m ? 'sel' : 'ready';
      if (isMe && targeting && targeting.type === 'item') cls = 'tgt';
      if (!isMe && sel && canHit(me, m)) cls = 'tgt';
      if (!isMe && targeting && targeting.type === 'spell') cls = 'tgt';
      h += `<div class="bslot">${cardEl(side, m, { id: 'u' + m.uid, cls, zz: m.sleep && isMe })}</div>`;
    });
    return h;
  };
  $('foeField').innerHTML = fieldHTML(foe, false);
  $('meField').innerHTML = fieldHTML(me, true);
  $('foeFace').classList.toggle('target', (!!sel && canHit(me, null)) || !!(targeting && targeting.type === 'spell' && targeting.any));
  $('meHand').innerHTML = me.hand.map(h => cardEl(null, h, { cls: myTurn ? (canPlay(me, h) ? 'can' : 'no') + (targeting && targeting.card === h ? ' sel' : '') : '' })).join('') || '<span class="meta" style="align-self:center">手札なし</span>';
  $('btEnd').disabled = !myTurn;
  $('btEnd').textContent = myTurn && !me.hand.some(h => canPlay(me, h)) && !me.field.some(m => m && !m.sleep) ? 'ターン終了 ▶' : 'ターン終了';
}
async function onTap(e) {
  if (!B || busy || B.turnSide !== B.me || over()) return;
  const me = B.me, foe = B.foe;
  const bc = e.target.closest('.bc'), face = e.target.closest('#foeFace');
  // 手札
  if (bc && bc.closest('#meHand')) {
    const card = me.hand.find(h => h.uid === +bc.dataset.uid);
    sel = null;
    if (!card || !canPlay(me, card)) { A.tone(200, .08, 'square', .03); logRaw(card ? (cost(card) > me.mana ? 'ちからが足りない' : card.c.type === 'M' ? '場がいっぱい' : card.c.type === 'I' ? '持たせるモンスターがいない' : '今は使えない') : ''); render(); return; }
    if (targeting && targeting.card === card) { targeting = null; logRaw('やめた'); render(); return; }
    const need = needsTarget(card);
    if (need === 'mine') { targeting = { type: 'item', card }; logRaw(`「${card.c.nm}」を持たせるモンスターをタップ（${itemOf(card.c).txt}）`); render(); return; }
    if (need) { targeting = { type: 'spell', card, any: need === 'any' }; logRaw(need === 'any' ? `「${card.c.nm}」：当てる相手のモンスターか、相手の顔をタップ` : `「${card.c.nm}」：相手のモンスターをタップ`); render(); return; }
    targeting = null;
    if (B.guest) { busy = true; render(); send({ t: 'act', a: 'play', uid: card.uid }); return; }
    busy = true; await play(me, card); busy = false; render(); sync(); if (over()) finish(); return;
  }
  // アイテムを持たせる先
  if (targeting && targeting.type === 'item') {
    const mine = bc && bc.closest('#meField') ? me.field.find(m => m && m.uid === +bc.dataset.uid) : null;
    const card = targeting.card; targeting = null;
    if (mine && B.guest) { busy = true; render(); send({ t: 'act', a: 'play', uid: card.uid, target: mine.uid }); return; }
    if (mine) { busy = true; await play(me, card, mine); busy = false; sync(); }
    render(); return;
  }
  // 魔法の相手
  if (targeting && targeting.type === 'spell') {
    const card = targeting.card;
    const target = bc && bc.closest('#foeField') ? foe.field.find(x => x && x.uid === +bc.dataset.uid) : (face && targeting.any ? 'face' : null);
    targeting = null;
    if (!target) { logRaw('やめた'); render(); return; }
    if (B.guest) { busy = true; render(); send({ t: 'act', a: 'play', uid: card.uid, target: target === 'face' ? -1 : target.uid }); return; }
    busy = true; await play(me, card, target); busy = false; render(); sync(); if (over()) finish(); return;
  }
  // 自分のモンスターを選ぶ
  if (bc && bc.closest('#meField')) {
    const m = me.field.find(x => x && x.uid === +bc.dataset.uid);
    if (m && !m.sleep) { sel = sel === m ? null : m; if (sel) logRaw(guards(foe).length ? '攻撃する相手をタップ（🛡守りがいるので、守りだけ攻撃できる）' : '攻撃する相手（モンスターか顔）をタップ'); }
    else if (m) logRaw(m.frozen ? '凍っていて動けない' : m.sleep && B.turnSide === B.me && m.attacked ? 'このターンはもう攻撃した' : '出したばかりのモンスターは次のターンから攻撃できる');
    render(); return;
  }
  // 攻撃先
  if (sel && (face || (bc && bc.closest('#foeField')))) {
    const target = face ? null : foe.field.find(x => x && x.uid === +bc.dataset.uid);
    if (!face && !target) return;
    if (!canHit(me, target)) { A.tone(200, .08, 'square', .03); logRaw('🛡守りのモンスターがいる。先に守りを攻撃しよう'); render(); return; }
    const m = sel; sel = null; busy = true; render();
    if (B.guest) { send({ t: 'act', a: 'attack', uid: m.uid, target: target ? target.uid : 0 }); return; }
    await attack(me, m, target); busy = false; render(); sync();
    if (over()) finish();
    return;
  }
  if (sel) { sel = null; render(); }
}
let LOGS = [];
// side：だれの行動か（色分け）。kind：'turn' はターンの区切り
function log(t, side, kind) {
  const who = side && B ? (side === B.me ? 'me' : 'foe') : '';
  emit({ k: 'log', text: t, who, kind });
  addLog(t, who, kind);
}
function addLog(t, who, kind) {
  if (FAST) return;
  LOGS.push({ t, who, kind }); if (LOGS.length > 500) LOGS.shift();
  if (kind !== 'turn') logRaw(t);
  if ($('btLogPanel') && (getComputedStyle($('btLogPanel')).display !== 'none')) renderLog();
}
function renderLog() {
  const el = $('btLogList'); if (!el) return;
  const atEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  el.innerHTML = LOGS.map(l => `<div class="lg ${l.kind === 'turn' ? 'turn' : l.who || 'sys'}">${A.esc(l.t)}</div>`).join('') || '<div class="lg sys">まだ何もない</div>';
  if (atEnd || el.dataset.n !== String(LOGS.length)) el.scrollTop = el.scrollHeight;
  el.dataset.n = LOGS.length;
}
function clearLog() { LOGS = []; renderLog(); }
function floatChat(t) { bannerRaw(t); }
function logRaw(t) {
  if (FAST) return; if ($('btLog')) $('btLog').textContent = t; }
function center(id) { const el = $(id); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
function floatAt(id, text, col) { emit({ k: 'float', id, text, col }); floatAtRaw(id, text, col); }
function floatAtRaw(id, text, col) {
  if (FAST) return;
  render();
  const p = center(id); if (!p) return;
  const f = document.createElement('div'); f.className = 'btFloat'; f.textContent = text; f.style.color = col; f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 950);
}
function shake(id) { emit({ k: 'shake', id }); shakeRaw(id); }
function shakeRaw(id) { const el = $(id); if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
let busyAnim = false;
async function lunge(fromId, toId) { emit({ k: 'lunge', from: fromId, to: toId }); busyAnim = true; await lungeRaw(fromId, toId); busyAnim = false; }
async function lungeRaw(fromId, toId) {
  if (FAST) return;
  const a = $(fromId), p = center(fromId), q = center(toId);
  if (!a || !p || !q) return;
  a.style.transition = 'transform .16s ease-in'; a.style.zIndex = 5;
  a.style.transform = `translate(${(q.x - p.x) * .7}px, ${(q.y - p.y) * .7}px) scale(1.08)`;
  await wait(170);
  shake(toId);
  a.style.transition = 'transform .2s ease-out'; a.style.transform = '';
  await wait(120);
}
function banner(t) { bannerRaw(t); }
function bannerRaw(t, col) {
  if (FAST) return; const b = document.createElement('div'); b.className = 'btBanner'; b.textContent = t; if (col) b.style.color = col; document.body.appendChild(b); setTimeout(() => b.remove(), 1150); }
function bigText(t, col) { emit({ k: 'big', text: t, col }); bannerRaw(t, col); return; const b = document.createElement('div'); b.className = 'btBanner'; b.textContent = t; b.style.color = col; document.body.appendChild(b); setTimeout(() => b.remove(), 1150); }
async function showSpell(card) { emit({ k: 'spell', no: card.c.no }); await showSpellRaw(card.c); }
async function showSpellRaw(c) {
  if (FAST) return;
  const d = document.createElement('div'); d.className = 'btSpell';
  d.innerHTML = A.cardHTML(c);
  document.body.appendChild(d); A.chime('SR');
  await wait(800); d.remove();
}


// =============================================================
//  オンライン対戦（PeerJSでブラウザ同士をつなぐ）
//  ホスト（部屋を作った側）がバトルを進めて、毎回の状態を相手に送る。
//  ゲスト（入った側）は「何をしたか」だけを送る。
// =============================================================
const NET_VER = 2, PREFIX = 'yomatsuri-kaifu-', RAND_SLOTS = 6, TURN_LIMIT = 75, ONLINE_REWARD = 100, ONLINE_DAILY = 5;
let NET = null;            // { role: 'host'|'guest', peer, conn, opp, rematch }
function qp(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
function peerOpts() {
  const h = qp('peerhost');    // テスト用：自分で立てたサーバーにつなぐ
  if (h) { const [host, port] = h.split(':'); return { host, port: +port || 9000, path: '/', secure: false, debug: 0 }; }
  return { debug: 0, config: { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: 'stun:stun.relay.metered.ca:80' },
    // 中継サーバー（Metered の無料トライアル枠。学校のWi-Fiなどで直接つながらないときに使われる）
    { urls: ['turn:jp.relay.metered.ca:80', 'turn:jp.relay.metered.ca:80?transport=tcp', 'turn:jp.relay.metered.ca:443', 'turns:jp.relay.metered.ca:443?transport=tcp'],
      username: '31536e5ac7d5f21e26083726', credential: 'EbmwVyaEUzn4LKnD' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  ], iceTransportPolicy: qp('relay') ? 'relay' : 'all' } };
}
// 部屋を作った側：スマホで別のアプリ（LINEなど）に切りかえると待ち合わせサーバーとの線が切れるので、つなぎ直して部屋を守る
function keepRoom(peer, waitingMsg) {
  const alive = () => NET && NET.peer === peer && !peer.destroyed;
  let tm = null;
  const fix = () => {
    clearTimeout(tm);
    if (!alive() || !peer.disconnected) return;
    if (!NET.conn) netStatus('つなぎ直しています…');
    try { peer.reconnect(); } catch (e) {}
    tm = setTimeout(fix, 2500);
  };
  peer.on('disconnected', () => { if (alive()) tm = setTimeout(fix, 400); });
  peer.on('open', () => { clearTimeout(tm); if (alive() && !NET.conn) netStatus(waitingMsg); });
  const vis = () => { if (!alive()) return document.removeEventListener('visibilitychange', vis); if (!document.hidden) fix(); };
  document.addEventListener('visibilitychange', vis);
}
function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = qp('peerlib') || 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
    s.onload = res; s.onerror = () => rej(new Error('通信の部品を読み込めなかった'));
    document.head.appendChild(s);
  });
}
function openPeer(id) {
  return new Promise((res, rej) => {
    const p = id ? new window.Peer(id, peerOpts()) : new window.Peer(peerOpts());
    const t = setTimeout(() => { rej(Object.assign(new Error('timeout'), { type: 'timeout' })); try { p.destroy(); } catch (e) {} }, 12000);
    const onErr = e => { clearTimeout(t); p.off('error', onErr); rej(e); try { p.destroy(); } catch (x) {} };
    p.on('open', () => { clearTimeout(t); p.off('error', onErr); p.on('error', () => {}); res(p); });
    p.on('error', onErr);
  });
}
// 相手につないで、ホストから「OK」が来たらつながったことにする
let lastFail = '';
function tryConnect(peer, id, ms = 3500) {
  lastFail = 'timeout';
  return new Promise(res => {
    let done = false;
    const fin = v => { if (done) return; done = true; peer.off('error', onErr); clearTimeout(t); res(v); };
    const onErr = e => { if (e.type === 'peer-unavailable') { lastFail = 'unavail'; fin(null); } };
    peer.on('error', onErr);
    const c = peer.connect(id, { reliable: true });
    // 時間切れ：相手から返事（answer）が来ていれば「部屋はある、回線の問題」、来てなければ「部屋がない」
    const t = setTimeout(() => { const pc = c && c.peerConnection; lastFail = pc && pc.remoteDescription ? 'timeout' : 'unavail'; try { c.close(); } catch (e) {} fin(null); }, ms);
    c.on('open', () => c.send({ t: 'knock', v: NET_VER }));
    c.on('data', d => { if (d && d.t === 'welcome') fin(c); else if (d && d.t === 'busy') { lastFail = 'busy'; try { c.close(); } catch (e) {} fin(null); } });
    c.on('error', () => fin(null));
  });
}
// いくつかの相手に同時につないで、最初にOKをくれた相手にする（ほかは切る）
function tryConnectAny(peer, ids, ms = 3500) {
  return new Promise(res => {
    let done = false; const conns = [];
    const fin = v => { if (done) return; done = true; clearTimeout(t); for (const c of conns) if (c !== v) { try { c.close(); } catch (e) {} } res(v); };
    const t = setTimeout(() => fin(null), ms);
    for (const id of ids) {
      const c = peer.connect(id, { reliable: true }); if (!c) continue; conns.push(c);
      c.on('open', () => c.send({ t: 'knock', v: NET_VER }));
      c.on('data', d => { if (d && d.t === 'welcome') fin(c); });
    }
  });
}
window.__net = () => NET;
function myName() { return (A.S.name || '').trim() || 'ななしの金魚'; }
function netStatus(t, err) { const el = $('onStatus'); if (el) { el.textContent = t; el.style.color = err ? '#ff8aa0' : ''; } }
function netClose(reason) {
  const n = NET; NET = null;
  if (!n) return;
  clearInterval(n.timer); clearInterval(n.probe); clearInterval(n.hb);
  try { n.conn && n.conn.open && n.conn.send({ t: 'bye' }); } catch (e) {}
  try { n.conn && n.conn.close(); } catch (e) {}
  try { n.peer && n.peer.destroy(); } catch (e) {}
  if (reason) netStatus(reason);
}
function send(msg) { if (NET && NET.conn && NET.conn.open) NET.conn.send(msg); }

// ---- 部屋を作る ----
async function hostRoom() {
  netClose(); await loadPeerJS();
  netStatus('部屋を作っています…');
  for (let i = 0; i < 6; i++) {
    const code = String(Math.floor(1000 + rnd() * 9000));
    try {
      const peer = await openPeer(PREFIX + 'room-' + code);
      NET = { role: 'host', peer, conn: null, code };
      peer.on('connection', acceptConn);
      peer.on('error', e => { if (!NET || NET.peer !== peer) return; if (!['peer-unavailable', 'network', 'disconnected', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) netStatus('通信エラー：' + e.type, true); });
      const msg = '友達にこの番号を教えて、待っててね（番号を送ったら、この画面にもどってきてね）';
      keepRoom(peer, msg);
      $('onCode').textContent = code; $('onCodeBox').hidden = false;
      netStatus(msg);
      return;
    } catch (e) { if (e.type !== 'unavailable-id') { netStatus('つなげなかった（' + (e.type || e.message) + '）', true); return; } }
  }
  netStatus('部屋を作れなかった。もう一度ためしてね', true);
}
// ---- 番号で入る ----
async function joinRoom(code) {
  netClose(); await loadPeerJS();
  if (!/^\d{4}$/.test(code)) { netStatus('4けたの番号を入れてね', true); return; }
  netStatus(`部屋 ${code} につないでいます…`);
  try {
    const peer = await openPeer(null);
    NET = { role: 'guest', peer, conn: null };
    const until = Date.now() + 35000; let c = null, slow = 0;
    while (NET && NET.peer === peer && Date.now() < until) {
      c = await tryConnect(peer, PREFIX + 'room-' + code, slow ? 15000 : 8000);
      if (c || !NET || NET.peer !== peer) break;
      if (lastFail === 'busy') break;
      if (lastFail === 'timeout') { slow++; netStatus(`部屋 ${code} は見つかった。つないでいます…（回線によっては少し時間がかかるよ）`); }
      else netStatus(`部屋 ${code} をさがしています…（相手には、ゲームの画面を開いたままにしてもらってね）`);
      await new Promise(r => setTimeout(r, 2000));
    }
    if (!NET || NET.peer !== peer) return;
    if (!c) {
      netClose();
      netStatus(lastFail === 'busy' ? 'その部屋はもう対戦中みたい'
        : slow ? 'つなげなかった。回線の相性かも（片方がWi-Fiなら、モバイル回線に切りかえると直ることがあるよ）'
        : '部屋が見つからない。番号があってるか、相手がゲームの画面を開いたままか確かめてね', true);
      return;
    }
    asGuest(c);
  } catch (e) { netClose(); netStatus('つなげなかった（' + (e.type || e.message) + '）', true); }
}
// ---- ランダムマッチ：あいている待ち合わせ場所を探して、だれもいなければ自分が待つ ----
async function randomMatch() {
  netClose(); await loadPeerJS();
  netStatus('相手をさがしています…');
  try {
    const me = await openPeer(null);
    NET = { role: 'guest', peer: me, conn: null, searching: true };
    const c0 = await tryConnectAny(me, Array.from({ length: RAND_SLOTS }, (_, k) => PREFIX + 'rand-' + k), 3500);
    if (c0 && NET && NET.peer === me) return asGuest(c0);
    if (!NET || NET.peer !== me) return;
    try { me.destroy(); } catch (e) {}
    for (let k = 0; k < RAND_SLOTS; k++) {
      try {
        const hp = await openPeer(PREFIX + 'rand-' + k);
        NET = { role: 'host', peer: hp, conn: null, slot: k, random: true };
        hp.on('connection', acceptConn);
        keepRoom(hp, '相手が来るのを待っています…（そのまま待っててね）');
        netStatus('相手が来るのを待っています…（そのまま待っててね）');
        // 自分より前の場所でだれか待っていたら、そっちに入る（すれちがい防止）
        if (k > 0) NET.probe = setInterval(probe, 3500), setTimeout(probe, 600);
        async function probe() {
          if (!NET || NET.peer !== hp || NET.conn) return;
          const pr = await openPeer(null).catch(() => null); if (!pr) return;
          const c = await tryConnectAny(pr, Array.from({ length: k }, (_, j) => PREFIX + 'rand-' + j), 2500);
          if (c && NET && NET.peer === hp && !NET.conn) { clearInterval(NET.probe); try { hp.destroy(); } catch (e) {} NET = { role: 'guest', peer: pr, conn: null }; return asGuest(c); }
          try { pr.destroy(); } catch (e) {}
        }
        return;
      } catch (e) { if (e.type !== 'unavailable-id') throw e; }
    }
    netClose(); netStatus('混んでいるみたい。もう一度ためしてね', true);
  } catch (e) { netClose(); netStatus('つなげなかった（' + (e.type || e.message) + '）', true); }
}
// ---- ホスト：だれかが来た ----
function acceptConn(c) {
  c.on('data', d => {
    if (!d) return;
    if (d.t === 'knock') {
      if (!NET || NET.conn || NET.role !== 'host') { c.send({ t: 'busy' }); setTimeout(() => c.close(), 300); return; }
      if (d.v !== NET_VER) { c.send({ t: 'busy' }); return; }
      NET.conn = c; clearInterval(NET.probe);
      wire(c);
      c.send({ t: 'welcome' });
      netStatus('相手が来た！');
    }
  });
}
function asGuest(c) {
  NET.conn = c; NET.role = 'guest';
  wire(c);
  const { deck, rental } = playerDeck();
  send({ t: 'hello', name: myName(), deck, rental, v: NET_VER });
  netStatus('対戦の準備中…');
}
function wire(c) {
  NET.lastRx = Date.now();
  c.on('data', d => { if (NET) NET.lastRx = Date.now(); onMsg(d); });
  c.on('close', () => onLost());
  c.on('error', () => onLost());
  // 生きているか確かめる（3秒ごとに合図、12秒こなければ切れたことにする）
  clearInterval(NET.hb);
  NET.hb = setInterval(() => {
    if (!NET) return;
    send({ t: 'ping' });
    if (Date.now() - NET.lastRx > 12000) onLost();
  }, 3000);
  NET.peer.on('disconnected', () => { try { NET && NET.peer.reconnect(); } catch (e) {} });
}
function onLost() {
  if (!NET) return;
  const inBattle = B && B.online && !B.done;
  netClose();
  if (inBattle) {
    B.done = true; busy = true;
    showResult('勝ち（相手の通信が切れた）', '#ffc94a', '相手との通信が切れたので、勝ちになった。（コインはもらえない）', false);
  } else netStatus('相手との通信が切れた', true);
}
async function onMsg(d) {
  if (!d || !NET) return;
  if (d.t === 'ping') return;
  if (d.t === 'bye') return onLost();
  if (NET.role === 'host') {
    if (d.t === 'hello') { NET.opp = (d.name || '').slice(0, 10) || 'ななしの金魚'; send({ t: 'hello', name: myName() }); startOnline(d.deck || [], d.rental || []); }
    else if (d.t === 'act') hostAct(d);
    else if (d.t === 'rematch') { NET.rematchThem = true; if (NET.rematchMe) rematchGo(); else log(`${NET.opp}が「もう一度」を押した`); }
    else if (d.t === 'chat') floatChat(d.s);
  } else {
    if (d.t === 'hello') { NET.opp = (d.name || '').slice(0, 10) || 'ななしの金魚'; }
    else if (d.t === 'state') guestState(d);
    else if (d.t === 'fx') guestFx(d.fx);
    else if (d.t === 'chat') floatChat(d.s);
  }
}

// ---- バトルの状態を送る・受け取る ----
function sc(m) { return m && { uid: m.uid, no: m.no, atk: m.atk, hp: m.hp, maxHp: m.maxHp, buff: m.buff, sleep: m.sleep, rental: m.rental, items: m.items, kw: m.kw, frozen: m.frozen, attacked: m.attacked }; }
function ss(s, hideHand) { return { nm: s.nm, lp: s.lp, maxLp: s.maxLp, mana: s.mana, maxMana: s.maxMana, deckN: s.deck.length, hand: hideHand ? s.hand.map(() => null) : s.hand.map(sc), field: s.field.map(sc), land: sc(s.land), fatigue: s.fatigue }; }
function sync() {
  if (!NET || NET.role !== 'host' || !B || !B.online) return;
  send({ t: 'state', turn: B.turn, hostTurn: B.turnSide === B.me, me: ss(B.me, true), foe: ss(B.foe, false), done: B.done, left: Math.max(0, Math.ceil(TURN_LIMIT - (Date.now() - B.turnAt) / 1000)), busy: busy && B.turnSide === B.me });
}
function emit(fx) { if (NET && NET.role === 'host' && B && B.online && !FAST) send({ t: 'fx', fx }); }
function guestState(d) {
  const dc = x => x && Object.assign({}, x, { c: A.CARDS[x.no - 1] });
  const ds = s => Object.assign({}, s, { deck: { length: s.deckN }, hand: s.hand.map(h => h ? dc(h) : { uid: 0, c: A.CARDS[0], hidden: true }), field: s.field.map(dc), land: dc(s.land) });
  const me = ds(d.foe), foe = ds(d.me);
  const first = !B || !B.online;
  B = { online: true, guest: true, lv: -1, turn: d.turn, me, foe, turnSide: d.hostTurn ? foe : me, done: d.done, turnAt: Date.now() - (TURN_LIMIT - d.left) * 1000 };
  if (first || (d.turn <= 1 && !d.done)) { $('btMenu').hidden = true; $('bt').hidden = false; $('btRes').hidden = true; $('btAgain').disabled = false; }
  busy = d.hostTurn || d.done; sel = null; targeting = null;
  render();
  if (d.done) { if (!NET.doneShown) { NET.doneShown = true; finishOnline(); } } else NET.doneShown = false;
}
// ホストで起きた演出を、ゲストの画面で再生する（自分と相手が逆になる）
function flipId(id) { return id === 'meFace' ? 'foeFace' : id === 'foeFace' ? 'meFace' : id; }
function guestFx(f) {
  if (f.k === 'float') { floatAtRaw(flipId(f.id), f.text, f.col); A.tone(f.col === '#7be39a' ? 880 : 200, .08, 'square', .04, -40); }
  else if (f.k === 'lunge') lungeRaw(flipId(f.from), flipId(f.to));
  else if (f.k === 'shake') shakeRaw(flipId(f.id));
  else if (f.k === 'spell') { const c = A.CARDS[f.no - 1]; showSpellRaw(c); }
  else if (f.k === 'turn') { bannerRaw(f.host ? `${NET ? NET.opp : '相手'}のターン` : 'あなたのターン'); if (!f.host) A.tone(660, .1, 'triangle', .05); }
  else if (f.k === 'big') bannerRaw(f.text, f.col);
  else if (f.k === 'log') addLog(f.text, f.who === 'me' ? 'foe' : f.who === 'foe' ? 'me' : '', f.kind);
  else if (f.k === 'logreset') clearLog();
  else if (f.k === 'kill') { const el = $(f.id); if (el) el.classList.add('dying'); A.tone(180, .2, 'sawtooth', .04, -80); }
}
// ---- ホスト：ゲストの行動を実行 ----
let hostWorking = false;
async function hostAct(d) {
  if (!B || !B.online || B.done || B.turnSide !== B.foe || hostWorking) return;
  hostWorking = true;
  try {
    const me = B.foe, them = B.me;
    if (d.a === 'play') {
      const card = me.hand.find(h => h.uid === d.uid);
      const need = card && needsTarget(card);
      let target = null;
      if (need === 'mine') target = me.field.find(m => m && m.uid === d.target) || null;
      else if (need) target = d.target === -1 ? (need === 'any' ? 'face' : null) : (them.field.find(m => m && m.uid === d.target) || null);
      if (card && canPlay(me, card) && (!need || target)) await play(me, card, target);
    } else if (d.a === 'attack') {
      const m = me.field.find(x => x && x.uid === d.uid);
      const t = d.target ? them.field.find(x => x && x.uid === d.target) : null;
      if (m && !m.sleep && (!d.target || t) && canHit(me, t)) await attack(me, m, t);
    } else if (d.a === 'end') {
      hostWorking = false; sync();
      if (!over()) { await wait(200); startTurn(B.me); }
      return;
    }
  } finally { hostWorking = false; }
  sync();
  if (over()) finish();
}
// ---- ホスト：対戦を始める ----
function startOnline(guestDeck, guestRental) {
  const keep = { deck: guestDeck, rental: guestRental };
  const { deck, rental } = playerDeck();
  B = { online: true, lv: -1, turn: 0, me: newSide(myName(), deck, rental), foe: newSide(NET.opp, guestDeck.slice(0, DECK).filter(no => no >= 1 && no <= A.CARDS.length), guestRental.slice(0, DECK)), done: false, turnAt: Date.now() };
  B.foeDeckNos = keep;
  clearLog(); emit({ k: 'logreset' });
  sel = null; targeting = null; busy = true;
  $('btMenu').hidden = true; $('bt').hidden = false; $('btRes').hidden = true;
  draw(B.me, 4); draw(B.foe, 4);
  const first = rnd() < .5 ? B.me : B.foe;
  draw(first === B.me ? B.foe : B.me, SECOND_CARD);
  addLog(`${NET.opp}と対戦！ ${first === B.me ? 'あなたが先攻' : '相手が先攻'}`, ''); emit({ k: 'log', text: `${myName()}と対戦！ ${first === B.me ? '相手が先攻' : 'あなたが先攻'}`, who: '' });
  render(); sync();
  clearInterval(NET.timer);
  NET.timer = setInterval(() => {
    if (!B || !B.online || B.done) return;
    render();
    if ((Date.now() - B.turnAt) / 1000 > TURN_LIMIT && !hostWorking && !busyAnim) {
      log('時間切れ！ ターン終了');
      sel = null; targeting = null;
      startTurn(B.turnSide === B.me ? B.foe : B.me);
    }
  }, 1000);
  setTimeout(() => startTurn(first), 900);
}
function rematchGo() {
  NET.rematchMe = NET.rematchThem = false;
  $('btRes').hidden = true;
  send({ t: 'hello', name: myName() });
  // ゲストのデッキは前と同じものを使う
  const gd = B.foeDeckNos || [];
  startOnline(gd.deck || [], gd.rental || []);
}
function finishOnline() {
  if (B.shown) return; B.shown = true; busy = true;
  const win = B.foe.lp <= 0 && B.me.lp > 0, draw2 = B.foe.lp <= 0 && B.me.lp <= 0;
  const on = A.S.online || (A.S.online = { wins: 0, losses: 0, day: '', n: 0 });
  const today = new Date().toISOString().slice(0, 10);
  if (on.day !== today) { on.day = today; on.n = 0; }
  let coins = 0;
  if (win) { on.wins++; if (on.n < ONLINE_DAILY) { on.n++; coins = ONLINE_REWARD; } } else if (!draw2) on.losses++;
  A.S.coins += coins; A.save(); A.hud();
  if (win) { A.chime('UR'); A.sparkle(innerWidth / 2, innerHeight / 2, ['#ffc94a', '#ff4fa0', '#fff'], 120, 12); } else A.tone(220, .5, 'triangle', .05, -120);
  const opp = NET ? NET.opp : '相手';
  setTimeout(() => showResult(draw2 ? '引き分け' : win ? '勝ち！' : '負け…', win ? '#ffc94a' : '#9aa8a2',
    `${opp}${win ? 'に勝った' : draw2 ? 'と引き分け' : 'に負けた'}<br>${win ? (coins ? `コイン +${coins}（今日あと${ONLINE_DAILY - on.n}回もらえる）` : '今日のコインはもう上限') : ''}<br><small>通算 ${on.wins}勝 ${on.losses}敗</small>`, true), 900);
}
function showResult(title, col, html, online) {
  $('btRes').hidden = false;
  $('btResT').textContent = title; $('btResT').style.color = col;
  $('btResM').innerHTML = html;
  $('btNext').hidden = true;
  $('btAgain').hidden = !online || !NET;
  $('btAgain').textContent = online ? 'もう一度（同じ相手）' : 'もう一度';
}

// ---------------- 開く・閉じる ----------------
function renderMenu() {
  const bt = A.S.battle || { cleared: 0, wins: 0, losses: 0 };
  $('btFoes').innerHTML = FOES.map((f, i) => `<button class="foe" data-lv="${i}" ${i > bt.cleared ? 'disabled' : ''}>
    <span class="ic">${i > bt.cleared ? '🔒' : f.icon}</span><b>${i + 1}. ${f.nm}</b><span class="rw">+${f.reward}</span>
    <small>${i < bt.cleared ? '勝ったことがある' : i === bt.cleared ? 'はじめて勝つとコイン2倍' : '前の相手に勝つと戦える'}・ライフ${f.lp}・${Object.keys(f.mix).join('/')}のデッキ</small></button>`).join('');
  $('btFoes').onclick = e => { const b = e.target.closest('.foe'); if (!b || b.disabled) return; $('btMenu').hidden = true; startBattle(+b.dataset.lv); };
}
function openMenu() { css(); shell(); renderMenu(); $('btMenu').hidden = false; }
function openDeck() {
  if (!A.S.deck && !A.S.deckEmpty) A.S.deck = autoDeck();
  renderDeck(); $('btDeckSheet').hidden = false;
}
function renderDeck() {
  const d = A.S.deck || [];
  const have = A.CARDS.filter(c => ownedCount(c.no) > 0);
  $('dkCount').textContent = `${d.length}/${DECK}`;
  const cs = d.map(no => A.CARDS[no - 1]), n = t => cs.filter(c => c.type === t).length;
  const avg = cs.length ? (cs.reduce((a, c) => a + COST[c.r], 0) / cs.length).toFixed(1) : '-';
  const curve = [1, 2, 3, 4, 6, 7].map(k => `${k}:${cs.filter(c => COST[c.r] === k).length}`).join(' ');
  $('dkNote').innerHTML = have.length ? `カードをタップで入れる・もう一度タップで外す（同じカードは${COPIES}枚まで）。長押しで効果を見る。足りない分はレンタルカードが入る。<br><b>モンスター${n('M')}・魔法${n('S')}・フィールド${n('F')}・アイテム${n('I')}</b>　平均ちから${avg}<br><small>ちからごとの枚数　${curve}</small>` : 'まだカードを持っていない。パックを開けよう！（今はレンタルカードだけで戦える）';
  $('dkGrid').innerHTML = have.map(c => { const n = d.filter(x => x === c.no).length; return `<div class="item ${n ? '' : 'out'}" data-no="${c.no}">${n ? `<span class="n">×${n}</span>` : ''}${cardEl(null, { c, uid: 0, ...power(c) })}</div>`; }).join('');
}
function startBattle(lv) {
  const { deck, rental } = playerDeck();
  B = { lv, turn: 0, me: newSide('あなた', deck, rental), foe: newSide(FOES[lv].nm, foeDeck(FOES[lv])), done: false };
  clearLog();
  B.foe.lp = B.foe.maxLp = FOES[lv].lp;
  sel = null; targeting = null; busy = false;
  $('bt').hidden = false;
  draw(B.me, 4); draw(B.foe, 4);
  const first = rnd() < .5 ? B.me : B.foe;
  draw(first === B.me ? B.foe : B.me, SECOND_CARD);         // 後攻は手札が多い
  log(`${FOES[lv].nm}が勝負をいどんできた！ ${first === B.me ? 'あなたが先攻' : '相手が先攻'}`);
  A.audio(); A.tone(330, .12, 'square', .04); A.tone(495, .16, 'square', .04, 0, .1);
  render();
  setTimeout(() => startTurn(first), 900);
}
function closeBattle() { $('bt').hidden = true; B = null; A.hud(); }

addEventListener('pagehide', () => { try { NET && NET.conn && NET.conn.open && NET.conn.send({ t: 'bye' }); } catch (e) {} });
window.PackBattle = {
  init(api) { A = api; },
  open() { openMenu(); },
  // テスト用
  get state() { return B; }, render() { render(); }, power, COST, FOES, autoDeck, battleText(c) { return battleText(c); }, shortText(c) { return '効果：' + rulesText(c).split('\n')[0]; }, kwIcons(c) { return Object.keys(traits(c)).map(k => KW[k].ic + KW[k].nm).join(' '); }, setTotal(t) { Object.assign(TOTAL, t); }, setSecond(m, c) { SECOND_BONUS = m; SECOND_CARD = c; },
  // バランス調整用：CPU同士で1試合（Nodeからも動く）。stats に出したカードなどを記録
  async simMatch(deckA, deckB, opt = {}) {
    FAST = true; const saveA = A; A = Object.assign({}, A, { tone() {}, chime() {} });
    B = { lv: opt.lv || 0, turn: 0, me: newSide('A', deckA), foe: newSide('B', opt.foe ? foeDeck(FOES[opt.lv || 0]) : deckB), done: true, rec: { played: [[], []] } };
    if (opt.foe) { B.foe.lp = B.foe.maxLp = FOES[opt.lv || 0].lp; opt.skillB = FOES[opt.lv || 0].ai; }
    if (opt.lpB) B.foe.lp = opt.lpB;
    draw(B.me, 4); draw(B.foe, 4);
    const firstA = opt.first != null ? opt.first === 0 : rnd() < .5;
    let side = firstA ? B.me : B.foe; draw(other(side), SECOND_CARD);
    while (!over() && B.turn < 100) {
      beginTurn(side);
      await cpuTurn(side, side === B.me ? (opt.skillA ?? 1) : (opt.skillB ?? 1));
      side = other(side);
    }
    const res = { winner: B.foe.lp <= 0 && B.me.lp > 0 ? 0 : B.me.lp <= 0 && B.foe.lp > 0 ? 1 : -1, turns: B.turn, firstA, played: B.rec.played, lp: [B.me.lp, B.foe.lp] };
    FAST = false; B = null; A = saveA;
    return res;
  },
  // 強さの確認：プレイヤー側もCPUが操作して n 回戦う
  async sim(lv, deckNos, n = 50) {
    const saveA = A; FAST = true; let win = 0, turns = 0;
    const tone = A.tone, chime = A.chime; A = Object.assign({}, A, { tone() {}, chime() {} });
    for (let i = 0; i < n; i++) {
      B = { lv, turn: 0, me: newSide('P', deckNos), foe: newSide('C', foeDeck(FOES[lv])), done: true };
      B.foe.lp = FOES[lv].lp;
      draw(B.me, 4); draw(B.foe, 4);
      let side = rnd() < .5 ? B.me : B.foe; draw(other(side), SECOND_CARD);
      while (!over() && B.turn < 80) {
        beginTurn(side);
        await cpuTurn(side, side === B.me ? 1 : FOES[lv].ai);
        side = other(side);
      }
      if (B.foe.lp <= 0 && B.me.lp > 0) win++;
      turns += B.turn;
    }
    FAST = false; B = null; A = saveA;
    return { win: win / n, turns: turns / n };
  },
};
})();
