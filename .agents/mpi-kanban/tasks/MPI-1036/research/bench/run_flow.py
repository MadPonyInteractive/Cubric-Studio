# Run the Video Edit Flow graph (flow_graph.py) on the G: bench by preset name. Run under the GPU lease:
#   python gpu_lease.py run -- G:/ComfyUi/python_embeded/python.exe run_flow.py R1_masked_horns
import json, os, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flow_graph as fg  # noqa: E402
import flow_graph_ours as fgo  # noqa: E402

URL = 'http://127.0.0.1:8188'
EARS, DANCE = 'mpi1036_ears_last3s_24fps.mp4', 'mpi1036_source_24fps.mp4'
SHEET, ROOM = 'mpi1036_girl_back_mirror.png', 'mpi1036_girl_with_cat.png'
HORNS = ("two small glossy red demon horns grow out of her hair where the cat ears were; no cat ears and no "
         "headband are left, and the horns move with her head.")
PRESETS = {
    'R1_masked_horns': dict(video=EARS, operation=5, target='cat ears', positive=HORNS),
    'R2_swap_keep': dict(video=DANCE, image=SHEET, operation=1, who='the blonde woman dancing'),
    'R3_swap_picture_room': dict(video=DANCE, image=SHEET, operation=1, keep_background=False, who='the blonde woman dancing'),
    'R4_background': dict(video=DANCE, image=ROOM, operation=4, who='the blonde woman'),
    'R5_head': dict(video=DANCE, image=SHEET, operation=2, who='the blonde woman dancing'),
}
# R2/R3 again with GONE in templates 1 and 6 (both kept the dancer's own face, hair and clothes)
PRESETS['R2b_swap_keep'] = PRESETS['R2_swap_keep']
PRESETS['R3b_swap_picture_room'] = PRESETS['R3_swap_picture_room']
# R4 kept the source room too. Phase 1 runs E/F/G NAMED what the picture holds; these put that in the words.
PRESETS['R2c_swap_keep_named'] = dict(PRESETS['R2_swap_keep'], positive=(
    "The character in <Picture 1> is a young woman with freckles, a dark messy bun, pink-lined black cat ears, black "
    "paw gloves and a loose pink off-shoulder sweater with a black skull on it."))
PRESETS['R4c_background_named'] = dict(PRESETS['R4_background'], positive=(
    "The location in <Picture 1> is a bright bedroom: a white bed, a white vanity with a mirror, window blinds and "
    "soft cool daylight."))
# The same two, described in-graph by the image-describer encoder instead of by hand (flow_graph caption=True).
PRESETS['R2d_swap_keep_described'] = dict(PRESETS['R2_swap_keep'], caption=True)
PRESETS['R4d_background_described'] = dict(PRESETS['R4_background'], caption=True)
PRESETS['R3d_swap_picture_room_described'] = dict(PRESETS['R3_swap_picture_room'], caption=True)
PRESETS['R5d_head_described'] = dict(PRESETS['R5_head'], caption=True)
# R5d kept the source's long blonde lengths under the bun: template 2 now says all of their own hair goes
PRESETS['R5e_head_all_hair'] = dict(PRESETS['R5_head'], caption=True)
# R3d/R3e opened on the mirror shot's own pose whatever the prompt said: same mode with a front-facing picture
PRESETS['R3f_swap_picture_room_front'] = dict(PRESETS['R3_swap_picture_room'], image=ROOM, caption=True)
# Change the outfit (template 3) had no Phase 3 run yet
PRESETS['R6d_outfit_described'] = dict(video=DANCE, image=SHEET, operation=3, who='the blonde woman dancing', caption=True)
# R4d took the picture's person along with the room: describe the clip's person to keep as well
PRESETS['R4e_background_kept'] = dict(PRESETS['R4_background'], caption=True)
# R3d held the picture's mirror pose for ~0.8 s: template 6 now says from the first frame, never show the picture
PRESETS['R3e_swap_picture_room_no_photo_open'] = dict(PRESETS['R3_swap_picture_room'], caption=True)
# R2d on OUR shipped two-stage turbo H3 graph (flow_graph_ours.py) instead of the single pass: speed and look
PRESETS['R2o_swap_keep_ours'] = dict(PRESETS['R2d_swap_keep_described'], ours=True)
# R2o lost the clip's room: same graph, the prompt in MiniMax's video-editing format, positive only, room in words
# (hand-written from frame 0 here; the app's describer would write it)
# (that format is template 1 itself since Video edit 12; the room is now the in-graph clip description unless kept= is set)
PRESETS['R2p_swap_keep_ours_edit_format'] = dict(PRESETS['R2o_swap_keep_ours'], kept=(
    "a dim living room with a high sloped white ceiling and a dark ceiling fan, a wall-mounted black television over a "
    "dark fireplace, a long black sideboard with a phone charger and a cardboard box on it, a dark sofa, and framed "
    "photos on a pale wall beside an open doorway on the right, in warm low evening light."))
