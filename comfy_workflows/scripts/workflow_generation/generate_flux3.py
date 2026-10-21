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
one branch the bench lacks: an edit keeps picture 1's own size (`_keep_edit_size`, MPI-1216).

Orchestrated: build(source_path, out_dir) — routed here by the `flux3_` prefix.
Standalone:  python generate_flux3.py

Node lookup is by `_meta.title` (MPI-116 naming law) — never by node id.
"""

import json
from pathlib import Path

from generate_klein import _find_id_by_title, _prune_to_captures, _assert_and_bake_wf_type

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
    nid = _find_id_by_title(workflow, TURBO_TITLE)
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
    custom = _find_id_by_title(workflow, "Input_custom_size")
    image = _find_id_by_title(workflow, "Input_Image")
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


def build(source_path: Path, out_dir: Path) -> list[Path]:
    if source_path.name != TEMPLATE_NAME:
        print(f"  [WARN] {source_path.name} unknown to the flux3 handler — nothing to do")
        return []
    print(f"Template: {source_path.name}")
    workflow = json.loads(source_path.read_text(encoding="utf-8"))
    _prune_to_captures(workflow)
    _assert_and_bake_wf_type(workflow)
    _bake_turbo(workflow)
    _keep_edit_size(workflow)
    _assert_weights(workflow)
    out_path = out_dir / OUT_NAME
    out_path.write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    print(f"  [OK]   {OUT_NAME} ({len(workflow)} nodes)")
    return [out_path]


if __name__ == "__main__":
    build(SCRIPTS_DIR / TEMPLATE_NAME, WORKFLOWS_DIR)
