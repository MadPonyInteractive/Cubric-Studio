"""Build the MPI-1042 bench graph v2 (LiteGraph) for G:/ComfyUi: one file per model, the Flow's two `byModel` arms.
  Klein 9B = two samplings stitched (validation.md T6): the portrait alone on 896x1120, then the body views on
             896x1120 with picture 1 + the finished portrait (+ the headless body) as references.
  Qwen 2.1 = one sampling of the whole 1792x1120 sheet (batches 14b-15), alpha dropped (its VAE decodes RGBA).
Both: Input_Face_Turned picks the portrait sentence - true = keep picture 1's own turn (copy), false = force a
three-quarter turn (the app sets it from the describer's FRONT / TURNED answer, batch 14a). Picture 2 (body) is
optional exactly as in v1: its `loaded` output switches the prompt and the references, and the SAM3 branch is lazy.
Prompt strings are the tested ones: Klein's from two_pass.py, Qwen's read from qwen_spec_best.json.
usage: build_bench_v2.py <out_dir>"""
import json, os, sys, uuid

OUT = sys.argv[1]
HERE = os.path.dirname(os.path.abspath(__file__))
CORE = {"cnr_id": "comfy-core", "ver": "0.39.0"}
MPI = {"cnr_id": "ComfyUi-MpiNodes"}
RES = {"cnr_id": "RES4LYF"}
CP = "[CHARACTER PROMPT]"

# ---------------------------------------------------------------- prompts (tested strings)
KLEIN_P1_REF = "The character from image 1, in exactly the same visual style and medium as image 1. " + CP
KLEIN_P1_COPY = (
    "A head and shoulders portrait that keeps the head exactly as it is in image 1, with the same turn, tilt and "
    "expression and the same framing, face sharp and clear, hair fully visible from the crown down. Plain smooth grey "
    "seamless studio background. Extremely even soft illumination, soft open shadows, uniform brightness from edge to edge.")
KLEIN_P1_TURN = (
    "A head and shoulders portrait of exactly the same person as image 1, the head and shoulders turned "
    "three-quarters toward the left side of the image, the face seen at a three-quarter angle with both eyes "
    "visible and the far cheek partly hidden. The face, features, skin, piercings, tattoos, hair, headwear, "
    "expression and clothing stay exactly as in image 1, the same framing, face sharp and clear, the whole head "
    "inside the frame, the hair and headwear exactly as in image 1. Plain smooth grey seamless studio background. "
    "Extremely even soft illumination, soft open shadows, uniform brightness from edge to edge.")
KLEIN_P2_REF = ("The character from image 1, in exactly the same visual style and medium as image 1. The face, head and "
                "hair come only from image 1. " + CP)
KLEIN_P2_REF_BODY = (
    "The character from image 1, in exactly the same visual style and medium as image 1. The face, head and hair come "
    "only from image 1. The body, build, skin and clothing come from image 3, which shows that body with its head "
    "removed: give that body the head from image 1. " + CP)
KLEIN_P2_LAYOUT = (
    "A single continuous image containing two full-body standing views of the same character side by side, of equal "
    "width, one seen from the front and one from directly behind, the grey background flowing continuously behind both, "
    "the same character in both views with identical face, hair and wardrobe, arms hanging loose and relaxed at the "
    "sides, hands open and resting against the thighs, feet planted, generous headroom. Plain smooth grey seamless "
    "studio background, exactly the same grey and the same lighting as image 2. Extremely even frontal illumination, "
    "soft open shadows, uniform brightness from edge to edge.")

best = json.load(open(os.path.join(HERE, 'qwen_spec_best.json'), encoding='utf-8'))
Q_HEAD = ("Character reference sheet of the character from image 1, in exactly the same visual style and medium as "
          "image 1. The face, head and hair come only from image 1. ")
assert all(r['prompt'].startswith(Q_HEAD) for r in best), 'qwen_spec_best.json no longer starts with Q_HEAD'
Q_COPY, Q_TURN = (r['prompt'][len(Q_HEAD):] for r in best)  # [0] copy (batch 14b), [1] turn (batch 15)
Q_REF = Q_HEAD + CP
Q_REF_BODY = (Q_HEAD + "The body, build, skin and clothing come from image 2, which shows that body with its head "
              "removed: give that body the head from image 1. " + CP)

