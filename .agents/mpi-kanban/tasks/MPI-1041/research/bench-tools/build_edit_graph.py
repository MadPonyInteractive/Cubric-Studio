"""MPI-1041 A2: build the Klein 9B character-sheet EDIT graph (LiteGraph) for the Flow `flow_character_sheet_edit`.
One change on a finished 3-panel sheet (front body | back body | 3/4 portrait) by words, Klein 9B, no NSFW LoRA:
  - the edit path of comfy_workflows/raw/klein_t2i_template.json, pruned (no style / LoRA / enhance / depth / upscale),
  - EXACT size: ImageScaleToTotalPixels.megapixels <- MpiMath "a*b/1048576" on the loader's w/h (batch 6), the masked
    path's crop target <- the loader's w/h, and the free path ends on an ImageScale back to the loader's w/h,
  - an in-graph SAM3 LOCK chosen by Input_Lock:  0 = off (free edit) | 1 = "head, hair, face" on all three panels
    (batch 4 + "face": on the photo sheet "head, hair" alone marks the portrait's hair only, vocab A/B in graph-klein.md) | 2 = "face" on the front + the portrait only, the back panel has no face (batch 8). The mask is built
    per panel exactly as research/bench-tools/q4b_masklock.py did, then inverted: white = what the edit may change.
  - lazy: MpiIfElse picks every branch, so SAM3, the crop, LanPaint and the stitch run ONLY when Input_Lock > 0 (no MpiClearVram
    on that branch: it is OUTPUT_NODE and would always run it).
Titles the app touches: Input_Image, Input_Positive (the WHOLE prompt - the app / the Flow's prompt builder writes it),
Input_Seed, Input_Lock, Output_Image. The Python builder is the source of the raw file; the raw file is LiteGraph.

usage (repo root):
  build_edit_graph.py build [out.json]      write comfy_workflows/raw/flow_character_sheet_edit.json
  build_edit_graph.py spec  <outdir>        write the run spec for run_api.py (the 14 bench cases)
  build_edit_graph.py check <outdir>        output size == input size for every case
  build_edit_graph.py proof <outdir>        3 runs over a WebSocket: which nodes EXECUTE at lock 0 / 1 / 2 (bench :8188,
                                            only under gpu_lease - run_graph_klein.sh does)
  build_edit_graph.py maskspec <outdir>     the same graph cut at the lock mask (SAM3 + mask chain only) as a run spec
  build_edit_graph.py maskreport <outdir>   how much of the sheet / the portrait face / the front face the lock covers, vs batch 4's mask
Convert (single-file mode, APP ENGINE schema, never bare):
  COMFY_URL=http://127.0.0.1:48188 node scripts/workflow-to-api.mjs comfy_workflows/raw/flow_character_sheet_edit.json > tmp"""
import json, os, sys, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '../../../../../..'))
RAW = os.path.join(REPO, 'comfy_workflows', 'raw', 'flow_character_sheet_edit.json')
API = os.path.join(REPO, 'comfy_workflows', 'flow_character_sheet_edit.json')
IN = 'G:/ComfyUi/ComfyUI/input'

CORE = {"cnr_id": "comfy-core", "ver": "0.39.0"}
MPI = {"cnr_id": "ComfyUi-MpiNodes"}
LAN = {"cnr_id": "LanPaint"}
CROP = {"cnr_id": "comfyui-inpaint-cropandstitch"}

LOAD_OUTS = [("image", "IMAGE"), ("mask", "MASK"), ("width", "INT"), ("height", "INT"), ("loaded", "BOOLEAN")]
LOAD_INS = [("image", "COMBO"), ("channel", "COMBO"), ("block_if_empty", "BOOLEAN"), ("string", "STRING"), ("upload", "IMAGEUPLOAD")]
IFELSE = dict(ins=[("true", "*"), ("false", "*"), ("boolean", "BOOLEAN", True)], outs=[("output", "*")])
MATH_INS = [("a", "*"), ("b", "*"), ("c", "*")]
# ComfyUI-LanPaint's two display strings, verbatim from the shipped Klein template (klein_9b_t2i.json node 652)
LAN_INFO = "LanPaint KSampler. For more info, visit https://github.com/scraed/LanPaint. If you find it useful, please give a star \u2b50\ufe0f!"
LAN_MODE = "\U0001F5BC\ufe0f Image Inpainting"


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

    def text(self, key, value, title, pos, size=(300, 90)):
        self.n(key, "PrimitiveStringMultiline", [value], [], [("STRING", "STRING")], pos, size, title)

    def ifelse(self, key, title, pos):
        self.n(key, "MpiIfElse", [True], IFELSE['ins'], IFELSE['outs'], pos, (240, 80), title, MPI)

    def math(self, key, expr, title, pos):
        self.n(key, "MpiMath", [expr], MATH_INS, [("result", "*")], pos, (300, 110), title, MPI)

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
        graph = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, "cubric/flow_character_sheet_edit")), "revision": 0,
                 "last_node_id": len(self.nodes), "last_link_id": len(self.links),
                 "nodes": self.nodes, "links": self.links, "groups": self.groups, "config": {},
                 "extra": {"frontendVersion": "1.53.10", "ds": {"scale": 0.35, "offset": [200, 200]}}, "version": 0.4}
        with open(path, "w", encoding="utf-8", newline="\n") as f:   # raw/ wants LF + trailing newline + real unicode
            json.dump(graph, f, indent=2, ensure_ascii=False)
            f.write("\n")
        print("wrote", path, len(self.nodes), "nodes", len(self.links), "links")


