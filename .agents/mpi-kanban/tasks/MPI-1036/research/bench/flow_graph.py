# MPI-1036 Phase 3: the Video Edit Flow graph, as an API prompt with the app's Input_*/Output_* titles.
# The authoring source until it is proven on the bench; then it is loaded into the ComfyUI frontend and exported
# to comfy_workflows/raw/flow_video_edit.json (LiteGraph), which is what ships.
#
# One single-pass H3 r2v turbo graph (the shape Phases 1 and 2 passed), two routes:
#   masked  (Input_Target names an object): SAM3 finds it -> MpiMaskSquareBbox pad 64 (one still square for the
#           clip) -> InpaintCropImproved 512 -> H3 + swap LoRA -> MpiGradeMatch band 48 -> InpaintStitchImproved
#   whole   (Input_Target empty): the clip resized to ~0.59 MP -> H3 (swap LoRA only for Swap the person keeping
#           the video's room) -> out at that size
# Both: the clip trimmed to H3's 17k+5 frame grid, the SOURCE soundtrack muxed back (the edit is pixels only).
#
# Input_Operation: 1 Swap the person, 2 Swap the head, 3 Change the outfit, 4 Change the background, 5 Anything else.
# Template 6 = Swap the person in the PICTURE's room (performance capture), picked in-graph when op 1 has a picture
# and Input_Keep_Background is false.

H3_UNET = 'minimax_h3_ref2va_pruned_int8_convrot.safetensors'
H3_CLIP = 'qwen3vl_32b_h3_ultra_uncensored_heretic_int8_convrot.safetensors'
H3_VAE = 'minimax_h3_video_vae_int8_convrot.safetensors'
H3_AVAE = 'minimax_h3_audio_vae_fp32.safetensors'
TURBO = 'minimax-h3\\minimax_h3_ref2v_turbo_8step_v1.0_768p_comfyui_bf16.safetensors'
SWAP = 'minimax-h3\\h3_character_swap_pro4500_1000.safetensors'
SAM3 = 'sam3.1_multiplex_fp16.safetensors'
CROP = 512
AREA = 576 * 1024  # whole-frame render area, the Phase 1 bench size

KEEP_SHOT = ("the camera, framing, background, lighting, objects and all other people of <Video 1>")
MATCH = "Match {who}'s position, scale, pose, expression, mouth and every movement throughout the clip."
PHOTO = {
    1: ("Replace only {who} in <Video 1> with the character in <Picture 1>. Keep the character's identity, face, hair, "
        "outfit and art style from <Picture 1>, and use it for the back of the head whenever they turn away. "
        f"Preserve {KEEP_SHOT}. {MATCH} Do not show <Picture 1> itself or its background.\n{{words}}"),
    2: ("Replace only the head and face of {who} in <Video 1> with the head and face of the character in <Picture 1>: "
        "their face, hair, skin and features from every angle, and the back of the head whenever {who} turns away. "
        f"Keep {{who}}'s body, clothes and hands, and {KEEP_SHOT}. Match the head's position, angle, expression, mouth "
        "and every movement throughout the clip. Do not show <Picture 1> itself, its body or its background.\n{words}"),
    3: ("Change what {who} in <Video 1> wears to match <Picture 1>, taking only what is worn there, or the bare skin it "
        "shows, never its face, pose or room. Keep {who}'s face, hair, body and every movement, and "
        f"{KEEP_SHOT}; the clothes move and fold with the body.\n{{words}}"),
    4: ("Use <Video 1> as {who} and their whole performance, their face, hair, clothes, every move and its timing, and "
        "as the camera framing, kept exactly as it is; use <Picture 1> only as the location and its light, without "
        "taking its composition, its camera angle, its grade or any person in it.\n"
        "[Shot 1] {who} from <Video 1> moves exactly as in <Video 1>, move for move, and the place around them is now "
        "the location of <Picture 1>, its light falling on them. {words}"),
    5: ("Use <Picture 1> as the reference for this change to <Video 1>: {words} Keep everything else exactly as it is "
        "in <Video 1>: every person, their performance, every move and its timing, the camera framing, the room and "
        "the light."),
    6: ("Use <Picture 1> as the character, their face, hair, outfit and art style, and as the location and its light, "
        "without taking its composition or its camera angle; use <Video 1> only as the performance of {who}, every "
        "move, expression, mouth movement and its timing, and its camera framing, and take nothing else from it, not "
        "its room, its performer's looks, its image quality, its grade or its text.\n"
        "[Shot 1] The character from <Picture 1> performs exactly what {who} does in <Video 1>, move for move, in the "
        "location of <Picture 1>. {words}\n"
        "The camera frames them exactly as <Video 1> does. No phone-video look: the picture quality of <Picture 1>."),
}
NO_PHOTO = {
    1: f"Replace only {{who}} in <Video 1> with this new person: {{words}} Preserve {KEEP_SHOT}. {MATCH}",
    2: (f"Replace only the head and face of {{who}} in <Video 1>: {{words}} Keep {{who}}'s body, clothes and hands, and "
        f"{KEEP_SHOT}. Match the head's position, angle, expression, mouth and every movement throughout the clip."),
    3: (f"Change only what {{who}} wears in <Video 1>: {{words}} Keep {{who}}'s face, hair, body and every movement, and "
        f"{KEEP_SHOT}; the clothes move and fold with the body."),
    4: ("Use <Video 1> as {who} and their whole performance, their face, hair, clothes, every move and its timing, and "
        "as the camera framing, kept exactly as it is; change only the place around them.\n"
        "[Shot 1] {who} from <Video 1> moves exactly as in <Video 1>, move for move, and the place around them is now "
        "this: {words}"),
    5: ("Change <Video 1> like this: {words} Keep everything else exactly as it is in <Video 1>: every person, their "
        "performance, every move and its timing, the camera framing, the room and the light."),
}
NO_PHOTO[6] = NO_PHOTO[1]  # no picture, so there is no picture room to take
TAIL_WHOLE = ("No text, subtitles, captions, usernames, logos or watermarks, no blur, no compression artefacts, no "
              "warped anatomy, no flicker.")