LOAD_OUTS = [("image", "IMAGE"), ("mask", "MASK"), ("width", "INT"), ("height", "INT"), ("loaded", "BOOLEAN")]
LOAD_INS = [("image", "COMBO"), ("channel", "COMBO"), ("block_if_empty", "BOOLEAN"), ("string", "STRING"), ("upload", "IMAGEUPLOAD")]
IFELSE = dict(ins=[("true", "*"), ("false", "*"), ("boolean", "BOOLEAN", True)], outs=[("output", "*")])


class G:
    def __init__(self):
        self.nodes, self.links, self.keys, self.groups = [], [], {}, []

    def n(self, key, typ, widgets, ins, outs, pos, size=(300, 100), title=None, props=CORE):
        nid = len(self.nodes) + 1
        self.keys[key] = nid
        node = {
            "id": nid, "type": typ, "pos": list(pos), "size": list(size), "flags": {}, "order": nid - 1, "mode": 0,
            # ins: (name, type) socket, or (name, type, True) for a widget that gets a link
            "inputs": [dict({"name": i[0], "type": i[1], "link": None}, **({"widget": {"name": i[0]}} if len(i) > 2 else {}))
                       for i in ins],
            "outputs": [{"name": o[0], "type": o[1], "links": [], "slot_index": s} for s, o in enumerate(outs)],
            "properties": dict(props, **{"Node name for S&R": typ}),
            "widgets_values": widgets,
        }
        if title:
            node["title"] = title
        self.nodes.append(node)

    def text(self, key, value, title, pos, size=(420, 160)):
        self.n(key, "PrimitiveStringMultiline", [value], [], [("STRING", "STRING")], pos, size, title)

    def ifelse(self, key, title, pos):
        self.n(key, "MpiIfElse", [True], IFELSE['ins'], IFELSE['outs'], pos, (240, 80), title, MPI)

    def l(self, src, out_name, dst, in_name):
        s, d = self.nodes[self.keys[src] - 1], self.nodes[self.keys[dst] - 1]
        os_ = next(i for i, o in enumerate(s["outputs"]) if o["name"] == out_name)
        ts = next(i for i, x in enumerate(d["inputs"]) if x["name"] == in_name)
        assert d["inputs"][ts]["link"] is None, (dst, in_name)
        lid = len(self.links) + 1
        self.links.append([lid, s["id"], os_, d["id"], ts, s["outputs"][os_]["type"]])
        s["outputs"][os_]["links"].append(lid)
        d["inputs"][ts]["link"] = lid

    def group(self, title, box, color):
        self.groups.append({"id": len(self.groups) + 1, "title": title, "bounding": list(box), "color": color,
                            "font_size": 24, "flags": {}})

    def save(self, path):
        graph = {"id": str(uuid.uuid4()), "revision": 0, "last_node_id": len(self.nodes), "last_link_id": len(self.links),
                 "nodes": self.nodes, "links": self.links, "groups": self.groups, "config": {},
                 "extra": {"frontendVersion": "1.53.10", "ds": {"scale": 0.45, "offset": [700, 900]}}, "version": 0.4}
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            json.dump(graph, f, indent=2)
        print("wrote", path, len(self.nodes), "nodes", len(self.links), "links")


