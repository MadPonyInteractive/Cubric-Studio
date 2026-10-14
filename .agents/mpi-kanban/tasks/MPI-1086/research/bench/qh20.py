"""MPI-1086 phase B round 20. qh19: mannequin M4 + describer right 3/3; the padded-box background hold stopped the extra
back figure on the braids but the man (who fills his narrow panel) still grew a half figure beside the box; the braids
lost her backpack.
  L20 = L18 + the back panel's background held outside the back figure's SILHOUETTE grown GROW px (no box).
  K20 = keep line "Keep the character's own face and clothes, and anything they wear or carry."
M4 mannequins from qh19. usage: qh20.py <out> [only...]. Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh11
import qh16
import qh19
import qf2

GROW = 40
KEEP20 = "Keep the character's own face and clothes, and anything they wear or carry."
CASES = [('M', 's42', 42), ('B', 's42', 42), ('W', 's42', 42), ('M', 's7', 7)]


def graph(out):
    g = json.load(open(qh19.graph(out), encoding='utf-8'))
    for k in ('1902', '1903'):
        del g[k]
    g['1902'] = {'class_type': 'GrowMask', 'inputs': {'expand': GROW, 'tapered_corners': True, 'mask': ['1901', 0]},
                 '_meta': {'title': 'back figure silhouette, grown'}}
    g['1904']['inputs']['mask'] = ['1902', 0]
    p = f'{out}/h20_api.json'
    json.dump(g, open(p, 'w', encoding='utf-8'), indent=1)
    return p


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    for s in 'MB':
        if not os.path.exists(f'{out}/h20_mask{s}.png'):
            qf2.run(out, [{'tag': f'h20_mask{s}', 'api': qh1.mask_graph(out, graph(out)), 'set': {
                'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Lock': {'int': 2}}}], f'h20_mask{s}')
    if 'mask' in only:
        sys.exit(0)
    desc = json.load(open(f'{out}/h19_describe.json', encoding='utf-8'))
    api = graph(out)
    cases = CASES
    if 'rate' in only:   # the failure RATE: 4 fresh seeds per sheet
        cases = [(s, f's{n}', n) for s in 'MBW' for n in (1, 2, 3, 4)]
        only = [o for o in only if o != 'rate']
    for s, t, seed in cases:
        tag = f'h20_{s}_{t}'
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        ref = f'mpi1086_man4_{qh16.SHEETS[s][2][len("mpi1086_"):-4]}.png'
        prompt = qh11.d3(desc[ref].strip().rstrip('.')).replace(qh11.OWN, KEEP20)
        assert KEEP20 in prompt
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Image_2': {'string': ref},
            'Input_Lock': {'int': 2}, 'Input_Reference': {'boolean': True},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
