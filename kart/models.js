// うぱカートGP — キャラとカートのモデル（ぜんぶプログラムで作る）
import * as THREE from '../upa/vendor/three.module.min.js';

import { CHARS } from './chars.js';
export { CHARS };

const M = (c, o = {}) => (o.clearcoat || o.transmission ? new THREE.MeshPhysicalMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0 }, o)) : new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0 }, o)));
const sph = (r, m, ws = 24, hs = 16) => new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), m);
function eyes(g, y, z, sx, r = 0.07, col = 0x111111) {
  const em = M(col, { roughness: 0.2, clearcoat: 1 }), hm = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (const s of [-1, 1]) { const e = sph(r, em, 16, 12); e.position.set(s * sx, y, z); e.scale.z = 0.6; g.add(e); const h = sph(r * 0.32, hm, 8, 6); h.position.set(s * sx + r * 0.3, y + r * 0.35, z + r * 0.45); g.add(h); }
}
function cheeks(g, y, z, sx) { const m = new THREE.MeshBasicMaterial({ color: 0xff7aa0, transparent: true, opacity: 0.55 }); for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), m); c.position.set(s * sx, y, z); c.lookAt(s * sx * 3, y, z + 2); g.add(c); } }
function mouth(g, y, z, w = 0.08) { const m = new THREE.Mesh(new THREE.TorusGeometry(w, 0.012, 6, 16, Math.PI), M(0x401010)); m.position.set(0, y, z); m.rotation.z = Math.PI; g.add(m); }

// 頭（キャラごと）— 前は +z
export function makeHead(id) {
  const c = CHARS.find(x => x.id === id), g = new THREE.Group(), skin = M(c.col, { roughness: 0.45, clearcoat: 0.3 });
  if (id === 'upa') {
    const h = sph(0.36, skin); h.scale.set(1.25, 0.9, 1); g.add(h);
    const gm = M(0xff5c8a, { roughness: 0.4 });
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const gi = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), gm); gi.position.set(s * 0.42, 0.08 + (k - 1) * 0.1, -0.05); gi.rotation.z = s * (0.9 - (k - 1) * 0.45); g.add(gi); for (let f = 0; f < 3; f++) { const fr = sph(0.03, gm, 8, 6); fr.position.set(s * (0.48 + f * 0.04), 0.1 + (k - 1) * 0.12 + f * 0.02, -0.05); g.add(fr); } }
    eyes(g, 0.05, 0.3, 0.2, 0.055); mouth(g, -0.08, 0.33, 0.09); cheeks(g, -0.04, 0.31, 0.27);
  } else if (id === 'neko') {
    const h = sph(0.34, skin); g.add(h);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 4), skin); e.position.set(s * 0.2, 0.32, 0); e.rotation.z = -s * 0.3; g.add(e); const ei = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 4), M(0xffc0c0)); ei.position.set(s * 0.2, 0.31, 0.04); ei.rotation.z = -s * 0.3; g.add(ei); }
    const st = M(0x8a4a1a); for (let k = 0; k < 3; k++) { const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.02), st); s2.position.set((k - 1) * 0.09, 0.27, 0.15); s2.rotation.x = -0.6; g.add(s2); }
    const mz = sph(0.13, M(0xfff2e0)); mz.position.set(0, -0.1, 0.25); mz.scale.set(1.3, 0.8, 0.7); g.add(mz);
    const ns = sph(0.035, M(0xff7a8a)); ns.position.set(0, -0.04, 0.34); g.add(ns);
    const wm = new THREE.MeshBasicMaterial({ color: 0x333333 }); for (const s of [-1, 1]) for (const a of [-0.15, 0.1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.008, 0.008), wm); w.position.set(s * 0.25, -0.08 + a * 0.3, 0.27); w.rotation.z = s * a; g.add(w); }
    eyes(g, 0.06, 0.28, 0.13, 0.06);
  } else if (id === 'usagi') {
    const h = sph(0.33, skin); g.add(h);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.42, 6, 12), skin); e.position.set(s * 0.12, 0.55, -0.05); e.rotation.z = -s * 0.12; g.add(e); const ei = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.34, 4, 8), M(0xffb0c8)); ei.position.set(s * 0.12, 0.55, 0.02); ei.rotation.z = -s * 0.12; g.add(ei); }
    eyes(g, 0.05, 0.28, 0.13, 0.06, 0xc0203a); cheeks(g, -0.07, 0.29, 0.2);
    const ns = sph(0.03, M(0xff8aa0)); ns.position.set(0, -0.04, 0.33); g.add(ns);
  } else if (id === 'pen') {
    const h = sph(0.35, skin); g.add(h);
    const face = sph(0.27, M(0xffffff)); face.position.set(0, -0.03, 0.12); face.scale.set(1.1, 0.95, 0.8); g.add(face);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 12), M(0xffa020)); bk.rotation.x = Math.PI / 2; bk.position.set(0, -0.05, 0.38); g.add(bk);
    eyes(g, 0.06, 0.3, 0.12, 0.05); cheeks(g, -0.06, 0.3, 0.2);
  } else if (id === 'kuma') {
    const h = sph(0.37, skin); g.add(h);
    for (const s of [-1, 1]) { const e = sph(0.12, skin); e.position.set(s * 0.26, 0.28, -0.02); g.add(e); const ei = sph(0.065, M(0x5a3418)); ei.position.set(s * 0.27, 0.28, 0.05); g.add(ei); }
    const mz = sph(0.15, M(0xe8c8a0)); mz.position.set(0, -0.1, 0.27); mz.scale.set(1.2, 0.85, 0.8); g.add(mz);
    const ns = sph(0.05, M(0x2a1a10, { clearcoat: 1 })); ns.position.set(0, -0.04, 0.39); g.add(ns);
    eyes(g, 0.07, 0.31, 0.14, 0.05);
  } else if (id === 'robo') {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.52), M(c.col, { metalness: 0.85, roughness: 0.25 })); g.add(h);
    const vis = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.04), M(0x10141c, { metalness: 0.5, roughness: 0.1 })); vis.position.set(0, 0.04, 0.27); g.add(vis);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.4, 2.6), toneMapped: false })); e.position.set(s * 0.12, 0.04, 0.3); e.name = 'led'; g.add(e); }
    const an = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.25), M(0x888888, { metalness: 0.9 })); an.position.y = 0.37; g.add(an);
    const ab = sph(0.05, new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.4, 0.3), toneMapped: false })); ab.position.y = 0.5; g.add(ab);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 16), M(0x707a88, { metalness: 0.9, roughness: 0.3 })); ear.rotation.z = Math.PI / 2; ear.position.x = s * 0.33; g.add(ear); }
  } else if (id === 'kaeru') {
    const h = sph(0.34, skin); h.scale.set(1.2, 0.8, 1); g.add(h);
    for (const s of [-1, 1]) { const e = sph(0.13, skin); e.position.set(s * 0.18, 0.22, 0.12); g.add(e); const w = sph(0.1, M(0xffffff)); w.position.set(s * 0.18, 0.24, 0.19); g.add(w); const p = sph(0.055, M(0x111111, { clearcoat: 1 })); p.position.set(s * 0.18, 0.25, 0.28); g.add(p); }
    mouth(g, -0.06, 0.3, 0.16); cheeks(g, -0.03, 0.29, 0.28);
    const belly = sph(0.25, M(0xe8f8c0)); belly.position.set(0, -0.12, 0.12); belly.scale.set(1.1, 0.5, 0.8); g.add(belly);
  } else if (id === 'hiyoko') {
    const h = sph(0.34, skin); g.add(h);
    const bk = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 12), M(0xff8a2a)); bk.rotation.x = Math.PI / 2; bk.position.set(0, -0.05, 0.37); g.add(bk);
    for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 8), skin); t.position.set((k - 1) * 0.05, 0.38, 0); t.rotation.z = (k - 1) * 0.5; g.add(t); }
    eyes(g, 0.06, 0.3, 0.13, 0.05); cheeks(g, -0.05, 0.3, 0.21);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}

