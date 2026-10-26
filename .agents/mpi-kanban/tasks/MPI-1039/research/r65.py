# MPI-1039 round 65, after round 64 (two-person words: photo LEFT stops 0/4 - the person at frame-right keeps facing
# frame-right). P3 = the shipped two-person words plus one sentence naming that person: "The person at frame-right
# faces frame-left too, toward the other one's back, not toward their face." Round 60's two sources, seeds 111/222,
# pr_l + tq_fl (anime too, to check it does not break the 4/4). FLUX.3 Turbo, room dolls.
#   python r65.py <port>   (under gpu_lease.py run)  |  python r65.py sheet
import json, os, subprocess, sys
import angles as a
import r53
import r62

HERE = os.path.dirname(os.path.abspath(__file__))
DONE = os.path.join(a.OUT, 'mq_blender65.json')
SEEDS = [111, 222]
STOPS = ['pr_l', 'tq_fl']
ADD = ' The person at frame-right faces frame-left too, toward the other one\'s back, not toward their face.'
JS = ("import { multiAnglePlan } from '../../../../../js/data/flowPrompts/multiAngle.js'; const d = { noun: 'anime', "
      "style: 'flat 2D anime drawing style', marks: 'clean outlines, flat colours' }; const o = {}; for (const t of "
      "['pr_l', 'tq_fl']) { o['photo two|' + t] = multiAnglePlan({ turn: t }, { people: 2 }).steps[0].prompt; "
      "o['anime two|' + t] = multiAnglePlan({ turn: t }, { people: 2, drawing: d }).steps[0].prompt; } "
      "process.stdout.write(JSON.stringify(o));")


def prompts():
    base = json.loads(subprocess.run(['node', '--input-type=module', '-e', JS], capture_output=True, text=True,
                                     check=True, cwd=HERE).stdout)
    # the added sentence goes right after the view words, before "The place around them"
    return {k: v.replace(' The place around them', ADD + ' The place around them', 1) for k, v in base.items()}


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    P = prompts()
    json.dump(P, open(os.path.join(a.OUT, 'mq_blender65_prompts.json'), 'w'), indent=1)
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    for seed in SEEDS:
        for name in r62.KEEP:
            for stop in STOPS:
                key = f'{name}|{stop}|{seed}'
                if key not in res:
                    img = r62.R60[name]
                    res[key] = a.gen(port, {**r53.FLUX3, 'seed': seed, 'cardName': f'angles mq65 {key}',
                                            'positive': P[f'{name}|{stop}'], 'media': [
                                                {'role': 'inputImage', 'url': img},
                                                {'role': 'inputImage2', 'url': r53.ref(port, f'room/{stop}', img)}]})
                    json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    r64 = json.load(open(os.path.join(a.OUT, 'mq_blender64.json')))
    items = []
    for name in r62.KEEP:
        for seed in SEEDS:
            for stop in STOPS:
                items += [f'{name[:5]} {stop} {seed} r64={r64[f"{name}|{stop}|{seed}"]}',
                          f'P3={res[f"{name}|{stop}|{seed}"]}']
    subprocess.run(['python', os.path.join(HERE, 'heads.py'), os.path.join(HERE, 'sheets', 'r65_heads.jpg'), '4',
                    *items], check=True)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
