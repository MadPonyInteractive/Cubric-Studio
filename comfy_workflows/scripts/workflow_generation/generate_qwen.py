"""
generate_qwen.py
Qwen-Image-Edit-2511 handler: one template → ONE runtime file.

Unlike Boogu (which bakes a different UNET + a fixed Input_Tier per tier file),
Qwen-Edit uses the SAME int8 transformer for every tier — the only thing that
changes per tier is which accelerator Lightning LoRA the graph's MpiAnySwitch
picks, and that switch is driven by `Input_Tier`, which the app INJECTS AT
RUNTIME via the `qwenTier` prompt-box radio (Quality=1 raw / Turbo=2 8-step /
Hyper=3 4-step). So there is no per-tier file and no tier bake here — one card,
one workflow, tier chosen at submit time.

MPI-365: the template became a THREE-op master graph — 1 edit / 2 depth / 3 pose,
selected by `Input_wf_type` (injected by the app's opInject). Depth and pose are new and
bring `comfyui_controlnet_aux` with them (AIO_Preprocessor + OpenposePreprocessor); there
is NO ControlNet checkpoint, the maps feed Qwen's own image conditioning.

This handler strips the authoring bench (A/B comparers, per-tier PreviewImage taps,
leftover scaffolding) that ComfyUI would still validate at prompt time, bakes a safe
Input_wf_type default, and emits the single runtime graph.

Input_Image is REQUIRED (an edit needs a source) → no placeholder stamping.

Standalone:  python generate_qwen.py
Orchestrated: build(source_path, out_dir)

Node lookup is by `_meta.title` — never by node id (ids change on every re-export).
"""

import json
import copy
from pathlib import Path
from graph_utils import bake_int, find_id_by_title, prune_to_captures

# template filename → runtime output name
MODEL_VARIANTS = {
    "qwen_edit_template.json": "qwen_edit.json",
}

CAPTURE_TITLE = "Output_Image"
# MPI-365: the branch selector (1 edit / 2 depth / 3 pose). Fatal if absent — see
# graph_utils.bake_int.
WF_TYPE_TITLE = "Input_wf_type"
SCRIPTS_DIR = Path(__file__).parent
WORKFLOWS_DIR = SCRIPTS_DIR.parent.parent  # comfy_workflows/


def _generate_one(template_path: Path, output_name: str, out_dir: Path) -> Path | None:
    workflow = copy.deepcopy(json.loads(template_path.read_text(encoding="utf-8")))

    if find_id_by_title(workflow, CAPTURE_TITLE) is None:
        print(f"  [WARN] No '{CAPTURE_TITLE}' node in {template_path.name} — skipping {output_name}")
        return None

    prune_to_captures(workflow, (CAPTURE_TITLE,))
    # After the prune, so the bake also proves the selector is upstream of the output.
    # The authoring graph bakes 3 (pose), the least obvious wrong branch to spot.
    bake_int(workflow, WF_TYPE_TITLE, 1, "WFTYPE",
             "it drives every op (1 edit / 2 depth / 3 pose); without it every op "
             "runs the baked default")

    out_path = out_dir / output_name
    out_path.write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    print(f"  [OK]   {output_name}")
    return out_path


def build(source_path: Path, out_dir: Path) -> list[Path]:
    """Orchestrator entry. Build the ONE runtime file for the template."""
    output_name = MODEL_VARIANTS.get(source_path.name)
    if output_name is None:
        print(f"  [WARN] {source_path.name} not in MODEL_VARIANTS — nothing to do")
        return []
    print(f"Template: {source_path.name}")
    p = _generate_one(source_path, output_name, out_dir)
    return [p] if p is not None else []


def main() -> None:
    """Standalone: rebuild the Qwen template from files alongside this script."""
    for template_name in MODEL_VARIANTS:
        template_path = SCRIPTS_DIR / template_name
        if not template_path.exists():
            template_path = WORKFLOWS_DIR / template_name
        if not template_path.exists():
            print(f"\n[SKIP] Template not found: {template_name}")
            continue
        print()
        build(template_path, WORKFLOWS_DIR)
    print("\nDone.")


if __name__ == "__main__":
    main()
