// 月面おそうじ局 — 本体
import * as THREE from '../upa/vendor/three.module.min.js';
import * as W from './world.js';
import { EffectComposer } from './vendor/EffectComposer.js';
import { RenderPass } from './vendor/RenderPass.js';
import { UnrealBloomPass } from './vendor/UnrealBloomPass.js';
import { OutputPass } from './vendor/OutputPass.js';
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

// ---------- 画質 ----------
const GFX_KEY = 'tsukigfx';
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let GQ = +(localStorage.getItem(GFX_KEY) ?? (isTouch ? 1 : 2)); if (!(GQ >= 0 && GQ <= 2)) GQ = 1;
if (BOT && !Q.has('gq')) GQ = 2; if (Q.has('gq')) GQ = +Q.get('gq');

// ---------- 画面 ----------
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: GQ > 0, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [1, 1.3, 1.75][GQ]));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
if (GQ > 0) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
const scene = new THREE.Scene(); scene.background = new THREE.Color(0x000002);
const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 4000); camera.rotation.order = 'YXZ'; scene.add(camera);
camera.layers.enable(0);
const SUN = new THREE.Vector3(0.62, 0.34, 0.42).normalize();
const amb = new THREE.AmbientLight(0x6070a0, 0.22); scene.add(amb);
const hemi = new THREE.HemisphereLight(0x7f9cff, 0x2a2420, 0.45); scene.add(hemi); // 地球の照りかえし
const sunL = new THREE.DirectionalLight(0xfff2dc, 3.3); scene.add(sunL); scene.add(sunL.target);
if (GQ > 0) { sunL.castShadow = true; const s = sunL.shadow; s.mapSize.set(GQ === 2 ? 2048 : 1024, GQ === 2 ? 2048 : 1024); const r = GQ === 2 ? 34 : 26; Object.assign(s.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 220 }); s.camera.updateProjectionMatrix(); s.bias = -0.0004; s.normalBias = 0.04; s.camera.layers.enable(1); }
const lamp = new THREE.SpotLight(0xdfeaff, 0, 28, 0.62, 0.65, 1.4); camera.add(lamp); camera.add(lamp.target); lamp.position.set(0.15, 0.1, 0); lamp.target.position.set(0, -0.4, -5);
// 映りこみ用の環境（上はまっ黒な宇宙、下は灰色の地面、太陽）
{
  const es = new THREE.Scene(); const sph = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { sun: { value: SUN } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 sun; varying vec3 vD; void main(){ float g = smoothstep(0.08, -0.25, vD.y); vec3 c = mix(vec3(0.012, 0.014, 0.02), vec3(0.42, 0.41, 0.39), g); c += vec3(0.04,0.07,0.14) * smoothstep(0.1, 0.0, abs(vD.y)); c += vec3(30.0, 28.0, 25.0) * pow(max(dot(vD, sun), 0.0), 900.0); gl_FragColor = vec4(c, 1.0); }' }));
  es.add(sph); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0.02).texture; pm.dispose();
}
let composer = null;
if (GQ === 2) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.5, 0.82));
  composer.addPass(new OutputPass());
}
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); if (composer) composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();
const SH = o => { o.traverse(m => { if (m.isMesh && !m.material.transparent) { m.castShadow = true; m.receiveShadow = true; } }); return o; };
const rnd = (() => { let s = 99173; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();

// 星・天の川・地球・太陽
{
  const n = GQ === 0 ? 2500 : 6000, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  const band = new THREE.Vector3(0.3, 0.5, -0.8).normalize();
  for (let i = 0; i < n; i++) {
    let v; if (i < n * 0.45) { const a = rnd() * Math.PI * 2; const u = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); u.applyAxisAngle(new THREE.Vector3(1, 0, 0), 1.05); v = u.add(band.clone().multiplyScalar((rnd() - 0.5) * 0.22)).normalize(); }
    else { const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u); v = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s); }
    if (v.y < -0.05) v.y = -v.y; v.multiplyScalar(2500); p.set([v.x, v.y, v.z], i * 3);
    const b = 0.35 + rnd() ** 3 * 1.4, t = rnd(); c.set([b * (t < 0.2 ? 0.8 : 1), b * (t < 0.2 ? 0.85 : t > 0.85 ? 0.9 : 1), b * (t > 0.85 ? 0.75 : 1)], i * 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false })));
  // 地球
  const W2 = GQ === 2 ? 1024 : 512, H2 = W2 / 2, ec = document.createElement('canvas'); ec.width = W2; ec.height = H2; const x = ec.getContext('2d');
  const img = x.createImageData(W2, H2), a = img.data;
  for (let j = 0; j < H2; j++) for (let i = 0; i < W2; i++) {
    const lon = i / W2 * Math.PI * 2, lat = (j / H2 - 0.5) * Math.PI; const X = Math.cos(lat) * Math.cos(lon), Y = Math.sin(lat), Z = Math.cos(lat) * Math.sin(lon);
    const land = W.noise(X * 60 + 3, Z * 60 + Y * 40) * 0.6 + W.noise(X * 150, Y * 150 + Z * 90) * 0.3; const cl = W.noise(X * 200 + 50, Y * 260 + Z * 120) * 0.7 + W.noise(X * 600, Z * 600 + Y * 400) * 0.3;
    const ice = Math.abs(Y) > 0.88; let r, gg, b;
    if (ice) { r = 235; gg = 240; b = 250; } else if (land > 0.18) { const dry = W.noise(X * 300, Y * 300) > 0.2 && Math.abs(Y) < 0.5; r = dry ? 170 : 60; gg = dry ? 150 : 115; b = dry ? 100 : 55; } else { r = 18; gg = 60 + land * 40; b = 140 + land * 60; }
    const cw = Math.max(0, Math.min(1, (cl - 0.15) * 2.2)); r += (245 - r) * cw; gg += (248 - gg) * cw; b += (252 - b) * cw;
    const k = (j * W2 + i) * 4; a[k] = r; a[k + 1] = gg; a[k + 2] = b; a[k + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  const et = new THREE.CanvasTexture(ec); et.colorSpace = THREE.SRGBColorSpace; et.anisotropy = 4;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 40), new THREE.MeshStandardMaterial({ map: et, roughness: 0.75, metalness: 0 }));
  earth.position.set(-900, 520, -1300); earth.rotation.set(0.3, 1.2, 0.4); scene.add(earth);
  const atm = new THREE.Mesh(new THREE.SphereGeometry(161, 48, 32), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending, uniforms: { sun: { value: SUN } },
    vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vWN; void main(){ vN = normalize(normalMatrix * normal); vWN = normalize(mat3(modelMatrix) * normal); vec4 mv = modelViewMatrix * vec4(position,1.); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 sun; varying vec3 vN; varying vec3 vV; varying vec3 vWN; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); float l = clamp(dot(vWN, sun) * 0.8 + 0.4, 0.0, 1.0); gl_FragColor = vec4(vec3(0.35, 0.6, 1.0) * f * l * 1.6, f * l); }' }));
  atm.position.copy(earth.position); scene.add(atm); scene.userData.earth = earth;
  const sc = document.createElement('canvas'); sc.width = sc.height = 256; const s = sc.getContext('2d');
  const gr = s.createRadialGradient(128, 128, 2, 128, 128, 128); gr.addColorStop(0, 'rgba(255,255,250,1)'); gr.addColorStop(0.07, 'rgba(255,252,235,1)'); gr.addColorStop(0.12, 'rgba(255,240,200,.5)'); gr.addColorStop(0.35, 'rgba(255,220,170,.08)'); gr.addColorStop(1, 'rgba(255,200,140,0)'); s.fillStyle = gr; s.fillRect(0, 0, 256, 256);
  const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, depthWrite: false, transparent: true, color: new THREE.Color(3, 2.9, 2.6), toneMapped: false })); sun.position.copy(SUN).multiplyScalar(2000); sun.scale.set(700, 700, 1); scene.add(sun);
}

