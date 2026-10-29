"""MPI-1348 seam test for Infinite video 1 (MPI-1336): refine each chained window PER WINDOW at 2K.

Input: MPI-1336's arm-A chain, three 124-frame 768x1344 H3 latents, window n+1's first 39 frames =
window n's last 39 (MpiH3MaskedPrefix). Stage 1 is skipped (Input_Video_Latent.is_continue loads the
window's latent), so only the shipped stage 2 runs: 3D latent upscaler -> 3-step windowed refine, to
1408x2560 (the fl2va size math from a 1440x2560 input).

  ship  - shipped refine model + sigmas
  regen - refine model + Open-H3-Regenerate-2K rank-384 LoRA, NVIDIA sigmas (as build.py)

Same seed and prompt (MPI-1336's Look + Kept text) for every window, as an app run would use.
Assemble + measure the joins with seams_2k.py.

  python build_seams.py  ->  graphs/seam_<arm>_w<i>.json
"""
import json
import os

from build import REGEN_LORA, REGEN_SIGMAS, SRC, set_input

HERE = os.path.dirname(os.path.abspath(__file__))
LATENT = "G:/ComfyUi/ComfyUI/output/latents/mpi1336_A_q1032192_w%d.latent"
SEED = 1150256869
PROMPT = ("A middle-aged woman with fair skin, dark eyes, and black glasses has blonde hair styled in a bob, "
          "with black curved horns and glowing orange cracks on her face. She wears a dark, textured black shirt "
          "that appears to be made of volcanic rock with glowing orange lava-like veins. "
          "An office interior features blurred desks, computer monitors, and ceiling lights in a space with "
          "neutral-toned walls and surfaces. The room is illuminated by soft, overhead artificial lighting.")


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    for arm in ("ship", "regen"):
        for w in range(3):
            g = json.loads(json.dumps(src))
            name = "seam_%s_w%d" % (arm, w)
            set_input(g, "232", "Input_Positive", "string", PROMPT)
            set_input(g, "195", "Input_seed", "int", SEED)
            set_input(g, "212", "Input_Duration", "int", 5)
            set_input(g, "167", "Input_Width", "int", 1440)
            set_input(g, "168", "Input_Height", "int", 2560)
            set_input(g, "324", "Input_is_Turbo", "boolean", True)
            set_input(g, "320", "Input_Video_Latent", "is_continue", True)
            set_input(g, "320", "Input_Video_Latent", "load_path", LATENT % w)
            if arm == "regen":
                g["9001"] = {"class_type": "MpiLoraModel", "_meta": {"title": "Regenerate 2K LoRA"},
                             "inputs": {"lora_name": REGEN_LORA, "strength_model": 1, "model": ["460", 0]}}
                g["518"]["inputs"]["model"] = ["9001", 0]
                g["536"]["inputs"]["sigmas"] = REGEN_SIGMAS
            set_input(g, "208", "Output_Video", "filename_prefix", "mpi1348/" + name)
            set_input(g, "207", "Output_Preview", "filename_prefix", "mpi1348/preview_" + name)
            with open(os.path.join(HERE, "graphs", name + ".json"), "w", encoding="utf-8") as f:
                json.dump(g, f, indent=1)
            print(name)


if __name__ == "__main__":
    main()
