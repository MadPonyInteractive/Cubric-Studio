"""MPI-1086 phase B round 7: the two leaks left in qh13 (earrings, stubble) came from cut-outs that KEPT THE FACE
(SAM3 "head, hair" returned the head on the men, the pigtail girl and the boy). SAM3 "hair" alone, on those four refs.
usage: qh14.py <out> [only...]. Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh11
import qh13
import qf2

REFS = ['mpi1086_pin6.png', 'mpi1086_pin8.png', 'mpi1086_pin9.png', 'mpi1086_pin10.png']


def graph(out, cut_only=False):
    g = json.load(open(qh13.cutout_graph(out) if cut_only else qh13.graph(out), encoding='utf-8'))
    g['970']['inputs']['text'] = 'hair'
    g['970']['_meta']['title'] = 'SAM3 "hair" (the reference)'
    p = f'{out}/{"cut_" if cut_only else "edit_"}haironly_api.json'
    json.dump(g, open(p, 'w', encoding='utf-8'), indent=1)
    return p


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    desc = json.load(open(f'{out}/h12_describe.json', encoding='utf-8'))
    api, capi = graph(out), graph(out, True)
    for ref in REFS:
        k = ref[len('mpi1086_'):-4]
        for tag, g, prompt, seed in ((f'h14_cut_{k}', capi, None, 0),
                                     (f'h14_{k}_s42', api, qh11.d3(desc[ref].strip().rstrip('.')), 42)):
            if only and not any(tag.startswith(o) for o in only):
                continue
            if os.path.exists(f'{out}/{tag}.png'):
                print(tag, 'exists, skipped', flush=True)
                continue
            print(tag, prompt, flush=True)
            st = {'Input_Image_2': {'string': ref}}
            if prompt:
                st.update({'Input_Image': {'string': qh1.SHEET}, 'Input_Lock': {'int': 2}, 'Input_Reference': {'boolean': True},
                           'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}})
            qf2.run(out, [{'tag': tag, 'api': g, 'set': st}], tag)
