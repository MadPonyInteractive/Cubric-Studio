"""MPI-1086 round 29: Accessories with a Reference picture. Fabio's eye test 4: on sheet flowCSE_044 the shipped AW3
string (Klein, lock 0) redrew the FRONT figure as a second back view 4/4, and a person in the reference leaked in
(her face on "Piercings and Choker", her green hair on "Mask"). His four runs, his seeds, his words as typed:
  k_ship   Klein, AW3 as shipped                                  = the repro
  k_front  Klein, AW3 + a sentence keeping the front figure facing forward
  q_raw    Qwen-Image 2.1, the reference straight in as image 2 (Input_Is_Mannequin skips the mannequin pass),
           every figure named, only the thing taken from image 2
usage: qh29.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, KLEIN, QWEN, KEEP
from qh27 import upload, MEDIA

qh26.URL = 'http://127.0.0.1:48188'
OWN = "Keep the character's own face, hair and clothes."
SHEET = 'mpi1086_cs44.png'
CASES = {   # tag: (words as typed, reference, seed)
    'mask': ('Mask', 'imported_019.jpg', 1399125883),
    'gun': ('Mini gun', 'imported_016.jpg', 2512058707),
    'jewel': ('Earrings and necklaces', 'imported_014.jpg', 2097754628),
    'pierce': ('Piercings and Choker', 'imported_015.jpg', 4015228798),
}


def k_ship(w):
    return (f'Give the character {w} from the reference picture. Make the same change on the character seen from '
            f'behind and in the close-up portrait on the right. {OWN} {KEEP}')


def k_front(w):
    return (f'Give the character {w} from the reference picture. The front view on the left still faces forward, '
            "showing the character's face. Make the same change on the character seen from behind and in the close-up "
            f'portrait on the right. {OWN} {KEEP}')


def q_raw(w):
    w = w[0].lower() + w[1:]
    return (f'Give the character in image 1 the {w} from image 2. The front view, the character seen from behind and '
            f'the close-up portrait on the right all show the {w} wherever it can be seen. Take only the {w} from '
            "image 2, not the person: keep the character's own face, hair, skin and clothes. " + KEEP)


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    for k, (_, ref, _) in CASES.items():
        upload(MEDIA + ref, f'mpi1086_r29_{k}.png')
    for name, api, f in (('k_ship', KLEIN, k_ship), ('k_front', KLEIN, k_front), ('q_raw', QWEN, q_raw)):
        for k, (w, _, seed) in CASES.items():
            tag = f'h29_{name}_{k}'
            if (only and not any(tag.startswith(o) for o in only)) or any(
                    f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
                continue
            ins = {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': f'mpi1086_r29_{k}.png'},
                   'Input_Seed': {'int': seed}, 'Input_Positive': {'string': f(w)},
                   'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': False}}
            if api == KLEIN:
                ins['Input_Lock'] = {'int': 0}
            else:
                ins['Input_Is_Mannequin'] = {'boolean': True}
            run(out, tag, api, ins)
