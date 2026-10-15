"""MPI-1086 round 36: a one-sided tattoo lands on the wrong side seen from behind (Fabio: her LEFT leg in front, her
RIGHT leg from behind - the back view copies the picture's side instead of the body's). A side-keeping line that names
NO limb (r32's "the same arm or leg" ADDED sleeves). Shipped Qwen graph, 25 steps.
  A      "Each tattoo stays on the same side of the character's body ... a tattoo on the right of the front view is on
         the left of the character seen from behind."
  B      generic, usable by Accessories too: "The character seen from behind is not a mirror image of the front view:
         anything on one side of the character's body stays on that side ..."
  Cases: tattoo pictures leg1 + leg2 (the misses) and neck + back (controls: no invented ink), tattoos in words (left-
  arm roses, a right-leg snake); Accessories in words, a watch on the left wrist, with B and without.
usage: qh36.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN
from qh27 import upload, MEDIA
from qh29 import SHEET
from qh30 import qw2
from qh34 import TATTOOS, tW
from qh35 import tQ

qh26.URL = 'http://127.0.0.1:48188'
SIDE = {
    'A': ("Each tattoo stays on the same side of the character's body in every view: seen from behind, the character's "
          'left side is on the left of the picture, so a tattoo on the right of the front view is on the left of the '
          'character seen from behind.'),
    'B': ("The character seen from behind is not a mirror image of the front view: anything on one side of the "
          "character's body stays on that side, so seen from behind it is on the other side of the picture."),
}
WORDS = {
    'w_roses': ('a full sleeve tattoo of black roses on the left arm', 31102),
    'w_snake': ('a black snake tattoo on the right leg', 36001),
}
ACC = ('a silver watch on the left wrist', 36101)


def put(s, mark, line):
    i = s.index(mark)
    return s[:i] + ' ' + line + s[i:]


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    upload(MEDIA + 'flowCSE_044.png', SHEET)
    jobs = []
    for v, line in SIDE.items():
        for k in ('t_leg1', 't_leg2', 't_neck', 't_back'):
            w, ref, seed = TATTOOS[k]
            name = f'mpi1086_r31_{k}.png'
            upload(MEDIA + ref, name)
            jobs.append((f'h36_{v}_{k}', put(tQ(w), ' Take only', line), name, True, seed))
        for k, (w, seed) in WORDS.items():
            jobs.append((f'h36_{v}_{k}', put(tW(w), " Keep the character's", line), SHEET, False, seed))
    w, seed = ACC
    jobs.append(('h36_acc0_watch', qw2(w), SHEET, False, seed))
    jobs.append(('h36_accB_watch', put(qw2(w), " Keep the character's", SIDE['B']), SHEET, False, seed))
    for tag, text, ref, use_ref, seed in jobs:
        if (only and not any(tag.startswith(o) for o in only)) or any(
                f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
            continue
        run(out, tag, QWEN, {'Input_Image': {'string': SHEET}, 'Input_Image_2': {'string': ref},
                             'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                             'Input_Reference': {'boolean': use_ref}, 'Input_Headless': {'boolean': False},
                             'Input_Is_Mannequin': {'boolean': True}})
