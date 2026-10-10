"""MPI-1060 Phase 4: the two_stage_run.py insert(g, 'A') design, written into the LiteGraph raw template.

Same node ids (900-915) and the same wiring as the API-level insert that ran on the bench (results.md § Two-stage
proof), so the converted API graph must equal insert(shipped, 'A') up to the generator's own baking. Donor nodes are
cloned (never hand-written) from this template, flow_ltx_extend.json (ImageResizeKJv2) and ltx_v2v_lipdub_template.json
(the IC LoRA loader and guide); RepeatImageBatch has no donor in raw/ and is built from the engine's /object_info shape.

usage (repo root): python -I <this file> [--write]     without --write: checks only, writes nothing
"""
import copy, hashlib, json, sys, urllib.request

RAW = 'comfy_workflows/raw/ltx_i2v_t2v_template.json'
LORA = 'ltx-2.3\\ltx-2.3-22b-ic-lora-ingredients-0.9.safetensors'
BENCH = 'http://127.0.0.1:8188/api/userdata/workflows%2Fltx_i2v_t2v_template.json'


def ser(w):
    # measured: this file round-trips as LF, ensure_ascii=False, NO trailing newline
    return json.dumps(w, indent=2, ensure_ascii=False).encode('utf-8')


raw = open(RAW, 'rb').read()
w = json.loads(raw)
assert ser(w) == raw, 'serialiser does not round-trip this file: refusing'
before = {n['id']: (json.dumps(n['pos']), json.dumps(n['size'])) for n in w['nodes']}
N = {n['id']: n for n in w['nodes']}
LINKS = {l[0]: l for l in w['links']}
assert not any(i in N for i in range(900, 916)), 'ids 900-915 taken'


def donor(path, pred):
    g = json.load(open(path, encoding='utf-8'))
    return copy.deepcopy(next(n for n in g['nodes'] if pred(n)))


def place(node, nid, title, pos):
    node['id'] = nid
    node['pos'] = list(pos)
    node['mode'] = 0
    node['flags'] = {}
    node['order'] = 0
    if title:
        node['title'] = title
    else:
        node.pop('title', None)
    for i in node.get('inputs', []):
        i['link'] = None
    for o in node.get('outputs', []):
        o['links'] = []
    w['nodes'].append(node)
    N[nid] = node
    return node


def link(src, sslot, dst, dname, typ=None):
    """A new link src.out[sslot] -> dst.input named dname."""
    w['last_link_id'] += 1
    lid = w['last_link_id']
    o = N[src]['outputs'][sslot]
    typ = typ or o['type']
    i = next(x for x in N[dst]['inputs'] if x['name'] == dname)
    assert i['link'] is None, (dst, dname)
    i['link'] = lid
    o['links'] = (o.get('links') or []) + [lid]
    w['links'].append([lid, src, sslot, dst, next(k for k, x in enumerate(N[dst]['inputs']) if x['name'] == dname), typ])
    LINKS[lid] = w['links'][-1]


def repoint(lid, src, sslot):
    """Move an existing link's ORIGIN (its consumer keeps it)."""
    l = LINKS[lid]
    old = N[l[1]]['outputs'][l[2]]
    old['links'].remove(lid)
    l[1], l[2] = src, sslot
    o = N[src]['outputs'][sslot]
    o['links'] = (o.get('links') or []) + [lid]


def out_links(nid, slot):
    return list(N[nid]['outputs'][slot].get('links') or [])


# ---- layout: a new group under the graph, left to right in data-flow order ----
x0 = min(n['pos'][0] for n in w['nodes'])
y0 = max(n['pos'][1] + (n['size'][1] if isinstance(n['size'], list) else 0) for n in w['nodes']) + 400
col = lambda c, r=0: (x0 + 60 + c * 420, y0 + 80 + r * 320)

LIP = 'comfy_workflows/raw/ltx_v2v_lipdub_template.json'
EXT = 'comfy_workflows/raw/flow_ltx_extend.json'

