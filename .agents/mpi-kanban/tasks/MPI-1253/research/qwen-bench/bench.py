"""MPI-1253 bench: the app's describe graph (Qwen3-VL-4B, ComfyUI) on the Vogue cover, three
variants, each answer scored against Fabio's 9 boxes. Starts its OWN engine on :48299 (never
the user's :8188 / :48188) with every writable folder in this scratchpad, stops it at the end.
usage: <engine python> bench.py [variant ...]"""
import json, os, subprocess, sys, time, urllib.request

S = os.path.dirname(os.path.abspath(__file__))
REPO = r"C:\AI\Mpi\Cubric-Vision"
ENGINE = REPO + r"\engine\ComfyUI_windows_portable"
PORT = 48299
URL = f"http://127.0.0.1:{PORT}"
Q = json.load(open(os.path.join(S, "questions.json"), encoding="utf-8"))

ON = {"sampling_mode": "on", "sampling_mode.temperature": 0.2, "sampling_mode.top_k": 64, "sampling_mode.top_p": 0.95,
      "sampling_mode.min_p": 0.05, "sampling_mode.repetition_penalty": 1.05, "sampling_mode.seed": 0,
      "sampling_mode.presence_penalty": 0}
OFF = {"sampling_mode": "off"}
NAMED = Q["academia"].replace('[{"label": "...", ', '[{"name": "...", "label": "...", ').replace(
    "- caption:", "- name: 1 to 3 words naming the element.\n- caption:")
# the app's dotted injection: sampling_mode -> off, the `on` keys stay in the graph
INJ = dict(ON, sampling_mode="off", **{"sampling_mode.repetition_penalty": 1})
VARIANTS = {
    "D_named_injected": (NAMED, INJ, 2048),
    "A_product": (Q["ours"], ON, 1024),
    "B_academia": (Q["academia"], OFF, 2048),
    "C_ours_greedy": (Q["ours"], OFF, 2048),
}

# Fabio's boxes on this cover (FLUX3 Flow Bench t2i draft), as x, y, w, h fractions
TRUTH = {
    "central_subject": (0.276, 0.177, 0.562, 0.726), "main_title": (0.045, 0.041, 0.910, 0.146),
    "fashion_headline": (0.048, 0.210, 0.264, 0.189), "beauty_headline": (0.039, 0.472, 0.231, 0.278),
    "lifestyle_headline": (0.743, 0.674, 0.239, 0.296), "self_love_script": (0.351, 0.724, 0.177, 0.133),
    "travel_box": (0.823, 0.380, 0.136, 0.247), "beauty_portrait": (0.160, 0.629, 0.162, 0.235),
    "footer_info": (0.045, 0.904, 0.910, 0.061),
}


def graph(question, sampling, max_length):
    g = json.load(open(REPO + r"\comfy_workflows\image_descriptor.json", encoding="utf-8"))
    g["43"] = {"class_type": "LoadImage", "inputs": {"image": "cover.jpg"}}
    g["38"]["inputs"]["value"] = ("<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>"
                                  f"{question}<|im_end|>\n<|im_start|>assistant\n")
    ins = g["36"]["inputs"]
    for k in [k for k in ins if k.startswith("sampling_mode")]:
        del ins[k]
    ins.update(sampling, max_length=max_length)
    g["37"]["inputs"]["source"] = ["36", 0]
    del g["48"]
    return g


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))


def edges(it):
    o = it.get("box")
    if isinstance(o, dict):
        return [o.get("left"), o.get("top"), o.get("right"), o.get("bottom")]
    if isinstance(it.get("box_2d"), list):
        t, l, b, r = it["box_2d"]
        return [l, t, r, b]
    return it.get("bbox_2d") or it.get("bbox")


def parse(text):
    s = text[text.find("{"):]
    for end in range(len(s), 0, -1):
        if s[end - 1] != "}":
            continue
        try:
            return json.loads(s[:end])
        except ValueError:
            pass
    return None


def iou(a, b):
    ax, ay, aw, ah = a; bx, by, bw, bh = b
    ix = max(0, min(ax + aw, bx + bw) - max(ax, bx)); iy = max(0, min(ay + ah, by + bh) - max(ay, by))
    inter = ix * iy
    return inter / (aw * ah + bw * bh - inter) if inter else 0.0


