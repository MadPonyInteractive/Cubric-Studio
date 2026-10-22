"""MPI-1232 Phase 1 verify: the SHIPPED runtime graph (people + face passes, tile inputs) on the G: bench.

  python -I phase1verify.py <graph-name-without-.json> <input.png> <tag>

Sets the Input_* nodes the way the app does for a Tiles upscale (wf_type 7, x2, tile 512, denoise 0.3,
turbo on where the graph has it, a short name per tile), runs it, saves out/<tag>.png and prints the
engine's detailer lines (# of Detected SEGS) so the progress bars can be counted. Always under gpu_lease.py.
"""
import json, sys, time, urllib.parse
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tilebench import HERE, REPO, FIELD, _req, _upload, tile_rects  # noqa: E402

TILE, FACTOR, DENOISE = 512, 2.0, 0.3


def main(graph, src, tag):
    from PIL import Image
    w, h = Image.open(src).size
    overlap = max(64, round(0.2 * TILE))
    n = len(tile_rects(round(w * FACTOR), round(h * FACTOR), bbox=TILE, overlap=overlap))
    g = json.loads((REPO / 'comfy_workflows' / f'{graph}.json').read_text(encoding='utf-8'))
    sets = {'input_wf_type': 7, 'input_tile_upscale': True, 'input_upscale_factor': FACTOR, 'input_denoise': DENOISE,
            'input_seed': 12345, 'input_is_turbo': True, 'input_auto_grid': False, 'input_positive': '', 'input_negative': '',
            'input_tile_size': TILE, 'input_tile_overlap': overlap, 'input_tile_guide': 1024.0, 'input_tile_max': 1536.0,
            'input_tile_prompts': '[CONCAT][ASC]' + '[SEP]'.join(['a room interior'] * n), 'input_image': _upload(src)}
    required = {'input_wf_type', 'input_tile_upscale', 'input_tile_size', 'input_tile_overlap', 'input_tile_guide',
                'input_tile_max', 'input_tile_prompts', 'input_image', 'input_denoise'}
    seen = set()
    for node in g.values():
        t = node.get('_meta', {}).get('title', '').lower()
        if t in sets and node['class_type'] in FIELD:
            node['inputs'][FIELD[node['class_type']]] = sets[t]
            seen.add(t)
    assert required <= seen, f'missing titles: {required - seen}'
    out_id = next(k for k, v in g.items() if v.get('_meta', {}).get('title') == 'Output_Image')
    since = time.time()
    resp = json.loads(_req('/prompt', json.dumps({'prompt': g, 'client_id': 'mpi1232'}).encode()))
    if resp.get('node_errors'):  # ComfyUI drops an invalid output node and still runs the rest
        print('NODE_ERRORS', json.dumps(resp['node_errors'])[:3000])
    pid = resp['prompt_id']
    while True:
        time.sleep(3)
        hist = json.loads(_req(f'/history/{pid}')).get(pid)
        if hist and hist.get('status', {}).get('completed') is not None:
            break
    st = hist['status']
    if st.get('status_str') != 'success':
        print('FAILED', json.dumps(st.get('messages'))[:3000]); sys.exit(1)
    img = hist['outputs'][out_id]['images'][0]
    q = urllib.parse.urlencode({'filename': img['filename'], 'subfolder': img['subfolder'], 'type': img['type']})
    dest = HERE / 'out' / f'{tag}.png'
    dest.parent.mkdir(exist_ok=True)
    dest.write_bytes(_req('/view?' + q))
    msgs = {m[0]: m[1].get('timestamp') for m in st.get('messages', [])}
    secs = (msgs['execution_success'] - msgs['execution_start']) / 1000 if 'execution_start' in msgs else time.time() - since
    print(f'OK {graph} tiles={n} {Image.open(dest).size} {secs:.0f}s -> {dest.name}')
    entries = json.loads(_req('/internal/logs/raw'))['entries']
    for e in entries:
        m = e['m']
        if datetime.fromisoformat(e['t']).timestamp() < since:
            continue
        if any(k in m for k in ('Detected SEGS', 'Detailer', 'detailer', 'segment')):
            print('  log', e['t'][11:19], m.strip()[:160])


if __name__ == '__main__':
    main(*sys.argv[1:4])
