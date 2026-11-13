// 月面おそうじ局 — 本体
import * as THREE from '../upa/vendor/three.module.min.js';
import * as W from './world.js';
const { HALF, TILE_M, TN, SECTORS, FINDS, height, sectorOf, sectorPrice, sectorCenter } = W;

const Q = new URLSearchParams(location.search);
const BOT = Q.has('bot'), FAST = Math.max(1, +Q.get('fast') || 1);
const KEY = 'tsuki-souji-v1';
const $ = id => document.getElementById(id);
const fmt$ = v => '$' + Math.floor(v).toLocaleString();
const fkg = v => v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.round(v).toLocaleString();

// ---------- データ ----------
const TOOLS = [
  { n: '歯ブラシ', ic: '🪥', w: 0.35, cap: 0.5, pw: 0.45, cost: 0, d: '局からの支給品。小さいけど心はこもっている' },
  { n: 'たわし', ic: '🧽', w: 0.5, cap: 0.8, pw: 0.55, cost: 5, d: 'ゴシゴシ。歯ブラシよりちょっと広い' },
  { n: '手ぼうき', ic: '🧹', w: 0.75, cap: 1.5, pw: 0.62, cost: 15, d: 'やっと「掃除」っぽくなってきた' },
  { n: '竹ぼうき', ic: '🎋', w: 1.05, cap: 3, pw: 0.7, cost: 40, d: '月面用に軽く作られた竹ぼうき' },
  { n: '自在ぼうき', ic: '🧹', w: 1.45, cap: 6, pw: 0.8, cost: 100, d: '幅広でよくとれる。プロの道具' },
  { n: '月面モップ', ic: '🪣', w: 2.0, cap: 12, pw: 0.9, cost: 220, d: '静電気でホコリを吸いよせるモップ' },
];
const CARS = [
  { n: '手押しスイーパー', ic: '🛒', w: 1.6, cap: 40, pw: 0.8, sp: 4.6, cost: 350, col: 0xffb43a, d: '押して歩くタイプ。タンク40kg' },
  { n: '乗用スイーパー', ic: '🛺', w: 2.2, cap: 150, pw: 0.85, sp: 6.2, cost: 1200, col: 0x4ad0ff, d: '座って運転。タンク150kg' },
  { n: '月面清掃車', ic: '🚛', w: 3.0, cap: 600, pw: 0.9, sp: 8, cost: 3200, col: 0x7ff0a8, d: 'ブラシ3m・タンク600kg' },
  { n: 'メガ吸引ローバー', ic: '🚀', w: 4.5, cap: 2000, pw: 0.95, sp: 9.5, cost: 8500, col: 0xff6a8a, d: '最強。吸いこみ幅4.5m・タンク2トン' },
];
const BOTS = [
  { n: 'おそうじロボ Mk1', ic: '🤖', w: 0.6, cap: 3, pw: 0.55, sp: 1.4, cost: 300, col: 0x9fb6c8, d: 'いる地区をのんびり自動でそうじ。満タンで近くの回収口へ' },
  { n: 'おそうじロボ Mk2', ic: '🤖', w: 1.0, cap: 10, pw: 0.7, sp: 2.1, cost: 900, col: 0x5cc8ff, d: 'Mk1より速くて広い' },
  { n: 'ルナボット', ic: '🦾', w: 2.0, cap: 40, pw: 0.85, sp: 3.2, cost: 4000, col: 0xffd23a, d: 'アーム付きの大型ロボ。どんどん稼ぐ' },
];
const MAXBOT = 12, MAXDEPOT = 8;
const UPS = {
  tank: { n: '圧縮タンク', ic: '🗜️', d: 'ゲージの容量 +25%', max: 5, cost: L => 40 * 2 ** L },
  belt: { n: 'カプセルベルト', ic: '🎒', d: '持てるカプセル +1', max: 5, cost: L => [30, 90, 240, 600, 1500][L] },
  wide: { n: 'ワイドヘッド', ic: '↔️', d: '掃く幅 +10%（車・ロボにも）', max: 5, cost: L => Math.round(60 * 1.9 ** L) },
  boots: { n: 'ムーンブーツ', ic: '🥾', d: '歩く・走る速さ +10%', max: 5, cost: L => Math.round(30 * 2 ** L) },
  auto: { n: 'オートパッカー', ic: '⚙️', d: 'ゲージが満タンになると自動でパック', max: 1, cost: () => 120 },
  appr: { n: 'ホコリ鑑定', ic: '🔍', d: 'ホコリの売値 +10%', max: 5, cost: L => Math.round(150 * 2.2 ** L) },
};
const depotCost = n => Math.round(100 * 1.6 ** n);
const GARAGE_COST = 200;
const INTAKE = { x: 0, z: 7 }, PAD = { x: 11, z: 4 };

const fresh = () => ({ v: 1, money: 0, tool: 0, tools: [0], up: { tank: 0, belt: 0, wide: 0, boots: 0, auto: 0, appr: 0 }, garage: false, cars: [], car: null, robots: [], depots: [], found: [], done: [], dust: '', p: { x: 0, z: 13, yaw: Math.PI }, g: { kg: 0, val: 0 }, caps: [], st: { kg: 0, earn: 0, time: 0, trips: 0 }, t: Date.now(), intro: false });
let S = fresh();
try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.v === 1) S = Object.assign(fresh(), o, { up: Object.assign(fresh().up, o.up || {}) }); } catch (e) {}
const D = W.makeDust();
if (S.dust) D.load(S.dust);

// 計算値
const gaugeCap = () => TOOLS[S.tool].cap * (1 + 0.25 * S.up.tank);
const slots = () => 1 + S.up.belt;
const wideK = () => 1 + 0.1 * S.up.wide;
const priceK = () => 1 + 0.1 * S.up.appr;
const walkSp = () => 4 * (1 + 0.1 * S.up.boots);

// ---------- 画面 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, BOT ? 1 : 1.6));
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000004);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000);
const SUN = new THREE.Vector3(0.55, 0.62, 0.35).normalize();
scene.add(new THREE.AmbientLight(0x8090b0, 0.55));
const sunL = new THREE.DirectionalLight(0xfff4e0, 2.4); sunL.position.copy(SUN).multiplyScalar(100); scene.add(sunL);
const hemi = new THREE.HemisphereLight(0x8899ff, 0x332a22, 0.35); scene.add(hemi);
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// 星・地球・太陽
{
  const n = 1800, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = 1500; const s = Math.sqrt(1 - u * u); p[i * 3] = Math.cos(a) * s * r; p[i * 3 + 1] = Math.abs(u) * r * 0.9 + 30; p[i * 3 + 2] = Math.sin(a) * s * r; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85 })));
  const ec = document.createElement('canvas'); ec.width = 256; ec.height = 128; const x = ec.getContext('2d');
  x.fillStyle = '#1f5fc8'; x.fillRect(0, 0, 256, 128);
  for (let i = 0; i < 26; i++) { x.fillStyle = i % 3 ? '#3f9a4a' : '#c8b070'; x.beginPath(); x.ellipse(Math.random() * 256, 20 + Math.random() * 88, 8 + Math.random() * 24, 5 + Math.random() * 14, Math.random() * 3, 0, 7); x.fill(); }
  x.fillStyle = 'rgba(255,255,255,.75)'; for (let i = 0; i < 40; i++) { x.beginPath(); x.ellipse(Math.random() * 256, Math.random() * 128, 6 + Math.random() * 22, 2 + Math.random() * 4, 0, 0, 7); x.fill(); }
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 8); x.fillRect(0, 120, 256, 8);
  const et = new THREE.CanvasTexture(ec); et.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(60, 40, 24), new THREE.MeshStandardMaterial({ map: et, roughness: 0.8, emissive: 0x112244, emissiveIntensity: 0.3 }));
  earth.position.set(-700, 380, -900); earth.rotation.z = 0.4; scene.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(64, 32, 20), new THREE.MeshBasicMaterial({ color: 0x66aaff, transparent: true, opacity: 0.18, side: THREE.BackSide }));
  atm.position.copy(earth.position); scene.add(atm);
  const sc = document.createElement('canvas'); sc.width = sc.height = 128; const s = sc.getContext('2d');
  const gr = s.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.15, 'rgba(255,250,220,.9)'); gr.addColorStop(0.4, 'rgba(255,220,160,.2)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); s.fillStyle = gr; s.fillRect(0, 0, 128, 128);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), depthWrite: false, transparent: true }));
  sun.position.copy(SUN).multiplyScalar(1400); sun.scale.set(260, 260, 1); scene.add(sun);
}

