// 奈落の迷宮 — ルール（画面なし。node でボットを動かしてテストできる）
import { FLOORS, MONS, ITEMS, POTION_LOOKS, SCROLL_LOOKS, WAND_LOOKS, TRAPS } from './data.js';
export { FLOORS, MONS, ITEMS, TRAPS };

export const W = 52, H = 36;
const DIRS = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
export { DIRS };
const UNDEAD = new Set(['skeleton', 'ghost', 'wraith', 'boneking']);

function rngMake(seed) { let s = seed >>> 0; const f = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; f.get = () => s; f.set = v => { s = v >>> 0; }; return f; }
const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pickW = (list, r) => { let s = 0; for (const x of list) s += x.w; let v = r() * s; for (const x of list) { v -= x.w; if (v <= 0) return x; } return list[list.length - 1]; };

export function newGame(seed = (Math.random() * 2 ** 31) | 0, bonus = {}) {
  const r = rngMake(seed);
  const pl = shuffle([...POTION_LOOKS], r), sl = shuffle([...SCROLL_LOOKS], r), wl = shuffle([...WAND_LOOKS], r);
  const looks = {}; let pi = 0, si = 0, wi = 0;
  for (const [id, it] of Object.entries(ITEMS)) { if (it.k === 'potion') looks[id] = pl[pi++]; if (it.k === 'scroll') looks[id] = sl[si++]; if (it.k === 'wand') looks[id] = wl[wi++]; }
  const G = {
    v: 1, seed, rs: 0, floor: 0, turn: 0, uid: 1, looks, known: {}, over: false, win: false, cause: '',
    p: { id: 0, x: 0, y: 0, dir: 4, hp: 30, mhp: 30, lv: 1, xp: 0, str: 0, belly: 100, mbelly: 100, inv: [], eq: { weapon: null, shield: null, ring: null }, st: {}, regen: 0, kills: 0, bellyT: 0, batk: bonus.atk || 0, bdef: bonus.def || 0 },
    stats: { kills: 0, turns: 0, items: 0, maxFloor: 0, killsBy: {}, seenIt: {} }, log: [], daily: !!bonus.daily,
  };
  G._r = r;
  // 最初の持ち物
  if (!bonus.items) { G.p.inv.push(mkItem(G, 'rusty', 0), mkItem(G, 'woodshield', 0), mkItem(G, 'bread', 0), mkItem(G, 'p_heal', 0));
  G.p.inv[0].plus = G.p.inv[1].plus = 0; G.p.inv[0].cursed = G.p.inv[1].cursed = false; G.p.eq.weapon = G.p.inv[0].uid; G.p.eq.shield = G.p.inv[1].uid; G.p.inv[0].known = G.p.inv[1].known = true; }
  G.known.p_heal = true;
  G.p.mhp = G.p.hp = 30 + (bonus.hp || 0); G.p.mbelly = G.p.belly = 100 + (bonus.belly || 0);
  for (const o of bonus.items || []) { const it = Object.assign({}, o, { uid: G.uid++, known: true }); if (it.k === 'potion' || it.k === 'scroll' || it.k === 'wand') G.known[it.id] = true; G.p.inv.push(it); }
  if (bonus.items) { G.p.eq = { weapon: null, shield: null, ring: null }; for (const sl of ['weapon', 'shield', 'ring']) { const c = G.p.inv.filter(i => i.k === sl).sort((a, b) => (a.cursed - b.cursed) || ((ITEMS[b.id].v || 0) + (b.plus || 0)) - ((ITEMS[a.id].v || 0) + (a.plus || 0)))[0]; if (c && !c.cursed) G.p.eq[sl] = c.uid; } }
  for (const id of bonus.kit || []) { const it = mkItem(G, id, 0); it.cursed = false; if (it.plus < 0) it.plus = 0; if (it.k === 'potion' || it.k === 'scroll' || it.k === 'wand') G.known[id] = true; G.p.inv.push(it); }
  newFloor(G, 1);
  return G;
}
export function rng(G) { if (!G._r) { G._r = rngMake(G.seed); G._r.set(G.rs); } return G._r; }
function syncR(G) { G.rs = rng(G).get(); }

export function mkItem(G, id, floor) {
  const d = ITEMS[id], r = rng(G); const it = { uid: G.uid++, id, k: d.k };
  if (d.k === 'weapon' || d.k === 'shield') { const x = r(); it.plus = x < 0.12 ? -1 - Math.floor(r() * 2) : x < 0.7 ? 0 : 1 + Math.floor(r() * (1 + floor / 6)); it.cursed = it.plus < 0 && r() < 0.6; }
  if (d.k === 'ring') it.cursed = r() < 0.12;
  if (d.k === 'wand') it.ch = 3 + Math.floor(r() * 4);
  if (d.k === 'throw') it.n = d.v > 10 ? 1 + Math.floor(r() * 2) : 4 + Math.floor(r() * 6);
  return it;
}
export function itemName(G, it, full = true) {
  const d = ITEMS[it.id];
  if (d.k === 'potion' || d.k === 'scroll' || d.k === 'wand') { const nm = G.known[it.id] ? d.nm : G.looks[it.id]; return d.k === 'wand' && (G.known[it.id]) && full ? `${nm}[${it.ch}]` : nm; }
  if (d.k === 'weapon' || d.k === 'shield') return d.nm + (it.known && it.plus ? (it.plus > 0 ? '+' : '') + it.plus : '') + (it.known && it.cursed ? '（呪）' : '');
  if (d.k === 'ring') return d.nm + (it.known && it.cursed ? '（呪）' : '');
  if (d.k === 'throw') return `${d.nm}（${it.n}本）`;
  return d.nm;
}

