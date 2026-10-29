"""MPI-1343 fixed-seed A/B: the five small packs vs the Mpi ports, one engine with BOTH loaded.

  python ab.py <scratch>     (<scratch>/before = pre-swap API graphs, <scratch>/in = ab_a/ab_mask/ab_small.png)

krea2_t2i_sfw, pre-swap (before/) vs working tree, turbo, fixed seed, on four branches:
  wf 4 krea2Edit  -> MpiKrea2EditModelPatch, MpiKrea2EditGroundedEncode
  wf 5 inpaint    -> MpiInpaintCrop/Stitch, MpiLanPaintImageEncode/KSampler/ImageDecode
  wf 7 upscale, tile off and on -> MpiUltimateSDUpscale
flow_pano360, pre-swap vs working tree -> MpiKrea2OstrisEditModelPatch, MpiKrea2OstrisEditTextEncode
Outputs are compared by sha256, then decoded with PIL.
"""
import hashlib, json, pathlib, sys, time, urllib.error, urllib.parse, urllib.request, uuid

import numpy as np
from PIL import Image

URL = "http://127.0.0.1:48199"
S = pathlib.Path(sys.argv[1])
BEFORE = S / "before"
OUT = S / "out_ab"
WF = pathlib.Path("C:/AI/Mpi/Cubric-Vision/comfy_workflows")
SEED = 424242


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def run(g, label):
    t0 = time.time()
    try:
        pid = json.loads(call("/prompt", {"prompt": g, "client_id": str(uuid.uuid4())}))["prompt_id"]
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{label}: rejected {e.read()[:3000]}")
    while True:
        h = json.loads(call(f"/history/{pid}"))
        if pid in h:
            break
        time.sleep(1)
    h = h[pid]
    if h["status"]["status_str"] != "success":
        raise SystemExit(f"{label}: {json.dumps(h['status'])[:3000]}")
    files = {}
    for nid, out in sorted(h["outputs"].items()):
        title = g[nid].get("_meta", {}).get("title", nid)
        for key, items in out.items():
            if not isinstance(items, list):
                continue
            for i, f in enumerate(x for x in items if isinstance(x, dict) and "filename" in x):
                q = (f"/view?filename={urllib.parse.quote(f['filename'])}"
                     f"&subfolder={urllib.parse.quote(f.get('subfolder', ''))}&type={f.get('type', 'output')}")
                dst = OUT / f"{label}__{title}_{key}{i}{pathlib.Path(f['filename']).suffix}"
                dst.parent.mkdir(exist_ok=True)
                dst.write_bytes(call(q))
                files[f"{title}_{key}{i}"] = dst
    print(f"{label}: {len(files)} files in {time.time() - t0:.0f}s", flush=True)
    return files


report = []


def compare(name, a, b):
    if a.keys() != b.keys() or not a:
        report.append(f"{name}: DIFFERENT OR EMPTY OUTPUT SETS {sorted(a)} vs {sorted(b)}")
        return
    for k in sorted(a):
        ha, hb = (hashlib.sha256(p.read_bytes()).hexdigest() for p in (a[k], b[k]))
        if ha == hb:
            report.append(f"{name} {k}: bytes IDENTICAL")
            continue
        x, y = (np.asarray(Image.open(p).convert("RGBA")).astype(np.float64) for p in (a[k], b[k]))
        if x.shape != y.shape:
            report.append(f"{name} {k}: bytes differ, SHAPE {x.shape} vs {y.shape}")
            continue
        d = np.abs(x - y)
        report.append(f"{name} {k}: bytes differ, decoded max {d.max():.6g} mean {d.mean():.6g} "
                      f"identical {'YES' if d.max() == 0 else 'no'}")


def load(path, inject):
    g = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    for (title, field), v in inject.items():
        hits = [n for n in g.values() if n.get("_meta", {}).get("title") == title]
        assert len(hits) == 1, (path, title, len(hits))
        hits[0]["inputs"][field] = v
    return g


K = {("Input_Seed", "int"): SEED, ("Input_is_Turbo", "boolean"): True,
     ("Input_Positive", "string"): "a woman with short red hair in a green coat, city street"}
CASES = {
    "krea2_edit": {**K, ("Input_wf_type", "int"): 4, ("Input_Image", "image"): "ab_a.png",
                   ("Input_Positive", "string"): "make her coat bright yellow"},
    "krea2_inpaint": {**K, ("Input_wf_type", "int"): 5, ("Input_Image", "image"): "ab_a.png",
                      ("Input_Mask", "image"): "ab_mask.png"},
    "krea2_upscale": {**K, ("Input_wf_type", "int"): 7, ("Input_Image", "image"): "ab_small.png"},
    "krea2_upscale_tile": {**K, ("Input_wf_type", "int"): 7, ("Input_Image", "image"): "ab_small.png",
                           ("Input_Tile_Upscale", "boolean"): True},
}
only = sys.argv[2].split(",") if len(sys.argv) > 2 else list(CASES) + ["pano"]
for name, inject in CASES.items():
    if name not in only:
        continue
    a = run(load(BEFORE / "krea2_t2i_sfw.json", inject), name + "_pack")
    b = run(load(WF / "krea2_t2i_sfw.json", inject), name + "_mpi")
    compare(name, a, b)
    (OUT / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
if "pano" in only:
    inject = {("Input_Seed", "int"): SEED, ("Input_Image", "image"): "ab_a.png",
              ("Input_Positive", "string"): "a city street at dusk"}
    a = run(load(BEFORE / "flow_pano360.json", inject), "pano_pack")
    b = run(load(WF / "flow_pano360.json", inject), "pano_mpi")
    compare("pano360", a, b)
    (OUT / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
print("\n".join(report))
