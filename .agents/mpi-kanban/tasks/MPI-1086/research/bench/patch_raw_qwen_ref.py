"""MPI-1086: put qh23's mannequin leg into the LiteGraph source comfy_workflows/raw/flow_character_sheet_edit_qwen.json
(then convert THIS file alone - never the full sync script). Hair FROM A PICTURE runs on this graph (r21-r23, 6/6).
Input_Image_2 (the raw photo) -> Klein 9B free edit (qh19.M4, seed qh16.MSEED, 1 MP) -> MpiClearVram -> a second
TextEncodeQwenImage21 with the mannequin as images.image_2. Three lazy MpiIfElse pick that encode only when a picture
is given AND Input_Reference is on (the Klein graph's node 70 rule), so Body shape runs exactly as before and never
loads Klein. Node shapes are CLONED from the Klein raw graph's free-edit path, so the widget order is the converter's.
Idempotent: refuses to run twice. usage: patch_raw_qwen_ref.py
"""
import copy, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh16
import qh19

P = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit_qwen.json'
K = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit.json'
raw = open(P, 'rb').read().decode('utf-8')
r = json.loads(raw)
kl = {n['id']: n for n in json.load(open(K, encoding='utf-8'))['nodes']}
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'Input_Image_2' for n in r['nodes']):
    sys.exit('already patched')
assert r['last_node_id'] == 135 and r['last_link_id'] == 24, (r['last_node_id'], r['last_link_id'])
L = {l[0]: l for l in r['links']}
assert [L[i][1:5] for i in (7, 8, 9)] == [[30, 0, 33, 1], [30, 1, 33, 2], [30, 2, 33, 3]], [L[i] for i in (7, 8, 9)]

nid, lid = 135, 24
Y = 900


def new_link(src, sslot, dst, dslot, typ):
    global lid
    lid += 1
    r['links'].append([lid, src, sslot, dst, dslot, typ])
    o = by[src]['outputs'][sslot]
    o['links'] = (o.get('links') or []) + [lid]
    return lid


def clone(n, title, pos, widgets=None):
    """A copy of node `n` (a Klein raw node, or one of this graph's) with no links, under a new id."""
    global nid
    nid += 1
    c = copy.deepcopy(n)
    c.update({'id': nid, 'pos': pos, 'order': 100 + nid, 'mode': 0})
    if title is None:
        c.pop('title', None)
    else:
        c['title'] = title
    for i in c['inputs']:
        i['link'] = None
    for o in c['outputs']:
        o['links'] = []
    if widgets is not None:
        c['widgets_values'] = widgets
    c.pop('widgets_values_named', None)
    r['nodes'].append(c)
    by[nid] = c
    return nid


def wire(src, sslot, dst, dname):
    i = next(i for i in by[dst]['inputs'] if i['name'] == dname)
    i['link'] = new_link(src, sslot, dst, by[dst]['inputs'].index(i), by[src]['outputs'][sslot]['type'])


def x(col):
    return 480 + 320 * col


photo = clone(kl[68], 'Input_Image_2', [0, Y])
want = clone(kl[69], 'Input_Reference', [0, Y + 260])
given = clone(kl[70], 'reference picture given AND wanted', [0, Y + 360])
unet = clone(kl[34], 'Klein 9B (the mannequin)', [x(0), Y])
clip = clone(kl[35], 'Klein text encoder', [x(0), Y + 120])
vae = clone(kl[36], 'Klein VAE', [x(0), Y + 240])
steps = clone(kl[37], 'mannequin steps', [x(0), Y + 340])
cfg = clone(kl[38], 'mannequin cfg', [x(0), Y + 420])
scale = clone(kl[71], 'the photo to 1 MP', [x(1), Y])
enc = clone(kl[42], 'encode the photo', [x(1), Y + 120])
size = clone(kl[43], 'photo size', [x(1), Y + 220])
text = clone(kl[44], 'mannequin prompt (qh19 M4, MPI-1086 r19)', [x(1), Y + 340], [qh19.M4])
zero = clone(kl[45], None, [x(2), Y])
ref = clone(kl[46], 'the photo as the reference', [x(2), Y + 100])
noise = clone(kl[48], 'mannequin seed (fixed: one mannequin per photo)', [x(2), Y + 200], [qh16.MSEED, 'fixed'])
samp = clone(kl[49], None, [x(2), Y + 320])
guide = clone(kl[50], None, [x(3), Y])
sched = clone(kl[51], None, [x(3), Y + 160])
run = clone(kl[52], 'mannequin sampler', [x(3), Y + 300])
dec = clone(kl[56], 'the mannequin', [x(4), Y])
free = clone(kl[60], 'free Klein before Qwen loads', [x(4), Y + 100])
qenc = clone(by[30], 'Qwen edit: picture 2 = the mannequin (hair from a picture)', [x(5), Y])
picks = [clone(kl[74], f'{what}: the mannequin encode when a picture is given', [x(6), Y + 120 * i], [True])
         for i, what in enumerate(('positive', 'negative', 'latent'))]

wire(photo, 4, given, 'a')
wire(want, 0, given, 'b')
wire(photo, 0, scale, 'image')
wire(scale, 0, enc, 'pixels')
wire(vae, 0, enc, 'vae')
wire(scale, 0, size, 'image')
wire(clip, 0, text, 'clip')
wire(text, 0, zero, 'conditioning')
wire(text, 0, ref, 'conditioning')
wire(enc, 0, ref, 'latent')
wire(unet, 0, guide, 'model')
wire(ref, 0, guide, 'positive')
wire(zero, 0, guide, 'negative')
wire(cfg, 0, guide, 'cfg')
wire(steps, 0, sched, 'steps')
wire(size, 0, sched, 'width')
wire(size, 1, sched, 'height')
wire(noise, 0, run, 'noise')
wire(guide, 0, run, 'guider')
wire(samp, 0, run, 'sampler')
wire(sched, 0, run, 'sigmas')
wire(enc, 0, run, 'latent_image')
wire(run, 0, dec, 'samples')
wire(vae, 0, dec, 'vae')
wire(dec, 0, free, 'passthrough')
# The second Qwen encode: the first one's own inputs, plus the mannequin as picture 2.
for name in ('clip', 'images.image_1', 'vae', 'prompt'):
    src = L[next(i for i in by[30]['inputs'] if i['name'] == name)['link']]
    wire(src[1], src[2], qenc, name)
wire(free, 0, qenc, 'images.image_2')
# KSampler's positive / negative / latent now come through the switches: the old links feed each `false`.
for slot, (pick, old) in enumerate(zip(picks, (7, 8, 9))):
    L[old][3:5] = [pick, 1]
    next(i for i in by[pick]['inputs'] if i['name'] == 'false')['link'] = old
    wire(qenc, slot, pick, 'true')
    wire(given, 0, pick, 'boolean')
    wire(pick, 0, 33, ('positive', 'negative', 'latent_image')[slot])

r['last_node_id'], r['last_link_id'] = nid, lid
nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(P, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'patched: nodes 136-{nid}, links 25-{lid}; KSampler 33 positive/negative/latent -> the switches')
