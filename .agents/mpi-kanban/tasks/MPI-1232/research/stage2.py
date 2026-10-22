"""MPI-1232 stage 2: what the describer must see. Run with plain `python` (PIL lives in user site).

  python stage2.py prep              crop the UFO field -> input_field.png, cut its 2x tiles, draw the outlined pictures
  python stage2.py caption <1|2|3>   caption every tile on the bench's describer (image_descriptor.json) -> captions_field_<m>.json

1 = tile crop alone; 2 = tile crop + the whole picture's caption + the tile's place as context;
3 = the whole picture with the tile outlined in red. "Whole picture" = the full upscale_002, as if the
app were tiling it; the bench only redraws the field crop so a run is minutes.
Captions run on the GPU: wrap `caption` in gpu_lease.py.
"""
import json, os, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import tilebench as tb  # noqa: E402

SRC = Path(r'C:/Users/Fabio/Documents/Cubric Studio/Projects/Flux 3 tests/Media/upscale_002.png')
CROP = (0, 1450, 1344, 2450)  # the misty field left of the people, under the UFO; clear of the man and the alien
TILES = HERE / 'tiles'
ASK = ('in one or two plain sentences, as a text-to-image prompt: the things you see, their texture and the '
       'lighting. Start with the subject, no preamble.')


def place(r):
    """Where a 2x tile sits in the full picture, in words."""
    W, H = 6048, 3456
    cx = CROP[0] + (r[0] + r[2]) / 4
    cy = CROP[1] + (r[1] + r[3]) / 4
    row = ['upper', 'middle', 'lower'][min(2, int(cy * 3 / H))]
    col = ['left', 'centre', 'right'][min(2, int(cx * 3 / W))]
    return f'{row} {col}'


def cmd_prep():
    from PIL import Image, ImageDraw
    full = Image.open(SRC).convert('RGB')
    full.crop(CROP).save(HERE / 'input_field.png')
    tb.cmd_tiles(HERE / 'input_field.png', 'field')
    rects = json.loads((TILES / 'field_rects.json').read_text())
    for i, r in enumerate(rects):
        im = full.copy()
        box = [CROP[0] + r[0] / 2, CROP[1] + r[1] / 2, CROP[0] + r[2] / 2, CROP[1] + r[3] / 2]
        ImageDraw.Draw(im).rectangle(box, outline=(255, 0, 0), width=14)
        im.resize((1512, 864), Image.LANCZOS).save(TILES / f'field_outlined_{i:02d}.png')
    full.resize((1512, 864), Image.LANCZOS).save(TILES / 'field_whole.png')
    print('places:', [place(r) for r in rects])


def describe(img, question=None):
    """One run of the app's describer graph; question wrapped the way buildDescribeInjectionParams wraps it."""
    g = json.loads((tb.REPO / 'comfy_workflows' / 'image_descriptor.json').read_text(encoding='utf-8'))
    for n in g.values():
        t = n.get('_meta', {}).get('title')
        if t == 'Input_Image':
            n['inputs']['image'] = tb._upload(img)
        elif n['class_type'] == 'CLIPLoader' and os.environ.get('DESCRIBER'):  # e.g. qwen3vl_8b_int8_convrot.safetensors
            n['inputs']['clip_name'] = os.environ['DESCRIBER']
        elif t == 'Input_Describe_Prompt' and question:
            n['inputs']['value'] = ('<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>'
                                    f'{question}<|im_end|>\n<|im_start|>assistant\n')
    pid = json.loads(tb._req('/prompt', json.dumps({'prompt': g, 'client_id': 'mpi1232'}).encode()))['prompt_id']
    while True:
        time.sleep(1)
        h = json.loads(tb._req(f'/history/{pid}')).get(pid)
        if h and h.get('status', {}).get('completed') is not None:
            break
    if h['status'].get('status_str') != 'success':
        raise SystemExit('FAILED ' + json.dumps(h['status'].get('messages'))[:2000])
    out = next(v for v in h['outputs'].values() if 'text' in v)['text']
    return (out[0] if isinstance(out, list) else out).strip()


