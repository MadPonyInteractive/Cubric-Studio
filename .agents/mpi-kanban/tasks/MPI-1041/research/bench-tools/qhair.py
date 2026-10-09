"""MPI-1041 bench, Hairstyle field (batch 8): does a haircut by words land on all three panels, back included?
Batches 5-6 found Klein carries what sits ON the character but not a change to the face (age); hair is in between.
  H  = free whole-sheet edit, L1 shape (one change sentence, the portrait sentence, "keep everything else")
  HF = the same on the masked-edit path with a FACE lock: batch 4's per-panel SAM3 mask, vocabulary "face" only
       (the back panel has no face, so it stays fully editable) - keeps identity while the hair changes
3 haircuts x the nude + the photo sheet, seed 42, exact size. Runs itself - only under gpu_lease.
usage: qhair.py <out_dir>"""
import json, os, shutil, subprocess, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
RUN_API = os.path.join(HERE, '..', '..', '..', 'MPI-1042', 'research', 'bench-tools', 'run_api.py')
INP = 'G:/ComfyUi/ComfyUI/input'
Q4B = os.path.join(OUT, '..', 'mpi1041_q4b')
EDIT, MASK = os.path.join(Q4B, 'klein9b_edit_api.json'), os.path.join(Q4B, 'mask_api.json')
SHEETS = {'nude': 'mpi1041_nude_sheet.png', 'photo': 'mpi1042art_cafe2_sheet.png'}
HAIR = {'bob': 'a short blonde bob haircut', 'buzz': 'a very short buzz cut', 'curly': 'long curly red hair'}


def run(spec, name):
    p = os.path.join(OUT, name)
    json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
    subprocess.run([sys.executable, RUN_API, OUT, p], check=True)


run([{'tag': f'facemask_{sh}', 'api': MASK, 'set': {'sheet': {'image': f}, 'SAM3 vocabulary': {'text': 'face'}}}
     for sh, f in SHEETS.items()], 'masks.json')
for sh in SHEETS:
    shutil.copy(os.path.join(OUT, f'facemask_{sh}.png'), os.path.join(INP, f'mpi1041_facemask_{sh}.png'))
spec = []
for sh, f in SHEETS.items():
    for k, h in HAIR.items():
        s = {'Input_wf_type': {'int': 4}, 'Input_Image': {'image': f}, 'Input_Seed': {'int': 42},
             'Input_Positive': {'string': f'Give the character {h}. Make the same change in the close-up portrait on '
                                          'the right. Keep everything else exactly as it is.'},
             'Edit_Scale': {'megapixels': 1792 * 1120 / 2 ** 20}}
        spec.append({'tag': f'H_{k}_{sh}', 'api': EDIT, 'set': s})
        spec.append({'tag': f'HF_{k}_{sh}', 'api': EDIT, 'set': dict(
            s, Input_Mask={'image': f'mpi1041_facemask_{sh}.png'},
            Edit_Crop={'output_target_width': 1792, 'output_target_height': 1120})})
run(spec, 'hair.json')
