// =============================================================
//  嵐拳：ゲームのエンジン（60fps・決まった入力から必ず同じ結果になる＝オンラインの巻き戻し用）
//  FG.newGame(opts) → G、FG.step(G, [入力1P, 入力2P])、FG.clone(G)
//  入力はビット：上1 下2 左4 右8 LP16 MP32 HP64 LK128 MK256 HK512 SP1024 DI2048 PARRY4096
//  モダン操作では L=LP M=MP H=HP のビットを使う
// =============================================================
(function () {
  const FG = window.FG = window.FG || {};
  const BT = FG.BT = { U: 1, D: 2, L: 4, R: 8, LP: 16, MP: 32, HP: 64, LK: 128, MK: 256, HK: 512, SP: 1024, DI: 2048, PA: 4096, AU: 8192, TA: 16384 };
  const STAGE = FG.STAGE = { W: 1400, WALL: 40, MAXD: 560, VIEW: 800 };
  const GRAV = .8, HIST = 48, DRIVE_MAX = 60000, SA_MAX = 30000, BAR = 10000;
  const STOP = [7, 9, 11, 13];                                   // ヒットストップ（強さ別）
  const SCALE = [1, 1, .8, .7, .6, .5, .4, .3, .3, .3, .2];       // コンボ補正（何発目か）
  const DRAIN = [500, 1000, 1500, 2500];                         // ガードしたときのドライブ減少
  const HURT = { stand: [-24, 0, 24, 168], crouch: [-26, 0, 26, 108], air: [-22, 0, 22, 130], fall: [-44, 0, 44, 64] };
  const PUSHW = 26;
  const P3 = BT.LP | BT.MP | BT.HP, K3 = BT.LK | BT.MK | BT.HK;

  // ---------------- 準備 ----------------
  function newFighter(i, ch, mode) {
    const C = FG.CHARS[ch];
    return { i, ch, mode: mode || 'classic', x: 0, y: 0, vx: 0, vy: 0, face: i ? -1 : 1, hp: C.hp, maxHp: C.hp, drive: DRIVE_MAX, burn: 0, sa: 0,
      st: 'idle', t: 0, mv: null, mt: 0, hitW: [], conn: 0, hs: 0, push: 0, armor: 0, jug: 0, combo: 0, cdmg: 0, cons: -1, rushB: 0, modSp: 0,
      air: 0, airAtk: 0, reset: 0, diSplat: 0, freeze: 0, parried: 0, ca: 0, lastHit: 0, hist: new Array(HIST).fill(0) };
  }
  FG.newGame = function (o) {
    const G = { f: 0, phase: 'intro', pt: 0, round: 1, wins: [0, 0], timer: 99 * 60, hitstop: 0, freeze: 0, freezeBy: -1, cin: null, grab: null,
      proj: [], ev: [], over: null, opt: Object.assign({ training: false, rounds: 2 }, o.opt || {}),
      p: [newFighter(0, o.chars[0], o.modes[0]), newFighter(1, o.chars[1], o.modes[1])] };
    resetRound(G, true);
    if (G.opt.training) { G.phase = 'fight'; G.timer = 0; }
    return G;
  };
  function resetRound(G, first) {
    G.p.forEach((f, i) => {
      const keep = { sa: first ? (G.opt.training ? SA_MAX : 0) : f.sa, hist: f.hist, cons: f.cons };
      Object.assign(f, newFighter(i, f.ch, f.mode), keep);
      f.x = STAGE.W / 2 + (i ? 140 : -140);
    });
    G.proj = []; G.timer = 99 * 60; G.hitstop = 0; G.freeze = 0; G.cin = null; G.grab = null; G.phase = 'intro'; G.pt = 0;
  }
  FG.clone = G => (typeof structuredClone === 'function' ? structuredClone(G) : JSON.parse(JSON.stringify(G)));

  // ---------------- 入力の読み取り ----------------
  const other = (G, f) => G.p[1 - f.i];
  function numpad(bits, face) {
    let x = ((bits & BT.R) ? 1 : 0) - ((bits & BT.L) ? 1 : 0); if (face < 0) x = -x;
    const y = (bits & BT.U) && !(bits & BT.D) ? 1 : (bits & BT.D) && !(bits & BT.U) ? -1 : 0;
    return 5 + x + 3 * y;
  }
  FG.numpad = numpad;
  const dirNow = f => numpad(f.hist[0], f.face);
  const isDown = d => d <= 3, isBack = d => d === 4 || d === 1 || d === 7;
  // within フレーム以内に新しく押されたボタン（まだ使っていないもの）
  function pressedMask(G, f, within = 3) {
    let m = 0;
    for (let i = 0; i < within; i++) { if (G.f - i <= f.cons) break; m |= f.hist[i] & ~f.hist[i + 1]; }
    return m & ~15;
  }
  // コマンド（テンキーの並び）が win フレーム以内に入っているか
  function motion(f, seq, win) {
    let k = seq.length - 1;
    for (let i = 0; i < win && i < HIST; i++) {
      const d = numpad(f.hist[i], f.face);
      if (d === seq[k]) { k--; if (k < 0) return true; }
    }
    return false;
  }
  // 前（または後ろ）を2回すばやく
  function dashTap(G, f, d) {
    if (G.f <= f.cons) return false;
    const n = i => numpad(f.hist[i], f.face);
    if (n(0) !== d || n(1) === d) return false;
    let i = 1; while (i < 14 && n(i) !== d) i++;
    if (i >= 14) return false;
    let neutral = false; for (let j = 1; j < i; j++) if (n(j) === 5) neutral = true;
    return neutral;
  }
  const strOf = m => (m & (BT.HP | BT.HK)) ? 2 : (m & (BT.MP | BT.MK)) ? 1 : 0;
  const bitCount = m => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };

  // いま入力から出せる技を探す（ctx: ground / air / cancel / rush）
  function readAction(G, f, ctx) {
    const C = FG.CHARS[f.ch], M = C.moves, cur = f.hist[0], pm = pressedMask(G, f, ctx === 'cancel' ? 10 : 3), d = dirNow(f);
    if (!pm) return null;
    const air = ctx === 'air', drive = !f.burn;
    const hasProj = G.proj.some(p => p.o === f.i && !p.sa);
    const can = (id) => !(C.sp[id] && C.sp[id].proj && hasProj);
    const spMove = (id, s) => (s === 3 && (!drive || f.drive < 2 * BAR)) ? null : (can(id) ? id + s : null);
    if (f.mode === 'modern') {
      if (pm & BT.SP || (cur & BT.SP && pm & (BT.HP | BT.MP))) {
        if (cur & BT.HP && !air) {           // SP+H：スーパーアーツ
          const lv = d === 6 ? 2 : isDown(d) ? 3 : 1;
          for (let l = lv; l >= 1; l--) if (f.sa >= l * BAR && (ctx !== 'cancel' || f.mv.sp || l >= 2 || f.mv.cx.includes('sp'))) return { id: 'sa' + l, mod: 1 };
        }
        const dk = air ? 'air' : d === 6 ? 'f' : isDown(d) ? 'd' : d === 4 ? 'b' : 'n';
        const id = C.modern[dk]; if (!id || !C.sp[id] || !!C.sp[id].air !== air) return null;
        const s = (cur & BT.MP) ? 3 : 1, mv = spMove(id, s) || spMove(id, 1);
        return mv ? { id: mv, mod: 1 } : null;
      }
      if (air) {
        if (ctx !== 'air') return null;
        const b = pm & BT.HP ? 'jhk' : pm & BT.MP ? 'jmk' : pm & BT.LP ? 'jlp' : null;
        return b ? { id: b } : null;
      }
      if ((pm & (BT.LP | BT.MP)) && (cur & BT.LP) && (cur & BT.MP)) return { id: 'throw' };
      if (pm & BT.DI) return drive && f.drive >= BAR ? { id: 'di' } : null;
      if (pm & BT.PA) return drive ? { id: 'parry' } : null;
      if (ctx === 'cancel') return null;
      if ((pm & BT.TA) && ctx === 'ground') return { id: 'taunt' };
      // アシストコンボ（AUTO＋弱・中・強）
      if (cur & BT.AU) {
        const ab = pm & BT.HP ? 'H' : pm & BT.MP ? 'M' : pm & BT.LP ? 'L' : null;
        if (ab) return { id: C.assist[ab][0], ast: { b: ab, i: 0 } };
      }
      const c = isDown(d), b = pm & BT.HP ? 'H' : pm & BT.MP ? 'M' : pm & BT.LP ? 'L' : null;
      if (!b) return null;
      return { id: c ? { L: 'clk', M: 'cmk', H: 'chp' }[b] : { L: 'lp', M: 'mk', H: 'hp' }[b] };
    }
    // ---- クラシック ----
    if (!air) for (let i = C.sa.length - 1; i >= 0; i--) {
      const sa = C.sa[i], bm = sa.btn === 'P' ? P3 : K3;
      if ((pm & bm) && f.sa >= sa.cost * BAR && motion(f, sa.in, 40)) return { id: 'sa' + (i + 1) };
    }
    const order = Object.keys(C.sp).sort((a, b) => (C.sp[a].in[0] === 6 ? -1 : 0) - (C.sp[b].in[0] === 6 ? -1 : 0) || C.sp[b].in.length - C.sp[a].in.length);
    for (const id of order) {
      const sp = C.sp[id]; if (!!sp.air !== air) continue;
      const bm = sp.btn === 'P' ? P3 : K3, got = pm & bm; if (!got) continue;
      const ok = sp.in.length === 1 ? isDown(d) : motion(f, sp.in, 15);
      if (!ok) continue;
      const od = bitCount(cur & bm) >= 2;
      const mv = spMove(id, od ? 3 : strOf(got)) || (od ? spMove(id, 2) : null);
      if (mv) return { id: mv };
    }
    if (air) {
      if (ctx !== 'air') return null;
      const b = pm & BT.HK ? 'jhk' : pm & BT.HP ? 'jhp' : pm & BT.MK ? 'jmk' : pm & BT.MP ? 'jmp' : pm & BT.LK ? 'jlk' : pm & BT.LP ? 'jlp' : null;
      return b ? { id: b } : null;
    }
    const both = (a, b) => ((cur | pm) & a) && ((cur | pm) & b) && (pm & (a | b));
    if (both(BT.LP, BT.LK)) return { id: 'throw' };
    if (both(BT.HP, BT.HK) || (pm & BT.DI)) return drive && f.drive >= BAR ? { id: 'di' } : null;
    if (both(BT.MP, BT.MK) || (pm & BT.PA)) return drive ? { id: 'parry' } : null;
    if (ctx === 'cancel') return null;
    if ((pm & BT.TA) && ctx === 'ground') return { id: 'taunt' };
    const b = pm & BT.HK ? 'hk' : pm & BT.HP ? 'hp' : pm & BT.MK ? 'mk' : pm & BT.MP ? 'mp' : pm & BT.LK ? 'lk' : pm & BT.LP ? 'lp' : null;
    if (!b) return null;
    if ((d === 6 || d === 3) && M[d + b] && C.cmd && C.cmd[d + b]) return { id: d + b };   // 特殊技
    return { id: isDown(d) ? 'c' + b : b };
  }

  // ---------------- 状態の切りかえ ----------------
  function setSt(f, st) { f.st = st; f.t = 0; }
  function startMove(G, f, id, extra) {
    const C = FG.CHARS[f.ch], m = C.moves[id]; if (!m) return false;
    if (id === 'parry') { f.drive -= 5000; setSt(f, 'parry'); f.parried = 0; f.mv = null; f.cons = G.f; G.ev.push({ k: 'parryOn', i: f.i }); return true; }
    if (m.sp && m.s === 3) { f.drive -= 2 * BAR; if (f.drive <= 0) burnout(G, f); }
    if (id === 'di') { f.drive -= BAR; if (f.drive <= 0) burnout(G, f); G.ev.push({ k: 'di', i: f.i }); }
    if (id === 'drev') { f.drive -= 2 * BAR; if (f.drive <= 0) burnout(G, f); }
    if (m.saLv) {
      f.sa -= m.saLv * BAR; G.freeze = 46; G.freezeBy = f.i;
      f.ca = m.saLv === 3 && f.hp <= f.maxHp * .25 ? 1 : 0;
      G.ev.push({ k: 'super', i: f.i, lv: m.saLv, nm: f.ca ? 'クリティカルアーツ ' + m.nm : m.nm });
    }
    f.rushB = f.st === 'rush' ? 1 : 0;
    setSt(f, 'move'); f.mv = id; f.mt = 0; f.hitW = []; f.conn = 0; f.buf = null; f.armor = m.armor || 0; f.modSp = extra && extra.mod ? 1 : 0; f.ast = extra && extra.ast ? extra.ast : null;
    if (!m.air && !m.airMove && !f.air) f.vx = 0;
    if (m.air || m.airMove) f.airAtk = 1;
    f.cons = G.f;
    if (m.str >= 1 && !m.saLv) G.ev.push({ k: 'whoosh', i: f.i, str: m.str });
    return true;
  }
  function burnout(G, f) { if (f.burn) return; f.drive = 0; f.burn = 1; G.ev.push({ k: 'burnout', i: f.i }); }
  const mvOf = f => f.mv ? FG.CHARS[f.ch].moves[f.mv] : null;
  const crouching = f => f.st === 'crouch' || f.st === 'cblock' || f.st === 'chit' || (f.st === 'move' && mvOf(f) && mvOf(f).crouch);
  const actionable = f => f.st === 'idle' || f.st === 'walkF' || f.st === 'walkB' || f.st === 'crouch';
  FG.actionable = actionable;

  // ---------------- 当たり判定 ----------------
  function box(f, b, dy = 0) {
    const x0 = f.face > 0 ? f.x + b[0] : f.x - b[2], x1 = f.face > 0 ? f.x + b[2] : f.x - b[0];
    return [x0, f.y + b[1] + dy, x1, f.y + b[3] + dy];
  }
  const hitOverlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  function hurtBoxes(f) {
    if (f.st === 'down' || f.st === 'wake' || f.st === 'cin' || f.st === 'thrown') return [];
    if (f.st === 'fall') return [box(f, HURT.fall)];
    const out = [box(f, f.air ? HURT.air : crouching(f) ? HURT.crouch : HURT.stand)];
    const m = mvOf(f);
    if (f.st === 'move' && m && m.hb && f.mt >= m.st) { const b = m.hb; out.push(box(f, [b[0] - 4, b[1] + 6, b[2] - 12, b[3] - 6])); }
    return out;
  }
  FG.hurtBoxes = hurtBoxes;
  function activeWin(f) {
    const m = mvOf(f); if (f.st !== 'move' || !m || !m.hb) return -1;
    for (let i = 0; i < m.win.length; i++) { const w = m.win[i]; if (f.mt >= w[0] && f.mt <= w[1] && !f.hitW[i]) return i; }
    return -1;
  }
  FG.hitBoxes = f => { const m = mvOf(f); if (f.st !== 'move' || !m || !m.hb) return []; return m.win.some(w => f.mt >= w[0] && f.mt <= w[1]) ? [box(f, m.hb)] : []; };
  function inRange(r, t) { return r && t >= r[0] && t <= r[1]; }
  // V は A の攻撃 m を受けない？
  function invuln(V, A, m, proj) {
    if (['down', 'wake', 'cin', 'thrown', 'ko'].includes(V.st)) return true;
    if (V.st === 'fall' && V.jug >= 4 && !(m && m.saLv)) return true;
    const vm = mvOf(V);
    if (V.st === 'move' && vm) {
      if (inRange(vm.inv, V.mt)) return true;
      if (!proj && A && A.air && inRange(vm.invAir, V.mt)) return true;
      if (proj && inRange(vm.projInv, V.mt)) return true;
      if (m && m.lvl === 'low' && inRange(vm.lowInv, V.mt)) return true;
    }
    return false;
  }

  // ---------------- 当たったときの処理 ----------------
  function canBlock(V, fromX, lvl) {
    if (V.air || V.y > 0) return false;
    if (!(actionable(V) || V.st === 'block' || V.st === 'cblock')) return false;
    const away = fromX > V.x ? BT.L : fromX < V.x ? BT.R : (V.face > 0 ? BT.L : BT.R);
    const cur = V.hist[0];
    if (!(cur & away) || (cur & BT.U)) return false;
    const low = !!(cur & BT.D);
    if (lvl === 'low' && !low) return false;
    if (lvl === 'high' && low) return false;
    return true;
  }
  function resolveHit(G, A, V, m, opt) {
    const proj = opt.proj, fromX = proj && proj.vx ? proj.x - proj.vx : A.x, away = V.x > fromX ? 1 : V.x < fromX ? -1 : -V.face;
    const atWall = x => x <= STAGE.WALL + 2 || x >= STAGE.W - STAGE.WALL - 2;
    const hx = proj ? (proj.vx ? proj.x : V.x - (V.x - A.x) * .3) : (V.x + A.x) / 2, hy = proj ? proj.y : V.y + (m.hb ? (m.hb[1] + m.hb[3]) / 2 : 110);
    // パリィ
    if (V.st === 'parry') {
      const perfect = V.t <= 2 && !proj;
      V.drive = Math.min(DRIVE_MAX, V.drive + (perfect ? 10000 : 2500)); V.parried = 1;
      G.hitstop = perfect ? 14 : 8;
      if (perfect) A.freeze = 30;
      if (!proj) { A.push = -away * 3; }
      G.ev.push({ k: 'parry', i: V.i, x: hx, y: hy, perfect });
      return 'parry';
    }
    // アーマー（ドライブインパクト）
    const vm = mvOf(V);
    if (V.st === 'move' && vm && vm.armor && V.armor > 0 && V.mt < vm.st + vm.act && !m.di && !m.saLv) {
      V.armor--; const d = Math.round((m.dmg || 0) * .5); V.hp = Math.max(1, V.hp - d);
      G.hitstop = 10; G.ev.push({ k: 'armor', i: V.i, x: hx, y: hy });
      return 'armor';
    }
    const mod = A.modSp ? .8 : 1, caMul = A.ca && m.saLv === 3 ? 1.1 : 1;
    const base = (opt.dmg != null ? opt.dmg : m.dmg) * mod * caMul;
    // ガード
    if (canBlock(V, fromX, m.lvl || 'mid')) {
      const sp = m.sp || m.saLv || proj;
      let chip = sp ? (m.chip != null ? m.chip : Math.round(base * .2)) : V.burn ? Math.round(base * .25) : 0;
      if (chip) V.hp = Math.max(m.saLv || V.burn ? 0 : 1, V.hp - chip);
      setSt(V, (V.hist[0] & BT.D) ? 'cblock' : 'block'); V.mv = null; V.hs = (m.bs || 14) + (A.rushB ? 2 : 0) + (V.burn ? 4 : 0);
      if (!V.burn) { V.drive -= m.di ? 5000 : DRAIN[m.str || 0]; if (V.drive <= 0) burnout(G, V); }
      V.push = away * (m.pb || 6) * .9;
      if (atWall(V.x) && !proj) A.push = -away * (m.pb || 6) * .8;
      if (!m.saLv && !(m.sp && m.s === 3)) A.sa = Math.min(SA_MAX, A.sa + base * .5);
      if (m.di && atWall(V.x + away * 30)) { if (V.burn) { setSt(V, 'stun'); V.hs = 110; G.ev.push({ k: 'stun', i: V.i }); } else { setSt(V, 'splat'); V.vx = 0; V.y = Math.max(V.y, 30); V.air = 1; } }
      G.hitstop = Math.max(5, STOP[m.str || 0] - 2);
      G.ev.push({ k: 'block', i: V.i, x: hx, y: hy, str: m.str || 0, chip });
      if (V.hp <= 0) ko(G, V, away);
      return 'block';
    }
    // ヒット
    let ct = null;
    if (V.st === 'move' && vm) ct = V.mt < vm.st + vm.act ? 'counter' : 'punish';
    else if (V.st === 'land' || V.st === 'parryEnd' || V.st === 'rec' || (V.st === 'bdash' && V.t > 8)) ct = 'punish';
    if (V.st === 'fall' || V.st === 'splat' || V.st === 'crumple' || V.st === 'stun') ct = null;
    let sc = SCALE[Math.min(V.combo, SCALE.length - 1)];
    if (m.saLv) sc = Math.max(sc, .5);
    const dmg = Math.max(1, Math.round(base * sc * (ct ? 1.2 : 1) / 10) * 10);
    V.hp -= dmg; V.combo++; V.cdmg += dmg; V.lastHit = G.f;
    if (!m.saLv && !(m.sp && m.s === 3)) { A.sa = Math.min(SA_MAX, A.sa + dmg); if (!A.burn) A.drive = Math.min(DRIVE_MAX, A.drive + dmg * .5); }
    V.sa = Math.min(SA_MAX, V.sa + dmg * .3);
    if (ct === 'punish' && !V.burn) { V.drive -= m.di ? 2 * BAR : 2000; if (V.drive <= 0) burnout(G, V); }
    const hsN = (m.hs || 15) + (ct === 'counter' ? 2 : ct === 'punish' ? 4 : 0) + (A.rushB ? 4 : 0);
    V.mv = null;
    const wasAir = V.air || V.y > 0, prevSt = V.st;
    if (m.cin && !proj) {
      G.cin = { a: A.i, v: V.i, t: 0, kind: m.cin, dmg: dmg, ca: A.ca };
      V.hp += dmg; V.combo--; V.cdmg -= dmg;   // ダメージは演出の中で入れる
      setSt(V, 'cin'); setSt(A, 'cin'); V.vx = V.vy = A.vx = A.vy = 0;
      G.ev.push({ k: 'hit', i: V.i, x: hx, y: hy, str: 3, ct, dmg: 0 });
      return 'hit';
    }
    if (m.di && !wasAir) {
      if (ct === 'punish') { setSt(V, 'crumple'); V.hs = 70; }
      else { setSt(V, 'fall'); V.air = 1; V.y = Math.max(V.y, 1); V.vx = away * 9; V.vy = 8; V.diSplat = 1; V.jug = 0; V.reset = 0; }
    } else if (wasAir || m.kd || (m.launch && wasAir)) {
      const juggle = prevSt === 'fall' || prevSt === 'splat';
      setSt(V, 'fall'); V.air = 1; V.y = Math.max(V.y, 1);
      const L = m.launch || (m.kd ? [3, 5] : juggle ? [2.2, 5] : [2.6, 6]);
      V.vx = away * L[0]; V.vy = L[1]; V.jug++;
      V.reset = !m.kd && !m.launch && !juggle ? 1 : 0;
      if (prevSt === 'splat') V.diSplat = 0;
    } else {
      setSt(V, crouching(V) || (V.hist[0] & BT.D) ? 'chit' : 'hit'); V.hs = hsN;
      V.push = away * (m.pb || 6);
      if (atWall(V.x) && !proj) A.push = -away * (m.pb || 6) * .9;
    }
    G.hitstop = STOP[m.str || 0] + (ct ? 2 : 0);
    G.ev.push({ k: 'hit', i: V.i, x: hx, y: hy, str: m.str || 0, ct, dmg, combo: V.combo, fx: m.fx || (proj ? proj.kind : '') });
    if (V.hp <= 0) ko(G, V, away);
    return 'hit';
  }
  function ko(G, V, away) {
    V.hp = 0; setSt(V, 'fall'); V.air = 1; V.y = Math.max(V.y, 1); V.vx = away * 4.5; V.vy = 12; V.reset = 0; V.jug = 99;
    if (G.opt.training) { V.hp = 1; return; }
    if (G.phase === 'fight') { G.phase = 'ko'; G.pt = 0; G.hitstop = 40; G.ev.push({ k: 'ko', i: V.i }); }
  }

  // ---------------- 1人ぶんの更新 ----------------
  function updFighter(G, f) {
    const o = other(G, f), C = FG.CHARS[f.ch], d = dirNow(f), ctl = G.phase === 'fight' || G.opt.training;
    if (f.freeze > 0) { f.freeze--; return; }
    f.t++;
    // ドライブの回復
    if (f.burn) { f.drive += 50; if (f.drive >= DRIVE_MAX) { f.drive = DRIVE_MAX; f.burn = 0; } }
    else if (actionable(f)) f.drive = Math.min(DRIVE_MAX, f.drive + (f.st === 'walkF' ? 40 : 25));
    switch (f.st) {
      case 'hit': case 'chit': case 'block': case 'cblock': case 'rec': case 'crumple': case 'stun': {
        if (f.st === 'block' || f.st === 'cblock') {
          f.st = (f.hist[0] & BT.D) ? 'cblock' : 'block';
          // ドライブリバーサル（ガード中に 前＋ドライブインパクト）
          if (ctl && d === 6 && !f.burn && f.drive >= 2 * BAR && f.t > 2) {
            const pm = pressedMask(G, f);
            if ((pm & BT.DI) || ((f.hist[0] & BT.HP) && (f.hist[0] & BT.HK) && (pm & (BT.HP | BT.HK)))) { startMove(G, f, 'drev'); break; }
          }
        }
        if (--f.hs <= 0) { setSt(f, 'idle'); f.combo = 0; f.cdmg = 0; f.jug = 0; }
        break;
      }
      case 'splat':
        f.vx = 0; f.vy = 0;
        if (f.t >= 30) { setSt(f, 'fall'); f.diSplat = 0; f.vy = 0; f.vx = -f.face * 1; }
        break;
      case 'fall': case 'air': {
        f.x += f.vx; f.y += f.vy; f.vy -= GRAV;
        if (f.st === 'air' && ctl && !f.airAtk) {
          const a = readAction(G, f, 'air'); if (a) { startMove(G, f, a.id, a); break; }
        }
        if (f.y <= 0) {
          f.y = 0; f.air = 0; f.vy = 0;
          if (f.st === 'air') { setSt(f, 'land'); f.hs = 3; f.vx = 0; }
          else if (f.reset && f.hp > 0) { setSt(f, 'land'); f.hs = 6; f.vx = 0; f.combo = 0; f.cdmg = 0; f.jug = 0; f.reset = 0; }
          else { setSt(f, 'down'); f.vx *= .3; G.ev.push({ k: 'land', i: f.i, x: f.x, heavy: 1 }); }
        }
        break;
      }
      case 'down':
        f.vx *= .8; f.x += f.vx;
        if (f.hp <= 0 && !G.opt.training) break;
        if (f.t >= 36) setSt(f, 'wake');
        break;
      case 'wake':
        if (f.t >= 18) { setSt(f, 'idle'); f.combo = 0; f.cdmg = 0; f.jug = 0; f.diSplat = 0; }
        break;
      case 'land':
        if (--f.hs <= 0) setSt(f, 'idle');
        break;
      case 'jsq':
        if (f.t >= 4) {
          setSt(f, 'air'); f.air = 1; f.airAtk = 0; f.vy = C.jump[0]; f.y = 1;
          f.vx = f.jdir * C.jump[1] * f.face;
        }
        break;
      case 'dash': {
        f.vx = f.face * (f.t < 12 ? 7.5 : f.t < 18 ? 3 : 0); f.x += f.vx;
        if (f.t >= 19) setSt(f, 'idle');
        break;
      }
      case 'bdash': {
        f.vx = -f.face * (f.t < 14 ? 7 : f.t < 20 ? 2.5 : 0); f.x += f.vx;
        if (f.t >= 23) setSt(f, 'idle');
        break;
      }
      case 'parry': {
        const held = (f.hist[0] & BT.PA) || ((f.hist[0] & BT.MP) && (f.hist[0] & BT.MK) && f.mode === 'classic');
        if (!f.burn) f.drive -= 60;
        if (f.drive <= 0) { burnout(G, f); setSt(f, 'parryEnd'); f.hs = 11; break; }
        // ドライブラッシュ（パリィ中に前）
        if (ctl && f.t >= 1 && (f.hist[0] & (f.face > 0 ? BT.R : BT.L)) && !(f.hist[1] & (f.face > 0 ? BT.R : BT.L)) && f.drive >= 5000) {
          f.drive -= 5000; setSt(f, 'rush'); G.ev.push({ k: 'rush', i: f.i }); f.cons = G.f; break;
        }
        if (!held && f.t >= 4) { if (f.parried) setSt(f, 'idle'); else { setSt(f, 'parryEnd'); f.hs = 11; } }
        break;
      }
      case 'parryEnd':
        if (--f.hs <= 0) setSt(f, 'idle');
        break;
      case 'rush': {
        f.vx = f.face * (f.t < 14 ? 10 : 4); f.x += f.vx;
        if (ctl && f.t >= 3) { const a = readAction(G, f, 'rush'); if (a && a.id !== 'parry') { startMove(G, f, a.id, a); break; } }
        if (f.t >= 20) setSt(f, 'idle');
        break;
      }
      case 'throwing': case 'thrown': case 'cin': case 'ko':
        break;
      case 'tech':
        f.x += f.push; f.push *= .82;
        if (f.t >= 16) setSt(f, 'idle');
        break;
      case 'move': updMove(G, f, d, ctl); break;
    }
    // 行動の受付
    if (actionable(f) && ctl && f.hp > 0) neutral(G, f, d);
  }
  function neutral(G, f, d) {
    const C = FG.CHARS[f.ch];
    const a = readAction(G, f, 'ground');
    if (a) { if (startMove(G, f, a.id, a)) return; }
    if (dashTap(G, f, 6)) { setSt(f, 'dash'); f.cons = G.f; return; }
    if (dashTap(G, f, 4)) { setSt(f, 'bdash'); f.cons = G.f; return; }
    if (d >= 7) { setSt(f, 'jsq'); f.jdir = d === 9 ? 1 : d === 7 ? -1 : 0; f.vx = 0; return; }
    if (d <= 3) { if (f.st !== 'crouch') setSt(f, 'crouch'); f.vx = 0; return; }
    if (d === 6) { if (f.st !== 'walkF') setSt(f, 'walkF'); f.vx = f.face * C.walk[0]; f.x += f.vx; return; }
    if (d === 4) {
      // 相手が攻撃中で近いときはガードの構え（下がらない）
      const o = other(G, f), om = mvOf(o);
      const guard = (o.st === 'move' && om && (om.hb || om.spawn) && Math.abs(o.x - f.x) < 260) || G.proj.some(p => p.o !== f.i && Math.abs(p.x - f.x) < 220);
      if (guard) { if (f.st !== 'walkB') setSt(f, 'walkB'); f.guard = 1; f.vx = 0; return; }
      f.guard = 0; if (f.st !== 'walkB') setSt(f, 'walkB'); f.vx = -f.face * C.walk[1]; f.x += f.vx; return;
    }
    if (f.st !== 'idle') setSt(f, 'idle'); f.vx = 0;
  }
  function updMove(G, f, d, ctl) {
    const C = FG.CHARS[f.ch], m = mvOf(f), o = other(G, f);
    f.mt++;
    // 動き
    if (m.vel) { let set = false; for (const v of m.vel) if (f.mt >= v[0] && f.mt <= v[1]) { f.vx = v[2] * f.face; if (v[3] != null) f.vy = v[3]; set = true; } if (!set && !f.air) f.vx = 0; }
    if (m.rise && f.mt === m.rise.f) { f.air = 1; f.y = Math.max(f.y, 1); f.vy = m.rise.vy; f.vx = m.rise.vx * f.face; }
    if (f.air || f.y > 0) {
      f.x += f.vx; f.y += f.vy; f.vy -= GRAV;
      if (m.rise && m.rise.hold && f.mt < m.rise.hold && f.vy < 0) f.vy = 0;
      if (m.vel && m.airMove) { for (const v of m.vel) if (f.mt >= v[0] && f.mt <= v[1] && v[3] != null) f.vy = v[3]; }
      if (f.y <= 0) {
        f.y = 0; f.air = 0; f.vy = 0; f.vx = 0;
        if (m.untilLand) { setSt(f, 'land'); f.hs = m.land || 4; f.mv = null; return; }
        if (m.air) { setSt(f, 'land'); f.hs = 3; f.mv = null; return; }
      }
    } else f.x += f.vx;
    // 飛び道具
    if (m.spawn && f.mt === m.spawn.f) {
      const s = m.spawn;
      G.proj.push({ o: f.i, x: f.x + f.face * s.x, y: s.y, vx: f.face * s.vx, w: s.w, h: s.h, dmg: s.dmg * (f.modSp ? .8 : 1), chip: s.chip, hs: s.hs, bs: s.bs,
        hits: s.hits, kind: s.kind, gap: s.gap || 0, cd: 0, sa: s.sa || 0, od: s.od ? 1 : 0, str: s.sa ? 2 : 1, t: 0, ca: f.ca, life: s.life || 240 });
      G.ev.push({ k: 'proj', i: f.i, kind: s.kind });
    }
    // 派生（ライカの閃歩→雷槌）
    if (m.follow && ctl && f.mt >= m.follow.from && f.mt <= m.follow.to && (pressedMask(G, f) & (P3 | BT.SP))) { startMove(G, f, m.follow.mv); return; }
    // キャンセル
    const lastWin = m.win.length ? m.win[m.win.length - 1][1] : m.st + m.act;
    // ターゲットコンボ（当たるかガードされたら、決まったボタンで次の技へ）
    if (ctl && f.conn && C.tc && !f.air && f.mode === 'classic' && f.mt <= lastWin + 12) {
      const pm = pressedMask(G, f, 10);
      for (const t of C.tc) if (t.from === f.mv && (pm & BT[t.btn])) { startMove(G, f, t.to); return; }
    }
    // アシストコンボ：当たったら同じボタンで次の技へ
    if (ctl && f.ast && f.conn && !f.air && f.mt <= lastWin + 12 && (f.hist[0] & BT.AU)) {
      const bit = { L: BT.LP, M: BT.MP, H: BT.HP }[f.ast.b];
      if (pressedMask(G, f, 10) & bit) {
        let nx = C.assist[f.ast.b][f.ast.i + 1];
        if (nx === 'SA') nx = f.sa >= BAR ? 'sa1' : null;
        if (nx && C.moves[nx]) { const M = C.moves[nx], o = other(G, f), gap = Math.abs(o.x - f.x) - 72; if (gap > 0) f.x += f.face * Math.min(gap, 24); startMove(G, f, nx, { mod: M.sp || M.saLv ? 1 : 0, ast: { b: f.ast.b, i: f.ast.i + 1 } }); return; }
      }
    }
    // パーソナルアクション：ドライブゲージが少し回復
    if (m.taunt && f.mt === 30) { f.drive = Math.min(DRIVE_MAX, f.drive + 5000); G.ev.push({ k: 'taunt', i: f.i }); }
    // 先行入力：当たる前に入れた必殺技・SAは、当たったら出す
    if (ctl && !f.conn && !f.air && f.mt <= lastWin && (m.cx.includes('sp') || m.sp)) {
      const a = readAction(G, f, 'cancel');
      if (a && a.id !== 'throw' && a.id !== 'di') { f.buf = a; f.cons = G.f; }
    }
    if (f.conn && f.buf && !f.air) { const a = f.buf; f.buf = null; const M = C.moves[a.id]; if (M && ((M.saLv && (m.sp || m.cx.includes('sp'))) || (M.sp && !m.sp && !m.saLv))) { startMove(G, f, a.id, a); return; } if (a.id === 'parry' && m.cx.includes('sp') && !f.burn && f.drive >= 3 * BAR) { f.drive -= 3 * BAR; setSt(f, 'rush'); f.t = 3; f.mv = null; G.ev.push({ k: 'rush', i: f.i, cancel: 1 }); return; } }
    if (ctl && f.conn && !f.air && f.mt <= lastWin + 10) {
      const a = readAction(G, f, 'cancel'), cx = m.cx;
      if (a) {
        const M = C.moves[a.id];
        const ok = M && ((M.saLv && (m.sp || cx.includes('sp'))) || (M.sp && !M.air && !m.sp && !m.saLv && cx.includes('sp')));
        if (ok) { startMove(G, f, a.id, a); return; }
        // キャンセルドライブラッシュ
        if (a.id === 'parry' && cx.includes('sp') && !f.burn && f.drive >= 3 * BAR) { f.drive -= 3 * BAR; if (f.drive <= 0) burnout(G, f); setSt(f, 'rush'); f.t = 3; f.mv = null; f.cons = G.f; G.ev.push({ k: 'rush', i: f.i, cancel: 1 }); return; }
      }
      // 弱の連打
      if (cx.includes('chain') && f.mt >= m.st + m.act - 1) {
        const pm = pressedMask(G, f);
        if (pm & (BT.LP | BT.LK)) { const id = (f.hist[0] & BT.D) ? (pm & BT.LK ? 'clk' : 'clp') : (pm & BT.LP ? 'lp' : 'lk'); if (f.mode === 'classic' || id === 'lp' || id === 'clk') { startMove(G, f, id); return; } }
      }
    }
    // 弱攻撃・中・強の出始めに、投げ・パリィ・インパクトの入力がそろったら切りかえ（同時押しの猶予）
    if (ctl && f.mt <= 2 && /^(c?l[pk]|c?m[pk]|c?h[pk])$/.test(f.mv)) {
      const a = readAction(G, f, 'cancel'); if (a && (a.id === 'throw' || a.id === 'di' || a.id === 'parry')) { startMove(G, f, a.id, a); return; }
    }
    if (f.mt >= m.total) { f.mv = null; setSt(f, f.air ? 'air' : 'idle'); if (f.air) f.airAtk = 1; f.rushB = 0; }
  }

  // ---------------- 投げ ----------------
  function throwable(V) {
    if (V.air || V.y > 0) return false;
    if (['hit', 'chit', 'block', 'cblock', 'fall', 'down', 'wake', 'jsq', 'air', 'splat', 'thrown', 'throwing', 'cin', 'ko', 'tech', 'crumple'].includes(V.st)) return false;
    if (V.st === 'bdash' && V.t < 18) return false;
    return true;
  }
  function checkThrows(G) {
    const tries = [];
    for (const A of G.p) { const m = mvOf(A); if (A.st === 'move' && m && m.throw && A.mt >= m.st && A.mt < m.st + m.act && !A.conn) tries.push(A); }
    if (!tries.length) return;
    if (tries.length === 2 && Math.abs(G.p[0].x - G.p[1].x) <= 96) { tech(G); return; }
    for (const A of tries) {
      const V = other(G, A);
      if (Math.abs(V.x - A.x) > 92 || !throwable(V)) continue;
      const vm = mvOf(V);
      const pc = (V.st === 'move' && vm && V.mt >= vm.st + vm.act) || V.st === 'parry' || V.st === 'parryEnd' || V.st === 'land' || V.st === 'rec';
      const back = (A.hist[0] & (A.face > 0 ? BT.L : BT.R)) ? 1 : 0;
      A.conn = 1; setSt(A, 'throwing'); setSt(V, 'thrown'); V.mv = null; V.vx = 0; A.vx = 0;
      G.grab = { a: A.i, t: 0, back, pc, techable: !pc };
      G.ev.push({ k: 'grab', i: A.i });
      return;
    }
  }
  function tech(G) {
    const [a, b] = G.p, s = a.x < b.x ? -1 : 1;
    setSt(a, 'tech'); setSt(b, 'tech'); a.mv = b.mv = null; a.push = s * 7; b.push = -s * 7; G.grab = null;
    G.hitstop = 8; G.ev.push({ k: 'tech', x: (a.x + b.x) / 2, y: 120 });
  }
  function updGrab(G) {
    const g = G.grab, A = G.p[g.a], V = other(G, A);
    g.t++;
    V.x = A.x + A.face * 56; V.y = 0;
    if (g.techable && g.t <= 9) {
      const pm = pressedMask(G, V, 3), cur = V.hist[0];
      const want = V.mode === 'modern' ? (cur & BT.LP) && (cur & BT.MP) : (cur & BT.LP) && (cur & BT.LK);
      if (want && pm) { tech(G); return; }
    }
    if (g.t === 12) {
      const C = FG.CHARS[A.ch], dmg = Math.round(1200 * (g.pc ? 1.7 : 1) * (C.dmgMul || 1) / 10) * 10;
      if (g.back) { A.face = -A.face; V.x = A.x + A.face * 56; }
      V.hp -= dmg; V.combo = 1; V.cdmg = dmg; V.lastHit = G.f;
      A.sa = Math.min(SA_MAX, A.sa + dmg); if (g.pc && !V.burn) { V.drive -= 2 * BAR; if (V.drive <= 0) burnout(G, V); }
      setSt(V, 'fall'); V.air = 1; V.y = 30; V.vx = A.face * 5; V.vy = 8; V.reset = 0; V.jug = 99;
      setSt(A, 'rec'); A.hs = 24; A.mv = null;
      G.hitstop = 12; G.ev.push({ k: 'hit', i: V.i, x: V.x, y: 100, str: 3, ct: g.pc ? 'punish' : null, dmg, combo: 1 });
      G.grab = null;
      if (V.hp <= 0) ko(G, V, A.face);
    }
  }

  // ---------------- 必殺演出（SA3） ----------------
  function updCin(G) {
    const c = G.cin, A = G.p[c.a], V = G.p[c.v];
    c.t++;
    const N = 8, at = [14, 26, 38, 50, 62, 74, 86, 104];
    const k = at.indexOf(c.t);
    if (k >= 0) {
      const part = Math.round(c.dmg * (k === N - 1 ? .3 : .1));
      V.hp -= part; V.combo++; V.cdmg += part; V.lastHit = G.f;
      G.ev.push({ k: 'hit', i: V.i, x: V.x, y: 110, str: k === N - 1 ? 3 : 2, dmg: part, combo: V.combo, fx: c.kind, cin: 1 });
      if (V.hp <= 0) V.hp = 0;
    }
    if (c.t >= 120) {
      G.cin = null; A.ca = 0;
      setSt(A, 'rec'); A.hs = 22; A.mv = null;
      const away = V.x >= A.x ? 1 : -1;
      setSt(V, 'fall'); V.air = 1; V.y = 20; V.vx = away * 6; V.vy = 12; V.reset = 0; V.jug = 99;
      if (V.hp <= 0) ko(G, V, away);
    }
  }

  // ---------------- 飛び道具 ----------------
  function updProj(G) {
    for (const p of G.proj) { p.x += p.vx; p.t++; if (p.cd > 0) p.cd--; }
    // 飛び道具どうし
    for (let i = 0; i < G.proj.length; i++) for (let j = i + 1; j < G.proj.length; j++) {
      const a = G.proj[i], b = G.proj[j];
      if (a.o === b.o || a.hits <= 0 || b.hits <= 0) continue;
      if (Math.abs(a.x - b.x) < (a.w + b.w) && Math.abs(a.y - b.y) < (a.h + b.h)) {
        const n = Math.min(a.hits, b.hits); a.hits -= n; b.hits -= n;
        G.ev.push({ k: 'clash', x: (a.x + b.x) / 2, y: a.y });
      }
    }
    const hits = [];
    for (const p of G.proj) {
      if (p.hits <= 0 || p.cd > 0) continue;
      const V = G.p[1 - p.o], A = G.p[p.o];
      const pb = [p.x - p.w, p.y - p.h, p.x + p.w, p.y + p.h];
      if (invuln(V, A, { lvl: 'mid' }, true)) continue;
      if (hurtBoxes(V).some(b => hitOverlap(pb, b))) hits.push(p);
    }
    for (const p of hits) {
      const V = G.p[1 - p.o], A = G.p[p.o];
      const m = { dmg: p.dmg, chip: p.chip, hs: p.hs, bs: p.bs, lvl: 'mid', str: p.str, pb: p.sa ? 1 : 5, sp: !p.sa, s: p.od ? 3 : 0, saLv: p.sa ? 1 : 0, kd: p.sa && p.hits === 1 ? 1 : 0, launch: p.sa && p.hits === 1 ? [4, 8] : null };
      const saveCa = A.ca; A.ca = p.ca;
      const r = resolveHit(G, A, V, m, { proj: p });
      A.ca = saveCa;
      { const am = mvOf(A); if (A.st === 'move' && am && am.spawn && (r === 'hit' || r === 'block')) A.conn = r === 'hit' ? 1 : 2; }
      p.hits--; p.cd = p.gap || 99;
      if (r === 'parry' && !p.sa) p.hits = 0;
      if (p.sa) G.hitstop = Math.min(G.hitstop, 4);
    }
    G.proj = G.proj.filter(p => p.hits > 0 && p.x > -60 && p.x < STAGE.W + 60 && p.t < p.life);
  }

  // ---------------- 位置の調整（押し合い・壁・画面の幅） ----------------
  function solvePositions(G) {
    const [a, b] = G.p, W = STAGE.WALL, R = STAGE.W - STAGE.WALL;
    for (const f of G.p) {
      if (f.push) { f.x += f.push; f.push *= .8; if (Math.abs(f.push) < .2) f.push = 0; }
      if (f.diSplat && f.st === 'fall' && (f.x <= W || f.x >= R)) { setSt(f, 'splat'); f.vx = 0; f.vy = 0; f.y = Math.max(f.y, 40); G.ev.push({ k: 'splat', i: f.i, x: f.x, y: f.y + 90 }); }
      f.x = Math.max(W, Math.min(R, f.x));
    }
    // 押し合い
    const ay = [a.y, a.y + (a.air ? 120 : 150)], by = [b.y, b.y + (b.air ? 120 : 150)];
    const skip = a.st === 'thrown' || b.st === 'thrown' || a.st === 'cin' || b.st === 'cin' || a.st === 'down' || b.st === 'down';
    if (!skip && ay[0] < by[1] && by[0] < ay[1]) {
      const dx = b.x - a.x, ov = PUSHW * 2 - Math.abs(dx);
      if (ov > 0) {
        const s = dx > 0 ? 1 : dx < 0 ? -1 : (a.face > 0 ? 1 : -1);
        let ma = -s * ov / 2, mb = s * ov / 2;
        if (a.x + ma < W || a.x + ma > R) { mb += ma; ma = 0; mb = s * ov; }
        if (b.x + mb < W || b.x + mb > R) { ma = -s * ov; mb = 0; }
        a.x = Math.max(W, Math.min(R, a.x + ma)); b.x = Math.max(W, Math.min(R, b.x + mb));
      }
    }
    // 画面の幅より離れない
    const dist = Math.abs(a.x - b.x);
    if (dist > STAGE.MAXD) {
      const ex = dist - STAGE.MAXD, s = a.x < b.x ? 1 : -1;
      const ma = Math.abs(a.vx) >= Math.abs(b.vx);
      if (ma) a.x += s * ex; else b.x -= s * ex;
    }
    // 向き
    for (const f of G.p) {
      const o = other(G, f);
      if ((actionable(f) || f.st === 'jsq' || f.st === 'land' || f.st === 'block' || f.st === 'cblock' || f.st === 'wake') && o.x !== f.x) f.face = o.x > f.x ? 1 : -1;
    }
  }

  // ---------------- 1フレーム進める ----------------
  FG.step = function (G, inputs) {
    G.ev = [];
    G.f++;
    for (const f of G.p) { f.hist.unshift(inputs[f.i] | 0); f.hist.length = HIST; }
    if (G.phase === 'over') return;
    if (G.phase === 'intro') {
      G.pt++;
      if (G.pt === 1) G.ev.push({ k: 'round', n: G.round, final: G.wins[0] === G.opt.rounds - 1 && G.wins[1] === G.opt.rounds - 1 });
      if (G.pt === 70) G.ev.push({ k: 'fight' });
      if (G.pt >= 80) { G.phase = 'fight'; }
      for (const f of G.p) f.t++;
      return;
    }
    if (G.freeze > 0) { G.freeze--; if (G.freeze === 0) G.freezeBy = -1; return; }
    if (G.hitstop > 0) { G.hitstop--; return; }
    if (G.cin) { updCin(G); return; }
    if (G.grab) { updGrab(G); solvePositions(G); return; }
    // 更新
    for (const f of G.p) updFighter(G, f);
    updProj(G);
    checkThrows(G);
    // 打撃の当たり（相打ちもあるので、先に全部集めてから処理）
    const hits = [];
    for (const A of G.p) {
      const wi = activeWin(A); if (wi < 0) continue;
      const V = other(G, A), m = mvOf(A);
      if (invuln(V, A, m, false)) continue;
      const hb = box(A, m.hb);
      if (hurtBoxes(V).some(b => hitOverlap(hb, b))) hits.push([A, V, m, wi]);
    }
    for (const [A, V, m, wi] of hits) {
      if (A.st !== 'move' || A.mv !== m.id) continue;   // 相打ちで先に当てられた
      A.hitW[wi] = 1;
      const r = resolveHit(G, A, V, m, { dmg: m.win[wi][2] });
      if (r === 'hit' || r === 'armor') A.conn = A.conn || 1;
      if (r === 'block') A.conn = A.conn || 2;
      if (r === 'parry') A.conn = 0;
      if (m.bounce && r !== 'parry') { A.vy = 7; A.vx = -A.face * 3; A.mv = null; setSt(A, 'air'); A.airAtk = 1; }
    }
    solvePositions(G);
    // 時間
    if (G.phase === 'fight' && !G.opt.training) {
      G.timer--;
      if (G.timer <= 0) { G.timer = 0; G.phase = 'time'; G.pt = 0; G.ev.push({ k: 'timeup' }); }
    }
    if (G.phase === 'ko' || G.phase === 'time') {
      G.pt++;
      if (G.pt >= 170) endRound(G);
    }
  };
  function endRound(G) {
    const [a, b] = G.p;
    const ra = a.hp / a.maxHp, rb = b.hp / b.maxHp;
    let w = ra > rb ? 0 : rb > ra ? 1 : -1;
    if (a.hp <= 0 && b.hp <= 0) w = -1;
    if (w >= 0) G.wins[w]++; else { G.wins[0]++; G.wins[1]++; }
    G.ev.push({ k: 'roundEnd', w });
    const R = G.opt.rounds;
    if (G.wins[0] >= R || G.wins[1] >= R) {
      G.phase = 'over'; G.over = G.wins[0] >= R && G.wins[1] >= R ? { w: -1 } : { w: G.wins[0] >= R ? 0 : 1 };
      G.ev.push({ k: 'over', w: G.over.w });
      return;
    }
    G.round++;
    resetRound(G, false);
  }
  FG.readAction = readAction;
  FG.mvOf = mvOf;
  FG.CONST = { DRIVE_MAX, SA_MAX, BAR };
})();
