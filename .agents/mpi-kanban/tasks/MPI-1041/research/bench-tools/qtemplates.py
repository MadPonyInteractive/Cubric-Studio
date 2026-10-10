"""MPI-1041 Batch A4: pin the Character Sheet Editor's untested templates on the bench graph, and the describer asks.
GPU work on the bench :8188 ONLY, and only under gpu_lease (run_qtemplates.sh). Never :48188 / :3000.

usage: qtemplates.py <phase> [out_dir]
  edit      Klein 9B edit as the bench ships it (`klein9b_edit_api.json` = comfy_workflows/klein_9b_t2i.json, kleinEdit,
            seed 42), CLOTHED sheets only (photo + fisher; an age edit never sees the nude sheet - asserted below):
              teen15   a "15" clause in the SET v3 neutral template's shape      (free edit, 1 MP, as batch 15)
              older70  the OLDER neutral template                                  (free edit, 1 MP, as batch 15)
              accF     Accessories words, free edit, exact size (2 MP)             (the diagnostic arm)
              accL     Accessories words + batch 4's per-panel SAM3 "head, hair" lock (masked path, 2 MP, 1792x1120)
            ONLY=teen15,accL limits the cases (a re-run of one wording).
  describe  the three describer asks on the app's default describer (comfy_workflows/image_descriptor.json, the
            qwen3vl_4b_abliterated encoder) through :8188: each ask is a pure function (image, ask) -> parsed answer.
            ASKSET=v1|v2 picks the wording set. Output: <out>/describe_results.json
  gate      the captions + the edit prompts through js/data/childSafety.js checkChildSafety, in memory (no GPU).
"""
import copy, json, os, re, shutil, subprocess, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RUN_API = os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py')
URL = 'http://127.0.0.1:8188'          # the bench, never the app's engine
IN = 'G:/ComfyUi/ComfyUI/input'
KLEIN_API = 'G:/ComfyUi/ComfyUI/output/mpi1041_q1/klein9b_edit_api.json'
DESCRIBER = os.path.join(REPO, 'comfy_workflows/image_descriptor.json')
AGE_DIR = 'G:/ComfyUi/ComfyUI/output/mpi1041_age'
SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}   # CLOTHED: the only edit inputs
NUDE = 'mpi1041_nude_sheet.png'                                                               # the describer only, never an edit

# ---- the templates (Phase B copies these strings VERBATIM) ------------------------------------------------------------
L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'
# SET v3's shape: "Change the character in this character sheet to be a younger version of themselves as a {N}-year-old
# {noun}, with {what a child / a younger person lacks}, wearing the same clothes." + L1  (qage.py: 10 -> "child ... no beard
# and no wrinkles"; 30 -> "a younger face, smooth skin and no grey hair").
TEEN = ("Change the character in this character sheet to be a younger version of themselves as a 15-year-old teenager, "
        "with a teenager's smooth face, no beard and no wrinkles, wearing the same clothes." + L1)
# Round 2 (v1 TEEN turned the photo woman's front + back into a short-haired brown boy while the portrait kept red curls):
TEEN_VARIANTS = {
    # b: no noun (the noun "teenager" read as a boy), the hair named as kept
    'teen15b': ("Change the character in this character sheet to be a younger version of themselves as a 15-year-old, "
                "with a teenager's smooth face, no beard and no wrinkles, the same hairstyle and hair color, "
                "wearing the same clothes." + L1),
    # c: the 30-year-old clause's own shape, plus the age only
    'teen15c': ("Change the character in this character sheet to be a younger version of themselves as a 15-year-old, "
                "with a younger face, smooth skin and no grey hair." + L1),
    # e: the noun that kept the red curls at 10 ("child"), a young teenager's face
    'teen15e': ("Change the character in this character sheet to be a younger version of themselves as a 15-year-old child, "
                "with a young teenager's smooth face, no beard and no wrinkles, wearing the same clothes." + L1),
}
# Batch 11's 70 (the woman, no tail) passed all three panels; neutral = "the character ... themselves", plus batch 13's tail.
OLDER = 'Change the character in this character sheet to be an older version of themselves as a 70-year-old.' + L1
# Hairstyle's shape (batch 8): "Give the character <x>." + L1.
ACCESSORIES = 'Give the character a red scarf and round glasses.' + L1
# For the gate rows only (copied from validation.md batch 15 / qage.py v3 and qrebuild.py, not re-run here):
V3_CHILD10 = ("Change the character in this character sheet to be a younger version of themselves as a 10-year-old child, "
              "with a child's smooth face, no beard and no wrinkles, wearing the same clothes." + L1)
