"""MPI-1348: NVIDIA Open-H3-Regenerate-2K refiner LoRA as H3's stage 2, on the SHIPPED fl2va graph.

The shipped stage 2 is already a 3-step euler cfg-1 refine (ManualSigmas 536 -> MpiWindowedSampler
532) after the 3D latent upscaler, so the arms differ ONLY in the refine model and its sigmas:

  ship  - minimax_h3_fl2va.json as shipped at 2560x1440 (stage 1 1280x720, upscaler 2x)
  regen - same graph, stage 2 loads stage 1's latent from `ship` (identical draft), the refine
          model gets Kijai's rank-384 extraction of the Open-H3-Regenerate-2K LoRA at 1.0 and
          NVIDIA's sigmas. The merged LoRA already folds in the fl2v turbo 4-step v1.2 and the
          LMS sharp LoRA (lora_config.json), so no turbo LoRA is stacked on the refine.

Turbo on (the shipped default path), text-to-video, 5 s (121 frames, NVIDIA's own length), two seeds.
`ship` must run before `regen` for each seed: it writes the stage-1 latent `regen` loads.

  python build.py  ->  graphs/<arm>_<seed>.json
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "..", "..", "..", "comfy_workflows", "minimax_h3_fl2va.json")
SEEDS = (1348001, 1348002)
REGEN_LORA = "minimax-h3\\minimax_h3_open_regenerate_2k_refiner_rank_384_bf16.safetensors"
REGEN_SIGMAS = "0.909375, 0.857143, 0.666667, 0.0"
SHIP_SIGMAS = "0.9035, 0.6316, 0.3158, 0.0000"

PROMPT = """A busy city street at golden hour, shot on a 35mm lens from across the road. A young woman with curly red hair, freckles and a green wool coat walks toward the camera along the far pavement, weaving between other pedestrians, a paper coffee cup in her right hand with steam rising from it. She starts as a small figure in a wide shot and keeps walking until she is in a medium shot, then lifts the cup, smiles and waves with her free hand, her fingers spread.
Sound of city traffic, footsteps and distant chatter.
No text, subtitles, logos or watermarks, no warped anatomy, no flicker, no slow-motion."""


def set_input(g, nid, title, key, value):
    assert g[nid]["_meta"]["title"] == title, (nid, g[nid]["_meta"]["title"])
    g[nid]["inputs"][key] = value


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    # The shipped stage 2 this bench assumes: if these move, rebuild the arms by hand.
    assert src["536"]["inputs"]["sigmas"] == SHIP_SIGMAS, src["536"]["inputs"]["sigmas"]
    assert src["537"]["inputs"]["sampler_name"] == "euler" and src["538"]["class_type"] == "BasicGuider"
    assert src["518"]["inputs"]["model"] == ["460", 0] and src["460"]["inputs"]["true"] == ["381", 0]
    assert src["494"]["inputs"]["float"] == 2
    os.makedirs(os.path.join(HERE, "graphs"), exist_ok=True)
    # Identity follow-ups after seed 1 (regen redrew the face: freckles gone, different woman):
    #   regen50   - LoRA at 0.5, NVIDIA sigmas
    #   regenshsg - LoRA at 1.0, the SHIPPED sigmas (NVIDIA's stay above 0.66 for two steps)
    variants = {"regen": (1, REGEN_SIGMAS), "regen50": (0.5, REGEN_SIGMAS), "regenshsg": (1, SHIP_SIGMAS)}
    for arm in ("ship", "regen", "regen50", "regenshsg"):
        for seed in SEEDS:
            g = json.loads(json.dumps(src))
            name = "%s_%d" % (arm, seed)
            set_input(g, "232", "Input_Positive", "string", PROMPT)
            set_input(g, "195", "Input_seed", "int", seed)
            set_input(g, "212", "Input_Duration", "int", 5)
            set_input(g, "167", "Input_Width", "int", 2560)
            set_input(g, "168", "Input_Height", "int", 1440)
            set_input(g, "324", "Input_is_Turbo", "boolean", True)
            set_input(g, "320", "Input_Video_Latent", "save_path", "mpi1348_%d" % seed)
            set_input(g, "320", "Input_Video_Latent", "load_path", "mpi1348_%d" % seed)
            if arm in variants:
                strength, sigmas = variants[arm]
                set_input(g, "320", "Input_Video_Latent", "is_continue", True)
                g["9001"] = {"class_type": "MpiLoraModel", "_meta": {"title": "Regenerate 2K LoRA"},
                             "inputs": {"lora_name": REGEN_LORA, "strength_model": strength, "model": ["460", 0]}}
                g["518"]["inputs"]["model"] = ["9001", 0]
                g["536"]["inputs"]["sigmas"] = sigmas
            set_input(g, "208", "Output_Video", "filename_prefix", "mpi1348/" + name)
            set_input(g, "207", "Output_Preview", "filename_prefix", "mpi1348/preview_" + name)
            with open(os.path.join(HERE, "graphs", name + ".json"), "w", encoding="utf-8") as f:
                json.dump(g, f, indent=1)
            print(name)


if __name__ == "__main__":
    main()
