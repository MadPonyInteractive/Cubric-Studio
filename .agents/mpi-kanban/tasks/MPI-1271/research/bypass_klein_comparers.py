"""Fabio's ComfyUI saves of klein_t2i_template re-activate the three rgthree Image Comparers; keep them bypassed (mode 4)."""
import json

P = 'comfy_workflows/raw/klein_t2i_template.json'
w = json.load(open(P, encoding='utf8'))
for n in w['nodes']:
    if n['id'] in (453, 457, 643):
        assert n['type'] == 'Image Comparer (rgthree)', n['type']
        n['mode'] = 4
open(P, 'w', encoding='utf8', newline='\n').write(json.dumps(w, indent=2, ensure_ascii=False))
print('bypassed 453 457 643')
