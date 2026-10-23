"""MPI-1039 stage 1: does each edit model keep a face across camera angles?

  python angles.py <port>          (run under gpu_lease.py run: it dispatches on the local GPU)

One FLUX.3 head-and-shoulders source, then per model: front -> 3/4, front -> profile, and that
model's OWN 3/4 -> low angle. Results + sheet land in research/out/ and research/sheets/.
"""
import json, os, sys, urllib.parse, urllib.request
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
PROJECT = os.path.expandvars(r'%USERPROFILE%\Documents\Cubric Studio\Projects\FLUX3 Flow Bench')
SEED = 1234

SOURCE = ('Full-color studio photograph, head-and-shoulders portrait of a woman in her early thirties '
          'with olive skin, facing the camera straight on at eye level, soft key light from frame-left '
          'and a plain mid-grey backdrop. She has dark brown wavy hair parted on her left side and tucked '
          'behind her left ear, a small mole on her right cheekbone, and green eyes. She wears a '
          'rust-orange ribbed knit turtleneck sweater, a thin gold chain with a small round pendant, and '
          'a single gold hoop earring in her left ear only, her right ear bare. Framed from the top of '
          'her head to mid-chest.')

KEEP = 'Keep her face, hair, mole, sweater, necklace, earring, lighting and grey backdrop unchanged.'
SHOTS = {
    'tq': ('Shift the camera viewpoint 45 degrees around to the woman\'s left side, so she is seen in a '
           'three-quarter view: her left cheek and her left ear with the gold hoop are nearer the camera, '
           'her right cheek turns away. Same head-to-mid-chest framing, eye-level camera. ' + KEEP),
    'pr': ('Shift the camera viewpoint 90 degrees around to the woman\'s left side, so she is seen in full '
           'side profile: her nose points at the frame edge, her left ear with the gold hoop faces the '
           'camera and her right side is hidden. Same head-to-mid-chest framing, eye-level camera. ' + KEEP),
    'lo': ('Shift the camera viewpoint down to a low angle below her chin, looking up at the woman from the '
           'same three-quarter side: the underside of her jaw and chin show, and the grey backdrop fills '
           'the space above her head. Same head-to-mid-chest framing. ' + KEEP),
}
MODELS = [('flux3-klein', 'edit', {'turbo': False}), ('klein-9b', 'kleinEdit', {}),
          ('qwen-image-2-1', 'edit', {})]


def gen(port, body):
    req = urllib.request.Request(f'http://127.0.0.1:{port}/connector/generate',
                                 data=json.dumps({'folderPath': PROJECT, 'seed': SEED, **body}).encode(),
                                 headers={'Content-Type': 'application/json'})
    try:
        r = json.load(urllib.request.urlopen(req, timeout=1800))
    except urllib.error.HTTPError as e:
        r = json.load(e)
    if not r.get('ok'):
        sys.exit(f'{body.get("cardName")}: {r}')
    o = r['output']
    print(body['cardName'], o['pixelDimensions'], o.get('generationMs'), flush=True)
    return o['filePath']


def disk(url):
    return urllib.parse.unquote(url.split('path=')[1].split('&')[0])


def main(port, tier):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    os.makedirs(OUT, exist_ok=True)
    name = 'stage1' if tier == '1k' else f'stage1_{tier}'
    done = os.path.join(OUT, name + '.json')
    res = json.load(open(done)) if os.path.exists(done) else {}

    def step(key, body):
        if key not in res:
            res[key] = gen(port, {**body, 'cardName': f'angles {tier} {key}'})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    src = step('source', {'modelId': 'flux3-klein', 'operation': 't2i', 'positive': SOURCE,
                          'ratio': '4:5', 'qualityTier': tier, 'turbo': False})
    for mid, op, extra in MODELS:
        # no ratio on purpose: every edit keeps the source's own size; a ratio would make FLUX.3's
        # graph shrink picture 1 to 1 MP (flux3_t2i.json node 824 "Edit frame: picture 1 at 1 MP")
        def edit(shot, base):
            return step(f'{mid} {shot}', {'modelId': mid, 'operation': op, 'positive': SHOTS[shot],
                                          'media': [{'role': 'inputImage', 'url': base}], **extra})
        tq = edit('tq', src)
        edit('pr', src)
        edit('lo', tq)
    sheet(res, name)


