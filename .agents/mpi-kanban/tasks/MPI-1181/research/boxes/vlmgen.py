# Renders Fabio's edit_024 scene (edit_007 tiger + mouse/raptor/lady boxes) three ways, same seeds:
# A = the app's edit_024 prompt + its simple table; G3 / G4 = BFL external-VLM i2i_bbox output from
# gemma-3-12b / gemma-4-26B-A4B run 3 (vlmbench.json), verbatim. Turbo, source size (1280x800).
# python vlmgen.py <outDir> [--clip <text encoder file>]
import json, sys, time, copy, urllib.request, urllib.parse, shutil
sys.stdout.reconfigure(encoding='utf-8')
S = sys.argv[1] + '/'
URL = 'http://127.0.0.1:8188'
BASE = json.load(open('C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json', encoding='utf-8'))
CLIP = sys.argv[sys.argv.index('--clip') + 1] if '--clip' in sys.argv else None
TAG = '_te' if CLIP else ''
SRC = 'G:/ComfyUi/ComfyUI/input/mpi1181_edit_007.png'
vlm = json.load(open(S + 'vlmbench.json', encoding='utf-8'))['results']
pick = lambda model, run: next(r['text'] for r in vlm if r['model'] == model and r['run'] == run)
A = ("Create a composite image by placing a mouse eating a nut in the center of the frame near the bottom. Above and to the left of the tiger, introduce the head and paws of a Velociraptor emerging from off-frame, positioned near the top of the frame. On the right side of the frame, at a middle height, place a topless lady kneeling with her hands on her head, wearing only bikini bottoms. The tiger should retain its posture, fur markings, and facial features as seen in the first image, approaching the mouse along the dirt path. The Velociraptor should appear menacing and ready to attack the tiger. The lady's terrified expression and pose should be emphasized. Preserve the forest setting, lighting, and depth of field from the original tiger image, ensuring the composition integrates seamlessly, maintaining a natural and cohesive scene."
     ' [{"id":"mouse","bbox":[636,326,875,484],"desc":"A mouse eating a nut"},{"id":"Velociraptor","bbox":[3,0,583,201],"desc":"The head and paws of a Velociraptor coming from off-frame"},{"id":"lady","bbox":[0,635,742,877],"desc":"Topless lady scared"}]')
PROMPTS = {'A': A, 'G3': pick('google/gemma-3-12b-it', 3), 'G4': pick('google/gemma-4-26B-A4B-it', 3)}
W = dict(Input_wf_type=4, Input_is_Turbo=True, Input_Image=SRC, Input_custom_size=False)
CASES = {f'{k}_{s}': (dict(W, Input_Positive=p), s) for k, p in PROMPTS.items() for s in (3443590830, 1386278817, 111)
         if not CLIP or k != 'G3'}


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
    if CLIP:
        node('Load CLIP')['inputs']['clip_name'] = CLIP
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
    if st.get('status_str') == 'error':
        print(json.dumps(st)[:600])
    for im in h[pid]['outputs'].get(out_id, {}).get('images', []):
        q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
        with urllib.request.urlopen(f'{URL}/view?{q}') as src, open(S + f'vlm{TAG}_{name}.png', 'wb') as f:
            shutil.copyfileobj(src, f)
    return st.get('status_str') == 'success'


ok = all([run(c) for c in CASES])
sys.exit(0 if ok else 1)
