# Colour stats of images vs the first: mean Lab, chroma, HSV sat, per region.
# usage: python colour.py img1 img2 ...   (regions: whole, left40)
import sys, numpy as np
from PIL import Image
sys.stdout.reconfigure(encoding='utf-8')


def lab(rgb):
    c = rgb / 255.0
    c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def stats(p, reg):
    a = np.asarray(Image.open(p).convert('RGB'), dtype=np.float64)
    h, w, _ = a.shape
    if reg == 'left40':
        a = a[:, : int(w * 0.4)]
    L = lab(a)
    mx, mn = a.max(-1), a.min(-1)
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    ch = np.hypot(L[..., 1], L[..., 2])
    return np.array([L[..., 0].mean(), L[..., 1].mean(), L[..., 2].mean(), ch.mean(), sat.mean() * 100, L[..., 0].std()])


for reg in ('whole', 'left40'):
    print(f'-- {reg}:            L      a      b chroma   sat%   Lstd | dE vs prev, vs first')
    first = prev = None
    for p in sys.argv[1:]:
        s = stats(p, reg)
        first = s if first is None else first
        d = lambda o: np.linalg.norm(s[:3] - o[:3])
        print(f'{p.replace(chr(92), "/").split("/")[-1]:14s}', ' '.join(f'{v:6.2f}' for v in s),
              f'| {d(prev) if prev is not None else 0:5.2f} {d(first):5.2f}')
        prev = s
