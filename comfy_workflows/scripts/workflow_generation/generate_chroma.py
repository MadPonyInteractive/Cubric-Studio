"""
generate_chroma.py — Chroma handler: ONE master template → ONE runtime file PER TIER.

Rewritten for MPI-365. Chroma used to spread its ops over six raw files (a t2i, a
detailer and an upscaler, each duplicated for Flash and Hyper). It now ships ONE graph
whose branch is chosen by the injected `Input_wf_type` int:

    1 = t2i    2 = i2i    3 = depth    4 = ---    5 = ---    6 = detail    7 = upscale

4 and 5 are deliberately dead so the numbering matches Klein and Krea2 — a shared op must
never mean a different branch depending on which model is selected. Lazy evaluation prunes
the unselected branches at RUN time, so carrying every op in one file costs nothing.

WHY A FILE PER TIER, when the branch axis is a runtime injection.
Flash and Hyper are two SEPARATE checkpoints (17GB bf16 vs 9.2GB int8), not one weight
plus an accelerator LoRA the way Krea2's turbo works. Both live on their own ModelDef with
their own `dependencies`, so a user installs one or the other. A single graph holding two
loaders would force BOTH downloads: ComfyUI validates every combo widget at submit time
even on a lazily-skipped branch (`execution.py` -> "value_not_in_list"), so the absent
weight fails the whole prompt. Baking the loader per output file is what keeps the two
cards independently installable — the same trade `generate_boogu.py` makes.

    chroma_t2i_template.json -> chroma_t2i.json        (tier 2, Flash)
                             -> chroma_hyper_t2i.json  (tier 3, Hyper)

Tier 1 (High) is reserved, not shipped: the full Chroma weight was tested and rejected in
MPI-217 for bad LoRA adherence and speed. The graph's own Tiers note documents the slot.

Orchestrated: build(source_path, out_dir) — routed by the `chroma_` prefix (registry.py).
Standalone:  python generate_chroma.py

Node lookup is by `_meta.title` (MPI-116 naming law) — never by node id. The one exception
is the model loader, which is untitled in the graph; see `_assert_and_bake_model`.
"""

import copy
import json
from pathlib import Path

# The style rack is the NODE PACK's contract (MpiStyleSelector + MpiStyleLoras banks of
# five), shared with Krea2 and Klein — reuse the assert rather than fork it.
from generate_krea2 import _assert_style_rack
from graph_utils import bake_int, prune_to_captures

SCRIPTS_DIR = Path(__file__).parent
WORKFLOWS_DIR = SCRIPTS_DIR.parent.parent  # comfy_workflows/

# template filename -> list of (output_name, tier_int, model_name)
# The model_name values MUST match the `chroma1-hd-flash` / `chroma1-hd-hyper` dep
# filenames in modelDeps.js. A mismatch is invisible until a user installs: the app
# downloads the dep it declares and ComfyUI then cannot find the name baked here.
MODEL_VARIANTS = {
    "chroma_t2i_template.json": [
        ("chroma_t2i.json", 2, "Chroma1-HD-Flash.safetensors"),
        ("chroma_hyper_t2i.json", 3,
         "Chroma1-HD-DanrisiMix-Hyper-Flash-Turbo-int8-convrot-simple.safetensors"),
    ],
}

# Chroma has NO prompt enhancer, so no `Output_prompt` to preserve — unlike Klein, whose
# handler must keep both captures. Adding an enhancer later means adding its title here.
CAPTURE_TITLES = ("Output_Image",)

WF_TYPE_TITLE = "Input_wf_type"
TIER_TITLE = "Input_Tier"
# RES4LYF's combined model+CLIP loader, not a stock UNETLoader — Chroma needs the
# ReChroma patch path. The diffusion weight is its `model_name` input.
MODEL_LOADER_CLASS = "ClownModelLoader"
MODEL_NAME_INPUT = "model_name"


def _assert_and_bake_model(workflow: dict, model_name: str) -> None:
    """Bake this tier's diffusion weight into the loader.

    Looked up by CLASS, not by title: the loader is untitled in the graph, so its
    `_meta.title` is just the class name and titling it would be a naming-law fiction.
    Exactly one must exist — a second loader would mean a second weight the ModelDef does
    not declare, which downloads fine on the bench and 'value_not_in_list' fails on a user
    machine that only installed one tier.
    """
    hits = [nid for nid, nd in workflow.items()
            if isinstance(nd, dict) and nd.get("class_type") == MODEL_LOADER_CLASS]
    if len(hits) != 1:
        raise SystemExit(f"[FAIL] {len(hits)} {MODEL_LOADER_CLASS} node(s), expected exactly 1 "
                         f"— each tier ships ONE checkpoint, baked per output file")
    node = workflow[hits[0]]
    if isinstance(node["inputs"].get(MODEL_NAME_INPUT), list):
        raise SystemExit(f"[FAIL] {MODEL_LOADER_CLASS}.{MODEL_NAME_INPUT} is linked, not a "
                         f"widget — the tier bake would be overwritten at run time")
    node["inputs"][MODEL_NAME_INPUT] = model_name


def _generate_one(template_path: Path, output_name: str, tier: int,
                  model_name: str, out_dir: Path) -> Path:
    workflow = copy.deepcopy(json.loads(template_path.read_text(encoding="utf-8")))

    prune_to_captures(workflow, CAPTURE_TITLES)
    bake_int(workflow, WF_TYPE_TITLE, 1, "WFTYPE", "every op selects its branch through it")
    bake_int(workflow, TIER_TITLE, tier, "TIER", "every tier selects its branch through it")
    _assert_and_bake_model(workflow, model_name)
    n_styles = _assert_style_rack(workflow)

    out_path = out_dir / output_name
    out_path.write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    print(f"  [OK]   {output_name} (tier {tier}, {len(workflow)} nodes, "
          f"{n_styles} style LoRAs, {model_name})")
    return out_path


def build(source_path: Path, out_dir: Path) -> list[Path]:
    """Orchestrator entry. Emit one runtime file per tier for the master template."""
    variants = MODEL_VARIANTS.get(source_path.name)
    if variants is None:
        print(f"  [WARN] {source_path.name} not in MODEL_VARIANTS — nothing to do")
        return []
    print(f"Template: {source_path.name}")
    return [_generate_one(source_path, name, tier, model, out_dir)
            for name, tier, model in variants]


def main() -> None:
    """Standalone: rebuild every Chroma template from files alongside this script."""
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
