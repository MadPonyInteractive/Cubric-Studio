# MPI-1039 round 63, after the round 61 decision (turns are one direct pass again): rear-left (tq_bl) is the one stop
# front first fixed (rounds 57-59), and the direct pass is weak there from a frame-right start (round 55 D 2/4). Is it
# worth a front pass for tq_bl alone? The four frame-right inputs, seeds 444 + 555, FLUX.3 Turbo, the Flow's words:
#   FF = front pass, then the tq_bl turn on that front;  D = the tq_bl turn straight from the input
#   python r63.py <port>   (under gpu_lease.py run)  |  python r63.py sheet  (head crops)
import json, os, subprocess, sys
import angles as a
import r53
import r57

DONE = os.path.join(a.OUT, 'mq_blender63.json')
SEEDS = [444, 555]


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    P = json.load(open(os.path.join(a.OUT, 'mq_blender57_plans.json')))
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}

    def edit(key, image, step, seed):
        if key not in res:
            res[key] = a.gen(port, {**r53.FLUX3, 'seed': seed, 'cardName': f'angles mq63 {key}',
                                    'positive': step['prompt'], 'media': [
                                        {'role': 'inputImage', 'url': image},
                                        {'role': 'inputImage2', 'url': r53.ref(port, step['ref'], image)}]})
            json.dump(res, open(DONE, 'w'), indent=1)
        return res[key]

    for seed in SEEDS:
        for name, img in r57.INPUTS.items():
            front, turn = P[name]['tq_bl']
            edit(f'{name}|tq_bl|{seed}|FF', edit(f'{name}|front|{seed}', img, front, seed), turn, seed)
            edit(f'{name}|tq_bl|{seed}|D', img, turn, seed)
    sheet()


def sheet():
    res = json.load(open(DONE))
    items = [f'{n[:8]} {s} {m}={res[f"{n}|tq_bl|{s}|{m}"]}' for s in SEEDS for n in r57.INPUTS for m in ('FF', 'D')
             if f'{n}|tq_bl|{s}|{m}' in res]
    subprocess.run(['python', os.path.join(os.path.dirname(__file__), 'heads.py'),
                    os.path.join(os.path.dirname(__file__), 'sheets', 'r63_rear_left_heads.jpg'), '8', *items], check=True)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
