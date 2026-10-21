# Undo the edit's grade drift using only the pixels the edit left alone.
# Fit an affine RGB map out->in on "unchanged" pixels (small local difference), apply it to all.
# usage: python regrade.py PREFIX in.png out1.png out2.png ...  (chained: each out matched to the
# previous corrected picture, as the app would feed it)
import sys, numpy as np
from PIL import Image, ImageFilter
S = 'C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/5499a12a-9d36-4bc1-b229-4b8966f5efec/scratchpad/'
ld = lambda p: np.asarray(Image.open(p).convert('RGB'), dtype=np.float64) / 255
blur = lambda a: np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)), dtype=np.float64) / 255


def regrade(out, ref):
    # unchanged = low-frequency difference small; ponytail: fixed threshold, the 60th percentile
    # of the difference, so at least 60% of the frame always feeds the fit.
    d = np.abs(blur(out) - blur(ref)).sum(-1)
    keep = d <= np.percentile(d, 60)
    X = np.c_[out[keep], np.ones(keep.sum())]
    W, *_ = np.linalg.lstsq(X, ref[keep], rcond=None)
    return np.clip(np.c_[out.reshape(-1, 3), np.ones(out.shape[0] * out.shape[1])] @ W, 0, 1).reshape(out.shape), keep.mean()


prefix, prev = sys.argv[1], ld(sys.argv[2])
for i, f in enumerate(sys.argv[3:], 1):
    fixed, frac = regrade(ld(f), prev)
    Image.fromarray((fixed * 255).round().astype(np.uint8)).save(S + f'{prefix}{i}.png')
    prev = fixed
    print(prefix, i, 'fit on', round(frac * 100), '% of pixels')
