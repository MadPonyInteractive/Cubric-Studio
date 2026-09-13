import json, io, urllib.request, urllib.parse
import numpy as np
from PIL import Image

B = 'http://127.0.0.1:8188'
SP = r'./'  

hist = json.load(urllib.request.urlopen(B + '/history?max_items=8'))
runs = []
for pid, r in hist.items():
    num, _, prompt = r['prompt'][0], r['prompt'][1], r['prompt'][2]
    by_title = {v.get('_meta', {}).get('title'): (k, v) for k, v in prompt.items()}
    if 'Input_Box' not in by_title or 'Output_Image' not in by_title:
        continue
    out_id = by_title['Output_Image'][0]
    imgs = (r.get('outputs', {}).get(out_id) or {}).get('images') or []
    if not imgs:
        continue
    extra = {v['class_type']: {a: b for a, b in v['inputs'].items() if not isinstance(b, list)}
             for v in prompt.values() if v['class_type'] in ('MpiInpaintHeal', 'ColorMatch')}
    runs.append((num, pid, by_title['Input_Box'][1]['inputs'], by_title['Input_Image'][1]['inputs'], imgs[0], extra))
runs.sort()

def load_view(f):
    q = urllib.parse.urlencode({k: f[k] for k in ('filename', 'subfolder', 'type')})
    return np.asarray(Image.open(io.BytesIO(urllib.request.urlopen(B + '/view?' + q).read())).convert('RGB'), dtype=np.float32)

for num, pid, box, src, img, extra in runs[-3:]:
    res = load_view(img)
    path = next(v for v in src.values() if isinstance(v, str) and ':' in v)
    org = np.asarray(Image.open(path).convert('RGB'), dtype=np.float32)
    print(f'\n== run #{num} {pid[:8]} out={img["filename"]} {res.shape[1]}x{res.shape[0]} src={org.shape[1]}x{org.shape[0]} box={box} {extra}')
    if res.shape != org.shape:
        print('   size differs from source; skipping diff')
        continue
    d = res - org
    x, y, w, h = int(box['x']), int(box['y']), int(box['width']), int(box['height'])
    H, W = d.shape[:2]
    def band(x0, x1, y0, y1):
        x0, x1, y0, y1 = max(0, x0), min(W, x1), max(0, y0), min(H, y1)
        if x1 <= x0 or y1 <= y0:
            return None
        return d[y0:y1, x0:x1].reshape(-1, 3).mean(0).round(2)
    # inside: 8..40 px in from the edge; outside: 48..96 px out (past the 32 px stitch blend)
    sides = {
        'top':    (band(x, x + w, y + 8, y + 40),      band(x, x + w, y - 96, y - 48)),
        'bottom': (band(x, x + w, y + h - 40, y + h - 8), band(x, x + w, y + h + 48, y + h + 96)),
        'left':   (band(x + 8, x + 40, y, y + h),      band(x - 96, x - 48, y, y + h)),
        'right':  (band(x + w - 40, x + w - 8, y, y + h), band(x + w + 48, x + w + 96, y, y + h)),
    }
    for s, (i, o) in sides.items():
        print(f'   {s:6} result-minus-source RGB  inside {i}  outside {o}')
    print('   whole-image mean |diff| outside box:',
          round(float(np.abs(np.delete(d.reshape(-1, 3), np.ravel_multi_index(np.mgrid[max(0,y):min(H,y+h), max(0,x):min(W,x+w)].reshape(2, -1), (H, W)), axis=0)).mean()), 2))
    Image.fromarray(np.clip(res, 0, 255).astype(np.uint8)).save(SP + f'run{num}.png')
    amp = np.clip(128 + (d.mean(2)) * 8, 0, 255).astype(np.uint8)
    Image.fromarray(amp).save(SP + f'run{num}_diff_x8.png')
