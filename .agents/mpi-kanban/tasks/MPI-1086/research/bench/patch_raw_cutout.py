"""MPI-1086: put the Hairstyle reference cut-out (qh13.hair_cutout with qh14's SAM3 "hair") into the LiteGraph source
comfy_workflows/raw/flow_character_sheet_edit.json, after patch_raw.py (the brow cut). At lock 2 the reference
picture reaching Klein is its hair alone on mid grey; every other lock gets the picture as before.
Idempotent: refuses to run twice. usage: patch_raw_cutout.py
"""
import json, sys

P = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit.json'
raw = open(P, 'rb').read().decode('utf-8')
r = json.loads(raw)
by = {n['id']: n for n in r['nodes']}
if any(n.get('title', '').startswith('reference: cut out') for n in r['nodes']):
    sys.exit('already patched')
assert r['last_node_id'] == 96 and r['last_link_id'] == 167, (r['last_node_id'], r['last_link_id'])
L = {l[0]: l for l in r['links']}
assert L[117][1:5] == [68, 0, 71, 0], L[117]
model_type = L[next(i['link'] for i in by[19]['inputs'] if i['name'] == 'model')][5]

nid, lid = 96, 167


def new_link(src, sslot, dst, dslot, typ):
    global lid
    lid += 1
    r['links'].append([lid, src, sslot, dst, dslot, typ])
    o = by[src]['outputs'][sslot]
    o['links'] = (o.get('links') or []) + [lid]
    o['slot_index'] = sslot
    return lid


def node(typ, title, pos, size, inputs, outputs, widgets, core=True):
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


def wire(src, sslot, dst, dname, typ=None):
    i = next(i for i in by[dst]['inputs'] if i['name'] == dname)
    i['link'] = new_link(src, sslot, dst, by[dst]['inputs'].index(i), typ or by[src]['outputs'][sslot]['type'])


Y = 1620
enc = node('CLIPTextEncode', 'SAM3 "hair" (the reference)', [380, Y], [300, 100],
           [('clip', 'CLIP', False)], [('CONDITIONING', 'CONDITIONING')], ['hair'])
sam = node('SAM3_Detect', 'SAM3 reference hair', [380, Y + 140], [330, 210],
           [('model', 'MODEL', False), ('image', 'IMAGE', False), ('conditioning', 'CONDITIONING', False),
            ('bboxes', 'BOUNDING_BOX', False), ('positive_coords', 'STRING', False), ('negative_coords', 'STRING', False)],
           [('masks', 'MASK'), ('bboxes', 'BOUNDING_BOX')], list(by[76]['widgets_values']))
size = node('GetImageSize', 'reference size', [0, Y + 400], [240, 120], [('image', 'IMAGE', False)],
            [('width', 'INT'), ('height', 'INT'), ('batch_size', 'INT')], [])
grey = node('EmptyImage', 'mid grey', [380, Y + 400], [300, 150], [('width', 'INT', True), ('height', 'INT', True)],
            [('IMAGE', 'IMAGE')], [512, 512, 1, 8421504])
comp = node('ImageCompositeMasked', 'reference: the hair on grey', [760, Y + 140], [300, 150],
            [('destination', 'IMAGE', False), ('source', 'IMAGE', False), ('mask', 'MASK', False)], [('IMAGE', 'IMAGE')],
            [0, 0, False])
lock2 = node('MpiCompare', 'hairstyle lock? (Input_Lock == 2)', [760, Y], [300, 110],
             [('a', '*', False), ('b', '*', False)], [('result', 'BOOLEAN')], ['==', 2], core=False)
pick = node('MpiIfElse', 'reference: cut out to the hair at lock 2', [1120, Y], [240, 80],
            [('true', '*', False), ('false', '*', False), ('boolean', 'BOOLEAN', True)], [('output', '*')], [True], core=False)

wire(13, 1, enc, 'clip')
wire(13, 0, sam, 'model', model_type)
wire(68, 0, sam, 'image')
wire(enc, 0, sam, 'conditioning')
wire(68, 0, size, 'image')
wire(size, 0, grey, 'width')
wire(size, 1, grey, 'height')
wire(grey, 0, comp, 'destination')
wire(68, 0, comp, 'source')
wire(sam, 0, comp, 'mask')
wire(5, 0, lock2, 'a')
wire(comp, 0, pick, 'true')
wire(lock2, 0, pick, 'boolean')
# The reference reaches its scaler through the switch: the old 68 -> 71 link now feeds the switch's `false`.
L[117][3:5] = [pick, 1]
next(i for i in by[pick]['inputs'] if i['name'] == 'false')['link'] = 117
wire(pick, 0, 71, 'image')

r['last_node_id'], r['last_link_id'] = nid, lid
g = next(g for g in r['groups'] if g['title'].startswith('Reference picture'))
g['bounding'][3] = max(g['bounding'][3], Y + 600 - g['bounding'][1])

nl = '\r\n' if '\r\n' in raw else '\n'
out = json.dumps(r, indent=2, ensure_ascii=False).replace('\n', nl)
open(P, 'wb').write((out + (nl if raw.endswith(('\n', '\r\n')) else '')).encode('utf-8'))
print(f'patched: nodes 97-{nid}, links 168-{lid}, link 117 -> the lock-2 switch')
