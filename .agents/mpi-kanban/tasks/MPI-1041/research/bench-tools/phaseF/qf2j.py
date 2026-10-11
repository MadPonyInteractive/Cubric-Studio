"""MPI-1041 F2 round 8: Fabio's in-app run of D (no words) on his sheet + bikini cut-out, seed 1237334346: bodies pass,
the close-up drifts back to the old black halter in the late steps. Reproduce it on the bench, then D with the
close-up line naming the neckline and straps (F1's fix for his keyhole dress), on his seed + s42/s7 (D passed both).
usage: qf2j.py <out>. Under gpu_lease only.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qf2
import qf2e

OFF = ('Dress the character in only the outfit from the reference picture. Take off everything else the character '
       'wears now, trousers, skirt and top included. ')
KEEP = 'Keep everything else exactly as it is.'
D = OFF + 'Dress the character the same way in the close-up portrait on the right. ' + KEEP
DN = OFF + ('Dress the character the same way in the close-up portrait on the right, with the same neckline and '
            'straps. ' + KEEP)
FABIO = 1237334346


def cases():
    return [('w8_D_fab', D, FABIO), ('w8_DN_fab', DN, FABIO), ('w8_DN_s42', DN, 42), ('w8_DN_s7', DN, 7)]


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    qf2e.stage()
    for tag, prompt, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        qf2.run(out, [{'tag': tag, 'api': qf2.API, 'set': {
            'Input_Image': {'string': qf2e.SHEET}, 'Input_Image_2': {'string': qf2e.REF}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
