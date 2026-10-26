"""MPI-1301 round 1: does the Multi-angle gizmo's three sliders map onto the fal multiple-angles LoRA?

  python orbit.py <port>          (run under gpu_lease.py run: it dispatches on the local GPU)

qwen-edit, Hyper tier (4-step Lightning, Tier 3 = what Fabio runs on his bench), angle LoRA 0.9 in Lora_1,
seed 111, on the two eye-level street sources of MPI-1039 round 70. One edit per gizmo stop. The LoRA names
the CAMERA's move ("right side view" = the camera swings to its own right), the gizmo names the view of the
person, so left/right swap: gizmo tq_fl (she faces frame-left) = the LoRA's front-right quarter.
"""
import json, os, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'MPI-1039', 'research'))
import angles as a  # noqa: E402  (gen / _sheet / disk helpers, read only)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
SRC = os.path.join(a.OUT, 'mq_blender70_sources.json')
LORA = {'Lora_1': {'lora_name': 'qwen\\qwen-image-edit-2511-multiple-angles-lora.safetensors',
                   'strength_model': 0.9, 'strength_clip': 0.9},  # all three keys (MPI-219 trap)
        'Tier': 3}
INPUTS = ['photo|111', 'anime|222']
STOPS = {  # gizmo (turn, height, zoom) -> LoRA prompt
    'tq_fl level': '<sks> front-right quarter view eye-level shot medium shot',
    'pr_r level': '<sks> left side view eye-level shot medium shot',
    'tq_br level': '<sks> back-left quarter view eye-level shot medium shot',
    'back level': '<sks> back view eye-level shot medium shot',
    'front lo': '<sks> front view low-angle shot medium shot',
    'front hi': '<sks> front view high-angle shot medium shot',
    'tq_fr hi': '<sks> front-left quarter view elevated shot medium shot',
    'front far': '<sks> front view eye-level shot wide shot',
    'front hs': '<sks> front view eye-level shot close-up',
}


def main(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    os.makedirs(OUT, exist_ok=True)
    done = os.path.join(OUT, 'orbit1.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(SRC))
    for inp in INPUTS:
        for stop, prompt in STOPS.items():
            key = f'{inp} {stop}'
            if key not in res:
                res[key] = a.gen(port, {'modelId': 'qwen-edit', 'operation': 'qwenEdit', 'positive': prompt,
                                        'seed': 111, 'injectionParams': LORA, 'cardName': f'orbit1 {key}',
                                        'media': [{'role': 'inputImage', 'url': src[inp]}]})
                json.dump(res, open(done, 'w'), indent=1)
    sheet(res, src)


def sheet(res, src):
    a.HERE = HERE  # _sheet writes to <HERE>/sheets
    os.makedirs(os.path.join(HERE, 'sheets'), exist_ok=True)
    a._sheet([[(src[i], f'IN {i}')] + [(res.get(f'{i} {s}'), s) for s in STOPS] for i in INPUTS],
             'orbit1', cell=260, h=380)


if __name__ == '__main__':
    main(int(sys.argv[1]))