// ---------- 迷宮づくり ----------
function carveRoom(G, rm) { for (let y = rm.y; y < rm.y + rm.h; y++) for (let x = rm.x; x < rm.x + rm.w; x++) { G.t[y * W + x] = 1; G.rid[y * W + x] = rm.i; } }
function carveCorr(G, x0, y0, x1, y1) {
  const r = rng(G); let x = x0, y = y0; const horizFirst = r() < 0.5; if (!G.t[y0 * W + x0]) G.t[y0 * W + x0] = 2;
  const step = (tx, ty) => { while (x !== tx) { x += Math.sign(tx - x); if (!G.t[y * W + x]) G.t[y * W + x] = 2; } while (y !== ty) { y += Math.sign(ty - y); if (!G.t[y * W + x]) G.t[y * W + x] = 2; } };
  const mx = horizFirst ? x1 : x0, my = horizFirst ? y0 : y1;
  if (horizFirst) { step(Math.round((x0 + x1) / 2), y0); step(Math.round((x0 + x1) / 2), y1); step(x1, y1); } else { step(x0, Math.round((y0 + y1) / 2)); step(x1, Math.round((y0 + y1) / 2)); step(x1, y1); }
}
export function newFloor(G, n) {
  const r = rng(G); G.floor = n; G.stats.maxFloor = Math.max(G.stats.maxFloor, n);
  G.t = new Uint8Array(W * H); G.rid = new Int16Array(W * H).fill(-1); G.seen = new Uint8Array(W * H);
  G.rooms = []; G.items = []; G.traps = []; G.mons = []; G.pillars = []; G.boss = n === 10 || n === FLOORS; G.mapRead = false; G.sightAll = false; G.spawnT = 0; G.stairs = null; G.exit = null;
  if (G.boss) {
    // ボスの間：大部屋ひとつと、入口の小部屋
    const a = { i: 0, x: 4, y: 12, w: 7, h: 10 }, b = { i: 1, x: 18, y: 5, w: 28, h: 25 };
    carveRoom(G, a); carveRoom(G, b); carveCorr(G, a.x + a.w - 1, a.y + 5, b.x, b.y + 12); G.rooms.push(a, b);
    G.p.x = a.x + 3; G.p.y = a.y + 5;
    const bid = n === FLOORS ? 'abyss' : 'boneking'; const m = mkMon(G, bid, b.x + 18, b.y + 12); m.awake = false; G.mons.push(m);
    for (let i = 0; i < 2; i++) { const it = rollItem(G, n); placeIn(G, a, it); }
    for (const p of [[1, 1], [b.w - 2, 1], [1, b.h - 2], [b.w - 2, b.h - 2]]) G.pillars = (G.pillars || []).concat([[b.x + p[0], b.y + p[1]]]);
    G.pillars.forEach(([x, y]) => { G.t[y * W + x] = 0; G.rid[y * W + x] = -1; });
    reveal(G); return;
  }
  G.pillars = [];
  // 3×3（ときどき 4×3）の区画に部屋
  const cols = r() < 0.4 ? 4 : 3, rows = 3, cw = Math.floor((W - 2) / cols), ch = Math.floor((H - 2) / rows);
  const cells = [];
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    const x0 = 1 + cx * cw, y0 = 1 + cy * ch;
    const isRoom = r() < 0.82;
    if (isRoom) { const w = 4 + Math.floor(r() * (cw - 7)), h = 3 + Math.floor(r() * (ch - 6)); const x = x0 + 1 + Math.floor(r() * (cw - w - 2)), y = y0 + 1 + Math.floor(r() * (ch - h - 2)); const rm = { i: G.rooms.length, x, y, w, h }; G.rooms.push(rm); carveRoom(G, rm); cells.push({ cx, cy, rm, px: x + Math.floor(w / 2), py: y + Math.floor(h / 2) }); }
    else { const px = x0 + 2 + Math.floor(r() * (cw - 4)), py = y0 + 2 + Math.floor(r() * (ch - 4)); G.t[py * W + px] = 2; cells.push({ cx, cy, rm: null, px, py }); }
  }
  if (G.rooms.length < 2) return newFloor(G, n);
  // となりの区画をつなぐ（全部つながるように木＋ちょっと輪）
  const at = (cx, cy) => cells.find(c => c.cx === cx && c.cy === cy);
  const links = []; for (const c of cells) { if (c.cx + 1 < cols) links.push([c, at(c.cx + 1, c.cy)]); if (c.cy + 1 < rows) links.push([c, at(c.cx, c.cy + 1)]); }
  shuffle(links, r); const parent = new Map(cells.map(c => [c, c])); const find = c => parent.get(c) === c ? c : find(parent.get(c));
  for (const [a, b] of links) { const fa = find(a), fb = find(b); if (fa !== fb || r() < 0.2) { parent.set(fa, fb); const pa = exitOf(a, b, r), pb = exitOf(b, a, r); carveCorr(G, pa[0], pa[1], pb[0], pb[1]); } }
  // 階段とプレイヤー
  const rmL = shuffle([...G.rooms], r);
  const sr = rmL[0]; G.stairs = { x: sr.x + 1 + Math.floor(r() * (sr.w - 2)), y: sr.y + 1 + Math.floor(r() * (sr.h - 2)) };
  const pr = rmL[1]; G.p.x = pr.x + Math.floor(r() * pr.w); G.p.y = pr.y + Math.floor(r() * pr.h);
  if (n >= 2 && (n % 3 === 0 || r() < 0.3) && rmL.length > 2) { const er = rmL[2 + Math.floor(r() * (rmL.length - 2))]; const [ex, ey] = freeIn(G, er); if (ex != null) G.exit = { x: ex, y: ey }; }
  // アイテム・罠・敵
  const ni = 4 + Math.floor(r() * 4);
  for (let i = 0; i < ni; i++) { const rm = G.rooms[Math.floor(r() * G.rooms.length)]; placeIn(G, rm, rollItem(G, n)); }
  const nt = Math.min(8, 1 + Math.floor(n / 3) + Math.floor(r() * 2)); const tk = Object.keys(TRAPS);
  for (let i = 0; i < nt; i++) { const rm = G.rooms[Math.floor(r() * G.rooms.length)]; const [x, y] = freeIn(G, rm); if (x != null && !(x === G.stairs.x && y === G.stairs.y)) G.traps.push({ x, y, k: tk[Math.floor(r() * (n < 3 ? 3 : tk.length))], known: false }); }
  const nm = 4 + Math.floor(n / 3) + Math.floor(r() * 3);
  G.encT = 0;
  // モンスターハウス（まれ）
  if (n >= 3 && r() < 0.08) { const rm = G.rooms.find(x => x !== pr && x.w * x.h >= 20); if (rm) { rm.house = true; for (let i = 0; i < 5; i++) placeIn(G, rm, rollItem(G, n)); } }
  reveal(G);
}
function exitOf(c, o, r) {
  if (!c.rm) return [c.px, c.py];
  const rm = c.rm;
  if (o.cx > c.cx) return [rm.x + rm.w, rm.y + Math.floor(r() * rm.h)];
  if (o.cx < c.cx) return [rm.x - 1, rm.y + Math.floor(r() * rm.h)];
  if (o.cy > c.cy) return [rm.x + Math.floor(r() * rm.w), rm.y + rm.h];
  return [rm.x + Math.floor(r() * rm.w), rm.y - 1];
}
function freeIn(G, rm) { const r = rng(G); for (let k = 0; k < 40; k++) { const x = rm.x + Math.floor(r() * rm.w), y = rm.y + Math.floor(r() * rm.h); if (!G.t[y * W + x]) continue; if (G.items.some(i => i.x === x && i.y === y) || G.mons.some(m => m.x === x && m.y === y) || (G.p.x === x && G.p.y === y) || (G.stairs && G.stairs.x === x && G.stairs.y === y) || (G.exit && G.exit.x === x && G.exit.y === y) || G.traps.some(t => t.x === x && t.y === y)) continue; return [x, y]; } return [null, null]; }
function placeIn(G, rm, it) { const [x, y] = freeIn(G, rm); if (x == null) return; if (it.mimic) { G.items.push({ x, y, it: it.it, mimic: true }); return; } G.items.push({ x, y, it }); }
function rollItem(G, n) {
  const r = rng(G);
  if (n >= 8 && r() < 0.05) return { mimic: true, it: mkItem(G, 'longsword', n) };
  const pool = Object.entries(ITEMS).filter(([, d]) => d.f <= n).map(([id, d]) => ({ id, w: d.w * (d.k === 'weapon' || d.k === 'shield' ? (n - d.f < 6 ? 1.4 : 0.5) : 1) }));
  return mkItem(G, pickW(pool, r).id, n);
}
function pickMonId(G, n) { const r = rng(G); const pool = Object.entries(MONS).filter(([, m]) => !m.boss && n >= m.f[0] && n <= m.f[1]).map(([id, m]) => ({ id, w: 1 + (n - m.f[0] < 3 ? 1 : 0) })); return pickW(pool, r).id; }
function mkMon(G, id, x, y) { const d = MONS[id]; const sc = 1 + Math.max(0, G.floor - d.f[1]) * 0.08; return { id: G.uid++, mid: id, x, y, hp: Math.round(d.hp * sc), mhp: Math.round(d.hp * sc), atk: d.atk, def: d.def, st: {}, awake: false, sleep: 0, dir: 4, acc: 0, tick: 0 }; }
function spawnMon(G, initial) {
  const r = rng(G); for (let k = 0; k < 30; k++) { const rm = G.rooms[Math.floor(r() * G.rooms.length)]; if (!initial && inRoomOf(G, G.p.x, G.p.y) === rm.i) continue; const [x, y] = freeIn(G, rm); if (x == null) continue; if (initial && Math.abs(x - G.p.x) + Math.abs(y - G.p.y) < 6) continue; const m = mkMon(G, pickMonId(G, G.floor), x, y); if (initial && r() < 0.35) m.sleep = 30 + Math.floor(r() * 60); G.mons.push(m); return m; }
}
const inRoomOf = (G, x, y) => G.rid[y * W + x];
export const walk = (G, x, y) => x >= 0 && y >= 0 && x < W && y < H && G.t[y * W + x] > 0;
export const monAt = (G, x, y) => G.mons.find(m => m.x === x && m.y === y);

// ---------- 見える範囲 ----------
export function visible(G, x, y) {
  if (G.sightAll) return true;
  const rid = inRoomOf(G, G.p.x, G.p.y);
  if (rid >= 0) { const rm = G.rooms[rid]; return x >= rm.x - 1 && x <= rm.x + rm.w && y >= rm.y - 1 && y <= rm.y + rm.h; }
  return Math.max(Math.abs(x - G.p.x), Math.abs(y - G.p.y)) <= 1;
}
export function reveal(G) {
  const rid = inRoomOf(G, G.p.x, G.p.y);
  if (rid >= 0) { const rm = G.rooms[rid]; for (let y = rm.y - 1; y <= rm.y + rm.h; y++) for (let x = rm.x - 1; x <= rm.x + rm.w; x++) if (x >= 0 && y >= 0 && x < W && y < H) G.seen[y * W + x] = 1; }
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const x = G.p.x + dx, y = G.p.y + dy; if (x >= 0 && y >= 0 && x < W && y < H) G.seen[y * W + x] = 1; }
}

// ---------- 計算 ----------
const eqItem = (G, slot) => G.p.inv.find(i => i.uid === G.p.eq[slot]);
export function pAtk(G) { const w = eqItem(G, 'weapon'), rg = eqItem(G, 'ring'); return Math.max(1, 3 + (G.p.batk || 0) + G.p.lv + G.p.str + (w ? ITEMS[w.id].v + w.plus : 0) + (rg && ITEMS[rg.id].eff === 'atk3' ? 3 : 0)); }
export function pDef(G) { const s = eqItem(G, 'shield'), rg = eqItem(G, 'ring'); return Math.max(0, (G.p.bdef || 0) + (s ? ITEMS[s.id].v + s.plus : 0) + (rg && ITEMS[rg.id].eff === 'def3' ? 3 : 0) + Math.floor(G.p.lv / 4)); }
export const ringEff = G => { const rg = eqItem(G, 'ring'); return rg ? ITEMS[rg.id].eff : null; };
const dmgCalc = (G, atk, def) => Math.max(1, Math.round((atk - def * 0.55) * (0.85 + rng(G)() * 0.3)));
export const xpNeed = lv => Math.round(10 * Math.pow(lv, 1.6));
const canStep = (G, x, y, dx, dy, phase) => { if (phase) return x + dx >= 1 && y + dy >= 1 && x + dx < W - 1 && y + dy < H - 1; if (!walk(G, x + dx, y + dy)) return false; if (dx && dy && (!walk(G, x + dx, y) || !walk(G, x, y + dy))) return false; return true; };

