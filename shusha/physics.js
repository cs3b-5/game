// 出社できない — 物理（画面なし。node からテストもできる）
// planck.js（Box2D）を外から渡す
export const STAGES = [
  { id: 'home', name: '家の前', desc: 'まずは歩くことから。Q/W がふともも、O/P がすね。', len: 12 },
  { id: 'curb', name: '歩道の段差', desc: 'ちょっとした段差が、いちばんこわい。', len: 15, curbs: true },
  { id: 'hill', name: 'だらだら坂', desc: '上り坂のあとには、下り坂がある。', len: 18, hill: true },
  { id: 'ice', name: '凍った道', desc: 'つるっつる。足をひらきすぎると…', len: 14, ice: [4, 10] },
  { id: 'wind', name: '向かい風', desc: '台風が来てるけど会社は休みにならない。', len: 14, wind: 1 },
  { id: 'hurdle', name: '工事中', desc: 'バーをまたいで進め。', len: 18, hurdles: [4, 8, 12, 15.5] },
  { id: 'moon', name: '月面出張', desc: '重力が 1/6。ふわっと飛びすぎ注意。', len: 25, g: 1.62 },
  { id: 'belt', name: '動く歩道（逆走）', desc: 'なぜか全部こっちに向かって動いている。', len: 15, belt: [2, 13, -0.9] },
  { id: 'crowd', name: '満員の改札', desc: '前の人を押しのけて進め（すみません）。', len: 16, crowd: [4, 6.5, 9, 11.5] },
  { id: 'stairs', name: '会社の階段', desc: 'エレベーターは点検中。', len: 11, stairs: [2, 12, 0.08, 0.5] },
  { id: 'banana', name: '社長室の前', desc: 'なぜか床にバナナの皮が。', len: 16, banana: [3, 5.5, 8, 10.5, 13] },
];

// エンドレス出社（コースは毎回ちがう）
export const ENDLESS = { id: 'endless', name: 'エンドレス出社', desc: 'ゴールはない。どこまで行けるか。進むほど出世する。', len: 1e9, endless: true };
export const RANKS = [[0, '新入社員'], [8, '先輩'], [16, '主任'], [26, '係長'], [38, '課長補佐'], [52, '課長'], [70, '次長'], [92, '部長'], [120, '本部長'], [155, '取締役'], [200, '常務'], [260, '専務'], [340, '副社長'], [440, '社長'], [580, '会長'], [760, '伝説の会社員']];
export const rankAt = d => { let r = RANKS[0][1]; for (const [m, n] of RANKS) if (d >= m) r = n; return r; };
function genEndless(seed) {
  let s = seed >>> 0; const R = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pts = [[-20, 0], [0, 0]], zones = [], ice = [], belt = [], banana = [], hurdles = [], crowd = [], stairs = [];
  let x = 0, y = 0; const add = (dx, dy) => { x += dx; y += dy; pts.push([x, y]); };
  add(6, 0);
  const kinds = ['curb', 'hill', 'ice', 'wind', 'hurdle', 'moon', 'belt', 'crowd', 'stairs', 'banana'];
  let last = '';
  while (x < 1600) {
    const d = Math.min(1, x / 220);
    let k; do { k = kinds[R() * kinds.length | 0]; } while (k === last); last = k;
    const x0 = x;
    if (k === 'curb') { for (let i = 0; i < 3; i++) { add(0.1, 0.06); add(2.2 - d * 0.6, 0); add(0.1, -0.06); add(1.6, 0); } }
    else if (k === 'hill') { const h = 0.4 + d * 0.5 + R() * 0.3; add(4, h); add(1.5, 0); add(4, -h); }
    else if (k === 'ice') { const l = 3 + d * 3; ice.push([x, x + l]); add(l, 0); }
    else if (k === 'wind') { const l = 6 + d * 5; zones.push({ kind: 'wind', x1: x, x2: x + l }); add(l, 0); }
    else if (k === 'hurdle') { const n = 1 + (R() * (1 + d * 2) | 0); for (let i = 0; i < n; i++) { add(1.6, 0); hurdles.push(x); add(2.2 - d * 0.5, 0); } }
    else if (k === 'moon') { const l = 8 + d * 6; zones.push({ kind: 'moon', x1: x, x2: x + l }); add(l, 0); }
    else if (k === 'belt') { const l = 4 + d * 5; belt.push([x, x + l, -(0.6 + d * 0.6)]); add(l, 0); }
    else if (k === 'crowd') { const n = 1 + (R() * (1 + d * 2) | 0); for (let i = 0; i < n; i++) { add(2.4, 0); crowd.push(x); } add(2, 0); }
    else if (k === 'stairs') { const n = 6 + (d * 6 | 0), h = 0.08, w = 0.5; stairs.push({ x0: x, n, h, w, y0: y }); add(n * w, n * h); add(2, 0); add(n * w * 1.6, -n * h); }
    else if (k === 'banana') { const n = 2 + (R() * (1 + d * 3) | 0); for (let i = 0; i < n; i++) { add(1.4 + R() * 1.2, 0); banana.push(x); add(0.4, 0); } }
    if (k !== 'stairs' && k !== 'hill') zones.push({ kind: 'theme', x1: x0, x2: x, theme: k });
    else zones.push({ kind: 'theme', x1: x0, x2: x, theme: k });
    add(Math.max(1.8, 5 - d * 3 + R() * 2.5), 0);
  }
  return { pts, zones, ice, belt, banana, hurdles, crowd, stairs, end: x };
}

