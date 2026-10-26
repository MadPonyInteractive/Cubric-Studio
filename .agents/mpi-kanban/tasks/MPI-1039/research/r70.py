# MPI-1039 round 70: what a LOW or HIGH start can take besides a zoom (Fabio 2026-10-26: "zoom only makes the flow
# useless"). Per input: turns that STAY at the start's height (FLUX.3, doll at the target turn and the start height),
# the OTHER height (the shipped height words), and back to EYE LEVEL (round 68's levelF: FLUX.3 + room doll) - each
# with and without the user's EYE-LEVEL picture of the same person as image 3 (the Whole Outfit slot). Inputs: Fabio's
# case (edit_006 = low rear 3/4 right, made from his front eye-level picture) and round 67's six part-B starts, whose
# eye-level pictures are new same-prompt, same-seed fronts. The six's no-ref height cells reuse rounds 67/68.
#   python r70.py sources <port>   (under gpu_lease.py run)
#   python r70.py <port>           (under gpu_lease.py run)  |  python r70.py sheet
import json, os, shutil, subprocess, sys, urllib.parse
import angles as a
import r53
import r57
import r67

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(a.OUT, 'mq_blender70_sources.json')
DONE = os.path.join(a.OUT, 'mq_blender70.json')
TEXTS = os.path.join(a.OUT, 'mq_blender70_describe.json')
PLANS = os.path.join(a.OUT, 'mq_blender70_plans.json')
FABIO = os.path.expandvars(r'%USERPROFILE%\Documents\Cubric Studio\Projects\Draw it in improvements\Media')
SEEDS = (111, 222)
# The same prompt as the r67 start, at eye level from the front, same seed: the user's "other picture" of that person.
EYE = {'photo|111': ('krea2', 111, r67.PHOTO + 'Eye-level shot from the front: she faces the camera.'),
       'photo|222': ('krea2', 222, r67.PHOTO + 'Eye-level shot from the front: she faces the camera.'),
       'anime|222': ('ill-anime', 222, r67.ANIME + 'facing viewer, straight-on, eye level')}
# key -> (start turn, start height, turns to try at that height)
STARTS = {'fabio tq_br lo': ('tq_br', 'lo', ['front', 'pr_r', 'tq_fl']),
          'photo front lo|111': ('front', 'lo', ['pr_r', 'tq_br']), 'photo front hi|111': ('front', 'hi', ['pr_r', 'tq_br']),
          'photo side hi|222': ('pr_r', 'hi', ['front', 'back']), 'anime front lo|222': ('front', 'lo', ['pr_r', 'tq_br']),
          'anime front hi|222': ('front', 'hi', ['pr_r', 'tq_br']), 'anime back hi|222': ('back', 'hi', ['front', 'pr_l'])}


def _bench(name, path):  # into the bench project's Media, as a /project-file URL like every other input
    out = os.path.join(a.PROJECT, 'Media', name)
    if not os.path.exists(out):
        shutil.copyfile(path, out)
    return '/project-file?path=' + urllib.parse.quote(out, safe='')


def inputs():
    """name -> (image, eye-level picture)."""
    src67, src = json.load(open(r67.SRC)), json.load(open(SRC)) if os.path.exists(SRC) else {}
    res = {'fabio tq_br lo': (_bench('r70_fabio_edit_006.png', os.path.join(FABIO, 'edit_006.png')),
                              _bench('r70_fabio_front.png', os.path.join(FABIO, 'control_c6213e9f.png')))}
    for k in list(STARTS)[1:]:
        res[k] = (src67[k], src.get(f'{k.split()[0]}|{k.split("|")[1]}'))
    return res


