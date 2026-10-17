"""MPI-1086 fa1 (face tattoos from a picture): Input_Ref_Head_Crop crops the Reference picture (Input_Image_2) to its HEAD
before anything reads it. r45: the mannequin of a full-body photo kept the face ink too small to read; fa1 P2: the head
crop through the mannequin copied the designs, own face kept. Head = SAM3 "face" -> MpiMaskSquareBbox (padding = half
the face's longer side, as the sheet's face crop) -> MpiBoxCrop. No face found (size 0) = the whole picture.
Its own switch, not Input_Face_Crop: Makeup's picture route stays as eye-tested. Lazy MpiIfElse: off, nothing runs.
Idempotent: refuses to run twice. Then: node scripts/workflow-to-api.mjs <raw> > <api>
"""
import copy, json

PATH = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
raw = open(PATH, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'Input_Ref_Head_Crop' for n in r['nodes']):
    raise SystemExit('already patched')
links = {l[0]: l for l in r['links']}
nid, lid = r['last_node_id'], r['last_link_id']
T = {n.get('title'): n['id'] for n in r['nodes']}


def clone(i, title, pos, widgets=None):
    global nid
    nid += 1
    c = copy.deepcopy(by[i])
    c.update({'id': nid, 'pos': pos, 'order': 500 + nid, 'mode': 0})
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


def unlink(l_id):
    old = links.pop(l_id)
    by[old[1]]['outputs'][old[2]]['links'].remove(old[0])
    return old


def wire(s, sslot, dst, dname):
    global lid
    lid += 1
    ins = by[dst]['inputs']
    i = next(i for i in ins if i['name'] == dname)
    if i.get('link') is not None:
        unlink(i['link'])
    l = [lid, s, sslot, dst, ins.index(i), by[s]['outputs'][sslot]['type']]
    links[lid] = l
    by[s]['outputs'][sslot]['links'] = (by[s]['outputs'][sslot].get('links') or []) + [lid]
    i['link'] = lid


PIC = T['Input_Image_2']   # outputs: 0 image, 2 width, 3 height
READERS = (T['the photo to 1 MP'], T['picture 2: the reference itself when it is a mannequin'])
X, Y = 6000, 7400

on = clone(T['Input_Face_Crop'], 'Input_Ref_Head_Crop', [X, Y], [False])
det = clone(T['front: SAM3 face'], 'reference head: SAM3 face', [X + 300, Y])
wire(T['SAM3 Model'], 0, det, 'model')
wire(PIC, 0, det, 'image')
wire(T["SAM3 'face' only - finds WHERE the head is"], 0, det, 'conditioning')
bb = clone(T['front: face box'], 'reference head: face box', [X + 600, Y])
wire(det, 0, bb, 'mask')
fb = clone(T['front: face size'], 'reference head: face size', [X + 900, Y])
wire(bb, 1, fb, 'mpi_box')
pad = clone(T['front: half the longer face side'], 'reference head: half the longer face side', [X + 1200, Y])
wire(fb, 0, pad, 'a')
wire(fb, 1, pad, 'b')
sq = clone(T['front: the square (face + half a face all round)'], 'reference head: the square', [X + 1500, Y])
wire(det, 0, sq, 'mask')
wire(pad, 0, sq, 'padding')
# no face found: size 0, x = y = 0 -> the whole picture
w = clone(T['front: half the longer face side'], 'reference head: width (no face = the whole picture)',
          [X + 1800, Y - 150], ['a if a > 0 else b'])
wire(sq, 3, w, 'a')
wire(PIC, 2, w, 'b')
h = clone(T['front: half the longer face side'], 'reference head: height (no face = the whole picture)',
          [X + 1800, Y + 150], ['a if a > 0 else b'])
wire(sq, 3, h, 'a')
wire(PIC, 3, h, 'b')
sbox = clone(T['front: square box'], 'reference head: box', [X + 2100, Y])
wire(w, 0, sbox, 'width')
wire(h, 0, sbox, 'height')
wire(sq, 1, sbox, 'x')
wire(sq, 2, sbox, 'y')
crop = clone(T['front: the face square'], 'reference head: the crop', [X + 2400, Y])
wire(PIC, 0, crop, 'image')
wire(sbox, 0, crop, 'mpi_box')
pick = clone(T['picture 2: the reference itself when it is a mannequin'],
             'the reference: its head when Input_Ref_Head_Crop, else the picture', [X + 2700, Y], [True])
wire(crop, 0, pick, 'true')
wire(PIC, 0, pick, 'false')
wire(on, 0, pick, 'boolean')
for dst in READERS:
    name = 'image' if by[dst]['type'] == 'ImageScaleToTotalPixels' else 'true'
    wire(pick, 0, dst, name)

r['links'] = list(links.values())
r['last_node_id'], r['last_link_id'] = nid, lid
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(PATH, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'ref head crop: Input_Ref_Head_Crop {on} -> pick {pick} -> {READERS}')