// 地面のマテリアル（PBR + ホコリの地図 + でこぼこ）
const GROUND_PARS = `
uniform sampler2D dustMap; uniform vec2 org; uniform float outer; uniform float hl;
varying vec3 vW;
float hash2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash2(i), hash2(i + vec2(1,0)), f.x), mix(hash2(i + vec2(0,1)), hash2(i + vec2(1,1)), f.x), f.y); }
float pits(vec2 p){ vec2 i = floor(p), f = fract(p); float h = 0.0; for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)); if (hash2(i + o + 5.7) < 0.62) continue; vec2 c = o + vec2(hash2(i + o), hash2(i + o + 7.3)); float r = 0.12 + 0.36 * hash2(i + o + 3.1) * hash2(i + o + 9.2); float d = length(f - c) / r; if (d < 1.4) h += d < 1.0 ? (d * d - 1.0) : 0.35 * (1.4 - d) * (d - 1.0) * 6.0; } return h; }
vec3 pnArb(vec3 sp, vec3 sn, vec2 dh, float fd){ vec3 sx = normalize(dFdx(sp)); vec3 sy = normalize(dFdy(sp)); vec3 r1 = cross(sy, sn); vec3 r2 = cross(sn, sx); float det = dot(sx, r1) * fd; vec3 gr = sign(det) * (dh.x * r1 + dh.y * r2); return normalize(abs(det) * sn - gr); }
`;
const groundMat = (tex, ox, oz, outer) => {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0 });
  m.userData.u = { dustMap: { value: tex }, org: { value: new THREE.Vector2(ox, oz) }, outer: { value: outer ? 1 : 0 }, hl: { value: 0 } };
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vW;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + GROUND_PARS)
      .replace('#include <map_fragment>', `
        vec2 uvT = (vW.xz - org) / ${TILE_M.toFixed(1)};
        float dust = 0.62; if (outer < 0.5) { const float h = 0.6 / 256.0; dust = texture2D(dustMap, uvT).r * 0.4 + (texture2D(dustMap, uvT + vec2(h, h)).r + texture2D(dustMap, uvT + vec2(-h, h)).r + texture2D(dustMap, uvT + vec2(h, -h)).r + texture2D(dustMap, uvT + vec2(-h, -h)).r) * 0.15; }
        float camD = length(vViewPosition);
        // ホコリの「層」の厚さ（0〜1）。掃くとうすくなって、下の地面が見える
        float layer = smoothstep(0.015, 0.09, dust) * (0.35 + 0.65 * clamp(dust * 1.5, 0.0, 1.0));
        float avgN = layer;
        if (outer < 0.5) { const float o = 2.0 / 256.0; float s4 = 0.0; s4 += texture2D(dustMap, uvT + vec2(o, 0.0)).r; s4 += texture2D(dustMap, uvT - vec2(o, 0.0)).r; s4 += texture2D(dustMap, uvT + vec2(0.0, o)).r; s4 += texture2D(dustMap, uvT - vec2(0.0, o)).r; s4 *= 0.25; avgN = smoothstep(0.015, 0.09, s4) * (0.35 + 0.65 * clamp(s4 * 1.5, 0.0, 1.0)); }
        float ao = clamp((avgN - layer) * 2.2, 0.0, 1.0); // 掃いたところのふち（ホコリの壁のかげ）
        float gN = vn(vW.xz * 2.7) * 0.45 + vn(vW.xz * 9.0) * 0.3 + vn(vW.xz * 0.5) * 0.25;
        vec3 rock = mix(vec3(0.2, 0.205, 0.23), vec3(0.32, 0.325, 0.35), gN);
        rock *= 0.85 + 0.3 * vn(vW.xz * 31.0);
        float fl = vn(vW.xz * 2.0 + 3.0) * 0.6 + vn(vW.xz * 8.0) * 0.4;
        vec3 dcol = mix(vec3(0.66, 0.645, 0.665), vec3(0.76, 0.745, 0.765), fl);
        float dustA = smoothstep(0.0, 0.18, layer);
        diffuseColor.rgb = mix(rock, dcol * (0.8 + 0.2 * layer), dustA) * (1.0 - ao * 0.45);
        float spk = 0.4 * step(0.994, hash2(floor(vW.xz * 22.0))) * (1.0 - dustA) * smoothstep(25.0, 4.0, camD) * max(0.0, 0.6 + 0.4 * sin(vW.x * 3.0 + vW.z * 2.0));
        diffuseColor.rgb += hl * vec3(0.0, 0.015, 0.03) * (1.0 - dustA);`)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(0.5, 1.0, dustA);')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        float near1 = smoothstep(60.0, 8.0, camD), near2 = smoothstep(14.0, 2.0, camD);
        float bh = vn(vW.xz * 1.3) * 0.05 + (pits(vW.xz * 0.9) * 0.05 * near1 + pits(vW.xz * 3.7) * 0.018 * near2 + vn(vW.xz * 26.0) * 0.005 * near2) * mix(1.0, 0.12, dustA);
        bh += layer * 0.13 * smoothstep(90.0, 20.0, camD) + vn(vW.xz * 4.0) * 0.006 * dustA;
        float pxs = max(max(length(dFdx(vW)), length(dFdy(vW))), 0.0008);
        vec2 dh = clamp(vec2(dFdx(bh), dFdy(bh)) / pxs, -1.4, 1.4);
        normal = pnArb(-vViewPosition, normal, dh, faceDirection);`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += spk * vec3(0.9, 1.1, 1.4);');
  };
  m.customProgramCacheKey = () => 'moonground';
  return m;
};
const texs = [], tileMat = [];
const SEG = [40, 72, 96][GQ];
for (let t = 0; t < 16; t++) {
  const ox = -HALF + (t % 4) * TILE_M, oz = -HALF + ((t / 4) | 0) * TILE_M;
  const g = new THREE.PlaneGeometry(TILE_M, TILE_M, SEG, SEG); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i) + ox + TILE_M / 2, z = p.getZ(i) + oz + TILE_M / 2; p.setXYZ(i, x, height(x, z), z); }
  g.computeVertexNormals(); g.computeBoundingSphere();
  const tx = new THREE.DataTexture(D.tex[t], TN, TN, THREE.RedFormat, THREE.UnsignedByteType);
  tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearFilter; tx.unpackAlignment = 1; tx.needsUpdate = true;
  const m = groundMat(tx, ox, oz, false);
  const mesh = new THREE.Mesh(g, m); mesh.receiveShadow = true; scene.add(mesh); texs.push(tx); tileMat.push(m);
}
// エリアの外（ホコリの平原）と遠くの山
{
  const m = groundMat(null, 0, 0, true); const F = 1600;
  for (const [cx, cz, w, h] of [[0, -(HALF + F) / 2, F * 2 + HALF * 2, F], [0, (HALF + F) / 2, F * 2 + HALF * 2, F], [-(HALF + F) / 2, 0, F, HALF * 2], [(HALF + F) / 2, 0, F, HALF * 2]]) {
    const g = new THREE.PlaneGeometry(w, h, 60, 60); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz; const e = Math.max(Math.abs(x), Math.abs(z)) - HALF; p.setXYZ(i, x, e <= 0.5 ? 0 : (W.noise(x * 0.02, z * 0.02) * 14 + W.noise(x * 0.07, z * 0.07) * 3) * Math.min(1, e / 120), z); }
    g.computeVertexNormals(); const ms = new THREE.Mesh(g, m); ms.receiveShadow = true; scene.add(ms);
  }
  // 山なみ（地平線）
  const N = 220, R0 = 1500, g = new THREE.BufferGeometry(), pos = [], idx = [];
  for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; const hgt = 40 + Math.max(0, W.noise(Math.cos(a) * 9, Math.sin(a) * 9)) * 170 + W.noise(Math.cos(a) * 30, Math.sin(a) * 30) * 25; for (const [r, y] of [[R0 + 300, -5], [R0, hgt], [R0 - 260, 8]]) pos.push(Math.cos(a) * r, y, Math.sin(a) * r); }
  for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) { const a = i * 3 + k, b = (i + 1) * 3 + k; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x8a8578, roughness: 1, flatShading: true })));
  // 境界のポール
  const pm = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.4, roughness: 0.4 }), lm = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 0.9, 0.2), toneMapped: false });
  const pg = new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), lg = new THREE.SphereGeometry(0.1, 8, 6);
  for (let s = -HALF; s <= HALF; s += 16) for (const [x, z] of [[s, -HALF], [s, HALF], [-HALF, s], [HALF, s]]) { const a = new THREE.Mesh(pg, pm); a.position.set(x, 0.7, z); scene.add(a); const b = new THREE.Mesh(lg, lm); b.position.set(x, 1.45, z); scene.add(b); }
}

// 岩（インスタンス）
const BOULDERS = [];
{
  const mkRock = (seed, det) => { const g = new THREE.IcosahedronGeometry(1, det); const p = g.attributes.position; const r2 = (() => { let s = seed; return () => { s = (s * 48271) % 2147483647; return s / 2147483647; }; })(); const bumps = Array.from({ length: 6 }, () => new THREE.Vector3(r2() - 0.5, r2() - 0.5, r2() - 0.5).normalize()); const v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); let k = 1; for (const b of bumps) k -= Math.max(0, v.dot(b) - 0.55) * 0.9; v.multiplyScalar(k * (0.85 + r2() * 0.08)); v.y *= 0.62; p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; };
  const mat = new THREE.MeshStandardMaterial({ color: 0x6c6a66, roughness: 0.95, flatShading: true });
  const mat2 = new THREE.MeshStandardMaterial({ color: 0x8c8880, roughness: 0.98, flatShading: true });
  const place = (count, smin, smax, geo, mt, collide, nearCrater) => {
    const im = new THREE.InstancedMesh(geo, mt, count); const o = new THREE.Object3D(); let n = 0;
    for (let tries = 0; n < count && tries < count * 20; tries++) {
      let x = (rnd() * 2 - 1) * (HALF - 2), z = (rnd() * 2 - 1) * (HALF - 2);
      if (nearCrater && rnd() < 0.7) { const c = W.CRATERS[(rnd() * W.CRATERS.length) | 0]; const a = rnd() * 7, r = c.r * (0.95 + rnd() * 0.4); x = c.x + Math.cos(a) * r; z = c.z + Math.sin(a) * r; }
      if (Math.hypot(x, z) < 22 || Math.hypot(x - PAD.x, z - PAD.z) < 8) continue;
      const s = smin + (smax - smin) * rnd() ** 2;
      o.position.set(x, height(x, z) - s * 0.18, z); o.rotation.set((rnd() - 0.5) * 0.4, rnd() * 7, (rnd() - 0.5) * 0.4); o.scale.set(s * (0.8 + rnd() * 0.5), s, s * (0.8 + rnd() * 0.5)); o.updateMatrix(); im.setMatrixAt(n++, o.matrix);
      if (collide) BOULDERS.push({ x, z, r: s * 0.95 });
    }
    im.count = n; im.castShadow = GQ > 0; im.receiveShadow = true; scene.add(im);
  };
  const k = [0.35, 0.7, 1][GQ];
  place(Math.round(3200 * k), 0.04, 0.22, mkRock(11, 0), mat2, false, false);
  place(Math.round(500 * k), 0.15, 0.45, mkRock(23, 1), mat, false, true);
  place(70, 0.7, 2.2, mkRock(37, 2), mat, true, true);
  // 外の大岩
  const im = new THREE.InstancedMesh(mkRock(51, 1), mat, 120), o = new THREE.Object3D();
  for (let i = 0; i < 120; i++) { const a = rnd() * 7, r = HALF + 20 + rnd() * 600; o.position.set(Math.cos(a) * r, -1, Math.sin(a) * r); o.rotation.y = rnd() * 7; o.scale.setScalar(2 + rnd() * 9); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }
  scene.add(im);
}
function pushOut(o, rad) { for (const b of BOULDERS) { const dx = o.x - b.x, dz = o.z - b.z, l = Math.hypot(dx, dz), m = b.r + rad; if (l < m && l > 0.001) { o.x = b.x + dx / l * m; o.z = b.z + dz / l * m; } } }

// 文字のスプライト
function label(text, opt = {}) {
  const c = document.createElement('canvas'); const fs = 56; const x = c.getContext('2d'); x.font = `900 ${fs}px "M PLUS Rounded 1c", sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + 40; c.width = w; c.height = fs + 30;
  x.font = `900 ${fs}px "M PLUS Rounded 1c", sans-serif`; x.fillStyle = opt.bg || 'rgba(0,0,0,.6)'; x.beginPath(); x.roundRect(0, 0, w, c.height, 20); x.fill();
  x.fillStyle = opt.color || '#fff'; x.textBaseline = 'middle'; x.fillText(text, 20, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true, toneMapped: false })); const k = (opt.size || 0.6) / c.height; s.scale.set(w * k, c.height * k, 1); return s;
}
const emojiTex = {};
function emojiSprite(e, size = 1) {
  if (!emojiTex[e]) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(255,240,160,.9)'); g.addColorStop(1, 'rgba(255,200,80,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.font = '72px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 64, 70); emojiTex[e] = new THREE.CanvasTexture(c); emojiTex[e].colorSpace = THREE.SRGBColorSpace; }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex[e], depthWrite: false, transparent: true, toneMapped: false })); s.scale.set(size, size, 1); return s;
}
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.15 }, o));
const glow = (r, g, b) => new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false });
const metal = (c, r = 0.35) => std(c, { metalness: 0.85, roughness: r });