export const KEYS = ['q', 'w', 'o', 'p'];
export const TUNE = { HIP_SP: 4.2, KNEE_SP: 5.2, HIP_T: 160, KNEE_T: 120, IDLE_T: 6, UP_K: 120, UP_C: 24 };

export function makeWorld(planck, stage) {
  const { World, Vec2, Box, Circle, Edge, Chain, RevoluteJoint } = planck;
  const st = typeof stage === 'number' ? STAGES[stage] : stage;
  const world = new World({ gravity: Vec2(0, -(st.g || 9.8)) });
  const ground = world.createBody();
  const fric = 0.9;
  // 地面の線
  const pts = [Vec2(-20, 0), Vec2(0, 0)];
  const L = st.endless ? 1700 : st.len + 25;
  const EG = st.endless ? genEndless(st.seed || (Math.random() * 1e9) | 0) : null;
  const deco = []; // 描画用（段差・氷・ベルトなど）
  if (st.curbs) { let x = 0, y = 0; while (x < L) { x += 3; pts.push(Vec2(x, y)); y = y > 0 ? 0 : 0.06; x += 0.1; pts.push(Vec2(x, y)); } } // 段差の角は少しななめにして、足がはさまらないように
  else if (st.hill) { pts.push(Vec2(4, 0), Vec2(9.5, 0.75), Vec2(11.5, 0.75), Vec2(16, 0), Vec2(L, 0)); }
  else if (st.stairs) { const [x0, n, h, w] = st.stairs; pts.push(Vec2(x0, 0), Vec2(x0 + n * w, n * h), Vec2(L, n * h)); deco.push({ kind: 'stairs', x0, n, h, w }); } // 当たりはなだらかな坂（見た目は階段）
  else if (EG) { pts.length = 0; for (const [x, y] of EG.pts) pts.push(Vec2(x, y)); pts.push(Vec2(EG.end + 50, pts[pts.length - 1].y)); }
  else pts.push(Vec2(L, 0));
  const gf = ground.createFixture(Chain(pts, false), { friction: fric });
  gf.setUserData({ ground: true });
  const groundPts = pts.map(p => [p.x, p.y]);
  const gy = x => { for (let i = 1; i < groundPts.length; i++) { const [x1, y1] = groundPts[i - 1], [x2, y2] = groundPts[i]; if (x >= x1 && x <= x2) return x2 === x1 ? Math.max(y1, y2) : y1 + (y2 - y1) * (x - x1) / (x2 - x1); } return 0; };
  // 特別な床（すべる・動く）は薄い箱を上に重ねる
  const special = (x1, x2, data) => { const b = world.createBody(); const f = b.createFixture(Box((x2 - x1) / 2, 0.02, Vec2((x1 + x2) / 2, gy((x1 + x2) / 2) + 0.02), 0), { friction: data.fric ?? fric }); f.setUserData(Object.assign({ ground: true }, data)); deco.push(Object.assign({ x1, x2 }, data)); };
  if (st.ice) special(st.ice[0], st.ice[1], { kind: 'ice', fric: 0.04 });
  if (st.belt) special(st.belt[0], st.belt[1], { kind: 'belt', speed: st.belt[2] });
  if (st.banana) for (const x of st.banana) special(x, x + 0.35, { kind: 'banana', fric: 0.0 });
  const zones = EG ? EG.zones : [];
  if (EG) {
    for (const [a, b] of EG.ice) special(a, b, { kind: 'ice', fric: 0.04 });
    for (const [a, b, sp] of EG.belt) special(a, b, { kind: 'belt', speed: sp });
    for (const x of EG.banana) special(x, x + 0.35, { kind: 'banana', fric: 0.0 });
    for (const sd of EG.stairs) deco.push({ kind: 'stairs', x0: sd.x0, n: sd.n, h: sd.h, w: sd.w, y0: sd.y0 });
  }
  const obst = [];
  for (const x of (EG ? EG.hurdles : st.hurdles || [])) { const b = world.createBody(); b.createFixture(Box(0.04, 0.06, Vec2(x, gy(x) + 0.06), 0), { friction: 0.6 }).setUserData({ ground: true, kind: 'bar' }); obst.push({ kind: 'bar', x, h: 0.12, y0: gy(x) }); }
  for (const x of (EG ? EG.crowd : st.crowd || [])) { const b = world.createDynamicBody({ position: Vec2(x, gy(x) + 0.85), fixedRotation: false, angularDamping: 2 }); b.createFixture(Box(0.22, 0.85), { density: 32, friction: 0.04 }).setUserData({ kind: 'person' }); obst.push({ kind: 'person', body: b }); }
  // ゴールの旗（描画用）
  const goalY = st.endless ? 0 : gy(st.len);
  const zoneAt = (x, kind) => zones.find(z => z.kind === kind && x >= z.x1 && x < z.x2);

  // ---- 人（ラグドール） ----
  const GROUP = -1; const parts = {};
  const mk = (name, x, y, shape, dens, ang = 0) => { const b = world.createDynamicBody({ position: Vec2(x, y), angle: ang, angularDamping: 0.6, bullet: /foot|calf/.test(name) }); const f = b.createFixture(shape, { density: dens * 100, friction: 0.8, filterGroupIndex: GROUP }); f.setUserData({ part: name }); parts[name] = b; return b; };
  const x0 = 0, y0 = 0.02;
  mk('torso', x0, y0 + 1.27, Box(0.16, 0.36), 1.1);
  mk('head', x0 + 0.02, y0 + 1.79, Circle(0.13), 0.9);
  for (const s of ['L', 'R']) {
    mk('thigh' + s, x0, y0 + 0.69, Box(0.075, 0.24), 1.3);
    mk('calf' + s, x0, y0 + 0.24, Box(0.06, 0.2), 1.1);
    mk('foot' + s, x0 + 0.07, y0 + 0.04, Box(0.13, 0.04), 1.25);
    mk('uarm' + s, x0, y0 + 1.42, Box(0.05, 0.17), 0.5);
    mk('larm' + s, x0, y0 + 1.1, Box(0.045, 0.16), 0.5);
  }
  const J = {};
  const rev = (name, a, b, anchor, lo, hi, motor) => { const j = world.createJoint(RevoluteJoint({ lowerAngle: lo, upperAngle: hi, enableLimit: true, enableMotor: !!motor, maxMotorTorque: motor || 0, motorSpeed: 0 }, parts[a], parts[b], Vec2(anchor[0], anchor[1]))); J[name] = j; return j; };
  rev('neck', 'torso', 'head', [x0, y0 + 1.63], -0.4, 0.4, 30);
  for (const s of ['L', 'R']) {
    rev('hip' + s, 'torso', 'thigh' + s, [x0, y0 + 0.93], -1.3, 1.5, TUNE.IDLE_T);
    rev('knee' + s, 'thigh' + s, 'calf' + s, [x0, y0 + 0.45], -2.5, 0.05, TUNE.IDLE_T);
    rev('ankle' + s, 'calf' + s, 'foot' + s, [x0, y0 + 0.06], -0.6, 0.6, 40);
    rev('sh' + s, 'torso', 'uarm' + s, [x0, y0 + 1.58], -2.6, 2.6, 6);
    rev('el' + s, 'uarm' + s, 'larm' + s, [x0, y0 + 1.26], 0, 2.4, 3);
  }

  // ---- 接触（転んだ判定・ベルト・氷） ----
  let fallen = null;
  world.on('begin-contact', c => {
    const a = c.getFixtureA().getUserData() || {}, b = c.getFixtureB().getUserData() || {};
    const p = a.part ? a : b.part ? b : null, o = a.part ? b : a;
    if (p && (o.ground || o.kind === 'person') && (p.part === 'head' || (p.part === 'torso' && o.ground))) fallen = fallen || p.part;
  });
  world.on('pre-solve', c => {
    const a = c.getFixtureA().getUserData() || {}, b = c.getFixtureB().getUserData() || {};
    const g = a.kind === 'belt' ? a : b.kind === 'belt' ? b : null;
    if (g) c.setTangentSpeed(a.kind === 'belt' ? -g.speed : g.speed);
  });

  const keys = { q: 0, w: 0, o: 0, p: 0 };
  let t = 0, windT = 0, this_gust = 0, inMoon = false;
  function applyKeys() {
    const hip = keys.q && !keys.w ? 1 : keys.w && !keys.q ? -1 : 0;
    const knee = keys.o && !keys.p ? 1 : keys.p && !keys.o ? -1 : 0;
    // Q：左ももを前・右ももを後ろ ／ W：その逆。O：左ひざを曲げ・右ひざをのばす ／ P：その逆
    for (const [s, sg] of [['L', 1], ['R', -1]]) {
      const h = J['hip' + s], k = J['knee' + s];
      const T = TUNE; if (hip) { h.setMaxMotorTorque(T.HIP_T); h.setMotorSpeed(T.HIP_SP * hip * sg); } else { h.setMaxMotorTorque(T.IDLE_T); h.setMotorSpeed(0); }
      if (knee) { k.setMaxMotorTorque(T.KNEE_T); k.setMotorSpeed(-T.KNEE_SP * knee * sg); } else { k.setMaxMotorTorque(T.IDLE_T); k.setMotorSpeed(0); }
    }
  }
  function step(dt) {
    applyKeys();
    const tx = parts.torso.getPosition().x;
    if (EG) { const mz = !!zoneAt(tx, 'moon'); if (mz !== inMoon) { inMoon = mz; world.setGravity(Vec2(0, mz ? -1.62 : -9.8)); } }
    const windOn = st.wind || (EG && zoneAt(tx, 'wind'));
    this_gust = 0;
    if (windOn) { windT += dt; const ph = windT % 5; const gust = ph > 3.8 ? 1 : 0; this_gust = gust; const f = -(gust ? 38 : 5); parts.torso.applyForceToCenter(Vec2(f, 0), true); parts.head.applyForceToCenter(Vec2(f * 0.3, 0), true); }
    const tb = parts.torso; tb.applyTorque(-TUNE.UP_K * tb.getAngle() - TUNE.UP_C * tb.getAngularVelocity(), true);
    for (const o of obst) if (o.body) { const v = o.body.getLinearVelocity(); if (v.x < 0.3) o.body.applyForceToCenter(Vec2(60, 0), true); }
    world.step(dt, 10, 4); t += dt;
  }
  const dist = () => parts.torso.getPosition().x;
  return { world, parts, joints: J, keys, step, dist, get fallen() { return fallen; }, get gust() { return this_gust; }, get windPhase() { return windT % 5; }, get windOn() { return !!(st.wind || (EG && zoneAt(parts.torso.getPosition().x, 'wind'))); }, get inMoon() { return inMoon; }, zones, zoneAt, get t() { return t; }, st, groundPts, gy, deco, obst, goalY, planck };
}