// 地面（16地区）
const GROUND_VS = `varying vec3 vN; varying vec3 vW; void main(){ vN = normal; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const GROUND_FS = `
uniform sampler2D dust; uniform vec2 org; uniform vec3 sun; uniform float outer; uniform float hl;
varying vec3 vN; varying vec3 vW;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
void main(){
  float d = outer > 0.5 ? 0.62 : texture2D(dust, (vW.xz - org) / ${TILE_M.toFixed(1)}).r;
  float g = vn(vW.xz * 3.0) * 0.5 + vn(vW.xz * 11.0) * 0.3 + vn(vW.xz * 0.6) * 0.2;
  vec3 cl = mix(vec3(0.23, 0.24, 0.27), vec3(0.36, 0.37, 0.41), g);
  float sp = step(0.988, hash(floor(vW.xz * 13.0))) * (1.0 - smoothstep(0.04, 0.18, d));
  vec3 dc = mix(vec3(0.66, 0.63, 0.57), vec3(0.85, 0.82, 0.75), vn(vW.xz * 4.0 + 3.0) * 0.7 + vn(vW.xz * 20.0) * 0.3);
  float a = smoothstep(0.02, 0.42, d);
  vec3 col = mix(cl, dc, a);
  float l = max(dot(normalize(vN), sun), 0.0) * 1.05 + 0.16;
  col = col * l + sp * vec3(0.5, 0.75, 1.0);
  col += hl * vec3(0.03, 0.06, 0.1) * (1.0 - a);
  gl_FragColor = vec4(col, 1.0);
}`;
const texs = [], tileMat = [];
for (let t = 0; t < 16; t++) {
  const ox = -HALF + (t % 4) * TILE_M, oz = -HALF + ((t / 4) | 0) * TILE_M;
  const g = new THREE.PlaneGeometry(TILE_M, TILE_M, 80, 80); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + ox + TILE_M / 2, z = p.getZ(i) + oz + TILE_M / 2; p.setXYZ(i, x, height(x, z), z); }
  g.computeVertexNormals(); g.computeBoundingSphere();
  const tx = new THREE.DataTexture(D.tex[t], TN, TN, THREE.RedFormat, THREE.UnsignedByteType);
  tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearFilter; tx.wrapS = tx.wrapT = THREE.ClampToEdgeWrapping; tx.unpackAlignment = 1; tx.needsUpdate = true;
  const m = new THREE.ShaderMaterial({ uniforms: { dust: { value: tx }, org: { value: new THREE.Vector2(ox, oz) }, sun: { value: SUN }, outer: { value: 0 }, hl: { value: 0 } }, vertexShader: GROUND_VS, fragmentShader: GROUND_FS });
  scene.add(new THREE.Mesh(g, m)); texs.push(tx); tileMat.push(m);
}
// エリアの外（ホコリだらけの平原）
{
  const m = new THREE.ShaderMaterial({ uniforms: { dust: { value: null }, org: { value: new THREE.Vector2() }, sun: { value: SUN }, outer: { value: 1 }, hl: { value: 0 } }, vertexShader: GROUND_VS, fragmentShader: GROUND_FS });
  const F = 1400;
  for (const [cx, cz, w, h] of [[0, -(HALF + F) / 2, F * 2 + SIZE2(), F], [0, (HALF + F) / 2, F * 2 + SIZE2(), F], [-(HALF + F) / 2, 0, F, SIZE2()], [(HALF + F) / 2, 0, F, SIZE2()]]) {
    const g = new THREE.PlaneGeometry(w, h, 40, 40); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz; const e = Math.max(Math.abs(x), Math.abs(z)) - HALF; p.setXYZ(i, x, e <= 0.5 ? 0 : (W.noise(x * 0.02, z * 0.02) * 14 + W.noise(x * 0.07, z * 0.07) * 3) * Math.min(1, e / 120), z); }
    g.computeVertexNormals(); scene.add(new THREE.Mesh(g, m));
  }
  // 境界のポール
  const pm = new THREE.MeshStandardMaterial({ color: 0xdddddd }), lm = new THREE.MeshBasicMaterial({ color: 0xff9a3c });
  const pg = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), lg = new THREE.SphereGeometry(0.12, 8, 6);
  for (let s = -HALF; s <= HALF; s += 16) for (const [x, z] of [[s, -HALF], [s, HALF], [-HALF, s], [HALF, s]]) { const a = new THREE.Mesh(pg, pm); a.position.set(x, 0.7, z); scene.add(a); const b = new THREE.Mesh(lg, lm); b.position.set(x, 1.45, z); scene.add(b); }
}
function SIZE2() { return HALF * 2; }

// 文字のスプライト
function label(text, opt = {}) {
  const c = document.createElement('canvas'); const fs = 56; const x = c.getContext('2d'); x.font = `900 ${fs}px "M PLUS Rounded 1c", sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + 40; c.width = w; c.height = fs + 30;
  x.font = `900 ${fs}px "M PLUS Rounded 1c", sans-serif`; x.fillStyle = opt.bg || 'rgba(0,0,0,.6)'; x.beginPath(); x.roundRect(0, 0, w, c.height, 20); x.fill();
  x.fillStyle = opt.color || '#fff'; x.textBaseline = 'middle'; x.fillText(text, 20, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); const k = (opt.size || 0.6) / c.height; s.scale.set(w * k, c.height * k, 1); return s;
}
const emojiTex = {};
function emojiSprite(e, size = 1) {
  if (!emojiTex[e]) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,160,.9)'); g.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.font = '72px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 64, 70); emojiTex[e] = new THREE.CanvasTexture(c); emojiTex[e].colorSpace = THREE.SRGBColorSpace; }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex[e], depthWrite: false, transparent: true })); s.scale.set(size, size, 1); return s;
}
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.6, metalness: 0.1 }, o));

// 基地
const ringMat = c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85 });
function ringMesh(r, c) { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 8, 40), ringMat(c)); t.rotation.x = Math.PI / 2; t.position.y = 0.08; g.add(t); const d = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.16, depthWrite: false })); d.rotation.x = -Math.PI / 2; d.position.y = 0.05; g.add(d); const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2.4, 40, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })); col.position.y = 1.2; g.add(col); return g; }
{
  const base = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf2f2f0, { roughness: 0.4 })); dome.position.set(0, 0, -4); base.add(dome);
  for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(5.02, 0.06, 6, 32, Math.PI), std(0xb8c0c8)); r.position.set(0, 0, -4); r.rotation.y = i / 8 * Math.PI; base.add(r); }
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 1.6), std(0xdadada)); door.position.set(0, 1.3, 0.6); base.add(door);
  const dw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2, 0.05), std(0x223344, { emissive: 0x3a6aa0, emissiveIntensity: 0.6 })); dw.position.set(0, 1.1, 1.42); base.add(dw);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 6), std(0xcccccc)); ant.position.set(-3, 7, -6); base.add(ant);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 8, 0, Math.PI * 2, 0, 1.0), std(0xeeeeee, { side: THREE.DoubleSide })); dish.position.set(-3, 9.6, -6); dish.rotation.x = -0.9; base.add(dish);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3030 })); blink.position.set(-3, 10.1, -6); base.add(blink); base.userData.blink = blink;
  for (let i = 0; i < 3; i++) { const pan = new THREE.Mesh(new THREE.BoxGeometry(3, 0.08, 1.6), std(0x1a2a6a, { metalness: 0.6, roughness: 0.3, emissive: 0x0a1a40 })); pan.position.set(-9 - i * 3.4, 1.5, -3); pan.rotation.x = -0.5; base.add(pan); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5), std(0x999999)); leg.position.set(-9 - i * 3.4, 0.75, -3); base.add(leg); }
  // 回収口
  const intake = ringMesh(3, 0xff9a3c); intake.position.set(INTAKE.x, 0, INTAKE.z); base.add(intake);
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 1.2, 16, 1, true), std(0x666a70, { side: THREE.DoubleSide, metalness: 0.5 })); hop.position.set(INTAKE.x, 0.6, INTAKE.z); base.add(hop);
  const sign = label('回収口（ここで売る）', { color: '#ffd9a0', size: 0.42 }); sign.position.set(INTAKE.x, 3.8, INTAKE.z); base.add(sign);
  const sign2 = label('月面管理局 LSD 清掃課', { color: '#fff', size: 0.7 }); sign2.position.set(0, 6.6, -4); base.add(sign2);
  scene.add(base); scene.userData.base = base;
}
// ガレージ
const garage = new THREE.Group();
{
  const b = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 7), std(0xd8dde2)); b.position.set(PAD.x + 1, 2, PAD.z - 8); garage.add(b);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 8.2, 20, 1, false, 0, Math.PI), std(0xb8c0c8)); roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 0.45); roof.position.set(PAD.x + 1, 4, PAD.z - 8); garage.add(roof);
  const dr = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 0.1), std(0x55606a)); dr.position.set(PAD.x + 1, 1.6, PAD.z - 4.45); garage.add(dr);
  const pad = ringMesh(2.6, 0x7ff0a8); pad.position.set(PAD.x, 0, PAD.z); garage.add(pad);
  const s = label('ガレージ', { color: '#bfffd6', size: 0.6 }); s.position.set(PAD.x + 1, 5.2, PAD.z - 4.4); garage.add(s);
}
scene.add(garage);
const garageSign = label('ガレージ予定地（ショップで建設）', { color: '#ccc', size: 0.45 }); garageSign.position.set(PAD.x, 1.4, PAD.z - 4); scene.add(garageSign);

