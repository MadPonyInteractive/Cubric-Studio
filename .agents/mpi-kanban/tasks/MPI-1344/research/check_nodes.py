import json, glob, os, sys, urllib.request
port = sys.argv[1]
info = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/object_info", timeout=60))
roots = [r"C:\AI\Mpi\Cubric-Vision\comfy_workflows\*.json",
         os.path.expandvars(r"%APPDATA%\Cubric Studio\user_flows\*\workflow.json")]
missing, checked = {}, 0
for pat in roots:
    for f in glob.glob(pat):
        d = json.load(open(f, encoding="utf-8"))
        for n in (d.values() if isinstance(d, dict) else []):
            if isinstance(n, dict) and "class_type" in n:
                checked += 1
                if n["class_type"] not in info:
                    missing.setdefault(n["class_type"], set()).add(os.path.basename(os.path.dirname(f)) + "/" + os.path.basename(f))
print(f"engine knows {len(info)} node types; checked {checked} nodes in workflows")
for t, fs in sorted(missing.items()):
    print("MISSING", t, "<-", ", ".join(sorted(fs)))
print("ALL PRESENT" if not missing else f"{len(missing)} missing types")
