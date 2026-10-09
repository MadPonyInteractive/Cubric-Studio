"""MPI-1041 bench question 4: mask-locked dress vs Q1's free whole-sheet edit (Q1 W_2mp_* is the free arm).
Writes, into <out_dir> (on G:, never the repo):
  mask_api.json  = SAM3 "head, hair" on the sheet (MPI-1042's settings: threshold 0.5, unioned, holes filled,
                   grown 6 px), INVERTED -> white = everything but head and hair, saved as Output_Image
  mask_spec.json = run_api.py spec for it (tag `mask_head_hair`)
  q4_spec.json   = Q1's 2 MP wrapped runs with that mask on Input_Mask: the app's masked-edit path
                   (InpaintCrop -> LanPaint -> InpaintStitch). Node 581 (InpaintCropImproved, 1024x1024 in
                   the app) retitled `Edit_Crop` and set to the sheet's 1792x1120 so the crop keeps its aspect.
run_q4.sh copies the saved mask into ComfyUI/input as <mask_name> between the two specs.
usage: q4_masklock.py <out_dir> <sheet image name> <mask image name>"""
import json, os, sys

OUT, IMG, MASK = sys.argv[1:4]
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)


def n(cls, title, inputs):
    return {'class_type': cls, '_meta': {'title': title}, 'inputs': inputs}


mask_api = {
    '1': n('LoadImage', 'sheet', {'image': IMG}),
    '2': n('CheckpointLoaderSimple', 'SAM3 Model', {'ckpt_name': 'sam3.1_multiplex_fp16.safetensors'}),
    '3': n('CLIPTextEncode', 'SAM3 vocabulary', {'text': 'head, hair', 'clip': ['2', 1]}),
    '4': n('SAM3_Detect', 'head + hair, unioned', {'threshold': 0.5, 'refine_iterations': 2, 'individual_masks': False,
                                                   'model': ['2', 0], 'image': ['1', 0], 'conditioning': ['3', 0]}),
    '5': n('MpiMaskFillHoles', 'fill holes', {'max_hole_size': 0, 'mask': ['4', 0]}),
    '6': n('GrowMask', 'grow 6', {'expand': 6, 'tapered_corners': True, 'mask': ['5', 0]}),
    '7': n('InvertMask', 'edit everything else', {'mask': ['6', 0]}),
    '8': n('MaskToImage', 'mask to image', {'mask': ['7', 0]}),
    '9': n('PreviewImage', 'Output_Image', {'images': ['8', 0]}),
}
mask_path = os.path.join(OUT, 'mask_api.json')
json.dump(mask_api, open(mask_path, 'w', encoding='utf-8'), indent=1)
json.dump([{'tag': 'mask_head_hair', 'api': mask_path, 'set': {}}],
          open(os.path.join(OUT, 'mask_spec.json'), 'w', encoding='utf-8'), indent=1)

# Q1's spec is the source of the prompts: same strings, same seeds, so the free arm is Q1 W_2mp_* as run
q1 = json.load(open(os.path.join(OUT, '..', 'mpi1041_q1', 'q1_spec.json'), encoding='utf-8'))
g = json.load(open(q1[0]['api'], encoding='utf-8'))
assert g['581']['class_type'] == 'InpaintCropImproved'
g['581']['_meta']['title'] = 'Edit_Crop'
api = os.path.join(OUT, 'klein9b_edit_api.json')
json.dump(g, open(api, 'w', encoding='utf-8'), indent=1)
spec = []
for r in q1:
    if not r['tag'].startswith('W_2mp_'):
        continue
    s = dict(r['set'])
    s['Input_Mask'] = {'image': MASK}
    s['Edit_Crop'] = {'output_target_width': 1792, 'output_target_height': 1120}
    spec.append({'tag': r['tag'].replace('W_2mp_', 'M_2mp_'), 'api': api, 'set': s})
json.dump(spec, open(os.path.join(OUT, 'q4_spec.json'), 'w', encoding='utf-8'), indent=1)
print(len(spec), 'masked runs ->', OUT)
