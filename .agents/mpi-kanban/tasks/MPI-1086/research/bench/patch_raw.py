"""MPI-1086: put qh2's B3 brow cut into the LiteGraph source comfy_workflows/raw/flow_character_sheet_edit.json
(then convert THIS file alone - never the full sync script, it commits peers' raw files). Same nodes, wiring and values
as qh2.brow_cut(g, 'a + b // 3'). Idempotent: refuses to run twice. usage: patch_raw.py
"""
import json, sys

P = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit.json'
EXPR = 'a + b // 3'
raw = open(P, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title', '').endswith('cut at the brows') for n in r['nodes']):
    sys.exit('already patched')
assert r['last_node_id'] == 82 and r['last_link_id'] == 139, (r['last_node_id'], r['last_link_id'])
L = {l[0]: l for l in r['links']}
assert L[42][1:5] == [19, 0, 27, 1] and L[47][1:5] == [23, 0, 29, 1], (L[42], L[47])

nid, lid = 82, 139


def new_link(src, sslot, dst, dslot, typ):
    global lid
    lid += 1
    r['links'].append([lid, src, sslot, dst, dslot, typ])
    o = by[src]['outputs'][sslot]
    o['links'] = (o.get('links') or []) + [lid]
    o['slot_index'] = sslot
    return lid


def node(typ, title, pos, size, inputs, outputs, widgets, core=False):
    global nid
    nid += 1
    n = {'id': nid, 'type': typ, 'pos': pos, 'size': size, 'flags': {}, 'order': 100 + nid, 'mode': 0,
         'inputs': [{'name': a, 'type': t, 'link': None, **({'widget': {'name': a}} if w else {})} for a, t, w in inputs],
         'outputs': [{'name': o, 'type': t, 'links': []} for o, t in outputs],
         'properties': {'cnr_id': 'comfy-core' if core else 'ComfyUi-MpiNodes', 'Node name for S&R': typ},
         'widgets_values': widgets, 'title': title}
    if core:
        n['properties']['ver'] = '0.39.0'
    r['nodes'].append(n)
    by[nid] = n
    return nid


def wire(src, sslot, dst, dname):
    i = next(i for i in by[dst]['inputs'] if i['name'] == dname)
    slot = by[dst]['inputs'].index(i)
    i['link'] = new_link(src, sslot, dst, slot, by[src]['outputs'][sslot]['type'])


for row, (sam, crop, width, comp, old, side) in enumerate(((19, 18, 7, 27, 42, 'front'), (23, 22, 10, 29, 47, 'portrait'))):
    y = 1560 + 220 * row
    bbox = node('MpiMaskBbox', f'{side} face box (lock 2)', [760, y], [300, 120], [('mask', 'MASK', False)],
                [('mask', 'MASK'), ('mpi_box', 'MPI_BOX'), ('width', 'INT'), ('height', 'INT')], [0, 1])
    nums = node('MpiFromBox', f'{side} face box numbers', [1100, y], [260, 120], [('mpi_box', 'MPI_BOX', False)],
                [('width', 'INT'), ('height', 'INT'), ('x', 'INT'), ('y', 'INT')], [])
    brow = node('MpiMath', f'{side} brow line = face top + a third', [1400, y], [300, 110],
                [('a', '*', False), ('b', '*', False), ('c', '*', False)], [('result', '*')], [EXPR])
    box = node('MpiBox', f'{side}: brow line down', [1740, y], [300, 150],
               [('width', 'INT', True), ('height', 'INT', True), ('y', 'INT', True)], [('mpi_box', 'MPI_BOX')], [512, 512, 0, 0])
    bmask = node('MpiBoxMask', f'{side}: brow-line-down mask', [2080, y], [300, 80],
                 [('image', 'IMAGE', False), ('mpi_box', 'MPI_BOX', False)], [('mask', 'MASK'), ('mpi_box', 'MPI_BOX')], [])
    cut = node('MaskComposite', f'{side} face lock cut at the brows', [2420, y], [300, 150],
               [('destination', 'MASK', False), ('source', 'MASK', False)], [('MASK', 'MASK')], [0, 0, 'multiply'], core=True)
    pick = node('MpiIfElse', f'{side} lock: whole at lock 1, from the brows at lock 2', [2760, y], [240, 80],
                [('true', '*', False), ('false', '*', False), ('boolean', 'BOOLEAN', True)], [('output', '*')], [True])
    wire(sam, 0, bbox, 'mask')
    wire(bbox, 1, nums, 'mpi_box')
    wire(nums, 3, brow, 'a')
    wire(nums, 1, brow, 'b')
    wire(width, 0, box, 'width')
    wire(2, 3, box, 'height')
    wire(brow, 0, box, 'y')
    wire(crop, 0, bmask, 'image')
    wire(box, 0, bmask, 'mpi_box')
    wire(sam, 0, cut, 'destination')
    wire(bmask, 0, cut, 'source')
    wire(12, 0, pick, 'boolean')
    # The SAM3 mask now reaches the paste through the switch: the old link feeds the switch's `true`.
    L[old][3:5] = [pick, 0]
    next(i for i in by[pick]['inputs'] if i['name'] == 'true')['link'] = old
    wire(cut, 0, pick, 'false')
    wire(pick, 0, comp, 'source')

r['last_node_id'], r['last_link_id'] = nid, lid
g = next(g for g in r['groups'] if g['title'].startswith('SAM3 lock mask'))
g['bounding'][3] = max(g['bounding'][3], 1560 + 220 + 200 - g['bounding'][1])
g['bounding'][2] = max(g['bounding'][2], 3040 - g['bounding'][0])

nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(P, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'patched: nodes 83-{nid}, links 140-{lid}, links 42/47 -> the lock-2 switches')
