"""MPI-1347 (Fabio, 2026-10-29): after ref2v v1.1 won, the fl2v family gets one bench clip before any swap.

  fl_ship - minimax_h3_fl2va.json as shipped: fl2v 8-step v1.0 768p LoRA, turbo steps as shipped (8)
  fl_v11  - the same graph with lightx2v's fl2v 8-step v1.1 768p LoRA, same steps

Turbo on, 1344x768, 8 s, seed 1347001. Start and end frames are the first and last frame of
fm_ship_1347001.mp4 (the ref2v rooftop dolly-out), uploaded to the Pod as mpi1347/fl_start.png, fl_end.png.

  python build_fl2v.py  ->  graphs_pod/fl_<arm>_1347001.json
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "..", "..", "..", "comfy_workflows", "minimax_h3_fl2va.json")
SEED = 1347001
SHIP = "minimax-h3\\minimax_h3_fl2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors"
ARMS = {"ship": SHIP, "v11": SHIP.replace("_v1.0_", "_v1.1_")}

PROMPT = """Rooftop terrace bar at dusk look: warm tungsten and deep blue palette, string lights glowing overhead, the city skyline behind, mood intimate and playful, opening on a close two-shot on a 50mm lens.
A woman with a black-to-pink bob and full-body tattoos and a grey-haired man with full-body tattoos sit side by side at a small table at the edge of the terrace, glasses of red wine in front of them, turned toward each other and talking. Leaning in with a teasing smile, she says, "You promised me you'd dance tonight, remember?" He laughs, shaking his head, and answers in a low, warm voice, "I said maybe. Maybe is not a promise." She raises her glass and says, laughing, "Then maybe I'll find someone else who will."
The camera starts on a close two-shot of their faces and dollies smoothly backward the whole time, pulling away until they sit at their table in a wide shot of the rooftop and the skyline.
A low murmur of other guests, glasses clinking, a light evening breeze, distant city traffic far below.
No text, subtitles, logos or watermarks, no cartoon or overly-CG rendering, no soft dissolves, no warped anatomy, no flicker, no slow-motion."""


def set_input(g, nid, title, key, value):
    assert g[nid]["_meta"]["title"] == title, (nid, g[nid]["_meta"]["title"])
    g[nid]["inputs"][key] = value


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    assert src["455"]["inputs"]["lora_name"] == SHIP, src["455"]["inputs"]["lora_name"]
    os.makedirs(os.path.join(HERE, "graphs_pod"), exist_ok=True)
    for arm, lora in ARMS.items():
        g = json.loads(json.dumps(src))
        name = "fl_%s_%d" % (arm, SEED)
        set_input(g, "232", "Input_Positive", "string", PROMPT)
        set_input(g, "195", "Input_seed", "int", SEED)
        set_input(g, "212", "Input_Duration", "int", 8)
        set_input(g, "167", "Input_Width", "int", 1344)
        set_input(g, "168", "Input_Height", "int", 768)
        set_input(g, "324", "Input_is_Turbo", "boolean", True)
        set_input(g, "217", "Input_Start_Frame", "image", "mpi1347/fl_start.png")
        set_input(g, "219", "Input_End_Frame", "image", "mpi1347/fl_end.png")
        g["455"]["inputs"]["lora_name"] = lora.replace("\\", "/")  # the Pod is Linux
        set_input(g, "208", "Output_Video", "filename_prefix", "mpi1347/" + name)
        set_input(g, "207", "Output_Preview", "filename_prefix", "mpi1347/preview_" + name)
        with open(os.path.join(HERE, "graphs_pod", name + ".json"), "w", encoding="utf-8") as f:
            json.dump(g, f, indent=1)
        print(name)


if __name__ == "__main__":
    main()
