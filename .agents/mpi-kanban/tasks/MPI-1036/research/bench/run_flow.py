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
PRESETS['R2p_swap_keep_ours_edit_format'] = dict(PRESETS['R2o_swap_keep_ours'], edit_format=True, room=(
    "a dim living room with a high sloped white ceiling and a dark ceiling fan, a wall-mounted black television over a "
    "dark fireplace, a long black sideboard with a phone charger and a cardboard box on it, a dark sofa, and framed "
    "photos on a pale wall beside an open doorway on the right, in warm low evening light."))


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def composed(p):
    """The prompt the graph builds, for the log (mirrors nodes 90-97)."""
    op = p.get('operation', 1)
    photo, keep, masked = p.get('image', 'None') != 'None', p.get('keep_background', True), bool(p.get('target'))
    idx = 6 if op == 1 and photo and not keep else op
    look = fg.LOOK[idx] if photo and p.get('caption') else ''
    text = (fg.PHOTO if photo else fg.NO_PHOTO)[idx] + look + '\n' + (fg.TAIL_MASKED if masked else fg.TAIL_WHOLE)
    return text.replace('{who}', p.get('who', 'the person')).replace('{target}', p.get('target', '')).replace('{words}', p.get('positive', ''))


for name in sys.argv[1:]:
    p = PRESETS[name]
    print(f'--- {name}\n{composed(p)}\n---', flush=True)
    t0 = time.time()
    try:
        build = fgo.graph if p.get('ours') else fg.graph
        args = {k: v for k, v in p.items() if k != 'ours'}
        pid = call('/prompt', {'prompt': build(prefix=f'mpi1036/{name}', **args), 'client_id': 'mpi1036-flow'})['prompt_id']
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
