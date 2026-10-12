"""MPI-1086 phase B: a Hairstyle from a Reference picture (Fabio's curly blonde buns with a fringe, a face PHOTO).
Graph = phase A's brow-cut winner (lock 2: the face from the brows down on the front and the close-up, back free).
  N1 - MPI-1041 round 1 shape: only the close-up named                       (F2: pixie 0/4, the close-up kept its hair)
  NA - MPI-1090 shape: every figure named, the back one "seen from behind"   (F2 round 2: naming the back drew an extra
       figure with a person in the reference - the risk here, the back is free at lock 2)
  WA - NA + the user's words in their own sentence ("in pink")
Refs: P = the photo, H = a head-only crop of it. Seeds fab / s42 / s7.
usage: qh3.py <out> <cut B4|B3> [only...]. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2

REFS = {'P': 'mpi1086_ref_buns.png', 'H': 'mpi1086_ref_buns_head.png'}
KEEP = 'Keep everything else exactly as it is.'
N1 = ('Give the character the hairstyle and hair colour from the reference picture, with the head uncovered and no hat, '
      'so the new hair shows. Make the same change in the close-up portrait on the right. ' + KEEP)
ALL = ('The front view, the character seen from behind and the close-up portrait on the right all show the same '
       'hairstyle and hair colour.')
NA = 'Give the character the hairstyle and hair colour from the reference picture, with the head uncovered and no hat. ' \
     + ALL + ' ' + KEEP


def wa(words):
    return ('Give the character the hairstyle and hair colour from the reference picture, with the head uncovered and no '
            f'hat. {ALL} Change only this about the hairstyle: {words}. {KEEP}')


def cases(api):
    c = []
    for name, prompt in (('N1', N1), ('NA', NA), ('WA', wa('in pink'))):
        for r, ref in REFS.items():
            if name == 'WA' and r == 'H':
                continue
            for t, seed in qh1.SEEDS:
                c.append((f'h3_{name}{r}_{t}', api, prompt, seed, ref))
    return c


if __name__ == '__main__':
    out, cut = sys.argv[1], sys.argv[2]
    only = sys.argv[3:]
    qh1.stage()
    api = qh2.graph(out, cut)
    for tag, api, prompt, seed, ref in cases(api):
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qh1.qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh1.SHEET}, 'Input_Image_2': {'string': ref}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 2}}}], tag)