function msg(G, ev, text) { G.log.push(text); if (G.log.length > 60) G.log.shift(); ev.push({ t: 'msg', text }); }

// ---------- プレイヤーの行動 ----------
// act: {k:'move',d} {k:'wait'} {k:'stairs'} {k:'use',uid,target} {k:'throw',uid} {k:'equip',uid} {k:'drop',uid} {k:'pick'} {k:'turn',d}
export function act(G, a) {
  if (G.over) return [];
  if (G.battle) return battleAct(G, a);
  const ev = [];
  const p = G.p;
  if (a.k === 'turn') { p.dir = a.d; ev.push({ t: 'turn', id: 0, d: a.d }); return ev; }
  if (p.st.sleep > 0) { a = { k: 'wait' }; }
  let took = true;
  if (a.k === 'move') {
    let d = a.d; if (p.st.confuse > 0 && rng(G)() < 0.6) d = Math.floor(rng(G)() * 8);
    const [dx, dy] = DIRS[d]; p.dir = d; const nx = p.x + dx, ny = p.y + dy;
    const m = monAt(G, nx, ny);
    if (m) { startBattle(G, ev, [m.mid], { boss: !!MONS[m.mid].boss, mapId: m.id }); syncR(G); return ev; }
    else if (canStep(G, p.x, p.y, dx, dy)) { ev.push({ t: 'move', id: 0, x: nx, y: ny, fx: p.x, fy: p.y }); p.x = nx; p.y = ny; reveal(G); stepOn(G, ev, a.noPick); if (!G.battle && !G.over) encounterCheck(G, ev); }
    else { took = false; ev.push({ t: 'turn', id: 0, d }); }
  } else if (a.k === 'attack') { const [dx, dy] = DIRS[p.dir]; const m = monAt(G, p.x + dx, p.y + dy); if (m && !(dx && dy && (!walk(G, p.x + dx, p.y) || !walk(G, p.x, p.y + dy)))) attackMon(G, ev, m); else ev.push({ t: 'swing', id: 0 }); }
  else if (a.k === 'wait') { if (p.st.sleep > 0) msg(G, ev, 'ぐっすり眠っている…'); }
  else if (a.k === 'pick') { const fi = G.items.find(i => i.x === p.x && i.y === p.y); if (fi) pickUp(G, ev, fi); else took = false; }
  else if (a.k === 'extract') { if (G.exit && p.x === G.exit.x && p.y === G.exit.y) { extract(G, ev, '帰還の魔法陣'); return ev; } took = false; }
  else if (a.k === 'stairs') { if (G.stairs && p.x === G.stairs.x && p.y === G.stairs.y) { descend(G, ev); return ev; } took = false; }
  else if (a.k === 'use') took = useItem(G, ev, a.uid, a.target);
  else if (a.k === 'throw') took = throwItem(G, ev, a.uid);
  else if (a.k === 'equip') took = equip(G, ev, a.uid);
  else if (a.k === 'drop') took = drop(G, ev, a.uid);
  if (!took) return ev;
  if (G.extracted || G.battle) { syncR(G); return ev; }
  endTurn(G, ev);
  syncR(G);
  return ev;
}
function attackMon(G, ev, m) {
  const p = G.p, r = rng(G);
  if (m.disguise) { m.disguise = null; msg(G, ev, 'ミミックだった！'); ev.push({ t: 'reveal', id: m.id }); }
  m.awake = true; m.sleep = 0;
  if (r() < 0.08) { ev.push({ t: 'atk', id: 0, tid: m.id, miss: true }); msg(G, ev, '攻撃は外れた'); return; }
  const d = dmgCalc(G, pAtk(G), m.def); ev.push({ t: 'atk', id: 0, tid: m.id, dmg: d }); hurtMon(G, ev, m, d, 'atk');
}
function hurtMon(G, ev, m, d, how) {
  m.hp -= d; ev.push({ t: 'hurt', id: m.id, dmg: d });
  if (m.hp <= 0) killMon(G, ev, m);
}
function killMon(G, ev, m) {
  const D = MONS[m.mid]; G.mons = G.mons.filter(x => x !== m); G.p.kills++; G.stats.kills++; const kb = (G.stats.killsBy ||= {}); kb[m.mid] = (kb[m.mid] || 0) + 1;
  ev.push({ t: 'die', id: m.id }); msg(G, ev, `${D.nm}をたおした（経験 +${D.xp}）`);
  gainXp(G, ev, D.xp);
  // ドロップ
  const r = rng(G); if (r() < (D.boss ? 1 : 0.12) && walk(G, m.x, m.y) && !G.items.some(i => i.x === m.x && i.y === m.y)) { const it = D.boss ? mkItem(G, G.floor >= FLOORS ? 'holy' : 'katana', G.floor) : rollItem(G, G.floor); if (!it.mimic) { G.items.push({ x: m.x, y: m.y, it }); ev.push({ t: 'drop', x: m.x, y: m.y }); } }
  if (D.boss) {
    if (G.floor >= FLOORS) { G.over = true; G.win = true; G.extracted = true; msg(G, ev, '奈落の主をたおした！ 光が差しこむ…'); ev.push({ t: 'win' }); }
    else { const b = G.rooms[1]; G.stairs = { x: b.x + b.w - 3, y: b.y + Math.floor(b.h / 2) }; msg(G, ev, '奥に下り階段と帰還の魔法陣があらわれた'); ev.push({ t: 'stairsAppear', x: G.stairs.x, y: G.stairs.y }); G.exit = { x: G.stairs.x - 2, y: G.stairs.y }; ev.push({ t: 'exitAppear', x: G.exit.x, y: G.exit.y }); }
  }
}
function gainXp(G, ev, n) { const p = G.p; p.xp += n; while (p.xp >= xpNeed(p.lv)) { p.xp -= xpNeed(p.lv); p.lv++; const up = 5 + Math.floor(rng(G)() * 3); p.mhp += up; p.hp += up; msg(G, ev, `レベルが ${p.lv} に上がった！`); ev.push({ t: 'lvup' }); } }
function encounterCheck(G, ev) {
  if (G.boss) return; const r = rng(G);
  if (G.encSafe > 0) { G.encSafe--; return; }
  G.encT = (G.encT || 0) + 1; const room = G.rid[G.p.y * W + G.p.x] >= 0 && G.rooms[G.rid[G.p.y * W + G.p.x]]?.house;
  const ch = Math.min(0.14, (G.floor === 1 ? 0.012 : 0.02) + G.encT * 0.006) * (room ? 3 : 1);
  if (r() < ch) startBattle(G, ev, room ? encounterGroup(G).concat([pickMonId(G, G.floor)]) : encounterGroup(G));
}
function stepOn(G, ev, noPick) {
  const p = G.p;
  const fi = G.items.find(i => i.x === p.x && i.y === p.y); if (fi && !noPick) pickUp(G, ev, fi); else if (fi) msg(G, ev, `${itemName(G, fi.it)}の上に乗った`);
  const tr = G.traps.find(t => t.x === p.x && t.y === p.y);
  if (tr) { tr.known = true; springTrap(G, ev, tr); }
  if (G.stairs && p.x === G.stairs.x && p.y === G.stairs.y) ev.push({ t: 'onStairs' });
  if (G.exit && p.x === G.exit.x && p.y === G.exit.y) ev.push({ t: 'onExit' });
}
function pickUp(G, ev, fi) {
  const p = G.p;
  if (fi.mimic) { fi.mimic = false; startBattle(G, ev, ['mimic'], { item: fi.it.uid, ambush: true, text: `${itemName(G, fi.it)}が おそいかかってきた！ ミミックだ！` }); return; }
  if (fi.it.k === 'throw') { const same = p.inv.find(i => i.id === fi.it.id); if (same) { same.n += fi.it.n; G.items = G.items.filter(i => i !== fi); msg(G, ev, `${ITEMS[fi.it.id].nm}を ${fi.it.n}本 拾った`); ev.push({ t: 'pick', x: fi.x, y: fi.y }); return; } }
  if (p.inv.length >= 18) { msg(G, ev, `持ち物がいっぱいで ${itemName(G, fi.it)} を拾えない`); return; }
  p.inv.push(fi.it); G.items = G.items.filter(i => i !== fi); G.stats.items++;
  msg(G, ev, `${itemName(G, fi.it)}を拾った`); ev.push({ t: 'pick', x: fi.x, y: fi.y });
}
function springTrap(G, ev, tr) {
  const p = G.p, r = rng(G); msg(G, ev, `${TRAPS[tr.k].nm}だ！`); ev.push({ t: 'trap', k: tr.k, x: tr.x, y: tr.y });
  if (tr.k === 'pit') { p.hp -= 5; if (p.hp <= 0) return die(G, ev, '落とし穴'); descend(G, ev, true); }
  else if (tr.k === 'arrow') { hurtP(G, ev, 6, '毒矢'); if (r() < 0.6) { p.str--; msg(G, ev, '毒で力が下がった…'); } }
  else if (tr.k === 'summon') { startBattle(G, ev, encounterGroup(G).concat([pickMonId(G, G.floor)]), { ambush: true }); }
  else if (tr.k === 'summon_old') { for (let i = 0; i < 3; i++) { for (const [dx, dy] of shuffle([...DIRS], r)) { const x = p.x + dx, y = p.y + dy; if (walk(G, x, y) && !monAt(G, x, y)) { const m = mkMon(G, pickMonId(G, G.floor), x, y); m.awake = true; G.mons.push(m); ev.push({ t: 'spawn', id: m.id }); break; } } } }
  else if (tr.k === 'sleep') { p.st.sleep = 4; msg(G, ev, '眠ってしまった…'); }
  else if (tr.k === 'rust') { const w = eqItem(G, r() < 0.5 ? 'weapon' : 'shield'); if (w) { w.plus--; msg(G, ev, `${ITEMS[w.id].nm}がさびた（-1）`); } }
}
function extract(G, ev, how) { G.over = true; G.extracted = true; G.cause = how; msg(G, ev, '地上に帰還した！'); ev.push({ t: 'extract' }); }
function descend(G, ev, fell) {
  if (G.floor >= FLOORS) return;
  ev.push({ t: 'floor', n: G.floor + 1, fell: !!fell });
  newFloor(G, G.floor + 1);
  msg(G, ev, G.boss ? `地下${G.floor}階……強い気配がする` : `地下${G.floor}階に着いた`);
}
function hurtP(G, ev, d, cause, from) {
  const p = G.p; p.hp -= d; ev.push({ t: 'hurt', id: 0, dmg: d, from });
  if (p.st.sleep > 0 && from != null) p.st.sleep = 0;
  if (p.hp <= 0) die(G, ev, cause);
}
function die(G, ev, cause) { G.p.hp = 0; G.over = true; G.cause = cause; msg(G, ev, `${cause}にたおされた…`); ev.push({ t: 'dead', cause }); }

