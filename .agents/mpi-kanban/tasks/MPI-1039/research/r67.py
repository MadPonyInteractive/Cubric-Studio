# MPI-1039 round 67, before the step-2 build. (A) Round 66: a low on an unturned SIDE view cuts the head off the top
# 4/4 - the side low words with a framing line (v1 headroom, v2 headroom + the camera a few steps back), on the r66 side
# inputs and their mirrors (pr_l). (B) A start that is NOT eye level, never benched: low / high pictures made by neither
# edit model, matched by eye as the user would in step 2, then back to eye level (new words), the other height, or a
# zoom at the same height - no turn pass, no pass for the height the picture already has. r67_plan.mjs builds them.
#   python r67.py sources <port>   (under gpu_lease.py run) - then pick + set STARTS_B
#   python r67.py <port>           (under gpu_lease.py run)  |  python r67.py sheet
import json, os, subprocess, sys, urllib.parse
from PIL import Image, ImageOps
import angles as a
import r53
import r57

HERE = os.path.dirname(os.path.abspath(__file__))
SRC66 = os.path.join(a.OUT, 'mq_blender66_sources.json')
TEXTS66 = os.path.join(a.OUT, 'mq_blender66_describe.json')
SRC = os.path.join(a.OUT, 'mq_blender67_sources.json')
DONE = os.path.join(a.OUT, 'mq_blender67.json')
TEXTS = os.path.join(a.OUT, 'mq_blender67_describe.json')
PLANS = os.path.join(a.OUT, 'mq_blender67_plans.json')
PHOTO = ('Full-body photograph of a woman in her early thirties with dark brown wavy shoulder-length hair, wearing a '
         'rust-orange turtleneck sweater, dark blue jeans and white sneakers, standing on a sunlit old town square with '
         'stone buildings and cafe tables, natural daylight, her whole body from head to feet in frame. ')
ANIME = ('masterpiece, best quality, flat anime illustration, clean lineart, flat colors, 1girl, solo, short red hair, '
         'orange sweater, purple jeans, white sneakers, standing, full body, head to feet, narrow japanese shopping '
         'street, shop fronts, awnings, power lines, ')
SOURCES = {  # name: (model, prompt) - part B
    'photo front lo': ('krea2', PHOTO + 'Low-angle shot: the camera is just above the cobbles in front of her, looking '
                       'steeply up at her; her sneakers and legs are large near the bottom of the picture, her body '
                       'narrows upward, and the sky and the tops of the buildings are above her. She faces the camera.'),
    'photo front hi': ('krea2', PHOTO + 'High-angle shot: the camera is high above and in front of her, looking steeply '
                       'down at her; the top of her head and her shoulders are large near the top of the picture, her '
                       'feet are small on the cobbles below, and the cobbles fill the background. She faces the camera.'),
    'photo side hi': ('krea2', PHOTO + 'High-angle shot from high above at her right side, looking steeply down at her: '
                      'she is in exact side profile facing frame-right, her nose pointing at the right edge, and the '
                      'cobbles fill the background.'),
    'anime front lo': ('ill-anime', ANIME + "from below, low angle, worm's eye view, facing viewer, sky"),
    'anime front hi': ('ill-anime', ANIME + 'from above, high angle, facing viewer, looking up'),
    'anime back hi': ('ill-anime', ANIME + 'from above, high angle, from behind, back view, facing away'),
}
SEEDS = (111, 222)
# (A) the r66 side inputs (pr_r) and their mirrors (pr_l).
INPUTS_A = {'photo side|111': 'pr_r', 'anime side|222': 'pr_r'}
# (B) set by eye on sheets/r67_sources.jpg: key -> (turn, height).
STARTS_B = {'photo front lo|111': ('front', 'lo'), 'photo front hi|111': ('front', 'hi'),
            'photo side hi|222': ('pr_r', 'hi'), 'anime front lo|222': ('front', 'lo'),
            'anime front hi|222': ('front', 'hi'), 'anime back hi|222': ('back', 'hi')}


