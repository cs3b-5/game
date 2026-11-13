// うぱカートGP — 本体（画面・操作・メニュー）
import * as THREE from '../upa/vendor/three.module.min.js';
import { EffectComposer } from '../tsuki/vendor/EffectComposer.js';
import { RenderPass } from '../tsuki/vendor/RenderPass.js';
import { UnrealBloomPass } from '../tsuki/vendor/UnrealBloomPass.js';
import { OutputPass } from '../tsuki/vendor/OutputPass.js';
import { TRACKS } from './tracks.js';
import { CHARS } from './chars.js';
import { makeKart, makeDriver } from './models.js';
import { makeRace, ITEMS } from './sim.js';
import { buildTrackScene } from './scene.js';

const $ = id => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const BOT = Q.has('bot');
const KEY = 'upa-kart-v1';
const SV = Object.assign({ char: 'upa', level: 1, gq: null, best: {}, lapBest: {}, gp: {}, vol: 0.6 }, (() => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } })());
if (SV.gq == null) { // はじめて：GPUを見て画質を決める（内蔵GPUは「ふつう」）
  try { const gl = document.createElement('canvas').getContext('webgl2'); const ext = gl && gl.getExtension('WEBGL_debug_renderer_info'); const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; SV.gq = /intel|iris|uhd|mali|adreno|apple gpu|swiftshader|llvmpipe/i.test(name) ? 1 : 2; } catch (e) { SV.gq = 1; }
}
if (Q.has('gq')) SV.gq = +Q.get('gq');
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(SV)); } catch (e) {} };
const fmtT = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}'${s.toFixed(2).padStart(5, '0')}"`; };
const GQ = SV.gq;

// ---------- 画面 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, 1.25, 1.6][GQ]));
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = GQ > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 5000);
let composer = null, bloom = null;
if (GQ > 0) {
  const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: GQ === 2 ? 4 : 2 });
  composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.55, 0.85); composer.addPass(bloom); composer.addPass(new OutputPass());
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- 音 ----------
let AC = null, master = null, engine = null;
function ac() { if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = SV.vol; master.connect(AC.destination); } catch (e) {} } if (AC && AC.state === 'suspended') AC.resume(); return AC; }
function tone(f0, f1, dur, type = 'square', vol = 0.1, delay = 0) { const a = ac(); if (!a) return; const t = a.currentTime + delay; const o = a.createOscillator(), g = a.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.02); }
let noiseBuf = null;
function noise(dur, vol = 0.15, fr = 1200, q = 1) { const a = ac(); if (!a) return; if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; } const s = a.createBufferSource(); s.buffer = noiseBuf; const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = q; const g = a.createGain(); const t = a.currentTime; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); s.connect(f).connect(g).connect(master); s.start(t); s.stop(t + dur); }
function startEngine() { const a = ac(); if (!a || engine) return; const o1 = a.createOscillator(), o2 = a.createOscillator(), f = a.createBiquadFilter(), g = a.createGain(); o1.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0; o1.connect(f); o2.connect(f); f.connect(g).connect(master); o1.start(); o2.start(); const ds = a.createBufferSource(); if (!noiseBuf) noise(0.01, 0); ds.buffer = noiseBuf; ds.loop = true; const df = a.createBiquadFilter(); df.type = 'bandpass'; df.frequency.value = 2200; df.Q.value = 3; const dg = a.createGain(); dg.gain.value = 0; ds.connect(df).connect(dg).connect(master); ds.start(); engine = { o1, o2, f, g, dg }; }
function stopEngine() { if (!engine) return; engine.g.gain.value = 0; engine.dg.gain.value = 0; }
const SFX = {
  count: () => tone(660, 660, 0.18, 'square', 0.12), go: () => tone(1320, 1320, 0.45, 'square', 0.12),
  box: () => { tone(900, 1800, 0.12, 'triangle', 0.1); tone(1400, 2200, 0.1, 'triangle', 0.08, 0.06); },
  roul: () => tone(1200, 1200, 0.03, 'square', 0.04), get: () => tone(880, 1760, 0.15, 'triangle', 0.12),
  dash: () => { noise(0.5, 0.25, 600, 0.6); tone(220, 880, 0.35, 'sawtooth', 0.08); }, turbo: lvl => { noise(0.35, 0.22, 900, 0.7); tone(400 + lvl * 200, 1200 + lvl * 300, 0.25, 'sawtooth', 0.07); },
  hit: () => { tone(500, 80, 0.5, 'sawtooth', 0.12); noise(0.3, 0.2, 400, 1); }, boom: () => { noise(0.8, 0.45, 160, 0.5); tone(120, 30, 0.6, 'sine', 0.3); },
  wall: () => noise(0.15, 0.18, 300, 1), bump: () => tone(160, 90, 0.12, 'sine', 0.2), hop: () => tone(300, 500, 0.08, 'sine', 0.08), land: () => tone(140, 70, 0.12, 'sine', 0.15),
  lap: () => [784, 988, 1175].forEach((f, i) => tone(f, f, 0.15, 'triangle', 0.12, i * 0.1)), fin: () => [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, f, 0.2, 'triangle', 0.14, i * 0.13)),
  shield: () => tone(600, 1200, 0.3, 'sine', 0.1), star: () => [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, f, 0.08, 'square', 0.06, i * 0.05)), throw: () => tone(700, 300, 0.2, 'triangle', 0.1), dlvl: l => tone(600 + l * 250, 600 + l * 250, 0.08, 'square', 0.05),
};
// BGM（かんたんなシーケンサー）
let bgmTimer = null, bgmStep = 0, bgmNext = 0;
const SONGS = { day: { bpm: 140, root: 60, prog: [0, 5, 7, 5], scale: [0, 2, 4, 7, 9] }, moon: { bpm: 118, root: 57, prog: [0, 3, 5, 3], scale: [0, 3, 5, 7, 10] }, night: { bpm: 150, root: 58, prog: [0, 8, 3, 10], scale: [0, 3, 5, 7, 10] } };
function bgmStart(theme) {
  bgmStop(); const a = ac(); if (!a) return; const S = SONGS[theme]; const spb = 60 / S.bpm / 2; bgmStep = 0; bgmNext = a.currentTime + 0.1;
  const f = m => 440 * 2 ** ((m - 69) / 12);
  bgmTimer = setInterval(() => {
    while (bgmNext < a.currentTime + 0.3) {
      const bar = Math.floor(bgmStep / 16) % 4, st = bgmStep % 16, ch = S.root + S.prog[bar];
      const t = bgmNext - a.currentTime;
      if (st % 4 === 0) tone(f(ch - 24), f(ch - 24), spb * 1.8, 'triangle', 0.09, t);
      if (st % 4 === 2) tone(f(ch - 12), f(ch - 12), spb * 0.9, 'triangle', 0.06, t);
      if (st % 2 === 0) noise(0.05, st % 8 === 4 ? 0.12 : 0.04, st % 8 === 4 ? 1800 : 7000, st % 8 === 4 ? 0.8 : 2);
      if (st % 8 === 0) tone(90, 40, 0.15, 'sine', 0.25, t);
      if ((bgmStep * 7 + bar) % 3 !== 0) { const n = S.scale[(bgmStep * 3 + bar * 2) % S.scale.length] + ch + 12 * ((bgmStep >> 3) % 2); tone(f(n), f(n), spb * 0.8, 'square', 0.025, t); }
      bgmNext += spb; bgmStep++;
    }
  }, 60);
}
function bgmStop() { if (bgmTimer) clearInterval(bgmTimer); bgmTimer = null; }

