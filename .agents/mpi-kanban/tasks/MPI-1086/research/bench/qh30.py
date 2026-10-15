"""MPI-1086 round 30: Qwen-Image 2.1 for Accessories, on r29's sheet flowCSE_044, Fabio's words and seeds.
  q25      r29's q_raw (picture as image 2, no mannequin) at 25 steps instead of 30 (Fabio: 30 was picked against
           t2i deformations, an edit may need fewer). The 30-step baseline is r29's h29_q_raw_* (same seeds).
  k_words  Accessories in WORDS only, Klein, the shipped `accessories` string, lock 0
  q_words  Accessories in words only, Qwen, every figure named (r28's lesson: naming every figure reaches the bodies)
usage: qh30.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, KLEIN, QWEN, KEEP
from qh27 import upload, MEDIA
from qh29 import SHEET, CASES, q_raw

qh26.URL = 'http://127.0.0.1:48188'


def k_words(w):   # characterSheetEditor.js `accessories`, as shipped
    return (f'Give the character {w}. Make the same change on the character seen from behind and in the close-up '
            f'portrait on the right. {KEEP}')


def q_words(w):
    w = w[0].lower() + w[1:]
    return (f'Give the character in image 1 {w}. The front view, the character seen from behind and the close-up '
            f"portrait on the right all show the {w} wherever it can be seen. Keep the character's own face, hair, "
            'skin and clothes. ' + KEEP)


# q_words read a bare "Mask" as a matte: the whole sheet came back a purple mask with the figures erased (1 of 4).
# qw2 says it is a thing she wears or holds.
def qw2(w):
    return (f'Give the character in image 1 this accessory to wear or hold: {w}. The front view, the character seen '
            'from behind and the close-up portrait on the right all show it wherever it can be seen. Keep the '
            "character's own face, hair, skin and clothes. " + KEEP)


ARMS = (   # name, graph, string, picture given, extra inputs
    ('q25', QWEN, q_raw, True, {'KSampler': {'steps': 25}}),
    ('k_words', KLEIN, k_words, False, {}),
    ('q_words', QWEN, q_words, False, {}),
    ('qw2', QWEN, qw2, False, {'KSampler': {'steps': 25}}),
)

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    for k, (_, ref, _) in CASES.items():
        upload(MEDIA + ref, f'mpi1086_r29_{k}.png')
    for name, api, f, ref, extra in ARMS:
        for k, (w, _, seed) in CASES.items():
            tag = f'h30_{name}_{k}'
            if (only and not any(tag.startswith(o) for o in only)) or any(
                    f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
                continue
            ins = {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': f'mpi1086_r29_{k}.png'},
                   'Input_Seed': {'int': seed}, 'Input_Positive': {'string': f(w)},
                   'Input_Reference': {'boolean': ref}, 'Input_Headless': {'boolean': False}, **extra}
            if api == KLEIN:
                ins['Input_Lock'] = {'int': 0}
            else:
                ins['Input_Is_Mannequin'] = {'boolean': True}
            run(out, tag, api, ins)
