# MPI-936: the Qwen-Image 2.1 graph as ComfyUI API JSON. ONE graph serves t2i AND edit: with Input_Image
# empty, every reference switch emits None (TextEncodeQwenImage21 skips None refs) and the sampler takes the
# Empty Latent; with Input_Image loaded, the sampler takes the encoder's latent (sized on reference 1).
# Official source: comfyui_workflow_templates_json 0.39 image_qwen_image_2_1_{t2i,image_edit}.json, minus the
# Qwen3.5 prompt-enhancer branch. Titles follow the app's injection law (Input_* / Output_Image).
REFS = 8  # the shared `edit` op's multiReference8 ceiling


def graph(prompt, width=1024, height=1024, seed=42, refs=(), mask='', steps=25, cfg=1.0,
          clip='qwen3vl_8b_fp8_scaled.safetensors', resolution=1024):
    g = {}

    def node(nid, cls, title, **inputs):
        g[str(nid)] = {'class_type': cls, 'inputs': inputs, '_meta': {'title': title}}
        return [str(nid), 0]

    model = node(1, 'UNETLoader', 'Load Diffusion Model',
                 unet_name='qwen_image_2.1_int8_convrot.safetensors', weight_dtype='default')
    model = node(2, 'QwenImage21Cache', 'Qwen Image 2.1 Cache', model=model, device='auto', dtype='default')
    clip_ = node(3, 'CLIPLoader', 'Load CLIP', clip_name=clip, type='qwen_image', device='default')
    vae = node(4, 'VAELoader', 'Load VAE', vae_name='qwen_image_2.1_vae_bf16.safetensors')
    text = node(5, 'MpiText', 'Input_Positive', string=prompt)
    w = node(6, 'MpiInt', 'Input_Width', int=width)
    h = node(7, 'MpiInt', 'Input_Height', int=height)
    s = node(8, 'MpiInt', 'Input_Seed', int=seed)

    # Localised edit, Boogu's pattern (MPI-428): a painted mask crops reference 1 round it, the crop is edited,
    # and the result is stitched back. No mask = whole-image edit. Input_Mask blocks when empty, but its
    # `loaded` output never does and both MpiIfElse are lazy, so the crop branch simply never runs.
    node(40, 'MpiLoadImage', 'Input_Mask', image='None', channel='red', block_if_empty=True, string=mask)
    node(41, 'MpiMaskSquareBbox', 'Mpi Mask Square Bbox', padding=64, mask=['40', 1])
    node(42, 'InpaintCropImproved', 'Inpaint Crop', image=['11', 0], mask=['40', 1], optional_context_mask=['41', 0],
         downscale_algorithm='bilinear', upscale_algorithm='bicubic', preresize=False,
         preresize_mode='ensure minimum resolution', preresize_min_width=1024, preresize_min_height=1024,
         preresize_max_width=16384, preresize_max_height=16384, mask_fill_holes=False, mask_expand_pixels=6,
         mask_invert=False, mask_blend_pixels=32, mask_hipass_filter=0.1, extend_for_outpainting=False,
         extend_up_factor=1, extend_down_factor=1, extend_left_factor=1, extend_right_factor=1,
         context_from_mask_extend_factor=1, output_resize_to_target_size=True, output_target_width=1024,
         output_target_height=1024, output_padding='32', device_mode='gpu (much faster)')
    source = node(43, 'MpiIfElse', 'Masked Source', boolean=['40', 4], true=['42', 1], false=['11', 0])

    images = {}
    for i in range(1, REFS + 1):
        title = 'Input_Image' if i == 1 else f'Input_Image_{i}'
        ref = refs[i - 1] if i <= len(refs) else ''
        node(10 + i, 'MpiLoadImage', title, image='None', channel='alpha', block_if_empty=False, string=ref)
        images[f'images.image_{i}'] = node(20 + i, 'ComfySwitchNode', f'Reference {i}', switch=[str(10 + i), 4],
                                           on_true=source if i == 1 else [str(10 + i), 0])

    enc = f'{30}'
    node(30, 'TextEncodeQwenImage21', 'Text Encode Qwen Image 2.1', clip=clip_, vae=vae, prompt=text,
         negative_prompt='', resolution=resolution, **images)
    empty = node(31, 'EmptyLatentImage', 'Empty Latent', width=w, height=h, batch_size=1)
    latent = node(32, 'ComfySwitchNode', 'Edit Canvas', switch=['11', 4], on_true=[enc, 2], on_false=empty)
    out = node(33, 'KSampler', 'KSampler', model=model, seed=s, steps=steps, cfg=cfg, sampler_name='euler',
               scheduler='simple', positive=[enc, 0], negative=[enc, 1], latent_image=latent, denoise=1.0)
    img = node(34, 'VAEDecode', 'VAE Decode', samples=out, vae=vae)
    stitched = node(44, 'InpaintStitchImproved', 'Inpaint Stitch', stitcher=['42', 0], inpainted_image=img)
    img = node(45, 'MpiIfElse', 'Masked Result', boolean=['40', 4], true=stitched, false=img)
    node(35, 'PreviewImage', 'Output_Image', images=img)
    return g
