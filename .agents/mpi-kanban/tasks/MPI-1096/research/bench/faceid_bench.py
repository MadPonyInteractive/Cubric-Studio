"""MPI-1096 bench: shipped LTX 2.3 Balanced graph (comfy_workflows/ltx_i2v_t2v_int8.json), Ingredients sheet vs
Best-Face-ID CharacterSheet LoRA (+ BFS LTXIdentityOverlapConditioning, native 1536x1024) vs both. Same seed.

Starts its OWN ComfyUI from G:/ComfyUi on :8199 (own input/temp/output dirs, identity node from scratchpad/cn via
--extra-model-paths-config), runs the cases, stops it. Run ONLY under the GPU lease:
  python <mpi-lib>/scripts/gpu_lease.py run --timeout 10800 --poll 2 -- "C:/Program Files/Python314/python.exe" -I <this> case...
"""
import json, os, subprocess, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = 'C:/AI/Mpi/Cubric-Vision'
SHIPPED = f'{REPO}/comfy_workflows/ltx_i2v_t2v_int8.json'
OUT = 'C:/AI/MPI-1096-out'
PORT = 8199
URL = f'http://127.0.0.1:{PORT}'
MEDIA = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media'
FID_LORA = 'LTX2.3\\best-face-id\\Best_FaceID_CharacterSheet_v1.0_LoRA.safetensors'

MAN = ('a man with short dark textured hair and a dark manicured beard, wearing a tight grey crew-neck t-shirt, '
       'charcoal cargo pants, grey hiking boots and a black backpack with thick shoulder straps')
WOMAN = ('a young woman with long silvery-white hair in thick Dutch braids hanging to mid-thigh, light green eyes, '
         'wearing a pink halter bikini top with a metal ring at the chest')
SCENE_MAN = ('A medium shot on a sun-dappled dirt path between tall pines. The man walks up the path toward the camera, '
             'stops a few feet away, looks straight into the lens, smirks and says, "That\'s right." Warm shafts of '
             'golden light fall through the canopy across his face. Birdsong and wind in the pines, his boots on the dirt.')
SCENE_WOMAN = ('A medium close-up on a sun-dappled dirt path between tall pines. The woman turns her head toward the '
               'camera, her long silver braids sliding over her shoulders, narrows her eyes and says flatly, "You again?" '
               'Warm shafts of golden light fall through the canopy. Birdsong and wind in the pines.')


def ingredients_prompt(desc, scene):
    # routes/ingredientsSheet.js sheetPrompt() for ONE picture: the full canvas is "Panel"
    return f'### Reference Sheet Description\n**Panel (Character):** {desc}\n### Target Description\n{scene}'


def fid_prompt(desc, scene):
    return f'ref_t2v: {desc}. {scene}'


# Fabio 2026-10-13: the man walked in from far away on the app path, so his face was too small to judge.
SCENE_MANCLOSE = ('A static medium close-up on a sun-dappled dirt path between tall pines, the man framed from the chest '
                  'up and filling the frame from the first frame to the last. He looks straight into the lens, smirks '
                  'and says, "That\'s right." Warm shafts of golden light fall through the canopy across his face. '
                  'Birdsong and wind in the pines.')
SHEETS = {'man': 'flowCSFI_007.png', 'woman': 'flowCharacterSheet_031.png'}
SHEET_OF = {'man': 'man', 'woman': 'woman', 'manclose': 'man'}
DESC = {'man': (MAN, SCENE_MAN), 'woman': (WOMAN, SCENE_WOMAN), 'manclose': (MAN, SCENE_MANCLOSE)}
SEEDS = {'': 3599064130, '_s2': 1816753443}   # Fabio's Qwen 2.1 ref2v_002, X2.3 ref2v_009
# case -> (who, ingredients sheet?, face-id?, prompt style, seed)
CASES = {f'{mode}_{who}{sk}': (who, mode in ('ing', 'both'), mode in ('fid', 'both'), 'ing' if mode == 'ing' else 'fid', sv)
         for who in DESC for mode in ('ing', 'fid', 'both') for sk, sv in SEEDS.items()}


