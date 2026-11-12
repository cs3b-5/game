// うぱるぱスピリッツ：試合の進行・操作・オンライン
import * as E from './engine.js';
import { createWorld } from './scene.js';

const $ = id => document.getElementById(id);
const W = createWorld($('cv'));
const SAVE = 'uparupa-spirits-v1';
const SV = (() => { try { return JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) { return {}; } })();
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(SV)); } catch (e) {} };
const LAG = 0.1; // ボタンを押してからバットが当たるまで
const isTouch = matchMedia('(hover: none)').matches;

// ================= 画面 =================
const SCREENS = ['title', 'setup', 'online', 'help', 'pause', 'result'];
let screenStack = [];
function show(id) { for (const s of SCREENS) $(s).hidden = s !== id; if (id) screenStack.push(id); }
function back() { screenStack.pop(); const prev = screenStack.pop() || 'title'; show(prev); }
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => show(b.dataset.go));
document.querySelectorAll('[data-back]').forEach(b => b.onclick = back);
function seg(id, cb) { const el = $(id); el.querySelectorAll('button').forEach(b => b.onclick = () => { el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); cb && cb(b.dataset.v); }); }
const segVal = id => $(id).querySelector('button.on').dataset.v;
function setSeg(id, v) { $(id).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(v))); }
seg('innSeg'); seg('lvSeg'); seg('sideSeg'); seg('olInn');

function teamPicker(id, key, def) {
  const el = $(id); el.innerHTML = '';
  for (const t of E.TEAMS) {
    const b = document.createElement('button'); b.className = 'team'; b.dataset.id = t.id;
    b.innerHTML = `<span class="em" style="background:${t.c};color:${t.c2 === '#ffffff' ? '#fff' : t.c2};box-shadow:inset 0 0 0 2px ${t.cap}">${t.s}</span><b></b>`;
    b.querySelector('b').textContent = t.n;
    b.onclick = () => { el.querySelectorAll('.team').forEach(x => x.classList.toggle('on', x === b)); SV[key] = t.id; save(); };
    el.appendChild(b);
  }
  const v = SV[key] || def; el.querySelectorAll('.team').forEach(x => x.classList.toggle('on', x.dataset.id === v));
}
teamPicker('myTeams', 'my', 'upa'); teamPicker('cpuTeams', 'cpu', 'mex'); teamPicker('olTeams', 'my', 'upa');
const pickedTeam = id => ($(id).querySelector('.team.on') || {}).dataset?.id || E.TEAMS[0].id;
if (SV.inn) { setSeg('innSeg', SV.inn); setSeg('olInn', SV.inn); }
if (SV.lv !== undefined) setSeg('lvSeg', SV.lv);

// ================= 試合 =================
let G = null;
// G = {S, me (0=先攻 1=後攻 / -1=観戦), mode:'cpu'|'online', lv, rng, names, phase, ...}
function skinsOf(team) { const d = E.defenseOf(team), m = {}; for (const k of E.FIELD_ORDER) m[k] = team.bat[d[k]][6]; m.P = team.pit[5]; return m; }
const teamAt = (S, i) => E.teamById(i ? S.home : S.away);

function startGame(opt) {
  const S = E.newGame(opt.away, opt.home, opt.innings);
  G = { S, me: opt.me, mode: opt.mode, lv: opt.lv ?? 1, rng: E.rngOf(opt.seed ?? (Math.random() * 2 ** 32)), names: opt.names || [teamAt(S, 0).n, teamAt(S, 1).n], phase: 'idle', pending: null, half: null, inbox: [] };
  show(null); screenStack = [];
  $('hud').hidden = false; $('ctl').hidden = false; $('pauseBtn').hidden = false; document.body.classList.add('playing');
  setupHalf(true);
  banner(`プレイボール！`, `${teamAt(S, 0).n} 対 ${teamAt(S, 1).n}`, true);
  setTimeout(nextPitch, 1600);
}
function setupHalf(force) {
  const S = G.S, key = S.inn + (S.top ? 't' : 'b');
  if (!force && G.half === key) return;
  G.half = key;
  const ft = teamAt(S, S.top ? 1 : 0), bt = teamAt(S, S.top ? 0 : 1);
  const { idx } = E.curBatter(S), bat = E.batterOf(bt, idx);
  W.setTeams(ft, skinsOf(ft), bt, bat, bat.left);
  W.setRunners(S.bases, []);
  W.setView(myRole() === 'pitch' ? 'pitch' : 'bat', true);
}
function myRole() { if (!G || G.me < 0) return 'watch'; const batIdx = G.S.top ? 0 : 1; return G.me === batIdx ? 'bat' : 'pitch'; }
// 打つ側／投げる側をだれが操作するか：'me' | 'cpu' | 'remote'
const AUTO = /[?&]auto=1/.test(location.search); // テスト用：自分の番も CPU
function ctrlOf(role) { const r = myRole(); if (r === role) return AUTO ? 'cpu' : 'me'; return G.mode === 'online' ? 'remote' : 'cpu'; }

