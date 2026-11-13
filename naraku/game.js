// 奈落の迷宮 — 画面・操作
import * as THREE from '../upa/vendor/three.module.min.js';
import * as C from './core.js';
import { makeHero, makeMon, makeItem, makeStairs, makeTorch, mat, glowMat } from './models.js';
const { W, H, ITEMS, MONS, DIRS } = C;
const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search), BOT = Q.has('bot');
const SAVE = 'naraku-v1', REC = 'naraku-rec';
const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', isTouch);
const rec = Object.assign({ best: 0, runs: 0, wins: 0, kills: 0, deaths: [] }, (() => { try { return JSON.parse(localStorage.getItem(REC) || '{}'); } catch (e) { return {}; } })());
const saveRec = () => { try { localStorage.setItem(REC, JSON.stringify(rec)); } catch (e) {} };
let GQ = +(localStorage.getItem('naraku-gq') ?? (isTouch ? 1 : 2)); if (Q.has('gq')) GQ = +Q.get('gq');

// ---------- 画面 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: GQ > 0, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [0.85, 1.25, 1.6][GQ]));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = GQ === 2; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x050308); scene.fog = new THREE.FogExp2(0x07040c, 0.055);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
let zoom = isTouch ? 1.15 : 1;
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
scene.add(new THREE.HemisphereLight(0x6a5a9a, 0x181020, 0.9));
const moon = new THREE.DirectionalLight(0x8a7aff, 0.35); moon.position.set(-8, 20, 6); scene.add(moon);
const lantern = new THREE.PointLight(0xffb070, 34, 12, 1.5); scene.add(lantern);
if (GQ === 2) { lantern.castShadow = true; lantern.shadow.mapSize.set(512, 512); lantern.shadow.bias = -0.002; lantern.shadow.camera.near = 0.2; lantern.shadow.camera.far = 11; }
const torchLights = []; for (let i = 0; i < (GQ === 0 ? 2 : 4); i++) { const l = new THREE.PointLight(0xff8a3a, 0, 7, 1.8); scene.add(l); torchLights.push(l); }

// テクスチャ
function ctex(w, h, draw, rep = 1) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; }
const noise = (x, w, h, b, a) => { const id = x.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * a; d[i] = b[0] + v; d[i + 1] = b[1] + v; d[i + 2] = b[2] + v; d[i + 3] = 255; } x.putImageData(id, 0, 0); };
const floorTex = ctex(256, 256, (x, w, h) => { noise(x, w, h, [74, 68, 82], 26); x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 4; x.strokeRect(2, 2, w - 4, h - 4); x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h / 2); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.moveTo(w / 4, h / 2); x.lineTo(w / 4, h); x.stroke(); x.strokeStyle = 'rgba(0,0,0,.3)'; x.lineWidth = 1.5; for (let i = 0; i < 5; i++) { x.beginPath(); let px = Math.random() * w, py = Math.random() * h; x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (Math.random() - 0.5) * 50; py += (Math.random() - 0.5) * 50; x.lineTo(px, py); } x.stroke(); } x.fillStyle = 'rgba(60,90,50,.25)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 4 + Math.random() * 12, 0, 7); x.fill(); } });
const wallTex = ctex(256, 256, (x, w, h) => { noise(x, w, h, [62, 56, 70], 22); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 4; for (let r = 0; r < 4; r++) { const y = r * 64; x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); for (let c = 0; c < 3; c++) { const xx = c * 96 + (r % 2) * 48; x.beginPath(); x.moveTo(xx, y); x.lineTo(xx, y + 64); x.stroke(); } } x.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 30; i++) x.fillRect(Math.random() * w, Math.random() * h, 20, 3); });
const topTex = ctex(64, 64, (x, w, h) => noise(x, w, h, [26, 22, 30], 10));

// ---------- 状態 ----------
let G = null, floorObjs = null, hero = null, monObj = new Map(), itemObj = new Map(), animQ = [], anim = null, busy = false, pendingInput = null, stairsAsk = false, lastFloor = 0;
const fx = [];

