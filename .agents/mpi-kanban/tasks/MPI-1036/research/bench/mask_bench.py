# MPI-1036 Phase 2: the mask path. SAM3 finds the cat ears per frame -> InpaintCropImproved crops round them ->
# H3 r2v edits only the crop -> InpaintStitchImproved pastes it back into the untouched source. U_* = the same edit
# on the whole frame, the timing baseline. All turbo 8-step, LoRA off, seed 904234, source audio muxed back.
# Run under the GPU lease.
import json, sys, time, urllib.request

URL = 'http://127.0.0.1:8188'
CLIP, N = 'mpi1036_ears_last3s_24fps.mp4', 73          # last 3 s of Fabio's clip, 17k+5 frames at 24 fps
CROP = 512                                              # crop target, square so the head gives H3 context
TURBO = 'minimax-h3\\minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors'

TAIL = ("overall_soundscape: A small quiet bedroom room tone.\n"
        "non_diegetic_music: An upbeat pop song she mouths along to.\n")
KEEP = ("Keep everything else exactly as it is in <Video 1>: her face, expressions, hair, top, the wall and the light. "
        "No text, subtitles, captions, usernames, logos or watermarks, no blur, no warped anatomy, no flicker.")
EDITS = {
    'horns': ("but instead of the black cat-ear headband she has two small glossy red demon horns growing out of her "
              "hair on top of her head, right where the cat ears were; no cat ears and no headband are left. "
              "The horns move with her head"),
    'remove': ("but the black cat-ear headband is gone: nothing sits on her head, just her own dark wavy hair where "
               "the cat ears were, and no headband is left"),
}


def prompt(edit, crop):
    if crop:
        look = ("A close view of the top of a young woman's head and her long dark brown wavy hair against a pale "
                "green wall: soft warm indoor light, natural phone-video colour, sharp detail.\n")
        shot = "The framing follows <Video 1> exactly, frame for frame."
    else:
        look = ("A young woman with long dark wavy hair in a white ribbed long-sleeve top and white shorts dances "
                "playfully against a pale green wall: soft warm indoor light, natural phone-video colour.\n")
        shot = "The camera holds still and frames her exactly as <Video 1> does, as she steps in close to the lens."
    return (look +
            "Use <Video 1> as the woman and her whole performance, her face, hair, clothes, every move and its "
            "timing, and as the camera framing, kept exactly as it is; change only what she wears on her head.\n"
            f"[Shot 1] The woman from <Video 1> moves exactly as she does in <Video 1>, {EDITS[edit]}.\n"
            f"{shot}\n" + TAIL + KEEP)


