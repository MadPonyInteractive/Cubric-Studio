"""MPI-1086 round 38: the SHIPPED Qwen graph with the in-graph back pass (patch_raw_back_pass.py), one run per case.
  on_*     Input_Back_Pass on: picture cases with NO words in pass 2 (= r37 B1), words cases with the words (= r37 B2)
  w_*      picture cases WITH their "where" words in pass 2 (r37 B1 lost a back-only tattoo, t_back): does it keep it
           without inventing ink?
  off      Input_Back_Pass off on t_neck: must equal r35's h35_tQ_t_neck pixel for pixel (the pass never runs)
usage: qh38.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh27 import upload, MEDIA
from qh29 import SHEET
from qh34 import TATTOOS, tW
from qh35 import tQ
from qh36 import WORDS
from qh37 import TURN, b2_words

qh26.URL = 'http://127.0.0.1:48188'
PICS = ('t_leg1', 't_leg2', 't_neck', 't_back')

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    jobs = []
    for k in PICS:
        w, ref, seed = TATTOOS[k]
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        jobs.append((f'h38_on_{k}', tQ(w), TURN + ' ' + KEEP, name, True, seed, True))
        jobs.append((f'h38_w_{k}', tQ(w), b2_words(w), name, True, seed, True))
    for k, (w, seed) in WORDS.items():
        jobs.append((f'h38_on_{k}', tW(w), b2_words(w), SHEET, False, seed, True))
    w, ref, seed = TATTOOS['t_neck']
    jobs.append(('h38_off_t_neck', tQ(w), TURN + ' ' + KEEP, 'mpi1086_r31_t_neck.png', True, seed, False))
    for tag, t1, t2, ref, use_ref, seed, back in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': t1},
                             'Input_Positive_2': {'string': t2}, 'Input_Back_Pass': {'boolean': back},
                             'Input_Reference': {'boolean': use_ref}, 'Input_Headless': {'boolean': False},
                             'Input_Is_Mannequin': {'boolean': True}})
