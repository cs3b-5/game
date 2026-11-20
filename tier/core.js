// ティア読み：ルール（画面なし。node からも動かせる）
(function (root) {
  const TIERS = ['S', 'A', 'B', 'C', 'D'];
  const WORDS_PER_ROUND = 5;
  const PERFECT_BONUS = 3;

  // ---- 乱数 ----
  function rng(seed) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  function sample(r, a, n) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b.slice(0, n); }
  function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

  // ---- お題の候補 ----
  // opts: { genres:[ジャンルID], custom:[{t, w:[ワード]}], useCustom }
  function pool(D, opts) {
    const gs = new Set(opts.genres && opts.genres.length ? opts.genres : D.genres.map(g => g.id));
    const out = [];
    for (const s of Object.values(D.sets)) { if (!gs.has(s.g)) continue; for (const t of s.topics) out.push({ topic: t, set: s.id, setName: s.name, g: s.g, words: s.words }); }
    if (opts.useCustom) for (const c of opts.custom || []) { if (!c || c.all || !Array.isArray(c.w) || c.w.length < WORDS_PER_ROUND) continue; out.push({ topic: c.t, set: 'custom', setName: c.by ? `${c.by}の自作お題` : '自作お題', g: 'custom', words: c.w, custom: true }); }
    return out;
  }
  function allPool(D, opts) {
    const out = D.all.map(t => ({ topic: t }));
    if (opts.useCustom) for (const c of opts.custom || []) if (c && c.all && c.t) out.push({ topic: c.t, custom: true, by: c.by });
    return out;
  }
  // used：これまでに出たお題（同じのが続かないように）
  function pickRound(D, opts, r, used) {
    const P = pool(D, opts); if (!P.length) return null;
    // 自作お題は少し出やすく
    const fresh = P.filter(p => !used.has(p.topic + '/' + p.set)); const src = fresh.length ? fresh : P;
    const cust = src.filter(p => p.custom), base = cust.length && r() < Math.min(0.5, cust.length * 0.08) ? cust : src;
    const p = pick(r, base);
    used.add(p.topic + '/' + p.set);
    return { topic: p.topic, set: p.set, setName: p.setName, g: p.g, words: sample(r, p.words, WORDS_PER_ROUND) };
  }
  function pickAllTopic(D, opts, r, used) {
    const P = allPool(D, opts); const fresh = P.filter(p => !used.has('all/' + p.topic)); const src = fresh.length ? fresh : P;
    const p = pick(r, src); used.add('all/' + p.topic);
    return { topic: p.topic, set: 'all', setName: p.custom ? '自作お題' : '全員一致', g: 'all' };
  }

  // ---- 点数：並び当て ----
  // main：主役の並び（ワードごとに 0〜4、置いていなければ -1）、guess：予想
  function matchCount(main, guess) { let m = 0; for (let i = 0; i < main.length; i++) if (main[i] >= 0 && guess && guess[i] === main[i]) m++; return m; }
  function scoreGuess(main, guess) {
    const m = matchCount(main, guess), n = main.filter(x => x >= 0).length;
    let off = 0; for (let i = 0; i < main.length; i++) if (main[i] >= 0) off += guess && guess[i] >= 0 ? Math.abs(guess[i] - main[i]) : 4;
    return { match: m, perfect: n > 0 && m === n, pts: m + (n > 0 && m === n ? PERFECT_BONUS : 0), off };
  }
  // guesses：{ pid: 並び }。主役の点は「予想した人の一致数の平均」（四捨五入）
  function scoreParty(main, guesses) {
    const per = {}; let sum = 0, k = 0;
    for (const [pid, g] of Object.entries(guesses)) { per[pid] = scoreGuess(main, g); sum += per[pid].match; k++; }
    const avg = k ? sum / k : 0;
    // ワードごとの分布（何人がどの段に置いたか）
    const dist = main.map((_, i) => { const c = [0, 0, 0, 0, 0]; for (const g of Object.values(guesses)) if (g && g[i] >= 0) c[g[i]]++; return c; });
    // 大ズレ：主役の段から2段以上ずれた人が半分以上
    const wild = main.map((t, i) => { if (t < 0 || !k) return false; let far = 0; for (const g of Object.values(guesses)) if (!g || g[i] < 0 || Math.abs(g[i] - t) >= 2) far++; return far * 2 >= k; });
    return { per, avg, mainPts: Math.round(avg), dist, wild };
  }

  // ---- 点数：全員一致 ----
  // boards：{ pid: 並び（名前ごと） }。名前ごとに全員が同じ段なら「一致」
  function scoreAll(boards, n) {
    const B = Object.entries(boards), res = [];
    for (let j = 0; j < n; j++) {
      const c = [0, 0, 0, 0, 0]; let miss = 0;
      for (const [, b] of B) { const t = b ? b[j] : -1; if (t >= 0) c[t]++; else miss++; }
      const top = Math.max(...c), mode = top ? c.indexOf(top) : -1;
      res.push({ dist: c, mode, same: B.length > 1 && miss === 0 && top === B.length });
    }
    const per = {};
    for (const [pid, b] of B) { let m = 0; res.forEach((r, j) => { if (r.mode >= 0 && r.dist[r.mode] >= 2 && b && b[j] === r.mode) m++; }); per[pid] = { match: m, pts: m }; }
    const same = res.filter(r => r.same).length;
    const perfect = n > 0 && same === n;
    if (perfect) for (const pid in per) per[pid].pts += PERFECT_BONUS;
    return { res, per, same, rate: n ? same / n : 0, perfect };
  }

  // ---- ボット ----
  // 「みんなの感覚」はお題とワードから決まる値にしておき、そこに個人差を足す
  function senseTier(topic, word) { const h = hash(topic + '|' + word); return [0, 1, 1, 2, 2, 2, 3, 3, 4][h % 9]; }
  function botBoard(topic, words, r, skill) {
    return words.map(w => {
      const base = senseTier(topic, w), x = r();
      if (x < skill) return base;
      if (x < skill + (1 - skill) * 0.6) return Math.max(0, Math.min(4, base + (r() < 0.5 ? -1 : 1)));
      return Math.floor(r() * 5);
    });
  }

  // ---- 順位（S〜Dに1つずつ） ----
  // order：上（S）から順にワードの番号。tiers：ワードごとの段（0〜4）
  const orderToTiers = order => { const t = []; order.forEach((w, k) => { t[w] = k; }); return t; };
  const tiersToOrder = tiers => tiers.map((t, w) => [t, w]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[1]);
  // ボットの順位：「みんなの感覚」＋ゆらぎ。skill が高いほど感覚どおり
  function botRank(topic, words, r, skill) {
    const sc = words.map((w, i) => [senseTier(topic, w) + (hash(w + topic) % 7) / 10 + (r() * 2 - 1) * (1 - skill) * 3.2, i]);
    sc.sort((a, b) => a[0] - b[0]);
    return sc.map(x => x[1]);
  }
  const shuffled = (r, n) => sample(r, Array.from({ length: n }, (_, i) => i), n);

  // ---- セッションのまとめ ----
  // turns：[{ main, guesses:{pid: 一致数}, n }]（並び当て・配信者）
  function summary(turns) {
    let hit = 0, all = 0; const det = {}, read = {}, perf = {}, pair = {};
    for (const t of turns) {
      for (const [pid, m] of Object.entries(t.guesses)) {
        hit += m; all += t.n; det[pid] = (det[pid] || 0) + m; if (m === t.n) perf[pid] = (perf[pid] || 0) + 1;
        const k = [pid, t.main].sort().join('|'); pair[k] = pair[k] || [0, 0]; pair[k][0] += m; pair[k][1] += t.n;
        read[t.main] = read[t.main] || [0, 0]; read[t.main][0] += m; read[t.main][1] += t.n;
      }
    }
    const best = (o, f) => { let b = null; for (const [k, v] of Object.entries(o)) if (!b || f(v) > f(b[1])) b = [k, v]; return b; };
    const bp = best(pair, v => v[0] / v[1] + v[1] * 1e-6), br = best(read, v => v[0] / v[1] + v[1] * 1e-6), bd = best(det, v => v);
    return { hit, all, rate: all ? hit / all : 0, det, perf,
      pair: bp && { a: bp[0].split('|')[0], b: bp[0].split('|')[1], rate: bp[1][0] / bp[1][1] },
      reader: br && { pid: br[0], rate: br[1][0] / br[1][1] }, detective: bd && bd[1] > 0 ? { pid: bd[0], hit: bd[1] } : null };
  }

  // ---- 自作お題の入力 ----
  function parseWords(text) {
    const seen = new Set(), out = [];
    for (const w of String(text || '').split(/[\s,、，・\n]+/)) { const t = w.trim().slice(0, 16); if (t && !seen.has(t)) { seen.add(t); out.push(t); } }
    return out.slice(0, 60);
  }
  function cleanCustom(list, by) {
    const out = [];
    for (const c of Array.isArray(list) ? list : []) {
      if (!c || typeof c.t !== 'string') continue;
      const t = c.t.trim().slice(0, 40); if (!t) continue;
      if (c.all) out.push({ t, all: true, by });
      else { const w = parseWords((c.w || []).join(' ')); if (w.length >= WORDS_PER_ROUND) out.push({ t, w, by }); }
      if (out.length >= 50) break;
    }
    return out;
  }

  const API = { TIERS, WORDS_PER_ROUND, PERFECT_BONUS, rng, sample, hash, pool, allPool, pickRound, pickAllTopic, matchCount, scoreGuess, scoreParty, scoreAll, senseTier, botBoard, parseWords, cleanCustom, orderToTiers, tiersToOrder, botRank, shuffled, summary };
  root.TIER = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
