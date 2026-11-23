// たこ焼きシミュレーター：3Dの見た目（Three.js）
// 鉄板は1枚のメッシュを半球にへこませて穴を作る。生地のはみ出しはテクスチャ（canvas）で描く。
// たこ焼きは球の頂点ごとに「近い面の焼け具合」から色を決め、まだ液体の部分は平らにつぶして液面にする。
import * as THREE from 'three';
const T = window.TakoCore;
const R = T.HOLE_R * 0.985;
const PW = T.COLS * T.PITCH + 1.3, PH = T.ROWS * T.PITCH + 1.3; // 鉄板の大きさ

// ---------- 色 ----------
const RAMP = [[0, [0.86, 0.78, 0.56]], [0.3, [0.92, 0.8, 0.5]], [0.65, [0.93, 0.68, 0.32]], [1.0, [0.8, 0.48, 0.17]], [1.35, [0.58, 0.3, 0.1]], [1.8, [0.24, 0.13, 0.06]], [2.4, [0.07, 0.05, 0.04]]];
function rampSRGB(c, out) {
  if (c <= 0) { out[0] = RAMP[0][1][0]; out[1] = RAMP[0][1][1]; out[2] = RAMP[0][1][2]; return out; }
  for (let k = 1; k < RAMP.length; k++) {
    if (c <= RAMP[k][0] || k === RAMP.length - 1) {
      const [c0, a] = RAMP[k - 1], [c1, b] = RAMP[k], f = Math.min(1, Math.max(0, (c - c0) / (c1 - c0)));
      out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f; return out;
    }
  }
  return out;
}
const lin = v => Math.pow(v, 2.2);
const css = (c) => { const o = rampSRGB(c, [0, 0, 0]); return `rgb(${o[0] * 255 | 0},${o[1] * 255 | 0},${o[2] * 255 | 0})`; };

