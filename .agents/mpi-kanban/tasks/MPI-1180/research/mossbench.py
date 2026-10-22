"""MPI-1180 bench: MOSS-Image through the research raw (moss_image_t2i_template.json), on Fabio's G:\\ComfyUi.

  python mossbench.py convert            raw -> research/graphs/moss_t2i_api.json (needs the engine up, no GPU)
  python mossbench.py run <variant>... [--seeds 1,2] [--prompts text,long,photo]
      GPU: ONLY under `gpu_lease.py run --poll 2 -- python -I mossbench.py run ...`.
      Writes research/bench/<variant>_<prompt>_<seed>.png and appends research/bench/results.jsonl.

Variants change the API graph IN MEMORY only; the raw is Fabio's and is never written here.
"""
import copy, json, os, re, subprocess, sys, threading, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..'))
RAW = os.path.join(HERE, 'moss_image_t2i_template.json')
API = os.path.join(HERE, 'graphs', 'moss_t2i_api.json')
OUT = os.path.join(HERE, 'bench')
COMFY = os.environ.get('COMFY_URL', 'http://127.0.0.1:8188')

PROMPTS = {
    'text': ('A vintage enamel shop sign on a brick wall reads exactly "MOSS BAKERY" in large cream capitals, '
             'with a smaller line beneath it reading "Fresh bread daily since 1987". Morning light, shallow depth '
             'of field, photographed with a 50mm lens.'),
    'long': ('Editorial magazine cover photograph. A woman in her sixties with short silver hair and round '
             'tortoiseshell glasses sits at a cluttered wooden workbench in a ceramics studio, hands dusted with '
             'pale clay, holding a half-finished blue glazed bowl up to a tall north-facing window. Shelves behind '
             'her hold dozens of bowls in graded blues, from pale sky to deep cobalt. A tabby cat sleeps in a '
             'cardboard box on the floor. The masthead at the top reads exactly "MAKERS" in heavy black serif '
             'capitals. A cover line at the lower left reads exactly "The quiet art of glaze". A small yellow '
             'circle in the top right corner reads exactly "ISSUE 42". Soft diffuse daylight, fine film grain, '
             'warm muted palette, sharp focus on the bowl and her hands.'),
    'photo': ('A red fox standing in fresh snow at the edge of a pine forest at dusk, breath visible in the cold '
              'air, warm last light on its fur, telephoto wildlife photograph.'),
}
# node id -> (input name, value). Ids are the raw's (converter keeps them).
BASE_INJECT = {'304': ('int', 1), '324': ('int', 1024), '325': ('int', 1024), '704': ('boolean', False)}
VARIANTS = {
    # turbo = toxicdog SFT-Turbo merge, 8 steps CFG 1 er_sde (raw as saved)
    'turbo': {'690': ('boolean', True)},
    'turbo_euler': {'690': ('boolean', True), '738': ('sampler_name', 'euler')},
    # sft = official SFT, 25 steps CFG 2.5 er_sde (raw as saved)
    'sft': {'690': ('boolean', False)},
    'sft_neg': {'690': ('boolean', False), '696': ('string', 'nsfw, worst quality, bad anatomy, watermark, jpeg artifact')},
}


