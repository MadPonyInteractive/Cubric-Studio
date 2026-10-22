"""MPI-1232 tile bench: the SHIPPED Use Tiles graph, run on the G:\\ComfyUi bench (:8188).

  python -I tilebench.py tiles <input.png> <name>          crop the 2x tiles (ASC order) to caption by hand
  python -I tilebench.py run <krea2|flux3> <A|B|C> <0|1> <input.png> <captions.json|-> <tag>

A = prompt-less tiles (today), B = [ASC] per-tile wildcard (replaces the conditioning),
C = [CONCAT][ASC] (keeps the graph's positive, appends the tile text).
faces 1 = face SEGS subtracted from the grid (filter_out_segs_opt) + one face pass after.
Always run under gpu_lease.py. Nothing here touches the app or :3000.
"""
import json, math, sys, time, uuid, urllib.request, urllib.parse
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[4]
BENCH = 'http://127.0.0.1:8188'
GRAPHS = {'krea2': 'krea2_t2i_sfw.json', 'flux3': 'flux3_t2i.json'}
SEED, DENOISE, FACTOR = 12345, 0.2, 2.0


def tile_rects(iw, ih, bbox=1024, overlap=200, irregularity=0.7):
    """MakeTileSEGS.doit's bboxes ('Reuse fast'), sorted the way [ASC] sorts them: (x1, y1)."""
    if bbox <= 2 * overlap:
        overlap = bbox / 2
    comp = max(6, int(128 * irregularity / 4))
    overlap += comp
    bbox += comp * 2
    bbox = min(bbox, iw, ih)
    def n_along(length):
        n = math.ceil(length / (bbox - overlap))
        s = bbox * n - length
        if s < 0:
            n += 1; s = bbox * n - length
        step = 0 if n == 1 else int(s / (n - 1))
        return (1, 0) if step == bbox else (n, step)
    nh, wo = n_along(iw)
    nv, ho = n_along(ih)
    rects, y = [], 0
    for _ in range(nv):
        x = 0
        for _ in range(nh):
            x1, x2 = (x, x + bbox) if x + bbox < iw - 1 else (iw - bbox, iw)
            y1, y2 = (y, y + bbox) if y + bbox < ih - 1 else (ih - bbox, ih)
            rects.append((x1, y1, x2, y2))
            x += bbox - wo
        y += bbox - ho
    return sorted(rects, key=lambda r: (r[0], r[1]))


def cmd_tiles(src, name):
    from PIL import Image
    im = Image.open(src).convert('RGB')
    big = im.resize((round(im.width * FACTOR), round(im.height * FACTOR)), Image.LANCZOS)
    out = HERE / 'tiles'; out.mkdir(exist_ok=True)
    rects = tile_rects(big.width, big.height)
    for i, r in enumerate(rects):
        big.crop(r).save(out / f'{name}_{i:02d}.jpg', quality=88)
    (out / f'{name}_rects.json').write_text(json.dumps(rects))
    print(len(rects), 'tiles', rects)


def _req(path, data=None, ctype='application/json'):
    req = urllib.request.Request(BENCH + path, data=data, headers={'Content-Type': ctype} if data else {})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def _upload(src):
    b = uuid.uuid4().hex
    name = 'mpi1232_' + Path(src).name
    body = (f'--{b}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\n'
            f'Content-Type: image/png\r\n\r\n').encode() + Path(src).read_bytes() + \
           f'\r\n--{b}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{b}--\r\n'.encode()
    return json.loads(_req('/upload/image', body, f'multipart/form-data; boundary={b}'))['name']


FIELD = {'MpiInt': 'int', 'MpiFloat': 'float', 'MpiText': 'string', 'MpiSimpleBoolean': 'boolean', 'MpiLoadImage': 'image'}


