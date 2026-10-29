"""Build comfy_workflows/flow_h3_upscale.json (API format) from nodes already proven in
flow_h3_extend.json and minimax_h3_fl2va.json. MPI-578 (H3 arm of the Upscale Video Flow)."""
import copy, io, json

W = "C:/AI/Mpi/Cubric-Vision/comfy_workflows/"
ext = json.load(io.open(W + "flow_h3_extend.json", encoding="utf-8"))
fl2 = json.load(io.open(W + "minimax_h3_fl2va.json", encoding="utf-8"))

g = {}


def node(nid, cls, title, inputs):
    g[str(nid)] = {"inputs": inputs, "class_type": cls, "_meta": {"title": title}}


def take(src, sid, nid, title=None, **over):
    n = copy.deepcopy(src[str(sid)])
    n["inputs"].update(over)
    if title:
        n["_meta"] = {"title": title}
    g[str(nid)] = n


L = lambda i, o=0: [str(i), o]

# Source: 24 fps, trimmed to H3's 17k+5 frame grid, centre-cropped to /32.
take(ext, 331, 1)  # Input_Video (force_rate 24)
node(2, "MpiMath", "Legal Frame Count (17k+5)",
     {"math_expression": "floor((a - 5) / 17) * 17 + 5", "a": L(1, 3)})
node(3, "ImageFromBatch", "Trim To Legal Frame Count",
     {"image": L(1), "batch_index": 0, "length": L(2)})
node(4, "MpiCrop", "Fit Source To /32",
     {"image": L(3), "width": 0, "height": 0, "divisible_by": 32, "position": "center"})

# Soundtrack for the ENCODE only (H3 samples video + audio together); the saved
# video gets the untouched source audio straight from the loader.
take(ext, 905, 5, duration=L(1, 4))
take(ext, 906, 6, **{"true": L(1, 1), "false": L(5), "boolean": L(1, 7)})
node(41, "MpiMath", "Last Kept Frame (frames - 1)", {"math_expression": "a - 1", "a": L(2)})
take(ext, 950, 7, "Audio To Trimmed Length", audio=L(6), fps=L(1, 2), start=0, end=L(41))  # end is INCLUSIVE

# Loaders: the fl2va DiT, the same weights the `minimax-h3` model supplies.
take(ext, 388, 8)   # video VAE
take(ext, 387, 9)   # audio VAE
take(ext, 392, 10)  # UNET fl2va
take(ext, 390, 11)  # CLIP
prev = (L(10), L(11))
for k in range(6):
    nid = 12 + k
    take(ext, 980 + k, nid, model=prev[0], clip=prev[1])
    prev = (L(nid), L(nid, 1))
take(ext, 497, 18, model=L(17))                    # attention backend
take(ext, 463, 19)                                 # taeh3 preview VAE
take(ext, 464, 20, model=L(18), vae=L(19))         # live preview
take(ext, 956, 21, model=L(20))                    # turbo LoRA on the refine leg (MPI-688: +20-30% detail)
take(fl2, 518, 22, "Refine shift (audio 0.5)", model=L(21))

take(ext, 232, 23)  # Input_Positive
take(ext, 195, 24)  # Input_Seed

# Encode -> H3 latent upscaler (2x, target dimensions) -> refine.
take(ext, 971, 25, "Encode the source", vae=L(8), images=L(4), audio_vae=L(9), audio=L(7))
take(fl2, 420, 26, av_latent=L(25))
node(27, "MpiMath", "Target Width (2x)", {"math_expression": "a * 2", "a": L(4, 1)})
node(28, "MpiMath", "Target Height (2x)", {"math_expression": "a * 2", "a": L(4, 2)})
take(fl2, 419, 29, latent=L(26), **{"mode.width": L(27), "mode.height": L(28)})
take(fl2, 421, 30, video_latent=L(29), audio_latent=L(26, 1))
# Conditioning built at the UPSCALED size: no keyframes, so the MPI-688 keyframe trap
# (cond rows sized off the first stage) cannot arise.
take(fl2, 566, 31, "H3 conditioning (target size, no keyframes)",
     clip=L(17, 1), vae=L(8), prompt=L(23), width=L(27), height=L(28), length=L(2))
for k in ("first_frame", "last_frame"):
    g["31"]["inputs"].pop(k, None)
take(fl2, 536, 32, "Input_Sigmas")  # baked = the default; ltxSigmasInjector scales it
take(fl2, 537, 33)
take(fl2, 539, 34, noise_seed=L(24))
take(fl2, 538, 35, model=L(22), conditioning=L(31))
take(fl2, 535, 36, a=L(27), b=L(28))  # Window Frames (16 GB ladder)
take(fl2, 532, 37, noise=L(34), guider=L(35), sampler=L(33), sigmas=L(32),
     latent_image=L(30), window_frames=L(36))
take(fl2, 424, 38, samples=L(37), vae=L(8))
take(fl2, 541, 39, passthrough=L(38))
node(40, "MpiSaveVideo", "Output_Video",
     {"fps": 24, "filename_prefix": "MpiVideo", "use_audio": L(1, 7), "truncate_to_audio": False,
      "images": L(39), "audio": L(1, 1)})

# Every link must point at a node that exists.
for nid, n in g.items():
    for k, v in n["inputs"].items():
        if isinstance(v, list) and len(v) == 2 and isinstance(v[0], str):
            assert v[0] in g, (nid, k, v)

io.open(W + "flow_h3_upscale.json", "w", encoding="utf-8", newline="\n").write(
    json.dumps(g, indent=2, ensure_ascii=False) + "\n")
print(len(g), "nodes")
for nid, n in g.items():
    print(nid, n["class_type"], "|", n["_meta"]["title"])
