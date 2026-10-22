"""MPI-1212 contact sheet: one row per seed, columns = today's model | FLUX.3 Turbo | FLUX.3 base,
the Flow's result image only (the graph node titled exactly `Output_Image`).

  python sheet.py <graph>...      writes research/sheets/<graph>.jpg
"""
import json, os, sys
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
VARS = [('base', 'today'), ('flux3turbo', 'FLUX.3 Turbo'), ('flux3base', 'FLUX.3 base')]
CELL = 640


S3 = [('base', 'today'), ('flux3turbo', 'F3 Turbo, Flow prompt'), ('s3p-turbo', 'F3 Turbo, F3 prompt'),
      ('s3lo-turbo', 'F3 Turbo, F3 prompt + ref 0.25 MP')]
MODES = {'--s3': S3,
         '--bfl': [('base', 'today'), ('flux3turbo', 'F3 Turbo, Flow prompt'), ('bfl-turbo', 'F3 Turbo, BFL prompt'),
                   ('flux3base', 'F3 base, Flow prompt'), ('bfl-base', 'F3 base, BFL prompt')],
         '--qp': [('base', 'today'), ('flux3turbo', 'F3 Turbo, Flow prompt'), ('qpf3a-turbo', 'F3 Turbo, tags + clause'),
                  ('qpf3a-base', 'F3 base, tags + clause'), ('qpf3b-turbo', 'F3 Turbo, + soft light')]}


def sheet(name, VARS=VARS, suffix=''):
    g = json.load(open(os.path.join(HERE, 'graphs', f'{name}.json'), encoding='utf-8'))['graph']
    out = os.path.join(HERE, 'out', name)
    # the first Output_Image* node that saved files (the editor's Qwen leg ends in Output_Image_2)
    have = {f.split('_')[2] for f in os.listdir(out)}
    # editor graphs (cseq*): Output_Image is the mannequin helper when it runs; the sheet is Output_Image_2
    order = ('Output_Image_2', 'Output_Image') if name.startswith('cseq') else ('Output_Image', 'Output_Image_2')
    nid = next(k for t in order for k, v in g.items()
               if v.get('_meta', {}).get('title') == t and k in have)
    seeds = sorted({f.split('_')[1] for f in os.listdir(out) if f.split('_')[1].isdigit()})
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
    dst = os.path.join(HERE, 'sheets', f'{name}{suffix}.jpg')
    canvas.save(dst, quality=88)
    print(dst)


if __name__ == '__main__':
    mode = next((a for a in sys.argv[1:] if a in MODES), None)
    for n in [a for a in sys.argv[1:] if a not in MODES]:
        sheet(n, MODES[mode], '_' + mode[2:]) if mode else sheet(n)
