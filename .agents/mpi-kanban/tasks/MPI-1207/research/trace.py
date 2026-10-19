import json, sys
# usage: trace.py workflow.json  -> Input_* titles + every sampler's latent chain (3 hops)
d = json.load(open(sys.argv[1], encoding="utf-8"))
N = {k: n for k, n in d.items() if isinstance(n, dict) and "class_type" in n}
T = lambda k: N[k].get("_meta", {}).get("title", "")
print("Inputs:", sorted(T(k) for k in N if T(k).startswith("Input_")))
def show(k, depth, pad):
    n = N.get(k)
    if not n: return
    ins = {a: v for a, v in n["inputs"].items() if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str)}
    lits = {a: v for a, v in n["inputs"].items() if a not in ins and not isinstance(v, (dict,))}
    print(f"{pad}{k} {n['class_type']} {T(k)!r} {json.dumps(lits, ensure_ascii=False)[:120]}")
    if depth == 0: return
    for a, (src, _) in ins.items():
        if a in ("model", "clip", "vae", "positive", "negative", "seed", "steps", "cfg", "sigmas", "sampler", "guider", "noise", "conditioning", "denoise"): continue
        print(f"{pad}  .{a} <-", end=" "); show(src, depth - 1, pad + "    ")
for k, n in N.items():
    if "Sampler" in n["class_type"] and ("latent_image" in n["inputs"] or "latent" in n["inputs"]):
        print("---"); show(k, int(sys.argv[2]) if len(sys.argv) > 2 else 3, "")