# S = every option on our graph with every template in the video-editing format, positive only (Video edit 12).
# Same clips, pictures, seed and words as the runs each one is judged against.
PRESETS['S7_masked_horns'] = dict(PRESETS['R1_masked_horns'], ours=True)  # vs R1b
PRESETS['S3_swap_picture_room'] = dict(PRESETS['R3f_swap_picture_room_front'], ours=True)  # vs R3f
PRESETS['S1_swap_keep'] = dict(PRESETS['R2d_swap_keep_described'], ours=True)  # vs R2p (room described in-graph)
PRESETS['S4_background'] = dict(PRESETS['R4e_background_kept'], ours=True)  # vs R4e
PRESETS['S5_head'] = dict(PRESETS['R5e_head_all_hair'], ours=True)  # vs R5e
PRESETS['S6_outfit'] = dict(PRESETS['R6d_outfit_described'], ours=True)  # vs R6d
# S7 lost R1b's lock (mean |lag| 1.11 vs 0.01, the face in the box re-drawn): the new prompt on the SINGLE pass
# tells whether the graph (stage 1 at 256 px for a 512 crop) or the prompt broke it.
PRESETS['S7s_masked_horns_single_pass'] = dict(PRESETS['R1_masked_horns'])
# S4 kept the room change and the dancer's look but danced its OWN arm moves (R4e followed the source): the new prompt
# on the single pass, and R4e's exact old template 4 on ours (`instr` replaces template node 74), to split graph/prompt.
PRESETS['S4s_background_single_pass'] = dict(PRESETS['R4e_background_kept'])
PRESETS['S4o_background_ours_old_prompt'] = dict(PRESETS['R4e_background_kept'], ours=True, instr=(
    "Use <Video 1> as {who} and their whole performance, their face, hair, clothes, every move and its timing, and "
    "as the camera framing, kept exactly as it is; use <Picture 1> only as the location and its light, without "
    "taking its composition, its camera angle, its grade or any person in it.\n"
    "[Shot 1] {who} from <Video 1> moves exactly as in <Video 1>, move for move, and the place around them is now "
    "the location of <Picture 1>, its light falling on them. {words}"
    "\nThe location of <Picture 1>: {look}\n{who} in <Video 1>, who stays exactly as filmed: {kept}"))
