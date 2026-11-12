// ウパラン：本体（3D・操作・当たり判定・スコア）
import * as THREE from '../upa/vendor/three.module.min.js';
import { makeGen, OBST, ITEMS, laneX, speedAt, LANE_W } from './gen.js';

const $ = id => document.getElementById(id);
const SAVE = 'uparun-v1';
const SV = (() => { try { return JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) { return {}; } })();
SV.best = SV.best || 0; SV.bank = SV.bank || 0; SV.skins = SV.skins || ['pink']; SV.skin = SV.skin || 'pink'; SV.runs = SV.runs || [];
const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(SV)); } catch (e) {} };
const BOT = /[?&]bot=1/.test(location.search);  // テスト用：自動で走る
const FAST = +(new URLSearchParams(location.search).get('fast') || 1); // テスト用：早送り
const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

// ================= 効果音（その場で合成） =================
const SND = (() => {
  let ac = null; let on = SV.sound !== false;
  const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } } if (ac.state === 'suspended') ac.resume(); return ac; };
  function tone(f, dur, vol, type = 'sine', t0 = 0, f2) {
    const a = ctx(); if (!a || !on) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + .02);
  }
  function noise(dur, f0, vol, type = 'lowpass') {
    const a = ctx(); if (!a || !on) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain(); s.buffer = b; fl.type = type; fl.frequency.value = f0; g.gain.value = vol; s.connect(fl).connect(g).connect(a.destination); s.start();
  }
  return {
    get on() { return on; }, set on(v) { on = v; SV.sound = v; save(); }, unlock: ctx,
    jump() { tone(420, .16, .12, 'square', 0, 820); }, slide() { noise(.22, 1800, .25, 'highpass'); },
    lane() { noise(.08, 3000, .12, 'highpass'); },
    drop(n) { tone(880 * Math.pow(2, (n % 8) / 12), .09, .09, 'sine'); },
    item() { [660, 880, 1320].forEach((f, i) => tone(f, .12, .12, 'triangle', i * .07)); },
    bonk() { tone(160, .15, .25, 'square', 0, 80); }, crash() { noise(.6, 600, .7); tone(220, .5, .2, 'sawtooth', 0, 50); },
    shield() { tone(500, .3, .2, 'sine', 0, 1400); },
  };
})();
addEventListener('pointerdown', () => SND.unlock(), { once: true });

// ================= 3D の準備 =================
const cv = $('cv');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: !mobile, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fd8ff, 50, 150);
const camera = new THREE.PerspectiveCamera(60, 1, .1, 400);
const hemi = new THREE.HemisphereLight(0xdff2ff, 0x3a6a8a, 1.3); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(-6, 12, 6); scene.add(sun);
// 空（グラデーション）
const skyU = { top: { value: new THREE.Color('#2f7fe0') }, low: { value: new THREE.Color('#d8f2ff') } };
scene.add(new THREE.Mesh(new THREE.SphereGeometry(300, 24, 12), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU,
  vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 low; varying vec3 vp; void main(){ float y = normalize(vp).y; gl_FragColor = vec4(mix(low, top, smoothstep(-.05, .45, y)), 1.); }' })));

// 景色（朝→昼→夕方→夜→ネオン）：800m ごとに変わる
const BIOMES = [
  { n: '朝', top: '#5aa0f0', low: '#ffe6d0', fog: 0xcfe0f0, hemi: [0xfff0e0, 0x5a7a9a, 1.3], sun: 2.0, road: '#2b6fa8', side: '#3fa0c8' },
  { n: '昼', top: '#2f7fe0', low: '#d8f2ff', fog: 0x9fd8ff, hemi: [0xdff2ff, 0x3a6a8a, 1.35], sun: 2.4, road: '#2a6aa0', side: '#36b0d0' },
  { n: '夕方', top: '#4a3a8a', low: '#ff9a6a', fog: 0xe0907a, hemi: [0xffc8a0, 0x4a3a6a, 1.1], sun: 1.8, road: '#5a4a8a', side: '#c86a7a' },
  { n: '夜', top: '#0a0e2a', low: '#2a3a7a', fog: 0x1a2250, hemi: [0x8aa0ff, 0x1a1a3a, .9], sun: .8, road: '#1a2a5a', side: '#2a3a8a' },
  { n: 'ネオン', top: '#12002a', low: '#6a1a8a', fog: 0x3a0a5a, hemi: [0xff8aff, 0x1a0a3a, 1.0], sun: .7, road: '#2a0a4a', side: '#ff3aa8' },
];
const cTop = new THREE.Color(), cLow = new THREE.Color(), cFog = new THREE.Color();
function applyBiome(f) { // f: 0〜BIOMES.length（小数で混ぜる）
  const i = Math.floor(f) % BIOMES.length, j = (i + 1) % BIOMES.length, k = Math.min(1, Math.max(0, (f % 1 - .8) / .2));
  const A = BIOMES[i], B = BIOMES[j];
  skyU.top.value.copy(cTop.set(A.top).lerp(new THREE.Color(B.top), k)); skyU.low.value.copy(cLow.set(A.low).lerp(new THREE.Color(B.low), k));
  scene.fog.color.copy(cFog.setHex(A.fog).lerp(new THREE.Color(B.fog), k));
  hemi.color.setHex(A.hemi[0]).lerp(new THREE.Color(B.hemi[0]), k); hemi.groundColor.setHex(A.hemi[1]); hemi.intensity = A.hemi[2] + (B.hemi[2] - A.hemi[2]) * k;
  sun.intensity = A.sun + (B.sun - A.sun) * k;
  roadMat.color.set(A.road).lerp(new THREE.Color(B.road), k); sideMat.color.set(A.side).lerp(new THREE.Color(B.side), k);
  const night = (i >= 3 ? 1 - (j < 3 ? k : 0) : (j >= 3 ? k : 0));
  lampMat.emissiveIntensity = .2 + night * 2.2; neonMat.opacity = night * .9;
  return A.n;
}

// ---------- 地面（3レーンの水路の道） ----------
const roadTex = (() => {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = 'rgba(0,0,0,.08)'; for (let y = 0; y < 256; y += 32) g.fillRect(0, y, 256, 2);
  g.fillStyle = 'rgba(255,255,255,1)'; for (const x of [85, 171]) for (let y = 0; y < 256; y += 64) g.fillRect(x - 5, y, 10, 40);
  g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(0, 0, 6, 256); g.fillRect(250, 0, 6, 256);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 30); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
})();
const roadMat = new THREE.MeshLambertMaterial({ color: '#2a6aa0', map: roadTex });
const road = new THREE.Mesh(new THREE.PlaneGeometry(LANE_W * 3 + .6, 240), roadMat); road.rotation.x = -Math.PI / 2; road.position.z = -100; scene.add(road);
const sideMat = new THREE.MeshLambertMaterial({ color: '#36b0d0' });
for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(6, .5, 240), sideMat); w.position.set(s * (LANE_W * 1.5 + 3.3), .25, -100); scene.add(w); }
// 水（両はし）
const water = new THREE.Mesh(new THREE.PlaneGeometry(80, 240), new THREE.MeshLambertMaterial({ color: 0x3ac0f0, transparent: true, opacity: .85 })); water.rotation.x = -Math.PI / 2; water.position.set(0, -.3, -100); scene.add(water);