NOTE = (
    "MPI-1041 A2 - Character Sheet Editor, the Klein 9B edit graph (generated by build_edit_graph.py).\n\n"
    "Changes ONE thing on a finished 3-panel sheet (front body | back body | 3/4 portrait) by words. Same size out as in.\n\n"
    "The app fills: Input_Image (the sheet), Input_Positive (the WHOLE prompt - the Flow's prompt builder writes it), "
    "Input_Seed, Input_Lock.\n"
    "Input_Lock: 0 = free edit, nothing is locked | 1 = SAM3 'head, hair, face' kept on all three panels (Clothes, Accessories) | "
    "2 = SAM3 'face' kept on the front and the portrait only (Hairstyle). Condition and Age run at 0 - they change the face.\n\n"
    "Lazy: SAM3, the crop, LanPaint and the stitch run ONLY when Input_Lock > 0 (MpiIfElse). Panels are 1/4 | 1/4 | 1/2 of "
    "the loaded width. Exact size: megapixels = w*h/2^20; the masked path crops to w x h; the free path ends on a resize "
    "back to w x h (a no-op when the sheet is a multiple of 16).\n"
    "No NSFW LoRA. SAM3 is an engine asset, not a Flow dependency.\n\n"
    "Do NOT splice an MpiClearVram into the lock branch: it is OUTPUT_NODE = True, so ComfyUI runs it on every prompt and "
    "it would pull SAM3 in at lock 0.")


