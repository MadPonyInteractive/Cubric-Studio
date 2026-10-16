"""MPI-1086 round 44: the STITCHED back pass (patch_raw_back_stitch.py) with the cuts gaps.py measures, on the scratch
API convert (argv[2]) before it replaces the shipped graph.
  ghost52   Fabio's flowCSE_052 exactly (flowCSFI_011 + imported_020, "Neck and chest tattoos", its seed), measured
            cuts: the old back figure's arm past 50% must be gone
  w10       flowCSFI_010 (the FRONT arm crosses 25%), tattoo in words, measured cuts
  def44     the woman's flowCSE_044, t_neck picture, cuts 0: must equal r38's h38_on_t_neck pixel for pixel
  m44       the same with measured cuts (0.25 / 0.492): next to def44
usage: qh44.py <out> <api> <r38 dir>. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, KEEP
from qh27 import upload, MEDIA
from qh29 import SHEET
from qh34 import TATTOOS, tW
from qh35 import tQ
from qh37 import TURN, b2_words
from gaps import cuts

qh26.URL = 'http://127.0.0.1:48188'


def px(name):
    c = cuts(MEDIA + name)
    w = Image.open(MEDIA + name).width
    return [round(v * w) for v in c] if c else [0, 0]


if __name__ == '__main__':
    out, api, r38 = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSFI_011.png', 'mpi1086_csfi11.png')
    upload(MEDIA + 'flowCSFI_010.png', 'mpi1086_csfi10.png')
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    upload(MEDIA + 'imported_020.jpg', 'mpi1086_r44_neck.png')
    snake = 'a black snake tattoo on his right leg'
    w, ref, seed = TATTOOS['t_neck']
    upload(MEDIA + ref, 'mpi1086_r31_t_neck.png')
    jobs = [
        ('h44_ghost52', 'mpi1086_csfi11.png', tQ('Neck and chest tattoos'), TURN + ' ' + KEEP, 'mpi1086_r44_neck.png',
         True, 1167271018, px('flowCSFI_011.png')),
        ('h44_w10', 'mpi1086_csfi10.png', tW(snake), b2_words(snake), SHEET, False, 7, px('flowCSFI_010.png')),
        ('h44_def44', SHEET, tQ(w), TURN + ' ' + KEEP, 'mpi1086_r31_t_neck.png', True, seed, [0, 0]),
        ('h44_m44', SHEET, tQ(w), TURN + ' ' + KEEP, 'mpi1086_r31_t_neck.png', True, seed, px('flowCSE_044.png')),
    ]
    for tag, sheet, t1, t2, ref, use_ref, seed, (c1, c2) in jobs:
        print(tag, 'cuts', c1, c2, flush=True)
        if any(f.startswith(tag + '_Output') for f in os.listdir(out)):
            continue
        run(out, tag, api, {'Input_Image': {'string': sheet}, 'Input_Image_2': {'string': ref},
                            'Input_Seed': {'int': seed}, 'Input_Positive': {'string': t1},
                            'Input_Positive_2': {'string': t2}, 'Input_Back_Pass': {'boolean': True},
                            'Input_Reference': {'boolean': use_ref}, 'Input_Headless': {'boolean': False},
                            'Input_Is_Mannequin': {'boolean': True},
                            'Input_Cut_1': {'int': c1}, 'Input_Cut_2': {'int': c2}})
    a = np.asarray(Image.open(f'{out}/h44_def44_Output_Image_2.png').convert('RGB'), dtype=int)
    b = np.asarray(Image.open(f'{r38}/h38_on_t_neck_Output_Image_2.png').convert('RGB'), dtype=int)
    print('def44 vs r38 h38_on_t_neck:', int(np.abs(a - b).max()) if a.shape == b.shape else f'shape {a.shape} vs {b.shape}')
