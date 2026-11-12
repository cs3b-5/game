// ポーション探検記：素材・いきもの・場所・地図のデータ（ゲーム本体と攻略サイトで共通）
(() => {
  // ================= 素材と相手 =================
  // v = [上, 下, 左, 右, 光(倍・跳躍), 闇(反転)]　1 = マス目1つ
  const MAT = {
    berry: { nm: '赤い実', e: '🍒', v: [1, 0, 0, 0, 0, 0] },
    drop: { nm: 'しずく', e: '💧', v: [0, 1, 0, 0, 0, 0] },
    pebble: { nm: '小石', e: '🪨', v: [0, 0, 1, 0, 0, 0] },
    feather: { nm: '羽根', e: '🪶', v: [0, 0, 0, 1, 0, 0] },
    glow: { nm: 'ほたる草', e: '🌟', v: [0, 0, 0, 0, 1, 0] },
    acorn: { nm: 'どんぐり', e: '🌰', v: [1, 0, 1, 0, 0, 0] },
    mush: { nm: 'きのこ', e: '🍄', v: [0, 1, 1, 0, 0, 0] },
    honey: { nm: 'はちみつ', e: '🍯', v: [1, 0, 0, 1, 0, 0] },
    clover: { nm: 'クローバー', e: '🍀', v: [0, 1, 0, 1, 0, 0] },
    sea: { nm: '湖の水', e: '🌊', v: [0, 3, 0, 0, 0, 0] },
    shell: { nm: '貝がら', e: '🐚', v: [0, 2, 1, 0, 0, 0] },
    firestone: { nm: '火の石', e: '🔥', v: [3, 0, 0, 0, 0, 0] },
    clay: { nm: 'ねんど', e: '🧱', v: [0, 0, 3, 0, 0, 0] },
    gust: { nm: 'つむじ風', e: '🌀', v: [0, 0, 0, 3, 0, 0] },
    shadow: { nm: '影の実', e: '🫐', v: [0, 0, 0, 0, 0, 1] },
    comet: { nm: '流れ星', e: '☄️', v: [1, 0, 0, 2, 0, 0] },
  };
  const BASIC = ['berry', 'drop', 'pebble', 'feather'];
  const CRE = {
    snail: { nm: 'かたつむり', e: '🐌', d: 'じっとしている' },
    ladybug: { nm: 'てんとう虫', e: '🐞', d: 'じっとしている' },
    squirrel: { nm: 'りす', e: '🐿️', d: 'じっとしている' },
    hedgehog: { nm: 'はりねずみ', e: '🦔', d: 'じっとしている' },
    turtle: { nm: 'かめ', e: '🐢', d: 'じっとしている' },
    mouse: { nm: '岩ねずみ', e: '🐭', d: 'じっとしている' },
    owl: { nm: 'ふくろう', e: '🦉', d: 'じっとしている' },
    rabbit: { nm: 'うさぎ', e: '🐇', d: '薬を飲むたび、まっすぐ1マス走る。ぶつかると引き返す', mv: 1 },
    frog: { nm: 'カエル', e: '🐸', d: '薬を飲むたび、まっすぐ2マス跳ぶ。跳べないと引き返す', mv: 1 },
    penguin: { nm: 'ペンギン', e: '🐧', d: '薬を飲むたび、ななめに1マスすべる。ぶつかると引き返す', mv: 1 },
    fairy: { nm: '妖精', e: '🧚', d: '右→下→左→上…とくるくる回る（逆回りの子もいる）', mv: 1 },
  };
  const ZONES = {
    inner: { nm: 'はじまりの野', mats: ['glow'], cre: { snail: 3, ladybug: 3 }, spots: 3 },
    north: { nm: '北の森', mats: ['acorn', 'honey', 'mush', 'glow'], cre: { rabbit: 5, squirrel: 2, hedgehog: 1 }, spots: 7 },
    east: { nm: '東の湖沼', mats: ['sea', 'clover', 'shell', 'glow'], cre: { frog: 5, turtle: 2 }, spots: 6 },
    west: { nm: '西の岩山', mats: ['firestone', 'clay', 'gust', 'glow'], cre: { penguin: 4, mouse: 2 }, spots: 6 },
    ruins: { nm: '古の遺跡', mats: ['shadow', 'comet', 'glow'], cre: { fairy: 3, owl: 2 }, spots: 4 },
  };
  const MARKS = [
    { id: 'home', x: 32, y: 50, nm: 'アトリエ', e: '🏠', camp: 1, txt: 'エルマ師匠と暮らしたアトリエ。<br>⛺で休むと、ここや見つけた野営地で朝をむかえて、基本の素材（🍒💧🪨🪶）が6つずつにもどる。' },
    { id: 'well', x: 24, y: 45, nm: '古い井戸', e: '🪣', txt: '古い井戸のふちに、師匠の字のメモがはさまっていた。<br>「川は歩いては渡れない。星のように光る草をお探し。あれは旅人を<b>空へ</b>持ち上げる」' },
    { id: 'circle', x: 41, y: 44, nm: '石の環', e: '🗿', txt: '苔むした石の環。まんなかに師匠の足あと。<br>「素材は、入れる<b>順番</b>で道が変わる。急がば回れ、だよ」' },
    { id: 'hunter', x: 30, y: 29, nm: '狩人の小屋', e: '🛖', camp: 1, txt: '誰もいない狩人の小屋（野営地）。壁に師匠の落書き。<br>「うさぎは まっすぐ走って、ぶつかると引き返す。<b>降りたとき同じ場所</b>にいれば捕まえられる。——E」' },
    { id: 'oak', x: 23, y: 20, nm: '大樫の木', e: '🌳', txt: '大樫の根元に、師匠のハンカチが結ばれていた。<br>「森は木と木のすきまが狭い。まっすぐだけが道じゃない」' },
    { id: 'shrine', x: 52, y: 44, nm: '湖の祠', e: '⛩️', camp: 1, txt: '湖のほとりの祠（野営地）。お供えの横に手紙。<br>「カエルはひとつ飛ばしで跳ぶ。それと、湖の水は<b>重たい</b>よ。——E」' },
    { id: 'bell', x: 57, y: 21, nm: '沈んだ鐘', e: '🔔', txt: '湖に沈んだ鐘。内側に師匠が刻んだ文字。<br>「遺跡の壁は厚い。ふつうに跳ぶだけでは届かない。力を<b>重ねる</b>こと」' },
    { id: 'mtcamp', x: 11, y: 37, nm: '山の野営地', e: '🔥', camp: 1, txt: '岩山のふもとの野営地。たき火のあとに、焦げずに残った手紙。<br>「ペンギンはななめにすべる。山の素材は、どれも<b>力が強い</b>。——E」' },
    { id: 'bones', x: 8, y: 15, nm: '竜の骨', e: '🦴', txt: '巨大な竜の骨。骨のすきまに、師匠のとんがり帽子が引っかかっていた。<br>師匠もここを通ったんだ。北の遺跡はもうすぐだ。' },
    { id: 'gate', x: 32, y: 16, nm: '崩れた門', e: '🏛️', camp: 1, txt: '遺跡の崩れた門（野営地）。柱に師匠の最後の手紙。<br>「影は物ごとを<b>裏返す</b>。壁の向こうで待っているよ」' },
    { id: 'stone', x: 32, y: 6, nm: '賢者の石', e: '💎', goal: 1, hd: 'エピローグ', txt: '城壁の奥、光る石のそばで、エルマ師匠が昼寝をしていた。<br>「おや、来たのかい。よくここまで来たね」<br>師匠は笑って、あなたのメモ帳を指さした。<br>「賢者の石なんてね、ほんとうはただの光る石さ。<b>ほんとうの宝は、旅で書きためたそのメモ帳</b>だよ」<br>二人は並んで、アトリエへの帰り道を歩きはじめた。' },
  ];

  // ================= 地図を作る（毎回同じ） =================
  const N = 64;     // マス目の数（ゲームでは見えない）
  const HOME = { x: 32, y: 50 };
  function rngOf(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  function vnoise(x, y, sc, s) {
    const fx = x / sc, fy = y / sc, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    const sm = t => t * t * (3 - 2 * t), a = hash(x0, y0, s), b = hash(x0 + 1, y0, s), c = hash(x0, y0 + 1, s), d = hash(x0 + 1, y0 + 1, s);
    return (a + (b - a) * sm(tx)) * (1 - sm(ty)) + (c + (d - c) * sm(tx)) * sm(ty);
  }
  const ringD = (x, y) => Math.hypot((x - HOME.x) / 13.5, (y - HOME.y) / 11.5);
  function zoneOf(x, y) {
    if (ringD(x, y) < 1) return 'inner';
    if (y < 17 && x > 17 && x < 47) return 'ruins';
    if (x < 19) return 'west';
    if (x > 45) return 'east';
    return 'north';
  }
  // 地形：0 野原 1 水 2 森 3 岩 4 城壁
  const T = Array.from({ length: N }, () => new Uint8Array(N));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let t = 0;
    const d = ringD(x, y), z = zoneOf(x, y), n1 = vnoise(x, y, 4, 1) * .6 + vnoise(x, y, 2, 2) * .4;
    if (x < 1 || y < 1 || x > N - 2 || y > N - 2) t = 3;
    else if (Math.abs(d - 1.06 - (vnoise(x, y, 5, 9) - .5) * .06) < .075) t = 1;
    else if (z === 'inner') t = n1 > .76 && d < .8 ? 2 : 0;
    else if (z === 'north') t = n1 > .6 ? 2 : 0;
    else if (z === 'east') t = (n1 > .64 || Math.hypot(x - 54, y - 30) < 4.6 + vnoise(x, y, 3, 4) * 1.5) ? 1 : 0;
    else if (z === 'west') t = n1 > .62 ? 3 : 0;
    else if (z === 'ruins') {
      const inR = x >= 26 && x <= 38 && y >= 1 && y <= 11, inI = x >= 28 && x <= 36 && y >= 3 && y <= 9;
      t = inR && !inI ? 4 : (!inR && n1 > .7 ? 4 : 0);
    }
    T[y][x] = t;
  }
  const clearAt = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x > 0 && y > 0 && x < N - 1 && y < N - 1 && T[y][x] !== 4) T[y][x] = 0; };
  for (const m of MARKS) clearAt(m.x, m.y, m.id === 'stone' ? 0 : 1);
  const free = (x, y) => x >= 0 && y >= 0 && x < N && y < N && T[y][x] === 0;
  // 素材の群生地と相手
  const SPOTS = [], CRES = [];
  {
    const rnd = rngOf(20261112), taken = new Set(MARKS.map(m => m.x + ',' + m.y));
    const cellIn = zone => { for (let i = 0; i < 4000; i++) { const x = 2 + Math.floor(rnd() * (N - 4)), y = 2 + Math.floor(rnd() * (N - 4)); if (zoneOf(x, y) !== zone || !free(x, y) || taken.has(x + ',' + y)) continue; if (Math.hypot(x - HOME.x, y - HOME.y) < 3) continue; taken.add(x + ',' + y); return { x, y }; } return null; };
    for (const z in ZONES) {
      const Z = ZONES[z];
      for (let i = 0; i < Z.spots; i++) { const p = cellIn(z); if (p) SPOTS.push({ id: 's' + SPOTS.length, ...p, m: Z.mats[i % Z.mats.length], zone: z }); }
      for (const t in Z.cre) for (let i = 0; i < Z.cre[t]; i++) {
        const p = cellIn(z); if (!p) continue;
        const c = { id: 'c' + CRES.length, type: t, ...p, zone: z, drop: Z.mats[Math.floor(rnd() * Z.mats.length)] };
        if (t === 'fairy') { c.ix = Math.floor(rnd() * 4); c.cw = rnd() < .5 ? 1 : -1; }
        else if (t === 'penguin') { c.dx = rnd() < .5 ? 1 : -1; c.dy = rnd() < .5 ? 1 : -1; }
        else if (CRE[t].mv) { const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)]; c.dx = d[0]; c.dy = d[1]; }
        CRES.push(c);
      }
    }
  }
  const FD = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  function stepCre(c) {
    if (!CRE[c.type].mv) return;
    if (c.type === 'fairy') { const d = FD[c.ix]; if (free(c.x + d[0], c.y + d[1])) { c.x += d[0]; c.y += d[1]; } c.ix = (c.ix + c.cw + 4) % 4; return; }
    const k = c.type === 'frog' ? 2 : 1;
    if (free(c.x + c.dx * k, c.y + c.dy * k)) { c.x += c.dx * k; c.y += c.dy * k; return; }
    c.dx = -c.dx; c.dy = -c.dy;
    if (free(c.x + c.dx * k, c.y + c.dy * k)) { c.x += c.dx * k; c.y += c.dy * k; }
  }

  window.PW = { MAT, BASIC, CRE, ZONES, MARKS, N, HOME, rngOf, hash, vnoise, ringD, zoneOf, T, free, SPOTS, CRES, stepCre };
})();
