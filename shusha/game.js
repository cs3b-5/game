// 出社できない — 本体（Canvas 2D + planck.js）
import { makeWorld, STAGES, ENDLESS, rankAt } from './physics.js';
const EI = STAGES.length; // エンドレスの番号
const planck = window.planck;
const $ = id => document.getElementById(id);
const KEY = 'shusha-dekinai-v1';
const SV = Object.assign({ unlocked: 1, best: {}, falls: 0, plays: 0, time: 0, fallsBy: {}, endBest: 0, endRuns: 0 }, (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })());
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch (e) {} rankReport(); };
const cleared = () => STAGES.filter(s => SV.best[s.id] != null).length;
const totalBest = () => STAGES.reduce((a, s) => a + (SV.best[s.id] || 0), 0);
function rankReport(old) { if (window.GAMES_RANK && SV.endBest > 0) GAMES_RANK.report('shushae', Math.floor(SV.endBest * 10) / 10, undefined, old ? { old: true } : undefined); }
const endOpen = () => cleared() >= STAGES.length;
const fmtT = t => t >= 60 ? `${Math.floor(t / 60)}分${(t % 60).toFixed(1)}秒` : `${t.toFixed(1)}秒`;

const TIPS = {
  home: 'コツ：<b>W+P</b> と <b>Q+O</b> を交互に、リズムよく。あわてないのがいちばん。',
  curb: '段差の前では、少し足を高く上げる気持ちで。',
  hill: '上りは前のめり、下りはがまん。',
  ice: '氷の上では足を大きく開かない。小さく、小さく。',
  wind: '「突風」の表示が出たら、足を前後に開いてふんばろう。',
  hurdle: 'バーの手前でひざを曲げて（O/P）またぐ。',
  moon: 'ふわふわ。押しすぎると宇宙まで飛ぶ（飛ばない）。',
  belt: '止まると流される。とにかく前へ。',
  crowd: '人は少しずつ前に進んでいる。ぶつかって押すとちょっと動く。',
  stairs: '見た目は階段。いつもより長く W+P を押す。',
  banana: 'バナナの上では力を入れない。',
};
const FALL_MSG = ['遅刻確定', 'また転んだ', '今日は在宅で…', '有給つかおう', '社会がこわい', '足がいうことをきかない', '部長に電話しなきゃ', 'ひざが笑ってる', '会社が遠い', '地面とこんにちは'];
const ZTHEME = { curb: 'town', hill: 'town', hurdle: 'town', ice: 'snow', wind: 'storm', moon: 'moon', belt: 'station', crowd: 'station', stairs: 'office', banana: 'office' };
const themeNow = () => { if (!G) return 'town'; if (!G.st.endless) return THEME[G.st.id]; const z = G.zoneAt(camX, 'theme'); return z ? ZTHEME[z.theme] : 'town'; };
let curRank = '';
const THEME = { home: 'town', curb: 'town', hill: 'town', ice: 'snow', wind: 'storm', hurdle: 'town', moon: 'moon', belt: 'station', crowd: 'station', stairs: 'office', banana: 'office' };

// ---------- 画面 ----------
const cv = $('c'), cx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() { DPR = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * DPR; cv.height = H * DPR; }
addEventListener('resize', resize); resize();

// ---------- 音 ----------
let AC = null;
function ac() { if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f0, f1, dur, type = 'square', vol = 0.12, delay = 0) { const a = ac(); if (!a) return; const t = a.currentTime + delay; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02); }
const sndStep = () => tone(140, 60, 0.07, 'sine', 0.18);
const sndFall = () => { tone(420, 90, 0.45, 'sawtooth', 0.12); tone(90, 40, 0.3, 'square', 0.15, 0.05); };
const sndGoal = () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.18, 'triangle', 0.15, i * 0.12));

