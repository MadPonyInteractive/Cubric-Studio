"""MPI-1086 round 39b: r39's partial denoise came out as noise (birds and branches): the KSampler's latent_image is
TextEncodeQwenImage21's latent output, which is NOT the sheet's encoding. Here the sheet is VAE-encoded for real
(VAEEncode of Input_Image with the Qwen VAE) and fed to the main KSampler, then denoise < 1.
  e85 / e75   mA2, denoise 0.85 / 0.75 from the encoded sheet
  Fe80        mF, denoise 0.80 from the encoded sheet
  e90 / e95   mA2, denoise 0.90 / 0.95 (e85 kept his face but only part of the spider web)
usage: qh39b.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN
from qh33 import mA2
from qh39 import mF, REFS, SHEET_M

qh26.URL = 'http://127.0.0.1:48188'
VARIANTS = {'e85': (mA2, 0.85), 'e75': (mA2, 0.75), 'Fe80': (mF, 0.80), 'e90': (mA2, 0.90), 'e95': (mA2, 0.95)}

if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    g = json.load(open(QWEN, encoding='utf-8'))
    g['900'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['11', 0], 'vae': ['4', 0]},
                '_meta': {'title': 'r39b: the sheet, encoded'}}
    g['33']['inputs']['latent_image'] = ['900', 0]
    api = os.path.join(out, 'qh39b_api.json')
    json.dump(g, open(api, 'w', encoding='utf-8'))
    for k, (_ref, seed) in REFS.items():   # pictures already uploaded by qh39
        for v, (fn, dn) in VARIANTS.items():
            tag = f'h39b_{v}_{k}'
            if (only and not any(tag.startswith(o) for o in only)) or any(
                    f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
                continue
            run(out, tag, api, {'Input_Image': {'string': SHEET_M}, 'Input_Image_2': {'string': f'mpi1086_r39_{k}.png'},
                                'Input_Seed': {'int': seed}, 'Input_Positive': {'string': fn('')},
                                'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': True},
                                'Input_Is_Mannequin': {'boolean': True}, 'Input_Back_Pass': {'boolean': False},
                                'KSampler': {'denoise': dn}})
