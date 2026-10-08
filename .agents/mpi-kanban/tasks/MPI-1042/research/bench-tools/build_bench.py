"""Build the MPI-1042 bench graph (LiteGraph) for G:/ComfyUi. Node shapes mirror donor nodes in
flow_head_swap.json (Klein 9B refs), flow_character_sheet_headless.json (SAM3 head removal) and
flow_character_sheet.json (prompt plumbing); input/output names checked against the live /object_info."""
import json, sys, uuid

OUT = sys.argv[1]

CORE = {"cnr_id": "comfy-core", "ver": "0.34.2"}
MPI = {"cnr_id": "ComfyUi-MpiNodes"}
RES = {"cnr_id": "RES4LYF"}

nodes, links, keys = [], [], {}


def N(key, typ, widgets, ins, outs, pos, size=(300, 100), title=None, props=CORE):
    nid = len(nodes) + 1
    keys[key] = nid
    node = {
        "id": nid, "type": typ, "pos": list(pos), "size": list(size), "flags": {}, "order": nid - 1,
        "mode": 0,
        # ins: (name, type) socket, or (name, type, True) for a widget that gets a link
        "inputs": [dict({"name": i[0], "type": i[1], "link": None}, **({"widget": {"name": i[0]}} if len(i) > 2 else {}))
                   for i in ins],
        "outputs": [{"name": o[0], "type": o[1], "links": [], "slot_index": s} for s, o in enumerate(outs)],
        "properties": dict(props, **{"Node name for S&R": typ}),
        "widgets_values": widgets,
    }
    if title:
        node["title"] = title
    nodes.append(node)


def L(src, out_name, dst, in_name):
    s, d = nodes[keys[src] - 1], nodes[keys[dst] - 1]
    os_ = next(i for i, o in enumerate(s["outputs"]) if o["name"] == out_name)
    ts = next(i for i, x in enumerate(d["inputs"]) if x["name"] == in_name)
    assert d["inputs"][ts]["link"] is None, (dst, in_name)
    lid = len(links) + 1
    links.append([lid, s["id"], os_, d["id"], ts, s["outputs"][os_]["type"]])
    s["outputs"][os_]["links"].append(lid)
    d["inputs"][ts]["link"] = lid


LOAD_OUTS = [("image", "IMAGE"), ("mask", "MASK"), ("width", "INT"), ("height", "INT"), ("loaded", "BOOLEAN")]
LOAD_INS = [("image", "COMBO"), ("channel", "COMBO"), ("block_if_empty", "BOOLEAN"), ("string", "STRING"), ("upload", "IMAGEUPLOAD")]

# ---------------------------------------------------------------- prompts
REF_WITH_BODY = (
    "Character reference sheet of the character from image 1, in exactly the same visual style and medium as image 1. "
    "The face, head and hair come only from image 1. The body, build, skin and clothing come from image 2, which shows "
    "that body with its head removed: give that body the head from image 1. [CHARACTER PROMPT]"
)
REF_NO_BODY = (
    "Character reference sheet of the character from image 1, in exactly the same visual style and medium as image 1. "
    "The face, head and hair come only from image 1. [CHARACTER PROMPT]"
)
LAYOUT = (
    "A single continuous image containing three views of the same character arranged side by side in one unbroken frame, "
    "the two full-body views on the left and the portrait on the right, the grey background flowing continuously behind "
    "all three, the same character in every view with identical face, hair and wardrobe. The right half of the image is "
    "filled by a head and shoulders portrait that keeps the head exactly as it is in image 1, with the same turn, tilt "
    "and expression, face sharp and clear, hair fully visible from the crown down. The left half holds two "
    "narrow full-body standing views of equal width, one seen from the front and one from directly behind, arms hanging "
    "loose and relaxed at the sides, hands open and resting against the thighs, feet planted, generous headroom. Plain "
    "smooth grey seamless studio background. Extremely even frontal illumination, soft open shadows, uniform brightness "
    "from edge to edge."
)
NOTE = (
    "MPI-1042 bench - Character Sheet from images (Klein 9B)\n\n"
    "Picture 1 = face, three-quarter turn (required).\n"
    "Picture 2 = body (optional). Set its picker to None to run WITHOUT a body: its `loaded` output flips both switches "
    "(prompt + conditioning), and the whole body branch is skipped (MpiIfElse is lazy).\n"
    "Input_Positive = the user's text; it replaces [CHARACTER PROMPT].\n\n"
    "Risks to bench (brief.md):\n"
    "1. placement ~2 in 3 - count hits over seeds, both modes\n"
    "2. one shot holds the 3-panel layout?\n"
    "3. back panel invented - judge hair + outfit from behind\n"
    "4. prompted haircut vs the face picture's hair\n"
    "5. close-up turns to the SAME side as Picture 1?\n"
    "6. body head-fill: flat colour (this graph) vs LanPaint"
)

