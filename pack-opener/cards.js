// =============================================================
//  カードの一覧（74種・すべてオリジナル）
//  [属性, レア, 種類, 名前, 画風, 背景, 題材, 説明]
//  種類: M=モンスター S=魔法 F=フィールド I=アイテム
// =============================================================
(function (global) {
const { flame, bolt } = global.CardArt;
const D = [
  // ---------- 炎 ----------
  ['fire', 'C', 'M', 'ヒノコギツネ', 'pixel', 'volcano', { k: 'quad', c: '#ff7a2a', belly: '#ffe0b0', ears: 'big', tail: 'bushy', tailC: '#ffb040', snout: 'long', legs: 'mid', eye: '#ffcc33' }, '尻尾の先で焚き火に火をつける。'],
  ['fire', 'C', 'M', 'マグマトカゲ', 'comic', 'volcano', { k: 'quad', c: '#c23a1a', belly: '#ff9a4a', ears: 'none', tail: 'spike', snout: 'long', legs: 'short', eye: '#ffd84a', cracks: '#ffb020' }, '背中のひびから溶岩がこぼれる。', 'SIZZLE!'],
  ['fire', 'C', 'M', 'ヒバナドリ', 'water', 'meadow', { k: 'bird', c: '#ff5a2a', belly: '#ffd0a0', wingC: '#c2301a', crest: true, crestC: '#ffd84a', tail: 'long', tailC: '#ff8a2a' }, '鳴くたびに小さな火花が散る。'],
  ['fire', 'C', 'M', 'ヒノコスライム', 'paper', 'volcano', { k: 'spirit', kind: 'slime', c: '#ff6a2a', fx: flame(200, 128, .7) }, '頭の火が消えるとしょんぼりする。'],
  ['fire', 'U', 'M', 'ヨウガンイノシシ', 'lowpoly', 'volcano', { k: 'quad', c: '#5a3226', belly: '#8a5a40', ears: 'tri', tail: 'thin', snout: 'flat', tusk: true, legs: 'short', mane: 'horse', maneC: '#ff6a1a', eye: '#ff6a1a', cracks: '#ff8a2a' }, '走った跡が三日燃え続ける。'],
  ['fire', 'U', 'I', '火竜のポーション', 'real', 'cave', { k: 'item', kind: 'potion', c: '#fff', liquid: '#ff5a1a' }, '飲むと体の芯から熱くなる。'],
  ['fire', 'U', 'M', 'セキネツカブト', 'ukiyo', 'volcano', { k: 'insect', kind: 'beetle', c: '#b8261a', fx: 'fire' }, '角は鉄を溶かすほど熱い。', '炎'],
  ['fire', 'R', 'F', '業火の山', 'oil', 'volcano', { k: 'land', kind: 'volcano' }, '炎の属性のカードが元気になる場所。'],
  ['fire', 'R', 'M', '焔の獅子', 'real', 'volcano', { k: 'quad', c: '#d99a4a', belly: '#f2d0a0', ears: 'round', tail: 'thin', snout: 'flat', mane: true, maneC: '#e2471a', legs: 'mid', eye: '#ffcc33', whisk: true }, 'たてがみは消えない炎でできている。'],
  ['fire', 'SR', 'M', '紅蓮の不死鳥', 'real', 'volcano', { k: 'bird', c: '#ff4a1a', belly: '#ffd84a', wingC: '#ff6a1a', spread: true, crest: true, crestC: '#ffd84a', tail: 'long', tailC: '#ffb020', tailGlow: '#ff7a1a', eye: '#fff3a0' }, '灰の中から何度でも生まれ変わる。'],
  ['fire', 'SR', 'S', '流星の火雨', 'real', 'night', { k: 'spell', kind: 'meteor', c: '#ff6a1a' }, '空から燃える星を降らせる大魔法。'],
  ['fire', 'UR', 'M', '炎帝竜イグナス', 'real', 'volcano', { k: 'serpent', kind: 'west', c: '#a8221a', belly: '#f2a050', wingC: '#6a1410', hornC: '#2a1a14', eye: '#ffd84a', breath: '#ff6a1a', cracks: '#ffb020' }, 'ひと息で山を溶かす、炎の王。'],
  // ---------- 水 ----------
  ['water', 'C', 'M', 'シズクスライム', 'pixel', 'sea', { k: 'spirit', kind: 'slime', c: '#4ab0ff', alpha: .8 }, '雨の日だけ大きくなる。'],
  ['water', 'C', 'M', 'ニシキゴイ', 'ukiyo', 'sea', { k: 'fish', c: '#f4ecdc', spots: true, spotC: '#e2401a', finC: '#f2c0a0', seed: 21 }, '滝をのぼると竜になると言われる。', '鯉'],
  ['water', 'C', 'M', 'カクレクラゲ', 'water', 'deep', { k: 'fish', kind: 'jelly', c: '#8ad8ff' }, '透けすぎて自分でも居場所が分からない。'],
  ['water', 'C', 'M', 'コオリペンギン', 'paper', 'sea', { k: 'bird', kind: 'penguin', c: '#22242e' }, '氷の上なら誰よりも速い。'],
  ['water', 'U', 'M', 'シンカイアンコウ', 'comic', 'deep', { k: 'fish', c: '#4a4a6a', finC: '#2a2a44', lure: '#7fffd4', teeth: true }, '光る提灯で獲物をおびき寄せる。', 'CHOMP!'],
  ['water', 'U', 'M', 'タコ博士', 'sketch', 'deep', { k: 'fish', kind: 'octo', c: '#d25a6a', eye: '#ffd84a' }, '八本の腕で八冊の本を同時に読む。'],
  ['water', 'U', 'I', '人魚の涙', 'lowpoly', 'deep', { k: 'spirit', kind: 'crystal', c: '#6ad8ff', seed: 31 }, '海の底で一粒だけ見つかる宝石。'],
  ['water', 'R', 'F', '深海神殿', 'oil', 'deep', { k: 'land', kind: 'temple', c: '#6a8aa0', glow: '#7fffd4' }, '水の属性のカードが元気になる場所。'],
  ['water', 'R', 'M', '大海原のクジラ', 'real', 'sea', { k: 'fish', kind: 'whale', c: '#3a5a7a' }, '背中に小さな島をのせて泳ぐ。'],
  ['water', 'SR', 'M', '蒼海竜リヴァ', 'ukiyo', 'sea', { k: 'serpent', kind: 'east', c: '#2a7ac8', finC: '#f2f0e0', hornC: '#f2e6b8', eye: '#ffd84a', pearl: '#bff4ff' }, '嵐の夜にだけ海の上に姿を見せる。', '龍'],
  ['water', 'SR', 'S', '大津波', 'glass', 'sea', { k: 'spell', kind: 'wave', c: '#2a8cff' }, 'すべてを洗い流す水の大魔法。'],
  ['water', 'UR', 'M', '海王クラーケン', 'real', 'deep', { k: 'fish', kind: 'octo', c: '#8a2a4a', eye: '#ffe14a', size: 1.25 }, '船を一度に十隻つかむ、海の王。'],
  // ---------- 森 ----------
  ['leaf', 'C', 'M', 'ドクキノコン', 'pixel', 'forest', { k: 'spirit', kind: 'mushroom', c: '#c23a6a', seed: 41 }, '触ると三日くしゃみが止まらない。'],
  ['leaf', 'C', 'M', 'ハッパウサギ', 'water', 'forest', { k: 'quad', c: '#c8b090', belly: '#f4ecdc', ears: 'long', tail: 'puff', snout: 'flat', legs: 'short', eye: '#3a2a1a', whisk: true }, '耳の先に若葉が生えている。'],
  ['leaf', 'C', 'M', 'ミドリカナブン', 'comic', 'forest', { k: 'insect', kind: 'beetle', c: '#2a9a4a' }, '日に当たると宝石みたいに光る。', 'BZZZ!'],
  ['leaf', 'C', 'M', 'モリノシジミ', 'paper', 'forest', { k: 'insect', kind: 'butterfly', c: '#7ac8ff', wingC: '#8ad0ff', spotC: '#fff' }, '花から花へ、一日中いそがしい。'],
  ['leaf', 'U', 'M', '森のシカ', 'lowpoly', 'forest', { k: 'quad', c: '#a8743a', belly: '#f2dcb0', ears: 'tri', antlers: true, tail: 'puff', snout: 'long', legs: 'long', hoof: true, spots: true, spotC: '#f4ecdc', seed: 44 }, '角に小鳥が巣をつくっても気にしない。'],
  ['leaf', 'U', 'M', 'ワカバカマキリ', 'sketch', 'forest', { k: 'insect', kind: 'mantis', c: '#6ac85a' }, '祈るように見えて、実は狙っている。'],
  ['leaf', 'U', 'I', '世界樹の枝', 'ukiyo', 'forest', { k: 'item', kind: 'staff', c: '#7a5434', glow: '#c8ff8a' }, '地面に挿すと一晩で森になる。', '森'],
  ['leaf', 'R', 'F', '千年樹の森', 'oil', 'forest', { k: 'land', kind: 'bigtree' }, '森の属性のカードが元気になる場所。'],
  ['leaf', 'R', 'M', '苔むすゴーレム', 'real', 'forest', { k: 'spirit', kind: 'golem', c: '#7a7a6a', moss: '#5a9a3a', eye: '#9aff7a', seed: 47 }, '千年眠っていたら苔の家になった。'],
  ['leaf', 'SR', 'M', '大樹の守り人', 'water', 'forest', { k: 'spirit', kind: 'treant', c: '#4a9a4a', seed: 48 }, '森を荒らす者には根が絡みつく。'],
  ['leaf', 'SR', 'S', '百花繚乱', 'glass', 'meadow', { k: 'spell', kind: 'bloom', c: '#ff8ab6' }, '一瞬で野原を花畑に変える。'],
  ['leaf', 'UR', 'M', '森主オオカミ', 'real', 'forest', { k: 'quad', c: '#6a7a6a', belly: '#c8d0c0', ears: 'tri', tail: 'bushy', snout: 'long', legs: 'long', mane: true, maneC: '#4a5a3a', eye: '#c8ff6a', size: 1.1 }, '森の全部の声を聞いている、緑の王。'],
  // ---------- 雷 ----------
  ['bolt', 'C', 'M', 'ビリリス', 'pixel', 'storm', { k: 'quad', c: '#f2c040', belly: '#fff3c0', ears: 'tri', tail: 'bushy', tailC: '#ffe070', snout: 'flat', legs: 'short', eye: '#2a2320', stripes: true, stripeC: '#7a5a1a' }, 'ほっぺをこすると静電気が起きる。'],
  ['bolt', 'C', 'M', 'カミナリトンボ', 'neon', 'storm', { k: 'insect', kind: 'dragonfly', c: '#3af0ff', glow: '#fff36a', eye: '#fff36a' }, '雷の通り道を先回りして飛ぶ。'],
  ['bolt', 'C', 'M', 'デンキウナギ', 'comic', 'deep', { k: 'fish', kind: 'eel', c: '#4a6a7a' }, 'うっかり触ると髪が逆立つ。', 'ZAP!'],
  ['bolt', 'C', 'M', 'ピカホタル', 'paper', 'night', { k: 'spirit', kind: 'wisp', c: '#fff36a' }, '夏の夜に一斉に光って合図する。'],
  ['bolt', 'U', 'M', 'イカヅチヤギ', 'lowpoly', 'storm', { k: 'quad', c: '#e6e0cc', belly: '#fff', ears: 'tri', horns: true, hornC: '#f2c040', tail: 'puff', snout: 'long', legs: 'mid', hoof: true, eye: '#f2c040' }, '角に雷を集めて崖を駆けのぼる。'],
  ['bolt', 'U', 'M', '雷鳴の鷹', 'sketch', 'storm', { k: 'bird', kind: 'eagle', c: '#7a5a3a', belly: '#e6dcc4', headC: '#f4f0e6', beak: '#f2c040', eye: '#f2c040' }, '雷と同じ速さで急降下する。'],
  ['bolt', 'U', 'I', '稲妻の剣', 'ukiyo', 'storm', { k: 'item', kind: 'sword', c: '#c8a040', blade: '#e8f0ff', glow: '#fff36a', fx: 'bolt', gem: '#3a8aff' }, '抜くたびに空が光る。', '雷'],
  ['bolt', 'R', 'F', '嵐の荒野', 'oil', 'storm', { k: 'land', kind: 'plains' }, '雷の属性のカードが元気になる場所。'],
  ['bolt', 'R', 'M', '雷獣ライジュウ', 'real', 'storm', { k: 'quad', c: '#3a3a5a', belly: '#8a8aaa', ears: 'big', tail: 'bushy', tailC: '#fff36a', snout: 'long', legs: 'mid', eye: '#fff36a', cracks: '#fff36a' }, '雷と一緒に地上に落ちてくる獣。'],
  ['bolt', 'SR', 'M', '迅雷の麒麟', 'real', 'storm', { k: 'quad', c: '#e8c060', belly: '#fff0c0', ears: 'tri', horn: true, hornC: '#fff', hornGlow: '#fff36a', tail: 'bushy', tailC: '#fff3a0', snout: 'horse', mane: 'horse', maneC: '#fff3a0', legs: 'long', hoof: true, eye: '#3a8aff', spots: true, spotC: '#b0802a', seed: 55 }, '走った後には必ず虹が出る。'],
  ['bolt', 'SR', 'S', '落雷', 'glass', 'storm', { k: 'spell', kind: 'thunder', c: '#fff36a' }, '天の怒りを一点に落とす。'],
  ['bolt', 'UR', 'M', '雷神ガルーダ', 'real', 'storm', { k: 'bird', kind: 'eagle', c: '#c89a2a', belly: '#fff0b0', wingC: '#e0b030', spread: true, headC: '#f4e6b0', crest: true, crestC: '#fff36a', tail: 'long', tailC: '#f2c040', tailGlow: '#fff36a', beak: '#fff', eye: '#3af0ff' }, '翼をひと振りすると千の雷が鳴る。'],
  // ---------- 闇 ----------
  ['dark', 'C', 'M', 'オバケノコ', 'pixel', 'night', { k: 'spirit', kind: 'ghost', c: '#d8d0f0' }, 'おどかすつもりが、いつも先に驚く。'],
  ['dark', 'C', 'M', 'カゲネコ', 'sumi', 'night', { k: 'quad', c: '#2a2630', belly: '#4a4650', ears: 'tri', tail: 'long', snout: 'flat', legs: 'mid', eye: '#ffd84a', whisk: true }, '影から影へ、音もなく移る。', '影'],
  ['dark', 'C', 'M', 'ヤミスライム', 'sketch', 'night', { k: 'spirit', kind: 'slime', c: '#5a3a8a' }, '暗いところでは見えない。明るくても見えにくい。'],
  ['dark', 'C', 'M', 'ヨルノガ', 'water', 'night', { k: 'insect', kind: 'moth', c: '#6a5a8a', wingC: '#7a6a9a', spotC: '#c8b8ff', glowDust: '#c8b8ff' }, '羽の粉は夢の材料になる。'],
  ['dark', 'U', 'M', '墓守のカラス', 'ukiyo', 'night', { k: 'bird', c: '#1a1a24', belly: '#2a2a3a', wingC: '#14141c', beak: '#2a2a2a', eye: '#e2401a' }, '名前を三回呼ばれると返事をする。', '烏'],
  ['dark', 'U', 'I', '呪いの魔導書', 'real', 'cave', { k: 'item', kind: 'book', c: '#4a1a3a', glow: '#b07aff' }, '読んだページが次の日には書き変わる。'],
  ['dark', 'U', 'M', '影の大蛇', 'comic', 'night', { k: 'serpent', kind: 'snake', c: '#3a2a5a', eye: '#ff3a5a' }, '月の出ない夜に獲物を探す。', 'HISS!'],
  ['dark', 'R', 'F', '月夜の古城', 'oil', 'night', { k: 'land', kind: 'castle', c: '#3a3450' }, '闇の属性のカードが元気になる場所。'],
  ['dark', 'R', 'M', '冥界の番犬', 'real', 'night', { k: 'quad', c: '#2a2230', belly: '#4a3a4a', ears: 'tri', tail: 'thin', snout: 'long', legs: 'long', mane: true, maneC: '#1a1420', eye: '#ff3a2a', cracks: '#ff4a2a' }, '門をくぐる者を一人も逃さない。'],
  ['dark', 'SR', 'M', '堕天のフクロウ', 'sumi', 'night', { k: 'bird', kind: 'owl', c: '#3a3440', belly: '#6a6470', eye: '#ffd84a' }, '天から落ちて、夜の知恵を得た。', '梟'],
  ['dark', 'SR', 'S', '闇の深淵', 'neon', 'night', { k: 'spell', kind: 'abyss', c: '#b07aff' }, '光さえ帰ってこない穴を開ける。'],
  ['dark', 'UR', 'M', '冥王ノクス', 'real', 'night', { k: 'serpent', kind: 'west', c: '#2a2040', belly: '#5a4a7a', wingC: '#1a1428', hornC: '#c8c0d8', eye: '#ff3a5a', breath: '#b07aff' }, '夜そのものが形になった、闇の王。'],
  // ---------- 光 ----------
  ['light', 'C', 'M', 'ヒカリダマ', 'pixel', 'heaven', { k: 'spirit', kind: 'wisp', c: '#ffe08a' }, '迷子を見つけると家まで照らす。'],
  ['light', 'C', 'M', 'ハネウサギ', 'water', 'heaven', { k: 'quad', c: '#f4f0f6', belly: '#fff', ears: 'long', tail: 'puff', snout: 'flat', legs: 'short', wings: true, wingC: '#fff', eye: '#ff7aa0', whisk: true }, '耳と羽、どちらでも飛べる。'],
  ['light', 'C', 'M', 'キラキラチョウ', 'paper', 'heaven', { k: 'insect', kind: 'butterfly', c: '#ffb0d8', wingC: '#ffc8e6', spotC: '#fff6c0' }, '通った跡にきらきらが残る。'],
  ['light', 'C', 'M', 'シロハト', 'comic', 'heaven', { k: 'bird', c: '#f4f2f0', belly: '#fff', wingC: '#e0dcd8', beak: '#ff9a6a', eye: '#2a1a1a' }, '幸せの知らせを運んでくる。', 'COO!'],
  ['light', 'U', 'M', '聖なるシカ', 'lowpoly', 'heaven', { k: 'quad', c: '#f4ecdc', belly: '#fff', ears: 'tri', antlers: true, antlerC: '#ffd84a', tail: 'puff', snout: 'long', legs: 'long', hoof: true, eye: '#3a8aff' }, '金の角から朝日が生まれる。'],
  ['light', 'U', 'I', '天使の王冠', 'real', 'heaven', { k: 'item', kind: 'crown', c: '#e8b830', glow: '#fff3c0' }, 'かぶると少しだけ正直になる。'],
  ['light', 'U', 'I', '光のクリスタル', 'glass', 'heaven', { k: 'spirit', kind: 'crystal', c: '#ffc0e6', seed: 66 }, '覗くと少し先の未来が見える。'],
  ['light', 'R', 'F', '天空の島', 'oil', 'heaven', { k: 'land', kind: 'island' }, '光の属性のカードが元気になる場所。'],
  ['light', 'R', 'M', '白銀のペガサス', 'real', 'heaven', { k: 'quad', c: '#e8eaf0', belly: '#fff', ears: 'tri', wings: true, wingC: '#fff', tail: 'bushy', tailC: '#f0f4ff', snout: 'horse', mane: 'horse', maneC: '#dfe8ff', legs: 'long', hoof: true, eye: '#3a6aff' }, '雲の上を走ると雪が降る。'],
  ['light', 'SR', 'M', '聖獣ユニコーン', 'oil', 'heaven', { k: 'quad', c: '#fbf6ff', belly: '#fff', ears: 'tri', horn: true, hornC: '#ffe08a', hornGlow: '#fff3a0', tail: 'bushy', tailC: '#ffc0e6', snout: 'horse', mane: 'horse', maneC: '#c8b0ff', legs: 'long', hoof: true, eye: '#b07aff' }, 'その角はどんな毒も消してしまう。'],
  ['light', 'SR', 'S', '天の裁き', 'neon', 'heaven', { k: 'spell', kind: 'judgement', c: '#fff3a0' }, '雲を裂いて光の柱が降りる。'],
  ['light', 'UR', 'M', '聖竜ルミナ', 'real', 'heaven', { k: 'serpent', kind: 'west', c: '#f2ecf8', belly: '#fff6d8', wingC: '#ffe8f4', hornC: '#e8b830', eye: '#3a8aff' }, '世界に朝を運ぶ、光の王。'],
  // ---------- シークレット ----------
  ['light', 'SEC', 'M', '星を抱く始祖ネコ', 'star', 'space', { k: 'quad', c: '#ffe9a8', belly: '#fff', ears: 'tri', tail: 'long', snout: 'flat', legs: 'mid', whisk: true, wings: true, wingC: '#fff' }, '星の始まりから生きている、名前のない存在。'],
  ['dark', 'SEC', 'M', '夜を食む九尾', 'sumi', 'night', { k: 'quad', c: '#f2e0b0', belly: '#fff6e0', ears: 'big', tail: 'nine', snout: 'long', legs: 'mid', eye: '#c8322a' }, '月が欠けるのは、この尾が触れたから。', '九尾', true],
];
const TYPE_NM = { M: 'モンスター', S: '魔法', F: 'フィールド', I: 'アイテム' };
const seedOf = s => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
global.CARD_DEFS = D.map((d, i) => ({ no: i + 1, el: d[0], r: d[1], type: d[2], typeNm: TYPE_NM[d[2]], nm: d[3], style: d[4], scene: d[5], sub: d[6], txt: d[7], sfx: d[4] === 'comic' ? d[8] : undefined, stamp: d[4] !== 'comic' ? d[8] : undefined, gold: d[9], seed: seedOf(d[3]) % 100000 }));
})(window);
