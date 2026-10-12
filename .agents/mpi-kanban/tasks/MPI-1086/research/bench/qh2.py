"""MPI-1086 phase A round 2: lock 2's face lock cut at the brow line, so a fringe has a forehead to fall on.
h1_mask showed SAM3 "face" runs from the hairline: the whole forehead was locked (the fringe's root cause).
Lock 2 only (lock 1 = "head, hair, face" for Clothes is untouched, through an IfElse on node 12).
  B4 - cut at face top + h // 4 (just above the brows)
  B3 - cut at face top + h // 3 (the brows free, the eyes locked)
usage: qh2.py <out> [only...]. Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qf2

CUTS = {'B4': 'a + b // 4', 'B3': 'a + b // 3'}


def brow_cut(g, expr, base=950):
    """The patch, as it would go into flow_character_sheet_edit.json: front (19 in crop 18, width 7) and portrait
    (23 in crop 22, width 10) each multiplied by a box from the brow line down, at lock 2 only."""
    for i, (sam, crop, width, comp) in enumerate((('19', '18', '7', '27'), ('23', '22', '10', '29'))):
        n = [str(base + 10 * i + j) for j in range(7)]
        side = 'front' if i == 0 else 'portrait'
        g[n[0]] = {'class_type': 'MpiMaskBbox', 'inputs': {'mask': [sam, 0], 'padding': 0, 'divisible_by': 1},
                   '_meta': {'title': f'{side} face box (lock 2)'}}
        g[n[1]] = {'class_type': 'MpiFromBox', 'inputs': {'mpi_box': [n[0], 1]}, '_meta': {'title': f'{side} face box numbers'}}
        g[n[2]] = {'class_type': 'MpiMath', 'inputs': {'math_expression': expr, 'a': [n[1], 3], 'b': [n[1], 1]},
                   '_meta': {'title': f'{side} brow line'}}
        g[n[3]] = {'class_type': 'MpiBox', 'inputs': {'width': [width, 0], 'height': ['2', 3], 'x': 0, 'y': [n[2], 0]},
                   '_meta': {'title': f'{side}: brow line down'}}
        g[n[4]] = {'class_type': 'MpiBoxMask', 'inputs': {'image': [crop, 0], 'mpi_box': [n[3], 0]},
                   '_meta': {'title': f'{side}: brow-line-down mask'}}
        g[n[5]] = {'class_type': 'MaskComposite', 'inputs': {'destination': [sam, 0], 'source': [n[4], 0], 'x': 0, 'y': 0,
                   'operation': 'multiply'}, '_meta': {'title': f'{side} face lock cut at the brows'}}
        g[n[6]] = {'class_type': 'MpiIfElse', 'inputs': {'true': [sam, 0], 'false': [n[5], 0], 'boolean': ['12', 0]},
                   '_meta': {'title': f'{side} lock: whole at lock 1, from the brows at lock 2'}}
        g[comp]['inputs']['source'] = [n[6], 0]
    return g


def graph(out, tag):
    p = f'{out}/edit_{tag}_api.json'
    json.dump(brow_cut(json.load(open(qf2.API, encoding='utf-8')), CUTS[tag]), open(p, 'w', encoding='utf-8'), indent=1)
    return p


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    qh1.stage()
    s = qh1.hair('Black and pink Bobcut with Fringe')
    for tag in CUTS:
        api = graph(out, tag)
        if not os.path.exists(f'{out}/h2_{tag}_mask.png'):
            qf2.run(out, [{'tag': f'h2_{tag}_mask', 'api': qh1.mask_graph(out, api), 'set': {
                'Input_Image': {'string': qh1.SHEET}, 'Input_Lock': {'int': 2}}}], f'h2_{tag}_mask')
        cs = [(f'h2_{tag}_{t}', api, s, seed, 2) for t, seed in qh1.SEEDS]
        qh1.go(out, [c for c in cs if not only or any(c[0].startswith(o) for o in only)])
