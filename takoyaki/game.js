// たこ焼きシミュレーター：操作・モード・オンライン対戦
import { createScene } from './scene.js';
const T = window.TakoCore, SND = window.TakoSound;
const $ = id => document.getElementById(id);
const qs = new URLSearchParams(location.search), qp = k => qs.get(k);
const clamp = T.clamp;
const FAST = Math.max(0.1, +qp('fast') || 1), BOT = qp('bot') === '1', NORENDER = qp('norender') === '1', SHOWFPS = qp('fps') === '1';

// ================= セーブ =================
const SAVE = 'takoyaki-sim-v1';
const DEF = () => ({ set: { master: 0.8, sfx: 1, amb: 0.6, guide: true, gq: 2 }, best: 0, stats: { balls: 0, gokujo: 0, games: 0, orders: 0, battles: 0, wins: 0 }, name: '' });
function load() { try { const v = JSON.parse(localStorage.getItem(SAVE)); if (v && v.set) { const d = DEF(); return Object.assign(d, v, { set: Object.assign(d.set, v.set), stats: Object.assign(d.stats, v.stats) }); } } catch (e) {} return DEF(); }
let SV = load();
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(SV)); } catch (e) {} };
const myName = () => (window.GAMES_ACC && GAMES_ACC.name && GAMES_ACC.name()) || SV.name || 'ゲスト';

// ================= 3D =================
const gq = qp('gq') != null ? +qp('gq') : SV.set.gq;
const SC = createScene($('cv'), { quality: gq });
const TY = SC.TY;

// ================= 状態 =================
let S = T.newState(3);
let mode = 'title';            // title / free / challenge / online
let playing = false;           // 操作できるか
let G = null;                  // モードごとのデータ
let tool = 'pick';
let dishes = [{ balls: [], tops: {} }];
const SEAT_COL = ['#ffb347', '#6ec6ff', '#c59bff', '#7be08a'];
const SEAT_POS = k => { const a = k * Math.PI / 2, d = k % 2 ? 4.55 : 3.85; return { x: d * Math.sin(a), z: d * Math.cos(a), rot: a }; };
let mySeat = 0;

// ================= 道具 =================
const ICON = {
  pick: '<path d="M7 25 21 5" stroke="#ccc" stroke-width="1.6"/><path d="M11 25 24 7" stroke="#ccc" stroke-width="1.6"/><path d="M4 30 9 23M8 30 12 24" stroke="#c6975e" stroke-width="3.5" stroke-linecap="round"/>',
  oil: '<rect x="13" y="3" width="4" height="16" rx="2" fill="#c9a36a"/><path d="M10 19h10l-1 8h-8z" fill="#f0e6c8"/><circle cx="15" cy="29" r="2" fill="#e0b030"/>',
  pour: '<path d="M8 8h14l-2 20H10z" fill="rgba(230,240,245,.35)" stroke="#dde" stroke-width="1.2"/><path d="M9.3 14h11.4l-1.4 13H10.7z" fill="#f2e3b8"/><path d="M22 11c4 0 4 8 0 8" stroke="#dde" fill="none" stroke-width="1.5"/><path d="M8 8 4 5" stroke="#dde" stroke-width="1.5"/>',
  tako: '<path d="M8 20c0-8 16-8 16 0" fill="#9a1f2c"/><circle cx="11" cy="21" r="2" fill="#f1dfd0"/><circle cx="16" cy="22" r="2" fill="#f1dfd0"/><circle cx="21" cy="21" r="2" fill="#f1dfd0"/>',
  ten: '<g fill="#efd28a"><circle cx="10" cy="14" r="3"/><circle cx="17" cy="11" r="3.5"/><circle cx="21" cy="18" r="3"/><circle cx="13" cy="20" r="3.2"/><circle cx="19" cy="24" r="2.5"/></g>',
  negi: '<g fill="none" stroke="#5fb236" stroke-width="2.2"><circle cx="11" cy="13" r="3"/><circle cx="19" cy="12" r="3"/><circle cx="15" cy="20" r="3"/><circle cx="22" cy="21" r="2.6"/></g>',
  beni: '<g stroke="#e0284a" stroke-width="2.4" stroke-linecap="round"><path d="M8 12l8 2"/><path d="M14 20l9-3"/><path d="M10 24l6 1"/><path d="M18 9l5 4"/></g>',
  sauce: '<rect x="11" y="9" width="10" height="19" rx="3" fill="#4a210e"/><path d="M12 9l4-5 4 5z" fill="#d23a20"/>',
  mayo: '<rect x="11" y="9" width="10" height="19" rx="4" fill="#f6ecd0"/><path d="M12 9l4-5 4 5z" fill="#d8202a"/>',
  aonori: '<rect x="10" y="11" width="12" height="17" rx="3" fill="#2f6b2a"/><rect x="10" y="7" width="12" height="5" rx="2" fill="#e9e3d0"/>',
  katsuo: '<g fill="#d7a682"><path d="M7 17q5-6 9 0q-4 4-9 0z"/><path d="M15 12q5-5 9 1q-5 3-9-1z"/><path d="M14 22q5-4 10 1q-5 3-10-1z"/></g>',
};
const TOOLS = [['pick', 'ピック', '1'], ['oil', '油', '2'], ['pour', '生地', '3'], ['tako', 'たこ', '4'], ['ten', '天かす', '5'], ['negi', 'ねぎ', '6'], ['beni', '紅しょうが', '7'], null, ['sauce', 'ソース', '8'], ['mayo', 'マヨ', '9'], ['aonori', '青のり', '0'], ['katsuo', 'かつお節', '-']];
const TOPPING = ['sauce', 'mayo', 'aonori', 'katsuo'];
const HINT = {
  pick: '下が固まったらタップで返す・なでた方向に返す／線をなぞって切れ目／引っぱって舟皿へ',
  oil: '鉄板をなでて油をひく', pour: '押しっぱなしで流す。あふれるくらいがちょうどいい', tako: '穴をタップしてたこを入れる',
  ten: 'なぞってパラパラ', negi: 'なぞってパラパラ', beni: 'なぞってパラパラ',
  sauce: '舟皿をタップ', mayo: '舟皿をタップ', aonori: '舟皿をタップ', katsuo: '舟皿をタップ',
};
function buildTools() {
  const box = $('tools'); box.innerHTML = '';
  for (const t of TOOLS) {
    if (!t) { if (mode !== 'online') { const s = document.createElement('div'); s.className = 'sep'; box.appendChild(s); } continue; }
    if (mode === 'online' && TOPPING.includes(t[0])) continue;
    const b = document.createElement('button'); b.dataset.tool = t[0];
    b.innerHTML = `<svg class="ic" viewBox="0 0 32 32">${ICON[t[0]]}</svg>${t[1]}<kbd>${t[2]}</kbd>`;
    b.onclick = () => setTool(t[0]); box.appendChild(b);
  }
  setTool(tool);
}
function setTool(k) {
  if (mode === 'online' && TOPPING.includes(k)) return;
  if (tool !== k) SND.ui();
  tool = k; document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === k));
  $('hint').textContent = HINT[k] || '';
}

