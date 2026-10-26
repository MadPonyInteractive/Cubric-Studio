"""
generate_moss.py — MOSS-Image handler (MPI-1243): ONE master template → ONE runtime file.

The raw is a copy of FLUX.3's (MPI-1180) with the t2i loaders and settings swapped, so the op
switch (`Input_wf_type`), the Turbo MpiIfElse (`Input_is_Turbo`: SFT-Turbo 8 steps cfg 1 on true,
SFT 25 steps cfg 2.5 on false) and every capture are FLUX.3's. MOSS has no reference edit, so
none of FLUX.3's edit-frame helpers apply and the app never offers `edit`.

Orchestrated: build(source_path, out_dir) — routed here by the `moss_` prefix.
Standalone:  python generate_moss.py
"""

import json
from pathlib import Path

from generate_klein import CAPTURE_TITLES, WF_TYPE_TITLE, WF_TYPE_MISSING
from generate_flux3 import _bake_turbo
from generate_krea2 import _assert_style_rack
from graph_utils import bake_int, prune_to_captures

SCRIPTS_DIR = Path(__file__).parent
WORKFLOWS_DIR = SCRIPTS_DIR.parent.parent  # comfy_workflows/

OUT_NAME = "moss_t2i.json"
TEMPLATE_NAME = "moss_t2i_template.json"

# Must equal the dep `filename` tails in modelDeps.js / assetDeps.js byte for byte.
UNETS = {"moss_image_sft_turbo_int8_convrot.safetensors",   # Turbo on
         "moss_image_sft_int8_convrot.safetensors"}         # Turbo off
CLIP = ("qwen3.5_9b_w4a8_gptq.safetensors", "moss_image")
VAE = "flux2-vae.safetensors"                               # shared `vae-flux2`


def _assert_weights(workflow: dict) -> None:
    unets = {n["inputs"]["unet_name"] for n in workflow.values() if n["class_type"] == "UNETLoader"}
    clips = [(n["inputs"]["clip_name"], n["inputs"]["type"])
             for n in workflow.values() if n["class_type"] == "CLIPLoader"]
    vaes = {n["inputs"]["vae_name"] for n in workflow.values() if n["class_type"] == "VAELoader"}
    if unets != UNETS or clips != [CLIP] or vaes != {VAE}:
        raise SystemExit(f"[FAIL] loaders are unet {sorted(unets)}, clip {clips}, vae {sorted(vaes)}; "
                         f"expected {sorted(UNETS)}, [{CLIP}], [{VAE}]")


def build(source_path: Path, out_dir: Path) -> list[Path]:
    if source_path.name != TEMPLATE_NAME:
        print(f"  [WARN] {source_path.name} unknown to the moss handler — nothing to do")
        return []
    print(f"Template: {source_path.name}")
    workflow = json.loads(source_path.read_text(encoding="utf-8"))
    prune_to_captures(workflow, CAPTURE_TITLES)
    bake_int(workflow, WF_TYPE_TITLE, 1, "WFTYPE", WF_TYPE_MISSING)
    _bake_turbo(workflow)
    _assert_weights(workflow)
    n_styles = _assert_style_rack(workflow)
    out_path = out_dir / OUT_NAME
    out_path.write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    print(f"  [OK]   {OUT_NAME} ({len(workflow)} nodes, {n_styles} style LoRAs)")
    return [out_path]


if __name__ == "__main__":
    build(SCRIPTS_DIR / TEMPLATE_NAME, WORKFLOWS_DIR)