def inputs(g, model):
    """Note, Picture 1, Picture 2 with its head removed (v1's SAM3 branch), the user text, seed and the face switch."""
    note = (f"MPI-1042 bench v2 - Character Sheet from images ({model})\n\n"
            "Picture 1 = face (required). Box it to 4:5 round the head, as the Flow's box step will.\n"
            "Input_Face_Turned: OFF = the picture faces the camera -> the portrait is turned three-quarters. ON = the "
            "picture is already turned -> the portrait keeps that turn and expression. The app sets it from the "
            "describer's FRONT / TURNED answer on the face crop.\n"
            "Picture 2 = body (optional). Picker on None = no body: the SAM3 branch never runs.\n"
            "Input_Positive = the user's text; it replaces [CHARACTER PROMPT].\n\n"
            + ("Two samplings: pass 1 = the portrait alone (896x1120), pass 2 = the two body views (896x1120) with "
               "picture 1, the portrait and the body as references, stitched [bodies | portrait]. ~48 s warm."
               if model == 'Klein 9B' else
               "One sampling of the whole 1792x1120 sheet, euler/simple 25 steps. ~65 s warm. Research licence: the "
               "images cannot be used commercially.")
            + "\n\nUNTESTED: body mode on v2 - the portrait sees picture 1 only, so its shoulders may wear picture 1's "
              "clothes while the body views wear picture 2's.")
    g.n("note", "Note", [note], [], [], (-560, -700), (500, 560), props={})
    g.n("img1", "MpiLoadImage", ["None", "alpha", True, "", "image"], LOAD_INS, LOAD_OUTS, (0, 0), (300, 450), "Input_Image", MPI)
    g.n("turned", "MpiSimpleBoolean", [False], [], [("boolean", "BOOLEAN")], (0, -160), (300, 60), "Input_Face_Turned", MPI)
    g.n("seed", "MpiInt", [42], [], [("int", "INT")], (0, -280), (300, 60), "Input_Seed", MPI)
    g.text("user", "", "Input_Positive", (0, -560), (300, 160))

    Y2 = 700
    g.n("img2", "MpiLoadImage", ["None", "alpha", False, "", "image"], LOAD_INS, LOAD_OUTS, (0, Y2), (300, 450), "Input_Image_2", MPI)
    g.n("sam", "CheckpointLoaderSimple", ["sam3.1_multiplex_fp16.safetensors"], [], [("MODEL", "MODEL"), ("CLIP", "CLIP"), ("VAE", "VAE")], (360, Y2), (340, 100), "SAM3 Model")
    g.n("vocab", "CLIPTextEncode", ["head, hair, hat"], [("clip", "CLIP")], [("CONDITIONING", "CONDITIONING")], (360, Y2 + 160), (340, 120), "SAM3 vocabulary")
    g.n("detect", "SAM3_Detect", [0.5, 2, False],
        [("model", "MODEL"), ("image", "IMAGE"), ("conditioning", "CONDITIONING"), ("bboxes", "BOUNDING_BOX"),
         ("positive_coords", "STRING"), ("negative_coords", "STRING")],
        [("masks", "MASK"), ("bboxes", "BOUNDING_BOX")], (740, Y2), (330, 210), "head + hair + hat, unioned")
    g.n("holes", "MpiMaskFillHoles", [0], [("mask", "MASK")], [("mask", "MASK")], (1110, Y2), (270, 60), props=MPI)
    g.n("grow", "GrowMask", [6, True], [("mask", "MASK")], [("MASK", "MASK")], (1110, Y2 + 100), (270, 82))
    g.n("corner", "Image Crop Location Exact", [0, 0, 32, 32, "original"], [("image", "IMAGE")],
        [("image", "IMAGE"), ("crop_data", "CROP_DATA")], (740, Y2 + 260), (280, 175), "backdrop sample (top-left 32px)", RES)
    g.n("plate", "ImageScale", ["nearest-exact", 512, 512, "disabled"],
        [("image", "IMAGE"), ("width", "INT", True), ("height", "INT", True)], [("IMAGE", "IMAGE")], (1110, Y2 + 260), (270, 130), "flat fill plate")
    g.n("fill", "ImageCompositeMasked", [0, 0, True], [("destination", "IMAGE"), ("source", "IMAGE"), ("mask", "MASK")],
        [("IMAGE", "IMAGE")], (1420, Y2), (270, 146), "body with its head filled flat")
    g.n("vram", "MpiClearVram", None, [("passthrough", "*")], [("passthrough", "*")], (1420, Y2 + 200), (190, 30), "free SAM3 before the model", MPI)
    g.ifelse("dbg_sw", "debug: body only when loaded", (1720, Y2 + 200))
    g.n("dbg", "PreviewImage", None, [("images", "IMAGE")], [], (2000, Y2 + 120), (360, 420), "Debug: body sent to the model")
    for a, b, c, d in [("img2", "image", "detect", "image"), ("sam", "MODEL", "detect", "model"), ("sam", "CLIP", "vocab", "clip"),
                       ("vocab", "CONDITIONING", "detect", "conditioning"), ("detect", "masks", "holes", "mask"),
                       ("holes", "mask", "grow", "mask"), ("img2", "image", "corner", "image"), ("corner", "image", "plate", "image"),
                       ("img2", "width", "plate", "width"), ("img2", "height", "plate", "height"),
                       ("img2", "image", "fill", "destination"), ("plate", "IMAGE", "fill", "source"), ("grow", "MASK", "fill", "mask"),
                       ("fill", "IMAGE", "vram", "passthrough"), ("vram", "passthrough", "dbg_sw", "true"),
                       ("img2", "image", "dbg_sw", "false"), ("img2", "loaded", "dbg_sw", "boolean"), ("dbg_sw", "output", "dbg", "images")]:
        g.l(a, b, c, d)
    g.group("Picture 1 - face, boxed 4:5", (-20, -620, 360, 1100), "#3f789e")
    g.group("Picture 2 - body, head removed (optional)", (-20, Y2 - 60, 2420, 620), "#8A8")