REBUILD_SIZE = ("A {n}-year-old child with a child's height and body proportions: a short, small body with shorter arms and "
                "legs, a shorter torso and a larger head for the body. ")

# ---- the describer asks ------------------------------------------------------------------------------------------------
ASKS = {
    'v1': {
        'age': 'How old does the person in this picture look? Answer with one whole number of years and nothing else.',
        'dressed': ('Is the person in this picture fully dressed, with clothes covering the body? '
                    'Answer DRESSED or NOT DRESSED and nothing else.'),
        'clothes': ('Describe only what the person wears: the garments, shoes and head wear, each with its color and '
                    'material. Answer with one sentence that starts with the word Wearing, and name nothing else.'),
    },
    # round 2: v1's age read 80 for a 65-70 face; v1's caption said "with no headwear" (a negation Qwen cannot use)
    'v2': {
        'age': ('Estimate how old the person in this picture is, in years. An illustrated or 3D character counts as the '
                'person it shows. Answer with one whole number and nothing else.'),
        'agepor': 'How old does the person in this picture look? Answer with one whole number of years and nothing else.',
        'dressed': ('Is the person in this picture fully dressed, with clothes covering the body? '
                    'Answer DRESSED or NOT DRESSED and nothing else.'),
        'clothes': ('Describe only the clothes the person wears: each garment, pair of shoes and hat that is present, with '
                    'its color and material. Answer with one sentence that starts with the word Wearing.'),
    },
}


def chatml(question):
    """js/services/llmService.js buildDescribeInjectionParams: the user turn goes into Input_Describe_Prompt (node 38)."""
    return f'<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>{question}<|im_end|>\n<|im_start|>assistant\n'


def clean(raw):
    """flowEnhance.describeFlowRun: <think> blocks gone, leading non-letter / non-digit characters dropped, trimmed."""
    t = re.sub(r'<think>[\s\S]*?</think>', '', str(raw or ''), flags=re.I)
    return re.sub(r'^[^A-Za-z0-9]+', '', t).strip()


def parse_age(raw):
    t = clean(raw)
    m = re.search(r'(\d{1,3})\s*(?:-|\u2013|to)\s*(\d{1,3})', t)
    if m:
        a = (int(m.group(1)) + int(m.group(2))) / 2
    else:
        m = re.search(r'\d{1,3}', t)
        a = int(m.group(0)) if m else None
    return a if a is not None and 0 <= a <= 120 else None


def parse_dressed(raw):
    """True = DRESSED, False = NOT DRESSED, None = anything else (the caller treats it as 'not cleared')."""
    w = re.sub(r'[^A-Za-z]+', ' ', clean(raw)).strip().upper()
    return True if w == 'DRESSED' else False if w in ('NOT DRESSED', 'UNDRESSED') else None


HARD = ('man men woman women boy boys girl girls person people character lady guy male female gentleman child children kid '
        'kids teen teenager adult body face hair head skin eye eyes nose mouth lips beard mustache moustache hand hands arm '
        'arms leg legs foot feet chest breast breasts shoulder shoulders waist hips neck torso ear ears age aged year years '
        'old young').split()
SOFT = 'he she her hers his him they them their'.split()    # a pronoun: gendered or plural, the Flow never knows it


