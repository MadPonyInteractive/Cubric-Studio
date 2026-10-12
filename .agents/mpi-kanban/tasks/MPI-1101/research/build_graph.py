"""MPI-1101: build comfy_workflows/raw/flow_make_seamless.json (LiteGraph) from the bench's round-5 recipe.

The repaint is the Character Sheet Editor's locked Klein branch (raw/flow_character_sheet_edit.json) with every
ReferenceLatent gone - a reference makes Klein copy the band, seam included (bench rounds 1-3) - and the prompt is
Outpaint's join (raw/flow_outpaint.json 112/666/667/685): a baked instruction + Input_Positive, which carries the
line saying what the picture shows (the user's prompt, else the app's describer). Without that line a
reference-free Klein paints unrelated things into the band (round 4).

Graph: Input_Image (the window cut) + Input_Mask (red = the band) -> MpiMaskSquareBbox(64) -> InpaintCropImproved
(target 1024, blend 32) -> VAEEncode -> SetLatentNoiseMask -> LanPaint_KSampler (4 steps, cfg 1, denoise 1) on
FluxGuidance 4 -> VAEDecode -> InpaintStitchImproved -> MpiClearVram -> Output_Image. The app pastes the band back
itself (services/seamlessOps.js), so the stitch's own bleed never reaches the picture.

usage (repo root): python .agents/mpi-kanban/tasks/MPI-1101/research/build_graph.py"""
import copy, json, os

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../..'))
RAW = os.path.join(REPO, 'comfy_workflows/raw')
INSTRUCTION = ('Continue the picture seamlessly across this area, matching the textures, lines, colours and light '
               'on both sides, with no visible join.')

cs = {n['id']: n for n in json.load(open(os.path.join(RAW, 'flow_character_sheet_edit.json'), encoding='utf-8'))['nodes']}
op = {n['id']: n for n in json.load(open(os.path.join(RAW, 'flow_outpaint.json'), encoding='utf-8'))['nodes']}

nodes, links = {}, []


def take(src, nid, new_id, title=None, widgets=None, drop_inputs=(), pos=None):
    n = copy.deepcopy(src[nid])
    n['id'] = new_id
    n['inputs'] = [i for i in n['inputs'] if i['name'] not in drop_inputs]
    for i in n['inputs']:
        i['link'] = None
    for o in n['outputs']:
        o['links'] = []
    if title is not None:
        n['title'] = title
    if widgets is not None:
        n['widgets_values'] = widgets
    if pos is not None:
        n['pos'] = pos
    n.pop('order', None)
    nodes[new_id] = n


def link(a, a_slot, b, b_input):
    lid = len(links) + 1
    out = nodes[a]['outputs'][a_slot]
    inp = next(i for i in nodes[b]['inputs'] if i['name'] == b_input)
    inp['link'] = lid
    out['links'].append(lid)
    out['slot_index'] = a_slot
    links.append([lid, a, a_slot, b, nodes[b]['inputs'].index(inp), out['type']])


# inputs
take(cs, 2, 1, 'Input_Image', pos=[0, 0])
take(cs, 2, 2, 'Input_Mask', widgets=['None', 'red', True, '', 'image'], pos=[0, 420])
take(cs, 4, 3, 'Input_Seed', pos=[0, 840])
take(op, 112, 4, 'Seamless instruction (baked)', widgets=[INSTRUCTION], pos=[0, 1000])
take(op, 666, 5, 'Input_Positive', pos=[0, 1180])
take(op, 667, 6, pos=[520, 1000])
take(op, 685, 7, pos=[960, 1000])
# models + sampler settings
take(cs, 34, 8, pos=[0, 1440])
take(cs, 35, 9, pos=[0, 1570])
take(cs, 36, 10, pos=[0, 1710])
take(cs, 37, 11, pos=[0, 1820])
take(cs, 38, 12, pos=[0, 1920])
# crop the band out of the window
take(cs, 33, 13, pos=[520, 420])
take(cs, 39, 14, title='Inpaint Crop (the band)', drop_inputs=('output_target_width', 'output_target_height'),
     pos=[960, 0])
take(cs, 42, 15, title='Encode the crop', pos=[1400, 0])
take(cs, 44, 16, pos=[1400, 1000])
take(cs, 45, 17, pos=[1840, 1100])
take(cs, 47, 18, title='FluxGuidance', pos=[1840, 1000])
take(cs, 53, 19, title='Set Latent Noise Mask', pos=[1840, 0])
take(cs, 54, 20, title='LanPaint KSampler', pos=[2280, 0])
take(cs, 56, 21, pos=[2720, 0])
take(cs, 57, 22, title='Inpaint Stitch', pos=[3160, 0])
take(cs, 60, 23, pos=[3600, 0])
take(cs, 61, 24, pos=[4040, 0])

link(4, 0, 6, 'string_a')
link(5, 0, 6, 'string_b')
link(6, 0, 7, 'string')
link(9, 0, 16, 'clip')
link(7, 0, 16, 'text')
link(16, 0, 17, 'conditioning')
link(16, 0, 18, 'conditioning')
link(2, 1, 13, 'mask')
link(1, 0, 14, 'image')
link(2, 1, 14, 'mask')
link(13, 0, 14, 'optional_context_mask')
link(14, 1, 15, 'pixels')
link(10, 0, 15, 'vae')
link(15, 0, 19, 'samples')
link(14, 2, 19, 'mask')
link(8, 0, 20, 'model')
link(18, 0, 20, 'positive')
link(17, 0, 20, 'negative')
link(19, 0, 20, 'latent_image')
link(3, 0, 20, 'seed')
link(11, 0, 20, 'steps')
link(12, 0, 20, 'cfg')
link(20, 0, 21, 'samples')
link(10, 0, 21, 'vae')
link(14, 0, 22, 'stitcher')
link(21, 0, 22, 'inpainted_image')
link(22, 0, 23, 'passthrough')
link(23, 0, 24, 'images')

for n in nodes.values():
    missing = [i['name'] for i in n['inputs'] if i['link'] is None and 'widget' not in i and i['type'] not in ('COMBO', 'BOOLEAN', 'STRING', 'IMAGEUPLOAD')]
    assert not missing, (n['id'], n['type'], missing)

graph = {'id': '6e2b6c0e-1101-4d1a-9a5e-5ea3a1e55101', 'revision': 0, 'last_node_id': max(nodes), 'last_link_id': len(links),
         'nodes': [nodes[k] for k in sorted(nodes)], 'links': links, 'groups': [], 'config': {}, 'extra': {}, 'version': 0.4}
out = os.path.join(RAW, 'flow_make_seamless.json')
with open(out, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(graph, f, indent=1, ensure_ascii=False)
    f.write('\n')
print(out, len(nodes), 'nodes', len(links), 'links')
