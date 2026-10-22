"""MPI-1212 bench: a Flow's own graph with FLUX.3 Klein swapped into its edit stage.

The swap happens IN MEMORY on a graph; nothing in comfy_workflows/ is touched (no app code
until 2.1.2). Klein 9B and FLUX.3 attach references the same way (core ReferenceLatent and
ReferenceMultiLatent both set `reference_latents`), so the Klein graphs keep their reference
nodes and only the loaders, the schedule and (base) the negative change.

  python flowbench.py dry                       swap every Klein Flow template, check it, no GPU
  python flowbench.py capture <port> <flow> <prompt_id>   save a run's compiled graph (app instance /proxy/*)
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


QWEN_UNETS = ('qwen_image_2.1',)


def swap_qwen(graph, variant):
    """Return a copy of `graph` with its Qwen-Image 2.1 stage on FLUX.3, wired the way the app's own
    flux3_t2i.json is: MpiFlux3References (prompt + refs -> positive/negative), EmptyFlux2LatentImage,
    flux2 VAE, euler/simple. A Klein stage in the same graph (editor's helper passes) stays Klein.
    The Flow's prompt goes in as written (it says "image 1"); re-wording it is wiring work."""
    g = copy.deepcopy(graph)
    qwen = [k for k, v in g.items() if v['class_type'] == 'UNETLoader'
            and str(v['inputs'].get('unet_name', '')).startswith(QWEN_UNETS)]
    assert qwen, 'no Qwen-Image UNETLoader in this graph'
    for k in qwen:
        g[k]['inputs']['unet_name'] = FLUX3['unet'][variant]
    for k, v in list(g.items()):   # the cache patch is Qwen-only: link its consumers past it
        if v['class_type'] == 'QwenImage21Cache':
            for n in g.values():
                for name, val in n['inputs'].items():
                    if val == [k, 0]:
                        n['inputs'][name] = v['inputs']['model']
            del g[k]
    steps, cfg = FLUX3['steps'][variant], FLUX3['cfg'][variant]
    # Each Qwen encode becomes MpiFlux3References UNDER THE SAME ID: both nodes answer
    # (positive, negative, latent at picture 1's size), so every link - MpiIfElse picks included -
    # stays valid. Qwen's `resolution` 0 = own size = 'keep resolution'; N = refs scaled to N x N.
    negs = {}
    for k, v in list(g.items()):
        if v['class_type'] != 'TextEncodeQwenImage21':
            continue
        inp = v['inputs']
        clip, vae = inp['clip'], inp['vae']
        g[clip[0]]['inputs'].update(clip_name=FLUX3['clip'], type='flux3')
        g[vae[0]]['inputs']['vae_name'] = 'flux2-vae.safetensors'
        if clip[0] not in negs:
            neg = _new_id(g)
            g[neg] = {'class_type': 'CLIPTextEncode', '_meta': {'title': 'MPI-1212 negative'},
                      'inputs': {'clip': clip, 'text': ''}}
            if variant == 'flux3turbo':   # cfg 1 ignores it; zeroed as flux3_t2i.json does
                z = _new_id(g)
                g[z] = {'class_type': 'ConditioningZeroOut', 'inputs': {'conditioning': [neg, 0]}}
                neg = z
            negs[clip[0]] = neg
        res = inp.get('resolution') or 0
        refs = {f'ref_image_{i}': inp[f'images.image_{i + 1}'] for i in range(10)
                if isinstance(inp.get(f'images.image_{i + 1}'), list)}
        g[k] = {'class_type': 'MpiFlux3References', '_meta': {'title': 'MPI-1212 FLUX.3 for ' + v['_meta']['title']},
                'inputs': {'resolution': 'resize' if res else 'keep resolution',
                           'megapixels': round((res / 1024) ** 2, 2) if res else 1, 'clip': clip, 'vae': vae,
                           'prompt': inp['prompt'], 'negative': [negs[clip[0]], 0], **refs}}
    assert negs, 'no Qwen encode in this graph'
    touched = 0
    for k, v in list(g.items()):
        if v['class_type'] != 'KSampler' or not _runs_on(g, v['inputs'].get('model'), qwen):
            continue
        lat = g[v['inputs']['latent_image'][0]]
        if lat['class_type'] == 'EmptyLatentImage':
            lat['class_type'] = 'EmptyFlux2LatentImage'
        v['inputs'].update(steps=steps, cfg=cfg, sampler_name='euler', scheduler='simple')
        touched += 1
    assert touched, 'no sampler driven by the Qwen model'
    for k, v in list(g.items()):   # the flux2 VAE decodes RGB: drop the 2.1 RGBA split after it
        src = v['inputs'].get('image')
        dec = g[src[0]] if isinstance(src, list) else {}
        if v['class_type'] == 'SplitImageWithAlpha' and dec.get('class_type') == 'VAEDecode' \
                and g[dec['inputs']['vae'][0]]['inputs'].get('vae_name') == 'flux2-vae.safetensors':
            for n in g.values():
                for name, val in n['inputs'].items():
                    if val == [k, 0]:
                        n['inputs'][name] = src
            del g[k]
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


def check(g, banned=KLEIN_UNETS):
    """Every link points at a node that exists, and no swapped-out weight is left."""
    for k, v in g.items():
        for name, val in v['inputs'].items():
            if isinstance(val, list) and len(val) == 2 and isinstance(val[0], str):
                assert val[0] in g, f'{k}.{name} -> missing node {val[0]}'
            assert not (isinstance(val, str) and val.startswith(banned)), f'{k}.{name} still {val}'


LOCAL_ENGINE = 48188   # port 48188 = the local ComfyUI itself (native /prompt /history /view), not an app
POD_INPUT = '/workspace/comfyui/input/'
MEDIA = os.path.expandvars(r'%USERPROFILE%\Documents\Cubric Studio\Projects')
LOCAL_INPUTS = {  # Pod input name -> the project file the app staged it from (the replayed sidecars' mediaItems)
    'flowCSE_059.png': r'Qwen 2.1\Media\flowCSE_059.png', 'imported_022.jpg': r'Qwen 2.1\Media\imported_022.jpg',
    'imported_009.jpg': r'Qwen 2.1\Media\imported_009.jpg', 'imported_012.jpg': r'Qwen 2.1\Media\imported_012.jpg',
    'flowCSFI_011.png': r'Qwen 2.1\Media\flowCSFI_011.png', 'edit_002.png': r'Deepinfra model tests\Media\edit_002.png',
}
# locally captured graphs load `<engine input>\mpi_staged\<sha256(path|size|mtimeMs)[:16]>.<ext>`, and the app
# EMPTIES mpi_staged on every engine start: staged name -> its project file, re-uploaded when gone
LOCAL_STAGED = {'cdf2ab569063e2c6.png': r'Qwen 2.1\Media\flowCSE_062.png',
                'cef360fceb0c0627.png': r'Qwen 2.1\Media\flowCSE_044.png',
                'f61e9ed5d8cc96fa.png': r'FLUX3 Flow Bench\Media\flowCSE_012.png'}   # cseq8_3: the Klein leg's aged sheet


def _url(port, path):
    if int(port) != LOCAL_ENGINE:
        return f'http://127.0.0.1:{port}/proxy{path}'
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('local engine without a GPU lease - run under `gpu_lease.py run --poll 2 --`')
    return f'http://127.0.0.1:{port}{path}'


def _upload(port, path):
    # MpiLoadImage refuses an absolute path outside ComfyUI's input/output/temp and then BLOCKS the graph,
    # which still reports success with no images: put the file into input/ and hand it the bare name
    boundary, name = 'mpi1212bench', os.path.basename(path)
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n'
            f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\n'
            'Content-Type: application/octet-stream\r\n\r\n').encode() + open(path, 'rb').read() + f'\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(_url(port, '/upload/image'), data=body,
                                 headers={'Content-Type': f'multipart/form-data; boundary={boundary}'})
    return json.load(urllib.request.urlopen(req, timeout=60))['name']


