"""MPI-1135 Step 0: build the API graphs for the three upscale arms on our shipped H3.

Arms (plan.md "Run order", brief.md "Step 0"):
  none   one stage at the target size, the stage-1 output saved
  ours   the shipped graph as it is (3D latent upscaler + windowed refine)
  benji  stage 1 as shipped, then MMH3 Ultimate Upscale (chunks 85/17, anchor 1.0, the same
         LBH 3D upscaler, 128/32 tiles) with the LMS LoRA at 0.70 on the refine model,
         euler + beta, 2 steps, denoise 0.30

Shots A (t2v, fl2va graph) and C (ref2v, r2va graph), seeds 1135001/1135002, 4 s, 1344x768,
stage-1 turbo on. Prompts are read from ../prompts.md so they cannot drift.

Run from the repo root:  python .agents/mpi-kanban/tasks/MPI-1135/research/step0/build_step0.py
Writes graphs/<arm>_<shot>_<seed>.json (API format, POST /prompt as {"prompt": ...}).
"""
import copy
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, *[".."] * 6))
OUT = os.path.join(HERE, "graphs")

SEEDS = [1135001, 1135002]
WIDTH, HEIGHT, SECONDS = 1344, 768, 4
LMS = "minimax_h3_lms_v1.0_r64.safetensors"
UPSCALER = "minimax_h3_latent_upscaler_3d_bf16.safetensors"
# Pod input folder (uploaded with /upload/image, subfolder mpi1135). Never in git.
REF_WOMAN, REF_MAN = "mpi1135/ref_087.png", "mpi1135/ref_084.png"

# Node ids per shipped graph. fl2va: comfy_workflows/minimax_h3_fl2va.json; r2va: ..._r2va.json.
G = {
    "fl2va": dict(
        file="minimax_h3_fl2va.json", width="167", height="168", seed="195", duration="212",
        prompt="232", turbo="324", half=("509", "510"), stage="320", preview="207", video="208",
        stage1_latent="524", refine_model="460", refine_shift="518", refine_cond=("527", 0),
        decode=("424", "425"), noise="539", sampler="537",
    ),
    "r2va": dict(
        file="minimax_h3_r2va.json", width="623", height="622", seed="195", duration="212",
        prompt="232", turbo="444", half=("621", "620"), stage="567", preview="574", video="610",
        stage1_latent="711", refine_model="586", refine_shift="587", refine_cond=("877", 2),
        decode=("605", "606"), noise="601", sampler="770",
    ),
}
SHOTS = {"A": ("fl2va", "Shot A"), "C": ("r2va", "Shot C")}


def prompts():
    text = open(os.path.join(HERE, "..", "prompts.md"), encoding="utf-8").read()
    out = {}
    for shot in SHOTS:
        m = re.search(r"## Shot %s:.*?```text\n(.*?)\n```" % shot, text, re.S)
        out[shot] = m.group(1)
    return out


def base(kind, prompt, seed, prefix):
    g = G[kind]
    d = json.load(open(os.path.join(REPO, "comfy_workflows", g["file"]), encoding="utf-8"))
    d[g["width"]]["inputs"]["int"] = WIDTH
    d[g["height"]]["inputs"]["int"] = HEIGHT
    d[g["seed"]]["inputs"]["int"] = seed
    d[g["duration"]]["inputs"]["int"] = SECONDS
    d[g["prompt"]]["inputs"]["string"] = prompt
    d[g["turbo"]]["inputs"]["boolean"] = True
    for node in d.values():
        ins = node["inputs"]
        if isinstance(ins.get("lora_name"), str):
            ins["lora_name"] = ins["lora_name"].replace("\\", "/")  # the Pod is Linux
        if node["class_type"] == "MpiSaveVideo":
            ins["filename_prefix"] = prefix
    if kind == "r2va":
        d["321"]["inputs"]["string"] = REF_WOMAN
        d["329"]["inputs"]["string"] = REF_MAN
    return d, g