def mirror(url):  # into the bench project's Media, as a /project-file URL like every other input
    path = a.disk(url)
    out = os.path.join(os.path.dirname(path), 'r67_mirror_' + os.path.basename(path))
    if not os.path.exists(out):
        ImageOps.mirror(Image.open(path)).save(out)
    return '/project-file?path=' + urllib.parse.quote(out, safe='')


def inputs():
    """name -> (image, start, height, part)."""
    src66, src = json.load(open(SRC66)), json.load(open(SRC)) if os.path.exists(SRC) else {}
    res = {}
    for k, turn in INPUTS_A.items():
        res[k] = (src66[k], turn, 'level', 'A')
        res[k + ' mirror'] = (mirror(src66[k]), 'pr_l', 'level', 'A')
    for k, (turn, height) in STARTS_B.items():
        res[k] = (src[k], turn, height, 'B')
    return res


def sources(port):
    res = json.load(open(SRC)) if os.path.exists(SRC) else {}
    for name, (model, prompt) in SOURCES.items():
        for seed in SEEDS:
            key = f'{name}|{seed}'
            if key not in res:
                res[key] = a.gen(port, {'modelId': model, 'operation': 't2i', 'ratio': '4:5', 'seed': seed,
                                        'cardName': f'angles mq67 src {key}', 'positive': prompt})
                json.dump(res, open(SRC, 'w'), indent=1)
    a._sheet([[(res.get(f'{n}|{s}'), f'{n} {s}') for s in SEEDS] for n in SOURCES], 'r67_sources', cell=300, h=400)


def plans(ins, texts):
    js = subprocess.run(['node', os.path.join(HERE, 'r67_plan.mjs')], input=json.dumps(
        {k: {'text': texts[k], 'start': s, 'height': h, 'part': part} for k, (_, s, h, part) in ins.items()}),
        capture_output=True, text=True, check=True, cwd=HERE)
    return json.loads(js.stdout)


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    ins = inputs()
    texts66 = json.load(open(TEXTS66))
    texts = json.load(open(TEXTS)) if os.path.exists(TEXTS) else {}
    for k, (img, *_rest) in ins.items():
        if k not in texts:
            texts[k] = texts66.get(k) or r57.describe(port, img)
            print(k, '->', texts[k].replace('\n', ' | ')[:200], flush=True)
            json.dump(texts, open(TEXTS, 'w'), indent=1)
    P = plans(ins, texts)
    json.dump(P, open(PLANS, 'w'), indent=1)
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for k, plan in P.items():
        for pick, steps in plan.items():
            if not isinstance(steps, list):
                continue
            for seed in SEEDS:
                inp = ins[k][0]
                for i, step in enumerate(steps):
                    key = f'{k}|{pick}|{seed}|{i}'
                    if key not in res:
                        model = r53.FLUX3 if step['model'] == 'flux3-klein' else a.QWEN29
                        media = [{'role': 'inputImage', 'url': inp}]
                        if step['ref']:
                            media.append({'role': 'inputImage2', 'url': r53.ref(port, step['ref'], inp)})
                        res[key] = a.gen(port, {**model, 'seed': seed, 'cardName': f'angles mq67 {key}',
                                                'positive': step['prompt'], 'media': media})
                        json.dump(res, open(DONE, 'w'), indent=1)
                    inp = res[key]
    sheet()


def sheet():
    ins, res, P = inputs(), json.load(open(DONE)), json.load(open(PLANS))
    for part in ('A', 'B'):
        for seed in SEEDS:
            rows = []
            for k, plan in P.items():
                if ins[k][3] != part:
                    continue
                picks = [p for p, s in plan.items() if isinstance(s, list)]
                rows.append([(ins[k][0], f'IN {k} = {plan["start"]} {plan["height"]}')] +
                            [(res.get(f'{k}|{p}|{seed}|{len(plan[p]) - 1}'), f'{p} ({len(plan[p])}p)') for p in picks])
            a._sheet(rows, f'r67_{part}_{seed}', cell=240, h=320)


if __name__ == '__main__':
    if sys.argv[1] == 'sheet':
        sheet()
    elif sys.argv[1] == 'sources':
        sources(int(sys.argv[2]))
    else:
        run(int(sys.argv[1]))
