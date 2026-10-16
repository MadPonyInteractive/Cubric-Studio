"""MPI-1086 r44 (Fabio 2026-10-16, eye test flowCSE_052): the back pass cut the sheet at fixed quarters and STAMPED the
new back figure over 25-50%, so on a Character Sheet from Images sheet (front 7-24%, back 33-51%) the old back figure's
arm survived past 50% (a ghost). Now the sheet is STITCHED from pieces, cut where the app measured the gaps:
  Input_Cut_1 / Input_Cut_2 (px, 0 = the old quarter / half): front = the edit's [0, cut1), the back figure is drawn
  from it as before (cut1 wide), the rest = the edit's [cut2, W). Result = front | new back | rest, side by side: a
  sheet whose back panel was wider or narrower than the front comes back a little narrower or wider, never squashed.
With both cuts 0 the result is the old stamp's picture exactly (cut2 = W // 2 = the old paste's right edge).
Idempotent: refuses to run twice. Then: COMFY_URL=http://127.0.0.1:48188 node scripts/workflow-to-api.mjs <raw> > <api>
"""
import copy, json

PATH = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
raw = open(PATH, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'Input_Cut_1' for n in r['nodes']):
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
    """A core ImageStitch (none in this graph to clone): image1 | image2, heights equal, no spacing."""
    global nid
    nid += 1
    by[nid] = {'id': nid, 'type': 'ImageStitch', 'pos': pos, 'size': [270, 150], 'flags': {}, 'order': 300 + nid,
               'mode': 0, 'title': title,
               'inputs': [{'name': 'image1', 'type': 'IMAGE', 'link': None}, {'name': 'image2', 'type': 'IMAGE', 'link': None}],
               'outputs': [{'name': 'IMAGE', 'type': 'IMAGE', 'links': []}],
               'properties': {'Node name for S&R': 'ImageStitch'}, 'widgets_values': ['right', False, 0, 'white']}
    r['nodes'].append(by[nid])
    return nid


def src(dst, name):
    l = links[next(i for i in by[dst]['inputs'] if i['name'] == name)['link']]
    return l[1], l[2]


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


size = T['the edit size (back pass)']
cut1 = T['left 25%: the front body, and where the back panel starts']
crop = T['crop the EDITED front body']
back = T['the back figure to the back panel size']
comp = T['paste it over the back panel']
merged = T['the edit: with the redrawn back figure when Input_Back_Pass']
EDIT = 128
X, Y = 6000, 3000

# the cuts: injected px, 0 = the old quarter / half
in1 = clone(T['mannequin steps'], 'Input_Cut_1', [X, Y], [0])
in2 = clone(T['mannequin steps'], 'Input_Cut_2', [X, Y + 120], [0])
by[cut1]['title'] = 'cut 1: the front body ends, the back panel starts (Input_Cut_1, else 25%)'
by[cut1]['widgets_values'] = ['a // 4 * (b <= 0) + b * (b > 0)']
wire(in1, 0, cut1, 'b')
cut2 = clone(cut1, 'cut 2: the back panel ends (Input_Cut_2, else 50%)', [X + 320, Y + 120],
             ['a // 2 * (b <= 0) + b * (b > 0)'])
wire(size, 0, cut2, 'a')
wire(in2, 0, cut2, 'b')
rw = clone(cut1, 'the rest: its width', [X + 640, Y + 120], ['a - b'])
wire(size, 0, rw, 'a')
wire(cut2, 0, rw, 'b')
rbox = clone(T['the front body box'], 'the rest box (cut 2 to the right edge)', [X + 960, Y + 120], [512, 512, 0, 0])
wire(rw, 0, rbox, 'width', 'INT')
wire(size, 1, rbox, 'height', 'INT')
wire(cut2, 0, rbox, 'x', 'INT')
rcrop = clone(crop, 'crop the rest of the EDIT', [X + 1280, Y + 120], [False])
wire(EDIT, 0, rcrop, 'image')
wire(rbox, 0, rcrop, 'mpi_box')
st1 = stitch('front | new back', [X + 1600, Y])
wire(crop, 0, st1, 'image1')
wire(back, 0, st1, 'image2')
st2 = stitch('front | new back | the rest: the stitched sheet', [X + 1920, Y])
wire(st1, 0, st2, 'image1')
wire(rcrop, 0, st2, 'image2')
wire(st2, 0, merged, 'true')

# the stamp goes: nothing reads it now
for i in by[comp]['inputs']:
    if i.get('link') is not None:
        unlink(i['link'])
assert not any(by[comp]['outputs'][0].get('links') or []), 'the stamp still has a reader'
r['nodes'] = [n for n in r['nodes'] if n['id'] != comp]

r['links'] = list(links.values())
r['last_node_id'], r['last_link_id'] = nid, lid
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(PATH, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'stitch: Input_Cut_1 {in1}, Input_Cut_2 {in2}, cut2 {cut2}, rest {rcrop}, stitched {st2} -> {merged}.true; stamp {comp} removed')
