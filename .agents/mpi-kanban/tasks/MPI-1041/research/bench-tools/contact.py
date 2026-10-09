"""contact.py <dir> <out.jpg> <glob> [cols] - labelled grid of bench outputs, each scaled to 896 px wide."""
import glob, os, sys
from PIL import Image, ImageDraw

d, out, pat = sys.argv[1:4]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 2
files = sorted(glob.glob(os.path.join(d, pat)))
W = 896
ims = []
for f in files:
    im = Image.open(f).convert('RGB')
    ims.append((os.path.basename(f)[:-4], im.resize((W, round(im.height * W / im.width)))))
H = max(im.height for _, im in ims) + 28
rows = -(-len(ims) // cols)
sheet = Image.new('RGB', (cols * W, rows * H), 'white')
dr = ImageDraw.Draw(sheet)
for i, (tag, im) in enumerate(ims):
    x, y = (i % cols) * W, (i // cols) * H
    sheet.paste(im, (x, y + 28))
    dr.text((x + 6, y + 6), f'{tag}  {im.width}x{im.height}', fill='black')
sheet.save(out, quality=88)
print(out, len(ims), 'images')
