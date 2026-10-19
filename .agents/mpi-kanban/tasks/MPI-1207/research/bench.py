# MPI-1207 bench: each local edit model's SHIPPED runtime graph, unmasked edit, with a TEST-ONLY
# patch that swaps the edit latent for an empty one at a frame other than the source's.
# Usage: python bench.py model:variant [...]   variant = src (no patch) | bare | canvas
import json, sys, time, copy, urllib.request, urllib.parse, urllib.error, shutil
sys.stdout.reconfigure(encoding='utf-8')
S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/1e4ef77f-40a2-481b-8ecc-5e1596b8a16f/scratchpad/'
URL = 'http://127.0.0.1:8188'
WF = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
IMG1 = 'G:/ComfyUi/ComfyUI/input/49cf8c25b4fa85adadb44600e456fd41.jpg'  # 571x1021 portrait
W, H = 1024, 1024
EDIT = 'Change the colour of her top to deep burgundy. Keep everything else exactly as it is.'
CANVAS = ('TARGET CANVAS: 1:1\nChange her top to deep burgundy. Widen the view of the balcony to the left and '
          'right so the scene fills the whole square picture edge to edge, no borders.')

def new_node(p, cls, inputs):
    k = str(max(int(x) for x in p if x.isdigit()) + 1)
    p[k] = {'class_type': cls, 'inputs': inputs, '_meta': {'title': 'bench latent'}}
    return [k, 0]

def p_klein(p):
    p['185']['inputs']['latent_image'] = new_node(p, 'EmptyFlux2LatentImage', {'width': W, 'height': H, 'batch_size': 1})
    p['173']['inputs']['width'], p['173']['inputs']['height'] = W, H
def p_krea2(p):
    p['561']['inputs']['any_4'] = ['560', 0]
def p_qwen21(p):
    p['32']['inputs']['switch'] = False
def p_boogu(p):
    p['143']['inputs']['width'], p['143']['inputs']['height'] = W, H
def p_qwenedit(p):
    p['30']['inputs']['latent_image'] = new_node(p, 'EmptySD3LatentImage', {'width': W, 'height': H, 'batch_size': 1})

MODELS = {
    'klein4b':  ('klein_t2i.json',        p_klein,    {'Input_wf_type': 4}),
    'klein9b':  ('klein_9b_t2i.json',     p_klein,    {'Input_wf_type': 4}),
    'krea2':    ('krea2_t2i_sfw.json',    p_krea2,    {'Input_wf_type': 4}),
    'qwen21':   ('qwen_image_2_1.json',   p_qwen21,   {'Input_wf_type': 4}),
    'boogu':    ('boogu_edit_balanced.json', p_boogu, {}),
    'qwenedit': ('qwen_edit.json',        p_qwenedit, {'Input_wf_type': 1, 'Input_Tier': 3}),  # 3 = Hyper, lowest quality
}

def run(case):
    name, variant = case.split(':')
    f, patch, inj = MODELS[name]
    p = copy.deepcopy(json.load(open(WF + f, encoding='utf-8')))
    vals = {**inj, 'Input_Image': IMG1, 'Input_Seed': 424242,
            'Input_Positive': CANVAS if variant == 'canvas' else EDIT}
    if 'Input_Width' in str(p): vals.update(Input_Width=W, Input_Height=H)
    for t, val in vals.items():
        hits = [v for v in p.values() if v['_meta']['title'] == t]
        if not hits: continue
        n = hits[0]
        if n['class_type'] == 'MpiLoadImage':
            n['inputs']['string'] = val
        else:
            keys = [k for k, v in n['inputs'].items() if not isinstance(v, list)]
            n['inputs'][keys[0]] = val
    if variant != 'src': patch(p)
    # Style LoRAs the bench lacks would fail validation; no style is picked here, so 'None' is
    # exactly what the app's empty style sends.
    spec = json.load(urllib.request.urlopen(URL + '/object_info/MpiStyleLoras'))['MpiStyleLoras']['input']
    opts = {**spec.get('required', {}), **spec.get('optional', {})}
    for n in p.values():
        if n['class_type'] == 'MpiStyleLoras':
            for k, v in n['inputs'].items():
                if k.startswith('lora_') and isinstance(v, str) and v not in opts[k][0]:
                    n['inputs'][k] = 'None'
    out_id = next(k for k, v in p.items() if v['_meta']['title'] == 'Output_Image')
    req = urllib.request.Request(URL + '/prompt', data=json.dumps({'prompt': p}).encode(), headers={'Content-Type': 'application/json'})
    try:
        pid = json.load(urllib.request.urlopen(req))['prompt_id']
    except urllib.error.HTTPError as e:
        print(case, 'SUBMIT FAILED', e.read().decode()[:2000]); return False
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h and (h[pid]['status'].get('completed') or h[pid]['status'].get('status_str') == 'error'):
            break
        if time.time() - t0 > 1500: print(case, 'TIMEOUT'); return False
    st = h[pid]['status']
    print(case, st.get('status_str'), 'wall', round(time.time() - t0, 1), 's', flush=True)
    for m in st.get('messages', []):
        if m[0] == 'execution_error': print('  ', json.dumps(m[1])[:1200])
    for im in h[pid]['outputs'].get(out_id, {}).get('images', []):
        q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
        dst = S + f'b_{name}_{variant}.png'
        with urllib.request.urlopen(f'{URL}/view?{q}') as src, open(dst, 'wb') as fo:
            shutil.copyfileobj(src, fo)
        print('   saved', dst)
    if not h[pid]['outputs'].get(out_id, {}).get('images'):
        print('   NO IMAGE - output dropped (validation error? see bench log)', flush=True); return False
    return st.get('status_str') == 'success'

ok = [run(c) for c in sys.argv[1:]]
sys.exit(0 if all(ok) else 1)