// ---------- 入力 ----------
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); if (e.code === 'Escape' && mode === 'race') togglePause(); if (e.code === 'KeyM') { SV.vol = SV.vol > 0 ? 0 : 0.6; if (master) master.gain.value = SV.vol; save(); toast(SV.vol ? '🔊 音あり' : '🔇 ミュート'); } ac(); });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
function readInput() {
  const k = keys; let steer = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  let thr = k.KeyW || k.ArrowUp ? 1 : 0, brk = k.KeyS || k.ArrowDown ? 1 : 0, drift = !!(k.Space || k.ShiftRight || k.KeyK), item = !!(k.ShiftLeft || k.KeyE || k.KeyJ || k.Enter), back = !!(k.KeyC);
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
  if (gp) { const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.15) steer = ax; const b = i => gp.buttons[i] && gp.buttons[i].pressed; if (b(0) || b(7)) thr = 1; if (b(1) || b(6)) brk = 1; if (b(5) || b(4) && false) drift = true; if (b(2) || b(4)) item = true; if (b(3)) back = true; if (b(14)) steer = -1; if (b(15)) steer = 1; }
  return { thr, brk, steer, drift, item, back };
}

// ---------- 状態 ----------
let mode = 'title', R = null, TS = null, karts3d = [], objs3d = new Map(), paused = false, player = 0, gp = null, camMode = 0;
let fx = null;
function clearScene() { while (scene.children.length) scene.remove(scene.children[0]); objs3d.clear(); karts3d = []; }

// エフェクト（パーティクル）
function makeFx() {
  const N = 1400, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), vel = new Float32Array(N * 3), life = new Float32Array(N), grav = new Float32Array(N); let p = 0;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, uniforms: {}, vertexShader: 'attribute float size; varying vec3 vC; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.); gl_PointSize = size * 300.0 / -mv.z; gl_Position = projectionMatrix * mv; }', fragmentShader: 'varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(vC * (1.0 - d * 2.0) * 1.6, 1.0); }' });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts);
  for (let i = 0; i < N; i++) pos[i * 3 + 1] = -999;
  // ほこり（すりガラスっぽい通常合成）
  const N2 = 500, pos2 = new Float32Array(N2 * 3), vel2 = new Float32Array(N2 * 3), life2 = new Float32Array(N2); let p2 = 0;
  const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
  const smokeTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const smoke = new THREE.Points(g2, new THREE.PointsMaterial({ size: 1.3, map: smokeTex, transparent: true, opacity: 0.55, depthWrite: false, color: 0xd8d4cc })); smoke.frustumCulled = false; scene.add(smoke);
  for (let i = 0; i < N2; i++) pos2[i * 3 + 1] = -999;
  return {
    spark(x, y, z, c, n = 1, spd = 4, sz = 0.35, gr = 9, lf = 0.45) { for (let k = 0; k < n; k++) { const i = p = (p + 1) % N; pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z; vel[i * 3] = (Math.random() - 0.5) * spd; vel[i * 3 + 1] = Math.random() * spd * 0.8; vel[i * 3 + 2] = (Math.random() - 0.5) * spd; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; size[i] = sz * (0.6 + Math.random() * 0.8); life[i] = lf * (0.6 + Math.random() * 0.8); grav[i] = gr; } },
    smoke(x, y, z, n = 1, vy = 1) { for (let k = 0; k < n; k++) { const i = p2 = (p2 + 1) % N2; pos2[i * 3] = x + (Math.random() - 0.5) * 0.6; pos2[i * 3 + 1] = y; pos2[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6; vel2[i * 3] = (Math.random() - 0.5) * 1.5; vel2[i * 3 + 1] = vy * (0.5 + Math.random()); vel2[i * 3 + 2] = (Math.random() - 0.5) * 1.5; life2[i] = 0.8 + Math.random() * 0.6; } },
    step(dt) {
      for (let i = 0; i < N; i++) { if (life[i] <= 0) continue; life[i] -= dt; vel[i * 3 + 1] -= grav[i] * dt; pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt; if (life[i] <= 0) pos[i * 3 + 1] = -999; else size[i] *= 1 - dt * 1.5; }
      for (let i = 0; i < N2; i++) { if (life2[i] <= 0) continue; life2[i] -= dt; pos2[i * 3] += vel2[i * 3] * dt; pos2[i * 3 + 1] += vel2[i * 3 + 1] * dt; pos2[i * 3 + 2] += vel2[i * 3 + 2] * dt; if (life2[i] <= 0) pos2[i * 3 + 1] = -999; }
      g.attributes.position.needsUpdate = g.attributes.color.needsUpdate = g.attributes.size.needsUpdate = true; g2.attributes.position.needsUpdate = true;
    },
  };
}
const C = (r, g, b) => ({ r, g, b });
const DCOL = [null, C(0.3, 0.7, 1.6), C(1.8, 0.8, 0.2), C(1.4, 0.4, 1.8)];

