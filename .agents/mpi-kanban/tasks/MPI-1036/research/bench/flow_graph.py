# MPI-1036 Phase 3: the Video Edit Flow graph, as an API prompt with the app's Input_*/Output_* titles.
# The authoring source until it is proven on the bench; then it is loaded into the ComfyUI frontend and exported
# to comfy_workflows/raw/flow_video_edit.json (LiteGraph), which is what ships.
#
# One single-pass H3 r2v turbo graph (the shape Phases 1 and 2 passed; the Flow ships its H3 section swapped for the
# shipped two-stage one, flow_graph_ours.py, Fabio 2026-10-08 late), two routes:
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

# The instruction, in MiniMax's VIDEO-EDITING format (vendor h3-prompt-writing skill, references/ref-en.txt), POSITIVE
# ONLY (Fabio, 2026-10-08): what stays is a subject marked fully_preserved, and what must not leak is never named.
# Template 1 (picture) is the R2p prompt that kept the clip's room. {masked} is empty unless the route is masked.
SRC = "subject_definitions:\n<Video 1> is the source video for the target video edit.\n"
EDIT = "[video editing] The target video is an edited version of <Video 1>."
STYLE = "The target video keeps the look of <Video 1>: its lighting, colour grade and camera framing."
CAMERA = "The camera frames the shot exactly as <Video 1> does.{masked}"
SOUND = "\n\noverall_soundscape: The sound of <Video 1> continues unchanged.\nnon_diegetic_music: N/A"
SHOT = "<Video 1> (whole video): partially_preserved - the camera framing and movement, the light, the colour grade and the timing of every move are kept"
ROOM = "(appears in [Shot 1]): fully_preserved - the room, its furniture, walls, objects and light stay exactly as in <Video 1>."
MOVES = "move for move from the first frame, at the same place in the frame and the same size"
MASKED = "\nOnly {target} changes; everything else stays exactly as it is in <Video 1>, and the framing follows <Video 1> exactly, frame for frame."
# The constraint line (rendering faults only, the H3 guide's last line) runs on the masked route too (Fabio,
# 2026-10-08): without "no text" R1 re-drew the caption inside the box garbled; with it the caption is erased cleanly.
TAIL = ("No text, subtitles, captions, usernames, logos or watermarks, no blur, no compression artefacts, no "
        "warped anatomy, no flicker.")

