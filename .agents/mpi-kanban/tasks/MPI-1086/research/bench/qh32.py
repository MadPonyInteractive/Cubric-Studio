"""MPI-1086 round 32: fixes for r31's two misses, on the SHIPPED Qwen editor graph (now 25 steps).
  mA     makeup WITH the picture, a face-keeping string: the makeup named part by part, the character's own face named
         part by part, nothing else from image 2 (r31: 5/7 close-ups took the reference woman's face, 3/7 her piercings)
  mB     makeup put into WORDS, no picture (the Hairstyle route: a describer reads the picture). The descriptions are
         written here by hand to stand in for the describer (no paid call); run through the shipped words string (qw2)
  tS     tattoos with a same-limb sentence (r31: the back view mirrored a one-limb tattoo 2/3, or left a view bare)
usage: qh32.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh27 import upload, MEDIA
from qh29 import SHEET, q_raw
from qh30 import qw2
from qh31 import PIC, WORDS

qh26.URL = 'http://127.0.0.1:48188'
MAKEUP = {k: v for k, v in PIC.items() if k.startswith('m_')}
DESC = {   # what a describer would answer: "Describe only the makeup ..."
    'm_spider': 'black spider-web face paint spreading from the forehead over the eyes and down the cheeks, bright orange '
                'eyeshadow and black lipstick with an orange inner lip',
    'm_liner': 'a sharp black winged eyeliner with long lashes, contoured cheeks with a glowing highlight, and nude lips '
               'overlined with a black lip liner',
    'm_glitter': 'silver glitter eyeshadow with rhinestones along the lower lashes, glossy dewy skin with glitter on the '
                 'cheekbones, and glossy black-brown lipstick',
    'm_glam': 'a soft brown smoky eye with a sharp black wing and long lashes, bronzed contour and blush, a strong '
              'highlight on the cheekbones, and glossy nude-brown lips',
    'm_gems': 'a black graphic winged liner traced with small silver rhinestones, long lashes, glowing contoured skin, '
              'and glossy plum-red lipstick',
    'm_goth': 'a heavy black smoky eye with a sharp wing and thick lashes, defined dark brows, contoured cheeks, and matte '
              'deep purple lipstick',
    'm_lashes': 'warm orange-peach eyeshadow, long spiky false lashes, and nude lips with a dark brown lip liner',
}
SIDE = ('Seen from behind, a tattoo is on the same arm or leg as on the front view, so it shows on the other side of the '
        'picture. ')


def mA(_w):
    return ('Give the character in image 1 the makeup from image 2: its eyeshadow, eyeliner, lashes, blush, lipstick and '
            'any face paint. Put it on the face of the character in image 1, who stays the same person: the same face '
            'shape, eyes, nose, lips, eyebrows, skin tone and expression. Take nothing else from image 2: no piercings, '
            'jewellery, moles or hair. The front view and the close-up portrait on the right both show the makeup. '
            + KEEP)


def side(s):
    return s[:-len(KEEP)] + SIDE + KEEP


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    jobs = []
    for k, (w, ref, seed) in MAKEUP.items():
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        jobs.append((f'h32_mA_{k}', mA(w), name, True, seed))
        jobs.append((f'h32_mB_{k}', qw2(DESC[k]), SHEET, False, seed))
    for k in ('t_leg1', 't_leg2'):
        w, ref, seed = PIC[k]
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        jobs.append((f'h32_tS_{k}', side(q_raw(w)), name, True, seed))
    w, seed = WORDS['w_tattoo']
    jobs.append(('h32_tS_w_tattoo', side(qw2(w)), SHEET, False, seed))
    for tag, text, ref, use_ref, seed in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': use_ref}, 'Input_Headless': {'boolean': False},
                             'Input_Is_Mannequin': {'boolean': True}})
