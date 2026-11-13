// GAMES 共通のオンラインランキング（と名前）
// 使い方（各ゲーム）：
//   <script src="../rank.js"></script>
//   GAMES_RANK.mount('fish')            … 画面のすみに 🏆 ボタンを出す（押すとランキング）
//   GAMES_RANK.report('fish', 42.5)     … 記録が自己ベストを超えたら送る（何度呼んでもよい）
//   GAMES_RANK.show('fish')             … ランキングを開く
// claude.ai のゲーム置き場では claude.ai の共有データベース、それ以外（GitHub など）では Firebase を使う。
// 保存するのは「名前・記録の数字・日時」だけ。
(function () {
  if (window.GAMES_RANK) return;
  const META = {
    uparun: { t: 'ウパラン', unit: '点', daily: true },
    fish: { t: 'ほったらかし釣り堀', unit: '%', sub: '図鑑コンプリート率', dec: 1 },
    pachinko: { t: '夜祭り金魚', unit: '連', sub: '最大連チャン' },
    digger: { t: 'コア・ディガー', unit: '', sub: 'クリアタイム', order: 'asc', time: true },
    adcloser: { t: '閉じろ！広告地獄', unit: '点' },
    cards: { t: 'けものの星', unit: '勝', sub: 'バトルの勝利数' },
    bukken: { t: '物件王', unit: '', sub: '総売上', money: true },
    mystery: { t: 'ナゾトキ探偵 ∞', unit: '件', sub: '解決した事件' },
    td: { t: 'ねこ砦', unit: 'ウェーブ', sub: '到達ウェーブ' },
    screw: { t: 'ねじぬき工房', unit: 'ステージ', sub: 'クリアしたステージ' },
    orbit: { t: 'オービットホップ', unit: '点' },
    upa: { t: 'うぱるぱスピリッツ', unit: '勝', sub: 'CPU戦の勝利数' },
    fighter: { t: '嵐拳', unit: '勝', sub: 'オンライン対戦の勝利数' },
    moon: { t: '月面おそうじ局', unit: '%', sub: '月面清掃率', dec: 2 },
    shusha: { t: '出社できない', unit: 'ステージ', sub: 'クリアしたステージ数' },
  };
  const IN_CLAUDE = /(^|\.)claudeusercontent\.com$|(^|\.)claude\.ai$/.test(location.hostname);
  const FB_CONFIG = {
    apiKey: 'AIzaSyBowpy-aRjDW64x-MM2RLXAWYwtKdn0vS8', authDomain: 'shima-games.firebaseapp.com', projectId: 'shima-games',
    storageBucket: 'shima-games.firebasestorage.app', messagingSenderId: '609168649733', appId: '1:609168649733:web:b120491bd75e31434ab66c',
  };
  const ACC = 'games-account', BEST = 'games-rank-best';
  const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
  const norm = s => (s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const hex = s => Array.from(new TextEncoder().encode(s), b => b.toString(16).padStart(2, '0')).join('').slice(0, 300);
  const cleanName = s => (s || '').normalize('NFKC').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10);
  const okName = s => /^[\p{L}\p{N}_\-・ー〜!?！？☆★♪.]+$/u.test(s.replace(/\s/g, ''));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 日本時間の日付（デイリーランキング用）：20261113 の形
  const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
  const better = (g, a, b) => (META[g] && META[g].order === 'asc') ? a < b : a > b; // a が b より良いか

  // ---------- つなぎ先：claude.ai ----------
  function claudeBackend() {
    let db = null, uid = null, ready = null, why = '';
    async function init() {
      for (let i = 0; i < 100 && !(window.claude && claude.use); i++) await new Promise(r => setTimeout(r, 100));
      if (!window.claude || !claude.use) { why = 'A'; return false; }
      try {
        const [d, u] = await Promise.all([claude.use('db'), claude.use('user')]);
        if (!d) { why = 'B'; return false; } if (!u) { why = 'C'; return false; }
        const id = await u.id(); if (!id) { why = 'D'; return false; }
        db = d; uid = id; return true;
      } catch (e) { why = 'E'; return false; }
    }
    const col = (g, d) => 'rk_' + g + (d ? '_day' : '');
    const saves = () => db.collection('data/users/' + uid);
    return {
      kind: 'claude', get uid() { return uid; }, get why() { return why; },
      on: async () => { if (db) return true; if (!ready) ready = init().then(ok => { if (!ok) ready = null; return ok; }); return ready; },
      async getName() { try { const a = await db.doc('accounts/' + uid).get(); if (a.exists) return a.data().name; } catch (e) {} return ''; },
      async claim(name) {
        const key = norm(name);
        const L = await db.doc('locks/' + hex(key)).acquire({ holder: uid, ttlMs: 8000 });
        if (!L.acquired) return { ok: false, why: 'いま同じ名前をだれかが登録中。少し待ってね' };
        const q = await db.collection('accounts').where('key', '==', key).get();
        if (q.docs.some(d => d.id !== uid)) return { ok: false, why: 'その名前はもう使われています' };
        await db.doc('accounts/' + uid).set({ name, key, at: Date.now() });
        return { ok: true };
      },
      canSync: () => !!db,
      async pullSaves() { const q = await saves().get(); const o = {}; q.docs.forEach(d => { const v = d.data(); if (v && typeof v.k === 'string') o[v.k] = v; }); return o; },
      async pushSave(k, v, t) { await saves().doc(hex(k)).set({ k, v, t }); },
      async getMine(g, d) { const r = await db.doc(`${col(g, d)}/${uid}`).get(); if (!r.exists) return null; const v = r.data(); return d && v.day !== d ? null : v; },
      async put(g, v, d) { await db.doc(`${col(g, d)}/${uid}`).set(d ? { ...v, day: d } : v); },
      async list(g, d) {
        const asc = META[g] && META[g].order === 'asc';
        if (d) { const q = await db.collection(col(g, d)).where('day', '==', d).get(); return q.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => asc ? a.score - b.score : b.score - a.score).slice(0, 60); }
        const q = await db.collection(col(g)).orderBy('score', asc ? 'asc' : 'desc').limit(60).get();
        return q.docs.map(x => ({ id: x.id, ...x.data() }));
      },
    };
  }
  // ---------- つなぎ先：Firebase ----------
  function fbBackend() {
    const BASE = 'https://www.gstatic.com/firebasejs/10.12.2/';
    let F = null, fs = null, uid = null, ready = null, why = '', A = null, auth = null;
    async function init() {
      try {
        const [app, au, st] = await Promise.all([import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js')]);
        const a = app.getApps().length ? app.getApp() : app.initializeApp(FB_CONFIG);
        auth = au.getAuth(a); A = au; F = st; fs = st.getFirestore(a);
        await au.setPersistence(auth, au.browserLocalPersistence).catch(() => {});
        await new Promise(r => { const off = au.onAuthStateChanged(auth, () => { off(); r(); }); });
        if (!auth.currentUser) await au.signInAnonymously(auth);
        uid = auth.currentUser.uid; return true;
      } catch (e) { why = 'F'; console.warn('rank', e); return false; }
    }
    const runs = (g, d) => F.collection(fs, 'ranks', d ? `${g}_d${d}` : g, 'runs');
    return {
      kind: 'firebase', get uid() { return uid; }, get why() { return why; },
      on: async () => { if (uid) return true; if (!ready) ready = init().then(ok => { if (!ok) ready = null; return ok; }); return ready; },
      async getName() { try { const a = await F.getDoc(F.doc(fs, 'accounts', uid)); if (a.exists()) return a.data().name; } catch (e) {} return ''; },
      async claim(name) {
        const key = hex(norm(name)), ref = F.doc(fs, 'names', key);
        const accRef = F.doc(fs, 'accounts', uid), accOld = await F.getDoc(accRef), keep = accOld.exists() ? accOld.data() : {};
        const cur = await F.getDoc(ref);
        if (cur.exists() && cur.data().uid !== uid) return { ok: false, why: 'その名前はもう使われています' };
        if (!cur.exists()) { try { await F.setDoc(ref, { uid, name }); } catch (e) { return { ok: false, why: 'その名前はもう使われています' }; } }
        const old = await this.getName();
        if (old && norm(old) !== norm(name)) { try { await F.deleteDoc(F.doc(fs, 'names', hex(norm(old)))); } catch (e) {} }
        await F.setDoc(accRef, { ...keep, name });
        return { ok: true };
      },
      // ---- 合言葉（ほかの端末でも同じ名前を使う） ----
      // 本物のメールは使わない。中で作った住所（ID@players.shima-games.invalid）と合言葉で、同じアカウントに入れるようにする
      hasPass() { return !!(auth && auth.currentUser && !auth.currentUser.isAnonymous); },
      canSync() { return this.hasPass(); },
      async pullSaves() { const q = await F.getDocs(F.collection(fs, 'saves', uid, 'keys')); const o = {}; q.docs.forEach(d => { const v = d.data(); if (v && typeof v.k === 'string') o[v.k] = v; }); return o; },
      async pushSave(k, v, t) { await F.setDoc(F.doc(fs, 'saves', uid, 'keys', hex(k)), { k, v, t }); },
      async setPass(pass) {
        const u = auth.currentUser, mail = u.email || `${uid.toLowerCase()}@players.shima-games.invalid`;
        if (u.isAnonymous) await A.linkWithCredential(u, A.EmailAuthProvider.credential(mail, pass));
        else await A.updatePassword(u, pass);
        const acc = await F.getDoc(F.doc(fs, 'accounts', uid));
        await F.setDoc(F.doc(fs, 'accounts', uid), { ...(acc.exists() ? acc.data() : {}), mail });
        // 自分用の控え（セーブと同じ、自分しか読めない場所）
        await F.setDoc(F.doc(fs, 'saves', uid, 'keys', 'pass-note'), { k: 'pass-note', v: pass, t: Date.now() });
      },
      async passNote() { const r = await F.getDoc(F.doc(fs, 'saves', uid, 'keys', 'pass-note')); return r.exists() ? r.data().v : ''; },
      async login(name, pass) {
        const n = await F.getDoc(F.doc(fs, 'names', hex(norm(name))));
        if (!n.exists()) return { ok: false, why: 'その名前は見つからなかった' };
        const acc = await F.getDoc(F.doc(fs, 'accounts', n.data().uid));
        const mail = acc.exists() && acc.data().mail;
        if (!mail) return { ok: false, why: 'その名前には、まだ合言葉が設定されていないよ（前の端末で設定してね）' };
        // 今の端末の仮の名前の予約は消しておく（合言葉なしの名前なら）
        const cur = auth.currentUser;
        if (cur && cur.isAnonymous) { try { const a = await F.getDoc(F.doc(fs, 'accounts', cur.uid)); if (a.exists() && norm(a.data().name) !== norm(name)) await F.deleteDoc(F.doc(fs, 'names', hex(norm(a.data().name)))); } catch (e) {} }
        try { await A.signInWithEmailAndPassword(auth, mail, pass); }
        catch (e) { return { ok: false, why: /too-many/.test(e.code || '') ? '何回もまちがえたので、少し待ってからためしてね' : '合言葉がちがうみたい' }; }
        uid = auth.currentUser.uid; return { ok: true, name: n.data().name };
      },
      async getMine(g, d) { const r = await F.getDoc(F.doc(runs(g, d), uid)); return r.exists() ? r.data() : null; },
      async put(g, v, d) { await F.setDoc(F.doc(runs(g, d), uid), v); },
      async list(g, d) {
        const q = await F.getDocs(F.query(runs(g, d), F.orderBy('score', META[g] && META[g].order === 'asc' ? 'asc' : 'desc'), F.limit(60)));
        return q.docs.map(d => ({ id: d.id, ...d.data() }));
      },
    };
  }
  const B = IN_CLAUDE ? claudeBackend() : fbBackend();

  // ---------- 名前 ----------
  let nameCache = null;
  async function myName() {
    if (nameCache) return nameCache;
    if (!(await B.on())) return '';
    let n = await B.getName();
    if (!n) { // この端末だけで決めた名前があれば、空いていれば名簿にのせる
      const a = ls.get(ACC, null);
      if (a && a.name) { const c = await claim(a.name); if (c.ok) n = c.name; }
    }
    if (n) { nameCache = n; const a = ls.get(ACC, null); if (!a || a.name !== n || !a.shared) ls.set(ACC, { name: n, key: norm(n), shared: true }); }
    return n || '';
  }
  async function claim(raw) {
    const name = cleanName(raw);
    if (!name) return { ok: false, why: '名前を入れてね' };
    if (!okName(name)) return { ok: false, why: '使えない記号が入っています' };
    if (!(await B.on())) return { ok: false, why: 'つながっていません' };
    const r = await B.claim(name);
    if (!r.ok) return r;
    nameCache = name; ls.set(ACC, { name, key: norm(name), shared: true });
    // 名前が変わったら、のっている記録の名前もあとで直る（次に送るとき）
    return { ok: true, name };
  }

  // ---------- 記録を送る ----------
  const queue = {}; let timer = 0, sending = false;
  // 自己ベストを超えていれば送る。sub は2つ目の数字（ないなら省略）
  // 自己ベストを更新したら true
  // opt.old：前に出した記録を送り直すだけ（今日の記録にはしない）
  function report(g, score, sub, opt) {
    if (!META[g] || !Number.isFinite(+score)) return false;
    score = +score;
    const best = ls.get(BEST, {});
    const prev = best[g]; let up = false, any = false;
    if (prev && !better(g, score, prev.score)) { if (!prev.sent) any = true; }
    else { best[g] = { score, sub: sub ?? null, sent: false }; up = true; any = true; }
    if (META[g].daily && !(opt && opt.old)) { // 今日のベスト
      const d = today(), k = g + '@', p = best[k];
      if (!p || p.day !== d || better(g, score, p.score)) { best[k] = { day: d, score, sub: sub ?? null, sent: false }; any = true; }
      else if (!p.sent) any = true;
    }
    ls.set(BEST, best);
    if (any) { queue[g] = 1; clearTimeout(timer); timer = setTimeout(flush, 1500); }
    return up;
  }
  // すぐ送って、順位を返す（ゲームオーバー画面など用）
  async function submit(g, score, sub) {
    const up = report(g, score, sub); clearTimeout(timer);
    if (!(await B.on())) return { ok: false, why: 'off' };
    await flush();
    const name = await myName(); if (!name) return { ok: false, why: 'noname' };
    const rankIn = (rows, s) => { const i = rows.findIndex(r => r.id === B.uid); return i >= 0 ? i + 1 : rows.filter(r => better(g, r.score, s)).length + 1; };
    const rows = await list(g) || [], b = ls.get(BEST, {})[g] || { score };
    const out = { ok: true, rank: rankIn(rows, b.score), best: b.score, newBest: up };
    if (META[g].daily) { const dr = await list(g, true) || [], db2 = ls.get(BEST, {})[g + '@'] || { score }; out.dayRank = rankIn(dr, db2.score); out.dayBest = db2.score; }
    return out;
  }
  async function flush() {
    if (sending) { timer = setTimeout(flush, 1500); return; }
    const gs = Object.keys(queue); if (!gs.length) return; sending = true;
    try {
      const name = await myName(); if (!name) return; // 名前がないうちは送らない（決めたら送る）
      for (const g of gs) {
        try {
          for (const k of META[g] && META[g].daily ? [g, g + '@'] : [g]) {
            const b = ls.get(BEST, {})[k]; if (!b || b.sent) continue;
            const d = k.endsWith('@') ? b.day : null;
            if (d && d !== today()) { b.sent = true; ls.set(BEST, { ...ls.get(BEST, {}), [k]: b }); continue; } // 昨日の分はもう送らない
            const mine = await B.getMine(g, d);
            if (!mine || better(g, b.score, mine.score) || mine.name !== name) {
              const v = { name, score: b.score, at: Date.now() }; if (Number.isFinite(b.sub)) v.sub = b.sub;
              if (mine && !better(g, b.score, mine.score)) { v.score = mine.score; if (Number.isFinite(mine.sub)) v.sub = mine.sub; else delete v.sub; }
              await B.put(g, v, d);
            }
            b.sent = true; ls.set(BEST, { ...ls.get(BEST, {}), [k]: b });
          }
          delete queue[g];
        } catch (e) { console.warn('rank send', g, e); }
      }
    } finally { sending = false; }
  }

  // ---------- 表示 ----------
  function fmt(g, v) {
    const m = META[g] || {};
    if (m.time) { const s = Math.max(0, Math.round(v)), h = Math.floor(s / 3600), mi = Math.floor(s / 60) % 60, se = s % 60; return (h ? `${h}時間` : '') + `${mi}分${String(se).padStart(2, '0')}秒`; }
    if (m.money) { const units = [[1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '万']]; for (const [u, n] of units) if (v >= u) return `${(v / u).toFixed(v / u < 100 ? 1 : 0)}${n}円`; return `${Math.floor(v)}円`; }
    return (m.dec ? (+v).toFixed(m.dec) : Math.floor(v).toLocaleString()) + (m.unit || '');
  }
  // daily が true なら今日のランキング
  async function list(g, daily) {
    if (!(await B.on())) return null;
    const rows = await B.list(g, daily ? today() : null);
    return rows.filter(r => r && typeof r.name === 'string' && Number.isFinite(r.score)).slice(0, 50);
  }
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `.grk-btn{position:fixed;z-index:9990;width:44px;height:44px;border-radius:14px;border:0;background:rgba(10,12,30,.72);color:#fff;font-size:22px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);display:grid;place-items:center;-webkit-tap-highlight-color:transparent}
.grk-dlg{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(4,6,20,.66);padding:14px;font-family:"M PLUS Rounded 1c","Hiragino Maru Gothic ProN",sans-serif;color:#fff}
.grk-box{width:min(440px,100%);max-height:92vh;overflow:auto;background:linear-gradient(180deg,#1c2050,#10122e);border:1px solid rgba(255,255,255,.18);border-radius:18px;padding:16px;box-shadow:0 20px 50px rgba(0,0,0,.5)}
.grk-box h3{margin:0 0 2px;font-size:1.2rem;text-align:center}.grk-box .grk-sub{text-align:center;font-size:.78rem;opacity:.75;margin-bottom:10px}
.grk-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 10px;border-radius:9px;background:rgba(255,255,255,.05);margin:4px 0;font-weight:800;font-size:.9rem}
.grk-row.me{background:rgba(255,210,58,.18);outline:1px solid #ffd23a}.grk-row b{font-variant-numeric:tabular-nums;white-space:nowrap}.grk-row span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.grk-note{font-size:.82rem;line-height:1.6;text-align:center;opacity:.9;margin:8px 0}
.grk-form{display:flex;gap:8px;margin:8px 0}.grk-form input{flex:1;min-width:0;font:800 1rem inherit;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#fff}
.grk-b{border:0;border-radius:10px;padding:10px 14px;font:900 .95rem inherit;cursor:pointer;background:linear-gradient(180deg,#fff6c8,#ffd23a);color:#3a2400}.grk-x{display:block;width:100%;margin-top:10px;background:rgba(255,255,255,.1);color:#fff}
.grk-me{text-align:center;font-weight:900;margin:6px 0 4px}.grk-me b{color:#ffd23a}`;
    document.head.appendChild(s);
  }
  // pos：ボタンの位置（CSS）。hide：遊んでいる最中など、隠したいときに true を返す関数
  function mount(g, pos, hide) {
    style();
    const b = document.createElement('button'); b.className = 'grk-btn'; b.type = 'button'; b.title = 'オンラインランキング'; b.setAttribute('aria-label', 'オンラインランキング'); b.textContent = '🏆';
    Object.assign(b.style, pos || { left: 'max(10px, env(safe-area-inset-left))', bottom: 'max(10px, env(safe-area-inset-bottom))' });
    b.onclick = e => { e.stopPropagation(); show(g); };
    (document.body ? Promise.resolve() : new Promise(r => addEventListener('DOMContentLoaded', r))).then(() => document.body.appendChild(b));
    if (hide) setInterval(() => { let h = false; try { h = !!hide(); } catch (e) {} b.style.display = h ? 'none' : ''; }, 300);
    return b;
  }
  async function show(g) {
    style();
    const m = META[g] || { t: g };
    const d = document.createElement('div'); d.className = 'grk-dlg'; d.setAttribute('role', 'dialog');
    d.innerHTML = `<div class="grk-box"><h3>🏆 ${esc(m.t)}</h3><div class="grk-sub">${esc(m.sub || 'ベストスコア')}・オンラインランキング</div><div class="grk-body"><p class="grk-note">読みこみ中…</p></div><button class="grk-b grk-x" type="button">とじる</button></div>`;
    const close = () => d.remove();
    d.querySelector('.grk-x').onclick = close; d.addEventListener('click', e => { if (e.target === d) close(); });
    d.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
    ['pointerdown', 'touchstart', 'mousedown', 'keydown', 'wheel'].forEach(t => d.addEventListener(t, e => e.stopPropagation()));
    document.body.appendChild(d);
    const body = d.querySelector('.grk-body');
    const render = async () => {
      let rows;
      try { rows = await Promise.race([list(g), new Promise(r => setTimeout(() => r('timeout'), 12000))]); } catch (e) { rows = 'err'; }
      if (rows === null) { body.innerHTML = `<p class="grk-note">ランキングにつながらなかった（コード ${B.why || '?'}）<br>ネットにつながっているか確かめてね</p>`; return; }
      if (!Array.isArray(rows)) { body.innerHTML = `<p class="grk-note">読みこめなかった。あとでもう一度ためしてね</p>`; return; }
      const name = await myName(), me = B.uid, mb = ls.get(BEST, {})[g];
      let h = '';
      if (!name) h += `<p class="grk-note">ランキングにのせる名前を決めよう（ほかのゲームでも同じ名前になるよ）</p><form class="grk-form"><input maxlength="10" placeholder="なまえ" autocomplete="off"><button class="grk-b">決定</button></form><div class="grk-note grk-msg"></div>`;
      const myRow = rows.findIndex(r => r.id === me);
      if (mb) h += `<div class="grk-me">あなたのベスト <b>${esc(fmt(g, mb.score))}</b>${myRow >= 0 ? `（${myRow + 1}位）` : ''}</div>`;
      h += rows.length ? rows.map((r, i) => `<div class="grk-row ${r.id === me ? 'me' : ''}"><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}位`}　${esc(r.name)}</span><b>${esc(fmt(g, r.score))}</b></div>`).join('') : '<p class="grk-note">まだだれも記録がないよ。一番乗りしよう！</p>';
      body.innerHTML = h;
      const f = body.querySelector('form');
      if (f) f.onsubmit = async e => {
        e.preventDefault(); const msg = body.querySelector('.grk-msg'); msg.textContent = 'たしかめ中…';
        try { const c = await claim(f.querySelector('input').value); if (!c.ok) { msg.textContent = c.why; return; } for (const k in ls.get(BEST, {})) queue[k] = 1; await flush(); render(); }
        catch (err) { msg.textContent = '登録できなかった'; }
      };
    };
    render();
  }
  // ゲーム一覧用：全ゲームの上位
  async function top(n = 3) {
    const out = {};
    await Promise.all(Object.keys(META).map(async g => { try { out[g] = (await list(g) || []).slice(0, n); } catch (e) { out[g] = null; } }));
    return out;
  }
  // 名前がないまま記録がたまっていたら、名前が決まったときにまとめて送る
  addEventListener('load', () => setTimeout(() => { const b = ls.get(BEST, {}); for (const g in b) if (!b[g].sent) queue[g] = 1; if (Object.keys(queue).length) flush(); }, 2500));
  // 合言葉（Firebase のときだけ）
  async function setPass(p) {
    if (B.kind !== 'firebase') return { ok: false, why: 'claude.ai では自動で同じ名前になるよ' };
    if (!(await B.on())) return { ok: false, why: 'つながっていません' };
    if (!(await myName())) return { ok: false, why: '先に名前を決めてね' };
    if (!p || p.length < 6) return { ok: false, why: '合言葉は6文字以上にしてね' };
    try { await B.setPass(p); syncNow(); return { ok: true }; }
    catch (e) { return { ok: false, why: /operation-not-allowed/.test(e.code || '') ? 'Firebase の「メール/パスワード」がまだオフみたい' : /weak-password/.test(e.code || '') ? '合言葉が短すぎるよ' : /requires-recent-login/.test(e.code || '') ? 'もう一度ログインしなおしてから変えてね' : '設定できなかった（' + (e.code || e.message) + '）' }; }
  }
  async function login(name, p) {
    if (B.kind !== 'firebase') return { ok: false, why: 'claude.ai では自動で同じ名前になるよ' };
    if (!(await B.on())) return { ok: false, why: 'つながっていません' };
    const r = await B.login(cleanName(name), p || ''); if (!r.ok) return r;
    nameCache = r.name; ls.set(ACC, { name: r.name, key: norm(r.name), shared: true });
    // この端末の自己ベストも、ログインした名前の記録として送る（よいほうが残る）
    const b = ls.get(BEST, {}); for (const k in b) { b[k].sent = false; queue[k.replace('@', '')] = 1; } ls.set(BEST, b); flush();
    return r;
  }
  // ================= セーブの同期（ほかの端末へ持っていく） =================
  // ゲームのセーブ（localStorage）のうち、下の名前で始まるものだけ。名前（games-account）は送らない
  const SYNC_PREFIX = ['hottarakashi', 'pachinko-yomatsuri', 'core-digger', 'ad-hell', 'pack-opener', 'bukkenou', 'nazotoki', 'neko-td', 'potion-quest', 'screw-koubou', 'orbit-hop', 'uparupa-spirits', 'uparun', 'arashi-ken', 'tsuki-souji', 'shusha-dekinai', 'games-rank-best'];
  const META_K = 'games-sync';
  const syncKeys = () => { const ks = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (SYNC_PREFIX.some(p => k.startsWith(p))) ks.push(k); } } catch (e) {} return ks; };
  const raw = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const hash = v => { let h = 0; for (let i = 0; i < v.length; i++) h = (h * 31 + v.charCodeAt(i)) | 0; return v.length + ':' + h; };
  let syncOn = false, dirty = {}, pushing = false;
  // 変わったセーブをさがす（数秒ごと）
  function scan(markAll) {
    const m = ls.get(META_K, { t: {}, h: {} }); let ch = false;
    for (const k of syncKeys()) { const v = raw(k); if (v === null) continue; const h = hash(v); if (markAll || m.h[k] !== h) { m.h[k] = h; m.t[k] = markAll && m.t[k] ? m.t[k] : Date.now(); dirty[k] = 1; ch = true; } }
    if (ch) ls.set(META_K, m);
  }
  async function push() {
    if (pushing || !syncOn) return; const ks = Object.keys(dirty); if (!ks.length) return; pushing = true;
    try { const m = ls.get(META_K, { t: {}, h: {} }); for (const k of ks) { const v = raw(k); if (v === null || v.length > 900000) { delete dirty[k]; continue; } await B.pushSave(k, v, m.t[k] || Date.now()); delete dirty[k]; } }
    catch (e) { console.warn('sync push', e); } finally { pushing = false; }
  }
  // クラウドから持ってくる。force なら、このPCのセーブより新しくなくても上書き。変わったら true
  async function pull(force) {
    const remote = await B.pullSaves(), m = ls.get(META_K, { t: {}, h: {} }); let ch = false;
    for (const [k, r] of Object.entries(remote)) {
      if (!SYNC_PREFIX.some(p => k.startsWith(p)) || typeof r.v !== 'string') continue;
      if (force || (r.t || 0) > (m.t[k] || 0)) { if (raw(k) !== r.v) { try { localStorage.setItem(k, r.v); ch = true; } catch (e) {} } m.t[k] = r.t || Date.now(); m.h[k] = hash(r.v); }
    }
    ls.set(META_K, m); return ch;
  }
  async function startSync() {
    // この端末で「同期する」と決めたときだけ（勝手に上書きしないため）
    if (syncOn || !ls.get(META_K, {}).on || !(await B.on()) || !B.canSync || !B.canSync()) return;
    syncOn = true;
    try {
      const ch = await pull(false);
      // ゲームの画面で、ほかの端末のほうが新しかったら読みこみ直す（ゲーム一覧の画面はそのまま）
      if (ch && !document.getElementById('accDlg')) { location.reload(); return; }
    } catch (e) { console.warn('sync pull', e); }
    scan(false); push();
    setInterval(() => { scan(false); push(); }, 5000);
    addEventListener('pagehide', () => { scan(false); push(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { scan(false); push(); } });
  }
  // 合言葉を決めた直後：このPCのセーブを全部クラウドへ
  const turnOn = () => { const m = ls.get(META_K, { t: {}, h: {} }); m.on = true; ls.set(META_K, m); };
  async function syncNow() { if (!(await B.on()) || !B.canSync()) return false; turnOn(); scan(true); syncOn = false; await startSync(); scan(true); await push(); return true; }
  // ログインした直後：クラウドのセーブで、このPCのセーブを上書きする
  async function syncTakeCloud() { if (!(await B.on()) || !B.canSync()) return false; await pull(true); turnOn(); await startSync(); return true; }
  const syncing = () => !!ls.get(META_K, {}).on;
  setTimeout(() => { startSync(); }, 1500);

  async function passNote() { if (B.kind !== 'firebase' || !(await B.on()) || !B.hasPass()) return ''; try { return await B.passNote(); } catch (e) { return ''; } }
  window.GAMES_RANK = { passNote, syncNow, syncTakeCloud, syncing, setPass, login, hasPass: () => !!(B.hasPass && B.hasPass()), today, META, mount, report, submit, show, list, top, claim, myName, fmt, on: () => B.on(), get kind() { return B.kind; }, get uid() { return B.uid; }, get why() { return B.why; } };
})();
