"""MPI-1086 phase B round 8: the user's OWN WORDS on top of a hairstyle picture. The shipping graph (B3 brow cut + the
reference cut out by SAM3 "hair", qh14) and D3 with the describer's words, plus the user's words in their own
sentence, as Clothes does (MPI-1090 X3): "Change only this about the hairstyle: <words>."
  pin5 pink buns + "in blue"; pin11 fringe + updo + "with the bun lower, at the nape of the neck". s42 / s7.
usage: qh15.py <out> [only...]. Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh3
import qh11
import qh14
import qf2

CASES = {'mpi1086_pin5.png': 'in blue', 'mpi1086_pin11.png': 'with the bun lower, at the nape of the neck'}


def d3w(desc, words):
    return qh11.d3(desc).replace(f' {qh3.KEEP}', f' Change only this about the hairstyle: {words}. {qh3.KEEP}')


def w2(desc, words):
    """Round 9: the user's words LEAD - the picture's hairstyle changed like this, then its description."""
    return (f'Give the character the hairstyle from the reference picture, changed like this: {words}. The hairstyle in the '
            f'reference picture: {desc}. Make it {words} on every figure, with the head uncovered and no hat. '
            + qh3.ALL.replace('the same hairstyle and hair colour', 'the same changed hairstyle') + f' {qh11.OWN} {qh3.KEEP}')


def w3(desc, words):
    """Round 9: the words straight after the description, in the one phrase the bodies follow."""
    return qh11.d3(f'{desc}, but {words}').replace('the same hairstyle and hair colour', 'the same changed hairstyle')


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    desc = json.load(open(f'{out}/h12_describe.json', encoding='utf-8'))
    api = qh14.graph(out)
    shapes = [('', d3w)] + ([('W2', w2), ('W3', w3)] if 'round9' in only else [])
    only = [o for o in only if o != 'round9']
    for (sn, f), (ref, words), (t, seed) in [(a, b, c) for a in shapes for b in CASES.items() for c in qh1.SEEDS[1:]]:
        k = ref[len('mpi1086_'):-4]
        prompt = f(desc[ref].strip().rstrip('.'), words)
        if True:
            tag = f'h15_{sn}{"_" if sn else ""}{k}_{t}'
            if only and not any(tag.startswith(o) for o in only):
                continue
            if os.path.exists(f'{out}/{tag}.png'):
                print(tag, 'exists, skipped', flush=True)
                continue
            print(tag, prompt, flush=True)
            qf2.run(out, [{'tag': tag, 'api': api, 'set': {
                'Input_Image': {'string': qh1.SHEET}, 'Input_Image_2': {'string': ref}, 'Input_Lock': {'int': 2},
                'Input_Reference': {'boolean': True}, 'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
