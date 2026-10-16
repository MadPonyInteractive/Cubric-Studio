"""MPI-1086 round 41: Cosmo's recipe (Fabio 2026-10-16, edit_007): the reference turned into a MANNEQUIN that keeps only
the makeup (Fabio's Qwen edit edit_005: "Replace the head of the woman with a mannequin and Keep only the makeup"), then
an edit with that mannequin as image 2 AND the makeup in words ("Keep his hair, beard, face shape ... only the makeup
changes"). Cosmo ran it on Klein 9B on a single portrait; here on the editor's Qwen graph, MALE sheet flowCSFI_011, 1.0.
  K    in-graph Klein mannequin with a MAKEUP prompt (node 147 overridden) + shipped mA2
  KW   the same mannequin + Cosmo-style words (DESC) instead of mA2
  FQ   Fabio's own Qwen mannequin edit_005 as a ready mannequin (Input_Is_Mannequin) + mA2       (spider only)
  FQW  edit_005 + Cosmo-style words                                                               (spider only)
usage: qh41.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh27 import upload, MEDIA
from qh32 import DESC
from qh33 import mA2
from qh39 import REFS, SHEET_M

qh26.URL = 'http://127.0.0.1:48188'
MANN = ('Replace the head of the person with a plain bald mannequin head, and keep only the makeup, exactly as it is: '
        'the same colours, shapes and patterns of the face paint, eyeshadow, eyeliner and lipstick. No hair, no '
        'jewellery and no clothes, on a plain grey background.')
MANN_TITLE = 'mannequin prompt (qh19 M4, MPI-1086 r19)'


def mK(w):
    return (f'Apply the makeup from image 2 onto the face of the character in image 1: {w}. Keep the character\'s own '
            'face shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly as they are; only the '
            'makeup changes. The front view and the close-up portrait on the right both show the makeup. ' + KEEP)


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'edit_005.png', 'mpi1086_r41_mann_spider.png')
    jobs = []
    for k, (_ref, seed) in REFS.items():   # pictures already uploaded by qh39
        ref = f'mpi1086_r39_{k}.png'
        jobs.append((f'h41_K_{k}', mA2(''), ref, seed, False))
        jobs.append((f'h41_KW_{k}', mK(DESC[k]), ref, seed, False))
    seed = REFS['m_spider'][1]
    jobs.append(('h41_FQ_m_spider', mA2(''), 'mpi1086_r41_mann_spider.png', seed, True))
    jobs.append(('h41_FQW_m_spider', mK(DESC['m_spider']), 'mpi1086_r41_mann_spider.png', seed, True))
    for tag, text, ref, seed, is_mann in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET_M}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': True},
                             'Input_Is_Mannequin': {'boolean': is_mann}, 'Input_Back_Pass': {'boolean': False},
                             MANN_TITLE: {'text': MANN}})