def person_words(text):
    low = re.findall(r"[a-z']+", text.lower())
    return [w for w in HARD if w in low], [w for w in SOFT if w in low]


def parse_caption(raw):
    t = clean(raw)
    hard, soft = person_words(t)
    return {'caption': t, 'person_words': hard, 'pronouns': soft, 'starts_wearing': t.lower().startswith('wearing')}


# ---- ComfyUI :8188 ------------------------------------------------------------------------------------------------------
def post_and_wait(graph, timeout=600):
    body = json.dumps({'prompt': graph, 'client_id': 'mpi1041a4'}).encode()
    res = json.load(urllib.request.urlopen(urllib.request.Request(URL + '/prompt', body, {'Content-Type': 'application/json'})))
    if res.get('node_errors'):
        raise RuntimeError('node errors: ' + json.dumps(res['node_errors'])[:800])
    pid, t0 = res['prompt_id'], time.time()
    while time.time() - t0 < timeout:
        time.sleep(0.5)
        h = json.load(urllib.request.urlopen(f'{URL}/history/{pid}'))
        if pid in h:
            return h[pid], time.time() - t0
    raise TimeoutError(f'{pid} did not finish in {timeout} s')


def describe(image, ask):
    """(image name in ComfyUI/input, ask) -> {raw, seconds}. The app's describe graph, the app's injection: only the
    ChatML user turn goes in (Input_Describe_Prompt), every other widget stays as the graph ships it."""
    g = json.load(open(DESCRIBER, encoding='utf-8'))
    T = {v['_meta']['title']: k for k, v in g.items()}
    g[T['Input_Image']]['inputs']['image'] = image
    g[T['Input_Describe_Prompt']]['inputs']['value'] = chatml(ask)
    h, secs = post_and_wait(g, 300)
    st = h.get('status', {})
    out = h.get('outputs', {}).get(T['Output_prompt'], {})
    text = out.get('text')
    if st.get('status_str') != 'success' or text is None:
        return {'raw': None, 'seconds': secs, 'error': json.dumps(st)[-600:]}
    return {'raw': ''.join(text) if isinstance(text, list) else str(text), 'seconds': secs}


# ---- edit phase ---------------------------------------------------------------------------------------------------------
def mask_api(img, w=1792, h=1120):
    """q4b_masklock.py's mask: SAM3 'head, hair' on EACH panel crop (front 0-448 | back 448-896 | portrait 896-1792), pasted
    back onto an empty sheet mask, holes filled, grown 6, inverted -> white = edit everything but heads and hair."""
    def n(cls, title, inputs):
        return {'class_type': cls, '_meta': {'title': title}, 'inputs': inputs}
    g = {'1': n('LoadImage', 'sheet', {'image': img}),
         '2': n('CheckpointLoaderSimple', 'SAM3 Model', {'ckpt_name': 'sam3.1_multiplex_fp16.safetensors'}),
         '3': n('CLIPTextEncode', 'SAM3 vocabulary', {'text': 'head, hair', 'clip': ['2', 1]}),
         '4': n('SolidMask', 'empty sheet mask', {'value': 0.0, 'width': w, 'height': h})}
    dest, i = '4', 10
    for name, x, pw in (('front', 0, 448), ('back', 448, 448), ('portrait', 896, 896)):
        g[str(i)] = n('ImageCrop', f'crop {name}', {'image': ['1', 0], 'width': pw, 'height': h, 'x': x, 'y': 0})
        g[str(i + 1)] = n('SAM3_Detect', f'head + hair, {name}', {
            'threshold': 0.5, 'refine_iterations': 2, 'individual_masks': False,
            'model': ['2', 0], 'image': [str(i), 0], 'conditioning': ['3', 0]})
        g[str(i + 2)] = n('MaskComposite', f'paste {name}', {
            'destination': [dest, 0], 'source': [str(i + 1), 0], 'x': x, 'y': 0, 'operation': 'add'})
        dest, i = str(i + 2), i + 10
    g['50'] = n('MpiMaskFillHoles', 'fill holes', {'max_hole_size': 0, 'mask': [dest, 0]})
    g['51'] = n('GrowMask', 'grow 6', {'expand': 6, 'tapered_corners': True, 'mask': ['50', 0]})
    g['52'] = n('InvertMask', 'edit everything else', {'mask': ['51', 0]})
    g['53'] = n('MaskToImage', 'mask to image', {'mask': ['52', 0]})
    g['54'] = n('PreviewImage', 'Output_Image', {'images': ['53', 0]})
    return g


