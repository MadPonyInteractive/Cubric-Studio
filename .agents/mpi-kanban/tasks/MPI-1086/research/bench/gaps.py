"""MPI-1086 r44 prototype: find a character sheet's panel cuts from its pixels (the back pass assumed 25 | 25 | 50 and
left a ghost arm on Character Sheet from Images sheets, Fabio's eye test flowCSE_052). A column is EMPTY when the
picture barely changes along it (plain backdrop, gradient or not); the cuts are the middles of the first two runs of
empty columns between figures. Writes a contact sheet with the cuts drawn (red) over the old quarters (blue).
usage: gaps.py <out.jpg> <sheet.png>...
"""
import sys
import numpy as np
from PIL import Image, ImageDraw

W = 448   # measured on a small copy: the app does the same on a canvas
SPREAD = 0.4
MIN_GAP = 6   # columns (of W): a narrow lull inside a figure (between an arm and the hair) is not a gap


def cuts(path):
    im = Image.open(path).convert('L')
    h = round(im.height * W / im.width)
    g = np.asarray(im.resize((W, h), Image.BILINEAR), dtype=float)
    # activity: how much the picture changes, vertically and horizontally, per column
    act = np.abs(np.diff(g, axis=0)).mean(0)
    act = np.maximum(act, np.pad(np.abs(np.diff(g, axis=1)).mean(0), (0, 1), mode='edge'))
    act = np.convolve(act, np.ones(5) / 5, mode='same')
    # ...and how far it strays from one colour top to bottom: a plain red dress barely changes along a column
    # (low activity) but is not the backdrop above and below it (CSE_001, CSE_011 cut through the figure)
    spread = np.convolve(g.std(0), np.ones(5) / 5, mode='same')
    empty = (act < 0.25 * np.percentile(act, 90)) & (spread < SPREAD * np.percentile(spread, 90))
    runs, x = [], 0
    while x < W:
        if empty[x]:
            s = x
            while x < W and empty[x]:
                x += 1
            if s > 0 and x < W:   # a gap BETWEEN things, not the margin
                runs.append((s, x))
        else:
            x += 1
    runs = [r for r in runs if r[1] - r[0] >= MIN_GAP]
    if len(runs) < 2:
        return None
    return [((a + b) / 2) / W for a, b in runs[:2]]


if __name__ == '__main__':
    out, files = sys.argv[1], sys.argv[2:]
    tw, th = 448, 280
    sheet = Image.new('RGB', (tw * 2, th * ((len(files) + 1) // 2)), 'white')
    for i, f in enumerate(files):
        c = cuts(f)
        print(f.split('/')[-1], 'cuts', None if c is None else [round(v, 3) for v in c])
        im = Image.open(f).convert('RGB').resize((tw, th))
        d = ImageDraw.Draw(im)
        for q in (0.25, 0.5):
            d.line([(q * tw, 0), (q * tw, th)], fill=(0, 0, 255), width=1)
        for v in c or []:
            d.line([(v * tw, 0), (v * tw, th)], fill=(255, 0, 0), width=2)
        d.text((4, 4), f.split('/')[-1] + ('' if c else ' NO CUTS'), fill=(255, 0, 0))
        sheet.paste(im, ((i % 2) * tw, (i // 2) * th))
    sheet.save(out, quality=85)
