"""Face grid for eyeballing likeness across bench_run.py configs.
Usage: python faces.py OUT.png TAGDIR [TAGDIR ...]
Rows = every <job>_<mode>_s<seed> found in the first TAGDIR; columns = SRC (Picture 1, expression) and REF
(Picture 2, likeness) when set, then the TAGDIRs labelled by folder name. SRC/REF = path or path@x0,y0,x1,y1
(crop); one photo per sheet, so pair SRC with ROWS=<job> (substring filter). A missing cell stays dark."""
import glob, os, sys
from PIL import Image, ImageDraw

def still(v):
    path, _, box = v.rpartition('@') if '@' in v else (v, '', '')
    im = Image.open(path).convert('RGB')
    return im.crop(tuple(int(n) for n in box.split(','))) if box else im

out, dirs = sys.argv[1], sys.argv[2:]
rows = sorted(os.path.basename(f)[:-len('_face.png')] for f in glob.glob(os.path.join(dirs[0], '*_face.png')))
rows = [r for r in rows if os.environ.get('ROWS', '') in r]
cols = [(k.lower(), lambda r, im=still(os.environ[k]): im) for k in ('SRC', 'REF') if os.environ.get(k)]
cols += [(os.path.basename(os.path.normpath(t)), lambda r, t=t: os.path.join(t, r + '_face.png')) for t in dirs]
C, L = 512, 24  # cell size, label strip
sheet = Image.new('RGB', (len(cols) * C, L + len(rows) * (C + L)), (18, 18, 18))
d = ImageDraw.Draw(sheet)
for ci, (label, path) in enumerate(cols):
    d.text((ci * C + 6, 6), label, fill=(255, 220, 80))
    for ri, row in enumerate(rows):
        y = L + ri * (C + L)
        d.text((ci * C + 6, y + 6), row, fill=(200, 200, 200))
        im = path(row)
        if isinstance(im, str):
            im = Image.open(im).convert('RGB') if os.path.exists(im) else None
        if im:
            s = C / max(im.size)  # fit, keep aspect
            im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            sheet.paste(im, (ci * C + (C - im.width) // 2, y + L + (C - im.height) // 2))
sheet.save(out)
print(out, sheet.size, len(rows), 'rows x', len(dirs), 'cols')
