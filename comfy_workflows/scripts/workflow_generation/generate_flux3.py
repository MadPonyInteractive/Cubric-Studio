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
that would fail silently: wrong weight names, a linked op selector, a lost capture.

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


def build(source_path: Path, out_dir: Path) -> list[Path]:
    if source_path.name != TEMPLATE_NAME:
        print(f"  [WARN] {source_path.name} unknown to the flux3 handler — nothing to do")
        return []
    print(f"Template: {source_path.name}")
    workflow = json.loads(source_path.read_text(encoding="utf-8"))
    _prune_to_captures(workflow)
    _assert_and_bake_wf_type(workflow)
    _bake_turbo(workflow)
    _assert_weights(workflow)
    out_path = out_dir / OUT_NAME
    out_path.write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    print(f"  [OK]   {OUT_NAME} ({len(workflow)} nodes)")
    return [out_path]


if __name__ == "__main__":
    build(SCRIPTS_DIR / TEMPLATE_NAME, WORKFLOWS_DIR)
