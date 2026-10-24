"""MPI-1271 bench: every control graph, Custom size off and on. Run from repo root under gpu_lease.

Source is a 700x1120 portrait; on asks for 1344x768 landscape, so a pad is obvious.
Off must follow the source shape; on must come out 1344x768.
"""
import copy, json, os, struct, sys, time, urllib.request, urllib.error

URL = 'http://127.0.0.1:8188'
HERE = os.path.dirname(os.path.abspath(__file__))
INPUT = 'G:/ComfyUi/ComfyUI/input'
SRC = 'mpi1033_sheriff_portrait.png'
W, H = 1344, 768
PROMPT = 'a weathered sheriff standing in a dusty western street at golden hour, photo'
GRAPHS = {   # model -> (runtime, control wf_type)
    'sdxl': ('t2i_sdxl_realistic.json', 3),
    'chroma': ('chroma_t2i.json', 3),
    'krea2': ('krea2_t2i_sfw.json', 3),
    'klein': ('klein_t2i.json', 3),
    'chroma_hyper': ('chroma_hyper_t2i.json', 3),   # same template as chroma, weights on this box
    'klein_9b': ('klein_9b_t2i.json', 3),           # same template as klein
    'qwen_edit': ('qwen_edit.json', 2),
    'qwen21': ('qwen_image_2_1.json', 3),
}

def T(g, title):
    return next(n for n in g.values() if n.get('_meta', {}).get('title') == title)['inputs']

def build(name, on):
    f, wf = GRAPHS[name]
    g = copy.deepcopy(json.load(open(f'comfy_workflows/{f}', encoding='utf8')))
    T(g, 'Input_wf_type')['int'] = wf
    T(g, 'Input_Seed')['int'] = 1271
    pos = T(g, 'Input_Positive'); pos['string' if 'string' in pos else 'value'] = PROMPT
    img = T(g, 'Input_Image'); img['image'] = SRC; img['string'] = f'{INPUT}/{SRC}'
    T(g, 'Input_custom_size')['boolean'] = on
    T(g, 'Input_Width')['int'] = W; T(g, 'Input_Height')['int'] = H
    return g

def run(g, tag):
    body = json.dumps({'prompt': g, 'client_id': 'mpi1271'}).encode()
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request(f'{URL}/prompt', body, {'Content-Type': 'application/json'})))
        pid = r['prompt_id']
        if r.get('node_errors'):   # ComfyUI drops an invalid output node and still runs the rest
            print(tag, 'NODE ERRORS', json.dumps(r['node_errors'])[:1500], flush=True)
    except urllib.error.HTTPError as e:
        print(tag, 'REJECTED', e.read().decode()[:1500], flush=True); return
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h: break
        if time.time() - t0 > 900: print(tag, 'TIMEOUT', flush=True); return
    h = h[pid]
    if h['status'].get('status_str') != 'success':
        print(tag, 'FAILED', json.dumps(h['status'])[:1500], flush=True); return
    out_id = next(k for k, n in g.items() if n.get('_meta', {}).get('title') == 'Output_Image')
    ims = h['outputs'].get(out_id, {}).get('images')   # never fall back: Input_Image previews the source
    if not ims: print(tag, 'NO OUTPUT', sorted(h['outputs']), flush=True); return
    im = ims[0]
    data = urllib.request.urlopen(f"{URL}/view?filename={im['filename']}&subfolder={im['subfolder']}&type={im['type']}").read()
    path = os.path.join(HERE, f'mpi1271_{tag}.png'); open(path, 'wb').write(data)
    print(tag, f'{time.time() - t0:.0f}s', 'size', struct.unpack('>II', data[16:24]), path, flush=True)

for name in (sys.argv[1:] or GRAPHS):
    for on in (False, True):
        run(build(name, on), f"{name}_{'on' if on else 'off'}")
