// うぱカートGP — コースの見た目（道・縁石・壁・景色）
import * as THREE from '../upa/vendor/three.module.min.js';
import { Sky } from './vendor/Sky.js';

const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (rep) t.repeat.set(rep[0], rep[1]); return t; }
function noiseFill(x, w, h, base, amp, n) { const id = x.getImageData(0, 0, w, h), d = id.data; for (let i = 0; i < d.length; i += 4) { const v = (Math.random() - 0.5) * amp; d[i] = base[0] + v; d[i + 1] = base[1] + v; d[i + 2] = base[2] + v; d[i + 3] = 255; } x.putImageData(id, 0, 0); if (n) for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.06})`; x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 18, 0, 7); x.fill(); } }

// 道のテクスチャ（横 u=0..1、たて v）
function roadTex(theme) {
  return canvasTex(512, 512, (x, w, h) => {
    if (theme === 'moon') { noiseFill(x, w, h, [96, 100, 112], 22, 120); x.strokeStyle = 'rgba(30,34,44,.7)'; x.lineWidth = 3; for (let y = 0; y < h; y += 128) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); } for (const u of [0.25, 0.5, 0.75]) { x.beginPath(); x.moveTo(u * w, 0); x.lineTo(u * w, h); x.stroke(); } }
    else { noiseFill(x, w, h, theme === 'night' ? [48, 50, 58] : [86, 88, 94], 26, 300); }
    x.fillStyle = theme === 'moon' ? '#7ff0ff' : '#f4f4f0';
    x.fillRect(w * 0.025, 0, w * 0.018, h); x.fillRect(w * 0.957, 0, w * 0.018, h);
    if (theme !== 'moon') { x.fillStyle = theme === 'night' ? '#ffd23a' : '#f4f4f0'; for (let y = 0; y < h; y += 128) x.fillRect(w * 0.494, y, w * 0.012, 64); }
    if (theme === 'night') { x.fillStyle = 'rgba(255,255,255,.04)'; for (let i = 0; i < 40; i++) { x.beginPath(); x.ellipse(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 6 + Math.random() * 14, 0, 0, 7); x.fill(); } }
  });
}
const curbTex = () => canvasTex(64, 128, (x, w, h) => { x.fillStyle = '#e8303a'; x.fillRect(0, 0, w, h); x.fillStyle = '#f4f4f4'; x.fillRect(0, 0, w, h / 2); });
const grassTex = theme => canvasTex(512, 512, (x, w, h) => {
  if (theme === 'day') { noiseFill(x, w, h, [76, 140, 58], 30, 400); for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(${40 + Math.random() * 60},${110 + Math.random() * 80},${30 + Math.random() * 40},.6)`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 4); } }
  else if (theme === 'moon') { noiseFill(x, w, h, [150, 148, 142], 26, 200); for (let i = 0; i < 26; i++) { const r = 6 + Math.random() * 40, cx = Math.random() * w, cy = Math.random() * h; const g = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r); g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(0.8, 'rgba(0,0,0,.05)'); g.addColorStop(0.92, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); } }
  else { noiseFill(x, w, h, [60, 62, 70], 18, 100); x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; for (let i = 0; i < w; i += 64) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } }
});

