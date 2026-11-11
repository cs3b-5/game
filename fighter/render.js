// =============================================================
//  嵐拳：描画（人形・ステージ・エフェクト・HUD）と効果音
//  シミュレーションとは別。ここでは Math.random を使ってもよい
// =============================================================
(function () {
  const FG = window.FG = window.FG || {};
  const VW = 1280, VH = 720, GY = 640;            // 画面の大きさと地面の高さ
  const K = VW / FG.STAGE.VIEW;                   // 1ワールド単位 → 画面px
  const BONE = { torso: 58, neck: 10, head: 14, ua: 30, fa: 30, th: 44, sh: 44 };
  let cv, cx, cam = { x: 700, y: 0, shake: 0 }, parts = [], texts = [], trails = [[], []], flash = 0, flashCol = '#fff', superBanner = null;
  const R = { opts: { boxes: false } };

  // ---------- ポーズ ----------
  const lerp = (a, b, t) => a + (b - a) * t;
  function blend(a, b, t) {
    const o = {};
    for (const k in a) o[k] = Array.isArray(a[k]) ? [lerp(a[k][0], b[k][0], t), lerp(a[k][1], b[k][1], t)] : lerp(a[k], b[k], t);
    return o;
  }
  const PZ = n => typeof n === 'string' ? FG.POSE[n] : n;
  function keyPose(kf, t) {
    if (t <= kf[0][0]) return PZ(kf[0][1]);
    for (let i = 0; i < kf.length - 1; i++) {
      const [t0, p0] = kf[i], [t1, p1] = kf[i + 1];
      if (t <= t1) { const u = (t - t0) / Math.max(1, t1 - t0); return blend(PZ(p0), PZ(p1), u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2); }
    }
    return PZ(kf[kf.length - 1][1]);
  }
  function walkPose(f, dir) {
    const p = blend(FG.POSE.stand, FG.POSE.stand, 0), s = f.t * .2 * dir;
    p.ff = [22 + Math.sin(s) * 14, Math.max(0, Math.cos(s) * 7)];
    p.bf = [-26 - Math.sin(s) * 14, Math.max(0, -Math.cos(s) * 7)];
    p.h = [0, 84 + Math.abs(Math.cos(s)) * 2];
    return p;
  }
  function poseOf(G, f) {
    const P = FG.POSE, m = FG.mvOf(f);
    let p, rot = 0, spin = 0;
    const o = G.p[1 - f.i];
    if (G.phase === 'over' && G.over && G.over.w === f.i && FG.actionable(f)) return { p: blend(P.stand, P.win, Math.min(1, f.t / 20)), rot };
    switch (f.st) {
      case 'idle': p = blend(P.stand, P.stand, 0); { const b = Math.sin(f.t * .08); p.h = [0, 84 + b * 1.6]; p.fh = [26, 4 + b * 2]; p.bh = [12, 10 + b * 2]; } break;
      case 'walkF': p = walkPose(f, 1); break;
      case 'walkB': p = f.guard ? P.block : walkPose(f, -1); break;
      case 'crouch': p = blend(P.stand, P.crouch, Math.min(1, (f.t + 1) / 3)); break;
      case 'jsq': p = blend(P.stand, P.crouch, .55); break;
      case 'land': p = blend(P.crouch, P.stand, .4); break;
      case 'air':
        p = P.air;
        if (f.jdir) rot = Math.max(0, Math.min(1, (f.t - 4) / 30)) * Math.PI * 2 * f.jdir;
        break;
      case 'move': {
        p = keyPose(m.pose, f.mt);
        if (m.spin && f.mt >= m.spin[0] && f.mt <= m.spin[1]) spin = Math.floor((f.mt - m.spin[0]) / 5) % 2;
        if (m.flipSpin && f.mt >= m.flipSpin[0] && f.mt <= m.flipSpin[1]) rot = -(f.mt - m.flipSpin[0]) / (m.flipSpin[1] - m.flipSpin[0]) * Math.PI * 2;
        break;
      }
      case 'hit': p = blend(P.hit, P.stand, Math.max(0, 1 - f.hs / 10) * .6); break;
      case 'chit': p = P.chit; break;
      case 'block': case 'tech': p = P.block; break;
      case 'cblock': p = P.cblock; break;
      case 'rec': p = blend(P.toss, P.stand, Math.min(1, f.t / 18)); break;
      case 'fall': {
        p = P.launch; rot = Math.max(-1.4, Math.min(.6, -f.vy * .09)) - .2;
        if (f.hp <= 0) rot = -.6;
        break;
      }
      case 'down': p = P.down; break;
      case 'wake': p = f.t < 9 ? blend(P.down, P.wake, f.t / 9) : blend(P.wake, P.stand, (f.t - 9) / 9); break;
      case 'splat': p = P.splat; break;
      case 'crumple': p = blend(P.hit2, P.crumple, Math.min(1, f.t / 18)); break;
      case 'stun': p = blend(P.stun, P.stun, 0); p.h = [Math.sin(f.t * .1) * 4, 80]; p.hd = 22 + Math.sin(f.t * .1) * 10; break;
      case 'parry': case 'parryEnd': p = P.parry; break;
      case 'rush': { p = blend(P.rush, P.rush, 0); const s = f.t * .5; p.ff = [40 * Math.cos(s), 6 + Math.max(0, Math.sin(s) * 14)]; p.bf = [-40 * Math.cos(s), 6 + Math.max(0, -Math.sin(s) * 14)]; break; }
      case 'dash': p = blend(P.dash, P.stand, Math.max(0, (f.t - 12) / 7)); break;
      case 'bdash': p = blend(P.bdash, P.stand, Math.max(0, (f.t - 14) / 9)); break;
      case 'throwing': p = G.grab && G.grab.t > 8 ? P.toss : P.grab; break;
      case 'thrown': p = P.hit2; break;
      case 'cin': {
        const c = G.cin;
        if (c && c.a === f.i) { const k = Math.floor(c.t / 12) % 4; p = [P.hp1, P.mk1, P.hk1, P.mp1][k]; }
        else p = (c && Math.floor(c.t / 12) % 2) ? P.hit : P.hit2;
        break;
      }
      default: p = P.stand;
    }
    return { p, rot, spin };
  }

  // ---------- 2本の骨の計算（IK） ----------
  function ik(rx, ry, tx, ty, l1, l2, pick) {
    let dx = tx - rx, dy = ty - ry, d = Math.hypot(dx, dy);
    const max = l1 + l2 - .5; if (d > max) { dx *= max / d; dy *= max / d; d = max; }
    if (d < 1) d = 1;
    const base = Math.atan2(dy, dx), a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    const j1 = [rx + Math.cos(base + a) * l1, ry + Math.sin(base + a) * l1], j2 = [rx + Math.cos(base - a) * l1, ry + Math.sin(base - a) * l1];
    const j = pick(j1, j2) ? j1 : j2;
    return { j, e: [rx + dx, ry + dy] };
  }
  // ポーズ → 関節の位置（ローカル：右向き・上がプラス）
  function skeleton(p) {
    const r = p.l * Math.PI / 180, hip = p.h;
    const sh = [hip[0] + Math.sin(r) * BONE.torso, hip[1] + Math.cos(r) * BONE.torso];
    const nk = [sh[0] + Math.sin(r) * BONE.neck, sh[1] + Math.cos(r) * BONE.neck];
    const rh = (p.l + p.hd) * Math.PI / 180;
    const hd = [nk[0] + Math.sin(rh) * BONE.head, nk[1] + Math.cos(rh) * BONE.head];
    const elbow = (j1, j2) => j1[1] < j2[1];
    const knee = (j1, j2) => j1[0] > j2[0];
    const fa = ik(sh[0] + 3, sh[1], sh[0] + 3 + p.fh[0], sh[1] + p.fh[1], BONE.ua, BONE.fa, elbow);
    const ba = ik(sh[0] - 3, sh[1], sh[0] - 3 + p.bh[0], sh[1] + p.bh[1], BONE.ua, BONE.fa, elbow);
    const fl = ik(hip[0] + 4, hip[1], p.ff[0], p.ff[1], BONE.th, BONE.sh, knee);
    const bl = ik(hip[0] - 4, hip[1], p.bf[0], p.bf[1], BONE.th, BONE.sh, knee);
    return { hip, sh, nk, hd, rot: rh, fa: { s: [sh[0] + 3, sh[1]], e: fa.j, h: fa.e }, ba: { s: [sh[0] - 3, sh[1]], e: ba.j, h: ba.e },
      fl: { s: [hip[0] + 4, hip[1]], k: fl.j, f: fl.e }, bl: { s: [hip[0] - 4, hip[1]], k: bl.j, f: bl.e } };
  }
  FG.skeleton = skeleton; FG.poseOf = poseOf;

  // ---------- ワールド → 画面 ----------
  const SX = x => (x - cam.x) * K + VW / 2, SY = y => GY - y * K;

  // ---------- 人形を描く ----------
  function limb(a, b, w, col, out = '#0c0a10') {
    cx.lineCap = 'round';
    cx.strokeStyle = out; cx.lineWidth = w + 5; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
    cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a[0], a[1]); cx.lineTo(b[0], b[1]); cx.stroke();
  }
  function dot(p, r, col, out = '#0c0a10') { cx.fillStyle = out; cx.beginPath(); cx.arc(p[0], p[1], r + 2.5, 0, 7); cx.fill(); cx.fillStyle = col; cx.beginPath(); cx.arc(p[0], p[1], r, 0, 7); cx.fill(); }
  function drawFighter(G, f) {
    const C = FG.CHARS[f.ch], col = C.colors, { p, rot, spin } = poseOf(G, f), S = skeleton(p);
    const face = spin ? -f.face : f.face;
    // ローカル → 画面
    const ox = SX(f.x), oy = SY(f.y), pv = [S.hip[0], S.hip[1] - 10];
    const T = q => {
      let x = q[0], y = q[1];
      if (rot) { const dx = x - pv[0], dy = y - pv[1], c = Math.cos(rot), s = Math.sin(rot); x = pv[0] + dx * c - dy * s; y = pv[1] + dx * s + dy * c; }
      return [ox + x * face * K, oy - y * K];
    };
    const burnt = f.burn, dim = (c, k) => shade(c, k);
    const gi = burnt ? '#8a8a8a' : col.gi, gi2 = burnt ? '#5a5a5a' : col.gi2;
    // 影
    cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(ox, GY + 4, 46 * K * Math.max(.4, 1 - f.y / 400), 8 * K, 0, 0, 7); cx.fill();
    // オーラ（ドライブインパクト・パリィ・SA）
    const m = FG.mvOf(f);
    if (f.st === 'move' && m && (m.di || m.id === 'drev')) aura(T(S.sh), '#ffb030', 70);
    if (f.st === 'parry') aura(T(S.sh), '#5affb0', 64, .5);
    if (f.st === 'move' && m && m.saLv) aura(T(S.sh), C.colors.aura, 80);
    if (f.burn) { cx.globalAlpha = .9; }
    const s = 1.6;
    // うしろの脚・腕
    limb(T(S.bl.s), T(S.bl.k), 16 * s, gi2); limb(T(S.bl.k), T(S.bl.f), 13 * s, gi2);
    foot(T(S.bl.k), T(S.bl.f), C, true, face);
    limb(T(S.ba.s), T(S.ba.e), 11 * s, C.colors.pony ? gi2 : dim(col.skin, .75));
    limb(T(S.ba.e), T(S.ba.h), 10 * s, dim(col.skin, .75)); dot(T(S.ba.h), 7 * s, dim(col.glove, .8));
    // 胴
    const hipL = T([S.hip[0] - 12, S.hip[1]]), hipR = T([S.hip[0] + 12, S.hip[1]]);
    const r = p.l * Math.PI / 180, perp = [Math.cos(r), -Math.sin(r)];
    const shL = T([S.sh[0] - perp[0] * 16, S.sh[1] - perp[1] * 16]), shR = T([S.sh[0] + perp[0] * 16, S.sh[1] + perp[1] * 16]);
    poly([hipL, hipR, shR, shL], gi);
    // 胸元（道着のV）
    if (!C.colors.pony) poly([T([S.sh[0] + perp[0] * 9, S.sh[1] + perp[1] * 9]), T([S.sh[0] - perp[0] * 6, S.sh[1] - perp[1] * 6]), T([(S.sh[0] + S.hip[0]) / 2 + 4, (S.sh[1] + S.hip[1]) / 2 + 6])], col.skin, true);
    // 帯
    limb(T([S.hip[0] - 13, S.hip[1] + 4]), T([S.hip[0] + 13, S.hip[1] + 4]), 7 * s, col.belt);
    const tail = [S.hip[0] - 14 - Math.sin(G.f * .2) * 3, S.hip[1] - 14];
    limb(T([S.hip[0] - 10, S.hip[1] + 4]), T(tail), 4 * s, col.belt);
    // 頭
    limb(T(S.sh), T(S.nk), 9 * s, col.skin);
    drawHead(T, S, C, face, f, G);
    // 前の脚・腕
    limb(T(S.fl.s), T(S.fl.k), 16 * s, gi); limb(T(S.fl.k), T(S.fl.f), 13 * s, gi);
    foot(T(S.fl.k), T(S.fl.f), C, false, face);
    limb(T(S.fa.s), T(S.fa.e), 11 * s, C.colors.pony ? gi : col.skin);
    limb(T(S.fa.e), T(S.fa.h), 10 * s, col.skin); dot(T(S.fa.h), 7.5 * s, col.glove);
    cx.globalAlpha = 1;
    // 技の炎・雷
    if (f.st === 'move' && m) {
      const act = m.win.some(w => f.mt >= w[0] - 1 && f.mt <= w[1] + 2);
      if (m.fx === 'fire' && act) flame(T(S.fa.h), 26), flame(T(S.ba.h), 22);
      if (m.fx === 'bolt' && act) bolt(T(S.fl.k), T(S.fl.f), C.colors.aura);
      if (m.fx === 'pillar' && f.mt >= m.st - 1 && f.mt <= m.st + m.act) pillar(SX(f.x + f.face * 80), C.colors.aura);
    }
    if (f.st === 'stun') stars(T(S.hd));
    // ラッシュの残像
    if (f.st === 'rush' || (f.rushB && f.st === 'move')) trails[f.i].push({ x: f.x, y: f.y, a: .5 });
    // 骨の位置を覚えておく（エフェクト用）
    f._head = T(S.hd);
  }
  function foot(k, fp, C, back, face) {
    const d = [fp[0] - k[0], fp[1] - k[1]], L = Math.hypot(d[0], d[1]) || 1;
    const nx = -d[1] / L, ny = d[0] / L, s = face > 0 ? 1 : -1;
    const toe = [fp[0] + face * 16 * Math.abs(ny) + 0, fp[1] + 2];
    limb(fp, [fp[0] + face * 14, fp[1] + 3], 9, C.colors.pony ? (back ? '#10101a' : C.colors.glove) : shade(C.colors.skin, back ? .75 : 1));
  }
  function drawHead(T, S, C, face, f, G) {
    const h = T(S.hd), r = BONE.head * K * 1.05, col = C.colors;
    // ポニーテール（うしろ）
    if (col.pony) {
      const sw = Math.sin(G.f * .15 + f.i) * 6;
      const p1 = [h[0] - face * r * 1.1, h[1] - r * .5], p2 = [h[0] - face * r * 2.4, h[1] + r * .4 + sw], p3 = [h[0] - face * r * 3.2, h[1] + r * 1.4 + sw];
      cx.strokeStyle = '#0c0a10'; cx.lineWidth = 16; cx.lineCap = 'round'; cx.beginPath(); cx.moveTo(...p1); cx.quadraticCurveTo(...p2, ...p3); cx.stroke();
      cx.strokeStyle = col.hair; cx.lineWidth = 11; cx.beginPath(); cx.moveTo(...p1); cx.quadraticCurveTo(...p2, ...p3); cx.stroke();
    }
    dot(h, r, col.skin);
    // 髪
    cx.fillStyle = '#0c0a10'; cx.beginPath(); cx.arc(h[0], h[1] - 2, r + 3, Math.PI * 1.02, Math.PI * 1.98); cx.fill();
    cx.fillStyle = col.hair; cx.beginPath();
    if (!col.pony) {   // ツンツン頭
      const pts = [[-1.1, .1], [-1.2, -.7], [-.7, -.9], [-.6, -1.5], [-.1, -1.05], [.25, -1.6], [.45, -1], [1, -1.2], [.95, -.5], [1.1, -.1]];
      pts.forEach(([a, b], i) => { const x = h[0] + a * r * face, y = h[1] + b * r; i ? cx.lineTo(x, y) : cx.moveTo(x, y); });
      cx.closePath(); cx.fill(); cx.strokeStyle = '#0c0a10'; cx.lineWidth = 2.5; cx.stroke();
    } else {
      cx.arc(h[0], h[1] - 1, r + .5, Math.PI * 1.05, Math.PI * 1.95); cx.fill();
      cx.beginPath(); cx.moveTo(h[0] + face * r * .9, h[1] - r * .2); cx.lineTo(h[0] + face * r * .2, h[1] - r * .95); cx.lineTo(h[0] + face * r * 1.05, h[1] - r * .7); cx.fill();
    }
    // はちまき
    cx.strokeStyle = '#0c0a10'; cx.lineWidth = 8; cx.beginPath(); cx.moveTo(h[0] - r, h[1] - r * .3); cx.lineTo(h[0] + r, h[1] - r * .45); cx.stroke();
    cx.strokeStyle = col.band; cx.lineWidth = 5; cx.beginPath(); cx.moveTo(h[0] - r, h[1] - r * .3); cx.lineTo(h[0] + r, h[1] - r * .45); cx.stroke();
    const w = Math.sin(G.f * .25 + f.i * 2) * 5;
    cx.lineWidth = 4; cx.beginPath(); cx.moveTo(h[0] - face * r, h[1] - r * .3); cx.quadraticCurveTo(h[0] - face * r * 2, h[1] - r * .6 + w, h[0] - face * r * 2.8, h[1] + w); cx.stroke();
    // 目
    cx.fillStyle = '#0c0a10'; cx.fillRect(h[0] + face * r * .45 - 2, h[1] - r * .05, 5, 3);
  }
  function poly(pts, col, noOut) {
    cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath();
    if (!noOut) { cx.strokeStyle = '#0c0a10'; cx.lineWidth = 5; cx.lineJoin = 'round'; cx.stroke(); }
    cx.fillStyle = col; cx.fill();
  }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgb(${r * k | 0},${g * k | 0},${b * k | 0})`;
  }
  function aura(p, col, r, a = .35) {
    const g = cx.createRadialGradient(p[0], p[1] + 40, 10, p[0], p[1] + 40, r * K * 1.4);
    g.addColorStop(0, col); g.addColorStop(1, 'transparent');
    cx.globalAlpha = a + Math.random() * .15; cx.fillStyle = g; cx.beginPath(); cx.arc(p[0], p[1] + 40, r * K * 1.4, 0, 7); cx.fill(); cx.globalAlpha = 1;
  }
  function flame(p, r) {
    for (let i = 0; i < 3; i++) {
      const x = p[0] + (Math.random() - .5) * r, y = p[1] + (Math.random() - .5) * r;
      const g = cx.createRadialGradient(x, y, 1, x, y, r);
      g.addColorStop(0, 'rgba(255,240,180,.9)'); g.addColorStop(.4, 'rgba(255,120,30,.6)'); g.addColorStop(1, 'rgba(255,40,0,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
    }
    if (Math.random() < .5) parts.push({ x: p[0], y: p[1], vx: (Math.random() - .5) * 3, vy: -2 - Math.random() * 3, life: 20, max: 20, kind: 'ember', col: '#ffb040', r: 4 });
  }
  function zig(a, b, col, w) {
    cx.strokeStyle = col; cx.lineWidth = w; cx.beginPath(); cx.moveTo(a[0], a[1]);
    const n = 6;
    for (let i = 1; i < n; i++) cx.lineTo(lerp(a[0], b[0], i / n) + (Math.random() - .5) * 26, lerp(a[1], b[1], i / n) + (Math.random() - .5) * 26);
    cx.lineTo(b[0], b[1]); cx.stroke();
  }
  function bolt(a, b, col) {
    cx.save(); cx.shadowColor = col; cx.shadowBlur = 18;
    zig([a[0] + (Math.random() - .5) * 30, a[1] - 30], [b[0] + (Math.random() - .5) * 20, b[1] + 10], '#fff', 3);
    zig(a, [b[0] + (Math.random() - .5) * 40, b[1]], col, 2);
    cx.restore();
  }
  function pillar(x, col) {
    cx.save(); cx.globalAlpha = .7; cx.shadowColor = col; cx.shadowBlur = 30;
    const g = cx.createLinearGradient(x - 60, 0, x + 60, 0); g.addColorStop(0, 'transparent'); g.addColorStop(.5, col); g.addColorStop(1, 'transparent');
    cx.fillStyle = g; cx.fillRect(x - 70, 0, 140, GY);
    for (let i = 0; i < 3; i++) zig([x + (Math.random() - .5) * 60, 0], [x + (Math.random() - .5) * 60, GY], '#fff', 3);
    cx.restore();
  }
  function stars(h) {
    const t = performance.now() / 200;
    for (let i = 0; i < 3; i++) { const a = t + i * 2.1; cx.fillStyle = '#ffe14a'; cx.font = 'bold 22px sans-serif'; cx.fillText('★', h[0] + Math.cos(a) * 36 - 8, h[1] - 40 + Math.sin(a) * 10); }
  }

  // ---------- ステージ（夜の商店街） ----------
  let bgCache = null;
  function drawStage(G) {
    const sky = cx.createLinearGradient(0, 0, 0, GY);
    sky.addColorStop(0, '#0d0b24'); sky.addColorStop(.55, '#2a1846'); sky.addColorStop(1, '#5a2a4a');
    cx.fillStyle = sky; cx.fillRect(0, 0, VW, VH);
    // 月
    cx.fillStyle = 'rgba(255,240,210,.9)'; cx.beginPath(); cx.arc(980 - (cam.x - 700) * .05, 110, 46, 0, 7); cx.fill();
    // 遠くのビル（ゆっくり動く）
    const far = (x0, par, h, col, win) => {
      for (let i = -2; i < 26; i++) {
        const w = 70 + (i * 37 % 50), x = i * 110 - (cam.x - 700) * par, hh = h + (i * 53 % 120);
        cx.fillStyle = col; cx.fillRect(x, GY - 70 - hh, w, hh + 70);
        if (win) for (let r = 0; r < hh / 22; r++) for (let c = 0; c < w / 18 - 1; c++) if ((i * 7 + r * 3 + c * 5) % 4 === 0) { cx.fillStyle = (r + c + i) % 3 ? 'rgba(255,214,120,.55)' : 'rgba(120,220,255,.45)'; cx.fillRect(x + 8 + c * 18, GY - 60 - hh + r * 22, 8, 10); }
      }
    };
    far(0, .25, 160, '#1a1430', true);
    far(0, .5, 60, '#120e22', false);
    // 看板（ネオン）
    const signs = [['拳', '#ff3a6a', 200], ['嵐', '#3ae0ff', 620], ['酒', '#ffcc3a', 1050], ['湯', '#ff7a3a', 1400], ['闘', '#c46aff', -200]];
    for (const [t, col, x0] of signs) {
      const x = x0 - (cam.x - 700) * .7;
      cx.save(); cx.shadowColor = col; cx.shadowBlur = 24; cx.strokeStyle = col; cx.lineWidth = 4; cx.strokeRect(x, 250, 70, 110);
      cx.fillStyle = col; cx.font = '900 54px "Noto Sans JP", sans-serif'; cx.textAlign = 'center'; cx.fillText(t, x + 35, 325); cx.restore();
    }
    // ちょうちん
    for (let i = -4; i < 20; i++) {
      const x = i * 120 - (cam.x - 700) * .9, y = 200 + Math.sin(i) * 6;
      cx.strokeStyle = 'rgba(0,0,0,.5)'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(x - 60, 180); cx.quadraticCurveTo(x, 196, x + 60, 180); cx.stroke();
      const g = cx.createRadialGradient(x, y + 18, 2, x, y + 18, 40); g.addColorStop(0, 'rgba(255,120,60,.55)'); g.addColorStop(1, 'transparent');
      cx.fillStyle = g; cx.beginPath(); cx.arc(x, y + 18, 40, 0, 7); cx.fill();
      cx.fillStyle = '#e8402a'; cx.beginPath(); cx.ellipse(x, y + 18, 13, 17, 0, 0, 7); cx.fill();
    }
    // 地面
    const gr = cx.createLinearGradient(0, GY - 30, 0, VH); gr.addColorStop(0, '#2c2234'); gr.addColorStop(1, '#141018');
    cx.fillStyle = gr; cx.fillRect(0, GY - 20, VW, VH);
    cx.strokeStyle = 'rgba(255,255,255,.06)'; cx.lineWidth = 2;
    for (let i = -10; i < 30; i++) { const x = i * 90 - (cam.x - 700) * K % 90; cx.beginPath(); cx.moveTo(x, GY - 20); cx.lineTo(x + (x - VW / 2) * .6, VH); cx.stroke(); }
    cx.fillStyle = 'rgba(255,90,140,.08)'; cx.fillRect(0, GY - 20, VW, 6);
    // 壁の端
    for (const wx of [FG.STAGE.WALL - 30, FG.STAGE.W - FG.STAGE.WALL + 30]) { const x = SX(wx); if (x > -40 && x < VW + 40) { cx.fillStyle = 'rgba(0,0,0,.4)'; cx.fillRect(wx < 700 ? 0 : x, 0, wx < 700 ? x : VW - x, VH); } }
  }

  // ---------- 飛び道具 ----------
  function drawProj(G, p) {
    const x = SX(p.x), y = SY(p.y), dir = p.vx > 0 ? 1 : -1, C = FG.CHARS[G.p[p.o].ch];
    if (p.kind === 'beam') {
      const dir2 = G.p[p.o].face, len = Math.min(p.w * 2 * K, p.t * 60), x0 = SX(p.x - dir2 * p.w);
      const x = x0 + dir2 * len, dir = dir2, y2 = y;
      cx.save(); cx.shadowColor = '#ff6a20'; cx.shadowBlur = 40;
      const g = cx.createLinearGradient(x - dir * len, 0, x, 0); g.addColorStop(0, 'rgba(255,80,20,0)'); g.addColorStop(.6, 'rgba(255,140,40,.8)'); g.addColorStop(1, '#fff6c0');
      cx.fillStyle = g; cx.fillRect(Math.min(x, x - dir * len), y - 50 - Math.random() * 6, len, 100 + Math.random() * 12); cx.restore();
      flame([x, y], 70);
      return;
    }
    cx.save(); cx.shadowColor = '#ff7a20'; cx.shadowBlur = 30;
    for (let i = 0; i < 5; i++) { const tx = x - dir * i * 16, r = 30 - i * 5; const g = cx.createRadialGradient(tx, y, 2, tx, y, r); g.addColorStop(0, '#fff8d0'); g.addColorStop(.4, p.od ? '#ff4ab0' : '#ffa030'); g.addColorStop(1, 'rgba(255,40,0,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(tx, y + (Math.random() - .5) * 6, r, 0, 7); cx.fill(); }
    cx.restore();
    if (Math.random() < .6) parts.push({ x: x - dir * 30, y: y + (Math.random() - .5) * 20, vx: -dir * 2, vy: -1, life: 16, max: 16, kind: 'ember', col: '#ff9a30', r: 5 });
  }

  // ---------- エフェクト（イベントから） ----------
  FG.Render = R;
  R.fx = function (G, evs) {
    for (const e of evs) {
      const x = e.x != null ? SX(e.x) : VW / 2, y = e.y != null ? SY(e.y) : VH / 2;
      switch (e.k) {
        case 'hit': {
          const n = 8 + e.str * 6;
          for (let i = 0; i < n; i++) { const a = Math.random() * 7, s = 4 + Math.random() * (6 + e.str * 4); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 14, max: 14, kind: 'spark', col: e.fx === 'bolt' ? '#bff0ff' : e.fx === 'fire' ? '#ffb040' : '#fff3a0', r: 3 + e.str }); }
          parts.push({ x, y, life: 10, max: 10, kind: 'ring', col: '#fff', r: 20 + e.str * 18 });
          if (e.ct) texts.push({ t: e.ct === 'punish' ? 'PUNISH COUNTER' : 'COUNTER', x: e.i ? VW - 240 : 240, y: 260, col: e.ct === 'punish' ? '#ff4a6a' : '#ffd23a', life: 60 });
          cam.shake = Math.max(cam.shake, 3 + e.str * 3);
          if (e.str >= 3) { flash = .25; flashCol = '#fff'; }
          SFX.hit(e.str);
          break;
        }
        case 'block':
          for (let i = 0; i < 6; i++) { const a = Math.random() * 7; parts.push({ x, y, vx: Math.cos(a) * 4, vy: Math.sin(a) * 4, life: 10, max: 10, kind: 'spark', col: '#8ad8ff', r: 3 }); }
          parts.push({ x, y, life: 10, max: 10, kind: 'ring', col: '#6ac8ff', r: 30 });
          SFX.block(); break;
        case 'parry':
          parts.push({ x, y, life: 16, max: 16, kind: 'ring', col: '#5affb0', r: 60 });
          if (e.perfect) { flash = .35; flashCol = '#5affb0'; texts.push({ t: 'PERFECT', x: e.i ? VW - 240 : 240, y: 260, col: '#5affb0', life: 70 }); }
          SFX.parry(e.perfect); break;
        case 'armor': parts.push({ x, y, life: 14, max: 14, kind: 'ring', col: '#ffb030', r: 50 }); SFX.block(); break;
        case 'tech': parts.push({ x, y, life: 14, max: 14, kind: 'ring', col: '#fff', r: 50 }); texts.push({ t: 'TECH', x: VW / 2, y: 240, col: '#fff', life: 40 }); SFX.block(); break;
        case 'clash': parts.push({ x, y, life: 16, max: 16, kind: 'ring', col: '#ffd040', r: 60 }); SFX.hit(1); break;
        case 'super': superBanner = { nm: e.nm, lv: e.lv, i: e.i, t: 0 }; SFX.super(); break;
        case 'di': SFX.di(); break;
        case 'taunt': texts.push({ t: '♪ DRIVE UP', x: e.i ? VW - 240 : 240, y: 300, col: '#5affb0', life: 50 }); SFX.parry(false); break;
        case 'rush': SFX.rush(); break;
        case 'parryOn': SFX.whoosh(0); break;
        case 'whoosh': SFX.whoosh(e.str); break;
        case 'proj': SFX.proj(); break;
        case 'grab': SFX.whoosh(1); break;
        case 'burnout': texts.push({ t: 'BURNOUT', x: e.i ? VW - 240 : 240, y: 300, col: '#aaa', life: 80 }); break;
        case 'stun': texts.push({ t: 'STUN', x: e.i ? VW - 240 : 240, y: 300, col: '#ffe14a', life: 80 }); break;
        case 'splat': parts.push({ x, y, life: 16, max: 16, kind: 'ring', col: '#ffb030', r: 70 }); cam.shake = 14; SFX.hit(3); break;
        case 'land': for (let i = 0; i < 8; i++) parts.push({ x: SX(e.x) + (Math.random() - .5) * 60, y: GY, vx: (Math.random() - .5) * 4, vy: -Math.random() * 3, life: 24, max: 24, kind: 'dust', col: 'rgba(200,190,210,.5)', r: 10 }); SFX.thud(); break;
        case 'ko': texts.push({ t: 'K.O.', x: VW / 2, y: VH / 2 - 20, col: '#ff3a3a', life: 150, big: 2 }); flash = .6; flashCol = '#fff'; SFX.ko(); break;
        case 'timeup': texts.push({ t: 'TIME UP', x: VW / 2, y: VH / 2 - 20, col: '#fff', life: 150, big: 1.4 }); SFX.ko(); break;
        case 'round': texts.push({ t: e.final ? 'FINAL ROUND' : 'ROUND ' + e.n, x: VW / 2, y: VH / 2 - 40, col: '#fff', life: 66, big: 1.3 }); SFX.round(); break;
        case 'fight': texts.push({ t: 'FIGHT!', x: VW / 2, y: VH / 2 - 40, col: '#ffcc3a', life: 50, big: 1.8 }); SFX.fight(); break;
      }
    }
  };

  // ---------- HUD ----------
  function hud(G, info) {
    const names = info.names || [];
    for (const i of [0, 1]) {
      const f = G.p[i], C = FG.CHARS[f.ch], L = i === 0;
      const x0 = L ? 40 : VW - 40, w = 500, dir = L ? 1 : -1;
      // 体力
      const hpX = L ? x0 : x0 - w;
      cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(hpX - 4, 30, w + 8, 34);
      const r = Math.max(0, f.hp / f.maxHp);
      f._red = f._red == null ? r : (f.combo || f.st === 'fall' || f.st === 'cin' ? f._red : Math.max(r, f._red - .006));
      if (f._red < r) f._red = r;
      cx.fillStyle = '#d02a2a'; cx.fillRect(L ? hpX : hpX + w * (1 - f._red), 34, w * f._red, 26);
      const g = cx.createLinearGradient(0, 34, 0, 60); g.addColorStop(0, r < .25 ? '#ff7a3a' : '#ffe86a'); g.addColorStop(1, r < .25 ? '#d0401a' : '#e0a81a');
      cx.fillStyle = g; cx.fillRect(L ? hpX : hpX + w * (1 - r), 34, w * r, 26);
      // ドライブゲージ（6本）
      const dw = 330, dx = L ? x0 + w - dw : x0 - w, seg = dw / 6;
      for (let k = 0; k < 6; k++) {
        const fill = Math.max(0, Math.min(1, f.drive / 10000 - (L ? 5 - k : k)));
        const sx = dx + k * seg;
        cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(sx, 70, seg - 4, 12);
        cx.fillStyle = f.burn ? '#6a6a6a' : fill >= 1 ? '#3aff8a' : '#1aa860';
        if (L) cx.fillRect(sx + (seg - 4) * (1 - fill), 70, (seg - 4) * fill, 12); else cx.fillRect(sx, 70, (seg - 4) * fill, 12);
      }
      if (f.burn) { cx.fillStyle = '#ccc'; cx.font = '900 14px sans-serif'; cx.textAlign = L ? 'right' : 'left'; cx.fillText('BURNOUT', L ? dx - 8 : dx + dw + 8, 82); }
      // 名前
      cx.fillStyle = '#fff'; cx.font = '900 22px "Bebas Neue", "Noto Sans JP", sans-serif'; cx.textAlign = L ? 'left' : 'right';
      cx.fillText(C.en + (names[i] ? '  ' + names[i] : ''), L ? x0 : x0, 106);
      // ラウンドの勝ち
      for (let k = 0; k < G.opt.rounds; k++) { cx.fillStyle = G.wins[i] > k ? '#ffcc3a' : 'rgba(255,255,255,.2)'; cx.beginPath(); cx.arc(L ? x0 + w - 12 - k * 22 : x0 - w + 12 + k * 22, 106, 7, 0, 7); cx.fill(); }
      // SAゲージ
      const sw = 300, sx = L ? 40 : VW - 40 - sw, lv = Math.floor(f.sa / 10000);
      cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(sx - 4, VH - 44, sw + 8, 22);
      for (let k = 0; k < 3; k++) {
        const fill = Math.max(0, Math.min(1, f.sa / 10000 - k)), bx = sx + k * (sw / 3);
        cx.fillStyle = fill >= 1 ? ['#3ab0ff', '#a05aff', '#ffcc3a'][k] : '#2a4a7a';
        cx.fillRect(bx + 2, VH - 40, (sw / 3 - 4) * fill, 14);
      }
      cx.fillStyle = '#fff'; cx.font = '900 34px "Bebas Neue", sans-serif'; cx.textAlign = L ? 'left' : 'right';
      cx.fillText(lv, L ? sx + sw + 18 : sx - 18, VH - 20);
      // コンボ
      const v = G.p[1 - i];
      if (v.combo >= 2 && G.f - v.lastHit < 70) {
        cx.textAlign = L ? 'left' : 'right'; cx.fillStyle = '#ffcc3a'; cx.font = '900 46px "Bebas Neue", sans-serif';
        cx.fillText(v.combo + ' HITS', L ? 250 : VW - 250, 220);
        cx.fillStyle = '#fff'; cx.font = '700 20px sans-serif'; cx.fillText(v.cdmg + ' DAMAGE', L ? 250 : VW - 250, 246);
      }
    }
    // タイマー
    cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(VW / 2 - 44, 22, 88, 64);
    cx.fillStyle = '#fff'; cx.textAlign = 'center'; cx.font = '900 56px "Bebas Neue", sans-serif';
    cx.fillText(G.opt.training ? '∞' : Math.ceil(G.timer / 60), VW / 2, 76);
  }

  // ---------- 1フレーム描く ----------
  R.init = function (canvas) { cv = canvas; cx = cv.getContext('2d'); cv.width = VW; cv.height = VH; };
  R.reset = function () { parts = []; texts = []; trails = [[], []]; superBanner = null; flash = 0; };
  R.draw = function (G, info = {}) {
    const [a, b] = G.p;
    let tx = (a.x + b.x) / 2; tx = Math.max(FG.STAGE.VIEW / 2, Math.min(FG.STAGE.W - FG.STAGE.VIEW / 2, tx));
    cam.x += (tx - cam.x) * .2;
    const ty = Math.max(0, Math.max(a.y, b.y) - 150) * .7; cam.y += (ty - cam.y) * .15;
    cx.save();
    if (cam.shake > .3) { cx.translate((Math.random() - .5) * cam.shake, (Math.random() - .5) * cam.shake); cam.shake *= .85; }
    cx.fillStyle = '#0d0b24'; cx.fillRect(0, 0, VW, VH);
    cx.translate(0, cam.y * K);
    drawStage(G);
    // 必殺の暗転
    if (G.freeze > 0 || G.cin) {
      cx.fillStyle = 'rgba(0,0,10,.62)'; cx.fillRect(0, -400, VW, VH + 400);
      if (G.cin) { const c = FG.CHARS[G.p[G.cin.a].ch].colors.aura; cx.globalAlpha = .25 + Math.sin(G.cin.t * .5) * .1; cx.fillStyle = c; cx.fillRect(0, -400, VW, VH + 400); cx.globalAlpha = 1;
        for (let i = 0; i < 14; i++) { cx.strokeStyle = 'rgba(255,255,255,.25)'; cx.lineWidth = 2; const ang = Math.random() * 7; cx.beginPath(); cx.moveTo(VW / 2 + Math.cos(ang) * 200, VH / 2 + Math.sin(ang) * 200); cx.lineTo(VW / 2 + Math.cos(ang) * 900, VH / 2 + Math.sin(ang) * 900); cx.stroke(); } }
    }
    // 残像
    for (const i of [0, 1]) { trails[i] = trails[i].filter(t => (t.a -= .05) > 0); for (const t of trails[i]) { cx.fillStyle = `rgba(90,255,170,${t.a * .35})`; cx.beginPath(); cx.ellipse(SX(t.x), SY(t.y) - 140, 30, 90, 0, 0, 7); cx.fill(); } }
    // 人形（前に出ている方をあとで描く）
    const order = (a.st === 'move' || a.st === 'throwing') && b.st !== 'move' ? [b, a] : [a, b];
    for (const f of order) drawFighter(G, f);
    for (const p of G.proj) drawProj(G, p);
    // 当たり判定の表示（トレーニング）
    if (R.opts.boxes) {
      for (const f of G.p) {
        for (const h of FG.hurtBoxes(f)) { cx.strokeStyle = 'rgba(80,160,255,.9)'; cx.lineWidth = 2; cx.strokeRect(SX(h[0]), SY(h[3]), (h[2] - h[0]) * K, (h[3] - h[1]) * K); }
        for (const h of FG.hitBoxes(f)) { cx.fillStyle = 'rgba(255,40,60,.35)'; cx.fillRect(SX(h[0]), SY(h[3]), (h[2] - h[0]) * K, (h[3] - h[1]) * K); }
      }
      for (const p of G.proj) { cx.fillStyle = 'rgba(255,40,60,.35)'; cx.fillRect(SX(p.x - p.w), SY(p.y + p.h), p.w * 2 * K, p.h * 2 * K); }
    }
    // 粒
    parts = parts.filter(p => p.life-- > 0);
    for (const p of parts) {
      const k = p.life / p.max;
      if (p.kind === 'ring') { cx.strokeStyle = p.col; cx.globalAlpha = k; cx.lineWidth = 6 * k + 1; cx.beginPath(); cx.arc(p.x, p.y, p.r * (1.6 - k), 0, 7); cx.stroke(); cx.globalAlpha = 1; continue; }
      p.x += p.vx; p.y += p.vy; if (p.kind === 'spark') { p.vx *= .88; p.vy *= .88; } if (p.kind === 'ember') p.vy -= .05; if (p.kind === 'dust') p.r += .6;
      cx.globalAlpha = k; cx.fillStyle = p.col;
      if (p.kind === 'spark') { cx.strokeStyle = p.col; cx.lineWidth = p.r; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5); cx.stroke(); }
      else { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7); cx.fill(); }
      cx.globalAlpha = 1;
    }
    cx.restore();
    hud(G, info);
    // SAの名前
    if (superBanner) {
      const s = superBanner; s.t++;
      const C = FG.CHARS[G.p[s.i].ch], L = s.i === 0, k = Math.min(1, s.t / 8), out = s.t > 50 ? (s.t - 50) / 10 : 0;
      cx.globalAlpha = 1 - out;
      const g = cx.createLinearGradient(0, 300, 0, 400); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.fillRect(0, 290, VW, 120);
      cx.fillStyle = C.colors.aura; cx.font = '900 20px "Bebas Neue", sans-serif'; cx.textAlign = L ? 'left' : 'right';
      cx.fillText('SUPER ART LV' + s.lv, L ? 80 - (1 - k) * 200 : VW - 80 + (1 - k) * 200, 330);
      cx.fillStyle = '#fff'; cx.font = '900 58px "Noto Sans JP", sans-serif';
      cx.fillText(s.nm, L ? 80 - (1 - k) * 300 : VW - 80 + (1 - k) * 300, 390);
      cx.globalAlpha = 1;
      if (s.t > 60) superBanner = null;
    }
    // 文字
    texts = texts.filter(t => t.life-- > 0);
    for (const t of texts) {
      const big = t.big || 1, k = Math.min(1, (t.max = t.max || t.life + 1, (t.max - t.life) / 6));
      cx.save(); cx.textAlign = 'center'; cx.globalAlpha = Math.min(1, t.life / 12);
      cx.font = `900 ${Math.round(42 * big * (1.4 - .4 * k))}px "Bebas Neue", "Noto Sans JP", sans-serif`;
      cx.lineWidth = 8; cx.strokeStyle = '#000'; cx.strokeText(t.t, t.x, t.y); cx.fillStyle = t.col; cx.fillText(t.t, t.x, t.y);
      cx.restore();
    }
    if (flash > .01) { cx.globalAlpha = flash; cx.fillStyle = flashCol; cx.fillRect(0, 0, VW, VH); cx.globalAlpha = 1; flash *= .82; }
    if (info.after) info.after(cx, { VW, VH, SX, SY, K });
  };
  R.size = { VW, VH, GY, K };
  // キャラ選択の見本（構えのポーズ）
  R.preview = function (canvas, ch, t) {
    const save = cx, saveCam = cam.x, c2 = canvas.getContext('2d');
    cx = c2; cam.x = 700;
    c2.setTransform(1, 0, 0, 1, 0, 0); c2.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.height / 330; c2.setTransform(s, 0, 0, s, canvas.width / 2 - 640 * s - 20 * s, canvas.height * .96 - GY * s);
    const f = { i: 0, ch, x: 700, y: 0, face: 1, st: 'idle', t, hp: 1, maxHp: 1, burn: 0, mv: null, rushB: 0 };
    drawFighter({ f: t, phase: 'fight', p: [f, f] }, f);
    c2.setTransform(1, 0, 0, 1, 0, 0);
    cx = save; cam.x = saveCam; trails = [[], []];
  };

  // ---------- 効果音（WebAudio） ----------
  let ac = null, vol = .5;
  function A() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } return ac; }
  function noise(t, dur, f0, f1, v, type = 'bandpass') {
    const a = A(); if (!a) return;
    const len = a.sampleRate * dur, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; fl.type = type; fl.frequency.setValueAtTime(f0, a.currentTime + t); fl.frequency.exponentialRampToValueAtTime(f1, a.currentTime + t + dur);
    g.gain.value = v * vol; s.connect(fl).connect(g).connect(a.destination); s.start(a.currentTime + t);
  }
  function tone(t, dur, f0, f1, v, type = 'sine') {
    const a = A(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, a.currentTime + t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), a.currentTime + t + dur);
    g.gain.setValueAtTime(v * vol, a.currentTime + t); g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + t + dur);
    o.connect(g).connect(a.destination); o.start(a.currentTime + t); o.stop(a.currentTime + t + dur + .02);
  }
  const SFX = FG.SFX = {
    unlock() { const a = A(); if (a && a.state === 'suspended') a.resume(); },
    setVol(v) { vol = v; },
    hit(s) { noise(0, .08 + s * .04, 2500, 300, .5 + s * .15, 'lowpass'); tone(0, .12 + s * .05, 160 - s * 20, 40, .5 + s * .1); },
    block() { noise(0, .06, 4000, 1500, .35, 'highpass'); tone(0, .05, 900, 600, .12, 'square'); },
    parry(p) { tone(0, .25, 1400, 1800, .25, 'triangle'); if (p) tone(.05, .4, 2100, 2600, .2, 'triangle'); },
    whoosh(s) { noise(0, .1 + s * .04, 800, 3000, .12 + s * .05); },
    proj() { noise(0, .3, 600, 200, .35, 'lowpass'); tone(0, .3, 220, 80, .2, 'sawtooth'); },
    super() { tone(0, .5, 300, 1200, .25, 'sawtooth'); noise(0, .6, 200, 4000, .3); },
    di() { tone(0, .4, 90, 60, .4, 'square'); noise(0, .4, 300, 100, .3, 'lowpass'); },
    rush() { noise(0, .25, 1500, 400, .25); },
    thud() { tone(0, .2, 90, 40, .45); noise(0, .15, 400, 100, .3, 'lowpass'); },
    ko() { tone(0, 1, 200, 40, .5, 'sawtooth'); noise(0, .8, 1500, 100, .5, 'lowpass'); },
    round() { tone(0, .15, 660, 660, .2, 'square'); },
    fight() { tone(0, .1, 880, 880, .25, 'square'); tone(.1, .3, 1320, 1320, .25, 'square'); },
  };
})();