function buildFloor() {
  if (floorObjs) { scene.remove(floorObjs.root); floorObjs.root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); }
  for (const [, o] of monObj) scene.remove(o.g); monObj.clear(); for (const [, o] of itemObj) scene.remove(o); itemObj.clear();
  const root = new THREE.Group(); scene.add(root);
  const fl = [], wl = []; const isWallVis = (x, y) => { if (G.t[y * W + x]) return false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < H && G.t[ny * W + nx]) return true; } return false; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (G.t[y * W + x]) fl.push([x, y]); else if (isWallVis(x, y)) wl.push([x, y]); }
  const o = new THREE.Object3D();
  const fm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 }), fl.length);
  fl.forEach(([x, y], i) => { o.position.set(x, -0.1, y); o.rotation.y = ((x * 7 + y * 13) % 4) * Math.PI / 2; o.updateMatrix(); fm.setMatrixAt(i, o.matrix); fm.setColorAt(i, new THREE.Color(0, 0, 0)); });
  fm.receiveShadow = true; root.add(fm);
  const wmMat = [new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: topTex, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0 }), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 })];
  const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.9, 1), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }), wl.length);
  wl.forEach(([x, y], i) => { o.position.set(x, 0.45, y); o.rotation.y = 0; o.updateMatrix(); wm.setMatrixAt(i, ZERO); wm.setColorAt(i, new THREE.Color(0, 0, 0)); });
  wm.castShadow = wm.receiveShadow = true; root.add(wm);
  // たいまつ（部屋のかべに）
  const torches = []; const r = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(G.floor * 99 + 7);
  for (const rm of G.rooms) { const cands = []; for (let x = rm.x; x < rm.x + rm.w; x++) { if (!G.t[(rm.y - 1) * W + x]) cands.push([x, rm.y - 1, 0, 0.45]); } for (let k = 0; k < Math.min(2, cands.length); k++) { const c = cands[Math.floor(r() * cands.length)]; const t = makeTorch(); t.position.set(c[0], 0.62, c[1] + c[3]); root.add(t); torches.push({ o: t, x: c[0], y: c[1] + 1, ph: r() * 6 }); } }
  // 階段
  let stairs = null; if (G.stairs) { stairs = makeStairs(); stairs.position.set(G.stairs.x, 0.01, G.stairs.y); root.add(stairs); }
  // 罠
  const trapM = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.3, 0.3), transparent: true, opacity: 0.8, toneMapped: false });
  const traps = G.traps.map(t => { const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.32, 6), trapM); m.rotation.x = -Math.PI / 2; m.position.set(t.x, 0.02, t.y); m.visible = false; root.add(m); return { t, m }; });
  // ほこりのつぶ
  const dn = GQ === 0 ? 80 : 220, dp = new Float32Array(dn * 3); for (let i = 0; i < dn; i++) dp.set([Math.random() * 20 - 10, Math.random() * 3, Math.random() * 20 - 10], i * 3);
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xb8a0ff, size: 0.04, transparent: true, opacity: 0.5, depthWrite: false })); root.add(dust);
  floorObjs = { root, fm, wm, fl, wl, wmOn: new Uint8Array(wl.length), torches, stairs, traps, dust };
  // 主人公
  if (!hero) { hero = big(makeHero(), 1.35); scene.add(hero); }
  hero.position.set(G.p.x, 0, G.p.y); hero.rotation.y = dirYaw(G.p.dir);
  syncEntities(true); refreshFog(); camSnap = true;
}
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0), o3 = new THREE.Object3D();
const big = (o, s = 1.3) => { const g = new THREE.Group(); o.scale.multiplyScalar(s); g.add(o); return g; };
const dirYaw = d => Math.atan2(DIRS[d][0], DIRS[d][1]);
function refreshFog() {
  const { fm, wm, fl, wl, traps, wmOn } = floorObjs; const c = new THREE.Color();
  const vis = (x, y) => C.visible(G, x, y);
  fl.forEach(([x, y], i) => { const s = G.seen[y * W + x], v = vis(x, y) && s; const corr = G.rid[y * W + x] < 0; c.setRGB(...(v ? (corr ? [0.85, 0.8, 0.9] : [1, 1, 1]) : s ? [0.22, 0.2, 0.3] : [0, 0, 0])); fm.setColorAt(i, c); });
  wl.forEach(([x, y], i) => { let s = 0, v = false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; if (G.seen[ny * W + nx] && G.t[ny * W + nx]) { s = 1; if (vis(nx, ny)) v = true; } } c.setRGB(...(v ? [1, 1, 1] : s ? [0.2, 0.18, 0.28] : [0, 0, 0])); wm.setColorAt(i, c); if (s && !wmOn[i]) { wmOn[i] = 1; o3.position.set(x, 0.45, y); o3.updateMatrix(); wm.setMatrixAt(i, o3.matrix); wm.instanceMatrix.needsUpdate = true; } });
  fm.instanceColor.needsUpdate = true; wm.instanceColor.needsUpdate = true;
  for (const t of traps) t.m.visible = t.t.known && !!G.seen[t.t.y * W + t.t.x] && G.traps.includes(t.t);
  if (floorObjs.stairs) floorObjs.stairs.visible = !!G.seen[G.stairs.y * W + G.stairs.x];
  for (const t of floorObjs.torches) t.o.visible = !!G.seen[t.y * W + t.x];
  drawMini();
}
function syncEntities(snap) {
  // 敵
  const ids = new Set(G.mons.map(m => m.id));
  for (const [id, o] of monObj) if (!ids.has(id) && !o.dying) { scene.remove(o.g); monObj.delete(id); }
  for (const m of G.mons) {
    let o = monObj.get(m.id);
    if (!o || o.disg !== !!m.disguise) { if (o) scene.remove(o.g); const g = m.disguise ? makeItem(m.disguise, G.looks[m.disguise.id]) : big(makeMon(m.mid, MONS[m.mid]), MONS[m.mid].boss ? 1.2 : 1.3); g.position.set(m.x, 0, m.y); scene.add(g); o = { g, m, disg: !!m.disguise, x: m.x, y: m.y }; monObj.set(m.id, o); }
    o.m = m; if (snap) { o.g.position.set(m.x, 0, m.y); o.x = m.x; o.y = m.y; }
    o.g.visible = (C.visible(G, m.x, m.y) && !!G.seen[m.y * W + m.x]) || (G.sightAll && true);
    if (MONS[m.mid].ab === 'phase' && !G.t[m.y * W + m.x]) o.g.visible = false;
  }
  // アイテム
  const keys = new Set(G.items.map(i => i.it.uid));
  for (const [uid, o] of itemObj) if (!keys.has(uid)) { scene.remove(o); itemObj.delete(uid); }
  for (const fi of G.items) { let o = itemObj.get(fi.it.uid); if (!o) { o = makeItem(fi.it, G.looks[fi.it.id]); o.position.set(fi.x, 0.02, fi.y); scene.add(o); itemObj.set(fi.it.uid, o); } o.position.x = fi.x; o.position.z = fi.y; o.visible = !!G.seen[fi.y * W + fi.x] && (C.visible(G, fi.x, fi.y) || G.mapRead || G.sightAll); }
}

