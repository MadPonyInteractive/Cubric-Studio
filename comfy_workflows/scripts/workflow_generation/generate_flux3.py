"""
generate_flux3.py — FLUX.3 Klein handler (MPI-1181): ONE master template → ONE runtime file.

Klein's shape (generate_klein.py), minus everything Klein bakes per size: FLUX.3 ships one
size, no style rack, no NSFW or depth LoRA (all three are bypassed in the raw and the
converter drops them). Ops are branches selected by the injected `Input_wf_type`
(1 t2i · 2 i2i · 4 edit · 5 inpaint · 6 detail · 7 upscale; 3 was Klein's depth and
routes to t2i here). Turbo is NOT a file axis: `Input_is_Turbo` drives an MpiIfElse
between the two UNETLoaders (distilled on true, base on false) plus steps/cfg, and the
app injects it from the Turbo button on every op.

So this handler bakes only the two defaults the bench left behind and refuses a graph
that would fail silently: wrong weight names, a linked op selector, a lost capture. It adds
two branches the bench lacks (MPI-1216): an edit keeps picture 1's own size (`_keep_edit_size`),
and picture 1 reaches the model at that frame's exact size (`_ref_matches_frame`), and an
edit of one picture is graded back to it (`_grade_back`).

Orchestrated: build(source_path, out_dir) — routed here by the `flux3_` prefix.
Standalone:  python generate_flux3.py

Node lookup is by `_meta.title` (MPI-116 naming law) — never by node id.
"""

import json
from pathlib import Path

from generate_klein import CAPTURE_TITLES, WF_TYPE_TITLE, WF_TYPE_MISSING
from graph_utils import bake_int, find_id_by_title, prune_to_captures

SCRIPTS_DIR = Path(__file__).parent
WORKFLOWS_DIR = SCRIPTS_DIR.parent.parent  # comfy_workflows/

OUT_NAME = "flux3_t2i.json"
TEMPLATE_NAME = "flux3_t2i_template.json"

# Must equal the dep `filename` tails in modelDeps.js / assetDeps.js byte for byte.
UNETS = {"flux3-image-klein-int8-convrot.safetensors",        # distilled = Turbo on
         "flux3-image-klein-base-int8-convrot.safetensors"}   # base = Turbo off
CLIP = ("qwen3vl_4b_abliterated_fp8_scaled.safetensors", "flux3")  # reused engine asset
TURBO_TITLE = "Input_is_Turbo"
# Largest 4K-tier area in models.js (flux3-klein `ratios['4k']`, 1:1 = 2944x2944).
MAX_EDIT_AREA = 2944 * 2944


def _assert_weights(workflow: dict) -> None:
    unets = {n["inputs"]["unet_name"] for n in workflow.values() if n["class_type"] == "UNETLoader"}
    if unets != UNETS:
        raise SystemExit(f"[FAIL] UNETLoaders name {sorted(unets)}, expected {sorted(UNETS)}")
    clips = [(n["inputs"]["clip_name"], n["inputs"]["type"])
             for n in workflow.values() if n["class_type"] == "CLIPLoader"]
    if clips != [CLIP]:
        raise SystemExit(f"[FAIL] CLIPLoader is {clips}, expected [{CLIP}]")


def _bake_turbo(workflow: dict, on: bool = True) -> None:
    """Default Turbo ON (= the button's default). The app injects it on every op, so this
    only shows when injection fails — and then the fast weight is the safer fallback."""
    nid = find_id_by_title(workflow, TURBO_TITLE)
    if nid is None or isinstance(workflow[nid]["inputs"].get("boolean"), list):
        raise SystemExit(f"[FAIL] {TURBO_TITLE} missing or linked — the Turbo button "
                         f"would inject into nothing and every run would use one weight")
    workflow[nid]["inputs"]["boolean"] = on


