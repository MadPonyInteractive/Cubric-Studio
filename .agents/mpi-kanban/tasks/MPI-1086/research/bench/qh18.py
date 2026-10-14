"""MPI-1086 phase B round 18. qh17: the man breaks at s42 with the picture AND with words only, so it is the LOCK, not
the reference. The lock-2 mask (h17_maskM) keeps the face from the brows down but leaves the jaw outline, ears and neck
free: Klein swings the head and the kept beard patch stays put (double jaw, a second ear). And "face top + a third"
lands MID-EYE on his close-up (the seam at the eyes, s7).
  L18 = lock-2 vocabulary "face, neck" + the brow line from SAM3 "eyes": eyes-box top minus the eyes-box height.
  M3  = the mannequin in a three-quarter view (Fabio: a cut reads better at 3/4), bare, the full length of the hair.
Picture as the reference (no cut-out), describer ASK2. Man s42 / s7, buns s42, braids s42 first.
usage: qh18.py <out> [only...]. Under gpu_lease only.
"""
import json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh11
import qh12
import qh16
import qh17
import qf2

M3 = ('Replace the person with a plain white mannequin seen in a three-quarter view, with exactly the same hairstyle and '
      'hair colour, showing the full length of the hair. No jewellery and no clothes, on a plain grey background.')
CASES = [('M', 's42', 42), ('M', 's7', 7), ('W', 's42', 42), ('B', 's42', 42)]


def eyes_brow(g, crop, line, base):
    """Replace the brow line `line` (face top + a third) by: SAM3 "eyes" top minus the eyes height."""
    g[f'{base}'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['13', 1], 'text': 'eyes'},
                    '_meta': {'title': 'SAM3 "eyes" (the brow line)'}}
    g[f'{base + 1}'] = {'class_type': 'SAM3_Detect', 'inputs': {'threshold': 0.5, 'refine_iterations': 2,
                        'individual_masks': False, 'model': ['13', 0], 'image': [crop, 0], 'conditioning': [f'{base}', 0]},
                        '_meta': {'title': 'SAM3 eyes'}}
    g[f'{base + 2}'] = {'class_type': 'MpiMaskBbox', 'inputs': {'padding': 0, 'divisible_by': 1, 'mask': [f'{base + 1}', 0]},
                        '_meta': {'title': 'eyes box'}}
    g[f'{base + 3}'] = {'class_type': 'MpiFromBox', 'inputs': {'mpi_box': [f'{base + 2}', 1]}, '_meta': {'title': 'eyes box numbers'}}
    g[line]['inputs'].update({'math_expression': 'a - b', 'a': [f'{base + 3}', 3], 'b': [f'{base + 3}', 1]})
    return g


def graph(out):
    g = json.load(open(qh16.graph(out, 'A'), encoding='utf-8'))
    g['15']['inputs']['value'] = 'face, neck'
    eyes_brow(g, '18', '85', 1800)
    eyes_brow(g, '22', '92', 1810)
    p = f'{out}/h18_api.json'
    json.dump(g, open(p, 'w', encoding='utf-8'), indent=1)
    return p


def mask_graph(out):
    """The h18 lock mask as a picture (qh1.mask_graph on the h18 graph)."""
    import qh1
    return qh1.mask_graph(out, graph(out))


def mannequin(out, ref):
    k = ref[len('mpi1086_'):-4]
    name = f'mpi1086_man3_{k}.png'
    if not os.path.exists(f'{qf2.IN}/{name}'):
        tag = f'h18_man_{k}'
        print(tag, M3, flush=True)
        qf2.run(out, [{'tag': tag, 'api': qf2.KLEIN_API, 'set': {
            'Input_wf_type': {'int': 4}, 'Input_Image': {'image': ref}, 'Input_Positive': {'string': M3},
            'Input_Seed': {'int': qh16.MSEED}}}], tag)
        shutil.copy(f'{out}/{tag}.png', f'{qf2.IN}/{name}')
    return name


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    if not os.path.exists(f'{out}/h18_maskM.png'):
        qf2.run(out, [{'tag': 'h18_maskM', 'api': mask_graph(out), 'set': {
            'Input_Image': {'string': 'mpi1086_sheetM.png'}, 'Input_Lock': {'int': 2}}}], 'h18_maskM')
    if 'mask' in only:
        sys.exit(0)
    dpath = f'{out}/h18_describe.json'
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
        tag = f'h18_{s}_{t}'
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
