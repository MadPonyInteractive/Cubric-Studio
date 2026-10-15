"""MPI-1086 round 28: hair in WORDS moves off Klein (Fabio 2026-10-15, "try Qwen"). r27: Qwen with the builder's
short string (q_ship) missed the FRONT figure; spelled out it was 6/6. Here, on the same two sheets:
  q_fig    Qwen, the user's words in a string naming every figure (the picture route's tail)
  b_ship   Boogu Edit balanced (Apache-2.0, ~33 s; Fabio asked), the builder's string
  b_fig    Boogu, the every-figure string
Words: W1 "silver Mohawk" (a name), W2 Fabio's own spelled-out words from eye test 3.
MPI-1041 benched Boogu for body / age: it changed ONE panel (1/5), never tried on hair.
usage: qh28.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188 (sheets from qh27).
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh27 import SHEETS, TAIL

qh26.URL = 'http://127.0.0.1:48188'
BOOGU = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/boogu_edit_balanced.json'
WORDS = {'W1': 'silver Mohawk',
         'W2': 'Strip of hair at the top with stubble on the sides. Black roots with pink tips gradient'}


def ship(w):
    return f'Give the character {w}, with the head uncovered and no hat, so the new hair shows. ' + TAIL


def fig(w):
    return (f'Give the character this hairstyle: {w}. The head is uncovered, no hat. The front view, the character '
            'seen from behind and the close-up portrait on the right all show the same new hairstyle. '
            "Keep the character's own face and clothes. " + KEEP)


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    from qh27 import upload, MEDIA
    upload(MEDIA + 'flowCSFI_006.png', 'mpi1086_csR.png')
    upload(MEDIA + 'flowCSE_013.png', 'mpi1086_csC.png')
    for s, (sheet, seed) in SHEETS.items():
        for wk, w in WORDS.items():
            for name, api, prompt in (('q_fig', QWEN, fig(w)), ('b_ship', BOOGU, ship(w)), ('b_fig', BOOGU, fig(w))):
                tag = f'h28_{s}_{wk}_{name}'
                if (only and not any(tag.startswith(o) for o in only)) or any(
                        f.startswith(tag + '_Output') for f in os.listdir(out)):
                    continue
                ins = {'Input_Image': {'string': sheet}, 'Input_Seed': {'int': seed}, 'Input_Positive': {'string': prompt}}
                if api == QWEN:
                    ins.update({'Input_Reference': {'boolean': False}, 'Input_Headless': {'boolean': False}})
                run(out, tag, api, ins)
