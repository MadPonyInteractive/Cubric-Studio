"""MPI-1341 fixed-seed A/B: KJNodes vs the Mpi ports, one engine with BOTH loaded.

  python ab.py <before_dir> <input_dir> [mini,ltx]

mini: every shipped instance of the image/mask KJ nodes, with its literal widget values, run as
      the KJ class and as the Mpi class on the same inputs (ab_a.png, ab_b.png).
ltx:  flow_ltx_extend.json pre-swap (before_dir) vs working tree, fixed seed, on ab_clip.mp4.
      Covers MpiLTX2NAG, MpiLTXAudioVideoMask, MpiVAELoader, MpiImageBatchExtend, MpiImageRange.
Outputs are compared by sha256, then decoded (frames via ffmpeg, images via PIL).
"""
import hashlib, json, pathlib, subprocess, sys, time, urllib.error, urllib.parse, urllib.request, uuid

import numpy as np

URL = "http://127.0.0.1:48199"
HERE = pathlib.Path(__file__).resolve().parent
WF = pathlib.Path("C:/AI/Mpi/Cubric-Vision/comfy_workflows")
BEFORE = pathlib.Path(sys.argv[1])
SEED = 424242
MAP = {
    "ColorMatch": "MpiColorMatch", "GrowMaskWithBlur": "MpiGrowMaskBlur",
    "ImageBatchMulti": "MpiImageBatchMulti", "ImageResizeKJv2": "MpiImageResize",
    "ImageConcanate": "MpiImageConcat",
}


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
                ext = pathlib.Path(f["filename"]).suffix
                dst = HERE / "out" / f"{label}__{title}_{key}{i}{ext}"
                dst.parent.mkdir(exist_ok=True)
                dst.write_bytes(call(q))
                files[f"{title}_{key}{i}{ext}"] = dst
    print(f"{label}: {len(files)} files in {time.time() - t0:.0f}s", flush=True)
    return files


def decode(p):
    if p.suffix in (".mp4", ".webm", ".mov"):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                             capture_output=True, check=True).stdout
        return np.frombuffer(raw, np.uint8).astype(np.int16)
    from PIL import Image
    return np.asarray(Image.open(p).convert("RGBA")).astype(np.int16)


report = []
def compare(name, a, b):
    if a.keys() != b.keys():
        report.append(f"{name}: DIFFERENT OUTPUT SETS {sorted(a)} vs {sorted(b)}")
        return
    for k in sorted(a):
        ha, hb = (hashlib.sha256(p.read_bytes()).hexdigest() for p in (a[k], b[k]))
        if ha == hb:
            report.append(f"{name} {k}: bytes IDENTICAL")
            continue
        x, y = decode(a[k]), decode(b[k])
        if x.shape != y.shape:
            report.append(f"{name} {k}: bytes differ, SHAPE {x.shape} vs {y.shape}")
            continue
        d = np.abs(x.astype(np.float64) - y.astype(np.float64))
        report.append(f"{name} {k}: bytes differ, decoded max {d.max():.6g} mean {d.mean():.6g} "
                      f"identical {'YES' if d.max() == 0 else 'no'}")


def mini_graphs():
    """Every shipped instance of a MAP node (pre-swap graphs), fed images/masks from two pictures."""
    info = json.loads(call("/object_info"))
    seen, cases = set(), []
    for f in sorted(BEFORE.glob("*.json")):
        g = json.loads(f.read_text(encoding="utf-8"))
        if "nodes" in g:
            continue
        for nid, n in g.items():
            if not isinstance(n, dict) or n.get("class_type") not in MAP:
                continue
            widgets = {k: v for k, v in n["inputs"].items() if not isinstance(v, list)}
            key = (n["class_type"], json.dumps(widgets, sort_keys=True))
            if key in seen:
                continue
            seen.add(key)
            cases.append((f"{f.stem}#{nid}", n))
    graph_old, graph_new = {}, {}
    for g in (graph_old, graph_new):
        g["a"] = {"class_type": "LoadImage", "inputs": {"image": "ab_a.png"}}
        g["b"] = {"class_type": "LoadImage", "inputs": {"image": "ab_b.png"}}
        g["ma"] = {"class_type": "ImageToMask", "inputs": {"image": ["a", 0], "channel": "red"}}
    for i, (label, n) in enumerate(cases):
        cls = n["class_type"]
        spec = info[cls]["input"]
        types = {**{k: v[0] for k, v in spec.get("required", {}).items()},
                 **{k: v[0] for k, v in spec.get("optional", {}).items()}}
        inputs = {}
        for k, v in n["inputs"].items():
            if not isinstance(v, list):
                inputs[k] = v
                continue
            t = types.get(k)
            if t == "IMAGE":
                inputs[k] = ["b", 0] if k in ("image_ref", "image2", "image_2") else ["a", 0]
            elif t == "MASK":
                inputs[k] = ["ma", 0]
            elif t == "INT":
                inputs[k] = 512 if k in ("width", "height") else 1
            elif t == "FLOAT":
                inputs[k] = 1.0
            # other linked types (e.g. optional references) are left unconnected
        for g, c in ((graph_old, cls), (graph_new, MAP[cls])):
            g[f"n{i}"] = {"class_type": c, "inputs": dict(inputs)}
            outs = info[cls]["output"]
            for o, ot in enumerate(outs):
                if ot == "IMAGE":
                    g[f"s{i}_{o}"] = {"class_type": "SaveImage", "_meta": {"title": f"{i}_{o}"},
                                      "inputs": {"images": [f"n{i}", o], "filename_prefix": f"ab{i}_{o}"}}
                elif ot == "MASK":
                    g[f"m{i}_{o}"] = {"class_type": "MaskToImage", "inputs": {"mask": [f"n{i}", o]}}
                    g[f"s{i}_{o}"] = {"class_type": "SaveImage", "_meta": {"title": f"{i}_{o}"},
                                      "inputs": {"images": [f"m{i}_{o}", 0], "filename_prefix": f"ab{i}_{o}"}}
        print(f"  case {i}: {label} {cls} {json.dumps({k: v for k, v in inputs.items() if not isinstance(v, list)})[:160]}")
    return graph_old, graph_new, len(cases)


def ltx_graph(path):
    g = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    inject = {("Input_Video", "video"): "ab_clip.mp4", ("Input_Seed", "int"): SEED,
              ("Input_Duration", "int"): 2}
    for (title, field), v in inject.items():
        hits = [n for n in g.values() if n.get("_meta", {}).get("title") == title]
        assert len(hits) == 1, (title, len(hits))
        hits[0]["inputs"][field] = v
    return g


only = sys.argv[3].split(",") if len(sys.argv) > 3 else ["mini", "ltx"]
if "mini" in only:
    old, new, n = mini_graphs()
    a = run(old, "mini_kj")
    b = run(new, "mini_mpi")
    compare(f"mini ({n} cases)", a, b)
    (HERE / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
if "ltx" in only:
    a = run(ltx_graph(BEFORE / "flow_ltx_extend.json"), "ltx_kj")
    b = run(ltx_graph(WF / "flow_ltx_extend.json"), "ltx_mpi")
    compare("ltx_extend", a, b)
    (HERE / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
print("\n".join(report))