// ================= 表示の小物 =================
let toastT = 0;
function toast(s, ms) { const e = $('toast'); e.textContent = s; e.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => e.style.opacity = 0, ms || 1600); }
function popAt(x, y, html, color) { const d = document.createElement('div'); d.className = 'pop'; d.style.left = x + 'px'; d.style.top = y + 'px'; d.style.color = color || '#fff'; d.innerHTML = html; document.body.appendChild(d); setTimeout(() => d.remove(), 1500); }
function popWorld(x, y, z, html, color) { const p = SC.project(x, y, z); popAt(p[0], p[1], html, color); }
const fmtT = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const GCOL = { '極上': '#ffd84a', '上出来': '#7be08a', 'ふつう': '#ffffff', 'いまいち': '#cfc3b0', 'いびつ': '#cfc3b0', '生焼け': '#ff9b7a', '焦げ': '#ff5a4e' };
// DOM は変わったときだけさわる（毎フレーム書くと重い）
const _dom = new Map();
function setText(id, v) { v = String(v); if (_dom.get(id) === v) return; _dom.set(id, v); $(id).textContent = v; }
function setHTML(id, v) { if (_dom.get(id + '#h') === v) return; _dom.set(id + '#h', v); $(id).innerHTML = v; }
function setBar(pct) { const v = Math.round(pct * 2) / 2; if (_dom.get('bar') === v) return; _dom.set('bar', v); $('tbar').firstElementChild.style.width = v + '%'; }
function showModal(id, on) { $(id).hidden = !on; }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { SND.ui(); b.closest('.modal').hidden = true; if (b.closest('#mOn')) netLeave(); });

// ================= 行動（ローカルでもホストでもここで処理） =================
let evId = 0, evBuf = [], lastEv = 0;
function emitEv(e) { e.id = ++evId; handleEv(e); if (NET && NET.host) { evBuf.push(e); if (evBuf.length > 40) evBuf.shift(); } }
function apply(a, who) {
  const h = S.holes[a.i];
  switch (a.t) {
    case 'oil': if (h) T.oil(S, a.i, a.amt); break;
    case 'pour': { if (!h) break; const had = !!h.ball; T.pour(S, a.i, a.amt); if (!had && h.ball) emitEv({ t: 'sear', i: a.i, k: clamp(h.temp * 1.9, 0.25, 1.2) }); break; }
    case 'tako': if (h && T.addTako(S, a.i)) emitEv({ t: 'tako', i: a.i }); break;
    case 'spr': if (h) T.sprinkle(S, a.i, a.k, a.amt); break;
    case 'cut': if (h) T.cutEdge(S, a.i, a.e); break;
    case 'scrape': if (h && T.scrape(S, a.i)) emitEv({ t: 'scrape', i: a.i }); break;
    case 'turn': { if (!h || !h.ball) break; const r = T.turn(S, a.i, a.ax, a.ang); emitEv({ t: 'turn', i: a.i, who, ok: r.ok, broke: r.broke, stuck: r.stuck, torn: r.torn, why: r.why }); break; }
    case 'serve': {
      if (!h || !h.ball) break;
      if (h.ball.shape < 0.4) { emitEv({ t: 'nope', who, i: a.i }); break; }
      if (mode === 'online') {
        const pl = NET.players[a.d]; if (!pl) break;
        const b = T.take(S, a.i), g = T.grade(b), pts = T.battlePts(g); pl.sc += pts;
        emitEv({ t: 'eat', d: a.d, by: who, pts, label: g.label, b: T.ballToArr(b) });
      } else {
        const d = dishes[0]; if (d.balls.length >= 10) { emitEv({ t: 'full', who }); break; }
        const b = T.take(S, a.i); d.balls.push(b); emitEv({ t: 'serve', i: a.i });
      }
      break;
    }
    case 'fire': { const v = clamp(S.fire + a.v, 1, 5); if (v !== S.fire) { S.fire = v; emitEv({ t: 'fire', v: a.v }); } break; }
    case 'cur': { const pl = NET && NET.players[who]; if (pl) { pl.x = a.x; pl.z = a.z; pl.tool = a.tool; pl.down = a.down; } break; }
  }
}
function handleEv(e) {
  const me = e.who == null || e.who === mySeat;
  const pos = e.i != null ? T.holePos(e.i) : null;
  switch (e.t) {
    case 'sear': SND.sear(e.k); if (pos) for (let k = 0; k < 4; k++) SC.emit(pos[0], 0.1, pos[1], 'steam', 1.2); break;
    case 'tako': SND.plop(); break;
    case 'scrape': SND.clink(0.08); SND.brush(); break;
    case 'turn':
      if (e.stuck) { SND.squish(); if (me) toast('くっついた！油をひいてから焼こう'); }
      else if (e.broke) { SND.squish(); if (me) toast('早すぎてくずれた！下が固まるまで待とう'); }
      else { SND.roll(true); if (me && e.torn) toast('切れ目が足りなくて生地がちぎれた'); }
      break;
    case 'nope': if (me) toast('まだ液体！丸くなってから'); break;
    case 'full': if (me) toast('舟皿がいっぱい'); break;
    case 'serve': SND.place(); break;
    case 'fire': SND.fireClick(e.v > 0); break;
    case 'eat': {
      SND.place();
      const pl = NET && (NET.players[e.d]); const ds = SC.dishScreen(e.d);
      const col = e.pts > 0 ? '#7be08a' : e.pts < 0 ? '#ff5a4e' : '#fff';
      if (ds) popAt(ds[0], ds[1] - 30, `${e.pts > 0 ? '+' : ''}${e.pts}<small>${esc(e.label)}${e.by !== e.d && NET && NET.players[e.by] ? '（' + esc(NET.players[e.by].name) + 'から）' : ''}</small>`, col);
      if (e.d === mySeat) SND.eat(e.pts > 0 ? 1 : e.pts < 0 ? -1 : 0);
      if (e.by !== e.d && e.label === '焦げ' && e.by === mySeat) toast(`${pl ? pl.name : ''}に押し付けた！`);
      if (e.by !== e.d && e.d === mySeat && e.pts < 0) toast(`${NET.players[e.by] ? NET.players[e.by].name : '誰か'}に押し付けられた！`);
      if (onDish[e.d]) onDish[e.d].push({ b: T.ballFromArr(e.b), until: performance.now() + 1400 });
      if (e.d === mySeat) { SV.stats.balls++; if (e.label === '極上') SV.stats.gokujo++; }
      break;
    }
  }
}
// 送る（クライアントは連続する操作をまとめて0.1秒ごとに）
const accA = new Map(); let accT = 0;
function doAct(a) {
  if (NET && !NET.host) {
    if (a.t === 'oil' || a.t === 'pour' || a.t === 'spr') { const k = a.t + '|' + a.i + '|' + (a.k || ''); const o = accA.get(k); if (o) o.amt += a.amt; else accA.set(k, Object.assign({}, a)); return; }
    netSend({ t: 'a', a: [a] });
    if (a.t === 'cut') T.cutEdge(S, a.i, a.e);
    return;
  }
  apply(a, mySeat);
}
function flushAcc() { if (!accA.size) return; netSend({ t: 'a', a: [...accA.values()] }); accA.clear(); }

