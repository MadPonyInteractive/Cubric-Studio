"""MPI-1086 round 40 (Fabio: "have you tried different prompt approaches?"): prompt approaches against the face leak on
the MALE sheet (flowCSFI_011), each at full redraw (1.0) and at 0.90 from the encoded sheet (qh39b's VAEEncode).
  W   NO picture: the makeup in words only (qh34.mW + qh32.DESC, what a describer would answer) - no face to leak
  M   the shipped picture string mA2 with the character named a man ("the man in image 1 ... stays the same man")
usage: qh40.py <out> [only...]. Under gpu_lease only. Runs on the app engine :48188.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN
from qh32 import DESC
from qh33 import mA2
from qh34 import mW
from qh39 import REFS, SHEET_M

qh26.URL = 'http://127.0.0.1:48188'


def mM(w):
    return (mA2(w).replace('the character in image 1', 'the man in image 1')
            .replace('who stays the same person', 'who stays the same man'))


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    os.makedirs(out, exist_ok=True)
    g = json.load(open(QWEN, encoding='utf-8'))
    g['900'] = {'class_type': 'VAEEncode', 'inputs': {'pixels': ['11', 0], 'vae': ['4', 0]},
                '_meta': {'title': 'r39b: the sheet, encoded'}}
    g['33']['inputs']['latent_image'] = ['900', 0]
    enc = os.path.join(out, 'qh39b_api.json')
    json.dump(g, open(enc, 'w', encoding='utf-8'))
    for k, (_ref, seed) in REFS.items():   # pictures already uploaded by qh39
        for v, text, use_ref in (('W', mW(DESC[k]), False), ('M', mM(''), True)):
            for dn in (1.0, 0.90):
                tag = f'h40_{v}{int(dn * 100)}_{k}'
                if (only and not any(tag.startswith(o) for o in only)) or any(
                        f2.startswith(tag + '_Output') for f2 in os.listdir(out)):
                    continue
                run(out, tag, QWEN if dn == 1.0 else enc, {
                    'Input_Image': {'string': SHEET_M}, 'Input_Image_2': {'string': f'mpi1086_r39_{k}.png'},
                    'Input_Seed': {'int': seed}, 'Input_Positive': {'string': text},
                    'Input_Reference': {'boolean': use_ref}, 'Input_Headless': {'boolean': True},
                    'Input_Is_Mannequin': {'boolean': True}, 'Input_Back_Pass': {'boolean': False},
                    'KSampler': {'denoise': dn}})
