"""MPI-1101 bench: which model repaints a seam band best - Klein 9B vs Krea 2, each through the app's OWN inpaint
branch (Input_wf_type 5: InpaintCropImproved -> LanPaint -> InpaintStitchImproved), as the Make seamless Flow would.

The recipe under test (the brainstorm's design, 2026-10-12): roll the picture by half on each joined axis so the seam(s)
sit in the middle, mask a band round each seam (left handle L% + right handle R% of the width, top T% + bottom B% of
the height), repaint the band, roll back. After the roll, the ORIGINAL's left edge strip [0, L*W) lands at
[W/2, W/2 + L*W) and its right edge strip [W - R*W, W) at [W/2 - R*W, W/2): the band is [W/2 - R*W, W/2 + L*W).

usage (repo root):
  bench.py t2i   <out>   run spec for the two generated sources (stone, fabric), Klein 9B t2i
  bench.py prep  <out>   CPU: the four sources -> rolled image + band mask into ComfyUI/input (mpi1101_*)
  bench.py spec  <out>   run spec for the repaints: 4 sources x {klein9b, krea2} x seeds {42, 7}
  bench.py post  <out>   CPU: roll back, wrap metric, outside-band check, tiled contact sheets
Run the GPU halves ONLY under the lease: run_bench.sh does it all in order."""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
IN = 'G:/ComfyUi/ComfyUI/input'
PROJ = 'C:/Users/Fabio/Documents/Cubric Studio/Projects'
EDGE = 0.10  # the Flow's default handle: 10% of the side, every side

# name -> (source, bench size, axes)
SOURCES = {
    'pano': (f'{PROJ}/X2.3 references/Media/convertTo360Pano_001.png', (2048, 1024), 'x'),  # broken wrap: 6.3x a normal column step at 8K
    'photo': (f'{PROJ}/Big Photos Test/Media/imported_001.jpg', (1024, 768), 'xy'),
    'stone': ('t2i:stone', (1024, 1024), 'xy'),
    'fabric': ('t2i:fabric', (1024, 1024), 'xy'),
}
T2I = {
    'stone': 'Top-down photograph of an old grey cobblestone street, flat overcast light, the stones fill the whole frame.',
    'fabric': 'Close-up flat-lay photograph of a red and gold patterned brocade fabric, even soft light, the fabric fills the whole frame.',
}
MODELS = {
    'klein9b': ('comfy_workflows/klein_9b_t2i.json', {}),
    'krea2': ('comfy_workflows/krea2_t2i_sfw.json', {'Input_is_Turbo': {'boolean': True}}),  # the app's default turbo
}
SEEDS = (42, 7)
# Rounds 1-2 (2026-10-12) repainted nothing: the masked branch is LanPaint at denoise 1.0 already, but it feeds the
# INPUT itself as the edit reference (ReferenceLatent), seam included, and the model reproduced it. Round 3 blanks
# the band out of the input first. Each run is (model, seed, fill): 'none' = round 1, 'blur' = the band heavily
# blurred (colours kept, every edge - the seam's too - gone), 'flat' = the band one mean colour.
# Round 3 showed the reference still rules: blur came back as mush, flat as unrelated scenery. Round 4 drops the edit
# reference altogether (ref=False: every ReferenceLatent bypassed), a plain inpaint LanPaint conditions on the
# unmasked sides alone. Each run is (model, seed, fill, ref).
# Round 4 showed a reference-free Klein ignores its surroundings (wood and dry grass in a cobblestone band): the
# baked instruction says nothing about WHAT the picture is. Round 5 adds one line saying so. (model, seed, fill, ref, desc)
VARIANTS = [('klein9b', 42, 'none', False, True), ('klein9b', 7, 'none', False, True)]
FILLS = ('none', 'blur', 'flat')


def vtag(model, seed, fill, ref=True, desc=False):
    return f'{model}_{fill}{"" if ref else "_noref"}{"_desc" if desc else ""}_s{seed}'


def without_reference(api_path, out):
    """The API graph with every ReferenceLatent bypassed: each consumer takes the node's own conditioning input."""
    g = json.load(open(api_path, encoding='utf-8'))
    refs = {k: n['inputs']['conditioning'] for k, n in g.items() if n['class_type'] == 'ReferenceLatent'}
    def src(link):
        while link[0] in refs:
            link = refs[link[0]]
        return link
    for n in g.values():
        for name, v in n['inputs'].items():
            if isinstance(v, list) and v[0] in refs:
                n['inputs'][name] = src(v)
    for k in refs:
        del g[k]
    path = os.path.join(out, os.path.basename(api_path).replace('.json', '_noref.json'))
    json.dump(g, open(path, 'w', encoding='utf-8'))
    return path


