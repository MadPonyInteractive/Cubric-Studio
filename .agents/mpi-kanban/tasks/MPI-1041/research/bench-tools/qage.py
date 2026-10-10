"""MPI-1041 bench, batch 11: Age by EXACT target age, in Fabio's wording ("Change the woman in this character sheet to be
a younger version of herself as a 5-year-old." made Klein de-age a sheet where batch 5's relative "about twenty years
younger" did nothing). Klein 9B edit as the app ships it (wf_type 4, 1 MP, = Fabio's edit_002), seed 42, no tail.
CLOTHED sheets only, and every child case names the clothes: a child age never runs on a nude / underwear / swimwear
sheet (plan.md HARD LIMIT). The NSFW LoRA stays off: it trips only on the sexual word list in node 43.
Batch 12: the same 5 on the other editors that passed something in batch 9 - qwen21 (exact size, node 30 resolution
0) and boogu (as shipped, 1 MP); neither graph has a word-tripped NSFW path.
Batch 13 (set v2): Fabio's sentence + batch 5's L1 tail (the portrait sentence held all three panels in step), and a
child's height / proportions clause - a child's BODY is the part no editor changed in batches 11-12.
Out: its own folder, not the nude bench's. usage: qage.py <klein|qwen21|boogu> <out_dir> [v2]   - only under gpu_lease"""
import json, os, subprocess, sys

MODEL, OUT = sys.argv[1], sys.argv[2]
SET = sys.argv[3] if len(sys.argv) > 3 else ''
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RUN_API = os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py')
API = 'G:/ComfyUi/ComfyUI/output/mpi1041_q1/klein9b_edit_api.json'
op = {'Input_wf_type': {'int': 4}}
if MODEL != 'klein':
    g = json.load(open(os.path.join(REPO, 'comfy_workflows', {'qwen21': 'qwen_image_2_1', 'boogu': 'boogu_edit_balanced'}
                                    [MODEL] + '.json'), encoding='utf-8'))
    if MODEL == 'qwen21':
        assert g['30']['class_type'] == 'TextEncodeQwenImage21'
        g['30']['inputs']['resolution'] = 0
    else:
        op = {}
    API = os.path.join(OUT, f'{MODEL}_api.json')
    json.dump(g, open(API, 'w', encoding='utf-8'), indent=1)
SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
CASES = [('age30', 'fisher', 'Change the man in this character sheet to be a younger version of himself as a 30-year-old.'),
         ('age25', 'photo', 'Change the woman in this character sheet to be a younger version of herself as a 25-year-old.'),
         ('age70', 'photo', 'Change the woman in this character sheet to be an older version of herself as a 70-year-old.'),
         ('age10', 'fisher', 'Change the man in this character sheet to be a younger version of himself as a 10-year-old '
                             'boy, wearing the same clothes.'),
         ('age10', 'photo', 'Change the woman in this character sheet to be a younger version of herself as a 10-year-old '
                            'girl, wearing the same clothes.')]
if SET == 'v2':
    L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'
    W = 'Change the woman in this character sheet to be a younger version of herself as a '
    M = 'Change the man in this character sheet to be a younger version of himself as a '
    BODY = ", with a child's height and body proportions"
    CASES = [('age10', 'photo', W + '10-year-old girl, wearing the same clothes.' + L1),
             ('age10', 'fisher', M + '10-year-old boy, wearing the same clothes.' + L1),
             ('age10body', 'photo', W + '10-year-old girl' + BODY + ', wearing the same clothes.' + L1),
             ('age10body', 'fisher', M + '10-year-old boy' + BODY + ', wearing the same clothes.' + L1),
             ('age25', 'photo', W + '25-year-old.' + L1)]
if SET == 'v3':   # batch 15: the Flow never knows the pronoun - neutral wording + batch 14's "what a child lacks" clause
    L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'
    C = 'Change the character in this character sheet to be a younger version of themselves as a '
    CASES = [('age10', 'photo', C + "10-year-old child, with a child's smooth face, no beard and no wrinkles, "
                                    'wearing the same clothes.' + L1),
             ('age10', 'fisher', C + "10-year-old child, with a child's smooth face, no beard and no wrinkles, "
                                     'wearing the same clothes.' + L1),
             ('age30', 'fisher', C + '30-year-old, with a younger face, smooth skin and no grey hair.' + L1)]
if SET in ('v4limbs', 'v4height'):   # batch 16: a child-SIZED body in concrete words (v2's "proportions" did nothing)
    L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'
    C = ('Change the character in this character sheet to be a younger version of themselves as a 10-year-old child, '
         "with a child's smooth face, no beard and no wrinkles, wearing the same clothes in a child's size")
    B = {'v4limbs': ", with a child's small body: shorter arms and legs, a shorter torso and a larger head for the body.",
         'v4height': ('. The child is much shorter than the adult was: in the two full-body views the child stands '
                      'smaller, with empty grey space above the head, the feet on the same floor line.')}[SET]
    CASES = [('age10', 'photo', C + B + L1), ('age10', 'fisher', C + B + L1)]

kg = json.load(open('G:/ComfyUi/ComfyUI/output/mpi1041_q1/klein9b_edit_api.json', encoding='utf-8'))
nsfw_words = kg['43']['inputs']['words'].replace(' ', '').split(',')
for _, _, p in CASES:
    assert not any(w in p.lower() for w in nsfw_words), p
spec = [{'tag': f'{MODEL}{SET}_{k}_{sh}', 'api': API, 'set': {
    **op, 'Input_Image': {'image': SHEETS[sh]}, 'Input_Positive': {'string': p},
    'Input_Seed': {'int': 42}}} for k, sh, p in CASES]
p = os.path.join(OUT, f'qage_{MODEL}{SET}_spec.json')
json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
subprocess.run([sys.executable, RUN_API, OUT, p], check=True)