# S4/S5 (LoRA off on ours) re-performed the arms; S1 (LoRA on) and S3 followed. The swap LoRA forced on (`lora`).
PRESETS['S4L_background_lora'] = dict(PRESETS['S4_background'], lora=True)
PRESETS['S5L_head_lora'] = dict(PRESETS['S5_head'], lora=True)
# Which stage loses the moves: S5 stopped after stage 1 (MpiStageLatents is_preview -> Output_Preview, `_stage1` file).
PRESETS['S5p_head_stage1_only'] = dict(PRESETS['S5_head'], preview=True)
# S6 took the picture girl's face and bun along with the outfit, and re-performed: stage 2 re-draws 90% (sigma 0.9035)
# with the BASE model and refs `max`. Stage 2 started lower so it keeps stage 1's person and moves (`sigmas2`, node 600).
PRESETS['S6z_outfit_stage2_from_063'] = dict(PRESETS['S6_outfit'], sigmas2='0.6316, 0.3158, 0.0000')
# S5p (stage 1 only) already carries S5's break, so stage 1 is where it is born. Stage 1 vs the single pass that
# follows: INT8 'comfy kitchen attention' (519, both stages), euler + beta 10 (543/560), half size; shift is 12 in both.
# `patch` = {node: {input: value}}, one change per run.
PRESETS['S5pa_stage1_pytorch_attention'] = dict(PRESETS['S5p_head_stage1_only'],
                                                patch={'519': {'attention': 'pytorch attention'}})
PRESETS['S5pb_stage1_single_pass_sampler'] = dict(PRESETS['S5p_head_stage1_only'],
                                                  patch={'543': {'sampler_name': 'res_multistep'},
                                                         '560': {'scheduler': 'simple', 'steps': 8}})
# S5pa = S5p exactly (attention cleared). S5p's stage 1 jumps back to the clip's OPENING pose (and its frame-0 play
# icon) ~1 s in, then trails by ~24 frames. Core MiniMaxH3 refs encode a ref VIDEO at its own size (adapt_canvas keeps a
# smaller video as is; ref_image_size only touches pictures), so stage 1 sees a 576x1024 <Video 1> against a 288x512
# target - a 2:1 scale the single pass never has. The clip shrunk to the stage-1 size for stage 1's refs (`ref1_small`).
PRESETS['S5pr_stage1_ref_video_at_stage1_size'] = dict(PRESETS['S5p_head_stage1_only'], ref1_small=True)
# S5pr: stage 1 3.3x cheaper (9.5 s/it) but the replay stays (~frame 24 it replays frames 8-16). Left: the turbo LoRA
# (trained 768p) at 288x512. Both keep the small ref video: the base model for stage 1 (the graph's own Turbo-off path,
# 25 steps), and turbo at 0.75 size.
PRESETS['S5pn_stage1_base_model'] = dict(PRESETS['S5pr_stage1_ref_video_at_stage1_size'], patch={'444': {'boolean': False}})
# S5pn (base) and S5pq (0.75) replay at the SAME frame as every other stage-1 variant. Control: the SINGLE PASS at
# half size (render area 288x512, so the clip is 288x512 too, mirroring S5pr). Replays -> H3 cannot follow at that
# size whatever the graph; follows -> something in ours' plumbing.
PRESETS['S5h_single_pass_half_size'] = dict(PRESETS['S5_head'], ours=False, patch={
    '40': {'math_expression': 'floor(sqrt(147456 * a / b) / 32 + 0.5) * 32'},
    '41': {'math_expression': 'floor(sqrt(147456 * a / b) / 32 + 0.5) * 32'}})
# S5h (170 s) replays at the same frame too: not ours' plumbing. Every S5 run carries the NEW template 2; R5e (the
# only head swap that followed) the OLD one. The single pass at half size with R5e's exact old template 2 + look line.
OLD_T2 = ("Replace only the head and face of {who} in <Video 1> with the head and face of the character in <Picture 1>: "
          "their face, hair, skin and features from every angle, and the back of the head whenever {who} turns away. "
          "All of {who}'s own hair goes, the lengths over the shoulders and down the back too; the hairstyle is the "
          "one in <Picture 1>. Keep {who}'s body, clothes and hands, and the camera, framing, background, lighting, "
          "objects and all other people of <Video 1>. Match the head's position, angle, expression, mouth and every "
          "movement throughout the clip. Do not show <Picture 1> itself, its body or its background.\n{words}"
          "\nThe head in <Picture 1>: {look}")
