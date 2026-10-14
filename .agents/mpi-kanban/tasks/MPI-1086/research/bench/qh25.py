"""MPI-1086 round 25: the SHIPPED graph file (comfy_workflows/flow_character_sheet_edit_qwen.json, converted from the
patched raw) run as the app injects it. h25_ref = buns s42 with the photo + Input_Reference on (must match r23's
mannequin route); h25_body = Body shape with NO picture and Input_Reference off (the old one-picture edit; Klein must
not load). usage: qh25.py <out>. Under gpu_lease only.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import qh16
import qh21
import qf2

if __name__ == '__main__':
    out = sys.argv[1]
    desc = json.load(open(f'{out}/h22_describe.json', encoding='utf-8'))
    ref = qh16.SHEETS['W'][2]
    cases = [
        ('h25_ref', {'Input_Image_2': {'string': ref}, 'Input_Reference': {'boolean': True},
                     'Input_Positive': {'string': qh21.q1(desc[ref].strip().rstrip('.'))}}),
        ('h25_body', {'Input_Reference': {'boolean': False}, 'Input_Positive': {'string':
                      "Make the character's body heavyset. Make the same change in the close-up portrait on the right. "
                      'Keep everything else exactly as it is.'}}),
    ]
    for tag, extra in cases:
        if os.path.exists(f'{out}/{tag}.png'):
            print(tag, 'exists, skipped', flush=True)
            continue
        print(tag, flush=True)
        qf2.run(out, [{'tag': tag, 'api': qh21.QAPI, 'set': {
            'Input_Image': {'string': qh16.SHEETS['W'][0]}, 'Input_Seed': {'int': 42}, **extra}}], tag)
