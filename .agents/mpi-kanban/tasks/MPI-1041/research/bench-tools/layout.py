"""layout.py <original sheet> <out.png>... - does an edit keep the sheet's LAYOUT (front | back | portrait = 1/4 | 1/4 | 1/2)?
Everything is measured on the sheet's own size, from the pixels that are not the flat grey backdrop:
  seam%  = foreground in the 32-px band at the body / portrait seam (x 880-912); the original is 0
  front / back = horizontal centre of the head (rows 40-200) inside x 0-448 / 448-1000
  portrait = left edge of the portrait's hair (rows 0-150, searched from x 1000: right of any back head)
Prints the original, then each output's shift from it in sheet pixels."""
import sys
import numpy as np
from PIL import Image


def measure(path, size):
    a = np.asarray(Image.open(path).convert('RGB').resize(size), dtype=np.float32)
    grey = np.median(a[:40, :40].reshape(-1, 3), axis=0)
    fg = np.abs(a - grey).max(axis=2) > 28

    def centre(x0, x1):
        cols = np.where(fg[40:200, x0:x1].any(axis=0))[0]
        return x0 + (cols[0] + cols[-1]) / 2 if len(cols) else float('nan')

    cols = np.where(fg[0:150, 1000:].sum(axis=0) > 20)[0]
    return {'seam%': 100 * fg[:, 880:912].mean(), 'front': centre(0, 448), 'back': centre(448, 1000),
            'portrait': 1000 + cols[0] if len(cols) else float('nan')}


size = Image.open(sys.argv[1]).size
ref = measure(sys.argv[1], size)
print('original'.ljust(22), '  '.join(f'{k} {v:.0f}' for k, v in ref.items()))
for p in sys.argv[2:]:
    m = measure(p, size)
    name = p.replace('\\', '/').split('/')[-1][:-4]
    print(name.ljust(22), f"seam% {m['seam%']:4.0f}", '  '.join(f'{k} {m[k] - ref[k]:+5.0f}' for k in ('front', 'back', 'portrait')))
