"""MPI-1212: replay a past Flow run through an ISOLATED app instance on a RunPod Pod and save
the graph(s) the app compiled, so flowbench.py can swap FLUX.3 into the exact same graph.

  python replay.py <port> <case>...     cases: see CASES below, or `all`

Refuses to submit unless the instance's engine is `remote`: this never touches the local GPU,
which is why it runs without gpu_lease (the lease guards the local card only).
Each case's graphs land in research/graphs/<case>_<n>.json (n = pass, a Flow may queue several).
"""
import json, os, sys, threading, time, urllib.parse, urllib.request
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PROJ = os.path.expandvars(r'%USERPROFILE%\Documents\Cubric Studio\Projects')
BENCH = os.path.join(PROJ, 'FLUX3 Flow Bench')

CASES = {  # case -> (flowId, sidecar relative to PROJ)
    'dii1': ('scribble-object', r'Big Photos Test\Media\.meta\d0e27c69-f0d3-4017-a631-2d24078283d4.json'),
    'dii2': ('scribble-object', r'Deepinfra model tests\Media\.meta\01b8cd04-33c7-49f1-8a8b-d9c7be86ef64.json'),
    'scr1': ('scribble', r'Deepinfra model tests\Media\.meta\e88aa068-2a2c-40de-8862-5a28bbaa5770.json'),
    'scr2': ('scribble', r'New Cosmo tests\Media\.meta\d47a6e83-d8b9-44c7-af07-18c9d6063e77.json'),
    'out1': ('outpaint', r'Deepinfra model tests\Media\.meta\6fb0c066-40d2-4716-b65c-182cd3441f6d.json'),
    'out2': ('outpaint', r'Deepinfra model tests\Media\.meta\aa6c2cee-df3b-4427-a412-4048b4e0abeb.json'),
    'csfi1': ('character-sheet-from-images', r'Qwen 2.1\Media\.meta\a148e5e8-4c54-4bff-926d-61f4690fa478.json'),
    'csfi2': ('character-sheet-from-images', r'Deepinfra model tests\Media\.meta\0edfe782-9edc-49c9-981d-999ea1ebe0e2.json'),
    'cse1': ('character-sheet-editor', r'Qwen 2.1\Media\.meta\5f9899a3-0de6-4657-bbae-0c53f0c93dc9.json'),   # Klein: blue tank top
    'cse2': ('character-sheet-editor', r'Qwen 2.1\Media\.meta\a63308ee-dbca-48ad-be76-156d3bc939e1.json'),   # Klein: basketball jersey
    'cseq1': ('character-sheet-editor', r'Qwen 2.1\Media\.meta\b2f92c7a-b14c-4698-a6b5-2cfabe667c52.json'),  # Qwen: Viking beard
    'cseq2': ('character-sheet-editor', r'Qwen 2.1\Media\.meta\d879a30e-c24e-43d1-a582-c9430a31fb8b.json'),  # Qwen: body tattoo
}


def _http(port, path, body=None, timeout=60):
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}',
                                 data=json.dumps(body).encode() if body is not None else None,
                                 headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=timeout))


def _path(url):
    return urllib.parse.unquote(url.split('path=')[1].split('&')[0])


def body_for(flow, sc):
    d = json.load(open(os.path.join(PROJ, sc), encoding='utf-8'))
    gs, fi = d.get('generationSettings') or {}, d.get('flowInputs') or {}
    declared = {f['id'] for f in flow['fields']}
    inj = gs.get('injectionParams') or {}
    fields = {k: v for k, v in fi.items() if k in declared}
    fields.update({k: v for k, v in inj.items() if k in declared and k not in fields})
    params = {b['param']: inj[b['param']] for b in flow.get('boxParams', []) if b['param'] in inj}
    if flow.get('frame'):
        # the run used a PADDED picture; the agent route pads it itself from a ratio
        src = next(m for m in fi['mediaItems'] if m.get('role') == 'image1')
        sv = fi['stepValues']['image1']
        crop, (w, h) = sv['crop'], Image.open(_path(src['url'])).size
        left, right = crop['x'] < 0, crop['x'] + crop['w'] > w
        up, down = crop['y'] < 0, crop['y'] + crop['h'] > h
        grow = None if (left and right) or (up and down) else \
            ('left' if left else 'right' if right else 'up' if up else 'down')
        params['frame'] = {'ratio': sv['ratio']['label'], **({'grow': grow} if grow else {})}
        media = [{'role': 'image1', 'path': _path(src['url'])}]
    else:
        media = [{'role': m['role'], 'path': _path(m['url'])} for m in gs['mediaItems']]
    media = [{'role': m['role'], 'url': '/project-file?path=' + urllib.parse.quote(m['path'], safe='')} for m in media]
    return {'fields': fields, 'params': params, 'media': media}, d.get('seed')


