// =============================================================
//  開封の儀：カードバトル
//  集めたカードで20枚のデッキを作って、夜祭りの相手と戦う。
//  ・ライフ30。毎ターン「ちから」が1ずつ増える（最大8）
//  ・モンスターは場に3体まで。出したターンは休み（UR・SECはすぐ攻撃できる）
//  ・攻撃するとお互いにダメージ（相手が反撃）。属性の相性で1.5倍
//  ・魔法：その場で効果。フィールド：同じ属性のモンスターが強くなる。アイテム：モンスターに持たせて強化
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
const BASE = { C: 600, U: 1000, R: 1500, SR: 2100, UR: 2800, SEC: 3500 };
function power(c) {
  // 図鑑のATK/DEFをバトル用の数字にする
  const atk = BASE[c.r] + (c.seed % 9) * 50, def = BASE[c.r] - 200 + (Math.floor(c.seed / 9) % 9) * 50;
  return { atk: Math.max(1, Math.round(atk / 250)), hp: Math.max(1, Math.round(def / 250)) };
}
const SPELL = {
  fire:  { txt: '敵のモンスター全員に3ダメージ' },
  water: { txt: '敵のいちばん強いモンスターを手札にもどす' },
  leaf:  { txt: 'ライフを8回復。味方のモンスター全員のHP+2' },
  bolt:  { txt: '敵のいちばん強いモンスターに8ダメージ（いなければライフに5）' },
  dark:  { txt: '敵のいちばんATKが高いモンスターを倒す' },
  light: { txt: '味方のモンスター全員のATK+2。カードを1枚引く' },
};
function rulesText(c) {
  if (c.type === 'M') { const p = power(c); return `ATK ${p.atk} / HP ${p.hp}${c.r === 'UR' || c.r === 'SEC' ? '・速攻（出したターンに攻撃できる）' : ''}`; }
  if (c.type === 'S') return SPELL[c.el].txt;
  if (c.type === 'F') return `${EL_NM[c.el]}のモンスターのATK+2・HP+1（場に1枚）`;
  return `味方のモンスター1体にATK+3・HP+2（${EL_NM[c.el]}のモンスターならさらに+1/+1）`;
}

// ---------------- 相手 ----------------
// mix: デッキに入れるレア度ごとの枚数（安いカードも入れて、序盤から動けるように）
const FOES = [
  { nm: '金魚すくいの子', icon: '🐟', mix: { C: 14, U: 6 }, lp: 26, reward: 150, ai: .55 },
  { nm: '射的屋のおやじ', icon: '🎯', mix: { C: 8, U: 8, R: 4 }, lp: 30, reward: 300, ai: .75 },
  { nm: '夜店の番長', icon: '🏮', mix: { C: 4, U: 8, R: 6, SR: 2 }, lp: 30, reward: 500, ai: .9 },
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
function cardValue(c) { const p = c.type === 'M' ? power(c) : { atk: 4, hp: 3 }; return (p.atk + p.hp) / Math.max(1, COST[c.r]) + COST[c.r] * .6 + (c.type === 'M' ? 1 : 0); }
function autoDeck() {
  // 持っているカードから強い順に、ちからのバランスを見ながら選ぶ
  const have = A.CARDS.filter(c => ownedCount(c.no) > 0).sort((a, b) => cardValue(b) - cardValue(a));
  const deck = [];
  const cap = { 1: 4, 2: 6, 3: 5, 4: 4, 6: 3, 7: 2 };
  const usedCost = {};
  for (const pass of [0, 1]) for (const c of have) {
    const k = COST[c.r], n = Math.min(COPIES, ownedCount(c.no));
    for (let i = deck.filter(x => x === c.no).length; i < n && deck.length < DECK; i++) {
      if (pass === 0 && (usedCost[k] || 0) >= cap[k]) break;
      deck.push(c.no); usedCost[k] = (usedCost[k] || 0) + 1;
    }
  }
  return deck;
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
  return { uid: ++uid, no, c, atk: p.atk, hp: p.hp, maxHp: p.hp, buff: 0, sleep: true, rental: !!rental, items: 0 };
}
function newSide(nm, deckNos, rentals = []) {
  const deck = deckNos.map(no => mkCard(no)).concat(rentals.map(no => mkCard(no, true)));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  return { nm, lp: LP, mana: 0, maxMana: 0, deck, hand: [], field: [null, null, null], land: null, fatigue: 0 };
}
function cost(card) { return COST[card.c.r]; }
function atkOf(side, m) { return m.atk + m.buff + (side.land && side.land.c.el === m.c.el ? 2 : 0); }
function hpBonus(side, m) { return side.land && side.land.c.el === m.c.el ? 1 : 0; }
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
  if (FAST) return; const el = $('u' + m.uid); if (el) { el.classList.add('dying'); } A.tone(180, .2, 'sawtooth', .04, -80); }