PRESETS['S5ho_single_half_old_prompt'] = dict(PRESETS['S5h_single_pass_half_size'], patch=dict(
    PRESETS['S5h_single_pass_half_size']['patch'], **{'72': {'string': OLD_T2}}))
# S5ho (old prompt, half size) replays too: H3 loses the moves when it RENDERS below ~full size (448x768 and 288x512
# replay, 576x1024 follows), whatever graph, prompt or sampler. But S5pr showed the REFERENCE clip's tokens are most of
# the cost. So: the single pass at full size with the clip handed in at HALF size (`ref_half`).
PRESETS['S5sr_single_full_ref_half'] = dict(PRESETS['S5_head'], ours=False, ref_half=True)
# S5sr: in sync (lag +1 throughout, = R5e) in 461 s vs R5e 991 s - but the head barely swaps (blonde hair kept). The
# same with R5e's old template 2 tells whether the half-size clip or the new wording weakens the swap.
PRESETS['S5sro_single_full_ref_half_old_prompt'] = dict(PRESETS['S5sr_single_full_ref_half'], patch={'72': {'string': OLD_T2}})
# S5sro: in sync, stronger than S5sr but a hybrid (dark bun, blonde lengths, the last frame reverts); R5e (full clip)
# swapped fully. So the half clip weakens the edit. Both vs S5sro, old template kept: the clip at 0.75, and half + LoRA.
PRESETS['S5s75_single_ref_075_old_prompt'] = dict(PRESETS['S5sro_single_full_ref_half_old_prompt'], ref_half=False, ref_frac=0.75)
PRESETS['S5srL_single_ref_half_old_prompt_lora'] = dict(PRESETS['S5sro_single_full_ref_half_old_prompt'], lora=True)
# S5s75: FULL swap (= R5e), in sync, 641 s vs R5e 991 s. S5srL (LoRA) did not help. => the whole frame on the single
# pass with the clip at 0.75 (`x` = that setup, current templates). The other options on it:
for _src, _x in (('S1_swap_keep', 'S1x_swap_keep_ref075'), ('S3_swap_picture_room', 'S3x_picture_room_ref075'),
                 ('S4_background', 'S4x_background_ref075'), ('S6_outfit', 'S6x_outfit_ref075')):
    PRESETS[_x] = dict(PRESETS[_src], ours=False, ref_frac=0.75)
# Video edit 14: Fabio's close-up (videoCrop_002, 448x800) masked "Head" left the crown blonde: the union square capped
# at the frame width and cut the mask. T1 = his exact run on the fixed graph (should fall back to the whole frame);
# T2 = T1 + the UntMods Faceswap LoRA (trigger word in front) for likeness.
PRESETS['T1_closeup_head_fallback'] = dict(
    video='mpi1036_fabio_closeup.mp4', image='mpi1036_fabio_pink.png', operation=2, who='The blonde woman',
    target='Head', seed=2843194367, positive='Her hair is shoulder-length with pink and orange highlights.',
    look=('The subject is a young woman with fair, glowing skin and brown eyes. She has shoulder-length, curly hair '
          'that is black at the roots and transitions into shades of pink and light peach.'))
# Fabio saw T1 = T2 in likeness. Same A/B on our own clean 1088x1920 H3 dancer (gen_dancer.py), + masked "Head":
# her head stays put, so the square should fit and the masked route runs (crown + side-turn sync on a fitting mask).
PRESETS['D1_dancer_head_whole'] = dict(PRESETS['T1_closeup_head_fallback'], video='mpi1036_dancer_1088x1920.mp4',
                                       target='')
