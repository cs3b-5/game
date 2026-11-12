// ウパラン：コースの自動生成（画面とは別。node でも動く）
// 奥（-z）へ走る。レーンは 0・1・2（左・中・右）
// 必ず「1つ前の安全なレーン」から1レーン以内に、通れるレーンを残す

export const LANE_W = 2.3;
export const laneX = l => (l - 1) * LANE_W;

// 障害物の種類：h=高さ、len=奥行き、how=よけ方
export const OBST = {
  low: { h: 0.85, len: 0.6, how: 'jump' },     // 低い柵：ジャンプ
  bar: { h0: 1.15, h: 2.6, len: 0.5, how: 'slide' }, // 頭の高さのバー：スライディング
  block: { h: 2.4, len: 1.6, how: 'lane' },    // 大きな箱：レーンを変える
  train: { h: 3.0, len: 14, how: 'lane' },     // 長い水槽トラック：レーンを変える
};
export const ITEMS = {
  magnet: { n: 'マグネット', t: 10 },   // しずくを吸いよせる
  shield: { n: 'あわバリア', t: 0 },    // 1回だけぶつかっても平気
  double: { n: 'スコア2倍', t: 12 },
  spring: { n: 'スーパージャンプ', t: 8 },
};

export function rngOf(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 速さ（m/秒）：走った距離でだんだん速くなる
export const speedAt = d => Math.min(30, 11 + Math.sqrt(d) * 0.32);

// 生成器：next(z) を呼ぶたびに、z より奥のぶんを返す
// 返す物：{kind:'obst', type, lane, z} / {kind:'coin', lane, z, y} / {kind:'item', type, lane, z}
export function makeGen(seed = 1) {
  const r = rngOf(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  let safe = 1, z = -40, rows = 0;
  const occ = [0, 0, 0]; // レーンごとに、長いトラックがどこ（奥のはし）まであるか
  const out = [];
  function coinLine(lane, z0, n, arc = false) {
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0;
      out.push({ kind: 'coin', lane, z: z0 - i * 2.2, y: arc ? 0.9 + Math.sin(t * Math.PI) * 1.6 : 0.9 });
    }
  }
  // 1列ぶん作る。d は今までの距離（むずかしさ）
  function row(d) {
    const hard = Math.min(1, d / 2500);
    const gap = 13 + (1 - hard) * 9 + r() * 6;    // 列と列のあいだ（m）
    z -= gap; rows++;
    // つぎの安全なレーン：今のレーンから1つ以内で、トラックがもう終わっているレーン
    const cand = [safe - 1, safe, safe, safe + 1].filter(l => l >= 0 && l <= 2 && occ[l] > z + 3);
    const nxt = cand.length ? pick(cand) : safe;
    const lanes = [0, 1, 2];
    // 安全なレーンには、なにもないか、ジャンプかスライディングでよけられる物
    const onSafe = r() < 0.35 + hard * 0.35 ? pick(['low', 'bar']) : null;
    // ほかのレーン
    const others = lanes.filter(l => l !== nxt);
    const blocked = [];
    for (const l of others) {
      const p = r();
      if (p < 0.45 + hard * 0.35) {
        // 長いトラックは、安全なレーンへの移動をじゃましないときだけ
        const t = r() < 0.25 + hard * 0.2 && Math.abs(l - safe) !== 0 ? 'train' : pick(['block', 'block', 'low', 'bar']);
        blocked.push([l, t]);
      }
    }
    // 今のレーン（safe）と次のレーン（nxt）のあいだがふさがっていると移れないので、そこは通れる物にする
    if (Math.abs(nxt - safe) === 1) {
      for (const b of blocked) if (b[0] === safe && (b[1] === 'block' || b[1] === 'train')) b[1] = pick(['low', 'bar']);
    }
    for (const [l, t] of blocked) { out.push({ kind: 'obst', type: t, lane: l, z: z - (t === 'train' ? OBST.train.len / 2 : 0) }); if (t === 'train') occ[l] = Math.min(occ[l], z - OBST.train.len); }
    if (onSafe) out.push({ kind: 'obst', type: onSafe, lane: nxt, z });
    // しずく：安全なレーンに並べる（低い柵の上はアーチ）
    if (r() < 0.75) {
      if (onSafe === 'low') coinLine(nxt, z + 4.4, 5, true);
      else if (onSafe === 'bar') coinLine(nxt, z + 4, 3);
      else coinLine(nxt, z + gap * 0.6, Math.max(3, Math.floor(gap / 2.6)));
    }
    // アイテム：ときどき
    if (r() < 0.07 && !onSafe) out.push({ kind: 'item', type: pick(Object.keys(ITEMS)), lane: nxt, z: z + gap * 0.35 });
    safe = nxt;
    out.push({ kind: 'row', lane: nxt, z, safe: onSafe }); // テストとCPU用（画面には出ない）
  }
  return {
    // zTo より手前まで作る（zTo は負の数。奥ほど小さい）
    fill(zTo, dist) { while (z > zTo) row(dist + (-z)); const o = out.splice(0); return o; },
    get z() { return z; }, get rows() { return rows; },
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
