"""MPI-1212 bench: a Flow's own graph with FLUX.3 Klein swapped into its edit stage.

The swap happens IN MEMORY on a graph; nothing in comfy_workflows/ is touched (no app code
until 2.1.2). Klein 9B and FLUX.3 attach references the same way (core ReferenceLatent and
ReferenceMultiLatent both set `reference_latents`), so the Klein graphs keep their reference
nodes and only the loaders, the schedule and (base) the negative change.

  python flowbench.py dry                       swap every Klein Flow template, check it, no GPU
  python flowbench.py capture <port> <flow> [prompt_id]   save a run's compiled graph from /history
  python flowbench.py run <port> <flow> <seed>... [--variants base,turbo,flux3base]
      replays research/graphs/<flow>.json as-is ("base" = today's model) and swapped; GPU,
      so ONLY under `gpu_lease.py run --poll 2` and only after Fabio says the GPU is free.
"""
import copy, json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
WF = os.path.join(HERE, '..', '..', '..', '..', '..', 'comfy_workflows')
KLEIN_FLOWS = {  # flowId -> template (dry run only; real runs use the captured graph)
    'scribble-object': 'flow_draw_it_in.json', 'scribble': 'flow_scribble.json',
    'outpaint': 'flow_outpaint.json', 'make-seamless': 'flow_make_seamless.json',
    'object-stamp': 'flow_object_stamp.json', 'character-sheet-editor': 'flow_character_sheet_edit.json',
}
FLUX3 = {
    'unet': {'flux3turbo': 'flux3-image-klein-int8-convrot.safetensors',
             'flux3base': 'flux3-image-klein-base-int8-convrot.safetensors'},
    'clip': 'qwen3vl_4b_abliterated_fp8_scaled.safetensors',
    'steps': {'flux3turbo': 16, 'flux3base': 50},   # flux3_t2i.json nodes 646 / 734
    'cfg': {'flux3turbo': 1.0, 'flux3base': 3.5},    # nodes 647 / 753
}
KLEIN_UNETS = ('flux-2-klein-9b', 'flux-2-klein-4b')


def _new_id(g):
    return str(max(int(k) for k in g if k.isdigit()) + 1)


def swap(graph, variant):
    """Return a copy of `graph` running FLUX.3 (`flux3turbo` | `flux3base`) wherever Klein ran."""
    g = copy.deepcopy(graph)
    klein = [k for k, v in g.items() if v['class_type'] == 'UNETLoader'
             and str(v['inputs'].get('unet_name', '')).startswith(KLEIN_UNETS)]
    assert klein, 'no Klein UNETLoader in this graph'
    for k in klein:
        g[k]['inputs']['unet_name'] = FLUX3['unet'][variant]
    clips = [k for k, v in g.items() if v['class_type'] == 'CLIPLoader' and v['inputs'].get('type') == 'flux2']
    assert clips, 'no flux2 CLIPLoader'
    for k in clips:
        g[k]['inputs'].update(clip_name=FLUX3['clip'], type='flux3')
    steps, cfg = FLUX3['steps'][variant], FLUX3['cfg'][variant]
    touched = 0
    for k, v in list(g.items()):
        ct, inp = v['class_type'], v['inputs']
        if ct == 'CFGGuider':
            inp['cfg'] = cfg
            if variant == 'flux3base':
                inp['negative'] = _negative_with_refs(g, inp['positive'], clips[0])
            touched += 1
        elif ct == 'Flux2Scheduler':
            # Flux2Scheduler is Klein's sigma curve; FLUX.3's own graph samples euler/simple.
            guider = next(x for x in g.values() if x['class_type'] == 'SamplerCustomAdvanced'
                          and x['inputs']['sigmas'][0] == k)['inputs']['guider'][0]
            g[k] = {'class_type': 'BasicScheduler', '_meta': {'title': v['_meta']['title']},
                    'inputs': {'model': g[guider]['inputs']['model'], 'scheduler': 'simple',
                               'steps': steps, 'denoise': 1.0}}
        elif ct == 'KSamplerSelect':
            inp['sampler_name'] = 'euler'
        elif ct in ('KSampler', 'LanPaint_KSampler') and _runs_on(g, inp.get('model'), klein):
            inp.update(steps=steps, cfg=cfg, sampler_name='euler', scheduler='simple')
            if variant == 'flux3base':
                inp['negative'] = _negative_with_refs(g, inp['positive'], clips[0])
            touched += 1
    assert touched, 'no sampler driven by the swapped model'
    return g


def _runs_on(g, link, loaders, depth=0):
    """True when a MODEL link leads back to one of `loaders` (through LoRA / patch nodes)."""
    if not isinstance(link, list) or depth > 40:
        return False
    if link[0] in loaders:
        return True
    return any(_runs_on(g, v, loaders, depth + 1) for kk, v in g[link[0]]['inputs'].items()
               if kk == 'model' and isinstance(v, list))