// 基地
const ringMat = c => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.8), transparent: true, opacity: 0.9, toneMapped: false });
function ringMesh(r, c) { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.08, 8, 48), ringMat(c)); t.rotation.x = Math.PI / 2; t.position.y = 0.1; g.add(t); const d = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.13, depthWrite: false })); d.rotation.x = -Math.PI / 2; d.position.y = 0.06; g.add(d); const col = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 48, 1, true), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, uniforms: { c: { value: new THREE.Color(c) } }, vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform vec3 c; varying vec2 vU; void main(){ gl_FragColor = vec4(c * pow(1.0 - vU.y, 3.0) * 0.22, 1.0); }' })); col.position.y = 1.5; g.add(col); return g; }
{
  const base = new THREE.Group();
  const white = std(0xeeeeec, { roughness: 0.45, metalness: 0.05 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), white); dome.position.set(0, 0, -4); base.add(dome);
  for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(5.03, 0.07, 6, 48, Math.PI), metal(0x9aa4ae)); r.position.set(0, 0, -4); r.rotation.y = i / 8 * Math.PI; base.add(r); }
  const ringB = new THREE.Mesh(new THREE.CylinderGeometry(5.15, 5.25, 0.5, 48), metal(0x7a828a, 0.5)); ringB.position.set(0, 0.25, -4); base.add(ringB);
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; if (Math.abs(Math.sin(a)) < 0.3 && Math.cos(a) > 0) continue; const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.05), glow(1.6, 1.4, 0.9)); w.position.set(Math.sin(a) * 4.62, 1.9, -4 + Math.cos(a) * 4.62); w.rotation.y = a; w.rotation.x = -0.35; base.add(w); }
  const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 2), white); door.position.set(0, 1.4, 0.6); base.add(door);
  const dw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.1, 0.05), std(0x223344, { emissive: 0x3a6aa0, emissiveIntensity: 0.9, metalness: 0.6, roughness: 0.2 })); dw.position.set(0, 1.15, 1.62); base.add(dw);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.18, 2.02), std(0xff8a2a)); stripe.position.set(0, 2.5, 0.6); base.add(stripe);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6), metal(0xcccccc)); ant.position.set(-3, 7, -6); base.add(ant);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(1.2, 24, 10, 0, Math.PI * 2, 0, 1.0), std(0xeeeeee, { side: THREE.DoubleSide, metalness: 0.3, roughness: 0.3 })); dish.position.set(-3, 9.6, -6); dish.rotation.x = -0.9; base.add(dish);
  const blink = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), glow(3, 0.2, 0.2)); blink.position.set(-3, 10.1, -6); base.add(blink); base.userData.blink = blink;
  const panelM = std(0x14204a, { metalness: 0.7, roughness: 0.22, emissive: 0x050a20 });
  for (let i = 0; i < 4; i++) { const pan = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 1.6), panelM); pan.position.set(-9 - i * 3.4, 1.5, -3); pan.rotation.x = -0.6; base.add(pan); const fr = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.04, 1.7), metal(0xaaaaaa)); fr.position.copy(pan.position); fr.position.y -= 0.03; fr.rotation.x = -0.6; base.add(fr); const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.5), metal(0x999999)); leg.position.set(-9 - i * 3.4, 0.75, -3); base.add(leg); }
  // タンクとコンテナ
  for (const [x, z] of [[6.5, -6], [7.8, -4.2]]) { const tk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.2, 24), metal(0xd8dde2, 0.3)); tk.position.set(x, 1.1, z); base.add(tk); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), metal(0xd8dde2, 0.3)); cap.position.set(x, 2.2, z); base.add(cap); }
  for (const [x, z, c] of [[-6.5, 5, 0x3a6aa0], [-7.2, 7.4, 0xc86a2a], [-5, 8, 0x8a9aa8]]) { const ct = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.2), std(c, { metalness: 0.5, roughness: 0.5 })); ct.position.set(x, 0.6, z); ct.rotation.y = x * 0.3; base.add(ct); }
  // 回収口
  const intake = ringMesh(3, 0xff9a3c); intake.position.set(INTAKE.x, 0, INTAKE.z); base.add(intake);
  const hop = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.7, 1.2, 24, 1, true), metal(0x666a70, 0.45)); hop.material.side = THREE.DoubleSide; hop.position.set(INTAKE.x, 0.6, INTAKE.z); base.add(hop);
  const hl2 = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.05, 6, 32), glow(2.4, 1.2, 0.3)); hl2.rotation.x = Math.PI / 2; hl2.position.set(INTAKE.x, 1.2, INTAKE.z); base.add(hl2);
  const sign = label('回収口（ここで売る）', { color: '#ffd9a0', size: 0.42 }); sign.position.set(INTAKE.x, 3.8, INTAKE.z); base.add(sign);
  const sign2 = label('月面管理局 LSD 清掃課', { color: '#fff', size: 0.7 }); sign2.position.set(0, 6.6, -4); base.add(sign2);
  const bl2 = new THREE.PointLight(0xffc890, 6, 16, 1.6); bl2.position.set(0, 3.2, 3); base.add(bl2);
  SH(base); scene.add(base); scene.userData.base = base;
}
// ガレージ
const garage = new THREE.Group();
{
  const b = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 7), std(0xd8dde2, { metalness: 0.3, roughness: 0.45 })); b.position.set(PAD.x + 1, 2, PAD.z - 8); garage.add(b);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.2, 8.2, 24, 1, false, 0, Math.PI), metal(0xb8c0c8, 0.4)); roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.scale.set(1, 1, 0.45); roof.position.set(PAD.x + 1, 4, PAD.z - 8); garage.add(roof);
  const dr = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 0.1), metal(0x55606a, 0.5)); dr.position.set(PAD.x + 1, 1.6, PAD.z - 4.45); garage.add(dr);
  for (let i = 0; i < 6; i++) { const ln = new THREE.Mesh(new THREE.BoxGeometry(5, 0.04, 0.12), metal(0x3a434c)); ln.position.set(PAD.x + 1, 0.4 + i * 0.5, PAD.z - 4.38); garage.add(ln); }
  const lt = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.12, 0.12), glow(0.6, 2.2, 1.2)); lt.position.set(PAD.x + 1, 3.35, PAD.z - 4.4); garage.add(lt);
  const pad = ringMesh(2.6, 0x7ff0a8); pad.position.set(PAD.x, 0, PAD.z); garage.add(pad);
  const s = label('ガレージ', { color: '#bfffd6', size: 0.6 }); s.position.set(PAD.x + 1, 5.2, PAD.z - 4.4); garage.add(s);
  SH(garage);
}
scene.add(garage);
const garageSign = label('ガレージ予定地（ショップで建設）', { color: '#ccc', size: 0.45 }); garageSign.position.set(PAD.x, 1.4, PAD.z - 4); scene.add(garageSign);