// 集積所
const depotMeshes = [];
function addDepotMesh(d) {
  const g = new THREE.Group(); g.add(ringMesh(2.2, 0x5cc8ff));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 3.2), std(0xdddddd)); pole.position.y = 1.6; g.add(pole);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), std(0x3a7ab0, { metalness: 0.4 })); box.position.set(0.9, 0.45, 0.9); g.add(box);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0x5cc8ff })); lamp.position.y = 3.3; g.add(lamp);
  g.position.set(d.x, height(d.x, d.z), d.z); scene.add(g); depotMeshes.push(g);
}
S.depots.forEach(addDepotMesh);

// 宇宙飛行士（清掃員）
const P = { x: S.p.x, z: S.p.z, y: 0, vy: 0, yaw: S.p.yaw, sp: 0, brush: true, pack: 0, inCar: false, anim: 0 };
const pl = new THREE.Group();
const suit = std(0xf4f4f2, { roughness: 0.75 }), orange = std(0xff8a2a), dark = std(0x30343a);
{
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 12), suit); body.position.y = 0.95; pl.add(body);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.09, 16), orange); belt.position.y = 0.82; pl.add(belt);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), suit); head.position.y = 1.58; pl.add(head);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.255, 20, 14, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.28, Math.PI * 0.42), std(0x2a2410, { metalness: 0.9, roughness: 0.15, emissive: 0x3a2a08 })); visor.position.set(0, 1.58, 0.06); visor.rotation.y = 0; visor.scale.set(1.06, 1.06, 1.06); pl.add(visor);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.26), std(0xdedede)); pack.position.set(0, 1.05, -0.36); pl.add(pack);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.27), orange); stripe.position.set(0, 1.2, -0.36); pl.add(stripe);
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 4, 8), suit); leg.position.set(s * 0.15, 0.32, 0); leg.name = 'leg' + s; pl.add(leg);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), dark); boot.position.set(s * 0.15, 0.07, 0.04); boot.name = 'boot' + s; pl.add(boot);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.38, 4, 8), suit); arm.position.set(s * 0.4, 1.05, 0.15); arm.rotation.x = -0.9; pl.add(arm);
  }
  const lsd = label('LSD', { bg: 'rgba(255,138,42,.95)', color: '#fff', size: 0.13 }); lsd.position.set(0, 1.12, 0.34); pl.add(lsd);
}
const toolG = new THREE.Group(); toolG.position.set(0, 0, 0.55); pl.add(toolG);
const capG = new THREE.Group(); capG.position.set(0, 1.0, -0.6); pl.add(capG);
function buildTool() {
  toolG.clear(); const T = TOOLS[S.tool], w = T.w * wideK();
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, S.tool === 0 ? 0.5 : 1.3), std(S.tool === 3 ? 0xc8b060 : 0x8a6a40)); stick.rotation.x = 0.7; stick.position.set(0, S.tool === 0 ? 0.65 : 0.55, -0.12); toolG.add(stick);
  const head = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, 0.14), std([0x4ad0ff, 0xffd23a, 0xc8a060, 0xd8c070, 0xff6a3a, 0x7ff0a8][S.tool])); head.position.set(0, 0.06, 0.16); toolG.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.07, 0.1), std(0xffffff)); hair.position.set(0, 0.01, 0.16); toolG.add(hair);
}
const capGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.3, 12), capMat = std(0xe8eef4, { metalness: 0.5, roughness: 0.3 });
function buildCaps() { capG.clear(); S.caps.forEach((c, i) => { const m = new THREE.Mesh(capGeo, capMat); m.position.set((i % 3 - 1) * 0.24, Math.floor(i / 3) * 0.34, 0); capG.add(m); }); }
buildTool(); buildCaps(); scene.add(pl);
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function blob(r) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; scene.add(m); return m; }
const plShadow = blob(0.6);

// 車
let carMesh = null;
function makeCarMesh(k) {
  const C = CARS[k], g = new THREE.Group(), s = [0.75, 1, 1.25, 1.6][k];
  const body = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.8, 0.7 * s, 2.2 * s), std(C.col, { metalness: 0.3 })); body.position.y = 0.75 * s; g.add(body);
  if (k > 0) { const cab = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.5, 0.7 * s, 1 * s), std(0x223344, { metalness: 0.7, roughness: 0.2, emissive: 0x112233 })); cab.position.set(0, 1.4 * s, -0.2 * s); g.add(cab); }
  else { const h = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 6, 16, Math.PI), std(0x444444)); h.position.set(0, 1.3, -1.3); h.rotation.x = -0.3; g.add(h); }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.4 * s, 0.4 * s, C.w * 0.7, 14), std(0xe8eef4, { metalness: 0.6, roughness: 0.3 })); tank.rotation.z = Math.PI / 2; tank.position.set(0, 1.25 * s, -0.95 * s); g.add(tank);
  const wg = new THREE.CylinderGeometry(0.35 * s, 0.35 * s, 0.25 * s, 14); wg.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1, -0.7], [1, -0.7], [-1, 0.6], [1, 0.6]]) { const w = new THREE.Mesh(wg, dark); w.position.set(x * C.w * 0.42, 0.35 * s, z * s); g.add(w); }
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.22 * s, C.w, 16), std(0xffd23a)); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.22 * s, 1.3 * s); roll.name = 'roll'; g.add(roll);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12 * s, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffa030 })); lamp.position.set(0, 1.9 * s, -0.2 * s); lamp.name = 'lamp'; g.add(lamp);
  g.userData.k = k; return g;
}
const carShadow = blob(2.4); carShadow.visible = false;
function placeCar() {
  if (carMesh) { scene.remove(carMesh); carMesh = null; }
  if (!S.car) { carShadow.visible = false; return; }
  carMesh = makeCarMesh(S.car.k); scene.add(carMesh); carShadow.visible = true; carShadow.scale.setScalar(CARS[S.car.k].w / 2.4 + 0.4);
}
placeCar();

// ロボ
const robotMeshes = [];
function makeRobotMesh(k) {
  const B = BOTS[k], g = new THREE.Group(), s = [0.5, 0.7, 1.1][k];
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.6 * s, 0.3 * s, 20), std(B.col, { metalness: 0.4, roughness: 0.4 })); body.position.y = 0.2 * s; g.add(body);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0x223344, { metalness: 0.7, roughness: 0.2, emissive: 0x113355 })); top.position.y = 0.35 * s; g.add(top);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 8, 6), new THREE.MeshBasicMaterial({ color: 0x7ff0a8 })); eye.position.set(0, 0.32 * s, 0.5 * s); eye.name = 'eye'; g.add(eye);
  const br = new THREE.Mesh(new THREE.BoxGeometry(B.w, 0.06, 0.12), std(0xffffff)); br.position.set(0, 0.04, 0.55 * s); g.add(br);
  if (k === 2) for (const sd of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.6, 4, 6), std(0xaaaaaa)); a.position.set(sd * 0.6, 0.7, 0.2); a.rotation.z = sd * 0.6; g.add(a); }
  const sh = blob(0.7 * s); scene.remove(sh); sh.position.y = 0.03; g.add(sh);
  scene.add(g); return g;
}
function syncRobotMeshes() { while (robotMeshes.length > S.robots.length) scene.remove(robotMeshes.pop()); S.robots.forEach((r, i) => { if (!robotMeshes[i] || robotMeshes[i].userData.k !== r.k) { if (robotMeshes[i]) scene.remove(robotMeshes[i]); robotMeshes[i] = makeRobotMesh(r.k); robotMeshes[i].userData.k = r.k; } }); }
syncRobotMeshes();

// 落とし物
const findMeshes = {};
function syncFinds() { for (const f of FINDS) { const show = !S.found.includes(f.id) && revealed(f); if (show && !findMeshes[f.id]) { const s = emojiSprite(f.ic, 1.1); s.position.set(f.x, height(f.x, f.z) + 0.8, f.z); scene.add(s); findMeshes[f.id] = s; } if (!show && findMeshes[f.id]) { scene.remove(findMeshes[f.id]); delete findMeshes[f.id]; } } }
function revealed(f) { let s = 0; for (const [a, b] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) s += D.at(f.x + a, f.z + b); return s / 5 < 40; }

