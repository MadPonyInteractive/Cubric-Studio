"""MPI-1041 F2 round 7: Fabio's bikini cut-out WITH words "the floral bikini" on the CURRENT shipped string (round 3
shape, no take-off clause). Round 5's W passed with C's replace clause; this checks the plain string without it.
usage: qf2h.py <out>. Under gpu_lease only.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qf2
import qf2e

CUR = ('Dress the character in the outfit from the reference picture: the floral bikini. Dress the character the same '
       'way in the close-up portrait on the right. Keep everything else exactly as it is.')

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    qf2e.stage()
    for seed in (42, 7):
        tag = f'w7_cur_s{seed}'
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        qf2.run(out, [{'tag': tag, 'api': qf2.API, 'set': {
            'Input_Image': {'string': qf2e.SHEET}, 'Input_Image_2': {'string': qf2e.REF}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': CUR}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
