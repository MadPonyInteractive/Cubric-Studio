"""python contact.py <rundir> <out.jpg> [variants] [cases]  -> rows = variants, columns = cases, each cell a sheet."""
import os, sys
from PIL import Image, ImageDraw

run, out = sys.argv[1], sys.argv[2]
rows = list(sys.argv[3] if len(sys.argv) > 3 else 'ABCD')
cols = (sys.argv[4] if len(sys.argv) > 4 else 'arms,boots,plain').split(',')
W, H, LBL = 720, 450, 60
sheet = Image.new('RGB', (LBL + W * len(cols), 30 + H * len(rows)), 'white')
d = ImageDraw.Draw(sheet)
for j, c in enumerate(cols):
    d.text((LBL + j * W + 10, 8), c, fill='black')
for i, r in enumerate(rows):
    d.text((20, 30 + i * H + H // 2), r, fill='black')
    for j, c in enumerate(cols):
        p = os.path.join(run, f'{r}_{c}.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB').resize((W - 6, H - 6))
            sheet.paste(im, (LBL + j * W + 3, 30 + i * H + 3))
sheet.save(out, quality=85)
print(out)