def _keep_edit_size(workflow: dict) -> None:
    """An edit with Custom size off renders at picture 1's own size (MPI-1216).

    The bench left that latent as the references node's output 2: picture 1 rescaled to exactly
    1 MP, each side floored to /16, so 768x1376 came back 752x1360 and every edit drifted. Now
    that branch is a latent of picture 1's size, each side rounded to /16, shrunk (aspect kept)
    only past MAX_EDIT_AREA. References stay at 1 MP, as on a Custom size edit. A mask still
    takes the references latent: the inpaint path crops and stitches its own frame."""
    custom = find_id_by_title(workflow, "Input_custom_size")
    image = find_id_by_title(workflow, "Input_Image")
    cmp = next((k for k, n in workflow.items() if n["class_type"] == "MpiBooleanCompare"
                and n["inputs"].get("a") == [custom, 0]), None)
    sel = next((k for k, n in workflow.items() if n["class_type"] == "MpiIfElse"
                and n["inputs"].get("boolean") == [cmp, 0]), None)
    if None in (custom, image, cmp, sel):
        raise SystemExit("[FAIL] edit size switch (Input_custom_size -> compare -> If Else) "
                         "not found - edits would go back to the 1 MP resize")
    has_mask = workflow[cmp]["inputs"]["b"]
    refs_latent = workflow[sel]["inputs"]["false"]
    nid = iter(str(i) for i in range(max(map(int, workflow)) + 1, 10**6))
    scale, w, h, latent, pick = (next(nid) for _ in range(5))
    # MpiLoadImage outputs 2/3 are the loaded picture's width/height.
    workflow[scale] = {"inputs": {"a": [image, 2], "b": [image, 3], "math_expression":
                                  f"1 if a*b <= {MAX_EDIT_AREA} else sqrt({MAX_EDIT_AREA}/(a*b))"},
                       "class_type": "MpiMath", "_meta": {"title": "Edit size: scale to 4K cap"}}
    for node, side in ((w, 2), (h, 3)):
        workflow[node] = {"inputs": {"a": [image, side], "b": [scale, 0],
                                     "math_expression": "floor(a*b/16 + 0.5)*16"},
                          "class_type": "MpiMath",
                          "_meta": {"title": f"Edit size: {'width' if side == 2 else 'height'} /16"}}
    workflow[latent] = {"inputs": {"width": [w, 0], "height": [h, 0], "batch_size": 1},
                        "class_type": "EmptyFlux2LatentImage",
                        "_meta": {"title": "Edit size: latent at picture 1's size"}}
    workflow[pick] = {"inputs": {"true": refs_latent, "false": [latent, 0], "boolean": has_mask},
                      "class_type": "MpiIfElse", "_meta": {"title": "Edit size: mask keeps refs latent"}}
    workflow[sel]["inputs"]["false"] = [pick, 0]