// ---------- 状態 ----------
let SI = 0, G = null, state = 'title', tRun = 0, started = false, fallT = 0, goalT = 0, acc = 0, shake = 0, camX = 0, camY = 0, stageFalls = 0, particles = [];
const keys = { q: 0, w: 0, o: 0, p: 0 };
function newGame(i) {
  SI = i; G = makeWorld(planck, i === EI ? Object.assign({}, ENDLESS, { seed: (Math.random() * 1e9) | 0 }) : i); curRank = rankAt(0); tRun = 0; started = false; fallT = 0; goalT = 0; acc = 0; shake = 0; particles = [];
  camX = G.dist(); camY = G.parts.torso.getPosition().y - 1.2;
  G.world.on('begin-contact', c => {
    const a = c.getFixtureA().getUserData() || {}, b = c.getFixtureB().getUserData() || {};
    const p = a.part ? a : b.part ? b : null, o = a.part ? b : a;
    if (p && o.ground && (p.part === 'footL' || p.part === 'footR') && state === 'play') { sndStep(); const fp = G.parts[p.part].getPosition(); for (let k = 0; k < 3; k++) particles.push({ x: fp.x, y: fp.y - 0.03, vx: (Math.random() - 0.5) * 1.2, vy: Math.random() * 0.8, life: 0.5, c: themeNow() === 'moon' ? '#bbb' : '#c9c0b0' }); }
  });
  $('stName').textContent = i === EI ? `∞ エンドレス出社（ベスト ${SV.endBest.toFixed(1)}m）` : `${i + 1}. ${G.st.name}`;
  state = 'play';
}

