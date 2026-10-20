# Fabio's edit_017 (enhanced, no <tigger> citation): tiger landed off-box, friendly. Does citing the
# box id fix placement? E = his exact enhanced prompt; F = the same text with <tigger> after the
# tiger's first mention. Same table, his two seeds + one. python citegen.py <outDir>
import json, sys, time, copy, urllib.request, urllib.parse, shutil
sys.stdout.reconfigure(encoding='utf-8')
S = sys.argv[1] + '/'
URL = 'http://127.0.0.1:8188'
BASE = json.load(open('C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json', encoding='utf-8'))
SRC = 'G:/ComfyUi/ComfyUI/input/mpi1181_edit_001.png'
TABLE = ' [{"id":"tigger","bbox":[8,736,793,1000],"desc":"A Bengal tiger"}]'
E = ("Create a composite image by placing a Bengal tiger on the right side of the frame at middle height, sneaking from behind the gorilla and appearing to prepare for an attack. "
     "The tiger should be realistically rendered with a vibrant orange and black striped coat, muscular build, and alert posture, with its head turned towards the gorilla. "
     "The gorilla should retain its original pose and appearance as shown in the first image, seated centrally on the dirt and rock-strewn forest floor, maintaining its dark fur, muscular build, and intense gaze. "
     "The background forest with its numerous tree trunks and lush vegetation should remain unchanged, faithfully reproducing the environment from the original image.")
F = E.replace('placing a Bengal tiger on', 'placing a Bengal tiger <tigger> on', 1)
assert F != E
W = dict(Input_wf_type=4, Input_is_Turbo=True, Input_Image=SRC, Input_custom_size=True, Input_Width=1280, Input_Height=800)
CASES = {f'{k}_{s}': (dict(W, Input_Positive=p + TABLE), s)
         for k, p in (('E', E), ('F', F)) for s in (1830283133, 2643884733, 111)}
# `--slow`: E with Turbo off (does Turbo cost the attack?)
if '--slow' in sys.argv:
    CASES = {f'Eslow_{s}': (dict(W, Input_is_Turbo=False, Input_Positive=E + TABLE), s) for s in (1830283133, 2643884733, 111)}
# `--canvas`: E exactly as the app sent it (`withCanvasPrompt`, read from :48188 /history) - on an 8:5 source at 8:5
CANVAS = ('TARGET CANVAS: 8:5\n' + E + '\nExtend the scene outward on every side so it fills the whole picture edge to edge. '
          'No black bars, no borders, no padding.')
# `--words`: is the enhancer the problem? R = Fabio's typed prompt + keep line; H = the pounce spelled out
R = 'the <tigger> is sneaking from behind the gorilla and getting ready to attack The gorilla. Keep everything else in the picture exactly the same.'
H = ("Add a Bengal tiger <tigger> on the right, half hidden behind the gorilla's back and shoulder, crouched low with its body coiled, "
     "ears flattened and teeth bared, about to leap onto the gorilla. The gorilla has not seen it. Keep everything else in the picture exactly the same.")
if '--words' in sys.argv:
    CASES = {f'{k}_{s}': (dict(W, Input_Positive=p + TABLE), s) for k, p in (('R', R), ('H', H)) for s in (1830283133, 2643884733, 111)}
if '--canvas' in sys.argv:
    CASES = {f'Ecanvas_{s}': (dict(W, Input_Positive=CANVAS + TABLE), s) for s in (1830283133, 2643884733, 111)}


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
        with urllib.request.urlopen(f'{URL}/view?{q}') as src, open(S + f'cite_{name}.png', 'wb') as f:
            shutil.copyfileobj(src, f)
    return st.get('status_str') == 'success'


ok = all([run(c) for c in CASES])
sys.exit(0 if ok else 1)
