"""Insert a six-slot MpiLoraModel rack (Input_Lora_Phase<P>_1..6) between a raw graph's
UNETLoader and every consumer of its MODEL output. Usage: insert_rack.py <raw.json> <phase> <x> <y> [--dry]"""
import json, sys, copy

ROOT = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/'
path, phase, x, y = sys.argv[1], int(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4])
dry = '--dry' in sys.argv
SP = 28 if '--tight' in sys.argv else 40

src_bytes = open(path, 'rb').read()
src = src_bytes.decode('utf-8')
nl = '\r\n' if '\r\n' in src else '\n'
g = json.loads(src)
indent = 2 if src.startswith('{' + nl + '  "') else (1 if src.startswith('{' + nl + ' "') else None)

def dump(obj):
    s = json.dumps(obj, indent=indent, ensure_ascii=False)
    if nl == '\r\n':
        s = s.replace('\n', '\r\n')
    return s + (nl if src.endswith(nl) else '')

assert dump(g).encode('utf-8') == src_bytes, 'round-trip is not byte-identical: refuse to write'
assert not any(str(n.get('title', '')).startswith('Input_Lora') for n in g['nodes']), 'graph already has a rack'

tpl = next(n for n in json.load(open(ROOT + 'flow_character_sheet_from_images.json', encoding='utf-8'))['nodes']
           if n.get('title') == 'Input_Lora_Phase1_1')
assert tpl['type'] == 'MpiLoraModel' and tpl['widgets_values'] == ['None', 1]

nodes = {n['id']: n for n in g['nodes']}
links = {l[0]: l for l in g['links']}
loaders = [n for n in g['nodes'] if n['type'] == 'UNETLoader']
assert len(loaders) == 1, loaders
loader = loaders[0]
consumer_links = list(loader['outputs'][0]['links'])
assert consumer_links, 'loader feeds nothing'
for lid in consumer_links:
    l = links[lid]
    assert l[1] == loader['id'] and l[2] == 0 and l[5] == 'MODEL', l

# Overlap report: anything whose box meets the rack column.
col = (x, y - 30, x + 220, y + SP * 6)
for n in g['nodes']:
    px, py = n['pos']
    w, h = (n.get('size') or [100, 30])
    if px < col[2] and px + w > col[0] and py < col[3] and py + h > col[1]:
        print('  overlap?', n['id'], n['type'], n.get('title'), n['pos'], n.get('size'))

nid, lid = g['last_node_id'], g['last_link_id']
new_ids = [nid + i for i in range(1, 7)]
new_links = [lid + i for i in range(1, 7)]
order = loader.get('order', 0)
prev_id, prev_link = loader['id'], None
for i, (node_id, link_id) in enumerate(zip(new_ids, new_links)):
    n = copy.deepcopy(tpl)
    n['id'] = node_id
    n['pos'] = [x, y + SP * i]
    n['order'] = order + 1 + i
    n['title'] = 'Input_Lora_Phase%d_%d' % (phase, i + 1)
    n['inputs'][0]['link'] = link_id
    n['outputs'][0]['links'] = []
    g['nodes'].append(n)
    g['links'].append([link_id, prev_id, 0, node_id, 0, 'MODEL'])
    if prev_id == loader['id']:
        loader['outputs'][0]['links'] = [link_id]
    else:
        nodes[prev_id]['outputs'][0]['links'] = [link_id]
    nodes[node_id] = n
    prev_id = node_id
# The last rack slot takes over every original consumer link.
last = nodes[new_ids[-1]]
last['outputs'][0]['links'] = consumer_links
for l in g['links']:
    if l[0] in consumer_links:
        l[1] = last['id']
g['last_node_id'] = new_ids[-1]
g['last_link_id'] = new_links[-1]
print(path, 'phase', phase, 'nodes', new_ids, 'links', new_links, 'consumers', [links[c][3] for c in consumer_links])
if not dry:
    open(path, 'wb').write(dump(g).encode('utf-8'))
    print('written')