def graph(name):
    prefix, edit = name.split('_', 1) if '_' in name else (name, '')
    masked, base, flags = name.startswith('M') or name == 'preview', prefix[:2], prefix[2:]
    v2 = base in ('M2', 'M5')  # generous mask a user would paint + grade match on the band round it
    v5 = base == 'M5'  # the still square is the RENDER area (context mask), the grown shape the PASTE area
    v3 = base in ('M3', 'M4')  # Fabio's fallback: the SAM3 mask as ONE still square (union of every frame), pasted whole
    pad = 128 if base == 'M4' else 64  # Fabio: 64 px minimum, maybe 128
    # sync levers (H3 lags 2-4 frames through fast motion): a = pair the clip's own soundtrack with <Video 1>,
    # l = the akatz-ai swap LoRA, trained to keep the source's position, pose and movement
    snd, lora = 'a' in flags, 'l' in flags
    # c = say who moves (Fabio): in a crop the model cannot tell a camera push-in from her stepping toward the lens
    cam = 'c' in flags
    g = {
        '139': {'class_type': 'LoadVideo', 'inputs': {'file': CLIP}},
        '148': {'class_type': 'GetVideoComponents', 'inputs': {'video': ['139', 0]}},
    }
    video, w, h = ['148', 0], 576, 1024
    if masked:
        g['300'] = {'class_type': 'CheckpointLoaderSimple', 'inputs': {'ckpt_name': 'sam3.1_multiplex_fp16.safetensors'}}
        g['301'] = {'class_type': 'CLIPTextEncode', 'inputs': {'clip': ['300', 1], 'text': 'cat ears'}}
        g['302'] = {'class_type': 'SAM3_Detect', 'inputs': {'model': ['300', 0], 'image': ['148', 0], 'conditioning': ['301', 0],
                                                            'threshold': 0.5, 'refine_iterations': 2, 'individual_masks': False}}
        if v3 or v5:
            g['310'] = {'class_type': 'MpiMaskSquareBbox', 'inputs': {'mask': ['302', 0], 'padding': pad}}
        g['303'] = {'class_type': 'InpaintCropImproved', 'inputs': {
            'image': ['148', 0], 'mask': ['310', 0] if v3 else ['302', 0], 'downscale_algorithm': 'bilinear', 'upscale_algorithm': 'bicubic',
            'preresize': False, 'preresize_mode': 'ensure minimum resolution', 'preresize_min_width': 1024,
            'preresize_min_height': 1024, 'preresize_max_width': 16384, 'preresize_max_height': 16384,
            'mask_fill_holes': True, 'mask_expand_pixels': 0 if v3 else 32 if v2 else 12, 'mask_invert': False,
            'mask_blend_pixels': 24 if (v2 or v3) else 16,
            'mask_hipass_filter': 0.1, 'extend_for_outpainting': False, 'extend_up_factor': 1.0, 'extend_down_factor': 1.0,
            'extend_left_factor': 1.0, 'extend_right_factor': 1.0, 'context_from_mask_extend_factor': 1.0 if v5 else 1.25 if v3 else 1.6,
            'output_resize_to_target_size': True, 'output_target_width': CROP, 'output_target_height': CROP,
            'output_padding': '32', 'device_mode': 'cpu (compatible)'}}
        if v5:
            g['303']['inputs']['optional_context_mask'] = ['310', 0]
        g['304'] = {'class_type': 'MpiSaveVideo', 'inputs': {'images': ['303', 1], 'fps': 24, 'filename_prefix': f'mpi1036/{name}_crop_in'}}
        g['305'] = {'class_type': 'MaskToImage', 'inputs': {'mask': ['302', 0]}}
        g['306'] = {'class_type': 'MpiSaveVideo', 'inputs': {'images': ['305', 0], 'fps': 24, 'filename_prefix': f'mpi1036/{name}_mask'}}
        video, w, h = ['303', 1], CROP, CROP
        if name == 'preview':
            return g
    g.update({
        '127': {'class_type': 'UNETLoader', 'inputs': {'unet_name': 'minimax_h3_ref2va_pruned_int8_convrot.safetensors', 'weight_dtype': 'default'}},
        '128': {'class_type': 'CLIPLoader', 'inputs': {'clip_name': 'qwen3vl_32b_h3_ultra_uncensored_heretic_int8_convrot.safetensors', 'type': 'minimax', 'device': 'default'}},
        '119': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_video_vae_int8_convrot.safetensors'}},
        '120': {'class_type': 'VAELoader', 'inputs': {'vae_name': 'minimax_h3_audio_vae_fp32.safetensors'}},
        '129': {'class_type': 'RandomNoise', 'inputs': {'noise_seed': 904234}},
        '123': {'class_type': 'KSamplerSelect', 'inputs': {'sampler_name': 'res_multistep'}},
        '136': {'class_type': 'MiniMaxH3ReferenceToVideo', 'inputs': {
            'clip': ['128', 0], 'vae': ['119', 0], 'audio_vae': ['120', 0],
            # the still square holds her face too, so the look line names it
            'prompt': prompt(edit, masked).replace("the top of a young woman's head", "a young woman's head and face") if (v3 or v5) else prompt(edit, masked),
            'width': w, 'height': h, 'length': N, 'ref_image_size': 'match', 'ref_videos.ref_video_0': video}},
        '145': {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['147', 0] if lora else ['127', 0], 'lora_name': TURBO, 'strength_model': 1.0}},
        '124': {'class_type': 'BasicScheduler', 'inputs': {'model': ['147', 0] if lora else ['127', 0], 'scheduler': 'simple', 'steps': 8, 'denoise': 1.0}},
        '126': {'class_type': 'BasicGuider', 'inputs': {'model': ['145', 0], 'conditioning': ['136', 0]}},
        '125': {'class_type': 'SamplerCustomAdvanced', 'inputs': {'noise': ['129', 0], 'guider': ['126', 0], 'sampler': ['123', 0], 'sigmas': ['124', 0], 'latent_image': ['136', 1]}},
        '122': {'class_type': 'VAEDecode', 'inputs': {'samples': ['125', 0], 'vae': ['119', 0]}},
    })
    if lora:
        g['147'] = {'class_type': 'LoraLoaderModelOnly', 'inputs': {'model': ['127', 0], 'strength_model': 1.0,
                                                                    'lora_name': 'minimax-h3\\h3_character_swap_pro4500_1000.safetensors'}}
    if snd:
        g['136']['inputs']['ref_video_audios.ref_video_audio_0'] = ['148', 1]
    if cam:
        p = g['136']['inputs']['prompt']
        assert "The framing follows <Video 1> exactly, frame for frame." in p
        g['136']['inputs']['prompt'] = p.replace(
            "The framing follows <Video 1> exactly, frame for frame.",
            "The camera is locked off and never moves, zooms or reframes: it is the woman who leans in toward the lens "
            "and back, growing larger in frame and smaller again at exactly the moments she does in <Video 1>, frame for frame.")
    out = ['122', 0]
    if masked:
        g['307'] = {'class_type': 'MpiSaveVideo', 'inputs': {'images': ['122', 0], 'fps': 24, 'filename_prefix': f'mpi1036/{name}_crop_out'}}
        fixed = ['122', 0]
        if v2 or v3:  # H3 re-renders the crop a touch lighter: fit gain+offset on the band outside the mask, where both agree
            g['309'] = {'class_type': 'ComposeColorMatch', 'inputs': {
                'destination': ['303', 1], 'source': ['122', 0], 'mask': ['303', 2], 'correction': 'Grade match (surround)',
                'strength': 1.0, 'saturation': 1.0, 'black_point': 0.0, 'edge_falloff': 0, 'grade_fit': 'Gain + offset',
                'surround_band': 48, 'colormatch_reference': 'Destination', 'method': 'mkl', 'reference_region': 'Outside mask',
                'multithread': True, 'temporal_anchor': False, 'anchor_strength': 1.0, 'anchor_frames': 0}}
            fixed = ['309', 0]
        g['308'] = {'class_type': 'InpaintStitchImproved', 'inputs': {'stitcher': ['303', 0], 'inpainted_image': fixed}}
        out = ['308', 0]
    # the source track, not H3's: the edit is pixels only (akatz-ai remuxed the source audio the same way)
    g['92'] = {'class_type': 'MpiSaveVideo', 'inputs': {'images': out, 'audio': ['148', 1], 'fps': 24,
                                                        'filename_prefix': f'mpi1036/{name}', 'use_audio': True, 'truncate_to_audio': False}}
    return g


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


for name in sys.argv[1:]:
    t0 = time.time()
    try:
        pid = call('/prompt', {'prompt': graph(name), 'client_id': 'mpi1036-mask'})['prompt_id']
    except urllib.error.HTTPError as e:
        print(name, 'REJECTED', e.read().decode()[:3000], flush=True)
        sys.exit(1)
    print(f'{name}: queued {pid}', flush=True)
    while True:
        time.sleep(5)
        hist = call(f'/history/{pid}')
        if pid in hist:
            st = hist[pid].get('status', {})
            outs = [f for o in hist[pid].get('outputs', {}).values() for k in ('gifs', 'videos', 'images') for f in o.get(k, [])]
            print(f'{name}: {st.get("status_str")} in {time.time() - t0:.0f}s ->', [f.get('subfolder', '') + '/' + f['filename'] for f in outs], flush=True)
            if st.get('status_str') != 'success':
                print(json.dumps(st.get('messages', []))[-3000:], flush=True)
                sys.exit(1)
            break
print('ALL DONE', flush=True)
