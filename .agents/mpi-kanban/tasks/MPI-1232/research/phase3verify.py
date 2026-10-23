"""MPI-1232 Phase 3 verify: tile names keyed by LABEL on the SHIPPED runtime graph (G: bench).

  python -I phase3verify.py <graph> <input.png> <tag> car|names

car   = proof of the label route: every tile prompt-less except the LAST tile (cut order, after the tiles the
        person mask empties), named "a bright red sports car", at denoise 0.55. A car in that tile's rect and
        nowhere else = names land on their own tile. An [ASC] list would have moved it.
names = the real feature: the app's outlines (services/tileOutlines.js) + the describer graph with SCENERY_Q
        per tile, cleaned like tileDescribe.js, at the Tiles default denoise 0.3.
Always under gpu_lease.py. Writes out/<tag>.png and out/<tag>.json (rects, names, wildcard).
"""
import json, re, subprocess, sys, time, urllib.parse
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from tilebench import HERE, REPO, FIELD, _req, _upload  # noqa: E402
from stage2 import describe, SCENERY_Q  # noqa: E402

TILE, FACTOR = 512, 2.0


def clean(t):
    t = re.sub(r'\s+', ' ', re.sub(r'[\[\]]', ' ', (t or '').split('\n')[0])).strip()
    return t.strip('"\'“”‘’. ')


def main(graph, src, tag, mode):
    o = json.loads(subprocess.run(['node', str(HERE / 'outlines.mjs'), src, str(TILE), str(FACTOR)],
                                  capture_output=True, text=True, check=True).stdout)
    n = len(o['rects'])
    if mode == 'car':
        names, denoise = [''] * n, 0.55
        names[-1] = 'a bright red sports car'
    else:
        names, denoise = [], 0.3
        for i, img in enumerate(o['images']):
            names.append(clean(describe(img, SCENERY_Q)))
            print(i, o['rects'][i], '|', names[-1], flush=True)
    prompts = ''.join(f'[t{i}]{nm}' for i, nm in enumerate(names) if nm)
    wildcard = f'[CONCAT][LAB]{prompts}' if prompts else ''
    labels = ','.join(f't{i}' for i in range(n))
    (HERE / 'out').mkdir(exist_ok=True)
    (HERE / 'out' / f'{tag}.json').write_text(json.dumps({'rects': o['rects'], 'names': names, 'wildcard': wildcard,
                                                          'denoise': denoise}, indent=1, ensure_ascii=False), encoding='utf-8')

    g = json.loads((REPO / 'comfy_workflows' / f'{graph}.json').read_text(encoding='utf-8'))
    overlap = max(64, round(0.2 * TILE))
    sets = {'input_wf_type': 7, 'input_tile_upscale': True, 'input_upscale_factor': FACTOR, 'input_denoise': denoise,
            'input_seed': 12345, 'input_is_turbo': True, 'input_positive': '', 'input_negative': '',
            'input_tile_size': TILE, 'input_tile_overlap': overlap, 'input_tile_guide': 1024.0, 'input_tile_max': 1536.0,
            'input_tile_prompts': wildcard, 'input_tile_labels': labels, 'input_image': _upload(src)}
    seen = set()
    for node in g.values():
        t = node.get('_meta', {}).get('title', '').lower()
        if t in sets and node['class_type'] in FIELD:
            node['inputs'][FIELD[node['class_type']]] = sets[t]
            seen.add(t)
    need = {'input_tile_prompts', 'input_tile_labels', 'input_tile_size', 'input_image', 'input_denoise'}
    assert need <= seen, f'missing titles: {need - seen}'
    out_id = next(k for k, v in g.items() if v.get('_meta', {}).get('title') == 'Output_Image')
    since = time.time()
    resp = json.loads(_req('/prompt', json.dumps({'prompt': g, 'client_id': 'mpi1232'}).encode()))
    if resp.get('node_errors'):
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
    dest.write_bytes(_req('/view?' + q))
    print(f'OK {graph} tiles={n} last={o["rects"][-1]} {time.time() - since:.0f}s -> {dest.name}')
    for e in json.loads(_req('/internal/logs/raw'))['entries']:
        if datetime.fromisoformat(e['t']).timestamp() >= since and any(
                k in e['m'] for k in ('Detected SEGS', 'Detailer', 'segment', 'SEGSLabelAssign')):
            print('  log', e['t'][11:19], e['m'].strip()[:160])


if __name__ == '__main__':
    main(*sys.argv[1:5])
