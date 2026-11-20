// ティア読み：通信・進行・画面
// 部屋をつくった人（ホスト）がゲームを進めて、みんなに「その人から見える中身」を送る（ナゾトキ探偵と同じ形）
// 流れ（並び当て）：ロビー → あそびを選ぶ → きみの正解をつくる（全員同時）→［ターン紹介 → 予想 → 結果発表］×人数 → セッション終了
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const D = window.TIER_DATA, T = window.TIER, TIERS = T.TIERS, N5 = T.WORDS_PER_ROUND;
  const qp = k => { try { return new URLSearchParams(location.search).get(k); } catch (e) { return null; } };
  const FAST = Math.max(1, +qp('fast') || 1), BOT = qp('bot') === '1';
  const PREFIX = 'tieryomi-room-';
  const MAXP = { party: 10, all: 10, stream: 31 };
  const MODE_NAME = { party: '並び当て', all: '全員一致', stream: '配信者モード' };
  const CPU_NAMES = ['ボットあお', 'ボットもも', 'ボットきい', 'ボットみどり', 'ボットしろ', 'ボットそら', 'ボットはな', 'ボットゆず', 'ボットくろ'];
  const REACTS = ['😂', '😮', '👏', '😱', '🤔', '❤️'];
  const AVC = ['#3f7cff', '#ff6a3d', '#f2b705', '#17a596', '#8f6bff', '#ff6fa8', '#38b24f', '#ff9020', '#5a5ad6', '#d6455a', '#2fb3d9', '#b06a3b'];
  const GNAME = Object.fromEntries(D.genres.map(g => [g.id, g.name]));

  // ================= セーブ =================
  const SAVE_K = 'tier-yomi-v1';
  const blank = () => ({ name: '', custom: [], bring: true, mute: false, stats: { games: 0, rounds: 0, hits: 0, perfect: 0, mainRounds: 0, allSame: 0 }, counted: [] });
  let SV = blank();
  try { const s = JSON.parse(localStorage.getItem(SAVE_K) || 'null'); if (s && typeof s === 'object') SV = Object.assign(blank(), s, { stats: Object.assign(blank().stats, s.stats || {}) }); } catch (e) {}
  const save = () => { try { localStorage.setItem(SAVE_K, JSON.stringify(SV)); } catch (e) {} };
  const myName = () => (($('nm').value || '').trim() || SV.name || (window.GAMES_ACC && GAMES_ACC.name()) || 'ななし').slice(0, 10);
  const rankReport = () => { if (window.GAMES_RANK) GAMES_RANK.report('tier', SV.stats.hits); };

  // ================= 音 =================
  let AC = null;
  function ac() { if (SV.mute) return null; if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (AC.state === 'suspended') AC.resume(); return AC; }
  function tone(f, at, dur, type, vol, f2) {
    const c = ac(); if (!c) return; const t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.15, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(at, dur, freq, vol, q) {
    const c = ac(); if (!c) return; const t = c.currentTime + (at || 0), n = Math.floor(c.sampleRate * dur), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / (c.sampleRate / (7 + Math.random() * 6))));
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.05);
  }
  const SFX = {
    pick() { tone(660, 0, 0.07, 'triangle', 0.1, 880); },
    swap() { tone(520, 0, 0.06, 'triangle', 0.1, 780); tone(780, 0.05, 0.06, 'triangle', 0.08); },
    tick() { tone(1200, 0, 0.04, 'square', 0.04); },
    lock() { tone(880, 0, 0.08, 'square', 0.06); tone(1320, 0.07, 0.12, 'square', 0.06); },
    o() { tone(988, 0, 0.12, 'triangle', 0.13); tone(1318, 0.06, 0.16, 'triangle', 0.1); },
    x() { tone(220, 0, 0.12, 'square', 0.05, 180); },
    perfect() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.08, 0.5, 'square', 0.07)); noise(0.1, 2.2, 1300, 0.2, 0.5); noise(0.2, 2, 2600, 0.08, 0.7); },
    cheer(n) { noise(0, 0.8 + n * 0.2, 1400, 0.06 + n * 0.02, 0.6); },
    whoosh() { noise(0, 0.5, 900, 0.12, 0.4); tone(300, 0, 0.4, 'sine', 0.08, 900); },
    start() { [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.22, 'triangle', 0.12)); },
    fanfare() { [[523, 0], [659, 0.15], [784, 0.3], [1046, 0.45], [784, 0.62], [1046, 0.78]].forEach(([f, a]) => tone(f, a, 0.32, 'square', 0.07)); noise(0.5, 2.5, 1300, 0.16, 0.5); },
    react() { tone(880, 0, 0.06, 'sine', 0.05, 1320); },
  };
  const muteIcon = () => SV.mute ? '🔇' : '🔊';
  function toggleMute() { SV.mute = !SV.mute; save(); document.querySelectorAll('.muteb, #muteBtn').forEach(b => { b.textContent = muteIcon(); }); if (!SV.mute) SFX.pick(); }
  $('muteBtn').textContent = muteIcon(); $('muteBtn').onclick = toggleMute;

  // ================= 紙吹雪・マーキー =================
  const cv = $('fx'), cx = cv.getContext('2d'); let parts = [], fxOn = false;
  function fit() { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; }
  addEventListener('resize', fit); fit();
  const COLS = ['#ffd60a', '#ffffff', '#c6e3ff', '#1d1b22', '#ff9fb4'];
  function confetti(n, x, y) {
    x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight * 0.35 : y;
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4, v = 6 + Math.random() * 9; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 7, h: 5 + Math.random() * 6, c: COLS[i % COLS.length], life: 120 + Math.random() * 60 }); }
    if (!fxOn) { fxOn = true; requestAnimationFrame(fxLoop); }
  }
  function rain(n) { for (let i = 0; i < n; i++) parts.push({ x: Math.random() * innerWidth, y: -10 - Math.random() * 200, vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 2, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, w: 7 + Math.random() * 6, h: 6 + Math.random() * 5, c: COLS[i % COLS.length], life: 400 }); if (!fxOn) { fxOn = true; requestAnimationFrame(fxLoop); } }
  function fxLoop() {
    const k = devicePixelRatio; cx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter(p => p.life > 0 && p.y < innerHeight + 30);
    for (const p of parts) { p.vy += 0.2; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life--; cx.save(); cx.translate(p.x * k, p.y * k); cx.rotate(p.r); cx.fillStyle = p.c; cx.strokeStyle = '#1d1b22'; cx.lineWidth = k; cx.globalAlpha = Math.min(1, p.life / 40); const w = p.w * k, h = p.h * k * Math.abs(Math.cos(p.r * 2)); cx.fillRect(-w / 2, -h / 2, w, h); cx.strokeRect(-w / 2, -h / 2, w, h); cx.restore(); }
    if (parts.length) requestAnimationFrame(fxLoop); else { fxOn = false; cx.clearRect(0, 0, cv.width, cv.height); }
  }
  function marquee() {
    const d = document.createElement('div'); d.className = 'marq';
    const a = 'GUESS THE TIER ★ ティア読み ★ '.repeat(12), b = 'TIER YOMI ★ ティア読み ★ '.repeat(10);
    d.innerHTML = `<div class="ln a"><span>${a}</span></div><div class="ln b"><span>${b}</span></div><div class="ln c"><span>${a}</span></div>`;
    document.body.appendChild(d); SFX.whoosh(); setTimeout(() => d.remove(), 1550);
  }

  // ================= 通信（ナゾトキ探偵と同じ設定） =================
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

  // ================= ホスト：ゲームの進行 =================
  let H = null, peer = null, hostConn = null, view = null, viewAt = 0, pingT = 0;
  const R0 = T.rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
  function newRoom(code, local) {
    H = { code, local, mode: 'party', opts: { laps: 1, rounds: 5, time: 180, genres: D.genres.map(g => g.id), useCustom: true },
      players: [], phase: 'lobby', conns: {}, used: new Set(), reacts: [], rk: 0, rid: 0, colN: 0,
      order: [], lap: 0, turnNo: 0, turnTotal: 0, made: {}, R: null, hist: [], allHist: [], sum: null, deadline: 0, tm: [] };
  }
  const later = (f, ms) => { const t = setTimeout(f, ms / FAST); H.tm.push(t); return t; };
  const clearTimers = () => { if (H) { H.tm.forEach(clearTimeout); H.tm = []; clearInterval(H.stepT); } };
  function addPlayer(name, cpu, conn, custom) {
    const pid = 'p' + Math.random().toString(36).slice(2, 9);
    let nm = (name || 'ななし').slice(0, 10);
    if (H.players.some(p => p.name === nm)) { let k = 2; while (H.players.some(p => p.name === nm.slice(0, 8) + k)) k++; nm = nm.slice(0, 8) + k; }
    H.players.push({ pid, name: nm, cpu: !!cpu, on: true, ready: !!cpu, col: AVC[H.colN++ % AVC.length], seen: Date.now(), custom: T.cleanCustom(custom || [], nm) });
    if (conn) H.conns[pid] = conn;
    return pid;
  }
  function addCpu() { if (H.players.length >= MAXP[H.mode]) return; const used = new Set(H.players.map(p => p.name)); addPlayer(CPU_NAMES.find(n => !used.has(n)) || 'ボット', true); }
  const pidx = pid => H.players.findIndex(p => p.pid === pid);
  const byPid = pid => H.players.find(p => p.pid === pid);
  const active = () => H.players.filter(p => p.on);
  const customPool = () => H.players.filter(p => p.on && !p.cpu).flatMap(p => p.custom || []);
  function reindex() { for (const pid in H.conns) { const c = H.conns[pid]; c._pi = pidx(pid); if (c._pi < 0) delete H.conns[pid]; } }
  const topicOpts = () => ({ genres: H.opts.genres, custom: customPool(), useCustom: H.opts.useCustom });
  const pickTopic = () => T.pickRound(D, topicOpts(), R0, H.used) || T.pickRound(D, { genres: [] }, R0, H.used);

  function startSession() {
    clearTimers();
    H.players = H.players.filter(p => p.on); reindex();
    while (H.players.length < 3) addCpu();
    H.hist = []; H.allHist = []; H.sum = null; H.lap = 0; H.turnNo = 0; H.reacts = [];
    if (H.mode === 'party') {
      H.order = H.players.map(p => p.pid);
      for (let i = H.order.length - 1; i > 0; i--) { const j = Math.floor(R0() * (i + 1)); [H.order[i], H.order[j]] = [H.order[j], H.order[i]]; }
      H.turnTotal = H.order.length * H.opts.laps;
      beginMake(H.order);
    } else if (H.mode === 'stream') { H.turnTotal = H.opts.rounds; beginMake([H.players[0].pid]); }
    else { H.turnTotal = H.opts.rounds; startAllRound(); }
  }
  // ---- きみの正解をつくる ----
  function beginMake(pids) {
    H.phase = 'make'; H.made = {}; H.deadline = 0; H.R = null;
    for (const pid of pids) { const p = byPid(pid); if (!p || !p.on) continue; newMade(p); }
    broadcast();
  }
  function newMade(p, rerolls) {
    const t = pickTopic(), m = Object.assign({}, t, { order: T.shuffled(R0, N5), done: false, rerolls: rerolls || 0, by: t.set === 'custom' ? (t.setName || '').replace(/の自作お題$/, '') : '' });
    H.made[p.pid] = m;
    if (p.cpu) later(() => { if (H && H.phase === 'make' && H.made[p.pid] === m) { m.order = T.botRank(m.topic, m.words, T.rng(T.hash(p.pid + m.topic)), 0.85); m.done = true; checkMade(); broadcast(); } }, 1200 + R0() * 3500);
  }
  function checkMade() {
    if (H.phase !== 'make') return;
    const ms = Object.entries(H.made).filter(([pid]) => { const p = byPid(pid); return p && p.on; });
    if (ms.length && ms.every(([, m]) => m.done)) later(() => { if (H.phase === 'make') nextTurn(true); }, 600);
  }
  // ---- ターン ----
  function nextTurn(fromMake) {
    clearTimers();
    if (H.mode === 'party') {
      // この周で、まだ主役をやっていなくて正解をつくった人
      while (true) {
        const k = H.turnNo - H.lap * H.order.length;
        if (k >= H.order.length) { H.lap++; if (H.lap >= H.opts.laps) return finish(); return beginMake(H.order); }
        const pid = H.order[k], m = H.made[pid], p = byPid(pid);
        H.turnNo++;
        if (p && p.on && m && m.done) return startTurn(pid, m);
      }
    }
    if (H.mode === 'stream') {
      if (!fromMake) { if (H.turnNo >= H.turnTotal) return finish(); return beginMake([H.players[0].pid]); }
      const pid = H.players[0].pid; H.turnNo++; return startTurn(pid, H.made[pid]);
    }
    if (H.turnNo >= H.turnTotal) return finish();
    startAllRound();
  }
  function startTurn(pid, m) {
    H.R = { id: ++H.rid, kind: 'rank', main: pid, topic: m.topic, setName: m.setName, g: m.g, by: m.by, words: m.words, answer: T.orderToTiers(m.order), boards: {}, done: {}, step: -1, res: null };
    intro();
  }
  function startAllRound() {
    const t = T.pickAllTopic(D, topicOpts(), R0, H.used), act = active();
    H.turnNo++;
    H.R = { id: ++H.rid, kind: 'all', main: null, topic: t.topic, setName: t.setName, g: 'all', words: act.map(p => p.name), wpids: act.map(p => p.pid), boards: {}, done: {}, step: -1, res: null };
    intro();
  }
  function intro() { H.phase = 'intro'; H.deadline = 0; broadcast(); later(() => { if (H.phase === 'intro') beginPlace(); }, 6500); }
  const guessers = () => active().filter(p => p.pid !== H.R.main);
  function beginPlace() {
    clearTimers();
    const R = H.R; H.phase = 'place';
    H.deadline = H.opts.time ? Date.now() + H.opts.time * 1000 / FAST : 0;
    for (const p of guessers()) {
      if (!p.cpu) continue; const rid = R.id, rr = T.rng(T.hash(p.pid + rid));
      later(() => {
        if (!H || !H.R || H.R.id !== rid || H.phase !== 'place') return;
        R.boards[p.pid] = R.kind === 'all' ? T.botBoard(R.topic, R.words, rr, 0.55) : T.orderToTiers(T.botRank(R.topic, R.words, rr, 0.45));
        R.done[p.pid] = true; checkDone(); broadcast();
      }, 2500 + R0() * 9000);
    }
    broadcast();
  }
  function checkDone() { if (H.phase === 'place' && guessers().every(p => H.R.done[p.pid])) result(); }
  const isPerm = b => Array.isArray(b) && b.length === N5 && new Set(b).size === N5 && b.every(x => Number.isInteger(x) && x >= 0 && x < N5);
  const clean = (b, n) => { const out = []; for (let i = 0; i < n; i++) { const v = Array.isArray(b) ? b[i] : -1; out.push(Number.isInteger(v) && v >= 0 && v <= 4 ? v : -1); } return out; };
  function result() {
    clearTimers();
    const R = H.R; H.phase = 'result'; H.deadline = 0;
    if (R.kind === 'all') {
      const boards = {}; for (const p of H.players) { const b = R.boards[p.pid]; if (b && b.some(x => x >= 0)) boards[p.pid] = clean(b, R.words.length); }
      R.res = Object.assign({ boards }, T.scoreAll(boards, R.words.length));
      H.allHist.push({ boards, n: R.words.length, same: R.res.same });
    } else {
      const cols = [];
      for (const p of H.players) { if (p.pid === R.main) continue; const b = R.boards[p.pid]; if (!b) continue; const m = T.matchCount(R.answer, b); cols.push({ pid: p.pid, t: b, m, pf: m === N5 }); }
      R.res = { cols };
      H.hist.push({ main: R.main, n: N5, guesses: Object.fromEntries(cols.map(c => [c.pid, c.m])) });
    }
    R.step = 0; broadcast();
    const n = R.words.length;
    H.stepT = setInterval(() => { if (!H || H.R !== R) return; R.step++; broadcast(); if (R.step >= n) clearInterval(H.stepT); }, (R.kind === 'all' ? 900 : 800) / FAST);
  }
  function finish() {
    clearTimers(); H.phase = 'final'; H.deadline = 0; H.R = null;
    if (H.mode === 'all') {
      let same = 0, n = 0; const pair = {};
      for (const h of H.allHist) { same += h.same; n += h.n; const ids = Object.keys(h.boards); for (let a = 0; a < ids.length; a++) for (let b = a + 1; b < ids.length; b++) { const k = [ids[a], ids[b]].sort().join('|'); pair[k] = pair[k] || [0, 0]; for (let j = 0; j < h.n; j++) { pair[k][1]++; if (h.boards[ids[a]][j] === h.boards[ids[b]][j]) pair[k][0]++; } } }
      let bp = null; for (const [k, v] of Object.entries(pair)) if (!bp || v[0] / v[1] > bp[1][0] / bp[1][1]) bp = [k, v];
      H.sum = { kind: 'all', rounds: H.allHist.length, same, n, rate: n ? same / n : 0, perfect: H.allHist.filter(h => h.same === h.n).length, pair: bp && { a: bp[0].split('|')[0], b: bp[0].split('|')[1], rate: bp[1][0] / bp[1][1] } };
    } else H.sum = Object.assign({ kind: 'rank', turns: H.hist.length }, T.summary(H.hist));
    broadcast();
  }

  // プレイヤー（ホスト自身は 0）からの操作
  function act(pi, a) {
    const p = H.players[pi]; if (!p || !a) return; const R = H.R, host = pi === 0, ph = H.phase, m = H.made[p.pid];
    switch (a.t) {
      case 'ready': if (ph === 'lobby') p.ready = !p.ready; break;
      case 'mkdraft': if (ph === 'make' && m && !m.done && isPerm(a.o)) m.order = a.o.slice(); return;
      case 'mklock': if (ph === 'make' && m && isPerm(a.o)) { m.order = a.o.slice(); m.done = true; checkMade(); } break;
      case 'mkunlock': if (ph === 'make' && m) m.done = false; break;
      case 'mkreroll': if (ph === 'make' && m && !m.done && m.rerolls < 3) newMade(p, m.rerolls + 1); break;
      case 'draft': if (ph === 'place' && R && a.rid === R.id && !R.done[p.pid] && p.pid !== R.main) { if (R.kind === 'all') R.boards[p.pid] = clean(a.b, R.words.length); else if (isPerm(a.o)) R.boards[p.pid] = T.orderToTiers(a.o); } return;
      case 'submit':
        if (ph === 'place' && R && a.rid === R.id && p.pid !== R.main) {
          if (R.kind === 'all') { const b = clean(a.b, R.words.length); if (!b.every(x => x >= 0)) return; R.boards[p.pid] = b; }
          else { if (!isPerm(a.o)) return; R.boards[p.pid] = T.orderToTiers(a.o); }
          R.done[p.pid] = true; checkDone();
        } break;
      case 'unsubmit': if (ph === 'place' && R && a.rid === R.id) delete R.done[p.pid]; break;
      case 'react': if (REACTS.includes(a.e)) { H.reacts.push({ k: ++H.rk, n: p.name, e: a.e }); if (H.reacts.length > 12) H.reacts.shift(); } break;
      case 'custom': p.custom = T.cleanCustom(a.list, p.name); break;
      default:
        if (!host) return;
        if (a.t === 'select' && ph === 'lobby') H.phase = 'select';
        else if (a.t === 'tolobby' && (ph === 'select' || ph === 'final')) { H.phase = 'lobby'; H.players = H.players.filter(x => x.on); reindex(); H.players.forEach(x => { x.ready = x.cpu || x === H.players[0]; }); }
        else if (a.t === 'mode' && ph === 'select' && MAXP[a.m]) { if (H.players.length > MAXP[a.m]) { toast(`${MODE_NAME[a.m]}は${MAXP[a.m]}人までだよ`); return; } H.mode = a.m; }
        else if (a.t === 'opts' && ph === 'select') { const o = a.o || {}; if ([1, 2, 3].includes(o.laps)) H.opts.laps = o.laps; if ([3, 5, 10].includes(o.rounds)) H.opts.rounds = o.rounds; if ([0, 60, 120, 180].includes(o.time)) H.opts.time = o.time; if (Array.isArray(o.genres) && o.genres.length) H.opts.genres = o.genres.filter(g => GNAME[g]); if (typeof o.useCustom === 'boolean') H.opts.useCustom = o.useCustom; }
        else if (a.t === 'addcpu' && (ph === 'lobby' || ph === 'select')) addCpu();
        else if (a.t === 'delcpu' && ph === 'lobby') { const k = pidx(a.pid); if (k > 0 && H.players[k].cpu) { H.players.splice(k, 1); reindex(); } }
        else if (a.t === 'start' && ph === 'select') { startSession(); return; }
        else if (a.t === 'go' && ph === 'intro') { beginPlace(); return; }
        else if (a.t === 'force' && ph === 'place') { result(); return; }
        else if (a.t === 'forcemake' && ph === 'make') { for (const mm of Object.values(H.made)) mm.done = true; nextTurn(true); return; }
        else if (a.t === 'next' && ph === 'result') { if (R && R.step < R.words.length) { R.step = R.words.length; clearInterval(H.stepT); } else { nextTurn(false); return; } }
        else if (a.t === 'end' && ph !== 'lobby' && ph !== 'select' && ph !== 'final') { finish(); return; }
        else if (a.t === 'again' && ph === 'final') { startSession(); return; }
        else return;
    }
    broadcast();
  }

  function viewFor(i) {
    const me = H.players[i], R = H.R, ph = H.phase;
    const v = { code: H.code, local: H.local, mode: H.mode, opts: H.opts, phase: ph, me: i, turnNo: H.turnNo, turnTotal: H.turnTotal, lap: H.lap,
      left: H.deadline ? Math.max(0, H.deadline - Date.now()) : 0, reacts: H.reacts, customN: customPool().length,
      players: H.players.map(p => ({ name: p.name, cpu: p.cpu, on: p.on, ready: p.ready, col: p.col, pid: p.pid })) };
    if (ph === 'make') {
      const ms = Object.entries(H.made);
      v.make = { total: ms.length, done: ms.filter(([, m]) => m.done).map(([pid]) => pidx(pid)), makers: ms.map(([pid]) => pidx(pid)) };
      const m = H.made[me.pid]; if (m) v.make.my = { topic: m.topic, setName: m.setName, g: m.g, by: m.by, words: m.words, order: m.order, done: m.done, rerolls: m.rerolls, key: m.topic + '|' + m.words.join() };
    }
    if (R && (ph === 'intro' || ph === 'place' || ph === 'result')) {
      const gs = guessers();
      v.R = { id: R.id, kind: R.kind, main: R.main ? pidx(R.main) : -1, topic: R.topic, setName: R.setName, g: R.g, by: R.by, words: R.words, step: R.step,
        guessers: gs.map(p => pidx(p.pid)), done: gs.filter(p => R.done[p.pid]).map(p => pidx(p.pid)),
        myBoard: R.boards[me.pid] || null, myDone: !!R.done[me.pid] };
      if (R.main === me.pid || ph === 'result') v.R.answer = R.answer;
      if (ph === 'result' && R.res) {
        if (R.kind === 'all') v.R.res = { boards: Object.fromEntries(Object.entries(R.res.boards).map(([pid, b]) => [pidx(pid), b])), res: R.res.res, same: R.res.same, rate: R.res.rate, perfect: R.res.perfect };
        else v.R.res = { cols: R.res.cols.map(c => ({ i: pidx(c.pid), t: c.t, m: c.m, pf: c.pf })) };
      }
    }
    if (ph === 'final' && H.sum) {
      const s = H.sum, P = pid => pidx(pid);
      v.sum = s.kind === 'all' ? Object.assign({}, s, { pair: s.pair && { a: P(s.pair.a), b: P(s.pair.b), rate: s.pair.rate } })
        : { kind: 'rank', turns: s.turns, hit: s.hit, all: s.all, rate: s.rate,
          pair: s.pair && { a: P(s.pair.a), b: P(s.pair.b), rate: s.pair.rate }, reader: s.reader && { i: P(s.reader.pid), rate: s.reader.rate },
          detective: s.detective && { i: P(s.detective.pid), hit: s.detective.hit }, perf: Object.entries(s.perf).map(([pid, n]) => [P(pid), n]),
          det: Object.entries(s.det).map(([pid, n]) => [P(pid), n]).sort((a, b) => b[1] - a[1]) };
    }
    return v;
  }
  function broadcast() {
    if (!H) return;
    H.players.forEach((p, i) => { const c = H.conns[p.pid]; if (c && p.on && i > 0) { try { c.send({ t: 'view', v: viewFor(i) }); } catch (e) {} } });
    gotView(viewFor(0));
  }
  setInterval(() => {
    if (!H) return;
    if (H.phase === 'place' && H.deadline && Date.now() >= H.deadline) { result(); return; }
    if (H.phase === 'place' && H.deadline && (Date.now() / 1000 | 0) % 5 === 0) broadcast();
  }, 1000);

  // ================= 部屋をつくる・入る =================
  async function host(local) {
    const name = myName(); if ($('nm').value.trim()) { SV.name = name; save(); }
    if (local) {
      newRoom('----', true); if (MAXP[qp('mode')]) H.mode = qp('mode');
      addPlayer(name, false, null, SV.bring ? SV.custom : []); H.players[0].ready = true;
      addCpu(); addCpu(); addCpu(); for (let k = Math.min(30, +qp('cpus') || 0); k > 0; k--) addCpu();
      broadcast(); return;
    }
    msg('部屋を作っています…');
    try {
      await loadPeerJS();
      let code = null;
      for (let k = 0; k < 6 && !peer; k++) { const c = String(1000 + Math.floor(Math.random() * 9000)); try { peer = await openPeer(PREFIX + c); code = c; } catch (e) { if (e.type !== 'unavailable-id') throw e; } }
      if (!peer) throw new Error('部屋を作れなかった');
      newRoom(code, false); addPlayer(name, false, null, SV.bring ? SV.custom : []);
      peer.on('connection', c => c.on('open', () => {
        if (c._opened) return; c._opened = 1;
        c.on('data', d => {
          if (!H) return;
          if (d.t === 'hello') {
            if (c._pi != null) return;
            const back = H.players.findIndex(p => !p.cpu && !p.on && p.name === d.name);
            if (back >= 0) { const p = H.players[back]; H.conns[p.pid] = c; p.on = true; p.seen = Date.now(); p.custom = T.cleanCustom(d.custom, p.name); c._pi = back; }
            else {
              if (H.players.length >= MAXP[H.mode]) { const k = H.players.map(p => p.cpu).lastIndexOf(true); if (k > 0 && H.phase === 'lobby') { H.players.splice(k, 1); reindex(); } else { c.send({ t: 'full', why: '満員です' }); return; } }
              const pid = addPlayer(String(d.name || 'ゲスト'), false, c, d.custom); c._pi = pidx(pid);
            }
            broadcast(); return;
          }
          if (c._pi == null || c._dead) return;
          const pl = H.players[c._pi]; if (pl) pl.seen = Date.now();
          if (d.t === 'ping') return;
          act(c._pi, d);
        });
        const gone = () => { if (c._pi == null || c._dead) return; dropped(c._pi); };
        c.on('close', gone);
        try { c.peerConnection.addEventListener('iceconnectionstatechange', () => { const st = c.peerConnection.iceConnectionState; if (st === 'failed' || st === 'closed') gone(); }); } catch (e) {}
      }));
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
      msg(''); broadcast();
    } catch (e) { msg('部屋を作れなかった（' + (e.type || e.message) + '）'); }
  }
  function dropped(pi) {
    const p = H && H.players[pi]; if (!p || p.cpu || !p.on || pi === 0) return;
    p.on = false; const c = H.conns[p.pid]; if (c) { c._dead = 1; try { c.close(); } catch (e) {} }
    if (H.phase === 'lobby' || H.phase === 'select') { H.players.splice(pi, 1); reindex(); }
    else if (H.phase === 'make') checkMade();
    else if (H.phase === 'place' || H.phase === 'intro') { if (H.R && H.R.main === p.pid) nextTurn(false); else checkDone(); }
    broadcast();
  }
  setInterval(() => { if (!H || H.local) return; const now = Date.now(); H.players.forEach((p, i) => { if (!p.cpu && p.on && i > 0 && now - (p.seen || now) > 9000) dropped(i); }); }, 1000);
  async function join(codeIn) {
    const code = String(codeIn || $('code').value || '').replace(/\D/g, ''); if (code.length !== 4) return msg('4けたの部屋番号を入れてね');
    const name = myName(); if ($('nm').value.trim()) { SV.name = name; save(); }
    msg('つないでいます…');
    clearInterval(pingT); try { if (hostConn) hostConn.close(); } catch (e) {} try { if (peer) peer.destroy(); } catch (e) {} peer = null; hostConn = null; view = null;
    try {
      await loadPeerJS(); peer = await openPeer(null);
      const c = peer.connect(PREFIX + code, { reliable: true });
      const t = setTimeout(() => { if (!view) msg('部屋が見つからない（番号を確かめてね）'); }, 10000);
      peer.on('error', e => { if (e.type === 'peer-unavailable') { clearTimeout(t); msg('部屋が見つからない（番号を確かめてね）'); } });
      c.on('open', () => { clearTimeout(t); if (hostConn) return; hostConn = c; c.send({ t: 'hello', name, custom: SV.bring ? SV.custom : [] }); clearInterval(pingT); pingT = setInterval(() => { try { if (hostConn && hostConn.open) hostConn.send({ t: 'ping' }); } catch (e) {} }, 2500); });
      c.on('data', d => { if (d.t === 'view') { msg(''); gotView(d.v); } if (d.t === 'full') { c._full = 1; msg('入れなかった：' + d.why); setTimeout(() => { clearInterval(pingT); try { c.close(); } catch (e) {} try { if (peer) peer.destroy(); } catch (e) {} peer = null; hostConn = null; }, 300); } });
      c.on('close', () => { if (c._full || hostConn !== c) return; msg('ホストとの通信が切れた'); view = null; showHome(); });
    } catch (e) { msg('つなげなかった（' + (e.type || e.message) + '）'); }
  }
  addEventListener('pagehide', () => { try { if (hostConn) hostConn.close(); if (peer) peer.destroy(); } catch (e) {} });
  function send(a) { if (H) act(0, a); else if (hostConn) { try { hostConn.send(a); } catch (e) {} } }
  function leave() {
    if (H) { clearTimers(); H = null; }
    try { if (hostConn) hostConn.close(); } catch (e) {} try { if (peer) peer.destroy(); } catch (e) {}
    clearInterval(pingT); peer = null; hostConn = null; view = null; showHome();
  }

  // ================= 画面 =================
  const msg = t => { $('msg').textContent = t; };
  let toastT = 0;
  function toast(t) { msg(t); clearTimeout(toastT); toastT = setTimeout(() => msg(''), 2500); if (view) { const d = document.createElement('div'); d.className = 'floaty'; d.style.cssText = 'left:50%;bottom:120px;transform:translateX(-50%);font-size:1rem;background:#fffbef;border:2.5px solid #1d1b22;border-radius:12px;padding:6px 12px;font-weight:900'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2400); } }
  function showHome() { $('home').hidden = false; $('room').hidden = true; $('reacts').hidden = true; $('muteBtn').textContent = muteIcon(); drawStats(); }
  function drawStats() { const s = SV.stats; $('stats').innerHTML = [[s.games, 'セッション'], [s.rounds, 'ターン'], [s.hits, 'ピタリ'], [s.perfect, 'パーフェクト']].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join(''); }

  // 下書き（並べている途中のもの）
  let draft = null, draftKey = '', sel = null, lastSig = '', seenReact = 0, hideCode = true, draftT = 0, lastRid = 0, lastStep = -1, popupI = null;
  function gotView(v) {
    const prev = view; view = v; viewAt = Date.now();
    let key = '', src = null;
    if (v.phase === 'make' && v.make && v.make.my) { key = 'mk' + v.make.my.key; src = v.make.my.order; }
    else if (v.R && (v.phase === 'place' || v.phase === 'intro') && v.R.main !== v.me) {
      key = 'pl' + v.R.id;
      if (v.R.kind === 'all') src = v.R.myBoard || v.R.words.map(() => -1);
      else src = v.R.myBoard ? T.tiersToOrder(v.R.myBoard) : T.shuffled(T.rng(v.R.id * 31 + v.me), N5);
    }
    if (key !== draftKey) { draftKey = key; draft = src ? src.slice() : null; sel = null; }
    else if (v.phase === 'make' && v.make && v.make.my && v.make.my.done) draft = v.make.my.order.slice();
    if (v.R && v.phase === 'intro' && v.R.id !== lastRid) { lastRid = v.R.id; marquee(); }
    if (!prev || prev.phase !== v.phase) { if (v.phase === 'place' || v.phase === 'make') SFX.start(); if (v.phase === 'final') { SFX.fanfare(); rain(180); countFinal(v); } }
    if (v.phase !== 'result') popupI = null;
    countStats(v); showReacts(v); render();
    if (v.phase === 'result') stepFx(v);
  }
  // 自分のせんせき（ターンごとに1回だけ数える）
  function countStats(v) {
    const R = v.R; if (!R || !R.res || v.phase !== 'result' || R.step < R.words.length) return;
    const key = (v.players[0] && v.players[0].pid) + ':' + R.id; if (SV.counted.includes(key)) return;
    SV.counted.push(key); if (SV.counted.length > 80) SV.counted = SV.counted.slice(-80);
    SV.stats.rounds++;
    if (R.kind === 'all') { if (R.res.perfect) SV.stats.allSame++; }
    else { const c = R.res.cols.find(x => x.i === v.me); if (c) { SV.stats.hits += c.m; if (c.pf) SV.stats.perfect++; } if (R.main === v.me) SV.stats.mainRounds++; }
    save(); rankReport();
  }
  let finalKey = '';
  function countFinal(v) { const key = (v.players[0] && v.players[0].pid) + ':' + v.turnNo + ':' + (v.sum && v.sum.hit); if (finalKey === key) return; finalKey = key; SV.stats.games++; save(); }

  const timeLeft = () => view && view.left ? Math.max(0, Math.ceil((view.left - (Date.now() - viewAt)) / 1000)) : 0;
  let lastLeft = -1;
  setInterval(() => {
    const el = $('timer'); if (!el || !view) return; const s = timeLeft();
    el.hidden = !(view.phase === 'place' && view.left);
    el.innerHTML = `のこり<b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b>`;
    el.classList.toggle('hurry', s > 0 && s <= 10);
    if (view.phase === 'place' && s !== lastLeft && s > 0 && s <= 5) SFX.tick();
    lastLeft = s;
  }, 250);

  const P = (v, i) => v.players[i] || { name: '？', col: '#999' };
  const av = (v, i, cls = '') => { const p = P(v, i); return `<span class="av ${cls}" style="background:${p.col}">${esc([...p.name][0] || '？')}</span>`; };
  const genreLabel = R => R.g === 'custom' ? `ジャンル：カスタム${R.by ? `・${esc(R.by)}さんのお題` : ''}` : R.g === 'all' ? 'ジャンル：全員一致' : `ジャンル：${esc(R.setName)}`;
  const tl = k => `<span class="tl tl${k}">${TIERS[k]}</span>`;
  const topbar = () => `<div class="topbar"><span class="sp"></span><span class="timer" id="timer" hidden></span><button class="ic muteb" data-a="mute">${muteIcon()}</button><button class="ic" data-a="help">?</button></div>`;

  function render() {
    if (!view) return;
    if ((ld && ld.on) || (drag && drag.on)) return; // ドラッグ中は描き直さない
    const v = view;
    $('home').hidden = true; $('room').hidden = false;
    $('reacts').hidden = ['lobby', 'select'].includes(v.phase);
    const sig = JSON.stringify([v.phase, v.mode, v.opts, v.turnNo, v.players.map(p => [p.name, p.on, p.ready]), v.make, v.R && [v.R.id, v.R.step, v.R.myDone, v.R.done, !!v.R.res], draft, sel, hideCode, v.customN, SV.bring, SV.custom.length, popupI, !!v.sum]);
    if (sig === lastSig) return; lastSig = sig;
    let h = '';
    if (v.phase === 'lobby') h = lobby(v);
    else if (v.phase === 'select') h = select(v);
    else if (v.phase === 'make') h = make(v);
    else if (v.phase === 'intro') h = introView(v);
    else if (v.phase === 'place') h = place(v);
    else if (v.phase === 'result') h = resultView(v);
    else if (v.phase === 'final') h = finalView(v);
    $('room').innerHTML = h;
    if (BOT) botTick(v);
  }

  // ---------- ロビー ----------
  function roomId(v) {
    if (v.local) return '<span class="roomid">ボットと練習</span>';
    return `<span class="roomid">ルームID: <b>${hideCode ? '●●●●' : esc(v.code)}</b><button data-a="eye">${hideCode ? '表示' : 'かくす'}</button><button data-a="copy">コピー</button></span>`;
  }
  function lobby(v) {
    const isHost = !!H, readyN = v.players.filter(p => p.ready).length, allReady = readyN === v.players.length;
    let h = `<div class="topbar"><button class="back" data-a="leave">← 退出</button><span class="sp"></span>${roomId(v)}</div><div class="h1">ロビー</div>`;
    h += '<div class="pgrid" style="margin-top:12px">';
    v.players.forEach((p, i) => {
      h += `<div class="pcard ${i === v.me ? 'me' : ''} ${p.on ? '' : 'off'}">${i === 0 ? '<span class="hostb">HOST</span>' : ''}${isHost && p.cpu ? `<button class="x" data-delcpu="${p.pid}" aria-label="ボットをへらす">✕</button>` : ''}${av(v, i)}<div class="nm">${p.cpu ? '🤖 ' : ''}${esc(p.name)}</div>`;
      h += i === v.me && !p.cpu ? (p.ready ? '<button class="readyb" data-a="ready" style="background:#c6e3ff">✓ 準備OK</button>' : '<button class="readyb" data-a="ready">押して準備完了！</button>') : p.ready ? '<span class="pill sky">✓ 準備OK</span>' : '<span class="pill dash">準備中…</span>';
      h += '</div>';
    });
    if (!v.local) h += '<div class="pcard invite" data-a="copy"><big>＋</big>招待する</div>';
    if (isHost && v.players.length < MAXP.stream) h += '<div class="pcard invite" data-a="addcpu"><big>🤖</big>ボットを入れる</div>';
    h += '</div>';
    h += `<div class="note"><label class="toggle"><input type="checkbox" id="bring" ${SV.bring ? 'checked' : ''}> 自分の自作お題（${SV.custom.length}個）を持ち寄る</label></div>`;
    h += `<div class="foot"><span class="st">準備OK ${readyN}/${v.players.length}</span><span class="sp"></span>`;
    if (isHost) h += `${!v.players[0].ready ? '<span class="small" style="color:#fff;font-weight:800">先に自分の準備を完了してね</span>' : !allReady ? '<span class="small" style="color:#fff;font-weight:800">みんなの準備を待ってね</span>' : ''}<button class="btn y arrow" data-a="select" ${allReady ? '' : 'disabled'}>あそびを選ぶ！</button>`;
    else h += '<span class="small" style="color:#fff;font-weight:800">ホストがあそびを選ぶのを待ってね</span>';
    return h + '</div>';
  }
  function select(v) {
    const isHost = !!H, o = v.opts;
    let h = `<div class="topbar">${isHost ? '<button class="back" data-a="tolobby">← ロビー</button>' : '<button class="back" data-a="leave">← 退出</button>'}<span class="sp"></span>${roomId(v)}</div><div class="h1">あそびを選ぶ</div>`;
    if (!isHost) return h + `<div class="wait"><big>🎲</big>ホストがあそびを選んでいます…<div class="small" style="margin-top:8px">いまのモード：${MODE_NAME[v.mode]}</div></div>`;
    h += `<div class="modes" style="margin-top:12px">${[['party', '🎯', '並び当て', '主役の並びをみんなで当てる'], ['all', '🤝', '全員一致', '全員の名前を同じ順に'], ['stream', '📺', '配信者', '配信者の並びを視聴者が予想']].map(([m, e, n, d]) => `<button data-mode="${m}" class="${v.mode === m ? 'on' : ''}"><big>${e}</big>${n}<small>${d}</small></button>`).join('')}</div>`;
    h += '<div class="card" style="margin-top:12px">';
    if (v.mode === 'party') h += `<div class="opt" style="margin-top:0"><span>主役</span><div class="seg">${[1, 2, 3].map(n => `<button data-laps="${n}" class="${o.laps === n ? 'on' : ''}">1人${n}回</button>`).join('')}</div><small class="mute">（全${Math.max(3, v.players.length) * o.laps}ターン）</small></div>`;
    else h += `<div class="opt" style="margin-top:0"><span>ラウンド</span><div class="seg">${[3, 5, 10].map(n => `<button data-rounds="${n}" class="${o.rounds === n ? 'on' : ''}">${n}回</button>`).join('')}</div></div>`;
    h += `<div class="opt"><span>予想の時間</span><div class="seg">${[[60, '1分'], [120, '2分'], [180, '3分'], [0, 'なし']].map(([n, l]) => `<button data-time="${n}" class="${o.time === n ? 'on' : ''}">${l}</button>`).join('')}</div></div>`;
    if (v.mode !== 'all') h += `<div class="opt"><span>ジャンル</span><div class="gchips">${D.genres.map(g => `<button data-genre="${g.id}" class="${o.genres.includes(g.id) ? 'on' : ''}">${g.emo} ${g.name}</button>`).join('')}</div></div>`;
    h += `<div class="opt"><span>自作お題</span><label class="toggle"><input type="checkbox" id="useCustom" ${o.useCustom ? 'checked' : ''}> みんなの自作お題もまぜる（いま${v.customN}個）</label></div>`;
    h += '</div>';
    if (v.mode === 'stream') h += '<div class="note">配信者モード：主役はずっとあなた。視聴者は30人まで入れるよ（ルームIDは「表示」を押すまでかくれてる）</div>';
    h += `<div class="foot"><span class="st">${v.players.length}人${v.players.length < 3 ? '（3人より少ないとボットが入る）' : ''}</span><span class="sp"></span><button class="btn y arrow" data-a="start">はじめる！</button></div>`;
    return h;
  }

  // ---------- 並べるリスト ----------
  function listHTML(words, order, can) {
    return order.map((w, k) => `<div class="ritem ${can ? '' : 'lock'} ${sel === k ? 'sel' : ''}" data-p="${k}">${tl(k)}<span class="w">${esc(words[w])}</span>${can ? '<span class="grip">⋮⋮</span>' : ''}</div>`).join('');
  }
  function make(v) {
    const mk = v.make, my = mk.my;
    let h = topbar();
    if (!my) {
      const mainName = v.mode === 'stream' ? P(v, 0).name : '';
      return h + `<div class="wait"><big>🤫</big>${mainName ? `${esc(mainName)}が正解をつくっています…` : 'みんなが正解をつくっています…'}<div class="small" style="margin-top:8px">${mk.done.length} / ${mk.total} ロック済</div></div>`;
    }
    const can = !my.done;
    h += `<div class="sub"><span class="pill">${genreLabel(my)}</span></div><div class="sub" style="opacity:.9;margin-top:8px">きみの正解をつくろう。ほかの人には見せないでね</div><div class="q">「${esc(my.topic)}」</div>`;
    h += `<div class="rlist" id="rl">${listHTML(my.words, draft, can)}</div>`;
    if (can) h += '<p class="hint">ドラッグで並べかえ／2つタップで入れかえ</p>';
    h += `<div class="foot"><span class="st">みんなの状況 ${mk.done.length}/${mk.total} ロック済 ${mk.makers.map(i => av(v, i, 's' + (mk.done.includes(i) ? ' on' : ''))).join('')}</span><span class="sp"></span>`;
    if (can && my.rerolls < 3) h += `<button class="btn sm" data-a="mkreroll">🔄 お題チェンジ（あと${3 - my.rerolls}）</button>`;
    h += can ? '<button class="btn y arrow" data-a="mklock">このならびでロック！</button>' : '<button class="btn" data-a="mkunlock">🔓 ロックを外す</button>';
    h += '</div>';
    if (H) h += '<div class="foot"><span class="sp"></span><button class="btn sm ghost" data-a="forcemake">⏩ このまま始める</button></div>';
    return h;
  }
  // ---------- ターン紹介 ----------
  function introView(v) {
    const R = v.R, me = R.main === v.me;
    let h = `<div class="intro"><span class="pill">${v.mode === 'party' ? `第${v.turnNo}ターン / 全${v.turnTotal}ターン` : `第${v.turnNo}ラウンド / 全${v.turnTotal}ラウンド`}</span><br>`;
    if (R.kind === 'all') h += `<div class="who"><span class="av l" style="background:#1d1b22">🤝</span><div><small>みんなで…</small><b>全員一致</b></div></div><br>`;
    else h += `<div class="who">${av(v, R.main, 'l')}<div><small>今回の主役は…</small><b>${esc(P(v, R.main).name)}${me ? ' <em>（きみ！）</em>' : ''}</b></div></div><br>`;
    h += `<div class="qbox"><span class="g">${genreLabel(R)}</span>「${esc(R.topic)}」</div>`;
    h += `<div class="wchips">${R.words.map(w => `<span>${esc(w)}</span>`).join('')}</div>`;
    h += '<div class="bar"><i id="ibar" style="width:0%"></i></div><div class="small" style="color:#fff;font-weight:800">まもなく予想スタート…</div>';
    h += '</div>';
    if (H) h += '<div class="foot"><span class="sp"></span><button class="btn y arrow" data-a="go">予想スタート！</button></div>';
    return h;
  }
  setInterval(() => { const b = $('ibar'); if (b && view && view.phase === 'intro') b.style.width = Math.min(100, (Date.now() - viewAt) / (6500 / FAST) * 100) + '%'; }, 100);

  // ---------- 予想 ----------
  function place(v) {
    const R = v.R, isMain = R.main === v.me;
    let h = topbar();
    if (isMain) {
      h += `<div class="h1">相談にまざってOK！正解だけナイショ</div><div class="q">「${esc(R.topic)}」</div>`;
      if (R.guessers.length <= 12) h += `<div class="gcards">${R.guessers.map(i => `<div class="gcard">${av(v, i)}<div class="nm">${esc(P(v, i).name)}</div>${R.done.includes(i) ? '<span class="pill sky">ロック済！</span>' : '<span class="pill dash">考え中</span>'}</div>`).join('')}<div class="lockbox">${R.done.length}/${R.guessers.length} ロック<br>${R.done.length === R.guessers.length ? '全員そろった！結果へ…' : '全員ロックで結果へ！'}</div></div>`;
      else h += `<div class="gcards" style="grid-template-columns:1fr"><div class="lockbox" style="font-size:1.4rem">${R.done.length} / ${R.guessers.length} 人がロック<br><small>全員ロックで結果へ！</small></div></div>`;
      if (R.answer) { const order = T.tiersToOrder(R.answer); h += `<div class="mybar"><b>きみの正解</b>${order.map((w, k) => `<span class="${k === 0 ? 's0' : ''}">${TIERS[k]} ${esc(R.words[w])}</span>`).join('')}</div>`; }
    } else if (R.kind === 'all') {
      h += `<div class="sub">🤝 全員の名前を、みんなと同じ段になるように置こう</div><div class="q">「${esc(R.topic)}」</div>`;
      h += boardHTML(v, draft, !R.myDone);
      if (!R.myDone) h += `<div class="tray" data-tier="-1">${draft.map((x, i) => x < 0 ? chip(v, i) : '').join('')}</div><p class="hint">ドラッグで置くか、タップで選んでから段をタップ（同じ段にいくつでもOK）</p>`;
    } else {
      h += `<div class="sub">${av(v, R.main, 's')} ${esc(P(v, R.main).name)}になりきって並べよう</div><div class="q">「${esc(R.topic)}」</div>`;
      h += `<div class="rlist" id="rl">${listHTML(R.words, draft, !R.myDone)}</div>`;
      if (!R.myDone) h += '<p class="hint">ドラッグで並べかえ／2つタップで入れかえ</p>';
    }
    h += `<div class="foot"><span class="st">予想者のようす ${R.done.length}/${R.guessers.length} ${R.guessers.length <= 14 ? R.guessers.map(i => av(v, i, 's' + (R.done.includes(i) ? ' on' : ''))).join('') : ''}</span><span class="sp"></span>`;
    if (!isMain) {
      const full = R.kind === 'all' ? draft.every(x => x >= 0) : true;
      h += R.myDone ? '<button class="btn" data-a="unsubmit">✏️ 直す</button>' : `<button class="btn y arrow" data-a="submit" ${full ? '' : 'disabled'}>${full ? '予想を確定！' : `あと${draft.filter(x => x < 0).length}人置いてね`}</button>`;
    }
    h += '</div>';
    if (H) h += '<div class="foot"><span class="sp"></span><button class="btn sm ghost" data-a="force">⏩ 締め切って結果へ</button><button class="btn sm ghost" data-a="end">🏁 終わる</button></div>';
    return h;
  }
  // 全員一致のティア表
  const chip = (v, i) => `<button class="chip ${sel === i ? 'sel' : ''}" data-w="${i}">${esc(v.R.words[i])}</button>`;
  function boardHTML(v, b, can) {
    return `<div class="board ${can ? 'can' : ''}">${TIERS.map((t, k) => `<div class="trow" data-tier="${k}"><div class="lab tl${k}">${t}</div><div class="cells">${b.map((x, i) => x === k ? (can ? chip(v, i) : `<span class="chip">${esc(v.R.words[i])}</span>`) : '').join('')}</div></div>`).join('')}</div>`;
  }

  // ---------- 結果発表 ----------
  function resultView(v) {
    const R = v.R, r = R.res, step = R.step, n = R.words.length, done = step >= n;
    let h = topbar();
    if (R.kind === 'all') return h + resultAll(v);
    const order = T.tiersToOrder(R.answer), mainP = P(v, R.main);
    h += `<div class="h1">結果発表！${esc(mainP.name)}の本当の並びは…</div><div class="sub" style="font-family:var(--logo);font-weight:400;font-size:.95rem">「${esc(R.topic)}」</div>`;
    h += '<div class="result" style="margin-top:14px">';
    h += `<div class="ans"><div class="lb">${av(v, R.main, 's')} 正解</div>${order.map((w, k) => `<div class="ritem lock">${tl(k)}<span class="w">${k < step || done ? esc(R.words[w]) : '？'}</span></div>`).join('')}</div>`;
    const cols = r.cols;
    if (cols.length <= 8) {
      h += '<div class="cols">';
      for (const c of cols) {
        h += `<div class="col ${done && c.pf ? 'perfect' : ''} ${c.i === v.me ? 'me' : ''}" data-col="${c.i}"><div class="hd">${av(v, c.i, 's')}<i>${esc(P(v, c.i).name)}</i></div>`;
        h += order.map((w, k) => k < step || done ? (c.t[w] === k ? '<div class="cell o">○</div>' : '<div class="cell x">✕</div>') : '<div class="cell"></div>').join('');
        h += done ? (c.pf ? '<span class="cnt pf">パーフェクト</span>' : `<span class="cnt">5中<b>${c.m}</b></span>`) : '<span class="cnt" style="opacity:0">-</span>';
        h += '</div>';
      }
      h += '</div>';
    } else {
      // 大人数（配信者モード）：段ごとに当てた人の割合
      const mine = cols.find(c => c.i === v.me);
      h += `<div class="distc"><div class="hd">当てた人の割合（${cols.length}人）</div>${order.map((w, k) => { const show = k < step || done, pct = Math.round(cols.filter(c => c.t[w] === k).length / cols.length * 100); return `<div class="dr"><span class="bb"><i style="width:${show ? pct : 0}%"></i></span><b>${show ? pct + '%' : ''}</b>${mine ? (show ? (mine.t[w] === k ? '<span class="cell o me">○</span>' : '<span class="cell x me">✕</span>') : '<span class="cell me"></span>') : ''}</div>`; }).join('')}</div>`;
    }
    h += '</div>';
    if (cols.length > 8 && done) { const pf = cols.filter(c => c.pf); h += `<div class="note">パーフェクト：${pf.length ? pf.slice(0, 20).map(c => esc(P(v, c.i).name)).join('・') + (pf.length > 20 ? ` ほか${pf.length - 20}人` : '') : 'なし'}</div>`; }
    if (cols.length <= 8 && done && cols.length) h += '<p class="hint">列を押すと、その人の予想が見られるよ</p>';
    if (!cols.length) h += '<div class="note">予想した人がいなかった…</div>';
    h += `<div class="foot"><span class="sp"></span>${H ? `<button class="btn y arrow" data-a="next">${!done ? 'とばす' : v.turnNo >= v.turnTotal ? '結果を見る' : 'つぎのターンへ'}</button>` : '<span class="small" style="color:#fff;font-weight:800">ホストが次へ進めるのを待ってね</span>'}</div>`;
    if (popupI != null) h += popup(v, popupI);
    return h;
  }
  function popup(v, i) {
    const R = v.R, c = R.res.cols.find(x => x.i === i); if (!c) return '';
    const order = T.tiersToOrder(c.t), mainName = P(v, R.main).name;
    return `<div class="popup" data-a="closepop"><div class="card"><div class="ttl">${esc(P(v, i).name)}の予想</div>${order.map((w, k) => `<div class="pi ${R.answer[w] === k ? 'hit' : ''}">${tl(k)}<span class="w">${esc(R.words[w])}</span>${R.answer[w] !== k ? `<small>${esc(mainName)}は${TIERS[R.answer[w]]}</small>` : ''}</div>`).join('')}<p class="small mute" style="text-align:center;margin:10px 0 0">${c.m} / 5 ピタリ</p></div></div>`;
  }
  function resultAll(v) {
    const R = v.R, r = R.res, step = R.step, n = R.words.length, done = step >= n;
    const ids = Object.keys(r.boards).map(Number);
    let h = `<div class="h1">結果発表！みんなの並びは…</div><div class="sub" style="font-family:var(--logo);font-weight:400;font-size:.95rem">「${esc(R.topic)}」</div>`;
    h += '<div class="result all" style="margin-top:14px">';
    h += `<div class="ans"><div class="lb">名前</div>${R.words.map((w, j) => `<div class="ritem lock">${j < step || done ? (r.res[j].same ? '✅' : '') : ''}<span class="w">${esc(w)}</span></div>`).join('')}</div>`;
    h += `<div class="cols">${ids.map(i => `<div class="col ${i === v.me ? 'me' : ''}"><div class="hd">${av(v, i, 's')}<i>${esc(P(v, i).name)}</i></div>${R.words.map((w, j) => { const t = r.boards[i][j]; return j < step || done ? `<div class="cell l tl${t}" style="border:2.5px solid #1d1b22;${r.res[j].same ? 'box-shadow:0 0 0 3px #ffd60a' : ''}">${TIERS[t] || '－'}</div>` : '<div class="cell"></div>'; }).join('')}<span class="cnt" style="opacity:0">-</span></div>`).join('')}</div>`;
    h += '</div>';
    if (done) h += `<div class="note" style="font-size:1rem">${r.perfect ? '🎉 全員の表が完全にそろった！' : `全員一致 ${r.same} / ${n}人（${Math.round(r.rate * 100)}%）`}</div>`;
    h += `<div class="foot"><span class="sp"></span>${H ? `<button class="btn y arrow" data-a="next">${!done ? 'とばす' : v.turnNo >= v.turnTotal ? '結果を見る' : 'つぎのラウンドへ'}</button>` : '<span class="small" style="color:#fff;font-weight:800">ホストが次へ進めるのを待ってね</span>'}</div>`;
    return h;
  }
  let lastFxKey = '';
  function stepFx(v) {
    const R = v.R; if (!R || !R.res) return; const key = R.id + ':' + R.step; if (key === lastFxKey) return; lastFxKey = key;
    const n = R.words.length, k = R.step - 1;
    if (R.step >= n && R.step !== lastStep) {
      lastStep = R.step;
      if (R.kind === 'all') { if (R.res.perfect) { SFX.perfect(); confetti(180); } else if (R.res.same) SFX.cheer(R.res.same); }
      else { const pf = R.res.cols.filter(c => c.pf); if (pf.length) { SFX.perfect(); confetti(80 + pf.length * 40); } }
      return;
    }
    lastStep = R.step;
    if (k < 0) return;
    if (R.kind === 'all') { if (R.res.res[k] && R.res.res[k].same) { SFX.o(); confetti(30); } else SFX.x(); return; }
    const order = T.tiersToOrder(R.answer), w = order[k], hits = R.res.cols.filter(c => c.t[w] === k).length;
    if (hits) { SFX.o(); if (hits >= 2) SFX.cheer(hits); confetti(10 + hits * 10, innerWidth * 0.62, innerHeight * 0.45); } else SFX.x();
  }

  // ---------- セッション終了 ----------
  function finalView(v) {
    const s = v.sum; if (!s) return '';
    let h = `<div class="topbar"><button class="back" data-a="leave">← タイトルへ</button><span class="sp"></span><button class="ic muteb" data-a="mute">${muteIcon()}</button></div>`;
    h += '<div class="end"><div class="h1">セッション終了！おつかれさま 🎉</div>';
    const pairHTML = p => p ? `<span class="pn">${av(v, p.a)}${esc(P(v, p.a).name)}</span>×<span class="pn">${av(v, p.b)}${esc(P(v, p.b).name)}</span>` : '－';
    if (s.kind === 'all') {
      h += `<div class="tot"><div>全${s.rounds}ラウンドで <b>${s.same}</b> 人が全員一致！</div><small>テレパシー一致率 ${Math.round(s.rate * 100)}%</small></div>`;
      h += '<div class="awards">';
      h += `<div class="aw"><h3>💗 ベスト相性</h3><div class="bd">${pairHTML(s.pair)}</div><div class="ft">${s.pair ? `相性 ${Math.round(s.pair.rate * 100)}%` : ''}</div></div>`;
      h += `<div class="aw"><h3>⭐ 完全一致</h3><div class="bd">${s.perfect ? `<span class="prize">全員の表がそろったラウンド ${s.perfect}回！</span>` : '<span class="small mute">全員の表がそろったラウンドがあれば、ここで表彰されるよ</span>'}</div></div>`;
      h += '</div>';
    } else {
      h += `<div class="tot"><div>全${s.turns}${v.mode === 'party' ? 'ターン' : 'ラウンド'}で合計 <b>${s.hit}</b> こピタリ！</div><small>テレパシー一致率 ${Math.round(s.rate * 100)}%</small></div>`;
      h += '<div class="awards">';
      if (v.mode === 'party') h += `<div class="aw"><h3>💗 ベスト相性</h3><div class="bd">${pairHTML(s.pair)}</div><div class="ft">${s.pair ? `相性 ${Math.round(s.pair.rate * 100)}%` : ''}</div></div>`;
      h += `<div class="aw"><h3>🏆 ひょうしょう</h3><div class="bd">${s.reader && v.mode === 'party' ? `<span class="prize">読まれ上手賞<br>${esc(P(v, s.reader.i).name)}<small>一致率${Math.round(s.reader.rate * 100)}%</small></span>` : ''}${s.detective ? `<span class="prize b">名探偵賞<br>${esc(P(v, s.detective.i).name)}<small>${s.detective.hit}ピタリ</small></span>` : '<span class="small mute">－</span>'}</div></div>`;
      h += `<div class="aw"><h3>⭐ パーフェクト</h3><div class="bd">${s.perf.length ? s.perf.slice(0, 12).map(([i, n]) => `<span class="prize">🏅 ${esc(P(v, i).name)}${n > 1 ? ` ×${n}` : ''}</span>`).join('') : '<span class="small mute">「5中5」が出たターンがあれば、ここで表彰されるよ</span>'}</div></div>`;
      h += '</div>';
      if (v.mode === 'stream') h += `<div class="vrank">${s.det.slice(0, 10).map(([i, n], k) => `<div><b>${k + 1}</b><span>${esc(P(v, i).name)}</span>${n}ピタリ</div>`).join('')}</div>`;
    }
    h += '</div>';
    h += `<div class="foot"><span class="sp"></span>${H ? '<button class="btn" data-a="tolobby">ロビーへ</button><button class="btn y arrow" data-a="again">もう1セッション！</button>' : '<span class="small" style="color:#fff;font-weight:800">ホストが次を選ぶのを待ってね</span>'}</div>`;
    return h;
  }

  // ---------- リアクション ----------
  $('reacts').innerHTML = REACTS.map(e => `<button data-react="${e}">${e}</button>`).join('');
  $('reacts').addEventListener('click', e => { const b = e.target.closest('[data-react]'); if (b) send({ t: 'react', e: b.dataset.react }); });
  function showReacts(v) {
    for (const r of v.reacts || []) {
      if (r.k <= seenReact) continue; seenReact = r.k;
      const d = document.createElement('div'); d.className = 'floaty'; d.innerHTML = `${esc(r.e)}<small>${esc(r.n)}</small>`;
      d.style.left = (12 + Math.random() * 76) + 'vw'; d.style.bottom = '70px'; document.body.appendChild(d); setTimeout(() => d.remove(), 2500); SFX.react();
    }
  }

  // ================= 操作 =================
  const room = $('room');
  const rankEditable = () => { const v = view; if (!v || !draft) return false; if (v.phase === 'make') return !!(v.make.my && !v.make.my.done); return v.phase === 'place' && v.R && v.R.kind !== 'all' && v.R.main !== v.me && !v.R.myDone; };
  const allEditable = () => { const v = view; return !!(v && draft && v.phase === 'place' && v.R && v.R.kind === 'all' && !v.R.myDone); };
  function pushDraft() {
    clearTimeout(draftT); const v = view, o = draft.slice();
    draftT = setTimeout(() => { if (v.phase === 'make') send({ t: 'mkdraft', o }); else if (v.R) send(v.R.kind === 'all' ? { t: 'draft', rid: v.R.id, b: o } : { t: 'draft', rid: v.R.id, o }); }, 250);
  }
  function relist() { const rl = $('rl'); if (!rl) return; const words = view.phase === 'make' ? view.make.my.words : view.R.words; rl.innerHTML = listHTML(words, draft, true); }
  // 順位のドラッグ（上下に並べかえ）
  let ld = null, drag = null;
  room.addEventListener('pointerdown', e => {
    const it = e.target.closest('.ritem[data-p]');
    if (it && rankEditable() && it.closest('#rl')) { ld = { p: +it.dataset.p, x: e.clientX, y: e.clientY, on: false, id: e.pointerId }; try { it.setPointerCapture(e.pointerId); } catch (x) {} return; }
    const c = e.target.closest('.chip[data-w]');
    if (c && allEditable()) { drag = { i: +c.dataset.w, x: e.clientX, y: e.clientY, el: c, on: false, id: e.pointerId }; try { c.setPointerCapture(e.pointerId); } catch (x) {} }
  });
  room.addEventListener('pointermove', e => {
    if (ld && e.pointerId === ld.id) {
      if (!ld.on && Math.hypot(e.clientX - ld.x, e.clientY - ld.y) > 6) {
        ld.on = true; sel = null; relist();
        const items = [...$('rl').children]; ld.rects = items.map(x => x.getBoundingClientRect());
        const el = items[ld.p], r = ld.rects[ld.p]; ld.g = el.cloneNode(true); ld.g.classList.add('ghost'); ld.g.style.width = r.width + 'px'; document.body.appendChild(ld.g); ld.oy = e.clientY - r.top; ld.left = r.left; el.classList.add('ph');
      }
      if (ld.on) {
        e.preventDefault(); ld.g.style.left = ld.left + 'px'; ld.g.style.top = (e.clientY - ld.oy) + 'px';
        const cy = e.clientY - ld.oy + ld.rects[0].height / 2; let t = 0, best = 1e9; ld.rects.forEach((r, k) => { const d = Math.abs(r.top + r.height / 2 - cy); if (d < best) { best = d; t = k; } });
        if (t !== ld.p) { const [w] = draft.splice(ld.p, 1); draft.splice(t, 0, w); ld.p = t; relist(); $('rl').children[t].classList.add('ph'); ld.g.querySelector('.tl').outerHTML = tl(t); SFX.tick(); }
      }
      return;
    }
    if (drag && e.pointerId === drag.id) {
      if (!drag.on && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 7) { drag.on = true; const g = drag.el.cloneNode(true); g.classList.add('ghost'); g.classList.remove('sel'); document.body.appendChild(g); drag.g = g; drag.el.classList.add('lift'); const r = drag.el.getBoundingClientRect(); drag.ox = e.clientX - r.left; drag.oy = e.clientY - r.top; }
      if (drag.on) { e.preventDefault(); drag.g.style.left = (e.clientX - drag.ox) + 'px'; drag.g.style.top = (e.clientY - drag.oy) + 'px'; const z = dropZone(e.clientX, e.clientY); room.querySelectorAll('.hot').forEach(x => x !== z && x.classList.remove('hot')); if (z) z.classList.add('hot'); }
    }
  });
  const endDrag = e => {
    if (ld && e.pointerId === ld.id) {
      const d = ld; ld = null;
      if (d.on) { d.g.remove(); pushDraft(); SFX.swap(); lastSig = ''; render(); }
      else if (e.type === 'pointerup') { if (sel == null) { sel = d.p; SFX.pick(); } else if (sel === d.p) sel = null; else { [draft[sel], draft[d.p]] = [draft[d.p], draft[sel]]; sel = null; pushDraft(); SFX.swap(); } render(); }
      return;
    }
    if (drag && e.pointerId === drag.id) {
      const d = drag; drag = null;
      if (d.on) { d.g.remove(); d.el.classList.remove('lift'); room.querySelectorAll('.hot').forEach(x => x.classList.remove('hot')); const z = e.type === 'pointerup' ? dropZone(e.clientX, e.clientY) : null; if (z) setChip(d.i, +z.dataset.tier); else { lastSig = ''; render(); } }
      else if (e.type === 'pointerup') { sel = sel === d.i ? null : d.i; SFX.pick(); render(); }
    }
  };
  room.addEventListener('pointerup', endDrag); room.addEventListener('pointercancel', endDrag);
  function dropZone(x, y) { const el = document.elementFromPoint(x, y); return el && el.closest('.trow, .tray'); }
  function setChip(i, t) { if (!allEditable()) return; draft[i] = t; sel = null; SFX.pick(); pushDraft(); lastSig = ''; render(); }

  room.addEventListener('click', e => {
    const t = e.target, v = view; if (!v) return;
    if (allEditable() && sel != null && !t.closest('.chip')) { const z = t.closest('.board.can .trow, .tray'); if (z) { setChip(sel, +z.dataset.tier); return; } }
    const col = t.closest('[data-col]'); if (col && v.phase === 'result' && v.R.step >= v.R.words.length) { popupI = +col.dataset.col; lastSig = ''; render(); return; }
    const b = t.closest('[data-a], [data-mode], [data-laps], [data-rounds], [data-time], [data-genre], [data-delcpu]'); if (!b) return;
    const a = b.dataset.a;
    if (a === 'closepop') { popupI = null; lastSig = ''; render(); return; }
    if (a === 'leave') { if (['lobby', 'select', 'final'].includes(v.phase) || confirm('部屋を出る？')) leave(); return; }
    if (a === 'mute') { toggleMute(); return; }
    if (a === 'help') { $('howDlg').hidden = false; return; }
    if (a === 'eye') { hideCode = !hideCode; lastSig = ''; render(); return; }
    if (a === 'copy') { const u = location.origin + location.pathname + '?room=' + v.code; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('招待リンクをコピーした（ルームIDつき）')).catch(() => prompt('このリンクを送ってね', u)); return; }
    if (b.dataset.mode) return send({ t: 'mode', m: b.dataset.mode });
    if (b.dataset.laps) return send({ t: 'opts', o: { laps: +b.dataset.laps } });
    if (b.dataset.rounds) return send({ t: 'opts', o: { rounds: +b.dataset.rounds } });
    if (b.dataset.time) return send({ t: 'opts', o: { time: +b.dataset.time } });
    if (b.dataset.genre) { const g = b.dataset.genre, cur = v.opts.genres.slice(), k = cur.indexOf(g); if (k >= 0) { if (cur.length === 1) return toast('ジャンルは1つ以上えらんでね'); cur.splice(k, 1); } else cur.push(g); return send({ t: 'opts', o: { genres: cur } }); }
    if (b.dataset.delcpu) return send({ t: 'delcpu', pid: b.dataset.delcpu });
    if (a === 'mklock') { SFX.lock(); return send({ t: 'mklock', o: draft.slice() }); }
    if (a === 'submit') { if (v.R.kind === 'all' ? draft.every(x => x >= 0) : true) { SFX.lock(); send(v.R.kind === 'all' ? { t: 'submit', rid: v.R.id, b: draft.slice() } : { t: 'submit', rid: v.R.id, o: draft.slice() }); } return; }
    if (a === 'unsubmit') return send({ t: 'unsubmit', rid: v.R.id });
    if (a === 'force') { if (confirm('まだの人がいても締め切る？')) send({ t: 'force' }); return; }
    if (a === 'forcemake') { if (confirm('まだロックしていない人も、いまの並びで始める？')) send({ t: 'forcemake' }); return; }
    if (a === 'end') { if (confirm('ここでセッションを終わる？')) send({ t: 'end' }); return; }
    if (['ready', 'select', 'tolobby', 'start', 'addcpu', 'mkunlock', 'mkreroll', 'go', 'next', 'again'].includes(a)) send({ t: a });
  });
  room.addEventListener('change', e => {
    if (e.target.id === 'useCustom') send({ t: 'opts', o: { useCustom: e.target.checked } });
    if (e.target.id === 'bring') { SV.bring = e.target.checked; save(); sendCustom(); lastSig = ''; render(); }
  });
  function sendCustom() { const list = SV.bring ? SV.custom : []; if (H) { const me = H.players[0]; if (me) me.custom = T.cleanCustom(list, me.name); broadcast(); } else send({ t: 'custom', list }); }

  // ================= タイトルの操作 =================
  $('nm').value = SV.name || (window.GAMES_ACC && GAMES_ACC.name()) || '';
  $('hostBtn').onclick = () => { ac(); host(false); };
  $('soloBtn').onclick = () => { ac(); host(true); };
  $('joinBtn').onclick = () => { ac(); join(); };
  $('code').addEventListener('keydown', e => { if (e.key === 'Enter') { ac(); join(); } });
  document.querySelectorAll('.dlg').forEach(d => d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.hidden = true; }));
  $('howBtn').onclick = () => { $('howDlg').hidden = false; };

  // 自作お題
  let ekind = 'w';
  $('ekind').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; ekind = b.dataset.k; $('ekind').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); $('ewBox').hidden = ekind === 'all'; });
  function drawCustom() { $('elist').innerHTML = SV.custom.length ? SV.custom.map((c, i) => `<div class="ci"><div class="tx"><b>${esc(c.t)}</b><small>${c.all ? '🤝 全員一致（参加者の名前を並べる）' : `${c.w.length}語：${esc(c.w.join('・'))}`}</small></div><button class="btn sm" data-del="${i}">消す</button></div>`).join('') : '<p class="small mute" style="text-align:center">まだないよ</p>'; }
  $('editBtn').onclick = () => { drawCustom(); $('eerr').textContent = ''; $('editDlg').hidden = false; };
  $('eadd').onclick = () => {
    const t = $('et').value.trim(); if (!t) return ($('eerr').textContent = 'お題を入れてね');
    if (SV.custom.length >= 50) return ($('eerr').textContent = '自作お題は50個までだよ');
    let item;
    if (ekind === 'all') item = { t, all: true };
    else { const w = T.parseWords($('ew').value); if (w.length < N5) return ($('eerr').textContent = `ワードは${N5}つ以上いるよ（いま${w.length}つ）`); item = { t, w }; }
    SV.custom.push(item); save(); $('et').value = ''; $('ew').value = ''; $('eerr').textContent = ''; drawCustom(); SFX.pick(); if (view) sendCustom();
  };
  $('elist').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; SV.custom.splice(+b.dataset.del, 1); save(); drawCustom(); if (view) sendCustom(); });

  // セーブデータ
  $('saveBtn').onclick = () => { $('saveTx').value = ''; $('saveErr').textContent = ''; $('saveDlg').hidden = false; };
  $('saveOut').onclick = () => { const s = JSON.stringify({ app: 'tier-yomi', v: 1, data: SV }); $('saveTx').value = s; $('saveTx').select(); try { navigator.clipboard.writeText(s).then(() => { $('saveErr').textContent = 'コピーした！'; }); } catch (e) {} };
  $('saveIn').onclick = () => {
    try { const o = JSON.parse($('saveTx').value); if (!o || o.app !== 'tier-yomi' || !o.data) throw 0; SV = Object.assign(blank(), o.data, { stats: Object.assign(blank().stats, o.data.stats || {}) }); SV.custom = T.cleanCustom(SV.custom).map(c => c.all ? { t: c.t, all: true } : { t: c.t, w: c.w }); save(); drawStats(); $('saveErr').textContent = '読み込んだ！'; $('nm').value = SV.name || $('nm').value; rankReport(); }
    catch (e) { $('saveErr').textContent = 'セーブデータの形がちがうみたい'; }
  };

  // ================= ボット自動プレイ（?bot=1） =================
  let botBusy = 0;
  function botTick(v) {
    if (botBusy) return;
    const later2 = (f, ms) => { botBusy = 1; setTimeout(() => { botBusy = 0; f(); }, ms / FAST); };
    if (v.phase === 'lobby' && H) later2(() => send({ t: 'select' }), 600);
    else if (v.phase === 'select' && H) later2(() => send({ t: 'start' }), 600);
    else if (v.phase === 'make' && v.make.my && !v.make.my.done) later2(() => { draft = T.botRank(v.make.my.topic, v.make.my.words, T.rng(9), 0.9); send({ t: 'mklock', o: draft.slice() }); }, 1200);
    else if (v.phase === 'place' && v.R.main !== v.me && !v.R.myDone) later2(() => { const r = T.rng(v.R.id * 7 + 1); if (v.R.kind === 'all') send({ t: 'submit', rid: v.R.id, b: T.botBoard(v.R.topic, v.R.words, r, 0.6) }); else send({ t: 'submit', rid: v.R.id, o: T.botRank(v.R.topic, v.R.words, r, 0.5) }); }, 1500);
    else if (v.phase === 'result' && H && v.R.step >= v.R.words.length) later2(() => send({ t: 'next' }), 1500);
    else if (v.phase === 'final' && !window.__botDone) { window.__botDone = true; console.log('BOT DONE', JSON.stringify(v.sum)); }
  }

  // ================= はじめ =================
  drawStats();
  const rq = qp('room'); if (rq) $('code').value = rq.replace(/\D/g, '').slice(0, 4);
  if (BOT) setTimeout(() => host(true), 100);
  setTimeout(() => { if (window.GAMES_RANK) { GAMES_RANK.mount('tier', { left: 'max(10px, env(safe-area-inset-left))', top: 'max(14px, env(safe-area-inset-top))' }, () => $('home').hidden); rankReport(); } }, 0);
  window.__tier = { get view() { return view; }, get H() { return H; }, send };
})();
