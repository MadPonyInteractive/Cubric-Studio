# Replays the app's EXACT edit_017 graph (Fabio's engine :48188 /history) on the G: bench :8188,
# image path swapped to the bench's copy, and diffs the graph against the bench's own flux3_t2i.json.
# python replay.py <apphist.json> <outDir>
import json, sys, time, urllib.request, urllib.parse, shutil, hashlib
sys.stdout.reconfigure(encoding='utf-8')
URL = 'http://127.0.0.1:8188'
hist = json.load(open(sys.argv[1], encoding='utf-8'))
OUT = sys.argv[2] + '/'
title = lambda g, t: next(n for n in g.values() if n.get('_meta', {}).get('title') == t)
g = next(v['prompt'][2] for v in hist.values() if title(v['prompt'][2], 'Input_Seed')['inputs']['int'] == 1830283133)

staged = title(g, 'Input_Image')['inputs']['string']
for p in (staged, 'G:/ComfyUi/ComfyUI/input/mpi1181_edit_001.png', 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Flux 3 tests/Media/edit_001.png'):
    print(hashlib.sha256(open(p, 'rb').read()).hexdigest()[:16], p)

# graph diff: node-by-node literal inputs vs the repo workflow
base = json.load(open('C:/AI/Mpi/Cubric-Vision/comfy_workflows/flux3_t2i.json', encoding='utf-8'))
print('nodes app', len(g), 'repo', len(base))
for k in sorted(set(g) | set(base), key=lambda x: int(x) if x.isdigit() else 0):
    a, b = g.get(k), base.get(k)
    if not a or not b:
        print('ONLY', 'app' if a else 'repo', k, (a or b)['class_type'], (a or b).get('_meta', {}).get('title'))
        continue
    if a['class_type'] != b['class_type']:
        print('CLASS', k, a['class_type'], b['class_type'])
    for i in set(a['inputs']) | set(b['inputs']):
        va, vb = a['inputs'].get(i), b['inputs'].get(i)
        if va != vb and not (a.get('_meta', {}).get('title', '').startswith('Input_')):
            print('DIFF', k, a.get('_meta', {}).get('title'), i, str(va)[:80], '|', str(vb)[:80])

title(g, 'Input_Image')['inputs']['string'] = 'G:/ComfyUi/ComfyUI/input/mpi1181_edit_001.png'
out_id = next(k for k, v in g.items() if v.get('_meta', {}).get('title') == 'Output_Image')
req = urllib.request.Request(URL + '/prompt', data=json.dumps({'prompt': g}).encode(), headers={'Content-Type': 'application/json'})
r = json.load(urllib.request.urlopen(req))
pid = r['prompt_id']
while True:
    time.sleep(3)
    h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
    if pid in h and (h[pid]['status'].get('completed') or h[pid]['status'].get('status_str') == 'error'):
        break
print('run', h[pid]['status'].get('status_str'))
for im in h[pid]['outputs'].get(out_id, {}).get('images', []):
    q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
    with urllib.request.urlopen(f'{URL}/view?{q}') as src, open(OUT + 'replay_edit017.png', 'wb') as f:
        shutil.copyfileobj(src, f)
