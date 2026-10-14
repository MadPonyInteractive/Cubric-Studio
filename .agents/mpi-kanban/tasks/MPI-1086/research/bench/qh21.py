"""MPI-1086 phase B round 21: hair from a PICTURE on Qwen-Image 2.1 (Fabio, 2026-10-14: Qwen for the picture route,
Klein for words). The Editor's Qwen graph (flow_character_sheet_edit_qwen.json, Body shape) has NO lock, so the
paste-back failures of r16-r20 (double jaw, a face out of place) cannot happen; the question is identity and layout.
Bench copy: the M4 mannequin (qh19) as images.image_2 of TextEncodeQwenImage21. Q1 string names image 1 / image 2.
Sheets as qh16 (W buns / M man / B braids). usage: qh21.py <out> [only...] ('rate' = s1-s4). Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh1
import qh3
import qh11
import qh16
import qf2

QAPI = qf2.REPO + '/comfy_workflows/flow_character_sheet_edit_qwen.json'


def graph(out):
    g = json.load(open(QAPI, encoding='utf-8'))
    g['900'] = {'class_type': 'MpiLoadImage', 'inputs': {'image': 'None', 'channel': 'alpha', 'block_if_empty': True,
                'string': ''}, '_meta': {'title': 'Input_Image_2'}}
    g['30']['inputs']['images.image_2'] = ['900', 0]
    p = f'{out}/h21_api.json'
    json.dump(g, open(p, 'w', encoding='utf-8'), indent=1)
    return p


def q1(desc):
    return (f'Give the character in image 1 the hairstyle and hair colour from image 2: {desc}, with the head uncovered '
            f'and no hat. {qh3.ALL} {qh11.OWN} {qh3.KEEP}')


if __name__ == '__main__':
    out = sys.argv[1]
    only = sys.argv[2:]
    desc = json.load(open(f'{out}/h19_describe.json', encoding='utf-8'))
    api = graph(out)
    cases = [(s, t, seed) for s in 'MBW' for t, seed in qh1.SEEDS[1:]]
    if 'rate' in only:
        cases = [(s, f's{n}', n) for s in 'MBW' for n in (1, 2, 3, 4)]
        only = [o for o in only if o != 'rate']
    for s, t, seed in cases:
        tag = f'h21_{s}_{t}'
        if only and not any(tag.startswith(o) for o in only):
            continue
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        ref = f'mpi1086_man4_{qh16.SHEETS[s][2][len("mpi1086_"):-4]}.png'
        prompt = q1(desc[ref].strip().rstrip('.'))
        print(tag, prompt, flush=True)
        qf2.run(out, [{'tag': tag, 'api': api, 'set': {
            'Input_Image': {'string': qh16.SHEETS[s][0]}, 'Input_Image_2': {'string': ref},
            'Input_Positive': {'string': prompt}, 'Input_Seed': {'int': seed}}}], tag)