function refreshPeople() {
  const S = G.S, bt = teamAt(S, S.top ? 0 : 1), { idx } = E.curBatter(S), bat = E.batterOf(bt, idx);
  W.setBatter(bat.skin, bat.left);
  W.setRunners(S.bases, S.bases.map(b => b === null ? null : bt.bat[b][6]));
}

// ---------- 表示 ----------
function hud() {
  const S = G.S;
  const tA = teamAt(S, 0), tH = teamAt(S, 1);
  for (const [k, t, sc] of [['A', tA, S.score[0]], ['H', tH, S.score[1]]]) {
    $('em' + k).textContent = t.s; $('em' + k).style.background = t.c; $('em' + k).style.color = t.c2 === '#ffffff' ? '#fff' : t.c2;
    $('nm' + k).textContent = (k === 'A' ? G.names[0] : G.names[1]).slice(0, 7); $('sc' + k).textContent = sc;
  }
  $('trA').classList.toggle('bat', S.top); $('trH').classList.toggle('bat', !S.top);
  $('inn').innerHTML = `${S.inn}<br>${S.top ? '表' : '裏'}`;
  document.querySelectorAll('.bso .b').forEach((e, i) => e.classList.toggle('on', i < S.b));
  document.querySelectorAll('.bso .s').forEach((e, i) => e.classList.toggle('on', i < S.s));
  document.querySelectorAll('.bso .o').forEach((e, i) => e.classList.toggle('on', i < S.outs));
  [1, 2, 3].forEach(i => $('b' + i).classList.toggle('on', S.bases[i - 1] !== null));
  const bt = teamAt(S, S.top ? 0 : 1), { idx } = E.curBatter(S), b = E.batterOf(bt, idx);
  const pt = teamAt(S, S.top ? 1 : 0), p = E.pitcherOf(pt);
  face($('batFace'), b.skin, bt, `images/cards/${bt.id}_${idx + 1}.webp`);
  face($('pitFace'), p.skin, pt, `images/cards/${pt.id}_9.webp`);
  $('batNm').textContent = `${idx + 1}番 ${b.name}${b.left ? '（左）' : ''}`;
  $('batSt').innerHTML = [['ミート', b.con], ['パワー', b.pow], ['走力', b.spd]].map(([l, v]) => { const g = E.grade(v); return `<span>${l}<b class="g-${g}">${g}</b></span>`; }).join('');
  $('pitNm').textContent = `${p.name}${p.left ? '（左）' : ''}`;
  $('pitSt').innerHTML = `<span><b>${p.kmh}</b>km</span><span>コン<b class="g-${E.grade(p.ctl)}">${E.grade(p.ctl)}</b></span>` + Object.entries(p.ars).filter(([k]) => k !== 'st').map(([k, v]) => `<span>${E.PITCHES[k].s}${v}</span>`).join('');
  W.drawBoard(S, G.names.map(n => n));
}
// 顔：画像があれば画像、なければ絵を描く
const faceCache = {};
function face(el, skin, team, img) {
  const key = skin + team.id + img;
  if (el.dataset.key === key) return; el.dataset.key = key; el.innerHTML = '';
  if (!faceCache[skin + team.id]) {
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'), sk = E.SKINS[skin];
    g.fillStyle = team.c; g.fillRect(0, 0, 96, 96);
    g.fillStyle = sk.gill;
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) { g.save(); g.translate(48 + sx * 30, 52 - i * 2); g.rotate(sx * (-.9 + i * .55)); g.beginPath(); g.ellipse(0, -16, 6, 16, 0, 0, 7); g.fill(); g.restore(); }
    g.fillStyle = sk.body; g.beginPath(); g.ellipse(48, 58, 34, 26, 0, 0, 7); g.fill();
    g.fillStyle = team.cap; g.beginPath(); g.ellipse(48, 40, 28, 16, 0, Math.PI, 0); g.fill(); g.fillStyle = team.c; g.fillRect(46, 36, 26, 6);
    g.fillStyle = sk.eye; for (const sx of [-1, 1]) { g.beginPath(); g.arc(48 + sx * 18, 58, 4.5, 0, 7); g.fill(); }
    g.strokeStyle = '#40202a'; g.lineWidth = 2.5; g.beginPath(); g.arc(48, 62, 10, .3, Math.PI - .3); g.stroke();
    g.fillStyle = 'rgba(255,111,143,.35)'; for (const sx of [-1, 1]) { g.beginPath(); g.arc(48 + sx * 24, 66, 5, 0, 7); g.fill(); }
    faceCache[skin + team.id] = c.toDataURL();
  }
  const base = document.createElement('img'); base.src = faceCache[skin + team.id]; base.alt = ''; el.appendChild(base);
  const pic = document.createElement('img'); pic.alt = ''; pic.style.opacity = 0; pic.onload = () => { pic.style.opacity = 1; }; pic.onerror = () => pic.remove(); pic.src = img; el.appendChild(pic);
}
let bannerT = 0;
function banner(txt, sub = '', big = false, ms = 1500) {
  const b = $('banner'); b.innerHTML = ''; b.append(txt); if (sub) { const s = document.createElement('small'); s.textContent = sub; b.append(s); }
  b.classList.toggle('big', big); b.classList.add('on'); clearTimeout(bannerT); bannerT = setTimeout(() => b.classList.remove('on'), ms);
}
function tip(t) { $('tip').textContent = t || ''; $('tip').hidden = !t; }

