"""MPI-1041 F2: insert the OPTIONAL Reference picture into raw/flow_character_sheet_edit.json, in place.
Input_Image_2 (MpiLoadImage, never blocks) -> 1 MP -> VAEEncode -> a second ReferenceLatent on top of "Set Reference
Latent 1". It is used only when a picture is LOADED and Input_Reference (MpiSimpleBoolean, the prompt builder sets it
on a Clothes / Accessories / Hairstyle leg) is true; otherwise every consumer gets reference 1 as before. MpiIfElse is
lazy, so with no reference the scale / encode never run. The raw is edited in place (it carries the LoRA rack
insert_rack.py added, which a rebuild from build_edit_graph.py would drop).
usage: insert_ref2.py [raw.json] [--dry]"""
import json, sys

RAW = 'C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_character_sheet_edit.json'
path = next((a for a in sys.argv[1:] if not a.startswith('--')), RAW)
dry = '--dry' in sys.argv

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
T = {n.get('title'): n for n in g['nodes'] if n.get('title')}
assert 'Input_Image_2' not in T, 'graph already has a reference picture'
ref1, vae, img1 = T['Set Reference Latent 1'], next(n for n in g['nodes'] if n['type'] == 'VAELoader'), T['Input_Image']
links = {l[0]: l for l in g['links']}
consumers = [links[i] for i in ref1['outputs'][0]['links']]   # FluxGuidance (LanPaint) + CFGGuider
assert len(consumers) == 2, consumers

nid, lid = g['last_node_id'], g['last_link_id']
MPI = {"cnr_id": "ComfyUi-MpiNodes"}
CORE = dict(ref1['properties'])
CORE.pop('Node name for S&R', None)


def node(typ, widgets, ins, outs, pos, size, title=None, props=CORE):
    global nid
    nid += 1
    n = {"id": nid, "type": typ, "pos": list(pos), "size": list(size), "flags": {}, "order": len(g['nodes']), "mode": 0,
         "inputs": [dict({"name": i[0], "type": i[1], "link": None}, **({"widget": {"name": i[0]}} if len(i) > 2 else {}))
                    for i in ins],
         "outputs": [{"name": o[0], "type": o[1], "links": [], "slot_index": s} for s, o in enumerate(outs)],
         "properties": dict(props, **{"Node name for S&R": typ}), "widgets_values": widgets}
    if title:
        n['title'] = title
    g['nodes'].append(n)
    return n


def link(src, slot, dst, in_name):
    global lid
    lid += 1
    i = next(k for k, x in enumerate(dst['inputs']) if x['name'] == in_name)
    typ = src['outputs'][slot]['type']
    g['links'].append([lid, src['id'], slot, dst['id'], i, typ])
    src['outputs'][slot]['links'].append(lid)
    dst['inputs'][i]['link'] = lid
    return lid


# Below the existing inputs column (Input_Lock sits at y 820) and left of the lock chain.
X, Y = 0, 1080
img2 = node("MpiLoadImage", ["None", "alpha", False, "", "image"], [(i['name'], i['type']) for i in img1['inputs']],
            [(o['name'], o['type']) for o in img1['outputs']], (X, Y), (300, 450), "Input_Image_2", MPI)
use = node("MpiSimpleBoolean", [False], [], [("boolean", "BOOLEAN")], (X, Y + 490), (300, 60), "Input_Reference", MPI)
both = node("MpiBooleanCompare", ["both_true"], [("a", "BOOLEAN"), ("b", "BOOLEAN")], [("BOOLEAN", "BOOLEAN")],
            (X, Y + 590), (300, 80), "reference picture given AND wanted", MPI)
scale = node("ImageScaleToTotalPixels", ["nearest-exact", 1, 16], [("image", "IMAGE")], [("IMAGE", "IMAGE")],
             (X + 380, Y), (300, 106), "Reference picture to 1 MP")
enc = node("VAEEncode", None, [("pixels", "IMAGE"), ("vae", "VAE")], [("LATENT", "LATENT")], (X + 380, Y + 140), (200, 50),
           "Encode ref 2")
ref2 = node("ReferenceLatent", None, [("conditioning", "CONDITIONING"), ("latent", "LATENT")],
            [("CONDITIONING", "CONDITIONING")], (X + 380, Y + 230), (240, 50), "Set Reference Latent 2")
sw = node("MpiIfElse", [True], [("true", "*"), ("false", "*"), ("boolean", "BOOLEAN", True)], [("output", "*")],
          (X + 380, Y + 320), (240, 80), "conditioning: + the reference picture when given", MPI)

link(img2, 4, both, 'a')                       # loaded
link(use, 0, both, 'b')
link(img2, 0, scale, 'image')
link(scale, 0, enc, 'pixels')
link(vae, 0, enc, 'vae')
link(ref1, 0, ref2, 'conditioning')
link(enc, 0, ref2, 'latent')
link(ref2, 0, sw, 'true')
link(ref1, 0, sw, 'false')
link(both, 0, sw, 'boolean')
for l in consumers:                            # FluxGuidance + CFGGuider now read the switch
    ref1['outputs'][0]['links'].remove(l[0])
    dst = next(n for n in g['nodes'] if n['id'] == l[3])
    l[1], l[2] = sw['id'], 0
    sw['outputs'][0]['links'].append(l[0])
    l[5] = 'CONDITIONING'
    assert dst['inputs'][l[4]]['link'] == l[0]

g['last_node_id'], g['last_link_id'] = nid, lid
g['groups'].append({"id": max([x.get('id', 0) for x in g['groups']] + [0]) + 1, "title": "Reference picture (optional, MPI-1041 F2)",
                    "bounding": [X - 20, Y - 60, 720, 760], "color": "#3f789e", "font_size": 24, "flags": {}})

# Overlap report: any older node whose box meets the new block.
box = (X - 20, Y - 60, X + 700, Y + 700)
hits = [(n['id'], n['type'], n.get('title')) for n in g['nodes'] if n['id'] <= g['last_node_id'] - 7
        and n['pos'][0] < box[2] and n['pos'][0] + n['size'][0] > box[0] and n['pos'][1] < box[3] and n['pos'][1] + n['size'][1] > box[1]]
print('overlaps:', hits)
print('added nodes', [n['id'] for n in g['nodes'][-7:]], 'links up to', lid)
if not dry:
    open(path, 'wb').write(dump(g).encode('utf-8'))
    print('wrote', path)