// ---------- 景色の小物（使い回す） ----------
const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xffd88a, emissiveIntensity: .3 });
const neonMat = new THREE.MeshBasicMaterial({ color: 0xff3ad8, transparent: true, opacity: 0 });
const props = [];
const tankCols = [0x5ad8ff, 0xff8ab0, 0x8aff9a, 0xffd23a, 0xb08aff];
function makeProp(i) {
  const g = new THREE.Group(), side = i % 2 ? 1 : -1, kind = i % 3;
  if (kind === 0) { // 街灯
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.08, .1, 4.4, 6), new THREE.MeshLambertMaterial({ color: 0x2a3a5a })); pole.position.y = 2.2; g.add(pole);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.32, 10, 8), lampMat); lamp.position.set(-side * .5, 4.4, 0); g.add(lamp);
    g.position.x = side * (LANE_W * 1.5 + 1.2);
  } else { // 大きな水槽のビル
    const h = 5 + (i * 37 % 9), w = 4 + (i * 13 % 3);
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 5), new THREE.MeshLambertMaterial({ color: tankCols[i % tankCols.length], transparent: true, opacity: .55 })); b.position.y = h / 2; g.add(b);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(w + .2, .4, 5.2), new THREE.MeshLambertMaterial({ color: 0x1a2a4a })); fr.position.y = h; g.add(fr);
    const ne = new THREE.Mesh(new THREE.BoxGeometry(w + .25, .12, 5.25), neonMat); ne.position.y = h * .5; g.add(ne);
    // 中の魚
    for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.25, .7, 6), new THREE.MeshLambertMaterial({ color: [0xff7a3a, 0xffe14a, 0xffffff][k] })); f.rotation.z = Math.PI / 2; f.position.set((k - 1) * 1.1, 1.5 + k * 1.3, side * -1.6); g.add(f); }
    g.position.x = side * (LANE_W * 1.5 + 6.5 + w / 2);
  }
  g.position.z = -i * 7; scene.add(g); props.push(g);
}
for (let i = 0; i < 34; i++) makeProp(i);

// ---------- 障害物・しずく・アイテムの形 ----------
const MAT = {
  low: [new THREE.MeshLambertMaterial({ color: 0xff8a2a }), new THREE.MeshLambertMaterial({ color: 0xffffff })],
  bar: new THREE.MeshLambertMaterial({ color: 0x3a7aff }), post: new THREE.MeshLambertMaterial({ color: 0xdfe8ff }),
  block: new THREE.MeshLambertMaterial({ color: 0xc88a4a }), blockTop: new THREE.MeshLambertMaterial({ color: 0xa06a2a }),
  truck: new THREE.MeshLambertMaterial({ color: 0xf0f4ff }), glass: new THREE.MeshLambertMaterial({ color: 0x6ad8ff, transparent: true, opacity: .55 }), cab: new THREE.MeshLambertMaterial({ color: 0xff5c8a }),
};
function stripes(w, h) { // 白とオレンジのしま模様
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#ff8a2a'; g.beginPath(); g.moveTo(i * 20 - 16, 32); g.lineTo(i * 20, 0); g.lineTo(i * 20 + 16, 0); g.lineTo(i * 20, 32); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshLambertMaterial({ map: t });
}
const stripeMat = stripes();
function makeObst(type) {
  const g = new THREE.Group(); const W = LANE_W * .82;
  if (type === 'low') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(W, .45, .25), stripeMat); b.position.y = .62; g.add(b);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.14, .85, .5), MAT.post); l.position.set(s * W / 2.2, .42, 0); g.add(l); }
  } else if (type === 'bar') {
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, 2.6, 8), MAT.post); l.position.set(s * W / 2, 1.3, 0); g.add(l); }
    const b = new THREE.Mesh(new THREE.BoxGeometry(W + .2, .7, .35), MAT.bar); b.position.y = 1.55; g.add(b);
    const s2 = new THREE.Mesh(new THREE.BoxGeometry(W - .3, .2, .37), MAT.low[1]); s2.position.y = 1.55; g.add(s2);
  } else if (type === 'block') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(W, 2.4, 1.6), MAT.block); b.position.y = 1.2; g.add(b);
    const t = new THREE.Mesh(new THREE.BoxGeometry(W + .05, .25, 1.65), MAT.blockTop); t.position.y = 2.1; g.add(t);
    const x = new THREE.Mesh(new THREE.BoxGeometry(.18, 2.2, 1.62), MAT.blockTop); x.rotation.z = .9; x.position.y = 1.15; g.add(x);
  } else { // 水槽トラック
    const L = OBST.train.len;
    const body = new THREE.Mesh(new THREE.BoxGeometry(W + .2, 2.4, L - 2.2), MAT.truck); body.position.set(0, 1.6, -1.1); g.add(body);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(W + .24, 1.4, L - 2.8), MAT.glass); gl.position.set(0, 1.9, -1.1); g.add(gl);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(W + .2, 2.2, 2), MAT.cab); cab.position.set(0, 1.5, L / 2 - 1); g.add(cab);
    const win = new THREE.Mesh(new THREE.BoxGeometry(W - .2, .7, .05), MAT.glass); win.position.set(0, 2.05, L / 2); g.add(win);
    for (const z of [L / 2 - 1.2, -L / 2 + 2, -1]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(.42, .42, .3, 12), MAT.post); w.rotation.z = Math.PI / 2; w.position.set(s * (W / 2 + .05), .42, z); g.add(w); }
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.2, .55, 6), new THREE.MeshLambertMaterial({ color: [0xff7a3a, 0xffe14a, 0xff5c8a, 0x7aff9a][k] })); f.rotation.z = Math.PI / 2; f.position.set(W / 2 + .1, 1.7 + (k % 2) * .5, -4 + k * 2.2); g.add(f); }
  }
  g.userData.type = type; return g;
}
const pool = { low: [], bar: [], block: [], train: [] };
function getObst(type) { const o = pool[type].pop() || makeObst(type); o.visible = true; scene.add(o); return o; }
function putObst(o) { o.visible = false; scene.remove(o); pool[o.userData.type].push(o); }
// しずく（たくさん出るので、まとめて描く）
const DROPS = 140;
const dropGeo = (() => { const g = new THREE.SphereGeometry(.32, 12, 10); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0) { p.setX(i, p.getX(i) * (1 - y / .32 * .7)); p.setZ(i, p.getZ(i) * (1 - y / .32 * .7)); p.setY(i, y * 1.7); } } g.computeVertexNormals(); return g; })();
const dropMesh = new THREE.InstancedMesh(dropGeo, new THREE.MeshPhongMaterial({ color: 0x5ad8ff, emissive: 0x1a6aaa, shininess: 120, specular: 0xffffff }), DROPS);
dropMesh.frustumCulled = false; scene.add(dropMesh);
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1), E0 = new THREE.Euler();
// アイテム（絵文字の看板＋光る輪）
function emojiTex(e) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.font = '96px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 64, 72); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
const ITEM_E = { magnet: '🧲', shield: '🫧', double: '✨', spring: '🌀' };
const itemTex = {}; for (const k in ITEM_E) itemTex[k] = emojiTex(ITEM_E[k]);
function makeItem(type) {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, .08, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffe14a })); g.add(ring);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: itemTex[type], depthWrite: false })); sp.scale.set(1.05, 1.05, 1); g.add(sp);
  g.userData.type = type; return g;
}

