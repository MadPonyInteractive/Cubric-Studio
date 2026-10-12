"""MPI-1086 phase C round 2: the two fails left WITH words (qh5 AW): the backpack worn on the chest on the front, and the
bandana missing from the front figure while the reference man's face and tee leak into the close-up.
  AW2 - every figure named (the back one "seen from behind"), worn the same way, + keep her own face, hair and clothes
  AW3 - qh5's AW + the keep line only (the shipped tail, nothing named)
Regression under AW2: earrings, tattoo. Lock 0, the B3 graph, s42 / s7.
usage: qh7.py <out> [only...]. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2
import qh5
import qf2

OWN = "Keep the character's own face, hair and clothes."


def aw2(words):
    return (f'Give the character {words} from the reference picture. The front view, the character seen from behind and '
            f'the close-up portrait on the right all show it, worn the same way. {OWN} Keep everything else exactly as it is.')


def aw3(words):
    return (f'Give the character {words} from the reference picture. Make the same change on the character seen from '
            f'behind and in the close-up portrait on the right. {OWN} Keep everything else exactly as it is.')


def cases():
    c = []
    for k in ('backpack', 'bandana', 'earrings', 'tattoo'):
        words = qh5.REFS[k][1]
        shapes = (('AW2', aw2), ('AW3', aw3))
        for name, f in shapes:
            for t, seed in qh1.SEEDS[1:]:
                c.append((f'h7_{name}_{k}_{t}', f(words), seed, qh5.ref_name(k)))
    return c


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    api = qh2.graph(out, 'B3')
    for tag, prompt, seed, ref in cases():
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh1.SHEET}, 'Input_Image_2': {'string': ref}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 0}}}], tag)
