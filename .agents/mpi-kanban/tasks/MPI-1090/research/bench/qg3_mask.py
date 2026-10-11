"""MPI-1090: lock 1's mask with the BACK body's SAM3 on its own word list (node 21), to find one that stops at the
shoulders (Fabio 2026-10-11: lock only down to the shoulders on the back). Mask renders only, seconds each.
usage: qg3_mask.py <out>. Under gpu_lease only.
"""
import copy, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../MPI-1041/research/bench-tools/phaseF'))
import qf2
import qg1
import qg2_mask

VOCABS = {'head': 'head', 'headneck': 'head, neck', 'headhair': 'head, hair'}


def back_vocab(g, words):
    """The back body's SAM3 reads its own word list."""
    g['910'] = {'class_type': 'PrimitiveStringMultiline', 'inputs': {'value': words}, '_meta': {'title': 'lock 1 back vocabulary'}}
    g['911'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['13', 1], 'text': ['910', 0]}, '_meta': {'title': 'SAM3 back vocabulary'}}
    g['21']['inputs']['conditioning'] = ['911', 0]
    return g


if __name__ == '__main__':
    out = sys.argv[1]
    base = json.load(open(qg2_mask.mask_graph(out, True), encoding='utf-8'))
    for tag, words in VOCABS.items():
        p = f'{out}/mask_back_{tag}_api.json'
        json.dump(back_vocab(copy.deepcopy(base), words), open(p, 'w', encoding='utf-8'), indent=1)
        qf2.run(out, [{'tag': f'g3_mask_{tag}', 'api': p, 'set': {
            'Input_Image': {'string': qg1.SHEET}, 'Input_Lock': {'int': 1}}}], f'g3_mask_{tag}')
