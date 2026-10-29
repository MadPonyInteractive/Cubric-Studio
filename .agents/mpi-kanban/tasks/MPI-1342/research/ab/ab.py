"""MPI-1342 fixed-seed A/B: pack graph (pre-swap commit) vs Mpi graph (working tree),
same engine with BOTH the old packs and MpiNodes loaded. Every output file is compared by sha256,
then by decoded samples when the bytes differ (video frames via ffmpeg, audio via soundfile).
  python ab.py <before_dir> <input_dir>
before_dir holds the pre-swap video_interpolate.json, flow_stems.json, flow_pano360.json;
input_dir holds ab_clip.mp4, ab_track.wav, ab_pic.png.
"""
import hashlib, json, pathlib, subprocess, sys, time, urllib.parse, urllib.request, uuid

import numpy as np
import soundfile

URL = "http://127.0.0.1:48199"
HERE = pathlib.Path(__file__).resolve().parent
WF = pathlib.Path(r"C:/AI/Mpi/Cubric-Vision/comfy_workflows")
BEFORE = pathlib.Path(sys.argv[1])
SEED = 424242


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=None if body is None else json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def graph(path, inject):
    g = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    for (title, field), v in inject.items():
        hits = [n for n in g.values() if n.get("_meta", {}).get("title") == title]
        assert len(hits) == 1, (title, len(hits))
        hits[0]["inputs"][field] = v
    return g


def run(g, label):
    t0 = time.time()
    try:
        pid = json.loads(call("/prompt", {"prompt": g, "client_id": str(uuid.uuid4())}))["prompt_id"]
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
    files = {}
    for nid, out in sorted(h["outputs"].items()):
        title = g[nid].get("_meta", {}).get("title", nid)
        for key, items in out.items():
            if not isinstance(items, list):
                continue
            for i, f in enumerate(x for x in items if isinstance(x, dict) and "filename" in x):
                q = f"/view?filename={urllib.parse.quote(f['filename'])}&subfolder={urllib.parse.quote(f.get('subfolder', ''))}&type={f.get('type', 'output')}"
                ext = pathlib.Path(f["filename"]).suffix
                dst = HERE / f"{label}__{title}_{key}{i}{ext}"
                dst.write_bytes(call(q))
                files[f"{title}_{key}{i}{ext}"] = dst
    print(f"{label}: {len(files)} files in {time.time() - t0:.0f}s", flush=True)
    return files


def decode(p):
    if p.suffix in (".flac", ".wav"):
        data, _ = soundfile.read(str(p), dtype="float32")
        return data
    if p.suffix in (".mp4", ".webm", ".mov"):
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(p), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                             capture_output=True, check=True).stdout
        return np.frombuffer(raw, np.uint8).astype(np.int16)
    from PIL import Image
    return np.asarray(Image.open(p).convert("RGB")).astype(np.int16)


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


jobs = [
    ("interp", "video_interpolate.json", {("Input_Video", "video"): "ab_clip.mp4", ("Input_Interp_Multiplier", "float"): 2}),
    ("stems", "flow_stems.json", {("Input_Audio", "audio"): "ab_track.wav"}),
    ("pano", "flow_pano360.json", {("Input_Image", "image"): "ab_pic.png", ("Input_Seed", "int"): SEED,
                                   ("Input_Positive", "string"): "a sunlit city park with trees, paths and a fountain"}),
]
only = sys.argv[3].split(",") if len(sys.argv) > 3 else None
for name, wf, inj in jobs:
    if only and name not in only:
        continue
    a = run(graph(BEFORE / wf, inj), f"{name}_pack")
    b = run(graph(WF / wf, inj), f"{name}_mpi")
    compare(name, a, b)
    (HERE / "report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")

print("\n".join(report))
