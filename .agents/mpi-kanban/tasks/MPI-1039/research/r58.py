# MPI-1039 round 58, after round 57 (front first in the Flow): the rear-left stop. From round 57's FLUX.3 fronts of
# the four frame-right inputs, FLUX.3 Turbo, seed 111:
#   W = front -> tq_bl, room/tq_bl doll, stronger words (r58_prompts.mjs)
#   M = front flipped left-right -> tq_br, room/tq_br doll, the Flow's tq_br words from the mirrored describe text,
#       the result flipped back (a rear-right turn lands 12/12 in rounds 54-56)
#   python r58.py <port>   (under gpu_lease.py run)  |  python r58.py sheet
import json, os, subprocess, sys, urllib.parse
from PIL import Image
import angles as a
import r53
import r57

HERE = os.path.dirname(os.path.abspath(__file__))
DONE = os.path.join(a.OUT, 'mq_blender58.json')
FLIPS = os.path.join(a.PROJECT, '.flow-refs', 'r58_flip')


def flip(url, key):
    os.makedirs(FLIPS, exist_ok=True)
    dst = os.path.join(FLIPS, key.replace('|', '_').replace(' ', '_') + '.png')
    Image.open(a.disk(url)).transpose(Image.FLIP_LEFT_RIGHT).save(dst)
    return '/project-file?path=' + urllib.parse.quote(dst)


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    texts = json.load(open(r57.TEXTS))
    P = json.loads(subprocess.run(['node', os.path.join(HERE, 'r58_prompts.mjs')], input=json.dumps(texts),
                                  capture_output=True, text=True, check=True, cwd=HERE).stdout)
    json.dump(P, open(os.path.join(a.OUT, 'mq_blender58_prompts.json'), 'w'), indent=1)
    r57res = json.load(open(r57.DONE))
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for name in r57.INPUTS:
        front = r57res[f'{name}|front']
        for x, (img, stop) in {'W': (front, 'tq_bl'), 'M': (flip(front, f'{name}|front'), 'tq_br')}.items():
            key = f'{name}|{x}'
            if key not in res:
                res[key] = a.gen(port, {**r53.FLUX3, 'seed': 111, 'cardName': f'angles mq58 {key}',
                                        'positive': P[key], 'media': [
                                            {'role': 'inputImage', 'url': img},
                                            {'role': 'inputImage2', 'url': r53.ref(port, f'room/{stop}', img)}]})
                json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    r57res = json.load(open(r57.DONE))
    rows = [[(None, 'input'), (None, 'front (r57)'), (None, 'tq_bl r57'), (None, 'W'), (None, 'M raw'),
             (None, 'M flipped back')]]
    for name, img in r57.INPUTS.items():
        m = res.get(f'{name}|M')
        rows.append([(img, f'IN {name}'), (r57res.get(f'{name}|front'), 'front'),
                     (r57res.get(f'{name}|tq_bl|turn'), 'tq_bl r57'), (res.get(f'{name}|W'), 'W'), (m, 'M raw'),
                     (m and flip(m, f'{name}|M'), 'M back')])
    a._sheet(rows, 'r58_rear_left', cell=200, h=360)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
