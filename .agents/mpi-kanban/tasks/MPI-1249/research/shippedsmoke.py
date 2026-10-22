"""MPI-1249: the SHIPPED moss_t2i.json as baked (no setting overrides), Anime prompt, SFT and Turbo. Compare with
bench/moss25_anime (SFT should match it) and bench/turbo_anime (er_sde; Turbo is now euler)."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sftbench  # noqa: E402

base = json.load(open(sftbench.GRAPH, encoding='utf-8'))
for turbo in (False, True):
    g = sftbench.build(base, dict(turbo=turbo, steps=None, cfg=None, sampler=None, slg=False), sftbench.PROMPTS['anime'])
    if not turbo:  # build() would write steps/cfg/sampler; undo to the baked values
        g = sftbench.build(base, dict(turbo=True, steps=None, cfg=None, sampler=None, slg=False), sftbench.PROMPTS['anime'])
        g['690']['inputs']['boolean'] = False
    tag = 'shipped_' + ('turbo' if turbo else 'sft') + '_anime'
    r = {'variant': tag, **sftbench.mossbench.run_one(g, tag)}
    print(json.dumps(r), flush=True)
