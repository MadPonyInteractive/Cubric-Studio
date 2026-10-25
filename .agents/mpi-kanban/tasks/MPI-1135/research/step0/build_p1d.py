"""Phase 1d (Fabio, 2026-10-25): the realism-people LoRA on the plastic-skin clip.

Copies p1c_s2_none_D_1135001 (Singularity v2, Shot D, no upscale) and changes ONLY the LoRA
(fal/MiniMax-H3-Realism-People-LoRA at 0.7 in Input_Lora_1) and the trigger prefixed to the
prompt, for the local bench (G:/ComfyUi on :8188, weights under bench-mpi1135/).

  python build_p1d.py   ->  graphs/p1d_s2_real07_D_1135001.json
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "graphs", "p1c_s2_none_D_1135001.json")
NAME = "p1d_s2_real07_D_1135001"

g = json.load(open(SRC, encoding="utf-8"))
g["129"]["inputs"]["unet_name"] = "bench-mpi1135\\Minimax-h3_Singularity_ref2va_v2_pruned_int8.safetensors"
g["455"]["inputs"]["lora_name"] = g["455"]["inputs"]["lora_name"].replace("/", "\\")  # Windows bench
lora = g["246"]["inputs"]
lora["lora_name"] = "bench-mpi1135\\h3-realism-people-t2v-i2v-r2v.safetensors"
lora["strength_model"] = 0.7
lora["strength_clip"] = 0.7
g["232"]["inputs"]["string"] = "r34l1sm , ultra realistic video. " + g["232"]["inputs"]["string"]
g["207"]["inputs"]["filename_prefix"] = "mpi1135/" + NAME
json.dump(g, open(os.path.join(HERE, "graphs", NAME + ".json"), "w", encoding="utf-8"), indent=1)
print(NAME)
