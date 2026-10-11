"""MPI-1041 F2 round 7b: W (round 4's C replace clause + words) on round 6's partial-words case - a jacket reference,
words "the green quilted jacket and the striped scarf" - which D stripped to shorts. W must keep the trousers.
usage: qf2i.py <out>. Under gpu_lease only.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qf2

W = ('Dress the character in the outfit from the reference picture: the green quilted jacket and the striped scarf, '
     'replacing all of the clothes the character wears now, top and bottom. Dress the character the same way in the '
     'close-up portrait on the right. Keep everything else exactly as it is.')

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for seed in (42, 7):
        tag = f'w7_Wjacket_photo_s{seed}'
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        qf2.run(out, [{'tag': tag, 'api': qf2.API, 'set': {
            'Input_Image': {'string': qf2.SHEETS['photo']}, 'Input_Image_2': {'string': 'mpi1041f2_ref_jacket.png'},
            'Input_Reference': {'boolean': True}, 'Input_Positive': {'string': W}, 'Input_Seed': {'int': seed},
            'Input_Lock': {'int': 1}}}], tag)
