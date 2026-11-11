// =============================================================
//  嵐拳：画面・操作・トレーニング・CPU・オンライン対戦（ロールバック）
// =============================================================
(function () {
  const BT = FG.BT, $ = id => document.getElementById(id), R = FG.Render;
  const LS = 'arashi-ken-v1';
  const S = Object.assign({ my: 'homura', opp: 'raika', ctl: 'classic', lv: 1, dummy: 'stand', inf: 1, boxes: 0, name: '' }, (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} };
  const previews = [];
  let G = null, mode = null, running = false, paused = false, ai = null, net = null, info = {}, overT = 0;
  R.init($('cv'));

  // ================= 入力 =================
  const down = new Set();
  const KEYS = {
    // クラシック：U I O＝P、J K L＝K、H＝投げ、Y＝インパクト、P＝パリィ、スペース＝パーソナルアクション
    classic: { KeyU: BT.LP, KeyI: BT.MP, KeyO: BT.HP, KeyJ: BT.LK, KeyK: BT.MK, KeyL: BT.HK, KeyH: BT.LP | BT.LK, KeyY: BT.DI, KeyP: BT.PA, Semicolon: BT.DI, Space: BT.TA },
    // モダン（スト6のPC初期配置）：U＝弱 J＝中 K＝強 I＝SP Y＝DI O＝DP H＝投げ L＝AUTO スペース＝♪
    modern: { KeyU: BT.LP, KeyJ: BT.MP, KeyK: BT.HP, KeyI: BT.SP, KeyY: BT.DI, KeyO: BT.PA, KeyH: BT.LP | BT.MP, KeyL: BT.AU, Space: BT.TA },
  };
  const MOVE = { KeyW: BT.U, KeyS: BT.D, KeyA: BT.L, KeyD: BT.R, ArrowUp: BT.U, ArrowDown: BT.D, ArrowLeft: BT.L, ArrowRight: BT.R };
  // ゲームパッド（標準配置）
  const PAD = {
    classic: { 2: BT.LP, 3: BT.MP, 5: BT.HP, 0: BT.LK, 1: BT.MK, 7: BT.HK, 4: BT.PA, 6: BT.DI },
    modern: { 2: BT.LP, 0: BT.MP, 1: BT.HP, 3: BT.SP, 5: BT.DI, 4: BT.PA, 7: BT.AU, 6: BT.LP | BT.MP, 8: BT.TA },
  };
  function localInput(ctl) {
    let b = 0;
    for (const c of down) { b |= MOVE[c] || 0; b |= KEYS[ctl][c] || 0; }
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      p.buttons.forEach((x, i) => { if (x.pressed) b |= PAD[ctl][i] || 0; });
      if (p.buttons[12] && p.buttons[12].pressed) b |= BT.U; if (p.buttons[13] && p.buttons[13].pressed) b |= BT.D;
      if (p.buttons[14] && p.buttons[14].pressed) b |= BT.L; if (p.buttons[15] && p.buttons[15].pressed) b |= BT.R;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      if (ax < -.45) b |= BT.L; if (ax > .45) b |= BT.R; if (ay < -.5) b |= BT.U; if (ay > .5) b |= BT.D;
    }
    return b;
  }
  addEventListener('keydown', e => {
    FG.SFX.unlock();
    if (e.target.tagName === 'INPUT') return;
    if (running && (MOVE[e.code] || KEYS.classic[e.code] || KEYS.modern[e.code])) e.preventDefault();
    down.add(e.code);
    if (e.code === 'Escape') { e.preventDefault(); onEsc(); }
    if (e.code === 'KeyR' && running && mode === 'training' && !paused) resetTraining();
    if (e.code === 'Enter' && !running) { const b = document.querySelector('.scr:not([hidden]) .btn.go:not([hidden])'); if (b && document.activeElement.tagName !== 'BUTTON') b.click(); }
  });
  addEventListener('keyup', e => down.delete(e.code));
  addEventListener('blur', () => down.clear());

  // ================= 画面の切りかえ =================
  const SCR = ['title', 'select', 'online', 'help', 'pause', 'result'];
  let back = [];
  function show(id, push = true) {
    const cur = SCR.find(s => !$(s).hidden);
    if (push && cur && cur !== id && cur !== 'pause') back.push(cur);
    SCR.forEach(s => $(s).hidden = s !== id);
    if (id) { const f = $(id).querySelector('.btn'); if (f) setTimeout(() => f.focus({ preventScroll: true }), 0); }
  }
  function goBack() { const b = back.pop(); if (b) show(b, false); else show('title', false); }
  document.querySelectorAll('[data-back]').forEach(b => b.onclick = goBack);
  document.querySelectorAll('#mainMenu .btn').forEach(b => b.onclick = () => {
    const g = b.dataset.go;
    if (g === 'help') { helpChar = S.my || 'homura'; buildHelp(S.ctl); show('help'); return; }
    mode = g; openSelect();
  });
  function onEsc() {
    if (running) { if (!$('pause').hidden) { resume(); } else pause(); return; }
    if (!$('title').hidden) return;
    goBack();
  }
  function pause() {
    paused = mode !== 'online'; $('trainOpts').hidden = mode !== 'training';
    SCR.forEach(s => $(s).hidden = s !== 'pause'); setTimeout(() => $('pResume').focus(), 0);
  }
  function resume() { paused = false; $('pause').hidden = true; $('cv').focus && $('cv').focus(); }
  $('pResume').onclick = resume;
  $('pHelp').onclick = () => { helpChar = (G && G.p[0].ch) || S.my; buildHelp(S.ctl); back = []; show('help', false); back.push('pause'); };
  $('pSelect').onclick = () => { leaveGame(); back = ['title']; openSelect(); };
  $('pTitle').onclick = () => { leaveGame(); back = []; show('title', false); };
  function leaveGame() { running = false; paused = false; G = null; $('hudBar').hidden = true; if (net) netClose(true); }

  // ---- セグメントボタン ----
  function seg(id, get, set) {
    const el = $(id);
    const sync = () => el.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(get())));
    el.querySelectorAll('button').forEach(b => b.onclick = () => { set(b.dataset.v); sync(); save(); });
    sync(); return sync;
  }
  seg('ctlSeg', () => S.ctl, v => S.ctl = v);
  seg('lvSeg', () => S.lv, v => S.lv = +v);
  seg('dumSeg', () => S.dummy, v => { S.dummy = v; if (v === 'cpu') ai = makeAI(S.lv); });
  seg('gaugeSeg', () => S.inf, v => S.inf = +v);
  seg('boxSeg', () => S.boxes, v => { S.boxes = +v; R.opts.boxes = !!S.boxes; });
  R.opts.boxes = !!S.boxes;
  let helpCtl = S.ctl, helpChar = S.my || 'homura';
  const helpSync = seg('helpSeg', () => helpCtl, v => { helpCtl = v; buildHelp(v); });

  // ================= キャラ選択 =================
  const DESC = { homura: '飛び道具と昇竜のバランス型', raika: '素早い蹴りで攻めるラッシュ型', rinfa: '足技と溜めの風の拳法', yomi: 'ストックをためて強化する毒使い',
    shinobu: '走って化かす忍者', serena: '投げるほど強くなる月の舞踏', gouzan: '一回転で大ダメージの投げ', jin: '溜めで守る氷の軍人' };
  function openSelect() {
    $('selTitle').textContent = { training: 'トレーニング：キャラ選択', cpu: 'CPU戦：キャラ選択', online: 'オンライン：キャラ選択' }[mode];
    const two = mode !== 'online';
    $('cpuLbl').hidden = $('lvSeg').hidden = mode !== 'cpu';
    $('selNote').textContent = two ? '左クリックで自分のキャラ、右クリックで相手のキャラを選ぶ' : '自分のキャラを選んでね';
    const box = $('chars'); box.innerHTML = '';
    previews.length = 0;
    for (const id in FG.CHARS) {
      const C = FG.CHARS[id], el = document.createElement('button');
      el.className = 'cc'; el.dataset.id = id;
      el.innerHTML = `<span class="tag t1">1P</span><span class="tag t2">${mode === 'training' ? 'DUMMY' : 'CPU'}</span><canvas width="400" height="300"></canvas><div><b>${C.nm}</b> <span class="en">${C.en}</span></div><div class="note" style="text-align:left">${C.title}・${DESC[id] || ''}</div>`;
      el.onclick = () => { S.my = id; mark(); save(); };
      el.oncontextmenu = e => { e.preventDefault(); if (two) { S.opp = id; mark(); save(); } };
      box.appendChild(el); previews.push({ cv: el.querySelector('canvas'), id });
    }
    function mark() {
      box.querySelectorAll('.cc').forEach(el => { el.classList.toggle('p1', el.dataset.id === S.my); el.classList.toggle('p2', two && el.dataset.id === S.opp); el.querySelector('.t1').hidden = el.dataset.id !== S.my; el.querySelector('.t2').hidden = !two || el.dataset.id !== S.opp; });
    }
    mark();
    $('selGo').textContent = mode === 'online' ? '次へ' : 'たたかう！';
    show('select');
  }
  $('selGo').onclick = () => { if (mode === 'online') { $('myName').value = S.name || ''; $('netMsg').textContent = ''; $('hostBox').hidden = true; show('online'); } else startLocal(); };

  // ================= 操作説明 =================
  { const sel = document.getElementById('helpChar'); for (const id in FG.CHARS) { const o = document.createElement('option'); o.value = id; o.textContent = FG.CHARS[id].nm; sel.appendChild(o); } sel.onchange = () => { helpChar = sel.value; buildHelp(helpCtl); }; }
  function buildHelp(ctl) {
    document.getElementById('helpChar').value = helpChar;
    helpCtl = ctl; helpSync();
    const k = (...a) => a.map(x => `<kbd>${x}</kbd>`).join('');
    const rows = ctl === 'classic' ? [
      ['移動・ジャンプ・しゃがみ', k('W', 'A', 'S', 'D') + ' / 矢印'], ['弱P・中P・強P', k('U', 'I', 'O')], ['弱K・中K・強K', k('J', 'K', 'L')],
      ['投げ（弱P＋弱K）', k('H')], ['ドライブパリィ（中P＋中K）', k('P') + '（押しっぱなし）'], ['ドライブインパクト（強P＋強K）', k('Y') + ' か ' + k(';')],
      ['ドライブラッシュ', 'パリィ中に 前'], ['ドライブリバーサル', 'ガード中に 前＋' + k('Y')], ['パーソナルアクション', k('スペース')], ['ダッシュ／バックステップ', '前前／後ろ後ろ'], ['ポーズ', k('Esc')], ['トレーニングで位置リセット', k('R')],
    ] : [
      ['移動・ジャンプ・しゃがみ', k('W', 'A', 'S', 'D') + ' / 矢印'], ['弱・中・強', k('U') + ' ' + k('J') + ' ' + k('K')], ['アシスト必殺技（SP）', k('I') + '＋方向'],
      ['OD必殺技', k('I') + '＋' + k('J') + '（中）＋方向'], ['スーパーアーツ', k('I') + '＋' + k('K') + '（強）　前でLv2、下でLv3'],
      ['アシストコンボ（AUTO）', k('L') + 'を押しながら 弱・中・強 を連打'],
      ['投げ', k('H')], ['ドライブパリィ（DP）', k('O') + '（押しっぱなし）'], ['ドライブインパクト（DI）', k('Y')],
      ['ドライブラッシュ', 'パリィ中に 前'], ['ドライブリバーサル', 'ガード中に 前＋' + k('Y')], ['パーソナルアクション（♪）', k('スペース')], ['ダッシュ／バックステップ', '前前／後ろ後ろ'], ['ポーズ', k('Esc')],
    ];
    $('keyTable').innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('') + '<tr><td colspan="2" class="note" style="text-align:left">ゲームパッドもつかえます（クラシック：X/Y/RB＝P、A/B/RT＝K、LB＝パリィ、LT＝インパクト。モダン：X/A/B＝弱中強、Y＝SP、RB＝DI、LB＝DP、RT＝AUTO、LT＝投げ）</td></tr>';
    const arrow = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
    let h = '';
    const cmdOf = (seq, btn) => seq.map(d => arrow[d] || '').join('') + ' ＋ ' + btn;
    const inText = sp => { const I = sp.in, b = { P: 'P', K: 'K', PP: 'PP', KK: 'KK', LP: '弱P', MP: '中P', HP: '強P', LK: '弱K', MK: '中K', HK: '強K' }[sp.btn];
      if (Array.isArray(I)) { if (!I.length) return b; if (I.join() === '2,5,2') return '↓↓ ＋ ' + b; return cmdOf(I, b); }
      if (I.spin) return (I.spin === 2 ? '2回転' : '1回転（→↘↓↙←↖↑↗→）') + ' ＋ ' + b;
      if (I.ch) return (I.ch === 'b' ? '←タメ ' : '↓タメ ') + I.to.map(d => arrow[d]).join('') + ' ＋ ' + b;
      return ''; };
    const modOf = (C, s) => { const m = Object.entries(C.modern).filter(([, v]) => [].concat(v).includes(s)).map(([d]) => ({ n: '', f: '→ ＋ ', d: '↓ ＋ ', b: '← ＋ ', air: '', airf: '→ ＋ ' })[d]); return m.length ? m.join(' か ') + 'SP' : '—'; };
    const sec = t => `<tr><th>${t}</th><th>コマンド</th></tr>`;
    for (const id in FG.CHARS) {
      if (id !== helpChar) continue;
      const C = FG.CHARS[id];
      h += `<tr><th colspan="2" style="color:#fff;font-size:1.05rem;padding-top:14px">${C.nm}<span style="color:var(--mute);font-weight:700"> ${C.en}</span></th></tr>`;
      h += sec('必殺技');
      for (const s in C.sp) {
        const sp = C.sp[s], pre = sp.air ? (sp.fwdJump ? '（前ジャンプ中）' : '（ジャンプ中）') : '';
        if (sp.asCmd) continue;
        if (ctl === 'modern' && !Object.values(C.modern).flat().includes(s) && !sp.cmdM) continue;   // モダンにない技
        const cmd = (sp.cmdNote || '') + pre + (ctl === 'classic' ? inText(sp) : (sp.cmdM || modOf(C, s)));
        h += `<tr><td>${sp.nm}</td><td>${cmd}</td></tr>`;
        for (const sb of sp.subs || []) h += `<tr><td>　${sb.nm}</td><td>${ctl === 'classic' ? sb.cmd : sb.cmdM}</td></tr>`;
        if (sp.note) h += `<tr><td colspan="2" class="note" style="text-align:left">　${sp.note}</td></tr>`;
      }
      h += sec('スーパーアーツ');
      C.sa.forEach((sa, i) => {
        const lv = sa.lv || i + 1, pre = sa.air ? '（前ジャンプ中）' : '';
        const MS = C.modernSA || { n: 1, b: 2, d: 3 }, md = Object.keys(MS).find(k => MS[k] === lv);
        h += `<tr><td>SA${lv} ${sa.nm}</td><td>${sa.cmdNote || ''}${pre}${ctl === 'classic' ? inText(sa) : (sa.air ? 'SP ＋ 強' : ({ n: '', b: '← ＋ ', d: '↓ ＋ ' }[md] + 'SP ＋ 強'))}</td></tr>`;
        if (sa.note) h += `<tr><td colspan="2" class="note" style="text-align:left">　${sa.note}</td></tr>`;
      });
      h += sec('特殊技');
      for (const k in C.cmd || {}) { const c = C.cmd[k]; if (c.hide) continue; if (ctl === 'classic') { if (c.cmd && !c.mOnly) h += `<tr><td>${c.nm}</td><td>${c.cmd}</td></tr>`; } else if (c.cmdM) h += `<tr><td>${c.nm}</td><td>${c.cmdM}</td></tr>`; }
      for (const k in C.sp) if (C.sp[k].asCmd && ctl === 'classic') h += `<tr><td>${C.sp[k].nm}</td><td>${C.sp[k].cmdText}</td></tr>`;
      for (const t of C.tc || []) { if (t.hide) continue; if (ctl === 'classic') { if (t.cmd && !t.mOnly) h += `<tr><td>${t.nm}</td><td>${t.cmd}</td></tr>`; } else if (t.cmdM) h += `<tr><td>${t.nm}</td><td>${t.cmdM}</td></tr>`; }
      if (ctl === 'modern') {
        h += sec('アシストコンボ');
        const A = C.assist, nm = { cmp: '↓中P', clp: '↓弱P', clk: '↓弱K', cmk: '↓中K', chp: '↓強P', lp: '弱P', lk: '弱K', mp: '中P', mk: '中K', hp: '強P', hk: '強K', SA: 'SA（ゲージ分のLv）' };
        const cv = x => nm[x] || (C.moves[x] ? C.moves[x].nm.replace('（OD）', '') : x);
        for (const k of ['L', 'M', 'H']) { const jp = { L: '弱', M: '中', H: '強' }[k]; h += `<tr><td>AUTO ＋ ${jp}連打</td><td>${A[k].map(cv).join(' ▶ ')}</td></tr>`; }
      }
    }
    $('cmdTable').innerHTML = h + '<tr><td colspan="2" class="note" style="text-align:left">表は1P側（右向き）のとき。左向きのときは左右が逆になる。<br>▶ は前の技が当たる（ガードされる）のに合わせて次のボタン。<br>必殺技はボタン2つ同時押しでOD（ドライブゲージ2本）。体力25%以下のSA3はクリティカルアーツ。<br>ホムラの練気（↓↓＋P）のあとは、次の焔弾・焔掌が強くなってダウンを奪える。<br>モダンのSP必殺技はダメージが少しだけ低い（80%）</td></tr>';
  }

  // ================= ゲーム開始 =================
  function startLocal() {
    const opp = S.opp || 'raika';
    G = FG.newGame({ chars: [S.my, opp], modes: [S.ctl, 'classic'], opt: { training: mode === 'training' } });
    ai = makeAI(S.lv); info = { names: [mode === 'cpu' ? 'YOU' : '', mode === 'cpu' ? 'CPU' : ''] };
    R.reset(); begin();
  }
  function resetTraining() { const sa = G.p.map(f => f.sa); G = FG.newGame({ chars: [G.p[0].ch, G.p[1].ch], modes: [G.p[0].mode, 'classic'], opt: { training: true } }); G.p.forEach((f, i) => f.sa = sa[i]); R.reset(); }
  function begin() {
    running = true; paused = false; overT = 0; adv = null; advText = ''; inLog.length = 0;
    SCR.forEach(s => $(s).hidden = true);
    $('hudBar').hidden = false;
    $('hudBar').textContent = mode === 'training' ? 'Esc：設定　R：位置リセット' : mode === 'online' ? 'Esc：メニュー（ゲームは止まりません）' : 'Esc：ポーズ';
  }

  // ================= トレーニング =================
  let adv = null, advText = '', lastDmg = 0;
  const inLog = [];
  function dummyInput() {
    const me = G.p[1], op = G.p[0], backB = op.x < me.x ? BT.R : BT.L;
    switch (S.dummy) {
      case 'crouch': return BT.D;
      case 'jump': return BT.U;
      case 'block': {
        const m = FG.mvOf(op); let low = true;
        if (op.air || (m && m.lvl === 'high')) low = false;
        return backB | (low ? BT.D : 0);
      }
      case 'cpu': return aiInput();
      default: return 0;
    }
  }
  function trainingPost() {
    for (const f of G.p) {
      if (S.inf) { f.drive = FG.CONST.DRIVE_MAX; f.burn = 0; f.sa = FG.CONST.SA_MAX; }
      if (f.combo === 0 && FG.actionable(f) && G.f - f.lastHit > 50) f.hp = f.maxHp;
    }
    for (const e of G.ev) if (e.k === 'hit' || e.k === 'block') { adv = { a: 1 - e.i, v: e.i, ta: null, tv: null, n: 0 }; if (e.k === 'hit') lastDmg = G.p[e.i].cdmg; }
    if (adv) {
      adv.n++;
      if (adv.ta == null && FG.actionable(G.p[adv.a])) adv.ta = G.f;
      if (adv.tv == null && FG.actionable(G.p[adv.v])) adv.tv = G.f;
      if (adv.ta != null && adv.tv != null) { const d = adv.tv - adv.ta; advText = (d > 0 ? '+' : '') + d; adv = null; }
      else if (adv.n > 150) adv = null;
    }
    // 入力の記録
    const b = G.p[0].hist[0], d = FG.numpad(b, G.p[0].face), btn = b & ~15;
    const top = inLog[0];
    if (top && top.d === d && top.b === btn) top.n++; else { inLog.unshift({ d, b: btn, n: 1 }); if (inLog.length > 16) inLog.pop(); }
  }
  const ARW = { 1: '↙', 2: '↓', 3: '↘', 4: '←', 5: '・', 6: '→', 7: '↖', 8: '↑', 9: '↗' };
  function btnTxt(b, ctl) {
    const L = ctl === 'modern' ? [[BT.LP, 'L'], [BT.MP, 'M'], [BT.HP, 'H'], [BT.SP, 'SP'], [BT.DI, 'DI'], [BT.PA, 'DP'], [BT.AU, 'AUTO'], [BT.TA, '♪']] : [[BT.LP, 'LP'], [BT.MP, 'MP'], [BT.HP, 'HP'], [BT.LK, 'LK'], [BT.MK, 'MK'], [BT.HK, 'HK'], [BT.DI, 'DI'], [BT.PA, 'DP']];
    return L.filter(([m]) => b & m).map(([, t]) => t).join('+');
  }
  function trainingDraw(cx, o) {
    cx.save(); cx.font = '700 18px "Noto Sans JP", sans-serif'; cx.textAlign = 'left';
    inLog.forEach((e, i) => { cx.fillStyle = `rgba(255,255,255,${1 - i / 18})`; cx.fillText(`${String(Math.min(99, e.n)).padStart(2, ' ')}  ${ARW[e.d]} ${btnTxt(e.b, G.p[0].mode)}`, 40, 150 + i * 24); });
    cx.textAlign = 'center'; cx.font = '900 22px "Noto Sans JP", sans-serif';
    if (advText) { cx.fillStyle = advText[0] === '+' ? '#5affb0' : advText === '0' ? '#fff' : '#ff6a6a'; cx.fillText('フレーム ' + advText, o.VW / 2, 120); }
    if (lastDmg) { cx.fillStyle = '#ffd23a'; cx.fillText('ダメージ ' + lastDmg, o.VW / 2, 148); }
    cx.restore();
  }

  // ================= CPU =================
  // CPUのキャラごとの作戦：combo=当たったらつなぐ必殺技 aa=対空 far=遠くで使う grab=近くで投げる
  const AIP = {
    homura: { combo: ['hado', 'tatsu'], aa: 'shoryu', far: 'hado' }, raika: { combo: ['rkick'], aa: 'flip', far: 'rkick' },
    rinfa: { combo: ['hyaku'], aa: 'tensho', far: 'kiko' }, yomi: { combo: ['anken', 'saiha'], aa: 'tensen', far: 'fuha' },
    shinobu: { combo: ['ichi', 'bushin'], aa: null, far: 'run' }, serena: { combo: ['renverse', 'degage'], aa: 'rond', far: 'degage', grab: 'manege' },
    gouzan: { combo: ['lariat'], aa: 'tundra', far: 'siberian', grab: 'spd' }, jin: { combo: ['sonic'], aa: 'flash', far: 'sonic' },
  };
  function makeAI(lv) { return { q: [], hold: 0, bits: 0, wait: 20, walk: 0, lv, react: [22, 12, 6][lv], blockP: [.3, .6, .88][lv], aaP: [.03, .07, .16][lv], comboP: [.25, .7, .95][lv], did: 0 }; }
  function aiInput() {
    const A = ai, me = G.p[1], op = G.p[0], C = FG.CHARS[me.ch], plan = AIP[me.ch] || {};
    const fwd = op.x > me.x ? BT.R : BT.L, bk = fwd === BT.R ? BT.L : BT.R, face = op.x > me.x ? 1 : -1;
    const dir = n => ({ 1: BT.D | bk, 2: BT.D, 3: BT.D | fwd, 4: bk, 5: 0, 6: fwd, 7: BT.U | bk, 8: BT.U, 9: BT.U | fwd })[n];
    const doSp = (key, s) => { if (!key || !C.sp[key]) return 0; A.q = FG.seqFor(me.ch, key, s, face); return A.q.shift(); };
    const doSA = i => { const sa = C.sa[i]; if (!sa || sa.air) return 0; C.sp.__ai = { in: sa.in, btn: sa.btn, v: [{}] }; A.q = FG.seqFor(me.ch, '__ai', 2, face); delete C.sp.__ai; return A.q.shift(); };
    const hold = (b, n) => { A.hold = n; A.bits = b; return b; };
    const rnd = Math.random, dist = Math.abs(op.x - me.x), om = FG.mvOf(op), pick = a => a[Math.floor(rnd() * a.length)];
    if (A.q.length) return A.q.shift();
    if (A.hold > 0) { A.hold--; return A.bits; }
    // コンボ：当たったら必殺技につなぐ
    if (me.st === 'move' && me.conn === 1 && !A.did) {
      const m = FG.mvOf(me);
      if (m && m.cx.includes('sp') && rnd() < A.comboP) {
        A.did = 1;
        if (me.sa >= 10000 && rnd() < .3 + A.lv * .1) return doSA(0);
        const key = pick(plan.combo || Object.keys(C.sp)); const sp = C.sp[key];
        if (sp && Array.isArray(sp.in)) return doSp(key, Math.floor(rnd() * 3));
      }
    }
    if (me.st !== 'move') A.did = 0;
    if (me.st === 'block' || me.st === 'cblock') return bk | (me.st === 'cblock' ? BT.D : 0);
    if (!FG.actionable(me)) return 0;
    // 対空
    if (op.air && op.st !== 'fall' && op.vy < 4 && dist < 220 && rnd() < A.aaP * 3) return plan.aa ? doSp(plan.aa, 2) : BT.D | BT.HP;
    // 相手の攻撃をガード
    if (op.st === 'move' && om && (om.hb || om.spawn) && dist < 280 && op.mt < om.st + om.act && rnd() < A.blockP * .35) {
      const low = om.lvl === 'low' || (om.lvl !== 'high' && rnd() < .5);
      return hold(bk | (low ? BT.D : 0), 10);
    }
    // 飛び道具
    const pj = G.proj.find(p => p.o === 0 && Math.sign(p.vx) === Math.sign(me.x - p.x) && Math.abs(p.x - me.x) < 320);
    if (pj && rnd() < .2) { const r = rnd(); if (r < .35 && dist < 520) return hold(dir(9), 6); if (r < .6) return hold(bk, 20); return hold(BT.PA, 18); }
    // スキに反撃
    if ((op.st === 'land' || op.st === 'parryEnd' || (op.st === 'move' && om && op.mt > om.st + om.act + 4)) && dist < 170 && rnd() < .2 + A.lv * .3) {
      if (me.sa >= 10000 && rnd() < .4) return doSA(0);
      return BT.HP;
    }
    if (A.wait > 0) { A.wait--; return A.walk; }
    A.wait = A.react + Math.floor(rnd() * 14); A.walk = 0;
    const r = rnd();
    if (op.st === 'down' || op.st === 'wake') { if (dist > 150) { A.walk = fwd; return fwd; } return r < .5 ? BT.D | BT.MK : hold(0, 4); }
    if (dist > 380) {
      if (plan.far && r < .3 && !(C.sp[plan.far] && C.sp[plan.far].proj && G.proj.some(p => p.o === 1))) return doSp(plan.far, Math.floor(rnd() * 3));
      if (r < .75) { A.walk = fwd; return fwd; }
      if (r < .87) return hold(dir(9), 4);
      return 0;
    }
    if (dist > 190) {
      if (r < .3) { A.walk = fwd; return fwd; }
      if (r < .55) return BT.D | BT.MK;
      if (r < .65) return BT.MK;
      if (r < .75) return hold(dir(9), 4);
      if (r < .85) { A.walk = bk; return bk; }
      return plan.far ? doSp(plan.far, 1) : fwd;
    }
    if (plan.grab && r < .2 + A.lv * .05) return doSp(plan.grab, 1);
    if (r < .3) return rnd() < .5 ? BT.LP : BT.D | BT.LK;
    if (r < .42) return BT.LP | BT.LK;
    if (r < .6) return hold(bk | BT.D, 14);
    if (r < .82) return BT.D | BT.MK;
    if (r < .86 && me.drive >= 10000) return BT.HP | BT.HK;
    if (me.sa >= 10000 && r < .92) return doSA(0);
    return BT.MP;
  }

  // ================= ループ =================
  let acc = 0, last = performance.now();
  const STEP = 1000 / 60;
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(120, now - last); last = now;
    if (G && running) {
      acc += dt; let n = 0;
      while (acc >= STEP && n < 4) { acc -= STEP; n++; if (net) netTick(); else tick(); }
      if (n >= 4) acc = 0;
    }
    if (G) R.draw(G, Object.assign({ after: (cx, o) => { if (mode === 'training') trainingDraw(cx, o); if (net) netDraw(cx, o); } }, info));
    else drawPreviews(now);
  }
  requestAnimationFrame(loop);
  function tick() {
    if (paused) return;
    const a = localInput(S.ctl), b = mode === 'training' ? dummyInput() : aiInput();
    FG.step(G, [a, b]);
    R.fx(G, G.ev);
    if (mode === 'training') trainingPost();
    checkOver();
  }
  function checkOver() {
    if (G.phase !== 'over') return;
    if (++overT === 150) {
      const w = G.over.w, me = net ? net.me : 0;
      $('resTitle').textContent = w < 0 ? 'DRAW' : w === me ? 'YOU WIN' : 'YOU LOSE';
      $('resNote').textContent = `${G.wins[0]} - ${G.wins[1]}`;
      $('rAgain').textContent = net ? 'もう一度（相手を待つ）' : 'もう一度';
      SCR.forEach(s => $(s).hidden = s !== 'result'); setTimeout(() => $('rAgain').focus(), 0);
    }
  }
  $('rAgain').onclick = () => {
    if (net) { net.again = true; net.conn.send({ t: 'again' }); $('rAgain').textContent = '相手を待っています…'; tryRematch(); return; }
    if (mode === 'training') { resetTraining(); begin(); } else startLocal();
  };
  $('rSelect').onclick = () => { leaveGame(); back = ['title']; openSelect(); };
  $('rTitle').onclick = () => { leaveGame(); back = []; show('title', false); };

  // キャラ選択の見本
  function drawPreviews(now) {
    if ($('select').hidden) return;
    for (const p of previews) R.preview(p.cv, p.id, Math.floor(now / 16.7));
  }

  // ================= オンライン（ロールバック） =================
  const PREFIX = 'arashi-ken-room-', NET_VER = 1, DELAY = 2, MAXRB = 8;
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
    ], iceTransportPolicy: qp('relay') ? 'relay' : 'all' } };
  }
  function loadPeerJS() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = qp('peerlib') || 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
      s.onload = res; s.onerror = () => rej(new Error('通信の部品を読み込めなかった'));
      document.head.appendChild(s);
    });
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
  const msg = t => { $('netMsg').textContent = t; };
  let peer = null;
  $('hostBtn').onclick = async () => {
    netClose(); S.name = $('myName').value.trim().slice(0, 10); save();
    msg('部屋を作っています…');
    try {
      await loadPeerJS();
      let code = null;
      for (let k = 0; k < 6 && !peer; k++) {
        const c = String(1000 + Math.floor(Math.random() * 9000));
        try { peer = await openPeer(PREFIX + c); code = c; } catch (e) { if (e.type !== 'unavailable-id') throw e; }
      }
      if (!peer) throw new Error('部屋を作れなかった');
      $('roomCode').textContent = code; $('hostBox').hidden = false; msg('相手を待っています…');
      peer.on('connection', c => {
        if (net) { c.on('open', () => { c.send({ t: 'busy' }); setTimeout(() => c.close(), 300); }); return; }
        c.on('open', () => setupConn(c, 0));
      });
      peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    } catch (e) { msg('つなげなかった（' + (e.type || e.message) + '）'); }
  };
  $('joinBtn').onclick = async () => {
    const code = $('joinCode').value.replace(/\D/g, '');
    if (code.length !== 4) { msg('4けたの番号を入れてね'); return; }
    netClose(); S.name = $('myName').value.trim().slice(0, 10); save();
    msg('つないでいます…');
    try {
      await loadPeerJS();
      peer = await openPeer(null);
      const c = peer.connect(PREFIX + code, { reliable: true });
      const t = setTimeout(() => { if (!net) { msg('部屋が見つからない（番号を確認してね）'); try { c.close(); } catch (e) {} } }, 10000);
      peer.on('error', e => { if (e.type === 'peer-unavailable') { clearTimeout(t); msg('部屋が見つからない（番号を確認してね）'); } });
      c.on('open', () => { clearTimeout(t); setupConn(c, 1); });
    } catch (e) { msg('つなげなかった（' + (e.type || e.message) + '）'); }
  };
  $('joinCode').addEventListener('keydown', e => { if (e.key === 'Enter') $('joinBtn').click(); });
  function setupConn(c, me) {
    // テスト用：?lag=ミリ秒 で送信をわざと遅らせる（ゆれ・取りこぼしなし）
    const lag = +qp('lag') || 0;
    if (lag && !c._lagged) { const send = c.send.bind(c); c._lagged = 1; c.send = d => setTimeout(() => { try { send(d); } catch (e) {} }, lag * (.7 + Math.random() * .6)); }
    net = { conn: c, me, frame: 0, localIn: {}, remoteIn: {}, used: {}, snaps: {}, lastRemote: -1, rb: null, remoteCur: 0, remoteAdv: 0, cool: 0, again: false, oppAgain: false, rtt: 0, desync: false, hashes: {}, started: false, stall: 0 };
    c.on('data', onData);
    c.on('close', () => { if (net && net.conn === c) { const was = running; netClose(); if (was) { leaveGame(); show('online', false); } msg('相手との接続が切れました'); } });
    if (me === 1) c.send({ t: 'hello', v: NET_VER, ch: S.my, ctl: S.ctl, name: S.name || 'プレイヤー' });
    msg('つながった！');
    net.pingT = setInterval(() => { if (net && net.conn) net.conn.send({ t: 'p', ts: performance.now() }); }, 1000);
  }
  function onData(d) {
    if (!net || !d) return;
    switch (d.t) {
      case 'hello':
        if (d.v !== NET_VER) { net.conn.send({ t: 'old' }); msg('相手のバージョンがちがいます（ページを読み込み直してね）'); return; }
        net.cfg = { chars: [S.my, d.ch], modes: [S.ctl, d.ctl], names: [S.name || 'プレイヤー', d.name] };
        net.conn.send(Object.assign({ t: 'start' }, net.cfg));
        startNet();
        break;
      case 'start': net.cfg = { chars: d.chars, modes: d.modes, names: d.names }; startNet(); break;
      case 'old': msg('相手のバージョンがちがいます（ページを読み込み直してね）'); break;
      case 'busy': msg('その部屋はもう対戦中です'); netClose(); break;
      case 'i': {
        const n = d.b.length;
        for (let k = 0; k < n; k++) {
          const f = d.f - (n - 1) + k; if (f < 0) continue;
          if (net.remoteIn[f] === undefined) {
            net.remoteIn[f] = d.b[k];
            if (f > net.lastRemote) net.lastRemote = f;
            if (f < net.frame && net.used[f] !== d.b[k]) net.rb = net.rb == null ? f : Math.min(net.rb, f);
          }
        }
        net.remoteCur = Math.max(net.remoteCur, d.cur); net.remoteAdv = d.adv;
        break;
      }
      case 'h': { const mine = net.hashes[d.f]; if (mine != null && mine !== d.h) net.desync = true; break; }
      case 'p': net.conn.send({ t: 'q', ts: d.ts }); break;
      case 'q': net.rtt = Math.round(performance.now() - d.ts); break;
      case 'again': net.oppAgain = true; tryRematch(); break;
      case 'bye': msg('相手が抜けました'); break;
    }
  }
  function tryRematch() {
    if (!net || !net.again || !net.oppAgain) return;
    if (net.me === 0) { net.conn.send(Object.assign({ t: 'start' }, net.cfg)); startNet(); }
  }
  function startNet() {
    const c = net.cfg;
    Object.assign(net, { frame: 0, localMax: DELAY - 1, localIn: {}, remoteIn: {}, used: {}, snaps: {}, lastRemote: -1, rb: null, remoteCur: 0, remoteAdv: 0, again: false, oppAgain: false, hashes: {}, desync: false });
    G = FG.newGame({ chars: c.chars, modes: c.modes });
    mode = 'online'; info = { names: c.names.map(n => n || '') };
    R.reset(); begin();
  }
  function netClose(sendBye) {
    if (net) { clearInterval(net.pingT); try { if (sendBye) net.conn.send({ t: 'bye' }); } catch (e) {} try { net.conn.close(); } catch (e) {} }
    net = null;
    if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }
  }
  const hashG = G => G.p.map(f => [f.hp, Math.round(f.x * 100), Math.round(f.y * 100), f.st, f.mt, f.drive | 0, f.sa | 0].join(',')).join('|') + '|' + G.proj.length + '|' + G.timer;
  function inputsFor(fr) {
    const loc = net.localIn[fr] || 0;
    let rem = net.remoteIn[fr];
    if (rem === undefined) rem = net.lastRemote >= 0 ? net.remoteIn[Math.min(fr, net.lastRemote)] || 0 : 0;
    net.used[fr] = rem;
    return net.me === 0 ? [loc, rem] : [rem, loc];
  }
  function netTick() {
    // 巻き戻し：予想とちがう入力が届いていたら、その時点からやり直す
    if (net.rb != null && net.rb < net.frame && net.snaps[net.rb]) {
      G = FG.clone(net.snaps[net.rb]);
      for (let fr = net.rb; fr < net.frame; fr++) { net.snaps[fr] = FG.clone(G); FG.step(G, inputsFor(fr)); }
    }
    net.rb = null;
    // 進みすぎ（相手の入力が来ていない）なら待つ
    const ahead = net.frame - net.lastRemote;
    if (ahead > MAXRB + DELAY) { net.stall++; sendInputs(); return; }
    // 相手より先に進んでいたら、少しだけ待って合わせる
    const myAdv = net.frame - net.remoteCur;
    if (net.cool > 0) net.cool--;
    else if (myAdv - net.remoteAdv >= 3) { net.cool = 6; sendInputs(); return; }
    // 自分の入力（DELAYフレームあとに使う）
    net.localIn[net.frame + DELAY] = paused ? 0 : localInput(net.cfg.modes[net.me]); net.localMax = net.frame + DELAY;
    sendInputs();
    net.snaps[net.frame] = FG.clone(G);
    FG.step(G, inputsFor(net.frame));
    R.fx(G, G.ev);
    net.frame++;
    // ずれチェック（確定したフレームの状態をくらべる）
    const conf = Math.min(net.lastRemote, net.frame - 1);
    const hf = Math.floor(conf / 30) * 30;
    if (hf > 0 && net.hashes[hf] == null && net.snaps[hf]) { net.hashes[hf] = hashG(net.snaps[hf]); net.conn.send({ t: 'h', f: hf, h: net.hashes[hf] }); }
    // 古い記録をすてる
    const old = net.frame - 90;
    for (const k in net.snaps) if (+k < old) delete net.snaps[k];
    if (net.frame % 60 === 0) for (const tb of [net.localIn, net.remoteIn, net.used, net.hashes]) for (const k in tb) if (+k < old - 60) delete tb[k];
    checkOver();
  }
  function sendInputs() {
    const f = net.localMax, b = [];
    for (let k = f - 9; k <= f; k++) if (k >= 0) b.push(net.localIn[k] || 0);
    try { net.conn.send({ t: 'i', f, b, cur: net.frame, adv: net.frame - net.remoteCur }); } catch (e) {}
  }
  function netDraw(cx, o) {
    cx.save(); cx.font = '700 15px "Noto Sans JP", sans-serif'; cx.textAlign = 'right';
    cx.fillStyle = net.rtt > 150 ? '#ff8a6a' : '#9affc0';
    cx.fillText(`通信 ${net.rtt}ms`, o.VW - 40, o.VH - 56);
    if (net.desync) { cx.fillStyle = '#ff5a5a'; cx.fillText('同期ずれを検出', o.VW - 40, o.VH - 76); }
    cx.restore();
  }
  // テスト用
  window.ARASHI = { get G() { return G; }, get net() { return net; }, S };
})();