// ホコリのつぶ
const PN = 400, pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN); let pI = 0;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xd8d0c0, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -99;
function puff(x, y, z, n, spread) { for (let j = 0; j < n; j++) { const i = pI = (pI + 1) % PN; pPos[i * 3] = x + (Math.random() - 0.5) * spread; pPos[i * 3 + 1] = y + 0.05; pPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3; pVel[i * 3] = (Math.random() - 0.5) * 0.8; pVel[i * 3 + 1] = 0.6 + Math.random() * 1.2; pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.8; pLife[i] = 1.5 + Math.random(); } }
function stepParticles(dt) { for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; pVel[i * 3 + 1] -= 1.62 * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; if (pLife[i] <= 0 || pPos[i * 3 + 1] < height(pPos[i * 3], pPos[i * 3 + 2]) - 0.1) { pLife[i] = 0; pPos[i * 3 + 1] = -99; } } pGeo.attributes.position.needsUpdate = true; }

// ---------- 入力 ----------
const keys = {}; const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
let camYaw = S.p.yaw, camPitch = 0.42, camDist = 6, camDrag = null;
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; keys[e.code] = true; if (!playing || anyOpen()) { if (e.code === 'Escape') closeAll(); return; } if (e.code === 'KeyQ') doPack(); if (e.code === 'KeyF') toggleBrush(); if (e.code === 'KeyE') doRide(); if (e.code === 'KeyM') openMap(); if (e.code === 'KeyB') openShop(); if (e.code === 'Space') { jump(); e.preventDefault(); } });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('pointerdown', e => {
  if (!playing) return;
  if (e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && stick.id == null) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; const s = $('stick'); s.hidden = false; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.firstChild.style.transform = ''; }
  else if (!camDrag) camDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) { let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } stick.x = dx / m; stick.y = dy / m; $('stick').firstChild.style.transform = `translate(${dx}px,${dy}px)`; }
  else if (camDrag && e.pointerId === camDrag.id) { camYaw -= (e.clientX - camDrag.x) * 0.006; camPitch = Math.max(0.12, Math.min(1.25, camPitch + (e.clientY - camDrag.y) * 0.004)); camDrag.x = e.clientX; camDrag.y = e.clientY; }
});
const endPtr = e => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; $('stick').hidden = true; } if (camDrag && e.pointerId === camDrag.id) camDrag = null; };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { camDist = Math.max(3, Math.min(40, camDist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });
const tap = (id, f) => $(id).addEventListener('click', e => { e.stopPropagation(); f(); });
tap('bPack', () => doPack()); tap('bBrush', () => toggleBrush()); tap('bRide', () => doRide()); tap('bJump', () => jump());
tap('bMap', () => openMap()); tap('bShop', () => openShop()); tap('bMenu', () => openMenu());
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeAll());
document.querySelectorAll('.scr').forEach(s => s.addEventListener('click', e => { if (e.target === s && s.id !== 'title' && s.id !== 'talk') closeAll(); }));
const anyOpen = () => ['shop', 'map', 'menu', 'talk'].some(id => !$(id).hidden);
function closeAll() { for (const id of ['shop', 'map', 'menu']) $(id).hidden = true; }

// ---------- 表示 ----------
let toastT = 0;
function toast(t, ms = 1600) { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('on'), ms); }
function log(t) { const el = $('log'); const d = document.createElement('div'); d.textContent = t; el.appendChild(d); setTimeout(() => d.remove(), 4000); while (el.children.length > 5) el.firstChild.remove(); }
function talk(text, cb) { $('talkTxt').innerHTML = text; $('talk').hidden = false; $('talkOk').onclick = () => { $('talk').hidden = true; cb && cb(); }; }

// ---------- アクション ----------
function totalCarry() { return S.g.kg + S.caps.reduce((a, c) => a + c.kg, 0); }
function doPack() {
  if (P.inCar) return;
  if (S.g.kg < 0.01) return toast('ゲージがからっぽ');
  if (S.caps.length >= slots()) return toast('カプセルがいっぱい！\n回収口へ運ぼう');
  if (P.pack > 0) return;
  P.pack = 0.7;
}
function finishPack() { S.caps.push({ kg: S.g.kg, val: S.g.val }); S.g = { kg: 0, val: 0 }; buildCaps(); puff(P.x, P.y + 0.8, P.z, 8, 0.4); }
function toggleBrush() { if (P.inCar) return; P.brush = !P.brush; toast(P.brush ? 'ブラシ：おろした' : 'ブラシ：あげた（はやく歩ける）', 900); }
function jump() { if (P.inCar || P.y > height(P.x, P.z) + 0.05) return; P.vy = 2.6; }
function nearCar() { return S.car && Math.hypot(S.car.x - P.x, S.car.z - P.z) < 3.2 + CARS[S.car.k].w * 0.3; }
function doRide() {
  if (P.inCar) { P.inCar = false; const a = S.car.yaw + Math.PI / 2; P.x = S.car.x + Math.sin(a) * (CARS[S.car.k].w * 0.5 + 0.8); P.z = S.car.z + Math.cos(a) * (CARS[S.car.k].w * 0.5 + 0.8); camDist = 6; toast('おりた', 700); save(); return; }
  if (nearCar()) { P.inCar = true; camDist = 9 + S.car.k * 3; toast(CARS[S.car.k].n + ' に乗った！', 1000); }
}
function sellAll(where) {
  let kg = S.g.kg, val = S.g.val; for (const c of S.caps) { kg += c.kg; val += c.val; }
  if (P.inCar && S.car) { kg += S.car.kg; val += S.car.val; S.car.kg = 0; S.car.val = 0; }
  if (kg < 0.005) return;
  const m = val * priceK(); S.money += m; S.st.kg += kg; S.st.earn += m; S.st.trips++;
  S.g = { kg: 0, val: 0 }; S.caps = []; buildCaps();
  toast(`${fkg(kg)}kg 売れた！\n+${fmt$(m)}`, 1800); log(`${where}で ${fkg(kg)}kg → ${fmt$(m)}`); save();
}
function depots() { const a = [{ x: INTAKE.x, z: INTAKE.z, r: 3, main: true }]; for (const d of S.depots) a.push({ x: d.x, z: d.z, r: 2.2 }); return a; }
function nearestDepot(x, z) { let best = null, bd = 1e9; for (const d of depots()) { const l = Math.hypot(d.x - x, d.z - z); if (l < bd) { bd = l; best = d; } } return [best, bd]; }

// ---------- 掃除 ----------
const secKg = new Float64Array(16);
function sweepAt(x, z, yaw, w, depth, rate, dt, room) {
  secKg.fill(0);
  const got = D.sweep(x, z, Math.sin(yaw), Math.cos(yaw), w, depth, rate, dt, secKg);
  if (got <= 0) return [0, 0];
  let k = Math.min(1, room / got), val = 0; for (let t = 0; t < 16; t++) if (secKg[t]) val += secKg[t] * k * sectorPrice(t);
  return [got * k, val];
}