def build(out=RAW):
    g = G()
    # ---------------------------------------------------------------- inputs
    g.n("note", "Note", [NOTE], [], [], (-560, -120), (500, 520), props={})
    g.n("img", "MpiLoadImage", ["None", "alpha", True, "", "image"], LOAD_INS, LOAD_OUTS, (0, 0), (300, 450), "Input_Image", MPI)
    g.n("pos", "MpiText", [""], [], [("Text", "STRING")], (0, 500), (300, 170), "Input_Positive", MPI)
    g.n("seed", "MpiInt", [42], [], [("int", "INT")], (0, 720), (300, 60), "Input_Seed", MPI)
    g.n("lock", "MpiInt", [0], [], [("int", "INT")], (0, 820), (300, 60), "Input_Lock", MPI)

    # ---------------------------------------------------------------- size math + the lock switches
    g.math("mp", "a*b/1048576", "exact size: megapixels = w * h / 2^20", (380, 0))
    g.math("q", "a // 4", "panel quarter: front width, back x", (380, 140))
    g.math("hx", "a // 2", "portrait x = half the width", (380, 280))
    g.math("bw", "a // 2 - a // 4", "back panel width", (380, 420))
    g.math("pw", "a - a // 2", "portrait width", (380, 560))
    g.n("locked", "MpiCompare", [">", 0], [("a", "*"), ("b", "*")], [("result", "BOOLEAN")], (380, 720), (300, 110),
        "locked? (Input_Lock > 0)", MPI)
    g.n("allp", "MpiCompare", ["==", 1], [("a", "*"), ("b", "*")], [("result", "BOOLEAN")], (380, 870), (300, 110),
        "lock on all three panels? (Input_Lock == 1)", MPI)
    for a, b, c, d in [("img", "width", "mp", "a"), ("img", "height", "mp", "b"), ("img", "width", "q", "a"),
                       ("img", "width", "hx", "a"), ("img", "width", "bw", "a"), ("img", "width", "pw", "a"),
                       ("lock", "int", "locked", "a"), ("lock", "int", "allp", "a")]:
        g.l(a, b, c, d)

    # ---------------------------------------------------------------- the SAM3 lock mask (lazy: only when locked)
    X0 = 760
    g.n("sam", "CheckpointLoaderSimple", ["sam3.1_multiplex_fp16.safetensors"], [],
        [("MODEL", "MODEL"), ("CLIP", "CLIP"), ("VAE", "VAE")], (X0, 0), (340, 100), "SAM3 Model")
    g.text("v_hh", "head, hair, face", "lock 1 vocabulary (all three panels)", (X0, 140))
    g.text("v_face", "face", "lock 2 vocabulary (front + portrait)", (X0, 270))
    g.ifelse("v_sw", "vocabulary by lock", (X0, 400))
    g.n("vocab", "CLIPTextEncode", [""], [("clip", "CLIP"), ("text", "STRING", True)], [("CONDITIONING", "CONDITIONING")],
        (X0, 500), (340, 100), "SAM3 vocabulary")
    for a, b, c, d in [("v_hh", "STRING", "v_sw", "true"), ("v_face", "STRING", "v_sw", "false"), ("allp", "result", "v_sw", "boolean"),
                       ("sam", "CLIP", "vocab", "clip"), ("v_sw", "output", "vocab", "text")]:
        g.l(a, b, c, d)

    X1, X2 = 1160, 1520
    crops = [("f", "front body", 0), ("b", "back body", 1), ("p", "portrait", 2)]
    for k, label, i in crops:
        y = i * 280
        g.n("c_" + k, "ImageCrop", [448, 1120, 0, 0],
            [("image", "IMAGE"), ("width", "INT", True), ("height", "INT", True)] + ([("x", "INT", True)] if k != "f" else []),
            [("IMAGE", "IMAGE")], (X1, y), (300, 140), "crop: " + label)
        g.n("d_" + k, "SAM3_Detect", [0.5, 2, False],
            [("model", "MODEL"), ("image", "IMAGE"), ("conditioning", "CONDITIONING"), ("bboxes", "BOUNDING_BOX"),
             ("positive_coords", "STRING"), ("negative_coords", "STRING")],
            [("masks", "MASK"), ("bboxes", "BOUNDING_BOX")], (X2, y), (330, 210), "SAM3 lock, " + label)
        g.l("img", "image", "c_" + k, "image")
        g.l("img", "height", "c_" + k, "height")
        g.l("c_" + k, "IMAGE", "d_" + k, "image")
        g.l("sam", "MODEL", "d_" + k, "model")
        g.l("vocab", "CONDITIONING", "d_" + k, "conditioning")
    g.l("q", "result", "c_f", "width")
    g.l("bw", "result", "c_b", "width"); g.l("q", "result", "c_b", "x")
    g.l("pw", "result", "c_p", "width"); g.l("hx", "result", "c_p", "x")
    # lock 2: the back view has no face by construction (batch 8: SAM3 "face" on a back panel marks the back of the head)
    g.n("empty_b", "SolidMask", [0.0, 448, 1120], [("width", "INT", True), ("height", "INT", True)], [("MASK", "MASK")],
        (X2, 880), (300, 100), "no lock on the back view (lock 2)")
    g.l("bw", "result", "empty_b", "width"); g.l("img", "height", "empty_b", "height")
    g.ifelse("b_sw", "back view: SAM3 only at lock 1", (1900, 280))
    g.l("d_b", "masks", "b_sw", "true"); g.l("empty_b", "MASK", "b_sw", "false"); g.l("allp", "result", "b_sw", "boolean")

    g.n("canvas", "SolidMask", [0.0, 1792, 1120], [("width", "INT", True), ("height", "INT", True)], [("MASK", "MASK")],
        (1900, 0), (300, 100), "empty sheet-sized mask")
    g.l("img", "width", "canvas", "width"); g.l("img", "height", "canvas", "height")
    paste = lambda k, label, y: g.n("m_" + k, "MaskComposite", [0, 0, "add"],
                                    [("destination", "MASK"), ("source", "MASK")] + ([("x", "INT", True)] if k != "f" else []),
                                    [("MASK", "MASK")], (2260, y), (300, 150), "paste: " + label, CORE)
    paste("f", "front body", 0); paste("b", "back body", 200); paste("p", "portrait", 400)
    g.l("canvas", "MASK", "m_f", "destination"); g.l("d_f", "masks", "m_f", "source")
    g.l("m_f", "MASK", "m_b", "destination"); g.l("b_sw", "output", "m_b", "source"); g.l("q", "result", "m_b", "x")
    g.l("m_b", "MASK", "m_p", "destination"); g.l("d_p", "masks", "m_p", "source"); g.l("hx", "result", "m_p", "x")
    g.n("holes", "MpiMaskFillHoles", [0], [("mask", "MASK")], [("mask", "MASK")], (2620, 0), (270, 60), "fill holes", MPI)
    g.n("grow", "GrowMask", [6, True], [("mask", "MASK")], [("MASK", "MASK")], (2620, 100), (270, 82), "grow the lock 6")
    g.n("inv", "InvertMask", None, [("mask", "MASK")], [("MASK", "MASK")], (2620, 220), (270, 40),
        "edit everything else (white = may change)")
    # NO MpiClearVram here: it is OUTPUT_NODE = True, so ComfyUI runs it on every prompt and it would drag the whole
    # SAM3 chain in at Input_Lock 0 (measured, the first bench run). ComfyUI evicts SAM3 itself when Klein loads.
    g.n("bbox", "MpiMaskSquareBbox", [64], [("mask", "MASK")],
        [("square_mask", "MASK"), ("x", "INT"), ("y", "INT"), ("size", "INT")], (2620, 300), (270, 100), None, MPI)
    for a, b, c, d in [("m_p", "MASK", "holes", "mask"), ("holes", "mask", "grow", "mask"), ("grow", "MASK", "inv", "mask"),
                       ("inv", "MASK", "bbox", "mask")]:
        g.l(a, b, c, d)

    # ---------------------------------------------------------------- the Klein 9B edit (klein_t2i_template's edit path, pruned)
    Y = 1200
    g.n("unet", "UNETLoader", ["flux-2-klein-9b-int8-convrot.safetensors", "default"], [], [("MODEL", "MODEL")], (X0, Y), (340, 90))
    g.n("clip", "CLIPLoader", ["qwen_3_8b_int8_convrot.safetensors", "flux2", "default"], [], [("CLIP", "CLIP")], (X0, Y + 130), (340, 106))
    g.n("vae", "VAELoader", ["flux2-vae.safetensors"], [], [("VAE", "VAE")], (X0, Y + 270), (340, 60))
    g.n("steps", "MpiInt", [4], [], [("int", "INT")], (X0, Y + 380), (210, 60), "steps", MPI)
    g.n("cfg", "MpiFloat", [1.0], [], [("float", "FLOAT")], (X0, Y + 480), (210, 60), "cfg", MPI)
    g.n("crop", "InpaintCropImproved",
        ["bilinear", "bicubic", False, "ensure minimum resolution", 1024, 1024, 16384, 16384, False, 6, False, 32, 0.1,
         False, 1, 1, 1, 1, 1, True, 1024, 1024, "32", "gpu (much faster)"],
        [("image", "IMAGE"), ("mask", "MASK"), ("optional_context_mask", "MASK"),
         ("output_target_width", "INT", True), ("output_target_height", "INT", True)],
        [("stitcher", "STITCHER"), ("cropped_image", "IMAGE"), ("cropped_mask", "MASK")], (1160, Y), (330, 560),
        "Inpaint Crop (the part the lock leaves open)", CROP)
    g.ifelse("img_sw", "reference picture: the crop when locked", (1560, Y))
    g.n("scale", "ImageScaleToTotalPixels", ["nearest-exact", 1, 16], [("image", "IMAGE"), ("megapixels", "FLOAT", True)],
        [("IMAGE", "IMAGE")], (1560, Y + 120), (300, 106), "Scale Image to Total Pixels (exact size)")
    g.n("enc", "VAEEncode", None, [("pixels", "IMAGE"), ("vae", "VAE")], [("LATENT", "LATENT")], (1560, Y + 260), (200, 50), "Encode ref 1")
    g.n("size", "GetImageSize", None, [("image", "IMAGE")], [("width", "INT"), ("height", "INT"), ("batch_size", "INT")],
        (1560, Y + 340), (200, 60))
    g.n("txt", "CLIPTextEncode", [""], [("clip", "CLIP"), ("text", "STRING", True)], [("CONDITIONING", "CONDITIONING")],
        (1900, Y), (340, 100), "CLIP Text Encode (Prompt)")
    g.n("neg", "ConditioningZeroOut", None, [("conditioning", "CONDITIONING")], [("CONDITIONING", "CONDITIONING")], (1900, Y + 130), (220, 30))
    g.n("ref", "ReferenceLatent", None, [("conditioning", "CONDITIONING"), ("latent", "LATENT")], [("CONDITIONING", "CONDITIONING")],
        (1900, Y + 200), (240, 50), "Set Reference Latent 1")
    g.n("fg", "FluxGuidance", [4.0], [("conditioning", "CONDITIONING")], [("CONDITIONING", "CONDITIONING")], (1900, Y + 290), (240, 60),
        "FluxGuidance (LanPaint)")
    g.n("noise", "RandomNoise", [0, "fixed"], [("noise_seed", "INT", True)], [("NOISE", "NOISE")], (2300, Y), (300, 90))
    g.n("ksel", "KSamplerSelect", ["lcm"], [], [("SAMPLER", "SAMPLER")], (2300, Y + 130), (300, 60))
    g.n("guider", "CFGGuider", [1.0], [("model", "MODEL"), ("positive", "CONDITIONING"), ("negative", "CONDITIONING"),
                                      ("cfg", "FLOAT", True)], [("GUIDER", "GUIDER")], (2300, Y + 230), (300, 100))
    g.n("sched", "Flux2Scheduler", [4, 1024, 1024], [("steps", "INT", True), ("width", "INT", True), ("height", "INT", True)],
        [("SIGMAS", "SIGMAS")], (2300, Y + 370), (300, 106))
    g.n("sca", "SamplerCustomAdvanced", None,
        [("noise", "NOISE"), ("guider", "GUIDER"), ("sampler", "SAMPLER"), ("sigmas", "SIGMAS"), ("latent_image", "LATENT")],
        [("output", "LATENT"), ("denoised_output", "LATENT")], (2660, Y), (260, 120), "free edit sampler")
    g.n("nmask", "SetLatentNoiseMask", None, [("samples", "LATENT"), ("mask", "MASK")], [("LATENT", "LATENT")],
        (2660, Y + 200), (260, 50), "Set Latent Noise Mask (locked)")
    g.n("lan", "LanPaint_KSampler",
        [0, "fixed", 4, 1.0, "euler_ancestral", "simple", 1.0, 2, "Image First", LAN_INFO, LAN_MODE],
        [("model", "MODEL"), ("positive", "CONDITIONING"), ("negative", "CONDITIONING"), ("latent_image", "LATENT"),
         ("seed", "INT", True), ("steps", "INT", True), ("cfg", "FLOAT", True)],
        [("LATENT", "LATENT")], (2660, Y + 300), (340, 330), "LanPaint KSampler (locked)", LAN)
    g.ifelse("lat_sw", "sampled latent: LanPaint when locked", (3060, Y))
    g.n("dec", "VAEDecode", None, [("samples", "LATENT"), ("vae", "VAE")], [("IMAGE", "IMAGE")], (3060, Y + 120), (170, 50))
    g.n("stitch", "InpaintStitchImproved", None, [("stitcher", "STITCHER"), ("inpainted_image", "IMAGE")], [("image", "IMAGE")],
        (3060, Y + 220), (300, 60), "Inpaint Stitch (locked: the sheet's own size)", CROP)
    g.n("guard", "ImageScale", ["lanczos", 1792, 1120, "disabled"],
        [("image", "IMAGE"), ("width", "INT", True), ("height", "INT", True)], [("IMAGE", "IMAGE")], (3060, Y + 330), (300, 130),
        "back to the sheet's size (free edit)")
    g.ifelse("out_sw", "result: the stitch when locked", (3440, Y + 220))
    g.n("vram_end", "MpiClearVram", None, [("passthrough", "*")], [("passthrough", "*")], (3440, Y + 350), (190, 30),
        "free VRAM after the run", MPI)
    g.n("out", "PreviewImage", None, [("images", "IMAGE")], [], (3700, Y + 220), (700, 500), "Output_Image")

    for a, b, c, d in [
            # models + the prompt
            ("clip", "CLIP", "txt", "clip"), ("pos", "Text", "txt", "text"), ("txt", "CONDITIONING", "neg", "conditioning"),
            # picture: cropped by the lock mask when locked, whole when not; exact size on both
            ("img", "image", "crop", "image"), ("inv", "MASK", "crop", "mask"), ("bbox", "square_mask", "crop", "optional_context_mask"),
            ("img", "width", "crop", "output_target_width"), ("img", "height", "crop", "output_target_height"),
            ("locked", "result", "img_sw", "boolean"), ("crop", "cropped_image", "img_sw", "true"), ("img", "image", "img_sw", "false"),
            ("img_sw", "output", "scale", "image"), ("mp", "result", "scale", "megapixels"),
            ("scale", "IMAGE", "enc", "pixels"), ("vae", "VAE", "enc", "vae"), ("scale", "IMAGE", "size", "image"),
            ("txt", "CONDITIONING", "ref", "conditioning"), ("enc", "LATENT", "ref", "latent"), ("ref", "CONDITIONING", "fg", "conditioning"),
            # the free sampler
            ("seed", "int", "noise", "noise_seed"),
            ("unet", "MODEL", "guider", "model"), ("ref", "CONDITIONING", "guider", "positive"), ("neg", "CONDITIONING", "guider", "negative"),
            ("cfg", "float", "guider", "cfg"),
            ("steps", "int", "sched", "steps"), ("size", "width", "sched", "width"), ("size", "height", "sched", "height"),
            ("noise", "NOISE", "sca", "noise"), ("guider", "GUIDER", "sca", "guider"), ("ksel", "SAMPLER", "sca", "sampler"),
            ("sched", "SIGMAS", "sca", "sigmas"), ("enc", "LATENT", "sca", "latent_image"),
            # the locked sampler
            ("enc", "LATENT", "nmask", "samples"), ("crop", "cropped_mask", "nmask", "mask"),
            ("unet", "MODEL", "lan", "model"), ("fg", "CONDITIONING", "lan", "positive"), ("neg", "CONDITIONING", "lan", "negative"),
            ("nmask", "LATENT", "lan", "latent_image"), ("seed", "int", "lan", "seed"), ("steps", "int", "lan", "steps"),
            ("cfg", "float", "lan", "cfg"),
            # decode + result
            ("locked", "result", "lat_sw", "boolean"), ("lan", "LATENT", "lat_sw", "true"), ("sca", "output", "lat_sw", "false"),
            ("lat_sw", "output", "dec", "samples"), ("vae", "VAE", "dec", "vae"),
            ("crop", "stitcher", "stitch", "stitcher"), ("dec", "IMAGE", "stitch", "inpainted_image"),
            ("dec", "IMAGE", "guard", "image"), ("img", "width", "guard", "width"), ("img", "height", "guard", "height"),
            ("locked", "result", "out_sw", "boolean"), ("stitch", "image", "out_sw", "true"), ("guard", "IMAGE", "out_sw", "false"),
            ("out_sw", "output", "vram_end", "passthrough"), ("vram_end", "passthrough", "out", "images")]:
        g.l(a, b, c, d)

    g.group("Inputs - the app fills these", (-20, -60, 360, 990), "#3f789e")
    g.group("Size math + lock switches", (360, -60, 340, 1070), "#8A8")
    g.group("SAM3 lock mask - runs ONLY when Input_Lock > 0 (lock 1: head, hair, face x3 | lock 2: face x2)", (X0 - 20, -60, 2200, 1140), "#a1309b")
    g.group("Klein 9B edit - exact size", (X0 - 20, Y - 60, 3700, 800), "#b58b2a")
    g.save(out)


