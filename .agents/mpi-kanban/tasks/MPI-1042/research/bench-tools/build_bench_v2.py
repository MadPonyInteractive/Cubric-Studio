"""Build the MPI-1042 bench graph v2 (LiteGraph) for G:/ComfyUi: one file per model, the Flow's two `byModel` arms.
  Klein 9B = two samplings stitched (validation.md T6): the portrait alone on 896x1120, then the body views on
             896x1120 with picture 1 + the finished portrait (+ the headless body) as references.
  Qwen 2.1 = one sampling of the whole 1792x1120 sheet (batches 14b-15), alpha dropped (its VAE decodes RGBA).
Both: Input_Face_Turned picks the portrait sentence - true = keep picture 1's own turn (copy), false = force a
three-quarter turn (the app sets it from the describer's FRONT / TURNED answer, batch 14a). Picture 2 (body) is
optional exactly as in v1: its `loaded` output switches the prompt and the references, and the SAM3 branch is lazy.
Prompt strings are the tested ones: Klein's from two_pass.py, Qwen's read from qwen_spec_best.json.
--flow writes the app's two raw graphs instead (flow_character_sheet_from_images[_klein].json): picture 1 is cut to
the box step's `Input_Box` (any box widened to 4:5 round its centre, so an agent's measured box works too), and
the describer's two answers arrive as text - `Input_Face_Pose` (FRONT / TURNED) drives the turn switch, and
`Input_Body_Clothes` becomes the "Below the chin ..." caption put ahead of the user's text (batches 21-23).
usage: build_bench_v2.py <out_dir> [--flow]"""
import json, os, sys, uuid

OUT = sys.argv[1]
FLOW = '--flow' in sys.argv[2:]
FACE = ("face", "image") if FLOW else ("img1", "image")
# the app ships the int8 Qwen3-VL 8B encoder (MPI-936 swapped the fp8 one out on 2026-10-09); the bench kept fp8
QWEN_CLIP = "qwen3vl_8b_int8_convrot.safetensors" if FLOW else "qwen3vl_8b_fp8_scaled.safetensors"
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
    "visible and the far cheek partly hidden. The face, features, skin, hair, headwear and expression stay exactly "
    "as in image 1, with nothing added that image 1 does not show, the same framing, face sharp and clear, the whole head "
    "inside the frame, the hair and headwear exactly as in image 1. Plain smooth grey seamless studio background. "
    "Extremely even soft illumination, soft open shadows, uniform brightness from edge to edge.")
# batch 18: with a body, the portrait wore picture 1's clothes - pass 1 now sees the body as image 2
# No wording alone dresses the portrait right for both a clothed and a nude body (batches 19-21). The app's
# describer names the body picture's clothes and the app puts that caption in the user text (see the note);
# with it this wording (batch 19's) was right 6 of 6 on both models, clothed and nude (batch 22).
BELOW_CHIN = ("wears exactly what image {n} wears below the chin, or bare skin where image {n} shows bare skin; no clothing "
              "from image 1 below the chin")
KLEIN_P1_REF_BODY = (
    "The character from image 1, in exactly the same visual style and medium as image 1. The face, head and hair come "
    "only from image 1. Image 2 shows the character's body with its head removed: the portrait "
    + BELOW_CHIN.format(n=2) + ". " + CP)
KLEIN_P2_REF = ("The character from image 1, in exactly the same visual style and medium as image 1. The face, head and "
                "hair come only from image 1. The grey background and the lighting are exactly those of image 2. " + CP)
# batch 19: picture 1 as a pass-2 ref still dressed the body views in picture 1's clothes, so with a body
# pass 2 sees only the portrait (image 1, already in the body's clothes) and the body (image 2)
KLEIN_P2_REF_BODY = (
    "The character from image 1, in exactly the same visual style and medium as image 1. The face, head and hair come "
    "only from image 1, and so do the grey background and the lighting. The body, build, skin and clothing come from "
    "image 2, which shows that body with its head removed: give that body the head from image 1, with the same body "
    "shape, weight and proportions as image 2. The character " + BELOW_CHIN.format(n=2) + ". " + CP)