def build(model, variant, faces, image_name, captions):
    g = json.loads((REPO / 'comfy_workflows' / GRAPHS[model]).read_text(encoding='utf-8'))
    sets = {'Input_wf_type': 7, 'Input_Tile_Upscale': True, 'Input_Upscale_Factor': FACTOR, 'Input_denoise': DENOISE,
            'Input_Seed': SEED, 'Input_is_Turbo': False, 'Input_Auto_Grid': False, 'Input_Positive': '',
            'Input_Negative': '', 'Input_Image': image_name}
    for n in g.values():
        t = n.get('_meta', {}).get('title', '')
        if t in sets:
            n['inputs'][FIELD[n['class_type']]] = sets.pop(t)
    assert not sets, f'titles not found: {sets}'

    tile_id = next(k for k, n in g.items() if n['class_type'] == 'ImpactMakeTileSEGS')
    det_id = next(k for k, n in g.items() if n['class_type'] == 'DetailerForEachPipe' and n['inputs']['segs'][0] == tile_id)
    det = g[det_id]['inputs']
    if variant != 'A':
        det['wildcard'] = ('[CONCAT]' if variant == 'C' else '') + '[ASC]' + '[SEP]'.join(captions)
    if faces:
        g['9001'] = {'class_type': 'UltralyticsDetectorProvider', 'inputs': {'model_name': 'bbox/face_yolov8n.pt'}}
        g['9002'] = {'class_type': 'BboxDetectorSEGS', 'inputs': {'bbox_detector': ['9001', 0], 'image': g[tile_id]['inputs']['images'],
                     'threshold': 0.5, 'dilation': 10, 'crop_factor': 3.0, 'drop_size': 10, 'labels': 'all'}}
        g[tile_id]['inputs']['filter_out_segs_opt'] = ['9002', 0]
        for n in g.values():  # everything that read the tile result now reads the face pass
            for k, v in n['inputs'].items():
                if v == [det_id, 0]:
                    n['inputs'][k] = ['9003', 0]
        g['9003'] = {'class_type': 'DetailerForEachPipe', 'inputs': {**det, 'image': [det_id, 0], 'segs': ['9002', 0], 'wildcard': ''}}
    return g, det_id


def cmd_run(model, variant, faces, src, caps_path, tag):
    captions = [] if caps_path == '-' else json.loads(Path(caps_path).read_text(encoding='utf-8'))
    g, det_id = build(model, variant, int(faces), _upload(src), captions)
    out_id = next(k for k, n in g.items() if n.get('_meta', {}).get('title') == 'Output_Image')
    pid = json.loads(_req('/prompt', json.dumps({'prompt': g, 'client_id': 'mpi1232'}).encode()))['prompt_id']
    t0 = time.time()
    while True:
        time.sleep(3)
        h = json.loads(_req(f'/history/{pid}')).get(pid)
        if h and h.get('status', {}).get('completed') is not None:
            break
    st = h['status']
    if st.get('status_str') != 'success':
        print('FAILED', json.dumps(st.get('messages'))[:3000]); sys.exit(1)
    img = h['outputs'][out_id]['images'][0]
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
    out = HERE / 'out'; out.mkdir(exist_ok=True)
    dest = out / f'{tag}.png'
    dest.write_bytes(_req('/view?' + q))
    msgs = {m[0]: m[1].get('timestamp') for m in st.get('messages', [])}
    secs = (msgs['execution_success'] - msgs['execution_start']) / 1000 if 'execution_start' in msgs else time.time() - t0
    line = {'tag': tag, 'model': model, 'variant': variant, 'faces': int(faces), 'seconds': round(secs, 1),
            'wildcard': g[det_id]['inputs']['wildcard'][:200]}
    with open(HERE / 'runs.jsonl', 'a', encoding='utf-8', newline='\n') as f:
        f.write(json.dumps(line) + '\n')
    print('OK', dest, line['seconds'], 's')


if __name__ == '__main__':
    {'tiles': cmd_tiles, 'run': cmd_run}[sys.argv[1]](*sys.argv[2:])