def blank_band(im, m, fill):
    """The rolled picture with its band (mask m) replaced, so neither the noise nor the reference holds the seam."""
    if fill == 'none':
        return im
    band = m.astype(bool)
    out = im.copy()
    if fill == 'flat':
        out[band] = im[band].mean(axis=0).round().astype(np.uint8)
    else:
        r = max(8, round(min(im.shape[:2]) * 0.06))
        out[band] = np.asarray(Image.fromarray(im).filter(ImageFilter.GaussianBlur(r)))[band]
    return out


# The Flow's baked instruction, alone: the optional field is empty by default (Fabio, B)
def prompt(name, desc=False):
    base = 'Continue the picture seamlessly across this area, matching the textures, lines, colours and light on both sides, with no visible join.'
    return f'{base} {DESC[name]}' if desc else base


# Round 5: what the picture shows, in one line (the app would get it from its describer or the user's prompt).
DESC = {
    'pano': 'A 360 panorama of a lush tropical garden: big shade trees, palms and leafy ground cover either side of a curved stone-paved path, sun through the canopy, blue sky.',
    'photo': 'A hand holding a clear plastic jar of black-eyed beans with a white and orange printed label, against a red background.',
    'stone': T2I['stone'],
    'fabric': T2I['fabric'],
}


def band(n, lo, hi):
    """Pixels [n/2 - hi*n, n/2 + lo*n) after a roll by n//2: lo = the leading edge's handle, hi = the trailing edge's."""
    c = n // 2
    return c - round(hi * n), c + round(lo * n)


def t2i_spec(out):
    api = os.path.join(REPO, MODELS['klein9b'][0])
    spec = [{'tag': f't2i_{k}', 'api': api, 'set': {
        'Input_wf_type': {'int': 1}, 'Input_Positive': {'string': p}, 'Input_Seed': {'int': 42},
        'Input_Width': {'int': 1024}, 'Input_Height': {'int': 1024}}} for k, p in T2I.items()]
    json.dump(spec, open(os.path.join(out, 't2i_spec.json'), 'w', encoding='utf-8'), indent=1)