# ====================================================================== bench cases (strings VERBATIM from the bench scripts)
SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png'}
TAIL = ' Make the same change in the close-up portrait on the right. Keep everything else exactly as it is.'   # q23 / qage L1
OUTFITS = {    # q23_state_body_age.py OUTFITS
    'tee': 'a fitted white crew-neck t-shirt, light blue jeans and white sneakers',
    'biker': 'a red leather biker jacket over a black knee-length dress, and black ankle boots',
    'armour': ('brown medieval leather armour with a wide belt, a dark green cloak hanging down the back with '
               'the hood down, and tall brown boots'),
}


def clothes(o):    # q23 "LN": batch 4's outfits in "the character" wording (the Flow never knows the pronoun)
    return (f'Dress the character in {o}. Dress the character the same way in the close-up portrait on the right. '
            'Keep everything else exactly as it is.')


HAIR = ('Give the character a short blonde bob haircut. Make the same change in the close-up portrait on '
        'the right. Keep everything else exactly as it is.')                      # qhair.py, 'bob'
BEATEN = ('Make the character look beaten up after a fight: a bruised, cut face and torn, dirty clothes.' + TAIL)   # q23 Q2
AGE_C = 'Change the character in this character sheet to be a younger version of themselves as a '    # qage.py SET v3
AGE10 = AGE_C + "10-year-old child, with a child's smooth face, no beard and no wrinkles, wearing the same clothes." + TAIL
AGE30 = AGE_C + '30-year-old, with a younger face, smooth skin and no grey hair.' + TAIL