// ---------- 行動 → 演出 ----------
function doAct(a) {
  if (!G || G.over || busy) { pendingInput = a; return; }
  if (stairsAsk) return;
  const before = { x: G.p.x, y: G.p.y, f: G.floor };
  const ev = C.act(G, a);
  if (!ev.length) return;
  // 演出の順番：連続した移動はいっしょに、攻撃は1つずつ
  const steps = []; let moves = [];
  for (const e of ev) { if (e.t === 'move' || e.t === 'turn') moves.push(e); else { if (moves.length) { steps.push({ k: 'moves', list: moves }); moves = []; } steps.push({ k: 'one', e }); } }
  if (moves.length) steps.push({ k: 'moves', list: moves });
  animQ.push(...steps); busy = true;
  afterTurn = () => { if (G.floor !== before.f) { buildFloor(); flash(0x000000, 0.6); } refreshFog(); syncEntities(false); hud(); save(); if (G.over) gameOver(); else if (G.stairs && G.p.x === G.stairs.x && G.p.y === G.stairs.y && a.k === 'move' && !BOT) askStairs(); };
}
let afterTurn = null;
const T_MOVE = 0.11, T_ATK = 0.16;
function playStep(dt) {
  if (!anim) {
    if (!animQ.length) { if (busy) { busy = false; afterTurn && afterTurn(); afterTurn = null; if (pendingInput) { const a = pendingInput; pendingInput = null; doAct(a); } } return; }
    const s = animQ.shift(); anim = { s, t: 0, dur: 0 };
    if (s.k === 'moves') {
      anim.dur = Math.max(...s.list.map(e => e.fast ? 0.18 : T_MOVE)) * (keyHeld() ? 0.75 : 1);
      anim.items = s.list.map(e => { const o = e.id === 0 ? { g: hero } : monObj.get(e.id); if (!o) return null; const g = o.g; if (e.t === 'turn') return { g, yaw: dirYaw(e.d) }; const from = g.position.clone(); const to = new THREE.Vector3(e.x, 0, e.y); const yaw = from.distanceTo(to) > 0.01 ? Math.atan2(to.x - from.x, to.z - from.z) : g.rotation.y; return { g, from, to, yaw }; }).filter(Boolean);
      // 見えない敵は一気に移動
      const anyVis = anim.items.some(i => i.g.visible); if (!anyVis) anim.dur = 0;
    } else {
      const e = s.e; anim.e = e; anim.dur = 0;
      if (e.t === 'msg') log(e.text);
      else if (e.t === 'atk') { const a = e.id === 0 ? hero : monObj.get(e.id)?.g, b = e.tid === 0 ? hero : monObj.get(e.tid)?.g; if (a && b && (a.visible || b.visible)) { anim.dur = T_ATK; anim.a = a; anim.from = a.position.clone(); anim.dir = new THREE.Vector3().subVectors(b.position, a.position).setY(0).normalize(); a.rotation.y = Math.atan2(anim.dir.x, anim.dir.z); sfx.swing(); } if (e.miss && b) popNum(b.position, 'MISS', '#aab'); }
      else if (e.t === 'hurt') { const o = e.id === 0 ? hero : monObj.get(e.id)?.g; if (o) { popNum(o.position, String(e.dmg), e.id === 0 ? '#ff5a5a' : '#fff'); sparks(o.position, e.id === 0 ? 0xff3030 : 0xffd0a0, 10); o.userData.hit = 0.2; if (e.id === 0) { shake = 0.25; flash(0x600000, 0.25); sfx.hurt(); } else sfx.hit(); } anim.dur = 0.05; }
      else if (e.t === 'die') { const o = monObj.get(e.id); if (o) { o.dying = 0.45; sparks(o.g.position, 0x9a6aff, 24); sfx.die(); } anim.dur = 0.08; }
      else if (e.t === 'pick') { sfx.pick(); }
      else if (e.t === 'lvup') { sfx.lvup(); ring(hero.position, 0xffd060); popNum(hero.position, 'LEVEL UP!', '#ffd060'); }
      else if (e.t === 'proj') { const col = e.k === 'fire' ? 0xff7a2a : e.k === 'breath' ? 0xb040ff : e.k === 'wand' ? 0x80c0ff : 0xe0e0e0; anim.proj = projectile(e.fx, e.fy, e.x, e.y, col, e.k === 'breath' ? 0.5 : 0.15); anim.dur = 0.18 + Math.hypot(e.x - e.fx, e.y - e.fy) * 0.03; sfx.zap(); }
      else if (e.t === 'fx') { if (e.k === 'thunder') { flash(0xc0d0ff, 0.5); sfx.thunder(); shake = 0.4; } else flash(0x4040a0, 0.4); anim.dur = 0.25; }
      else if (e.t === 'trap') { sfx.trap(); sparks(hero.position, 0xff3030, 14); anim.dur = 0.2; }
      else if (e.t === 'floor') { sfx.stairs(); }
      else if (e.t === 'warp') { hero.position.set(e.x, 0, e.y); camSnap = true; flash(0x8040ff, 0.4); }
      else if (e.t === 'reveal' || e.t === 'spawn') { syncEntities(true); refreshFog(); anim.dur = 0.1; }
      else if (e.t === 'stairsAppear') { floorObjs.stairs = makeStairs(); floorObjs.stairs.position.set(e.x, 0.01, e.y); floorObjs.root.add(floorObjs.stairs); sfx.lvup(); }
      else if (e.t === 'drink' || e.t === 'read' || e.t === 'eat') { sfx.use(); ring(hero.position, e.t === 'read' ? 0xb0a0ff : 0x60ff90); anim.dur = 0.15; }
      else if (e.t === 'cast') { const o = monObj.get(e.id); if (o) ring(o.g.position, 0xff40c0); sfx.zap(); anim.dur = 0.2; }
      else if (e.t === 'win') { anim.dur = 0.5; }
      else if (e.t === 'onStairs') {}
    }
  }
  anim.t += dt; const k = anim.dur ? Math.min(1, anim.t / anim.dur) : 1;
  if (anim.s.k === 'moves') for (const it of anim.items) { if (it.to) { it.g.position.lerpVectors(it.from, it.to, k); it.g.position.y = Math.sin(k * Math.PI) * 0.06; } it.g.rotation.y = lerpAng(it.g.rotation.y, it.yaw, Math.min(1, k * 2)); }
  else if (anim.a) { const s = Math.sin(k * Math.PI) * 0.35; anim.a.position.copy(anim.from).addScaledVector(anim.dir, s); }
  if (anim.proj) { const p = anim.proj; p.m.position.lerpVectors(p.a, p.b, k); }
  if (k >= 1) { if (anim.proj) scene.remove(anim.proj.m); if (anim.a) anim.a.position.copy(anim.from); anim = null; }
}
const lerpAng = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };
function projectile(fx0, fy0, x, y, col, r) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2.5), toneMapped: false })); scene.add(m); return { m, a: new THREE.Vector3(fx0, 0.7, fy0), b: new THREE.Vector3(x, 0.7, y) }; }