def prep(out):
    for name, (src, size, axes) in SOURCES.items():
        path = os.path.join(out, f't2i_{src[4:]}.png') if src.startswith('t2i:') else src
        im = np.asarray(Image.open(path).convert('RGB').resize(size, Image.LANCZOS))
        h, w = im.shape[:2]
        m = np.zeros((h, w), np.uint8)
        if 'x' in axes:
            im = np.roll(im, w // 2, axis=1)
            a, b = band(w, EDGE, EDGE)
            m[:, a:b] = 255
        if 'y' in axes:
            im = np.roll(im, h // 2, axis=0)
            a, b = band(h, EDGE, EDGE)
            m[a:b, :] = 255
        Image.open(path).convert('RGB').resize(size, Image.LANCZOS).save(os.path.join(out, f'src_{name}.png'))
        Image.fromarray(im).save(f'{IN}/mpi1101_{name}_rolled.png')
        for fill in FILLS:
            Image.fromarray(blank_band(im, m, fill)).save(f'{IN}/mpi1101_{name}_rolled_{fill}.png')
        Image.fromarray(m).save(f'{IN}/mpi1101_{name}_mask.png')
        print(name, w, 'x', h, axes, 'band', int(m.astype(bool).mean() * 100), '% of the frame')


def spec(out):
    runs = []
    for name in SOURCES:
        for model, seed, fill, ref, desc in VARIANTS:
            api, extra = MODELS[model]
            api = os.path.join(REPO, api) if ref else without_reference(os.path.join(REPO, api), out)
            runs.append({'tag': f'{name}_{vtag(model, seed, fill, ref, desc)}', 'api': api, 'set': dict({
                'Input_wf_type': {'int': 5},
                'Input_Image': {'image': f'mpi1101_{name}_rolled_{fill}.png'},
                'Input_Mask': {'image': f'mpi1101_{name}_mask.png'},
                'Input_Positive': {'string': prompt(name, desc)},
                'Input_Seed': {'int': seed}}, **extra)})
    json.dump(runs, open(os.path.join(out, 'spec.json'), 'w', encoding='utf-8'), indent=1)
    print(len(runs), 'runs')


def wrap_ratio(a, axis):
    """Mean step across the wrap seam / mean step between neighbours. ~1 = seamless."""
    a = a.astype(np.float32)
    if axis == 'x':
        return np.abs(a[:, 0] - a[:, -1]).mean() / np.abs(a[:, 1:] - a[:, :-1]).mean()
    return np.abs(a[0] - a[-1]).mean() / np.abs(a[1:] - a[:-1]).mean()


def tiled(a, axes, n=2):
    return np.tile(a, (n if 'y' in axes else 1, n if 'x' in axes else 1, 1))


def half_shift_blend(a, axes, inner=0.6):
    """The NO-MODEL baseline (the idea behind SparknightLLC's Half Shift / Radial Mask, our own code): keep the
    original in the middle, fade to the half-rolled copy toward the edges. The rolled copy's edges are the
    original's continuous middle, so the result tiles; the price is a ghosted double image in the fade."""
    h, w = a.shape[:2]
    shifted = a
    t = np.zeros((h, w), np.float32)
    if 'x' in axes:
        shifted = np.roll(shifted, w // 2, axis=1)
        t = np.maximum(t, np.abs(np.arange(w) - (w - 1) / 2)[None, :] / ((w - 1) / 2))
    if 'y' in axes:
        shifted = np.roll(shifted, h // 2, axis=0)
        t = np.maximum(t, np.abs(np.arange(h) - (h - 1) / 2)[:, None] / ((h - 1) / 2))
    s = np.clip((t - inner) / (1 - inner), 0, 1)
    s = (s * s * (3 - 2 * s))[..., None]
    return (a * (1 - s) + shifted * s).round().astype(np.uint8)


def post(out):
    report = []
    for name, (_, size, axes) in SOURCES.items():
        src = np.asarray(Image.open(os.path.join(out, f'src_{name}.png')).convert('RGB'))
        rolled = np.asarray(Image.open(f'{IN}/mpi1101_{name}_rolled.png').convert('RGB')).astype(np.int16)
        mask = np.asarray(Image.open(f'{IN}/mpi1101_{name}_mask.png')) > 0
        h, w = src.shape[:2]
        row = [('source', src)]
        report.append(f'{name} ({w}x{h}, {axes}): source wrap ' + ' '.join(f'{ax}={wrap_ratio(src, ax):.1f}' for ax in axes))
        blend = half_shift_blend(src, axes)
        Image.fromarray(blend).save(os.path.join(out, f'final_{name}_blend.png'))
        report.append(f'  {name}_blend (no model): wrap ' + ' '.join(f'{ax}={wrap_ratio(blend, ax):.1f}' for ax in axes))
        row.append(('no model (half-shift blend)', blend))
        for model, seed, fill, ref, desc in VARIANTS:
            tag = f'{name}_{vtag(model, seed, fill, ref, desc)}'
            f = os.path.join(out, f'{tag}.png')
            if not os.path.exists(f):
                report.append(f'  {tag}: MISSING')
                continue
            r = np.asarray(Image.open(f).convert('RGB'))
            if r.shape != rolled.shape:
                report.append(f'  {tag}: SIZE {r.shape[1]}x{r.shape[0]} != {w}x{h}')
                r = np.asarray(Image.fromarray(r).resize((w, h), Image.LANCZOS))
            outside = np.abs(r.astype(np.int16) - rolled)[~mask].max()
            back = r
            if 'y' in axes:
                back = np.roll(back, -(h // 2), axis=0)
            if 'x' in axes:
                back = np.roll(back, -(w // 2), axis=1)
            Image.fromarray(back).save(os.path.join(out, f'final_{tag}.png'))
            report.append(f'  {tag}: wrap ' + ' '.join(f'{ax}={wrap_ratio(back, ax):.1f}' for ax in axes)
                          + f', max change outside band {outside}')
            row.append((vtag(model, seed, fill, ref, desc), back))
        sheet(out, name, axes, row)
    open(os.path.join(out, 'report.txt'), 'w', encoding='utf-8').write('\n'.join(report) + '\n')
    print('\n'.join(report))


def sheet(out, name, axes, row):
    """Each result tiled 2x on its joined axes, side by side, labelled: the join is the middle of every tile."""
    W = 900
    ims = []
    for label, a in row:
        t = Image.fromarray(tiled(a, axes))
        ims.append((label, t.resize((W, round(t.height * W / t.width)), Image.LANCZOS)))
    cols = 2
    rows = (len(ims) + cols - 1) // cols
    ch = max(i.height for _, i in ims) + 24
    s = Image.new('RGB', (W * cols, ch * rows), 'white')
    dr = ImageDraw.Draw(s)
    for k, (label, im) in enumerate(ims):
        x, y = (k % cols) * W, (k // cols) * ch
        dr.text((x + 6, y + 5), label, fill='black')
        s.paste(im, (x, y + 24))
    s.save(os.path.join(out, f'sheet_{name}.jpg'), quality=90)


if __name__ == '__main__':
    cmd, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    {'t2i': t2i_spec, 'prep': prep, 'spec': spec, 'post': post}[cmd](out)
