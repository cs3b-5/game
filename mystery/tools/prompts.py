# ナゾトキ探偵：画像生成用のプロンプト（Forge の「Prompts from file or textbox」に貼る）
# python tools/prompts.py → tools/prompts.txt（全部）と、種類ごとの prompts_*.txt ができる
# 見た目の特徴（髪の色・靴など）は gen.js の people と同じ番号。立ち絵と証拠が合うようにしてある
import os

# ---------- 画風（ぜんぶ共通：奇妙な洋館の絵本） ----------
STYLE = ('eerie whimsical gothic storybook illustration, strange old western mansion mood, '
         'muted colors with warm candlelight and deep shadows, gouache and ink texture, '
         'slightly surreal, elegant and mysterious, highly detailed')
NEG = ('text, letters, watermark, signature, logo, frame, border, blurry, lowres, jpeg artifacts, '
       'deformed, extra limbs, extra fingers, bad hands, cropped head, multiple characters, gore, blood')
# 立ち絵：全身・正面・背景は暗い無地（ゲームでは枠の中に表示するので、背景はそのままでOK）
CHARA = ('full body character portrait, standing pose facing the viewer, whole figure visible from head to shoes, '
         'centered, plain dark muted backdrop with soft vignette, ')

# ---------- 世界観ごとの特徴の英語 ----------
ATTR = {
    'mansion': (['black', 'blonde', 'red', 'silver'], ['polished leather shoes', 'muddy rubber rain boots', 'high heels', 'soft house slippers']),
    'school': (['red', 'blue', 'yellow', 'green'], None),
    'animal': (['white', 'brown', 'black', 'golden'], ['rubber rain boots', 'sandals', 'sneakers', 'bare feet']),
    'neon': (['blue', 'red', 'green', 'purple'], ['heavy boots', 'sneakers', 'high heels', 'glowing magnetic hover boots']),
}
FOOD = ['a carrot', 'a fish', 'an acorn', 'a small honey pot']

# [ファイル名の番号, 特徴, 英語の説明]  特徴は gen.js と同じ
PEOPLE = {
    'mansion': [
        (1, [3, 0, 1], 'an elderly butler in an immaculate black tailcoat and white gloves, holding a silver candelabra'),
        (2, [1, 2, 0], 'a young noble lady in an elegant victorian gown with a lace parasol'),
        (3, [0, 1, 2], 'a burly head chef in a white chef coat and tall toque, holding a cleaver'),
        (4, [2, 2, 3], 'a strict governess in a dark high-collared dress, holding a book and round spectacles'),
        (5, [1, 1, 0], 'a young gardener in overalls and a straw hat, holding pruning shears'),
        (6, [0, 3, 3], 'a dreamy painter in a paint-stained smock and beret, holding a palette'),
        (7, [3, 3, 0], 'an aged countess in a dark velvet gown with pearls, holding a fan'),
        (8, [2, 0, 1], 'a thin doctor in a long coat with a leather medical bag and stethoscope'),
        (9, [0, 1, 2], 'a rugged bearded explorer in a safari jacket with a lantern and a map'),
        (10, [1, 2, 3], 'a glamorous opera singer in a shimmering evening dress with a feather boa'),
    ],
    'school': [
        (1, [0, 0, 0], 'a serious class president schoolgirl in a sailor uniform holding a clipboard'),
        (2, [1, 3, 3], 'a tall baseball club boy in a school uniform with a baseball cap and bat'),
        (3, [2, 0, 2], 'an art club schoolgirl with paint on her cheek holding a sketchbook and brushes'),
        (4, [1, 2, 0], 'a cool student council president boy in a neat blazer uniform'),
        (5, [3, 1, 3], 'a mysterious transfer student with messy hair in a school uniform, carrying a bag'),
        (6, [2, 1, 1], 'a cheerful broadcasting club girl holding a microphone and headphones'),
        (7, [3, 3, 1], 'a science teacher in a white lab coat holding a flask'),
        (8, [0, 2, 3], 'a kind old school janitor in work clothes holding a broom'),
        (9, [3, 2, 2], 'an athletic track club girl in a tracksuit with a stopwatch'),
        (10, [2, 0, 0], 'a quiet library committee girl with glasses holding a stack of books'),
    ],
    'animal': [
        (1, [1, 2, 1], 'an anthropomorphic dog in a little detective vest'),
        (2, [0, 1, 1], 'an anthropomorphic cat in a lace apron'),
        (3, [0, 0, 0], 'an anthropomorphic rabbit girl in a floral dress'),
        (4, [3, 3, 2], 'a sly anthropomorphic fox in a waistcoat'),
        (5, [1, 0, 3], 'a big gentle anthropomorphic bear in overalls'),
        (6, [2, 1, 3], 'an anthropomorphic panda in a chinese style jacket'),
        (7, [0, 3, 0], 'a fluffy anthropomorphic sheep in a knitted cardigan'),
        (8, [1, 1, 2], 'a wise anthropomorphic owl teacher with spectacles and a gown'),
        (9, [3, 2, 2], 'a small anthropomorphic squirrel in a tiny backpack'),
        (10, [2, 0, 1], 'a clever anthropomorphic crow in a black coat and top hat'),
    ],
    'neon': [
        (1, [2, 1, 3], 'a young hacker in a hoodie with a glowing holographic keyboard'),
        (2, [3, 2, 1], 'a glamorous cyber diva singer in a shining futuristic dress'),
        (3, [1, 0, 2], 'a tough bodyguard in a black tactical coat, ninja-like mask'),
        (4, [2, 1, 0], 'a twitchy anthropomorphic rat informant in a long trench coat'),
        (5, [0, 2, 3], 'a brilliant female scientist in a futuristic lab coat with cybernetic glasses'),
        (6, [0, 3, 0], 'a humanoid android with a sleek chrome body and visor face'),
        (7, [3, 0, 2], 'a world-weary former detective in a fedora and trench coat'),
        (8, [0, 1, 1], 'a calm bartender in a vest shaking a glowing cocktail'),
        (9, [1, 3, 0], 'a courier in a racing jacket holding a helmet'),
        (10, [3, 3, 1], 'a ruthless corporate CEO in a sharp suit with a cane'),
    ],
}