// ================= 入力 =================
const cv = $('cv');
let ptr = { down: false };
let cur = { x: 0, z: 3, on: false };
function inPlate(x, z) { return Math.abs(x) < T.COLS / 2 + 0.25 && Math.abs(z) < T.ROWS / 2 + 0.25; }
function holesNear(x, z, r) { const o = []; for (let i = 0; i < T.N; i++) { const p = T.holePos(i); if (Math.hypot(p[0] - x, p[1] - z) < r) o.push(i); } return o; }
function nearestHole(x, z, r) { let best = -1, bd = r; for (let i = 0; i < T.N; i++) { const p = T.holePos(i), d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = i; } } return best; }
function checkCut(x, z) {
  const u = x / T.PITCH + (T.COLS - 1) / 2, v = z / T.PITCH + (T.ROWS - 1) / 2;
  const cu = Math.floor(u), fu = u - cu, rv = Math.round(v), cv2 = Math.floor(v), fv = v - cv2, ru = Math.round(u);
  let hit = false;
  if (Math.abs(fu - 0.5) < 0.13 && cu >= 0 && cu < T.COLS - 1 && rv >= 0 && rv < T.ROWS && Math.abs(v - rv) < 0.5) {
    const a = rv * T.COLS + cu, b = a + 1; if (!(S.holes[a].cut & 2) || !(S.holes[b].cut & 8)) { doAct({ t: 'cut', i: a, e: 1 }); doAct({ t: 'cut', i: b, e: 3 }); hit = true; }
  }
  if (Math.abs(fv - 0.5) < 0.13 && cv2 >= 0 && cv2 < T.ROWS - 1 && ru >= 0 && ru < T.COLS && Math.abs(u - ru) < 0.5) {
    const a = cv2 * T.COLS + ru, b = a + T.COLS; if (!(S.holes[a].cut & 4) || !(S.holes[b].cut & 1)) { doAct({ t: 'cut', i: a, e: 2 }); doAct({ t: 'cut', i: b, e: 0 }); hit = true; }
  }
  if (hit && (S.holes[Math.min(T.N - 1, Math.max(0, rv * T.COLS + ru))] || {}).spill > 0.02) SND.cut();
  else if (hit) SND.cut();
}
function dishToTarget(k) { return mode === 'online' ? k : 0; }
cv.addEventListener('pointerdown', e => {
  SND.init();
  if (!playing) return;
  try { cv.setPointerCapture(e.pointerId); } catch (x) {}
  const p = SC.pickAt(e.clientX, e.clientY); cur.x = p.x; cur.z = p.z; cur.on = true;
  if (p.prop && !(mode === 'online' && TOPPING.includes(p.prop))) { setTool(p.prop); return; }
  ptr = { down: true, id: e.pointerId, sx: e.clientX, sy: e.clientY, x: p.x, z: p.z, lx: p.x, lz: p.z, t0: performance.now(), kind: null, moved: 0 };
  if (tool === 'pick') {
    const i = T.holeAt(p.x, p.z, 0.47);
    if (i >= 0 && S.holes[i].ball) { ptr.kind = 'ball'; ptr.i = i; SND.tick(); }
    else if (inPlate(p.x, p.z)) { ptr.kind = 'cut'; ptr.tapI = nearestHole(p.x, p.z, 0.6); checkCut(p.x, p.z); SND.tick(); }
  } else if (tool === 'oil') { ptr.kind = 'oil'; }
  else if (tool === 'pour') { ptr.kind = 'pour'; SND.pourOn(true); }
  else if (tool === 'tako') { const i = nearestHole(p.x, p.z, 0.55); if (i >= 0) { if (!S.holes[i].ball) toast('先に生地を流そう'); else if (S.holes[i].ball.tako) toast('もう入ってる'); else if (S.holes[i].ball.shape > 0.35) toast('もう固まってて入らない'); else doAct({ t: 'tako', i }); } }
  else if (['ten', 'negi', 'beni'].includes(tool)) { ptr.kind = 'spr'; }
  else if (TOPPING.includes(tool)) {
    if (p.dish >= 0) topDish(tool); else toast('舟皿をタップしてね');
  }
});
cv.addEventListener('pointermove', e => {
  const p = SC.pickAt(e.clientX, e.clientY); cur.x = p.x; cur.z = p.z; cur.on = true; cur.tx = p.tx; cur.tz = p.tz; cur.dish = p.dish;
  if (!ptr.down || e.pointerId !== ptr.id) return;
  ptr.moved = Math.max(ptr.moved, Math.hypot(e.clientX - ptr.sx, e.clientY - ptr.sy));
  if (ptr.kind === 'cut') {
    const n = Math.ceil(Math.hypot(p.x - ptr.lx, p.z - ptr.lz) / 0.05);
    for (let k = 1; k <= n; k++) checkCut(ptr.lx + (p.x - ptr.lx) * k / n, ptr.lz + (p.z - ptr.lz) * k / n);
  }
  if (ptr.kind === 'ball') {
    const hp = T.holePos(ptr.i), d = Math.hypot(p.x - hp[0], p.z - hp[1]);
    if (!ptr.lift && d > 0.85) {
      const b = S.holes[ptr.i].ball;
      if (b && b.shape >= 0.4) { ptr.lift = true; SND.tick(); }
      else if (!ptr.warned) { ptr.warned = true; toast('まだ液体！丸くなってから'); }
    }
  }
  if (ptr.kind === 'oil' && Math.hypot(p.x - ptr.lx, p.z - ptr.lz) > 0.05) SND.brush();
  if (ptr.kind === 'spr' && Math.hypot(p.x - ptr.lx, p.z - ptr.lz) > 0.05) SND.sprinkle();
  ptr.lx = p.x; ptr.lz = p.z; ptr.x = p.x; ptr.z = p.z;
});
function endPtr(e) {
  if (!ptr.down || (e && e.pointerId !== ptr.id)) return;
  const p = e ? SC.pickAt(e.clientX, e.clientY) : { dish: -1 };
  if (ptr.kind === 'ball') {
    if (ptr.lift) {
      if (p.dish >= 0) doAct({ t: 'serve', i: ptr.i, d: dishToTarget(p.dish) });
      else SND.tick();
    } else if (S.holes[ptr.i].ball) {
      let dx = 0, dy = 1;
      if (ptr.moved > 16 && e) { dx = e.clientX - ptr.sx; dy = e.clientY - ptr.sy; }
      const w = SC.screenDirToWorld(dx, dy), l = Math.hypot(w[0], w[1]) || 1, dir = [w[0] / l, w[1] / l];
      // 斜めは近いほうの90°にそろえる（ピックの返し方っぽく）
      doAct({ t: 'turn', i: ptr.i, ax: [dir[1], 0, -dir[0]], ang: Math.PI / 2 });
    }
  }
  if (ptr.kind === 'cut' && ptr.moved < 10 && ptr.tapI >= 0 && !S.holes[ptr.tapI].ball && S.holes[ptr.tapI].spill > 0) doAct({ t: 'scrape', i: ptr.tapI });
  if (ptr.kind === 'pour') SND.pourOn(false);
  ptr = { down: false };
}
cv.addEventListener('pointerup', endPtr); cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') cur.on = false; });
function continuous(dt) {
  if (!ptr.down || !playing) return;
  const { x, z } = ptr;
  if (ptr.kind === 'pour') {
    const i = nearestHole(x, z, 0.75); if (i >= 0) doAct({ t: 'pour', i, amt: T.POUR_RATE * dt });
  } else if (ptr.kind === 'oil') {
    for (const i of holesNear(x, z, 0.62)) doAct({ t: 'oil', i, amt: 3 * dt });
  } else if (ptr.kind === 'spr') {
    for (const i of holesNear(x, z, 0.58)) doAct({ t: 'spr', i, k: tool, amt: 1.6 * dt });
    if (Math.random() < dt * 6) SND.sprinkle();
  }
}
function topDish(k) {
  const d = dishes[0]; if (!d.balls.length) return toast('先にたこ焼きをのせよう');
  if (d.tops[k]) return toast('もうかかってる');
  d.tops[k] = true; if (k === 'sauce' || k === 'mayo') SND.squeeze(); else SND.sprinkle();
  const ds = SC.dishScreen(0); if (ds) popAt(ds[0], ds[1] - 20, T.TOP_NAME[k], '#ffe0b0');
  if (k === 'katsuo') setTimeout(() => toast('かつお節が踊ってる'), 300);
}
addEventListener('keydown', e => {
  if (!playing || e.target.tagName === 'INPUT') return;
  const t = TOOLS.find(t => t && t[2] === e.key); if (t) setTool(t[0]);
  if (e.key === '[') doAct({ t: 'fire', v: -1 }); if (e.key === ']') doAct({ t: 'fire', v: 1 });
});
$('fireDn').onclick = () => { SND.init(); doAct({ t: 'fire', v: -1 }); };
$('fireUp').onclick = () => { SND.init(); doAct({ t: 'fire', v: 1 }); };

