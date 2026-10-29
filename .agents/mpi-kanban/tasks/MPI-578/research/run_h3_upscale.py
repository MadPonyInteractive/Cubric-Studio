"""MPI-578: run flow_h3_upscale.json once on the G:\\ComfyUi bench (own port 8190), the
way the app would (ltxSigmasInjector at the default, empty prompt, LoRA rack empty).
usage (under the GPU lease): python gpu_lease.py run --timeout 3600 -- python run_h3_upscale.py"""
import json, subprocess, sys, time, urllib.request

PORT = 8190
URL = f"http://127.0.0.1:{PORT}"
GRAPH = "C:/AI/Mpi/Cubric-Vision/comfy_workflows/flow_h3_upscale.json"
LOG = "C:/Users/Fabio/AppData/Local/Temp/claude/C--AI-Mpi-Cubric-Vision/7e34ac32-fb1d-430d-8ce1-d54bdcde75f3/scratchpad/bench_8190.log"
SRC = sys.argv[1] if len(sys.argv) > 1 else "mpi578/room_288x512.mp4"


def get(path):
    return json.loads(urllib.request.urlopen(URL + path, timeout=10).read())


srv = subprocess.Popen(["G:/ComfyUi/python_embeded/python.exe", "-s", "ComfyUI/main.py",
                        "--windows-standalone-build", "--port", str(PORT)], cwd="G:/ComfyUi",
                       stdout=open(LOG, "w"), stderr=subprocess.STDOUT)
try:
    for _ in range(120):
        try:
            get("/queue")
            break
        except Exception:
            time.sleep(5)
    else:
        sys.exit("bench never answered")
    g = json.load(open(GRAPH, encoding="utf-8"))
    g["1"]["inputs"]["string"] = SRC
    g["24"]["inputs"]["int"] = 578578
    t0 = time.time()
    req = urllib.request.Request(URL + "/prompt", data=json.dumps({"prompt": g}).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]
    except urllib.error.HTTPError as e:
        sys.exit("REJECTED: " + e.read().decode()[:3000])
    while True:
        time.sleep(5)
        h = get("/history/" + pid)
        if pid in h:
            st = h[pid]["status"]
            print("status", st.get("status_str"), "in", round(time.time() - t0), "s")
            for m in st.get("messages", []):
                if m[0] in ("execution_error",):
                    print(json.dumps(m[1])[:3000])
            for nid, out in h[pid]["outputs"].items():
                print(nid, json.dumps(out)[:400])
            break
    peak = subprocess.run(["nvidia-smi", "--query-gpu=memory.used,memory.total", "--format=csv"],
                          capture_output=True, text=True).stdout
    print(peak)
finally:
    srv.terminate()
