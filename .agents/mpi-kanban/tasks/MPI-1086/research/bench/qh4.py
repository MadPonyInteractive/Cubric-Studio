"""MPI-1086 phase A round 3: regression on the B3 brow cut (the winner) with Fabio's other words-only hair cases, and
proof that lock 1 (Clothes) is untouched by the patch.
  K1 - lock 1's mask through the B3 graph vs the shipped graph: must be pixel-identical
  G  - "Black and pink Bobcut", "Two thick large Viking braids", "Blonde French braids", seeds s42 / s7
usage: qh4.py <out>. Under gpu_lease only.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2
import qf2

WORDS = {'bob': 'Black and pink Bobcut', 'viking': 'Two thick large Viking braids', 'french': 'Blonde French braids'}

if __name__ == '__main__':
    out = sys.argv[1]
    qh1.stage()
    api = qh2.graph(out, 'B3')
    for tag, g in (('h4_K1_ship', qf2.API), ('h4_K1_b3', api)):
        if not os.path.exists(f'{out}/{tag}.png'):
            qf2.run(out, [{'tag': tag, 'api': qh1.mask_graph(out, g), 'set': {
                'Input_Image': {'string': qh1.SHEET}, 'Input_Lock': {'int': 1}}}], tag)
    from PIL import Image, ImageChops
    d = ImageChops.difference(Image.open(f'{out}/h4_K1_ship.png'), Image.open(f'{out}/h4_K1_b3.png')).getbbox()
    print('K1 lock-1 mask diff bbox:', d, flush=True)
    qh1.go(out, [(f'h4_G_{k}_{t}', api, qh1.hair(w), seed, 2)
                 for k, w in WORDS.items() for t, seed in qh1.SEEDS[1:]])
