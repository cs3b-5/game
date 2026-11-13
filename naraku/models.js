// 奈落の迷宮 — キャラとアイテムの3Dモデル（ぜんぶプログラムで作る・軽め）
import * as THREE from '../upa/vendor/three.module.min.js';

const mcache = new Map();
export const mat = (c, o = {}) => { const k = c + JSON.stringify(o); if (!mcache.has(k)) mcache.set(k, new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7, metalness: 0.1 }, o))); return mcache.get(k); };
export const glowMat = (r, g, b) => { const k = `g${r},${g},${b}`; if (!mcache.has(k)) mcache.set(k, new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b), toneMapped: false })); return mcache.get(k); };
const G = {}; const geo = (k, f) => G[k] || (G[k] = f());
const sph = (r, m, d = 1) => new THREE.Mesh(geo('s' + d, () => new THREE.IcosahedronGeometry(1, d)), m).scale.setScalar(r) && null;
function S(r, m, d = 1) { const o = new THREE.Mesh(geo('s' + d, () => new THREE.IcosahedronGeometry(1, d)), m); o.scale.setScalar(r); return o; }
function B(w, h, d, m) { const o = new THREE.Mesh(geo('b', () => new THREE.BoxGeometry(1, 1, 1)), m); o.scale.set(w, h, d); return o; }
function Cy(r1, r2, h, m, seg = 8) { const o = new THREE.Mesh(geo(`c${r1}_${r2}_${seg}`, () => new THREE.CylinderGeometry(r1, r2, 1, seg)), m); o.scale.y = h; return o; }
function Co(r, h, m, seg = 8) { const o = new THREE.Mesh(geo(`k${seg}`, () => new THREE.ConeGeometry(1, 1, seg)), m); o.scale.set(r, h, r); return o; }
function Ca(r, l, m) { const o = new THREE.Mesh(geo(`cap${r}_${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 8)), m); return o; }
const at = (o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
function eyes(g, y, z, sx, r, col) { for (const s of [-1, 1]) g.add(at(S(r, glowMat(...col), 0), s * sx, y, z)); }

// 主人公：黒いよろいの騎士（マント・ランタン）
export function makeHero() {
  const g = new THREE.Group(), armor = mat(0x3a3e4a, { metalness: 0.75, roughness: 0.35 }), dark = mat(0x1a1c22, { metalness: 0.6, roughness: 0.4 }), cloth = mat(0x4a1020, { roughness: 0.9, side: THREE.DoubleSide });
  g.add(at(Ca(0.2, 0.3, armor), 0, 0.62, 0));
  g.add(at(S(0.17, armor), 0, 1.02, 0));
  g.add(at(B(0.26, 0.05, 0.08, glowMat(1.6, 0.7, 0.3)), 0, 1.03, 0.14));
  g.add(at(Co(0.05, 0.22, armor), 0, 1.22, -0.02, -0.4));
  for (const s of [-1, 1]) { g.add(at(Ca(0.08, 0.28, dark), s * 0.1, 0.22, 0)); g.add(at(S(0.12, armor), s * 0.25, 0.85, 0)); g.add(at(Ca(0.06, 0.25, armor), s * 0.27, 0.6, 0.05, 0.3)); }
  const cape = new THREE.Mesh(geo('cape', () => { const p = new THREE.PlaneGeometry(0.5, 0.8, 2, 4); p.translate(0, -0.4, 0); return p; }), cloth); at(cape, 0, 0.95, -0.18, 0.15); cape.name = 'cape'; g.add(cape);
  const sword = new THREE.Group(); sword.add(at(B(0.05, 0.6, 0.02, mat(0xc8ccd8, { metalness: 0.9, roughness: 0.2 })), 0, 0.32, 0)); sword.add(at(B(0.2, 0.04, 0.05, dark), 0, 0.02, 0)); sword.add(at(B(0.04, 0.14, 0.04, mat(0x3a2410)), 0, -0.07, 0));
  at(sword, 0.32, 0.5, 0.18, 0.9); sword.name = 'sword'; g.add(sword);
  const sh = at(Cy(0.2, 0.2, 0.05, mat(0x5a4a3a, { metalness: 0.4 }), 12), -0.32, 0.62, 0.12, Math.PI / 2, 0, 0); sh.name = 'shield'; g.add(sh);
  g.add(at(S(0.05, glowMat(2.5, 1.5, 0.5), 0), -0.18, 0.45, 0.2));
  return finish(g, 1);
}

// 敵
export function makeMon(mid, D) {
  const g = new THREE.Group(), c = D.col, body = mat(c, { roughness: 0.6 });
  if (mid === 'slime') { const b = S(0.35, mat(c, { roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 }), 2); b.scale.set(0.42, 0.3, 0.42); b.position.y = 0.3; b.name = 'bob'; g.add(b); eyes(g, 0.4, 0.3, 0.12, 0.05, [2.4, 0.4, 2.4]); }
  else if (mid === 'bat') { g.add(at(S(0.16, body), 0, 0.9, 0)); for (const s of [-1, 1]) { const w = at(B(0.4, 0.02, 0.22, mat(0x2a0a14, { side: THREE.DoubleSide })), s * 0.28, 0.92, 0); w.name = 'wing' + s; g.add(w); g.add(at(Co(0.05, 0.1, body), s * 0.08, 1.06, 0)); } eyes(g, 0.92, 0.13, 0.06, 0.03, [3, 0.3, 0.3]); }
  else if (mid === 'goblin' || mid === 'orc') { const k = mid === 'orc' ? 1.35 : 0.85; g.add(at(Ca(0.2 * k, 0.25 * k, body), 0, 0.5 * k, 0)); g.add(at(S(0.2 * k, body), 0, 0.92 * k, 0.03)); for (const s of [-1, 1]) { g.add(at(Co(0.06 * k, 0.2 * k, body), s * 0.2 * k, 1.0 * k, 0, 0, 0, -s * 1.2)); g.add(at(Ca(0.07 * k, 0.25 * k, body), s * 0.26 * k, 0.55 * k, 0.05)); } eyes(g, 0.95 * k, 0.17 * k, 0.07 * k, 0.03 * k, [2.6, 2, 0.2]); const w = at(mid === 'orc' ? B(0.3, 0.08, 0.04, mat(0x777777, { metalness: 0.8 })) : B(0.05, 0.4, 0.05, mat(0x5a3a1a)), 0.3 * k, 0.75 * k, 0.2, 0.6); g.add(w); if (mid === 'orc') g.add(at(Cy(0.03, 0.03, 0.5, mat(0x3a2410)), 0.3, 0.75, 0.2, 0.6)); }
  else if (mid === 'skeleton' || mid === 'boneking') { const k = mid === 'boneking' ? 2.1 : 1, bone = mat(c, { roughness: 0.8 }); g.add(at(Cy(0.04 * k, 0.04 * k, 0.45 * k, bone), 0, 0.62 * k, 0)); for (let i = 0; i < 4; i++) g.add(at(B(0.3 * k - i * 0.03 * k, 0.03 * k, 0.12 * k, bone), 0, (0.55 + i * 0.09) * k, 0)); g.add(at(S(0.15 * k, bone), 0, 1.02 * k, 0)); eyes(g, 1.03 * k, 0.12 * k, 0.06 * k, 0.03 * k, mid === 'boneking' ? [3, 0.5, 2.6] : [0.4, 2.4, 2.8]); for (const s of [-1, 1]) { g.add(at(Cy(0.03 * k, 0.03 * k, 0.45 * k, bone), s * 0.08 * k, 0.22 * k, 0)); g.add(at(Cy(0.025 * k, 0.025 * k, 0.45 * k, bone), s * 0.2 * k, 0.65 * k, 0.05 * k, 0.3, 0, s * 0.2)); } g.add(at(B(0.05 * k, 0.6 * k, 0.02 * k, mat(0x8a8a90, { metalness: 0.9 })), 0.25 * k, 0.6 * k, 0.25 * k, 0.8)); if (mid === 'boneking') { for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(at(Co(0.04 * k, 0.14 * k, mat(0xd8b040, { metalness: 0.9, roughness: 0.3 })), Math.cos(a) * 0.12 * k, 1.17 * k, Math.sin(a) * 0.12 * k)); } const cape = new THREE.Mesh(geo('cape2', () => { const p = new THREE.PlaneGeometry(0.9, 1.4, 1, 3); p.translate(0, -0.7, 0); return p; }), mat(0x3a0a3a, { side: THREE.DoubleSide, roughness: 0.9 })); at(cape, 0, 1.0 * k, -0.15 * k, 0.15); g.add(cape); } }
  else if (mid === 'spider') { g.add(at(S(0.25, body), 0, 0.3, -0.1)); g.add(at(S(0.15, body), 0, 0.28, 0.18)); for (const s of [-1, 1]) for (let i = 0; i < 4; i++) { const l = at(Cy(0.02, 0.02, 0.45, body), s * 0.25, 0.25, 0.15 - i * 0.12, 0, 0, s * 1.0); l.name = 'leg'; g.add(l); } eyes(g, 0.33, 0.3, 0.05, 0.025, [3, 0.2, 0.2]); g.add(at(S(0.08, mat(0xb02020)), 0, 0.45, -0.15)); }
  else if (mid === 'wolf') { g.add(at(Ca(0.17, 0.5, body), 0, 0.45, 0, Math.PI / 2)); g.add(at(S(0.15, body), 0, 0.6, 0.42)); g.add(at(Co(0.08, 0.2, body), 0, 0.57, 0.6, Math.PI / 2)); for (const s of [-1, 1]) { g.add(at(Co(0.05, 0.12, body), s * 0.08, 0.76, 0.4)); for (const z of [-0.25, 0.25]) g.add(at(Cy(0.04, 0.03, 0.35, body), s * 0.1, 0.18, z)); } g.add(at(Co(0.06, 0.4, body), 0, 0.5, -0.45, -Math.PI / 2 + 0.4)); eyes(g, 0.64, 0.53, 0.06, 0.03, [2.8, 2.2, 0.4]); }
  else if (mid === 'wisp') { const core = S(0.18, glowMat(0.6, 2.4, 3)); core.position.y = 0.7; core.name = 'bob'; g.add(core); g.add(at(S(0.3, new THREE.MeshBasicMaterial({ color: 0x4adfff, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false })), 0, 0.7, 0)); for (let i = 0; i < 3; i++) g.add(at(Co(0.1, 0.3, glowMat(0.3, 1.6, 2.6)), 0, 0.95 + i * 0.05, 0, (i - 1) * 0.3)); }
  else if (mid === 'ghost' || mid === 'wraith') { const m2 = new THREE.MeshStandardMaterial({ color: c, transparent: true, opacity: mid === 'ghost' ? 0.55 : 0.85, roughness: 0.4, emissive: mid === 'ghost' ? 0x203048 : 0x100010, side: THREE.DoubleSide, depthWrite: false }); const robe = Co(0.32, 1.1, m2, 10); robe.position.y = 0.6; robe.rotation.x = Math.PI; robe.name = 'bob'; g.add(robe); g.add(at(S(0.2, m2), 0, 1.15, 0)); eyes(g, 1.15, 0.16, 0.07, 0.035, mid === 'ghost' ? [0.6, 2.4, 3] : [3, 0.2, 0.2]); if (mid === 'wraith') { g.add(at(Cy(0.02, 0.02, 1.4, mat(0x2a1a10)), 0.35, 0.8, 0.1)); g.add(at(B(0.5, 0.06, 0.02, mat(0xb8b8c0, { metalness: 0.9, roughness: 0.2 })), 0.15, 1.45, 0.1, 0, 0, 0.3)); } }
  else if (mid === 'cultist') { const robe = Co(0.3, 1.0, body, 10); robe.position.y = 0.5; g.add(robe); g.add(at(Co(0.18, 0.35, body, 8), 0, 1.15, 0)); g.add(at(S(0.12, mat(0x0a0a0a)), 0, 1.0, 0.05)); eyes(g, 1.02, 0.13, 0.05, 0.025, [3, 0.4, 2]); const orb = S(0.08, glowMat(2.6, 0.4, 2.2)); orb.position.set(0.28, 0.8, 0.2); orb.name = 'bob'; g.add(orb); }
  else if (mid === 'mimic') { const wood = mat(0x7a4a22, { roughness: 0.8 }), iron = mat(0x9a8a60, { metalness: 0.8, roughness: 0.3 }); g.add(at(B(0.6, 0.3, 0.45, wood), 0, 0.15, 0)); const lid = new THREE.Group(); lid.add(at(B(0.6, 0.18, 0.45, wood), 0, 0.09, 0.22)); lid.add(at(B(0.62, 0.04, 0.08, iron), 0, 0.17, 0.22)); for (let i = 0; i < 5; i++) lid.add(at(Co(0.025, 0.08, mat(0xf0f0e0)), -0.22 + i * 0.11, -0.03, 0.42, Math.PI)); at(lid, 0, 0.3, -0.22, -0.5); lid.name = 'lid'; g.add(lid); g.add(at(B(0.62, 0.04, 0.47, iron), 0, 0.12, 0)); eyes(g, 0.36, 0.2, 0.12, 0.035, [3, 2.2, 0.2]); }
  else if (mid === 'gargoyle') { const st = mat(c, { roughness: 0.9 }); g.add(at(Ca(0.25, 0.3, st), 0, 0.65, 0)); g.add(at(S(0.2, st), 0, 1.1, 0.05)); for (const s of [-1, 1]) { g.add(at(Co(0.05, 0.2, st), s * 0.12, 1.3, 0, 0, 0, -s * 0.4)); const w = at(B(0.6, 0.04, 0.35, st), s * 0.45, 0.95, -0.15, 0, 0, s * 0.5); w.name = 'wing' + s; g.add(w); g.add(at(Ca(0.08, 0.3, st), s * 0.3, 0.6, 0.05)); } eyes(g, 1.12, 0.17, 0.07, 0.03, [3, 1.2, 0.2]); }
  else if (mid === 'knight') { const ar = mat(0x24242e, { metalness: 0.85, roughness: 0.3 }); g.add(at(Ca(0.24, 0.4, ar), 0, 0.72, 0)); g.add(at(S(0.19, ar), 0, 1.2, 0)); g.add(at(B(0.3, 0.04, 0.08, glowMat(2.8, 0.2, 0.3)), 0, 1.2, 0.15)); for (const s of [-1, 1]) { g.add(at(S(0.14, ar), s * 0.3, 1.0, 0)); g.add(at(Ca(0.09, 0.35, ar), s * 0.12, 0.25, 0)); } g.add(at(B(0.06, 1.0, 0.03, mat(0x50505a, { metalness: 0.9, roughness: 0.25 })), 0.35, 0.8, 0.25, 0.4)); const cape = new THREE.Mesh(geo('cape3', () => { const p = new THREE.PlaneGeometry(0.6, 1.0); p.translate(0, -0.5, 0); return p; }), mat(0x500a10, { side: THREE.DoubleSide })); at(cape, 0, 1.1, -0.22, 0.1); g.add(cape); }
  else if (mid === 'abyss') { const sk = mat(c, { roughness: 0.5, metalness: 0.3 }), k = 2.4; g.add(at(Ca(0.3 * k, 0.5 * k, sk), 0, 0.8 * k, -0.1 * k, 0.5)); const nk = at(Ca(0.13 * k, 0.4 * k, sk), 0, 1.35 * k, 0.25 * k, 0.7); g.add(nk); g.add(at(S(0.22 * k, sk), 0, 1.6 * k, 0.5 * k)); g.add(at(Co(0.12 * k, 0.3 * k, sk), 0, 1.55 * k, 0.75 * k, Math.PI / 2)); for (const s of [-1, 1]) { g.add(at(Co(0.04 * k, 0.3 * k, mat(0xd8d0c0)), s * 0.12 * k, 1.85 * k, 0.4 * k, -0.5, 0, -s * 0.4)); const w = at(B(1.3 * k, 0.04 * k, 0.6 * k, mat(0x200830, { side: THREE.DoubleSide })), s * 0.75 * k, 1.2 * k, -0.2 * k, 0, 0, s * 0.35); w.name = 'wing' + s; g.add(w); g.add(at(Ca(0.12 * k, 0.3 * k, sk), s * 0.25 * k, 0.3 * k, 0.1 * k)); } eyes(g, 1.65 * k, 0.68 * k, 0.1 * k, 0.04 * k, [3, 0.4, 3]); g.add(at(Co(0.12 * k, 0.9 * k, sk), 0, 0.6 * k, -0.85 * k, -Math.PI / 2 - 0.4)); }
  else { g.add(at(Ca(0.2, 0.3, body), 0, 0.5, 0)); }
  return finish(g, D.boss ? 1 : 1);
}
function finish(g) { g.traverse(o => { if (o.isMesh) { o.castShadow = true; } }); return g; }

// アイテム（床に落ちているときの形）
const POT_COL = { '赤い薬': 0xd02030, '青い薬': 0x2050d0, '緑の薬': 0x30b040, '黄色い薬': 0xe0c020, '紫の薬': 0x8030c0, '黒い薬': 0x202028, '白い薬': 0xe8e8f0, '銀色の薬': 0xb0b8c8, '濁った薬': 0x6a6a40, '光る薬': 0x80ffe0 };
export function makeItem(it, look) {
  const g = new THREE.Group(), k = it.k;
  if (k === 'weapon') { g.add(at(B(0.06, 0.55, 0.02, mat(0xc8ccd8, { metalness: 0.9, roughness: 0.2 })), 0, 0.12, 0, Math.PI / 2, 0, 0.6)); g.add(at(B(0.2, 0.04, 0.05, mat(0x6a5020, { metalness: 0.7 })), -0.1, 0.12, 0.17, Math.PI / 2, 0, 0.6)); }
  else if (k === 'shield') g.add(at(Cy(0.22, 0.22, 0.05, mat(0x6a5a40, { metalness: 0.5, roughness: 0.4 }), 12), 0, 0.06, 0));
  else if (k === 'ring') g.add(at(new THREE.Mesh(geo('ring', () => new THREE.TorusGeometry(0.1, 0.03, 8, 20)), mat(0xe0b040, { metalness: 1, roughness: 0.2 })), 0, 0.12, 0, Math.PI / 2.5));
  else if (k === 'potion') { const col = POT_COL[look] || 0xff00ff; g.add(at(S(0.12, new THREE.MeshStandardMaterial({ color: col, roughness: 0.1, metalness: 0.1, emissive: col, emissiveIntensity: 0.35, transparent: true, opacity: 0.85 }), 2), 0, 0.13, 0)); g.add(at(Cy(0.04, 0.05, 0.12, mat(0xddddee, { roughness: 0.1 })), 0, 0.27, 0)); g.add(at(Cy(0.045, 0.045, 0.04, mat(0x6a4a2a)), 0, 0.34, 0)); }
  else if (k === 'scroll') { g.add(at(Cy(0.07, 0.07, 0.36, mat(0xe8dcc0, { roughness: 0.9 }), 10), 0, 0.08, 0, 0, 0, Math.PI / 2)); g.add(at(Cy(0.075, 0.075, 0.05, mat(0x8a1a1a)), 0, 0.08, 0, 0, 0, Math.PI / 2)); }
  else if (k === 'food') { g.add(at(S(0.16, mat(0x5a3418, { roughness: 0.9 }), 1), 0, 0.1, 0)); g.children[0].scale.set(0.2, 0.11, 0.14); }
  else if (k === 'wand') { g.add(at(Cy(0.02, 0.025, 0.5, mat(0x3a2418)), 0, 0.05, 0, Math.PI / 2, 0, 0.8)); g.add(at(S(0.05, glowMat(1.8, 0.6, 2.6), 1), 0.19, 0.05, 0.16)); }
  else if (k === 'treasure') { const gold = mat(0xffc040, { metalness: 1, roughness: 0.25, emissive: 0x6a4000, emissiveIntensity: 0.6 }); if (it.id === 'gem' || it.id === 'dragoneye') g.add(at(S(0.13, new THREE.MeshStandardMaterial({ color: it.id === 'gem' ? 0x40e0ff : 0xff3020, emissive: it.id === 'gem' ? 0x1080a0 : 0xa01000, emissiveIntensity: 1.2, roughness: 0.05, metalness: 0.3, flatShading: true }), 0), 0, 0.15, 0)); else if (it.id === 'crown') { g.add(at(Cy(0.15, 0.15, 0.1, gold, 12), 0, 0.1, 0)); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; g.add(at(Co(0.04, 0.1, gold, 4), Math.cos(a) * 0.14, 0.2, Math.sin(a) * 0.14)); } } else if (it.id === 'chalice') { g.add(at(Cy(0.11, 0.04, 0.14, gold, 12), 0, 0.22, 0)); g.add(at(Cy(0.02, 0.02, 0.12, gold), 0, 0.09, 0)); g.add(at(Cy(0.08, 0.08, 0.02, gold, 12), 0, 0.02, 0)); } else if (it.id === 'candle') { g.add(at(Cy(0.03, 0.03, 0.28, mat(0xb06a30, { metalness: 0.9, roughness: 0.3 })), 0, 0.14, 0)); g.add(at(Cy(0.09, 0.09, 0.03, mat(0xb06a30, { metalness: 0.9, roughness: 0.3 }), 10), 0, 0.02, 0)); } else for (let i = 0; i < 4; i++) g.add(at(Cy(0.08, 0.08, 0.025, mat(0xd8d8e0, { metalness: 1, roughness: 0.3 }), 14), (i % 2) * 0.05 - 0.02, 0.015 + i * 0.026, (i >> 1) * 0.04)); }
  else if (k === 'throw') { for (let i = 0; i < 3; i++) g.add(at(B(0.03, 0.3, 0.01, mat(0xb8bcc8, { metalness: 0.9, roughness: 0.2 })), (i - 1) * 0.07, 0.04, 0, Math.PI / 2, 0, (i - 1) * 0.3)); }
  return g;
}
export function makeStairs() {
  const g = new THREE.Group(), st = mat(0x2a2630, { roughness: 0.9 });
  for (let i = 0; i < 4; i++) g.add(at(B(0.8, 0.12, 0.2, st), 0, -0.05 - i * 0.12, -0.3 + i * 0.2));
  g.add(at(B(0.86, 0.05, 0.86, new THREE.MeshBasicMaterial({ color: 0x000000 })), 0, -0.55, 0));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.4, 2.4), toneMapped: false, transparent: true, opacity: 0.85, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; ring.name = 'ring'; g.add(ring);
  return g;
}
export function makeTorch() {
  const g = new THREE.Group(); g.add(at(Cy(0.03, 0.05, 0.3, mat(0x3a2a1a)), 0, 0, 0, 0.5)); const f = new THREE.Mesh(geo('flame', () => new THREE.ConeGeometry(0.08, 0.25, 8)), glowMat(3, 1.4, 0.3)); f.position.set(0, 0.2, 0.06); f.name = 'flame'; g.add(f); return g;
}

export function makeExit() {
  const g = new THREE.Group();
  const c = new THREE.Color(0.4, 2.2, 1.4);
  const r1 = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.46, 40), new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })); r1.rotation.x = -Math.PI / 2; r1.position.y = 0.02; r1.name = 'ring'; g.add(r1);
  const r2 = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.22, 6), r1.material); r2.rotation.x = -Math.PI / 2; r2.position.y = 0.025; r2.name = 'hex'; g.add(r2);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.42, 2.2, 24, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.2, 0.8), toneMapped: false, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.y = 1.1; beam.name = 'beam'; g.add(beam);
  return g;
}
