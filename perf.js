// GAMES 共通：裏で動いているときに重くならないようにする（見た目と遊び方はそのまま）
// どのゲームも <script src="../perf.js"></script> を最初に読むだけ。
//  1) 描画は最大 60fps（144Hz などのモニターで必要以上に描かない）
//  2) ほかのウィンドウを操作しているあいだ（このページにフォーカスがない）は 30fps
//  3) タブが裏に回ったら音（AudioContext）を止めて、表に戻ったら再開
(function () {
  if (window.__gamesPerf) return; window.__gamesPerf = true;
  const native = window.requestAnimationFrame && window.requestAnimationFrame.bind(window);
  if (!native) return;
  let queue = new Map(), id = 0, scheduled = false, last = 0;
  const FOCUS_FPS = 60, BLUR_FPS = 30;
  let focused = document.hasFocus ? document.hasFocus() : true;
  addEventListener('focus', () => { focused = true; }); addEventListener('blur', () => { focused = false; });
  // iframe の中（claude.ai など）はフォーカスがとれないことがあるので、操作があったら「使っている」とみなす
  const touch = () => { focused = true; };
  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(ev, touch, { capture: true, passive: true });
  function tick(now) {
    scheduled = false;
    const iv = 1000 / (focused ? FOCUS_FPS : BLUR_FPS);
    if (now - last < iv - 1.5) { schedule(); return; }
    last = now - last > iv * 2 ? now : last + iv;
    const q = queue; queue = new Map();
    q.forEach(cb => { try { cb(now); } catch (e) { setTimeout(() => { throw e; }); } });
  }
  function schedule() { if (!scheduled) { scheduled = true; native(tick); } }
  window.requestAnimationFrame = cb => { const i = ++id; queue.set(i, cb); schedule(); return i; };
  window.cancelAnimationFrame = i => { queue.delete(i); };

  // 音：作られた AudioContext をおぼえておいて、裏に回ったら止める
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC) {
    const list = [];
    const Wrapped = function (...a) { const c = new AC(...a); list.push(c); return c; };
    Wrapped.prototype = AC.prototype;
    try { window.AudioContext = Wrapped; if (window.webkitAudioContext) window.webkitAudioContext = Wrapped; } catch (e) {}
    document.addEventListener('visibilitychange', () => {
      for (const c of list) { try { if (document.hidden) { if (c.state === 'running') { c.__pausedByPerf = true; c.suspend(); } } else if (c.__pausedByPerf) { c.__pausedByPerf = false; c.resume(); } } catch (e) {} }
    });
  }
})();