// ---------- 道具 ----------
function equip(G, ev, uid) {
  const p = G.p, it = p.inv.find(i => i.uid === uid); if (!it) return false;
  const slot = it.k === 'weapon' ? 'weapon' : it.k === 'shield' ? 'shield' : it.k === 'ring' ? 'ring' : null; if (!slot) return false;
  const cur = eqItem(G, slot);
  if (cur && cur.cursed) { msg(G, ev, `${itemName(G, cur)}は呪われていて外せない！`); return false; }
  if (p.eq[slot] === uid) { p.eq[slot] = null; msg(G, ev, `${itemName(G, it)}を外した`); ev.push({ t: 'equip' }); return true; }
  p.eq[slot] = uid; it.known = true; msg(G, ev, `${itemName(G, it)}を装備した`);
  if (it.cursed) msg(G, ev, 'うっ…呪われていた！');
  if (slot === 'ring') G.known[it.id] = true;
  ev.push({ t: 'equip' }); return true;
}
function drop(G, ev, uid) {
  const p = G.p, it = p.inv.find(i => i.uid === uid); if (!it) return false;
  if (Object.values(p.eq).includes(uid)) { if (it.cursed) { msg(G, ev, '呪われていて置けない'); return false; } for (const k in p.eq) if (p.eq[k] === uid) p.eq[k] = null; }
  if (G.items.some(i => i.x === p.x && i.y === p.y)) { msg(G, ev, 'ここには置けない'); return false; }
  p.inv = p.inv.filter(i => i !== it); G.items.push({ x: p.x, y: p.y, it }); msg(G, ev, `${itemName(G, it)}を置いた`); ev.push({ t: 'drop', x: p.x, y: p.y }); return true;
}
function removeInv(G, it) { G.p.inv = G.p.inv.filter(i => i !== it); for (const k in G.p.eq) if (G.p.eq[k] === it.uid) G.p.eq[k] = null; }
function roomMons(G) { const rid = inRoomOf(G, G.p.x, G.p.y); return G.mons.filter(m => rid >= 0 ? (inRoomOf(G, m.x, m.y) === rid || visible(G, m.x, m.y)) : Math.max(Math.abs(m.x - G.p.x), Math.abs(m.y - G.p.y)) <= 1); }
function useItem(G, ev, uid, target) {
  const p = G.p, it = p.inv.find(i => i.uid === uid); if (!it) return false; const d = ITEMS[it.id], r = rng(G);
  const wasKnown = G.known[it.id];
  if (d.k === 'weapon' || d.k === 'shield' || d.k === 'ring') return equip(G, ev, uid);
  if (d.k === 'treasure') { msg(G, ev, `${d.nm}…持ち帰れば高く売れそうだ`); return false; }
  if (d.k === 'food') { removeInv(G, it); const over = p.belly + d.v > p.mbelly; p.belly = Math.min(p.mbelly, p.belly + d.v); if (over && p.belly >= p.mbelly) { p.mbelly = Math.min(200, p.mbelly + (d.v >= 100 ? 10 : 3)); p.belly = p.mbelly; msg(G, ev, `${d.nm}を食べた。お腹の最大がふえた`); } else msg(G, ev, `${d.nm}を食べた。お腹がふくれた`); if (d.hp) p.hp = Math.min(p.mhp, p.hp + d.hp); ev.push({ t: 'eat' }); return true; }
  if (d.k === 'potion') {
    removeInv(G, it); G.known[it.id] = true; const nm = d.nm; ev.push({ t: 'drink', id: it.id });
    if (it.id === 'p_heal') { const h = 30 + p.lv * 2; if (p.hp >= p.mhp) { p.mhp += 3; msg(G, ev, `${nm}を飲んだ。最大HPが 3 ふえた`); } else msg(G, ev, `${nm}を飲んだ。HPが回復した`); p.hp = Math.min(p.mhp, p.hp + h); p.st.confuse = 0; }
    if (it.id === 'p_bigheal') { if (p.hp >= p.mhp) p.mhp += 6; p.hp = p.mhp; p.st = {}; msg(G, ev, `${nm}を飲んだ。体じゅうに力がみなぎる`); }
    if (it.id === 'p_str') { p.str++; msg(G, ev, `${nm}を飲んだ。力が 1 上がった`); }
    if (it.id === 'p_life') { p.mhp += 8; p.hp = p.mhp; msg(G, ev, `${nm}を飲んだ。最大HPが 8 ふえた`); }
    if (it.id === 'p_xp') { gainXp(G, ev, xpNeed(p.lv) - p.xp); msg(G, ev, `${nm}を飲んだ`); }
    if (it.id === 'p_poison') { p.str = p.str - 1; hurtP(G, ev, 5, '毒薬'); msg(G, ev, `${nm}だった…力が下がった`); }
    if (it.id === 'p_confuse') { p.st.confuse = 10; msg(G, ev, `${nm}だった。目が回る…`); }
    if (it.id === 'p_sight') { G.sightAll = true; msg(G, ev, `${nm}を飲んだ。この階のすべてが見える`); }
    return true;
  }
  if (d.k === 'scroll') {
    removeInv(G, it); G.known[it.id] = true; const nm = d.nm; ev.push({ t: 'read', id: it.id });
    if (it.id === 's_map') { for (let i = 0; i < W * H; i++) if (G.t[i]) G.seen[i] = 1; G.mapRead = true; msg(G, ev, `${nm}を読んだ。この階の地図がわかった`); }
    if (it.id === 's_thunder') { const ms = roomMons(G); msg(G, ev, `${nm}を読んだ。雷が落ちる！`); ev.push({ t: 'fx', k: 'thunder' }); for (const m of ms) hurtMon(G, ev, m, 25, 'thunder'); }
    if (it.id === 's_sleep') { for (const m of roomMons(G)) m.sleep = 12; msg(G, ev, `${nm}を読んだ。まわりの敵が眠った`); ev.push({ t: 'fx', k: 'sleep' }); }
    if (it.id === 's_weapon') { const w = eqItem(G, 'weapon'); if (w) { w.plus++; w.cursed = false; msg(G, ev, `${ITEMS[w.id].nm}が強くなった（+1）`); } else msg(G, ev, `${nm}を読んだが、何も起こらなかった`); }
    if (it.id === 's_shield') { const w = eqItem(G, 'shield'); if (w) { w.plus++; w.cursed = false; msg(G, ev, `${ITEMS[w.id].nm}が強くなった（+1）`); } else msg(G, ev, `${nm}を読んだが、何も起こらなかった`); }
    if (it.id === 's_ident') { const tgt = p.inv.find(i => i.uid === target) || p.inv.find(i => !isKnown(G, i)); if (tgt) { identify(G, tgt); msg(G, ev, `${itemName(G, tgt)}だとわかった`); } else msg(G, ev, `${nm}を読んだが、わからない物はなかった`); }
    if (it.id === 's_escape') { msg(G, ev, `${nm}を読んだ。光につつまれる…`); extract(G, ev, nm); return true; }
    if (it.id === 's_teleport') { teleport(G, ev); msg(G, ev, `${nm}を読んだ。体が消えた！`); }
    if (it.id === 's_purify') { for (const i of p.inv) { i.cursed = false; if (i.plus < 0) i.plus = 0; } msg(G, ev, `${nm}を読んだ。呪いが解けた`); }
    if (it.id === 's_fear') { for (const m of roomMons(G)) m.st.fear = 15; msg(G, ev, `${nm}を読んだ。敵はおびえて逃げだした`); }
    return true;
  }
  if (d.k === 'wand') {
    if (it.ch <= 0) { msg(G, ev, '杖はもう使えない（振ってみたが何も出ない）'); return true; }
    it.ch--; const [dx, dy] = DIRS[p.dir]; let x = p.x, y = p.y, hit = null, n = 0;
    while (n++ < 12) { x += dx; y += dy; if (!walk(G, x, y)) { x -= dx; y -= dy; break; } const m = monAt(G, x, y); if (m) { hit = m; break; } }
    ev.push({ t: 'proj', k: 'wand', fx: p.x, fy: p.y, x, y }); G.known[it.id] = true;
    if (!hit) { msg(G, ev, `${d.nm}を振った。魔法は外れた`); return true; }
    const nm = MONS[hit.mid].nm; hit.awake = true; hit.sleep = 0;
    if (it.id === 'w_blow') { let k = 0; while (k++ < 10 && walk(G, hit.x + dx, hit.y + dy) && !monAt(G, hit.x + dx, hit.y + dy) && !(G.p.x === hit.x + dx && G.p.y === hit.y + dy)) { hit.x += dx; hit.y += dy; } ev.push({ t: 'move', id: hit.id, x: hit.x, y: hit.y, fast: true }); msg(G, ev, `${nm}をふきとばした`); hurtMon(G, ev, hit, 5); }
    if (it.id === 'w_slow') { hit.st.slow = 30; msg(G, ev, `${nm}の動きがおそくなった`); }
    if (it.id === 'w_bolt') { msg(G, ev, `雷撃が${nm}をつらぬく！`); hurtMon(G, ev, hit, 22 + G.floor * 2); }
    if (it.id === 'w_swap') { const ox = p.x, oy = p.y; p.x = hit.x; p.y = hit.y; hit.x = ox; hit.y = oy; ev.push({ t: 'move', id: 0, x: p.x, y: p.y, fast: true }, { t: 'move', id: hit.id, x: hit.x, y: hit.y, fast: true }); reveal(G); msg(G, ev, `${nm}と場所を入れ替えた`); }
    if (it.id === 'w_seal') { hit.st.seal = 1; msg(G, ev, `${nm}の特技を封じた`); }
    return true;
  }
  if (d.k === 'throw') return throwItem(G, ev, uid);
  return false;
}
function isKnown(G, it) { const k = ITEMS[it.id].k; if (k === 'potion' || k === 'scroll' || k === 'wand') return !!G.known[it.id]; if (k === 'weapon' || k === 'shield' || k === 'ring') return !!it.known; return true; }
export function identify(G, it) { it.known = true; G.known[it.id] = true; }
export { isKnown };
function teleport(G, ev) { const r = rng(G); for (let k = 0; k < 50; k++) { const rm = G.rooms[Math.floor(r() * G.rooms.length)]; const [x, y] = freeIn(G, rm); if (x != null) { G.p.x = x; G.p.y = y; reveal(G); ev.push({ t: 'warp', x, y }); return; } } }
function throwItem(G, ev, uid) {
  const p = G.p, it = p.inv.find(i => i.uid === uid); if (!it) return false; if (Object.values(p.eq).includes(uid) && it.cursed) { msg(G, ev, '呪われていて手放せない'); return false; }
  const d = ITEMS[it.id], [dx, dy] = DIRS[p.dir]; let x = p.x, y = p.y, hit = null, n = 0;
  while (n++ < 10) { if (!walk(G, x + dx, y + dy)) break; x += dx; y += dy; const m = monAt(G, x, y); if (m) { hit = m; break; } }
  let thrown = it; if (d.k === 'throw' && it.n > 1) { it.n--; thrown = Object.assign({}, it, { uid: G.uid++, n: 1 }); } else removeInv(G, it);
  ev.push({ t: 'proj', k: d.k === 'throw' ? it.id : 'item', fx: p.x, fy: p.y, x, y });
  if (hit) {
    const nm = MONS[hit.mid].nm; hit.awake = true; hit.sleep = 0;
    if (rng(G)() < 0.12) { msg(G, ev, `${d.nm}は${nm}に当たらなかった`); dropAt(G, ev, thrown, x, y); return true; }
    if (d.k === 'throw') { const dmg = it.id === 'holywater' ? (UNDEAD.has(hit.mid) ? d.v * 2 : 6) : d.v + Math.floor(G.floor / 2); msg(G, ev, `${d.nm}が${nm}に当たった`); hurtMon(G, ev, hit, dmg); if (it.id === 'knife' && rng(G)() < 0.5) dropAt(G, ev, thrown, hit.x, hit.y); }
    else if (d.k === 'potion') { G.known[it.id] = true; msg(G, ev, `${G.looks[it.id] || d.nm}が${nm}にかかった`); if (it.id === 'p_heal' || it.id === 'p_bigheal') { hit.hp = Math.min(hit.mhp, hit.hp + 40); if (UNDEAD.has(hit.mid)) hurtMon(G, ev, hit, 40); } else if (it.id === 'p_confuse') hit.st.confuse = 12; else if (it.id === 'p_poison') hurtMon(G, ev, hit, 12); else hurtMon(G, ev, hit, 2); }
    else { msg(G, ev, `${itemName(G, it)}が${nm}に当たった`); hurtMon(G, ev, hit, 2); dropAt(G, ev, thrown, x, y); }
  } else { msg(G, ev, `${itemName(G, thrown)}を投げた`); if (d.k !== 'potion') dropAt(G, ev, thrown, x, y); }
  return true;
}
function dropAt(G, ev, it, x, y) { for (const [dx, dy] of [[0, 0], ...DIRS]) { const nx = x + dx, ny = y + dy; if (walk(G, nx, ny) && !G.items.some(i => i.x === nx && i.y === ny) && !(G.stairs && G.stairs.x === nx && G.stairs.y === ny)) { G.items.push({ x: nx, y: ny, it }); ev.push({ t: 'drop', x: nx, y: ny }); return; } } }

