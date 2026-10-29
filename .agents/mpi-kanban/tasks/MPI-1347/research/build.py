"""MPI-1347 (Fabio, 2026-10-29): Singularity H3 turbo LoRA A/B on the SHIPPED graph.

  ship - minimax_h3_r2va_singularity.json as shipped: ref2v 8-step v1.0 768p LoRA at 1.0, stage 1 10 steps
  ship8 - the shipped LoRA with stage 1 at 8 steps (steps-matched rival for v01)
  v01  - the same graph with lightx2v's minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16 at 1.0, stage 1
         8 steps (what users run it at: 4 steps ruins the audio)

Turbo on, Fast Motion off, 1344x768 (16:9), 8 s, two seeds. Two reference sheets (never cropped),
two speakers, camera dollies out from a close two-shot to a wide. The prompt is fixed for both arms.

  python build.py  ->  graphs/<arm>_<seed>.json
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "..", "..", "..", "comfy_workflows", "minimax_h3_r2va_singularity.json")
SEEDS = (1347001, 1347002)

PROMPT = """Rooftop terrace bar at dusk look: warm tungsten and deep blue palette, string lights glowing overhead, the city skyline behind, mood intimate and playful, opening on a close two-shot on a 50mm lens.
Use <Picture 1> as the woman's face, hair, full-body tattoos and wardrobe, and <Picture 2> as the man's face, grey hair, full-body tattoos, wardrobe and brown leather crossbody bag.
[Shot 1] The woman from <Picture 1> and the man from <Picture 2> sit side by side at a small table at the edge of the terrace, glasses of red wine in front of them, turned toward each other and talking. Leaning in with a teasing smile, she says, "You promised me you'd dance tonight, remember?" He laughs, shaking his head, and answers in a low, warm voice, "I said maybe. Maybe is not a promise." She raises her glass and says, laughing, "Then maybe I'll find someone else who will."
The camera starts on a close two-shot of their faces and dollies smoothly backward the whole time, pulling away until they are small figures at their table in a wide shot of the whole rooftop and the skyline.
overall_soundscape: A low murmur of other guests, glasses clinking, a light evening breeze, distant city traffic far below.
non_diegetic_music: N/A
No text, subtitles, logos or watermarks, no cartoon or overly-CG rendering, no soft dissolves, no warped anatomy, no flicker, no slow-motion."""

ARMS = {
    "ship": ("minimax-h3\\minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors", 10),
    "v01": ("minimax-h3\\minimax_h3_ref2v_turbo_4step_v0.1_comfyui_bf16.safetensors", 8),
    # Fabio, same day: the shipped LoRA at 8 steps too, so v01 has a steps-matched rival.
    "ship8": ("minimax-h3\\minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors", 8),
}
# Fabio, same day: Fast Motion OFF draws stage 1 at half size (672x384), so faces at the wide end are a
# seed lottery. fm_<arm> = Fast Motion ON (stage 1 at full 1344x768), ship and v01 only.
FM_ARMS = ("ship", "v01", "v10", "v11")
# Fabio, same day: the shipped one stays (more detail); try lightx2v's other two ref2v 768p LoRAs, Fast Motion only.
ARMS["v10"] = ("minimax-h3\\minimax_h3_ref2v_turbo_4step_v1.0_768p_comfyui_bf16.safetensors", 8)
ARMS["v11"] = ("minimax-h3\\minimax_h3_ref2v_turbo_8step_v1.1_768p_comfyui_bf16.safetensors", 10)
# Fabio: shipped beat v1.1 at 10; one more clip, v1.1 at 8 steps (never tested anywhere before).
ARMS["v11s8"] = (ARMS["v11"][0], 8)
FM_ARMS += ("v11s8",)


def set_input(g, nid, title, key, value):
    assert g[nid]["_meta"]["title"] == title, (nid, g[nid]["_meta"]["title"])
    g[nid]["inputs"][key] = value


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    # The shipped values the ship arm must keep: if these move, the baseline is not the shipped one.
    assert src["537"]["inputs"]["lora_name"] == ARMS["ship"][0] and src["537"]["inputs"]["strength_model"] == 1
    assert src["560"]["inputs"]["steps"] == ARMS["ship"][1] and src["559"]["inputs"]["true"] == ["560", 0]
    os.makedirs(os.path.join(HERE, "graphs"), exist_ok=True)
    os.makedirs(os.path.join(HERE, "graphs_pod"), exist_ok=True)
    runs = [(arm, arm, False) for arm in ARMS if arm not in ("v10", "v11", "v11s8")] +[("fm_" + arm, arm, True) for arm in FM_ARMS]
    for label, arm, fast in runs:
        lora, steps = ARMS[arm]
        for seed in SEEDS:
            g = json.loads(json.dumps(src))
            name = "%s_%d" % (label, seed)
            set_input(g, "232", "Input_Positive", "string", PROMPT)
            set_input(g, "195", "Input_seed", "int", seed)
            set_input(g, "212", "Input_Duration", "int", 8)
            set_input(g, "623", "Input_Width", "int", 1344)
            set_input(g, "622", "Input_Height", "int", 768)
            set_input(g, "444", "Input_is_Turbo", "boolean", True)
            set_input(g, "880", "Input_Fast_Motion", "boolean", fast)
            set_input(g, "321", "Input_Image", "string", "mpi1347/ref_087.png")
            set_input(g, "329", "Input_Image_2", "string", "mpi1347/ref_084.png")
            g["537"]["inputs"]["lora_name"] = lora
            g["560"]["inputs"]["steps"] = steps
            set_input(g, "610", "Output_Video", "filename_prefix", "mpi1347/" + name)
            set_input(g, "574", "Output_Preview", "filename_prefix", "mpi1347/preview_" + name)
            with open(os.path.join(HERE, "graphs", name + ".json"), "w", encoding="utf-8") as f:
                json.dump(g, f, indent=1)
            g["537"]["inputs"]["lora_name"] = lora.replace("\\", "/")  # the Pod is Linux
            with open(os.path.join(HERE, "graphs_pod", name + ".json"), "w", encoding="utf-8") as f:
                json.dump(g, f, indent=1)
            print(name)


if __name__ == "__main__":
    main()
