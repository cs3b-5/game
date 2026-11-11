// =============================================================
//  けものの星：BGM（音源ファイルなし。WebAudio でその場で演奏する）
//  shop   … 夜祭り（ヨナ抜きの和音階・ゆったり）：ショップ・図鑑
//  battle … 札合わせ（都節の音階・太鼓で速め）：バトル
//  使い方：BGM.start(AudioContext) → BGM.play('shop' | 'battle') / BGM.setOn(true/false)
// =============================================================
(function (global) {
  const _ = null;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // ---- 曲（8分音符を1マス、1小節8マス） ----
  const SONGS = {
    shop: {
      bpm: 84,
      // 笛（メロディ）
      lead: [
        81, _, _, 79, 76, _, 74, _,   76, _, 79, _, 81, _, _, _,
        83, _, 81, 79, 76, _, 79, _,  81, _, _, _, _, _, _, _,
        86, _, 83, 81, 79, _, 81, _,  79, _, 76, _, 74, _, 76, _,
        79, _, 81, _, 76, 74, 76, _,  74, _, _, _, _, _, _, _,
      ],
      // 小節ごとの和音（根音）：琴のアルペジオとベースに使う
      chords: [62, 64, 67, 69, 71, 67, 64, 62],
      arp: [0, 7, 12, 7, 0, 7, 12, 14],   // 根音からの半音
      bassSteps: [0, 4],
      taiko: 'D.......',                   // D=どん K=か
      taikoAlt: 'D.....K.',
      kane: [4],                           // 偶数小節のこのマスで鐘
      leadInst: 'fue', leadVol: .055, arpVol: .028, bassVol: .05, drumVol: .5,
    },
    battle: {
      bpm: 140,
      lead: [
        81, _, _, 76, 77, _, 76, 74,  76, _, _, _, 69, _, 74, _,
        77, _, 76, _, 74, _, 70, _,   69, _, _, _, _, _, _, _,
        74, _, 76, 77, 81, _, 77, _,  76, _, 74, _, 76, _, 77, _,
        76, _, 74, _, 70, _, 69, _,   69, _, _, _, 76, _, 81, _,
      ],
      chords: [57, 57, 58, 57, 62, 64, 58, 57],
      arp: [0, 7, 12, 7, 8, 7, 5, 7],
      bassSteps: [0, 2, 4, 6],
      taiko: 'D..DK.DK',
      taikoAlt: 'D..DK.DD',
      kane: [],
      leadInst: 'fueHard', leadVol: .05, arpVol: .03, bassVol: .06, drumVol: .7,
    },
  };

  let ac = null, bus = null, comp = null, timer = null, on = true, cur = null, want = null, step = 0, nextT = 0, noiseBuf = null;

  function noise() {
    if (noiseBuf) return noiseBuf;
    const len = ac.sampleRate * .5; noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
    const a = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) a[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function env(g, t, v, a, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }

  // ---- 楽器 ----
  const INST = {
    // 琴：はじいた音
    koto(t, m, v) {
      const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'triangle'; o2.type = 'sawtooth'; o.frequency.value = mtof(m); o2.frequency.value = mtof(m) * 1.003;
      const g2 = ac.createGain(); g2.gain.value = .25;
      f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(700, t + .6);
      env(g, t, v, .004, .9);
      o.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(bus);
      o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + 1);
    },
    // 笛：やわらかい音にビブラート
    fue(t, m, v, dur, hard) {
      const o = ac.createOscillator(), lfo = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = hard ? 'triangle' : 'sine'; o.frequency.value = mtof(m);
      lfo.frequency.value = 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(mtof(m) * .012, t + Math.min(.25, dur * .6));
      lfo.connect(lg).connect(o.frequency);
      f.type = 'lowpass'; f.frequency.value = hard ? 3500 : 2600;
      const end = t + Math.max(.12, dur - .02);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (hard ? .015 : .05)); g.gain.setValueAtTime(v * .85, end - .05); g.gain.exponentialRampToValueAtTime(.0001, end + .08);
      o.connect(f).connect(g).connect(bus);
      o.start(t); lfo.start(t); o.stop(end + .1); lfo.stop(end + .1);
      // 息の音（少しだけ）
      const n = ac.createBufferSource(), nf = ac.createBiquadFilter(), ng = ac.createGain();
      n.buffer = noise(); nf.type = 'bandpass'; nf.frequency.value = mtof(m) * 2; nf.Q.value = 2; env(ng, t, v * .25, .02, .12);
      n.connect(nf).connect(ng).connect(bus); n.start(t); n.stop(t + .2);
    },
    fueHard(t, m, v, dur) { INST.fue(t, m, v, dur, true); },
    bass(t, m, v) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = mtof(m - 24);
      env(g, t, v, .01, .45); o.connect(g).connect(bus); o.start(t); o.stop(t + .5);
    },
    // 太鼓：どん（低い）・か（ふちを打つ）
    don(t, v) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .22);
      env(g, t, .22 * v, .005, .3); o.connect(g).connect(bus); o.start(t); o.stop(t + .35);
      const n = ac.createBufferSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
      n.buffer = noise(); f.type = 'lowpass'; f.frequency.value = 500; env(ng, t, .06 * v, .002, .08);
      n.connect(f).connect(ng).connect(bus); n.start(t); n.stop(t + .12);
    },
    ka(t, v) {
      const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      n.buffer = noise(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 3; env(g, t, .09 * v, .001, .05);
      n.connect(f).connect(g).connect(bus); n.start(t); n.stop(t + .08);
    },
    // 鐘（チリン）
    kane(t, v) {
      for (const [fr, vv] of [[1760, 1], [2640, .5], [3520, .25]]) {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine'; o.frequency.value = fr; env(g, t, .018 * v * vv, .002, .9);
        o.connect(g).connect(bus); o.start(t); o.stop(t + 1);
      }
    },
  };

  // ---- 1マス分を予約 ----
  function playStep(s, i, t) {
    const len = s.lead.length, k = i % len, bar = Math.floor(k / 8), pos = k % 8, stepDur = 60 / s.bpm / 2;
    const m = s.lead[k];
    if (m != null) { let n = 1; while (n < 8 && s.lead[(k + n) % len] == null) n++; INST[s.leadInst](t, m, s.leadVol, n * stepDur); }
    const root = s.chords[bar % s.chords.length];
    INST.koto(t, root + s.arp[pos], s.arpVol * (pos === 0 ? 1.3 : 1));
    if (s.bassSteps.includes(pos)) INST.bass(t, root, s.bassVol);
    const pat = (bar % 2 ? s.taikoAlt : s.taiko)[pos];
    if (pat === 'D') INST.don(t, s.drumVol); else if (pat === 'K') INST.ka(t, s.drumVol);
    if (bar % 2 === 1 && s.kane.includes(pos)) INST.kane(t, 1);
  }
  function tick() {
    if (!ac || !cur) return;
    const s = SONGS[cur], dt = 60 / s.bpm / 2;
    if (nextT < ac.currentTime) nextT = ac.currentTime + .05;
    while (nextT < ac.currentTime + .2) { playStep(s, step, nextT); step++; nextT += dt; }
  }
  function fadeTo(v, sec) { if (!bus) return; const t = ac.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(bus.gain.value, t); bus.gain.linearRampToValueAtTime(v, t + sec); }
  const VOL = .9;

  const BGM = {
    get on() { return on; },
    get playing() { return ac && on ? cur : null; },
    start(ctx) {
      if (ac || !ctx) return;
      ac = ctx;
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
      bus = ac.createGain(); bus.gain.value = 0;
      bus.connect(comp).connect(ac.destination);
      timer = setInterval(tick, 40);
      if (want) BGM.play(want, true);
    },
    play(name, force) {
      want = name;
      if (!ac || !on || !SONGS[name]) return;
      if (cur === name && !force) return;
      const swap = () => { cur = name; step = 0; nextT = ac.currentTime + .08; fadeTo(VOL, .8); };
      if (cur && !force) { fadeTo(0, .5); cur = null; setTimeout(swap, 550); } else swap();
    },
    stop() { if (!ac) return; fadeTo(0, .4); setTimeout(() => { if (!on) cur = null; }, 450); },
    setOn(v) { on = !!v; if (!ac) return; if (on) { const w = want; cur = null; BGM.play(w || 'shop', true); } else BGM.stop(); },
  };
  global.BGM = BGM;
})(window);