def http(path, data=None):
    req = urllib.request.Request(COMFY + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def convert():
    os.makedirs(os.path.dirname(API), exist_ok=True)
    out = subprocess.run(['node', os.path.join(REPO, 'scripts', 'workflow-to-api.mjs'), RAW],
                         capture_output=True, text=True, encoding='utf-8', check=True).stdout
    g = json.loads(out)
    # Same prune the shipped graph gets (generate_flux3.build): without it the raw's rgthree Image
    # Comparer (an output node) pulls the USDU upscale branch into every t2i run (~22 s).
    sys.path.insert(0, os.path.join(REPO, 'comfy_workflows', 'scripts', 'workflow_generation'))
    from generate_klein import _prune_to_captures
    _prune_to_captures(g)
    assert not any('Comparer' in v['class_type'] for v in g.values()), 'an Image Comparer survived the prune'
    open(API, 'w', encoding='utf-8').write(json.dumps(g, indent=1, ensure_ascii=False))
    for nid in sorted({*BASE_INJECT, *[k for v in VARIANTS.values() for k in v], '93', '33', '696'}, key=int):
        print(nid, g.get(nid, {}).get('class_type'), g.get(nid, {}).get('inputs') if nid in g else 'MISSING')
    print('nodes:', len(g), '->', API)


def sampler(stop, peaks):
    """Poll /system_stats: peak torch VRAM used and system RAM used (whole box, not ComfyUI alone)."""
    while not stop.is_set():
        try:
            s = json.loads(http('/system_stats'))
            d = s['devices'][0]
            peaks['vram_gb'] = max(peaks.get('vram_gb', 0), (d['vram_total'] - d['vram_free']) / 2**30)
            sysd = s['system']
            peaks['ram_gb'] = max(peaks.get('ram_gb', 0), (sysd['ram_total'] - sysd['ram_free']) / 2**30)
        except Exception:
            pass
        stop.wait(0.5)


def sampler_bars():
    """Sampler progress bars of the last prompt in ComfyUI's log, e.g. ['8/8 00:07 0.88s/it']."""
    log = json.loads(http('/internal/logs'))
    log = log if isinstance(log, str) else json.dumps(log)
    tail = log[log.rfind('got prompt'):]
    bars = re.findall(r'(\d+)/\1 \[(\d\d:\d\d)<00:00,\s*([\d.]+(?:s/it|it/s))\]', tail)
    return sorted({f'{n}/{n} {t} {r}' for n, t, r in bars})


def wait_idle():
    """Do not time someone else's job: wait for an empty queue before submitting."""
    while True:
        q = json.loads(http('/queue'))
        if not q['queue_running'] and not q['queue_pending']:
            return
        time.sleep(1)


def run_one(g, tag):
    wait_idle()
    pid = json.loads(http('/prompt', {'prompt': g, 'client_id': 'mpi1180-bench'}))['prompt_id']
    peaks, stop = {}, threading.Event()
    t = threading.Thread(target=sampler, args=(stop, peaks), daemon=True)
    t0 = time.time()
    t.start()
    while True:
        h = json.loads(http('/history/' + pid))
        if pid in h and h[pid].get('status', {}).get('completed') is not None or (pid in h and h[pid].get('outputs')):
            break
        if pid in h and h[pid].get('status', {}).get('status_str') == 'error':
            break
        time.sleep(0.5)
    secs = time.time() - t0
    stop.set()
    t.join()
    entry = h[pid]
    status = entry.get('status', {}).get('status_str')
    saved = []
    for node_id, node_out in entry.get('outputs', {}).items():
        for i, im in enumerate(node_out.get('images', [])):
            q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
            dst = os.path.join(OUT, f'{tag}_n{node_id}_{i}.png')
            open(dst, 'wb').write(http('/view?' + q))
            saved.append(os.path.basename(dst))
    errs = [m for m in entry.get('status', {}).get('messages', []) if m[0] == 'execution_error']
    return {'status': status, 'secs': round(secs, 1), 'peak_vram_gb': round(peaks.get('vram_gb', 0), 2),
            'peak_ram_gb': round(peaks.get('ram_gb', 0), 2), 'sampler': sampler_bars(), 'images': saved,
            'error': errs[0][1].get('exception_message') if errs else None}


def run(variants, seeds, prompts):
    os.makedirs(OUT, exist_ok=True)
    base = json.load(open(API, encoding='utf-8'))
    for v in variants:
        for pk in prompts:
            for seed in seeds:
                g = copy.deepcopy(base)
                for nid, (k, val) in {**BASE_INJECT, **VARIANTS[v], '93': ('string', PROMPTS[pk]),
                                      '33': ('int', seed)}.items():
                    g[nid]['inputs'][k] = val
                tag = f'{v}_{pk}_{seed}'
                r = {'variant': v, 'prompt': pk, 'seed': seed, 'at': time.strftime('%Y-%m-%dT%H:%M:%S'), **run_one(g, tag)}
                print(json.dumps(r), flush=True)
                with open(os.path.join(OUT, 'results.jsonl'), 'a', encoding='utf-8') as f:
                    f.write(json.dumps(r) + '\n')


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'convert':
        convert()
    elif a[0] == 'run':
        opt = lambda name, dflt: a[a.index(name) + 1].split(',') if name in a else dflt
        names = [x for x in a[1:] if x in VARIANTS]
        run(names, [int(s) for s in opt('--seeds', ['1'])], opt('--prompts', list(PROMPTS)))
