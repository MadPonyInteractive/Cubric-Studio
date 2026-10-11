"""MPI-1041 F2 round 3: the SHIPPED Clothes-only reference string (round 1's shape, only the close-up named, words
after a colon). New seed s3 + two runs with words. Same bench graph as qf2.py. usage: qf2d.py <out>. Under gpu_lease only.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import qf2


def clothes(w=''):
    # Verbatim js/data/flowPrompts/characterSheetEditor.js buildChangePrompt('clothes', w, true).
    return (f'Dress the character in the outfit from the reference picture{": " + w if w else ""}. '
            'Dress the character the same way in the close-up portrait on the right. Keep everything else exactly as it is.')


def cases():
    return [
        ('w3_dress_photo_s3', 'photo', 1, clothes(), 'dress', 3),
        ('w3_dress_fabio_s3', 'fabio', 1, clothes(), 'dress', 3),
        ('w3_jacket_photo_s3', 'photo', 1, clothes(), 'jacket', 3),
        ('w3_jacket_fisher_s3', 'fisher', 1, clothes(), 'jacket', 3),
        ('w3_dressw_photo_s42', 'photo', 1, clothes('the red long-sleeved dress'), 'dress', 42),
        ('w3_jacketw_photo_s42', 'photo', 1, clothes('the green quilted jacket and the striped scarf'), 'jacket', 42),
    ]


if __name__ == '__main__':
    # The SHIPPED graph (its own Input_Image_2 + Input_Reference switch), not qf2's bench copy.
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for tag, sh, lock, prompt, ref, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        qf2.run(out, [{'tag': tag, 'api': qf2.API, 'set': {
            'Input_Image': {'string': qf2.SHEETS[sh]}, 'Input_Image_2': {'string': f'mpi1041f2_ref_{ref}.png'},
            'Input_Reference': {'boolean': True}, 'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed},
            'Input_Lock': {'int': lock}}}], tag)