def score(name, text, secs):
    data = parse(text)
    boxes = []
    for it in (data or {}).get("items") or []:
        e = edges(it)
        if not (isinstance(e, list) and len(e) == 4 and all(isinstance(v, (int, float)) for v in e)):
            continue
        x1, y1, x2, y2 = (min(1000, max(0, v)) / 1000 for v in e)
        if x2 - x1 > 0.005 and y2 - y1 > 0.005:
            boxes.append(((x1, y1, x2 - x1, y2 - y1), it))
    best = {t: max([iou(tb, b) for b, _ in boxes] or [0]) for t, tb in TRUTH.items()}
    mean = sum(best.values()) / len(best)
    lines = [f"== {name}: {secs:.1f}s, JSON {'ok' if data else 'NONE'}, {len(boxes)} boxes, mean best-IoU {mean:.2f}, "
             f"hits(IoU>=0.5) {sum(v >= 0.5 for v in best.values())}/9"]
    lines += [f"   {t:20s} {v:.2f}" for t, v in best.items()]
    lines += [f"   got {[round(v, 3) for v in b]} {it.get('label', '')} {it.get('name', '')} | "
              f"{(it.get('text') or it.get('desc') or it.get('caption') or '')[:70]!r}" for b, it in boxes]
    return "\n".join(lines), boxes


def overlay(name, boxes):
    from PIL import Image, ImageDraw
    im = Image.open(os.path.join(S, "in", "cover.jpg")).convert("RGB")
    W, H = im.size
    d = ImageDraw.Draw(im)
    for (x, y, w, h) in TRUTH.values():
        d.rectangle([x * W, y * H, (x + w) * W, (y + h) * H], outline=(0, 255, 0), width=2)
    for (x, y, w, h), it in boxes:
        d.rectangle([x * W, y * H, (x + w) * W, (y + h) * H], outline=(255, 0, 255), width=3)
    im.save(os.path.join(S, f"{name}.png"))


def main():
    names = sys.argv[1:] or list(VARIANTS)
    log = open(os.path.join(S, "server.log"), "w", encoding="utf-8")
    for d in ("out", "tmp", "user"):
        os.makedirs(os.path.join(S, d), exist_ok=True)
    srv = subprocess.Popen([ENGINE + r"\python_embeded\python.exe", ENGINE + r"\ComfyUI\main.py",
                            "--listen", "127.0.0.1", "--port", str(PORT), "--lowvram",
                            "--extra-model-paths-config", ENGINE + r"\ComfyUI\extra_model_paths.yaml",
                            "--input-directory", os.path.join(S, "in"), "--output-directory", os.path.join(S, "out"),
                            "--temp-directory", os.path.join(S, "tmp"), "--user-directory", os.path.join(S, "user")],
                           stdout=log, stderr=subprocess.STDOUT, cwd=ENGINE + r"\ComfyUI",
                           creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        for _ in range(240):
            try:
                call("/system_stats"); break
            except Exception:
                time.sleep(1)
        else:
            raise SystemExit("engine never came up, see server.log")
        report = []
        for name in names:
            q, sampling, ml = VARIANTS[name]
            t0 = time.time()
            pid = call("/prompt", {"prompt": graph(q, sampling, ml)})["prompt_id"]
            while True:
                h = call(f"/history/{pid}").get(pid)
                if h and h.get("status", {}).get("completed") is not None:
                    break
                time.sleep(1)
            if h["status"].get("status_str") != "success":
                report.append(f"== {name}: FAILED {json.dumps(h['status'])[:600]}")
                continue
            text = h["outputs"]["37"]["text"][0]
            open(os.path.join(S, f"{name}.txt"), "w", encoding="utf-8").write(text)
            r, boxes = score(name, text, time.time() - t0)
            overlay(name, boxes)
            report.append(r)
            print(r, flush=True)
        open(os.path.join(S, "report.txt"), "w", encoding="utf-8").write("\n".join(report))
    finally:
        srv.terminate()
        srv.wait(30)


if __name__ == "__main__":
    main()
