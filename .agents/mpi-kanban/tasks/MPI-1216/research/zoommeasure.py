# Zoom of each chained edit vs the original: find the crop box (scale s, centre cx, cy) of the
# ORIGINAL that, resized to full frame, best matches the edit. s > 1 = edit is zoomed IN.
# Usage: python zoommeasure.py original.png edit1.png edit2.png ...
import sys
import numpy as np
from PIL import Image

W, H = 272, 480


def gray(path, box=None):
    im = Image.open(path).convert('L')
    if box:
        im = im.crop(box)
    return np.asarray(im.resize((W, H), Image.BILINEAR), dtype=np.float32)


orig = Image.open(sys.argv[1]).convert('L')
ow, oh = orig.size
P = int(0.1 * max(ow, oh))  # grey border so a zoom-out / shifted box stays inside
padded = Image.new('L', (ow + 2 * P, oh + 2 * P), 128)
padded.paste(orig, (P, P))
o_small = None
for path in sys.argv[2:]:
    e = gray(path)
    best = None
    for s in np.arange(0.97, 1.12, 0.004):
        cw, ch = ow / s, oh / s
        for dx in np.linspace(-0.03, 0.03, 13):
            for dy in np.linspace(-0.03, 0.03, 13):
                cx, cy = ow / 2 + dx * ow, oh / 2 + dy * oh
                box = (P + cx - cw / 2, P + cy - ch / 2, P + cx + cw / 2, P + cy + ch / 2)
                c = np.asarray(padded.resize((W, H), Image.BILINEAR, box=box), dtype=np.float32)
                err = float(np.mean(np.abs(c - e)))
                if best is None or err < best[0]:
                    best = (err, s, dx, dy)
    err, s, dx, dy = best
    print(f'{path.rsplit("/", 1)[-1]}: zoom x{s:.3f}  shift {dx*100:+.1f}% {dy*100:+.1f}%  (err {err:.1f})')
