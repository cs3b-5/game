# 第五弾「海賊と宝島」のカード一覧（No.213〜258）
# python set5.py → prompts5.txt（Forge の「Prompts from file or textbox」用）
# 新しい資源「🪙宝」：🏴略奪（相手のライフに当てると宝+1）・🪙宝拾い（出たとき宝+N）
#                     💎宝使い（出たとき宝を使って追加効果）・💰財宝（宝の数だけATK+）
# シード = 1000 + カード番号
from make_prompts import STYLE, NEG

# [番号, 属性, レア, 種類, 名前, 説明文, 画風, 題材（英語）]
CARDS = [
 # ---------- 炎：大砲と火薬 ----------
 (213, 'fire', 'C', 'M', 'カヤクザル', 'たるの火薬で、なんでも吹き飛ばしたがる。', 'comic',
  'a mischievous little monkey pirate with a bandana carrying a small gunpowder barrel with a burning fuse, pirate ship deck'),
 (214, 'fire', 'C', 'M', 'タルばくだんネズミ', '中身は火薬か、ラム酒か。', 'pixel',
  'a small mouse pirate hugging a wooden barrel bomb, sparks, pirate ship'),
 (215, 'fire', 'U', 'M', '大砲うちのクマ', '砲弾も、片手で軽々と運ぶ。', 'paper',
  'a big bear pirate gunner loading a cannon on a pirate ship, smoke and fire'),
 (216, 'fire', 'R', 'M', 'ひげの砲撃長', '自慢のひげは、火薬で少しこげている。', 'oil',
  'a walrus pirate with a huge beard commanding a row of firing cannons on a pirate ship, smoke'),
 (217, 'fire', 'SR', 'M', '炎の海賊船長', '燃える帆の船で、七つの海を駆ける。', 'real',
  'a fox pirate captain with a red coat and tricorn hat standing on a ship with burning sails, sea at sunset'),
 # ---------- 水：海と船 ----------
 (218, 'water', 'C', 'M', 'カモメの見張り番', 'マストのてっぺんで、いつも宝をさがしている。', 'water',
  'a seagull pirate with a tiny spyglass sitting on top of a ship mast, blue sky and sea'),
 (219, 'water', 'C', 'M', 'イルカの水夫', '泳ぎなら、どんな海賊にも負けない。', 'pixel',
  'a cheerful dolphin sailor with a striped shirt jumping out of the waves next to a pirate ship'),
 (220, 'water', 'U', 'M', 'セイレーン', '歌声で、船をまよわせる。', 'oil',
  'a beautiful siren sea spirit singing on a rock in the moonlit sea, a ship in the distance'),
 (221, 'water', 'R', 'M', '海賊ザメ', '金の歯を光らせて、船ごとかじる。', 'comic',
  'a fierce shark pirate with gold teeth and an eye patch bursting out of the sea'),
 (222, 'water', 'SR', 'M', '嵐を呼ぶ大海賊', 'この男の船が来ると、海が荒れる。', 'real',
  'a giant pirate captain made of sea water and storm clouds standing on a ship in a huge storm, lightning'),
 (223, 'water', 'UR', 'M', '黄金のガレオン船', '船底まで、金貨でうまっている。', 'real',
  'a magnificent golden galleon ship with glowing sails sailing on a calm sea at sunset, treasure overflowing'),
 # ---------- 森：宝島 ----------
 (224, 'leaf', 'C', 'M', 'ヤシガニ', '島のヤシの実は、ぜんぶこいつのもの。', 'paper',
  'a coconut crab holding a coconut on a tropical beach with palm trees'),
 (225, 'leaf', 'C', 'M', '宝島のオウム', '宝のありかを、知っているらしい。', 'water',
  'a colorful parrot sitting on a treasure map in a tropical jungle'),
 (226, 'leaf', 'U', 'M', 'ジャングルのワニ', '宝箱のふたを、あごで開ける。', 'comic',
  'a crocodile with a pirate hat guarding a treasure chest in a jungle river'),
 (227, 'leaf', 'R', 'M', '島の守り神トーテム', '宝をねらう者を、じっと見ている。', 'oil',
  'a giant ancient wooden totem guardian with glowing eyes on a tropical island, jungle and ruins'),
 (228, 'leaf', 'SR', 'M', '宝島の主', '島そのものが、この大猿の宝物。', 'real',
  'a giant ape king sitting on a mountain of treasure on a jungle island, waterfalls, sunlight'),
 # ---------- 雷：嵐の航海 ----------
 (229, 'bolt', 'C', 'M', 'イナズマトビウオ', '雷をまとって、波の上を跳ぶ。', 'pixel',
  'a flying fish crackling with electricity leaping over stormy waves'),
 (230, 'bolt', 'C', 'M', 'マストのぼりのテナガザル', '帆を張るのは、いちばん速い。', 'comic',
  'a gibbon pirate swinging from the ropes of a ship mast in a thunderstorm'),
 (231, 'bolt', 'U', 'M', '嵐の航海士ペンギン', '羅針盤が雷で回っても、迷わない。', 'paper',
  'a penguin navigator with a glowing compass on a ship deck in a thunderstorm'),
 (232, 'bolt', 'R', 'M', '稲妻のカジキ剣士', '鼻先の剣で、雷ごと切りさく。', 'oil',
  'a swordfish swordsman pirate with a lightning-charged sword leaping from the stormy sea'),
 # ---------- 闇：幽霊船と呪いの財宝 ----------
 (233, 'dark', 'C', 'M', 'ガイコツ水夫', '骨になっても、まだ宝をさがしている。', 'sumi',
  'a skeleton sailor with a bandana and a lantern on a ghost ship, fog'),
 (234, 'dark', 'C', 'M', 'のろいの金貨ガエル', 'さわった金貨が、カエルになった。', 'neon',
  'a frog made of cursed gold coins with glowing purple eyes, dark cave treasure'),
 (235, 'dark', 'U', 'M', '幽霊船のコウモリ', 'やぶれた帆に、ぶらさがって眠る。', 'comic',
  'a bat hanging from the torn sails of a ghost ship under a full moon'),
 (236, 'dark', 'R', 'M', '幽霊船長', '百年前に沈んだ宝を、いまも数えている。', 'oil',
  'a ghost pirate captain glowing green counting gold coins in a sunken ship, eerie light'),
 (237, 'dark', 'SEC', 'M', '呪われた財宝の王', '王の宝にふれた者は、ひとり残らず消えた。', 'real',
  'a terrifying skeletal king sitting on a cursed treasure hoard in an underwater cave, purple glowing gold, chains'),
 # ---------- 光：黄金と財宝 ----------
 (238, 'light', 'C', 'M', '金貨ハムスター', 'ほっぺの中は、いつも金貨でいっぱい。', 'water',
  'a cute hamster with cheeks full of gold coins sitting on a pile of coins'),
 (239, 'light', 'C', 'M', '宝石カナリア', '宝石の色で、きれいな声が変わる。', 'pixel',
  'a small canary bird made of sparkling gemstones on a treasure chest'),
 (240, 'light', 'U', 'M', '王冠のペリカン', 'くちばしの中に、王冠をしまっている。', 'paper',
  'a pelican wearing a golden crown with jewels in its beak on a sunny pier'),
 (241, 'light', 'R', 'M', '黄金郷の番人', '金の毛皮は、本物の金でできている。', 'gold',
  'a majestic golden jaguar guardian in an ancient golden temple, sunlight'),
 (242, 'light', 'SR', 'M', '黄金の大鷲', 'ひと羽ばたきで、金の羽根が雨のように降る。', 'real',
  'a giant golden eagle with shining golden feathers soaring over a treasure island, golden light'),
 (243, 'light', 'UR', 'M', '太陽の財宝神', '島の太陽は、この神の首飾り。', 'gold',
  'a radiant sun god made of gold and jewels rising over a treasure island, ancient temple'),
 (244, 'light', 'SEC', 'M', '大海賊キャプテン・ネコ', 'この世の宝は、ぜんぶ吾輩のものだ。', 'real',
  'a legendary cat pirate captain with a big feathered hat and golden coat standing on a mountain of treasure on a ship deck, flag waving'),
 # ---------- アイテム ----------
 (245, 'light', 'U', 'I', '金貨の袋', 'ずっしり重い。それだけで心強い。', 'oil',
  'a leather bag overflowing with gold coins on a wooden table'),
 (246, 'fire', 'U', 'I', '海賊のカトラス', '略奪には、これがいちばん。', 'oil',
  'a pirate cutlass sword with a golden hand guard stuck in the sand, sunset'),
 (247, 'dark', 'U', 'I', '船長の帽子', 'かぶると、宝のにおいがわかる。', 'oil',
  'a black pirate captain tricorn hat with a skull emblem and a feather on a treasure chest'),
 (248, 'water', 'U', 'I', '船の錨', 'どんな嵐でも、ここから動かない。', 'lowpoly',
  'a heavy iron ship anchor on the sea floor with seaweed and bubbles'),
 (249, 'bolt', 'U', 'I', '海賊の望遠鏡', '水平線の向こうの宝まで見える。', 'lowpoly',
  'a brass pirate spyglass telescope on a map, stormy sky'),
 # ---------- フィールド ----------
 (250, 'leaf', 'R', 'F', '宝島', '地図の×印の場所。', 'oil',
  'a tropical treasure island with palm trees and a big X mark on the sand, turquoise sea, no creatures'),
 (251, 'water', 'R', 'F', '海賊船の甲板', '旗をかかげて、いざ出航。', 'oil',
  'the wooden deck of a pirate ship with cannons and a skull flag, open sea, no creatures'),
 (252, 'dark', 'R', 'F', '幽霊船', '霧の中から、音もなくあらわれる。', 'oil',
  'a ghost ship with torn sails emerging from thick fog at night, green glow, no creatures'),
 (253, 'light', 'R', 'F', '黄金郷', 'すべてが金でできた、まぼろしの都。', 'gold',
  'a legendary golden city El Dorado in a jungle, golden temples and pyramids, sunlight, no creatures'),
 # ---------- 魔法 ----------
 (254, 'leaf', 'SR', 'S', '宝の地図', '×印の下を、掘ってみよう。', 'water',
  'an old treasure map with a red X mark and a compass, magical glow'),
 (255, 'fire', 'SR', 'S', '一斉砲撃', '撃て！ 全砲門、ひらけ！', 'real',
  'a pirate ship firing all its cannons at once, huge explosions and smoke over the sea'),
 (256, 'light', 'SR', 'S', '黄金の雨', '空から、金貨が降ってくる。', 'glass',
  'gold coins raining down from the sky over a pirate ship, golden light'),
 (257, 'water', 'SR', 'S', '海の藻屑', '深い海の底へ、まっさかさま。', 'neon',
  'a whirlpool dragging a ship down into the dark deep sea, glowing blue'),
 (258, 'dark', 'UR', 'S', 'ドクロの旗', 'この旗を見たら、宝を置いて逃げろ。', 'real',
  'a black pirate flag with a skull and crossbones waving in a storm, lightning, dramatic'),
]

if __name__ == '__main__':
    import os
    from collections import Counter
    out = [f'--prompt "{sub}, {STYLE[st]}" --negative_prompt "{NEG}" --width 1024 --height 768 --seed {1000 + no}' for no, el, r, t, nm, txt, st, sub in CARDS]
    path = os.path.join(os.path.dirname(__file__), 'prompts5.txt')
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(out), 'prompts ->', path)
    print(Counter(c[2] for c in CARDS), Counter(c[3] for c in CARDS))
