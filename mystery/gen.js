// 推理ゲーム：事件を自動で作る＋「答えが1つに決まるか」を確かめる（画面なし。node でも動く）
// ルール：犯人だけがウソをつく。犯人以外の証言と証拠は、すべて本当。
(function (root) {
  // ================= 世界観（事件ごとにランダム） =================
  const THEMES = [
    {
      id: 'mansion', nm: '洋館ミステリー', sub: '嵐の夜の洋館', cls: 'mansion',
      crimes: ['伯爵家の宝石「夜明けの涙」が盗まれた', '名画「月下の淑女」が切り裂かれた', '金庫の遺言書が消えた'],
      places: ['書斎', '食堂', '温室', '図書室', '大広間', '台所', 'ワイン蔵', '客間'],
      times: ['20時', '21時', '22時', '23時'],
      // [名前, 絵文字, [髪, 靴, 香り]]  見た目は立ち絵と合わせて固定
      people: [['執事のセバスチャン', '🤵', [3, 0, 1]], ['令嬢エリカ', '👸', [1, 2, 0]], ['料理長ゴードン', '👨‍🍳', [0, 1, 2]], ['家庭教師マリー', '👩‍🏫', [2, 2, 3]], ['庭師トム', '👨‍🌾', [1, 1, 0]], ['画家ルイ', '🧑‍🎨', [0, 3, 3]], ['伯爵夫人', '👵', [3, 3, 0]], ['医者のハリス', '👨‍⚕️', [2, 0, 1]], ['探検家ロイ', '🧔', [0, 1, 2]], ['歌手のアンナ', '👩‍🎤', [1, 2, 3]]],
      attrs: [{ nm: '髪', v: ['黒', '金', '赤', '銀'], clue: v => `じゅうたんに${v}色の髪の毛が落ちていた` },
              { nm: '靴', v: ['革靴', '長靴', 'ハイヒール', 'スリッパ'], clue: v => `床に${v}の足あとが残っていた` },
              { nm: '香り', v: ['バラ', 'ミント', 'たばこ', 'ラベンダー'], clue: v => `かすかに${v}の香りがただよっていた` }],
      flavor: ['ほこりをかぶった古い本棚がある。', '暖炉の火がぱちぱちと鳴っている。', '窓の外で稲妻が光った。', '大きな柱時計が時を刻んでいる。', 'テーブルには冷めた紅茶が残っている。'],
      lines: ['わたくしは何も存じませんわ。', 'こんな嵐の夜に、物騒なことですな。', 'ええ、はっきり覚えております。', 'まさか、わたしを疑っているのですか？'],
    },
    {
      id: 'school', nm: '学園ミステリー', sub: '放課後の事件簿', cls: 'school',
      crimes: ['給食の特製プリンが消えた', '文化祭のトロフィーが割られた', '音楽室のトランペットがなくなった'],
      places: ['教室', '音楽室', '理科室', '図書室', '体育館', '屋上', '購買', '美術室'],
      times: ['1時間目のあと', '昼休み', '5時間目のあと', '放課後'],
      // [名前, 絵文字, [バッジ, 上ばき, ペン]]
      people: [['学級委員サクラ', '👧', [0, 0, 0]], ['野球部ケンタ', '🧢', [1, 3, 3]], ['美術部ユイ', '🎨', [2, 0, 2]], ['生徒会長レン', '🧑‍💼', [1, 2, 0]], ['転校生アオイ', '🧑', [3, 1, 3]], ['放送部ミク', '🎙️', [2, 1, 1]], ['理科のタナカ先生', '👨‍🔬', [3, 3, 1]], ['用務員のヤマさん', '🧹', [0, 2, 3]], ['陸上部ハル', '🏃', [3, 2, 2]], ['図書委員シオリ', '📚', [2, 0, 0]]],
      attrs: [{ nm: 'バッジ', v: ['赤', '青', '黄色', '緑'], clue: v => `${v}のバッジが落ちていた` },
              { nm: '上ばき', v: ['22cm', '24cm', '26cm', '28cm'], clue: v => `${v}くらいの上ばきのあとがあった` },
              { nm: 'ペン', v: ['黒インク', '赤インク', '蛍光ペン', 'えんぴつ'], clue: v => `${v}の書きかけのメモが残っていた` }],
      flavor: ['黒板に落書きが残っている。', 'カーテンが風でゆれている。', '時計の針がカチカチ鳴る。', 'だれかのお弁当箱が置きっぱなし。', 'ロッカーが半分あいている。'],
      lines: ['えー、ぼくじゃないって！', 'ちゃんと覚えてるよ。', 'うそはついてないもん。', 'それ、だいじな話？'],
    },
    {
      id: 'animal', nm: 'どうぶつ村のなぞ', sub: 'のどかな村の大事件', cls: 'animal',
      crimes: ['村祭りのはちみつケーキが食べられた', '村長の金のどんぐりが消えた', '郵便局の大事な手紙がなくなった'],
      places: ['パン屋', '花畑', '池のほとり', '図書館', '広場', 'はちみつ蔵', '郵便局', 'きのこの森'],
      times: ['朝', '昼', '夕方', '夜'],
      // [名前, 絵文字, [毛の色, くつ, 好物]]
      people: [['イヌのポチ', '🐶', [1, 2, 1]], ['ネコのミケ', '🐱', [0, 1, 1]], ['ウサギのモモ', '🐰', [0, 0, 0]], ['キツネのコン', '🦊', [3, 3, 2]], ['クマのゴロー', '🐻', [1, 0, 3]], ['パンダのリンリン', '🐼', [2, 1, 3]], ['ヒツジのメェ', '🐑', [0, 3, 0]], ['フクロウ先生', '🦉', [1, 1, 2]], ['リスのクルミ', '🐿️', [3, 2, 2]], ['カラスのカー', '🐦‍⬛', [2, 0, 1]]],
      attrs: [{ nm: '毛の色', v: ['白', '茶色', '黒', '金色'], clue: v => `${v}の毛がふわっと落ちていた` },
              { nm: 'くつ', v: ['長ぐつ', 'サンダル', 'スニーカー', 'はだし'], clue: v => `ぬかるみに${v}のあとがついていた` },
              { nm: '好物', v: ['にんじん', 'さかな', 'どんぐり', 'はちみつ'], clue: v => `${v}の食べかすがこぼれていた` }],
      flavor: ['ちょうちょがひらひら飛んでいる。', 'いいにおいがただよっている。', '小鳥がさえずっている。', 'どんぐりがころころ転がっている。', 'お花がきれいに咲いている。'],
      lines: ['えーっ、ぼくじゃないよう。', 'ほんとのことしか言わないよ！', 'うーん、思い出してみるね。', 'こわいなあ、だれのしわざ？'],
    },
    {
      id: 'neon', nm: 'ネオン探偵', sub: '眠らない街の事件', cls: 'neon',
      crimes: ['データチップ「エデン」が盗まれた', 'カジノの金庫がこじあけられた', 'アンドロイド歌姫の記憶が消された'],
      places: ['ネオンバー', '屋上ヘリポート', '地下カジノ', 'ラボ', '裏路地', '電脳カフェ', '駐車場', 'ホテルの廊下'],
      times: ['22:00', '23:00', '0:00', '1:00'],
      // [名前, 絵文字, [タトゥー, 靴, 痕跡]]
      people: [['ハッカーのZERO', '🧑‍💻', [2, 1, 3]], ['歌姫ルナ', '👩‍🎤', [3, 2, 1]], ['用心棒ジャック', '🥷', [1, 0, 2]], ['情報屋ネズ', '🐀', [2, 1, 0]], ['ノヴァ博士', '👩‍🔬', [0, 2, 3]], ['ドロイドK-9', '🤖', [0, 3, 0]], ['元刑事ダン', '🕵️', [3, 0, 2]], ['バーテンのマオ', '🍸', [0, 1, 1]], ['運び屋リコ', '🏍️', [1, 3, 0]], ['社長ヴィクター', '🤵‍♂️', [3, 3, 1]]],
      attrs: [{ nm: 'タトゥー', v: ['青', '赤', '緑', '紫'], clue: v => `監視カメラに${v}く光るタトゥーが一瞬うつっていた` },
              { nm: '靴', v: ['ブーツ', 'スニーカー', 'ヒール', '磁力靴'], clue: v => `${v}の足あとがスキャンされた` },
              { nm: '痕跡', v: ['オイル', '香水', 'タバコ', 'ミント'], clue: v => `センサーが${v}の成分を検出した` }],
      flavor: ['ネオンサインがチカチカまたたく。', '雨にぬれた路面が光っている。', '遠くでサイレンが鳴っている。', 'ホログラム広告が流れている。', '自販機がぶーんとうなっている。'],
      lines: ['フン、オレを疑うのか？', 'ログは残ってる。確かめな。', '証言？ いいぜ、話してやる。', 'こっちも仕事なんでね。'],
    },
  ];
  const DIFF = {
    easy: { nm: 'かんたん', n: 4, m: 4, k: 3, v2: 0, extra: 1 },
    normal: { nm: 'ふつう', n: 5, m: 5, k: 3, v2: .5, extra: 2 },
    hard: { nm: 'むずかしい', n: 6, m: 6, k: 4, v2: .8, extra: 3 },
  };

  // 立ち絵のファイル名：images/chara/洋館_01.webp のように、世界観と番号で決まる
  const imgOf = (T, nm) => `images/chara/${T.id}_${String(T.people.findIndex(p => p[0] === nm) + 1).padStart(2, '0')}.webp`;
  function rngOf(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const shuffle = (a, r) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ================= 証言 → わかること =================
  // facts: [人, 時間, 場所]  only: { t, p, set }（その時間その場所には set の人しかいなかった）
  function factsOf(st) {
    if (st.kind === 'clue') return { facts: [], only: null };
    const f = [[st.by, st.t, st.p]]; (st.who || []).forEach(w => f.push([w, st.t, st.p]));
    const only = st.kind === 'alone' ? { t: st.t, p: st.p, set: [st.by] } : st.kind === 'with' ? { t: st.t, p: st.p, set: [st.by, ...st.who] } : null;
    return { facts: f, only };
  }
  // いくつかの証言がたがいに食いちがうか
  function contradicts(list, extraFacts = []) {
    const pos = {}, onlys = [], all = extraFacts.slice();
    for (const st of list) { const { facts, only } = factsOf(st); all.push(...facts); if (only) onlys.push(only); }
    for (const [who, t, p] of all) { const k = who + '@' + t; if (pos[k] != null && pos[k] !== p) return true; pos[k] = p; }
    for (const o of onlys) for (const [who, t, p] of all) if (t === o.t && p === o.p && !o.set.includes(who)) return true;
    return false;
  }
  // ある人を犯人と考えたとき、すじが通るか
  function consistentIf(C, x) {
    const others = C.statements.filter(s => s.by !== x);
    if (contradicts(others, [[x, C.crime.t, C.crime.p]])) return false;
    for (const cl of C.clues) if (C.suspects[x].attr[cl.k] !== cl.v) return false;
    return true;
  }
  // 表で赤くするマス（「だれ_時間」）：同じ人が2か所にいる／「ほかにだれもいない」のにいる
  function conflictCells(sts) {
    const bad = new Set(), at = {}, onlys = [];
    for (const st of sts) { const { facts, only } = factsOf(st); facts.forEach(([w, t, p]) => { const k = w + '_' + t; (at[k] = at[k] || new Set()).add(p); }); if (only) onlys.push({ ...only, by: st.by }); }
    for (const k in at) if (at[k].size > 1) bad.add(k);
    for (const o of onlys) for (const k in at) { const [w, t] = k.split('_').map(Number); if (t === o.t && at[k].has(o.p) && !o.set.includes(w)) { bad.add(k); bad.add(o.by + '_' + t); } }
    return bad;
  }
  const candidates = C => C.suspects.map((_, i) => i).filter(x => consistentIf(C, x));

  // ================= 事件を作る =================
  function generate(seed, diff = 'normal') {
    const D = DIFF[diff];
    for (let att = 0; att < 200; att++) {
      const r = rngOf(seed * 7919 + att * 104729 + 17), ri = n => Math.floor(r() * n), pick = a => a[ri(a.length)];
      const T = THEMES[ri(THEMES.length)], n = D.n, m = D.m, k = D.k;
      const people = shuffle(T.people, r).slice(0, n), places = shuffle(T.places, r).slice(0, m), times = T.times.slice(0, k);
      // 見た目の特徴：同じ値の人が2人以上いるようにする（証拠だけで決まらないように）
      const attr = people.map(p => p[2].slice());
      const suspects = people.map(([nm, emo], i) => ({ id: i, nm, emo, attr: attr[i], line: pick(T.lines), img: imgOf(T, nm) }));
      const c = ri(n), tc = 1 + ri(k - 1), Lc = ri(m);
      // 本当の居場所
      const pos = Array.from({ length: n }, () => Array.from({ length: k }, () => ri(m)));
      const v2 = r() < D.v2;
      const others = shuffle([...Array(n).keys()].filter(i => i !== c), r);
      const free = shuffle([...Array(m).keys()].filter(p => p !== Lc), r);
      let lie, partner = [];
      pos[c][tc] = Lc;
      if (!v2) {
        // ① 犯人「Qにいた」 ↔ D「Qにはわたししかいなかった」
        const Dp = others[0], Q = free[0];
        pos[Dp][tc] = Q;
        for (let i = 0; i < n; i++) if (i !== c && i !== Dp && (pos[i][tc] === Q || pos[i][tc] === Lc)) pos[i][tc] = free[1 + ri(free.length - 1)];
        lie = { by: c, kind: 'self', t: tc, p: Q };
        partner = [{ by: Dp, kind: 'alone', t: tc, p: Q }];
      } else {
        // ② 犯人「Eといっしょに Qにいた」 ↔ G「Eは Rにいた」 or E「わたしは Rにいた」
        const E = others[0], G = others[1], R = free[0], Q = free[1];
        pos[E][tc] = R; pos[G][tc] = R;
        for (let i = 0; i < n; i++) if (i !== c && i !== E && i !== G && pos[i][tc] === Lc) pos[i][tc] = free[2 % free.length];
        lie = { by: c, kind: 'seen', who: [E], t: tc, p: Q };
        partner = [{ by: G, kind: 'seen', who: [E], t: tc, p: R }];
      }
      for (let i = 0; i < n; i++) if (i !== c && pos[i][tc] === Lc) pos[i][tc] = free[0];
      // 本当の証言の候補
      const pool = [];
      for (let i = 0; i < n; i++) for (let t = 0; t < k; t++) {
        if (i === c && t === tc) continue;
        const p = pos[i][t], mates = [...Array(n).keys()].filter(j => j !== i && pos[j][t] === p);
        pool.push({ by: i, kind: 'self', t, p });
        if (mates.length) { const j = pick(mates); if (!(j === c && t === tc)) pool.push({ by: i, kind: 'seen', who: [j], t, p }); }
        else pool.push({ by: i, kind: 'alone', t, p });
      }
      const cluePool = [0, 1, 2].map(a => ({ kind: 'clue', k: a, v: attr[c][a] }));
      const C = { seed, diff, theme: T.id, suspects, places, times, crime: { p: Lc, t: tc, text: pick(T.crimes) }, culprit: c, statements: [lie, ...partner], clues: [], v2 };
      // 答えが1つに決まるまで、証言と証拠を足す
      const mixed = shuffle(pool.filter(s => !C.statements.some(q => same(q, s))), r);
      const dup = s => C.statements.some(q => q.by === s.by && q.t === s.t);   // 同じ人の同じ時間の証言は1つだけ
      let cand = candidates(C), guard = 0;
      const cl = shuffle(cluePool, r);
      while (cand.length > 1 && guard++ < 60) {
        if (r() < .4 && cl.length) C.clues.push(cl.shift());
        else if (mixed.length) { const s = mixed.shift(); if (!dup(s)) C.statements.push(s); }
        else if (cl.length) C.clues.push(cl.shift()); else break;
        cand = candidates(C);
      }
      if (cand.length !== 1 || cand[0] !== c) continue;
      if (!C.clues.length && cl.length) C.clues.push(cl.shift());   // 現場に証拠が1つもないのはさみしいので
      if (candidates(C).length !== 1) continue;
      // 証拠だけで犯人が決まってしまうのはつまらない
      const byClues = C.suspects.filter(s => C.clues.every(q => s.attr[q.k] === q.v)).length;
      if (byClues < 2) continue;
      // 1人あたりの証言をそろえる（にぎやかし。本当の証言なので答えは変わらない）
      const want = 1 + D.extra;
      for (let i = 0; i < n; i++) {
        let have = C.statements.filter(s => s.by === i).length;
        for (const s of mixed) { if (have >= want) break; if (s.by === i && !C.statements.includes(s) && !dup(s)) { C.statements.push(s); have++; } }
      }
      // ふつう・むずかしいは、絞りこみきれない範囲で証拠をもう1つ
      if (diff !== 'easy' && cl.length) { const q = cl.shift(); C.clues.push(q); if (C.suspects.filter(s => C.clues.every(z => s.attr[z.k] === z.v)).length < 2) C.clues.pop(); }
      if (candidates(C).length !== 1 || candidates(C)[0] !== c) continue;
      // 番号と文
      const sts = shuffle(C.statements, r);
      C.statements = sts.map((s, i) => ({ ...s, id: 's' + i, lie: s === lie }));
      C.statements.sort((a, b) => a.by - b.by || a.t - b.t);
      C.clues = C.clues.map((q, i) => ({ ...q, id: 'c' + i, text: T.attrs[q.k].clue(T.attrs[q.k].v[q.v]) }));
      C.flavor = places.map(() => pick(T.flavor));
      C.truth = pos;
      return C;
    }
    return null;
  }
  const same = (a, b) => a.by === b.by && a.kind === b.kind && a.t === b.t && a.p === b.p && String(a.who || '') === String(b.who || '');

  // ================= 文にする =================
  function textOf(C, st) {
    const T = THEMES.find(t => t.id === C.theme), tm = C.times[st.t], pl = C.places[st.p];
    if (st.kind === 'self') return `${tm}は、${pl}にいました。`;
    if (st.kind === 'alone') return `${tm}は${pl}にいました。ほかには、だれもいませんでした。`;
    if (st.kind === 'seen') return `${tm}は${pl}にいました。${C.suspects[st.who[0]].nm}もいっしょでしたよ。`;
    if (st.kind === 'with') return `${tm}は${pl}にいました。いっしょにいたのは${st.who.map(w => C.suspects[w].nm).join('と')}だけです。`;
    void T; return '';
  }
  // 2つのカードが食いちがうか（つきつける）
  function pairContradicts(a, b) { return a.kind !== 'clue' && b.kind !== 'clue' && contradicts([a, b]); }
  // 種明かし
  function explain(C) {
    const c = C.suspects[C.culprit], lie = C.statements.find(s => s.lie);
    const vs = C.statements.find(s => !s.lie && pairContradicts(s, lie));
    const out = [];
    out.push(`犯人は <b>${c.nm}</b>。事件は${C.times[C.crime.t]}、${C.places[C.crime.p]}で起きた。`);
    out.push(`${c.nm}は「${textOf(C, lie)}」と言ったが、${C.suspects[vs.by].nm}の「${textOf(C, vs)}」と<b>食いちがう</b>。`);
    out.push(`犯人以外はウソをつかないので、どちらかが犯人。`);
    const other = vs.by;
    const T = THEMES.find(t => t.id === C.theme);
    const ex = C.clues.find(q => C.suspects[other].attr[q.k] !== q.v);
    if (ex) out.push(`現場の証拠「${ex.text}」は${c.nm}の${T.attrs[ex.k].nm}（${T.attrs[ex.k].v[c.attr[ex.k]]}）と合うが、${C.suspects[other].nm}（${T.attrs[ex.k].v[C.suspects[other].attr[ex.k]]}）とは合わない。`);
    else out.push(`${C.suspects[other].nm}が犯人だとすると、ほかの人の証言どうしも食いちがってしまう。すじが通るのは${c.nm}だけ。`);
    return out;
  }

  // ================= みんなで遊ぶ（プレイヤーの中に犯人） =================
  // n 人ぶんの事件。犯人以外の証言は本当の居場所から自動で作り、犯人は事件の時間だけウソの場所を選ぶ
  function generateMP(seed, n, diff = 'normal') {
    const D = DIFF[diff], r = rngOf(seed * 31 + n * 977 + 5), ri = k => Math.floor(r() * k), pick = a => a[ri(a.length)];
    const T = THEMES[ri(THEMES.length)], m = Math.max(3, Math.min(D.m, n)), k = D.k;
    const people = shuffle(T.people, r).slice(0, n), places = shuffle(T.places, r).slice(0, m), times = T.times.slice(0, k);
    const attr = people.map(p => p[2].slice());
    const suspects = people.map(([nm, emo], i) => ({ id: i, nm, emo, attr: attr[i], line: pick(T.lines), img: imgOf(T, nm) }));
    const c = ri(n), tc = 1 + ri(k - 1), Lc = ri(m);
    const pos = Array.from({ length: n }, () => Array.from({ length: k }, () => ri(m)));
    // 事件の時間：犯人は現場にひとり。ほかの場所にはなるべくだれかがいるように
    pos[c][tc] = Lc;
    const inn = shuffle([...Array(n).keys()].filter(i => i !== c), r), others = shuffle([...Array(m).keys()].filter(p => p !== Lc), r);
    inn.forEach((i, j) => pos[i][tc] = j < others.length ? others[j] : others[ri(others.length)]);
    // 探偵ひとりひとりに、こっそりヒント（犯人の別の特徴。本当のこと）
    const hints = {};
    inn.forEach(i => { const a = ri(3); hints[i] = { k: a, v: attr[c][a], text: `犯人の${T.attrs[a].nm}は「${T.attrs[a].v[attr[c][a]]}」だった気がする` }; });
    return { seed, mp: true, diff, theme: T.id, suspects, places, times, crime: { p: Lc, t: tc, text: pick(T.crimes) }, culprit: c, truth: pos, clue: null, hints, flavor: places.map(() => pick(T.flavor)) };
  }
  // 証言を作る（犯人の事件の時間は lieQ にひとりでいた、とウソをつく）
  function statementsMP(C, lieQ) {
    const out = [], n = C.suspects.length;
    for (let i = 0; i < n; i++) for (let t = 0; t < C.times.length; t++) {
      if (i === C.culprit && t === C.crime.t) { out.push({ id: 's' + out.length, by: i, kind: 'alone', t, p: lieQ, lie: true }); continue; }
      const p = C.truth[i][t], mates = [...Array(n).keys()].filter(j => j !== i && C.truth[j][t] === p && !(j === C.culprit && t === C.crime.t));
      out.push(mates.length ? { id: 's' + out.length, by: i, kind: 'with', who: mates, t, p } : { id: 's' + out.length, by: i, kind: 'alone', t, p });
    }
    return out;
  }
  // 現場の証拠（みんなに見える）は、犯人のウソが決まってから選ぶ。
  // ウソで食いちがった相手も当てはまる特徴にして、証拠だけでは決まらないようにする（話し合いが大事）
  function clueMP(C, lieQ) {
    const T = THEMES.find(t => t.id === C.theme), c = C.culprit, tc = C.crime.t;
    const rivals = C.suspects.map((_, i) => i).filter(i => i !== c && C.truth[i][tc] === lieQ);
    const cnt = a => C.suspects.filter(s => s.attr[a] === C.suspects[c].attr[a]).length;
    let opts = [0, 1, 2].filter(a => rivals.length && rivals.every(i => C.suspects[i].attr[a] === C.suspects[c].attr[a]));
    if (!opts.length) { const best = Math.max(cnt(0), cnt(1), cnt(2)); opts = [0, 1, 2].filter(a => cnt(a) === best); }
    const a = opts[(C.seed + lieQ) % opts.length], v = C.suspects[c].attr[a];
    return { k: a, v, text: T.attrs[a].clue(T.attrs[a].v[v]) };
  }
  // 公開されている証言・証拠（＋自分だけのヒント）から、犯人でありうる人
  function candidatesMP(C, sts, hint) {
    return C.suspects.map((_, i) => i).filter(x => {
      if (contradicts(sts.filter(s => s.by !== x), [[x, C.crime.t, C.crime.p]])) return false;
      if (C.suspects[x].attr[C.clue.k] !== C.clue.v) return false;
      if (hint && C.suspects[x].attr[hint.k] !== hint.v) return false;
      return true;
    });
  }

  const API = { conflictCells, generateMP, statementsMP, candidatesMP, clueMP, THEMES, DIFF, generate, candidates, consistentIf, contradicts, pairContradicts, textOf, explain, factsOf, rngOf };
  if (typeof module !== 'undefined') module.exports = API; else root.MYS = API;
})(this);