// アイテムの見た目
const itemMeshes = {
  slime: () => { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x6aff6a, roughness: 0.05, transmission: 0.3, clearcoat: 1, emissive: 0x0a3a0a })); m.scale.set(1.3, 0.35, 1.3); return m; },
  bomb: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0x1a1a22, roughness: 0.3, clearcoat: 1 })); g.add(b); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0xc8a060 })); f.position.y = 0.7; g.add(f); const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.5, 0.3), toneMapped: false })); s.position.y = 0.88; s.name = 'spark'; g.add(s); const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); face.position.set(-0.18, 0.15, 0.52); g.add(face); const f2 = face.clone(); f2.position.x = 0.18; g.add(f2); return g; },
  missile: () => { const g = new THREE.Group(); const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 8, 16), new THREE.MeshPhysicalMaterial({ color: 0xff3a4a, roughness: 0.2, clearcoat: 1, metalness: 0.3 })); b.rotation.x = Math.PI / 2; g.add(b); for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: 0xffffff })); f.rotation.z = k * Math.PI / 2; f.position.z = -0.5; f.translateY(0.3); g.add(f); } const fl = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.8, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.4), toneMapped: false })); fl.rotation.x = -Math.PI / 2; fl.position.z = -1.1; g.add(fl); return g; },
};

// ---------- レース開始 ----------
function startRace(trackIdx, opt = {}) {
  clearScene(); ac();
  const pid = SV.char, others = CHARS.map(c => c.id).filter(id => id !== pid).sort(() => Math.random() - 0.5);
  const solo = opt.tt; // タイムアタック
  const ids = solo ? [pid] : [...others.slice(0, 7)];
  if (!solo) ids.splice(7, 0, pid); // 自分は一番後ろからスタート
  player = solo ? 0 : 7;
  R = makeRace(trackIdx, { chars: ids, player, level: SV.level });
  if (solo) { R.boxes.length = 0; R.karts[0].item = 'dash3'; R.karts[0].count = 3; }
  TS = buildTrackScene(scene, renderer, R, GQ); renderer.toneMappingExposure = TS.exposure;
  if (solo) for (const m of TS.boxes) m.visible = false;
  fx = makeFx();
  karts3d = R.karts.map((k, n) => {
    const g = makeKart(k.id, n + 1); scene.add(g);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(2, 32, 20), new THREE.MeshPhysicalMaterial({ color: 0x9adfff, transparent: true, opacity: 0.25, roughness: 0, clearcoat: 1, iridescence: 1, side: THREE.DoubleSide, depthWrite: false })); shield.position.y = 0.9; shield.visible = false; g.add(shield);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2, 12, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.3), toneMapped: false, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); flame.rotation.x = -Math.PI / 2; flame.position.set(0, 0.55, -1.9); flame.visible = false; g.add(flame);
    const flame2 = flame.clone(); flame2.position.x = 0.22; flame.position.x = -0.22; g.add(flame2);
    const tag = makeTag(CHARS.find(c => c.id === k.id).name, n === player); tag.position.y = 2.9; g.add(tag);
    return { g, shield, flames: [flame, flame2], tag, drv: g.getObjectByName('driver') };
  });
  mode = 'race'; paused = false; camMode = 0; camInit = true;
  $('title').hidden = true; $('menuSel').hidden = true; $('hud').hidden = false; $('result').hidden = true; $('pause').hidden = true;
  $('hTrack').textContent = R.tr.name; startEngine(); bgmStart(R.tr.theme);
  lastLap = 0; finalShown = false; raceTT = !!solo;
}
function makeTag(name, me) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.font = '900 34px "M PLUS Rounded 1c", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = me ? 'rgba(255,92,138,.9)' : 'rgba(0,0,0,.45)'; x.beginPath(); x.roundRect(28, 8, 200, 48, 24); x.fill(); x.fillStyle = '#fff'; x.fillText(me ? 'YOU' : name, 128, 34);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: true })); s.scale.set(2.2, 0.55, 1); return s;
}