// 集積所
const depotMeshes = [];
function addDepotMesh(d) {
  const g = new THREE.Group(); g.add(ringMesh(2.2, 0x5cc8ff));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.2, 12), metal(0xdddddd)); pole.position.y = 1.6; g.add(pole);
  const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.9, 1.2), std(0x3a7ab0, { metalness: 0.5, roughness: 0.4 })); box.position.set(0.9, 0.45, 0.9); g.add(box);
  const stp = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.1, 1.22), glow(0.4, 1.4, 2.4)); stp.position.set(0.9, 0.75, 0.9); g.add(stp);
  const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), glow(0.6, 1.8, 3)); lampM.position.y = 3.3; g.add(lampM);
  g.position.set(d.x, height(d.x, d.z), d.z); SH(g); scene.add(g); depotMeshes.push(g);
}
S.depots.forEach(addDepotMesh);

// 宇宙飛行士（清掃員）— 体は影だけ（一人称のとき）
const P = { x: S.p.x, z: S.p.z, y: 0, vy: 0, yaw: S.p.yaw, sp: 0, brush: true, pack: 0, inCar: false, anim: 0 };
const pl = new THREE.Group();
const suit = std(0xf4f4f2, { roughness: 0.8, metalness: 0 }), orange = std(0xff8a2a), dark = std(0x30343a);
const body = new THREE.Group(); pl.add(body);
{
  const add = m => { body.add(m); return m; };
  add(new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.5, 6, 12), suit)).position.y = 0.95;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.09, 16), orange)).position.y = 0.82;
  const hd = add(new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), suit)); hd.position.y = 1.58; hd.name = 'head';
  const visor = add(new THREE.Mesh(new THREE.SphereGeometry(0.255, 24, 16, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.28, Math.PI * 0.42), std(0x2a2410, { metalness: 1, roughness: 0.08 }))); visor.position.set(0, 1.58, 0.06); visor.scale.setScalar(1.06); visor.name = 'head';
  add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.26), std(0xdedede))).position.set(0, 1.05, -0.36);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.27), orange)).position.set(0, 1.2, -0.36);
  for (const s of [-1, 1]) {
    const leg = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.35, 4, 8), suit)); leg.position.set(s * 0.15, 0.32, 0); leg.name = 'leg' + s;
    const boot = add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.3), dark)); boot.position.set(s * 0.15, 0.07, 0.04); boot.name = 'boot' + s;
    const arm = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.38, 4, 8), suit)); arm.position.set(s * 0.4, 1.05, 0.15); arm.rotation.x = -0.9;
  }
  const lsd = label('LSD', { bg: 'rgba(255,138,42,.95)', color: '#fff', size: 0.13 }); lsd.position.set(0, 1.12, 0.34); lsd.name = 'lsd'; body.add(lsd);
}
SH(body);
const toolG = new THREE.Group(); pl.add(toolG);
const capG = new THREE.Group(); capG.position.set(0, 1.0, -0.6); body.add(capG);
function buildTool() {
  toolG.clear(); const T = TOOLS[S.tool], w = T.w * wideK();
  const top = new THREE.Vector3(-0.3, 1.0, -0.2), bot = new THREE.Vector3(0, 0.08, 0.6), L = top.distanceTo(bot);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, L, 8), std(S.tool === 3 ? 0xc8b060 : S.tool === 5 ? 0xbfc6cc : 0x8a6a40, { metalness: S.tool === 5 ? 0.8 : 0.1 }));
  stick.position.copy(top).add(bot).multiplyScalar(0.5); stick.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(bot).normalize()); toolG.add(stick);
  const hc = [0x4ad0ff, 0xffd23a, 0xc8a060, 0xd8c070, 0xff6a3a, 0x7ff0a8][S.tool];
  const head = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, 0.14), std(hc, { metalness: 0.2, roughness: 0.4 })); head.position.set(0, 0.07, 0.65); toolG.add(head);
  const hair = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.07, 0.1), std(S.tool === 3 ? 0xd8c890 : 0xf6f6f0, { roughness: 0.95 })); hair.position.set(0, 0.015, 0.65); toolG.add(hair);
  const glove = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0xd8d8d0, { roughness: 0.9 })); glove.position.copy(top).lerp(bot, 0.04); toolG.add(glove);
  const glove2 = glove.clone(); glove2.position.copy(top).lerp(bot, 0.3); toolG.add(glove2);
  SH(toolG);
}
const capGeo = new THREE.CylinderGeometry(0.11, 0.11, 0.3, 16), capMat = metal(0xe8eef4, 0.25);
function buildCaps() { capG.clear(); S.caps.forEach((c, i) => { const m = new THREE.Mesh(capGeo, capMat); m.castShadow = true; m.position.set((i % 3 - 1) * 0.24, Math.floor(i / 3) * 0.34, 0); capG.add(m); }); setLayers(); }
const ghostM = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
function setLayers() { body.traverse(o => { if (o.isMesh) { o.userData.m = o.userData.m || o.material; o.material = FP ? ghostM : o.userData.m; } if (o.name === 'lsd') o.visible = !FP; }); }
const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function blob(r) { const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.visible = GQ === 0; scene.add(m); return m; }
const plShadow = blob(0.6);