// ---------- 1球の流れ ----------
let cur = { x: 0, y: 0.74 }, aimAt = null, pitchType = 'st';
function nextPitch() {
  if (!G) return;
  const S = G.S;
  if (S.over) return endGame();
  setupHalf();
  refreshPeople(); hud();
  G.phase = 'ready'; G.swung = false; G.play = null; G.waitRemote = false; aimAt = null;
  W.setBall(0, 0, 0, false); $('speed').classList.remove('on');
  const pc = ctrlOf('pitch'), bc = ctrlOf('bat');
  W.setView(myRole() === 'pitch' ? 'pitch' : 'bat');
  $('swingBtn').hidden = !(bc === 'me' && isTouch);
  W.zoneG.visible = true;
  const bat = curBat();
  W.setCursor(cur.x, cur.y, E.meetR(bat.con), bc === 'me');
  $('oppWait').hidden = true;
  if (pc === 'me') { showPitchBar(); tip(isTouch ? '球種 → 場所をタップ → もう一度タップで投球' : '球種をえらんで、投げたい場所をクリック'); }
  else {
    $('pitchBar').hidden = true; W.aim.visible = false;
    tip(bc === 'me' ? (isTouch ? 'なぞってカーソル・ボタンでスイング' : 'マウスでカーソル・クリック／スペースでスイング') : '');
    if (pc === 'cpu') { const c = E.cpuPitch(curPit(), S, G.rng); setTimeout(() => G && G.phase === 'ready' && throwPitch(c.type, c.tx, c.ty), 900 + Math.random() * 600); }
    else { $('oppWait').hidden = false; checkInbox(); }
  }
}
const curBat = () => { const { idx, team } = E.curBatter(G.S); return E.batterOf(team, idx); };
const curPit = () => E.curPitcher(G.S);
function slowOf() { return G.mode === 'online' ? 1.15 : [1.35, 1.15, 1.0][G.lv]; }
function showPitchBar() {
  const p = curPit(), el = $('pitchBar'); el.hidden = false; el.innerHTML = '';
  if (!p.ars[pitchType]) pitchType = 'st';
  for (const [k, lv] of Object.entries(p.ars)) {
    const b = document.createElement('button'); b.dataset.k = k; b.innerHTML = `${E.PITCHES[k].n}${k === 'st' ? '' : `<b>${lv}</b>`}`;
    b.classList.toggle('on', k === pitchType); b.onclick = () => { pitchType = k; el.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
    el.appendChild(b);
  }
}
function throwPitch(type, tx, ty) {
  if (!G || G.phase !== 'ready') return;
  const p = E.makePitch(curPit(), type, tx, ty, G.rng, slowOf());
  p.seq = G.S.seq;
  if (G.mode === 'online' && myRole() === 'pitch') send({ t: 'pitch', p });
  runPitch(p);
}
function runPitch(p) {
  G.phase = 'windup'; G.p = p; G.t0 = performance.now() / 1000 + 0.75; G.swung = false;
  $('pitchBar').hidden = true; W.aim.visible = false; tip(''); $('oppWait').hidden = true;
  // CPU が打つなら、振るかどうか先に決める
  G.cpuSw = ctrlOf('bat') === 'cpu' ? E.cpuSwing(p, curBat(), G.S, G.rng, G.lv) : null;
}
function doSwing() {
  if (!G || G.swung || ctrlOf('bat') !== 'me' || !(G.phase === 'windup' || G.phase === 'pitch')) return;
  const t = performance.now() / 1000 - G.t0;
  if (t < -0.2) return; // 早すぎる（投げる前）
  G.swung = true; G.swingAt = t;
  const sw = { cx: cur.x, cy: cur.y, dt: t + LAG - G.p.dur };
  G.sw = sw;
  swingAnim();
}
function swingAnim() {
  const u = W.batter; if (!u) return;
  u.userData.swing = performance.now() / 1000;
}
// ボールがホームに来た／見送り
function resolvePitch() {
  const p = G.p, bat = curBat();
  const sw = ctrlOf('bat') === 'me' ? (G.swung ? G.sw : null) : G.cpuSw;
  const r = E.resolveSwing(p, bat, sw, G.rng);
  let ev = r, ball = null;
  if (r.kind === 'inplay') {
    ball = E.flight(r.v, r.la, r.sp);
    const ft = teamAt(G.S, G.S.top ? 1 : 0), dm = E.defenseOf(ft), defs = {};
    for (const k of E.FIELD_ORDER) defs[k] = E.batterOf(ft, dm[k]).def;
    const j = E.judge(ball, E.FIELDERS, defs, bat, G.S);
    ev = { kind: 'inplay', ...j };
  }
  const play = { seq: p.seq, sw, r: { kind: r.kind, v: r.v, la: r.la, sp: r.sp }, ev };
  if (G.mode === 'online') send({ t: 'play', play });
  showPlay(play, ball);
}
function showPlay(play, ball) {
  G.play = play;
  const r = play.r;
  if (r.kind === 'inplay') {
    ball = ball || E.flight(r.v, r.la, r.sp);
    G.phase = 'flight'; G.ball = ball; G.ft0 = performance.now() / 1000; G.ev = play.ev;
    W.setBall(0, .9, -.4, true, false);
    W.zoneG.visible = false; W.setCursor(0, 0, 0, false);
    $('swingBtn').hidden = true; tip('');
    const ev = play.ev;
    if (ev.res === 'HR' || (ball.landDist > 60 && Math.abs(ball.phi) < 45)) W.followBall(true);
    else if (ev.res === 'FOUL' && ball.landDist < 25) { /* 近いファウルはそのまま */ }
    else W.followBall(true);
    // 野手が走る
    if (ev.who && W.FIELD[ev.who]) { const f = W.FIELD[ev.who]; f.userData.busy = true; f.userData.runTo = { from: [f.position.x, f.position.z], to: ev.at, t: ev.t }; }
    // 打者が走る
    if (ev.res !== 'FOUL' && W.batter) { W.batter.userData.busy = true; W.batter.userData.runBases = ev.res === 'HR' ? 4 : Math.max(1, ev.bases || 1); W.batter.userData.run0 = performance.now() / 1000; }
  } else {
    G.phase = 'catch'; G.ct0 = performance.now() / 1000;
  }
}
function finishPlay() {
  const ev = G.play.ev, prev = G.S;
  G.S = E.applyEvent(G.S, ev);
  const L = G.S.last;
  W.followBall(false);
  const kind = ev.kind === 'inplay' ? ev.res : ev.kind;
  const big = ['HR', '2B', '3B', 'DP'].includes(kind) || /三振|サヨナラ|ヒット|安打/.test(L.msg);
  if (kind === 'HR') W.cheer(3.5);
  banner(L.msg, L.runs ? `${G.names[0].slice(0, 8)} ${G.S.score[0]} - ${G.S.score[1]} ${G.names[1].slice(0, 8)}` : '', big, big ? 1800 : 900);
  void prev;
  G.phase = 'after';
  hud();
  if (G.mode === 'online' && G.host) send({ t: 'state', S: G.S });
  const wait = big ? 1900 : ev.kind === 'inplay' ? 1300 : 750;
  setTimeout(() => {
    if (!G) return;
    if (G.S.over) return endGame();
    if (L.change) { banner(`${G.S.inn}回${G.S.top ? '表' : '裏'}`, `${teamAt(G.S, G.S.top ? 0 : 1).n}の攻撃`, false, 1200); setTimeout(nextPitch, 1300); }
    else nextPitch();
  }, wait);
}

// ---------- 毎フレーム ----------
const BASEPOS = E.BASES;
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  W.frame(dt, (dt, time) => {
    const T = performance.now() / 1000;
    if (!G) return;
    const p = G.p;
    // ピッチャーの投球フォーム
    const pu = W.pitcher;
    if (pu && (G.phase === 'windup' || G.phase === 'pitch')) {
      const k = (T - (G.t0 - .75)) / .75, d = pu.userData; d.busy = true;
      const a = Math.min(1, Math.max(0, k));
      d.arms[1].rotation.x = a < .7 ? -a / .7 * 2.8 : -2.8 + (a - .7) / .3 * 3.6;
      d.arms[0].rotation.x = a < .7 ? -a * 1.2 : -.8;
      d.legs[0].rotation.x = a < .6 ? -a * 1.6 : -.96 + (a - .6) * 2.4;
      d.torso.rotation.x = a < .7 ? -.15 : .4;
    } else if (pu) pu.userData.busy = false;
    // バッターのスイング
    const bu = W.batter;
    if (bu) {
      const d = bu.userData;
      if (d.swing) {
        const k = (T - d.swing) / .22;
        d.body.rotation.y = k < 1 ? .5 - Math.sin(Math.min(1, k) * Math.PI / 2) * 2.6 : -2.1;
        if (T - d.swing > 1.2 && G.phase !== 'flight') { d.swing = 0; d.body.rotation.y = .5; }
      } else if (!d.busy) d.body.rotation.y = .5 + Math.sin(T * 2) * .03;
      // CPU のスイング
      if (G.phase === 'pitch' && G.cpuSw && !d.swing && T - G.t0 >= p.dur + G.cpuSw.dt - LAG) d.swing = T;
      // 走る
      if (d.runBases) {
        const tt = T - d.run0 - .25;
        if (tt > 0) {
          const spd = 6.6 + curBatSafe().spd / 100 * 2.2, dist = tt * spd, legLen = 27.43;
          const n = Math.min(d.runBases, dist / legLen), i = Math.min(3, Math.floor(n)), f = n - i;
          const a = BASEPOS[i], b = BASEPOS[(i + 1) % 4];
          if (n < d.runBases) { d.body.rotation.y = 0; bu.position.set(a[0] + (b[0] - a[0]) * f, 0, a[1] + (b[1] - a[1]) * f); bu.lookAt(b[0], 0, b[1]); W.animUpa(bu, T, 'run'); }
          else W.animUpa(bu, T, 'idle');
        }
      }
    }
    // 野手
    for (const k in W.FIELD) {
      const f = W.FIELD[k], R = f.userData.runTo; if (!R || G.phase !== 'flight') continue;
      const el = T - G.ft0, k2 = Math.min(1, Math.max(0, (el - .35) / Math.max(.1, R.t - .35)));
      f.position.set(R.from[0] + (R.to[0] - R.from[0]) * k2, 0, R.from[1] + (R.to[1] - R.from[1]) * k2);
      if (k2 < 1) { f.lookAt(R.to[0], 0, R.to[1]); W.animUpa(f, T, 'run'); } else { f.lookAt(0, 0, 0); W.animUpa(f, T, 'ready'); }
    }
    // ボール
    if (G.phase === 'windup') {
      if (T >= G.t0) { G.phase = 'pitch'; $('speed').innerHTML = `${p.kmh}<small>km/h ${E.PITCHES[p.type].n}</small>`; $('speed').classList.add('on'); }
      else W.setBall(0, 0, 0, false);
    }
    if (G.phase === 'pitch') {
      const t = (T - G.t0) / p.dur;
      const [x, y, z] = W.pitchPos(p, Math.min(t, 1));
      W.setBall(x, y, z, true, true);
      if (t >= 1 && !G.waitRemote) {
        if (ctrlOf('bat') === 'remote') { G.waitRemote = true; checkInbox(); }
        else if (T - G.t0 >= p.dur + 0.06) resolvePitch();
      }
    }
    if (G.phase === 'catch') {
      const k = Math.min(1, (T - G.ct0) / .12), [ex, ey] = p.end;
      W.setBall(ex, ey, 0.9 * k, k < 1, true);
      if (k >= 1 && !G.caught) { G.caught = true; setTimeout(() => { G.caught = false; finishPlay(); }, 250); G.phase = 'caught'; }
    }
    if (G.phase === 'flight') {
      const b = G.ball, ev = G.ev, el = (T - G.ft0) * 1.15;
      const end = ev.t ? Math.min(b.path[b.path.length - 1][0], ev.t) : b.path[b.path.length - 1][0];
      let pt;
      if (el <= end) {
        let i = Math.max(0, Math.min(b.path.length - 1, Math.floor(el * 60))); pt = b.path[i];
        W.setBall(pt[1], pt[2], pt[3], true, true);
      } else {
        // 捕った後：一塁へ送球
        const after = el - end;
        if (ev.who && (ev.res === 'GO' || ev.res === 'DP')) {
          const from = ev.at, to = BASEPOS[1], dist = Math.hypot(to[0] - from[0], to[1] - from[1]), ft = dist / 31;
          const k = Math.min(1, Math.max(0, (after - .3) / ft));
          W.setBall(from[0] + (to[0] - from[0]) * k, 1.4 + Math.sin(k * Math.PI) * dist * .04, from[1] + (to[1] - from[1]) * k, true, true);
        } else if (ev.who) { const f = W.FIELD[ev.who]; if (f) W.setBall(f.position.x + .2, 1.1, f.position.z, true); }
        const hold = ev.res === 'HR' ? 2.2 : ev.res === 'GO' || ev.res === 'DP' ? 1.4 : ev.res === 'FOUL' ? .4 : 1.0;
        if (after > hold && G.phase === 'flight') { G.phase = 'done'; for (const k in W.FIELD) W.FIELD[k].userData.busy = false; finishPlay(); }
      }
    }
  });
  requestAnimationFrame(loop);
}
const curBatSafe = () => { try { return curBat(); } catch (e) { return { spd: 50 }; } };

