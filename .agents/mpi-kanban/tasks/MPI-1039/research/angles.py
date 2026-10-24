"""MPI-1039 stage 1: does each edit model keep a face across camera angles?

  python angles.py <port>          (run under gpu_lease.py run: it dispatches on the local GPU)

One FLUX.3 head-and-shoulders source, then per model: front -> 3/4, front -> profile, and that
model's OWN 3/4 -> low angle. Results + sheet land in research/out/ and research/sheets/.
"""
import json, os, sys, urllib.parse, urllib.request
from PIL import Image, ImageChops, ImageDraw, ImageStat

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


# Vertical orbit (Fabio 2026-10-23): 5 pitch stops x 3 yaws on the face and the full body, one seed (111). Each
# prompt = yaw (camera side + frame direction) + pitch (camera height + pointing) + which end of her is nearest
# the camera + "only the camera moved". Two-step: the 3/4-L+low/high prompt run on this bench's own 3/4-L level.
PITCH_SEED = 111
YAWS = {
    'face': {
        'front': 'straight in front of her, so she faces the camera with both eyes and both cheeks equally visible. ',
        'tq L': ('45 degrees round to her left, so she faces partly toward frame-left with her left ear and gold hoop '
                 'nearer the camera and her right cheek turned away. '),
        'tqb L': ('135 degrees round to her left, behind her, a lost-profile view: she faces away from the camera, '
                  'angled toward frame-left; the back of her head, her left ear with the gold hoop and only the edge '
                  'of her left cheek and jawline show; her eyes and nose are hidden behind her cheek. '),
    },
    'body': {
        'front': ('straight in front of her, so she faces the camera squarely: chest, hips and feet point at the '
                  'camera, both shoulders equally visible. '),
        'tq L': ('45 degrees round to her left, so her body is angled halfway between facing the camera and facing '
                 'frame-left: her left shoulder, left arm and left hip are nearer the camera, her right shoulder and '
                 'right arm are partly hidden behind her body, and her face shows its left cheek with her nose '
                 'pointing toward frame-left. '),
        'tqb L': ('135 degrees round to her left, behind her, a lost-profile view: she faces away from the camera, '
                  'angled toward frame-left and into the picture; the back of her head, her left ear and only the '
                  'edge of her left cheek show, her eyes and nose hidden; the back of her sweater, the strap crossing '
                  'her back and the back pockets of her jeans are seen at an angle. '),
    },
}
PITCHES = {  # (camera height + pointing, what the picture shows)
    'face': {
        'xlo': ('an extreme low camera angle, a worm\'s-eye view: the camera is far below her face, at the height of '
                'her lower chest, pointing steeply upward at about 60 degrees',
                'Seen from far below, the underside of her jaw and chin fill the middle of the picture, her nostrils '
                'show, her chin and neck are much nearer the camera than her eyes, her forehead is small and '
                'foreshortened at the top, and grey backdrop fills the frame above her head. Her head is not tilted '
                'back: only the camera is much lower. '),
        'lo': ('a low camera angle: the camera is at the height of her chest, below her face, pointing upward at her',
               'Seen from below, the underside of her chin and jaw face the camera, her chin is nearer the camera than '
               'her eyes, and the grey backdrop fills the top of the frame. Her head is not tilted back: only the '
               'camera is lower. '),
        'level': ('an eye-level camera: the camera is at the height of her eyes, pointing straight at her',
                  'Head-to-chest framing. '),
        'hi': ('a high camera angle: the camera is above her head, pointing down at her',
               'Seen from above, the top of her head and her hair parting show, her forehead is nearer the camera than '
               'her chin, and her chin and neck are small. Her head is not tilted down: only the camera is higher. '),
        'xhi': ('an extreme high camera angle, a bird\'s-eye view: the camera is high directly above her head, '
                'pointing almost straight down at her',
                'Seen from far above, the crown of her head and her hair parting fill the top of the picture, her '
                'face is strongly foreshortened below it, her chin is hidden, her shoulders and the grey floor recede '
                'far below. Her head is not tilted down: only the camera is much higher. '),
    },
    'body': {
        'xlo': ('an extreme low camera angle, a worm\'s-eye view: the camera is on the floor at her feet, pointing '
                'steeply upward at her',
                'Seen from the floor, her sneakers are huge and nearest the camera at the bottom, her legs tower '
                'upward and narrow sharply, her body tapers to a small head at the very top with the underside of her '
                'chin showing, and grey backdrop fills the space above. She stands upright with her head level: only '
                'the camera is on the floor. '),
        'lo': ('a low camera angle: the camera is at the height of her knees, pointing upward at her',
               'Seen from below, her feet are nearest the camera and her head farthest: her sneakers and legs are '
               'large near the bottom, her legs look long, her head is small at the top and the underside of her chin '
               'shows. She stands upright with her head level: only the camera is lower. '),
        'level': ('a camera at waist height, pointing straight at her', ''),
        'hi': ('a high camera angle: the camera is high above her head, pointing down at her',
               'Seen from above, her head is nearest the camera and her feet farthest: the top of her head, her hair '
               'parting and her shoulders are large near the top, her legs look short and her sneakers are small on '
               'the grey floor at the bottom. She stands upright with her head level: only the camera is higher. '),
        'xhi': ('an extreme high camera angle, a bird\'s-eye view: the camera is high directly above her, pointing '
                'almost straight down',
                'Seen from far above, the top of her head and her shoulders are nearest the camera and fill the middle '
                'of the picture, her body is strongly foreshortened beneath them, her sneakers barely peek out below, '
                'and the grey floor surrounds her on every side. She stands upright with her head level: only the '
                'camera is far overhead. '),
    },
}
# Object (Fabio 2026-10-23): a plain floating product shot - nothing to tilt a head, so a miss is the camera's
# own. A box with distinct faces (grille front, strap on one end, buttons on top, port on the back) shows yaw and
# pitch as WHICH FACES ARE VISIBLE. Frame terms only: an object has no left/right of its own.
OBJECT_SOURCE = (
    'Full-color plain product photograph of a compact rectangular Bluetooth speaker floating in mid-air in the '
    'center of the frame, seen straight from the front at its own height, against a plain light-grey seamless '
    'backdrop with soft even studio light. The front is a forest-green fabric grille with a small brass logo badge '
    'in its lower-left corner. A tan leather carry strap is attached to its right end only (frame-right); the left '
    'end is plain green. The top face is dark grey with three round rubber buttons; the underside is plain dark grey '
    'with four small rubber feet. No props, no text, no reflections.')
OBJ_KEEP = ('Same speaker, same green grille, brass badge, tan leather strap, buttons and feet, floating in mid-air '
            'against the same plain light-grey backdrop.')
YAWS['object'] = {
    'front': ('straight in front of the speaker, so its green front grille faces the camera squarely and the strap '
              'end is at frame-right. '),
    'tq L': ('45 degrees round toward its strap end, so the speaker is seen at an angle: the green front grille turns '
             'partly away toward frame-left and the end with the tan leather strap faces partly toward the camera, '
             'the front and the strap end showing about equally. '),
    'tqb L': ('135 degrees round toward its strap end, behind it: the plain dark back panel and the strap end face the '
              'camera at an angle, and the green front grille is hidden on the far side. '),
}
PITCHES['object'] = {
    'xlo': ('an extreme low camera angle, a worm\'s-eye view: the camera is far below the speaker, pointing steeply '
            'upward at it',
            'Seen from far below, the dark underside with its four rubber feet faces the camera and fills much of the '
            'picture, the top face and its buttons are hidden, and the speaker looms overhead. The speaker has not '
            'been rotated: only the camera is much lower. '),
    'lo': ('a low camera angle: the camera is below the speaker, pointing upward at it',
           'Seen from below, part of the underside with its rubber feet shows, the top face and buttons are hidden, '
           'and its bottom edge is nearer the camera than its top edge. The speaker has not been rotated: only the '
           'camera is lower. '),
    'level': ('a camera level with the speaker, pointing straight at it',
              'Neither its top face nor its underside shows. '),
    'hi': ('a high camera angle: the camera is above the speaker, pointing down at it',
           'Seen from above, the top face with its three round buttons shows, its top edge is nearer the camera than '
           'its bottom edge, and the underside is hidden. The speaker has not been rotated: only the camera is '
           'higher. '),
    'xhi': ('an extreme high camera angle, a bird\'s-eye view: the camera is directly above the speaker, pointing '
            'almost straight down at it',
            'Seen from far above, the top face with the three buttons fills most of the speaker\'s outline, the sides '
            'are thin foreshortened strips below it, and plain grey floor shows all round it. The speaker has not been '
            'rotated: only the camera is much higher. '),
}
# Scene (Fabio 2026-10-23): a waist-up character IN a place - a real orbit must also move the street behind him
# (sky + buildings from low, cobbles from high, the street ahead of him from behind).
SCENE_SOURCE = (
    'Full-color photograph, waist-up shot of a man in his forties with a short grey beard and short dark hair, '
    'standing on a quiet cobbled old-town street in warm late-afternoon sunlight, facing the camera straight on at '
    'eye level. He wears a navy cotton chore jacket over a white t-shirt and a brown canvas messenger bag strap over '
    'his left shoulder only. Behind him: a cream plaster shop front with a red wooden door on frame-left, a blue '
    'bicycle leaning against the wall on frame-right, and a string of small round lights hanging across the street '
    'above. Framed from the top of his head to his waist.')
SCENE_KEEP = ('Same man, same beard, navy jacket, white t-shirt, bag strap, and the same cobbled street, shop front, '
              'red door, blue bicycle, string lights and late-afternoon light.')
YAWS['scene'] = {
    'front': 'straight in front of him, so he faces the camera with both shoulders equally visible. ',
    'tq L': ('45 degrees round to his left, so he faces partly toward frame-left with his left shoulder and the bag '
             'strap nearer the camera and his right shoulder turned away; the shop front behind him is now seen at an '
             'angle, running away diagonally. '),
    'tqb L': ('135 degrees round to his left, behind him, a lost-profile view: he faces away from the camera, angled '
              'toward frame-left and into the street; the back of his head, his left ear and only the edge of his left '
              'cheek and beard show, his eyes and nose hidden; the back of his jacket shows, and the camera now looks '
              'along the street the way he faces, away from the shop front. '),
}
PITCHES['scene'] = {
    'xlo': ('an extreme low camera angle, a worm\'s-eye view: the camera is far below him, near his waist, pointing '
            'steeply upward',
            'Seen from far below, his chest and the underside of his chin and beard are nearest the camera, his head is '
            'small at the top, and the building fronts and the string lights tower overhead against the sky. He '
            'stands upright with his head level: only the camera is much lower. '),
    'lo': ('a low camera angle: the camera is at the height of his waist, pointing upward at him',
           'Seen from below, the underside of his chin shows, his chest is nearer the camera than his face, and more of '
           'the building fronts and the sky show above him. He stands upright with his head level: only the camera is '
           'lower. '),
    'level': ('an eye-level camera: the camera is at the height of his eyes, pointing straight at him',
              'Waist-up framing. '),
    'hi': ('a high camera angle: the camera is above his head, pointing down at him',
           'Seen from above, the top of his head and his shoulders are nearer the camera, his face is foreshortened, and '
           'the cobblestones of the street fill the background behind him. He stands upright with his head level: '
           'only the camera is higher. '),
    'xhi': ('an extreme high camera angle, a bird\'s-eye view: the camera is high directly above him, pointing almost '
            'straight down',
            'Seen from far above, the top of his head and his shoulders fill the middle of the picture, his face is '
            'mostly hidden, and the cobbled street surrounds him on every side. He stands upright with his head '
            'level: only the camera is much higher. '),
}
PITCH_SUBJECTS = {'face': ('stage1_2k.json', FACE, FAST, P), 'body': ('body.json', OUTFIT, BODY_FAST, P),
                  'object': (OBJECT_SOURCE, OBJ_KEEP, FAST, 'Create a photograph of the speaker from the first image '),
                  'scene': (SCENE_SOURCE, SCENE_KEEP, FAST, 'Create a photograph of the man from the first image ')}


def pitch_prompt(subj, yaw, pitch):
    cam, shows = PITCHES[subj][pitch]
    _, keep, _, prefix = PITCH_SUBJECTS[subj]
    return prefix + f'from {cam}, placed {YAWS[subj][yaw]}{shows}{keep}'


