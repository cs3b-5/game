# 第二弾「夜汽車と異界の駅」のカード一覧（No.75〜120）
# python set2.py → prompts2.txt（Forge の「Prompts from file or textbox」用）を作る
# 絵は Stable Diffusion（Juggernaut XL）で写真っぽく描く。シード = 1000 + カード番号
#
# [番号, 属性, レア, 種類(M/I/F/S), 名前, 説明文, 怪談(True=都市伝説っぽい雰囲気), 題材（英語）]
CARDS = [
 # ---------- 炎：蒸気機関車 ----------
 (75, 'fire', 'C', 'M', '小さなタンク機関車', '小さいけれど、坂道ではいちばんがんばる。', False,
  'a small vintage black tank steam locomotive puffing white steam at a tiny rural station at dusk, warm lamp light'),
 (76, 'fire', 'C', 'M', '石炭を運ぶ貨車', '積んだ石炭が、まだ少しあたたかい。', False,
  'an old rusty freight wagon heaped with black coal on rails in a rail yard at sunset, faint glowing embers in the coal'),
 (77, 'fire', 'U', 'M', '黒鉄のSL', '汽笛ひとつで、夜の山がふるえる。', False,
  'a powerful black steam locomotive with red wheels charging toward the camera at night, thick plumes of smoke and steam, sparks, bright headlight'),
 (78, 'fire', 'U', 'I', '石炭', 'ひとすくいで、機関車の心臓が熱くなる。', False,
  'close-up of glowing hot coal being shoveled into the open firebox of a steam locomotive, intense orange fire, sparks'),
 (79, 'fire', 'R', 'M', '峠越えの重連SL', '二台でひとつ。息を合わせて峠をこえる。', False,
  'two black steam locomotives coupled together hauling a train up a steep mountain pass, huge clouds of smoke, autumn mountains'),
 (80, 'fire', 'R', 'F', '機関庫', '眠る機関車たちの、あたたかい寝床。', False,
  'inside an old roundhouse locomotive shed at night, several steam locomotives resting, warm lamps, smoke haze, beams of light'),
 (81, 'fire', 'SR', 'M', '煙を上げる大型SL', '空まで届く黒い煙が、出発の合図。', False,
  'a huge heavy steam locomotive blasting a towering column of black smoke into a red sunset sky, low angle, epic'),
 (82, 'fire', 'UR', 'M', '蒸気の王', '炎を胸に抱いて、夜の鉄橋をわたる王。', False,
  'a colossal majestic steam locomotive glowing with fire from within, crossing a high stone viaduct at night, sparks raining down, legendary, epic'),
 # ---------- 水：海・雨・雪 ----------
 (83, 'water', 'C', 'M', '海ぞいの一両列車', '窓をあけると、潮のにおいがする。', False,
  'a single-car local train running along a seaside track next to blue ocean waves, summer afternoon, clear sky'),
 (84, 'water', 'C', 'M', '雨の日の各駅停車', '雨音にあわせて、ゆっくり走る。', False,
  'a local commuter train stopped at a small station platform in heavy rain, wet reflections, blue evening light, empty platform'),
 (85, 'water', 'U', 'M', '鉄橋を渡る列車', '川霧の上を、音だけが先にわたっていく。', False,
  'a train crossing a long steel truss bridge over a wide misty river at dawn, reflections in the water'),
 (86, 'water', 'R', 'M', '雪をかきわけるラッセル車', '雪の壁なんて、ただの道の一部。', False,
  'a snowplow train blasting through deep snow, huge spray of snow from the plow, blizzard, mountain railway'),
 (87, 'water', 'R', 'F', '海が見える駅', 'ホームのすぐ先が、もう海。', False,
  'a small open-air railway platform right next to the sea, a wooden bench, calm blue ocean horizon, quiet, empty'),
 (88, 'water', 'SR', 'M', '海の上を走る列車', '満ち潮の夜だけ、線路が海の上にあらわれる。', False,
  'a train running on tracks across shallow sea water that reflects the sky like a mirror, sunset, dreamy'),
 (89, 'water', 'SR', 'S', '赤信号', '止まれ。この先は、まだ通れない。', False,
  'a glowing red railway signal light on a dark rainy night, wet tracks reflecting red light, mist'),
 # ---------- 森：山・田舎 ----------
 (90, 'leaf', 'C', 'M', '森林トロッコ', '昔は木を運んでいた。今は森の音を運ぶ。', False,
  'a small old wooden logging trolley on narrow gauge rails in a dense green forest, sunlight through the trees'),
 (91, 'leaf', 'C', 'M', '田んぼの中の気動車', '青い稲のあいだを、一両だけで走る。', False,
  'a small single diesel railcar crossing green rice paddies in the countryside, mountains in the background, summer'),
 (92, 'leaf', 'U', 'M', '登山電車', 'あじさいの坂を、行ったり来たり。', False,
  'a red mountain railway train climbing a steep track through blooming hydrangeas and forest, misty mountains'),
 (93, 'leaf', 'U', 'I', '駅弁', '旅のいちばんの楽しみ。食べると元気が出る。', False,
  'a traditional japanese train station bento lunch box opened on a train window table, rice, grilled fish, vegetables, countryside scenery outside the window'),
 (94, 'leaf', 'R', 'F', '山あいの無人駅', '一日に三本。それでも駅はそこにある。', False,
  'a tiny unmanned rural japanese railway station deep in the mountains, one short concrete platform beside a single railway track, a small simple wooden waiting shelter with a bench, a lone street lamp, autumn maple leaves, overcast, quiet, empty, seen from the end of the platform'),
 (95, 'leaf', 'SR', 'M', '森をぬける観光列車', '大きな窓いっぱいに、緑があふれる。', False,
  'a scenic sightseeing train with large windows running through a deep green gorge along a river, lush forest'),
 (96, 'leaf', 'SR', 'S', 'スイッチバック', '前に進めないなら、いちど戻ればいい。', False,
  'a zigzag switchback railway climbing a steep green mountainside, aerial view, a train on the tracks'),
 # ---------- 雷：電車・新幹線 ----------
 (97, 'bolt', 'C', 'M', '路面電車', '町の中を、車といっしょにのんびり走る。', False,
  'a streetcar tram running down a city street at dusk, overhead wires, warm shop lights'),
 (98, 'bolt', 'C', 'M', '朝の通勤電車', '毎朝、町の眠気をのせて走る。', False,
  'a silver commuter train arriving at an elevated station in morning light, motion blur, city buildings'),
 (99, 'bolt', 'U', 'M', 'モノレール', '一本のレールの上を、空中散歩。', False,
  'a futuristic monorail gliding along an elevated concrete beam between skyscrapers at night, city lights'),
 (100, 'bolt', 'U', 'M', '架線の点検車', '真夜中、電車のための道を見回る。', False,
  'a yellow railway maintenance inspection car checking overhead electric wires at night, sparks from the pantograph, blue electric glow'),
 (101, 'bolt', 'R', 'M', '特急電車', '小さな駅は、全部とばして走る。', False,
  'a sleek limited express train speeding through the countryside, motion blur, dramatic sky with lightning in the distance'),
 (102, 'bolt', 'SR', 'M', 'リニアの試験車', '浮かんで走る、未来の列車。', False,
  'a futuristic maglev train levitating above its guideway at high speed, blue electric glow underneath, sci-fi'),
 (103, 'bolt', 'SR', 'S', '踏切の警報', 'カンカンカン…音が鳴ったら、もう来る。', False,
  'a japanese railroad crossing at night with flashing red warning lights and the barrier lowered, a train rushing past in motion blur'),
 (104, 'bolt', 'UR', 'M', '白い超特急', '雷より速く、白い光が走りぬける。', False,
  'a white high-speed bullet train racing past at incredible speed on an elevated track, lightning in a stormy sky, motion blur, epic'),
 # ---------- 闇：夜・都市伝説 ----------
 (105, 'dark', 'C', 'M', '終電の地下鉄', '最後の電車。乗っているのは、だれ？', True,
  'an empty subway train waiting at an underground station platform late at night, flickering fluorescent lights, nobody around'),
 (106, 'dark', 'C', 'M', '廃線のトロッコ', 'もう走らないはずの線路に、車輪の跡。', True,
  'an abandoned rusty mine trolley on overgrown disused railway tracks leading into a dark forest, fog'),
 (107, 'dark', 'U', 'M', '夜行列車', '眠っているあいだに、遠くの町まで。', False,
  'an overnight sleeper train running through the dark countryside at night, lit windows glowing in the darkness'),
 (108, 'dark', 'U', 'I', '車掌のランタン', '赤は止まれ、緑は進め。白は…知らないほうがいい。', True,
  'an old railway conductor signal lantern glowing on a dark empty platform at night, mist'),
 (109, 'dark', 'R', 'F', 'やみ駅', '真っ暗な駅。明かりはひとつだけ。', True,
  'a mysterious pitch dark railway station platform at night, completely black surroundings, a single flickering light, blank station sign'),
 (110, 'dark', 'R', 'M', '異界のトンネル', 'くぐったら、もう元の線路には戻れない。', True,
  'a dark old brick railway tunnel entrance with a faint strange light deep inside, fog, overgrown with ivy'),
 (111, 'dark', 'SR', 'M', '幽霊列車', '時刻表にない列車が、霧の中を通りすぎる。', True,
  'a ghostly translucent old train passing through fog on abandoned tracks at night, pale blue glow'),
 (112, 'dark', 'UR', 'M', '猿夢の電車', '「次は…」夢の中で、放送が聞こえる。', True,
  'a small amusement park kiddie train waiting at night in a deserted dark theme park, a single dim light, fog'),
 (113, 'dark', 'SEC', 'M', 'きさらぎ駅', '地図にない駅。降りたら、帰れない。', True,
  'a lonely rural railway station at night surrounded by dark grassland and black mountains, nothing around, a single dim lamp, mist, strange glowing sky, otherworldly'),
 # ---------- 光：朝・星・観光 ----------
 (114, 'light', 'C', 'M', '夜明けの始発', '一番の電車が、町に朝を配って走る。', False,
  'the first train of the morning leaving a station at dawn, golden sunrise light, long shadows, peaceful'),
 (115, 'light', 'U', 'M', '展望車', 'いちばん後ろの、いちばんいい席。', False,
  'the rear panoramic observation car of a luxury train with large windows, golden hour light, scenic mountains'),
 (116, 'light', 'U', 'M', 'ケーブルカー', '夕焼けの町を見下ろしながら、ゆっくり登る。', False,
  'a red funicular cable car climbing a steep slope up a mountain at sunset, city lights below'),
 (117, 'light', 'U', 'I', '硬い切符', 'パチンと穴があけば、旅のはじまり。', False,
  'an old thick cardboard railway ticket with a punched hole lying on a wooden table, warm vintage light, shallow depth of field'),
 (118, 'light', 'R', 'F', '月の宮駅', '満月の夜にだけ行ける、銀色の駅。', True,
  'a beautiful mysterious railway station under a huge full moon, the platform glowing silver, flowers, dreamlike, otherworldly'),
 (119, 'light', 'SR', 'M', '光の観光列車', '何千もの明かりをまとって、雪の夜を走る。', False,
  'an illuminated sightseeing train decorated with thousands of warm lights running at night through a snowy landscape'),
 (120, 'light', 'SEC', 'M', '星空を走る列車', '天の川の下を、どこまでも。', False,
  'a train crossing a tall viaduct under the milky way galaxy, long exposure starry sky, lit windows, breathtaking, magical'),
]

STYLE = 'cinematic photograph, photorealistic, 35mm film photo, highly detailed, atmospheric lighting, sharp focus'
EERIE = 'eerie liminal space, unsettling quiet atmosphere, japanese urban legend mood, desaturated'
NEG = ('text, letters, words, numbers, station name sign text, watermark, signature, logo, company logo, emblem, '
       'frame, border, people, person, human, face, crowd, cartoon, anime, illustration, painting, drawing, 3d render, '
       'blurry, lowres, jpeg artifacts, deformed, distorted, warped rails, duplicate')

if __name__ == '__main__':
    import os
    out = []
    for no, el, r, t, nm, txt, eerie, sub in CARDS:
        p = f'{sub}, {STYLE}' + (f', {EERIE}' if eerie else '')
        out.append(f'--prompt "{p}" --negative_prompt "{NEG}" --width 1024 --height 768 --seed {1000 + no}')
    path = os.path.join(os.path.dirname(__file__), 'prompts2.txt')
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(out), 'prompts ->', path)
    from collections import Counter
    print(Counter(c[2] for c in CARDS), Counter(c[1] for c in CARDS), Counter(c[3] for c in CARDS))
