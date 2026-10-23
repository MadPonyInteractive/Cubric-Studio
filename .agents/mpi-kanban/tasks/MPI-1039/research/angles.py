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


if __name__ == '__main__':
    if sys.argv[1:2] == ['best']:
        best()
    elif sys.argv[2:3] == ['sweep']:
        sweep(int(sys.argv[1]))
    elif sys.argv[2:3] == ['sweep2']:
        sweep2(int(sys.argv[1]))
    elif sys.argv[2:3] == ['lora']:
        lora(int(sys.argv[1]))
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
