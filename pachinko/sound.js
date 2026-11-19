// =============================================================
//  夜祭り金魚：音（Web Audio で全部その場で作る。音のファイルなし）
//  ・効果音は 2,000〜4,000Hz あたりに山を作り、ベルの倍音を重ねる
//  ・BGM はモードごと（通常／夜店チャンス／花火RUSH／大輪RUSH／大当たり）
//  ・リーチ中は音程がだんだん上がる（無限音階っぽいライザー）
//  ・激アツの直前は完全な無音（silence）
// =============================================================
(function (root) {
'use strict';
let AC = null, master, comp, seBus, bgmBus, wet;
const vol = { se: .8, bgm: .6, mute: false, duck: 1, silent: false };
const rnd = Math.random;

function init() {
  try {
    if (!AC) {
      AC = new (window.AudioContext || window.webkitAudioContext)();
      master = AC.createGain();
      comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .15;
      seBus = AC.createGain(); bgmBus = AC.createGain();
      seBus.connect(comp); bgmBus.connect(comp); comp.connect(master); master.connect(AC.destination);
      // 残響（ホールっぽい広がり）
      const len = AC.sampleRate * 1.6, ir = AC.createBuffer(2, len, AC.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      const conv = AC.createConvolver(); conv.buffer = ir; wet = AC.createGain(); wet.gain.value = .22;
      seBus.connect(conv); conv.connect(wet); wet.connect(comp);
      apply(true);
      setInterval(sched, 25);
    }
    if (AC.state === 'suspended') AC.resume();
  } catch (e) {}
}
function apply(now) {
  if (!AC) return;
  const t = AC.currentTime, k = now ? .001 : .04;
  master.gain.setTargetAtTime(vol.mute ? 0 : 1, t, k);
  seBus.gain.setTargetAtTime(vol.silent ? 0 : vol.se, t, vol.silent ? .008 : k);
  bgmBus.gain.setTargetAtTime(vol.silent ? 0 : vol.bgm * .5 * vol.duck, t, vol.silent ? .008 : .12);
}
function set(o) { Object.assign(vol, o); apply(); }
// 無音の窓：on で一瞬で無音、off ですぐ戻す
function silence(on) { if (vol.silent === on) return; vol.silent = on; if (!AC) return; if (!on) { const t = AC.currentTime; seBus.gain.cancelScheduledValues(t); seBus.gain.setValueAtTime(vol.se, t); } apply(); }
const live = () => AC && !vol.mute;

// ---------------- 部品 ----------------
function osc(f, d, type = 'sine', v = .05, o = {}) {
  if (!live()) return;
  const t = (o.at || AC.currentTime) + (o.delay || 0), os = AC.createOscillator(), g = AC.createGain();
  os.type = type; os.frequency.setValueAtTime(f, t);
  if (o.to) os.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + (o.slideT || d));
  if (o.vib) { const l = AC.createOscillator(), lg = AC.createGain(); l.frequency.value = o.vib; lg.gain.value = f * .012; l.connect(lg).connect(os.frequency); l.start(t); l.stop(t + d + .05); }
  const att = o.att || .004;
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + att); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  let out = os;
  if (o.lp || o.bp || o.hp) { const fl = AC.createBiquadFilter(); fl.type = o.lp ? 'lowpass' : o.bp ? 'bandpass' : 'highpass'; fl.frequency.value = o.lp || o.bp || o.hp; fl.Q.value = o.q || .8; out.connect(fl); out = fl; }
  out.connect(g).connect(o.bus || seBus); os.start(t); os.stop(t + d + .05);
}
function noise(d = .05, v = .03, o = {}) {
  if (!live()) return;
  const t = (o.at || AC.currentTime) + (o.delay || 0);
  const n = Math.max(1, AC.sampleRate * d | 0), buf = AC.createBuffer(1, n, AC.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < n; i++) ch[i] = (rnd() * 2 - 1) * Math.pow(1 - i / n, o.pow || 1);
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  f.type = o.lp ? 'lowpass' : o.bp ? 'bandpass' : 'highpass'; f.frequency.value = o.lp || o.bp || o.hp || 3000; f.Q.value = o.q || .7;
  g.gain.value = v; s.buffer = buf; s.connect(f).connect(g).connect(o.bus || seBus); s.start(t);
}
// ベル（金属の倍音：1, 2.76, 5.4, 8.93 倍）
function bell(f, d = 1.2, v = .04, o = {}) {
  [[1, 1], [2.76, .5], [5.4, .26], [8.93, .12]].forEach(([m, a], i) => { if (f * m < 12000) osc(f * m, d / (1 + i * .6), 'sine', v * a, o); });
}

// ---------------- 効果音 ----------------
const SFX = {
  shot() { noise(.025, .01, { hp: 4500 }); },
  nail() { osc(2600 + rnd() * 1800, .03, 'triangle', .007); },
  heso() { osc(1318, .06, 'square', .022, { bp: 2600 }); osc(1976, .09, 'square', .022, { bp: 3000, delay: .05 }); },
  pocket() { osc(880, .06, 'square', .02); osc(1320, .08, 'square', .02, { delay: .05 }); },
  count() { osc(2093, .035, 'square', .014, { bp: 2800 }); },
  gate() { osc(2349, .05, 'sine', .016); },
  reelStop() { osc(320, .07, 'square', .028, { to: 180, lp: 1200 }); noise(.02, .02, { hp: 2500 }); },
  // キュイン：900→3,200Hzへ駆け上がる＋2〜4kHzの帯を強調＋ベルの余韻＋低い一発
  kyuin(big) {
    if (!live()) return;
    [['sawtooth', 1, .05], ['square', 1.505, .028], ['sine', 2, .035]].forEach(([ty, m, v]) => osc(900 * m, .55, ty, v, { to: 3200 * m, slideT: .22, bp: 2900, q: .9, att: .01 }));
    bell(2093, 1.6, .05, { delay: .2 }); bell(3136, 1.2, .03, { delay: .26 });
    osc(95, .35, 'sine', .16, { to: 38 });
    if (big) { bell(1568, 2.2, .05, { delay: .4 }); bell(2637, 1.8, .035, { delay: .5 }); noise(.6, .05, { bp: 3500, q: 2, delay: .2, pow: 2 }); }
  },
  // 先告知の確定音（キュインキュイン）
  kakutei() { SFX.kyuin(true); setTimeout(() => SFX.kyuin(true), 420); },
  holdUp(lv) { [0, 1, 2].forEach(i => osc(1046 * Math.pow(1.26, i + lv * .5), .1, 'square', .025, { delay: i * .06, bp: 2600 })); bell(2637, .6, .025, { delay: .18 }); },
  step(n) { osc(523 * Math.pow(1.19, n), .12, 'square', .03, { bp: 2400 }); osc(1046 * Math.pow(1.19, n), .18, 'triangle', .025, { delay: .03 }); if (n >= 4) bell(2093 * Math.pow(1.12, n - 4), .9, .04, { delay: .05 }); },
  giji(n) { osc(140, .3, 'sine', .14, { to: 60 }); noise(.12, .06, { lp: 900 }); bell(1318 * Math.pow(1.12, n), .8, .03, { delay: .03 }); },
  reach() { osc(220, .55, 'sawtooth', .035, { to: 880, lp: 2600 }); osc(440, .55, 'square', .022, { to: 1760, delay: .05, bp: 2600 }); },
  cutin(lv) { noise(.25, .06, { hp: 1200 }); osc(300, .3, 'sawtooth', .04, { to: 1800, lp: 3000 }); if (lv >= 3) bell(2349, 1.2, .05, { delay: .12 }); if (lv >= 5) SFX.kyuin(true); },
  yokoku() { for (let i = 0; i < 6; i++) osc(700 + i * 130, .08, 'triangle', .028, { delay: i * .05 }); },
  push() { osc(160, .3, 'sawtooth', .05, { to: 80, lp: 900 }); },
  pushed() { osc(1400, .1, 'square', .045, { bp: 2800 }); noise(.08, .05, { hp: 2000 }); },
  lose() { osc(330, .4, 'triangle', .035, { to: 140 }); },
  win() { const n = [523, 659, 784, 1046, 784, 1046, 1318]; n.forEach((f, i) => osc(f, .2, 'square', .035, { delay: i * .11, lp: 3200 })); osc(130, 1.2, 'sawtooth', .03, { delay: .1, lp: 800 }); bell(2093, 1.8, .04, { delay: .7 }); },
  round() { osc(659, .1, 'square', .035); osc(988, .16, 'square', .035, { delay: .1 }); },
  firework() { noise(.5, .05, { lp: 700, pow: 2 }); osc(90, .45, 'sine', .08, { to: 40 }); noise(.7, .02, { hp: 5000, delay: .15, pow: 1.5 }); },
  // ガコッ（役物が落ちる重い音）
  gako() { osc(70, .45, 'sine', .22, { to: 32 }); noise(.28, .16, { lp: 380 }); osc(190, .16, 'square', .05, { to: 90, lp: 900 }); noise(.05, .06, { hp: 3000, delay: .02 }); },
  gimmick() { SFX.gako(); osc(880, .3, 'square', .025, { to: 1320, delay: .25, bp: 2600 }); },
  chochin() { SFX.gako(); bell(1568, 1.4, .04, { delay: .1 }); bell(2349, 1.2, .03, { delay: .16 }); },
  secret() { bell(3136, 1.4, .05); bell(4186, 1.1, .03, { delay: .09 }); },
  click() { osc(1800, .02, 'square', .01); },
  lt() { SFX.gako(); setTimeout(() => SFX.kyuin(true), 120); [523, 659, 784, 1046, 1318, 1568].forEach((f, i) => bell(f * 2, 1.6, .03, { delay: .4 + i * .08 })); },
};

// ---------------- リーチのライザー（音程が上がり続ける） ----------------
let riserNodes = null;
function riser(D) {
  stopRiser();
  if (!live() || D < .5) return;
  const t = AC.currentTime, nodes = [];
  // 1オクターブずつ離れた3つの音が同時に上がる。低い音は消えていき、高い音が出てくる
  [[196, .0001, .022], [392, .02, .02], [784, .02, .0001]].forEach(([f, v0, v1], i) => {
    const o = AC.createOscillator(), g = AC.createGain(), fl = AC.createBiquadFilter();
    o.type = i === 1 ? 'sawtooth' : 'triangle'; fl.type = 'lowpass'; fl.frequency.value = 3200;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 2.2, t + D);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0001, v0 + .004), t + .4); g.gain.exponentialRampToValueAtTime(Math.max(.0001, v1), t + D);
    o.connect(fl).connect(g).connect(seBus); o.start(t); o.stop(t + D + .1); nodes.push([o, g]);
  });
  riserNodes = nodes;
}
function stopRiser() {
  if (!riserNodes || !AC) return;
  const t = AC.currentTime;
  for (const [o, g] of riserNodes) { try { g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(.0001, t, .03); o.stop(t + .2); } catch (e) {} }
  riserNodes = null;
}

