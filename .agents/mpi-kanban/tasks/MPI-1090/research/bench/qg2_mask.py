"""MPI-1090: render ONLY the lock-1 mask of the shipped edit graph on Fabio's with-head sheet, with and without the
fill-holes step, to see whether filling closes the gaps between the braids (back view) and the neck (portrait).
usage: qg2_mask.py <out>. Under gpu_lease only.
"""
import copy, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../MPI-1041/research/bench-tools/phaseF'))
import qf2
import qg1


def mask_graph(out, fill):
    g = copy.deepcopy(json.load(open(qf2.API, encoding='utf-8')))
    if not fill:
        g['31']['inputs']['mask'] = g['30']['inputs']['mask']
    g['900'] = {'class_type': 'MaskToImage', 'inputs': {'mask': ['31', 0]}, '_meta': {'title': 'mask to image'}}
    g['61']['inputs']['images'] = ['900', 0]
    # Keep only what the mask output needs.
    keep, todo = set(), ['61']
    while todo:
        k = todo.pop()
        if k in keep:
            continue
        keep.add(k)
        todo += [v[0] for v in g[k]['inputs'].values() if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str)]
    p = f'{out}/mask_{"fill" if fill else "nofill"}_api.json'
    json.dump({k: g[k] for k in keep}, open(p, 'w', encoding='utf-8'), indent=1)
    return p


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for fill in (True, False):
        tag = f'g2_mask_{"fill" if fill else "nofill"}'
        qf2.run(out, [{'tag': tag, 'api': mask_graph(out, fill), 'set': {
            'Input_Image': {'string': qg1.SHEET}, 'Input_Lock': {'int': 1}}}], tag)