// ドライバー（体＋頭＋うで）
export function makeDriver(id) {
  const c = CHARS.find(x => x.id === id), g = new THREE.Group();
  const bodyCol = id === 'pen' ? 0x2a3446 : id === 'robo' ? 0x9aa6b4 : c.col;
  const body = sph(0.3, M(bodyCol, { roughness: 0.5, metalness: id === 'robo' ? 0.8 : 0 })); body.scale.set(1, 1.05, 0.9); body.position.y = 0.3; g.add(body);
  if (id === 'pen' || id === 'kaeru' || id === 'hiyoko' || id === 'kuma') { const b = sph(0.22, M(id === 'pen' ? 0xffffff : id === 'kaeru' ? 0xe8f8c0 : id === 'kuma' ? 0xe8c8a0 : 0xfff6c0)); b.position.set(0, 0.26, 0.12); b.scale.set(1, 1.1, 0.7); g.add(b); }
  // マフラー（キャラ色のカートとおそろい）
  const sc = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), M(c.kart, { roughness: 0.8 })); sc.rotation.x = Math.PI / 2; sc.position.y = 0.55; g.add(sc);
  const head = makeHead(id); head.position.y = 0.88; head.name = 'head'; g.add(head);
  const arm = M(bodyCol, { roughness: 0.5 });
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.32, 4, 8), arm); a.position.set(s * 0.25, 0.38, 0.22); a.rotation.x = -1.1; a.rotation.z = -s * 0.25; a.name = 'arm' + s; g.add(a); const hd = sph(0.07, M(id === 'robo' ? 0x707a88 : 0xffffff)); hd.position.set(s * 0.2, 0.3, 0.42); g.add(hd); }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// 角の丸い箱（押し出し）
function roundBox(w, h, d, r, mat) {
  const s = new THREE.Shape(); const x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d); s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 4, curveSegments: 8 });
  g.rotateX(Math.PI / 2); g.translate(0, h / 2, 0);
  return new THREE.Mesh(g, mat);
}
const tireGeo = (() => { const g = new THREE.CylinderGeometry(0.3, 0.3, 0.26, 28, 1); g.rotateZ(Math.PI / 2); return g; })();
const tireEdge = (() => { const g = new THREE.TorusGeometry(0.27, 0.035, 8, 28); g.rotateY(Math.PI / 2); return g; })();

