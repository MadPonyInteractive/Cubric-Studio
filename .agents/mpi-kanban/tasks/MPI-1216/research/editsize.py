# MPI-1216 bench proof: the SHIPPED runtime graph, edit op, Custom size off, app injections only.
# Asserts output size == expected. Usage: python editsize.py
import json, sys, time, copy, urllib.request, urllib.parse, shutil
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')
S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/e33bb813-b7a8-4312-aad9-ec662c68e122/scratchpad/'
URL = 'http://127.0.0.1:8188'
IN = 'G:/ComfyUi/ComfyUI/input/mpi1216_'  # MpiLoadImage reads only inside ComfyUI's folders
BASE = json.load(open('C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json', encoding='utf-8'))
PROMPT = 'In <ref_image_0>, add a small white mouse sitting on the ground in the foreground. Keep everything else exactly as it is.'
CASES = [  # input, expected output
    ('in_768x1376.png', (768, 1376)),
    ('in_752x1360.png', (752, 1360)),
    ('in_3350x6000.png', None),  # capped: checked against the 4K area below
]
CAP = 2944 * 2944


def run(img, expect):
    p = copy.deepcopy(BASE)
    def node(t):
        hits = [v for v in p.values() if v['_meta']['title'] == t]
        assert len(hits) == 1, (t, len(hits))
        return hits[0]
    inj = dict(Input_wf_type=4, Input_is_Turbo=True, Input_custom_size=False, Input_Image=IN + img,
               Input_Positive=PROMPT, Input_Seed=424242)
    for t, val in inj.items():
        n = node(t)
        if n['class_type'] == 'MpiLoadImage':
            n['inputs']['string'] = val
        else:
            keys = [k for k, v in n['inputs'].items() if not isinstance(v, list)]
            assert len(keys) == 1, (t, n['inputs'])
            n['inputs'][keys[0]] = val
    out_id = next(k for k, v in p.items() if v['_meta']['title'] == 'Output_Image')
    req = urllib.request.Request(URL + '/prompt', data=json.dumps({'prompt': p}).encode(),
                                 headers={'Content-Type': 'application/json'})
    try:
        pid = json.load(urllib.request.urlopen(req))['prompt_id']
    except urllib.error.HTTPError as e:
        print(img, 'SUBMIT FAILED', e.read().decode()[:3000]); return False
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h and (h[pid]['status'].get('completed') or h[pid]['status'].get('status_str') == 'error'):
            break
    st = h[pid]['status']
    print(img, st.get('status_str'), 'wall', round(time.time() - t0, 1), 's', flush=True)
    for m in st.get('messages', []):
        if m[0] == 'execution_error':
            print('  ', json.dumps(m[1])[:1500])
    ims = h[pid]['outputs'].get(out_id, {}).get('images', [])
    if not ims:
        return False
    im = ims[0]
    q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
    dst = S + 'out_' + img
    with urllib.request.urlopen(f'{URL}/view?{q}') as src, open(dst, 'wb') as f:
        shutil.copyfileobj(src, f)
    size = Image.open(dst).size
    if expect:
        ok = size == expect
    else:
        w, h = size
        ok = CAP * 0.97 < w * h <= CAP * 1.01 and abs(w / h - 3350 / 6000) < 0.01 and w % 16 == 0 and h % 16 == 0
    print('   out', size, 'expect', expect or f'~{CAP} px, 3350:6000, /16', 'PASS' if ok else 'FAIL', flush=True)
    return ok


ok = all([run(i, e) for i, e in CASES if not sys.argv[1:] or i in sys.argv[1:]])
print('ALL PASS' if ok else 'SOME FAILED')
sys.exit(0 if ok else 1)