// ---------- ターンの終わり：敵が動く ----------
function endTurn(G, ev) {
  const p = G.p, r = rng(G); G.turn++; G.stats.turns++;
  // 満腹度・回復
  p.bellyT++; const bellyEvery = ringEff(G) === 'belly' ? 20 : 10;
  if (p.bellyT >= bellyEvery) { p.bellyT = 0; if (p.belly > 0) { p.belly--; if (p.belly === 20) msg(G, ev, 'お腹がへってきた…'); if (p.belly === 0) msg(G, ev, 'お腹がぺこぺこだ！何か食べないと…'); } }
  if (p.belly <= 0) { hurtP(G, ev, 1, '空腹'); if (G.over) return; }
  else { p.regen += p.mhp / (ringEff(G) === 'regen' ? 80 : 180); if (p.regen >= 1) { const h = Math.floor(p.regen); p.regen -= h; p.hp = Math.min(p.mhp, p.hp + h); } }
  for (const k of Object.keys(p.st)) if (p.st[k] > 0) p.st[k]--;
  // 敵
  const dist = null;
  for (const m of []) {
    if (!G.mons.includes(m) || G.over) continue;
    const D = MONS[m.mid]; let n = D.sp >= 2 ? 2 : 1; if (m.st.slow > 0) { m.tick = (m.tick || 0) + 1; n = m.tick % 2 ? 0 : 1; }
    for (let k = 0; k < n && !G.over; k++) monAct(G, ev, m, dist);
    for (const s of Object.keys(m.st)) if (m.st[s] > 0 && s !== 'seal') m.st[s]--;
  }
  // ボスの技
  // ときどき敵が増える
  if (G.boss && !G.battle) { const b = G.mons.find(m => MONS[m.mid].boss); if (b && Math.max(Math.abs(b.x - p.x), Math.abs(b.y - p.y)) <= 3) startBattle(G, ev, b.mid === 'abyss' ? ['abyss'] : ['boneking'], { boss: true, mapId: b.id, text: b.mid === 'abyss' ? '「よくぞ ここまで来た… だが ここが おまえの 墓場だ」' : '「わが眠りを さまたげる者は だれだ…」' }); }
  if (G.mapRead || ringEff(G) === 'sight') G.sightAll = G.sightAll || ringEff(G) === 'sight';
}
function distMap(G, sx, sy) {
  const d = new Int16Array(W * H).fill(-1), q = [sy * W + sx]; d[q[0]] = 0;
  for (let qi = 0; qi < q.length; qi++) { const c = q[qi], cx = c % W, cy = (c / W) | 0; if (d[c] > 30) continue; for (const [dx, dy] of DIRS) { const nx = cx + dx, ny = cy + dy; if (!walk(G, nx, ny)) continue; if (dx && dy && (!walk(G, cx + dx, cy) || !walk(G, cx, cy + dy))) continue; const ni = ny * W + nx; if (d[ni] < 0) { d[ni] = d[c] + 1; q.push(ni); } } }
  return d;
}
function sees(G, m) {
  const p = G.p; const rid = inRoomOf(G, m.x, m.y), pr = inRoomOf(G, p.x, p.y);
  if (rid >= 0 && rid === pr) return true;
  return Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= (rid >= 0 || pr >= 0 ? 2 : 3);
}
function monAct(G, ev, m, dist) {
  const p = G.p, D = MONS[m.mid], r = rng(G), sealed = m.st.seal;
  if (m.disguise) { if (Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 1 && r() < 0.5) { m.disguise = null; ev.push({ t: 'reveal', id: m.id }); msg(G, ev, 'アイテムが襲いかかってきた！ミミックだ！'); } return; }
  if (m.sleep > 0) { m.sleep--; if (m.sleep > 0 && !(sees(G, m) && r() < (m.sleep > 100 ? 0.15 : 0.05))) return; m.sleep = 0; }
  if (!m.awake) { if (sees(G, m)) m.awake = true; else if (D.boss) return; }
  const adx = p.x - m.x, ady = p.y - m.y, near = Math.max(Math.abs(adx), Math.abs(ady)) === 1;
  const phase = D.ab === 'phase' && !sealed;
  const canHit = near && (phase || !(adx && ady && (!walk(G, m.x + adx, m.y) || !walk(G, m.x, m.y + ady))));
  if (m.st.confuse > 0 || (D.ab === 'erratic' && !sealed && r() < 0.5)) { randomStep(G, ev, m, phase); return; }
  if (m.st.fear > 0) { fleeStep(G, ev, m, dist, phase); return; }
  // ボスの特技
  if (D.ab === 'summon' && !sealed && m.awake && (m.cool = (m.cool || 0) + 1) % 6 === 0) { let n = 0; for (const [dx, dy] of shuffle([...DIRS], r)) { if (n >= 2) break; const x = m.x + dx * 2, y = m.y + dy * 2; if (walk(G, x, y) && !monAt(G, x, y) && !(p.x === x && p.y === y)) { const s = mkMon(G, 'skeleton', x, y); s.awake = true; G.mons.push(s); ev.push({ t: 'spawn', id: s.id }); n++; } } msg(G, ev, `${D.nm}が骸骨を呼びだした！`); return; }
  if (D.ab === 'breath' && !sealed && m.awake && (m.cool = (m.cool || 0) + 1) % 4 === 0 && (adx === 0 || ady === 0 || Math.abs(adx) === Math.abs(ady))) { ev.push({ t: 'proj', k: 'breath', fx: m.x, fy: m.y, x: p.x, y: p.y, id: m.id }); msg(G, ev, `${D.nm}が闇の炎をはいた！`); hurtP(G, ev, Math.max(5, 28 - pDef(G)), D.nm, m.id); return; }
  if (D.ab === 'fire' && !sealed && !near && (adx === 0 || ady === 0 || Math.abs(adx) === Math.abs(ady)) && Math.max(Math.abs(adx), Math.abs(ady)) <= 5 && sees(G, m) && lineClear(G, m.x, m.y, p.x, p.y) && r() < 0.5) { ev.push({ t: 'proj', k: 'fire', fx: m.x, fy: m.y, x: p.x, y: p.y, id: m.id }); hurtP(G, ev, Math.max(1, 7 + Math.floor(G.floor / 2) - Math.floor(pDef(G) / 3)), D.nm, m.id); msg(G, ev, `${D.nm}が火の玉を放った`); return; }
  if (D.ab === 'curse' && !sealed && Math.max(Math.abs(adx), Math.abs(ady)) <= 3 && sees(G, m) && r() < 0.25) { ev.push({ t: 'cast', id: m.id }); if (r() < 0.5) { p.st.confuse = 6; msg(G, ev, `${D.nm}の呪文！目が回る…`); } else { const eqs = Object.values(p.eq).filter(Boolean); const it = p.inv.find(i => i.uid === eqs[Math.floor(r() * eqs.length)]); if (it) { it.cursed = true; it.known = true; msg(G, ev, `${D.nm}の呪文！${ITEMS[it.id].nm}が呪われた`); } } return; }
  if (canHit) {
    m.dir = DIRS.findIndex(([x, y]) => x === Math.sign(adx) && y === Math.sign(ady));
    if (r() < 0.12) { ev.push({ t: 'atk', id: m.id, tid: 0, miss: true }); msg(G, ev, `${D.nm}の攻撃は外れた`); return; }
    const dmg = dmgCalc(G, m.atk + Math.floor(G.floor / 3), pDef(G)); ev.push({ t: 'atk', id: m.id, tid: 0, dmg }); msg(G, ev, `${D.nm}の攻撃！ ${dmg}のダメージ`);
    hurtP(G, ev, dmg, D.nm, m.id);
    if (D.ab === 'poison' && !sealed && r() < 0.3 && !G.over) { p.str--; msg(G, ev, '毒で力が下がった…'); }
    return;
  }
  if (m.awake && (sees(G, m) || m.chase > 0)) { if (sees(G, m)) m.chase = 8; else m.chase--; chaseStep(G, ev, m, dist, phase); return; }
  wander(G, ev, m, phase);
}
function lineClear(G, x0, y0, x1, y1) { const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0); let x = x0, y = y0; while (x !== x1 || y !== y1) { x += dx; y += dy; if (x === x1 && y === y1) return true; if (!walk(G, x, y) || monAt(G, x, y)) return false; } return true; }
function tryMove(G, ev, m, dx, dy, phase) { const nx = m.x + dx, ny = m.y + dy; if (nx === G.p.x && ny === G.p.y) return false; if (monAt(G, nx, ny)) return false; if (!canStep(G, m.x, m.y, dx, dy, phase)) return false; ev.push({ t: 'move', id: m.id, x: nx, y: ny, fx: m.x, fy: m.y }); m.x = nx; m.y = ny; m.dir = DIRS.findIndex(([a, b]) => a === dx && b === dy); return true; }
function chaseStep(G, ev, m, dist, phase) {
  const p = G.p; let best = null, bd = 1e9;
  for (const [dx, dy] of DIRS) { const nx = m.x + dx, ny = m.y + dy; let d; if (phase) d = Math.max(Math.abs(p.x - nx), Math.abs(p.y - ny)); else { if (!walk(G, nx, ny)) continue; d = dist[ny * W + nx]; if (d < 0) continue; } if (monAt(G, nx, ny)) d += 2; if (d < bd) { bd = d; best = [dx, dy]; } }
  if (best) tryMove(G, ev, m, best[0], best[1], phase);
}
function fleeStep(G, ev, m, dist, phase) { let best = null, bd = -1; for (const [dx, dy] of DIRS) { const nx = m.x + dx, ny = m.y + dy; if (!walk(G, nx, ny) && !phase) continue; const d = Math.max(Math.abs(G.p.x - nx), Math.abs(G.p.y - ny)); if (d > bd && !monAt(G, nx, ny)) { bd = d; best = [dx, dy]; } } if (best) tryMove(G, ev, m, best[0], best[1], phase); }
function randomStep(G, ev, m, phase) { const r = rng(G); for (const [dx, dy] of shuffle([...DIRS], r)) if (tryMove(G, ev, m, dx, dy, phase)) return; }
function wander(G, ev, m, phase) {
  const r = rng(G);
  if (!m.goal || (m.x === m.goal[0] && m.y === m.goal[1]) || r() < 0.02) { const rm = G.rooms[Math.floor(r() * G.rooms.length)]; m.goal = [rm.x + Math.floor(r() * rm.w), rm.y + Math.floor(r() * rm.h)]; m.gd = null; }
  if (!m.gd || (m.gdT = (m.gdT || 0) + 1) > 20) { m.gd = distMap(G, m.goal[0], m.goal[1]); m.gdT = 0; }
  let best = null, bd = 1e9; for (const [dx, dy] of DIRS) { const nx = m.x + dx, ny = m.y + dy; if (!walk(G, nx, ny)) continue; const d = m.gd[ny * W + nx]; if (d >= 0 && d < bd) { bd = d; best = [dx, dy]; } }
  if (best && !tryMove(G, ev, m, best[0], best[1], phase) && r() < 0.5) randomStep(G, ev, m, phase);
}