PRESETS['D3_dancer_head_masked'] = dict(PRESETS['D1_dancer_head_whole'], target='Head')
# T2/D2/D4 were T1/D1/D3 + a bench-only Faceswap override. Fabio picked D2/D4, so op 2 now carries the Faceswap LoRA
# in flow_graph itself and T1/D1/D3 build WITH it (the no-Faceswap baselines: git history, Video edit 14).
PRESETS['S5pq_stage1_turbo_075'] = dict(PRESETS['S5pr_stage1_ref_video_at_stage1_size'], patch={
    '620': {'math_expression': 'floor(a * 0.75 / 32 + 0.5) * 32'},
    '621': {'math_expression': 'floor(a * 0.75 / 32 + 0.5) * 32'}})
# Video edit 17: on Fabio's footage the ROOM options fell back to the clip's room (Change the background 3x on his
# bedroom picture, sidecars 11:14-11:18; Swap the person into the picture's room on his shower picture, _014). V*a = his
# runs on today's graph at 576p (his seed and words; the in-graph describer stands in for the app's Gemma); V*b = the
# same with <Video 1> = the dancer cut out by BiRefNet onto flat grey (`cutout`), so the clip carries no room to keep.
PRESETS['V4a_bedroom_bg'] = dict(video='mpi1036_room_crop002.mp4', image='mpi1036_room_bedroom.png', operation=4,
                                 who='the person', seed=3074610470, caption=True, positive=(
                                     'The background has paintings on the wall, a bed behind the woman, and a door on '
                                     'the right. '))
PRESETS['V4b_bedroom_bg_cutout'] = dict(PRESETS['V4a_bedroom_bg'], cutout=True)
PRESETS['V6a_shower_room'] = dict(video='mpi1036_room_dancer_e2.mp4', image='mpi1036_room_shower.png', operation=1,
                                  keep_background=False, who='the person', seed=3622567193, caption=True,
                                  positive='A naked woman dancing in a bathroom ')
PRESETS['V6b_shower_room_cutout'] = dict(PRESETS['V6a_shower_room'], cutout=True)
# V4a (bench describer) DID change the room: its {kept} named only the person. Fabio's app asks Gemma the same
# "Describe only the main person" of the clip's first frame; if that answer also names the clip's room, the prompt says
# the person "stays exactly as filmed: ... in a living room" and the room is kept. V4c = V4a's own look + such a kept.
# Fabio's own op-4 outputs, looked at: _008 and _009 (his words naming the bedroom) DID change the room; only _007 kept
# the clip's room - no words, seed 3185382522. V4d = _007 exactly on today's graph (the cut-out twin only if it fails).
PRESETS['V4d_bedroom_bg_no_words'] = dict(PRESETS['V4a_bedroom_bg'], seed=3185382522, positive='')
# V6a/V6b (576p) BOTH took the shower, with a look naming no place at all: the describer is not template 6's failure.
# Left vs his _014: 1080p (Input_Quality 2088960 -> clip ~816x1440, the clip's room in far more detail). 39 frames
# (MpiMath has no min()) to bound a 16 GB card; V6d = the cut-out at the size that failed.
PRESETS['V6c_shower_room_1080p'] = dict(PRESETS['V6a_shower_room'], quality=2088960,
                                        patch={'30': {'math_expression': 'a * 0 + 39'}})
