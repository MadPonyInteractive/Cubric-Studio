"""Seam round 2 on the 8188 bench. Per photo, two prompts from run #97's graph (plate pass dropped):
  box    - crop/stitch as Fabio's bench (returns the box)            tails: D raw decode, C region composite
  expand - crop mask grown so the stitch returns the whole crop       tails: D raw decode, C region composite
Region gate = new person UNION old person (BiRefNet on decode and on crop), grown.
Knobs (env): TAG (absolute path keeps PNGs out of the repo), JOBS, MODES, SEED, UNET, DTYPE, STEPS, CFG,
SAMPLER, TURBO, TURBO_STR, HEADLORA, HEADLORA_STR, LORA=0, THRESH, GATE, FILL (0 = shipped recipe),
DRY=1 (write each prompt JSON to TAG and queue nothing). Each run also saves <tag>_face.png = the box
region of the finished result, for faces.py."""
import json, io, os, sys, time, uuid, urllib.request, urllib.parse
import numpy as np
from PIL import Image, ImageFilter, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
B = 'http://127.0.0.1:8188'
OUT = os.path.join(HERE, os.environ.get('TAG', 'bench2'))
os.makedirs(OUT, exist_ok=True)
DL = r'C:\Users\Fabio\Downloads'
JOBS = [  # name, source, box x, y, size
    ('dark', r'C:\Users\Fabio\Documents\Cubric Vision\Projects\test\Media\imported_001.jpg', 200, 200, 360),
    ('cat', DL + r'\Girl_with_cat_202603182027.jpeg', 215, 100, 360),
    ('red', DL + r'\place_the_redhead_202603310903.png', 470, 320, 520),
]
CROP, DEC, STITCHER = ['21', 1], ['169', 0], ['21', 0]
SEED = int(os.environ.get('SEED', 976866873943))
FACE = {'dark': (230, 280, 510, 560)}  # face rect in source px where the box frames the head loosely; else the box

def build(src, bx, by, bw, mode):
    p = json.load(open(os.path.join(HERE, 'r97', 'prompt.json')))
    keep = {'21', '79', '81', '88', '89', '90', '91', '128', '134', '140', '142', '144', '149', '154', '155', '156',
            '158', '161', '165', '169', '177', '178', '187', '189', '191', '194', '209', '211', '212', '213', '214', '221'}
    p = {k: v for k, v in p.items() if k in keep}
    p['79']['inputs']['string'] = src
    if os.environ.get('UNET'):
        p['194']['inputs']['unet_name'] = os.environ['UNET']
        p['194']['inputs']['weight_dtype'] = os.environ.get('DTYPE', 'default')
    p['177']['inputs']['steps'] = int(os.environ.get('STEPS', 4))
    if os.environ.get('CLIP'):
        p['189']['inputs']['clip_name'] = os.environ['CLIP']
    if os.environ.get('HEADLORA'):
        p['209']['inputs']['lora_name'] = os.environ['HEADLORA']
    p['209']['inputs']['strength_model'] = float(os.environ.get('HEADLORA_STR', 0.75))
    p['158']['inputs']['cfg'] = float(os.environ.get('CFG', 1.0))
    p['165']['inputs']['sampler_name'] = os.environ.get('SAMPLER', 'lcm')
    if os.environ.get('LORA') == '0':
        p['158']['inputs']['model'] = ['194', 0]
    if os.environ.get('TURBO'):
        p['210'] = {'class_type': 'LoraLoaderModelOnly', '_meta': {'title': 'Turbo'}, 'inputs': {
            'lora_name': os.environ['TURBO'], 'strength_model': float(os.environ.get('TURBO_STR', 1.0)), 'model': p['158']['inputs']['model']}}
        p['158']['inputs']['model'] = ['210', 0]
    if float(os.environ.get('CFG', 1.0)) > 1.0:
        # CFG > 1 needs a real uncond: empty prompt + the same reference latents (ConditioningZeroOut overcooks)
        p['9901'] = {'class_type': 'CLIPTextEncode', '_meta': {'title': 'neg'}, 'inputs': {'text': '', 'clip': ['189', 0]}}
        p['9902'] = {'class_type': 'ReferenceLatent', '_meta': {'title': 'neg ref1'}, 'inputs': {'conditioning': ['9901', 0], 'latent': ['144', 0]}}
        p['9903'] = {'class_type': 'ReferenceLatent', '_meta': {'title': 'neg ref2'}, 'inputs': {'conditioning': ['9902', 0], 'latent': ['154', 0]}}
        p['158']['inputs']['negative'] = ['9903', 0]
    p['187']['inputs']['int'] = SEED
    p['90']['inputs'].update(x=bx, y=by, width=bw, height=bw)
    if mode == 'expand':
        p['21']['inputs'].update(mask_expand_pixels=round(bw * 0.12), context_from_mask_extend_factor=1.1)
    def add(nid, cls, **inputs):
        p[nid] = {'class_type': cls, 'inputs': inputs, '_meta': {'title': cls}}
    add('921', 'ImageBlend', image1=DEC, image2=CROP, blend_factor=1.0, blend_mode='difference')
    add('922', 'ImageBlend', image1=CROP, image2=DEC, blend_factor=1.0, blend_mode='difference')
    add('923', 'ImageBlend', image1=['921', 0], image2=['922', 0], blend_factor=1.0, blend_mode='screen')
    add('924', 'ImageBlur', image=['923', 0], blur_radius=2, sigma=1.0)
    add('925', 'ImageToMask', image=['924', 0], channel='red')
    add('9251', 'ImageToMask', image=['924', 0], channel='green')
    add('9252', 'ImageToMask', image=['924', 0], channel='blue')
    add('9253', 'MaskComposite', destination=['925', 0], source=['9251', 0], x=0, y=0, operation='add')
    add('9254', 'MaskComposite', destination=['9253', 0], source=['9252', 0], x=0, y=0, operation='add')
    add('926', 'ThresholdMask', mask=['9254', 0], value=float(os.environ.get('THRESH', 0.18)))
    add('940', 'RemoveBackground', bg_removal_model=['214', 0], image=CROP)
    add('941', 'MaskComposite', destination=['221', 0], source=['940', 0], x=0, y=0, operation='add')
    add('927', 'GrowMask', mask=['941', 0], expand=int(os.environ.get('GATE', 60)), tapered_corners=True)
    add('928', 'MaskComposite', destination=['926', 0], source=['927', 0], x=0, y=0, operation='multiply')
    add('942', 'MaskComposite', destination=['940', 0], source=['221', 0], x=0, y=0, operation='subtract')
    add('943', 'MaskComposite', destination=['928', 0], source=['942', 0], x=0, y=0, operation='add')
    add('977', 'MaskToImage', mask=['940', 0]); add('978', 'PreviewImage', images=['977', 0])
    add('929', 'GrowMaskWithBlur', mask=['943', 0], expand=12, incremental_expandrate=0.0, tapered_corners=True,
        flip_input=False, blur_radius=12.0, lerp_alpha=1.0, decay_factor=1.0, fill_holes=os.environ.get('FILL', '0') == '1')
    add('930', 'ImageCompositeMasked', destination=CROP, source=DEC, x=0, y=0, resize_source=False, mask=['929', 0])
    for pre, img in (('94', DEC), ('93', ['930', 0])):
        add(pre + '8', 'InpaintStitchImproved', stitcher=STITCHER, inpainted_image=img)
        add(pre + '9', 'PreviewImage', images=[pre + '8', 0])
    add('933', 'MaskToImage', mask=['929', 0]); add('934', 'PreviewImage', images=['933', 0])
    add('975', 'MaskToImage', mask=['221', 0]); add('976', 'PreviewImage', images=['975', 0])
    add('971', 'PreviewImage', images=DEC)
    add('972', 'PreviewImage', images=CROP)
    return p

