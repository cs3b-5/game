# パックの表の絵（Stable Diffusion 用・縦長 832x1216）
# python pack_prompts.py → pack_prompts.txt（いちばん新しい弾の4パターンだけ）
# シード 9001〜 = 第一弾、9101〜 = 第二弾、9201〜 = 第三弾、9301〜 = 第四弾、9401〜 = 第五弾（4パターンずつ）
NEG = ('text, letters, words, numbers, title, logo, watermark, signature, frame, border, card frame, '
       'blurry, lowres, jpeg artifacts, deformed, bad anatomy, extra limbs, duplicate, people, person, human')
PACKS = {
    1: ('a majestic fantasy creature parade under a starry night sky at a japanese summer festival, '
        'a glowing phoenix, a red dragon, a white unicorn, a fire fox and a koi fish swirling in a circle around a huge full moon, '
        'paper lanterns and fireworks, vertical composition, main creatures in the center, dark empty sky at the top and bottom, '
        'fantasy trading card booster pack art, epic digital painting, vibrant colors, dramatic lighting, highly detailed'),
    2: ('a black steam locomotive crossing a tall stone viaduct at night toward a mysterious glowing railway station floating in the sky, '
        'milky way galaxy, drifting fog below, a single red signal light, eerie but beautiful, japanese urban legend mood, '
        'vertical composition, train in the center, dark empty sky at the top and bottom, '
        'cinematic photograph, photorealistic, 35mm film, atmospheric lighting, highly detailed'),
    3: ('a giant glowing egg cracking open in the center of an ancient forest at night, golden light pouring out, '
        'a small fox, a baby dragon and a sea turtle hatchling growing into majestic huge forms as a spiral of evolution rising into the starry sky, '
        'sprouting leaves and blooming flowers, green and gold light, vertical composition, main creatures in the center, dark empty sky at the top and bottom, '
        'fantasy trading card booster pack art, epic digital painting, vibrant colors, dramatic lighting, highly detailed'),
    4: ('a colossal titan of molten rock and cracks facing a giant golden clockwork guardian holding a balance scale, '
        'a ruined city split in two between them, red fire and destruction on one side, white gold light and order on the other, '
        'vertical composition, main figures in the center, dark empty sky at the top and bottom, '
        'fantasy trading card booster pack art, epic digital painting, vibrant colors, dramatic lighting, highly detailed'),
    5: ('a grand pirate ship with golden sails crossing a stormy sea toward a glowing treasure island, '
        'a cat pirate captain at the bow, a giant open treasure chest overflowing with gold coins and jewels, seagulls, '
        'vertical composition, main subjects in the center, dark empty sky at the top and bottom, '
        'fantasy trading card booster pack art, epic digital painting, vibrant colors, dramatic lighting, highly detailed'),
}
if __name__ == '__main__':
    # いちばん新しい弾のパックだけ書き出す（python pack_prompts.py 2 のように番号を指定すると、その弾）
    import os, sys
    want = [int(sys.argv[1])] if len(sys.argv) > 1 else [max(PACKS)]
    out = []
    for s, p in PACKS.items():
        if s not in want: continue
        for k in range(1, 5):
            out.append(f'--prompt "{p}" --negative_prompt "{NEG}" --width 832 --height 1216 --seed {9000 + (s - 1) * 100 + k}')
    path = os.path.join(os.path.dirname(__file__), 'pack_prompts.txt')
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(out), '->', path)