PHOTO = {
    1: f"""{SRC}<Subject 1> is the character in <Picture 1>. {{look}}
<Subject 2> is {{who}} in <Video 1>.
<Subject 3> is the location of <Video 1>: {{kept}}

summary:
{EDIT} <Subject 1> takes the place of <Subject 2> and performs every move of <Subject 2> in <Subject 3>, with the camera, light and timing of <Video 1>.

retention_analysis:
{SHOT}; only the look of <Subject 2> changes.
<Subject 1> (appears in [Shot 1]): attribute_transfer - the face, skin, hair, outfit and accessories of the character in <Picture 1> are transferred onto <Subject 2>.
<Subject 2> (appears in [Shot 1]): partially_preserved - the position, scale, pose, every movement, expression and mouth movement are kept; the face, hair and clothes are those of <Subject 1>.
<Subject 3> {ROOM}

detailed_description:
{STYLE}
[Shot 1] In <Subject 3>, <Subject 1> performs exactly what <Subject 2> does in <Video 1>, {MOVES}, with the face, hair, outfit and accessories of <Picture 1> from every angle, the back of the head and outfit showing whenever <Subject 2> turns away. {{words}}
{CAMERA}{SOUND}""",

    2: f"""{SRC}<Subject 1> is the head of the person in <Picture 1>. {{look}}
<Subject 2> is {{who}} in <Video 1>.
<Subject 3> is the location of <Video 1>.

summary:
{EDIT} <Subject 2> has the head of <Subject 1> and keeps their own body, clothes and hands and every move, in <Subject 3>, with the camera, light and timing of <Video 1>.

retention_analysis:
{SHOT}; only the head of <Subject 2> changes.
<Subject 1> (appears in [Shot 1]): attribute_transfer - the face, skin, eyes, features and whole hairstyle of <Picture 1>, and anything worn on the head, are transferred onto <Subject 2>.
<Subject 2> (appears in [Shot 1]): partially_preserved - the body, clothes, hands, position, scale, pose, every movement, the head's angle, expression and mouth movement are kept; the head, the face and all of the hair, its lengths over the shoulders and down the back included, are those of <Subject 1>.
<Subject 3> {ROOM}

detailed_description:
{STYLE}
[Shot 1] In <Subject 3>, <Subject 2> performs exactly as in <Video 1>, {MOVES}, with the head of <Subject 1> from every angle: its face, skin and features, and its hairstyle, the back of the head showing whenever <Subject 2> turns away. All of <Subject 2>'s hair is <Subject 1>'s hair, at the length and in the style it has in <Picture 1>: over the shoulders and down the back, <Subject 2> shows that hairstyle and only that. {{words}}
{CAMERA}{SOUND}""",

    3: f"""{SRC}<Subject 1> is the outfit worn in <Picture 1>. {{look}}
<Subject 2> is {{who}} in <Video 1>.
<Subject 3> is the location of <Video 1>.

summary:
{EDIT} <Subject 2> wears <Subject 1> and keeps their own face, hair and body and every move, in <Subject 3>, with the camera, light and timing of <Video 1>.

retention_analysis:
{SHOT}; only what <Subject 2> wears changes.
<Subject 1> (appears in [Shot 1]): attribute_transfer - every garment and accessory of <Picture 1>, with its colour, pattern and material, or the bare skin it shows, is transferred onto <Subject 2>.
<Subject 2> (appears in [Shot 1]): partially_preserved - the face, hair, body, position, scale, pose, every movement, expression and mouth movement are kept; what they wear is <Subject 1>.
<Subject 3> {ROOM}

detailed_description:
{STYLE}
[Shot 1] In <Subject 3>, <Subject 2> performs exactly as in <Video 1>, {MOVES}, wearing <Subject 1>; the clothes move and fold with the body from every angle, the back of the outfit showing whenever <Subject 2> turns away. {{words}}
{CAMERA}{SOUND}""",

    4: f"""{SRC}<Subject 1> is the location in <Picture 1>. {{look}}
<Subject 2> is {{who}} in <Video 1>, who stays exactly as filmed: {{kept}}

summary:
{EDIT} <Subject 2> performs every move of <Video 1> exactly as filmed, now in <Subject 1>, its light falling on them, with the camera framing and timing of <Video 1>.

retention_analysis:
<Video 1> (whole video): partially_preserved - the camera framing and movement and the timing of every move are kept; only the place around <Subject 2> changes.
<Subject 1> (appears in [Shot 1]): fully_preserved - the place, its furniture, objects, surfaces, colours and light, seen from the camera of <Video 1>.
<Subject 2> (appears in [Shot 1]): fully_preserved - the face, hair, body, clothes, position, scale, pose, every movement, expression and mouth movement stay exactly as in <Video 1>.

detailed_description:
The target video has the camera framing of <Video 1> and the light of <Subject 1>.
[Shot 1] <Subject 2> moves exactly as in <Video 1>, {MOVES}, and the place around them is <Subject 1>, its light falling on them. {{words}}
{CAMERA}{SOUND}""",

    5: f"""{SRC}<Subject 1> is the main subject of <Picture 1>, the reference for this change. {{look}}

summary:
{EDIT} It makes the change described in [Shot 1], with <Subject 1> as its reference, and everything else plays exactly as filmed.

retention_analysis:
<Video 1> (whole video): partially_preserved - everything outside the change is kept exactly as filmed: every person, their performance, every move and its timing, the camera framing, the location and the light.
<Subject 1> (appears in [Shot 1]): attribute_transfer - what the change asks for is taken from <Picture 1>.

detailed_description:
{STYLE}
[Shot 1] <Video 1> plays exactly as filmed, {MOVES}, with this change, following <Subject 1>: {{words}}
{CAMERA}{SOUND}""",

    # Performance capture: the clip gives only the moves and the camera, so the vendor's task type is
    # REFERENCE GENERATION, not video editing (ref-en.txt 2.1: appearance from <Picture 1>, motion from <Video 1>).
    6: f"""subject_definitions:
<Video 1> is the reference for the performance, the camera framing and the timing of the target video.
<Subject 1> is the character whose appearance comes from <Picture 1> and whose every move, expression and mouth movement come from {{who}} in <Video 1>.
<Subject 2> is the location of <Picture 1>, with its light. {{look}}

summary:
[reference generation] <Subject 1> performs every move of {{who}} in <Video 1> in <Subject 2>, with the camera framing and timing of <Video 1> and the picture quality of <Picture 1>.

retention_analysis:
<Video 1> (performance, camera framing and timing): fully_preserved - every move, expression, mouth movement and its timing, and the camera framing and movement, are kept.
<Subject 1> (appears in [Shot 1]): fully_preserved - the face, skin, hair, outfit, accessories and art style of <Picture 1> are kept from every angle.
<Subject 2> (appears in [Shot 1]): fully_preserved - the place, its furniture, surfaces, colours and light, seen from the camera of <Video 1>.

detailed_description:
The target video has the picture quality, light and colour of <Picture 1>.
[Shot 1] In <Subject 2>, <Subject 1> performs exactly what {{who}} does in <Video 1>, {MOVES}, with the face, hair, outfit and accessories of <Picture 1> from every angle, the back of the head and outfit showing whenever they turn away. {{words}}
{CAMERA}{SOUND}""",
}

