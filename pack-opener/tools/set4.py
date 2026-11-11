# 第四弾「破壊と秩序」のカード一覧（No.167〜212）
# python set4.py → prompts4.txt（Forge の「Prompts from file or textbox」用）
# これまでの仕組み（フィールド・アイテム・守り・回復・連結・進化・高レア・魔法）すべてのカウンターになる弾。
# 第四弾のモンスターは、C・Uも含めて全員が属性ごとの「カウンター能力」を持つ。
#   炎=🔨破壊  雷=🗡貫通  水=⛓封印  闇=⛔禁癒  光=⚖天秤  森=✂分断
# シード = 1000 + カード番号
from make_prompts import STYLE, NEG

# [番号, 属性, レア, 種類, 名前, 説明文, 画風, 題材（英語）]
CARDS = [
 # ---------- 炎：🔨破壊（フィールドやアイテムを壊す） ----------
 (167, 'fire', 'C', 'M', 'ハンマーこぞう', '気になるものは、とりあえずたたいてみる。', 'comic',
  'a small mischievous fire imp swinging a huge wooden hammer, smashing rocks, sparks flying, rubble'),
 (168, 'fire', 'C', 'M', 'ガレキムシ', 'こわれた壁をかじって、どんどん大きくなる。', 'pixel',
  'a small beetle creature with a glowing ember shell chewing on broken bricks and rubble'),
 (169, 'fire', 'U', 'M', '鉄球ゴリラ', '鎖つきの鉄球を、片手でふり回す。', 'paper',
  'a strong gorilla made of rusty scrap iron swinging a wrecking ball on a chain, broken walls'),
 (170, 'fire', 'R', 'M', '破砕の大槌兵', 'ひとふりで、城門ごと吹き飛ばす。', 'oil',
  'a giant armored warrior with a colossal flaming war hammer smashing through a castle gate, debris flying'),
 (171, 'fire', 'SR', 'M', '崩壊の炎魔', '歩いたあとには、がれきしか残らない。', 'real',
  'a towering demon made of fire and crumbling stone walking through a collapsing ruined city, embers and dust'),
 (172, 'fire', 'SEC', 'M', 'すべてを砕く者', '山も、星も、こぶしひとつで砕けてしまう。', 'real',
  'a colossal titan made of molten rock with glowing cracks smashing a mountain with its fists, meteors falling from the sky'),
 # ---------- 雷：🗡貫通（守りを無視する） ----------
 (173, 'bolt', 'C', 'M', 'ハリバチ', 'おしりの針は、雷でできている。', 'pixel',
  'a small yellow bee with a glowing lightning stinger, electric sparks, stormy sky'),
 (174, 'bolt', 'C', 'M', 'ヤリイタチ', '小さな雷の槍を、いつも背負っている。', 'comic',
  'a small brave weasel holding a tiny lightning spear, crackling electricity'),
 (175, 'bolt', 'U', 'M', '雷弓のケンタウロス', '放った矢は、盾ごと相手をつらぬく。', 'paper',
  'a centaur archer drawing a bow with an arrow made of lightning, storm clouds'),
 (176, 'bolt', 'R', 'M', '貫きの雷騎士', '雷の槍の前では、どんな盾も紙きれ。', 'oil',
  'a knight in golden armor charging with a long lance crackling with lightning, piercing through a shield'),
 (177, 'bolt', 'SR', 'M', '天穿つ雷鳥', '雲をつらぬいて、まっすぐ地上へ落ちてくる。', 'real',
  'a giant thunderbird diving straight down like a spear of lightning, piercing through dark storm clouds'),
 # ---------- 水：⛓封印（能力を消す） ----------
 (178, 'water', 'C', 'M', 'クサリヤドカリ', '貝がらのかわりに、鎖の輪を背負っている。', 'ukiyo',
  'a hermit crab carrying a ring of old iron chains instead of a shell, on a sandy sea floor, waves'),
 (179, 'water', 'C', 'M', 'ジョウマエフグ', 'ふくらむと、カチッと鍵がかかる。', 'pixel',
  'a round puffer fish with a padlock on its belly, bubbles, blue water'),
 (180, 'water', 'U', 'M', '鎖の水精', '水の鎖で、どんな力もしばりつける。', 'water',
  'a water spirit girl made of flowing water holding chains made of water, glowing blue'),
 (181, 'water', 'R', 'M', '深海の牢番', '鍵束の音がしたら、もう逃げられない。', 'oil',
  'a deep sea guardian creature holding a ring of glowing keys and heavy chains, dark ocean depths, bioluminescence'),
 (182, 'water', 'SR', 'M', '水底の封印獣', '体じゅうの封印は、自分をしばるためのもの。', 'real',
  'a massive armored sea beast covered in glowing seal runes and chains in the deep ocean, light rays from above'),
 # ---------- 闇：⛔禁癒（回復させない） ----------
 (183, 'dark', 'C', 'M', 'ノロイ人形', '夜中に、少しずつ向きが変わっている。', 'sumi',
  'a small creepy cursed straw doll with glowing purple eyes, dark mist'),
 (184, 'dark', 'C', 'M', 'シオレカゲ', 'この影が通ると、花がしおれる。', 'neon',
  'a small shadow creature walking through a garden, flowers wilting behind it, purple glow'),
 (185, 'dark', 'U', 'M', '癒やし喰いのコウモリ', '傷がふさがる音が、何よりのごちそう。', 'comic',
  'a dark bat with glowing red eyes sucking glowing green healing light, night sky'),
 (186, 'dark', 'R', 'M', '禁呪の司書', '開いてはいけない本だけを集めている。', 'oil',
  'a skeletal librarian in dark robes holding a glowing forbidden book with chains, ancient library'),
 (187, 'dark', 'UR', 'M', '混沌の王', '秩序が生まれるたび、こなごなにしてきた。', 'real',
  'a king of chaos with a cracked crown sitting on a throne of broken pillars, swirling dark purple energy, ruins'),
 # ---------- 光：⚖天秤（強い相手ほど大きなダメージ） ----------
 (188, 'light', 'C', 'M', 'テンビンの妖精', '重いほうへ、ちょっとだけ肩入れする。', 'water',
  'a tiny fairy holding a small golden balance scale, glowing soft light'),
 (189, 'light', 'C', 'M', 'ゼンマイ兵', '背中のねじが切れるまで、まっすぐ進む。', 'pixel',
  'a tiny clockwork toy soldier with a wind-up key on its back, brass gears'),
 (190, 'light', 'U', 'M', '秩序の衛兵', '決まりを守らない者は、だれであろうと通さない。', 'paper',
  'a brass clockwork guard holding a tall shield and spear, golden gears, temple gate'),
 (191, 'light', 'R', 'M', '審問の騎士', '相手が大きいほど、剣が重く光る。', 'oil',
  'a knight in white and gold armor holding a glowing sword and a balance scale, cathedral light'),
 (192, 'light', 'SR', 'M', '機械仕掛けの天使', '歯車の翼で、正しさを量りにくる。', 'gold',
  'a mechanical angel made of brass gears and golden light with clockwork wings holding scales'),
 (193, 'light', 'SEC', 'M', '時を律する者', '世界の時計は、この者がねじを巻いている。', 'real',
  'a cosmic guardian of order made of giant golden clock gears and light holding a balance scale above the world, stars'),
 # ---------- 森：✂分断（連結と進化をじゃまする） ----------
 (194, 'leaf', 'C', 'M', 'イバラの番兵', '道をふさぐのが仕事。', 'water',
  'a small guard creature made of thorny vines holding a thorn spear, blocking a forest path'),
 (195, 'leaf', 'C', 'M', 'ネキリモグラ', '線路の下も、根っこの下も、ぜんぶ切ってしまう。', 'comic',
  'a mole with big claws cutting through roots underground, soil and stones'),
 (196, 'leaf', 'U', 'M', '境界の木霊', 'ここから先は、だれのものでもない土地。', 'sumi',
  'a quiet tree spirit standing at a border stone in a misty forest, ancient rope barrier'),
 (197, 'leaf', 'R', 'M', 'いばら城の門番', '一度閉じた門は、百年ひらかない。', 'oil',
  'a giant gatekeeper made of wood and thorns standing before a castle covered in thorny vines'),
 (198, 'leaf', 'UR', 'M', '大地を分かつ巨人', 'ひとまたぎで、大地にさけ目を作る。', 'real',
  'a colossal giant made of earth and trees splitting the land in two with a great chasm, dramatic sky'),
 # ---------- アイテム ----------
 (199, 'fire', 'U', 'I', '破城槌', '門も、壁も、守りも、まとめてこわす。', 'oil',
  'a huge medieval battering ram made of wood and iron, castle siege, no people'),
 (200, 'light', 'U', 'I', '秩序の盾', 'どんな魔法も、この盾の前では消える。', 'gold',
  'an ornate golden shield with a balance scale emblem glowing with protective light'),
 (201, 'water', 'U', 'I', '封印の鎖', '巻きつけると、相手の力がすっと消える。', 'lowpoly',
  'a glowing blue chain with seal runes coiled on a stone floor'),
 (202, 'dark', 'U', 'I', '禁呪の書', 'この本を持つ者の前で、傷は治らない。', 'neon',
  'a dark book bound with chains and glowing purple forbidden runes'),
 (203, 'leaf', 'U', 'I', '調律の音叉', '鳴らすと、乱れた力が元にもどる。', 'glass',
  'a crystal tuning fork ringing with green sound waves, leaves floating'),
 # ---------- フィールド ----------
 (204, 'fire', 'R', 'F', '瓦礫の街', '昨日まで、ここには立派な街があった。', 'oil',
  'a ruined city of rubble and broken buildings with small fires at dusk, no people'),
 (205, 'light', 'R', 'F', '静寂の神殿', 'ここでは、どんな声も力をもたない。', 'oil',
  'a silent white marble temple with tall pillars and soft golden light, no people'),
 (206, 'water', 'R', 'F', '鎖の牢獄', '水の底の、出口のない牢屋。', 'oil',
  'an underwater prison with heavy chains and iron bars, blue light, no creatures'),
 (207, 'bolt', 'R', 'F', '分断の荒野', '雷が落ちるたび、大地がばらばらに裂ける。', 'oil',
  'a barren wasteland split by deep cracks with lightning striking, no creatures'),
 # ---------- 魔法 ----------
 (208, 'light', 'SR', 'S', '沈黙の鐘', 'この鐘が鳴ると、すべての力が眠りにつく。', 'glass',
  'a great silver bell ringing with waves of white light, silence spell'),
 (209, 'dark', 'SR', 'S', '天秤の裁き', '重すぎる者から、天秤は落とす。', 'neon',
  'a giant glowing purple balance scale crashing down, judgment spell'),
 (210, 'water', 'SR', 'S', '鎖の結界', 'しばらくのあいだ、だれも呪文を唱えられない。', 'glass',
  'a sphere of glowing blue chains forming a magic barrier, anti magic spell'),
 (211, 'leaf', 'SR', 'S', '大地の均し', '盛りあがった土も、へこんだ土も、たいらに。', 'water',
  'a wave of green energy flattening the land, leveling spell, wide plains'),
 (212, 'fire', 'UR', 'S', '大崩落', '空から、街ごと崩れおちる。', 'real',
  'a massive collapse of a floating city falling from the sky in fire and rubble, apocalyptic destruction spell'),
]

if __name__ == '__main__':
    import os
    from collections import Counter
    out = [f'--prompt "{sub}, {STYLE[st]}" --negative_prompt "{NEG}" --width 1024 --height 768 --seed {1000 + no}' for no, el, r, t, nm, txt, st, sub in CARDS]
    path = os.path.join(os.path.dirname(__file__), 'prompts4.txt')
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(out), 'prompts ->', path)
    print(Counter(c[2] for c in CARDS), Counter(c[1] for c in CARDS), Counter(c[3] for c in CARDS))
