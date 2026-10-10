"""width.py <original sheet> <out.png>... - did a body-shape edit change the BODY? Mean foreground width (px, at the
sheet's own size) of the front panel (x 0-448) and the back panel (x 448-880) over the torso + thighs rows (32-62% of
the height), and of the portrait's neck + shoulders (bottom 25%, x 896-). Prints each output's change in % - a skinny
edit should go negative on all three, heavyset positive; a few % is noise from the hair and the hands."""
import sys
import numpy as np
from PIL import Image


def widths(path, size):
    a = np.asarray(Image.open(path).convert('RGB').resize(size), dtype=np.float32)
    grey = np.median(a[:40, :40].reshape(-1, 3), axis=0)
    fg = np.abs(a - grey).max(axis=2) > 28
    h = size[1]
    body = slice(int(h * .32), int(h * .62))
    return [fg[body, 0:448].sum(1).mean(), fg[body, 448:880].sum(1).mean(), fg[int(h * .75):, 896:].sum(1).mean()]


size = Image.open(sys.argv[1]).size
ref = widths(sys.argv[1], size)
print('original'.ljust(24), '  '.join(f'{k} {v:.0f}px' for k, v in zip(('front', 'back', 'portrait'), ref)))
for p in sys.argv[2:]:
    w = widths(p, size)
    print(p.replace('\\', '/').split('/')[-1][:-4].ljust(24),
          '  '.join(f'{k} {100 * (v - r) / r:+5.1f}%' for k, v, r in zip(('front', 'back', 'portrait'), w, ref)))