def pitch(port):
    done = os.path.join(OUT, 'pitch.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    for subj, (srcfile, _, base, _) in PITCH_SUBJECTS.items():

        def step(key, prompt, url, **kw):
            if key not in res:
                if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                    sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
                media = {'media': [{'role': 'inputImage', 'url': url}]} if url else {}
                res[key] = gen(port, {**base, 'positive': prompt, 'seed': PITCH_SEED, **media, **kw,
                                      'cardName': f'angles pitch {key}'})
                json.dump(res, open(done, 'w'), indent=1)
            return res[key]

        if srcfile.endswith('.json'):  # an earlier bench's source; else srcfile is the t2i prompt for one
            res[f'{subj} input'] = json.load(open(os.path.join(OUT, srcfile)))['source']
        src = step(f'{subj} input', srcfile, None, operation='t2i')
        for yaw in YAWS[subj]:
            for p in PITCHES[subj]:
                if (yaw, p) != ('front', 'level'):
                    step(f'{subj} {yaw} {p}', pitch_prompt(subj, yaw, p), src)
        tq = res[f'{subj} tq L level']
        for p in ('lo', 'hi'):  # two-step: yaw edit first, then this pitch edit on its result
            step(f'{subj} 2step tq L {p}', pitch_prompt(subj, 'tq L', p), tq)
    for subj in PITCH_SUBJECTS:
        cell = 220 if subj == 'body' else 300
        h = (int(cell * 16 / 9) if subj == 'body' else int(cell * 5 / 4)) + 24
        rows = [[(f'{subj} {y} {p}' if (y, p) != ('front', 'level') else f'{subj} input', f'{y} {p}')
                 for p in PITCHES[subj]] for y in YAWS[subj]]
        rows.append([(f'{subj} tq L level', '2step: tq L level'), (None, ''), (f'{subj} 2step tq L lo', '2step tq L lo'),
                     (None, ''), (f'{subj} 2step tq L hi', '2step tq L hi')])
        img = Image.new('RGB', (cell * 5, h * len(rows)), 'white')
        d = ImageDraw.Draw(img)
        for r, row in enumerate(rows):
            for c, (k, label) in enumerate(row):
                if k not in res:
                    continue
                im = Image.open(disk(res[k])).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
                d.text((c * cell + 4, r * h + 4), label, fill='black')
        img.save(os.path.join(HERE, 'sheets', f'pitch_{subj}.jpg'), quality=90)


# akhaliq FLUX.3 angle LoRA (Fabio 2026-10-23): trained on the BASE model, `<mva>` grammar, raw prompts only.
# Keys renamed to ComfyUI's FLUX.3 names by convert_lora.py (the diffusers names load as nothing).
MVA_LORA = {'Lora_1': {'lora_name': 'mpi1039\\flux3-klein-angles-akhaliq-comfy.safetensors', 'strength_model': 1.0,
                      'strength_clip': 1.0}}  # all three keys or comfyController writes the dict into lora_name
MVA = ['front-left quarter view, eye-level shot', 'left side view, eye-level shot',
       'back-left quarter view, eye-level shot', 'back view, eye-level shot', 'front view, low-angle shot',
       'front view, high-angle shot', 'front view, top-down shot', 'back-left quarter view, high-angle shot']


def lora(port):
    done = os.path.join(OUT, 'lora.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    pitch_res = json.load(open(os.path.join(OUT, 'pitch.json')))
    for turbo in (True, False):
        tag = 'turbo' if turbo else 'base'
        for subj, (_, _, base, _) in PITCH_SUBJECTS.items():
            for view in MVA:
                key = f'{tag} {subj} {view}'
                if key not in res:
                    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
                    res[key] = gen(port, {**base, 'turbo': turbo, 'positive': f'<mva> {view}', 'seed': PITCH_SEED,
                                          'injectionParams': MVA_LORA, 'cardName': f'angles lora {key}',
                                          'media': [{'role': 'inputImage', 'url': pitch_res[f'{subj} input']}]})
                    json.dump(res, open(done, 'w'), indent=1)
        cell = 200
        img = Image.new('RGB', (cell * (len(MVA) + 1), (int(cell * 16 / 9) + 24) * len(PITCH_SUBJECTS)), 'white')
        d = ImageDraw.Draw(img)
        h = int(cell * 16 / 9) + 24
        for r, subj in enumerate(PITCH_SUBJECTS):
            for c, (k, label) in enumerate([(None, 'input'), *[(f'{tag} {subj} {v}', v.replace(' view,', ',')
                                                               .replace(' shot', '')) for v in MVA]]):
                url = pitch_res[f'{subj} input'] if k is None else res.get(k)
                if not url:
                    continue
                im = Image.open(disk(url)).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
                d.text((c * cell + 4, r * h + 4), label, fill='black')
        img.save(os.path.join(HERE, 'sheets', f'lora_{tag}.jpg'), quality=90)


# Rotate a character IN a scene (Fabio 2026-10-23): the man turns on the spot, the camera and street stay put.
# Scene p1 showed yaw already lands as a subject turn; this names it as one. Frame terms + visible consequences.
TURN = ('Create a photograph of the man from the first image standing on the same spot, with his whole body (head, '
        'shoulders, chest and hips) turned {t} Only he has turned: the camera, the framing and the street behind him are '
        'exactly as in the first image - the red door stays on frame-left, the blue bicycle on frame-right and the '
        'string lights overhead. ' + SCENE_KEEP)
TURNS = {
    'tq L': ('45 degrees, so he faces partly toward frame-left: his left shoulder and the bag strap are nearer the '
             'camera, his right shoulder is turned away, both eyes still show and his nose points toward frame-left.'),
    'pr L': ('90 degrees, so he stands side-on in full profile facing frame-left: only his left side shows - his left '
             'ear, left cheek, the profile of his nose and beard, and the bag strap on the shoulder nearest the camera.'),
    'tqb L': ('135 degrees, a lost-profile view: he faces away from the camera, angled toward frame-left and into the '
              'picture; the back of his head, his left ear and only the edge of his left cheek and beard show, his '
              'eyes and nose hidden, and the back of his jacket is seen at an angle.'),
    'back': ('180 degrees, so his back is to the camera and he faces straight into the picture toward the shop front: '
             'the back of his head and the back of his navy jacket fill the middle, his face is completely hidden, and '
             'the bag strap crosses his left shoulder on frame-left.'),
    'tqb R': ('135 degrees the other way, a lost-profile view: he faces away from the camera, angled toward frame-right '
              'and into the picture; the back of his head, his right ear and only the edge of his right cheek and beard '
              'show, his eyes and nose hidden, and the back of his jacket is seen at an angle.'),
    'pr R': ('90 degrees the other way, so he stands side-on in full profile facing frame-right: only his right side '
             'shows - his right ear, right cheek, the profile of his nose and beard; the bag strap is on his far '
             'shoulder.'),
    'tq R': ('45 degrees the other way, so he faces partly toward frame-right: his right shoulder is nearer the camera, '
             'his left shoulder and the bag strap are turned away, both eyes still show and his nose points toward '
             'frame-right.'),
}
# p1: the 45s under-turn (tq L head looked the wrong way). v2 = the body bench's passing FRONT3Q geometry
# (halfway between facing the camera and side-on) + the head named as turning WITH the body.
HALF = ('45 degrees, halfway between facing the camera and standing side-on facing frame-{s}: his chest and hips are '
        'angled toward frame-{s}, his {s} shoulder and {s} arm are nearer the camera, his {o} shoulder and {o} arm are '
        'partly hidden behind his body, {strap}. His head turns with his body: his face shows its {s} cheek, both '
        'eyes and his nose pointing toward frame-{s}, looking toward frame-{s} past the camera, not toward frame-{o}.')
TURNS['tq L v2'] = HALF.format(s='left', o='right', strap='the bag strap on his near shoulder')
TURNS['tq R v2'] = HALF.format(s='right', o='left', strap='the bag strap on his far shoulder, half hidden')


def rotate(port):
    done = os.path.join(OUT, 'rotate.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    for t, words in TURNS.items():
        key = f'scene {t}'
        if key not in res:
            if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
            res[key] = gen(port, {**FAST, 'positive': TURN.format(t=words), 'seed': PITCH_SEED,
                                  'media': [{'role': 'inputImage', 'url': src}], 'cardName': f'angles rotate {key}'})
            json.dump(res, open(done, 'w'), indent=1)
    cell, h = 300, 300 * 5 // 4 + 24
    base = Image.open(disk(src)).convert('RGB')
    cells = [(src, 'input (front)'), *[(res[f'scene {t}'], t) for t in TURNS]]
    img = Image.new('RGB', (cell * 4, h * -(-len(cells) // 4)), 'white')
    d = ImageDraw.Draw(img)
    for i, (url, label) in enumerate(cells):
        im = Image.open(disk(url)).convert('RGB')
        diff = sum(ImageStat.Stat(ImageChops.difference(im.resize(base.size), base)).mean) / 3
        im.thumbnail((cell, h - 24))
        img.paste(im, ((i % 4) * cell, (i // 4) * h + 24))
        d.text(((i % 4) * cell + 4, (i // 4) * h + 4), f'{label}  diff {diff:.0f}', fill='black')
    img.save(os.path.join(HERE, 'sheets', 'rotate_scene.jpg'), quality=90)


STRIP = ['tq L v2', 'pr L', 'tqb L', 'back', 'tqb R', 'pr R', 'tq R v2']


def rotate_seeds(port):  # the 7-view strip (v2 45s) on seeds 222/333; seed 111 is rotate()'s run
    done = os.path.join(OUT, 'rotate.json')
    res = json.load(open(done))
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    for seed in (222, 333):
        for t in STRIP:
            key = f'scene {t} s{seed}'
            if key not in res:
                if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                    sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
                res[key] = gen(port, {**FAST, 'positive': TURN.format(t=TURNS[t]), 'seed': seed,
                                      'media': [{'role': 'inputImage', 'url': src}],
                                      'cardName': f'angles rotate {key}'})
                json.dump(res, open(done, 'w'), indent=1)
    cell, h = 220, 220 * 5 // 4 + 24
    img = Image.new('RGB', (cell * 8, h * 3), 'white')
    d = ImageDraw.Draw(img)
    for r, seed in enumerate((111, 222, 333)):
        for c, t in enumerate([None, *STRIP]):
            url = src if t is None else res[f'scene {t}' + ('' if seed == 111 else f' s{seed}')]
            im = Image.open(disk(url)).convert('RGB')
            im.thumbnail((cell, h - 24))
            img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), f's{seed} {t or "input"}', fill='black')
    img.save(os.path.join(HERE, 'sheets', 'rotate_seeds.jpg'), quality=90)


# tqb L moved the bag strap to his right shoulder on 2/3 seeds: name the shoulder by side AND frame position.
TURNS['tqb L v2'] = TURNS['tqb L'][:-1] + (', and the bag strap stays on his LEFT shoulder - the shoulder nearer the '
                                           'camera, on frame-left - never on his right shoulder.')
# Turn + height in ONE prompt from the front (two-step returned copies). Fabio 2026-10-23: 3 views x 4 heights first.
TURN_H = ('Create a photograph of the man from the first image standing on the same spot, with his whole body (head, '
          'shoulders, chest and hips) turned {t} The photograph is taken from {cam}. {shows}It is the same street '
          'around him, seen from the new camera height: the red door on frame-left, the blue bicycle on frame-right '
          'and the string lights overhead. ' + SCENE_KEEP)
TH_VIEWS = ['tq L v2', 'tqb L v2', 'back']
HEIGHTS = ['xlo', 'lo', 'hi', 'xhi']


def rotate_pitch(port):
    done = os.path.join(OUT, 'rotate.json')
    res = json.load(open(done))
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    jobs = [('scene tqb L v2' + ('' if s == 111 else f' s{s}'), TURN.format(t=TURNS['tqb L v2']), s) for s in (111, 333)]
    jobs += [(f'scene {t} {p}', TURN_H.format(t=TURNS[t], cam=PITCHES['scene'][p][0], shows=PITCHES['scene'][p][1]),
              PITCH_SEED) for t in TH_VIEWS for p in HEIGHTS]
    for key, prompt, seed in jobs:
        if key not in res:
            if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
            res[key] = gen(port, {**FAST, 'positive': prompt, 'seed': seed,
                                  'media': [{'role': 'inputImage', 'url': src}], 'cardName': f'angles rotate {key}'})
            json.dump(res, open(done, 'w'), indent=1)
    rows = [[(f'scene {t}', f'{t} level')] + [(f'scene {t} {p}', f'{t} {p}') for p in HEIGHTS] for t in TH_VIEWS]
    rows.append([(f'scene tqb L s{s}' if s != 111 else 'scene tqb L', f'tqb L old s{s}') for s in (111, 333)] +
                [('scene tqb L v2' + ('' if s == 111 else f' s{s}'), f'tqb L v2 s{s}') for s in (111, 333)])
    cell, h = 300, 300 * 5 // 4 + 24
    img = Image.new('RGB', (cell * 5, h * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (k, label) in enumerate(row):
            im = Image.open(disk(res[k])).convert('RGB')
            im.thumbnail((cell, h - 24))
            img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', 'rotate_pitch.jpg'), quality=90)


# Low stops came out weak with TURN_H; suspect its street-anchor line. v2 drops it (SCENE_KEEP still names the
# street, without positions), like the pitch-only run where low brought sky + towering fronts.
TURN_LO = ('Create a photograph of the man from the first image standing on the same spot, with his whole body (head, '
           'shoulders, chest and hips) turned {t} The photograph is taken from {cam}. {shows}' + SCENE_KEEP)


def rotate_low(port):
    done = os.path.join(OUT, 'rotate.json')
    res = json.load(open(done))
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    for t in TH_VIEWS:
        for p in ('lo', 'xlo'):
            key = f'scene {t} {p} v2'
            if key not in res:
                if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                    sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
                prompt = TURN_LO.format(t=TURNS[t], cam=PITCHES['scene'][p][0], shows=PITCHES['scene'][p][1])
                res[key] = gen(port, {**FAST, 'positive': prompt, 'seed': PITCH_SEED,
                                      'media': [{'role': 'inputImage', 'url': src}], 'cardName': f'angles rotate {key}'})
                json.dump(res, open(done, 'w'), indent=1)
    pres = json.load(open(os.path.join(OUT, 'pitch.json')))
    rows = [[(res[f'scene {t} {p}{v}'], f'{t} {p}{v or " old"}') for p in ('lo', 'xlo') for v in ('', ' v2')]
            for t in TH_VIEWS]
    rows.append([(pres[f'scene front {p}'], f'ref: pitch-only front {p}') for p in ('lo', 'xlo')])
    cell, h = 300, 300 * 5 // 4 + 24
    img = Image.new('RGB', (cell * 4, h * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (url, label) in enumerate(row):
            im = Image.open(disk(url)).convert('RGB')
            im.thumbnail((cell, h - 24))
            img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', 'rotate_low.jpg'), quality=90)


# Fabio 2026-10-23: GENERIC wording (no man/he/outfit - a Flow prompt must fit anyone) and TWO passes: pass 1 turns
# the person, pass 2 moves the camera height on pass 1's picture. The old two-step (p1) repeated the yaw text in
# pass 2 and returned copies; this pass 2 names only the height and says the pose stays.
G_KEEP = 'Keep the same person, face, hair, clothes and everything they wear or carry.'
G_TURN = ('Create a photograph of the person from the first image standing on the same spot, with their whole body '
          '(head, shoulders, chest and hips) turned {t} Only the person has turned: the camera, the framing and the '
          'background stay exactly as in the first image. ' + G_KEEP)
G_TURNS = {
    'tq L': ('45 degrees, halfway between facing the camera and standing side-on facing frame-left: their chest and '
             'hips are angled toward frame-left, their left shoulder and arm are nearer the camera, their right '
             'shoulder and arm are partly hidden behind their body. Their head turns with their body: the face shows '
             'its left cheek, both eyes and the nose pointing toward frame-left, looking toward frame-left past the '
             'camera, not toward frame-right.'),
    'tqb L': ('135 degrees, a lost-profile view: they face away from the camera, angled toward frame-left and into the '
              'picture; the back of their head, their left ear and only the edge of their left cheek show, their eyes '
              'and nose hidden, and their back is seen at an angle.'),
    'back': ('180 degrees, so their back is to the camera and they face straight into the picture: the back of their '
             'head and their back fill the middle, and their face is completely hidden.'),
}
G_HEIGHT = ('Create a photograph of the same moment as the first image, taken from {cam}. {shows} The person keeps '
            'exactly the same pose and faces the same way; only the camera has moved. ' + G_KEEP +
            ' Same place, same light.')
G_HEIGHTS = {  # view-neutral: nothing here assumes which way the person faces
    'xlo': ('the ground: the camera lies on the floor at their feet, pointing steeply up at them',
            'Seen from the floor, their feet and legs are nearest the camera and large at the bottom of the picture, '
            'their body towers upward and narrows toward their head at the top, and the surroundings lean in against '
            'open sky or ceiling above them.'),
    'lo': ('a low camera at the height of their knees, pointing upward at them',
           'Seen from below, their legs are nearer the camera than their head, they look tall, and more of what is '
           'above them shows.'),
    'hi': ('a high camera above their head, pointing down at them',
           'Seen from above, the top of their head and their shoulders are nearest the camera, their body is '
           'foreshortened below them, and the ground around them fills the background.'),
    'xhi': ('a bird\'s-eye view: the camera is high directly above them, pointing almost straight down',
            'Seen from far above, the top of their head and their shoulders are in the middle of the picture, their '
            'body is strongly foreshortened beneath them, and the ground surrounds them on every side.'),
}


def two_pass(port):
    done = os.path.join(OUT, 'twopass.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']

    def step(key, prompt, url):
        if key not in res:
            if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
            res[key] = gen(port, {**FAST, 'positive': prompt, 'seed': PITCH_SEED,
                                  'media': [{'role': 'inputImage', 'url': url}], 'cardName': f'angles 2pass {key}'})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for t, words in G_TURNS.items():
        turned = step(t, G_TURN.format(t=words), src)
        for p, (cam, shows) in G_HEIGHTS.items():
            step(f'{t} {p}', G_HEIGHT.format(cam=cam, shows=shows), turned)
    cell, h = 300, 300 * 5 // 4 + 24
    img = Image.new('RGB', (cell * 5, h * len(G_TURNS)), 'white')
    d = ImageDraw.Draw(img)
    for r, t in enumerate(G_TURNS):
        base = Image.open(disk(res[t])).convert('RGB')
        for c, k in enumerate([t, *[f'{t} {p}' for p in G_HEIGHTS]]):
            im = Image.open(disk(res[k])).convert('RGB')
            diff = sum(ImageStat.Stat(ImageChops.difference(im.resize(base.size), base)).mean) / 3
            im.thumbnail((cell, h - 24))
            img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), (f'pass1 {k}' if k == t else f'pass2 {k}  diff {diff:.0f}'),
                   fill='black')
    img.save(os.path.join(HERE, 'sheets', 'two_pass.jpg'), quality=90)


# Fabio 2026-10-23: SHORT + generic, the FLUX.3 guide's edit voice (whole-picture change opens "Shift the camera
# viewpoint to ..."; describe the change only; one keep clause). No "photograph" (anime must stay anime), no
# subject or scene details. Same two passes.
S_KEEP = ' Keep the subject, their pose and the direction they face, the place, the light and the image style unchanged.'
S_TURN = {
    'tq L': ('Turn the subject 45 degrees so they face partly toward frame-left, halfway between facing the camera and '
             'side-on, their head turned with their body. The camera and the background do not move. Keep the subject, '
             'the place, the light and the image style unchanged.'),
    'tqb L': ('Turn the subject 135 degrees so they face away from the camera toward frame-left: the back of their head '
              'and only the edge of their cheek show. The camera and the background do not move. Keep the subject, the '
              'place, the light and the image style unchanged.'),
    'back': ('Turn the subject around so their back faces the camera and their face is hidden. The camera and the '
             'background do not move. Keep the subject, the place, the light and the image style unchanged.'),
}
S_HEIGHT = {
    'xlo': 'Shift the camera viewpoint to a worm\'s-eye view: the camera is on the ground at the subject\'s feet, '
           'pointing steeply up at them from below.' + S_KEEP,
    'lo': 'Shift the camera viewpoint to a low angle: the camera is below the subject at knee height, pointing up at '
          'them.' + S_KEEP,
    'hi': 'Shift the camera viewpoint to a high angle: the camera is above the subject\'s head, pointing down at '
          'them.' + S_KEEP,
    'xhi': 'Shift the camera viewpoint to a bird\'s-eye view: the camera is high directly above the subject, pointing '
           'straight down at them.' + S_KEEP,
}


def short_pass(port):
    done = os.path.join(OUT, 'shortpass.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']

    def step(key, prompt, url):
        if key not in res:
            if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
            res[key] = gen(port, {**FAST, 'positive': prompt, 'seed': PITCH_SEED,
                                  'media': [{'role': 'inputImage', 'url': url}], 'cardName': f'angles short {key}'})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for t, prompt in S_TURN.items():
        turned = step(t, prompt, src)
        for p, hp in S_HEIGHT.items():
            step(f'{t} {p}', hp, turned)
    cell, h = 300, 300 * 5 // 4 + 24
    img = Image.new('RGB', (cell * 5, h * len(S_TURN)), 'white')
    d = ImageDraw.Draw(img)
    for r, t in enumerate(S_TURN):
        base = Image.open(disk(res[t])).convert('RGB')
        for c, k in enumerate([t, *[f'{t} {p}' for p in S_HEIGHT]]):
            im = Image.open(disk(res[k])).convert('RGB')
            diff = sum(ImageStat.Stat(ImageChops.difference(im.resize(base.size), base)).mean) / 3
            im.thumbnail((cell, h - 24))
            img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), (f'pass1 {k}' if k == t else f'pass2 {k}  diff {diff:.0f}'),
                   fill='black')
    img.save(os.path.join(HERE, 'sheets', 'short_pass.jpg'), quality=90)


# Fabio 2026-10-23: a MANNEQUIN REFERENCE carries the camera. Picture 2 = a grey mannequin on a dark backdrop at the
# exact view (angle, height, zoom); the prompt asks for picture 1 seen the same way, naming the view in words too
# (front vs back is hard to read on a mannequin). Refs are square masters (crop to any ratio later) and are kept in
# research/mannequin/ for the gizmo. t2i follows camera words far better than an edit does.
MQ_BODY = ('Studio photograph of a full-size grey wooden artist\'s mannequin with jointed limbs and a smooth oval head '
           'with a softly sculpted nose and brow ridge, so its face side is clear, standing upright with its arms '
           'relaxed at its sides, against a plain dark charcoal-grey seamless studio backdrop and floor, soft even '
           'light, no props. ')
MQ_VIEWS = {  # key: (t2i camera words, the view named in the edit prompt)
    'tqb L': ('Three-quarter rear view from behind its left shoulder, camera at chest height: it faces away from the '
              'camera, angled toward frame-left; the back of its head and only the edge of its nose and brow show, '
              'its back seen at an angle. Its whole body is in frame.',
              'a three-quarter rear view from behind their left shoulder at chest height, facing away toward frame-left'),
    'back xlo': ('Back view from a worm\'s-eye camera on the floor just behind its heels, pointing steeply up: its heels '
                 'and calves are large at the bottom, its back towers upward and narrows to the back of its head, '
                 'small near the top, with dark backdrop above.',
                 'a back view from a camera on the ground behind their heels, pointing steeply up at them'),
    'tq L hi': ('Three-quarter front view from a high camera above its head, 45 degrees to its left, pointing down: it '
                'faces partly toward frame-left; the top of its head and its shoulders are large and near the camera, '
                'its legs look short and its feet small on the floor below.',
                'a three-quarter front view from a high camera above their head, facing partly toward frame-left'),
    'xhi': ('Bird\'s-eye view from a camera high directly above it, pointing straight down: the top of its head and '
            'its shoulders are in the middle of the picture, its body strongly foreshortened beneath, its feet barely '
            'peeking out, and the grey floor surrounds it on every side.',
            'a bird\'s-eye view from a camera high directly above them, pointing straight down'),
    'close': ('Head-and-shoulders close-up from the front at eye level: its face, with the sculpted nose and brow, '
              'looks straight at the camera and fills the upper half of the frame, its shoulders cut by the bottom edge.',
              'a head-and-shoulders close-up from the front at eye level'),
}
MQ_EDIT = ('Shift the camera viewpoint of the first image to match the second image: put the camera at the same angle, '
           'height and distance from the subject as the camera that took the mannequin in the second image, so the '
           'subject from the first image is framed and turned exactly like the mannequin, in {v}. The place around them '
           'is seen from that new camera position. Take only the camera from the second image, never the mannequin, '
           'its pose or its grey backdrop. Keep the subject\'s identity, clothes, the place, the light and the image '
           'style of the first image unchanged.')


# Round 2 (Fabio): full-body LOW + HIGH first, FLAT shadowless light (shadows could relight the user's picture), a
# SEXLESS mannequin (the close-up grew a chest). Guide order: medium, camera, light, subject, layout, background -
# round 1 put the camera words last and the model kept eye level. 3 seeds each; MQ_PICK names the seed per view.
MQ2_HEAD = 'Studio photograph. '
MQ2_LIGHT = ('Flat, even, shadowless lighting from every side, like a softbox tent: no cast shadows on the floor, no '
             'dark shading on the body, low contrast. ')
MQ2_SUBJ = ('The subject is a full-size plain grey wooden artist\'s mannequin with jointed limbs, a sexless, '
            'featureless body with a flat chest and a simple blocky torso, and a smooth oval head with only a softly '
            'sculpted nose and brow ridge, standing upright with its arms relaxed at its sides. ')
MQ2_BACK = 'It stands on a plain charcoal-grey seamless studio floor that curves up into a matching backdrop, no props.'
MQ2_VIEWS = {  # key: (camera sentence, layout sentence, the view named in the edit prompt)
    'front lo': ('Extreme low-angle worm\'s-eye shot: the camera sits on the floor a step in front of its feet and '
                 'points steeply up at it, with strong upward perspective. ',
                 'It faces the camera. Its feet are large in the lower foreground, its legs climb up the frame and '
                 'narrow, and its head is small near the top edge, its chin and the underside of its jaw showing. ',
                 'a front view from a camera on the ground in front of their feet, pointing steeply up at them'),
    'back lo': ('Extreme low-angle worm\'s-eye shot from behind: the camera sits on the floor a step behind its heels '
                'and points steeply up at it, with strong upward perspective. ',
                'It faces away from the camera. Its heels and calves are large in the lower foreground, its back '
                'climbs up the frame and narrows, and the back of its head is small near the top edge. ',
                'a back view from a camera on the ground behind their heels, pointing steeply up at them'),
    'front hi': ('High-angle shot: the camera is high above it and in front, looking steeply down at it, with strong '
                 'downward perspective. ',
                 'It faces the camera. The top of its head and its shoulders are large near the top of the frame, its '
                 'body narrows downward, and its feet are small on the floor near the bottom edge. ',
                 'a front view from a high camera above and in front of them, looking steeply down'),
    'top': ('Bird\'s-eye shot: the camera is directly above its head and points straight down at the floor. ',
            'The crown of its head and its two shoulders are in the middle of the frame, its body hidden beneath them '
            'except the tips of its feet, and the grey floor fills the frame on every side around it. ',
            'a bird\'s-eye view from a camera directly above them, pointing straight down'),
    # 'top' read as front hi (face looks up at the camera): describe the plan view by what is in frame instead
    'top2': ('Top-down overhead plan view, shot straight down from the ceiling. ',
             'Seen from directly above, it appears as the round, smooth crown of its head in the centre of the frame, '
             'with its two shoulders and the tops of its arms on either side, and only the tips of its feet peeking '
             'out beyond its shoulders; its face is hidden below the crown. ',
             'a bird\'s-eye view from a camera directly above them, pointing straight down'),
}
MQ_SEEDS = (111, 222, 333)
MQ_PICK = {'front lo': 333, 'back lo': 333, 'front hi': 111, 'top2': 333}  # view -> seed, Claude's eye check
# MQ_EDIT round 2: zoom carried, front hi mildly high, front lo stayed eye level, back lo PASTED the mannequin into
# the street. Variant B reads picture 2 as the stand-in to replace: subject where the mannequin is, same camera.
MQ_EDIT_B = ('Replace the grey mannequin in the second image with the subject from the first image, standing exactly '
             'where the mannequin stands, at the same size, turned the same way and seen from the same camera '
             'angle, height and distance: {v}. Remove the mannequin completely. Replace the grey studio backdrop and '
             'floor with the place from the first image, seen from that same camera. Keep the subject\'s identity, '
             'clothes, the place, the light and the image style of the first image unchanged.')


# Round 3 (Fabio chose Blender): refs = Fabio's UE4 mannequin rendered by research/blender (ref_cmds.txt + ref_post.py),
# exact camera per stop, A-pose. Wording C = B plus the pose clause: B copied the mannequin's stiff pose in round 2.
BLENDER_REFS = os.path.join(HERE, 'blender', 'out')
MQ_BL_VIEWS = {'front lo': 'front_lo', 'back lo': 'back_lo', 'front hi': 'front_hi', 'top2': 'top2'}
MQ_EDIT_C = MQ_EDIT_B.replace('Keep the subject\'s', 'The subject keeps their own pose from the first image, their arms, '
                              'legs and stance unchanged; take only the camera and the way they face from the second '
                              'image, never the mannequin\'s pose. Keep the subject\'s')
# Round 4 (Fabio 2026-10-23): refs re-posed natural (arms down, legs closer); B/C copied the A-pose, and "replace
# the mannequin ... standing exactly where ... turned the same way" invites that. Picture 2 = CAMERA ONLY, and the
# word "mannequin" is never said. D leads with the reference, E leads with the camera move.
MQ_EDIT_D = ('Show the scene from the first image from a new camera position. The second image is only a camera '
             'reference: it shows where the camera stands, how high it is, which way it points and how far it is from '
             'the figure. Move the camera to that same position around the subject: {v}. Only the camera moves; the '
             'subject keeps their own pose, arms, legs and stance from the first image. Keep the subject\'s identity, '
             'clothes, the place, the light and the image style of the first image unchanged.')
MQ_EDIT_E = ('Move the camera to {v}, and show the first image from there. Match the camera position, height, angle '
             'and distance of the second image, which is a camera reference only; take nothing else from it. The '
             'subject keeps their own pose and stance from the first image. Keep the subject\'s identity, clothes, the '
             'place, the light and the image style of the first image unchanged.')
MQ_ROUNDS = {  # round -> (results file, sheet, card prefix, wordings)
    '3': ('mq_blender', 'mq3', (('edit', MQ_EDIT), ('editB', MQ_EDIT_B), ('editC', MQ_EDIT_C))),
    '4': ('mq_blender4', 'mq4', (('editD', MQ_EDIT_D), ('editE', MQ_EDIT_E))),
}


def import_ref(port, render, card):
    req = urllib.request.Request(f'http://127.0.0.1:{port}/connector/import-media', headers={'Content-Type': 'application/json'},
                                 data=json.dumps({'sourcePath': os.path.join(BLENDER_REFS, render + '.png'), 'folderPath': PROJECT,
                                                  'cardName': card}).encode())
    r = json.load(urllib.request.urlopen(req, timeout=120))
    if not r.get('ok'):
        sys.exit(f'import {render}: {r}')
    return r['output']['filePath']  # already a /project-file?path= url


# Round 5 (Fabio 2026-10-24): BFL's FLUX.3 edit voice (docs/models/flux3 + MPI-1181 bfl_pup_system_prompts.json i2i:
# a viewpoint change opens "Shift the ... viewpoint", then WHERE THINGS NOW SIT in the frame, then one keep clause).
# "view", never "camera" (round 4's "a camera on the ground" drew a camera prop). TURN FIRST, THEN HEIGHT: the back
# view is also run as two edits - turn at eye level (back_eye ref), then lower the view on the turned picture.
MQ5_KEEP = (' Take only the viewing angle from the mannequin reference, nothing else from it. Keep the subject\'s '
            'identity, clothes, pose, the place, the light and the image style of the first image unchanged.')
MQ5 = {  # key: (ref render, instruction); every one ends on MQ5_KEEP
    'front lo': ('front_lo', 'Shift the viewpoint of the first image down to match the mannequin reference in the '
                 'second image: a worm\'s-eye view from just above the ground in front of the subject, looking '
                 'steeply up at them. Their feet and legs are now large at the bottom of the frame, their body rises '
                 'and narrows toward the top, their chin and the underside of their jaw show, their head is small near '
                 'the top edge, and the surroundings lean inward with the sky or ceiling above them.'),
    'back lo': ('back_lo', 'Shift the viewpoint of the first image around and down to match the mannequin reference '
                'in the second image: a worm\'s-eye view from just above the ground behind the subject, looking '
                'steeply up at their back. They face away; their heels and calves are now large at the bottom of the '
                'frame, their back rises and narrows toward the top, the back of their head is small near the top '
                'edge, and the surroundings lean inward with the sky or ceiling above them.'),
    'front hi': ('front_hi', 'Shift the viewpoint of the first image up to match the mannequin reference in the '
                 'second image: a high view from above and in front of the subject, looking steeply down at them. The '
                 'top of their head and their shoulders are now large near the top of the frame, their body narrows '
                 'downward, their feet are small on the ground near the bottom edge, and the ground fills the '
                 'background behind them.'),
    'top2': ('top2', 'Shift the viewpoint of the first image up to match the mannequin reference in the second image: '
             'a view from directly above the subject, looking straight down. The crown of their head and their two '
             'shoulders are in the middle of the frame, their face is hidden below the crown, only the tips of their '
             'feet show, and the ground surrounds them on every side.'),
    'back eye': ('back_eye', 'Shift the viewpoint of the first image around the subject to match the mannequin '
                 'reference in the second image: a view from directly behind them at the same height and distance. '
                 'They now face away; the back of their head, their back and the backs of their legs are in the '
                 'middle of the frame, and the place around them is seen from the opposite side.'),
}
MQ5_LOWER_BACK = ('Shift the viewpoint of the first image down to match the mannequin reference in the second image: a '
                  'worm\'s-eye view from just above the ground behind the subject, looking steeply up at their back. '
                  'Their heels and calves are now large at the bottom of the frame, their back rises and narrows toward '
                  'the top, the back of their head is small near the top edge, and the surroundings lean inward with '
                  'the sky or ceiling above them.')
MQ5_SEEDS = (111, 222)


def blender5(port):
    done = os.path.join(OUT, 'mq_blender5.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')

    def step(key, text, first, ref, seed):
        if key not in res:
            res[key] = gen(port, {**FAST, 'seed': seed, 'positive': text + MQ5_KEEP, 'cardName': f'angles mq5 {key}',
                                  'media': [{'role': 'inputImage', 'url': first}, {'role': 'inputImage2', 'url': ref}]})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for v, (render, _) in MQ5.items():
        if f'ref {v}' not in res:
            res[f'ref {v}'] = import_ref(port, render, f'angles mq5 ref {v}')
            json.dump(res, open(done, 'w'), indent=1)
    for seed in MQ5_SEEDS:
        for v, (_, text) in MQ5.items():  # one edit straight from the front picture
            step(f'{seed} {v}', text, src, res[f'ref {v}'], seed)
        # two edits: the turned picture (back eye) is only lowered - no "around", it already shows their back
        step(f'{seed} back eye>lo', MQ5_LOWER_BACK, res[f'{seed} back eye'], res['ref back lo'], seed)
    cols = ('front lo', 'back lo', 'front hi', 'top2', 'back eye', 'back eye>lo')
    cell, h = 300, 324
    rows = [[('src', 'source')] + [(f'ref {c}', f'ref {c}') for c in cols[:5]] + [('ref back lo', 'ref (step 2) back lo')]]
    rows += [[(None, f'seed {s}')] + [(f'{s} {c}', c + (' (2 steps)' if '>' in c else ' (1 step)' if c == 'back lo' else ''))
                                      for c in cols] for s in MQ5_SEEDS]
    img = Image.new('RGB', (cell * 7, h * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (k, label) in enumerate(row):
            url = src if k == 'src' else res.get(k) if k else None
            if url:
                im = Image.open(disk(url)).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', 'mq_blender5.jpg'), quality=90)


# Round 6 (Fabio 2026-10-24): stop the grey body leaking into low views + HEIGHT FIRST, THEN TURN on the back view
# (round 5: turn first, then the height edit returned a copy). Keep clause says positively that the subject stays the
# real person (no "do not show"). Ref sets: 'grey' = the round-5 renders, 'line' = `ref_render.py -- outline` (flat
# light, the body the wall's tone, only outline + ridges). 4 seeds.
MQ6_KEEP = (' Take only the viewing angle from the mannequin reference. The subject is still the real person from the '
            'first image, with their own head and hair, hands, clothes and shoes; keep their identity, pose, the '
            'place, the light and the image style of the first image unchanged.')
MQ6_TURN_LOW = ('Shift the viewpoint of the first image around the subject to match the mannequin reference in the '
                'second image: the same worm\'s-eye view from just above the ground, now from behind them, looking '
                'steeply up at their back. They face away; their heels and calves are large at the bottom of the frame, '
                'their back rises and narrows toward the top, the back of their head is small near the top edge, and '
                'the surroundings lean inward with the sky or ceiling above them.')
MQ6_VIEWS = ('front lo', 'back lo', 'top2')
MQ6_SEEDS = (111, 222, 333, 444)


def blender6(port):
    done = os.path.join(OUT, 'mq_blender6.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')

    def step(key, text, first, ref, seed):
        if key not in res:
            res[key] = gen(port, {**FAST, 'seed': seed, 'positive': text + MQ6_KEEP, 'cardName': f'angles mq6 {key}',
                                  'media': [{'role': 'inputImage', 'url': first}, {'role': 'inputImage2', 'url': ref}]})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for refs, folder in (('grey', ''), ('line', 'outline/')):
        for v in MQ6_VIEWS:
            if f'ref {refs} {v}' not in res:
                res[f'ref {refs} {v}'] = import_ref(port, folder + MQ5[v][0], f'angles mq6 ref {refs} {v}')
                json.dump(res, open(done, 'w'), indent=1)
    for seed in MQ6_SEEDS:
        for refs in ('grey', 'line'):
            for v in MQ6_VIEWS:
                step(f'{seed} {refs} {v}', MQ5[v][1], src, res[f'ref {refs} {v}'], seed)
        # height first (the grey front-lo edit above), then turn behind at that same low height
        step(f'{seed} lo>back', MQ6_TURN_LOW, res[f'{seed} grey front lo'], res['ref grey back lo'], seed)
    cols = [('grey', v) for v in MQ6_VIEWS] + [('line', v) for v in MQ6_VIEWS]
    cell, h = 300, 324
    rows = [[('src', 'source')] + [(f'ref {r} {v}', f'ref {r} {v}') for r, v in cols] + [('ref grey back lo', 'ref (step 2) back lo')]]
    rows += [[(None, f'seed {s}')] + [(f'{s} {r} {v}', f'{r} {v}') for r, v in cols] + [(f'{s} lo>back', 'front lo > back (2 steps)')]
             for s in MQ6_SEEDS]
    img = Image.new('RGB', (cell * 8, h * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (k, label) in enumerate(row):
            url = src if k == 'src' else res.get(k) if k else None
            if url:
                im = Image.open(disk(url)).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', 'mq_blender6.jpg'), quality=90)


# Round 7 (Fabio 2026-10-24): the round-6 recipe (BFL voice + end state + real-person keep, one edit, exact ref) on
# the remaining views (front hi, back eye, four 3/4) and on new sources: the woman full body, her face close-up
# (head-and-shoulders refs `face_*`), the floating speaker (object wording + object keep). Frame directions are read
# off the renders: from their left the mannequin faces frame-left, from behind-left it faces away toward frame-left.
def _tq(side, near, facing):
    return ('Shift the viewpoint of the first image around the subject to match the mannequin reference in the second '
            f'image: a three-quarter view from in front of them and 45 degrees to their {side}, at the same height and '
            f'distance. Their whole body is now turned at an angle, facing {facing}, their {near} shoulder and side '
            'nearer the view and their face seen in three-quarter; the place around them is seen from that angle.')


def _tqb(side, facing):
    return ('Shift the viewpoint of the first image around the subject to match the mannequin reference in the second '
            f'image: a three-quarter rear view from behind them and 45 degrees to their {side}. They face away at an '
            f'angle toward {facing}, their back and {side} shoulder nearer the view, the back of their head and only '
            'the edge of their cheek showing; the place around them is seen from that angle.')


MQ7_BODY = {**{v: MQ5[v] for v in ('front lo', 'back lo', 'top2', 'front hi', 'back eye')},
            'tq fl': ('tq_fl', _tq('left', 'left', 'frame-left')), 'tq fr': ('tq_fr', _tq('right', 'right', 'frame-right')),
            'tqb l': ('tq_bl', _tqb('left', 'frame-left')), 'tqb r': ('tq_br', _tqb('right', 'frame-right'))}
MQ7_FACE = {
    'front lo': ('face_front_lo', 'Shift the viewpoint of the first image down to match the mannequin reference in the '
                 'second image: a low view from below the subject\'s chin, looking up at their face. The underside of '
                 'their chin and jaw now shows, their face rises above it and narrows toward the top of their head, '
                 'their head stays upright, and the background behind them is seen from below.'),
    'front hi': ('face_front_hi', 'Shift the viewpoint of the first image up to match the mannequin reference in the '
                 'second image: a high view from above and in front of the subject, looking down at their face. The top '
                 'of their head and their forehead are now large near the top of the frame, their face narrows toward '
                 'the chin, and their shoulders fall away below.'),
    'back': ('face_back', 'Shift the viewpoint of the first image around the subject to match the mannequin reference in '
             'the second image: a view from directly behind their head at the same height and distance. The back of '
             'their head and their hair fill the middle of the frame with their shoulders below, and the background is '
             'seen from the opposite side.'),
    'tq fl': ('face_tq_fl', 'Shift the viewpoint of the first image around the subject to match the mannequin reference '
              'in the second image: a three-quarter view from in front of them and 45 degrees to their left, at the same '
              'height and distance. Their head and shoulders are turned at an angle, their face seen in three-quarter '
              'facing frame-left, their left cheek and ear nearer the view.'),
    'tqb r': ('face_tq_br', 'Shift the viewpoint of the first image around the subject to match the mannequin reference '
              'in the second image: a three-quarter rear view from behind them and 45 degrees to their right. They face '
              'away at an angle toward frame-right, the back of their head and their right shoulder nearer the view, '
              'only the edge of their cheek showing.'),
}
MQ7_OBJ = {
    'front lo': ('front_lo', 'Shift the viewpoint of the first image down to match the mannequin reference in the second '
                 'image: a low view from below the object, looking steeply up at it. Its underside now shows, its front '
                 'face leans away above it, and the backdrop is seen from below.'),
    'front hi': ('front_hi', 'Shift the viewpoint of the first image up to match the mannequin reference in the second '
                 'image: a high view from above and in front of the object, looking steeply down at it. Its top face '
                 'now shows large, its front face foreshortened below it, and the backdrop fills the space behind it.'),
    'top2': ('top2', 'Shift the viewpoint of the first image up to match the mannequin reference in the second image: a '
             'view from directly above the object, looking straight down. Its top face fills the middle of the frame, '
             'its front and sides hidden, and the backdrop surrounds it on every side.'),
    'back eye': ('back_eye', 'Shift the viewpoint of the first image around the object to match the mannequin reference '
                 'in the second image: a view from directly behind it at the same height and distance. Its back face '
                 'now faces the view, its front hidden, and the backdrop is seen from the opposite side.'),
    'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the object to match the mannequin reference in the '
              'second image: a three-quarter view from in front of it and 45 degrees around to one side, at the same '
              'height and distance. Its front face and one end both show at an angle, the nearer end larger.'),
}
MQ7_FACE_KEEP = (' Take only the viewing angle from the mannequin reference. The subject is still the real person from '
                 'the first image, with their own face, hair and clothes; keep their identity, expression, the framing '
                 'distance, the background, the light and the image style of the first image unchanged.')
MQ7_OBJ_KEEP = (' Take only the viewing angle from the mannequin reference. The object stays exactly the object from the '
                'first image, with its own shape, colours, materials and details; keep the background, the light and '
                'the image style of the first image unchanged.')
MQ7_RUNS = {  # source -> (pitch.json key, views, keep, views to run)
    'man': ('scene input', MQ7_BODY, MQ6_KEEP, ('front hi', 'back eye', 'tq fl', 'tq fr', 'tqb l', 'tqb r')),
    'woman': ('body input', MQ7_BODY, MQ6_KEEP, tuple(MQ7_BODY)),
    'face': ('face input', MQ7_FACE, MQ7_FACE_KEEP, tuple(MQ7_FACE)),
    'object': ('object input', MQ7_OBJ, MQ7_OBJ_KEEP, tuple(MQ7_OBJ)),
}
MQ7_SEEDS = (111, 222)


def blender7(port):
    done = os.path.join(OUT, 'mq_blender7.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    pres = json.load(open(os.path.join(OUT, 'pitch.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for name, (srckey, views, keep, run) in MQ7_RUNS.items():
        for v in run:
            render = views[v][0]
            if f'ref {render}' not in res:
                res[f'ref {render}'] = import_ref(port, render, f'angles mq7 ref {render}')
                json.dump(res, open(done, 'w'), indent=1)
        for seed in MQ7_SEEDS:
            for v in run:
                key = f'{name} {seed} {v}'
                if key not in res:
                    res[key] = gen(port, {**FAST, 'seed': seed, 'positive': views[v][1] + keep, 'cardName': f'angles mq7 {key}',
                                          'media': [{'role': 'inputImage', 'url': pres[srckey]},
                                                    {'role': 'inputImage2', 'url': res[f'ref {views[v][0]}']}]})
                    json.dump(res, open(done, 'w'), indent=1)
        cell, h = 300, 324
        rows = [[(pres[srckey], 'source')] + [(res[f'ref {views[v][0]}'], f'ref {v}') for v in run]]
        rows += [[(None, f'seed {s}')] + [(res[f'{name} {s} {v}'], v) for v in run] for s in MQ7_SEEDS]
        img = Image.new('RGB', (cell * (len(run) + 1), h * len(rows)), 'white')
        d = ImageDraw.Draw(img)
        for r, row in enumerate(rows):
            for c, (url, label) in enumerate(row):
                if url:
                    im = Image.open(disk(url)).convert('RGB')
                    im.thumbnail((cell, h - 24))
                    img.paste(im, (c * cell, r * h + 24))
                d.text((c * cell + 4, r * h + 4), label, fill='black')
        img.save(os.path.join(HERE, 'sheets', f'mq_blender7_{name}.jpg'), quality=90)


# Round 8 (Fabio 2026-10-24, after round 7): BASE FLUX.3 (Turbo off: 50 steps, cfg 3.5) so a NEGATIVE prompt is live,
# aimed at what leaked in round 7 - the mannequin's grey body and pose. Reruns only the weak cells. Objects get a
# second ref set: the stand-in box (blender/obj_build.py -> out/object/: yellow, white front panel + black disc, plain
# yellow back, dark tab on its frame-right end), whose keep names which face is the front. The sheet's last object row is
# the prompt-only pitch run of 2026-10-23 (Turbo, no ref) for the heights.
BASE = {**FAST, 'turbo': False}
MQ8_NEG = ('grey mannequin, grey plastic figure, faceless smooth head, jointed doll body, A-pose, arms held away from '
           'the body, a second figure')
MQ8_OBJ_NEG = ('grey mannequin, human figure, person, body parts, grey box, plain grey block, white panel with a '
               'black disc, yellow box, plain yellow block, a second object')
MQ8_BOX_KEEP = (' Take only the viewing angle from the yellow stand-in box in the second image: its white panel with '
                'the black disc is the front of the object, its plain yellow face is the back. The object stays exactly '
                'the object from the first image, with its own shape, colours, materials and details; keep the '
                'background, the light and the image style of the first image unchanged.')
MQ8_OBJ = {**{v: (r, t.replace('the mannequin reference in the second image', 'the reference in the second image'))
              for v, (r, t) in MQ7_OBJ.items()},
           'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the object to match the reference in the '
                     'second image: a three-quarter view from in front of it and 45 degrees around toward its '
                     'frame-right end, at the same height and distance. Its front face now shows at an angle with its '
                     'frame-right end nearer the view and larger, and its far end hidden.')}
MQ8_RUNS = {  # cell -> (pitch.json source key, views, ref folder, keep, negative, views to run)
    'man': ('scene input', MQ7_BODY, '', MQ6_KEEP, MQ8_NEG, ('front lo', 'back lo', 'top2')),
    'woman': ('body input', MQ7_BODY, '', MQ6_KEEP, MQ8_NEG, ('front lo', 'back lo')),
    'face': ('face input', MQ7_FACE, '', MQ7_FACE_KEEP, MQ8_NEG, ('front lo', 'front hi')),
    'object': ('object input', MQ7_OBJ, '', MQ7_OBJ_KEEP, MQ8_OBJ_NEG, tuple(MQ7_OBJ)),
    'box': ('object input', MQ8_OBJ, 'object/', MQ8_BOX_KEEP, MQ8_OBJ_NEG, tuple(MQ8_OBJ)),
}
MQ8_PROMPT_ONLY = ('object front xlo', 'object front lo', 'object front hi', 'object front xhi')


def blender8(port):
    done = os.path.join(OUT, 'mq_blender8.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    pres = json.load(open(os.path.join(OUT, 'pitch.json')))
    r7 = json.load(open(os.path.join(OUT, 'mq_blender7.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for name, (srckey, views, folder, keep, neg, run) in MQ8_RUNS.items():
        for v in run:
            render = folder + views[v][0]
            if f'ref {render}' not in res:
                res[f'ref {render}'] = import_ref(port, render, f'angles mq8 ref {render}')
                json.dump(res, open(done, 'w'), indent=1)
        for seed in MQ7_SEEDS:
            for v in run:
                key = f'{name} {seed} {v}'
                if key not in res:
                    res[key] = gen(port, {**BASE, 'seed': seed, 'positive': views[v][1] + keep, 'negative': neg,
                                          'cardName': f'angles mq8 {key}',
                                          'media': [{'role': 'inputImage', 'url': pres[srckey]},
                                                    {'role': 'inputImage2', 'url': res[f'ref {folder}{views[v][0]}']}]})
                    json.dump(res, open(done, 'w'), indent=1)
    for name, (srckey, views, folder, _, _, run) in MQ8_RUNS.items():
        r7name = 'object' if name == 'box' else name
        rows = [[(pres[srckey], 'source')] + [(res[f'ref {folder}{views[v][0]}'], f'ref {v}') for v in run]]
        rows += [[(None, f'seed {s} base+neg')] + [(res[f'{name} {s} {v}'], v) for v in run] for s in MQ7_SEEDS]
        rows += [[(None, f'seed {s} r7 turbo')] + [(r7.get(f'{r7name} {s} {v}'), v) for v in run] for s in MQ7_SEEDS]
        if name == 'box':
            rows.append([(None, 'prompt only 10-23')] + [(pres[k], k[13:]) for k in MQ8_PROMPT_ONLY])
        cols = max(len(row) for row in rows)
        cell, h = 300, 324
        img = Image.new('RGB', (cell * cols, h * len(rows)), 'white')
        d = ImageDraw.Draw(img)
        for r, row in enumerate(rows):
            for c, (url, label) in enumerate(row):
                if url:
                    im = Image.open(disk(url)).convert('RGB')
                    im.thumbnail((cell, h - 24))
                    img.paste(im, (c * cell, r * h + 24))
                d.text((c * cell + 4, r * h + 4), label, fill='black')
        img.save(os.path.join(HERE, 'sheets', f'mq_blender8_{name}.jpg'), quality=90)


def _sheet(rows, name, cell=300, h=324):  # rows of (url | None, label)
    img = Image.new('RGB', (cell * max(len(r) for r in rows), h * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (url, label) in enumerate(row):
            if url:
                im = Image.open(disk(url)).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
            d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', f'{name}.jpg'), quality=90)


# Round 9 (Fabio 2026-10-24, overnight): the speaker is too close to the box stand-in to be a fair test - a PERFUME
# BOTTLE (an upright, nearly symmetric object whose only front cue is its label) with a matching bottle stand-in
# (obj_build.py -- bottle -> out/bottle/), and the speaker again with the box. TURBO (round 8: base + negative lost to
# Turbo on people and still pasted the stand-in on objects). Three arms per view: 'ref' = the yellow stand-in, 'line' =
# its outline render (`ref_render.py -- outline`: less surface to paste; panel + disc still mark the front),
# 'prompt' = no ref at all - does a ref earn its place on objects?
BOTTLE_SOURCE = (
    'Full-color plain product photograph of a perfume bottle floating upright in mid-air in the center of the frame, '
    'seen straight from the front at its own height, against a plain light-grey seamless backdrop with soft even '
    'studio light. The bottle is a flat rectangular flask of opaque frosted pale-pink glass with rounded edges, a '
    'short neck and a faceted gold cap. Its front carries a cream paper label with a black monogram and a thin gold '
    'border; its back is plain frosted glass with only a small white sticker near the bottom; its two narrow sides '
    'are plain. No props, no text, no reflections.')
MQ9_VIEWS = {  # key: (stand-in render, end state); '{ref}' becomes ' to match the reference in the second image' or ''
    'front lo': ('front_lo', 'Shift the viewpoint of the first image down{ref}: a low view from below the object, '
                 'looking steeply up at it. Its underside now shows, its front face leans away above it, its top is '
                 'small near the top of the frame, and the backdrop is seen from below.'),
    'front hi': ('front_hi', 'Shift the viewpoint of the first image up{ref}: a high view from above and in front of '
                 'the object, looking steeply down at it. Its top now shows large near the top of the frame, its front '
                 'face is foreshortened below it, and the backdrop fills the space behind it.'),
    'top2': ('top2', 'Shift the viewpoint of the first image up{ref}: a view from directly above the object, looking '
             'straight down. Its top fills the middle of the frame, its front and sides are hidden below it, and the '
             'backdrop surrounds it on every side.'),
    'back eye': ('back_eye', 'Shift the viewpoint of the first image around the object{ref}: a view from directly '
                 'behind it at the same height and distance. Its back now faces the view, its front face and '
                 'everything on it are hidden, and the backdrop is seen from the opposite side.'),
    'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the object{ref}: a three-quarter view from in '
              'front of it and 45 degrees around toward its frame-right side, at the same height and distance. Its '
              'front face now turns at an angle toward frame-left, and the side that was at frame-right in the first '
              'image now shows, nearer the view.'),
    'tqb l': ('tq_bl', 'Shift the viewpoint of the first image around the object{ref}: a three-quarter rear view from '
              'behind it and 45 degrees toward the side that was at frame-right in the first image. Its back and that '
              'side show at an angle, and its front face and everything on it are hidden.'),
}
MQ9_KEEP_REF = {
    'ref': (' Take only the viewing angle from the yellow stand-in in the second image: its white panel with the black '
            'disc is the front of the object, its plain yellow face is the back.'),
    'line': (' Take only the viewing angle from the outline drawing of a stand-in in the second image: the side with '
             'the panel and the circle is the front of the object.'),
    'prompt': ''}
MQ9_KEEP = (' The object stays exactly the object from the first image, with its own shape, colours, materials and '
            'details; keep the background, the light and the image style of the first image unchanged.')
MQ9_SOURCES = {'bottle': ('bottle input', 'bottle/'), 'speaker': ('object input', 'object/')}  # source key, stand-in dir
MQ9_MODES = {'ref': '', 'line': 'outline/', 'prompt': None}  # arm -> ref subfolder (None = no ref)


def blender9(port):
    done = os.path.join(OUT, 'mq_blender9.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    pres = json.load(open(os.path.join(OUT, 'pitch.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')

    def save(key, body):
        if key not in res:
            res[key] = gen(port, body)
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    save('bottle input', {**FAST, 'operation': 't2i', 'seed': 111, 'positive': BOTTLE_SOURCE,
                          'cardName': 'angles mq9 bottle input'})
    for name, (srckey, folder) in MQ9_SOURCES.items():
        src = res.get(srckey) or pres[srckey]
        for sub in [m for m in MQ9_MODES.values() if m is not None]:
            for v, (render, _) in MQ9_VIEWS.items():
                path = folder + sub + render
                if f'ref {path}' not in res:
                    res[f'ref {path}'] = import_ref(port, path, f'angles mq9 ref {path}')
                    json.dump(res, open(done, 'w'), indent=1)
        for seed in MQ7_SEEDS:
            for mode, sub in MQ9_MODES.items():
                for v, (render, text) in MQ9_VIEWS.items():
                    media = [{'role': 'inputImage', 'url': src}]
                    if sub is not None:
                        media.append({'role': 'inputImage2', 'url': res[f'ref {folder}{sub}{render}']})
                    save(f'{name} {mode} {seed} {v}', {
                        **FAST, 'seed': seed, 'media': media, 'cardName': f'angles mq9 {name} {mode} {seed} {v}',
                        'positive': text.format(ref='' if sub is None else ' to match the reference in the second image')
                        + MQ9_KEEP_REF[mode] + MQ9_KEEP})
        rows = [[(src, 'source')] + [(res[f'ref {folder}{MQ9_VIEWS[v][0]}'], f'ref {v}') for v in MQ9_VIEWS]]
        rows += [[(None, f'{mode} seed {s}')] + [(res.get(f'{name} {mode} {s} {v}'), v) for v in MQ9_VIEWS]
                 for mode in MQ9_MODES for s in MQ7_SEEDS]
        _sheet(rows, f'mq_blender9_{name}')


# Round 10 (overnight): face close-up HEIGHTS, the one people cell that never passed. Two guesses: the edit keeps the
# eyes on the lens, which pulls every view back to eye level - so the subject now keeps looking straight ahead, past
# the view; and round 7's ~30-degree refs were too gentle - steeper ones from blender/face_build.py (face_xlo ~40 deg
# below, face_xhi ~45 deg above). Arms: 'xref' (steep refs), 'ref' (round 7 refs), 'prompt' (no ref). Turbo, 4 seeds.
MQ10_FACE = {
    'lo': ('Shift the viewpoint of the first image down{ref}: a low view from below the subject\'s chin, looking up at '
           'their face. They keep their head upright and keep looking straight ahead, past the view, not down into '
           'it. The underside of their chin and jaw and their nostrils now show, their neck is large at the bottom of '
           'the frame, their face rises and narrows toward the top of their head, and the backdrop behind them is '
           'seen from below.'),
    'hi': ('Shift the viewpoint of the first image up{ref}: a high view from above and in front of the subject, '
           'looking down at their face. They keep their head upright and keep looking straight ahead, below the view, '
           'not up into it. The top of their head, their parting and their forehead are now large near the top of the '
           'frame, their eyes look ahead under their brows, their face narrows toward a small chin, and their '
           'shoulders fall away below.'),
}
MQ10_REFS = {'xref': {'lo': 'face_xlo', 'hi': 'face_xhi'}, 'ref': {'lo': 'face_front_lo', 'hi': 'face_front_hi'},
             'prompt': None}
MQ10_SEEDS = (111, 222, 333, 444)


def blender10(port):
    done = os.path.join(OUT, 'mq_blender10.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['face input']
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for refs in [r for r in MQ10_REFS.values() if r]:
        for render in refs.values():
            if f'ref {render}' not in res:
                res[f'ref {render}'] = import_ref(port, render, f'angles mq10 ref {render}')
                json.dump(res, open(done, 'w'), indent=1)
    for seed in MQ10_SEEDS:
        for arm, refs in MQ10_REFS.items():
            for v, text in MQ10_FACE.items():
                key = f'{arm} {seed} {v}'
                if key in res:
                    continue
                media = [{'role': 'inputImage', 'url': src}]
                if refs:
                    media.append({'role': 'inputImage2', 'url': res[f'ref {refs[v]}']})
                res[key] = gen(port, {**FAST, 'seed': seed, 'media': media, 'cardName': f'angles mq10 face {key}',
                                      'positive': text.format(ref=' to match the mannequin reference in the second image'
                                                              if refs else '') + (MQ7_FACE_KEEP if refs else
                                                                                  ' ' + MQ7_FACE_KEEP.split('. ', 1)[1])})
                json.dump(res, open(done, 'w'), indent=1)
    cols = [(arm, v) for arm in MQ10_REFS for v in MQ10_FACE]
    rows = [[(src, 'source')] + [(res[f'ref {MQ10_REFS[a][v]}'] if MQ10_REFS[a] else None, f'ref {a} {v}')
                                 for a, v in cols]]
    rows += [[(None, f'seed {s}')] + [(res.get(f'{a} {s} {v}'), f'{a} {v}') for a, v in cols] for s in MQ10_SEEDS]
    _sheet(rows, 'mq_blender10_face')


# Round 11 (overnight): round 9's winner on objects was the OUTLINE stand-in (backs 2/2 speaker, 1/2 bottle; the solid
# yellow one gets pasted). Pass rate on 4 seeds, against the OUTLINE MANNEQUIN (Fabio: maybe the mannequin instead of
# an object). Top-down failed on every arm -> 'top2' says flat-lay. Rear 3/4 failed on every arm -> also as TWO edits:
# the back view first, then 45 degrees on round (from behind, the first image's frame-right side is at frame-left).
MQ11_VIEWS = {**{v: MQ9_VIEWS[v] for v in ('front lo', 'front hi', 'back eye', 'tq fl', 'tqb l')},
              'top2': ('top2', 'Shift the viewpoint of the first image up{ref}: a straight-down bird\'s-eye view, like a '
                       'flat-lay photograph taken from directly overhead. Only the object\'s top surface shows, seen '
                       'flat in the middle of the frame; its front face and its sides are not visible at all, and the '
                       'backdrop surrounds it on every side.')}
MQ11_BACK_TO_TQB = ('Shift the viewpoint of the first image around the object to match the reference in the second '
                    'image: 45 degrees further round toward its frame-left end, at the same height and distance. Its '
                    'back face now shows at an angle and its frame-left end shows nearer the view; its front stays '
                    'hidden on the far side.')
MQ11_ARMS = {  # arm -> (ref folder per source or None for the shared mannequin folder, keep before MQ9_KEEP)
    'line': (None, MQ9_KEEP_REF['line']),
    'mline': ('outline/', ' Take only the viewing angle from the outline drawing of a mannequin in the second image: '
                          'the mannequin\'s face side is the front of the object. Nothing of the mannequin appears.'),
}
MQ11_SEEDS = (111, 222, 333, 444)


def blender11(port):
    done = os.path.join(OUT, 'mq_blender11.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r9 = json.load(open(os.path.join(OUT, 'mq_blender9.json')))
    pres = json.load(open(os.path.join(OUT, 'pitch.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')

    def ref(path):
        if f'ref {path}' not in res:
            res[f'ref {path}'] = import_ref(port, path, f'angles mq11 ref {path}')
            json.dump(res, open(done, 'w'), indent=1)
        return res[f'ref {path}']

    def save(key, first, refurl, text):
        if key not in res:
            res[key] = gen(port, {**FAST, 'seed': int(key.split()[2]), 'cardName': f'angles mq11 {key}',
                                  'media': [{'role': 'inputImage', 'url': first}, {'role': 'inputImage2', 'url': refurl}],
                                  'positive': text})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for name, (srckey, folder) in MQ9_SOURCES.items():
        src = r9.get(srckey) or pres[srckey]
        for seed in MQ11_SEEDS:
            for arm, (afolder, keep) in MQ11_ARMS.items():
                d = afolder or folder + 'outline/'
                for v, (render, text) in MQ11_VIEWS.items():
                    save(f'{name} {arm} {seed} {v}', src, ref(d + render),
                         text.format(ref=' to match the reference in the second image') + keep + MQ9_KEEP)
            back = res[f'{name} line {seed} back eye']  # two edits: the outline stand-in's back view, then on round
            save(f'{name} 2step {seed} tqb l', back, ref(folder + 'outline/tq_bl'),
                 MQ11_BACK_TO_TQB + MQ9_KEEP_REF['line'] + MQ9_KEEP)
        cols = [(a, v) for a in MQ11_ARMS for v in MQ11_VIEWS] + [('2step', 'tqb l')]
        refpath = {(a, v): (MQ11_ARMS[a][0] or folder + 'outline/') + MQ11_VIEWS[v][0] for a in MQ11_ARMS
                   for v in MQ11_VIEWS}
        refpath[('2step', 'tqb l')] = folder + 'outline/tq_bl'
        rows = [[(src, 'source')] + [(res[f'ref {refpath[c]}'], f'ref {c[0]} {c[1]}') for c in cols]]
        rows += [[(None, f'seed {s}')] + [(res.get(f'{name} {a} {s} {v}'), f'{a} {v}') for a, v in cols]
                 for s in MQ11_SEEDS]
        _sheet(rows, f'mq_blender11_{name}', cell=240, h=268)


# Round 12 (overnight): close-up heights become a head tilt in one edit (round 10). Route around it with what works:
# (a) zoom the close-up OUT to a waist-up view (no ref), (b) the body height recipe on that (MQ5-style end state +
# MQ6_KEEP + the full-body front_lo / front_hi ref), (c) zoom back IN to head and shoulders, keeping the view.
MQ12_ZOOM_OUT = ('Zoom out from the first image to a waist-up view of the same person at the same eye-level height: '
                 'their head, shoulders, arms and body down to the waist now show, smaller in the frame, with more of '
                 'the same plain backdrop around them. Keep their identity, hair, clothes, expression, the light and '
                 'the image style of the first image unchanged.')
MQ12_HEIGHT = {
    'lo': ('front_lo', 'Shift the viewpoint of the first image down to match the mannequin reference in the second '
           'image: a low view from below the subject\'s waist, looking steeply up at them. Their waist and chest are '
           'now large at the bottom of the frame, their body rises and narrows toward the top, the underside of their '
           'chin and jaw shows, their head is smaller near the top, and the backdrop behind them is seen from below.'),
    'hi': ('front_hi', 'Shift the viewpoint of the first image up to match the mannequin reference in the second image: '
           'a high view from above and in front of the subject, looking steeply down at them. The top of their head '
           'and their shoulders are now large near the top of the frame, their face is foreshortened below their '
           'brow, their body narrows downward toward the bottom edge, and the backdrop fills the space behind them.'),
}
MQ12_ZOOM_IN = ('Zoom in on the first image to a head-and-shoulders close-up of the person, keeping exactly the same '
                'viewing angle and perspective: the view still looks {dir} at them as in the first image. Keep their '
                'identity, hair, clothes, expression, the light and the image style unchanged.')
MQ12_SEEDS = (111, 222, 333, 444)


def blender12(port):
    done = os.path.join(OUT, 'mq_blender12.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['face input']
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')

    def save(key, media, text):
        if key not in res:
            res[key] = gen(port, {**FAST, 'seed': int(key.split()[1]), 'cardName': f'angles mq12 {key}',
                                  'media': [{'role': r, 'url': u} for r, u in zip(('inputImage', 'inputImage2'), media)],
                                  'positive': text})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for v, (render, _) in MQ12_HEIGHT.items():
        if f'ref {render}' not in res:
            res[f'ref {render}'] = import_ref(port, render, f'angles mq12 ref {render}')
            json.dump(res, open(done, 'w'), indent=1)
    for seed in MQ12_SEEDS:
        wide = save(f'out {seed}', [src], MQ12_ZOOM_OUT)
        for v, (render, text) in MQ12_HEIGHT.items():
            moved = save(f'height {seed} {v}', [wide, res[f'ref {render}']], text + MQ6_KEEP)
            save(f'in {seed} {v}', [moved], MQ12_ZOOM_IN.format(dir='up' if v == 'lo' else 'down'))
    cols = [('out', None)] + [(s, v) for v in MQ12_HEIGHT for s in ('height', 'in')]
    rows = [[(src, 'source')] + [(res[f'ref {MQ12_HEIGHT[v][0]}'] if v else None, f'ref {s} {v or ""}')
                                 for s, v in cols]]
    rows += [[(None, f'seed {sd}')] + [(res.get(f'{s} {sd} {v}' if v else f'{s} {sd}'), f'{s} {v or ""}')
                                       for s, v in cols] for sd in MQ12_SEEDS]
    _sheet(rows, 'mq_blender12_face')


# Round 13 (overnight): generic object wording never reached top-down or the rear 3/4 (round 11). In the Flow an agent
# writes the prompt and can SEE the object, so the end state can name its own parts. From behind-left (tq_bl) the
# first image's frame-right end is at frame-left, nearest the view. Arms: 'line' (outline stand-in) and 'prompt'.
MQ13_VIEWS = {  # source -> view -> (stand-in render, end state); '{ref}' as in MQ9_VIEWS
    'speaker': {
        'top2': ('top2', 'Shift the viewpoint of the first image up{ref}: a view from directly above the speaker, '
                 'looking straight down. Only its dark grey top face with the three round rubber buttons shows, as a '
                 'long flat rectangle in the middle of the frame, with the strap loop sticking out at its frame-right '
                 'end; the green grille and the brass badge are not visible.'),
        'back eye': ('back_eye', 'Shift the viewpoint of the first image around the speaker{ref}: a view from directly '
                     'behind it at the same height and distance. Its plain dark back panel now faces the view, the '
                     'strap end is at frame-left, and the green grille and the brass badge are hidden on the far side.'),
        'tqb l': ('tq_bl', 'Shift the viewpoint of the first image around the speaker{ref}: a three-quarter rear view '
                  'from behind it, toward its strap end. The strap end now faces partly toward the view at frame-left '
                  'with the tan leather strap nearest, and the plain dark back panel runs away at an angle toward '
                  'frame-right; the green grille and the brass badge are on the far side, not visible.'),
    },
    'bottle': {
        'top2': ('top2', 'Shift the viewpoint of the first image up{ref}: a view from directly above the bottle, '
                 'looking straight down. The faceted gold cap is seen from above as a gold octagon in the middle of '
                 'the frame, with the narrow top of the pink glass flask showing around it as a thin rounded '
                 'rectangle; the label and the front are not visible.'),
        'back eye': ('back_eye', 'Shift the viewpoint of the first image around the bottle{ref}: a view from directly '
                     'behind it at the same height and distance. Its plain frosted back with only the small white '
                     'sticker near the bottom now faces the view, and the cream label is hidden on the far side.'),
        'tqb l': ('tq_bl', 'Shift the viewpoint of the first image around the bottle{ref}: a three-quarter rear view '
                  'from behind it and to one side. One narrow plain side now faces partly toward the view at '
                  'frame-left, and the plain frosted back with the small white sticker runs away at an angle toward '
                  'frame-right; the cream label is on the far side, not visible.'),
    },
}
MQ13_ARMS = ('line', 'prompt')


def blender13(port):
    done = os.path.join(OUT, 'mq_blender13.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r9 = json.load(open(os.path.join(OUT, 'mq_blender9.json')))
    r11 = json.load(open(os.path.join(OUT, 'mq_blender11.json')))
    pres = json.load(open(os.path.join(OUT, 'pitch.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for name, (srckey, folder) in MQ9_SOURCES.items():
        src = r9.get(srckey) or pres[srckey]
        views = MQ13_VIEWS[name]
        for seed in MQ11_SEEDS:
            for arm in MQ13_ARMS:
                for v, (render, text) in views.items():
                    key = f'{name} {arm} {seed} {v}'
                    if key in res:
                        continue
                    media = [{'role': 'inputImage', 'url': src}]
                    if arm == 'line':
                        media.append({'role': 'inputImage2', 'url': r11[f'ref {folder}outline/{render}']})
                    res[key] = gen(port, {**FAST, 'seed': seed, 'media': media, 'cardName': f'angles mq13 {key}',
                                          'positive': text.format(ref='' if arm == 'prompt' else
                                                                  ' to match the reference in the second image')
                                          + MQ9_KEEP_REF[arm] + MQ9_KEEP})
                    json.dump(res, open(done, 'w'), indent=1)
        cols = [(a, v) for a in MQ13_ARMS for v in views]
        rows = [[(src, 'source')] + [(r11[f'ref {folder}outline/{views[v][0]}'] if a == 'line' else None, f'ref {a} {v}')
                                     for a, v in cols]]
        rows += [[(None, f'seed {s}')] + [(res.get(f'{name} {a} {s} {v}'), f'{a} {v}') for a, v in cols]
                 for s in MQ11_SEEDS]
        _sheet(rows, f'mq_blender13_{name}')


# Round 14 (overnight): round 13's object recipe on EVERY view (the five new ones written the same way - the object's
# own parts), with the panel-only outline stand-in (`ref_render.py -- outline nodisc`). Frame sides read off the
# stand-in renders: front-left (tq_fl) puts the first image's frame-right end nearest at frame-right; front-right
# (tq_fr) its frame-left end nearest at frame-left; rear-right (tq_br) its frame-left end nearest at frame-right.
MQ14_VIEWS = {
    'speaker': {
        'front lo': ('front_lo', 'Shift the viewpoint of the first image down{ref}: a low view from below the speaker, '
                     'looking steeply up at it. Its dark underside with the four small rubber feet now shows large, '
                     'the green grille and the brass badge lean away above it, and the strap hangs at frame-right.'),
        'front hi': ('front_hi', 'Shift the viewpoint of the first image up{ref}: a high view from above and in front '
                     'of the speaker, looking steeply down at it. Its dark grey top face with the three round rubber '
                     'buttons now shows large, the green grille is foreshortened below it, and the strap loop sticks '
                     'out at frame-right.'),
        **{v: MQ13_VIEWS['speaker'][v] for v in ('top2', 'back eye')},
        'back lo': ('back_lo', 'Shift the viewpoint of the first image around and down{ref}: a low view from behind '
                    'and below the speaker, looking steeply up at it. Its dark underside with the four rubber feet '
                    'shows large, its plain dark back panel leans away above it, the strap end is at frame-left, and '
                    'the green grille is hidden on the far side.'),
        'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the speaker{ref}: a three-quarter view from in '
                  'front of it, toward its strap end. The green grille now turns at an angle toward frame-left, and '
                  'the strap end faces partly toward the view at frame-right with the tan leather strap nearest.'),
        'tq fr': ('tq_fr', 'Shift the viewpoint of the first image around the speaker{ref}: a three-quarter view from in '
                  'front of it, toward its plain end. The green grille now turns at an angle toward frame-right, the '
                  'plain dark end without the strap faces partly toward the view at frame-left, and the strap is at '
                  'the far end.'),
        'tqb l': MQ13_VIEWS['speaker']['tqb l'],
        'tqb r': ('tq_br', 'Shift the viewpoint of the first image around the speaker{ref}: a three-quarter rear view '
                  'from behind it, toward its plain end. The plain dark end without the strap faces partly toward the '
                  'view at frame-right, the plain dark back panel runs away at an angle toward frame-left with the '
                  'strap at its far end, and the green grille is on the far side, not visible.'),
    },
    'bottle': {
        'front lo': ('front_lo', 'Shift the viewpoint of the first image down{ref}: a low view from below the bottle, '
                     'looking steeply up at it. Its flat frosted base now shows, the cream label leans away above it, '
                     'and the gold cap is small at the top.'),
        'front hi': ('front_hi', 'Shift the viewpoint of the first image up{ref}: a high view from above and in front '
                     'of the bottle, looking steeply down at it. The faceted gold cap and the glass shoulders now show '
                     'large near the top of the frame, and the cream label is foreshortened below them.'),
        **{v: MQ13_VIEWS['bottle'][v] for v in ('top2', 'back eye')},
        'back lo': ('back_lo', 'Shift the viewpoint of the first image around and down{ref}: a low view from behind and '
                    'below the bottle, looking steeply up at it. Its flat frosted base shows, its plain frosted back '
                    'with the small white sticker leans away above it, and the cream label is hidden on the far side.'),
        'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the bottle{ref}: a three-quarter view from in '
                  'front of it and to one side. The cream label now turns at an angle toward frame-left, and one '
                  'narrow plain side faces partly toward the view at frame-right.'),
        'tq fr': ('tq_fr', 'Shift the viewpoint of the first image around the bottle{ref}: a three-quarter view from in '
                  'front of it and to the other side. The cream label now turns at an angle toward frame-right, and '
                  'one narrow plain side faces partly toward the view at frame-left.'),
        'tqb l': MQ13_VIEWS['bottle']['tqb l'],
        'tqb r': ('tq_br', 'Shift the viewpoint of the first image around the bottle{ref}: a three-quarter rear view from '
                  'behind it and to the other side. One narrow plain side now faces partly toward the view at '
                  'frame-right, the plain frosted back with the small white sticker runs away at an angle toward '
                  'frame-left, and the cream label is on the far side, not visible.'),
    },
}


def blender14(port):
    done = os.path.join(OUT, 'mq_blender14.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r9 = json.load(open(os.path.join(OUT, 'mq_blender9.json')))
    pres = json.load(open(os.path.join(OUT, 'pitch.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for name, (srckey, folder) in MQ9_SOURCES.items():
        src = r9.get(srckey) or pres[srckey]
        views = MQ14_VIEWS[name]
        for render in {r for r, _ in views.values()}:
            path = folder + 'outline_nodisc/' + render
            if f'ref {path}' not in res:
                res[f'ref {path}'] = import_ref(port, path, f'angles mq14 ref {path}')
                json.dump(res, open(done, 'w'), indent=1)
        for seed in MQ11_SEEDS:
            for v, (render, text) in views.items():
                key = f'{name} {seed} {v}'
                if key not in res:
                    res[key] = gen(port, {**FAST, 'seed': seed, 'cardName': f'angles mq14 {key}',
                                          'media': [{'role': 'inputImage', 'url': src},
                                                    {'role': 'inputImage2',
                                                     'url': res[f'ref {folder}outline_nodisc/{render}']}],
                                          'positive': text.format(ref=' to match the reference in the second image')
                                          + MQ9_KEEP_REF['line'].replace('the panel and the circle', 'the panel')
                                          + MQ9_KEEP})
                    json.dump(res, open(done, 'w'), indent=1)
        rows = [[(src, 'source')] + [(res[f'ref {folder}outline_nodisc/{views[v][0]}'], f'ref {v}') for v in views]]
        rows += [[(None, f'seed {s}')] + [(res.get(f'{name} {s} {v}'), v) for v in views] for s in MQ11_SEEDS]
        _sheet(rows, f'mq_blender14_{name}')


# Round 15 (overnight): round 13's lesson on the face close-up - name what NEWLY shows. A plain backdrop gives the
# model no perspective, so the end state brings in the studio: the ceiling + a light above her (low), the floor
# behind her (high). Arms 'xref' (steep face refs) and 'prompt'. Turbo, 4 seeds.
MQ15_FACE = {
    'lo': ('face_xlo', 'Shift the viewpoint of the first image down{ref}: a low view from below the woman\'s chin, '
           'looking up at her. The underside of her chin and jaw and her nostrils now show, her turtleneck collar is '
           'large at the bottom of the frame, her face rises above it, and behind her head the studio ceiling with a '
           'softbox light now shows instead of the grey backdrop. Her head stays upright.'),
    'hi': ('face_xhi', 'Shift the viewpoint of the first image up{ref}: a high view from above and in front of the '
           'woman, looking down at her. The top of her head and her hair parting are now large near the top of the '
           'frame, her face is foreshortened below them, her shoulders fall away, and behind her the grey studio '
           'floor now fills the background instead of the backdrop. Her head stays upright.'),
}


def blender15(port):
    done = os.path.join(OUT, 'mq_blender15.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r10 = json.load(open(os.path.join(OUT, 'mq_blender10.json')))
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['face input']
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for seed in MQ10_SEEDS:
        for arm in ('xref', 'prompt'):
            for v, (render, text) in MQ15_FACE.items():
                key = f'{arm} {seed} {v}'
                if key in res:
                    continue
                media = [{'role': 'inputImage', 'url': src}]
                if arm == 'xref':
                    media.append({'role': 'inputImage2', 'url': r10[f'ref {render}']})
                keep = MQ7_FACE_KEEP if arm == 'xref' else ' ' + MQ7_FACE_KEEP.split('. ', 1)[1]
                res[key] = gen(port, {**FAST, 'seed': seed, 'media': media, 'cardName': f'angles mq15 face {key}',
                                      'positive': text.format(ref=' to match the mannequin reference in the second '
                                                              'image' if arm == 'xref' else '')
                                      + keep.replace('the background, ', '')})
                json.dump(res, open(done, 'w'), indent=1)
    cols = [(a, v) for a in ('xref', 'prompt') for v in MQ15_FACE]
    rows = [[(src, 'source')] + [(r10[f'ref {MQ15_FACE[v][0]}'] if a == 'xref' else None, f'ref {a} {v}')
                                 for a, v in cols]]
    rows += [[(None, f'seed {s}')] + [(res.get(f'{a} {s} {v}'), f'{a} {v}') for a, v in cols] for s in MQ10_SEEDS]
    _sheet(rows, 'mq_blender15_face')


# Round 16 (overnight): round 15's face rule off the studio - a man's close-up in a street (t2i). The end state names
# what the new view reveals there: sky + leaning upper floors (lo), the cobbles (hi). Plus a 3/4 turn (round 7 wording)
# to see turns hold on the new source. Steep refs, Turbo, 4 seeds.
STREET_FACE_SOURCE = (
    'Full-color photograph, head-and-shoulders portrait of a man in his forties with short dark hair and a short '
    'grey-flecked beard, facing the camera straight on at eye level, standing in a narrow old-town street with stone '
    'house fronts and a red door softly out of focus behind him, warm late-afternoon light. He wears a navy work '
    'jacket over a white t-shirt. Framed from the top of his head to mid-chest.')
MQ16_VIEWS = {
    'lo': ('face_xlo', 'Shift the viewpoint of the first image down to match the mannequin reference in the second '
           'image: a low view from below the man\'s chin, looking up at him. The underside of his beard and jaw and '
           'his nostrils now show, his jacket collar is large at the bottom of the frame, his face rises above it, and '
           'behind his head the upper floors of the house fronts lean inward and the open sky now shows instead of '
           'the street. His head stays upright.'),
    'hi': ('face_xhi', 'Shift the viewpoint of the first image up to match the mannequin reference in the second image: '
           'a high view from above and in front of the man, looking down at him. The top of his head is now large '
           'near the top of the frame, his face is foreshortened below it, his shoulders fall away, and behind him the '
           'cobblestones of the street now fill the background instead of the house fronts. His head stays upright.'),
    'tq fl': ('face_tq_fl', MQ7_FACE['tq fl'][1]),
}


def blender16(port):
    done = os.path.join(OUT, 'mq_blender16.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r10 = json.load(open(os.path.join(OUT, 'mq_blender10.json')))
    r7 = json.load(open(os.path.join(OUT, 'mq_blender7.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    refs = {**{k: v for k, v in r10.items() if k.startswith('ref ')}, **{k: v for k, v in r7.items() if k.startswith('ref ')}}
    if 'man input' not in res:
        res['man input'] = gen(port, {**FAST, 'operation': 't2i', 'seed': 111, 'positive': STREET_FACE_SOURCE,
                                      'cardName': 'angles mq16 man face input'})
        json.dump(res, open(done, 'w'), indent=1)
    keep = MQ7_FACE_KEEP.replace('the background, ', '')
    for seed in MQ10_SEEDS:
        for v, (render, text) in MQ16_VIEWS.items():
            key = f'{seed} {v}'
            if key not in res:
                res[key] = gen(port, {**FAST, 'seed': seed, 'cardName': f'angles mq16 man face {key}',
                                      'media': [{'role': 'inputImage', 'url': res['man input']},
                                                {'role': 'inputImage2', 'url': refs[f'ref {render}']}],
                                      'positive': text + (keep if v != 'tq fl' else MQ7_FACE_KEEP)})
                json.dump(res, open(done, 'w'), indent=1)
    rows = [[(res['man input'], 'source')] + [(refs[f'ref {r}'], f'ref {v}') for v, (r, _) in MQ16_VIEWS.items()]]
    rows += [[(None, f'seed {s}')] + [(res.get(f'{s} {v}'), v) for v in MQ16_VIEWS] for s in MQ10_SEEDS]
    _sheet(rows, 'mq_blender16_manface')


def blender(port, rnd='3'):
    name, prefix, wordings = MQ_ROUNDS[rnd]
    done = os.path.join(OUT, f'{name}.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for v, f in MQ_BL_VIEWS.items():
        if f'ref {v}' not in res:
            res[f'ref {v}'] = import_ref(port, f, f'angles {prefix} ref {v}')
            json.dump(res, open(done, 'w'), indent=1)
        for w, tpl in wordings:
            key = f'{w} {v}'
            if key not in res:
                res[key] = gen(port, {**FAST, 'seed': PITCH_SEED, 'positive': tpl.format(v=MQ2_VIEWS[v][2]),
                                      'cardName': f'angles {prefix} {key}',
                                      'media': [{'role': 'inputImage', 'url': src}, {'role': 'inputImage2', 'url': res[f'ref {v}']}]})
                json.dump(res, open(done, 'w'), indent=1)
    cell, h = 300, 324
    rows = [[('src', 'source')] + [(f'{w} {v}', f'{w} {v}') for v in MQ_BL_VIEWS] for w in ('ref',) + tuple(w for w, _ in wordings)]
    img = Image.new('RGB', (cell * 5, h * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (k, label) in enumerate(row):
            url = src if k == 'src' else res.get(k)
            if url and (r == 0 or c):
                im = Image.open(disk(url)).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
                d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', f'{name}.jpg'), quality=90)


def mannequin2(port, edits=False):
    import shutil
    done = os.path.join(OUT, 'mannequin2.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    keep = os.path.join(HERE, 'mannequin')

    def step(key, body):
        if key not in res:
            if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
            res[key] = gen(port, {**FAST, 'seed': PITCH_SEED, **body, 'cardName': f'angles mq2 {key}'})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for v, (cam, lay, _) in MQ2_VIEWS.items():
        for s in MQ_SEEDS:
            step(f'ref {v} {s}', {'operation': 't2i', 'ratio': '1:1', 'seed': s,
                                  'positive': MQ2_HEAD + cam + MQ2_LIGHT + MQ2_SUBJ + lay + MQ2_BACK})
    for v, s in MQ_PICK.items():
        shutil.copyfile(disk(res[f'ref {v} {s}']), os.path.join(keep, f'{v.replace(" ", "_")}.png'))
        if edits:
            step(f'edit {v}', {'positive': MQ_EDIT.format(v=MQ2_VIEWS[v][2]),
                               'media': [{'role': 'inputImage', 'url': src},
                                         {'role': 'inputImage2', 'url': res[f'ref {v} {s}']}]})
            step(f'editB {v}', {'positive': MQ_EDIT_B.format(v=MQ2_VIEWS[v][2]),
                                'media': [{'role': 'inputImage', 'url': src},
                                          {'role': 'inputImage2', 'url': res[f'ref {v} {s}']}]})
    cell = 300
    rows = [[(f'ref {v} {s}', f'{v} s{s}') for s in MQ_SEEDS] for v in MQ2_VIEWS]
    if edits and MQ_PICK:
        rows.append([(f'ref {v} {s}', f'ref {v} s{s}') for v, s in MQ_PICK.items()])
        rows.append([(f'edit {v}', f'edit {v}') for v in MQ_PICK])
        rows.append([(f'editB {v}', f'editB {v}') for v in MQ_PICK])
    h = cell + 24
    img = Image.new('RGB', (cell * max(len(r) for r in rows), h * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (k, label) in enumerate(row):
            if k in res:
                im = Image.open(disk(res[k])).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
                d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', 'mannequin2.jpg'), quality=90)


def mannequin(port, edits=False):
    import shutil
    done = os.path.join(OUT, 'mannequin.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    src = json.load(open(os.path.join(OUT, 'pitch.json')))['scene input']
    keep = os.path.join(HERE, 'mannequin')
    os.makedirs(keep, exist_ok=True)

    def step(key, body):
        if key not in res:
            if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
                sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
            res[key] = gen(port, {**FAST, 'seed': PITCH_SEED, **body, 'cardName': f'angles mq {key}'})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for v, (cam, _) in MQ_VIEWS.items():
        ref = step(f'ref {v}', {'operation': 't2i', 'ratio': '1:1', 'positive': MQ_BODY + cam})
        shutil.copyfile(disk(ref), os.path.join(keep, f'{v.replace(" ", "_")}.png'))
    if edits:
        for v, (_, words) in MQ_VIEWS.items():
            step(f'edit {v}', {'positive': MQ_EDIT.format(v=words),
                               'media': [{'role': 'inputImage', 'url': src},
                                         {'role': 'inputImage2', 'url': res[f'ref {v}']}]})
    cell = 300
    rows = [[(f'ref {v}', f'ref {v}') for v in MQ_VIEWS]]
    if edits:
        rows.append([(f'edit {v}', f'edit {v}') for v in MQ_VIEWS])
    h = cell * 5 // 4 + 24
    img = Image.new('RGB', (cell * len(MQ_VIEWS), h * len(rows)), 'white')
    d = ImageDraw.Draw(img)
    for r, row in enumerate(rows):
        for c, (k, label) in enumerate(row):
            if k in res:
                im = Image.open(disk(res[k])).convert('RGB')
                im.thumbnail((cell, h - 24))
                img.paste(im, (c * cell, r * h + 24))
                d.text((c * cell + 4, r * h + 4), label, fill='black')
    img.save(os.path.join(HERE, 'sheets', 'mannequin.jpg'), quality=90)


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



# Round 17 (Fabio 2026-10-24): rounds 13-14 gave each product a stand-in built to ITS OWN shape (box = speaker, flask =
# bottle) at ONE distance, so they do not prove the Flow. Here ONE generic stand-in (`obj_build.py -- cube`: a plain
# cube, the panel = the face the source shows) serves four products of unlike shapes, in real settings (on a floor,
# a table, a plinth) and at different source distances; zoom refs (`<cam>_near` / `_far`: same position, longer /
# shorter lens) test distance. `blender17 sources` makes the sources and imports the refs; MQ17_VIEWS is written AFTER
# looking at the sources, the way the Flow's agent would, then `blender17` runs the edits.
MQ17_SOURCES = {
    'sneaker': ('Full-color product photograph of a single white leather running sneaker standing on a polished grey '
                'concrete floor, seen from its outer side at its own height, toe pointing to frame-left, against a '
                'plain warm-grey wall with soft window light from the left. Thick cream foam sole, a navy suede heel '
                'panel and navy laces, a small orange tab on the heel. Framed with some floor and wall around it.'),
    'mug': ('Full-color close-up product photograph of a matte terracotta ceramic coffee mug on a light oak table, '
            'seen straight from the front at the height of its rim, its handle on frame-right, filling most of the '
            'frame. A small white glazed leaf is painted on its front; the inside is glossy cream glaze. Blurred '
            'kitchen shelves behind, soft daylight.'),
    'headphones': ('Full-color product photograph of a pair of over-ear wireless headphones floating in mid-air in '
                   'the centre of the frame, seen straight from the front, the headband arching on top and both ear '
                   'cups facing each other, against a plain pale-blue seamless backdrop with soft even studio light. '
                   'Matte sage-green plastic, cream leather ear cushions, brushed silver sliders, a small power '
                   'button and a status light on the frame-right ear cup only.'),
    'handbag': ('Full-color wide product photograph of a structured black leather handbag standing on a round white '
                'marble plinth in a bright minimalist boutique, seen from the front at its own height, small in the '
                'frame with the room around it: pale walls, a potted olive tree on the frame-left, light from tall '
                'windows. The bag has one rounded top handle, a gold clasp on its front flap and gold feet.'),
}
MQ17_RENDERS = ('front_lo', 'front_hi', 'top2', 'back_eye', 'tq_fl', 'tq_br',
                'front_hi_near', 'front_hi_far', 'tq_fl_near', 'tq_fl_far')
# Written after looking at `mq_blender17_sources.jpg`. Frame sides as in MQ14: tq_fl brings the first image's
# frame-right end nearest at frame-right; tq_br brings its frame-left end nearest at frame-right; back_eye swaps sides.
MQ17_VIEWS = {
    'sneaker': {
        'front lo': ('front_lo', 'Shift the viewpoint of the first image down{ref}: a low view from just above the '
                     'concrete floor, looking up at the sneaker. Its thick cream sole now rises large in the '
                     'foreground, the white upper and the navy laces lean away above it, and more of the grey wall '
                     'shows above the shoe.'),
        'front hi': ('front_hi', 'Shift the viewpoint of the first image up{ref}: a high view from above the sneaker\'s '
                     'outer side, looking steeply down at it. The navy laces and the open collar now show large on '
                     'top, the outer side is foreshortened below them, and the polished concrete floor fills the '
                     'background.'),
        'top2': ('top2', 'Shift the viewpoint of the first image up{ref}: a view from directly above the sneaker, '
                 'looking straight down. The shoe is a long shape across the frame with the toe at frame-left: the '
                 'navy laces run down its middle to the open collar and the navy heel at frame-right, the cream sole '
                 'edge shows round it, and only the concrete floor is around it.'),
        'back eye': ('back_eye', 'Shift the viewpoint of the first image around the sneaker{ref}: a view of its inner '
                     'side at the same height and distance. The toe now points to frame-right and the navy heel with '
                     'the orange tab is at frame-left.'),
        'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the sneaker{ref}: a three-quarter view from '
                  'behind its heel and to the outer side. The navy heel panel with the orange tab now faces partly '
                  'toward the view at frame-right, nearest, and the white outer side runs away at an angle toward the '
                  'toe at frame-left.'),
        'tqb r': ('tq_br', 'Shift the viewpoint of the first image around the sneaker{ref}: a three-quarter view from in '
                  'front of its toe and to the inner side. The rounded white toe now faces partly toward the view at '
                  'frame-right, nearest, the inner side runs away at an angle toward frame-left, and the navy heel is '
                  'at the far end.'),
    },
    'mug': {
        'front lo': ('front_lo', 'Shift the viewpoint of the first image down{ref}: a low view from the level of the '
                     'oak table top, looking up at the mug. Its base sits on the table edge in the foreground, the '
                     'rim is seen from below so the inside is hidden, and the kitchen shelves rise higher behind it.'),
        'front hi': ('front_hi', 'Shift the viewpoint of the first image up{ref}: a high view from above and in front '
                     'of the mug, looking steeply down at it. The glossy cream inside now shows as a large oval, the '
                     'white leaf on the front is foreshortened below it, and the oak table fills the background.'),
        'top2': ('top2', 'Shift the viewpoint of the first image up{ref}: a view from directly above the mug, looking '
                 'straight down into it. The glossy cream inside is a circle in the middle of the frame inside the '
                 'terracotta rim, the handle sticks out at frame-right, and only the oak table is around it.'),
        'back eye': ('back_eye', 'Shift the viewpoint of the first image around the mug{ref}: a view from directly '
                     'behind it at the same height and distance. Its plain terracotta back now faces the view with no '
                     'leaf, and the handle is at frame-left.'),
        'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the mug{ref}: a three-quarter view from in '
                  'front of it, toward its handle. The white leaf now turns toward frame-left, and the handle faces '
                  'partly toward the view at frame-right, nearest, seen more edge-on.'),
        'tqb r': ('tq_br', 'Shift the viewpoint of the first image around the mug{ref}: a three-quarter rear view from '
                  'behind it, away from its handle. The plain terracotta side now faces partly toward the view at '
                  'frame-right, the plain back runs away toward frame-left, the handle is at the far side at '
                  'frame-left, and the white leaf is hidden.'),
    },
    'headphones': {
        'front lo': ('front_lo', 'Shift the viewpoint of the first image down{ref}: a low view from below the '
                     'headphones, looking steeply up at them. The bottoms of both sage-green ear cups now show large '
                     'in the foreground and the headband arches away above them, seen from underneath.'),
        'front hi': ('front_hi', 'Shift the viewpoint of the first image up{ref}: a high view from above and in front '
                     'of the headphones, looking steeply down at them. The top of the cream-padded headband now shows '
                     'large near the top of the frame, and the two ear cups are foreshortened below it.'),
        'top2': ('top2', 'Shift the viewpoint of the first image up{ref}: a view from directly above the headphones, '
                 'looking straight down. The cream padding on top of the headband runs across the middle of the '
                 'frame from frame-left to frame-right, with the tops of the two ear cups at its ends.'),
        'back eye': ('back_eye', 'Shift the viewpoint of the first image around the headphones{ref}: a view from '
                     'directly behind them at the same height and distance. The back of the headband arches on top, '
                     'and the ear cup that was at frame-right is now at frame-left.'),
        'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the headphones{ref}: a three-quarter view '
                  'toward the frame-right ear cup. That ear cup\'s round sage-green outer shell now faces partly '
                  'toward the view at frame-right, nearest and large, and the other ear cup is half hidden behind it '
                  'toward frame-left.'),
        'tqb r': ('tq_br', 'Shift the viewpoint of the first image around the headphones{ref}: a three-quarter rear view '
                  'toward the frame-left ear cup. That ear cup\'s round sage-green outer shell now faces partly '
                  'toward the view at frame-right, nearest, the headband runs away from it, and the other ear cup is '
                  'half hidden at the far end toward frame-left.'),
    },
    'handbag': {
        'front lo': ('front_lo', 'Shift the viewpoint of the first image down{ref}: a low view from the level of the '
                     'marble plinth, looking up at the handbag. The plinth\'s top edge is in the foreground, the bag '
                     'and its handle rise above it, and the boutique ceiling and the tops of the tall windows now show '
                     'above the bag.'),
        'front hi': ('front_hi', 'Shift the viewpoint of the first image up{ref}: a high view from above and in front '
                     'of the handbag, looking steeply down at it. The top of the bag with its rounded handle now shows, '
                     'the gold clasp is foreshortened below it, and the round white marble top of the plinth and the '
                     'pale floor fill the background.'),
        'top2': ('top2', 'Shift the viewpoint of the first image up{ref}: a view from directly above the handbag, '
                 'looking straight down. The bag\'s black top is a narrow rectangle with the rounded handle arching '
                 'over it in the middle of the round white marble plinth, and the pale floor is around the plinth.'),
        'back eye': ('back_eye', 'Shift the viewpoint of the first image around the handbag{ref}: a view from directly '
                     'behind it at the same height and distance. Its plain black leather back now faces the view with '
                     'no flap and no gold clasp, and the handle arches on top.'),
        'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the handbag{ref}: a three-quarter view from in '
                  'front of it and to one side. The front flap with the gold clasp now turns at an angle toward '
                  'frame-left, and one narrow black side faces partly toward the view at frame-right.'),
        'tqb r': ('tq_br', 'Shift the viewpoint of the first image around the handbag{ref}: a three-quarter rear view from '
                  'behind it and to the other side. One narrow black side now faces partly toward the view at '
                  'frame-right, the plain black back runs away at an angle toward frame-left, and the gold clasp is on '
                  'the far side, not visible.'),
    },
}
for _views in MQ17_VIEWS.values():  # zoom pair on two views: the same end state, closer / pulled back
    for _v, _r in (('front hi', 'front_hi'), ('tq fl', 'tq_fl')):
        _t = _views[_v][1]
        _views[_v + ' near'] = (_r + '_near', _t + ' The view is much closer: the object fills the frame, cropped at '
                                'its edges.')
        _views[_v + ' far'] = (_r + '_far', _t + ' The view is pulled far back: the object is small in the middle of '
                               'the frame with much more of its setting around it.')
# The products sit in real settings and a far view must extend them, so MQ9_KEEP's frozen background becomes the setting.
MQ17_KEEP = MQ9_KEEP.replace('keep the background, the light and the image style of the first image unchanged',
                             'keep the same setting, light and image style as the first image')


def blender17(port, sources_only):
    done = os.path.join(OUT, 'mq_blender17.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')

    def save(key, body):
        if key not in res:
            res[key] = gen(port, {**body, 'cardName': f'angles mq17 {key}'})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for name, text in MQ17_SOURCES.items():
        save(f'{name} input', {**FAST, 'operation': 't2i', 'seed': 111, 'positive': text})
    for render in MQ17_RENDERS:
        if f'ref {render}' not in res:
            res[f'ref {render}'] = import_ref(port, 'cube/outline/' + render, f'angles mq17 ref {render}')
            json.dump(res, open(done, 'w'), indent=1)
    if sources_only:
        _sheet([[(res[f'{n} input'], n) for n in MQ17_SOURCES]], 'mq_blender17_sources')
        _sheet([[(res[f'ref {r}'], r) for r in MQ17_RENDERS]], 'mq_blender17_refs')
        return
    keep_ref = MQ9_KEEP_REF['line'].replace('the panel and the circle is the front of the object',
                                            'the panel is the side the first image shows')
    for name, views in MQ17_VIEWS.items():
        for seed in MQ11_SEEDS:
            for v, (render, text) in views.items():
                save(f'{name} {seed} {v}', {**FAST, 'seed': seed,
                                            'media': [{'role': 'inputImage', 'url': res[f'{name} input']},
                                                      {'role': 'inputImage2', 'url': res[f'ref {render}']}],
                                            'positive': text.format(ref=' to match the reference in the second image')
                                            + keep_ref + MQ17_KEEP})
        rows = [[(res[f'{name} input'], 'source')] + [(res[f'ref {r}'], f'ref {v}') for v, (r, _) in views.items()]]
        rows += [[(None, f'seed {s}')] + [(res.get(f'{name} {s} {v}'), v) for v in views] for s in MQ11_SEEDS]
        _sheet(rows, f'mq_blender17_{name}')


# Round 18 (Fabio 2026-10-24): round 17's two gaps. LOW on resting products (~2/16): the front_lo ref showed the cube
# FLOATING, seen from underneath - an underside a mug on a table does not have - and "shift the viewpoint down" read as
# a near copy. So (1) the low end state lowers the camera to the SURFACE: it is seen edge-on as a thin band, the object
# rises above it, its top is hidden; (2) the HOUSE stand-in (`obj_build.py -- house`): door = the side the source shows,
# roof = up, chimney on the back slope at frame-right (left/right and front/back told apart for top-down and the
# symmetric headphones), standing on a plinth = the surface. The house runs every round-17 angle on the round-17
# sources; `cube lo` = the new low words on round 17's cube ref, to split wording from ref. Zoom passed - not re-run.
MQ18_LOW = {
    'sneaker': ('Lower the camera of the first image almost to the polished concrete floor{ref}, tilted slightly up at '
                'the sneaker. The floor is now seen nearly edge-on as a thin grey band along the bottom of the frame, '
                'the thick cream sole sits right on it, large and close, the shoe rises above it seen slightly from '
                'below so the top of the laces is hidden, and much more of the warm-grey wall shows above the shoe.'),
    'mug': ('Lower the camera of the first image almost to the oak table top{ref}, tilted slightly up at the mug. The '
            'table is now seen nearly edge-on as a thin strip of oak along the bottom of the frame, the mug\'s base sits '
            'on it, the mug rises tall above it seen slightly from below so the rim is a thin line and the inside is '
            'hidden, and the blurred kitchen shelves fill more of the frame above it.'),
    'handbag': ('Lower the camera of the first image almost to the top of the marble plinth{ref}, tilted slightly up at '
                'the handbag. The plinth top is now seen edge-on as a thin white line along the bottom of the frame, '
                'the bag\'s gold feet sit on it, the bag rises above it seen slightly from below so its top is hidden '
                'and the handle arches against the boutique ceiling, and the tall windows fill the frame above it.'),
    'headphones': MQ17_VIEWS['headphones']['front lo'][1],  # they float: round 17's low view from below stands
}
MQ18_VIEWS = {name: {**{v: MQ17_VIEWS[name][v] for v in ('front hi', 'top2', 'back eye', 'tq fl', 'tqb r')},
                     'front lo': ('front_lo', MQ18_LOW[name])} for name in MQ17_SOURCES}
MQ18_RENDERS = ('front_lo', 'front_hi', 'top2', 'back_eye', 'tq_fl', 'tq_br')
MQ18_KEEP_REF = (' Take only the viewing angle from the outline drawing of a small house in the second image: its door '
                 'is the side the first image shows, its roof is the top, its chimney is at the back on the side that '
                 'was at frame-right in the first image, and the block it stands on is only what the object rests on.')


def blender18(port):
    done = os.path.join(OUT, 'mq_blender18.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r17 = json.load(open(os.path.join(OUT, 'mq_blender17.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')

    def save(key, body):
        if key not in res:
            res[key] = gen(port, {**body, 'cardName': f'angles mq18 {key}'})
            json.dump(res, open(done, 'w'), indent=1)
        return res[key]

    for render in MQ18_RENDERS:
        if f'ref {render}' not in res:
            res[f'ref {render}'] = import_ref(port, 'house/outline/' + render, f'angles mq18 ref {render}')
            json.dump(res, open(done, 'w'), indent=1)
    cube_ref = MQ9_KEEP_REF['line'].replace('the panel and the circle is the front of the object',
                                            'the panel is the side the first image shows')
    arms = {'house': (lambda r: res[f'ref {r}'], MQ18_KEEP_REF), 'cube': (lambda r: r17[f'ref {r}'], cube_ref)}
    for name, views in MQ18_VIEWS.items():
        for seed in MQ11_SEEDS:
            for arm, v in [('house', v) for v in views] + [('cube', 'front lo')]:
                ref, keep_ref = arms[arm]
                render, text = views[v]
                save(f'{name} {seed} {arm} {v}', {**FAST, 'seed': seed,
                                                  'media': [{'role': 'inputImage', 'url': r17[f'{name} input']},
                                                            {'role': 'inputImage2', 'url': ref(render)}],
                                                  'positive': text.format(ref=' to match the reference in the second '
                                                                          'image') + keep_ref + MQ17_KEEP})
        cols = [('house', v) for v in views] + [('cube', 'front lo')]
        rows = [[(r17[f'{name} input'], 'source')] + [(arms[a][0](views[v][0]), f'ref {a} {v}') for a, v in cols]]
        rows += [[(None, f'seed {s}')] + [(res.get(f'{name} {s} {a} {v}'), f'{a} {v}') for a, v in cols]
                 for s in MQ11_SEEDS]
        _sheet(rows, f'mq_blender18_{name}')


# Round 19 (Fabio 2026-10-24, objects deferred): the open PEOPLE tests, round-7 recipe (MQ5/_tq/_tqb end states +
# MQ6_KEEP, grey refs from Fabio's posed file, one Turbo edit). Seeds 333 + 444 complete the 4-seed pass rate on top of
# round 7's 111 + 222 (and round 6's 4 seeds for the man's lo/back lo/top2): man (street) + woman (studio) at every
# view, the woman's face turns. New: the man's street close-up turned (round 16 source), the woman's studio LOW views
# with round 15's rule (name what the view reveals: ceiling + softbox), and ZOOM on people (blender/zoom_build.py ->
# out/<cam>_near|far.png, round 17's zoom sentences) on 4 seeds.
MQ19_STUDIO_LO = {
    'front lo reveal': ('front_lo', 'Shift the viewpoint of the first image down to match the mannequin reference in '
                        'the second image: a worm\'s-eye view from just above the grey studio floor in front of the '
                        'woman, looking steeply up at her. Her white sneakers and jeans are now large at the bottom of '
                        'the frame, her body rises and narrows toward the top, the underside of her chin shows, her '
                        'head is small near the top edge, and above her head the dark studio ceiling with a softbox '
                        'light now shows instead of the grey backdrop.'),
    'back lo reveal': ('back_lo', 'Shift the viewpoint of the first image around and down to match the mannequin '
                       'reference in the second image: a worm\'s-eye view from just above the grey studio floor '
                       'behind the woman, looking steeply up at her back. She faces away; her heels and the backs of '
                       'her jeans are now large at the bottom of the frame, her back rises and narrows toward the top, '
                       'the back of her head is small near the top edge, and above her the dark studio ceiling with a '
                       'softbox light now shows instead of the grey backdrop.'),
}
MQ19_ZOOM = {}
for _v, _r in (('front hi', 'front_hi'), ('tq fl', 'tq_fl')):
    _t = MQ7_BODY[_v][1].replace(' at the same height and distance', ' at the same height')  # the zoom sets it
    MQ19_ZOOM[_v + ' near'] = (_r + '_near', _t + ' The view is much closer: the person fills most of the '
                               'frame.')
    MQ19_ZOOM[_v + ' far'] = (_r + '_far', _t + ' The view is pulled far back: the person is small in the middle of '
                              'the frame with much more of the place around them.')
MQ19_FACE_KEEP = MQ7_FACE_KEEP.replace('the background, ', '')  # rounds 15-16: the background must change
# round 17: a far view must extend the place, so "the place unchanged" becomes the same setting
MQ19_ZOOM_KEEP = MQ6_KEEP.replace('the place, the light and the image style of the first image unchanged',
                                  'the same place, light and image style as the first image')
MQ19_RUNS = {  # cell -> (source, views, keep, views to run, seeds)
    'man': ('scene input', MQ7_BODY, MQ6_KEEP, MQ7_RUNS['man'][3], (333, 444)),
    'woman': ('body input', MQ7_BODY, MQ6_KEEP, tuple(MQ7_BODY), (333, 444)),
    'woman lo': ('body input', MQ19_STUDIO_LO, MQ6_KEEP, tuple(MQ19_STUDIO_LO), MQ10_SEEDS),
    'face': ('face input', MQ7_FACE, MQ7_FACE_KEEP, ('back', 'tq fl', 'tqb r'), (333, 444)),
    'manface': ('man input', MQ7_FACE, MQ19_FACE_KEEP, ('back', 'tqb r'), MQ10_SEEDS),
    'man zoom': ('scene input', MQ19_ZOOM, MQ19_ZOOM_KEEP, tuple(MQ19_ZOOM), MQ10_SEEDS),
    'woman zoom': ('body input', MQ19_ZOOM, MQ19_ZOOM_KEEP, tuple(MQ19_ZOOM), MQ10_SEEDS),
}


def blender19(port):
    done = os.path.join(OUT, 'mq_blender19.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r7 = json.load(open(os.path.join(OUT, 'mq_blender7.json')))
    srcs = {**json.load(open(os.path.join(OUT, 'pitch.json'))),
            'man input': json.load(open(os.path.join(OUT, 'mq_blender16.json')))['man input']}
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    refs = {k: v for k, v in r7.items() if k.startswith('ref ')}
    for render in [r for r, _ in MQ19_ZOOM.values()]:
        if f'ref {render}' not in res:
            res[f'ref {render}'] = import_ref(port, render, f'angles mq19 ref {render}')
            json.dump(res, open(done, 'w'), indent=1)
    refs.update({k: v for k, v in res.items() if k.startswith('ref ')})
    for name, (srckey, views, keep, run, seeds) in MQ19_RUNS.items():
        for seed in seeds:
            for v in run:
                key = f'{name} {seed} {v}'
                if key not in res:
                    res[key] = gen(port, {**FAST, 'seed': seed, 'positive': views[v][1] + keep,
                                          'cardName': f'angles mq19 {key}',
                                          'media': [{'role': 'inputImage', 'url': srcs[srckey]},
                                                    {'role': 'inputImage2', 'url': refs[f'ref {views[v][0]}']}]})
                    json.dump(res, open(done, 'w'), indent=1)
    # one sheet per source on all 4 seeds: rounds 6-7 cells for 111/222 (and the man's lo/back lo/top2), this round's
    # cells for the rest; a blank cell = never run
    r6 = json.load(open(os.path.join(OUT, 'mq_blender6.json')))
    old = {f'{n} {s} {v}': r7.get(f'{n} {s} {v}') for n in ('man', 'woman', 'face') for s in (111, 222)
           for v in MQ7_BODY | MQ7_FACE}
    old.update({f'man {s} {v}': r6.get(f'{s} grey {v}') for s in MQ10_SEEDS for v in MQ6_VIEWS})
    allres = {**{k: v for k, v in old.items() if v}, **res}
    for sheet, cells in (('man', [('man', v) for v in MQ7_BODY]),
                         ('woman', [('woman', v) for v in MQ7_BODY] + [('woman lo', v) for v in MQ19_STUDIO_LO]),
                         ('face', [('face', v) for v in ('back', 'tq fl', 'tqb r')] +
                          [('manface', v) for v in ('back', 'tqb r')]),
                         ('zoom', [(n, v) for n in ('man zoom', 'woman zoom') for v in MQ19_ZOOM])):
        rows = [[(None, 'seed / ref')] + [(refs[f'ref {MQ19_RUNS[n][1][v][0]}'], f'{n}: {v}') for n, v in cells]]
        rows += [[(None, f'seed {s}')] + [(allres.get(f'{n} {s} {v}'), v) for n, v in cells] for s in MQ10_SEEDS]
        _sheet(rows, f'mq_blender19_{sheet}')


# Round 20 (Fabio 2026-10-24, after round 19): zoom and the man's side views were weak. The edit graph scales the
# mannequin ref to 1 MP at its OWN shape (square) while the output takes picture 1's frame, and the woman's 9:16 source
# was edited at FAST's 4:5 - three shapes in one edit. Here every shape matches: the output ratio = the source's, and
# the square ref is scaled to the source's width and padded to its height with its edge pixels (what Resize Image v2
# 'pad_edge_pixel' would do in the Flow), so the mannequin keeps its size relative to the frame width. Same prompts and
# seeds as round 19 on the zoom + 3/4 cells, so each cell compares straight against round 19.
MQ20_RUNS = {  # cell -> (source, views, keep, ratio)
    'man': ('scene input', {v: MQ7_BODY[v] for v in ('tq fl', 'tq fr')}, MQ6_KEEP, '4:5'),
    'woman': ('body input', {v: MQ7_BODY[v] for v in ('tq fl', 'tq fr')}, MQ6_KEEP, '9:16'),
    'man zoom': ('scene input', MQ19_ZOOM, MQ19_ZOOM_KEEP, '4:5'),
    'woman zoom': ('body input', MQ19_ZOOM, MQ19_ZOOM_KEEP, '9:16'),
}


def _pad_ref(render, size):  # square ref -> source width, edge pixels repeated top and bottom
    import numpy as np
    w, h = size
    im = Image.open(os.path.join(BLENDER_REFS, render + '.png')).convert('RGB').resize((w, w), Image.LANCZOS)
    top = (h - w) // 2
    a = np.pad(np.asarray(im), ((top, h - w - top), (0, 0), (0, 0)), mode='edge')
    rel = f'pad_{w}x{h}/{render}'
    os.makedirs(os.path.dirname(os.path.join(BLENDER_REFS, rel)), exist_ok=True)  # render may be 'doll/<cam>'
    Image.fromarray(a).save(os.path.join(BLENDER_REFS, rel + '.png'))
    return rel


def blender20(port):
    done = os.path.join(OUT, 'mq_blender20.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    srcs = json.load(open(os.path.join(OUT, 'pitch.json')))
    r19 = json.load(open(os.path.join(OUT, 'mq_blender19.json')))
    r7 = json.load(open(os.path.join(OUT, 'mq_blender7.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for name, (srckey, views, keep, ratio) in MQ20_RUNS.items():
        size = Image.open(disk(srcs[srckey])).size
        for v, (render, text) in views.items():
            ref = f'ref {size[0]}x{size[1]} {render}'
            if ref not in res:
                res[ref] = import_ref(port, _pad_ref(render, size), f'angles mq20 {ref}')
                json.dump(res, open(done, 'w'), indent=1)
            for seed in MQ10_SEEDS:
                key = f'{name} {seed} {v}'
                if key not in res:
                    res[key] = gen(port, {**FAST, 'ratio': ratio, 'seed': seed, 'positive': text + keep,
                                          'cardName': f'angles mq20 {key}',
                                          'media': [{'role': 'inputImage', 'url': srcs[srckey]},
                                                    {'role': 'inputImage2', 'url': res[ref]}]})
                    json.dump(res, open(done, 'w'), indent=1)
    # round 19 row (square ref, 4:5 output; man/woman 3/4 seeds 111/222 from round 7) above each round 20 row
    old = lambda n, s, v: r19.get(f'{n} {s} {v}') or (r7.get(f'{n} {s} {v}') if s in (111, 222) else None)
    for sheet, names in (('turns', ('man', 'woman')), ('zoom', ('man zoom', 'woman zoom'))):
        cells = [(n, v) for n in names for v in MQ20_RUNS[n][1]]
        rows = [[(None, 'ref (padded)')] + [(res[f'ref {"x".join(map(str, Image.open(disk(srcs[MQ20_RUNS[n][0]])).size))} '
                                                 f'{MQ20_RUNS[n][1][v][0]}'], f'{n}: {v}') for n, v in cells]]
        for s in MQ10_SEEDS:
            rows.append([(None, f'{s} round 19')] + [(old(n, s, v), v) for n, v in cells])
            rows.append([(None, f'{s} matched')] + [(res.get(f'{n} {s} {v}'), v) for n, v in cells])
        _sheet(rows, f'mq_blender20_{sheet}')


# Round 21 (overnight, after round 20): matching the ref's shape changed nothing, so the zoom ref is not the lever. A
# lens-twin ref is an ABSOLUTE framing (a full body, big or small) while a zoom is RELATIVE to the source (a waist-up
# man zoomed in is a head-and-shoulders). Here zoom lives in the WORDS only: the plain view ref (padded to the source
# size, round 20's rule) + the view end state + a zoom sentence naming where the new frame crops and what newly shows
# (round 15's rule). Same seeds, cells and sizes as round 20, so the sheet compares lens-twin refs vs words.
MQ21_ZOOM = {  # source cell -> {near, far} sentence
    'man zoom': {'near': ' The view is much closer than the first image: his head and shoulders now fill the frame, '
                         'cropped at the chest, and only a little of the street shows around him.',
                 'far': ' The view is pulled far back from the first image: his whole body from head to shoes now '
                        'shows small in the middle of the frame, with the full height of the house fronts above him, '
                        'more of the cobbled street in front of him and the street running on at both sides.'},
    'woman zoom': {'near': ' The view is much closer than the first image: she is cropped at the waist, her head, '
                           'shoulders and turtleneck fill the frame.',
                   'far': ' The view is pulled far back from the first image: she is small in the middle of the frame '
                          'and the whole studio now shows around her - the edges of the grey backdrop paper, light '
                          'stands and softboxes at both sides, and the bare studio floor in front of her.'},
}


def blender21(port):
    done = os.path.join(OUT, 'mq_blender21.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    srcs = json.load(open(os.path.join(OUT, 'pitch.json')))
    r20 = json.load(open(os.path.join(OUT, 'mq_blender20.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    cells = []
    for name, zoom in MQ21_ZOOM.items():
        srckey, _, keep, ratio = MQ20_RUNS[name]
        size = Image.open(disk(srcs[srckey])).size
        for v, render in (('front hi', 'front_hi'), ('tq fl', 'tq_fl')):
            ref = f'ref {size[0]}x{size[1]} {render}'
            if ref not in res:
                res[ref] = r20.get(ref) or import_ref(port, _pad_ref(render, size), f'angles mq21 {ref}')
                json.dump(res, open(done, 'w'), indent=1)
            text = MQ7_BODY[v][1].replace(' at the same height and distance', ' at the same height')
            for z, sentence in zoom.items():
                cells.append((name, f'{v} {z}', ref))
                for seed in MQ10_SEEDS:
                    key = f'{name} {seed} {v} {z}'
                    if key not in res:
                        res[key] = gen(port, {**FAST, 'ratio': ratio, 'seed': seed, 'positive': text + sentence + keep,
                                              'cardName': f'angles mq21 {key}',
                                              'media': [{'role': 'inputImage', 'url': srcs[srckey]},
                                                        {'role': 'inputImage2', 'url': res[ref]}]})
                        json.dump(res, open(done, 'w'), indent=1)
    rows = [[(None, 'ref (padded)')] + [(res[ref], f'{n}: {v}') for n, v, ref in cells]]
    for s in MQ10_SEEDS:
        rows.append([(None, f'{s} lens ref')] + [(r20.get(f'{n} {s} {v}'), v) for n, v, _ in cells])
        rows.append([(None, f'{s} words')] + [(res.get(f'{n} {s} {v}'), v) for n, v, _ in cells])
    _sheet(rows, 'mq_blender21_zoom')


# Round 22 (overnight): Fabio, round 19: "the side view is not that great on the male" - 3/4 turns turn the head, the
# chest stays square. Round 13's object lesson on people: a SUBJECT-SPECIFIC end state (written after looking at the
# source, as the Flow's agent would) naming which of their own things now sit nearest the view, which hide, and how the
# place behind now runs. Plain view ref padded to the source size; same seeds as rounds 19-20.
MQ22_TQ = {
    'man': {
        'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the man to match the mannequin reference in '
                  'the second image: a three-quarter view from in front of him and 45 degrees to his left, at the same '
                  'height and distance. His whole body is now turned at an angle, his chest and hips facing frame-left: '
                  'his left shoulder with the bag strap is nearest the view, his right shoulder and right arm are half '
                  'hidden behind his chest, and his face is seen in three-quarter. Behind him the house fronts now run '
                  'away at a slant toward frame-left, the red door seen at an angle.'),
        'tq fr': ('tq_fr', 'Shift the viewpoint of the first image around the man to match the mannequin reference in '
                  'the second image: a three-quarter view from in front of him and 45 degrees to his right, at the same '
                  'height and distance. His whole body is now turned at an angle, his chest and hips facing '
                  'frame-right: his right shoulder and right arm are nearest the view, his left shoulder with the bag '
                  'strap is half hidden behind his chest, and his face is seen in three-quarter. Behind him the house '
                  'fronts now run away at a slant toward frame-right, the blue bicycle seen at an angle.'),
    },
    'woman': {
        'tq fl': ('tq_fl', 'Shift the viewpoint of the first image around the woman to match the mannequin reference in '
                  'the second image: a three-quarter view from in front of her and 45 degrees to her left, at the same '
                  'height and distance. Her whole body is now turned at an angle, her chest, hips and feet facing '
                  'frame-left: her left shoulder, her left arm with the silver watch and her left ear with the gold '
                  'hoop are nearest the view, her right arm is half hidden behind her body, and her face is seen in '
                  'three-quarter.'),
        'tq fr': ('tq_fr', 'Shift the viewpoint of the first image around the woman to match the mannequin reference in '
                  'the second image: a three-quarter view from in front of her and 45 degrees to her right, at the same '
                  'height and distance. Her whole body is now turned at an angle, her chest, hips and feet facing '
                  'frame-right: her right shoulder and the small brown bag at her right hip are nearest the view, her '
                  'left arm is half hidden behind her body, and her face is seen in three-quarter.'),
    },
}


def blender22(port):
    done = os.path.join(OUT, 'mq_blender22.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    srcs = json.load(open(os.path.join(OUT, 'pitch.json')))
    r20 = json.load(open(os.path.join(OUT, 'mq_blender20.json')))
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    cells = []
    for name, views in MQ22_TQ.items():
        srckey, _, keep, ratio = MQ20_RUNS[name]
        size = Image.open(disk(srcs[srckey])).size
        for v, (render, text) in views.items():
            ref = r20[f'ref {size[0]}x{size[1]} {render}']
            cells.append((name, v, ref))
            for seed in MQ10_SEEDS:
                key = f'{name} {seed} {v}'
                if key not in res:
                    res[key] = gen(port, {**FAST, 'ratio': ratio, 'seed': seed, 'positive': text + keep,
                                          'cardName': f'angles mq22 {key}',
                                          'media': [{'role': 'inputImage', 'url': srcs[srckey]},
                                                    {'role': 'inputImage2', 'url': ref}]})
                    json.dump(res, open(done, 'w'), indent=1)
    rows = [[(None, 'ref (padded)')] + [(ref, f'{n}: {v}') for n, v, ref in cells]]
    for s in MQ10_SEEDS:
        rows.append([(None, f'{s} generic (r20)')] + [(r20.get(f'{n} {s} {v}'), v) for n, v, _ in cells])
        rows.append([(None, f'{s} specific')] + [(res.get(f'{n} {s} {v}'), v) for n, v, _ in cells])
    _sheet(rows, 'mq_blender22_turns')


# Round 23 (Fabio 2026-10-24, after rounds 19-22): every source so far is a PHOTO, and the recipe's words (real person,
# studio, softbox) may pull a 2D source toward a photo. One FLAT ANIME source: the round-7 woman redrawn by Krea2's edit
# with its Retro Anime style LoRA (rack index 6; the graph appends the trigger), two seeds, `sources` stops there to
# pick one. Then the people recipe on it - back eye, tqb r, front hi, front lo with round 19's reveal, tq fl far with
# round 21's zoom words - with a keep clause that holds the DRAWING style instead of "the real person". Refs padded to
# the source size (round 20). The sheet sets the photo cells (rounds 7/19/21, same seeds) above the drawn ones.
MQ23_SOURCE = ('Redraw this photo as a flat 2D anime drawing with clean outlines and flat colours. Keep the same woman, '
               'her dark wavy hair, rust-orange turtleneck, dark blue jeans, white sneakers and brown shoulder bag, her '
               'pose and the plain grey studio backdrop.')
MQ23_PLACE = ('Replace the plain backdrop with a sunny Japanese shopping street: shop fronts with signs and awnings on '
              'both sides, a red vending machine, overhead power lines, the street running away behind her. Keep the '
              'same woman, her hair, clothes, bag, pose and full-body framing, and the flat anime drawing style.')
MQ23_VIEWS = {
    **{v: MQ7_BODY[v] for v in ('back eye', 'tqb r', 'front hi')},
    # round 19's reveal and round 21's far words, rewritten for the street Krea2 put her on (street 222)
    'front lo reveal': ('front_lo', 'Shift the viewpoint of the first image down to match the mannequin reference in '
                        'the second image: a worm\'s-eye view from just above the street surface in front of the '
                        'woman, looking steeply up at her. Her white sneakers and jeans are now large at the bottom of '
                        'the frame, her body rises and narrows toward the top, the underside of her chin shows, her '
                        'head is small near the top edge, and above her the open blue sky with the power lines and the '
                        'shop signs now fills the background, the shop fronts leaning inward at both sides.'),
    'tq fl far': ('tq_fl', MQ7_BODY['tq fl'][1].replace(' at the same height and distance', ' at the same height') +
                  ' The view is pulled far back from the first image: her whole body from head to sneakers now shows '
                  'small in the middle of the frame, with the full height of the shop fronts and their signs at both '
                  'sides, much more of the street in front of her and the street running on behind her.'),
}
MQ23_KEEP = (' Take only the viewing angle from the mannequin reference. The subject is still the same drawn anime '
             'woman from the first image, with her own head and hair, hands, clothes and shoes; keep her identity, pose, '
             'the place and the flat 2D anime drawing style of the first image - clean outlines, flat colours - '
             'unchanged. It stays a drawing, not a photo.')
MQ23_ZOOM_KEEP = (' Take only the viewing angle from the mannequin reference. The subject is still the same drawn anime '
                  'woman from the first image, with her own head and hair, hands, clothes and shoes; keep her identity '
                  'and pose, and the same place and flat 2D anime drawing style as the first image - clean outlines, '
                  'flat colours. It stays a drawing, not a photo.')


def blender23(port, pick):
    done = os.path.join(OUT, 'mq_blender23.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    photo = json.load(open(os.path.join(OUT, 'pitch.json')))['body input']
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for seed in (111, 222):
        key = f'anime {seed}'
        if key not in res:
            res[key] = gen(port, {'modelId': 'krea2', 'operation': 'krea2Edit', 'turbo': True, 'styleSelect': 6,
                                  'seed': seed, 'positive': MQ23_SOURCE, 'cardName': f'angles mq23 {key}',
                                  'media': [{'role': 'inputImage', 'url': photo}]})
            json.dump(res, open(done, 'w'), indent=1)
    if pick == 'sources':
        _sheet([[(photo, 'photo source'), (res['anime 111'], 'anime 111'), (res['anime 222'], 'anime 222')]],
               'mq_blender23_sources')
        return
    for seed in (111, 222):  # Fabio: a place behind her is the harder test - put anime 111 on a street
        key = f'street {seed}'
        if key not in res:
            res[key] = gen(port, {'modelId': 'krea2', 'operation': 'krea2Edit', 'turbo': True, 'styleSelect': 6,
                                  'seed': seed, 'positive': MQ23_PLACE, 'cardName': f'angles mq23 {key}',
                                  'media': [{'role': 'inputImage', 'url': res['anime 111']}]})
            json.dump(res, open(done, 'w'), indent=1)
    if pick == 'street':
        _sheet([[(res['anime 111'], 'anime 111'), (res['street 111'], 'street 111'),
                 (res['street 222'], 'street 222')]], 'mq_blender23_street')
        return
    src = res[pick]
    size = Image.open(disk(src)).size
    r20 = json.load(open(os.path.join(OUT, 'mq_blender20.json')))
    for v, (render, text) in MQ23_VIEWS.items():
        ref = f'ref {size[0]}x{size[1]} {render}'
        if ref not in res:
            res[ref] = r20.get(ref) or import_ref(port, _pad_ref(render, size), f'angles mq23 {ref}')
            json.dump(res, open(done, 'w'), indent=1)
        keep = MQ23_ZOOM_KEEP if v.endswith('far') else MQ23_KEEP
        for seed in MQ10_SEEDS:
            key = f'{pick} {seed} {v}'
            if key not in res:
                res[key] = gen(port, {**FAST, 'ratio': '9:16', 'seed': seed, 'positive': text + keep,
                                      'cardName': f'angles mq23 {key}',
                                      'media': [{'role': 'inputImage', 'url': src},
                                                {'role': 'inputImage2', 'url': res[ref]}]})
                json.dump(res, open(done, 'w'), indent=1)
    # photo cells on the same seeds: rounds 7 (111/222) + 19 (333/444) for the plain views, 19 for the reveal low,
    # 21 for the zoom words
    r7, r19, r21 = (json.load(open(os.path.join(OUT, f'mq_blender{n}.json'))) for n in (7, 19, 21))
    photo_cell = {'front lo reveal': lambda s: r19.get(f'woman lo {s} front lo reveal'),
                  'tq fl far': lambda s: r21.get(f'woman zoom {s} tq fl far')}
    old = lambda s, v: photo_cell[v](s) if v in photo_cell else (r7 if s in (111, 222) else r19).get(f'woman {s} {v}')
    rows = [[(photo, 'photo source'), (src, f'{pick} source (anime)')],
            [(None, 'ref (padded)')] + [(res[f'ref {size[0]}x{size[1]} {r}'], v) for v, (r, _) in MQ23_VIEWS.items()]]
    for s in MQ10_SEEDS:
        rows.append([(None, f'{s} photo (studio)')] + [(old(s, v), v) for v in MQ23_VIEWS])
        rows.append([(None, f'{s} anime')] + [(res.get(f'{pick} {s} {v}'), v) for v in MQ23_VIEWS])
    _sheet(rows, 'mq_blender23_anime')


# Round 24 (Fabio 2026-10-24, after round 23): the UE mannequin's bald head and jointed limbs got pasted on the 2D back
# views. His unisex ControlNet doll instead (blender/doll_build.py: his OBJ export of Body_Full_01 in a natural pose,
# skin tone so it stands off the walls, fitted to the mannequin's height in the same scene -> out/doll/<cam>.png).
# The round-23 back views on the anime street + the low view (the ref with the most body in it), and the photo woman's
# back views, same words and seeds; the grey-mannequin cells sit above for comparison.
MQ24_RUNS = {  # cell -> (source, views, keep, ratio)
    'anime': ('street 222', {v: MQ23_VIEWS[v] for v in ('back eye', 'tqb r', 'front lo reveal')}, MQ23_KEEP, '9:16'),
    'photo': ('body input', {v: MQ7_BODY[v] for v in ('back eye', 'tqb r')}, MQ6_KEEP, '9:16'),
}


def blender24(port):
    done = os.path.join(OUT, 'mq_blender24.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r23 = json.load(open(os.path.join(OUT, 'mq_blender23.json')))
    srcs = {**json.load(open(os.path.join(OUT, 'pitch.json'))), 'street 222': r23['street 222']}
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    cells = []
    for name, (srckey, views, keep, ratio) in MQ24_RUNS.items():
        size = Image.open(disk(srcs[srckey])).size
        for v, (render, text) in views.items():
            ref = f'ref {size[0]}x{size[1]} doll/{render}'
            if ref not in res:
                res[ref] = import_ref(port, _pad_ref(f'doll/{render}', size), f'angles mq24 {ref}')
                json.dump(res, open(done, 'w'), indent=1)
            cells.append((name, v, ref))
            for seed in MQ10_SEEDS:
                key = f'{name} {seed} {v}'
                if key not in res:
                    res[key] = gen(port, {**FAST, 'ratio': ratio, 'seed': seed, 'positive': text + keep,
                                          'cardName': f'angles mq24 {key}',
                                          'media': [{'role': 'inputImage', 'url': srcs[srckey]},
                                                    {'role': 'inputImage2', 'url': res[ref]}]})
                    json.dump(res, open(done, 'w'), indent=1)
    # grey mannequin cells: round 23 for the anime street, rounds 7 (111/222) + 19 (333/444) for the photo woman
    r7, r19 = (json.load(open(os.path.join(OUT, f'mq_blender{n}.json'))) for n in (7, 19))
    old = {'anime': lambda s, v: r23.get(f'street 222 {s} {v}'),
           'photo': lambda s, v: (r7 if s in (111, 222) else r19).get(f'woman {s} {v}')}
    rows = [[(None, 'doll ref (padded)')] + [(res[ref], f'{n}: {v}') for n, v, ref in cells]]
    for s in MQ10_SEEDS:
        rows.append([(None, f'{s} UE mannequin')] + [(old[n](s, v), v) for n, v, _ in cells])
        rows.append([(None, f'{s} doll')] + [(res.get(f'{n} {s} {v}'), v) for n, v, _ in cells])
    _sheet(rows, 'mq_blender24_doll')


# Round 25 (after round 24): on the 2D street the turns move HER but the street stays pixel-for-pixel. Round 15's reveal
# rule applied to turns: the end state names what the PLACE now shows from the new side. Read off street 222: red
# vending machine + blue awning on frame-left (her right), pink awning + yellow sign board + power pole on frame-right
# (her left), the street running away behind her. Doll refs, MQ23_KEEP, round 24's cells above.
MQ25_VIEWS = {
    'back eye': ('back_eye', MQ5['back eye'][1].replace(
        ', and the place around them is seen from the opposite side.',
        '. The street is now seen from the other end: in front of her it runs away into the distance, the part of the '
        'street that was behind the first image\'s viewpoint, with new shop fronts and signs on both sides. The red '
        'vending machine and the blue awning are now on the right of the frame, the pink awning, the yellow sign board '
        'and the power pole on the left of the frame.')),
    'tqb r': ('tq_br', _tqb('right', 'frame-right').replace(
        '; the place around them is seen from that angle.',
        '. The street is now seen at a slant from her right side: behind her the shop fronts on her left, with the '
        'pink awning and the yellow sign board, fill the background seen at an angle, the street running on toward '
        'frame-right; the red vending machine is no longer in view.')),
    'tq fl': ('tq_fl', _tq('left', 'left', 'frame-left').replace(
        '; the place around them is seen from that angle.',
        '. The street is now seen at a slant from her left side: behind her the shop fronts on her right, with the '
        'red vending machine and the blue awning, fill the background seen at an angle, the street running away '
        'toward frame-right; the pink awning and the yellow sign board are no longer in view.')),
}


def blender25(port):
    done = os.path.join(OUT, 'mq_blender25.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r23, r24 = (json.load(open(os.path.join(OUT, f'mq_blender{n}.json'))) for n in (23, 24))
    src = r23['street 222']
    size = Image.open(disk(src)).size
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for v, (render, text) in MQ25_VIEWS.items():
        ref = f'ref {size[0]}x{size[1]} doll/{render}'
        if ref not in res:
            res[ref] = r24.get(ref) or import_ref(port, _pad_ref(f'doll/{render}', size), f'angles mq25 {ref}')
            json.dump(res, open(done, 'w'), indent=1)
        for seed in MQ10_SEEDS:
            key = f'street 222 {seed} {v}'
            if key not in res:
                res[key] = gen(port, {**FAST, 'ratio': '9:16', 'seed': seed, 'positive': text + MQ23_KEEP,
                                      'cardName': f'angles mq25 {key}',
                                      'media': [{'role': 'inputImage', 'url': src},
                                                {'role': 'inputImage2', 'url': res[ref]}]})
                json.dump(res, open(done, 'w'), indent=1)
    # round 24 (doll, plain turn words) above; round 24 has no tq fl - round 23's tq fl far (grey mannequin) stands in
    old = lambda s, v: r24.get(f'anime {s} {v}') if v != 'tq fl' else r23.get(f'street 222 {s} tq fl far')
    rows = [[(src, 'street 222 source')] + [(res[f'ref {size[0]}x{size[1]} doll/{r}'], v)
                                             for v, (r, _) in MQ25_VIEWS.items()]]
    for s in MQ10_SEEDS:
        rows.append([(None, f'{s} r24 plain')] + [(old(s, v), v if v != 'tq fl' else 'tq fl far (r23)')
                                                  for v in MQ25_VIEWS])
        rows.append([(None, f'{s} r25 reveal')] + [(res.get(f'street 222 {s} {v}'), v) for v in MQ25_VIEWS])
    _sheet(rows, 'mq_blender25_turn_reveal')


# Round 26 (Fabio 2026-10-24, after round 25): the 3/4 FRONT turn undershoots (asked 45 deg, lands ~15-20 since rounds
# 7/19/22). Overshoot REF only: the doll seen from 65 and 80 deg (blender/overshoot_build.py -> out/doll/tq_fl_<deg>),
# the words unchanged (45 deg). The anime street with round 25's reveal words, the photo woman with round 7's; the
# 45-deg cells (round 25 / rounds 7+19) sit above.
MQ26_RUNS = {  # cell -> (source, words, keep)
    'anime': ('street 222', MQ25_VIEWS['tq fl'][1], MQ23_KEEP),
    'photo': ('body input', MQ7_BODY['tq fl'][1], MQ6_KEEP),
}


def blender26(port):
    done = os.path.join(OUT, 'mq_blender26.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r7, r19, r23, r25 = (json.load(open(os.path.join(OUT, f'mq_blender{n}.json'))) for n in (7, 19, 23, 25))
    srcs = {**json.load(open(os.path.join(OUT, 'pitch.json'))), 'street 222': r23['street 222']}
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for name, (srckey, text, keep) in MQ26_RUNS.items():
        size = Image.open(disk(srcs[srckey])).size
        for deg in (65, 80):
            ref = f'ref {size[0]}x{size[1]} doll/tq_fl_{deg}'
            if ref not in res:
                res[ref] = import_ref(port, _pad_ref(f'doll/tq_fl_{deg}', size), f'angles mq26 {ref}')
                json.dump(res, open(done, 'w'), indent=1)
            for seed in MQ10_SEEDS:
                key = f'{name} {seed} tq fl {deg}'
                if key not in res:
                    res[key] = gen(port, {**FAST, 'ratio': '9:16', 'seed': seed, 'positive': text + keep,
                                          'cardName': f'angles mq26 {key}',
                                          'media': [{'role': 'inputImage', 'url': srcs[srckey]},
                                                    {'role': 'inputImage2', 'url': res[ref]}]})
                    json.dump(res, open(done, 'w'), indent=1)
    at45 = {'anime': lambda s: r25.get(f'street 222 {s} tq fl'),
            'photo': lambda s: (r7 if s in (111, 222) else r19).get(f'woman {s} tq fl')}
    sizes = {n: Image.open(disk(srcs[k])).size for n, (k, _, _) in MQ26_RUNS.items()}
    rows = [[(srcs[k], f'{n} source') for n, (k, _, _) in MQ26_RUNS.items()],
            [(None, 'doll ref (padded)')] + [(res[f'ref {sizes[n][0]}x{sizes[n][1]} doll/tq_fl_{d}'], f'{n} {d} deg')
                                             for n in MQ26_RUNS for d in (65, 80)]]
    for s in MQ10_SEEDS:
        rows.append([(None, f'{s}')] + [(at45[n](s), f'{n} 45 (old)') for n in MQ26_RUNS] +
                    [(res.get(f'{n} {s} tq fl {d}'), f'{n} {d}') for n in MQ26_RUNS for d in (65, 80)])
    _sheet(rows, 'mq_blender26_overshoot')


# Round 27 (Fabio 2026-10-24, after round 26): the overshoot goes in the WORDS, as zoom did in round 21 - the 45-deg
# doll ref, and an end state that names a turn well past three-quarter (the body side-on, the far shoulder hidden), so
# the edit's undershoot lands nearer 45. Same sources, keeps and seeds as round 26.
_TURN27 = ('Shift the viewpoint of the first image around the subject to match the mannequin reference in the second '
           'image: the camera has moved a long way round to her left, so she is now seen from her left side. Her whole '
           'body is turned well away from the view, almost side-on, facing frame-left: her left shoulder, left arm, left '
           'hip and left leg are nearest the view, her right shoulder is hidden behind her chest, her feet point toward '
           'frame-left, and her face is seen in three-quarter profile with the far eye barely showing.')
MQ27_RUNS = {  # cell -> (source, words, keep)
    'anime': ('street 222', _TURN27 + MQ25_VIEWS['tq fl'][1].split('three-quarter.', 1)[1], MQ23_KEEP),
    'photo': ('body input', _TURN27 + ' The place around her is seen from that angle.', MQ6_KEEP),
}


def blender27(port):
    done = os.path.join(OUT, 'mq_blender27.json')
    res = json.load(open(done)) if os.path.exists(done) else {}
    r7, r19, r23, r24, r25, r26 = (json.load(open(os.path.join(OUT, f'mq_blender{n}.json')))
                                   for n in (7, 19, 23, 24, 25, 26))
    srcs = {**json.load(open(os.path.join(OUT, 'pitch.json'))), 'street 222': r23['street 222']}
    if not os.environ.get('MPI_KANBAN_GPU_SLOT'):
        sys.exit('no GPU lease - run under gpu_lease.py run --poll 2 --')
    for name, (srckey, text, keep) in MQ27_RUNS.items():
        size = Image.open(disk(srcs[srckey])).size
        ref = f'ref {size[0]}x{size[1]} doll/tq_fl'
        if ref not in res:
            res[ref] = r25.get(ref) or r24.get(ref) or import_ref(port, _pad_ref('doll/tq_fl', size), f'angles mq27 {ref}')
            json.dump(res, open(done, 'w'), indent=1)
        for seed in MQ10_SEEDS:
            key = f'{name} {seed} tq fl side'
            if key not in res:
                res[key] = gen(port, {**FAST, 'ratio': '9:16', 'seed': seed, 'positive': text + keep,
                                      'cardName': f'angles mq27 {key}',
                                      'media': [{'role': 'inputImage', 'url': srcs[srckey]},
                                                {'role': 'inputImage2', 'url': res[ref]}]})
                json.dump(res, open(done, 'w'), indent=1)
    at45 = {'anime': lambda s: r25.get(f'street 222 {s} tq fl'),
            'photo': lambda s: (r7 if s in (111, 222) else r19).get(f'woman {s} tq fl')}
    rows = [[(srcs[k], f'{n} source') for n, (k, _, _) in MQ27_RUNS.items()]]
    for s in MQ10_SEEDS:
        rows.append([(None, f'{s}')] + [c for n in MQ27_RUNS for c in
                                         ((at45[n](s), f'{n} 45 words'), (res.get(f'{n} {s} tq fl side'), f'{n} side words'))])
    _sheet(rows, 'mq_blender27_turn_words')


if __name__ == '__main__':
    if sys.argv[1:2] == ['best']:
        best()
    elif sys.argv[2:3] == ['blender27']:
        blender27(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender26']:
        blender26(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender25']:
        blender25(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender24']:
        blender24(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender23']:
        blender23(int(sys.argv[1]), ' '.join(sys.argv[3:]) or 'street 222')
    elif sys.argv[2:3] == ['blender22']:
        blender22(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender21']:
        blender21(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender20']:
        blender20(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender19']:
        blender19(int(sys.argv[1]))
    elif sys.argv[2:3] == ['sweep']:
        sweep(int(sys.argv[1]))
    elif sys.argv[2:3] == ['sweep2']:
        sweep2(int(sys.argv[1]))
    elif sys.argv[2:3] == ['lora']:
        lora(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender18']:
        blender18(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender17']:
        blender17(int(sys.argv[1]), sys.argv[3:4] == ['sources'])
    elif sys.argv[2:3] == ['blender16']:
        blender16(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender15']:
        blender15(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender14']:
        blender14(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender13']:
        blender13(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender12']:
        blender12(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender11']:
        blender11(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender10']:
        blender10(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender9']:
        blender9(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender8']:
        blender8(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender7']:
        blender7(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender6']:
        blender6(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender5']:
        blender5(int(sys.argv[1]))
    elif sys.argv[2:3] == ['blender']:
        blender(int(sys.argv[1]), *sys.argv[3:4])
    elif sys.argv[2:3] == ['mannequin2']:
        mannequin2(int(sys.argv[1]), sys.argv[3:4] == ['edits'])
    elif sys.argv[2:3] == ['mannequin']:
        mannequin(int(sys.argv[1]), sys.argv[3:4] == ['edits'])
    elif sys.argv[2:3] == ['short_pass']:
        short_pass(int(sys.argv[1]))
    elif sys.argv[2:3] == ['two_pass']:
        two_pass(int(sys.argv[1]))
    elif sys.argv[2:3] == ['rotate_low']:
        rotate_low(int(sys.argv[1]))
    elif sys.argv[2:3] == ['rotate_pitch']:
        rotate_pitch(int(sys.argv[1]))
    elif sys.argv[2:3] == ['rotate_seeds']:
        rotate_seeds(int(sys.argv[1]))
    elif sys.argv[2:3] == ['rotate']:
        rotate(int(sys.argv[1]))
    elif sys.argv[2:3] == ['pitch']:
        pitch(int(sys.argv[1]))
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