# sheet: Input_Image -> fit to the output size (pad black) -> repeat to the clip length
n902 = place(copy.deepcopy(N[509]), 902, 'Input_Image', col(0))
n902['widgets_values'] = ['None', 'alpha', False, '', 'image']
if 'widgets_values_named' in n902:
    n902['widgets_values_named'] = {'image': 'None', 'channel': 'alpha', 'block_if_empty': False, 'string': '', 'upload': 'image'}
n903 = place(donor(EXT, lambda n: n['type'] == 'ImageResizeKJv2'), 903, 'Reference Sheet Fit', col(1))
n903['widgets_values'] = [960, 544, 'lanczos', 'pad', '0, 0, 0', 'center', 32, 'cpu']
n904 = place({
    'id': 904, 'type': 'RepeatImageBatch', 'pos': [0, 0], 'size': [270, 82], 'flags': {}, 'order': 0, 'mode': 0,
    'inputs': [{'localized_name': 'image', 'name': 'image', 'type': 'IMAGE', 'link': None},
               {'localized_name': 'amount', 'name': 'amount', 'type': 'INT', 'widget': {'name': 'amount'}, 'link': None}],
    'outputs': [{'localized_name': 'IMAGE', 'name': 'IMAGE', 'type': 'IMAGE', 'links': []}],
    'properties': {'cnr_id': 'comfy-core', 'Node name for S&R': 'RepeatImageBatch'},
    'widgets_values': [1],
}, 904, 'Reference Sheet Frames', col(2))
link(902, 0, 903, 'image')
link(88, 0, 903, 'width')
link(89, 0, 903, 'height')
link(903, 0, 904, 'image')
link(76, 0, 904, 'amount')

# model: the IC LoRA after the transition LoRA, only when a sheet is loaded
n900 = place(donor(LIP, lambda n: n['type'] == 'LTXICLoRALoaderModelOnly'), 900, 'Reference LoRA', col(0, 1))
n900['widgets_values'] = [LORA, 1]
n901 = place(copy.deepcopy(N[349]), 901, 'Reference Model', col(1, 1))
for lid in out_links(191, 0):
    repoint(lid, 901, 0)
link(191, 0, 900, 'model')
link(900, 0, 901, 'true', '*')
link(191, 0, 901, 'false', '*')
link(902, 4, 901, 'boolean')

# stage 1: the guide at the source; crops 46/334 remove its frames before the upsampler
guide_w = lambda tiled: [0, 1, 1, 'disabled', tiled, 256, 64]
n905 = place(donor(LIP, lambda n: n['type'] == 'LTXAddVideoICLoRAGuide'), 905, 'Reference Guide S1', col(3))
n905['widgets_values'] = guide_w(False)
n906 = place(copy.deepcopy(N[524]), 906, 'Ref S1 on', col(4))
n907 = place(copy.deepcopy(N[524]), 907, 'Ref S1 off', col(4, 1))
n908 = place(copy.deepcopy(N[349]), 908, 'Ref S1', col(5))
n909 = place(copy.deepcopy(N[586]), 909, 'Ref S1 out', col(6))
cond1 = [out_links(212, 0), out_links(212, 1)]
lat1 = out_links(143, 0)
assert len(lat1) == 4, lat1
link(212, 0, 905, 'positive')
link(212, 1, 905, 'negative')
link(1, 0, 905, 'vae')
link(143, 0, 905, 'latent')
link(904, 0, 905, 'image')
for s in range(3):
    link(905, s, 906, f'any_{s + 1}', '*')
link(212, 0, 907, 'any_1', '*')
link(212, 1, 907, 'any_2', '*')
link(143, 0, 907, 'any_3', '*')
link(906, 0, 908, 'true', '*')
link(907, 0, 908, 'false', '*')
link(902, 4, 908, 'boolean')
link(908, 0, 909, 'pack', 'MPI_PACK')
for s, lids in enumerate(cond1):
    for lid in lids:
        repoint(lid, 909, s)
for lid in lat1:
    repoint(lid, 909, 2)

