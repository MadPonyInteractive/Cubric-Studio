# MPI-936: the Qwen-Image 2.1 graph as ComfyUI API JSON, in Klein's shape: ONE graph, the op picked by
# Input_wf_type (numbered as Klein's, so opInject reads the same): 1 t2i, 2 i2i, 3 control, 4 edit, 5 inpaint,
# 6 detail, 7 upscale. MpiAnySwitch10 and MpiIfElse are lazy, so only the picked branch runs.
# Official source for the model wiring: comfyui_workflow_templates_json 0.39 image_qwen_image_2_1_{t2i,image_edit}
# .json, minus the Qwen3.5 prompt-enhancer branch. Op branches follow klein_9b_t2i.json, minus its Flux-only
# parts (FluxGuidance, lcm, the refcontrol LoRA). Titles follow the app's injection law (Input_* / Output_Image).
# The 2.1 VAE decodes RGBA on every run: a branch that repaints an opaque source (i2i, inpaint, detail, upscale)
# drops the alpha with SplitImageWithAlpha; t2i and edit keep it (the transparent-background feature).
REFS = 8  # the shared `edit` op's multiReference8 ceiling
LANPAINT_INFO = 'LanPaint KSampler. For more info, visit https://github.com/scraed/LanPaint. If you find it useful, please give a star ⭐️!'


