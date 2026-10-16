"""MPI-1086 round 42: r41's winner (in-graph makeup mannequin + the makeup in words, KW) with the REAL describer's words
(the app's image_descriptor graph, Qwen3-VL 4B, asked ASKM of the RAW picture as `refHair` is), as the app would run it.
  M_*   MALE sheet flowCSFI_011: spider, glam, goth, glitter
  W_*   the woman's sheet flowCSE_044 (r31-r35's sheet): spider, glam - nothing lost where Makeup already passed
Writes <out>/h42_describe.json. usage: qh42.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh12
import qh26
from qh26 import run, QWEN
from qh27 import upload, MEDIA
from qh29 import SHEET
from qh31 import PIC
from qh39 import SHEET_M
from qh41 import MANN, MANN_TITLE, mK

qh26.URL = qh12.URL = 'http://127.0.0.1:48188'
ASKM = ('Describe only the makeup on the face in this picture: the eyeshadow, eyeliner, lashes, brows, blush, contour, '
        'lipstick and any face paint, naming each colour, shape and pattern and where it is on the face. Answer with one '
        'phrase, and nothing else.')
CASES = [('M', SHEET_M, 'm_spider'), ('M', SHEET_M, 'm_glam'), ('M', SHEET_M, 'm_goth'), ('M', SHEET_M, 'm_glitter'),
         ('W', SHEET, 'm_spider'), ('W', SHEET, 'm_glam')]

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSFI_011.png', SHEET_M)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    dpath = f'{out}/h42_describe.json'
    desc = json.load(open(dpath, encoding='utf-8')) if os.path.exists(dpath) else {}
    for k in sorted({c[2] for c in CASES}):
        name = f'mpi1086_r42_{k}.png'
        upload(MEDIA + PIC[k][1], name)
        if k not in desc:
            desc[k] = qh12.describe(name, ASKM)
            print(k, '->', desc[k], flush=True)
            json.dump(desc, open(dpath, 'w', encoding='utf-8'), indent=1)
    for s, sheet, k in CASES:
        tag = f'h42_{s}_{k}'
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': sheet}, 'Input_Image_2': {'string': f'mpi1086_r42_{k}.png'},
                             'Input_Seed': {'int': PIC[k][2]}, 'Input_Positive': {'string': mK(desc[k].strip().rstrip('.'))},
                             'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': True},
                             'Input_Is_Mannequin': {'boolean': False}, 'Input_Back_Pass': {'boolean': False},
                             MANN_TITLE: {'text': MANN}})