// ================= モード =================
function resetPlate(fire) { S = T.newState(fire || 3); }
function enterPlay(m) {
  mode = m; playing = true; tool = 'pick';
  $('title').hidden = true; $('hud').hidden = false; buildTools();
  $('order').hidden = m !== 'challenge'; $('guideBox').hidden = m === 'online'; $('players').hidden = m !== 'online';
  $('topL').style.visibility = m === 'free' ? 'hidden' : 'visible';
  $('score').style.visibility = m === 'free' ? 'hidden' : 'visible';
}
function startFree() {
  SND.init(); resetPlate(3); dishes = [{ balls: [], tops: {} }]; mySeat = 0;
  SC.setSeat(0); SC.setDishes([Object.assign(SEAT_POS(0), { label: 'あなた' })]);
  G = { mode: 'free' }; enterPlay('free');
  if (!SV.seenHow) { SV.seenHow = 1; save(); showModal('mHow', true); }
}
function startChallenge() {
  SND.init(); resetPlate(3); dishes = [{ balls: [], tops: {} }]; mySeat = 0;
  SC.setSeat(0); SC.setDishes([Object.assign(SEAT_POS(0), { label: 'お渡し' })]);
  G = { mode: 'challenge', left: 240, total: 240, score: 0, n: 0, done: 0, sum: 0, cnt: 0, left2: 0, log: [] };
  newOrder(); enterPlay('challenge'); countdown(() => { G.go = true; });
  if (!SV.seenHow) { SV.seenHow = 1; save(); showModal('mHow', true); }
}
function newOrder() { G.n++; G.cur = T.makeOrder(Math.random, G.n); G.cur.t0 = G.total - G.left; G.cur.leftW = G.cur.wait; if (G.n > 1) SND.bell(); drawOrder(); }
function drawOrder() {
  const o = G.cur, d = dishes[0];
  setHTML('order', `<div class="who">${esc(o.who)}の注文</div><div class="cnt">${o.cnt}個 <small style="font-size:.8rem;color:var(--dim)">（いま ${d.balls.length}個）</small></div>
    <div class="tops">${o.tops.length ? o.tops.map(t => `<span class="${d.tops[t] ? 'ok' : ''}">${T.TOP_NAME[t]}</span>`).join('') : '<span>なにもかけない</span>'}</div>
    <div class="pat"><i style="width:${clamp(o.leftW / o.wait * 100, 0, 100)}%;background:${o.leftW / o.wait < 0.3 ? 'var(--red)' : 'var(--green)'}"></i></div>
    <div class="next">おわたし ${G.done}件・平均 ${G.done ? Math.round(G.sum / G.cnt) : '-'}点</div>`);
}
function handOver() {
  const d = dishes[0], o = G.cur; if (!d.balls.length) return toast('舟皿にのせてから');
  const r = T.scoreOrder(o, d.balls, d.tops, (G.total - G.left) - o.t0);
  G.score += r.pts; G.done++; G.sum += r.avg * d.balls.length; G.cnt += d.balls.length;
  SV.stats.balls += d.balls.length; SV.stats.orders++; r.gs.forEach(g => { if (g.label === '極上') SV.stats.gokujo++; });
  const ds = SC.dishScreen(0);
  let msg = `+${r.pts}<small>平均${r.avg}点${r.miss ? '・トッピングちがい' : ''}${r.cntOk ? '' : '・個数ちがい'}${r.fast ? '・はやい！' : ''}</small>`;
  if (ds) popAt(ds[0], ds[1] - 40, msg, r.pts > 400 ? '#ffd84a' : '#7be08a');
  SND.bell(); SND.eat(r.avg >= 70 ? 1 : r.avg < 45 ? -1 : 0);
  if (r.bad) setTimeout(() => toast(r.bad + '個、焦げか生焼けがまじってた…'), 400);
  G.log.push({ who: o.who, pts: r.pts, avg: r.avg });
  dishes[0] = { balls: [], tops: {} }; newOrder();
}
function eatFree() {
  const d = dishes[0]; if (!d.balls.length) return toast('舟皿にのせてから');
  const gs = d.balls.map(T.grade), avg = Math.round(gs.reduce((a, g) => a + g.pts, 0) / gs.length);
  SV.stats.balls += gs.length; gs.forEach(g => { if (g.label === '極上') SV.stats.gokujo++; }); save();
  SND.eat(avg >= 70 ? 1 : avg < 45 ? -1 : 0);
  $('resBody').innerHTML = `<h2>いただきます</h2><div class="big">${avg}<small style="font-size:1rem">点</small></div>
    <div class="grades">${gs.map((g, k) => `<div><b style="color:${GCOL[g.label]}">${g.label}</b>${g.pts}点</div>`).join('')}</div>
    <p class="note">${freeAdvice(gs)}</p>
    <div class="row" style="justify-content:flex-end"><button class="btn main" id="resOk">ごちそうさま</button></div>`;
  showModal('mRes', true); $('resOk').onclick = () => { SND.ui(); showModal('mRes', false); };
  dishes[0] = { balls: [], tops: {} };
}
function freeAdvice(gs) {
  const n = gs.length, c = k => gs.filter(g => g.label === k).length, avg = (f) => gs.reduce((a, g) => a + f(g), 0) / n;
  const tips = [];
  if (c('焦げ')) tips.push('焦げがある：火が強いときは早めに転がそう。');
  if (c('生焼け')) tips.push('生焼け：白いところが残ってる。白い面を下にして焼こう。');
  if (avg(g => g.shape) < 0.85) tips.push('形がいびつ：生地をあふれるくらい流して、切れ目を入れてからたくしこむと丸くなる。');
  if (avg(g => g.tako) < 1) tips.push('たこが入ってないのがある。');
  if (!tips.length) tips.push('いい焼き上がり！');
  return tips.join('<br>');
}
function endChallenge() {
  playing = false; G.go = false; SND.whistle(); SND.pourOn(false); ptr = { down: false };
  const best = SV.best; if (G.score > SV.best) SV.best = G.score; SV.stats.games++; save();
  if (window.GAMES_RANK) GAMES_RANK.report('takoyaki', G.score);
  $('resBody').innerHTML = `<h2>営業終了</h2><div class="big">${G.score}<small style="font-size:1rem">点</small></div>
    <p class="note" style="text-align:center">${G.score > best ? '自己ベスト更新！' : '自己ベスト ' + SV.best + '点'}</p>
    <table class="list">${G.log.slice(-8).map(l => `<tr><td>${esc(l.who)}</td><td>平均${l.avg}点</td><td>+${l.pts}</td></tr>`).join('') || '<tr><td>注文をさばけなかった…</td><td></td></tr>'}</table>
    <p class="note">お渡し ${G.done}件・焼いた数 ${G.cnt}個・平均 ${G.cnt ? Math.round(G.sum / G.cnt) : 0}点</p>
    <div class="row" style="justify-content:space-between"><button class="btn" id="resRank">ランキング</button><span><button class="btn" id="resTitle">タイトルへ</button> <button class="btn main" id="resAgain">もう一回</button></span></div>`;
  showModal('mRes', true);
  $('resRank').onclick = () => window.GAMES_RANK && GAMES_RANK.show('takoyaki');
  $('resTitle').onclick = () => { showModal('mRes', false); toTitle(); };
  $('resAgain').onclick = () => { showModal('mRes', false); startChallenge(); };
}
function countdown(cb) {
  playing = false; let n = 3; const el = $('count'); el.hidden = false;
  const step = () => { if (n > 0) { el.textContent = n; SND.beep(false); n--; setTimeout(step, 800 / FAST); } else { el.textContent = '焼け！'; SND.beep(true); playing = true; cb && cb(); setTimeout(() => el.hidden = true, 700); } };
  step();
}
// タイトル：焼けたたこ焼きをときどき転がして見せる
let titleT = 0;
function titleFill() {
  S = T.newState(2);
  S.holes.forEach((h, i) => { const b = T.newBall(); b.mass = 2; b.shape = 1; b.core = 0; b.tako = 1; b.ten = 0.4; b.negi = 0.3; h.oil = 0.8; b.cook = b.cook.map((c, p) => 0.9 + Math.sin(i * 3.1 + p * 1.7) * 0.18 + (p % 7 === 0 ? 0.25 : 0)); b.q = T.qAxis([Math.sin(i), 0.3, Math.cos(i * 2)], i * 1.3); h.ball = b; });
}
function titleAnim(dt) {
  titleT -= dt; if (titleT > 0) return; titleT = 0.35 + Math.random() * 0.5;
  const b = S.holes[Math.floor(Math.random() * T.N)].ball; if (!b) return;
  const a = Math.random() * Math.PI * 2; b.q = T.qNorm(T.qMul(T.qAxis([Math.cos(a), 0, Math.sin(a)], Math.PI / 2), b.q));
}
function toTitle() {
  mode = 'title'; playing = false; G = null; ptr = { down: false }; SND.pourOn(false);
  $('title').hidden = false; $('hud').hidden = true; titleFill(); dishes = [{ balls: [], tops: {} }];
  SC.setSeat(0); SC.setDishes([Object.assign(SEAT_POS(0), { label: '' })]);
  $('hello').textContent = `${myName()} さん${SV.best ? '・チャレンジ自己ベスト ' + SV.best + '点' : ''}`;
}
$('quit').onclick = () => {
  SND.ui();
  if (mode === 'online') { if (!confirm('対戦をぬける？')) return; netLeave(); toTitle(); return; }
  if (mode === 'challenge' && G && G.go && !confirm('チャレンジをやめる？（記録は残らない）')) return;
  toTitle();
};
document.querySelectorAll('#menu [data-go]').forEach(b => b.onclick = () => {
  SND.init(); SND.ui(); const g = b.dataset.go;
  if (g === 'free') startFree(); else if (g === 'challenge') startChallenge();
  else if (g === 'howto') showModal('mHow', true);
  else if (g === 'settings') openSettings();
  else if (g === 'online') openOnline();
});