// ---------- ウーパールーパー ----------
const SKINS = {
  pink: { n: 'リューシ', body: '#f9c6d3', gill: '#ec5f86', eye: '#1a1418', price: 0 },
  gold: { n: 'ゴールド', body: '#f6d77a', gill: '#f08a4e', eye: '#2a1810', price: 150 },
  blue: { n: 'ブルー', body: '#9cc6ee', gill: '#5a7fd8', eye: '#101828', price: 250 },
  mint: { n: 'ミント', body: '#a8e6cf', gill: '#3fb08a', eye: '#0c1a14', price: 350 },
  black: { n: 'ブラック', body: '#3a3946', gill: '#6a5a88', eye: '#e9e6f0', price: 500 },
  albino: { n: 'アルビノ', body: '#fff3ec', gill: '#ff7f95', eye: '#e2304a', price: 700 },
  wild: { n: 'マーブル', body: '#6f7556', gill: '#4f5a3e', eye: '#0e100a', price: 900 },
  rainbow: { n: 'にじいろ', body: '#ffd0f0', gill: '#7a8aff', eye: '#1a1418', price: 1500, rainbow: true },
};
const upa = new THREE.Group(); scene.add(upa);
const body = new THREE.Group(); upa.add(body);
const mats = { body: new THREE.MeshPhysicalMaterial({ roughness: .4, clearcoat: .6, sheen: .3 }), gill: new THREE.MeshLambertMaterial(), eye: new THREE.MeshBasicMaterial(), white: new THREE.MeshBasicMaterial({ color: 0xffffff }), mouth: new THREE.MeshBasicMaterial({ color: 0x40202a }), cheek: new THREE.MeshBasicMaterial({ color: 0xff7a9a, transparent: true, opacity: .45 }) };
{
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.5, 20, 16), mats.body); torso.scale.set(1, .85, 1.25); torso.position.set(0, .62, .15); body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.52, 22, 18), mats.body); head.scale.set(1.15, .9, 1); head.position.set(0, 1.12, -.35); body.add(head); body.userData.head = head;
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(.08, 10, 8), mats.eye); e.position.set(s * .36, 1.2, -.75); body.add(e);
    const w = new THREE.Mesh(new THREE.SphereGeometry(.025, 6, 6), mats.white); w.position.set(s * .36 + .02, 1.23, -.82); body.add(w);
    const ch = new THREE.Mesh(new THREE.CircleGeometry(.08, 12), mats.cheek); ch.position.set(s * .44, 1.05, -.7); ch.rotation.y = s * -.6; body.add(ch);
    for (let k = 0; k < 3; k++) { // 外エラ
      const gl = new THREE.Mesh(new THREE.CapsuleGeometry(.07, .38, 4, 8), mats.gill);
      gl.position.set(s * .58, 1.3 - k * .14, -.3 + k * .05); gl.rotation.z = s * (-.9 + k * .5); gl.rotation.x = -.2; body.add(gl);
      (body.userData.gills = body.userData.gills || []).push(gl);
    }
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.12, .02, 6, 12, Math.PI), mats.mouth); mouth.rotation.set(0, 0, Math.PI); mouth.position.set(0, 1.0, -.84); body.add(mouth);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.28, 1, 10), mats.body); tail.rotation.x = Math.PI / 2 + .25; tail.scale.set(.5, 1, 1.4); tail.position.set(0, .62, .95); body.add(tail); body.userData.tail = tail;
  body.userData.legs = [];
  for (const [x, z] of [[-.32, -.25], [.32, -.25], [-.32, .5], [.32, .5]]) { const l = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .22, 4, 8), mats.body); l.position.set(x, .22, z); body.add(l); body.userData.legs.push(l); }
  // あわバリア
  const bub = new THREE.Mesh(new THREE.SphereGeometry(1.15, 24, 18), new THREE.MeshPhongMaterial({ color: 0x9ae8ff, transparent: true, opacity: .28, shininess: 150, specular: 0xffffff, depthWrite: false }));
  bub.position.y = .85; upa.add(bub); upa.userData.bubble = bub; bub.visible = false;
}
// 影
const shadow = new THREE.Mesh(new THREE.CircleGeometry(.62, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .28, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2; shadow.position.y = .02; scene.add(shadow);
function setSkin(k) {
  const s = SKINS[k] || SKINS.pink; mats.body.color.set(s.body); mats.gill.color.set(s.gill); mats.eye.color.set(s.eye); mats.body.sheenColor = new THREE.Color(s.gill);
}
setSkin(SV.skin);

// ================= ゲームの状態 =================
let G = null;
const P = { lane: 1, x: 0, y: 0, vy: 0, slide: 0, air: false, jumpT: .6, bonk: 0, laneFrom: 1, laneT: 1 };
function clearRun() { for (const e of (G ? G.ents : [])) if (e.obj) { if (e.kind === 'obst') putObst(e.obj); else scene.remove(e.obj); } }
function newRun() {
  clearRun();
  // 前の回でぶつかって回ったキャラ・カメラのゆれを元にもどす
  upa.position.set(0, 0, 0); upa.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); shakeT = 0; shadow.position.x = 0; shadow.scale.setScalar(1);
  G = { gen: makeGen((Math.random() * 2 ** 31) | 0), ents: [], dist: 0, score: 0, drops: 0, t: 0, items: {}, over: false, combo: 0, biome: -1, rows: [], scroll: 0, paused: false };
  Object.assign(P, { lane: 1, x: 0, y: 0, vy: 0, slide: 0, air: false, bonk: 0, laneFrom: 1, laneT: 1 });
  spawn();
  $('hud').hidden = false; $('pause').hidden = false;
  showHint(matchMedia('(hover: none)').matches ? 'スワイプでよける・タップでジャンプ' : '← → で移動、↑ ジャンプ、↓ スライディング');
}
// 奥にコースを足す（ゲームの座標：走った距離 d の地点 = z が -d）
function spawn() {
  const far = -(G.dist + 160);
  for (const o of G.gen.fill(far, G.dist)) {
    if (o.kind === 'row') { G.rows.push(o); continue; }
    const e = { ...o, z0: o.z };
    if (o.kind === 'obst') e.obj = getObst(o.type);
    else if (o.kind === 'item') { e.obj = makeItem(o.type); scene.add(e.obj); }
    G.ents.push(e);
  }
}

// ---------- 操作 ----------
function act(a) {
  if (!G || G.over || G.paused) return;
  if (a === 'L' || a === 'R') {
    const to = P.lane + (a === 'L' ? -1 : 1); if (to < 0 || to > 2) return;
    // 横に壁があったら押しもどされる
    if (blockedSide(to)) { P.bonk = .35; SND.bonk(); shake(.25); return; }
    P.laneFrom = P.x / LANE_W + 1; P.lane = to; P.laneT = 0; SND.lane();
  }
  if (a === 'U' && !P.air) {
    const spd = speedAt(G.dist), spring = G.items.spring > 0;
    const T = Math.min(.78, Math.max(.44, 11.5 / spd)) * (spring ? 1.55 : 1), H = spring ? 4.2 : 1.75;
    P.vy = 4 * H / T; P.g = 8 * H / (T * T); P.air = true; P.slide = 0; SND.jump();
  }
  if (a === 'D') {
    if (P.air) { P.vy = Math.min(P.vy, -18); P.fast = true; } // 急降下
    const spd = speedAt(G.dist); P.slide = Math.min(.8, Math.max(.42, 9 / spd)); SND.slide();
  }
}
function blockedSide(to) {
  const x = laneX(to);
  return G.ents.some(e => e.kind === 'obst' && (e.type === 'block' || e.type === 'train') && e.lane === to && Math.abs(laneX(e.lane) - x) < .1 && overlapZ(e, .2));
}
function overlapZ(e, pad = 0) { const L = OBST[e.type].len, z = e.z + G.dist; return z + L / 2 + pad > -.45 && z - L / 2 - pad < .45; }
const KEYS = { ArrowLeft: 'L', KeyA: 'L', ArrowRight: 'R', KeyD: 'R', ArrowUp: 'U', KeyW: 'U', Space: 'U', ArrowDown: 'D', KeyS: 'D' };
addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  const a = KEYS[e.code]; if (!a || e.repeat) return;
  if (G && !G.over) { e.preventDefault(); act(a); }
  else if (a === 'U' && !$('title').hidden) start();
});
let sw = null;
cv.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY, t: performance.now(), done: false, id: e.pointerId }; });
cv.addEventListener('pointermove', e => {
  if (!sw || sw.done || sw.id !== e.pointerId) return;
  const dx = e.clientX - sw.x, dy = e.clientY - sw.y, th = Math.max(26, Math.min(innerWidth, innerHeight) * .06);
  if (Math.hypot(dx, dy) < th) return;
  sw.done = true; act(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'L' : 'R') : (dy < 0 ? 'U' : 'D'));
});
cv.addEventListener('pointerup', e => { if (sw && !sw.done && sw.id === e.pointerId && performance.now() - sw.t < 300) act('U'); sw = null; });
cv.addEventListener('pointercancel', () => { sw = null; });

