"""MPI-1033 bench: H3 ref2va, one sounded input VIDEO as the picture reference, its own soundtrack
pinned with MiniMaxH3AddGuide (anchor) vs today's graph (soundtrack only as a reference).

usage: python bench.py anchor|control|keepvideo|speech|portrait
"""
import json, sys, time, urllib.request, copy

MODE = sys.argv[1]
SRC = "C:/AI/Mpi/Cubric-Vision/comfy_workflows/minimax_h3_r2va.json"
HOST = "http://127.0.0.1:8188"

w = copy.deepcopy(json.load(open(SRC, encoding="utf-8")))
w["212"]["inputs"]["int"] = 5
w["232"]["inputs"]["string"] = ("The cowboy from <Video 1> riding past the covered wagon, same scene, same motion and "
                                "the same sound, but the horse is jet black and the wagon cover is bright red.")
w["331"]["inputs"]["video"] = "mpi568_ai_cowboys_hi.mp4"
w["444"]["inputs"]["boolean"] = True  # turbo: 10-step stage 1
w["574"]["inputs"]["filename_prefix"] = f"mpi1033/{MODE}_preview"
w["610"]["inputs"]["filename_prefix"] = f"mpi1033/{MODE}"

if MODE == "speech":
    # control graph, a talking clip (3.04 s, 1920x1088): does speech survive the restyle like the hoofbeats did?
    w["212"]["inputs"]["int"] = 3
    w["232"]["inputs"]["string"] = ("The woman from <Video 1> on the city rooftop at night, saying the same words in the "
                                    "same voice, same motion and framing, but her dress is emerald green.")
    w["331"]["inputs"]["video"] = "lipdub_input.mp4"

if MODE == "portrait":
    # talking portrait: a still (<Picture 1>) + a voice line (<Audio 1>, "You better stop right there", 3.04 s).
    # Does the line come back as recorded, and do the lips follow it?
    w["212"]["inputs"]["int"] = 3
    w["331"]["inputs"]["video"] = "None"
    w["321"]["inputs"]["image"] = "mpi1033_sheriff_portrait.png"
    w["333"]["inputs"]["audio"] = "Boss_3s.mp3"
    w["232"]["inputs"]["string"] = (
        "Western film look: warm late-afternoon light, dusty tones, shallow depth of field, a close-up portrait, "
        "mood tense.\n"
        "Use <Picture 1> as the man's face, hair, moustache and coat, not its framing. <Audio 1> is his voice and "
        "his line: he speaks it exactly as recorded.\n"
        "[Shot 1] Close-up of the man from <Picture 1> in a dusty frontier street, looking straight into the lens. "
        "His smile drops, his eyes narrow, and he says in a low gravelly warning, as in <Audio 1>: "
        "\"You better stop right there.\" Then he holds the stare, jaw set, for the rest of the shot.\n"
        "The camera is static at eye level.\n"
        "overall_soundscape: A faint wind over the empty street, his voice close and dry.\n"
        "non_diegetic_music: N/A\n"
        "No text, subtitles, logos or watermarks, no cartoon or CG rendering.")

if MODE == "anchor":
    # the same soundtrack the reference already gets (331 audio), pinned at frame 0 in both stages
    for nid, refs in (("901", "330"), ("902", "688")):
        w[nid] = {"class_type": "MiniMaxH3AddGuide", "_meta": {"title": f"Anchor_{refs}"},
                  "inputs": {"positive": [refs, 0], "latent": [refs, 1], "audio_vae": ["527", 0],
                             "audio": ["331", 1], "frame_idx": 0}}
    w["873"]["inputs"]["any_1"] = ["901", 0]
    w["873"]["inputs"]["any_3"] = ["902", 0]

if MODE == "keepvideo":
    # vice versa: the source FRAMES pinned at frame 0, its audio stays only a reference, the sound is asked to change
    w["232"]["inputs"]["string"] = ("The cowboy from <Video 1> riding past the covered wagon, exactly the same picture. "
                                    "The sound changes: a lone harmonica plays a slow western tune over the hoofbeats.")
    for nid, refs in (("901", "330"), ("902", "688")):
        w[nid] = {"class_type": "MiniMaxH3AddGuide", "_meta": {"title": f"AnchorFrames_{refs}"},
                  "inputs": {"positive": [refs, 0], "latent": [refs, 1], "vae": ["524", 0],
                             "image": ["331", 0], "frame_idx": 0}}
    w["873"]["inputs"]["any_1"] = ["901", 0]
    w["873"]["inputs"]["any_3"] = ["902", 0]

req = urllib.request.Request(HOST + "/prompt", data=json.dumps({"prompt": w}).encode(),
                             headers={"Content-Type": "application/json"})
try:
    pid = json.load(urllib.request.urlopen(req))["prompt_id"]
except urllib.error.HTTPError as e:
    print("SUBMIT FAILED", e.read().decode()[:3000])
    sys.exit(2)
print("submitted", MODE, pid, flush=True)
t0 = time.time()
while True:
    time.sleep(10)
    h = json.load(urllib.request.urlopen(f"{HOST}/history/{pid}"))
    if pid in h:
        st = h[pid].get("status", {})
        print("status", st.get("status_str"), "after", int(time.time() - t0), "s", flush=True)
        if st.get("status_str") != "success":
            for m in st.get("messages", []):
                if m[0] in ("execution_error", "execution_interrupted"):
                    print(m[0], json.dumps(m[1])[:3000])
            sys.exit(3)
        for nid, out in h[pid]["outputs"].items():
            print("output", nid, json.dumps(out)[:600])
        break
    if time.time() - t0 > 2400:
        print("TIMEOUT")
        sys.exit(4)
