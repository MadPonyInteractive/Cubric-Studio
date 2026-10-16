"""MPI-1086 round 46: the SKIN line (Fabio 2026-10-16). His shipped Makeup run (flowCSE_055, spider) took the mannequin's
cream skin, full lips and black nose tip onto the man; r45's face-only crops did the same. B adds one sentence after the
describer's words: image 2 is a mannequin, take only its paint, never its skin or face. A = the string without it.
  crop_{A,B}_spider_s*  r45's face-only canvas, Fabio's own mannequin (flowCSE_054) + his describer words, 3 seeds
  whole_B_spider_s*     the shipped whole-sheet string + B, the same 3 seeds (A whole = his flowCSE_055)
  crop_B_{glam,goth}    r42's mannequins + words, r45's seeds: the regression check
usage: qh46.py <out> [only...]. Under gpu_lease only. Runs on the G: bench :8188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import json
import qh12
import qh26
import qh45
from qh26 import run, QWEN, KEEP
from qh27 import upload, MEDIA
from qh31 import PIC
from qh39 import SHEET_M

qh26.URL = qh12.URL = 'http://127.0.0.1:8188'
SPIDER = ('Black web-patterned face paint stretching from the temples across the forehead and down the cheeks, black '
          'smoky eyeshadow with vibrant orange accents on the upper lids, heavy black winged eyeliner, long dramatic black '
          'lashes, obscured eyebrows under black paint, no visible blush or contour, and black lipstick with an orange '
          'center stripe')   # flowCSE_055's refMakeup, verbatim
SKIN = ('Image 2 is a mannequin: take only the painted makeup from it, not its pale skin, its face or the shape of its '
        'lips. Where there is no paint, the skin stays {who} own colour. ')
SEEDS = (31024, 46001, 46002)


def crop(w, skin):
    return (f"{qh45.TWICE}Apply the makeup from image 2 onto both faces in image 1: {w}. "
            + (SKIN.format(who="each face's") if skin else '') + f'{qh45.OWN}only the makeup changes. {KEEP}')


def whole(w):
    """characterSheetEditor.js buildChangePrompt('makeup', '', true, '', w) + the SKIN line."""
    return (f'Apply the makeup from image 2 onto the face of the character in image 1: {w}. '
            + SKIN.format(who="the character's")
            + "Keep the character's own face shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly as "
            + 'they are; only the makeup changes. The front view and the close-up portrait on the right both show the '
            + f'makeup. {KEEP}')


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    qh45.MEDIA = MEDIA
    upload(MEDIA + 'flowCSFI_011.png', SHEET_M)
    upload(MEDIA + 'flowCSE_054.png', 'mpi1086_r46_mann_spider.png')
    desc = json.load(open(f'{qh45.R42}/h42_describe.json', encoding='utf-8'))
    for k in ('m_glam', 'm_goth'):
        upload(f'{qh45.R42}/h42_M_{k}_Output_Image.png', f'mpi1086_r45_mann_{k}.png')
    w = lambda t: t.strip().rstrip('.')
    sheet, bx, cname = qh45.canvas(out, 'M')
    cases = []   # (tag, whole?, text, seed, ref)
    for s in SEEDS:
        for v in 'AB':
            cases.append((f'crop_{v}_spider_s{s}', False, crop(SPIDER, v == 'B'), s, 'mpi1086_r46_mann_spider.png'))
    for k in ('m_glam', 'm_goth'):
        cases.append((f'crop_B_{k[2:]}', False, crop(w(desc[k]), True), PIC[k][2], f'mpi1086_r45_mann_{k}.png'))
    for s in SEEDS:
        cases.append((f'whole_B_spider_s{s}', True, whole(SPIDER), s, 'mpi1086_r46_mann_spider.png'))
    for tag, is_whole, text, seed, ref in cases:
        t = f'h46_{tag}'
        if (only and not any(t.startswith(o) for o in only)) or os.path.exists(f'{out}/{t}_done'):
            continue
        if is_whole:
            run(out, t, QWEN, {'Input_Image': {'string': SHEET_M}, 'Input_Seed': {'int': seed},
                               'Input_Positive': {'string': text}, 'Input_Reference': {'boolean': True},
                               'Input_Image_2': {'string': ref}, 'Input_Headless': {'boolean': False},
                               'Input_Is_Mannequin': {'boolean': True}, 'Input_Back_Pass': {'boolean': False}})
        else:
            qh45.stitch(sheet, bx, qh45.edit(out, t, 'Q', cname, text, seed, ref)).save(f'{out}/{t}_stitched.png')
        open(f'{out}/{t}_done', 'w').close()