// 視点
let FP = localStorage.getItem('tsukiview') !== 'tp'; const BOT_TP = false;
buildTool(); buildCaps(); scene.add(pl);

// 車
let carMesh = null;
function makeCarMesh(k) {
  const C = CARS[k], g = new THREE.Group(), s = [0.75, 1, 1.25, 1.6][k];
  const paint = std(C.col, { metalness: 0.45, roughness: 0.35 });
  const body2 = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.8, 0.6 * s, 2.2 * s), paint); body2.position.y = 0.72 * s; g.add(body2);
  const skirt = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.82, 0.12 * s, 2.25 * s), metal(0x30343a, 0.5)); skirt.position.y = 0.42 * s; g.add(skirt);
  const cab = new THREE.Group(); cab.name = 'cab'; g.add(cab);
  if (k > 0) {
    const frame = metal(0xd0d4d8, 0.4);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.8 * s), frame); p.position.set(x * C.w * 0.24, 1.42 * s, -0.2 * s + z * 0.42 * s); cab.add(p); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.56, 0.06 * s, 1.0 * s), paint); roof.position.set(0, 1.84 * s, -0.2 * s); cab.add(roof);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.5, 0.65 * s, 0.03), std(0x88aacc, { metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.25 })); glass.position.set(0, 1.45 * s, 0.24 * s); glass.rotation.x = -0.2; g.add(glass);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.5), std(0x333840)); seat.position.set(0, 1.08 * s, -0.35 * s); g.add(seat);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.5, 0.2 * s, 0.25 * s), std(0x22262c)); dash.position.set(0, 1.1 * s, 0.25 * s); g.add(dash);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3 * s, 0.12 * s), glow(0.3, 1.6, 1.0)); scr.position.set(0.15 * s, 1.21 * s, 0.12 * s); scr.rotation.x = -0.9; g.add(scr);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 20), std(0x111111)); wheel.position.set(-0.1 * s, 1.25 * s, 0.05 * s); wheel.rotation.x = -0.9; g.add(wheel);
  } else { const h = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.035, 6, 20, Math.PI), metal(0x444444)); h.position.set(0, 1.3, -1.3); h.rotation.x = -0.3; g.add(h); }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * s, 0.42 * s, C.w * 0.7, 24), metal(0xe8eef4, 0.25)); tank.rotation.z = Math.PI / 2; tank.position.set(0, 1.2 * s, -1.0 * s); g.add(tank);
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(C.w * 0.5, 0.06, 0.06), glow(0.4, 1.6, 2.4)); gauge.position.set(0, 1.62 * s, -1.0 * s); gauge.name = 'tankbar'; g.add(gauge);
  const wg = new THREE.CylinderGeometry(0.36 * s, 0.36 * s, 0.28 * s, 20); wg.rotateZ(Math.PI / 2);
  for (const [x, z] of [[-1, -0.7], [1, -0.7], [-1, 0.6], [1, 0.6]]) { const w = new THREE.Mesh(wg, dark); w.position.set(x * C.w * 0.42, 0.36 * s, z * s); w.name = 'wh'; g.add(w); const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 0.3 * s, 12).rotateZ(Math.PI / 2), metal(0xcccccc)); hub.position.copy(w.position); g.add(hub); }
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.22 * s, C.w, 20), std(0xffd23a, { roughness: 0.9 })); roll.rotation.z = Math.PI / 2; roll.position.set(0, 0.22 * s, 1.35 * s); roll.name = 'roll'; g.add(roll);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(C.w * 1.02, 0.08, 0.6 * s), paint); hood.position.set(0, 0.5 * s, 1.3 * s); g.add(hood);
  const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 8, 6), glow(3, 1.6, 0.3)); lampM.position.set(0, 1.92 * s, -0.2 * s); lampM.name = 'lamp'; cab.add(lampM);
  for (const sx of [-1, 1]) { const hlm = new THREE.Mesh(new THREE.CircleGeometry(0.09 * s, 12), glow(3, 3, 2.6)); hlm.position.set(sx * C.w * 0.3, 0.85 * s, 1.11 * s); g.add(hlm); }
  const sl = new THREE.SpotLight(0xfff0d8, 30, 30, 0.6, 0.6, 1.5); sl.position.set(0, 1 * s, 1.2 * s); sl.target.position.set(0, -1, 9); g.add(sl); g.add(sl.target); g.userData.sl = sl;
  SH(g); g.userData.k = k; return g;
}
const carShadow = blob(2.4); carShadow.visible = false;
function placeCar() {
  if (carMesh) { scene.remove(carMesh); carMesh = null; }
  if (!S.car) { carShadow.visible = false; return; }
  carMesh = makeCarMesh(S.car.k); scene.add(carMesh); carShadow.visible = GQ === 0; carShadow.scale.setScalar(CARS[S.car.k].w / 2.4 + 0.4);
}
placeCar();