FACE = 'Same woman, same hair, rust-orange turtleneck, gold necklace, gold hoop earring and grey studio backdrop.'
VARIANTS = {  # FLUX.3 wording sweep (Fabio 2026-10-23): on the 2K source (p*) / FLUX.3's 2K 3/4 (l*)
    'p1 measured': ('source',
        'Shift the camera viewpoint 90 degrees to the woman\'s left, to a full side profile. Now only one side of '
        'her face is visible: one eye, the full outline of her nose, lips and chin against the grey backdrop, her '
        'left ear with the gold hoop in the middle of her head, and her right cheek, right eye and right ear '
        'completely hidden. Her shoulders are side-on to the camera too. Eye-level camera, same head-to-chest '
        'framing. ' + FACE),
    'p2 create': ('source',
        'Create a photograph of the woman from the first image in strict side profile facing frame-left, like a '
        'side-view ID photo: her nose, lips and chin outlined against the grey backdrop, only her left eye '
        'visible, her left ear with the gold hoop facing the camera, her shoulders turned side-on. Eye-level '
        'camera, head-to-chest framing. ' + FACE),
    'l1 measured': ('flux3-klein tq',
        'Shift the camera viewpoint: lower the camera to her chest height and tilt it about 30 degrees upward at '
        'her face, keeping the same three-quarter view. The camera now looks up at her: the underside of her '
        'chin and jaw and her nostrils are visible, her neck looks longer, her head sits near the top edge and '
        'more grey backdrop shows above it. Her head stays level and her eyes look ahead, not up. ' + FACE),
    'l2 create': ('flux3-klein tq',
        'Create a photograph of the woman from the first image taken from a low camera angle: the camera is '
        'below her chest pointing upward at her face, a worm\'s-eye view, so her chin and the underside of her '
        'jaw are prominent, the turtleneck collar is large and close at the bottom of the frame, and her face '
        'is higher and further away. She keeps the same three-quarter pose, head level, looking ahead. ' + FACE),
    'l3 short': ('flux3-klein tq',
        'Low-angle shot: the camera is now below her, looking up at her face from chest level. Her chin and the '
        'underside of her jaw are visible. Her head stays level. Keep everything else the same.'),
}


