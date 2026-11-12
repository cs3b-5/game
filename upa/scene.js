// うぱるぱスピリッツ：3D の球場とウーパールーパーたち
import * as THREE from './vendor/three.module.min.js';
import { BASES, fenceR, FENCE_H, ZONE, FIELDERS, FIELD_ORDER, SKINS, pitchPos } from './engine.js';

const V3 = THREE.Vector3;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function createWorld(canvas) {
  const lowGPU = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowGPU ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x2a2350, 140, 420);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 900);

  // ---------- 空 ----------
  const skyStar = { value: 1 };
  {
    const g = new THREE.SphereGeometry(600, 32, 16);
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#141238') }, mid: { value: new THREE.Color('#5a3a8a') }, low: { value: new THREE.Color('#ff9a6a') }, star: skyStar },
      vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 low; uniform float star; varying vec3 vp;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
        void main(){ float y = normalize(vp).y; vec3 c = mix(low, mid, smoothstep(-.02, .18, y)); c = mix(c, top, smoothstep(.18, .65, y));
          vec2 sp = floor(normalize(vp).xz * 380.); float s = step(.9965, h(sp)) * smoothstep(.25, .6, y);
          gl_FragColor = vec4(c + s * .8 * star, 1.); }`,
    });
    scene.add(new THREE.Mesh(g, m)); var skyMat = m;
  }

  // ---------- 光 ----------
  const hemi = new THREE.HemisphereLight(0xbcc8ff, 0x3a5a2a, 0.9); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dd, 2.2);
  sun.position.set(-30, 60, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(lowGPU ? 1024 : 2048, lowGPU ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 40, bottom: -60, near: 10, far: 160 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, -22); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xffb0d0, 0.5); fill.position.set(30, 20, -60); scene.add(fill);

  // ---------- グラウンド（1枚の絵に描く） ----------
  const FW = 280, FC = [0, -95]; // 280m四方、中心
  const tex = (() => {
    const N = lowGPU ? 2048 : 4096, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), s = N / FW;
    const P = (x, z) => [(x - FC[0] + FW / 2) * s, (z - FC[1] + FW / 2) * s];
    g.fillStyle = '#2f6b34'; g.fillRect(0, 0, N, N);
    // 芝のしま模様（ホームから放射＋同心円のチェック）
    g.save();
    const [hx, hz] = P(0, 0);
    for (let i = 0; i < 26; i++) {
      g.beginPath(); g.moveTo(hx, hz);
      const a0 = -Math.PI / 2 - 0.9 + i * 0.07, a1 = a0 + 0.035;
      g.arc(hx, hz, 200 * s, a0, a1); g.closePath();
      g.fillStyle = 'rgba(255,255,255,.045)'; g.fill();
    }
    for (let r = 10; r < 130; r += 8) { g.beginPath(); g.arc(hx, hz, r * s, 0, Math.PI * 2); g.arc(hx, hz, (r + 4) * s, 0, Math.PI * 2, true); g.fillStyle = 'rgba(0,0,0,.05)'; g.fill(); }
    g.restore();
    // 外野のフェンス前（ウォーニングトラック）
    g.beginPath();
    for (let a = -50; a <= 50; a++) { const p = a * Math.PI / 180, R = fenceR(Math.max(-Math.PI / 4, Math.min(Math.PI / 4, p))) + 2; const [x, z] = P(Math.sin(p) * R, -Math.cos(p) * R); a === -50 ? g.moveTo(x, z) : g.lineTo(x, z); }
    for (let a = 50; a >= -50; a--) { const p = a * Math.PI / 180, R = fenceR(Math.max(-Math.PI / 4, Math.min(Math.PI / 4, p))) - 4.5; const [x, z] = P(Math.sin(p) * R, -Math.cos(p) * R); g.lineTo(x, z); }
    g.closePath(); g.fillStyle = '#9a6a48'; g.fill();
    // 内野の土（ホーム中心の扇形）
    const dirt = '#b9825a';
    g.beginPath(); g.moveTo(...P(0, 0));
    const [mx, mz] = P(0, -18.44);
    g.arc(mx, mz, 29 * s, -Math.PI / 2 - 0.95, -Math.PI / 2 + 0.95); g.closePath(); g.fillStyle = dirt; g.fill();
    // 内野の芝（正方形）
    g.beginPath(); const d = 27.43 / Math.SQRT2 - 1.4;
    g.moveTo(...P(0, -2.6)); g.lineTo(...P(d, -d - 1.2)); g.lineTo(...P(0, -38.8 + 2.4)); g.lineTo(...P(-d, -d - 1.2)); g.closePath();
    g.fillStyle = '#357a3b'; g.fill();
    // 走路
    g.strokeStyle = dirt; g.lineWidth = 1.2 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(...P(...BASES[0])); for (const b of [1, 2, 3, 0]) g.lineTo(...P(...BASES[b])); g.stroke();
    for (const b of BASES) { g.beginPath(); g.arc(...P(...b), 2.8 * s, 0, Math.PI * 2); g.fillStyle = dirt; g.fill(); }
    // マウンド・ホームまわり
    g.beginPath(); g.arc(mx, mz, 2.9 * s, 0, Math.PI * 2); g.fillStyle = '#c48e64'; g.fill();
    g.beginPath(); g.arc(...P(0, 0), 4 * s, 0, Math.PI * 2); g.fillStyle = dirt; g.fill();
    // ファウルライン
    g.strokeStyle = '#f4f1ea'; g.lineWidth = Math.max(2, 0.12 * s);
    for (const sg of [-1, 1]) { g.beginPath(); g.moveTo(...P(0, 0)); g.lineTo(...P(sg * 120, -120)); g.stroke(); }
    // 土に少しムラ
    for (let i = 0; i < 2500; i++) { const x = Math.random() * N, z = Math.random() * N; g.fillStyle = `rgba(${Math.random() < .5 ? '0,0,0' : '255,255,255'},.035)`; g.fillRect(x, z, 3, 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  })();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FW, FW), new THREE.MeshStandardMaterial({ map: tex, roughness: .95 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(FC[0], 0, FC[1]); ground.receiveShadow = true; scene.add(ground);
  const outer = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: 0x24502a, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.y = -0.02; scene.add(outer);

  // ホームまわりの細かい絵（打席・ホームベース）
  {
    const N = 512, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const W = 8, s = N / W, P = (x, z) => [(x + W / 2) * s, (z + W / 2) * s];
    g.clearRect(0, 0, N, N);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.07 * s;
    for (const sg of [-1, 1]) { g.strokeRect(...P(sg > 0 ? 0.38 : -1.6, -0.95), 1.22 * s, 1.83 * s); }
    g.strokeRect(...P(-0.55, 0.4), 1.1 * s, 2.4 * s); // キャッチャーボックス
    g.beginPath(); g.moveTo(...P(-0.216, 0)); g.lineTo(...P(0.216, 0)); g.lineTo(...P(0.216, 0.216)); g.lineTo(...P(0, 0.43)); g.lineTo(...P(-0.216, 0.216)); g.closePath(); g.fillStyle = '#fff'; g.fill();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(W, W), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: .9, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(0, 0.012, 0); m.receiveShadow = true; scene.add(m);
  }
  // ベース・マウンドのプレート
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .6 });
  for (const b of BASES.slice(1)) { const m = new THREE.Mesh(new THREE.BoxGeometry(.42, .08, .42), white); m.position.set(b[0], .04, b[1]); m.rotation.y = Math.PI / 4; m.castShadow = true; scene.add(m); }
  { const m = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 3.2, .25, 32), new THREE.MeshStandardMaterial({ color: 0xc48e64, roughness: 1 })); m.position.set(0, .05, -18.44); m.receiveShadow = true; scene.add(m);
    const r = new THREE.Mesh(new THREE.BoxGeometry(.6, .04, .15), white); r.position.set(0, .2, -18.44); scene.add(r); }

  // ---------- フェンスとスタンド ----------
  const rin = phDeg => { const a = Math.abs(phDeg); return a <= 45 ? fenceR(phDeg * Math.PI / 180) : lerp(fenceR(Math.PI / 4), 22, Math.min(1, (a - 45) / 95)); };
  const stands = new THREE.Group(); scene.add(stands);
  {
    // フェンス
    const pos = [], col = [], idx = [];
    const steps = 140, A0 = -138, A1 = 138;
    for (let i = 0; i <= steps; i++) {
      const a = lerp(A0, A1, i / steps), p = a * Math.PI / 180, R = rin(a), h = Math.abs(a) <= 45 ? FENCE_H : 1.3;
      const x = Math.sin(p) * R, z = -Math.cos(p) * R;
      pos.push(x, 0, z, x, h, z);
      const c = new THREE.Color(Math.abs(a) <= 45 ? '#1d4a3a' : '#28304a'); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (i < steps) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const wall = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .8, side: THREE.DoubleSide })); stands.add(wall);
    // 黄色いライン
    const lp = []; for (let i = 0; i <= steps; i++) { const a = lerp(-45, 45, i / steps), p = a * Math.PI / 180, R = rin(a); lp.push(new V3(Math.sin(p) * R, FENCE_H + .02, -Math.cos(p) * R)); }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(lp), 120, .07, 6), new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0x6a5000 })); stands.add(tube);
    // 段々のスタンド
    const rows = 16, sp = [], sc = [], si = [];
    const seatA = new THREE.Color('#3b3f6a'), seatB = new THREE.Color('#2e3258');
    for (let r = 0; r < rows; r++) {
      const base = sp.length / 3;
      for (let i = 0; i <= steps; i++) {
        const a = lerp(A0, A1, i / steps), p = a * Math.PI / 180, R = rin(a) + 1.5 + r * 1.6, h = (Math.abs(a) <= 45 ? FENCE_H + 1 : 2) + r * 1.05;
        const x = Math.sin(p), z = -Math.cos(p);
        sp.push(x * R, h, z * R, x * (R + 1.6), h, z * (R + 1.6), x * (R + 1.6), h + 1.05, z * (R + 1.6));
        const c = r % 2 ? seatA : seatB; for (let k = 0; k < 3; k++) sc.push(c.r, c.g, c.b);
        if (i < steps) { const k = base + i * 3; si.push(k, k + 3, k + 1, k + 1, k + 3, k + 4, k + 1, k + 4, k + 2, k + 2, k + 4, k + 5); }
      }
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.Float32BufferAttribute(sc, 3)); sg.setIndex(si); sg.computeVertexNormals();
    stands.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .9, side: THREE.DoubleSide })));
  }
  // 観客（小さなウーパーたち）
  const crowd = (() => {
    const n = lowGPU ? 2600 : 5200;
    const geo = new THREE.SphereGeometry(.42, 8, 6); geo.scale(1.2, 1, 1);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: .7 }), n);
    const base = [], col = new THREE.Color(), m = new THREE.Matrix4();
    const palette = Object.values(SKINS).map(s => s.body).concat(['#ff5c8a', '#2ab37a', '#5a8cff', '#ffb020', '#ffffff']);
    for (let i = 0; i < n; i++) {
      const a = (Math.random() * 2 - 1) * 136, p = a * Math.PI / 180, r = Math.floor(Math.random() * 16);
      const R = rin(a) + 1.5 + r * 1.6 + .8, h = (Math.abs(a) <= 45 ? FENCE_H + 1 : 2) + r * 1.05 + .45;
      base.push([Math.sin(p) * R, h, -Math.cos(p) * R, Math.random() * 6.28]);
      m.makeTranslation(base[i][0], h, base[i][2]); im.setMatrixAt(i, m);
      im.setColorAt(i, col.set(palette[Math.floor(Math.random() * palette.length)]));
    }
    stands.add(im);
    return { im, base, n, m, jump: 0 };
  })();
  // 照明塔
  const glows = [], panels = [];
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(.25, 'rgba(255,240,200,.55)'); gr.addColorStop(1, 'rgba(255,220,180,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  for (const a of [-70, -28, 28, 70]) {
    const p = a * Math.PI / 180, R = rin(a) + 34, x = Math.sin(p) * R, z = -Math.cos(p) * R;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.6, .9, 44, 8), new THREE.MeshStandardMaterial({ color: 0x3a3f5a })); pole.position.set(x, 22, z); scene.add(pole);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6e0, emissiveIntensity: 1.6 })); panel.position.set(x, 46, z); panel.lookAt(0, 0, -30); scene.add(panel);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); sp.scale.set(48, 48, 1); sp.position.set(x, 46, z); scene.add(sp);
    glows.push(sp); panels.push(panel);
  }
  // スコアボード
  const board = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 400;
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(36, 14), new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .9 }));
    m.position.set(0, 30, -146); scene.add(m);
    const back = new THREE.Mesh(new THREE.BoxGeometry(38, 16, 1.5), new THREE.MeshStandardMaterial({ color: 0x1a1a2a })); back.position.set(0, 30, -147); scene.add(back);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(4, 24, 2), new THREE.MeshStandardMaterial({ color: 0x2a2a3a })); leg.position.set(0, 11, -147); scene.add(leg);
    return { c, t };
  })();

  // ---------- ウーパールーパー ----------
  const geoCache = {};
  const G = (k, f) => geoCache[k] || (geoCache[k] = f());
  const matCache = {};
  const M = (k, f) => matCache[k] || (matCache[k] = f());
  const skinMat = sk => M('s' + sk.body, () => new THREE.MeshPhysicalMaterial({ color: sk.body, roughness: .38, clearcoat: .7, clearcoatRoughness: .25, sheen: .4, sheenColor: new THREE.Color(sk.belly) }));
  const gillMat = sk => M('g' + sk.gill, () => new THREE.MeshStandardMaterial({ color: sk.gill, roughness: .5, emissive: sk.gill, emissiveIntensity: .12 }));
  const flat = c => M('f' + c, () => new THREE.MeshStandardMaterial({ color: c, roughness: .65 }));
  const letterTex = {};
  function chestTex(team) {
    if (letterTex[team.id]) return letterTex[team.id];
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = team.c2; g.fillRect(0, 0, 256, 128);
    g.font = '900 64px "Noto Sans JP", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = team.cap; g.strokeText('UPA', 128, 64); g.fillStyle = team.c; g.fillText('UPA', 128, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return (letterTex[team.id] = t);
  }

  function makeUpa(skinId, team, opt = {}) {
    const sk = SKINS[skinId] || SKINS.pink;
    const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
    const add = (parent, geo, mat, x, y, z, sh = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sh; parent.add(m); return m; };
    const S = skinMat(sk), J = flat(team.c2), T = flat(team.c), C = flat(team.cap);
    // 足
    const legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group(); hip.position.set(sx * .1, .34, 0); body.add(hip);
      add(hip, G('leg', () => new THREE.CapsuleGeometry(.075, .16, 4, 10)), J, 0, -.14, 0);
      add(hip, G('sock', () => new THREE.CylinderGeometry(.07, .07, .07, 10)), T, 0, -.24, 0);
      const ft = add(hip, G('foot', () => { const g = new THREE.SphereGeometry(.085, 12, 8); g.scale(1, .5, 1.4); return g; }), S, 0, -.3, .04);
      legs.push(hip); void ft;
    }
    // しっぽ
    const tail = new THREE.Group(); tail.position.set(0, .4, -.14); body.add(tail);
    { const g = G('tail', () => { const g = new THREE.ConeGeometry(.12, .5, 12); g.rotateX(-Math.PI / 2 - .5); g.scale(.55, 1, 1); g.translate(0, -.12, -.2); return g; }); add(tail, g, S, 0, 0, 0);
      const fin = add(tail, G('fin', () => { const g = new THREE.SphereGeometry(.2, 12, 8); g.scale(.08, .5, 1.3); g.translate(0, -.04, -.26); g.rotateX(-.5); return g; }), gillMat(sk), 0, 0, 0); fin.material = gillMat(sk); }
    // 胴（ユニフォーム）
    const torso = new THREE.Group(); torso.position.y = .5; body.add(torso);
    add(torso, G('torso', () => { const g = new THREE.CapsuleGeometry(.2, .2, 6, 16); g.scale(1.05, 1, .85); return g; }), J, 0, .08, 0);
    add(torso, G('belt', () => new THREE.TorusGeometry(.19, .025, 6, 20).rotateX(Math.PI / 2)), C, 0, -.08, 0);
    { const p = add(torso, G('chest', () => new THREE.PlaneGeometry(.26, .13)), M('chest' + team.id, () => new THREE.MeshStandardMaterial({ map: chestTex(team), roughness: .7 })), 0, .14, .172, false); p.rotation.x = -.08; }
    // 袖の線
    // 腕
    const arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * .21, .2, 0); torso.add(sh);
      add(sh, G('sleeve', () => new THREE.CapsuleGeometry(.06, .07, 4, 8)), T, 0, -.05, 0);
      add(sh, G('arm', () => new THREE.CapsuleGeometry(.05, .12, 4, 8)), S, 0, -.17, 0);
      add(sh, G('hand', () => new THREE.SphereGeometry(.055, 10, 8)), S, 0, -.27, 0);
      sh.rotation.z = sx * .35; arms.push(sh);
    }
    // 頭
    const head = new THREE.Group(); head.position.set(0, .96, .02); body.add(head);
    add(head, G('head', () => { const g = new THREE.SphereGeometry(.3, 28, 20); g.scale(1.32, .92, 1.1); return g; }), S, 0, 0, 0);
    add(head, G('chin', () => { const g = new THREE.SphereGeometry(.24, 20, 12); g.scale(1.3, .55, 1.1); return g; }), M('b' + sk.belly, () => new THREE.MeshPhysicalMaterial({ color: sk.belly, roughness: .4, clearcoat: .6 })), 0, -.12, .06);
    // 目
    const eyeM = M('e' + sk.eye, () => new THREE.MeshStandardMaterial({ color: sk.eye, roughness: .15, metalness: .1 }));
    for (const sx of [-1, 1]) {
      add(head, G('eye', () => new THREE.SphereGeometry(.05, 14, 10)), eyeM, sx * .22, .05, .26, false);
      add(head, G('hi', () => new THREE.SphereGeometry(.015, 8, 6)), M('hi', () => new THREE.MeshBasicMaterial({ color: 0xffffff })), sx * .21 + .01, .075, .305, false);
      const ck = add(head, G('cheek', () => new THREE.CircleGeometry(.05, 16)), M('ck', () => new THREE.MeshBasicMaterial({ color: 0xff6f8f, transparent: true, opacity: .35, depthWrite: false })), sx * .27, -.04, .245, false);
      ck.lookAt(sx * 1.2, -.1, 1.4);
    }
    { const m = add(head, G('mouth', () => new THREE.TorusGeometry(.12, .011, 6, 20, Math.PI * .8)), M('mo', () => new THREE.MeshBasicMaterial({ color: 0x40202a })), 0, -.03, .3, false); m.rotation.z = Math.PI + Math.PI * .1; m.rotation.x = -.25; }
    // 帽子
    const capG = new THREE.Group(); capG.position.set(0, .13, -.02); capG.rotation.x = -.12; head.add(capG);
    add(capG, G('cap', () => { const g = new THREE.SphereGeometry(.27, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.scale(1.02, .78, 1); return g; }), C, 0, 0, 0);
    add(capG, G('brim', () => { const g = new THREE.CylinderGeometry(.2, .2, .025, 20, 1, false, -Math.PI / 2, Math.PI); g.scale(1, 1, 1.05); return g; }), T, 0, .005, .16);
    add(capG, G('btn', () => new THREE.SphereGeometry(.03, 8, 6)), T, 0, .21, 0);
    // 外エラ（左右3本ずつ、ふりふり）
    const gills = [];
    const gm = gillMat(sk);
    for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
      const piv = new THREE.Group(); piv.position.set(sx * .34, .1 - i * .085, -.06 - i * .02); head.add(piv);
      const len = [.24, .28, .22][i];
      const stalk = add(piv, G('gs' + i, () => new THREE.CapsuleGeometry(.024, len, 4, 8).translate(0, len / 2, 0)), gm, 0, 0, 0, false);
      for (let f = 0; f < 4; f++) {
        const fr = add(stalk, G('gf', () => { const g = new THREE.SphereGeometry(.045, 8, 6); g.scale(1.3, .55, .45); return g; }), gm, sx * .02, .06 + f * len / 4.5, 0, false);
        fr.rotation.z = sx * .4;
      }
      piv.rotation.z = -sx * (0.85 - i * .35); piv.rotation.x = -.35 + i * .1;
      piv.userData = { rz: piv.rotation.z, sx, i };
      gills.push(piv);
    }
    // バット
    let bat = null;
    if (opt.bat) {
      bat = new THREE.Group();
      const b = add(bat, G('bat', () => new THREE.CylinderGeometry(.035, .016, .78, 12).translate(0, .39, 0)), M('wood', () => new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: .45 })), 0, 0, 0);
      void b;
      arms[1].add(bat); bat.position.set(0, -.27, 0); bat.rotation.set(-.4, 0, -.9);
    }
    // グラブ
    if (opt.glove) {
      const gl = add(arms[0], G('glove', () => { const g = new THREE.SphereGeometry(.085, 12, 8); g.scale(1, 1.1, .7); return g; }), M('glove', () => new THREE.MeshStandardMaterial({ color: 0x8a4a22, roughness: .6 })), 0, -.29, .02);
      void gl;
    }
    root.userData = { body, torso, head, arms, legs, gills, tail, bat, phase: Math.random() * 6, sk };
    root.scale.setScalar(opt.scale || 1);
    return root;
  }
  function animUpa(u, t, mode = 'idle', k = 0) {
    const d = u.userData, ph = d.phase + t;
    for (const gp of d.gills) gp.rotation.z = gp.userData.rz + Math.sin(ph * 2.4 + gp.userData.i) * .1 * gp.userData.sx;
    d.tail.rotation.y = Math.sin(ph * 1.7) * .25;
    if (mode === 'run') {
      const s = Math.sin(t * 14);
      d.legs[0].rotation.x = s * .8; d.legs[1].rotation.x = -s * .8;
      d.arms[0].rotation.x = -s * .7; d.arms[1].rotation.x = s * .7;
      d.body.position.y = Math.abs(Math.cos(t * 14)) * .06; d.torso.rotation.x = .18;
    } else if (mode === 'idle') {
      d.legs[0].rotation.x = d.legs[1].rotation.x = 0; d.arms[0].rotation.x = d.arms[1].rotation.x = 0;
      d.body.position.y = Math.sin(ph * 2) * .012; d.torso.rotation.x = 0; d.head.rotation.z = Math.sin(ph * .8) * .05;
    } else if (mode === 'ready') { // 守備の構え
      d.legs[0].rotation.x = -.3; d.legs[1].rotation.x = -.3; d.torso.rotation.x = .35; d.arms[0].rotation.x = -.8; d.arms[1].rotation.x = -.8;
      d.body.position.y = -.06 + Math.sin(ph * 3) * .01;
    } else if (mode === 'jump') {
      d.body.position.y = Math.abs(Math.sin(t * 7)) * .4; d.arms[0].rotation.x = d.arms[1].rotation.x = -2.6;
    }
  }

  // ---------- 選手の配置 ----------
  const people = new THREE.Group(); scene.add(people);
  let FIELD = {}, batterU = null, catcherU = null, pitcherU = null, runnersU = [];
  function setTeams(fieldTeam, fieldSkins, batTeam, batter, batterLeft) {
    people.clear(); FIELD = {}; runnersU = [];
    for (const k of FIELD_ORDER) {
      const u = makeUpa(fieldSkins[k], fieldTeam, { glove: true });
      const [x, z] = FIELDERS[k]; u.position.set(x, 0, z); u.lookAt(0, 0, 0);
      u.userData.home = [x, z]; u.userData.key = k; people.add(u); FIELD[k] = u;
    }
    pitcherU = FIELD.P; pitcherU.position.set(0, .3, -18.2); pitcherU.rotation.set(0, 0, 0);
    catcherU = FIELD.C; catcherU.position.set(0, 0, 1.5); catcherU.rotation.set(0, Math.PI, 0); catcherU.scale.set(1, .6, 1);
    batterU = makeUpa(batter.skin, batTeam, { bat: true });
    setBatterSide(batterLeft);
    people.add(batterU);
    batTeamRef = batTeam;
  }
  let batTeamRef = null;
  function setBatterSide(left) {
    if (!batterU) return;
    const sx = left ? 1 : -1;
    batterU.position.set(sx * .95, 0, -.05); batterU.rotation.y = left ? -Math.PI / 2 : Math.PI / 2;
    batterU.userData.left = left;
  }
  function setBatter(skin, left) {
    if (batterU) people.remove(batterU);
    batterU = makeUpa(skin, batTeamRef, { bat: true }); setBatterSide(left); people.add(batterU);
  }
  function setRunners(bases, skins) {
    for (const r of runnersU) people.remove(r); runnersU = [];
    bases.forEach((b, i) => {
      if (b === null) return;
      const u = makeUpa(skins[i] || 'pink', batTeamRef, {}); const [x, z] = BASES[i + 1];
      u.position.set(x + (i === 0 ? -1.2 : i === 1 ? -1.2 : 1.2) * .7, 0, z + .8); u.lookAt(0, 0, -19); u.userData.base = i + 1; people.add(u); runnersU.push(u);
    });
  }

  // ---------- ボール ----------
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.05, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .35, roughness: .4 }));
  ball.castShadow = true; scene.add(ball); ball.visible = false;
  const ballShadow = new THREE.Mesh(new THREE.CircleGeometry(.16, 16), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .35, depthWrite: false }));
  ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow); ballShadow.visible = false;
  const trailN = 18, trailPos = new Float32Array(trailN * 3);
  const trail = new THREE.Line(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(trailPos, 3)), new THREE.LineBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: .55 }));
  trail.frustumCulled = false; scene.add(trail); trail.visible = false;
  let trailArr = [];
  function setBall(x, y, z, show = true, withTrail = false) {
    ball.visible = show; ballShadow.visible = show; ball.position.set(x, y, z); ballShadow.position.set(x, .02, z);
    ballShadow.scale.setScalar(1 + y * .04); ballShadow.material.opacity = Math.max(.08, .35 - y * .01);
    if (withTrail && show) { trailArr.push([x, y, z]); if (trailArr.length > trailN) trailArr.shift(); } else trailArr = [];
    trail.visible = trailArr.length > 1;
    for (let i = 0; i < trailN; i++) { const p = trailArr[Math.min(i, trailArr.length - 1)] || [x, y, z]; trailPos[i * 3] = p[0]; trailPos[i * 3 + 1] = p[1]; trailPos[i * 3 + 2] = p[2]; }
    trail.geometry.attributes.position.needsUpdate = true;
  }

  // ---------- 昼（デーゲーム）と夜（ナイター） ----------
  const TIMES = {
    day: { top: '#2f7fe0', mid: '#7fc0ff', low: '#e8f6ff', fog: 0xbfe0ff, hemi: [0xdff0ff, 0x4a7a3a, 1.15], sun: [0xfffaf0, 3.0], fill: [0xfff2e0, 0.35], exp: 1.0, glow: false },
    night: { top: '#141238', mid: '#5a3a8a', low: '#ff9a6a', fog: 0x2a2350, hemi: [0xbcc8ff, 0x3a5a2a, 0.9], sun: [0xfff0dd, 2.2], fill: [0xffb0d0, 0.5], exp: 1.05, glow: true },
  };
  function setTime(k) {
    const T = TIMES[k] || TIMES.day;
    skyMat.uniforms.top.value.set(T.top); skyMat.uniforms.mid.value.set(T.mid); skyMat.uniforms.low.value.set(T.low);
    scene.fog.color.setHex(T.fog);
    hemi.color.setHex(T.hemi[0]); hemi.groundColor.setHex(T.hemi[1]); hemi.intensity = T.hemi[2];
    sun.color.setHex(T.sun[0]); sun.intensity = T.sun[1]; fill.color.setHex(T.fill[0]); fill.intensity = T.fill[1];
    renderer.toneMappingExposure = T.exp;
    for (const g of glows) g.visible = T.glow;
    for (const p of panels) p.material.emissiveIntensity = T.glow ? 1.6 : 0.15;
    skyStar.value = T.glow ? 1 : 0;
  }

  // ---------- ストライクゾーンとカーソル ----------
  const zoneG = new THREE.Group(); scene.add(zoneG); zoneG.visible = false;
  {
    const m = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55, depthTest: false });
    const pts = [[-ZONE.x, ZONE.y0], [ZONE.x, ZONE.y0], [ZONE.x, ZONE.y1], [-ZONE.x, ZONE.y1], [-ZONE.x, ZONE.y0]].map(([x, y]) => new V3(x, y, 0));
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), m); l.renderOrder = 5; zoneG.add(l);
    const m2 = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .18, depthTest: false });
    for (let i = 1; i < 3; i++) {
      const x = -ZONE.x + ZONE.x * 2 * i / 3, y = ZONE.y0 + (ZONE.y1 - ZONE.y0) * i / 3;
      zoneG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(x, ZONE.y0, 0), new V3(x, ZONE.y1, 0)]), m2));
      zoneG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new V3(-ZONE.x, y, 0), new V3(ZONE.x, y, 0)]), m2));
    }
  }
  const cursor = new THREE.Group(); scene.add(cursor); cursor.visible = false;
  const curRing = new THREE.Mesh(new THREE.RingGeometry(.9, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: .9, depthTest: false, side: THREE.DoubleSide }));
  const curFill = new THREE.Mesh(new THREE.CircleGeometry(.9, 40), new THREE.MeshBasicMaterial({ color: 0xffe14a, transparent: true, opacity: .16, depthTest: false, side: THREE.DoubleSide }));
  const curDot = new THREE.Mesh(new THREE.CircleGeometry(.14, 16), new THREE.MeshBasicMaterial({ color: 0xff4a6a, depthTest: false, side: THREE.DoubleSide }));
  for (const m of [curFill, curRing, curDot]) { m.renderOrder = 6; cursor.add(m); }
  function setCursor(x, y, r, show = true, color = 0xffe14a) { cursor.visible = show; cursor.position.set(x, y, 0.02); cursor.scale.set(r * 1.15, r, 1); curRing.material.color.set(color); curFill.material.color.set(color); }
  // 狙い（ピッチャー用）
  const aim = new THREE.Mesh(new THREE.RingGeometry(.05, .065, 28), new THREE.MeshBasicMaterial({ color: 0x5ad8ff, depthTest: false, side: THREE.DoubleSide }));
  aim.renderOrder = 7; scene.add(aim); aim.visible = false;

  // ---------- カメラ ----------
  const cam = { mode: 'bat', from: null, t: 1, look: new V3(0, 1, -18), pos: new V3(0, 1.72, 4.6) };
  const VIEWS = {
    bat: { pos: new V3(0, 2.35, 5.4), look: new V3(0, .7, -18), fov: 33 },
    pitch: { pos: new V3(0, 2.35, 5.4), look: new V3(0, .7, -18), fov: 33 },
    title: { pos: new V3(0, 6, 14), look: new V3(0, 1.5, -10), fov: 44 },
    wide: { pos: new V3(0, 26, 24), look: new V3(0, 0, -45), fov: 50 },
  };
  function setView(mode, instant = false) {
    cam.mode = mode;
    if (VIEWS[mode]) { cam.from = { pos: camera.position.clone(), look: cam.look.clone(), fov: camera.fov }; cam.t = instant ? 1 : 0; }
  }
  let follow = null; // ボールを追う
  function followBall(on) { follow = on ? { look: cam.look.clone() } : null; if (on) cam.mode = 'follow'; }

  // ---------- 毎フレーム ----------
  let W = 1, H = 1, time = 0;
  function resize() {
    const r = canvas.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    renderer.setSize(W, H, false); camera.aspect = W / H;
    // 縦長の画面ではゾーンが小さくならないよう少し寄る
    const port = W / H < .9; VIEWS.bat.fov = VIEWS.pitch.fov = port ? 49 : 33; VIEWS.bat.pos.set(0, port ? 2.15 : 2.35, port ? 4.9 : 5.4); VIEWS.bat.look.set(0, port ? -.6 : -1.5, -18); VIEWS.pitch.look.copy(VIEWS.bat.look); VIEWS.pitch.pos.copy(VIEWS.bat.pos);
    if (cam.mode === 'bat' || cam.mode === 'pitch') { camera.fov = VIEWS.bat.fov; camera.position.copy(VIEWS.bat.pos); cam.look.copy(VIEWS.bat.look); }
    camera.updateProjectionMatrix();
  }
  function frame(dt, extra) {
    time += dt;
    // カメラ
    if (cam.mode === 'follow' && ball.visible) {
      const b = ball.position, d = Math.hypot(b.x, b.z);
      const want = new V3(b.x * .25, Math.max(8, b.y * .6 + 6 + d * .12), Math.max(10, 18 - d * .1));
      camera.position.lerp(want, 1 - Math.pow(.02, dt));
      cam.look.lerp(new V3(b.x, b.y * .7, b.z), 1 - Math.pow(.001, dt));
      camera.fov = lerp(camera.fov, 46, dt * 2);
    } else if (cam.mode === 'title') {
      const a = time * .08;
      camera.position.set(Math.sin(a) * 9, 3.2 + Math.sin(time * .3) * .4, -14 + Math.cos(a) * 9);
      cam.look.set(0, 1.2, -18.2); camera.fov = 40;
    } else if (VIEWS[cam.mode]) {
      const v = VIEWS[cam.mode];
      if (cam.t < 1 && cam.from) { cam.t = Math.min(1, cam.t + dt / .7); const e = ease(cam.t); camera.position.lerpVectors(cam.from.pos, v.pos, e); cam.look.lerpVectors(cam.from.look, v.look, e); camera.fov = lerp(cam.from.fov, v.fov, e); }
      else { camera.position.copy(v.pos); cam.look.copy(v.look); camera.fov = v.fov; }
    }
    camera.lookAt(cam.look); camera.updateProjectionMatrix();
    // ウーパーの動き
    for (const u of people.children) { if (!u.userData.busy) animUpa(u, time, u.userData.key && u.userData.key !== 'P' && u.userData.key !== 'C' ? 'ready' : 'idle'); }
    // 観客のジャンプ
    if (crowd.jump > 0) {
      crowd.jump -= dt;
      const { im, base, m } = crowd;
      for (let i = 0; i < crowd.n; i++) { const b = base[i]; m.makeTranslation(b[0], b[1] + Math.max(0, Math.sin(time * 9 + b[3])) * .6 * Math.min(1, crowd.jump), b[2]); im.setMatrixAt(i, m); }
      im.instanceMatrix.needsUpdate = true;
    }
    if (extra) extra(dt, time);
    renderer.render(scene, camera);
  }
  function toPlane(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    const v = new V3(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1, .5).unproject(camera);
    const dir = v.sub(camera.position).normalize();
    const t = (0 - camera.position.z) / dir.z;
    return [camera.position.x + dir.x * t, camera.position.y + dir.y * t];
  }
  // 画面の何px が ゾーンの 1m か（ドラッグ量の変換）
  function pxPerM() {
    const a = new V3(0, 1, 0).project(camera), b = new V3(1, 1, 0).project(camera);
    return Math.abs(b.x - a.x) / 2 * W;
  }
  function drawBoard(S, names) {
    const { c, t } = board, g = c.getContext('2d');
    g.fillStyle = '#0c0f1a'; g.fillRect(0, 0, 1024, 400);
    g.strokeStyle = '#2a3150'; g.lineWidth = 4; g.strokeRect(8, 8, 1008, 384);
    g.font = '900 44px "Noto Sans JP", sans-serif'; g.textBaseline = 'middle';
    const cols = Math.max(S.innings, S.inn), cw = Math.min(64, 560 / cols), x0 = 300;
    g.fillStyle = '#ffd23a';
    for (let i = 0; i < cols; i++) { g.textAlign = 'center'; g.fillText(String(i + 1), x0 + cw * i + cw / 2, 60); }
    g.fillText('R', x0 + cw * cols + 50, 60); g.fillText('H', x0 + cw * cols + 120, 60);
    for (let r = 0; r < 2; r++) {
      const y = 140 + r * 90; g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.fillText(names[r].slice(0, 6), 30, y);
      for (let i = 0; i < cols; i++) { const v = S.line[r][i]; g.textAlign = 'center'; g.fillStyle = v ? '#ffffff' : '#7a809a'; g.fillText(v === undefined ? '' : String(v), x0 + cw * i + cw / 2, y); }
      g.fillStyle = '#ffd23a'; g.fillText(String(S.score[r]), x0 + cw * cols + 50, y); g.fillStyle = '#ffffff'; g.fillText(String(S.hits[r]), x0 + cw * cols + 120, y);
    }
    // B S O
    const dots = [['B', S.b, 3, '#3ad06a'], ['S', S.s, 2, '#ffd23a'], ['O', S.outs, 2, '#ff4a4a']];
    dots.forEach(([l, n, max, col], i) => { const y = 340, x = 60 + i * 220; g.fillStyle = '#ffffff'; g.textAlign = 'left'; g.fillText(l, x, y); for (let k = 0; k < max; k++) { g.beginPath(); g.arc(x + 70 + k * 46, y, 16, 0, 7); g.fillStyle = k < n ? col : '#2a3150'; g.fill(); } });
    t.needsUpdate = true;
  }

  resize();
  return {
    THREE, renderer, scene, camera, resize, frame, setView, setTime, followBall, setBall, setCursor, aim, zoneG, toPlane, pxPerM,
    makeUpa, animUpa, setTeams, setBatter, setRunners, drawBoard, pitchPos,
    get FIELD() { return FIELD; }, get batter() { return batterU; }, get pitcher() { return pitcherU; }, get catcher() { return catcherU; }, get runners() { return runnersU; },
    cheer(sec = 3) { crowd.jump = sec; },
    people,
  };
}
