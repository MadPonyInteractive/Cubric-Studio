"""MPI-1135 Phase 2: speed arms on Singularity v2 only (Fabio, 2026-10-25: v2 won Phase 1b).

Fixed inputs as Phase 1b: Shot B, shipped fl2va graph, no upscale, 1344x768, 4 s, 2 seeds.
The shipped graph already runs Comfy Kitchen attention (393) on every path and EasyCache (321)
on the non-turbo path, so those are the baseline, not arms.

  t_base / n_base       turbo 8 steps / non-turbo 25 steps (n_base has EasyCache taken OUT)
  n_ec                  non-turbo as shipped (EasyCache on)
  *_sol                 core BlockSparseAttention, sol-attn (training-free, no Triton), node defaults
  *_veda                VedaSparseAttention, T2VA predictor (trained at 1344x768 + 8-step turbo),
                        sparsity "trained". Needs Triton: not shippable on the local engine today
                        (docs/models/h3/performance.md), measured anyway because the brief asks.
VSA is out: core's vsa mode needs FastH3 weights.

Sparse patches go after every LoRA (on 457, the model the stage-1 scheduler and guider read).
Run from the repo root:  python .agents/mpi-kanban/tasks/MPI-1135/research/step0/build_phase2.py
Run order is the printed order (t_base seed 2 first: it pays the v2 load, Phase 1b has it warm).
"""
import json
import os

import build_phase1 as p1
import build_step0 as s0

V2 = "Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors"
STAGE1_MODEL = "457"
STAGE1_READERS = ("140", "150", "338")  # turbo scheduler, guider, non-turbo scheduler
ARMS = ["t_base", "t_sol", "t_veda", "n_base", "n_ec", "n_sol", "n_sol_ec", "n_veda", "n_veda_ec"]


def patch(d, node):
    d["9100"] = dict(node, _meta={"title": "Phase 2 speed patch"})
    d["9100"]["inputs"]["model"] = [STAGE1_MODEL, 0]
    for n in STAGE1_READERS:
        assert d[n]["inputs"]["model"] == [STAGE1_MODEL, 0]
        d[n]["inputs"]["model"] = ["9100", 0]


def build(arm, seed, prompt):
    name = "p2_%s_B_%d" % (arm, seed)
    d, g = s0.base("fl2va", prompt, seed, "mpi1135/" + name)
    d[p1.UNET["fl2va"]]["inputs"]["unet_name"] = V2
    s0.ARMS["none"](d, g)
    assert d["393"]["inputs"]["attention"] == "comfy kitchen attention"
    if arm.startswith("n_"):
        d[g["turbo"]]["inputs"]["boolean"] = False
        if "_ec" not in arm:
            assert d["516"]["inputs"]["model"] == ["321", 0]
            d["516"]["inputs"]["model"] = ["393", 0]  # EasyCache out of the chain
        else:
            d["321"]["inputs"]["verbose"] = True
    if "_sol" in arm:
        patch(d, {"class_type": "BlockSparseAttention", "inputs": {
            "selection": "sol-attn", "selection.tau": 1.3, "start_percent": 0.2, "end_percent": 1.0,
            "dense_blocks": "", "min_tokens": 12288, "extra_tokens": 256,
            "sink_conditioning": "exact_kv_and_rows", "verbose": True}})
    if "_veda" in arm:
        patch(d, {"class_type": "VedaSparseAttention", "inputs": {
            "predictor": "minimax_h3_t2va_veda_8nfe_600step_preview_fp8.safetensors",
            "generated_sparsity": "trained", "reference_sparsity": "trained",
            "full_attention_layers": "", "full_attention_steps": "", "verbose": True}})
    return name, d


def main():
    prompt = p1.prompts()["B"]
    order = [("t_base", 1135002)] + [(a, s) for a in ARMS for s in s0.SEEDS if (a, s) != ("t_base", 1135002)]
    for arm, seed in order:
        name, d = build(arm, seed, prompt)
        with open(os.path.join(s0.OUT, name + ".json"), "w", encoding="utf-8") as f:
            json.dump(d, f, indent=1)
        print(name)


if __name__ == "__main__":
    main()
