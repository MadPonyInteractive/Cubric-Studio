"""Phase 1e (Fabio, 2026-10-25): prompt-wording skin tests on Shot D, 8 s, on a Pod.

Copies p1c_s2_none_D_1135001 (Singularity v2, i2v, turbo, no upscale) at 8 s instead of 4, with
the dialogue extended so she keeps talking once she reaches the lens. Six clips, each ONE change
from the new 8 s baseline:
  base  - the 8 s prompt
  photo - base + "Photorealistic, natural lighting, realistic skin texture" in the look line
  nocg  - photo with "no cartoon or overly-CG rendering" removed from the constraint line
  cine  - base + Cinematic V2 LoRA (TuTu_1018) at 0.85 in Input_Lora_1
  upbase - base on the shipped upscale route (half-size stage 1, 3D upscale, refine)
  upcine - upbase + Cinematic V2 0.85 on the refine model only
  cine070, upcine100 - Fabio's follow-up: 0.85 overcooked on stage 1, invisible on the refine only
(The official fal Realism LoRA test was dropped: the repo 404s even logged in.)

  python build_p1e.py   ->  graphs/p1e_s2_<arm>_D_1135001.json (Pod names, run in printed order)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "graphs", "p1c_s2_none_D_1135001.json")

OLD_ACTION = 'with a soft laugh, "Next time you\'re coming, no excuses."'
NEW_ACTION = (OLD_ACTION + ' Close to the lens, she keeps talking, leaning in and lowering her voice,'
              ' "I saved you the best spot, right by the rocks."')
OLD_CAMERA = "her figure growing from full body to a close-up of her face."
NEW_CAMERA = ("her figure growing from full body to a close-up of her face, and stays on the close-up"
              " while she keeps talking.")
OLD_LOOK = "mood relaxed and warm."
NEW_LOOK = OLD_LOOK + " Photorealistic, natural lighting, realistic skin texture."
OLD_CG = ", no cartoon or overly-CG rendering"


def swap(text, old, new):
    assert text.count(old) == 1, old
    return text.replace(old, new)


def main():
    src = json.load(open(SRC, encoding="utf-8"))
    base = swap(swap(src["232"]["inputs"]["string"], OLD_ACTION, NEW_ACTION), OLD_CAMERA, NEW_CAMERA)
    photo = swap(base, OLD_LOOK, NEW_LOOK)
    prompts = {"base": base, "photo": photo, "nocg": swap(photo, OLD_CG, ""), "cine": base, "cine070": base}
    for arm, prompt in prompts.items():
        g = json.loads(json.dumps(src))
        name = "p1e_s2_%s_D_1135001" % arm
        assert g["212"]["_meta"]["title"] == "Input_Duration"
        g["212"]["inputs"]["int"] = 8
        g["232"]["inputs"]["string"] = prompt
        if arm.startswith("cine"):  # TuTu_1018 Cinematic V2, no trigger; temp copy on R2 vision/tmp/mpi1135/
            lora = g["246"]["inputs"]
            lora["lora_name"] = "minimax-h3/H3_cinematic_V2.safetensors"
            lora["strength_model"] = lora["strength_clip"] = 0.70 if arm == "cine070" else 0.85
        g["207"]["inputs"]["filename_prefix"] = "mpi1135/" + name
        with open(os.path.join(HERE, "graphs", name + ".json"), "w", encoding="utf-8") as f:
            json.dump(g, f, indent=1)
        print(name)
    # Start-frame test (Fabio): the 8 s single pass lost the i2v start frame. HF discussion #32: v2 follows
    # words describing visible traits over the picture. strip = base minus the look line and the gulls,
    # on v2 and on v1.3 (users say v1.3 holds the frame better).
    lines = base.split("\n")
    assert lines[0].startswith("The supplied frame shows")
    strip = swap("\n".join(lines[1:]), "gulls calling over the water, ", "")
    for model, unet in (("s2", src["129"]["inputs"]["unet_name"]),
                        ("s13", "Minimax-h3_Singularity_ref2va_Pruned_v1.3_int8.safetensors")):
        g = json.loads(json.dumps(src))
        name = "p1e_%s_strip_D_1135001" % model
        g["129"]["inputs"]["unet_name"] = unet
        g["212"]["inputs"]["int"] = 8
        g["232"]["inputs"]["string"] = strip
        g["207"]["inputs"]["filename_prefix"] = "mpi1135/" + name
        with open(os.path.join(HERE, "graphs", name + ".json"), "w", encoding="utf-8") as f:
            json.dump(g, f, indent=1)
        print(name)
    # Second pass (Fabio): the shipped upscale route (half-size stage 1 + 3D upscale + refine),
    # base prompt; upcine puts Cinematic V2 on the refine model ONLY (stage 1 has no LoRA).
    up = json.load(open(os.path.join(HERE, "graphs", "p1_sing_ours_D_1135001.json"), encoding="utf-8"))
    up["129"]["inputs"]["unet_name"] = src["129"]["inputs"]["unet_name"]  # v1.3 -> v2
    up["212"]["inputs"]["int"] = 8
    up["232"]["inputs"]["string"] = base
    for arm in ("upbase", "upcine", "upcine100"):
        g = json.loads(json.dumps(up))
        name = "p1e_s2_%s_D_1135001" % arm
        g["208"]["inputs"]["filename_prefix"] = "mpi1135/" + name
        if arm.startswith("upcine"):
            assert g["518"]["inputs"]["model"] == ["460", 0]  # refine sigma shift <- refine model
            g["9001"] = {"class_type": "LoraLoaderModelOnly", "_meta": {"title": "Cinematic V2 0.85 (refine)"},
                         "inputs": {"model": ["460", 0], "lora_name": "minimax-h3/H3_cinematic_V2.safetensors",
                                    "strength_model": 1.0 if arm == "upcine100" else 0.85}}
            g["518"]["inputs"]["model"] = ["9001", 0]
        with open(os.path.join(HERE, "graphs", name + ".json"), "w", encoding="utf-8") as f:
            json.dump(g, f, indent=1)
        print(name)


if __name__ == "__main__":
    main()
