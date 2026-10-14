"""MPI-1086 phase B round 24: the user's OWN WORDS with a hair picture, on the r23 graph (mannequin inside the Qwen
graph). r21-r23 benched the picture alone; Fabio's eye test 1 used words too. Words = his eye-test words, one per
sheet: buns "in blue", man "gradient purple top, black bottom", braids "in silver white". Q2 = the shipped Klein W2
shape (qh15 round 9: the words LEAD, or the description outvotes them) moved onto the image 1 / image 2 naming of qh21.q1.
Describer words = r22's (raw photo, ASK2). usage: qh24.py <out> [only...]. Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh16
import qh23
import qf2

WORDS = {'W': 'in blue', 'M': 'gradient purple top, black bottom', 'B': 'in silver white'}


def q2(desc, words):
    return (f'Give the character in image 1 the hairstyle from image 2, changed like this: {words}. The hairstyle in '
            f'image 2: {desc}. Make it {words} on every figure, with the head uncovered and no hat. The front view, the '
            'character seen from behind and the close-up portrait on the right all show the same changed hairstyle. '
            "Keep the character's own face and clothes. Keep everything else exactly as it is.")


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    desc = json.load(open(f'{out}/h22_describe.json', encoding='utf-8'))
    for s in 'MBW':
        for t, seed in qh1.SEEDS[1:]:
            tag = f'h24_{s}_{t}'
            if only and not any(tag.startswith(o) for o in only):
                continue
            if os.path.exists(f'{out}/{tag}.png'):
                print(tag, 'exists, skipped', flush=True)
                continue
            ref = qh16.SHEETS[s][2]
            prompt = q2(desc[ref].strip().rstrip('.'), WORDS[s])
            print(tag, prompt, flush=True)
            qf2.run(out, [{'tag': tag, 'api': qh23.graph(out, tag), 'set': {
                'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Image_2': {'string': ref},
                'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
