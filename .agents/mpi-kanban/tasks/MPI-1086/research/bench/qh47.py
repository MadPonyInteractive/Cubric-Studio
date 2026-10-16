"""MPI-1086 round 47: the SHIPPED face-crop graph (patch_raw_face_crop.py), run as the app injects it: the raw photo as
image 2 + the in-graph makeup mannequin, the app's own prompt strings (qh47_params.mjs), Headless on as a change leg.
  spider_s*   Fabio's case (flowCSFI_011 + imported_024 + his describer words), r46's 3 seeds -> vs h46_crop_A
  spider_red  + the user's words "red lipstick"         words  words only, no picture
  glam, goth  r42's photos + words (regression)          W_spider  the woman's sheet (flowCSE_044)
usage: qh47.py <out> [only...]. Under gpu_lease only. Runs on the G: bench :8188.
"""
import json, os, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh12
import qh26
import qh45
import qh46
from qh26 import run, QWEN
from qh27 import upload, MEDIA
from qh31 import PIC

qh26.URL = qh12.URL = 'http://127.0.0.1:8188'
NO = 'No, it is a photo of a real person.'


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    desc = json.load(open(f'{qh45.R42}/h42_describe.json', encoding='utf-8'))
    for src in ('flowCSFI_011.png', 'flowCSE_044.png', 'imported_024.jpg', PIC['m_glam'][1], PIC['m_goth'][1]):
        upload(MEDIA + src, 'mpi1086_r47_' + src)
    ref = lambda v, words='', w=qh46.SPIDER: {'change': 'makeup', 'words': words, 'mediaItems': [{'role': 'image2', 'url': 'x'}],
                                              'refMakeup': w + '.', 'refIsMannequin': NO, **v}
    cases = [(f'spider_s{s}', 'flowCSFI_011.png', 'imported_024.jpg', s, ref({})) for s in qh46.SEEDS]
    cases += [('spider_red', 'flowCSFI_011.png', 'imported_024.jpg', 31024, ref({}, 'red lipstick')),
              ('words', 'flowCSFI_011.png', None, 31024,
               {'change': 'makeup', 'words': 'dark gothic makeup with smoky eyes and black lipstick'}),
              ('glam', 'flowCSFI_011.png', PIC['m_glam'][1], PIC['m_glam'][2], ref({}, '', desc['m_glam'].rstrip('.'))),
              ('goth', 'flowCSFI_011.png', PIC['m_goth'][1], PIC['m_goth'][2], ref({}, '', desc['m_goth'].rstrip('.'))),
              ('W_spider', 'flowCSE_044.png', 'imported_024.jpg', 31024, ref({}))]
    cj = f'{out}/h47_cases.json'
    json.dump([{'tag': c[0], 'values': c[4]} for c in cases], open(cj, 'w', encoding='utf-8'))
    params = json.loads(subprocess.run(['node', f'{HERE}/qh47_params.mjs', cj], capture_output=True, text=True,
                                       encoding='utf-8', check=True).stdout)
    json.dump(params, open(f'{out}/h47_params.json', 'w', encoding='utf-8'), indent=1)
    for (tag, sheet, photo, seed, _v), p in zip(cases, params):
        t = f'h47_{tag}'
        if (only and not any(t.startswith(o) for o in only)) or os.path.exists(f'{out}/{t}_done'):
            continue
        ip = p['injectionParams']
        assert ip['Input_Face_Crop'] is True and ip['Input_Reference'] is bool(photo), (tag, ip)
        q = {'Input_Image': {'string': 'mpi1086_r47_' + sheet}, 'Input_Seed': {'int': seed},
             'Input_Positive': {'string': p['positive']}, 'Input_Reference': {'boolean': ip['Input_Reference']},
             'Input_Headless': {'boolean': ip['Input_Headless']}, 'Input_Is_Mannequin': {'boolean': ip['Input_Is_Mannequin']},
             'Input_Back_Pass': {'boolean': ip['Input_Back_Pass']}, 'Input_Positive_2': {'string': ip['Input_Positive_2']},
             'Input_Cut_1': {'int': ip['Input_Cut_1']}, 'Input_Cut_2': {'int': ip['Input_Cut_2']},
             'Input_Face_Crop': {'boolean': True}}
        if 'Input_Mannequin_Prompt' in ip:
            q['Input_Mannequin_Prompt'] = {'string': ip['Input_Mannequin_Prompt']}
        if photo:
            q['Input_Image_2'] = {'string': 'mpi1086_r47_' + photo}
        print(t, p['positive'][:160], flush=True)
        run(out, t, QWEN, q)
        open(f'{out}/{t}_done', 'w').close()
