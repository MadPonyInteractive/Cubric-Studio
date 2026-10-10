"""pairs.py <out.jpg> <original> <edit>... - the original sheet above each edit, all at 896 px wide, labelled, so a body /
age change is judged against what was there (a contact sheet of edits alone hides a change that did not happen)."""
import os, sys
from PIL import Image, ImageDraw

out, files = sys.argv[1], sys.argv[2:]
W = 896
ims = [(os.path.basename(f)[:-4], Image.open(f).convert('RGB')) for f in files]
ims = [(t, im.resize((W, round(im.height * W / im.width)))) for t, im in ims]
H = sum(im.height + 24 for _, im in ims)
sheet = Image.new('RGB', (W, H), 'white')
dr, y = ImageDraw.Draw(sheet), 0
for t, im in ims:
    dr.text((6, y + 5), t, fill='black')
    sheet.paste(im, (0, y + 24))
    y += im.height + 24
sheet.save(out, quality=90)
