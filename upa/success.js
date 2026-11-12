// うぱるぱスピリッツ：サクセス（ウパ高校で3年間すごして、選手を作る）
// 1ターン＝1週。全30ターン。夏の大会が3回（10・20・30ターン目）
import * as E from './engine.js';

const TURNS = 30, TOURNEY = { 10: 0, 20: 1, 30: 2 };
const MOOD = ['絶不調', '不調', '普通', '好調', '絶好調'], MOODK = [0.75, 0.88, 1, 1.12, 1.25], MOODC = ['#7a8aff', '#5ad0ff', '#c0c4d8', '#ffb020', '#ff5aa0'];
const PT = { str: '筋力', agi: '敏捷', tec: '技術', brk: '変化球', men: '精神' }, PTC = { str: '#ff6a5a', agi: '#5ad06a', tec: '#5aa8ff', brk: '#c07aff', men: '#ffc23a' };
// 練習：取れる経験点・体力
const PRAC = {
  bat: [
    { id: 'hit', n: '打撃', g: { tec: 16, str: 6 }, hp: 14 }, { id: 'pow', n: '筋力', g: { str: 18, tec: 3 }, hp: 18 },
    { id: 'run', n: '走塁', g: { agi: 16, men: 4 }, hp: 15 }, { id: 'def', n: '守備', g: { agi: 9, tec: 9 }, hp: 13 }, { id: 'men', n: '精神', g: { men: 14, tec: 3 }, hp: 6 },
  ],
  pit: [
    { id: 'spd', n: '球速', g: { str: 17, agi: 3 }, hp: 18 }, { id: 'ctl', n: 'コントロール', g: { tec: 16, men: 3 }, hp: 12 },
    { id: 'sta', n: '走りこみ', g: { agi: 16, str: 4 }, hp: 17 }, { id: 'brk', n: '変化球', g: { brk: 17, tec: 4 }, hp: 13 }, { id: 'men', n: '精神', g: { men: 14, brk: 3 }, hp: 6 },
  ],
};
// 仲間（いっしょに練習すると経験点が増える。友情がたまると特別なイベント）
const MATES = [
  { id: 'rupa', n: 'ルパ田', skin: 'pink', likes: ['hit', 'run', 'ctl'], gift: 'avg', line: 'いっしょにウパ子園、行こうぜ！' },
  { id: 'nuru', n: 'ぬる川', skin: 'wild', likes: ['pow', 'spd', 'hit'], gift: 'power', line: 'パワーこそ正義だウパ！' },
  { id: 'fuku', n: 'ぷく井', skin: 'albino', likes: ['def', 'run', 'sta'], gift: 'laser', line: '守備は足から、だよ。' },
  { id: 'mizu', n: 'マネージャーみずほ', skin: 'gold', likes: ['men', 'brk', 'def'], gift: 'chance', line: 'がんばって！ わたし、応援してるから。' },
];
// 能力：上げるのに使う経験点
const STATS = {
  bat: [
    { k: 'con', n: 'ミート', c: { tec: 1, str: .3 } }, { k: 'pow', n: 'パワー', c: { str: 1, tec: .3 } }, { k: 'spd', n: '走力', c: { agi: 1, str: .2 } },
    { k: 'arm', n: '肩力', c: { str: .8, agi: .3 } }, { k: 'def', n: '守備力', c: { agi: .6, tec: .6 } }, { k: 'cat', n: '捕球', c: { tec: .7, men: .3 } },
  ],
  pit: [
    { k: 'kmh', n: '球速', c: { str: 1.4, agi: .3 }, max: 165, min: 115 }, { k: 'ctl', n: 'コントロール', c: { tec: 1, men: .3 } }, { k: 'sta', n: 'スタミナ', c: { agi: 1, str: .3 } },
  ],
};
const stepCost = v => Math.ceil(2 + Math.max(0, v - 20) / 11);       // 1上げるのにかかる経験点
const trajCost = t => 40 + t * 25;
const ablCost = k => (E.ABIL[k].g > 1 ? 70 : 34);
const BREAKS = ['sl', 'cu', 'fk', 'sh', 'ch', 'ct', 'sk'];