// パーティクルと数字
const PN = 400, pp = new Float32Array(PN * 3), pv = new Float32Array(PN * 3), pl = new Float32Array(PN), pc = new Float32Array(PN * 3); let pi = 0;
const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pgeo.setAttribute('color', new THREE.BufferAttribute(pc, 3));
const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); pts.frustumCulled = false; scene.add(pts); for (let i = 0; i < PN; i++) pp[i * 3 + 1] = -99;
function sparks(pos, col, n) { const c = new THREE.Color(col); for (let k = 0; k < n; k++) { const i = pi = (pi + 1) % PN; pp.set([pos.x, 0.6, pos.z], i * 3); pv.set([(Math.random() - 0.5) * 3, Math.random() * 3, (Math.random() - 0.5) * 3], i * 3); pc.set([c.r * 1.5, c.g * 1.5, c.b * 1.5], i * 3); pl[i] = 0.4 + Math.random() * 0.4; } }
function ring(pos, col) { const m = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(2), transparent: true, toneMapped: false, side: THREE.DoubleSide, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.05, pos.z); scene.add(m); fx.push({ m, t: 0, dur: 0.6, k: 'ring' }); }
function popNum(pos, txt, col) { const el = document.createElement('div'); el.className = 'num'; el.textContent = txt; el.style.color = col; $('nums').appendChild(el); fx.push({ el, pos: pos.clone().setY(1.3), t: 0, dur: 0.9, k: 'num' }); }
let flashEl = $('flash');
function flash(col, a) { flashEl.style.transition = 'none'; flashEl.style.background = '#' + new THREE.Color(col).getHexString(); flashEl.style.opacity = a; requestAnimationFrame(() => { flashEl.style.transition = 'opacity .4s'; flashEl.style.opacity = 0; }); }

// ---------- 音 ----------
let AC = null; const ac = () => { if (!AC) try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} if (AC && AC.state === 'suspended') AC.resume(); return AC; };
let muted = localStorage.getItem('naraku-mute') === '1';
function tone(f0, f1, d, type = 'square', v = 0.08, delay = 0) { if (muted) return; const a = ac(); if (!a) return; const t = a.currentTime + delay, o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + d); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0005, t + d); o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + 0.02); }
function nz(d, v = 0.15, f = 800) { if (muted) return; const a = ac(); if (!a) return; const b = a.createBuffer(1, a.sampleRate * d, a.sampleRate), ch = b.getChannelData(0); for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length); const s = a.createBufferSource(); s.buffer = b; const fl = a.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; const g = a.createGain(); g.gain.value = v; s.connect(fl).connect(g).connect(a.destination); s.start(); }
const sfx = { swing: () => nz(0.08, 0.12, 2400), hit: () => { tone(220, 90, 0.1, 'square', 0.07); nz(0.06, 0.15, 900); }, hurt: () => { tone(160, 60, 0.2, 'sawtooth', 0.09); }, die: () => tone(300, 40, 0.4, 'triangle', 0.1), pick: () => tone(880, 1320, 0.08, 'triangle', 0.07), lvup: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.15, 'triangle', 0.08, i * 0.08)), zap: () => tone(1200, 300, 0.2, 'sawtooth', 0.05), thunder: () => { nz(0.7, 0.4, 300); }, trap: () => tone(200, 100, 0.3, 'square', 0.08), stairs: () => [392, 330, 262, 196].forEach((f, i) => tone(f, f, 0.15, 'triangle', 0.08, i * 0.1)), use: () => tone(600, 900, 0.15, 'sine', 0.08), step: () => nz(0.03, 0.04, 300) };

