# The SOFT previews' decals (Fabio 2026-10-25): the art crops carry a drawn outline round their edge and a flat pink
# fill, which read as a sticker on the lit plastic. Copies with both cut out: the pink goes transparent (soft edge, so
# the plastic shows through and is lit like the rest), and every dark pixel CONNECTED to the edge goes too - the outer
# outline, its thicker rounded corners, and the collar's outline, which joins it at the top. Lines that pink separates
# from the edge stay: the screen frame, face, logo and the inner panel lines. Writes out/cosmo_tex/{head,torso}_soft.png;
# the originals stay as they are (cosmo_build.py uses them).
# Usage: python soft_tex.py
import os
from collections import deque
from PIL import Image

TEX = os.path.dirname(os.path.abspath(__file__)) + '/out/cosmo_tex/'
PINK = (165, 115, 115)
DARK = 330  # r+g+b below this is outline (the outline is ~(42,10,23), its blend into the pink ~(103,59,67))


def soft(name):
    im = Image.open(TEX + name + '.png').convert('RGBA')
    w, h = im.size
    px = im.load()
    dark = lambda x, y: sum(px[x, y][:3]) < DARK  # noqa: E731
    edge = deque((x, y) for x in range(w) for y in (0, h - 1)) + deque((x, y) for y in range(h) for x in (0, w - 1))
    gone = set(p for p in edge if dark(*p))
    todo = deque(gone)
    while todo:
        x, y = todo.popleft()
        for n in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= n[0] < w and 0 <= n[1] < h and n not in gone and dark(*n):
                gone.add(n)
                todo.append(n)
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            d = ((r - PINK[0]) ** 2 + (g - PINK[1]) ** 2 + (b - PINK[2]) ** 2) ** 0.5
            keep = 0.0 if (x, y) in gone else min(1.0, max(0.0, (d - 22) / 22))  # pink -> 0, a line or cream -> 1
            px[x, y] = (r, g, b, int(a * keep))
    im.save(TEX + name + '_soft.png')
    print('wrote', TEX + name + '_soft.png')


for n in ('head', 'torso'):
    soft(n)