KLEIN_P2_LAYOUT = (
    "A single continuous image containing two full-body standing views of the same character side by side, of equal "
    "width, one seen from the front and one from directly behind, the grey background flowing continuously behind both, "
    "the same character in both views with identical face, hair and wardrobe, arms hanging loose and relaxed at the "
    "sides, hands open and resting against the thighs, feet planted, generous headroom. Plain smooth grey seamless "
    "studio background. Extremely even frontal illumination, soft open shadows, uniform brightness from edge to edge.")

best = json.load(open(os.path.join(HERE, 'qwen_spec_best.json'), encoding='utf-8'))
Q_HEAD = ("Character reference sheet of the character from image 1, in exactly the same visual style and medium as "
          "image 1. The face, head and hair come only from image 1. ")
assert all(r['prompt'].startswith(Q_HEAD) for r in best), 'qwen_spec_best.json no longer starts with Q_HEAD'
Q_COPY, Q_TURN = (r['prompt'][len(Q_HEAD):] for r in best)  # [0] copy (batch 14b), [1] turn (batch 15)
# batch 18: naming piercings and tattoos makes the model ADD them to a face that has none
Q_NAMED = "with the same face, features, piercings, tattoos and expression as image 1,"
assert Q_NAMED in Q_TURN
Q_TURN = Q_TURN.replace(Q_NAMED, "with the same face, features and expression as image 1, nothing added that image 1 does not show,")
Q_REF = Q_HEAD + CP
Q_REF_BODY = (Q_HEAD + "The body, build, skin and clothing come from image 2, which shows that body with its head "
              "removed: give that body the head from image 1, with the same body shape, weight and proportions as image "
              "2. In every view, the portrait included, the character " + BELOW_CHIN.format(n=2) + ". " + CP)

