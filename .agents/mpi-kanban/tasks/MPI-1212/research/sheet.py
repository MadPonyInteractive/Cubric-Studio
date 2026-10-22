"""MPI-1212 contact sheet: one row per seed, columns = today's model | FLUX.3 Turbo | FLUX.3 base,
the Flow's result image only (the graph node titled exactly `Output_Image`).

  python sheet.py <graph>...      writes research/sheets/<graph>.jpg
"""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
VARS = [('base', 'today'), ('flux3turbo', 'FLUX.3 Turbo'), ('flux3base', 'FLUX.3 base')]
CELL = 640


def sheet(name):
    g = json.load(open(os.path.join(HERE, 'graphs', f'{name}.json'), encoding='utf-8'))['graph']
    nid = next(k for k, v in g.items() if v.get('_meta', {}).get('title') == 'Output_Image')
    out = os.path.join(HERE, 'out', name)
    seeds = sorted({f.split('_')[1] for f in os.listdir(out)})
    canvas = Image.new('RGB', (CELL * len(VARS), (CELL + 28) * len(seeds) + 28), 'white')
    d = ImageDraw.Draw(canvas)
    for c, (_, label) in enumerate(VARS):
        d.text((c * CELL + 8, 6), label, fill='black')
    for r, seed in enumerate(seeds):
        y = 28 + r * (CELL + 28)
        d.text((8, y + 4), f'seed {seed}', fill='black')
        for c, (var, _) in enumerate(VARS):
            p = os.path.join(out, f'{var}_{seed}_{nid}_0.png')
            if os.path.exists(p):
                im = Image.open(p).convert('RGB')
                im.thumbnail((CELL, CELL))
                canvas.paste(im, (c * CELL, y + 24))
    os.makedirs(os.path.join(HERE, 'sheets'), exist_ok=True)
    dst = os.path.join(HERE, 'sheets', f'{name}.jpg')
    canvas.save(dst, quality=88)
    print(dst)


if __name__ == '__main__':
    for n in sys.argv[1:]:
        sheet(n)
