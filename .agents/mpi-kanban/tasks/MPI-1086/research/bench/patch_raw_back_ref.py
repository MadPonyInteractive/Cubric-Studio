"""MPI-1086 ac2 (Fabio 2026-10-17): the back pass ALSO sees the sheet's ORIGINAL back figure as image 2, so it keeps
the outfit's back (pass 2 from the edited front alone redrew a strappy open back as a halter, 12/12 in r38, and again
in ac2 B1) while still taking the accessory or tattoo from the edited front (image 1).
  the input sheet (Input_Image) cropped at the measured cuts (cut 1 .. cut 2), scaled to ~1 MP like the front body,
  -> `images.image_2` of the back pass's Qwen encoder.
Nodes are CLONED from this graph, so widget orders are the converter's. Idempotent: refuses to run twice.
Then: node scripts/workflow-to-api.mjs <raw> <api> and node scripts/validate-injection-rules.mjs.
"""
import copy, json

PATH = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
raw = open(PATH, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'crop the ORIGINAL back figure (back pass image 2)' for n in r['nodes']):
    raise SystemExit('already patched')
links = {l[0]: l for l in r['links']}
nid, lid = r['last_node_id'], r['last_link_id']
T = {n.get('title'): n['id'] for n in r['nodes']}


def clone(i, title, pos, widgets=None):
    global nid
    nid += 1
    c = copy.deepcopy(by[i])
    c.update({'id': nid, 'pos': pos, 'order': 300 + nid, 'mode': 0, 'title': title})
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


def wire(s, sslot, dst, dname):
    global lid
    lid += 1
    ins = by[dst]['inputs']
    i = next(i for i in ins if i['name'] == dname)
    if i.get('link') is not None:
        old = links.pop(i['link'])
        by[old[1]]['outputs'][old[2]]['links'].remove(old[0])
    l = [lid, s, sslot, dst, ins.index(i), by[s]['outputs'][sslot]['type']]
    links[lid] = l
    by[s]['outputs'][sslot]['links'] = (by[s]['outputs'][sslot].get('links') or []) + [lid]
    i['link'] = lid


CUT1, CUT2, SIZE, REST, CROP, MP, ENC = 200, 214, 199, 216, 202, 203, 204
X, Y = 7900, 3000
width = clone(CUT2, 'back panel width (back pass image 2)', [X, Y], ['b - a'])
box = clone(REST, 'the back panel box (back pass image 2)', [X + 320, Y])
crop = clone(CROP, 'crop the ORIGINAL back figure (back pass image 2)', [X + 640, Y])
mp = clone(MP, 'the original back figure to ~1 MP', [X + 960, Y])

wire(CUT1, 0, width, 'a')
wire(CUT2, 0, width, 'b')
wire(CUT1, 0, box, 'x')
wire(width, 0, box, 'width')
wire(SIZE, 1, box, 'height')
wire(T['Input_Image'], 0, crop, 'image')
wire(box, 0, crop, 'mpi_box')
wire(crop, 0, mp, 'image')
wire(mp, 0, ENC, 'images.image_2')

r['links'] = list(links.values())
r['last_node_id'], r['last_link_id'] = nid, lid
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(PATH, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'back pass image 2: nodes {width}..{mp} -> {ENC}.images.image_2')
