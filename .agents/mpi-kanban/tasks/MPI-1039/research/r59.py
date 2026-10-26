# MPI-1039 round 59, after round 57 (front first: photos 16/16, but both anime inputs land every LEFT stop on the
# input's right side or freeze, 0/6, where round 55's direct pass reached the left side): is it the method or the seed?
# Seeds 222 and 333, the stops that differ (tq_fl, tq_fr, pr_l, tq_bl), FLUX.3 Turbo + room doll + the Flow's words:
#   FF = front first, as the Flow builds it for one person (front pass and turn pass both on that seed)
#   D  = one direct pass from the input, as the Flow builds it for two or more people
# Anime inputs both ways; the photo inputs front first only (seed 222), to check round 57's 16/16 is not one seed.
#   python r59.py <port>   (under gpu_lease.py run)  |  python r59.py sheet
import json, os, subprocess, sys
import angles as a
import r53
import r57

HERE = os.path.dirname(os.path.abspath(__file__))
DONE = os.path.join(a.OUT, 'mq_blender59.json')
STOPS = ['tq_fl', 'tq_fr', 'pr_l', 'tq_bl']
CELLS = [(n, s, m) for n in ('anime pr_r', 'anime tq_fr') for s in (222, 333) for m in ('FF', 'D')] \
    + [(n, 222, 'FF') for n in ('photo pr_r', 'photo tq_fr')]


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    P = json.load(open(os.path.join(a.OUT, 'mq_blender57_plans.json')))
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}

    def edit(key, image, step, seed):
        if key not in res:
            res[key] = a.gen(port, {**r53.FLUX3, 'seed': seed, 'cardName': f'angles mq59 {key}',
                                    'positive': step['prompt'], 'media': [
                                        {'role': 'inputImage', 'url': image},
                                        {'role': 'inputImage2', 'url': r53.ref(port, step['ref'], image)}]})
            json.dump(res, open(DONE, 'w'), indent=1)
        return res[key]

    for name, seed, method in CELLS:
        img = r57.INPUTS[name]
        for stop in STOPS:
            front, turn = P[name][stop]
            assert front['kind'] == 'front' and turn['kind'] == 'turn'
            if method == 'FF':
                edit(f'{name}|{stop}|{seed}|FF', edit(f'{name}|front|{seed}', img, front, seed), turn, seed)
            else:
                edit(f'{name}|{stop}|{seed}|D', img, turn, seed)
    sheet()


def sheet():
    res = json.load(open(DONE))
    rows = [[(None, 'cell'), (None, 'front')] + [(None, s) for s in STOPS]]
    for name, seed, method in CELLS:
        rows.append([(r57.INPUTS[name], f'{name} {seed} {method}'),
                     (res.get(f'{name}|front|{seed}') if method == 'FF' else None, 'front')]
                    + [(res.get(f'{name}|{s}|{seed}|{method}'), s) for s in STOPS])
    a._sheet(rows, 'r59_seed_spread', cell=170, h=320)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
