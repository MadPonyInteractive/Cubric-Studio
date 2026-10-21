# One FLUX.3 run on the G:\ComfyUi bench. Usage:
#   python bench.py GRAPH OUT.png Title=value ...   (values: int/float/true/false/text)
# Image titles (MpiLoadImage) take a path. OUT lands in the scratchpad AND bench input/.
import json, sys, time, urllib.request, urllib.parse, shutil
sys.stdout.reconfigure(encoding='utf-8')
S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5642ec09-25f5-4275-be88-99593a1ec0c8/scratchpad/'
URL = 'http://127.0.0.1:8188'
IN = 'G:/ComfyUi/ComfyUI/input/'
p = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]


def conv(v):
    if v in ('true', 'false'):
        return v == 'true'
    for f in (int, float):
        try:
            return f(v)
        except ValueError:
            pass
    return v


for kv in sys.argv[3:]:
    t, v = kv.split('=', 1)
    hits = [n for n in p.values() if n['_meta']['title'] == t]
    assert len(hits) == 1, (t, len(hits))
    nd = hits[0]
    if nd['class_type'] == 'MpiLoadImage':
        nd['inputs']['string'] = v
    else:
        keys = [k for k, x in nd['inputs'].items() if not isinstance(x, list)]
        nd['inputs'][keys[0]] = conv(v)
out_id = next(k for k, v in p.items() if v['_meta']['title'] == 'Output_Image')
req = urllib.request.Request(URL + '/prompt', data=json.dumps({'prompt': p}).encode(),
                             headers={'Content-Type': 'application/json'})
try:
    pid = json.load(urllib.request.urlopen(req))['prompt_id']
except urllib.error.HTTPError as e:
    print('REJECTED', e.read().decode()[:2000])
    sys.exit(1)
t0 = time.time()
while True:
    time.sleep(2)
    h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
    if pid in h and (h[pid]['status'].get('completed') or h[pid]['status'].get('status_str') == 'error'):
        break
    if time.time() - t0 > 1500:
        print('TIMEOUT')
        sys.exit(2)
ims = h[pid]['outputs'].get(out_id, {}).get('images', [])
if not ims:
    msgs = [m for m in h[pid]['status'].get('messages', []) if m[0] == 'execution_error']
    print('NO OUTPUT', json.dumps(msgs)[:1500])
    sys.exit(1)
im = ims[0]
q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
with urllib.request.urlopen(f'{URL}/view?{q}') as r, open(S + out, 'wb') as f:
    shutil.copyfileobj(r, f)
shutil.copy(S + out, IN + out)
from PIL import Image
print(out, Image.open(S + out).size, round(time.time() - t0, 1), 's', flush=True)
