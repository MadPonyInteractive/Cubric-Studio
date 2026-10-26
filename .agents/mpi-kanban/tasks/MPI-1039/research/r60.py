# MPI-1039 round 60: TWO PEOPLE (Fabio 2026-10-26: no front pass with two or more - it would turn everyone to the
# camera). Two non-FLUX two-person sources (Qwen-Image 2.1 t2i: a photo and an anime street, both people facing the
# camera), the app's describer with the Flow's ask (expect PEOPLE: 2), r57_plan.mjs (expect ONE turn pass per stop,
# no front), FLUX.3 Turbo seed 111 to pr_l, tq_fl, tq_br.
#   python r60.py <port>   (under gpu_lease.py run)  |  python r60.py sheet
import json, os, sys
import angles as a
import r53
import r57

DONE = os.path.join(a.OUT, 'mq_blender60.json')
TEXTS = os.path.join(a.OUT, 'mq_blender60_describe.json')
SOURCES = {
    'photo two': 'A full-body studio photograph of two adults standing side by side a little apart, both facing the '
                 'camera at eye level: on the left a woman with shoulder-length dark hair in a rust-orange sweater, '
                 'dark blue jeans and white sneakers; on the right a man with short brown hair in a green jacket, '
                 'grey trousers and brown boots. Plain warm grey backdrop and floor, soft even light, head to feet in '
                 'frame.',
    'anime two': 'A flat 2D anime drawing, clean outlines and flat colours: two young adults standing side by side a '
                 'little apart in a narrow Japanese shopping street, both facing the viewer, seen from head to feet: '
                 'on the left a girl with short red hair in an orange sweater and purple jeans, on the right a boy with '
                 'black hair in a navy hoodie and khaki trousers. Shop fronts, awnings and power lines at both sides.',
}
STOPS = ['pr_l', 'tq_fl', 'tq_br']


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    texts = json.load(open(TEXTS)) if os.path.exists(TEXTS) else {}
    for name, prompt in SOURCES.items():
        if name not in res:
            res[name] = a.gen(port, {'modelId': 'qwen-image-2-1', 'operation': 't2i', 'ratio': '4:5', 'seed': 111,
                                     'cardName': f'angles mq60 {name}', 'positive': prompt})
            json.dump(res, open(DONE, 'w'), indent=1)
        if name not in texts:
            texts[name] = r57.describe(port, res[name])
            print(name, '->', texts[name].replace('\n', ' | ')[:160], flush=True)
            json.dump(texts, open(TEXTS, 'w'), indent=1)
    P = r57.plans(texts)
    json.dump(P, open(os.path.join(a.OUT, 'mq_blender60_plans.json'), 'w'), indent=1)
    for name in SOURCES:
        print(name, 'people', P[name]['people'], {s: [x['kind'] for x in P[name][s]] for s in STOPS}, flush=True)
        for stop in STOPS:
            inp = res[name]
            for step in P[name][stop]:
                key = f'{name}|{stop}|{step["kind"]}'
                if key not in res:
                    res[key] = a.gen(port, {**r53.FLUX3, 'seed': 111, 'cardName': f'angles mq60 {key}',
                                            'positive': step['prompt'], 'media': [
                                                {'role': 'inputImage', 'url': inp},
                                                {'role': 'inputImage2', 'url': r53.ref(port, step['ref'], inp)}]})
                    json.dump(res, open(DONE, 'w'), indent=1)
                inp = res[key]
    sheet()


def sheet():
    res = json.load(open(DONE))
    rows = [[(None, 'source')] + [(None, s) for s in STOPS]]
    for name in SOURCES:
        rows.append([(res.get(name), name)] + [(res.get(f'{name}|{s}|turn') or res.get(f'{name}|{s}|front'), s)
                                               for s in STOPS])
    a._sheet(rows, 'r60_two_people', cell=260, h=340)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
