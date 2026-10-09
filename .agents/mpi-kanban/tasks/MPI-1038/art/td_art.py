"""Tile Detailer art: the REAL tile layout + cloud masks of the shipped graph, re-run in numpy.

Mirrors Impact Pack 429d0159: segs_nodes.MakeTileSEGS.doit (bbox 1024, crop 1.5, overlap 200,
irregularity 0.7, "Reuse fast"), core.random_mask_raw, core.adaptive_mask_paste,
utils.make_crop_region. The mask is random per run in ComfyUI too; a fixed seed here.
"""
import math
import numpy as np
from PIL import Image

SRC = 'D:/WORK/Images/Outputs/mpi623_cartoon/village_00001_.png'
OUT = 'D:/WORK/Images/Outputs/mpi1038/g1024_village_x2_00001_.png'


def random_mask_raw(mask, size, irr, rng):
    factor = max(6, int(size * irr / 4))

    def circle(i, j, r):
        for x in range(int(i - r), int(i + r)):
            for y in range(int(j - r), int(j + r)):
                if (x - i) ** 2 + (y - j) ** 2 <= r * r:
                    mask[x, y] = 1

    def line(start, end, pivot, vertical):
        step = (end - start) // 16
        for s in range(start, end, step):  # Impact splits each line into 16 threads
            i, e = s, min(s + step, end)
            while i < e:
                r = int(rng.integers(5, factor))
                circle(i, pivot, r) if vertical else circle(pivot, i, r)
                i += r

    lo, hi = factor, size - factor
    line(lo, hi, lo, True); line(lo, hi, hi, True)
    line(lo, hi, lo, False); line(lo, hi, hi, False)
    mask[lo:hi, lo:hi] = 1.0


def tiles(iw, ih, bbox=1024, crop=1.5, ov=200, irr=0.7, seed=7):
    rng = np.random.default_rng(seed)
    cache = np.zeros((128, 128), np.float32)
    random_mask_raw(cache, 128, irr, rng)
    comp = max(6, int(128 * irr / 4)); ov += comp; bbox += comp * 2
    bbox = min(bbox, iw, ih)
    nh = math.ceil(iw / (bbox - ov)); nv = math.ceil(ih / (bbox - ov))
    ws = bbox * nh - iw
    if ws < 0: nh += 1; ws = bbox * nh - iw
    wo = 0 if nh == 1 else int(ws / (nh - 1))
    hs = bbox * nv - ih
    if hs < 0: nv += 1; hs = bbox * nv - ih
    ho = 0 if nv == 1 else int(hs / (nv - 1))
    if wo == bbox: nh = 1
    if ho == bbox: nv = 1

    def norm(limit, s, size):
        if s < 0: return 0, int(min(limit, size))
        if s + size > limit: return int(max(0, limit - size)), limit
        return int(s), int(min(limit, s + size))

    out = []
    y = 0
    for _ in range(nv):
        x = 0
        for _ in range(nh):
            x1, x2 = (x, x + bbox) if x + bbox < iw - 1 else (iw - bbox, iw)
            y1, y2 = (y, y + bbox) if y + bbox < ih - 1 else (ih - bbox, ih)
            cx1, cx2 = norm(iw, int(x1 + bbox / 2 - bbox * crop / 2), bbox * crop)
            cy1, cy2 = norm(ih, int(y1 + bbox / 2 - bbox * crop / 2), bbox * crop)
            m = np.zeros((cy2 - cy1, cx2 - cx1), np.float32)
            l, t, r, b = x1 - cx1, y1 - cy1, x2 - cx1, y2 - cy1
            m[t:b, l:r] = np.asarray(Image.fromarray(cache).resize((r - l, b - t), Image.BILINEAR))
            if l == 0: m[t:b, :int((x2 - x1) / 8)] = 1.0
            if t == 0: m[:int((y2 - y1) / 8), l:r] = 1.0
            if r == m.shape[1]: m[t:b, -int((x2 - x1) / 8):] = 1.0
            if b == m.shape[0]: m[-int((y2 - y1) / 8):, l:r] = 1.0
            full = np.zeros((ih, iw), np.float32)
            full[cy1:cy2, cx1:cx2] = m
            out.append({'bbox': (x1, y1, x2, y2), 'crop': (cx1, cy1, cx2, cy2), 'mask': full})
            x += bbox - wo
        y += bbox - ho
    return out


if __name__ == '__main__':
    ts = tiles(2688, 1536)
    print(len(ts), [t['bbox'] for t in ts])
    assert len(ts) == 8
    union = np.maximum.reduce([t['mask'] for t in ts])
    print('uncovered px:', int((union < 0.5).sum()))