// ---------- 更新 ----------
let camInit = true, lastLap = 0, finalShown = false, raceTT = false, shake = 0, tAll = 0, rumble = 0;
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3();
function update(dt) {
  tAll += dt;
  if (mode === 'title') { titleSpin(dt); return; }
  if (mode !== 'race' || paused) return;
  const inp = BOT ? null : readInput();
  if (BOT) R.karts[player].cpu = true;
  const ev = R.step(dt, inp);
  const me = R.karts[player];
  // カウントダウン
  const cd = Math.ceil(-R.t);
  if (R.t < 0 && cd <= 3 && cd !== lastCd) { lastCd = cd; SFX.count(); bigMsg(String(cd), 700); lampSet(4 - cd); }
  if (R.t >= 0 && lastCd !== 0) { lastCd = 0; SFX.go(); bigMsg('GO!', 800); lampSet(5); }
  // イベント
  for (const e of ev) {
    const k = e.k, mine = k && k.n === player, near = k ? Math.hypot(k.x - me.x, k.z - me.z) < 50 : true;
    if (e.type === 'box') { if (mine) SFX.box(); burst(e.b.x, e.b.y + 1.2, e.b.z, C(1.6, 1.2, 2), 18); }
    if (e.type === 'dash' && mine) SFX.dash();
    if (e.type === 'pad' && mine) SFX.dash();
    if (e.type === 'miniturbo') { if (mine) SFX.turbo(e.lvl); }
    if (e.type === 'dlvl' && mine) SFX.dlvl(e.lvl);
    if (e.type === 'hit') { if (mine) { SFX.hit(); shake = 0.5; } else if (near) SFX.hit(); burst(k.x, k.y + 1, k.z, C(2, 1.6, 0.4), 30, 8); }
    if (e.type === 'boom') { if (near) SFX.boom(); burst(e.x, e.y + 0.5, e.z, C(3, 1.4, 0.3), 80, 14, 0.8); fx.smoke(e.x, e.y, e.z, 30, 3); if (Math.hypot(e.x - me.x, e.z - me.z) < 20) shake = 0.6; }
    if (e.type === 'wall' && mine) { SFX.wall(); shake = 0.25; burst(k.x, k.y + 0.5, k.z, C(2, 1.6, 0.8), 8); }
    if (e.type === 'bump') SFX.bump();
    if (e.type === 'hop' && mine) SFX.hop();
    if (e.type === 'land' && mine) { SFX.land(); fx.smoke(k.x, k.y + 0.2, k.z, 8, 0.6); }
    if (e.type === 'shield' && mine) SFX.shield();
    if (e.type === 'star' && mine) SFX.star();
    if ((e.type === 'throw' || e.type === 'drop') && mine) SFX.throw();
    if (e.type === 'lap' && mine) { SFX.lap(); if (e.lap === R.laps) { bigMsg('FINAL LAP!', 1600); } else bigMsg(`LAP ${e.lap}`, 1000); }
    if (e.type === 'finish' && mine) finish();
    if (e.type === 'roulette' && mine) rouletteT = 0;
  }
  if (R.over && mode === 'race' && !resultShown) showResult();
  // エンジン音
  if (engine) { const sp = Math.abs(me.spd); engine.o1.frequency.value = 50 + sp * 5.5 + (me.boost > 0 ? 40 : 0); engine.o2.frequency.value = 25 + sp * 2.8; engine.f.frequency.value = 500 + sp * 60; engine.g.gain.value = R.t < 0 ? 0.03 : 0.05 + Math.min(1, sp / 30) * 0.05; engine.dg.gain.value = me.drift && !me.air ? 0.06 : me.off && sp > 8 ? 0.03 : 0; }
  fx.step(dt); TS.update.forEach(f => f(dt, tAll));
  for (let b = 0; b < R.boxes.length; b++) { const m = TS.boxes[b]; if (!m) continue; m.visible = R.boxes[b].t <= 0 && !raceTT; m.rotation.set(tAll * 0.9 + b, tAll * 1.3, 0); m.position.y = R.boxes[b].y + 1.3 + Math.sin(tAll * 2 + b) * 0.15; }
  syncKarts(dt); syncObjs(dt); updateCam(dt); hud(dt);
}
let lastCd = 99, rouletteT = 9, resultShown = false;
function lampSet(n) { if (!TS.gate) return; for (let k = 0; k < 5; k++) { const l = TS.gate.getObjectByName('lamp' + k); if (l) l.material.color.set(n >= 5 ? new THREE.Color(0.3, 3, 0.6) : k < n * 1.7 ? new THREE.Color(3, 0.3, 0.3) : 0x331111); } }
function burst(x, y, z, c, n, spd = 6, sz = 0.4) { fx.spark(x, y, z, c, n, spd, sz, 8, 0.7); }

