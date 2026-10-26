# MPI-1039 round 55, after round 54 (both models keep the input's SIDE: a frame-right start does not reach the
# frame-left stops tq_fl / pr_l / tq_bl, which face frame-left in the dolls). Four non-FLUX inputs that face
# frame-right, three ways to each left stop, FLUX.3 Turbo + room doll + the Flow's words:
#   D = direct: input -> the left stop
#   T = two passes: round 54's front (it landed 5/5) -> the left stop, the Flow's benched front-input case
#   F = flip: input -> the MIRROR right stop (tq_fr / pr_r / tq_br, same side, lands), the result flipped left-right.
#       Costs a mirrored person and place (text, hair part, a bag's shoulder); a picture already at that right stop is
#       flipped as it is, no edit.
#   python r55.py <port>   (under gpu_lease.py run)  |  python r55.py sheet
import json, os, subprocess, sys, urllib.parse
from PIL import Image
import angles as a
import r52
import r53

HERE = os.path.dirname(os.path.abspath(__file__))
DONE = os.path.join(a.OUT, 'mq_blender55.json')
FLIPS = os.path.join(a.PROJECT, '.flow-refs', 'r55_flip')
_r52q, _r53, _r54 = (json.load(open(os.path.join(a.OUT, f))) for f in ('mq_blender52q.json', 'mq_blender53.json',
                                                                     'mq_blender54.json'))
INPUTS = {  # name: (picture, its describe-text cell, round 54's front of it, the right stops it already sits at)
    'photo pr_r': (_r53['tqb l - photo|pr_r|P'], 'tqb l - photo', _r54['photo pr_r|front|A'], {'pr_r': None}),
    'anime pr_r': (_r52q['back - anime|pr_r|B'],
                   'back - anime', _r54['anime pr_r|front|A'], {'pr_r': None}),
    'photo tq_fr': (r53.NF_IN, 'tq fr - photo', _r53['nonflux|front|NF'],
                    {'tq_fr': None, 'pr_r': _r53['nonflux|pr_r|NF'], 'tq_br': _r53['nonflux|tq_br|NF']}),
    'anime tq_fr': (_r53['tqb l - anime|tq_fl|S'], 'tqb l - anime', _r54['anime tq_fl|front|A'],  # r54's "anime tq_fl"
                    {'tq_fr': None, 'pr_r': _r54['anime tq_fl|pr_r|A'], 'tq_br': _r54['anime tq_fl|tq_br|A']}),
}
# round 54 made these two tq_br
INPUTS['photo pr_r'][3]['tq_br'] = _r54['photo pr_r|tq_br|A']
INPUTS['anime pr_r'][3]['tq_br'] = _r54['anime pr_r|tq_br|A']
STOPS = {'tq_fl': 'tq_fr', 'pr_l': 'pr_r', 'tq_bl': 'tq_br'}  # left stop: its mirror


def prompts():
    texts = {cell: t['text'] for cell, t in r52.inputs().items() if cell in {v[1] for v in INPUTS.values()}}
    js = subprocess.run(['node', os.path.join(HERE, 'r55_prompts.mjs'), *STOPS, *STOPS.values()], input=json.dumps(texts),
                        capture_output=True, text=True, check=True, cwd=HERE)
    return json.loads(js.stdout)


def jobs():
    P = prompts()
    out = {}
    for name, (img, cell, front, have) in INPUTS.items():
        for left, right in STOPS.items():
            out[f'{name}|{left}|D'] = (img, left, P[f'{cell}|{left}'])
            out[f'{name}|{left}|T'] = (front, left, P[f'{cell}|{left}'])
            if right not in have:
                out[f'{name}|{right}|F'] = (img, right, P[f'{cell}|{right}'])
    return out


def flip(url, key):
    os.makedirs(FLIPS, exist_ok=True)
    dst = os.path.join(FLIPS, key.replace('|', '_').replace(' ', '_') + '.png')
    Image.open(a.disk(url)).transpose(Image.FLIP_LEFT_RIGHT).save(dst)
    return '/project-file?path=' + urllib.parse.quote(dst)


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    J = jobs()
    json.dump({k: v[2] for k, v in J.items()}, open(os.path.join(a.OUT, 'mq_blender55_prompts.json'), 'w'), indent=1)
    for key, (image, stop, prompt) in J.items():
        if key in res:
            continue
        res[key] = a.gen(port, {**r53.FLUX3, 'seed': 111, 'cardName': f'angles mq55 {key}', 'positive': prompt,
                                'media': [{'role': 'inputImage', 'url': image},
                                          {'role': 'inputImage2', 'url': r53.ref(port, f'room/{stop}', image)}]})
        json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    rows = [[(None, 'input'), (None, 'front (r54)')] + [(None, f'{l} {x}') for l in STOPS for x in 'DTF']]
    for name, (img, _, front, have) in INPUTS.items():
        row = [(img, f'IN {name}'), (front, 'front (r54)')]
        for left, right in STOPS.items():
            made = res.get(f'{name}|{right}|F') or have.get(right) or (img if right in have else None)
            row += [(res.get(f'{name}|{left}|D'), f'{left} D'), (res.get(f'{name}|{left}|T'), f'{left} T'),
                    (made and flip(made, f'{name}|{left}'), f'{left} F (flipped {right})')]
        rows.append(row)
    a._sheet(rows, 'r55_side_crossing', cell=180, h=340)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