// ---------------- 行動 ----------------
function canPlay(side, card) {
  if (cost(card) > side.mana) return false;
  if (card.c.type === 'M') return side.field.some(f => !f);
  if (card.c.type === 'I') return side.field.some(f => f);
  if (card.c.type === 'S') {
    const foe = other(side), foes = foe.field.filter(Boolean), mine = side.field.filter(Boolean);
    if (card.c.el === 'water' || card.c.el === 'dark' || card.c.el === 'fire') return foes.length > 0;
    if (card.c.el === 'light') return mine.length > 0;
    return true;
  }
  return true;
}
async function play(side, card, target) {
  side.mana -= cost(card);
  side.hand = side.hand.filter(h => h !== card);
  const foe = other(side), t = card.c.type;
  A.tone(520, .08, 'triangle', .04); A.tone(780, .1, 'triangle', .04, 0, .06);
  log(`${side.nm}：「${card.c.nm}」`);
  if (t === 'M') {
    const i = side.field.findIndex(f => !f); side.field[i] = card;
    card.sleep = !(card.c.r === 'UR' || card.c.r === 'SEC');
    if (card.c.r === 'UR' || card.c.r === 'SEC') { A.chime(card.c.r); bigText(card.c.nm, EL_C[card.c.el]); }
  } else if (t === 'F') {
    side.land = card;
  } else if (t === 'I') {
    const m = target || best(side.field.filter(Boolean), m => atkOf(side, m) + hpOf(side, m));
    const bonus = m.c.el === card.c.el ? 1 : 0;
    m.buff += 3 + bonus; m.hp += 2 + bonus; m.maxHp += 2 + bonus; m.items++;
    render(); floatAt('u' + m.uid, `+${3 + bonus}/+${2 + bonus}`, '#7be39a');
  } else if (t === 'S') {
    render(); await showSpell(card);
    const foes = foe.field.filter(Boolean), mine = side.field.filter(Boolean);
    const strongest = best(foes, m => atkOf(foe, m) * 2 + hpOf(foe, m));
    switch (card.c.el) {
      case 'fire': for (const m of foes) damage(foe, m, 3); break;
      case 'water': if (strongest) { foe.field[foe.field.indexOf(strongest)] = null; strongest.hp = strongest.maxHp; strongest.buff = 0; strongest.sleep = true; if (foe.hand.length < HAND_MAX) foe.hand.push(strongest); log(`「${strongest.c.nm}」が手札にもどった`); } break;
      case 'leaf': side.lp = Math.min(LP + 10, side.lp + 8); floatAt(side === B.me ? 'meFace' : 'foeFace', '+8', '#7be39a'); for (const m of mine) { m.hp += 2; m.maxHp += 2; } break;
      case 'bolt': if (strongest) damage(foe, strongest, 8); else hurtFace(foe, 5); break;
      case 'dark': { const m = best(foes, m => atkOf(foe, m)); if (m) { m.hp = -99; log(`「${m.c.nm}」は闇に飲まれた`); } break; }
      case 'light': for (const m of mine) m.buff += 2; draw(side, 1); break;
    }
    await wait(350);
    cleanup();
  }
  render();
  await wait(side === B.foe ? 650 : 200);
}
function best(arr, f) { let b = null, bv = -1e9; for (const x of arr) { const v = f(x); if (v > bv) { bv = v; b = x; } } return b; }
async function attack(side, m, target) {
  const foe = other(side);
  m.sleep = true;
  const a = atkOf(side, m);
  await lunge('u' + m.uid, target ? 'u' + target.uid : (foe === B.me ? 'meFace' : 'foeFace'));
  if (!target) {
    hurtFace(foe, a); log(`「${m.c.nm}」の攻撃！ ${foe.nm}に${a}ダメージ`);
    A.tone(140, .15, 'square', .05, -40);
  } else {
    const d1 = Math.ceil(a * mult(m, target)), d2 = Math.ceil(atkOf(foe, target) * mult(target, m));
    damage(foe, target, d1); damage(side, m, d2);
    log(`「${m.c.nm}」→「${target.c.nm}」 ${d1}${mult(m, target) > 1 ? '（相性◎）' : ''}／反撃 ${d2}`);
    A.tone(200, .1, 'square', .05, -60); A.tone(120, .14, 'sawtooth', .04, 0, .05);
  }
  render(); await wait(320); cleanup(); render();
  await wait(side === B.foe ? 450 : 150);
}

