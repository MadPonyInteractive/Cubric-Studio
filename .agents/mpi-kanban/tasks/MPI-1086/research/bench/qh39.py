"""MPI-1086 round 39: Makeup from a picture on a MALE sheet (Fabio's eye test: flowCSFI_011 + the spider-web woman ->
flowCSE_051 took her face; through Tattoos too, flowCSE_053). The shipped graph redraws the whole sheet at denoise 1.0
from the sheet's own latent, so the reference face leaks. Shipped Qwen graph, 25 steps, app params (Headless on).
  base   shipped mA2, denoise 1.0 (repro)
  d85    mA2, denoise 0.85         d75   mA2, denoise 0.75
  F      mF (own face firmed, lashes out of the paint list), denoise 1.0
  Fd80   mF, denoise 0.80
Refs: m_spider (Fabio's case, its seed from flowCSE_051) + m_glam (r31's worst face leak).
usage: qh39.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh27 import upload, MEDIA
from qh31 import PIC
from qh33 import mA2

qh26.URL = 'http://127.0.0.1:48188'
SHEET_M = 'mpi1086_csfi11.png'
REFS = {'m_spider': ('imported_024.jpg', 3905253788), 'm_glam': (PIC['m_glam'][1], PIC['m_glam'][2])}


def mF(_w):
    return ('Paint the makeup from image 2 onto the face of the character in image 1, copied exactly: the same colours, '
            'shapes and patterns of its eyeshadow, eyeliner, blush, lipstick and any face paint. Only the paint '
            'changes: the character in image 1 keeps their own face exactly - the same face shape, jaw, cheekbones, '
            'nose, eyes, eyelashes, eyebrows, lip shape, facial hair, skin and expression. Take nothing else from '
            "image 2: not its person's face or features, and no piercings, jewellery, moles or hair. The front view "
            'and the close-up portrait on the right both show the makeup. ' + KEEP)


VARIANTS = {'base': (mA2, 1.0), 'd85': (mA2, 0.85), 'd75': (mA2, 0.75), 'F': (mF, 1.0), 'Fd80': (mF, 0.80)}

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSFI_011.png', SHEET_M)
    jobs = []
    for k, (ref, seed) in REFS.items():
        name = f'mpi1086_r39_{k}.png'
        upload(MEDIA + ref, name)
        for v, (fn, dn) in VARIANTS.items():
            jobs.append((f'h39_{v}_{k}', fn(''), name, seed, dn))
    for tag, text, ref, seed, dn in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET_M}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': True},
                             'Input_Is_Mannequin': {'boolean': True}, 'Input_Back_Pass': {'boolean': False},
                             'KSampler': {'denoise': dn}})