// 道にそった帯を作る（lat0〜lat1、高さはその場の道の高さ + dy）
function strip(P, lat0, lat1, dy0, dy1, vScale, mat, yFn) {
  const N = P.N, pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx = [];
  let v = 0;
  for (let j = 0; j <= N; j++) {
    const i = j % N; if (j > 0) { const a = (j - 1) % N; v += Math.hypot(P.x[i] - P.x[a], P.z[i] - P.z[a]) / vScale; }
    for (let s = 0; s < 2; s++) { const lat = s ? lat1 : lat0, dy = s ? dy1 : dy0; const k = (j * 2 + s); pos[k * 3] = P.x[i] + P.rx[i] * lat; pos[k * 3 + 1] = (yFn ? yFn(i, lat) : P.y[i]) + dy; pos[k * 3 + 2] = P.z[i] + P.rz[i] * lat; uv[k * 2] = s; uv[k * 2 + 1] = v; }
    if (j < N) { const a = j * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}
// 道（横に分割して、少しだけ真ん中を高く）
function roadMesh(P, hw, mat) {
  const N = P.N, S = 6, pos = [], uv = [], idx = []; let v = 0;
  for (let j = 0; j <= N; j++) {
    const i = j % N; if (j > 0) { const a = (j - 1) % N; v += Math.hypot(P.x[i] - P.x[a], P.z[i] - P.z[a]) / (hw * 2); }
    for (let s = 0; s <= S; s++) { const u = s / S, lat = (u - 0.5) * 2 * hw; pos.push(P.x[i] + P.rx[i] * lat, P.y[i] + 0.04 + 0.06 * Math.cos((u - 0.5) * Math.PI), P.z[i] + P.rz[i] * lat); uv.push(u, v); }
    if (j < N) for (let s = 0; s < S; s++) { const a = j * (S + 1) + s, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, b, c, b, d, c); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m;
}

function label(text, opt = {}) {
  const c = document.createElement('canvas'); const fs = opt.fs || 96; const x = c.getContext('2d'); x.font = `900 ${fs}px "M PLUS Rounded 1c", "Dela Gothic One", sans-serif`;
  const w = Math.ceil(x.measureText(text).width) + fs; c.width = w; c.height = fs * 1.5;
  x.font = `900 ${fs}px "M PLUS Rounded 1c", "Dela Gothic One", sans-serif`; if (opt.bg) { x.fillStyle = opt.bg; x.fillRect(0, 0, w, c.height); }
  x.textAlign = 'center'; x.textBaseline = 'middle'; if (opt.stroke) { x.lineWidth = fs * 0.12; x.strokeStyle = opt.stroke; x.strokeText(text, w / 2, c.height / 2); } x.fillStyle = opt.color || '#fff'; x.fillText(text, w / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { tex: t, aspect: w / c.height };
}

export function buildTrackScene(scene, renderer, race, GQ) {
  const { P, tr, hw } = race, theme = tr.theme, root = new THREE.Group(); scene.add(root);
  const out = { root, boxes: [], pads: [], update: [] };
  // 空と光
  const pm = new THREE.PMREMGenerator(renderer);
  let sunDir;
  if (theme === 'day') {
    const sky = new Sky(); sky.scale.setScalar(4000); const u = sky.material.uniforms; u.turbidity.value = 4; u.rayleigh.value = 1.6; u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.8;
    sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(52), THREE.MathUtils.degToRad(140)); u.sunPosition.value.copy(sunDir);
    root.add(sky);
    const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { sun: { value: sunDir } }, vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform vec3 sun; varying vec3 vD; void main(){ float h = vD.y; vec3 sky = mix(vec3(0.75,0.85,1.0), vec3(0.25,0.5,0.95), smoothstep(0.0, 0.6, h)); vec3 gnd = vec3(0.22,0.32,0.16); vec3 c = h > 0.0 ? sky : mix(vec3(0.6,0.7,0.75), gnd, smoothstep(0.0, -0.2, h)); c += vec3(4.0,3.6,3.0) * pow(max(dot(vD, sun), 0.0), 300.0); gl_FragColor = vec4(c * 1.4, 1.0); }' })));
    scene.environment = pm.fromScene(es, 0.02).texture; scene.background = null; scene.fog = new THREE.Fog(0xbfd8ef, 260, 1500);
  } else {
    const night = theme === 'night';
    sunDir = night ? new THREE.Vector3(-0.4, 0.7, 0.3).normalize() : new THREE.Vector3(0.6, 0.45, 0.3).normalize();
    scene.background = new THREE.Color(night ? 0x060818 : 0x000002); scene.fog = night ? new THREE.Fog(0x0a0c22, 200, 1100) : null;
    const es = new THREE.Scene(); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { n: { value: night ? 1 : 0 } }, vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }', fragmentShader: 'uniform float n; varying vec3 vD; void main(){ float g = smoothstep(0.1, -0.3, vD.y); vec3 top = n > 0.5 ? vec3(0.03,0.04,0.12) : vec3(0.0); vec3 bot = n > 0.5 ? vec3(0.12,0.1,0.18) : vec3(0.35,0.34,0.32); vec3 c = mix(top, bot, g); if (n > 0.5) { c += vec3(1.0,0.2,0.6) * 0.6 * smoothstep(0.4, 0.0, abs(vD.y - 0.05)) * (0.5 + 0.5 * sin(vD.x * 20.0)); c += vec3(0.2,0.6,1.0) * 0.6 * smoothstep(0.3, 0.0, abs(vD.y - 0.15)) * (0.5 + 0.5 * cos(vD.z * 17.0)); } gl_FragColor = vec4(c, 1.0); }' })));
    scene.environment = pm.fromScene(es, 0.02).texture;
    // 星
    const n = 3000, p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const u = Math.random(), a = Math.random() * 7, r = 2500; const s = Math.sqrt(1 - u * u); p.set([Math.cos(a) * s * r, u * r * 0.95 + 40, Math.sin(a) * s * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); root.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: night ? 0.5 : 0.9, fog: false })));
    if (!night) { // 地球
      const ec = document.createElement('canvas'); ec.width = 512; ec.height = 256; const x = ec.getContext('2d'); x.fillStyle = '#1f5fc8'; x.fillRect(0, 0, 512, 256); for (let i = 0; i < 40; i++) { x.fillStyle = i % 3 ? '#3f9a4a' : '#c8b070'; x.beginPath(); x.ellipse(Math.random() * 512, 40 + Math.random() * 176, 14 + Math.random() * 46, 8 + Math.random() * 26, Math.random() * 3, 0, 7); x.fill(); } x.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 70; i++) { x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 256, 10 + Math.random() * 40, 3 + Math.random() * 7, 0, 0, 7); x.fill(); }
      const et = new THREE.CanvasTexture(ec); et.colorSpace = THREE.SRGBColorSpace; const earth = new THREE.Mesh(new THREE.SphereGeometry(120, 48, 32), new THREE.MeshStandardMaterial({ map: et, roughness: 0.8, fog: false })); earth.position.set(-900, 600, -1400); root.add(earth); out.update.push(dt => earth.rotation.y += dt * 0.01);
    } else { const moon = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.55, 1.3), fog: false, toneMapped: false })); moon.position.set(-700, 700, -1200); root.add(moon); }
  }
  const amb = new THREE.HemisphereLight(theme === 'day' ? 0xcfe6ff : theme === 'night' ? 0x4050a0 : 0x8090b0, theme === 'day' ? 0x5a7a3a : 0x202028, theme === 'day' ? 1.5 : theme === 'night' ? 0.55 : 0.4); root.add(amb);
  const sun = new THREE.DirectionalLight(theme === 'night' ? 0x9fb0ff : 0xfff2dc, theme === 'day' ? 5.2 : theme === 'night' ? 0.9 : 3.4); root.add(sun); root.add(sun.target);
  sun.castShadow = GQ > 0; if (GQ > 0) { const s = sun.shadow; s.mapSize.set(GQ === 2 ? 2048 : 1024, GQ === 2 ? 2048 : 1024); const r = 70; Object.assign(s.camera, { left: -r, right: r, top: r, bottom: -r, near: 1, far: 400 }); s.camera.updateProjectionMatrix(); s.bias = -0.0003; s.normalBias = 0.05; }
  out.sun = sun; out.sunDir = sunDir; out.exposure = theme === 'day' ? 0.58 : theme === 'night' ? 1.0 : 1.0;

  // 地面
  const gt = grassTex(theme); gt.repeat.set(160, 160);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: gt, roughness: theme === 'night' ? 0.6 : 0.95, color: theme === 'day' ? 0xb8d8a0 : 0xffffff })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; root.add(ground);
  // 道
  const rt = roadTex(theme);
  const roadMat = new THREE.MeshStandardMaterial({ map: rt, roughness: theme === 'night' ? 0.22 : theme === 'moon' ? 0.5 : 0.82, metalness: theme === 'moon' ? 0.5 : 0.05, color: 0xffffff });
  root.add(roadMesh(P, hw, roadMat));
  // 路肩（道の外のゆるい所）
  const shoulderMat = new THREE.MeshStandardMaterial({ map: gt.clone(), roughness: 0.95, color: theme === 'day' ? 0x9cc888 : theme === 'moon' ? 0xb0aca4 : 0x6a6e78 }); shoulderMat.map.repeat.set(1, 1);
  root.add(strip(P, hw, hw + 4, 0.02, 0.02, 4, shoulderMat)); root.add(strip(P, -hw - 4, -hw, 0.02, 0.02, 4, shoulderMat));
  // 縁石（カーブのところ）
  const ct = curbTex(); const curbMat = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.6 });
  if (theme !== 'moon') { root.add(strip(P, hw - 0.1, hw + 1.1, 0.07, 0.1, 2, curbMat)); root.add(strip(P, -hw - 1.1, -hw + 0.1, 0.1, 0.07, 2, curbMat)); }
  else { const glowM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 2.6), toneMapped: false }); root.add(strip(P, hw + 0.05, hw + 0.35, 0.09, 0.09, 2, glowM)); root.add(strip(P, -hw - 0.35, -hw - 0.05, 0.09, 0.09, 2, glowM)); }
  // 壁
  const WL = hw + 4.2, wallH = theme === 'night' ? 1.1 : 0.9;
  const wallTex = canvasTex(256, 64, (x, w, h) => { if (theme === 'day') { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#e8303a' : '#f4f4f4'; x.fillRect(i * 32, 0, 32, h); } x.fillStyle = '#2a64c8'; x.fillRect(0, h * 0.4, w, h * 0.2); } else if (theme === 'moon') { x.fillStyle = '#c8ccd4'; x.fillRect(0, 0, w, h); x.fillStyle = '#ff9a3c'; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(i * 32, h); x.lineTo(i * 32 + 16, 0); x.lineTo(i * 32 + 32, 0); x.lineTo(i * 32 + 16, h); x.fill(); } } else { x.fillStyle = '#8a8c94'; x.fillRect(0, 0, w, h); x.fillStyle = '#6a6c74'; x.fillRect(0, h * 0.75, w, h * 0.25); } });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.6, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const w1 = strip(P, s * WL, s * WL, 0, wallH, 6, wallMat); w1.castShadow = true; root.add(w1);
    const top = strip(P, s * WL, s * (WL + 0.4), wallH, wallH, 6, new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 })); root.add(top);
    if (theme === 'night') { const neon = strip(P, s * (WL - 0.02), s * (WL - 0.02), wallH - 0.12, wallH - 0.04, 6, new THREE.MeshBasicMaterial({ color: s > 0 ? new THREE.Color(2.6, 0.3, 1.6) : new THREE.Color(0.3, 1.6, 2.8), toneMapped: false, side: THREE.DoubleSide })); root.add(neon); }
    if (theme === 'moon') { const neon = strip(P, s * (WL - 0.02), s * (WL - 0.02), wallH + 0.02, wallH + 0.1, 6, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.2, 0.3), toneMapped: false, side: THREE.DoubleSide })); root.add(neon); }
    // 土手（高いところの下）
    const bankMat = theme === 'night' ? new THREE.MeshStandardMaterial({ color: 0x5a5c66, roughness: 0.7 }) : shoulderMat;
    if (theme === 'night') { root.add(strip(P, s * (WL + 0.4), s * (WL + 0.4), 0, 0, 6, bankMat, (i) => 0)); const sk = strip(P, s * (WL + 0.4), s * (WL + 0.4), wallH, 0, 6, bankMat, (i, lat) => 0); }
    root.add(strip(P, s * (WL + 0.4), s * (WL + 14), 0, 0, 6, bankMat, (i, lat) => Math.abs(lat) < WL + 1 ? P.y[i] : 0));
  }
  // 高架の柱（夜の街）
  if (theme === 'night') { const pm2 = new THREE.MeshStandardMaterial({ color: 0x8a8c94, roughness: 0.6 }); for (let i = 0; i < P.N; i += 14) if (P.y[i] > 2) { for (const s of [-0.6, 0.6]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, P.y[i], 12), pm2); c.position.set(P.x[i] + P.rx[i] * s * hw, P.y[i] / 2, P.z[i] + P.rz[i] * s * hw); c.castShadow = true; root.add(c); } } }

  // スタートライン
  { const i = 0, chk = canvasTex(256, 32, (x, w, h) => { for (let a = 0; a < 16; a++) for (let b = 0; b < 2; b++) { x.fillStyle = (a + b) % 2 ? '#111' : '#fff'; x.fillRect(a * 16, b * 16, 16, 16); } });
    const g = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 1.6), new THREE.MeshStandardMaterial({ map: chk, roughness: 0.6 })); g.rotation.x = -Math.PI / 2; g.rotation.z = Math.atan2(P.tx[i], P.tz[i]) + Math.PI / 2 - Math.PI / 2; g.position.set(P.x[i], P.y[i] + 0.12, P.z[i]); g.rotation.order = 'YXZ'; g.rotation.set(-Math.PI / 2, 0, 0); g.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.atan2(P.tx[i], P.tz[i])); g.receiveShadow = true; root.add(g);
    const yaw = Math.atan2(P.tx[i], P.tz[i]); const gate = new THREE.Group(); gate.position.set(P.x[i], P.y[i], P.z[i]); gate.rotation.y = yaw;
    const postM = new THREE.MeshStandardMaterial({ color: theme === 'night' ? 0x30343c : 0xe8e8ec, metalness: 0.6, roughness: 0.3 });
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 8, 0.8), postM); p.position.set(s * (hw + 1.5), 4, 0); p.castShadow = true; gate.add(p); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 4, 1.8, 1), postM); beam.position.y = 8.5; beam.castShadow = true; gate.add(beam);
    const L = label('うぱカートGP', { color: '#fff', stroke: '#ff5c8a', fs: 110 }); const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * L.aspect, 1.6), new THREE.MeshBasicMaterial({ map: L.tex, transparent: true, toneMapped: theme !== 'night' }));
    sign.position.set(0, 8.5, -0.52); sign.rotation.y = Math.PI; gate.add(sign); const sign2 = sign.clone(); sign2.position.z = 0.52; sign2.rotation.y = 0; gate.add(sign2);
    for (let k = 0; k < 5; k++) { const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshBasicMaterial({ color: 0x331111 })); lamp.position.set((k - 2) * 1.2, 7.1, -0.6); lamp.name = 'lamp' + k; gate.add(lamp); }
    root.add(gate); out.gate = gate;
  }
  // ダッシュ板
  const padTex = canvasTex(128, 128, (x, w, h) => { x.fillStyle = '#ff8a1a'; x.fillRect(0, 0, w, h); x.fillStyle = '#ffe24a'; for (let k = 0; k < 2; k++) { x.beginPath(); x.moveTo(20, 60 - k * 50 + 50); x.lineTo(64, 20 - k * 50 + 50); x.lineTo(108, 60 - k * 50 + 50); x.lineTo(108, 84 - k * 50 + 50); x.lineTo(64, 44 - k * 50 + 50); x.lineTo(20, 84 - k * 50 + 50); x.fill(); } });
  for (const c of race.boostAt) { const m = new THREE.Mesh(new THREE.PlaneGeometry(hw * 0.95, 4.5), new THREE.MeshBasicMaterial({ map: padTex.clone(), color: new THREE.Color(1.6, 1.4, 1.2), toneMapped: false, transparent: true, opacity: 0.95 })); m.material.map.needsUpdate = true; const i = race.P.wrap(c + 2); m.position.set(P.x[i], P.y[i] + 0.14, P.z[i]); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, 0, 0); m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.atan2(P.tx[i], P.tz[i]) + Math.PI); root.add(m); out.pads.push(m); }
  out.update.push((dt, t) => { for (const m of out.pads) m.material.map.offset.y = -(t * 1.6) % 1; });
  // ジャンプ台の印
  for (const c of race.jumpAt) { const i = race.P.wrap(c - 3); const m = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 2.2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 64, (x, w, h) => { for (let a = 0; a < 8; a++) { x.fillStyle = a % 2 ? '#111' : '#ffd23a'; x.beginPath(); x.moveTo(a * 32, 0); x.lineTo(a * 32 + 32, 0); x.lineTo(a * 32 + 16, h); x.lineTo(a * 32 - 16, h); x.fill(); } }) })); m.position.set(P.x[i], P.y[i] + 0.14, P.z[i]); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2 + Math.atan2(P.y[race.P.wrap(i + 2)] - P.y[race.P.wrap(i - 2)], 4) * -1, 0, 0); m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), Math.atan2(P.tx[i], P.tz[i]) + Math.PI); root.add(m); }

  // アイテムボックス
  const boxTex = canvasTex(128, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#7ff0ff'); g.addColorStop(0.5, '#ff7ad8'); g.addColorStop(1, '#ffe24a'); x.fillStyle = g; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(255,255,255,.85)'; x.font = '900 90px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('?', 64, 70); });
  const boxMat = new THREE.MeshPhysicalMaterial({ map: boxTex, transmission: 0, transparent: true, opacity: 0.85, roughness: 0.1, clearcoat: 1, emissive: 0x442244, emissiveIntensity: 0.4 });
  const boxGeo = new THREE.BoxGeometry(1.3, 1.3, 1.3);
  for (const b of race.boxes) { const m = new THREE.Mesh(boxGeo, boxMat); m.position.set(b.x, b.y + 1.2, b.z); m.castShadow = true; root.add(m); out.boxes.push(m); }

  // 景色
  const scat = (count, minD, maxD, fn) => { let n = 0, tries = 0; while (n < count && tries++ < count * 30) { const i = (rnd() * P.N) | 0, side = rnd() < 0.5 ? -1 : 1, d = minD + rnd() * (maxD - minD); const x = P.x[i] + P.rx[i] * side * d, z = P.z[i] + P.rz[i] * side * d; let ok = true; for (let j = 0; j < P.N; j += 3) if ((P.x[j] - x) ** 2 + (P.z[j] - z) ** 2 < (hw + 7) ** 2) { ok = false; break; } if (!ok) continue; fn(x, z, n++); } };
  if (theme === 'day') {
    // 木
    const tc = GQ === 2 ? 520 : GQ === 1 ? 300 : 140, trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 3, 7), new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.9 }), tc);
    const leafG = new THREE.IcosahedronGeometry(2.2, 1); const lp = leafG.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < lp.count; i++) { v.fromBufferAttribute(lp, i); v.multiplyScalar(0.85 + Math.random() * 0.3); lp.setXYZ(i, v.x, v.y, v.z); } leafG.computeVertexNormals();
    const leaf = new THREE.InstancedMesh(leafG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true }), tc * 2); const o = new THREE.Object3D(), col = new THREE.Color();
    scat(tc, hw + 9, 160, (x, z, n) => { const s = 0.8 + rnd() * 0.9; o.position.set(x, 1.5 * s, z); o.scale.setScalar(s); o.rotation.set(0, rnd() * 6, 0); o.updateMatrix(); trunk.setMatrixAt(n, o.matrix); for (let k = 0; k < 2; k++) { o.position.set(x + (rnd() - 0.5) * 0.8 * s, (3.6 + k * 1.5) * s, z + (rnd() - 0.5) * 0.8 * s); o.scale.setScalar(s * (1 - k * 0.3)); o.updateMatrix(); leaf.setMatrixAt(n * 2 + k, o.matrix); col.setHSL(0.27 + rnd() * 0.08, 0.55, 0.32 + rnd() * 0.12); leaf.setColorAt(n * 2 + k, col); } });
    trunk.castShadow = leaf.castShadow = true; trunk.receiveShadow = leaf.receiveShadow = true; root.add(trunk, leaf);
    // 遠くの山
    const mg = new THREE.ConeGeometry(1, 1, 7); const mt = new THREE.InstancedMesh(mg, new THREE.MeshStandardMaterial({ color: 0x6a8a6a, roughness: 1, flatShading: true }), 40);
    for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2 + rnd() * 0.1, r = 700 + rnd() * 300, h = 80 + rnd() * 160; o.position.set(Math.cos(a) * r, h / 2 - 5, Math.sin(a) * r); o.scale.set(h * 1.4, h, h * 1.4); o.rotation.y = rnd() * 3; o.updateMatrix(); mt.setMatrixAt(i, o.matrix); } root.add(mt);
    // 雲
    const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 }), cg = new THREE.IcosahedronGeometry(1, 2);
    for (let i = 0; i < 26; i++) { const c = new THREE.Group(); for (let k = 0; k < 5; k++) { const p = new THREE.Mesh(cg, cm); p.position.set((k - 2) * 9 + rnd() * 4, rnd() * 4, rnd() * 6); p.scale.setScalar(7 + rnd() * 6); p.scale.y *= 0.6; c.add(p); } const a = rnd() * 7, r = 300 + rnd() * 500; c.position.set(Math.cos(a) * r, 120 + rnd() * 80, Math.sin(a) * r); root.add(c); out.update.push(dt => { c.position.x += dt * 2; }); }
    // 観客席
    stands(root, P, hw, 30, 1); stands(root, P, hw, Math.floor(P.N * 0.5), -1);
    // 池
    const pond = new THREE.Mesh(new THREE.CircleGeometry(26, 48), new THREE.MeshPhysicalMaterial({ color: 0x2a6aa8, roughness: 0.05, metalness: 0.1, clearcoat: 1 })); pond.rotation.x = -Math.PI / 2; pond.position.set(10, 0.02, 55); root.add(pond);
    // 風船
    for (let i = 0; i < 12; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(1.2, 16, 12), new THREE.MeshPhysicalMaterial({ color: new THREE.Color().setHSL(rnd(), 0.8, 0.55), roughness: 0.2, clearcoat: 1 })); b.scale.y = 1.2; const ii = (rnd() * P.N) | 0, s = rnd() < 0.5 ? -1 : 1; b.position.set(P.x[ii] + P.rx[ii] * s * (hw + 10), 14 + rnd() * 10, P.z[ii] + P.rz[ii] * s * (hw + 10)); root.add(b); const ph = rnd() * 6; out.update.push((dt, t) => b.position.y += Math.sin(t + ph) * dt * 0.6); }
  } else if (theme === 'moon') {
    const o = new THREE.Object3D(); const rg = new THREE.IcosahedronGeometry(1, 1); const rp = rg.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < rp.count; i++) { v.fromBufferAttribute(rp, i); v.multiplyScalar(0.75 + Math.random() * 0.5); v.y *= 0.6; rp.setXYZ(i, v.x, v.y, v.z); } rg.computeVertexNormals();
    const rc = GQ === 2 ? 700 : 350, rocks = new THREE.InstancedMesh(rg, new THREE.MeshStandardMaterial({ color: 0x8a8880, roughness: 0.95, flatShading: true }), rc);
    scat(rc, hw + 8, 220, (x, z, n) => { const s = 0.4 + rnd() ** 3 * 6; o.position.set(x, s * 0.2, z); o.scale.setScalar(s); o.rotation.set(rnd(), rnd() * 6, rnd()); o.updateMatrix(); rocks.setMatrixAt(n, o.matrix); });
    rocks.castShadow = rocks.receiveShadow = true; root.add(rocks);
    // クレーターの縁（大きな輪）
    for (let i = 0; i < 18; i++) { const r = 20 + rnd() * 50; const t2 = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.12, 8, 40), new THREE.MeshStandardMaterial({ color: 0x9a968e, roughness: 1, flatShading: true })); t2.rotation.x = Math.PI / 2; t2.scale.z = 0.5; const a = rnd() * 7, d = 260 + rnd() * 500; t2.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); root.add(t2); }
    // 基地のドーム
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(10 + rnd() * 6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xeeeeee, roughness: 0.3, clearcoat: 1 })); const a = rnd() * 7; d.position.set(Math.cos(a) * 140, 0, 90 + Math.sin(a) * 60); d.castShadow = true; root.add(d); }
    // ゲートのアーチ（光るリング）
    for (let k = 0; k < 6; k++) { const i = Math.floor(P.N * (k + 0.5) / 6); const ring = new THREE.Mesh(new THREE.TorusGeometry(hw + 3, 0.35, 10, 48, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 2.2, 3), toneMapped: false })); ring.position.set(P.x[i], P.y[i], P.z[i]); ring.rotation.y = Math.atan2(P.tx[i], P.tz[i]) + Math.PI / 2; root.add(ring); }
  } else {
    // ビル
    const o = new THREE.Object3D();
    const winTex = canvasTex(128, 256, (x, w, h) => { x.fillStyle = '#10131c'; x.fillRect(0, 0, w, h); for (let yy = 6; yy < h; yy += 14) for (let xx = 6; xx < w; xx += 14) { const r = Math.random(); x.fillStyle = r < 0.45 ? '#141824' : r < 0.8 ? '#ffd88a' : r < 0.9 ? '#8ae0ff' : '#ff9ad8'; x.fillRect(xx, yy, 8, 9); } });
    const bc = GQ === 2 ? 260 : 160, bm = new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.5, metalness: 0.3 });
    const bld = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), bm, bc);
    scat(bc, hw + 14, 200, (x, z, n) => { const w = 10 + rnd() * 16, h = 18 + rnd() ** 2 * 90; o.position.set(x, h / 2, z); o.scale.set(w, h, w * (0.7 + rnd() * 0.6)); o.rotation.y = rnd() * 3; o.updateMatrix(); bld.setMatrixAt(n, o.matrix); });
    bld.castShadow = true; bld.receiveShadow = true; root.add(bld);
    // ネオン看板
    const words = ['UPA', 'ラーメン', 'GP', 'ねこ砦', 'カラオケ', '月面', '24H', 'NEON', 'ウパラン', 'ゲーム'];
    for (let k = 0; k < 22; k++) { const i = (rnd() * P.N) | 0, s = rnd() < 0.5 ? -1 : 1; const hue = rnd(); const c = new THREE.Color().setHSL(hue, 1, 0.6); const L = label(words[k % words.length], { color: '#' + c.getHexString(), fs: 100, stroke: '#ffffff' }); const m = new THREE.Mesh(new THREE.PlaneGeometry(3 * L.aspect, 3), new THREE.MeshBasicMaterial({ map: L.tex, transparent: true, toneMapped: false, color: new THREE.Color(2, 2, 2), side: THREE.DoubleSide })); m.position.set(P.x[i] + P.rx[i] * s * (hw + 11), 6 + rnd() * 10, P.z[i] + P.rz[i] * s * (hw + 11)); m.rotation.y = Math.atan2(P.tx[i], P.tz[i]) + (s > 0 ? -Math.PI / 2 : Math.PI / 2); root.add(m); const ph = rnd() * 6; out.update.push((dt, t) => m.material.opacity = 0.75 + 0.25 * Math.sin(t * 3 + ph)); }
    // 街灯
    const poleM = new THREE.MeshStandardMaterial({ color: 0x40444c, metalness: 0.8, roughness: 0.3 }), bulbM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 1.8), toneMapped: false });
    for (let i = 0; i < P.N; i += 22) for (const s of [-1, 1]) { const x = P.x[i] + P.rx[i] * s * (hw + 4.6), z = P.z[i] + P.rz[i] * s * (hw + 4.6), y = P.y[i]; const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7), poleM); p.position.set(x, y + 3.5, z); p.castShadow = true; root.add(p); const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), bulbM); b.position.set(x - P.rx[i] * s * 1.2, y + 7, z - P.rz[i] * s * 1.2); root.add(b); }
    // 道を照らす光（数を少なく）
    for (let k = 0; k < 6; k++) { const i = Math.floor(P.N * k / 6); const l = new THREE.PointLight(k % 2 ? 0xff60c0 : 0x60c0ff, 60, 60, 1.6); l.position.set(P.x[i], P.y[i] + 8, P.z[i]); root.add(l); }
  }
  return out;
}