// ---------- 画面 ----------
let shakeT = 0; const shake = v => { shakeT = Math.max(shakeT, v); };
let toastT = 0; function toast(t, ms = 1200) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms); }
let hintT = 0; function showHint(t) { const h = $('hint'); h.textContent = t; h.hidden = false; h.style.opacity = 1; clearTimeout(hintT); hintT = setTimeout(() => { h.style.opacity = 0; setTimeout(() => { h.hidden = true; }, 700); }, 3500); }
function hud() {
  $('sc').textContent = Math.floor(G.score).toLocaleString(); $('dist').textContent = `${Math.floor(G.dist).toLocaleString()}m`; $('dr').textContent = G.drops;
  $('x2').hidden = !(G.items.double > 0);
  const it = Object.entries(G.items).filter(([k, v]) => v > 0 || (k === 'shield' && v));
  const key = it.map(([k, v]) => k + Math.ceil(v * 4)).join();
  if ($('items').dataset.k !== key) {
    $('items').dataset.k = key;
    $('items').innerHTML = it.map(([k, v]) => `<div><b>${ITEM_E[k]}</b>${ITEMS[k].n}${ITEMS[k].t ? `<i><u style="width:${Math.max(0, v / ITEMS[k].t * 100)}%"></u></i>` : ''}</div>`).join('');
  }
}