def cases():
    out = []   # (tag, sheet, lock, prompt)
    for sh in SHEETS:
        for k, o in OUTFITS.items():
            out.append((f'clo_{k}_{sh}', sh, 1, clothes(o)))
        out.append((f'hair_bob_{sh}', sh, 2, HAIR))
        out.append((f'cond_beaten_{sh}', sh, 0, BEATEN))
        out.append((f'age10_{sh}', sh, 0, AGE10))
        out.append((f'age30_{sh}', sh, 0, AGE30))
    out.append(('mp1_age10_photo', 'photo', 0, AGE10))   # A/B: the same graph with megapixels forced to 1 (batch 15 ran at 1 MP)
    out.append(('mp1_age10_fisher', 'fisher', 0, AGE10))
    return out


MP_TITLE = 'exact size: megapixels = w * h / 2^20'


def one(sheet_file, lock, prompt, seed=42):
    return {'Input_Image': {'string': sheet_file}, 'Input_Positive': {'string': prompt},
            'Input_Seed': {'int': seed}, 'Input_Lock': {'int': lock}}


def spec(outdir):
    os.makedirs(outdir, exist_ok=True)
    s = [{'tag': t, 'api': API, 'set': dict(one(SHEETS[sh], lock, p), **({MP_TITLE: {'math_expression': '1.0'}} if t.startswith('mp1_') else {}))}
         for t, sh, lock, p in cases()]
    path = os.path.join(outdir, 'graph_klein_spec.json')
    json.dump(s, open(path, 'w', encoding='utf-8'), indent=1)
    for r in s:   # one spec per case too: run_api.py dies on the first HTTP error, the runner loops so one bad case cannot eat the rest
        json.dump([r], open(os.path.join(outdir, 'case_' + r['tag'] + '.json'), 'w', encoding='utf-8'), indent=1)
    print(len(s), 'cases ->', path)


