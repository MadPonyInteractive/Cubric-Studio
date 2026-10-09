# MPI-936 reopen (2026-10-09): A/B on the SHIPPED runtime graphs (comfy_workflows/*.json), not graph.py.
#   boogu  - Boogu Image Edit Balanced, fp8 vs int8_convrot Qwen3-VL-8B encoder at CLIPLoader type boogu
#   limbs  - Qwen-Image 2.1 t2i, one variable at a time against the app's settings (fp8 / 25 steps /
#            1024x1024 / short prompt / cfg 1): int8 encoder, 40 steps, 2048x2048, long prompt, cfg 2
# Run under the GPU lease with the bench python (PIL):
#   python gpu_lease.py run --timeout 7200 -- G:/ComfyUi/python_embeded/python.exe ab.py limbs
# Each job's output lands in OUT/<group>/<name>.png; a contact sheet per group in OUT/<group>_sheet.jpg.
import copy, io, json, os, sys, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw

URL = 'http://127.0.0.1:8188'
REPO = 'C:/AI/Mpi/Cubric-Vision'
OUT = os.environ.get('MPI936_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
ONLY = set(sys.argv[2:])  # optional variant names: run just those columns (the sheet still shows all)
FP8 = 'qwen3vl_8b_fp8_scaled.safetensors'
INT8 = 'qwen3vl_8b_int8_convrot.safetensors'

SHORT = {
    'yoga': 'Photo of a young woman doing a warrior two yoga pose on a beach at sunrise, full body, arms stretched out.',
    'bench': 'Photo of two friends sitting cross-legged on a park bench, one with her arm around the other, full body.',
    'jump': 'Photo of a man in jeans jumping over a puddle on a city street, full body, mid-air, arms and legs spread.',
}
LONG = {
    'yoga': (
        'This is a realistic photograph of a young woman holding a warrior two yoga pose on a wide sandy beach at '
        'sunrise, framed full body against a pale peach and blue-grey sky. The beach stretches flat and damp behind '
        'her, the wet sand reflecting the soft colours of the sky, and small low waves fold onto the shore in the '
        'lower third of the frame. She stands in the centre, side-on to the camera, her feet planted wide apart on '
        'the sand: her front right knee bends directly above her right ankle, her back left leg is straight, and the '
        'outer edge of her left foot presses into the sand. Both arms extend straight out at shoulder height, parallel '
        'to the ground, the right arm reaching towards the right edge of the frame and the left arm reaching towards '
        'the left edge, fingers together and palms facing down. Her head turns to look along her right arm. She wears '
        'a fitted charcoal sports top and matching full-length leggings, her dark hair tied back in a low bun, and her '
        'feet are bare. Two sets of footprints trail away behind her towards the left edge, and a lone gull stands at '
        'the waterline on the far right. Along the horizon a thin band of haze softens the line between sea and sky. '
        'The low sun sits just above the horizon behind her left shoulder, backlighting her in warm gold, rimming her '
        'arms and shoulders with light and casting a long soft shadow across the sand towards the camera. The whole '
        'frame is calm and balanced, a quiet, airy, photorealistic morning scene in warm pastel tones.'),
    'bench': (
        'This is a realistic photograph of two young women sitting cross-legged side by side on a wooden park bench, '
        'framed full body in a green city park on a bright afternoon. Behind them a wide lawn runs back to a row of '
        'tall plane trees, and a gravel path crosses the lower edge of the frame in front of the bench. The bench is '
        'weathered wood on black iron legs, set in the centre of the frame. The woman on the left has shoulder-length '
        'auburn hair and wears a mustard knit jumper and blue jeans; her right arm rests around the shoulders of her '
        'friend, her hand resting on her friend\'s far shoulder, and her left hand rests on her own knee. The woman on '
        'the right has short black curly hair and wears a white t-shirt under an open denim jacket and black trousers; '
        'both of her hands hold a paper coffee cup in her lap. Each of them sits with her legs folded, shins crossed in '
        'front of her on the seat, white trainers resting on the wooden slats. They lean slightly towards each other and '
        'laugh, looking at each other. A canvas tote bag sits on the bench beside the woman on the right, and a few '
        'fallen leaves lie on the gravel. Soft sunlight falls from the upper left through the trees, dappling the lawn '
        'and their clothes with patches of light and leaving gentle shadows beneath the bench. The frame is warm, '
        'friendly and evenly balanced, a natural photorealistic scene in greens, mustard and denim blue.'),
    'jump': (
        'This is a realistic photograph of a man in his thirties caught mid-air as he leaps over a wide rain puddle on '
        'a wet city street, framed full body from a low angle on an overcast day. Behind him a row of brick shopfronts '
        'with dark windows runs across the background, slightly out of focus, and a parked red bicycle leans against '
        'a lamp post on the far left. The puddle fills the lower centre of the frame, its still surface mirroring him '
        'and the grey sky. He is in the centre, his body leaning forward: his right leg stretches forward with the '
        'knee nearly straight and the heel of his brown leather boot reaching towards the right edge, his left leg '
        'trails behind him bent at the knee, his left boot lifted high behind. His arms spread wide for balance, the '
        'left arm raised up and out towards the upper left corner and the right arm reaching back and down towards the '
        'lower right, fingers open. He wears blue jeans, a grey hooded sweatshirt and an olive canvas jacket that flares '
        'open as he jumps, and his short dark hair is lifted by the motion. Small droplets hang in the air below his '
        'trailing boot. The light is soft and even from the cloudy sky, with no hard shadows, and the wet pavement '
        'carries a dull silver sheen. The frame is dynamic and balanced, a crisp photorealistic street moment in muted '
        'greys, brick red and denim blue.'),
}
SEEDS = (11, 22, 33)
# (name, overrides) - one variable each against `base`. Grouped so the encoder swaps once.
VARIANTS = (
    ('base', {}),
    ('steps30', {'steps': 30}),
    ('steps40', {'steps': 40}),
    ('2k', {'size': 2048}),
    ('long', {'long': True}),
    ('cfg2', {'cfg': 2.0}),
    ('int8', {'clip': INT8}),
)

# Fabio's own failures in his "Qwen 2.1" project (sidecars, 2026-10-09): prompt, seed and size exactly as the app
# sent them. The `base` column must reproduce his card; every other column is one variable, as in `limbs`.
REPRO = {
    't2i_002': dict(short='A shark jumping out of the water and biting a fisherman on a small boat ', seed=3978896040,
                    size=(1472, 1472), big=(2048, 2048), long=(
        'This is a realistic action photograph of a great white shark bursting out of the sea beside a small white '
        'fishing boat, framed from slightly above the waterline on a grey overcast day. The open ocean fills the '
        'background, dark blue-grey and choppy under a flat pale sky, with the horizon running straight across the '
        'upper third of the frame. The boat sits in the left half of the frame, a small open fibreglass skiff with a '
        'white hull and an outboard motor at its stern. The fisherman stands inside the boat near the bow, a bearded '
        'man in a dark waterproof jacket, grey trousers and rubber boots, both feet planted on the deck. He leans back '
        'away from the water, his left hand gripping the boat\'s side rail and his right forearm held out over the '
        'water, where the shark\'s jaws have closed around the sleeve of his jacket. The shark rises out of the water '
        'on the right, its body angled up towards the boat, the pale underside and the dark grey back clearly '
        'visible, the dorsal fin and both pectoral fins spread, and its tail still under the surface. White spray and '
        'droplets burst around the shark and splash against the hull. The light is soft and even from the cloudy sky, '
        'with cool reflections on the wet skin of the shark and the hull. The frame is tense and dynamic, a sharp '
        'photorealistic moment in cold blues, greys and white.')),
    't2i_003': dict(short='A woman in a bikini on a beach with water up to her knees ', seed=1193008211,
                    size=(896, 1088), big=(1664, 2048), long=(
        'This is a realistic photograph of a young woman standing in clear shallow sea water up to her knees, framed '
        'full body on a bright summer day. Behind her the sea runs out to the horizon in bands of pale turquoise and '
        'deep blue, a low rocky island sits small on the horizon on the left, and a few thin white clouds cross the '
        'blue sky at the top of the frame. She stands in the centre, facing the camera, her weight on her right leg '
        'and her left knee slightly bent, the water lapping just above her knees and her lower legs visible through '
        'the clear water over the pale sand. Her arms hang relaxed at her sides, her hands resting lightly against her '
        'thighs. She wears a teal and navy striped bikini, a thin silver bracelet on her left wrist, and her long wavy '
        'brown hair falls over her shoulders. She smiles softly towards the camera. Small ripples circle her legs and '
        'catch the sun in bright flecks across the lower third of the frame. The sun is high and slightly to the left, '
        'lighting her evenly, leaving a soft shadow under her chin and bright highlights on her shoulders and on the '
        'water. The frame is calm and balanced, a bright natural photorealistic beach scene in turquoise, sand and '
        'warm skin tones.')),
}

EDITS = (  # Boogu Balanced: (name, source display webp, instruction, seed)
    ('raincoat', 'qwen-image-2-1.webp', 'change her yellow raincoat to a red leather jacket', 5),
    ('night', 'qwen-image-2-1.webp', 'make it night time, the street lamps are on and the wet cobblestones reflect their light', 6),
    ('dog', 'klein-4b.webp', 'replace the dog with a golden retriever puppy', 7),
)


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def upload_display(name):
    """Upload comfy_workflows/display/<name> as PNG to the bench input/mpi936/; return the loader string."""
    buf = io.BytesIO()
    Image.open(f'{REPO}/comfy_workflows/display/{name}').convert('RGB').save(buf, 'PNG')
    stem = os.path.splitext(name)[0] + '.png'
    b = '----mpi936'
    body = (f'--{b}\r\nContent-Disposition: form-data; name="subfolder"\r\n\r\nmpi936\r\n'
            f'--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n'
            f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{stem}"\r\n'
            f'Content-Type: image/png\r\n\r\n').encode() + buf.getvalue() + f'\r\n--{b}--\r\n'.encode()
    req = urllib.request.Request(URL + '/upload/image', data=body,
                                 headers={'Content-Type': f'multipart/form-data; boundary={b}'})
    urllib.request.urlopen(req, timeout=60).read()
    return f'mpi936/{stem}'


def by_title(g, title):
    return next(n for n in g.values() if n.get('_meta', {}).get('title') == title)


def run(g, out_node, path):
    t0 = time.time()
    try:
        pid = call('/prompt', {'prompt': g, 'client_id': 'mpi936ab'})['prompt_id']
    except urllib.error.HTTPError as e:
        print(path, 'REJECTED', e.read().decode()[:3000], flush=True)
        sys.exit(1)
    while True:
        time.sleep(2)
        h = call(f'/history/{pid}')
        if pid in h:
            break
    st = h[pid].get('status', {})
    if st.get('status_str') != 'success':
        print(path, 'FAILED', json.dumps(st.get('messages', []))[-3000:], flush=True)
        sys.exit(1)
    f = h[pid]['outputs'][out_node]['images'][0]
    q = urllib.parse.urlencode({'filename': f['filename'], 'subfolder': f['subfolder'], 'type': f['type']})
    raw = urllib.request.urlopen(f'{URL}/view?{q}', timeout=60).read()
    open(path, 'wb').write(raw)
    print(os.path.basename(path), f'{time.time() - t0:.0f}s', Image.open(io.BytesIO(raw)).size, flush=True)


def sheet(rows, cols, path, cell=320):
    """rows: [(label, [png paths per col])]; one labelled grid, every cell letterboxed to `cell`."""
    pad = 24
    im = Image.new('RGB', (pad * 6 + cell * len(cols), pad + (cell + pad) * len(rows)), 'white')
    d = ImageDraw.Draw(im)
    for c, name in enumerate(cols):
        d.text((pad * 6 + c * cell + 4, 4), name, fill='black')
    for r, (label, files) in enumerate(rows):
        y = pad + r * (cell + pad)
        d.text((4, y + cell // 2), label, fill='black')
        for c, f in enumerate(files):
            if f and os.path.exists(f):
                t = Image.open(f).convert('RGB')
                t.thumbnail((cell, cell))
                im.paste(t, (pad * 6 + c * cell, y))
    im.save(path, quality=90)
    print('sheet', path, flush=True)


def limbs():
    base = json.load(open(f'{REPO}/comfy_workflows/qwen_image_2_1.json', encoding='utf-8'))
    out = os.path.join(OUT, 'limbs')
    os.makedirs(out, exist_ok=True)
    for vname, o in VARIANTS:
        if ONLY and vname not in ONLY:
            continue
        for p in SHORT:
            for seed in SEEDS:
                path = os.path.join(out, f'{p}_{seed}_{vname}.png')
                if os.path.exists(path):
                    continue
                g = copy.deepcopy(base)
                by_title(g, 'Input_Positive')['inputs']['string'] = (LONG if o.get('long') else SHORT)[p]
                by_title(g, 'Input_Seed')['inputs']['int'] = seed
                by_title(g, 'Input_wf_type')['inputs']['int'] = 1
                by_title(g, 'Input_Width')['inputs']['int'] = o.get('size', 1024)
                by_title(g, 'Input_Height')['inputs']['int'] = o.get('size', 1024)
                g['3']['inputs']['clip_name'] = o.get('clip', FP8)
                g['33']['inputs']['steps'] = o.get('steps', 25)
                g['33']['inputs']['cfg'] = o.get('cfg', 1)
                run(g, '35', path)
    cols = [v for v, _ in VARIANTS]
    rows = [(f'{p} {s}', [os.path.join(out, f'{p}_{s}_{v}.png') for v in cols]) for p in SHORT for s in SEEDS]
    sheet(rows, cols, os.path.join(OUT, 'limbs_sheet.jpg'))


def repro():
    base = json.load(open(f'{REPO}/comfy_workflows/qwen_image_2_1.json', encoding='utf-8'))
    out = os.path.join(OUT, 'repro')
    os.makedirs(out, exist_ok=True)
    for vname, o in VARIANTS:
        if ONLY and vname not in ONLY:
            continue
        for card, r in REPRO.items():
            path = os.path.join(out, f'{card}_{vname}.png')
            if os.path.exists(path):
                continue
            w, h = r['big'] if 'size' in o else r['size']
            g = copy.deepcopy(base)
            by_title(g, 'Input_Positive')['inputs']['string'] = r['long'] if o.get('long') else r['short']
            by_title(g, 'Input_Seed')['inputs']['int'] = r['seed']
            by_title(g, 'Input_wf_type')['inputs']['int'] = 1
            by_title(g, 'Input_Width')['inputs']['int'] = w
            by_title(g, 'Input_Height')['inputs']['int'] = h
            g['3']['inputs']['clip_name'] = o.get('clip', FP8)
            g['33']['inputs']['steps'] = o.get('steps', 25)
            g['33']['inputs']['cfg'] = o.get('cfg', 1)
            run(g, '35', path)
    cols = ['app'] + [v for v, _ in VARIANTS]
    media = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media/'
    rows = [(c, [media + c + '.png'] + [os.path.join(out, f'{c}_{v}.png') for v, _ in VARIANTS]) for c in REPRO]
    sheet(rows, cols, os.path.join(OUT, 'repro_sheet.jpg'), cell=360)


def boogu():
    base = json.load(open(f'{REPO}/comfy_workflows/boogu_edit_balanced.json', encoding='utf-8'))
    out = os.path.join(OUT, 'boogu')
    os.makedirs(out, exist_ok=True)
    srcs = {s: upload_display(s) for _, s, _, _ in EDITS}
    for clip, tag in ((FP8, 'fp8'), (INT8, 'int8')):
        for name, src, prompt, seed in EDITS:
            path = os.path.join(out, f'{name}_{tag}.png')
            if os.path.exists(path):
                continue
            g = copy.deepcopy(base)
            by_title(g, 'Input_Image')['inputs']['image'] = srcs[src]
            by_title(g, 'Input_Positive')['inputs']['string'] = prompt
            by_title(g, 'Input_Seed')['inputs']['int'] = seed
            g['59']['inputs']['clip_name'] = clip
            run(g, '204', path)
    rows = [(n, [f'{REPO}/comfy_workflows/display/{s}', os.path.join(out, f'{n}_fp8.png'),
                 os.path.join(out, f'{n}_int8.png')]) for n, s, _, _ in EDITS]
    sheet(rows, ['source', 'fp8', 'int8'], os.path.join(OUT, 'boogu_sheet.jpg'), cell=420)


if __name__ == '__main__':
    {'limbs': limbs, 'boogu': boogu, 'repro': repro}[sys.argv[1]]()
