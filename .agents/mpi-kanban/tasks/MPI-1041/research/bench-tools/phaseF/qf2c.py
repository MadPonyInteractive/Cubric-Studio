"""MPI-1041 F2: prove the SHIPPED graph's reference switch (comfy_workflows/flow_character_sheet_edit.json after
insert_ref2.py). Same prompt + seed as F1's c1_jacket_photo_s42 (shipped graph before F2):
  sw_off_ref   Input_Image_2 = the jacket picture, Input_Reference false  -> must equal c1_jacket_photo_s42 pixel for pixel
  sw_on_noref  no Input_Image_2, Input_Reference true                     -> must equal it too (nothing loaded)
  sw_on_ref    the jacket picture, Input_Reference true                   -> the reference is used
usage: qf2c.py <out>. Under gpu_lease only."""
import json, os, subprocess, sys
import numpy as np
from PIL import Image

REPO = 'C:/AI/Mpi/Cubric-Vision'
RUN_API = REPO + '/.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py'
API = REPO + '/comfy_workflows/flow_character_sheet_edit.json'
F1 = 'G:/ComfyUi/ComfyUI/output/mpi1041_f1/c1_jacket_photo_s42.png'
W = 'a red leather jacket, black jeans and boots'
P = (f'Dress the character in {W}. The front view, the back view and the close-up portrait on the right all show the '
     'same outfit, with the same neckline, sleeves and straps. Keep everything else exactly as it is.')
CASES = [('sw_off_ref', 'mpi1041f2_ref_jacket.png', False), ('sw_on_noref', '', True), ('sw_on_ref', 'mpi1041f2_ref_jacket.png', True)]


def main():
    out = sys.argv[1]
    for tag, ref, use in CASES:
        s = {'Input_Image': {'string': 'mpi1042art_cafe2_sheet.png'}, 'Input_Positive': {'string': P},
             'Input_Seed': {'int': 42}, 'Input_Lock': {'int': 1}, 'Input_Reference': {'boolean': use}}
        if ref:
            s['Input_Image_2'] = {'string': ref}
        sp = f'{out}/spec_{tag}.json'
        json.dump([{'tag': tag, 'api': API, 'set': s}], open(sp, 'w', encoding='utf-8'), indent=1)
        subprocess.run([sys.executable, RUN_API, out, sp])
    base = np.asarray(Image.open(F1).convert('RGB')).astype(int)
    for tag, _, _ in CASES:
        im = np.asarray(Image.open(f'{out}/{tag}.png').convert('RGB')).astype(int)
        print(tag, 'size', im.shape, 'max abs diff vs c1_jacket_photo_s42:', int(np.abs(im - base).max()) if im.shape == base.shape else 'SHAPE', flush=True)


if __name__ == '__main__':
    main()
