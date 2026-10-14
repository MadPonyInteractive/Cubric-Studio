"""MPI-1086 phase B round 22: qh21 WITHOUT the mannequin (Fabio, 2026-10-14). The raw photo is images.image_2 of the
Editor's Qwen graph and the describer (ASK2) reads the raw photo. Same sheets, seeds, graph and string (qh21.q1).
Watch: the photo's face, clothes, jewellery or background leaking into the sheet (why the mannequin existed, on Klein).
If it holds ~17/18, the app needs no mannequin step. usage: qh22.py <out> [only...] ('rate' = s1-s4). Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh12
import qh16
import qh17
import qh21
import qf2


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    dpath = f'{out}/h22_describe.json'
    desc = json.load(open(dpath, encoding='utf-8')) if os.path.exists(dpath) else {}
    for _, _, ref in qh16.SHEETS.values():
        if ref not in desc:
            desc[ref] = qh12.describe(ref, qh17.ASK2)
            print(ref, '->', desc[ref], flush=True)
            json.dump(desc, open(dpath, 'w', encoding='utf-8'), indent=1)
    api = qh21.graph(out)
    cases = [(s, t, seed) for s in 'MBW' for t, seed in qh1.SEEDS[1:]]
    if 'rate' in only:
        cases = [(s, f's{n}', n) for s in 'MBW' for n in (1, 2, 3, 4)]
        only = [o for o in only if o != 'rate']
    for s, t, seed in cases:
        tag = f'h22_{s}_{t}'
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        ref = qh16.SHEETS[s][2]
        prompt = qh21.q1(desc[ref].strip().rstrip('.'))
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Image_2': {'string': ref},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
