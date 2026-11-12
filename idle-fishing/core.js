// =============================================================
//  ほったらかし釣り堀：ルールとデータ（画面に依存しないのでNodeでも動く）
// =============================================================
(function (root) {
'use strict';

// ---------------- レア度 ----------------
// w: 出やすさ、k: 運1あたりの上がり方、v: 値段、p: 真珠
const RAR = {
  N:   { nm: 'ノーマル',   w: 62,   k: 0,    v: 1,    p: 0,  c: '#b8c4cc' },
  R:   { nm: 'レア',       w: 26,   k: .03,  v: 3,    p: 0,  c: '#4ad66a' },
  SR:  { nm: 'スーパー',   w: 9,    k: .08,  v: 12,   p: 1,  c: '#3da0ff' },
  UR:  { nm: 'ウルトラ',   w: 2.5,  k: .15,  v: 60,   p: 3,  c: '#b06aff' },
  LR:  { nm: 'レジェンド', w: .45,  k: .3,   v: 250,  p: 10, c: '#ffb020' },
  GOD: { nm: '幻',         w: .05,  k: .6,   v: 1200, p: 30, c: '#ff4fa0' },
  // 究極：運や強化では出やすくならない。釣れるたびに「1/30000」のくじを引くだけ
  ULT: { nm: '究極',       w: 0,    k: 0,    v: 30000, p: 200, c: '#ff2a2a' },
};
const RORDER = ['N', 'R', 'SR', 'UR', 'LR', 'GOD', 'ULT'];
const ULT_CHANCE = 1 / 30000;

// ---------------- 池と魚 ----------------
// 魚：[名前, レア度, 形, 色1, 色2, 模様]
const PONDS = [
  { id: 'river', nm: '小川', mult: 1, need: 0, sky: ['#bfe8ff', '#eaf7ff'], water: ['#4ab0c8', '#1a6a8a'], shore: '#6aa84f',
    fish: [['メダカ', 'N', 'fish', '#d8c8a0', '#a08a60', ''], ['フナ', 'N', 'fish', '#8a9a6a', '#5a6a40', ''], ['ドジョウ', 'R', 'long', '#a08a5a', '#6a5a3a', 'spots'],
      ['オイカワ', 'R', 'fish', '#c8d8f0', '#ff6a8a', 'stripes'], ['ヤマメ', 'SR', 'fish', '#c0c8b0', '#6a7a5a', 'spots'], ['アユ', 'SR', 'fish', '#d8d0a0', '#e8c040', ''],
      ['主のナマズ', 'UR', 'catfish', '#5a5040', '#3a3020', ''], ['黄金のコイ', 'LR', 'fish', '#ffd040', '#ff9a20', 'shine'], ['カッパ', 'GOD', 'kappa', '#5ac86a', '#2a8a4a', ''] ] },
  { id: 'lake', nm: '山の湖', mult: 10, need: 8000, sky: ['#a0c8f0', '#e0f0ff'], water: ['#3a8ac8', '#1a4a8a'], shore: '#5a8a5a',
    fish: [['ワカサギ', 'N', 'fish', '#d0e0e8', '#8aa0b0', ''], ['ブルーギル', 'N', 'round', '#6a8aa0', '#ffa040', 'stripes'], ['ニジマス', 'R', 'fish', '#c0c8d0', '#ff7a9a', 'rainbow'],
      ['ブラックバス', 'R', 'fish', '#5a7a4a', '#2a3a20', 'stripes'], ['ヒメマス', 'SR', 'fish', '#ff6a5a', '#5a8a4a', ''], ['ライギョ', 'SR', 'long', '#4a4a3a', '#8a8a5a', 'spots'],
      ['湖の主イトウ', 'UR', 'fish', '#a05a4a', '#5a3a2a', 'spots'], ['白銀のチョウザメ', 'LR', 'sturgeon', '#e0e8f0', '#8a9ab0', 'shine'], ['湖の竜', 'GOD', 'dragon', '#3ac8b0', '#ffd040', 'shine'] ] },
  { id: 'sea', nm: '港の海', mult: 120, need: 6e6, sky: ['#7ac0ff', '#e8f6ff'], water: ['#2a7ac8', '#0a3a7a'], shore: '#c8b088',
    fish: [['アジ', 'N', 'fish', '#c0d0d8', '#e8d070', ''], ['サバ', 'N', 'fish', '#4a7aa0', '#d0e0e8', 'stripes'], ['マダイ', 'R', 'fish', '#ff7a7a', '#ffc0b0', 'spots'],
      ['ヒラメ', 'R', 'flat', '#8a7a5a', '#5a4a3a', 'spots'], ['ブリ', 'SR', 'fish', '#5a7ab0', '#ffe060', 'stripes'], ['クロマグロ', 'SR', 'tuna', '#2a3a6a', '#c0c8d8', ''],
      ['カジキ', 'UR', 'marlin', '#3a5aa0', '#a0c8ff', 'stripes'], ['七色のマンボウ', 'LR', 'sunfish', '#ff8ad0', '#8ad0ff', 'rainbow'], ['竜宮の姫魚', 'GOD', 'fish', '#fff0f8', '#ff5fb8', 'shine'] ] },
  { id: 'deep', nm: '深海', mult: 1600, need: 3e8, sky: ['#0a1a3a', '#1a3a6a'], water: ['#0a2a5a', '#000a1a'], shore: '#3a4a5a',
    fish: [['ハダカイワシ', 'N', 'fish', '#4a5a7a', '#8affff', 'glow'], ['チョウチンアンコウ', 'N', 'angler', '#3a2a3a', '#ffe060', 'glow'], ['ダイオウグソクムシ', 'R', 'bug', '#c8b8a0', '#8a7a6a', ''],
      ['リュウグウノツカイ', 'R', 'long', '#e0e8f0', '#ff4a4a', 'shine'], ['ラブカ', 'SR', 'eel', '#5a5a6a', '#8a8a9a', ''], ['シーラカンス', 'SR', 'fish', '#3a4a7a', '#e0e8ff', 'spots'],
      ['ダイオウイカ', 'UR', 'squid', '#ff6a5a', '#a03a3a', ''], ['光る深海竜', 'LR', 'dragon', '#2a3a8a', '#8affff', 'glow'], ['深淵の王', 'GOD', 'angler', '#1a0a2a', '#ff4fa0', 'glow'] ] },
  { id: 'star', nm: '星空の池', mult: 25000, need: 1.5e10, sky: ['#05051a', '#2a1a5a'], water: ['#1a0a4a', '#05001a'], shore: '#2a2a5a',
    fish: [['ほしくずウオ', 'N', 'fish', '#c8d0ff', '#ffffff', 'glow'], ['つきのウオ', 'N', 'round', '#fff0c0', '#d0c090', ''], ['すいせいサバ', 'R', 'fish', '#8ac8ff', '#ffffff', 'stripes'],
      ['ぎんがエイ', 'R', 'flat', '#4a3aa0', '#ff8ad0', 'glow'], ['オーロラクジラ', 'SR', 'whale', '#3ad0b0', '#b06aff', 'rainbow'], ['せいうんクラゲ', 'SR', 'jelly', '#ff8ad0', '#8ad0ff', 'glow'],
      ['ほしのリュウ', 'UR', 'dragon', '#ffe060', '#ffffff', 'glow'], ['たいようの金魚', 'LR', 'fish', '#ff6a2a', '#ffd040', 'shine'], ['はじまりの魚', 'GOD', 'fish', '#ffffff', '#ffd0f0', 'rainbow'] ] },
  // ゴールのあとに行ける、終わりのない池。ここではすべての池の魚が出る。深くもぐるほど値段が上がる
  { id: 'dream', nm: '夢の池', mult: 2e5, need: 8e11, dream: true, sky: ['#ffd6f0', '#c8b0ff'], water: ['#a07aff', '#3a1a7a'], shore: '#8a6ac8', fish: [] },
];
const FISH = [], DREAM = 5;
PONDS.forEach((p, pi) => p.fish.forEach((f, i) => FISH.push({ id: pi * 9 + i, pond: pi, nm: f[0], r: f[1], shape: f[2], c1: f[3], c2: f[4], pat: f[5] })));
// 究極の魚（池ごとに1匹＋夢の池に1匹）。番号は100から（前のセーブの図鑑とぶつからないように）
[['水神の白蛇', 'eel', '#ffffff', '#a0e0ff', 'shine'], ['湖底の古代魚', 'sturgeon', '#3a2a1a', '#ffd040', 'shine'], ['海神の大クジラ', 'whale', '#1a2a6a', '#8affff', 'glow'],
 ['深淵の大眼', 'squid', '#120a14', '#ff2a2a', 'glow'], ['流れ星の魚', 'fish', '#ffffff', '#ffe060', 'rainbow'], ['夢見る神魚', 'dragon', '#ffd0f0', '#b07aff', 'rainbow']]
  .forEach((f, pi) => FISH.push({ id: 100 + pi, pond: pi, nm: f[0], r: 'ULT', shape: f[1], c1: f[2], c2: f[3], pat: f[4], ult: true }));
const NFISH = FISH.length;

// 池の値段の倍率（夢の池は深さ1ごとに×1.6）
const pondMult = (S, p) => PONDS[p].mult * (PONDS[p].dream ? Math.pow(1.6, S.depth || 0) : 1);
// 夢の池：つぎの深さまでに稼ぐコイン
const depthNeed = d => 6e11 * Math.pow(2.1, d);

// ---------------- エンドコンテンツ：ぬし ----------------
// ゴールのあと、各池にときどき「ぬし」が現れる。タイミングよくリールを巻いて釣り上げる
const BOSSES = [
  { nm: '小川のぬし「大ナマズ王」', base: 6, need: 5, speed: 1.0, zone: .3, shape: 'catfish', c1: '#3a3428', c2: '#d8b040' },
  { nm: '湖のぬし「千年イトウ」', base: 7, need: 6, speed: 1.25, zone: .26, shape: 'fish', c1: '#7a3a2a', c2: '#ffd040' },
  { nm: '海のぬし「嵐のカジキ」', base: 8, need: 7, speed: 1.5, zone: .22, shape: 'marlin', c1: '#1a3a7a', c2: '#ffd040' },
  { nm: '深海のぬし「黒いダイオウイカ」', base: 9, need: 8, speed: 1.8, zone: .19, shape: 'squid', c1: '#2a1a2a', c2: '#ff4fa0' },
  { nm: '星空のぬし「天の川クジラ」', base: 10, need: 9, speed: 2.1, zone: .16, shape: 'whale', c1: '#1a1a5a', c2: '#ffe060' },
  { nm: '夢のぬし「まどろみの龍」', base: 11, need: 10, speed: 2.4, zone: .14, shape: 'dragon', c1: '#b07aff', c2: '#ffd0f0' },
];
// 金色の魚：ゴールのあとだけ出る。はじめて釣った種類ごとに、ずっと値段+3%
const GOLD_CHANCE = 1 / 500;
function goldChance(S) { return S.cleared ? GOLD_CHANCE * (1 + luck(S) * .01) : 0; }
const goldCount = S => Object.keys(S.gold || {}).length;

// ---------------- 強化 ----------------
const UPS = [
  { k: 'fisher', nm: '釣り人を呼ぶ', desc: 'ねこの釣り師が1匹ふえる', base: 30, g: 3.0, max: 7 },
  { k: 'rod', nm: 'いい竿', desc: '魚がかかるまでが早くなる', base: 15, g: 1.55, max: 30 },
  { k: 'bait', nm: '特製エサ', desc: '運+1（レアな魚が出やすい）', base: 40, g: 2.1, max: 20 },
  { k: 'net', nm: '大きな網', desc: '魚の値段 ×1.25', base: 25, g: 1.7, max: 60 },
  { k: 'master', nm: '名人の技', desc: 'ほったらかしでも釣り上げる率 +5%', base: 150, g: 2.4, max: 8 },
];
// 値段は「いちばん先の池」の倍率に合わせて上がる（前の池にもどって安く買う、はできない）
const upCost = (k, lv, S) => { const u = UPS.find(x => x.k === k); return Math.ceil(u.base * Math.pow(u.g, lv) * (S ? pondMult(S, S.maxPond ?? S.pond) : 1)); };

// ---------------- 状態 ----------------
function newState() {
  return {
    v: 1, coins: 0, pearls: 0, pond: 0, maxPond: 0, best: 0,
    depth: 0, dreamCoins: 0, gold: {}, trophy: {}, bossWin: 0, bossT: 120,
    lv: { fisher: 0, rod: 0, bait: 0, net: 0, master: 0 },
    charm: 0,            // 永久の運（池を移ると増える・ガチャ）
    hat: 0,              // 永久の値段アップ（ガチャ）
    zukan: {},           // 魚id → { n, big }
    buffs: [],           // { k: 'luck'|'value'|'fever', v, until }（ゲーム内の時刻）
    omikuji: { day: '', res: null },
    stats: { catches: 0, total: 0, chests: 0, nice: 0, moves: 0, gacha: 0, playT: 0 },
    t: 0,                // 遊んだ時間（秒）
    last: Date.now(),
  };
}

// ---------------- 計算 ----------------
// 同じ種類のブーストは重ならない（いちばん強いものだけ効く）
function buffSum(S, k) { return S.buffs.filter(b => b.k === k && b.until > S.t).reduce((s, b) => Math.max(s, b.v), 0); }
function fever(S) { return S.buffs.some(b => b.k === 'fever' && b.until > S.t); }
function omikujiNow(S) { return S.omikuji.day === today() ? S.omikuji.res : null; }
function luck(S) {
  const om = omikujiNow(S);
  return Math.max(0, S.lv.bait + S.charm + Object.keys(S.trophy || {}).length * 2 + buffSum(S, 'luck') + (om ? OMIKUJI.find(o => o.k === om).luck : 0));
}
function weights(S) {
  const L = luck(S);
  return RORDER.map(r => RAR[r].w * (1 + L * RAR[r].k));
}
function rollRarity(S, rng) {
  const w = weights(S), sum = w.reduce((a, b) => a + b, 0);
  let x = rng() * sum;
  for (let i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return RORDER[i]; }
  return 'N';
}
function rollFish(S, rng) {
  const r = rng() < ULT_CHANCE ? 'ULT' : rollRarity(S, rng);
  const dream = PONDS[S.pond].dream;
  const pool = FISH.filter(f => f.r === r && (r === 'ULT' ? f.pond === S.pond : dream || f.pond === S.pond));
  const f = pool[Math.floor(rng() * pool.length)];
  const size = .7 + rng() * .6 + (rng() < .03 ? .6 : 0);   // まれに大物
  const gold = !PONDS[S.pond].dream && rng() < goldChance(S);   // 金色はそれぞれの池でだけ出る
  return { f, size, gold };
}
function valueMult(S) {
  const om = omikujiNow(S);
  return pondMult(S, S.pond) * (1 + goldCount(S) * .03) * Math.pow(1.25, S.lv.net) * (1 + S.hat * .1) * (fever(S) ? 2 : 1) * (1 + buffSum(S, 'value')) * (om ? OMIKUJI.find(o => o.k === om).value : 1);
}
function fishValue(S, f, size) { return Math.max(1, Math.round(RAR[f.r].v * size * valueMult(S))); }
const CAST = 1.1, REEL = .7, WINDOW = 1.4;
function waitMean(S) { return Math.max(1, 6 * Math.pow(.92, S.lv.rod)) / (fever(S) ? 2 : 1); }
function autoRate(S) { return Math.min(1, .6 + S.lv.master * .05); }
function fishers(S) { return 1 + S.lv.fisher; }
function catchesPerSec(S) { return fishers(S) * autoRate(S) / (CAST + waitMean(S) + WINDOW * .5 + REEL); }
function avgValue(S) {
  const w = weights(S), sum = w.reduce((a, b) => a + b, 0);
  return RORDER.reduce((s, r, i) => s + w[i] / sum * RAR[r].v, 0) * valueMult(S);
}
function perSec(S) { return catchesPerSec(S) * avgValue(S); }
function today() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

// ---------------- 釣り（1匹ずつの動き） ----------------
// 釣り人ごとに：投げる → 待つ → かかった！（タップで確実） → 釣り上げる／逃げる
function makeRun(S, rng = Math.random) {
  const run = { rng, fs: [], events: [], feverNext: 120 + rng() * 120 };
  run.sync = () => { while (run.fs.length < fishers(S)) run.fs.push({ ph: 'cast', t: rng() * CAST, dur: CAST }); run.fs.length = fishers(S); };
  run.sync();
  run.tap = i => { const f = run.fs[i]; if (f && f.ph === 'bite') { f.nice = true; f.t = f.dur; } };
  run.step = dt => {
    S.t += dt; S.stats.playT += dt;
    // フィーバーはときどき勝手に来る
    run.feverNext -= dt;
    if (run.feverNext <= 0) { run.feverNext = 150 + rng() * 150; addBuff(S, 'fever', 1, 30); run.events.push({ k: 'fever' }); }
    run.fs.forEach((f, i) => {
      f.t += dt;
      if (f.t < f.dur) return;
      if (f.ph === 'cast') { f.ph = 'wait'; f.t = 0; f.dur = -Math.log(1 - rng()) * waitMean(S); }
      else if (f.ph === 'wait') { f.ph = 'bite'; f.t = 0; f.dur = WINDOW; f.nice = false; f.catch = rollFish(S, rng); run.events.push({ k: 'bite', i }); }
      else if (f.ph === 'bite') {
        if (f.nice || rng() < autoRate(S)) { f.ph = 'reel'; f.t = 0; f.dur = REEL; }
        else { run.events.push({ k: 'escape', i }); f.ph = 'cast'; f.t = 0; f.dur = CAST; }
      } else if (f.ph === 'reel') {
        const { f: fish, size, gold } = f.catch;
        const ev = landFish(S, fish, size, f.nice, rng, gold); ev.i = i;
        run.events.push(ev);
        f.ph = 'cast'; f.t = 0; f.dur = CAST;
      }
    });
  };
  return run;
}
function landFish(S, fish, size, nice, rng, gold) {
  let v = fishValue(S, fish, size);
  if (nice) { v = Math.round(v * 1.5); S.stats.nice++; }
  let goldNew = false;
  if (gold) { v *= 10; S.gold = S.gold || {}; goldNew = !S.gold[fish.id]; S.gold[fish.id] = (S.gold[fish.id] || 0) + 1; }
  S.coins += v; S.stats.total += v; S.stats.catches++;
  S.best = Math.max(S.best, S.coins);
  const z = S.zukan[fish.id] || (S.zukan[fish.id] = { n: 0, big: 0 });
  const isNew = z.n === 0;
  z.n++; z.big = Math.max(z.big, Math.round(size * 100) / 100);
  const pearls = RAR[fish.r].p; S.pearls += pearls;
  const chest = rng() < .012;
  if (chest) S.stats.chests++;
  const deeper = dreamProgress(S, v);
  return { k: 'catch', fish, size, v, nice, isNew, pearls, chest, gold, goldNew, deeper };
}
// 夢の池で稼ぐと深くもぐれる（コインはそのまま）
function dreamProgress(S, v) {
  if (!PONDS[S.pond].dream) return 0;
  S.dreamCoins += v; let n = 0;
  while (S.dreamCoins >= depthNeed(S.depth)) { S.dreamCoins -= depthNeed(S.depth); S.depth++; n++; }
  S.bestDepth = Math.max(S.bestDepth || 0, S.depth);
  return n;
}
function addBuff(S, k, v, secs) { S.buffs = S.buffs.filter(b => b.until > S.t); S.buffs.push({ k, v, until: S.t + secs }); }

// ---------------- 強化を買う ----------------
function canBuy(S, k) { const u = UPS.find(x => x.k === k); return S.lv[k] < u.max && S.coins >= upCost(k, S.lv[k], S); }
function buy(S, k) { if (!canBuy(S, k)) return false; S.coins -= upCost(k, S.lv[k], S); S.lv[k]++; return true; }

// ---------------- ぬし ----------------
function bossOf(S) { return BOSSES[Math.min(S.pond, BOSSES.length - 1)]; }
function bossWin(S) {
  const first = !S.trophy[S.pond]; S.trophy[S.pond] = 1; S.bossWin = (S.bossWin || 0) + 1;
  S.bossN = S.bossN || {}; S.bossN[S.pond] = (S.bossN[S.pond] || 0) + 1;
  const pearls = first ? 50 : 15, v = Math.round(bossOf(S).base * 30 * avgValue(S));
  S.pearls += pearls; S.coins += v; S.stats.total += v; S.best = Math.max(S.best, S.coins); dreamProgress(S, v);
  return { first, pearls, v };
}

// ---------------- 宝箱のルーレット ----------------
// w: ルーレットの広さ。coin は「今の1匹ぶんの平均」の何倍か
const WHEEL = [
  { k: 'coin', v: 20, nm: 'コイン 20匹分', w: 22, c: '#ffd040' },
  { k: 'pearl', v: 5, nm: '真珠 ×5', w: 18, c: '#e0f0ff' },
  { k: 'fever', v: 45, nm: 'フィーバー45秒', w: 14, c: '#ff5fb8' },
  { k: 'coin', v: 80, nm: 'コイン 80匹分', w: 12, c: '#ffa020' },
  { k: 'luck', v: 10, nm: '運+10（3分）', w: 12, c: '#4ad66a' },
  { k: 'none', v: 0, nm: 'はずれ…', w: 14, c: '#5a5a7a' },
  { k: 'pearl', v: 25, nm: '真珠 ×25', w: 6, c: '#8ad0ff' },
  { k: 'jackpot', v: 1000, nm: '大当たり', w: 2, c: '#ff4fa0' },
];
function spinWheel(rng) { const sum = WHEEL.reduce((s, x) => s + x.w, 0); let x = rng() * sum; for (let i = 0; i < WHEEL.length; i++) { x -= WHEEL[i].w; if (x <= 0) return i; } return 0; }
// 大当たり：コイン1000匹分＋真珠30＋フィーバー60秒＋運+15（5分）＋ときどきお守り
function applyPrize(S, p, rng = Math.random) {
  if (p.k === 'jackpot') {
    addBuff(S, 'luck', 15, 300); addBuff(S, 'fever', 1, 60);   // 先にブーストをかけてから、コインを計算（フィーバー中の値段で）
    const v = Math.round(p.v * avgValue(S)); S.coins += v; S.stats.total += v; S.best = Math.max(S.best, S.coins);
    S.pearls += 30;
    const charm = rng() < .25; if (charm) S.charm++;
    S.stats.jackpot = (S.stats.jackpot || 0) + 1;
    return { v, pearls: 30, charm };
  }
  if (p.k === 'coin') { const v = Math.round(p.v * avgValue(S)); S.coins += v; S.stats.total += v; return v; }
  if (p.k === 'pearl') { S.pearls += p.v; return p.v; }
  if (p.k === 'fever') { addBuff(S, 'fever', 1, p.v); return p.v; }
  if (p.k === 'luck') { addBuff(S, 'luck', p.v, 180); return p.v; }
  return 0;
}

// ---------------- 真珠ガチャ ----------------
const GACHA_COST = 10;
const GACHA = [
  { k: 'coin', r: 'N', nm: 'コイン 50匹分', w: 49 },
  { k: 'luck', r: 'R', nm: '運+8（10分）', w: 24 },
  { k: 'value', r: 'R', nm: '値段 ×1.5（10分）', w: 14 },
  { k: 'fever', r: 'SR', nm: 'すぐにフィーバー60秒', w: 9 },
  { k: 'charm', r: 'UR', nm: 'お守りのかけら（ずっと運+1）', w: 3 },
  { k: 'hat', r: 'LR', nm: '名人の帽子（ずっと値段+10%）', w: 1 },
];
function gacha(S, rng) {
  if (S.pearls < GACHA_COST) return null;
  S.pearls -= GACHA_COST; S.stats.gacha++;
  const sum = GACHA.reduce((s, x) => s + x.w, 0); let x = rng() * sum, g = GACHA[0];
  for (const it of GACHA) { x -= it.w; if (x <= 0) { g = it; break; } }
  if (g.k === 'coin') { const v = Math.round(50 * avgValue(S)); S.coins += v; S.stats.total += v; }
  if (g.k === 'luck') addBuff(S, 'luck', 8, 600);
  if (g.k === 'value') addBuff(S, 'value', .5, 600);
  if (g.k === 'fever') addBuff(S, 'fever', 1, 60);
  if (g.k === 'charm') S.charm++;
  if (g.k === 'hat') S.hat++;
  return g;
}

// ---------------- おみくじ（1日1回） ----------------
const OMIKUJI = [
  { k: '大吉', w: 10, luck: 8, value: 1.5, msg: '今日は何でも釣れる日！' },
  { k: '中吉', w: 20, luck: 5, value: 1.2, msg: 'いい風が吹いている。' },
  { k: '吉', w: 30, luck: 3, value: 1.1, msg: 'のんびりいこう。' },
  { k: '小吉', w: 25, luck: 1, value: 1, msg: '小さな幸せが釣れそう。' },
  { k: '末吉', w: 10, luck: 0, value: 1, msg: 'あとからいいことがある。' },
  { k: '凶', w: 5, luck: -2, value: 1, msg: 'なぐさめに真珠を20こ。' },
];
function drawOmikuji(S, rng) {
  if (S.omikuji.day === today()) return null;
  const sum = OMIKUJI.reduce((s, x) => s + x.w, 0); let x = rng() * sum, o = OMIKUJI[0];
  for (const it of OMIKUJI) { x -= it.w; if (x <= 0) { o = it; break; } }
  S.omikuji = { day: today(), res: o.k };
  if (o.k === '凶') S.pearls += 20;
  return o;
}

// ---------------- 池を移る ----------------
const GOAL = 4e11;   // 星空の池でここまで貯めたらクリア
// 新しい池へ進む（いちばん先の池から、つぎの池へ。必要なコインを払う。強化はそのまま）
function nextPond(S) { const m = S.maxPond ?? S.pond; return m < PONDS.length - 1 ? m + 1 : -1; }
function canMove(S) { const n = nextPond(S); return n > 0 && S.coins >= PONDS[n].need && (!PONDS[n].dream || S.cleared); }
function movePond(S) {
  if (!canMove(S)) return false;
  const n = nextPond(S); S.coins = Math.max(0, S.coins - PONDS[n].need); S.maxPond = n; S.pond = n;
  S.charm += 1; S.stats.moves++;
  return true;
}
// 行ったことのある池へもどる（コイン・強化はそのまま。魚の値段はその池の倍率になる）
function travel(S, p) {
  if (p < 0 || p > (S.maxPond ?? S.pond) || p === S.pond) return false;
  S.pond = p; return true;
}

// ---------------- 留守中の釣果 ----------------
const OFFLINE_CAP = 8 * 3600, OFFLINE_RATE = .5;
function offline(S, secs, rng = Math.random) {
  secs = Math.min(OFFLINE_CAP, Math.max(0, secs));
  const n = Math.floor(secs * catchesPerSec(Object.assign({}, S, { buffs: [] })) * OFFLINE_RATE);
  if (n <= 0) return null;
  // 多いときは一部だけ実際に釣って、残りは平均でかける
  const sample = Math.min(n, 1500), scale = n / sample;
  const got = {}; let coins = 0, pearls = 0, best = null;
  const keepBuffs = S.buffs; S.buffs = [];
  for (let i = 0; i < sample; i++) {
    const { f, size } = rollFish(S, rng);
    coins += fishValue(S, f, size); pearls += RAR[f.r].p;
    got[f.id] = (got[f.id] || 0) + 1;
    const z = S.zukan[f.id] || (S.zukan[f.id] = { n: 0, big: 0 }); z.n++; z.big = Math.max(z.big, Math.round(size * 100) / 100);
    if (!best || RORDER.indexOf(f.r) > RORDER.indexOf(best.r)) best = f;
  }
  S.buffs = keepBuffs;
  coins = Math.round(coins * scale); pearls = Math.round(pearls * scale);
  S.coins += coins; S.pearls += pearls; S.stats.total += coins; S.stats.catches += n;
  S.best = Math.max(S.best, S.coins);
  const deeper = dreamProgress(S, coins);
  return { secs, n, coins, pearls, best, got, deeper };
}

const API = { NFISH, ULT_CHANCE, DREAM, pondMult, depthNeed, BOSSES, bossOf, bossWin, goldChance, goldCount, nextPond, travel, GOAL, RAR, RORDER, PONDS, FISH, UPS, upCost, newState, luck, weights, rollFish, fishValue, valueMult, waitMean, autoRate, fishers, catchesPerSec, avgValue, perSec,
  makeRun, canBuy, buy, WHEEL, spinWheel, applyPrize, GACHA, GACHA_COST, gacha, OMIKUJI, drawOmikuji, omikujiNow, canMove, movePond, offline, fever, addBuff, today, CAST, REEL, WINDOW };
if (typeof module !== 'undefined') module.exports = API; else root.Fish = API;
})(this);
