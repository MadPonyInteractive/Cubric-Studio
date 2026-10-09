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
PRESETS['S5pq_stage1_turbo_075'] = dict(PRESETS['S5pr_stage1_ref_video_at_stage1_size'], patch={
    '620': {'math_expression': 'floor(a * 0.75 / 32 + 0.5) * 32'},
    '621': {'math_expression': 'floor(a * 0.75 / 32 + 0.5) * 32'}})


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


BENCH_KEYS = ('ours', 'instr', 'lora', 'preview', 'sigmas2', 'patch', 'ref1_small', 'ref_half', 'ref_frac')


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
    return g


for name in sys.argv[1:]:
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
