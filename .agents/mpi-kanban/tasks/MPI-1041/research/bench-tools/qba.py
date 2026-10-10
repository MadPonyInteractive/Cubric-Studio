"""MPI-1041 bench, batch 9+: Body shape + Age on OTHER editors (Klein 9B failed them, batches 5-6). Fabio 2026-10-09:
EXACTLY 5 edits per model, seed 42, batch 5's L1 wording, the app's own graph per model as the app injects its edit op.
  qwen21 = qwen_image_2_1.json, Input_wf_type 4 (edit); node 30 resolution 0 = the sheet's exact size (1792x1120,
           both /32), and the canvas follows reference 1, so the edit is not resized at all
  boogu  = boogu_edit_balanced.json as shipped (1 MP): TextEncodeBooguEdit always scales its reference latent to
           1 MP, so a bigger canvas than node 196's would mismatch it and shift the edit
  qwenedit = qwen_edit.json, Input_wf_type 1 (qwenEdit), Input_Tier 2 = Turbo (8-step Lightning LoRA, cfg 1) as
           shipped (1 MP, same 1 MP reference-latent reason). Quality (tier 1, the app's default) ran 17.8 s a step,
           ~6 min an edit - Fabio: too painful without a speed-up. The unused tier arms (raw, 4-step) and the style
           LoRAs are cut from the bench copy so their (absent) files are not validated
  krea2  = krea2_t2i_sfw.json, Input_wf_type 4 (krea2Edit) as shipped (1 MP). At the exact size (node 573 at
           w*h/2^20 MP) the 16 GB card offloads: 35 s a step, ~16 min an edit - unshippable in a Flow
Writes <out>/<model>_api.json + <model>_spec.json and runs run_api.py (MPI-1042) - execute only under gpu_lease.
usage: qba.py <model> <out_dir>"""
import json, os, subprocess, sys

MODEL, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RUN_API = os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py')
SHEETS = {'nude': 'mpi1041_nude_sheet.png', 'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
TAIL = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'
CASES = [('muscular', 'nude', "Make the character's body muscular and athletic."),
         ('heavy', 'photo', "Make the character's body heavyset and overweight."),
         ('skinny', 'nude', "Make the character's body very skinny."),
         ('older', 'photo', 'Make the character about twenty years older.'),
         ('younger', 'fisher', 'Make the character about twenty years younger.')]

GRAPH = {'qwen21': 'qwen_image_2_1', 'boogu': 'boogu_edit_balanced', 'qwenedit': 'qwen_edit', 'krea2': 'krea2_t2i_sfw'}
g = json.load(open(os.path.join(REPO, 'comfy_workflows', GRAPH[MODEL] + '.json'), encoding='utf-8'))
op = {}
if MODEL == 'qwen21':
    assert g['30']['class_type'] == 'TextEncodeQwenImage21'
    g['30']['inputs']['resolution'] = 0
    op = {'Input_wf_type': {'int': 4}}
elif MODEL == 'qwenedit':
    assert g['111']['class_type'] == 'MpiAnySwitch' and g['111']['inputs']['any_2'] == ['5', 0]
    assert '8steps' in g['5']['inputs']['lora_name']
    # every arm -> node 5 (8-step Lightning): MpiAnySwitch indexes the CONNECTED inputs by position, so deleting
    # any_1 makes select 2 miss and block the output - a silent "success" with no image
    for k in ('any_1', 'any_3'):
        g['111']['inputs'][k] = ['5', 0]
    for n in ('173', '174'):
        for k in g[n]['inputs']:
            if k.startswith('lora_'):
                g[n]['inputs'][k] = 'None'
    op = {'Input_wf_type': {'int': 1}, 'Input_Tier': {'int': 2}}
elif MODEL == 'krea2':
    op = {'Input_wf_type': {'int': 4}}
api = os.path.join(OUT, f'{MODEL}_api.json')
json.dump(g, open(api, 'w', encoding='utf-8'), indent=1)

spec = [{'tag': f'{MODEL}_{k}_{sh}', 'api': api, 'set': {
    **op, 'Input_Image': {'image': SHEETS[sh]}, 'Input_Positive': {'string': p + TAIL}, 'Input_Seed': {'int': 42}}}
    for k, sh, p in CASES]
p = os.path.join(OUT, f'{MODEL}_spec.json')
json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
subprocess.run([sys.executable, RUN_API, OUT, p], check=True)