// ---------- 入力 ----------
const setKey = (k, v) => { if (!(k in keys)) return; keys[k] = v; document.querySelector(`.k.${k}`)?.classList.toggle('on', !!v); if (v) ac(); if (v && state === 'fell' && fallT > 0.7) restart(); };
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (!$('intro').hidden && (k in keys || k === ' ' || k === 'enter')) { e.preventDefault(); goStage(); return; }
  if (state === 'goal' && !$('clear').hidden && (k === ' ' || k === 'enter')) { $('clNext').click(); return; }
  if (k === 'r' && (state === 'play' || state === 'fell')) { restart(); return; }
  if (k === ' ' && state === 'fell' && fallT > 0.5) { restart(); return; }
  if (k === 'escape') { if (state === 'play' || state === 'fell') openMenu(); else closeMenu(); return; }
  if (k in keys) { e.preventDefault(); if (!e.repeat) setKey(k, 1); }
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k in keys) setKey(k, 0); });
addEventListener('blur', () => { for (const k in keys) setKey(k, 0); });
document.querySelectorAll('.k').forEach(b => {
  const k = b.dataset.k; const ids = new Set();
  b.addEventListener('pointerdown', e => { e.preventDefault(); ids.add(e.pointerId); try { b.setPointerCapture(e.pointerId); } catch (er) {} setKey(k, 1); });
  const up = e => { ids.delete(e.pointerId); if (!ids.size) setKey(k, 0); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  b.addEventListener('contextmenu', e => e.preventDefault());
});
cv.addEventListener('pointerdown', () => { if (state === 'fell' && fallT > 0.7) restart(); });

// ---------- 画面の切りかえ ----------
const show = (id, on = true) => { $(id).hidden = !on; };
function showTitle() { state = 'title'; for (const id of ['sel', 'intro', 'clear', 'menu', 'hud', 'keys']) show(id, false); show('title'); const n = Math.min(SV.unlocked, STAGES.length) - 1; $('tSub').textContent = cleared() ? `つづき：${n + 1}. ${STAGES[n].name}` : '家の前から'; $('tEnd').hidden = !endOpen(); $('tEndSub').textContent = SV.endBest ? `ベスト ${SV.endBest.toFixed(1)}m（${rankAt(SV.endBest)}）` : 'どこまで出世できる？'; if (!G) { G = makeWorld(planck, 0); camX = 0; camY = 0; } }
function showSel() {
  for (const id of ['title', 'intro', 'clear', 'menu']) show(id, false); show('sel'); state = state === 'play' ? 'menu' : state;
  $('selGrid').innerHTML = STAGES.map((s, i) => { const lock = i >= SV.unlocked, b = SV.best[s.id]; return `<button class="st ${b != null ? 'clear' : ''} ${lock ? 'lock' : ''}" data-i="${i}" ${lock ? 'disabled' : ''}>${i + 1}. ${lock ? '？？？' : s.name}<i>${lock ? 'まだ行けない' : b != null ? '🏁 ' + fmtT(b) : `${s.len}m`}</i></button>`; }).join('');
  $('selGrid').innerHTML += `<button class="st ${endOpen() ? '' : 'lock'}" style="grid-column:1/-1;background:${endOpen() ? '#fff0c8' : '#fff'}" data-i="${EI}" ${endOpen() ? '' : 'disabled'}>∞ エンドレス出社<i>${endOpen() ? (SV.endBest ? `ベスト ${SV.endBest.toFixed(1)}m（${rankAt(SV.endBest)}）` : 'ゴールなし。どこまで行ける？') : '全ステージクリアで出てくる'}</i></button>`;
  $('selGrid').querySelectorAll('[data-i]').forEach(b => b.onclick = () => intro(+b.dataset.i));
  $('stats').innerHTML = [['クリアしたステージ', `${cleared()} / ${STAGES.length}`], ['ベストタイム合計', cleared() ? fmtT(totalBest()) : '—'], ['エンドレス最高', SV.endBest ? `${SV.endBest.toFixed(1)}m（${rankAt(SV.endBest)}）` : '—'], ['転んだ回数（合計）', `${SV.falls}回`], ['プレイ時間', fmtT(SV.time)]].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
}
function intro(i) {
  for (const id of ['title', 'sel', 'clear', 'menu']) show(id, false);
  newGame(i); state = 'intro'; show('hud'); show('keys'); show('intro');
  const s = i === EI ? ENDLESS : STAGES[i]; $('inNo').textContent = i === EI ? 'ENDLESS' : `STAGE ${i + 1} / ${STAGES.length}`; $('inName').textContent = s.name; $('inDesc').textContent = s.desc;
  $('inGoal').textContent = i === EI ? (SV.endBest ? `ベスト ${SV.endBest.toFixed(1)}m（${rankAt(SV.endBest)}）` : '段差・氷・突風・月面…ぜんぶランダムに出てくる') : `ゴールまで ${s.len}m` + (SV.best[s.id] != null ? `　ベスト ${fmtT(SV.best[s.id])}` : '');
  const fb = SV.fallsBy[s.id] || 0; $('inTip').hidden = i === EI || !(i === 0 || fb >= 5); $('inTip').innerHTML = '💡 ' + (TIPS[s.id] || '');
}
function goStage() { show('intro', false); state = 'play'; SV.plays++; }
function restart() { const i = SI; newGame(i); hideMsg(); stageFalls = SV.fallsBy[G.st.id] || 0; if (i !== EI && stageFalls === 5) { intro(i); return; } }
function openMenu() { if (state !== 'play' && state !== 'fell') return; const prev = state; state = 'menu'; show('menu'); $('mStat').innerHTML = [['ステージ', SI === EI ? '∞ エンドレス出社' : `${SI + 1}. ${G.st.name}`], ['このステージで転んだ', `${SV.fallsBy[G.st.id] || 0}回`], ['転んだ回数（合計）', `${SV.falls}回`]].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join(''); $('mBack').onclick = () => { show('menu', false); state = prev; }; }
function closeMenu() { if (!$('menu').hidden) $('mBack').click(); }
$('tGo').onclick = () => { ac(); intro(Math.min(SV.unlocked, STAGES.length) - 1); };
$('tSel').onclick = () => showSel();
$('tEnd').onclick = () => { ac(); intro(EI); };
$('selBack').onclick = () => showTitle();
$('inGo').onclick = () => goStage();
$('bRe').onclick = () => { if (state === 'play' || state === 'fell') restart(); };
$('bMenu').onclick = () => openMenu();
$('mSel').onclick = () => showSel();
$('mTitle').onclick = () => showTitle();
$('clNext').onclick = () => { if (SI + 1 < STAGES.length) intro(SI + 1); else showSel(); };
$('clRe').onclick = () => intro(SI);
$('clSel').onclick = () => showSel();

let msgT = 0;
function msg(html, ms) { const el = $('msg'); el.innerHTML = html; el.classList.add('on'); clearTimeout(msgT); if (ms) msgT = setTimeout(hideMsg, ms); }
function hideMsg() { $('msg').classList.remove('on'); }

// ---------- 更新 ----------
const DT = 1 / 60;
function update(dt) {
  if (state === 'play' || state === 'fell' || state === 'goal') {
    for (const k of 'qwop') G.keys[k] = state === 'play' ? keys[k] : 0;
    if (state === 'play' && !started && (keys.q || keys.w || keys.o || keys.p)) started = true;
    const slow = state === 'fell' ? 0.35 : 1;
    acc += dt * slow; let n = 0;
    while (acc >= DT && n < 5) { G.step(DT); acc -= DT; n++; }
    if (state === 'play' && started) { tRun += dt; SV.time += dt; }
    if (state === 'play' && G.fallen) {
      state = 'fell'; fallT = 0; shake = 0.35; SV.falls++; SV.fallsBy[G.st.id] = (SV.fallsBy[G.st.id] || 0) + 1; save(); sndFall();
      if (G.st.endless) {
        const d = Math.max(0, G.dist()), nb = d > SV.endBest; SV.endRuns++; if (nb) SV.endBest = d; save();
        msg(`最終役職：${rankAt(d)}<small>${d.toFixed(1)}m${nb ? '　🎉自己ベスト！' : `　（ベスト ${SV.endBest.toFixed(1)}m）`}<br>タップ / キーでもう一回</small>`);
        $('stName').textContent = `∞ エンドレス出社（ベスト ${SV.endBest.toFixed(1)}m）`;
      } else {
        const m = FALL_MSG[Math.random() * FALL_MSG.length | 0];
        msg(`${m}<small>${G.dist().toFixed(1)}m　タップ / キーでもう一回</small>`);
      }
    }
    if (state === 'play' && G.dist() >= G.st.len) {
      state = 'goal'; goalT = 0; sndGoal();
      const id = G.st.id, prev = SV.best[id]; const nb = prev == null || tRun < prev; if (nb) SV.best[id] = tRun;
      SV.unlocked = Math.max(SV.unlocked, Math.min(STAGES.length, SI + 2)); save();
      msg('ゴール！');
      setTimeout(() => {
        hideMsg(); show('clear');
        $('clStat').innerHTML = [['ステージ', `${SI + 1}. ${G.st.name}`], ['タイム', fmtT(tRun) + (nb ? ' 🎉ベスト' : '')], ['ベスト', fmtT(SV.best[id])], ['このステージで転んだ', `${SV.fallsBy[id] || 0}回`]].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
        $('clNext').textContent = SI + 1 < STAGES.length ? 'つぎのステージ' : '🎊 全ステージ出社完了！';
      }, 1100);
    }
    if (state === 'play' && G.st.endless) { const r = rankAt(G.dist()); if (r !== curRank) { curRank = r; msg(`🎉 ${r}に昇進！`, 1400); tone(660, 660, 0.12, 'triangle', 0.12); tone(880, 880, 0.2, 'triangle', 0.12, 0.12); } }
    if (state === 'fell') fallT += dt;
    if (state === 'goal') goalT += dt;
  }
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= (G && (G.st.g || (G.inMoon ? 1.62 : 9.8)) || 9.8) * 0.3 * dt; p.life -= dt; }
  particles = particles.filter(p => p.life > 0);
  if (shake > 0) shake -= dt;
  // カメラ
  if (G) { const tp = G.parts.torso.getPosition(); camX += (tp.x - camX) * Math.min(1, dt * 4); camY += (tp.y - 1.2 - camY) * Math.min(1, dt * 3); }
  // HUD
  if (G && state !== 'title') { $('dist').innerHTML = G.st.endless ? `${Math.max(0, G.dist()).toFixed(1)}<small>m　${rankAt(Math.max(0, G.dist()))}</small>` : `${Math.max(0, G.dist()).toFixed(1)}<small>m / ${G.st.len}m</small>`; $('timer').textContent = fmtT(tRun); }
}