# The masked tail KEEPS "no text" (Fabio, 2026-10-08): without it R1 re-drew the caption inside the box garbled; with
# it (the passed M3l run) the caption the box holds is erased cleanly. Text outside the box is never touched.
TAIL_MASKED = ("Change only {target}; everything else stays exactly as it is in <Video 1>, and the framing follows "
               "<Video 1> exactly, frame for frame.\n" + TAIL_WHOLE)


def node(cls, title, **inputs):
    return {'class_type': cls, 'inputs': inputs, '_meta': {'title': title}}


def graph(video='None', image='None', positive='', operation=1, keep_background=True, who='the person',
          target='', seed=904234, prefix='MpiVideo_Edit'):
    """video/image: bench picker values (the app injects `string` and the sync resets the picker to None)."""
    g = {}
    # ---- inputs
    g['10'] = node('MpiLoadVideoUpload', 'Input_Video', video=video, block_if_empty=True, force_rate=24, string='')
    g['11'] = node('MpiLoadImage', 'Input_Image', image=image, channel='alpha', block_if_empty=False, string='')
    g['12'] = node('MpiText', 'Input_Positive', string=positive)
    g['13'] = node('MpiInt', 'Input_Operation', int=operation)
    g['14'] = node('MpiSimpleBoolean', 'Input_Keep_Background', boolean=keep_background)
    # MpiText, never MpiString: the app treats an Input_* MpiString as a media PATH and stages it as a file
    # (comfyController PATH_MEDIA_CLASSES), so 'the person' would be resolved as a filename.
    g['15'] = node('MpiText', 'Input_Who', string=who)
    g['16'] = node('MpiText', 'Input_Target', string=target)
    g['17'] = node('MpiInt', 'Input_Seed', int=seed)

    # ---- routing
    g['20'] = node('MpiAnyChecker', 'Masked? (a "what to change" was typed)', any=['16', 0])
    # A hidden field keeps its value (fields.md), so the graph re-checks: a box cannot hold a background.
    g['23'] = node('MpiMath', 'Masked? (typed, and not Change the background)', a=['20', 1], b=['13', 0],
                   math_expression='(a * (b != 4)) > 0')
    g['21'] = node('MpiMath', 'Swap LoRA on? (masked, or Swap the person in the video room)',
                   a=['23', 0], b=['13', 0], c=['14', 0], math_expression='(a + (b == 1) * c) > 0')
    g['22'] = node('MpiMath', 'Template (6 = the person into the picture room)',
                   a=['13', 0], b=['11', 4], c=['14', 0], math_expression='6 if (a == 1) * b * (1 - c) > 0 else a')

    # ---- the clip on H3's 17k+5 grid, and its soundtrack
    g['30'] = node('MpiMath', 'Frames on the H3 grid (17k+5)', a=['10', 3], math_expression='floor((a - 5) / 17) * 17 + 5')
    g['31'] = node('GetImageRangeFromBatch', 'Source on the grid', images=['10', 0], start_index=0, num_frames=['30', 0])
    g['32'] = node('EmptyAudio', 'Silence (source has no audio)', duration=['10', 4], sample_rate=44100, channels=2)
    g['33'] = node('MpiIfElse', 'has_audio ? source audio : silence', boolean=['10', 7], true=['10', 1], false=['32', 0])
    g['34'] = node('MpiMath', 'Last frame', a=['30', 0], math_expression='a - 1')
    g['35'] = node('MpiAudioRange', 'Source audio on the grid', audio=['33', 0], fps=['10', 2], start=0, end=['34', 0])

    # ---- whole frame: resized to the render area, aspect kept, 32-divisible
    g['40'] = node('MpiMath', 'Render width', a=['10', 5], b=['10', 6],
                   math_expression=f'floor(sqrt({AREA} * a / b) / 32 + 0.5) * 32')
    g['41'] = node('MpiMath', 'Render height', a=['10', 6], b=['10', 5],
                   math_expression=f'floor(sqrt({AREA} * a / b) / 32 + 0.5) * 32')
    g['42'] = node('ImageResizeKJv2', 'Whole frame at the render size', image=['31', 0], width=['40', 0], height=['41', 0],
                   upscale_method='lanczos', keep_proportion='crop', pad_color='0, 0, 0', crop_position='center',
                   divisible_by=32, device='cpu')

    # ---- masked: SAM3 -> one still square -> crop
    g['50'] = node('CheckpointLoaderSimple', 'SAM3', ckpt_name=SAM3)
    g['51'] = node('CLIPTextEncode', 'What to find', clip=['50', 1], text=['16', 0])
    g['52'] = node('SAM3_Detect', 'Find it in every frame', model=['50', 0], image=['31', 0], conditioning=['51', 0],
                   threshold=0.5, refine_iterations=2, individual_masks=False)
    g['53'] = node('MpiMaskSquareBbox', 'One still square round it (pad 64)', mask=['52', 0], padding=64)
    g['54'] = node('InpaintCropImproved', 'Crop the square', image=['31', 0], mask=['53', 0],
                   downscale_algorithm='bilinear', upscale_algorithm='bicubic', preresize=False,
                   preresize_mode='ensure minimum resolution', preresize_min_width=1024, preresize_min_height=1024,
                   preresize_max_width=16384, preresize_max_height=16384, mask_fill_holes=True, mask_expand_pixels=0,
                   mask_invert=False, mask_blend_pixels=24, mask_hipass_filter=0.1, extend_for_outpainting=False,
                   extend_up_factor=1.0, extend_down_factor=1.0, extend_left_factor=1.0, extend_right_factor=1.0,
                   context_from_mask_extend_factor=1.25, output_resize_to_target_size=True, output_target_width=CROP,
                   output_target_height=CROP, output_padding='32', device_mode='cpu (compatible)')

    # ---- what H3 sees
    g['60'] = node('MpiIfElse', 'masked ? crop : whole frame', boolean=['23', 0], true=['54', 1], false=['42', 0])
    g['63'] = node('MpiInt', 'Crop size', int=CROP)
    g['61'] = node('MpiIfElse', 'masked ? crop width : render width', boolean=['23', 0], true=['63', 0], false=['40', 0])
    g['62'] = node('MpiIfElse', 'masked ? crop height : render height', boolean=['23', 0], true=['63', 0], false=['41', 0])

    # ---- the instruction
    for i in range(1, 7):
        g[f'7{i}'] = node('MpiText', f'Instruction {i} (picture)', string=PHOTO[i])
        g[f'8{i}'] = node('MpiText', f'Instruction {i} (no picture)', string=NO_PHOTO[i])
    g['77'] = node('MpiAnySwitch10', 'Instruction (picture)', select=['22', 0], **{f'any_{i}': [f'7{i}', 0] for i in range(1, 7)})
    g['87'] = node('MpiAnySwitch10', 'Instruction (no picture)', select=['22', 0], **{f'any_{i}': [f'8{i}', 0] for i in range(1, 7)})
    g['90'] = node('MpiIfElse', 'picture ? : no picture', boolean=['11', 4], true=['77', 0], false=['87', 0])
    g['91'] = node('MpiText', 'Tail (masked)', string=TAIL_MASKED)
    g['92'] = node('MpiText', 'Tail (whole frame)', string=TAIL_WHOLE)
    g['93'] = node('MpiIfElse', 'masked ? : whole frame', boolean=['23', 0], true=['91', 0], false=['92', 0])
    g['94'] = node('StringConcatenate', 'Instruction + tail', string_a=['90', 0], string_b=['93', 0], delimiter='\n')
    g['95'] = node('StringReplace', '{who}', string=['94', 0], find='{who}', replace=['15', 0])
    g['96'] = node('StringReplace', '{target}', string=['95', 0], find='{target}', replace=['16', 0])
    g['97'] = node('StringReplace', '{words}', string=['96', 0], find='{words}', replace=['12', 0])

    # ---- H3 r2v, turbo 8 steps (+ the swap LoRA where it holds the timing)
    g['100'] = node('UNETLoader', 'Load Diffusion Model', unet_name=H3_UNET, weight_dtype='default')
    g['101'] = node('CLIPLoader', 'Load CLIP', clip_name=H3_CLIP, type='minimax', device='default')
    g['102'] = node('VAELoader', 'Load VAE', vae_name=H3_VAE)
    g['103'] = node('VAELoader', 'Load Audio VAE', vae_name=H3_AVAE)
    g['104'] = node('MpiLoraModel', 'Character Swap LoRA', model=['100', 0], lora_name=SWAP, strength_model=1.0)
    g['105'] = node('MpiIfElse', 'swap LoRA ? : base', boolean=['21', 0], true=['104', 0], false=['100', 0])
    g['106'] = node('MpiLoraModel', 'Turbo LoRA (8-step)', model=['105', 0], lora_name=TURBO, strength_model=1.0)
    g['107'] = node('MpiTinyVaeLoader', 'Mpi Tiny Vae Loader', vae_name='taeh3.safetensors')
    g['108'] = node('MpiVideoSamplingPreview', 'Mpi Video Sampling Preview', model=['106', 0], vae=['107', 0], preview_rate=24)
    g['110'] = node('MpiH3References', 'H3 references (<Video 1> the clip, <Picture 1> the picture)',
                    clip=['101', 0], vae=['102', 0], audio_vae=['103', 0], prompt=['97', 0], width=['61', 0],
                    height=['62', 0], length=['30', 0], ref_image_size='match', ref_image_1=['11', 0],
                    ref_video_1=['60', 0])
    g['111'] = node('RandomNoise', 'RandomNoise', noise_seed=['17', 0])
    g['112'] = node('KSamplerSelect', 'KSamplerSelect', sampler_name='res_multistep')
    g['113'] = node('BasicScheduler', 'BasicScheduler', model=['105', 0], scheduler='simple', steps=8, denoise=1.0)
    g['114'] = node('BasicGuider', 'Basic Guider', model=['108', 0], conditioning=['110', 0])
    g['115'] = node('SamplerCustomAdvanced', 'SamplerCustomAdvanced', noise=['111', 0], guider=['114', 0],
                    sampler=['112', 0], sigmas=['113', 0], latent_image=['110', 1])
    g['116'] = node('VAEDecode', 'VAE Decode', samples=['115', 0], vae=['102', 0])
    g['117'] = node('MpiClearVram', 'Mpi Clear Vram', passthrough=['116', 0])

    # ---- back into the source
    g['120'] = node('MpiGradeMatch', 'Grade match on the band round the box', destination=['54', 1], source=['117', 0],
                    mask=['54', 2], band=48)
    g['121'] = node('InpaintStitchImproved', 'Stitch back into the source', stitcher=['54', 0], inpainted_image=['120', 0])
    g['122'] = node('MpiIfElse', 'masked ? stitched : whole frame', boolean=['23', 0], true=['121', 0], false=['117', 0])
    g['130'] = node('MpiSaveVideo', 'Output_Video', images=['122', 0], audio=['35', 0], fps=24, filename_prefix=prefix,
                    use_audio=True, truncate_to_audio=False)
    return g
