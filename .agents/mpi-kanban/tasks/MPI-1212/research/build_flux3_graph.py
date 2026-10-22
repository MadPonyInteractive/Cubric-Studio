"""MPI-1212 Phase 2a: write comfy_workflows/flow_character_sheet_images_flux3.json, the Character Sheet
Editor's child rebuild leg on FLUX.3 Turbo. It is the shipped Qwen from-images graph through the same
`swap_qwen` the bench ran (cseq8_3_tpl), so the file IS the benched graph.

  python build_flux3_graph.py        (re-run after any edit of the Qwen twin)
"""
import json, os
import flowbench as fb

ROOT = os.path.abspath(os.path.join(fb.HERE, *['..'] * 5))
SRC = os.path.join(ROOT, 'comfy_workflows', 'flow_character_sheet_from_images.json')
DST = os.path.join(ROOT, 'comfy_workflows', 'flow_character_sheet_images_flux3.json')

g = fb.swap_qwen(json.load(open(SRC, encoding='utf-8')), 'flux3turbo')
for v in g.values():   # the bench's working titles -> plain ones
    t = v.get('_meta', {}).get('title', '')
    if t.startswith('MPI-1212 FLUX.3 for '):
        v['_meta']['title'] = 'FLUX.3 prompt + references'
    elif t == 'MPI-1212 negative':
        v['_meta']['title'] = 'empty negative'
fb.check(g, fb.QWEN_UNETS)
with open(DST, 'w', encoding='utf-8', newline='\n') as f:
    json.dump(g, f, indent=2, ensure_ascii=False)
    f.write('\n')
print(DST, len(g), 'nodes')