const rnd = () => Math.random();
const pick = a => a[Math.floor(rnd() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initSuccess({ $, SV, save, show, faceURL, onSaved }) {
  const root = $('succBox');
  let R = SV.succ || null; // 進行中のサクセス

  // ---------- はじめる ----------
  function newRun(type, name, skin, left) {
    const bat = type === 'bat';
    R = {
      v: 1, type, name: name || 'ウパ太', skin, left: !!left, pos: bat ? '中' : '投', turn: 1, hp: 100, mood: 2,
      pts: { str: 30, agi: 30, tec: 30, brk: bat ? 0 : 30, men: 20 }, friend: {}, hint: {}, hurt: 0, log: [], res: [],
      st: bat ? { con: 32, pow: 30, spd: 40, arm: 38, def: 35, cat: 35, traj: 1 } : { kmh: 128, ctl: 30, sta: 30 },
      ars: bat ? null : { st: 1, [pick(['sl', 'cu'])]: 1 },
      abl: [rnd() < .5 ? (bat ? 'kX' : 'pinchX') : (bat ? 'chanceX' : null)].filter(Boolean),
      mates: [], ev: null,
    };
    R.log.push(`ウパ高校野球部に入部した！ ${bat ? '野手' : '投手'}として、3年間でウパ子園をめざそう。`);
    rollMates(); keep(); render();
  }
  const keep = () => { SV.succ = R; save(); };
  const prac = () => PRAC[R.type];
  function rollMates() { // 練習ごとに、来ている仲間をきめる
    R.mates = prac().map(() => []);
    for (const m of MATES) { if (rnd() < .55) { const ps = prac(), i = Math.floor(rnd() * ps.length); R.mates[i].push(m.id); } }
  }
  const date = t => { const y = Math.ceil(t / 10), w = (t - 1) % 10; return `${y}年目 ${['4', '4', '5', '5', '6', '6', '7', '7', '8', '8'][w]}月 ${w % 2 + 1}週`; };

  // ---------- 1ターンの行動 ----------
  function doPrac(i) {
    if (R.ev) return;
    const P = prac()[i], ms = R.mates[i] || [];
    // ケガ：体力が少ないと起きやすい
    const fail = R.hp < 40 ? (40 - R.hp) / 100 + .05 : 0;
    if (rnd() < fail) {
      R.hurt = 2; R.hp = Math.max(0, R.hp - 10); R.mood = Math.max(0, R.mood - 1);
      const lose = Object.keys(R.pts); for (const k of lose) R.pts[k] = Math.max(0, R.pts[k] - 8);
      say(`💥 練習中にケガをしてしまった…！ 2週間は練習できない。（経験点 −8）`); return endTurn();
    }
    const k = MOODK[R.mood] * (1 + ms.length * .5);
    const got = {};
    for (const [t, v] of Object.entries(P.g)) { const g = Math.round(v * k * (.9 + rnd() * .25)); R.pts[t] += g; got[t] = g; }
    R.hp = Math.max(0, R.hp - P.hp);
    for (const id of ms) R.friend[id] = (R.friend[id] || 0) + 1;
    say(`${P.n}の練習をした。${ms.length ? `（${ms.map(id => MATES.find(m => m.id === id).n).join('・')}といっしょ！）` : ''} ${fmtPts(got)}`);
    endTurn(P.id);
  }
  function doRest() { if (R.ev) return; if (R.hurt) { R.hp = Math.min(100, R.hp + 30); say('ケガの治療に専念した。'); return endTurn(); } R.hp = Math.min(100, R.hp + 45 + Math.round(rnd() * 10)); say('しっかり休んだ。体力が回復した。'); endTurn(); }
  function doPlay() {
    if (R.ev) return; R.hp = Math.min(100, R.hp + 18); R.mood = Math.min(4, R.mood + 1);
    say(pick(['仲間と水族館に行った。やる気が上がった！', 'ゲームセンターでパワ…じゃなくてウパパワを発揮した。やる気が上がった！', 'お祭りで金魚すくい…いや、仲間すくいをした。やる気が上がった！']));
    endTurn();
  }
  function endTurn(pid) {
    const t = R.turn;
    // 大会
    if (TOURNEY[t] !== undefined) { runTourney(TOURNEY[t]); if (R.done) return; }
    // 友情イベント
    for (const m of MATES) if ((R.friend[m.id] || 0) >= 5 && !R.hint['f_' + m.id] && !R.ev) {
      R.hint['f_' + m.id] = 1; const ok = E.ABIL[m.gift].t === (R.type === 'bat' ? 'b' : 'p');
      const gift = ok ? m.gift : (R.type === 'bat' ? 'neba' : 'kire');
      R.hint[gift] = 1; for (const k of Object.keys(R.pts)) R.pts[k] += 12;
      R.ev = { who: m, text: `${m.line}\n${R.name}、おまえとならやれる気がする。とっておきを教えるよ！`, after: `🤝 ${m.n}との友情が深まった！「${E.ABIL[gift].n}」のコツをつかんだ！（経験点 +12）` };
    }
    // ランダムイベント
    if (!R.ev && rnd() < .38) startEvent(pid);
    R.turn++; R.hurt = Math.max(0, R.hurt - (R.hurt ? 1 : 0));
    if (R.mood > 2 && rnd() < .12) { R.mood--; say('なんだか気がゆるんできた…（やる気↓）'); }
    if (R.turn > TURNS && !R.ev) return finish();
    rollMates(); keep(); render();
  }
  function say(t) { R.log.push(t); if (R.log.length > 40) R.log.shift(); }
  const fmtPts = g => Object.entries(g).map(([k, v]) => `<b style="color:${PTC[k]}">${PT[k]}+${v}</b>`).join(' ');

  // ---------- イベント ----------
  const EVENTS = [
    { who: '監督', w: () => 1, text: 'おい、今日は特別メニューだ。ついてこれるか？', ch: [['やります！', () => { R.pts.tec += 22; R.pts.str += 10; R.hp -= 15; return '特訓をやりきった！ 技術+22 筋力+10（体力−15）'; }], ['今日はちょっと…', () => { R.mood = Math.max(0, R.mood - 1); return '監督ににらまれた…（やる気↓）'; }]] },
    { who: 'みずほ', w: () => 1, text: 'おつかれさま！ はちみつレモン、作ってきたの。', ch: [['ありがとう！', () => { R.hp += 15; R.mood = Math.min(4, R.mood + 1); R.friend.mizu = (R.friend.mizu || 0) + 1; return '元気が出た！ 体力+15、やる気↑'; }]] },
    { who: 'ライバル・ネオ', w: () => 1, text: 'おまえがウパ高の新星か。夏の大会で、ひねりつぶしてやるウパ。', ch: [['ぜったい負けない！', () => { R.pts.str += 18; return '燃えてきた！ 筋力+18'; }], ['……（相手にしない）', () => { R.pts.men += 18; return '冷静さを保った。精神+18'; }]] },
    { who: '先輩', w: () => 1, text: 'いいフォームだ。ひとつコツを教えてやろう。', ch: [['お願いします！', () => { const k = hintAbl(false); R.hint[k] = 1; return `「${E.ABIL[k].n}」のコツをつかんだ！（覚えるのに必要な経験点が半分に）`; }]] },
    { who: '担任', w: () => R.turn % 10 > 3 ? 1 : 0, text: 'テストが近いぞ。赤点だと練習に出られないからな。', ch: [['勉強する', () => { R.pts.men += 15; R.mood = Math.max(0, R.mood - 1); return '勉強をがんばった。精神+15（やる気↓）'; }], ['練習する！', () => { if (rnd() < .5) { R.pts.str += 10; R.pts.tec += 10; return 'テストはギリギリセーフ！ 筋力+10 技術+10'; } R.hurt = 1; return '赤点で補習になった…（1週間練習できない）'; }]] },
    { who: '水槽', w: () => 1, text: '部室の水槽そうじ当番がまわってきた。', ch: [['ていねいにやる', () => { R.pts.men += 20; R.hp -= 8; return '水がピカピカになった。精神+20（体力−8）'; }], ['手早くすませる', () => { R.pts.agi += 12; return '手際のよさが身についた。敏捷+12'; }]] },
    { who: 'ルパ田', w: () => 1, text: 'なあ、夜の自主練、つきあってくれよ！', ch: [['よし、やろう！', () => { R.pts.tec += 12; R.pts.agi += 12; R.hp -= 14; R.friend.rupa = (R.friend.rupa || 0) + 1; return '夜おそくまで練習した。技術+12 敏捷+12（体力−14）'; }], ['今日は休もう', () => { R.hp += 10; return 'しっかり寝た。体力+10'; }]] },
    { who: '？？？', w: () => 1, text: '外エラが、ふしぎに光った……！？', ch: [['なんだこれ！？', () => { const k = hintAbl(true); R.hint[k] = 1; R.pts.men += 10; return `体の奥から力がわいてくる！ 「${E.ABIL[k].n}」のコツ！ 精神+10`; }]] },
    { who: 'ファン', w: () => R.turn > 10 ? 1 : 0, text: '大会、見てました！ サインください！', ch: [['よろこんで！', () => { R.mood = Math.min(4, R.mood + 1); R.pts.men += 10; return 'うれしくてやる気が上がった！ 精神+10'; }]] },
    { who: 'ぬる川', w: () => 1, text: 'うおおお、タイヤ引き100本だウパ！ いっしょにやるか？', ch: [['やる！', () => { R.pts.str += 20; R.hp -= 18; R.friend.nuru = (R.friend.nuru || 0) + 1; return 'ヘトヘトだけど力がついた。筋力+20（体力−18）'; }], ['見てるだけにする', () => { R.pts.men += 6; return 'ぬる川のがんばりに感心した。精神+6'; }]] },
    { who: '監督', w: () => R.type === 'pit' ? 1 : 0, text: '新しい変化球、ためしてみるか？', ch: [['覚えたい！', () => { R.pts.brk += 26; return '握りを教わった。変化球+26'; }], ['ストレートをみがく', () => { R.pts.str += 18; return 'ストレートに自信がついた。筋力+18'; }]] },
    { who: 'スランプ', w: () => R.mood >= 3 ? 1 : 0, text: '最近、なにをやってもうまくいかない…', ch: [['気分転換する', () => { R.hp += 10; return '少し気が楽になった。体力+10'; }], ['練習量でカバー！', () => { R.pts.tec += 10; R.mood = Math.max(0, R.mood - 1); R.hp -= 10; return 'がむしゃらに練習した。技術+10（やる気↓ 体力−10）'; }]] },
  ];
  function hintAbl(gold) {
    const t = R.type === 'bat' ? 'b' : 'p';
    const c = Object.keys(E.ABIL).filter(k => E.ABIL[k].t === t && E.ABIL[k].g > 0 && (gold ? E.ABIL[k].g > 1 : true) && !R.abl.includes(k));
    return c.length ? pick(c) : (t === 'b' ? 'neba' : 'kire');
  }
  function startEvent() {
    const ok = EVENTS.filter(e => e.w() > 0);
    const e = pick(ok); R.ev = { who: { n: e.who }, text: e.text, ch: e.ch.map(c => c[0]), idx: EVENTS.indexOf(e) };
  }
  function choose(i) {
    if (!R.ev) return;
    if (R.ev.tour) R.ev = null;
    else if (R.ev.after) { say(R.ev.after); R.ev = null; }
    else { const e = EVENTS[R.ev.idx], r = e.ch[i] ? e.ch[i][1]() : ''; R.hp = clamp(R.hp, 0, 100); say(`【${R.ev.who.n}】${r}`); R.ev = null; }
    if (R.turn > TURNS) return finish();
    keep(); render();
  }

  // ---------- 大会（自分の打席・登板は、試合のルールでそのまま計算） ----------
  function runTourney(no) {
    const names = ['1年目 夏の大会', '2年目 夏の大会', '3年目 夏のウパ子園予選'];
    const me = asPlayer(), rng = E.rngOf((Math.random() * 2 ** 31) | 0);
    const ROUNDS = ['1回戦', '2回戦', '準々決勝', '準決勝', '決勝'];
    const teamPow = 42 + no * 7 + overall(me) / 5;
    const lines = []; let alive = true, gain = 0, best = 0;
    for (let r = 0; r < ROUNDS.length && alive; r++) {
      const opp = 38 + r * 7 + no * 6 + rnd() * 8;
      const g = R.type === 'bat' ? simBat(me, opp, rng) : simPit(me, opp, rng);
      const diff = teamPow - opp + g.plus * 6 + (rnd() - .5) * 26;
      const win = diff > 0;
      lines.push(`${ROUNDS[r]}：${win ? '○' : '●'} ${g.txt}`);
      gain += 14 + g.plus * 8 + (win ? 10 : 0); best = r + (win ? 1 : 0);
      if (!win) alive = false;
    }
    const champ = alive;
    for (const k of Object.keys(R.pts)) R.pts[k] += Math.round(gain / 5) + (champ ? 20 : 0);
    R.res.push({ no, best, champ });
    let head = `🏟 ${names[no]}：${champ ? (no === 2 ? 'ウパ子園出場決定！ 優勝！！' : '優勝！') : ROUNDS[best] + 'で敗退'}`;
    if (champ) { R.mood = Math.min(4, R.mood + 1); if (no === 2) { const k = hintAbl(true); R.hint[k] = 1; head += ` 「${E.ABIL[k].n}」のコツ！`; } }
    say(`${head}<br><small>${lines.join('<br>')}</small><br>経験点 各+${Math.round(gain / 5) + (champ ? 20 : 0)}`);
    R.ev = { who: { n: '大会' }, text: `${head}\n\n${lines.join('\n')}`, after: null, tour: true };
  }
  function simBat(me, oppPow, rng) {
    const opp = { name: '相手投手', kmh: 125 + oppPow * .35, ctl: 30 + oppPow * .6, sta: 60, ars: { st: 1, sl: 2 + Math.round(oppPow / 30), fk: 1 + Math.round(oppPow / 35) }, skin: 'wild', left: rnd() < .3, abl: [] };
    const fld = E.defsOf(E.TEAMS[1]);
    let ab = 0, h = 0, hr = 0;
    for (let pa = 0; pa < 4; pa++) {
      let S = E.newGame('upa', 'mex', 9); S.bases = rnd() < .35 ? [null, 0, null] : [null, null, null];
      while (true) {
        const c = E.cpuPitch(opp, S, rng), p = E.makePitch(opp, c.type, c.tx, c.ty, rng, 1, S, me);
        const r = E.resolveSwing(p, me, E.cpuSwing(p, me, S, rng, 1), rng, S);
        let ev = r; if (r.kind === 'inplay') { const ball = E.flight(r.v, r.la, r.sp); ev = { kind: 'inplay', ...E.judge(ball, E.FIELDERS, fld, me, S, rng) }; }
        S = E.applyEvent(S, ev);
        if (S.last.pa) { const k = S.last.kind; if (k !== 'ball') ab++; if (['1B', '2B', '3B', 'HR'].includes(k)) h++; if (k === 'HR') hr++; break; }
      }
    }
    return { txt: `${ab}打数${h}安打${hr ? ` ${hr}本塁打` : ''}`, plus: h + hr - 1.2 };
  }
  function simPit(me, oppPow, rng) {
    const bt = E.TEAMS[(Math.random() * 4) | 0]; let S = E.newGame(bt.id, 'upa', 9); S.top = true;
    const fld = E.defsOf(E.TEAMS[0]); let outs = 0, runs = 0, k = 0, pc = 0;
    const scale = .7 + oppPow / 160;
    while (outs < 18 && pc < 140) {
      const { idx } = E.curBatter(S), b0 = E.batterOf(bt, idx), bat = { ...b0, con: b0.con * scale, pow: b0.pow * scale };
      const pit = { ...me, kmh: me.kmh - Math.max(0, pc - E.pitchLimit(me.sta)) / 6, ctl: me.ctl - Math.max(0, pc - E.pitchLimit(me.sta)) / 3 };
      const c = E.cpuPitch(pit, S, rng), p = E.makePitch(pit, c.type, c.tx, c.ty, rng, 1, S, bat);
      const r = E.resolveSwing(p, bat, E.cpuSwing(p, bat, S, rng, 1), rng, S);
      let ev = r; if (r.kind === 'inplay') { const ball = E.flight(r.v, r.la, r.sp); ev = { kind: 'inplay', ...E.judge(ball, E.FIELDERS, fld, bat, S, rng) }; }
      const o0 = S.outs; S = E.applyEvent(S, ev); pc++;
      if (S.last.change) outs += 3 - o0; else outs += S.outs - o0;
      runs += S.last.runs; if (/三振/.test(S.last.msg)) k++;
      S.top = true; S.inn = 1; S.over = false;
    }
    const ip = Math.floor(outs / 3);
    return { txt: `${ip}回 ${k}奪三振 ${runs}失点`, plus: (ip - 5) * .4 + (2.2 - runs) * .7 + k * .08 };
  }

  // ---------- 能力アップ ----------
  function canPay(c) { return Object.entries(c).every(([k, v]) => R.pts[k] >= v); }
  function pay(c) { for (const [k, v] of Object.entries(c)) R.pts[k] -= v; }
  const costOf = (s, v, n = 1) => { const o = {}; let tot = 0; for (let i = 0; i < n; i++) tot += stepCost(v + i); for (const [k, w] of Object.entries(s.c)) o[k] = Math.max(1, Math.round(tot * w)); return o; };
  function up(k, n) {
    const s = STATS[R.type].find(x => x.k === k), max = s.max || 100, v = R.st[k], cur = k === 'kmh' ? (v - 100) : v;
    n = Math.min(n, max - v); if (n <= 0) return;
    const c = costOf(s, cur, n); if (!canPay(c)) return; pay(c); R.st[k] += n; keep(); render();
  }
  function upTraj() { const c = { str: trajCost(R.st.traj) }; if (R.st.traj >= 4 || !canPay(c)) return; pay(c); R.st.traj++; keep(); render(); }
  function upBreak(k) {
    const lv = R.ars[k] || 0, c = { brk: 25 + lv * 18 }; if (lv >= 7 || !canPay(c)) return;
    if (!lv && Object.keys(R.ars).length >= 5) return;
    pay(c); R.ars[k] = lv + 1; keep(); render();
  }
  function buyAbl(k) {
    const has = R.abl.includes(k), a = E.ABIL[k];
    if (a.g < 0) { if (!has) return; const c = { men: 24 }; if (!canPay(c)) return; pay(c); R.abl = R.abl.filter(x => x !== k); keep(); render(); return; }
    if (has || R.abl.length >= 6) return;
    let c = ablCost(k); if (R.hint[k]) c = Math.round(c / 2);
    const cc = { men: c, [R.type === 'bat' ? 'tec' : 'brk']: Math.round(c / 3) };
    if (!canPay(cc)) return; pay(cc); R.abl.push(k); keep(); render();
  }

  // ---------- 選手のかたち ----------
  function asPlayer(src = R) {
    if (src.type === 'bat') return { name: src.name, pos: src.pos, con: src.st.con, pow: src.st.pow, spd: src.st.spd, def: src.st.def, skin: src.skin, left: src.left, arm: src.st.arm, cat: src.st.cat, traj: src.st.traj, abl: src.abl.slice() };
    return { name: src.name, kmh: src.st.kmh, ctl: src.st.ctl, sta: src.st.sta, ars: { ...src.ars }, skin: src.skin, left: src.left, abl: src.abl.slice() };
  }
  function overall(p) {
    if (R.type === 'bat') return (p.con * 1.2 + p.pow * 1.2 + p.spd + p.arm * .6 + p.def * .8 + p.cat * .5) / 5.3 + p.traj * 2 + p.abl.reduce((a, k) => a + E.ABIL[k].g * 4, 0);
    return ((p.kmh - 110) * 1.3 + p.ctl * 1.1 + p.sta * .7 + Object.values(p.ars).reduce((a, v) => a + v * 4, -4)) / 3.1 + p.abl.reduce((a, k) => a + E.ABIL[k].g * 4, 0);
  }
  const rankOf = v => 'GFEDCBAS'[clamp(Math.floor(v / 13), 0, 7)] + (v >= 104 ? '+' : '');

  function finish() {
    const p = asPlayer(), ov = overall(p);
    const rec = { id: 'p' + Date.now().toString(36), type: R.type, rank: rankOf(ov), score: Math.round(ov), date: new Date().toISOString().slice(0, 10), champ: (R.res.find(r => r.no === 2) || {}).champ || false, ...p };
    SV.myPlayers = SV.myPlayers || []; SV.myPlayers.unshift(rec); if (SV.myPlayers.length > 30) SV.myPlayers.length = 30;
    SV.succ = null; R = null; save();
    onSaved && onSaved(rec);
    renderEnd(rec);
  }

  // ---------- 画面 ----------
  function render() {
    if (!R) return renderStart();
    const bat = R.type === 'bat', ps = prac(), turnLeft = TURNS - R.turn + 1;
    const nextT = Object.keys(TOURNEY).map(Number).find(t => t >= R.turn);
    let h = `<div class="sc-top"><div><b>${date(R.turn)}</b><small>のこり${turnLeft}週${nextT ? `・大会まで${nextT - R.turn + 1}週` : ''}</small></div>
      <div class="sc-hp"><span>体力</span><i><b style="width:${R.hp}%;background:${R.hp > 60 ? '#3ad06a' : R.hp > 30 ? '#ffd23a' : '#ff4a4a'}"></b></i><em>${R.hp}</em></div>
      <div class="sc-mood" style="color:${MOODC[R.mood]}">やる気 <b>${MOOD[R.mood]}</b></div></div>`;
    h += `<div class="sc-pts">${Object.keys(PT).filter(k => bat ? k !== 'brk' : true).map(k => `<span style="--c:${PTC[k]}">${PT[k]}<b>${R.pts[k]}</b></span>`).join('')}</div>`;
    h += `<div class="sc-me"><img src="${faceURL(R.skin)}" alt=""><div><b>${esc(R.name)}</b> <small>${bat ? '野手' : '投手'}${R.left ? '・左' : ''}</small><div class="sc-st">${statLine()}</div></div><button class="btn ghost sc-upbtn" id="scUp">能力アップ</button></div>`;
    if (R.ev) {
      const ev = R.ev;
      h += `<div class="sc-ev"><div class="sc-who">${esc(ev.who.n)}</div><p>${esc(ev.text).replace(/\n/g, '<br>')}</p><div class="sc-ch">${(ev.ch || ['つぎへ']).map((c, i) => `<button class="btn ${i ? 'ghost' : 'gold'}" data-ch="${i}">${esc(c)}</button>`).join('')}</div></div>`;
    } else if (R.hurt) {
      h += `<div class="sc-ev"><div class="sc-who">ケガ</div><p>まだケガが治っていない。今週は休むしかない…</p><div class="sc-ch"><button class="btn gold" id="scRest2">休む</button></div></div>`;
    } else {
      h += `<div class="sc-prac">${ps.map((P, i) => `<button class="sc-pb" data-p="${i}"><b>${P.n}</b><small>${Object.entries(P.g).map(([k, v]) => `<i style="color:${PTC[k]}">${PT[k]}</i>`).join('')}</small><span class="sc-mates">${(R.mates[i] || []).map(id => { const m = MATES.find(x => x.id === id); return `<img src="${faceURL(m.skin)}" title="${m.n}" alt="${m.n}">`; }).join('')}</span><em>体力−${P.hp}</em></button>`).join('')}
        <button class="sc-pb rest" id="scRest"><b>休む</b><small>体力を回復</small></button><button class="sc-pb play" id="scPlay"><b>遊ぶ</b><small>やる気アップ</small></button></div>`;
      if (R.hp < 40) h += `<p class="note" style="color:#ff8a8a">⚠ 体力が少ないと、練習でケガをしやすい</p>`;
    }
    h += `<div class="sc-log">${R.log.slice(-5).reverse().map((t, i) => `<p style="opacity:${1 - i * .16}">${t}</p>`).join('')}</div>
      <div class="row"><button class="btn ghost" id="scQuit">中断してもどる</button></div>`;
    root.innerHTML = h; bind();
  }
  function statLine(p = R) {
    const s = p.st || p, bat = (p.type || R.type) === 'bat';
    const G = (l, v) => { const g = E.grade(v); return `<span>${l}<b class="g-${g}">${g}${v}</b></span>`; };
    if (bat) return `<span class="traj">弾道<b>${s.traj}</b></span>${G('ミート', s.con)}${G('パワー', s.pow)}${G('走力', s.spd)}${G('肩力', s.arm)}${G('守備', s.def)}${G('捕球', s.cat)}${ablHtml(p.abl)}`;
    const a = p.ars || {};
    return `<span><b>${s.kmh}</b>km</span>${G('コン', s.ctl)}${G('スタ', s.sta)}${Object.entries(a).filter(([k]) => k !== 'st').map(([k, v]) => `<span>${E.PITCHES[k].s}${v}</span>`).join('')}${ablHtml(p.abl)}`;
  }
  const ablHtml = a => (a || []).map(k => { const x = E.ABIL[k]; return `<em class="ab ab${x.g > 1 ? 'g' : x.g < 0 ? 'r' : 'b'}">${x.n}</em>`; }).join('');
  function renderUp() {
    const bat = R.type === 'bat';
    let h = `<h2>能力アップ</h2><div class="sc-pts">${Object.keys(PT).filter(k => bat ? k !== 'brk' : true).map(k => `<span style="--c:${PTC[k]}">${PT[k]}<b>${R.pts[k]}</b></span>`).join('')}</div><div class="sc-up">`;
    for (const s of STATS[R.type]) {
      const v = R.st[s.k], cur = s.k === 'kmh' ? v - 100 : v, max = s.max || 100;
      const c1 = costOf(s, cur, 1), c5 = costOf(s, cur, 5);
      const fmt = c => Object.entries(c).map(([k, x]) => `<i style="color:${PTC[k]}">${PT[k][0]}${x}</i>`).join('');
      h += `<div class="sc-row"><span>${s.n}</span><b class="g-${E.grade(s.k === 'kmh' ? (v - 110) * 1.6 : v)}">${s.k === 'kmh' ? v + 'km' : E.grade(v) + v}</b><button data-up="${s.k}" data-n="1" ${v >= max || !canPay(c1) ? 'disabled' : ''}>+1 ${fmt(c1)}</button><button data-up="${s.k}" data-n="5" ${v + 5 > max || !canPay(c5) ? 'disabled' : ''}>+5 ${fmt(c5)}</button></div>`;
    }
    if (bat) h += `<div class="sc-row"><span>弾道</span><b>${R.st.traj}</b><button id="upTraj" ${R.st.traj >= 4 || R.pts.str < trajCost(R.st.traj) ? 'disabled' : ''}>+1 <i style="color:${PTC.str}">筋${trajCost(R.st.traj)}</i></button></div>`;
    else {
      h += `<div class="lbl" style="margin-top:8px">変化球（5種類まで）</div><div class="sc-brk">${BREAKS.map(k => { const lv = R.ars[k] || 0; return `<button data-brk="${k}" ${lv >= 7 || R.pts.brk < 25 + lv * 18 || (!lv && Object.keys(R.ars).length >= 5) ? 'disabled' : ''}>${E.PITCHES[k].n}<b>${lv || '−'}</b><i style="color:${PTC.brk}">変${25 + lv * 18}</i></button>`; }).join('')}</div>`;
    }
    h += `</div><div class="lbl" style="margin-top:10px">特殊能力（★はコツをつかんでいて半額）</div><div class="sc-abl">`;
    const t = bat ? 'b' : 'p';
    for (const [k, a] of Object.entries(E.ABIL)) {
      if (a.t !== t) continue; const hv = R.abl.includes(k);
      if (a.g < 0) { if (hv) h += `<button data-abl="${k}" ${R.pts.men < 24 ? 'disabled' : ''} class="ab abr">${a.n}を消す <i>精24</i></button>`; continue; }
      let c = ablCost(k); if (R.hint[k]) c = Math.round(c / 2);
      h += `<button data-abl="${k}" class="ab ab${a.g > 1 ? 'g' : 'b'} ${hv ? 'got' : ''}" ${hv || R.pts.men < c || R.pts[bat ? 'tec' : 'brk'] < Math.round(c / 3) ? 'disabled' : ''} title="${a.d}">${R.hint[k] ? '★' : ''}${a.n} <i>${hv ? '習得' : `精${c}・${bat ? '技' : '変'}${Math.round(c / 3)}`}</i></button>`;
    }
    h += `</div><p class="note">${Object.entries(E.ABIL).filter(([, a]) => a.t === t).map(([, a]) => `${a.n}：${a.d}`).join('／')}</p><div class="row"><button class="btn gold" id="upBack">もどる</button></div>`;
    root.innerHTML = h;
    root.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { up(b.dataset.up, +b.dataset.n); renderUp(); });
    root.querySelectorAll('[data-brk]').forEach(b => b.onclick = () => { upBreak(b.dataset.brk); renderUp(); });
    root.querySelectorAll('[data-abl]').forEach(b => b.onclick = () => { buyAbl(b.dataset.abl); renderUp(); });
    const tj = $('upTraj'); if (tj) tj.onclick = () => { upTraj(); renderUp(); };
    $('upBack').onclick = render;
  }
  function renderStart() {
    let skinSel = 'pink';
    const skins = Object.entries(E.SKINS);
    root.innerHTML = `<h2>サクセス</h2><p class="note">ウパ高校野球部で3年間（30週）すごして、オリジナル選手を作ろう。<br>練習で経験点をためて能力アップ。夏の大会で活躍すると、経験点がたくさんもらえる。<br>できた選手は「チーム」の画面からマイチームに入れて、試合やオンラインで使える。</p>
      <div class="card" style="display:grid;gap:10px">
        <div><div class="lbl">名前</div><input class="name" id="scName" maxlength="8" placeholder="ウパ太"></div>
        <div><div class="lbl">体の色</div><div class="sc-skins">${skins.map(([k, s]) => `<button data-skin="${k}" class="${k === skinSel ? 'on' : ''}"><img src="${faceURL(k)}" alt=""><small>${s.n}</small></button>`).join('')}</div></div>
        <div><div class="lbl">ポジション</div><div class="seg" id="scType"><button data-v="bat" class="on">野手</button><button data-v="pit">投手</button></div></div>
        <div><div class="lbl">利き腕</div><div class="seg" id="scLR"><button data-v="0" class="on">右</button><button data-v="1">左</button></div></div>
      </div>
      <div class="row"><button class="btn ghost" id="scBack">もどる</button><button class="btn gold" id="scGo" style="flex:2">入部する！</button></div>`;
    root.querySelectorAll('[data-skin]').forEach(b => b.onclick = () => { skinSel = b.dataset.skin; root.querySelectorAll('[data-skin]').forEach(x => x.classList.toggle('on', x === b)); });
    for (const id of ['scType', 'scLR']) root.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => root.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)));
    $('scName').value = SV.lastSuccName || '';
    $('scBack').onclick = () => show('title');
    $('scGo').onclick = () => {
      const nm = ($('scName').value || '').trim().slice(0, 8) || 'ウパ太'; SV.lastSuccName = nm;
      newRun(root.querySelector('#scType .on').dataset.v, nm, skinSel, root.querySelector('#scLR .on').dataset.v === '1');
    };
  }
  function renderEnd(rec) {
    root.innerHTML = `<h2>サクセス終了！</h2><div class="card sc-end"><div class="sc-rank">${rec.rank}</div><img src="${faceURL(rec.skin)}" alt=""><b>${esc(rec.name)}</b><small>${rec.type === 'bat' ? '野手' : '投手'}${rec.champ ? '・ウパ子園出場！' : ''}</small><div class="sc-st">${statLine(rec.type === 'bat' ? { type: 'bat', st: rec, abl: rec.abl } : { type: 'pit', st: rec, ars: rec.ars, abl: rec.abl })}</div></div>
      <p class="note">選手を保存したよ。「チーム」の画面で、マイチームに入れられる。</p>
      <div class="row"><button class="btn gold" id="scToTeam">チームの画面へ</button><button class="btn ghost" id="scAgain">もう一度サクセス</button><button class="btn ghost" id="scHome">タイトルへ</button></div>`;
    $('scToTeam').onclick = () => show('team'); $('scAgain').onclick = renderStart; $('scHome').onclick = () => show('title');
  }
  function bind() {
    root.querySelectorAll('[data-p]').forEach(b => b.onclick = () => doPrac(+b.dataset.p));
    root.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => choose(+b.dataset.ch));
    const on = (id, f) => { const e = $(id); if (e) e.onclick = f; };
    on('scRest', doRest); on('scRest2', doRest); on('scPlay', doPlay); on('scUp', renderUp);
    on('scQuit', () => show('title'));
  }
  return { open() { render(); }, get running() { return !!R; }, _R: () => R, _set: r => { R = r; }, _act: { doPrac, doRest, choose, newRun } };
}