function syncKarts(dt) {
  const P = R.P;
  R.karts.forEach((k, n) => {
    const o = karts3d[n], g = o.g;
    g.position.set(k.x, k.y, k.z);
    // 坂の傾き
    const i1 = P.wrap(k.i + 2), i0 = P.wrap(k.i - 2); const pitch = k.air ? (g.userData.pitch || 0) * 0.98 : -Math.atan2(P.y[i1] - P.y[i0], 4);
    g.userData.pitch = pitch;
    const lean = -(k.drift ? k.drift * 0.12 : 0) - (k.slip * 0.2);
    g.rotation.set(0, 0, 0); g.rotation.order = 'YXZ'; g.rotation.y = k.yaw + k.spinA + (k.drift ? -k.drift * 0.25 : 0); g.rotation.x = pitch; g.rotation.z = lean;
    // タイヤ
    for (const w of g.userData.wheels) { w.rotation.x += k.spd * dt / 0.3; if (w.userData.front) w.rotation.y = 0; }
    const st = g.getObjectByName('steer'); const sv = k.cpu ? 0 : (readInput().steer || 0); if (st) st.rotation.z = -sv * 0.6;
    if (o.drv) { o.drv.rotation.y = -sv * 0.15 - (k.drift ? k.drift * 0.25 : 0); o.drv.position.y = 0.5 + Math.abs(Math.sin(tAll * 18)) * 0.015 * Math.min(1, Math.abs(k.spd) / 10); }
    o.shield.visible = k.shield > 0; if (k.shield > 0) o.shield.rotation.y += dt;
    // 無敵：虹色
    if (k.star > 0) { g.traverse(m => { if (m.isMesh && m.material && m.material.emissive) { m.userData.em = m.userData.em || m.material.emissive.clone(); m.material.emissive.setHSL((tAll * 2 + m.id * 0.01) % 1, 1, 0.45); } }); }
    else if (g.userData.wasStar) g.traverse(m => { if (m.isMesh && m.userData.em) m.material.emissive.copy(m.userData.em); });
    g.userData.wasStar = k.star > 0;
    // 炎（ブースト）
    for (const f of o.flames) { f.visible = !!(k.boost > 0 || (k.drift && k.dLvl > 0)); f.scale.set(1, 0.7 + Math.random() * 0.6 + (k.boost > 0 ? 0.6 : 0), 1); if (f.visible) { const dc = DCOL[k.dLvl] || DCOL[1]; f.material.color.copy(k.boost > 0 ? new THREE.Color(3, 1.4, 0.3) : new THREE.Color(dc.r, dc.g, dc.b)); } }
    o.tag.visible = n !== player || camMode === 1;
    // ドリフトの火花
    if (k.drift && !k.air && k.dLvl > 0) { for (const s of [-1, 1]) { const wx = k.x + Math.sin(k.yaw) * -0.9 + Math.cos(k.yaw) * s * 0.85, wz = k.z + Math.cos(k.yaw) * -0.9 - Math.sin(k.yaw) * s * 0.85; fx.spark(wx, k.y + 0.15, wz, DCOL[k.dLvl], 2, 5, 0.32, 14, 0.3); } }
    if (k.drift && !k.air && Math.random() < 0.5) fx.smoke(k.x - Math.sin(k.yaw) * 1, k.y + 0.1, k.z - Math.cos(k.yaw) * 1, 1, 0.5);
    if (k.off && Math.abs(k.spd) > 6 && Math.random() < 0.6) fx.smoke(k.x - Math.sin(k.yaw) * 1, k.y + 0.2, k.z - Math.cos(k.yaw) * 1, 1, 1);
    if (k.boost > 0 && Math.random() < 0.7) fx.spark(k.x - Math.sin(k.yaw) * 1.9, k.y + 0.55, k.z - Math.cos(k.yaw) * 1.9, C(3, 1.2, 0.3), 2, 2, 0.4, 0, 0.25);
    if (k.star > 0 && Math.random() < 0.6) fx.spark(k.x, k.y + 1, k.z, C(Math.random() * 2, Math.random() * 2, Math.random() * 2), 2, 4, 0.35, 0, 0.5);
  });
  // 影のカメラ
  const me = R.karts[player]; TS.sun.target.position.set(me.x, me.y, me.z); TS.sun.position.copy(TS.sun.target.position).addScaledVector(TS.sunDir, 160);
}
function syncObjs(dt) {
  const seen = new Set();
  for (const o of R.objs) {
    seen.add(o); let m = objs3d.get(o);
    if (!m) { m = itemMeshes[o.kind](); m.traverse(x => { if (x.isMesh) x.castShadow = true; }); scene.add(m); objs3d.set(o, m); }
    m.position.set(o.x, o.kind === 'slime' ? R.P.y[o.i] + 0.1 : o.y, o.z);
    if (o.kind === 'bomb') { m.rotation.x += dt * 8; const s = m.getObjectByName('spark'); if (s) s.visible = Math.sin(tAll * 30) > 0; }
    if (o.kind === 'missile') { const ni = R.P.wrap(o.i + 3); m.lookAt(R.P.x[ni], o.y, R.P.z[ni]); fx.spark(o.x, o.y, o.z, C(3, 1.4, 0.3), 2, 1.5, 0.45, 0, 0.3); }
    if (o.kind === 'slime') m.scale.y = 0.32 + Math.sin(tAll * 4) * 0.03;
  }
  for (const [o, m] of objs3d) if (!seen.has(o)) { scene.remove(m); objs3d.delete(o); }
}
function updateCam(dt) {
  const k = R.karts[player], fwdX = Math.sin(k.yaw), fwdZ = Math.cos(k.yaw);
  const back = readInput().back;
  let want, look;
  if (R.t < -0.4 && !BOT) { // スタート前：まわりこむ
    const a = k.yaw + Math.PI + Math.max(0, (-R.t - 0.5)) * 0.9; const d = 7 + Math.max(0, -R.t - 0.5) * 3;
    want = _v.set(k.x + Math.sin(a) * d, k.y + 2.4 + Math.max(0, -R.t - 0.5), k.z + Math.cos(a) * d); look = _w.set(k.x, k.y + 1, k.z);
  } else if (back) { want = _v.set(k.x + fwdX * 6, k.y + 2.4, k.z + fwdZ * 6); look = _w.set(k.x, k.y + 1, k.z); }
  else { const d = 6.4 + Math.min(1.4, Math.abs(k.spd) / 25), h = 2.5; const ya = k.yaw + k.slip * 0.6; want = _v.set(k.x - Math.sin(ya) * d, k.y + h, k.z - Math.cos(ya) * d); look = _w.set(k.x + fwdX * 4, k.y + 1.1, k.z + fwdZ * 4); }
  if (camInit) { camPos.copy(want); camLook.copy(look); camInit = false; }
  camPos.lerp(want, Math.min(1, dt * (back ? 20 : 7))); camLook.lerp(look, Math.min(1, dt * 12));
  const gy = R.P.groundY(R.P.nearest(k.i, camPos.x, camPos.z, 30), R.P.lateral(k.i, camPos.x, camPos.z)); if (camPos.y < gy + 0.8) camPos.y = gy + 0.8;
  camera.position.copy(camPos); if (shake > 0) { shake -= dt; camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; }
  camera.lookAt(camLook);
  const fov = 68 + (k.boost > 0 ? 10 : 0) + Math.min(6, Math.abs(k.spd) / 6); camera.fov += (fov - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix();
  $('speedlines').style.opacity = k.boost > 0 ? 0.8 : 0;
}

// ---------- HUD ----------
const mm = $('mini'), mmx = mm.getContext('2d'); let mmPath = null;
function hud(dt) {
  const k = R.karts[player];
  const pos = k.rank, suf = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
  $('hPos').innerHTML = raceTT ? '' : `${pos}<small>${suf}</small>`; $('hPos').className = 'pos p' + Math.min(pos, 4);
  $('hLap').textContent = `LAP ${Math.min(R.laps, Math.max(1, k.lap + 1))}/${R.laps}`;
  $('hTime').textContent = fmtT(Math.max(0, k.time));
  $('hSpd').innerHTML = `${Math.round(Math.abs(k.spd) * 3.6)}<small>km/h</small>`;
  // アイテム
  rouletteT += dt; const slot = $('hItem');
  if (k.roul > 0) { const keys2 = Object.keys(ITEMS); if (rouletteT > 0.07) { rouletteT = 0; slot.textContent = ITEMS[keys2[(Math.random() * keys2.length) | 0]].ic; SFX.roul(); } slot.classList.add('spin'); }
  else { slot.classList.remove('spin'); if (k.item) { if (slot.dataset.it !== k.item + k.count) { slot.dataset.it = k.item + k.count; slot.innerHTML = ITEMS[k.item].ic + (k.count > 1 ? `<b>×${k.count}</b>` : ''); SFX.get(); } } else { slot.textContent = ''; slot.dataset.it = ''; } }
  $('hItemName').textContent = k.item && k.roul <= 0 ? ITEMS[k.item].name : '';
  // ドリフトゲージ
  const dg = $('hDrift'); dg.style.opacity = k.drift ? 1 : 0; dg.firstElementChild.style.width = Math.min(100, k.dTime / 3.1 * 100) + '%'; dg.firstElementChild.style.background = ['#aaa', '#4ab8ff', '#ff9a2a', '#c86aff'][k.dLvl];
  $('hWrong').hidden = !(k.wrong > 1);
  // ミニマップ
  const P = R.P; if (!mmPath) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < P.N; i++) { x0 = Math.min(x0, P.x[i]); x1 = Math.max(x1, P.x[i]); z0 = Math.min(z0, P.z[i]); z1 = Math.max(z1, P.z[i]); } mmPath = { x0, z0, s: 180 / Math.max(x1 - x0, z1 - z0) }; }
  const W = mm.width, H = mm.height, s = mmPath.s * W / 200, ox = (W - (mmPath.s * W / 200) * 0) / 2; const mx = x => 10 * W / 200 + (x - mmPath.x0) * s, mz = z => 10 * W / 200 + (z - mmPath.z0) * s;
  mmx.clearRect(0, 0, W, H); mmx.lineJoin = 'round';
  mmx.strokeStyle = 'rgba(0,0,0,.5)'; mmx.lineWidth = 12; mmx.beginPath(); for (let i = 0; i <= P.N; i += 4) { const j = i % P.N; i ? mmx.lineTo(mx(P.x[j]), mz(P.z[j])) : mmx.moveTo(mx(P.x[j]), mz(P.z[j])); } mmx.closePath(); mmx.stroke();
  mmx.strokeStyle = 'rgba(255,255,255,.9)'; mmx.lineWidth = 6; mmx.stroke();
  mmx.fillStyle = '#111'; mmx.fillRect(mx(P.x[0]) - 5, mz(P.z[0]) - 5, 10, 10);
  for (const o of R.objs) { mmx.fillStyle = o.kind === 'slime' ? '#5f5' : o.kind === 'bomb' ? '#222' : '#f44'; mmx.beginPath(); mmx.arc(mx(o.x), mz(o.z), 3, 0, 7); mmx.fill(); }
  for (const kk of [...R.karts].reverse()) { const c = CHARS.find(c => c.id === kk.id); mmx.fillStyle = '#' + new THREE.Color(c.kart).getHexString(); mmx.strokeStyle = kk.n === player ? '#fff' : '#000'; mmx.lineWidth = kk.n === player ? 3 : 1.5; mmx.beginPath(); mmx.arc(mx(kk.x), mz(kk.z), kk.n === player ? 7 : 5, 0, 7); mmx.fill(); mmx.stroke(); }
  // 順位リスト
  const order = R.rankAll(); $('hList').innerHTML = raceTT ? '' : order.map(kk => `<div class="${kk.n === player ? 'me' : ''}"><b>${kk.rank}</b>${CHARS.find(c => c.id === kk.id).name}</div>`).join('');
}
let msgT = 0;
function bigMsg(t, ms) { const el = $('big'); el.textContent = t; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); clearTimeout(msgT); msgT = setTimeout(() => el.classList.remove('on'), ms); }
let toastT = 0; function toast(t) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), 1400); }

