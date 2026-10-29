"""MPI-1350: does auto window_frames hold on a 12 GB card?

H3 2K refine (shipped flow_h3_upscale.json: 576x1024 -> 1152x2048, area 2.36 M px, the
ladder's 90-frame bucket) on the local 16 GB bench, with a ballast process pinning
(total - 12 GiB) of VRAM so the engine both SEES and CAN USE a 12 GB card.

Jobs, in order, one engine, models stay loaded between them:
  auto  124 frames, Window Frames "0"       -> the ceiling auto picks + does it survive
  p90    90 frames, single pass ("100000")  -> the 16 GB ladder's number
  p73 / p107  (73 if p90 failed, else 107)  -> bracket the edge on the 17k+5 grid

usage: python gpu_lease.py run --timeout 14400 -- python capped_bench.py
Inputs: G:/ComfyUi/ComfyUI/input/mpi1350/src_<n>.mp4 (cut from mpi1336/src_w0.mp4).
"""
import json, os, subprocess, sys, threading, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
GRAPH = "C:/AI/Mpi/Cubric-Vision/comfy_workflows/flow_h3_upscale.json"
BENCH = "G:/ComfyUi"
PY = BENCH + "/python_embeded/python.exe"
PORT = 8191
URL = f"http://127.0.0.1:{PORT}"
CARD_MIB = 12 * 1024
PROMPT = ("A man with short dark hair talks to the camera in an office, soft overhead light, "
          "blurred desks and monitors behind him.")

BALLAST = r"""
import sys, time, torch
total = torch.cuda.get_device_properties(0).total_memory
mib = total // 2**20 - int(sys.argv[1])
t = torch.ones(mib * 2**20 // 4, dtype=torch.float32, device="cuda")
torch.cuda.synchronize()
print(f"ballast {mib} MiB of {total // 2**20}", flush=True)
while True:  # touch it so WDDM never demotes it to system memory
    t.mul_(1.0); torch.cuda.synchronize(); time.sleep(0.5)
"""


def get(path, data=None):
    req = urllib.request.Request(URL + path, None if data is None else json.dumps(data).encode(),
                                 {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))


def used_mib():
    return int(subprocess.check_output(["nvidia-smi", "--query-gpu=memory.used",
                                        "--format=csv,noheader,nounits"]).split()[0])


def shared_bytes():
    out = subprocess.check_output(["typeperf", r"\GPU Adapter Memory(*)\Shared Usage", "-sc", "1"],
                                  text=True, stderr=subprocess.DEVNULL)
    row = [l for l in out.splitlines() if l.startswith('"') and "Shared" not in l][0]
    return max(float(x.strip('"')) for x in row.split(",")[1:] if x.strip('"'))


def free_other_engines():
    for port in (8189, 8190):  # bench ports only, never :3000 / :48188 (the user's app)
        try:
            urllib.request.urlopen(urllib.request.Request(
                f"http://127.0.0.1:{port}/free", b'{"unload_models":true,"free_memory":true}',
                {"Content-Type": "application/json"}), timeout=5)
            print(f"asked :{port} to free its VRAM")
        except Exception:
            pass


def run(tag, clip, expr):
    g = json.load(open(GRAPH, encoding="utf-8"))
    g["1"]["inputs"]["string"] = f"mpi1350/{clip}"
    g["23"]["inputs"]["string"] = PROMPT
    g["36"]["inputs"]["math_expression"] = expr
    g["40"]["inputs"]["filename_prefix"] = f"mpi1350/{tag}"
    peak = {"used": 0, "shared": 0.0}
    done = threading.Event()

    def watch():
        while not done.is_set():
            try:
                peak["used"] = max(peak["used"], used_mib())
                peak["shared"] = max(peak["shared"], shared_bytes())
            except Exception:
                pass
            time.sleep(3)
    threading.Thread(target=watch, daemon=True).start()
    t0 = time.time()
    pid = get("/prompt", {"prompt": g})["prompt_id"]
    while True:
        h = get(f"/history/{pid}")
        if pid in h and (h[pid]["status"].get("completed") or h[pid]["status"].get("status_str") == "error"):
            break
        time.sleep(5)
    done.set()
    st = h[pid]["status"]
    err = [m[1].get("exception_message", "")[:400] for m in st.get("messages", []) if m[0] == "execution_error"]
    r = {"tag": tag, "clip": clip, "window_expr": expr, "ok": not err, "error": err[0] if err else "",
         "seconds": round(time.time() - t0), "peak_used_mib": peak["used"],
         "peak_shared_gib": round(peak["shared"] / 2**30, 2)}
    print(json.dumps(r), flush=True)
    return r


def main():
    free_other_engines()
    time.sleep(5)
    base = used_mib()
    print(f"card in use before ballast: {base} MiB")
    if base > 3000:
        sys.exit(f"ABORT: {base} MiB already held by someone else; the 12 GB card would be smaller")
    shared0 = shared_bytes()
    ballast = subprocess.Popen([PY, "-c", BALLAST, str(CARD_MIB)], stdout=subprocess.PIPE, text=True)
    print(ballast.stdout.readline().strip())
    log = open(os.path.join(HERE, f"engine_{PORT}.log"), "w", encoding="utf-8", errors="replace")
    engine = subprocess.Popen([PY, "-s", "ComfyUI/main.py", "--windows-standalone-build", "--port", str(PORT)],
                              cwd=BENCH, stdout=log, stderr=subprocess.STDOUT)
    results = []
    try:
        for _ in range(120):
            try:
                stats = get("/system_stats")["devices"][0]
                break
            except Exception:
                time.sleep(5)
        else:
            sys.exit("ABORT: engine never answered")
        print("engine sees:", json.dumps({k: stats[k] for k in ("vram_total", "vram_free")}))
        results.append({"before_ballast_used_mib": base, "shared_baseline_gib": round(shared0 / 2**30, 2),
                        "engine_vram_free_gib_at_start": round(stats["vram_free"] / 2**30, 2)})
        results.append(run("auto_124", "src_124.mp4", "0"))
        p90 = run("p90", "src_90.mp4", "100000")
        results.append(p90)
        results.append(run("p107", "src_107.mp4", "100000") if p90["ok"] else run("p73", "src_73.mp4", "100000"))
    finally:
        engine.terminate(); ballast.terminate()
        engine.wait(60); ballast.wait(60)
        log.close()
        lines = [l.strip() for l in open(os.path.join(HERE, f"engine_{PORT}.log"), encoding="utf-8", errors="replace")
                 if "[MpiWindowedSampler]" in l and "] window " not in l]
        results.append({"sampler_lines": lines})
        json.dump(results, open(os.path.join(HERE, "capped_results.json"), "w"), indent=1)
        print("\n".join(lines))


if __name__ == "__main__":
    main()