# ---------------------------------------------------------------- Picture 1 (face)
X0, Y1, Y2, Y3, Y4 = 0, 0, 700, 1500, -700
N("note", "Note", [NOTE], [], [], (X0 - 520, Y4), (480, 520), props={})
N("img1", "MpiLoadImage", ["None", "alpha", True, "", "image"], LOAD_INS, LOAD_OUTS, (X0, Y1), (300, 450), "Input_Image", MPI)
N("scale1", "ImageScaleToTotalPixels", ["nearest-exact", 2, 16], [("image", "IMAGE")], [("IMAGE", "IMAGE")], (X0 + 360, Y1))
N("enc1", "VAEEncode", None, [("pixels", "IMAGE"), ("vae", "VAE")], [("LATENT", "LATENT")], (X0 + 720, Y1), (200, 50), "Encode ref 1")

# ---------------------------------------------------------------- Picture 2 (body, head removed)
N("img2", "MpiLoadImage", ["None", "alpha", False, "", "image"], LOAD_INS, LOAD_OUTS, (X0, Y2), (300, 450), "Input_Image_2", MPI)
N("sam", "CheckpointLoaderSimple", ["sam3.1_multiplex_fp16.safetensors"], [], [("MODEL", "MODEL"), ("CLIP", "CLIP"), ("VAE", "VAE")], (X0 + 360, Y2), (340, 100), "SAM3 Model")
N("vocab", "CLIPTextEncode", ["head, hair, hat"], [("clip", "CLIP")], [("CONDITIONING", "CONDITIONING")], (X0 + 360, Y2 + 160), (340, 120), "SAM3 vocabulary")
N("detect", "SAM3_Detect", [0.5, 2, False],
  [("model", "MODEL"), ("image", "IMAGE"), ("conditioning", "CONDITIONING"), ("bboxes", "BOUNDING_BOX"),
   ("positive_coords", "STRING"), ("negative_coords", "STRING")],
  [("masks", "MASK"), ("bboxes", "BOUNDING_BOX")], (X0 + 740, Y2), (330, 210), "head + hair + hat, unioned")
N("holes", "MpiMaskFillHoles", [0], [("mask", "MASK")], [("mask", "MASK")], (X0 + 1110, Y2), (270, 60), props=MPI)
N("grow", "GrowMask", [6, True], [("mask", "MASK")], [("MASK", "MASK")], (X0 + 1110, Y2 + 100), (270, 82))
N("corner", "Image Crop Location Exact", [0, 0, 32, 32, "original"], [("image", "IMAGE")],
  [("image", "IMAGE"), ("crop_data", "CROP_DATA")], (X0 + 740, Y2 + 260), (280, 175), "backdrop sample (top-left 32px)", RES)
N("plate", "ImageScale", ["nearest-exact", 512, 512, "disabled"],
  [("image", "IMAGE"), ("width", "INT", True), ("height", "INT", True)], [("IMAGE", "IMAGE")], (X0 + 1110, Y2 + 260), (270, 130), "flat fill plate")