PRESETS['V6d_shower_room_1080p_cutout'] = dict(PRESETS['V6c_shower_room_1080p'], cutout=True)
# V6c/V6d kept the shower but LOST THE DANCE (picture framing, back turn = _014). Where does it stop following?
# (Fabio: no 960p - "if 768 works, you already have your answer"; avoid extra renders. V6f and V4e dropped.)
PRESETS['V6e_shower_room_768p'] = dict(PRESETS['V6c_shower_room_1080p'], quality=1032192)
# Fabio: give it control. First <Video 1> = the clip as Canny (the AIO converter, whole frame), no ControlNet (V6g);
# then the same + the H3 Fun ControlNet Union fed that Canny (V6h) - the with/without pair, on V6c's failing case.
PRESETS['V6g_shower_1080p_canny_ref'] = dict(PRESETS['V6c_shower_room_1080p'], cannyref=True)
PRESETS['V6h_shower_1080p_canny_ref_fun'] = dict(PRESETS['V6g_shower_1080p_canny_ref'], funcontrol=True)
PRESETS['V4c_bedroom_bg_kept_names_room'] =dict(PRESETS['V4a_bedroom_bg'], caption=False, look=(
    'The room is a bedroom with light-colored walls and a textured ceiling. A bed with a patterned duvet is partially '
    'visible on the left. A framed picture hangs on the wall to the right, and a dark wooden piece of furniture, possibly '
    'a nightstand or dresser, is in the background. The lighting is soft and even, suggesting indoor ambient light.'),
    kept=('A young woman, nude, with fair skin and a smiling expression, has long, straight red hair falling over her '
          'shoulders and wears a silver cross necklace. She stands in a bright living room with white walls, a '
          'wall-mounted black TV on a white sideboard, a grey sofa on the right and a white door behind her.'))


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def composed(p):
    """The prompt the graph builds, for the log (mirrors nodes 90-99); {look}/{kept} stay as placeholders."""
    op = p.get('operation', 1)
    photo, keep, masked = p.get('image', 'None') != 'None', p.get('keep_background', True), bool(p.get('target'))
    idx = 6 if op == 1 and photo and not keep else op
    text = ((fg.PHOTO if photo else fg.NO_PHOTO)[idx] + '\n' + fg.TAIL).replace('{masked}', fg.MASKED if masked else '')
    return text.replace('{who}', p.get('who', 'the person')).replace('{target}', p.get('target', '')).replace('{words}', p.get('positive', ''))


BENCH_KEYS = ('ours', 'instr', 'lora', 'preview', 'sigmas2', 'patch', 'ref1_small', 'ref_half', 'ref_frac', 'cutout',
              'cannyref', 'funcontrol')
FUN = 'minimax_h3_fun_controlnet_union_pruned_int8_convrot.safetensors'  # Comfy-Org/MiniMax-H3 model_patches/, v1