// ---------- 描画 ----------
let S = 120; // 1m あたりのピクセル
const rr = (x, y, w, h, r) => { cx.beginPath(); cx.roundRect(x, y, w, h, r); };
function drawBG(theme, t) {
  const g = cx.createLinearGradient(0, 0, 0, H);
  const sky = { town: ['#8fd0ff', '#e6f6ff'], snow: ['#b9cbe0', '#f2f6fb'], storm: ['#5f6b7a', '#a9b3bf'], moon: ['#000004', '#0a0c1a'], station: ['#e8e2d6', '#d8d0c0'], office: ['#efe9dc', '#e2d9c6'] }[theme];
  g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  if (theme === 'moon') {
    cx.fillStyle = '#fff'; for (let i = 0; i < 120; i++) { const x = ((i * 137.5 - camX * 4) % W + W) % W, y = (i * 71.3) % (H * 0.7); cx.globalAlpha = 0.3 + (i % 5) * 0.14; cx.fillRect(x, y, 2, 2); } cx.globalAlpha = 1;
    const ex = W * 0.78 - camX * 2, ey = H * 0.2; cx.fillStyle = '#2a6fd0'; cx.beginPath(); cx.arc(ex, ey, 34, 0, 7); cx.fill(); cx.fillStyle = '#4aa860'; cx.beginPath(); cx.ellipse(ex - 8, ey - 6, 12, 8, 0.4, 0, 7); cx.fill(); cx.beginPath(); cx.ellipse(ex + 12, ey + 10, 9, 6, -0.3, 0, 7); cx.fill();
    return;
  }
  if (theme === 'station' || theme === 'office') {
    // 屋内のかべ
    const off = -camX * S * 0.5;
    cx.fillStyle = theme === 'office' ? '#d6ccb6' : '#cfc6b4'; cx.fillRect(0, H * 0.72, W, H);
    for (let i = -1; i < W / 260 + 2; i++) {
      const x = i * 260 - (((-off) % 260) + 260) % 260;
      if (theme === 'office') { cx.fillStyle = '#9ec9ea'; rr(x + 40, H * 0.18, 150, H * 0.34, 6); cx.fill(); cx.strokeStyle = '#6a5a40'; cx.lineWidth = 6; cx.stroke(); cx.beginPath(); cx.moveTo(x + 115, H * 0.18); cx.lineTo(x + 115, H * 0.52); cx.stroke(); }
      else { cx.fillStyle = '#39507a'; rr(x + 30, H * 0.2, 180, 40, 6); cx.fill(); cx.fillStyle = '#fff'; cx.font = '900 18px "M PLUS Rounded 1c"'; cx.fillText(i % 2 ? '3番線 →' : '改札 →', x + 50, H * 0.2 + 27); cx.fillStyle = '#b8ae9a'; cx.fillRect(x + 228, H * 0.1, 22, H * 0.7); }
    }
    return;
  }
  // 街
  const lay = (k, col, hMin, hMax, wv) => { cx.fillStyle = col; const off = camX * S * k; for (let i = -1; i < W / wv + 3; i++) { const gi = Math.floor(off / wv) + i; const x = gi * wv - off; const h = hMin + ((Math.sin(gi * 12.9898) * 43758.5) % 1 + 1) % 1 * (hMax - hMin); cx.fillRect(x, H * 0.75 - h, wv - 8, h + H); if (k > 0.2) { cx.fillStyle = 'rgba(255,255,255,.35)'; for (let yy = H * 0.75 - h + 14; yy < H * 0.72; yy += 26) for (let xx = x + 10; xx < x + wv - 22; xx += 22) cx.fillRect(xx, yy, 10, 12); cx.fillStyle = col; } } };
  lay(0.15, theme === 'storm' ? '#7d8794' : theme === 'snow' ? '#c8d4e2' : '#b9dcf2', 60, 200, 90);
  lay(0.35, theme === 'storm' ? '#5b6470' : theme === 'snow' ? '#9fb0c4' : '#8ab6d6', 40, 150, 120);
  if (theme === 'storm') { cx.strokeStyle = 'rgba(255,255,255,.45)'; cx.lineWidth = 1.5; for (let i = 0; i < 70; i++) { const x = ((i * 97 + t * 900) % (W + 100)) - 50, y = ((i * 53 + t * 1300) % (H + 100)) - 50; cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x - 14, y + 24); cx.stroke(); } }
  if (theme === 'snow') { cx.fillStyle = '#fff'; for (let i = 0; i < 60; i++) { const x = ((i * 113 + Math.sin(t + i) * 20 - camX * 30) % W + W) % W, y = (i * 47 + t * 40) % H; cx.beginPath(); cx.arc(x, y, 2 + i % 3, 0, 7); cx.fill(); } }
}
const wx = x => (x - camX) * S + W * 0.38, wy = y => H * 0.66 - (y - camY - 1.2) * S;
function drawWorld(t) {
  const st = G.st, theme = themeNow();
  // 地面
  const gp = G.groundPts; cx.beginPath(); cx.moveTo(wx(gp[0][0]), H + 10); for (const [x, y] of gp) cx.lineTo(wx(x), wy(y)); cx.lineTo(wx(gp[gp.length - 1][0]), H + 10); cx.closePath();
  cx.fillStyle = { town: '#7a7f88', snow: '#e8eef6', storm: '#5d636c', moon: '#8d8b86', station: '#b9b2a2', office: '#8a5a4a' }[theme]; cx.fill();
  cx.lineWidth = 6; cx.strokeStyle = { town: '#d8d2c4', snow: '#ffffff', storm: '#9aa2ac', moon: '#b8b5ad', station: '#e8e2d2', office: '#b27a64' }[theme];
  cx.beginPath(); gp.forEach(([x, y], i) => i ? cx.lineTo(wx(x), wy(y)) : cx.moveTo(wx(x), wy(y))); cx.stroke();
  if (theme === 'moon') { cx.fillStyle = 'rgba(0,0,0,.12)'; for (let i = Math.floor(camX - 6); i < camX + 10; i++) { const r = 0.15 + ((i * 7.13) % 1) * 0.3; cx.beginPath(); cx.ellipse(wx(i + 0.5), wy(0) + 20 + (i % 3) * 14, r * S * 0.6, r * S * 0.12, 0, 0, 7); cx.fill(); } }
  // 階段の見た目
  for (const d of G.deco) {
    if (d.kind === 'stairs') { cx.fillStyle = '#a06a52'; cx.strokeStyle = '#6b4232'; cx.lineWidth = 2; for (let i = 0; i < d.n; i++) { const x = d.x0 + i * d.w, yy = (d.y0 || 0) + (i + 1) * d.h; cx.fillRect(wx(x), wy(yy), d.w * S, (i + 1) * d.h * S + 10); cx.beginPath(); cx.moveTo(wx(x), wy(yy)); cx.lineTo(wx(x + d.w), wy(yy)); cx.stroke(); } }
    if (d.kind === 'ice') { cx.fillStyle = 'rgba(160,220,255,.75)'; cx.fillRect(wx(d.x1), wy(G.gy(d.x1)) - 4, (d.x2 - d.x1) * S, 9); cx.fillStyle = 'rgba(255,255,255,.8)'; for (let x = d.x1; x < d.x2; x += 0.7) cx.fillRect(wx(x), wy(G.gy(x)) - 3, 14, 2); }
    if (d.kind === 'belt') { const y = wy(G.gy(d.x1)); cx.fillStyle = '#3a3e46'; cx.fillRect(wx(d.x1), y - 5, (d.x2 - d.x1) * S, 12); cx.fillStyle = '#ffd23a'; const off = (t * -d.speed * S) % 30; for (let x = wx(d.x1) + off; x < wx(d.x2); x += 30) if (x > wx(d.x1)) cx.fillRect(x, y - 4, 12, 3); cx.fillStyle = '#fff'; cx.font = '900 14px sans-serif'; for (let x = d.x1 + 1; x < d.x2; x += 3) cx.fillText('◀◀', wx(x), y + 26); }
    if (d.kind === 'banana') { const x = wx((d.x1 + d.x2) / 2), y = wy(G.gy(d.x1)) - 4; cx.save(); cx.translate(x, y); cx.fillStyle = '#ffd84a'; cx.strokeStyle = '#7a5a00'; cx.lineWidth = 2; for (const a of [-0.8, 0, 0.8]) { cx.save(); cx.rotate(a); cx.beginPath(); cx.ellipse(0, -8, 5, 12, 0, 0, 7); cx.fill(); cx.stroke(); cx.restore(); } cx.restore(); }
  }
  for (const o of G.obst) {
    if (o.kind === 'bar') { const x = wx(o.x), b0 = o.y0 || 0; cx.fillStyle = '#222'; cx.fillRect(x - 6, wy(b0 + o.h) - 2, 12, o.h * S + 2); for (let k = 0; k < 4; k++) { cx.fillStyle = k % 2 ? '#222' : '#ffd23a'; cx.fillRect(x - 40 + k * 20, wy(b0 + o.h), 20, 8); } cx.fillStyle = '#ff6a3a'; cx.beginPath(); cx.moveTo(x - 50, wy(b0)); cx.lineTo(x - 42, wy(b0 + 0.3)); cx.lineTo(x - 34, wy(b0)); cx.fill(); }
    if (o.kind === 'person') { const p = o.body.getPosition(), a = o.body.getAngle(); cx.save(); cx.translate(wx(p.x), wy(p.y)); cx.rotate(-a); const s = S; cx.fillStyle = '#5a6272'; rr(-0.2 * s, -0.55 * s, 0.4 * s, 0.9 * s, 0.08 * s); cx.fill(); cx.fillStyle = '#3a3f4a'; cx.fillRect(-0.16 * s, 0.3 * s, 0.13 * s, 0.55 * s); cx.fillRect(0.03 * s, 0.3 * s, 0.13 * s, 0.55 * s); cx.fillStyle = '#f2c9a8'; cx.beginPath(); cx.arc(0, -0.7 * s, 0.14 * s, 0, 7); cx.fill(); cx.fillStyle = '#222'; cx.beginPath(); cx.arc(0, -0.75 * s, 0.14 * s, Math.PI, 0); cx.fill(); cx.fillStyle = '#fff'; cx.font = `900 ${0.12 * s}px sans-serif`; cx.textAlign = 'center'; cx.fillText('…', 0, -0.2 * s); cx.textAlign = 'start'; cx.restore(); }
  }
  // 距離の目もり
  cx.fillStyle = 'rgba(0,0,0,.45)'; cx.font = `900 ${Math.max(11, S * 0.11)}px "M PLUS Rounded 1c"`; cx.textAlign = 'center';
  for (let m = Math.max(0, Math.floor(camX - 4)); m <= Math.min(st.len, camX + 8); m++) { const y = wy(G.gy(m)); cx.fillRect(wx(m) - 1, y + 4, 2, 10); cx.fillText(m + 'm', wx(m), y + 30); }
  cx.textAlign = 'start';
  // ゴール（会社）
  const gx = wx(st.len), gyy = wy(G.goalY);
  if (gx < W + 400) {
    cx.fillStyle = theme === 'office' ? '#6b4a3a' : '#e8edf2'; cx.strokeStyle = '#1b1f2a'; cx.lineWidth = 3;
    rr(gx - 10, gyy - 2.6 * S, 2.6 * S, 2.6 * S, 8); cx.fill(); cx.stroke();
    cx.fillStyle = '#6aa8d8'; rr(gx + 0.25 * S, gyy - 2.1 * S, 0.9 * S, 2.1 * S, 4); cx.fill(); cx.stroke();
    cx.fillStyle = '#1b1f2a'; cx.font = `900 ${0.2 * S}px "M PLUS Rounded 1c"`; cx.fillText(theme === 'office' ? '社長室' : '株式会社ツーキン', gx + 0.05 * S, gyy - 2.25 * S);
    cx.fillStyle = '#ff4d5a'; cx.fillRect(gx - 12, gyy - 3.3 * S, 4, 0.75 * S); cx.beginPath(); cx.moveTo(gx - 8, gyy - 3.3 * S); cx.lineTo(gx + 0.6 * S, gyy - 3.1 * S); cx.lineTo(gx - 8, gyy - 2.9 * S); cx.fill();
    cx.fillStyle = '#fff'; cx.font = `900 ${0.16 * S}px sans-serif`; cx.fillText('GOAL', gx - 4, gyy - 3.06 * S);
  }
  // 足あとのつぶ
  for (const p of particles) { cx.globalAlpha = Math.max(0, p.life * 2); cx.fillStyle = p.c; cx.fillRect(wx(p.x) - 2, wy(p.y) - 2, 4, 4); } cx.globalAlpha = 1;
}
// 人の描画
const DIM = { torso: [0.16, 0.36], thigh: [0.075, 0.24], calf: [0.06, 0.2], foot: [0.13, 0.035], uarm: [0.05, 0.17], larm: [0.045, 0.16] };
function part(name, fill, dark) {
  const b = G.parts[name], p = b.getPosition(), a = b.getAngle(); const kind = name.replace(/[LR]$/, ''); const [hw, hh] = DIM[kind];
  cx.save(); cx.translate(wx(p.x), wy(p.y)); cx.rotate(-a);
  cx.fillStyle = dark ? shade(fill) : fill; cx.strokeStyle = '#1b1f2a'; cx.lineWidth = 2.5;
  rr(-hw * S, -hh * S, hw * 2 * S, hh * 2 * S, Math.min(hw, hh) * S * 0.9); cx.fill(); cx.stroke();
  if (kind === 'torso') { cx.fillStyle = '#fff'; cx.beginPath(); cx.moveTo(-0.02 * S, -hh * S); cx.lineTo(0.13 * S, -hh * S); cx.lineTo(0.06 * S, -0.05 * S); cx.closePath(); cx.fill(); cx.fillStyle = '#e8364a'; cx.beginPath(); cx.moveTo(0.05 * S, -hh * S + 4); cx.lineTo(0.09 * S, -hh * S + 4); cx.lineTo(0.08 * S, -0.08 * S); cx.lineTo(0.06 * S, -0.04 * S); cx.closePath(); cx.fill(); }
  if (kind === 'larm') { cx.fillStyle = '#f2c9a8'; cx.beginPath(); cx.arc(0, hh * S, 0.05 * S, 0, 7); cx.fill(); cx.stroke(); }
  cx.restore();
}
function shade(c) { const n = parseInt(c.slice(1), 16); const f = v => Math.round(v * 0.72); return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`; }
function drawMan() {
  const suit = '#2f3e66', pants = '#26324f', shoe = '#1b1f2a';
  // かばん（左手）
  part('uarmR', suit, true); part('larmR', suit, true);
  part('thighR', pants, true); part('calfR', pants, true); part('footR', shoe, true);
  part('torso', suit);
  // 頭
  const h = G.parts.head, hp = h.getPosition(), ha = h.getAngle();
  cx.save(); cx.translate(wx(hp.x), wy(hp.y)); cx.rotate(-ha); const r = 0.13 * S;
  cx.fillStyle = '#f2c9a8'; cx.strokeStyle = '#1b1f2a'; cx.lineWidth = 2.5; cx.beginPath(); cx.arc(0, 0, r, 0, 7); cx.fill(); cx.stroke();
  cx.fillStyle = '#1b1f2a'; cx.beginPath(); cx.arc(-0.01 * S, -0.02 * S, r * 1.02, Math.PI * 0.95, Math.PI * 1.95); cx.fill();
  const dead = state === 'fell';
  if (dead) { cx.strokeStyle = '#1b1f2a'; cx.lineWidth = 2; for (const ex of [0.03, 0.09]) { cx.beginPath(); cx.moveTo(ex * S - 4, 0.005 * S - 4); cx.lineTo(ex * S + 4, 0.005 * S + 4); cx.moveTo(ex * S + 4, 0.005 * S - 4); cx.lineTo(ex * S - 4, 0.005 * S + 4); cx.stroke(); } }
  else { cx.fillStyle = '#1b1f2a'; for (const ex of [0.035, 0.09]) { cx.beginPath(); cx.arc(ex * S, 0.005 * S, 2.6, 0, 7); cx.fill(); } }
  cx.strokeStyle = '#1b1f2a'; cx.lineWidth = 2; cx.beginPath(); if (dead) cx.arc(0.07 * S, 0.08 * S, 0.03 * S, Math.PI, 0); else cx.arc(0.07 * S, 0.05 * S, 0.025 * S, 0.2, Math.PI - 0.2); cx.stroke();
  // 汗
  if (!dead && started && Math.sin(performance.now() / 300) > 0) { cx.fillStyle = '#7fd0ff'; cx.beginPath(); cx.moveTo(-0.11 * S, -0.06 * S); cx.quadraticCurveTo(-0.15 * S, 0.0, -0.11 * S, 0.02 * S); cx.quadraticCurveTo(-0.07 * S, 0.0, -0.11 * S, -0.06 * S); cx.fill(); }
  cx.restore();
  part('thighL', pants); part('calfL', pants); part('footL', shoe);
  part('uarmL', suit); part('larmL', suit);
  // かばん
  const la = G.parts.larmL, lp = la.getWorldPoint(planck.Vec2(0, -0.2));
  cx.save(); cx.translate(wx(lp.x), wy(lp.y)); cx.rotate(-la.getAngle() * 0.3); cx.fillStyle = '#6b4a2a'; cx.strokeStyle = '#1b1f2a'; cx.lineWidth = 2.5; rr(-0.16 * S, 0.0, 0.32 * S, 0.22 * S, 5); cx.fill(); cx.stroke(); cx.restore();
}
function draw(t) {
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  S = Math.max(60, Math.min(170, Math.min(H / 4.6, W / 5.2)));
  const th = themeNow();
  if (shake > 0) cx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake);
  drawBG(th, t);
  if (G) { drawWorld(t); drawMan(); }
  // 突風の表示
  if (G && G.windOn && state === 'play') { const ph = G.windPhase; if (ph > 3.1) { cx.fillStyle = ph > 3.8 ? 'rgba(255,77,90,.9)' : 'rgba(255,200,60,.9)'; cx.font = `900 ${Math.max(18, S * 0.22)}px "M PLUS Rounded 1c"`; cx.textAlign = 'center'; cx.fillText(ph > 3.8 ? '🌀 突風！ ふんばれ！' : '⚠ 突風がくる…', W / 2, H * 0.24); cx.textAlign = 'start'; } }
  if (G && G.windOn) { cx.strokeStyle = 'rgba(255,255,255,.6)'; cx.lineWidth = 2; const k = G.gust ? 1 : 0.3; for (let i = 0; i < 18 * k + 4; i++) { const x = W - ((i * 151 + t * 700 * (k + 0.3)) % (W + 200)), y = (i * 89) % (H * 0.8); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + 50 + k * 40, y + 2); cx.stroke(); } }
}

// ---------- ループ ----------
let last = performance.now(), T0 = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state !== 'menu' && state !== 'intro') update(dt); else if (G) update(0);
  draw((now - T0) / 1000);
}
requestAnimationFrame(loop);
showTitle();
if (window.GAMES_RANK) { GAMES_RANK.mount('shushae', { left: 'max(10px, env(safe-area-inset-left))', bottom: 'max(10px, env(safe-area-inset-bottom))' }, () => state !== 'title'); rankReport(true); }
window.SHUSHA = { SV, get G() { return G; }, keys, setKey, intro, goStage, get state() { return state; } };