N("fill", "ImageCompositeMasked", [0, 0, True], [("destination", "IMAGE"), ("source", "IMAGE"), ("mask", "MASK")],
  [("IMAGE", "IMAGE")], (X0 + 1420, Y2), (270, 146), "body with its head filled flat")
N("vram", "MpiClearVram", None, [("passthrough", "*")], [("passthrough", "*")], (X0 + 1420, Y2 + 200), (190, 30), "free SAM3 before Klein", MPI)
N("scale2", "ImageScaleToTotalPixels", ["nearest-exact", 1, 16], [("image", "IMAGE")], [("IMAGE", "IMAGE")], (X0 + 1720, Y2))
N("enc2", "VAEEncode", None, [("pixels", "IMAGE"), ("vae", "VAE")], [("LATENT", "LATENT")], (X0 + 2080, Y2), (200, 50), "Encode ref 2")
N("dbg_sw", "MpiIfElse", [True], [("true", "*"), ("false", "*"), ("boolean", "BOOLEAN", True)], [("output", "*")],
  (X0 + 1720, Y2 + 200), (230, 80), "debug: body only when loaded", MPI)
N("dbg", "PreviewImage", None, [("images", "IMAGE")], [], (X0 + 2080, Y2 + 120), (360, 420), "Debug: body sent to Klein")

# ---------------------------------------------------------------- prompt
N("ref_body", "PrimitiveStringMultiline", [REF_WITH_BODY], [], [("STRING", "STRING")], (X0, Y3), (420, 180), "Prompt_With_Body")
N("ref_nobody", "PrimitiveStringMultiline", [REF_NO_BODY], [], [("STRING", "STRING")], (X0, Y3 + 220), (420, 160), "Prompt_No_Body")
N("prompt_sw", "MpiIfElse", [True], [("true", "*"), ("false", "*"), ("boolean", "BOOLEAN", True)], [("output", "*")],
  (X0 + 460, Y3), (230, 80), "Prompt_Select (has body?)", MPI)
N("layout", "PrimitiveStringMultiline", [LAYOUT], [], [("STRING", "STRING")], (X0 + 460, Y3 + 140), (420, 300), "Sheet_Layout")
N("concat", "StringConcatenate", ["", "", " "], [("string_a", "STRING", True), ("string_b", "STRING", True)],
  [("STRING", "STRING")], (X0 + 920, Y3), (300, 120))
N("user", "PrimitiveStringMultiline", [""], [], [("STRING", "STRING")], (X0 + 920, Y3 + 160), (300, 140), "Input_Positive")
N("replace", "StringReplace", ["", "[CHARACTER PROMPT]", ""], [("string", "STRING", True), ("replace", "STRING", True)],
  [("STRING", "STRING")], (X0 + 1260, Y3), (340, 140), "Sheet_Prompt")
N("show_prompt", "PreviewAny", [], [("source", "*")], [("STRING", "STRING")], (X0 + 1640, Y3), (380, 400), "Output_prompt")

# ---------------------------------------------------------------- Klein 9B
N("unet", "UNETLoader", ["flux-2-klein-9b-int8-convrot.safetensors", "default"], [], [("MODEL", "MODEL")], (X0 + 1100, Y1 - 300), (340, 90))
N("clip", "CLIPLoader", ["qwen_3_8b_int8_convrot.safetensors", "flux2", "default"], [], [("CLIP", "CLIP")], (X0 + 1100, Y1 - 170), (340, 106))
N("vae", "VAELoader", ["flux2-vae.safetensors"], [], [("VAE", "VAE")], (X0 + 1100, Y1 - 20), (340, 60))
N("text", "CLIPTextEncode", [""], [("clip", "CLIP"), ("text", "STRING", True)], [("CONDITIONING", "CONDITIONING")], (X0 + 1100, Y1 + 100), (340, 90))
N("ref1", "ReferenceLatent", None, [("conditioning", "CONDITIONING"), ("latent", "LATENT")], [("CONDITIONING", "CONDITIONING")],
  (X0 + 1480, Y1), (220, 50), "Set Reference Latent 1")
