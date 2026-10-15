"""MPI-1086 round 34: Makeup and Tattoos as their OWN options (Fabio's split), shipped Qwen graph, 25 steps.
  tP     tattoos WITH the picture, no words, an exact-copy string: same designs, colours, size and place on the body,
         "Add no tattoos that are not in image 2", and NO limb named (r32's "arm or leg" ADDED sleeve tattoos)
  tW     tattoos in words only, no picture
  tPw    tattoos with the picture AND words: tP + "Change only this about the tattoos: <words>"
  mW     makeup in words only, the character's own face named part by part (like qh33.mA2)
  mP     makeup with the picture AND words: qh33.mA2 + "Change only this about the makeup: <words>"
usage: qh34.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh27 import upload, MEDIA
from qh29 import SHEET
from qh31 import PIC
from qh33 import mA2

qh26.URL = 'http://127.0.0.1:48188'
TATTOOS = {k: v for k, v in PIC.items() if k.startswith('t_')}
FACE = ('Put it on the face of the character in image 1, who stays the same person: the same face shape, eyes, nose, '
        'lips, eyebrows, skin tone and expression. ')
T_WORDS = {
    'w_roses': ('a full sleeve tattoo of black roses on the left arm', 31102),
    'w_koi': ('a large blue and orange koi fish tattoo covering the whole back', 34102),
}
M_WORDS = {
    'w_goth': ('dark gothic makeup with smoky eyes and black lipstick', 31101),
    'w_pink': ('pink glitter eyeshadow, a white graphic eyeliner and glossy pink lips', 34201),
}
M_PIC = {   # tag: (picture from qh31.PIC, words)
    'm_goth': 'red lipstick',
    'm_glam': 'blue eyeshadow',
}
T_PIC = {   # tag: (picture from qh31.PIC, words)
    't_neck': 'in red ink',
    't_all': 'in blue ink',
}


def tP():
    return ('Give the character in image 1 the tattoos from image 2, copied exactly: the same designs, colours and size, '
            'in the same place on the body. The front view, the character seen from behind and the close-up portrait '
            'on the right all show the tattoos wherever they can be seen. Add no tattoos that are not in image 2. Take '
            "only the tattoos from image 2, not the person: keep the character's own face, hair, skin tone and "
            'clothes. ' + KEEP)


def tW(w):
    return (f'Give the character in image 1 this tattoo: {w}. The front view, the character seen from behind and the '
            'close-up portrait on the right all show it wherever it can be seen. Add no other tattoos. Keep the '
            "character's own face, hair, skin tone and clothes. " + KEEP)


def mW(w):
    return (f'Give the character in image 1 this makeup: {w}. ' + FACE + 'The front view and the close-up portrait on '
            'the right both show the makeup. ' + KEEP)


def tPw(w):
    s = tP()
    return s[:-len(KEEP)] + f'Change only this about the tattoos: {w}. ' + KEEP


def mP(w):
    s = mA2('')
    return s[:-len(KEEP)] + f'Change only this about the makeup: {w}. ' + KEEP


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    jobs = []
    for k, (_w, ref, seed) in TATTOOS.items():
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        jobs.append((f'h34_tP_{k}', tP(), name, True, seed))
    for k, (w, seed) in T_WORDS.items():
        jobs.append((f'h34_tW_{k}', tW(w), SHEET, False, seed))
    for k, (w, seed) in M_WORDS.items():
        jobs.append((f'h34_mW_{k}', mW(w), SHEET, False, seed))
    for k, w in M_PIC.items():
        _w, ref, seed = PIC[k]
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        jobs.append((f'h34_mP_{k}', mP(w), name, True, seed))
    for k, w in T_PIC.items():
        jobs.append((f'h34_tPw_{k}', tPw(w), f'mpi1086_r31_{k}.png', True, TATTOOS[k][2]))
    for tag, text, ref, use_ref, seed in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': use_ref}, 'Input_Headless': {'boolean': False},
                             'Input_Is_Mannequin': {'boolean': True}})
