// ねこ砦 ∞ 次元防衛 ― ゲームの中身（描画なし。node でも動く）
// 座標は「たて長」の盤面（10×16マス）。横長の画面では描画のときだけ縦横を入れかえる。
(function (root) {
  const W = 10, H = 16;

  // ================= マップ（4つの世界 × 3面） =================
  const WORLDS = [
    { nm: '魔法の森', sub: 'ファンタジー', bg: '#0c1a14', tile: ['#183a2a', '#1c4230'], path: '#2a1f3a', neon: '#7dff9a', neon2: '#c88aff', deco: 'tree' },
    { nm: 'おかしの国', sub: 'スイーツ', bg: '#1e0e1c', tile: ['#3a1a34', '#42203c'], path: '#2a1430', neon: '#ff7ad9', neon2: '#7af0ff', deco: 'candy' },
    { nm: 'ネオン都市', sub: 'SF', bg: '#070a1a', tile: ['#0e1430', '#111a3a'], path: '#0a0a14', neon: '#3af0ff', neon2: '#ff3ad0', deco: 'pylon' },
    { nm: '8bit魔王城', sub: 'レトロ', bg: '#120808', tile: ['#2a1414', '#321818'], path: '#140a0a', neon: '#ffd23a', neon2: '#ff4a3a', deco: 'brick' },
  ];
  const MAPS = [
    { w: 0, nm: 'はじまりの小道', paths: [[[2, -1], [2, 4], [7, 4], [7, 9], [3, 9], [3, 13], [6, 13], [6, 16]]] },
    { w: 0, nm: 'ほたるの谷', paths: [[[7, -1], [7, 3], [2, 3], [2, 7], [7, 7], [7, 11], [2, 11], [2, 16]]] },
    { w: 0, nm: '古木の迷い道', paths: [[[5, -1], [5, 2], [1, 2], [1, 6], [8, 6], [8, 10], [1, 10], [1, 14], [5, 14], [5, 16]]] },
    { w: 1, nm: 'ドーナツ街道', paths: [[[1, -1], [1, 13], [4, 13], [4, 2], [8, 2], [8, 16]]] },
    { w: 1, nm: 'ミルフィーユ坂', paths: [[[8, -1], [8, 5], [1, 5], [1, 2], [4, 2], [4, 12], [8, 12], [8, 9], [6, 9], [6, 16]]] },
    { w: 1, nm: 'ふたまたプリン', paths: [[[2, -1], [2, 8], [5, 8], [5, 16]], [[8, -1], [8, 8], [5, 8], [5, 16]]] },
    { w: 2, nm: 'ネオン横丁', paths: [[[-1, 2], [8, 2], [8, 5], [1, 5], [1, 8], [8, 8], [8, 11], [1, 11], [1, 14], [5, 14], [5, 16]]] },
    { w: 2, nm: '交差するハイウェイ', paths: [[[5, -1], [5, 7], [2, 7], [2, 3], [8, 3], [8, 12], [2, 12], [2, 16]]] },
    { w: 2, nm: 'ツインゲート', paths: [[[-1, 3], [4, 3], [4, 13], [5, 13], [5, 16]], [[10, 6], [6, 6], [6, 13], [5, 13], [5, 16]]] },
    { w: 3, nm: 'ドットの回廊', paths: [[[1, -1], [1, 3], [8, 3], [8, 6], [1, 6], [1, 9], [8, 9], [8, 12], [1, 12], [1, 15], [5, 15], [5, 16]]] },
    { w: 3, nm: 'ふたつの城門', paths: [[[3, -1], [3, 6], [7, 6], [7, 16]], [[7, -1], [7, 3], [1, 3], [1, 10], [5, 10], [5, 13], [7, 13], [7, 16]]] },
    { w: 3, nm: '魔王の玉座', paths: [[[1, -1], [1, 7], [4, 7], [4, 12], [5, 12], [5, 16]], [[8, -1], [8, 10], [5, 10], [5, 16]]] },
  ];

  // ================= タワー（ねこ） =================
  // lv: 1〜3 は一本道、4・5 は A/B の分かれ道
  const TOWERS = {
    archer: {
      nm: '弓ねこ', role: 'すばやい一撃。空の敵もうてる', cost: 50, dmgType: 'phys', air: true, color: '#7dff9a', unlock: 0,
      lv: [{ dmg: 8, rate: 1.4, range: 2.6 }, { dmg: 12, rate: 1.5, range: 2.7, cost: 40 }, { dmg: 18, rate: 1.6, range: 2.8, cost: 70 }],
      A: { nm: '連射', desc: '矢をすばやく連射', lv: [{ dmg: 16, rate: 3.2, range: 2.9, cost: 120 }, { dmg: 22, rate: 4.4, range: 3.0, cost: 180 }] },
      B: { nm: '狙撃', desc: '遠くの敵を大ダメージで射抜く', lv: [{ dmg: 64, rate: .7, range: 4.2, cost: 130 }, { dmg: 120, rate: .75, range: 5.2, cost: 200 }] },
    },
    magic: {
      nm: '魔法ねこ', role: '火の玉でまとめて燃やす（空にはとどかない）', cost: 80, dmgType: 'magic', air: false, color: '#ff8a3a', unlock: 0,
      lv: [{ dmg: 14, rate: .8, range: 2.2, splash: .9 }, { dmg: 22, rate: .85, range: 2.3, splash: .95, cost: 60 }, { dmg: 32, rate: .9, range: 2.4, splash: 1.0, cost: 100 }],
      A: { nm: '隕石', desc: '大きな爆発で広くなぎはらう', lv: [{ dmg: 70, rate: .5, range: 2.6, splash: 1.5, cost: 160 }, { dmg: 125, rate: .5, range: 2.8, splash: 1.8, cost: 240 }] },
      B: { nm: '炎上', desc: '当たった敵を燃やしつづける', lv: [{ dmg: 30, rate: .9, range: 2.5, splash: 1.0, burn: 14, cost: 150 }, { dmg: 42, rate: 1.0, range: 2.6, splash: 1.1, burn: 28, cost: 220 }] },
    },
    ice: {
      nm: '氷ねこ', role: '当てた敵をおそくする', cost: 70, dmgType: 'magic', air: false, color: '#7ad8ff', unlock: 1,
      lv: [{ dmg: 4, rate: 1.0, range: 2.0, slow: .35, st: 1.5 }, { dmg: 6, rate: 1.1, range: 2.1, slow: .42, st: 1.6, cost: 50 }, { dmg: 9, rate: 1.2, range: 2.2, slow: .48, st: 1.8, cost: 80 }],
      A: { nm: '凍結', desc: 'ときどき敵をこおらせて止める', lv: [{ dmg: 14, rate: 1.3, range: 2.3, slow: .5, st: 1.8, freeze: .22, ft: 1.0, cost: 130 }, { dmg: 22, rate: 1.4, range: 2.4, slow: .55, st: 2, freeze: .35, ft: 1.4, cost: 190 }] },
      B: { nm: '吹雪', desc: 'まわりの敵ぜんぶをおそくする（空も）', lv: [{ dmg: 0, aura: 6, rate: 0, range: 2.0, slow: .45, cost: 140, airAura: true }, { dmg: 0, aura: 14, rate: 0, range: 2.3, slow: .58, cost: 200, airAura: true }] },
    },
    lightning: {
      nm: '雷ねこ', role: '敵から敵へ連鎖する雷（空もうてる）', cost: 100, dmgType: 'magic', air: true, color: '#ffe23a', unlock: 3,
      lv: [{ dmg: 16, rate: .9, range: 2.4, chain: 3 }, { dmg: 22, rate: .95, range: 2.5, chain: 3, cost: 70 }, { dmg: 30, rate: 1.0, range: 2.6, chain: 4, cost: 110 }],
      A: { nm: '連鎖', desc: 'たくさんの敵へつぎつぎ飛ぶ', lv: [{ dmg: 36, rate: 1.0, range: 2.7, chain: 7, cost: 170 }, { dmg: 50, rate: 1.1, range: 2.8, chain: 10, cost: 240 }] },
      B: { nm: '過負荷', desc: '強い雷で敵をしびれさせる', lv: [{ dmg: 64, rate: .8, range: 2.7, chain: 2, stun: .6, cost: 170 }, { dmg: 105, rate: .85, range: 2.8, chain: 2, stun: 1.0, cost: 240 }] },
    },
    laser: {
      nm: 'レーザーねこ', role: '当てつづけるほど強くなる光線。よろいもつらぬく', cost: 120, dmgType: 'true', air: true, color: '#ff3ad0', unlock: 4,
      lv: [{ dps: 20, ramp: 1, range: 2.8 }, { dps: 30, ramp: 1, range: 2.9, cost: 90 }, { dps: 42, ramp: 1.2, range: 3.0, cost: 130 }],
      A: { nm: '収束', desc: '1体をとことん焼ききる', lv: [{ dps: 70, ramp: 2, range: 3.1, cost: 200 }, { dps: 110, ramp: 2.5, range: 3.2, cost: 280 }] },
      B: { nm: '拡散', desc: '光線の先の敵もまとめてつらぬく', lv: [{ dps: 40, ramp: 1, range: 3.2, pierce: 1, cost: 190 }, { dps: 68, ramp: 1.2, range: 3.4, pierce: 1, cost: 270 }] },
    },
    cafe: {
      nm: 'おかしやねこ', role: 'ウェーブごとにコイン。となりのねこを応援', cost: 90, dmgType: 'none', air: false, color: '#ffb0e0', unlock: 6, support: true,
      lv: [{ coin: 15, buff: .1, range: 1.5 }, { coin: 25, buff: .15, range: 1.5, cost: 70 }, { coin: 40, buff: .2, range: 1.5, cost: 100 }],
      A: { nm: '金貨', desc: 'ウェーブごとのコインがどっさり', lv: [{ coin: 80, buff: .2, range: 1.5, cost: 160 }, { coin: 140, buff: .2, range: 1.5, cost: 220 }] },
      B: { nm: '応援', desc: 'まわりのねこを大きく強くする', lv: [{ coin: 30, buff: .35, rateBuff: .15, range: 1.6, cost: 160 }, { coin: 30, buff: .6, rateBuff: .25, range: 1.8, cost: 230 }] },
    },
  };
  const TORDER = ['archer', 'magic', 'ice', 'lightning', 'laser', 'cafe'];

  // ================= 敵 =================
  const ENEMIES = {
    slime: { nm: 'あめスライム', hp: 30, spd: 1.0, gold: 4, desc: 'ふつうの敵', first: 0 },
    drone: { nm: 'ミニドローン', hp: 22, spd: 1.9, gold: 4, desc: 'とても足がはやい', first: 1 },
    pudding: { nm: 'ぷるぷるプリン', hp: 130, spd: .6, gold: 10, desc: 'おそいけど体力が多い', first: 2 },
    cotton: { nm: 'わたあめ', hp: 45, spd: 1.1, gold: 7, fly: true, desc: '空を飛ぶ。魔法ねこ・氷ねこの攻撃はとどかない', first: 3 },
    macaron: { nm: 'よろいマカロン', hp: 85, spd: .85, gold: 8, armor: .5, desc: 'よろいで物理ダメージ（弓）を半分にする', first: 4 },
    jelly: { nm: 'ぶんれつゼリー', hp: 70, spd: .9, gold: 5, split: 'mini', desc: 'たおすと2つに分かれる', first: 5 },
    mini: { nm: 'こゼリー', hp: 26, spd: 1.2, gold: 2, desc: '', first: 99 },
    ghost: { nm: 'まほうゴースト', hp: 70, spd: 1.0, gold: 8, mres: .5, desc: '魔法ダメージ（火・氷・雷）を半分にする', first: 6 },
    healer: { nm: 'いやしUFO', hp: 75, spd: .9, gold: 10, heal: .07, desc: 'まわりの敵を回復する。先にたおそう', first: 7 },
    boss1: { nm: '巨大ケーキナイト', hp: 1400, spd: .42, gold: 120, armor: .5, boss: 1, lives: 5, desc: 'よろいを着たボス', first: 99 },
    boss2: { nm: 'メカ大王ドローン', hp: 2600, spd: .5, gold: 180, mres: .5, boss: 1, lives: 5, desc: '魔法に強いボス', first: 99 },
    boss3: { nm: 'ドット魔王', hp: 3000, spd: .4, gold: 300, armor: .35, mres: .35, boss: 1, lives: 10, heal: .006, desc: '自分を回復する大魔王', first: 99 },
  };

  // ================= 呪文 =================
  const SPELLS = {
    meteor: { nm: '流星', desc: 'タップした場所に流れ星を落とす', cd: 28, dmg: 140, r: 1.5, unlock: 1 },
    freeze: { nm: '時止め', desc: 'すべての敵を3秒止める', cd: 50, t: 3, unlock: 4 },
  };

  // ================= 星の強化 =================
  const UPGRADES = [
    { id: 'coin', nm: '金庫', desc: 'はじめのコイン +25', max: 4, cost: [1, 1, 2, 2] },
    { id: 'life', nm: '城壁', desc: 'ライフ +3', max: 3, cost: [1, 2, 2] },
    { id: 'archer', nm: '弓の修行', desc: '弓ねこの攻撃 +10%', max: 3, cost: [1, 1, 2] },
    { id: 'magic', nm: '魔法の修行', desc: '魔法ねこの攻撃 +10%', max: 3, cost: [1, 1, 2] },
    { id: 'ice', nm: '氷の修行', desc: '氷ねこの攻撃とおそくする力 +10%', max: 3, cost: [1, 1, 2] },
    { id: 'lightning', nm: '雷の修行', desc: '雷ねこの攻撃 +10%', max: 3, cost: [1, 1, 2] },
    { id: 'laser', nm: '光の修行', desc: 'レーザーねこの攻撃 +10%', max: 3, cost: [1, 1, 2] },
    { id: 'cafe', nm: 'おかしの修行', desc: 'おかしやねこのコイン +15%', max: 3, cost: [1, 1, 2] },
    { id: 'spell', nm: '呪文の書', desc: '呪文の待ち時間 -12%', max: 3, cost: [1, 2, 2] },
    { id: 'refund', nm: '目きき', desc: '売ったときのコイン 70%→+8%', max: 2, cost: [1, 2] },
  ];

  // ================= 小道具 =================
  function rngOf(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pathInfo(pts) {
    const P = pts.map(([x, y]) => ({ x: x + .5, y: y + .5 }));
    const seg = []; let L = 0;
    for (let i = 1; i < P.length; i++) { const l = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); seg.push(l); L += l; }
    return { P, seg, L };
  }
  function posAt(pi, d) {
    const { P, seg } = pi;
    for (let i = 0; i < seg.length; i++) { if (d <= seg[i]) { const t = d / seg[i]; return { x: P[i].x + (P[i + 1].x - P[i].x) * t, y: P[i].y + (P[i + 1].y - P[i].y) * t, dir: Math.atan2(P[i + 1].y - P[i].y, P[i + 1].x - P[i].x) }; } d -= seg[i]; }
    const n = P.length - 1; return { x: P[n].x, y: P[n].y, dir: 0 };
  }
  // マップの「道」と「飾り（置けない）」のマス
  function layout(mi) {
    const M = MAPS[mi], grid = Array.from({ length: H }, () => Array(W).fill(0));   // 0 置ける 1 道 2 飾り
    for (const pts of M.paths) for (let i = 1; i < pts.length; i++) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) { const x = x0 + Math.sign(x1 - x0) * k, y = y0 + Math.sign(y1 - y0) * k; if (x >= 0 && y >= 0 && x < W && y < H) grid[y][x] = 1; }
    }
    const rnd = rngOf(mi * 977 + 13);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!grid[y][x] && rnd() < .08) grid[y][x] = 2;
    return grid;
  }

  // ================= ウェーブ =================
  const POOL_ORDER = ['slime', 'drone', 'pudding', 'cotton', 'macaron', 'jelly', 'ghost', 'healer'];
  const WAVES_N = [8, 9, 10, 10, 11, 12, 12, 13, 14, 14, 15, 15];
  function makeWaves(stage, endless) {
    const rnd = rngOf(stage * 7331 + (endless ? 99 : 1)), out = [];
    const pool = POOL_ORDER.filter(t => ENEMIES[t].first <= stage);
    const nPaths = MAPS[stage].paths.length;
    const n = endless ? 400 : WAVES_N[stage];
    for (let w = 0; w < n; w++) {
      const groups = [], newest = pool[pool.length - 1];
      const budget = 6 + w * (2 + Math.min(stage, 9) * .2) + (endless ? w * 1.2 : 0);
      let spent = 0, at = 0, g = 0;
      while (spent < budget && g < 6) {
        // 新しい敵は前半のウェーブで紹介する
        // 新しい敵は2ウェーブ目に少しだけ紹介して、あとはまぜる
        let t = pool[Math.floor(rnd() * pool.length)];
        if (w === 0) t = pool[Math.floor(rnd() * Math.max(1, pool.length - 1))];
        if (w === 1 && g === 0 && stage > 0) t = newest;
        const unit = { slime: 1, drone: .9, pudding: 3.2, cotton: 1.6, macaron: 2.4, jelly: 2.2, ghost: 2, healer: 2.6 }[t];
        const cnt = w === 1 && g === 0 && stage > 0 ? 3 : Math.max(2, Math.min(18, Math.round((budget - spent) / unit * (.35 + rnd() * .4))));
        groups.push({ t, n: cnt, gap: t === 'drone' ? .45 : t === 'pudding' ? 1.3 : .75, at, p: nPaths > 1 ? (g % nPaths) : 0 });
        spent += cnt * unit; at += cnt * .55 + 1.5; g++;
      }
      const last = !endless && w === n - 1;
      if (last && [2, 5, 8, 11].includes(stage)) groups.push({ t: stage === 11 ? 'boss3' : stage === 8 ? 'boss2' : 'boss1', n: 1, gap: 1, at: at + 2, p: 0 });
      if (endless && w % 10 === 9) groups.push({ t: ['boss1', 'boss2', 'boss3'][Math.floor(w / 10) % 3], n: 1 + Math.floor(w / 30), gap: 3, at: at + 2, p: 0 });
      out.push(groups);
    }
    return out;
  }
  const hpMul = (stage, w, endless) => (1 + stage * .07) * (1 + w * (endless ? .14 : .1)) * (endless ? 1 + Math.pow(Math.max(0, w - 20) / 12, 1.5) : 1);

  // ================= ゲーム =================
  function newGame(stage, opt = {}) {
    const up = opt.up || {}, endless = !!opt.endless;
    const G = {
      stage, endless, map: MAPS[stage], world: MAPS[stage].w, grid: layout(stage),
      paths: MAPS[stage].paths.map(pathInfo),
      coins: 150 + stage * 40 + (up.coin || 0) * 25 + (endless ? 300 : 0), lives: 20 + (up.life || 0) * 3, maxLives: 20 + (up.life || 0) * 3,
      up, waves: makeWaves(stage, endless), wave: 0, nextIn: -1, spawnQ: [], t: 0,
      towers: [], enemies: [], shots: [], fx: [], events: [], uid: 1,
      spells: { meteor: { cd: 0 }, freeze: { cd: 0 } }, freezeT: 0, over: 0, won: 0, kills: 0, leaked: 0,
    };
    return G;
  }
  const refundRate = G => .7 + (G.up.refund || 0) * .08;
  const spellCd = (G, k) => SPELLS[k].cd * (1 - (G.up.spell || 0) * .12);
  function statsOf(t) {
    const D = TOWERS[t.type];
    return t.lv <= 3 ? D.lv[t.lv - 1] : D[t.br].lv[t.lv - 4];
  }
  function nextUp(t) {   // つぎに強化できるもの
    const D = TOWERS[t.type];
    if (t.lv < 3) return [{ br: null, cost: D.lv[t.lv].cost }];
    if (t.lv === 3) return [{ br: 'A', cost: D.A.lv[0].cost }, { br: 'B', cost: D.B.lv[0].cost }];
    if (t.lv === 4) return [{ br: t.br, cost: D[t.br].lv[1].cost }];
    return [];
  }
  function canBuild(G, x, y) { return x >= 0 && y >= 0 && x < W && y < H && G.grid[y][x] === 0 && !G.towers.some(t => t.x === x && t.y === y); }
  function build(G, type, x, y) {
    const D = TOWERS[type]; if (!canBuild(G, x, y) || G.coins < D.cost) return null;
    G.coins -= D.cost;
    const t = { id: G.uid++, type, x, y, lv: 1, br: null, cd: 0, spent: D.cost, mode: 'first', beam: null, ramp: 0, kills: 0 };
    G.towers.push(t); G.events.push({ k: 'build', t }); return t;
  }
  function upgrade(G, t, br) {
    const opts = nextUp(t), o = t.lv === 3 ? opts.find(u => u.br === br) : opts[0];
    if (!o || G.coins < o.cost) return false;
    G.coins -= o.cost; t.spent += o.cost; if (t.lv === 3) t.br = br; t.lv++;
    G.events.push({ k: 'up', t }); return true;
  }
  function sell(G, t) { const v = Math.floor(t.spent * refundRate(G)); G.coins += v; G.towers = G.towers.filter(q => q !== t); G.events.push({ k: 'sell', t, v }); return v; }
  function startWave(G) {
    if (G.wave >= G.waves.length) return;
    const groups = G.waves[G.wave];
    let dur = 0;
    for (const g of groups) for (let i = 0; i < g.n; i++) { const at = G.t + g.at + i * g.gap; G.spawnQ.push({ at, t: g.t, p: g.p, w: G.wave }); dur = Math.max(dur, g.at + i * g.gap); }
    G.spawnQ.sort((a, b) => a.at - b.at);
    G.wave++;
    // ウェーブのはじめに、おかしやねこのコイン
    let c = 0; for (const t of G.towers) if (t.type === 'cafe') c += Math.round(statsOf(t).coin * (1 + (G.up.cafe || 0) * .15));
    if (c && G.wave > 1) { G.coins += c; G.events.push({ k: 'cafe', v: c }); }
    G.nextIn = G.wave < G.waves.length ? dur + 14 : -1;
    G.events.push({ k: 'wave', n: G.wave });
  }
  function callWave(G) {   // 早めに呼ぶとボーナス
    if (G.over || G.wave >= G.waves.length) return 0;
    let bonus = 0;
    if (G.nextIn > 0 && G.wave > 0) { bonus = Math.ceil(G.nextIn); G.coins += bonus; }
    startWave(G); return bonus;
  }
  function spawn(G, type, p, d = 0, w = G.wave) {
    const E = ENEMIES[type], hp = Math.round(E.hp * hpMul(G.stage, w - 1, G.endless));
    const e = { id: G.uid++, type, p, d, hp, max: hp, spd: E.spd, slowT: 0, slow: 0, frz: 0, burn: 0, burnT: 0, healT: 1, flash: 0, x: 0, y: 0 };
    const pos = posAt(G.paths[p], d); e.x = pos.x; e.y = pos.y; e.dir = pos.dir;
    G.enemies.push(e); return e;
  }
  function dmgMul(G, t) {
    let m = 1 + (G.up[t.type] || 0) * .1, r = 1;
    for (const c of G.towers) if (c.type === 'cafe' && c !== t) { const s = statsOf(c); if (Math.hypot(c.x - t.x, c.y - t.y) <= s.range + .01) { m += s.buff; r += s.rateBuff || 0; } }
    return [m, r];
  }
  function hurt(G, e, dmg, type, src) {
    if (e.hp <= 0) return;
    const E = ENEMIES[e.type];
    if (type === 'phys' && E.armor) dmg *= 1 - E.armor;
    if (type === 'magic' && E.mres) dmg *= 1 - E.mres;
    e.hp -= dmg; e.flash = .08;
    if (e.hp <= 0) kill(G, e, src);
  }
  function kill(G, e, src) {
    const E = ENEMIES[e.type];
    G.coins += E.gold; G.kills++; if (src) src.kills++;
    G.events.push({ k: 'die', e, gold: E.gold });
    if (E.split) for (const s of [-.25, .25]) { const m = spawn(G, E.split, e.p, Math.max(0, e.d + s), Math.max(1, G.wave)); m.hp = m.max = Math.round(ENEMIES.mini.hp * hpMul(G.stage, Math.max(0, G.wave - 1), G.endless)); }
  }
  function canHit(t, e) { return !ENEMIES[e.type].fly || TOWERS[t.type].air; }
  function pick(G, t, range) {
    let best = null, bv = -Infinity;
    for (const e of G.enemies) {
      if (e.hp <= 0 || !canHit(t, e)) continue;
      const d = Math.hypot(e.x - (t.x + .5), e.y - (t.y + .5)); if (d > range) continue;
      const v = t.mode === 'first' ? e.d : t.mode === 'last' ? -e.d : t.mode === 'strong' ? e.hp : -d;
      if (v > bv) { bv = v; best = e; }
    }
    return best;
  }
  const DT = 1 / 60;
  function step(G, dt) {
    G.acc = (G.acc || 0) + dt;
    while (G.acc >= DT) { G.acc -= DT; tick(G); if (G.over) { G.acc = 0; break; } }
  }
  function tick(G) {
    const dt = DT; G.t += dt;
    for (const k in G.spells) if (G.spells[k].cd > 0) G.spells[k].cd -= dt;
    // ウェーブ
    if (G.nextIn > 0) { G.nextIn -= dt; if (G.nextIn <= 0) startWave(G); }
    while (G.spawnQ.length && G.spawnQ[0].at <= G.t) { const s = G.spawnQ.shift(); spawn(G, s.t, s.p, 0, s.w + 1); }
    if (G.freezeT > 0) G.freezeT -= dt;
    // 吹雪のオーラ
    const auras = G.towers.filter(t => t.type === 'ice' && t.br === 'B');
    // 敵の移動
    for (const e of G.enemies) {
      if (e.hp <= 0) continue;
      const E = ENEMIES[e.type];
      if (e.flash > 0) e.flash -= dt;
      let sp = e.spd, sl = 0;
      if (e.slowT > 0) { e.slowT -= dt; sl = e.slow; }
      for (const a of auras) { const s = statsOf(a), [m] = dmgMul(G, a); if ((!E.fly || s.airAura) && Math.hypot(e.x - a.x - .5, e.y - a.y - .5) <= s.range) { sl = Math.max(sl, Math.min(.8, s.slow * (1 + (G.up.ice || 0) * .1))); hurt(G, e, s.aura * m * dt, 'magic', a); } }
      if (e.hp <= 0) continue;
      if (e.burnT > 0) { e.burnT -= dt; hurt(G, e, e.burn * dt, 'magic'); if (e.hp <= 0) continue; }
      if (E.heal) { e.healT -= dt; if (e.healT <= 0) { e.healT = 1; for (const o of G.enemies) if (o.hp > 0 && (E.boss ? o === e : Math.hypot(o.x - e.x, o.y - e.y) < 1.6)) { o.hp = Math.min(o.max, o.hp + o.max * E.heal); } G.events.push({ k: 'heal', e }); } }
      if (e.frz > 0) { e.frz -= dt; continue; }
      if (G.freezeT > 0) continue;
      e.d += sp * (1 - sl) * dt;
      const pi = G.paths[e.p];
      if (e.d >= pi.L) { e.hp = 0; e.gone = 1; const lv = E.lives || 1; G.lives -= lv; G.leaked += lv; G.events.push({ k: 'leak', e, lv }); if (G.lives <= 0) { G.lives = 0; G.over = 1; G.events.push({ k: 'lose' }); } continue; }
      const pos = posAt(pi, e.d); e.x = pos.x; e.y = pos.y; e.dir = pos.dir;
    }
    // タワー
    for (const t of G.towers) {
      const D = TOWERS[t.type], s = statsOf(t), [m, rb] = dmgMul(G, t), cx = t.x + .5, cy = t.y + .5;
      if (D.support || (t.type === 'ice' && t.br === 'B')) continue;
      if (t.type === 'laser') {
        let tg = t.beam && t.beam.hp > 0 && Math.hypot(t.beam.x - cx, t.beam.y - cy) <= s.range ? t.beam : pick(G, t, s.range);
        if (tg !== t.beam) { t.beam = tg; t.ramp = 0; }
        if (!tg) continue;
        t.ramp = Math.min(1, t.ramp + dt / 2);
        const dps = s.dps * m * (1 + s.ramp * t.ramp);
        if (s.pierce) {
          const ang = Math.atan2(tg.y - cy, tg.x - cx), len = s.range;
          for (const e of G.enemies) { if (e.hp <= 0 || !canHit(t, e)) continue; const dx = e.x - cx, dy = e.y - cy, along = dx * Math.cos(ang) + dy * Math.sin(ang), perp = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang)); if (along > 0 && along <= len && perp < .38) hurt(G, e, dps * dt, 'true', t); }
        } else hurt(G, tg, dps * dt, 'true', t);
        continue;
      }
      t.cd -= dt * rb; if (t.cd > 0) continue;
      const tg = pick(G, t, s.range); if (!tg) continue;
      t.cd = 1 / s.rate; t.face = Math.atan2(tg.y - cy, tg.x - cx);
      const dmg = s.dmg * m;
      if (t.type === 'lightning') {
        const hit = [tg]; let cur = tg, d = dmg;
        hurt(G, tg, d, 'magic', t); if (s.stun) tg.frz = Math.max(tg.frz, s.stun);
        for (let i = 1; i < s.chain; i++) {
          let nx = null, nd = 1.6; for (const e of G.enemies) { if (e.hp <= 0 || hit.includes(e) || !canHit(t, e)) continue; const q = Math.hypot(e.x - cur.x, e.y - cur.y); if (q < nd) { nd = q; nx = e; } }
          if (!nx) break; d *= .82; hit.push(nx); hurt(G, nx, d, 'magic', t); if (s.stun) nx.frz = Math.max(nx.frz, s.stun * .6); cur = nx;
        }
        G.events.push({ k: 'zap', from: { x: cx, y: cy - .2 }, pts: hit.map(e => ({ x: e.x, y: e.y })), t });
        continue;
      }
      G.shots.push({ type: t.type, x: cx, y: cy - .2, tg, dmg, s, src: t, spd: t.type === 'archer' ? (t.br === 'B' ? 18 : 11) : 7, br: t.br });
      G.events.push({ k: 'fire', t });
    }
    // 弾
    for (const b of G.shots) {
      if (b.tg.hp <= 0 && !b.lx) { b.lx = b.tg.x; b.ly = b.tg.y; }
      const tx = b.lx ?? b.tg.x, ty = b.ly ?? b.tg.y, dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy), mv = b.spd * dt;
      if (d <= mv) {
        b.done = 1;
        if (b.type === 'magic') {
          for (const e of G.enemies) if (e.hp > 0 && !ENEMIES[e.type].fly && Math.hypot(e.x - tx, e.y - ty) <= b.s.splash) { hurt(G, e, b.dmg, 'magic', b.src); if (b.s.burn) { e.burn = b.s.burn * (1 + (G.up.magic || 0) * .1); e.burnT = 3; } }
          G.events.push({ k: 'boom', x: tx, y: ty, r: b.s.splash, br: b.br });
        } else if (b.tg.hp > 0) {
          if (b.type === 'archer') hurt(G, b.tg, b.dmg, 'phys', b.src);
          if (b.type === 'ice') { hurt(G, b.tg, b.dmg, 'magic', b.src); const sl = Math.min(.8, b.s.slow * (1 + (G.up.ice || 0) * .1)); b.tg.slow = Math.max(b.tg.slowT > 0 ? b.tg.slow : 0, sl); b.tg.slowT = b.s.st; if (b.s.freeze && Math.random() < b.s.freeze) { b.tg.frz = b.s.ft; G.events.push({ k: 'frz', e: b.tg }); } }
          G.events.push({ k: 'hit', x: tx, y: ty, type: b.type });
        }
      } else { b.x += dx / d * mv; b.y += dy / d * mv; b.ang = Math.atan2(dy, dx); }
    }
    G.shots = G.shots.filter(b => !b.done);
    G.enemies = G.enemies.filter(e => e.hp > 0);
    // 勝ち
    if (!G.over && G.wave >= G.waves.length && !G.spawnQ.length && !G.enemies.length) { G.over = 1; G.won = 1; G.events.push({ k: 'win' }); }
  }
  function cast(G, k, x, y) {
    const S = SPELLS[k]; if (G.spells[k].cd > 0) return false;
    G.spells[k].cd = spellCd(G, k);
    if (k === 'meteor') { for (const e of G.enemies) if (Math.hypot(e.x - x, e.y - y) <= S.r) hurt(G, e, S.dmg * (1 + G.stage * .12), 'true'); G.events.push({ k: 'meteor', x, y, r: S.r }); }
    if (k === 'freeze') { G.freezeT = S.t; G.events.push({ k: 'timestop' }); }
    return true;
  }
  const starsOf = G => !G.won ? 0 : G.lives >= G.maxLives - 2 ? 3 : G.lives >= G.maxLives / 2 ? 2 : 1;

  root.TD = { W, H, WORLDS, MAPS, TOWERS, TORDER, ENEMIES, SPELLS, UPGRADES, newGame, step, build, upgrade, sell, callWave, cast, canBuild, statsOf, nextUp, posAt, layout, makeWaves, starsOf, refundRate, spellCd, dmgMul };
})(typeof window !== 'undefined' ? window : globalThis);
