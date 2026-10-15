"""MPI-1086 round 31: Makeup and Tattoos through the SHIPPED Accessories route (Qwen-Image 2.1, 30 steps), Fabio's
13 pictures (imported_020-033), sheet flowCSE_044. Decides whether Accessories splits (Fabio: Accessories / Weapons /
Jewellery / Makeup / Tattoos).
  pic    picture + short words, r29 q_raw (= the builder, proven byte-identical in r30): watch the picture's FACE
         leaking with makeup ("keep the character's own face" vs a face-borne thing), and tattoos reaching the back view
  words  no picture, r30 qw2 (= the builder): "this accessory to wear or hold" said of makeup and a tattoo
usage: qh31.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN
from qh27 import upload, MEDIA
from qh29 import SHEET, q_raw
from qh30 import qw2

qh26.URL = 'http://127.0.0.1:48188'
PIC = {   # tag: (words, reference, seed)
    't_neck': ('Neck and chest tattoos', 'imported_020.jpg', 31020),
    't_back': ('Back tattoos', 'imported_021.jpg', 31021),
    't_body': ('Full body tattoos', 'imported_022.jpg', 31022),
    't_all': ('Tattoos', 'imported_023.jpg', 31023),
    't_leg1': ('Leg tattoo', 'imported_030.jpg', 31030),
    't_leg2': ('Leg tattoo', 'imported_031.jpg', 31031),
    'm_spider': ('Makeup', 'imported_024.jpg', 31024),
    'm_liner': ('Makeup', 'imported_025.jpg', 31025),
    'm_glitter': ('Makeup', 'imported_026.jpg', 31026),
    'm_glam': ('Makeup', 'imported_027.jpg', 31027),
    'm_gems': ('Makeup', 'imported_028.jpg', 31028),
    'm_goth': ('Makeup', 'imported_032.jpg', 31032),
    'm_lashes': ('Makeup', 'imported_033.jpg', 31033),
}
WORDS = {
    'w_makeup': ('dark gothic makeup with smoky eyes and black lipstick', 31101),
    'w_tattoo': ('a full sleeve tattoo of black roses on the left arm', 31102),
}

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    jobs = []
    for k, (w, ref, seed) in PIC.items():
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        jobs.append((f'h31_pic_{k}', q_raw(w), name, True, seed))
    for k, (w, seed) in WORDS.items():
        jobs.append((f'h31_words_{k}', qw2(w), SHEET, False, seed))
    for tag, text, ref, use_ref, seed in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': use_ref}, 'Input_Headless': {'boolean': False},
                             'Input_Is_Mannequin': {'boolean': True}})
