"""MPI-1090: put qg4's shoulder lock into the LiteGraph source comfy_workflows/raw/flow_character_sheet_edit.json
(then `node scripts/sync-raw-workflows.mjs` converts it). Same nodes, wiring and values as qg4.shoulder_lock.
Idempotent: refuses to run twice. usage: patch_raw.py
"""
import copy, json, sys

P = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit.json'
raw = open(P, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title') == 'back lock cut at the shoulders' for n in r['nodes']):
    sys.exit('already patched')
assert r['last_node_id'] == 74 and r['last_link_id'] == 124, (r['last_node_id'], r['last_link_id'])
L = {l[0]: l for l in r['links']}
assert L[36][1:5] == [21, 0, 25, 0], L[36]

links = []


def link(lid, src, sslot, dst, dslot, typ):
    links.append([lid, src, sslot, dst, dslot, typ])
    by[src]['outputs'][sslot].setdefault('links', [])
    by[src]['outputs'][sslot]['links'] = (by[src]['outputs'][sslot]['links'] or []) + [lid]
    by[src]['outputs'][sslot]['slot_index'] = sslot


def node(nid, typ, title, pos, size, inputs, outputs, widgets, cnr='ComfyUi-MpiNodes'):
    n = {'id': nid, 'type': typ, 'pos': pos, 'size': size, 'flags': {}, 'order': 100 + nid, 'mode': 0,
         'inputs': inputs, 'outputs': [{'name': o, 'type': t, 'links': []} for o, t in outputs],
         'properties': {'cnr_id': cnr, 'Node name for S&R': typ}, 'widgets_values': widgets, 'title': title}
    if cnr == 'comfy-core':
        n['properties']['ver'] = '0.39.0'
    r['nodes'].append(n)
    by[nid] = n
    return n


def inp(name, typ, lid, widget=False):
    d = {'name': name, 'type': typ, 'link': lid}
    if widget:
        d['widget'] = {'name': name}
    return d


Y1, Y2 = 1120, 1340
n75 = copy.deepcopy(by[17])
n75.update({'id': 75, 'pos': [760, Y1], 'order': 175, 'title': 'SAM3 "face" (the chin line)'})
n75['inputs'] = [inp('clip', 'CLIP', 125), inp('text', 'STRING', 126, True)]
n75['outputs'] = [{'name': 'CONDITIONING', 'type': 'CONDITIONING', 'links': []}]
r['nodes'].append(n75); by[75] = n75
n76 = copy.deepcopy(by[19])
n76.update({'id': 76, 'pos': [1160, Y1], 'order': 176, 'title': 'SAM3 face, front body'})
for i in n76['inputs']:
    i['link'] = {'model': 127, 'image': 128, 'conditioning': 129}.get(i['name'])
for o in n76['outputs']:
    o['links'] = []
r['nodes'].append(n76); by[76] = n76
node(77, 'MpiMaskBbox', 'front face box', [1520, Y1], [300, 120], [inp('mask', 'MASK', 130)],
     [('mask', 'MASK'), ('mpi_box', 'MPI_BOX'), ('width', 'INT'), ('height', 'INT')], [0, 1])
node(78, 'MpiFromBox', 'face box numbers', [1900, Y1], [260, 120], [inp('mpi_box', 'MPI_BOX', 131)],
     [('width', 'INT'), ('height', 'INT'), ('x', 'INT'), ('y', 'INT')], [])
n79 = copy.deepcopy(by[9])
n79.update({'id': 79, 'pos': [2260, Y1], 'order': 179, 'title': 'shoulder line = chin + half a face',
            'widgets_values': ['a + b + b // 2']})
n79['inputs'] = [inp('a', '*', 132), inp('b', '*', 133), inp('c', '*', None)]
n79['outputs'] = [{'name': 'result', 'type': '*', 'links': []}]
r['nodes'].append(n79); by[79] = n79
node(80, 'MpiBox', 'back body above the shoulders', [1160, Y2], [300, 150],
     [inp('width', 'INT', 134, True), inp('height', 'INT', 135, True)], [('mpi_box', 'MPI_BOX')], [512, 512, 0, 0])
node(81, 'MpiBoxMask', 'back body: above-the-shoulders mask', [1520, Y2], [300, 80],
     [inp('image', 'IMAGE', 136), inp('mpi_box', 'MPI_BOX', 137)], [('mask', 'MASK'), ('mpi_box', 'MPI_BOX')], [])
n82 = copy.deepcopy(by[27])
n82.update({'id': 82, 'pos': [1900, Y2], 'order': 182, 'title': 'back lock cut at the shoulders',
            'widgets_values': [0, 0, 'multiply']})
n82['inputs'] = [inp('destination', 'MASK', 36), inp('source', 'MASK', 138)]
n82['outputs'] = [{'name': 'MASK', 'type': 'MASK', 'links': []}]
r['nodes'].append(n82); by[82] = n82

# model loader 13: slot 0 MODEL (SAM3), slot 1 CLIP - the same slots nodes 19 and 17 read.
model_type = L[next(i['link'] for i in by[19]['inputs'] if i['name'] == 'model')][5]
link(125, 13, 1, 75, 0, 'CLIP')
link(126, 15, 0, 75, 1, 'STRING')
link(127, 13, 0, 76, 0, model_type)
link(128, 18, 0, 76, 1, 'IMAGE')
link(129, 75, 0, 76, 2, 'CONDITIONING')
link(130, 76, 0, 77, 0, 'MASK')
link(131, 77, 1, 78, 0, 'MPI_BOX')
link(132, 78, 3, 79, 0, 'INT')
link(133, 78, 1, 79, 1, 'INT')
link(134, 9, 0, 80, 0, 'INT')
link(135, 79, 0, 80, 1, 'INT')
link(136, 20, 0, 81, 0, 'IMAGE')
link(137, 80, 0, 81, 1, 'MPI_BOX')
link(138, 81, 0, 82, 1, 'MASK')
link(139, 82, 0, 25, 0, 'MASK')
# The back SAM3 now feeds the cut, and the cut feeds the lock-1 switch.
L[36][3:5] = [82, 0]
next(i for i in by[25]['inputs'] if i['name'] == 'true')['link'] = 139
r['links'] += links
r['last_node_id'], r['last_link_id'] = 82, 139
g = next(g for g in r['groups'] if g['title'].startswith('SAM3 lock mask'))
g['bounding'][3] = max(g['bounding'][3], Y2 + 200 - g['bounding'][1])

nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(P, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print('patched: nodes 75-82, links 125-139, link 36 -> 82')