N("ref2", "ReferenceLatent", None, [("conditioning", "CONDITIONING"), ("latent", "LATENT")], [("CONDITIONING", "CONDITIONING")],
  (X0 + 1480, Y1 + 120), (220, 50), "Set Reference Latent 2")
N("cond_sw", "MpiIfElse", [True], [("true", "*"), ("false", "*"), ("boolean", "BOOLEAN", True)], [("output", "*")],
  (X0 + 1740, Y1), (230, 80), "Conditioning_Select (has body?)", MPI)
N("zero", "ConditioningZeroOut", None, [("conditioning", "CONDITIONING")], [("CONDITIONING", "CONDITIONING")], (X0 + 1740, Y1 + 140), (210, 30))
N("guider", "CFGGuider", [1], [("model", "MODEL"), ("positive", "CONDITIONING"), ("negative", "CONDITIONING")], [("GUIDER", "GUIDER")],
  (X0 + 2010, Y1), (300, 100))
N("seed", "MpiInt", [976866873943], [], [("int", "INT")], (X0 + 1480, Y1 - 300), (250, 60), "Input_Seed", MPI)
N("noise", "RandomNoise", [0, "fixed"], [("noise_seed", "INT", True)], [("NOISE", "NOISE")], (X0 + 2010, Y1 - 300), (300, 90))
N("sampler", "KSamplerSelect", ["lcm"], [], [("SAMPLER", "SAMPLER")], (X0 + 2010, Y1 - 180), (300, 60))
# 2K = character-sheet's own 2K size; its portrait half (896x1120) is 4:5 and ~1:1 with a 2 MP Picture 1
N("w", "MpiInt", [1792], [], [("int", "INT")], (X0 + 1740, Y1 - 300), (210, 60), "W_sheet", MPI)
N("h", "MpiInt", [1120], [], [("int", "INT")], (X0 + 1740, Y1 - 200), (210, 60), "H_sheet", MPI)
N("sched", "Flux2Scheduler", [4, 1792, 1120], [("width", "INT", True), ("height", "INT", True)], [("SIGMAS", "SIGMAS")],
  (X0 + 2010, Y1 - 90), (300, 106))
N("latent", "EmptyFlux2LatentImage", [1792, 1120, 1], [("width", "INT", True), ("height", "INT", True)], [("LATENT", "LATENT")],
  (X0 + 2010, Y1 + 150), (300, 106))
N("sca", "SamplerCustomAdvanced", None,
  [("noise", "NOISE"), ("guider", "GUIDER"), ("sampler", "SAMPLER"), ("sigmas", "SIGMAS"), ("latent_image", "LATENT")],
  [("output", "LATENT"), ("denoised_output", "LATENT")], (X0 + 2350, Y1 - 200), (260, 120))
N("decode", "VAEDecode", None, [("samples", "LATENT"), ("vae", "VAE")], [("IMAGE", "IMAGE")], (X0 + 2650, Y1 - 200), (170, 50))
N("vram_end", "MpiClearVram", None, [("passthrough", "*")], [("passthrough", "*")], (X0 + 2650, Y1 - 140), (190, 30),
  "free VRAM after the run", MPI)
N("out", "PreviewImage", None, [("images", "IMAGE")], [], (X0 + 2650, Y1 - 60), (640, 460), "Output_Image")

# ---------------------------------------------------------------- links
L("img1", "image", "scale1", "image"); L("scale1", "IMAGE", "enc1", "pixels"); L("vae", "VAE", "enc1", "vae")

