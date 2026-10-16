"""MPI-1086 r47 (Fabio 2026-10-16, r45/r46): Makeup edits the FACES only. Input_Face_Crop on:
  SAM3 "face" per panel of the SHEET (front = [0, cut 1), close-up = [cut 2, W); the Input_Cut_1/2 rule, 0 = 25% / 50%)
  -> MpiMaskSquareBbox (padding = half the face's longer side: the square is the face + half a face all round)
  -> each square cropped, scaled to 724 x 724, side by side on ONE 1448 x 724 canvas
  -> the canvas is picture 1 of BOTH Qwen encodes (with and without the mannequin), so the one KSampler edits it
  -> the edit cut in halves, each scaled back to its square and pasted onto the sheet through its own face mask,
     grown and feathered in the 724 half (29 px = r45's side / 25; blur 31 / sigma 10).
Everything that read the sheet-sized edit ("back to the sheet's own size") now reads "the edit: the faces pasted
back when Input_Face_Crop". Both switches are lazy MpiIfElse: off, no crop node runs and the graph is as before.
Idempotent: refuses to run twice. Then: node scripts/workflow-to-api.mjs <raw> > <api>   (the :8188 bench)
"""
import copy, json

PATH = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
KLEIN = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit.json'
raw = open(PATH, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'Input_Face_Crop' for n in r['nodes']):
    raise SystemExit('already patched')
links = {l[0]: l for l in r['links']}
nid, lid = r['last_node_id'], r['last_link_id']
T = {n.get('title'): n['id'] for n in r['nodes']}
HALF, GROW, BLUR, SIGMA = 724, 29, 31, 10


def clone(i, title, pos, widgets=None, node=None):
    global nid
    nid += 1
    c = copy.deepcopy(node or by[i])
    c.update({'id': nid, 'pos': pos, 'order': 400 + nid, 'mode': 0})
    c['title'] = title
    for x in c['inputs']:
        x['link'] = None
    for o in c['outputs']:
        o['links'] = []
    if widgets is not None:
        c['widgets_values'] = widgets
    c.pop('widgets_values_named', None)
    r['nodes'].append(c)
    by[nid] = c
    return nid


def core(typ, title, pos, ins, outs, widgets):
    """A core node this graph has none of to clone."""
    global nid
    nid += 1
    by[nid] = {'id': nid, 'type': typ, 'pos': pos, 'size': [270, 100], 'flags': {}, 'order': 400 + nid, 'mode': 0,
               'title': title, 'inputs': [{'name': n, 'type': t, 'link': None} for n, t in ins],
               'outputs': [{'name': n, 'type': t, 'links': []} for n, t in outs],
               'properties': {'Node name for S&R': typ}, 'widgets_values': widgets}
    r['nodes'].append(by[nid])
    return nid


def unlink(l_id):
    old = links.pop(l_id)
    by[old[1]]['outputs'][old[2]]['links'].remove(old[0])
    return old


def wire(s, sslot, dst, dname, widget_type=None):
    global lid
    lid += 1
    ins = by[dst]['inputs']
    i = next((i for i in ins if i['name'] == dname), None)
    if i is None:   # a widget turned into a socket
        i = {'name': dname, 'type': widget_type, 'widget': {'name': dname}, 'link': None}
        ins.append(i)
    if i.get('link') is not None:
        unlink(i['link'])
    l = [lid, s, sslot, dst, ins.index(i), by[s]['outputs'][sslot]['type']]
    links[lid] = l
    by[s]['outputs'][sslot]['links'] = (by[s]['outputs'][sslot].get('links') or []) + [lid]
    i['link'] = lid


SHEET = T['Input_Image']                       # outputs: 0 image, 2 width, 3 height
SCALE = T["back to the sheet's own size"]      # the sheet-sized edit, read by everything downstream
ALPHA = T['drop alpha (2.1 VAE decodes RGBA)']  # the decoded edit, at the encode's size
MATH = T['the rest: its width']
BOX = T['the front body box']
CROP = T['crop the EDITED front body']
IFELSE = T['picture 2: the reference itself when it is a mannequin']
SQUARE = next(n for n in json.load(open(KLEIN, encoding='utf-8'))['nodes'] if n['type'] == 'MpiMaskSquareBbox')
X, Y = 6000, 4200

on = clone(T['Input_Is_Mannequin'], 'Input_Face_Crop', [X, Y], [False])
c1 = clone(MATH, 'face crop: the front panel ends (Input_Cut_1, else 25%)', [X, Y + 150],
           ['a // 4 * (b <= 0) + b * (b > 0)'])
