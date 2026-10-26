"""
generate_sdxl.py
SDXL handler: generates per-model workflow JSONs from ONE master template by swapping
the checkpoint. One template → N model variants.

Standalone:  python generate_sdxl.py        # rebuilds ALL templates
Orchestrated: build(source_path, out_dir)    # rebuilds only the matching template

Node lookup is by `_meta.title` ("Checkpoint") — never by node id.

MPI-365: the three-template era is over. `sdxl_upscaler_template.json` and
`sdxl_detailer_template.json` (and the ten runtime files they baked) were folded into
`sdxl_t2i_template.json` as branches 6 and 7 of `Input_wf_type`, so five ops now ship in
one file per model. The old `Input_Is_i2i` boolean went with them — i2i is branch 2.
"""

import json
import copy
from pathlib import Path
from graph_utils import bake_int, find_by_title

# ─── CONFIG ──────────────────────────────────────────────────────────────────
# template filename → list of (output_name, ckpt_name)
MODEL_VARIANTS = {
    "sdxl_t2i_template.json": [
        ("t2i_sdxl_realistic.json",        "SDXL_Realistic.safetensors"),
        ("t2i_sdxl_nsfw.json",             "SDXL_NSFW.safetensors"),
        ("t2i_ill_anime_beauty.json",      "ILL_Anime_Beauty.safetensors"),
        ("t2i_ill_anime.json",             "ILL_Anime.safetensors"),
        ("t2i_pony_mix.json",              "PONY_Mix.safetensors"),
    ],
}
# ─── END CONFIG ───────────────────────────────────────────────────────────────

CHECKPOINT_TITLE = "Checkpoint"
WF_TYPE_TITLE = "Input_wf_type"
CONTROL_NET_TITLE = "Input_Control_Net"
SCRIPTS_DIR = Path(__file__).parent
WORKFLOWS_DIR = SCRIPTS_DIR.parent.parent  # comfy_workflows/


def _generate_one(template_path: Path, output_name: str, ckpt_name: str, out_dir: Path) -> Path | None:
    workflow = copy.deepcopy(json.loads(template_path.read_text(encoding="utf-8")))
    node = find_by_title(workflow, CHECKPOINT_TITLE)
    if node is None:
        print(f"  [WARN] No '{CHECKPOINT_TITLE}' node in {template_path.name} — skipping {output_name}")
        return None
    node["inputs"]["ckpt_name"] = ckpt_name
    bake_int(workflow, WF_TYPE_TITLE, 1, "WFTYPE", "the master template selects its branch through it")        # 1 = t2i
    bake_int(workflow, CONTROL_NET_TITLE, 2, "CONTROL", "the master template selects its branch through it")   # 2 = depth
    out_path = out_dir / output_name
    out_path.write_text(json.dumps(workflow, indent=2), encoding="utf-8")
    print(f"  [OK]   {output_name}")
    return out_path


def build(source_path: Path, out_dir: Path) -> list[Path]:
    """Orchestrator entry. Build variants for the ONE template named by source_path."""
    variants = MODEL_VARIANTS.get(source_path.name)
    if variants is None:
        print(f"  [WARN] {source_path.name} not in MODEL_VARIANTS — nothing to do")
        return []
    print(f"Template: {source_path.name}")
    written = [_generate_one(source_path, name, ckpt, out_dir) for name, ckpt in variants]
    return [p for p in written if p is not None]


def main() -> None:
    """Standalone: rebuild every template from files alongside this script."""
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