def _ref_matches_frame(workflow: dict) -> None:
    """An unmasked edit hands picture 1 to the model at the output frame's exact size (MPI-1216).

    The references node scaled every picture to 1 MP, rounding each side, so picture 1 no longer
    lined up with the output: chained edits crept off by a few pixels each time, and a Custom
    size frame of 2 MP re-drew the scene (Cosmo's 8:5 2K run lost the tiger and dog). Now
    picture 1 is resized (centre-cropped to a new ratio) to the frame the latent is built from
    — Input_Width/Height on Custom size, else `_keep_edit_size`'s picture-1 size — and the node
    keeps every reference as it comes. A Custom size of another ratio (over 2% off) still hands
    picture 1 over at 1 MP: there the model reframes the whole scene, where a crop would cut it.
    Pictures 2-10 get the node's old 1 MP scale in the graph; a blank slot (1x1) stays 1x1 so
    the node still drops it. A mask keeps its own crop. Price: a big photo's edit takes ~2.5x as
    long (picture 1 at up to 8.6 MP beside an 8.6 MP latent), for its composition and detail."""
    refs = next((k for k, n in workflow.items() if n["class_type"] == "MpiFlux3References"), None)
    custom_latent = next((k for k, n in workflow.items() if n["class_type"] == "MpiBooleanCompare"
                          and n["inputs"].get("mode") == "a_true_b_false"), None)
    ids = {t: find_id_by_title(workflow, t) for t in (
        "Input_Image", "Input_Width", "Input_Height", "Edit size: width /16", "Edit size: height /16")}
    if refs is None or custom_latent is None or None in ids.values():
        raise SystemExit("[FAIL] references / edit-size nodes not found - picture 1 would go "
                         "back to 1 MP and chained edits would drift")
    ref0 = workflow[refs]["inputs"]["ref_image_0"]
    switch = workflow[ref0[0]]
    if switch["class_type"] != "MpiIfElse" or switch["inputs"]["false"] != [ids["Input_Image"], 0]:
        raise SystemExit("[FAIL] ref_image_0 is not the mask switch (crop | Input_Image)")
    nid = iter(str(i) for i in range(max(map(int, workflow)) + 1, 10**6))
    fw, fh, fit, aspect, same, reframe, s1, one_mp, pick = (next(nid) for _ in range(9))
    for node, side in ((fw, "Width"), (fh, "Height")):
        workflow[node] = {"inputs": {"true": [ids[f"Input_{side}"], 0],
                                     "false": [ids[f"Edit size: {side.lower()} /16"], 0],
                                     "boolean": [custom_latent, 0]},
                          "class_type": "MpiIfElse", "_meta": {"title": f"Edit frame: {side.lower()}"}}
    workflow[fit] = {"inputs": {"upscale_method": "lanczos", "keep_proportion": "crop",
                                "pad_color": "0, 0, 0", "crop_position": "center", "divisible_by": 16,
                                "device": "cpu", "image": [ids["Input_Image"], 0],
                                "width": [fw, 0], "height": [fh, 0]},
                     "class_type": "MpiImageResize", "_meta": {"title": "Edit frame: picture 1 at frame size"}}
    # A Custom size frame of ANOTHER ratio is a reframe: cropping picture 1 to it would cut the
    # scene, so that one run keeps the old 1 MP reference and the model re-lays the frame.
    image = [ids["Input_Image"], 0]
    workflow[aspect] = {"inputs": {"a": [ids["Input_Image"], 2], "b": [ids["Input_Image"], 3],
                                   "math_expression": "a/b"},
                        "class_type": "MpiMath", "_meta": {"title": "Edit frame: picture 1 ratio"}}
    workflow[same] = {"inputs": {"a": [aspect, 0], "b": [ids["Input_Width"], 0], "c": [ids["Input_Height"], 0],
                                 "math_expression": "fabs(a - b/c) < 0.02*a"},
                      "class_type": "MpiMath", "_meta": {"title": "Edit frame: custom keeps the ratio"}}
    workflow[reframe] = {"inputs": {"mode": "a_true_b_false", "a": [custom_latent, 0], "b": [same, 0]},
                         "class_type": "MpiBooleanCompare", "_meta": {"title": "Edit frame: reframe"}}
    workflow[s1] = {"inputs": {"a": [ids["Input_Image"], 2], "b": [ids["Input_Image"], 3],
                               "math_expression": "sqrt(1048576/(a*b))"},
                    "class_type": "MpiMath", "_meta": {"title": "Edit frame: 1 MP scale"}}
    workflow[one_mp] = {"inputs": {"image": image, "upscale_method": "lanczos", "scale_by": [s1, 0]},
                        "class_type": "ImageScaleBy", "_meta": {"title": "Edit frame: picture 1 at 1 MP"}}
    workflow[pick] = {"inputs": {"true": [one_mp, 0], "false": [fit, 0], "boolean": [reframe, 0]},
                      "class_type": "MpiIfElse", "_meta": {"title": "Edit frame: reframe keeps 1 MP"}}
    switch["inputs"]["false"] = [pick, 0]
    workflow[refs]["inputs"]["resolution"] = "keep resolution"
    for slot in range(1, 10):
        loader = workflow[refs]["inputs"].get(f"ref_image_{slot}")
        if not loader or workflow[loader[0]]["class_type"] != "MpiLoadImage":
            raise SystemExit(f"[FAIL] ref_image_{slot} is not an MpiLoadImage")
        scale, img = next(nid), next(nid)
        # MpiMath has no min(): ImageScaleBy tops out at x8, so a tiny picture stops there.
        workflow[scale] = {"inputs": {"a": [loader[0], 2], "b": [loader[0], 3], "math_expression":
                                      "1.0 if a*b <= 1 else (8.0 if a*b*64 < 1048576 "
                                      "else sqrt(1048576/(a*b)))"},
                           "class_type": "MpiMath", "_meta": {"title": f"Reference {slot + 1}: 1 MP scale"}}
        workflow[img] = {"inputs": {"image": loader, "upscale_method": "lanczos", "scale_by": [scale, 0]},
                         "class_type": "ImageScaleBy", "_meta": {"title": f"Reference {slot + 1}: at 1 MP"}}
        workflow[refs]["inputs"][f"ref_image_{slot}"] = [img, 0]