// ---------- カメラ・ループ ----------
let camSnap = true, shake = 0, tAll = 0;
const camT = new THREE.Vector3();
function updateCam(dt) {
  const tgt = hero.position; const h = 10 * zoom, back = 4.6 * zoom;
  camT.set(tgt.x, 0, tgt.z);
  const want = new THREE.Vector3(tgt.x, h, tgt.z + back);
  if (camSnap) { camera.position.copy(want); camSnap = false; } else camera.position.lerp(want, Math.min(1, dt * 8));
  if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake * 0.6; camera.position.z += (Math.random() - 0.5) * shake * 0.6; }
  camera.lookAt(camera.position.x, 0, camera.position.z - back);
  lantern.position.set(hero.position.x, 1.6, hero.position.z + 0.2);
}
function frame(dt) {
  tAll += dt;
  if (G && hero) {
    playStep(dt);
    // 敵の待機アニメ
    for (const [id, o] of monObj) {
      const g = o.g;
      if (o.dying != null) { o.dying -= dt; g.scale.setScalar(Math.max(0.01, o.dying / 0.45)); g.position.y -= dt * 0.8; if (o.dying <= 0) { scene.remove(g); monObj.delete(id); } continue; }
      const b = g.getObjectByName('bob'); if (b) b.position.y = (b.userData.y0 ??= b.position.y) + Math.sin(tAll * 3 + id) * 0.05;
      for (const s of [-1, 1]) { const w = g.getObjectByName('wing' + s); if (w) w.rotation.z = (w.userData.z0 ??= w.rotation.z) + Math.sin(tAll * 14 + id) * 0.4 * s; }
      if (g.userData.hit > 0) { g.userData.hit -= dt; g.scale.setScalar(1 + g.userData.hit * 0.8); } else if (g.scale.x !== 1) g.scale.setScalar(1);
    }
    if (hero.userData.hit > 0) { hero.userData.hit -= dt; hero.scale.setScalar(1 + hero.userData.hit * 0.6); } else hero.scale.setScalar(1);
    const cape = hero.getObjectByName('cape'); if (cape) cape.rotation.x = 0.15 + Math.sin(tAll * 2) * 0.05 + (busy ? 0.2 : 0);
    for (const [, o] of itemObj) { o.rotation.y += dt * 0.8; o.position.y = 0.04 + Math.sin(tAll * 2 + o.position.x) * 0.03; }
    if (floorObjs) {
      if (floorObjs.stairs) { const r = floorObjs.stairs.getObjectByName('ring'); if (r) r.material.opacity = 0.6 + Math.sin(tAll * 3) * 0.3; }
      // たいまつ：近い4つだけ光らせる
      const near = floorObjs.torches.filter(t => t.o.visible).sort((a, b) => (a.x - hero.position.x) ** 2 + (a.y - hero.position.z) ** 2 - ((b.x - hero.position.x) ** 2 + (b.y - hero.position.z) ** 2));
      torchLights.forEach((l, i) => { const t = near[i]; if (t && (t.x - hero.position.x) ** 2 + (t.y - hero.position.z) ** 2 < 200) { l.position.set(t.x, 1.3, t.y - 0.1); l.intensity = 9 + Math.sin(tAll * 9 + t.ph) * 2 + Math.sin(tAll * 23 + t.ph) * 1; } else l.intensity = 0; });
      for (const t of floorObjs.torches) { const f = t.o.getObjectByName('flame'); if (f) f.scale.set(1, 0.85 + Math.sin(tAll * 12 + t.ph) * 0.2, 1); }
      const dp = floorObjs.dust.geometry.attributes.position; for (let i = 0; i < dp.count; i++) { let y = dp.getY(i) + dt * 0.1; if (y > 3) y = 0; dp.setY(i, y); } dp.needsUpdate = true; floorObjs.dust.position.set(hero.position.x, 0, hero.position.z);
    }
    lantern.intensity = 32 + Math.sin(tAll * 7) * 1.5 + Math.sin(tAll * 17) * 0.8;
    updateCam(dt);
  }
  for (let i = 0; i < PN; i++) { if (pl[i] <= 0) continue; pl[i] -= dt; pv[i * 3 + 1] -= 6 * dt; pp[i * 3] += pv[i * 3] * dt; pp[i * 3 + 1] += pv[i * 3 + 1] * dt; pp[i * 3 + 2] += pv[i * 3 + 2] * dt; if (pl[i] <= 0) pp[i * 3 + 1] = -99; }
  pgeo.attributes.position.needsUpdate = true;
  for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.t += dt; const k = f.t / f.dur; if (f.k === 'ring') { f.m.scale.setScalar(1 + k * 3); f.m.material.opacity = 1 - k; } if (f.k === 'num') { const p = f.pos.clone(); p.y += k * 0.8; p.project(camera); f.el.style.transform = `translate(${(p.x * 0.5 + 0.5) * innerWidth}px, ${(-p.y * 0.5 + 0.5) * innerHeight}px) translate(-50%,-50%) scale(${k < 0.15 ? k / 0.15 * 1.2 : 1})`; f.el.style.opacity = k > 0.7 ? (1 - k) / 0.3 : 1; } if (k >= 1) { if (f.m) scene.remove(f.m); if (f.el) f.el.remove(); fx.splice(i, 1); } }
  renderer.render(scene, camera);
  // 長押しで連続
  if (G && !busy && !anim && heldDir() != null && !stairsAsk && modalClosed()) { const d = heldDir(); repT += dt; if (repT > 0) { repT = 0; if (turnOnly()) doAct({ k: 'turn', d }); else doAct({ k: 'move', d }); } }
  if (BOT && G && !busy && !G.over) botStep();
}
let repT = 0;
let last = performance.now();
function loop(now) { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now; frame(dt); }

// ---------- 入力 ----------
const keys = {};
const KEYMAP = { ArrowUp: 0, KeyW: 0, Numpad8: 0, KeyE: 1, Numpad9: 1, ArrowRight: 2, KeyD: 2, Numpad6: 2, KeyC: 3, Numpad3: 3, ArrowDown: 4, KeyS: 4, KeyX: 4, Numpad2: 4, KeyZ: 5, Numpad1: 5, ArrowLeft: 6, KeyA: 6, Numpad4: 6, KeyQ: 7, Numpad7: 7 };
let padDir = null;
const heldDir = () => { if (padDir != null) return padDir; const ks = Object.keys(keys).filter(k => keys[k] && k in KEYMAP); if (!ks.length) return null; // 矢印2つで斜め
  const v = [0, 0]; for (const k of ks) { const [dx, dy] = DIRS[KEYMAP[k]]; v[0] += dx; v[1] += dy; } v[0] = Math.sign(v[0]); v[1] = Math.sign(v[1]); if (!v[0] && !v[1]) return null; return DIRS.findIndex(([a, b]) => a === v[0] && b === v[1]); };
const turnOnly = () => !!(keys.ShiftLeft || keys.ShiftRight) || $('bTurn').classList.contains('on');
const keyHeld = () => heldDir() != null;
const modalClosed = () => $('inv').hidden && $('menu').hidden && $('title').hidden && $('over').hidden && $('help').hidden;
addEventListener('keydown', e => {
  ac();
  if (!$('title').hidden || !$('over').hidden) return;
  if (stairsAsk) { if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyY') { e.preventDefault(); $('sYes').click(); } if (e.code === 'Escape' || e.code === 'KeyN') $('sNo').click(); return; }
  if (!$('inv').hidden) { invKey(e); return; }
  if (!$('menu').hidden || !$('help').hidden) { if (e.code === 'Escape') closeModals(); return; }
  if (e.code in KEYMAP) { e.preventDefault(); keys[e.code] = true; if (!e.repeat) { const d = heldDir(); if (d != null) { doAct(turnOnly() ? { k: 'turn', d } : { k: 'move', d }); repT = -0.22; } } return; }
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (G.stairs && G.p.x === G.stairs.x && G.p.y === G.stairs.y && e.code === 'Enter') askStairs(); else doAct({ k: 'attack' }); }
  if (e.code === 'KeyR' || e.code === 'Numpad5' || e.code === 'Period') doAct({ k: 'wait' });
  if (e.code === 'KeyF' || e.code === 'KeyG') footMenu();
  if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); openInv(); }
  if (e.code === 'Escape') openMenu();
  if (e.code === 'Equal' || e.code === 'NumpadAdd') zoom = Math.max(0.7, zoom - 0.1); if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoom = Math.min(1.8, zoom + 0.1);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; padDir = null; });
