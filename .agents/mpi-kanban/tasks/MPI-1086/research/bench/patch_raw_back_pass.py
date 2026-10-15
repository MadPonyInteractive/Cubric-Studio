"""MPI-1086 r37 (Fabio 2026-10-15): the Qwen editor graph gets a SECOND pass that redraws the back figure from the
EDITED front figure, so no single pass sees two views of one side (a one-sided tattoo flipped sides on the back view).
  Input_Back_Pass (bool) + Input_Positive_2 (text, "Turn the character in image 1 around ..."): on, the edit's left
  25% (the front body) is scaled to ~1 MP (448 x 1120 -> 640 x 1600, as qh37), edited by the same Qwen model with the
  same seed, scaled back to the panel and pasted over the back panel (x = width // 4). Off, a lazy MpiIfElse never
  asks for it, so not one node of the pass runs.
Every consumer of the edit (Output_Image_2, the headless gate, the run's-last-picture if/else) reads the merged
picture. Nodes are CLONED from this graph, so widget orders are the converter's. Idempotent: refuses to run twice.
Then: node scripts/workflow-to-api.mjs <raw> <api> and node scripts/validate-injection-rules.mjs.
"""
import copy, json

PATH = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
raw = open(PATH, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'Input_Back_Pass' for n in r['nodes']):
    raise SystemExit('already patched')
links = {l[0]: l for l in r['links']}
nid, lid = r['last_node_id'], r['last_link_id']
T = {n.get('title'): n['id'] for n in r['nodes']}


def src(dst, name):
    l = links[next(i for i in by[dst]['inputs'] if i['name'] == name)['link']]
    return l[1], l[2]


def clone(i, title, pos, widgets=None):
    global nid
    nid += 1
    c = copy.deepcopy(by[i])
    c.update({'id': nid, 'pos': pos, 'order': 300 + nid, 'mode': 0})
    if title:
        c['title'] = title
    else:
        c.pop('title', None)
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


def wire(s, sslot, dst, dname, widget_type=None):
    global lid
    lid += 1
    ins = by[dst]['inputs']
    i = next((i for i in ins if i['name'] == dname), None)
    if i is None:   # a widget turned into a socket
        i = {'name': dname, 'type': widget_type, 'widget': {'name': dname}, 'link': None}
        ins.append(i)
    if i.get('link') is not None:
        old = links.pop(i['link'])
        by[old[1]]['outputs'][old[2]]['links'].remove(old[0])
    l = [lid, s, sslot, dst, ins.index(i), by[s]['outputs'][sslot]['type']]
    links[lid] = l
    by[s]['outputs'][sslot]['links'] = (by[s]['outputs'][sslot].get('links') or []) + [lid]
    i['link'] = lid


EDIT = 128   # ImageScale "back to the sheet's own size": the edit
consumers = [(links[x][3], links[x][4]) for x in by[EDIT]['outputs'][0]['links']]
X, Y = 6000, 2600
flag = clone(T['Input_Reference'], 'Input_Back_Pass', [X, Y], [False])
text = clone(T['Input_Positive'], 'Input_Positive_2', [X, Y + 120], [''])
size = clone(169, 'the edit size (back pass)', [X + 320, Y])
quarter = clone(177, 'left 25%: the front body, and where the back panel starts', [X + 640, Y], ['a // 4'])
box = clone(170, 'the front body box', [X + 960, Y], [512, 512, 0, 0])
crop = clone(176, 'crop the EDITED front body', [X + 1280, Y], [False])
mp = clone(144, 'the front body to ~1 MP (448 x 1120 -> 640 x 1600, MPI-1086 r37)', [X + 1600, Y], ['lanczos', 0.9766, 16])
enc = clone(30, 'Qwen: picture 1 = the edited front body, own size', [X + 1920, Y], ['', '', 0])
ks = clone(33, 'KSampler (back pass)', [X + 2240, Y])
dec = clone(34, 'VAE Decode (back pass)', [X + 2560, Y])
alpha = clone(46, 'drop alpha (back pass)', [X + 2880, Y])
back = clone(EDIT, 'the back figure to the back panel size', [X + 3200, Y], ['lanczos', 512, 512, 'disabled'])
comp = clone(180, 'paste it over the back panel', [X + 3520, Y], [0, 0, False])
merged = clone(195, 'the edit: with the redrawn back figure when Input_Back_Pass', [X + 3840, Y], [True])

wire(EDIT, 0, size, 'image')
wire(size, 0, quarter, 'a')
wire(quarter, 0, box, 'width')
wire(size, 1, box, 'height')
wire(EDIT, 0, crop, 'image')
wire(box, 0, crop, 'mpi_box')
wire(crop, 0, mp, 'image')
for name in ('clip', 'vae'):
    wire(*src(30, name), enc, name)
wire(mp, 0, enc, 'images.image_1')
wire(text, 0, enc, 'prompt')
wire(*src(33, 'model'), ks, 'model')
wire(*src(33, 'seed'), ks, 'seed')
wire(enc, 0, ks, 'positive')
wire(enc, 1, ks, 'negative')
wire(enc, 2, ks, 'latent_image')
wire(ks, 0, dec, 'samples')
wire(*src(34, 'vae'), dec, 'vae')
wire(dec, 0, alpha, 'image')
wire(alpha, 0, back, 'image')
wire(quarter, 0, back, 'width')
wire(size, 1, back, 'height')
wire(EDIT, 0, comp, 'destination')
wire(back, 0, comp, 'source')
mask = next(i for i in by[comp]['inputs'] if i['name'] == 'mask')
by[comp]['inputs'].remove(mask)   # no mask: the whole panel
for i, x in enumerate(by[comp]['inputs']):
    if x.get('link') is not None:
        links[x['link']][4] = i
wire(quarter, 0, comp, 'x', 'INT')
wire(comp, 0, merged, 'true')
wire(EDIT, 0, merged, 'false')
wire(flag, 0, merged, 'boolean')
for dst, slot in consumers:
    wire(merged, 0, dst, by[dst]['inputs'][slot]['name'])

r['links'] = list(links.values())
r['last_node_id'], r['last_link_id'] = nid, lid
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(PATH, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'back pass {flag}..{merged}; edit consumers {consumers} now read {merged}')
