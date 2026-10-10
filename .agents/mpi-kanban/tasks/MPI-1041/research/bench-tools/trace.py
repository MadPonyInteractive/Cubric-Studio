"""trace.py <comfy_workflows/x.json> - every node downstream of Input_Image, in id order, with its literal inputs and
which upstream ids feed it. Finds the edit path's size nodes (ImageScaleToTotalPixels, latents) before a bench sets them."""
import json, sys

g = json.load(open(sys.argv[1], encoding='utf-8'))
src = next(k for k, v in g.items() if v.get('_meta', {}).get('title') == 'Input_Image')
down, frontier = {src}, [src]
while frontier:
    n = frontier.pop()
    for k, v in g.items():
        if k not in down and any(isinstance(b, list) and b[0] == n for b in v['inputs'].values()):
            down.add(k)
            frontier.append(k)
for k in sorted(down, key=int):
    v = g[k]
    lit = {a: b for a, b in v['inputs'].items() if not isinstance(b, list)}
    links = {a: b[0] for a, b in v['inputs'].items() if isinstance(b, list)}
    print(k, v['class_type'], '|', v.get('_meta', {}).get('title', ''), '|', json.dumps(lit)[:120], '|', json.dumps(links)[:200])