# No picture: the words are the new look. A new character with no reference asset gets no <Subject N> label
# (ref-en.txt 2.1: subjects are abstracted from reference assets), so the words land in [Shot 1].
NO_PHOTO = {
    1: f"""{SRC}<Subject 1> is {{who}} in <Video 1>.
<Subject 2> is the location of <Video 1>.

summary:
{EDIT} A new character, described in [Shot 1], takes the place of <Subject 1> and performs every move of <Subject 1> in <Subject 2>, with the camera, light and timing of <Video 1>.

retention_analysis:
{SHOT}; only the look of <Subject 1> changes.
<Subject 1> (appears in [Shot 1]): partially_preserved - the position, scale, pose, every movement, expression and mouth movement are kept; the face, hair and clothes are those of the new character.
<Subject 2> {ROOM}

detailed_description:
{STYLE}
[Shot 1] In <Subject 2>, the new character performs exactly what <Subject 1> does in <Video 1>, {MOVES}, their face, hair and outfit holding from every angle, the back of the head and outfit showing whenever they turn away. The new character: {{words}}
{CAMERA}{SOUND}""",

    2: f"""{SRC}<Subject 1> is {{who}} in <Video 1>.
<Subject 2> is the location of <Video 1>.

summary:
{EDIT} <Subject 1> has a new head, described in [Shot 1], and keeps their own body, clothes and hands and every move, in <Subject 2>, with the camera, light and timing of <Video 1>.

retention_analysis:
{SHOT}; only the head of <Subject 1> changes.
<Subject 1> (appears in [Shot 1]): partially_preserved - the body, clothes, hands, position, scale, pose, every movement, the head's angle, expression and mouth movement are kept; the head, the face and all of the hair, its lengths over the shoulders and down the back included, are the new ones.
<Subject 2> {ROOM}

detailed_description:
{STYLE}
[Shot 1] In <Subject 2>, <Subject 1> performs exactly as in <Video 1>, {MOVES}, with the new head from every angle, the back of the head showing whenever <Subject 1> turns away. All of <Subject 1>'s hair is the new hair, at its new length and in its new style: over the shoulders and down the back, <Subject 1> shows that hairstyle and only that. The new head: {{words}}
{CAMERA}{SOUND}""",

    3: f"""{SRC}<Subject 1> is {{who}} in <Video 1>.
<Subject 2> is the location of <Video 1>.

summary:
{EDIT} <Subject 1> wears a new outfit, described in [Shot 1], and keeps their own face, hair and body and every move, in <Subject 2>, with the camera, light and timing of <Video 1>.

retention_analysis:
{SHOT}; only what <Subject 1> wears changes.
<Subject 1> (appears in [Shot 1]): partially_preserved - the face, hair, body, position, scale, pose, every movement, expression and mouth movement are kept; what they wear is the new outfit.
<Subject 2> {ROOM}

detailed_description:
{STYLE}
[Shot 1] In <Subject 2>, <Subject 1> performs exactly as in <Video 1>, {MOVES}, wearing the new outfit; the clothes move and fold with the body from every angle, the back of the outfit showing whenever <Subject 1> turns away. The new outfit: {{words}}
{CAMERA}{SOUND}""",

    4: f"""{SRC}<Subject 1> is {{who}} in <Video 1>, who stays exactly as filmed.

summary:
{EDIT} <Subject 1> performs every move of <Video 1> exactly as filmed, now in a new place, described in [Shot 1], its light falling on them, with the camera framing and timing of <Video 1>.

retention_analysis:
<Video 1> (whole video): partially_preserved - the camera framing and movement and the timing of every move are kept; only the place around <Subject 1> changes.
<Subject 1> (appears in [Shot 1]): fully_preserved - the face, hair, body, clothes, position, scale, pose, every movement, expression and mouth movement stay exactly as in <Video 1>.

detailed_description:
The target video has the camera framing of <Video 1> and the light of the new place.
[Shot 1] <Subject 1> moves exactly as in <Video 1>, {MOVES}, and the place around them is new, its light falling on them. The new place: {{words}}
{CAMERA}{SOUND}""",

    5: f"""{SRC.rstrip()}

summary:
{EDIT} It makes the change described in [Shot 1], and everything else plays exactly as filmed.

retention_analysis:
<Video 1> (whole video): partially_preserved - everything outside the change is kept exactly as filmed: every person, their performance, every move and its timing, the camera framing, the location and the light.

detailed_description:
{STYLE}
[Shot 1] <Video 1> plays exactly as filmed, {MOVES}, with this change: {{words}}
{CAMERA}{SOUND}""",
}
NO_PHOTO[6] = NO_PHOTO[1]  # no picture, so there is no picture room to take