// ---------------- 相手（CPU）の考え ----------------
async function cpuTurn(me = B.foe, skill = FOES[B.lv].ai) {
  const you = other(me);
  const sloppy = () => rnd() > skill;
  // 1. フィールド → 魔法 → モンスター → アイテム
  for (let guard = 0; guard < 12 && !over(); guard++) {
    const playable = me.hand.filter(c => canPlay(me, c));
    if (!playable.length) break;
    let choice = null;
    const land = playable.find(c => c.c.type === 'F' && (!me.land || me.land.c.el !== c.c.el) && me.field.some(m => m && m.c.el === c.c.el));
    const spells = playable.filter(c => c.c.type === 'S' && spellGood(me, c));
    const mons = playable.filter(c => c.c.type === 'M').sort((a, b) => cost(b) - cost(a));
    const items = playable.filter(c => c.c.type === 'I');
    choice = land || spells[0] || mons[0] || items[0] || null;
    if (!choice || (sloppy() && choice !== mons[0])) choice = mons[0] || choice;
    if (!choice) break;
    await play(me, choice);
  }
  // 2. 攻撃
  for (const m of me.field.slice()) {
    if (over()) break;
    if (!m || m.sleep || !me.field.includes(m)) continue;
    const foes = you.field.filter(Boolean);
    const ready = me.field.filter(x => x && !x.sleep);
    const lethal = ready.reduce((s, x) => s + atkOf(me, x), 0) >= you.lp;
    let target = null;
    if (!lethal && foes.length) {
      const a = atkOf(me, m);
      // 倒せて生き残る相手 → 倒せる強い相手 → 何もしない（顔）
      const good = foes.filter(f => Math.ceil(a * mult(m, f)) >= hpOf(you, f) && Math.ceil(atkOf(you, f) * mult(f, m)) < hpOf(me, m));
      const trade = foes.filter(f => Math.ceil(a * mult(m, f)) >= hpOf(you, f) && atkOf(you, f) >= 4);
      target = best(good, f => atkOf(you, f)) || (rnd() < .7 ? best(trade, f => atkOf(you, f)) : null);
      if (sloppy()) target = rnd() < .5 ? pick(foes) : null;
    }
    await attack(me, m, target);
  }
}
function spellGood(side, card) {
  const foe = other(side), foes = foe.field.filter(Boolean), mine = side.field.filter(Boolean);
  const top = best(foes, m => atkOf(foe, m));
  switch (card.c.el) {
    case 'fire': return foes.length >= 2 || foes.some(m => hpOf(foe, m) <= 3 && atkOf(foe, m) >= 4);
    case 'water': return top && atkOf(foe, top) >= 5;
    case 'leaf': return side.lp <= 20;
    case 'bolt': return (top && hpOf(foe, top) >= 5) || foe.lp <= 5;
    case 'dark': return top && atkOf(foe, top) >= 6;
    case 'light': return mine.length >= 2;
  }
  return true;
}

