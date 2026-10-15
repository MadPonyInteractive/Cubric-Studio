"""MPI-1086 round 35: Tattoos with a picture AND words naming where (r34 tP, picture alone + "copied exactly, same place on
the body", invented arm sleeves on 4 of 6 and moved a leg tattoo to the arms; r31's q_raw with the words got 4 + 2
partial). Shipped Qwen graph, 25 steps, r31's pictures, words and seeds.
  tQ     r29 q_raw(words) + "Add no other tattoos." after the figures sentence: does it stop invented ink?
usage: qh35.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN
from qh27 import upload, MEDIA
from qh29 import SHEET, q_raw
from qh34 import TATTOOS

qh26.URL = 'http://127.0.0.1:48188'


def tQ(w):
    s = q_raw(w)
    i = s.index(' Take only')
    return s[:i] + ' Add no other tattoos.' + s[i:]


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    jobs = []
    for k, (w, ref, seed) in TATTOOS.items():
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        jobs.append((f'h35_tQ_{k}', tQ(w), name, seed))
    for tag, text, ref, seed in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': False},
                             'Input_Is_Mannequin': {'boolean': True}})