def check(outdir):
    from PIL import Image
    bad = 0
    for t, sh, lock, _ in cases():
        p = os.path.join(outdir, t + '.png')
        if not os.path.exists(p):
            print(t.ljust(22), 'MISSING'); bad += 1; continue
        a, b = Image.open(p).size, Image.open(os.path.join(IN, SHEETS[sh])).size
        print(t.ljust(22), f'lock {lock}', f'{a[0]}x{a[1]}', 'input', f'{b[0]}x{b[1]}', 'SAME' if a == b else 'DIFFERENT')
        bad += a != b
    print('size check:', 'all outputs == input size' if not bad else f'{bad} FAILED')
    return bad


def proof(outdir):
    """3 runs on a clothed sheet over a WebSocket, listing the nodes that EXECUTE. A node a lazy MpiIfElse never asked for
    never fires `executing`. A run only counts when its Output_Image comes back (a blocked loader fires `executing` for
    every node and returns nothing - the first attempt at this proof). The SAM3 vocabulary gets trailing spaces unique to
    this invocation (the tokens do not change, the node signature does), so the cache of an earlier run cannot hide a SAM3
    node that really ran."""
    import copy, time, urllib.request, urllib.parse
    from websockets.sync.client import connect
    api = json.load(open(API, encoding='utf-8'))
    title = {v['_meta']['title']: k for k, v in api.items()}
    watch = {k: v['_meta']['title'] for k, v in api.items()
             if v['class_type'] in ('SAM3_Detect', 'InpaintCropImproved', 'LanPaint_KSampler', 'InpaintStitchImproved',
                                    'MpiMaskSquareBbox', 'SamplerCustomAdvanced', 'ImageScale')
             or v['_meta']['title'] == 'SAM3 Model'}
    bust = ' ' * (int(time.time()) % 90 + 1)
    failed = 0
    for lock, prompt in ((0, BEATEN), (1, clothes(OUTFITS['tee'])), (2, HAIR)):
        g = copy.deepcopy(api)
        for t, ins in one('mpi1042art_cafe_sheet.png', lock, prompt, 43).items():
            g[title[t]]['inputs'].update(ins)
        for t in ('lock 1 vocabulary (all three panels)', 'lock 2 vocabulary (front + portrait)'):
            g[title[t]]['inputs']['value'] += bust
        cid = str(uuid.uuid4())
        ws = connect(f'ws://127.0.0.1:8188/ws?clientId={cid}', max_size=None)
        body = json.dumps({'prompt': g, 'client_id': cid}).encode()
        res = json.load(urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8188/prompt', body, {'Content-Type': 'application/json'})))
        if res.get('node_errors'):
            print('lock', lock, 'NODE ERRORS', json.dumps(res['node_errors'])[:800])
        pid, t0, ran, cached = res['prompt_id'], time.time(), [], []
        while True:
            m = ws.recv(timeout=900)
            if isinstance(m, bytes):
                continue
            d = json.loads(m)
            if d.get('data', {}).get('prompt_id') not in (None, pid):
                continue
            if d['type'] == 'execution_cached':
                cached += d['data']['nodes']
            elif d['type'] == 'executing':
                if d['data']['node'] is None:
                    break
                ran.append(d['data']['node'])
            elif d['type'] == 'execution_error':
                print('lock', lock, 'EXECUTION ERROR', json.dumps(d['data'])[:600]); break
        ws.close()
        print(f'PROOF lock {lock}: {len(ran)} nodes executed in {time.time() - t0:.0f}s, {len(cached)} cached')
        for k, t in sorted(watch.items(), key=lambda kv: int(kv[0])):
            print('   ', ('RAN   ' if k in ran else 'cached' if k in cached else 'skipped'), k, api[k]['class_type'], '|', t)
        h = json.load(urllib.request.urlopen(f'http://127.0.0.1:8188/history/{pid}'))[pid]
        ims = h['outputs'].get(title['Output_Image'], {}).get('images', [])
        for im in ims:
            q = urllib.parse.urlencode({'filename': im['filename'], 'subfolder': im['subfolder'], 'type': im['type']})
            urllib.request.urlretrieve(f'http://127.0.0.1:8188/view?{q}', os.path.join(outdir, f'proof_lock{lock}_cafe.png'))
        print('    Output_Image saved' if ims else '    NO Output_Image - this proof run does NOT count')
        failed += not ims
    print('PROOF', 'FAILED' if failed else 'complete: every run returned its image')
    return failed


# ====================================================================== the lock mask on its own (A4: does lock 1 cover the portrait FACE?)
# The same converted graph cut at the InvertMask node: MaskToImage + PreviewImage 'Output_Image' replace the edit's tail, so the
# run is SAM3 + the mask chain only (seconds, no Klein). White in the PNG = what the edit may change; black = LOCKED.
MASK_CASES = [('mask_photo_1', 'mpi1042art_cafe2_sheet.png', 1), ('mask_photo_2', 'mpi1042art_cafe2_sheet.png', 2),
              ('mask_fisher_1', 'mpi1042art_fisher_sheet.png', 1), ('mask_fisher_2', 'mpi1042art_fisher_sheet.png', 2),
              ('mask_nude_1', 'mpi1041_nude_sheet.png', 1)]   # the nude sheet: batch 4's mask PNG was made on it - NUMBERS only, no overlay
BATCH4_MASK = IN + '/mpi1041_mask_panels.png'                 # batch 4's mask (q4b_masklock.py, nude sheet), white = edit
# inner-face boxes in sheet pixels: the portrait's eyes-to-mouth, and the front body's face
FACE = {'photo': ((1150, 330, 1500, 620), (190, 95, 275, 195)), 'fisher': ((1080, 250, 1500, 600), (190, 110, 285, 215))}


def mask_api(outdir):
    os.makedirs(outdir, exist_ok=True)
    api = json.load(open(API, encoding='utf-8'))
    title = {v['_meta']['title']: k for k, v in api.items()}
    inv = title['edit everything else (white = may change)']
    for t in ('Output_Image', 'free VRAM after the run'):
        del api[title[t]]
    api['900'] = {'class_type': 'MaskToImage', '_meta': {'title': 'mask to image'}, 'inputs': {'mask': [inv, 0]}}
    api['901'] = {'class_type': 'PreviewImage', '_meta': {'title': 'Output_Image'}, 'inputs': {'images': ['900', 0]}}
    path = os.path.join(outdir, 'mask_only_api.json')
    json.dump(api, open(path, 'w', encoding='utf-8'), indent=1)
    return path


def maskspec(outdir):
    path = mask_api(outdir)
    s = [{'tag': t, 'api': path, 'set': {'Input_Image': {'string': f}, 'Input_Lock': {'int': lock}}} for t, f, lock in MASK_CASES]
    json.dump(s, open(os.path.join(outdir, 'mask_spec.json'), 'w', encoding='utf-8'), indent=1)
    print(len(s), 'mask cases ->', os.path.join(outdir, 'mask_spec.json'))


def maskreport(outdir):
    import numpy as np
    from PIL import Image
    def locked(p):   # True where the lock keeps the pixel (the mask PNG is black there)
        return np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)[..., 0] < 128
    for tag, f, lock in MASK_CASES:
        p = os.path.join(outdir, tag + '.png')
        if not os.path.exists(p):
            print(tag.ljust(14), 'MISSING'); continue
        L = locked(p)
        sheet, line = tag.split('_')[1], f'{tag.ljust(14)} locked {100 * L.mean():4.1f}% of the sheet'
        if sheet in FACE:
            pb, fb = FACE[sheet]
            line += '  | portrait inner face locked {:3.0f}%  front face locked {:3.0f}%'.format(
                100 * L[pb[1]:pb[3], pb[0]:pb[2]].mean(), 100 * L[fb[1]:fb[3], fb[0]:fb[2]].mean())
            im = np.asarray(Image.open(os.path.join(IN, f)).convert('RGB'), dtype=np.float32)
            tint = im.copy(); tint[L] = 0.45 * tint[L] + 0.55 * np.array([0, 255, 0], dtype=np.float32)
            o = Image.fromarray(tint.astype(np.uint8)); o = o.resize((896, round(o.height * 896 / o.width)))
            o.save(os.path.join(outdir, f'lock_overlay_{tag}.jpg'), quality=88)
        if sheet == 'nude' and os.path.exists(BATCH4_MASK):
            B = locked(BATCH4_MASK)
            line += f'  | vs batch 4 mask PNG: {100 * (L != B).mean():.3f}% of pixels differ (locked px: mine {L.sum()}, batch 4 {B.sum()})'
        print(line)


