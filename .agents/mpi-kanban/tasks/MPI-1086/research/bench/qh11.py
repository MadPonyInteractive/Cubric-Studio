"""MPI-1086 phase B round 5: qh10's D2 (the picture described in words + every figure named) took the hairstyle to all
three panels 9/9 but leaked the photo's knit top and necklaces into the close-up 3/3.
  D3  - D2 + "Keep the character's own face and clothes." (AW3's keep line, which stopped the leak for accessories)
  D4  - D3 with the keep line preceded by "Take only the hair from the reference picture, no clothes or jewellery."
  D3H - D3 on the head-only crop H (never leaked in qh3)
Photo P, fab / s42 / s7, lock 2, the B3 graph.
usage: qh11.py <out> [only...]. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2
import qh3
import qh10

OWN = "Keep the character's own face and clothes."


def d3(desc):
    return (f'Give the character the hairstyle and hair colour from the reference picture: {desc}, with the head uncovered '
            f'and no hat. {qh3.ALL} {OWN} {qh3.KEEP}')


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    api = qh2.graph(out, 'B3')
    ONLY_HAIR = 'Take only the hair from the reference picture, no clothes or jewellery. ' + OWN
    runs = [('D3', d3(qh10.DESC), 'P'), ('D4', d3(qh10.DESC).replace(OWN, ONLY_HAIR), 'P'), ('D3H', d3(qh10.DESC), 'H')]
    for (name, prompt, ref), (t, seed) in [(r, s) for r in runs for s in qh1.SEEDS]:
        tag = f'h11_{name}_{t}'
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qh1.qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh1.SHEET}, 'Input_Image_2': {'string': qh3.REFS[ref]},
            'Input_Reference': {'boolean': True}, 'Input_Positive': {'string': prompt},
            'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 2}}}], tag)
