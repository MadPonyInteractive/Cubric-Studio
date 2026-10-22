"""MPI-1232 stage 1 side-by-sides at 1:1: python -I sheets.py <krea2|flux3>

One sheet per region: input (lanczos 2x) | A | B | C faces off, then A | B | C faces on.
Regions are output-pixel boxes on the 2560x1600 result; tile seams sit at x 498-1068 / 996-1566 /
1492-2064 and y 532-1068 (tiles/face_rects.json).
"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
REGIONS = {
    'old_man_face': (600, 380, 1100, 980),
    'young_man_face': (1340, 280, 1820, 820),
    'shirt_seam': (800, 1050, 1300, 1550),
    'mural_seam': (1880, 280, 2400, 760),
}
COLS = [('input', None)] + [(f'{v} faces {"on" if f else "off"}', f'{v}_f{f}') for f in (0, 1) for v in 'ABC']
if (HERE / 'out' / f'face_{sys.argv[1]}_A_f1_base.png').exists():  # turbo-off checks (TURBO=0)
    COLS += [(f'{v} faces on BASE', f'{v}_f1_base') for v in 'AB']

model = sys.argv[1]
src = Image.open(HERE / 'input_face.png').convert('RGB')
ref = src.resize((src.width * 2, src.height * 2), Image.LANCZOS)
outs = {k: Image.open(p).convert('RGB') for _, k in COLS[1:] if (p := HERE / 'out' / f'face_{model}_{k}.png').exists()}
dest = HERE / 'out' / 'sheets'; dest.mkdir(parents=True, exist_ok=True)
for name, box in REGIONS.items():
    w, h = box[2] - box[0], box[3] - box[1]
    sheet = Image.new('RGB', (w * len(COLS) + 8 * (len(COLS) - 1), h + 28), (24, 24, 24))
    d = ImageDraw.Draw(sheet)
    for i, (label, key) in enumerate(COLS):
        im = ref if key is None else outs.get(key)
        x = i * (w + 8)
        d.text((x + 6, 8), label if im else f'{label} (missing)', fill=(230, 230, 230))
        if im:
            sheet.paste(im.crop(box), (x, 28))
    sheet.save(dest / f'{model}_{name}.png')
    print(dest / f'{model}_{name}.png')
