# Run the Video Edit Flow graph (flow_graph.py) on the G: bench by preset name. Run under the GPU lease:
#   python gpu_lease.py run -- G:/ComfyUi/python_embeded/python.exe run_flow.py R1_masked_horns
import json, os, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import flow_graph as fg  # noqa: E402

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
    text = (fg.PHOTO if photo else fg.NO_PHOTO)[idx] + '\n' + (fg.TAIL_MASKED if masked else fg.TAIL_WHOLE)
    return text.replace('{who}', p.get('who', 'the person')).replace('{target}', p.get('target', '')).replace('{words}', p.get('positive', ''))


for name in sys.argv[1:]:
    p = PRESETS[name]
    print(f'--- {name}\n{composed(p)}\n---', flush=True)
    t0 = time.time()
    try:
        pid = call('/prompt', {'prompt': fg.graph(prefix=f'mpi1036/{name}', **p), 'client_id': 'mpi1036-flow'})['prompt_id']
    except urllib.error.HTTPError as e:
        print(name, 'REJECTED', e.read().decode()[:4000], flush=True)
        sys.exit(1)
    while True:
        time.sleep(10)
        h = call(f'/history/{pid}')
        if pid in h:
            st = h[pid].get('status', {})
            outs = [f for o in h[pid].get('outputs', {}).values() for k in ('gifs', 'videos', 'images') for f in o.get(k, [])]
            print(f'{name}: {st.get("status_str")} in {time.time() - t0:.0f}s ->',
                  [f.get('subfolder', '') + '/' + f['filename'] for f in outs], flush=True)
            if st.get('status_str') != 'success':
                print(json.dumps(st.get('messages', []))[-4000:], flush=True)
                sys.exit(1)
            break
print('ALL DONE', flush=True)
