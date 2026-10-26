# MPI-1039 round 61, after round 59 (front first with BOTH passes on FLUX.3 freezes on the second pass - FLUX-on-FLUX -
# front-left stops 4/16 on side, against 12/16 for one direct pass). QF = the front pass on QWEN (QWEN29 edit, the
# same front words, room/front doll - round 52b: Qwen front 8/8, place kept), then the Flow's FLUX.3 Turbo turn pass on
# that non-FLUX front (round 54: FLUX.3 turns Qwen-made pictures). Never the same model twice in a row again.
# Round 55's four frame-right inputs, seeds 111/222/333, stops tq_fl, tq_fr, pr_l, tq_bl (+ pr_r, tq_br, back on 111).
#   python r61.py <port>   (under gpu_lease.py run)  |  python r61.py sheet
import json, os, sys
import angles as a
import r53
import r57

DONE = os.path.join(a.OUT, 'mq_blender61.json')
STOPS = ['tq_fl', 'tq_fr', 'pr_l', 'tq_bl']
MORE = ['pr_r', 'tq_br', 'back']
SEEDS = [111, 222, 333]


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    P = json.load(open(os.path.join(a.OUT, 'mq_blender57_plans.json')))
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}

    def edit(key, model, image, step, seed):
        if key not in res:
            res[key] = a.gen(port, {**model, 'seed': seed, 'cardName': f'angles mq61 {key}',
                                    'positive': step['prompt'], 'media': [
                                        {'role': 'inputImage', 'url': image},
                                        {'role': 'inputImage2', 'url': r53.ref(port, step['ref'], image)}]})
            json.dump(res, open(DONE, 'w'), indent=1)
        return res[key]

    for seed in SEEDS:
        for name, img in r57.INPUTS.items():
            for stop in STOPS + (MORE if seed == 111 else []):
                front, turn = P[name][stop]
                f = edit(f'{name}|front|{seed}', a.QWEN29, img, front, seed)
                edit(f'{name}|{stop}|{seed}', r53.FLUX3, f, turn, seed)
    sheet()


def sheet():
    res = json.load(open(DONE))
    rows = [[(None, 'input'), (None, 'Qwen front')] + [(None, s) for s in STOPS + MORE]]
    for seed in SEEDS:
        for name, img in r57.INPUTS.items():
            rows.append([(img, f'{name} {seed}'), (res.get(f'{name}|front|{seed}'), 'front')]
                        + [(res.get(f'{name}|{s}|{seed}'), s) for s in STOPS + MORE])
    a._sheet(rows, 'r61_qwen_front', cell=150, h=290)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
