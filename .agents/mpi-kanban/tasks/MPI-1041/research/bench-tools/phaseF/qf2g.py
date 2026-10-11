"""MPI-1041 F2 round 6: round 5's winner D (take the old clothes off) on round 3's six cases, as the builder would build
it (words after a colon). Regression check, plus the partial-words case ("the green quilted jacket and the striped
scarf") that must NOT strip the trousers. usage: qf2g.py <out>. Under gpu_lease only.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qf2


def clothes(w=''):
    return (f'Dress the character in only the outfit from the reference picture{": " + w if w else ""}. Take off '
            'everything else the character wears now, trousers, skirt and top included. Dress the character the same '
            'way in the close-up portrait on the right. Keep everything else exactly as it is.')


def cases():
    return [
        ('w6_dress_photo_s3', 'photo', clothes(), 'dress', 3),
        ('w6_dress_fabio_s3', 'fabio', clothes(), 'dress', 3),
        ('w6_jacket_photo_s3', 'photo', clothes(), 'jacket', 3),
        ('w6_jacket_fisher_s3', 'fisher', clothes(), 'jacket', 3),
        ('w6_dressw_photo_s42', 'photo', clothes('the red long-sleeved dress'), 'dress', 42),
        ('w6_jacketw_photo_s42', 'photo', clothes('the green quilted jacket and the striped scarf'), 'jacket', 42),
    ]


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for tag, sh, prompt, ref, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        qf2.run(out, [{'tag': tag, 'api': qf2.API, 'set': {
            'Input_Image': {'string': qf2.SHEETS[sh]}, 'Input_Image_2': {'string': f'mpi1041f2_ref_{ref}.png'},
            'Input_Reference': {'boolean': True}, 'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed},
            'Input_Lock': {'int': 1}}}], tag)
