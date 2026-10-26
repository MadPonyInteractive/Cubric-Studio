# MPI-1039 round 66: step 2 "match your picture" (Fabio 2026-10-26). The user matches Cosmo to the input, so a pick that
# moves only the HEIGHT or the ZOOM runs no turn pass - the height / zoom pass alone, with the words and doll of the
# matched view. Never benched: every height and zoom so far ran on a front input or on a view the Flow had just turned.
# Inputs = side and rear pictures made by NEITHER edit model (Krea2 photo, Illustrious anime t2i), as a user's would be.
# The start view of each is set by eye (as the user would in step 2) in STARTS below, after `sources`.
#   python r66.py sources <port>   (under gpu_lease.py run) - then pick + set STARTS
#   python r66.py <port>           (under gpu_lease.py run)  |  python r66.py sheet
import json, os, subprocess, sys
import angles as a
import r53
import r57

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(a.OUT, 'mq_blender66_sources.json')
DONE = os.path.join(a.OUT, 'mq_blender66.json')
TEXTS = os.path.join(a.OUT, 'mq_blender66_describe.json')
PHOTO = ('Full-body photograph of a woman in her early thirties with dark brown wavy shoulder-length hair, wearing a '
         'rust-orange turtleneck sweater, dark blue jeans and white sneakers, standing on a sunlit old town square with '
         'stone buildings and cafe tables, natural daylight, eye-level camera, her whole body from head to feet in '
         'frame. ')
ANIME = ('masterpiece, best quality, flat anime illustration, clean lineart, flat colors, 1girl, solo, short red hair, '
         'orange sweater, purple jeans, white sneakers, standing, full body, head to feet, narrow japanese shopping '
         'street, shop fronts, awnings, power lines, eye level, ')
SOURCES = {  # name: (model, prompt)
    'photo side': ('krea2', PHOTO + 'She is seen in exact side profile from her right side, facing frame-right, '
                   'her nose pointing at the right edge of the picture.'),
    'photo rear': ('krea2', PHOTO + 'She is seen from behind at a three-quarter angle, walking away from the camera: '
                   'her back and the back of her head face the camera, her face is not visible.'),
    'photo back': ('krea2', PHOTO + 'She is seen directly from behind, her back to the camera, facing away into the '
                   'square; her face is not visible.'),
    'anime side': ('ill-anime', ANIME + 'from side, profile, facing right'),
    'anime rear': ('ill-anime', ANIME + 'from behind, three-quarter back view, facing away'),
    'anime back': ('ill-anime', ANIME + 'from behind, back view, facing away, back of head'),
}
SEEDS = (111, 222)
# Set by eye on sheets/r66_sources.jpg + larger crops (step 2's match). Illustrious gave no rear 3/4 (both "rear" and
# "back" came out straight backs) and an odd bent pose for anime side 111, so: one picture per view, the clearest.
STARTS = {'photo side|111': 'pr_r', 'photo rear|222': 'tq_br', 'photo back|111': 'back',
          'anime side|222': 'pr_r', 'anime rear|111': 'back', 'anime back|222': 'back'}


def sources(port):
    res = json.load(open(SRC)) if os.path.exists(SRC) else {}
    for name, (model, prompt) in SOURCES.items():
        for seed in SEEDS:
            key = f'{name}|{seed}'
            if key not in res:
                res[key] = a.gen(port, {'modelId': model, 'operation': 't2i', 'ratio': '4:5', 'seed': seed,
                                        'cardName': f'angles mq66 src {key}', 'positive': prompt})
                json.dump(res, open(SRC, 'w'), indent=1)
    a._sheet([[(res.get(f'{n}|{s}'), f'{n} {s}') for s in SEEDS] for n in SOURCES], 'r66_sources', cell=300, h=400)


def plans(texts):
    js = subprocess.run(['node', os.path.join(HERE, 'r66_plan.mjs')], input=json.dumps(
        {k: {'text': texts[k], 'start': STARTS[k]} for k in STARTS}), capture_output=True, text=True, check=True, cwd=HERE)
    return json.loads(js.stdout)


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    src = json.load(open(SRC))
    texts = json.load(open(TEXTS)) if os.path.exists(TEXTS) else {}
    for k in STARTS:
        if k not in texts:
            texts[k] = r57.describe(port, src[k])
            print(k, '->', texts[k].replace('\n', ' | ')[:200], flush=True)
            json.dump(texts, open(TEXTS, 'w'), indent=1)
    P = plans(texts)
    json.dump(P, open(os.path.join(a.OUT, 'mq_blender66_plans.json'), 'w'), indent=1)
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for k, plan in P.items():
        for pick, steps in plan.items():
            if not isinstance(steps, list):
                continue
            for seed in SEEDS:
                inp = src[k]
                for i, step in enumerate(steps):
                    key = f'{k}|{pick}|{seed}|{i}'
                    if key not in res:
                        model = r53.FLUX3 if step['model'] == 'flux3-klein' else a.QWEN29
                        media = [{'role': 'inputImage', 'url': inp}]
                        if step['ref']:
                            media.append({'role': 'inputImage2', 'url': r53.ref(port, step['ref'], inp)})
                        res[key] = a.gen(port, {**model, 'seed': seed, 'cardName': f'angles mq66 {key}',
                                                'positive': step['prompt'], 'media': media})
                        json.dump(res, open(DONE, 'w'), indent=1)
                    inp = res[key]
    sheet()


def last(res, k, pick, seed, n):
    return res.get(f'{k}|{pick}|{seed}|{n - 1}')


def sheet():
    src, res = json.load(open(SRC)), json.load(open(DONE))
    P = json.load(open(os.path.join(a.OUT, 'mq_blender66_plans.json')))
    for seed in SEEDS:
        rows = []
        for k, plan in P.items():
            picks = [p for p, s in plan.items() if isinstance(s, list)]
            rows.append([(src[k], f'IN {k} = {plan["start"]}')] +
                        [(last(res, k, p, seed, len(plan[p])), f'{p} ({len(plan[p])}p)') for p in picks])
        a._sheet(rows, f'r66_match_{seed}', cell=240, h=320)


if __name__ == '__main__':
    if sys.argv[1] == 'sheet':
        sheet()
    elif sys.argv[1] == 'sources':
        sources(int(sys.argv[2]))
    else:
        run(int(sys.argv[1]))