// 舟皿の横のボタン
const dishBtns = $('dishBtns');
function drawDishBtns() {
  if (!playing || mode === 'online' || mode === 'title') { dishBtns.innerHTML = ''; return; }
  const want = mode === 'free' ? 'free' : 'ch';
  if (dishBtns.dataset.k !== want) {
    dishBtns.dataset.k = want;
    dishBtns.innerHTML = mode === 'free' ? '<button class="btn main small" id="bEat">食べる</button><button class="btn small" id="bClr">片付け</button>' : '<button class="btn main small" id="bHand">お渡し</button><button class="btn small" id="bClr">やり直し</button>';
    if ($('bEat')) $('bEat').onclick = () => { SND.init(); eatFree(); };
    if ($('bHand')) $('bHand').onclick = () => { SND.init(); handOver(); };
    $('bClr').onclick = () => { SND.ui(); if (dishes[0].balls.length && !confirm('舟皿のたこ焼きを捨てる？')) return; dishes[0] = { balls: [], tops: {} }; };
  }
  const sp = SEAT_POS(0), wide = innerWidth / innerHeight > 0.9;
  const p = wide ? SC.project(sp.x + 2.3, TY + 0.2, sp.z) : SC.project(sp.x, TY, sp.z + 1.25);
  const fd = wide ? 'column' : 'row'; if (dishBtns.style.flexDirection !== fd) { dishBtns.style.flexDirection = fd; dishBtns.style.transform = wide ? 'translate(0,-50%)' : 'translate(-50%,0)'; }
  const L = Math.round(p[0]) + 'px', Tp = Math.round(Math.min(innerHeight - 130, p[1])) + 'px';
  if (dishBtns.style.left !== L) dishBtns.style.left = L; if (dishBtns.style.top !== Tp) dishBtns.style.top = Tp;
}

// ================= ガイド =================
let _gc = null, _gcT = 0;
function guideColors() {
  const now = performance.now(); if (now - _gcT < 100 && _gc !== undefined) return _gc; _gcT = now; _gc = guideColorsRaw(); return _gc;
}
function guideColorsRaw() {
  if (!SV.set.guide) return null;
  return S.holes.map(h => {
    const b = h.ball; if (!b) return null;
    let mn = 9; for (const c of b.cook) mn = Math.min(mn, c);
    if (mn >= 0.85 && b.core < 0.06 && b.shape > 0.9) return '#ffd84a';
    const bc = T.bottomCook(b);
    if (bc > 1.45) return '#ff5a4e';
    if ((b.shape < 0.95 && bc >= T.TURN_OK) || (b.shape >= 0.95 && bc >= 1.0)) return '#6fe08a';
    return null;
  });
}
const STEPS = ['油をひく', '生地をあふれるくらい流す', 'たこ・天かす・ねぎを入れる', 'まわりの生地に切れ目', '下が固まったら返す（2〜3回）', '転がして全体をきつね色に', '金の輪になったら舟皿へ'];
let guideT = 0;
function drawGuideBox(dt) {
  if (mode === 'online' || !playing) return; guideT -= dt; if (guideT > 0) return; guideT = 0.4;
  const hs = S.holes, balls = hs.filter(h => h.ball).map(h => h.ball);
  let st = 0;
  if (!balls.length) st = hs.some(h => h.oil > 0.4) ? 1 : 0;
  else if (balls.some(b => b.shape < 0.1 && b.mass < 0.95)) st = 1;
  else if (balls.some(b => !b.tako && b.shape < 0.3)) st = 2;
  else if (hs.some((h, i) => h.ball && h.spill > 0.1 && T.cutFrac(S, i) < 1 && h.ball.shape < 0.9)) st = 3;
  else if (balls.some(b => b.shape < 0.9)) st = 4;
  else st = guideColors() && guideColors().some(c => c === '#ffd84a') ? 6 : 5;
  setHTML('guideBox', `<b>焼き方</b><ol>${STEPS.map((s, k) => `<li class="${k === st ? 'now' : ''}">${s}</li>`).join('')}</ol>`);
}

