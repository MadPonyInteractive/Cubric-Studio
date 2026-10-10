"""MPI-1041 bench, batch 14: the fisher at 10, the case no one-pass edit solved (batches 11-13: Klein turns the BODIES
into a boy but leaves the portrait old; Boogu keeps the white beard everywhere). Fabio's exact-age wording, seed 42.
  2p  = batch 6's B shape on Klein: the body half leads (it carries the change), then the portrait half - alone
        (2p_alone), and with the pass-1 boy as image 2 (2p_ref); stitched back at x 896
  nb  = one pass on the whole sheet + a generic clause for a boy under 15 ("a child's smooth face, no beard and no
        wrinkles"), on Klein and on Boogu
Clothed sheet only (plan.md HARD LIMIT). usage: qage2p.py <out_dir>   - execute only under gpu_lease"""
import json, os, shutil, subprocess, sys
from PIL import Image

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RUN_API = os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py')
INP = 'G:/ComfyUi/ComfyUI/input'
KLEIN = 'G:/ComfyUi/ComfyUI/output/mpi1041_q1/klein9b_edit_api.json'
BOOGU = os.path.join(OUT, 'boogu_api.json')   # batch 12's copy (as shipped)
SHEET_MP, HALF_MP = 1792 * 1120 / 2 ** 20, 896 * 1120 / 2 ** 20
M = 'Change the man in this {} to be a younger version of himself as a 10-year-old boy'
L1 = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'


def job(tag, img, prompt, api=KLEIN, mp=None, img2=None):
    s = {'Input_Image': {'image': img}, 'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': 42}}
    if api == KLEIN:
        s['Input_wf_type'] = {'int': 4}
    if mp:
        s['Edit_Scale'] = {'megapixels': mp}
    if img2:
        s['Input_Image_2'] = {'image': img2}
    return {'tag': tag, 'api': api, 'set': s}


def run(spec, name):
    p = os.path.join(OUT, name)
    json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
    subprocess.run([sys.executable, RUN_API, OUT, p], check=True)


im = Image.open(os.path.join(INP, 'mpi1042art_fisher_sheet.png')).convert('RGB')
im.crop((0, 0, 896, 1120)).save(os.path.join(INP, 'mpi1041age_fisher_L.png'))
im.crop((896, 0, 1792, 1120)).save(os.path.join(INP, 'mpi1041age_fisher_R.png'))
NB = ", with a child's smooth face, no beard and no wrinkles, wearing the same clothes."
run([job('2p_P1_fisher', 'mpi1041age_fisher_L.png', M.format('image') + ', wearing the same clothes. Keep everything '
         'else exactly as it is.', mp=HALF_MP),
     job('kleinnb_age10_fisher', 'mpi1042art_fisher_sheet.png', M.format('character sheet') + NB + L1),
     job('boogunb_age10_fisher', 'mpi1042art_fisher_sheet.png', M.format('character sheet') + NB + L1, api=BOOGU)],
    'qage2p_A_spec.json')
shutil.copy(os.path.join(OUT, '2p_P1_fisher.png'), os.path.join(INP, 'mpi1041age_P1_fisher.png'))
run([job('2p_alone_R', 'mpi1041age_fisher_R.png', M.format('close-up portrait') + ', wearing the same clothes. Keep '
         'everything else exactly as it is.', mp=HALF_MP),
     job('2p_ref_R', 'mpi1041age_fisher_R.png', M.format('close-up portrait') + ': the same boy as in image 2, with his '
         'face and his hair. Keep the hat, the clothes, the framing and everything else exactly as they are.',
         mp=HALF_MP, img2='mpi1041age_P1_fisher.png')], 'qage2p_B_spec.json')
left = Image.open(os.path.join(OUT, '2p_P1_fisher.png')).convert('RGB').resize((896, 1120))
for k in ('alone', 'ref'):
    sheet = Image.new('RGB', (1792, 1120))
    sheet.paste(left, (0, 0))
    sheet.paste(Image.open(os.path.join(OUT, f'2p_{k}_R.png')).convert('RGB').resize((896, 1120)), (896, 0))
    sheet.save(os.path.join(OUT, f'klein2p{k}_age10_fisher.png'))
print('stitched 2')