// ---------- 操作 ----------
const cv = $('cv');
let drag = null;
function clampCur() { cur.x = Math.max(-.6, Math.min(.6, cur.x)); cur.y = Math.max(.15, Math.min(1.4, cur.y)); }
function batting() { return G && ctrlOf('bat') === 'me' && ['ready', 'windup', 'pitch'].includes(G.phase); }
function pitching() { return G && ctrlOf('pitch') === 'me' && G.phase === 'ready'; }
cv.addEventListener('pointerdown', e => {
  if (!G) return;
  if (e.pointerType === 'mouse') {
    if (batting() && e.button === 0) { mouseCur(e); doSwing(); }
    else if (pitching()) { const [x, y] = W.toPlane(e.clientX, e.clientY); throwPitch(pitchType, clampT(x, 'x'), clampT(y, 'y')); }
    return;
  }
  drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener('pointermove', e => {
  if (!G) return;
  if (e.pointerType === 'mouse') {
    if (batting()) mouseCur(e);
    else if (pitching()) { const [x, y] = W.toPlane(e.clientX, e.clientY); W.aim.visible = true; W.aim.position.set(clampT(x, 'x'), clampT(y, 'y'), .03); }
    return;
  }
  if (!drag || drag.id !== e.pointerId) return;
  if (batting()) {
    const k = 1.25 / W.pxPerM();
    cur.x += (e.clientX - drag.x) * k; cur.y -= (e.clientY - drag.y) * k; clampCur();
    W.setCursor(cur.x, cur.y, E.meetR(curBat().con));
  }
  drag.x = e.clientX; drag.y = e.clientY;
});
cv.addEventListener('pointerup', e => {
  if (!drag || drag.id !== e.pointerId) return;
  const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy);
  drag = null;
  if (pitching() && moved < 12) {
    const [x, y] = W.toPlane(e.clientX, e.clientY), tx = clampT(x, 'x'), ty = clampT(y, 'y');
    if (aimAt && Math.hypot(tx - aimAt[0], ty - aimAt[1]) < .14) { aimAt = null; throwPitch(pitchType, tx, ty); }
    else { aimAt = [tx, ty]; W.aim.visible = true; W.aim.position.set(tx, ty, .03); }
  }
});
const clampT = (v, a) => a === 'x' ? Math.max(-.55, Math.min(.55, v)) : Math.max(.15, Math.min(1.45, v));
function mouseCur(e) { const [x, y] = W.toPlane(e.clientX, e.clientY); cur.x = x; cur.y = y; clampCur(); W.setCursor(cur.x, cur.y, E.meetR(curBat().con)); }
$('swingBtn').addEventListener('pointerdown', e => { e.preventDefault(); doSwing(); });
const keys = {};
addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'Enter') { if (batting()) { e.preventDefault(); doSwing(); } }
  if (e.code === 'Escape' && G) pause();
  keys[e.code] = true;
});
addEventListener('keyup', e => { keys[e.code] = false; });
setInterval(() => {
  if (!batting()) return;
  const v = .025; let mv = false;
  if (keys.KeyA || keys.ArrowLeft) { cur.x -= v; mv = true; } if (keys.KeyD || keys.ArrowRight) { cur.x += v; mv = true; }
  if (keys.KeyW || keys.ArrowUp) { cur.y += v; mv = true; } if (keys.KeyS || keys.ArrowDown) { cur.y -= v; mv = true; }
  if (mv) { clampCur(); W.setCursor(cur.x, cur.y, E.meetR(curBat().con)); }
}, 16);