// ---------- ゴール・結果 ----------
function finish() { const k = R.karts[player]; SFX.fin(); bigMsg(raceTT ? 'FINISH!' : `${k.rank}位でゴール！`, 2400); }
const PTS = [15, 12, 10, 8, 6, 4, 2, 1];
function showResult() {
  resultShown = true; R.finishRest(); stopEngine();
  const order = R.rankAll(), me = R.karts[player], tr = R.tr.id;
  let best = false;
  if (raceTT || me.rank <= 8) { const key = (raceTT ? 'tt_' : '') + tr; if (!SV.best[key] || me.time < SV.best[key]) { SV.best[key] = me.time; best = true; } }
  const lb = Math.min(...me.lapTimes); if (isFinite(lb) && (!SV.lapBest[tr] || lb < SV.lapBest[tr])) SV.lapBest[tr] = lb;
  save();
  if (raceTT && tr === 'circuit' && window.GAMES_RANK) GAMES_RANK.report('kart', Math.round(SV.best.tt_circuit * 100) / 100);
  let html = '';
  if (raceTT) html = `<h2>タイムアタック</h2><div class="rows"><div class="me"><b>タイム</b><span>${fmtT(me.time)}${best ? ' 🎉ベスト' : ''}</span></div>${me.lapTimes.map((t, i) => `<div><b>LAP ${i + 1}</b><span>${fmtT(t)}</span></div>`).join('')}<div><b>ベスト</b><span>${fmtT(SV.best['tt_' + tr])}</span></div></div>`;
  else {
    if (gp) { order.forEach(k => { gp.pts[k.id] = (gp.pts[k.id] || 0) + PTS[k.rank - 1]; }); }
    html = `<h2>${R.tr.name}　結果</h2><div class="rows">` + order.map(k => `<div class="${k.n === player ? 'me' : ''}"><b>${k.rank}</b><i>${CHARS.find(c => c.id === k.id).name}</i><span>${fmtT(k.time)}</span>${gp ? `<em>+${PTS[k.rank - 1]}</em>` : ''}</div>`).join('') + '</div>';
    if (gp) { const st = Object.entries(gp.pts).sort((a, b) => b[1] - a[1]); html += `<h3>グランプリ（${gp.idx + 1}/${TRACKS.length}）</h3><div class="rows small">` + st.map(([id, p], i) => `<div class="${id === SV.char ? 'me' : ''}"><b>${i + 1}</b><i>${CHARS.find(c => c.id === id).name}</i><span>${p}pt</span></div>`).join('') + '</div>'; }
  }
  $('resBody').innerHTML = html; $('result').hidden = false;
  const last = gp && gp.idx >= TRACKS.length - 1;
  $('resNext').textContent = gp ? (last ? 'グランプリの表彰へ' : 'つぎのコースへ') : 'もう一度';
  $('resNext').onclick = () => { $('result').hidden = true; resultShown = false; if (gp) { if (last) gpEnd(); else { gp.idx++; startRace(gp.idx); } } else startRace(TRACKS.findIndex(t => t.id === tr), { tt: raceTT }); };
  $('resMenu').onclick = () => { gp = null; $('result').hidden = true; resultShown = false; toTitle(); };
}
function gpEnd() {
  const st = Object.entries(gp.pts).sort((a, b) => b[1] - a[1]); const myRank = st.findIndex(([id]) => id === SV.char) + 1;
  if (!SV.gp[SV.level] || myRank < SV.gp[SV.level]) SV.gp[SV.level] = myRank; save();
  $('resBody').innerHTML = `<h2>🏆 グランプリ結果</h2><div class="podium">${st.slice(0, 3).map(([id, p], i) => `<div class="pd p${i + 1}"><div class="emoji">${['🥇', '🥈', '🥉'][i]}</div><b>${CHARS.find(c => c.id === id).name}</b><span>${p}pt</span></div>`).join('')}</div><p style="text-align:center;font-weight:900">あなたは ${myRank}位！${myRank === 1 ? '🎉 優勝！' : ''}</p>`;
  $('result').hidden = false; $('resNext').textContent = 'タイトルへ'; $('resNext').onclick = () => { gp = null; $('result').hidden = true; toTitle(); }; $('resMenu').onclick = $('resNext').onclick;
  if (myRank === 1) SFX.fin();
}
function togglePause() { paused = !paused; $('pause').hidden = !paused; if (paused) stopEngine(); }
$('pResume').onclick = () => togglePause();
$('pRetry').onclick = () => { togglePause(); resultShown = false; startRace(TRACKS.indexOf(R.tr), { tt: raceTT }); };
$('pQuit').onclick = () => { paused = false; $('pause').hidden = true; gp = null; toTitle(); };