# R2/R3/R4 ignored a picture the prompt did not DESCRIBE (Phase 1 E/F/G named it and worked). caption=True describes
# the picture in-graph with the shipped image-describer encoder (dep `qwen3vl-abliterated-clip`, image_descriptor.json)
# through core TextGenerate - H3's own encoder is truncated, it cannot generate - and splices it in as {look}.
DESCRIBER = 'qwen3vl_4b_abliterated_fp8_scaled.safetensors'
PERSON = ("the main person: apparent age and gender, face and skin, hair colour, length and style, and every garment "
          "and accessory with its colour")
PLACE = "the place: the kind of room or location, its main furniture and objects, its surfaces and colours, and its light"
CAPTION_ASK = {
    1: f"Describe only {PERSON}.",
    2: ("Describe only the main person's head: apparent age and gender, face, skin, eyes, hair colour, length and "
        "style, and anything worn on the head."),
    3: ("Describe only what the main person wears: every garment and accessory with its colour, pattern and "
        "material, or the bare skin shown."),
    4: f"Describe only {PLACE}. Leave out any people.",
    5: "Describe the main subject of the image.",
    6: f"Describe {PERSON}, and then {PLACE}.",
}
# Same chat framing as image_descriptor.json, which runs on this encoder in the shipped app.
CAPTION_PROMPT = ("<|im_start|>system\nYou describe a reference picture for a video edit. Reply with one or two plain "
                  "sentences of concrete visual facts, starting at the subject: no preamble, no opinions, and describe "
                  "only what is there.<|im_end|>\n<|im_start|>user\n<|vision_start|><|image_pad|><|vision_end|>"
                  "{ask}<|im_end|>\n<|im_start|>assistant")


def node(cls, title, **inputs):
    return {'class_type': cls, 'inputs': inputs, '_meta': {'title': title}}


