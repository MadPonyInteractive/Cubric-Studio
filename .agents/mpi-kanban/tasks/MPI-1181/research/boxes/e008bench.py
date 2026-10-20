# Fabio's edit_008 (edit_001, custom size 1280x800, a "tigger" box on the RIGHT edge, typed prompt):
# the tiger landed LEFT of the gorilla. Replays it: his prompt vs his prompt + a keep line.
import json, sys, time, copy, urllib.request, urllib.parse, shutil
sys.stdout.reconfigure(encoding='utf-8')
S = sys.argv[1] + '/'
URL = 'http://127.0.0.1:8188'
BASE = json.load(open('C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json', encoding='utf-8'))
SRC = 'G:/ComfyUi/ComfyUI/input/mpi1181_edit_001.png'
TABLE = ' [{"id":"tigger","bbox":[8,736,793,1000],"desc":"A Bengal tiger"}]'
HIS = 'the <tigger> is sneaking from behind the gorilla and getting ready to attack.'
KEEP = HIS + ' Keep everything else in the picture exactly the same.'
E = dict(Input_wf_type=4, Input_is_Turbo=True, Input_Image=SRC, Input_custom_size=True, Input_Width=1280, Input_Height=800)
CASES = {f'{k}_{s}': (dict(E, Input_Positive=p + TABLE), s)
         for k, p in (('his', HIS), ('keep', KEEP)) for s in (3824626108, 111, 222)}
ONLY = sys.argv[2:]  # case names to run; all when none


def run(name):
    params, seed = CASES[name]
    p = copy.deepcopy(BASE)

    def node(t):
        hits = [v for v in p.values() if v['_meta']['title'] == t]
        assert len(hits) == 1, (t, len(hits))
        return hits[0]
    for t, val in {**params, 'Input_Seed': seed}.items():
        n = node(t)
        if n['class_type'] == 'MpiLoadImage':
            n['inputs']['string'] = val
        else:
            keys = [k for k, v in n['inputs'].items() if not isinstance(v, list)]
            assert len(keys) == 1, (t, n['inputs'])
            n['inputs'][keys[0]] = val
    out_id = next(k for k, v in p.items() if v['_meta']['title'] == 'Output_Image')
    req = urllib.request.Request(URL + '/prompt', data=json.dumps({'prompt': p}).encode(), headers={'Content-Type': 'application/json'})
    pid = json.load(urllib.request.urlopen(req))['prompt_id']
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h and (h[pid]['status'].get('completed') or h[pid]['status'].get('status_str') == 'error'):
            break
    st = h[pid]['status']
    print(name, st.get('status_str'), round(time.time() - t0, 1), 's', flush=True)
    for im in h[pid]['outputs'].get(out_id, {}).get('images', []):
        q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
        with urllib.request.urlopen(f'{URL}/view?{q}') as src, open(S + f'e008_{name}.png', 'wb') as f:
            shutil.copyfileobj(src, f)
    return st.get('status_str') == 'success'


ok = all([run(c) for c in CASES if not ONLY or c in ONLY])
sys.exit(0 if ok else 1)
