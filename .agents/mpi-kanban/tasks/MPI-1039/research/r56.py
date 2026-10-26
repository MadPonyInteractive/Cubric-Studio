# MPI-1039 round 56, after round 55 (left stops reachable; rear-left from a frame-right start lands rear-RIGHT 2/8;
# through the front a 3/4 lands real). FLUX.3 Turbo + room doll + the Flow's words:
#   L = rear-left in two passes through profile-left: round 55's direct pr_l results -> tq_bl (a short same-side turn)
#   R = "front first" for the RIGHT stops: round 54/53's FLUX.3-made fronts -> tq_fr / pr_r / tq_br (round 55 did the
#       left stops; does the second pass land, or freeze FLUX-on-FLUX?)
#   python r56.py <port>   (under gpu_lease.py run)  |  python r56.py sheet
import json, os, sys
import angles as a
import r53
import r55

DONE = os.path.join(a.OUT, 'mq_blender56.json')
RIGHT = ['tq_fr', 'pr_r', 'tq_br']


def jobs():
    P = r55.prompts()
    r5 = json.load(open(r55.DONE))
    out = {}
    for name, (_, cell, front, _) in r55.INPUTS.items():
        out[f'{name}|tq_bl|L'] = (r5[f'{name}|pr_l|D'], 'tq_bl', P[f'{cell}|tq_bl'])
        for t in RIGHT:
            out[f'{name}|{t}|R'] = (front, t, P[f'{cell}|{t}'])
    return out


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for key, (image, stop, prompt) in jobs().items():
        if key in res:
            continue
        res[key] = a.gen(port, {**r53.FLUX3, 'seed': 111, 'cardName': f'angles mq56 {key}', 'positive': prompt,
                                'media': [{'role': 'inputImage', 'url': image},
                                          {'role': 'inputImage2', 'url': r53.ref(port, f'room/{stop}', image)}]})
        json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    r5 = json.load(open(r55.DONE))
    rows = [[(None, c) for c in ('input', 'pr_l D (r55)', 'tq_bl L', 'front (r54)', *[f'{t} R' for t in RIGHT])]]
    for name, (img, _, front, _) in r55.INPUTS.items():
        rows.append([(img, f'IN {name}'), (r5[f'{name}|pr_l|D'], 'pr_l D'), (res.get(f'{name}|tq_bl|L'), 'tq_bl L'),
                     (front, 'front')] + [(res.get(f'{name}|{t}|R'), f'{t} R') for t in RIGHT])
    a._sheet(rows, 'r56_rear_left_and_front_first', cell=200, h=360)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