// ---------------- BGM ----------------
// 陽音階（祭りっぽい）：レ ミ ソ ラ シ
const YO = [0, 2, 5, 7, 9];
const deg = (d, base = 62) => base + YO[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const R_ = null;
const PAT = {
  normal: { bpm: 96, mel: [4, R_, 5, 4, 2, R_, 3, 2, 1, R_, 2, 3, 4, R_, R_, R_, 5, R_, 6, 5, 4, R_, 3, 4, 2, R_, 1, 0, 1, R_, R_, R_] },
  jitan:  { bpm: 124, mel: [5, 6, 5, 4, 5, R_, 7, R_, 6, 5, 4, 3, 4, R_, R_, R_, 4, 5, 4, 3, 4, R_, 6, R_, 5, 4, 3, 2, 3, R_, R_, R_] },
  rush:   { bpm: 150, mel: [7, R_, 9, 7, 10, R_, 9, 7, 6, 7, R_, 5, 6, R_, 4, R_, 7, R_, 9, 10, 11, R_, 10, 9, 10, 9, 7, 6, 7, R_, R_, R_] },
  lt:     { bpm: 164, mel: [10, 11, 12, 11, 10, R_, 12, 14, 12, 11, 10, 9, 10, R_, 7, R_, 10, 11, 12, 14, 15, R_, 14, 12, 14, 12, 11, 10, 12, R_, R_, R_] },
  bonus:  { bpm: 140, mel: [5, R_, R_, 5, 7, R_, 9, R_, 10, R_, 9, 7, 9, R_, R_, R_, 7, R_, R_, 7, 9, R_, 10, R_, 12, R_, 11, 10, 12, R_, R_, R_] },
};
const BGM = { want: null, cur: null, next: 0, step: 0 };
function bgm(key) { BGM.want = key; }
function sched() {
  if (!AC) return;
  const now = AC.currentTime;
  if (BGM.want !== BGM.cur) { BGM.cur = BGM.want; BGM.step = 0; BGM.next = now + .05; }
  if (!BGM.cur || vol.mute) { BGM.next = now + .05; return; }
  const p = PAT[BGM.cur], e = 60 / p.bpm / 2;
  if (BGM.next < now - .2) BGM.next = now + .02;
  while (BGM.next < now + .14) { play(BGM.cur, p, BGM.step, BGM.next, e); BGM.next += e; BGM.step++; }
}
function play(key, p, s, t, e) {
  const o = (x = {}) => Object.assign({ at: t, bus: bgmBus }, x);
  const i = s % 32, m = p.mel[i];
  if (key === 'normal' || key === 'jitan') {
    // 太鼓（ドン・カッ）と笛
    if (i % 8 === 0) { osc(120, .4, 'sine', .3, o({ to: 52 })); noise(.06, .05, o({ lp: 600 })); }
    if (i % 8 === 5) osc(140, .25, 'sine', .16, o({ to: 60 }));
    if (i % 4 === 2) noise(.03, .05, o({ bp: 2200, q: 3 }));
    if (key === 'jitan' && i % 2 === 1) noise(.02, .025, o({ hp: 6000 }));
    if (i % 8 === 4) noise(.05, .03, o({ bp: 3800, q: 6 }));     // 鉦（チャンチキ）
    if (m !== null) { const f = hz(deg(m, 74)); osc(f, e * 1.9, 'sine', .05, o({ vib: 5.5, att: .03 })); osc(f / 2, e * 1.6, 'triangle', .018, o({ att: .02 })); }
  } else {
    const lt = key === 'lt', bon = key === 'bonus';
    if (i % 2 === 0) { osc(130, .2, 'sine', .32, o({ to: 44 })); }
    if (i % 2 === 1) noise(.025, .03, o({ hp: 7000 }));
    if (i % 8 === 4) noise(.14, .08, o({ bp: 1600, q: .8 }));
    const bass = [0, 0, 12, 0, 0, 12, 0, 12][i % 8] + [0, 5, 7, 3][Math.floor(i / 8) % 4];
    osc(hz(38 + bass), e * .9, 'sawtooth', .05, o({ lp: 700 }));
    if (m !== null) {
      const f = hz(deg(m, bon ? 62 : 62));
      osc(f, e * (bon ? 2.6 : 1.5), bon ? 'sawtooth' : 'square', bon ? .035 : .028, o({ lp: bon ? 2600 : 3400, att: .01 }));
      if (bon || lt) osc(f * 1.5, e * 1.4, 'square', .012, o({ lp: 3000 }));
    }
    if (bon && i % 8 === 0) [0, 4, 7].forEach(k => osc(hz(50 + k + [0, 5, 7, 5][Math.floor(i / 8) % 4]), e * 3, 'sawtooth', .02, o({ lp: 1800, att: .02 })));
    if (lt) osc(hz(deg(10 + (i * 3) % 7, 62)), e * .6, 'triangle', .015, o({}));
  }
}

root.Snd = { init, set, silence, SFX, riser, stopRiser, bgm, get ctx() { return AC; } };
})(this);
