"""MPI-1041 bench Q3 round 2 (batch 6): body shape and age, which batch 5 showed one plain whole-sheet edit cannot carry.
  A  = whole sheet, one sampling, the wording NAMES both halves (batch 3's layout-safe L2 shape) + "same clothes,
       refitted" for body / "the same change to the face and the hair in every view, also seen from behind" for age
  B  = two passes on the halves (MPI-1042's Klein shape): the half that carries the change best goes first, the other
       half follows it with that result as image 2; stitched back at x 896. Age: portrait first. Body: bodies first.
Size: Edit_Scale megapixels = w*h/2^20 gives the input's exact size (ImageScaleToTotalPixels counts 1024^2 per MP):
1.914 for the sheet, 0.957 for a half - batch 1-5's 1824x1152 was 2.0 rounded.
Runs itself (calls run_api.py per pass) - execute only under gpu_lease. usage: q3r2.py <out_dir>"""
import json, os, shutil, subprocess, sys
from PIL import Image

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
RUN_API = os.path.join(HERE, '..', '..', '..', 'MPI-1042', 'research', 'bench-tools', 'run_api.py')
INP = 'G:/ComfyUi/ComfyUI/input'
api = json.load(open(os.path.join(OUT, '..', 'mpi1041_q1', 'q1_spec.json'), encoding='utf-8'))[0]['api']
SHEETS = {'nude': 'mpi1041_nude_sheet.png', 'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
AGE = [('older', 'about twenty years older', ('nude', 'photo')), ('younger', 'about twenty years younger', ('photo', 'fisher'))]
BODY = [('muscular', 'muscular and athletic'), ('heavy', 'heavyset and overweight'), ('skinny', 'very skinny')]
SHEET_MP, HALF_MP = 1792 * 1120 / 2 ** 20, 896 * 1120 / 2 ** 20


def job(tag, img, prompt, mp, img2=None):
    s = {'Input_wf_type': {'int': 4}, 'Input_Image': {'image': img}, 'Input_Positive': {'string': prompt},
         'Input_Seed': {'int': 42}, 'Edit_Scale': {'megapixels': mp}}
    if img2:
        s['Input_Image_2'] = {'image': img2}
    return {'tag': tag, 'api': api, 'set': s}


def run(spec, name):
    p = os.path.join(OUT, name)
    json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
    subprocess.run([sys.executable, RUN_API, OUT, p], check=True)


# A: whole sheet, named halves
A = []
for k, a, sheets in AGE:
    for sh in sheets:
        A.append(job(f'A_{k}_{sh}', SHEETS[sh],
                     f'Make the character {a}, both in the two full-body views in the left half of the image and in the '
                     'close-up portrait that fills the right half, with the same change to the face and the hair in '
                     'every view, also seen from behind. Keep the layout, the clothes, the pose and everything else '
                     'exactly as they are.', SHEET_MP))
for k, b in BODY:
    for sh in ('nude', 'photo'):
        A.append(job(f'A_{k}_{sh}', SHEETS[sh],
                     f"Make the character's body {b}, both in the two full-body views in the left half of the image and "
                     'in the close-up portrait that fills the right half. The same clothes stay on, refitted to the new '
                     'body. Keep the layout, the face, the hair, the pose and everything else exactly as they are.',
                     SHEET_MP))
run(A, 'q3r2_A_spec.json')

# B: halves, cut once per sheet
for sh, f in SHEETS.items():
    im = Image.open(os.path.join(INP, f)).convert('RGB')
    im.crop((0, 0, 896, 1120)).save(os.path.join(INP, f'mpi1041_{sh}_L.png'))
    im.crop((896, 0, 1792, 1120)).save(os.path.join(INP, f'mpi1041_{sh}_R.png'))
lead, cases = [], []
for k, a, sheets in AGE:
    for sh in sheets:   # portrait leads
        lead.append(job(f'B1_{k}_{sh}', f'mpi1041_{sh}_R.png',
                        f'Make the character {a}. Keep everything else exactly as it is.', HALF_MP))
        cases.append((f'B_{k}_{sh}', sh, 'R', job(
            f'B2_{k}_{sh}', f'mpi1041_{sh}_L.png',
            'Make the character in both full-body views exactly the same age as the person in image 2, with the '
            'same face and the same hair as image 2, also on the view from behind. Keep the clothes, the pose, the '
            'layout and everything else exactly as they are.', HALF_MP, f'mpi1041_B1_{k}_{sh}.png')))
for k, b in BODY:
    for sh in ('nude', 'photo'):   # bodies lead
        lead.append(job(f'B1_{k}_{sh}', f'mpi1041_{sh}_L.png',
                        f"Make the character's body {b} in both full-body views, front and back. The same clothes stay "
                        'on, refitted to the new body. Keep the face, the hair, the pose, the layout and everything else '
                        'exactly as they are.', HALF_MP))
        cases.append((f'B_{k}_{sh}', sh, 'L', job(
            f'B2_{k}_{sh}', f'mpi1041_{sh}_R.png',
            'Give the person the same build as the character in image 2: the neck, the shoulders and the fullness of '
            'the face of the body in image 2. Keep the facial features, the hair, the clothes, the framing and '
            'everything else exactly as they are.', HALF_MP, f'mpi1041_B1_{k}_{sh}.png')))
run(lead, 'q3r2_B1_spec.json')
for j in lead:
    shutil.copy(os.path.join(OUT, j['tag'] + '.png'), os.path.join(INP, 'mpi1041_' + j['tag'] + '.png'))
run([c[3] for c in cases], 'q3r2_B2_spec.json')
for tag, sh, led, j in cases:
    one = Image.open(os.path.join(OUT, tag.replace('B_', 'B1_', 1) + '.png')).convert('RGB').resize((896, 1120))
    two = Image.open(os.path.join(OUT, j['tag'] + '.png')).convert('RGB').resize((896, 1120))
    left, right = (two, one) if led == 'R' else (one, two)
    sheet = Image.new('RGB', (1792, 1120))
    sheet.paste(left, (0, 0))
    sheet.paste(right, (896, 0))
    sheet.save(os.path.join(OUT, tag + '.png'))
print('stitched', len(cases))
