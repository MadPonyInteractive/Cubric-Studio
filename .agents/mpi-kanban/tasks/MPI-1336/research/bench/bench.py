"""MPI-1336 window bench: Video Edit graph, 124-frame windows chained with MpiH3MaskedPrefix.

usage: python bench.py <arm> <window> [quality]
  arm B = pixel path: previous window's OUTPUT video -> MpiH3EncodeAV -> prefix.
"""
import json, shutil, subprocess, sys, threading, time, urllib.request

URL = "http://127.0.0.1:8189"
GRAPH = "C:/AI/Mpi/Cubric-Vision/comfy_workflows/flow_video_edit.json"
IN = "G:/ComfyUi/ComfyUI/input/mpi1336"
OUT = "G:/ComfyUi/ComfyUI/output/mpi1336"
LOOK = ("A middle-aged woman with fair skin, dark eyes, and black glasses has blonde hair styled in a bob, "
        "with black curved horns and glowing orange cracks on her face. She wears a dark, textured black shirt "
        "that appears to be made of volcanic rock with glowing orange lava-like veins.")
KEPT = ("An office interior features blurred desks, computer monitors, and ceiling lights in a space with "
        "neutral-toned walls and surfaces. The room is illuminated by soft, overhead artificial lighting.")

arm, w = sys.argv[1], int(sys.argv[2])
quality = int(sys.argv[3]) if len(sys.argv) > 3 else 1032192
tag = f"{arm}_q{quality}_w{w}"

g = json.load(open(GRAPH, encoding="utf-8"))
g["10"]["inputs"]["string"] = f"mpi1336/src_w{w}.mp4"
g["11"]["inputs"]["string"] = "mpi1336/ref.png"
g["12"]["inputs"]["string"] = ""
g["13"]["inputs"]["int"] = 1
g["14"]["inputs"]["boolean"] = True
g["15"]["inputs"]["string"] = "the man"
g["16"]["inputs"]["string"] = ""
g["17"]["inputs"]["int"] = 1150256869
g["18"]["inputs"]["string"] = LOOK
g["19"]["inputs"]["string"] = KEPT
g["26"]["inputs"]["int"] = quality
g["130"]["inputs"]["filename_prefix"] = f"mpi1336/{tag}"

if w > 0 and arm == "B":
    g["900"] = {"class_type": "MpiLoadVideoUpload",
                "inputs": {"video": "None", "block_if_empty": True, "force_rate": 24,
                           "string": f"mpi1336/{arm}_q{quality}_w{w-1}.mp4"}}
    g["901"] = {"class_type": "MpiH3EncodeAV",
                "inputs": {"vae": ["102", 0], "audio_vae": ["103", 0], "images": ["900", 0], "audio": ["900", 1]}}
    g["902"] = {"class_type": "MpiH3MaskedPrefix",
                "inputs": {"latent": ["110", 1], "context_latent": ["901", 0], "context_frames": 39}}
    g["115"]["inputs"]["latent_image"] = ["902", 0]

# Every window checkpoints its sampled latent; arm A chains from it (no VAE round trip).
g["910"] = {"class_type": "MpiSaveLatent",
            "inputs": {"samples": ["115", 0], "filename": f"mpi1336_{tag}", "boolean": True}}
if w > 0 and arm == "A":
    g["911"] = {"class_type": "MpiLoadLatent", "inputs": {"filename": f"mpi1336_{arm}_q{quality}_w{w-1}"}}
    g["902"] = {"class_type": "MpiH3MaskedPrefix",
                "inputs": {"latent": ["110", 1], "context_latent": ["911", 0], "context_frames": 39}}
    g["115"]["inputs"]["latent_image"] = ["902", 0]

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
req = urllib.request.Request(URL + "/prompt", json.dumps({"prompt": g}).encode(), {"Content-Type": "application/json"})
try:
    pid = json.load(urllib.request.urlopen(req))["prompt_id"]
except urllib.error.HTTPError as e:
    print(e.read().decode()[:3000]); sys.exit(1)
while True:
    h = json.load(urllib.request.urlopen(f"{URL}/history/{pid}"))
    if pid in h:
        st = h[pid]["status"]
        if st.get("completed") or st.get("status_str") == "error":
            break
    time.sleep(3)
done.set()
dt = time.time() - t0
if st.get("status_str") == "error":
    print(json.dumps(st.get("messages", [])[-2:])[:3000]); sys.exit(1)
files = [f for o in h[pid]["outputs"].values() for k in ("gifs", "videos", "images") for f in o.get(k, [])]
print(tag, f"{dt:.0f}s", f"peak VRAM {peak['vram']} MiB", files)
for f in files:
    if f["filename"].endswith(".mp4"):
        src = f"G:/ComfyUi/ComfyUI/output/{f.get('subfolder','')}/{f['filename']}"
        shutil.copy(src, f"{IN}/{tag}.mp4")
        print("copied ->", f"{IN}/{tag}.mp4")
