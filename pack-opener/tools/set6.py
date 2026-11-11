# 第六弾「一か八か」のカード一覧（No.259〜304）
# python set6.py → prompts6.txt（Forge の「Prompts from file or textbox」用）
# テーマは運とギャンブル：🎲サイコロ（出たとき1〜6の目で効果が変わる）・🪙コイン（攻撃のたびに表ならダメージ2倍、裏なら0）
#                         🍀ツキ（自分のサイコロは2回振って高いほう、コインは2回投げて表があれば表）・🎰大当たり（1/6でとんでもない効果）
# シード = 1000 + カード番号
from make_prompts import STYLE, NEG

# [番号, 属性, レア, 種類, 名前, 説明文, 画風, 題材（英語）]
CARDS = [
 # ---------- 炎：サイコロで攻める ----------
 (259, 'fire', 'C', 'M', 'サイコロネズミ', 'ふたつのサイコロを、いつも転がしている。', 'pixel',
  'a small mouse rolling two big red dice on a green casino table, playful'),
 (260, 'fire', 'C', 'M', 'チップかじりリス', 'カジノのチップを、どんぐりとまちがえている。', 'comic',
  'a squirrel nibbling on a stack of colorful casino poker chips'),
 (261, 'fire', 'U', 'M', '火吹きディーラー', 'カードを配るたびに、火花が散る。', 'paper',
  'a lizard casino dealer in a vest breathing small flames while dealing playing cards'),
 (262, 'fire', 'R', 'M', 'ルーレットの火の玉', '回るたびに、どこに落ちるかわからない。', 'oil',
  'a spirit made of fire spinning inside a giant roulette wheel, sparks and casino lights'),
 (263, 'fire', 'SR', 'M', '大当たりの火の鳥', '当たりの音が鳴ると、空いっぱいに火の粉が散る。', 'real',
  'a phoenix bursting out of a slot machine showing three sevens, coins and fire everywhere, casino'),
 # ---------- 水：コインの表と裏 ----------
 (264, 'water', 'C', 'M', 'コイントスのカワウソ', '表が出るまで、何度でも投げる。', 'water',
  'a cute otter flipping a shiny coin in the air on a river'),
 (265, 'water', 'C', 'M', '泡のスロットクラゲ', 'さわると、泡のリールがくるくる回る。', 'pixel',
  'a jellyfish with a tiny slot machine reel in its glowing bell, bubbles, deep sea'),
 (266, 'water', 'U', 'M', 'トランプ投げのアシカ', 'ボールのかわりに、トランプでジャグリング。', 'comic',
  'a sea lion juggling playing cards on a circus stage by the sea'),
 (267, 'water', 'R', 'M', 'イカサマ師のタコ', '八本の腕のどれかに、エースをかくしている。', 'oil',
  'a sly octopus card shark in a hat hiding aces in each of its tentacles at a poker table'),
 (268, 'water', 'SR', 'M', '深海の賭博王シャチ', '海の底のカジノで、負けたことがない。', 'real',
  'a powerful orca in a tuxedo sitting at an underwater casino table with glowing chips'),
 (269, 'water', 'UR', 'M', 'ポーカーフェイスの皇帝ペンギン', '何を考えているか、だれにもわからない。', 'real',
  'an emperor penguin wearing sunglasses holding a royal flush of playing cards, icy casino'),
 # ---------- 森：ツキと幸運 ----------
 (270, 'leaf', 'C', 'M', '四つ葉ウサギ', '耳の先に、四つ葉がはえている。', 'water',
  'a small rabbit with four-leaf clovers growing on its ears in a meadow'),
 (271, 'leaf', 'C', 'M', 'どんぐりダイス', 'どんぐりの帽子をかぶった、森のサイコロ。', 'paper',
  'a wooden dice creature wearing an acorn cap rolling in the forest'),
 (272, 'leaf', 'U', 'M', '運まかせのカエル', '跳ぶ方向は、いつもサイコロで決める。', 'comic',
  'a frog jumping over a giant dice in a pond, lily pads'),
 (273, 'leaf', 'R', 'M', '森の賭場のタヌキ', '葉っぱのお金で、なんでも賭ける。', 'oil',
  'a tanuki raccoon dog gambling boss holding leaf money and dice in a forest den'),
 (274, 'leaf', 'SR', 'M', '幸運の白い大鹿', 'この鹿を見た日は、何をやってもうまくいく。', 'real',
  'a majestic white stag with antlers covered in glowing four-leaf clovers in a misty forest'),
 # ---------- 雷：一か八か ----------
 (275, 'bolt', 'C', 'M', 'スロットバチ', 'しま模様が、スロットのリールになっている。', 'pixel',
  'a bee whose striped body looks like a slot machine reel, electric sparks'),
 (276, 'bolt', 'C', 'M', 'ダイスモモンガ', 'サイコロをかかえて、雷雲から滑空する。', 'comic',
  'a flying squirrel gliding from storm clouds while hugging a big dice'),
 (277, 'bolt', 'U', 'M', '一か八かのイタチ', '勝つか負けるか、それが楽しい。', 'paper',
  'a daring weasel throwing a lightning coin in a thunderstorm'),
 (278, 'bolt', 'R', 'M', '雷のスロットマシン', '雷が落ちると、勝手に回りだす。', 'oil',
  'a living slot machine golem crackling with lightning, three reels spinning, coins flying'),
 (279, 'bolt', 'UR', 'M', '億万長者の雷鳥', '雷のように、勝ちも負けも一瞬。', 'real',
  'a giant thunderbird made of lightning and golden coins flying over a neon casino city at night'),
 # ---------- 闇：悪運と賭け ----------
 (280, 'dark', 'C', 'M', '借金取りのカラス', '貸したコインは、かならず取り立てる。', 'sumi',
  'a crow with a tiny bowler hat holding a coin in its beak, dark alley'),
 (281, 'dark', 'C', 'M', 'ドクロのサイコロ', '1の目が出ると、自分にかみつく。', 'neon',
  'a creepy dice creature with skull pips and sharp teeth, purple neon glow'),
 (282, 'dark', 'U', 'M', '悪運のヤモリ', '何度落ちても、なぜか助かる。', 'comic',
  'a gecko clinging to a falling playing card tower, lucky escape, dark background'),
 (283, 'dark', 'R', 'M', '闇カジノの支配人', 'このカジノでは、いつも胴元が勝つ。', 'oil',
  'a vampire bat casino boss in a velvet suit counting chips in a dark underground casino'),
 (284, 'dark', 'SEC', 'M', 'すべてを賭けた悪魔', '賭けるのは、自分の命でもかまわない。', 'real',
  'a grinning demon gambler flipping a giant glowing coin above a dark casino table, half of his body in shadow'),
 # ---------- 光：大当たり ----------
 (285, 'light', 'C', 'M', 'ラッキーセブンの子猫', '7の数字が、なによりも好き。', 'water',
  'a cute kitten playing with a big golden number seven'),
 (286, 'light', 'C', 'M', 'チップのハト', '平和のしるしに、チップを運ぶ。', 'pixel',
  'a white dove carrying a golden casino chip in its beak, sunny sky'),
 (287, 'light', 'U', 'M', 'ディーラーのウサギ', 'どの手札も、にっこり笑って配る。', 'paper',
  'a rabbit casino dealer with a bow tie dealing golden cards'),
 (288, 'light', 'R', 'M', '勝利の女神フクロウ', 'このフクロウが鳴くと、運がこっちを向く。', 'oil',
  'a radiant owl goddess of fortune with golden feathers holding a laurel wreath and a coin'),
 (289, 'light', 'SR', 'M', 'ルーレットの天使', '回る輪の上で、勝ちを数えている。', 'glass',
  'an angel standing on top of a golden roulette wheel, light rays, stained glass style'),
 (290, 'light', 'SEC', 'M', 'ジャックポット・ドラゴン', '三つの7がそろったとき、空から舞い降りる。', 'real',
  'a golden dragon emerging from an exploding jackpot slot machine with three lucky sevens, rivers of gold coins, dazzling lights'),
 # ---------- アイテム ----------
 (291, 'leaf', 'U', 'I', 'イカサマのサイコロ', 'なぜか、いい目ばかり出る。', 'lowpoly',
  'a glowing green loaded dice with only sixes on a velvet table'),
 (292, 'fire', 'U', 'I', '全額ベット', 'ぜんぶ、この一勝負に。', 'comic',
  'a huge pile of casino chips being pushed to the center of the table, all in'),
 (293, 'light', 'U', 'I', 'ラッキーセブン', '7が出たら最強。出なければ……。', 'gold',
  'a shining golden number seven charm with sparkles'),
 (294, 'water', 'U', 'I', '四つ葉のブローチ', '持っていると、ちょっといいことがある。', 'glass',
  'a crystal brooch shaped like a four-leaf clover glowing softly'),
 # ---------- フィールド ----------
 (295, 'dark', 'R', 'F', '地下カジノ', 'ここでは、ツキが少しだけこっちを向く。', 'oil',
  'an underground casino with red velvet tables and dim golden lamps, no people'),
 (296, 'fire', 'R', 'F', 'ルーレット場', '赤か黒か。それだけで、すべてが決まる。', 'oil',
  'a grand roulette table in a fiery red casino hall, no people'),
 (297, 'water', 'R', 'F', '幸運の泉', 'コインを投げこむと、願いがかなうらしい。', 'water',
  'a beautiful wishing fountain full of shining coins in a plaza, no people'),
 (298, 'bolt', 'R', 'F', 'スロット通り', 'ネオンと電子音が鳴りやまない。', 'neon',
  'a street lined with flashing neon slot machines at night, no people'),
 # ---------- 魔法（ばかなカード多め） ----------
 (299, 'fire', 'SR', 'S', '運命のルーレット', '赤なら攻め、黒なら自滅、緑なら……。', 'real',
  'a giant glowing roulette wheel spinning in the night sky, red black and one green pocket, dramatic'),
 (300, 'dark', 'SR', 'S', 'オールイン', '命を半分、テーブルに置く。', 'neon',
  'a dramatic poker all-in moment, chips shaped like hearts pushed into the center, neon light'),
 (301, 'light', 'SR', 'S', '仕切り直し', 'さっきまでのことは、なかったことに。', 'glass',
  'a magical reset spell, an hourglass and shuffling cards in golden light'),
 (302, 'water', 'SR', 'S', 'すってんてん', 'ぜんぶ失って、また一から。', 'comic',
  'playing cards flying away in the wind leaving empty hands, funny scene'),
 (303, 'leaf', 'UR', 'S', 'ダブルアップ', '倍か、半分か。', 'oil',
  'two giant coins clashing in the air, one golden shining one dark cracked, green magic'),
 (304, 'bolt', 'UR', 'S', '大博打', 'ゾロ目が出たら、伝説になる。', 'real',
  'two giant dice tumbling through a lightning storm showing double sixes, epic'),
]

if __name__ == '__main__':
    import os
    from collections import Counter
    out = [f'--prompt "{sub}, {STYLE[st]}" --negative_prompt "{NEG}" --width 1024 --height 768 --seed {1000 + no}' for no, el, r, t, nm, txt, st, sub in CARDS]
    path = os.path.join(os.path.dirname(__file__), 'prompts6.txt')
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(out), 'prompts ->', path)
    print(Counter(c[2] for c in CARDS), Counter(c[3] for c in CARDS))