def sources(port):
    res = json.load(open(SRC)) if os.path.exists(SRC) else {}
    for key, (model, seed, prompt) in EYE.items():
        if key not in res:
            res[key] = a.gen(port, {'modelId': model, 'operation': 't2i', 'ratio': '4:5', 'seed': seed,
                                    'cardName': f'angles mq70 eye {key}', 'positive': prompt})
            json.dump(res, open(SRC, 'w'), indent=1)
    a._sheet([[(res.get(k), f'eye {k}')] + [(json.load(open(r67.SRC)).get(s), s) for s in STARTS if s.startswith(k.split('|')[0])
              and s.endswith(k.split('|')[1])] for k in EYE], 'r70_sources', cell=240, h=320)


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    ins = inputs()
    texts = json.load(open(TEXTS)) if os.path.exists(TEXTS) else {}
    t67 = json.load(open(r67.TEXTS))
    for k, (img, _eye) in ins.items():
        if k not in texts:
            texts[k] = t67.get(k) or r57.describe(port, img)
            json.dump(texts, open(TEXTS, 'w'), indent=1)
    js = subprocess.run(['node', os.path.join(HERE, 'r70_plan.mjs')], input=json.dumps(
        {k: {'text': texts[k], 'start': s, 'height': h, 'turns': t} for k, (s, h, t) in STARTS.items()}),
        capture_output=True, text=True, check=True, cwd=HERE)
    P = json.loads(js.stdout)
    json.dump(P, open(PLANS, 'w'), indent=1)
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for seed in SEEDS:
        for k, plan in P.items():
            img, eye = ins[k]
            for cell, step in plan.items():
                if not isinstance(step, dict) or 'error' in step:
                    continue
                for ref3 in (False, True):
                    # rounds 67/68 already ran the six's height cells without a picture
                    if not ref3 and cell in ('other', 'level') and k != 'fabio tq_br lo':
                        continue
                    key = f'{k}|{cell}|{"ref" if ref3 else "no"}|{seed}'
                    if key in res:
                        continue
                    model = r53.FLUX3 if step['model'] == 'flux3-klein' else a.QWEN29
                    media = [{'role': 'inputImage', 'url': img},
                             {'role': 'inputImage2', 'url': r53.ref(port, step['ref'], img)}]
                    if ref3:
                        media.append({'role': 'inputImage3', 'url': eye})
                    res[key] = a.gen(port, {**model, 'seed': seed, 'cardName': f'angles mq70 {key}',
                                            'positive': step['prompt3' if ref3 else 'prompt'], 'media': media})
                    json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    ins, res, P = inputs(), json.load(open(DONE)), json.load(open(PLANS))
    r67d, r68d = (json.load(open(os.path.join(a.OUT, f'mq_blender{n}.json'))) for n in (67, 68))
    for seed in SEEDS:
        rows = []
        for k, plan in P.items():
            s, h = plan['start'], plan['height']
            other = 'lo' if h == 'hi' else 'hi'
            row = [(ins[k][0], f'IN {k} = {s} {h}'), (ins[k][1], 'eye-level picture')]
            for cell in [c for c in plan if isinstance(plan[c], dict) and c not in ('other', 'level')]:
                row += [(res.get(f'{k}|{cell}|no|{seed}'), f'{cell} @{h}'), (res.get(f'{k}|{cell}|ref|{seed}'), f'{cell} @{h} +pic')]
            if k == 'fabio tq_br lo':
                no_other, no_level = res.get(f'{k}|other|no|{seed}'), res.get(f'{k}|level|no|{seed}')
            else:
                no_other = r67d.get(f'{k}|{other}|{seed}|0')
                no_level = r68d.get(f'{k}|levelF|{seed}|0')
            row += [(no_other, f'{other} (r67)' if k != 'fabio tq_br lo' else other),
                    (res.get(f'{k}|other|ref|{seed}'), f'{other} +pic'),
                    (no_level, 'level (r68)' if k != 'fabio tq_br lo' else 'level'), (res.get(f'{k}|level|ref|{seed}'), 'level +pic')]
            rows.append(row)
        a._sheet(rows, f'r70_{seed}', cell=220, h=300)


if __name__ == '__main__':
    if sys.argv[1] == 'sheet':
        sheet()
    elif sys.argv[1] == 'sources':
        sources(int(sys.argv[2]))
    else:
        run(int(sys.argv[1]))
