import copy, json, os, sys, time, urllib.parse, urllib.request
# run_api.py <outdir> <spec.json>   spec: [{"tag", "api": <api.json path>, "set": {"<node title>": {"<input>": value}}}]
# Posts each converted bench graph to :8188 with its title-addressed overrides (the app's injection shape), waits,
# and saves Output_Image as <outdir>/<tag>.png. Run under gpu_lease.py.
URL = 'http://127.0.0.1:8188'
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for r in json.load(open(sys.argv[2], encoding='utf-8')):
    g = copy.deepcopy(json.load(open(r['api'], encoding='utf-8')))
    T = {v['_meta']['title']: k for k, v in g.items()}
    for title, ins in r['set'].items():
        g[T[title]]['inputs'].update(ins)
    body = json.dumps({'prompt': g, 'client_id': 'mpi1042'}).encode()
    res = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))
    if res.get('node_errors'):
        print(r['tag'], 'NODE ERRORS', json.dumps(res['node_errors'])[:1500], flush=True)
    pid, t0 = res['prompt_id'], time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    st = h[pid].get('status', {})
    ims = h[pid]['outputs'].get(T['Output_Image'], {}).get('images', [])
    for im in ims:
        q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
        urllib.request.urlretrieve(f'{URL}/view?{q}', f'{out}/{r["tag"]}.png')
    print(r['tag'], st.get('status_str'), '%.0fs' % (time.time() - t0), 'saved' if ims else json.dumps(st)[-1500:], flush=True)
