"""MPI-1086 round 37: Fabio's TWO-PASS idea for the one-sided tattoo that flips sides on the back view. No single pass
sees two views of one side: pass 1 = the SHIPPED edit (tQ with a picture, tW in words) on the whole sheet, keeping its
front figure + close-up; pass 2 = the EDITED front figure alone (cropped from the 8:5 sheet, front | back | close-up =
25% | 25% | 50%) handed to the same Qwen graph as "this character seen from behind"; its result is pasted over the back
panel. Shipped Qwen graph, 25 steps, r35/r36 seeds.
  B1     pass 2 from the front figure alone, no tattoo words at all
  B2     pass 2 with the tattoo picture as image 2 (picture cases) or the tattoo words (words cases): a back-only
         tattoo (t_back) is invisible from the front, so B1 cannot know it
  Cases: t_leg1, t_leg2, w_roses, w_snake (the side flips) + controls t_neck, t_back.
usage: qh37.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN, KEEP
from qh27 import upload, MEDIA
from qh29 import SHEET
from qh34 import TATTOOS, tW
from qh35 import tQ
from qh36 import WORDS

qh26.URL = 'http://127.0.0.1:48188'
PICS = ('t_leg1', 't_leg2', 't_neck', 't_back')
PASS2 = (640, 1600)   # the 448 x 1120 front panel at 1 MP, same 2:5 shape
TURN = ('Turn the character in image 1 around so the character is seen from behind: the same person, hair, body, '
        'skin tone, clothes and shoes, standing in the same pose, full body from head to feet, on the same plain grey '
        'background.')


def b2_pic():
    return TURN + ' The character has the tattoos from image 2: show the ones that can be seen from behind. ' + KEEP


def b2_words(w):
    return TURN + f' The character has this tattoo: {w}. Show it wherever it can be seen from behind. ' + KEEP


def p1(out, tag, text, ref, use_ref, seed):
    f = f'{out}/{tag}_Output_Image_2.png'
    if not os.path.exists(f):
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': use_ref}, 'Input_Headless': {'boolean': False},
                             'Input_Is_Mannequin': {'boolean': True}})
    return f


def front(sheet_png, name):
    im = Image.open(sheet_png).convert('RGB')
    w, h = im.size
    im.crop((0, 0, w // 4, h)).resize(PASS2, Image.LANCZOS).save(name)
    return name


def paste(sheet_png, back_png, dst):
    im = Image.open(sheet_png).convert('RGB')
    w, h = im.size
    im.paste(Image.open(back_png).convert('RGB').resize((w // 4, h), Image.LANCZOS), (w // 4, 0))
    im.save(dst)


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    cases = []
    for k in PICS:
        w, ref, seed = TATTOOS[k]
        name = f'mpi1086_r31_{k}.png'
        upload(MEDIA + ref, name)
        cases.append((k, tQ(w), name, True, seed, b2_pic()))
    for k, (w, seed) in WORDS.items():
        cases.append((k, tW(w), SHEET, False, seed, b2_words(w)))
    for k, text, ref, use_ref, seed, b2 in cases:
        if only and not any(o in k for o in only):
            continue
        s1 = p1(out, f'h37_p1_{k}', text, ref, use_ref, seed)
        fr = f'mpi1086_r37_front_{k}.png'
        upload(front(s1, f'{out}/{fr}'), fr)
        for v, t2, r2, u2 in (('B1', TURN + ' ' + KEEP, fr, False), ('B2', b2, ref if use_ref else fr, use_ref)):
            tag = f'h37_{v}_{k}'
            if not os.path.exists(f'{out}/{tag}_Output_Image_2.png'):
                run(out, tag, QWEN, {'Input_Image': {'string': fr}, 'Input_Image_2': {'string': r2},
                                     'Input_Seed': {'int': seed}, 'Input_Positive': {'string': t2},
                                     'Input_Reference': {'boolean': u2}, 'Input_Headless': {'boolean': False},
                                     'Input_Is_Mannequin': {'boolean': True}})
            if os.path.exists(f'{out}/{tag}_Output_Image_2.png'):
                paste(s1, f'{out}/{tag}_Output_Image_2.png', f'{out}/{tag}_sheet.png')
