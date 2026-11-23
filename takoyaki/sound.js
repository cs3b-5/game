// たこ焼きシミュレーター：音（ぜんぶ Web Audio でその場で作る。音声ファイルなし）
// ・焼ける音：ジュー（高い音のノイズ）＋パチパチ（油がはねる短い音）。量は鉄板の状態で決まる
// ・生地を流した瞬間のジュワーッ、ピックが鉄板に当たるカチッ、返すときのコロッ
// ・店の環境音（ざわざわ）、ガスの火のゴーッ
(function () {
  'use strict';
  let ctx = null, master, sfxBus, ambBus, sizzle = null, gas = null, amb = null, noiseBuf = null, brownBuf = null;
  const vol = { master: 0.8, sfx: 1, amb: 0.6 };
  let crackleRate = 0, lastCrackle = 0, sizzleLv = 0;

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = vol.master;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    ambBus = ctx.createGain(); ambBus.gain.value = vol.amb; ambBus.connect(master);
    // ノイズ（白・ブラウン）
    const len = ctx.sampleRate * 3;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    brownBuf = ctx.createBuffer(1, len, ctx.sampleRate); const e = brownBuf.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; e[i] = l * 3.5; }
    startLoops();
  }
  function noise(buf, loop) { const s = ctx.createBufferSource(); s.buffer = buf || noiseBuf; s.loop = !!loop; if (loop) s.loopStart = Math.random(); return s; }

  function startLoops() {
    // ジュー：高めのノイズを2つのフィルターで。音量はあとで変える
    {
      const src = noise(noiseBuf, true), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 2600; bp.type = 'peaking'; bp.frequency.value = 5200; bp.gain.value = 6; bp.Q.value = 0.7;
      g.gain.value = 0; lfo.frequency.value = 7.3; lg.gain.value = 0;
      lfo.connect(lg); lg.connect(g.gain);
      src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(sfxBus); src.start(); lfo.start();
      sizzle = { g, lg };
    }
    // ガスの火
    {
      const src = noise(brownBuf, true), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 380; g.gain.value = 0;
      src.connect(lp); lp.connect(g); g.connect(ambBus); src.start(); gas = { g, lp };
    }
    // 店のざわざわ：人の声っぽい帯域をゆっくりゆらす
    {
      const src = noise(brownBuf, true), bp = ctx.createBiquadFilter(), bp2 = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 0.9; bp2.type = 'bandpass'; bp2.frequency.value = 1150; bp2.Q.value = 1.4;
      lfo.frequency.value = 0.21; lg.gain.value = 0.05; lfo.connect(lg); lg.connect(g.gain); g.gain.value = 0.11;
      src.connect(bp); bp.connect(g); src.connect(bp2); bp2.connect(g); g.connect(ambBus); src.start(); lfo.start();
      amb = { g };
      ambienceLoop();
    }
  }
  // 遠くの食器の音・人の笑い声っぽい音をときどき
  function ambienceLoop() {
    if (!ctx) return;
    setTimeout(ambienceLoop, 1800 + Math.random() * 4200);
    if (document.hidden) return;
    const r = Math.random();
    if (r < 0.45) clink(0.025 + Math.random() * 0.03, ambBus);
    else if (r < 0.7) murmur();
  }
  function murmur() {
    const t = ctx.currentTime, o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; const base = 150 + Math.random() * 120; o.frequency.setValueAtTime(base, t);
    for (let k = 1; k < 5; k++) o.frequency.linearRampToValueAtTime(base * (0.85 + Math.random() * 0.4), t + k * 0.12);
    f.type = 'bandpass'; f.frequency.value = 700 + Math.random() * 500; f.Q.value = 3;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 0.05); g.gain.linearRampToValueAtTime(0, t + 0.55);
    o.connect(f); f.connect(g); g.connect(ambBus); o.start(t); o.stop(t + 0.6);
  }

  // 毎フレーム：焼け具合から音量を決める（lv 0〜1、crackle 1秒あたりのパチパチ回数、fire 1〜5）
  function update(lv, crackle, fire, dt) {
    if (!ctx || ctx.state !== 'running') return;
    const t = ctx.currentTime;
    sizzleLv += (lv - sizzleLv) * Math.min(1, dt * 3);
    sizzle.g.gain.setTargetAtTime(0.09 * sizzleLv, t, 0.08); sizzle.lg.gain.setTargetAtTime(0.012 * sizzleLv, t, 0.1);
    gas.g.gain.setTargetAtTime(0.03 + fire * 0.018, t, 0.3); gas.lp.frequency.setTargetAtTime(260 + fire * 50, t, 0.3);
    crackleRate = crackle;
    // パチパチ：ポアソンっぽく
    let n = crackleRate * dt; while (n > 0) { if (Math.random() < n) pop(0.3 + Math.random() * 0.7); n -= 1; }
  }
  function pop(strength) {
    const t = ctx.currentTime + Math.random() * 0.02, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 2500 + Math.random() * 6000; f.Q.value = 1.5 + Math.random() * 3;
    const a = 0.06 * strength; g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.012 + Math.random() * 0.03);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 2); s.stop(t + 0.06);
  }

  // ---------- 効果音 ----------
  // ジュワーッ（生地が熱い鉄板に当たった）
  function sear(strength) {
    if (!ctx) return; strength = Math.min(1.2, strength || 1);
    const t = ctx.currentTime, s = noise(), hp = ctx.createBiquadFilter(), pk = ctx.createBiquadFilter(), g = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.setValueAtTime(1500, t); hp.frequency.exponentialRampToValueAtTime(3200, t + 1.2);
    pk.type = 'peaking'; pk.frequency.value = 4000; pk.gain.value = 8;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * strength, t + 0.03); g.gain.exponentialRampToValueAtTime(0.04 * strength, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0008, t + 1.6);
    s.connect(hp); hp.connect(pk); pk.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 1.2); s.stop(t + 1.7);
    for (let k = 0; k < 10 * strength; k++) setTimeout(() => pop(0.8 + Math.random() * 0.6), Math.random() * 500);
  }
  // 生地を流しているあいだの「とろとろ」音
  let pourNode = null;
  function pourOn(on) {
    if (!ctx) return;
    if (on && !pourNode) {
      const s = noise(brownBuf, true), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2.5; lfo.frequency.value = 11; lg.gain.value = 350;
      lfo.connect(lg); lg.connect(f.frequency); g.gain.value = 0; g.gain.setTargetAtTime(0.16, ctx.currentTime, 0.05);
      s.connect(f); f.connect(g); g.connect(sfxBus); s.start(); lfo.start(); pourNode = { s, g, lfo };
    } else if (!on && pourNode) {
      const p = pourNode; pourNode = null; p.g.gain.setTargetAtTime(0, ctx.currentTime, 0.04); setTimeout(() => { try { p.s.stop(); p.lfo.stop(); } catch (e) {} }, 300);
    }
  }
  // 金属のカチッ（ピックが鉄板に当たる）
  function clink(a, bus) {
    if (!ctx) return; a = a ?? 0.1;
    const t = ctx.currentTime, g = ctx.createGain(); g.connect(bus || sfxBus);
    g.gain.setValueAtTime(a, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
    const base = 2400 + Math.random() * 900;
    for (const m of [1, 1.51, 2.33, 3.07]) { const o = ctx.createOscillator(), og = ctx.createGain(); o.frequency.value = base * m; og.gain.value = 1 / (m * 1.6); o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.36); }
    const s = noise(), hp = ctx.createBiquadFilter(), ng = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 5000;
    ng.gain.setValueAtTime(a * 1.5, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.015); s.connect(hp); hp.connect(ng); ng.connect(bus || sfxBus); s.start(t, Math.random()); s.stop(t + 0.03);
  }
  function tick() { // ピックのコツッ（軽め）
    if (!ctx) return; clink(0.035);
  }
  // 返すときのコロッ
  function roll(good) {
    if (!ctx) return;
    const t = ctx.currentTime;
    clink(0.05);
    const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.setValueAtTime(good ? 650 : 400, t); f.frequency.exponentialRampToValueAtTime(good ? 280 : 200, t + 0.12); f.Q.value = 3;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.2);
    // ひっくり返った面がジュッ
    setTimeout(() => sear(0.35), 60);
  }
  // くずれた・くっついた（ベチャ）
  function squish() {
    if (!ctx) return; const t = ctx.currentTime, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(250, t + 0.25);
    g.gain.setValueAtTime(0.3, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.32); setTimeout(() => sear(0.5), 50);
  }
  // 切れ目を入れる（スッ）
  let lastCut = 0;
  function cut() {
    if (!ctx) return; const now = performance.now(); if (now - lastCut < 60) return; lastCut = now;
    const t = ctx.currentTime, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 3500; f.Q.value = 1.2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.1);
    if (Math.random() < 0.5) clink(0.025);
  }
  // 油をひく（ハケのサッサッ）
  let lastBrush = 0;
  function brush() {
    if (!ctx) return; const now = performance.now(); if (now - lastBrush < 110) return; lastBrush = now;
    const t = ctx.currentTime, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 800; f.Q.value = 0.8;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.16);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.18);
    for (let k = 0; k < 3; k++) setTimeout(() => pop(0.5), Math.random() * 200);
  }
  // パラパラ（天かす・ねぎ・青のり）
  let lastSpr = 0;
  function sprinkle() {
    if (!ctx) return; const now = performance.now(); if (now - lastSpr < 90) return; lastSpr = now;
    for (let k = 0; k < 6; k++) setTimeout(() => {
      const t = ctx.currentTime, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.frequency.value = 3000 + Math.random() * 4000; f.Q.value = 4;
      g.gain.setValueAtTime(0.03 + Math.random() * 0.03, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.02);
      s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random() * 2); s.stop(t + 0.03);
    }, Math.random() * 120);
  }
  // たこを入れる（ポチャ）
  function plop() {
    if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(320, t); o.frequency.exponentialRampToValueAtTime(900, t + 0.06);
    g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.1); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.12);
    setTimeout(() => sear(0.2), 30);
  }
  // ソース・マヨ（ブチュッ）
  function squeeze() {
    if (!ctx) return; const t = ctx.currentTime, s = noise(brownBuf), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'bandpass'; f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(900, t + 0.3); f.Q.value = 4;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.35, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.4);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.42);
  }
  // 舟皿に置く（コトッ）
  function place() {
    if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), s = noise(), f = ctx.createBiquadFilter(), ng = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(130, t + 0.08);
    g.gain.setValueAtTime(0.2, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.12); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.14);
    f.type = 'lowpass'; f.frequency.value = 1400; ng.gain.setValueAtTime(0.12, t); ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.05);
    s.connect(f); f.connect(ng); ng.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.06);
  }
  // 食べる（ハフハフ…は無理なので、パクッ＋いい音／いやな音）
  function eat(good) {
    if (!ctx) return; const t = ctx.currentTime;
    const s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.09);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.1);
    const notes = good > 0 ? [784, 988, 1319] : good < 0 ? [330, 262] : [660];
    notes.forEach((fr, k) => { const o = ctx.createOscillator(), og = ctx.createGain(), tt = t + 0.1 + k * 0.08; o.type = good < 0 ? 'sawtooth' : 'triangle'; o.frequency.value = fr; og.gain.setValueAtTime(0.0001, tt); og.gain.linearRampToValueAtTime(good < 0 ? 0.05 : 0.09, tt + 0.01); og.gain.exponentialRampToValueAtTime(0.0005, tt + 0.25); o.connect(og); og.connect(sfxBus); o.start(tt); o.stop(tt + 0.27); });
  }
  // お店のベル（注文が来た・お渡し）
  function bell() {
    if (!ctx) return; const t = ctx.currentTime;
    [[1318, 0], [1047, 0.16]].forEach(([fr, d]) => { for (const m of [1, 2.76, 5.4]) { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = fr * m; g.gain.setValueAtTime(0.07 / m, t + d); g.gain.exponentialRampToValueAtTime(0.0005, t + d + 1.2 / m); o.connect(g); g.connect(sfxBus); o.start(t + d); o.stop(t + d + 1.3); } });
  }
  function ui() { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 880; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.07); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.08); }
  function beep(hi) { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = hi ? 1320 : 660; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0005, t + (hi ? 0.5 : 0.18)); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 0.55); }
  function whistle() { if (!ctx) return; const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.frequency.value = 2100; l.frequency.value = 28; lg.gain.value = 90; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.08, t + 0.03); g.gain.setValueAtTime(0.08, t + 0.7); g.gain.linearRampToValueAtTime(0.0001, t + 0.8); o.connect(g); g.connect(sfxBus); o.start(t); l.start(t); o.stop(t + 0.85); l.stop(t + 0.85); }
  function fireClick(up) { if (!ctx) return; const t = ctx.currentTime, s = noise(), f = ctx.createBiquadFilter(), g = ctx.createGain(); f.type = 'bandpass'; f.frequency.value = up ? 1200 : 700; f.Q.value = 2; g.gain.setValueAtTime(0.18, t); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.05); s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t, Math.random()); s.stop(t + 0.06); if (up) { const s2 = noise(brownBuf), f2 = ctx.createBiquadFilter(), g2 = ctx.createGain(); f2.type = 'lowpass'; f2.frequency.value = 500; g2.gain.setValueAtTime(0.0001, t); g2.gain.linearRampToValueAtTime(0.25, t + 0.05); g2.gain.exponentialRampToValueAtTime(0.0005, t + 0.5); s2.connect(f2); f2.connect(g2); g2.connect(sfxBus); s2.start(t, Math.random()); s2.stop(t + 0.55); } }

  function setVol(k, v) { vol[k] = v; if (!ctx) return; if (k === 'master') master.gain.value = v; if (k === 'sfx') sfxBus.gain.value = v; if (k === 'amb') ambBus.gain.value = v; }
  window.TakoSound = { init, update, sear, pourOn, clink, tick, roll, squish, cut, brush, sprinkle, plop, squeeze, place, eat, bell, ui, beep, whistle, fireClick, setVol, get ctx() { return ctx; } };
})();
