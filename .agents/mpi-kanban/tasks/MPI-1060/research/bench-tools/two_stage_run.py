"""MPI-1060 Phase 1, two-stage proof: the SHIPPED comfy_workflows/ltx_i2v_t2v_int8.json with the reference-sheet path
spliced in at API level, exactly as the plan's insertion design (plan.md, Current State) describes, so the raw-template
edit (Phase 4) copies a design that already ran.

Insertion (new ids 900+, fill-driven like every other LTX branch: everything keys off Input_Image `loaded`):
  902 Input_Image (MpiLoadImage)  -> 903 ImageResizeKJv2 pad black to Input_Width x Input_Height -> 904 RepeatImageBatch
                                     (amount <- 76 Duration frames)
  model: 900 LTXICLoRALoaderModelOnly(191) ; 901 MpiIfElse(loaded ? 900 : 191) replaces 191 for 258/277/293/330
  stage 1: 905 LTXAddVideoICLoRAGuide(212 cond, 143 latent) ; packers 906/907 -> 908 IfElse -> 909 Unpacker
           replaces 212 in 524 (so 294/527/528, every stage-1 guider and crop 46 see the IC frames) and 143 in
           146/315/321/602 (crop 46 / 334 remove the IC frames before the upsampler)
  stage 2 (variant 'A' only): 910 guide(586 cond, 123 latent, tiled encode) ; 911/912 -> 913 -> 914 replaces 586 in
           32/323/600 and 123 in 168/317/323/600 ; 915 LTXVCropGuides(914 cond, 38) -> 349.false
  variant 'B': no stage-2 guide (IC model + cropped cond only, the official inpaint pattern)
  variant 'shipped': the file untouched (the regression baseline)

usage (repo root, bench :8188 up, ONLY under the lease):
  python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Python314/python.exe" -I <this file> <case> [...]
"""
import copy, json, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ingredients_run import WOMAN_CAFE  # noqa: E402  (same sheet + prompt as the single-stage own_woman run)

URL = 'http://127.0.0.1:8188'
OUT = 'C:/AI/MPI-1060-out'
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../../..'))
SHIPPED = os.path.join(REPO, 'comfy_workflows', 'ltx_i2v_t2v_int8.json')
LORA = 'ltx-2.3\\ltx-2.3-22b-ic-lora-ingredients-0.9.safetensors'
SHEET = 'mpi1042art_cafe2_sheet.png'
START = 'mpi1042art_cafe2.png'
T2V = ('a naturalistic medium shot of an old fisherman mending a net on a wooden pier at sunrise, gulls overhead, '
       'gentle waves, the camera slowly pushes in. the audio is waves, gulls and the rustle of the net, no music.')


def N(t, title, **inputs):
    return {'class_type': t, 'inputs': inputs, '_meta': {'title': title}}


def repoint(g, old, new):
    for v in g.values():
        for a, b in v['inputs'].items():
            if b == old:
                v['inputs'][a] = new


def insert(g, variant):
    L = lambda nid, slot=0: [str(nid), slot]
    loaded = L(902, 4)
    g['902'] = N('MpiLoadImage', 'Input_Image', image='None', channel='alpha', block_if_empty=False, string='')
    g['903'] = N('ImageResizeKJv2', 'Reference Sheet Fit', image=L(902), width=L(88), height=L(89), upscale_method='lanczos',
                 keep_proportion='pad', pad_color='0, 0, 0', crop_position='center', divisible_by=32, device='cpu')
    g['904'] = N('RepeatImageBatch', 'Reference Sheet Frames', image=L(903), amount=L(76))
    # model: IC LoRA after the transition LoRA, lazily
    for k, a in [(k, a) for k, v in g.items() for a, b in v['inputs'].items() if b == L(191)]:
        g[k]['inputs'][a] = L(901)
    g['900'] = N('LTXICLoRALoaderModelOnly', 'Reference LoRA', model=L(191), lora_name=LORA, strength_model=1.0)
    g['901'] = N('MpiIfElse', 'Reference Model', boolean=loaded, true=L(900), false=L(191))
    # stage 1: guide at the source
    guide = dict(vae=L(1), image=L(904), frame_idx=0, strength=1.0, latent_downscale_factor=1.0, crop='disabled',
                 tile_size=256, tile_overlap=64)
    lat1 =[(k, a) for k, v in g.items() for a, b in v['inputs'].items() if b == L(143)]
    g['905'] = N('LTXAddVideoICLoRAGuide', 'Reference Guide S1', positive=L(212, 0), negative=L(212, 1), latent=L(143),
                 use_tiled_encode=False, **guide)
    g['906'] = N('MpiPacker', 'Ref S1 on', any_1=L(905, 0), any_2=L(905, 1), any_3=L(905, 2))
    g['907'] = N('MpiPacker', 'Ref S1 off', any_1=L(212, 0), any_2=L(212, 1), any_3=L(143))
    g['908'] = N('MpiIfElse', 'Ref S1', boolean=loaded, true=L(906), false=L(907))
    g['909'] = N('MpiUnpacker', 'Ref S1 out', pack=L(908))
    g['524']['inputs']['any_1'], g['524']['inputs']['any_2'] = L(909, 0), L(909, 1)
    for k, a in lat1:
        g[k]['inputs'][a] = L(909, 2)
    assert len(lat1) == 4, lat1
    if variant != 'A':
        return g
    # stage 2: guide re-added on the upsampled latent (lipdub pattern) + its own crop before decode
    cond2 = [(k, a) for k, v in g.items() for a, b in v['inputs'].items() if b in (L(586, 0), L(586, 1))]
    lat2 = [(k, a) for k, v in g.items() for a, b in v['inputs'].items() if b == L(123)]
    g['910'] = N('LTXAddVideoICLoRAGuide', 'Reference Guide S2', positive=L(586, 0), negative=L(586, 1), latent=L(123),
                 use_tiled_encode=True, **guide)
    g['911'] = N('MpiPacker', 'Ref S2 on', any_1=L(910, 0), any_2=L(910, 1), any_3=L(910, 2))
    g['912'] = N('MpiPacker', 'Ref S2 off', any_1=L(586, 0), any_2=L(586, 1), any_3=L(123))
    g['913'] = N('MpiIfElse', 'Ref S2', boolean=loaded, true=L(911), false=L(912))
    g['914'] = N('MpiUnpacker', 'Ref S2 out', pack=L(913))
    for k, a in cond2:
        g[k]['inputs'][a] = L(914, g[k]['inputs'][a][1])
    for k, a in lat2:
        g[k]['inputs'][a] = L(914, 2)
    assert len(cond2) == 6 and len(lat2) == 4, (cond2, lat2)
    g['915'] = N('LTXVCropGuides', 'Ref S2 crop', positive=L(914, 0), negative=L(914, 1), latent=L(38, 0))
    g['349']['inputs']['false'] = L(915, 2)
    return g