// ================= 設定 =================
function openSettings() {
  $('vMaster').value = SV.set.master; $('vSfx').value = SV.set.sfx; $('vAmb').value = SV.set.amb; $('cGuide').checked = SV.set.guide; $('sQ').value = SV.set.gq;
  const s = SV.stats; $('statTxt').textContent = `焼いた数 ${s.balls}個・極上 ${s.gokujo}個・注文 ${s.orders}件・対戦 ${s.battles}回（1位 ${s.wins}回）・チャレンジ自己ベスト ${SV.best}点`;
  $('saveTxt').hidden = true; showModal('mSet', true);
}
function applyVol() { SND.setVol('master', SV.set.master); SND.setVol('sfx', SV.set.sfx); SND.setVol('amb', SV.set.amb); }
$('vMaster').oninput = e => { SV.set.master = +e.target.value; applyVol(); save(); };
$('vSfx').oninput = e => { SV.set.sfx = +e.target.value; applyVol(); save(); };
$('vAmb').oninput = e => { SV.set.amb = +e.target.value; applyVol(); save(); };
$('cGuide').onchange = e => { SV.set.guide = e.target.checked; save(); };
$('sQ').onchange = e => { SV.set.gq = +e.target.value; save(); toast('次に開いたときから'); };
$('exp').onclick = () => { const t = $('saveTxt'); t.hidden = false; t.value = btoa(unescape(encodeURIComponent(JSON.stringify(SV)))); t.select(); try { navigator.clipboard.writeText(t.value); toast('コピーした'); } catch (e) {} };
$('imp').onclick = () => {
  const t = $('saveTxt'); if (t.hidden || !t.value.trim()) { t.hidden = false; t.value = ''; t.focus(); return toast('貼りつけてからもう一度「読み込み」'); }
  try { const v = JSON.parse(decodeURIComponent(escape(atob(t.value.trim())))); if (!v.set) throw 0; localStorage.setItem(SAVE, JSON.stringify(v)); SV = load(); applyVol(); toast('読み込んだ'); openSettings(); } catch (e) { toast('読み込めなかった'); }
};