def graph(video='None', image='None', positive='', operation=1, keep_background=True, who='the person',
          target='', seed=904234, prefix='MpiVideo_Edit', caption=False, look='', kept=''):
    """video/image: bench picker values (the app injects `string` and the sync resets the picker to None).
    look/kept: the picture (and, for a background change, the clip's person) in words - the app fills them before
    the run (FlowDef `describe`, flowEnhance.js). caption=True describes in-graph instead: BENCH ONLY."""
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
    # Filled by the app before the run from Remote > Image descriptions (Fabio, 2026-10-08), never typed.
    g['18'] = node('MpiText', 'Input_Look', string=look)
    g['19'] = node('MpiText', 'Input_Kept', string=kept)

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
    g['91'] = node('MpiText', 'Masked line', string=MASKED)
    g['92'] = node('MpiText', 'No masked line', string='')
    g['93'] = node('MpiIfElse', 'masked ? line : none', boolean=['23', 0], true=['91', 0], false=['92', 0])
    g['98'] = node('MpiText', 'Constraint line', string=TAIL)
    g['94'] = node('StringConcatenate', 'Instruction + constraint line', string_a=['90', 0], string_b=['98', 0], delimiter='\n')
    g['99'] = node('StringReplace', '{masked}', string=['94', 0], find='{masked}', replace=['93', 0])
    g['95'] = node('StringReplace', '{who}', string=['99', 0], find='{who}', replace=['15', 0])
    g['96'] = node('StringReplace', '{target}', string=['95', 0], find='{target}', replace=['16', 0])
    g['97'] = node('StringReplace', '{words}', string=['96', 0], find='{words}', replace=['12', 0])
    look_in, kept_in = ['18', 0], ['19', 0]
    if caption:
        # MpiIfElse is lazy: with no picture the describer never loads.
        g['140'] = node('CLIPLoader', 'Describer (Qwen3-VL-4B)', clip_name=DESCRIBER, type='krea2', device='default')
        g['141'] = node('ImageScaleToTotalPixels', 'Picture at 1 MP', image=['11', 0], upscale_method='nearest-exact',
                        megapixels=1, resolution_steps=16)
        for i in range(1, 7):
            g[f'15{i}'] = node('MpiText', f'Describe {i}', string=CAPTION_PROMPT.replace('{ask}', CAPTION_ASK[i]))
        g['157'] = node('MpiAnySwitch10', 'Describe (by template)', select=['22', 0],
                        **{f'any_{i}': [f'15{i}', 0] for i in range(1, 7)})
        gen = dict(max_length=256, sampling_mode='on', thinking=False, use_default_template=True, **{
            'sampling_mode.temperature': 0.2, 'sampling_mode.top_k': 64, 'sampling_mode.top_p': 0.95,
            'sampling_mode.min_p': 0.05, 'sampling_mode.repetition_penalty': 1.05, 'sampling_mode.seed': 0,
            'sampling_mode.presence_penalty': 0})
        g['158'] = node('TextGenerate', 'Describe the picture', clip=['140', 0], prompt=['157', 0], image=['141', 0], **gen)
        # R2d's reply opened with ": " - drop anything before the first word
        g['164'] = node('RegexReplace', 'Trim the reply', string=['158', 0], regex_pattern='^[^A-Za-z0-9]+', replace='')
        g['160'] = node('MpiText', 'No picture, no description', string='')
        g['161'] = node('MpiIfElse', 'picture ? description : none', boolean=['11', 4], true=['164', 0], false=['160', 0])
        # With a picture, also describe what to KEEP from the clip's first frame: the person for a background change
        # (R4d took the picture's person), the room for Swap the person in the video's room (template 1's <Subject 3>).
        g['165'] = node('ImageFromBatch', 'First frame', image=['31', 0], batch_index=0, length=1)
        g['166'] = node('ImageScaleToTotalPixels', 'First frame at 1 MP', image=['165', 0], upscale_method='nearest-exact',
                        megapixels=1, resolution_steps=16)
        g['167'] = node('MpiText', 'Describe the person to keep', string=CAPTION_PROMPT.replace('{ask}', CAPTION_ASK[1]))
        g['174'] = node('MpiText', 'Describe the room to keep', string=CAPTION_PROMPT.replace('{ask}', CAPTION_ASK[4]))
        g['176'] = node('MpiMath', 'Background? (keep the person, else the room)', a=['22', 0], math_expression='a == 4')
        g['175'] = node('MpiIfElse', 'background ? person : room', boolean=['176', 0], true=['167', 0], false=['174', 0])
        g['168'] = node('TextGenerate', 'Describe what to keep in the clip', clip=['140', 0], prompt=['175', 0],
                        image=['166', 0], **gen)
        g['169'] = node('RegexReplace', 'Trim the reply', string=['168', 0], regex_pattern='^[^A-Za-z0-9]+', replace='')
        g['170'] = node('MpiMath', 'Background or the video room, with a picture?', a=['22', 0], b=['11', 4],
                        math_expression='((a == 4) + (a == 1)) * b > 0')
        g['171'] = node('MpiIfElse', 'keep ? clip description : none', boolean=['170', 0], true=['169', 0], false=['160', 0])
        look_in, kept_in = ['161', 0], ['171', 0]
    g['162'] = node('StringReplace', '{look}', string=['97', 0], find='{look}', replace=look_in)
    g['172'] = node('StringReplace', '{kept}', string=['162', 0], find='{kept}', replace=kept_in)
    prompt = ['172', 0]
    if caption:
        # Freed once both descriptions are in, before H3 loads.
        g['173'] = node('MpiClearVram', 'Free the describer', passthrough=['172', 0])
        g['163'] = node('PreviewAny', 'Prompt (bench only)', source=['173', 0])  # ponytail: drop before export
        prompt = ['173', 0]

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
                    clip=['101', 0], vae=['102', 0], audio_vae=['103', 0], prompt=prompt, width=['61', 0],
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