// ---------- ポーズ・終了 ----------
function pause() { if ($('pause').hidden) show('pause'); else { show(null); screenStack = []; } }
$('pauseBtn').onclick = pause;
$('resumeBtn').onclick = () => { show(null); screenStack = []; };
$('quitBtn').onclick = () => { if (G && G.mode === 'online') { send({ t: 'bye' }); netClose(); } quitGame(); };
function quitGame() {
  G = null; $('hud').hidden = true; $('ctl').hidden = true; $('pauseBtn').hidden = true; document.body.classList.remove('playing');
  W.setBall(0, 0, 0, false); W.zoneG.visible = false; W.setCursor(0, 0, 0, false); W.aim.visible = false;
  W.setView('title'); titleTeams(); screenStack = []; show('title');
}
function endGame() {
  if (!G || G.ended) return; G.ended = true;
  const S = G.S, me = G.me;
  const win = me < 0 ? null : S.score[me] > S.score[1 - me], draw = S.score[0] === S.score[1];
  $('resTitle').textContent = draw ? '引き分け' : win === null ? 'ゲームセット' : win ? 'かち！' : 'まけ…';
  const rows = [0, 1].map(i => `<tr><td style="text-align:left;padding-right:10px">${esc(G.names[i])}</td>${Array.from({ length: Math.max(S.innings, S.inn) }, (_, k) => `<td>${S.line[i][k] ?? '-'}</td>`).join('')}<td style="color:var(--gold);padding-left:8px">${S.score[i]}</td></tr>`).join('');
  $('resBox').innerHTML = `<div style="font-family:'Dela Gothic One';font-size:2.4rem">${S.score[0]} - ${S.score[1]}</div><div style="overflow:auto"><table style="margin:8px auto;border-collapse:collapse;font-weight:900;font-size:.9rem">${rows}</table></div>`;
  if (win) W.cheer(4);
  setTimeout(() => { $('hud').hidden = true; $('ctl').hidden = true; $('pauseBtn').hidden = true; show('result'); }, 1500);
  $('againBtn').hidden = G.mode === 'online';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
$('againBtn').onclick = () => { if (G && G.opt) startGame(G.opt); };
$('toTitle').onclick = () => { if (G && G.mode === 'online') { send({ t: 'bye' }); netClose(); } quitGame(); };

$('playGo').onclick = () => {
  const my = pickedTeam('myTeams'), cpu = pickedTeam('cpuTeams'), inn = +segVal('innSeg'), lv = +segVal('lvSeg'), side = segVal('sideSeg');
  SV.inn = inn; SV.lv = lv; save();
  const opt = side === 'home' ? { away: cpu, home: my, me: 1 } : { away: my, home: cpu, me: 0 };
  Object.assign(opt, { innings: inn, lv, mode: 'cpu' });
  startGame(opt); G.opt = opt;
};

// ================= オンライン =================
let peer = null, conn = null;
function qp(k) { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } }
function peerOpts() {
  const h = qp('peerhost');
  if (h) { const [host, port] = h.split(':'); return { host, port: +port || 9000, path: '/', secure: false, debug: 0 }; }
  return { debug: 0, config: { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: ['turn:jp.relay.metered.ca:80', 'turn:jp.relay.metered.ca:80?transport=tcp', 'turn:jp.relay.metered.ca:443', 'turns:jp.relay.metered.ca:443?transport=tcp'],
      username: '31536e5ac7d5f21e26083726', credential: 'EbmwVyaEUzn4LKnD' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
  ] } };
}
function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = qp('peerlib') || 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js'; s.onload = res; s.onerror = () => rej(new Error('通信の部品を読み込めなかった')); document.head.appendChild(s); });
}
function openPeer(id) {
  return new Promise((res, rej) => {
    const p = id ? new window.Peer(id, peerOpts()) : new window.Peer(peerOpts());
    const t = setTimeout(() => { rej(Object.assign(new Error('timeout'), { type: 'timeout' })); try { p.destroy(); } catch (e) {} }, 12000);
    const onErr = e => { clearTimeout(t); p.off('error', onErr); rej(e); try { p.destroy(); } catch (x) {} };
    p.on('open', () => { clearTimeout(t); p.off('error', onErr); res(p); });
    p.on('error', onErr);
  });
}
const ROOM = 'uparupa-room-';
const netMsg = t => { $('netMsg').textContent = t; };
function send(m) { try { if (conn && conn.open) conn.send(m); } catch (e) {} }
function netClose() { try { conn && conn.close(); } catch (e) {} try { peer && peer.destroy(); } catch (e) {} conn = null; peer = null; }
function myName() { return ($('olName').value || '').trim().slice(0, 10) || (window.GAMES_ACC && GAMES_ACC.name()) || 'ウパ'; }
$('olName').value = SV.name || (window.GAMES_ACC ? GAMES_ACC.name() : '');