def _negative_with_refs(g, positive, clip):
    """Base runs at cfg 3.5 with a real (empty-prompt) negative that carries the same references
    as the positive (FLUX.3's own graph and ReferenceMultiLatent do this). Clone the positive's
    conditioning path, swapping each prompt encode for an empty one."""
    memo = {}

    def clone(link):
        if link[0] in memo:
            return memo[link[0]]
        n = g[link[0]]
        ct = n['class_type']
        if ct == 'CLIPTextEncode':
            new = {'class_type': 'CLIPTextEncode', '_meta': {'title': 'MPI-1212 negative'},
                   'inputs': {'clip': [clip, 0], 'text': ''}}
        elif ct in ('ReferenceLatent', 'FluxGuidance'):
            new = copy.deepcopy(n)
            new['inputs']['conditioning'] = clone(n['inputs']['conditioning'])
        elif ct == 'MpiIfElse':
            new = copy.deepcopy(n)
            new['inputs'].update(true=clone(n['inputs']['true']), false=clone(n['inputs']['false']))
        else:
            raise AssertionError(f'negative clone: unhandled {ct} at {link[0]}')
        nid = _new_id(g)
        g[nid] = new
        memo[link[0]] = [nid, 0]
        return memo[link[0]]
    return clone(positive)


def check(g):
    """Every link points at a node that exists, and no Klein weight is left."""
    for k, v in g.items():
        for name, val in v['inputs'].items():
            if isinstance(val, list) and len(val) == 2 and isinstance(val[0], str):
                assert val[0] in g, f'{k}.{name} -> missing node {val[0]}'
            assert not (isinstance(val, str) and val.startswith(KLEIN_UNETS)), f'{k}.{name} still {val}'


def _api(port, path, body=None):
    req = urllib.request.Request(f'http://127.0.0.1:{port}{path}',
                                 data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=60))


def capture(port, flow, pid=None):
    h = _api(port, '/history')
    pid = pid or list(h)[-1]
    item = h[pid]
    os.makedirs(os.path.join(HERE, 'graphs'), exist_ok=True)
    out = os.path.join(HERE, 'graphs', f'{flow}.json')
    json.dump({'prompt_id': pid, 'graph': item['prompt'][2], 'outputs': item['prompt'][4]},
              open(out, 'w', encoding='utf-8'), indent=1)
    print('saved', out, len(item['prompt'][2]), 'nodes')


def _seed(g, seed):
    for v in g.values():
        for name in ('seed', 'noise_seed'):
            if name in v['inputs'] and not isinstance(v['inputs'][name], list):
                v['inputs'][name] = seed


def run(port, flow, seeds, variants):
    cap = json.load(open(os.path.join(HERE, 'graphs', f'{flow}.json'), encoding='utf-8'))
    outdir = os.path.join(HERE, 'out', flow)
    os.makedirs(outdir, exist_ok=True)
    ok = True
    for seed in seeds:
        for var in variants:
            g = copy.deepcopy(cap['graph']) if var == 'base' else swap(cap['graph'], var)
            _seed(g, seed)
            check(g)
            pid = _api(port, '/prompt', {'prompt': g})['prompt_id']
            t0 = time.time()
            while True:
                time.sleep(3)
                h = _api(port, f'/history/{pid}')
                st = h.get(pid, {}).get('status', {})
                if st.get('completed') or st.get('status_str') == 'error':
                    break
            secs = round(time.time() - t0, 1)
            print(flow, var, seed, st.get('status_str'), secs, 's', flush=True)
            ok &= st.get('status_str') == 'success'
            for node_out in h[pid]['outputs'].values():
                for i, im in enumerate(node_out.get('images', [])):
                    q = urllib.parse.urlencode({k: im[k] for k in ('filename', 'subfolder', 'type')})
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/view?{q}') as src:
                        open(os.path.join(outdir, f'{var}_{seed}_{i}.png'), 'wb').write(src.read())
    return ok


def dry():
    for flow, f in KLEIN_FLOWS.items():
        g = json.load(open(os.path.join(WF, f), encoding='utf-8'))
        for var in ('flux3turbo', 'flux3base'):
            s = swap(g, var)
            check(s)
        added = len(swap(g, 'flux3base')) - len(g)
        print(f'{flow:24} ok  ({len(g)} nodes, base adds {added} negative nodes)')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'dry':
        dry()
    elif cmd == 'capture':
        capture(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else None)
    elif cmd == 'run':
        args = sys.argv[4:]
        variants = ['base', 'flux3turbo', 'flux3base']
        if '--variants' in args:
            i = args.index('--variants')
            variants = args[i + 1].split(',')
            args = args[:i] + args[i + 2:]
        sys.exit(0 if run(sys.argv[2], sys.argv[3], [int(s) for s in args], variants) else 1)