// ロボ
const robotMeshes = [];
function makeRobotMesh(k) {
  const B = BOTS[k], g = new THREE.Group(), s = [0.5, 0.7, 1.1][k];
  const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.6 * s, 0.3 * s, 28), std(B.col, { metalness: 0.5, roughness: 0.35 })); bd.position.y = 0.2 * s; g.add(bd);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6 * s, 0.03 * s, 6, 28), glow(0.4, 1.6, 2.4)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.08 * s; rim.name = 'rim'; g.add(rim);
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x223344, { metalness: 0.9, roughness: 0.12 })); top.position.y = 0.35 * s; g.add(top);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * s, 8, 6), glow(0.5, 2.4, 1.2)); eye.position.set(0, 0.32 * s, 0.5 * s); eye.name = 'eye'; g.add(eye);
  const br = new THREE.Mesh(new THREE.BoxGeometry(B.w, 0.06, 0.12), std(0xffffff, { roughness: 0.95 })); br.position.set(0, 0.04, 0.55 * s); g.add(br);
  if (k === 2) for (const sd of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.6, 4, 6), metal(0xaaaaaa)); a.position.set(sd * 0.6, 0.7, 0.2); a.rotation.z = sd * 0.6; g.add(a); }
  if (GQ === 0) { const sh = blob(0.7 * s); scene.remove(sh); sh.position.y = 0.03; sh.visible = true; g.add(sh); }
  SH(g); scene.add(g); return g;
}
function syncRobotMeshes() { while (robotMeshes.length > S.robots.length) scene.remove(robotMeshes.pop()); S.robots.forEach((r, i) => { if (!robotMeshes[i] || robotMeshes[i].userData.k !== r.k) { if (robotMeshes[i]) scene.remove(robotMeshes[i]); robotMeshes[i] = makeRobotMesh(r.k); robotMeshes[i].userData.k = r.k; } }); }
syncRobotMeshes();

// 落とし物
const findMeshes = {};
function syncFinds() { for (const f of FINDS) { const show = !S.found.includes(f.id) && revealed(f); if (show && !findMeshes[f.id]) { const s = emojiSprite(f.ic, 1.1); s.position.set(f.x, height(f.x, f.z) + 0.8, f.z); scene.add(s); findMeshes[f.id] = s; } if (!show && findMeshes[f.id]) { scene.remove(findMeshes[f.id]); delete findMeshes[f.id]; } } }
function revealed(f) { let s = 0; for (const [a, b] of [[0, 0], [0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) s += D.at(f.x + a, f.z + b); return s / 5 < 40; }

// ホコリのつぶ（ふわっと低重力で舞う）
const PN = 700, pPos = new Float32Array(PN * 3), pVel = new Float32Array(PN * 3), pLife = new Float32Array(PN); let pI = 0;
const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const pTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); })();
const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xcfc6b4, size: 0.07, map: pTex, transparent: true, opacity: 0.85, depthWrite: false })); pts.frustumCulled = false; scene.add(pts);
for (let i = 0; i < PN; i++) pPos[i * 3 + 1] = -99;
function puff(x, y, z, n, spread) { for (let j = 0; j < n; j++) { const i = pI = (pI + 1) % PN; pPos[i * 3] = x + (Math.random() - 0.5) * spread; pPos[i * 3 + 1] = y + 0.04; pPos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.3; pVel[i * 3] = (Math.random() - 0.5) * 0.9; pVel[i * 3 + 1] = 0.4 + Math.random() * 1.1; pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.9; pLife[i] = 1.8 + Math.random() * 1.2; } }
function stepParticles(dt) { for (let i = 0; i < PN; i++) { if (pLife[i] <= 0) continue; pLife[i] -= dt; pVel[i * 3 + 1] -= 1.62 * dt; pPos[i * 3] += pVel[i * 3] * dt; pPos[i * 3 + 1] += pVel[i * 3 + 1] * dt; pPos[i * 3 + 2] += pVel[i * 3 + 2] * dt; if (pLife[i] <= 0 || pPos[i * 3 + 1] < height(pPos[i * 3], pPos[i * 3 + 2]) - 0.1) { pLife[i] = 0; pPos[i * 3 + 1] = -99; } } pGeo.attributes.position.needsUpdate = true; }

// ホコリのかたまり（近くだけ。掃除すると消える）
const FUZ_R = [7, 10, 13][GQ], FUZ_S = 0.3, FUZ_N = Math.ceil((FUZ_R * 2 / FUZ_S) ** 2);
const fuzGeo = (() => { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 0.85 + 0.2 * Math.sin(v.x * 9 + v.z * 7 + v.y * 5); v.multiplyScalar(k); v.y = Math.max(v.y, -0.1) * 0.38; p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); return g; })();
const fuz = new THREE.InstancedMesh(fuzGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0 }), FUZ_N);
fuz.instanceMatrix.setUsage(THREE.DynamicDrawUsage); fuz.frustumCulled = false; fuz.receiveShadow = GQ > 0; fuz.castShadow = false; fuz.visible = false;
fuz.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(FUZ_N * 3), 3);
const _o = new THREE.Object3D(), _c = new THREE.Color();
const fh = (i, j, k) => { const t = Math.sin(i * 127.1 + j * 311.7 + k * 74.7) * 43758.5453; return t - Math.floor(t); };
function updateFuzz() {
  const cx = Math.round(P.x / FUZ_S), cz = Math.round(P.z / FUZ_S), n = Math.ceil(FUZ_R / FUZ_S); let m = 0;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    if (m >= FUZ_N) break;
    const gi = cx + i, gj = cz + j; const x = (gi + fh(gi, gj, 1) - 0.5) * FUZ_S, z = (gj + fh(gi, gj, 2) - 0.5) * FUZ_S;
    const dd = Math.hypot(x - P.x, z - P.z); if (dd > FUZ_R) continue;
    if (Math.abs(x) > HALF - 0.3 || Math.abs(z) > HALF - 0.3) continue;
    const v = D.at(x, z) / 255; const r = fh(gi, gj, 3);
    if (v < 0.1 + r * 0.45) continue; // うすいところは少なく
    const s = (0.02 + 0.045 * Math.min(1, v * 1.3)) * (0.6 + fh(gi, gj, 4) * 0.9) * Math.min(1, (FUZ_R - dd) / 2.5);
    _o.position.set(x, height(x, z) + s * 0.05, z); _o.rotation.set(0, fh(gi, gj, 5) * 6.28, 0); _o.scale.set(s * (1 + fh(gi, gj, 6) * 0.6), s, s); _o.updateMatrix();
    fuz.setMatrixAt(m, _o.matrix);
    const b = 0.42 + v * 0.18 + fh(gi, gj, 7) * 0.1; _c.setRGB(b, b * 0.93, b * 0.8); fuz.setColorAt(m, _c); m++;
  }
  fuz.count = m; fuz.instanceMatrix.needsUpdate = true; fuz.instanceColor.needsUpdate = true;
}
let fuzT = 9;

