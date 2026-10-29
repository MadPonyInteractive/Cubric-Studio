"""Run the MPI-1348 graphs on the local bench one at a time, under the caller's gpu_lease.

  python run.py <clip dir> <graph.json> [<graph.json> ...]

Uses the G:/ComfyUi bench already serving on 8189 or 8188 (one process, so RAM is not doubled);
starts its own on 8188 when neither answers, and stops that one at the end. Appends one row per
graph to results.md: name, ok/FAIL, render seconds, peak card VRAM MiB, clip MB.
"""
import json
import os
import subprocess
import sys
import threading
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, "results.md")


def get(url, timeout=20):
    return json.load(urllib.request.urlopen(url, timeout=timeout))


def alive(base):
    try:
        get(base + "/system_stats", 5)
        return True
    except Exception:
        return False


def bench():
    for port in (8189, 8188):
        if alive("http://127.0.0.1:%d" % port):
            return "http://127.0.0.1:%d" % port, None
    log = open(os.path.join(HERE, "comfy8188.log"), "w")
    proc = subprocess.Popen([r"G:\ComfyUi\python_embeded\python.exe", "-s", "ComfyUI/main.py",
                             "--windows-standalone-build", "--port", "8188"], cwd=r"G:\ComfyUi",
                            stdout=log, stderr=subprocess.STDOUT)
    base = "http://127.0.0.1:8188"
    for _ in range(300):
        if alive(base):
            return base, proc
        time.sleep(2)
    raise SystemExit("bench did not come up on 8188, see comfy8188.log")


def run(base, clips, path):
    name = os.path.splitext(os.path.basename(path))[0]
    prompt = json.load(open(path, encoding="utf-8"))
    req = urllib.request.Request(base + "/prompt", json.dumps({"prompt": prompt}).encode(),
                                 {"Content-Type": "application/json"})
    pid = json.load(urllib.request.urlopen(req, timeout=60))["prompt_id"]
    print(name, "queued", pid, flush=True)
    peak = [0]
    stop = threading.Event()

    def sample():  # whole-card VRAM in use, the number a 16 GB user hits
        while not stop.wait(2):
            try:
                out = subprocess.run(["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
                                     capture_output=True, text=True, timeout=10).stdout
                peak[0] = max(peak[0], int(out.split()[0]))
            except Exception:
                pass

    threading.Thread(target=sample, daemon=True).start()
    while True:
        try:
            h = get(base + "/history/" + pid)
        except Exception as e:
            print("  poll error:", e, flush=True)
            h = {}
        if pid in h:  # a prompt enters /history only once it has finished, ok or not
            break
        time.sleep(3)
    stop.set()
    entry = h[pid]
    msgs = {m[0]: m[1] for m in entry["status"].get("messages", [])}
    ok = entry["status"].get("status_str") == "success"
    secs = (msgs["execution_success"]["timestamp"] - msgs["execution_start"]["timestamp"]) / 1000 if ok else 0
    size, saved = 0, ""
    out = entry.get("outputs", {}).get("208", {})  # Output_Video only, never the preview (node 208 in fl2va)
    for item in out.get("gifs", []) + out.get("videos", []) + out.get("images", []):
        if item["filename"].endswith(".mp4"):
            q = urllib.parse.urlencode({"filename": item["filename"], "subfolder": item.get("subfolder", ""),
                                        "type": item.get("type", "output")})
            data = urllib.request.urlopen(base + "/view?" + q, timeout=600).read()
            saved = os.path.join(clips, name + ".mp4")
            open(saved, "wb").write(data)
            size = len(data)
    err = "" if ok else json.dumps(msgs.get("execution_error", {}))[:300]
    row = "| %s | %s | %.0f | %d | %.1f | %s |" % (name, "ok" if ok and saved else "FAIL", secs, peak[0],
                                                  size / 2**20, err)
    print(row, flush=True)
    with open(RESULTS, "a", encoding="utf-8") as f:
        f.write(row + "\n")


def main():
    clips, graphs = sys.argv[1], sys.argv[2:]
    os.makedirs(clips, exist_ok=True)
    base, proc = bench()
    print("bench", base, "(started by me)" if proc else "(already running)", flush=True)
    try:
        for g in graphs:
            run(base, clips, g)
    finally:
        if proc:
            proc.terminate()


if __name__ == "__main__":
    main()
