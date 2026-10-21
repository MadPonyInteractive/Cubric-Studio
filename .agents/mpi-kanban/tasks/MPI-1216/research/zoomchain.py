# MPI-1216 zoom drift: chain N edits of one picture through the shipped graph, per variant.
# A = graph as shipped (refs resized to 1 MP). B = refs at their own size ("keep resolution").
# Usage: python zoomchain.py A|B [N]
import json, sys, time, copy, urllib.request, urllib.parse, shutil
sys.stdout.reconfigure(encoding='utf-8')
S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/e33bb813-b7a8-4312-aad9-ec662c68e122/scratchpad/'
URL = 'http://127.0.0.1:8188'
IN = 'G:/ComfyUi/ComfyUI/input/'
BASE = json.load(open('C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json', encoding='utf-8'))
PROMPT = 'In <ref_image_0>, keep the photo exactly as it is. Change nothing.'
variant, n = sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 3


def run(src, seed, out):
    p = copy.deepcopy(BASE)
    def node(t):
        hits = [v for v in p.values() if v['_meta']['title'] == t]
        assert len(hits) == 1, (t, len(hits))
        return hits[0]
    if variant == 'B':
        for v in p.values():
            if v['class_type'] == 'MpiFlux3References':
                v['inputs']['resolution'] = 'keep resolution'
    inj = dict(Input_wf_type=4, Input_is_Turbo=True, Input_custom_size=False, Input_Image=src,
               Input_Positive=PROMPT, Input_Seed=seed)
    for t, val in inj.items():
        nd = node(t)
        if nd['class_type'] == 'MpiLoadImage':
            nd['inputs']['string'] = val
        else:
            keys = [k for k, v in nd['inputs'].items() if not isinstance(v, list)]
            nd['inputs'][keys[0]] = val
    out_id = next(k for k, v in p.items() if v['_meta']['title'] == 'Output_Image')
    req = urllib.request.Request(URL + '/prompt', data=json.dumps({'prompt': p}).encode(),
                                 headers={'Content-Type': 'application/json'})
    pid = json.load(urllib.request.urlopen(req))['prompt_id']
    t0 = time.time()
    while True:
        time.sleep(2)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h and (h[pid]['status'].get('completed') or h[pid]['status'].get('status_str') == 'error'):
            break
    ims = h[pid]['outputs'].get(out_id, {}).get('images', [])
    assert ims, ('no output', h[pid]['status'])
    im = ims[0]
    q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
    with urllib.request.urlopen(f'{URL}/view?{q}') as r, open(out, 'wb') as f:
        shutil.copyfileobj(r, f)
    print(variant, out.rsplit('/', 1)[-1], round(time.time() - t0, 1), 's', flush=True)


src = IN + 'mpi1216_d013.png'
for i in range(1, n + 1):
    name = f'mpi1216_{variant}{i}.png'
    run(src, 424242 + i, IN + name)
    shutil.copy(IN + name, S + name)
    src = IN + name
