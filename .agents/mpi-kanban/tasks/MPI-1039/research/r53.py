# MPI-1039 round 53, after round 52 (Qwen turns an already-turned picture but pastes the room doll's grey room into
# photos; its 3/4 left lands as profile; FLUX.3 froze on FLUX.3-made inputs):
#   P  = Qwen, round 52's B words, the PLAIN eye-level doll (refs/plain/<stop>, doll on white) - does the place survive?
#   S  = Qwen, plain doll, tq_fl only, stronger 3/4 words (the Flow's tq_fl words say "almost side-on")
#   NF = FLUX.3 Turbo, room doll, the Flow's words, on a NON-FLUX input: Qwen's round 52 "tq fr - photo -> pr_r" (a clean
#        3/4 front-right, studio kept) - the view that froze 4/4 on FLUX.3 when FLUX.3 had made it
#   python r53.py <port>   (under gpu_lease.py run)  |  python r53.py sheet
import json, os, re, sys, urllib.parse, urllib.request
import angles as a
import r52

DONE = os.path.join(a.OUT, 'mq_blender53.json')
NF_IN = json.load(open(os.path.join(a.OUT, 'mq_blender52q.json')))['tq fr - photo|pr_r|B']
FLUX3 = {'modelId': 'flux3-klein', 'operation': 'edit', 'turbo': True}
TQ_FL = {  # pronoun -> the stronger 3/4 front-left view (replaces "seen from ... barely showing.")
    'they': ('they are seen in three-quarter view from their front-left, halfway between the front and the side, about '
             '45 degrees round - not side-on, not in profile. Their chest and the front of their body still face partly '
             'toward the view, angled toward frame-left: their left shoulder is nearer the view and their right shoulder '
             'still shows beyond their chest, their feet point toward the lower-left corner, and both of their eyes show, '
             'the far eye a little narrower, the nose turned toward frame-left.'),
}


def tq_fl(prompt):
    m = re.search(r': (they|she|he) (?:are|is) seen from \w+ left side\..*?barely showing\.', prompt)
    pr = m.group(1)
    words = TQ_FL['they']
    if pr != 'they':
        his = 'her' if pr == 'she' else 'his'
        words = (words.replace('they are', f'{pr} is').replace('Their', his.capitalize()).replace('their', his))
    return prompt[:m.start()] + ': ' + words + prompt[m.end():]


def jobs():
    ins = r52.inputs()
    P = r52.prompts(ins)
    out = {}
    for cell in ins:
        img = '/project-file?path=' + urllib.parse.quote(ins[cell]['path'])
        for t in r52.TARGETS:
            out[f'{cell}|{t}|P'] = (a.QWEN29, img, f'plain/{t}', P[f'{cell}|{t}|B'])
        out[f'{cell}|tq_fl|S'] = (a.QWEN29, img, 'plain/tq_fl', tq_fl(P[f'{cell}|tq_fl|B']))
    for t in r52.TARGETS:  # the Flow's own words (A); the Flow sends no front words, so front takes B as round 52 did
        out[f'nonflux|{t}|NF'] = (FLUX3, NF_IN, f'room/{t}', P.get(f'tq fr - photo|{t}|A') or P[f'tq fr - photo|{t}|B'])
    return out


def ref(port, name, image):  # r52.ref puts room/ in front of the stop; these names carry their own room|plain
    req = urllib.request.Request(f'http://127.0.0.1:{port}/flows/multi-angle/ref', json.dumps(
        {'ref': name, 'imagePath': image, 'folderPath': a.PROJECT}).encode(), {'Content-Type': 'application/json'})
    r = json.load(urllib.request.urlopen(req, timeout=60))
    if not r.get('ok'):
        sys.exit(f'ref {name}: {r}')
    return r['url']


def run(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    res = json.load(open(DONE)) if os.path.exists(DONE) else {}
    J = jobs()
    json.dump({k: v[3] for k, v in J.items()}, open(os.path.join(a.OUT, 'mq_blender53_prompts.json'), 'w'), indent=1)
    for key, (model, image, stop, prompt) in J.items():
        if key in res:
            continue
        res[key] = a.gen(port, {**model, 'seed': 111, 'cardName': f'angles mq53 {key}', 'positive': prompt,
                                'media': [{'role': 'inputImage', 'url': image},
                                          {'role': 'inputImage2', 'url': ref(port, stop, image)}]})
        json.dump(res, open(DONE, 'w'), indent=1)
    sheet()


def sheet():
    res = json.load(open(DONE))
    r52q = json.load(open(os.path.join(a.OUT, 'mq_blender52q.json')))
    ins = r52.inputs()
    for n in ('anime', 'photo'):  # round 52's Qwen (room doll) beside round 53's (plain doll), per target
        rows = [[(None, 'input')] + [(None, f'{t} {x}') for t in r52.TARGETS for x in ('r52', 'P')] + [(None, 'tq_fl S')]]
        for v in r52.INPUTS:
            c = f'{v} - {n}'
            rows.append([('/project-file?path=' + urllib.parse.quote(ins[c]['path']), f'IN {c}')]
                        + [(r52q.get(f'{c}|{t}|B') if x == 'r52' else res.get(f'{c}|{t}|P'), f'{t} {x}')
                           for t in r52.TARGETS for x in ('r52', 'P')] + [(res.get(f'{c}|tq_fl|S'), 'tq_fl S')])
        a._sheet(rows, f'r53_{n}_plain_doll', cell=200, h=360)
    a._sheet([[(NF_IN, 'IN qwen-made tq fr')] + [(res.get(f'nonflux|{t}|NF'), f'{t} FLUX.3') for t in r52.TARGETS]],
             'r53_nonflux_on_flux3', cell=220, h=380)


if __name__ == '__main__':
    sheet() if sys.argv[1] == 'sheet' else run(int(sys.argv[1]))