# variant, overrides by title (the app's injection shape)
BASE = {'Input_Width': {'int': 960}, 'Input_Height': {'int': 512}, 'Input_Duration': {'int': 5}, 'Input_Seed': {'int': 42}}
CASES = {
    'ts_ref_A': ('A', {'Input_Image': {'image': SHEET}, 'Input_Positive': {'string': WOMAN_CAFE}}),
    'ts_ref_B': ('B', {'Input_Image': {'image': SHEET}, 'Input_Positive': {'string': WOMAN_CAFE}}),
    'ts_ref_start_A': ('A', {'Input_Image': {'image': SHEET}, 'Input_Start_Frame': {'image': START}, 'Input_Positive': {'string': WOMAN_CAFE}}),
    # regression: no sheet -> the modified graph must reproduce the shipped one
    'ts_t2v_shipped': ('shipped', {'Input_Positive': {'string': T2V}}),
    'ts_t2v_A': ('A', {'Input_Positive': {'string': T2V}}),
    'ts_i2v_shipped': ('shipped', {'Input_Start_Frame': {'image': START}, 'Input_Positive': {'string': WOMAN_CAFE}}),
    'ts_i2v_A': ('A', {'Input_Start_Frame': {'image': START}, 'Input_Positive': {'string': WOMAN_CAFE}}),
}


def build(tag):
    variant, sets = CASES[tag]
    g = json.load(open(SHIPPED, encoding='utf-8'))
    if variant != 'shipped':
        g = insert(g, variant)
    T = {v['_meta']['title']: k for k, v in g.items()}
    for title, ins in {**BASE, **sets}.items():
        g[T[title]]['inputs'].update(ins)
    return g, T


def run(tag):
    g, T = build(tag)
    body = json.dumps({'prompt': g, 'client_id': 'mpi1060'}).encode()
    try:
        res = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))
    except urllib.error.HTTPError as e:
        print(tag, 'REJECTED', e.read().decode()[:2500], flush=True)
        return
    pid, t0 = res['prompt_id'], time.time()
    while True:
        time.sleep(5)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    st = h[pid].get('status', {})
    saved = []
    for item in (v for lst in h[pid]['outputs'].get(T['Output_Video'], {}).values() if isinstance(lst, list) for v in lst):
        if isinstance(item, dict) and item.get('filename', '').endswith(('.mp4', '.webm')):
            q = urllib.parse.urlencode({'filename': item['filename'], 'subfolder': item.get('subfolder', ''), 'type': item.get('type', 'output')})
            urllib.request.urlretrieve(f'{URL}/view?{q}', f'{OUT}/{tag}.mp4')
            saved.append(f'{OUT}/{tag}.mp4')
    print(tag, st.get('status_str'), '%.0fs' % (time.time() - t0), saved or json.dumps(st)[-2500:], flush=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    if sys.argv[1:2] == ['--check']:  # offline: build every case, no POST
        for t in CASES:
            g, _ = build(t)
            print(t, len(g), 'nodes')
        sys.exit(0)
    for t in sys.argv[1:]:
        run(t)
