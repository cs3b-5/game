// 奈落の迷宮 — データ（敵・アイテム）
export const FLOORS = 20;

// 敵：hp atk def xp, sp=1行動あたりの回数（2=速い, .5=遅い）, f=[出る階の最初, 最後], ab=特技
export const MONS = {
  slime:    { nm: '闇スライム',   hp: 7,   atk: 3,  def: 0,  xp: 3,   sp: 1,  f: [1, 5],   col: 0x3a2a6a },
  bat:      { nm: '血吸いコウモリ', hp: 5, atk: 2,  def: 0,  xp: 4,   sp: 2,  f: [1, 7],   col: 0x4a1a2a, ab: 'erratic' },
  goblin:   { nm: '洞窟ゴブリン', hp: 13,  atk: 5,  def: 1,  xp: 7,   sp: 1,  f: [2, 8],   col: 0x4a6a2a },
  skeleton: { nm: 'さまよう骸骨', hp: 18,  atk: 6,  def: 3,  xp: 10,  sp: 1,  f: [3, 10],  col: 0xd8d0b8 },
  spider:   { nm: '毒グモ',       hp: 15,  atk: 5,  def: 2,  xp: 11,  sp: 1,  f: [4, 11],  col: 0x2a2a30, ab: 'poison' },
  wolf:     { nm: '影オオカミ',   hp: 20,  atk: 7,  def: 3,  xp: 15,  sp: 2,  f: [5, 13],  col: 0x30303a },
  wisp:     { nm: '鬼火',         hp: 16,  atk: 7,  def: 2,  xp: 14,  sp: 1,  f: [6, 14],  col: 0x4adfff, ab: 'fire' },
  ghost:    { nm: '嘆きの亡霊',   hp: 26,  atk: 9,  def: 4,  xp: 20,  sp: 1,  f: [7, 15],  col: 0xa8b8d0, ab: 'phase' },
  cultist:  { nm: '闇の呪術師',   hp: 24,  atk: 8,  def: 4,  xp: 24,  sp: 1,  f: [8, 17],  col: 0x5a1a4a, ab: 'curse' },
  mimic:    { nm: 'ミミック',     hp: 34,  atk: 10, def: 5,  xp: 35,  sp: 1,  f: [8, 20],  col: 0x8a5a2a, ab: 'mimic' },
  orc:      { nm: 'オーク狂戦士', hp: 45,  atk: 13, def: 6,  xp: 32,  sp: 1,  f: [9, 18],  col: 0x5a7a3a },
  gargoyle: { nm: 'ガーゴイル',   hp: 55,  atk: 15, def: 10, xp: 42,  sp: 1,  f: [12, 20], col: 0x6a6a72 },
  knight:   { nm: '堕ちた騎士',   hp: 70,  atk: 18, def: 12, xp: 60,  sp: 1,  f: [14, 20], col: 0x2a2a38 },
  wraith:   { nm: '死神',         hp: 60,  atk: 20, def: 8,  xp: 70,  sp: 1,  f: [16, 20], col: 0x1a1a24, ab: 'phase' },
  // ボス
  boneking: { nm: '骸骨王ヴァルグ', hp: 220, atk: 18, def: 10, xp: 400, sp: 1, f: [0, 0], col: 0xe8dcc0, boss: 1, ab: 'summon' },
  abyss:    { nm: '奈落の主',     hp: 520,  atk: 30, def: 18, xp: 1500, sp: 1, f: [0, 0], col: 0x3a0a4a, boss: 1, ab: 'breath' },
};

