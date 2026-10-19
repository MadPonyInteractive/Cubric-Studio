# MPI-1207 phase 2 bench: the SHIPPED runtime graphs (custom-size gate baked in), no patching.
# Per model, three runs from a 571x1021 portrait:
#   on   Input_custom_size true, 1024x1024, no mask -> must come back 1024x1024 (fills)
#   off  Input_custom_size false, no size           -> must follow the source's shape
#   mask Input_custom_size true, 1024x1024, a mask  -> must keep the source frame (gate's NOT masked)
# Usage: python bench2.py <out dir> model[:case] [...]    (case omitted = all three)
import json, sys, time, copy, urllib.request, urllib.parse, urllib.error
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
OUT = sys.argv[1].rstrip('/') + '/'
URL = 'http://127.0.0.1:8188'
WF = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/'
IMG1 = 'G:/ComfyUi/ComfyUI/input/49cf8c25b4fa85adadb44600e456fd41.jpg'  # 571x1021 portrait
MASK = 'G:/ComfyUi/ComfyUI/input/mpi1207_bench2_mask.png'  # MpiLoadImage reads only inside input/
import os
W, H = int(os.environ.get('BW', 1024)), int(os.environ.get('BH', 1024))  # BW/BH/BLABEL: another custom frame
EDIT = 'Change the colour of her top to deep burgundy. Keep everything else exactly as it is.'
# What commandExecutor sends Qwen Edit on a custom-size run (withCanvasPrompt).
import os
CANVAS = f'TARGET CANVAS: {os.environ.get("BLABEL", "1:1")}\n{EDIT}\n' + os.environ.get('QE_TAIL', 'Extend the scene outward on every side so it fills the whole picture edge to edge. No black bars, no borders, no padding.')

MODELS = {
    'klein4b':  ('klein_t2i.json',           {'Input_wf_type': 4}),
    'klein9b':  ('klein_9b_t2i.json',        {'Input_wf_type': 4}),
    'krea2':    ('krea2_t2i_sfw.json',       {'Input_wf_type': 4}),
    'qwen21':   ('qwen_image_2_1.json',      {'Input_wf_type': 4}),
    'boogu':    ('boogu_edit_balanced.json', {}),
    'qwenedit': ('qwen_edit.json',           {'Input_wf_type': 1, 'Input_Tier': 3}),  # 3 = Hyper, fastest
}


def make_mask():
    src = Image.open(IMG1)
    m = Image.new('RGB', src.size, (0, 0, 0))
    w, h = src.size
    m.paste((255, 0, 0), (int(w * 0.25), int(h * 0.35), int(w * 0.75), int(h * 0.6)))  # the top
    m.save(MASK)


def run(name, case):
    f, inj = MODELS[name]
    p = copy.deepcopy(json.load(open(WF + f, encoding='utf-8')))
    vals = {**inj, 'Input_Image': IMG1, 'Input_Seed': 424242, 'Input_custom_size': case != 'off',
            'Input_Positive': CANVAS if (name == 'qwenedit' and case == 'on') else EDIT}
    if case != 'off':
        vals.update(Input_Width=W, Input_Height=H)
    if case == 'mask':
        vals['Input_Mask'] = MASK
    missing = [t for t in ('Input_custom_size',) if not any(v['_meta']['title'] == t for v in p.values())]
    assert not missing, f'{f} has no {missing}'
    for t, val in vals.items():
        for n in [v for v in p.values() if v['_meta']['title'] == t][:1]:
            if n['class_type'] == 'MpiLoadImage':
                n['inputs']['string'] = val
            else:
                keys = [k for k, v in n['inputs'].items() if not isinstance(v, list)]
                n['inputs'][keys[0]] = val
    # Style LoRAs the bench lacks would fail validation; no style is picked, so 'None' is what the app sends.
    spec = json.load(urllib.request.urlopen(URL + '/object_info/MpiStyleLoras'))['MpiStyleLoras']['input']
    opts = {**spec.get('required', {}), **spec.get('optional', {})}
    for n in p.values():
        if n['class_type'] == 'MpiStyleLoras':
            for k, v in n['inputs'].items():
                if k.startswith('lora_') and isinstance(v, str) and v not in opts[k][0]:
                    n['inputs'][k] = 'None'
    out_id = next(k for k, v in p.items() if v['_meta']['title'] == 'Output_Image')
    req = urllib.request.Request(URL + '/prompt', data=json.dumps({'prompt': p}).encode(),
                                 headers={'Content-Type': 'application/json'})
    try:
        pid = json.load(urllib.request.urlopen(req))['prompt_id']
    except urllib.error.HTTPError as e:
        print(name, case, 'SUBMIT FAILED', e.read().decode()[:2000], flush=True); return False
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h and (h[pid]['status'].get('completed') or h[pid]['status'].get('status_str') == 'error'):
            break
        if time.time() - t0 > 1500:
            print(name, case, 'TIMEOUT', flush=True); return False
    st = h[pid]['status']
    for m in st.get('messages', []):
        if m[0] == 'execution_error':
            print('  ', json.dumps(m[1])[:1200])
    ims = h[pid]['outputs'].get(out_id, {}).get('images', [])
    if not ims:
        print(name, case, st.get('status_str'), 'NO IMAGE', flush=True); return False
    im = ims[0]
    q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
    dst = OUT + f'b2_{name}_{case}{os.environ.get("QE_TAG", "")}.png'
    with urllib.request.urlopen(f'{URL}/view?{q}') as src, open(dst, 'wb') as fo:
        fo.write(src.read())
    w, hh = Image.open(dst).size
    ratio = w / hh
    want = {'on': abs(ratio - W / H) < 0.02, 'off': abs(ratio - 571 / 1021) < 0.03, 'mask': abs(ratio - 571 / 1021) < 0.03}[case]
    print(f'{name} {case} {st.get("status_str")} wall {round(time.time() - t0)}s -> {w}x{hh} '
          f'{"PASS" if want else "FAIL"} (size)  {dst}', flush=True)
    return want


make_mask()
results = []
for arg in sys.argv[2:]:
    name, _, case = arg.partition(':')
    for c in ([case] if case else ['on', 'off', 'mask']):
        results.append(run(name, c))
sys.exit(0 if all(results) else 1)
