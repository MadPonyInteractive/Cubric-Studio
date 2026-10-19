import json, sys
# usage: up.py workflow.json node_id depth -> upstream tree (ids/classes/titles only), skipping model/clip/vae
d = json.load(open(sys.argv[1], encoding="utf-8"))
N = {k: n for k, n in d.items() if isinstance(n, dict) and "class_type" in n}
SKIP = {"model", "clip", "vae", "seed", "steps", "cfg", "noise", "sampler", "sigmas"}
seen = set()
def walk(k, depth, pad):
    n = N.get(k)
    if not n: return
    print(f"{pad}{k} {n['class_type']} {n.get('_meta', {}).get('title', '')!r}" + (" (seen)" if k in seen else ""))
    if k in seen or depth == 0: return
    seen.add(k)
    for a, v in n["inputs"].items():
        if a in SKIP or not (isinstance(v, list) and len(v) == 2 and isinstance(v[0], str)): continue
        print(f"{pad}  .{a}[{v[1]}]"); walk(v[0], depth - 1, pad + "    ")
walk(sys.argv[2], int(sys.argv[3]), "")
