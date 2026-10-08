import sys
from PIL import Image
# crop45.py <src> <dst> <x0> <y0> <width>  -> a 4:5 (portrait panel aspect) crop, height = width * 5/4
src, dst, x0, y0, w = sys.argv[1], sys.argv[2], *map(int, sys.argv[3:6])
h = w * 5 // 4
im = Image.open(src).convert('RGB')
assert x0 + w <= im.width and y0 + h <= im.height, (im.size, x0, y0, w, h)
im.crop((x0, y0, x0 + w, y0 + h)).save(dst)
print(dst, (w, h))
