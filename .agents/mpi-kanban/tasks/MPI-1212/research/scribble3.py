"""MPI-1212: Scribble with a FLUX.3-specific prompt, before calling Scribble a loss.

Run 1 fed FLUX.3 the Flow's Klein instruction ("Replace this sketch ...") and it carried the
paint. Here the instruction is written the way BFL's i2i upsampler words a drawing-to-new-frame
job: a generation request ("Create a ... image of ..."), style-neutral so an anime or painted ask keeps its style, that cites the drawing as <ref_image_0>
and says what to take from it. The user's own words still slot in, so it could ship as a template.
Optional `lo`: the reference reaches the model at 0.25 MP instead of 1 MP (less paint to copy).

  python scribble3.py <port> <graph>... --seeds 111,222 [--variants p_turbo,lo_turbo]
Outputs land in out/<graph>/s3<variant>_<seed>_*.png; sheet with `sheet.py <graph> --s3`.
"""
import copy, json, os, sys, time, urllib.parse, urllib.request
import flowbench as fb

TEMPLATE = (
    'Create a finished, fully rendered image of the scene laid out in <ref_image_0>. <ref_image_0> is a rough drawing '
    'used only as a layout guide: take from it where each thing sits, how big it is and what it is '
    'meant to be, and nothing else. Every shape becomes the thing it stands for, with real form, '
    'texture, light, shadow and depth, in whatever style the scene below names; no line, outline, '
    'brush stroke or patch of flat paint from the drawing appears anywhere in the image. A person drawn as lines is a real person in '
    'that pose with natural anatomy: one head, two arms, two legs. The scene: {user}'
)


def build(cap, variant):
    mode, model = variant.split('_')
    g = fb.swap(cap, 'flux3turbo' if model == 'turbo' else 'flux3base')
    user = g['17']['inputs']['value'].strip()
    enc = next(k for k, v in g.items() if v['class_type'] == 'CLIPTextEncode'
               and v.get('_meta', {}).get('title') == 'Encode Blend Instruction')
    g[enc]['inputs']['text'] = TEMPLATE.format(user=user)
    if mode == 'lo':
        ref = next(k for k, v in g.items() if v['class_type'] == 'ReferenceLatent')
        src = g[g[g[ref]['inputs']['latent'][0]]['inputs']['pixels'][0]]   # the 1 MP scale node
        s, e = fb._new_id(g), None
        g[s] = {'class_type': 'ImageScaleToTotalPixels', '_meta': {'title': 'ref 0.25 MP'},
                'inputs': dict(src['inputs'], megapixels=0.25)}
        e = fb._new_id(g)
        g[e] = {'class_type': 'VAEEncode', '_meta': {'title': 'Encode ref 0.25 MP'},
                'inputs': {'pixels': [s, 0], 'vae': g[g[ref]['inputs']['latent'][0]]['inputs']['vae']}}
        g[ref]['inputs']['latent'] = [e, 0]
    fb.check(g)
    return g


def main(port, graphs, seeds, variants, build=build, tag='s3'):
    ok = True
    for name in graphs:
        cap = json.load(open(os.path.join(fb.HERE, 'graphs', f'{name}.json'), encoding='utf-8'))['graph']
        outdir = os.path.join(fb.HERE, 'out', name)
        for seed in seeds:
            for var in variants:
                g = build(cap, var)
                fb._seed(g, seed)
                pid = fb._api(port, '/prompt', {'prompt': g})['prompt_id']
                t0 = time.time()
                while True:
                    time.sleep(3)
                    h = fb._api(port, f'/history/{pid}')
                    st = h.get(pid, {}).get('status', {})
                    if st.get('completed') or st.get('status_str') == 'error':
                        break
                # a blocked loader ends 'success' with only the loaders' empty previews: no image = failed
                made = sum(len(o.get('images', [])) for o in h[pid]['outputs'].values())
                print(name, tag + var, seed, st.get('status_str'), made, 'images', round(time.time() - t0, 1), 's', flush=True)
                ok &= st.get('status_str') == 'success' and made > 0
                for nid, node_out in h[pid]['outputs'].items():
                    for i, im in enumerate(node_out.get('images', [])):
                        q = urllib.parse.urlencode({k: im[k] for k in ('filename', 'subfolder', 'type')})
                        with urllib.request.urlopen(fb._url(port, f'/view?{q}')) as r:
                            open(os.path.join(outdir, f'{tag}{var.replace("_", "-")}_{seed}_{nid}_{i}.png'), 'wb').write(r.read())
    return ok


if __name__ == '__main__':
    a = sys.argv[1:]
    if a[0] == 'dry':   # build every variant offline, print the prompt once
        for name in a[1:]:
            cap = json.load(open(os.path.join(fb.HERE, 'graphs', f'{name}.json'), encoding='utf-8'))['graph']
            for v in ('p_turbo', 'p_base', 'lo_turbo', 'lo_base'):
                g = build(cap, v)
            print(name, 'ok', len(g), 'nodes |', next(x['inputs']['text'] for x in g.values()
                  if x.get('_meta', {}).get('title') == 'Encode Blend Instruction')[-120:])
        sys.exit(0)
    seeds = [int(s) for s in a[a.index('--seeds') + 1].split(',')]
    variants = a[a.index('--variants') + 1].split(',') if '--variants' in a else ['p_turbo', 'lo_turbo']   # base: Fabio 2026-10-22, horrible on Scribble
    graphs = [x for x in a[1:a.index('--seeds')]]
    sys.exit(0 if main(a[0], graphs, seeds, variants) else 1)