# ---------------------------------------------------------------------- lock 1 vocabulary A/B (coordinator, after A4's finding):
# does "head, hair, face" pin the portrait FACE on the photo sheet without pulling body / clothes in? Mask-only, both vocabularies
# run explicitly (the graph's own lock-1 vocabulary node is overridden), so the comparison does not depend on which one the graph ships.
V_SHEETS = {'photo': 'mpi1042art_cafe2_sheet.png', 'fisher': 'mpi1042art_fisher_sheet.png', 'nude': 'mpi1041_nude_sheet.png'}
V_TITLE = 'lock 1 vocabulary (all three panels)'
V_VOCABS = {'vbase': 'head, hair', 'vnew': 'head, hair, face'}


def vocabspec(outdir):
    path = mask_api(outdir)
    s = [{'tag': f'{sh}_{k}', 'api': path, 'set': {'Input_Image': {'string': f}, 'Input_Lock': {'int': 1}, V_TITLE: {'value': v}}}
         for sh, f in V_SHEETS.items() for k, v in V_VOCABS.items()]
    json.dump(s, open(os.path.join(outdir, 'vocab_spec.json'), 'w', encoding='utf-8'), indent=1)
    print(len(s), 'vocabulary mask cases ->', os.path.join(outdir, 'vocab_spec.json'))


