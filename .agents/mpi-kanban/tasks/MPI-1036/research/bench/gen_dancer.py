# Video edit 14: our own clean test dancer (Fabio: his clips are screen recordings). The SHIPPED two-stage H3 ref2va
# graph, no references = text to video, very_high 9:16 (1088x1920), turbo on. Run under the GPU lease:
#   python gpu_lease.py run -- G:/ComfyUi/python_embeded/python.exe gen_dancer.py
import json, os, time, urllib.request

URL = 'http://127.0.0.1:8188'
GRAPH = os.path.join(os.path.dirname(os.path.abspath(__file__)), *['..'] * 6, 'comfy_workflows', 'minimax_h3_r2va.json')
PROMPT = (
    "Vertical phone video look: a bright modern apartment living room in soft daylight, white walls and a light wood "
    "floor, clean natural colours, sharp focus, upbeat playful mood, filmed like a TikTok dance video.\n"
    "[Shot 1] A young woman with long straight platinum-blonde hair, a fitted beige strapless mini dress and gold "
    "bracelets dances a TikTok routine facing the camera, framed from her head to her knees: she bounces on the beat "
    "and rolls her shoulders, raises both hands to frame her face and smiles at the camera, then turns her side to the "
    "camera swinging her hips and looks back over her shoulder, and turns to face the camera again for the final pose, "
    "hands on her hips.\n"
    "The camera is static at chest height on a tripod.\n"
    "overall_soundscape: A small room with a hard floor, her bare feet tapping on the beat, an upbeat pop dance track "
    "playing from a phone speaker in the room.\n"
    "non_diegetic_music: N/A\n"
    "No text, subtitles, captions, usernames, logos or watermarks, no cartoon or CG rendering, no flicker.")


def call(path, body=None):
    req = urllib.request.Request(URL + path, data=json.dumps(body).encode() if body else None,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


g = json.load(open(GRAPH, encoding='utf-8'))
by_title = {v['_meta']['title']: k for k, v in g.items()}
for title, key, value in (('Input_Positive', 'string', PROMPT), ('Input_Width', 'int', 1088),
                          ('Input_Height', 'int', 1920), ('Input_Duration', 'int', 4), ('Input_is_Turbo', 'boolean', True),
                          ('Input_seed', 'int', 20261009)):
    g[by_title[title]]['inputs'][key] = value
g[by_title['Output_Video']]['inputs']['filename_prefix'] = 'mpi1036/dancer_1088x1920'
g[by_title['Output_Preview']]['inputs']['filename_prefix'] = 'mpi1036/dancer_preview'
t0 = time.time()
pid = call('/prompt', {'prompt': g, 'client_id': 'mpi1036-dancer'})['prompt_id']
while True:
    time.sleep(15)
    h = call(f'/history/{pid}')
    if pid in h:
        st = h[pid].get('status', {})
        outs = [f.get('subfolder', '') + '/' + f['filename'] for o in h[pid].get('outputs', {}).values()
                for k in ('gifs', 'videos', 'images') for f in o.get(k, [])]
        print(f'dancer: {st.get("status_str")} in {time.time() - t0:.0f}s ->', outs, flush=True)
        if st.get('status_str') != 'success':
            print(json.dumps(st.get('messages', []))[-4000:], flush=True)
        break