def run(p):
    req = urllib.request.Request(B + '/prompt', data=json.dumps({'prompt': p, 'client_id': str(uuid.uuid4())}).encode(),
                                 headers={'Content-Type': 'application/json'})
    try:
        pid = json.load(urllib.request.urlopen(req))['prompt_id']
    except urllib.error.HTTPError as e:
        print(e.read().decode()[:3000]); sys.exit(1)
    t0 = time.time()
    while True:
        h = json.load(urllib.request.urlopen(B + '/history/' + pid))
        if pid in h:
            break
        if time.time() - t0 > 3000:
            print('timeout'); sys.exit(1)
        time.sleep(2)
    r = h[pid]
    if r['status']['status_str'] != 'success':
        print(json.dumps(r['status'], indent=1)[:3000]); sys.exit(1)
    def fetch(node):
        f = r['outputs'][node]['images'][0]
        q = urllib.parse.urlencode({k: f[k] for k in ('filename', 'subfolder', 'type')})
        return Image.open(io.BytesIO(urllib.request.urlopen(B + '/view?' + q).read())).convert('RGB')
    return {n: fetch(n) for n in ('949', '939', '934', '976', '971', '972', '978')}, time.time() - t0

def fimg(a, w, h, rs=Image.BILINEAR):
    return np.asarray(Image.fromarray(a.astype(np.float32), 'F').resize((w, h), rs), np.float32)

