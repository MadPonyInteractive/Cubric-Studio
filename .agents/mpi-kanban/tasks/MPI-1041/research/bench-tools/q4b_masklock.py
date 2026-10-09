"""MPI-1041 bench Q4b: mask-locked dress, retried with the two fixes batches 2-3 found.
  1. the mask is built PER PANEL: SAM3 "head, hair" on each crop (front 0-448 | back 448-896 | portrait 896-1792),
     pasted back at its offset onto an empty sheet-sized mask (whole-sheet SAM3 missed the portrait head, batch 2);
     grown 6 px, inverted -> white = edit everything but heads and hair.
  2. the wording is L1 (batch 3), which keeps the layout - so LanPaint's locked heads now sit where the new bodies are.
The free arm is batch 3's L1_2mp_* (same prompts, same seeds). Masked path as batch 2 (`Edit_Crop` 1792x1120).
usage: q4b_masklock.py <out_dir> <sheet image name> <mask image name>"""
import json, os, sys

OUT, IMG, MASK = sys.argv[1:4]
os.makedirs(OUT, exist_ok=True)
W, H = 1792, 1120
PANELS = [('front', 0, 448), ('back', 448, 448), ('portrait', 896, 896)]


def n(cls, title, inputs):
    return {'class_type': cls, '_meta': {'title': title}, 'inputs': inputs}


g = {
    '1': n('LoadImage', 'sheet', {'image': IMG}),
    '2': n('CheckpointLoaderSimple', 'SAM3 Model', {'ckpt_name': 'sam3.1_multiplex_fp16.safetensors'}),
    '3': n('CLIPTextEncode', 'SAM3 vocabulary', {'text': 'head, hair', 'clip': ['2', 1]}),
    '4': n('SolidMask', 'empty sheet mask', {'value': 0.0, 'width': W, 'height': H}),
}
dest, i = '4', 10
for name, x, w in PANELS:
    g[str(i)] = n('ImageCrop', f'crop {name}', {'image': ['1', 0], 'width': w, 'height': H, 'x': x, 'y': 0})
    g[str(i + 1)] = n('SAM3_Detect', f'head + hair, {name}', {
        'threshold': 0.5, 'refine_iterations': 2, 'individual_masks': False,
        'model': ['2', 0], 'image': [str(i), 0], 'conditioning': ['3', 0]})
    g[str(i + 2)] = n('MaskComposite', f'paste {name}', {
        'destination': [dest, 0], 'source': [str(i + 1), 0], 'x': x, 'y': 0, 'operation': 'add'})
    dest, i = str(i + 2), i + 10
g['50'] = n('MpiMaskFillHoles', 'fill holes', {'max_hole_size': 0, 'mask': [dest, 0]})
g['51'] = n('GrowMask', 'grow 6', {'expand': 6, 'tapered_corners': True, 'mask': ['50', 0]})
g['52'] = n('InvertMask', 'edit everything else', {'mask': ['51', 0]})
g['53'] = n('MaskToImage', 'mask to image', {'mask': ['52', 0]})
g['54'] = n('PreviewImage', 'Output_Image', {'images': ['53', 0]})
mask_api = os.path.join(OUT, 'mask_api.json')
json.dump(g, open(mask_api, 'w', encoding='utf-8'), indent=1)
json.dump([{'tag': 'mask_head_hair', 'api': mask_api, 'set': {}}],
          open(os.path.join(OUT, 'mask_spec.json'), 'w', encoding='utf-8'), indent=1)

q1b = json.load(open(os.path.join(OUT, '..', 'mpi1041_q1b', 'q1b_spec.json'), encoding='utf-8'))
e = json.load(open(q1b[0]['api'], encoding='utf-8'))
assert e['581']['class_type'] == 'InpaintCropImproved'
e['581']['_meta']['title'] = 'Edit_Crop'
api = os.path.join(OUT, 'klein9b_edit_api.json')
json.dump(e, open(api, 'w', encoding='utf-8'), indent=1)
spec = []
for r in q1b:
    if r['tag'].startswith('L1_2mp_'):
        s = dict(r['set'], Input_Mask={'image': MASK}, Edit_Crop={'output_target_width': W, 'output_target_height': H})
        spec.append({'tag': r['tag'].replace('L1_2mp_', 'ML1_2mp_'), 'api': api, 'set': s})
json.dump(spec, open(os.path.join(OUT, 'q4b_spec.json'), 'w', encoding='utf-8'), indent=1)
print(len(spec), 'masked runs ->', OUT)
