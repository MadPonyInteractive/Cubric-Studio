"""MPI-1041 F2 round 5: the jeans survive (round 4: top on all three panels 6/6, bottoms 2/6). Wordings that take
the old clothes OFF: (D) "only the outfit ... take off everything else, trousers included" + close-up named, (E) D
with all three views named, (W) round 4's C + words "the floral bikini". Same sheet + uncropped cut-out as qf2e.
usage: qf2f.py <out>. Under gpu_lease only.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qf2
import qf2e

KEEP = 'Keep everything else exactly as it is.'
OFF = ('Dress the character in only the outfit from the reference picture{w}: take off everything else the character '
       'wears now, trousers, skirt and top included.')
D = OFF.format(w='') + ' Dress the character the same way in the close-up portrait on the right. ' + KEEP
E = OFF.format(w='') + (' The front view, the back view and the close-up portrait on the right all show the same '
                        'outfit. ' + KEEP)
W = qf2e.C.replace('reference picture', 'reference picture: the floral bikini', 1)


def cases():
    c = []
    for seed in (42, 7):
        c += [(f'w5_D_s{seed}', D, seed), (f'w5_E_s{seed}', E, seed), (f'w5_W_s{seed}', W, seed)]
    return c


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    qf2e.stage()
    for tag, prompt, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': qf2.API, 'set': {
            'Input_Image': {'string': qf2e.SHEET}, 'Input_Image_2': {'string': qf2e.REF}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
