"""Face grid for eyeballing likeness across bench_run.py configs.
Usage: python faces.py OUT.png TAGDIR [TAGDIR ...]
Rows = every <job>_<mode>_s<seed> found in the first TAGDIR; columns = the TAGDIRs, labelled by folder name.
A cell missing from a column stays dark."""
import glob, os, sys
from PIL import Image, ImageDraw

out, dirs = sys.argv[1], sys.argv[2:]
rows = sorted(os.path.basename(f)[:-len('_face.png')] for f in glob.glob(os.path.join(dirs[0], '*_face.png')))
C, L = 384, 24  # cell size, label strip
sheet = Image.new('RGB', (len(dirs) * C, L + len(rows) * (C + L)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
for ci, tagdir in enumerate(dirs):
    d.text((ci * C + 6, 6), os.path.basename(os.path.normpath(tagdir)), fill=(255, 220, 80))
    for ri, row in enumerate(rows):
        y = L + ri * (C + L)
        d.text((ci * C + 6, y + 6), row, fill=(200, 200, 200))
        f = os.path.join(tagdir, row + '_face.png')
        if os.path.exists(f):
            sheet.paste(Image.open(f).convert('RGB').resize((C, C), Image.LANCZOS), (ci * C, y + L))
sheet.save(out)
print(out, sheet.size, len(rows), 'rows x', len(dirs), 'cols')