// ================= オンライン =================
const PREFIX = 'cs3b5-takoyaki-';
const BATTLE_TIME = 180;
let NET = null; // {host, peer, conns, players, ph, tl} / {host:false, peer, conn, players, ph, tl}
const onDish = [[], [], [], []];
function peerOpts() {
  const h = qp('peerhost');
  if (h) { const [host, port] = h.split(':'); return { host, port: +port || 9000, path: '/', secure: false, debug: 0 }; }
  return { debug: 0, config: { iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] },
    { urls: 'stun:stun.relay.metered.ca:80' },
    { urls: ['turn:jp.relay.metered.ca:80', 'turn:jp.relay.metered.ca:80?transport=tcp', 'turn:jp.relay.metered.ca:443', 'turns:jp.relay.metered.ca:443?transport=tcp'], username: '31536e5ac7d5f21e26083726', credential: 'EbmwVyaEUzn4LKnD' },
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
const onMsg = s => { $('onMsg').textContent = s || ''; };
function openOnline() {
  $('onName').value = myName(); $('onCode').value = ''; onMsg('');
  $('onHome').hidden = !!NET; $('onLobby').hidden = !NET; showModal('mOn', true);
}
const newPlayer = (name, conn) => ({ name: String(name || 'ゲスト').slice(0, 10), sc: 0, x: 0, z: 0, tool: 'pick', down: false, on: true, conn, seen: Date.now() });
async function netHost() {
  const name = ($('onName').value.trim() || myName()).slice(0, 10); SV.name = name; save();
  onMsg('部屋をつくっています…');
  try {
    await loadPeerJS();
    let peer = null, code = null;
    for (let k = 0; k < 6 && !peer; k++) { const c = String(1000 + Math.floor(Math.random() * 9000)); try { peer = await openPeer(PREFIX + c); code = c; } catch (e) { if (e.type !== 'unavailable-id') throw e; } }
    if (!peer) throw new Error('部屋を作れなかった');
    NET = { host: true, peer, code, players: [newPlayer(name, null)], ph: 'lobby', tl: BATTLE_TIME };
    mySeat = 0;
    peer.on('connection', c => c.on('open', () => {
      if (c._opened) return; c._opened = 1;
      c.on('data', d => {
        if (!NET || !NET.host) return;
        if (d.t === 'hello') {
          if (c._seat != null) return;
          const back = NET.players.findIndex(p => p && !p.on && p.name === d.name);
          if (back > 0) { NET.players[back].on = true; NET.players[back].conn = c; NET.players[back].seen = Date.now(); c._seat = back; return; }
          if (NET.ph !== 'lobby') { c.send({ t: 'full', why: '対戦中です（終わるまで待ってね）' }); return; }
          if (NET.players.length >= 4) { c.send({ t: 'full', why: '満員です（4人まで）' }); return; }
          NET.players.push(newPlayer(d.name, c)); c._seat = NET.players.length - 1; SND.bell(); drawLobby(); return;
        }
        if (c._seat == null) return;
        const pl = NET.players[c._seat]; if (pl) pl.seen = Date.now();
        if (d.t === 'a' && NET.ph === 'play') for (const a of d.a || []) apply(a, c._seat);
        if (d.t === 'cur') { if (pl) { pl.x = d.x; pl.z = d.z; pl.tool = d.tool; pl.down = d.down; pl.cOn = d.on; } }
      });
      const gone = () => { if (c._seat == null || !NET) return; const p = NET.players[c._seat]; if (p && p.conn === c) netDrop(c._seat); };
      c.on('close', gone);
      try { c.peerConnection.addEventListener('iceconnectionstatechange', () => { const st = c.peerConnection.iceConnectionState; if (st === 'failed' || st === 'closed') gone(); }); } catch (e) {}
    }));
    peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
    onMsg(''); $('onHome').hidden = true; $('onLobby').hidden = false; drawLobby();
  } catch (e) { onMsg('部屋を作れなかった（' + (e.type || e.message) + '）'); }
}
function netDrop(seat) {
  const p = NET.players[seat]; if (!p || seat === 0) return;
  p.on = false; try { p.conn && p.conn.close(); } catch (e) {}
  if (NET.ph === 'lobby') { NET.players.splice(seat, 1); NET.players.forEach((q, k) => { if (q.conn) q.conn._seat = k; }); }
  drawLobby();
}
setInterval(() => { if (!NET || !NET.host) return; const now = Date.now(); NET.players.forEach((p, k) => { if (k > 0 && p.on && now - p.seen > 9000) netDrop(k); }); }, 1000);
async function netJoin() {
  const code = $('onCode').value.replace(/\D/g, ''); if (code.length !== 4) return onMsg('4けたの部屋番号を入れてね');
  const name = ($('onName').value.trim() || myName()).slice(0, 10); SV.name = name; save();
  onMsg('つないでいます…');
  try {
    lastEv = 0;
    await loadPeerJS(); const peer = await openPeer(null);
    const c = peer.connect(PREFIX + code, { reliable: true });
    NET = { host: false, peer, conn: null, code, players: [], ph: 'lobby', tl: BATTLE_TIME };
    const t = setTimeout(() => { if (NET && !NET.conn) onMsg('部屋が見つからない（番号を確かめてね）'); }, 10000);
    peer.on('error', e => { if (e.type === 'peer-unavailable') { clearTimeout(t); onMsg('部屋が見つからない（番号を確かめてね）'); } });
    c.on('open', () => { clearTimeout(t); NET.conn = c; c.send({ t: 'hello', name }); NET.ping = setInterval(() => netSend({ t: 'ping' }), 2500); });
    c.on('data', d => gotNet(d));
    c.on('close', () => { if (!NET || NET.host || NET.conn !== c || NET._full) return; const wasPlay = mode === 'online'; netLeave(); if (wasPlay) { toTitle(); } toast('ホストとの通信が切れた', 3000); });
  } catch (e) { onMsg('つなげなかった（' + (e.type || e.message) + '）'); }
}
function netSend(m) { if (NET && !NET.host && NET.conn && NET.conn.open) { try { NET.conn.send(m); } catch (e) {} } }
function netLeave() {
  if (!NET) return;
  try { if (NET.host) NET.players.forEach(p => p.conn && p.conn.close()); else NET.conn && NET.conn.close(); } catch (e) {}
  clearInterval(NET.ping); try { NET.peer.destroy(); } catch (e) {}
  NET = null; mySeat = 0; onDish.forEach(a => a.length = 0);
}
function plList() { return NET.players.map(p => ({ n: p.name, sc: p.sc, on: p.on, x: +p.x.toFixed(2), z: +p.z.toFixed(2), tool: p.tool, down: !!p.down, c: p.cOn !== false })); }
// ホスト：0.2秒ごとに状態を送る
let bcT = 0;
function broadcast(dt) {
  if (!NET || !NET.host) return; bcT -= dt; if (bcT > 0) return; bcT = 0.2;
  const me = NET.players[0]; me.x = cur.x; me.z = cur.z; me.tool = tool; me.down = !!ptr.down; me.cOn = cur.on;
  const base = { t: 'st', ph: NET.ph, tl: NET.tl, pl: plList(), ev: evBuf.filter(e => e.id > evId - 40) };
  if (NET.ph !== 'lobby') base.pk = T.pack(S);
  NET.players.forEach((p, k) => { if (k > 0 && p.on && p.conn && p.conn.open) { try { p.conn.send(Object.assign({ me: k }, base)); } catch (e) {} } });
}
function gotNet(d) {
  if (!NET || NET.host) return;
  if (d.t === 'full') { NET._full = true; onMsg('入れなかった：' + d.why); setTimeout(netLeave, 300); return; }
  if (d.t !== 'st') return;
  mySeat = d.me;
  const prev = NET.ph; NET.ph = d.ph; NET.tl = d.tl;
  NET.players = d.pl.map(p => ({ name: p.n, sc: p.sc, on: p.on, x: p.x, z: p.z, tool: p.tool, down: p.down, cOn: p.c }));
  if (d.pk) T.unpack(S, d.pk);
  for (const e of d.ev || []) if (e.id > lastEv) { lastEv = e.id; if (prev !== 'lobby' || d.ph !== 'lobby') handleEv(e); }
  if (d.ph === 'lobby') { if (prev !== 'lobby' || $('onLobby').hidden) { if (mode === 'online') toTitle(); showModal('mRes', false); showModal('mOn', true); $('onHome').hidden = true; $('onLobby').hidden = false; } drawLobby(); }
  if (d.ph === 'count' && prev !== 'count') beginBattle();
  if (d.ph === 'play' && prev === 'lobby') beginBattle(true);
  if (d.ph === 'end' && prev !== 'end') battleEnd();
}
function drawLobby() {
  if (!NET) return;
  $('lbCode').textContent = NET.code || '----';
  $('lbList').innerHTML = NET.players.map((p, k) => `<tr class="${k === mySeat ? 'me' : ''}"><td><span style="color:${SEAT_COL[k]}">●</span> ${esc(p.name)}${k === 0 ? '（ホスト）' : ''}</td><td>${p.on === false ? '切断' : ''}</td></tr>`).join('');
  $('lbStart').hidden = !NET.host;
  $('lbNote').textContent = NET.host ? `部屋番号を友だちに教えてね（${NET.players.length}/4人）。1人でも始められる。` : 'ホストが始めるのを待っています…';
}
function beginBattle(skipCount) {
  showModal('mOn', false); showModal('mRes', false);
  onDish.forEach(a => a.length = 0);
  SC.setSeat(mySeat);
  SC.setDishes(NET.players.map((p, k) => Object.assign(SEAT_POS(k), { label: k === mySeat ? 'MINE' : p.name, color: SEAT_COL[k] })));
  dishes = []; enterPlay('online');
  if (NET.host) { resetPlate(3); evBuf = []; NET.players.forEach(p => p.sc = 0); }
  if (!skipCount) countdown(() => { if (NET && NET.host) NET.ph = 'play'; });
  else playing = true;
}
function battleEnd() {
  playing = false; SND.whistle(); SND.pourOn(false); ptr = { down: false };
  const ps = NET.players.map((p, k) => ({ p, k })).sort((a, b) => b.p.sc - a.p.sc);
  SV.stats.battles++; if (ps[0].k === mySeat && ps.length > 1) SV.stats.wins++; save();
  $('resBody').innerHTML = `<h2>対戦結果</h2><table class="list">${ps.map((o, r) => `<tr class="${o.k === mySeat ? 'me' : ''}"><td>${r + 1}</td><td><span style="color:${SEAT_COL[o.k]}">●</span> ${esc(o.p.name)}</td><td>${o.p.sc}</td></tr>`).join('')}</table>
    <div class="row" style="justify-content:space-between;margin-top:14px"><button class="btn" id="resLeave">タイトルへ</button>${NET.host ? '<button class="btn main" id="resMore">もっと焼く！</button>' : '<span class="note">ホストが次を決めるのを待っています</span>'}</div>`;
  showModal('mRes', true);
  $('resLeave').onclick = () => { showModal('mRes', false); netLeave(); toTitle(); };
  if ($('resMore')) $('resMore').onclick = () => { showModal('mRes', false); NET.ph = 'lobby'; NET.players = NET.players.filter((p, k) => k === 0 || p.on); NET.players.forEach((p, k) => { p.sc = 0; if (p.conn) p.conn._seat = k; }); toTitle(); showModal('mOn', true); $('onHome').hidden = true; $('onLobby').hidden = false; drawLobby(); bcT = 0; };
}
$('mk').onclick = () => { SND.init(); netHost(); };
$('jn').onclick = () => { SND.init(); netJoin(); };
$('lbLeave').onclick = () => { netLeave(); $('onHome').hidden = false; $('onLobby').hidden = true; onMsg(''); };
$('lbStart').onclick = () => { if (!NET || !NET.host) return; NET.ph = 'count'; NET.tl = BATTLE_TIME; bcT = 0; broadcast(1); beginBattle(); };
function drawPlayers() {
  if (mode !== 'online' || !NET) return;
  setHTML('players', NET.players.map((p, k) => `<div style="${k === mySeat ? 'outline:1.5px solid ' + SEAT_COL[k] : ''}"><span><span style="color:${SEAT_COL[k]}">●</span> ${esc(p.name)}${p.on === false ? '（切断）' : ''}</span><b>${p.sc}</b></div>`).join(''));
}

// ================= ボット（テスト用） =================
const botMem = {}; let botT = 0;
function botStep(dt) {
  if (!BOT || !playing || mode === 'online' || mode === 'title') return;
  botT -= dt; let guard = 0;
  while (botT <= 0 && guard++ < 8) { botT += 1 / 12; botAct(); }
}
function botAct() {
  if (mode === 'challenge' && G.cur && dishes[0].balls.length >= G.cur.cnt) { for (const t of G.cur.tops) dishes[0].tops[t] = true; handOver(); return; }
  if (mode === 'free' && dishes[0].balls.length >= 8) { dishes[0] = { balls: [], tops: {} }; }
  const p = T.autoPlan(S, botMem); if (!p) return;
  const map = { oil: () => apply({ t: 'oil', i: p.i, amt: 1 }), pour: () => apply({ t: 'pour', i: p.i, amt: p.amt }), tako: () => apply({ t: 'tako', i: p.i }), ten: () => apply({ t: 'spr', i: p.i, k: 'ten', amt: 0.6 }), negi: () => apply({ t: 'spr', i: p.i, k: 'negi', amt: 0.6 }), cut: () => apply({ t: 'cut', i: p.i, e: p.e }), scrape: () => apply({ t: 'scrape', i: p.i }), turn: () => apply({ t: 'turn', i: p.i, ax: p.ax, ang: p.ang }, 0), take: () => apply({ t: 'serve', i: p.i, d: 0 }, 0) };
  map[p.a] && map[p.a]();
}

// ================= 毎フレーム =================
let last = performance.now(), curT = 0, lastLogic = performance.now();
// タブが裏に回って描画が止まっても、ホストは進行と送信を続ける
setInterval(() => { const now = performance.now(); if (NET && NET.host && now - lastLogic > 180) { const el = Math.min(1, (now - lastLogic) / 1000); lastLogic = now; let r = el; while (r > 0) { const s = Math.min(0.05, r); logic(s); r -= s; } last = now; } }, 100);
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min(0.05, (now - last) / 1000); last = now; lastLogic = now;
  logic(rdt);
  draw(rdt);
}
function logic(rdt) {
  const dt = rdt * FAST;
  // シミュレーション（ホスト・ひとりのときが本物。クライアントは次の状態が来るまでのつなぎ）
  const simOn = playing || (mode === 'online' && NET && NET.ph === 'play');
  if (mode === 'title') titleAnim(dt);
  if (simOn) { let r = dt; while (r > 0) { const s = Math.min(0.05, r); T.step(S, s); r -= s; } }
  continuous(dt); botStep(dt);
  // タイマー
  if (mode === 'challenge' && G && G.go && playing) {
    G.left -= dt; G.cur.leftW -= dt;
    if (G.cur.leftW <= 0) { toast(`${G.cur.who}が帰っちゃった…`, 2200); SND.squish(); newOrder(); }
    else if (Math.random() < dt * 4) drawOrder();
    if (G.left <= 0) { G.left = 0; endChallenge(); }
  }
  if (NET && NET.host) {
    if (NET.ph === 'play') { NET.tl -= dt; if (NET.tl <= 0) { NET.tl = 0; NET.ph = 'end'; bcT = 0; broadcast(1); battleEnd(); } }
    broadcast(rdt);
  }
  if (NET && !NET.host) { accT -= rdt; if (accT <= 0) { accT = 0.1; flushAcc(); } curT -= rdt; if (curT <= 0 && mode === 'online') { curT = 0.1; netSend({ t: 'cur', x: +cur.x.toFixed(2), z: +cur.z.toFixed(2), tool, down: !!ptr.down, on: cur.on }); } }
  // 音
  let lv = 0, cr = 0;
  for (const h of S.holes) { const T0 = Math.max(0, h.temp); if (h.ball) { const b = h.ball; lv += T0 * (0.35 + b.core * 0.9); cr += T0 * (0.4 + b.core * 1.6); } if (h.spill > 0.05) { lv += T0 * h.spill * 0.35 * Math.max(0, 1.4 - h.spillCook * 0.5); cr += T0 * h.spill * 0.8; } }
  SND.update(Math.min(1, lv / 8), Math.min(40, cr * 1.4), S.fire, rdt);
}
function draw(rdt) {
  // 表示
  setText('fireV', S.fire);
  if (mode === 'challenge' && G) { setText('ttext', fmtT(G.left)); setBar(G.left / G.total * 100); setText('score', G.score); }
  if (mode === 'online' && NET) { setText('ttext', fmtT(NET.tl)); setBar(NET.tl / BATTLE_TIME * 100); const me = NET.players[mySeat]; setText('score', me ? me.sc : 0); drawPlayers(); }
  drawDishBtns(); drawGuideBox(rdt);
  // 3Dに渡すもの
  const view = { guide: playing ? guideColors() : null, cursors: [], dishes: [] };
  if (ptr.down && ptr.kind === 'ball' && ptr.lift) {
    const over = cur.dish >= 0;
    view.carry = { i: ptr.i, lift: true, x: over ? cur.tx : cur.x, z: over ? cur.tz : cur.z, y: over ? TY + 0.75 : 0.75 };
    view.hlDish = over ? cur.dish : -1;
  }
  if (mode === 'online' && NET) {
    NET.players.forEach((p, k) => {
      if (k === mySeat) view.cursors.push({ x: cur.x, z: cur.z, tool, down: !!ptr.down, on: playing && cur.on, me: true, col: 0xc6975e });
      else view.cursors.push({ x: p.x, z: p.z, tool: p.tool, down: p.down, on: p.on !== false && p.cOn !== false && NET.ph === 'play', col: THREE_COL(SEAT_COL[k]) });
    });
    const now2 = performance.now();
    view.dishes = NET.players.map((p, k) => { onDish[k] = onDish[k].filter(o => o.until > now2); return { balls: onDish[k].map(o => o.b), tops: {} }; });
  } else {
    view.cursors.push({ x: cur.x, z: cur.z, tool, down: !!ptr.down, on: playing && cur.on, me: true });
    view.dishes = dishes.map(d => ({ balls: d.balls, tops: d.tops }));
  }
  if (!NORENDER) SC.update(S, rdt, view);
  if (SHOWFPS) setText('err', `${Math.round(SC.fps)}fps ×${SC.pr.toFixed(2)}`);
}
function THREE_COL(hex) { return parseInt(hex.slice(1), 16); }

