"""MPI-1086 round 43: the SHIPPED Qwen graph (Input_Mannequin_Prompt, patch_raw_mannequin_prompt.py) run with what the
builder injects for Makeup + a picture (Input_Is_Mannequin false, Input_Mannequin_Prompt = MAKEUP_MANNEQUIN, the r42
words): must equal r42's h42_M_m_spider (node 147 overridden by title) pixel for pixel.
usage: qh43.py <out> <r42 dir>. Under gpu_lease only. Runs on the app engine :48188.
"""
import json, os, sys
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh26
from qh26 import run, QWEN
from qh31 import PIC
from qh39 import SHEET_M
from qh41 import MANN, mK

qh26.URL = 'http://127.0.0.1:48188'

if __name__ == '__main__':
    out, r42 = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    d = json.load(open(f'{r42}/h42_describe.json', encoding='utf-8'))['m_spider'].strip().rstrip('.')
    run(out, 'h43_ship_m_spider', QWEN, {
        'Input_Image': {'string': SHEET_M}, 'Input_Image_2': {'string': 'mpi1086_r42_m_spider.png'},
        'Input_Seed': {'int': PIC['m_spider'][2]}, 'Input_Positive': {'string': mK(d)},
        'Input_Reference': {'boolean': True}, 'Input_Headless': {'boolean': True}, 'Input_Is_Mannequin': {'boolean': False},
        'Input_Back_Pass': {'boolean': False}, 'Input_Mannequin_Prompt': {'string': MANN}})
    for o in ('Output_Image', 'Output_Image_2', 'Output_Image_3'):
        a = np.asarray(Image.open(f'{out}/h43_ship_m_spider_{o}.png').convert('RGB'), dtype=int)
        b = np.asarray(Image.open(f'{r42}/h42_M_m_spider_{o}.png').convert('RGB'), dtype=int)
        print(o, 'max diff', int(np.abs(a - b).max()) if a.shape == b.shape else f'shape {a.shape} vs {b.shape}')
