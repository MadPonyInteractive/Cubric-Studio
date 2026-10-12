"""MPI-1086 phase B round 6: the reference photo CUT OUT to its head and hair inside the graph (lock 2 = Hairstyle only),
so its clothes and jewellery never reach Klein (the head crop H never leaked; a fixed crop would bring the chest back
for long hair). SAM3 "head, hair" on Input_Image_2 -> pasted onto mid grey -> the reference latent.
Prompt = qh11.d3 with the REAL describer's answer (qh12, h12_describe.json). Refs: the buns photo + Fabio's seven
Pinterest pictures; Fabio's sheet, s42 / s7; the two men's cuts also on the fisherman sheet.
usage: qh13.py <out> [only...]. Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh2
import qh11
import qf2

FISHER = 'mpi1042art_fisher_sheet.png'


def hair_cutout(g):
    """The patch: at lock 2 the reference picture is replaced by its head and hair on grey."""
    g['970'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['13', 1], 'text': 'head, hair'},
                '_meta': {'title': 'SAM3 "head, hair" (the reference)'}}
    g['971'] = {'class_type': 'SAM3_Detect', 'inputs': {'threshold': 0.5, 'refine_iterations': 2, 'individual_masks': False,
                'model': ['13', 0], 'image': ['68', 0], 'conditioning': ['970', 0]}, '_meta': {'title': 'SAM3 reference head + hair'}}
    g['972'] = {'class_type': 'GetImageSize', 'inputs': {'image': ['68', 0]}, '_meta': {'title': 'reference size'}}
    g['973'] = {'class_type': 'EmptyImage', 'inputs': {'width': ['972', 0], 'height': ['972', 1], 'batch_size': 1,
                'color': 8421504}, '_meta': {'title': 'mid grey'}}
    g['974'] = {'class_type': 'ImageCompositeMasked', 'inputs': {'destination': ['973', 0], 'source': ['68', 0], 'x': 0,
                'y': 0, 'resize_source': False, 'mask': ['971', 0]}, '_meta': {'title': 'reference: head and hair on grey'}}
    g['975'] = {'class_type': 'MpiCompare', 'inputs': {'operator': '==', 'b_value': 2, 'a': ['5', 0]},
                '_meta': {'title': 'hairstyle lock? (Input_Lock == 2)'}}
    g['976'] = {'class_type': 'MpiIfElse', 'inputs': {'true': ['974', 0], 'false': ['68', 0], 'boolean': ['975', 0]},
                '_meta': {'title': 'reference: cut out at lock 2'}}
    g['71']['inputs']['image'] = ['976', 0]
    return g


def graph(out):
    p = f'{out}/edit_B3_cutout_api.json'
    json.dump(hair_cutout(qh2.brow_cut(json.load(open(qf2.API, encoding='utf-8')), qh2.CUTS['B3'])),
              open(p, 'w', encoding='utf-8'), indent=1)
    return p


def cutout_graph(out):
    """Just the cut-out reference, as a picture, to eye-check SAM3."""
    g = json.load(open(graph(out), encoding='utf-8'))
    g['61']['inputs']['images'] = ['974', 0]
    keep, todo = set(), ['61']
    while todo:
        k = todo.pop()
        if k in keep:
            continue
        keep.add(k)
        todo += [v[0] for v in g[k]['inputs'].values() if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str)]
    p = f'{out}/cutout_api.json'
    json.dump({k: g[k] for k in keep}, open(p, 'w', encoding='utf-8'), indent=1)
    return p


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    qh1.stage()
    desc = json.load(open(f'{out}/h12_describe.json', encoding='utf-8'))
    api, capi = graph(out), cutout_graph(out)
    refs = list(desc)
    cs = []
    for ref in refs:
        k = ref[len('mpi1086_'):-4]
        cs.append((f'h13_cut_{k}', capi, None, ref, 0, qh1.SHEET))
        cs += [(f'h13_{k}_{t}', api, qh11.d3(desc[ref].strip().rstrip('.')), ref, seed, qh1.SHEET)
               for t, seed in qh1.SEEDS[1:]]
        if k in ('pin6', 'pin9'):
            cs.append((f'h13_{k}_fisher_s42', api, qh11.d3(desc[ref].strip().rstrip('.')), ref, 42, FISHER))
    for tag, g, prompt, ref, seed, sheet in cs:
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        st = {'Input_Image_2': {'string': ref}}
        if prompt:
            st.update({'Input_Image': {'string': sheet}, 'Input_Lock': {'int': 2}, 'Input_Reference': {'boolean': True},
                       'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}})
        qf2.run(out, [{'tag': tag, 'api': g, 'set': st}], tag)
