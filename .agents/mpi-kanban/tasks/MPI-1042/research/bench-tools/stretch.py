import sys, cv2, numpy as np
# stretch.py <src> <out> <x0,y0,x1,y1> [more outs...]   (bench python: cv2.  HP=1 for a re-lit copy, MAXS=2.3 for a zoomed one)
# Coarse-to-fine: best separate x/y scale of the source face crop
# inside the output's right-half (portrait) panel. sx/sy ~1.0 = no stretch; ncc = how closely it copied.
import os
HP = os.environ.get('HP')  # HP=1: match high-passed images, so a re-lit copy still matches


def load(p):
    im = cv2.imread(p, cv2.IMREAD_GRAYSCALE)
    if HP:
        f = im.astype(np.float32)
        im = cv2.normalize(f - cv2.GaussianBlur(f, (0, 0), 6), None, 0, 255, cv2.NORM_MINMAX).astype(np.uint8)
    return im


src = load(sys.argv[1])
x0, y0, x1, y1 = [int(v) for v in sys.argv[3].split(',')]
face = src[y0:y1, x0:x1]


def best(panel, f, sxs, sys_):
    top = (-1, 0, 0, None)
    for sx in sxs:
        for sy in sys_:
            tpl = cv2.resize(f, (max(8, int(f.shape[1] * sx)), max(8, int(f.shape[0] * sy))), interpolation=cv2.INTER_AREA)
            if tpl.shape[0] >= panel.shape[0] or tpl.shape[1] >= panel.shape[1]:
                continue
            _, v, _, loc = cv2.minMaxLoc(cv2.matchTemplate(panel, tpl, cv2.TM_CCOEFF_NORMED))
            if v > top[0]:
                top = (v, sx, sy, loc)
    return top


for o in [sys.argv[2]] + sys.argv[4:]:
    out = load(o)
    panel = out[:, out.shape[1] // 2:] if out.shape[1] > out.shape[0] else out  # a sheet's right half, or a lone portrait
    half_p = cv2.resize(panel, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    half_f = cv2.resize(face, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    grid = np.arange(0.5, float(os.environ.get('MAXS', 1.8)), 0.04)
    v, sx, sy, _ = best(half_p, half_f, grid, grid)
    v, sx, sy, loc = best(panel, face, np.arange(sx - 0.04, sx + 0.041, 0.01), np.arange(sy - 0.04, sy + 0.041, 0.01))
    print('%-28s ncc %.3f  sx %.2f  sy %.2f  sx/sy %.3f  at %s' % (o.replace('\\', '/').split('/')[-1], v, sx, sy, sx / sy, loc), flush=True)