canvas.addEventListener('wheel', e => { zoom = Math.max(0.7, Math.min(1.8, zoom * (1 + Math.sign(e.deltaY) * 0.08))); e.preventDefault(); }, { passive: false });
// 十字キー
document.querySelectorAll('#pad button').forEach(b => {
  const d = b.dataset.d; const down = e => { e.preventDefault(); ac(); try { b.setPointerCapture(e.pointerId); } catch (er) {} if (d === 'c') { footMenu(); return; } padDir = +d; b.classList.add('on'); doAct(turnOnly() ? { k: 'turn', d: +d } : { k: 'move', d: +d }); repT = -0.22; };
  const up = () => { if (d !== 'c' && padDir === +d) padDir = null; b.classList.remove('on'); };
  b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up); b.addEventListener('contextmenu', e => e.preventDefault());
});
$('bAtk').onclick = () => { ac(); doAct({ k: 'attack' }); };
$('bInv').onclick = () => openInv();
$('bWait').onclick = () => doAct({ k: 'wait' });
$('bTurn').onclick = () => $('bTurn').classList.toggle('on');
$('bMenu').onclick = () => openMenu();

// ---------- HUD・ログ・ミニマップ ----------
function hud() {
  const p = G.p;
  $('hFloor').textContent = `B${G.floor}F`; $('hLv').textContent = `Lv${p.lv}`;
  $('hHp').textContent = `${p.hp}/${p.mhp}`; $('hpBar').style.width = (p.hp / p.mhp * 100) + '%'; $('hpBar').className = p.hp < p.mhp * 0.25 ? 'low' : '';
  $('hBelly').textContent = `${p.belly}%`; $('hBelly').parentElement.classList.toggle('low', p.belly <= 20);
  $('hAtk').textContent = C.pAtk(G); $('hDef').textContent = C.pDef(G);
  const st = []; if (p.st.confuse > 0) st.push('混乱'); if (p.st.sleep > 0) st.push('睡眠'); if (p.str < 0) st.push(`毒${p.str}`); if (p.str > 0) st.push(`力+${p.str}`); $('hSt').textContent = st.join(' ');
  $('xpBar').style.width = (p.xp / C.xpNeed(p.lv) * 100) + '%';
}
function log(t) { const el = $('log'); const d = document.createElement('div'); d.textContent = t; el.appendChild(d); while (el.children.length > 5) el.firstChild.remove(); clearTimeout(d._t); setTimeout(() => d.classList.add('old'), 4000); }
const mm = $('mini'), mx = mm.getContext('2d');
function drawMini() {
  const s = mm.width / W; mx.clearRect(0, 0, mm.width, mm.height);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!G.seen[i] || !G.t[i]) continue; mx.fillStyle = G.rid[i] >= 0 ? 'rgba(120,110,170,.65)' : 'rgba(100,90,140,.55)'; mx.fillRect(x * s, y * s, s, s); }
  for (const fi of G.items) if (G.seen[fi.y * W + fi.x] && (C.visible(G, fi.x, fi.y) || G.mapRead || G.sightAll)) { mx.fillStyle = '#7fe0ff'; mx.fillRect(fi.x * s + 1, fi.y * s + 1, s - 2, s - 2); }
  for (const t of G.traps) if (t.known) { mx.fillStyle = '#ff5050'; mx.fillRect(t.x * s + 1, t.y * s + 1, s - 2, s - 2); }
  if (G.stairs && G.seen[G.stairs.y * W + G.stairs.x]) { mx.strokeStyle = '#d8a0ff'; mx.lineWidth = 2; mx.strokeRect(G.stairs.x * s, G.stairs.y * s, s, s); }
  for (const m of G.mons) if ((C.visible(G, m.x, m.y) || G.sightAll) && !m.disguise) { mx.fillStyle = MONS[m.mid].boss ? '#ff40ff' : '#ff4a4a'; mx.beginPath(); mx.arc((m.x + 0.5) * s, (m.y + 0.5) * s, s * 0.45, 0, 7); mx.fill(); }
  mx.fillStyle = '#ffd060'; mx.beginPath(); mx.arc((G.p.x + 0.5) * s, (G.p.y + 0.5) * s, s * 0.6, 0, 7); mx.fill();
}