NSFW_WORDS = ("nude, naked, tits, breasts, pussy, ass, slut, cunt, vagina, nipples, asshole, sex, fuck, fucking, pubic "
              "hair, anus, vulva")  # the app's Klein list, klein_t2i_template.json #43

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
            + ("Two samplings: pass 1 = the portrait alone (896x1120; + the body as ref 2 when loaded), pass 2 = the "
               "two body views (896x1120) with picture 1 + the portrait as references - the portrait + the body when "
               "a body is loaded - stitched [bodies | portrait]. ~48 s warm, ~70 s with a body."
               if model == 'Klein 9B' else
               "One sampling of the whole 1792x1120 sheet, euler/simple 25 steps. ~65 s warm. Research licence: the "
               "images cannot be used commercially.")
            + "\n\nWith a body, ALSO put the clothing caption in Input_Positive (the app asks its describer on picture "
              "2: \"Describe only the clothing this person wears below the neck, as one short phrase ... If the person "
              "wears no clothing, reply exactly: no clothing.\"), e.g. \"Below the chin the character wears a white tank "
              "top and gray jeans, in every view.\" or \"Below the chin the character is nude, in every view.\" "
              "Without it the portrait keeps picture 1's clothes (validation.md batches 18-23). Klein: \"nude\" (or "
              "any NSFW trigger word in Input_Positive) switches the NSFW LoRA on, as in the app's Klein workflow.")
    if FLOW:
        note = (f"MPI-1042 Character Sheet from Images - the {model} arm (generated by build_bench_v2.py --flow).\n\n"
                "The app fills: Input_Image (face), Input_Box (the box step, 4:5), Input_Image_2 (body, optional), "
                "Input_Positive (the user's words), Input_Seed, and the describer's answers before the run - "
                "Input_Face_Pose (FRONT / TURNED, asked on the boxed face) and Input_Body_Clothes (the body's "
                "clothes, or 'no clothing').")
    g.n("note", "Note", [note], [], [], (-560, -700), (500, 560), props={})
    g.n("img1", "MpiLoadImage", ["None", "alpha", True, "", "image"], LOAD_INS, LOAD_OUTS, (0, 0), (300, 450), "Input_Image", MPI)
    if not FLOW:
        g.n("turned", "MpiSimpleBoolean", [False], [], [("boolean", "BOOLEAN")], (0, -160), (300, 60), "Input_Face_Turned", MPI)
    g.n("seed", "MpiInt", [42], [], [("int", "INT")], (0, -280), (300, 60), "Input_Seed", MPI)
    if not FLOW:
        g.text("user", "", "Input_Positive", (0, -560), (300, 160))
    else:
        # The box step's rect (top-left, source px). Widened to 4:5 round its centre - the portrait panel's shape,
        # or Klein's copy stretches (runs 1-3) - so a box an agent measured at any shape still lands 4:5. The
        # step's own box is locked to 4:5 already, so there the fit changes nothing. No box (0 x 0) = the whole
        # picture: MpiBoxCrop passes an empty box through.
        g.n("box", "MpiBox", [0, 0, 0, 0], [], [("mpi_box", "MPI_BOX")], (-380, 480), (300, 130), "Input_Box", MPI)
        g.n("boxv", "MpiFromBox", None, [("mpi_box", "MPI_BOX")], [("width", "INT"), ("height", "INT"), ("x", "INT"), ("y", "INT")],
            (-380, 650), (220, 120), props=MPI)
        math_ins = [("a", "*"), ("b", "*"), ("c", "*")]
        for i, (key, expr, title) in enumerate([("fw", "a if a * 5 >= b * 4 else (b * 4 + 2) // 5", "4:5 width"),
                                                ("fh", "b if b * 4 >= a * 5 else (a * 5 + 2) // 4", "4:5 height"),
                                                ("fx", "a - (b - c) // 2", "4:5 x"), ("fy", "a - (b - c) // 2", "4:5 y")]):
            g.n(key, "MpiMath", [expr], math_ins, [("result", "*")], (-120, 800 + 120 * i), (260, 100), title, MPI)
        for a, b, c, d in [("box", "mpi_box", "boxv", "mpi_box"), ("boxv", "width", "fw", "a"), ("boxv", "height", "fw", "b"),
                           ("boxv", "width", "fh", "a"), ("boxv", "height", "fh", "b"),
                           ("boxv", "x", "fx", "a"), ("fw", "result", "fx", "b"), ("boxv", "width", "fx", "c"),
                           ("boxv", "y", "fy", "a"), ("fh", "result", "fy", "b"), ("boxv", "height", "fy", "c")]:
            g.l(a, b, c, d)
        g.n("box45", "MpiBox", [512, 512, 0, 0], [("width", "INT", True), ("height", "INT", True), ("x", "INT", True), ("y", "INT", True)],
            [("mpi_box", "MPI_BOX")], (160, 480), (260, 130), "face box widened to 4:5", MPI)
        g.n("face", "MpiBoxCrop", [True], [("image", "IMAGE"), ("mpi_box", "MPI_BOX")], [("image", "IMAGE"), ("mpi_box", "MPI_BOX")],
            (160, 650), (260, 80), "picture 1 cut to the face box", MPI)
        for a, b, c, d in [("fw", "result", "box45", "width"), ("fh", "result", "box45", "height"), ("fx", "result", "box45", "x"),
                           ("fy", "result", "box45", "y"), ("img1", "image", "face", "image"), ("box45", "mpi_box", "face", "mpi_box")]:
            g.l(a, b, c, d)
        # The describer's FRONT / TURNED on the boxed face (batch 14a) picks copy vs three-quarter wording.
        g.n("pose", "MpiText", [""], [], [("Text", "STRING")], (-380, -160), (300, 100), "Input_Face_Pose", MPI)
        g.n("turned", "MpiTextContains", ["turned"], [("text", "STRING")], [("boolean", "BOOLEAN")], (-60, -160), (240, 80),
            "face already turned?", MPI)
        g.l("pose", "Text", "turned", "text")
        # The body's clothes as the describer named them -> the caption ahead of the user's words (batches 21-23).
        # "nude" is deliberate: it is on the Klein NSFW LoRA's trigger list, "unclothed" is not.
        g.n("user_raw", "MpiText", [""], [], [("Text", "STRING")], (-380, -560), (300, 160), "Input_Positive", MPI)
        g.n("clothes", "MpiText", [""], [], [("Text", "STRING")], (-380, -900), (300, 100), "Input_Body_Clothes", MPI)
        g.n("cl_dot", "StringReplace", ["", ".", ""], [("string", "STRING", True)], [("STRING", "STRING")], (-60, -900), (240, 120))
        g.n("cl_low", "CaseConverter", ["", "lowercase"], [("string", "STRING", True)], [("STRING", "STRING")], (-60, -760), (240, 80))
        g.n("cl_trim", "StringTrim", ["", "Both"], [("string", "STRING", True)], [("STRING", "STRING")], (-60, -660), (240, 80))
        g.n("cl_wear", "StringConcatenate", ["Below the chin the character wears", "", " "],
            [("string_b", "STRING", True)], [("STRING", "STRING")], (200, -900), (300, 120))
        g.n("cl_view", "StringConcatenate", ["", "in every view.", ", "],
            [("string_a", "STRING", True)], [("STRING", "STRING")], (200, -760), (300, 120))
        g.text("cl_nude", "Below the chin the character is nude, in every view.", "caption: no clothing", (200, -620), (300, 100))
        g.n("cl_isnude", "MpiTextContains", ["no clothing"], [("text", "STRING")], [("boolean", "BOOLEAN")], (200, -500), (240, 80), props=MPI)
        g.ifelse("cl_pick", "caption: nude or dressed", (540, -900))
        g.text("cl_none", "", "caption: no body picture", (540, -780), (240, 80))
        g.ifelse("cl_body", "caption only with a body", (540, -660))
        g.n("cl_join", "StringConcatenate", ["", "", " "], [("string_a", "STRING", True), ("string_b", "STRING", True)],
            [("STRING", "STRING")], (800, -900), (300, 120), "caption + the user's words")
        g.n("user", "StringTrim", ["", "Both"], [("string", "STRING", True)], [("STRING", "STRING")], (800, -740), (240, 80), "user text")
        for a, b, c, d in [("clothes", "Text", "cl_dot", "string"), ("cl_dot", "STRING", "cl_low", "string"),
                           ("cl_low", "STRING", "cl_trim", "string"), ("cl_trim", "STRING", "cl_wear", "string_b"),
                           ("cl_wear", "STRING", "cl_view", "string_a"), ("cl_trim", "STRING", "cl_isnude", "text"),
                           ("cl_nude", "STRING", "cl_pick", "true"), ("cl_view", "STRING", "cl_pick", "false"),
                           ("cl_isnude", "boolean", "cl_pick", "boolean"),
                           ("cl_pick", "output", "cl_body", "true"), ("cl_none", "STRING", "cl_body", "false"),
                           ("cl_body", "output", "cl_join", "string_a"), ("user_raw", "Text", "cl_join", "string_b"),
                           ("cl_join", "STRING", "user", "string")]:
            g.l(a, b, c, d)

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
    for a, b, c, d in [("img2", "image", "detect", "image"), ("sam", "MODEL", "detect", "model"), ("sam", "CLIP", "vocab", "clip"),
                       ("vocab", "CONDITIONING", "detect", "conditioning"), ("detect", "masks", "holes", "mask"),
                       ("holes", "mask", "grow", "mask"), ("img2", "image", "corner", "image"), ("corner", "image", "plate", "image"),
                       ("img2", "width", "plate", "width"), ("img2", "height", "plate", "height"),
                       ("img2", "image", "fill", "destination"), ("plate", "IMAGE", "fill", "source"), ("grow", "MASK", "fill", "mask"),
                       ("fill", "IMAGE", "vram", "passthrough")]:
        g.l(a, b, c, d)
    if FLOW:
        g.l("img2", "loaded", "cl_body", "boolean")
    else:
        g.ifelse("dbg_sw", "debug: body only when loaded", (1720, Y2 + 200))
        g.n("dbg", "PreviewImage", None, [("images", "IMAGE")], [], (2000, Y2 + 120), (360, 420), "Debug: body sent to the model")
        for a, b, c, d in [("vram", "passthrough", "dbg_sw", "true"), ("img2", "image", "dbg_sw", "false"),
                           ("img2", "loaded", "dbg_sw", "boolean"), ("dbg_sw", "output", "dbg", "images")]:
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
    # In the app an Output_* title is a capture contract: `Output_prompt` is the prompt the card records
    # (commandExecutor, MPI-242) - the sheet's, on both arms - so Klein's portrait prompt is a plain preview.
    g.n(key + "_show", "PreviewAny", [], [("source", "*")], [("STRING", "STRING")], (x + 760, y + 340), (380, 360),
        "Output_" + title if not FLOW else "Output_prompt" if title == "Sheet_Prompt" else "debug: " + title)
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
    # Fabio: base Klein does not draw bare skin - the app's Klein workflow switches its NSFW LoRA on by words in
    # the user's text (klein_t2i_template.json #43 -> #44 -> #38); same switch here, so a "nude" caption fires it
    g.n("nsfw_words", "MpiTextContains", [NSFW_WORDS], [("text", "STRING")], [("boolean", "BOOLEAN")], (X, -760), (340, 120),
        "NSFW trigger words (user text)", MPI)
    g.n("nsfw_on", "MpiMath", ["1.0 if a else 0.0"], [("a", "*"), ("b", "*"), ("c", "*")], [("result", "*")], (X + 380, -760), (240, 100), props=MPI)
    g.n("nsfw", "LoraLoaderModelOnly", ["flux2-klein\\NSFW_party_time_v2.0_klein9b.safetensors", 1.0],
        [("model", "MODEL"), ("strength_model", "FLOAT", True)], [("MODEL", "MODEL")], (X + 380, -620), (340, 82), "NSFW LoRA")
    for a, b, c, d in [("user", "STRING", "nsfw_words", "text"), ("nsfw_words", "boolean", "nsfw_on", "a"),
                       ("nsfw_on", "result", "nsfw", "strength_model"), ("unet", "MODEL", "nsfw", "model")]:
        g.l(a, b, c, d)
    g.n("noise", "RandomNoise", [0, "fixed"], [("noise_seed", "INT", True)], [("NOISE", "NOISE")], (X, -460), (300, 90))
    g.n("sampler", "KSamplerSelect", ["lcm"], [], [("SAMPLER", "SAMPLER")], (X + 340, -460), (300, 60))
    g.n("w", "MpiInt", [896], [], [("int", "INT")], (X + 680, -460), (210, 60), "W_panel", MPI)
    g.n("h", "MpiInt", [1120], [], [("int", "INT")], (X + 680, -380), (210, 60), "H_panel", MPI)
    for a, b, c, d in [(*FACE, "scale1", "image"), ("scale1", "IMAGE", "enc1", "pixels"), ("vae", "VAE", "enc1", "vae"),
                       ("vram", "passthrough", "scale2", "image"), ("scale2", "IMAGE", "enc2", "pixels"), ("vae", "VAE", "enc2", "vae"),
                       ("seed", "int", "noise", "noise_seed")]:
        g.l(a, b, c, d)

    prompt(g, "p1", KLEIN_P1_REF, KLEIN_P1_REF_BODY, KLEIN_P1_COPY, KLEIN_P1_TURN, "Portrait_Prompt", (X, Y))
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
        g.l("nsfw", "MODEL", p + "_guider", "model"); g.l(positive[0], positive[1], p + "_guider", "positive")
        g.l(p + "_zero", "CONDITIONING", p + "_guider", "negative")
        for wh in ("_sched", "_latent"):
            g.l("w", "int", p + wh, "width"); g.l("h", "int", p + wh, "height")
        for a, b, c in [("noise", "NOISE", "noise"), (p + "_guider", "GUIDER", "guider"), ("sampler", "SAMPLER", "sampler"),
                        (p + "_sched", "SIGMAS", "sigmas"), (p + "_latent", "LATENT", "latent_image")]:
            g.l(a, b, p + "_sca", c)
        g.l(p + "_sca", "output", p + "_dec", "samples"); g.l("vae", "VAE", p + "_dec", "vae")

    # pass 1: the portrait alone - only there does Klein copy picture 1 unsqueezed and keep (or take) the turn;
    # ref 2 = the body when loaded, so the portrait's shoulders wear the body's clothes (batch 18)
    SX = X + 2700
    last1 = sample("p1", SX, -900, [(("enc1", "LATENT"), "picture 1"), (("enc2", "LATENT"), "body")])
    g.ifelse("cond1_sw", "Pass1_Conditioning (has body?)", (SX + 340, -740))
    g.l(last1[0], last1[1], "cond1_sw", "true"); g.l("p1_r1", "CONDITIONING", "cond1_sw", "false"); g.l("img2", "loaded", "cond1_sw", "boolean")
    finish("p1", SX + 700, -900, ("cond1_sw", "output"))
    # pass 2: the body views, the finished portrait as ref 2 so the grey and light match; ref 3 = the body when loaded
    g.n("encp", "VAEEncode", None, [("pixels", "IMAGE"), ("vae", "VAE")], [("LATENT", "LATENT")], (SX + 1100, -500), (200, 50), "Encode portrait")
    g.l("p1_dec", "IMAGE", "encp", "pixels"); g.l("vae", "VAE", "encp", "vae")
    last = sample("p2", SX, -200, [(("enc1", "LATENT"), "picture 1"), (("encp", "LATENT"), "portrait")])
    prev = ("p2_text", "CONDITIONING")
    for i, (lat, label) in enumerate([("encp", "portrait"), ("enc2", "body")], 1):
        g.n(f"p2b_r{i}", "ReferenceLatent", None, [("conditioning", "CONDITIONING"), ("latent", "LATENT")],
            [("CONDITIONING", "CONDITIONING")], (SX + 340, -20 + 80 * i), (240, 50), f"p2 (body) ref {i} = {label}")
        g.l(prev[0], prev[1], f"p2b_r{i}", "conditioning"); g.l(lat, "LATENT", f"p2b_r{i}", "latent")
        prev = (f"p2b_r{i}", "CONDITIONING")
    g.ifelse("cond_sw", "Pass2_Conditioning (has body?)", (SX + 340, 220))
    g.l(prev[0], prev[1], "cond_sw", "true"); g.l(last[0], last[1], "cond_sw", "false"); g.l("img2", "loaded", "cond_sw", "boolean")
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
    g.n("clip", "CLIPLoader", [QWEN_CLIP, "qwen_image", "default"], [], [("CLIP", "CLIP")], (X, -170), (340, 106))
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
                       (*FACE, "encode", "images.image_1"), ("ref2", "output", "encode", "images.image_2"),
                       ("p_rep", "STRING", "encode", "prompt"), ("w", "int", "latent", "width"), ("h", "int", "latent", "height"),
                       ("cache", "MODEL", "ks", "model"), ("encode", "positive", "ks", "positive"), ("encode", "negative", "ks", "negative"),
                       ("latent", "LATENT", "ks", "latent_image"), ("seed", "int", "ks", "seed"),
                       ("ks", "LATENT", "dec", "samples"), ("vae", "VAE", "dec", "vae"), ("dec", "IMAGE", "rgb", "image"),
                       ("rgb", "IMAGE", "vram_end", "passthrough"), ("vram_end", "passthrough", "out", "images")]:
        g.l(a, b, c, d)
    return g


if FLOW:  # Qwen is the Flow's recommended arm (models[0]), so it owns the plain name; Klein is the `byModel` file
    klein().save(os.path.join(OUT, "flow_character_sheet_from_images_klein.json"))
    qwen().save(os.path.join(OUT, "flow_character_sheet_from_images.json"))
else:
    klein().save(os.path.join(OUT, "MPI-1042_character_sheet_v2_klein.json"))
    qwen().save(os.path.join(OUT, "MPI-1042_character_sheet_v2_qwen.json"))
