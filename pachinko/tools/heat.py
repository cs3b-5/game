import sys, json, numpy as np
from PIL import Image, ImageDraw, ImageFilter
f=sys.argv[1]; out=sys.argv[2]
H=np.fromfile(f,dtype=np.float32).reshape(900,600); meta=json.load(open(f+'.json'))
v=np.log1p(H); v=(v/ (v.max() or 1)*255).astype(np.uint8)
img=Image.fromarray(v).convert('RGB'); img=Image.merge('RGB',(img.split()[0],Image.fromarray((v*.5).astype(np.uint8)),Image.fromarray((v*.2).astype(np.uint8))))
d=ImageDraw.Draw(img)
for n in meta['nails']: d.ellipse((n['x']-3,n['y']-3,n['x']+3,n['y']+3),fill=(120,200,255))
for s in meta['segs']: d.line((s['x1'],s['y1'],s['x2'],s['y2']),fill=(80,255,120) if s['k']=='wall' else (255,255,0),width=2)
for k,p in meta['P'].items(): d.ellipse((p['x']-8,p['y']-8,p['x']+8,p['y']+8),outline=(255,0,255),width=2); d.text((p['x']+10,p['y']-6),k,fill=(255,0,255))
d.text((10,880),str(meta['stats']),fill=(255,255,255))
img.save(out)