def sweep(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    base = json.load(open(os.path.join(OUT, 'stage1_2k.json')))
    done = os.path.join(OUT, 'sweep_2k.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    for key, (src, prompt) in VARIANTS.items():
        if key not in res:
            res[key] = gen(port, {'modelId': 'flux3-klein', 'operation': 'edit', 'positive': prompt, 'turbo': False,
                                  'media': [{'role': 'inputImage', 'url': base[src]}],
                                  'cardName': f'angles sweep {key}'})
            json.dump(res, open(done, 'w'), indent=1)
    cell = 420
    keys = ['source', 'flux3-klein pr', 'p1 measured', 'p2 create', None,
            'flux3-klein tq', 'flux3-klein lo', 'l1 measured', 'l2 create', 'l3 short']
    img = Image.new('RGB', (cell * 5, (cell + 24) * 2), 'white')
    d = ImageDraw.Draw(img)
    for i, k in enumerate(keys):
        if k is None or (k in VARIANTS and k not in res):
            continue
        im = Image.open(disk(res.get(k) or base[k])).convert('RGB')
        im.thumbnail((cell, cell))
        x, y = (i % 5) * cell, (i // 5) * (cell + 24)
        img.paste(im, (x, y + 24))
        d.text((x + 4, y + 4), k if k in VARIANTS else f'{k} (stage1 2k)', fill='black')
    img.save(os.path.join(HERE, 'sheets', 'sweep_2k.jpg'), quality=90)


# Sweep 2 (Fabio 2026-10-23): the user's photo may already be angled, so a prompt names the TARGET view
# (side, degrees from where she faces, camera height and tilt), never a move from the current view.
# Each target runs from two inputs (front source, FLUX.3 3/4): a good prompt lands the same view from both.
TARGETS = {
    'tq': ('Create a photograph of the woman from the first image seen in a three-quarter view from her left '
           'side: the camera stands at eye level 45 degrees to her left, so she faces partly toward frame-left, '
           'her left cheek and her left ear with the gold hoop are nearest the camera, her nose overlaps the far '
           'cheek and only part of her right eye shows. Head-to-chest framing. ' + FACE),
    'pr': ('Create a photograph of the woman from the first image in strict left side profile: the camera stands '
           'at eye level exactly 90 degrees to her left, so she faces frame-left. Only her left eye shows, her '
           'nose, lips and chin are outlined against the grey backdrop, her left ear with the gold hoop sits in '
           'the middle of her head, her right cheek, eye and ear are hidden, and her shoulders are side-on. '
           'Head-to-chest framing. ' + FACE),
    'lo': ('Create a photograph of the woman from the first image from a low camera angle in a three-quarter view '
           'from her left side: the camera stands 45 degrees to her left at the height of her chest and points '
           'upward at her face at about 30 degrees. Seen from below, the underside of her chin and jaw and her '
           'nostrils show, her neck looks longer and the turtleneck collar is large in the lower frame. Her head '
           'is level and her eyes look ahead, not up. ' + FACE),
}
INPUTS = {'front': 'source', 'tq-in': 'flux3-klein tq'}


def sweep2(port):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    base = json.load(open(os.path.join(OUT, 'stage1_2k.json')))
    done = os.path.join(OUT, 'sweep2_2k.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    for mid, op, extra in MODELS:
        for inp, src in INPUTS.items():
            for t, prompt in TARGETS.items():
                key = f'{mid} {inp} {t}'
                if key not in res:
                    res[key] = gen(port, {'modelId': mid, 'operation': op, 'positive': prompt, **extra,
                                          'media': [{'role': 'inputImage', 'url': base[src]}],
                                          'cardName': f'angles target {key}'})
                    json.dump(res, open(done, 'w'), indent=1)
    sheet2(res, base)


def sheet2(res, base, cell=360):
    rows = [(mid, inp) for mid, _, _ in MODELS for inp in INPUTS]
    img = Image.new('RGB', (cell * 4, (cell + 24) * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, (mid, inp) in enumerate(rows):
        for c, k in enumerate(['in', *TARGETS]):
            key = f'{mid} {inp} {k}'
            url = base[INPUTS[inp]] if k == 'in' else res.get(key)
            if not url:
                continue
            im = Image.open(disk(url)).convert('RGB')
            im.thumbnail((cell, cell))
            y = r * (cell + 24)
            img.paste(im, (c * cell, y + 24))
            d.text((c * cell + 4, y + 4), f'{mid} from {inp}: {k}', fill='black')
    img.save(os.path.join(HERE, 'sheets', 'sweep2_2k.jpg'), quality=90)


# Fast prompt loop (Fabio 2026-10-23): FLUX.3 only, Turbo, 4:5 1K (the ratio shrinks picture 1 to 1 MP),
# same two inputs as sweep2. Add a new version to VERSIONS per prompt change; run `<port> fast <version>`.
VERSIONS = {
    'v1': TARGETS,
    # v1: tq + pr land from both inputs; lo fails (head turns / looks up, camera barely drops). v2 = lo only.
    'v2': {
        'lo straight': ('Create a photograph of the woman from the first image from a low camera angle straight '
                        'in front of her: the camera is at the height of her chest, below her face, pointing upward '
                        'at her. Seen from below, the underside of her chin and jaw and her nostrils face the camera, '
                        'her chin is nearer the camera than her eyes, and the grey backdrop fills the top of the '
                        'frame above her head. Her head is not tilted back: only the camera is lower. ' + FACE),
        'lo perspective': ('Create a low-angle portrait photograph of the woman from the first image, shot from below '
                           'at chest height with the camera tilted up toward her face, a worm\'s-eye perspective. '
                           'Strong upward foreshortening: the turtleneck collar and her chin loom large and close at '
                           'the bottom, her jawline is seen from underneath, her nostrils are visible, and her eyes '
                           'and forehead recede smaller toward the top. She faces the camera with her head level and '
                           'looks straight ahead. ' + FACE),
        'lo below': ('Create a photograph of the woman from the first image photographed from below, the camera '
                     'looking up at her face from beneath her chin, her head level and her eyes looking ahead. ' + FACE),
    },
    # v2: 'lo straight' = strong real low angle from both inputs, 'lo perspective' = milder, 'lo below' = nothing.
    # v3: the working low-angle wording + a side (3/4 from her left), and a high angle in the same shape.
    'v3': {
        'lo 3q': ('Create a photograph of the woman from the first image from a low camera angle: the camera is at '
                  'the height of her chest, below her face, pointing upward at her, and placed 45 degrees to her '
                  'left so she is in a three-quarter view with her left ear and gold hoop nearer the camera. Seen '
                  'from below, the underside of her chin and jaw face the camera, her chin is nearer the camera '
                  'than her eyes, and the grey backdrop fills the top of the frame. Her head is not tilted back: '
                  'only the camera is lower. ' + FACE),
        'hi straight': ('Create a photograph of the woman from the first image from a high camera angle straight in '
                        'front of her: the camera is above her head, pointing down at her. Seen from above, the top '
                        'of her head and her hair parting show, her forehead is nearer the camera than her chin, her '
                        'chin and neck are small and partly hidden, and her shoulders recede below. Her head is not '
                        'tilted down: only the camera is higher. ' + FACE),
        'hi 3q': ('Create a photograph of the woman from the first image from a high camera angle: the camera is '
                  'above her head, pointing down at her, and placed 45 degrees to her left so she is in a '
                  'three-quarter view with her left ear and gold hoop nearer the camera. Seen from above, the top of '
                  'her head and her hair parting show, her forehead is nearer the camera than her chin, and her '
                  'chin and neck are small. Her head is not tilted down: only the camera is higher. ' + FACE),
    },
    # v3: hi straight works from both inputs; lo 3q / hi 3q land the side only from the 3/4 input (from the
    # front: weak, or the WRONG side). v1's working 3/4 also said "faces partly toward frame-left": v4 adds that.
    'v4': {
        'lo 3q': ('Create a photograph of the woman from the first image from a low camera angle in a three-quarter '
                  'view: the camera is at the height of her chest, below her face, pointing upward at her, and '
                  'placed 45 degrees to her left, so she faces partly toward frame-left with her left ear and gold '
                  'hoop nearer the camera and her right cheek turned away. Seen from below, the underside of her '
                  'chin and jaw face the camera, her chin is nearer the camera than her eyes, and the grey backdrop '
                  'fills the top of the frame. Her head is not tilted back: only the camera is lower. ' + FACE),
        'hi 3q': ('Create a photograph of the woman from the first image from a high camera angle in a three-quarter '
                  'view: the camera is above her head, pointing down at her, and placed 45 degrees to her left, so '
                  'she faces partly toward frame-left with her left ear and gold hoop nearer the camera and her '
                  'right cheek turned away. Seen from above, the top of her head and her hair parting show, her '
                  'forehead is nearer the camera than her chin, and her chin and neck are small. Her head is not '
                  'tilted down: only the camera is higher. ' + FACE),
    },
}
FAST = {'modelId': 'flux3-klein', 'operation': 'edit', 'turbo': True, 'ratio': '4:5', 'qualityTier': '1k'}


def fast(port, version):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    base = json.load(open(os.path.join(OUT, 'stage1_2k.json')))
    done = os.path.join(OUT, 'fast.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    for inp, src in INPUTS.items():
        for t, prompt in VERSIONS[version].items():
            key = f'{version} {inp} {t}'
            if key not in res:
                res[key] = gen(port, {**FAST, 'positive': prompt, 'cardName': f'angles fast {key}',
                                      'media': [{'role': 'inputImage', 'url': base[src]}]})
                json.dump(res, open(done, 'w'), indent=1)
    cell = 360
    img = Image.new('RGB', (cell * 4, (cell + 24) * 2), 'white')
    d = ImageDraw.Draw(img)
    for r, inp in enumerate(INPUTS):
        for c, k in enumerate(['in', *VERSIONS[version]]):
            url = base[INPUTS[inp]] if k == 'in' else res[f'{version} {inp} {k}']
            im = Image.open(disk(url)).convert('RGB')
            im.thumbnail((cell, cell))
            img.paste(im, (c * cell, r * (cell + 24) + 24))
            d.text((c * cell + 4, r * (cell + 24) + 4), f'{version} from {inp}: {k}', fill='black')
    img.save(os.path.join(HERE, 'sheets', f'fast_{version}.jpg'), quality=90)


# Stage 2 - full body (Fabio 2026-10-23: FLUX.3 Turbo 1K, the v1-v4 recipe). Lopsided details again: bag strap
# from her LEFT shoulder to a bag at her RIGHT hip, watch on her LEFT wrist, hoop in her LEFT ear.
BODY_SOURCE = (
    'Full-color studio photograph, full-body shot of a woman in her early thirties with olive skin standing upright '
    'and facing the camera straight on, arms relaxed at her sides, camera at waist height, soft key light from '
    'frame-left, plain mid-grey seamless backdrop and floor. She has dark brown wavy shoulder-length hair parted on '
    'her left side and a single gold hoop earring in her left ear. She wears a rust-orange ribbed knit turtleneck '
    'sweater tucked into high-waisted dark blue straight-leg jeans, white canvas sneakers, a thin brown leather '
    'crossbody strap running from her left shoulder down to a small brown leather bag at her right hip, and a silver '
    'watch on her left wrist. Framed from the top of her head to her feet with a little floor below.')
OUTFIT = ('Head to feet in frame. Same woman, same hair, rust-orange turtleneck, dark blue jeans, white sneakers, '
          'brown crossbody bag, silver watch, gold hoop earring and grey studio backdrop.')
P = 'Create a photograph of the woman from the first image '
BODY = {
    'tq L': P + ('in a full-body three-quarter view from her left side: the camera stands at waist height 45 degrees '
                 'to her left, so her whole body faces partly toward frame-left, her left shoulder, her left arm with '
                 'the silver watch and her left hip are nearer the camera and her right side turns away. ' + OUTFIT),
    'pr L': P + ('in a full-body strict left side profile: the camera stands at waist height exactly 90 degrees to her '
                 'left, so she faces frame-left. Only her left side shows: one eye, her nose and chin outlined against '
                 'the backdrop, her left arm with the watch at her side, her legs seen from the side; her right side '
                 'is hidden. ' + OUTFIT),
    'back': P + ('seen from directly behind: the camera stands at waist height 180 degrees behind her, so she faces '
                 'away from the camera toward the grey backdrop. The back of her head and hair, the back of her '
                 'sweater, the strap crossing her back, the back pockets of her jeans and the heels of her sneakers '
                 'show; her face is not visible. ' + OUTFIT),
    'tq R': P + ('in a full-body three-quarter view from her right side: the camera stands at waist height 45 degrees '
                 'to her right, so her whole body faces partly toward frame-right, her right shoulder and the small '
                 'bag at her right hip are nearer the camera and her left side turns away. ' + OUTFIT),
    'lo': P + ('from a low camera angle straight in front of her: the camera is at the height of her knees, pointing '
               'upward at her. Seen from below, her sneakers and legs are large near the bottom of the frame, her '
               'legs look long, her body narrows upward, her head is smaller at the top, the underside of her chin '
               'shows and grey backdrop fills the space above her head. She stands upright with her head level: '
               'only the camera is lower. ' + OUTFIT),
    'hi': P + ('from a high camera angle straight in front of her: the camera is high above her head, pointing down '
               'at her. Seen from above, the top of her head, her hair parting and her shoulders are large and near '
               'the camera, her body narrows downward, her legs look short and her sneakers are small on the grey '
               'floor at the bottom. She stands upright with her head level: only the camera is higher. ' + OUTFIT),
    'lo 3q': P + ('from a low camera angle in a full-body three-quarter view: the camera is at the height of her '
                  'knees, pointing upward, placed 45 degrees to her left, so her whole body faces partly toward '
                  'frame-left with her left side nearer the camera. Seen from below, her sneakers and legs are large '
                  'near the bottom, her legs look long, her head is smaller at the top and the underside of her chin '
                  'shows. She stands upright with her head level: only the camera is lower. ' + OUTFIT),
    'hi 3q': P + ('from a high camera angle in a full-body three-quarter view: the camera is high above her head, '
                  'pointing down, placed 45 degrees to her left, so her whole body faces partly toward frame-left '
                  'with her left side nearer the camera. Seen from above, the top of her head and her shoulders are '
                  'large and near the camera, her legs look short and her sneakers are small at the bottom. She '
                  'stands upright with her head level: only the camera is higher. ' + OUTFIT),
}
TURN = ('her whole body (head, shoulders, hips and feet) is turned to face partly toward frame-{f}. Her shoulders and '
        'hips are seen at an angle: her {n} shoulder, {n} arm and {n} hip are nearer the camera, her {o} shoulder is '
        'partly hidden behind her chest, her {n} foot is nearer the camera than her {o}, and her face is in '
        'three-quarter view. ')
LO = ('Seen from below, her feet are nearest the camera and her head farthest: her sneakers and legs are large near '
      'the bottom, her legs look long, her head is small at the top and the underside of her chin shows. She stands '
      'upright with her head level: only the camera is lower. ')
HI = ('Seen from above, her head is nearest the camera and her feet farthest: the top of her head, her hair parting '
      'and her shoulders are large near the top, her legs look short and her sneakers are small on the grey floor at '
      'the bottom. She stands upright with her head level: only the camera is higher. ')
# b1: profile, back, lo/hi straight pass from the front; 3/4 turns too small, lo 3q never moves, and the 3/4
# input came out nearly frontal. b2: second input = b1's left profile; 3/4 spelled as body geometry; lo/hi
# say which end of her is nearest the camera.
BODY2 = {
    'tq L': P + ('in a full-body three-quarter view from her left side: the camera stands at waist height 45 degrees '
                 'to her left, so ' + TURN.format(f='left', n='left', o='right') + OUTFIT),
    'pr L': BODY['pr L'],
    'back': BODY['back'],
    'tq R': P + ('in a full-body three-quarter view from her right side: the camera stands at waist height 45 degrees '
                 'to her right, so ' + TURN.format(f='right', n='right', o='left') + OUTFIT),
    'lo': P + ('from a low camera angle straight in front of her: the camera is at the height of her knees, pointing '
               'upward at her. ' + LO + OUTFIT),
    'hi': P + ('from a high camera angle straight in front of her: the camera is high above her head, pointing down '
               'at her. ' + HI + OUTFIT),
    'lo 3q': P + ('from a low camera angle in a full-body three-quarter view: the camera is at the height of her '
                  'knees, pointing upward, placed 45 degrees to her left, so ' +
                  TURN.format(f='left', n='left', o='right') + LO + OUTFIT),
    'hi 3q': P + ('from a high camera angle in a full-body three-quarter view: the camera is high above her head, '
                  'pointing down, placed 45 degrees to her left, so ' +
                  TURN.format(f='left', n='left', o='right') + HI + OUTFIT),
}
# b2: from the front hi, tq R, back, profile pass; tq L still a small turn, lo 3q never moves. From the b1 profile
# input almost nothing turns (only back + hi): Turbo holds a full-body pose far harder than a face.
# b3 (Fabio 2026-10-23): the LoRA-training orbit - front, 3/4 front L/R, profile L/R, 3/4 BACK L/R (lost
# profile: only part of the face from behind), back. Second input = b2's good 3/4 R.
LOST = ('in a full-body three-quarter rear view from behind her {s} shoulder, a lost-profile view: the camera stands '
        'at waist height 135 degrees round to her {s}, behind her, so she faces away from the camera, angled toward '
        'frame-{s} and into the picture. The back of her head, her {s} ear and only the edge of her {s} cheek and '
        'jawline show; her eyes and nose are hidden behind her cheek. The back of her sweater, her {s} shoulder '
        'blade, the back of her {s} arm, the strap crossing her back and the back pockets of her jeans are seen at '
        'an angle. ')
FRONT3Q = ('in a full-body three-quarter front view showing her {s} side: the camera stands at waist height 45 degrees '
           'round to her {s}, so her body is angled halfway between facing the camera and facing frame-{s}: her {s} '
           'shoulder, {s} arm and {s} hip are nearer the camera, her {o} shoulder and {o} arm are partly hidden '
           'behind her body, her {s} foot is in front of her {o}, and her face shows its {s} cheek, both eyes and '
           'her nose pointing toward frame-{s}. ')
ORBIT = {
    'tq L': P + FRONT3Q.format(s='left', o='right') + OUTFIT,
    'pr L': BODY['pr L'],
    'tqb L': P + LOST.format(s='left') + OUTFIT,
    'back': BODY['back'],
    'tqb R': P + LOST.format(s='right') + OUTFIT,
    'pr R': P + ('in a full-body strict right side profile: the camera stands at waist height exactly 90 degrees to '
                 'her right, so she faces frame-right. Only her right side shows: one eye, her nose and chin outlined '
                 'against the backdrop, the small brown bag at her right hip nearest the camera, her right arm at her '
                 'side, her legs seen from the side; her left side and the watch are hidden. ' + OUTFIT),
    'tq R': P + FRONT3Q.format(s='right', o='left') + OUTFIT,
}
BODY_VERSIONS = {'b1': (BODY, 'tq-in'), 'b2': (BODY2, 'b1 front pr L'), 'b3': (ORBIT, 'b2 front tq R')}
BODY_FAST = {**FAST, 'ratio': '9:16'}
FRONT = P + ('in a full-body front view: the camera stands at waist height straight in front of her, so she faces '
             'the camera squarely: her chest, hips and feet point straight at the camera, both shoulders equally '
             'visible, both arms at her sides, her face looking straight into the lens with both eyes, both ears and '
             'both cheeks equally visible. ' + OUTFIT)
HARD = ['tq L', 'pr L', 'back', 'pr R']


def b4(port):
    """Angled full-body input (Fabio 2026-10-23): (a) front view first, then the orbit from that front;
    (b) the BASE model (Turbo off) straight from the angled input."""
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    done = os.path.join(OUT, 'body.json')
    res = json.load(open(done))

    def step(key, prompt, url, turbo=True):
        if key not in res:
            res[key] = gen(port, {**BODY_FAST, 'turbo': turbo, 'positive': prompt, 'cardName': f'angles body {key}',
                                  'media': [{'role': 'inputImage', 'url': url}]})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    angled = ['b2 front tq R', 'b1 front pr L']
    for a in angled:
        step(f'b4 {a} -> front', FRONT, res[a])
    via = res['b4 b2 front tq R -> front']
    for t, prompt in ORBIT.items():
        step(f'b4 via-front {t}', prompt, via)
    for t in HARD:
        step(f'b4 base {t}', ORBIT[t], res['b2 front tq R'], turbo=False)
    rows = [
        [(a, 'angled input') for a in angled[:1]] + [(f'b4 {angled[0]} -> front', 'front from 3/4')] +
        [(angled[1], 'angled input')] + [(f'b4 {angled[1]} -> front', 'front from profile')],
        [(f'b4 via-front {t}', f'via front: {t}') for t in ORBIT],
        [(angled[0], 'angled input')] + [(f'b4 base {t}', f'base: {t}') for t in HARD],
    ]
    cell, h = 240, int(240 * 16 / 9) + 24
    img = Image.new('RGB', (cell * 7, h * 3), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (k, label) in enumerate(row):
            im = Image.open(disk(res[k])).convert('RGB')
            im.thumbnail((cell, h - 24))
            img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', 'body_b4.jpg'), quality=90)


FRONTS = {'src': ('source', 'b3 front {t}'), 'good': ('b4 b1 front pr L -> front', 'b5 via-good-front {t}')}
SEEDS = [111, 222, 333]


def b6(port):
    """Pass rate per orbit view (Fabio 2026-10-23): ORBIT from both fronts on 3 more seeds; seed 1234 comes from
    b3 / b5. One sheet per front: rows = seeds, columns = views."""
    done = os.path.join(OUT, 'body.json')
    res = json.load(open(done))
    if port:
        if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
            sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
        for f, (src, _) in FRONTS.items():
            for s in SEEDS:
                for t, prompt in ORBIT.items():
                    key = f'b6 {f} {t} seed {s}'
                    if key not in res:
                        res[key] = gen(port, {**BODY_FAST, 'positive': prompt, 'seed': s,
                                              'cardName': f'angles body {key}',
                                              'media': [{'role': 'inputImage', 'url': res[src]}]})
                        json.dump(res, open(done, 'w'), indent=1)
    cell, h = 200, int(200 * 16 / 9) + 24
    for f, (src, old) in FRONTS.items():
        img = Image.new('RGB', (cell * (len(ORBIT) + 1), h * (len(SEEDS) + 1)), 'white')
        d = ImageDraw.Draw(img)
        for r, s in enumerate([1234, *SEEDS]):
            cells = [(src, 'input')] + [(old.format(t=t) if s == 1234 else f'b6 {f} {t} seed {s}', f'{t} s{s}')
                                        for t in ORBIT]
            for c, (k, label) in enumerate(cells):
                if k not in res:
                    continue
                im = Image.open(disk(res[k])).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
                d.text((c * cell + 4, r * h + 4), label, fill='black')
        img.save(os.path.join(HERE, 'sheets', f'body_b6_{f}.jpg'), quality=90)


def b5(port):
    """b4: front-from-profile passes, front-from-3/4 fails (so b4's via-front orbit sat on a failed front);
    base model = no help. b5: the orbit from the GOOD front (made from the profile), and front-from-3/4 on
    three other seeds (is the fixed seed what holds that picture?)."""
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    done = os.path.join(OUT, 'body.json')
    res = json.load(open(done))

    def step(key, prompt, url, **kw):
        if key not in res:
            res[key] = gen(port, {**BODY_FAST, 'positive': prompt, 'cardName': f'angles body {key}',
                                  'media': [{'role': 'inputImage', 'url': url}], **kw})
            json.dump(res, open(done, 'w'), indent=1)

    good = res['b4 b1 front pr L -> front']
    for t, prompt in ORBIT.items():
        step(f'b5 via-good-front {t}', prompt, good)
    seeds = [111, 222, 333]
    for s in seeds:
        step(f'b5 tqR -> front seed {s}', FRONT, res['b2 front tq R'], seed=s)
    rows = [[('b4 b1 front pr L -> front', 'good front (from profile)')] +
            [(f'b5 via-good-front {t}', f'via good front: {t}') for t in ORBIT],
            [('b2 front tq R', '3/4 input'), ('b4 b2 front tq R -> front', 'front, seed 1234')] +
            [(f'b5 tqR -> front seed {s}', f'front, seed {s}') for s in seeds]]
    cell, h = 240, int(240 * 16 / 9) + 24
    img = Image.new('RGB', (cell * 8, h * 2), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (k, label) in enumerate(row):
            im = Image.open(disk(res[k])).convert('RGB')
            im.thumbnail((cell, h - 24))
            img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', 'body_b5.jpg'), quality=90)


def body(port, version='b1'):
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    done = os.path.join(OUT, 'body.json')
    res = json.load(open(done)) if os.path.exists(done) else {}

    def step(key, body_):
        if key not in res:
            res[key] = gen(port, {**body_, 'cardName': f'angles body {key}'})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    src = step('source', {'modelId': 'flux3-klein', 'operation': 't2i', 'positive': BODY_SOURCE,
                          'ratio': '9:16', 'qualityTier': '1k', 'turbo': True})
    prompts, second = BODY_VERSIONS[version]
    if second == 'tq-in':
        step('tq-in', {**BODY_FAST, 'positive': BODY['tq L'], 'media': [{'role': 'inputImage', 'url': src}]})
    ins = {'front': src, second: res[second]}
    for inp, url in ins.items():
        for t, prompt in prompts.items():
            step(f'{version} {inp} {t}', {**BODY_FAST, 'positive': prompt,
                                          'media': [{'role': 'inputImage', 'url': url}]})
    cell = 240
    img = Image.new('RGB', (cell * (len(prompts) + 1), (int(cell * 16 / 9) + 24) * 2), 'white')
    d = ImageDraw.Draw(img)
    h = int(cell * 16 / 9) + 24
    for r, (inp, url) in enumerate(ins.items()):
        for c, t in enumerate(["input", *prompts]):
            im = Image.open(disk(url if t == 'input' else res[f'{version} {inp} {t}'])).convert('RGB')
            im.thumbnail((cell, h - 24))
            img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), f'{inp}: {t}', fill='black')
    img.save(os.path.join(HERE, 'sheets', f'body_{version}.jpg'), quality=90)


WINNERS = [('v1', 'tq'), ('v1', 'pr'), ('v2', 'lo straight'), ('v2', 'lo perspective'), ('v4', 'lo 3q'),
           ('v3', 'hi straight'), ('v4', 'hi 3q')]


def best():
    base = json.load(open(os.path.join(OUT, 'stage1_2k.json')))
    res = json.load(open(os.path.join(OUT, 'fast.json')))
    cell = 300
    img = Image.new('RGB', (cell * (len(WINNERS) + 1), (cell + 24) * 2), 'white')
    d = ImageDraw.Draw(img)
    for r, inp in enumerate(INPUTS):
        for c, (v, t) in enumerate([(None, 'input'), *WINNERS]):
            url = base[INPUTS[inp]] if v is None else res[f'{v} {inp} {t}']
            im = Image.open(disk(url)).convert('RGB')
            im.thumbnail((cell, cell))
            img.paste(im, (c * cell, r * (cell + 24) + 24))
            d.text((c * cell + 4, r * (cell + 24) + 4), f'from {inp}: {t}' + (f' ({v})' if v else ''), fill='black')
    img.save(os.path.join(HERE, 'sheets', 'fast_best.jpg'), quality=90)


def sheet(res, name='stage1', cell=420):
    cols = ['source', 'tq', 'pr', 'lo']
    img = Image.new('RGB', (cell * 4, (cell + 24) * len(MODELS)), 'white')
    d = ImageDraw.Draw(img)
    for r, (mid, _, _) in enumerate(MODELS):
        for c, shot in enumerate(cols):
            key = 'source' if shot == 'source' else f'{mid} {shot}'
            if key not in res:
                continue
            im = Image.open(disk(res[key])).convert('RGB')
            im.thumbnail((cell, cell))
            y = r * (cell + 24)
            img.paste(im, (c * cell, y + 24))
            d.text((c * cell + 4, y + 4), f'{mid} {shot}', fill='black')
    os.makedirs(os.path.join(HERE, 'sheets'), exist_ok=True)
    img.save(os.path.join(HERE, 'sheets', name + '.jpg'), quality=90)


if __name__ == '__main__':
    if sys.argv[1:2] == ['best']:
        best()
    elif sys.argv[2:3] == ['sweep']:
        sweep(int(sys.argv[1]))
    elif sys.argv[2:3] == ['sweep2']:
        sweep2(int(sys.argv[1]))
    elif sys.argv[1:2] == ['b6sheet']:
        b6(0)
    elif sys.argv[2:3] == ['b6']:
        b6(int(sys.argv[1]))
    elif sys.argv[2:3] == ['b5']:
        b5(int(sys.argv[1]))
    elif sys.argv[2:3] == ['b4']:
        b4(int(sys.argv[1]))
    elif sys.argv[2:3] == ['body']:
        body(int(sys.argv[1]), *sys.argv[3:4])
    elif sys.argv[2:3] == ['fast']:
        fast(int(sys.argv[1]), sys.argv[3])
    elif sys.argv[1:2] == ['sheet']:
        name = sys.argv[2] if len(sys.argv) > 2 else 'stage1'
        sheet(json.load(open(os.path.join(OUT, name + '.json'))), name)
    else:
        main(int(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else '1k')