// ---------- セーブ ----------

// ---------- コマンドバトル（ドラクエ風） ----------
const LETTERS = 'ABCDE';
function mkFoe(G, mid) { const d = MONS[mid]; const sc = d.boss ? 1 : 1 + Math.max(0, G.floor - d.f[1]) * 0.08; const hp = Math.round(d.hp * sc); return { id: G.uid++, mid, hp, mhp: hp, atk: d.atk, def: d.def, st: {}, cool: 0 }; }
function nameFoes(B) { const cnt = {}; for (const f of B.foes) cnt[f.mid] = (cnt[f.mid] || 0) + 1; const k = {}; for (const f of B.foes) { const n = MONS[f.mid].nm; f.nm = cnt[f.mid] > 1 && !f.nm ? n + LETTERS[k[f.mid] = (k[f.mid] ?? -1) + 1] : (f.nm || n); } }
const fName = f => f.nm || MONS[f.mid].nm;
export function encounterGroup(G) {
  const r = rng(G), n = G.floor, base = pickMonId(G, n), list = [base];
  const extra = (r() < Math.min(0.45, 0.06 + n * 0.035) ? 1 : 0) + (n >= 6 && r() < 0.22 ? 1 : 0) + (n >= 12 && r() < 0.2 ? 1 : 0);
  for (let i = 0; i < extra; i++) list.push(r() < 0.6 ? base : pickMonId(G, n));
  return list;
}
export function startBattle(G, ev, mids, opt = {}) {
  const r = rng(G);
  const B = { foes: mids.map(m => mkFoe(G, m)), round: 0, boss: !!opt.boss, mapId: opt.mapId ?? null, item: opt.item ?? null, xp: 0, kills: [] };
  nameFoes(B); G.battle = B;
  ev.push({ t: 'bstart', foes: B.foes.map(f => ({ id: f.id, mid: f.mid })), boss: B.boss });
  if (opt.text) msg(G, ev, opt.text);
  const groups = {}; for (const f of B.foes) groups[MONS[f.mid].nm] = (groups[MONS[f.mid].nm] || 0) + 1;
  for (const [nm, c] of Object.entries(groups)) msg(G, ev, c > 1 ? `${nm}が ${c}ひき あらわれた！` : `${nm}が あらわれた！`);
  if (!B.boss && !opt.ambush) { const x = r(); if (x < 0.08) { B.pre = 'p'; msg(G, ev, 'しかし 魔物たちは まだ こちらに 気づいていない！'); } else if (x < 0.16) { B.pre = 'e'; msg(G, ev, '魔物たちは いきなり おそいかかってきた！'); foesTurn(G, ev); endRound(G, ev); } }
  if (opt.ambush) { msg(G, ev, '魔物たちは いきなり おそいかかってきた！'); foesTurn(G, ev); endRound(G, ev); }
  G.encT = 0; G.encSafe = 0;
}
const alive = G => G.battle.foes.filter(f => f.hp > 0);
function foesTurn(G, ev) { for (const f of alive(G)) { if (!G.battle || G.over) break; foeAct(G, ev, f); } }
function battleAct(G, a) {
  const ev = [], p = G.p, B = G.battle, r = rng(G);
  if (!['fight', 'guard', 'run', 'use', 'throw'].includes(a.k)) return ev;
  if (a.k === 'use' || a.k === 'throw') { const it = p.inv.find(i => i.uid === a.uid); if (!it) return ev; }
  B.round++; B.guard = false;
  const pFirst = B.pre === 'p' ? true : r() < (p.st.slowP ? 0.2 : 0.8);
  const order = []; for (const f of alive(G)) { const sp = MONS[f.mid].sp >= 2 ? 0.55 : 0.25; order.push({ f, first: !pFirst || r() < sp * 0.4 }); }
  const pre = B.pre; B.pre = null;
  // ぼうぎょは先に
  if (a.k === 'guard') { B.guard = true; msg(G, ev, 'あなたは 身を守っている。'); }
  if (pre !== 'p') for (const o of order) if (o.first && G.battle && !G.over && o.f.hp > 0) foeAct(G, ev, o.f);
  if (G.over || !G.battle) return fin(G, ev);
  if (a.k !== 'guard') playerTurn(G, ev, a);
  if (G.over || !G.battle) return fin(G, ev);
  if (pre !== 'p') for (const o of order) if (!o.first && G.battle && !G.over && o.f.hp > 0) foeAct(G, ev, o.f);
  if (G.battle && !G.over) endRound(G, ev);
  return fin(G, ev);
}
function fin(G, ev) { syncR(G); return ev; }
function endRound(G, ev) {
  const p = G.p; G.turn++; G.stats.turns++;
  p.bellyT++; if (p.bellyT >= (ringEff(G) === 'belly' ? 20 : 10)) { p.bellyT = 0; if (p.belly > 0) p.belly--; }
  if (p.belly <= 0) hurtP(G, ev, 1, '空腹');
  for (const k of Object.keys(p.st)) if (p.st[k] > 0) p.st[k]--;
  if (G.battle) for (const f of G.battle.foes) for (const s of Object.keys(f.st)) if (f.st[s] > 0 && s !== 'seal') f.st[s]--;
}
function playerTurn(G, ev, a) {
  const p = G.p, B = G.battle, r = rng(G);
  if (p.st.sleep > 0) { msg(G, ev, 'あなたは ねむっている…'); return; }
  if (p.st.confuse > 0 && r() < 0.5) { msg(G, ev, 'あなたは こんらんしている！'); const t = alive(G)[0]; if (r() < 0.5 && t) { msg(G, ev, 'あなたの こうげき！ しかし あらぬ方向に 剣をふった。'); } else { const d = Math.max(1, Math.floor(pAtk(G) / 4)); msg(G, ev, `自分を 攻撃してしまった！ ${d}のダメージ`); hurtP(G, ev, d, '混乱'); } return; }
  if (a.k === 'run') {
    if (B.boss) { msg(G, ev, 'あなたは 逃げだした！'); msg(G, ev, 'しかし 逃げられない！'); return; }
    const ch = Math.max(0.25, Math.min(0.9, 0.6 + (p.lv - G.floor * 0.6) * 0.04 + (B.round === 1 ? 0.05 : 0)));
    msg(G, ev, 'あなたは 逃げだした！');
    if (r() < ch) { endBattle(G, ev, 'run'); return; }
    msg(G, ev, 'しかし まわりこまれてしまった！'); return;
  }
  if (a.k === 'fight') {
    let t = B.foes.find(f => f.id === a.tid && f.hp > 0) || alive(G)[0]; if (!t) return;
    msg(G, ev, 'あなたの こうげき！');
    ev.push({ t: 'patk', tid: t.id });
    const D = MONS[t.mid];
    if (D.ab === 'phase' && !t.st.seal && r() < 0.3) { msg(G, ev, `${fName(t)}は ひらりと 身をかわした！`); ev.push({ t: 'bmiss', id: t.id }); return; }
    if (r() < 0.05) { msg(G, ev, `ミス！ ${fName(t)}に ダメージを あたえられない！`); ev.push({ t: 'bmiss', id: t.id }); return; }
    let d, crit = r() < 0.045;
    if (crit) { d = Math.round(pAtk(G) * (1.4 + r() * 0.3)); msg(G, ev, 'かいしんの いちげき！！'); }
    else d = dmgCalc(G, pAtk(G), t.def + (t.st.guard ? 4 : 0));
    hitFoe(G, ev, t, d, crit);
    return;
  }
  if (a.k === 'use') return bUse(G, ev, a);
  if (a.k === 'throw') return bThrow(G, ev, a);
}
function hitFoe(G, ev, t, d, crit) {
  t.hp -= d; ev.push({ t: 'bhit', id: t.id, dmg: d, crit: !!crit }); msg(G, ev, `${fName(t)}に ${d}の ダメージ！`);
  if (t.st.sleep > 0 && rng(G)() < 0.5) t.st.sleep = 0;
  if (t.hp <= 0) foeDie(G, ev, t);
}
function foeDie(G, ev, t) {
  const B = G.battle; t.hp = 0; ev.push({ t: 'bdie', id: t.id });
  msg(G, ev, MONS[t.mid].boss ? `${fName(t)}を たおした！` : `${fName(t)}を やっつけた！`);
  B.xp += MONS[t.mid].xp; B.kills.push(t.mid);
  G.p.kills++; G.stats.kills++; const kb = (G.stats.killsBy ||= {}); kb[t.mid] = (kb[t.mid] || 0) + 1;
  if (!alive(G).length) endBattle(G, ev, 'win');
}
function endBattle(G, ev, how) {
  const B = G.battle, r = rng(G); G.battle = null; G.encSafe = 8;
  if (how === 'win') {
    msg(G, ev, '魔物たちを やっつけた！');
    if (B.xp) { msg(G, ev, `経験値 ${B.xp}ポイント かくとく`); gainXp(G, ev, B.xp); }
    ev.push({ t: 'bend', how });
    // おとしもの
    for (const mid of B.kills) { const D = MONS[mid]; if (D.boss) continue; if (r() < 0.14) { const it = rollItem(G, G.floor); const real = it.mimic ? it.it : it; msg(G, ev, `魔物は ${itemName(G, real)}を 落としていった！`); dropAt(G, ev, real, G.p.x, G.p.y); } }
    if (B.mapId != null) { const m = G.mons.find(x => x.id === B.mapId); if (m) { G.mons = G.mons.filter(x => x !== m); ev.push({ t: 'die', id: m.id }); bossDown(G, ev, m); } }
    if (B.item) { const fi = G.items.find(i => i.it.uid === B.item); if (fi) fi.mimic = false; }
  } else if (how === 'run') { msg(G, ev, 'うまく 逃げきれた！'); ev.push({ t: 'bend', how }); if (B.item) { const fi = G.items.find(i => i.it.uid === B.item); if (fi) fi.mimic = true; } }
  else ev.push({ t: 'bend', how });
}
function bossDown(G, ev, m) {
  const it = mkItem(G, G.floor >= FLOORS ? 'holy' : 'katana', G.floor); it.plus = Math.max(1, it.plus || 0); it.cursed = false;
  dropAt(G, ev, it, m.x, m.y);
  if (G.floor >= FLOORS) { G.over = true; G.win = true; G.extracted = true; msg(G, ev, '奈落の主を たおした！ 光が 差しこむ…'); ev.push({ t: 'win' }); }
  else { const b = G.rooms[1]; G.stairs = { x: b.x + b.w - 3, y: b.y + Math.floor(b.h / 2) }; msg(G, ev, '奥に 下り階段と 帰還の魔法陣が あらわれた'); ev.push({ t: 'stairsAppear', x: G.stairs.x, y: G.stairs.y }); G.exit = { x: G.stairs.x - 2, y: G.stairs.y }; ev.push({ t: 'exitAppear', x: G.exit.x, y: G.exit.y }); }
}
function foeAct(G, ev, f) {
  const p = G.p, D = MONS[f.mid], r = rng(G), sealed = f.st.seal, nm = fName(f);
  if (f.st.sleep > 0) { msg(G, ev, `${nm}は ねむっている。`); return; }
  if (f.st.slow > 0 && (f.tick = (f.tick || 0) + 1) % 2) { msg(G, ev, `${nm}は 動きが にぶい…`); return; }
  if (f.st.confuse > 0 && r() < 0.5) { msg(G, ev, `${nm}は こんらんしている！`); return; }
  f.cool++;
  ev.push({ t: 'bact', id: f.id });
  if (D.ab === 'erratic' && !sealed && r() < 0.25) { msg(G, ev, `${nm}は ようすを うかがっている。`); return; }
  if (D.ab === 'summon' && !sealed && f.cool % 4 === 0 && alive(G).length < 4) { msg(G, ev, `${nm}は なかまを よんだ！`); const s = mkFoe(G, 'skeleton'); G.battle.foes.push(s); s.nm = null; nameFoes(G.battle); ev.push({ t: 'bspawn', id: s.id, mid: s.mid }); msg(G, ev, `${MONS.skeleton.nm}が あらわれた！`); return; }
  if (D.ab === 'breath' && !sealed && f.cool % 3 === 0) { msg(G, ev, `${nm}は 闇の炎を はいた！`); ev.push({ t: 'bfx', k: 'breath' }); const d = Math.max(8, 34 + Math.floor(r() * 8) - Math.floor(pDef(G) * 0.6)); pHit(G, ev, d, D.nm); return; }
  if (D.ab === 'fire' && !sealed && r() < 0.4) { msg(G, ev, `${nm}は 火の玉を はなった！`); ev.push({ t: 'bfx', k: 'fire' }); pHit(G, ev, Math.max(2, 6 + Math.floor(G.floor / 2) - Math.floor(pDef(G) / 3)), D.nm); return; }
  if (D.ab === 'curse' && !sealed && r() < 0.25) { ev.push({ t: 'bfx', k: 'curse' }); if (r() < 0.5) { p.st.confuse = 3; msg(G, ev, `${nm}は あやしい 呪文を となえた！ あなたは こんらんした！`); } else { const eqs = Object.values(p.eq).filter(Boolean); const it = p.inv.find(i => i.uid === eqs[Math.floor(r() * eqs.length)]); if (it) { it.cursed = true; it.known = true; msg(G, ev, `${nm}は 呪いを かけた！ ${ITEMS[it.id].nm}が 呪われた！`); } else msg(G, ev, `${nm}は 呪文を となえた。しかし 何も おこらなかった`); } return; }
  msg(G, ev, `${nm}の こうげき！`);
  if (r() < 0.08) { msg(G, ev, 'しかし あなたは すばやく 身をかわした！'); ev.push({ t: 'pmiss' }); return; }
  let d;
  if (r() < 0.03) { msg(G, ev, 'つうこんの いちげき！'); d = Math.round((f.atk + Math.floor(G.floor / 3)) * 1.6); }
  else d = dmgCalc(G, f.atk + Math.floor(G.floor / 3), pDef(G));
  pHit(G, ev, d, D.nm);
  if (D.ab === 'poison' && !sealed && r() < 0.3 && !G.over) { p.str--; msg(G, ev, '毒で 力が 下がった…'); }
}
function pHit(G, ev, d, cause) {
  if (G.battle && G.battle.guard) d = Math.max(1, Math.floor(d / 2));
  msg(G, ev, `あなたは ${d}の ダメージを うけた！`); hurtP(G, ev, d, cause);
  if (G.over) { G.battle = null; }
}
function pickTarget(G, tid) { return G.battle.foes.find(f => f.id === tid && f.hp > 0) || alive(G)[0]; }
function bUse(G, ev, a) {
  const p = G.p, it = p.inv.find(i => i.uid === a.uid), d = ITEMS[it.id], r = rng(G);
  if (d.k === 'treasure') { msg(G, ev, `${d.nm}を ながめた。きれいだ…`); return; }
  if (d.k === 'throw') return bThrow(G, ev, a);
  if (d.k === 'scroll' && ['s_thunder', 's_sleep', 's_fear', 's_teleport'].includes(it.id)) {
    removeInv(G, it); G.known[it.id] = true; ev.push({ t: 'read', id: it.id }); msg(G, ev, `あなたは ${d.nm}を 読んだ！`);
    if (it.id === 's_thunder') { ev.push({ t: 'bfx', k: 'thunder' }); msg(G, ev, 'いかずちが 魔物たちを おそう！'); for (const f of alive(G)) { if (!G.battle) break; hitFoe(G, ev, f, 25 + Math.floor(G.floor)); } }
    if (it.id === 's_sleep') { for (const f of alive(G)) f.st.sleep = 3 + Math.floor(r() * 2); msg(G, ev, '魔物たちを ねむらせた！'); }
    if (it.id === 's_fear') { msg(G, ev, '魔物たちは おびえて 逃げだした！'); endBattle(G, ev, 'flee'); }
    if (it.id === 's_teleport') { msg(G, ev, 'あなたの 体は 光につつまれ 消えた！'); endBattle(G, ev, 'flee'); teleport(G, ev); }
    return;
  }
  if (d.k === 'wand') {
    if (it.ch <= 0) { msg(G, ev, `${itemName(G, it)}を ふった。しかし 何も おこらない`); return; }
    it.ch--; G.known[it.id] = true; const t = pickTarget(G, a.tid); if (!t) return; const nm = fName(t);
    msg(G, ev, `あなたは ${d.nm}を ふった！`); ev.push({ t: 'bfx', k: 'wand', id: t.id });
    if (it.id === 'w_blow') { msg(G, ev, `${nm}は はるか かなたへ ふきとんだ！`); t.hp = 0; ev.push({ t: 'bdie', id: t.id, blown: true }); if (!alive(G).length) endBattle(G, ev, 'flee'); }
    if (it.id === 'w_slow') { t.st.slow = 99; msg(G, ev, `${nm}の 動きが おそくなった！`); }
    if (it.id === 'w_bolt') { msg(G, ev, `雷撃が ${nm}を つらぬく！`); hitFoe(G, ev, t, 22 + G.floor * 2); }
    if (it.id === 'w_swap') { t.st.confuse = 4; msg(G, ev, `${nm}は こんらんした！`); }
    if (it.id === 'w_seal') { t.st.seal = 1; msg(G, ev, `${nm}の 特技を ふうじた！`); }
    return;
  }
  // それ以外はふつうに使う（薬・食べ物・装備・ほかの巻物）
  if (it.id === 's_escape') { removeInv(G, it); G.known[it.id] = true; msg(G, ev, `あなたは ${d.nm}を 読んだ！ 光に つつまれる…`); G.battle = null; extract(G, ev, d.nm); ev.push({ t: 'bend', how: 'escape' }); return; }
  useItem(G, ev, a.uid, a.target);
  if (G.over) G.battle = null;
}
function bThrow(G, ev, a) {
  const p = G.p, it = p.inv.find(i => i.uid === a.uid), d = ITEMS[it.id], r = rng(G);
  if (Object.values(p.eq).includes(it.uid) && it.cursed) { msg(G, ev, '呪われていて 手放せない！'); return; }
  const t = pickTarget(G, a.tid); if (!t) return; const nm = fName(t);
  if (d.k === 'throw' && it.n > 1) it.n--; else removeInv(G, it);
  msg(G, ev, `あなたは ${itemName(G, it, false)}を なげつけた！`); ev.push({ t: 'bfx', k: 'throw', id: t.id });
  if (r() < 0.1) { msg(G, ev, `しかし ${nm}には 当たらなかった`); ev.push({ t: 'bmiss', id: t.id }); return; }
  if (d.k === 'throw') hitFoe(G, ev, t, it.id === 'holywater' ? (UNDEAD.has(t.mid) ? d.v * 2 : 6) : d.v + Math.floor(G.floor / 2));
  else if (d.k === 'potion') { G.known[it.id] = true; msg(G, ev, `${d.nm}が ${nm}に かかった！`); if (it.id === 'p_heal' || it.id === 'p_bigheal') { if (UNDEAD.has(t.mid)) hitFoe(G, ev, t, 40); else { t.hp = Math.min(t.mhp, t.hp + 40); msg(G, ev, `${nm}の キズが 回復した！`); } } else if (it.id === 'p_confuse') { t.st.confuse = 4; msg(G, ev, `${nm}は こんらんした！`); } else if (it.id === 'p_poison') hitFoe(G, ev, t, 12); else hitFoe(G, ev, t, 2); }
  else hitFoe(G, ev, t, 2);
}

export function serialize(G) { syncR(G); const o = Object.assign({}, G); delete o._r; o.t = Array.from(G.t).join(''); o.rid = Array.from(G.rid); o.seen = Array.from(G.seen).join(''); o.mons = G.mons.map(m => { const c = Object.assign({}, m); delete c.gd; return c; }); return JSON.stringify(o); }
export function deserialize(s) { const o = JSON.parse(s); o.t = Uint8Array.from(o.t.split('').map(Number)); o.rid = Int16Array.from(o.rid); o.seen = Uint8Array.from(o.seen.split('').map(Number)); o._r = null; return o; }
export const score = G => G.stats.maxFloor * 1000 + G.p.lv * 10 + G.stats.kills;
