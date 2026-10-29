import json, os, re, glob, collections, sys

REPO = r"C:\AI\Mpi\Cubric-Vision"
BENCH = r"G:\ComfyUi\ComfyUI"
CN = os.path.join(BENCH, "custom_nodes")

lock = json.load(open(os.path.join(REPO, "dev_configs", "node_lock.json"), encoding="utf-8"))["nodes"]

# 1. used node types -> which workflows use them
used = collections.defaultdict(set)
for f in glob.glob(os.path.join(REPO, "comfy_workflows", "*.json")):
    try:
        d = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        print("skip", f, e); continue
    nodes = d.values() if isinstance(d, dict) else []
    for n in nodes:
        if isinstance(n, dict) and "class_type" in n:
            used[n["class_type"]].add(os.path.basename(f)[:-5])
js_types = set()
for root in ("js", "routes"):
    for f in glob.glob(os.path.join(REPO, root, "**", "*.js"), recursive=True):
        for m in re.finditer(r"class_type['\"]?\s*:\s*['\"]([^'\"]+)['\"]", open(f, encoding="utf-8", errors="ignore").read()):
            js_types.add(m.group(1))
            used[m.group(1)].add("(js:" + os.path.relpath(f, REPO).replace("\\", "/") + ")")

# 2. find defining folder for each type
def pyfiles(d):
    for f in glob.glob(os.path.join(d, "**", "*.py"), recursive=True):
        if "\\.git\\" in f or "\\tests\\" in f.lower():
            continue
        yield f
src = {}
def load(folder):
    txt = []
    for f in pyfiles(folder):
        try: txt.append(open(f, encoding="utf-8", errors="ignore").read())
        except Exception: pass
    return "\n".join(txt)

core = load(os.path.join(BENCH, "nodes.py")) if False else ""
core_txt = open(os.path.join(BENCH, "nodes.py"), encoding="utf-8").read() + load(os.path.join(BENCH, "comfy_extras")) + load(os.path.join(BENCH, "comfy_api_nodes"))
pack_dirs = {}
for name, v in lock.items():
    cands = [p for p in os.listdir(CN) if p.lower() == v["filename"].lower() or p.lower() == name.lower()]
    pack_dirs[name] = os.path.join(CN, cands[0]) if cands else None
pack_txt = {n: (load(p) if p else "") for n, p in pack_dirs.items()}

def defines(txt, t):
    e = re.escape(t)
    return re.search(r"['\"]" + e + r"['\"]\s*:", txt) or re.search(r"node_id\s*=\s*['\"]" + e + r"['\"]", txt) or re.search(r"\bclass\s+" + e + r"\b", txt)

owner = {}
for t in used:
    hits = [n for n, txt in pack_txt.items() if txt and defines(txt, t)]
    if defines(core_txt, t):
        hits = ["CORE"] + hits
    owner[t] = hits

by_pack = collections.defaultdict(list)
for t, h in owner.items():
    by_pack[h[0] if h else "UNKNOWN"].append(t)

out = {"missing_pack_dirs": [n for n, p in pack_dirs.items() if not p], "packs": {}}
for name in list(lock) + ["CORE", "UNKNOWN"]:
    types = sorted(by_pack.get(name, []))
    req = None
    if name in pack_dirs and pack_dirs[name]:
        rp = os.path.join(pack_dirs[name], "requirements.txt")
        if os.path.exists(rp):
            req = [l.strip() for l in open(rp, encoding="utf-8", errors="ignore") if l.strip() and not l.startswith("#")]
        loc = sum(sum(1 for _ in open(f, encoding="utf-8", errors="ignore")) for f in pyfiles(pack_dirs[name]))
    else:
        loc = None
    out["packs"][name] = {
        "installRequirements": lock.get(name, {}).get("installRequirements"),
        "py_lines": loc,
        "requirements": req,
        "types": {t: sorted(used[t]) for t in types} if name != "CORE" else len(types),
        "ambiguous": {t: owner[t] for t in types if len(owner[t]) > 1},
    }
json.dump(out, open(sys.argv[1], "w", encoding="utf-8"), indent=1)
print("done", len(used), "types")
