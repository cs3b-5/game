// ナゾトキ探偵：みんなで遊ぶ（プレイヤーの中に犯人がいる）
// 部屋を作った人（ホスト）がゲームを進め、みんなに「その人から見える画面の中身」を送る
(() => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const PREFIX = 'nazotoki-room-', MAXP = 8, MINP = 4;
  const TIME = { role: 15, testify: 45, talk: 180, vote: 30 };
  const CPU_NAMES = ['CPUアイ', 'CPUベン', 'CPUカイ', 'CPUダイ', 'CPUエマ', 'CPUフウ', 'CPUギン', 'CPUハナ'];
  let SV = {}; try { SV = JSON.parse(localStorage.getItem('nazotoki-mp') || '{}'); } catch (e) {}
  const saveSV = () => { try { localStorage.setItem('nazotoki-mp', JSON.stringify(SV)); } catch (e) {} };

  // ================= 通信 =================
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

  // ================= ホスト：ゲームの進行 =================
  let H = null;          // ホストのときだけ
  let peer = null, hostConn = null, myPid = null, view = null;
  function newRoom(code, local) {
    H = { code, local, players: [], diff: 'normal', phase: 'lobby', deadline: 0, round: 0, G: null, timer: null, conns: {} };
  }
  const humanCount = () => H.players.filter(p => !p.cpu).length;
  function addPlayer(name, cpu, conn) {
    const pid = 'p' + Math.random().toString(36).slice(2, 8);
    let nm = (name || 'ななし').slice(0, 10);
    if (H.players.some(p => p.name === nm)) { let k = 2; while (H.players.some(p => p.name === nm.slice(0, 8) + k)) k++; nm = nm.slice(0, 8) + k; }
    H.players.push({ pid, name: nm, cpu: !!cpu, on: true, score: 0, seen: Date.now() });
    if (conn) H.conns[pid] = conn;
    return pid;
  }
  function addCpu() { if (H.players.length >= MAXP) return; const used = new Set(H.players.map(p => p.name)); addPlayer(CPU_NAMES.find(n => !used.has(n)) || 'CPU', true); }
  function startGame() {
    if (H.players.some(p => !p.on)) { H.players = H.players.filter(p => p.on); reindex(); }
    while (H.players.length < MINP) addCpu();
    const n = H.players.length, seed = 1 + Math.floor(Math.random() * 99999);
    H.round++;
    const C = MYS.generateMP(seed, n, H.diff);
    H.G = { C, lieQ: null, testified: {}, statements: null, chat: [], contras: [], votes: {}, result: null };
    sys(`第${H.round}の事件が起きた……！`);
    phase('role');
    // CPUの準備
    H.players.forEach((p, i) => { if (p.cpu) H.G.testified[i] = false; });
  }
  function phase(ph) {
    H.phase = ph; clearTimeout(H.timer);
    const secs = TIME[ph];
    H.deadline = secs ? Date.now() + secs * 1000 : 0;
    if (secs) H.timer = setTimeout(() => timeUp(ph), secs * 1000 + 300);
    if (ph === 'testify') cpuTestify();
    if (ph === 'talk') { buildTalk(); cpuTalk(); }
    if (ph === 'vote') cpuVote();
    broadcast();
  }
  function timeUp(ph) {
    if (H.phase !== ph) return;
    if (ph === 'role') phase('testify');
    else if (ph === 'testify') { const G = H.G, c = G.C.culprit; if (G.lieQ == null) G.lieQ = randomQ(); phase('talk'); void c; }
    else if (ph === 'talk') phase('vote');
    else if (ph === 'vote') finish();
  }
  function randomQ() { const C = H.G.C, opts = C.places.map((_, i) => i).filter(p => p !== C.crime.p); return opts[Math.floor(Math.random() * opts.length)]; }
  function sys(text) { if (H.G) H.G.chat.push({ from: -1, text, at: Date.now() }); }
  function buildTalk() {
    const G = H.G, C = G.C;
    if (G.lieQ == null) G.lieQ = randomQ();
    G.statements = MYS.statementsMP(C, G.lieQ);
    C.clue = MYS.clueMP(C, G.lieQ);
    sys(`全員の証言がそろった。現場には証拠が残っていた：「${C.clue.text}」`);
    sys('話し合って、犯人を見つけよう。食いちがう証言は「⚡つきつける」で指摘できる。');
  }
  function finish() {
    const G = H.G, C = G.C, n = C.suspects.length, tally = Array(n).fill(0);
    // 投票しなかった人は棄権
    Object.values(G.votes).forEach(v => { if (v >= 0) tally[v]++; });
    const max = Math.max(...tally), tops = tally.map((v, i) => v === max ? i : -1).filter(i => i >= 0);
    const caught = max > 0 && tops.length === 1 && tops[0] === C.culprit;
    G.result = { tally, tops, caught, culprit: C.culprit, lieQ: G.lieQ };
    // 得点：犯人をつかまえたら、犯人に投票した探偵 +2。逃げきったら犯人 +3
    H.players.forEach((p, i) => { if (i === C.culprit) { if (!caught) p.score += 3; } else if (G.votes[i] === C.culprit) p.score += caught ? 2 : 1; });
    phase('result');
  }
  // ---- ホストが受け取る操作 ----
  function act(pi, a) {
    const G = H.G;
    if (a.t === 'start' && pi === 0 && H.phase === 'lobby' || a.t === 'next' && pi === 0 && H.phase === 'result') return startGame(), true;
    if (a.t === 'cpu+' && pi === 0 && H.phase === 'lobby') { addCpu(); return broadcast(), true; }
    if (a.t === 'cpu-' && pi === 0 && H.phase === 'lobby') { const k = H.players.map(p => p.cpu).lastIndexOf(true); if (k > 0) H.players.splice(k, 1); return broadcast(), true; }
    if (a.t === 'diff' && pi === 0 && H.phase === 'lobby') { H.diff = a.v; return broadcast(), true; }
    if (a.t === 'lobby' && pi === 0) { H.phase = 'lobby'; H.G = null; H.players = H.players.filter(p => !p.cpu || true); return broadcast(), true; }
    if (!G) return;
    if (a.t === 'ok' && H.phase === 'role') { G.ready = G.ready || {}; G.ready[pi] = 1; if (H.players.every((p, i) => p.cpu || !p.on || G.ready[i])) phase('testify'); else broadcast(); return; }
    if (a.t === 'testify' && H.phase === 'testify') {
      if (pi === G.C.culprit) { if (a.q === G.C.crime.p || !(a.q >= 0 && a.q < G.C.places.length)) return; G.lieQ = a.q; }
      G.testified[pi] = true;
      if (H.players.every((p, i) => G.testified[i] || !p.on)) phase('talk'); else broadcast();
      return;
    }
    if (a.t === 'chat' && (H.phase === 'talk' || H.phase === 'vote' || H.phase === 'result')) {
      const text = String(a.text || '').replace(/\s+/g, ' ').trim().slice(0, 120); if (!text) return;
      G.chat.push({ from: pi, text, at: Date.now() }); if (G.chat.length > 200) G.chat.splice(0, G.chat.length - 200);
      cpuReact(pi, text); return broadcast();
    }
    if (a.t === 'push' && H.phase === 'talk') {
      const A = G.statements.find(s => s.id === a.a), B = G.statements.find(s => s.id === a.b); if (!A || !B) return;
      const C = G.C, who = H.players[pi].name;
      if (MYS.pairContradicts(A, B)) {
        const key = [A.id, B.id].sort().join();
        if (!G.contras.some(x => x.key === key)) G.contras.push({ key, a: A.id, b: B.id, by: pi });
        sys(`⚡ 異議あり！ ${who}が、${C.suspects[A.by].nm}と${C.suspects[B.by].nm}の証言の食いちがいを指摘した！`);
        [A.by, B.by].forEach(b => { if (H.players[b].cpu) setTimeout(() => cpuSay(b, b === C.culprit ? pickOne(['ちがう！ ぼくは本当にそこにいたんだ！', 'ウソをついてるのは向こうだよ！', 'わ、わたしはウソなんて……']) : pickOne(['わたしは本当のことしか言ってないよ！', 'ウソをついてるのはあっちだ！', 'わたしの証言は本当です。'])), 1500 + Math.random() * 2000); });
      } else sys(`${who}が証言をつきつけた……けれど、食いちがいはなかった。`);
      return broadcast();
    }
    if (a.t === 'skip' && pi === 0) { if (H.phase === 'talk') phase('vote'); else if (H.phase === 'testify' || H.phase === 'role') timeUp(H.phase); else if (H.phase === 'vote') finish(); return; }
    if (a.t === 'vote' && H.phase === 'vote') {
      if (!(a.v >= -1 && a.v < G.C.suspects.length)) return;
      G.votes[pi] = a.v;
      if (H.players.every((p, i) => G.votes[i] !== undefined || !p.on)) finish(); else broadcast();
    }
  }
  const pickOne = a => a[Math.floor(Math.random() * a.length)];
  // ---- CPU ----
  function cpuTestify() {
    const G = H.G, C = G.C;
    H.players.forEach((p, i) => {
      if (!p.cpu) return;
      setTimeout(() => {
        if (H.phase !== 'testify') return;
        if (i === C.culprit) {
          // ひとりしかいない場所を選んで、そこの人に罪を着せる（いなければ、だれもいない場所）
          const tc = C.crime.t, occ = {}; C.truth.forEach((r, j) => { if (j !== i) occ[r[tc]] = (occ[r[tc]] || 0) + 1; });
          const qs = C.places.map((_, q) => q).filter(q => q !== C.crime.p);
          const one = qs.filter(q => occ[q] === 1), none = qs.filter(q => !occ[q]);
          G.lieQ = pickOne(one.length ? one : none.length ? none : qs);
        }
        act(i, { t: 'testify', q: G.lieQ });
      }, 1500 + Math.random() * 3000);
    });
  }
  function cpuSay(i, text) { if (!H.G || !(H.phase === 'talk' || H.phase === 'vote')) return; H.G.chat.push({ from: i, text, at: Date.now() }); broadcast(); }
  function cpuTalk() {
    const G = H.G, C = G.C, T = MYS.THEMES.find(t => t.id === C.theme);
    H.players.forEach((p, i) => {
      if (!p.cpu) return;
      const s = C.suspects[i];
      // 1回目：ヒントを話す（犯人はウソのヒントで、食いちがった相手に罪を着せる）
      setTimeout(() => {
        if (i === C.culprit) {
          const rival = C.suspects.findIndex((_, j) => j !== i && C.truth[j][C.crime.t] === G.lieQ);
          const a = pickOne([0, 1, 2].filter(x => x !== C.clue.k)), tgt = rival >= 0 ? rival : pickOne(C.suspects.map((_, j) => j).filter(j => j !== i));
          cpuSay(i, `わたし、見たんです。犯人の${T.attrs[a].nm}は「${T.attrs[a].v[C.suspects[tgt].attr[a]]}」だった気がします。`);
        } else { const h = C.hints[i]; cpuSay(i, `わたしの手がかり：${h.text}。`); }
      }, 3000 + Math.random() * 7000);
      // 2回目：あやしい人を言う
      setTimeout(() => {
        if (H.phase !== 'talk') return;
        const sus = cpuSuspect(i);
        if (sus >= 0) cpuSay(i, pickOne([`${C.suspects[sus].nm}があやしいと思う。`, `${C.suspects[sus].nm}の証言、どこかおかしくない？`, `わたしは${C.suspects[sus].nm}を疑ってる。`]));
      }, 14000 + Math.random() * 14000);
      // 食いちがいを見つけたらつきつける（探偵だけ）
      if (i !== C.culprit && Math.random() < .6) setTimeout(() => {
        if (H.phase !== 'talk') return;
        const lie = G.statements.find(st => st.lie), o = G.statements.find(st => !st.lie && MYS.pairContradicts(st, lie));
        if (o && !G.contras.length) act(i, { t: 'push', a: lie.id, b: o.id });
      }, 25000 + Math.random() * 30000);
    });
    void TIME;
  }
  function cpuSuspect(i) {
    const G = H.G, C = G.C;
    if (i === C.culprit) { const rival = C.suspects.findIndex((_, j) => j !== i && C.truth[j][C.crime.t] === G.lieQ); return rival >= 0 ? rival : pickOne(C.suspects.map((_, j) => j).filter(j => j !== i)); }
    // 自分のヒントと、公開の情報で考える（ほかの人の話したヒントも少し信じる）
    let cand = MYS.candidatesMP(C, G.statements, C.hints[i]).filter(x => x !== i);
    if (!cand.length) cand = C.suspects.map((_, j) => j).filter(j => j !== i);
    return pickOne(cand);
  }
  function cpuReact(from, text) {
    if (!H.G) return; const C = H.G.C;
    H.players.forEach((p, i) => { if (p.cpu && i !== from && text.includes(C.suspects[i].nm.replace(/^.*の/, '')) && Math.random() < .7) setTimeout(() => cpuSay(i, i === C.culprit ? pickOne(['えっ、わたし？ ちがいますよ！', 'わたしを疑うなんて、見当ちがいです。']) : pickOne(['わたしじゃないよ！ 証言を見て！', 'わたしは本当のことしか言ってない！'])), 1200 + Math.random() * 1800); });
  }
  function cpuVote() {
    const G = H.G;
    H.players.forEach((p, i) => { if (p.cpu) setTimeout(() => act(i, { t: 'vote', v: cpuSuspect(i) }), 2000 + Math.random() * 6000); });
    void G;
  }
  // ---- 画面に送る中身（プレイヤーごと） ----
  function viewFor(pi) {
    const v = { phase: H.phase, code: H.code, local: H.local, me: pi, round: H.round, diff: H.diff, left: H.deadline ? Math.max(0, Math.ceil((H.deadline - Date.now()) / 1000)) : 0,
      players: H.players.map(p => ({ name: p.name, cpu: p.cpu, on: p.on, score: p.score })) };
    const G = H.G; if (!G) return v;
    const C = G.C, me = pi, isC = me === C.culprit;
    v.g = {
      theme: C.theme, crime: C.crime, places: C.places, times: C.times, flavor: C.flavor,
      suspects: C.suspects.map(s => ({ nm: s.nm, emo: s.emo, attr: s.attr, line: s.line, img: s.img })),
      // 結果の画面のあいだに入った人は、つぎの事件まで見ているだけ
      my: me >= C.suspects.length ? { role: 'watch', truth: null, hint: null } : { role: isC ? 'culprit' : 'detective', truth: C.truth[me], hint: isC ? null : C.hints[me].text },
      testified: H.players.map((_, i) => !!G.testified[i]), ready: H.players.map((_, i) => !!(G.ready || {})[i]),
      chat: G.chat.slice(-80), voted: H.players.map((_, i) => G.votes[i] !== undefined), myVote: G.votes[me],
    };
    if (isC) v.g.my.lieQ = G.lieQ;
    if (H.phase === 'talk' || H.phase === 'vote' || H.phase === 'result') { v.g.statements = G.statements.map(s => ({ id: s.id, by: s.by, kind: s.kind, who: s.who, t: s.t, p: s.p })); v.g.clue = C.clue; v.g.contras = G.contras; }
    if (H.phase === 'result') { v.g.result = G.result; v.g.votes = G.votes; v.g.truth = C.truth; v.g.hints = C.hints; v.g.culprit = C.culprit; }
    return v;
  }
  let bcT = 0;
  function broadcast() {
    if (!H) return;
    H.players.forEach((p, i) => { const c = H.conns[p.pid]; if (c && p.on) { try { c.send({ t: 'view', v: viewFor(i) }); } catch (e) {} } });
    view = viewFor(0); render();
  }
  setInterval(() => { if (H && H.deadline) { bcT++; if (bcT % 5 === 0) broadcast(); else { view = viewFor(0); render(true); } } else if (view && view.left > 0 && !H) { view.left = Math.max(0, view.left - 1); render(true); } }, 1000);

  // ================= 部屋をつくる・入る =================
  async function host(local) {
    const name = ($('mpName').value || '').trim() || 'ホスト'; SV.name = name; saveSV();
    if (local) { newRoom('----', true); myPid = addPlayer(name); addCpu(); addCpu(); addCpu(); broadcast(); show('room'); return; }
    msg('部屋を作っています…');
    try {
      await loadPeerJS();
      let code = null;
      for (let k = 0; k < 6 && !peer; k++) { const c = String(1000 + Math.floor(Math.random() * 9000)); try { peer = await openPeer(PREFIX + c); code = c; } catch (e) { if (e.type !== 'unavailable-id') throw e; } }
      if (!peer) throw new Error('部屋を作れなかった');
      newRoom(code, false); myPid = addPlayer(name);
      peer.on('connection', c => c.on('open', () => {
        if (c._opened) return; c._opened = 1;
        c.on('data', d => {
          if (d.t === 'hello') {
            if (c._pi != null) return;   // 2回目の「こんにちは」は無視
            if (H.phase !== 'lobby' && H.phase !== 'result' && !H.players.some(p => p.name === d.name && !p.on)) { c.send({ t: 'full', why: 'ゲームが始まっています。結果の画面になったら入れるよ' }); return; }
            const back = H.players.findIndex(p => !p.cpu && !p.on && p.name === d.name);
            if (back >= 0) { H.conns[H.players[back].pid] = c; H.players[back].on = true; H.players[back].seen = Date.now(); c._pi = back; sys(`${d.name}がもどってきた`); }
            else { if (H.players.length >= MAXP) { const k = H.players.map(p => p.cpu).lastIndexOf(true); if (k > 0) H.players.splice(k, 1); else { c.send({ t: 'full', why: '満員です' }); return; } } const pid = addPlayer(d.name, false, c); c._pi = H.players.findIndex(p => p.pid === pid); }
            broadcast(); return;
          }
          if (c._pi == null || c._dead) return;
          const pl = H.players[c._pi]; if (pl) pl.seen = Date.now();
          if (d.t === 'ping') return;
          act(c._pi, d);
        });
        const gone = () => { if (c._pi == null || c._dead) return; dropped(c._pi, 'close'); };
        c.on('close', gone);
        try { c.peerConnection.addEventListener('iceconnectionstatechange', () => { const st = c.peerConnection.iceConnectionState; if (st === 'failed' || st === 'closed') gone(); }); } catch (e) {}
      }));
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
      broadcast(); show('room');
    } catch (e) { msg('部屋を作れなかった（' + (e.type || e.message) + '）'); }
  }
  function dropped(pi, why) {
    const p = H && H.players[pi]; if (!p || p.cpu || !p.on || pi === 0) return;
    p.on = false; const c = H.conns[p.pid]; if (c) { c._dead = 1; try { c.close(); } catch (e) {} }
    sys(`${p.name}の通信が切れた`);
    if (H.phase === 'lobby') { H.players.splice(pi, 1); reindex(); }
    else if (H.G) {   // 待っている相手が切れたら、すぐ次へ
      const G = H.G, all = f => H.players.every((pp, i) => f(i) || !pp.on);
      if (H.phase === 'role' && all(i => q(G.ready, i))) phase('testify');
      else if (H.phase === 'testify' && all(i => G.testified[i])) { if (G.lieQ == null) G.lieQ = randomQ(); phase('talk'); }
      else if (H.phase === 'vote' && all(i => G.votes[i] !== undefined)) finish();
    }
    broadcast(); void why;
  }
  const q = (o, i) => !!(o || {})[i];
  setInterval(() => { if (!H || H.local) return; const now = Date.now(); H.players.forEach((p, i) => { if (!p.cpu && p.on && i > 0 && now - (p.seen || now) > 8000) dropped(i, 'timeout'); }); }, 1000);
  function reindex() { for (const pid in H.conns) { const c = H.conns[pid]; c._pi = H.players.findIndex(p => p.pid === pid); if (c._pi < 0) delete H.conns[pid]; } }
  async function join() {
    const code = ($('mpCode').value || '').replace(/\D/g, ''); if (code.length !== 4) return msg('4けたの部屋番号を入れてね');
    const name = ($('mpName').value || '').trim() || 'ゲスト'; SV.name = name; saveSV();
    msg('つないでいます…');
    // 前に入れなかったときの接続が残っていたら、片づけてからつなぎ直す
    clearInterval(pingT); try { if (hostConn) hostConn.close(); } catch (e) {} try { if (peer) peer.destroy(); } catch (e) {} peer = null; hostConn = null; view = null;
    try {
      await loadPeerJS(); peer = await openPeer(null);
      const c = peer.connect(PREFIX + code, { reliable: true });
      const t = setTimeout(() => { if (!view) msg('部屋が見つからない（番号を確かめてね）'); }, 10000);
      peer.on('error', e => { if (e.type === 'peer-unavailable') { clearTimeout(t); msg('部屋が見つからない（番号を確かめてね）'); } });
      c.on('open', () => { clearTimeout(t); if (hostConn) return; hostConn = c; c.send({ t: 'hello', name }); clearInterval(pingT); pingT = setInterval(() => { try { if (hostConn && hostConn.open) hostConn.send({ t: 'ping' }); } catch (e) {} }, 2000); });
      c.on('data', d => { if (d.t === 'view') { view = d.v; if ($('mpTop').hidden === false) show('room'); render(); } if (d.t === 'full') { c._full = 1; msg('入れなかった：' + d.why); setTimeout(() => { clearInterval(pingT); try { c.close(); } catch (e) {} try { if (peer) peer.destroy(); } catch (e) {} peer = null; hostConn = null; }, 300); } });
      c.on('close', () => { if (c._full || hostConn !== c) return; msg('ホストとの通信が切れた'); view = null; show('top'); });
    } catch (e) { msg('つなげなかった（' + (e.type || e.message) + '）'); }
  }
  let pingT = 0;
  window.addEventListener('pagehide', () => { try { if (hostConn) hostConn.close(); if (peer) peer.destroy(); } catch (e) {} });
  function send(a) { if (H) act(0, a); else if (hostConn) hostConn.send(a); }
  function leave() {
    if (H) { clearTimeout(H.timer); H = null; }
    try { if (hostConn) hostConn.close(); } catch (e) {} try { if (peer) peer.destroy(); } catch (e) {}
    clearInterval(pingT); peer = null; hostConn = null; view = null; show('top');
  }

  // ================= 画面 =================
  const msg = t => { $('mpMsg').textContent = t; };
  function show(w) { $('mpTop').hidden = w !== 'top'; $('mpRoom').hidden = w !== 'room'; if (w === 'top') document.body.className = ''; }
  let sel = [], lastSig = '', chatScrolled = false;
  function render(tick) {
    if (!view) return;
    const v = view, g = v.g, box = $('mpRoom');
    if (g) document.body.className = g.theme; else document.body.className = '';
    // 時間だけ更新
    const tl = $('mpLeft'); if (tl) tl.textContent = v.left ? `のこり ${v.left}秒` : '';
    if (tick) return;
    const sig = JSON.stringify([v.phase, v.players, g && [g.testified, g.ready, g.chat.length, g.contras && g.contras.length, g.voted, g.myVote, g.my.lieQ], sel]);
    if (sig === lastSig) return; lastSig = sig;
    const isHost = !!H, me = v.me;
    const T = g && MYS.THEMES.find(t => t.id === g.theme);
    let h = `<div class="mphead"><button class="ic" id="mpLeave" aria-label="部屋を出る">✕</button><div class="t"><b>${v.local ? 'CPUと練習' : `部屋 ${esc(v.code)}`}</b><small>${phaseName(v.phase)}${v.round ? `・第${v.round}の事件` : ''}</small></div><span id="mpLeft" class="left">${v.left ? `のこり ${v.left}秒` : ''}</span></div>`;
    // 参加者
    h += `<div class="who-row">${v.players.map((p, i) => `<span class="pp ${i === me ? 'me' : ''} ${p.on ? '' : 'off'}">${g && g.suspects[i] ? g.suspects[i].emo : p.cpu ? '🤖' : '🙂'} ${esc(p.name)}${p.cpu ? '' : ''} <b>${p.score}</b>${g && v.phase === 'testify' ? (g.testified[i] ? ' ✓' : ' …') : ''}${g && v.phase === 'vote' ? (g.voted[i] ? ' ✓' : ' …') : ''}</span>`).join('')}</div>`;
    if (v.phase === 'lobby') {
      h += `<div class="panel"><b>あそびかた</b><div class="hint">みんなは事件の容疑者。<b>だれか1人がこっそり犯人</b>（CPUのこともある）。<br>犯人以外の証言は自動で本当のことになる。犯人だけが、事件の時間にどこにいたかウソをつく。<br>証言の食いちがい・現場の証拠・自分だけのヒントを話し合って、投票で犯人を当てよう。犯人は逃げきれば勝ち！</div></div>`;
      h += `<div class="panel">参加 ${v.players.length}人（${MINP}〜${MAXP}人。足りないぶんはCPU）${v.local ? '' : `<div class="hint">友だちに部屋番号 <b style="font-size:1.3rem;color:var(--acc)">${esc(v.code)}</b> を教えてね</div>`}</div>`;
      if (isHost) h += `<div class="panel"><div class="row2"><button class="btn" id="mpCm">CPU −</button><button class="btn" id="mpCp">CPU ＋</button></div><div class="row2" style="margin-top:8px">${Object.entries(MYS.DIFF).map(([k, d]) => `<button class="btn ${v.diff === k ? 'main' : ''}" data-diff="${k}">${d.nm}</button>`).join('')}</div><div class="hint" style="margin-top:6px">むずかしいほど場所と時間がふえる</div><button class="btn main red" id="mpStart" style="width:100%;margin-top:10px">▶ 事件をはじめる</button></div>`;
      else h += `<div class="panel hint">ホストが始めるのを待っています…</div>`;
    }
    if (g && v.phase === 'role') {
      const s = g.suspects[me];
      h += crimeBox(g) + `<div class="panel rolecard ${g.my.role}">${window.NAZO_POR(s, 'lg')}<div><div class="hint">あなたの役</div><b style="font-size:1.2rem">${esc(s.nm)}</b><div class="role">${g.my.role === 'culprit' ? '🔪 あなたが<b>犯人</b>！ ウソのアリバイでみんなをだまそう' : '🔍 あなたは<b>探偵</b>（無実）。犯人を見つけよう'}</div><div class="hint">${T.attrs.map((a, k) => `${a.nm}：${a.v[s.attr[k]]}`).join('　')}</div></div></div>`;
      h += truthBox(g, me) + (g.my.hint ? `<div class="panel secret">🤫 あなただけのヒント：<b>${esc(g.my.hint)}</b><div class="hint">話し合いで言うかどうかは、あなたしだい（犯人もウソのヒントを言うかも！）</div></div>` : `<div class="panel secret">🤫 犯人には、ヒントはない。ほかの人のヒントにまぎれて、ウソのヒントを言ってもいい。</div>`);
      h += `<button class="btn main" id="mpOk" style="width:100%" ${g.ready[me] ? 'disabled' : ''}>${g.ready[me] ? 'みんなを待っています…' : 'わかった'}</button>`;
    }
    if (g && v.phase === 'testify') {
      h += crimeBox(g);
      if (g.my.role === 'culprit') {
        h += `<div class="panel rolecard culprit"><b>🔪 ウソのアリバイを決めよう</b><div class="hint">本当は ${esc(g.times[g.crime.t])} に${esc(g.places[g.crime.p])}にいた。かわりに「どこにひとりでいた」と言う？<br>だれかがいた場所を選ぶと、その人の証言と食いちがう。1人しかいなかった場所なら、その人に罪を着せられるかも。</div><div class="grid2">${g.places.map((p, i) => i === g.crime.p ? '' : `<button class="btn ${g.my.lieQ === i ? 'main red' : ''}" data-q="${i}">${esc(p)}</button>`).join('')}</div></div>`;
        h += `<div class="hint">ほかの時間は、本当の居場所が自動で証言される。</div>`;
      } else h += `<div class="panel">あなたの証言は、本当の居場所が自動で出される。${g.testified[me] ? '<div class="hint">ほかの人を待っています…</div>' : ''}</div>${truthBox(g, me)}`;
      if (g.my.role !== 'culprit' && !g.testified[me]) h += `<button class="btn main" id="mpTest" style="width:100%">証言する</button>`;
    }
    if (g && (v.phase === 'talk' || v.phase === 'vote' || v.phase === 'result')) {
      h += crimeBox(g);
      if (v.phase !== 'result') h += `<div class="panel secret">${g.my.role === 'culprit' ? `🔪 あなたは犯人（ウソの居場所：${esc(g.places[g.my.lieQ])}）` : `🤫 あなただけのヒント：<b>${esc(g.my.hint)}</b>`}</div>`;
      h += `<div class="panel" style="border-color:var(--acc2)">🔎 現場の証拠：<b>${esc(g.clue.text)}</b><div class="hint">${T.attrs[g.clue.k].nm}が「${T.attrs[g.clue.k].v[g.clue.v]}」の人：${g.suspects.filter(s => s.attr[g.clue.k] === g.clue.v).map(s => s.emo + esc(s.nm)).join('、')}</div></div>`;
      h += timelineMP(g);
    }
    if (g && v.phase === 'talk') {
      h += `<details class="panel" ${sel.length ? 'open' : ''}><summary><b>⚡ 証言をつきつける</b>（2枚えらぶ）</summary><div class="cards">${g.statements.map(st => cardMP(g, st)).join('')}</div><button class="btn main" id="mpPush" style="width:100%;margin-top:8px" ${sel.length === 2 ? '' : 'disabled'}>⚡ つきつける（${sel.length}/2）</button></details>`;
      h += chatBox(g, v) + (isHost ? `<button class="btn" id="mpSkip" style="width:100%">投票へ進む（ホスト）</button>` : '');
    }
    if (g && v.phase === 'vote') {
      h += `<div class="panel"><b>☝️ 犯人だと思う人に投票</b><div class="grid2">${g.suspects.map((s, i) => `<button class="btn ${g.myVote === i ? 'main red' : ''}" data-vote="${i}">${window.NAZO_POR(s, 'sm')} ${esc(s.nm)}<small style="display:block;opacity:.7">${esc(v.players[i].name)}</small></button>`).join('')}</div><div class="hint">いちばん票が多い人が犯人として捕まる（同じ票数なら犯人の逃げきり）</div></div>` + chatBox(g, v) + (isHost ? `<button class="btn" id="mpSkip" style="width:100%">投票をしめきる（ホスト）</button>` : '');
    }
    if (g && v.phase === 'result') {
      const r = g.result, c = g.suspects[r.culprit];
      h += `<div class="panel result ${r.caught ? 'win' : 'lose'}"><div class="big-msg">${r.caught ? '犯人確保！' : '犯人は逃げきった…'}</div>${window.NAZO_POR(c, 'lg')}<div style="text-align:center">犯人は <b>${esc(c.nm)}</b>（${esc(v.players[r.culprit].name)}）だった！</div>
        <div class="hint" style="text-align:center">ウソのアリバイ：「${esc(g.times[g.crime.t])}は${esc(g.places[r.lieQ])}にひとりでいた」　本当は${esc(g.places[g.crime.p])}</div>
        <div class="votes">${g.suspects.map((s, i) => `<div>${s.emo} ${esc(s.nm)}（${esc(v.players[i].name)}）<b>${r.tally[i]}票</b>${g.votes[i] !== undefined && g.votes[i] >= 0 ? `<small>→ ${esc(g.suspects[g.votes[i]].nm)}</small>` : ''}</div>`).join('')}</div>
        <div class="hint">ヒント：${Object.entries(g.hints).map(([i, x]) => `${g.suspects[i].emo}${esc(x.text)}`).join(' ／ ')}</div>
        <div class="hint">得点：犯人を当てた探偵 +2（逃げられても当てていれば +1）、逃げきった犯人 +3</div></div>`;
      h += chatBox(g, v);
      if (isHost) h += `<div class="row2"><button class="btn" id="mpLobby">部屋にもどる</button><button class="btn main red" id="mpNext">▶ つぎの事件</button></div>`;
      else h += `<div class="panel hint">${g.my.role === 'watch' ? '途中から入ったので、つぎの事件から参加するよ。' : ''}ホストがつぎの事件を始めるのを待っています…</div>`;
    }
    const st = $('mpChatLog') ? $('mpChatLog').scrollTop : 0, atBottom = $('mpChatLog') ? $('mpChatLog').scrollHeight - st - $('mpChatLog').clientHeight < 40 : true;
    const draft = $('mpChatIn') ? $('mpChatIn').value : '', focus = document.activeElement && document.activeElement.id === 'mpChatIn';
    box.innerHTML = h;
    // 入力中の文字とスクロールを残す
    const ci = $('mpChatIn'); if (ci) { ci.value = draft; if (focus) ci.focus(); }
    const cl = $('mpChatLog'); if (cl) cl.scrollTop = atBottom ? cl.scrollHeight : st;
    bind(v);
    void chatScrolled;
  }
  function phaseName(p) { return { lobby: '待ち合わせ', role: '役わり', testify: '証言', talk: '話し合い', vote: '投票', result: '結果' }[p] || ''; }
  function crimeBox(g) { return `<div class="panel" style="border:2px solid var(--acc)"><b>${esc(g.crime.text)}！</b><div class="hint">事件は <b>${esc(g.times[g.crime.t])}</b>、<b>${esc(g.places[g.crime.p])}</b>。犯人はそのとき、ひとりで現場にいた。</div></div>`; }
  function truthBox(g, me) { return `<div class="panel"><b>あなたの本当の居場所</b><div class="hint">${g.times.map((t, i) => `${esc(t)}：${esc(g.places[g.my.truth[i]])}${i === g.crime.t ? ' ⚠' : ''}`).join('　')}</div></div>`; void me; }
  function textMP(g, st) { const C = { theme: g.theme, times: g.times, places: g.places, suspects: g.suspects }; return MYS.textOf(C, st); }
  function cardMP(g, st) {
    const s = g.suspects[st.by], inC = g.contras.some(x => x.a === st.id || x.b === st.id);
    return `<button class="card ${sel.includes(st.id) ? 'sel' : ''} ${inC ? 'contra' : ''}" data-st="${st.id}"><div class="av">${window.NAZO_POR(s, 'sm')}</div><div><div class="who">${esc(s.nm)}</div><span class="tm">${esc(g.times[st.t])}</span>${esc(textMP(g, st))}</div><span class="ck"></span></button>`;
  }
  function timelineMP(g) {
    const cell = {}; for (const st of g.statements) MYS.factsOf(st).facts.forEach(([w, t, p]) => { const k = w + '_' + t; (cell[k] = cell[k] || new Set()).add(p); });
    const bad = MYS.conflictCells(g.statements);
    let h = `<div class="tl panel" style="padding:8px"><table><tr><th>だれが いつ どこに？</th>${g.times.map((t, i) => `<th class="${i === g.crime.t ? 'crime' : ''}">${esc(t)}${i === g.crime.t ? '⚠' : ''}</th>`).join('')}</tr>`;
    g.suspects.forEach((s, i) => {
      h += `<tr><td class="nm">${s.emo} ${esc(s.nm.replace(/^.*の/, ''))}</td>`;
      g.times.forEach((_, t) => { const ps = [...(cell[i + '_' + t] || [])], b = bad.has(i + '_' + t); h += `<td class="${t === g.crime.t ? 'crime' : ''}">${ps.map(p => `<span class="pl ${b ? 'bad' : ''}">${esc(g.places[p])}</span>`).join('') || '？'}</td>`; });
      h += '</tr>';
    });
    // ひとりだったと言っているのに、ほかの人もいたことになっている場所
    return h + `</table><div class="hint">赤＝証言が食いちがっている（同じ時間に2か所／「ほかにだれもいなかった」のに、いたと言う人がいる）。証言カードは「⚡つきつける」から見られる。</div></div>`;
  }
  function chatWho(g, v, i) { const s = g.suspects[i], p = v.players[i], pn = p ? esc(p.name) : '？'; return s ? `${s.emo} ${esc(s.nm)}（${pn}）` : `👀 ${pn}`; }
  function chatBox(g, v) {
    return `<div class="panel chat"><div id="mpChatLog" class="log">${g.chat.map(m => m.from < 0 ? `<div class="sys">${esc(m.text)}</div>` : `<div class="m ${m.from === v.me ? 'mine' : ''}"><span>${chatWho(g, v, m.from)}</span>${esc(m.text)}</div>`).join('')}</div>
      ${v.phase !== 'result' || true ? `<div class="quick">${['あやしい！', 'わたしは本当のことを言ってる', '証拠と合うのはだれ？', 'ヒントを教えて！'].map(q => `<button class="btn" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div><div class="say-row"><input id="mpChatIn" maxlength="120" placeholder="ここに書いて話し合う" enterkeyhint="send"><button class="btn main" id="mpSend">送る</button></div>` : ''}</div>`;
  }
  function bind(v) {
    const on = (id, f) => { const e = $(id); if (e) e.onclick = f; };
    on('mpLeave', () => { if (confirm('部屋を出る？')) leave(); });
    on('mpCp', () => send({ t: 'cpu+' })); on('mpCm', () => send({ t: 'cpu-' }));
    on('mpStart', () => send({ t: 'start' })); on('mpNext', () => { sel = []; send({ t: 'next' }); }); on('mpLobby', () => send({ t: 'lobby' }));
    on('mpOk', () => send({ t: 'ok' })); on('mpTest', () => send({ t: 'testify' }));
    on('mpSkip', () => send({ t: 'skip' }));
    on('mpPush', () => { if (sel.length === 2) { send({ t: 'push', a: sel[0], b: sel[1] }); sel = []; lastSig = ''; render(); } });
    document.querySelectorAll('#mpRoom [data-diff]').forEach(b => b.onclick = () => send({ t: 'diff', v: b.dataset.diff }));
    document.querySelectorAll('#mpRoom [data-q]').forEach(b => b.onclick = () => send({ t: 'testify', q: +b.dataset.q }));
    document.querySelectorAll('#mpRoom [data-vote]').forEach(b => b.onclick = () => send({ t: 'vote', v: +b.dataset.vote }));
    document.querySelectorAll('#mpRoom [data-st]').forEach(b => b.onclick = () => { const id = b.dataset.st, k = sel.indexOf(id); if (k >= 0) sel.splice(k, 1); else { sel.push(id); if (sel.length > 2) sel.shift(); } lastSig = ''; render(); });
    document.querySelectorAll('#mpRoom [data-quick]').forEach(b => b.onclick = () => { const i = $('mpChatIn'); i.value = (i.value + ' ' + b.dataset.quick).trim(); i.focus(); });
    const sendChat = () => { const i = $('mpChatIn'); if (!i || !i.value.trim()) return; const t = i.value; i.value = ''; send({ t: 'chat', text: t }); };
    on('mpSend', sendChat);
    const ci = $('mpChatIn'); if (ci) ci.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendChat(); } };
    void v;
  }

  // ================= はじめ =================
  $('mpName').value = SV.name || (window.GAMES_ACC ? GAMES_ACC.name() : '');
  $('mpHost').onclick = () => host(false);
  $('mpLocal').onclick = () => host(true);
  $('mpJoin').onclick = join;
  $('mpCode').onkeydown = e => { if (e.key === 'Enter') join(); };
  $('mpBack').onclick = () => { leave(); window.NAZO_HOME(); };
  window.NAZO_MP = { open() { show('top'); }, get view() { return view; }, get H() { return H; }, act: (i, a) => H && act(i, a) };
})();
