"""MPI-1041 F2 round 4: Fabio's CUT-OUT reference (a bikini, no person, composite_003.png) on his sheet (flowCSFI_002.png).
His run with the shipped string kept the jeans and missed the back. Tests: (B) all three views named + "replacing all
of the clothes, top and bottom" (safe to name the back now: no second figure in the picture), (C) round 1's shape +
the same replace clause, (Bc) B with the cut-out cropped tight. Shipped graph, Input_Reference true, lock 1.
usage: qf2e.py <out>. Under gpu_lease only.
"""
import os, shutil, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qf2
from PIL import Image

PROJ = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media'
SHEET, REF, REFC = 'mpi1041f2_fabio2_sheet.png', 'mpi1041f2_ref_bikinicut.png', 'mpi1041f2_ref_bikinicrop.png'
REPLACE = ', replacing all of the clothes the character wears now, top and bottom'
KEEP = 'Keep everything else exactly as it is.'
B = ('Dress the character in the outfit from the reference picture' + REPLACE + '. The front view, the back view and '
     'the close-up portrait on the right all show the same outfit. ' + KEEP)
C = ('Dress the character in the outfit from the reference picture' + REPLACE + '. Dress the character the same way '
     'in the close-up portrait on the right. ' + KEEP)


def stage():
    if not os.path.exists(f'{qf2.IN}/{SHEET}'):
        shutil.copy(f'{PROJ}/flowCSFI_002.png', f'{qf2.IN}/{SHEET}')
    if not os.path.exists(f'{qf2.IN}/{REF}'):
        shutil.copy(f'{PROJ}/composite_003.png', f'{qf2.IN}/{REF}')
    if not os.path.exists(f'{qf2.IN}/{REFC}'):
        Image.open(f'{qf2.IN}/{REF}').crop((400, 500, 830, 1260)).save(f'{qf2.IN}/{REFC}')


def cases():
    c = []
    for seed in (42, 7):
        c.append((f'w4_B_s{seed}', B, REF, seed))
        c.append((f'w4_C_s{seed}', C, REF, seed))
        c.append((f'w4_Bc_s{seed}', B, REFC, seed))
    return c


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    stage()
    for tag, prompt, ref, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        qf2.run(out, [{'tag': tag, 'api': qf2.API, 'set': {
            'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
