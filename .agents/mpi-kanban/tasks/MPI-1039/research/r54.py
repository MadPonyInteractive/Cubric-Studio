# MPI-1039 round 54, after round 53 (FLUX.3 turned ONE non-FLUX photo; its freeze in round 52 was FLUX.3-on-FLUX.3):
# widen it. Five clean Qwen-made pictures (rounds 52/53, place kept) at five views, anime + photo, on FLUX.3 Turbo with
# the room doll and the Flow's own words (A; front takes B as round 52 did), plus tq_fl with round 53's stronger 3/4
# words (S). A target equal to the input's own view is skipped. The source row's describe text writes the words.
#   python r54.py <port>   (under gpu_lease.py run)  |  python r54.py sheet
import json, os, sys
import angles as a
import r52
import r53

DONE = os.path.join(a.OUT, 'mq_blender54.json')
_q, _r = (json.load(open(os.path.join(a.OUT, f))) for f in ('mq_blender52q.json', 'mq_blender53.json'))
INPUTS = {  # name: (picture, the round 52 cell whose describe text it came from, its own view)
    'photo front': (_r['back - photo|front|P'], 'back - photo', 'front'),
    'photo pr_r': (_r['tqb l - photo|pr_r|P'], 'tqb l - photo', 'pr_r'),
    'photo tq_br': (_q['tqb l - photo|tq_br|B'], 'tqb l - photo', 'tq_br'),
    'anime tq_fl': (_r['tqb l - anime|tq_fl|S'], 'tqb l - anime', 'tq_fl'),
    'anime pr_r': (_q['back - anime|pr_r|B'], 'back - anime', 'pr_r'),
    'photo tq_fr': (r53.NF_IN, 'tq fr - photo', 'tq_fr'),  # round 53's input: only S is new
}
COLS = [('front', 'A'), ('tq_fl', 'A'), ('tq_fl', 'S'), ('pr_r', 'A'), ('tq_br', 'A')]


def jobs():
    P = r52.prompts(r52.inputs())
    out = {}
    for name, (img, cell, view) in INPUTS.items():
        for t, x in COLS:
            if t == view or (name == 'photo tq_fr' and x != 'S'):
                continue
            words = r53.tq_fl(P[f'{cell}|tq_fl|B']) if x == 'S' else P.get(f'{cell}|{t}|A') or P[f'{cell}|{t}|B']
            out[f'{name}|{t}|{x}'] = (img, f'room/{t}', words)
    return out


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    J = jobs()
    json.dump({k: v[2] for k, v in J.items()}, open(os.path.join(a.OUT, 'mq_blender54_prompts.json'), 'w'), indent=1)
    for key, (image, stop, prompt) in J.items():
        if key in res:
            continue
        res[key] = a.gen(port, {**r53.FLUX3, 'seed': 111, 'cardName': f'angles mq54 {key}', 'positive': prompt,
                                'media': [{'role': 'inputImage', 'url': image},
                                          {'role': 'inputImage2', 'url': r53.ref(port, stop, image)}]})
        json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    r53res = json.load(open(r53.DONE))
    rows = [[(None, 'input')] + [(None, f'{t} {x}') for t, x in COLS]]
    for name, (img, _, _) in INPUTS.items():
        old = {f'{t}|A': r53res.get(f'nonflux|{t}|NF') for t in ('front', 'tq_fl', 'pr_r', 'tq_br')} \
            if name == 'photo tq_fr' else {}
        rows.append([(img, f'IN {name} (qwen)')] + [(res.get(f'{name}|{t}|{x}') or old.get(f'{t}|{x}'), f'{t} {x}')
                                                     for t, x in COLS])
    a._sheet(rows, 'r54_nonflux_on_flux3', cell=200, h=360)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