// ---------- 道具 ----------
let invSel = 0, invMode = null; // invMode: {k:'ident', uid}
function openInv(mode) { if (!G || G.over) return; invMode = mode || null; $('inv').hidden = false; invSel = Math.min(invSel, Math.max(0, G.p.inv.length - 1)); drawInv(); }
function closeModals() { for (const id of ['inv', 'menu', 'help']) $(id).hidden = true; invMode = null; }
const KIND_IC = { weapon: '🗡️', shield: '🛡️', ring: '💍', potion: '🧪', scroll: '📜', food: '🍞', wand: '🪄', throw: '🔪' };
function drawInv() {
  const p = G.p, inv = p.inv;
  $('invTitle').textContent = invMode ? '識別する物をえらぶ' : `持ち物 ${inv.length}/18`;
  $('invList').innerHTML = inv.map((it, i) => { const eq = Object.values(p.eq).includes(it.uid); return `<button class="ii ${i === invSel ? 'sel' : ''}" data-i="${i}"><span>${KIND_IC[it.k]}</span><b>${C.itemName(G, it)}</b>${eq ? '<em>装備</em>' : ''}</button>`; }).join('') || '<p style="opacity:.6">なにも持っていない</p>';
  $('invList').querySelectorAll('.ii').forEach(b => b.onclick = () => { invSel = +b.dataset.i; drawInv(); });
  const it = inv[invSel]; const acts = $('invActs'); acts.innerHTML = '';
  if (!it) return;
  $('invDesc').innerHTML = descOf(it);
  const add = (label, fn, cls = '') => { const b = document.createElement('button'); b.textContent = label; b.className = cls; b.onclick = fn; acts.appendChild(b); };
  if (invMode && invMode.k === 'ident') { add('これを識別', () => { const uid = invMode.uid; closeModals(); doAct({ k: 'use', uid, target: it.uid }); }, 'pri'); add('やめる', () => closeModals()); return; }
  const eq = Object.values(p.eq).includes(it.uid);
  const use = { potion: '飲む', scroll: '読む', food: '食べる', wand: '振る', throw: '投げる', weapon: eq ? '外す' : '装備', shield: eq ? '外す' : '装備', ring: eq ? '外す' : '装備' }[it.k];
  add(use, () => { closeModals(); if (it.id === 's_ident' && G.known.s_ident && p.inv.some(x => x !== it && !C.isKnown(G, x))) { openInv({ k: 'ident', uid: it.uid }); return; } doAct(it.k === 'throw' ? { k: 'throw', uid: it.uid } : { k: 'use', uid: it.uid }); }, 'pri');
  if (it.k !== 'throw') add('投げる', () => { closeModals(); doAct({ k: 'throw', uid: it.uid }); });
  add('置く', () => { closeModals(); doAct({ k: 'drop', uid: it.uid }); });
  add('とじる', () => closeModals());
}
function descOf(it) {
  const d = ITEMS[it.id], kn = C.isKnown(G, it);
  if (d.k === 'weapon') return `攻撃 ${d.v}${kn && it.plus ? `（${it.plus > 0 ? '+' : ''}${it.plus}）` : ''}${!kn ? '　装備するまで強さ（+−）はわからない' : ''}`;
  if (d.k === 'shield') return `防御 ${d.v}${kn && it.plus ? `（${it.plus > 0 ? '+' : ''}${it.plus}）` : ''}${!kn ? '　装備するまで強さ（+−）はわからない' : ''}`;
  if (d.k === 'ring') return { atk3: '攻撃 +3', def3: '防御 +3', regen: 'HPの回復が速くなる', belly: 'お腹がへりにくい', sight: 'その階の敵とアイテムが見える' }[d.eff] + (kn && it.cursed ? '（呪われている）' : '');
  if (d.k === 'food') return `お腹 +${d.v}%${d.hp ? `・HP +${d.hp}` : ''}。満腹のときに食べると最大がふえる`;
  if (d.k === 'throw') return `前に投げる。${it.id === 'holywater' ? '亡者に大ダメージ' : `ダメージ ${d.v}`}`;
  if (!kn) return '使うまで何かわからない。投げると敵にかかる';
  return { p_heal: 'HPを回復。満タンなら最大HPが少しふえる', p_bigheal: 'HPを全回復＋状態異常をなおす', p_str: '力が 1 上がる（毒も消える）', p_life: '最大HP +8', p_xp: 'レベルが 1 上がる', p_poison: '力が下がる。敵に投げるとダメージ', p_confuse: '混乱する。敵に投げると混乱させる', p_sight: 'その階の敵とアイテムが全部見える', s_map: 'その階の地図がわかる', s_thunder: 'まわりの敵に 25 ダメージ', s_sleep: 'まわりの敵を眠らせる', s_weapon: '武器 +1（呪いも解ける）', s_shield: '盾 +1（呪いも解ける）', s_ident: '持ち物を1つ識別する', s_teleport: 'どこかへワープ', s_purify: '呪いを解く', s_fear: 'まわりの敵が逃げだす', w_blow: '向いている方の敵をふきとばす', w_slow: '敵をおそくする', w_bolt: '雷で大ダメージ', w_swap: '敵と場所を入れ替える', w_seal: '敵の特技を封じる' }[it.id] || '';
}
function invKey(e) {
  const n = G.p.inv.length; if (e.code === 'Escape' || e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); closeModals(); return; }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { invSel = (invSel + 1) % Math.max(1, n); drawInv(); e.preventDefault(); }
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { invSel = (invSel - 1 + n) % Math.max(1, n); drawInv(); e.preventDefault(); }
  if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); $('invActs').firstChild?.click(); }
  if (e.code === 'KeyT') $('invActs').querySelector('button:nth-child(2)')?.click();
}
function footMenu() {
  if (!G || busy) return;
  const fi = G.items.find(i => i.x === G.p.x && i.y === G.p.y);
  if (G.stairs && G.p.x === G.stairs.x && G.p.y === G.stairs.y) { askStairs(); return; }
  if (fi) doAct({ k: 'pick' }); else { log('足元には何もない'); }
}
function askStairs() { stairsAsk = true; $('stairsAsk').hidden = false; }
$('sYes').onclick = () => { stairsAsk = false; $('stairsAsk').hidden = true; doAct({ k: 'stairs' }); };
$('sNo').onclick = () => { stairsAsk = false; $('stairsAsk').hidden = true; };