L("img2", "image", "detect", "image"); L("sam", "MODEL", "detect", "model"); L("sam", "CLIP", "vocab", "clip")
L("vocab", "CONDITIONING", "detect", "conditioning"); L("detect", "masks", "holes", "mask"); L("holes", "mask", "grow", "mask")
L("img2", "image", "corner", "image"); L("corner", "image", "plate", "image")
L("img2", "width", "plate", "width"); L("img2", "height", "plate", "height")
L("img2", "image", "fill", "destination"); L("plate", "IMAGE", "fill", "source"); L("grow", "MASK", "fill", "mask")
L("fill", "IMAGE", "vram", "passthrough"); L("vram", "passthrough", "scale2", "image")
L("scale2", "IMAGE", "enc2", "pixels"); L("vae", "VAE", "enc2", "vae")
L("vram", "passthrough", "dbg_sw", "true"); L("img2", "image", "dbg_sw", "false"); L("img2", "loaded", "dbg_sw", "boolean")
L("dbg_sw", "output", "dbg", "images")

L("ref_body", "STRING", "prompt_sw", "true"); L("ref_nobody", "STRING", "prompt_sw", "false"); L("img2", "loaded", "prompt_sw", "boolean")
L("prompt_sw", "output", "concat", "string_a"); L("layout", "STRING", "concat", "string_b")
L("concat", "STRING", "replace", "string"); L("user", "STRING", "replace", "replace")
L("replace", "STRING", "show_prompt", "source"); L("replace", "STRING", "text", "text"); L("clip", "CLIP", "text", "clip")

L("text", "CONDITIONING", "ref1", "conditioning"); L("enc1", "LATENT", "ref1", "latent")
L("ref1", "CONDITIONING", "ref2", "conditioning"); L("enc2", "LATENT", "ref2", "latent")
L("ref2", "CONDITIONING", "cond_sw", "true"); L("ref1", "CONDITIONING", "cond_sw", "false"); L("img2", "loaded", "cond_sw", "boolean")
L("text", "CONDITIONING", "zero", "conditioning")
L("unet", "MODEL", "guider", "model"); L("cond_sw", "output", "guider", "positive"); L("zero", "CONDITIONING", "guider", "negative")
L("seed", "int", "noise", "noise_seed")
L("w", "int", "sched", "width"); L("h", "int", "sched", "height"); L("w", "int", "latent", "width"); L("h", "int", "latent", "height")
L("noise", "NOISE", "sca", "noise"); L("guider", "GUIDER", "sca", "guider"); L("sampler", "SAMPLER", "sca", "sampler")
L("sched", "SIGMAS", "sca", "sigmas"); L("latent", "LATENT", "sca", "latent_image")
L("sca", "output", "decode", "samples"); L("vae", "VAE", "decode", "vae"); L("decode", "IMAGE", "vram_end", "passthrough"); L("vram_end", "passthrough", "out", "images")

groups = [
    {"id": 1, "title": "Picture 1 - face (3/4 turn)", "bounding": [X0 - 20, Y1 - 60, 960, 560], "color": "#3f789e", "font_size": 24, "flags": {}},
    {"id": 2, "title": "Picture 2 - body, head removed (optional)", "bounding": [X0 - 20, Y2 - 60, 2480, 620], "color": "#8A8", "font_size": 24, "flags": {}},
    {"id": 3, "title": "Prompt - baked + user text", "bounding": [X0 - 20, Y3 - 60, 2060, 520], "color": "#a1309b", "font_size": 24, "flags": {}},
]

graph = {
    "id": str(uuid.uuid4()), "revision": 0, "last_node_id": len(nodes), "last_link_id": len(links),
    "nodes": nodes, "links": links, "groups": groups, "config": {},
    "extra": {"frontendVersion": "1.49.6", "ds": {"scale": 0.5, "offset": [600, 900]}}, "version": 0.4,
}
with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    json.dump(graph, f, indent=2)
print("wrote", OUT, len(nodes), "nodes", len(links), "links")