# stage 2 (variant A): the guide re-added on the upsampled latent + its own crop before decode
n910 = place(donor(LIP, lambda n: n['type'] == 'LTXAddVideoICLoRAGuide'), 910, 'Reference Guide S2', col(3, 2))
n910['widgets_values'] = guide_w(True)
n911 = place(copy.deepcopy(N[524]), 911, 'Ref S2 on', col(4, 2))
n912 = place(copy.deepcopy(N[524]), 912, 'Ref S2 off', col(4, 3))
n913 = place(copy.deepcopy(N[349]), 913, 'Ref S2', col(5, 2))
n914 = place(copy.deepcopy(N[586]), 914, 'Ref S2 out', col(6, 2))
n915 = place(copy.deepcopy(N[46]), 915, 'Ref S2 crop', col(7, 2))
cond2 = [out_links(586, 0), out_links(586, 1)]
lat2 = out_links(123, 0)
assert sum(map(len, cond2)) == 6 and len(lat2) == 4, (cond2, lat2)
link(586, 0, 910, 'positive', 'CONDITIONING')
link(586, 1, 910, 'negative', 'CONDITIONING')
link(1, 0, 910, 'vae')
link(123, 0, 910, 'latent')
link(904, 0, 910, 'image')
for s in range(3):
    link(910, s, 911, f'any_{s + 1}', '*')
link(586, 0, 912, 'any_1', '*')
link(586, 1, 912, 'any_2', '*')
link(123, 0, 912, 'any_3', '*')
link(911, 0, 913, 'true', '*')
link(912, 0, 913, 'false', '*')
link(902, 4, 913, 'boolean')
link(913, 0, 914, 'pack', 'MPI_PACK')
for s, lids in enumerate(cond2):
    for lid in lids:
        repoint(lid, 914, s)
for lid in lat2:
    repoint(lid, 914, 2)
link(914, 0, 915, 'positive', 'CONDITIONING')
link(914, 1, 915, 'negative', 'CONDITIONING')
f349 = next(i['link'] for i in N[349]['inputs'] if i['name'] == 'false')
assert LINKS[f349][1] == 38, LINKS[f349]
link(38, 0, 915, 'latent')
repoint(f349, 915, 2)

w['last_node_id'] = max(w['last_node_id'], 915)
w['groups'].append({'id': max(g['id'] for g in w['groups']) + 1, 'title': 'Reference to Video (Ingredients IC-LoRA, MPI-1060)',
                    'bounding': [x0, y0, 8 * 420 + 120, 4 * 320 + 160], 'color': '#3f789e', 'flags': {}})

# ---- checks: every link agrees with both ends, nothing dangles, no surviving node moved ----
for l in w['links']:
    lid, s, ss, d, ds, _ = l
    assert lid in (N[s]['outputs'][ss].get('links') or []), ('origin', l)
    assert N[d]['inputs'][ds]['link'] == lid, ('target', l)
ids = {l[0] for l in w['links']}
for n in w['nodes']:
    for i in n.get('inputs', []):
        assert i['link'] is None or i['link'] in ids, (n['id'], i)
    for o in n.get('outputs', []):
        assert all(x in ids for x in (o.get('links') or [])), (n['id'], o)
for nid in (901, 908, 913):  # MpiIfElse branch inputs are forceInput: all three fed
    assert all(i['link'] for i in N[nid]['inputs']), nid
assert all((json.dumps(N[i]['pos']), json.dumps(N[i]['size'])) == v for i, v in before.items()), 'a surviving node moved'
print('nodes', len(w['nodes']), 'links', len(w['links']), 'checks OK')

try:
    bench = urllib.request.urlopen(BENCH, timeout=5).read()
    print('bench copy', 'SAME as repo' if hashlib.sha256(bench).digest() == hashlib.sha256(raw).digest() else 'DIFFERS from repo')
except Exception as e:  # the bench copy is a convenience; the repo raw is the source of truth
    print('bench copy unreadable:', e)

if '--write' in sys.argv:
    open(RAW, 'wb').write(ser(w))
    print('written', RAW)