function stands(root, P, hw, i, side) {
  const g = new THREE.Group(); const x = P.x[i] + P.rx[i] * side * (hw + 12), z = P.z[i] + P.rz[i] * side * (hw + 12);
  g.position.set(x, 0, z); g.rotation.y = Math.atan2(P.tx[i], P.tz[i]) + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
  const m = new THREE.MeshStandardMaterial({ color: 0xc8ccd4, roughness: 0.6 });
  for (let r = 0; r < 6; r++) { const step = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 1.6), m); step.position.set(0, r * 0.8 + 0.4, r * 1.6); step.castShadow = step.receiveShadow = true; g.add(step); }
  const roof = new THREE.Mesh(new THREE.BoxGeometry(42, 0.3, 12), new THREE.MeshStandardMaterial({ color: 0xff5c8a, roughness: 0.4 })); roof.position.set(0, 9, 4); roof.rotation.x = -0.12; roof.castShadow = true; g.add(roof);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), m); p.position.set(s * 20, 4.5, 9); g.add(p); }
  const n = 180, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), n), o = new THREE.Object3D(), c = new THREE.Color();
  for (let k = 0; k < n; k++) { const r = k % 6; o.position.set(-19 + Math.random() * 38, r * 0.8 + 1.3, r * 1.6 + 0.2); o.updateMatrix(); crowd.setMatrixAt(k, o.matrix); crowd.setColorAt(k, c.setHSL(Math.random(), 0.6, 0.55)); }
  crowd.castShadow = true; g.add(crowd); g.userData.crowd = crowd; root.add(g);
}