def _watch_queue(port, seen, stop):
    # the proxy has no /history list and the app logs no prompt id: catch each prompt
    # while it sits in the Pod's queue (a Flow pass takes 10 s+, a 1 s poll never misses one)
    while not stop.is_set():
        try:
            q = _http(port, '/proxy/queue', timeout=10)
            for item in q.get('queue_running', []) + q.get('queue_pending', []):
                seen.setdefault(item[1], None)
        except Exception:
            pass
        stop.wait(1)


SEAMLESS = {'seam1': 'tex_brick', 'seam2': 'tex_moss'}   # case -> texture card name (TEXTURES)


def _seamless_body(card):
    for m in os.listdir(os.path.join(BENCH, 'Media', '.meta')):
        if m.endswith('.json'):
            d = json.load(open(os.path.join(BENCH, 'Media', '.meta', m), encoding='utf-8'))
            if d.get('prompt') == TEXTURES[card]:   # the card name lives in project.json, not here
                url = d['filePath'].split('&v=')[0]   # already a /project-file url
                return {'fields': {'direction': 'both'}, 'params': {}, 'media': [{'role': 'image1', 'url': url}]}, None
    sys.exit(f'no card named {card}: run `replay.py <port> texture` first')


def replay(port, case, catalogue):
    flow_id, sc = CASES.get(case) or ('make-seamless', None)
    flow = next(f for f in catalogue['flows'] if f['id'] == flow_id)
    body, seed = body_for(flow, sc) if sc else _seamless_body(SEAMLESS[case])
    body.update(flowId=flow_id, folderPath=BENCH, cardName=f'{case} replay')
    if _http(port, '/connector/models')['engine'] != 'remote':
        sys.exit('engine is not remote - refusing (this would run on the local GPU)')
    seen, stop = {}, threading.Event()
    watcher = threading.Thread(target=_watch_queue, args=(port, seen, stop), daemon=True)
    watcher.start()
    t0 = time.time()
    res = _http(port, '/connector/generate', body, timeout=1800)
    secs = round(time.time() - t0, 1)
    stop.set()
    watcher.join()
    ids = list(seen)
    print(case, flow_id, 'ok' if res.get('ok') else res.get('error'), secs, 's', 'prompts', ids, flush=True)
    os.makedirs(os.path.join(HERE, 'graphs'), exist_ok=True)
    for n, pid in enumerate(ids):
        h = _http(port, f'/proxy/history/{pid}').get(pid)
        if not h:
            print('  no history for', pid)
            continue
        json.dump({'case': case, 'flowId': flow_id, 'prompt_id': pid, 'seed': seed, 'body': body,
                   'graph': h['prompt'][2], 'outputs': h['prompt'][4]},
                  open(os.path.join(HERE, 'graphs', f'{case}_{n}.json'), 'w', encoding='utf-8'), indent=1)
    if not ids:
        print('  no prompt seen in the Pod queue')
    return res.get('ok')


TEXTURES = {  # Make Seamless has no past run: Klein 9B makes the photos on the Pod
    'tex_brick': 'Photo of a weathered red brick wall, flat straight-on view filling the whole frame, uneven mortar, soft daylight',
    'tex_moss': 'Photo of a mossy forest floor seen from directly above, filling the whole frame, twigs, fallen leaves and small stones, overcast light',
}


def textures(port):
    if _http(port, '/connector/models')['engine'] != 'remote':
        sys.exit('engine is not remote - refusing (this would run on the local GPU)')
    for name, prompt in TEXTURES.items():
        res = _http(port, '/connector/generate', {'modelId': 'klein-9b', 'operation': 't2i', 'positive': prompt,
                                                'ratio': '1:1', 'folderPath': BENCH, 'cardName': name}, timeout=900)
        print(name, json.dumps(res)[:400], flush=True)


if __name__ == '__main__':
    port, cases = sys.argv[1], sys.argv[2:]
    if cases == ['texture']:
        sys.exit(textures(port))
    cat = _http(port, '/connector/models')
    for c in (list(CASES) if cases == ['all'] else cases):
        replay(port, c, cat)