TWO = json.load(open(f'{OUT}/sheets/two_cases.json', encoding='utf-8')) if os.path.exists(f'{OUT}/sheets/two_cases.json') else {}
for _k in TWO:
    for _sk, _sv in SEEDS.items():
        CASES[f'two_{_k}{_sk}'] = ('two', _k, _sv)
# Workflow-diff probes on the sharedchar sheet (the official Ingredients example has no detailer merge, no NAG, and
# a much richer per-panel description): one change each.
for _m in ('nodetail', 'nonag', 'richdesc'):
    for _sk, _sv in SEEDS.items():
        CASES[f'two_{_m}{_sk}'] = ('two', 'sharedchar', _sv, _m)
WOMAN_FACE = ('She has pale fair skin with faint freckles, an oval face with soft rounded cheeks, a straight narrow nose, '
              'full pink lips, light green eyes under thick dark-brown brows, and a small stud earring.')
MAN_FACE = ('He has olive-tan skin, a strong square jaw, thick dark straight brows over deep-set brown eyes, a straight '
            'nose, a full dark beard trimmed close on the cheeks, and hair short on the sides swept up and back on top.')


def build_two(tag, uploads):
    """Two characters, the app's own sheet (two_sheets.cjs); 'guides' = each character's sheet as its OWN IC guide."""
    _, k, seed, *mod = CASES[tag]
    mod = mod[0] if mod else None
    c = TWO[k]
    g = json.load(open(SHIPPED, encoding='utf-8'))
    T = {v['_meta']['title']: n for n, v in g.items()}
    first = uploads[c['guides'][0]] if 'guides' in c else uploads['two_' + k]
    prompt = c['prompt']
    if mod == 'richdesc':
        lines = prompt.split('\n')
        assert lines[1].startswith('**Left Panel (Character):**') and lines[2].startswith('**Right Panel (Character):**'), lines[:3]
        lines[1] += ' ' + WOMAN_FACE
        lines[2] += ' ' + MAN_FACE
        prompt = '\n'.join(lines)
    for title, ins in {'Input_Width': {'int': c['w']}, 'Input_Height': {'int': c['h']}, 'Input_Duration': {'int': 5},
                       'Input_Seed': {'int': seed}, 'Input_Positive': {'string': prompt},
                       'Input_Image': {'image': first}}.items():
        g[T[title]]['inputs'].update(ins)
    if mod == 'nodetail':
        g['387']['inputs'].update(strength_model=0.0, strength_clip=0.0)
    if mod == 'nonag':
        users = [(n, a) for n, v in g.items() for a, b in v['inputs'].items() if b == ['627', 0]]
        assert users, 'nothing reads 627'
        for n, a in users:
            g[n]['inputs'][a] = ['269', 0]   # 627 = NAG on/off switch; its false branch is 269
    # extra references: each its own LoadImage -> fit -> repeat -> guide, chained after 905 (stage 1) and 910 (stage 2)
    L = lambda nid, slot=0: [str(nid), slot]
    last = {'906': '905', '911': '910'}
    for j, key in enumerate(c.get('guides', [])[1:]):
        b = 940 + 10 * j
        g[str(b)] = N('LoadImage', f'Extra Sheet {j + 2}', image=uploads[key])
        g[str(b + 1)] = json.loads(json.dumps(g['903']))
        g[str(b + 1)]['inputs']['image'] = L(b)
        g[str(b + 2)] = json.loads(json.dumps(g['904']))
        g[str(b + 2)]['inputs']['image'] = L(b + 1)
        for pack, dst in (('906', b + 3), ('911', b + 4)):
            src = last[pack]
            g[str(dst)] = json.loads(json.dumps(g[pack == '906' and '905' or '910']))
            g[str(dst)]['inputs'].update(positive=L(src, 0), negative=L(src, 1), latent=L(src, 2), image=L(b + 2))
            g[str(dst)]['_meta']['title'] += f' ({j + 2})'
            for a in ('any_1', 'any_2', 'any_3'):
                assert g[pack]['inputs'][a][0] == src, (pack, a)
                g[pack]['inputs'][a] = [str(dst), g[pack]['inputs'][a][1]]
            last[pack] = str(dst)
    return g, T


