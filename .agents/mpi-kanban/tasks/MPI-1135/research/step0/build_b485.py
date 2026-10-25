"""MPI-1135 Step 0b: Benji's arm with the refine denoise at 0.485 (Fabio, 2026-10-25), Shot C.

Same graph as Step 0's benji arm except the denoise, on two models:
  b485_ours_C_<seed>  our shipped ref2va transformer
  b485_sing_C_<seed>  Singularity H3 v2 (the model Benji runs it on), nothing else changed

Run from the repo root:  python .agents/mpi-kanban/tasks/MPI-1135/research/step0/build_b485.py
"""
import json
import os

from build_step0 import OUT, SEEDS, arm_benji, base, prompts

DENOISE = 0.485
MODELS = {"ours": "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
          "sing": "Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors"}
UNET = "517"  # UNETLoader in minimax_h3_r2va.json


def main():
    ps = prompts()
    for model, unet in MODELS.items():  # one model at a time: every seed, then the next model
        for seed in SEEDS:
            name = "b485_%s_C_%d" % (model, seed)
            d, g = base("r2va", ps["C"], seed, "mpi1135/" + name)
            arm_benji(d, g)
            d["9002"]["inputs"]["denoise"] = DENOISE
            d["9002"]["_meta"]["title"] = "Benji refine sigmas (denoise %.3f)" % DENOISE
            assert d[UNET]["class_type"] == "UNETLoader"
            d[UNET]["inputs"]["unet_name"] = unet
            with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
                json.dump(d, f, indent=1)
            print(name, len(d), "nodes")


if __name__ == "__main__":
    main()
