"""Check the Step 0 graphs against a ComfyUI's /object_info before any GPU time is spent.

Every class must exist, every required input must be set, every plain combo value must be one
the server offers. Model-file combos are reported, not failed: the Pod's folder layout differs
from the local bench's.

  python check_graphs.py http://127.0.0.1:8188
"""
import glob
import json
import os
import sys
import urllib.request

FILE_KEYS = {"unet_name", "clip_name", "vae_name", "lora_name", "model_name", "image"}

# The RunPod proxy answers 403 to urllib's default User-Agent.
opener = urllib.request.build_opener()
opener.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")]
urllib.request.install_opener(opener)

base = sys.argv[1].rstrip("/")
info = json.load(urllib.request.urlopen(base + "/object_info", timeout=60))
fails = 0
for path in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "graphs", "*.json"))):
    d = json.load(open(path, encoding="utf-8"))
    problems, notes = [], []
    for nid, node in d.items():
        cls = node["class_type"]
        spec = info.get(cls)
        if not spec:
            problems.append("%s: class %s missing" % (nid, cls))
            continue
        req = spec["input"].get("required", {})
        opt = spec["input"].get("optional", {})
        for name in req:
            if name not in node["inputs"] and not any(k.startswith(name + ".") for k in node["inputs"]):
                problems.append("%s %s: required %s unset" % (nid, cls, name))
        for name, val in node["inputs"].items():
            s = req.get(name) or opt.get(name)
            if s is None or isinstance(val, list):
                continue
            choices = s[0] if isinstance(s[0], list) else (s[1].get("options") if s[0] == "COMBO" and len(s) > 1 else None)
            if choices and val not in choices:
                (notes if name in FILE_KEYS else problems).append("%s %s.%s=%r not offered" % (nid, cls, name, val))
    fails += bool(problems)
    print(os.path.basename(path), "OK" if not problems else "FAIL")
    for p in problems:
        print("   !", p)
    for n in notes:
        print("   ~", n)
sys.exit(1 if fails else 0)
