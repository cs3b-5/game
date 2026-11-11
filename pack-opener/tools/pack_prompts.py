# パックの表の絵（Stable Diffusion 用・縦長 832x1216）
# python pack_prompts.py → pack_prompts.txt
# シード 9001〜 = 第一弾、9101〜 = 第二弾、9201〜 = 第三弾（4パターンずつ）
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
}
if __name__ == '__main__':
    import os
    out = []
    for s, p in PACKS.items():
        for k in range(1, 5):
            out.append(f'--prompt "{p}" --negative_prompt "{NEG}" --width 832 --height 1216 --seed {9000 + (s - 1) * 100 + k}')
    path = os.path.join(os.path.dirname(__file__), 'pack_prompts.txt')
    open(path, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
    print(len(out), '->', path)