def find_rect(src, crop, cx, cy, lo, hi):
    g = src.mean(2); c = crop.mean(2); H, W = g.shape
    g4 = fimg(g, W // 4, H // 4)
    best = None
    for s in range(lo // 4, hi // 4 + 1):
        o = fimg(c, s, s)
        for oy in range(-4, 5):
            for ox in range(-4, 5):
                x0, y0 = cx // 4 - s // 2 + ox, cy // 4 - s // 2 + oy
                if x0 < 0 or y0 < 0 or x0 + s > g4.shape[1] or y0 + s > g4.shape[0]:
                    continue
                e = np.abs(g4[y0:y0 + s, x0:x0 + s] - o).mean()
                if best is None or e < best[0]:
                    best = (e, s * 4, x0 * 4, y0 * 4)
    _, s0, x00, y00 = best
    best = None
    for s in range(s0 - 5, s0 + 6):
        o = fimg(c, s, s)
        for y0 in range(y00 - 6, y00 + 7):
            for x0 in range(x00 - 6, x00 + 7):
                if x0 < 0 or y0 < 0 or x0 + s > W or y0 + s > H:
                    continue
                e = np.abs(g[y0:y0 + s, x0:x0 + s] - o).mean()
                if best is None or e < best[0]:
                    best = (e, s, x0, y0)
    return best

rows = []
for name, src_path, bx, by, bw in [j for j in JOBS if j[0] in os.environ.get('JOBS', 'dark,cat,red').split(',')]:
    src = np.asarray(Image.open(src_path).convert('RGB'), np.float32)
    H, W = src.shape[:2]
    for mode in os.environ.get('MODES', 'box,expand').split(','):
        tag = f'{name}_{mode}_s{SEED}'
        if os.environ.get('DRY') == '1':
            json.dump(build(src_path, bx, by, bw, mode), open(os.path.join(OUT, f'{tag}_prompt.json'), 'w'), indent=1)
            print(tag, 'dry', flush=True)
            continue
        im, dt = run(build(src_path, bx, by, bw, mode))
        for n, v in im.items():
            v.save(os.path.join(OUT, f'{tag}_{n}.png'))
        im['939'].crop(FACE.get(name, (bx, by, bx + bw, by + bw))).save(os.path.join(OUT, f'{tag}_face.png'))
        crop, dec = np.asarray(im['972'], np.float32), np.asarray(im['971'], np.float32)
        person = np.asarray(im['976'].convert('L'), np.float32) / 255
        region = np.asarray(im['934'].convert('L'), np.float32) / 255
        e = round(bw * 0.12) if mode == 'expand' else 0
        err, S, X0, Y0 = find_rect(src, crop, bx + bw // 2, by + bw // 2, int(bw * 1.05), int(bw * 1.75))
        # returned rect = box (+ expand)
        rx, ry, rw = bx - e, by - e, bw + 2 * e
        def to_src(a, rs=Image.BILINEAR):
            full = np.zeros((H, W), np.float32)
            y1, x1 = min(H, Y0 + S), min(W, X0 + S)
            full[Y0:y1, X0:x1] = fimg(a, S, S, rs)[:y1 - Y0, :x1 - X0]
            return full
        stable = to_src((np.abs(dec - crop).max(2) < 30).astype(np.float32), Image.NEAREST) > 0.5
        pers = to_src(person) > 0.5
        grown = np.asarray(Image.fromarray(((to_src(person) > 0.1) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(25)), np.float32) > 0
        reg = to_src(region)
        edge = np.zeros((H, W), bool)
        edge[max(0, ry + 8):ry + rw - 8, max(0, rx + 8):rx + rw - 8] = True
        edge[ry + 40:ry + rw - 40, rx + 40:rx + rw - 40] = False
        for n, label in (('949', 'D raw'), ('939', 'C region')):
            d = np.asarray(im[n], np.float32) - src
            bg, body = edge & stable & ~grown, edge & stable & pers
            rb = (reg > 0.05) & (reg < 0.95) & stable
            med = lambda m: str(np.median(d[m], 0).round(1)) if m.sum() > 50 else 'n/a'
            rows.append((f'{tag:12} {label:9}', med(bg), f'{np.abs(d[bg]).mean():.2f}' if bg.sum() > 50 else 'n/a',
                         med(body), med(rb) if n == '939' else '-', f'{dt:.0f}s crop {S}@{X0},{Y0} err {err:.1f}'))
        # zoom sheet: source | D | C at the returned rect's bottom, left and top edges
        spots = [(rx + rw // 2 - 90, ry + rw - 90), (rx - 90, ry + rw // 2 - 90), (rx + rw // 4 - 90, ry - 90)]
        cols = [('source', Image.open(src_path).convert('RGB')), ('D raw', im['949']), ('C region', im['939'])]
        sheet = Image.new('RGB', (3 * 360, 3 * 380), (20, 20, 20))
        for ri, (sx, sy) in enumerate(spots):
            sx, sy = max(0, min(W - 180, sx)), max(0, min(H - 180, sy))
            for ci, (cl, cim) in enumerate(cols):
                sheet.paste(cim.crop((sx, sy, sx + 180, sy + 180)).resize((360, 360), Image.NEAREST), (ci * 360, ri * 380 + 20))
                ImageDraw.Draw(sheet).text((ci * 360 + 4, ri * 380 + 4), f'{tag} {cl} @{sx},{sy}', fill=(255, 220, 0))
        sheet.save(os.path.join(OUT, f'{tag}_zoom.png'))
        print(tag, 'done', f'{dt:.0f}s', flush=True)

print(f'\n{"run":22} {"bg seam":>18} {"bg|d|":>6} {"body seam":>18} {"region edge":>18}  info')
for r_ in rows:
    print(f'{r_[0]:22} {r_[1]:>18} {r_[2]:>6} {r_[3]:>18} {r_[4]:>18}  {r_[5]}')
