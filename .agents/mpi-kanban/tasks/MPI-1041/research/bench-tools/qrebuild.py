"""MPI-1041 bench, batch 17: a child-SIZED body by REBUILD, not edit (batch 16: an edit keeps the figure or breaks it).
The batch 15 de-aged sheet's portrait half becomes the FACE picture of MPI-1042's Character Sheet from Images (the Qwen
arm, one sampling, as the app ships it), with NO body picture - Qwen copies a body picture's build, which would bring
the adult body back. The child's size and the sheet's own clothes go in the Changes words (the Flow would caption the
clothes with its describer; here they are written by hand). Clothed only. usage: qrebuild.py <out_dir> [klein]   - lease only
Batch 18: `klein` runs the Klein 9B arm instead (flow_character_sheet_from_images_klein.json, two samplings, its images
commercial-safe), same pictures and words."""
import json, os, subprocess, sys
from PIL import Image

OUT = sys.argv[1]
ARM = sys.argv[2] if len(sys.argv) > 2 else ''  # '' (Qwen) | klein | kleinshort | kleinviews
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RUN_API = os.path.join(REPO, '.agents/mpi-kanban/tasks/MPI-1042/research/bench-tools/run_api.py')
API = os.path.join(REPO, 'comfy_workflows/flow_character_sheet_from_images%s.json' % ('_klein' if ARM.startswith('klein') else ''))
INP = 'G:/ComfyUi/ComfyUI/input'
# Batch 18: Klein's PORTRAIT pass reads these words too, and the body words turned its portrait into a full figure.
# kleinshort = the age alone; kleinviews = the body words tied to the full-body views.
SIZE = {'kleinshort': 'A 10-year-old child. ',
        'kleinviews': ("A 10-year-old child. In the full-body views the child has a child's height and body proportions: "
                       'shorter arms and legs, a shorter torso and a larger head for the body. ')}.get(ARM, (
        "A 10-year-old child with a child's height and body proportions: a short, small body with shorter arms and legs, "
        'a shorter torso and a larger head for the body. '))
CLOTHES = {'photo': 'Wearing an olive green cotton jacket over a mustard yellow knit jumper, olive green trousers and '
                    'brown leather boots.',
           'fisher': 'Wearing a mustard yellow suit jacket over a white shirt and a grey tie, mustard yellow trousers, '
                     'brown leather shoes and a red knitted beanie.'}
spec = []
for sh in ('photo', 'fisher'):
    im = Image.open(os.path.join(OUT, f'kleinv3_age10_{sh}.png')).convert('RGB')
    face = im.crop((im.width // 2, 0, im.width, im.height))
    face.save(os.path.join(INP, f'mpi1041age_face_{sh}.png'))
    spec.append({'tag': f'rebuild{ARM}_age10_{sh}', 'api': API, 'set': {
        'Input_Image': {'image': f'mpi1041age_face_{sh}.png'},
        'Input_Box': {'x': 0, 'y': 0, 'width': face.width, 'height': face.height},
        'Input_Face_Pose': {'string': 'TURNED'}, 'Input_Positive': {'string': SIZE + CLOTHES[sh]},
        'Input_Seed': {'int': 42}}})
p = os.path.join(OUT, f'qrebuild{ARM}_spec.json')
json.dump(spec, open(p, 'w', encoding='utf-8'), indent=1)
subprocess.run([sys.executable, RUN_API, OUT, p], check=True)