// ---------- 更新 ----------
let playing = false, saveT = 0, upT = 0, findT = 0, hudT = 0, botT = 0, tAll = 0;
function update(dt) {
  tAll += dt; S.st.time += dt;
  // 入力ベクトル（カメラ基準）
  let ix = 0, iz = 0;
  if (keys.KeyW || keys.ArrowUp) iz -= 1; if (keys.KeyS || keys.ArrowDown) iz += 1; if (keys.KeyA || keys.ArrowLeft) ix -= 1; if (keys.KeyD || keys.ArrowRight) ix += 1;
  ix += stick.x; iz += stick.y;
  if (BOT) [ix, iz] = botInput(dt);
  const il = Math.hypot(ix, iz); if (il > 1) { ix /= il; iz /= il; }
  const cy = camYaw; const mx = -ix * Math.cos(cy) - iz * Math.sin(cy), mz = ix * Math.sin(cy) - iz * Math.cos(cy);
  const mag = Math.min(1, Math.hypot(mx, mz));

  if (P.inCar && S.car) {
    const C = CARS[S.car.k], c = S.car;
    if (mag > 0.1) { const ty = Math.atan2(mx, mz); let d = ty - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); c.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * (2.4 - S.car.k * 0.3)); }
    const tsp = mag > 0.1 ? C.sp * mag * (0.55 + 0.45 * Math.max(0, Math.cos(Math.atan2(mx, mz) - c.yaw))) : 0;
    P.sp += (tsp - P.sp) * Math.min(1, dt * 2.5);
    c.x = clampA(c.x + Math.sin(c.yaw) * P.sp * dt); c.z = clampA(c.z + Math.cos(c.yaw) * P.sp * dt);
    const w = C.w * wideK(), fx = c.x + Math.sin(c.yaw) * (1.2 + S.car.k * 0.4), fz = c.z + Math.cos(c.yaw) * (1.2 + S.car.k * 0.4);
    const room = C.cap - c.kg;
    if (room > 0.001 && P.sp > 0.3) { const [kg, val] = sweepAt(fx, fz, c.yaw, w, 1.0, C.pw * 8, dt, room); c.kg += kg; c.val += val; if (kg > 0 && Math.random() < 0.6) puff(fx, height(fx, fz), fz, 2 + S.car.k, w); }
    P.x = c.x; P.z = c.z; P.y = height(c.x, c.z);
    const [dd, dl] = nearestDepot(c.x, c.z); if (dl < dd.r + C.w * 0.4 && c.kg > 0.01) sellAll(dd.main ? '回収口' : '集積所');
  } else {
    let sp = walkSp() * (P.brush ? 0.72 : 1.25) * mag; if (P.pack > 0) sp *= 0.3;
    const tx = mx * sp, tz = mz * sp;
    P.vx = (P.vx || 0) + (tx - (P.vx || 0)) * Math.min(1, dt * 8); P.vz = (P.vz || 0) + (tz - (P.vz || 0)) * Math.min(1, dt * 8);
    P.x = clampA(P.x + P.vx * dt); P.z = clampA(P.z + P.vz * dt);
    const v = Math.hypot(P.vx, P.vz); P.sp = v;
    if (v > 0.2) { let d = Math.atan2(P.vx, P.vz) - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * Math.min(1, dt * 10); }
    const gh = height(P.x, P.z); P.vy -= 1.62 * dt; P.y += P.vy * dt; if (P.y <= gh) { P.y = gh; P.vy = 0; }
    // 掃く
    const T = TOOLS[S.tool], cap = gaugeCap(); const room = cap - S.g.kg;
    if (P.brush && P.pack <= 0 && P.y < gh + 0.1 && room > 0.0005) {
      const w = T.w * wideK(), fx = P.x + Math.sin(P.yaw) * 0.72, fz = P.z + Math.cos(P.yaw) * 0.72;
      const [kg, val] = sweepAt(fx, fz, P.yaw, w, 0.3 + w * 0.25, T.pw * 8 * (v > 0.2 ? 1 : 0.6), dt, room);
      S.g.kg += kg; S.g.val += val; if (kg > 0 && Math.random() < 0.35) puff(fx, gh, fz, 1 + S.tool, w);
      if (S.up.auto && S.g.kg >= cap - 0.0005 && S.caps.length < slots() && P.pack <= 0) P.pack = 0.7;
    }
    if (P.pack > 0) { P.pack -= dt; if (P.pack <= 0) finishPack(); }
    const [dd, dl] = nearestDepot(P.x, P.z); if (dl < dd.r && totalCarry() > 0.005) sellAll(dd.main ? '回収口' : '集積所');
    // 落とし物を拾う
    for (const id in findMeshes) { const f = FINDS[id]; if (Math.hypot(f.x - P.x, f.z - P.z) < 1.4) { S.found.push(f.id); S.money += f.val; S.st.earn += f.val; toast(`${f.ic} ${f.name} を見つけた！\n報奨金 +${fmt$(f.val)}`, 2600); log(`${f.ic} 落とし物「${f.name}」+${fmt$(f.val)}`); syncFinds(); save(); } }
  }
  // ロボ
  for (let i = 0; i < S.robots.length; i++) robotStep(S.robots[i], dt);
  // 地区クリア
  upT += dt; if (upT > 0.5) { upT = 0; for (let t = 0; t < 16; t++) if (!S.done.includes(t) && D.pct(t) >= 98) { S.done.push(t); const b = Math.round(150 * sectorPrice(t)); S.money += b; S.st.earn += b; toast(`🎉 ${SECTORS[t]} 清掃完了！\nボーナス +${fmt$(b)}`, 3000); log(`🎉 ${SECTORS[t]} 完了 +${fmt$(b)}`); save(); } }
  findT += dt; if (findT > 0.6) { findT = 0; syncFinds(); }
  saveT += dt; if (saveT > 20) { saveT = 0; save(); }
}
const clampA = v => Math.max(-HALF + 0.6, Math.min(HALF - 0.6, v));

function robotStep(r, dt) {
  const B = BOTS[r.k];
  if (r.st === 'go') {
    const [d] = nearestDepot(r.x, r.z); const dx = d.x - r.x, dz = d.z - r.z, l = Math.hypot(dx, dz);
    if (l < d.r * 0.8) { const m = r.val * priceK(); S.money += m; S.st.earn += m; S.st.kg += r.kg; r.kg = 0; r.val = 0; r.st = 'sweep'; r.tx = null; r.earn = (r.earn || 0) + m; return; }
    r.yaw = Math.atan2(dx, dz); const s = B.sp * 1.6 * dt; r.x += dx / l * s; r.z += dz / l * s; return;
  }
  if (r.tx == null || r.tt <= 0 || Math.hypot(r.tx - r.x, r.tz - r.z) < 0.4) pickTarget(r);
  r.tt -= dt;
  const dx = r.tx - r.x, dz = r.tz - r.z, l = Math.hypot(dx, dz) || 1;
  let d = Math.atan2(dx, dz) - r.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); r.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * 3);
  const s = B.sp * dt * Math.max(0.2, Math.cos(d)); r.x = clampA(r.x + Math.sin(r.yaw) * s); r.z = clampA(r.z + Math.cos(r.yaw) * s);
  const w = B.w * wideK(), fx = r.x + Math.sin(r.yaw) * 0.4, fz = r.z + Math.cos(r.yaw) * 0.4;
  const [kg, val] = sweepAt(fx, fz, r.yaw, w, 0.5, B.pw * 6, dt, B.cap - r.kg); r.kg += kg; r.val += val;
  if (r.kg >= B.cap - 0.001) r.st = 'go';
}
function pickTarget(r) {
  const c = sectorCenter(r.sec); let best = null, bs = -1e9;
  for (let i = 0; i < 36; i++) { const x = c.x + (Math.random() - 0.5) * (TILE_M - 1), z = c.z + (Math.random() - 0.5) * (TILE_M - 1); const v = D.at(x, z); const sc = v - Math.hypot(x - r.x, z - r.z) * 2.2; if (v > 12 && sc > bs) { bs = sc; best = [x, z]; } }
  if (!best) { // この地区はきれい → 汚れている近くの地区へ
    if (D.pct(r.sec) > 90) { let bt = r.sec, bp = 101; for (let t = 0; t < 16; t++) { const p = D.pct(t) + Math.hypot(t % 4 - r.sec % 4, ((t / 4) | 0) - ((r.sec / 4) | 0)) * 8; if (D.pct(t) < 95 && p < bp) { bp = p; bt = t; } } r.sec = bt; }
    best = [c.x + (Math.random() - 0.5) * TILE_M * 0.9, c.z + (Math.random() - 0.5) * TILE_M * 0.9];
  }
  r.tx = best[0]; r.tz = best[1]; r.tt = 10;
}