$('hostBtn').onclick = async () => {
  SV.name = myName(); save(); netClose(); netMsg('準備中…');
  try {
    await loadPeerJS();
    let code;
    for (let i = 0; i < 5 && !peer; i++) { code = String(Math.floor(1000 + Math.random() * 9000)); try { peer = await openPeer(ROOM + code); } catch (e) { if (e.type !== 'unavailable-id') throw e; } }
    if (!peer) throw new Error('部屋を作れなかった');
    $('hostBox').hidden = false; $('roomCode').textContent = code; netMsg('相手を待っています…');
    peer.on('connection', c => {
      if (conn) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; }
      conn = c;
      c.on('data', d => onData(d, true));
      c.on('close', () => onLost());
    });
  } catch (e) { netMsg('つながりませんでした：' + (e.message || e.type)); netClose(); }
};
$('joinBtn').onclick = async () => {
  const code = ($('joinCode').value || '').replace(/\D/g, '');
  if (code.length !== 4) return netMsg('4けたの番号を入れてね');
  SV.name = myName(); save(); netClose(); netMsg('つないでいます…');
  try {
    await loadPeerJS(); peer = await openPeer();
    const c = peer.connect(ROOM + code, { reliable: true }); conn = c;
    const to = setTimeout(() => { if (!c.open) { netMsg('部屋が見つかりませんでした'); netClose(); } }, 12000);
    c.on('open', () => { if (c._opened) return; c._opened = true; clearTimeout(to); netMsg('つながった！'); c.send({ t: 'hello', name: myName(), team: pickedTeam('olTeams') }); });
    c.on('data', d => onData(d, false));
    c.on('close', () => onLost());
    peer.on('error', e => { if (e.type === 'peer-unavailable') { clearTimeout(to); netMsg('部屋が見つかりませんでした'); netClose(); } });
  } catch (e) { netMsg('つながりませんでした：' + (e.message || e.type)); netClose(); }
};
function onLost() { if (G && G.mode === 'online' && !G.ended) { banner('通信が切れました', '', false, 2500); setTimeout(quitGame, 2600); } conn = null; }
function onData(d, isHost) {
  if (!d || typeof d !== 'object') return;
  if (d.t === 'full') { netMsg('その部屋はもういっぱい'); netClose(); return; }
  if (d.t === 'hello' && isHost && !G) {
    const away = E.teamById(String(d.team)).id, home = pickedTeam('olTeams'), inn = +segVal('olInn');
    const names = [String(d.name || 'ゲスト').slice(0, 10), myName()];
    const seed = Math.floor(Math.random() * 2 ** 31);
    send({ t: 'start', away, home, inn, names, seed });
    startGame({ away, home, innings: inn, me: 1, mode: 'online', names, seed }); G.host = true;
    return;
  }
  if (d.t === 'start' && !isHost && !G) {
    startGame({ away: E.teamById(d.away).id, home: E.teamById(d.home).id, innings: [3, 6, 9].includes(d.inn) ? d.inn : 3, me: 0, mode: 'online', names: (d.names || []).map(n => String(n).slice(0, 10)), seed: (d.seed >>> 0) + 1 }); G.host = false;
    return;
  }
  if (!G) return;
  if (d.t === 'bye') { banner('相手が試合をやめました', '', false, 2500); setTimeout(() => { netClose(); quitGame(); }, 2600); return; }
  if (d.t === 'state' && !G.host && d.S && typeof d.S === 'object') { G.hostS = d.S; return; }
  G.inbox.push(d); checkInbox();
}
// 相手からの投球・打撃を、こちらの準備ができたら使う
function checkInbox() {
  if (!G) return;
  for (let i = 0; i < G.inbox.length; i++) {
    const d = G.inbox[i];
    if (d.t === 'pitch' && G.phase === 'ready' && ctrlOf('pitch') === 'remote' && d.p && d.p.seq === G.S.seq) {
      G.inbox.splice(i, 1); runPitch(sanitizePitch(d.p)); return;
    }
    if (d.t === 'play' && G.waitRemote && d.play && d.play.seq === G.S.seq) {
      G.inbox.splice(i, 1); G.waitRemote = false; const pl = d.play;
      if (pl.sw && W.batter) W.batter.userData.swing = performance.now() / 1000 - .1;
      showPlay({ seq: pl.seq, sw: pl.sw, r: pl.r || { kind: 'ball' }, ev: pl.ev || { kind: 'ball' } });
      return;
    }
    if ((d.t === 'pitch' || d.t === 'play') && (d.p || d.play || {}).seq < G.S.seq) { G.inbox.splice(i, 1); i--; }
  }
}
function sanitizePitch(p) {
  const n = (v, a, b, d) => Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : d;
  return { type: E.PITCHES[p.type] ? p.type : 'st', kmh: n(p.kmh, 80, 180, 140), dur: n(p.dur, .4, 3, 1.1), end: [n(p.end?.[0], -1, 1, 0), n(p.end?.[1], 0, 2, .7)], brk: [n(p.brk?.[0], -1, 1, 0), n(p.brk?.[1], -1, 1, 0)], rel: [n(p.rel?.[0], -1, 1, -.42), n(p.rel?.[1], 1, 2.2, 1.62), n(p.rel?.[2], -20, -15, -16.9)], seq: p.seq };
}
// ゲスト：ホストの状態がずれていたら合わせる
setInterval(() => { if (G && G.hostS && G.phase === 'ready' && G.hostS.seq > G.S.seq) { G.S = G.hostS; G.hostS = null; hud(); } }, 500);

// ================= タイトル =================
function titleTeams() {
  const t = E.teamById(SV.my || 'upa'), o = E.teamById(SV.cpu || 'mex');
  W.setTeams(t, skinsOf(t), o, E.batterOf(o, 0), false);
  W.setView('title', true);
}
titleTeams();
show('title');
addEventListener('resize', () => W.resize());
$('loading').remove();
requestAnimationFrame(loop);
window.UPA = { E, W, get G() { return G; }, startGame };