def prompt(g, key, ref, ref_body, copy, turn, title, pos):
    """[ref or ref_body by Picture 2] + ' ' + [copy or turn by Input_Face_Turned], [CHARACTER PROMPT] -> user text."""
    x, y = pos
    g.text(key + "_ref", ref, title + "_No_Body", (x, y))
    if ref_body:
        g.text(key + "_refb", ref_body, title + "_With_Body", (x, y + 200), (420, 180))
        g.ifelse(key + "_refsw", title + "_Select (has body?)", (x + 460, y))
        g.l(key + "_refb", "STRING", key + "_refsw", "true"); g.l(key + "_ref", "STRING", key + "_refsw", "false")
        g.l("img2", "loaded", key + "_refsw", "boolean")
    if turn:
        g.text(key + "_copy", copy, title + "_Copy_Turn", (x, y + 420), (420, 220))
        g.text(key + "_turn", turn, title + "_Force_Three_Quarter", (x, y + 680), (420, 260))
        g.ifelse(key + "_sw", title + "_Select (face turned?)", (x + 460, y + 420))
        g.l(key + "_copy", "STRING", key + "_sw", "true"); g.l(key + "_turn", "STRING", key + "_sw", "false")
        g.l("turned", "boolean", key + "_sw", "boolean")
    else:
        g.text(key + "_copy", copy, title + "_Layout", (x, y + 420), (420, 260))
    g.n(key + "_cat", "StringConcatenate", ["", "", " "], [("string_a", "STRING", True), ("string_b", "STRING", True)],
        [("STRING", "STRING")], (x + 760, y), (300, 120))
    g.n(key + "_rep", "StringReplace", ["", CP, ""], [("string", "STRING", True), ("replace", "STRING", True)],
        [("STRING", "STRING")], (x + 760, y + 160), (340, 140), title)
    g.n(key + "_show", "PreviewAny", [], [("source", "*")], [("STRING", "STRING")], (x + 760, y + 340), (380, 360), "Output_" + title)
    g.l(key + "_refsw" if ref_body else key + "_ref", "output" if ref_body else "STRING", key + "_cat", "string_a")
    g.l(key + "_sw" if turn else key + "_copy", "output" if turn else "STRING", key + "_cat", "string_b")
    g.l(key + "_cat", "STRING", key + "_rep", "string"); g.l("user", "STRING", key + "_rep", "replace")
    g.l(key + "_rep", "STRING", key + "_show", "source")


