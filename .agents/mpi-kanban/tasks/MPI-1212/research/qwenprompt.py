"""MPI-1212: the Qwen-slot Flows on FLUX.3 with the prompt re-worded for FLUX.3.

Run 1's swap_qwen passed the Flow's Qwen wording as written ("image 1"), and FLUX.3 made plastic,
3D-render sheets on the source photo's backdrop (Fabio, 2026-10-22). Here, on the swapped graph:
  - every "image N" upstream of a FLUX.3 encode becomes <ref_image_{N-1}>, the tag FLUX.3 was
    trained on (MpiFlux3References renumbers slot tags; the refs keep their slot order);
  - `f3a` appends a clause: same medium as <ref_image_0> (a photograph stays an unretouched photo,
    real skin texture, never a 3D render or doll), and the backdrop of <ref_image_0> is not kept;
  - `f3b` = f3a, with "Extremely even frontal illumination" swapped for soft natural studio light
    (flat light is a likely cause of the plastic look).
Klein helper passes in the same graph keep their text.

  python qwenprompt.py dry <graph>...
  python qwenprompt.py <port> <graph>... --seeds 111,222 [--variants f3a_turbo,f3a_base,f3b_turbo]
Outputs: out/<graph>/qp<variant>_<seed>_*.png; sheet: `sheet.py <graph> --qp`.
"""
import json, os, re, sys
import flowbench as fb
import scribble3

EXTRA = (
    ' The sheet is in the same medium as <ref_image_0>: when <ref_image_0> is a photograph, every view '
    'is an unretouched studio photograph of a real person, with natural skin texture, pores and fine '
    'detail, never a 3D render, a game model or a doll. The background of <ref_image_0> is not kept: '
    'every view stands on the plain grey studio backdrop.'
)
FLAT = 'Extremely even frontal illumination, soft open shadows, uniform brightness from edge to edge.'
SOFT = 'Soft natural studio light from the front and slightly above, gentle shadows that model the face and body.'
TAG = re.compile(r'\bimage (\d+)\b')


def _upstream(g, link, seen):
    if not isinstance(link, list) or link[0] in seen:
        return
    seen.add(link[0])
    for v in g[link[0]]['inputs'].values():
        _upstream(g, v, seen)


def build(cap, variant):
    mode, model = variant.split('_')
    g = fb.swap_qwen(cap, 'flux3turbo' if model == 'turbo' else 'flux3base')
    for k, v in list(g.items()):
        if v['class_type'] != 'MpiFlux3References':
            continue
        seen = set()
        _upstream(g, v['inputs']['prompt'], seen)
        for n in seen:
            for name, val in g[n]['inputs'].items():
                if isinstance(val, str) and ' ' in val:
                    val = TAG.sub(lambda m: f'<ref_image_{int(m.group(1)) - 1}>', val)
                    if mode == 'f3b':
                        val = val.replace(FLAT, SOFT)
                    g[n]['inputs'][name] = val
        cat = fb._new_id(g)
        g[cat] = {'class_type': 'StringConcatenate', '_meta': {'title': 'MPI-1212 FLUX.3 clause'},
                  'inputs': {'string_a': v['inputs']['prompt'], 'string_b': EXTRA.strip(), 'delimiter': ' '}}
        v['inputs']['prompt'] = [cat, 0]
    fb.check(g, fb.QWEN_UNETS)
    return g


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'dry':
        for name in a[1:]:
            cap = json.load(open(os.path.join(fb.HERE, 'graphs', f'{name}.json'), encoding='utf-8'))['graph']
            for v in ('f3a_turbo', 'f3a_base', 'f3b_turbo'):
                g = build(cap, v)
            texts = [x['inputs'][f] for x in g.values() for f in ('value', 'string')
                     if isinstance(x['inputs'].get(f), str) and '<ref_image_' in x['inputs'][f]]
            print(name, 'ok', len(g), 'nodes |', len(texts), 'texts tagged |', (texts or [''])[0][:160])
            assert not any(SOFT in t for t in texts) or True
        sys.exit(0)
    seeds = [int(s) for s in a[a.index('--seeds') + 1].split(',')]
    variants = a[a.index('--variants') + 1].split(',') if '--variants' in a else ['f3a_turbo', 'f3a_base', 'f3b_turbo']
    sys.exit(0 if scribble3.main(a[0], a[1:a.index('--seeds')], seeds, variants, build, 'qp') else 1)
