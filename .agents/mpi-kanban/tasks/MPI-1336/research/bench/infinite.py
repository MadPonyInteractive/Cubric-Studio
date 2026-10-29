"""MPI-1336 bench 2: Infinite Video case. Singularity v2 ref2va (shipped minimax_h3_r2va_singularity.json),
a static talking shot from one portrait, 124-frame windows chained on the LATENT path (arm A):
window n>0 = MpiH3MaskedPrefix(context = window n-1's sampled latent, 39 frames).

usage: python infinite.py <window> [<window> ...]   (runs in order, stops at the first failure)
Turbo off, Fast Motion on at 768x1344 = mode 0, one pass, no refine (same as bench 1).
"""
import json, shutil, subprocess, sys, threading, time, urllib.request

URL = "http://127.0.0.1:8189"
GRAPH = "C:/AI/Mpi/Cubric-Vision/comfy_workflows/minimax_h3_r2va_singularity.json"
IN = "G:/ComfyUi/ComfyUI/input/mpi1336"
SEED = 1150256869
SCENE = ("The man from <Picture 1> sits still in a plain grey studio, medium close-up, facing the camera. "
         "The camera is locked off on a tripod and never moves; the lighting stays soft and even. ")
LINES = [
    'He looks into the camera and says calmly, "I have been sheriff of this town for twenty-two years."',
    'He keeps looking into the camera and says, "In all that time, nobody ever robbed the bank twice."',
    'He leans back slightly, still facing the camera, and says, "Until last Tuesday, that is."',
    'He narrows his eyes at the camera and says, "And I intend to find out who did it."',
    'He rubs his chin, still facing the camera, and says, "Whoever it was knew this town well."',
    'He looks straight into the camera and says quietly, "So if you know something, now is the time."',
]


def run(w):
    tag = f"inf_A_w{w}"
    g = json.load(open(GRAPH, encoding="utf-8"))
    g["195"]["inputs"]["int"] = SEED
    g["212"]["inputs"]["int"] = 5            # -> 124 frames
    g["232"]["inputs"]["string"] = SCENE + LINES[w % len(LINES)]
    g["321"]["inputs"]["string"] = "mpi1336/sheriff.png"
    g["444"]["inputs"]["boolean"] = False    # turbo off (shipped default)
    g["880"]["inputs"]["boolean"] = True     # Fast Motion on at the base area = one pass
    g["623"]["inputs"]["int"] = 768
    g["622"]["inputs"]["int"] = 1344
    g["610"]["inputs"]["filename_prefix"] = f"mpi1336/{tag}"
    g["574"]["inputs"]["filename_prefix"] = f"mpi1336/{tag}_preview"

    g["910"] = {"class_type": "MpiSaveLatent",
                "inputs": {"samples": ["565", 0], "filename": f"mpi1336_{tag}", "boolean": True}}
    if w > 0:
        g["911"] = {"class_type": "MpiLoadLatent", "inputs": {"filename": f"mpi1336_inf_A_w{w-1}"}}
        g["902"] = {"class_type": "MpiH3MaskedPrefix",
                    "inputs": {"latent": ["879", 1], "context_latent": ["911", 0], "context_frames": 39}}
        g["565"]["inputs"]["latent_image"] = ["902", 0]

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
        pid = json.load(urllib.request.urlopen(req))["prompt_id"]
    except urllib.error.HTTPError as e:
        print(e.read().decode()[:3000]); return 1
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
    for f in files:
        if f["filename"].endswith(".mp4") and "_preview" not in f["filename"]:
            shutil.copy(f"G:/ComfyUi/ComfyUI/output/{f.get('subfolder', '')}/{f['filename']}", f"{IN}/{tag}.mp4")
            print("copied ->", f"{IN}/{tag}.mp4", flush=True)
    return 0


for arg in sys.argv[1:]:
    if run(int(arg)):
        sys.exit(1)