// ================= 毎フレーム =================
let last = performance.now();
const camPos = new THREE.Vector3(0, 3.3, 6.2), camLook = new THREE.Vector3(0, 1.1, -8);
function frame(now) {
  let dt = Math.min(.05, (now - last) / 1000); last = now;
  if (G && !G.paused) { if (FAST > 1) for (let i = 0; i < FAST && G; i++) step(1 / 60); else step(dt); }
  idle(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
function step(dt) {
  if (G.over) { G.overT += dt; if (G.overT > 1.1 && !G.shown) { G.shown = true; showOver(); } upa.rotation.z += dt * 6 * Math.max(0, 1 - G.overT); return; }
  if (BOT) bot();
  const spd = speedAt(G.dist), d = spd * dt;
  G.t += dt; G.dist += d; G.score += d * (G.items.double > 0 ? 2 : 1);
  // 景色
  const bf = G.dist / 800; const bn = Math.floor(bf) % BIOMES.length;
  const name = applyBiome(bf); if (bn !== G.biome) { if (G.biome >= 0) toast(`${name}になった！`, 1300); G.biome = bn; }
  // 道と景色を流す
  roadTex.offset.y = (G.dist / 8) % 1;
  for (const p of props) { p.position.z += d; if (p.position.z > 12) p.position.z -= 34 * 7; }
  // プレイヤー：レーン移動
  P.laneT = Math.min(1, P.laneT + dt / .14);
  const lx = P.laneFrom + (P.lane - P.laneFrom) * easeOut(P.laneT);
  P.x = (lx - 1) * LANE_W;
  if (P.bonk > 0) { P.bonk -= dt; }
  // ジャンプ
  if (P.air) { P.vy -= (P.g || 30) * dt; P.y += P.vy * dt; if (P.y <= 0) { P.y = 0; P.vy = 0; P.air = false; P.fast = false; } }
  if (P.slide > 0) P.slide -= dt;
  // アイテムの時間
  for (const k in G.items) if (ITEMS[k].t && G.items[k] > 0) G.items[k] -= dt;
  // 物を動かして、当たりを調べる
  const mag = G.items.magnet > 0, h = P.slide > 0 ? .75 : 1.55, px = P.x;
  let di = 0;
  for (let i = G.ents.length - 1; i >= 0; i--) {
    const e = G.ents[i], z = e.z + G.dist; // 画面での z（0 がプレイヤー）
    if (e.kind === 'obst') {
      e.obj.position.set(laneX(e.lane), 0, z);
      const L = OBST[e.type].len;
      if (z - L / 2 > 3) { putObst(e.obj); G.ents.splice(i, 1); continue; }
      if (Math.abs(laneX(e.lane) - px) < LANE_W * .58 && z + L / 2 > -.4 && z - L / 2 < .4) {
        const O = OBST[e.type], y0 = O.h0 || 0, y1 = O.h;
        if (P.y < y1 && P.y + h > y0) { if (hit(e)) { G.ents.splice(i, 1); continue; } }
      }
    } else if (e.kind === 'coin') {
      let ex = laneX(e.lane), ey = e.y;
      if (mag && z > -14 && z < 2) { e.pull = Math.min(1, (e.pull || 0) + dt * 4); }
      if (e.pull) { ex += (px - ex) * e.pull; ey += (P.y + .8 - ey) * e.pull; }
      if (z > 3) { G.ents.splice(i, 1); continue; }
      if (Math.abs(ex - px) < .8 && Math.abs(z) < .7 + (e.pull ? .6 : 0) && ey > P.y - .3 && ey < P.y + h + .5) { G.drops++; G.score += 5 * (G.items.double > 0 ? 2 : 1); SND.drop(G.combo++); G.ents.splice(i, 1); continue; }
      if (di < DROPS && z > -150) { E0.set(0, G.t * 3 + e.z, 0); Q.setFromEuler(E0); M4.compose(V.set(ex, ey + Math.sin(G.t * 4 + e.z) * .08, z), Q, S1); dropMesh.setMatrixAt(di++, M4); }
    } else if (e.kind === 'item') {
      e.obj.position.set(laneX(e.lane), 1.1 + Math.sin(G.t * 3) * .15, z); e.obj.children[0].rotation.y = G.t * 3;
      if (z > 3) { scene.remove(e.obj); G.ents.splice(i, 1); continue; }
      if (Math.abs(laneX(e.lane) - px) < .9 && Math.abs(z) < .8 && P.y < 2.2) { getItem(e.type); scene.remove(e.obj); G.ents.splice(i, 1); continue; }
    }
  }
  for (let k = di; k < DROPS; k++) { M4.makeScale(0, 0, 0); dropMesh.setMatrixAt(k, M4); }
  dropMesh.instanceMatrix.needsUpdate = true;
  if (G.combo && !G.ents.some(e => e.kind === 'coin' && e.z + G.dist > -3 && e.z + G.dist < 1)) G.combo = 0;
  G.rows = G.rows.filter(r => r.z + G.dist < 4);
  if (G.gen.z > -(G.dist + 160)) spawn();
  // キャラの見た目
  upa.position.set(P.x, P.y, 0);
  const run = G.t * (spd * .9);
  body.rotation.x = P.slide > 0 ? -1.15 : P.air ? (P.vy > 0 ? .25 : -.15) : 0;
  body.position.y = P.slide > 0 ? -.35 : P.air ? 0 : Math.abs(Math.sin(run)) * .12;
  body.position.z = P.slide > 0 ? .2 : 0;
  body.rotation.z = (P.lane - lx) * .35 + (P.bonk > 0 ? Math.sin(P.bonk * 40) * .2 : 0);
  body.userData.legs.forEach((l, i) => { l.rotation.x = P.air ? -.8 : Math.sin(run * 1.0 + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * .9; });
  body.userData.tail.rotation.y = Math.sin(run * .5) * .4;
  upa.userData.bubble.visible = !!G.items.shield; upa.userData.bubble.scale.setScalar(1 + Math.sin(G.t * 6) * .03);
  shadow.position.x = P.x; shadow.scale.setScalar(Math.max(.4, 1 - P.y * .15));
  // カメラ
  const port = camera.aspect < .8;
  camPos.set(P.x * .55, (port ? 3.9 : 3.3) + P.y * .35, port ? 7.6 : 6.2); camLook.set(P.x * .7, 1.1 + P.y * .3, -8);
  camera.position.lerp(camPos, 1 - Math.pow(.0005, dt));
  camera.fov = (port ? 68 : 60) + Math.min(14, (spd - 11) * .55); camera.updateProjectionMatrix();
  if (shakeT > 0) { shakeT -= dt; camera.position.x += (Math.random() - .5) * shakeT; camera.position.y += (Math.random() - .5) * shakeT; }
  camera.lookAt(camLook);
  hud();
}
const easeOut = t => 1 - Math.pow(1 - t, 3);
function idle(t) {
  if (!G) upa.rotation.y = Math.PI + Math.sin(t * .8) * .5; // タイトルでは、こっちを向いてゆらゆら
  else if (!G.over) upa.rotation.y = 0; for (const g of body.userData.gills) g.scale.y = 1 + Math.sin(t * 6 + g.position.y * 9) * .12; if (SKINS[SV.skin]?.rainbow) mats.gill.color.setHSL((t * .2) % 1, .8, .6); }

function getItem(k) {
  SND.item(); toast(`${ITEM_E[k]} ${ITEMS[k].n}！`, 1000);
  if (k === 'shield') G.items.shield = 1; else G.items[k] = ITEMS[k].t;
}
// ぶつかった：あわバリアがあれば消える。true を返すと障害物を消す
function hit(e) {
  if (G.items.shield) { G.items.shield = 0; delete G.items.shield; SND.shield(); shake(.3); toast('バリアでセーフ！', 900); putObst(e.obj); return true; }
  // 低い柵は、かすっただけならセーフ（ジャンプが少し早い・遅い）
  G.over = true; G.overT = 0; G.cause = e.type; SND.crash(); shake(.6);
  G.dbg = { P: { lane: P.lane, x: +P.x.toFixed(2), y: +P.y.toFixed(2), vy: +P.vy.toFixed(1), slide: +P.slide.toFixed(2), air: P.air, laneT: +P.laneT.toFixed(2) }, spd: +speedAt(G.dist).toFixed(1), hit: { type: e.type, lane: e.lane, z: +(e.z + G.dist).toFixed(2) }, near: G.ents.filter(x => x.kind === 'obst' && x.z + G.dist > -25 && x.z + G.dist < 5).map(x => [x.type, x.lane, +(x.z + G.dist).toFixed(1)]), rows: G.rows.slice(0, 3).map(r => [r.lane, +(r.z + G.dist).toFixed(1), r.safe]) };
  if (navigator.vibrate) try { navigator.vibrate(120); } catch (x) {}
  return false;
}

// ---------- CPU（テスト用：ずっとよけ続ける） ----------
// 前にある物を見て、レーン移動・ジャンプ・スライディングを決める
function ahead(lane, z0, z1) { // レーン lane で、手前 z0 から奥 z1 までにある障害物（画面の z）
  return G.ents.filter(e => e.kind === 'obst' && e.lane === lane).map(e => { const L = OBST[e.type].len, z = e.z + G.dist; return { e, near: z + L / 2, far: z - L / 2 }; })
    .filter(o => o.near > z1 && o.far < z0).sort((a, b) => b.near - a.near);
}
function bot() {
  const spd = speedAt(G.dist);
  const r = G.rows.find(r => r.z + G.dist < -0.6); if (!r) return;
  const rz = r.z + G.dist;
  // 目標のレーンへ：あいだに壁がなければ移る
  if (r.lane !== P.lane && P.laneT >= 1) {
    const to = P.lane + (r.lane < P.lane ? -1 : 1);
    const wall = ahead(to, .9, rz + 1).some(o => o.e.type === 'block' || o.e.type === 'train') || ahead(to, 1.5, -spd * .3).length > 0;
    if (!wall && !blockedSide(to)) act(to < P.lane ? 'L' : 'R');
  }
  // 今のレーンの前にある物
  const lane = Math.round(P.x / LANE_W + 1);
  const o = ahead(lane, .5, -30)[0]; if (!o) return;
  const dz = -o.near, T = Math.min(.78, Math.max(.44, 11.5 / spd));
  if (o.e.type === 'low' && !P.air && dz < spd * T * .42 && dz > 0) act('U');
  if (o.e.type === 'bar' && P.slide <= .05 && dz < 1.2 + spd * .08 && dz > -0.3) act('D');
}

// ================= オンラインランキング =================
// GAMES（claude.ai）の共有データベースに、1人1行（自分のベスト）だけ書く。名前は GAMES のアカウント名
const NET = (() => {
  let db = null, uid = null, ready = null; let why = '';
  const COL = 'uparun';
  async function init() {
    for (let i = 0; i < 100 && !(window.claude && claude.use); i++) await new Promise(r => setTimeout(r, 100));
    if (!window.claude || !claude.use) { why = 'A'; return false; } // claude.ai の外
    try {
      const [d, u] = await Promise.all([claude.use('db'), claude.use('user')]);
      if (!d) { why = 'B'; return false; } if (!u) { why = 'C'; return false; }
      const id = await u.id(); if (!id) { why = 'D'; return false; }
      db = d; uid = id; return true;
    } catch (e) { why = 'E'; return false; }
  }
  // つながらなかったときは覚えておかず、次に呼ばれたらもう一度ためす（claude.ai の準備が遅いことがある）
  const on = async () => { if (db) return true; if (!ready) ready = init().then(ok => { if (!ok) ready = null; return ok; }); return ready; };
  // 名前：GAMES の名簿にあればそれ、なければこの端末のアカウント名
  async function myName() {
    try { const a = await db.doc('accounts/' + uid).get(); if (a.exists) return a.data().name; } catch (e) {}
    return (window.GAMES_ACC && GAMES_ACC.name()) || '';
  }
  // ありえない記録は表示しない（共有データは書きかえられる可能性がある）
  const sane = r => r && typeof r.name === 'string' && Number.isFinite(r.score) && Number.isFinite(r.dist) && r.score >= 0 && r.dist >= 0 && r.dist <= 2e6 && r.score <= r.dist * 2 + (r.drops || 0) * 10 + 50;
  const norm = s => (s || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const hex = s => Array.from(new TextEncoder().encode(s), b => b.toString(16).padStart(2, '0')).join('');
  return {
    on,
    // 名前を名簿にのせる（ゲーム一覧の「名前をつける」と同じ）。→ {ok, why}
    async claim(raw) {
      if (!(await on())) return { ok: false, why: 'つながっていません' };
      const name = (raw || '').normalize('NFKC').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10);
      if (!name) return { ok: false, why: '名前を入れてね' };
      if (!/^[\p{L}\p{N}_\-・ー〜!?！？☆★♪.]+$/u.test(name.replace(/\s/g, ''))) return { ok: false, why: '使えない記号が入っています' };
      const key = norm(name);
      const L = await db.doc('locks/' + hex(key)).acquire({ holder: uid, ttlMs: 8000 });
      if (!L.acquired) return { ok: false, why: 'いま同じ名前をだれかが登録中。少し待ってね' };
      const q = await db.collection('accounts').where('key', '==', key).get();
      if (q.docs.some(d => d.id !== uid)) return { ok: false, why: 'その名前はもう使われています' };
      await db.doc('accounts/' + uid).set({ name, key, at: Date.now() });
      try { localStorage.setItem('games-account', JSON.stringify({ name, key, shared: true })); } catch (e) {}
      return { ok: true, name };
    },
    async submit(run) { // → {ok, rank, best, why}
      if (!(await on())) return { ok: false, why: 'off' };
      const name = await myName(); if (!name) return { ok: false, why: 'noname' };
      const ref = db.doc(`${COL}/${uid}`);
      let prev = null; try { const g = await ref.get(); if (g.exists) prev = g.data(); } catch (e) {}
      const best = !prev || run.s > prev.score || prev.name !== name;
      if (best && (!prev || run.s >= prev.score)) await ref.set({ name: name.slice(0, 10), score: run.s, dist: run.d, drops: run.c, skin: SV.skin, at: Date.now() });
      else if (prev && prev.name !== name) await ref.update({ name: name.slice(0, 10) });
      const top = Math.max(run.s, prev ? prev.score : 0);
      const list = await this.list();
      const rank = list.findIndex(r => r.id === uid) + 1 || list.filter(r => r.score > top).length + 1;
      return { ok: true, rank, best: top, newBest: !prev || run.s > prev.score };
    },
    async list() {
      if (!(await on())) return null;
      const q = await db.collection(COL).orderBy('score', 'desc').limit(100).get();
      return q.docs.map(d => ({ id: d.id, ...d.data() })).filter(sane).slice(0, 50);
    },
    get uid() { return uid; }, get why() { return why; },
  };
})();
NET.on();

// ================= 画面の切りかえ =================
const SCR = ['title', 'help', 'shop', 'rank', 'paused', 'over'];
let stack = [];
function show(id) { for (const s of SCR) $(s).hidden = s !== id; if (id) stack.push(id); if (id === 'title') title(); }
document.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { stack.pop(); show(stack.pop() || 'title'); });
function title() {
  $('best').textContent = Math.floor(SV.best).toLocaleString(); $('bank').textContent = SV.bank.toLocaleString();
  $('sndBtn').textContent = `効果音：${SND.on ? 'オン' : 'オフ'}`;
  $('hud').hidden = true; $('pause').hidden = true;
}
function start() { show(null); stack = []; newRun(); }
function showOver() {
  const sc = Math.floor(G.score), rec = sc > SV.best;
  if (rec) SV.best = sc; SV.bank += G.drops;
  const who = (window.GAMES_ACC && GAMES_ACC.name && GAMES_ACC.name()) || '';
  SV.runs.push({ s: sc, d: Math.floor(G.dist), c: G.drops, at: new Date().toISOString().slice(0, 10), who }); SV.runs.sort((a, b) => b.s - a.s); SV.runs.length = Math.min(SV.runs.length, 10);
  save();
  $('oScore').textContent = sc.toLocaleString(); $('oDist').textContent = `${Math.floor(G.dist).toLocaleString()}m`; $('oDrop').textContent = G.drops; $('oBest').textContent = Math.floor(SV.best).toLocaleString();
  $('newRec').hidden = !rec; $('overTitle').textContent = rec ? 'ナイスラン！' : pick(['ドボン！', 'ゴツン！', 'あいたた…']);
  $('hud').hidden = true; $('pause').hidden = true;
  show('over');
  const el = $('oNet'); el.textContent = 'オンラインランキングに送っています…';
  NET.submit({ s: sc, d: Math.floor(G.dist), c: G.drops }).then(r => {
    if (!r.ok && r.why === 'noname') askName(el, { s: sc, d: Math.floor(G.dist), c: G.drops });
    else if (!r.ok) el.innerHTML = `オンラインランキングにつながらなかった（コード ${NET.why || '?'}）`;
    else el.innerHTML = `オンライン <b>${r.rank}位</b>${r.newBest ? '（自己ベスト更新！）' : `（自己ベスト ${r.best.toLocaleString()}）`}`;
  }).catch(e => { el.textContent = `ランキングに送れなかった（${String(e && e.message || e).slice(0, 60)}）`; });
}
const pick = a => a[Math.floor(Math.random() * a.length)];
// 名前を決めて、そのままランキングに送る（名前はゲーム一覧と共通）
function askName(el, run) {
  el.innerHTML = `ランキングにのせる名前を決めよう（ほかのゲームでも使われるよ）<form class="nameRow" id="nmForm"><input id="nmIn" maxlength="10" placeholder="なまえ" autocomplete="off"><button class="btn gold" type="submit">決定</button></form><div id="nmMsg" class="note"></div>`;
  const f = $('nmForm'); let busy = false;
  f.onsubmit = async e => {
    e.preventDefault(); if (busy) return; busy = true; $('nmMsg').textContent = 'たしかめ中…';
    try {
      const c = await NET.claim($('nmIn').value);
      if (!c.ok) { $('nmMsg').textContent = c.why; busy = false; return; }
      const r = await NET.submit(run);
      el.innerHTML = r.ok ? `「${esc(c.name)}」で登録したよ！ オンライン <b>${r.rank}位</b>` : 'ランキングに送れなかった';
    } catch (err) { $('nmMsg').textContent = '登録できなかった（' + String(err && err.message || err).slice(0, 40) + '）'; busy = false; }
  };
}
function togglePause() {
  if (!G || G.over) return;
  G.paused = !G.paused; show(G.paused ? 'paused' : null); if (!G.paused) stack = []; last = performance.now();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && G && !G.over && !G.paused) togglePause(); });
