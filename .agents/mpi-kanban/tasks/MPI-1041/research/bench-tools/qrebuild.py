"""MPI-1041 bench, batch 17: a child-SIZED body by REBUILD, not edit (batch 16: an edit keeps the figure or breaks it).
The batch 15 de-aged sheet's portrait half becomes the FACE picture of MPI-1042's Character Sheet from Images (the Qwen
arm, one sampling, as the app ships it), with NO body picture - Qwen copies a body picture's build, which would bring
the adult body back. The child's size and the sheet's own clothes go in the Changes words (the Flow would caption the
clothes with its describer; here they are written by hand). Clothed only. usage: qrebuild.py <out_dir>   - lease only"""
import json, os, subprocess, sys
from PIL import Image

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RUN_API = os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py')
API = os.path.join(REPO, 'comfy_workflows/flow_character_sheet_from_images.json')
INP = 'G:/ComfyUi/ComfyUI/input'
SIZE = ("A 10-year-old child with a child's height and body proportions: a short, small body with shorter arms and legs, "
        'a shorter torso and a larger head for the body. ')
CLOTHES = {'photo': 'Wearing an olive green cotton jacket over a mustard yellow knit jumper, olive green trousers and '
                    'brown leather boots.',
           'fisher': 'Wearing a mustard yellow suit jacket over a white shirt and a grey tie, mustard yellow trousers, '
                     'brown leather shoes and a red knitted beanie.'}
spec = []
for sh in ('photo', 'fisher'):
    im = Image.open(os.path.join(OUT, f'kleinv3_age10_{sh}.png')).convert('RGB')
    face = im.crop((im.width // 2, 0, im.width, im.height))
    face.save(os.path.join(INP, f'mpi1041age_face_{sh}.png'))
    spec.append({'tag': f'rebuild_age10_{sh}', 'api': API, 'set': {
        'Input_Image': {'image': f'mpi1041age_face_{sh}.png'},
        'Input_Box': {'x': 0, 'y': 0, 'width': face.width, 'height': face.height},
        'Input_Face_Pose': {'string': 'TURNED'}, 'Input_Positive': {'string': SIZE + CLOTHES[sh]},
        'Input_Seed': {'int': 42}}})
p = os.path.join(OUT, 'qrebuild_spec.json')
json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
subprocess.run([sys.executable, RUN_API, OUT, p], check=True)