def nsfw_trip(prompt):
    """node 43 (MpiTextContains in the Klein graph): whole words + a regular plural, case-insensitive. Returns the words
    that would switch the NSFW LoRA on. Ported from ComfyUi-MpiNodes logic.py MpiTextContains.contains."""
    kg = json.load(open(KLEIN_API, encoding='utf-8'))
    needles = [w.strip() for w in re.split(r'[,\n]', kg['43']['inputs']['words']) if w.strip()]
    hit = []
    for w in needles:
        esc = lambda phrase: r'\s+'.join(re.escape(t) for t in phrase.split())
        if re.search(r'[b-df-hj-np-tv-z]y$', w, re.I):
            stem = esc(w[:-1]) + '(?:y|ies)'
        elif re.search(r'(?:s|x|z|ch|sh)$', w, re.I):
            stem = esc(w) + '(?:es)?'
        else:
            stem = esc(w) + 's?'
        if re.search(rf'\b{stem}\b', prompt, re.I):
            hit.append(w)
    return hit


def free_spec(tag, sheet, prompt, mp=None):
    assert 'nude' not in SHEETS[sheet] and sheet in SHEETS, 'an edit never sees the nude sheet'
    assert not nsfw_trip(prompt), (tag, nsfw_trip(prompt))
    s = {'Input_wf_type': {'int': 4}, 'Input_Image': {'image': SHEETS[sheet]}, 'Input_Positive': {'string': prompt},
         'Input_Seed': {'int': 42}}
    if mp:
        s['Edit_Scale'] = {'megapixels': mp}
    return {'tag': f'{tag}_{sheet}', 'api': KLEIN_API, 'set': s}


def run_specs(out, name, specs):
    p = os.path.join(out, f'{name}_spec.json')
    json.dump(specs, open(p, 'w', encoding='utf-8'), indent=1)
    subprocess.run([sys.executable, RUN_API, out, p], check=True)


def phase_edit(out):
    only = [x for x in os.environ.get('ONLY', '').split(',') if x]
    want = lambda k: not only or k in only
    free = []
    for sh in SHEETS:
        if want('teen15'):
            free.append(free_spec('teen15', sh, TEEN))
        for k, t in TEEN_VARIANTS.items():
            if only and k in only:
                free.append(free_spec(k, sh, t))
        if want('older70'):
            free.append(free_spec('older70', sh, OLDER))
        if want('accF'):
            free.append(free_spec('accF', sh, ACCESSORIES, mp=2))
    if free:
        run_specs(out, 'qtemplates_free', free)
    if want('accL'):
        # the clothes lock: the per-panel head + hair mask, then the masked-edit path (InpaintCrop -> LanPaint -> stitch)
        g = json.load(open(KLEIN_API, encoding='utf-8'))
        assert g['581']['class_type'] == 'InpaintCropImproved'
        g['581']['_meta']['title'] = 'Edit_Crop'
        masked_api = os.path.join(out, 'klein9b_edit_masked_api.json')
        json.dump(g, open(masked_api, 'w', encoding='utf-8'), indent=1)
        masks = []
        for sh in SHEETS:
            api = os.path.join(out, f'mask_{sh}_api.json')
            json.dump(mask_api(SHEETS[sh]), open(api, 'w', encoding='utf-8'), indent=1)
            masks.append({'tag': f'mask_{sh}', 'api': api, 'set': {}})
        run_specs(out, 'qtemplates_masks', masks)
        locked = []
        for sh in SHEETS:
            shutil.copy(os.path.join(out, f'mask_{sh}.png'), f'{IN}/mpi1041tpl_mask_{sh}.png')
            s = free_spec('accL', sh, ACCESSORIES, mp=2)
            s['api'] = masked_api
            s['set']['Input_Mask'] = {'image': f'mpi1041tpl_mask_{sh}.png'}
            s['set']['Edit_Crop'] = {'output_target_width': 1792, 'output_target_height': 1120}
            locked.append(s)
        run_specs(out, 'qtemplates_locked', locked)