// アイテム：k=種類（weapon shield ring potion scroll food wand throw）
export const ITEMS = {
  // 武器
  rusty:    { k: 'weapon', nm: '錆びた剣',   v: 2,  f: 1, w: 6 },
  dagger:   { k: 'weapon', nm: '短剣',       v: 3,  f: 1, w: 6 },
  longsword:{ k: 'weapon', nm: '長剣',       v: 5,  f: 3, w: 5 },
  axe:      { k: 'weapon', nm: '戦斧',       v: 7,  f: 5, w: 4 },
  katana:   { k: 'weapon', nm: '妖刀',       v: 9,  f: 8, w: 3 },
  greatsword:{ k: 'weapon', nm: '黒鉄の大剣', v: 12, f: 11, w: 2 },
  holy:     { k: 'weapon', nm: '聖剣ルミナ', v: 16, f: 15, w: 1 },
  // 盾
  woodshield:{ k: 'shield', nm: '木の盾',     v: 2,  f: 1, w: 6 },
  leather:  { k: 'shield', nm: '革の盾',     v: 3,  f: 2, w: 5 },
  iron:     { k: 'shield', nm: '鉄の盾',     v: 5,  f: 4, w: 4 },
  knightsh: { k: 'shield', nm: '騎士の大盾', v: 8,  f: 8, w: 3 },
  dragonsh: { k: 'shield', nm: '竜鱗の盾',   v: 11, f: 12, w: 2 },
  // 指輪
  r_str:    { k: 'ring', nm: '力の指輪',     f: 3, w: 2, eff: 'atk3' },
  r_def:    { k: 'ring', nm: '守りの指輪',   f: 3, w: 2, eff: 'def3' },
  r_regen:  { k: 'ring', nm: '再生の指輪',   f: 5, w: 2, eff: 'regen' },
  r_belly:  { k: 'ring', nm: '腹持ちの指輪', f: 4, w: 2, eff: 'belly' },
  r_sight:  { k: 'ring', nm: '透視の指輪',   f: 7, w: 1, eff: 'sight' },
  // 薬（はじめは見た目だけ）
  p_heal:   { k: 'potion', nm: '回復薬',     f: 1, w: 10 },
  p_bigheal:{ k: 'potion', nm: '大回復薬',   f: 5, w: 4 },
  p_str:    { k: 'potion', nm: '力の薬',     f: 2, w: 3 },
  p_life:   { k: 'potion', nm: '命の薬',     f: 4, w: 2 },
  p_xp:     { k: 'potion', nm: '経験の薬',   f: 3, w: 2 },
  p_poison: { k: 'potion', nm: '毒薬',       f: 1, w: 4 },
  p_confuse:{ k: 'potion', nm: '混乱の薬',   f: 2, w: 3 },
  p_sight:  { k: 'potion', nm: '千里眼の薬', f: 2, w: 3 },
  // 巻物（はじめは見た目だけ）
  s_map:    { k: 'scroll', nm: '地図の巻物',   f: 1, w: 7 },
  s_thunder:{ k: 'scroll', nm: '雷鳴の巻物',   f: 2, w: 5 },
  s_sleep:  { k: 'scroll', nm: '眠りの巻物',   f: 2, w: 5 },
  s_weapon: { k: 'scroll', nm: '武器強化の巻物', f: 1, w: 5 },
  s_shield: { k: 'scroll', nm: '盾強化の巻物', f: 1, w: 5 },
  s_ident:  { k: 'scroll', nm: '識別の巻物',   f: 1, w: 6 },
  s_teleport:{ k: 'scroll', nm: '転移の巻物',  f: 1, w: 5 },
  s_purify: { k: 'scroll', nm: '解呪の巻物',   f: 3, w: 3 },
  s_fear:   { k: 'scroll', nm: '恐怖の巻物',   f: 4, w: 3 },
  // 食べ物
  bread:    { k: 'food', nm: '黒パン',       f: 1, w: 12, v: 50 },
  bigbread: { k: 'food', nm: '大きな黒パン', f: 3, w: 3, v: 100 },
  jerky:    { k: 'food', nm: '干し肉',       f: 1, w: 5, v: 30, hp: 10 },
  // 杖（回数つき）
  w_blow:   { k: 'wand', nm: 'ふきとばしの杖', f: 1, w: 3 },
  w_slow:   { k: 'wand', nm: '鈍足の杖',       f: 2, w: 3 },
  w_bolt:   { k: 'wand', nm: '雷撃の杖',       f: 3, w: 3 },
  w_swap:   { k: 'wand', nm: '入れ替えの杖',   f: 2, w: 2 },
  w_seal:   { k: 'wand', nm: '封印の杖',       f: 5, w: 2 },
  // 投げる
  knife:    { k: 'throw', nm: '投げナイフ',   f: 1, w: 5, v: 6 },
  holywater:{ k: 'throw', nm: '聖水',         f: 4, w: 2, v: 25 },
};
// 薬と巻物の「見た目の名前」（プレイごとにシャッフル）
export const POTION_LOOKS = ['赤い薬', '青い薬', '緑の薬', '黄色い薬', '紫の薬', '黒い薬', '白い薬', '銀色の薬', '濁った薬', '光る薬'];
export const SCROLL_LOOKS = ['「ヴォル」の巻物', '「ネザ」の巻物', '「ルー」の巻物', '「ガラク」の巻物', '「シェム」の巻物', '「イオ」の巻物', '「バル」の巻物', '「ケセド」の巻物', '「ウル」の巻物', '「ザイン」の巻物'];
export const WAND_LOOKS = ['樫の杖', '骨の杖', '黒檀の杖', '水晶の杖', '銀の杖', '血塗れの杖'];

export const TRAPS = {
  pit: { nm: '落とし穴' }, arrow: { nm: '毒矢の罠' }, summon: { nm: '召喚の罠' }, sleep: { nm: '眠りガスの罠' }, rust: { nm: 'さびの罠' },
};