// ---------- 描画 ----------
let texT = 0;
function render(dt) {
  pl.visible = !P.inCar;
  pl.position.set(P.x, P.y, P.z); pl.rotation.y = P.yaw;
  P.anim += dt * (2 + P.sp * 2.5);
  const sw = P.sp > 0.2 ? Math.sin(P.anim) : 0;
  for (const s of [-1, 1]) { const l = pl.getObjectByName('leg' + s), b = pl.getObjectByName('boot' + s); l.position.z = sw * 0.12 * s; b.position.z = 0.04 + sw * 0.16 * s; }
  toolG.position.set(P.brush ? Math.sin(P.anim * 1.7) * 0.12 * (P.sp > 0.2 ? 1 : 0.5) : 0, P.brush ? 0 : 0.5, P.brush ? 0.55 : 0.35);
  toolG.rotation.y = P.brush ? Math.sin(P.anim * 1.7) * 0.15 : 0; toolG.rotation.x = P.brush ? 0 : -0.8;
  pl.position.y += P.pack > 0 ? Math.abs(Math.sin(P.pack * 18)) * 0.05 : 0;
  plShadow.position.set(P.x, height(P.x, P.z) + 0.03, P.z); plShadow.visible = !P.inCar;
  if (carMesh && S.car) { const c = S.car; const y = height(c.x, c.z); carMesh.position.set(c.x, y, c.z); const f = height(c.x + Math.sin(c.yaw) * 1.2, c.z + Math.cos(c.yaw) * 1.2), b = height(c.x - Math.sin(c.yaw) * 1.2, c.z - Math.cos(c.yaw) * 1.2); carMesh.rotation.set(0, 0, 0); carMesh.rotation.y = c.yaw; carMesh.rotateX(-Math.atan2(f - b, 2.4)); const r = carMesh.getObjectByName('roll'); if (r) r.rotation.x += dt * (P.inCar ? 12 : 0) * Math.sign(P.sp || 0); const lp = carMesh.getObjectByName('lamp'); if (lp) lp.visible = !P.inCar || Math.sin(tAll * 8) > 0; carShadow.position.set(c.x, y + 0.03, c.z); }
  S.robots.forEach((r, i) => { const m = robotMeshes[i]; if (!m) return; m.position.set(r.x, height(r.x, r.z), r.z); m.rotation.y = r.yaw; const e = m.getObjectByName('eye'); if (e) e.material.color.setHex(r.st === 'go' ? 0xff9a3c : 0x7ff0a8); });
  for (const id in findMeshes) { const m = findMeshes[id]; m.position.y = height(m.position.x, m.position.z) + 0.8 + Math.sin(tAll * 3 + +id) * 0.12; }
  const bl = scene.userData.base.userData.blink; bl.visible = Math.sin(tAll * 4) > 0;
  garage.visible = S.garage; garageSign.visible = !S.garage;
  stepParticles(dt);
  texT += dt; if (texT > 0.08) { texT = 0; for (let t = 0; t < 16; t++) if (D.dirty[t]) { D.dirty[t] = 0; texs[t].needsUpdate = true; } }
  // カメラ
  const tx = P.x, tz = P.z, ty = P.y + (P.inCar ? 1.6 : 1.1);
  const want = { x: tx - Math.sin(camYaw) * Math.cos(camPitch) * camDist, y: ty + Math.sin(camPitch) * camDist, z: tz - Math.cos(camYaw) * Math.cos(camPitch) * camDist };
  want.y = Math.max(want.y, height(want.x, want.z) + 0.6);
  camera.position.lerp(new THREE.Vector3(want.x, want.y, want.z), Math.min(1, dt * 10));
  camera.lookAt(tx, ty, tz);
  // 自動でカメラを後ろへ（歩いているとき少しずつ）
  if (!camDrag && P.sp > 1 && !BOT) { const back = (P.inCar && S.car ? S.car.yaw : P.yaw); let d = back - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * Math.min(1, dt * 0.6); }
  renderer.render(scene, camera);
}

// HUD
let lastSec = -1;
function hud() {
  $('money').textContent = fmt$(S.money);
  const t = sectorOf(P.x, P.z), sp = D.pct(t), tp = D.pct();
  if (t !== lastSec) { if (lastSec >= 0) log(`📍 ${SECTORS[t]}（$${sectorPrice(t)}/kg）`); lastSec = t; tileMat.forEach((m, i) => m.uniforms.hl.value = i === t ? 1 : 0); }
  $('secTxt').textContent = `${SECTORS[t]}　${sp.toFixed(1)}%　$${sectorPrice(t)}/kg`; $('secBar').style.width = sp + '%';
  $('totTxt').textContent = `月面清掃率 ${tp.toFixed(2)}%`; $('totBar').style.width = tp + '%';
  let kg, cap, hint = '';
  if (P.inCar && S.car) { kg = S.car.kg; cap = CARS[S.car.k].cap; $('caps').innerHTML = ''; }
  else { kg = S.g.kg; cap = gaugeCap(); $('caps').innerHTML = Array.from({ length: slots() }, (_, i) => `<b class="${i < S.caps.length ? 'on' : ''}"></b>`).join(''); }
  const full = kg >= cap - 0.001; const gb = $('gBar'); gb.style.width = Math.min(100, kg / cap * 100) + '%'; gb.classList.toggle('full', full);
  $('gTxt').textContent = `${fkg(kg)} / ${fkg(cap)} kg`;
  const carryFull = !P.inCar && full && S.caps.length >= slots();
  if (P.inCar) hint = full ? 'タンク満タン！回収口か集積所へ' : '';
  else if (P.pack > 0) hint = 'パック中…';
  else if (carryFull) hint = 'もう持てない！回収口か集積所へ運ぼう';
  else if (full) hint = '満タン！📦パックしよう';
  else if (!P.brush) hint = 'ブラシをあげている（掃除しない）';
  else if (S.st.trips === 0 && totalCarry() < 0.02) hint = '歩くとブラシで掃除できる';
  $('hint').textContent = hint;
  const pb = $('bPack'); pb.classList.toggle('hot', !P.inCar && full && S.caps.length < slots()); pb.classList.toggle('off', P.inCar || S.g.kg < 0.01 || S.caps.length >= slots()); pb.hidden = P.inCar;
  $('bBrush').classList.toggle('off', !P.brush); $('bBrush').hidden = P.inCar; $('bBrush').firstChild.textContent = TOOLS[S.tool].ic;
  $('bJump').hidden = P.inCar;
  const rb = $('bRide'); const near = nearCar(); rb.hidden = !(P.inCar || near); rb.firstChild.textContent = P.inCar ? '🚶' : CARS[S.car ? S.car.k : 0].ic; rb.querySelector('small').textContent = P.inCar ? 'おりる' : '乗る'; rb.classList.toggle('hot', !P.inCar && near);
  // 矢印（いっぱいのとき近くの売り場へ）
  const ar = $('arrow'); const show = (carryFull || (P.inCar && full) || (totalCarry() > 0 && !P.inCar && S.caps.length > 0 && full));
  if (show) { const [d, l] = nearestDepot(P.x, P.z); const a = Math.atan2(d.x - P.x, d.z - P.z) - camYaw; ar.hidden = false; ar.style.transform = `rotate(${-a}rad)`; $('arrowTxt').textContent = `${d.main ? '回収口' : '集積所'} ${Math.round(l)}m`; $('arrowTxt').style.transform = `rotate(${a}rad)`; }
  else ar.hidden = true;
  if (!$('shop').hidden) $('shopMoney').textContent = fmt$(S.money);
}

