"""MPI-1135 Phase 1b: Singularity v1.3 vs v2, Shot B, no upscale, 2 seeds (Fabio, 2026-10-25).

The winner is the one model Phase 2 runs its speed arms on. Fixed inputs as Phase 1: 1344x768,
4 s, our 8-step turbo, the shipped fl2va graph with only the transformer swapped. Fresh v1.3 runs
(not Phase 1's clips) so both arms come from the same Pod. Run order is the printed order.

Run from the repo root:  python .agents/mpi-kanban/tasks/MPI-1135/research/step0/build_v2.py
"""
import json
import os

import build_phase1 as p1
import build_step0 as s0

MODELS = {"s2": "Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors", "s13": p1.SING}


def main():
    prompt = p1.prompts()["B"]
    for model, unet in MODELS.items():  # one model at a time
        for seed in s0.SEEDS:
            name = "p1b_%s_none_B_%d" % (model, seed)
            d, g = s0.base("fl2va", prompt, seed, "mpi1135/" + name)
            assert d[p1.UNET["fl2va"]]["class_type"] == "UNETLoader"
            d[p1.UNET["fl2va"]]["inputs"]["unet_name"] = unet
            s0.ARMS["none"](d, g)
            with open(os.path.join(s0.OUT, name + ".json"), "w", encoding="utf-8") as f:
                json.dump(d, f, indent=1)
            print(name)


def main_1c():
    """Phase 1c (Fabio, 2026-10-25): v2 on the ops it never ran, beside Phase 1's clips.
    Shot D i2v, no upscale (vs p1_ours_none_D = our fl2va, and p1_sing_none_D = v1.3);
    Shot Cs ref2v, sections prompt, our upscale route (vs p1_{ours,sing}_ours_Cs)."""
    ps = p1.prompts()
    for shot, arm in (("D", "none"), ("Cs", "ours")):
        kind = p1.SHOTS[shot]
        for seed in s0.SEEDS:
            name = "p1c_s2_%s_%s_%d" % (arm, shot, seed)
            d, g = s0.base(kind, ps[shot], seed, "mpi1135/" + name)
            if shot in p1.SIZE:
                d[g["width"]]["inputs"]["int"], d[g["height"]]["inputs"]["int"] = p1.SIZE[shot]
            if shot == "D":
                assert d["217"]["_meta"]["title"] == "Input_Start_Frame"
                d["217"]["inputs"]["string"] = p1.START
            assert d[p1.UNET[kind]]["class_type"] == "UNETLoader"
            d[p1.UNET[kind]]["inputs"]["unet_name"] = MODELS["s2"]
            s0.ARMS[arm](d, g)
            with open(os.path.join(s0.OUT, name + ".json"), "w", encoding="utf-8") as f:
                json.dump(d, f, indent=1)
            print(name)


if __name__ == "__main__":
    import sys
    main_1c() if sys.argv[1:] == ["1c"] else main()
