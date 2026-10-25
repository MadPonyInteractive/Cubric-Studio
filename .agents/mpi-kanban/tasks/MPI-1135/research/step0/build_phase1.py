"""MPI-1135 Phase 1: none and ours on each model, run PER MODEL (Fabio, 2026-10-25).

Models: Singularity H3 v1.3 (pruned int8, one fused file for t2v / i2v / ref2v) and ours.
Singularity v2 and FastH3 Trim are dropped (FastH3 has no reference op; v2 regressed per the
HF community tab). Fixed inputs as Step 0: 1344x768 (Shot D portrait 896x1088), 4 s, our 8-step
turbo, the shipped fl2va graph for A / B / D and r2va for C, only the transformer swapped.
Ours on A and C already ran in Step 0 (step0_{none,ours}_{A,C}_<seed>), so ours here is B and D.
Cb / Cs (Fabio, 2026-10-25): Shot C with the looks stripped, and stripped plus MiniMax's
subject_definitions / retention_analysis sections; ours arm only, on both models.

Run from the repo root:  python .agents/mpi-kanban/tasks/MPI-1135/research/step0/build_phase1.py
Writes graphs/p1_<model>_<arm>_<shot>_<seed>.json; run order is the printed order.
"""
import json
import os
import re

import build_step0 as s0

SING = "Minimax-h3_Singularity_ref2va_Pruned_v1.3_int8.safetensors"
UNET = {"fl2va": "129", "r2va": "517"}
START = "mpi1135/start_011.png"  # Shot D start frame, uploaded by run_graphs.py
SHOTS = {"A": "fl2va", "B": "fl2va", "C": "r2va", "Cb": "r2va", "Cs": "r2va", "D": "fl2va"}
BARE = {"Cb", "Cs"}  # Shot C prompt variants (prompts.md): ours arm only
SIZE = {"D": (896, 1088)}  # portrait start frame
RUNS = [("sing", ["A", "B", "C", "Cb", "Cs", "D"]), ("ours", ["B", "D", "Cb", "Cs"])]  # one model at a time


def prompts():
    text = open(os.path.join(s0.HERE, "..", "prompts.md"), encoding="utf-8").read()
    return {k: re.search(r"## Shot %s:.*?```text\n(.*?)\n```" % k, text, re.S).group(1) for k in SHOTS}


def main():
    ps = prompts()
    for model, shots in RUNS:
        for shot in shots:
            kind = SHOTS[shot]
            for seed in s0.SEEDS:
                for arm in (("ours",) if shot in BARE else ("none", "ours")):
                    name = "p1_%s_%s_%s_%d" % (model, arm, shot, seed)
                    d, g = s0.base(kind, ps[shot], seed, "mpi1135/" + name)
                    if shot in SIZE:
                        d[g["width"]]["inputs"]["int"], d[g["height"]]["inputs"]["int"] = SIZE[shot]
                    if shot == "D":
                        assert d["217"]["_meta"]["title"] == "Input_Start_Frame"
                        d["217"]["inputs"]["string"] = START
                    if model == "sing":
                        assert d[UNET[kind]]["class_type"] == "UNETLoader"
                        d[UNET[kind]]["inputs"]["unet_name"] = SING
                    s0.ARMS[arm](d, g)
                    with open(os.path.join(s0.OUT, name + ".json"), "w", encoding="utf-8") as f:
                        json.dump(d, f, indent=1)
                    print(name)


if __name__ == "__main__":
    main()
