# Flow build phase 1: copies the Multi-angle Flow's per-stop files into the app (assets/flows/multi-angle/), named by
# stop = <turn>[_lo|_hi] (turn: front, tq_fl, tq_fr, pr_l, pr_r, tq_bl, tq_br, back).
# refs/room/  = the doll in its room, image 2 of a FLUX.3 step (turns + the front high)
# refs/plain/ = the doll on white, image 2 of a Qwen step (front low + every low/high on a turned stop) - round 30
# previews/   = the gizmo's Cosmo per stop (cosmo_cams.py), webp with alpha
# Usage: python ship_assets.py
import os
import shutil
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DST = os.path.join(HERE, *[os.pardir] * 6, 'assets', 'flows', 'multi-angle')
TURNS = ('front', 'tq_fl', 'tq_fr', 'pr_l', 'pr_r', 'tq_bl', 'tq_br', 'back')
CAM = {'back': 'back_eye'}  # stop -> ref camera name where they differ


def copy(src, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    shutil.copyfile(src, dst)


for t in TURNS:
    for h in ('', '_lo', '_hi'):
        stop = t + h
        if t != 'front' and h == '':
            copy(f'{HERE}/out/doll/{CAM.get(t, t)}.png', f'{DST}/refs/room/{stop}.png')
        elif stop == 'front_hi':
            copy(f'{HERE}/out/doll/front_hi.png', f'{DST}/refs/room/{stop}.png')
        elif h:
            copy(f'{HERE}/out/doll_plain/{stop}.png', f'{DST}/refs/plain/{stop}.png')
        os.makedirs(f'{DST}/previews', exist_ok=True)
        Image.open(f'{HERE}/out/cosmo/{stop}.png').save(f'{DST}/previews/{stop}.webp', quality=88, method=6)
