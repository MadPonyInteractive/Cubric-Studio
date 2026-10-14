"""MPI-1086 phase B round 16, after Fabio's eye test FAILED the picture route (validation.md "Fabio eye test 1").
Fabio's own find: a Klein edit "Replace the woman with a mannequin but keep the hairstyle." on the photo makes a better
reference than our SAM3 "hair" cut-out (proportions and colour, roots included), but his run still put the close-up
face out of place with a second ear. Suspect: lock 2 freezes the SAM3 face (brows down) and stitches it back onto a
head the new hair redrew.
  1. mannequin pass on the photo (Klein edit, his string with "person", his seed) -> the reference; no cut-out
  2. the real describer on the mannequin -> D3 words
  3. A = lock 2 as shipped (face from the brows)   B = lock 0 (no lock)   C = lock 2 on "eyes, nose, mouth" only
Sheets: W = flowCSE_019 + pin5 (pink buns), M = flowCSFI_007 + pin6 (the man, short crop with a fade),
        B = flowCSFI_006 + pin7 (braids). s42 / s7.
usage: qh16.py <out> [only...]. Under gpu_lease only.
"""
import json, os, shutil, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh11
import qh12
import qf2

PROJ = qh1.PROJ
SHEETS = {'W': ('mpi1086_sheetW.png', 'flowCSE_019.png', 'mpi1086_pin5.png'),
          'M': ('mpi1086_sheetM.png', 'flowCSFI_007.png', 'mpi1086_pin6.png'),
          'B': ('mpi1086_sheetB.png', 'flowCSFI_006.png', 'mpi1086_pin7.png')}
MANNEQUIN = 'Replace the person with a mannequin but keep the hairstyle.'
MSEED = 735724985   # Fabio's edit_004


def graph(out, variant):
    g = json.load(open(qf2.API, encoding='utf-8'))
    g['103']['inputs']['true'] = ['68', 0]   # the mannequin is the reference as is: no SAM3 "hair" cut-out
    if variant == 'C':
        g['15']['inputs']['value'] = 'eyes, nose, mouth'
        g['85']['inputs']['math_expression'] = 'a'   # no brow cut: the inner-face box already starts below the brows
        g['92']['inputs']['math_expression'] = 'a'
    p = f'{out}/h16_{variant}_api.json'
    json.dump(g, open(p, 'w', encoding='utf-8'), indent=1)
    return p


def mannequin(out, ref):
    k = ref[len('mpi1086_'):-4]
    name = f'mpi1086_man_{k}.png'
    if not os.path.exists(f'{qf2.IN}/{name}'):
        tag = f'h16_man_{k}'
        print(tag, MANNEQUIN, flush=True)
        qf2.run(out, [{'tag': tag, 'api': qf2.KLEIN_API, 'set': {
            'Input_wf_type': {'int': 4}, 'Input_Image': {'image': ref}, 'Input_Positive': {'string': MANNEQUIN},
            'Input_Seed': {'int': MSEED}}}], tag)
        shutil.copy(f'{out}/{tag}.png', f'{qf2.IN}/{name}')
    return name


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    for sheet, src, _ in SHEETS.values():
        if not os.path.exists(f'{qf2.IN}/{sheet}'):
            shutil.copy(f'{PROJ}/{src}', f'{qf2.IN}/{sheet}')
    dpath = f'{out}/h16_describe.json'
    desc = json.load(open(dpath, encoding='utf-8')) if os.path.exists(dpath) else {}
    refs = {}
    for s, (_, _, ref) in SHEETS.items():
        refs[s] = mannequin(out, ref)
        if refs[s] not in desc:
            desc[refs[s]] = qh12.describe(refs[s])
            print(refs[s], '->', desc[refs[s]], flush=True)
            json.dump(desc, open(dpath, 'w', encoding='utf-8'), indent=1)
    apis = {v: graph(out, v) for v in 'ABC'}
    for v, s, (t, seed) in [(v, s, x) for s in SHEETS for v in 'ABC' for x in qh1.SEEDS[1:]]:
        tag = f'h16_{s}_{v}_{t}'
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        prompt = qh11.d3(desc[refs[s]].strip().rstrip('.'))
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': apis[v], 'set': {
            'Input_Image': {'string': SHEETS[s][0]}, 'Input_Image_2': {'string': refs[s]},
            'Input_Lock': {'int': 0 if v == 'B' else 2}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
