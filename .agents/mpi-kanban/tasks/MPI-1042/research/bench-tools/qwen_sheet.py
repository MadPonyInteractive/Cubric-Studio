import json, os, sys, time, urllib.parse, urllib.request
# qwen_sheet.py <outdir> <spec.json>   spec: [{"tag", "image", "seed", "prompt", "w", "h", "resolution"?}]
# The character sheet on Qwen-Image 2.1, built from MPI-936's bench graph (research/bench/graph.py there, NOT
# edited): picture 1 as the only reference, but the canvas is the EMPTY latent at w x h (MPI-936's edit canvas
# follows reference 1's size, which is the face picture, not the sheet). MpiClearVram before the output: Fabio's
# card must not sit hot after a run.
sys.path.insert(0, 'C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-936/research/bench')
import graph as qg  # noqa: E402

URL = 'http://127.0.0.1:8188'
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for r in json.load(open(sys.argv[2], encoding='utf-8')):
    g = qg.graph(r['prompt'], width=r['w'], height=r['h'], seed=r['seed'], refs=(r['image'],),
                 resolution=r.get('resolution', 1024))  # reference ~N x N px; 1408 ~ Klein's 2 MP picture 1
    g['32']['inputs']['on_true'] = ['31', 0]  # sheet-sized empty canvas, not reference 1's
    assert g['32']['_meta']['title'] == 'Edit Canvas' and g['31']['class_type'] == 'EmptyLatentImage', 'graph.py moved'
    # id 900: MPI-936 keeps adding nodes, and a reused id silently rewires its graph into a cycle
    g['900'] = {'class_type': 'MpiClearVram', 'inputs': {'passthrough': g['35']['inputs']['images']},
                '_meta': {'title': 'free VRAM'}}
    g['35']['inputs']['images'] = ['900', 0]
    body = json.dumps({'prompt': g, 'client_id': 'mpi1042'}).encode()
    pid = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))['prompt_id']
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    st = h[pid].get('status', {}).get('status_str')
    ims = h[pid]['outputs'].get('35', {}).get('images', [])
    for im in ims:
        q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
        urllib.request.urlretrieve(f'{URL}/view?{q}', f'{out}/{r["tag"]}.png')
    print(r['tag'], st, '%.0fs' % (time.time() - t0), 'saved' if ims else json.dumps(h[pid].get('status', {}))[-1500:], flush=True)