// ---------------- ターンの流れ ----------------
function over() { return B && (B.me.lp <= 0 || B.foe.lp <= 0); }
async function startTurn(side) {
  B.turnSide = side; B.turn++;
  side.maxMana = Math.min(MANA_MAX, side.maxMana + 1); side.mana = side.maxMana;
  for (const m of side.field) if (m) m.sleep = false;
  if (!(B.turn === 1)) draw(side, 1);
  render();
  banner(side === B.me ? 'あなたのターン' : `${B.foe.nm}のターン`);
  if (over()) return finish();
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
  busy = true; render();
  await wait(250);
  startTurn(B.foe);
}
function finish() {
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
.bt .log { font-size: .78rem; color: #d8d0f0; text-align: center; min-height: 2.6em; max-width: 520px; line-height: 1.3; }
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
@media (min-width: 760px) { .bt { --bw: min(108px, 13vh); } }
@media (max-height: 560px) and (orientation: landscape) { .bt { --bw: min(76px, 15vh); grid-template-rows: auto auto 1fr auto auto auto; } .bt .bar { padding: 3px 10px; } .bt .log { min-height: 1.3em; font-size: .7rem; } .bt .turnBtn { padding: 6px 16px; } .bt .hand { padding: 2px 10px 4px; } }
@media (prefers-reduced-motion: reduce) { .bc, .btFloat, .btBanner, .btSpell { animation: none !important; transition: none !important; } }
`;
  document.head.appendChild(st);
}
function shell() {
  if ($('bt')) return;
  const el = document.createElement('section');
  el.className = 'bt'; el.id = 'bt'; el.hidden = true;
  el.innerHTML = `
    <div class="top2"><span class="t">カードバトル</span><span class="meta" id="btTurn"></span><button class="x" id="btQuit">やめる</button></div>
    <div class="bar"><div class="who" id="foeFace"><span class="ic" id="foeIc"></span><span><span class="lp"><small>LIFE</small><span id="foeLp"></span></span><div class="meta" id="foeMeta"></div></span></div><div class="mana" id="foeMana"></div></div>
    <div class="field" id="foeField"></div>
    <div class="mid"><div class="log" id="btLog"></div></div>
    <div class="field" id="meField"></div>
    <div class="bar"><div class="who" id="meFace"><span class="ic">🙂</span><span><span class="lp"><small>LIFE</small><span id="meLp"></span></span><div class="meta" id="meMeta"></div></span></div><div class="mana" id="meMana"></div><span style="flex:1"></span><button class="turnBtn" id="btEnd">ターン終了</button></div>
    <div class="hand" id="meHand"></div>
    <div class="btSheet" id="btRes" hidden><div class="box"><h2 id="btResT"></h2><p id="btResM"></p><div class="btRow"><button class="bigbtn" id="btNext">次の相手へ</button><button class="bigbtn" id="btAgain">もう一度</button><button class="ghost" id="btBack">相手を選ぶ</button></div></div></div>`;
  document.body.appendChild(el);
  const menu = document.createElement('div');
  menu.className = 'btSheet'; menu.id = 'btMenu'; menu.hidden = true;
  menu.innerHTML = `<div class="box">
    <h2>カードバトル</h2>
    <p>集めたカードで20枚のデッキを作って戦う。相手のライフを0にしたら勝ち。勝つとコインがもらえる。</p>
    <div class="foes" id="btFoes"></div>
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
  const how = document.createElement('div');
  how.className = 'btSheet'; how.id = 'btHowSheet'; how.hidden = true;
  how.innerHTML = `<div class="box"><h2>遊び方</h2>
    <p>・毎ターン<b>ちから</b>（青い玉）が1つずつ増える（最大8）。カードの左上の数字がちから<br>
    ・<b>モンスター</b>は場に3体まで。出したターンは休み（UR・SECはすぐ攻撃できる）<br>
    ・自分のモンスターをタップ→相手のモンスターか相手の顔をタップで攻撃。モンスター同士はお互いにダメージ<br>
    ・<b>属性の相性</b>：炎→森→雷→水→炎、光⇔闇。有利なら1.5倍<br>
    ・<b>魔法</b>は出すとすぐ効果。<b>フィールド</b>は同じ属性のモンスターを強化。<b>アイテム</b>は自分のモンスターをタップして持たせる<br>
    ・カードを長押しすると大きく見られる<br>
    ・カードが20枚に足りないときは、お祭りの<b>レンタルカード</b>が入る</p>
    <div class="btRow"><button class="bigbtn" id="howOk">わかった</button></div></div>`;
  document.body.appendChild(how);
  // 操作
  $('btQuit').onclick = () => { if (B && !B.done && !confirm('バトルをやめますか？（負けになります）')) return; if (B && !B.done) { B.me.lp = 0; B.done = true; (A.S.battle || (A.S.battle = { cleared: 0, wins: 0, losses: 0 })).losses++; A.save(); } closeBattle(); openMenu(); };
  $('btEnd').onclick = endTurn;
  $('btNext').onclick = () => { $('btRes').hidden = true; startBattle(B.lv + 1); };
  $('btAgain').onclick = () => { $('btRes').hidden = true; startBattle(B.lv); };
  $('btBack').onclick = () => { $('btRes').hidden = true; closeBattle(); openMenu(); };
  $('btClose').onclick = () => { $('btMenu').hidden = true; };
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
  $('bt').addEventListener('pointerdown', e => { const c = e.target.closest('.bc'); if (!c) return; hold = setTimeout(() => { hold = 'done'; const no = +c.dataset.no; A.inspect(A.CARDS[no - 1]); }, 480); });
  const cancel = () => { if (hold && hold !== 'done') clearTimeout(hold); setTimeout(() => { hold = null; }, 0); };
  $('bt').addEventListener('pointerup', cancel); $('bt').addEventListener('pointercancel', cancel); $('bt').addEventListener('pointerleave', cancel);
  $('bt').addEventListener('click', e => { if (hold === 'done') { e.stopImmediatePropagation(); hold = null; } }, true);
  $('bt').addEventListener('contextmenu', e => e.preventDefault());
}
function cardEl(side, m, opts = {}) {
  const c = m.c, t = c.type, rc = { C: '#9aa3ad', U: '#5fc27a', R: '#4aa3ff', SR: '#c77dff', UR: '#ffb020', SEC: '#ff4fa0' }[c.r];
  let st = '';
  if (t === 'M') {
    const a = side ? atkOf(side, m) : m.atk, h = side ? hpOf(side, m) : m.hp;
    st = `<span class="st a">${a}</span><span class="st h ${side && h < m.maxHp + hpBonus(side, m) ? 'hurt' : ''}">${h}</span>`;
  } else st = `<span class="ty">${{ S: '魔法', F: 'フィールド', I: 'アイテム' }[t]}</span>`;
  const cls = ['bc', opts.cls || ''].join(' ');
  return `<div class="${cls}" id="${opts.id || ''}" data-uid="${m.uid || ''}" data-no="${c.no}" style="--rc:${rc}">
    <img class="pic" src="images/${String(c.no).padStart(3, '0')}.jpg" alt="" onerror="this.style.display='none'">
    <div class="shade"></div><div class="cost">${COST[c.r]}</div><div class="elb" style="background:${EL_C[c.el]}">${EL_NM[c.el]}</div>
    <div class="nm">${A.esc(c.nm)}</div>${st}${m.rental ? '<span class="rent">レンタル</span>' : ''}${opts.zz ? '<span class="zz">zz</span>' : ''}</div>`;
}
function render() {
  if (!B || FAST) return;
  const me = B.me, foe = B.foe, myTurn = B.turnSide === me && !busy && !over();
  $('btTurn').textContent = `ターン ${Math.ceil(B.turn / 2)}`;
  $('foeIc').textContent = FOES[B.lv].icon;
  $('foeLp').textContent = foe.lp; $('meLp').textContent = me.lp;
  $('foeMeta').textContent = `${foe.nm}・手札${foe.hand.length}・山札${foe.deck.length}`;
  $('meMeta').textContent = `山札${me.deck.length}`;
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
      if (!isMe && sel) cls = 'tgt';
      h += `<div class="bslot">${cardEl(side, m, { id: 'u' + m.uid, cls, zz: m.sleep && isMe })}</div>`;
    });
    return h;
  };
  $('foeField').innerHTML = fieldHTML(foe, false);
  $('meField').innerHTML = fieldHTML(me, true);
  $('foeFace').classList.toggle('target', !!sel);
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
    if (!card || !canPlay(me, card)) { A.tone(200, .08, 'square', .03); log(card ? (cost(card) > me.mana ? 'ちからが足りない' : card.c.type === 'M' ? '場がいっぱい' : card.c.type === 'I' ? '持たせるモンスターがいない' : '今は使えない') : ''); render(); return; }
    if (card.c.type === 'I') { targeting = { type: 'item', card }; log('持たせるモンスターをタップ'); render(); return; }
    targeting = null; busy = true; await play(me, card); busy = false; render(); if (over()) finish(); return;
  }
  // アイテムを持たせる先
  if (targeting && targeting.type === 'item') {
    const mine = bc && bc.closest('#meField') ? me.field.find(m => m && m.uid === +bc.dataset.uid) : null;
    const card = targeting.card; targeting = null;
    if (mine) { busy = true; await play(me, card, mine); busy = false; }
    render(); return;
  }
  // 自分のモンスターを選ぶ
  if (bc && bc.closest('#meField')) {
    const m = me.field.find(x => x && x.uid === +bc.dataset.uid);
    if (m && !m.sleep) { sel = sel === m ? null : m; if (sel) log('攻撃する相手（モンスターか顔）をタップ'); }
    else if (m) log('出したばかりのモンスターは次のターンから攻撃できる');
    render(); return;
  }
  // 攻撃先
  if (sel && (face || (bc && bc.closest('#foeField')))) {
    const target = face ? null : foe.field.find(x => x && x.uid === +bc.dataset.uid);
    if (!face && !target) return;
    const m = sel; sel = null; busy = true; render();
    await attack(me, m, target); busy = false; render();
    if (over()) finish();
    return;
  }
  if (sel) { sel = null; render(); }
}
function log(t) {
  if (FAST) return; if ($('btLog')) $('btLog').textContent = t; }
