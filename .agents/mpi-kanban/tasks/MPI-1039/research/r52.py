# MPI-1039 round 52 (Fabio 2026-10-26: "the user is going to give you different views"): does the Flow's turn pass
# land on the mascot's view when the INPUT is already turned? Inputs = four accepted eye-level turns (pr l, tq fr,
# tqb l, back; anime + photo, seed 111). Targets = front, tq fl, pr r, tq br. A = the Flow's words as shipped, B = the
# same words naming only the end view (r52_prompts.mjs). FLUX.3 Turbo, no ratio, the padded doll ref, as the Flow.
#   python r52.py <port>   (under gpu_lease.py run)  |  python r52.py sheet
import json, os, subprocess, sys, urllib.parse, urllib.request
import angles as a

HERE = os.path.dirname(os.path.abspath(__file__))
QWEN = sys.argv[2:3] == ['qwen']  # round 52b: the same turns on Qwen (FLUX.3 froze on these FLUX.3-made inputs)
DONE = os.path.join(a.OUT, 'mq_blender52' + ('q' if QWEN else '') + '.json')
INPUTS = ['pr l', 'tq fr', 'tqb l', 'back']
TARGETS = ['front', 'tq_fl', 'pr_r', 'tq_br']
REFS = os.path.join(HERE, *[os.pardir] * 5, 'assets', 'flows', 'multi-angle', 'refs', 'room')


def inputs():
    vr = json.load(open(os.path.join(a.OUT, 'viewread.json')))
    return {f'{v} - {n}': vr[f'{v} - {n}'] for v in INPUTS for n in ('anime', 'photo')}


def prompts(ins):
    js = subprocess.run(['node', os.path.join(HERE, 'r52_prompts.mjs')], input=json.dumps(
        {k: v['text'] for k, v in ins.items()}), capture_output=True, text=True, check=True, cwd=HERE)
    return json.loads(js.stdout)


def ref(port, stop, image):
    req = urllib.request.Request(f'http://127.0.0.1:{port}/flows/multi-angle/ref', json.dumps(
        {'ref': f'room/{stop}', 'imagePath': image, 'folderPath': a.PROJECT}).encode(), {'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=60))
    if not r.get('ok'):
        sys.exit(f'ref {stop}: {r}')
    return r['url']


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    ins = inputs()
    P = prompts(ins)
    json.dump(P, open(os.path.join(a.OUT, 'mq_blender52_prompts.json'), 'w'), indent=1)
    for key, prompt in P.items():
        if key in res or (QWEN and key.endswith('|A')) or (not QWEN and key.endswith('|B') and P.get(key[:-1] + 'A') == prompt):
            continue  # a B that says what A says (the rear stops name only the end view already) is A's picture
        cell, stop, _ = key.split('|')
        if not os.path.exists(os.path.join(REFS, f'{stop}.png')):
            print('no doll ref yet, skipped:', key, flush=True)  # the app ships no eye-level front doll
            continue
        image = '/project-file?path=' + urllib.parse.quote(ins[cell]['path'])
        model = a.QWEN29 if QWEN else {'modelId': 'flux3-klein', 'operation': 'edit', 'turbo': True}
        res[key] = a.gen(port, {**model, 'seed': 111,
                                'cardName': f'angles mq52 {key}', 'positive': prompt,
                                'media': [{'role': 'inputImage', 'url': image},
                                          {'role': 'inputImage2', 'url': ref(port, stop, image)}]})
        json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    ins = inputs()
    for n in ('anime', 'photo'):
        rows = [[(None, 'input')] + [(None, f'{t} {v}') for t in TARGETS for v in 'AB']]
        for v in INPUTS:
            c = f'{v} - {n}'
            src = '/project-file?path=' + urllib.parse.quote(ins[c]['path'])
            rows.append([(src, f'IN {c}')] + [(res.get(f'{c}|{t}|{x}') or res.get(f'{c}|{t}|A'), f'{t} {x}')
                                                        for t in TARGETS for x in 'AB'])
        a._sheet(rows, f'r52{"q" if QWEN else ""}_{n}_angled_inputs', cell=220, h=380)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))  # <port|sheet> [qwen]
