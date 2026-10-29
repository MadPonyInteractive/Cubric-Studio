"""MPI-1339 fixed-seed A/B: Impact graph (git HEAD) vs Mpi graph (working tree), same engine.

Run with the bench python while a scratch engine (run_engine.sh, port 48199) has BOTH the Impact
packs and MpiNodes loaded, under gpu_lease.py. Writes PNGs + report.txt next to this file.
  python ab.py <before_dir>
before_dir holds the HEAD copies of t2i_sdxl_realistic.json and img_auto_mask.json.
"""
import io, json, pathlib, shutil, sys, time, urllib.request, uuid

import numpy as np
from PIL import Image, ImageDraw

URL = "http://127.0.0.1:48199"
HERE = pathlib.Path(__file__).resolve().parent
WF = pathlib.Path(r"C:/AI/Mpi/Cubric-Vision/comfy_workflows")
INPUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
BEFORE = pathlib.Path(sys.argv[1])
SEED = 424242
PROMPT = "photo portrait of two friends laughing in a park, faces in focus, natural light"


def load(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def by_title(g, title):
    hits = [n for n in g.values() if n.get("_meta", {}).get("title") == title]
    assert len(hits) == 1, (title, len(hits))
    return hits[0]["inputs"]


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def run(graph, label):
    t0 = time.time()
    try:
        pid = json.loads(call("/prompt", {"prompt": graph, "client_id": str(uuid.uuid4())}))["prompt_id"]
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{label}: rejected {e.read()[:2000]}")
    while True:
        h = json.loads(call(f"/history/{pid}"))
        if pid in h:
            break
        time.sleep(1)
    h = h[pid]
    if h["status"]["status_str"] != "success":
        raise SystemExit(f"{label}: {json.dumps(h['status'])[:3000]}")
    imgs = {}
    for nid, out in sorted(h["outputs"].items()):
        title = graph[nid].get("_meta", {}).get("title", nid)
        for i, im in enumerate(out.get("images", [])):
            q = f"/view?filename={im['filename']}&subfolder={im['subfolder']}&type={im['type']}"
            arr = np.asarray(Image.open(io.BytesIO(call(q))).convert("RGB"))
            imgs[f"{title}_{i}"] = arr
            Image.fromarray(arr).save(HERE / f"{label}__{title}_{i}.png")
    print(f"{label}: {len(imgs)} images in {time.time() - t0:.0f}s", flush=True)
    return imgs


def sdxl(src, **inject):
    g = load(src)
    by_title(g, "Input_Seed")["int"] = SEED
    by_title(g, "Input_Positive")["value"] = PROMPT
    for (title, field), v in inject.items():
        by_title(g, title)[field] = v
    return g


def automask(src, **inject):
    g = load(src)
    for (title, field), v in inject.items():
        by_title(g, title)[field] = v
    return g


report = []
def compare(name, a, b):
    if a.keys() != b.keys():
        report.append(f"{name}: DIFFERENT OUTPUT SETS {sorted(a)} vs {sorted(b)}")
        return
    for k in sorted(a):
        x, y = a[k].astype(np.int16), b[k].astype(np.int16)
        if x.shape != y.shape:
            report.append(f"{name} {k}: SHAPE {x.shape} vs {y.shape}")
            continue
        d = np.abs(x - y)
        report.append(f"{name} {k} {x.shape[1]}x{x.shape[0]}: max {d.max()} mean {d.mean():.4f} "
                      f"identical {'YES' if d.max() == 0 else 'no'}")


SDXL_NEW, SDXL_OLD = WF / "t2i_sdxl_realistic.json", BEFORE / "t2i_sdxl_realistic.json"
AM_NEW, AM_OLD = WF / "img_auto_mask.json", BEFORE / "img_auto_mask.json"

# 0. the source portrait (t2i branch has no detailer node)
src = run(sdxl(SDXL_NEW, **{("Input_wf_type", "int"): 1}), "t2i")
src_img = next(iter(src.values()))
INPUT.mkdir(parents=True, exist_ok=True)
Image.fromarray(src_img).save(INPUT / "ab_src.png")
h, w = src_img.shape[:2]
mask = Image.new("RGB", (w, h))
ImageDraw.Draw(mask).ellipse([w * 0.15, h * 0.1, w * 0.85, h * 0.6], fill=(255, 255, 255))
mask.save(INPUT / "ab_mask.png")

img_in = {("Input_Image", "string"): "ab_src.png"}
jobs = [
    ("detail", sdxl, SDXL_OLD, SDXL_NEW, {("Input_wf_type", "int"): 6, ("Input_Mask", "string"): "ab_mask.png", **img_in}),
    ("tiles", sdxl, SDXL_OLD, SDXL_NEW, {("Input_wf_type", "int"): 7, ("Input_Tile_Upscale", "boolean"): True, **img_in}),
    ("mask_box", automask, AM_OLD, AM_NEW, img_in),
    ("mask_text", automask, AM_OLD, AM_NEW, {("Input_Text_Mode", "boolean"): True, ("Input_Text_Prompt", "text"): "person", **img_in}),
]
for name, make, old, new, inj in jobs:
    a = run(make(old, **inj), f"{name}_impact")
    b = run(make(new, **inj), f"{name}_mpi")
    compare(name, a, b)

(HERE / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
print("\n".join(report))