function center(id) { const el = $(id); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
function floatAt(id, text, col) {
  if (FAST) return;
  render();
  const p = center(id); if (!p) return;
  const f = document.createElement('div'); f.className = 'btFloat'; f.textContent = text; f.style.color = col; f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
  document.body.appendChild(f); setTimeout(() => f.remove(), 950);
}
function shake(id) { const el = $(id); if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
async function lunge(fromId, toId) {
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
function banner(t) {
  if (FAST) return; const b = document.createElement('div'); b.className = 'btBanner'; b.textContent = t; document.body.appendChild(b); setTimeout(() => b.remove(), 1150); }
function bigText(t, col) {
  if (FAST) return; const b = document.createElement('div'); b.className = 'btBanner'; b.textContent = t; b.style.color = col; document.body.appendChild(b); setTimeout(() => b.remove(), 1150); }
async function showSpell(card) {
  if (FAST) return;
  const d = document.createElement('div'); d.className = 'btSpell';
  d.innerHTML = A.cardHTML(card.c);
  document.body.appendChild(d); A.chime('SR');
  await wait(800); d.remove();
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
  $('dkNote').innerHTML = have.length ? `カードをタップで入れる・もう一度タップで外す（同じカードは${COPIES}枚まで）。足りない分はレンタルカードが入る。` : 'まだカードを持っていない。パックを開けよう！（今はレンタルカードだけで戦える）';
  $('dkGrid').innerHTML = have.map(c => { const n = d.filter(x => x === c.no).length; return `<div class="item ${n ? '' : 'out'}" data-no="${c.no}">${n ? `<span class="n">×${n}</span>` : ''}${cardEl(null, { c, uid: 0, ...power(c) })}</div>`; }).join('');
}
function startBattle(lv) {
  const { deck, rental } = playerDeck();
  B = { lv, turn: 0, me: newSide('あなた', deck, rental), foe: newSide(FOES[lv].nm, foeDeck(FOES[lv])), done: false };
  B.foe.lp = FOES[lv].lp;
  sel = null; targeting = null; busy = false;
  $('bt').hidden = false;
  draw(B.me, 4); draw(B.foe, 4);
  const first = rnd() < .5 ? B.me : B.foe;
  draw(first === B.me ? B.foe : B.me, 1);         // 後攻は1枚多く
  log(`${FOES[lv].nm}が勝負をいどんできた！ ${first === B.me ? 'あなたが先攻' : '相手が先攻'}`);
  A.audio(); A.tone(330, .12, 'square', .04); A.tone(495, .16, 'square', .04, 0, .1);
  render();
  setTimeout(() => startTurn(first), 900);
}
function closeBattle() { $('bt').hidden = true; B = null; A.hud(); }

window.PackBattle = {
  init(api) { A = api; },
  open() { openMenu(); },
  // テスト用
  get state() { return B; }, power, COST, FOES, autoDeck,
  // 強さの確認：プレイヤー側もCPUが操作して n 回戦う
  async sim(lv, deckNos, n = 50) {
    const saveA = A; FAST = true; let win = 0, turns = 0;
    const tone = A.tone, chime = A.chime; A = Object.assign({}, A, { tone() {}, chime() {} });
    for (let i = 0; i < n; i++) {
      B = { lv, turn: 0, me: newSide('P', deckNos), foe: newSide('C', foeDeck(FOES[lv])), done: true };
      B.foe.lp = FOES[lv].lp;
      draw(B.me, 4); draw(B.foe, 4);
      let side = rnd() < .5 ? B.me : B.foe; draw(other(side), 1);
      while (!over() && B.turn < 80) {
        B.turn++; side.maxMana = Math.min(MANA_MAX, side.maxMana + 1); side.mana = side.maxMana;
        for (const m of side.field) if (m) m.sleep = false;
        if (B.turn > 1) draw(side, 1);
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
