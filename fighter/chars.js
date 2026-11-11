// =============================================================
//  嵐拳：キャラのデータ（技のフレームと、人形のポーズ）
//  向きは右向き。座標は足もと＝(0,0)、上がプラス。
//  ポーズ：h=腰の位置 l=上体の前傾（度） hd=頭のかたむき
//          fh/bh=前の手・うしろの手（肩からの位置） ff/bf=前の足・うしろの足（足もとからの位置）
// =============================================================
(function () {
  const FG = window.FG = window.FG || {};
  const BASE = { h: [0, 84], l: 10, hd: 0, fh: [26, 4], bh: [12, 10], ff: [22, 0], bf: [-26, 0] };
  const P = o => Object.assign({}, BASE, o);
  const C = o => Object.assign({}, POSE.crouch, o);
  const A = o => Object.assign({}, POSE.air, o);

  const POSE = FG.POSE = {};
  POSE.stand = P({});
  POSE.crouch = P({ h: [-2, 50], l: 28, fh: [26, 2], bh: [14, 8], ff: [26, 0], bf: [-22, 0] });
  POSE.air = P({ l: 6, fh: [24, 8], bh: [12, 12], ff: [22, 42], bf: [-14, 34] });
  POSE.hit = P({ h: [-8, 82], l: -14, hd: -15, fh: [8, -28], bh: [-6, -30], ff: [18, 0], bf: [-30, 0] });
  POSE.hit2 = P({ h: [-6, 78], l: 30, hd: 10, fh: [10, -26], bh: [0, -28], ff: [20, 0], bf: [-28, 0] });
  POSE.chit = C({ h: [-6, 48], l: 10, hd: -12, fh: [8, -20], bh: [-4, -22] });
  POSE.block = P({ h: [-4, 82], l: 4, fh: [18, 18], bh: [14, 22], ff: [18, 0], bf: [-30, 0] });
  POSE.cblock = C({ h: [-6, 50], l: 18, fh: [20, 14], bh: [16, 18] });
  POSE.launch = P({ h: [0, 60], l: -62, hd: -20, fh: [-10, -20], bh: [-20, -10], ff: [34, 40], bf: [18, 50] });
  POSE.down = P({ h: [0, 12], l: -86, hd: -5, fh: [12, -10], bh: [22, -8], ff: [52, 2], bf: [42, 6] });
  POSE.crumple = P({ h: [4, 58], l: 44, hd: 30, fh: [6, -30], bh: [0, -30], ff: [18, 0], bf: [-14, 0] });
  POSE.splat = P({ h: [-4, 84], l: -10, hd: -25, fh: [-16, 30], bh: [-22, 24], ff: [10, 20], bf: [-16, 10] });
  POSE.dash = P({ h: [8, 80], l: 28, fh: [28, 0], bh: [16, 4], ff: [34, 0], bf: [-34, 8] });
  POSE.bdash = P({ h: [-8, 86], l: -8, fh: [22, 8], bh: [10, 12], ff: [10, 12], bf: [-30, 0] });
  POSE.parry = P({ h: [-4, 80], l: 6, fh: [30, 22], bh: [26, 14], ff: [20, 0], bf: [-30, 0] });
  POSE.rush = P({ h: [10, 76], l: 34, fh: [24, -4], bh: [0, -22], ff: [40, 6], bf: [-40, 12] });
  POSE.grab = P({ h: [6, 82], l: 16, fh: [46, 4], bh: [40, 0], ff: [30, 0], bf: [-26, 0] });
  POSE.toss = P({ h: [10, 84], l: 30, fh: [50, 30], bh: [40, 34], ff: [34, 0], bf: [-30, 0] });
  POSE.win = P({ h: [0, 86], l: 2, hd: 8, fh: [10, 56], bh: [-6, 50], ff: [20, 0], bf: [-20, 0] });
  POSE.wake = P({ h: [-6, 60], l: 30, fh: [20, -20], bh: [10, -24], ff: [20, 0], bf: [-26, 0] });
  POSE.stun = P({ h: [-2, 80], l: 4, hd: 22, fh: [6, -30], bh: [-4, -30], ff: [16, 0], bf: [-18, 0] });
  // ---- 通常技 ----
  Object.assign(POSE, {
    lp0: P({ fh: [18, 8] }), lp1: P({ h: [4, 84], l: 14, fh: [54, 6], ff: [24, 0] }),
    mp0: P({ bh: [0, 8], l: 6 }), mp1: P({ h: [8, 82], l: 20, bh: [58, 6], fh: [14, 10], ff: [30, 0], bf: [-28, 0] }),
    hp0: P({ h: [-4, 84], l: 0, bh: [-6, 6] }), hp1: P({ h: [14, 78], l: 28, bh: [60, 8], fh: [10, -10], ff: [38, 0], bf: [-34, 0] }),
    lk0: P({ ff: [30, 20] }), lk1: P({ h: [-2, 86], l: 0, ff: [64, 46], bf: [-20, 0], fh: [16, 10], bh: [0, 10] }),
    mk0: P({ ff: [20, 40], l: -4 }), mk1: P({ h: [-6, 86], l: -18, ff: [86, 84], bf: [-24, 0], fh: [8, 0], bh: [-8, 4] }),
    hk0: P({ ff: [10, 60], l: -8 }), hk1: P({ h: [-8, 88], l: -28, ff: [66, 140], bf: [-26, 0], fh: [4, -6], bh: [-14, 0] }),
    clp1: C({ fh: [54, 0] }), cmp1: C({ h: [4, 50], l: 32, bh: [58, -2] }),
    chp1: P({ h: [4, 86], l: -4, bh: [16, 58], fh: [14, 6], ff: [24, 0], bf: [-26, 0] }),
    clk1: C({ h: [-4, 48], ff: [66, 4], bf: [-20, 0] }), cmk1: C({ h: [0, 40], l: 34, ff: [84, 4], bf: [-24, 0], fh: [22, -6] }),
    chk1: C({ h: [-6, 34], l: 40, ff: [92, 6], bf: [-12, 0], fh: [8, -30], bh: [-20, -24] }),
    jlp1: A({ fh: [50, -14] }), jmp1: A({ l: 20, bh: [54, -24] }), jhp1: A({ l: 30, bh: [48, -40], fh: [10, -10] }),
    jlk1: A({ ff: [50, 20], bf: [-14, 34] }), jmk1: A({ l: -10, ff: [64, 30] }), jhk1: A({ l: -14, ff: [66, 10], bf: [-10, 40] }),
    // ---- 必殺技 ----
    hado0: P({ h: [-6, 80], l: -4, fh: [-14, -10], bh: [-18, -6], ff: [30, 0], bf: [-30, 0] }),
    hado1: P({ h: [10, 78], l: 14, fh: [56, 4], bh: [50, 8], ff: [40, 0], bf: [-34, 0] }),
    dp0: C({ h: [0, 60], l: 20, bh: [20, -10] }),
    dp1: P({ h: [4, 90], l: -6, bh: [14, 62], fh: [10, -6], ff: [16, 30], bf: [-14, 8] }),
    tatsu: P({ h: [0, 96], l: -6, ff: [86, 96], bf: [-20, 52], fh: [10, 30], bh: [-10, 30] }),
    rkick0: P({ h: [-4, 82], l: -6, ff: [20, 40] }),
    rkick1: P({ h: [6, 88], l: -12, ff: [84, 100], bf: [-20, 42], fh: [6, 20], bh: [-16, 20] }),
    flip0: C({ h: [0, 56], l: 30 }),
    flip1: P({ h: [0, 96], l: -40, ff: [30, 176], bf: [-10, 60], fh: [-10, -20], bh: [-20, -10] }),
    flash: P({ h: [12, 72], l: 40, fh: [10, -20], bh: [-10, -24], ff: [44, 4], bf: [-44, 14] }),
    oh0: P({ h: [0, 90], l: -10, ff: [30, 170], bf: [-20, 0] }), oh1: P({ h: [10, 84], l: 20, ff: [74, 64], bf: [-22, 0] }),
    dive: A({ l: 20, ff: [40, -26], bf: [-10, 22], fh: [0, 10], bh: [-14, 14] }),
    di0: P({ h: [-10, 84], l: -6, bh: [-26, 10], fh: [20, 16], ff: [26, 0], bf: [-32, 0] }),
    di1: P({ h: [18, 78], l: 32, bh: [62, 10], fh: [6, -10], ff: [44, 0], bf: [-42, 0] }),
  });

  // ---- 技のポーズの流れ：0F=構え → 発生の少し前=ため → 発生=当てる形 → 持続のあいだ維持 → 硬直で構えにもどる ----
  function flow(base, w, h, st, act, rec) {
    return [[0, base], [Math.max(1, st - 3), w], [st, h], [st + act, h], [st + act + rec, base]];
  }
  // 技（id → データ）。st=発生 act=持続 rec=硬直 dmg=ダメージ hs/bs=ヒット/ガード硬直 hb=攻撃の当たり判定 [x0,y0,x1,y1]
  // lvl: mid=中段 low=下段 high=上段（立ちガードのみ） str: ヒットストップの強さ 0〜3 cx: キャンセル（chain=弱連打 sp=必殺技）
  function N(o) { return Object.assign({ lvl: 'mid', str: 0, cx: '', pb: 6 }, o); }
  const NORMALS = {
    lp: N({ st: 4, act: 2, rec: 7, dmg: 300, hs: 12, bs: 9, hb: [20, 118, 70, 150], cx: 'chain sp', pb: 4, pose: flow('stand', 'lp0', 'lp1', 4, 2, 7) }),
    mp: N({ st: 6, act: 3, rec: 11, dmg: 600, hs: 17, bs: 14, hb: [24, 112, 74, 146], cx: 'sp', str: 1, pose: flow('stand', 'mp0', 'mp1', 6, 3, 11) }),
    hp: N({ st: 10, act: 4, rec: 18, dmg: 800, hs: 21, bs: 17, hb: [30, 108, 86, 146], cx: 'sp', str: 2, pb: 9, pose: flow('stand', 'hp0', 'hp1', 10, 4, 18) }),
    lk: N({ st: 5, act: 3, rec: 10, dmg: 300, hs: 13, bs: 9, hb: [24, 28, 76, 70], cx: 'chain', pose: flow('stand', 'lk0', 'lk1', 5, 3, 10) }),
    mk: N({ st: 8, act: 3, rec: 16, dmg: 700, hs: 18, bs: 14, hb: [36, 70, 98, 104], cx: 'sp', str: 1, pose: flow('stand', 'mk0', 'mk1', 8, 3, 16) }),
    hk: N({ st: 12, act: 4, rec: 20, dmg: 900, hs: 22, bs: 18, hb: [30, 112, 92, 152], str: 2, pb: 10, pose: flow('stand', 'hk0', 'hk1', 12, 4, 20) }),
    clp: N({ st: 4, act: 2, rec: 7, dmg: 300, hs: 12, bs: 9, hb: [20, 60, 70, 88], cx: 'chain sp', pb: 4, crouch: 1, pose: flow('crouch', 'crouch', 'clp1', 4, 2, 7) }),
    cmp: N({ st: 6, act: 3, rec: 10, dmg: 600, hs: 16, bs: 13, hb: [24, 58, 74, 88], cx: 'sp', str: 1, crouch: 1, pose: flow('crouch', 'crouch', 'cmp1', 6, 3, 10) }),
    chp: N({ st: 7, act: 5, rec: 22, dmg: 900, hs: 22, bs: 18, hb: [6, 100, 50, 196], cx: 'sp', str: 2, crouch: 1, aa: 1, launch: [-2, 11], pose: flow('crouch', 'dp0', 'chp1', 7, 5, 22) }),
    clk: N({ st: 5, act: 2, rec: 9, dmg: 200, hs: 12, bs: 8, hb: [20, 0, 74, 26], lvl: 'low', cx: 'chain sp', pb: 4, crouch: 1, pose: flow('crouch', 'crouch', 'clk1', 5, 2, 9) }),
    cmk: N({ st: 8, act: 3, rec: 17, dmg: 500, hs: 17, bs: 13, hb: [30, 0, 98, 24], lvl: 'low', cx: 'sp', str: 1, crouch: 1, pose: flow('crouch', 'crouch', 'cmk1', 8, 3, 17) }),
    chk: N({ st: 9, act: 3, rec: 26, dmg: 900, hs: 30, bs: 14, hb: [30, 0, 106, 22], lvl: 'low', str: 2, crouch: 1, kd: 1, pose: flow('crouch', 'crouch', 'chk1', 9, 3, 26) }),
    jlp: N({ st: 4, act: 6, rec: 30, dmg: 400, hs: 14, bs: 12, hb: [10, 30, 64, 80], lvl: 'high', air: 1, pose: flow('air', 'air', 'jlp1', 4, 6, 30) }),
    jmp: N({ st: 6, act: 5, rec: 30, dmg: 600, hs: 17, bs: 15, hb: [14, 20, 70, 76], lvl: 'high', str: 1, air: 1, pose: flow('air', 'air', 'jmp1', 6, 5, 30) }),
    jhp: N({ st: 9, act: 5, rec: 30, dmg: 800, hs: 20, bs: 17, hb: [10, 0, 66, 64], lvl: 'high', str: 2, air: 1, pose: flow('air', 'air', 'jhp1', 9, 5, 30) }),
    jlk: N({ st: 5, act: 7, rec: 30, dmg: 400, hs: 14, bs: 12, hb: [10, 0, 66, 46], lvl: 'high', air: 1, pose: flow('air', 'air', 'jlk1', 5, 7, 30) }),
    jmk: N({ st: 7, act: 5, rec: 30, dmg: 600, hs: 17, bs: 15, hb: [16, 4, 82, 50], lvl: 'high', str: 1, air: 1, pose: flow('air', 'air', 'jmk1', 7, 5, 30) }),
    jhk: N({ st: 9, act: 6, rec: 30, dmg: 900, hs: 20, bs: 17, hb: [14, -10, 84, 40], lvl: 'high', str: 2, air: 1, pose: flow('air', 'air', 'jhk1', 9, 6, 30) }),
  };
  // 共通の技（投げ・ドライブインパクト・ドライブリバーサル）
  const COMMON = {
    taunt: { st: 99, act: 0, rec: 0, total: 60, taunt: 1, pose: [[0, 'stand'], [10, 'win'], [48, 'win'], [60, 'stand']] },
    throw: { st: 5, act: 3, rec: 23, throw: 1, pose: [[0, 'stand'], [3, 'grab'], [8, 'grab'], [31, 'stand']] },
    di: { st: 26, act: 2, rec: 35, dmg: 800, hs: 30, bs: 24, hb: [20, 70, 100, 150], str: 3, armor: 2, di: 1, pb: 14,
      pose: [[0, 'stand'], [6, 'di0'], [24, 'di0'], [26, 'di1'], [40, 'di1'], [63, 'stand']] },
    drev: { st: 20, act: 3, rec: 26, dmg: 500, hs: 24, bs: 18, hb: [20, 70, 90, 150], str: 2, inv: [1, 22], pb: 16, kd: 1, launch: [7, 9],
      pose: [[0, 'block'], [16, 'di0'], [20, 'di1'], [30, 'di1'], [49, 'stand']] },
  };

  // ---------- キャラごとの必殺技 ----------
  // in: コマンド（テンキー）  btn: P か K  modern: モダンの方向（n=SPだけ f=→ d=↓ b=← air=空中）
  // v: 強さごとの値 [弱, 中, 強, OD]
  const CH = FG.CHARS = {
    homura: {
      nm: 'ホムラ', en: 'HOMURA', title: '炎の拳士', hp: 10000, walk: [3.4, 2.7], jump: [15.5, 4.2],
      colors: { skin: '#e8b48a', gi: '#c8282c', gi2: '#8a1418', belt: '#1a1a1a', band: '#f4f1ea', hair: '#2a1a14', glove: '#f0e6d8', aura: '#ff7a2a' },
      modern: { n: 'hado', f: 'shoryu', d: 'tatsu', b: 'tatsu' },
      assist: { L: ['clp', 'clp', 'lp', 'tatsu0'], M: ['mp', 'hp', 'hado1'], H: ['hp', 'hado2', 'SA'] },
      sp: {
        hado: { nm: '焔弾', in: [2, 3, 6], btn: 'P', proj: 1,
          v: [{ st: 13, spd: 6 }, { st: 13, spd: 8 }, { st: 13, spd: 10.5 }, { st: 11, spd: 11, hits: 2 }],
          make: (s, v) => ({ st: v.st, act: 1, rec: 31, dmg: 0, pose: [[0, 'stand'], [4, 'hado0'], [v.st - 1, 'hado0'], [v.st + 1, 'hado1'], [v.st + 20, 'hado1'], [v.st + 32, 'stand']],
            spawn: { f: v.st, x: 56, y: 116, vx: v.spd, dmg: s === 3 ? 500 : 600, chip: 150, hs: 20, bs: 16, hits: v.hits || 1, kind: 'fire', w: 26, h: 22, od: s === 3 } }) },
        shoryu: { nm: '昇炎拳', in: [6, 2, 3], btn: 'P',
          v: [{ dmg: 1000, vy: 12, inv: 0 }, { dmg: 1200, vy: 13.5, inv: 5 }, { dmg: 1400, vy: 15, inv: 6 }, { dmg: 1500, vy: 15, inv: 12, hits: 2 }],
          make: (s, v) => ({ st: 4, act: 10, rec: 0, dmg: v.dmg, hs: 30, bs: 20, hb: [0, 90, 52, 200], str: 3, inv: v.inv ? [1, v.inv] : null, invAir: [1, 6], kd: 1, launch: [3, 12], aa: 1,
            win: s === 3 ? [[4, 5, 600], [8, 13, 900]] : null, rise: { f: 4, vx: 2.4, vy: v.vy }, untilLand: 1, land: 14, fx: 'fire',
            pose: [[0, 'dp0'], [3, 'dp0'], [5, 'dp1'], [30, 'dp1'], [44, 'air']] }) },
        tatsu: { nm: '旋風脚', in: [2, 1, 4], btn: 'K',
          v: [{ st: 9, n: 2, vx: 4.5 }, { st: 11, n: 2, vx: 5.5 }, { st: 13, n: 3, vx: 6.5 }, { st: 9, n: 4, vx: 6.5 }],
          make: (s, v) => {
            const win = []; for (let i = 0; i < v.n; i++) win.push([v.st + i * 10, v.st + i * 10 + 3, s === 3 ? 350 : 500]);
            const end = v.st + v.n * 10;
            return { st: v.st, act: v.n * 10, rec: 0, dmg: 500, hs: 24, bs: 14, hb: [-10, 70, 90, 130], str: 1, kd: 1, launch: [4, 8], win,
              rise: { f: 4, vx: v.vx, vy: 5.2, hold: end }, untilLand: 1, land: 12, spin: [v.st, end], lowInv: [4, end],
              pose: [[0, 'stand'], [4, 'air'], [v.st, 'tatsu'], [end, 'tatsu'], [end + 8, 'air']] };
          } },
      },
      sa: [
        { nm: '焔獄波', in: [2, 3, 6, 2, 3, 6], btn: 'P', cost: 1,
          make: () => ({ st: 10, act: 1, rec: 40, dmg: 0, inv: [1, 12], pose: [[0, 'hado0'], [9, 'hado0'], [11, 'hado1'], [50, 'hado1'], [51, 'stand']],
            spawn: { f: 10, x: 340, y: 116, vx: 0, dmg: 400, chip: 120, hs: 30, bs: 20, hits: 5, kind: 'beam', w: 290, h: 46, gap: 5, sa: 1, life: 36 } }) },
        { nm: '昇龍烈火', in: [2, 1, 4, 2, 1, 4], btn: 'P', cost: 2,
          make: () => ({ st: 5, act: 30, rec: 0, dmg: 600, hs: 40, bs: 20, hb: [-6, 80, 60, 220], str: 3, inv: [1, 14], kd: 1, launch: [2, 14], sa: 1, fx: 'fire',
            win: [[5, 6, 600], [10, 11, 600], [15, 16, 600], [20, 21, 600], [26, 28, 600]], rise: { f: 5, vx: 1.6, vy: 16 }, untilLand: 1, land: 20,
            pose: [[0, 'dp0'], [4, 'dp0'], [6, 'dp1'], [40, 'dp1'], [52, 'air']] }) },
        { nm: '炎皇拳', in: [2, 3, 6, 2, 3, 6], btn: 'K', cost: 3,
          make: () => ({ st: 8, act: 14, rec: 30, dmg: 4000, hs: 40, bs: 24, hb: [10, 60, 80, 160], str: 3, inv: [1, 14], cin: 'fire', sa: 1,
            vel: [[8, 22, 13]], pose: [[0, 'hado0'], [7, 'hado0'], [9, 'rush'], [22, 'hp1'], [52, 'stand']] }) },
      ],
    },
    raika: {
      nm: 'ライカ', en: 'RAIKA', title: '雷の蹴り姫', hp: 9600, walk: [3.9, 3.0], jump: [15, 4.6], kickRange: 8, dmgMul: .95,
      colors: { skin: '#f0c49c', gi: '#2a56c8', gi2: '#162a6a', belt: '#ffd23a', band: '#ffd23a', hair: '#f4f1ea', glove: '#1a1a24', aura: '#7fdcff', pony: 1 },
      modern: { n: 'rkick', f: 'flip', d: 'flash', b: 'flash', air: 'dive' },
      assist: { L: ['clp', 'clp', 'lk', 'rkick0'], M: ['mp', 'mk', 'rkick1'], H: ['hp', 'rkick2', 'SA'] },
      sp: {
        rkick: { nm: '迅雷脚', in: [2, 3, 6], btn: 'K',
          v: [{ st: 12, vx: 7, dmg: 800, bs: 16 }, { st: 14, vx: 9, dmg: 900, bs: 15 }, { st: 16, vx: 11, dmg: 1000, bs: 14 }, { st: 12, vx: 11, dmg: 600, hits: 2, bs: 20 }],
          make: (s, v) => ({ st: v.st, act: 6, rec: 18, dmg: v.dmg, hs: 22, bs: v.bs, hb: [20, 70, 100, 120], str: 2, vel: [[4, v.st + 6, v.vx]], kd: s >= 2 ? 1 : 0, launch: [5, 7], fx: 'bolt',
            win: v.hits ? [[v.st, v.st + 2, 600], [v.st + 4, v.st + 6, 600]] : null,
            pose: [[0, 'stand'], [5, 'rkick0'], [v.st, 'rkick1'], [v.st + 6, 'rkick1'], [v.st + 24, 'stand']] }) },
        flip: { nm: '雷翔脚', in: [6, 2, 3], btn: 'K',
          v: [{ dmg: 1100, inv: 0 }, { dmg: 1300, inv: 6 }, { dmg: 1400, inv: 7 }, { dmg: 1600, inv: 12, hits: 2 }],
          make: (s, v) => ({ st: 5, act: 9, rec: 0, dmg: v.dmg, hs: 30, bs: 22, hb: [-4, 80, 60, 210], str: 3, inv: v.inv ? [1, v.inv] : null, invAir: [1, 7], kd: 1, launch: [3, 13], aa: 1, fx: 'bolt',
            win: v.hits ? [[5, 7, 700], [9, 13, 900]] : null, rise: { f: 5, vx: 1.8, vy: 14 }, untilLand: 1, land: 15, flipSpin: [5, 22],
            pose: [[0, 'flip0'], [4, 'flip0'], [6, 'flip1'], [22, 'flip1'], [34, 'air']] }) },
        flash: { nm: '閃歩', in: [2, 1, 4], btn: 'P',
          v: [{ n: 14, vx: 9 }, { n: 16, vx: 11 }, { n: 18, vx: 13 }, { n: 18, vx: 14, od: 1 }],
          make: (s, v) => ({ st: 99, act: 0, rec: 0, dmg: 0, total: v.n + 12, projInv: [1, v.n], vel: [[1, v.n, v.vx]], follow: { from: 5, to: v.n + 4, mv: s === 3 ? 'raiOHod' : 'raiOH' }, fx: 'bolt',
            pose: [[0, 'flash'], [v.n, 'flash'], [v.n + 12, 'stand']] }) },
        dive: { nm: '雷落とし', in: [2], btn: 'K', air: 1,
          v: [{ vx: 7, vy: -11 }, { vx: 8.5, vy: -12 }, { vx: 10, vy: -13 }, { vx: 10, vy: -13, od: 1 }],
          make: (s, v) => ({ st: 6, act: 60, rec: 0, dmg: s === 3 ? 900 : 600, hs: 18, bs: 14, hb: [10, -30, 60, 20], lvl: 'high', str: 1, airMove: 1, untilLand: 1, land: 6, bounce: 1, fx: 'bolt',
            vel: [[6, 99, v.vx, v.vy]], pose: [[0, 'air'], [5, 'dive'], [99, 'dive']] }) },
      },
      extra: {
        raiOH: { st: 14, act: 3, rec: 18, dmg: 800, hs: 18, bs: 14, hb: [20, 30, 84, 120], lvl: 'high', str: 2, fx: 'bolt', pose: [[0, 'flash'], [4, 'oh0'], [13, 'oh0'], [14, 'oh1'], [35, 'stand']] },
        raiOHod: { st: 12, act: 3, rec: 14, dmg: 1000, hs: 24, bs: 16, hb: [20, 30, 84, 120], lvl: 'high', str: 3, kd: 1, launch: [3, 10], fx: 'bolt', pose: [[0, 'flash'], [4, 'oh0'], [11, 'oh0'], [12, 'oh1'], [29, 'stand']] },
      },
      sa: [
        { nm: '雷鳴連脚', in: [2, 3, 6, 2, 3, 6], btn: 'K', cost: 1,
          make: () => ({ st: 7, act: 30, rec: 26, dmg: 360, hs: 40, bs: 18, hb: [10, 40, 100, 150], str: 2, inv: [1, 10], sa: 1, fx: 'bolt', kd: 1, launch: [6, 9],
            win: [[7, 8, 360], [12, 13, 360], [17, 18, 360], [22, 23, 360], [27, 28, 360], [33, 36, 400]], vel: [[6, 34, 7]],
            pose: [[0, 'rkick0'], [6, 'rkick0'], [8, 'mk1'], [13, 'lk1'], [18, 'mk1'], [23, 'lk1'], [28, 'mk1'], [33, 'hk1'], [37, 'hk1'], [63, 'stand']] }) },
        { nm: '天雷', in: [2, 1, 4, 2, 1, 4], btn: 'K', cost: 2,
          make: () => ({ st: 8, act: 24, rec: 30, dmg: 750, hs: 40, bs: 20, hb: [10, 0, 150, 340], str: 3, inv: [1, 14], sa: 1, fx: 'pillar', kd: 1, launch: [2, 14], aa: 1,
            win: [[8, 9, 750], [14, 15, 750], [20, 21, 750], [28, 31, 750]], pose: [[0, 'flip0'], [7, 'flip0'], [9, 'win'], [40, 'win'], [62, 'stand']] }) },
        { nm: '神鳴', in: [2, 3, 6, 2, 3, 6], btn: 'P', cost: 3,
          make: () => ({ st: 9, act: 12, rec: 30, dmg: 4000, hs: 40, bs: 24, hb: [10, 40, 80, 160], str: 3, inv: [1, 14], cin: 'bolt', sa: 1,
            vel: [[9, 21, 14]], pose: [[0, 'flash'], [8, 'flash'], [10, 'rush'], [21, 'lk1'], [51, 'stand']] }) },
      ],
    },
  };

  // ---------- キャラの技表を組み立てる ----------
  for (const id in CH) {
    const c = CH[id], M = c.moves = {};
    for (const k in NORMALS) {
      const m = Object.assign({}, NORMALS[k]);
      if (c.kickRange && /k$/.test(k)) m.hb = [m.hb[0], m.hb[1], m.hb[2] + c.kickRange, m.hb[3]];
      if (c.dmgMul) m.dmg = Math.round(m.dmg * c.dmgMul / 10) * 10;
      M[k] = m;
    }
    Object.assign(M, COMMON, c.extra || {});
    for (const k in c.sp) for (let s = 0; s < 4; s++) M[k + s] = Object.assign({ sp: k, s, nm: c.sp[k].nm + (s === 3 ? '（OD）' : ''), lvl: 'mid', pb: 8, str: 1 }, c.sp[k].make(s, c.sp[k].v[s]));
    c.sa.forEach((sa, i) => { M['sa' + (i + 1)] = Object.assign({ lvl: 'mid', pb: 8, saLv: i + 1, nm: sa.nm }, sa.make()); });
    // 共通：全体フレームと当たりの窓
    for (const k in M) {
      const m = M[k]; m.id = k;
      if (!m.win && m.hb) m.win = [[m.st, m.st + m.act - 1, m.dmg]];
      if (!m.win) m.win = [];
      if (m.total == null) m.total = m.untilLand ? 999 : m.st + m.act + m.rec;
      if (m.cx == null) m.cx = '';
    }
  }
})();