export function makeKart(id, num) {
  const c = CHARS.find(x => x.id === id), g = new THREE.Group();
  const paint = M(c.kart, { metalness: 0.35, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
  const black = M(0x1a1d22, { roughness: 0.6 }), chrome = M(0xdddddd, { metalness: 1, roughness: 0.18 });
  const body = roundBox(1.25, 0.3, 2.2, 0.35, paint); body.position.set(0, 0.32, 0); g.add(body);
  const nose = roundBox(0.9, 0.22, 0.7, 0.25, paint); nose.position.set(0, 0.3, 1.25); g.add(nose);
  const bump = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 1.1, 4, 12), black); bump.rotation.z = Math.PI / 2; bump.position.set(0, 0.28, 1.62); g.add(bump);
  const side = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 1.1), black); side.position.set(0, 0.25, -0.05); g.add(side);
  const seat = roundBox(0.7, 0.5, 0.45, 0.15, M(0x22262c, { roughness: 0.8 })); seat.position.set(0, 0.6, -0.45); seat.rotation.x = -0.25; g.add(seat);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5), chrome); col.position.set(0, 0.72, 0.42); col.rotation.x = 0.7; g.add(col);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 24), black); wheel.position.set(0, 0.9, 0.3); wheel.rotation.x = -0.7; wheel.name = 'steer'; g.add(wheel);
  // エンジンとマフラー
  const eng = roundBox(0.7, 0.3, 0.45, 0.1, M(0x50565e, { metalness: 0.8, roughness: 0.4 })); eng.position.set(0, 0.45, -1.05); g.add(eng);
  for (const s of [-1, 1]) { const ex = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.35, 16, 1, true), M(0x55595f, { metalness: 0.6, roughness: 0.5 })); ex.rotation.x = Math.PI / 2 - 0.3; ex.position.set(s * 0.22, 0.55, -1.38); g.add(ex); }
  // ウイング
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 0.32), paint); wing.position.set(0, 0.95, -1.25); wing.rotation.x = 0.12; g.add(wing);
  for (const s of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.4, 0.12), black); st.position.set(s * 0.45, 0.75, -1.2); g.add(st); const ep = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.4), paint); ep.position.set(s * 0.7, 0.98, -1.25); g.add(ep); }
  // ゼッケン
  const nc = document.createElement('canvas'); nc.width = nc.height = 128; const x = nc.getContext('2d'); x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = '900 78px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(num), 64, 70);
  const nt = new THREE.CanvasTexture(nc); nt.colorSpace = THREE.SRGBColorSpace;
  const plate = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), new THREE.MeshStandardMaterial({ map: nt, roughness: 0.5 })); plate.position.set(0, 0.52, 1.52); plate.rotation.x = -0.35; g.add(plate);
  // タイヤ
  const tireM = M(0x16181c, { roughness: 0.85 }), rimM = M(0xe8e8e8, { metalness: 1, roughness: 0.2 });
  const wheels = [];
  for (const [wx, wz, big] of [[-0.78, 0.95, 0], [0.78, 0.95, 0], [-0.82, -0.85, 1], [0.82, -0.85, 1]]) {
    const wg = new THREE.Group(); const k = big ? 1.12 : 1; wg.position.set(wx, 0.3 * k, wz); wg.scale.setScalar(k);
    const t = new THREE.Mesh(tireGeo, tireM); wg.add(t); for (const e of [-1, 1]) { const ed = new THREE.Mesh(tireEdge, tireM); ed.position.x = e * 0.13; wg.add(ed); }
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.28, 20), rimM); rim.rotation.z = Math.PI / 2; wg.add(rim);
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.05), M(c.kart, { metalness: 0.6, roughness: 0.3 })); sp.rotation.x = i / 5 * Math.PI; wg.add(sp); }
    g.add(wg); wheels.push(wg); wg.userData.front = wz > 0;
  }
  g.userData.wheels = wheels;
  const drv = makeDriver(id); drv.position.set(0, 0.5, -0.35); drv.name = 'driver'; g.add(drv);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
