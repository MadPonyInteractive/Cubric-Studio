"""MPI-1041 bench question 1: dress a NAKED sheet by words, Klein 9B edit, whole sheet in one sampling.
Writes, into <out_dir> (on G:, never the repo - the sheet is nude):
  klein9b_edit_api.json = the app's own Klein 9B graph (comfy_workflows/klein_9b_t2i.json), node 167 (the edit
                          path's ImageScaleToTotalPixels, 1 MP in the app) retitled `Edit_Scale` so a spec can set it
  q1_spec.json          = run_api.py's spec (MPI-1042 bench tools): Input_wf_type 4 (kleinEdit), as the app injects it
Arms: 1 MP (the app's kleinEdit as shipped, ~1264x790 out of a 1792x1120 sheet) vs 2 MP (the sheet's own size),
3 outfits x seeds 42 / 7, plus a naive one-line prompt (1 MP, seed 42) to show what the Flow's wrapper buys.
usage: q1_dress.py <out_dir> <input image name in ComfyUI/input>"""
import json, os, sys

OUT, IMG = sys.argv[1], sys.argv[2]
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../../..'))
os.makedirs(OUT, exist_ok=True)

g = json.load(open(os.path.join(REPO, 'comfy_workflows/klein_9b_t2i.json'), encoding='utf-8'))
assert g['167']['class_type'] == 'ImageScaleToTotalPixels' and g['167']['inputs']['image'] == ['592', 0]
g['167']['_meta']['title'] = 'Edit_Scale'
api = os.path.join(OUT, 'klein9b_edit_api.json')
json.dump(g, open(api, 'w', encoding='utf-8'), indent=1)

OUTFITS = {
    'tee': 'a fitted white crew-neck t-shirt, light blue jeans and white sneakers',
    'biker': 'a red leather biker jacket over a black knee-length dress, and black ankle boots',
    'armour': ('brown medieval leather armour with a wide belt, a dark green cloak hanging down her back with '
               'the hood down, and tall brown boots'),
}
WRAP = ('Dress the woman in {o}. She wears exactly the same outfit in all three views: the full-body front view, '
        'the full-body back view seen from behind, and the close-up portrait. Keep her face, hair, body shape, pose, '
        'framing, the grey background and the lighting exactly as they are.')
NAIVE = 'Dress her in {o}.'


def run(tag, prompt, mp, seed):
    return {'tag': tag, 'api': api, 'set': {
        'Input_wf_type': {'int': 4},
        'Input_Image': {'image': IMG},
        'Input_Positive': {'string': prompt},
        'Input_Seed': {'int': seed},
        'Edit_Scale': {'megapixels': mp},
    }}


spec = []
for mp in (1, 2):
    for k, o in OUTFITS.items():
        for seed in (42, 7):
            spec.append(run(f'W_{mp}mp_{k}_s{seed}', WRAP.format(o=o), mp, seed))
for k, o in OUTFITS.items():
    spec.append(run(f'N_1mp_{k}_s42', NAIVE.format(o=o), 1, 42))
json.dump(spec, open(os.path.join(OUT, 'q1_spec.json'), 'w', encoding='utf-8'), indent=1)
print(len(spec), 'runs ->', OUT)