def klein():
    g = G()
    inputs(g, 'Klein 9B')
    X, Y = 600, -1700
    g.n("unet", "UNETLoader", ["flux-2-klein-9b-int8-convrot.safetensors", "default"], [], [("MODEL", "MODEL")], (X, -300), (340, 90))
    g.n("clip", "CLIPLoader", ["qwen_3_8b_int8_convrot.safetensors", "flux2", "default"], [], [("CLIP", "CLIP")], (X, -170), (340, 106))
    g.n("vae", "VAELoader", ["flux2-vae.safetensors"], [], [("VAE", "VAE")], (X, -20), (340, 60))
    g.n("scale1", "ImageScaleToTotalPixels", ["nearest-exact", 2, 16], [("image", "IMAGE")], [("IMAGE", "IMAGE")], (X, 100), (300, 106))
    g.n("enc1", "VAEEncode", None, [("pixels", "IMAGE"), ("vae", "VAE")], [("LATENT", "LATENT")], (X, 260), (200, 50), "Encode picture 1")
    g.n("scale2", "ImageScaleToTotalPixels", ["nearest-exact", 1, 16], [("image", "IMAGE")], [("IMAGE", "IMAGE")], (1720, 700), (300, 106))
    g.n("enc2", "VAEEncode", None, [("pixels", "IMAGE"), ("vae", "VAE")], [("LATENT", "LATENT")], (2080, 700), (200, 50), "Encode body")
    g.n("noise", "RandomNoise", [0, "fixed"], [("noise_seed", "INT", True)], [("NOISE", "NOISE")], (X, -460), (300, 90))
    g.n("sampler", "KSamplerSelect", ["lcm"], [], [("SAMPLER", "SAMPLER")], (X + 340, -460), (300, 60))
    g.n("w", "MpiInt", [896], [], [("int", "INT")], (X + 680, -460), (210, 60), "W_panel", MPI)
    g.n("h", "MpiInt", [1120], [], [("int", "INT")], (X + 680, -380), (210, 60), "H_panel", MPI)
    for a, b, c, d in [("img1", "image", "scale1", "image"), ("scale1", "IMAGE", "enc1", "pixels"), ("vae", "VAE", "enc1", "vae"),
                       ("vram", "passthrough", "scale2", "image"), ("scale2", "IMAGE", "enc2", "pixels"), ("vae", "VAE", "enc2", "vae"),
                       ("seed", "int", "noise", "noise_seed")]:
        g.l(a, b, c, d)

    prompt(g, "p1", KLEIN_P1_REF, None, KLEIN_P1_COPY, KLEIN_P1_TURN, "Portrait_Prompt", (X, Y))
    prompt(g, "p2", KLEIN_P2_REF, KLEIN_P2_REF_BODY, KLEIN_P2_LAYOUT, None, "Sheet_Prompt", (X + 1300, Y))

    def sample(p, x, y, refs):
        g.n(p + "_text", "CLIPTextEncode", [""], [("clip", "CLIP"), ("text", "STRING", True)], [("CONDITIONING", "CONDITIONING")], (x, y), (300, 90))
        g.n(p + "_zero", "ConditioningZeroOut", None, [("conditioning", "CONDITIONING")], [("CONDITIONING", "CONDITIONING")], (x, y + 130), (210, 30))
        g.l("clip", "CLIP", p + "_text", "clip"); g.l(p + "_rep", "STRING", p + "_text", "text"); g.l(p + "_text", "CONDITIONING", p + "_zero", "conditioning")
        prev = (p + "_text", "CONDITIONING")
        for i, (lat, label) in enumerate(refs, 1):
            g.n(f"{p}_r{i}", "ReferenceLatent", None, [("conditioning", "CONDITIONING"), ("latent", "LATENT")],
                [("CONDITIONING", "CONDITIONING")], (x + 340, y + 80 * (i - 1)), (240, 50), f"{p} ref {i} = {label}")
            g.l(prev[0], prev[1], f"{p}_r{i}", "conditioning"); g.l(lat[0], lat[1], f"{p}_r{i}", "latent")
            prev = (f"{p}_r{i}", "CONDITIONING")
        return prev

    def finish(p, x, y, positive):
        g.n(p + "_guider", "CFGGuider", [1], [("model", "MODEL"), ("positive", "CONDITIONING"), ("negative", "CONDITIONING")], [("GUIDER", "GUIDER")], (x, y), (300, 100))
        g.n(p + "_sched", "Flux2Scheduler", [4, 896, 1120], [("width", "INT", True), ("height", "INT", True)], [("SIGMAS", "SIGMAS")], (x, y + 140), (300, 106))
        g.n(p + "_latent", "EmptyFlux2LatentImage", [896, 1120, 1], [("width", "INT", True), ("height", "INT", True)], [("LATENT", "LATENT")], (x, y + 290), (300, 106))
        g.n(p + "_sca", "SamplerCustomAdvanced", None,
            [("noise", "NOISE"), ("guider", "GUIDER"), ("sampler", "SAMPLER"), ("sigmas", "SIGMAS"), ("latent_image", "LATENT")],
            [("output", "LATENT"), ("denoised_output", "LATENT")], (x + 340, y), (260, 120))
        g.n(p + "_dec", "VAEDecode", None, [("samples", "LATENT"), ("vae", "VAE")], [("IMAGE", "IMAGE")], (x + 340, y + 160), (170, 50))
        g.l("unet", "MODEL", p + "_guider", "model"); g.l(positive[0], positive[1], p + "_guider", "positive")
        g.l(p + "_zero", "CONDITIONING", p + "_guider", "negative")
        for wh in ("_sched", "_latent"):
            g.l("w", "int", p + wh, "width"); g.l("h", "int", p + wh, "height")
        for a, b, c in [("noise", "NOISE", "noise"), (p + "_guider", "GUIDER", "guider"), ("sampler", "SAMPLER", "sampler"),
                        (p + "_sched", "SIGMAS", "sigmas"), (p + "_latent", "LATENT", "latent_image")]:
            g.l(a, b, p + "_sca", c)
        g.l(p + "_sca", "output", p + "_dec", "samples"); g.l("vae", "VAE", p + "_dec", "vae")

    # pass 1: the portrait alone - only there does Klein copy picture 1 unsqueezed and keep (or take) the turn
    SX = X + 2700
    finish("p1", SX + 700, -900, sample("p1", SX, -900, [(("enc1", "LATENT"), "picture 1")]))
    # pass 2: the body views, the finished portrait as ref 2 so the grey and light match; ref 3 = the body when loaded
    g.n("encp", "VAEEncode", None, [("pixels", "IMAGE"), ("vae", "VAE")], [("LATENT", "LATENT")], (SX + 1100, -500), (200, 50), "Encode portrait")
    g.l("p1_dec", "IMAGE", "encp", "pixels"); g.l("vae", "VAE", "encp", "vae")
    last = sample("p2", SX, -200, [(("enc1", "LATENT"), "picture 1"), (("encp", "LATENT"), "portrait"), (("enc2", "LATENT"), "body")])
    g.ifelse("cond_sw", "Pass2_Conditioning (has body?)", (SX + 340, 60))
    g.l(last[0], last[1], "cond_sw", "true"); g.l("p2_r2", "CONDITIONING", "cond_sw", "false"); g.l("img2", "loaded", "cond_sw", "boolean")
    finish("p2", SX + 700, -200, ("cond_sw", "output"))
    g.n("stitch", "ImageStitch", ["right", False, 0, "white"], [("image1", "IMAGE"), ("image2", "IMAGE")], [("IMAGE", "IMAGE")],
        (SX + 1400, -200), (270, 150), "sheet [bodies | portrait]")
    g.n("vram_end", "MpiClearVram", None, [("passthrough", "*")], [("passthrough", "*")], (SX + 1400, -10), (190, 30), "free VRAM after the run", MPI)
    g.n("out", "PreviewImage", None, [("images", "IMAGE")], [], (SX + 1700, -200), (900, 600), "Output_Image")
    g.l("p2_dec", "IMAGE", "stitch", "image1"); g.l("p1_dec", "IMAGE", "stitch", "image2")
    g.l("stitch", "IMAGE", "vram_end", "passthrough"); g.l("vram_end", "passthrough", "out", "images")
    g.group("Pass 1 - portrait alone (896x1120)", (SX - 20, -960, 1380, 440), "#a1309b")
    g.group("Pass 2 - body views (896x1120), stitched", (SX - 20, -260, 2620, 700), "#b58b2a")
    return g


