"""MPI-1086 phase B round 2: the full bodies kept their OLD long hair 0/15 (qh3), and a photo reference leaked its top and
necklaces into the close-up. The old thing must be taken away in words (MPI-1041 F2 bikini lesson).
  R1 - replace the hairstyle, the old one gone from every figure, every figure named, + keep her own face and clothes
  R2 - R1 + the bodies told to match the close-up's length and shape
Refs P (photo) / H (head crop), seeds fab / s42 / s7. Lock 2, the B3 graph.
usage: qh8.py <out> [only...]. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2
import qh3

OWN = "Keep the character's own face and clothes."
R1 = ("Replace the character's hairstyle with the hairstyle and hair colour from the reference picture, with the same "
      'length and shape, and the head uncovered and no hat. The old hairstyle is gone from every figure. ' + qh3.ALL
      + f' {OWN} ' + qh3.KEEP)
R2 = R1.replace(f' {OWN}', ' The hair on the front view and on the character seen from behind is the same length and '
                f'shape as in the close-up portrait. {OWN}')

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    api = qh2.graph(out, 'B3')
    for name, prompt in (('R1', R1), ('R2', R2)):
        for r, ref in qh3.REFS.items():
            for t, seed in qh1.SEEDS:
                tag = f'h8_{name}{r}_{t}'
                if only and not any(tag.startswith(o) for o in only):
                    continue
                if os.path.exists(f'{out}/{tag}.png'):
                    print(tag, 'exists, skipped', flush=True)
                    continue
                print(tag, prompt, flush=True)
                qh1.qf2.run(out, [{'tag': tag, 'api': api, 'set': {
                    'Input_Image': {'string': qh1.SHEET}, 'Input_Image_2': {'string': ref},
                    'Input_Reference': {'boolean': True}, 'Input_Positive': {'string': prompt},
                    'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 2}}}], tag)