// ---------- セーブ・ゲームオーバー ----------
let saveT = 0;
function save() { if (!G || BOT) return; if (G.over) { try { localStorage.removeItem(SAVE); } catch (e) {} return; } if (G.floor !== lastFloor || ++saveT >= 8) { saveT = 0; lastFloor = G.floor; try { localStorage.setItem(SAVE, C.serialize(G)); } catch (e) {} } }
addEventListener('pagehide', () => { if (G && !G.over && !BOT) try { localStorage.setItem(SAVE, C.serialize(G)); } catch (e) {} });
function gameOver() {
  rec.runs++; rec.kills += G.stats.kills; if (G.win) rec.wins++; const fl = G.win ? C.FLOORS : G.floor; if (fl > rec.best) rec.best = fl;
  rec.deaths.unshift({ f: fl, lv: G.p.lv, cause: G.win ? '制覇' : G.cause, d: Date.now() }); rec.deaths = rec.deaths.slice(0, 10); saveRec();
  if (window.GAMES_RANK) GAMES_RANK.report('naraku', rec.best);
  setTimeout(() => {
    $('over').hidden = false; $('ovTitle').textContent = G.win ? '奈落を制した！' : 'あなたは力つきた…';
    $('ovBody').innerHTML = [['到達', `地下${G.floor}階`], ['原因', G.win ? '奈落の主をたおした' : G.cause], ['レベル', G.p.lv], ['たおした敵', G.stats.kills], ['ターン', G.stats.turns], ['最高記録', `地下${rec.best}階`]].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  }, 900);
}
function newRun(load) {
  if (load) { try { G = C.deserialize(localStorage.getItem(SAVE)); } catch (e) { G = null; } }
  if (!G) G = C.newGame();
  lastFloor = 0; $('title').hidden = true; $('over').hidden = true; $('hud').hidden = false; $('log').innerHTML = '';
  buildFloor(); hud(); log(load ? `地下${G.floor}階から再開` : '奈落の迷宮に足をふみいれた…');
  if (!load) log('目標：地下20階の「奈落の主」をたおすこと');
}
function openMenu() { $('menu').hidden = false; $('mStat').innerHTML = [['攻撃', C.pAtk(G)], ['防御', C.pDef(G)], ['経験', `${G.p.xp}/${C.xpNeed(G.p.lv)}`], ['お腹の最大', G.p.mbelly + '%'], ['たおした敵', G.stats.kills], ['ターン', G.stats.turns]].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join(''); $('mMute').textContent = muted ? '🔇 音：なし' : '🔊 音：あり'; }
$('mBack').onclick = () => closeModals();
$('mHelp').onclick = () => { $('menu').hidden = true; $('help').hidden = false; };
$('hBack').onclick = () => closeModals();
$('mMute').onclick = () => { muted = !muted; localStorage.setItem('naraku-mute', muted ? '1' : '0'); openMenu(); };
$('mTitle').onclick = () => { if (G && !G.over) try { localStorage.setItem(SAVE, C.serialize(G)); } catch (e) {} closeModals(); toTitle(); };
$('mGiveup').onclick = () => { if (!confirm('この冒険をあきらめる？（記録は残る）')) return; closeModals(); G.over = true; G.cause = 'あきらめた'; save(); gameOver(); };
document.querySelectorAll('#gfx button').forEach(b => { b.classList.toggle('on', +b.dataset.g === GQ); b.onclick = () => { localStorage.setItem('naraku-gq', b.dataset.g); if (G && !G.over) try { localStorage.setItem(SAVE, C.serialize(G)); } catch (e) {} location.reload(); }; });
$('ovNew').onclick = () => { G = null; newRun(false); };
$('ovTitle2').onclick = () => toTitle();
function toTitle() { $('hud').hidden = true; $('over').hidden = true; $('title').hidden = false; const has = !!localStorage.getItem(SAVE); $('tCont').hidden = !has; $('tRec').innerHTML = `最高記録 地下${rec.best}階　冒険 ${rec.runs}回　制覇 ${rec.wins}回` + (rec.deaths.length ? '<br><span style="opacity:.7">' + rec.deaths.slice(0, 3).map(d => `B${d.f}F Lv${d.lv}「${d.cause}」`).join('　') + '</span>' : ''); }
$('tNew').onclick = () => { ac(); if (localStorage.getItem(SAVE) && !confirm('いまの冒険は消えます。新しく潜る？')) return; localStorage.removeItem(SAVE); G = null; newRun(false); };
$('tCont').onclick = () => { ac(); newRun(true); };
$('tHelp').onclick = () => { $('help').hidden = false; };

// ---------- テスト用ボット ----------
function botStep() {
  const p = G.p; const known = it => C.isKnown(G, it);
  if (p.hp < p.mhp * 0.4) { const h = p.inv.find(i => (i.id === 'p_heal' || i.id === 'p_bigheal') && known(i)) || p.inv.find(i => i.k === 'potion' && !known(i)); if (h) return doAct({ k: 'use', uid: h.uid }); }
  if (p.belly < 15) { const f = p.inv.find(i => i.k === 'food'); if (f) return doAct({ k: 'use', uid: f.uid }); }
  const adj = G.mons.find(m => !m.disguise && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) === 1 && !(m.x !== p.x && m.y !== p.y && (!C.walk(G, m.x, p.y) || !C.walk(G, p.x, m.y))));
  if (adj) return doAct({ k: 'move', d: DIRS.findIndex(([dx, dy]) => dx === adj.x - p.x && dy === adj.y - p.y) });
  if (G.stairs && p.x === G.stairs.x && p.y === G.stairs.y && G.turn - (botFl.t0 || 0) > 120) { botFl.t0 = G.turn; return doAct({ k: 'stairs' }); }
  const d = bfs(p.x, p.y, (x, y) => (G.turn - (botFl.t0 || 0) < 150) ? ((!G.seen[y * W + x] && C.walk(G, x, y)) || G.items.some(i => i.x === x && i.y === y)) : G.stairs && x === G.stairs.x && y === G.stairs.y);
  doAct(d < 0 ? { k: 'wait' } : { k: 'move', d, noPick: false });
}
const botFl = {};
function bfs(sx, sy, goal) { const prev = new Int32Array(W * H).fill(-1); const q = [sy * W + sx]; prev[q[0]] = q[0]; for (let qi = 0; qi < q.length; qi++) { const c = q[qi], x = c % W, y = (c / W) | 0; if (goal(x, y) && c !== q[0]) { let cur = c; while (prev[cur] !== q[0]) cur = prev[cur]; return DIRS.findIndex(([dx, dy]) => dx === cur % W - sx && dy === ((cur / W) | 0) - sy); } for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy; if (!C.walk(G, nx, ny)) continue; if (dx && dy && (!C.walk(G, x + dx, y) || !C.walk(G, x, y + dy))) continue; const ni = ny * W + nx; if (prev[ni] >= 0 || C.monAt(G, nx, ny)) continue; prev[ni] = c; q.push(ni); } } return -1; }

// ---------- はじめ ----------
toTitle();
requestAnimationFrame(loop);
if (window.__loadDone) window.__loadDone();
if (window.GAMES_RANK) { GAMES_RANK.mount('naraku', { right: 'max(10px, env(safe-area-inset-right))', bottom: 'max(10px, env(safe-area-inset-bottom))' }, () => $('title').hidden); if (rec.best) GAMES_RANK.report('naraku', rec.best); }
if (BOT) newRun(false);
window.NARAKU = { get G() { return G; }, doAct };
