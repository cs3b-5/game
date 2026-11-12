// 画像生成用のプロンプト（Forge の「Prompts from file or textbox」に貼る）：node tools/prompts.mjs
// できた画像は webp にして images/cards/<チーム>_<打順>.webp（正方形）、アイコンは images/icon.webp
import { readFileSync, writeFileSync } from 'fs';
const E = await import('data:text/javascript,' + encodeURIComponent(readFileSync(new URL('../engine.js', import.meta.url), 'utf8')));
const STYLE = 'cute chibi anthropomorphic axolotl character, glossy 3D render, pixar style, soft studio lighting, big round eyes, wide smiling mouth, feathery external gills on both sides of the head, vibrant colors, highly detailed, game character card art';
const NEG = 'text, letters, watermark, signature, logo, frame, blurry, lowres, deformed, extra limbs, bad hands, human, realistic photo, scary, multiple characters';
const SKIN = { pink: 'pale pink leucistic skin with bright magenta gills', gold: 'golden yellow skin with orange gills', wild: 'olive green speckled wild-type skin with dark green gills', black: 'dark charcoal melanoid skin with purple gills',
  albino: 'white albino skin with pink gills and red eyes', copper: 'copper orange-brown skin with red gills', blue: 'pastel blue skin with deep blue gills', mint: 'mint green skin with teal gills' };
const POS = { '投': 'pitcher in a wind-up pose holding a baseball', '捕': 'catcher wearing a chest protector, holding a catcher mitt', '一': 'first baseman holding a big mitt', '二': 'second baseman in a ready crouch with a glove', '遊': 'shortstop diving with a glove',
  '三': 'third baseman with a glove, tough look', '左': 'left fielder catching a fly ball', '中': 'center fielder running fast', '右': 'right fielder throwing a ball' };
const hex = { '#ff5c8a': 'pink', '#2ab37a': 'green', '#5a8cff': 'blue', '#ffb020': 'orange', '#ffffff': 'white', '#ffe066': 'yellow', '#20202a': 'black', '#1d2340': 'navy', '#0f2a22': 'dark green', '#14204a': 'dark blue' };
const line = (p, w, h, seed) => `--prompt "${p}" --negative_prompt "${NEG}" --width ${w} --height ${h} --seed ${seed} --steps 32 --cfg_scale 5`;
const out = [], names = [];
out.push(line(`app icon, a cute pink axolotl baseball player in a cap swinging a bat, baseball stadium lights behind, centered, bold simple shapes, ${STYLE}`, 1024, 1024, 9001)); names.push('icon');
E.TEAMS.forEach((t, ti) => t.bat.forEach((b, i) => {
  const [nm, pos, con, pow] = b, skin = i === 8 ? t.pit[5] : b[6];
  const bat = pos === '投' ? POS[pos] : pow >= 80 ? 'power slugger swinging a wooden bat hard' : con >= 70 ? 'contact hitter holding a bat, confident smile' : POS[pos];
  const p = `${STYLE}, ${SKIN[skin]}, wearing a ${hex[t.c2] || 'white'} baseball uniform with ${hex[t.c] || 'colored'} trim and a ${hex[t.cap] || 'dark'} baseball cap, ${bat}, upper body portrait, plain ${hex[t.c] || 'pink'} gradient background`;
  out.push(line(p, 1024, 1024, 9100 + ti * 20 + i)); names.push(`cards/${t.id}_${i + 1}  ${nm}`);
}));
writeFileSync(new URL('prompts.txt', import.meta.url), out.join('\n') + '\n');
writeFileSync(new URL('prompt_names.txt', import.meta.url), names.map((n, i) => `${String(i + 1).padStart(2, '0')}  ${n}`).join('\n') + '\n');
console.log(out.length, '枚 → tools/prompts.txt');
