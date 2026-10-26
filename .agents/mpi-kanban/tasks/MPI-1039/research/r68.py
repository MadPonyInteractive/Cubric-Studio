# MPI-1039 round 68: the two cells round 67 left open on a start that is NOT eye level. Back to eye level failed 0/12 on
# Qwen + the plain doll (the camera barely moved), so: the same words on FLUX.3 + the ROOM doll of the start view
# (levelF). A low from a high start cut the head 4/4 on photos, so: the low words with round 67's v1 headroom line
# (lo_v1). Same six round-67 part B inputs, seeds 111/222; r67_plan.mjs part C builds the passes.
#   python r68.py <port>   (under gpu_lease.py run)  |  python r68.py sheet
import json, os, sys
import angles as a
import r67

r67.DONE = os.path.join(a.OUT, 'mq_blender68.json')
r67.PLANS = os.path.join(a.OUT, 'mq_blender68_plans.json')
_inputs = r67.inputs
r67.inputs = lambda: {k: (img, s, h, 'C') for k, (img, s, h, part) in _inputs().items() if part == 'B'}


def sheet():
    ins, P = r67.inputs(), json.load(open(r67.PLANS))
    res, res67 = json.load(open(r67.DONE)), json.load(open(os.path.join(a.OUT, 'mq_blender67.json')))
    for seed in r67.SEEDS:
        rows = []
        for k, plan in P.items():
            other = 'lo' if plan['height'] == 'hi' else 'hi'
            row = [(ins[k][0], f'IN {k} = {plan["start"]} {plan["height"]}'),
                   (res67.get(f'{k}|level|{seed}|0'), 'r67 level (Qwen)'), (res.get(f'{k}|levelF|{seed}|0'), 'levelF (FLUX.3)')]
            if plan['height'] == 'hi':
                row += [(res67.get(f'{k}|lo|{seed}|0'), 'r67 lo'), (res.get(f'{k}|lo_v1|{seed}|0'), 'lo_v1')]
            rows.append(row)
        a._sheet(rows, f'r68_{seed}', cell=240, h=320)


if __name__ == '__main__':
    if sys.argv[1] == 'sheet':
        sheet()
    else:
        r67.sheet = sheet
        r67.run(int(sys.argv[1]))