def N(t, title, **inputs):
    return {'class_type': t, 'inputs': inputs, '_meta': {'title': title}}


def build(tag, uploads):
    if CASES[tag][0] == 'two':
        return build_two(tag, uploads)
    who, ing, fid, style, seed = CASES[tag]
    sheet = SHEET_OF[who]
    g = json.load(open(SHIPPED, encoding='utf-8'))
    T = {v['_meta']['title']: k for k, v in g.items()}
    desc, scene = DESC[who]
    sets = {'Input_Width': {'int': 960}, 'Input_Height': {'int': 512}, 'Input_Duration': {'int': 5},
            'Input_Seed': {'int': seed},
            'Input_Positive': {'string': (ingredients_prompt if style == 'ing' else fid_prompt)(desc, scene)}}
    if ing:
        sets['Input_Image'] = {'image': uploads[sheet + '_raw']}
    for title, ins in sets.items():
        g[T[title]]['inputs'].update(ins)
    if fid:
        L = lambda nid, slot=0: [str(nid), slot]
        users = [(k, a) for k, v in g.items() for a, b in v['inputs'].items() if b == L(901)]
        assert sorted(k for k, _ in users) == ['258', '277', '293', '330'], users
        g['950'] = N('LoraLoaderModelOnly', 'FaceID LoRA', model=L(901), lora_name=FID_LORA, strength_model=1.0)
        g['951'] = N('LoadImage', 'FaceID Sheet', image=uploads[sheet + '_1536'])
        g['952'] = N('LTXIdentityOverlapConditioning', 'FaceID Identity', model=L(950), positive=L(212, 0),
                     negative=L(212, 1), vae=L(1), latent=L(143), reference_image=L(951), source_id=2.0,
                     phase_scale=1.0, ref_resize_mode='native_resolution', debug_log=False, crop_anchor='center',
                     layout='overlap', reference_guidance_scale=1.0)
        for k, a in users:
            g[k]['inputs'][a] = L(952)
    return g, T


def upload(path, name):
    boundary = 'mpi1096boundary'
    data = open(path, 'rb').read()
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="{name}"\r\n'
            f'Content-Type: image/png\r\n\r\n').encode() + data + f'\r\n--{boundary}\r\nContent-Disposition: form-data; name="overwrite"\r\n\r\ntrue\r\n--{boundary}--\r\n'.encode()
    req = urllib.request.Request(URL + '/upload/image', body, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
    return json.load(urllib.request.urlopen(req))['name']


def prep_sheets():
    """raw = the file the app sends for ONE picture; 1536 = fit inside 1536x1024 on white (the LoRA's training size)."""
    os.makedirs(f'{OUT}/sheets', exist_ok=True)
    up = {}
    for who, f in SHEETS.items():
        src = f'{MEDIA}/{f}'
        dst = f'{OUT}/sheets/{who}_1536.png'
        subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src, '-vf',
                        'scale=1536:1024:force_original_aspect_ratio=decrease,pad=1536:1024:(ow-iw)/2:(oh-ih)/2:white',
                        dst], check=True)
        up[who + '_raw'] = upload(src, f'mpi1096_{who}_raw.png')
        up[who + '_1536'] = upload(dst, f'mpi1096_{who}_1536.png')
    for k, c in TWO.items():
        if 'sheet' in c:
            up['two_' + k] = upload(f'{OUT}/sheets/{c["sheet"]}', f'mpi1096_two_{k}.png')
    up['beach_raw'] = upload('C:/Users/Fabio/Documents/Cubric Studio/Projects/X2.3 references/Media/imported_006.jpg',
                             'mpi1096_beach_raw.jpg')
    up['beach_169'] = upload(f'{OUT}/sheets/beach_169.png', 'mpi1096_beach_169.png')
    return up