// ---------- ショップ ----------
let shopTab = 'tool';
const TABS = [['tool', '🧹 道具'], ['up', '⬆️ 強化'], ['fac', '🏗️ 設備'], ['bot', '🤖 ロボ'], ['car', '🚗 車']];
function openShop() { closeAll(); $('shop').hidden = false; drawShop(); }
function drawShop() {
  $('shopMoney').textContent = fmt$(S.money);
  $('shopTabs').innerHTML = TABS.map(([k, n]) => `<button data-t="${k}" class="${k === shopTab ? 'on' : ''}">${n}</button>`).join('');
  $('shopTabs').querySelectorAll('button').forEach(b => b.onclick = () => { shopTab = b.dataset.t; drawShop(); });
  const L = []; const it = (ic, n, d, st, btn) => L.push(`<div class="it"><div class="ic">${ic}</div><div><b>${n}</b><p>${d}</p>${st ? `<p class="st">${st}</p>` : ''}</div>${btn}</div>`);
  const buyB = (act, cost, label) => `<button class="buy" data-a="${act}" ${S.money < cost ? 'disabled' : ''}>${label || fmt$(cost)}</button>`;
  if (shopTab === 'tool') TOOLS.forEach((T, i) => { const own = S.tools.includes(i); it(T.ic, T.n, T.d, `幅 ${Math.round(T.w * 100)}cm・ゲージ ${T.cap}kg・とれやすさ ${Math.round(T.pw * 100)}%`, S.tool === i ? `<button class="buy use" disabled>使用中</button>` : own ? `<button class="buy use" data-a="use:${i}">使う</button>` : buyB('tool:' + i, T.cost)); });
  if (shopTab === 'up') for (const k in UPS) { const U = UPS[k], L2 = S.up[k]; it(U.ic, `${U.n} ${U.max > 1 ? `Lv${L2}/${U.max}` : L2 ? '（取りつけ済み）' : ''}`, U.d, k === 'tank' ? `いまのゲージ ${fkg(gaugeCap())}kg` : k === 'belt' ? `いまのカプセル ${slots()}こ` : '', L2 >= U.max ? `<button class="buy" disabled>MAX</button>` : buyB('up:' + k, U.cost(L2))); }
  if (shopTab === 'fac') {
    const n = S.depots.length, [, dl] = nearestDepot(P.x, P.z);
    it('🔵', `集積所 ${n}/${MAXDEPOT}`, 'いま立っている場所に建てる。回収口と同じようにホコリを売れる。遠くの地区で便利', dl < 14 ? '⚠ ほかの売り場に近すぎる（14m以上はなす）' : `ここ：${SECTORS[sectorOf(P.x, P.z)]}`, n >= MAXDEPOT ? `<button class="buy" disabled>MAX</button>` : dl < 14 || P.inCar ? `<button class="buy" disabled>${fmt$(depotCost(n))}</button>` : buyB('depot', depotCost(n)));
    it('🏠', 'ガレージ', '基地のとなりに建てる。清掃車を買って呼び出せる', '', S.garage ? `<button class="buy" disabled>建設済み</button>` : buyB('garage', GARAGE_COST));
  }
  if (shopTab === 'bot') {
    const cnt = S.robots.length;
    L.push(`<p style="margin:0;font-size:.78rem;opacity:.8">ロボはいまいる地区（${SECTORS[sectorOf(P.x, P.z)]}）に置かれて、そこを自動でそうじ。きれいになると近くの地区へ移る。留守中（最大1時間ぶん）もはたらく。 ${cnt}/${MAXBOT}台</p>`);
    BOTS.forEach((B, i) => { const have = S.robots.filter(r => r.k === i).length; it(B.ic, B.n + (have ? `（${have}台）` : ''), B.d, `幅 ${Math.round(B.w * 100)}cm・タンク ${B.cap}kg・速さ ${B.sp}m/s`, cnt >= MAXBOT ? `<button class="buy" disabled>MAX</button>` : buyB('bot:' + i, B.cost)); });
  }
  if (shopTab === 'car') {
    if (!S.garage) L.push(`<p style="margin:0;font-size:.85rem">🏠 まず「設備」でガレージを建てよう（${fmt$(GARAGE_COST)}）</p>`);
    CARS.forEach((C, i) => { const own = S.cars.includes(i); it(C.ic, C.n, C.d, `ブラシ幅 ${C.w}m・速さ ${C.sp}m/s`, !S.garage ? `<button class="buy" disabled>${fmt$(C.cost)}</button>` : own ? (S.car && S.car.k === i ? `<button class="buy use" data-a="call:${i}">ガレージへ戻す</button>` : `<button class="buy use" data-a="call:${i}">ガレージに出す</button>`) : buyB('car:' + i, C.cost)); });
  }
  $('shopList').innerHTML = L.join('');
  $('shopList').querySelectorAll('[data-a]').forEach(b => b.onclick = () => shopAct(b.dataset.a));
}
function pay(c) { if (S.money < c) return false; S.money -= c; return true; }
function shopAct(a) {
  const [k, v] = a.split(':');
  if (k === 'use') { S.tool = +v; buildTool(); }
  if (k === 'tool' && pay(TOOLS[v].cost)) { S.tools.push(+v); S.tool = +v; buildTool(); toast(`${TOOLS[v].ic} ${TOOLS[v].n} GET！`); if (S.g.kg > gaugeCap()) S.g.kg = gaugeCap(); }
  if (k === 'up' && S.up[v] < UPS[v].max && pay(UPS[v].cost(S.up[v]))) { S.up[v]++; if (v === 'wide') buildTool(); toast(`${UPS[v].ic} ${UPS[v].n} アップ！`); }
  if (k === 'depot') { const n = S.depots.length; if (pay(depotCost(n))) { const d = { x: +P.x.toFixed(2), z: +P.z.toFixed(2) }; S.depots.push(d); addDepotMesh(d); toast('🔵 集積所を建てた！'); closeAll(); } }
  if (k === 'garage' && pay(GARAGE_COST)) { S.garage = true; toast('🏠 ガレージ完成！'); }
  if (k === 'bot' && S.robots.length < MAXBOT && pay(BOTS[v].cost)) { const sec = sectorOf(P.x, P.z); S.robots.push({ k: +v, x: P.x + 1, z: P.z + 1, yaw: 0, sec, kg: 0, val: 0, st: 'sweep', tx: null, tt: 0 }); syncRobotMeshes(); toast(`${BOTS[v].ic} ${BOTS[v].n} 出動！`); }
  if (k === 'car' && pay(CARS[v].cost)) { S.cars.push(+v); callCar(+v); toast(`${CARS[v].ic} ${CARS[v].n} がガレージに！`); }
  if (k === 'call') { callCar(+v); }
  save(); drawShop();
}
function callCar(k) {
  if (P.inCar) { P.inCar = false; P.x = PAD.x - 3; P.z = PAD.z + 2; }
  const keep = S.car ? { kg: S.car.kg, val: S.car.val } : { kg: 0, val: 0 };
  if (S.car && S.car.k === k && Math.hypot(S.car.x - PAD.x, S.car.z - PAD.z) < 1) { S.car = null; placeCar(); toast('ガレージにしまった'); return; }
  S.car = { k, x: PAD.x, z: PAD.z, yaw: Math.PI, kg: Math.min(keep.kg, CARS[k].cap), val: keep.val };
  placeCar(); log(`🚗 ${CARS[k].n} をガレージ前に出した`);
}

