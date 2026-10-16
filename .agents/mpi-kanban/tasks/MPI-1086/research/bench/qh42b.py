"""MPI-1086 round 42b (Fabio: "the user can still prompt: no lashes, or red lipstick?"): the user's words on top of the
makeup mannequin + the describer's words, MALE sheet flowCSFI_011. Hair taught that the description outvotes words that
come AFTER it ("in blue" after the description stayed pink, qh15 r9), so two orders:
  L   words LEAD: "Apply the makeup from image 2 ..., changed like this: <w>. The makeup in image 2: <d>. ..."
  A   words AFTER (r33's order): "... : <d>. ... Change only this about the makeup: <w>. ..."
Words: "no lashes" (the describer says "false lashes" on every picture), "red lipstick". Refs spider + glam.
usage: qh42b.py <out> [only...]. Run after qh42 (reads h42_describe.json). Under gpu_lease only. App engine :48188.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh31 import PIC
from qh39 import SHEET_M
from qh41 import MANN, MANN_TITLE

qh26.URL = 'http://127.0.0.1:48188'
OWN = ("Keep the character's own face shape, eyes, nose, lips, eyebrows, facial hair, skin tone and hair exactly as they "
       'are; only the makeup changes. The front view and the close-up portrait on the right both show the makeup. ')


def lead(d, w):
    return (f'Apply the makeup from image 2 onto the face of the character in image 1, changed like this: {w}. '
            f'The makeup in image 2: {d}. Make it {w} on every figure. ' + OWN + KEEP)


def after(d, w):
    return (f'Apply the makeup from image 2 onto the face of the character in image 1: {d}. ' + OWN
            + f'Change only this about the makeup: {w}. ' + KEEP)


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    desc = json.load(open(f'{out}/h42_describe.json', encoding='utf-8'))
    for k in ('m_spider', 'm_glam'):
        d = desc[k].strip().rstrip('.')
        for wk, w in (('nolash', 'no lashes'), ('red', 'red lipstick')):
            for o, fn in (('L', lead), ('A', after)):
                tag = f'h42b_{o}_{wk}_{k}'
                if (only and not any(tag.startswith(x) for x in only)) or any(
                        f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
                    continue
                run(out, tag, QWEN, {'Input_Image': {'string': SHEET_M},
                                     'Input_Image_2': {'string': f'mpi1086_r42_{k}.png'},
                                     'Input_Seed': {'int': PIC[k][2]}, 'Input_Positive': {'string': fn(d, w)},
                                     'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': True},
                                     'Input_Is_Mannequin': {'boolean': False}, 'Input_Back_Pass': {'boolean': False},
                                     MANN_TITLE: {'text': MANN}})
