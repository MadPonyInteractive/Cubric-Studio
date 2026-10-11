"""MPI-1090 round 3, on the shoulder lock (qg4): the close-up with WORDS. LWC passed front/back/layout 3/3 but its
close-up lost the neckline 0/3 (with no words, LC's same line held it 3/3).
  X1 - LWC + a close-up sentence naming the reference's neckline
  X2 - the words sentence moved after the all-figures line
  X3 - X2 + X1's neckline sentence (round 3 split the two: X1 close-up 5/5, X2 back 5/5)
  each with "G string seen from behind" (3 seeds) and "in red" (2 seeds; round 1 broke the layout on Fabio's seed)
usage: qg5.py <out>. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../MPI-1041/research/bench-tools/phaseF'))
sys.path.insert(0, HERE)
import qf2
import qg1
import qg4

REF = 'Dress the character in the outfit from the reference picture, replacing all of the clothes the character wears now, top and bottom. '
ALL = ('The front view, the character seen from behind and the close-up portrait on the right all show the same outfit, '
       'with the same neckline, sleeves and straps. ')
NECK = 'The close-up portrait on the right shows the top of the outfit from the reference picture, with its neckline. '
KEEP = 'Keep everything else exactly as it is.'


def x1(w):
    return REF + f'Change only this about the outfit: {w}. ' + ALL + NECK + KEEP


def x2(w):
    return REF + ALL + f'Change only this about the outfit: {w}. ' + KEEP


def x3(w):
    return REF + ALL + f'Change only this about the outfit: {w}. ' + NECK + KEEP


def cases():
    c = []
    for name, fn in (('X1', x1), ('X2', x2), ('X3', x3)):
        for seed_tag, seed in (('fab', qg1.F12), ('s42', 42), ('s7', 7)):
            c.append((f'g5_{name}g_{seed_tag}', fn('G string seen from behind'), seed))
        for seed_tag, seed in (('fab', qg1.F12), ('s42', 42)):
            c.append((f'g5_{name}r_{seed_tag}', fn('in red'), seed))
    return c


if __name__ == '__main__':
    out = sys.argv[1]
    api = qg4.graph(out)
    for tag, prompt, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qg1.SHEET}, 'Input_Image_2': {'string': qg1.REF}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