// ---------- マップ ----------
const mapImg = document.createElement('canvas'); mapImg.width = mapImg.height = 256;
function openMap() { closeAll(); $('map').hidden = false; drawMap(); }
function drawMap() {
  const x = mapImg.getContext('2d'), id = x.createImageData(256, 256), a = id.data;
  for (let t = 0; t < 16; t++) { const tx = t % 4, tz = (t / 4) | 0, T = D.tex[t]; for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) { let s = 0; for (let b = 0; b < 4; b += 2) for (let c = 0; c < 4; c += 2) s += T[(j * 4 + b) * TN + i * 4 + c]; s /= 4; const k = ((tz * 64 + j) * 256 + tx * 64 + i) * 4; const d = Math.min(1, s / 120); a[k] = 30 + d * 150; a[k + 1] = 70 + d * 120; a[k + 2] = 110 + d * 60; a[k + 3] = 255; } }
  x.putImageData(id, 0, 0);
  const c = $('mapc'), g = c.getContext('2d'), S2 = c.width, k = S2 / (HALF * 2); const px = v => (v + HALF) * k;
  g.clearRect(0, 0, S2, S2); g.imageSmoothingEnabled = true; g.drawImage(mapImg, 0, 0, S2, S2);
  g.fillStyle = 'rgba(0,30,60,.25)'; g.fillRect(0, 0, S2, S2);
  for (let t = 0; t < 16; t++) { const p = D.pct(t), sx = (t % 4) * S2 / 4, sz = ((t / 4) | 0) * S2 / 4, col = p >= 98 ? '#7ff0a8' : p >= 1 ? '#5cc8ff' : '#ff9a3c'; g.strokeStyle = col; g.lineWidth = 3; g.strokeRect(sx + 3, sz + 3, S2 / 4 - 6, S2 / 4 - 6); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(sx + 6, sz + 6, S2 / 4 - 12, 38); g.fillStyle = col; g.font = '900 17px "M PLUS Rounded 1c"'; g.fillText(SECTORS[t], sx + 12, sz + 24); g.fillStyle = '#fff'; g.font = '900 14px "M PLUS Rounded 1c"'; g.fillText(`${p.toFixed(1)}%  $${sectorPrice(t)}/kg`, sx + 12, sz + 40); }
  const dot = (x2, z2, r, col, txt) => { g.beginPath(); g.arc(px(x2), px(z2), r, 0, 7); g.fillStyle = col; g.fill(); if (txt) { g.font = `${r * 2.2}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, px(x2), px(z2) + 1); g.textAlign = 'start'; g.textBaseline = 'alphabetic'; } };
  dot(INTAKE.x, INTAKE.z, 9, '#ff9a3c'); S.depots.forEach(d => dot(d.x, d.z, 7, '#5cc8ff'));
  S.robots.forEach(r => { g.font = '16px sans-serif'; g.textAlign = 'center'; g.fillText('🤖', px(r.x), px(r.z) + 6); g.textAlign = 'start'; });
  if (S.car && !P.inCar) { g.font = '18px sans-serif'; g.textAlign = 'center'; g.fillText('🚗', px(S.car.x), px(S.car.z) + 6); g.textAlign = 'start'; }
  for (const id in findMeshes) { const f = FINDS[id]; g.font = '900 20px sans-serif'; g.fillStyle = '#ffe27a'; g.textAlign = 'center'; g.fillText('❗', px(f.x), px(f.z) + 7); g.textAlign = 'start'; }
  g.save(); g.translate(px(P.x), px(P.z)); g.rotate(-(P.inCar && S.car ? S.car.yaw : P.yaw)); g.beginPath(); g.moveTo(0, 12); g.lineTo(8, -8); g.lineTo(0, -4); g.lineTo(-8, -8); g.closePath(); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); g.fill(); g.restore();
  $('mapTot').textContent = `月面清掃率 ${D.pct().toFixed(2)}%　完了 ${S.done.length}/16地区　落とし物 ${S.found.length}/${FINDS.length}`;
  $('mapSec').textContent = `ロボ ${S.robots.length}台・集積所 ${S.depots.length}`;
}
setInterval(() => { if (!$('map').hidden) drawMap(); }, 1000);

// ---------- メニュー ----------
function openMenu() {
  closeAll(); $('menu').hidden = false;
  const h = Math.floor(S.st.time / 3600), m = Math.floor(S.st.time / 60) % 60;
  $('statBox').innerHTML = [['月面清掃率', D.pct().toFixed(2) + '%'], ['完了した地区', S.done.length + ' / 16'], ['集めたホコリ', fkg(S.st.kg) + ' kg'], ['かせいだお金', fmt$(S.st.earn)], ['運んだ回数', S.st.trips + '回'], ['落とし物', S.found.length + ' / ' + FINDS.length], ['ロボ', S.robots.length + '台'], ['勤務時間', `${h}時間${m}分`]].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
}
tap('mHelp', () => { closeAll(); talk(HELP); });
tap('mTitle', () => { save(); closeAll(); playing = false; $('hud').hidden = true; showTitle(); });
const HELP = `<b>🪥 掃除</b>：歩くとブラシでホコリがとれる。ゆっくり歩く・何度も通るとピカピカに。<br><b>📦 パック</b>：ゲージが満タンになったらカプセルにつめる（持てる数はカプセルベルトで増える）。<br><b>💰 売る</b>：基地の<b>回収口</b>（オレンジの輪）か、自分で建てた<b>集積所</b>（青い輪）に入ると自動で売れる。外側の地区ほど上質なホコリで高く売れる。<br><b>🚗 車</b>：ガレージを建てて清掃車を買うと、緑の輪に出てくる。近くで「乗る」。<br><b>🤖 ロボ</b>：買った地区を自動でそうじして、自分で売りに行く。<br><b>❗ 落とし物</b>：ホコリの下にうまっている。掃除すると出てくるので拾うと報奨金。<br><b>🎉 地区クリア</b>：98%以上きれいにするとボーナス。`;

// ---------- セーブ ----------
function save() {
  S.p = { x: +P.x.toFixed(2), z: +P.z.toFixed(2), yaw: +P.yaw.toFixed(2) }; S.t = Date.now();
  S.dust = D.save();
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  if (window.GAMES_RANK) GAMES_RANK.report('moon', Math.floor(D.pct() * 100) / 100);
}
addEventListener('pagehide', () => { if (playing) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && playing) save(); });

// 留守中のロボ
function offline() {
  if (!S.robots.length) return;
  const sec = Math.min(3600, (Date.now() - (S.t || Date.now())) / 1000); if (sec < 30) return;
  const m0 = S.money; const dt = 0.5; for (let t = 0; t < sec; t += dt) for (const r of S.robots) robotStep(r, dt);
  const got = S.money - m0; if (got >= 1) setTimeout(() => talk(`おかえり！留守のあいだ（${Math.round(sec / 60)}分）にロボたちが <b>${fmt$(got)}</b> 稼いでくれたぞ。`), 400);
}

// ---------- タイトル ----------
function showTitle() {
  $('title').hidden = false;
  const has = S.st.time > 5;
  $('tGo').firstChild.textContent = has ? 'つづきから' : 'しゅっきん！'; $('tGoSub').textContent = has ? `${fmt$(S.money)}・月面清掃率 ${D.pct().toFixed(2)}%` : '歯ブラシ1本からはじめる';
  $('tNew').hidden = !has;
}
tap('tGo', () => start());
tap('tNew', () => { if (!confirm('はじめからにする？（いまのセーブは消えます）')) return; localStorage.removeItem(KEY); location.reload(); });
function start() {
  $('title').hidden = true; $('hud').hidden = false; playing = true; offline(); hud();
  if (!S.intro) { S.intro = true; talk(`ようこそ、新人清掃員くん。月面管理局（LSD）清掃課へ！<br>支給品は……<b>歯ブラシ1本</b>だ。すまんな。<br><br>月のホコリを掃いて集めて、基地の<b>回収口</b>（オレンジの輪）に持ってくれば買い取るぞ。<br>稼いだお金で道具をそろえて、この一帯 16地区 をピカピカにしてくれたまえ！`); save(); }
}
showTitle();
if (window.GAMES_RANK) { GAMES_RANK.mount('moon', { left: 'max(10px, env(safe-area-inset-left))', bottom: 'max(10px, env(safe-area-inset-bottom))' }, () => playing); if (S.st.time > 5) GAMES_RANK.report('moon', Math.floor(D.pct() * 100) / 100, undefined, { old: true }); }

// ---------- テスト用ボット ----------
let botTgt = null, botStuck = 0;
function botInput(dt) {
  botT += dt; if (botT > 2) { botT = 0; botShop(); }
  const want = (x, z) => { const dx = x - P.x, dz = z - P.z, l = Math.hypot(dx, dz) || 1; const wx = dx / l, wz = dz / l; // 世界→カメラ基準
    return [-wx * Math.cos(camYaw) + wz * Math.sin(camYaw), -(wx * Math.sin(camYaw) + wz * Math.cos(camYaw))]; };
  if (S.car && !P.inCar && nearCar()) doRide();
  if (S.car && !P.inCar) return want(S.car.x, S.car.z);
  const cap = P.inCar ? CARS[S.car.k].cap : gaugeCap(), kg = P.inCar ? S.car.kg : S.g.kg;
  if (!P.inCar && kg >= cap - 0.001 && S.caps.length < slots()) { doPack(); return [0, 0]; }
  if (kg >= cap - 0.001) { const [d] = nearestDepot(P.x, P.z); return want(d.x, d.z); }
  if (!botTgt || Math.hypot(botTgt[0] - P.x, botTgt[1] - P.z) < 0.6 || (botStuck += dt) > 6) { botStuck = 0; let best = null, bs = -1e9; for (let i = 0; i < 60; i++) { const a = Math.random() * 7, r = 1 + Math.random() * 14; const x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r; const v = D.at(x, z); const s = v - r * 4; if (v > 15 && s > bs) { bs = s; best = [clampA(x), clampA(z)]; } } botTgt = best || [clampA(P.x + (Math.random() - 0.5) * 40), clampA(P.z + (Math.random() - 0.5) * 40)]; }
  const [a, b] = want(botTgt[0], botTgt[1]); return [a * 0.7, b * 0.7];
}
function botShop() {
  const tryBuy = a => { const before = S.money; shopAct(a); return S.money < before; };
  if (S.tool < TOOLS.length - 1 && S.money >= TOOLS[S.tool + 1].cost) tryBuy('tool:' + (S.tool + 1));
  for (const k of ['belt', 'tank', 'auto', 'boots', 'wide', 'appr']) if (S.up[k] < UPS[k].max && S.money >= UPS[k].cost(S.up[k]) * 1.5) tryBuy('up:' + k);
  if (S.tool >= 4 && !S.garage && S.money >= GARAGE_COST) tryBuy('garage');
  if (S.garage) for (let i = 0; i < CARS.length; i++) if (!S.cars.includes(i) && (i === 0 || S.cars.includes(i - 1)) && S.money >= CARS[i].cost) { if (P.inCar) doRide(); tryBuy('car:' + i); }
  const [, dl] = nearestDepot(P.x, P.z); if (!P.inCar && dl > 30 && S.depots.length < MAXDEPOT && S.money >= depotCost(S.depots.length) * 2) tryBuy('depot');
  if (S.tool >= 3 && S.robots.length < MAXBOT && S.money >= BOTS[0].cost * 2) tryBuy('bot:' + (S.money > BOTS[2].cost * 2 ? 2 : S.money > BOTS[1].cost * 2 ? 1 : 0));
  closeAll();
}
window.TSUKI = { S, D, P, get stats() { return { money: S.money | 0, tool: S.tool, pct: +D.pct().toFixed(3), robots: S.robots.length, cars: S.cars, inCar: P.inCar, depots: S.depots.length, found: S.found.length, done: S.done.length, time: S.st.time | 0, kg: +S.st.kg.toFixed(1), up: S.up }; }, start };
if (BOT) { start(); $('talk').hidden = true; }

// ---------- ループ ----------
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (playing && !anyOpen()) { for (let i = 0; i < FAST; i++) update(dt); }
  render(dt);
  hudT += dt; if (playing && hudT > 0.1) { hudT = 0; hud(); }
}
requestAnimationFrame(loop);
