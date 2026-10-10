"""MPI-1060 Phase 2b layout bench: several separate pictures composed into ONE Ingredients sheet, then run through the
two-stage variant-A graph (two_stage_run.py). The layout copies Lightricks' example sheet: justified ROWS on black,
characters in the top row (taller), settings/props below, every picture CONTAINED (never cropped), thin black gutters.
This is the prototype of the app's composer (D3); the sharp module ports compose() as-is if the clips hold.

usage (repo root, bench :8188 up, ONLY under the lease; the bench python has PIL):
  python <mpi-lib>/scripts/gpu_lease.py run --timeout 14400 --poll 2 -- G:/ComfyUi/python_embeded/python.exe -I <this file> <case> [...]
  <this file> --compose   writes every sheet + a preview, no POST
"""
import os, sys
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import two_stage_run as ts  # noqa: E402
from ingredients_run import FISHER  # noqa: E402

IN = 'G:/ComfyUi/ComfyUI/input'
W, H = 1920, 1024           # 2x the 960x512 output; the graph pads/resizes to the output size
GUT = 12                    # black gutter, ~0.6% of the width (the example: 6 px at 1088)
TOP = 0.6                   # share of the height the character row asks for when there are other rows


def compose_fill(rows, pad=(128, 128, 128)):
    """Lightricks' example shape: cells TILE the canvas edge to edge (black only in the gutters). Each row fills the
    width with cells sized by its pictures' aspects, rows share the height by their natural heights, and each picture
    sits CONTAINED in its cell on a neutral grey card. Same return shape as compose()."""
    n = len(rows)
    nat = [(W - GUT * (len(row) + 1)) / sum(im.width / im.height for im in row) for row in rows]
    k = (H - GUT * (n + 1)) / sum(nat)
    sheet = Image.new('RGB', (W, H), (0, 0, 0))
    boxes, y = [], GUT
    for r, (row, h) in enumerate(zip(rows, nat)):
        ch, x = round(h * k), GUT
        for c, im in enumerate(row):
            cw = round(h * im.width / im.height)
            sheet.paste(Image.new('RGB', (cw, ch), pad), (x, y))
            s = min(cw / im.width, ch / im.height)
            w, hh = round(im.width * s), round(im.height * s)
            sheet.paste(im.convert('RGB').resize((w, hh), Image.LANCZOS), (x + (cw - w) // 2, y + (ch - hh) // 2))
            boxes.append((r, c, x, y, cw, ch))
            x += cw + GUT
        y += ch + GUT
    return sheet, boxes


def trim(im, tol=24, keep=0.02):
    """Cut a flat studio border (the corner colour) off a picture, leaving a thin margin. Content is never cut."""
    from PIL import ImageChops
    im = im.convert('RGB')
    bg = Image.new('RGB', im.size, im.getpixel((0, 0)))
    box = ImageChops.difference(im, bg).convert('L').point(lambda v: 255 if v > tol else 0).getbbox()
    if not box:
        return im
    m = round(keep * max(im.size))
    return im.crop((max(0, box[0] - m), max(0, box[1] - m), min(im.width, box[2] + m), min(im.height, box[3] + m)))


def _trees(ids, asp, memo):
    """Every slicing arrangement of `ids`: (aspect, tree). Side by side adds aspects; stacked adds 1/aspects. A
    slicing tree of exact-aspect cells has NO padding inside, so only its outer shape can miss the canvas."""
    key = frozenset(ids)
    if key in memo:
        return memo[key]
    if len(ids) == 1:
        a = asp[ids[0]]
        # a list = a CROPPABLE leaf (a setting): any centre crop keeping >= 60% of its area
        memo[key] = [(a * f, (ids[0], a * f)) for f in (0.6, 0.7, 0.8, 0.9, 1, 1.12, 1.25, 1.43, 1.67)] \
            if ids[0] in CROPPABLE[0] else [(a, ids[0])]
        return memo[key]
    out, first, rest = {}, ids[0], ids[1:]
    for mask in range(2 ** len(rest)):  # every split; `first` always on side A, so each split is seen once
        a = [first] + [x for j, x in enumerate(rest) if mask >> j & 1]
        b = [x for j, x in enumerate(rest) if not mask >> j & 1]
        if not b:
            continue
        for ra, ta in _trees(a, asp, memo):
            for rb, tb in _trees(b, asp, memo):
                for r, t in ((ra + rb, ('H', ta, tb)), (1 / (1 / ra + 1 / rb), ('V', ta, tb))):
                    out.setdefault(round(r, 2), (r, t))  # ponytail: one tree per aspect bucket keeps n<=6 instant
    memo[key] = list(out.values())
    return memo[key]


CROPPABLE = [set()]  # ponytail: module-level switch for the bench; the app passes roles explicitly


def _leaf(t):
    return not isinstance(t, tuple) or not isinstance(t[0], str)


def _share(t, asp, chars):
    """Fraction of the composite's area the character pictures get."""
    if _leaf(t):
        return 1.0 if (t if not isinstance(t, tuple) else t[0]) in chars else 0.0
    kind, a, b = t
    ra, rb = _aspect(a, asp), _aspect(b, asp)
    wa = ra / (ra + rb) if kind == 'H' else (1 / ra) / (1 / ra + 1 / rb)
    return wa * _share(a, asp, chars) + (1 - wa) * _share(b, asp, chars)


def _shares(t, asp, f=1.0, out=None):
    """Each picture's fraction of the composite's area."""
    out = {} if out is None else out
    if _leaf(t):
        out[t if not isinstance(t, tuple) else t[0]] = f
        return out
    kind, a, b = t
    ra, rb = _aspect(a, asp), _aspect(b, asp)
    wa = ra / (ra + rb) if kind == 'H' else (1 / ra) / (1 / ra + 1 / rb)
    _shares(a, asp, f * wa, out)
    return _shares(b, asp, f * (1 - wa), out)


def _score(rt, asp, chars, C, fair=0.6):
    """Coverage, but no picture may drop below `fair` of its fair share (characters count double): packing for
    coverage alone shrinks a full-body view to a thumbnail and blows a prop up to half the sheet."""
    r, t = rt
    w = {i: 2 if i in chars else 1 for i in range(len(asp))}
    sh = _shares(t, asp)
    worst = min(s / (w[i] / sum(w.values())) for i, s in sh.items())
    people = sum(s for i, s in sh.items() if i in chars) if chars else 1.0
    # identity is the op's whole point: characters keep >= 45% of the sheet
    return min(r / C, C / r) * min(1.0, worst / fair) * min(1.0, people / 0.45)


def _aspect(t, asp):
    if _leaf(t):
        return asp[t] if not isinstance(t, tuple) else t[1]
    kind, a, b = t
    ra, rb = _aspect(a, asp), _aspect(b, asp)
    return ra + rb if kind == 'H' else 1 / (1 / ra + 1 / rb)


def compose_pack(pics, chars=1, min_share=0.4, pad=(128, 128, 128), do_trim=True, croppable=()):
    """pics: PIL images, the first `chars` are characters. Searches every slicing tree for the shape closest to the
    canvas while characters keep >= min_share of the area, then STRETCHES it to the canvas (no black margins: the
    leftover becomes thin grey card edges spread over every cell). `croppable` = indices of settings that may be
    centre-cropped (>= 60% kept) to fill their cell. Returns (sheet, coverage, tree)."""
    CROPPABLE[0] = set(croppable)
    pics = [trim(p) if do_trim else p.convert('RGB') for p in pics]
    asp = [p.width / p.height for p in pics]
    C, ch = W / H, set(range(chars))
    best = max(_trees(list(range(len(pics))), asp, {}), key=lambda rt: _score(rt, asp, ch, C))
    sheet, area, boxes = Image.new('RGB', (W, H), (0, 0, 0)), [0], {}

    def place(t, x, y, w, h):
        if _leaf(t):
            boxes[t if not isinstance(t, tuple) else t[0]] = (x, y, w, h)
        if _leaf(t) and isinstance(t, tuple):  # croppable: centre-crop to the cell, then fill it
            im, a = pics[t[0]], w / h
            cw, chh = (im.width, im.width / a) if im.width / im.height < a else (im.height * a, im.height)
            l, u = (im.width - cw) / 2, (im.height - chh) / 2
            sheet.paste(im.crop((round(l), round(u), round(l + cw), round(u + chh))).resize((round(w), round(h)), Image.LANCZOS),
                        (round(x), round(y)))
            area[0] += round(w) * round(h)
            return
        if _leaf(t):
            im = pics[t]
            sheet.paste(Image.new('RGB', (round(w), round(h)), pad), (round(x), round(y)))
            s = min(w / im.width, h / im.height)
            pw, ph = round(im.width * s), round(im.height * s)
            sheet.paste(im.resize((pw, ph), Image.LANCZOS), (round(x + (w - pw) / 2), round(y + (h - ph) / 2)))
            area[0] += pw * ph
            return
        kind, a, b = t
        if _share(b, asp, ch) > _share(a, asp, ch):  # characters go first: left / top
            a, b = b, a
        ra, rb = _aspect(a, asp), _aspect(b, asp)
        if kind == 'H':
            wa = (w - GUT) * ra / (ra + rb)
            place(a, x, y, wa, h)
            place(b, x + wa + GUT, y, w - wa - GUT, h)
        else:
            ha = (h - GUT) * (1 / ra) / (1 / ra + 1 / rb)
            place(a, x, y, w, ha)
            place(b, x, y + ha + GUT, w, h - ha - GUT)

    place(best[1], GUT, GUT, W - 2 * GUT, H - 2 * GUT)
    return sheet, area[0] / (W * H), best[1], [boxes[i] for i in range(len(pics))]


def where(box):
    """A cell's name for the preamble from its centre: 'Top Far Right Panel', 'Left Panel'."""
    x, y, w, h = box
    cx, cy = (x + w / 2) / W, (y + h / 2) / H
    v = '' if h > 0.8 * H else 'Top ' if cy < 0.4 else 'Bottom ' if cy > 0.6 else 'Middle '
    hz = '' if w > 0.8 * W else ['Far Left ', 'Left ', 'Centre ', 'Right ', 'Far Right '][min(4, int(cx * 5))]
    return f'{v}{hz}Panel'


def compose(rows):
    """rows: lists of PIL images, top row = characters. Returns the sheet and each cell's box (row, col, x, y, w, h)."""
    n = len(rows)
    avail = H - GUT * (n + 1)
    shares = [1.0] if n == 1 else [TOP] + [(1 - TOP) / (n - 1)] * (n - 1)
    fitted = []
    for row, share in zip(rows, shares):
        h = share * avail
        ws = [h * im.width / im.height for im in row]
        room = W - GUT * (len(row) + 1)
        if sum(ws) > room:  # a too-wide row shrinks, never crops
            h, ws = h * room / sum(ws), [w * room / sum(ws) for w in ws]
        fitted.append((round(h), [round(w) for w in ws]))
    sheet = Image.new('RGB', (W, H), (0, 0, 0))
    y = (H - sum(h for h, _ in fitted) - GUT * (n - 1)) // 2  # the block is centred; leftover height stays black
    boxes = []
    for r, (row, (h, ws)) in enumerate(zip(rows, fitted)):
        x = (W - sum(ws) - GUT * (len(ws) - 1)) // 2
        for c, (im, w) in enumerate(zip(row, ws)):
            sheet.paste(im.convert('RGB').resize((w, h), Image.LANCZOS), (x, y))
            boxes.append((r, c, x, y, w, h))
            x += w + GUT
        y += h + GUT
    return sheet, boxes


def label(r, c, nrows, ncols):
    """The preamble's cell names, in the example's own words ("Top Row Left", "Bottom Row Right")."""
    row = 'Top Row' if r == 0 else 'Bottom Row' if r == nrows - 1 else 'Middle Row'
    if nrows == 1:
        row = 'Panel'
    col = '' if ncols == 1 else ' ' + (['Left', 'Right'] if ncols == 2 else ['Left', 'Middle', 'Right'])[c] if ncols <= 3 else f' {c + 1}'
    return row + col


def open_in(name, box=None):
    im = Image.open(f'{IN}/{name}')
    return im.crop(box) if box else im


EX = 'mpi1060_ingredients_example.jpg'
WOMAN_SHEET = 'mpi1042art_cafe2_sheet.png'
FISHER_SHEET = 'mpi1042art_fisher_sheet.png'

PICS = {
    'woman': lambda: open_in(WOMAN_SHEET),
    'backpack': lambda: open_in(EX, (528, 7, 1080, 276)),
    # Fabio 2026-10-10: a prop sheet carries three views (front, side/three-quarter, back), never four
    'backpack3': lambda: open_in(EX, (532, 7, 940, 276)),
    'mountains': lambda: open_in(EX, (8, 444, 375, 599)),
    'fisher': lambda: open_in(FISHER_SHEET),
    'fisher_front': lambda: open_in(FISHER_SHEET, (0, 0, 450, 1120)),
    'fisher_close': lambda: open_in(FISHER_SHEET, (896, 0, 1792, 1120)),
    'woman_front': lambda: open_in(WOMAN_SHEET, (0, 0, 448, 1120)),
    'woman_back': lambda: open_in(WOMAN_SHEET, (448, 0, 896, 1120)),
    'woman_close': lambda: open_in(WOMAN_SHEET, (896, 0, 1792, 1120)),
    'village': lambda: open_in('mpi1038_village_x1_00001_.png'),
}
DESC = {
    'woman': '(Character):** A woman in her late thirties with shoulder-length wavy copper-red hair and freckles, shown from the '
             'front, from behind and in a face close-up. She wears an olive-green cotton utility jacket over a mustard-yellow ribbed '
             'sweater, olive-green straight-leg trousers and brown leather boots.',
    'backpack': '(Prop - Backpack):** A large blue hiking backpack with an external silver metal frame, side and top pouches, black '
                'adjustable straps and a brown leather patch near the bottom.',
    'backpack3': '(Prop - Backpack):** A large blue hiking backpack with an external silver metal frame, side and top pouches, '
                 'black adjustable straps and a brown leather patch near the bottom.',
    'mountains': '(Setting - Landscape):** A sweeping mountain landscape: a dirt path winding through green rocky slopes toward '
                 'snow-capped peaks under a bright blue sky with white clouds.',
    'fisher': '(Character):** A stylised 3D animated old fisherman with a big round red nose, rosy cheeks, bushy white eyebrows and a '
              'long fluffy white beard, shown from the front, from behind and in a face close-up. He wears a red knitted beanie, a '
              'mustard-yellow wool suit jacket with brown buttons, matching trousers and brown shoes.',
    'fisher_front': '(Character - Front View):** A stylised 3D animated old fisherman with a big round red nose, rosy cheeks and a long '
                    'fluffy white beard, in a red knitted beanie, a mustard-yellow wool suit jacket with brown buttons, matching '
                    'trousers and brown shoes.',
    'fisher_close': '(Character - Close-up):** A close-up of the same fisherman\'s face: big round nose, warm brown eyes, deep smile '
                    'lines, white moustache and beard, red ribbed beanie.',
    'woman_front': '(Character - Front View):** A woman in her late thirties with shoulder-length wavy copper-red hair and freckles, '
                   'in an olive-green cotton utility jacket over a mustard-yellow ribbed sweater, olive-green straight-leg trousers '
                   'and brown leather boots.',
    'woman_close': '(Character - Close-up):** A close-up of the same woman\'s face: green eyes, freckles across the nose and cheeks, '
                   'a warm closed-mouth smile, copper-red waves, the olive jacket collar over the mustard sweater.',
    'woman_back': '(Character - Back View):** The same woman from behind: wavy copper-red hair to the shoulders, olive-green '
                  'jacket and trousers, brown boots.',
    'village': '(Setting - Village):** A cosy storybook village: small white cottages with red tiled roofs, round wooden doors and '
               'chimneys around a cobblestone square with a stone well, autumn trees and green hills.',
}
WOMAN_HIKE = (
    'a naturalistic medium wide shot on a mountain dirt path in bright morning sun. the woman with wavy copper-red hair and freckles, '
    'in her olive-green utility jacket over a mustard-yellow sweater, wears the large blue external-frame hiking backpack. she walks '
    'up the path toward the camera, stops, catches her breath and says with a tired smile: "Almost there." snow-capped peaks rise '
    'behind her under a blue sky. the camera is handheld and slowly tracks backward in front of her. the audio is her breathy voice, '
    'wind and footsteps on gravel, no background music.')
FISHER_VILLAGE = (
    'a charming 3D animated film scene. the old fisherman with the red beanie, big round nose and long white beard, in his '
    'mustard-yellow suit, walks across the cobblestone square of the storybook village past the stone well, the white cottages with '
    'red roofs behind him. he waves to someone off camera and calls cheerfully: "Morning! The fish are biting today!" warm morning '
    'light, autumn trees, stylised animated-feature rendering. the camera slowly tracks alongside him. the audio is his hearty, '
    'gravelly voice, footsteps on cobblestones and birdsong, no background music.')

# case -> (rows of picture keys, target prompt). 'raw' = the sheet as-is, no composing (the leak control).
LAYOUTS = {
    'lay_woman_grid': ([['woman'], ['mountains', 'backpack']], WOMAN_HIKE),
    'lay_fisher_raw': (None, FISHER.split('### Target Description\n')[0] + '### Target Description\n' + FISHER_VILLAGE),
    'lay_fisher_grid': ([['fisher'], ['village']], FISHER_VILLAGE),
    'lay_fisher_noback': ([['fisher_front', 'fisher_close'], ['village']], FISHER_VILLAGE),
    # what a user who never describes a picture gets: the app's preamble maps tag -> cell, nothing more, and the
    # prompt is a short one addressing the pictures by the strip's tags (ref2v_ms: <Picture n>)
    'lay_woman_tags': ([['woman'], ['mountains', 'backpack']], (
        'the woman from Picture 1, wearing the backpack from Picture 3, walks up the mountain path from Picture 2 toward '
        'the camera, stops, catches her breath and says with a tired smile: "Almost there." handheld camera tracking '
        'backward, bright morning sun. sound: her breathy voice, wind, footsteps on gravel, no music.')),
}
LAYOUTS['lay_woman_roles'] = ([['woman'], ['mountains', 'backpack']], (
    'the woman, wearing the backpack, walks up the mountain path toward the camera, stops, catches her breath and says '
    'with a tired smile: "Almost there." handheld camera tracking backward, bright morning sun. sound: her breathy '
    'voice, wind, footsteps on gravel, no music.'))
TAGS_ONLY = {'lay_woman_tags'}
# a role + two-word label per cell, no description: what a short agent-written preamble would carry
ROLES = {'woman': '(Character):** the woman.', 'mountains': '(Setting):** the mountain path.',
         'backpack': '(Prop):** the backpack.'}
# repeats of a case with another layout and/or seed: case -> (base case, fill layout?, seed)
VARIANTS = {
    'lay_woman_fill': ('lay_woman_grid', True, 42),
    'lay_woman_fill_s7': ('lay_woman_grid', True, 7),
    'lay_woman_grid_s7': ('lay_woman_grid', False, 7),
    'lay_woman_tags_fill': ('lay_woman_tags', True, 42),
    'lay_woman_roles_fill': ('lay_woman_roles', True, 42),
}
SEED = {}
# packed sheets (compose_pack): case -> (picture keys, how many are characters, croppable indices, target)
PACKS = {
    'pack_woman': (['woman_front', 'woman_close', 'woman_back', 'mountains', 'backpack3'], 3, (3,), WOMAN_HIKE),
    'pack_fisher': (['fisher_front', 'fisher_close', 'village'], 2, (2,), FISHER_VILLAGE),
    # each picture WHOLE: pack_woman showed a back view in its own cell becomes a second person
    'pack_woman_whole': (['woman', 'mountains', 'backpack3'], 1, (1,), WOMAN_HIKE),
    'pack_fisher_whole': (['fisher', 'village'], 1, (1,), FISHER_VILLAGE),
}


def make(case):
    if case in PACKS:
        keys, chars, crop, target = PACKS[case]
        sheet, _, _, boxes = compose_pack([PICS[k]() for k in keys], chars=chars, croppable=crop, do_trim=False)
        name, SEED[case] = f'mpi1060_{case}.png', 42
        sheet.save(f'{IN}/{name}')
        pre = '\n'.join(f'**{where(b)} {DESC[k]}' for b, k in zip(boxes, keys))
        return name, '### Reference Sheet Description\n' + pre + '\n### Target Description\n' + target
    base, fill, seed = VARIANTS.get(case, (case, False, 42))
    SEED[case] = seed
    rows, target = LAYOUTS[base]
    if rows is None:
        return FISHER_SHEET, target
    sheet, boxes = (compose_fill if fill else compose)([[PICS[k]() for k in row] for row in rows])
    name = f'mpi1060_{case}.png'
    sheet.save(f'{IN}/{name}')
    keys = [k for row in rows for k in row]
    cells = [(label(r, c, len(rows), len(rows[r])), k) for (r, c, *_), k in zip(boxes, keys)]
    if base in TAGS_ONLY:
        lines = [f'**{where}:** Picture {i}.' for i, (where, _) in enumerate(cells, 1)]
    elif base == 'lay_woman_roles':
        lines = [f'**{where} {ROLES[k]}' for where, k in cells]
    else:
        lines = [f'**{where} {DESC[k]}' for where, k in cells]
    return name, '### Reference Sheet Description\n' + '\n'.join(lines) + '\n### Target Description\n' + target


if __name__ == '__main__':
    tags = sys.argv[1:]
    if tags == ['--compose']:
        for case in LAYOUTS:
            name, prompt = make(case)
            print(case, name, '\n' + prompt[:prompt.index('### Target')], flush=True)
        sys.exit(0)
    os.makedirs(ts.OUT, exist_ok=True)
    for case in tags:
        name, prompt = make(case)
        ts.CASES[case] = ('A', {'Input_Image': {'image': name}, 'Input_Positive': {'string': prompt},
                                'Input_Seed': {'int': SEED[case]}})
        ts.run(case)
