"""height.py <original sheet> <out.png>... - did an age edit change the FIGURE'S SIZE? Per full-body panel (front x 0-448,
back x 448-880), the top and bottom foreground rows (the head top and the feet) and the height between them, at the
sheet's own size; prints each output's height change in % and the head-top shift in px (positive = lower = shorter)."""
import sys
import numpy as np
from PIL import Image


def spans(path, size):
    a = np.asarray(Image.open(path).convert('RGB').resize(size), dtype=np.float32)
    grey = np.median(a[:40, :40].reshape(-1, 3), axis=0)
    fg = np.abs(a - grey).max(axis=2) > 28
    out = []
    for x0, x1 in ((0, 448), (448, 880)):
        rows = np.where(fg[:, x0:x1].sum(axis=1) > 6)[0]
        out.append((rows[0], rows[-1]))
    return out


size = Image.open(sys.argv[1]).size
ref = spans(sys.argv[1], size)
print('original'.ljust(26), '  '.join(f'{k} top {t} feet {b} h {b - t}px' for k, (t, b) in zip(('front', 'back'), ref)))
for p in sys.argv[2:]:
    s = spans(p, size)
    print(p.replace('\\', '/').split('/')[-1][:-4].ljust(26), '  '.join(
        f'{k} h {100 * ((b - t) - (rb - rt)) / (rb - rt):+5.1f}% top {t - rt:+4d}'
        for k, (t, b), (rt, rb) in zip(('front', 'back'), s, ref)))
