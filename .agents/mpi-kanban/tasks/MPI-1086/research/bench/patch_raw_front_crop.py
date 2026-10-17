"""MPI-1086 ff1 (Fabio 2026-10-17, eye test flowCSE_069 "A basketball under his arm"): Accessories pass 1 saw the
whole sheet, so the words had to name the back figure too ("the character seen from behind") and Qwen put the ball on
the back view only; the front came back bare, and pass 1's back-view ball outlived the back pass right of cut 2 (the
sliver beside the close-up). Input_Front_Crop: pass 1 sees ONLY the front body and the close-up, side by side
(the front panel [0, cut1) | the close-up panel [cut2, W) of the sheet), so no back figure is in the picture. The
edit is cut apart again and the sheet rebuilt: edited front | the ORIGINAL back panel | edited close-up, the same
width as the sheet. The back pass then turns the edited front round, as before; with Input_Front_Crop off nothing
changes. Idempotent: refuses to run twice. Then: COMFY_URL=http://127.0.0.1:8188 node scripts/workflow-to-api.mjs <raw> > <api>
"""
import copy, json

PATH = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
raw = open(PATH, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'Input_Front_Crop' for n in r['nodes']):
    raise SystemExit('already patched')
links = {l[0]: l for l in r['links']}
nid, lid = r['last_node_id'], r['last_link_id']
T = {n.get('title'): n['id'] for n in r['nodes']}


def clone(i, title, pos, widgets=None):
    global nid
    nid += 1
    c = copy.deepcopy(by[i])
    c.update({'id': nid, 'pos': pos, 'order': 300 + nid, 'mode': 0})
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


def stitch(title, pos):
    """A core ImageStitch: image1 | image2, heights equal, no spacing."""
    return clone(T['front | new back'], title, pos)


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


SHEET = T['Input_Image']
cut1 = T['face crop: the front panel ends (Input_Cut_1, else 25%)']
cut2 = T['face crop: the close-up panel starts (Input_Cut_2, else 50%)']
cw = T['face crop: the close-up panel width']
front = T['front panel crop']
close = T['close-up panel crop']
pic1 = T['picture 1: the face canvas when Input_Face_Crop, else the sheet']
decoded = T['drop alpha (2.1 VAE decodes RGBA)']
edit = T["back to the sheet's own size"]
faces = T['the edit: the faces pasted back when Input_Face_Crop']
X, Y = 6000, 4200

on = clone(T['Input_Face_Crop'], 'Input_Front_Crop', [X, Y], [False])
canvas = stitch('the front canvas: front body | close-up', [X + 320, Y])
wire(front, 0, canvas, 'image1')
wire(close, 0, canvas, 'image2')
pic = clone(pic1, 'picture 1: the front canvas when Input_Front_Crop, else as before', [X + 640, Y], [True])
wire(canvas, 0, pic, 'true')
wire(pic1, 0, pic, 'false')
wire(on, 0, pic, 'boolean')
for reader in (T['Qwen edit: picture 1 = the sheet, own size (resolution 0)'],
               T['Qwen edit: picture 2 = the mannequin (hair from a picture)']):
    wire(pic, 0, reader, 'images.image_1')
assert [links[l][3] for l in by[pic1]['outputs'][0]['links']] == [pic], 'picture 1 still has another reader'

# the edit at the canvas size, cut apart again
w = clone(cut1, 'front canvas width', [X, Y + 200], ['a + b'])
wire(cut1, 0, w, 'a')
wire(cw, 0, w, 'b')
sc = clone(edit, 'the front edit at the canvas size', [X + 320, Y + 200])
wire(decoded, 0, sc, 'image')
wire(w, 0, sc, 'width', 'INT')
wire(SHEET, 3, sc, 'height', 'INT')
fbox = clone(T['front panel'], 'front canvas: the body box', [X + 640, Y + 200], [512, 512, 0, 0])
wire(cut1, 0, fbox, 'width', 'INT')
wire(SHEET, 3, fbox, 'height', 'INT')
fcrop = clone(front, 'front canvas: the edited body', [X + 960, Y + 200], [False])
wire(sc, 0, fcrop, 'image')
wire(fbox, 0, fcrop, 'mpi_box')
cbox = clone(T['close-up panel'], 'front canvas: the close-up box', [X + 640, Y + 360], [512, 512, 0, 0])
wire(cw, 0, cbox, 'width', 'INT')
wire(SHEET, 3, cbox, 'height', 'INT')
wire(cut1, 0, cbox, 'x', 'INT')
ccrop = clone(close, 'front canvas: the edited close-up', [X + 960, Y + 360], [False])
wire(sc, 0, ccrop, 'image')
wire(cbox, 0, ccrop, 'mpi_box')

# the sheet's own back panel [cut1, cut2), untouched
bw = clone(cut1, 'front canvas: the back panel width', [X, Y + 520], ['b - a'])
wire(cut1, 0, bw, 'a')
wire(cut2, 0, bw, 'b')
bbox = clone(T['close-up panel'], 'front canvas: the back panel box', [X + 640, Y + 520], [512, 512, 0, 0])
wire(bw, 0, bbox, 'width', 'INT')
wire(SHEET, 3, bbox, 'height', 'INT')
wire(cut1, 0, bbox, 'x', 'INT')
bcrop = clone(close, 'front canvas: the ORIGINAL back panel', [X + 960, Y + 520], [False])
wire(SHEET, 0, bcrop, 'image')
wire(bbox, 0, bcrop, 'mpi_box')

s1 = stitch('edited front | original back', [X + 1280, Y + 200])
wire(fcrop, 0, s1, 'image1')
wire(bcrop, 0, s1, 'image2')
s2 = stitch('edited front | original back | edited close-up: the sheet', [X + 1600, Y + 200])
wire(s1, 0, s2, 'image1')
wire(ccrop, 0, s2, 'image2')
ed = clone(pic1, 'the edit: the sheet rebuilt when Input_Front_Crop, else the edit', [X + 1920, Y + 200], [True])
wire(s2, 0, ed, 'true')
wire(edit, 0, ed, 'false')
wire(on, 0, ed, 'boolean')
wire(ed, 0, faces, 'false')

r['links'] = list(links.values())
r['last_node_id'], r['last_link_id'] = nid, lid
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(PATH, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'front crop: Input_Front_Crop {on}, picture 1 {pic}, rebuilt sheet {s2} -> {ed} -> {faces}.false')