wire(SHEET, 2, c1, 'a')
wire(T['Input_Cut_1'], 0, c1, 'b')
c2 = clone(MATH, 'face crop: the close-up panel starts (Input_Cut_2, else 50%)', [X, Y + 300],
           ['a // 2 * (b <= 0) + b * (b > 0)'])
wire(SHEET, 2, c2, 'a')
wire(T['Input_Cut_2'], 0, c2, 'b')
cw = clone(MATH, 'face crop: the close-up panel width', [X, Y + 450], ['a - b'])
wire(SHEET, 2, cw, 'a')
wire(c2, 0, cw, 'b')

halves, pastes = [], []
for j, (name, px, pw) in enumerate((('front', None, c1), ('close-up', c2, cw))):
    x0, y0 = X + 350, Y + 700 * j
    pbox = clone(BOX, f'{name} panel', [x0, y0], [512, 512, 0, 0])
    wire(pw, 0, pbox, 'width', 'INT')
    wire(SHEET, 3, pbox, 'height', 'INT')
    if px:
        wire(px, 0, pbox, 'x', 'INT')
    pcrop = clone(CROP, f'{name} panel crop', [x0 + 300, y0], [False])
    wire(SHEET, 0, pcrop, 'image')
    wire(pbox, 0, pcrop, 'mpi_box')
    det = clone(T['face only'], f'{name}: SAM3 face', [x0 + 600, y0])
    wire(T['SAM3 Model'], 0, det, 'model')
    wire(pcrop, 0, det, 'image')
    wire(T["SAM3 'face' only - finds WHERE the head is"], 0, det, 'conditioning')
    bb = clone(T['face box (empty -> 0 box -> whole quarter, as before)'], f'{name}: face box', [x0 + 900, y0])
    wire(det, 0, bb, 'mask')
    fb = clone(188, f'{name}: face size', [x0 + 1200, y0])
    wire(bb, 1, fb, 'mpi_box')
    pad = clone(MATH, f'{name}: half the longer face side', [x0 + 1500, y0], ['(a if a > b else b) // 2'])
    wire(fb, 0, pad, 'a')
    wire(fb, 1, pad, 'b')
    sq = clone(None, f'{name}: the square (face + half a face all round)', [x0 + 1800, y0], [0], SQUARE)
    wire(det, 0, sq, 'mask')
    wire(pad, 0, sq, 'padding', 'INT')
    sbox = clone(BOX, f'{name}: square box', [x0 + 2100, y0], [512, 512, 0, 0])
    for k, n in ((3, 'width'), (3, 'height'), (1, 'x'), (2, 'y')):
        wire(sq, k, sbox, n, 'INT')
    face = clone(CROP, f'{name}: the face square', [x0 + 2400, y0], [False])
    wire(pcrop, 0, face, 'image')
    wire(sbox, 0, face, 'mpi_box')
    f724 = clone(SCALE, f'{name}: the face to {HALF}', [x0 + 2700, y0], ['lanczos', HALF, HALF, 'disabled'])
    by[f724]['inputs'] = [i for i in by[f724]['inputs'] if i['name'] == 'image']
    wire(face, 0, f724, 'image')
    halves.append(f724)
    # the paste mask, made in the 724 half: one grow + feather fits both faces
    m2i = core('MaskToImage', f'{name}: face mask as a picture', [x0 + 300, y0 + 300], [('mask', 'MASK')],
               [('IMAGE', 'IMAGE')], [])
    wire(det, 0, m2i, 'mask')
    mcrop = clone(CROP, f'{name}: face mask, the square', [x0 + 600, y0 + 300], [False])
    wire(m2i, 0, mcrop, 'image')
    wire(sbox, 0, mcrop, 'mpi_box')
    m724 = clone(SCALE, f'{name}: face mask to {HALF}', [x0 + 900, y0 + 300], ['bilinear', HALF, HALF, 'disabled'])
    by[m724]['inputs'] = [i for i in by[m724]['inputs'] if i['name'] == 'image']
    wire(mcrop, 0, m724, 'image')
    i2m = core('ImageToMask', f'{name}: back to a mask', [x0 + 1200, y0 + 300], [('image', 'IMAGE')],
               [('MASK', 'MASK')], ['red'])
    wire(m724, 0, i2m, 'image')
    grow = clone(178, f'{name}: grow {GROW}', [x0 + 1500, y0 + 300], [GROW, True])
    wire(i2m, 0, grow, 'mask')
    g2i = core('MaskToImage', f'{name}: grown mask as a picture', [x0 + 1800, y0 + 300], [('mask', 'MASK')],
               [('IMAGE', 'IMAGE')], [])
    wire(grow, 0, g2i, 'mask')
    blur = core('ImageBlur', f'{name}: feather', [x0 + 2100, y0 + 300], [('image', 'IMAGE')],
                [('IMAGE', 'IMAGE')], [BLUR, SIGMA])
    wire(g2i, 0, blur, 'image')
    pm = core('ImageToMask', f'{name}: the paste mask', [x0 + 2400, y0 + 300], [('image', 'IMAGE')],
              [('MASK', 'MASK')], ['red'])
    wire(blur, 0, pm, 'image')
    pastes.append((name, px, sq, pm))