$('go').onclick = start; $('again').onclick = start;
$('toTitle').onclick = () => { clearRun(); G = null; show('title'); resetView(); };
$('quit').onclick = () => { clearRun(); G = null; show('title'); resetView(); };
$('resume').onclick = togglePause; $('pause').onclick = togglePause;
$('toHelp').onclick = () => show('help'); $('toRank').onclick = () => { renderRank(); show('rank'); };
document.querySelectorAll('#rankTabs button').forEach(b => b.onclick = () => { rankTab = b.dataset.t; renderRank(); }); $('toShop').onclick = () => { renderShop(); show('shop'); };
$('sndBtn').onclick = () => { SND.on = !SND.on; title(); };
let rankTab = 'all';
async function renderRank() {
  document.querySelectorAll('#rankTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === rankTab));
  if (rankTab === 'all') {
    $('rankList').innerHTML = '<p class="note" style="text-align:center">読みこみ中…</p>';
    let list = null; try { list = await Promise.race([NET.list(), new Promise(r => setTimeout(() => r('timeout'), 12000))]); } catch (e) { list = 'err'; NET.err = String(e && e.message || e); }
    if (rankTab !== 'all') return;
    if (list === null) { $('rankList').innerHTML = `<p class="note" style="text-align:center">オンラインランキングにつながらなかった（コード ${NET.why || '?'}）<br>claude.ai のゲーム置き場で開いたときだけ使えるよ</p>`; return; }
    if (!Array.isArray(list)) { $('rankList').innerHTML = `<p class="note" style="text-align:center">読みこめなかった（コード ${list === 'timeout' ? 'T' : 'X'}）。あとでもう一度ためしてね</p>`; return; }
    $('rankList').innerHTML = list.length ? list.map((r, i) => `<div class="${r.id === NET.uid ? 'me' : ''}"><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}位`}　${esc(r.name)} <small>${Math.floor(r.dist).toLocaleString()}m</small></span><b>${Math.floor(r.score).toLocaleString()}</b></div>`).join('') : '<p class="note" style="text-align:center">まだだれも記録がないよ。一番乗りしよう！</p>';
    return;
  }
  $('rankList').innerHTML = SV.runs.length ? SV.runs.map((r, i) => `<div><span>${i + 1}位　${r.at}${r.who ? '　' + esc(r.who) : ''}</span><b>${r.s.toLocaleString()}</b></div>`).join('') : '<p class="note" style="text-align:center">まだ記録がないよ。走ってみよう！</p>';
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderShop() {
  $('bank2').textContent = SV.bank.toLocaleString();
  $('skins').innerHTML = Object.entries(SKINS).map(([k, s]) => { const own = SV.skins.includes(k); return `<button data-k="${k}" class="${SV.skin === k ? 'on' : ''} ${own ? '' : 'lock'}"><span class="sw" style="background:${s.rainbow ? 'linear-gradient(135deg,#ff9ad0,#9ad0ff,#b0ff9a)' : s.body};--g:${s.gill}"></span>${s.n}<span>${own ? (SV.skin === k ? 'きている' : 'きる') : `💧${s.price}`}</span></button>`; }).join('');
  $('skins').querySelectorAll('button').forEach(b => b.onclick = () => {
    const k = b.dataset.k, s = SKINS[k];
    if (!SV.skins.includes(k)) { if (SV.bank < s.price) { toast('しずくが足りない…', 900); return; } SV.bank -= s.price; SV.skins.push(k); SND.item(); }
    SV.skin = k; setSkin(k); save(); renderShop();
  });
}
function resetView() {
  for (let k = 0; k < DROPS; k++) { M4.makeScale(0, 0, 0); dropMesh.setMatrixAt(k, M4); } dropMesh.instanceMatrix.needsUpdate = true;
  Object.assign(P, { lane: 1, x: 0, y: 0 }); upa.position.set(0, 0, 0); upa.rotation.set(0, 0, 0); body.rotation.set(0, 0, 0); body.position.set(0, 0, 0); shadow.position.x = 0;
  camera.position.set(0, 3.3, 6.2); camera.lookAt(0, 1.1, -8); applyBiome(1);
}

function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
resetView();
show('title');
$('loading').remove();
requestAnimationFrame(frame);
if (BOT) setTimeout(start, 300);
window.RUN = { get G() { return G; }, P, act, SV };