// ---------- タイトル・選択 ----------
let titleKart = null;
function toTitle() {
  mode = 'title'; clearScene(); stopEngine(); bgmStop(); $('hud').hidden = true; $('pause').hidden = true; $('result').hidden = true; $('menuSel').hidden = true; $('title').hidden = false;
  const race = makeRace(0, { chars: [SV.char], player: 0 });
  TS = buildTrackScene(scene, renderer, race, GQ); R = null; renderer.toneMappingExposure = TS.exposure;
  titleKart = makeKart(SV.char, 1); const i = 40; titleKart.position.set(race.P.x[i], race.P.y[i], race.P.z[i]); titleKart.rotation.y = Math.atan2(race.P.tx[i], race.P.tz[i]); scene.add(titleKart);
  titlePt = { x: race.P.x[i], y: race.P.y[i], z: race.P.z[i], yaw: titleKart.rotation.y }; TS.sun.target.position.set(titlePt.x, titlePt.y, titlePt.z); TS.sun.position.copy(TS.sun.target.position).addScaledVector(TS.sunDir, 160);
  $('tBest').innerHTML = TRACKS.map(t => `<span>${t.name}</span><b>${SV.best[t.id] ? fmtT(SV.best[t.id]) : '—'}</b>`).join('') + `<span>タイムアタック（サーキット）</span><b>${SV.best.tt_circuit ? fmtT(SV.best.tt_circuit) : '—'}</b>`;
}
let titlePt = null;
function titleSpin(dt) { if (!titlePt) return; const a = tAll * 0.25; camera.position.set(titlePt.x + Math.sin(a) * 6.5, titlePt.y + 2.2, titlePt.z + Math.cos(a) * 6.5); camera.lookAt(titlePt.x, titlePt.y + 0.9, titlePt.z); camera.fov = 50; camera.updateProjectionMatrix(); TS.update.forEach(f => f(dt, tAll)); if (titleKart) { const d = titleKart.getObjectByName('driver'); if (d) d.rotation.y = Math.sin(tAll) * 0.3; } }