def run(tag, uploads):
    g, T = build(tag, uploads)
    body = json.dumps({'prompt': g, 'client_id': 'mpi1096'}).encode()
    try:
        res = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))
    except urllib.error.HTTPError as e:
        print(tag, 'REJECTED', e.read().decode()[:3000], flush=True)
        return
    pid, t0 = res['prompt_id'], time.time()
    peak = 0
    while True:
        # ponytail: whole-card nvidia-smi peak, sampled every 1 s (Windows hides per-process VRAM)
        for _ in range(5):
            time.sleep(1)
            try:
                used = int(subprocess.run(['nvidia-smi', '--query-gpu=memory.used', '--format=csv,noheader,nounits'],
                                          capture_output=True, text=True).stdout.split()[0])
                peak = max(peak, used)
            except Exception:
                pass
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            break
    print(tag, 'peak VRAM %d MiB' % peak, flush=True)
    st = h[pid].get('status', {})
    saved = []
    for item in (v for lst in h[pid]['outputs'].get(T['Output_Video'], {}).values() if isinstance(lst, list) for v in lst):
        if isinstance(item, dict) and item.get('filename', '').endswith(('.mp4', '.webm')):
            q = urllib.parse.urlencode({'filename': item['filename'], 'subfolder': item.get('subfolder', ''), 'type': item.get('type', 'output')})
            urllib.request.urlretrieve(f'{URL}/view?{q}', f'{OUT}/{tag}.mp4')
            saved.append(f'{OUT}/{tag}.mp4')
    print(tag, st.get('status_str'), '%.0fs' % (time.time() - t0), saved or json.dumps(st)[-3000:], flush=True)


def main(tags):
    if tags[:1] == ['--check']:
        fake = {k: 'x.png' for who in SHEETS for k in (who + '_raw', who + '_1536')}
        fake.update({'two_' + k: 'x.png' for k in TWO}, beach_raw='x.jpg', beach_169='x.png')
        for t in CASES:
            g, _ = build(t, fake)
            print(t, len(g), 'nodes')
        return
    for d in ('comfy', 'input', 'temp', 'user'):
        os.makedirs(f'{OUT}/{d}', exist_ok=True)
    log = open(f'{OUT}/comfy.log', 'ab')
    srv = subprocess.Popen(['G:/ComfyUi/python_embeded/python.exe', '-s', 'G:/ComfyUi/ComfyUI/main.py',
                            '--windows-standalone-build', '--port', str(PORT), '--disable-auto-launch',
                            '--extra-model-paths-config', f'{HERE}/cn/extra_paths.yaml',
                            '--output-directory', f'{OUT}/comfy', '--input-directory', f'{OUT}/input',
                            '--temp-directory', f'{OUT}/temp', '--user-directory', f'{OUT}/user'],
                           cwd='G:/ComfyUi', stdout=log, stderr=subprocess.STDOUT)
    try:
        for _ in range(240):
            try:
                urllib.request.urlopen(URL + '/system_stats', timeout=2)
                break
            except Exception:
                if srv.poll() is not None:
                    raise SystemExit(f'ComfyUI exited {srv.returncode}, see {OUT}/comfy.log')
                time.sleep(2)
        info = json.load(urllib.request.urlopen(URL + '/object_info/LTXIdentityOverlapConditioning'))
        assert 'LTXIdentityOverlapConditioning' in info, 'identity node not loaded'
        uploads = prep_sheets()
        for t in tags:
            run(t, uploads)
    finally:
        srv.terminate()
        try:
            srv.wait(30)
        except subprocess.TimeoutExpired:
            srv.kill()


if __name__ == '__main__':
    main(sys.argv[1:])
