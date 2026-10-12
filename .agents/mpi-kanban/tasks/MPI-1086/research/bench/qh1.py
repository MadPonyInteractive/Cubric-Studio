"""MPI-1086 phase A: the fringe that never lands (Fabio, "Black and pink Bobcut with Fringe", flowCSE_008).
Hypothesis: lock 2 (SAM3 "face" on the front and the portrait, grown 6) covers the forehead, so a fringe is frozen out.
  mask  - lock 2's final mask (node 31) on Fabio's sheet flowCSFI_002
  R     - the shipped string, lock 2 (repro)          fab / s42 / s7
  F     - the same string, lock 0 (free: the control) fab / s42 / s7
usage: qh1.py <out> [only...]. Under gpu_lease only (MPI-1041 phaseF tools post to the bench :8188).
"""
import json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../MPI-1041/research/bench-tools/phaseF'))
import qf2

PROJ = 'C:/Users/Fabio/Documents/Cubric Studio/Projects/Qwen 2.1/Media'
SHEET = 'mpi1086_sheet.png'
SRC = {SHEET: f'{PROJ}/flowCSFI_002.png'}
FAB = 3745015294
TAIL = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'


def hair(words):
    """The shipped Hairstyle string (characterSheetEditor.js buildChangePrompt 'hair')."""
    return f'Give the character {words}, with the head uncovered and no hat, so the new hair shows.' + TAIL


SEEDS = (('fab', FAB), ('s42', 42), ('s7', 7))


def stage():
    for name, src in SRC.items():
        if not os.path.exists(f'{qf2.IN}/{name}'):
            shutil.copy(src, f'{qf2.IN}/{name}')


def mask_graph(out, api=qf2.API):
    """The app graph cut down to the lock mask (node 31) as a picture."""
    g = json.load(open(api, encoding='utf-8'))
    g['900'] = {'class_type': 'MaskToImage', 'inputs': {'mask': ['31', 0]}, '_meta': {'title': 'mask to image'}}
    g['61']['inputs']['images'] = ['900', 0]
    keep, todo = set(), ['61']
    while todo:
        k = todo.pop()
        if k in keep:
            continue
        keep.add(k)
        todo += [v[0] for v in g[k]['inputs'].values() if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str)]
    p = f'{out}/mask_{os.path.basename(api)}'
    json.dump({k: g[k] for k in keep}, open(p, 'w', encoding='utf-8'), indent=1)
    return p


def cases():
    s = hair('Black and pink Bobcut with Fringe')
    return ([(f'h1_R_{t}', qf2.API, s, seed, 2) for t, seed in SEEDS]
            + [(f'h1_F_{t}', qf2.API, s, seed, 0) for t, seed in SEEDS])


def go(out, cs, sheet=SHEET):
    for tag, api, prompt, seed, lock in cs:
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, lock, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': sheet}, 'Input_Positive': {'string': prompt},
            'Input_Seed': {'int': seed}, 'Input_Lock': {'int': lock}}}], tag)


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    stage()
    if not os.path.exists(f'{out}/h1_mask.png'):
        qf2.run(out, [{'tag': 'h1_mask', 'api': mask_graph(out), 'set': {
            'Input_Image': {'string': SHEET}, 'Input_Lock': {'int': 2}}}], 'h1_mask')
    go(out, [c for c in cases() if not only or any(c[0].startswith(o) for o in only)])
