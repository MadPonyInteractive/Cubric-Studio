# MPI-1039 round 57: FRONT FIRST as built in the Flow (multiAnglePlan, 2026-10-26). Round 55's four non-FLUX inputs
# that face frame-right, every turn stop, exactly as the runner chains it: the app's own describer reads each input
# with MULTI_ANGLE_DESCRIBE_ASK (the new PEOPLE line), r57_plan.mjs builds the passes, each pass = FLUX.3 Turbo + its
# padded room doll. The front pass is the same edit for every stop of one input (same picture, words, ref and seed),
# so it runs once per input and every stop's turn pass starts from it - what the runner would make with seed 111.
#   python r57.py <port>   (under gpu_lease.py run)  |  python r57.py sheet
import json, os, subprocess, sys, urllib.request
import angles as a
import r53
import r55

HERE = os.path.dirname(os.path.abspath(__file__))
DONE = os.path.join(a.OUT, 'mq_blender57.json')
TEXTS = os.path.join(a.OUT, 'mq_blender57_describe.json')
ASK = subprocess.run(['node', '--input-type=module', '-e', "import { MULTI_ANGLE_DESCRIBE_ASK as A } from "
                      "'../../../../../js/data/flowPrompts/multiAngle.js'; process.stdout.write(A);"],
                     capture_output=True, text=True, check=True, cwd=HERE).stdout
INPUTS = {name: v[0] for name, v in r55.INPUTS.items()}
STOPS = ['front', 'tq_fl', 'tq_fr', 'pr_l', 'pr_r', 'tq_bl', 'tq_br', 'back']


def describe(port, image):
    req = urllib.request.Request(f'http://127.0.0.1:{port}/connector/describe', json.dumps(
        {'imagePath': a.disk(image), 'question': ASK}).encode(), {'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=600))
    if not r.get('ok'):
        sys.exit(f'describe: {r}')
    return r['output']['text']


def plans(texts):
    js = subprocess.run(['node', os.path.join(HERE, 'r57_plan.mjs')], input=json.dumps(texts), capture_output=True,
                        text=True, check=True, cwd=HERE)
    return json.loads(js.stdout)


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    texts = json.load(open(TEXTS)) if os.path.exists(TEXTS) else {}
    for name, img in INPUTS.items():
        if name not in texts:
            texts[name] = describe(port, img)
            print(name, '->', texts[name].replace('\n', ' | ')[:200], flush=True)
            json.dump(texts, open(TEXTS, 'w'), indent=1)
    P = plans(texts)
    json.dump(P, open(os.path.join(a.OUT, 'mq_blender57_plans.json'), 'w'), indent=1)
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for name, img in INPUTS.items():
        plan = P[name]
        fronts = {json.dumps(plan[s][0]) for s in STOPS if plan[s] and plan[s][0]['kind'] == 'front'}
        assert len(fronts) <= 1, f'{name}: the front pass differs between stops'
        for stop in STOPS:
            inp = img
            for i, step in enumerate(plan[stop]):
                key = f'{name}|front' if step['kind'] == 'front' else f'{name}|{stop}|{step["kind"]}'
                if key not in res:
                    res[key] = a.gen(port, {**r53.FLUX3, 'seed': 111, 'cardName': f'angles mq57 {key}',
                                            'positive': step['prompt'], 'media': [
                                                {'role': 'inputImage', 'url': inp},
                                                {'role': 'inputImage2', 'url': r53.ref(port, step['ref'], inp)}]})
                    json.dump(res, open(DONE, 'w'), indent=1)
                inp = res[key]
    sheet()


def sheet():
    res = json.load(open(DONE))
    rows = [[(None, 'input'), (None, 'front pass')] + [(None, s) for s in STOPS[1:]]]
    for name, img in INPUTS.items():
        rows.append([(img, f'IN {name}'), (res.get(f'{name}|front'), 'front')]
                    + [(res.get(f'{name}|{s}|turn'), s) for s in STOPS[1:]])
    a._sheet(rows, 'r57_front_first', cell=180, h=340)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
