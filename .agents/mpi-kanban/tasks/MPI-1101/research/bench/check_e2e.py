"""MPI-1101 Phase 4 check: a Make seamless result against its source, left-right at 10 % a side.
usage: check_e2e.py <source.png> <result.png> <out sheet.jpg>
Prints size match, max change outside the band (must be 0) and the wrap ratio (~1 = seamless) before/after,
and writes a 2x tiled strip of the join (the result's right edge against its left edge) at 1:1."""
import sys
import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
src = np.asarray(Image.open(sys.argv[1]).convert('RGB')).astype(np.int16)
res = np.asarray(Image.open(sys.argv[2]).convert('RGB')).astype(np.int16)
print('size', src.shape[1::-1], res.shape[1::-1], 'MATCH' if src.shape == res.shape else 'MISMATCH')
w = src.shape[1]
lo, hi = w - round(0.1 * w), round(0.1 * w)  # band = [lo, w) U [0, hi) in source columns (bandRange: 3277..4915 rolled)
inner = np.abs(res[:, hi:lo] - src[:, hi:lo])
print('outside band: columns %d..%d, max change %d' % (hi, lo, inner.max()))


def wrap(a):
    a = a.astype(np.float32)
    return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()


print('wrap ratio source %.2f -> result %.2f' % (wrap(src), wrap(res)))
h = res.shape[0]
join = np.concatenate([res[:, w - 1024:], res[:, :1024]], axis=1).astype(np.uint8)
Image.fromarray(join).resize((1024, h * 1024 // 2048)).save(sys.argv[3], quality=90)
