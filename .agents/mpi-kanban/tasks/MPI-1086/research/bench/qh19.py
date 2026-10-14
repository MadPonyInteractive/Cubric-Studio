"""MPI-1086 phase B round 19. qh18's lock (L18: "face, neck" + the brow line from SAM3 "eyes") fixed the double jaw.
Left: (1) M3's "showing the full length of the hair" grew the man's crop long; (2) an EXTRA BACK FIGURE (man s42,
braids s42) - at lock 2 the back panel is all free.
  M4  = Fabio's mannequin, 3/4, "keep the hairstyle exactly as it is: the same length, shape and colour", bare, grey.
  L19 = L18 + at lock 2 the back panel's BACKGROUND held: SAM3 "person" box (padded) on the back crop, inverted, added
        AFTER fill-holes (the box is a hole in a frame; fill-holes would close it).
usage: qh19.py <out> [only...]. Under gpu_lease only.
"""
import json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh11
import qh12
import qh16
import qh17
import qh18
import qf2

M4 = ('Replace the person with a plain white mannequin seen in a three-quarter view, and keep the hairstyle exactly as it '
      'is: the same length, shape and colour. No jewellery and no clothes, on a plain grey background.')
PAD = 48
CASES = [('M', 's42', 42), ('B', 's42', 42), ('M', 's7', 7), ('W', 's42', 42)]


def back_background(g):
    g['1900'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['13', 1], 'text': 'person'},
                 '_meta': {'title': 'SAM3 "person" (the back figure)'}}
    g['1901'] = {'class_type': 'SAM3_Detect', 'inputs': {'threshold': 0.5, 'refine_iterations': 2, 'individual_masks': False,
                 'model': ['13', 0], 'image': ['20', 0], 'conditioning': ['1900', 0]}, '_meta': {'title': 'SAM3 back figure'}}
    g['1902'] = {'class_type': 'MpiMaskBbox', 'inputs': {'padding': PAD, 'divisible_by': 1, 'mask': ['1901', 0]},
                 '_meta': {'title': 'back figure box, padded'}}
    g['1903'] = {'class_type': 'MpiBoxMask', 'inputs': {'image': ['20', 0], 'mpi_box': ['1902', 1]},
                 '_meta': {'title': 'back figure box mask'}}
    g['1904'] = {'class_type': 'InvertMask', 'inputs': {'mask': ['1903', 0]}, '_meta': {'title': 'back panel background'}}
    g['1905'] = {'class_type': 'MaskComposite', 'inputs': {'destination': ['30', 0], 'source': ['1904', 0], 'x': ['7', 0],
                 'y': 0, 'operation': 'add'}, '_meta': {'title': 'hold the back background'}}
    g['1906'] = {'class_type': 'MpiIfElse', 'inputs': {'true': ['1905', 0], 'false': ['30', 0], 'boolean': ['102', 0]},
                 '_meta': {'title': 'back background held at lock 2'}}
    g['31']['inputs']['mask'] = ['1906', 0]
    return g


def graph(out):
    p = f'{out}/h19_api.json'
    json.dump(back_background(json.load(open(qh18.graph(out), encoding='utf-8'))), open(p, 'w', encoding='utf-8'), indent=1)
    return p


def mannequin(out, ref):
    k = ref[len('mpi1086_'):-4]
    name = f'mpi1086_man4_{k}.png'
    if not os.path.exists(f'{qf2.IN}/{name}'):
        tag = f'h19_man_{k}'
        print(tag, M4, flush=True)
        qf2.run(out, [{'tag': tag, 'api': qf2.KLEIN_API, 'set': {
            'Input_wf_type': {'int': 4}, 'Input_Image': {'image': ref}, 'Input_Positive': {'string': M4},
            'Input_Seed': {'int': qh16.MSEED}}}], tag)
        shutil.copy(f'{out}/{tag}.png', f'{qf2.IN}/{name}')
    return name


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    for s in 'MB':
        if not os.path.exists(f'{out}/h19_mask{s}.png'):
            qf2.run(out, [{'tag': f'h19_mask{s}', 'api': qh1.mask_graph(out, graph(out)), 'set': {
                'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Lock': {'int': 2}}}], f'h19_mask{s}')
    if 'mask' in only:
        sys.exit(0)
    dpath = f'{out}/h19_describe.json'
    desc = json.load(open(dpath, encoding='utf-8')) if os.path.exists(dpath) else {}
    refs = {}
    for s, (_, _, ref) in qh16.SHEETS.items():
        refs[s] = mannequin(out, ref)
        if refs[s] not in desc:
            desc[refs[s]] = qh12.describe(refs[s], qh17.ASK2)
            print(refs[s], '->', desc[refs[s]], flush=True)
            json.dump(desc, open(dpath, 'w', encoding='utf-8'), indent=1)
    api = graph(out)
    for s, t, seed in CASES:
        tag = f'h19_{s}_{t}'
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        prompt = qh11.d3(desc[refs[s]].strip().rstrip('.'))
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Image_2': {'string': refs[s]},
            'Input_Lock': {'int': 2}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