def cmd_caption(m):
    rects = json.loads((TILES / 'field_rects.json').read_text())
    whole = None
    if m == '2':
        wp = HERE / 'caption_whole_ufo.txt'
        if not wp.exists():
            wp.write_text(describe(TILES / 'field_whole.png'), encoding='utf-8')
        whole = wp.read_text(encoding='utf-8')
    caps = []
    for i, r in enumerate(rects):
        if m == '1':
            c = describe(TILES / f'field_{i:02d}.jpg', 'Describe only what is inside this image ' + ASK)
        elif m == '2':
            c = describe(TILES / f'field_{i:02d}.jpg',
                         f'This image is a crop from the {place(r)} part of a larger picture. The whole picture: {whole}\n\n'
                         f'Describe only what is inside this crop {ASK} Do not mention anything outside the crop.')
        elif m == '4':  # the card's own first prompt (its sidecar) as the context, not a caption of the mush
            c = describe(TILES / f'field_{i:02d}.jpg',
                         f'This image is a crop from the {place(r)} part of a larger picture, which was made from this prompt: '
                         f'{(HERE / "prompt_t2i_004.txt").read_text(encoding="utf-8")}\n\n'
                         f'Describe only what is inside this crop {ASK} Do not mention anything outside the crop.')
        elif m == '5':  # Fabio 2026-10-22: the outline, but asked what the area IS from the scene, not what the pixels show
            c = describe(TILES / f'field_outlined_{i:02d}.png',
                         'This picture will be redrawn sharper, one part at a time. The red rectangle marks the next part. '
                         'Using the whole scene as a clue, say what real thing fills that area (for example sky, distant '
                         'valley, grass, rock, a person) and describe how it would look sharp and in focus, in one or two '
                         'plain sentences as a text-to-image prompt. Never call it blurry, grainy or noisy. Do not mention '
                         'the rectangle or anything outside it.')
        elif m == '6':  # Fabio 2026-10-22: a detail pass needs only WHAT it is ("a field with green grass"); detail words hallucinate
            c = describe(TILES / f'field_outlined_{i:02d}.png',
                         'The red rectangle marks one part of this picture. Using the whole scene as a clue, name what '
                         'fills that area in five words or fewer, like "a field with green grass" or "cloudy sky". '
                         'Reply with the name only.').strip(' ."')
        else:
            c = describe(TILES / f'field_outlined_{i:02d}.png',
                         f'The red rectangle marks one part of this picture. Describe only what is inside the red rectangle {ASK} '
                         'Do not mention the rectangle or anything outside it.')
        caps.append(c)
        print(i, place(r), '|', c, flush=True)
    tag = m + ('_' + os.environ['DESCRIBER'].split('_')[1] if os.environ.get('DESCRIBER') else '')
    (HERE / f'captions_field_{tag}.json').write_text(json.dumps(caps, indent=1, ensure_ascii=False), encoding='utf-8')


NAME_Q = ('The red rectangle marks one part of this picture. Using the whole scene as a clue, name what fills that area '
          'in five words or fewer, like "a field with green grass" or "cloudy sky". Reply with the name only.')


PEOPLE_Q = ('The red rectangle marks one part of this picture. Using the whole scene as a clue, name what fills that '
            'area in a few words, like "a field with green grass" or "cloudy sky". If people are inside it, name each '
            'one by hair colour and clothing only, like "grey-haired man in a navy hoodie and jeans". '
            'Reply with the names only, one short line.')


# Stage 3: people leave the grid (person pass), so a tile name must not bring them back.
SCENERY_Q = ('The red rectangle marks one part of this picture. Ignoring any people, name what fills that area in five '
             'words or fewer, like "a field with green grass" or "cloudy sky". Reply with the name only.')


def cmd_fresh():
    """Readable-picture check (Fabio 2026-10-22): the untouched t2i_004 as input, short names on the 4B.
    FRESH_Q=people -> scenery in a few words, people by hair + clothing (Fabio: grey hair must be said)."""
    q, tag = {'people': (PEOPLE_Q, '7'), 'scenery': (SCENERY_Q, '8')}.get(os.environ.get('FRESH_Q'), (NAME_Q, '6'))
    from PIL import Image, ImageDraw
    full = Image.open(SRC.with_name('t2i_004.png')).convert('RGB')
    full.save(HERE / 'input_fresh.png')
    tb.cmd_tiles(HERE / 'input_fresh.png', 'fresh')
    rects = json.loads((TILES / 'fresh_rects.json').read_text())
    caps = []
    for i, r in enumerate(rects):
        im = full.copy()
        ImageDraw.Draw(im).rectangle([v / 2 for v in r], outline=(255, 0, 0), width=4)
        im.save(TILES / f'fresh_outlined_{i:02d}.png')
        caps.append(describe(TILES / f'fresh_outlined_{i:02d}.png', q).strip(' ."'))
        print(i, r, '|', caps[-1], flush=True)
    (HERE / f'captions_fresh_{tag}.json').write_text(json.dumps(caps, indent=1, ensure_ascii=False), encoding='utf-8')


def cmd_sheet():
    """input (2x lanczos) | every field run that exists, 1:1 crops of the field and the grass edge -> out/sheets/field_*.png"""
    from PIL import Image, ImageDraw
    src = Image.open(HERE / 'input_field.png').convert('RGB')
    cols = [('input 2x', src.resize((src.width * 2, src.height * 2), Image.LANCZOS))]
    for tag in ['A_f1', 'C_cap1', 'C_cap2', 'C_cap3', 'C_cap4', 'C_oracle', 'A_f1_d45', 'C_oracle_d45', 'C_cap3_d45']:
        p = HERE / 'out' / f'field_krea2_{tag}.png'
        if p.exists():
            cols.append((tag, Image.open(p).convert('RGB')))
    out = HERE / 'out' / 'sheets'; out.mkdir(parents=True, exist_ok=True)
    for name, box in {'field': (300, 500, 1068, 1268), 'edge': (1500, 1232, 2268, 2000)}.items():
        sheet = Image.new('RGB', (768 * len(cols), 800), 'black')
        for i, (label, im) in enumerate(cols):
            sheet.paste(im.crop(box), (768 * i, 32))
            ImageDraw.Draw(sheet).text((768 * i + 8, 8), label, fill='white')
        sheet.save(out / f'field_{name}.png')
    print('sheets:', [c[0] for c in cols])


if __name__ == '__main__':
    {'prep': lambda: cmd_prep(), 'caption': lambda: cmd_caption(sys.argv[2]), 'sheet': lambda: cmd_sheet(), 'fresh': lambda: cmd_fresh()}[sys.argv[1]]()
