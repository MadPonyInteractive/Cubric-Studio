# Bench: do appended box tables steer local FLUX.3 Klein? Same seed, boxes swapped -> subject must move.
import json, sys, time, copy, urllib.request, urllib.parse, shutil
sys.stdout.reconfigure(encoding='utf-8')
S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/3becf6ce-33fa-47b5-af7c-5362e33e5076/scratchpad/'
URL = 'http://127.0.0.1:8188'
BASE = json.load(open('C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json', encoding='utf-8'))
IMG1 = 'G:/ComfyUi/ComfyUI/input/49cf8c25b4fa85adadb44600e456fd41.jpg'
T2I = 'Full-color outdoor photograph of a sunny meadow <obj_1> with a red fox <obj_2> and a blue bicycle <obj_3>.'
def tbl(rows): return ' ' + json.dumps(rows)
FOX_L = [{"id": "obj_1", "bbox": [0, 0, 1000, 1000], "desc": "sunny green meadow with wildflowers"},
         {"id": "obj_2", "bbox": [550, 50, 950, 350], "desc": "red fox sitting, facing the camera"},
         {"id": "obj_3", "bbox": [150, 600, 600, 950], "desc": "blue city bicycle leaning on its stand"}]
FOX_R = [{"id": "obj_1", "bbox": [0, 0, 1000, 1000], "desc": "sunny green meadow with wildflowers"},
         {"id": "obj_2", "bbox": [150, 650, 550, 950], "desc": "red fox sitting, facing the camera"},
         {"id": "obj_3", "bbox": [500, 50, 950, 400], "desc": "blue city bicycle leaning on its stand"}]
EDIT = 'Add a black cat <obj_1> sitting in the scene. Keep everything else identical to the source.'
CAT_TL = [150, 50, 450, 300]; CAT_BR = [650, 650, 980, 980]
def simple(b): return tbl([{"id": "obj_1", "bbox": b, "desc": "black short-haired cat sitting"}])
def i2i(b): return tbl([{"id": "obj_1", "from": "target", "src_bbox": None, "tgt_bbox": b, "desc": "black short-haired cat sitting"}])
W = dict(Input_wf_type=1, Input_is_Turbo=True, Input_Width=1344, Input_Height=768)
E = dict(Input_wf_type=4, Input_is_Turbo=True, Input_Image=IMG1)
CASES = {
    't2i_enhanced': dict(W, Input_Positive=open(S + 'enhanced_box_prompt.txt', encoding='utf-8').read()),
    't2i_none': dict(W, Input_Positive=T2I),
    't2i_foxL': dict(W, Input_Positive=T2I + tbl(FOX_L)),
    't2i_foxR': dict(W, Input_Positive=T2I + tbl(FOX_R)),
    'edit_simple_TL': dict(E, Input_Positive=EDIT + simple(CAT_TL)),
    'edit_simple_BR': dict(E, Input_Positive=EDIT + simple(CAT_BR)),
    'edit_i2i_TL': dict(E, Input_Positive=EDIT + i2i(CAT_TL)),
    'edit_i2i_BR': dict(E, Input_Positive=EDIT + i2i(CAT_BR)),
    'edit_uncited_TL': dict(E, Input_Positive='Add a black short-haired cat sitting in the scene. Keep everything else identical to the source.' + simple(CAT_TL)),
    'edit_uncited_BR': dict(E, Input_Positive='Add a black short-haired cat sitting in the scene. Keep everything else identical to the source.' + simple(CAT_BR)),
}


def run(name):
    p = copy.deepcopy(BASE)

    def node(t):
        hits = [v for v in p.values() if v['_meta']['title'] == t]
        assert len(hits) == 1, (t, len(hits))
        return hits[0]
    for t, val in {**CASES[name], 'Input_Seed': 424242}.items():
        n = node(t)
        if n['class_type'] == 'MpiLoadImage':
            n['inputs']['string'] = val
        else:
            keys = [k for k, v in n['inputs'].items() if not isinstance(v, list)]
            assert len(keys) == 1, (t, n['inputs'])
            n['inputs'][keys[0]] = val
    out_id = next(k for k, v in p.items() if v['_meta']['title'] == 'Output_Image')
    req = urllib.request.Request(URL + '/prompt', data=json.dumps({'prompt': p}).encode(), headers={'Content-Type': 'application/json'})
    try:
        pid = json.load(urllib.request.urlopen(req))['prompt_id']
    except urllib.error.HTTPError as e:
        print(name, 'SUBMIT FAILED', e.read().decode()[:2000])
        return False
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
        with urllib.request.urlopen(f'{URL}/view?{q}') as src, open(S + f'box_{name}.png', 'wb') as f:
            shutil.copyfileobj(src, f)
    return st.get('status_str') == 'success'


ok = all([run(c) for c in (sys.argv[1:] or CASES)])
sys.exit(0 if ok else 1)
