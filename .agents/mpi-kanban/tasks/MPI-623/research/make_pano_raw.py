"""MPI-623: write comfy_workflows/raw/flow_pano360.json (LiteGraph) from the bench-proven graphs
(D:/WORK/MPI-623-spike/cartoon/pano_t2i_fast.api.json + pano_ostris_fast.api.json, validation.md
§ Phase 4 bench test) plus the flat-sky wrap soften Fabio passed. Slot names/types from the bench's
live /object_info. Convert with `node scripts/sync-raw-workflows.mjs`."""
import json, urllib.request, uuid

OI = json.load(urllib.request.urlopen("http://127.0.0.1:8188/object_info", timeout=60))
PRIM = {"INT", "FLOAT", "STRING", "BOOLEAN", "COMBO"}
OUT = r"C:/AI/Mpi/Cubric-Vision/comfy_workflows/raw/flow_pano360.json"


def is_widget(spec):
    t = spec[0]
    return (isinstance(t, list) or (isinstance(t, str) and all(x in PRIM for x in t.split(",")))) \
        and not (spec[1] if len(spec) > 1 else {}).get("forceInput")


def build(spec):
    """spec: list of (id, type, title, widgets_values, {input: (src_id, src_slot)})"""
    links, nodes, lid = [], {}, 0
    for i, (nid, typ, title, wv, conns) in enumerate(spec):
        d = OI[typ]
        req, opt = d["input"].get("required", {}), d["input"].get("optional", {})
        order = d.get("input_order", {})
        names = order.get("required", list(req)) + order.get("optional", list(opt))
        inputs = []
        for name in names:
            s = req.get(name) or opt.get(name)
            t = s[0] if isinstance(s[0], str) else "COMBO"
            if is_widget(s):
                if name in conns:
                    inputs.append({"name": name, "type": t, "widget": {"name": name}, "link": None})
            else:
                inputs.append({"name": name, "type": t, "link": None})
        outs = [{"name": n, "type": t, "links": []} for n, t in zip(d["output_name"], d["output"])]
        nodes[nid] = {"id": nid, "type": typ, "pos": [100 + 340 * (i % 8), 100 + 280 * (i // 8)],
                      "size": [320, 130], "flags": {}, "order": i, "mode": 0, "inputs": inputs,
                      "outputs": outs, "title": title,
                      "properties": {"Node name for S&R": typ}, "widgets_values": wv}
    for nid, typ, title, wv, conns in spec:
        for name, (src, slot) in conns.items():
            lid += 1
            dst = nodes[nid]
            idx = next(j for j, s in enumerate(dst["inputs"]) if s["name"] == name)
            dst["inputs"][idx]["link"] = lid
            nodes[src]["outputs"][slot]["links"].append(lid)
            links.append([lid, src, slot, nid, idx, nodes[src]["outputs"][slot]["type"]])
    return {"id": str(uuid.uuid4()), "revision": 0, "last_node_id": max(nodes), "last_link_id": lid,
            "nodes": list(nodes.values()), "links": links, "groups": [], "config": {},
            "extra": {"ds": {"scale": 1, "offset": [0, 0]}}, "version": 0.4}


W, H = 2048, 1024
T2I_PREFIX = "img-txt-2-360 A full 360 degree equirectangular panorama in 2:1 spherical projection,"
OEDIT_PREFIX = ("Fill the green spaces according to the image. Outpaint as a seamless 360 equirectangular "
                "panorama (2:1). Keep the horizon level. Match left and right edges.")
spec = [
    # Shared: Krea 2 Raw + the turbo-distill accelerator = the fast tier (bench: quality tier is WORSE).
    (1, "UNETLoader", "Load Krea 2", ["krea2_raw_int8_convrot.safetensors", "default"], {}),
    (2, "CLIPLoader", "Load Encoder", ["qwen3vl_4b_abliterated_fp8_scaled.safetensors", "krea2", "default"], {}),
    (3, "VAELoader", "Load VAE", ["qwen_image_vae.safetensors"], {}),
    (4, "LoraLoaderModelOnly", "Accelerator", ["krea-2\\extra\\krea2_turbo_distill_r128.safetensors", 1.0],
     {"model": (1, 0)}),
    # A picture is optional: empty, the loader hands back a 1x1 blank and `loaded` false -> text branch.
    (5, "MpiLoadImage", "Input_Image", ["None", "alpha", False, ""], {}),
    (6, "MpiText", "Input_Positive", [""], {}),
    (7, "MpiInt", "Input_Seed", [12345], {}),

    # Text -> 360 (bench `t2i_fast`, seam 1.48 -> 0.74).
    (10, "MpiText", "T2I Trigger", [T2I_PREFIX], {}),
    (11, "StringConcatenate", "T2I Prompt", ["", "", " "], {"string_a": (10, 0), "string_b": (6, 0)}),
    (12, "LoraLoaderModelOnly", "360 Text LoRA", ["krea-2\\360\\krea2_t2i_360_erp_lora_v1.safetensors", 1.0],
     {"model": (4, 0)}),
    (13, "CLIPTextEncode", "T2I Encode", [""], {"clip": (2, 0), "text": (11, 0)}),
    (14, "ConditioningZeroOut", "T2I Negative", [], {"conditioning": (13, 0)}),
    (15, "EmptyLatentImage", "T2I Latent", [W, H, 1], {}),
    (16, "KSampler", "T2I Sample", [12345, "fixed", 10, 1.0, "er_sde", "simple", 1.0],
     {"model": (12, 0), "positive": (13, 0), "negative": (14, 0), "latent_image": (15, 0), "seed": (7, 0)}),
    (17, "VAEDecode", "T2I Decode", [], {"samples": (16, 0), "vae": (3, 0)}),
    (18, "MickmumpitzPanoRollHorizontal", "T2I Roll Seam To Centre", [0.5], {"image": (17, 0)}),
    (19, "MickmumpitzPanoSeamMask", "T2I Seam Mask", [W, H, 160, 32], {}),
    (20, "VAEEncode", "T2I Seam Encode", [], {"pixels": (18, 0), "vae": (3, 0)}),
    (21, "SetLatentNoiseMask", "T2I Seam Latent", [], {"samples": (20, 0), "mask": (19, 0)}),
    (22, "KSampler", "T2I Seam Pass", [12345, "fixed", 10, 1.0, "er_sde", "simple", 0.55],
     {"model": (12, 0), "positive": (13, 0), "negative": (14, 0), "latent_image": (21, 0), "seed": (7, 0)}),
    (23, "VAEDecode", "T2I Seam Decode", [], {"samples": (22, 0), "vae": (3, 0)}),
    (24, "MickmumpitzPanoRollHorizontal", "T2I Roll Back", [0.5], {"image": (23, 0)}),

    # Picture -> 360 (bench `ostris_fast` + the flat-sky soften, Fabio 2026-10-06 "the sky is now spot on").
    (30, "MickmumpitzPanoWarp", "Place Picture", [W, H, 1, 70.0, 0.0, 0.0, 0, 2.0, 10, 0.55, "#000000"],
     {"image": (5, 0)}),
    (31, "EmptyImage", "Green Canvas", [W, H, 1, 65280], {}),
    (32, "InvertMask", "Picture Mask", [], {"mask": (30, 2)}),
    (33, "ImageCompositeMasked", "Canvas", [0, 0, False],
     {"destination": (31, 0), "source": (30, 0), "mask": (32, 0)}),
    (34, "MickmumpitzPanoRollHorizontal", "Canvas Rolled", [0.5], {"image": (33, 0)}),
    (35, "Krea2OstrisEditModelPatch", "Ostris Edit Patch", [True], {"model": (4, 0)}),
    (36, "LoraLoaderModelOnly", "360 Outpaint LoRA",
     ["krea-2\\360\\krea2_oedit_360_erp_outpaint_lora_v1.safetensors", 1.0], {"model": (35, 0)}),
    (37, "ModelSamplingFlux", "Sampling Shift", [0.90625, 0.5, W, H], {"model": (36, 0)}),
    (38, "MpiText", "Outpaint Instruction", [OEDIT_PREFIX], {}),
    (39, "StringConcatenate", "Outpaint Prompt", ["", "", " "], {"string_a": (38, 0), "string_b": (6, 0)}),
    (40, "TextEncodeKrea2OstrisEdit", "Outpaint Encode", [""], {"clip": (2, 0), "prompt": (39, 0)}),
    (41, "MickmumpitzPanoKrea2Reference", "Pos Reference", [8.0],
     {"conditioning": (40, 0), "vae": (3, 0), "image": (33, 0)}),
    (42, "FluxKontextMultiReferenceLatentMethod", "Pos Ref Method", ["index_timestep_zero"],
     {"conditioning": (41, 0)}),
    (43, "TextEncodeKrea2OstrisEdit", "Negative Encode", ["ugly, low quality"], {"clip": (2, 0), "image1": (33, 0)}),
    (44, "MickmumpitzPanoKrea2Reference", "Neg Reference", [8.0],
     {"conditioning": (43, 0), "vae": (3, 0), "image": (33, 0)}),
    (45, "FluxKontextMultiReferenceLatentMethod", "Neg Ref Method", ["index_timestep_zero"],
     {"conditioning": (44, 0)}),
    (46, "MickmumpitzPanoKrea2Reference", "Seam Pos Reference", [8.0],
     {"conditioning": (42, 0), "vae": (3, 0), "image": (34, 0)}),
    (47, "MickmumpitzPanoKrea2Reference", "Seam Neg Reference", [8.0],
     {"conditioning": (45, 0), "vae": (3, 0), "image": (34, 0)}),
    (48, "EmptyLatentImage", "Outpaint Latent", [W, H, 1], {}),
    (49, "KSampler", "Outpaint Sample", [12345, "fixed", 10, 1.0, "er_sde", "simple", 1.0],
     {"model": (37, 0), "positive": (42, 0), "negative": (45, 0), "latent_image": (48, 0), "seed": (7, 0)}),
    (50, "VAEDecode", "Outpaint Decode", [], {"samples": (49, 0), "vae": (3, 0)}),
    (51, "MickmumpitzPanoHarmonizeBoundary", "Harmonize Boundary", [1.0, 8, 800, True],
     {"image": (50, 0), "plate": (33, 0), "inpaint_mask": (30, 2)}),
    (52, "ImageCompositeMasked", "Picture Back In", [0, 0, False],
     {"destination": (51, 0), "source": (30, 0), "mask": (32, 0)}),
    (53, "MpiWrapSoften", "Soften Flat Sky At Wrap", [12.0, 48, 6.0], {"image": (52, 0)}),
    (54, "MickmumpitzPanoRollHorizontal", "Roll Seam To Centre", [0.5], {"image": (53, 0)}),
    (55, "MickmumpitzPanoSeamMask", "Seam Mask", [W, H, 96, 24], {}),
    (56, "VAEEncode", "Seam Encode", [], {"pixels": (54, 0), "vae": (3, 0)}),
    (57, "SetLatentNoiseMask", "Seam Latent", [], {"samples": (56, 0), "mask": (55, 0)}),
    (58, "KSampler", "Seam Pass", [12345, "fixed", 10, 4.0, "euler", "simple", 0.45],
     {"model": (37, 0), "positive": (46, 0), "negative": (47, 0), "latent_image": (57, 0), "seed": (7, 0)}),
    (59, "VAEDecode", "Seam Decode", [], {"samples": (58, 0), "vae": (3, 0)}),
    (60, "MickmumpitzPanoRollHorizontal", "Roll Back", [0.5], {"image": (59, 0)}),

    # Lazy: only the branch the picture picks runs.
    (70, "MpiIfElse", "Picture Given ?", [True], {"boolean": (5, 4), "true": (60, 0), "false": (24, 0)}),
    (71, "PreviewImage", "Output_Image", [], {"images": (70, 0)}),
]

with open(OUT, "w", encoding="utf-8", newline="\n") as f:
    json.dump(build(spec), f, indent=2)
    f.write("\n")
print("wrote", OUT)
