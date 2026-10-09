"""MPI-1041 bench Q2 + Q3, in batch 3's L1 shape (one change sentence, one portrait sentence, "keep everything else"),
worded with "the character" as the Flow must (it never knows the pronoun). Whole sheet, Klein 9B edit, 2 MP.
  Q2  story state, "beaten up after a fight", on the three clothed MPI-1042 sheets (photo / 3D / anime), seeds 42 / 7
  Q3b body shape: muscular / heavyset / skinny on the nude sheet and the photo sheet, seed 42
  Q3a age: 20 years older (nude, photo), 20 years younger (photo, 3D fisherman), seed 42
  LN  batch 3's L1 dress with "the character" instead of "her" (nude sheet, 3 outfits, seed 42)
usage: q23_state_body_age.py <out_dir>   (reads ../mpi1041_q1/q1_spec.json for the graph)"""
import json, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
api = json.load(open(os.path.join(OUT, '..', 'mpi1041_q1', 'q1_spec.json'), encoding='utf-8'))[0]['api']
SHEETS = {'nude': 'mpi1041_nude_sheet.png', 'photo': 'mpi1042art_cafe2_sheet.png',
          'fisher': 'mpi1042art_fisher_sheet.png', 'anime': 'mpi1042art_anime_sheet.png'}
TAIL = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'
OUTFITS = {
    'tee': 'a fitted white crew-neck t-shirt, light blue jeans and white sneakers',
    'biker': 'a red leather biker jacket over a black knee-length dress, and black ankle boots',
    'armour': ('brown medieval leather armour with a wide belt, a dark green cloak hanging down the back with '
               'the hood down, and tall brown boots'),
}


def run(tag, sheet, prompt, seed=42):
    return {'tag': tag, 'api': api, 'set': {
        'Input_wf_type': {'int': 4}, 'Input_Image': {'image': SHEETS[sheet]}, 'Input_Positive': {'string': prompt},
        'Input_Seed': {'int': seed}, 'Edit_Scale': {'megapixels': 2}}}


spec = []
for sheet in ('photo', 'fisher', 'anime'):
    for seed in (42, 7):
        spec.append(run(f'Q2_beaten_{sheet}_s{seed}', sheet,
                        'Make the character look beaten up after a fight: a bruised, cut face and torn, dirty clothes.'
                        + TAIL, seed))
for k, b in (('muscular', 'muscular and athletic'), ('heavy', 'heavyset and overweight'), ('skinny', 'very skinny')):
    for sheet in ('nude', 'photo'):
        spec.append(run(f'Q3b_{k}_{sheet}', sheet, f"Make the character's body {b}." + TAIL))
for k, a, sheets in (('older', 'about twenty years older', ('nude', 'photo')),
                     ('younger', 'about twenty years younger', ('photo', 'fisher'))):
    for sheet in sheets:
        spec.append(run(f'Q3a_{k}_{sheet}', sheet, f'Make the character {a}.' + TAIL))
for k, o in OUTFITS.items():
    spec.append(run(f'LN_{k}_nude', 'nude', f'Dress the character in {o}. Dress the character the same way in the '
                    'close-up portrait on the right. Keep everything else exactly as it is.'))
json.dump(spec, open(os.path.join(OUT, 'q23_spec.json'), 'w', encoding='utf-8'), indent=1)
print(len(spec), 'runs ->', OUT)