# ---- describe phase -----------------------------------------------------------------------------------------------------
# (name, image file in ComfyUI/input or a path to stage there, expected apparent age, why that age, expect dressed, asks)
def describe_rows(out):
    stage = lambda name, src: (shutil.copy(src, f'{IN}/{name}'), name)[1]
    rows = [
        ('photo', SHEETS['photo'], 42, 'my read of the face (freckles, forehead lines): 38-45; no bench record', True, 'age dressed clothes'),
        ('fisher', SHEETS['fisher'], 68, 'my read of the stylised old man (white beard, wrinkles): 65-70; no bench record', True, 'age dressed clothes'),
        ('nude', NUDE, 25, 'my read of the portrait face (smooth skin, winged liner): 22-28; no bench record', False, 'age dressed'),
        ('b15_age10_photo', stage('mpi1041tpl_b15_age10_photo.png', f'{AGE_DIR}/kleinv3_age10_photo.png'), 10,
         'batch 15 target (the bench reads it ~13)', True, 'age dressed'),
        ('b15_age30_fisher', stage('mpi1041tpl_b15_age30_fisher.png', f'{AGE_DIR}/kleinv3_age30_fisher.png'), 30,
         'batch 15 target', True, 'age dressed'),
    ]
    for tag, age in (('teen15', 15), ('teen15b', 15), ('teen15c', 15), ('teen15e', 15), ('older70', 70)):
        for sh in SHEETS:                                              # this run's own edits, when they exist
            src = os.path.join(out, f'{tag}_{sh}.png')
            if os.path.exists(src):
                rows.append((f'{tag}_{sh}', stage(f'mpi1041tpl_{tag}_{sh}.png', src), age, f'this run\'s target ({tag})',
                             True, 'age dressed'))
    if os.environ.get('ASKSET', 'v1') != 'v1':                         # the portrait half alone, for the age ask
        rows = [(n, i, a, w, d, wh + ' agepor' if 'age' in wh.split() else wh) for n, i, a, w, d, wh in rows]
    return rows


