import json, sys, time, copy, os, urllib.request, urllib.parse, uuid
# sweep.py <api.json> <outdir> <spec.json>
# spec: [{"tag": "B_front_s1", "image": "mpi1042_front_4x5.png", "seed": 1, "layout": "...optional...", "ref": "...optional..."}]
# Posts each run to the bench (:8188) in turn, waits, saves Output_Image as <outdir>/<tag>.png.
URL = 'http://127.0.0.1:8188'
api = json.load(open(sys.argv[1], encoding='utf-8'))
out = sys.argv[2]
os.makedirs(out, exist_ok=True)
spec = json.load(open(sys.argv[3], encoding='utf-8'))
by_title = {v.get('_meta', {}).get('title'): k for k, v in api.items()}


def run(r):
    g = copy.deepcopy(api)
    g[by_title['Input_Image']]['inputs']['image'] = r['image']
    g[by_title['Input_Image_2']]['inputs']['image'] = 'None'
    g[by_title['Input_Seed']]['inputs']['int'] = r['seed']
    if 'layout' in r:
        g[by_title['Sheet_Layout']]['inputs']['value'] = r['layout']
    if 'ref' in r:
        g[by_title['Prompt_No_Body']]['inputs']['value'] = r['ref']
    if 'w' in r:
        g[by_title['W_sheet']]['inputs']['int'] = r['w']
        g[by_title['H_sheet']]['inputs']['int'] = r['h']
    if 'user' in r:
        g[by_title['Input_Positive']]['inputs']['value'] = r['user']
    body = json.dumps({'prompt': g, 'client_id': str(uuid.uuid4())}).encode()
    pid = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))['prompt_id']
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            rec = h[pid]
            break
        if time.time() - t0 > 900:
            raise SystemExit(f'{r["tag"]}: timeout')
    st = rec.get('status', {}).get('status_str')
    o = rec['outputs'].get(by_title['Output_Image'], {})
    for im in o.get('images', []):
        q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
        urllib.request.urlretrieve(f'{URL}/view?{q}', f'{out}/{r["tag"]}.png')
    print(r['tag'], st, '%.0fs' % (time.time() - t0), 'saved' if o else 'NO OUTPUT', flush=True)


for r in spec:
    run(r)