let selMode = 'race', selTrack = 0;
function openSel(m) {
  selMode = m; $('title').hidden = true; $('menuSel').hidden = false;
  $('selTitle').textContent = m === 'gp' ? 'グランプリ（3コース）' : m === 'tt' ? 'タイムアタック' : 'フリーレース';
  $('selTracks').hidden = m === 'gp'; $('selLevel').hidden = m === 'tt';
  $('chars').innerHTML = CHARS.map(c => `<button class="ch ${c.id === SV.char ? 'on' : ''}" data-id="${c.id}"><span class="dot" style="background:#${new THREE.Color(c.kart).getHexString()}"></span><b>${c.name}</b><i>${c.line}</i><div class="st">${['spd', 'acc', 'hdl', 'wgt'].map(s => `<em>${{ spd: 'スピード', acc: '加速', hdl: 'ハンドル', wgt: '重さ' }[s]}<u style="width:${c[s] * 20}%"></u></em>`).join('')}</div></button>`).join('');
  $('chars').querySelectorAll('.ch').forEach(b => b.onclick = () => { SV.char = b.dataset.id; save(); $('chars').querySelectorAll('.ch').forEach(x => x.classList.toggle('on', x === b)); if (titleKart) { scene.remove(titleKart); titleKart = makeKart(SV.char, 1); titleKart.position.set(titlePt.x, titlePt.y, titlePt.z); titleKart.rotation.y = titlePt.yaw; scene.add(titleKart); } });
  $('tracks').innerHTML = TRACKS.map((t, i) => `<button class="tk ${i === selTrack ? 'on' : ''}" data-i="${i}"><b>${t.name}</b><i>${t.sub}</i><span>${(m === 'tt' ? SV.best['tt_' + t.id] : SV.best[t.id]) ? 'ベスト ' + fmtT(m === 'tt' ? SV.best['tt_' + t.id] : SV.best[t.id]) : ''}</span></button>`).join('');
  $('tracks').querySelectorAll('.tk').forEach(b => b.onclick = () => { selTrack = +b.dataset.i; $('tracks').querySelectorAll('.tk').forEach(x => x.classList.toggle('on', x === b)); });
  $('levels').querySelectorAll('button').forEach(b => { b.classList.toggle('on', +b.dataset.l === SV.level); b.onclick = () => { SV.level = +b.dataset.l; save(); $('levels').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); }; });
}
$('tGP').onclick = () => openSel('gp'); $('tRace').onclick = () => openSel('race'); $('tTT').onclick = () => openSel('tt');
$('selBack').onclick = () => { $('menuSel').hidden = true; $('title').hidden = false; };
$('selGo').onclick = () => { ac(); if (selMode === 'gp') { gp = { idx: 0, pts: {} }; startRace(0); } else startRace(selTrack, { tt: selMode === 'tt' }); };
document.querySelectorAll('#gfx button').forEach(b => { b.classList.toggle('on', +b.dataset.g === GQ); b.onclick = () => { SV.gq = +b.dataset.g; save(); location.reload(); }; });

// ---------- ループ ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(1 / 30, (now - last) / 1000); last = now;
  update(dt);
  if (composer) composer.render(dt); else renderer.render(scene, camera);
}
toTitle();
requestAnimationFrame(loop);
if (window.__loadDone) window.__loadDone();
if (window.GAMES_RANK) GAMES_RANK.mount('kart', { right: '14px', top: '14px' }, () => mode !== 'title');
if (BOT) { setTimeout(() => { SV.char = Q.get('char') || 'upa'; startRace(+(Q.get('track') || 0), {}); }, 300); }
window.KART = { get k3() { return karts3d; }, get R() { return R; }, startRace, get mode() { return mode; }, keys };
