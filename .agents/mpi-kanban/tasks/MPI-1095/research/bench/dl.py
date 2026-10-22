import os, time
from huggingface_hub import hf_hub_download
tok = open('C:/Users/Fabio/.secrets/hf.txt').read().split()[0]
G, CM = 'G:/models', 'G:/ComfyUi/ComfyUI/models'
jobs = [  # (repo, file, local_dir) - small first so the graph can be wired early
    ('Lightricks/LTX-2.5', 'model_patches/ltx-2.5-duration-head-bf16.safetensors', CM),
    ('Lightricks/LTX-2.5', 'vae/ltx-2.5-audio-vae-bf16.safetensors', G),
    ('Lightricks/LTX-2.5', 'vae/ltx-2.5-video-vae-conv-bf16.safetensors', G),
    ('Lightricks/LTX-2.5', 'vae/ltx-2.5-video-vae-bf16.safetensors', G),
    ('Lightricks/LTX-2.5', 'latent_upscale_models/ltx-2.5-latent-spatial-upscaler-x2-bf16-1.0.safetensors', CM),
    ('Lightricks/LTX-2.3', 'ltx-2.3-spatial-upscaler-x2-1.1.safetensors', CM + '/latent_upscale_models'),
    ('Lightricks/LTX-2.5-22b-IC-LoRA-Ingredients', 'ltx-2.5-22b-ic-lora-ingredients-0.9.safetensors', G + '/loras/ltx-2.5'),
    ('Lightricks/LTX-2.5', 'text_encoders/gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors', G),
    ('Lightricks/LTX-2.5', 'diffusion_models/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors', G),
    ('Kijai/LTX2.3_comfy', 'diffusion_models/ltx-2.3-22b-distilled-1.1_transformer_only_int8_convrot.safetensors', G),
]
for repo, f, d in jobs:
    t = time.time()
    try:
        p = hf_hub_download(repo, f, local_dir=d, token=tok)
        print(f'OK {os.path.getsize(p):,} B {time.time()-t:.0f}s {p}', flush=True)
    except Exception as e:
        print(f'FAIL {repo} {f}: {e}', flush=True)
print('ALL DONE', flush=True)
