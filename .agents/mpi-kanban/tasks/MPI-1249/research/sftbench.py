"""MPI-1249 SFT settings A/B on the SHIPPED graph (comfy_workflows/moss_t2i.json), Fabio's G:\\ComfyUi :8188.

  gpu_lease.py run --poll 2 -- python -I sftbench.py [variant ...]

Variants (all SFT except turbo):
  ours    25 steps, cfg 2.5, er_sde/simple, no SLG (what ships)
  moss50  50 steps, cfg 3, euler/simple, SkipLayerGuidanceDiTSimple single '22' 0-0.5 (OpenMOSS card / template's Base SLG)
  moss25  25 steps, cfg 3, euler/simple, same SLG (the step count without the Spectrum node)
  turbo   8 steps, cfg 1 (reference)
Writes research/bench/<variant>_<prompt>.png + results.jsonl. The graph changes in memory only.
"""
import copy, json, os, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, '..', '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(REPO, '.agents', 'mpi-kanban', 'tasks', 'MPI-1180', 'research'))
import mossbench  # noqa: E402  ponytail: reuse its queue/poll/save loop

mossbench.OUT = OUT = os.path.join(HERE, 'bench')
GRAPH = os.path.join(REPO, 'comfy_workflows', 'moss_t2i.json')

ANIME = ("A vibrant anime-style illustration depicts a superheroine soaring through the sky above a sprawling cityscape. "
         "She fills roughly two-thirds of the frame\u2019s height, her dynamic pose capturing a moment of flight with one arm "
         "outstretched and the other bent, propelling her forward. Below, a dense network of buildings stretches into the "
         "distance, dominated by immense skyscrapers with gleaming facades and sharp angles. \n\nThe camera is positioned at "
         "a slight upward angle, giving the viewer a sense of looking up at the scene. Rows of windows line the skyscrapers, "
         "reflecting the bright daylight. In one window, near the center of the frame, a small girl is visible, her hand "
         "pressed against the glass as she waves enthusiastically at the superheroine. The color palette is bold and "
         "saturated, featuring blues and grays for the buildings, contrasted by the hero\u2019s bright costume. A faint grid "
         "pattern of city streets is visible in the background. The hero's cape streams behind her, a cascade of vivid "
         "color against the clear blue sky.")
HERO = ("Realistic photo of A Superhero woman flying high in the sky over and through rows of buildings in a city with "
        "huge skyscrapers. In one of the windows of the skyscraper is a little girl waving at her.")
SKY = ("A photograph shows a woman skydiving. She is mid-air, angled slightly to the right, having just exited the open "
       "doorway of a small, single-engine aircraft. The plane fills the left side of the frame, its silver fuselage "
       "gleaming in the bright sunlight. The woman, dressed in a bright red jumpsuit with a white stripe down the side, "
       "is positioned in the center of the frame, her arms outstretched and her body slightly arched. Below her, a vast "
       "expanse of blue sky stretches to the horizon, punctuated by a few fluffy white clouds.\n\nThe sunlight casts "
       "strong shadows on the woman\u2019s jumpsuit and highlights the texture of the fabric. The sky is a gradient of pale "
       "blue near the horizon, darkening to a deeper azure overhead. The plane\u2019s propeller is a blurred disc, indicating "
       "motion. In the far background, barely visible through the haze, are rolling green hills. The woman\u2019s helmet "
       "has a small, rectangular label on the back that reads \u201c\"SKY HIGH FUN\"\".")
# name -> (prompt, style selector, width, height, seed). Seeds are Fabio's cards (t2i_046, t2i_044-ish, t2i_023).
PROMPTS = {
    'anime': (ANIME, 1, 896, 1088, 272685418),
    'hero': (HERO, 0, 896, 1088, 272685418),
    'sky': (SKY, 0, 1344, 768, 2418241598),
}
VARIANTS = {
    'ours': dict(turbo=False, steps=25, cfg=2.5, sampler='er_sde', slg=False),
    'moss50': dict(turbo=False, steps=50, cfg=3.0, sampler='euler', slg=True),
    'moss25': dict(turbo=False, steps=25, cfg=3.0, sampler='euler', slg=True),
    # run after abb125596: the shipped graph already carries the SLG node, so slg=False here
    'erslg': dict(turbo=False, steps=25, cfg=3.0, sampler='er_sde', slg=False),
    'turbo': dict(turbo=True, steps=None, cfg=None, sampler=None, slg=False),
}


def build(base, v, p):
    g = copy.deepcopy(base)
    text, style, w, h, seed = p
    g['93']['inputs']['string'] = text
    g['103']['inputs']['selector'] = style
    g['324']['inputs']['int'], g['325']['inputs']['int'] = w, h
    g['33']['inputs']['int'] = seed
    g['304']['inputs']['int'] = 1  # t2i
    g['690']['inputs']['boolean'] = v['turbo']
    if not v['turbo']:
        g['734']['inputs']['int'] = v['steps']
        g['753']['inputs']['float'] = v['cfg']
        g['738']['inputs']['sampler_name'] = v['sampler']
    if v['slg']:
        g['9001'] = {'class_type': 'SkipLayerGuidanceDiTSimple', '_meta': {'title': 'bench SLG'},
                     'inputs': {'model': g['738']['inputs']['model'], 'double_layers': '', 'single_layers': '22',
                                'start_percent': 0.0, 'end_percent': 0.5}}
        g['738']['inputs']['model'] = ['9001', 0]
    return g


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    base = json.load(open(GRAPH, encoding='utf-8'))
    for vn in (sys.argv[1:] or list(VARIANTS)):
        for pn, p in PROMPTS.items():
            r = {'variant': vn, 'prompt': pn, 'at': time.strftime('%Y-%m-%dT%H:%M:%S'),
                 **mossbench.run_one(build(base, VARIANTS[vn], p), f'{vn}_{pn}')}
            print(json.dumps(r), flush=True)
            with open(os.path.join(OUT, 'results.jsonl'), 'a', encoding='utf-8') as f:
                f.write(json.dumps(r) + '\n')
