// ドット絵をコードで描く：小さいキャンバスに図形を描いて、ふちをくっきり（しきい値）＋自動で黒い輪郭をつける
(function () {
  const OUT = '#120a1e';
  function pixelize(size, draw, outline = OUT) {
    const n = size + 2, c = document.createElement('canvas'); c.width = c.height = n;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.translate(1, 1); draw(g); g.setTransform(1, 0, 0, 1, 0, 0);
    const im = g.getImageData(0, 0, n, n), d = im.data, solid = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) { if (d[i * 4 + 3] > 100) { d[i * 4 + 3] = 255; solid[i] = 1; } else d[i * 4 + 3] = 0; }
    if (outline) {
      const [r, gg, b] = [1, 3, 5].map(k => parseInt(outline.slice(k, k + 2), 16));
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
        const i = y * n + x; if (solid[i]) continue;
        if ((x > 0 && solid[i - 1]) || (x < n - 1 && solid[i + 1]) || (y > 0 && solid[i - n]) || (y < n - 1 && solid[i + n])) { d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255; }
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }
  const R = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const E = (g, c, x, y, rx, ry) => { g.fillStyle = c; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 7); g.fill(); };
  const P = (g, c, pts) => { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };

  // ---------- ねこ ----------
  const ROBE = { archer: ['#3aa860', '#2a7a44'], magic: ['#8a4ad8', '#5a2aa0'], ice: ['#4ab0e8', '#2a7ab0'], lightning: ['#e8b020', '#a87810'], laser: ['#3a4a6a', '#24304a'], cafe: ['#f088c0', '#c05a90'] };
  const FUR = { archer: '#f0c890', magic: '#c8c8d8', ice: '#ffffff', lightning: '#f0a050', laser: '#4a4a52', cafe: '#f4e4d0' };
  function cat(type, frame = 0) {
    return pixelize(18, g => {
      const [rb, rd] = ROBE[type], fur = FUR[type], bob = frame ? 1 : 0;
      // しっぽ
      R(g, fur, 14, 11 + bob, 2, 2); R(g, fur, 15, 9 + bob, 1, 3);
      // 体（ローブ）
      P(g, rb, [[4, 10], [13, 10], [15, 17], [2, 17]]); R(g, rd, 3, 15, 12, 2); R(g, rd, 8, 11, 2, 6);
      // 頭
      const hy = 7 + bob;
      E(g, fur, 9, hy, 5.5, 4.5);
      P(g, fur, [[3.5, hy - 1], [4.5, hy - 6], [7.5, hy - 3]]); P(g, fur, [[14.5, hy - 1], [13.5, hy - 6], [10.5, hy - 3]]);
      R(g, '#ff9ab8', 5, hy - 4, 1, 2); R(g, '#ff9ab8', 12, hy - 4, 1, 2);
      // 目と鼻
      if (type === 'laser') { R(g, '#3af0ff', 4, hy - 1, 10, 2); R(g, '#c8ffff', 5, hy - 1, 2, 1); }
      else { R(g, '#1a1020', 6, hy - 1, 2, 2); R(g, '#1a1020', 11, hy - 1, 2, 2); R(g, '#ffffff', 6, hy - 1, 1, 1); R(g, '#ffffff', 11, hy - 1, 1, 1); }
      R(g, '#ff7aa0', 9, hy + 1, 1, 1);
      // 持ち物
      if (type === 'archer') { g.strokeStyle = '#a06a30'; g.lineWidth = 1.2; g.beginPath(); g.arc(14, 12, 4.5, -1.3, 1.3); g.stroke(); R(g, '#e8e0c8', 9, 12, 7, 1); P(g, '#c0c0c8', [[16, 11], [17.5, 12.5], [16, 14]]); P(g, '#2a7a44', [[4, hy - 4], [9, hy - 7], [14, hy - 4], [9, hy - 3]]); }
      if (type === 'magic') { P(g, '#5a2aa0', [[3, hy - 3], [15, hy - 3], [10, hy - 11], [8, hy - 8]]); R(g, '#ffe23a', 9, hy - 6, 2, 2); R(g, '#3a1a70', 3, hy - 3, 12, 1); R(g, '#8a5a2a', 1, 9, 1, 8); E(g, '#ff8a3a', 1.5, 8, 1.6, 1.6); }
      if (type === 'ice') { for (const [x, h] of [[5, 3], [7, 4], [9, 5], [11, 4], [13, 3]]) P(g, '#c8f4ff', [[x - 1, hy - 3], [x + 1, hy - 3], [x, hy - 3 - h]]); R(g, '#7ad8ff', 4, hy - 3, 11, 1); }
      if (type === 'lightning') { R(g, '#a0a0b0', 8, hy - 9, 1, 5); P(g, '#ffe23a', [[9, hy - 13], [6, hy - 9], [8, hy - 9], [7, hy - 6], [11, hy - 10], [9, hy - 10]]); }
      if (type === 'laser') { R(g, '#8a90a8', 13, 11, 4, 3); R(g, '#3af0ff', 17, 12, 1, 1); R(g, '#5a6080', 4, hy - 4, 10, 1); }
      if (type === 'cafe') { E(g, '#ffffff', 9, hy - 6, 5, 3); E(g, '#ffffff', 6, hy - 5, 2.5, 2.5); E(g, '#ffffff', 12, hy - 5, 2.5, 2.5); R(g, '#e8e8f0', 5, hy - 4, 9, 2); R(g, '#ff6a9a', 1, 12, 3, 3); R(g, '#ffd23a', 1, 11, 3, 1); }
    });
  }

  // ---------- 敵 ----------
  const ENEMY = {
    slime: f => pixelize(14, g => { const s = f ? 1 : 0; E(g, '#5ae86a', 7, 9 + s * .5, 6 + s * .4, 5 - s * .4); R(g, '#5ae86a', 1, 9, 12, 4); R(g, '#2aa848', 1, 12, 12, 1); R(g, '#b0ffb0', 4, 6 + s, 2, 1); R(g, '#102018', 5, 9, 1, 2); R(g, '#102018', 9, 9, 1, 2); }),
    drone: f => pixelize(14, g => { R(g, '#8a90b0', 3, 6, 8, 5); R(g, '#5a6080', 3, 10, 8, 1); R(g, '#ff3a5a', 6, 8, 2, 2); R(g, '#c0c8e0', 1, 4, 3, 1); R(g, '#c0c8e0', 10, 4, 3, 1); R(g, '#606880', 2, 5, 1, 2); R(g, '#606880', 11, 5, 1, 2); const w = f ? 4 : 2; R(g, '#e0f0ff', 2.5 - w / 2, 3, w, 1); R(g, '#e0f0ff', 11.5 - w / 2, 3, w, 1); }),
    pudding: f => pixelize(16, g => { P(g, '#ffd86a', [[3, 15], [13, 15], [11, 5], [5, 5]]); R(g, '#e8b040', 3, 14, 10, 1); E(g, '#8a4a1a', 8, 5.5, 3.5, 2); R(g, '#8a4a1a', 5, 6, 1, 3); R(g, '#8a4a1a', 10, 6, 1, 2); E(g, '#ffffff', 8, 3.5, 2, 1.5); E(g, '#ff3a4a', 8, 1.8, 1.3, 1.3); R(g, '#3a2010', 6, 10, 1, 1); R(g, '#3a2010', 10, 10, 1, 1); R(g, '#c05a3a', 7, 12, 3, 1); }),
    cotton: f => pixelize(16, g => { const s = f ? -1 : 0; for (const [x, y, r] of [[5, 8, 3.5], [10, 8, 3.5], [7.5, 5.5, 3.5], [7.5, 10, 3]]) E(g, '#ffb0e0', x, y + s, r, r); R(g, '#ffffff', 6, 5 + s, 2, 1); R(g, '#c8a07a', 7, 12 + s, 1, 4); P(g, '#e8f0ff', [[1, 7 + s], [-1, 3 + s * 2], [3, 6 + s]]); P(g, '#e8f0ff', [[14, 7 + s], [16, 3 + s * 2], [12, 6 + s]]); R(g, '#3a1a30', 6, 8 + s, 1, 1); R(g, '#3a1a30', 9, 8 + s, 1, 1); }),
    macaron: f => pixelize(15, g => { E(g, '#ff8ab0', 7.5, 6, 6, 3); E(g, '#ff8ab0', 7.5, 11, 6, 3); R(g, '#fff4e0', 2, 8, 11, 2); E(g, '#9aa0b8', 7.5, 4, 5, 2.5); R(g, '#c8d0e8', 4, 3, 3, 1); R(g, '#6a7090', 2, 5, 11, 1); R(g, '#2a1a2a', 5, 11, 1, 1); R(g, '#2a1a2a', 9, 11, 1, 1); }),
    jelly: f => pixelize(14, g => { const s = f ? 1 : 0; R(g, '#b06aff', 2 - s * .5, 4 + s, 10 + s, 9 - s); R(g, '#d8a8ff', 3, 5 + s, 3, 2); R(g, '#7a3ad0', 2, 12, 10, 1); R(g, '#2a103a', 5, 8 + s, 1, 2); R(g, '#2a103a', 9, 8 + s, 1, 2); }),
    mini: f => pixelize(9, g => { R(g, '#c88aff', 1, 2 + (f ? 1 : 0), 7, 6 - (f ? 1 : 0)); R(g, '#2a103a', 3, 4, 1, 1); R(g, '#2a103a', 6, 4, 1, 1); }),
    ghost: f => pixelize(15, g => { E(g, '#d8e8ff', 7.5, 6, 5.5, 5); R(g, '#d8e8ff', 2, 6, 11, 6); for (let i = 0; i < 4; i++) E(g, '#d8e8ff', 3 + i * 3 + (f ? 1 : 0), 12, 1.6, 1.6); R(g, '#3a2a6a', 5, 6, 2, 2); R(g, '#3a2a6a', 9, 6, 2, 2); g.strokeStyle = '#7a8aff'; g.lineWidth = 1; g.beginPath(); g.arc(7.5, 7, 7, 3.6, 5.8); g.stroke(); }),
    healer: f => pixelize(16, g => { E(g, '#9ae8ff', 8, 6, 3.5, 3.5); E(g, '#7a8098', 8, 9, 7.5, 2.5); R(g, '#b0b8d0', 1, 8, 14, 1); R(g, '#3aff8a', 7, 4, 2, 5); R(g, '#3aff8a', 5.5, 5.5, 5, 2); for (let i = 0; i < 4; i++) R(g, (i + (f ? 1 : 0)) % 2 ? '#ffe23a' : '#ff5a8a', 3 + i * 3, 10, 1, 1); }),
    boss1: f => pixelize(26, g => { const s = f ? 1 : 0; R(g, '#f4d8b0', 4, 14, 18, 10); R(g, '#ff8ab0', 4, 13, 18, 2); R(g, '#ffffff', 4, 18, 18, 1); R(g, '#f4d8b0', 7, 6 + s, 12, 8); R(g, '#ff8ab0', 7, 6 + s, 12, 2); for (let i = 0; i < 4; i++) E(g, '#ff3a4a', 9 + i * 3, 5 + s, 1.2, 1.2); R(g, '#9aa0b8', 9, 9 + s, 8, 3); R(g, '#1a1020', 10, 10 + s, 2, 1); R(g, '#1a1020', 14, 10 + s, 2, 1); R(g, '#c8d0e8', 23, 4, 2, 16); R(g, '#8a6a3a', 22, 18, 4, 2); P(g, '#e8e8f8', [[23, 4], [25, 4], [24, 1]]); }),
    boss2: f => pixelize(26, g => { R(g, '#6a7090', 4, 8, 18, 12); R(g, '#8a90b0', 5, 9, 16, 3); E(g, '#ff3a5a', 13, 14, 3, 3); E(g, '#ffd0d8', 12, 13, 1, 1); for (const x of [2, 20]) { R(g, '#3a4060', x, 6, 4, 2); R(g, '#e0f0ff', x - (f ? 2 : 0), 4, 4 + (f ? 4 : 0), 1); } R(g, '#3af0ff', 6, 18, 14, 1); R(g, '#a0a8c8', 7, 20, 2, 4); R(g, '#a0a8c8', 17, 20, 2, 4); }),
    boss3: f => pixelize(28, g => { const s = f ? 1 : 0; P(g, '#6a1a2a', [[4, 27], [24, 27], [20, 12], [8, 12]]); P(g, '#a02a3a', [[7, 27], [21, 27], [18, 14], [10, 14]]); E(g, '#3a2a4a', 14, 10 + s, 6, 5.5); R(g, '#ffd23a', 8, 3 + s, 12, 3); for (let i = 0; i < 4; i++) P(g, '#ffd23a', [[8 + i * 4, 3 + s], [10 + i * 4, 3 + s], [9 + i * 4, s]]); R(g, '#ff3a3a', 13, 4 + s, 2, 1); R(g, '#ff3a3a', 11, 10 + s, 2, 2); R(g, '#ff3a3a', 16, 10 + s, 2, 2); P(g, '#e8e0f0', [[8, 7 + s], [5, 2 + s], [9, 5 + s]]); P(g, '#e8e0f0', [[20, 7 + s], [23, 2 + s], [19, 5 + s]]); R(g, '#c0b0d0', 25, 8, 1, 18); E(g, '#ff3ad0', 25.5, 7, 2, 2); }),
  };

  // ---------- 飾り・城・ゲート ----------
  const DECO = {
    tree: () => pixelize(16, g => { R(g, '#6a4a2a', 7, 10, 2, 5); E(g, '#2a8a4a', 8, 7, 6, 5); E(g, '#3aaa5a', 6, 6, 3, 2.5); R(g, '#c88aff', 10, 5, 1, 1); R(g, '#7dff9a', 4, 8, 1, 1); }),
    candy: () => pixelize(16, g => { R(g, '#f0f0f0', 7, 8, 2, 7); E(g, '#ff7ad9', 8, 6, 5, 5); g.strokeStyle = '#ffffff'; g.lineWidth = 1.4; g.beginPath(); g.arc(8, 6, 2.6, 0, 5); g.stroke(); }),
    pylon: () => pixelize(16, g => { R(g, '#2a3050', 5, 3, 6, 12); R(g, '#3af0ff', 6, 4, 4, 1); R(g, '#ff3ad0', 6, 7, 4, 1); R(g, '#3af0ff', 6, 10, 4, 1); R(g, '#1a2040', 4, 14, 8, 2); }),
    brick: () => pixelize(16, g => { R(g, '#8a3a2a', 2, 6, 12, 9); for (let y = 0; y < 3; y++) R(g, '#5a2018', 2, 8 + y * 3, 12, 1); for (let y = 0; y < 3; y++) R(g, '#5a2018', (y % 2 ? 5 : 9), 6 + y * 3, 1, 3); R(g, '#ffd23a', 7, 2, 2, 4); }),
  };
  function castle(neon) {
    return pixelize(30, g => {
      R(g, '#3a3050', 3, 12, 24, 16); for (let i = 0; i < 6; i++) R(g, '#3a3050', 3 + i * 4, 9, 2, 3);
      R(g, '#2a2440', 0, 6, 7, 22); R(g, '#2a2440', 23, 6, 7, 22); P(g, '#ff5a8a', [[-1, 6], [8, 6], [3.5, 0]]); P(g, '#ff5a8a', [[22, 6], [31, 6], [26.5, 0]]);
      R(g, '#1a1424', 12, 18, 6, 10); E(g, '#1a1424', 15, 18, 3, 3); R(g, neon, 2, 10, 2, 2); R(g, neon, 26, 10, 2, 2); R(g, '#ffe23a', 9, 15, 2, 2); R(g, '#ffe23a', 19, 15, 2, 2);
      E(g, '#ffd8a0', 15, 9, 3, 2.5); P(g, '#ffd8a0', [[12.5, 8], [13, 5], [14.5, 7]]); P(g, '#ffd8a0', [[17.5, 8], [17, 5], [15.5, 7]]); R(g, '#1a1020', 14, 9, 1, 1); R(g, '#1a1020', 16, 9, 1, 1);
    });
  }
  window.SPR = { pixelize, cat, ENEMY, DECO, castle, ROBE };
})();
