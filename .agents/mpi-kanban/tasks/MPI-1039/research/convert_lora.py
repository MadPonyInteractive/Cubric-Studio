"""Rename a diffusers FLUX.3 LoRA to ComfyUI's native FLUX.3 names (MPI-1039).

  python convert_lora.py <in.safetensors> <out.safetensors>

ComfyUI (comfy/lora.py) maps FLUX.3 LoRAs only by native module names (`q_proj` slices of the fused
`qkv`, plus `lora_unet_*`); the diffusers names (`mode_blocks.image.N.attn.to_q`) would load as nothing.
"""
import re, sys
from safetensors.torch import load_file, save_file

BLOCKS = [(r'^transformer\.mode_blocks\.', 'diffusion_model.content_mode_blocks.'),
          (r'^transformer\.txt_mode_blocks\.', 'diffusion_model.txt_mode_blocks.'),
          (r'^transformer\.single_transformer_blocks\.', 'diffusion_model.single_blocks.')]
LAYERS = {'attn.to_q': 'q_proj', 'attn.to_k': 'k_proj', 'attn.to_v': 'v_proj', 'attn.to_out.0': 'attn_out',
          'ff.linear_in': 'mlp_in', 'ff.linear_out': 'mlp_out'}


def rename(k):
    for pat, rep in BLOCKS:
        if re.match(pat, k):
            k = re.sub(pat, rep, k)
            break
    else:
        raise KeyError(k)
    for old, new in LAYERS.items():
        if f'.{old}.lora_' in k:
            return k.replace(f'.{old}.lora_', f'.{new}.lora_')
    raise KeyError(k)


if __name__ == '__main__':
    sd = load_file(sys.argv[1])
    out = {rename(k): v for k, v in sd.items()}
    assert len(out) == len(sd)
    save_file(out, sys.argv[2])
    print(len(out), 'keys, e.g.', next(iter(out)))
