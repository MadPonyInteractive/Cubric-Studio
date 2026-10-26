# MPI-1039 round 69: round 67's headroom words for a low on a PROFILE (v1: head kept 8/8 on unturned side inputs)
# replace the accepted round-35 words, so the accepted chain cells re-run with them: the round-35 turned profiles
# (FLUX.3 turn of the front source, anime + photo, pr_l + pr_r) -> the low pass with the new words, seeds 111/222,
# beside round 35's own low (seed 111, old words).
#   python r69.py <port>   (under gpu_lease.py run)  |  python r69.py sheet
import json, os, sys
import angles as a
import r53

R35 = os.path.join(a.OUT, 'mq_blender35.json')
DONE = os.path.join(a.OUT, 'mq_blender69.json')
OLD = 'is small near the top edge with her whole head still in frame'
NEW = ('is small near the top of the frame with a clear gap above it: her whole head and hair are inside the frame, '
       'below the top edge')
CELLS = [f'{n} 111 {v}' for n in ('anime', 'photo') for v in ('pr l', 'pr r')]
SEEDS = (111, 222)


def accepted():
    """The accepted round-35 low prompt per cell (accepted_prompts.md), with the round-67 headroom words."""
    text = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'accepted_prompts.md'), encoding='utf-8').read()
    out = {}
    for c in CELLS:
        n, _, v = c.split(' ', 2)
        block = text.split(f'## {v} lo - {n} ')[1].split('```text\n')[1].split('\n```')[0]
        assert OLD in block, c
        out[c] = block.replace(OLD, NEW).replace(' Take only the viewing angle',
                                                 ' The whole woman fits in the frame from her sneakers to the top of her '
                                                 'head. Take only the viewing angle', 1)
    return out


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    r35, prompts = json.load(open(R35)), accepted()
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for c in CELLS:
        inp = r35[c]
        ref = r53.ref(port, f'plain/{c.split(" ", 2)[2].replace(" ", "_")}_lo', inp)
        for seed in SEEDS:
            key = f'{c} lo v1|{seed}'
            if key not in res:
                res[key] = a.gen(port, {**a.QWEN29, 'seed': seed, 'cardName': f'angles mq69 {key}',
                                        'positive': prompts[c], 'media': [{'role': 'inputImage', 'url': inp},
                                                                          {'role': 'inputImage2', 'url': ref}]})
                json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    r35, res = json.load(open(R35)), json.load(open(DONE))
    a._sheet([[(r35[c], f'IN {c} (r35 turn)'), (r35[f'{c} lo'], 'r35 lo (old words)')]
              + [(res.get(f'{c} lo v1|{s}'), f'v1 {s}') for s in SEEDS] for c in CELLS], 'r69_profile_lo', cell=240, h=320)


if __name__ == '__main__':
    if sys.argv[1] == 'sheet':
        sheet()
    else:
        run(int(sys.argv[1]))
