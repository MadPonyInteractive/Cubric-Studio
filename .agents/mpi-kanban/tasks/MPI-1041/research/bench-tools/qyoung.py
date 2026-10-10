"""MPI-1041 bench, batch 20: the two youngest ages on Fabio's new slider (2026-10-10): 0 = a newborn you only carry,
1 = a toddler taking its first steps. The Flow's own legs as it ships them: the Klein age edit
(flow_character_sheet_edit.json, Input_Lock 0) then the Qwen rebuild (flow_character_sheet_from_images.json, the edit's
right half as the face picture, TURNED, no body picture). Two wordings per age; clothed sheets only.
usage: qyoung.py <out_dir> klein|rebuild   - lease only"""
import json, os, subprocess, sys
from PIL import Image

OUT, STAGE = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RUN_API = os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py')
EDIT = os.path.join(REPO, 'comfy_workflows/flow_character_sheet_edit.json')
REBUILD = os.path.join(REPO, 'comfy_workflows/flow_character_sheet_from_images.json')
INP = 'G:/ComfyUi/ComfyUI/input'
SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'
HEAD = 'Change the character in this character sheet to be a younger version of themselves as '
# A = the shortest change from the shipped child template; B = says what the body does (cannot stand / first steps).
AGE = {
    'age0a': HEAD + "a newborn baby, with a baby's round face, smooth skin and very little hair, wearing the same clothes." + L1,
    'age0b': HEAD + ("a newborn baby a few weeks old, too small to stand, with a baby's round face, smooth skin and very "
                     "little hair, wearing a baby's romper in the colors of the same clothes.") + L1,
    'age1a': HEAD + "a 1-year-old child, with a child's smooth face, no beard and no wrinkles, wearing the same clothes." + L1,
    'age1b': HEAD + ("a 1-year-old toddler taking its first steps, with a toddler's chubby round face, smooth skin and "
                     "short chubby legs, wearing the same clothes.") + L1,
    # Batch 21 (Fabio: a newborn is swaddled, three panels kept; 1b lost the fisher's age): swaddled 0, and 1a + the teen
    # template's hair clause.
    'age0s': HEAD + ("a newborn baby a few weeks old, with a baby's round face, smooth skin and very little hair, swaddled "
                     'in a soft cream knit blanket so only the face shows.') + L1,
    'age0u': HEAD + ("a newborn baby a few weeks old, with a baby's round face, smooth skin and very little hair, swaddled "
                     'in a soft blanket in the colors of the same clothes, so only the face shows.') + L1,
    'age1c': HEAD + ("a 1-year-old child, with a child's smooth face, no beard and no wrinkles, the same hairstyle and hair "
                     'color, wearing the same clothes.') + L1,
}
BODY = {
    'age0a': "A newborn baby with a baby's body proportions: a tiny body with a large head and short chubby arms and legs.",
    'age0b': ("A newborn baby a few weeks old, too small to stand, lying on its back, with a baby's body proportions: a "
              'tiny body with a large head and short chubby arms and legs.'),
    'age1a': ("A 1-year-old child with a child's height and body proportions: a short, small body with shorter arms and "
              'legs, a shorter torso and a larger head for the body.'),
    'age1b': ("A 1-year-old toddler taking its first steps, with a toddler's body proportions: a short, chubby body with "
              'short chubby arms and legs and a large head for the body.'),
    'age0s': ('A newborn baby a few weeks old, swaddled snugly in a soft cream knit blanket so only its face shows, '
              'lying on its back. It is too small to stand.'),
    'age0u': ('A newborn baby a few weeks old, swaddled snugly in a soft blanket so only its face shows, lying on its '
              'back. It is too small to stand. The blanket takes the colors of these clothes:'),
    'age1c': ("A 1-year-old toddler taking its first steps, with a toddler's body proportions: a short, chubby body with "
              'short chubby arms and legs and a large head for the body.'),
}
KEYS = os.environ.get('KEYS', '').split() or [k for k in AGE if k[4] in 'ab']
CAPTIONED = {'age0s': False}   # 0s: the blanket is cream, no clothes caption
CLOTHES = {'photo': 'Wearing an olive green cotton jacket over a mustard yellow knit jumper, olive green trousers and '
                    'brown leather boots.',
           'fisher': 'Wearing a mustard yellow suit jacket over a white shirt and a grey tie, mustard yellow trousers, '
                     'brown leather shoes and a red knitted beanie.'}

spec = []
for sh, f in SHEETS.items():
    for k in KEYS:
        if STAGE == 'klein':
            spec.append({'tag': f'young_{k}_{sh}', 'api': EDIT, 'set': {
                'Input_Image': {'string': f}, 'Input_Positive': {'string': AGE[k]},
                'Input_Seed': {'int': 42}, 'Input_Lock': {'int': 0}}})
        else:
            src = os.path.join(OUT, f'young_{k}_{sh}.png')
            if not os.path.exists(src):
                print('MISSING', src); continue
            im = Image.open(src).convert('RGB')
            face = im.crop((im.width // 2, 0, im.width, im.height))
            face.save(os.path.join(INP, f'mpi1041young_face_{k}_{sh}.png'))
            spec.append({'tag': f'rebuild_{k}_{sh}', 'api': REBUILD, 'set': {
                'Input_Image': {'image': f'mpi1041young_face_{k}_{sh}.png'},
                'Input_Box': {'x': 0, 'y': 0, 'width': face.width, 'height': face.height},
                'Input_Face_Pose': {'string': 'TURNED'}, 'Input_Positive': {'string': BODY[k] + (' ' + CLOTHES[sh] if CAPTIONED.get(k, True) else '')},
                'Input_Seed': {'int': 42}}})
for r in spec:   # one spec per case: run_api.py dies on the first HTTP error
    p = os.path.join(OUT, f'qyoung_{r["tag"]}.json')
    json.dump([r], open(p, 'w', encoding='utf-8'), indent=1)
    subprocess.run([sys.executable, RUN_API, OUT, p])