def graph(prompt, width=1024, height=1024, seed=42, refs=(), mask='', steps=25, cfg=1.0, wf=None, denoise=0.4,
          upscale=1.5, control=2, clip='qwen3vl_8b_fp8_scaled.safetensors', resolution=1024):
    g = {}

    def node(nid, cls, title, **inputs):
        g[str(nid)] = {'class_type': cls, 'inputs': inputs, '_meta': {'title': title}}
        return [str(nid), 0]

    model = node(1, 'UNETLoader', 'Load Diffusion Model',
                 unet_name='qwen_image_2.1_int8_convrot.safetensors', weight_dtype='default')
    for i in range(1, 7):  # the user LoRA rack, as Klein's and Boogu's
        model = node(49 + i, 'MpiLoraModel', f'Input_Lora_{i}', model=model, lora_name='None', strength_model=1)
    model = node(2, 'QwenImage21Cache', 'Qwen Image 2.1 Cache', model=model, device='auto', dtype='default')
    clip_ = node(3, 'CLIPLoader', 'Load CLIP', clip_name=clip, type='qwen_image', device='default')
    vae = node(4, 'VAELoader', 'Load VAE', vae_name='qwen_image_2.1_vae_bf16.safetensors')
    text = node(5, 'MpiText', 'Input_Positive', string=prompt)
    w = node(6, 'MpiInt', 'Input_Width', int=width)
    h = node(7, 'MpiInt', 'Input_Height', int=height)
    s = node(8, 'MpiInt', 'Input_Seed', int=seed)
    wf_type = node(9, 'MpiInt', 'Input_wf_type', int=wf or (4 if refs else 1))
    dn = node(60, 'MpiFloat', 'Input_denoise', float=denoise)

    def sampler(nid, title, positive, negative, latent, denoise_, model_=None):
        return node(nid, 'KSampler', title, model=model_ or model, seed=s, steps=steps, cfg=cfg, sampler_name='euler',
                    scheduler='simple', positive=positive, negative=negative, latent_image=latent, denoise=denoise_)

    def rgb(nid, image):  # the RGB part of an RGBA decode
        return node(nid, 'SplitImageWithAlpha', 'Split Image with Alpha', image=image)

    # Localised edit, Boogu's crop (MPI-428): a painted mask crops reference 1 round it, the crop is repainted,
    # and the result is stitched back. Input_Mask blocks when empty, but its `loaded` output never does.
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
    crop_latent = node(48, 'SetLatentNoiseMask', 'Set Latent Noise Mask', mask=['42', 2],
                       samples=node(47, 'VAEEncode', 'Encode Crop', pixels=['42', 1], vae=vae))

    images = {}
    for i in range(1, REFS + 1):
        title = 'Input_Image' if i == 1 else f'Input_Image_{i}'
        ref = refs[i - 1] if i <= len(refs) else ''
        node(10 + i, 'MpiLoadImage', title, image='None', channel='alpha', block_if_empty=False, string=ref)
        images[f'images.image_{i}'] = node(20 + i, 'ComfySwitchNode', f'Reference {i}', switch=[str(10 + i), 4],
                                           on_true=source if i == 1 else [str(10 + i), 0])

    # t2i / edit / inpaint (wf 1, 4, 5): the references condition the sampler. No image = t2i on the Empty
    # Latent; an image = edit on the encoder's latent (sized on reference 1); a mask = LanPaint on the crop,
    # Klein's route for both a masked edit and inpaint (the app refuses inpaint without a mask).
    enc = '30'
    node(30, 'TextEncodeQwenImage21', 'Text Encode Qwen Image 2.1', clip=clip_, vae=vae, prompt=text,
         negative_prompt='', resolution=resolution, **images)
    empty = node(31, 'EmptyLatentImage', 'Empty Latent', width=w, height=h, batch_size=1)
    latent = node(32, 'ComfySwitchNode', 'Edit Canvas', switch=['11', 4], on_true=[enc, 2], on_false=empty)
    plain = sampler(33, 'KSampler', [enc, 0], [enc, 1], latent, 1.0)
    lanpaint = node(49, 'LanPaint_KSampler', 'LanPaint KSampler', model=model, seed=s, steps=steps, cfg=cfg,
                    sampler_name='euler', scheduler='simple', positive=[enc, 0], negative=[enc, 1],
                    latent_image=crop_latent, denoise=1.0, LanPaint_NumSteps=2, LanPaint_PromptMode='Image First',
                    LanPaint_Info=LANPAINT_INFO, Inpainting_mode='🖼️ Image Inpainting')
    out = node(70, 'MpiIfElse', 'Masked Sampler', boolean=['40', 4], true=lanpaint, false=plain)
    img = node(34, 'VAEDecode', 'VAE Decode', samples=out, vae=vae)
    stitched = node(44, 'InpaintStitchImproved', 'Inpaint Stitch', stitcher=['42', 0], inpainted_image=rgb(46, img))
    edit = node(45, 'MpiIfElse', 'Masked Result', boolean=['40', 4], true=stitched, false=img)

    # i2i, detail and upscale repaint Input_Image from the prompt alone: no reference conditioning.
    plain_text = node(36, 'TextEncodeQwenImage21', 'Text Encode (prompt only)', clip=clip_, prompt=text,
                      negative_prompt='', resolution=resolution)
    pos, neg = ['36', 0], ['36', 1]

    # i2i (wf 2): Input_Image cropped to the ratio, then denoised from Input_denoise.
    sized = node(61, 'ImageResizeKJv2', 'Resize Image v2', image=['11', 0], width=w, height=h,
                 upscale_method='lanczos', keep_proportion='crop', pad_color='0, 0, 0', crop_position='center',
                 divisible_by=32, device='cpu')
    i2i = sampler(63, 'KSampler (i2i)', pos, neg, node(62, 'VAEEncode', 'VAE Encode', pixels=sized, vae=vae), dn)
    i2i = rgb(65, node(64, 'VAEDecode', 'VAE Decode (i2i)', samples=i2i, vae=vae))

    # detail (wf 6): the mask crop, upscaled to 1024, repainted at Input_denoise and stitched back. Our crop and
    # stitch rather than Klein's MaskDetailer, whose paste would meet the RGBA decode.
    detail = sampler(81, 'KSampler (detail)', pos, neg, crop_latent, dn)
    detail = node(84, 'InpaintStitchImproved', 'Inpaint Stitch (detail)', stitcher=['42', 0],
                  inpainted_image=rgb(83, node(82, 'VAEDecode', 'VAE Decode (detail)', samples=detail, vae=vae)))

    # upscale (wf 7): Klein's tiled upscale, at 2.1's sampler.
    big = node(90, 'ResizeImageMaskNode', 'Resize Image/Mask', input=['11', 0], resize_type='scale to multiple',
               **{'resize_type.multiple': 32}, scale_method='lanczos')
    factor = node(92, 'MpiFloat', 'Input_Upscale_Factor', float=upscale)
    grid = node(96, 'MpiGridDimensions', 'Mpi Grid Dimensions', image=big, upscale_factor=factor,
                horizontal_split=node(94, 'MpiInt', 'Grid_H', int=1), vertical_split=node(95, 'MpiInt', 'Grid_V', int=1),
                auto=node(93, 'MpiSimpleBoolean', 'Input_Auto_Grid', boolean=False))
    up = node(97, 'UltimateSDUpscale', 'Upscaling...', image=big, model=model, positive=pos, negative=neg, vae=vae,
              upscale_by=factor, seed=s, steps=steps, cfg=cfg, sampler_name='euler', scheduler='simple', denoise=dn,
              upscale_model=node(91, 'UpscaleModelLoader', 'Input_Upscale_Model', model_name='4x_NMKD-Siax_200k.pth'),
              mode_type='Linear', tile_width=grid, tile_height=['96', 1], mask_blur=8, tile_padding=32,
              seam_fix_mode='None', seam_fix_denoise=0.6, seam_fix_width=64, seam_fix_mask_blur=8, seam_fix_padding=16,
              force_uniform_tiles=False, tiled_decode=False, batch_size=1)
    up = rgb(98, up)

    # control (wf 3): an annotator picked by Input_Control_Net at CONTROL_TYPES' indices (1 pose, 2 depth,
    # 3 scribble, 4 canny, as SDXL's union) drives the 2.1 Fun ControlNet Union patch. Generated from the prompt
    # on an Empty Latent sized on the input at 1 MP. RGB out: bench run 3's depth result came back with 4.7% of
    # the subject itself at alpha 200-240, a see-through ghost nobody asked for.
    src = node(100, 'ImageScaleToTotalPixels', 'Scale Image to Total Pixels', image=['11', 0],
               upscale_method='lanczos', megapixels=1, resolution_steps=32)
    maps = {f'any_{i}': node(100 + i, 'AIO_Preprocessor', 'AIO Aux Preprocessor', preprocessor=p, resolution=1024,
                             image=src)
            for i, p in enumerate(('OpenposePreprocessor', 'DepthAnythingV2Preprocessor', 'ScribblePreprocessor',
                                   'CannyEdgePreprocessor'), 1)}
    cmap = node(105, 'MpiAnySwitch10', 'Control Map', select=node(106, 'MpiInt', 'Input_Control_Net', int=control), **maps)
    cmodel = node(108, 'QwenImageDiffsynthControlnet', 'Qwen Image 2.1 ControlNet', model=model, vae=vae, image=cmap,
                  strength=node(107, 'MpiFloat', 'Input_Control_strength', float=1.0),
                  model_patch=node(109, 'ModelPatchLoader', 'Load ControlNet Patch',
                                   name='qwen_image_2.1_fun_controlnet_union_int8_convrot.safetensors'))
    size = node(110, 'GetImageSize', 'Get Image Size', image=src)
    clat = node(111, 'EmptyLatentImage', 'Empty Latent (control)', width=size, height=['110', 1], batch_size=1)
    control = rgb(114, node(113, 'VAEDecode', 'VAE Decode (control)', vae=vae,
                            samples=sampler(112, 'KSampler (control)', pos, neg, clat, 1.0, cmodel)))

    final = node(99, 'MpiAnySwitch10', 'Mpi Any Switch 10', select=wf_type, any_1=edit, any_2=i2i, any_3=control,
                 any_4=edit, any_5=edit, any_6=detail, any_7=up)
    node(35, 'PreviewImage', 'Output_Image', images=final)
    return g
