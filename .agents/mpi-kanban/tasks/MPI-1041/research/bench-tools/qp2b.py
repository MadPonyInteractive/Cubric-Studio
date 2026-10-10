"""MPI-1041 bench, batch 19: Fabio's STEPWISE shape (2026-10-10) - edit the big portrait first, then do the bodies with
that portrait as the REFERENCE, on the halves, as MPI-1042's Klein arm does. All on Klein 9B (commercial-safe), seed 42.
  ref  = an EDIT of the bodies half (896x1120) with the edited portrait as image 2, stitched to that portrait
  p2b  = the bodies half DRAWN FRESH: MPI-1042's flow_character_sheet_from_images_klein.json with its pass-1 portrait
         replaced by the given portrait (node 77 -> a LoadImage), so only pass 2 runs and only the bodies read the
         body words (batch 18: Klein's portrait pass broke the layout when it read them)
Cases: a 10-year-old child (photo, fisher; the portrait = batch 15's Klein de-age, its right half), heavyset (photo:
a portrait edit, then p2b). The front-body face is usually removed by the user (Fabio), so it is not scored.
Clothed sheets only. usage: qp2b.py <out_dir> [2]   - lease only (2 = the child re-runs + muscular fisher)"""
import json, os, shutil, subprocess, sys
from PIL import Image

OUT = sys.argv[1]
PHASE = sys.argv[2] if len(sys.argv) > 2 else '1'
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RUN_API = os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py')
INP = 'G:/ComfyUi/ComfyUI/input'
KLEIN = 'G:/ComfyUi/ComfyUI/output/mpi1041_q1/klein9b_edit_api.json'
HALF_MP = 896 * 1120 / 2 ** 20
KEEP = ' Keep everything else exactly as it is.'
CHILD = ("A 10-year-old child with a child's height and body proportions: a short, small body with shorter arms and "
         'legs, a shorter torso and a larger head for the body. ')
HEAVY = 'A heavyset, overweight build: a round belly, wide hips, thick arms and thick legs. '
MUSCLE = 'A muscular, athletic build: broad shoulders, a broad chest, big muscular arms and thick muscular legs. '
CLOTHES = {'photo': 'Wearing an olive green cotton jacket over a mustard yellow knit jumper, olive green trousers and '
                    'brown leather boots.',
           'fisher': 'Wearing a mustard yellow suit jacket over a white shirt and a grey tie, mustard yellow trousers, '
                     'brown leather shoes and a red knitted beanie.'}

# p2b graph: the shipped Klein from-images graph, pass 1's decoded portrait (77) swapped for a given picture.
P2B = os.path.join(OUT, 'p2b_klein_api.json')
g = json.load(open(os.path.join(REPO, 'comfy_workflows/flow_character_sheet_from_images_klein.json'), encoding='utf-8'))
g['900'] = {'class_type': 'LoadImage', 'inputs': {'image': 'None'}, '_meta': {'title': 'Given_Portrait'}}
g['78']['inputs']['pixels'] = ['900', 0]
g['91']['inputs']['image2'] = ['900', 0]
json.dump(g, open(P2B, 'w', encoding='utf-8'), indent=1)


def edit(tag, img, prompt, img2=None):
    s = {'Input_Image': {'image': img}, 'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': 42},
         'Input_wf_type': {'int': 4}, 'Edit_Scale': {'megapixels': HALF_MP}}
    if img2:
        s['Input_Image_2'] = {'image': img2}
    return {'tag': tag, 'api': KLEIN, 'set': s}


def p2b(tag, portrait, words):
    return {'tag': tag, 'api': P2B, 'set': {
        'Given_Portrait': {'image': portrait}, 'Input_Image': {'image': portrait},
        'Input_Box': {'x': 0, 'y': 0, 'width': 896, 'height': 1120},
        'Input_Face_Pose': {'string': 'TURNED'}, 'Input_Positive': {'string': words}, 'Input_Seed': {'int': 42}}}


def run(spec, name):
    p = os.path.join(OUT, name)
    json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
    subprocess.run([sys.executable, RUN_API, OUT, p], check=True)