def build(name):
    """A preset's API graph, with its bench-only overrides applied (check_graphs-style tools import this)."""
    p = PRESETS[name]
    g = (fgo.graph if p.get('ours') else fg.graph)(prefix=f'mpi1036/{name}',
                                                   **{k: v for k, v in p.items() if k not in BENCH_KEYS})
    if p.get('instr'):
        g['74']['inputs']['string'] = p['instr']  # ponytail: bench-only template override (picture bank, op 4)
    if p.get('lora'):
        g['21']['inputs']['math_expression'] = '1 > 0'  # the swap LoRA on whatever the route
    if p.get('preview'):
        g['567']['inputs']['is_preview'] = True  # ours stops after stage 1, decoded to Output_Preview
    if p.get('sigmas2'):
        g['600']['inputs']['sigmas'] = p['sigmas2']  # where ours' stage-2 refine starts
    for node_id, inputs in p.get('patch', {}).items():
        g[node_id]['inputs'].update(inputs)  # one node-level change per run
    if p.get('ref1_small'):  # ours: the clip at the stage-1 size for stage 1's refs
        g['906'] = fg.node('ImageScale', 'Clip at the stage-1 size', image=['60', 0], upscale_method='lanczos',
                           width=['621', 0], height=['620', 0], crop='disabled')
        g['330']['inputs']['ref_video_1'] = ['906', 0]
    if p.get('ref_half') or p.get('ref_frac'):  # single pass: the clip as <Video 1> at a fraction of the render size
        e = f"floor(a * {p.get('ref_frac', 0.5)} / 32 + 0.5) * 32"
        g['907'] = fg.node('MpiMath', 'Clip width', a=['61', 0], math_expression=e)
        g['908'] = fg.node('MpiMath', 'Clip height', a=['62', 0], math_expression=e)
        g['906'] = fg.node('ImageScale', 'Clip at half size', image=['60', 0], upscale_method='lanczos',
                           width=['907', 0], height=['908', 0], crop='disabled')
        g['110']['inputs']['ref_video_1'] = ['906', 0]
    if p.get('cutout'):  # whole frame: <Video 1> = the person cut out by BiRefNet onto flat grey (no room to keep)
        g['190'] = fg.node('LoadBackgroundRemovalModel', 'BiRefNet', bg_removal_name='birefnet.safetensors')
        g['191'] = fg.node('RemoveBackground', 'The person in every frame', bg_removal_model=['190', 0], image=['42', 0])
        g['192'] = fg.node('EmptyImage', 'Flat grey', width=['43', 0], height=['44', 0], batch_size=['30', 0],
                           color=0x808080)
        g['193'] = fg.node('ImageCompositeMasked', 'The person on grey', destination=['192', 0], source=['42', 0],
                           x=0, y=0, resize_source=False, mask=['191', 0])
        g['110']['inputs']['ref_video_1'] = ['193', 0]
    if p.get('cannyref') or p.get('funcontrol'):  # the whole-frame clip (node 42) as Canny, back at the clip's size
        g['195'] = fg.node('AIO_Preprocessor', 'Canny (AIO)', image=['42', 0], preprocessor='CannyEdgePreprocessor',
                           resolution=1024)
        g['196'] = fg.node('ImageResizeKJv2', 'Canny at the clip size', image=['195', 0], width=['43', 0],
                           height=['44', 0], upscale_method='lanczos', keep_proportion='crop', pad_color='0, 0, 0',
                           crop_position='center', divisible_by=32, device='cpu')
    if p.get('cannyref'):
        g['110']['inputs']['ref_video_1'] = ['196', 0]
    if p.get('funcontrol'):  # H3 Fun ControlNet as a model patch between the turbo LoRA and the sampler
        g['197'] = fg.node('ModelPatchLoader', 'H3 Fun ControlNet Union', name=FUN)
        g['198'] = fg.node('MiniMaxH3FunControlNetApply', 'Apply H3 Fun ControlNet (Canny)', model=['106', 0],
                           model_patch=['197', 0], vae=['102', 0], strength=1.0, start_percent=0.0, end_percent=1.0,
                           control_video=['196', 0])
        g['108']['inputs']['model'] = ['198', 0]
    return g


for name in sys.argv[1:]:
    if name not in PRESETS:  # a queued run dropped from PRESETS while it waited for the lease
        print(f'--- {name}: dropped, skipped', flush=True)
        continue
    p = PRESETS[name]
    print(f'--- {name}\n{composed(p)}\n---', flush=True)
    t0 = time.time()
    try:
        pid = call('/prompt', {'prompt': build(name), 'client_id': 'mpi1036-flow'})['prompt_id']
    except urllib.error.HTTPError as e:
        print(name, 'REJECTED', e.read().decode()[:4000], flush=True)
        sys.exit(1)
    while True:
        time.sleep(10)
        h = call(f'/history/{pid}')
        if pid in h:
            st = h[pid].get('status', {})
            outs = [f for o in h[pid].get('outputs', {}).values() for k in ('gifs', 'videos', 'images') for f in o.get(k, [])]
            for o in h[pid].get('outputs', {}).values():
                for t in o.get('text', []):
                    print('PROMPT SENT =', t, flush=True)
            print(f'{name}: {st.get("status_str")} in {time.time() - t0:.0f}s ->',
                  [f.get('subfolder', '') + '/' + f['filename'] for f in outs], flush=True)
            if st.get('status_str') != 'success':
                print(json.dumps(st.get('messages', []))[-4000:], flush=True)
                sys.exit(1)
            break
print('ALL DONE', flush=True)