def _localize(port, g):
    # captured graphs load Pod paths; locally upload the same project files into the engine's input/
    for v in g.values():
        for k, s in v['inputs'].items():
            if isinstance(s, str) and s.startswith(POD_INPUT):
                name = s[len(POD_INPUT):]
                assert name in LOCAL_INPUTS, f'no local copy for Pod input {name}: add it to LOCAL_INPUTS'
                v['inputs'][k] = _upload(port, os.path.join(MEDIA, LOCAL_INPUTS[name]))
            elif isinstance(s, str) and '\\mpi_staged\\' in s and not os.path.exists(s):
                name = os.path.basename(s)
                assert name in LOCAL_STAGED, f'staged input {name} is gone: add its project file to LOCAL_STAGED'
                v['inputs'][k] = _upload(port, os.path.join(MEDIA, LOCAL_STAGED[name]))


def _api(port, path, body=None):
    if int(port) == LOCAL_ENGINE and body and 'prompt' in body:
        _localize(port, body['prompt'])
    req = urllib.request.Request(_url(port, path),
                                 data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    return json.load(urllib.request.urlopen(req, timeout=60))


def capture(port, flow, pid=None):
    # the app proxy has no /history list: pid from /proxy/queue or the instance app.log
    h = _api(port, f'/history/{pid}')
    item = h[pid]
    os.makedirs(os.path.join(HERE, 'graphs'), exist_ok=True)
    out = os.path.join(HERE, 'graphs', f'{flow}.json')
    json.dump({'prompt_id': pid, 'graph': item['prompt'][2], 'outputs': item['prompt'][4]},
              open(out, 'w', encoding='utf-8'), indent=1)
    print('saved', out, len(item['prompt'][2]), 'nodes')


def _seed(g, seed):
    for v in g.values():
        if v.get('_meta', {}).get('title') == 'Input_Seed':   # app graphs: MpiInt feeds every sampler
            v['inputs']['int'] = seed
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
            qwen = any(str(v['inputs'].get('unet_name', '')).startswith(QWEN_UNETS) for v in cap['graph'].values())
            g = copy.deepcopy(cap['graph']) if var == 'base' else (swap_qwen if qwen else swap)(cap['graph'], var)
            _seed(g, seed)
            if var != 'base':
                check(g, QWEN_UNETS if qwen else KLEIN_UNETS)
            pid = _api(port, '/prompt', {'prompt': g})['prompt_id']
            t0 = time.time()
            while True:
                time.sleep(3)
                h = _api(port, f'/history/{pid}')
                st = h.get(pid, {}).get('status', {})
                if st.get('completed') or st.get('status_str') == 'error':
                    break
            secs = round(time.time() - t0, 1)
            made = sum(len(o.get('images', [])) for o in h[pid]['outputs'].values())   # blocked loader = success, 0 images
            print(flow, var, seed, st.get('status_str'), made, 'images', secs, 's', flush=True)
            ok &= st.get('status_str') == 'success' and made > 0
            for nid, node_out in h[pid]['outputs'].items():
                for i, im in enumerate(node_out.get('images', [])):
                    q = urllib.parse.urlencode({k: im[k] for k in ('filename', 'subfolder', 'type')})
                    with urllib.request.urlopen(_url(port, f'/view?{q}')) as src:
                        open(os.path.join(outdir, f'{var}_{seed}_{nid}_{i}.png'), 'wb').write(src.read())
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
        capture(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == 'run':
        args = sys.argv[4:]
        variants = ['base', 'flux3turbo', 'flux3base']
        if '--variants' in args:
            i = args.index('--variants')
            variants = args[i + 1].split(',')
            args = args[:i] + args[i + 2:]
        sys.exit(0 if run(sys.argv[2], sys.argv[3], [int(s) for s in args], variants) else 1)
