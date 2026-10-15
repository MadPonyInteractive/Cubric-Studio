"""MPI-1086 round 33: Makeup with a picture, firming up r32's mA (shipped graph, 25 steps).
  mA2    mA + "copied exactly: the same colours, shapes and patterns" (r32 mA lost the spider-web face paint)
  mAs    mA on the four pictures whose face leaked worst in r31 (glitter, glam, gems, lashes), two NEW seeds each:
         is the own face 7/7 a rate, or one lucky seed?
usage: qh33.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh27 import upload, MEDIA
from qh29 import SHEET
from qh32 import MAKEUP, mA

qh26.URL = 'http://127.0.0.1:48188'


def mA2(_w):
    return ('Give the character in image 1 the makeup from image 2, copied exactly: the same colours, shapes and '
            'patterns of its eyeshadow, eyeliner, lashes, blush, lipstick and any face paint. Put it on the face of the '
            'character in image 1, who stays the same person: the same face shape, eyes, nose, lips, eyebrows, skin '
            'tone and expression. Take nothing else from image 2: no piercings, jewellery, moles or hair. The front '
            'view and the close-up portrait on the right both show the makeup. ' + KEEP)


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    jobs = []
    for k, (w, ref, seed) in MAKEUP.items():
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        jobs.append((f'h33_mA2_{k}', mA2(w), name, seed))
    for k in ('m_glitter', 'm_glam', 'm_gems', 'm_lashes'):
        for seed in (7, 1234567):
            jobs.append((f'h33_mAs_{k}_{seed}', mA(''), f'mpi1086_r31_{k}.png', seed))
    for tag, text, ref, seed in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': False},
                             'Input_Is_Mannequin': {'boolean': True}})
