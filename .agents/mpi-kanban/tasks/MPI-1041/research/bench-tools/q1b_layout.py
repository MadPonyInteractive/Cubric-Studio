"""MPI-1041 bench Q1b: a wording that dresses all three panels WITHOUT re-laying the sheet out.
Batch 1 found Q1's wrapper ("... the same outfit in all three views: the full-body front view, the full-body back
view seen from behind, and the close-up portrait") moves the back figure ~210 px into the portrait half and shrinks
the portrait, while the naive "Dress her in X." keeps the layout (within 7 px) but missed the portrait 1 in 3.
  L1 = naive + one sentence for the portrait + "keep everything else", no view counting
  L2 = names WHERE each view sits (two full-body views on the left half, portrait filling the right half) + keep list
2 MP x 3 outfits x seeds 42 / 7, plus L2 at 1 MP seed 7 (batch 1's portrait-turn case). Same graph as Q1.
usage: q1b_layout.py <out_dir>   (reads ../mpi1041_q1/q1_spec.json for the graph and the outfits' sheet)"""
import json, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
q1 = json.load(open(os.path.join(OUT, '..', 'mpi1041_q1', 'q1_spec.json'), encoding='utf-8'))
api, img = q1[0]['api'], q1[0]['set']['Input_Image']['image']

OUTFITS = {
    'tee': 'a fitted white crew-neck t-shirt, light blue jeans and white sneakers',
    'biker': 'a red leather biker jacket over a black knee-length dress, and black ankle boots',
    'armour': ('brown medieval leather armour with a wide belt, a dark green cloak hanging down her back with '
               'the hood down, and tall brown boots'),
}
L1 = ('Dress her in {o}. Dress her the same way in the close-up portrait on the right. '
      'Keep everything else exactly as it is.')
L2 = ('Dress the woman in {o}, both in the two full-body views in the left half of the image and in the close-up '
      'portrait that fills the right half. Keep the layout, her face, hair, body shape and pose, the grey background '
      'and the lighting exactly as they are.')


def run(tag, prompt, mp, seed):
    return {'tag': tag, 'api': api, 'set': {
        'Input_wf_type': {'int': 4}, 'Input_Image': {'image': img}, 'Input_Positive': {'string': prompt},
        'Input_Seed': {'int': seed}, 'Edit_Scale': {'megapixels': mp}}}


spec = []
for name, wrap in (('L1', L1), ('L2', L2)):
    for k, o in OUTFITS.items():
        for seed in (42, 7):
            spec.append(run(f'{name}_2mp_{k}_s{seed}', wrap.format(o=o), 2, seed))
for k, o in OUTFITS.items():
    spec.append(run(f'L2_1mp_{k}_s7', L2.format(o=o), 1, 7))
json.dump(spec, open(os.path.join(OUT, 'q1b_spec.json'), 'w', encoding='utf-8'), indent=1)
print(len(spec), 'runs ->', OUT)