// ---------- 入力 ----------
const keys = {}; const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0 };
let camYaw = S.p.yaw, camPitch = 0.42, camDist = 6, camDrag = null, fpPitch = -0.45, carLook = 0;
if (isTouch) document.body.classList.add('touch');
addEventListener('keydown', e => { if (e.target.tagName === 'INPUT') return; keys[e.code] = true; if (!playing || anyOpen()) { if (e.code === 'Escape') closeAll(); return; } if (e.code === 'KeyQ') doPack(); if (e.code === 'KeyF') toggleBrush(); if (e.code === 'KeyE') doRide(); if (e.code === 'KeyM') openMap(); if (e.code === 'KeyB') openShop(); if (e.code === 'KeyV') toggleView(); if (e.code === 'KeyL') toggleLamp(); if (e.code === 'Space') { jump(); e.preventDefault(); } });
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('pointerdown', e => {
  if (!playing) return;
  if (e.pointerType !== 'mouse' && e.clientX < innerWidth * 0.45 && stick.id == null) { stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = stick.y = 0; const s = $('stick'); s.hidden = false; s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.firstChild.style.transform = ''; }
  else if (e.pointerType === 'mouse' && FP && canvas.requestPointerLock && !document.pointerLockElement && !lockFail) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => { lockFail = true; }); } catch (er) { lockFail = true; } camDrag = { id: e.pointerId, x: e.clientX, y: e.clientY }; }
  else if (!camDrag) camDrag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
});
canvas.addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) { let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy; const l = Math.hypot(dx, dy), m = 50; if (l > m) { dx *= m / l; dy *= m / l; } stick.x = dx / m; stick.y = dy / m; $('stick').firstChild.style.transform = `translate(${dx}px,${dy}px)`; }
  else if (document.pointerLockElement === canvas) return;
  else if (camDrag && e.pointerId === camDrag.id) { look(e.clientX - camDrag.x, e.clientY - camDrag.y, e.pointerType === 'mouse' ? 1 : 1.4); camDrag.x = e.clientX; camDrag.y = e.clientY; }
});
let lockFail = false;
document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas && playing && !anyOpen()) look(e.movementX, e.movementY, 0.55); });
document.addEventListener('pointerlockerror', () => { lockFail = true; });
function look(dx, dy, k) {
  if (!FP) { camYaw -= dx * 0.006; camPitch = Math.max(0.12, Math.min(1.25, camPitch + dy * 0.004)); return; }
  if (P.inCar) { carLook = Math.max(-2.6, Math.min(2.6, carLook - dx * 0.004 * k)); }
  else camYaw -= dx * 0.004 * k;
  fpPitch = Math.max(-1.35, Math.min(0.95, fpPitch - dy * 0.0035 * k));
}
function toggleView() { FP = !FP; try { localStorage.setItem('tsukiview', FP ? 'fp' : 'tp'); } catch (e) {} setLayers(); if (!FP) { camYaw = P.inCar && S.car ? S.car.yaw : P.yaw; if (document.pointerLockElement) document.exitPointerLock(); } else { camYaw = P.inCar && S.car ? S.car.yaw : P.yaw; } toast(FP ? '一人称' : '三人称', 700); }
let lampOn = true; function toggleLamp() { lampOn = !lampOn; toast(lampOn ? 'ヘッドライト ON' : 'ヘッドライト OFF', 700); }
const endPtr = e => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; $('stick').hidden = true; } if (camDrag && e.pointerId === camDrag.id) camDrag = null; };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { camDist = Math.max(3, Math.min(40, camDist * (1 + Math.sign(e.deltaY) * 0.1))); e.preventDefault(); }, { passive: false });
const tap = (id, f) => $(id).addEventListener('click', e => { e.stopPropagation(); f(); });
tap('bPack', () => doPack()); tap('bBrush', () => toggleBrush()); tap('bRide', () => doRide()); tap('bJump', () => jump());
tap('bView', () => toggleView()); tap('bMap', () => openMap()); tap('bShop', () => openShop()); tap('bMenu', () => openMenu());
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => closeAll());
document.querySelectorAll('.scr').forEach(s => s.addEventListener('click', e => { if (e.target === s && s.id !== 'title' && s.id !== 'talk') closeAll(); }));
const anyOpen = () => ['shop', 'map', 'menu', 'talk'].some(id => !$(id).hidden);
function closeAll() {
  if (document.pointerLockElement) document.exitPointerLock(); for (const id of ['shop', 'map', 'menu']) $(id).hidden = true; }

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
  if (nearCar()) { P.inCar = true; carLook = 0; camYaw = S.car.yaw; fpPitch = -0.12; camDist = 9 + S.car.k * 3; toast(CARS[S.car.k].n + ' に乗った！', 1000); }
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
    let tsp;
    if (FP) { // 一人称：W/S で前後、A/D でハンドル
      const thr = -iz; tsp = thr > 0 ? C.sp * thr : C.sp * 0.4 * thr;
      c.yaw -= ix * dt * (1.9 - S.car.k * 0.25) * (P.sp < -0.1 ? -1 : 1) * Math.min(1, 0.35 + Math.abs(P.sp) / 3);
      if (!camDrag && Math.abs(P.sp) > 1) carLook *= Math.max(0, 1 - dt * 1.5);
      camYaw = c.yaw + carLook;
    } else {
      if (mag > 0.1) { const ty = Math.atan2(mx, mz); let d = ty - c.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); c.yaw += Math.sign(d) * Math.min(Math.abs(d), dt * (2.4 - S.car.k * 0.3)); }
      tsp = mag > 0.1 ? C.sp * mag * (0.55 + 0.45 * Math.max(0, Math.cos(Math.atan2(mx, mz) - c.yaw))) : 0;
    }
    P.sp += (tsp - P.sp) * Math.min(1, dt * 2.5);
    c.x = clampA(c.x + Math.sin(c.yaw) * P.sp * dt); c.z = clampA(c.z + Math.cos(c.yaw) * P.sp * dt); pushOut(c, CARS[c.k].w * 0.45);
    const w = C.w * wideK(), fx = c.x + Math.sin(c.yaw) * (1.2 + S.car.k * 0.4), fz = c.z + Math.cos(c.yaw) * (1.2 + S.car.k * 0.4);
    const room = C.cap - c.kg;
    if (room > 0.001 && P.sp > 0.3) { const [kg, val] = sweepAt(fx, fz, c.yaw, w, 1.0, C.pw * 8, dt, room); c.kg += kg; c.val += val; if (kg > 0 && Math.random() < 0.6) puff(fx, height(fx, fz), fz, 2 + S.car.k, w); }
    P.x = c.x; P.z = c.z; P.y = height(c.x, c.z);
    const [dd, dl] = nearestDepot(c.x, c.z); if (dl < dd.r + C.w * 0.4 && c.kg > 0.01) sellAll(dd.main ? '回収口' : '集積所');
  } else {
    let sp = walkSp() * (P.brush ? 0.72 : 1.25) * mag; if (P.pack > 0) sp *= 0.3;
    const tx = mx * sp, tz = mz * sp;
    P.vx = (P.vx || 0) + (tx - (P.vx || 0)) * Math.min(1, dt * 8); P.vz = (P.vz || 0) + (tz - (P.vz || 0)) * Math.min(1, dt * 8);
    P.x = clampA(P.x + P.vx * dt); P.z = clampA(P.z + P.vz * dt); pushOut(P, 0.35);
    const v = Math.hypot(P.vx, P.vz); P.sp = v;
    if (FP) P.yaw = camYaw; else if (v > 0.2) { let d = Math.atan2(P.vx, P.vz) - P.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); P.yaw += d * Math.min(1, dt * 10); }
    const gh = height(P.x, P.z); P.vy -= 1.62 * dt; P.y += P.vy * dt; if (P.y <= gh) { P.y = gh; P.vy = 0; }
    // 掃く
    const T = TOOLS[S.tool], cap = gaugeCap(); const room = cap - S.g.kg;
    if (P.brush && P.pack <= 0 && P.y < gh + 0.1 && room > 0.0005) {
      const w = T.w * wideK(), fx = P.x + Math.sin(P.yaw) * 1.15, fz = P.z + Math.cos(P.yaw) * 1.15;
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
const _v = new THREE.Vector3();
function render(dt) {
  const fp = FP && !BOT_TP;
  pl.visible = !P.inCar;
  pl.position.set(P.x, P.y, P.z); pl.rotation.y = P.yaw;
  P.anim += dt * (2 + P.sp * 2.5);
  const sw = P.sp > 0.2 ? Math.sin(P.anim) : 0;
  for (const s of [-1, 1]) { const l = body.getObjectByName('leg' + s), b = body.getObjectByName('boot' + s); l.position.z = sw * 0.12 * s; b.position.z = 0.04 + sw * 0.16 * s; }
  const swing = P.brush ? Math.sin(P.anim * 1.7) * (P.sp > 0.2 ? 1 : 0.5) : 0;
  toolG.position.set(swing * 0.14, P.brush ? 0 : 0.45, P.brush ? 0.5 : 0.1);
  toolG.rotation.set(P.brush ? 0 : -0.7, swing * 0.18, 0);
  pl.position.y += P.pack > 0 ? Math.abs(Math.sin(P.pack * 18)) * 0.05 : 0;
  plShadow.position.set(P.x, height(P.x, P.z) + 0.03, P.z); plShadow.visible = GQ === 0 && !P.inCar;
  if (carMesh && S.car) {
    const c = S.car; const y = height(c.x, c.z); carMesh.position.set(c.x, y, c.z);
    const f = height(c.x + Math.sin(c.yaw) * 1.2, c.z + Math.cos(c.yaw) * 1.2), b = height(c.x - Math.sin(c.yaw) * 1.2, c.z - Math.cos(c.yaw) * 1.2);
    const lft = height(c.x + Math.cos(c.yaw) * 1, c.z - Math.sin(c.yaw) * 1), rgt = height(c.x - Math.cos(c.yaw) * 1, c.z + Math.sin(c.yaw) * 1);
    carMesh.rotation.set(0, 0, 0); carMesh.rotation.y = c.yaw; carMesh.rotateX(-Math.atan2(f - b, 2.4)); carMesh.rotateZ(Math.atan2(lft - rgt, 2) * -1);
    const r = carMesh.getObjectByName('roll'); if (r && P.inCar) r.rotation.x += dt * 14 * Math.sign(P.sp || 0);
    carMesh.traverse(o => { if (o.name === 'wh' && P.inCar) o.rotation.x += P.sp * dt * 2.5; });
    const lp = carMesh.getObjectByName('lamp'); if (lp) lp.visible = !P.inCar || Math.sin(tAll * 8) > 0;
    const tb = carMesh.getObjectByName('tankbar'); if (tb) tb.scale.x = Math.max(0.02, c.kg / CARS[c.k].cap);
    carMesh.getObjectByName('cab').traverse(o => o.layers.set(fp && P.inCar ? 1 : 0));
    carMesh.userData.sl.intensity = P.inCar && lampOn ? 30 : 0;
    carShadow.position.set(c.x, y + 0.03, c.z);
  }
  S.robots.forEach((r, i) => { const m = robotMeshes[i]; if (!m) return; m.position.set(r.x, height(r.x, r.z), r.z); m.rotation.y = r.yaw; const e = m.getObjectByName('eye'); if (e) e.material.color.setRGB(...(r.st === 'go' ? [2.4, 1.2, 0.3] : [0.5, 2.4, 1.2])); });
  for (const id in findMeshes) { const m = findMeshes[id]; m.position.y = height(m.position.x, m.position.z) + 0.8 + Math.sin(tAll * 3 + +id) * 0.12; }
  const bl = scene.userData.base.userData.blink; bl.visible = Math.sin(tAll * 4) > 0;
  garage.visible = S.garage; garageSign.visible = !S.garage;
  scene.userData.earth.rotation.y += dt * 0.005;
  stepParticles(dt);
  texT += dt; if (texT > 0.08) { texT = 0; for (let t = 0; t < 16; t++) if (D.dirty[t]) { D.dirty[t] = 0; texs[t].needsUpdate = true; } }
  // カメラ
  if (fp) {
    let ex, ey, ez;
    if (P.inCar && S.car) { const s = [0.75, 1, 1.25, 1.6][S.car.k]; carMesh.updateMatrixWorld(); _v.set(0, S.car.k === 0 ? 1.75 : 1.8 * s, S.car.k === 0 ? -1.6 : -0.35 * s); carMesh.localToWorld(_v); ex = _v.x; ey = _v.y; ez = _v.z; }
    else { const bob = P.sp > 0.3 && P.y < height(P.x, P.z) + 0.05 ? Math.abs(Math.sin(P.anim)) * 0.045 : 0; ex = P.x + Math.sin(P.yaw) * 0.12; ey = P.y + 1.6 + bob; ez = P.z + Math.cos(P.yaw) * 0.12; }
    camera.position.set(ex, ey, ez);
    camera.rotation.set(fpPitch, camYaw + Math.PI, 0);
    if (camera.fov !== 72) { camera.fov = 72; camera.updateProjectionMatrix(); }
    lamp.intensity = lampOn && !P.inCar ? 7 : 0;
  } else {
    const tx = P.x, tz = P.z, ty = P.y + (P.inCar ? 1.6 : 1.1);
    const want = { x: tx - Math.sin(camYaw) * Math.cos(camPitch) * camDist, y: ty + Math.sin(camPitch) * camDist, z: tz - Math.cos(camYaw) * Math.cos(camPitch) * camDist };
    want.y = Math.max(want.y, height(want.x, want.z) + 0.6);
    camera.position.lerp(_v.set(want.x, want.y, want.z), Math.min(1, dt * 10));
    camera.lookAt(tx, ty, tz);
    if (camera.fov !== 55) { camera.fov = 55; camera.updateProjectionMatrix(); }
    lamp.intensity = 0;
    if (!camDrag && P.sp > 1 && !BOT) { const back = (P.inCar && S.car ? S.car.yaw : P.yaw); let d = back - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * Math.min(1, dt * 0.6); }
  }
  // 影のカメラはプレイヤーについていく
  sunL.target.position.set(P.x + Math.sin(camYaw) * 10, 0, P.z + Math.cos(camYaw) * 10); sunL.position.copy(sunL.target.position).addScaledVector(SUN, 120);
  document.body.classList.toggle('fp', fp && !P.inCar); document.body.classList.toggle('incar', P.inCar);
  if (composer) composer.render(dt); else renderer.render(scene, camera);
}

// HUD
let lastSec = -1;
function hud() {
  $('money').textContent = fmt$(S.money);
  const t = sectorOf(P.x, P.z), sp = D.pct(t), tp = D.pct();
  if (t !== lastSec) { if (lastSec >= 0) log(`📍 ${SECTORS[t]}（$${sectorPrice(t)}/kg）`); lastSec = t; tileMat.forEach((m, i) => m.userData.u.hl.value = i === t ? 1 : 0); }
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
  { const yaw = P.inCar && S.car ? S.car.yaw : P.yaw, ahead = P.inCar && S.car ? 1.2 + S.car.k * 0.4 : 1.15; const v = D.at(P.x + Math.sin(yaw) * ahead, P.z + Math.cos(yaw) * ahead) / 255; const lv = v < 0.05 ? 'ピカピカ✨' : v < 0.2 ? 'ほんの少し' : v < 0.45 ? 'すこし' : v < 0.7 ? 'ふつう' : 'たっぷり！'; $('dmTxt').textContent = 'ブラシの下のホコリ：' + lv; $('dmBar').style.width = Math.min(100, v * 110) + '%'; $('dm').hidden = !P.brush && !P.inCar; }
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
  S.car = { k, x: PAD.x, z: PAD.z, yaw: 0, kg: Math.min(keep.kg, CARS[k].cap), val: keep.val };
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
document.querySelectorAll('#gfxRow button').forEach(b => { b.classList.toggle('on', +b.dataset.g === GQ); b.onclick = () => { try { localStorage.setItem(GFX_KEY, b.dataset.g); } catch (e) {} save(); location.reload(); }; });
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
    if (FP) { const ang = Math.atan2(dx, dz); if (P.inCar) { let d = ang - S.car.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); return [-Math.max(-1, Math.min(1, d * 2)) / 0.7, -1 / 0.7]; } let d = ang - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * Math.min(1, dt * 6); return [0, -Math.max(0.2, Math.cos(d))]; }
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
window.TSUKI = { S, D, P, act: a => shopAct(a), ride: () => doRide(), view: () => toggleView(), setLook: (y, p) => { camYaw = y; fpPitch = p; }, get stats() { return { money: S.money | 0, tool: S.tool, pct: +D.pct().toFixed(3), robots: S.robots.length, cars: S.cars, inCar: P.inCar, depots: S.depots.length, found: S.found.length, done: S.done.length, time: S.st.time | 0, kg: +S.st.kg.toFixed(1), up: S.up }; }, start };
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