def stitch(left, right, out):
    sheet = Image.new('RGB', (1792, 1120))
    sheet.paste(Image.open(left).convert('RGB').resize((896, 1120)), (0, 0))
    sheet.paste(Image.open(right).convert('RGB').resize((896, 1120)), (896, 0))
    sheet.save(out)


for sh, src in (('photo', 'mpi1042art_cafe2_sheet.png'), ('fisher', 'mpi1042art_fisher_sheet.png')):
    im = Image.open(os.path.join(INP, src)).convert('RGB')
    im.crop((0, 0, 896, 1120)).save(os.path.join(INP, f'mpi1041p2b_{sh}_L.png'))
    im.crop((896, 0, 1792, 1120)).save(os.path.join(INP, f'mpi1041p2b_{sh}_R.png'))
    kid = Image.open(os.path.join(OUT, f'kleinv3_age10_{sh}.png')).convert('RGB')  # 1 MP (the edit as shipped)
    kid.crop((kid.width // 2, 0, kid.width, kid.height)).resize((896, 1120), Image.LANCZOS).save(
        os.path.join(INP, f'mpi1041p2b_{sh}_kidR.png'))

if PHASE == '4':  # phase 3: "any beard" GAVE the woman a beard; "muscular" took the portrait's jacket off. So the
    # portrait edit carries the clothes caption too (the Flow's describer writes it for p2b anyway).
    SAME = ' The same person, with the same features, hair and expression.'
    SLEEVES = ' The same clothes, refitted to the new build, with the jacket\'s full-length sleeves.'
    run([edit('P_muscle3_fisher', 'mpi1041p2b_fisher_R.png',
              'Change the character in this close-up portrait to have a muscular, athletic build: a thick muscular '
              'neck and broad, muscular shoulders. ' + CLOTHES['fisher'] + ' The clothes stay on.' + SAME + KEEP),
         edit('P_skinny2_photo', 'mpi1041p2b_photo_R.png',
              'Change the character in this close-up portrait to have a very skinny, thin build: a thinner face, a '
              'thin neck and narrow, bony shoulders. ' + CLOTHES['photo'] + ' The clothes stay on.' + SAME + KEEP)],
        'qp2b_G_spec.json')
    for k, sh in (('muscle3', 'fisher'), ('skinny2', 'photo')):
        shutil.copy(os.path.join(OUT, f'P_{k}_{sh}.png'), os.path.join(INP, f'mpi1041p2b_{sh}_{k}R.png'))
    run([p2b('p2b_muscle3_fisher', 'mpi1041p2b_fisher_muscle3R.png', MUSCLE + CLOTHES['fisher'] + SLEEVES),
         p2b('p2b_skinny2_photo', 'mpi1041p2b_photo_skinny2R.png',
             'A very skinny, thin build: thin arms and thin legs, narrow hips and a narrow waist. ' + CLOTHES['photo']
             + ' The same clothes, refitted loosely to the thin build.')], 'qp2b_H_spec.json')
    print('done 4')
    sys.exit(0)

if PHASE == '3':  # muscular kept the build but bared the arms and the P edit cut the beard; child photo read teen
    FACE = ' Keep the face, its features, any beard and the expression exactly as they are.'
    SLEEVES = ' The same clothes, refitted to the new build, with the jacket\'s full-length sleeves.'
    run([edit('P_muscle2_fisher', 'mpi1041p2b_fisher_R.png',
              'Change the character in this close-up portrait to have a muscular, athletic build: a thick muscular '
              'neck and broad, muscular shoulders, wearing the same clothes.' + FACE + KEEP),
         edit('P_skinny_photo', 'mpi1041p2b_photo_R.png',
              'Change the character in this close-up portrait to have a very skinny, thin build: a thin face with '
              'hollow cheeks, a thin neck and narrow, bony shoulders, wearing the same clothes.' + FACE + KEEP),
         p2b('p2b_child2_photo', 'mpi1041p2b_photo_kidR.png',
             "A 10-year-old primary-school child, much smaller than an adult, with a young child's build: narrow "
             'shoulders, a short torso, short arms and short legs, and a large head for the body. ' + CLOTHES['photo'])],
        'qp2b_E_spec.json')
    for k, sh in (('muscle2', 'fisher'), ('skinny', 'photo')):
        shutil.copy(os.path.join(OUT, f'P_{k}_{sh}.png'), os.path.join(INP, f'mpi1041p2b_{sh}_{k}R.png'))
    run([p2b('p2b_muscle2_fisher', 'mpi1041p2b_fisher_muscle2R.png', MUSCLE + CLOTHES['fisher'] + SLEEVES),
         p2b('p2b_skinny_photo', 'mpi1041p2b_photo_skinnyR.png',
             'A very skinny, thin build: thin arms and thin legs, narrow hips and a narrow waist. ' + CLOTHES['photo']
             + ' The same clothes, refitted loosely to the thin build.')], 'qp2b_F_spec.json')
    print('done 5')
    sys.exit(0)

if PHASE == '2':  # phase 1's child runs had the 1 MP sheet cropped as if 1792 wide; heavy passed, so muscular next
    run([edit('ref_child_photo_L', 'mpi1041p2b_photo_L.png',
              'Change the character in these two full-body views to be the same 10-year-old child as in image 2, with '
              "a child's height and body proportions and the face and hair of image 2, wearing the same clothes." + KEEP,
              img2='mpi1041p2b_photo_kidR.png'),
         p2b('p2b_child_photo', 'mpi1041p2b_photo_kidR.png', CHILD + CLOTHES['photo']),
         p2b('p2b_child_fisher', 'mpi1041p2b_fisher_kidR.png', CHILD + CLOTHES['fisher']),
         edit('P_muscle_fisher', 'mpi1041p2b_fisher_R.png',
              'Change the character in this close-up portrait to have a muscular, athletic build: a strong jaw, a '
              'thick muscular neck and broad, muscular shoulders, wearing the same clothes.' + KEEP)],
        'qp2b_C_spec.json')
    stitch(os.path.join(OUT, 'ref_child_photo_L.png'), os.path.join(INP, 'mpi1041p2b_photo_kidR.png'),
           os.path.join(OUT, 'ref_child_photo.png'))
    shutil.copy(os.path.join(OUT, 'P_muscle_fisher.png'), os.path.join(INP, 'mpi1041p2b_fisher_muscleR.png'))
    run([p2b('p2b_muscle_fisher', 'mpi1041p2b_fisher_muscleR.png', MUSCLE + CLOTHES['fisher'])], 'qp2b_D_spec.json')
    print('done 5')
    sys.exit(0)

run([edit('ref_child_photo_L', 'mpi1041p2b_photo_L.png',
          'Change the character in these two full-body views to be the same 10-year-old child as in image 2, with a '
          "child's height and body proportions and the face and hair of image 2, wearing the same clothes." + KEEP,
          img2='mpi1041p2b_photo_kidR.png'),
     p2b('p2b_child_photo', 'mpi1041p2b_photo_kidR.png', CHILD + CLOTHES['photo']),
     p2b('p2b_child_fisher', 'mpi1041p2b_fisher_kidR.png', CHILD + CLOTHES['fisher']),
     edit('P_heavy_photo', 'mpi1041p2b_photo_R.png',
          'Change the character in this close-up portrait to have a heavyset, overweight build: a fuller, rounder face '
          'with a double chin, a thicker neck and broader, heavier shoulders, wearing the same clothes.' + KEEP)],
    'qp2b_A_spec.json')
stitch(os.path.join(OUT, 'ref_child_photo_L.png'), os.path.join(INP, 'mpi1041p2b_photo_kidR.png'),
       os.path.join(OUT, 'ref_child_photo.png'))
shutil.copy(os.path.join(OUT, 'P_heavy_photo.png'), os.path.join(INP, 'mpi1041p2b_photo_heavyR.png'))
run([p2b('p2b_heavy_photo', 'mpi1041p2b_photo_heavyR.png', HEAVY + CLOTHES['photo'])], 'qp2b_B_spec.json')
print('done 5')