canvas = clone(T['front | new back'], 'the face canvas: front | close-up', [X + 3400, Y + 300],
               ['right', False, 0, 'white'])
wire(halves[0], 0, canvas, 'image1')
wire(halves[1], 0, canvas, 'image2')
pic1 = clone(IFELSE, 'picture 1: the face canvas when Input_Face_Crop, else the sheet', [X + 3700, Y + 300], [True])
wire(canvas, 0, pic1, 'true')
wire(SHEET, 0, pic1, 'false')
wire(on, 0, pic1, 'boolean')
for enc in (T['Qwen edit: picture 1 = the sheet, own size (resolution 0)'],
            T['Qwen edit: picture 2 = the mannequin (hair from a picture)']):
    wire(pic1, 0, enc, 'images.image_1')

# the edit back onto the sheet
e = clone(SCALE, 'the face edit at the canvas size', [X + 350, Y + 1600], ['lanczos', HALF * 2, HALF, 'disabled'])
by[e]['inputs'] = [i for i in by[e]['inputs'] if i['name'] == 'image']
wire(ALPHA, 0, e, 'image')
dest = (SHEET, 0)
for j, (name, px, sq, pm) in enumerate(pastes):
    x0, y0 = X + 650, Y + 1600 + 300 * j
    hbox = clone(BOX, f'{name}: its half of the edit', [x0, y0], [HALF, HALF, HALF * j, 0])
    hcrop = clone(CROP, f'{name}: the edited half', [x0 + 300, y0], [False])
    wire(e, 0, hcrop, 'image')
    wire(hbox, 0, hcrop, 'mpi_box')
    back = clone(SCALE, f'{name}: back to its square', [x0 + 600, y0], ['lanczos', 512, 512, 'disabled'])
    wire(hcrop, 0, back, 'image')
    wire(sq, 3, back, 'width', 'INT')
    wire(sq, 3, back, 'height', 'INT')
    paste = clone(180, f'{name}: pasted through its face mask', [x0 + 900, y0], [0, 0, False])
    wire(dest[0], dest[1], paste, 'destination')
    wire(back, 0, paste, 'source')
    wire(pm, 0, paste, 'mask')
    if px:
        sx = clone(MATH, f'{name}: x on the sheet', [x0 + 600, y0 + 150], ['a + b'])
        wire(px, 0, sx, 'a')
        wire(sq, 1, sx, 'b')
        wire(sx, 0, paste, 'x', 'INT')
    else:
        wire(sq, 1, paste, 'x', 'INT')
    wire(sq, 2, paste, 'y', 'INT')
    dest = (paste, 0)

edit = clone(IFELSE, 'the edit: the faces pasted back when Input_Face_Crop', [X + 1900, Y + 1600], [True])
readers = [links[l][3:5] for l in list(by[SCALE]['outputs'][0]['links'])]
wire(dest[0], dest[1], edit, 'true')
wire(SCALE, 0, edit, 'false')
wire(on, 0, edit, 'boolean')
for dst, slot in readers:
    wire(edit, 0, dst, by[dst]['inputs'][slot]['name'])
assert by[SCALE]['outputs'][0]['links'] == [by[edit]['inputs'][1]['link']], 'the sheet-sized edit has another reader'

r['links'] = list(links.values())
r['last_node_id'], r['last_link_id'] = nid, lid
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(PATH, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'face crop: Input_Face_Crop {on}, canvas {canvas} -> picture 1 {pic1}; pasted {dest[0]} -> edit {edit}; '
      f'{len(readers)} readers moved')
