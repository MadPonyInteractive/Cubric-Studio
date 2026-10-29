"""MPI-1336 bench 3: Infinite Video by BRIDGING, same shot and settings as bench 2 (infinite.py).
Roots = independent windows from the reference, same seed + 124 frames + canvas. Root 0 IS bench 2's
inf_A_w0 (same seed, same line), so it is reused, not re-run. Bridges = 192-frame windows (8 s, the
shortest length on both the 17k+5 grid and the audio clock) holding root n's last 39 frames at the head
and root n+1's first 39 at the tail (MpiH3MaskedPrefix with tail_latent), sampling the 114 between.

usage: python bridge.py r1 r2 b0 b1   (runs in order, stops at the first failure)
"""
import json, shutil, subprocess, sys, threading, time, urllib.request

URL = "http://127.0.0.1:8189"
# Bench 2's exact graph (minimax_h3_r2va_singularity.json at d37408109): the shipped file moves under
# other cards, and a renamed LoRA there fails validation on every node.
GRAPH = "C:/AI/Mpi/Cubric-Vision/.agents/mpi-kanban/tasks/MPI-1336/research/bench/graph_bench2.json"
IN = "G:/ComfyUi/ComfyUI/input/mpi1336"
SEED = 1150256869
SCENE = ("The man from <Picture 1> sits still in a plain grey studio, medium close-up, facing the camera. "
         "The camera is locked off on a tripod and never moves; the lighting stays soft and even. ")
# Bench 2's six lines: roots take the even ones (root 0 = line 0), bridges the odd ones.
LINES = [
    'He looks into the camera and says calmly, "I have been sheriff of this town for twenty-two years."',
    'He keeps looking into the camera and says, "In all that time, nobody ever robbed the bank twice."',
    'He leans back slightly, still facing the camera, and says, "Until last Tuesday, that is."',
    'He narrows his eyes at the camera and says, "And I intend to find out who did it."',
    'He rubs his chin, still facing the camera, and says, "Whoever it was knew this town well."',
]
QUOTES = [l[l.index('"'):] for l in LINES]


def latent_name(tag):
    return "mpi1336_inf_A_w0" if tag == "r0" else f"mpi1336_br_{tag}"


def build(tag):
    # "b0s" = bridge 0 with the roots' full SCENE prompt instead of the short one (run 1's bridges
    # hard-cut to a close-up after the held head and back at the held tail).
    kind, n, scene = tag[0], int(tag[1:].rstrip("s")), tag.endswith("s")
    g = json.load(open(GRAPH, encoding="utf-8"))
    g["195"]["inputs"]["int"] = SEED
    g["321"]["inputs"]["string"] = "mpi1336/sheriff.png"
    g["444"]["inputs"]["boolean"] = False    # turbo off (shipped default)
    g["880"]["inputs"]["boolean"] = True     # Fast Motion on at the base area = one pass
    g["623"]["inputs"]["int"] = 768
    g["622"]["inputs"]["int"] = 1344
    g["610"]["inputs"]["filename_prefix"] = f"mpi1336/br_{tag}"
    g["574"]["inputs"]["filename_prefix"] = f"mpi1336/br_{tag}_preview"
    g["910"] = {"class_type": "MpiSaveLatent",
                "inputs": {"samples": ["565", 0], "filename": latent_name(tag), "boolean": True}}
    if kind == "r":
        g["212"]["inputs"]["int"] = 5            # -> 124 frames, same as every root
        g["232"]["inputs"]["string"] = SCENE + LINES[2 * n]
    else:
        g["212"]["inputs"]["int"] = 8            # -> 192 frames
        # OBVPM: a detailed bridge prompt makes H3 hard-cut at the start; keep it short.
        g["232"]["inputs"]["string"] = (SCENE + "One single continuous shot, no cuts. " + LINES[2 * n + 1] if scene
                                        else "The man from <Picture 1>, one single continuous shot, no cuts, "
                                        f"locked-off camera. He says, {QUOTES[2 * n + 1]}")
        g["911"] = {"class_type": "MpiLoadLatent", "inputs": {"filename": latent_name(f"r{n}")}}
        g["912"] = {"class_type": "MpiLoadLatent", "inputs": {"filename": latent_name(f"r{n + 1}")}}
        g["902"] = {"class_type": "MpiH3MaskedPrefix",
                    "inputs": {"latent": ["879", 1], "context_latent": ["911", 0], "context_frames": 39,
                               "tail_latent": ["912", 0], "tail_frames": 39}}
        g["565"]["inputs"]["latent_image"] = ["902", 0]
    return g


def run(tag):
    g = build(tag)
    peak = {"vram": 0}
    done = threading.Event()

    def watch():
        while not done.is_set():
            try:
                v = int(subprocess.check_output(["nvidia-smi", "--query-gpu=memory.used",
                                                 "--format=csv,noheader,nounits"]).split()[0])
                peak["vram"] = max(peak["vram"], v)
            except Exception:
                pass
            time.sleep(1)
    threading.Thread(target=watch, daemon=True).start()

    t0 = time.time()
    req = urllib.request.Request(URL + "/prompt", json.dumps({"prompt": g}).encode(),
                                 {"Content-Type": "application/json"})
    try:
        resp = json.load(urllib.request.urlopen(req))
    except urllib.error.HTTPError as e:
        print(e.read().decode()[:3000]); return 1
    if resp.get("node_errors"):
        # Partial validation failures still queue and "complete" in seconds with no output.
        print(tag, "node_errors:", json.dumps(resp["node_errors"])[:3000]); return 1
    pid = resp["prompt_id"]
    while True:
        h = json.load(urllib.request.urlopen(f"{URL}/history/{pid}"))
        if pid in h:
            st = h[pid]["status"]
            if st.get("completed") or st.get("status_str") == "error":
                break
        time.sleep(3)
    done.set()
    if st.get("status_str") == "error":
        print(json.dumps(st.get("messages", [])[-2:])[:3000]); return 1
    files = [f for o in h[pid]["outputs"].values() for k in ("gifs", "videos", "images") for f in o.get(k, [])]
    print(tag, f"{time.time() - t0:.0f}s", f"peak VRAM {peak['vram']} MiB", flush=True)
    for o in h[pid]["outputs"].values():
        for t in o.get("text", []) or []:
            if "context" in str(t):
                print("  prefix report:", t, flush=True)
    for f in files:
        if f["filename"].endswith(".mp4") and "_preview" not in f["filename"]:
            shutil.copy(f"G:/ComfyUi/ComfyUI/output/{f.get('subfolder', '')}/{f['filename']}", f"{IN}/br_{tag}.mp4")
            print("copied ->", f"{IN}/br_{tag}.mp4", flush=True)
            return 0
    print(tag, "finished with no video output"); return 1


if __name__ == "__main__":
    for arg in sys.argv[1:]:
        if run(arg):
            sys.exit(1)
