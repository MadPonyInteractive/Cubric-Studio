"""MPI-1041 bench Q5 (batch 7): does dressing a HEADLESS sheet grow the front panel's head back, and does re-running the
headless chain (the app's own `flow_character_sheet_headless.json`, compositing only) clean it?
  1. the nude sheet through the headless graph -> mpi1041_nude_headless.png (front body, no head)
  2. dress it, 3 outfits, seed 42, exact sheet size (Edit_Scale 1.914):
       F = free, wording L1 ("the character")      FK = F + "The front full-body view has no head; keep it without one."
       M = batch 4's per-panel head + hair lock (the front panel has no head, so its mask leaves it editable)
  3. every dressed sheet through the headless graph again -> R_<tag>
Runs itself (run_api.py per step) - execute only under gpu_lease. usage: q5_headless.py <out_dir>"""
import json, os, shutil, subprocess, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..', '..', '..'))
RUN_API = os.path.join(HERE, '..', '..', '..', 'MPI-1042', 'research', 'bench-tools', 'run_api.py')
INP = 'G:/ComfyUi/ComfyUI/input'
Q4B = os.path.join(OUT, '..', 'mpi1041_q4b')
HEADLESS = os.path.join(REPO, 'comfy_workflows', 'flow_character_sheet_headless.json')
EDIT = os.path.join(Q4B, 'klein9b_edit_api.json')   # Edit_Scale + Edit_Crop titles
MASK = os.path.join(Q4B, 'mask_api.json')           # per-panel SAM3 head + hair, `sheet` = its LoadImage
SHEET_MP = 1792 * 1120 / 2 ** 20
OUTFITS = {
    'tee': 'a fitted white crew-neck t-shirt, light blue jeans and white sneakers',
    'biker': 'a red leather biker jacket over a black knee-length dress, and black ankle boots',
    'armour': ('brown medieval leather armour with a wide belt, a dark green cloak hanging down the back with '
               'the hood down, and tall brown boots'),
}
L1 = ('Dress the character in {o}. Dress the character the same way in the close-up portrait on the right. '
      'Keep everything else exactly as it is.')
KEEP = ' The front full-body view has no head; keep it without one.'


def run(spec, name):
    p = os.path.join(OUT, name)
    json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
    subprocess.run([sys.executable, RUN_API, OUT, p], check=True)


def to_input(tag):
    shutil.copy(os.path.join(OUT, tag + '.png'), os.path.join(INP, f'mpi1041_{tag}.png'))
    return f'mpi1041_{tag}.png'


run([{'tag': 'headless', 'api': HEADLESS, 'set': {'Input_Image': {'image': 'mpi1041_nude_sheet.png'}}}], 'h0.json')
src = to_input('headless')
run([{'tag': 'mask', 'api': MASK, 'set': {'sheet': {'image': src}}}], 'mask.json')
mask = to_input('mask')


def edit(tag, prompt, with_mask):
    s = {'Input_wf_type': {'int': 4}, 'Input_Image': {'image': src}, 'Input_Positive': {'string': prompt},
         'Input_Seed': {'int': 42}, 'Edit_Scale': {'megapixels': SHEET_MP}}
    if with_mask:
        s.update(Input_Mask={'image': mask}, Edit_Crop={'output_target_width': 1792, 'output_target_height': 1120})
    return {'tag': tag, 'api': EDIT, 'set': s}


spec = []
for k, o in OUTFITS.items():
    spec += [edit(f'F_{k}', L1.format(o=o), False), edit(f'FK_{k}', L1.format(o=o) + KEEP, False),
             edit(f'M_{k}', L1.format(o=o), True)]
run(spec, 'dress.json')
run([{'tag': 'R_' + j['tag'], 'api': HEADLESS, 'set': {'Input_Image': {'image': to_input(j['tag'])}}} for j in spec],
    'redo.json')