def chara_prompt(th, a, desc):
    col, shoes = ATTR[th]
    if th == 'mansion': look = f'{col[a[0]]} hair, wearing {shoes[a[1]]}'
    elif th == 'school': look = f'a {col[a[0]]} pin badge on the chest, school indoor shoes'
    elif th == 'animal': look = f'{col[a[0]]} fur, wearing {shoes[a[1]]}, holding {FOOD[a[2]]}'
    else: look = f'a glowing {col[a[0]]} neon tattoo on the arm, wearing {shoes[a[1]]}, cyberpunk night city mood'
    return f'{CHARA}{desc}, {look}, {STYLE}'

BG = [
    # [ファイル名, 幅, 高さ, シード, 題材]
    ('bg_home_tall', 832, 1216, 7001, 'the grand entrance hall of a strange old western mansion at night, crooked portraits on the walls, many mysterious doors, a sweeping staircase, flickering candles, drifting mist, no people'),
    ('bg_home_wide', 1216, 832, 7002, 'the grand entrance hall of a strange old western mansion at night, crooked portraits on the walls, many mysterious doors, a sweeping staircase, flickering candles, drifting mist, no people'),
    ('bg_mansion', 1216, 832, 7011, 'a gloomy study room in a western mansion on a stormy night, bookshelves, a fireplace, lightning through the window, no people'),
    ('bg_school', 1216, 832, 7012, 'an empty school classroom at dusk seen through an ornate mansion door frame, long shadows, eerie and nostalgic, no people'),
    ('bg_animal', 1216, 832, 7013, 'a cozy storybook animal village at twilight seen through an ornate mansion door frame, tiny houses, lanterns, no people'),
    ('bg_neon', 1216, 832, 7014, 'a rainy neon-lit cyberpunk alley at night seen through an ornate mansion door frame, glowing signs, no people'),
    ('icon', 1024, 1024, 7021, 'an emblem of a large brass magnifying glass in front of a crooked haunted mansion silhouette under a full moon, centered, bold simple shapes, game app icon'),
    ('title', 1216, 832, 7022, 'a crooked haunted western mansion on a hill under a huge full moon, bats, a winding path with lanterns, a detective silhouette at the gate'),
]

def line(prompt, w, h, seed):
    return f'--prompt "{prompt}" --negative_prompt "{NEG}" --width {w} --height {h} --seed {seed} --steps 32 --cfg_scale 5'

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    out = {'bg': [], 'chara': []}
    for nm, w, h, seed, sub in BG:
        out['bg'].append((nm, line(f'{sub}, {STYLE}', w, h, seed)))
    for ti, th in enumerate(['mansion', 'school', 'animal', 'neon']):
        for no, a, desc in PEOPLE[th]:
            out['chara'].append((f'{th}_{no:02d}', line(chara_prompt(th, a, desc), 832, 1216, 8000 + ti * 100 + no)))
    allp = []
    for k, items in out.items():
        with open(os.path.join(here, f'prompts_{k}.txt'), 'w', encoding='utf-8') as f: f.write('\n'.join(p for _, p in items) + '\n')
        allp += items
    with open(os.path.join(here, 'prompts.txt'), 'w', encoding='utf-8') as f: f.write('\n'.join(p for _, p in allp) + '\n')
    with open(os.path.join(here, 'prompt_names.txt'), 'w', encoding='utf-8') as f: f.write('\n'.join(f'{i + 1:02d}  {n}' for i, (n, _) in enumerate(allp)) + '\n')
    print(len(out['bg']), '背景・アイコン +', len(out['chara']), '立ち絵 =', len(allp), '枚 → tools/prompts.txt')