def qwen():
    g = G()
    inputs(g, 'Qwen-Image 2.1')
    X, Y = 600, -1700
    g.n("unet", "UNETLoader", ["qwen_image_2.1_int8_convrot.safetensors", "default"], [], [("MODEL", "MODEL")], (X, -300), (340, 90))
    g.n("cache", "QwenImage21Cache", ["auto", "default"], [("model", "MODEL")], [("MODEL", "MODEL")], (X + 380, -300), (270, 82))
    g.n("clip", "CLIPLoader", ["qwen3vl_8b_fp8_scaled.safetensors", "qwen_image", "default"], [], [("CLIP", "CLIP")], (X, -170), (340, 106))
    g.n("vae", "VAELoader", ["qwen_image_2.1_vae_bf16.safetensors"], [], [("VAE", "VAE")], (X, -20), (340, 60))
    g.n("ref2", "ComfySwitchNode", [False], [("on_false", "*"), ("on_true", "*"), ("switch", "BOOLEAN", True)], [("output", "*")],
        (1720, 900), (270, 78), "Reference 2 = body, None when empty")
    g.l("vram", "passthrough", "ref2", "on_true"); g.l("img2", "loaded", "ref2", "switch")
    prompt(g, "p", Q_REF, Q_REF_BODY, Q_COPY, Q_TURN, "Sheet_Prompt", (X, Y))
    g.n("encode", "TextEncodeQwenImage21", ["", "", 1024],
        [("clip", "CLIP"), ("images.image_1", "IMAGE"), ("images.image_2", "IMAGE"), ("vae", "VAE"), ("prompt", "STRING", True)],
        [("positive", "CONDITIONING"), ("negative", "CONDITIONING"), ("latent", "LATENT")], (X + 1300, -300), (420, 300))
    g.n("w", "MpiInt", [1792], [], [("int", "INT")], (X + 1300, -460), (210, 60), "W_sheet", MPI)
    g.n("h", "MpiInt", [1120], [], [("int", "INT")], (X + 1520, -460), (210, 60), "H_sheet", MPI)
    g.n("latent", "EmptyLatentImage", [1792, 1120, 1], [("width", "INT", True), ("height", "INT", True)], [("LATENT", "LATENT")], (X + 1760, -460), (300, 106), "sheet canvas")
    g.n("ks", "KSampler", [42, "fixed", 25, 1, "euler", "simple", 1],
        [("model", "MODEL"), ("positive", "CONDITIONING"), ("negative", "CONDITIONING"), ("latent_image", "LATENT"), ("seed", "INT", True)],
        [("LATENT", "LATENT")], (X + 1760, -300), (300, 262))
    g.n("dec", "VAEDecode", None, [("samples", "LATENT"), ("vae", "VAE")], [("IMAGE", "IMAGE")], (X + 2100, -300), (170, 50))
    g.n("rgb", "SplitImageWithAlpha", None, [("image", "IMAGE")], [("IMAGE", "IMAGE"), ("MASK", "MASK")], (X + 2100, -220), (220, 50), "drop alpha (2.1 VAE decodes RGBA)")
    g.n("vram_end", "MpiClearVram", None, [("passthrough", "*")], [("passthrough", "*")], (X + 2100, -130), (190, 30), "free VRAM after the run", MPI)
    g.n("out", "PreviewImage", None, [("images", "IMAGE")], [], (X + 2360, -300), (900, 600), "Output_Image")
    for a, b, c, d in [("unet", "MODEL", "cache", "model"), ("clip", "CLIP", "encode", "clip"), ("vae", "VAE", "encode", "vae"),
                       ("img1", "image", "encode", "images.image_1"), ("ref2", "output", "encode", "images.image_2"),
                       ("p_rep", "STRING", "encode", "prompt"), ("w", "int", "latent", "width"), ("h", "int", "latent", "height"),
                       ("cache", "MODEL", "ks", "model"), ("encode", "positive", "ks", "positive"), ("encode", "negative", "ks", "negative"),
                       ("latent", "LATENT", "ks", "latent_image"), ("seed", "int", "ks", "seed"),
                       ("ks", "LATENT", "dec", "samples"), ("vae", "VAE", "dec", "vae"), ("dec", "IMAGE", "rgb", "image"),
                       ("rgb", "IMAGE", "vram_end", "passthrough"), ("vram_end", "passthrough", "out", "images")]:
        g.l(a, b, c, d)
    return g


klein().save(os.path.join(OUT, "MPI-1042_character_sheet_v2_klein.json"))
qwen().save(os.path.join(OUT, "MPI-1042_character_sheet_v2_qwen.json"))