def vocabreport(outdir):
    import numpy as np
    from PIL import Image
    def ld(p):
        return np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)[..., 0] < 128
    for sh, f in V_SHEETS.items():
        pb, pn = os.path.join(outdir, f'{sh}_vbase.png'), os.path.join(outdir, f'{sh}_vnew.png')
        if not (os.path.exists(pb) and os.path.exists(pn)):
            print(sh, 'MISSING'); continue
        B, N = ld(pb), ld(pn)
        print(f'{sh}: locked {100 * B.mean():.1f}% ("head, hair") -> {100 * N.mean():.1f}% ("head, hair, face") of the sheet')
        for name, x0, x1 in (('front', 0, 448), ('back', 448, 896), ('portrait', 896, 1792)):
            b, n = B[:, x0:x1], N[:, x0:x1]
            ys, xs = np.where(b)
            extra = n & ~b
            outside = extra.copy()
            if len(ys):   # the base lock's bounding box + 16 px: anything the new vocabulary adds beyond it is not head or hair
                outside[max(ys.min() - 16, 0):ys.max() + 17, max(xs.min() - 16, 0):xs.max() + 17] = False
            print(f'   {name:9s} base locked {int(b.sum()):7d} px | of which still locked {100 * (b & n).sum() / max(int(b.sum()), 1):5.1f}% | '
                  f'added {int(extra.sum()):6d} px, of those outside the base box +16: {int(outside.sum())}')
        if sh in FACE:
            pbx, fbx = FACE[sh]
            for lab, M in (('"head, hair"      ', B), ('"head, hair, face"', N)):
                print(f'   {lab} portrait inner face locked {100 * M[pbx[1]:pbx[3], pbx[0]:pbx[2]].mean():3.0f}%   front face locked '
                      f'{100 * M[fbx[1]:fbx[3], fbx[0]:fbx[2]].mean():3.0f}%')
            im = np.asarray(Image.open(os.path.join(IN, f)).convert('RGB'), dtype=np.float32)
            tint = im.copy()
            tint[B] = 0.45 * tint[B] + 0.55 * np.array([0, 255, 0], dtype=np.float32)       # green = already locked by "head, hair"
            tint[N & ~B] = 0.35 * tint[N & ~B] + 0.65 * np.array([255, 0, 255], dtype=np.float32)   # magenta = ADDED by "face"
            o = Image.fromarray(tint.astype(np.uint8)); o = o.resize((896, round(o.height * 896 / o.width)))
            o.save(os.path.join(outdir, f'lock_overlay_{sh}_vocab_added.jpg'), quality=88)


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else 'build'
    if cmd == 'build':
        build(sys.argv[2] if len(sys.argv) > 2 else RAW)
    elif cmd == 'spec':
        spec(sys.argv[2])
    elif cmd == 'check':
        sys.exit(1 if check(sys.argv[2]) else 0)
    elif cmd == 'proof':
        sys.exit(1 if proof(sys.argv[2]) else 0)
    elif cmd == 'maskspec':
        maskspec(sys.argv[2])
    elif cmd == 'maskreport':
        maskreport(sys.argv[2])
    elif cmd == 'vocabspec':
        vocabspec(sys.argv[2])
    elif cmd == 'vocabreport':
        vocabreport(sys.argv[2])
    else:
        sys.exit(__doc__)