// ================= はじめ =================
applyVol();
if (window.GAMES_RANK) GAMES_RANK.mount('takoyaki');
toTitle();
requestAnimationFrame(frame);
// 最初のタップで音を出せるように
addEventListener('pointerdown', () => { SND.init(); applyVol(); }, { once: true });
if (qp('mode') === 'free') startFree();
if (qp('demo')) { // 見た目の確認用：いろんな焼き具合を並べる
  startFree();
  S.holes.forEach((h, i) => {
    const b = T.newBall(); b.mass = 2; b.tako = 1; b.ten = 0.6; b.negi = 0.6; b.beni = i % 3 ? 0 : 0.6; h.oil = 1; h.ball = b;
    const st = i / (T.N - 1); b.shape = Math.min(1, st * 1.6); b.core = Math.max(0, 1 - st * 1.3);
    for (let p = 0; p < T.NP; p++) { const d = T.PD[p]; b.cook[p] = st < 0.3 ? Math.max(0, -d[1]) * st * 3 : Math.min(2.4, st * 1.25 + Math.sin(p * 1.7) * 0.12 + (i > 17 ? 0.8 : 0)); }
    b.q = T.qAxis([1, 0, 0.4], i * 0.9); if (st < 0.2) b.q = [0, 0, 0, 1];
    if (i < 4) { h.spill = 0.8 + i * 0.1; h.spillCook = i * 0.4; h.cut = i > 1 ? 15 : 0; }
  });
  dishes[0].balls = S.holes.slice(12, 17).map(h => { const b = JSON.parse(JSON.stringify(h.ball)); b.shape = 1; b.core = 0; return b; });
  dishes[0].tops = { sauce: 1, mayo: 1, aonori: 1, katsuo: 1 };
  if (qp('demo') === '2') playing = false;
} else if (qp('mode') === 'challenge') startChallenge();
window.__tako = { SC, act: doAct, get NET() { return NET; }, get S() { return S; }, get G() { return G; }, get dishes() { return dishes; }, apply, T };