def _grade_back(workflow: dict) -> None:
    """An edit of ONE picture is graded back to it (MPI-1216).

    FLUX.3 re-renders every pixel and each pass runs a touch warmer and more saturated (Turbo
    "change nothing" x3: 3.3 dE off picture 1; base 1.4, chroma +60%), so chained edits drift. No
    prompt clause moved it. MpiGradeBack fits a gain + offset over the whole frame without what the
    edit changed and applies it (0.2 s at 1 MP). Off for a reference composition (picture 2 present),
    a Custom size reframe (the pixels no longer line up) and a masked edit (its own composite)."""
    mask = find_id_by_title(workflow, "Input_Mask")
    ids = {t: find_id_by_title(workflow, t) for t in ("Input_Image", "Input_Image_2", "Edit frame: reframe")}
    sel = next((k for k, n in workflow.items() if n["class_type"] == "MpiIfElse"
                and n["inputs"].get("boolean") == [mask, 4]
                and workflow[n["inputs"]["false"][0]]["class_type"] == "VAEDecode"), None)
    if sel is None or None in ids.values():
        raise SystemExit("[FAIL] unmasked edit decode / picture slots not found - chained edits would drift")
    nid = iter(str(i) for i in range(max(map(int, workflow)) + 1, 10**6))
    gate, grade = next(nid), next(nid)
    # A blank picture slot loads as 1x1 (outputs 2/3 are width/height).
    workflow[gate] = {"inputs": {"a": [ids["Input_Image_2"], 2], "b": [ids["Input_Image_2"], 3],
                                 "c": [ids["Edit frame: reframe"], 0],
                                 "math_expression": "False if c else a*b <= 1"},
                      "class_type": "MpiMath", "_meta": {"title": "Edit grade: one picture, same frame"}}
    workflow[grade] = {"inputs": {"original": [ids["Input_Image"], 0], "edited": workflow[sel]["inputs"]["false"],
                                  "enabled": [gate, 0], "max_shift": 4.0},
                       "class_type": "MpiGradeBack", "_meta": {"title": "Edit grade: back to picture 1"}}
    workflow[sel]["inputs"]["false"] = [grade, 0]


def build(source_path: Path, out_dir: Path) -> list[Path]:
    if source_path.name != TEMPLATE_NAME:
        print(f"  [WARN] {source_path.name} unknown to the flux3 handler — nothing to do")
        return []
    print(f"Template: {source_path.name}")
    workflow = json.loads(source_path.read_text(encoding="utf-8"))
    prune_to_captures(workflow, CAPTURE_TITLES)
    bake_int(workflow, WF_TYPE_TITLE, 1, "WFTYPE", WF_TYPE_MISSING)
    _bake_turbo(workflow)
    _keep_edit_size(workflow)
    _ref_matches_frame(workflow)
    _grade_back(workflow)
    _assert_weights(workflow)
    out_path = out_dir / OUT_NAME
    out_path.write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    print(f"  [OK]   {OUT_NAME} ({len(workflow)} nodes)")
    return [out_path]


if __name__ == "__main__":
    build(SCRIPTS_DIR / TEMPLATE_NAME, WORKFLOWS_DIR)
