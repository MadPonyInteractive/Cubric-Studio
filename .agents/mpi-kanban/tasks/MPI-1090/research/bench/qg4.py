"""MPI-1090 round 2: the back body's lock stops at the shoulders (Fabio 2026-10-11, "lock only down to the shoulders").
SAM3 "face" on the front body gives the chin; the back's hair lock is cut at chin + half a face height, so long hair
below it is redrawn with the new outfit instead of freezing the old top between the braids (round 1, 12/12).
No face found = an empty box = no lock on the back (the hair is free), never an error.
  L    - new lock, shipped no-words string
  LC   - new lock, the close-up line replaced by one naming every figure (the back one as "seen from behind")
  LW   - new lock, words in their own sentence (round 1's Wg)
  LWC  - LW + the LC close-up line
usage: qg4.py <out> [mask]. Under gpu_lease only.
"""
import copy, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '../../../MPI-1041/research/bench-tools/phaseF'))
import qf2
import qg1


def shoulder_lock(g):
    """The patch, as it would go into flow_character_sheet_edit.json."""
    g['920'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['13', 1], 'text': ['15', 0]},
                '_meta': {'title': 'SAM3 "face" (the chin line)'}}
    g['921'] = {'class_type': 'SAM3_Detect', 'inputs': {'threshold': 0.5, 'refine_iterations': 2, 'individual_masks': False,
                'model': ['13', 0], 'image': ['18', 0], 'conditioning': ['920', 0]}, '_meta': {'title': 'SAM3 face, front body'}}
    g['922'] = {'class_type': 'MpiMaskBbox', 'inputs': {'mask': ['921', 0], 'padding': 0, 'divisible_by': 1},
                '_meta': {'title': 'front face box'}}
    g['923'] = {'class_type': 'MpiFromBox', 'inputs': {'mpi_box': ['922', 1]}, '_meta': {'title': 'face box numbers'}}
    g['924'] = {'class_type': 'MpiMath', 'inputs': {'math_expression': 'a + b + b // 2', 'a': ['923', 3], 'b': ['923', 1]},
                '_meta': {'title': 'shoulder line = chin + half a face'}}
    g['925'] = {'class_type': 'MpiBox', 'inputs': {'width': ['9', 0], 'height': ['924', 0], 'x': 0, 'y': 0},
                '_meta': {'title': 'back body above the shoulders'}}
    g['926'] = {'class_type': 'MpiBoxMask', 'inputs': {'image': ['20', 0], 'mpi_box': ['925', 0]},
                '_meta': {'title': 'back body: above-the-shoulders mask'}}
    g['927'] = {'class_type': 'MaskComposite', 'inputs': {'destination': ['21', 0], 'source': ['926', 0], 'x': 0, 'y': 0,
                'operation': 'multiply'}, '_meta': {'title': 'back lock cut at the shoulders'}}
    g['25']['inputs']['true'] = ['927', 0]
    return g


def graph(out):
    p = f'{out}/edit_shoulder_api.json'
    json.dump(shoulder_lock(json.load(open(qf2.API, encoding='utf-8'))), open(p, 'w', encoding='utf-8'), indent=1)
    return p


def mask_graph(out):
    g = json.load(open(graph(out), encoding='utf-8'))
    g['900'] = {'class_type': 'MaskToImage', 'inputs': {'mask': ['31', 0]}, '_meta': {'title': 'mask to image'}}
    g['61']['inputs']['images'] = ['900', 0]
    keep, todo = set(), ['61']
    while todo:
        k = todo.pop()
        if k in keep:
            continue
        keep.add(k)
        todo += [v[0] for v in g[k]['inputs'].values() if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str)]
    p = f'{out}/mask_shoulder_api.json'
    json.dump({k: g[k] for k in keep}, open(p, 'w', encoding='utf-8'), indent=1)
    return p


ALL = ('The front view, the character seen from behind and the close-up portrait on the right all show the same outfit, '
       'with the same neckline, sleeves and straps. Keep everything else exactly as it is.')
LC = qg1.DN.replace(qg1.TAIL, ALL)
LW = qg1.w('G string seen from behind')
LWC = LW.replace(qg1.BACK, '').replace(qg1.TAIL, ALL)


def cases():
    c = []
    for name, prompt in (('L', qg1.DN), ('LC', LC), ('LW', LW), ('LWC', LWC)):
        for seed_tag, seed in (('fab', qg1.F11 if name in ('L', 'LC') else qg1.F12), ('s42', 42), ('s7', 7)):
            c.append((f'g4_{name}_{seed_tag}', prompt, seed))
    return c


if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    if sys.argv[2:] == ['mask']:
        qf2.run(out, [{'tag': 'g4_mask', 'api': mask_graph(out), 'set': {
            'Input_Image': {'string': qg1.SHEET}, 'Input_Lock': {'int': 1}}}], 'g4_mask')
        sys.exit(0)
    api = graph(out)
    for tag, prompt, seed in cases():
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qg1.SHEET}, 'Input_Image_2': {'string': qg1.REF}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}, 'Input_Lock': {'int': 1}}}], tag)
