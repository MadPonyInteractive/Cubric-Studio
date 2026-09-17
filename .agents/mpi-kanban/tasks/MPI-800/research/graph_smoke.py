"""MPI-800: run a rebaked runtime graph straight on the local engine.

The app cannot dispatch these (no model op, no Flow), so this is the only live proof that
their Upload loaders load what the app would stage. It mirrors what comfyController does:
stage the file via the app's own route, then write the staged path into the Input_* node's
`string`. It lands NO gallery card by design — this is a graph check, not a generation.

    python graph_smoke.py <runtime.json> <Input_Title>=<absolute source file> ...
"""
import json, sys, time, urllib.request, uuid

APP = 'http://127.0.0.1:3000'
ENGINE = 'http://127.0.0.1:48188'


def post(url, body):
    req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'),
                                 headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=120).read().decode('utf-8'))


graph_path = sys.argv[1]
graph = json.loads(open(graph_path, encoding='utf-8').read())
titles = {v.get('_meta', {}).get('title'): k for k, v in graph.items()}

for arg in sys.argv[2:]:
    title, src = arg.split('=', 1)
    staged = post(f'{APP}/comfy/stage-media', {'path': src})
    assert staged.get('success'), staged
    nid = titles[title]
    graph[nid]['inputs']['string'] = staged['path']
    print(f'  {title} -> #{nid} {graph[nid]["class_type"]} {staged["path"]}')

client = str(uuid.uuid4())
res = post(f'{ENGINE}/prompt', {'prompt': graph, 'client_id': client})
pid = res['prompt_id']
t0 = time.time()
while time.time() - t0 < 900:
    hist = json.loads(urllib.request.urlopen(f'{ENGINE}/history/{pid}', timeout=30).read().decode('utf-8'))
    if pid in hist:
        rec = hist[pid]
        status = rec['status']['status_str']
        outs = {k: list(v) for k, v in rec.get('outputs', {}).items()}
        print(f'{graph_path}: {status} in {int(time.time() - t0)}s, outputs from nodes {sorted(outs)}')
        for m in rec['status'].get('messages', []):
            if m[0] in ('execution_error', 'execution_interrupted'):
                print('   ', json.dumps(m[1])[:400])
        sys.exit(0 if status == 'success' else 1)
    time.sleep(2)
print('TIMEOUT')
sys.exit(1)
