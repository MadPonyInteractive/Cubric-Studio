# Side-grading aid (round 55): head-and-shoulders crops, large enough to read which way a face points.
#   python heads.py <out.jpg> <cols> <label=url-or-path> ...
import sys
from PIL import Image, ImageDraw
import angles as a

out, cols, items = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
W, H = 220, 250
s = Image.new('RGB', (W * cols, H * ((len(items) + cols - 1) // cols)), 'white')
d = ImageDraw.Draw(s)
for i, it in enumerate(items):
    label, src = it.split('=', 1)
    im = Image.open(a.disk(src) if 'path=' in src else src).convert('RGB')
    w, h = im.size
    im = im.crop((int(w * .1), int(h * .02), int(w * .9), int(h * .5))).resize((W - 6, H - 22))
    x, y = (i % cols) * W, (i // cols) * H
    s.paste(im, (x, y + 18)); d.text((x + 2, y + 2), label, fill='black')
s.save(out)