// ---------- 手続きテクスチャ ----------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function noiseCanvas(size, seed, scales, base) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = base || '#808080'; g.fillRect(0, 0, size, size);
  for (const [n, rad, a] of scales) for (let i = 0; i < n; i++) {
    const x = r() * size, y = r() * size, rr = rad * (0.4 + r()), v = r() > 0.5 ? 255 : 0;
    const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${v},${v},${v},${a})`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`);
    g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    // 端でつながるように
    if (x < rr || y < rr || x > size - rr || y > size - rr) for (const [dx, dy] of [[size, 0], [-size, 0], [0, size], [0, -size]]) { g.save(); g.translate(dx, dy); g.fillRect(x - rr, y - rr, rr * 2, rr * 2); g.restore(); }
  }
  return c;
}
function woodCanvas(light) {
  const W = 1024, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), r = rng(7);
  const BR = light ? [222, 190, 140] : [122, 80, 46];
  g.fillStyle = `rgb(${BR})`; g.fillRect(0, 0, W, H);
  // 板の境目
  const planks = 4;
  for (let p = 0; p < planks; p++) {
    const y0 = p * H / planks, tone = 0.85 + r() * 0.3;
    g.fillStyle = `rgba(${(BR[0] * tone) | 0},${(BR[1] * tone) | 0},${(BR[2] * tone) | 0},1)`; g.fillRect(0, y0, W, H / planks);
    for (let i = 0; i < 140; i++) {
      const y = y0 + r() * H / planks, a = 0.04 + r() * 0.1, w = 0.5 + r() * 2.5;
      g.strokeStyle = r() > 0.5 ? `rgba(40,20,8,${a})` : `rgba(200,150,100,${a * 0.6})`; g.lineWidth = w; g.beginPath();
      let yy = y; g.moveTo(0, yy); for (let x = 0; x <= W; x += 32) { yy += (r() - 0.5) * 3; g.lineTo(x, yy + Math.sin(x / 140 + i) * 2); } g.stroke();
    }
    // 節
    if (!light && r() > 0.4) { const kx = r() * W, ky = y0 + 30 + r() * (H / planks - 60); for (let k = 12; k > 0; k--) { g.strokeStyle = `rgba(50,25,10,${0.05 + k * 0.01})`; g.lineWidth = 2; g.beginPath(); g.ellipse(kx, ky, k * 6, k * 2.2, 0, 0, 7); g.stroke(); } }
    if (!light) { g.fillStyle = 'rgba(20,10,4,.55)'; g.fillRect(0, y0, W, 3); }
  }
  // 使いこまれた汚れ
  for (let i = 0; i < 40; i++) { const x = r() * W, y = r() * H, rr = 20 + r() * 80, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(30,15,5,.08)'); gr.addColorStop(1, 'rgba(30,15,5,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  return c;
}
function spriteCanvas(kind) {
  const s = 128, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d');
  if (kind === 'flame') {
    const gr = g.createRadialGradient(64, 80, 2, 64, 70, 60); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(120,170,255,.9)'); gr.addColorStop(0.6, 'rgba(40,80,255,.35)'); gr.addColorStop(1, 'rgba(0,0,80,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(64, 72, 26, 56, 0, 0, 7); g.fill();
  } else {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 62); gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  }
  return c;
}
function labelCanvas(text, color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
  g.font = '900 70px "Yuji Syuku","Dela Gothic One",serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color || 'rgba(255,255,255,.85)'; g.fillText(text, 256, 68); return c;
}

export function createScene(canvas, opt) {
  opt = opt || {};
  const q = opt.quality ?? 2;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: q > 0, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 2 ? 2 : q === 1 ? 1.5 : 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = q > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x0d0805); scene.fog = new THREE.Fog(0x0d0805, 16, 34);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);

  // 映りこみ用の簡単な部屋
  {
    const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(30, 14, 30), new THREE.MeshBasicMaterial({ color: 0x1a120c, side: THREE.BackSide })));
    const lamp = (x, y, z, w, h, c, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
    lamp(0, 6.5, 0, 5, 5, 0xffe0b0, 6); lamp(-10, 4, -6, 4, 2, 0xffb070, 2.5); lamp(9, 3, 8, 6, 2, 0xfff0d8, 1.6); lamp(0, 2, -14, 10, 3, 0xff9050, 1.2);
    scene.environment = pm.fromScene(env, 0.03).texture; scene.environmentIntensity = 0.55; pm.dispose();
  }
  // ライト：上からのスポット（動画みたいに真ん中だけ明るい）
  const spot = new THREE.SpotLight(0xffe4c4, 260, 40, 0.62, 0.65, 1.6);
  spot.position.set(0.6, 13, 2.2); spot.target.position.set(0, 0, 0.6);
  spot.castShadow = q > 0; spot.shadow.mapSize.set(q === 2 ? 2048 : 1024, q === 2 ? 2048 : 1024); spot.shadow.bias = -0.0004; spot.shadow.normalBias = 0.02; spot.shadow.radius = 4;
  scene.add(spot, spot.target);
  scene.add(new THREE.HemisphereLight(0x8a6a50, 0x140a04, 0.45));
  const fill = new THREE.DirectionalLight(0xffc89a, 0.35); fill.position.set(-6, 5, 8); scene.add(fill);
  const flameLight = new THREE.PointLight(0xff8a40, 2, 3.5, 2); flameLight.position.set(0, -0.72, PH / 2 + 0.2); scene.add(flameLight);

  // ---------- テーブル ----------
  const woodTex = new THREE.CanvasTexture(woodCanvas()); woodTex.colorSpace = THREE.SRGBColorSpace; woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping; woodTex.repeat.set(3, 3); woodTex.anisotropy = 8;
  const bumpTex = new THREE.CanvasTexture(noiseCanvas(256, 3, [[900, 3, 0.25], [200, 10, 0.12]])); bumpTex.wrapS = bumpTex.wrapT = THREE.RepeatWrapping;
  const table = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.62, metalness: 0, bumpMap: woodTex, bumpScale: 0.6 }));
  table.rotation.x = -Math.PI / 2; table.position.y = -1.05; table.receiveShadow = true; scene.add(table);
  const TY = -1.05; // テーブルの高さ

  // ---------- コンロ（台＋火） ----------
  const steel = new THREE.MeshStandardMaterial({ color: 0x8b8b8b, metalness: 0.85, roughness: 0.38 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x302e2c, metalness: 0.7, roughness: 0.5 });
  {
    const base = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.5, 0.3, PH + 0.4), steel); base.position.y = TY + 0.15; base.castShadow = base.receiveShadow = true; scene.add(base);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(PW + 0.6, 0.05, PH + 0.5), darkSteel); lip.position.y = TY + 0.32; scene.add(lip);
    // つまみ
    for (let k = 0; k < 2; k++) { const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.14, 24), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 })); kn.rotation.x = Math.PI / 2; kn.position.set(-1 + k * 2, TY + 0.15, PH / 2 + 0.28); scene.add(kn); }
  }
  // 火（青い炎のスプライト）
  const flameTex = new THREE.CanvasTexture(spriteCanvas('flame'));
  const flames = [];
  for (let k = 0; k < 26; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9 }));
    const side = k % 2, along = Math.floor(k / 2) / 12;
    sp.position.set(-PW / 2 + 0.3 + along * (PW - 0.6), -0.66, side ? PH / 2 - 0.12 : -PH / 2 + 0.12);
    sp.userData.ph = Math.random() * 10; scene.add(sp); flames.push(sp);
  }

  // ---------- 鉄板 ----------
  const holeCenters = []; for (let i = 0; i < T.N; i++) holeCenters.push(T.holePos(i));
  const HR = T.HOLE_R + 0.025; // 見た目の穴の半径
  const plateGeo = new THREE.PlaneGeometry(PW, PH, q === 0 ? 150 : 230, q === 0 ? 126 : 194); plateGeo.rotateX(-Math.PI / 2);
  {
    const pos = plateGeo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v);
      const c = Math.round(x / T.PITCH + (T.COLS - 1) / 2), r = Math.round(z / T.PITCH + (T.ROWS - 1) / 2);
      let y = 0;
      if (c >= 0 && c < T.COLS && r >= 0 && r < T.ROWS) {
        const p = holeCenters[r * T.COLS + c], d = Math.hypot(x - p[0], z - p[1]);
        if (d < HR) y = -Math.sqrt(HR * HR - d * d) * 0.98;
        else if (d < HR + 0.05) { const f = (d - HR) / 0.05; y = -0.012 * (1 - f) * (1 - f); }
      }
      // 外のふち（少し高い）
      const ex = Math.abs(x) - (PW / 2 - 0.18), ez = Math.abs(z) - (PH / 2 - 0.18);
      if (ex > 0 || ez > 0) y = 0.07 * Math.min(1, Math.max(ex, ez) / 0.08);
      pos.setY(v, y);
    }
    plateGeo.computeVertexNormals();
  }
  // 鉄板の色（使いこんだ鋳物）と油のテカリ
  const PCW = 512, PCH = Math.round(512 * PH / PW);
  const plateCol = document.createElement('canvas'); plateCol.width = PCW; plateCol.height = PCH;
  {
    const g = plateCol.getContext('2d'), r = rng(11); g.fillStyle = '#2d2a27'; g.fillRect(0, 0, PCW, PCH);
    for (let i = 0; i < 2500; i++) { const x = r() * PCW, y = r() * PCH, s = r() * 2.2; g.fillStyle = r() > 0.5 ? 'rgba(80,70,60,.25)' : 'rgba(0,0,0,.3)'; g.fillRect(x, y, s, s); }
    for (let i = 0; i < T.N; i++) { // 穴のまわりの焼けた油のしみ
      const [hx, hz] = holeCenters[i], x = (hx / PW + 0.5) * PCW, y = (hz / PH + 0.5) * PCH, rr = PCW / PW * 0.62;
      const gr = g.createRadialGradient(x, y, rr * 0.5, x, y, rr); gr.addColorStop(0, 'rgba(60,35,15,.55)'); gr.addColorStop(1, 'rgba(60,35,15,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
      const gi = g.createRadialGradient(x, y, 0, x, y, rr * 0.7); gi.addColorStop(0, 'rgba(10,8,6,.7)'); gi.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = gi; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
  }
  const plateColTex = new THREE.CanvasTexture(plateCol); plateColTex.colorSpace = THREE.SRGBColorSpace;
  const roughCan = document.createElement('canvas'); roughCan.width = 256; roughCan.height = Math.round(256 * PH / PW);
  const roughTex = new THREE.CanvasTexture(roughCan);
  const plateMat = new THREE.MeshStandardMaterial({ map: plateColTex, roughnessMap: roughTex, roughness: 1, metalness: 0.55, bumpMap: bumpTex, bumpScale: 0.8 });
  const plate = new THREE.Mesh(plateGeo, plateMat); plate.receiveShadow = true; scene.add(plate);
  // 鉄板の側面と底（上の面は無し：穴が見えなくなるので）
  {
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x24211f, metalness: 0.6, roughness: 0.55, bumpMap: bumpTex, bumpScale: 1.5 });
    const none = new THREE.MeshBasicMaterial({ visible: false });
    const box = new THREE.Mesh(new THREE.BoxGeometry(PW, 0.62, PH), [sideMat, sideMat, none, sideMat, sideMat, sideMat]);
    box.position.y = -0.24 + 0.07; box.castShadow = true; box.receiveShadow = true; scene.add(box);
    box.scale.y = 1; box.position.y = 0.07 - 0.31;
    // 取っ手
    for (const sx of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.06, 10, 24, Math.PI), darkSteel); h.rotation.set(-Math.PI / 2, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2); h.position.set(sx * (PW / 2 + 0.02), -0.05, 0); scene.add(h); }
  }
  function drawRough(state) {
    const g = roughCan.getContext('2d'), W = roughCan.width, H = roughCan.height;
    g.fillStyle = 'rgb(150,150,150)'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < T.N; i++) {
      const o = state.holes[i].oil; if (o < 0.02) continue;
      const [hx, hz] = holeCenters[i], x = (hx / PW + 0.5) * W, y = (hz / PH + 0.5) * H, rr = W / PW * 0.75;
      const v = Math.round(150 - 115 * o), gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(${v},${v},${v},1)`); gr.addColorStop(0.6, `rgba(${v},${v},${v},.8)`); gr.addColorStop(1, `rgba(${v},${v},${v},0)`); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    roughTex.needsUpdate = true;
  }

  // ---------- はみ出した生地（シート） ----------
  const SW = 640, SH = Math.round(640 * PH / PW);
  const sheetCan = document.createElement('canvas'); sheetCan.width = SW; sheetCan.height = SH;
  const sheetTex = new THREE.CanvasTexture(sheetCan); sheetTex.colorSpace = THREE.SRGBColorSpace;
  const batterNoise = noiseCanvas(128, 21, [[300, 4, 0.35], [60, 12, 0.25]], '#808080');
  const sheetGeo = new THREE.PlaneGeometry(PW - 0.34, PH - 0.34, 1, 1); sheetGeo.rotateX(-Math.PI / 2);
  const sheetMat = new THREE.MeshStandardMaterial({ map: sheetTex, transparent: true, roughness: 0.55, metalness: 0, bumpMap: sheetTex, bumpScale: 2, depthWrite: false });
  const sheet = new THREE.Mesh(sheetGeo, sheetMat); sheet.position.y = 0.018; sheet.renderOrder = 2; sheet.receiveShadow = true; scene.add(sheet);
  const sPX = SW / (PW - 0.34), sPY = SH / (PH - 0.34);
  function drawSheet(state) {
    const g = sheetCan.getContext('2d'); g.clearRect(0, 0, SW, SH);
    const tx = x => (x + (PW - 0.34) / 2) * sPX, ty = z => (z + (PH - 0.34) / 2) * sPY;
    for (let i = 0; i < T.N; i++) {
      const h = state.holes[i]; if (h.spill < 0.02) continue;
      const [hx, hz] = holeCenters[i], x = tx(hx), y = ty(hz), a = Math.min(1.3, h.spill);
      const rr = (0.47 + 0.36 * Math.min(1, a)) * sPX;
      const gr0 = null; void gr0;
      const col = rampSRGB(h.spillCook * 1.05, [0, 0, 0]);
      const gr = g.createRadialGradient(x, y, rr * 0.5, x, y, rr);
      const c = `${col[0] * 255 | 0},${col[1] * 255 | 0},${col[2] * 255 | 0}`;
      gr.addColorStop(0, `rgba(${c},1)`); gr.addColorStop(0.86, `rgba(${c},${Math.min(1, 0.7 + a * 0.3)})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    }
    // 生地の気泡・ムラ
    g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.35; g.fillStyle = g.createPattern(batterNoise, 'repeat'); g.fillRect(0, 0, SW, SH);
    g.globalAlpha = 1;
    // 焼けたところは縁が濃い
    // 穴の部分と切れ目は抜く
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < T.N; i++) {
      const [hx, hz] = holeCenters[i], h = state.holes[i];
      g.beginPath(); g.arc(tx(hx), ty(hz), (h.ball ? T.HOLE_R * 0.98 : HR) * sPX, 0, 7); g.fill();
      const r = Math.floor(i / T.COLS), c = i % T.COLS;
      g.lineWidth = 0.045 * sPX; g.lineCap = 'round';
      const L = (x0, y0, x1, y1) => { g.beginPath(); g.moveTo(tx(x0), ty(y0)); g.lineTo(tx(x1), ty(y1)); g.stroke(); };
      if (h.cut & 2 && c < T.COLS - 1) L(hx + 0.5, hz - 0.5, hx + 0.5, hz + 0.5);
      if (h.cut & 4 && r < T.ROWS - 1) L(hx - 0.5, hz + 0.5, hx + 0.5, hz + 0.5);
      if (h.cut & 8 && c > 0) L(hx - 0.5, hz - 0.5, hx - 0.5, hz + 0.5);
      if (h.cut & 1 && r > 0) L(hx - 0.5, hz - 0.5, hx + 0.5, hz - 0.5);
      // 切れ目が入ったところは穴の形に生地がまとまる
      const cf = T.cutFrac(state, i);
      if (cf >= 1 && h.spill > 0.02) { g.lineWidth = 0.03 * sPX; g.beginPath(); g.rect(tx(hx - 0.5), ty(hz - 0.5), sPX, sPY); g.stroke(); }
    }
    g.globalCompositeOperation = 'source-over';
    sheetTex.needsUpdate = true;
  }

  // ---------- たこ焼き ----------
  const crustTex = new THREE.CanvasTexture(noiseCanvas(256, 5, [[1400, 2.2, 0.4], [400, 6, 0.3], [80, 16, 0.2]])); crustTex.wrapS = crustTex.wrapT = THREE.RepeatWrapping;
  const ballMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0, bumpMap: crustTex, bumpScale: 2.2 });
  const SEG_W = q === 0 ? 22 : 34, SEG_H = q === 0 ? 16 : 26;
  const tmpl = new THREE.SphereGeometry(R, SEG_W, SEG_H);
  const NV = tmpl.attributes.position.count;
  // 頂点ごとに近い面（最大4つ）の重みと、焼きムラ
  const vW = new Float32Array(NV * 4), vI = new Uint8Array(NV * 4), vJ = new Float32Array(NV), vDir = new Float32Array(NV * 3);
  {
    const p = tmpl.attributes.position, r = rng(99);
    for (let v = 0; v < NV; v++) {
      const x = p.getX(v) / R, y = p.getY(v) / R, z = p.getZ(v) / R; vDir[v * 3] = x; vDir[v * 3 + 1] = y; vDir[v * 3 + 2] = z;
      const ws = T.PD.map((d, k) => [Math.pow(Math.max(0, d[0] * x + d[1] * y + d[2] * z - 0.6), 2), k]).sort((a, b) => b[0] - a[0]).slice(0, 4);
      const sum = ws.reduce((a, w) => a + w[0], 0) || 1; ws.forEach((w, k) => { vW[v * 4 + k] = w[0] / sum; vI[v * 4 + k] = w[1]; });
      vJ[v] = (r() - 0.5) * 0.16 + (Math.sin(x * 9 + y * 7) * Math.cos(z * 8)) * 0.07;
    }
  }
  // たこ
  const takoMat = new THREE.MeshStandardMaterial({ color: 0x9a1f2c, roughness: 0.42, metalness: 0 });
  const takoInMat = new THREE.MeshStandardMaterial({ color: 0xf1dfd0, roughness: 0.5 });
  function makeTako() {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.06, 10, 18, Math.PI * 1.1), takoMat); a.rotation.x = Math.PI / 2; g.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.1), takoInMat); b.position.set(0.02, -0.01, 0.05); g.add(b);
    for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), takoInMat); s.position.set(Math.cos(k * 0.8) * 0.12, -0.03, Math.sin(k * 0.8) * 0.12); g.add(s); }
    g.scale.setScalar(0.85); return g;
  }
  // トッピングのつぶ（天かす・ねぎ・紅しょうが）をまとめて描く
  const bitGeo = { ten: new THREE.DodecahedronGeometry(0.035, 0), negi: new THREE.TorusGeometry(0.03, 0.012, 5, 10), beni: new THREE.BoxGeometry(0.07, 0.012, 0.018) };
  const bitMat = { ten: new THREE.MeshStandardMaterial({ color: 0xf0d590, roughness: 0.8, bumpMap: crustTex, bumpScale: 3 }), negi: new THREE.MeshStandardMaterial({ color: 0x4f9a2e, roughness: 0.5 }), beni: new THREE.MeshStandardMaterial({ color: 0xe0284a, roughness: 0.45 }) };
  const MAXBIT = 900, bits = {};
  for (const k of ['ten', 'negi', 'beni']) { const im = new THREE.InstancedMesh(bitGeo[k], bitMat[k], MAXBIT); im.count = 0; im.castShadow = false; im.frustumCulled = false; scene.add(im); bits[k] = im; }
  const BIT_DIRS = []; { const r = rng(42); for (let k = 0; k < 14; k++) { const th = r() * Math.PI * 2, ph = Math.acos(1 - r() * 0.95); BIT_DIRS.push([Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th), r() * 6]); } }

  // ソース・マヨなど（舟皿の上）
  const sauceMat = new THREE.MeshStandardMaterial({ color: 0x4a1f0a, roughness: 0.16, metalness: 0, transparent: true, opacity: 0.94 });
  const mayoMat = new THREE.MeshStandardMaterial({ color: 0xfff3d0, roughness: 0.3 });
  const noriMat = new THREE.MeshStandardMaterial({ color: 0x2f6b1c, roughness: 0.8 });
  const katsuoMat = new THREE.MeshStandardMaterial({ color: 0xd7a682, roughness: 0.75, side: THREE.DoubleSide, bumpMap: crustTex, bumpScale: 1.5 });
  const sauceGeo = new THREE.SphereGeometry(R * 1.035, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42);

  class BallView {
    constructor() {
      this.geo = tmpl.clone(); this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(NV * 3), 3));
      this.mesh = new THREE.Mesh(this.geo, ballMat); this.mesh.castShadow = true; this.mesh.receiveShadow = true;
      this.group = new THREE.Group(); this.group.add(this.mesh); scene.add(this.group);
      this.tako = makeTako(); this.mesh.add(this.tako);
      this.dq = new THREE.Quaternion(); this.qInit = false; this.colT = 0; this.cap = 9;
      this.sauce = null;
    }
    set(b, x, y, z, dt, opts) {
      opts = opts || {};
      const g = this.group; g.visible = true; g.position.set(x, y, z);
      const tq = new THREE.Quaternion(b.q[0], b.q[1], b.q[2], b.q[3]);
      if (!this.qInit) { this.dq.copy(tq); this.qInit = true; } else this.dq.slerp(tq, 1 - Math.exp(-dt * 14));
      this.mesh.quaternion.copy(this.dq);
      // 液面の高さ
      const inv = this.dq.clone().invert(), up = new THREE.Vector3(0, 1, 0).applyQuaternion(inv);
      let cap = b.shape > 0.03 ? T.capLevel(b) : -1 + Math.min(1, b.mass) * 0.98;
      if (opts.round) cap = 9;
      cap = Math.min(cap, 9);
      const pos = this.geo.attributes.position, col = this.geo.attributes.color, base = tmpl.attributes.position;
      const capR = cap * R;
      const nrm = this.geo.attributes.normal;
      for (let v = 0; v < NV; v++) {
        const bx = base.getX(v), by = base.getY(v), bz = base.getZ(v), d = bx * up.x + by * up.y + bz * up.z;
        if (d > capR) { const k = d - capR; pos.setXYZ(v, bx - up.x * k, by - up.y * k, bz - up.z * k); nrm.setXYZ(v, up.x, up.y, up.z); }
        else { pos.setXYZ(v, bx, by, bz); nrm.setXYZ(v, bx / R, by / R, bz / R); }
      }
      pos.needsUpdate = true; nrm.needsUpdate = true;
      this.colT -= dt;
      if (this.colT <= 0 || opts.force) {
        this.colT = 0.08;
        const c3 = [0, 0, 0];
        for (let v = 0; v < NV; v++) {
          const o = v * 4; let c = 0; for (let k = 0; k < 4; k++) c += b.cook[vI[o + k]] * vW[o + k];
          const d = vDir[v * 3] * up.x + vDir[v * 3 + 1] * up.y + vDir[v * 3 + 2] * up.z;
          const liquid = d * R > capR - 0.01;
          c = liquid ? Math.min(c, 0.04) : c + vJ[v] * Math.min(1, c * 1.5);
          rampSRGB(c, c3);
          if (liquid) { c3[0] *= 1.0; c3[1] *= 0.99; c3[2] *= 0.95; }
          col.setXYZ(v, lin(c3[0]), lin(c3[1]), lin(c3[2]));
        }
        col.needsUpdate = true;
      }
      this.cap = cap;
      // たこ：液面の真ん中あたり（丸くなったら中に入って見えない）
      this.tako.visible = !!b.tako && b.shape < 0.55;
      if (this.tako.visible) { const h = Math.max(-0.6, capR) - 0.03; this.tako.position.set(0.03, h, -0.02); this.tako.rotation.set(0, 0.6, 0); }
      // ソース
      if (opts.sauce && !this.sauce) { this.sauce = new THREE.Mesh(sauceGeo, sauceMat); this.group.add(this.sauce); }
      if (this.sauce) this.sauce.visible = !!opts.sauce;
    }
    hide() { this.group.visible = false; }
    dispose() { scene.remove(this.group); this.geo.dispose(); }
  }
  const holeViews = []; for (let i = 0; i < T.N; i++) holeViews.push(new BallView());
  // 焼き加減ガイド（穴のまわりの細い輪）
  const guideGeo = new THREE.RingGeometry(T.HOLE_R + 0.045, T.HOLE_R + 0.075, 40); guideGeo.rotateX(-Math.PI / 2);
  const guides = holeCenters.map(([x, z]) => { const m = new THREE.Mesh(guideGeo, new THREE.MeshBasicMaterial({ color: 0x66ff88, transparent: true, opacity: 0, depthWrite: false })); m.position.set(x, 0.03, z); m.renderOrder = 3; scene.add(m); return m; });

  // ---------- 小道具 ----------
  const props = []; // クリックで道具を持てる
  const ceramic = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 0 });
  function bowl(x, z, r, colIn, tool, fillMat, fillKind) {
    const g = new THREE.Group();
    const pts = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI / 2; pts.push(new THREE.Vector2(r * Math.sin(a) + 0.02, -r * 0.55 * Math.cos(a) + r * 0.55)); }
    const outer = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), new THREE.MeshStandardMaterial({ color: colIn, roughness: 0.3, side: THREE.DoubleSide }));
    outer.castShadow = true; outer.receiveShadow = true; g.add(outer);
    if (fillMat) {
      const f = new THREE.Mesh(new THREE.CircleGeometry(r * 0.86, 32), fillMat); f.rotation.x = -Math.PI / 2; f.position.y = r * 0.36; g.add(f);
      if (fillKind) { const rr = rng(x * 100 + z); for (let k = 0; k < 26; k++) { const m = new THREE.Mesh(bitGeo[fillKind] || bitGeo.ten, bitMat[fillKind] || fillMat); const a = rr() * 7, d = rr() * r * 0.75; m.position.set(Math.cos(a) * d, r * 0.38 + rr() * 0.04, Math.sin(a) * d); m.rotation.set(rr() * 6, rr() * 6, rr() * 6); m.scale.setScalar(1.6); g.add(m); } }
    }
    g.position.set(x, TY, z); g.userData.tool = tool; scene.add(g); props.push(g); return g;
  }
  // 生地のピッチャー
  const batterMat = new THREE.MeshStandardMaterial({ color: 0xf2e3b8, roughness: 0.22 });
  function pitcher() {
    const g = new THREE.Group();
    const glass = new THREE.MeshStandardMaterial({ color: 0xe8eef0, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.35 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 1.0, 32, 1, true), glass); body.position.y = 0.5; g.add(body);
    const bot = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), glass); bot.rotation.x = -Math.PI / 2; bot.position.y = 0.01; g.add(bot);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.35, 0.72, 32), batterMat); liq.position.y = 0.37; g.add(liq);
    const hd = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 20, Math.PI), glass); hd.rotation.z = -Math.PI / 2; hd.position.set(0.44, 0.55, 0); g.add(hd);
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.2, 12, 1, true), glass); sp.rotation.z = Math.PI / 2; sp.position.set(-0.47, 0.95, 0); g.add(sp);
    g.traverse(o => { o.castShadow = true; }); return g;
  }
  const pitcherProp = pitcher(); pitcherProp.position.set(-4.5, TY, 2.75); pitcherProp.userData.tool = 'pour'; scene.add(pitcherProp); props.push(pitcherProp);
  // 油（小さい器＋ハケ）
  function brushModel() {
    const g = new THREE.Group();
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.9, 10), new THREE.MeshStandardMaterial({ color: 0xc9a36a, roughness: 0.6 })); h.position.y = 0.5; g.add(h);
    const fer = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.08, 12), steel); fer.position.y = 0.06; g.add(fer);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.14, 14), new THREE.MeshStandardMaterial({ color: 0xf0e6c8, roughness: 0.9 })); br.position.y = -0.04; g.add(br);
    return g;
  }
  const oilCup = bowl(-5.45, 2.0, 0.36, 0xd9d4ca, 'oil', new THREE.MeshStandardMaterial({ color: 0xd9a531, roughness: 0.05, transparent: true, opacity: 0.85 }));
  { const b = brushModel(); b.position.set(0.05, 0.2, 0); b.rotation.z = 0.5; oilCup.add(b); }
  const takoBowl = bowl(-4.6, -2.55, 0.5, 0x3b4c6c, 'tako', new THREE.MeshStandardMaterial({ color: 0x5c1520, roughness: 0.5 }));
  { const rr = rng(5); for (let k = 0; k < 9; k++) { const t = makeTako(); t.position.set((rr() - 0.5) * 0.5, 0.25, (rr() - 0.5) * 0.5); t.rotation.set(rr(), rr() * 6, rr()); takoBowl.add(t); } }
  bowl(4.5, -2.6, 0.46, 0xe9e2d4, 'ten', new THREE.MeshStandardMaterial({ color: 0xe6c47c, roughness: 0.9 }), 'ten');
  bowl(5.5, -2.0, 0.4, 0x29343e, 'negi', new THREE.MeshStandardMaterial({ color: 0x3f7f26, roughness: 0.6 }), 'negi');
  bowl(3.6, -3.25, 0.32, 0xf3eee4, 'beni', new THREE.MeshStandardMaterial({ color: 0xc81d3e, roughness: 0.5 }), 'beni');
  // ソース類（右手前）
  function bottle(x, z, col, cap, tool, h) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, h, 20), new THREE.MeshStandardMaterial({ color: col, roughness: 0.25 })); b.position.y = h / 2; g.add(b);
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 20), new THREE.MeshStandardMaterial({ color: cap, roughness: 0.4 })); s.position.y = h + 0.15; g.add(s);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 8), new THREE.MeshStandardMaterial({ color: cap })); n.position.y = h + 0.34; g.add(n);
    g.traverse(o => o.castShadow = true); g.position.set(x, TY, z); g.userData.tool = tool; scene.add(g); props.push(g); return g;
  }
  bottle(4.4, 2.6, 0x3b1a0c, 0xd23a20, 'sauce', 0.9);
  bottle(5.0, 3.05, 0xf6ecd0, 0xd8202a, 'mayo', 0.78);
  { const g = bottle(3.75, 3.25, 0x2f6b2a, 0xe9e3d0, 'aonori', 0.55); g.scale.set(1.1, 0.9, 1.1); }
  const katsuoBox = bowl(5.55, 2.2, 0.38, 0x7b5a3b, 'katsuo', katsuoMat);
  {
    const rr = rng(77); for (let k = 0; k < 30; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.08), katsuoMat); m.position.set((rr() - 0.5) * 0.5, 0.25 + rr() * 0.1, (rr() - 0.5) * 0.5); m.rotation.set(rr() * 6, rr() * 6, rr() * 6); katsuoBox.add(m); }
  }

  // ---------- 舟皿 ----------
  const dishWood = new THREE.CanvasTexture(woodCanvas(true)); dishWood.colorSpace = THREE.SRGBColorSpace; dishWood.wrapS = dishWood.wrapT = THREE.RepeatWrapping; dishWood.repeat.set(0.3, 0.3);
  const dishMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: dishWood, roughness: 0.8 });
  function boatGeo() {
    const s = new THREE.Shape(), L = 2.1, W = 0.86;
    s.moveTo(-L, 0); s.quadraticCurveTo(-L + 0.2, W, -L + 0.6, W); s.lineTo(L - 0.6, W); s.quadraticCurveTo(L - 0.2, W, L, 0); s.quadraticCurveTo(L - 0.2, -W, L - 0.6, -W); s.lineTo(-L + 0.6, -W); s.quadraticCurveTo(-L + 0.2, -W, -L, 0);
    const hole = new THREE.Path(); const l = L - 0.07, w = W - 0.07; hole.moveTo(-l, 0); hole.quadraticCurveTo(-l + 0.2, w, -l + 0.6, w); hole.lineTo(l - 0.6, w); hole.quadraticCurveTo(l - 0.2, w, l, 0); hole.quadraticCurveTo(l - 0.2, -w, l - 0.6, -w); hole.lineTo(-l + 0.6, -w); hole.quadraticCurveTo(-l + 0.2, -w, -l, 0);
    const rim = new THREE.ExtrudeGeometry(Object.assign(s.clone(), { holes: [hole] }), { depth: 0.22, bevelEnabled: false, curveSegments: 10 }); rim.rotateX(-Math.PI / 2);
    const floor = new THREE.ExtrudeGeometry(s, { depth: 0.035, bevelEnabled: false, curveSegments: 10 }); floor.rotateX(-Math.PI / 2);
    return { rim, floor };
  }
  const bg = boatGeo();
  const SLOTS = []; for (let k = 0; k < 10; k++) SLOTS.push([(k % 5 - 2) * 0.74, k < 5 ? -0.39 : 0.39]);
  const SR = R * 0.92; // 舟皿の上の大きさ
  class Dish {
    constructor() {
      this.g = new THREE.Group();
      const rim = new THREE.Mesh(bg.rim, dishMat), fl = new THREE.Mesh(bg.floor, dishMat); rim.castShadow = fl.receiveShadow = rim.receiveShadow = true; this.g.add(rim, fl);
      this.g.position.y = TY + 0.004; scene.add(this.g);
      this.views = []; this.tops = {}; this.mayo = null; this.nori = null; this.katsuo = null; this.label = null; this.highlight = 0;
      this.glow = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.1), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, depthWrite: false })); this.glow.rotation.x = -Math.PI / 2; this.glow.position.y = 0.005; this.g.add(this.glow);
    }
    place(x, z, rot) { this.g.position.x = x; this.g.position.z = z; this.g.rotation.y = rot || 0; }
    setLabel(text, color) {
      if (this.label) { this.g.remove(this.label); this.label.material.map.dispose(); this.label = null; }
      if (!text) return;
      const t = new THREE.CanvasTexture(labelCanvas(text, color)); t.colorSpace = THREE.SRGBColorSpace;
      this.label = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false })); this.label.rotation.x = -Math.PI / 2; this.label.position.set(0, 0.002, 1.22); this.g.add(this.label);
    }
    worldSlot(k) { const v = new THREE.Vector3(SLOTS[k][0], 0, SLOTS[k][1]).applyEuler(this.g.rotation).add(this.g.position); return v; }
    update(balls, tops, dt, time) {
      while (this.views.length < balls.length) this.views.push(new BallView());
      this.views.forEach((v, k) => {
        if (k >= balls.length) return v.hide();
        const p = this.worldSlot(k);
        v.set(balls[k], p.x, TY + 0.035 + SR, p.z, dt, { round: true, sauce: tops.sauce }); v.group.scale.setScalar(0.92);
      });
      const n = balls.length;
      // マヨ（ジグザグ）
      if (tops.mayo && n && (!this.mayo || this.mayo.userData.n !== n)) {
        if (this.mayo) this.g.remove(this.mayo);
        const pts = []; const cols = Math.min(5, n), x0 = SLOTS[0][0] - 0.3, x1 = SLOTS[cols - 1][0] + 0.3, rows = n > 5 ? 2 : 1;
        const zA = rows > 1 ? -0.55 : -0.55, zB = rows > 1 ? 0.55 : -0.05, segs = cols * 3;
        const surf = (x, z) => { let y = 0.07; for (let k = 0; k < n; k++) { const dx = x - SLOTS[k][0], dz = z - SLOTS[k][1], d2 = dx * dx + dz * dz; if (d2 < SR * SR) y = Math.max(y, 0.035 + SR + Math.sqrt(SR * SR - d2)); } return y + 0.025; };
        for (let k = 0; k <= segs; k++) { for (let j = 0; j < 6; j++) { const f = (k + j / 6) / segs; if (k === segs && j) break; const x = x0 + (x1 - x0) * f, ph = (k + j / 6) % 2, z = k % 2 ? zB + (zA - zB) * (j / 6) : zA + (zB - zA) * (j / 6); void ph; pts.push(new THREE.Vector3(x, surf(x, z), z)); } }
        this.mayo = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.03, 8), mayoMat); this.mayo.userData.n = n; this.mayo.castShadow = true; this.g.add(this.mayo);
      }
      if (this.mayo) this.mayo.visible = !!tops.mayo && n > 0;
      // 青のり
      if (tops.aonori && n && (!this.nori || this.nori.userData.n !== n)) {
        if (this.nori) this.g.remove(this.nori);
        const im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.025, 0.025), noriMat, n * 40), m = new THREE.Matrix4(), rr = rng(n * 31), e = new THREE.Euler();
        let c = 0; for (let k = 0; k < n; k++) for (let j = 0; j < 40; j++) { const th = rr() * 7, ph = rr() * 1.1, x = SLOTS[k][0] + Math.sin(ph) * Math.cos(th) * SR * 1.05, z = SLOTS[k][1] + Math.sin(ph) * Math.sin(th) * SR * 1.05, y = 0.035 + SR + Math.cos(ph) * SR * 1.06; e.set(-Math.PI / 2 + (rr() - 0.5), rr() * 6, 0); m.makeRotationFromEuler(e).setPosition(x, y, z); im.setMatrixAt(c++, m); }
        im.userData.n = n; this.nori = im; this.g.add(im);
      }
      if (this.nori) this.nori.visible = !!tops.aonori && n > 0;
      // かつお節（踊る）
      if (tops.katsuo && n && (!this.katsuo || this.katsuo.userData.n !== n)) {
        if (this.katsuo) this.g.remove(this.katsuo);
        const grp = new THREE.Group(), rr = rng(n * 7 + 1), geo = new THREE.PlaneGeometry(0.16, 0.11, 3, 1);
        { const p = geo.attributes.position; for (let v = 0; v < p.count; v++) p.setZ(v, Math.sin(p.getX(v) * 18) * 0.015); geo.computeVertexNormals(); }
        for (let k = 0; k < n; k++) for (let j = 0; j < 7; j++) { const f = new THREE.Mesh(geo, katsuoMat); const th = rr() * 7, ph = rr() * 0.8; f.position.set(SLOTS[k][0] + Math.sin(ph) * Math.cos(th) * SR, 0.035 + SR + Math.cos(ph) * SR + 0.03, SLOTS[k][1] + Math.sin(ph) * Math.sin(th) * SR); f.userData.r = [rr() * 6, rr() * 6, rr() * 6, rr() * 10, 0.6 + rr()]; grp.add(f); }
        grp.userData.n = n; this.katsuo = grp; this.g.add(grp);
      }
      if (this.katsuo) {
        this.katsuo.visible = !!tops.katsuo && n > 0;
        if (this.katsuo.visible) for (const f of this.katsuo.children) { const r = f.userData.r, w = Math.sin(time * 5 * r[4] + r[3]); f.rotation.set(r[0] + w * 0.35, r[1] + Math.sin(time * 3 + r[3]) * 0.3, r[2] + w * 0.5); }
      }
      this.highlight += ((this.hl ? 1 : 0) - this.highlight) * Math.min(1, dt * 10);
      this.glow.material.opacity = this.highlight * 0.22;
    }
  }
  const dishes = [];
  function setDishes(list) { // list: [{x,z,rot,label,color}]
    while (dishes.length < list.length) dishes.push(new Dish());
    dishes.forEach((d, k) => { const L = list[k]; d.g.visible = !!L; if (!L) return; d.place(L.x, L.z, L.rot); if (d._lab !== L.label + L.color) { d._lab = L.label + L.color; d.setLabel(L.label, L.color); } });
  }

  // ---------- 手に持っている道具（カーソル） ----------
  function pickModel(col) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const p = new THREE.Group();
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.003, 0.9, 8), steel); pin.position.y = 0.45; p.add(pin);
      const hd = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.6, 12), new THREE.MeshStandardMaterial({ color: col || 0xc6975e, roughness: 0.55 })); hd.position.y = 1.15; p.add(hd);
      p.position.x = s * 0.07; p.rotation.z = -s * 0.05; g.add(p);
    }
    g.traverse(o => o.castShadow = true); return g;
  }
  const cursors = []; // 自分も他人も
  function cursorFor(k, col) {
    if (cursors[k]) return cursors[k];
    const root = new THREE.Group(); scene.add(root);
    const models = { pick: pickModel(col), oil: brushModel(), pour: pitcher(), spoon: (() => { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, 7, 0, 1.4), steel); s.rotation.x = Math.PI; g.add(s); const h = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.8, 8), steel); h.position.set(0, 0.35, -0.25); h.rotation.x = 0.6; g.add(h); return g; })(), bottle: new THREE.Group() };
    models.pour.scale.setScalar(0.85);
    for (const m of Object.values(models)) { m.visible = false; root.add(m); }
    // 他人の名前
    cursors[k] = { root, models, label: null, col }; return cursors[k];
  }
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 1, 10, 1, true), batterMat); stream.visible = false; scene.add(stream);

  // ---------- 湯気・煙 ----------
  const puffTex = new THREE.CanvasTexture(spriteCanvas('puff'));
  const P_MAX = 160, parts = [];
  for (let k = 0; k < P_MAX; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0, color: 0xffffff })); s.visible = false; scene.add(s); parts.push({ s, life: 0 }); }
  let pIdx = 0;
  function emit(x, y, z, kind, k) {
    const p = parts[pIdx++ % P_MAX]; p.s.visible = true; p.life = p.max = kind === 'smoke' ? 2.6 : 1.6 + Math.random() * 0.8;
    p.kind = kind; p.s.position.set(x + (Math.random() - 0.5) * 0.3, y, z + (Math.random() - 0.5) * 0.3);
    p.v = [(Math.random() - 0.5) * 0.15, 0.55 + Math.random() * 0.4, (Math.random() - 0.5) * 0.15]; p.size = (kind === 'splash' ? 0.25 : 0.45) * (k || 1);
    p.s.material.color.set(kind === 'smoke' ? 0x555049 : kind === 'splash' ? 0xf5e7c0 : 0xffffff);
  }

  // ---------- カメラ ----------
  let seat = 0, camAng = 0, W = 1, H = 1;
  function layout() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    renderer.setSize(W, H, false); camera.aspect = W / H;
    const portrait = W / H < 0.9;
    camera.fov = portrait ? 46 : 36;
    // 見せたい幅と奥行き
    const needW = portrait ? 6.9 : 11.2, needH = portrait ? 10 : 9.2;
    const vf = camera.fov * Math.PI / 180, hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const dist = Math.max(needW / 2 / Math.tan(hf / 2), needH / 2 / Math.tan(vf / 2)) * 1.0;
    // 横の席から見るときは鉄板が縦長になるので、そのぶん引く
    const needW2 = portrait ? 8.4 : 9.6, needH2 = portrait ? 12.2 : 11.6;
    camera.userData.dist2 = Math.max(needW2 / 2 / Math.tan(hf / 2), needH2 / 2 / Math.tan(vf / 2));
    camera.userData.dist = dist; camera.updateProjectionMatrix();
  }
  function placeCam(dt) {
    const target = seat * Math.PI / 2; let d = target - camAng; d = Math.atan2(Math.sin(d), Math.cos(d)); camAng += d * Math.min(1, dt * 4);
    const dist = (seat % 2 ? camera.userData.dist2 : camera.userData.dist) || 13, el = 1.13; // 仰角（ラジアン）
    const cx = Math.sin(camAng), cz = Math.cos(camAng);
    const look = new THREE.Vector3(cx * 1.25, -0.6, cz * 1.25);
    camera.position.set(look.x + cx * dist * Math.cos(el), look.y + dist * Math.sin(el), look.z + cz * dist * Math.cos(el));
    camera.lookAt(look);
  }
  layout(); placeCam(1);

  // ---------- 当たり判定 ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tv = new THREE.Vector3();
  function pickAt(cx, cy) {
    const rc = canvas.getBoundingClientRect(); ndc.set((cx - rc.left) / rc.width * 2 - 1, -(cy - rc.top) / rc.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const out = { x: 0, z: 0, ok: false, prop: null, dish: -1 };
    if (ray.ray.intersectPlane(plane0, tv)) { out.x = tv.x; out.z = tv.z; out.ok = true; }
    // 舟皿（テーブルの高さで）
    const pt = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TY + 0.3)), tw = new THREE.Vector3();
    if (ray.ray.intersectPlane(pt, tw)) {
      out.tx = tw.x; out.tz = tw.z;
      dishes.forEach((d, k) => { if (!d.g.visible) return; const l = tw.clone().sub(d.g.position).applyAxisAngle(new THREE.Vector3(0, 1, 0), -d.g.rotation.y); if (Math.abs(l.x) < 2.2 && Math.abs(l.z) < 1.05) out.dish = k; });
    }
    const hits = ray.intersectObjects(props, true);
    if (hits.length) { let o = hits[0].object; while (o && !o.userData.tool) o = o.parent; if (o) out.prop = o.userData.tool; }
    return out;
  }
  function project(x, y, z) { const v = new THREE.Vector3(x, y, z).project(camera); const rc = canvas.getBoundingClientRect(); return [(v.x + 1) / 2 * rc.width + rc.left, (1 - v.y) / 2 * rc.height + rc.top, v.z < 1]; }
  function dishScreen(k) { const d = dishes[k]; if (!d) return null; return project(d.g.position.x, TY + 0.5, d.g.position.z); }
  // 画面のドラッグ方向を、鉄板の上の向きに直す
  function screenDirToWorld(dx, dy) {
    const f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize(); const r = new THREE.Vector3(-f.z, 0, f.x);
    const w = r.multiplyScalar(dx).add(f.multiplyScalar(-dy)); return [w.x, w.z];
  }

  // ---------- 毎フレーム ----------
  let time = 0, sheetT = 0, roughT = 0, steamAcc = 0;
  const mtx = new THREE.Matrix4(), eul = new THREE.Euler(), qv = new THREE.Quaternion(), vv = new THREE.Vector3(), sc = new THREE.Vector3();
  const prof = { js: 0, gl: 0 };
  function update(state, dt, view) {
    const tU0 = performance.now(); time += dt; placeCam(dt);
    // 火
    const fire = state.fire;
    flames.forEach(f => { const k = 0.55 + fire * 0.13, w = 1 + Math.sin(time * 23 + f.userData.ph) * 0.12 + Math.sin(time * 41 + f.userData.ph * 2) * 0.08; f.scale.set(0.22 * k, 0.3 * k * w, 1); f.material.opacity = 0.5 + fire * 0.1; });
    flameLight.intensity = (0.4 + fire * 0.35) * (1 + Math.sin(time * 30) * 0.08);
    // 鉄板・シート
    sheetT -= dt; if (sheetT <= 0) { sheetT = 0.12; drawSheet(state); }
    roughT -= dt; if (roughT <= 0) { roughT = 0.3; drawRough(state); }
    // たこ焼き
    const counts = { ten: 0, negi: 0, beni: 0 };
    for (let i = 0; i < T.N; i++) {
      const h = state.holes[i], b = h.ball, v = holeViews[i];
      if (!b || (view.carry && view.carry.i === i && view.carry.lift)) { v.hide(); if (!b) v.qInit = false; continue; }
      const [x, z] = holeCenters[i];
      const wob = view.wobble && view.wobble[i] ? Math.sin(time * 40) * 0.02 * view.wobble[i] : 0;
      v.group.scale.setScalar(1); v.set(b, x + wob, 0, z, dt);
      // つぶ
      v.mesh.updateMatrixWorld();
      for (const kind of ['ten', 'negi', 'beni']) {
        const n = Math.round(b[kind] * 5); const im = bits[kind];
        for (let k = 0; k < n && counts[kind] < MAXBIT; k++) {
          const d = BIT_DIRS[(k * 3 + (kind === 'negi' ? 1 : kind === 'beni' ? 2 : 0) + i) % BIT_DIRS.length];
          vv.set(d[0], d[1], d[2]).multiplyScalar(R * 1.01);
          const capR = v.cap * R, inv = v.dq.clone().invert(), up = new THREE.Vector3(0, 1, 0).applyQuaternion(inv), dd = vv.dot(up);
          if (dd > capR) vv.addScaledVector(up, capR - dd + 0.01);
          vv.applyMatrix4(v.mesh.matrixWorld);
          eul.set(d[3], d[3] * 2, d[3] * 0.5); qv.setFromEuler(eul); mtx.compose(vv, qv, sc.set(1, 1, 1)); im.setMatrixAt(counts[kind]++, mtx);
        }
      }
      // 湯気
      const T0 = h.temp;
      if (Math.random() < dt * (T0 * 3.2 * (0.3 + b.core) + (b.cook.some(c => c > 1.75) ? 1.5 : 0))) emit(x, 0.25, z, b.cook.filter(c => c > 1.75).length > 4 ? 'smoke' : 'steam');
    }
    guides.forEach((g, i) => { const c = view.guide && view.guide[i]; const target = c ? 0.75 + Math.sin(time * 6) * 0.2 : 0; g.material.opacity += (target - g.material.opacity) * Math.min(1, dt * 8); if (c) g.material.color.set(c); });
    for (const k of ['ten', 'negi', 'beni']) { bits[k].count = counts[k]; bits[k].instanceMatrix.needsUpdate = true; }
    for (let i = 0; i < T.N; i++) { const h = state.holes[i]; if (h.spill > 0.1 && Math.random() < dt * (h.temp * 1.2 + (h.spillCook > 1.8 ? 2 : 0))) emit(holeCenters[i][0] + 0.3, 0.1, holeCenters[i][1] + 0.3, h.spillCook > 1.8 ? 'smoke' : 'steam', 0.8); }
    // 持ち上げているたこ焼き
    if (view.carry && view.carry.lift && state.holes[view.carry.i].ball) {
      const v = holeViews[view.carry.i]; v.group.visible = true; v.set(state.holes[view.carry.i].ball, view.carry.x, view.carry.y ?? 0.7, view.carry.z, dt, { round: false });
    }
    // 舟皿
    (view.dishes || []).forEach((d, k) => { if (dishes[k]) { dishes[k].hl = view.hlDish === k; dishes[k].update(d.balls, d.tops || {}, dt, time); } });
    // カーソル
    (view.cursors || []).forEach((c, k) => {
      const cu = cursorFor(k, c.col);
      const kind = c.tool === 'pour' ? 'pour' : c.tool === 'oil' ? 'oil' : ['tako', 'ten', 'negi', 'beni'].includes(c.tool) ? 'spoon' : 'pick';
      for (const [n, m] of Object.entries(cu.models)) m.visible = c.on && n === kind;
      if (!c.on) return;
      const tx = c.x, tz = c.z;
      cu.root.position.x += (tx - cu.root.position.x) * Math.min(1, dt * (c.me ? 40 : 12));
      cu.root.position.z += (tz - cu.root.position.z) * Math.min(1, dt * (c.me ? 40 : 12));
      const down = c.down ? 1 : 0; cu.d = (cu.d || 0) + (down - (cu.d || 0)) * Math.min(1, dt * 18);
      if (kind === 'pick') { cu.root.position.y = 0.02 + (1 - cu.d) * 0.35; cu.root.rotation.set(0.35, camAng, -0.25); }
      else if (kind === 'oil') { cu.root.position.y = 0.08 + (1 - cu.d) * 0.3; cu.root.rotation.set(0.3, camAng, -0.4); }
      else if (kind === 'spoon') { cu.root.position.y = 0.6; cu.root.rotation.set(c.down ? 0.5 : 0, camAng, 0); }
      else { cu.root.position.y = 1.1; cu.root.rotation.set(0, camAng + Math.PI / 2, c.down ? 0.9 : 0.25); }
      if (kind === 'pour' && c.down) {
        // 注ぎ口から鉄板へ
        cu.root.updateMatrixWorld(); const sp = new THREE.Vector3(-0.47, 0.95, 0).applyMatrix4(cu.models.pour.matrixWorld);
        const end = new THREE.Vector3(tx, 0.0, tz), len = sp.distanceTo(end);
        stream.visible = true; stream.position.copy(sp).add(end).multiplyScalar(0.5); stream.scale.set(1, len, 1);
        stream.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sp.clone().sub(end).normalize());
        if (Math.random() < dt * 14) emit(tx, 0.05, tz, 'splash', 0.6);
      } else if (c.me && kind === 'pour') stream.visible = false;
    });
    if (!(view.cursors || []).some(c => c.on && c.tool === 'pour' && c.down)) stream.visible = false;
    for (let k = (view.cursors || []).length; k < cursors.length; k++) if (cursors[k]) for (const m of Object.values(cursors[k].models)) m.visible = false;
    // 粒子
    for (const p of parts) {
      if (p.life <= 0) continue; p.life -= dt; if (p.life <= 0) { p.s.visible = false; continue; }
      const a = p.life / p.max; p.s.position.x += p.v[0] * dt; p.s.position.y += p.v[1] * dt * (p.kind === 'splash' ? -0.2 : 1); p.s.position.z += p.v[2] * dt;
      const s = p.size * (1.6 - a); p.s.scale.set(s, s, 1);
      p.s.material.opacity = (p.kind === 'smoke' ? 0.35 : p.kind === 'splash' ? 0.6 : 0.16) * Math.sin(a * Math.PI);
    }
    const tJ = performance.now(); renderer.render(scene, camera); prof.js = prof.js * 0.9 + (tJ - tU0) * 0.1; prof.gl = prof.gl * 0.9 + (performance.now() - tJ) * 0.1;
  }
  function setSeat(s) { seat = s; }
  addEventListener('resize', layout);
  return { prof, update, pickAt, project, dishScreen, setDishes, setSeat, screenDirToWorld, emit, layout, renderer, get seat() { return seat; }, TY, R, css };
}