def portrait_half(image):
    """The right half of a sheet (the close-up portrait), staged in ComfyUI/input: what a Flow `box` crop would send."""
    from PIL import Image
    im = Image.open(os.path.join(IN, image)).convert('RGB')
    name = 'mpi1041tpl_R_' + image
    im.crop((im.width // 2, 0, im.width, im.height)).save(os.path.join(IN, name))
    return name


def phase_describe(out):
    ver = os.environ.get('ASKSET', 'v1')
    asks = ASKS[ver]
    res = []
    for name, image, want_age, why, want_dressed, which in describe_rows(out):
        for key in which.split():
            r = describe(portrait_half(image) if key == 'agepor' else image, asks[key])
            row = {'sheet': name, 'image': image, 'ask': key, 'askset': ver, 'question': asks[key],
                   'seconds': round(r['seconds'], 1), 'raw': r['raw']}
            if r['raw'] is None:
                row.update(ok=False, error=r.get('error'))
            elif key in ('age', 'agepor'):
                a = parse_age(r['raw'])
                row.update(answer=a, expected=want_age, expected_why=why,
                           ok=a is not None and abs(a - want_age) <= 8)
            elif key == 'dressed':
                d = parse_dressed(r['raw'])
                row.update(answer={True: 'DRESSED', False: 'NOT DRESSED', None: None}[d], expected='DRESSED' if want_dressed else 'NOT DRESSED',
                           ok=d is want_dressed)
            else:
                c = parse_caption(r['raw'])
                row.update(answer=c['caption'], person_words=c['person_words'], pronouns=c['pronouns'],
                           starts_wearing=c['starts_wearing'], ok=bool(c['caption']) and not c['person_words'])
            res.append(row)
            print(f"{name:18s} {key:8s} {'PASS' if row['ok'] else 'FAIL'} {row['seconds']:5.1f}s  "
                  f"{json.dumps(row.get('answer'))[:200]}  raw={json.dumps(r['raw'])[:160]}", flush=True)
    json.dump(res, open(os.path.join(out, f'describe_results_{ver}.json'), 'w', encoding='utf-8'), indent=1)
    print('passed', sum(r['ok'] for r in res), 'of', len(res))


# ---- gate phase ---------------------------------------------------------------------------------------------------------
GATE_JS = r"""
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const cs = await import(pathToFileURL(process.argv[2] + '/js/data/childSafety.js').href);
const rows = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const out = [];
for (const r of rows) {
  for (const modelId of ['klein-9b', 'qwen-image-2-1']) {
    // source is not a field checkChildSafety reads (ctx = { modelId, nsfw }): carried for the record only
    const v = cs.checkChildSafety([r.text], { modelId, source: 'character-sheet-editor' });
    out.push({ id: r.id, modelId, verdict: v.verdict, reason: v.reason || null, minorAge: cs.minorAge(r.text) });
  }
}
fs.writeFileSync(process.argv[4], JSON.stringify(out, null, 1));
"""


def phase_gate(out):
    ver = os.environ.get('ASKSET', 'v1')
    f = os.path.join(out, f'describe_results_{ver}.json')
    caps = {r['sheet']: r['answer'] for r in json.load(open(f, encoding='utf-8')) if r['ask'] == 'clothes' and r.get('answer')} if os.path.exists(f) else {}
    rows = []
    for sh, c in caps.items():
        rows.append({'id': f'caption alone ({sh})', 'text': c})
        for n in (1, 5, 10, 12):
            rows.append({'id': f'rebuild age {n} + caption ({sh})', 'text': REBUILD_SIZE.format(n=n) + c})
        rows.append({'id': f'CONTROL rebuild age 10 + caption + "no clothing" ({sh})',
                     'text': REBUILD_SIZE.format(n=10) + c + ' No clothing.'})
    for k, t in (('teen15 template', TEEN), ('older70 template', OLDER), ('accessories words', ACCESSORIES),
                 ('v3 child 10 template', V3_CHILD10), *((f'{k} template', t) for k, t in TEEN_VARIANTS.items())):
        rows.append({'id': k, 'text': t})
    jp, op = os.path.join(out, 'gate_in.json'), os.path.join(out, 'gate_out.json')
    json.dump(rows, open(jp, 'w', encoding='utf-8'), indent=1)
    js = os.path.join(out, 'gate.mjs')
    open(js, 'w', encoding='utf-8').write(GATE_JS)
    subprocess.run(['node', js, REPO.replace('\\', '/'), jp, op], check=True)
    for r in json.load(open(op, encoding='utf-8')):
        print(f"{r['id'][:70]:70s} {r['modelId']:15s} {r['verdict']:7s} {r['reason'] or ''} (minor age {r['minorAge']})")


if __name__ == '__main__':
    phase = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'G:/ComfyUi/ComfyUI/output/mpi1041_age/templates'
    os.makedirs(out, exist_ok=True)
    {'edit': phase_edit, 'describe': phase_describe, 'gate': phase_gate}[phase](out)