def arm_none(d, g):
    for n in g["half"]:
        d[n]["inputs"]["math_expression"] = "floor(a / 32) * 32"  # stage 1 at the full size
    # The app's own preview run: MpiStageLatents blocks the stage-2 branch and releases the
    # stage-1 decode. Deleting Output_Video is not enough, the MpiClearVram nodes after the
    # refine are output nodes and pull stage 2 (at 2x the now-full size) on their own.
    d[g["stage"]]["inputs"]["is_preview"] = True
    del d[g["video"]]


def arm_ours(d, g):
    del d[g["preview"]]


def arm_benji(d, g):
    del d[g["preview"]]
    d["9001"] = {"class_type": "LoraLoaderModelOnly", "_meta": {"title": "LMS 0.70 (refine)"},
                 "inputs": {"model": [g["refine_model"], 0], "lora_name": LMS, "strength_model": 0.70}}
    d[g["refine_shift"]]["inputs"]["model"] = ["9001", 0]
    d["9002"] = {"class_type": "BasicScheduler", "_meta": {"title": "Benji refine sigmas"},
                 "inputs": {"model": [g["refine_shift"], 0], "scheduler": "beta", "steps": 2, "denoise": 0.30}}
    d["9003"] = {"class_type": "KSamplerSelect", "_meta": {"title": "euler"},
                 "inputs": {"sampler_name": "euler"}}
    d["9004"] = {"class_type": "MMH3LatentUpscaleWithModelParams", "_meta": {"title": "3D upscaler"},
                 "inputs": {"model_name": UPSCALER, "width": WIDTH, "height": HEIGHT,
                            "device": "cuda", "precision": "bf16", "offload_model": True}}
    d["9005"] = {"class_type": "MMH3TemporalSplitParams", "_meta": {"title": "chunks 85/17"},
                 "inputs": {"chunk_length": 85, "temporal_overlap": 17, "anchor_strength": 1.0}}
    d["9006"] = {"class_type": "MMH3SpatialSplitParams", "_meta": {"title": "tiles 512, 128/32"},
                 "inputs": {"upscale_width": WIDTH, "upscale_height": HEIGHT,
                            "tile_size_mode": "specific_size", "tile_width": 512, "tile_height": 512,
                            "grid_rows": 2, "grid_cols": 2,
                            "spatial_w_overlap": 128, "spatial_h_overlap": 128,
                            "fade_width": 32, "fade_height": 32, "min_tile_size": 256,
                            "overlap_mode": "earlier", "overlap_blend": "linear",
                            "masked_area_noise": 0.0, "brightness_match": False,
                            "dynamic_fade": "off", "dynamic_fade_min": 32}}
    d["9007"] = {"class_type": "MMH3UltimateUpscale", "_meta": {"title": "MMH3 Ultimate Upscale"},
                 "inputs": {"model": [g["refine_shift"], 0], "conditioning": list(g["refine_cond"]),
                            "latent": [g["stage1_latent"], 0], "noise": [g["noise"], 0],
                            "sampler": ["9003", 0], "sigmas": ["9002", 0], "cfg": 1.0,
                            "latent_upscale_param": ["9004", 0], "temporal_split_param": ["9005", 0],
                            "spatial_split_param": ["9006", 0]}}
    for n in g["decode"]:
        d[n]["inputs"]["samples"] = ["9007", 0]


ARMS = {"none": arm_none, "ours": arm_ours, "benji": arm_benji}


def main():
    os.makedirs(OUT, exist_ok=True)
    ps = prompts()
    for shot, (kind, _) in SHOTS.items():
        for seed in SEEDS:
            for arm, apply in ARMS.items():
                name = "step0_%s_%s_%d" % (arm, shot, seed)
                d, g = base(kind, ps[shot], seed, "mpi1135/" + name)
                apply(d, g)
                with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
                    json.dump(d, f, indent=1)
                print(name, len(d), "nodes")


if __name__ == "__main__":
    main()
