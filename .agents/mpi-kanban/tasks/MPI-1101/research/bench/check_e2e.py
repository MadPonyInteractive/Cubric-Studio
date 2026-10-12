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


# The band EDGES, not only the wrap: a wrap at 1.2-1.35 still failed Fabio's eye because each band edge showed as a
# vertical line. Per row, |mean of 16 columns one side - 16 the other|, worst within 96 px of the edge, over the same
# statistic at 600 ordinary columns; then over the SOURCE's own value there (1.00 = the paste added no line).
# Calibrated on the run Fabio failed (32 px feather): 1.61 / 1.34.
def luma(a):
    return a.astype(np.float32) @ np.array([0.299, 0.587, 0.114], np.float32)


def jump(L, x, k=16):
    return np.abs(L[:, x:x + k].mean(axis=1) - L[:, x - k:x].mean(axis=1)).mean()


def edge(L, e, scan=96):
    xs = np.random.default_rng(0).integers(hi + scan + 16, lo - scan - 16, 600)
    return max(jump(L, x) for x in range(e - scan, e + scan, 4)) / np.median([jump(L, x) for x in xs])


Ls, Lr = luma(src), luma(res)
for e in (hi, lo):
    print('band edge x=%d: line %.2f (result %.2f / source %.2f)' % (e, edge(Lr, e) / edge(Ls, e), edge(Lr, e), edge(Ls, e)))
h = res.shape[0]
join = np.concatenate([res[:, w - 1024:], res[:, :1024]], axis=1).astype(np.uint8)
Image.fromarray(join).resize((1024, h * 1024 // 2048)).save(sys.argv[3], quality=90)
